const STORAGE_KEY = "lawnCareTracker.v2";
const frequencyLabels = { 7: "Weekly", 10: "Every 10 days", 14: "Bi-weekly" };

const body = document.getElementById("trackingBody");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
let toastTimer;
let state = loadState();

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function addDays(value, days) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + Number(days));
  return localDateString(date);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.customers) && Array.isArray(saved.visits)) return saved;
  } catch (error) {
    console.warn("Saved data could not be loaded", error);
  }
  return { customers: [], visits: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function customerVisits(customerId) {
  return state.visits
    .filter((visit) => visit.customerId === customerId)
    .sort((a, b) => Number(a.visitNumber) - Number(b.visitNumber));
}

function nextVisitNumber(customerId) {
  const visits = customerVisits(customerId);
  return visits.length ? Math.max(...visits.map((visit) => Number(visit.visitNumber) || 0)) + 1 : 1;
}

function expectedDate(customer) {
  const visits = customerVisits(customer.id).filter((visit) => visit.date);
  const latest = visits[visits.length - 1];
  return latest ? addDays(latest.date, customer.frequency) : "";
}

function render() {
  emptyState.hidden = state.customers.length !== 0;
  body.innerHTML = state.customers.map((customer) => renderCustomer(customer)).join("");
}

function renderCustomer(customer) {
  const visits = customerVisits(customer.id);
  const rows = visits.map((visit) => renderVisit(customer, visit)).join("");
  const nextNumber = nextVisitNumber(customer.id);
  const dueDate = expectedDate(customer);

  return `
    <tr class="customer-row" data-customer-row="${customer.id}">
      <td>
        <div class="customer-cell">
          <input type="text" value="${escapeHTML(customer.name)}" placeholder="Customer name" aria-label="Customer name" data-customer-field="name" data-customer-id="${customer.id}">
          <input type="text" value="${escapeHTML(customer.address)}" placeholder="Address" aria-label="Address" data-customer-field="address" data-customer-id="${customer.id}">
        </div>
      </td>
      <td>
        <select aria-label="Service frequency for ${escapeHTML(customer.name || "customer")}" data-customer-field="frequency" data-customer-id="${customer.id}">
          <option value="7" ${Number(customer.frequency) === 7 ? "selected" : ""}>Weekly</option>
          <option value="10" ${Number(customer.frequency) === 10 ? "selected" : ""}>Every 10 days</option>
          <option value="14" ${Number(customer.frequency) === 14 ? "selected" : ""}>Bi-weekly</option>
        </select>
      </td>
      <td colspan="7"><span class="customer-label">${visits.length} completed visit${visits.length === 1 ? "" : "s"}</span></td>
      <td><button class="icon-button" type="button" title="Delete customer" aria-label="Delete ${escapeHTML(customer.name || "customer")}" data-delete-customer="${customer.id}">×</button></td>
    </tr>
    ${rows}
    <tr class="visit-row new-visit-row">
      <td><span class="new-visit-label">Enter service date →</span></td>
      <td><span class="customer-meta">${frequencyLabels[customer.frequency]}</span></td>
      <td><span class="visit-number">#${nextNumber}</span></td>
      <td><input type="date" aria-label="Date served for visit ${nextNumber}" data-new-visit="${customer.id}"></td>
      <td><div class="next-date">${dueDate ? `<small>Expected</small><strong>${formatDate(dueDate)}</strong>` : `<small>Calculated after service</small>`}</div></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>`;
}

function renderVisit(customer, visit) {
  const nextDate = addDays(visit.date, customer.frequency);
  const paid = visit.paymentStatus === "paid";
  const reminded = visit.reminder === "sent";
  return `
    <tr class="visit-row" data-visit-row="${visit.id}">
      <td></td>
      <td></td>
      <td><span class="visit-number">#${visit.visitNumber}</span></td>
      <td><input type="date" value="${visit.date || ""}" aria-label="Date served for visit ${visit.visitNumber}" data-visit-field="date" data-visit-id="${visit.id}"></td>
      <td><div class="next-date"><strong>${formatDate(nextDate)}</strong><small>${frequencyLabels[customer.frequency]}</small></div></td>
      <td><input type="text" value="${escapeHTML(visit.teamMember || "")}" placeholder="Name" aria-label="Served by for visit ${visit.visitNumber}" data-visit-field="teamMember" data-visit-id="${visit.id}"></td>
      <td><input type="text" value="${escapeHTML(visit.comments || "")}" placeholder="Optional notes" aria-label="Comments for visit ${visit.visitNumber}" data-visit-field="comments" data-visit-id="${visit.id}"></td>
      <td class="check-cell"><input type="checkbox" ${paid ? "checked" : ""} aria-label="Payment received for visit ${visit.visitNumber}" data-visit-field="paymentStatus" data-visit-id="${visit.id}"></td>
      <td class="check-cell"><input type="checkbox" ${reminded ? "checked" : ""} aria-label="Reminder sent for visit ${visit.visitNumber}" data-visit-field="reminder" data-visit-id="${visit.id}"></td>
      <td><button class="icon-button" type="button" title="Delete visit" aria-label="Delete visit ${visit.visitNumber}" data-delete-visit="${visit.id}">×</button></td>
    </tr>`;
}

function addCustomer() {
  const customer = {
    id: makeId("customer"),
    name: "",
    address: "",
    phone: "",
    price: 0,
    frequency: 7,
    startDate: "",
    notes: "",
    createdAt: new Date().toISOString()
  };
  state.customers.push(customer);
  saveState();
  render();
  const input = document.querySelector(`[data-customer-id="${customer.id}"][data-customer-field="name"]`);
  input?.focus();
}

function createVisit(customerId, date) {
  if (!date) return;
  const visit = {
    id: makeId("visit"),
    customerId,
    visitNumber: nextVisitNumber(customerId),
    date,
    teamMember: "",
    amount: 0,
    paymentStatus: "unpaid",
    reminder: "not-sent",
    workStatus: "completed",
    comments: "",
    createdAt: new Date().toISOString()
  };
  state.visits.push(visit);
  saveState();
  render();
  document.querySelector(`[data-visit-id="${visit.id}"][data-visit-field="teamMember"]`)?.focus();
  showToast(`Visit #${visit.visitNumber} added. Next date calculated.`);
}

function updateCustomer(input) {
  const customer = state.customers.find((item) => item.id === input.dataset.customerId);
  if (!customer) return;
  customer[input.dataset.customerField] = input.dataset.customerField === "frequency" ? Number(input.value) : input.value;
  saveState();
  if (input.dataset.customerField === "frequency") render();
}

function updateVisit(input) {
  const visit = state.visits.find((item) => item.id === input.dataset.visitId);
  if (!visit) return;
  const field = input.dataset.visitField;
  if (field === "paymentStatus") visit.paymentStatus = input.checked ? "paid" : "unpaid";
  else if (field === "reminder") visit.reminder = input.checked ? "sent" : "not-sent";
  else visit[field] = input.value;
  saveState();
  if (field === "date") render();
}

function deleteCustomer(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer || !confirm(`Delete ${customer.name || "this customer"} and all visit rows?`)) return;
  state.customers = state.customers.filter((item) => item.id !== customerId);
  state.visits = state.visits.filter((visit) => visit.customerId !== customerId);
  saveState();
  render();
}

function deleteVisit(visitId) {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit || !confirm(`Delete visit #${visit.visitNumber}?`)) return;
  state.visits = state.visits.filter((item) => item.id !== visitId);
  const remaining = customerVisits(visit.customerId);
  remaining.forEach((item, index) => item.visitNumber = index + 1);
  saveState();
  render();
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

document.getElementById("addCustomerButton").addEventListener("click", addCustomer);

body.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.newVisit) createVisit(input.dataset.newVisit, input.value);
  else if (input.dataset.customerField) updateCustomer(input);
  else if (input.dataset.visitField) updateVisit(input);
});

body.addEventListener("input", (event) => {
  const input = event.target;
  if (input.dataset.customerField && input.dataset.customerField !== "frequency") updateCustomer(input);
  if (input.dataset.visitField && ["teamMember", "comments"].includes(input.dataset.visitField)) updateVisit(input);
});

body.addEventListener("click", (event) => {
  const customerButton = event.target.closest("[data-delete-customer]");
  const visitButton = event.target.closest("[data-delete-visit]");
  if (customerButton) deleteCustomer(customerButton.dataset.deleteCustomer);
  if (visitButton) deleteVisit(visitButton.dataset.deleteVisit);
});

render();
