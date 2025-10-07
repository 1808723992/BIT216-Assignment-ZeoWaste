/* ========= Data Model & Storage ========= */
const STORAGE_KEYS = {
  INVENTORY: 'sp_inventory',
  DONATIONS: 'sp_donations',
  UNDO: 'sp_undo_stack'
};

let inventory = load(STORAGE_KEYS.INVENTORY) || [];   // [{id,name,quantity,expiryDate,category,storage,notes,timestamp,status,linkedDonationId,linkedMealId,barcode}]
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

/* Scan Button (placeholder) */
const scanBtn = document.getElementById('scanBtn');

/* ========= Utilities ========= */
function uid(){ return 'i_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysBetween(aISO, bISO){
  const a = new Date(aISO + 'T00:00:00'); const b = new Date(bISO + 'T00:00:00');
  return Math.floor((a - b) / (1000*60*60*24));
}
function isExpired(expiry){ return daysBetween(todayISO(), expiry) > 0 && expiry < todayISO(); }
function isNearExpiry(expiry){ 
  const d = daysBetween(expiry, todayISO()); // expiry - today
  // near if within next 3 days (today or future within 3)
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
  const safe = escapeHtml(text);
  const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ========= Rendering ========= */
function render(){
  const kw = (searchInput.value || '').trim();
  const cat = filterCategory.value;
  const stor = filterStorage.value;
  const expf = filterExpiry.value;

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

    const kw = (searchInput.value || '').trim();

    tr.innerHTML = `
      <td><input type="checkbox" class="row-select" data-id="${item.id}"></td>
      <td>${highlight(item.name, kw)}</td>
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

/* ========= Add Item (US1) ========= */
foodForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const expiryDate = document.getElementById('expiryDate').value;
  const category = document.getElementById('category').value;
  const storage = document.getElementById('storage').value.trim();
  const notes = document.getElementById('notes').value.trim();

  // validation: required
  if(!name || !quantity || !expiryDate || !category){
    showToast('Please complete all required fields.', 'error');
    return;
  }
  // validation: numeric quantity
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error');
    return;
  }
  // validation: date format simple
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)){
    showToast('Please enter a valid expiry date (YYYY-MM-DD).', 'error');
    return;
  }

  // duplicate detection: same name + expiry
  const dupIndex = inventory.findIndex(i => i.name.toLowerCase() === name.toLowerCase() && i.expiryDate === expiryDate);
  if(dupIndex >= 0){
    const ok = confirm('This item already exists. Do you want to update count instead?');
    if(ok){
      inventory[dupIndex].quantity += quantity;
      persistAll(); render();
      showToast('Quantity updated successfully.');
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
    barcode: null
  };
  inventory.push(item);
  persistAll(); render();
  showToast('Item added successfully.');
  foodForm.reset();
});

/* ========= Edit Item (US2) ========= */
function onEdit(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = inventory.find(i => i.id === id);
  if(!item) return;
  // prefill
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

/* ========= Delete Item (US2) ========= */
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

/* ========= Mark as Used (US3) ========= */
function onMarkUsed(e){
  const id = e.currentTarget.getAttribute('data-id');
  const idx = inventory.findIndex(i => i.id === id);
  if(idx < 0) return;

  const item = inventory[idx];

  // optional: prompt used count
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
    // remove from inventory
    inventory.splice(idx,1);
    showToast('Item fully used and removed from inventory.');
  }else{
    // keep updated
    inventory[idx] = item;
    showToast('Quantity updated.');
  }

  // sync with meal plan if reserved (placeholder)
  if(item.linkedMealId){
    // here you would update meal plan resource usage
    // placeholder: no-op
  }

  persistAll(); render();

  // offer undo
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

/* ========= Convert to Donation (US4) ========= */
let donationTargetId = null;
function onConvertDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  donationTargetId = id;
  // reset donation form
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

  // create donation record
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
    status: 'open'
  });

  // mark inventory item as donated (or remove from active list)
  inventory[idx].status = 'donated';
  inventory[idx].linkedDonationId = donationId;

  persistAll(); render(); closeModal(donationModal);
  showToast('Donation listing created.');
});
donationModal.querySelector('.cancelBtn').addEventListener('click', ()=> closeModal(donationModal));

/* ========= Search & Filters (US5) ========= */
[searchInput, filterCategory, filterStorage, filterExpiry].forEach(el=> el.addEventListener('input', render));
clearFiltersBtn.addEventListener('click', ()=>{
  searchInput.value = '';
  filterCategory.value = '';
  filterStorage.value = '';
  filterExpiry.value = '';
  render();
});

/* ========= Batch Actions (US6) ========= */
selectAll.addEventListener('change', ()=>{
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked);
});
function getSelectedIds(){
  return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => cb.getAttribute('data-id'));
}

batchEditBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length === 0){ showToast('Select items first.', 'warn'); return; }
  const newStorage = prompt('Enter new storage for selected items (e.g. Fridge/Pantry):', '');
  if(newStorage === null) return;

  let ok=0;
  ids.forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx>=0){ inventory[idx].storage = newStorage; ok++; }
  });
  persistAll(); render();
  showToast(`Updated storage for ${ok} item(s).`);
});

batchUsedBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length === 0){ showToast('Select items first.', 'warn'); return; }
  const used = Number(prompt('Enter quantity to use for each selected item:', '1'));
  if(!Number.isFinite(used) || used <= 0){ showToast('Invalid quantity.', 'error'); return; }

  let removed=0, updated=0;
  ids.forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx<0) return;
    const prev = {...inventory[idx]};
    undoStack.push({type:'used', before: prev});
    inventory[idx].quantity -= used;
    if(inventory[idx].quantity <= 0){
      inventory.splice(idx,1);
      removed++;
    }else{
      updated++;
    }
  });
  persistAll(); render();
  showToast(`Batch used: ${updated} updated, ${removed} removed.`);
});

batchDeleteBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length === 0){ showToast('Select items first.', 'warn'); return; }
  const tie = ids.some(id => {
    const it = inventory.find(i => i.id === id);
    return it && it.linkedDonationId;
  });
  const msg = tie ? 'Some items are tied to a donation. Proceed to delete?' : 'Delete selected items?';
  if(!confirm(msg)) return;

  let count=0;
  ids.forEach(id=>{
    const before = inventory.length;
    inventory = inventory.filter(i => i.id !== id);
    if(inventory.length < before) count++;
  });
  persistAll(); render();
  showToast(`Deleted ${count} item(s).`);
});

batchDonateBtn.addEventListener('click', ()=>{
  const ids = getSelectedIds();
  if(ids.length === 0){ showToast('Select items first.', 'warn'); return; }

  const pickupLocation = prompt('Pickup Location for selected items:', '');
  if(pickupLocation === null || pickupLocation.trim()===''){ showToast('Pickup location is required.', 'error'); return; }
  const availability = prompt('Availability time (e.g. 10 AM – 5 PM):', '');
  if(availability === null || availability.trim()===''){ showToast('Availability time is required.', 'error'); return; }

  let created=0;
  ids.forEach(id=>{
    const idx = inventory.findIndex(i => i.id === id);
    if(idx<0) return;
    const it = inventory[idx];
    const donationId = 'd_' + uid();
    donations.push({
      id: donationId,
      itemRef: it.id,
      name: it.name,
      quantity: it.quantity,
      expiryDate: it.expiryDate,
      pickupLocation, availability,
      notes: '',
      createdAt: Date.now(),
      status: 'open'
    });
    inventory[idx].status = 'donated';
    inventory[idx].linkedDonationId = donationId;
    created++;
  });
  persistAll(); render();
  showToast(`Created ${created} donation listing(s).`);
});

/* ========= Barcode Add (US7 placeholder) ========= */
scanBtn.addEventListener('click', ()=>{
  // In real app, integrate camera + barcode SDK; here we simulate
  const code = prompt('Simulate scan: enter barcode number', '');
  if(code === null) return;

  // pretend we know some codes
  const known = {
    '9555555555555': { name:'Mackerel Can', category:'Canned', storage:'Pantry' },
    '9550000123456': { name:'Frozen Dumplings', category:'Frozen', storage:'Freezer' },
  };
  const found = known[code];
  // prefill form
  if(found){
    document.getElementById('itemName').value = found.name;
    document.getElementById('category').value = found.category;
    document.getElementById('storage').value = found.storage;
    showToast('Barcode recognized. Fields pre-filled.');
  }else{
    showToast('Unknown barcode. Please fill fields manually.', 'warn');
  }
});

/* ========= Init ========= */
render();
