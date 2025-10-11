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

$food_id = intval($_POST['food_id']);
$action = $_POST['action'];

// ✅ 添加收藏
if ($action === "add") {
    $check = $conn->query("SELECT * FROM bookmarked_foods WHERE user_id=$user_id AND food_id=$food_id");
    if ($check && $check->num_rows > 0) {
        // 已存在 → 恢复 active 状态
        $sql = "UPDATE bookmarked_foods 
                SET status='active', bookmarked_at=NOW() 
                WHERE user_id=$user_id AND food_id=$food_id";
    } else {
        // 新增收藏
        $sql = "INSERT INTO bookmarked_foods (user_id, food_id, status) 
                VALUES ($user_id, $food_id, 'active')";
    }
}
// ✅ 取消收藏
elseif ($action === "remove") {
    $sql = "UPDATE bookmarked_foods 
            SET status='removed' 
            WHERE user_id=$user_id AND food_id=$food_id";
} 
else {
    echo json_encode(["success" => false, "error" => "Invalid action"]);
    exit;
}

// ✅ 执行并返回结果
if ($conn->query($sql)) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode(["success" => false, "error" => $conn->error]);
}

$conn->close();
?>
