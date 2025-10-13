<?php
/* api/api.php — adapted to zeowaste_db.fooditems / donations */
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';
if ($action === 'ping') { JOK(['pong'=>true, 'time'=>date('c')]); }

/* ===== EAN-8 tools ===== */
// 输入7位字符串，返回校验位0-9
function ean8_check_digit($seven){
  $seven = preg_replace('/\D/', '', $seven);
  if (strlen($seven) !== 7) return 0;
  $digits = array_map('intval', str_split($seven));
  $rev = array_reverse($digits);
  $odd=0; $even=0; // 右边起：奇位×3，偶位×1
  foreach ($rev as $i=>$d){
    if (($i+1) % 2 === 1) $odd += $d;
    else                  $even += $d;
  }
  $total = $odd*3 + $even;
  return (10 - ($total % 10)) % 10;
}
// 生成唯一的 EAN-8（8位纯数字）
function generate_barcode8(PDO $pdo){
  while (true){
    $seven = (string)random_int(1000000, 9999999); // 不以0开头
    $cd = ean8_check_digit($seven);
    $code = $seven . $cd;
    $st = $pdo->prepare("SELECT 1 FROM fooditems WHERE barcode=:bc LIMIT 1");
    $st->execute([':bc'=>$code]);
    if (!$st->fetch()) return $code;
  }
}

/* 将 fooditems 行映射为前端旧字段名（不改现有 JS） */
function map_item_row($r){
  return [
    'id'      => (int)$r['food_id'],
    'name'    => $r['food_name'],
    'quantity'=> qty_to_int($r['food_quantity']),
    'expiry_date' => $r['food_expiry_date'],
    'category'=> $r['food_category'],
    'storage' => $r['food_storage'],
    'notes'   => $r['notes'],
    'barcode' => $r['barcode'],
    'status'  => $r['food_status'],
    'donation_pickup_location' => $r['donation_pickup_location'],
    'donation_availability'    => $r['donation_availability'],
    'donated_at'   => $r['donated_at'],
    'completed_at' => $r['completed_at'],
    'created_at'   => $r['created_at'],
    'updated_at'   => $r['updated_at'],
  ];
}

/* ===== Router ===== */
switch ($action) {

  /* ================== Read ================== */
  case 'list_items': { // status=active|donated|completed + filters
    $status = $_GET['status'] ?? 'active';
    $q      = trim($_GET['q'] ?? '');
    $cat    = $_GET['category'] ?? '';
    $stor   = $_GET['storage'] ?? '';
    $expiry = $_GET['expiry'] ?? ''; // near|expired|''

    $sql = "SELECT * FROM fooditems WHERE food_status = :s";
    $p   = [':s'=>$status];

    if ($q   !== '') { $sql .= " AND (food_name LIKE :q OR notes LIKE :q)"; $p[':q']="%$q%"; }
    if ($cat !== '') { $sql .= " AND food_category = :c"; $p[':c']=$cat; }
    if ($stor!== '') { $sql .= " AND food_storage  = :t"; $p[':t']=$stor; }
    if ($expiry === 'near')    { $sql .= " AND DATEDIFF(food_expiry_date, CURDATE()) BETWEEN 0 AND 3"; }
    if ($expiry === 'expired') { $sql .= " AND food_expiry_date < CURDATE()"; }

    $sql .= " ORDER BY food_expiry_date ASC, food_id DESC";
    $st = $pdo->prepare($sql); $st->execute($p);
    $items = array_map('map_item_row', $st->fetchAll());
    JOK(['items'=>$items]);
  }

  case 'list_donations': {
    $st = $pdo->query("SELECT * FROM fooditems WHERE food_status='donated' ORDER BY donated_at DESC, food_id DESC");
    $items = array_map('map_item_row', $st->fetchAll());
    JOK(['items'=>$items]);
  }

  /* ================== Create / Update / Delete ================== */
  case 'add_item': {
    $b = JSON_BODY();
    foreach (['name','quantity','expiry_date','category','storage'] as $f) {
      if (!isset($b[$f]) || $b[$f]==='') JERR("MISSING_$f");
    }
    $name = trim($b['name']);
    $qty  = (int)$b['quantity']; if ($qty<=0) JERR('BAD_QUANTITY');
    $exp  = $b['expiry_date'];
    $cat  = $b['category'];
    $sto  = $b['storage'];
    $notes= $b['notes'] ?? null;
    $barcode = $b['barcode'] ?? null;

    /* 1) 传入条码 → 优先按条码合并 */
    if ($barcode){
      $sel = $pdo->prepare("SELECT food_id, food_quantity FROM fooditems WHERE barcode=:bc LIMIT 1");
      $sel->execute([':bc'=>$barcode]);
      if ($row = $sel->fetch()){
        $newQ = qty_to_int($row['food_quantity']) + $qty;
        $pdo->prepare("UPDATE fooditems SET food_quantity=:q, updated_at=:u WHERE food_id=:id")
            ->execute([':q'=>(string)$newQ, ':u'=>NOW(), ':id'=>$row['food_id']]);
        JOK(['merged'=>true, 'item_id'=>(int)$row['food_id'], 'quantity'=>$newQ]);
      }
    }

    /* 2) 同名(忽略大小写)+同到期日+未完成 → 合并 */
    $sel = $pdo->prepare("SELECT food_id, food_quantity FROM fooditems
                          WHERE LOWER(food_name)=LOWER(:n) AND food_expiry_date=:e AND food_status<>'completed' LIMIT 1");
    $sel->execute([':n'=>$name, ':e'=>$exp]);
    if ($row = $sel->fetch()){
      $newQ = qty_to_int($row['food_quantity']) + $qty;
      $pdo->prepare("UPDATE fooditems SET food_quantity=:q, updated_at=:u WHERE food_id=:id")
          ->execute([':q'=>(string)$newQ, ':u'=>NOW(), ':id'=>$row['food_id']]);
      JOK(['merged'=>true, 'item_id'=>(int)$row['food_id'], 'quantity'=>$newQ]);
    }

    /* 3) 不传条码 → 自动生成唯一 EAN-8 */
    if (!$barcode){
      $barcode = generate_barcode8($pdo);
    }

    /* 4) 插入新物品 */
    $ins = $pdo->prepare("INSERT INTO fooditems
      (food_name,food_quantity,food_expiry_date,food_category,food_storage,notes,barcode,food_status,created_at,updated_at)
      VALUES (:name,:qty,:exp,:cat,:sto,:notes,:barcode,'active',:now,:now)");
    $ins->execute([
      ':name'=>$name,
      ':qty'=>(string)$qty,
      ':exp'=>$exp,
      ':cat'=>$cat,
      ':sto'=>$sto,
      ':notes'=>$notes,
      ':barcode'=>$barcode,
      ':now'=>NOW()
    ]);
    JOK(['merged'=>false, 'item_id'=>(int)$pdo->lastInsertId(), 'barcode'=>$barcode]);
  }

  case 'edit_item': {
    $b = JSON_BODY();
    foreach (['id','name','quantity','expiry_date','category','storage'] as $f) if (empty($b[$f])) JERR("MISSING_$f");
    $pdo->prepare("UPDATE fooditems SET
      food_name=:n, food_quantity=:q, food_expiry_date=:e, food_category=:c, food_storage=:s, notes=:no, updated_at=:u
      WHERE food_id=:id")
      ->execute([
        ':n'=>trim($b['name']),
        ':q'=>(string)max(0,(int)$b['quantity']),
        ':e'=>$b['expiry_date'],
        ':c'=>$b['category'],
        ':s'=>$b['storage'],
        ':no'=>$b['notes'] ?? null,
        ':u'=>NOW(),
        ':id'=>(int)$b['id']
      ]);
    JOK();
  }

  case 'delete_item': {
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->prepare("DELETE FROM fooditems WHERE food_id=:id")->execute([':id'=>(int)$b['id']]);
    JOK();
  }

  case 'mark_used': {
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $used = max(1, (int)($b['used'] ?? 1));
    $pdo->beginTransaction();
    $st = $pdo->prepare("SELECT food_quantity FROM fooditems WHERE food_id=:id FOR UPDATE");
    $st->execute([':id'=>(int)$b['id']]);
    if (!($row=$st->fetch())) { $pdo->rollBack(); JERR('NOT_FOUND',404); }
    $left = qty_to_int($row['food_quantity']) - $used;
    if ($left <= 0) {
      $pdo->prepare("DELETE FROM fooditems WHERE food_id=:id")->execute([':id'=>(int)$b['id']]);
    } else {
      $pdo->prepare("UPDATE fooditems SET food_quantity=:q, updated_at=:u WHERE food_id=:id")
          ->execute([':q'=>(string)$left, ':u'=>NOW(), ':id'=>(int)$b['id']]);
    }
    $pdo->commit();
    JOK(['left'=>max(0,$left)]);
  }

  /* ================== Donation Flow ================== */
  case 'convert_donation': { // id, pickup_location, availability, notes?
    $b = JSON_BODY();
    foreach (['id','pickup_location','availability'] as $f) if (empty($b[$f])) JERR("MISSING_$f");

    $pdo->beginTransaction();
    $pdo->prepare("UPDATE fooditems SET food_status='donated',
        donation_pickup_location=:loc, donation_availability=:av,
        donated_at=:t, updated_at=:t
        WHERE food_id=:id")
      ->execute([':loc'=>$b['pickup_location'], ':av'=>$b['availability'], ':t'=>NOW(), ':id'=>(int)$b['id']]);

    $pdo->prepare("INSERT INTO donations (food_item_id,pickup_location,availability,notes,donation_status,created_at)
                   VALUES (:id,:loc,:av,:no,'open',:t)")
      ->execute([':id'=>(int)$b['id'], ':loc'=>$b['pickup_location'], ':av'=>$b['availability'], ':no'=>$b['notes'] ?? null, ':t'=>NOW()]);
    $pdo->commit();
    JOK();
  }

  case 'withdraw_donation': { // id
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE fooditems SET food_status='active',
        donation_pickup_location=NULL, donation_availability=NULL,
        donated_at=NULL, updated_at=:t
        WHERE food_id=:id")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->prepare("UPDATE donations SET donation_status='withdrawn', withdrawn_at=:t
                   WHERE food_item_id=:id AND donation_status='open'")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->commit();
    JOK();
  }

  case 'complete_donation': { // id
    $b = JSON_BODY(); if (empty($b['id'])) JERR('MISSING_id');
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE fooditems SET food_status='completed', completed_at=:t, updated_at=:t WHERE food_id=:id")
      ->execute([':t'=>NOW(), ':id'=>(int)$b['id']]);
    $pdo->prepare("UPDATE donations SET donation_status='completed', completed_at=:t
                   WHERE food_item_id=:id AND donation_status='open'")
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
    $pdo->prepare("UPDATE fooditems SET food_storage=?, updated_at=? WHERE food_id IN ($in) AND food_status='active'")->execute($params);
    JOK();
  }

  case 'batch_mark_used': { // ids[], used
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; $used = max(1,(int)($b['used'] ?? 1));
    if (!$ids) JERR('BAD_REQUEST');
    $pdo->beginTransaction();
    foreach ($ids as $id) {
      $sel = $pdo->prepare("SELECT food_quantity FROM fooditems WHERE food_id=? AND food_status='active' FOR UPDATE");
      $sel->execute([(int)$id]);
      if ($row = $sel->fetch()) {
        $left = qty_to_int($row['food_quantity']) - $used;
        if ($left <= 0) $pdo->prepare("DELETE FROM fooditems WHERE food_id=?")->execute([(int)$id]);
        else $pdo->prepare("UPDATE fooditems SET food_quantity=?, updated_at=? WHERE food_id=?")->execute([(string)$left, NOW(), (int)$id]);
      }
    }
    $pdo->commit(); JOK();
  }

  case 'batch_delete': { // ids[]
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; if (!$ids) JERR('BAD_REQUEST');
    $in = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("DELETE FROM fooditems WHERE food_id IN ($in)")->execute(array_map('intval',$ids));
    JOK();
  }

  case 'batch_convert_donation': { // ids[], pickup_location, availability
    $b = JSON_BODY(); $ids = $b['ids'] ?? []; $loc = $b['pickup_location'] ?? ''; $av = $b['availability'] ?? '';
    if(!$ids || !$loc || !$av) JERR('BAD_REQUEST');
    $pdo->beginTransaction();
    foreach ($ids as $id) {
      $pdo->prepare("UPDATE fooditems SET food_status='donated', donation_pickup_location=?, donation_availability=?, donated_at=?, updated_at=? WHERE food_id=? AND food_status='active'")
          ->execute([$loc,$av,NOW(),NOW(),(int)$id]);
      $pdo->prepare("INSERT INTO donations (food_item_id,pickup_location,availability,donation_status,created_at) VALUES (?,?,?,?,?)")
          ->execute([(int)$id,$loc,$av,'open',NOW()]);
    }
    $pdo->commit(); JOK();
  }

  default: JERR('UNKNOWN_ACTION',404);
}
