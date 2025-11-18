<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Please use the POST method.'], JSON_UNESCAPED_UNICODE);
  exit();
}

if (!isset($_SESSION['user_id'])) {
  http_response_code(401);
  echo json_encode(['success' => false, 'message' => 'Session expired. Please sign in and try again.'], JSON_UNESCAPED_UNICODE);
  exit();
}

$confirmPhrase = strtoupper(trim($_POST['confirm_phrase'] ?? ''));
if ($confirmPhrase !== 'DELETE') {
  http_response_code(422);
  echo json_encode(['success' => false, 'message' => 'Please type DELETE to confirm.'], JSON_UNESCAPED_UNICODE);
  exit();
}

require_once '../connect.php';

$userId = $_SESSION['user_id'];

$conn->begin_transaction();

try {
  $stmt = $conn->prepare('DELETE FROM users WHERE user_id = ?');
  if (!$stmt) {
    throw new RuntimeException('Something went wrong while removing your account.');
  }
  $stmt->bind_param('i', $userId);
  $stmt->execute();

  if ($stmt->affected_rows === 0) {
    throw new RuntimeException('We could not find that account or it was already removed.');
  }

  $stmt->close();

  $conn->commit();

  $_SESSION = [];
  if (session_id() !== '' || isset($_COOKIE[session_name()])) {
    setcookie(session_name(), '', time() - 3600, '/');
  }
  session_destroy();

  echo json_encode([
    'success' => true,
    'message' => 'Your account has been deleted. We hope to see you again!',
    'redirect' => 'sign_in.html'
  ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  $conn->rollback();
  error_log('ManageProfile(delete_account.php) error: ' . $e->getMessage());
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Deletion failed. Please try again shortly.'], JSON_UNESCAPED_UNICODE);
} finally {
  if (isset($conn) && $conn instanceof mysqli) {
    $conn->close();
  }
}

