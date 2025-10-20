<?php
// ===========================================================
// ZeoWaste Reset Password Backend (PHP + MySQL + PHPMailer)
// ===========================================================

// ✅ Load environment variables
require_once 'load_env.php';
loadEnv(__DIR__ . '/.env');

// ✅ Database connection
include 'connect.php';

// ✅ Error reporting for debugging (you can disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ✅ PHPMailer setup
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require '../phpmailer/Exception.php';
require '../phpmailer/PHPMailer.php';
require '../phpmailer/SMTP.php';

// ✅ Set response type to JSON
header('Content-Type: application/json');

// ✅ Check for "step" sent from frontend
if (!isset($_POST['step'])) {
    echo json_encode(['success' => false, 'message' => 'Missing step parameter']);
    exit;
}

$step = $_POST['step'];

// ===========================================================
// STEP 1: Send OTP to email
// ===========================================================
if ($step === 'send_otp') {
    $email = trim($_POST['email']);

    // Check if email exists in DB
    $check = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Email not found']);
        exit;
    }

    // Generate 6-digit OTP and expiry (5 minutes)
    $otp = rand(100000, 999999);
    $expiry = date("Y-m-d H:i:s", time() + 300); // 300 sec = 5 min

    // Save OTP and expiry to database
    $update = $conn->prepare("UPDATE users SET otp_code=?, otp_expiry=? WHERE email=?");
    $update->bind_param("sss", $otp, $expiry, $email);
    $update->execute();

    // ===== Send OTP email =====
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = getenv('MAIL_HOST');
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('MAIL_USERNAME');
        $mail->Password   = getenv('MAIL_PASSWORD');

        // Use MAIL_ENCRYPTION from .env if present, otherwise default to tls
        $encryption = getenv('MAIL_ENCRYPTION') ?: 'tls';
        $mail->SMTPSecure = $encryption;
        $mail->Port       = getenv('MAIL_PORT');

        // Localhost SSL fix (temporary, safe for dev only)
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true
            ]
        ];

        $mail->setFrom(getenv('MAIL_FROM'), getenv('MAIL_NAME') ?: getenv('MAIL_FROM'));
        $mail->addAddress($email);
        $mail->isHTML(true);

        $mail->Subject = "ZeoWaste Password Reset OTP";
        $mail->Body    = "
            <h2>ZeoWaste Password Reset Request</h2>
            <p>Dear user,</p>
            <p>Your One-Time Password (OTP) is:</p>
            <h3>$otp</h3>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn’t request a password reset, please ignore this email.</p>
            <br><p>— ZeoWaste Team</p>
        ";

        $mail->send();
        echo json_encode(['success' => true, 'message' => 'OTP sent successfully']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Failed to send email: ' . $mail->ErrorInfo]);
    }
}

// ===========================================================
// STEP 2: Verify OTP
// ===========================================================
elseif ($step === 'verify_otp') {
    $email = trim($_POST['email']);
    $otp   = trim($_POST['otp']);

    $check = $conn->prepare("SELECT otp_code, otp_expiry FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Email not found']);
        exit;
    }

    $user = $result->fetch_assoc();
    if ($user['otp_code'] != $otp) {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP']);
        exit;
    }

    if (strtotime($user['otp_expiry']) < time()) {
        echo json_encode(['success' => false, 'message' => 'OTP expired']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'OTP verified successfully']);
}

// ===========================================================
// STEP 3: Update Password
// ===========================================================
elseif ($step === 'update_password') {
    $email       = trim($_POST['email']);
    $newPassword = $_POST['new_password'];

    // Hash the new password
    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);

    // Update database
    $update = $conn->prepare("UPDATE users SET password=?, otp_code=NULL, otp_expiry=NULL WHERE email=?");
    $update->bind_param("ss", $hashed, $email);

    if ($update->execute()) {
        echo json_encode(['success' => true, 'message' => 'Password updated successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to update password']);
    }
}

// ===========================================================
// Invalid Step
// ===========================================================
else {
    echo json_encode(['success' => false, 'message' => 'Invalid step']);
}
?>
