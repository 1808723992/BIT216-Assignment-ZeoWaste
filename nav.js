document.addEventListener("DOMContentLoaded", () => {
  const appBtn = document.getElementById("appLauncherBtn");
  const appDropdown = document.getElementById("appDropdown");
  const profileMenu = document.querySelector(".profile-menu .dropdown");

  if (appBtn && appDropdown) {
    appBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      // 关闭 profile 菜单（防止两个同时开）
      if (profileMenu) profileMenu.style.display = "none";

      // 切换 App Launcher 菜单
      appDropdown.style.display =
        appDropdown.style.display === "block" ? "none" : "block";
    });

    // 点击空白处关闭 App Launcher
    document.addEventListener("click", (e) => {
      const isInsideAppLauncher = e.target.closest(".app-launcher");
      if (!isInsideAppLauncher) {
        appDropdown.style.display = "none";
      }
    });

    // 防止点击菜单内部时被关闭
    appDropdown.addEventListener("click", (e) => e.stopPropagation());
  }

  // ✅ Profile 菜单 hover 控制保留（CSS 已自动处理）
});
