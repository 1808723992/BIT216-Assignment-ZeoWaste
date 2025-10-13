// ============ ZeoWaste 自动导航加载器 ============

(function () {
  // 创建导航容器
  const placeholder = document.createElement("div");
  placeholder.id = "nav-placeholder";
  document.body.insertBefore(placeholder, document.body.firstChild);

  // 自动加载 nav.html
  fetch("nav.html")
    .then(res => {
      if (!res.ok) throw new Error("无法加载 nav.html");
      return res.text();
    })
    .then(html => {
      placeholder.innerHTML = html;

      // 自动加载 nav.css
      if (!document.querySelector('link[href="nav.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "nav.css";
        document.head.appendChild(link);
      }

      console.log("✅ ZeoWaste 导航栏加载成功");
      waitForNavElements(); // 初始化绑定
    })
    .catch(err => console.error("❌ 导航加载失败:", err));

  // 循环等待直到元素出现
  function waitForNavElements(retry = 0) {
    const appBtn = document.getElementById("appLauncherBtn");
    const appDropdown = document.getElementById("appDropdown");

    if (appBtn && appDropdown) {
      bindNavEvents(appBtn, appDropdown);
      console.log("✅ ZeoWaste App Launcher 事件已绑定完成");
    } else if (retry < 20) {
      console.warn(`⚠️ App launcher 元素未找到，延迟重试(${retry + 1})...`);
      setTimeout(() => waitForNavElements(retry + 1), 250);
    } else {
      console.error("❌ 超过重试次数，App launcher 未找到。");
    }
  }
  
  function bindNavEvents(appBtn, appDropdown) {
  const profileBtn = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");

  // --- 打开 Apps Launcher ---
  appBtn.addEventListener("click", e => {
    e.stopPropagation();
    // 关闭另一个菜单
    if (profileDropdown) profileDropdown.style.display = "none";
    appDropdown.style.display =
      appDropdown.style.display === "block" ? "none" : "block";
  });

  // --- 打开 Profile Menu ---
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", e => {
      e.stopPropagation();
      if (appDropdown) appDropdown.style.display = "none";
      profileDropdown.style.display =
        profileDropdown.style.display === "block" ? "none" : "block";
    });
  }

  // --- 点击页面空白处自动关闭 ---
  document.addEventListener("click", e => {
    if (!e.target.closest(".app-launcher") && !e.target.closest(".profile-menu")) {
      appDropdown.style.display = "none";
      if (profileDropdown) profileDropdown.style.display = "none";
    }
  });

  appDropdown.addEventListener("click", e => e.stopPropagation());
  if (profileDropdown) profileDropdown.addEventListener("click", e => e.stopPropagation());
}


 

})();
