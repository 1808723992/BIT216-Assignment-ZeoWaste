<?php
require_once 'load_env.php';
loadEnv(__DIR__ . '/.env');
error_reporting(E_ALL);
ini_set('display_errors', 1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

include 'connect.php';
require 'phpmailer/Exception.php';
require 'phpmailer/PHPMailer.php';
require 'phpmailer/SMTP.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $household_size = isset($_POST['household_size']) ? $_POST['household_size'] : NULL;

    // 🧱 Check password match
    if ($password !== $confirm_password) {
        echo "<script>alert('Passwords do not match!'); window.history.back();</script>";
        exit();
    }

    // 🧱 Check duplicate email
    $check = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows > 0) {
        echo "<script>alert('Email already registered. Please login.'); window.history.back();</script>";
        exit();
    }

    // 🧱 Hash password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // 🧱 Generate OTP
    $otp = rand(100000, 999999);
    $otp_expiry = date("Y-m-d H:i:s", strtotime("+5 minutes"));

    // 🧱 Insert new user with OTP
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password, household_size, otp_code, otp_expiry)
                            VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssiss", $full_name, $email, $hashed_password, $household_size, $otp, $otp_expiry);

    if ($stmt->execute()) {
        // ✅ Send OTP email using PHPMailer
        $mail = new PHPMailer(true);
        $mail->SMTPDebug = 2; // or 3 for more detail
        $mail->Debugoutput = 'html';

        try {
            $mail->isSMTP();
            $mail->Host       = getenv('MAIL_HOST');
            $mail->SMTPAuth   = true;
            $mail->Username   = getenv('MAIL_USERNAME');
            $mail->Password   = getenv('MAIL_PASSWORD');
            $mail->SMTPSecure = getenv('MAIL_ENCRYPTION') === 'ssl'
                    ? PHPMailer::ENCRYPTION_SMTPS
                    : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = getenv('MAIL_PORT');

            $mail->setFrom(getenv('MAIL_FROM'), getenv('MAIL_NAME'));

            $mail->addAddress($email);

            $mail->isHTML(true);
            $mail->Subject = 'ZeoWaste Email Verification';
            $mail->Body    = "
                <h3>Welcome to ZeoWaste, $full_name!</h3>
                <p>Your 6-digit OTP code is:</p>
                <h2>$otp</h2>
                <p>This code will expire in 5 minutes.</p>";

            $mail->send();

            echo "<script>alert('Account created! Please check your email for the OTP.'); 
                  window.location.href='otp_verification.php?email=$email';</script>";
        } catch (Exception $e) {
            echo "<script>alert('Account created but OTP email failed: {$mail->ErrorInfo}'); 
                  window.location.href='otp_verification.php?email=$email';</script>";
        }
    } else {
        echo "<script>alert('Error creating account. Please try again.'); window.history.back();</script>";
    }

    $stmt->close();
    $conn->close();
}
?>
