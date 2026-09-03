const STORAGE_KEY = 'expenseTracker.transactions';

const CATEGORIES = {
  expense: [
    'Food & Dining',
    'Transportation',
    'Housing',
    'Utilities',
    'Entertainment',
    'Healthcare',
    'Shopping',
    'Other'
  ],
  income: [
    'Salary',
    'Freelance',
    'Investments',
    'Gift',
    'Other'
  ]
};

// DOM Elements
const form = document.getElementById('transaction-form');
const typeSelect = document.getElementById('type');
const descriptionInput = document.getElementById('description');
const categorySelect = document.getElementById('category');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const formError = document.getElementById('form-error');

const balanceEl = document.getElementById('balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');

const transactionsList = document.getElementById('transactions-list');
const emptyMessage = document.getElementById('empty-message');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const submitBtn = document.getElementById('submit-btn');

const monthlySummaryEl = document.getElementById('monthly-summary');
const chartContainerEl = document.getElementById('chart-container');
const monthSelector = document.getElementById('month-selector');

// State
let transactions = loadTransactions();
let editingId = null;
let categoryChart = null;
let selectedMonth = null;

// Data operations
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to load transactions:', error);
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error(`Failed to save transactions: ${error}`);
    formError.textContent = 'Unable to save. Storage might be full.';
  }
}

function getFilteredTransactions() {
  const typeFilter = filterType.value;
  const categoryFilter = filterCategory.value;

  return transactions
    .filter(({ type, category }) => {
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function calculateSummary() {
  return transactions.reduce(
    (totals, { type, amount }) => {
      if (type === 'income') {
        totals.income += amount;
      } else {
        totals.expense += amount;
      }
      return totals;
    },
    { income: 0, expense: 0 }
  );
}

// Formatting helpers
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function formatCurrency(amount) {
  return inrFormatter.format(amount);
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Rendering
function populateCategories(type) {
  const options = CATEGORIES[type];
  categorySelect.innerHTML = options
    .map(category => `<option value="${category}">${category}</option>`)
    .join('');
}

function populateFilterCategories() {
  const categories = new Set(transactions.map(t => t.category));
  const options = ['<option value="all">All Categories</option>'];

  categories.forEach(category => {
    if (category) {
      options.push(`<option value="${category}">${category}</option>`);
    }
  });

  filterCategory.innerHTML = options.join('');
}

function renderTransactions() {
  const filtered = getFilteredTransactions();

  transactionsList.innerHTML = '';

  if (filtered.length === 0) {
    emptyMessage.textContent = 'No transactions found.';
    transactionsList.appendChild(emptyMessage);
    return;
  }

  filtered.forEach(transaction => {
    const { id, type, description, category, amount, date } = transaction;
    const sign = type === 'income' ? '+' : '-';
    const badgeLetter = (category[0] || '?').toUpperCase();

    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.innerHTML = `
      <span class="transaction-category-badge ${type}" title="${category}">${badgeLetter}</span>
      <div class="transaction-info">
        <div class="transaction-description">${description}</div>
        <div class="transaction-meta">${category} · ${formatDate(date)}</div>
      </div>
      <span class="transaction-amount ${type}">${sign}${formatCurrency(amount)}</span>
      <div class="transaction-actions">
        <button class="edit-btn" title="Edit transaction">✎</button>
        <button class="delete-btn" title="Delete transaction">✕</button>
      </div>
    `;

    item.querySelector('.edit-btn').addEventListener('click', () => startEdit(id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(id));

    transactionsList.appendChild(item);
  });
}

function renderSummary() {
  const { income, expense } = calculateSummary();
  const balance = income - expense;

  balanceEl.textContent = formatCurrency(balance);
  totalIncomeEl.textContent = `+${formatCurrency(income)}`;
  totalExpenseEl.textContent = `-${formatCurrency(expense)}`;
}

// Monthly Expense Summary
function monthKeyOf(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function getAvailableMonths() {
  const keys = new Set();
  transactions.forEach(t => {
    const key = monthKeyOf(t.date);
    if (key) keys.add(key);
  });
  return Array.from(keys).sort().reverse();
}

function populateMonthSelector() {
  const months = getAvailableMonths();

  if (months.length === 0) {
    monthSelector.innerHTML = '<option value="">No months available</option>';
    monthSelector.disabled = true;
    selectedMonth = null;
    return;
  }

  monthSelector.disabled = false;
  monthSelector.innerHTML = months
    .map(key => `<option value="${key}">${monthLabel(key)}</option>`)
    .join('');

  if (!selectedMonth || !months.includes(selectedMonth)) {
    selectedMonth = months[0];
  }
  monthSelector.value = selectedMonth;
}

function getExpensesForMonth(monthKey) {
  return transactions.filter(
    t => t.type === 'expense' && monthKeyOf(t.date) === monthKey
  );
}

function calculateMonthlyTotal(monthKey) {
  return getExpensesForMonth(monthKey).reduce((total, { amount }) => total + amount, 0);
}

function renderMonthlySummary() {
  populateMonthSelector();

  if (!selectedMonth) {
    monthlySummaryEl.innerHTML = '<p class="empty-message">No expense data yet.</p>';
    return;
  }

  const total = calculateMonthlyTotal(selectedMonth);
  const count = getExpensesForMonth(selectedMonth).length;

  if (count === 0) {
    monthlySummaryEl.innerHTML = '<p class="empty-message">No expenses recorded for this month.</p>';
    return;
  }

  monthlySummaryEl.innerHTML = `
    <div class="monthly-total-card">
      <span class="monthly-label">Total for ${monthLabel(selectedMonth)}</span>
      <span class="monthly-amount">${formatCurrency(total)}</span>
    </div>
    <div class="monthly-count">${count} expense${count === 1 ? '' : 's'} recorded</div>
  `;
}

// Category-wise Expense Chart
function calculateCategoryExpenses() {
  return getExpensesForMonth(selectedMonth || '')
    .reduce((grouped, { category, amount }) => {
      grouped[category] = (grouped[category] || 0) + amount;
      return grouped;
    }, {});
}

const CHART_COLORS = [
  '#e74c3c', '#2980b9', '#27ae60', '#f39c12',
  '#8e44ad', '#16a085', '#d35400', '#2c3e50'
];

function renderCategoryChart() {
  const grouped = calculateCategoryExpenses();
  const labels = Object.keys(grouped);
  const data = Object.values(grouped);

  const emptyMsg = chartContainerEl.querySelector('.empty-message');

  if (labels.length === 0) {
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    if (!emptyMsg) {
      chartContainerEl.innerHTML = '<p class="empty-message">No expense data yet.</p>';
    }
    return;
  }

  if (emptyMsg) {
    chartContainerEl.innerHTML = '<canvas id="category-chart"></canvas>';
  }

  const canvas = chartContainerEl.querySelector('canvas');
  const ctx = canvas.getContext('2d');

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.data.datasets[0].backgroundColor = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    categoryChart.update();
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderWidth: 1,
          borderColor: '#fff'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            font: { size: 13 }
          }
        },
        tooltip: {
          callbacks: {
            label: (tooltipItem) => {
              const value = tooltipItem.parsed;
              return ` ${tooltipItem.label}: ${formatCurrency(value)}`;
            }
          }
        }
      },
      layout: {
        padding: 8
      }
    }
  });
}

function renderAll() {
  populateFilterCategories();
  renderSummary();
  renderTransactions();
  renderMonthlySummary();
  renderCategoryChart();
}

// Form operations
function validateForm() {
  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;

  if (!description) {
    return 'Please enter a description.';
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    return 'Please enter a valid amount greater than 0.';
  }
  if (Math.round(amount * 100) !== amount * 100) {
    return 'Amount cannot have more than 2 decimal places.';
  }
  if (!date) {
    return 'Please select a date.';
  }
  return null;
}

function resetForm() {
  form.reset();
  editingId = null;
  submitBtn.textContent = 'Add Transaction';
  submitBtn.classList.remove('editing');
  formError.textContent = '';
}

function addTransaction(event) {
  event.preventDefault();

  const error = validateForm();
  formError.textContent = error || '';
  if (error) return;

  const transaction = {
    id: editingId || Date.now().toString(),
    type: typeSelect.value,
    description: descriptionInput.value.trim(),
    category: categorySelect.value,
    amount: parseFloat(amountInput.value),
    date: dateInput.value
  };

  if (editingId) {
    const index = transactions.findIndex(t => t.id === editingId);
    if (index !== -1) {
      transactions[index] = transaction;
    }
  } else {
    transactions.push(transaction);
  }

  saveTransactions();
  resetForm();
  renderAll();
}

function startEdit(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  editingId = id;
  typeSelect.value = transaction.type;
  populateCategories(transaction.type);
  descriptionInput.value = transaction.description;
  categorySelect.value = transaction.category;
  amountInput.value = transaction.amount;
  dateInput.value = transaction.date;
  formError.textContent = '';
  submitBtn.textContent = 'Update Transaction';
  submitBtn.classList.add('editing');
  typeSelect.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this transaction?')) return;

  if (editingId === id) {
    resetForm();
  }

  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

// Event listeners
typeSelect.addEventListener('change', () => populateCategories(typeSelect.value));
filterType.addEventListener('change', renderTransactions);
filterCategory.addEventListener('change', renderTransactions);
form.addEventListener('submit', addTransaction);
monthSelector.addEventListener('change', () => {
  selectedMonth = monthSelector.value || null;
  renderMonthlySummary();
  renderCategoryChart();
});

// Initialization
function init() {
  populateCategories('expense');
  const today = new Date().toISOString().split('T')[0];
  dateInput.max = today;
  dateInput.value = today;
  renderAll();
}

init();
