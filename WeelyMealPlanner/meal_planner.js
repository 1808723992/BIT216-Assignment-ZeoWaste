(function(){
	const q = (s, r=document) => r.querySelector(s);
	const qa = (s, r=document) => Array.from(r.querySelectorAll(s));

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
	}

	function setupWeekSwitching(){
		let currentStart = getMonday(new Date());
		updateWeek(currentStart);
		const prev = q('#prev-week');
		const next = q('#next-week');
		if(prev){
			prev.addEventListener('click', () => {
				currentStart.setDate(currentStart.getDate()-7);
				updateWeek(currentStart);
			});
		}
		if(next){
			next.addEventListener('click', () => {
				currentStart.setDate(currentStart.getDate()+7);
				updateWeek(currentStart);
			});
		}
	}

	function setupSearch(){
		const input = q('#recipe-search');
		if(!input) return;
		input.addEventListener('input', () => {
			const term = input.value.trim().toLowerCase();
			qa('.recipe').forEach(card => {
				const text = card.innerText.toLowerCase();
				card.style.display = text.includes(term) ? '' : 'none';
			});
		});
	}

	// ===== Details modal =====
	function openModal(data){
		const overlay = q('#meal-modal');
		if(!overlay) return;
		q('#mm-title').textContent = data.title;
		q('#mm-type').textContent = data.type;
		q('#mm-match').textContent = data.match;
		q('#mm-calories').textContent = data.nutri.calories;
		q('#mm-protein').textContent = data.nutri.protein;
		q('#mm-fat').textContent = data.nutri.fat;
		q('#mm-carbs').textContent = data.nutri.carbs;
		const tbody = q('#mm-ingredients');
		tbody.innerHTML = '';
		data.ingredients.forEach(row => {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${row.name}</td><td>${row.required}</td><td>${row.available}</td><td class="${row.status==='OK'?'ok':'miss'}">${row.status}</td>`;
			tbody.appendChild(tr);
		});
		overlay.classList.add('show');
		overlay.setAttribute('aria-hidden','false');
	}

	function closeModal(){ const overlay = q('#meal-modal'); if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); } }
	function setupModal(){
		const overlay = q('#meal-modal');
		const closeBtn = q('.mm-close');
		if(closeBtn){ closeBtn.addEventListener('click', closeModal); }
		if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); }); }
		document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
		const addBtn = q('#mm-add'); if(addBtn){ addBtn.addEventListener('click', ()=>{ alert('占位交互：已添加到计划'); closeModal(); }); }
	}

	function setupDetailButtons(){ qa('[data-action="details"]').forEach(btn => { btn.addEventListener('click', () => openModal(getSampleRecipe())); }); }
	function getSampleRecipe(){ return { title:'Spaghetti Bolognese', type:'DINNER', match:'PARTIAL', nutri:{ calories:'450 kcal', protein:'25 g', fat:'15 g', carbs:'52 g' }, ingredients:[ {name:'Spaghetti',required:'200 g',available:'200 g',status:'OK'},{name:'Ground Beef',required:'300 g',available:'150 g',status:'Missing 150 g'},{name:'Tomato Sauce',required:'2 cups',available:'2 cups',status:'OK'},{name:'Onion',required:'1',available:'1',status:'OK'},{name:'Garlic',required:'3 cloves',available:'2 cloves',status:'Missing 1 cloves'} ] }; }

	// ===== Recipe Picker =====
	const sampleList = [
		{ title:'Dinner • 8 ingredients', name:'Spaghetti Bolognese', type:'DINNER', match:'FULLY' },
		{ title:'Lunch • 3 ingredients', name:'Greek Salad', type:'LUNCH', match:'PARTIAL' },
		{ title:'Lunch • 4 ingredients', name:'Tuna Sandwich', type:'LUNCH', match:'PARTIAL' },
		{ title:'Breakfast • 4 ingredients', name:'Cheese & Tomato Omelette', type:'BREAKFAST', match:'PARTIAL' },
	];
	function openPicker(){ const overlay = q('#picker-modal'); if(!overlay) return; const list = q('#picker-list'); list.innerHTML=''; sampleList.forEach((item,idx)=>{ const row=document.createElement('div'); row.className='picker-row'; row.innerHTML=`<div class=\"picker-info\"><div class=\"picker-title\">${item.name}</div><div class=\"picker-sub\"><strong>${item.type}</strong> · ${item.title.split('•')[1]||''} <span class=\"badge\">${item.match}</span></div></div><div class=\"picker-actions\"><button class=\"btn ghost\" data-pick-details=\"${idx}\">Details</button></div>`; list.appendChild(row); }); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); qa('[data-pick-details]').forEach(btn=>btn.addEventListener('click',()=>{ closePicker(); openModal(getSampleRecipe()); })); }
	function closePicker(){ const overlay=q('#picker-modal'); if(overlay){ overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); } }
	function setupPicker(){ const overlay=q('#picker-modal'); const closeBtn=overlay?overlay.querySelector('.mm-close'):null; if(closeBtn){ closeBtn.addEventListener('click', closePicker); } if(overlay){ overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closePicker(); }); } document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closePicker(); }); qa('.add-link').forEach(el=>{ el.addEventListener('click', openPicker); }); }

	// ===== Add New Recipe editor =====
	function setupRecipeEditor(){
		const card = q('#re-card');
		const toggle = q('#re-toggle');
		const body = q('#re-body');
		const lines = q('#re-ing-lines');
		const addLineBtn = q('#re-add-line');
		const submitBtn = q('#re-submit');
		const cancelBtn = q('#re-cancel');
		if(toggle){ toggle.addEventListener('click', ()=>{ const hidden = body.hasAttribute('hidden'); if(hidden){ body.removeAttribute('hidden'); card.classList.add('open'); } else { body.setAttribute('hidden',''); card.classList.remove('open'); } }); toggle.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle.click(); } }); }

		function bindLineEvents(line){
			const removeBtn = line.querySelector('.re-remove-line');
			if(removeBtn){ removeBtn.addEventListener('click', ()=>{ if(lines.children.length>1){ line.remove(); } else { line.querySelector('.re-ing-name').value=''; line.querySelector('.re-ing-amount').value=''; } }); }
		}
		bindLineEvents(lines.querySelector('.re-ing-line'));

		function addLine(){
			const line = document.createElement('div');
			line.className = 're-ing-line';
			line.innerHTML = '<input type="text" class="re-input re-ing-name" placeholder="Ingredient name">\n<input type="text" class="re-input small re-ing-amount" placeholder="Amount">\n<button class="btn ghost re-remove-line" title="Remove" aria-label="Remove line">×</button>';
			lines.appendChild(line);
			bindLineEvents(line);
		}
		if(addLineBtn){ addLineBtn.addEventListener('click', addLine); }

		if(submitBtn){ submitBtn.addEventListener('click', ()=>{
			const title = q('#re-name').value.trim();
			if(!title){ alert('Please enter recipe name'); return; }
			const result = qa('.re-ing-line', lines).map(line=>({
				name: line.querySelector('.re-ing-name').value.trim(),
				amount: line.querySelector('.re-ing-amount').value.trim()
			})).filter(x=>x.name);
			alert('占位交互：食谱 "'+title+'" 已保存，食材条目数：'+result.length);
		}); }
		if(cancelBtn){ cancelBtn.addEventListener('click', ()=>{ body.setAttribute('hidden',''); card.classList.remove('open'); }); }
	}

	document.addEventListener('DOMContentLoaded', () => {
		setupWeekSwitching();
		setupSearch();
		setupModal();
		setupDetailButtons();
		setupPicker();
		setupRecipeEditor();
	});
})();
