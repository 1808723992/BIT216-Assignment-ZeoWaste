<?php
/* api/config.php — XAMPP PDO + JSON helpers */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

/* —— 按你的环境修改 —— */
$DB_HOST = '127.0.0.1';
$DB_NAME = 'zeowaste_db';   // ← 新库名
$DB_USER = 'root';
$DB_PASS = '';              // XAMPP 默认空密码

try {
  $pdo = new PDO(
    "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER,
    $DB_PASS,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'DB_CONNECT_FAIL', 'message'=>$e->getMessage()]);
  exit;
}

/* ===== Helpers ===== */
function JOK($data = []) {
  echo json_encode(['ok'=>true] + $data);
  exit;
}
function JERR($msg, $code=400, $extra=[]) {
  http_response_code($code);
  echo json_encode(['ok'=>false,'error'=>$msg] + $extra);
  exit;
}
function JSON_BODY(){
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}
function NOW(){ return date('Y-m-d H:i:s'); }

/* fooditems.food_quantity 是 varchar，这里统一转为整数再做运算 */
function qty_to_int($v){
  if ($v === null) return 0;
  if (is_numeric($v)) return (int)$v;
  $n = preg_replace('/\D+/', '', (string)$v);
  return $n === '' ? 0 : (int)$n;
}
