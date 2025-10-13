document.addEventListener("DOMContentLoaded", () => {
  const foodGrid = document.querySelector(".food-grid");

  // === Filter elements ===
  const searchBox = document.getElementById("searchBox");
  const categorySelect = document.getElementById("categorySelect");
  const storageSelect = document.getElementById("storageSelect");
  const expirySort = document.getElementById("expirySort");
  const inStock = document.getElementById("inStock");
  const donation = document.getElementById("donation");
  const bookmarked = document.getElementById("bookmarked");
  const clearBtn = document.getElementById("clearBtn");

  const checkboxes = [inStock, donation, bookmarked];
  let allFoodItems = [];

  // ✅ 确保至少选中一个过滤器
  checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      const checkedCount = checkboxes.filter(c => c.checked).length;
      if (checkedCount === 0) {
        cb.checked = true;
        alert("At least one filter must be selected.");
      }
      applyFilters();
    });
  });

  // === 1️⃣ 从 PHP 加载数据 ===
  fetch("FetchFoodItem.php")
    .then(res => res.json())
    .then(data => {
      allFoodItems = data;
      applyFilters(); // ✅ 初次加载直接应用过滤
    })
    .catch(err => {
      console.error("❌ 加载数据失败:", err);
      foodGrid.innerHTML = `<p style="color:red;">Failed to load food items.</p>`;
    });

  // === 2️⃣ 渲染食物卡片 ===
  function renderFoodItems(items) {
    foodGrid.innerHTML = "";

    if (items.length === 0) {
      foodGrid.innerHTML = `<p style="text-align:center; color:#777;">No food items found.</p>`;
      return;
    }

    items.forEach(item => {
      const expiryClass =
        item.status === "soon" ? "expiry-tag soon" :
        item.status === "expired" ? "expiry-tag expired" :
        item.status === "donation" ? "expiry-tag donation" :
        "expiry-tag fresh";

      const card = document.createElement("div");
      card.className = "food-card";
      card.dataset.id = item.id;
      card.dataset.category = item.food_category;
      card.dataset.storage = item.food_storage;
      card.dataset.bookmarked = item.bookmarked;
      card.dataset.status = item.status;

      card.innerHTML = `
        <button class="bookmark-btn ${item.bookmarked == 1 ? "active" : ""}">
          ${item.bookmarked == 1 ? "★" : "☆"}
        </button>
        <div class="food-icon ${item.food_category.toLowerCase()}"></div>
        <p class="category">${item.food_category}</p>
        <h3>${item.food_name}</h3>
        <p>Qty: ${item.food_quantity}</p>
        <p>Storage: ${item.food_storage}</p>
        <p>Exp: ${item.food_expiry_date}</p>
        <span class="${expiryClass}">
          ${
            item.status === "soon"
              ? "Expires Soon"
              : item.status === "expired"
              ? "Expired"
              : item.status === "donation"
              ? "Donation"
              : "Fresh"
          }
        </span>
        <button class="btn-primary">View Details</button>
      `;
      foodGrid.appendChild(card);
    });

    attachCardEvents();
  }

  // === 3️⃣ 卡片交互事件 ===
  function attachCardEvents() {
    // 收藏按钮切换
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
            if (!data.success) console.error("❌ 数据库操作失败:", data.error);
          });
      });
    });

    // View Details 弹窗
    document.querySelectorAll(".food-card .btn-primary").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".food-card");
        const modal = document.getElementById("foodModal");

        document.getElementById("modalTitle").textContent =
          card.querySelector("h3").textContent;
        document.getElementById("modalCategory").textContent =
          card.querySelector(".category").textContent;
        document.getElementById("modalStorageType").textContent =
          card.querySelector("p:nth-of-type(2)").textContent.replace("Storage: ", "");
        document.getElementById("modalExpiry").textContent =
          card.querySelector("p:nth-of-type(3)").textContent.replace("Exp: ", "");
        document.getElementById("modalQty").textContent =
          card.querySelector("p:nth-of-type(1)").textContent.replace("Qty: ", "");
        document.getElementById("modalStorage").textContent =
          card.querySelector("p:nth-of-type(2)").textContent.replace("Storage: ", "");

        modal.style.display = "flex";
      });
    });

    // 关闭弹窗
    const closeModal = document.getElementById("closeModal");
    if (closeModal) {
      closeModal.addEventListener("click", () => {
        document.getElementById("foodModal").style.display = "none";
      });
    }

    const modalOverlay = document.getElementById("foodModal");
    if (modalOverlay) {
      modalOverlay.addEventListener("click", e => {
        if (e.target === modalOverlay) {
          modalOverlay.style.display = "none";
        }
      });
    }
  }

  // === 4️⃣ 过滤逻辑 ===
  function applyFilters() {
    let filtered = [...allFoodItems];

    // 搜索
    const keyword = searchBox.value.trim().toLowerCase();
    if (keyword) {
      filtered = filtered.filter(f =>
        f.food_name.toLowerCase().includes(keyword)
      );
    }

    // 分类
    const category = categorySelect.value;
    if (category !== "All Categories") {
      filtered = filtered.filter(f => f.food_category === category);
    }

    // 存储方式
    const storage = storageSelect.value;
    if (storage !== "All Storage") {
      filtered = filtered.filter(f => f.food_storage === storage);
    }

    // Bookmarked
    if (bookmarked.checked) {
      filtered = filtered.filter(f => f.bookmarked == 1);
    }

    // In Stock（数量>0）
    if (inStock.checked) {
      filtered = filtered.filter(f => parseInt(f.food_quantity) > 0);
    }

    // Donation（状态为donation）
    if (donation.checked) {
      filtered = filtered.filter(f => f.status === "donation");
    }
    

    // Expiry 筛选 + 排序
    if (expirySort.value === "soonest") {
      filtered.sort((a, b) =>
        new Date(a.food_expiry_date) - new Date(b.food_expiry_date)
      );
    } else if (expirySort.value === "latest") {
      filtered.sort((a, b) =>
        new Date(b.food_expiry_date) - new Date(a.food_expiry_date)
      );
    } else if (expirySort.value === "Expiry Items") {
      // ✅ 只显示过期的食物
      filtered = filtered.filter(f => f.status === "expired");
    }
    
    renderFoodItems(filtered);
  }

  // === 5️⃣ 绑定筛选交互 ===
  [searchBox, categorySelect, storageSelect, expirySort].forEach(el =>
    el.addEventListener("input", applyFilters)
  );
  [inStock, donation, bookmarked].forEach(el =>
    el.addEventListener("change", applyFilters)
  );

  // 清空按钮
  clearBtn.addEventListener("click", () => {
    searchBox.value = "";
    categorySelect.value = "All Categories";
    storageSelect.value = "All Storage";
    expirySort.value = "soonest";
    inStock.checked = true;
    donation.checked = false;
    bookmarked.checked = false;
    renderFoodItems(allFoodItems);
  });
});
