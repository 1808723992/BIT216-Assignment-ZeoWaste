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
		const diff = (day === 0 ? -6 : 1 - day); // 周一为 1，周日为 0
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

	function setupAddButtons(){
		qa('[data-action="add-to-plan"]').forEach(btn => {
			btn.addEventListener('click', () => {
				alert('占位交互：Add to Plan');
			});
		});
		qa('[data-action="details"]').forEach(btn => {
			btn.addEventListener('click', () => {
				alert('占位交互：Details');
			});
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		setupWeekSwitching();
		setupSearch();
		setupAddButtons();
	});
})();
