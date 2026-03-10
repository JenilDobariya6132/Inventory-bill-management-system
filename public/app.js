const API = {
  items: '/api/items',
  customers: '/api/customers',
  bills: '/api/bills',
  reports: '/api/reports',
  auth: '/api/auth',
};

function dateOnly(v) {
  if (!v) return '';
  const s = String(v);
  let y = '', m = '', d = '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    y = s.slice(2, 4);
    m = s.slice(5, 7);
    d = s.slice(8, 10);
  } else {
    const dt = new Date(s);
    if (isNaN(dt)) return '';
    y = String(dt.getFullYear()).slice(2);
    m = String(dt.getMonth() + 1).padStart(2, '0');
    d = String(dt.getDate()).padStart(2, '0');
  }
  return `${d}-${m}-${y}`;
}

const tabs = document.querySelectorAll('.nav button');
const sections = document.querySelectorAll('.tab');
tabs.forEach(btn => btn.addEventListener('click', () => {
  sections.forEach(s => s.classList.add('hidden'));
  document.getElementById(btn.dataset.tab).classList.remove('hidden');
}));

// Auth: token storage and fetch wrapper
const AUTH_KEY = 'auth_token';
const origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  try {
    const url = typeof input === 'string' ? input : (input?.url || '');
    const sameOrigin = !/^https?:\/\//i.test(url) || url.startsWith(location.origin);
    const token = localStorage.getItem(AUTH_KEY);
    if (sameOrigin && token) {
      init.headers = Object.assign({}, init.headers, { Authorization: `Bearer ${token}` });
    }
  } catch { }
  return origFetch(input, init);
};

async function ensureAuth() {
  const token = localStorage.getItem(AUTH_KEY);
  const logoutBtn = document.getElementById('logout-btn');
  let authed = false;
  if (token) {
    try {
      const res = await fetch(`${API.auth}/me`);
      authed = res.ok;
    } catch {
      authed = false;
    }
  }
  const allowTabs = ['login', 'signup'];
  sections.forEach(s => {
    const id = s.id;
    const shouldHide = !authed && !allowTabs.includes(id);
    if (shouldHide) s.classList.add('hidden');
  });
  const navButtons = document.querySelectorAll('.nav button[data-tab]');
  navButtons.forEach(btn => {
    const id = btn.dataset.tab;
    const shouldHide = !authed && !allowTabs.includes(id);
    btn.style.display = shouldHide ? 'none' : '';
  });
  const loginBtn = document.querySelector('.nav button[data-tab="login"]');
  const signupBtn = document.querySelector('.nav button[data-tab="signup"]');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !authed);
  if (loginBtn) loginBtn.style.display = authed ? 'none' : '';
  if (signupBtn) signupBtn.style.display = authed ? 'none' : '';
  if (!authed) {
    document.querySelector('[data-tab="login"]').click();
  }
}

// Login form
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const res = await fetch(`${API.auth}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Login failed'); return; }
    localStorage.setItem(AUTH_KEY, data.token);
    await ensureAuth();
    document.querySelector('[data-tab="dashboard"]').click();
    await Promise.all([loadItems(), loadCustomers(), loadBills(), loadDashboard()]);
  });
}
// Signup form
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const company_name = document.getElementById('signup-company')?.value.trim();
    const address = document.getElementById('signup-address')?.value.trim();
    const phone = document.getElementById('signup-phone1')?.value.trim();
    const phone2 = document.getElementById('signup-phone2')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const res = await fetch(`${API.auth}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, company_name, address, phone, phone2, email }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Signup failed'); return; }
    localStorage.setItem(AUTH_KEY, data.token);
    await ensureAuth();
    document.querySelector('[data-tab="dashboard"]').click();
    await Promise.all([loadItems(), loadCustomers(), loadBills(), loadDashboard()]);
  });
}
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    localStorage.removeItem(AUTH_KEY);
    await ensureAuth();
  });
}

// Company profile
let currentProfile = null;
async function loadProfile() {
  try {
    const res = await fetch('/api/profile/me');
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch { return null; }
}
function applyProfileToInvoice(p) {
  if (!p) return;
  currentProfile = p;
  const nameEl = document.getElementById('company-name');
  const addrEl = document.getElementById('company-address');
  const phoneEl = document.getElementById('company-phone');
  const emailEl = document.getElementById('company-email');
  const logoImg = document.getElementById('inv-logo-img');
  if (nameEl) nameEl.textContent = p.company_name || 'Your Company';
  if (addrEl) addrEl.textContent = p.address || '';
  if (phoneEl) {
    const phones = [p.phone, p.phone2].filter(Boolean).join(', ');
    phoneEl.textContent = phones || '';
  }
  if (emailEl) emailEl.textContent = p.email || '';
  if (logoImg && p.logo_url) logoImg.src = p.logo_url;
}
async function ensureCompanyProfile() {
  const p = await loadProfile();
  if (p) {
    applyProfileToInvoice(p);
    return true;
  }
  // Force open company setup
  const btn = document.querySelector('[data-tab="company-setup"]');
  if (!btn) {
    // Show section programmatically
    document.querySelectorAll('.tab').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById('company-setup');
    if (sec) sec.classList.remove('hidden');
  } else {
    btn.click();
  }
  return false;
}
const compSaveBtn = document.getElementById('comp-save');
if (compSaveBtn) {
  compSaveBtn.addEventListener('click', async () => {
    const name = document.getElementById('comp-name').value.trim();
    const address = document.getElementById('comp-address').value.trim();
    const phone = document.getElementById('comp-phone').value.trim();
    const phone2 = document.getElementById('comp-phone2')?.value.trim();
    const email = document.getElementById('comp-email').value.trim();
    const fileInput = document.getElementById('comp-logo');
    const file = fileInput?.files?.[0];
    let logo_data = null;
    if (file) {
      logo_data = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = (e) => reject(e);
        fr.readAsDataURL(file);
      });
    }
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: name, address, phone, phone2, email, logo_data }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to save profile'); return; }
    applyProfileToInvoice(data);
    alert('Company profile saved');
    // Go to dashboard
    const dashBtn = document.querySelector('[data-tab="dashboard"]');
    if (dashBtn) dashBtn.click();
  });
}

// Items
const itemForm = document.getElementById('item-form');
const itemsTableBody = document.querySelector('#items-table tbody');
let itemsCache = [];
async function loadItems() {
  const res = await fetch(API.items);
  const items = await res.json();
  itemsCache = items;
  itemsTableBody.innerHTML = items.map(it => `
    <tr>
      <td>${it.id}</td><td>${it.name}</td>
      <td>
        <button class="btn btn-primary" onclick="editItemById(${it.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteItem(${it.id})">Delete</button>
      </td>
    </tr>`).join('');
}
window.editItemById = (id) => {
  const it = itemsCache.find(x => x.id === id);
  if (!it) return;
  document.getElementById('item-id').value = it.id;
  document.getElementById('item-name').value = it.name || '';
  document.getElementById('item-qty').value = it.quantity || 0;
};
window.deleteItem = async (id) => {
  if (!confirm('Delete item?')) return;
  await fetch(`${API.items}/${id}`, { method: 'DELETE' });
  await loadItems();
};
itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('item-id').value;
  const payload = {
    name: document.getElementById('item-name').value,
    quantity: Number(document.getElementById('item-qty').value),
  };
  if (id) {
    const res = await fetch(`${API.items}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to update item'); return; }
  } else {
    const res = await fetch(API.items, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to add item'); return; }
  }
  itemForm.reset();
  await loadItems();
});

// Customers
const customerForm = document.getElementById('customer-form');
const customersTableBody = document.querySelector('#customers-table tbody');
const billCustomerSelect = document.getElementById('bill-customer');
const custSearchContainer = document.getElementById('customer-search');
const custDropdownBtn = document.getElementById('customer-dropdown-btn');
const custDropdownMenu = document.getElementById('customer-search')?.querySelector('.dropdown-menu');
const custSearchInput = document.getElementById('customer-search-input');
const custResultsList = document.getElementById('customer-search-results');
const custSelectedId = document.getElementById('customer-selected-id');
let customersCache = [];
async function loadCustomers() {
  const res = await fetch(API.customers);
  const customers = await res.json();
  customersCache = customers;
  customersTableBody.innerHTML = customers.map(c => `
    <tr>
      <td>${c.id}</td><td>${c.name}</td><td>${c.gst_id || ''}</td><td>${c.phone || ''}</td><td>${c.address || ''}</td>
      <td>
        <button class="btn btn-primary" onclick="editCustomerById(${c.id})">Edit</button>
        <button class="btn" onclick="viewCustomerBills(${c.id})">Bills</button>
        <button class="btn btn-danger" onclick="deleteCustomer(${c.id})">Delete</button>
      </td>
    </tr>`).join('');
  billCustomerSelect.innerHTML = '<option value=\"\">Select Customer</option>' +
    customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  setCustomerDropdownLabel();
}
function setCustomerDropdownLabel() {
  if (!custDropdownBtn) return;
  const id = Number(billCustomerSelect?.value || 0);
  const c = customersCache.find(x => x.id === id);
  custDropdownBtn.textContent = c ? c.name : 'Select Customer';
}
function renderCustomerResults(list) {
  if (!custResultsList) return;
  if (!list || list.length === 0) {
    custResultsList.innerHTML = '<li class="no-results">No customers found</li>';
  } else {
    custResultsList.innerHTML = list.map(i => `<li data-id="${i.id}" data-name="${i.name}">${i.name}</li>`).join('');
  }
}
if (custDropdownBtn) {
  custDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
    if (custDropdownMenu?.classList.contains('hidden')) {
      custDropdownMenu.classList.remove('hidden');
      custSearchInput?.focus();
      renderCustomerResults(customersCache);
    } else {
      custDropdownMenu.classList.add('hidden');
    }
  });
}
if (custSearchInput) {
  custSearchInput.addEventListener('input', () => {
    const val = custSearchInput.value.toLowerCase().trim();
    const filtered = customersCache.filter(i =>
      i.name.toLowerCase().includes(val) ||
      String(i.phone || '').toLowerCase().includes(val) ||
      String(i.gst_id || '').toLowerCase().includes(val)
    );
    renderCustomerResults(filtered);
  });
}
if (custResultsList) {
  custResultsList.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
      const li = e.target;
      const id = Number(li.dataset.id);
      if (custSelectedId) custSelectedId.value = String(id);
      if (billCustomerSelect) billCustomerSelect.value = String(id);
      setCustomerDropdownLabel();
      custDropdownMenu?.classList.add('hidden');
      recalcTotals();
    }
  });
}
document.addEventListener('click', (e) => {
  if (custSearchContainer && !custSearchContainer.contains(e.target)) {
    custDropdownMenu?.classList.add('hidden');
  }
});
window.editCustomerById = (id) => {
  const c = customersCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cust-id').value = c.id;
  document.getElementById('cust-name').value = c.name || '';
  document.getElementById('cust-gst').value = c.gst_id || '';
  document.getElementById('cust-phone').value = c.phone || '';
  document.getElementById('cust-address').value = c.address || '';
};
window.deleteCustomer = async (id) => {
  const c = customersCache.find(x => x.id === id);
  if (!confirm(`Delete customer "${c?.name || id}"? This cannot be undone.`)) return;
  let res = await fetch(`${API.customers}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = 'Failed to delete customer';
    try { const data = await res.json(); msg = data.error || msg; } catch { }
    // Offer cascade delete if blocked by bills
    if (res.status === 409 && confirm(`${msg}\n\nDo you want to delete all bills for this customer and then delete the customer?`)) {
      res = await fetch(`${API.customers}/${id}?force=true`, { method: 'DELETE' });
      if (!res.ok) {
        try { const data2 = await res.json(); msg = data2.error || msg; } catch { }
        alert(msg);
        return;
      }
    } else {
      alert(msg);
      return;
    }
  }
  await loadCustomers();
};
customerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cust-id').value;
  const payload = {
    name: document.getElementById('cust-name').value,
    gst_id: document.getElementById('cust-gst').value,
    phone: document.getElementById('cust-phone').value,
    address: document.getElementById('cust-address').value,
  };
  if (id) {
    await fetch(`${API.customers}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch(API.customers, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  customerForm.reset();
  await loadCustomers();
});

// New Bill
const billItemsWrapper = document.getElementById('bill-items');
const addItemRowBtn = document.getElementById('add-item-row');
const subtotalEl = document.getElementById('subtotal');
const gstPercentEl = document.getElementById('gst-percent');
const gstAmountEl = document.getElementById('gst-amount');
const discountEl = document.getElementById('discount');
const grandTotalEl = document.getElementById('grand-total');
const paidAmountEl = document.getElementById('paid-amount');
const pendingAmountEl = document.getElementById('pending-amount');
const saveBillBtn = document.getElementById('save-bill');
const newBillSavePdfBtn = document.getElementById('new-bill-save-pdf');
const newBillSharePdfBtn = document.getElementById('new-bill-share-pdf');
const invoiceArea = document.getElementById('invoice');
const invoiceItemsBody = document.querySelector('#invoice-items tbody');
const invBillTo = document.getElementById('inv-billto');
const invNo = document.getElementById('inv-no');
const invDate = document.getElementById('inv-date');
const totSub = document.getElementById('tot-sub');
const totGstPct = document.getElementById('tot-gst-percent');
const totGst = document.getElementById('tot-gst');
const totDiscount = document.getElementById('tot-discount');
const totGrand = document.getElementById('tot-grand');

let itemOptionsCache = [];
async function refreshItemOptions() {
  const res = await fetch(API.items);
  itemOptionsCache = await res.json();
}

function makeItemRow() {
  const row = document.createElement('div');
  row.className = 'row';

  // Searchable Item Container
  const searchContainer = document.createElement('div');
  searchContainer.className = 'item-search-container';

  const dropdownBtn = document.createElement('button');
  dropdownBtn.type = 'button';
  dropdownBtn.className = 'item-dropdown-btn';
  dropdownBtn.textContent = 'Select Item';

  const dropdownMenu = document.createElement('div');
  dropdownMenu.className = 'dropdown-menu hidden';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search items...';
  searchInput.className = 'item-search-input';

  const resultsList = document.createElement('ul');
  resultsList.className = 'item-search-results';

  dropdownMenu.append(searchInput, resultsList);

  const itemIdInput = document.createElement('input');
  itemIdInput.type = 'hidden';

  searchContainer.append(dropdownBtn, dropdownMenu, itemIdInput);

  const size = document.createElement('input'); size.type = 'number'; size.step = '0.01'; size.min = '0'; size.placeholder = 'Size';
  const price = document.createElement('input'); price.type = 'number'; price.step = '0.01'; price.placeholder = 'Price';
  const qty = document.createElement('input'); qty.type = 'number'; qty.placeholder = 'Qty'; qty.min = '1';
  const total = document.createElement('input'); total.readOnly = true; total.placeholder = 'Total';
  const remove = document.createElement('button'); remove.className = 'btn btn-danger'; remove.textContent = 'Remove';
  remove.addEventListener('click', () => { row.remove(); recalcTotals(); });

  // Toggle dropdown
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dropdownMenu.classList.contains('hidden');
    // Close all other open dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
    if (isHidden) {
      dropdownMenu.classList.remove('hidden');
      searchInput.focus();
      renderResults(itemOptionsCache);
    }
  });

  function renderResults(list) {
    if (list.length === 0) {
      resultsList.innerHTML = '<li class="no-results">No items found</li>';
    } else {
      resultsList.innerHTML = list.map(i => `<li data-id="${i.id}" data-size="${i.size || ''}" data-price="${i.price}">${i.name}</li>`).join('');
    }
  }

  searchInput.addEventListener('input', () => {
    const val = searchInput.value.toLowerCase().trim();
    const filtered = itemOptionsCache.filter(i => i.name.toLowerCase().includes(val));
    renderResults(filtered);
  });

  resultsList.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
      const li = e.target;
      itemIdInput.value = li.dataset.id;
      dropdownBtn.textContent = li.textContent;
      const sVal = li.dataset.size || '';
      const pVal = li.dataset.price || '';
      size.value = (sVal == '0' || sVal == '0.00') ? '' : sVal;
      price.value = (pVal == '0' || pVal == '0.00') ? '' : pVal;
      qty.value = '';
      total.value = '';
      dropdownMenu.classList.add('hidden');
      recalcTotals();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
    }
  });

  function updateTotal() {
    const q = Number(qty.value || 0);
    const p = Number(price.value || 0);
    total.value = (Number(qty.value || 0) * Number(price.value || 0)).toFixed(2);
    recalcTotals();
  }
  qty.addEventListener('input', updateTotal);
  price.addEventListener('input', updateTotal);

  row.append(searchContainer, size, price, qty, total, remove);
  return row;
}
addItemRowBtn.addEventListener('click', async () => {
  await refreshItemOptions();
  billItemsWrapper.appendChild(makeItemRow());
});

function recalcTotals() {
  let subtotal = 0;
  billItemsWrapper.querySelectorAll('.row').forEach(r => {
    const total = Number(r.children[4].value || 0);
    subtotal += total;
  });
  const gstPercent = Number(gstPercentEl.value || 0);
  const gstAmount = (subtotal * gstPercent) / 100;
  const discountPercent = Number(discountEl.value || 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const grand = subtotal + gstAmount - discountAmount;
  subtotalEl.textContent = subtotal.toFixed(2);
  gstAmountEl.textContent = gstAmount.toFixed(2);
  grandTotalEl.textContent = grand.toFixed(2);
  const paid = Number(paidAmountEl?.value || 0);
  const pending = Math.max(grand - Math.max(paid, 0), 0);
  if (pendingAmountEl) pendingAmountEl.textContent = pending.toFixed(2);
}
gstPercentEl.addEventListener('input', recalcTotals);
discountEl.addEventListener('input', recalcTotals);
if (paidAmountEl) paidAmountEl.addEventListener('input', recalcTotals);

saveBillBtn.addEventListener('click', async () => {
  const bill_number = document.getElementById('bill-number').value || `BILL-${Date.now()}`;
  const bill_date = document.getElementById('bill-date').value || new Date().toISOString().slice(0, 10);
  const customer_id = Number(billCustomerSelect.value);
  if (!customer_id) { alert('Select a customer'); return; }
  const editId = document.getElementById('edit-bill-id').value;
  const items = [];
  billItemsWrapper.querySelectorAll('.row').forEach(r => {
    const itemIdInput = r.querySelector('input[type="hidden"]');
    const item_id = Number(itemIdInput.value);
    const price = Number(r.children[2].value || 0);
    const qty = Number(r.children[3].value || 0);
    const size = r.children[1].value;
    if (item_id && qty > 0) items.push({ item_id, quantity: qty, price, size });
  });
  if (items.length === 0) { alert('Add at least one item'); return; }

  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const discountPercent = Number(discountEl.value || 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const gstAmount = (subtotal * Number(gstPercentEl.value || 0)) / 100;
  const grand = subtotal + gstAmount - discountAmount;
  const paidRaw = Number(paidAmountEl?.value || 0);
  const paidAmount = Math.min(Math.max(paidRaw, 0), grand);

  const payload = {
    bill_number, bill_date, customer_id, items,
    gst_percent: Number(gstPercentEl.value || 0),
    discount: discountAmount,
    paid_amount: paidAmount,
  };
  const endpoint = editId ? `${API.bills}/${editId}` : API.bills;
  const method = editId ? 'PUT' : 'POST';
  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || (editId ? 'Failed to update bill' : 'Failed to save bill')); return; }
  alert(editId ? 'Bill updated' : 'Bill saved');
  if (editId) {
    document.getElementById('edit-bill-id').value = '';
    saveBillBtn.textContent = 'Save Bill';
  } else {
    // Set the ID so PDF/Share buttons work immediately
    document.getElementById('edit-bill-id').value = data.bill.id;
  }
  // Show printable invoice
  await showInvoice(data.bill.id);
  document.querySelector('[data-tab=\"bills\"]').click();
  await loadBills();
});

if (newBillSavePdfBtn) {
  newBillSavePdfBtn.addEventListener('click', async () => {
    const id = document.getElementById('edit-bill-id').value;
    if (!id) { alert('Please save the bill first'); return; }
    await showInvoice(id);
    const invNoEl = document.getElementById('inv-no');
    const invNoText = invNoEl?.textContent || '';
    const billNum = invNoText.split(' / ')[0] || 'invoice';
    saveElementPdf(invoiceArea, `invoice_${billNum}.pdf`, true);
  });
}
if (newBillSharePdfBtn) {
  newBillSharePdfBtn.addEventListener('click', async () => {
    const id = document.getElementById('edit-bill-id').value;
    if (!id) { alert('Please save the bill first'); return; }
    await showInvoice(id);
    const invNoEl = document.getElementById('inv-no');
    const invNoText = invNoEl?.textContent || '';
    const billNum = invNoText.split(' / ')[0] || 'invoice';
    shareElementPdf(invoiceArea, `invoice_${billNum}.pdf`, true);
  });
}

function numberToWords(amount) {
  const words = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];

  if (amount === 0) return "Zero Only";

  function convert(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + words[n % 10] : "");
    return words[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + convert(n % 100) : "");
  }

  let str = "";
  let num = Math.floor(amount);

  if (num >= 10000000) {
    str += convert(Math.floor(num / 10000000)) + " Crore ";
    num %= 10000000;
  }
  if (num >= 100000) {
    str += convert(Math.floor(num / 100000)) + " Lakh ";
    num %= 100000;
  }
  if (num >= 1000) {
    str += convert(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }
  if (num > 0) {
    str += convert(num);
  }

  return str.trim() + " Only";
}

async function showInvoice(id) {
  const res = await fetch(`${API.bills}/${id}`);
  const data = await res.json();
  const b = data.bill;

  // Header
  if (currentProfile) {
    const compName = document.getElementById('company-name');
    const compAddr = document.getElementById('company-address');
    const compGst = document.getElementById('company-gst');
    const compPan = document.getElementById('company-pan');
    const footComp = document.getElementById('footer-company-name');

    if (compName) compName.textContent = currentProfile.company_name || 'RAVE INDIA LTD.';
    if (compAddr) compAddr.textContent = currentProfile.address || '';
    if (compGst) compGst.textContent = currentProfile.gst_id || 'N/A';
    if (compPan) compPan.textContent = currentProfile.pan_no || 'N/A';
    if (footComp) footComp.textContent = currentProfile.company_name;
  }

  // Meta
  const billDate = new Date(b.bill_date);
  const finYear = `${billDate.getFullYear()} / ${billDate.getFullYear().toString().slice(-2)}-${(billDate.getFullYear() % 100 + 1)}`;
  const invNoEl = document.getElementById('inv-no');
  const invDateEl = document.getElementById('inv-date');
  if (invNoEl) invNoEl.textContent = `${b.bill_number} / ${finYear}`;
  if (invDateEl) invDateEl.textContent = dateOnly(b.bill_date);

  // Party Details
  const partyDetailsEl = document.getElementById('inv-party-details');
  if (partyDetailsEl) {
    partyDetailsEl.innerHTML = `
      <strong>${b.customer_name}</strong><br>
      ${b.address || ''}<br>
      GSTIN: ${b.gst_id || 'N/A'}
    `;
  }

  // Items Table
  const itemsBody = document.getElementById('invoice-items-body');
  if (itemsBody) {
    itemsBody.innerHTML = data.items.map((i) =>
      `<tr>
        <td>${i.name}</td>
        <td style="text-align: center;">${(i.size && i.size != '0' && i.size != '0.00') ? `${i.size} in` : '-'}</td>
        <td style="text-align: center;">${i.quantity}</td>
        <td style="text-align: right;">${Number(i.price).toFixed(2)}</td>
        <td style="text-align: right;">${Number(i.total).toFixed(2)}</td>
      </tr>`
    ).join('');
  }

  // Totals
  const subTotalEl = document.getElementById('tot-sub');
  if (subTotalEl) subTotalEl.textContent = Number(b.subtotal).toFixed(2);

  const gstPercent = Number(b.gst_percent);
  const halfGst = (Number(b.gst_amount || 0) / 2).toFixed(2);
  const halfPct = (gstPercent / 2);

  const cgstPctEl = document.getElementById('cgst-pct');
  const sgstPctEl = document.getElementById('sgst-pct');
  const totCgstEl = document.getElementById('tot-cgst');
  const totSgstEl = document.getElementById('tot-sgst');

  if (cgstPctEl) cgstPctEl.textContent = halfPct;
  if (sgstPctEl) sgstPctEl.textContent = halfPct;
  if (totCgstEl) totCgstEl.textContent = halfGst;
  if (totSgstEl) totSgstEl.textContent = halfGst;

  const grandTotalEl = document.getElementById('tot-grand');
  const wordsEl = document.getElementById('tot-words');

  if (grandTotalEl) grandTotalEl.textContent = Number(b.grand_total).toFixed(2);
  if (wordsEl) wordsEl.textContent = numberToWords(Number(b.grand_total));

  invoiceArea.classList.remove('hidden');
}

function buildPdfOptions(el, excludeInvoiceActions = false) {
  const widthPx = 794;
  const heightPx = Math.max(1123, el?.scrollHeight || 1123);
  return {
    margin: 0,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      windowWidth: widthPx,
      width: widthPx,
      height: heightPx,
      letterRendering: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      ignoreElements: (element) => {
        if (!excludeInvoiceActions) return false;
        const isActionBtn = element.id === 'invoice-save-pdf' || element.id === 'invoice-share-pdf';
        const isInvoiceActionsBar = !!(element.closest && element.closest('#invoice')) && element.classList && element.classList.contains('actions');
        return isActionBtn || isInvoiceActionsBar;
      }
    },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.tax-header', '.tax-title-bar', '.tax-meta-grid', '.tax-bottom-info', '.tax-footer'] },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
}
function withInvoiceCaptureStyles(fn) {
  const el = invoiceArea;
  if (!el) return fn();
  const prev = { overflow: el.style.overflow, overflowX: el.style.overflowX, overflowY: el.style.overflowY, width: el.style.width, maxWidth: el.style.maxWidth, transform: el.style.transform, padding: el.style.padding, boxSizing: el.style.boxSizing, margin: el.style.margin };
  try {
    el.style.overflow = 'visible';
    el.style.overflowX = 'visible';
    el.style.overflowY = 'visible';
    el.style.width = '210mm';
    el.style.maxWidth = 'none';
    el.style.transform = 'none';
    el.style.padding = '10mm';
    el.style.boxSizing = 'border-box';
    el.style.margin = '0 auto';
    return fn();
  } finally {
    el.style.overflow = prev.overflow;
    el.style.overflowX = prev.overflowX;
    el.style.overflowY = prev.overflowY;
    el.style.width = prev.width;
    el.style.maxWidth = prev.maxWidth;
    el.style.transform = prev.transform;
    el.style.padding = prev.padding;
    el.style.boxSizing = prev.boxSizing;
    el.style.margin = prev.margin;
  }
}
function pxToMm(px) { return px * 25.4 / 96; }
async function buildSinglePagePdf(el, excludeInvoiceActions = false) {
  const jspdf = window.jspdf?.jsPDF;
  if (!jspdf) throw new Error('jsPDF not available');
  const actionsBar = el.querySelector('.actions');
  const prevDisplay = actionsBar ? actionsBar.style.display : '';
  if (excludeInvoiceActions && actionsBar) actionsBar.style.display = 'none';
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
      backgroundColor: '#ffffff',
      ignoreElements: (element) => {
        if (!excludeInvoiceActions) return false;
        const isActionBtn = element.id === 'invoice-save-pdf' || element.id === 'invoice-share-pdf';
        const isInvoiceActionsBar = !!(element.closest && element.closest('#invoice')) && element.classList && element.classList.contains('actions');
        return isActionBtn || isInvoiceActionsBar;
      }
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const doc = new jspdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const imgWmm = pxToMm(canvas.width);
    const imgHmm = pxToMm(canvas.height);
    const margin = 8;
    const scale = Math.min((pageW - margin * 2) / imgWmm, (pageH - margin * 2) / imgHmm);
    const renderW = imgWmm * scale;
    const renderH = imgHmm * scale;
    const x = (pageW - renderW) / 2;
    const y = (pageH - renderH) / 2;
    doc.addImage(imgData, 'JPEG', x, y, renderW, renderH);
    return { doc, restore: () => { if (actionsBar) actionsBar.style.display = prevDisplay; } };
  } catch (e) {
    if (actionsBar) actionsBar.style.display = prevDisplay;
    throw e;
  }
}
async function saveElementPdf(el, filename, excludeInvoiceActions = false) {
  if (!el) return;
  const { doc, restore } = await buildSinglePagePdf(el, excludeInvoiceActions);
  try { doc.save(filename); } finally { restore(); }
}
async function shareElementPdf(el, filename, excludeInvoiceActions = false) {
  if (!el) return;
  const { doc, restore } = await buildSinglePagePdf(el, excludeInvoiceActions);
  try {
    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    if (canShareFiles) {
      try { await navigator.share({ files: [file], title: filename }); } catch { }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  } finally {
    restore();
  }
}
window.downloadInvoicePdf = async (id) => {
  await showInvoice(id);
  const invNoEl = document.getElementById('inv-no');
  const invNoText = invNoEl?.textContent || '';
  const billNum = invNoText.split(' / ')[0] || 'invoice';
  saveElementPdf(invoiceArea, `invoice_${billNum}.pdf`, true);
};
window.shareInvoicePdf = async (id) => {
  await showInvoice(id);
  const invNoEl = document.getElementById('inv-no');
  const invNoText = invNoEl?.textContent || '';
  const billNum = invNoText.split(' / ')[0] || 'invoice';
  shareElementPdf(invoiceArea, `invoice_${billNum}.pdf`, true);
};
// Remove printBillBtn listener if it exists
// printBillBtn.addEventListener('click', () => { ... });

// Bills history
const billsTableBody = document.querySelector('#bills-table tbody');
const billDetails = document.getElementById('bill-details');
let billsCache = [];
async function loadBills(customerId) {
  const ts = Date.now();
  const url = customerId ? `${API.bills}?customer_id=${customerId}&_=${ts}` : `${API.bills}?_=${ts}`;
  const res = await fetch(url);
  const bills = await res.json();
  billsCache = bills;
  billsTableBody.innerHTML = bills.map(b => `
    <tr>
      <td>${b.id}</td><td>${b.bill_number}</td><td>${String(b.bill_date || '').slice(0, 10)}</td><td>${b.customer_name}</td>
      <td>${Number(b.subtotal).toFixed(2)}</td><td>${Number(b.gst_amount).toFixed(2)}</td><td>${Number(b.discount).toFixed(2)}</td><td><strong>${Number(b.grand_total).toFixed(2)}</strong></td>
      <td>${Number(b.paid_amount || 0).toFixed(2)}</td><td><strong style="color:${Number(b.pending_amount || 0) > 0 ? '#ef4444' : '#16a34a'}">${Number(b.pending_amount || 0).toFixed(2)}</strong></td>
      <td>
        <button class="btn btn-primary" onclick="viewBill(${b.id})">View</button>
        <button class="btn btn-primary" onclick="downloadInvoicePdf(${b.id})">Save PDF</button>
        <button class="btn" onclick="shareInvoicePdf(${b.id})">Share PDF</button>
        <button class="btn btn-primary" onclick="editBill(${b.id})">Edit</button>
        <button class="btn btn-danger" onclick="deleteBill(${b.id})">Delete</button>
      </td>
    </tr>`).join('');
}

// Search
const searchName = document.getElementById('search-name');
const searchBillNo = document.getElementById('search-billno');
const searchFrom = document.getElementById('search-from');
const searchTo = document.getElementById('search-to');
const searchStatus = document.getElementById('search-status');
const searchPhone = document.getElementById('search-phone');
const searchRun = document.getElementById('search-run');
const searchReset = document.getElementById('search-reset');
const searchResultsBody = document.querySelector('#search-results tbody');
let searchTimer = null;
async function runSearch() {
  const params = new URLSearchParams();
  if (searchName?.value) params.set('name', searchName.value);
  if (searchBillNo?.value) params.set('bill_number', searchBillNo.value);
  if (searchFrom?.value) params.set('from', searchFrom.value);
  if (searchTo?.value) params.set('to', searchTo.value);
  if (searchStatus?.value) params.set('status', searchStatus.value);
  if (searchPhone?.value) params.set('phone', searchPhone.value);
  const ts = Date.now();
  params.set('_', ts);
  const res = await fetch(`/api/bills/search?${params.toString()}`);
  const rows = await res.json();
  searchResultsBody.innerHTML = rows.map(b => `
    <tr onclick="viewBill(${b.id})" style="cursor:pointer">
      <td>${b.bill_number}</td><td>${String(b.bill_date || '').slice(0, 10)}</td><td>${b.customer_name}</td>
      <td>${Number(b.grand_total).toFixed(2)}</td><td>${Number(b.paid_amount || 0).toFixed(2)}</td>
      <td><strong style="color:${Number(b.pending_amount || 0) > 0 ? '#ef4444' : '#16a34a'}">${Number(b.pending_amount || 0).toFixed(2)}</strong></td>
      <td>${b.status}</td>
      <td>
        <button class="btn btn-primary" onclick="event.stopPropagation(); viewBill(${b.id}); document.querySelector('[data-tab=\\\"bills\\\"]').click();">View</button>
        <button class="btn btn-danger" onclick="event.stopPropagation(); deleteBill(${b.id})">Delete</button>
      </td>
    </tr>`).join('');
}
function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
}
if (searchRun) searchRun.addEventListener('click', runSearch);
if (searchReset) searchReset.addEventListener('click', () => {
  if (searchName) searchName.value = '';
  if (searchBillNo) searchBillNo.value = '';
  if (searchFrom) searchFrom.value = '';
  if (searchTo) searchTo.value = '';
  if (searchStatus) searchStatus.value = '';
  if (searchPhone) searchPhone.value = '';
  searchResultsBody.innerHTML = '';
});
if (searchName) searchName.addEventListener('input', scheduleSearch);
if (searchBillNo) searchBillNo.addEventListener('input', scheduleSearch);
if (searchFrom) searchFrom.addEventListener('change', scheduleSearch);
if (searchTo) searchTo.addEventListener('change', scheduleSearch);
if (searchStatus) searchStatus.addEventListener('change', scheduleSearch);
if (searchPhone) searchPhone.addEventListener('input', scheduleSearch);
window.viewCustomerBills = async (id) => {
  await loadBills(id);
  document.querySelector('[data-tab=\"bills\"]').click();
  if (billsCache.length > 0) {
    viewBill(billsCache[0].id);
  } else {
    billDetails.classList.add('hidden');
  }
};
window.viewBill = async (id) => {
  const res = await fetch(`${API.bills}/${id}`);
  const data = await res.json();
  const b = data.bill;
  billDetails.classList.remove('hidden');
  billDetails.innerHTML = `
    <h3>Bill #${b.bill_number} - ${b.customer_name}</h3>
    <p>Date: ${dateOnly(b.bill_date)}</p>
    <p><label>Paid Amount: <input type="number" id="payment-input" value="${Number(b.paid_amount || 0).toFixed(2)}" step="0.01" min="0" /></label>
    <button class="btn btn-primary" onclick="updateBillPayment(${b.id})">Save Payment</button>
    <button class="btn" onclick="markFullyPaid(${b.id}, ${Number(b.grand_total || 0)})">Mark Fully Paid</button>
    <button class="btn btn-danger" onclick="deleteBill(${b.id})">Delete Bill</button></p>
    <p><strong>Paid:</strong> ${Number(b.paid_amount || 0).toFixed(2)} &nbsp; <strong>Pending:</strong> ${Number(b.pending_amount || 0).toFixed(2)}</p>
    <div class="actions">
      <button class="btn btn-primary" onclick="editBill(${b.id})">Edit</button>
    </div>
    <table style="margin-top:8px;">
      <thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>
        ${data.items.map(i => `<tr><td>${i.name}</td><td>${(i.size == '0' || i.size == '0.00' || !i.size) ? '' : i.size}</td><td>${i.quantity}</td><td>${(Number(i.price) === 0) ? '' : Number(i.price).toFixed(2)}</td><td>${Number(i.total).toFixed(2)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p><strong>Paid:</strong> ${Number(b.paid_amount || 0).toFixed(2)} &nbsp; <strong>Pending:</strong> ${Number(b.pending_amount || 0).toFixed(2)}</p>
  `;
};
window.deleteBill = async (id) => {
  if (!confirm('Delete this bill? This cannot be undone.')) return;
  const res = await fetch(`${API.bills}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    try {
      const data = await res.json();
      alert(data.error || 'Failed to delete bill');
    } catch {
      alert('Failed to delete bill');
    }
    return;
  }
  await loadBills();
  // If Advanced Search is visible, refresh results too
  try { if (!document.getElementById('search').classList.contains('hidden')) await runSearch(); } catch { }
  billDetails.classList.add('hidden');
  alert('Bill deleted');
};
window.updateBillPayment = async (id) => {
  const input = document.getElementById('payment-input');
  const paid = Number(input.value || 0);
  const res = await fetch(`${API.bills}/${id}/payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid_amount: paid }),
  });
  const data = await res.json();
  if (!res.ok) { alert(data.error || 'Failed to update payment'); return; }
  await loadBills();
  await viewBill(id);
  alert('Payment updated');
};
window.markFullyPaid = async (id, grand) => {
  const input = document.getElementById('payment-input');
  if (input) input.value = Number(grand || 0).toFixed(2);
  await updateBillPayment(id);
};
window.editBill = async (id) => {
  const res = await fetch(`${API.bills}/${id}`);
  const data = await res.json();
  const b = data.bill;
  const newBillBtn = document.querySelector('[data-tab="new-bill"]');
  if (newBillBtn) newBillBtn.click();
  document.getElementById('bill-number').value = b.bill_number || '';
  document.getElementById('bill-date').value = (b.bill_date || '').slice(0, 10);
  billCustomerSelect.value = b.customer_id;
  setCustomerDropdownLabel();
  gstPercentEl.value = Number(b.gst_percent || 0);
  discountEl.value = Number(b.subtotal) > 0 ? ((Number(b.discount || 0) / Number(b.subtotal)) * 100).toFixed(2) : 0;
  if (paidAmountEl) paidAmountEl.value = Number(b.paid_amount || 0).toFixed(2);
  billItemsWrapper.innerHTML = '';
  await refreshItemOptions();
  for (const i of data.items) {
    const row = makeItemRow();
    const itemIdInput = row.querySelector('input[type="hidden"]');
    const searchInput = row.querySelector('.item-search-input');
    const size = row.children[1];
    const price = row.children[2];
    const qty = row.children[3];
    const total = row.children[4];

    itemIdInput.value = i.item_id;
    searchInput.value = i.name;
    const sVal = i.size || '';
    const pVal = Number(i.price || 0);
    size.value = (sVal == '0' || sVal == '0.00') ? '' : sVal;
    price.value = (pVal === 0) ? '' : pVal.toFixed(2);
    qty.value = i.quantity;
    total.value = (Number(i.price) * Number(i.quantity)).toFixed(2);
    billItemsWrapper.appendChild(row);
  }
  recalcTotals();
  document.getElementById('edit-bill-id').value = id;
  saveBillBtn.textContent = 'Update Bill';
};

window.resetBillForm = async () => {
  document.getElementById('edit-bill-id').value = '';
  document.getElementById('bill-number').value = '';
  document.getElementById('bill-date').value = new Date().toISOString().slice(0, 10);
  billCustomerSelect.value = '';
  setCustomerDropdownLabel();
  gstPercentEl.value = '0.00';
  discountEl.value = '0';
  if (paidAmountEl) paidAmountEl.value = '0';
  billItemsWrapper.innerHTML = '';
  await refreshItemOptions();
  billItemsWrapper.appendChild(makeItemRow());
  recalcTotals();
  saveBillBtn.textContent = 'Save Bill';
  if (invoiceArea) invoiceArea.classList.add('hidden');
  await fetchNextBillNumber();
};

// Removed printBill

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('bill-date').value = new Date().toISOString().slice(0, 10);
  // Ensure logo loads from public folder; try .jpg then fallback to .png
  const logoImg = document.getElementById('inv-logo-img');
  if (logoImg) {
    logoImg.onerror = () => {
      if (!logoImg.dataset.triedPng) {
        logoImg.dataset.triedPng = '1';
        logoImg.src = 'logo.png';
      }
    };
  }
  await ensureAuth();
  const token = localStorage.getItem(AUTH_KEY);
  if (token) {
    await Promise.all([loadItems(), loadCustomers(), loadBills()]);
    await loadDashboard();
    await ensureCompanyProfile();
    await fetchNextBillNumber();
  }
});

async function fetchNextBillNumber() {
  const bill_num_el = document.getElementById('bill-number');
  // Only auto-generate if we are not in edit mode
  if (document.getElementById('edit-bill-id').value) return;

  try {
    const res = await fetch('/api/bills/next-number');
    const data = await res.json();
    if (data.next_number) {
      bill_num_el.value = data.next_number;
    }
  } catch (err) {
    console.error('Failed to fetch next bill number:', err);
  }
}

// Dashboard
async function loadDashboard() {
  // Fill year filter with current and previous years
  const yearSel = document.getElementById('dash-year');
  if (yearSel && yearSel.options.length === 0) {
    const y = new Date().getFullYear();
    const years = [y, y - 1, y - 2];
    yearSel.innerHTML = '<option value="">All</option>' + years.map(v => `<option value="${v}">${v}</option>`).join('');
  }
  // Fetch data
  const [billsRes, itemsRes, custRes] = await Promise.all([
    fetch(API.bills), fetch(API.items), fetch(API.customers)
  ]);
  const [bills, items, customers] = await Promise.all([billsRes.json(), itemsRes.json(), custRes.json()]);
  // Stats
  const totalBills = bills.length;
  const totalRevenue = bills.reduce((s, b) => s + Number(b.grand_total || 0), 0);
  const itemsStock = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const statBillsEl = document.getElementById('stat-bills');
  const statRevenueEl = document.getElementById('stat-revenue');
  const statItemsEl = document.getElementById('stat-items');
  const statCustomersEl = document.getElementById('stat-customers');
  if (statBillsEl) statBillsEl.textContent = totalBills;
  if (statRevenueEl) statRevenueEl.textContent = totalRevenue.toFixed(2);
  if (statItemsEl) statItemsEl.textContent = itemsStock;
  if (statCustomersEl) statCustomersEl.textContent = customers.length;
  // Recent bills table with filters
  const tbody = document.querySelector('#dashboard-bills tbody');
  const yearSel2 = document.getElementById('dash-year');
  const monthSel = document.getElementById('dash-month');
  function render() {
    const yf = yearSel2.value;
    const mf = monthSel.value;
    const filtered = bills.filter(b => {
      const d = (b.bill_date || '').slice(0, 10);
      const y = d.slice(0, 4);
      const m = d.slice(5, 7);
      return (!yf || y === yf) && (!mf || m === mf);
    }).slice(0, 10);
    if (!tbody) return;
    tbody.innerHTML = filtered.map(b => `
      <tr>
        <td>${b.id}</td><td>${b.bill_number}</td><td>${b.customer_name}</td>
        <td>${dateOnly(b.bill_date)}</td><td>${Number(b.grand_total).toFixed(2)}</td>
      </tr>`).join('');
  }
  if (yearSel2) yearSel2.onchange = render;
  if (monthSel) monthSel.onchange = render;
  render();
}

// Monthly Report
const reportMonthSel = document.getElementById('report-month');
const reportYearSel = document.getElementById('report-year');
const reportFetchBtn = document.getElementById('report-fetch');
const reportExportCsvBtn = document.getElementById('report-export-csv');
const reportExportPdfBtn = document.getElementById('report-export-pdf');
const reportTableBody = document.querySelector('#report-table tbody');
const reportTitle = document.getElementById('report-title');
const gtQty = document.getElementById('gt-qty');
const gtAmount = document.getElementById('gt-amount');
const gtPaid = document.getElementById('gt-paid');
const gtPending = document.getElementById('gt-pending');
const custTotalsBody = document.querySelector('#customer-totals tbody');
const itemTotalsBody = document.querySelector('#item-totals tbody');
let reportCache = { rows: [], totals: { quantity: 0, amount: 0, paid: 0, pending: 0 }, month: '', year: '' };

function initReportFilters() {
  if (!reportYearSel) return;
  const y = new Date().getFullYear();
  const years = [y, y - 1, y - 2, y - 3];
  reportYearSel.innerHTML = years.map(v => `<option value="${v}">${v}</option>`).join('');
  const m = String(new Date().getMonth() + 1).padStart(2, '0');
  if (reportMonthSel) reportMonthSel.value = m;
  reportYearSel.value = String(y);
}
initReportFilters();

async function loadMonthlyReport() {
  if (!reportMonthSel || !reportYearSel) return;
  const month = reportMonthSel.value;
  const year = reportYearSel.value;
  const ts = Date.now();
  try {
    const res = await fetch(`${API.reports}/monthly?month=${month}&year=${year}&_=${ts}`);
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }
    const data = await res.json();
    reportCache = data;
    renderMonthlyReport();
  } catch (err) {
    alert('Failed to load monthly report. Please try again.');
    reportCache = { rows: [], totals: { quantity: 0, amount: 0, paid: 0, pending: 0 }, month, year };
    renderMonthlyReport();
  }
}

function renderMonthlyReport() {
  const rows = reportCache.rows || [];
  const month = reportCache.month;
  const year = reportCache.year;
  if (reportTitle) reportTitle.textContent = `Monthly Sales & Customer Report - ${year}-${month}`;
  if (reportTableBody) {
    reportTableBody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.customer_name}</td>
        <td>${r.item_name}</td>
        <td>${(r.size == '0' || r.size == '0.00' || !r.size) ? '' : r.size}</td>
        <td>${String(r.bill_date || '').slice(0, 10)}</td>
        <td>${r.bill_number}</td>
        <td>${Number(r.quantity).toFixed(0)}</td>
        <td>${Number(r.amount).toFixed(2)}</td>
        <td>${Number(r.paid_alloc || 0).toFixed(2)}</td>
        <td>${Number(r.pending_alloc || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }
  const totals = reportCache.totals || { quantity: 0, amount: 0, paid: 0, pending: 0 };
  if (gtQty) gtQty.textContent = Number(totals.quantity || 0).toFixed(0);
  if (gtAmount) gtAmount.textContent = Number(totals.amount || 0).toFixed(2);
  if (gtPaid) gtPaid.textContent = Number(totals.paid || 0).toFixed(2);
  if (gtPending) gtPending.textContent = Number(totals.pending || 0).toFixed(2);

  // Customer-wise totals
  const custAgg = new Map();
  for (const r of rows) {
    const key = r.customer_name;
    const prev = custAgg.get(key) || { quantity: 0, amount: 0, paid: 0, pending: 0 };
    prev.quantity += Number(r.quantity || 0);
    prev.amount += Number(r.amount || 0);
    prev.paid += Number(r.paid_alloc || 0);
    prev.pending += Number(r.pending_alloc || 0);
    custAgg.set(key, prev);
  }
  if (custTotalsBody) {
    const arr = Array.from(custAgg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    custTotalsBody.innerHTML = arr.map(([name, t]) =>
      `<tr><td>${name}</td><td>${t.quantity.toFixed(0)}</td><td>${t.amount.toFixed(2)}</td><td>${t.paid.toFixed(2)}</td><td>${t.pending.toFixed(2)}</td></tr>`
    ).join('');
  }
  // Item-wise totals
  const itemAgg = new Map();
  for (const r of rows) {
    const key = r.item_name;
    const prev = itemAgg.get(key) || { quantity: 0, amount: 0, paid: 0, pending: 0 };
    prev.quantity += Number(r.quantity || 0);
    prev.amount += Number(r.amount || 0);
    prev.paid += Number(r.paid_alloc || 0);
    prev.pending += Number(r.pending_alloc || 0);
    itemAgg.set(key, prev);
  }
  if (itemTotalsBody) {
    const arr = Array.from(itemAgg.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    itemTotalsBody.innerHTML = arr.map(([name, t]) =>
      `<tr><td>${name}</td><td>${t.quantity.toFixed(0)}</td><td>${t.amount.toFixed(2)}</td><td>${t.paid.toFixed(2)}</td><td>${t.pending.toFixed(2)}</td></tr>`
    ).join('');
  }
}

function exportReportCsv() {
  const rows = reportCache.rows || [];
  const headers = ['Customer', 'Item', 'Size', 'Bill Date', 'Bill #', 'Quantity', 'Total Amount', 'Paid Amount', 'Pending Amount'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const line = [
      `"${(r.customer_name || '').replace(/"/g, '""')}"`,
      `"${(r.item_name || '').replace(/"/g, '""')}"`,
      `"${(r.size || '').replace(/"/g, '""')}"`,
      String(r.bill_date || '').slice(0, 10),
      `"${(r.bill_number || '').replace(/"/g, '""')}"`,
      Number(r.quantity || 0).toFixed(0),
      Number(r.amount || 0).toFixed(2),
      Number(r.paid_alloc || 0).toFixed(2),
      Number(r.pending_alloc || 0).toFixed(2)
    ];
    lines.push(line.join(','));
  }
  lines.push('');
  lines.push(['Grand Totals', '', '', '', Number(reportCache.totals.quantity || 0).toFixed(0), Number(reportCache.totals.amount || 0).toFixed(2), Number(reportCache.totals.paid || 0).toFixed(2), Number(reportCache.totals.pending || 0).toFixed(2)].join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `monthly_report_${reportCache.year}-${reportCache.month}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}


if (reportFetchBtn) reportFetchBtn.addEventListener('click', loadMonthlyReport);

if (reportFetchBtn) reportFetchBtn.addEventListener('click', loadMonthlyReport);
if (reportExportCsvBtn) reportExportCsvBtn.addEventListener('click', exportReportCsv);
if (reportExportPdfBtn) reportExportPdfBtn.addEventListener('click', () => {
  const area = document.getElementById('report-print-area');
  const fname = `monthly_report_${reportCache.year}-${reportCache.month}.pdf`;
  saveElementPdf(area, fname);
});

// Auto-load report when the tab is opened
const navButtons = document.querySelectorAll('.nav button[data-tab]');
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'new-bill') {
      resetBillForm();
    } else if (btn.dataset.tab === 'report') {
      if (!reportCache.rows || reportCache.rows.length === 0) {
        loadMonthlyReport();
      } else {
        renderMonthlyReport();
      }
    } else if (btn.dataset.tab === 'outstanding') {
      ensureOutstandingLoaded();
    } else if (btn.dataset.tab === 'dashboard') {
      loadDashboard();
    } else if (btn.dataset.tab === 'company-setup') {
      loadProfile().then(p => {
        const name = document.getElementById('comp-name');
        const address = document.getElementById('comp-address');
        const phone = document.getElementById('comp-phone');
        const phone2 = document.getElementById('comp-phone2');
        const email = document.getElementById('comp-email');
        if (name) name.value = p?.company_name || '';
        if (address) address.value = p?.address || '';
        if (phone) phone.value = p?.phone || '';
        if (phone2) phone2.value = p?.phone2 || '';
        if (email) email.value = p?.email || '';
      }).catch(() => {
        const name = document.getElementById('comp-name');
        const address = document.getElementById('comp-address');
        const phone = document.getElementById('comp-phone');
        const phone2 = document.getElementById('comp-phone2');
        const email = document.getElementById('comp-email');
        if (name) name.value = '';
        if (address) address.value = '';
        if (phone) phone.value = '';
        if (phone2) phone2.value = '';
        if (email) email.value = '';
      });
    }
  });
});

// Outstanding Report
const outSearch = document.getElementById('out-search');
const outFrom = document.getElementById('out-from');
const outTo = document.getElementById('out-to');
const outFetchBtn = document.getElementById('out-fetch');
const outExportCsvBtn = document.getElementById('out-export-csv');
const outExportPdfBtn = document.getElementById('out-export-pdf');
const outPrintBtn = document.getElementById('out-print');
const outTableBody = document.querySelector('#out-table tbody');
const outTotals = document.getElementById('out-totals');
const outDetail = document.getElementById('out-detail');
const outDetailTitle = document.getElementById('out-detail-title');
const outDetailBody = document.querySelector('#out-detail-table tbody');
let outCache = [];
let outSortKey = 'total_pending';
let outSortAsc = false;

function ensureOutstandingLoaded() {
  if (!outCache || outCache.length === 0) {
    loadOutstanding();
  } else {
    renderOutstanding();
  }
}
if (outExportPdfBtn) outExportPdfBtn.addEventListener('click', () => {
  const area = document.getElementById('out-print-area');
  const fname = 'outstanding_report.pdf';
  saveElementPdf(area, fname);
});
async function loadOutstanding() {
  const params = new URLSearchParams();
  if (outFrom?.value) params.set('from', outFrom.value);
  if (outTo?.value) params.set('to', outTo.value);
  if (outSearch?.value) params.set('search', outSearch.value.trim());
  const ts = Date.now();
  params.set('_', ts);
  const res = await fetch(`/api/reports/outstanding?${params.toString()}`);
  const data = await res.json();
  outCache = Array.isArray(data) ? data : [];
  renderOutstanding();
}
function renderOutstanding() {
  const rows = [...outCache];
  rows.sort((a, b) => {
    const av = a[outSortKey] ?? '';
    const bv = b[outSortKey] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * (outSortAsc ? 1 : -1);
    }
    return String(av).localeCompare(String(bv)) * (outSortAsc ? 1 : -1);
  });
  outTableBody.innerHTML = rows.map(r => `
    <tr class="row-hover" data-id="${r.customer_id}">
      <td>${r.customer_name}</td>
      <td>${r.phone || ''}</td>
      <td>${r.gst_id || ''}</td>
      <td>${r.bills_count || 0}</td>
      <td>${Number(r.total_paid || 0).toFixed(2)}</td>
      <td class="${Number(r.total_pending || 0) > 0 ? 'pending-red' : ''}">${Number(r.total_pending || 0).toFixed(2)}</td>
    </tr>
  `).join('');
  let sumPaid = 0, sumPending = 0, sumBills = 0;
  for (const r of rows) {
    sumPaid += Number(r.total_paid || 0);
    sumPending += Number(r.total_pending || 0);
    sumBills += Number(r.bills_count || 0);
  }
  outTotals.textContent = `Totals — Bills: ${sumBills} | Paid: ₹${sumPaid.toFixed(2)} | Pending: ₹${sumPending.toFixed(2)}`;
  // click row to load details
  outTableBody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = tr.getAttribute('data-id');
      const name = tr.children[0].textContent;
      loadOutstandingDetail(id, name);
    });
  });
}
async function loadOutstandingDetail(id, name) {
  const params = new URLSearchParams();
  if (outFrom?.value) params.set('from', outFrom.value);
  if (outTo?.value) params.set('to', outTo.value);
  const res = await fetch(`/api/reports/outstanding/${id}?${params.toString()}`);
  const rows = await res.json();
  outDetailTitle.textContent = `Invoices — ${name}`;
  outDetailBody.innerHTML = rows.map(b => `
    <tr>
      <td>${b.bill_number}</td>
      <td>${String(b.bill_date || '').slice(0, 10)}</td>
      <td>${Number(b.grand_total || 0).toFixed(2)}</td>
      <td>${Number(b.paid_amount || 0).toFixed(2)}</td>
      <td class="${Number(b.pending_amount || 0) > 0 ? 'pending-red' : ''}">${Number(b.pending_amount || 0).toFixed(2)}</td>
    </tr>
  `).join('');
  outDetail.classList.remove('hidden');
}
// header sort
const outHeaders = document.querySelectorAll('#out-table thead th');
outHeaders.forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-key');
    if (!key) return;
    if (outSortKey === key) outSortAsc = !outSortAsc;
    else { outSortKey = key; outSortAsc = key === 'customer_name'; }
    renderOutstanding();
  });
});
// controls
if (outFetchBtn) outFetchBtn.addEventListener('click', loadOutstanding);
if (outSearch) outSearch.addEventListener('input', () => {
  if (outSearch.value.length === 0 || outSearch.value.length > 2) {
    loadOutstanding();
  }
});
function exportOutstandingCsv() {
  const rows = outCache || [];
  const headers = ['Customer', 'Mobile', 'GSTIN', 'Total Bills', 'Total Paid', 'Total Pending'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      `"${(r.customer_name || '').replace(/"/g, '""')}"`,
      `"${(r.phone || '').replace(/"/g, '""')}"`,
      `"${(r.gst_id || '').replace(/"/g, '""')}"`,
      Number(r.bills_count || 0),
      Number(r.total_paid || 0).toFixed(2),
      Number(r.total_pending || 0).toFixed(2),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `outstanding_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
if (outExportCsvBtn) outExportCsvBtn.addEventListener('click', exportOutstandingCsv);
