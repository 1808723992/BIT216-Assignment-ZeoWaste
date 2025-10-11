<?php
include 'Connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

$user_id = 1; // 测试阶段固定用户ID

// ✅ 参数检查
if (!isset($_POST['food_id']) || !isset($_POST['action'])) {
    echo json_encode(["success" => false, "error" => "Missing parameters"]);
    exit;
}

$food_id = $conn->real_escape_string($_POST['food_id']);
$action = $_POST['action'];

if ($action === "add") {
    // ✅ 检查是否已存在收藏记录
    $check = $conn->query("SELECT * FROM bookmarked_foods WHERE user_id=$user_id AND food_id='$food_id'");
    if ($check && $check->num_rows > 0) {
        // 已存在则更新状态为 active
        $sql = "UPDATE bookmarked_foods SET status='active', bookmarked_at=NOW() WHERE user_id=$user_id AND food_id='$food_id'";
    } else {
        // 不存在则新增
        $sql = "INSERT INTO bookmarked_foods (user_id, food_id, status) VALUES ($user_id, '$food_id', 'active')";
    }
} elseif ($action === "remove") {
    // ✅ 取消收藏只改状态，不删记录
    $sql = "UPDATE bookmarked_foods SET status='removed' WHERE user_id=$user_id AND food_id='$food_id'";
} else {
    echo json_encode(["success" => false, "error" => "Invalid action"]);
    exit;
}

if ($conn->query($sql)) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode(["success" => false, "error" => $conn->error]);
}

$conn->close();
?>
