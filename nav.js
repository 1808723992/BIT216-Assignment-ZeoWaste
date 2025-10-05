// nav.js
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("appLauncherBtn");
  const dropdown = document.getElementById("appDropdown");

  if (btn && dropdown) {
    // 点击图标切换菜单显示
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // 防止冒泡导致立即关闭
      dropdown.style.display =
        dropdown.style.display === "block" ? "none" : "block";
    });

    // 点击页面空白处时关闭菜单
    document.addEventListener("click", () => {
      dropdown.style.display = "none";
    });

    // 阻止点击菜单本身时关闭
    dropdown.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});
