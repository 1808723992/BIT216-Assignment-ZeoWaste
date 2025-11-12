<?php
// ViewNotifications/backend/cleanup_trash.php
// Run this script daily via cron to purge trashed notifications past their delete_after timestamp.

require_once __DIR__ . '/../../config/db.php'; // Adjust path to your DB bootstrap

declare(strict_types=1);

$sql = "SELECT notification_id
        FROM notifications
        WHERE status = 'trashed'
          AND delete_after IS NOT NULL
          AND delete_after < NOW()";

$result = $conn->query($sql);
$ids = [];

while ($row = $result->fetch_assoc()) {
    $ids[] = (int) $row['notification_id'];
}

if (!empty($ids)) {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));

    $stmt = $conn->prepare("UPDATE notifications
                              SET status = 'deleted', delete_after = NULL
                              WHERE notification_id IN ($placeholders)");
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();

    echo sprintf("[%s] Deleted %d notifications permanently.\n", date('c'), count($ids));
} else {
    echo sprintf("[%s] No notifications to delete.\n", date('c'));
}
