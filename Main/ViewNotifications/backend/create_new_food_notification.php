<?php
// ViewNotifications/backend/create_new_food_notification.php
// Helper function to create new food notifications immediately when food is added

require_once __DIR__ . '/../../connect.php';

/**
 * Create a new food notification immediately
 * @param mysqli $conn Database connection
 * @param int $userId User ID
 * @param int $foodId Food item ID
 */
function createNewFoodNotification(mysqli $conn, int $userId, int $foodId): void
{
    // Get food item details
    $foodStmt = $conn->prepare("SELECT food_name, food_quantity, food_category, food_status, 
                                       created_at, food_expiry_date, food_storage 
                                FROM fooditems 
                                WHERE food_id = ? AND user_id = ?");
    $foodStmt->bind_param('ii', $foodId, $userId);
    $foodStmt->execute();
    $foodResult = $foodStmt->get_result();
    $food = $foodResult->fetch_assoc();
    $foodStmt->close();

    if (!$food) {
        return; // Food item not found or doesn't belong to user
    }

    $title = 'New Food Added';
    $message = sprintf('You added %s to your inventory.', $food['food_name']);

    // Build payload
    $payload = [
        'quantity' => $food['food_quantity'],
        'category' => $food['food_category'],
        'status' => $food['food_status'],
        'createdAt' => $food['created_at'],
        'expiryDate' => $food['food_expiry_date'],
        'storageLocation' => $food['food_storage'],
    ];

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $subtitle = $food['food_name'];

    // Check if a notification for this food already exists (within last 24 hours)
    $checkStmt = $conn->prepare("SELECT notification_id FROM notifications 
                                  WHERE user_id = ? AND food_id = ? AND type = 'new-food' 
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
                                      VALUES (?, ?, 'new-food', 'unread', ?, ?, ?, ?)");
        $insertStmt->bind_param('iissss', $userId, $foodId, $title, $subtitle, $message, $payloadJson);
        $insertStmt->execute();
        $insertStmt->close();
    }
}

