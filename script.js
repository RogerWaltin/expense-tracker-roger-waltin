(function () {
  'use strict';

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

  let transactions = loadTransactions();
  let editingId = null;

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
      console.error('Failed to save transactions:', error);
      formError.textContent = 'Unable to save. Storage might be full.';
    }
  }

  function populateCategories(type) {
    const options = CATEGORIES[type];
    categorySelect.innerHTML = options
      .map(function (category) {
        return '<option value="' + category + '">' + category + '</option>';
      })
      .join('');
  }

  function populateFilterCategories() {
    const categories = new Set();
    transactions.forEach(function (t) {
      categories.add(t.category);
    });
    const options = ['<option value="all">All Categories</option>'];
    categories.forEach(function (category) {
      if (category) {
        options.push('<option value="' + category + '">' + category + '</option>');
      }
    });
    filterCategory.innerHTML = options.join('');
  }

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

  function getFilteredTransactions() {
    const typeFilter = filterType.value;
    const categoryFilter = filterCategory.value;
    return transactions
      .filter(function (t) {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        return true;
      })
      .sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
  }

  function renderTransactions() {
    const filtered = getFilteredTransactions();

    transactionsList.innerHTML = '';

    if (filtered.length === 0) {
      emptyMessage.textContent = 'No transactions found.';
      transactionsList.appendChild(emptyMessage);
      return;
    }

    filtered.forEach(function (transaction) {
      const item = document.createElement('div');
      item.className = 'transaction-item';

      const info = document.createElement('div');
      info.className = 'transaction-info';

      const desc = document.createElement('div');
      desc.className = 'transaction-description';
      desc.textContent = transaction.description;

      const meta = document.createElement('div');
      meta.className = 'transaction-meta';
      meta.textContent = transaction.category + ' \u00b7 ' + formatDate(transaction.date);

      info.appendChild(desc);
      info.appendChild(meta);

      const amount = document.createElement('span');
      amount.className = 'transaction-amount ' + transaction.type;
      const sign = transaction.type === 'income' ? '+' : '-';
      amount.textContent = sign + formatCurrency(transaction.amount);

      const actions = document.createElement('div');
      actions.className = 'transaction-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.title = 'Edit transaction';
      editBtn.textContent = '\u270e';
      editBtn.addEventListener('click', function () {
        startEdit(transaction.id);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Delete transaction';
      deleteBtn.textContent = '\u2715';
      deleteBtn.addEventListener('click', function () {
        deleteTransaction(transaction.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(info);
      item.appendChild(amount);
      item.appendChild(actions);

      transactionsList.appendChild(item);
    });
  }

  function renderSummary() {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(function (t) {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    });

    const balance = totalIncome - totalExpense;
    balanceEl.textContent = formatCurrency(balance);
    totalIncomeEl.textContent = '+' + formatCurrency(totalIncome);
    totalExpenseEl.textContent = '-' + formatCurrency(totalExpense);
  }

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
      const index = transactions.findIndex(function (t) {
        return t.id === editingId;
      });
      if (index !== -1) {
        transactions[index] = transaction;
      }
      editingId = null;
      submitBtn.textContent = 'Add Transaction';
      submitBtn.classList.remove('editing');
    } else {
      transactions.push(transaction);
    }

    saveTransactions();
    renderAll();
    form.reset();
    formError.textContent = '';
  }

  function startEdit(id) {
    const transaction = transactions.find(function (t) {
      return t.id === id;
    });
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
      cancelEdit();
    }
    transactions = transactions.filter(function (t) {
      return t.id !== id;
    });
    saveTransactions();
    renderAll();
  }

  function cancelEdit() {
    editingId = null;
    form.reset();
    submitBtn.textContent = 'Add Transaction';
    submitBtn.classList.remove('editing');
    formError.textContent = '';
  }

  function renderAll() {
    populateFilterCategories();
    renderSummary();
    renderTransactions();
  }

  typeSelect.addEventListener('change', function () {
    populateCategories(typeSelect.value);
  });

  filterType.addEventListener('change', renderTransactions);
  filterCategory.addEventListener('change', renderTransactions);

  form.addEventListener('submit', addTransaction);

  function init() {
    populateCategories('expense');
    dateInput.max = new Date().toISOString().split('T')[0];
    dateInput.value = dateInput.max;
    renderAll();
  }

  init();
})();
