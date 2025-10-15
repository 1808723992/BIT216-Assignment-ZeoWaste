<?php
// ✅ Enable error reporting (good for debugging)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ✅ Connect to your database
require_once 'connect.php';

// ✅ Get the values from the form
$email = $_POST['email'];
$otp = $_POST['otp'];

// ✅ Prepare a query to find the user
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

// ✅ If email exists
if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    
    // ✅ Check if OTP matches and is still valid
    if ($user['otp_code'] == $otp && strtotime($user['otp_expiry']) > time()) {

        // ✅ Update user row: clear OTP and mark account as verified (optional: you can create a `is_verified` column)
        $update = $conn->prepare("UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE email = ?");
        $update->bind_param("s", $email);
        $update->execute();

        echo "<script>alert('✅ OTP verified! Account activated.'); window.location.href='sign_in.html';</script>";
    } else {
        echo "<script>alert('❌ Invalid or expired OTP. Please try again.'); window.history.back();</script>";
    }
} else {
    echo "<script>alert('❌ Email not found.'); window.history.back();</script>";
}

// ✅ Close everything
$stmt->close();
$conn->close();
?>
