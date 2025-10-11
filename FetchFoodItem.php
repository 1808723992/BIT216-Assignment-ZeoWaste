<?php
include 'Connect.php';
header('Content-Type: application/json; charset=utf-8');

$user_id = 1; // 测试阶段用固定用户ID

$sql = "
  SELECT f.id, f.food_name, f.food_category, f.food_quantity, 
         f.food_storage, f.food_expiry_date,
         CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS bookmarked
  FROM food_items f
  LEFT JOIN bookmarked_foods b ON f.id = b.food_id AND b.user_id = $user_id
  ORDER BY f.food_expiry_date ASC
";

$result = $conn->query($sql);
$data = [];

if ($result && $result->num_rows > 0) {
  while ($row = $result->fetch_assoc()) {

    // ✅ 计算剩余天数
    $expiry_date = new DateTime($row["food_expiry_date"]);
    $today = new DateTime();
    $interval = $today->diff($expiry_date);
    $days_left = (int)$interval->format('%r%a'); // 可能是负数（已过期）

    // ✅ 自动判断状态
    if ($days_left < 0) {
        $status = "expired";
    } elseif ($days_left <= 7) {
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
      "bookmarked" => (int)$row["bookmarked"]
    ];
  }
}

echo json_encode($data);
$conn->close();
?>

