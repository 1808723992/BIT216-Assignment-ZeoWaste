<?php
include 'connect.php'; // connect to the database

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get form data
    $full_name = $_POST['full_name'];
    $email = $_POST['email'];
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    $household_size = isset($_POST['household_size']) ? $_POST['household_size'] : NULL;

    // Check if passwords match
    if ($password !== $confirm_password) {
        echo "<script>alert('Passwords do not match.'); window.history.back();</script>";
        exit();
    }

    // Hash password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    // Check if email already exists
    $check = $conn->prepare("SELECT * FROM users WHERE email = ?");
    $check->bind_param("s", $email);
    $check->execute();
    $result = $check->get_result();

    if ($result->num_rows > 0) {
        echo "<script>alert('Email already registered. Try logging in.'); window.history.back();</script>";
        exit();
    }

    // Insert new user
    $stmt = $conn->prepare("INSERT INTO users (full_name, email, password, household_size) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("sssi", $full_name, $email, $hashed_password, $household_size);

    if ($stmt->execute()) {
        echo "<script>alert('Account created successfully!'); window.location.href='sign_in.html';</script>";
    } else {
        echo "<script>alert('Error creating account. Please try again.'); window.history.back();</script>";
    }

    $stmt->close();
    $conn->close();
}
?>
