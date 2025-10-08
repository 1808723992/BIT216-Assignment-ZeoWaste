/* ========= Data Model & Storage ========= */
const STORAGE_KEYS = {
  INVENTORY: 'sp_inventory',
  DONATIONS: 'sp_donations',   // history log only
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
const donationTbody = document.querySelector('#donationTable tbody');
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
function addDaysISO(days){ const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function isNearExpiry(expiry){ const diff = Math.floor((new Date(expiry)-new Date(todayISO()))/(1000*60*60*24)); return diff>=0 && diff<=3; }

function showToast(msg, type=''){
  notificationEl.textContent = msg;
  notificationEl.className = 'notification' + (type ? ' ' + type : '');
  notificationEl.classList.remove('hidden');
  setTimeout(()=> notificationEl.classList.add('hidden'), 2200);
}
function closeModal(node){ node.classList.add('hidden'); }
function openModal(node){ node.classList.remove('hidden'); }

function highlight(text, keyword){
  if(!keyword) return escapeHtml(text||'');
  const safe = escapeHtml(text||'');
  const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ========= Enumerations ========= */
const ALLOWED_CATEGORIES = ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'];
const ALLOWED_STORAGE = ['Fridge','Freezer','Pantry'];

/* ========= Barcode helpers ========= */
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

/* Map known barcodes to NEW categories */
const KNOWN_BARCODES = {
  '9555555555555': { name:'Mackerel Can', category:'Meat',   storage:'Pantry',  defaultDays: 365 },
  '9550000123456': { name:'Frozen Dumplings', category:'Grains', storage:'Freezer', defaultDays: 90 },
};

/* ========= Rendering ========= */
function bindRowSelectionEvents(){
  const rowCbs = tbody.querySelectorAll('.row-select');
  rowCbs.forEach(cb => cb.addEventListener('change', ()=>{
    const all = tbody.querySelectorAll('.row-select').length;
    const sel = tbody.querySelectorAll('.row-select:checked').length;
    if(selectAll) selectAll.checked = (all>0 && sel === all);
  }));
}

function renderInventory(){
  if(selectAll) selectAll.checked = false;

  const kw = (searchInput?.value || '').trim();
  const cat = filterCategory?.value || '';
  const stor = filterStorage?.value || '';
  const expf = filterExpiry?.value || '';

  // ✅ Active only（避免 completed 出现在库存）
  let rows = inventory.filter(r => r.status === 'active');

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
                      : '<span class="pill active">Active</span>';
    const k = (searchInput?.value || '').trim();

    tr.innerHTML = `
      <td><input type="checkbox" class="row-select" data-id="${item.id}"></td>
      <td>
        ${highlight(item.name, k)}
        <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span>
      </td>
      <td>${item.quantity}</td>
      <td>${item.expiryDate} ${statusPill}</td>
      <td>${item.category}</td>
      <td>${escapeHtml(item.storage||'')}</td>
      <td>${highlight(item.notes||'', k)}</td>
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

  tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', onEdit));
  tbody.querySelectorAll('.use').forEach(b => b.addEventListener('click', onMarkUsed));
  tbody.querySelectorAll('.donate').forEach(b => b.addEventListener('click', onConvertDonation));
  tbody.querySelectorAll('.delete').forEach(b => b.addEventListener('click', onDelete));

  bindRowSelectionEvents();
}

function renderDonationList(){
  let rows = inventory.filter(r => r.status === 'donated');

  donationTbody.innerHTML = '';
  if(rows.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9">No donation items.</td>`;
    donationTbody.appendChild(tr);
    return;
  }

  rows.forEach(item=>{
    const details = item.donationDetails || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        ${escapeHtml(item.name)}
        <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span>
      </td>
      <td>${item.quantity}</td>
      <td>${item.expiryDate}</td>
      <td>${item.category}</td> <!-- hidden by HTML style -->
      <td>${escapeHtml(item.storage||'')}</td> <!-- hidden -->
      <td>${escapeHtml(item.notes||'')}</td>   <!-- hidden -->
      <td>${escapeHtml(details.pickupLocation || '')}</td>
      <td>${escapeHtml(details.availability || '')}</td>
      <td>
        <div class="row-actions">
          <button class="edit-donation" data-id="${item.id}">Withdraw</button>
          <button class="complete-donation" data-id="${item.id}">Complete</button>
        </div>
      </td>
    `;
    donationTbody.appendChild(tr);
  });

  donationTbody.querySelectorAll('.edit-donation').forEach(b => b.addEventListener('click', onWithdrawDonation));
  donationTbody.querySelectorAll('.complete-donation').forEach(b => b.addEventListener('click', onCompleteDonation));
}

function render(){ renderInventory(); renderDonationList(); }

/* ========= Add Item with required storage & new categories ========= */
foodForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const expiryDate = document.getElementById('expiryDate').value;
  const category = document.getElementById('category').value;
  const storage = document.getElementById('storage').value; // select
  const notes = document.getElementById('notes').value.trim();

  if(!name || !quantity || !expiryDate || !category || !storage){
    showToast('Please complete all required fields.', 'error'); return;
  }
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error'); return;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)){
    showToast('Please enter a valid expiry date (YYYY-MM-DD).', 'error'); return;
  }
  if(!ALLOWED_CATEGORIES.includes(category)){
    showToast('Invalid category.', 'error'); return;
  }
  if(!ALLOWED_STORAGE.includes(storage)){
    showToast('Invalid storage.', 'error'); return;
  }

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
    donationDetails: null,
    linkedDonationId: null,
    linkedMealId: null,
    barcode: generateBarcode()
  };
  inventory.push(item);
  persistAll(); render();
  showToast('Item added successfully.');
  foodForm.reset();
});

/* ========= Edit / Delete / Use ========= */
function onEdit(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = inventory.find(i => i.id === id);
  if(!item) return;
  document.getElementById('editIndex').value = id;
  document.getElementById('editName').value = item.name;
  document.getElementById('editQuantity').value = item.quantity;
  document.getElementById('editExpiry').value = item.expiryDate;
  document.getElementById('editCategory').value = ALLOWED_CATEGORIES.includes(item.category) ? item.category : 'Grains';
  document.getElementById('editStorage').value = ALLOWED_STORAGE.includes(item.storage) ? item.storage : '';
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
  const storage = document.getElementById('editStorage').value;
  const notes = document.getElementById('editNotes').value.trim();

  if(!name || !quantity || !expiry || !category || !storage){
    showToast('Please complete all required fields.', 'error'); return;
  }
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error'); return;
  }
  if(!ALLOWED_CATEGORIES.includes(category)){
    showToast('Invalid category.', 'error'); return;
  }
  if(!ALLOWED_STORAGE.includes(storage)){
    showToast('Invalid storage.', 'error'); return;
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

  if(item.status === 'donated' || item.linkedDonationId){
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

  persistAll(); render();

  setTimeout(()=>{
    if(confirm('Undo last "Mark as Used"?')){
      const last = undoStack.pop();
      if(last && last.type==='used'){
        const bi = inventory.findIndex(x => x.id === (last.before.id));
        if(bi >= 0){ inventory[bi] = last.before; } else { inventory.push(last.before); }
        persistAll(); render();
        showToast('Undo successful.');
      }
    }
  }, 200);
}

/* ========= Convert / Withdraw / Complete Donation ========= */
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

  inventory[idx].status = 'donated';
  inventory[idx].donationDetails = { pickupLocation, availability, donatedAt: Date.now() };
  inventory[idx].linkedDonationId = inventory[idx].linkedDonationId || ('d_' + uid());

  donations.push({
    id: inventory[idx].linkedDonationId,
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

  persistAll(); render(); closeModal(donationModal);
  showToast('Donation created.');
});
function onWithdrawDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  const idx = inventory.findIndex(i => i.id === id);
  if(idx < 0) return;

  const ok = confirm('Withdraw this donation and move it back to active inventory?');
  if(!ok) return;

  inventory[idx].status = 'active';
  inventory[idx].donationDetails = null;

  // 留存 donation log 状态
  const did = inventory[idx].linkedDonationId;
  if(did){
    const dIndex = donations.findIndex(d=>d.id === did);
    if(dIndex >= 0){ donations[dIndex].status = 'withdrawn'; donations[dIndex].withdrawnAt = Date.now(); }
  }

  persistAll(); render();
  showToast('Donation withdrawn.');
}

/* ✅ 新增：Complete Donation */
function onCompleteDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  const idx = inventory.findIndex(i => i.id === id);
  if(idx < 0) return;

  const ok = confirm('Mark this donation as completed?');
  if(!ok) return;

  // 标记完成（从 Donation List 过滤掉）
  inventory[idx].status = 'completed';
  if(!inventory[idx].donationDetails) inventory[idx].donationDetails = {};
  inventory[idx].donationDetails.completedAt = Date.now();

  // 更新 donation 历史日志
  const did = inventory[idx].linkedDonationId;
  if(did){
    const dIndex = donations.findIndex(d=>d.id === did);
    if(dIndex >= 0){ donations[dIndex].status = 'completed'; donations[dIndex].completedAt = Date.now(); }
  }

  persistAll(); render();
  showToast('Donation completed.');
}

/* ========= Search & Filters ========= */
[searchInput, filterCategory, filterStorage, filterExpiry].forEach(el=> el && el.addEventListener('input', render));
clearFiltersBtn?.addEventListener('click', ()=>{
  if(searchInput) searchInput.value = '';
  if(filterCategory) filterCategory.value = '';
  if(filterStorage) filterStorage.value = '';
  if(filterExpiry) filterExpiry.value = '';
  render();
});

/* ========= Batch Actions ========= */
selectAll?.addEventListener('change', ()=>{
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked);
});
function getSelectedIds(){
  return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => cb.getAttribute('data-id'));
}

/* Batch Edit Storage (validate enum) */
batchEditBtn?.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  const input = prompt('Enter new storage (Fridge / Freezer / Pantry):','');
  if(input === null) return;

  const norm = (input||'').trim().toLowerCase();
  const map = {fridge:'Fridge', freezer:'Freezer', pantry:'Pantry'};
  const newStorage = map[norm];
  if(!newStorage){ showToast('Invalid storage. Use: Fridge / Freezer / Pantry', 'error'); return; }

  let updated=0, skipped=[];
  ids.forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx<0) return;
    const it = inventory[idx];
    if(it.status === 'donated'){ skipped.push(`${it.name} (#${it.barcode||'-'}): donated item`); return; }
    inventory[idx].storage = newStorage;
    updated++;
  });
  persistAll(); render();
  showToast(`Updated storage for ${updated} item(s).`);
  if(skipped.length) alert('Skipped:\n' + skipped.join('\n'));
});

/* Batch Mark as Used */
batchUsedBtn?.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  const used = Number(prompt('Enter quantity to use for each selected item:','1'));
  if(!Number.isFinite(used) || used<=0){ showToast('Invalid quantity.', 'error'); return; }

  let updated=0, removed=0, skipped=[];
  ids.slice().forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx<0) return;
    const it = inventory[idx];
    if(it.status === 'donated'){ skipped.push(`${it.name} (#${it.barcode||'-'}): donated item`); return; }

    const prev = {...it};
    undoStack.push({type:'used', before: prev});
    if(undoStack.length > 20) undoStack.shift();

    it.quantity -= used;
    if(it.quantity <= 0){ inventory.splice(idx,1); removed++; }
    else { inventory[idx] = it; updated++; }
  });

  persistAll(); render();
  showToast(`Batch used → ${updated} updated, ${removed} removed.`);
  if(skipped.length) alert('Skipped:\n' + skipped.join('\n'));
});

/* Batch Delete */
batchDeleteBtn?.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }

  const hasDonationLinked = ids.some(id=>{
    const it = inventory.find(i=>i.id===id);
    return it && (it.status==='donated' || it.linkedDonationId);
  });
  const msg = hasDonationLinked
    ? 'Some selected items are tied to a donation. Proceed to delete?'
    : 'Delete selected items?';
  if(!confirm(msg)) return;

  let deleted=0;
  ids.slice().forEach(id=>{
    const beforeLen = inventory.length;
    inventory = inventory.filter(i => i.id !== id);
    if(inventory.length < beforeLen) deleted++;
  });
  persistAll(); render();
  showToast(`Deleted ${deleted} item(s).`);
});

/* Batch Convert to Donation */
batchDonateBtn?.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }

  const pickupLocation = prompt('Pickup Location for selected items:', '');
  if(pickupLocation === null || pickupLocation.trim()===''){ showToast('Pickup location is required.', 'error'); return; }
  const availability = prompt('Availability time (e.g. 10 AM – 5 PM):', '');
  if(availability === null || availability.trim()===''){ showToast('Availability time is required.', 'error'); return; }

  let created=0, skipped=[];
  ids.forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx<0) return;
    const it = inventory[idx];
    if(it.status === 'donated'){ skipped.push(`${it.name} (#${it.barcode||'-'}): already donated`); return; }

    inventory[idx].status = 'donated';
    inventory[idx].donationDetails = { pickupLocation, availability, donatedAt: Date.now() };
    inventory[idx].linkedDonationId = inventory[idx].linkedDonationId || ('d_' + uid());

    donations.push({
      id: inventory[idx].linkedDonationId,
      itemRef: it.id,
      name: it.name,
      quantity: it.quantity,
      expiryDate: it.expiryDate,
      pickupLocation, availability,
      notes: '',
      createdAt: Date.now(),
      status: 'open',
      barcode: it.barcode || null
    });
    created++;
  });

  persistAll(); render();
  showToast(`Converted ${created} item(s) to donation.`);
  if(skipped.length) alert('Skipped:\n' + skipped.join('\n'));
});

/* ========= Add via Barcode ========= */
scanBtn.addEventListener('click', ()=>{
  const code = prompt('Enter barcode number:','');
  if(code === null || code.trim()===''){ return; }
  const barcode = code.trim();

  let preset = KNOWN_BARCODES[barcode];
  let item;

  if(preset){
    item = {
      id: uid(),
      name: preset.name,
      quantity: 1,
      expiryDate: addDaysISO(preset.defaultDays || 7),
      category: ALLOWED_CATEGORIES.includes(preset.category)? preset.category : 'Grains',
      storage: ALLOWED_STORAGE.includes(preset.storage)? preset.storage : 'Pantry',
      notes: '',
      timestamp: Date.now(),
      status: 'active',
      donationDetails: null,
      linkedDonationId: null,
      linkedMealId: null,
      barcode
    };
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
    item = {
      id: uid(),
      name: `Unknown (${barcode})`,
      quantity: 1,
      expiryDate: addDaysISO(7),
      category: 'Grains',
      storage: 'Pantry',
      notes: 'Added via barcode (unknown). Please edit details.',
      timestamp: Date.now(),
      status: 'active',
      donationDetails: null,
      linkedDonationId: null,
      linkedMealId: null,
      barcode
    };
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
