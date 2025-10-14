<?php
include 'connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success"=>false, "error"=>"UNAUTHORIZED"]);
    exit;
}
$user_id = (int)$_SESSION['user_id'];

if (!isset($_POST['id'])) {
    echo json_encode(["success"=>false, "error"=>"MISSING_id"]);
    exit;
}
$food_id = (int)$_POST['id'];

// 将 fooditems 恢复为 active，并关闭未完成的 donation 记录
$upd = $conn->prepare("UPDATE fooditems SET food_status='active', donation_pickup_location=NULL, donation_availability=NULL, donated_at=NULL, updated_at=NOW() WHERE food_id=? AND user_id=?");
$upd->bind_param('ii', $food_id, $user_id);
if (!$upd->execute()) { echo json_encode(["success"=>false, "error"=>$upd->error]); exit; }

$don = $conn->prepare("UPDATE donations SET donation_status='withdrawn', withdrawn_at=NOW() WHERE food_item_id=? AND donation_status='open'");
$don->bind_param('i', $food_id);
$don->execute(); // 即使无匹配也不算错误

echo json_encode(["success"=>true]);
?>

