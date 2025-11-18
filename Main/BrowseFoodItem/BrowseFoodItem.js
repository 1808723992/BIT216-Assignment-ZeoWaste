document.addEventListener("DOMContentLoaded", () => {
  const foodGrid = document.querySelector(".food-grid");

  // === Filter elements ===
  const searchBox = document.getElementById("searchBox");
  const categorySelect = document.getElementById("categorySelect");
  const storageSelect = document.getElementById("storageSelect");
  const expirySort = document.getElementById("expirySort");
  const inStock = document.getElementById("inStock");
  const bookmarked = document.getElementById("bookmarked");
  const clearBtn = document.getElementById("clearBtn");

  const checkboxes = [inStock, bookmarked];
  let allFoodItems = [];
  let currentFoodId = null; // 当前在弹窗中查看/操作的食物ID

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
  fetch("/BIT216-Assignment-ZeoWaste/Main/FetchFoodItem.php")
    .then(res => res.json())
    .then(data => {
      allFoodItems = data;
      applyFilters(); // ✅ 初次加载直接应用过滤
    })
    .catch(err => {
      console.error("❌ 加载数据失败:", err);
      foodGrid.innerHTML = `<p style="color:red;">Failed to load food items.</p>`;
    });

  // 简单的刷新函数，在变更后重新拉取数据并应用当前筛选
  function reloadData() {
    fetch("/BIT216-Assignment-ZeoWaste/Main/FetchFoodItem.php")
      .then(res => {
        if (res.status === 401) {
          window.location.href = "/BIT216-Assignment-ZeoWaste/Main/sign_in.html";
          return Promise.reject(new Error('UNAUTHORIZED'));
        }
        return res.json();
      })
      .then(data => {
        allFoodItems = data;
        applyFilters();
      })
      .catch(err => console.error("❌ 刷新失败:", err));
  }

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
        <div class="tag-row">
          <span class="${expiryClass}">
            ${
              item.status === "soon"
                ? "Expires Soon"
                : item.status === "expired"
                ? "Expired"
                : "Fresh"
            }
          </span>
          ${item.is_donation == 1 ? '<span class="expiry-tag donation">Donation</span>' : ''}
        </div>
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

        fetch("/BIT216-Assignment-ZeoWaste/Main/ToggleBookmark.php", {
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

    // View Details 弹窗 + 在弹窗中操作
    document.querySelectorAll(".food-card .btn-primary").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".food-card");
        currentFoodId = card.dataset.id;
        const modal = document.getElementById("foodModal");

        // donation 物品不允许直接查看详情，提示先移出 donation
        if (card.dataset.status === 'donation' || card.querySelector('.expiry-tag.donation')) {
          const confirmWithdraw = confirm('This item is currently in the Donation list. Withdraw it from donation to manage it here?');
          if (confirmWithdraw) {
            fetch('/BIT216-Assignment-ZeoWaste/Main/WithdrawDonation.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `id=${encodeURIComponent(currentFoodId)}`
            })
            .then(res => res.json())
            .then(data => {
              if (!data.success) {
                alert('Failed to withdraw from donation.');
              } else {
                reloadData();
                alert('Withdrawn from donation. You can now manage the item.');
              }
            });
          }
          return; // 阻止打开详情
        }

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

        // 绑定弹窗按钮（覆盖式绑定，避免重复叠加）
        const usedBtn = document.querySelector(".modal-buttons .used");
        const mealBtn = document.querySelector(".modal-buttons .meal");
        const donateBtn = document.querySelector(".modal-buttons .donate");

        if (usedBtn) {
          usedBtn.onclick = () => {
            const input = prompt("Enter quantity used:", "1");
            const used = Number(input);
            if (!Number.isFinite(used) || used <= 0) {
              alert("Invalid quantity.");
              return;
            }
            fetch("/BIT216-Assignment-ZeoWaste/Main/MarkUsed.php", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `id=${encodeURIComponent(currentFoodId)}&used=${encodeURIComponent(used)}`
            })
              .then(res => res.json())
              .then(data => {
                if (!data.success) {
                  console.error("❌ Mark used failed:", data.error);
                  alert("Operation failed.");
                } else {
                  modal.style.display = "none";
                  reloadData();
                }
              })
              .catch(() => alert("Operation failed."));
          };
        }

        if (mealBtn) {
          mealBtn.onclick = () => {
            // 获取当前食材信息
            const currentFood = allFoodItems.find(f => f.id == currentFoodId);
            if (!currentFood) {
              alert("Food item not found.");
              return;
            }
            
            // 关闭食物详情弹窗
            modal.style.display = "none";
            
            // 打开食谱创建弹窗并预填充当前食材
            openRecipeModal(currentFood);
          };
        }

        if (donateBtn) {
          donateBtn.onclick = () => {
            const pickup_location = prompt("Pickup Location:", "");
            if (pickup_location === null || pickup_location.trim() === "") {
              alert("Pickup location is required.");
              return;
            }
            const availability = prompt("Availability (e.g. 10 AM – 5 PM):", "");
            if (availability === null || availability.trim() === "") {
              alert("Availability is required.");
              return;
            }
            const notes = prompt("Notes (optional):", "") || "";

            const body = `id=${encodeURIComponent(currentFoodId)}&pickup_location=${encodeURIComponent(pickup_location.trim())}&availability=${encodeURIComponent(availability.trim())}&notes=${encodeURIComponent(notes.trim())}`;
            fetch("/BIT216-Assignment-ZeoWaste/Main/ConvertDonation.php", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body
            })
              .then(res => res.json())
              .then(data => {
                if (!data.success) {
                  console.error("❌ Convert donation failed:", data.error);
                  alert("Operation failed.");
                } else {
                  modal.style.display = "none";
                  reloadData();
                }
              })
              .catch(() => alert("Operation failed."));
          };
        }

        modal.style.display = "flex";
      });
    });

    // 去掉卡片上的按钮操作，改为在弹窗中执行

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

  // applyFilters
  function applyFilters() {
    let filtered = [...allFoodItems];

    // search
    const keyword = searchBox.value.trim().toLowerCase();
    if (keyword) {
      filtered = filtered.filter(f =>
        f.food_name.toLowerCase().includes(keyword)
      );
    }

    // category
    const category = categorySelect.value;
    if (category !== "All Categories") {
      filtered = filtered.filter(f => f.food_category === category);
    }

    // storage
    const storage = storageSelect.value;
    if (storage !== "All Storage") {
      filtered = filtered.filter(f => f.food_storage === storage);
    }

    // Bookmarked
    if (bookmarked.checked) {
      filtered = filtered.filter(f => f.bookmarked == 1);
    }

    // In Stock
    if (inStock.checked) {
      filtered = filtered.filter(f => parseInt(f.food_quantity) > 0);
    }

    // Donation
    filtered = filtered.filter(f => f.is_completed != 1);
    

    // Expiry 
    if (expirySort.value === "soonest") {
      filtered.sort((a, b) =>
        new Date(a.food_expiry_date) - new Date(b.food_expiry_date)
      );
    } else if (expirySort.value === "latest") {
      filtered.sort((a, b) =>
        new Date(b.food_expiry_date) - new Date(a.food_expiry_date)
      );
    } else if (expirySort.value === "Expiry Items") {
      // 
      filtered = filtered.filter(f => f.status === "expired");
    }
    
    renderFoodItems(filtered);
  }

  // === 5️⃣ 绑定筛选交互 ===
  [searchBox, categorySelect, storageSelect, expirySort].forEach(el =>
    el.addEventListener("input", applyFilters)
  );
  [inStock, bookmarked].forEach(el =>
    el.addEventListener("change", applyFilters)
  );

  // 清空按钮
  clearBtn.addEventListener("click", () => {
    searchBox.value = "";
    categorySelect.value = "All Categories";
    storageSelect.value = "All Storage";
    expirySort.value = "soonest";
    inStock.checked = true;
    bookmarked.checked = false;
    renderFoodItems(allFoodItems);
  });

  // ===== 食谱创建弹窗功能 =====
  const recipeModal = document.getElementById("recipeModal");
  const closeRecipeModal = document.getElementById("closeRecipeModal");
  const addIngredientBtn = document.getElementById("addIngredientBtn");
  const ingredientLines = document.getElementById("ingredientLines");
  const cancelRecipeBtn = document.getElementById("cancelRecipeBtn");
  const submitRecipeBtn = document.getElementById("submitRecipeBtn");

  // 打开食谱创建弹窗并预填充当前食材
  function openRecipeModal(currentFood) {
    // 清空表单
    document.getElementById("recipeName").value = "";
    document.getElementById("recipeCategory").value = "LUNCH";
    document.getElementById("recipeInstructions").value = "";
    document.getElementById("recipeCalories").value = "";
    document.getElementById("recipeProtein").value = "";
    document.getElementById("recipeFat").value = "";
    document.getElementById("recipeCarbs").value = "";
    ingredientLines.innerHTML = "";

    // 添加当前食材作为第一个食材
    addIngredientLine(currentFood.food_name, currentFood.food_quantity, currentFood.id);

    // 显示弹窗
    recipeModal.style.display = "flex";
  }

  // 添加食材行
  function addIngredientLine(name = "", amount = "", foodId = null) {
    const line = document.createElement("div");
    line.className = "ingredient-line";
    line.innerHTML = `
      <input type="text" class="recipe-input ingredient-name" placeholder="Ingredient name" value="${name}" ${foodId ? 'data-food-id="' + foodId + '"' : ''}>
      <input type="text" class="recipe-input small ingredient-amount" placeholder="Amount" value="${amount}">
      <button type="button" class="btn-remove-ingredient" title="Remove">×</button>
    `;
    ingredientLines.appendChild(line);

    // 绑定删除按钮
    const removeBtn = line.querySelector(".btn-remove-ingredient");
    removeBtn.addEventListener("click", () => {
      line.remove();
    });
  }

  // 添加食材按钮事件
  if (addIngredientBtn) {
    addIngredientBtn.addEventListener("click", () => {
      addIngredientLine();
    });
  }

  // 关闭食谱弹窗
  function closeRecipeModalFunc() {
    recipeModal.style.display = "none";
  }

  if (closeRecipeModal) {
    closeRecipeModal.addEventListener("click", closeRecipeModalFunc);
  }

  if (cancelRecipeBtn) {
    cancelRecipeBtn.addEventListener("click", closeRecipeModalFunc);
  }

  // 点击背景关闭弹窗
  if (recipeModal) {
    recipeModal.addEventListener("click", (e) => {
      if (e.target === recipeModal) {
        closeRecipeModalFunc();
      }
    });
  }

  // 提交食谱
  if (submitRecipeBtn) {
    submitRecipeBtn.addEventListener("click", async () => {
      const name = document.getElementById("recipeName").value.trim();
      if (!name) {
        alert("Please enter recipe name.");
        return;
      }

      const category = document.getElementById("recipeCategory").value;
      const instructions = document.getElementById("recipeInstructions").value.trim() || null;

      // 收集食材
      const ingredientElements = ingredientLines.querySelectorAll(".ingredient-line");
      const ingredients = [];
      const foodIds = [];

      ingredientElements.forEach((line, index) => {
        const nameInput = line.querySelector(".ingredient-name");
        const amountInput = line.querySelector(".ingredient-amount");
        const foodId = nameInput.dataset.foodId;

        const ingName = nameInput.value.trim();
        const ingAmount = amountInput.value.trim();

        if (ingName) {
          ingredients.push({
            name: ingName,
            amount: ingAmount || "",
            pos: index + 1
          });

          if (foodId) {
            foodIds.push(parseInt(foodId));
          }
        }
      });

      if (ingredients.length === 0) {
        alert("Please add at least one ingredient.");
        return;
      }

      // 收集营养信息
      const nutrition = {};
      const calories = document.getElementById("recipeCalories").value.trim();
      const protein = document.getElementById("recipeProtein").value.trim();
      const fat = document.getElementById("recipeFat").value.trim();
      const carbs = document.getElementById("recipeCarbs").value.trim();

      if (calories) nutrition.calories = calories;
      if (protein) nutrition.protein_g = protein;
      if (fat) nutrition.fat_g = fat;
      if (carbs) nutrition.carbs_g = carbs;

      // 准备提交数据
      const payload = {
        name: name,
        category: category,
        instructions: instructions,
        ingredients: ingredients,
        food_ids: foodIds.length > 0 ? foodIds : null
      };

      if (Object.keys(nutrition).length > 0) {
        payload.nutrition = nutrition;
      }

      // 禁用提交按钮
      submitRecipeBtn.disabled = true;
      submitRecipeBtn.textContent = "Creating...";

      try {
        const apiPath = "/BIT216-Assignment-ZeoWaste/Main/WeelyMealPlanner/recipes_api.php";
        const apiUrl = new URL(apiPath, window.location.origin);
        apiUrl.searchParams.set("action", "create_recipe");

        const res = await fetch(apiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.status === 401) {
          alert("Please login first.");
          window.location.href = "/BIT216-Assignment-ZeoWaste/Main/sign_in.html";
          return;
        }

        if (res.status === 404) {
          alert("API file not found.");
          return;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          alert("API error: " + text.substring(0, 100));
          return;
        }

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.data || "Create recipe failed");
        }

        alert("Recipe created successfully!");
        closeRecipeModalFunc();
      } catch (error) {
        alert("Error: " + error.message);
      } finally {
        submitRecipeBtn.disabled = false;
        submitRecipeBtn.textContent = "Create Recipe";
      }
    });
  }
});
