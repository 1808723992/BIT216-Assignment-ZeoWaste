<?php
// CORS & JSON 基础
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function json_input() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}
function ok($data = []) { echo json_encode(['ok'=>true,  'data'=>$data]); exit; }
function bad($msg, $code=400) { http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]); exit; }

// 简单 UUIDv4
function uuidv4() {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
// 13位条码（如未传入）
function make_barcode() {
  $n = '';
  for ($i=0; $i<13; $i++) $n .= random_int(0,9);
  return $n;
}
