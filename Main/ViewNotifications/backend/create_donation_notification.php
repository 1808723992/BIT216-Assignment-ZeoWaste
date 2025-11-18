<?php
// ViewNotifications/backend/create_donation_notification.php
// Helper function to create donation notifications immediately when donation status changes

require_once __DIR__ . '/../../connect.php';

/**
 * Create a donation notification immediately
 * @param mysqli $conn Database connection
 * @param int $userId User ID
 * @param int $foodId Food item ID
 * @param string $status Donation status: 'open', 'completed', 'withdrawn'
 * @param array $donationData Optional donation data (pickup_location, availability, etc.)
 */
function createDonationNotification(mysqli $conn, int $userId, int $foodId, string $status, array $donationData = []): void
{
    // Get food item details
    $foodStmt = $conn->prepare("SELECT food_name, food_expiry_date, food_storage FROM fooditems WHERE food_id = ? AND user_id = ?");
    $foodStmt->bind_param('ii', $foodId, $userId);
    $foodStmt->execute();
    $foodResult = $foodStmt->get_result();
    $food = $foodResult->fetch_assoc();
    $foodStmt->close();

    if (!$food) {
        return; // Food item not found or doesn't belong to user
    }

    // Determine title and message based on status
    $title = 'Donation Update';
    $message = 'Your donation status has changed.';

    switch ($status) {
        case 'open':
            $title = 'Donation Published';
            $message = sprintf('Your donation for %s is now open.', $food['food_name']);
            break;
        case 'completed':
            $title = 'Donation Completed';
            $message = sprintf('Your donation for %s has been completed. Thank you!', $food['food_name']);
            break;
        case 'withdrawn':
            $title = 'Donation Withdrawn';
            $message = sprintf('You withdrew the donation for %s.', $food['food_name']);
            break;
    }

    // Build payload
    $payload = [
        'donationStatus' => $status,
        'expiryDate' => $food['food_expiry_date'],
        'storageLocation' => $food['food_storage'],
    ];

    // Add donation-specific data if provided
    if (isset($donationData['pickup_location'])) {
        $payload['pickupLocation'] = $donationData['pickup_location'];
    }
    if (isset($donationData['availability'])) {
        $payload['availability'] = $donationData['availability'];
    }
    if (isset($donationData['created_at'])) {
        $payload['donationCreatedAt'] = $donationData['created_at'];
    }
    if (isset($donationData['completed_at'])) {
        $payload['donationCompletedAt'] = $donationData['completed_at'];
    }
    if (isset($donationData['withdrawn_at'])) {
        $payload['donationWithdrawnAt'] = $donationData['withdrawn_at'];
    }

    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

    // Check if a notification for this donation already exists (within last 24 hours)
    $checkStmt = $conn->prepare("SELECT notification_id FROM notifications 
                                  WHERE user_id = ? AND food_id = ? AND type = 'donation' 
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
                                      VALUES (?, ?, 'donation', 'unread', ?, ?, ?, ?)");
        $subtitle = $food['food_name'];
        $insertStmt->bind_param('iissss', $userId, $foodId, $title, $subtitle, $message, $payloadJson);
        $insertStmt->execute();
        $insertStmt->close();
    }
}

