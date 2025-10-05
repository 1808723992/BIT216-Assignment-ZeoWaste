document.addEventListener("DOMContentLoaded", () => {
  // 收藏按钮切换
  document.querySelectorAll(".bookmark-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      btn.textContent = btn.classList.contains("active") ? "★" : "☆";
    });
  });

  // 清空按钮
  document.getElementById("clearBtn").addEventListener("click", () => {
    document.querySelectorAll("select, input[type='checkbox']").forEach(el => {
      if (el.type === "checkbox") el.checked = false;
      else el.selectedIndex = 0;
    });
    document.getElementById("searchBox").value = "";
  });
});
