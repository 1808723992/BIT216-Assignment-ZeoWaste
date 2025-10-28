(function(){
	const q = (s, r=document) => r.querySelector(s);
	const qa = (s, r=document) => Array.from(r.querySelectorAll(s));

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
		setupSearch();
		setupAddButtons();
	});
})();
