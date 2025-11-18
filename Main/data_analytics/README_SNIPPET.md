Integration snippets for logging analytics events from your existing pages.

PHP (server-side after an action is saved):

```php
// Example: mark as used
$payload = [
  'actionType' => 'used', // used | donated | discarded
  'itemName' => $itemName,
  'category' => $category,
  'quantity' => (int)$qty,
  'timestamp' => gmdate('c')
];

$ch = curl_init('http://localhost/BT216-Assignment-ZeoWaste/data_analytics/data_analytics.php?action=log_event');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
$res = curl_exec($ch);
curl_close($ch);
```

JavaScript (client-side fetch):

```js
fetch('data_analytics/data_analytics.php?action=log_event',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ actionType:'used', itemName:'Milk', category:'Dairy', quantity:1 })
});
```


