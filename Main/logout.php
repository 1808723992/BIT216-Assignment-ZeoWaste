
<?php
include 'connect.php';

// 启动会话
session_start();

// 清除所有 session 数据
$_SESSION = [];

// 删除 session cookie（如果存在）
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// 销毁 session
session_destroy();

// 重定向到首页
echo "<script>
alert('👋 You have successfully logged out.');
window.location.href = 'Homepage.html';
</script>";
exit();
?>
