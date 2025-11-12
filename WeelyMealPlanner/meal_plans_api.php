<?php
// 必须在任何输出之前启动session
session_start();

// 设置响应头
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// 检查登录状态
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'UNAUTHORIZED']);
    exit;
}
$user_id = (int)$_SESSION['user_id'];

// 连接数据库（使用API专用连接文件，避免输出HTML错误）
require_once __DIR__ . '/api_connect.php'; // $conn (mysqli)

// 检查数据库连接
if (!$conn || $conn->connect_error) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database connection failed']);
    exit;
}

function respond($ok, $data = null, $http = 200) {
    http_response_code($http);
    echo json_encode(['ok' => $ok, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? null;

if (!$action) {
    respond(false, 'Missing action', 400);
}

function get_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ===== 添加餐食计划 =====
if ($action === 'add_meal_plan') {
    $body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
    $recipe_id = isset($body['recipe_id']) ? (int)$body['recipe_id'] : 0;
    $meal_date = trim($body['meal_date'] ?? '');
    $meal_slot = trim($body['meal_slot'] ?? '');
    
    if (!$recipe_id || !$meal_date || !$meal_slot) {
        respond(false, 'recipe_id, meal_date, and meal_slot are required', 422);
    }
    
    $allowed_slots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    if (!in_array($meal_slot, $allowed_slots, true)) {
        respond(false, 'Invalid meal_slot. Must be one of: ' . implode(', ', $allowed_slots), 422);
    }
    
    // 检查日期格式
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $meal_date)) {
        respond(false, 'Invalid date format. Use YYYY-MM-DD', 422);
    }
    
    // 检查食谱是否存在且属于当前用户
    $stmt = $conn->prepare("SELECT recipe_id FROM recipes WHERE recipe_id = ? AND (user_id = ? OR user_id IS NULL)");
    $stmt->bind_param('ii', $recipe_id, $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        $stmt->close();
        respond(false, 'Recipe not found or access denied', 404);
    }
    $stmt->close();
    
    // 开始事务
    $conn->begin_transaction();
    
    try {
        // 1. 先检查是否已存在该用户、日期、餐时段的计划
        $check_sql = "SELECT plan_id FROM meal_plans WHERE user_id = ? AND meal_date = ? AND meal_slot = ?";
        $check_stmt = $conn->prepare($check_sql);
        $check_stmt->bind_param('iss', $user_id, $meal_date, $meal_slot);
        $check_stmt->execute();
        $check_result = $check_stmt->get_result();
        $existing_plan = $check_result->fetch_assoc();
        $check_stmt->close();
        
        $plan_id = null;
        
        if ($existing_plan) {
            // 如果计划已存在，使用现有的plan_id
            $plan_id = $existing_plan['plan_id'];
            
            // 获取现有的recipe_ids JSON数组
            $get_recipe_ids = $conn->prepare("SELECT recipe_ids FROM meal_plans WHERE plan_id = ?");
            $get_recipe_ids->bind_param('i', $plan_id);
            $get_recipe_ids->execute();
            $result = $get_recipe_ids->get_result();
            $row = $result->fetch_assoc();
            $get_recipe_ids->close();
            
            // 解析现有的recipe_ids（如果存在）
            $recipe_ids = [];
            if ($row && $row['recipe_ids']) {
                $decoded = json_decode($row['recipe_ids'], true);
                if (is_array($decoded)) {
                    $recipe_ids = $decoded;
                }
            }
            
            // 如果食谱ID不在数组中，添加它（支持一个食谱添加到多个计划）
            if (!in_array($recipe_id, $recipe_ids, true)) {
                $recipe_ids[] = $recipe_id;
            }
            
            // 更新计划的recipe_ids和更新时间
            $recipe_ids_json = json_encode($recipe_ids, JSON_UNESCAPED_UNICODE);
            $update_plan = $conn->prepare("UPDATE meal_plans SET recipe_ids = ?, updated_at = NOW() WHERE plan_id = ?");
            $update_plan->bind_param('si', $recipe_ids_json, $plan_id);
            $update_plan->execute();
            $update_plan->close();
        } else {
            // 如果计划不存在，创建新计划，recipe_ids包含当前食谱ID
            $recipe_ids = [$recipe_id];
            $recipe_ids_json = json_encode($recipe_ids, JSON_UNESCAPED_UNICODE);
            $insert_sql = "INSERT INTO meal_plans (user_id, meal_date, meal_slot, recipe_ids, created_at, updated_at) 
                          VALUES (?, ?, ?, ?, NOW(), NOW())";
            $insert_stmt = $conn->prepare($insert_sql);
            $insert_stmt->bind_param('isss', $user_id, $meal_date, $meal_slot, $recipe_ids_json);
            if (!$insert_stmt->execute()) {
                throw new Exception('Failed to create meal plan: ' . $insert_stmt->error);
            }
            $plan_id = $insert_stmt->insert_id;
            $insert_stmt->close();
        }
        
        // 提交事务
        $conn->commit();
        respond(true, ['plan_id' => $plan_id]);
        
    } catch (Exception $e) {
        // 回滚事务
        $conn->rollback();
        respond(false, $e->getMessage(), 500);
    }
}

// ===== 获取餐食计划 =====
if ($action === 'get_meal_plans') {
    $start_date = trim($_GET['start_date'] ?? '');
    $end_date = trim($_GET['end_date'] ?? '');
    
    // 如果提供了日期范围，查询该范围内的计划
    if ($start_date && $end_date) {
        $sql = "SELECT mp.plan_id, mp.meal_date, mp.meal_slot, 
                       r.recipe_id, r.name AS recipe_name, r.category AS recipe_category,
                       r.nutrition, r.ingredients
                FROM meal_plans mp
                LEFT JOIN recipes r ON mp.plan_id = r.plan_id
                WHERE mp.user_id = ? AND mp.meal_date BETWEEN ? AND ?
                ORDER BY mp.meal_date ASC, 
                         FIELD(mp.meal_slot, 'Breakfast', 'Lunch', 'Dinner', 'Snacks')";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('iss', $user_id, $start_date, $end_date);
    } else {
        // 如果没有提供日期范围，返回最近7天的计划
        $sql = "SELECT mp.plan_id, mp.meal_date, mp.meal_slot, 
                       r.recipe_id, r.name AS recipe_name, r.category AS recipe_category,
                       r.nutrition, r.ingredients
                FROM meal_plans mp
                LEFT JOIN recipes r ON mp.plan_id = r.plan_id
                WHERE mp.user_id = ? AND mp.meal_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                ORDER BY mp.meal_date ASC, 
                         FIELD(mp.meal_slot, 'Breakfast', 'Lunch', 'Dinner', 'Snacks')";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $user_id);
    }
    
    if (!$stmt->execute()) {
        respond(false, 'Query failed: ' . $stmt->error, 500);
    }
    
    $result = $stmt->get_result();
    $plans = [];
    while ($row = $result->fetch_assoc()) {
        // 解析JSON字段
        if ($row['nutrition']) {
            $row['nutrition'] = json_decode($row['nutrition'], true);
        }
        if ($row['ingredients']) {
            $row['ingredients'] = json_decode($row['ingredients'], true);
        }
        $plans[] = $row;
    }
    $stmt->close();
    respond(true, $plans);
}

// ===== 删除餐食计划 =====
if ($action === 'remove_meal_plan') {
    $body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
    $plan_id = isset($body['plan_id']) ? (int)$body['plan_id'] : 0;
    $meal_date = trim($body['meal_date'] ?? '');
    $meal_slot = trim($body['meal_slot'] ?? '');
    
    $conn->begin_transaction();
    
    try {
        // 找到要删除的计划ID
        if ($plan_id) {
            // 验证计划属于当前用户
            $check = $conn->prepare("SELECT plan_id FROM meal_plans WHERE plan_id = ? AND user_id = ?");
            $check->bind_param('ii', $plan_id, $user_id);
            $check->execute();
            $check_result = $check->get_result();
            if ($check_result->num_rows === 0) {
                $check->close();
                throw new Exception('Meal plan not found or access denied');
            }
            $check->close();
        } else if ($meal_date && $meal_slot) {
            // 通过日期和餐时段查找计划
            $find = $conn->prepare("SELECT plan_id FROM meal_plans WHERE user_id = ? AND meal_date = ? AND meal_slot = ?");
            $find->bind_param('iss', $user_id, $meal_date, $meal_slot);
            $find->execute();
            $find_result = $find->get_result();
            if ($find_result->num_rows === 0) {
                $find->close();
                throw new Exception('Meal plan not found');
            }
            $plan_row = $find_result->fetch_assoc();
            $plan_id = $plan_row['plan_id'];
            $find->close();
        } else {
            throw new Exception('Either plan_id or (meal_date and meal_slot) is required');
        }
        
        // 删除计划（recipe_ids会自动随计划删除）
        $delete = $conn->prepare("DELETE FROM meal_plans WHERE plan_id = ? AND user_id = ?");
        $delete->bind_param('ii', $plan_id, $user_id);
        if (!$delete->execute()) {
            throw new Exception('Failed to delete meal plan: ' . $delete->error);
        }
        $affected = $delete->affected_rows;
        $delete->close();
        
        $conn->commit();
        respond(true, ['deleted' => $affected]);
        
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, $e->getMessage(), 500);
    }
}

// ===== 批量添加餐食计划 =====
if ($action === 'batch_add_meal_plans') {
    $body = get_json_body();
    $plans = $body['plans'] ?? [];
    
    if (empty($plans) || !is_array($plans)) {
        respond(false, 'plans array is required', 422);
    }
    
    $allowed_slots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    $conn->begin_transaction();
    
    try {
        foreach ($plans as $plan) {
            $recipe_id = isset($plan['recipe_id']) ? (int)$plan['recipe_id'] : 0;
            $meal_date = trim($plan['meal_date'] ?? '');
            $meal_slot = trim($plan['meal_slot'] ?? '');
            
            if (!$recipe_id || !$meal_date || !$meal_slot) {
                throw new Exception('Each plan must have recipe_id, meal_date, and meal_slot');
            }
            
            if (!in_array($meal_slot, $allowed_slots, true)) {
                throw new Exception('Invalid meal_slot: ' . $meal_slot);
            }
            
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $meal_date)) {
                throw new Exception('Invalid date format: ' . $meal_date);
            }
            
            // 检查食谱是否存在
            $check_recipe = $conn->prepare("SELECT recipe_id FROM recipes WHERE recipe_id = ?");
            $check_recipe->bind_param('i', $recipe_id);
            $check_recipe->execute();
            $check_result = $check_recipe->get_result();
            if ($check_result->num_rows === 0) {
                $check_recipe->close();
                throw new Exception('Recipe not found: ' . $recipe_id);
            }
            $check_recipe->close();
            
            // 检查是否已存在计划
            $check_plan = $conn->prepare("SELECT plan_id FROM meal_plans WHERE user_id = ? AND meal_date = ? AND meal_slot = ?");
            $check_plan->bind_param('iss', $user_id, $meal_date, $meal_slot);
            $check_plan->execute();
            $plan_result = $check_plan->get_result();
            $existing_plan = $plan_result->fetch_assoc();
            $check_plan->close();
            
            $plan_id = null;
            
            if ($existing_plan) {
                // 使用现有计划
                $plan_id = $existing_plan['plan_id'];
                
                // 获取现有的recipe_ids JSON数组
                $get_recipe_ids = $conn->prepare("SELECT recipe_ids FROM meal_plans WHERE plan_id = ?");
                $get_recipe_ids->bind_param('i', $plan_id);
                $get_recipe_ids->execute();
                $result = $get_recipe_ids->get_result();
                $row = $result->fetch_assoc();
                $get_recipe_ids->close();
                
                // 解析现有的recipe_ids（如果存在）
                $recipe_ids = [];
                if ($row && $row['recipe_ids']) {
                    $decoded = json_decode($row['recipe_ids'], true);
                    if (is_array($decoded)) {
                        $recipe_ids = $decoded;
                    }
                }
                
                // 如果食谱ID不在数组中，添加它
                if (!in_array($recipe_id, $recipe_ids, true)) {
                    $recipe_ids[] = $recipe_id;
                }
                
                // 更新计划的recipe_ids和更新时间
                $recipe_ids_json = json_encode($recipe_ids, JSON_UNESCAPED_UNICODE);
                $update = $conn->prepare("UPDATE meal_plans SET recipe_ids = ?, updated_at = NOW() WHERE plan_id = ?");
                $update->bind_param('si', $recipe_ids_json, $plan_id);
                $update->execute();
                $update->close();
            } else {
                // 创建新计划，recipe_ids包含当前食谱ID
                $recipe_ids = [$recipe_id];
                $recipe_ids_json = json_encode($recipe_ids, JSON_UNESCAPED_UNICODE);
                $insert = $conn->prepare("INSERT INTO meal_plans (user_id, meal_date, meal_slot, recipe_ids, created_at, updated_at) 
                                         VALUES (?, ?, ?, ?, NOW(), NOW())");
                $insert->bind_param('isss', $user_id, $meal_date, $meal_slot, $recipe_ids_json);
                if (!$insert->execute()) {
                    throw new Exception('Failed to create meal plan: ' . $insert->error);
                }
                $plan_id = $insert->insert_id;
                $insert->close();
            }
        }
        
        $conn->commit();
        respond(true, ['added' => count($plans)]);
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, $e->getMessage(), 500);
    }
}

// ===== 获取指定周的计划 =====
if ($action === 'get_week_plans') {
    $week_start = trim($_GET['week_start'] ?? '');
    
    if (!$week_start) {
        // 如果没有提供week_start，默认使用本周一
        $week_start = date('Y-m-d', strtotime('monday this week'));
    }
    
    // 验证日期格式
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $week_start)) {
        respond(false, 'Invalid date format. Use YYYY-MM-DD', 422);
    }
    
    // 计算周日（一周的最后一天）
    $week_end = date('Y-m-d', strtotime($week_start . ' +6 days'));
    
    // 使用 meal_plans.recipe_ids JSON字段来关联食谱
    // 先获取所有计划，然后在PHP中处理JSON（兼容MySQL 5.7+）
    $sql = "SELECT mp.plan_id, mp.meal_date, mp.meal_slot, mp.recipe_ids
            FROM meal_plans mp
            WHERE mp.user_id = ? AND mp.meal_date BETWEEN ? AND ?
            ORDER BY mp.meal_date ASC, 
                     FIELD(mp.meal_slot, 'Breakfast', 'Lunch', 'Dinner', 'Snacks')";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iss', $user_id, $week_start, $week_end);
    
    if (!$stmt->execute()) {
        respond(false, 'Query failed: ' . $stmt->error, 500);
    }
    
    $result = $stmt->get_result();
    $plans = [];
    
    // 收集所有需要查询的食谱ID
    $all_recipe_ids = [];
    $plan_data = [];
    
    while ($row = $result->fetch_assoc()) {
        $plan_data[] = $row;
        // 解析recipe_ids JSON数组
        if ($row['recipe_ids']) {
            $recipe_ids = json_decode($row['recipe_ids'], true);
            if (is_array($recipe_ids)) {
                $all_recipe_ids = array_merge($all_recipe_ids, $recipe_ids);
            }
        }
    }
    $stmt->close();
    
    // 去重并查询所有食谱信息
    $all_recipe_ids = array_unique($all_recipe_ids);
    $recipes_map = [];
    
    if (!empty($all_recipe_ids)) {
        $placeholders = implode(',', array_fill(0, count($all_recipe_ids), '?'));
        $recipes_sql = "SELECT recipe_id, name, category, nutrition, ingredients 
                       FROM recipes 
                       WHERE recipe_id IN ($placeholders)";
        $recipes_stmt = $conn->prepare($recipes_sql);
        $recipes_stmt->bind_param(str_repeat('i', count($all_recipe_ids)), ...$all_recipe_ids);
        $recipes_stmt->execute();
        $recipes_result = $recipes_stmt->get_result();
        
        while ($recipe = $recipes_result->fetch_assoc()) {
            // 解析JSON字段
            if ($recipe['nutrition']) {
                $recipe['nutrition'] = json_decode($recipe['nutrition'], true);
            }
            if ($recipe['ingredients']) {
                $recipe['ingredients'] = json_decode($recipe['ingredients'], true);
            }
            $recipes_map[$recipe['recipe_id']] = $recipe;
        }
        $recipes_stmt->close();
    }
    
    // 组合计划和食谱数据
    foreach ($plan_data as $plan) {
        $recipe_ids = [];
        if ($plan['recipe_ids']) {
            $decoded = json_decode($plan['recipe_ids'], true);
            if (is_array($decoded)) {
                $recipe_ids = $decoded;
            }
        }
        
        // 为每个食谱ID创建一条记录
        if (empty($recipe_ids)) {
            // 如果没有食谱，仍然返回计划信息
            $plans[] = [
                'plan_id' => $plan['plan_id'],
                'meal_date' => $plan['meal_date'],
                'meal_slot' => $plan['meal_slot'],
                'recipe_id' => null,
                'recipe_name' => null,
                'recipe_category' => null,
                'nutrition' => null,
                'ingredients' => null
            ];
        } else {
            foreach ($recipe_ids as $recipe_id) {
                $recipe = $recipes_map[$recipe_id] ?? null;
                $plans[] = [
                    'plan_id' => $plan['plan_id'],
                    'meal_date' => $plan['meal_date'],
                    'meal_slot' => $plan['meal_slot'],
                    'recipe_id' => $recipe ? $recipe['recipe_id'] : $recipe_id,
                    'recipe_name' => $recipe ? $recipe['name'] : null,
                    'recipe_category' => $recipe ? $recipe['category'] : null,
                    'nutrition' => $recipe ? $recipe['nutrition'] : null,
                    'ingredients' => $recipe ? $recipe['ingredients'] : null
                ];
            }
        }
    }
    
    respond(true, $plans);
}

respond(false, 'Unknown action', 400);
?>

