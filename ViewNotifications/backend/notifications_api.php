<?php
// ViewNotifications/backend/notifications_api.php
// REST-style endpoint for fetching and mutating notification records.

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../connect.php'; // Adjust this path to your actual DB bootstrap file

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthenticated']);
    exit;
}

$userId = (int) $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

try {
    if ($method === 'GET') {
        handleGet($conn, $userId, $action);
    } elseif ($method === 'POST') {
        handlePost($conn, $userId, $action);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'message' => $e->getMessage()]);
}

function handleGet(mysqli $conn, int $userId, ?string $action): void
{
    if ($action === 'counts') {
        echo json_encode(fetchCounts($conn, $userId));
        return;
    }

    $filter = $_GET['filter'] ?? 'all';
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = max(1, min(100, (int) ($_GET['pageSize'] ?? 20)));

    $notifications = fetchNotifications($conn, $userId, $filter, $page, $pageSize);
    echo json_encode([
        'data' => $notifications,
        'meta' => [
            'filter' => $filter,
            'page' => $page,
            'pageSize' => $pageSize,
        ],
    ]);
}

function handlePost(mysqli $conn, int $userId, ?string $action): void
{
    if ($action === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing action parameter']);
        return;
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        return;
    }

    $ids = array_map('intval', $payload['ids'] ?? []);
    if (empty($ids)) {
        http_response_code(400);
        echo json_encode(['error' => 'No notification ids were provided']);
        return;
    }

    switch ($action) {
        case 'mark-read':
            bulkUpdateStatus($conn, $userId, $ids, 'read');
            echo json_encode(['status' => 'ok']);
            break;
        case 'archive':
            bulkUpdateStatus($conn, $userId, $ids, 'archived');
            echo json_encode(['status' => 'ok']);
            break;
        case 'trash':
            moveToTrash($conn, $userId, $ids);
            echo json_encode(['status' => 'ok']);
            break;
        case 'restore':
            restoreFromTrash($conn, $userId, $ids);
            echo json_encode(['status' => 'ok']);
            break;
        case 'delete':
            permanentlyDelete($conn, $userId, $ids);
            echo json_encode(['status' => 'ok']);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unsupported action']);
    }
}

function fetchNotifications(mysqli $conn, int $userId, string $filter, int $page, int $pageSize): array
{
    $offset = ($page - 1) * $pageSize;

    $where = 'user_id = ? AND status != "deleted"';
    $params = [$userId];
    $types = 'i';

    switch ($filter) {
        case 'unread':
            $where .= ' AND status = "unread"';
            break;
        case 'expired':
        case 'expiring-soon':
        case 'donations':
        case 'meal-plans':
        case 'new-food':
            $where .= ' AND type = ? AND status IN ("unread","read")';
            $params[] = $filter === 'meal-plans' ? 'meal-plans' : ($filter === 'donations' ? 'donation' : $filter);
            $types .= 's';
            break;
        case 'archived':
            $where .= ' AND status = "archived"';
            break;
        case 'trash':
            $where .= ' AND status = "trashed"';
            break;
        case 'all':
        default:
            $where .= ' AND status IN ("unread","read")';
    }

    $sql = "SELECT notification_id, user_id, food_id, type, status, title, subtitle, message, payload,
                   created_at, updated_at, trashed_at, delete_after
            FROM notifications
            WHERE $where
            ORDER BY created_at DESC
            LIMIT ?, ?";

    $stmt = $conn->prepare($sql);

    $types .= 'ii';
    $params[] = $offset;
    $params[] = $pageSize;

    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    return array_map(static function (array $row) {
        $row['payload'] = $row['payload'] ? json_decode($row['payload'], true) : null;
        return $row;
    }, $result->fetch_all(MYSQLI_ASSOC));
}

function fetchCounts(mysqli $conn, int $userId): array
{
    $counts = [
        'all' => 0,
        'unread' => 0,
        'expired' => 0,
        'expiringSoon' => 0,
        'donations' => 0,
        'mealPlans' => 0,
        'archived' => 0,
        'trash' => 0,
    ];

    $sql = "SELECT status, type, COUNT(*) AS total
            FROM notifications
            WHERE user_id = ? AND status != 'deleted'
            GROUP BY status, type";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $status = $row['status'];
        $type = $row['type'];
        $total = (int) $row['total'];

        if (in_array($status, ['unread', 'read'], true)) {
            $counts['all'] += $total;
            if ($status === 'unread') {
                $counts['unread'] += $total;
            }
            switch ($type) {
                case 'expired':
                    $counts['expired'] += $total;
                    break;
                case 'expiring-soon':
                    $counts['expiringSoon'] += $total;
                    break;
                case 'donation':
                    $counts['donations'] += $total;
                    break;
                case 'meal-plans':
                    $counts['mealPlans'] += $total;
                    break;
            }
        } elseif ($status === 'archived') {
            $counts['archived'] += $total;
        } elseif ($status === 'trashed') {
            $counts['trash'] += $total;
        }
    }

    return $counts;
}

function bulkUpdateStatus(mysqli $conn, int $userId, array $ids, string $status): void
{
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = 'i' . str_repeat('i', count($ids));
    $params = array_merge([$userId], $ids);

    $sql = "UPDATE notifications
            SET status = ?, updated_at = NOW()
            WHERE user_id = ? AND notification_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s' . $types, $status, ...$params);
    $stmt->execute();
}

function moveToTrash(mysqli $conn, int $userId, array $ids): void
{
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = 'i' . str_repeat('i', count($ids));
    $params = array_merge([$userId], $ids);

    $sql = "UPDATE notifications
            SET status = 'trashed', trashed_at = NOW(), delete_after = DATE_ADD(NOW(), INTERVAL 30 DAY)
            WHERE user_id = ? AND notification_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();

    $logSql = "INSERT INTO notification_trash_log (notification_id, trashed_at, delete_after)
               VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))";
    $logStmt = $conn->prepare($logSql);
    foreach ($ids as $id) {
        $logStmt->bind_param('i', $id);
        $logStmt->execute();
    }
}

function restoreFromTrash(mysqli $conn, int $userId, array $ids): void
{
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = 'i' . str_repeat('i', count($ids));
    $params = array_merge([$userId], $ids);

    $sql = "UPDATE notifications
            SET status = 'read', trashed_at = NULL, delete_after = NULL
            WHERE user_id = ? AND notification_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
}

function permanentlyDelete(mysqli $conn, int $userId, array $ids): void
{
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = 'i' . str_repeat('i', count($ids));
    $params = array_merge([$userId], $ids);

    $sql = "UPDATE notifications
            SET status = 'deleted', delete_after = NULL
            WHERE user_id = ? AND notification_id IN ($placeholders)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
}


