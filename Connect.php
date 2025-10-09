<?php
// connect.php —— 数据库连接文件

$servername = "localhost";
$username = "root";
$password = ""; // 如果有密码，填入你的数据库密码
$dbname = "zeowaste_db";

// 创建连接
$conn = new mysqli($servername, $username, $password, $dbname);

// 检查连接是否成功
if ($conn->connect_error) {
    die(json_encode(["error" => "❌ Database connection failed: " . $conn->connect_error]));
}

// ✅ 可选：设置字符编码（防止中文乱码）
$conn->set_charset("utf8mb4");
?>
