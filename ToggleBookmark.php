<?php
include 'Connect.php';
header('Content-Type: application/json; charset=utf-8');

// ⚙️ 临时固定 user_id = 1 测试
$user_id = 1;

$food_id = $_POST['food_id'] ?? null;
$action  = $_POST['action'] ?? null;

if (!$food_id || !$action) {
  echo json_encode(["success" => false, "error" => "Missing parameters"]);
  exit;
}

if ($action === "add") {
  $sql = "INSERT INTO bookmarked_foods (user_id, food_id) VALUES (?, ?)";
} else {
  $sql = "DELETE FROM bookmarked_foods WHERE user_id = ? AND food_id = ?";
}

$stmt = $conn->prepare($sql);
$stmt->bind_param("ii", $user_id, $food_id);
$success = $stmt->execute();

echo json_encode(["success" => $success]);
$conn->close();
?>
