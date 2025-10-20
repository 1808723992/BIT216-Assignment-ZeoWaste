<?php
include '../connect.php';  // ✅ 返回上一级连接数据库
session_start();
error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $email = trim($_POST["email"]);
    $password = $_POST["password"];

    if (empty($email) || empty($password)) {
        echo "<script>alert('⚠️ Please enter both email and password.'); window.history.back();</script>";
        exit();
    }

    $stmt = $conn->prepare("SELECT user_id, full_name, email, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result && $result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // ✅ 验证密码
        if (password_verify($password, $user['password'])) {
            session_regenerate_id(true);

            $_SESSION["user_id"] = $user["user_id"];
            $_SESSION["full_name"] = $user["full_name"];
            $_SESSION["email"] = $user["email"];

            echo "<script>alert('✅ Login successful!'); window.location.href = '../logined_homepage.php';</script>";
        } else {
            echo "<script>alert('❌ Incorrect password.'); window.history.back();</script>";
        }
    } else {
        echo "<script>alert('❌ Email not found.'); window.history.back();</script>";
    }

    $stmt->close();
    $conn->close();
}
?>
