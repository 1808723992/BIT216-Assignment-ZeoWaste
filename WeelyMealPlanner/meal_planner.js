(function(){
	const q = (s, r=document) => r.querySelector(s);
	const qa = (s, r=document) => Array.from(r.querySelectorAll(s));

	// 获取API基础路径（相对于当前页面）
	function getApiPath(filename) {
		// 尝试使用当前页面的路径来构建API路径
		const currentPath = window.location.pathname;
		const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
		return currentDir + filename;
	}

	let editingRecipeId = null; // 当前编辑的 recipe_id
	let currentRecipeId = null; // 当前在详情模态框中选择的食谱ID
	let currentWeekStart = null; // 当前周的开始日期
	let mealPlans = {}; // 存储餐食计划 { "2025-11-12-Breakfast": { plan_id, recipe_id, recipe_name, ... } }

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
			// 使用相对于当前页面的路径
			const apiPath = getApiPath('meal_plans_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'get_week_plans');
			apiUrl.searchParams.set('week_start', weekStartStr);
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				console.error('API file not found. Check if meal_plans_api.php exists in WeelyMealPlanner folder.');
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
			
			// 清空之前的计划
			mealPlans = {};
			
			// 存储计划数据
			const plans = Array.isArray(data.data) ? data.data : [];
			plans.forEach(plan => {
				if(plan.meal_date && plan.meal_slot && plan.recipe_id){
					const key = `${plan.meal_date}-${plan.meal_slot}`;
					mealPlans[key] = plan;
				}
			});
			
			// 更新表格显示
			updateMealPlansDisplay();
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
				const key = `${dateStr}-${mealSlot}`;
				
				const plan = mealPlans[key];
				
				if(plan && plan.recipe_name){
					// 显示食谱名称
					cell.innerHTML = `
						<div class="meal-item" data-plan-id="${plan.plan_id}" data-date="${dateStr}" data-slot="${mealSlot}">
							<span class="meal-name">${plan.recipe_name}</span>
							<button class="meal-remove" title="Remove" aria-label="Remove">×</button>
						</div>
					`;
					// 添加删除按钮事件
					const removeBtn = cell.querySelector('.meal-remove');
					if(removeBtn){
						removeBtn.addEventListener('click', (e) => {
							e.stopPropagation();
							removeMealPlan(plan.plan_id, dateStr, mealSlot);
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

	function setupSearch(){
		const input = q('#recipe-search');
		if(!input) return;
		input.addEventListener('input', () => {
			const term = input.value.trim().toLowerCase();
			qa('.recipe').forEach(card => { const text = card.innerText.toLowerCase(); card.style.display = text.includes(term) ? '' : 'none'; });
		});
	}

	// ===== Details modal =====
	function openModalFromRecipe(recipe, targetDate = null, targetSlot = null){
		const overlay = q('#meal-modal'); if(!overlay) return;
		currentRecipeId = recipe.recipe_id;
		q('#mm-title').textContent = recipe.name || 'Recipe';
		q('#mm-type').textContent = (recipe.category||'').toUpperCase();
		q('#mm-match').textContent = '';
		q('#mm-calories').textContent = recipe.nutrition?.calories ? recipe.nutrition.calories+" kcal" : '-';
		q('#mm-protein').textContent = recipe.nutrition?.protein_g ? recipe.nutrition.protein_g+" g" : '-';
		q('#mm-fat').textContent = recipe.nutrition?.fat_g ? recipe.nutrition.fat_g+" g" : '-';
		q('#mm-carbs').textContent = recipe.nutrition?.carbs_g ? recipe.nutrition.carbs_g+" g" : '-';
		const tbody = q('#mm-ingredients'); tbody.innerHTML = '';
		const rows = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
		rows.forEach(r => { const tr = document.createElement('tr'); const name = r.name || '-'; const req = r.amount || '-'; tr.innerHTML = `<td>${name}</td><td>${req}</td><td>-</td><td>-</td>`; tbody.appendChild(tr); });
		
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

	function closeModal(){ const overlay = q('#meal-modal'); if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); currentRecipeId = null; } }
	
	function setupModal(){ 
		const overlay = q('#meal-modal'); 
		const closeBtn = q('.mm-close'); 
		if(closeBtn){ closeBtn.addEventListener('click', closeModal); } 
		if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); }); } 
		document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); }); 
		const addBtn = q('#mm-add'); 
		if(addBtn){ 
			addBtn.addEventListener('click', async () => {
				if(!currentRecipeId){
					alert('No recipe selected');
					return;
				}
				const mealDate = q('#mm-date')?.value;
				const mealSlot = q('#mm-slot')?.value;
				if(!mealDate || !mealSlot){
					alert('Please select date and meal slot');
					return;
				}
				await addMealPlan(currentRecipeId, mealDate, mealSlot);
				closeModal();
			}); 
		} 
	}

	// ===== 添加餐食计划 =====
	async function addMealPlan(recipeId, mealDate, mealSlot){
		try{
			const apiPath = getApiPath('meal_plans_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'add_meal_plan');
			
			const res = await fetch(apiUrl.toString(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					recipe_id: recipeId,
					meal_date: mealDate,
					meal_slot: mealSlot
				})
			});
			
			// 检查响应状态
			if(res.status === 404){
				alert('API file not found');
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
				alert('API error: ' + text.substring(0, 100));
				return;
			}
			
			const data = await res.json();
			if(!data.ok) throw new Error(data.data || 'Failed to add meal plan');
			
			// 重新加载周计划
			await loadWeekPlans();
		}catch(e){
			alert('Failed to add meal plan: ' + e.message);
			throw e;
		}
	}

	// ===== 删除餐食计划 =====
	async function removeMealPlan(planId, mealDate, mealSlot){
		if(!confirm('Remove this meal from your plan?')) return;
		try{
			const apiPath = getApiPath('meal_plans_api.php');
			const apiUrl = new URL(apiPath, window.location.origin);
			apiUrl.searchParams.set('action', 'remove_meal_plan');
			
			const res = await fetch(apiUrl.toString(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					plan_id: planId
				})
			});
			
			// 检查响应状态
			if(res.status === 404){
				alert('API file not found');
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
				alert('API error: ' + text.substring(0, 100));
				return;
			}
			
			const data = await res.json();
			if(!data.ok) throw new Error(data.data || 'Failed to remove meal plan');
			
			// 重新加载周计划
			await loadWeekPlans();
		}catch(e){
			alert('Failed to remove meal plan: ' + e.message);
		}
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
					addMealPlan(rec.recipe_id, targetDate, targetSlot).then(() => {
						closePicker();
					}).catch(() => {});
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
			
			const res = await fetch(apiUrl.toString());
			
			// 检查响应状态
			if(res.status === 404){
				list.innerHTML = '<div class="period">API file not found</div>';
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
			list.innerHTML = '';
			arr.forEach(rec => {
				const ingCount = Array.isArray(rec.ingredients) ? rec.ingredients.length : 0;
				const div = document.createElement('div'); div.className = 'recipe';
				div.innerHTML = `
					<div class=\"tags\"><span>${(rec.name||'Recipe')}</span></div>
					<div>${ingCount} ingredients</div>
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
		setupWeekSwitching(); 
		setupSearch(); 
		setupModal(); 
		setupRecipeEditor(); 
		setupEditModalControls(); 
		setupPicker();
		await loadRecipes(); 
		// loadWeekPlans会在updateWeek中调用
	});
})();
