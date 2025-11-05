// Client for data_analytics.php
(function(){
  const api = 'data_analytics/data_analytics.php';

  const el = (id)=>document.getElementById(id);
  const presetRange = el('presetRange');
  const fromDate = el('fromDate');
  const toDate = el('toDate');
  const applyBtn = el('applyFilter');

  const usedTotal = el('usedTotal');
  const donatedTotal = el('donatedTotal');
  const discardedTotal = el('discardedTotal');
  const inventoryTotal = el('inventoryTotal');
  const eventsCount = el('eventsCount');

  const trendEmpty = el('trendEmpty');
  const categoryEmpty = el('categoryEmpty');
  const pieEmpty = el('pieEmpty');

  let trendChart, categoryBar, categoryPie;

  function formatYMD(d){
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function setPreset(days){
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days-1));
    fromDate.value = formatYMD(start);
    toDate.value = formatYMD(end);
  }

  function toggleCustom(){
    const custom = presetRange.value === 'custom';
    fromDate.classList.toggle('hidden', !custom);
    toDate.classList.toggle('hidden', !custom);
    if(!custom){
      setPreset(parseInt(presetRange.value,10));
    }
  }

  presetRange.addEventListener('change', () => { toggleCustom(); loadAll(); });
  fromDate.addEventListener('change', () => { if (presetRange.value === 'custom') loadAll(); });
  toDate.addEventListener('change', () => { if (presetRange.value === 'custom') loadAll(); });

  async function getJSON(url){
    const res = await fetch(url);
    return res.json();
  }

  async function loadAll(){
    const from = fromDate.value;
    const to = toDate.value;
    const userId = 9; // TODO: replace with session-fed value
    // parallel fetches
    const [summary, timeseries, categories, list] = await Promise.all([
      getJSON(`${api}?action=summary&source=db&user_id=${userId}&from=${from}&to=${to}`),
      getJSON(`${api}?action=timeseries&source=db&user_id=${userId}&from=${from}&to=${to}`),
      getJSON(`${api}?action=category_breakdown&source=db&user_id=${userId}&from=${from}&to=${to}`),
      getJSON(`${api}?action=list_events&from=${from}&to=${to}`)
    ]);

    // Summary tiles
    const s = summary.summary || {used:0,donated:0,discarded:0,inventory:0};
    usedTotal.textContent = s.used;
    donatedTotal.textContent = s.donated;
    discardedTotal.textContent = s.discarded;
    inventoryTotal.textContent = s.inventory;
    eventsCount.textContent = `${(list.events||[]).length} events recorded`;

    // Notes under tiles
    // Static friendly notes for used/donated/inventory
    usedNote.innerHTML = 'Great job reducing waste!';
    donatedNote.innerHTML = 'Making a difference!';
    inventoryNote.innerHTML = 'Well-stocked';

    // Discarded note depends on selected period threshold
    const daysSelected = (function(){
      if (presetRange.value === 'custom') {
        const d1 = new Date(fromDate.value);
        const d2 = new Date(toDate.value);
        if (!isNaN(d1) && !isNaN(d2)) {
          const diff = Math.round((d2 - d1) / (1000*60*60*24)) + 1;
          return diff;
        }
        return null;
      }
      return parseInt(presetRange.value, 10);
    })();

    let discardedLabel = 'Low waste level';
    let isBad = false;
    if (daysSelected === 7 && s.discarded > 20) { isBad = true; }
    if (daysSelected === 30 && s.discarded > 50) { isBad = true; }
    if (daysSelected === 90 && s.discarded > 100) { isBad = true; }
    if (isBad) discardedLabel = 'Room for improvement';
    discardedNote.textContent = discardedLabel;
    discardedNote.classList.toggle('bad', isBad);

    // Prepare trend data: daily for <=30 days, weekly for >30 days (incl. 90-day preset)
    const dailyLabels = timeseries.labels || [];
    const dailySeries = timeseries.series || {used:[], donated:[], discarded:[]};
    const totalDays = dailyLabels.length;

    function groupWeekly(labels, series){
      const wkLabels = [];
      const wk = {used:[], donated:[], discarded:[]};
      for(let i=0;i<labels.length;i+=7){
        const endIdx = Math.min(i+7, labels.length);
        const seg = labels.slice(i,endIdx);
        wkLabels.push(`Week ${wkLabels.length+1}`);
        wk.used.push(series.used.slice(i,endIdx).reduce((a,b)=>a+b,0));
        wk.donated.push(series.donated.slice(i,endIdx).reduce((a,b)=>a+b,0));
        wk.discarded.push(series.discarded.slice(i,endIdx).reduce((a,b)=>a+b,0));
      }
      return {labels:wkLabels, series:wk};
    }

    const useWeekly = (presetRange.value === '90') || (presetRange.value === 'custom' && totalDays > 30);
    const trendSource = useWeekly ? groupWeekly(dailyLabels, dailySeries) : {labels: dailyLabels, series: dailySeries};

    const hasAny = (trendSource.series.used||[]).some(v=>v>0) || (trendSource.series.donated||[]).some(v=>v>0) || (trendSource.series.discarded||[]).some(v=>v>0);
    trendEmpty.style.display = hasAny ? 'none':'block';
    const trendData = {
      labels: trendSource.labels,
      datasets: [
        {label:'Discarded / Expired', data: trendSource.series.discarded, borderColor:'#ffa94d', backgroundColor:'rgba(255,169,77,.2)', tension:.3},
        {label:'Donated', data: trendSource.series.donated, borderColor:'#4dabf7', backgroundColor:'rgba(77,171,247,.2)', tension:.3},
        {label:'Used', data: trendSource.series.used, borderColor:'#20bf55', backgroundColor:'rgba(32,191,85,.2)', tension:.3}
      ]
    };
    if(trendChart){ trendChart.destroy(); }
    const ctxTrend = document.getElementById('trendChart');
    trendChart = new Chart(ctxTrend, { type:'line', data:trendData, options:{ responsive:true, maintainAspectRatio:false, scales:{ x:{ ticks:{ autoSkip:true, maxTicksLimit: useWeekly ? 13 : 10 } }, y:{ beginAtZero:true, ticks:{ precision:0 } } }, interaction:{ mode:'index', intersect:false }, plugins:{ tooltip:{ callbacks:{ title:(items)=>items[0]?.label || '' } } } } });

    // Category bar
    const cats = categories.categories || {};
    const labels = Object.keys(cats);
    const dUsed = labels.map(k=>cats[k].used);
    const dDon = labels.map(k=>cats[k].donated);
    const dDis = labels.map(k=>cats[k].discarded);
    const hasCat = labels.length>0 && (dUsed.concat(dDon,dDis).some(v=>v>0));
    categoryEmpty.style.display = hasCat ? 'none':'block';
    if(categoryBar){ categoryBar.destroy(); }
    const ctxBar = document.getElementById('categoryBar');
    categoryBar = new Chart(ctxBar, { type:'bar', data:{ labels, datasets:[
      {label:'Discarded / Expired', data:dDis, backgroundColor:'#ffa94d'},
      {label:'Donated', data:dDon, backgroundColor:'#4dabf7'},
      {label:'Used', data:dUsed, backgroundColor:'#20bf55'}
    ] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } } });

    // Category pie (distribution by total actions per category)
    const totals = labels.map(k=>cats[k].used + cats[k].donated + cats[k].discarded);
    const hasPie = labels.length>0 && totals.some(v=>v>0);
    pieEmpty.style.display = hasPie ? 'none':'block';
    if(categoryPie){ categoryPie.destroy(); }
    const ctxPie = document.getElementById('categoryPie');
    const colorMap = { 'Dairy':'#ffd1c3', 'Vegetable':'#2e7d32', 'Bakery':'#b25b04', 'Grains':'#f6e0b5', 'Meat':'#ef7171', 'Fruits':'#ffa500' };
    categoryPie = new Chart(ctxPie, { type:'pie', data:{ labels, datasets:[{ data: totals, backgroundColor: labels.map(name=>colorMap[name] || '#cfd8dc') }] }, options:{ responsive:true, maintainAspectRatio:false } });
  }

  applyBtn.addEventListener('click', loadAll);

  // init default: last 30 days
  setPreset(30);
  toggleCustom();
  loadAll();
})();


