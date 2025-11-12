<?php
// 必须在任何输出之前启动session
session_start();

// 设置响应头
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

// 检查登录状态（某些操作需要登录）
$require_auth = false; // 将在需要时设置为true
$user_id = null;
if (isset($_SESSION['user_id'])) {
    $user_id = (int)$_SESSION['user_id'];
}

require_once __DIR__ . '/api_connect.php'; // $conn (mysqli)

// 检查数据库连接
if (!$conn || $conn->connect_error) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Database connection failed']);
    exit;
}

function respond($ok, $data = null, $http = 200) {
	http_response_code($http);
	echo json_encode([ 'ok' => $ok, 'data' => $data ], JSON_UNESCAPED_UNICODE);
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

if ($action === 'create_recipe') {
	// 创建食谱需要登录
	if (!$user_id) {
		http_response_code(401);
		respond(false, 'UNAUTHORIZED: Please login first', 401);
	}
	
	$body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
	$name = trim($body['name'] ?? '');
	$category = strtoupper(trim($body['category'] ?? 'LUNCH'));
	// 使用当前登录用户的ID，忽略请求中的user_id（安全考虑）
	$instructions = $body['instructions'] ?? null;
	$nutrition = $body['nutrition'] ?? null;
	$ingredients = $body['ingredients'] ?? null;
	$food_ids = $body['food_ids'] ?? null;
	if ($name === '') { respond(false, 'name is required', 422); }
	$allowed = ['BREAKFAST','LUNCH','DINNER','SNACKS'];
	if (!in_array($category, $allowed, true)) $category = 'LUNCH';
	$nutrition_json = $nutrition ? json_encode($nutrition, JSON_UNESCAPED_UNICODE) : null;
	$ingredients_json = $ingredients ? json_encode($ingredients, JSON_UNESCAPED_UNICODE) : json_encode([], JSON_UNESCAPED_UNICODE);
	$food_ids_json = $food_ids ? json_encode($food_ids, JSON_UNESCAPED_UNICODE) : null;
	$sql = "INSERT INTO recipes (user_id, name, category, instructions, nutrition, ingredients, food_ids) VALUES (?,?,?,?,?,?,?)";
	$stmt = $conn->prepare($sql);
	if (!$stmt) respond(false, 'Prepare failed: ' . $conn->error, 500);
	$stmt->bind_param("issssss", $user_id, $name, $category, $instructions, $nutrition_json, $ingredients_json, $food_ids_json);
	if (!$stmt->execute()) respond(false, 'Execute failed: ' . $stmt->error, 500);
	$rid = $stmt->insert_id; $stmt->close();
	respond(true, [ 'recipe_id' => $rid ]);
}

if ($action === 'list_recipes') {
	$limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
	// 如果用户已登录，默认只显示该用户的食谱；如果未登录，显示所有食谱
	$uid = isset($_GET['user_id']) ? (int)$_GET['user_id'] : $user_id;
	if ($uid) {
		$stmt = $conn->prepare("SELECT recipe_id, user_id, name, category, instructions, nutrition, ingredients, food_ids, created_at FROM recipes WHERE user_id = ? ORDER BY recipe_id DESC LIMIT ?");
		$stmt->bind_param('ii', $uid, $limit);
	} else {
		// 未登录用户可以看到所有食谱（公共食谱）
		$stmt = $conn->prepare("SELECT recipe_id, user_id, name, category, instructions, nutrition, ingredients, food_ids, created_at FROM recipes ORDER BY recipe_id DESC LIMIT ?");
		$stmt->bind_param('i', $limit);
	}
	if (!$stmt->execute()) respond(false, 'Query failed: ' . $stmt->error, 500);
	$res = $stmt->get_result();
	$data = [];
	while ($row = $res->fetch_assoc()) {
		foreach (['nutrition','ingredients','food_ids'] as $f) { if ($row[$f] !== null && $row[$f] !== '') { $row[$f] = json_decode($row[$f], true); } }
		$data[] = $row;
	}
	$stmt->close();
	respond(true, $data);
}

if ($action === 'attach_fooditem') {
	$body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
	$recipe_id = (int)($body['recipe_id'] ?? 0);
	$food_id = (int)($body['food_id'] ?? 0);
	if (!$recipe_id || !$food_id) respond(false, 'recipe_id / food_id required', 422);
	$stmt = $conn->prepare("UPDATE fooditems SET recipe_id = ? WHERE food_id = ?");
	$stmt->bind_param('ii', $recipe_id, $food_id);
	if (!$stmt->execute()) respond(false, 'Update failed: ' . $stmt->error, 500);
	respond(true, [ 'updated' => $stmt->affected_rows ]);
}

if ($action === 'detach_fooditem') {
	$body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
	$food_id = (int)($body['food_id'] ?? 0);
	if (!$food_id) respond(false, 'food_id required', 422);
	$stmt = $conn->prepare("UPDATE fooditems SET recipe_id = NULL WHERE food_id = ?");
	$stmt->bind_param('i', $food_id);
	if (!$stmt->execute()) respond(false, 'Update failed: ' . $stmt->error, 500);
	respond(true, [ 'updated' => $stmt->affected_rows ]);
}

if ($action === 'update_recipe') {
	// 更新食谱需要登录
	if (!$user_id) {
		http_response_code(401);
		respond(false, 'UNAUTHORIZED: Please login first', 401);
	}
	
	$body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
	$recipe_id = (int)($body['recipe_id'] ?? 0);
	if (!$recipe_id) respond(false, 'recipe_id required', 422);
	
	// 检查食谱是否属于当前用户
	$check = $conn->prepare("SELECT user_id FROM recipes WHERE recipe_id = ?");
	$check->bind_param('i', $recipe_id);
	$check->execute();
	$check_result = $check->get_result();
	if ($check_result->num_rows === 0) {
		$check->close();
		respond(false, 'Recipe not found', 404);
	}
	$recipe_data = $check_result->fetch_assoc();
	$check->close();
	
	// 只允许用户修改自己的食谱（user_id不为NULL的食谱）
	if ($recipe_data['user_id'] !== null && $recipe_data['user_id'] != $user_id) {
		respond(false, 'FORBIDDEN: You can only update your own recipes', 403);
	}
	$name = isset($body['name']) ? trim($body['name']) : null;
	$category = isset($body['category']) ? strtoupper(trim($body['category'])) : null;
	$instructions = $body['instructions'] ?? null;
	$nutrition = array_key_exists('nutrition', $body) ? json_encode($body['nutrition'], JSON_UNESCAPED_UNICODE) : null;
	$ingredients = array_key_exists('ingredients', $body) ? json_encode($body['ingredients'], JSON_UNESCAPED_UNICODE) : null;
	$food_ids = array_key_exists('food_ids', $body) ? json_encode($body['food_ids'], JSON_UNESCAPED_UNICODE) : null;

	$sets = [];$params = [];$types = '';
	if ($name !== null) { $sets[] = 'name=?'; $params[] = $name; $types.='s'; }
	if ($category !== null) { $sets[] = 'category=?'; $params[] = $category; $types.='s'; }
	if ($instructions !== null) { $sets[] = 'instructions=?'; $params[] = $instructions; $types.='s'; }
	if ($nutrition !== null) { $sets[] = 'nutrition=?'; $params[] = $nutrition; $types.='s'; }
	if ($ingredients !== null) { $sets[] = 'ingredients=?'; $params[] = $ingredients; $types.='s'; }
	if ($food_ids !== null) { $sets[] = 'food_ids=?'; $params[] = $food_ids; $types.='s'; }
	if (!$sets) respond(false, 'No fields to update', 422);
	$params[] = $recipe_id; $types.='i';
	$sql = 'UPDATE recipes SET '.implode(',', $sets).' WHERE recipe_id=?';
	$stmt = $conn->prepare($sql);
	if (!$stmt) respond(false, 'Prepare failed: '.$conn->error, 500);
	$stmt->bind_param($types, ...$params);
	if (!$stmt->execute()) respond(false, 'Execute failed: '.$stmt->error, 500);
	respond(true, [ 'updated' => $stmt->affected_rows ]);
}

if ($action === 'delete_recipe') {
	// 删除食谱需要登录
	if (!$user_id) {
		http_response_code(401);
		respond(false, 'UNAUTHORIZED: Please login first', 401);
	}
	
	$rid = (int)($_GET['recipe_id'] ?? $_POST['recipe_id'] ?? 0);
	if (!$rid) respond(false, 'recipe_id required', 422);
	
	// 检查食谱是否属于当前用户
	$check = $conn->prepare("SELECT user_id FROM recipes WHERE recipe_id = ?");
	$check->bind_param('i', $rid);
	$check->execute();
	$check_result = $check->get_result();
	if ($check_result->num_rows === 0) {
		$check->close();
		respond(false, 'Recipe not found', 404);
	}
	$recipe_data = $check_result->fetch_assoc();
	$check->close();
	
	// 只允许用户删除自己的食谱（user_id不为NULL的食谱）
	if ($recipe_data['user_id'] !== null && $recipe_data['user_id'] != $user_id) {
		respond(false, 'FORBIDDEN: You can only delete your own recipes', 403);
	}
	
	$stmt = $conn->prepare('DELETE FROM recipes WHERE recipe_id=?');
	$stmt->bind_param('i', $rid);
	if (!$stmt->execute()) respond(false, 'Delete failed: '.$stmt->error, 500);
	// fooditems.recipe_id 将因 FK ON DELETE SET NULL 自动置空
	respond(true, [ 'deleted' => $stmt->affected_rows ]);
}

respond(false, 'Unknown action', 400);
?>
