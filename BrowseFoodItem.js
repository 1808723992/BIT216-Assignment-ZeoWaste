document.addEventListener("DOMContentLoaded", () => {
  const foodGrid = document.querySelector(".food-grid");

  fetch("FetchFoodItem.php")
    .then(res => {
      if (!res.ok) throw new Error("HTTP error! Status: " + res.status);
      return res.json();
    })
    .then(data => {
      console.log("✅ 从PHP获取到的数据:", data);

      if (!Array.isArray(data)) {
        foodGrid.innerHTML = `<p style="color:red;">❌ Invalid data format.</p>`;
        return;
      }

      foodGrid.innerHTML = "";
      data.forEach(item => {
        const expiryClass =
          item.status === "soon" ? "expiry-tag soon" :
          item.status === "expired" ? "expiry-tag expired" :
          "expiry-tag fresh";

        const card = document.createElement("div");
        card.className = "food-card";
        card.dataset.id = item.id;

        card.innerHTML = `
          <button class="bookmark-btn ${item.bookmarked == 1 ? 'active' : ''}">
            ${item.bookmarked == 1 ? '★' : '☆'}
          </button>
          <div class="food-icon ${item.food_category.toLowerCase()}"></div>
          <p class="category">${item.food_category}</p>
          <h3>${item.food_name}</h3>
          <p>Qty: ${item.food_quantity}</p>
          <p>Storage: ${item.food_storage}</p>
          <p>Exp: ${item.food_expiry_date}</p>
          <span class="${expiryClass}">
            ${item.status === "soon" ? "Expires Soon" :
              item.status === "expired" ? "Expired" : "Fresh"}
          </span>
          <button class="btn-primary">View Details</button>
        `;
        foodGrid.appendChild(card);
      });

      attachCardEvents(); // ✅ 调用收藏事件函数
    })
    .catch(err => {
      console.error("加载食物数据失败:", err);
      foodGrid.innerHTML = `<p style="color:red;">❌ Failed to load food items.</p>`;
    });
});

// ✅ 新增收藏按钮事件函数
function attachCardEvents() {
  document.querySelectorAll(".bookmark-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".food-card");
      const foodId = card.dataset.id;
      const isActive = btn.classList.toggle("active");
      btn.textContent = isActive ? "★" : "☆";

      fetch("ToggleBookmark.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `food_id=${foodId}&action=${isActive ? "add" : "remove"}`
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log(`✅ ${isActive ? "已添加收藏" : "已取消收藏"} (ID: ${foodId})`);
          } else {
            console.error("❌ 数据库操作失败:", data.error);
          }
        })
        .catch(err => console.error("❌ 通信错误:", err));
    });
  });

  // 绑定 “View Details” 弹窗功能
document.querySelectorAll(".food-card .btn-primary").forEach(btn => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".food-card");
    const modal = document.getElementById("foodModal");

    // 从卡片读取数据填充弹窗
    document.getElementById("modalTitle").textContent = card.querySelector("h3").textContent;
    document.getElementById("modalCategory").textContent = card.querySelector(".category").textContent;
    document.getElementById("modalStorageType").textContent = card.querySelector("p:nth-of-type(2)").textContent.replace("Storage: ", "");
    document.getElementById("modalExpiry").textContent = card.querySelector("p:nth-of-type(3)").textContent.replace("Exp: ", "");
    document.getElementById("modalQty").textContent = card.querySelector("p:nth-of-type(1)").textContent.replace("Qty: ", "");

    // 显示弹窗
    modal.style.display = "flex";
  });
});

// 绑定关闭按钮
const closeModal = document.getElementById("closeModal");
if (closeModal) {
  closeModal.addEventListener("click", () => {
    document.getElementById("foodModal").style.display = "none";
  });
}

// 点击背景关闭
const modalOverlay = document.getElementById("foodModal");
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = "none";
    }
  });
}

}
