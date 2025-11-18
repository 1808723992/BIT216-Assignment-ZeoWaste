<?php
// ViewNotifications/backend/create_expired_notification.php
// Helper function to create expired notifications immediately when food is added/edited

require_once __DIR__ . '/../../connect.php';

/**
 * Check and create expired notification if food has expired
 * @param mysqli $conn Database connection
 * @param int $userId User ID
 * @param int $foodId Food item ID
 */
function checkAndCreateExpiredNotification(mysqli $conn, int $userId, int $foodId): void
{
    // Get food item details
    $foodStmt = $conn->prepare("SELECT food_name, food_expiry_date, food_storage, food_status
                                FROM fooditems 
                                WHERE food_id = ? AND user_id = ? 
                                AND food_status IN ('active', 'donated', 'completed')");
    $foodStmt->bind_param('ii', $foodId, $userId);
    $foodStmt->execute();
    $foodResult = $foodStmt->get_result();
    $food = $foodResult->fetch_assoc();
    $foodStmt->close();

    if (!$food || !$food['food_expiry_date']) {
        return; // Food item not found, doesn't belong to user, or has no expiry date
    }

    // Check if food has expired
    $expiryDate = $food['food_expiry_date'];
    $today = date('Y-m-d');
    $expiryTimestamp = strtotime($expiryDate);
    $todayTimestamp = strtotime($today);
    
    if ($expiryTimestamp >= $todayTimestamp) {
        return; // Not expired yet
    }

    // Food has expired, create notification
    $title = 'Food Expired';
    $message = sprintf('Your %s has expired. Please handle it immediately.', $food['food_name']);

    // Build payload
    $payload = [
        'expiryDate' => $expiryDate,
        'storageLocation' => $food['food_storage'],
    ];

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $subtitle = $food['food_name'];

    // Check if a notification for this food already exists (within last 24 hours)
    $checkStmt = $conn->prepare("SELECT notification_id FROM notifications 
                                  WHERE user_id = ? AND food_id = ? AND type = 'expired' 
                                  AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                  AND status != 'deleted'
                                  ORDER BY created_at DESC LIMIT 1");
    $checkStmt->bind_param('ii', $userId, $foodId);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $existing = $checkResult->fetch_assoc();
    $checkStmt->close();

    if ($existing) {
        // Update existing notification
        $updateStmt = $conn->prepare("UPDATE notifications 
                                      SET title = ?, message = ?, payload = ?, status = 'unread', updated_at = NOW()
                                      WHERE notification_id = ?");
        $updateStmt->bind_param('sssi', $title, $message, $payloadJson, $existing['notification_id']);
        $updateStmt->execute();
        $updateStmt->close();
    } else {
        // Create new notification
        $insertStmt = $conn->prepare("INSERT INTO notifications (user_id, food_id, type, status, title, subtitle, message, payload) 
                                      VALUES (?, ?, 'expired', 'unread', ?, ?, ?, ?)");
        $insertStmt->bind_param('iissss', $userId, $foodId, $title, $subtitle, $message, $payloadJson);
        $insertStmt->execute();
        $insertStmt->close();
    }
}

