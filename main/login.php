<?php
include 'connect.php'; // reuse your DB connection

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = $_POST['email'];
    $password = $_POST['password'];

    // Prepare statement
    $stmt = $conn->prepare("SELECT id, full_name, email, password FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // Verify hashed password
        if (password_verify($password, $user['password'])) {
            echo "<script>alert('Login successful! Welcome, " . $user['full_name'] . "'); window.location.href='Homepage.html';</script>";
        } else {
            echo "<script>alert('Incorrect password. Please try again.'); window.history.back();</script>";
        }
    } else {
        echo "<script>alert('No account found with that email. Please register first.'); window.history.back();</script>";
    }

    $stmt->close();
}
$conn->close();
?>
