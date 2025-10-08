<?php
$dsn = 'mysql:host=localhost;dbname=zeowaste_db;charset=utf8mb4';
$user = 'root';
$pass = ''; // XAMPP 默认 root 无密码
$options = [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];
$pdo = new PDO($dsn, $user, $pass, $options);
