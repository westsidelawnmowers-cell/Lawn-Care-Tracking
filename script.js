const STORAGE_KEY = "lawnCareTracker.v2";

const frequencyLabels = {
  7: "Weekly",
  10: "Every 10 days",
  14: "Bi-weekly"
};

const elements = {
  tableBody: document.getElementById("customerTableBody"),
  emptyState: document.getElementById("emptyState"),
  search: document.getElementById("searchInput"),
  filter: document.getElementById("statusFilter"),
  customerDialog: document.getElementById("customerDialog"),
  customerForm: document.getElementById("customerForm"),
  visitDialog: document.getElementById("visitDialog"),
  visitForm: document.getElementById("visitForm"),
  historyDialog: document.getElementById("historyDialog"),
  toast: document.getElementById("toast")
};

let state = loadState();
let activeHistoryCustomerId = null;
let toastTimer;

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function parseDate(value) {
  return new Date(`${value}T12:00:00`);
}

function addDays(value, days) {
  const date = parseDate(value);
  date.setDate(date.getDate() + Number(days));
  return localDateString(date);
}

function daysBetween(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.customers) && Array.isArray(stored.visits)) return stored;
  } catch (error) {
    console.warn("Could not load saved tracker data", error);
  }

  const today = localDateString();
  const originalCustomers = [
    ["Dima", "417 Germain Manor"],
    ["Randy Best", "1515 Shannon Cres"],
    ["Abdul Razzaq", "1302 Hunter Road"],
    ["Tony", "219 Edgemont Crest"],
    ["Dawn", "905 6th Ave North"],
    ["Trudy", "219 Greaves Crest"]
  ];

  return {
    customers: originalCustomers.map(([name, address], index) => ({
      id: makeId(`customer-${index}`),
      name,
      address,
      phone: "",
      price: 0,
      frequency: 7,
      startDate: addDays(today, index),
      notes: "",
      createdAt: new Date().toISOString()
    })),
    visits: []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCustomerVisits(customerId) {
  return state.visits
    .filter((visit) => visit.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getSchedule(customer) {
  const visits = getCustomerVisits(customer.id);
  const latest = visits[0];
  const nextDate = latest ? addDays(latest.date, customer.frequency) : customer.startDate;
  const unpaid = visits.filter((visit) => visit.workStatus === "completed" && visit.paymentStatus === "unpaid");
  return {
    visits,
    latest,
    nextDate,
    nextVisitNumber: visits.length + 1,
    unpaid,
    unpaidTotal: unpaid.reduce((sum, visit) => sum + Number(visit.amount || 0), 0)
  };
}

function dateStatus(date) {
  const difference = daysBetween(localDateString(), date);
  if (difference < 0) return "overdue";
  if (difference === 0) return "today";
  if (difference <= 7) return "upcoming";
  return "later";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(parseDate(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dueText(date) {
  const difference = daysBetween(localDateString(), date);
  if (difference < 0) return `${Math.abs(difference)} day${Math.abs(difference) === 1 ? "" : "s"} overdue`;
  if (difference === 0) return "Due today";
  if (difference === 1) return "Due tomorrow";
  return `Due in ${difference} days`;
}

function render() {
  renderMetrics();
  renderCustomers();
}

function renderMetrics() {
  const schedules = state.customers.map((customer) => getSchedule(customer));
  const statuses = schedules.map((schedule) => dateStatus(schedule.nextDate));
  const unpaidVisits = state.visits.filter((visit) => visit.workStatus === "completed" && visit.paymentStatus === "unpaid");

  document.getElementById("overdueCount").textContent = statuses.filter((status) => status === "overdue").length;
  document.getElementById("todayCount").textContent = statuses.filter((status) => status === "today").length;
  document.getElementById("upcomingCount").textContent = statuses.filter((status) => status === "upcoming").length;
  document.getElementById("unpaidTotal").textContent = formatMoney(unpaidVisits.reduce((sum, visit) => sum + Number(visit.amount || 0), 0));
  document.getElementById("unpaidCount").textContent = `${unpaidVisits.length} completed visit${unpaidVisits.length === 1 ? "" : "s"}`;
}

function customerMatchesFilter(customer, query, filter) {
  const schedule = getSchedule(customer);
  const searchTarget = `${customer.name} ${customer.address} ${customer.phone}`.toLowerCase();
  if (query && !searchTarget.includes(query)) return false;
  if (filter === "all") return true;
  if (filter === "unpaid") return schedule.unpaid.length > 0;
  return dateStatus(schedule.nextDate) === filter;
}

function renderCustomers() {
  const query = elements.search.value.trim().toLowerCase();
  const filter = elements.filter.value;
  const customers = state.customers
    .filter((customer) => customerMatchesFilter(customer, query, filter))
    .sort((a, b) => getSchedule(a).nextDate.localeCompare(getSchedule(b).nextDate) || a.name.localeCompare(b.name));

  elements.tableBody.innerHTML = customers.map((customer) => {
    const schedule = getSchedule(customer);
    const status = dateStatus(schedule.nextDate);
    const payment = schedule.unpaid.length
      ? `<span class="payment-badge unpaid">${schedule.unpaid.length} unpaid · ${formatMoney(schedule.unpaidTotal)}</span>`
      : schedule.visits.length
        ? `<span class="payment-badge paid">✓ Up to date</span>`
        : `<span class="payment-badge none">No visits</span>`;

    return `
      <tr>
        <td>
          <button class="customer-name-button" data-action="history" data-id="${customer.id}" type="button">
            <span class="customer-name">${escapeHTML(customer.name)}</span>
            <span class="customer-meta">${escapeHTML(customer.address)}</span>
          </button>
        </td>
        <td><span class="plan-label">${frequencyLabels[customer.frequency] || `Every ${customer.frequency} days`}</span></td>
        <td><span class="date-main">${formatDate(schedule.nextDate)}</span><span class="due-label ${status}">${dueText(schedule.nextDate)}</span></td>
        <td><span class="visit-number">#${schedule.nextVisitNumber}</span></td>
        <td>${schedule.latest ? `<span class="date-main">${formatDate(schedule.latest.date)}</span><span class="customer-meta">${escapeHTML(schedule.latest.teamMember || "No crew recorded")}</span>` : "—"}</td>
        <td>${payment}</td>
        <td><div class="row-actions"><button class="button secondary" data-action="history" data-id="${customer.id}" type="button">History</button><button class="button primary" data-action="visit" data-id="${customer.id}" type="button">Record visit</button></div></td>
      </tr>`;
  }).join("");

  elements.emptyState.hidden = customers.length !== 0;
}

function openCustomerDialog(customerId = null) {
  const customer = state.customers.find((item) => item.id === customerId);
  elements.customerForm.reset();
  document.getElementById("customerId").value = customer?.id || "";
  document.getElementById("customerDialogTitle").textContent = customer ? "Edit customer" : "Add customer";
  document.getElementById("deleteCustomerButton").hidden = !customer;
  document.getElementById("customerName").value = customer?.name || "";
  document.getElementById("customerAddress").value = customer?.address || "";
  document.getElementById("customerPhone").value = customer?.phone || "";
  document.getElementById("customerPrice").value = customer?.price || "";
  document.getElementById("customerFrequency").value = String(customer?.frequency || 7);
  document.getElementById("customerStartDate").value = customer?.startDate || localDateString();
  document.getElementById("customerNotes").value = customer?.notes || "";
  elements.customerDialog.showModal();
  setTimeout(() => document.getElementById("customerName").focus(), 0);
}

function saveCustomer(event) {
  event.preventDefault();
  const id = document.getElementById("customerId").value;
  const existing = state.customers.find((customer) => customer.id === id);
  const customer = {
    id: existing?.id || makeId("customer"),
    name: document.getElementById("customerName").value.trim(),
    address: document.getElementById("customerAddress").value.trim(),
    phone: document.getElementById("customerPhone").value.trim(),
    price: Number(document.getElementById("customerPrice").value || 0),
    frequency: Number(document.getElementById("customerFrequency").value),
    startDate: document.getElementById("customerStartDate").value,
    notes: document.getElementById("customerNotes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (existing) Object.assign(existing, customer);
  else state.customers.push(customer);
  saveState();
  elements.customerDialog.close();
  render();
  showToast(existing ? "Customer updated" : "Customer added");
}

function deleteCustomer() {
  const id = document.getElementById("customerId").value;
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) return;
  if (!confirm(`Delete ${customer.name} and all of their visit history? This cannot be undone.`)) return;
  state.customers = state.customers.filter((item) => item.id !== id);
  state.visits = state.visits.filter((visit) => visit.customerId !== id);
  saveState();
  elements.customerDialog.close();
  render();
  showToast("Customer deleted");
}

function openVisitDialog(customerId) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const schedule = getSchedule(customer);
  elements.visitForm.reset();
  document.getElementById("visitCustomerId").value = customer.id;
  document.getElementById("visitId").value = "";
  document.getElementById("visitCustomerLabel").textContent = customer.name;
  document.getElementById("visitNumberLabel").textContent = `#${schedule.nextVisitNumber}`;
  document.getElementById("visitDate").value = schedule.nextDate;
  document.getElementById("visitAmount").value = customer.price || "";
  document.getElementById("visitPaymentStatus").value = "unpaid";
  document.getElementById("visitReminder").value = "not-sent";
  document.getElementById("visitWorkStatus").value = "completed";
  elements.visitDialog.showModal();
  setTimeout(() => document.getElementById("visitDate").focus(), 0);
}

function saveVisit(event) {
  event.preventDefault();
  const customerId = document.getElementById("visitCustomerId").value;
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  const schedule = getSchedule(customer);
  const visit = {
    id: makeId("visit"),
    customerId,
    visitNumber: schedule.nextVisitNumber,
    date: document.getElementById("visitDate").value,
    teamMember: document.getElementById("visitTeamMember").value.trim(),
    amount: Number(document.getElementById("visitAmount").value || 0),
    paymentStatus: document.getElementById("visitPaymentStatus").value,
    reminder: document.getElementById("visitReminder").value,
    workStatus: document.getElementById("visitWorkStatus").value,
    comments: document.getElementById("visitComments").value.trim(),
    createdAt: new Date().toISOString()
  };
  state.visits.push(visit);
  saveState();
  elements.visitDialog.close();
  render();
  if (elements.historyDialog.open) openHistory(customerId, true);
  showToast(`Visit #${visit.visitNumber} saved. Next date calculated.`);
}

function openHistory(customerId, refresh = false) {
  const customer = state.customers.find((item) => item.id === customerId);
  if (!customer) return;
  activeHistoryCustomerId = customerId;
  const visits = getCustomerVisits(customerId);
  document.getElementById("historyTitle").textContent = customer.name;
  document.getElementById("historyAddress").textContent = `${customer.address} · ${frequencyLabels[customer.frequency]}`;
  const notes = document.getElementById("historyNotes");
  notes.hidden = !customer.notes;
  notes.textContent = customer.notes;
  document.getElementById("historyList").innerHTML = visits.length ? visits.map((visit) => `
    <article class="history-item">
      <div class="history-number">Visit #${visit.visitNumber}</div>
      <div>
        <h3>${formatDate(visit.date)} · ${escapeHTML(visit.teamMember)}</h3>
        <span class="payment-badge ${visit.paymentStatus === "paid" ? "paid" : visit.paymentStatus === "unpaid" ? "unpaid" : "none"}">${visit.paymentStatus === "paid" ? "Payment received" : visit.paymentStatus === "unpaid" ? "Payment not received" : "No payment required"}</span>
        <span class="payment-badge none">${visit.reminder === "sent" ? "Reminder sent" : visit.reminder === "not-needed" ? "No reminder needed" : "Reminder not sent"}</span>
        ${visit.comments ? `<p>${escapeHTML(visit.comments)}</p>` : ""}
      </div>
      <div class="history-details"><strong>${formatMoney(visit.amount)}</strong><span>${visit.workStatus === "completed" ? "Completed" : "Skipped"}</span>${visit.paymentStatus === "unpaid" ? `<button class="button secondary mark-paid" data-visit-id="${visit.id}" type="button">Mark paid</button>` : ""}</div>
    </article>`).join("") : `<div class="history-empty">No visits recorded yet.</div>`;
  if (!refresh) elements.historyDialog.showModal();
}

function markVisitPaid(visitId) {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) return;
  visit.paymentStatus = "paid";
  saveState();
  render();
  openHistory(visit.customerId, true);
  showToast("Payment marked as received");
}

function exportCsv() {
  const headers = ["Customer", "Address", "Phone", "Frequency", "Visit Number", "Service Date", "Team Member", "Work Status", "Amount", "Payment", "Reminder", "Comments", "Next Scheduled Date"];
  const rows = [];
  state.customers.forEach((customer) => {
    const schedule = getSchedule(customer);
    if (!schedule.visits.length) {
      rows.push([customer.name, customer.address, customer.phone, frequencyLabels[customer.frequency], "", "", "", "", "", "", "", customer.notes, schedule.nextDate]);
    } else {
      schedule.visits.forEach((visit) => rows.push([customer.name, customer.address, customer.phone, frequencyLabels[customer.frequency], visit.visitNumber, visit.date, visit.teamMember, visit.workStatus, visit.amount, visit.paymentStatus, visit.reminder, visit.comments, schedule.nextDate]));
    }
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = `lawn-care-tracker-${localDateString()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV backup downloaded");
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
document.getElementById("addCustomerButton").addEventListener("click", () => openCustomerDialog());
document.getElementById("exportButton").addEventListener("click", exportCsv);
document.getElementById("deleteCustomerButton").addEventListener("click", deleteCustomer);
elements.customerForm.addEventListener("submit", saveCustomer);
elements.visitForm.addEventListener("submit", saveVisit);
elements.search.addEventListener("input", renderCustomers);
elements.filter.addEventListener("change", renderCustomers);

elements.tableBody.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "visit") openVisitDialog(action.dataset.id);
  if (action.dataset.action === "history") openHistory(action.dataset.id);
});

document.getElementById("historyList").addEventListener("click", (event) => {
  const button = event.target.closest(".mark-paid");
  if (button) markVisitPaid(button.dataset.visitId);
});

document.getElementById("editCustomerButton").addEventListener("click", () => {
  elements.historyDialog.close();
  openCustomerDialog(activeHistoryCustomerId);
});

document.getElementById("historyAddVisitButton").addEventListener("click", () => {
  elements.historyDialog.close();
  openVisitDialog(activeHistoryCustomerId);
});

document.querySelectorAll(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

saveState();
render();
