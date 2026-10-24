const STORAGE_KEY = "dom-v-poryadke-v1";
const categories = {
  food: { label: "Продукты", color: "#7c9c72", icon: "●" },
  utilities: { label: "Коммуналка", color: "#d3a56d", icon: "●" },
  transport: { label: "Транспорт", color: "#819ca8", icon: "●" },
  entertainment: { label: "Развлечения", color: "#bd8ca7", icon: "●" },
  health: { label: "Здоровье", color: "#d17f69", icon: "●" },
  other: { label: "Другое", color: "#a5a79a", icon: "●" }
};

const formatMoney = (amount) => new Intl.NumberFormat("ru-UZ", {
  style: "currency",
  currency: "UZS",
  maximumFractionDigits: 0
}).format(amount);
const today = new Date();
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const getInitialState = () => ({ incomes: {}, expenses: [], shopping: [] });

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return getInitialState();
    const parsed = JSON.parse(saved);
    return {
      incomes: parsed.incomes && typeof parsed.incomes === "object" ? parsed.incomes : {},
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses.filter((expense) => !String(expense.id).startsWith("sample-"))
        : [],
      shopping: Array.isArray(parsed.shopping) ? parsed.shopping : []
    };
  } catch (error) {
    console.error("Не удалось загрузить сохранённые данные бюджета.", error);
    showToast("Не получилось загрузить сохранённые данные");
    return getInitialState();
  }
}

let toastTimer;
let state = loadState();
let selectedMonth = monthKey(today);

const elements = {
  month: document.querySelector("#month-select"),
  incomeInput: document.querySelector("#income-input"),
  incomeTotal: document.querySelector("#income-total"),
  expenseTotal: document.querySelector("#expense-total"),
  balanceTotal: document.querySelector("#balance-total"),
  balanceProgress: document.querySelector("#balance-progress"),
  balanceCaption: document.querySelector("#balance-caption"),
  expenseCaption: document.querySelector("#expense-caption"),
  chart: document.querySelector("#donut-chart"),
  chartTotal: document.querySelector("#chart-total"),
  chartLegend: document.querySelector("#chart-legend"),
  chartEmpty: document.querySelector("#chart-empty"),
  expenseList: document.querySelector("#expense-list"),
  expensesEmpty: document.querySelector("#expenses-empty"),
  expenseDialog: document.querySelector("#expense-dialog"),
  expenseForm: document.querySelector("#expense-form"),
  expenseDate: document.querySelector("#expense-date"),
  shoppingForm: document.querySelector("#shopping-form"),
  shoppingInput: document.querySelector("#shopping-input"),
  shoppingList: document.querySelector("#shopping-list"),
  shoppingEmpty: document.querySelector("#shopping-empty"),
  shoppingCount: document.querySelector("#shopping-count"),
  shoppingTotal: document.querySelector("#shopping-total"),
  shoppingProgressText: document.querySelector("#shopping-progress-text"),
  remainingCount: document.querySelector("#remaining-count"),
  boughtCount: document.querySelector("#bought-count"),
  toast: document.querySelector("#toast")
};

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.querySelector(".sync-status").innerHTML = "<span></span> Данные сохранены";
  } catch (error) {
    console.error("Не удалось сохранить бюджет в браузере.", error);
    document.querySelector(".sync-status").innerHTML = "<span></span> Ошибка сохранения";
    showToast("Не удалось сохранить данные на устройстве");
  }
}

function renderMonths() {
  const options = [];
  for (let offset = -6; offset <= 6; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const value = monthKey(date);
    const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
    options.push(`<option value="${value}">${label.charAt(0).toLocaleUpperCase("ru-RU")}${label.slice(1)}</option>`);
  }
  elements.month.innerHTML = options.join("");
  elements.month.value = selectedMonth;
}

function renderBudget() {
  const monthExpenses = state.expenses.filter((expense) => expense.date && expense.date.slice(0, 7) === selectedMonth);
  const income = Number(state.incomes[selectedMonth]) || 0;
  const spent = monthExpenses.reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
  const balance = income - spent;
  elements.incomeInput.value = income || "";
  elements.incomeTotal.textContent = formatMoney(income);
  elements.expenseTotal.textContent = formatMoney(spent);
  elements.balanceTotal.textContent = formatMoney(balance);
  elements.balanceTotal.classList.toggle("negative", balance < 0);
  elements.expenseCaption.textContent = monthExpenses.length
    ? `${monthExpenses.length} ${pluralize(monthExpenses.length, ["запись", "записи", "записей"])} за месяц`
    : "Добавьте первую трату";
  const percentLeft = income > 0 ? Math.max(0, Math.min(100, (balance / income) * 100)) : 0;
  elements.balanceProgress.style.width = `${percentLeft}%`;
  elements.balanceCaption.textContent = balance < 0 ? "Расходы превысили доход" : "Доступно для планирования";
  renderChart(monthExpenses, spent);
  renderExpenses(monthExpenses);
}

function renderChart(expenses, total) {
  elements.chartTotal.textContent = formatMoney(total);
  elements.chartLegend.replaceChildren();
  if (!total) {
    elements.chart.style.background = "conic-gradient(#e8ede7 0deg 360deg)";
    elements.chartEmpty.classList.add("visible");
    return;
  }
  elements.chartEmpty.classList.remove("visible");
  const grouped = expenses.reduce((result, expense) => {
    const key = categories[expense.category] ? expense.category : "other";
    result[key] = (result[key] || 0) + Number(expense.amount);
    return result;
  }, {});
  let angle = 0;
  const stops = [];
  Object.entries(grouped).forEach(([key, amount]) => {
    const category = categories[key];
    const end = angle + (amount / total) * 360;
    stops.push(`${category.color} ${angle}deg ${end}deg`);
    angle = end;
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<i class="legend-dot" style="background:${category.color}"></i><span>${category.label}</span><strong>${formatMoney(amount)}</strong>`;
    elements.chartLegend.append(item);
  });
  elements.chart.style.background = `conic-gradient(${stops.join(", ")})`;
}

function renderExpenses(expenses) {
  elements.expenseList.replaceChildren();
  elements.expensesEmpty.classList.toggle("visible", expenses.length === 0);
  [...expenses].sort((a, b) => b.date.localeCompare(a.date)).forEach((expense) => {
    const category = categories[expense.category] || categories.other;
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = expense.name;
    const categoryCell = document.createElement("td");
    categoryCell.innerHTML = `<span class="category-label"><i style="background:${category.color}"></i>${category.label}</span>`;
    const dateCell = document.createElement("td");
    const date = new Date(`${expense.date}T00:00:00`);
    dateCell.textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
    const amountCell = document.createElement("td");
    amountCell.className = "amount-cell";
    amountCell.textContent = `− ${formatMoney(Number(expense.amount) || 0)}`;
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-expense";
    removeButton.setAttribute("aria-label", `Удалить расход: ${expense.name}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== expense.id);
      saveState();
      renderBudget();
      showToast("Расход удалён");
    });
    actionCell.append(removeButton);
    row.append(nameCell, categoryCell, dateCell, amountCell, actionCell);
    elements.expenseList.append(row);
  });
}

function renderShopping() {
  elements.shoppingList.replaceChildren();
  const pending = state.shopping.filter((item) => !item.bought).length;
  const bought = state.shopping.length - pending;
  elements.shoppingCount.textContent = String(pending);
  elements.shoppingTotal.textContent = `${state.shopping.length} ${pluralize(state.shopping.length, ["товар", "товара", "товаров"])}`;
  elements.shoppingProgressText.textContent = state.shopping.length
    ? `Куплено ${bought} из ${state.shopping.length}`
    : "Всё нужное — в одном месте";
  elements.remainingCount.textContent = String(pending);
  elements.boughtCount.textContent = String(bought);
  elements.shoppingEmpty.classList.toggle("visible", state.shopping.length === 0);

  state.shopping.forEach((item) => {
    const row = document.createElement("div");
    row.className = `shopping-item${item.bought ? " checked" : ""}`;
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = "shopping-checkbox";
    checkbox.setAttribute("aria-label", `${item.bought ? "Вернуть в список" : "Отметить купленным"}: ${item.name}`);
    checkbox.setAttribute("aria-pressed", String(item.bought));
    checkbox.textContent = "✓";
    checkbox.addEventListener("click", () => {
      item.bought = !item.bought;
      saveState();
      renderShopping();
    });
    const name = document.createElement("span");
    name.className = "shopping-item-name";
    name.textContent = item.name;
    const date = document.createElement("small");
    date.textContent = "семейный список";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-shopping";
    remove.setAttribute("aria-label", `Удалить из списка: ${item.name}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.shopping = state.shopping.filter((entry) => entry.id !== item.id);
      saveState();
      renderShopping();
    });
    row.append(checkbox, name, date, remove);
    elements.shoppingList.append(row);
  });
}

function pluralize(number, forms) {
  const lastTwo = number % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  const last = number % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function openExpenseDialog() {
  elements.expenseDate.value = new Date().toISOString().slice(0, 10);
  elements.expenseDialog.showModal();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    const isShopping = button.dataset.tab === "shopping";
    document.querySelector("#budget-page").classList.toggle("active", !isShopping);
    document.querySelector("#shopping-page").classList.toggle("active", isShopping);
    document.querySelector("#breadcrumb-current").textContent = isShopping ? "Список покупок" : "Обзор";
  });
});

elements.month.addEventListener("change", () => {
  selectedMonth = elements.month.value;
  renderBudget();
});

document.querySelector("#income-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const income = Number(elements.incomeInput.value);
  if (!Number.isFinite(income) || income < 0) {
    elements.incomeInput.focus();
    showToast("Введите корректную сумму дохода");
    return;
  }
  state.incomes[selectedMonth] = income;
  saveState();
  renderBudget();
  showToast("Доход сохранён");
});

document.querySelector("#add-expense-button").addEventListener("click", openExpenseDialog);
document.querySelector("#add-expense-shortcut").addEventListener("click", openExpenseDialog);
document.querySelector(".dialog-close").addEventListener("click", () => elements.expenseDialog.close());
document.querySelector(".cancel-button").addEventListener("click", () => elements.expenseDialog.close());
elements.expenseDialog.addEventListener("click", (event) => {
  if (event.target === elements.expenseDialog) elements.expenseDialog.close();
});

elements.expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.expenseForm);
  const name = String(formData.get("name")).trim();
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date"));
  if (!name || !Number.isFinite(amount) || amount <= 0 || !date) {
    showToast("Проверьте название, дату и сумму расхода");
    return;
  }
  state.expenses.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    amount,
    category: String(formData.get("category")),
    date
  });
  saveState();
  elements.expenseDialog.close();
  elements.expenseForm.reset();
  renderBudget();
  showToast("Расход добавлен");
});

elements.shoppingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.shoppingInput.value.trim();
  if (!name) {
    elements.shoppingInput.focus();
    return;
  }
  state.shopping.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    bought: false
  });
  saveState();
  elements.shoppingForm.reset();
  elements.shoppingInput.focus();
  renderShopping();
  showToast("Добавлено в общий список");
});

document.querySelector("#clear-bought").addEventListener("click", () => {
  const before = state.shopping.length;
  state.shopping = state.shopping.filter((item) => !item.bought);
  if (state.shopping.length === before) {
    showToast("Купленных товаров пока нет");
    return;
  }
  saveState();
  renderShopping();
  showToast("Купленные товары удалены");
});

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    state = loadState();
    renderBudget();
    renderShopping();
  }
});

renderMonths();
renderBudget();
renderShopping();