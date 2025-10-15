<?php
include 'connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "UNAUTHORIZED"]);
    exit;
}
$user_id = (int)$_SESSION['user_id'];

// ✅ 参数检查
if (!isset($_POST['food_id']) || !isset($_POST['action'])) {
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

$food_id = (int)$_POST['food_id'];
$action = $_POST['action'];

// ✅ 添加收藏
if ($action === "add") {
    // 是否已存在记录
    $checkSql = "SELECT 1 FROM bookmarked_foods WHERE user_id = ? AND food_id = ? LIMIT 1";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param('ii', $user_id, $food_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    if ($checkResult && $checkResult->num_rows > 0) {
        $sql = "UPDATE bookmarked_foods SET status='active', bookmarked_at=NOW() WHERE user_id = ? AND food_id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $user_id, $food_id);
    } else {
        $sql = "INSERT INTO bookmarked_foods (user_id, food_id, status, bookmarked_at) VALUES (?, ?, 'active', NOW())";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $user_id, $food_id);
    }
}
// ✅ 取消收藏
elseif ($action === "remove") {
    $sql = "UPDATE bookmarked_foods SET status='removed' WHERE user_id = ? AND food_id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $user_id, $food_id);
} else {
    echo json_encode(["success" => false, "error" => "Invalid action"]);
    exit;
}

if (isset($stmt) && $stmt->execute()) {
    echo json_encode(["success" => true]);
} else {
    $error = isset($stmt) ? $stmt->error : $conn->error;
    echo json_encode(["success" => false, "error" => $error]);
}

if (isset($stmt)) {
    $stmt->close();
}
$conn->close();
?>
