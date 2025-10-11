<?php
/* api/api.php */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'ping') { JOK(['pong'=>true, 'time'=>date('c')]); }

switch ($action) {

  /* ================== Read ================== */
  case 'list_items': { // status=active|donated|completed + 可选过滤
    $status = $_GET['status'] ?? 'active';
    $q      = trim($_GET['q'] ?? '');
    $cat    = $_GET['category'] ?? '';
    $stor   = $_GET['storage'] ?? '';
    $expiry = $_GET['expiry'] ?? ''; // near|expired|''

    $sql = "SELECT * FROM items WHERE status=:s";
    $p = [':s'=>$status];

    if ($q !== '') { $sql .= " AND (name LIKE :q OR notes LIKE :q)"; $p[':q']="%$q%"; }
    if ($cat !== '') { $sql .= " AND category=:c"; $p[':c']=$cat; }
    if ($stor !== '') { $sql .= " AND storage=:t"; $p[':t']=$stor; }
    if ($expiry === 'near') { $sql .= " AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 3"; }
    if ($expiry === 'expired') { $sql .= " AND expiry_date < CURDATE()"; }

    $sql .= " ORDER BY expiry_date ASC, id DESC";
    $st = $pdo->prepare($sql); $st->execute($p);
    JOK(['items'=>$st->fetchAll()]);
  }

  case 'list_donations': {
    $st = $pdo->query("SELECT * FROM items WHERE status='donated' ORDER BY donated_at DESC, id DESC");
    JOK(['items'=>$st->fetchAll()]);
  }

  /* ================== Create / Update / Delete ================== */
  case 'add_item': {
    $b = JSON_BODY();
    foreach (['name','quantity','expiry_date','category','storage'] as $f) {
      if (!isset($b[$f]) || $b[$f]==='') JERR("MISSING_$f");
    }

    // 合并规则：同名(忽略大小写) + 同 expiry_date → 合并数量；否则新建
    $sel = $pdo->prepare("SELECT id,quantity FROM items WHERE LOWER(name)=LOWER(:n) AND expiry_date=:e AND status<>'completed' LIMIT 1");
    $sel->execute([':n'=>$b['name'], ':e'=>$b['expiry_date']]);
    if ($row = $sel->fetch()) {
      $newQ = (int)$row['quantity'] + (int)$b['quantity'];
      $pdo->prepare("UPDATE items SET quantity=:q, updated_at=:u WHERE id=:id")
          ->execute([':q'=>$newQ, ':u'=>NOW(), ':id'=>$row['id']]);
      JOK(['merged'=>true, 'item_id'=>$row['id'], 'quantity'=>$newQ]);
    }

    $ins = $pdo->prepare("INSERT INTO items
      (name,quantity,expiry_date,category,storage,notes,barcode,status,created_at,updated_at)
      VALUES (:name,:qty,:exp,:cat,:sto,:notes,:barcode,'active',:now,:now)");
    $ins->execute([
      ':name'=>$b['name'], ':qty'=>(int)$b['quantity'], ':exp'=>$b['expiry_date'],
      ':cat'=>$b['category'], ':sto'=>$b['storage'], ':notes'=>$b['notes'] ?? null,
      ':barcode'=>$b['barcode'] ?? null, ':now'=>NOW()
    ]);
    JOK(['merged'=>false, 'item_id'=>$pdo->lastInsertId()]);
  }

  case 'edit_item': {
    $b = JSON_BODY();
    foreach (['id','name','quantity','expiry_date','category','storage'] as $f) if (empty($b[$f])) JERR("MISSING_$f");
    $pdo->prepare("UPDATE items SET
      name=:n, quantity=:q, expiry_date=:e, category=:c, storage=:s, notes=:no, updated_at=:u
      WHERE id=:id")
      ->execute([
        ':n'=>$b['name'], ':q'=>(int)$b['quantity'], ':e'=>$b['expiry_date'],
        ':c'=>$b['category'], ':s'=>$b['storage'], ':no'=>$b['notes'] ?? null,
        ':u'=>NOW(), ':id'=>(int)$b['id']
      ]);
    JOK();
  }

  case 'delete_item': {
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->prepare("DELETE FROM items WHERE id=:id")->execute([':id'=>(int)$b['id']]);
    JOK();
  }

  case 'mark_used': {
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $used = max(1, (int)($b['used'] ?? 1));
    $pdo->beginTransaction();
    $st = $pdo->prepare("SELECT quantity FROM items WHERE id=:id FOR UPDATE");
    $st->execute([':id'=>(int)$b['id']]);
    if (!($row=$st->fetch())) { $pdo->rollBack(); JERR('NOT_FOUND',404); }
    $left = (int)$row['quantity'] - $used;
    if ($left <= 0) $pdo->prepare("DELETE FROM items WHERE id=:id")->execute([':id'=>(int)$b['id']]);
    else $pdo->prepare("UPDATE items SET quantity=:q, updated_at=:u WHERE id=:id")->execute([':q'=>$left, ':u'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->commit();
    JOK(['left'=>max(0,$left)]);
  }

  /* ================== Donation Flow ================== */
  case 'convert_donation': { // id, pickup_location, availability, notes?
    $b = JSON_BODY();
    foreach (['id','pickup_location','availability'] as $f) if (empty($b[$f])) JERR("MISSING_$f");

    $pdo->beginTransaction();
    $pdo->prepare("UPDATE items SET status='donated',
        donation_pickup_location=:loc, donation_availability=:av,
        donated_at=:t, updated_at=:t
        WHERE id=:id")
      ->execute([':loc'=>$b['pickup_location'], ':av'=>$b['availability'], ':t'=>NOW(), ':id'=>(int)$b['id']]);

    $pdo->prepare("INSERT INTO donations (item_id,pickup_location,availability,notes,status,created_at)
                   VALUES (:id,:loc,:av,:no,'open',:t)")
      ->execute([':id'=>(int)$b['id'], ':loc'=>$b['pickup_location'], ':av'=>$b['availability'], ':no'=>$b['notes'] ?? null, ':t'=>NOW()]);
    $pdo->commit();
    JOK();
  }

  case 'withdraw_donation': { // id
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE items SET status='active',
        donation_pickup_location=NULL, donation_availability=NULL,
        donated_at=NULL, updated_at=:t
        WHERE id=:id")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->prepare("UPDATE donations SET status='withdrawn', withdrawn_at=:t
                   WHERE item_id=:id AND status='open'")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->commit();
    JOK();
  }

  case 'complete_donation': { // id
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE items SET status='completed', completed_at=:t, updated_at=:t WHERE id=:id")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->prepare("UPDATE donations SET status='completed', completed_at=:t
                   WHERE item_id=:id AND status='open'")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->commit();
    JOK();
  }

  /* ================== Batch ================== */
  case 'batch_edit_storage': { // ids[], storage
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; $sto = $b['storage'] ?? '';
    if (!$ids || !in_array($sto, ['Fridge','Freezer','Pantry'])) JERR('BAD_REQUEST');
    $in = implode(',', array_fill(0, count($ids), '?'));
    $params = array_merge([$sto, NOW()], array_map('intval',$ids));
    $pdo->prepare("UPDATE items SET storage=?, updated_at=? WHERE id IN ($in) AND status='active'")->execute($params);
    JOK();
  }

  case 'batch_mark_used': { // ids[], used
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; $used = max(1,(int)($b['used'] ?? 1));
    if (!$ids) JERR('BAD_REQUEST');
    $pdo->beginTransaction();
    foreach ($ids as $id) {
      $sel = $pdo->prepare("SELECT quantity FROM items WHERE id=? AND status='active' FOR UPDATE");
      $sel->execute([(int)$id]);
      if ($row = $sel->fetch()) {
        $left = (int)$row['quantity'] - $used;
        if ($left <= 0) $pdo->prepare("DELETE FROM items WHERE id=?")->execute([(int)$id]);
        else $pdo->prepare("UPDATE items SET quantity=?, updated_at=? WHERE id=?")->execute([$left, NOW(), (int)$id]);
      }
    }
    $pdo->commit(); JOK();
  }

  case 'batch_delete': { // ids[]
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; if (!$ids) JERR('BAD_REQUEST');
    $in = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("DELETE FROM items WHERE id IN ($in)")->execute(array_map('intval',$ids));
    JOK();
  }

  case 'batch_convert_donation': { // ids[], pickup_location, availability
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; $loc = $b['pickup_location'] ?? ''; $av = $b['availability'] ?? '';
    if(!$ids || !$loc || !$av) JERR('BAD_REQUEST');
    $pdo->beginTransaction();
    foreach ($ids as $id) {
      $pdo->prepare("UPDATE items SET status='donated', donation_pickup_location=?, donation_availability=?, donated_at=?, updated_at=? WHERE id=? AND status='active'")
          ->execute([$loc,$av,NOW(),NOW(),(int)$id]);
      $pdo->prepare("INSERT INTO donations (item_id,pickup_location,availability,status,created_at) VALUES (?,?,?,?,?)")
          ->execute([(int)$id,$loc,$av,'open',NOW()]);
    }
    $pdo->commit(); JOK();
  }

  default: JERR('UNKNOWN_ACTION',404);
}
