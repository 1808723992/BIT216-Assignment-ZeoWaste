<?php
// ✅ Load the environment (email info)
require_once 'load_env.php';
loadEnv(__DIR__ . '/.env');

// ✅ Enable error messages (good for beginners)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ✅ Include PHPMailer (to send email)
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require '../phpmailer/PHPMailer.php';
require '../phpmailer/SMTP.php';
require '../phpmailer/Exception.php';

// ✅ Connect to the database
include 'connect.php';

// ✅ When form is submitted (POST)
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $household_size = $_POST['household_size'] ?? null;

    // ✅ Check if passwords match
    if ($password !== $confirm_password) {
        echo "<script>alert('❌ Passwords do not match'); window.history.back();</script>";
        exit();
    }

    // ✅ Validate password strength
if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/', $password)) {
    echo "<script>alert('❌ Password must have at least 8 characters, one uppercase, one lowercase, and one symbol.'); window.history.back();</script>";
    exit();
}

    // ✅ Check if email is already registered
    $check = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows > 0) {
        echo "<script>alert('⚠️ Email already registered. Please sign in.'); window.history.back();</script>";
        exit();
    }

    // ✅ Hash the password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // ✅ Generate OTP
    $otp = rand(100000, 999999);
    $otp_expiry = date("Y-m-d H:i:s", strtotime("+5 minutes"));
    $created_at = date("Y-m-d H:i:s");

    // ✅ Insert user into database
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password, household_size, created_at, otp_code, otp_expiry)
                            VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssisss", $full_name, $email, $hashed_password, $household_size, $created_at, $otp, $otp_expiry);

    if ($stmt->execute()) {
        // ✅ Send OTP via email
        $mail = new PHPMailer(true);

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

            // Optional (ignore certificate warnings)
            $mail->SMTPOptions = array(
                'ssl' => array(
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                )
            );

            $mail->setFrom(getenv('MAIL_FROM'), getenv('MAIL_NAME'));
            $mail->addAddress($email);

            $mail->isHTML(true);
            $mail->Subject = 'ZeoWaste - Your OTP Code';
            $mail->Body    = "
                <h2>Hello $full_name!</h2>
                <p>Here is your 6-digit OTP code:</p>
                <h1>$otp</h1>
                <p>This OTP will expire in 5 minutes. Please enter it on the next page to activate your account.</p>
            ";

            $mail->send();

            // ✅ Redirect to OTP page with email
            echo "<script>alert('✅ Account stored! OTP sent to your email.'); 
                  window.location.href='../otp_verification.html?email=$email';</script>";
        } catch (Exception $e) {
            echo "<script>alert('❌ Account stored, but OTP email failed to send.'); 
                  window.location.href='../otp_verification.html?email=$email';</script>";
        }
    } else {
        echo "<script>alert('❌ Failed to create account. Try again.'); window.history.back();</script>";
    }

    $stmt->close();
    $conn->close();
}
?>
