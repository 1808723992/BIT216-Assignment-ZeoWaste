<?php
require_once 'load_env.php';
loadEnv(__DIR__ . '/.env');
include 'connect.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $email = $_POST["email"];
    $password = $_POST["password"];

    // ✅ Fetch user by email
    $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    // ✅ Check if user exists
    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // ✅ Check password
        if (password_verify($password, $user['password'])) {
            // ✅ Store session
            $_SESSION["user_id"] = $user["id"];
            $_SESSION["full_name"] = $user["full_name"];
            $_SESSION["email"] = $user["email"];

            echo "<script>alert('✅ Login successful!'); window.location.href = 'logined_homepage.html';</script>";
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
