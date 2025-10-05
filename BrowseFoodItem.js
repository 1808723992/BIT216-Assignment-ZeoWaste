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

  // 弹窗控制
  const modal = document.getElementById("foodModal");
  const closeModalBtn = document.getElementById("closeModal");
  const viewButtons = document.querySelectorAll(".btn-primary");

  viewButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".food-card");
      const title = card.querySelector("h3").textContent;
      const qty = card.querySelector("p:nth-of-type(1)").textContent.replace("Qty: ", "");
      const storage = card.querySelector("p:nth-of-type(2)").textContent.replace("Storage: ", "");
      const exp = card.querySelector(".expiry").textContent;
      const category = card.dataset.category;

      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalCategory").textContent = category;
      document.getElementById("modalStorageType").textContent = storage;
      document.getElementById("modalExpiry").textContent = exp;
      document.getElementById("modalQty").textContent = qty;
      document.getElementById("modalStorage").textContent = storage;

      modal.style.display = "flex";
    });
  });

  closeModalBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
});
