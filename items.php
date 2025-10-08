<?php
/**
 * items.php  —  Inventory CRUD & query
 * Methods:
 *   GET    /items.php[?q=&category=&storage=&status=&expiry=near|expired]
 *   POST   /items.php   (JSON: name, category, storage, quantity, expiry_date, notes?, barcode?)
 *   PUT    /items.php?id=UUID   (JSON 同上：编辑必填)
 *   PATCH  /items.php?id=UUID   (等同于 PUT)
 *   DELETE /items.php?id=UUID   或 Body: { "id": "UUID" }
 */

require 'bootstrap.php';  // CORS/JSON工具
require 'db.php';         // $pdo

$method = $_SERVER['REQUEST_METHOD'];

$ALLOWED_CATEGORIES = ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'];
$ALLOWED_STORAGE    = ['Fridge','Freezer','Pantry'];

/* ------------------------ GET: list & filters ------------------------ */
if ($method === 'GET') {
  // 过滤参数：q, category, storage, status(active/donated/completed/withdrawn), expiry(near|expired)
  $q        = $_GET['q']        ?? '';
  $category = $_GET['category'] ?? '';
  $storage  = $_GET['storage']  ?? '';
  $status   = $_GET['status']   ?? '';
  $expiry   = $_GET['expiry']   ?? '';

  $sql = "SELECT * FROM items WHERE 1=1";
  $p = [];

  if ($q !== '') {
    $sql .= " AND (LOWER(name) LIKE :q OR LOWER(notes) LIKE :q)";
    $p[':q'] = '%'.strtolower($q).'%';
  }
  if ($category !== '') { $sql .= " AND category = :c"; $p[':c'] = $category; }
  if ($storage  !== '') { $sql .= " AND storage  = :s"; $p[':s'] = $storage;  }
  if ($status   !== '') { $sql .= " AND status   = :st";$p[':st']= $status;   }

  if ($expiry === 'near') {
    $sql .= " AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 3";
  } elseif ($expiry === 'expired') {
    $sql .= " AND expiry_date < CURDATE()";
  }

  $sql .= " ORDER BY expiry_date ASC";

  $st = $pdo->prepare($sql);
  $st->execute($p);
  ok($st->fetchAll());
}

/* ------------------------ POST: create item ------------------------ */
if ($method === 'POST') {
  $b = json_input();

  foreach (['name','category','storage','quantity','expiry_date'] as $k) {
    if (!isset($b[$k]) || $b[$k] === '') bad("Missing field: $k");
  }

  if (!in_array($b['category'], $ALLOWED_CATEGORIES, true)) bad('Invalid category');
  if (!in_array($b['storage'],  $ALLOWED_STORAGE, true))    bad('Invalid storage');

  $qty = (int)$b['quantity'];
  if ($qty <= 0) bad('Quantity must be > 0');

  // 可选：简单校验日期格式 YYYY-MM-DD
  if (!preg_match('/^\d{4}_
