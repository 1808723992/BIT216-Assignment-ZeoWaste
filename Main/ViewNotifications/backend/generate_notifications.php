<?php
// ViewNotifications/backend/generate_notifications.php
// Run this script via cron (e.g., hourly) to generate notifications from fooditems data.

require_once __DIR__ . '/../../connect.php'; // Adjust path if needed

// --- configuration ---
$EXPIRING_WINDOW_DAYS = 3; // notify items expiring within the next 3 days

notifyExpired($conn);
notifyExpiringSoon($conn, $EXPIRING_WINDOW_DAYS);
notifyDonations($conn);
notifyNewFood($conn);

echo sprintf("[%s] Notification generation completed\n", date('c'));

function notifyExpired(mysqli $conn): void
{
    $sql = "SELECT f.food_id, f.user_id, f.food_name, f.food_expiry_date, f.food_storage
            FROM fooditems f
            WHERE f.food_expiry_date < CURDATE()
              AND f.food_status IN ('active','donated','completed')";
    $result = $conn->query($sql);

    while ($row = $result->fetch_assoc()) {
        createNotificationIfNotExists($conn, $row, 'expired', [
            'title' => 'Food Expired',
            'message' => sprintf('Your %s has expired. Please handle it immediately.', $row['food_name'])
        ]);
    }
}

function notifyExpiringSoon(mysqli $conn, int $daysAhead): void
{
    $sql = "SELECT f.food_id, f.user_id, f.food_name, f.food_expiry_date, f.food_storage,
                   DATEDIFF(f.food_expiry_date, CURDATE()) AS days_until_expiry
            FROM fooditems f
            WHERE f.food_expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
              AND f.food_status = 'active'";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $daysAhead);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        createNotificationIfNotExists($conn, $row, 'expiring-soon', [
            'title' => 'Food Expiring Soon',
            'message' => sprintf('Your %s will expire in %d day(s).', $row['food_name'], max(0, (int) $row['days_until_expiry']))
        ]);
    }
}

function notifyDonations(mysqli $conn): void
{
    $sql = "SELECT d.donation_id, d.food_item_id AS food_id, f.user_id, f.food_name, f.food_expiry_date,
                   f.food_storage,
                   d.pickup_location, d.availability, d.donation_status, d.created_at, d.completed_at, d.withdrawn_at
            FROM donations d
            INNER JOIN fooditems f ON f.food_id = d.food_item_id
            WHERE d.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"; // only check recent events

    $result = $conn->query($sql);

    while ($row = $result->fetch_assoc()) {
        $status = $row['donation_status'];
        $title = 'Donation Update';
        $message = 'Your donation status has changed.';

        if ($status === 'open') {
            $title = 'Donation Published';
            $message = sprintf('Your donation for %s is now open.', $row['food_name']);
        } elseif ($status === 'completed') {
            $title = 'Donation Completed';
            $message = sprintf('Your donation for %s has been completed. Thank you!', $row['food_name']);
        } elseif ($status === 'withdrawn') {
            $title = 'Donation Withdrawn';
            $message = sprintf('You withdrew the donation for %s.', $row['food_name']);
        }

        createNotificationIfNotExists($conn, $row, 'donation', [
            'title' => $title,
            'message' => $message,
            'payload' => [
                'donationStatus' => $status,
                'pickupLocation' => $row['pickup_location'],
                'availability' => $row['availability'],
                'donationCreatedAt' => $row['created_at'],
                'donationCompletedAt' => $row['completed_at'],
                'donationWithdrawnAt' => $row['withdrawn_at'],
                'expiryDate' => $row['food_expiry_date'],
                'storageLocation' => $row['food_storage'],
            ],
        ]);
    }
}

function notifyNewFood(mysqli $conn): void
{
    $sql = "SELECT f.food_id, f.user_id, f.food_name, f.food_quantity, f.food_category,
                   f.food_status, f.created_at, f.food_expiry_date, f.food_storage
            FROM fooditems f
            WHERE f.created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";

    $result = $conn->query($sql);

    while ($row = $result->fetch_assoc()) {
        createNotificationIfNotExists($conn, $row, 'new-food', [
            'title' => 'New Food Added',
            'message' => sprintf('You added %s to your inventory.', $row['food_name']),
            'payload' => [
                'quantity' => $row['food_quantity'],
                'category' => $row['food_category'],
                'status' => $row['food_status'],
                'createdAt' => $row['created_at'],
                'expiryDate' => $row['food_expiry_date'],
                'storageLocation' => $row['food_storage'],
            ],
        ]);
    }
}

function createNotificationIfNotExists(mysqli $conn, array $row, string $type, array $options): void
{
    $userId = (int) $row['user_id'];
    $foodId = isset($row['food_id']) ? (int) $row['food_id'] : null;

    $title = $options['title'] ?? ucfirst($type);
    $message = $options['message'] ?? null;
    $payload = $options['payload'] ?? [
        'expiryDate' => $row['food_expiry_date'] ?? null,
        'storageLocation' => $row['food_storage'] ?? null,
    ];

    $existingId = findExistingNotification($conn, $userId, $foodId, $type);

    $sql = "INSERT INTO notifications (user_id, food_id, type, title, subtitle, message, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);

    $subtitle = $row['food_name'] ?? null;
    $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

    if ($existingId !== null) {
        $update = $conn->prepare("UPDATE notifications
                                   SET title = ?, message = ?, payload = ?, updated_at = NOW()
                                   WHERE notification_id = ?");
        $update->bind_param('sssi', $title, $message, $payloadJson, $existingId);
        $update->execute();
        return;
    }

    $stmt->bind_param(
        'iisssss',
        $userId,
        $foodId,
        $type,
        $title,
        $subtitle,
        $message,
        $payloadJson
    );

    $stmt->execute();
}

function findExistingNotification(mysqli $conn, int $userId, ?int $foodId, string $type): ?int
{
    $sql = "SELECT notification_id FROM notifications
            WHERE user_id = ?
              AND type = ?
              AND (? IS NULL OR food_id = ?)
              AND created_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
              AND status != 'deleted'
            LIMIT 1";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('isii', $userId, $type, $foodId, $foodId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        return (int) $row['notification_id'];
    }

    return null;
}


