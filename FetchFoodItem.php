<?php
include 'Connect.php';
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

$user_id = 1; // 测试阶段固定用户ID

// ✅ 查询 fooditems 并检查是否被收藏
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
    ON f.food_id = b.food_id AND b.user_id = $user_id
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
    $days_left = (int)$interval->format('%r%a'); // 可为负数（过期）

    // ✅ 状态判断
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

// ✅ 输出 JSON
echo json_encode($data);
$conn->close();
?>
