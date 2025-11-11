<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/../connect.php'; // $conn (mysqli)

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

// Helpers
function get_json_body() {
	$raw = file_get_contents('php://input');
	if (!$raw) return [];
	$decoded = json_decode($raw, true);
	return is_array($decoded) ? $decoded : [];
}

if ($action === 'create_recipe') {
	$body = ($method === 'POST') ? (get_json_body() ?: $_POST) : $_GET;
	$name = trim($body['name'] ?? '');
	$category = strtoupper(trim($body['category'] ?? 'LUNCH'));
	$user_id = isset($body['user_id']) ? (int)$body['user_id'] : null;
	$instructions = $body['instructions'] ?? null;
	$nutrition = $body['nutrition'] ?? null; // array 或 null
	$ingredients = $body['ingredients'] ?? null; // array of rows
	$food_ids = $body['food_ids'] ?? null; // array or null

	if ($name === '') {
		respond(false, 'name is required', 422);
	}

	// 允许的分类
	$allowed = ['BREAKFAST','LUNCH','DINNER','SNACKS'];
	if (!in_array($category, $allowed, true)) $category = 'LUNCH';

	// 转为 JSON
	$nutrition_json = $nutrition ? json_encode($nutrition, JSON_UNESCAPED_UNICODE) : null;
	$ingredients_json = $ingredients ? json_encode($ingredients, JSON_UNESCAPED_UNICODE) : json_encode([], JSON_UNESCAPED_UNICODE);
	$food_ids_json = $food_ids ? json_encode($food_ids, JSON_UNESCAPED_UNICODE) : null;

	$sql = "INSERT INTO recipes (user_id, name, category, instructions, nutrition, ingredients, food_ids) VALUES (?,?,?,?,?,?,?)";
	$stmt = $conn->prepare($sql);
	if (!$stmt) respond(false, 'Prepare failed: ' . $conn->error, 500);
	$stmt->bind_param(
		"issssss",
		$user_id,
		$name,
		$category,
		$instructions,
		$nutrition_json,
		$ingredients_json,
		$food_ids_json
	);
	if (!$stmt->execute()) respond(false, 'Execute failed: ' . $stmt->error, 500);
	$rid = $stmt->insert_id;
	$stmt->close();
	respond(true, [ 'recipe_id' => $rid ]);
}

if ($action === 'list_recipes') {
	$limit = isset($_GET['limit']) ? max(1, min(100, (int)$_GET['limit'])) : 20;
	$uid = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
	if ($uid) {
		$stmt = $conn->prepare("SELECT recipe_id, user_id, name, category, instructions, nutrition, ingredients, food_ids, created_at FROM recipes WHERE user_id = ? ORDER BY recipe_id DESC LIMIT ?");
		$stmt->bind_param('ii', $uid, $limit);
	} else {
		$stmt = $conn->prepare("SELECT recipe_id, user_id, name, category, instructions, nutrition, ingredients, food_ids, created_at FROM recipes ORDER BY recipe_id DESC LIMIT ?");
		$stmt->bind_param('i', $limit);
	}
	if (!$stmt->execute()) respond(false, 'Query failed: ' . $stmt->error, 500);
	$res = $stmt->get_result();
	$data = [];
	while ($row = $res->fetch_assoc()) {
		// 把 JSON 字段解码
		foreach (['nutrition','ingredients','food_ids'] as $f) {
			if ($row[$f] !== null && $row[$f] !== '') {
				$row[$f] = json_decode($row[$f], true);
			}
		}
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

respond(false, 'Unknown action', 400);
?>
