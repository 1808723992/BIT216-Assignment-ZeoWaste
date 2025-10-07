/* ========= Data Model & Storage ========= */
const STORAGE_KEYS = {
  INVENTORY: 'sp_inventory',
  DONATIONS: 'sp_donations',
  UNDO: 'sp_undo_stack'
};

let inventory = load(STORAGE_KEYS.INVENTORY) || [];
let donations = load(STORAGE_KEYS.DONATIONS) || [];
let undoStack = load(STORAGE_KEYS.UNDO) || [];

function save(key, data){ localStorage.setItem(key, JSON.stringify(data)); }
function load(key){ try{ return JSON.parse(localStorage.getItem(key)); }catch{ return null; } }
function persistAll(){
  save(STORAGE_KEYS.INVENTORY, inventory);
  save(STORAGE_KEYS.DONATIONS, donations);
  save(STORAGE_KEYS.UNDO, undoStack);
}

/* ========= DOM Refs ========= */
const notificationEl = document.getElementById('notification');
const tbody = document.querySelector('#inventoryTable tbody');
const selectAll = document.getElementById('selectAll');

/* Forms */
const foodForm = document.getElementById('foodForm');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const donationModal = document.getElementById('donationModal');
const donationForm = document.getElementById('donationForm');

/* Filters */
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterStorage = document.getElementById('filterStorage');
const filterExpiry = document.getElementById('filterExpiry');
const clearFiltersBtn = document.getElementById('clearFilters');

/* Batch Buttons */
const batchEditBtn = document.getElementById('batchEdit');
const batchUsedBtn = document.getElementById('batchUsed');
const batchDeleteBtn = document.getElementById('batchDelete');
const batchDonateBtn = document.getElementById('batchDonate');

/* Scan Button */
const scanBtn = document.getElementById('scanBtn');

/* ========= Utilities ========= */
function uid(){ return 'i_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDaysISO(days){
  const d = new Date(); d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
function daysBetween(aISO, bISO){
  const a = new Date(aISO + 'T00:00:00'); const b = new Date(bISO + 'T00:00:00');
  return Math.floor((a - b) / (1000*60*60*24));
}
function isNearExpiry(expiry){
  const diff = Math.floor((new Date(expiry) - new Date(todayISO()))/(1000*60*60*24));
  return diff >= 0 && diff <= 3;
}
function showToast(msg, type=''){
  notificationEl.textContent = msg;
  notificationEl.className = 'notification' + (type ? ' ' + type : '');
  notificationEl.classList.remove('hidden');
  setTimeout(()=> notificationEl.classList.add('hidden'), 2200);
}
function closeModal(node){ node.classList.add('hidden'); }
function openModal(node){ node.classList.remove('hidden'); }

/* Highlight search keyword in a text */
function highlight(text, keyword){
  if(!keyword) return escapeHtml(text);
  const safe = escapeHtml(text||'');
  const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ========= Barcode helpers ========= */
// 生成唯一 13 位条码（以 9 开头，常见 EAN 长度），避免与现有重复
function generateBarcode(){
  let code;
  do{
    const base = '9' + (Date.now().toString() + Math.floor(Math.random()*1000).toString()).slice(-12);
    code = base.slice(0,13);
  }while(barcodeExists(code));
  return code;
}
function barcodeExists(code){
  return inventory.some(it=>it.barcode===code) || donations.some(d=>d.barcode===code);
}

/* 已知条码库（示例，可扩展或替换为后端） */
const KNOWN_BARCODES = {
  '9555555555555': { name:'Mackerel Can', category:'Canned', storage:'Pantry', defaultDays: 365 },
  '9550000123456': { name:'Frozen Dumplings', category:'Frozen', storage:'Freezer', defaultDays: 90 },
};

/* ========= Rendering ========= */
function render(){
  // reset selectAll on every render
  if(selectAll) selectAll.checked = false;

  const kw = (searchInput?.value || '').trim();
  const cat = filterCategory?.value || '';
  const stor = filterStorage?.value || '';
  const expf = filterExpiry?.value || '';

  let rows = [...inventory];

  // filtering
  if(kw){
    const k = kw.toLowerCase();
    rows = rows.filter(r => (r.name||'').toLowerCase().includes(k) || (r.notes||'').toLowerCase().includes(k));
  }
  if(cat) rows = rows.filter(r => r.category === cat);
  if(stor) rows = rows.filter(r => (r.storage||'') === stor);
  if(expf === 'near') rows = rows.filter(r => isNearExpiry(r.expiryDate));
  if(expf === 'expired') rows = rows.filter(r => r.expiryDate < todayISO());

  tbody.innerHTML = '';

  if(rows.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8">No items found. Please adjust your filters.</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((item)=>{
    const tr = document.createElement('tr');
    const near = isNearExpiry(item.expiryDate);
    const expired = item.expiryDate < todayISO();

    const statusPill = expired ? '<span class="pill expired">Expired</span>'
                      : near ? '<span class="pill near">Near Expiry</span>'
                      : item.status === 'donated' ? '<span class="pill donated">Donated</span>'
                      : '<span class="pill active">Active</span>';

    const kw = (searchInput?.value || '').trim();

    tr.innerHTML = `
      <td><input type="checkbox" class="row-select" data-id="${item.id}"></td>
      <td>
        ${highlight(item.name, kw)}
        <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span>
      </td>
      <td>${item.quantity}</td>
      <td>${item.expiryDate} ${statusPill}</td>
      <td>${item.category}</td>
      <td>${escapeHtml(item.storage||'')}</td>
      <td>${highlight(item.notes||'', kw)}</td>
      <td>
        <div class="row-actions">
          <button class="edit" data-id="${item.id}">Edit</button>
          <button class="use" data-id="${item.id}">Mark as Used</button>
          <button class="donate" data-id="${item.id}">Convert to Donation</button>
          <button class="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // bind row action buttons
  tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', onEdit));
  tbody.querySelectorAll('.use').forEach(b => b.addEventListener('click', onMarkUsed));
  tbody.querySelectorAll('.donate').forEach(b => b.addEventListener('click', onConvertDonation));
  tbody.querySelectorAll('.delete').forEach(b => b.addEventListener('click', onDelete));
}

/* ========= Add Item (US1) with auto-barcode ========= */
foodForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const expiryDate = document.getElementById('expiryDate').value;
  const category = document.getElementById('category').value;
  const storage = document.getElementById('storage').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if(!name || !quantity || !expiryDate || !category){
    showToast('Please complete all required fields.', 'error');
    return;
  }
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error');
    return;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)){
    showToast('Please enter a valid expiry date (YYYY-MM-DD).', 'error');
    return;
  }

  // 重复：仅按 name（忽略大小写） 合并数量
  const dupIndex = inventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
  if(dupIndex >= 0){
    const ok = confirm('An item with the same name already exists.\nDo you want to merge the quantity?');
    if(ok){
      inventory[dupIndex].quantity += quantity;
      persistAll(); render();
      showToast('Quantity merged into existing item.');
      foodForm.reset();
    }
    return;
  }

  const item = {
    id: uid(),
    name, quantity, expiryDate, category, storage, notes,
    timestamp: Date.now(),
    status: 'active',
    linkedDonationId: null,
    linkedMealId: null,
    barcode: generateBarcode() // ✅ 自动生成条码
  };
  inventory.push(item);
  persistAll(); render();
  showToast('Item added successfully.');
  foodForm.reset();
});

/* ========= Edit / Delete / Use (原逻辑保持不变) ========= */
function onEdit(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = inventory.find(i => i.id === id);
  if(!item) return;
  document.getElementById('editIndex').value = id;
  document.getElementById('editName').value = item.name;
  document.getElementById('editQuantity').value = item.quantity;
  document.getElementById('editExpiry').value = item.expiryDate;
  document.getElementById('editCategory').value = item.category;
  document.getElementById('editStorage').value = item.storage || '';
  document.getElementById('editNotes').value = item.notes || '';
  openModal(editModal);
}
editForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = document.getElementById('editIndex').value;
  const name = document.getElementById('editName').value.trim();
  const quantity = Number(document.getElementById('editQuantity').value);
  const expiry = document.getElementById('editExpiry').value;
  const category = document.getElementById('editCategory').value;
  const storage = document.getElementById('editStorage').value.trim();
  const notes = document.getElementById('editNotes').value.trim();

  if(!name || !quantity || !expiry || !category){
    showToast('Please complete all required fields.', 'error'); return;
  }
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error'); return;
  }

  const idx = inventory.findIndex(i => i.id === id);
  if(idx < 0) return;

  inventory[idx] = { ...inventory[idx], name, quantity, expiryDate: expiry, category, storage, notes };
  persistAll(); render(); closeModal(editModal);
  showToast('Item updated successfully.');
});
editModal.querySelector('.cancelBtn').addEventListener('click', ()=> closeModal(editModal));

function onDelete(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = inventory.find(i => i.id === id);
  if(!item) return;

  if(item.linkedDonationId){
    const ok = confirm('This item is tied to a donation. Are you sure?');
    if(!ok) return;
  }else{
    const ok = confirm('Delete this item?');
    if(!ok) return;
  }

  inventory = inventory.filter(i => i.id !== id);
  persistAll(); render();
  showToast('Item deleted.');
}

function onMarkUsed(e){
  const id = e.currentTarget.getAttribute('data-id');
  const idx = inventory.findIndex(i => i.id === id);
  if(idx < 0) return;

  const item = inventory[idx];

  let used = 1;
  const input = prompt('Enter quantity used:', '1');
  if(input !== null){
    const n = Number(input);
    if(Number.isFinite(n) && n > 0){ used = n; }
  }

  const prev = {...item};
  undoStack.push({ type:'used', before: prev });
  if(undoStack.length > 20) undoStack.shift();

  item.quantity -= used;
  if(item.quantity <= 0){
    inventory.splice(idx,1);
    showToast('Item fully used and removed from inventory.');
  }else{
    inventory[idx] = item;
    showToast('Quantity updated.');
  }

  // reserved meal sync (placeholder)
  persistAll(); render();

  setTimeout(()=>{
    if(confirm('Undo last "Mark as Used"?')){
      const last = undoStack.pop();
      if(last && last.type==='used'){
        const bi = inventory.findIndex(x => x.id === (last.before.id));
        if(bi >= 0){
          inventory[bi] = last.before;
        }else{
          inventory.push(last.before);
        }
        persistAll(); render();
        showToast('Undo successful.');
      }
    }
  }, 200);
}

/* ========= Convert to Donation (保持原逻辑；任务2再改为移走) ========= */
let donationTargetId = null;
function onConvertDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  donationTargetId = id;
  donationForm.reset();
  openModal(donationModal);
}
donationForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const pickupLocation = document.getElementById('pickupLocation').value.trim();
  const availability = document.getElementById('availability').value.trim();
  const donationNotes = document.getElementById('donationNotes').value.trim();

  if(!pickupLocation || !availability){
    showToast('Please fill pickup location and availability.', 'error'); return;
  }

  const idx = inventory.findIndex(i => i.id === donationTargetId);
  if(idx < 0){ closeModal(donationModal); return; }

  const item = inventory[idx];

  const donationId = 'd_' + uid();
  donations.push({
    id: donationId,
    itemRef: item.id,
    name: item.name,
    quantity: item.quantity,
    expiryDate: item.expiryDate,
    pickupLocation, availability,
    notes: donationNotes,
    createdAt: Date.now(),
    status: 'open',
    barcode: item.barcode || null
  });

  // 任务2会把它移到 Donation list；此处暂保留状态为 donated
  inventory[idx].status = 'donated';
  inventory[idx].linkedDonationId = donationId;

  persistAll(); render(); closeModal(donationModal);
  showToast('Donation listing created.');
});
donationModal.querySelector('.cancelBtn').addEventListener('click', ()=> closeModal(donationModal));

/* ========= Search & Filters ========= */
[searchInput, filterCategory, filterStorage, filterExpiry].forEach(el=> el && el.addEventListener('input', render));
clearFiltersBtn?.addEventListener('click', ()=>{
  if(searchInput) searchInput.value = '';
  if(filterCategory) filterCategory.value = '';
  if(filterStorage) filterStorage.value = '';
  if(filterExpiry) filterExpiry.value = '';
  render();
});

/* ========= Batch Actions (保持原逻辑；任务3再修复) ========= */
selectAll?.addEventListener('change', ()=>{
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked);
});
function getSelectedIds(){
  return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => cb.getAttribute('data-id'));
}
batchEditBtn?.addEventListener('click', ()=> showToast('Batch features will be fixed in Task 3.', 'warn'));
batchUsedBtn?.addEventListener('click', ()=> showToast('Batch features will be fixed in Task 3.', 'warn'));
batchDeleteBtn?.addEventListener('click', ()=> showToast('Batch features will be fixed in Task 3.', 'warn'));
batchDonateBtn?.addEventListener('click', ()=> showToast('Batch features will be fixed in Task 3.', 'warn'));

/* ========= Add via Barcode (任务1核心) ========= */
scanBtn.addEventListener('click', ()=>{
  const code = prompt('Enter barcode number:','');
  if(code === null || code.trim()===''){ return; }
  const barcode = code.trim();

  let preset = KNOWN_BARCODES[barcode];
  let item;

  if(preset){
    // 已知条码：使用预设 & 默认保质期
    item = {
      id: uid(),
      name: preset.name,
      quantity: 1,
      expiryDate: addDaysISO(preset.defaultDays || 7),
      category: preset.category || 'Others',
      storage: preset.storage || '',
      notes: '',
      timestamp: Date.now(),
      status: 'active',
      linkedDonationId: null,
      linkedMealId: null,
      barcode // 使用用户输入的条码
    };
    // 按名称忽略大小写合并
    const dupIndex = inventory.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
    if(dupIndex >= 0){
      inventory[dupIndex].quantity += item.quantity;
      if(!inventory[dupIndex].barcode) inventory[dupIndex].barcode = barcode;
      showToast('Recognized barcode. Quantity merged.');
    }else{
      inventory.push(item);
      showToast('Recognized barcode. Item added.');
    }
  }else{
    // 未知条码：按默认模板直接创建，方便后续编辑
    item = {
      id: uid(),
      name: `Unknown (${barcode})`,
      quantity: 1,
      expiryDate: addDaysISO(7),
      category: 'Others',
      storage: '',
      notes: 'Added via barcode (unknown). Please edit details.',
      timestamp: Date.now(),
      status: 'active',
      linkedDonationId: null,
      linkedMealId: null,
      barcode
    };
    // 以名称忽略大小写合并
    const dupIndex = inventory.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
    if(dupIndex >= 0){
      inventory[dupIndex].quantity += item.quantity;
      if(!inventory[dupIndex].barcode) inventory[dupIndex].barcode = barcode;
      showToast('Unknown barcode. Quantity merged.');
    }else{
      inventory.push(item);
      showToast('Unknown barcode. Placeholder item added.');
    }
  }

  persistAll(); render();
});

/* ========= Init ========= */
render();
