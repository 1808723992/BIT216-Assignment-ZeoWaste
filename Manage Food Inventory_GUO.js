/* =================== SavePlate – Frontend JS (PHP API) =================== */
/* 1) 修改为你的目录名（绝对路径，避免 404） */
const BASE_PATH = '/BIT216-Assignment-ZeoWaste/Main/ManageInventory';
const API_BASE  = `${BASE_PATH}/api/api.php`;

/* 2) API helper */
async function api(action, method='GET', body=null, params=null){
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set('action', action);
  if (params) Object.entries(params).forEach(([k,v])=> url.searchParams.set(k,v));

  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);

  const res = await fetch(url, opt);
  const data = await res.json().catch(()=> ({}));
  if (!res.ok || data.ok === false) {
    console.error('API error:', action, data);
    throw new Error(data.error || `HTTP_${res.status}`);
  }
  return data;
}

/* 3) DOM refs */
const notificationEl = document.getElementById('notification');
const tbody = document.querySelector('#inventoryTable tbody');
const donationTbody = document.querySelector('#donationTable tbody');
const selectAll = document.getElementById('selectAll');

const foodForm = document.getElementById('foodForm');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const donationModal = document.getElementById('donationModal');
const donationForm = document.getElementById('donationForm');

const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterStorage = document.getElementById('filterStorage');
const filterExpiry = document.getElementById('filterExpiry');
const clearFiltersBtn = document.getElementById('clearFilters');

const batchEditBtn = document.getElementById('batchEdit');
const batchUsedBtn = document.getElementById('batchUsed');
const batchDeleteBtn = document.getElementById('batchDelete');
const batchDonateBtn = document.getElementById('batchDonate');

const scanBtn = document.getElementById('scanBtn');

/* 4) Utils */
function showToast(msg, type=''){ notificationEl.textContent=msg; notificationEl.className='notification'+(type?' '+type:''); notificationEl.classList.remove('hidden'); setTimeout(()=>notificationEl.classList.add('hidden'),2200); }
function closeModal(node){ node.classList.add('hidden'); }
function openModal(node){ node.classList.remove('hidden'); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addDaysISO(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function isNearExpiry(exp){ const diff=Math.floor((new Date(exp)-new Date(todayISO()))/(1000*60*60*24)); return diff>=0 && diff<=3; }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function highlight(text, kw){ if(!kw) return escapeHtml(text||''); const safe=escapeHtml(text||''); const re=new RegExp(`(${kw.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')})`,'ig'); return safe.replace(re,'<mark>$1</mark>'); }

const ALLOWED_CATEGORIES = ['Dairy','Vegetable','Bakery','Grains','Meat','Fruit'];
const ALLOWED_STORAGE = ['Fridge','Freezer','Pantry'];

/* 5) Caches */
let cacheActive = [];
let cacheDonated = [];

/* 6) Loaders */
async function loadActive(){
  const params = { status:'active' };
  const kw = (searchInput?.value || '').trim();
  if (kw) params.q = kw;
  if (filterCategory?.value) params.category = filterCategory.value;
  if (filterStorage?.value) params.storage  = filterStorage.value;
  if (filterExpiry?.value)  params.expiry   = filterExpiry.value;
  const {items} = await api('list_items','GET',null,params);
  cacheActive = items || [];
}
async function loadDonated(){
  const {items} = await api('list_donations','GET');
  cacheDonated = items || [];
}

/* 7) Renderers */
function bindRowSelectionEvents(){
  tbody.querySelectorAll('.row-select').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const all = tbody.querySelectorAll('.row-select').length;
      const sel = tbody.querySelectorAll('.row-select:checked').length;
      if (selectAll) selectAll.checked = (all>0 && sel===all);
    });
  });
}

function renderInventory(){
  if (selectAll) selectAll.checked = false;
  tbody.innerHTML = '';
  const rows = cacheActive;
  const k = (searchInput?.value || '').trim();

  if (rows.length===0){
    tbody.innerHTML = `<tr><td colspan="8">No items found. Please adjust your filters.</td></tr>`;
    return;
  }

  rows.forEach(item=>{
    const near = isNearExpiry(item.expiry_date);
    const expired = item.expiry_date < todayISO();
    const pill = expired ? '<span class="pill expired">Expired</span>' : (near ? '<span class="pill near">Near Expiry</span>' : '<span class="pill active">Active</span>');

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
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.edit').forEach(b=>b.addEventListener('click', onEdit));
  tbody.querySelectorAll('.use').forEach(b=>b.addEventListener('click', onMarkUsed));
  tbody.querySelectorAll('.donate').forEach(b=>b.addEventListener('click', onConvertDonation));
  tbody.querySelectorAll('.delete').forEach(b=>b.addEventListener('click', onDelete));
  bindRowSelectionEvents();
}

function renderDonationList(){
  donationTbody.innerHTML = '';
  if (cacheDonated.length===0){
    donationTbody.innerHTML = `<tr><td colspan="9">No donation items.</td></tr>`;
    return;
  }
  cacheDonated.forEach(item=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.name)} <span style="color:#7F8C8D; font-size:12px; margin-left:6px;">#${item.barcode || '-'}</span></td>
      <td>${item.quantity}</td>
      <td>${item.expiry_date}</td>
      <td>${item.category}</td> <!-- 如你的表头无此列，可在HTML去掉；不影响功能 -->
      <td>${escapeHtml(item.storage||'')}</td>
      <td>${escapeHtml(item.notes||'')}</td>
      <td>${escapeHtml(item.donation_pickup_location || '')}</td>
      <td>${escapeHtml(item.donation_availability || '')}</td>
      <td>
        <div class="row-actions">
          <button class="edit-donation" data-id="${item.id}">Withdraw</button>
          <button class="complete-donation" data-id="${item.id}">Complete</button>
        </div>
      </td>`;
    donationTbody.appendChild(tr);
  });

  donationTbody.querySelectorAll('.edit-donation').forEach(b=>b.addEventListener('click', onWithdrawDonation));
  donationTbody.querySelectorAll('.complete-donation').forEach(b=>b.addEventListener('click', onCompleteDonation));
}

async function refreshAll(){ await Promise.all([loadActive(), loadDonated()]); renderInventory(); renderDonationList(); }

/* 8) Add Item */
foodForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const quantity = Number(document.getElementById('quantity').value);
  const expiry_date = document.getElementById('expiryDate').value;
  const category = document.getElementById('category').value;
  const storage  = document.getElementById('storage').value;
  const notes    = document.getElementById('notes').value.trim();

  if(!name || !quantity || !expiry_date || !category || !storage){ showToast('Please complete all required fields.','error'); return; }
  if(!Number.isFinite(quantity) || quantity<=0){ showToast('Quantity must be a positive number.','error'); return; }

  try{
    const res = await api('add_item','POST',{ name, quantity, expiry_date, category, storage, notes });
    showToast(res.merged ? 'Quantity merged into existing item.' : 'Item added successfully.');
    foodForm.reset(); await refreshAll();
  }catch(e){ showToast('Failed to add item.','error'); }
});

/* 9) Edit */
function onEdit(e){
  const id = e.currentTarget.getAttribute('data-id');
  const item = cacheActive.find(x=> String(x.id)===String(id));
  if(!item) return;
  document.getElementById('editIndex').value = item.id;
  document.getElementById('editName').value = item.name;
  document.getElementById('editQuantity').value = item.quantity;
  document.getElementById('editExpiry').value = item.expiry_date;
  document.getElementById('editCategory').value = item.category;
  document.getElementById('editStorage').value = item.storage;
  document.getElementById('editNotes').value = item.notes || '';
  openModal(editModal);
}
editForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = document.getElementById('editIndex').value;
  const name = document.getElementById('editName').value.trim();
  const quantity = Number(document.getElementById('editQuantity').value);
  const expiry_date = document.getElementById('editExpiry').value;
  const category = document.getElementById('editCategory').value;
  const storage = document.getElementById('editStorage').value;
  const notes   = document.getElementById('editNotes').value.trim();
  if(!name || !quantity || !expiry_date || !category || !storage){ showToast('Please complete all required fields.','error'); return; }
  try{
    await api('edit_item','POST',{ id, name, quantity, expiry_date, category, storage, notes });
    showToast('Item updated successfully.'); closeModal(editModal); await refreshAll();
  }catch(e){ showToast('Failed to update.','error'); }
});
editModal.querySelector('.cancelBtn').addEventListener('click', ()=> closeModal(editModal));

/* 10) Delete */
async function onDelete(e){
  const id = e.currentTarget.getAttribute('data-id');
  if(!confirm('Delete this item?')) return;
  try{ await api('delete_item','POST',{ id }); showToast('Item deleted.'); await refreshAll(); }
  catch{ showToast('Delete failed.','error'); }
}

/* 11) Mark as Used */
async function onMarkUsed(e){
  const id = e.currentTarget.getAttribute('data-id');
  const input = prompt('Enter quantity used:','1');
  const used = Number(input);
  if(!Number.isFinite(used) || used<=0){ showToast('Invalid quantity.','error'); return; }
  try{
    const {left} = await api('mark_used','POST',{ id, used });
    showToast(left<=0 ? 'Item fully used and removed from inventory.' : 'Quantity updated.');
    await refreshAll();
  }catch{ showToast('Operation failed.','error'); }
}

/* 12) Donation */
let donationTargetId = null;
function onConvertDonation(e){
  donationTargetId = e.currentTarget.getAttribute('data-id');
  donationForm.reset(); openModal(donationModal);
}
donationForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const pickup_location = document.getElementById('pickupLocation').value.trim();
  const availability = document.getElementById('availability').value.trim();
  const notes = document.getElementById('donationNotes').value.trim();
  if(!pickup_location || !availability){ showToast('Please fill pickup location and availability.','error'); return; }
  try{
    await api('convert_donation','POST',{ id: donationTargetId, pickup_location, availability, notes });
    showToast('Donation created.'); closeModal(donationModal); await refreshAll();
  }catch{ showToast('Failed to donate.','error'); }
});
async function onWithdrawDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  if(!confirm('Withdraw this donation and move it back to active inventory?')) return;
  try{ await api('withdraw_donation','POST',{ id }); showToast('Donation withdrawn.'); await refreshAll(); }
  catch{ showToast('Withdraw failed.','error'); }
}
async function onCompleteDonation(e){
  const id = e.currentTarget.getAttribute('data-id');
  if(!confirm('Mark this donation as completed?')) return;
  try{ await api('complete_donation','POST',{ id }); showToast('Donation completed.'); await refreshAll(); }
  catch{ showToast('Complete failed.','error'); }
}

/* 13) Filters */
[searchInput, filterCategory, filterStorage, filterExpiry].forEach(el=> el && el.addEventListener('input', refreshAll));
clearFiltersBtn?.addEventListener('click', ()=>{ if(searchInput) searchInput.value=''; if(filterCategory) filterCategory.value=''; if(filterStorage) filterStorage.value=''; if(filterExpiry) filterExpiry.value=''; refreshAll(); });

/* 14) Batch */
selectAll?.addEventListener('change', ()=>{ document.querySelectorAll('.row-select').forEach(cb => cb.checked = selectAll.checked); });
function getSelectedIds(){ return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => Number(cb.getAttribute('data-id'))); }

batchEditBtn?.addEventListener('click', async ()=>{
  const ids = getSelectedIds(); if(ids.length===0){ showToast('Select items first.','warn'); return; }
  const input = prompt('Enter new storage (Fridge / Freezer / Pantry):','');
  if(input===null) return; const m={fridge:'Fridge', freezer:'Freezer', pantry:'Pantry'}; const s=m[(input||'').trim().toLowerCase()];
  if(!s){ showToast('Invalid storage.','error'); return; }
  try{ await api('batch_edit_storage','POST',{ ids, storage:s }); showToast('Updated storage.'); await refreshAll(); }
  catch{ showToast('Batch edit failed.','error'); }
});

batchUsedBtn?.addEventListener('click', async ()=>{
  const ids = getSelectedIds(); if(ids.length===0){ showToast('Select items first.','warn'); return; }
  const used = Number(prompt('Enter quantity to use for each selected item:','1'));
  if(!Number.isFinite(used)||used<=0){ showToast('Invalid quantity.','error'); return; }
  try{ await api('batch_mark_used','POST',{ ids, used }); showToast('Batch used completed.'); await refreshAll(); }
  catch{ showToast('Batch use failed.','error'); }
});

batchDeleteBtn?.addEventListener('click', async ()=>{
  const ids = getSelectedIds(); if(ids.length===0){ showToast('Select items first.','warn'); return; }
  if(!confirm('Delete selected items?')) return;
  try{ await api('batch_delete','POST',{ ids }); showToast('Deleted selected items.'); await refreshAll(); }
  catch{ showToast('Batch delete failed.','error'); }
});

batchDonateBtn?.addEventListener('click', async ()=>{
  const ids = getSelectedIds(); if(ids.length===0){ showToast('Select items first.','warn'); return; }
  const pickup_location = prompt('Pickup Location for selected items:',''); if(!pickup_location){ showToast('Pickup location is required.','error'); return; }
  const availability = prompt('Availability time (e.g. 10 AM – 5 PM):',''); if(!availability){ showToast('Availability time is required.','error'); return; }
  try{ await api('batch_convert_donation','POST',{ ids, pickup_location, availability }); showToast('Converted to donation.'); await refreshAll(); }
  catch{ showToast('Batch donation failed.','error'); }
});

/* 15) Barcode Add — 两个8位演示码已预置 */
const KNOWN_BARCODES = {
  '12345670': { name:'UHT Milk',         category:'Dairy',   storage:'Fridge',  defaultDays:7  },
  '87654325': { name:'Frozen Dumplings', category:'Grains',  storage:'Freezer', defaultDays:90 }
};
scanBtn.addEventListener('click', async ()=>{
  const code = prompt('Enter barcode number:',''); if(code===null || code.trim()==='') return;
  const barcode = code.trim();
  const preset = KNOWN_BARCODES[barcode];
  const body = preset ? {
    name: preset.name, quantity: 1, expiry_date: addDaysISO(preset.defaultDays||7),
    category: preset.category, storage: preset.storage, notes: '', barcode
  } : {
    name: `Unknown (${barcode})`, quantity: 1, expiry_date: addDaysISO(7),
    category: 'Grains', storage: 'Pantry', notes: 'Added via barcode (unknown). Please edit details.', barcode
  };
  try{
    const res = await api('add_item','POST',body);
    showToast(preset ? (res.merged?'Recognized barcode. Quantity merged.':'Recognized barcode. Item added.') :
                       (res.merged?'Unknown barcode. Quantity merged.':'Unknown barcode. Placeholder item added.'));
    await refreshAll();
  }catch{ showToast('Barcode add failed.','error'); }
});

/* 16) Init */
refreshAll();
