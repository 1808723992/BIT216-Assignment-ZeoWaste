<?php
// data_analytics.php
// Simple JSON-backed analytics API for logging and reporting
// Storage files will be created automatically under this folder

header('Content-Type: application/json');

// Allow GET, POST, DELETE from same origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$storageDir = __DIR__;
$eventsFile = $storageDir . DIRECTORY_SEPARATOR . 'events.json';
$inventoryFile = $storageDir . DIRECTORY_SEPARATOR . 'inventory_count.json';

// Ensure storage files exist
if (!file_exists($eventsFile)) {
    file_put_contents($eventsFile, json_encode([]));
}
if (!file_exists($inventoryFile)) {
    file_put_contents($inventoryFile, json_encode(["count" => 0, "updatedAt" => null]));
}

function readEvents($eventsFile) {
    $raw = file_get_contents($eventsFile);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function writeEvents($eventsFile, $events) {
    // Prevent concurrent write corruption on Windows by using temp file + rename
    $tmp = $eventsFile . '.tmp';
    file_put_contents($tmp, json_encode($events, JSON_PRETTY_PRINT));
    rename($tmp, $eventsFile);
}

function uuidv4() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // version 4
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // variant
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function withinRange($ts, $fromTs, $toTs) {
    if ($fromTs !== null && $ts < $fromTs) return false;
    if ($toTs !== null && $ts > $toTs) return false;
    return true;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? $_POST['action'] ?? null;
$source = $_GET['source'] ?? $_POST['source'] ?? 'json';

if ($action === null) {
    echo json_encode(["error" => "Missing action"], JSON_PRETTY_PRINT);
    exit;
}

try {
    if ($action === 'log_event' && $method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) $input = $_POST;
        $required = ['actionType', 'itemName', 'category', 'quantity'];
        foreach ($required as $r) {
            if (!isset($input[$r])) {
                http_response_code(400);
                echo json_encode(["error" => "Missing field: $r"], JSON_PRETTY_PRINT);
                exit;
            }
        }
        $timestamp = $input['timestamp'] ?? gmdate('c');
        $event = [
            'id' => uuidv4(),
            'actionType' => strtolower(trim($input['actionType'])), // used|donated|discarded
            'itemName' => trim($input['itemName']),
            'category' => trim($input['category']),
            'quantity' => (int)$input['quantity'],
            'timestamp' => $timestamp
        ];
        $events = readEvents($eventsFile);
        $events[] = $event;
        writeEvents($eventsFile, $events);
        echo json_encode(['ok' => true, 'event' => $event], JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'delete_event') {
        $id = $_GET['id'] ?? ($_POST['id'] ?? null);
        if ($id === null) {
            http_response_code(400);
            echo json_encode(["error" => "Missing id"], JSON_PRETTY_PRINT);
            exit;
        }
        $events = readEvents($eventsFile);
        $before = count($events);
        $events = array_values(array_filter($events, function ($e) use ($id) {
            return ($e['id'] ?? '') !== $id;
        }));
        writeEvents($eventsFile, $events);
        echo json_encode(['ok' => true, 'removed' => $before - count($events)], JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'update_inventory' && $method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) $input = $_POST;
        $count = isset($input['count']) ? (int)$input['count'] : null;
        if ($count === null) {
            http_response_code(400);
            echo json_encode(["error" => "Missing count"], JSON_PRETTY_PRINT);
            exit;
        }
        $payload = ["count" => $count, "updatedAt" => gmdate('c')];
        file_put_contents($inventoryFile, json_encode($payload, JSON_PRETTY_PRINT));
        echo json_encode(['ok' => true, 'inventory' => $payload], JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'list_events') {
        $from = $_GET['from'] ?? null; // yyyy-mm-dd or ISO
        $to = $_GET['to'] ?? null;
        $fromTs = $from ? strtotime($from . ' 00:00:00') : null;
        $toTs = $to ? strtotime($to . ' 23:59:59') : null;
        $events = readEvents($eventsFile);
        $filtered = array_values(array_filter($events, function ($e) use ($fromTs, $toTs) {
            $ts = strtotime($e['timestamp']);
            return withinRange($ts, $fromTs, $toTs);
        }));
        echo json_encode(['events' => $filtered], JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'summary') {
        if ($source === 'db') {
            require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'connect.php'; // provides $conn (mysqli)
            $userId = (int)($_GET['user_id'] ?? 0);
            $from = $_GET['from'] ?? null;
            $to = $_GET['to'] ?? null;
            $fromDate = $from ? $from : null;
            $toDate = $to ? $to : null;

            // Used = completed items in range
            $sqlUsed = "SELECT COALESCE(SUM(1),0) AS c FROM fooditems WHERE user_id=? AND completed_at IS NOT NULL AND DATE(completed_at) BETWEEN ? AND ?";
            $stmt = $conn->prepare($sqlUsed);
            $stmt->bind_param('iss', $userId, $fromDate, $toDate);
            $stmt->execute();
            $used = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
            $stmt->close();

            // Donated = donated items in range
            $sqlDon = "SELECT COALESCE(SUM(1),0) AS c FROM fooditems WHERE user_id=? AND donated_at IS NOT NULL AND DATE(donated_at) BETWEEN ? AND ?";
            $stmt = $conn->prepare($sqlDon);
            $stmt->bind_param('iss', $userId, $fromDate, $toDate);
            $stmt->execute();
            $don = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
            $stmt->close();

            // Discarded = items that expired in range and still active now (treated as wasted)
            $sqlDis = "SELECT COALESCE(SUM(1),0) AS c FROM fooditems WHERE user_id=? AND food_status='active' AND food_expiry_date BETWEEN ? AND ? AND food_expiry_date <= CURDATE()";
            $stmt = $conn->prepare($sqlDis);
            $stmt->bind_param('iss', $userId, $fromDate, $toDate);
            $stmt->execute();
            $dis = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
            $stmt->close();

            // Inventory = active items now
            $sqlInv = "SELECT COUNT(*) AS c FROM fooditems WHERE user_id=? AND food_status='active'";
            $stmt = $conn->prepare($sqlInv);
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $inv = (int)($stmt->get_result()->fetch_assoc()['c'] ?? 0);
            $stmt->close();

            echo json_encode(['summary' => ['used'=>$used,'donated'=>$don,'discarded'=>$dis,'inventory'=>$inv]], JSON_PRETTY_PRINT);
            exit;
        }
        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        $fromTs = $from ? strtotime($from . ' 00:00:00') : null;
        $toTs = $to ? strtotime($to . ' 23:59:59') : null;
        $events = readEvents($eventsFile);
        $stats = [
            'used' => 0,
            'donated' => 0,
            'discarded' => 0
        ];
        foreach ($events as $e) {
            $ts = strtotime($e['timestamp']);
            if (!withinRange($ts, $fromTs, $toTs)) continue;
            $type = $e['actionType'];
            if (isset($stats[$type])) $stats[$type] += (int)$e['quantity'];
        }
        $inventory = json_decode(file_get_contents($inventoryFile), true);
        $resp = [
            'summary' => [
                'used' => $stats['used'],
                'donated' => $stats['donated'],
                'discarded' => $stats['discarded'],
                'inventory' => (int)($inventory['count'] ?? 0)
            ]
        ];
        echo json_encode($resp, JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'timeseries') {
        if ($source === 'db') {
            require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'connect.php';
            $userId = (int)($_GET['user_id'] ?? 0);
            $from = $_GET['from'] ?? null;
            $to = $_GET['to'] ?? null;
            if (!$from || !$to) { http_response_code(400); echo json_encode(["error"=>"from/to required"], JSON_PRETTY_PRINT); exit; }

            // Build daily labels
            $labels = [];
            $cursor = strtotime($from);
            $end = strtotime($to);
            while ($cursor <= $end) { $labels[] = date('Y-m-d', $cursor); $cursor = strtotime('+1 day', $cursor); }
            $index = array_flip($labels);
            $series = ['used'=>array_fill(0,count($labels),0),'donated'=>array_fill(0,count($labels),0),'discarded'=>array_fill(0,count($labels),0)];

            // Used per day
            $sql = "SELECT DATE(completed_at) d, COUNT(*) c FROM fooditems WHERE user_id=? AND completed_at IS NOT NULL AND DATE(completed_at) BETWEEN ? AND ? GROUP BY DATE(completed_at)";
            $stmt = $conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result();
            while($row=$res->fetch_assoc()){ $d=$row['d']; if(isset($index[$d])) $series['used'][$index[$d]]=(int)$row['c']; }
            $stmt->close();
            // Donated per day
            $sql = "SELECT DATE(donated_at) d, COUNT(*) c FROM fooditems WHERE user_id=? AND donated_at IS NOT NULL AND DATE(donated_at) BETWEEN ? AND ? GROUP BY DATE(donated_at)";
            $stmt = $conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result();
            while($row=$res->fetch_assoc()){ $d=$row['d']; if(isset($index[$d])) $series['donated'][$index[$d]]=(int)$row['c']; }
            $stmt->close();
            // Discarded per day (expired while still active)
            $sql = "SELECT food_expiry_date d, COUNT(*) c FROM fooditems WHERE user_id=? AND food_status='active' AND food_expiry_date BETWEEN ? AND ? AND food_expiry_date <= CURDATE() GROUP BY food_expiry_date";
            $stmt = $conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result();
            while($row=$res->fetch_assoc()){ $d=$row['d']; if(isset($index[$d])) $series['discarded'][$index[$d]]=(int)$row['c']; }
            $stmt->close();

            echo json_encode(['labels'=>$labels,'series'=>$series], JSON_PRETTY_PRINT); exit;
        }
        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        // Build day buckets between from..to (inclusive)
        $fromTs = $from ? strtotime($from . ' 00:00:00') : null;
        $toTs = $to ? strtotime($to . ' 23:59:59') : null;
        if ($fromTs === null || $toTs === null) {
            http_response_code(400);
            echo json_encode(["error" => "from/to required (yyyy-mm-dd)"], JSON_PRETTY_PRINT);
            exit;
        }
        $labels = [];
        $cursor = strtotime(date('Y-m-d', $fromTs));
        $end = strtotime(date('Y-m-d', $toTs));
        while ($cursor <= $end) {
            $labels[] = date('Y-m-d', $cursor);
            $cursor = strtotime('+1 day', $cursor);
        }
        $series = [
            'used' => array_fill(0, count($labels), 0),
            'donated' => array_fill(0, count($labels), 0),
            'discarded' => array_fill(0, count($labels), 0)
        ];
        $indexMap = array_flip($labels);
        $events = readEvents($eventsFile);
        foreach ($events as $e) {
            $d = date('Y-m-d', strtotime($e['timestamp']));
            if (!isset($indexMap[$d])) continue;
            $idx = $indexMap[$d];
            $t = $e['actionType'];
            if (isset($series[$t])) $series[$t][$idx] += (int)$e['quantity'];
        }
        echo json_encode(['labels' => $labels, 'series' => $series], JSON_PRETTY_PRINT);
        exit;
    }

    if ($action === 'category_breakdown') {
        if ($source === 'db') {
            require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . 'connect.php';
            $userId = (int)($_GET['user_id'] ?? 0);
            $from = $_GET['from'] ?? null; $to = $_GET['to'] ?? null;
            $cats = [];
            // Build categories from enum we know
            $categories = ['Dairy','Vegetable','Bakery','Grains','Meat','Fruits'];
            foreach($categories as $c){ $cats[$c] = ['used'=>0,'donated'=>0,'discarded'=>0]; }

            // Used by category
            $sql = "SELECT food_category, COUNT(*) c FROM fooditems WHERE user_id=? AND completed_at IS NOT NULL AND DATE(completed_at) BETWEEN ? AND ? GROUP BY food_category";
            $stmt=$conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result(); while($row=$res->fetch_assoc()){ $cats[$row['food_category']]['used']=(int)$row['c']; }
            $stmt->close();
            // Donated by category
            $sql = "SELECT food_category, COUNT(*) c FROM fooditems WHERE user_id=? AND donated_at IS NOT NULL AND DATE(donated_at) BETWEEN ? AND ? GROUP BY food_category";
            $stmt=$conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result(); while($row=$res->fetch_assoc()){ $cats[$row['food_category']]['donated']=(int)$row['c']; }
            $stmt->close();
            // Discarded by category (expired while active)
            $sql = "SELECT food_category, COUNT(*) c FROM fooditems WHERE user_id=? AND food_status='active' AND food_expiry_date BETWEEN ? AND ? AND food_expiry_date <= CURDATE() GROUP BY food_category";
            $stmt=$conn->prepare($sql); $stmt->bind_param('iss',$userId,$from,$to); $stmt->execute(); $res=$stmt->get_result(); while($row=$res->fetch_assoc()){ $cats[$row['food_category']]['discarded']=(int)$row['c']; }
            $stmt->close();

            echo json_encode(['categories'=>$cats], JSON_PRETTY_PRINT); exit;
        }
        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        $fromTs = $from ? strtotime($from . ' 00:00:00') : null;
        $toTs = $to ? strtotime($to . ' 23:59:59') : null;
        $events = readEvents($eventsFile);
        $cats = [];
        foreach ($events as $e) {
            $ts = strtotime($e['timestamp']);
            if (!withinRange($ts, $fromTs, $toTs)) continue;
            $cat = $e['category'];
            if (!isset($cats[$cat])) $cats[$cat] = ['used' => 0, 'donated' => 0, 'discarded' => 0];
            $cats[$cat][$e['actionType']] += (int)$e['quantity'];
        }
        echo json_encode(['categories' => $cats], JSON_PRETTY_PRINT);
        exit;
    }

    http_response_code(400);
    echo json_encode(["error" => "Unknown action or method"], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'detail' => $e->getMessage()], JSON_PRETTY_PRINT);
}

?>

