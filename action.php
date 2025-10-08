<?php
require 'bootstrap.php';
require 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') bad('Method not allowed', 405);

$b = json_input();
$action = $b['action'] ?? '';
$id = $b['id'] ?? '';
if ($id === '' || $action === '') bad('Missing id/action', 422);

if ($action === 'use') {
  $qty = max(1, (int)($b['quantity'] ?? 1));
  $pdo->beginTransaction();
  try{
    $st = $pdo->prepare("SELECT quantity FROM items WHERE id=:id FOR UPDATE");
    $st->execute([':id'=>$id]); $row = $st->fetch();
    if (!$row) throw new Exception('Item not found', 404);
    $newQty = (int)$row['quantity'] - $qty;
    if ($newQty <= 0) {
      $pdo->prepare("DELETE FROM items WHERE id=:id")->execute([':id'=>$id]);
      $pdo->commit(); ok(['removed'=>true]);
    } else {
      $pdo->prepare("UPDATE items SET quantity=:q WHERE id=:id")->execute([':q'=>$newQty, ':id'=>$id]);
      $pdo->commit(); ok(['quantity'=>$newQty]);
    }
  }catch(Exception $e){ $pdo->rollBack(); bad($e->getMessage(), $e->getCode() ?: 400); }
}

if ($action === 'donate') {
  foreach (['pickupLocation','availability'] as $k) if (empty($b[$k])) bad("Missing $k");
  $pdo->beginTransaction();
  try{
    $pdo->prepare("UPDATE items SET status='donated',
      donation_pickup_location=:pl, donation_availability=:av, donated_at=NOW()
      WHERE id=:id")->execute([':pl'=>$b['pickupLocation'], ':av'=>$b['availability'], ':id'=>$id]);

    $logId = uuidv4();
    $pdo->prepare("INSERT INTO donation_logs (id,item_id,status,pickup_location,availability,note)
      VALUES (:id,:item,'open',:pl,:av,:note)")
      ->execute([':id'=>$logId, ':item'=>$id, ':pl'=>$b['pickupLocation'], ':av'=>$b['availability'], ':note'=>($b['note'] ?? null)]);
    $pdo->commit(); ok(['logId'=>$logId]);
  }catch(Exception $e){ $pdo->rollBack(); bad($e->getMessage()); }
}

if ($action === 'withdraw') {
  $pdo->beginTransaction();
  try{
    $pdo->prepare("UPDATE items SET status='active',
      donation_pickup_location=NULL, donation_availability=NULL
      WHERE id=:id")->execute([':id'=>$id]);

    $pdo->prepare("UPDATE donation_logs SET status='withdrawn' WHERE item_id=:id AND status='open'")
      ->execute([':id'=>$id]);
    $pdo->commit(); ok();
  }catch(Exception $e){ $pdo->rollBack(); bad($e->getMessage()); }
}

if ($action === 'complete') {
  $pdo->beginTransaction();
  try{
    $pdo->prepare("UPDATE items SET status='completed', completed_at=NOW() WHERE id=:id")
      ->execute([':id'=>$id]);

    $pdo->prepare("UPDATE donation_logs SET status='completed' WHERE item_id=:id AND status='open'")
      ->execute([':id'=>$id]);
    $pdo->commit(); ok();
  }catch(Exception $e){ $pdo->rollBack(); bad($e->getMessage()); }
}

bad('Unknown action', 400);
