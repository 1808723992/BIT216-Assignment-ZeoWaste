<?php
include 'Connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["ok"=>false, "error"=>"UNAUTHORIZED"]);
    exit;
}
$user_id = (int)$_SESSION['user_id'];

// ✅ 仅查询当前用户的 fooditems，并检查是否被其本人收藏
$sql = "
  SELECT 
    f.food_id AS id,
    f.food_name,
    f.food_category,
    f.food_storage,
    f.food_quantity,
    f.food_expiry_date,
    f.food_status,
    CASE 
      WHEN b.food_id IS NOT NULL AND b.status = 'active' THEN 1 
      ELSE 0 
    END AS bookmarked
  FROM fooditems f
  LEFT JOIN bookmarked_foods b 
    ON f.food_id = b.food_id AND b.user_id = ?
  WHERE f.user_id = ?
  ORDER BY f.food_expiry_date ASC
";

$stmt = $conn->prepare($sql);
$stmt->bind_param('ii', $user_id, $user_id);
$stmt->execute();
$result = $stmt->get_result();
$data = [];

if ($result && $result->num_rows > 0) {
  while ($row = $result->fetch_assoc()) {
    $expiry_date = new DateTime($row["food_expiry_date"]);
    $today = new DateTime();
    $interval = $today->diff($expiry_date);
    $days_left = (int)$interval->format('%r%a');

    // 独立的捐赠标记，不影响到期状态显示
    $is_donation = (isset($row["food_status"]) && strtolower($row["food_status"]) === "donated") ? 1 : 0;

    if ($days_left < 0) {
        $status = "expired";
    } elseif ($days_left <= 3) {
        $status = "soon";
    } else {
        $status = "fresh";
    }

    $data[] = [
      "id" => $row["id"],
      "food_name" => $row["food_name"],
      "food_category" => $row["food_category"],
      "food_quantity" => $row["food_quantity"],
      "food_storage" => $row["food_storage"],
      "food_expiry_date" => $row["food_expiry_date"],
      "status" => $status,
      "is_donation" => $is_donation,
      "bookmarked" => (int)$row["bookmarked"]
    ];
  }
}

echo json_encode($data);
$stmt->close();
$conn->close();
?>
