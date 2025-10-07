<?php
require_once 'load_env.php';
loadEnv(__DIR__ . '/.env');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'phpmailer/Exception.php';
require 'phpmailer/PHPMailer.php';
require 'phpmailer/SMTP.php';
include 'connect.php';

if (isset($_POST['email'])) {
    $email = $_POST['email'];

    // Generate random 6-digit OTP
    $otp = rand(100000, 999999);
    $expiry = date("Y-m-d H:i:s", strtotime("+5 minutes"));

    // Save OTP to database
    $stmt = $conn->prepare("UPDATE users SET otp_code=?, otp_expiry=? WHERE email=?");
    $stmt->bind_param("sss", $otp, $expiry, $email);
    $stmt->execute();

    // Create PHPMailer instance
        $mail = new PHPMailer(true);
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = 'html';

    try {
        // Server settings
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

        // Email content
        $mail->isHTML(true);
        $mail->Subject = 'ZeoWaste Account Verification';
        $mail->Body    = "<h3>Your OTP Code is <b>$otp</b></h3><p>This code will expire in 5 minutes.</p>";

        $mail->send();
        echo "<script>alert('OTP sent successfully! Please check your email.'); window.location.href='otp_verification.php?email=$email';</script>";
    } catch (Exception $e) {
        echo "<script>alert('Email could not be sent. Error: {$mail->ErrorInfo}'); window.history.back();</script>";
    }
}
?>
