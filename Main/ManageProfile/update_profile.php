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

require_once '../connect.php';

$userId = $_SESSION['user_id'];
$action = $_POST['action'] ?? '';

try {
  if ($action === 'update_name') {
    $fullName = trim($_POST['full_name'] ?? '');

    if ($fullName === '') {
      throw new InvalidArgumentException('Display name cannot be empty.');
    }

    if (mb_strlen($fullName) > 60) {
      throw new InvalidArgumentException('Display name must be fewer than 60 characters.');
    }

    $stmt = $conn->prepare('UPDATE users SET full_name = ? WHERE user_id = ?');
    if (!$stmt) {
      throw new RuntimeException('Something went wrong while updating your name.');
    }
    $stmt->bind_param('si', $fullName, $userId);
    $stmt->execute();
    $stmt->close();

    $_SESSION['full_name'] = $fullName;

    echo json_encode(['success' => true, 'message' => 'Display name updated successfully.'], JSON_UNESCAPED_UNICODE);
    exit();
  }

  if ($action === 'update_household') {
    if (!isset($_POST['household_size']) || $_POST['household_size'] === '') {
      throw new InvalidArgumentException('Please provide a household size.');
    }

    $householdSize = filter_var($_POST['household_size'], FILTER_VALIDATE_INT, [
      'options' => ['min_range' => 1, 'max_range' => 20]
    ]);

    if ($householdSize === false) {
      throw new InvalidArgumentException('Household size must be between 1 and 20.');
    }

    $stmt = $conn->prepare('UPDATE users SET household_size = ? WHERE user_id = ?');
    if (!$stmt) {
      throw new RuntimeException('Something went wrong while updating your household size.');
    }
    $stmt->bind_param('ii', $householdSize, $userId);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Household size updated successfully.'], JSON_UNESCAPED_UNICODE);
    exit();
  }

  http_response_code(400);
  echo json_encode(['success' => false, 'message' => 'Unsupported action.'], JSON_UNESCAPED_UNICODE);
} catch (InvalidArgumentException $e) {
  http_response_code(422);
  echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  error_log('ManageProfile(update_profile.php) error: ' . $e->getMessage());
  echo json_encode(['success' => false, 'message' => 'We ran into a server issue. Please try again shortly.'], JSON_UNESCAPED_UNICODE);
} finally {
  if (isset($conn) && $conn instanceof mysqli) {
    $conn->close();
  }
}

