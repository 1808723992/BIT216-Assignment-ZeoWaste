<?php
// ViewNotifications/backend/create_expiring_soon_notification.php
// Helper function to create expiring soon notifications immediately when food is added/edited

require_once __DIR__ . '/../../connect.php';

/**
 * Check and create expiring soon notification if food is expiring within the next N days
 * @param mysqli $conn Database connection
 * @param int $userId User ID
 * @param int $foodId Food item ID
 * @param int $daysAhead Number of days ahead to check (default: 3)
 */
function checkAndCreateExpiringSoonNotification(mysqli $conn, int $userId, int $foodId, int $daysAhead = 3): void
{
    // Get food item details
    $foodStmt = $conn->prepare("SELECT food_name, food_expiry_date, food_storage, food_status
                                FROM fooditems 
                                WHERE food_id = ? AND user_id = ? AND food_status = 'active'");
    $foodStmt->bind_param('ii', $foodId, $userId);
    $foodStmt->execute();
    $foodResult = $foodStmt->get_result();
    $food = $foodResult->fetch_assoc();
    $foodStmt->close();

    if (!$food || !$food['food_expiry_date']) {
        return; // Food item not found, doesn't belong to user, or has no expiry date
    }

    // Check if food is expiring within the next N days
    $expiryDate = $food['food_expiry_date'];
    $today = date('Y-m-d');
    $expiryTimestamp = strtotime($expiryDate);
    $todayTimestamp = strtotime($today);
    
    if ($expiryTimestamp < $todayTimestamp) {
        return; // Already expired, should be handled by expired notification
    }

    $daysUntilExpiry = floor(($expiryTimestamp - $todayTimestamp) / (60 * 60 * 24));
    
    if ($daysUntilExpiry > $daysAhead) {
        return; // Not expiring soon enough
    }

    // Food is expiring soon, create notification
    $title = 'Food Expiring Soon';
    $message = sprintf('Your %s will expire in %d day(s).', $food['food_name'], $daysUntilExpiry);

    // Build payload
    $payload = [
        'expiryDate' => $expiryDate,
        'storageLocation' => $food['food_storage'],
    ];

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $subtitle = $food['food_name'];

    // Check if a notification for this food already exists (within last 24 hours)
    $checkStmt = $conn->prepare("SELECT notification_id FROM notifications 
                                  WHERE user_id = ? AND food_id = ? AND type = 'expiring-soon' 
                                  AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                                  AND status != 'deleted'
                                  ORDER BY created_at DESC LIMIT 1");
    $checkStmt->bind_param('ii', $userId, $foodId);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    $existing = $checkResult->fetch_assoc();
    $checkStmt->close();

    if ($existing) {
        // Update existing notification with new expiry information
        $updateStmt = $conn->prepare("UPDATE notifications 
                                      SET title = ?, message = ?, payload = ?, status = 'unread', updated_at = NOW()
                                      WHERE notification_id = ?");
        $updateStmt->bind_param('sssi', $title, $message, $payloadJson, $existing['notification_id']);
        $updateStmt->execute();
        $updateStmt->close();
    } else {
        // Create new notification
        $insertStmt = $conn->prepare("INSERT INTO notifications (user_id, food_id, type, status, title, subtitle, message, payload) 
                                      VALUES (?, ?, 'expiring-soon', 'unread', ?, ?, ?, ?)");
        $insertStmt->bind_param('iissss', $userId, $foodId, $title, $subtitle, $message, $payloadJson);
        $insertStmt->execute();
        $insertStmt->close();
    }
}

