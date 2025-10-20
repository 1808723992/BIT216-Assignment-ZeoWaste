<?php
include 'connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["success"=>false, "error"=>"UNAUTHORIZED"]);
    exit;
}
$user_id = (int)$_SESSION['user_id'];

// Expect: POST id, pickup_location, availability, notes?
if (!isset($_POST['id']) || !isset($_POST['pickup_location']) || !isset($_POST['availability'])) {
    echo json_encode(["success"=>false, "error"=>"MISSING_PARAMS"]);
    exit;
}

$food_id = (int)$_POST['id'];
$pickup_location = trim($_POST['pickup_location']);
$availability = trim($_POST['availability']);
$notes = isset($_POST['notes']) ? trim($_POST['notes']) : null;
if ($pickup_location === '' || $availability === '') {
    echo json_encode(["success"=>false, "error"=>"MISSING_PARAMS"]);
    exit;
}

// Update fooditems and insert donations
$upd = $conn->prepare("UPDATE fooditems SET food_status='donated', donation_pickup_location=?, donation_availability=?, donated_at=NOW(), updated_at=NOW() WHERE food_id=? AND user_id=?");
$upd->bind_param('ssii', $pickup_location, $availability, $food_id, $user_id);
if (!$upd->execute()) { echo json_encode(["success"=>false, "error"=>$upd->error]); exit; }

$ins = $conn->prepare("INSERT INTO donations (food_item_id, pickup_location, availability, notes, donation_status, created_at) VALUES (?,?,?,?, 'open', NOW())");
$ins->bind_param('isss', $food_id, $pickup_location, $availability, $notes);
if (!$ins->execute()) { echo json_encode(["success"=>false, "error"=>$ins->error]); exit; }

echo json_encode(["success"=>true]);
?>

