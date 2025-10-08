/* =======================
   Manage Food Inventory – PHP API version
   Backend: PHP + XAMPP (items.php / action.php)
   ======================= */

/* ===== API base ===== */
const API_BASE = 'http://localhost/saveplate-api';

/* ===== Enumerations (front-end validation) ===== */
const ALLOWED_CATEGORIES = ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'];
const ALLOWED_STORAGE    = ['Fridge','Freezer','Pantry'];

/* ===== Known barcodes map (prefill) ===== */
const KNOWN_BARCODES = {
  '9555555555555': { name:'Mackerel Can', category:'Meat',   storage:'Pantry',  defaultDays: 365 },
  '9550000123456': { name:'Frozen Dumplings', category:'Grains', storage:'Freezer', defaultDays: 90 }
};

/* ===== DOM refs ===== */
const notificationEl = document.getElementById('notification');

/* Inventory table */
const invTbody      = document.querySelector('#inventoryTable tbody');
const selectAll     = document.getElementById('selectAll');

/* Donation table */
const donationTbody = document.querySelector('#donationTable tbody');

/* Forms */
const foodForm   = document.getElementById('foodForm');
const editModal  = document.getElementById('editModal');
const editForm   = document.getElementById('editForm');
const donationModal = document.getElementById('donationModal');
const donationForm  = document.getElementById('donationForm');

/* Filters */
const searchInput   = document.getElementById('searchInput');
const filterCategory= document.getElementById('filterCategory');
const filterStorage = document.getElementById('filterStorage');
const filterExpiry  = document.getElementById('filterExpiry');
const clearFiltersBtn = document.getElementById('clearFilters');

/* Batch */
const batchEditBtn   = document.getElementById('batchEdit');
const batchUsedBtn   = document.getElementById('batchUsed');
const batchDeleteBtn = document.getElementById('batchDelete');
const batchDonateBtn = document.getElementById('batchDonate');

/* Barcode */
const scanBtn = document.getElementById('scanBtn');

/* ===== Local caches (from server) ===== */
let cacheActive  = [];  // status=active
let cacheDonated = [];  // status=donated

/* For undo of "Mark as Used" */
let undoStack = [];     // [{ beforeItem, removed:Boolean }]

/* ===== Helpers ===== */
function showToast(msg, type=''){
  if(!notificationEl) return;
  notificationEl.textContent = msg;
  notificationEl.className = 'notification' + (type ? ' ' + type : '');
  notificationEl.classList.remove('hidden');
  setTimeout(()=>notificationEl.classList.add('hidden'), 2200);
}
function escapeHtml(str=''){ return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function highlight(text, keyword){
  if(!keyword) return escapeHtml(text||'');
  const safe = escapeHtml(text||'');
  const re = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDaysISO(days){ const d = new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function isNearExpiry(expiry){
  const diff = Math.floor((new Date(expiry) - new Date(todayISO()))/(1000*60*60*24));
  return diff>=0 && diff<=3;
}

/* ===== API client ===== */
const api = {
  async list({ q='', category='', storage='', status='', expiry='' } = {}){
    const p = new URLSearchParams();
    if(q) p.set('q', q);
    if(category) p.set('category', category);
    if(storage) p.set('storage', storage);
    if(status) p.set('status', status);
    if(expiry) p.set('expiry', expiry);
    const url = `${API_BASE}/items.php${p.toString() ? ('?' + p.toString()) : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'List failed');
    return json.data || [];
  },
  async create(item){ // {name,category,storage,quantity,expiry_date,notes,barcode?}
    const res = await fetch(`${API_BASE}/items.php`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(item)
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'Create failed');
    return json.data;
  },
  async update(id, item){ // PUT all required fields
    const res = await fetch(`${API_BASE}/items.php?id=${encodeURIComponent(id)}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(item)
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'Update failed');
    return json.data;
  },
  async remove(id){
    const res = await fetch(`${API_BASE}/items.php?id=${encodeURIComponent(id)}`, { method:'DELETE' });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'Delete failed');
    return json.data;
  },
  async action(payload){ // {action:'use'|'donate'|'withdraw'|'complete', id, ...}
    const res = await fetch(`${API_BASE}/action.php`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || 'Action failed');
    return json.data;
  }
};

/* ===== Rendering ===== */
async function renderInventory(){
  try{
    const q = (searchInput?.value || '').trim();
    const category = filterCategory?.value || '';
    const storage  = filterStorage?.value  || '';
    const expiry   = filterExpiry?.value   || '';

    cacheActive = await api.list({ q, category, storage, status: 'active', expiry });

    if(selectAll) selectAll.checked = false;
    invTbody.innerHTML = '';

    if(cacheActive.length === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8">No items found. Please adjust your filters.</td>`;
      invTbody.appendChild(tr);
      return;
    }

    cacheActive.forEach(item=>{
      const near = isNearExpiry(item.expiry_date);
      const expired = item.expiry_date < todayISO();
      const pill = expired ? '<span class="pill expired">Expired</span>'
                :  near   ? '<span class="pill near">Near Expiry</span>'
                           : '<span class="pill active">Active</span>';
      const k = (searchInput?.value || '').trim();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select" data-id="${item.id}"></td>
        <td>
          ${highlight(item.name, k)}
          <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span>
        </td>
        <td>${item.quantity}</td>
        <td>${item.expiry_date} ${pill}</td>
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
      invTbody.appendChild(tr);
    });

    invTbody.querySelectorAll('.edit')  .forEach(b=>b.addEventListener('click', onEdit));
    invTbody.querySelectorAll('.use')   .forEach(b=>b.addEventListener('click', onMarkUsed));
    invTbody.querySelectorAll('.donate').forEach(b=>b.addEventListener('click', onConvertDonation));
    invTbody.querySelectorAll('.delete').forEach(b=>b.addEventListener('click', onDelete));

    // selection sync
    invTbody.querySelectorAll('.row-select').forEach(cb => cb.addEventListener('change', ()=>{
      const all = invTbody.querySelectorAll('.row-select').length;
      const sel = invTbody.querySelectorAll('.row-select:checked').length;
      if(selectAll) selectAll.checked = (all>0 && sel===all);
    }));
  }catch(err){
    console.error(err);
    showToast('Failed to load inventory.', 'error');
  }
}

async function renderDonationList(){
  try{
    // Donation list只显示 status=donated
    cacheDonated = await api.list({ status:'donated' });
    donationTbody.innerHTML = '';

    if(cacheDonated.length === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="9">No donation items.</td>`;
      donationTbody.appendChild(tr);
      return;
    }

    cacheDonated.forEach(item=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          ${escapeHtml(item.name)}
          <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span>
        </td>
        <td>${item.quantity}</td>
        <td>${item.expiry_date}</td>
        <td>${item.category}</td> <!-- CSS 隐藏 -->
        <td>${escapeHtml(item.storage || '')}</td> <!-- CSS 隐藏 -->
        <td>${escapeHtml(item.notes   || '')}</td> <!-- CSS 隐藏 -->
        <td>${escapeHtml(item.donation_pickup_location || '')}</td>
        <td>${escapeHtml(item.donation_availability    || '')}</td>
        <td>
          <div class="row-actions">
            <button class="edit-donation" data-id="${item.id}">Withdraw</button>
            <button class="complete-donation" data-id="${item.id}">Complete</button>
          </div>
        </td>
      `;
      donationTbody.appendChild(tr);
    });

    donationTbody.querySelectorAll('.edit-donation')     .forEach(b=>b.addEventListener('click', onWithdrawDonation));
    donationTbody.querySelectorAll('.complete-donation') .forEach(b=>b.addEventListener('click', onCompleteDonation));
  }catch(err){
    console.error(err);
    showToast('Failed to load donations.', 'error');
  }
}

async function render(){ await Promise.all([renderInventory(), renderDonationList()]); }

/* ===== Form: Add Item ===== */
foodForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const name = document.getElementById('itemName').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const expiry = document.getElementById('expiryDate').value;
  const category = document.getElementById('category').value;
  const storage  = document.getElementById('storage').value;
  const notes    = document.getElementById('notes').value.trim();

  if(!name || !quantity || !expiry || !category || !storage){
    showToast('Please complete all required fields.', 'error'); return;
  }
  if(!Number.isFinite(quantity) || quantity <= 0){
    showToast('Quantity must be a positive number.', 'error'); return;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)){
    showToast('Please enter a valid expiry date (YYYY-MM-DD).', 'error'); return;
  }
  if(!ALLOWED_CATEGORIES.includes(category)){ showToast('Invalid category.', 'error'); return; }
  if(!ALLOWED_STORAGE.includes(storage)){ showToast('Invalid storage.', 'error'); return; }

  // 先刷新一次活动缓存用于重复检测
  const nowList = await api.list({ status:'active', q:name });
  const dup = nowList.find(x => x.name.toLowerCase() === name.toLowerCase() && x.expiry_date === expiry);

  if(dup){
    if(confirm('This item already exists. Do you want to update count instead?')){
      // 合并：PUT 数量 = 原 + 新
      const newQty = Number(dup.quantity) + quantity;
      await api.update(dup.id, {
        name: dup.name,
        category: dup.category,
        storage: dup.storage,
        quantity: newQty,
        expiry_date: dup.expiry_date,
        notes: dup.notes || ''
      });
      showToast('Quantity merged into existing item.');
      await render();
      foodForm.reset();
      return;
    }else{
      return; // 用户取消
    }
  }

  // 新建（不传 barcode，让后端生成）
  await api.create({ name, category, storage, quantity, expiry_date: expiry, notes });
  showToast('Item added successfully.');
  await render();
  foodForm.reset();
});

/* ===== Edit Item ===== */
function fillEditForm(item){
  document.getElementById('editIndex').value = item.id;
  document.getElementById('editName').value = item.name;
  document.getElementById('editQuantity').value = item.quantity;
  document.getElementById('editExpiry').value = item.expiry_date;
  document.getElementById('editCategory').value = ALLOWED_CATEGORIES.includes(item.category) ? item.category : 'Grains';
  document.getElementById('editStorage').value = ALLOWED_STORAGE.includes(item.storage) ? item.storage : '';
  document.getElementById('editNotes').value = item.notes || '';
}
function openModal(node){ node?.classList.remove('hidden'); }
function closeModal(node){ node?.classList.add('hidden'); }

async function onEdit(e){
  const id = e.currentTarget.getAttribute('data-id');
  // 从 cacheActive 拿
  const item = cacheActive.find(x => x.id === id);
  if(!item) return;
  fillEditForm(item);
  openModal(editModal);
}
editModal?.querySelector('.cancelBtn')?.addEventListener('click', ()=> closeModal(editModal));

editForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = document.getElementById('editIndex').value;
  const name = document.getElementById('editName').value.trim();
  const quantity = Number(document.getElementById('editQuantity').value);
  const expiry = document.getElementById('editExpiry').value;
  const category = document.getElementById('editCategory').value;
  const storage  = document.getElementById('editStorage').value;
  const notes    = document.getElementById('editNotes').value.trim();

  if(!name || !quantity || !expiry || !category || !storage){
    showToast('Please complete all required fields.', 'error'); return;
  }
  if(!Number.isFinite(quantity) || quantity<=0){ showToast('Quantity must be a positive number.', 'error'); return; }
  if(!ALLOWED_CATEGORIES.includes(category)){ showToast('Invalid category.', 'error'); return; }
  if(!ALLOWED_STORAGE.includes(storage)){ showToast('Invalid storage.', 'error'); return; }

  await api.update(id, { name, category, storage, quantity, expiry_date: expiry, notes });
  showToast('Item updated successfully.');
  closeModal(editModal);
  await render();
});

/* ===== Delete Item ===== */
async function onDelete(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = cacheActive.find(x => x.id === id);
  if(!item) return;
  const warnDonation = (item.status === 'donated'); // active 列表一般不会有
  const ok = confirm(warnDonation ? 'This item is tied to a donation. Are you sure?' : 'Delete this item?');
  if(!ok) return;
  await api.remove(id);
  showToast('Item deleted.');
  await render();
}

/* ===== Mark as Used (with undo) ===== */
async function onMarkUsed(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = cacheActive.find(x => x.id === id);
  if(!item) return;

  let used = 1;
  const input = prompt('Enter quantity used:', '1');
  if(input !== null){
    const n = Number(input);
    if(Number.isFinite(n) && n>0){ used = n; }
  }

  // 记录用于撤销
  undoStack.push({ before: {...item}, removed: (item.quantity - used) <= 0 });

  await api.action({ action:'use', id, quantity: used });
  if(item.quantity - used <= 0) showToast('Item fully used and removed from inventory.');
  else showToast('Quantity updated.');
  await render();

  setTimeout(async ()=>{
    if(confirm('Undo last "Mark as Used"?')){
      const rec = undoStack.pop();
      if(rec){
        if(rec.removed){
          // 重新创建为之前状态
          await api.create({
            name: rec.before.name,
            category: rec.before.category,
            storage: rec.before.storage,
            quantity: rec.before.quantity,
            expiry_date: rec.before.expiry_date,
            notes: rec.before.notes || '',
            barcode: rec.before.barcode || undefined
          });
        }else{
          // 直接恢复数量
          await api.update(rec.before.id, {
            name: rec.before.name,
            category: rec.before.category,
            storage: rec.before.storage,
            quantity: rec.before.quantity,
            expiry_date: rec.before.expiry_date,
            notes: rec.before.notes || ''
          });
        }
        showToast('Undo successful.');
        await render();
      }
    }
  }, 200);
}

/* ===== Donation: Convert / Withdraw / Complete ===== */
let donationTargetId = null;

async function onConvertDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  donationTargetId = id;
  donationForm?.reset();
  openModal(donationModal);
}

donationForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const pickupLocation = document.getElementById('pickupLocation').value.trim();
  const availability   = document.getElementById('availability').value.trim();
  const donationNotes  = document.getElementById('donationNotes').value.trim();
  if(!pickupLocation || !availability){
    showToast('Please fill pickup location and availability.', 'error'); return;
  }
  await api.action({ action:'donate', id: donationTargetId, pickupLocation, availability, note: donationNotes });
  showToast('Donation created.');
  closeModal(donationModal);
  await render();
});

async function onWithdrawDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  const ok = confirm('Withdraw this donation and move it back to active inventory?');
  if(!ok) return;
  await api.action({ action:'withdraw', id });
  showToast('Donation withdrawn.');
  await render();
}

async function onCompleteDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  const ok = confirm('Mark this donation as completed?');
  if(!ok) return;
  await api.action({ action:'complete', id });
  showToast('Donation completed.');
  await render();
}

/* ===== Filters ===== */
[searchInput, filterCategory, filterStorage, filterExpiry].forEach(el=> el && el.addEventListener('input', ()=>render()));
clearFiltersBtn?.addEventListener('click', ()=>{
  if(searchInput) searchInput.value = '';
  if(filterCategory) filterCategory.value = '';
  if(filterStorage)  filterStorage.value = '';
  if(filterExpiry)   filterExpiry.value = '';
  render();
});

/* ===== Batch Actions ===== */
selectAll?.addEventListener('change', ()=>{
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked);
});
function selectedIds(){
  return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => cb.getAttribute('data-id'));
}

/* Batch: Edit storage */
batchEditBtn?.addEventListener('click', async ()=>{
  const ids = selectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  const input = prompt('Enter new storage (Fridge / Freezer / Pantry):', '');
  if(input === null) return;
  const norm = (input||'').trim().toLowerCase();
  const map = {fridge:'Fridge', freezer:'Freezer', pantry:'Pantry'};
  const newStorage = map[norm];
  if(!newStorage){ showToast('Invalid storage. Use: Fridge / Freezer / Pantry', 'error'); return; }

  let updated=0;
  for(const id of ids){
    const it = cacheActive.find(x => x.id === id);
    if(!it) continue;
    await api.update(it.id, {
      name: it.name, category: it.category, storage: newStorage,
      quantity: it.quantity, expiry_date: it.expiry_date, notes: it.notes || ''
    });
    updated++;
  }
  showToast(`Updated storage for ${updated} item(s).`);
  await render();
});

/* Batch: Mark used */
batchUsedBtn?.addEventListener('click', async ()=>{
  const ids = selectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  const used = Number(prompt('Enter quantity to use for each selected item:', '1'));
  if(!Number.isFinite(used) || used<=0){ showToast('Invalid quantity.', 'error'); return; }

  let updated=0, removed=0;
  for(const id of ids){
    const it = cacheActive.find(x => x.id === id);
    if(!it) continue;
    undoStack.push({ before: {...it}, removed: (it.quantity - used) <= 0 });
    await api.action({ action:'use', id, quantity: used });
    if(it.quantity - used <= 0) removed++; else updated++;
  }
  showToast(`Batch used → ${updated} updated, ${removed} removed.`);
  await render();
});

/* Batch: Delete */
batchDeleteBtn?.addEventListener('click', async ()=>{
  const ids = selectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  if(!confirm('Delete selected items?')) return;

  let deleted=0;
  for(const id of ids){
    await api.remove(id);
    deleted++;
  }
  showToast(`Deleted ${deleted} item(s).`);
  await render();
});

/* Batch: Convert to Donation */
batchDonateBtn?.addEventListener('click', async ()=>{
  const ids = selectedIds();
  if(ids.length===0){ showToast('Select items first.', 'warn'); return; }
  const pickupLocation = prompt('Pickup Location for selected items:', '');
  if(pickupLocation === null || pickupLocation.trim()===''){ showToast('Pickup location is required.', 'error'); return; }
  const availability = prompt('Availability time (e.g. 10 AM – 5 PM):', '');
  if(availability === null || availability.trim()===''){ showToast('Availability time is required.', 'error'); return; }

  let created=0;
  for(const id of ids){
    await api.action({ action:'donate', id, pickupLocation, availability, note:'' });
    created++;
  }
  showToast(`Converted ${created} item(s) to donation.`);
  await render();
});

/* ===== Add via Barcode ===== */
scanBtn?.addEventListener('click', async ()=>{
  const code = prompt('Enter barcode number:', '');
  if(code === null) return;
  const barcode = code.trim();
  if(!barcode){ return; }

  // 尝试识别
  const preset = KNOWN_BARCODES[barcode];
  if(preset){
    // 看看是否已有同名 active
    const activeByName = await api.list({ status:'active', q: preset.name });
    const dup = activeByName.find(x => x.name.toLowerCase() === preset.name.toLowerCase());
    if(dup){
      await api.update(dup.id, {
        name: dup.name,
        category: dup.category,
        storage: dup.storage,
        quantity: Number(dup.quantity) + 1,
        expiry_date: dup.expiry_date,
        notes: dup.notes || ''
      });
      // 如果该记录没有条码，顺手补上（再次 update）
      if(!dup.barcode){
        await api.update(dup.id, {
          name: dup.name,
          category: dup.category,
          storage: dup.storage,
          quantity: Number(dup.quantity) + 1,
          expiry_date: dup.expiry_date,
          notes: dup.notes || ''
        });
      }
      showToast('Recognized barcode. Quantity merged.');
    }else{
      // 直接创建，带条码
      await api.create({
        name: preset.name,
        category: preset.category,
        storage: preset.storage,
        quantity: 1,
        expiry_date: addDaysISO(preset.defaultDays || 7),
        notes: '',
        barcode
      });
      showToast('Recognized barcode. Item added.');
    }
  }else{
    // 未知条码：创建占位 Unknown (barcode)
    const placeholderName = `Unknown (${barcode})`;
    const activeSame = await api.list({ status:'active', q: 'Unknown (' });
    const dup = activeSame.find(x => x.name.toLowerCase() === placeholderName.toLowerCase());
    if(dup){
      await api.update(dup.id, {
        name: dup.name,
        category: dup.category,
        storage: dup.storage,
        quantity: Number(dup.quantity) + 1,
        expiry_date: dup.expiry_date,
        notes: dup.notes || ''
      });
      if(!dup.barcode){
        await api.update(dup.id, {
          name: dup.name,
          category: dup.category,
          storage: dup.storage,
          quantity: Number(dup.quantity) + 1,
          expiry_date: dup.expiry_date,
          notes: dup.notes || ''
        });
      }
      showToast('Unknown barcode. Quantity merged.');
    }else{
      await api.create({
        name: placeholderName,
        category: 'Grains',
        storage: 'Pantry',
        quantity: 1,
        expiry_date: addDaysISO(7),
        notes: 'Added via barcode (unknown). Please edit details.',
        barcode
      });
      showToast('Unknown barcode. Placeholder item added.');
    }
  }

  await render();
});

/* ===== Init ===== */
render();
