function navigate(page) {
  window.location.href = page;
}
// Toggle App Launcher
document.addEventListener("DOMContentLoaded", () => {
  const appBtn = document.getElementById("appLauncherBtn");
  const appDropdown = document.getElementById("appDropdown");

  appBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    appDropdown.style.display = appDropdown.style.display === "block" ? "none" : "block";
  });

  // 点击其他地方关闭
  document.addEventListener("click", () => {
    appDropdown.style.display = "none";
  });
});
