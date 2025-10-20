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

// Expect: POST id, used
if (!isset($_POST['id'])) {
    echo json_encode(["success"=>false, "error"=>"MISSING_id"]);
    exit;
}
$food_id = (int)$_POST['id'];
$used = isset($_POST['used']) ? (int)$_POST['used'] : 1;
if ($used <= 0) $used = 1;

// Lock row and get quantity
$stmt = $conn->prepare("SELECT food_quantity FROM fooditems WHERE food_id=? AND user_id=? LIMIT 1");
$stmt->bind_param('ii', $food_id, $user_id);
$stmt->execute();
$res = $stmt->get_result();
if (!$res || $res->num_rows === 0) {
    echo json_encode(["success"=>false, "error"=>"NOT_FOUND"]);
    exit;
}
$row = $res->fetch_assoc();
$origQty = (string)$row['food_quantity'];
// 提取数字部分与单位后缀，数字用于计算，单位原样保留
if (preg_match('/^\s*([0-9]+(?:\.[0-9]+)?)\s*(.*)$/u', $origQty, $m)) {
    $origNum = (float)$m[1];
    $unitSuffix = trim($m[2]);
} else {
    // 回退：无法解析则仅按整数计算，无单位
    $origNum = (float)$origQty;
    $unitSuffix = '';
}
$leftNum = $origNum - $used;

if ($leftNum <= 0) {
    $del = $conn->prepare("DELETE FROM fooditems WHERE food_id=? AND user_id=?");
    $del->bind_param('ii', $food_id, $user_id);
    $ok = $del->execute();
    if (!$ok) { echo json_encode(["success"=>false, "error"=>$del->error]); exit; }
    echo json_encode(["success"=>true, "left"=>0]);
    exit;
}

$upd = $conn->prepare("UPDATE fooditems SET food_quantity=?, updated_at=NOW() WHERE food_id=? AND user_id=?");
// 组装为 “数字 + 空格 + 原单位”
$qtyStr = (floor($leftNum) == $leftNum)
    ? (string)intval($leftNum)
    : rtrim(rtrim(number_format($leftNum, 4, '.', ''), '0'), '.');
if ($unitSuffix !== '') { $qtyStr .= ' ' . $unitSuffix; }
$upd->bind_param('sii', $qtyStr, $food_id, $user_id);
if ($upd->execute()) echo json_encode(["success"=>true, "left"=>$leftNum]);
else echo json_encode(["success"=>false, "error"=>$upd->error]);
?>

