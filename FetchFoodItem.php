<?php
header('Content-Type: application/json');

// 引入数据库连接
include 'connect.php';

// 查询数据
$sql = "SELECT * FROM food_items";
$result = $conn->query($sql);

$foods = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $foods[] = $row;
    }
}

$conn->close();
echo json_encode($foods);
?>

