<?php
// 简单的 API 端点：获取当前登录用户的ID
header('Content-Type: application/json');

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in', 'user_id' => null]);
    exit;
}

echo json_encode(['user_id' => (int)$_SESSION['user_id']]);
?>

