<?php
require 'bootstrap.php';
require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  // 过滤参数：q, category, storage, status(active/donated/completed), expiry(near|expired)
  $q = $_GET['q'] ?? '';
  $category = $_GET['category'] ?? '';
  $storage  = $_GET['storage']  ?? '';
  $status   = $_GET['status']   ?? '';
  $expiry   = $_GET['expiry']   ?? '';

  $sql = "SELECT * FROM items WHERE 1=1";
  $p = [];
  if ($q !== '') { $sql .= " AND (LOWER(name) LIKE :q OR LOWER(notes) LIKE :q)"; $p[':q'] = '%'.strtolower($q).'%'; }
  if ($category !== '') { $sql .= " AND category=:c"; $p[':c'] = $category; }
  if ($storage  !== '') { $sql .= " AND storage=:s";  $p[':s'] = $storage;  }
  if ($status   !== '') { $sql .= " AND status=:st";  $p[':st']= $status;   }
  if ($expiry === 'near')   { $sql .= " AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 3"; }
  if ($expiry === 'expired'){ $sql .= " AND expiry_date < CURDATE()"; }
  $sql .= " ORDER BY expiry_date ASC";

  $st = $pdo->prepare($sql); $st->execute($p);
  ok($st->fetchAll());
}

if ($method === 'POST') {
  $b = json_input();
  foreach (['name','category','storage','quantity','expiry_date'] as $k) {
    if (!isset($b[$k]) || $b[$k]==='') bad("Missing field: $k");
  }
  if (!in_array($b['category'], ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'])) bad('Invalid category');
  if (!in_array($b['storage'],  ['Fridge','Freezer','Pantry'])) bad('Invalid storage');
  $qty = (int)$b['quantity']; if ($qty <= 0) bad('Quantity must be > 0');

  $id = uuidv4();
  $barcode = $b['barcode'] ?? make_barcode();

  $st = $pdo->prepare("INSERT INTO items
    (id,name,category,storage,quantity,expiry_date,notes,status,barcode)
    VALUES (:id,:name,:category,:storage,:quantity,:expiry_date,:notes,'active',:barcode)");
  $st->execute([
    ':id'=>$id, ':name'=>$b['name'], ':category'=>$b['category'], ':storage'=>$b['storage'],
    ':quantity'=>$qty, ':expiry_date'=>$b['expiry_date'], ':notes'=>($b['notes'] ?? null), ':barcode'=>$barcode
  ]);
  ok(['id'=>$id]);
}

if ($method === 'PUT' || $method === 'PATCH') {
  $id = $_GET['id'] ?? ''; if ($id==='') bad('Missing id', 422);
  $b = json_input();
  foreach (['name','category','storage','quantity','expiry_date'] as $k) {
    if (!isset($b[$k]) || $b[$k]==='') bad("Missing field: $k");
  }
  if (!in_array($b['category'], ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'])) bad('Invalid category');
  if (!in_array($b['storage'],  ['Fridge','Freezer','Pantry'])) bad('Invalid storage');
  $qty = (int)$b['quantity']; if ($qty <= 0) bad('Quantity must be > 0');

  $st = $pdo->prepare("UPDATE items SET
    name=:name, category=:category, storage=:storage, quantity=:quantity,
    expiry_date=:expiry_date, notes=:notes
    WHERE id=:id");
  $st->execute([
    ':name'=>$b['name'], ':category'=>$b['category'], ':storage'=>$b['storage'],
    ':quantity'=>$qty, ':expiry_date'=>$b['expiry_date'], ':notes'=>($b['notes'] ?? null), ':id'=>$id
  ]);
  ok(['id'=>$id]);
}

if ($method === 'DELETE') {
  $id = $_GET['id'] ?? ''; if ($id==='') bad('Missing id', 422);
  $st = $pdo->prepare("DELETE FROM items WHERE id=:id"); $st->execute([':id'=>$id]);
  ok(['id'=>$id]);
}

bad('Method not allowed', 405);
