<?php
$servername = "localhost";   // XAMPP runs on localhost
$username   = "root";        // default XAMPP MySQL user
$password   = "";            // default XAMPP MySQL password (leave blank)
$database   = "zeowaste_db"; // your database name in phpMyAdmin

// Create connection
$conn = new mysqli($servername, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    // Stop the script and show the error (for debugging)
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $conn->connect_error
    ]));
}

// ✅ No echo here — keep it silent
?>
