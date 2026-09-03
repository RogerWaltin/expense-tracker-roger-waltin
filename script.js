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

// State
let transactions = loadTransactions();
let editingId = null;
let categoryChart = null;

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
function formatCurrency(amount) {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
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

    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.innerHTML = `
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
function calculateMonthlyExpenses() {
  return transactions
    .filter(({ type }) => type === 'expense')
    .reduce((grouped, { amount, date }) => {
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      grouped[key] = grouped[key] || { label, total: 0 };
      grouped[key].total += amount;
      return grouped;
    }, {});
}

function renderMonthlySummary() {
  const grouped = calculateMonthlyExpenses();
  const months = Object.keys(grouped).sort().reverse();

  if (months.length === 0) {
    monthlySummaryEl.innerHTML = '<p class="empty-message">No expense data yet.</p>';
    return;
  }

  monthlySummaryEl.innerHTML = months
    .map(key => {
      const { label, total } = grouped[key];
      return `
        <div class="monthly-item">
          <span class="monthly-label">${label}</span>
          <span class="monthly-amount">${formatCurrency(total)}</span>
        </div>
      `;
    })
    .join('');
}

// Category-wise Expense Chart
function calculateCategoryExpenses() {
  return transactions
    .filter(({ type }) => type === 'expense')
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

// Initialization
function init() {
  populateCategories('expense');
  const today = new Date().toISOString().split('T')[0];
  dateInput.max = today;
  dateInput.value = today;
  renderAll();
}

init();
