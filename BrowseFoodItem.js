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
        const card = document.createElement("div");
        card.className = "food-card";
        card.dataset.id = item.id; // ✅ 添加id
        card.dataset.category = item.food_category;
        card.setAttribute("data-expiry", item.food_expiry_date);

        <span class="${expiryClass}">
        ${item.status === "soon" ? "Expires This Week" :
          item.status === "expired" ? "Expired" : "Fresh"}
        </span>


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
              item.status === "donation" ? "Donation" : "Fresh"}
          </span>
          <button class="btn-primary">View Details</button>
        `;
        foodGrid.appendChild(card);
      });

      attachCardEvents();
    })
    .catch(err => {
      console.error("加载食物数据失败:", err);
      foodGrid.innerHTML = `<p style="color:red;">❌ Failed to load food items.</p>`;
    });
});

function attachCardEvents() {
  // 收藏按钮切换 + 保存到数据库
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
}
