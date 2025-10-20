<?php
$DB_HOST = "localhost";
$DB_USER = "root";
$DB_PASS = ""; 
$DB_NAME = "zeowaste_db";

// === 安全连接：启用异常处理 ===
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    // 尝试建立连接
    $conn = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

    // 设置字符集（防止中文乱码）
    $conn->set_charset("utf8mb4");

} catch (mysqli_sql_exception $e) {
    header('Content-Type: application/json');
    echo json_encode([
        "error" => "❌ Database connection failed",
        "details" => $e->getMessage()
    ]);
    exit; // 停止执行
}

?>
