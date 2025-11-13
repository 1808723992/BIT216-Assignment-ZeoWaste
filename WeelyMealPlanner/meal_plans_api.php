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

function parse_quantity_number($value) {
    if ($value === null) return 0;
    if (is_numeric($value)) return (float)$value;
    if (preg_match('/^\s*([0-9]+(?:\.[0-9]+)?)\s*/u', (string)$value, $m)) {
        return (float)$m[1];
    }
    $filtered = preg_replace('/[^\d\.]/', '', (string)$value);
    return $filtered === '' ? 0 : (float)$filtered;
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
    
    // 获取库存映射
    $inventory_map = [];
    $inv_stmt = $conn->prepare("SELECT food_name, food_quantity FROM fooditems WHERE user_id = ? AND food_status = 'active'");
    $inv_stmt->bind_param('i', $user_id);
    if ($inv_stmt->execute()) {
        $inv_res = $inv_stmt->get_result();
        while ($inv_row = $inv_res->fetch_assoc()) {
            $key = strtolower(trim($inv_row['food_name']));
            if ($key === '') continue;
            if (!isset($inventory_map[$key])) {
                $inventory_map[$key] = [
                    'name' => $inv_row['food_name'],
                    'total_qty' => 0
                ];
            }
            $inventory_map[$key]['total_qty'] += parse_quantity_number($inv_row['food_quantity']);
        }
    }
    $inv_stmt->close();
    
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
                $plan_entry = [
                    'plan_id' => $plan['plan_id'],
                    'meal_date' => $plan['meal_date'],
                    'meal_slot' => $plan['meal_slot'],
                    'recipe_id' => $recipe ? $recipe['recipe_id'] : $recipe_id,
                    'recipe_name' => $recipe ? $recipe['name'] : null,
                    'recipe_category' => $recipe ? $recipe['category'] : null,
                    'nutrition' => $recipe ? $recipe['nutrition'] : null,
                    'ingredients' => $recipe ? $recipe['ingredients'] : null
                ];
                
                if ($recipe && isset($recipe['ingredients']) && is_array($recipe['ingredients'])) {
                    $ingredients_with_stock = [];
                    $missing_count = 0;
                    foreach ($recipe['ingredients'] as $ingredient) {
                        $name = isset($ingredient['name']) ? $ingredient['name'] : '';
                        $required = isset($ingredient['amount']) ? $ingredient['amount'] : '';
                        $name_key = strtolower(trim($name));
                        
                        $found = false;
                        $available_qty = null;
                        $available_name = null;
                        
                        if ($name_key !== '' && isset($inventory_map[$name_key])) {
                            $found = true;
                            $available_qty = $inventory_map[$name_key]['total_qty'];
                            $available_name = $inventory_map[$name_key]['name'];
                        } else {
                            foreach ($inventory_map as $inv_key => $inv_data) {
                                if ($name_key !== '' && (strpos($inv_key, $name_key) !== false || strpos($name_key, $inv_key) !== false)) {
                                    $found = true;
                                    $available_qty = $inv_data['total_qty'];
                                    $available_name = $inv_data['name'];
                                    break;
                                }
                            }
                        }
                        
                        $status = $found ? 'ok' : 'miss';
                        if (!$found) $missing_count++;
                        
                        $ingredients_with_stock[] = [
                            'name' => $name,
                            'required' => $required,
                            'available' => $available_qty,
                            'available_name' => $available_name,
                            'status' => $status
                        ];
                    }
                    $plan_entry['ingredients_with_stock'] = $ingredients_with_stock;
                    $plan_entry['missing_count'] = $missing_count;
                }
                
                $plans[] = $plan_entry;
            }
        }
    }
    
    respond(true, $plans);
}

// ===== 根据已确认的计划减少库存 =====
if ($action === 'deduct_inventory_from_plans') {
    $body = get_json_body();
    error_log("[deduct_inventory] Received body: " . json_encode($body));
    
    $week_start = trim($body['week_start'] ?? '');
    error_log("[deduct_inventory] Week start (raw): '$week_start'");
    
    if (!$week_start) {
        // 如果没有提供week_start，默认使用本周一
        $week_start = date('Y-m-d', strtotime('monday this week'));
        error_log("[deduct_inventory] Using default week_start: '$week_start'");
    }
    
    // 验证日期格式
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $week_start)) {
        error_log("[deduct_inventory] Invalid date format: '$week_start'");
        respond(false, 'Invalid date format. Use YYYY-MM-DD. Received: ' . $week_start, 422);
    }
    
    // 计算周日（一周的最后一天）
    $week_end = date('Y-m-d', strtotime($week_start . ' +6 days'));
    
    // 如果提供了 recipe_ids，只处理这些食谱；否则处理当前周的所有计划
    $filter_recipe_ids = $body['recipe_ids'] ?? null;
    if ($filter_recipe_ids && is_array($filter_recipe_ids)) {
        $filter_recipe_ids = array_map('intval', $filter_recipe_ids);
    } else {
        $filter_recipe_ids = null;
    }
    
    $conn->begin_transaction();
    
    try {
        $ingredient_requirements = []; // 食材名称 => 需要减少的总量
        
        error_log("[deduct_inventory] User: $user_id, Week: $week_start, Recipe IDs: " . json_encode($filter_recipe_ids));
        
        if ($filter_recipe_ids && !empty($filter_recipe_ids)) {
            // 只处理指定的食谱ID（使用参数化查询避免SQL注入）
            $placeholders = implode(',', array_fill(0, count($filter_recipe_ids), '?'));
            $recipe_stmt = $conn->prepare("SELECT recipe_id, ingredients FROM recipes WHERE recipe_id IN ($placeholders)");
            $recipe_stmt->bind_param(str_repeat('i', count($filter_recipe_ids)), ...$filter_recipe_ids);
            $recipe_stmt->execute();
            $recipe_result = $recipe_stmt->get_result();
            
            while ($recipe_row = $recipe_result->fetch_assoc()) {
                $recipe_id = $recipe_row['recipe_id'];
                $ingredients = json_decode($recipe_row['ingredients'], true);
                if (is_array($ingredients)) {
                    foreach ($ingredients as $ing) {
                        $name = strtolower(trim($ing['name'] ?? $ing['ingredient_name'] ?? ''));
                        if (!$name) continue;
                        
                        $amount = trim($ing['amount'] ?? $ing['quantity'] ?? '0');
                        $required_qty = parse_quantity_number($amount);
                        
                        if ($required_qty > 0) {
                            if (!isset($ingredient_requirements[$name])) {
                                $ingredient_requirements[$name] = [
                                    'name' => $ing['name'] ?? $ing['ingredient_name'] ?? $name,
                                    'total_qty' => 0,
                                    'unit' => preg_replace('/^\s*[0-9]+(?:\.[0-9]+)?\s*/u', '', $amount)
                                ];
                            }
                            $ingredient_requirements[$name]['total_qty'] += $required_qty;
                            error_log("[deduct_inventory] Recipe $recipe_id: Ingredient '$name' requires $required_qty");
                        }
                    }
                }
            }
            $recipe_stmt->close();
            error_log("[deduct_inventory] Total ingredients required: " . count($ingredient_requirements));
        } else {
            // 处理当前周的所有计划
            $plans_stmt = $conn->prepare("SELECT plan_id, meal_date, meal_slot, recipe_ids
                                          FROM meal_plans
                                          WHERE user_id = ? AND meal_date BETWEEN ? AND ?
                                          ORDER BY meal_date ASC");
            $plans_stmt->bind_param('iss', $user_id, $week_start, $week_end);
            $plans_stmt->execute();
            $plans_result = $plans_stmt->get_result();
            
            // 遍历每个计划，收集所有需要的食材
            while ($plan_row = $plans_result->fetch_assoc()) {
                $recipe_ids = json_decode($plan_row['recipe_ids'], true);
                if (!is_array($recipe_ids) || empty($recipe_ids)) {
                    continue;
                }
                
                // 获取每个食谱的食材
                foreach ($recipe_ids as $recipe_id) {
                    $recipe_stmt = $conn->prepare("SELECT ingredients FROM recipes WHERE recipe_id = ?");
                    $recipe_stmt->bind_param('i', $recipe_id);
                    $recipe_stmt->execute();
                    $recipe_result = $recipe_stmt->get_result();
                    
                    if ($recipe_row = $recipe_result->fetch_assoc()) {
                        $ingredients = json_decode($recipe_row['ingredients'], true);
                        if (is_array($ingredients)) {
                            foreach ($ingredients as $ing) {
                                $name = strtolower(trim($ing['name'] ?? $ing['ingredient_name'] ?? ''));
                                if (!$name) continue;
                                
                                $amount = trim($ing['amount'] ?? $ing['quantity'] ?? '0');
                                $required_qty = parse_quantity_number($amount);
                                
                                if ($required_qty > 0) {
                                    if (!isset($ingredient_requirements[$name])) {
                                        $ingredient_requirements[$name] = [
                                            'name' => $ing['name'] ?? $ing['ingredient_name'] ?? $name,
                                            'total_qty' => 0,
                                            'unit' => preg_replace('/^\s*[0-9]+(?:\.[0-9]+)?\s*/u', '', $amount)
                                        ];
                                    }
                                    $ingredient_requirements[$name]['total_qty'] += $required_qty;
                                }
                            }
                        }
                    }
                    $recipe_stmt->close();
                }
            }
            $plans_stmt->close();
        }
        
        // 3. 获取用户的所有活跃库存
        $inventory_stmt = $conn->prepare("SELECT food_id, food_name, food_quantity 
                                         FROM fooditems 
                                         WHERE user_id = ? AND food_status = 'active'
                                         ORDER BY food_id ASC");
        $inventory_stmt->bind_param('i', $user_id);
        $inventory_stmt->execute();
        $inventory_result = $inventory_stmt->get_result();
        
        $inventory_map = [];
        while ($inv_row = $inventory_result->fetch_assoc()) {
            $key = strtolower(trim($inv_row['food_name']));
            if (!isset($inventory_map[$key])) {
                $inventory_map[$key] = [];
            }
            $inventory_map[$key][] = [
                'food_id' => $inv_row['food_id'],
                'food_name' => $inv_row['food_name'],
                'food_quantity' => $inv_row['food_quantity']
            ];
        }
        $inventory_stmt->close();
        error_log("[deduct_inventory] Total inventory items: " . count($inventory_map));
        
        // 4. 匹配并减少库存
        $deducted_items = [];
        $errors = [];
        
        foreach ($ingredient_requirements as $req_key => $req_data) {
            error_log("[deduct_inventory] Processing requirement: $req_key, needed: {$req_data['total_qty']}");
            $required_qty = $req_data['total_qty'];
            $unit = $req_data['unit'];
            
            // 查找匹配的库存项
            $matched_items = null;
            if (isset($inventory_map[$req_key])) {
                $matched_items = $inventory_map[$req_key];
            } else {
                // 尝试模糊匹配（包含关系）
                foreach ($inventory_map as $inv_key => $items) {
                    if (strpos($inv_key, $req_key) !== false || strpos($req_key, $inv_key) !== false) {
                        $matched_items = $items;
                        break;
                    }
                }
            }
            
            if (!$matched_items || empty($matched_items)) {
                // 没有找到匹配的库存，记录但不报错
                error_log("[deduct_inventory] No match found for ingredient: $req_key");
                continue;
            }
            
            error_log("[deduct_inventory] Found " . count($matched_items) . " matching items for: $req_key");
            
            // 按FIFO原则，从最早的项目开始减少
            $remaining_qty = $required_qty;
            foreach ($matched_items as $item) {
                if ($remaining_qty <= 0) break;
                
                $current_qty_str = $item['food_quantity'];
                $current_qty_num = parse_quantity_number($current_qty_str);
                
                if ($current_qty_num <= 0) continue;
                
                // 提取单位
                if (preg_match('/^\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$/u', $current_qty_str, $m)) {
                    $unit_suffix = trim($m[2]);
                } else {
                    $unit_suffix = '';
                }
                
                // 计算需要从这个项目减少的数量
                $deduct_from_item = min($remaining_qty, $current_qty_num);
                $new_qty_num = $current_qty_num - $deduct_from_item;
                $remaining_qty -= $deduct_from_item;
                
                // 更新或删除库存项
                if ($new_qty_num <= 0) {
                    // 删除库存项
                    $delete_stmt = $conn->prepare("DELETE FROM fooditems WHERE food_id = ? AND user_id = ?");
                    $delete_stmt->bind_param('ii', $item['food_id'], $user_id);
                    if (!$delete_stmt->execute()) {
                        $errors[] = "Failed to delete food item {$item['food_id']}: " . $delete_stmt->error;
                    }
                    $delete_stmt->close();
                    
                    $deducted_items[] = [
                        'food_id' => $item['food_id'],
                        'food_name' => $item['food_name'],
                        'deducted' => $current_qty_num,
                        'remaining' => 0,
                        'action' => 'deleted'
                    ];
                } else {
                    // 更新库存数量
                    $new_qty_str = (floor($new_qty_num) == $new_qty_num)
                        ? (string)intval($new_qty_num)
                        : rtrim(rtrim(number_format($new_qty_num, 4, '.', ''), '0'), '.');
                    if ($unit_suffix !== '') {
                        $new_qty_str .= ' ' . $unit_suffix;
                    }
                    
                    $update_stmt = $conn->prepare("UPDATE fooditems SET food_quantity = ?, updated_at = NOW() WHERE food_id = ? AND user_id = ?");
                    $update_stmt->bind_param('sii', $new_qty_str, $item['food_id'], $user_id);
                    if (!$update_stmt->execute()) {
                        $errors[] = "Failed to update food item {$item['food_id']}: " . $update_stmt->error;
                    }
                    $update_stmt->close();
                    
                    $deducted_items[] = [
                        'food_id' => $item['food_id'],
                        'food_name' => $item['food_name'],
                        'deducted' => $deduct_from_item,
                        'remaining' => $new_qty_num,
                        'action' => 'updated'
                    ];
                    error_log("[deduct_inventory] Updated item {$item['food_id']}: {$item['food_name']}, deducted: $deduct_from_item, remaining: $new_qty_num");
                }
            }
        }
        
        error_log("[deduct_inventory] Total items deducted: " . count($deducted_items));
        $conn->commit();
        respond(true, [
            'deducted_items' => $deducted_items,
            'errors' => $errors,
            'total_items' => count($deducted_items)
        ]);
        
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, $e->getMessage(), 500);
    }
}

respond(false, 'Unknown action', 400);
?>

