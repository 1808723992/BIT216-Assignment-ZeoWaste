(function(){
	const q = (s, r=document) => r.querySelector(s);
	const qa = (s, r=document) => Array.from(r.querySelectorAll(s));

	// 获取API基础路径（相对于脚本所在目录）
	function getApiPath(filename) {
		// 方法1: 尝试从脚本标签获取路径（最可靠）
		const script = document.currentScript || 
			Array.from(document.getElementsByTagName('script')).find(s => 
				(s.src || '').includes('meal_planner.js')
			);
		
		if (script && script.src) {
			const scriptUrl = new URL(script.src, window.location.origin);
			let scriptDir = scriptUrl.pathname;
			// 处理Windows路径分隔符
			scriptDir = scriptDir.replace(/\\/g, '/');
			// 获取目录部分
			scriptDir = scriptDir.substring(0, scriptDir.lastIndexOf('/') + 1);
			const apiPath = scriptDir + filename;
			console.log('[getApiPath] From script:', script.src, '-> API path:', apiPath);
			return apiPath;
		}
		
		// 方法2: 如果脚本路径包含 WeelyMealPlanner，直接使用
		const currentPath = window.location.pathname;
		if (currentPath.includes('WeelyMealPlanner')) {
			const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
			return dir + filename;
		}
		
		// 方法3: 使用固定的相对路径（如果脚本在WeelyMealPlanner目录）
		// 检查当前路径，如果不在WeelyMealPlanner目录，则使用WeelyMealPlanner/前缀
		if (!currentPath.includes('WeelyMealPlanner')) {
			// 如果页面不在WeelyMealPlanner目录，API应该在WeelyMealPlanner目录
			return 'WeelyMealPlanner/' + filename;
		}
		
		// 方法4: 使用当前页面路径（最后备用方案）
		const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
		return currentDir + filename;
	}

	let editingRecipeId = null; // 当前编辑的 recipe_id
	let currentRecipeId = null; // 当前在详情模态框中选择的食谱ID
	let currentRecipeData = null; // 当前模态框中的食谱完整数据
	let currentWeekStart = null; // 当前周的开始日期
let mealPlans = {}; // 当前界面显示的餐食计划
let basePlans = {}; // 从数据库加载的原始计划
const pendingAdds = new Map(); // key -> {recipe_id, meal_date, meal_slot}
const pendingRemovals = new Map(); // key -> {plan_id, meal_date, meal_slot}
let isSaving = false;
let inventoryIndex = {}; // 食材库存索引

	function formatDate(date){
		const y = date.getFullYear();
		const m = String(date.getMonth()+1).padStart(2,'0');
		const d = String(date.getDate()).padStart(2,'0');
		return `${y}-${m}-${d}`;
	}

	function formatPeriod(start){
		const end = new Date(start);
		end.setDate(end.getDate()+6);
		const fmt = (dt) => `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}`;
		return `${fmt(start)} – ${fmt(end)}`;
	}

	function getMonday(date){
		const d = new Date(date);
		const day = d.getDay();
		const diff = (day === 0 ? -6 : 1 - day);
		d.setDate(d.getDate()+diff);
		d.setHours(0,0,0,0);
		return d;
	}

	function getPlanKey(date, slot){
		return `${date}-${slot}`;
	}

function hasUnsavedChanges(){
	return pendingAdds.size > 0 || pendingRemovals.size > 0;
}

	function updateConfirmButtonState(){
		const btn = q('#confirm-plan');
		if(!btn) return;
		let changed = hasUnsavedChanges();
		if(!changed){
			changed = Object.values(mealPlans).some(plan => plan && plan.plan_id === null);
		}
		if(isSaving){
		btn.disabled = true;
		btn.classList.remove('is-disabled');
		btn.classList.add('disabled-force');
			return;
		}
	btn.disabled = !changed;
	btn.classList.toggle('is-disabled', !changed);
	btn.classList.toggle('has-changes', changed);
	btn.classList.remove('disabled-force');
	}

	function resetPendingChanges(){
		pendingAdds.clear();
		pendingRemovals.clear();
		updateConfirmButtonState();
	}

function parseQuantityNumber(value){
	if(value === null || value === undefined) return 0;
	if(typeof value === 'number') return value;
	const str = String(value);
	const match = str.match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
	if(match) return parseFloat(match[1]);
	const digits = str.replace(/[^\d\.]+/g,'');
	return digits ? parseFloat(digits) : 0;
}

function buildInventoryIndex(items){
	inventoryIndex = {};
	if(!Array.isArray(items)) return;
	items.forEach(item => {
		const name = (item.food_name || '').trim();
		if(!name) return;
		const key = name.toLowerCase();
		if(!inventoryIndex[key]){
			inventoryIndex[key] = {
				name,
				totalQty: 0,
				samples: []
			};
		}
		const qtyStr = item.food_quantity ?? '';
		inventoryIndex[key].samples.push(qtyStr);
		inventoryIndex[key].totalQty += parseQuantityNumber(qtyStr);
	});
}

function findInventoryEntry(nameLower){
	if(!nameLower) return null;
	if(inventoryIndex[nameLower]) return inventoryIndex[nameLower];
	for(const key in inventoryIndex){
		if(key.includes(nameLower) || nameLower.includes(key)){
			return inventoryIndex[key];
		}
	}
	return null;
}

// 检查食谱的所有食材是否足够
function checkRecipeIngredientsAvailable(recipe){
	if(!recipe) return { available: false, missing: [] };
	
	// 获取食材列表（优先使用 ingredients_with_stock，否则使用 ingredients）
	let ingredients = [];
	let useStockData = false;
	
	if(Array.isArray(recipe.ingredients_with_stock) && recipe.ingredients_with_stock.length > 0){
		ingredients = recipe.ingredients_with_stock;
		useStockData = true;
	} else if(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0){
		ingredients = recipe.ingredients;
		useStockData = false;
	} else {
		// 如果没有食材信息，允许添加（可能是新创建的食谱）
		return { available: true, missing: [] };
	}
	
	const missing = [];
	
	ingredients.forEach(ing => {
		if(!ing) return;
		const name = (ing.name || ing.ingredient_name || '').trim();
		if(!name) return;
		
		const requiredText = ing.required ?? ing.amount ?? ing.quantity ?? '-';
		const requiredQty = parseQuantityNumber(requiredText);
		
		// 如果不需要数量（为0或空），跳过检查
		if(requiredQty === 0) return;
		
		let hasEnough = false;
		let availableQty = 0;
		
		if(useStockData && ing.status !== undefined){
			// 使用 ingredients_with_stock 中的状态信息
			if(ing.status === 'ok' && ing.available !== null && ing.available !== undefined){
				availableQty = typeof ing.available === 'number' ? ing.available : parseQuantityNumber(ing.available);
				hasEnough = availableQty >= requiredQty;
			} else {
				// status 为 'miss' 或 available 为 null/undefined
				hasEnough = false;
				availableQty = 0;
			}
		} else {
			// 从 inventoryIndex 中查找
			const key = name.toLowerCase();
			const entry = findInventoryEntry(key);
			availableQty = entry ? entry.totalQty : 0;
			hasEnough = entry ? (availableQty >= requiredQty) : false;
		}
		
		if(!hasEnough){
			missing.push({
				name: name,
				required: requiredText || '-',
				available: availableQty.toString(),
				shortage: requiredQty - availableQty
			});
		}
	});
	
	return {
		available: missing.length === 0,
		missing: missing
	};
}

async function loadInventory(){
	try{
		// FetchFoodItem.php 在 Main 根目录，需要从 WeelyMealPlanner 目录向上访问
		const currentPath = window.location.pathname;
		let fetchPath;
		
		// 处理路径：/BIT216-Assignment-ZeoWaste/Main/WeelyMealPlanner/planweeklymeals.php
		// 需要访问：/BIT216-Assignment-ZeoWaste/Main/FetchFoodItem.php
		if (currentPath.includes('/WeelyMealPlanner/')) {
			// 找到 WeelyMealPlanner 的位置，然后向上到 Main 目录
			const weelyIndex = currentPath.indexOf('/WeelyMealPlanner/');
			const baseDir = currentPath.substring(0, weelyIndex + 1); // 包含最后的 /
			fetchPath = baseDir + 'FetchFoodItem.php';
		} else if (currentPath.includes('WeelyMealPlanner')) {
			// 处理没有尾部斜杠的情况
			const weelyIndex = currentPath.indexOf('WeelyMealPlanner');
			const baseDir = currentPath.substring(0, weelyIndex);
			// 确保 baseDir 以 / 结尾
			fetchPath = (baseDir.endsWith('/') ? baseDir : baseDir + '/') + 'FetchFoodItem.php';
		} else {
			// 如果不在子目录，直接访问
			const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
			fetchPath = currentDir + 'FetchFoodItem.php';
		}
		
		const apiUrl = new URL(fetchPath, window.location.origin);
		console.log('[loadInventory] Current path:', currentPath);
		console.log('[loadInventory] Fetching from:', apiUrl.toString());
		
		const res = await fetch(apiUrl.toString());
		if(res.status === 401){
			alert('Please login first');
			window.location.href = '../LoginAndRegistry/sign_in.html';
			return;
		}
		if(!res.ok){
			console.error('[loadInventory] Failed to load inventory:', res.status, res.statusText);
			console.error('[loadInventory] Requested URL:', apiUrl.toString());
			console.error('[loadInventory] Expected: /BIT216-Assignment-ZeoWaste/Main/FetchFoodItem.php');
			return;
		}
		const data = await res.json();
		buildInventoryIndex(Array.isArray(data) ? data : []);
		console.log('[loadInventory] ✅ Inventory loaded, items count:', Array.isArray(data) ? data.length : 0);
	}catch(e){
		console.error('[loadInventory] ❌ Error:', e);
		console.error('[loadInventory] Current path:', window.location.pathname);
	}
}

	function formatMealDate(dateStr){
		if(!dateStr) return '-';
		const d = new Date(dateStr);
		if(Number.isNaN(d.getTime())) return dateStr;
		return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
	}


	async function requestJson(url, options = {}){
		const res = await fetch(url, options);
		
		if(res.status === 404){
			throw new Error('API file not found');
		}
		
		if(res.status === 401){
			alert('Please login first');
			window.location.href = '../LoginAndRegistry/sign_in.html';
			throw new Error('UNAUTHORIZED');
		}
		
		const contentType = res.headers.get('content-type');
		if(!contentType || !contentType.includes('application/json')){
			const text = await res.text();
			throw new Error(text.substring(0, 150));
		}
		
		const data = await res.json();
		if(!data.ok){
			throw new Error(data.data || 'Request failed');
		}
		return data;
	}

	function updateWeek(start){
		currentWeekStart = start;
		const period = q('#period-text');
		if(period){ period.textContent = formatPeriod(start); }
		qa('.date[data-day-offset]').forEach(el => {
			const offset = Number(el.getAttribute('data-day-offset'))||0;
			const d = new Date(start);
			d.setDate(d.getDate()+offset);
			el.textContent = formatDate(d);
		});
		const dateInput = q('#mm-date');
		if(dateInput){ dateInput.value = formatDate(start); }
		// 重新加载周计划
		loadWeekPlans();
	}

	function setupWeekSwitching(){
		let currentStart = getMonday(new Date());
		updateWeek(currentStart);
		const prev = q('#prev-week');
		const next = q('#next-week');
		if(prev){ prev.addEventListener('click', () => { currentStart.setDate(currentStart.getDate()-7); updateWeek(currentStart); }); }
		if(next){ next.addEventListener('click', () => { currentStart.setDate(currentStart.getDate()+7); updateWeek(currentStart); }); }
	}

	// ===== 加载周计划 =====
	async function loadWeekPlans(){
		if(!currentWeekStart) return;
		const weekStartStr = formatDate(currentWeekStart);
		try{
			// 使用相对于脚本的路径
			const apiPath = getApiPath('meal_plans_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'get_week_plans');
			apiUrl.searchParams.set('week_start', weekStartStr);
			
			// 调试信息
			console.log('[loadWeekPlans] API URL:', apiUrl.toString());
			const script = document.currentScript || Array.from(document.getElementsByTagName('script')).find(s => (s.src || '').includes('meal_planner.js'));
			console.log('[loadWeekPlans] Script path:', script?.src || 'N/A');
			console.log('[loadWeekPlans] Current page:', window.location.pathname);
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				console.error('[loadWeekPlans] 404 Error - API file not found at:', apiUrl.toString());
				console.error('[loadWeekPlans] Current page path:', window.location.pathname);
				console.error('[loadWeekPlans] Script element:', script?.src || 'N/A');
				return;
			}
			
			// 检查是否是401未授权错误
			if(res.status === 401){
				alert('Please login first');
				window.location.href = '../LoginAndRegistry/sign_in.html';
				return;
			}
			
			// 检查Content-Type，如果不是JSON，说明返回了HTML错误页面
			const contentType = res.headers.get('content-type');
			if(!contentType || !contentType.includes('application/json')){
				const text = await res.text();
				console.error('API returned non-JSON response:', text.substring(0, 200));
				return;
			}
			
			const data = await res.json();
			if(!data.ok) throw new Error(data.data || 'Load failed');
			
			// 重置状态并存储计划数据
			mealPlans = {};
			basePlans = {};
			resetPendingChanges();
			
			const plans = Array.isArray(data.data) ? data.data : [];
			console.log('[loadWeekPlans] Loaded plans count:', plans.length);
			plans.forEach(plan => {
				if(plan.meal_date && plan.meal_slot && plan.recipe_id){
					const key = getPlanKey(plan.meal_date, plan.meal_slot);
					console.log('[loadWeekPlans] Plan:', plan.recipe_name, 'has ingredients:', !!plan.ingredients, 'has ingredients_with_stock:', !!plan.ingredients_with_stock);
					basePlans[key] = { ...plan };
					mealPlans[key] = { ...plan, status: 'saved' };
				}
			});
			console.log('[loadWeekPlans] basePlans keys:', Object.keys(basePlans));
			
			updateMealPlansDisplay();
			updateConfirmButtonState();
		}catch(e){
			console.error('Failed to load week plans:', e);
		}
	}

	// ===== 更新餐食计划显示 =====
	function updateMealPlansDisplay(){
		if(!currentWeekStart) return;
		
		const mealSlots = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
		const tbody = q('.table tbody');
		if(!tbody) return;
		
		// 获取所有行
		const rows = qa('.table tbody tr');
		if(rows.length === 0) return;
		
		rows.forEach((row, rowIdx) => {
			if(rowIdx >= mealSlots.length) return;
			const mealSlot = mealSlots[rowIdx];
			
			// 获取该行的所有单元格（包括第一列标签，需要跳过）
			const allCells = qa('td', row);
			// 跳过第一列（标签列），只处理数据单元格
			const cells = allCells.slice(1);
			
			if(cells.length === 0) return;
			
			cells.forEach((cell, cellIdx) => {
				// 计算日期
				const date = new Date(currentWeekStart);
				date.setDate(date.getDate() + cellIdx);
				const dateStr = formatDate(date);
				const key = getPlanKey(dateStr, mealSlot);
				
				const plan = mealPlans[key];
				
				if(plan && plan.recipe_name){
					const isPendingAdd = pendingAdds.has(key) || plan.plan_id === null;
					const pendingBadge = isPendingAdd ? '<span class="pending-pill">Pending</span>' : '';
					// 显示食谱名称
					cell.innerHTML = `
						<div class="meal-item${isPendingAdd ? ' pending' : ''}" data-plan-id="${plan.plan_id || ''}" data-date="${dateStr}" data-slot="${mealSlot}">
							<div class="meal-label">
								${pendingBadge}
								<span class="meal-name">${plan.recipe_name}</span>
							</div>
							<button class="meal-remove" title="Remove" aria-label="Remove">×</button>
						</div>
					`;
					// 添加删除按钮事件
					const removeBtn = cell.querySelector('.meal-remove');
					if(removeBtn){
						removeBtn.addEventListener('click', (e) => {
							e.stopPropagation();
							handlePlanRemoval(dateStr, mealSlot);
						});
					}
				} else {
					// 显示添加按钮
					cell.innerHTML = `<span class="add-link" data-date="${dateStr}" data-slot="${mealSlot}">+ Add</span>`;
					// 添加点击事件
					const addLink = cell.querySelector('.add-link');
					if(addLink){
						addLink.addEventListener('click', () => {
							openPickerForSlot(dateStr, mealSlot);
						});
					}
				}
			});
		});
	}

	function queueMealAddition(recipe, mealDate, mealSlot){
		if(!recipe || !recipe.recipe_id){
			alert('无法获取食谱信息');
			return;
		}
		
		// 检查食材是否足够
		const checkResult = checkRecipeIngredientsAvailable(recipe);
		if(!checkResult.available){
			showMissingIngredientsModal(recipe.name || 'Recipe', checkResult.missing);
			return;
		}
		
		const key = getPlanKey(mealDate, mealSlot);
		mealPlans[key] = {
			plan_id: null,
			recipe_id: recipe.recipe_id,
			recipe_name: recipe.name || 'Recipe',
			meal_date: mealDate,
			meal_slot: mealSlot,
			recipe_category: recipe.category || '',
			status: 'pending_add',
			recipe_data: recipe
		};
		pendingAdds.set(key, {
			recipe_id: recipe.recipe_id,
			meal_date: mealDate,
			meal_slot: mealSlot
		});
		const basePlan = basePlans[key];
		if(basePlan && basePlan.plan_id){
			pendingRemovals.set(key, {
				plan_id: basePlan.plan_id,
				meal_date: basePlan.meal_date,
				meal_slot: basePlan.meal_slot
			});
		}
		if(!basePlan){
			pendingRemovals.delete(key);
		}
		updateMealPlansDisplay();
		updateConfirmButtonState();
	}

	function handlePlanRemoval(mealDate, mealSlot){
		if(!confirm('Remove this meal from your plan?')) return;
		const key = getPlanKey(mealDate, mealSlot);
		const plan = mealPlans[key];
		if(!plan) return;

		if(plan.plan_id === null){
			// 删除新增但未保存的计划
			pendingAdds.delete(key);
			if(!basePlans[key]){
				pendingRemovals.delete(key);
			}
		} else {
			pendingRemovals.set(key, {
				plan_id: plan.plan_id,
				meal_date: plan.meal_date,
				meal_slot: plan.meal_slot
			});
		}
		delete mealPlans[key];
		updateMealPlansDisplay();
		updateConfirmButtonState();
	}

	async function confirmWeeklyPlan(){
		console.log('[confirmWeeklyPlan] Called');
		console.log('[confirmWeeklyPlan] isSaving:', isSaving);
		console.log('[confirmWeeklyPlan] pendingAdds:', pendingAdds.size);
		console.log('[confirmWeeklyPlan] pendingRemovals:', pendingRemovals.size);
		
		if(isSaving){
			console.log('[confirmWeeklyPlan] Already saving, ignoring');
			return;
		}
		const hasPendingEntry = Object.values(mealPlans).some(plan => plan && plan.plan_id === null);
		console.log('[confirmWeeklyPlan] hasPendingEntry:', hasPendingEntry);
		
		if(!hasUnsavedChanges() && !hasPendingEntry){
			console.log('[confirmWeeklyPlan] No unsaved changes');
			alert('没有待保存的更改');
			return;
		}
		const btn = q('#confirm-plan');
		if(btn){
			isSaving = true;
			btn.disabled = true;
			btn.textContent = 'Saving...';
			console.log('[confirmWeeklyPlan] Button disabled, starting save...');
		}
		try{
			console.log('[confirmWeeklyPlan] Starting save process...');
			const apiPath = getApiPath('meal_plans_api.php');
			
			// 先删除
			if(pendingRemovals.size > 0){
				for(const removal of pendingRemovals.values()){
					if(!removal || !removal.plan_id) continue;
					const removeUrl = new URL(apiPath, window.location.origin);
					removeUrl.searchParams.set('action', 'remove_meal_plan');
					await requestJson(removeUrl.toString(), {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ plan_id: removal.plan_id })
					});
				}
			}
			
			const plansToAdd = Array.from(pendingAdds.values());
			const pendingEntries = Object.values(mealPlans)
				.filter(plan => plan && plan.plan_id === null && !pendingAdds.has(getPlanKey(plan.meal_date, plan.meal_slot)))
				.map(plan => ({
					recipe_id: plan.recipe_id,
					meal_date: plan.meal_date,
					meal_slot: plan.meal_slot
				}));
			
			const allAdds = plansToAdd.concat(pendingEntries);
			if(allAdds.length > 0){
				const addUrl = new URL(apiPath, window.location.origin);
				addUrl.searchParams.set('action', 'batch_add_meal_plans');
				await requestJson(addUrl.toString(), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ plans: allAdds })
				});
			}
			
			// 收集本次新添加的计划，用于减少库存
			const plansToDeduct = allAdds.length > 0 ? allAdds : [];
			
			await loadWeekPlans();
			
			// 减少库存（只减少本次新添加的计划）
			if(plansToDeduct.length > 0){
				console.log('[confirmWeeklyPlan] Deducting inventory from newly added plans...');
				console.log('[confirmWeeklyPlan] Plans to deduct:', plansToDeduct.length);
				console.log('[confirmWeeklyPlan] Recipe IDs:', plansToDeduct.map(p => p.recipe_id));
				console.log('[confirmWeeklyPlan] Week start (Date object):', currentWeekStart);
				
				// 格式化日期为 YYYY-MM-DD
				if(!currentWeekStart){
					console.error('[confirmWeeklyPlan] ❌ currentWeekStart is null or undefined');
					alert('无法获取周开始日期');
					return;
				}
				
				console.log('[confirmWeeklyPlan] currentWeekStart type:', typeof currentWeekStart);
				console.log('[confirmWeeklyPlan] currentWeekStart value:', currentWeekStart);
				console.log('[confirmWeeklyPlan] currentWeekStart instanceof Date:', currentWeekStart instanceof Date);
				
				const weekStartFormatted = formatDate(currentWeekStart);
				console.log('[confirmWeeklyPlan] Week start (formatted):', weekStartFormatted);
				console.log('[confirmWeeklyPlan] Week start format check:', /^\d{4}-\d{2}-\d{2}$/.test(weekStartFormatted));
				
				if(!weekStartFormatted || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartFormatted)){
					console.error('[confirmWeeklyPlan] ❌ Invalid date format:', weekStartFormatted);
					alert('日期格式错误: ' + weekStartFormatted);
					return;
				}
				
				try {
					const deductUrl = new URL(apiPath, window.location.origin);
					deductUrl.searchParams.set('action', 'deduct_inventory_from_plans');
					
					const requestBody = { 
						week_start: weekStartFormatted,
						recipe_ids: plansToDeduct.map(p => p.recipe_id)
					};
					console.log('[confirmWeeklyPlan] Request body:', requestBody);
					
					const deductResponse = await requestJson(deductUrl.toString(), {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(requestBody)
					});
					
					console.log('[confirmWeeklyPlan] Deduct response:', deductResponse);
					
					if(deductResponse && deductResponse.ok){
						console.log('[confirmWeeklyPlan] ✅ Inventory deducted successfully');
						console.log('[confirmWeeklyPlan] Deducted items count:', deductResponse.data?.deducted_items?.length || 0);
						console.log('[confirmWeeklyPlan] Deducted items details:', deductResponse.data?.deducted_items);
						
						if(deductResponse.data?.deducted_items?.length > 0){
							alert(`Reduced ingredient quantities for ${deductResponse.data.deducted_items.length} inventory items.`);
						} else {
							console.warn('[confirmWeeklyPlan] ⚠️ No items were deducted. Check if ingredients match inventory.');
						}
						
						if(deductResponse.data?.errors && deductResponse.data.errors.length > 0){
							console.error('[confirmWeeklyPlan] Errors during deduction:', deductResponse.data.errors);
						}
						
						// 重新加载库存
						await loadInventory();
					} else {
						console.error('[confirmWeeklyPlan] ⚠️ Failed to deduct inventory:', deductResponse);
						alert('减少库存时出错: ' + (deductResponse?.data || '未知错误'));
					}
				} catch (deductError) {
					console.error('[confirmWeeklyPlan] ❌ Error deducting inventory:', deductError);
					console.error('[confirmWeeklyPlan] Error stack:', deductError.stack);
					alert('减少库存时出错: ' + deductError.message);
					// 不阻止计划保存，只是记录错误
				}
			} else {
				console.log('[confirmWeeklyPlan] No new plans to deduct inventory from');
			}
			
			alert('Weekly plan saved successfully.');
		}catch(e){
			console.error('confirmWeeklyPlan error:', e);
			alert('Failed to save weekly plan: ' + e.message);
		}finally{
			if(btn){
				btn.textContent = 'Confirm Weekly Plan';
				btn.disabled = false;
			}
			isSaving = false;
			updateConfirmButtonState();
		}
	}

	function setupSearch(){
		const input = q('#recipe-search');
		if(!input) return;
		input.addEventListener('input', () => {
			const term = input.value.trim().toLowerCase();
			if(!term){
				// 如果搜索框为空，显示所有食谱
				qa('.recipe').forEach(card => { card.style.display = ''; });
				return;
			}
			qa('.recipe').forEach(card => {
				// 获取食谱的所有文本内容（包括名称、分类、状态等）
				const recipeName = card.querySelector('.recipe-name')?.textContent || '';
				const category = card.querySelector('.tags > span:first-child')?.textContent || '';
				const matchStatus = card.querySelector('.badge')?.textContent || '';
				const ingredients = card.querySelector('.ingredients')?.textContent || '';
				
				// 将所有文本合并并转为小写进行搜索
				const allText = `${recipeName} ${category} ${matchStatus} ${ingredients}`.toLowerCase();
				card.style.display = allText.includes(term) ? '' : 'none';
			});
		});
	}

	// ===== Details modal =====
	function openModalFromRecipe(recipe, targetDate = null, targetSlot = null){
		const overlay = q('#meal-modal'); if(!overlay) return;
		currentRecipeId = recipe.recipe_id;
		currentRecipeData = recipe;
		q('#mm-title').textContent = recipe.name || 'Recipe';
		q('#mm-type').textContent = (recipe.category||'').toUpperCase();
		
		// 显示匹配状态
		const matchStatus = recipe.match_status || 'NOT';
		const matchBadge = q('#mm-match');
		if(matchBadge){
			matchBadge.textContent = matchStatus;
			matchBadge.className = 'badge ' + (matchStatus === 'FULLY' ? 'success' : (matchStatus === 'PARTIAL' ? 'warn' : 'danger'));
		}
		
		q('#mm-calories').textContent = recipe.nutrition?.calories ? recipe.nutrition.calories+" kcal" : '-';
		q('#mm-protein').textContent = recipe.nutrition?.protein_g ? recipe.nutrition.protein_g+" g" : '-';
		q('#mm-fat').textContent = recipe.nutrition?.fat_g ? recipe.nutrition.fat_g+" g" : '-';
		q('#mm-carbs').textContent = recipe.nutrition?.carbs_g ? recipe.nutrition.carbs_g+" g" : '-';
		
		const tbody = q('#mm-ingredients'); tbody.innerHTML = '';
		
		// 使用 ingredients_with_stock 如果可用，否则使用 ingredients
		const ingredientsData = Array.isArray(recipe.ingredients_with_stock) && recipe.ingredients_with_stock.length > 0 
			? recipe.ingredients_with_stock 
			: (Array.isArray(recipe.ingredients) ? recipe.ingredients.map(ing => ({
				name: ing.name || '',
				required: ing.amount || '-',
				available: null,
				available_name: null,
				status: 'miss'
			})) : []);
		
		ingredientsData.forEach(ing => {
			const tr = document.createElement('tr');
			const name = ing.name || '-';
			const req = ing.required || '-';
			let avail = '-';
			if (ing.available !== null) {
				// 格式化可用数量显示
				const qty = ing.available;
				const qtyStr = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
				avail = qtyStr + (ing.available_name ? ' (' + ing.available_name + ')' : '');
			}
			const status = ing.status || 'miss';
			const statusClass = status === 'ok' ? 'ok' : 'miss';
			const statusIcon = status === 'ok' ? 'check_circle' : 'cancel';
			tr.innerHTML = `<td>${name}</td><td>${req}</td><td>${avail}</td><td class="status-cell"><span class="material-symbols-rounded status-icon ${statusClass}">${statusIcon}</span></td>`;
			tbody.appendChild(tr);
		});
		
		// 如果提供了目标日期和时段，设置表单
		if(targetDate){
			const dateInput = q('#mm-date');
			if(dateInput) dateInput.value = targetDate;
		}
		if(targetSlot){
			const slotInput = q('#mm-slot');
			if(slotInput) slotInput.value = targetSlot;
		}
		
		overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
	}

	function closeModal(){ const overlay = q('#meal-modal'); if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); currentRecipeId = null; currentRecipeData = null; } }
	
	// 显示缺失食材弹窗
	function showMissingIngredientsModal(recipeName, missingIngredients){
		const modal = q('#missing-ingredients-modal');
		if(!modal) return;
		
		// 设置食谱名称
		const nameEl = q('#missing-recipe-name');
		if(nameEl) nameEl.textContent = `Cannot Add: ${recipeName}`;
		
		// 清空并填充缺失食材列表
		const listEl = q('#missing-ingredients-list');
		if(listEl){
			listEl.innerHTML = '';
			missingIngredients.forEach(ing => {
				const item = document.createElement('div');
				item.className = 'missing-ingredient-item';
				
				// 计算短缺数量
				const requiredQty = parseQuantityNumber(ing.required);
				const availableQty = parseQuantityNumber(ing.available);
				const shortage = requiredQty - availableQty;
				
				item.innerHTML = `
					<div class="ingredient-info">
						<div class="ingredient-icon">
							<span class="material-symbols-rounded" style="font-size: 22px;">cancel</span>
						</div>
						<div class="ingredient-name">${ing.name}</div>
					</div>
					<div class="ingredient-details">
						<div class="ingredient-required">
							<span class="material-symbols-rounded" style="font-size: 16px; line-height: 1;">description</span>
							<span>Required: ${ing.required}</span>
						</div>
						<div class="ingredient-available">
							<span class="material-symbols-rounded" style="font-size: 16px; line-height: 1;">inventory_2</span>
							<span>Available: ${ing.available}</span>
						</div>
					</div>
				`;
				listEl.appendChild(item);
			});
		}
		
		// 显示弹窗
		modal.classList.add('show');
		modal.setAttribute('aria-hidden', 'false');
	}
	
	// 关闭缺失食材弹窗
	function closeMissingIngredientsModal(){
		const modal = q('#missing-ingredients-modal');
		if(modal){
			modal.classList.remove('show');
			modal.setAttribute('aria-hidden', 'true');
		}
	}
	
	function setupModal(){ 
		const overlay = q('#meal-modal'); 
		const closeBtn = q('.mm-close'); 
		if(closeBtn){ closeBtn.addEventListener('click', closeModal); } 
		if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); }); } 
		document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); }); 
		const addBtn = q('#mm-add'); 
		if(addBtn){ 
			addBtn.addEventListener('click', async () => {
				if(!currentRecipeData){
					alert('No recipe selected');
					return;
				}
				const mealDate = q('#mm-date')?.value;
				const mealSlot = q('#mm-slot')?.value;
				if(!mealDate || !mealSlot){
					alert('Please select date and meal slot');
					return;
				}
				queueMealAddition(currentRecipeData, mealDate, mealSlot);
				closeModal();
			}); 
		}
		
		// 设置缺失食材弹窗
		const missingModal = q('#missing-ingredients-modal');
		const missingCloseBtn = q('#missing-ingredients-close');
		const missingOkBtn = q('#missing-ingredients-ok');
		
		if(missingCloseBtn){
			missingCloseBtn.addEventListener('click', closeMissingIngredientsModal);
		}
		if(missingOkBtn){
			missingOkBtn.addEventListener('click', closeMissingIngredientsModal);
		}
		if(missingModal){
			missingModal.addEventListener('click', (e) => {
				if(e.target === missingModal) closeMissingIngredientsModal();
			});
		}
		document.addEventListener('keydown', (e) => {
			if(e.key === 'Escape' && missingModal && missingModal.classList.contains('show')){
				closeMissingIngredientsModal();
			}
		});
	}

	// ===== 为特定时段打开选择器 =====
	function openPickerForSlot(date, slot){
		const overlay = q('#picker-modal'); 
		if(!overlay) return;
		
		// 加载食谱列表到picker
		loadRecipesForPicker(date, slot);
		
		overlay.classList.add('show'); 
		overlay.setAttribute('aria-hidden','false');
	}
	
	// ===== 为picker加载食谱 =====
	async function loadRecipesForPicker(targetDate, targetSlot){
		const list = q('#picker-list');
		if(!list) return;
		list.innerHTML = '<div class="period">Loading recipes...</div>';
		try{
			const apiPath = getApiPath('recipes_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'list_recipes');
			apiUrl.searchParams.set('limit', '50');
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				list.innerHTML = '<div class="period">API file not found</div>';
				return;
			}
			
			// 检查是否是401未授权错误
			if(res.status === 401){
				alert('Please login first');
				window.location.href = '../LoginAndRegistry/sign_in.html';
				return;
			}
			
			// 检查Content-Type
			const contentType = res.headers.get('content-type');
			if(!contentType || !contentType.includes('application/json')){
				const text = await res.text();
				list.innerHTML = '<div class="period">API error: ' + text.substring(0, 50) + '</div>';
				return;
			}
			
			const data = await res.json();
			if(!data.ok) throw new Error(data.data || 'Load failed');
			const arr = Array.isArray(data.data) ? data.data : [];
			list.innerHTML = '';
			if(arr.length === 0){
				list.innerHTML = '<div class="period">No recipes available.</div>';
				return;
			}
			arr.forEach(rec => {
				const div = document.createElement('div');
				div.className = 'picker-item';
				div.style.cssText = 'padding:12px; border-bottom:1px solid #eee; cursor:pointer;';
				div.innerHTML = `
					<div style="font-weight:bold;">${rec.name || 'Recipe'}</div>
					<div style="color:#666; font-size:0.9em;">${rec.category || ''}</div>
				`;
				div.addEventListener('click', () => {
					queueMealAddition(rec, targetDate, targetSlot);
					closePicker();
				});
				list.appendChild(div);
			});
		}catch(e){
			list.innerHTML = '<div class="period">' + e.message + '</div>';
		}
	}

	// ===== Sidebar recipes loading =====
	async function loadRecipes(){
		const list = q('.recipe-list'); if(!list) return;
		list.innerHTML = '<div class="period">Loading...</div>';
		try{
			const apiPath = getApiPath('recipes_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'list_recipes');
			apiUrl.searchParams.set('limit', '50');
			
			// 调试信息
			console.log('[loadRecipes] API URL:', apiUrl.toString());
			console.log('[loadRecipes] Script path:', document.currentScript?.src || 'N/A');
			console.log('[loadRecipes] Current page:', window.location.pathname);
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				console.error('[loadRecipes] 404 Error - API file not found at:', apiUrl.toString());
				console.error('[loadRecipes] Current page path:', window.location.pathname);
				const script = document.currentScript || Array.from(document.getElementsByTagName('script')).find(s => (s.src || '').includes('meal_planner.js'));
				console.error('[loadRecipes] Script element:', script?.src || 'N/A');
				list.innerHTML = '<div class="period">API file not found. Check console (F12) for details.</div>';
				return;
			}
			
			// 检查是否是401未授权错误（虽然recipes_api.php目前不需要登录，但为了统一处理）
			if(res.status === 401){
				alert('Please login first');
				window.location.href = '../LoginAndRegistry/sign_in.html';
				return;
			}
			
			// 检查Content-Type
			const contentType = res.headers.get('content-type');
			if(!contentType || !contentType.includes('application/json')){
				const text = await res.text();
				list.innerHTML = '<div class="period">API error: ' + text.substring(0, 50) + '</div>';
				return;
			}
			
			const data = await res.json(); if(!data.ok) throw new Error(data.data || 'Load failed');
			const arr = Array.isArray(data.data) ? data.data : [];
			
			// 按匹配状态排序：FULLY -> PARTIAL -> NOT
			arr.sort((a, b) => {
				const order = { 'FULLY': 0, 'PARTIAL': 1, 'NOT': 2 };
				const aOrder = order[a.match_status] ?? 3;
				const bOrder = order[b.match_status] ?? 3;
				return aOrder - bOrder;
			});
			
			list.innerHTML = '';
			arr.forEach(rec => {
				const ingCount = Array.isArray(rec.ingredients) ? rec.ingredients.length : 0;
				const matchStatus = rec.match_status || 'NOT';
				const matchBadgeClass = matchStatus === 'FULLY' ? 'success' : (matchStatus === 'PARTIAL' ? 'warn' : 'danger');
				const matchBadgeText = matchStatus === 'FULLY' ? 'FULLY' : (matchStatus === 'PARTIAL' ? 'PARTIAL' : 'NOT');
				const recipeName = rec.name || 'Unnamed Recipe';
				const div = document.createElement('div'); div.className = 'recipe';
				div.innerHTML = `
					<div class=\"recipe-name\">${recipeName}</div>
					<div class=\"tags\">
						<span>${(rec.category||'').toUpperCase()}</span>
						<span class=\"badge ${matchBadgeClass}\">${matchBadgeText}</span>
					</div>
					<div class=\"ingredients\">${ingCount} ingredients</div>
					<div class=\"actions\">
						<button class=\"btn ghost\" data-details>Details</button>
						<button class=\"btn\" data-edit>Edit</button>
						<button class=\"btn ghost\" data-delete>Delete</button>
					</div>`;
				div.querySelector('[data-details]').addEventListener('click', ()=> openModalFromRecipe(rec));
				div.querySelector('[data-edit]').addEventListener('click', ()=> openEditModal(rec));
				div.querySelector('[data-delete]').addEventListener('click', ()=> deleteRecipe(rec.recipe_id));
				list.appendChild(div);
			});
			if(arr.length===0){ list.innerHTML = '<div class="period">No recipes yet.</div>'; }
		}catch(e){ list.innerHTML = '<div class="period">'+e.message+'</div>'; }
	}

	// ===== Edit modal =====
	function openEditModal(rec){
		editingRecipeId = rec.recipe_id;
		q('#edit-title').textContent = 'Edit Recipe';
		q('#em-name').value = rec.name || '';
		q('#em-category').value = (rec.category||'LUNCH').toUpperCase();
		q('#em-cal').value = rec.nutrition?.calories || '';
		q('#em-protein').value = rec.nutrition?.protein_g || '';
		q('#em-fat').value = rec.nutrition?.fat_g || '';
		q('#em-carbs').value = rec.nutrition?.carbs_g || '';
		const lines = q('#em-ing-lines');
		qa('.re-ing-line', lines).forEach((line,idx)=>{ if(idx>0) line.remove(); });
		const first = qa('.re-ing-line', lines)[0];
		const arr = Array.isArray(rec.ingredients) ? rec.ingredients : [];
		if(arr.length===0){ first.querySelector('.em-ing-name').value=''; first.querySelector('.em-ing-amount').value=''; }
		else {
			arr.forEach((ing, idx)=>{
				let line;
				if(idx===0){ line = first; }
				else { line = document.createElement('div'); line.className='re-ing-line'; line.innerHTML = '<input type="text" class="re-input em-ing-name" placeholder="Ingredient name">\n<input type="text" class="re-input small em-ing-amount" placeholder="Amount">\n<button class="btn ghost em-remove-line" title="Remove" aria-label="Remove line">×</button>'; lines.appendChild(line); }
				line.querySelector('.em-ing-name').value = ing.name || '';
				line.querySelector('.em-ing-amount').value = ing.amount || '';
			});
		}
		bindEditLineEvents(lines);
		const overlay = q('#edit-modal'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
	}
	function closeEditModal(){ const overlay=q('#edit-modal'); if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); editingRecipeId=null; } }
	function bindEditLineEvents(container){ qa('.em-remove-line', container).forEach(btn=>{ btn.onclick = ()=>{ const line = btn.closest('.re-ing-line'); const p=container; if(p.children.length>1) line.remove(); else { line.querySelector('.em-ing-name').value=''; line.querySelector('.em-ing-amount').value=''; } }; }); }
	function setupEditModalControls(){
		const overlay = q('#edit-modal'); const addBtn = q('#em-add-line'); const cancelBtn=q('#em-cancel'); const saveBtn=q('#em-save'); const ingContainer=q('#em-ing-lines');
		if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeEditModal(); }); }
		const x = document.querySelector('#edit-modal .mm-close'); if(x){ x.addEventListener('click', closeEditModal); }
		if(addBtn){ addBtn.addEventListener('click', ()=>{ const line=document.createElement('div'); line.className='re-ing-line'; line.innerHTML='<input type="text" class="re-input em-ing-name" placeholder="Ingredient name">\n<input type="text" class="re-input small em-ing-amount" placeholder="Amount">\n<button class="btn ghost em-remove-line" title="Remove" aria-label="Remove line">×</button>'; ingContainer.appendChild(line); bindEditLineEvents(ingContainer); }); }
		if(cancelBtn){ cancelBtn.addEventListener('click', closeEditModal); }
		if(saveBtn){ saveBtn.addEventListener('click', saveEdit); }
	}
	async function saveEdit(){
		if(!editingRecipeId){ alert('No recipe selected'); return; }
		const payload = {
			recipe_id: editingRecipeId,
			name: q('#em-name').value.trim(),
			category: q('#em-category').value.toUpperCase(),
			nutrition: {
				calories: q('#em-cal').value || null,
				protein_g: q('#em-protein').value || null,
				fat_g: q('#em-fat').value || null,
				carbs_g: q('#em-carbs').value || null
			},
			ingredients: qa('#em-ing-lines .re-ing-line').map((line, idx)=>({
				name: line.querySelector('.em-ing-name').value.trim(),
				amount: line.querySelector('.em-ing-amount').value.trim(),
				pos: idx+1
			})).filter(x=>x.name)
		};
		try{
			const apiPath = getApiPath('recipes_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'update_recipe');
			
			const res = await fetch(apiUrl.toString(), { 
				method:'POST', 
				headers:{ 'Content-Type':'application/json' }, 
				body: JSON.stringify(payload) 
			});
			
			// 检查响应状态
			if(res.status === 404){
				alert('API file not found');
				return;
			}
			
			// 检查Content-Type
			const contentType = res.headers.get('content-type');
			if(!contentType || !contentType.includes('application/json')){
				const text = await res.text();
				alert('API error: ' + text.substring(0, 100));
				return;
			}
			
			const data = await res.json(); if(!data.ok) throw new Error(data.data||'Update failed');
			closeEditModal(); await loadRecipes();
		}catch(e){ alert(e.message); }
	}

	async function deleteRecipe(id){ 
		if(!confirm('Delete this recipe?')) return; 
		try{ 
			const apiPath = getApiPath('recipes_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'delete_recipe');
			apiUrl.searchParams.set('recipe_id', id);
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				alert('API file not found');
				return;
			}
			
			// 检查Content-Type
			const contentType = res.headers.get('content-type');
			if(!contentType || !contentType.includes('application/json')){
				const text = await res.text();
				alert('API error: ' + text.substring(0, 100));
				return;
			}
			
			const data = await res.json(); 
			if(!data.ok) throw new Error(data.data||'Delete failed'); 
			await loadRecipes(); 
		} catch(e){ 
			alert(e.message); 
		} 
	}

	// ===== Picker =====
	function openPicker(){ 
		const overlay = q('#picker-modal'); 
		if(!overlay) return; 
		const list = q('#picker-list'); 
		list.innerHTML = '<div class="period">Use sidebar to view recipes.</div>'; 
		overlay.classList.add('show'); 
		overlay.setAttribute('aria-hidden','false'); 
	}
	function closePicker(){ 
		const overlay=q('#picker-modal'); 
		if(overlay){ 
			overlay.classList.remove('show'); 
			overlay.setAttribute('aria-hidden','true'); 
		} 
	}
	function setupPicker(){ 
		const overlay=q('#picker-modal'); 
		const closeBtn=overlay?overlay.querySelector('.mm-close'):null; 
		if(closeBtn){ closeBtn.addEventListener('click', closePicker); } 
		if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closePicker(); }); } 
		document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closePicker(); }); 
		// 注意：add-link的事件监听器现在在updateMealPlansDisplay中动态添加
	}

	function setupConfirmButton(){
		// 使用多种方式查找按钮
		let btn = document.getElementById('confirm-plan');
		if(!btn){
			btn = document.querySelector('#confirm-plan');
		}
		if(!btn){
			btn = document.querySelector('button[id="confirm-plan"]');
		}
		if(!btn){
			// 尝试通过文本内容查找
			const allButtons = document.querySelectorAll('button');
			for(const b of allButtons){
				if(b.textContent && b.textContent.trim() === 'Confirm Weekly Plan'){
					btn = b;
					if(!btn.id) btn.id = 'confirm-plan';
					console.log('[setupConfirmButton] Found button by text, assigned ID');
					break;
				}
			}
		}
		
		if(!btn){
			console.error('[setupConfirmButton] Button #confirm-plan not found!');
			console.error('[setupConfirmButton] Document readyState:', document.readyState);
			console.error('[setupConfirmButton] All buttons:', Array.from(document.querySelectorAll('button')).map(b => ({
				id: b.id,
				text: b.textContent?.trim(),
				classes: b.className
			})));
			// 重试一次
			setTimeout(() => {
				const retryBtn = document.getElementById('confirm-plan') || 
					document.querySelector('#confirm-plan') ||
					Array.from(document.querySelectorAll('button')).find(b => 
						b.textContent && b.textContent.trim() === 'Confirm Weekly Plan'
					);
				if(retryBtn){
					if(!retryBtn.id) retryBtn.id = 'confirm-plan';
					console.log('[setupConfirmButton] ✅ Button found on retry');
					bindConfirmButton(retryBtn);
				} else {
					console.error('[setupConfirmButton] ❌ Button still not found after retry');
				}
			}, 500);
			return;
		}
		bindConfirmButton(btn);
	}
	
	function bindConfirmButton(btn){
		// 检查是否已经绑定过事件
		if(btn.dataset.confirmBound === 'true'){
			console.log('[bindConfirmButton] Button already bound, skipping');
			return;
		}
		
		console.log('[bindConfirmButton] Button found, binding click event');
		btn.addEventListener('click', (e) => {
			console.log('[bindConfirmButton] Button clicked!');
			console.log('[bindConfirmButton] Button disabled?', btn.disabled);
			console.log('[bindConfirmButton] hasUnsavedChanges?', hasUnsavedChanges());
			console.log('[bindConfirmButton] pendingAdds:', pendingAdds.size);
			console.log('[bindConfirmButton] pendingRemovals:', pendingRemovals.size);
			confirmWeeklyPlan();
		});
		btn.dataset.confirmBound = 'true';
		updateConfirmButtonState();
		console.log('[bindConfirmButton] ✅ Button setup complete');
	}

	// ===== Create editor (card) =====
	function setupRecipeEditor(){
		const card = q('#re-card'); const toggle = q('#re-toggle'); const body = q('#re-body'); const lines = q('#re-ing-lines'); const addLineBtn = q('#re-add-line'); const submitBtn = q('#re-submit'); const cancelBtn = q('#re-cancel');
		if(toggle){ toggle.addEventListener('click', ()=>{ const hidden = body.hasAttribute('hidden'); if(hidden){ body.removeAttribute('hidden'); card.classList.add('open'); } else { body.setAttribute('hidden',''); card.classList.remove('open'); clearCreateEditor(); } }); toggle.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle.click(); } }); }
		function bindLineEvents(line){ const removeBtn = line.querySelector('.re-remove-line'); if(removeBtn){ removeBtn.addEventListener('click', ()=>{ if(lines.children.length>1){ line.remove(); } else { line.querySelector('.re-ing-name').value=''; line.querySelector('.re-ing-amount').value=''; } }); } }
		bindLineEvents(lines.querySelector('.re-ing-line'));
		function addLine(){ const line=document.createElement('div'); line.className='re-ing-line'; line.innerHTML='<input type="text" class="re-input re-ing-name" placeholder="Ingredient name">\n<input type="text" class="re-input small re-ing-amount" placeholder="Amount">\n<button class="btn ghost re-remove-line" title="Remove" aria-label="Remove line">×</button>'; lines.appendChild(line); bindLineEvents(line); }
		if(addLineBtn){ addLineBtn.addEventListener('click', addLine); }

		async function submitRecipe(){
			const title = q('#re-name').value.trim(); if(!title){ alert('Please enter recipe name'); return; }
			const category = (q('#re-category').value || 'LUNCH').toUpperCase();
			const nutrition = { calories: q('#re-cal')?.value || null, protein_g: q('#re-protein')?.value || null, fat_g: q('#re-fat')?.value || null, carbs_g: q('#re-carbs')?.value || null };
			const ingredients = qa('.re-ing-line', lines).map((line, idx)=>({ name: line.querySelector('.re-ing-name').value.trim(), amount: line.querySelector('.re-ing-amount').value.trim(), pos: idx+1 })).filter(x=>x.name);
			if(ingredients.length===0){ alert('Please add at least one ingredient'); return; }
			const payload = { name: title, category, nutrition, ingredients };
			submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
			try{
				const apiPath = getApiPath('recipes_api.php');
				const apiUrl = new URL(apiPath, window.location.origin);
				apiUrl.searchParams.set('action', 'create_recipe');
				
				const res = await fetch(apiUrl.toString(), { 
					method:'POST', 
					headers:{ 'Content-Type':'application/json' }, 
					body: JSON.stringify(payload) 
				});
				
				// 检查响应状态
				if(res.status === 404){
					alert('API file not found');
					return;
				}
				
				// 检查Content-Type
				const contentType = res.headers.get('content-type');
				if(!contentType || !contentType.includes('application/json')){
					const text = await res.text();
					alert('API error: ' + text.substring(0, 100));
					return;
				}
				
				const data = await res.json(); if(!data.ok) throw new Error(data.data||'Create failed');
				clearCreateEditor(); body.setAttribute('hidden',''); q('#re-card').classList.remove('open'); await loadRecipes();
			}catch(e){ alert(e.message); }
			finally{ submitBtn.disabled=false; submitBtn.textContent='Add Recipe'; }
		}
		if(submitBtn){ submitBtn.addEventListener('click', submitRecipe); }
		if(cancelBtn){ cancelBtn.addEventListener('click', ()=>{ body.setAttribute('hidden',''); q('#re-card').classList.remove('open'); clearCreateEditor(); }); }
	}
	function clearCreateEditor(){ q('#re-name').value=''; q('#re-category').selectedIndex=1; q('#re-cal').value=''; q('#re-protein').value=''; q('#re-fat').value=''; q('#re-carbs').value=''; const lines=q('#re-ing-lines'); qa('.re-ing-line', lines).forEach((line,idx)=>{ if(idx===0){ line.querySelector('.re-ing-name').value=''; line.querySelector('.re-ing-amount').value=''; } else { line.remove(); } }); }

	document.addEventListener('DOMContentLoaded', async () => { 
		await loadInventory();
		setupWeekSwitching(); 
		
		// 延迟设置确认按钮，确保 DOM 完全加载
		setTimeout(() => {
			setupConfirmButton();
		}, 100);
		
		setupSearch(); 
		setupModal(); 
		setupRecipeEditor(); 
		setupEditModalControls(); 
		setupPicker();
		window.addEventListener('beforeunload', (e) => {
			if(hasUnsavedChanges()){
				e.preventDefault();
				e.returnValue = '';
			}
		});
		await loadRecipes(); 
		// loadWeekPlans会在updateWeek中调用
	});
	
	// 如果 DOMContentLoaded 已经触发，立即执行
	if (document.readyState === 'loading') {
		// DOM 还在加载中，等待 DOMContentLoaded
	} else {
		// DOM 已经加载完成，立即执行
		setTimeout(() => {
			setupConfirmButton();
		}, 100);
	}
})();
