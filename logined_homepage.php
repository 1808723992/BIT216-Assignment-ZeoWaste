<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
include 'connect.php';

// ✅ 启动会话
session_start();
session_regenerate_id(true);

// ✅ 检查是否登录
if (!isset($_SESSION['user_id'])) {
    header('Location: sign_in.html');
    exit();
}

$user_id = $_SESSION['user_id'];
$user_name = $_SESSION['full_name'] ?? 'User';
$user_email = $_SESSION['email'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZeoWaste - Dashboard Home</title>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="Homepage/nav.css" />
  <link rel="stylesheet" href="Homepage/HomepageStyle.css" />

  <style>

    /* === 用户信息卡片 === */
    .user-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      margin: 40px auto;
      padding: 15px 22px;
      width: fit-content;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      backdrop-filter: blur(6px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      color: white;
    }

    .user-info p {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
    }

    .user-info strong {
      font-weight: 600;
      color: #fff;
    }

    .material-symbols-outlined {
      font-size: 22px;
      vertical-align: middle;
    }

  </style>
</head>
<body>
  <script src="Homepage/load_nav.js"></script>

  <section class="hero">
    <div class="hero-content">
      <h1>Welcome Back to <span class="highlight">ZeoWaste</span></h1>
      <p>Access your dashboard, manage your food inventory, and explore new recipes.</p>
      <div style="margin-top: 20px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
        <p><span class="material-symbols-outlined">person</span> Logged in as: <strong><?php echo htmlspecialchars($user_name); ?></strong></p>
        <p><span class="material-symbols-outlined">mail</span> <?php echo htmlspecialchars($user_email); ?></p>
      </div>
    </div>
  </section>

  <section class="features">
    <h2>Quick Access</h2>
    <p class="subtitle">Navigate easily to your tools and dashboard.</p>
    <div class="feature-cards">
      <div class="feature-card">
        <img src="HomePagePicture/pngtree-dashboard-line-icon-png-image_9020881.png" alt="Dashboard" class="feature-img">
        <h3>Analytics</h3>
        <p>View your activity overview, stats, and notifications all in one place.</p>
        <a href="analytics.html" class="btn-primary">View Analytics</a>
      </div>

      <div class="feature-card">
        <img src="HomePagePicture/OIP.jpeg" alt="Inventory" class="feature-img">
        <h3>Food Inventory</h3>
        <p>Track your food items, monitor expiration dates, and get smart recommendations.</p>
        <a href="Manage Food Inventory_GUO.html" class="btn-primary">Manage Inventory</a>
      </div>

      <div class="feature-card">
        <img src="HomePagePicture/search-icon-png-5.png" alt="Browse" class="feature-img">
        <h3>Browse Food Items</h3>
        <p>Search and filter through food items, find recipes, and discover new ingredients.</p>
        <a href="BrowseFoodItem.html" class="btn-primary">Explore Foods</a>
      </div>
    </div>
  </section>
</body>
<div id="footer-placeholder"></div>
<footer>
    <p>&copy; 2025 ZeoWaste. All Rights Reserved.</p>
    <div class="footer-links">
      <a href="#">About Us</a>
      <a href="#">Contact</a>
      <a href="#">Privacy Policy</a>
    </div>
  </footer>
</html>
