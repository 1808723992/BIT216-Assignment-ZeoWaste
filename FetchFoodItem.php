<?php
// ✅ 连接数据库
$servername = "localhost";
$username = "root";
$password = ""; // 如果有密码填上
$dbname = "zeowaste";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}

// ✅ 查询数据
$sql = "SELECT * FROM food_items";
$result = $conn->query($sql);

$foods = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $foods[] = $row;
    }
}

$conn->close();

// ✅ 返回 JSON
header('Content-Type: application/json');
echo json_encode($foods);
?>
