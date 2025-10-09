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
          console.error("❌ 后端返回的不是数组:", data);
          foodGrid.innerHTML = `<p style="color:red;">❌ Invalid data format.</p>`;
          return;
        }
        foodGrid.innerHTML = "";
        data.forEach(item => {
          const card = document.createElement("div");
          card.className = "food-card";
          card.dataset.category = item.category;
          card.setAttribute("data-expiry", item.expiry_date);

          const expiryClass =
            item.status === "soon" ? "expiry-tag soon" :
            item.status === "donation" ? "expiry-tag donation" :
            "expiry-tag fresh";

          card.innerHTML = `
            <button class="bookmark-btn ${item.bookmarked == 1 ? 'active' : ''}">
              ${item.bookmarked == 1 ? '★' : '☆'}
            </button>
            <div class="food-icon ${item.category.toLowerCase()}"></div>
            <p class="category">${item.category}</p>
            <h3>${item.name}</h3>
            <p>Qty: ${item.quantity}</p>
            <p>Storage: ${item.storage}</p>
            <p>Exp: ${item.expiry_date}</p>
            <span class="${expiryClass}">
              ${item.status === "soon" ? "Expires Soon" :
                item.status === "donation" ? "Donation" : "Fresh"}
            </span>
            <button class="btn-primary">View Details</button>
          `;
          foodGrid.appendChild(card);
        });

        // ✅ 加载完再绑定事件
        attachCardEvents();
    })
    .catch(err => {
        console.error("加载食物数据失败:", err);
        foodGrid.innerHTML = `<p style="color:red;">❌ Failed to load food items.</p>`;
    });
});

// ✅ 函数必须定义在最外层
function attachCardEvents() {
  // 收藏按钮切换
  document.querySelectorAll(".bookmark-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      btn.textContent = btn.classList.contains("active") ? "★" : "☆";
    });
  });

  // 清空筛选
  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.querySelectorAll("select, input[type='checkbox']").forEach(el => {
        if (el.type === "checkbox") el.checked = false;
        else el.selectedIndex = 0;
      });
      const searchBox = document.getElementById("searchBox");
      if (searchBox) searchBox.value = "";
    });
  }

  // 弹窗控制
  const modal = document.getElementById("foodModal");
  const closeModalBtn = document.getElementById("closeModal");

  document.querySelectorAll(".btn-primary").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const card = e.target.closest(".food-card");
      const title = card.querySelector("h3").textContent;
      const qty = card.querySelector("p:nth-of-type(1)").textContent.replace("Qty: ", "");
      const storage = card.querySelector("p:nth-of-type(2)").textContent.replace("Storage: ", "");
      const exp = card.querySelector("p:nth-of-type(3)").textContent.replace("Exp: ", "");
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

  // 到期排序
  const expirySort = document.getElementById("expirySort");
  if (expirySort) {
    expirySort.addEventListener("change", function () {
      const value = this.value;
      const container = document.querySelector(".food-grid");
      const cards = Array.from(container.children);
      cards.sort((a, b) => {
        const dateA = new Date(a.getAttribute("data-expiry"));
        const dateB = new Date(b.getAttribute("data-expiry"));
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return value === "soonest" ? dateA - dateB : dateB - dateA;
      });
      container.innerHTML = "";
      cards.forEach(card => container.appendChild(card));
    });
  }
}

