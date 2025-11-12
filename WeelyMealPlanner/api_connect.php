<?php
// API专用的数据库连接文件
// 不输出任何HTML，只设置$conn变量

$host = "127.0.0.1";
$username = "root";
$password = "";
$database = "zeowaste_db";

$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    // 不输出错误，让调用者处理
    $conn = null;
}
if ($conn) {
    $conn->set_charset("utf8mb4");
}
?>

