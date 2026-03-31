/* =============================================================
   FT3 FinApp — ui.js
   DOM utilities: show/hide views, render cards & tables,
   toast messages, theme toggle.
   OWASP 2024 M7 (Insufficient Binary Protections / XSS):
     - All dynamic content escaped via escapeHtml()
     - No innerHTML with unsanitised data anywhere
     - textContent used for all user-data insertion
   ============================================================= */

'use strict';

/* -----------------------------------------------------------
   Escape HTML special characters — prevents XSS injection
   OWASP M7: every piece of API data rendered via this function
   @param {*} value — any value to render safely
   @returns {string}
   ----------------------------------------------------------- */
function escapeHtml(value) {
  const str = String(value == null ? '' : value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* -----------------------------------------------------------
   View navigation — show one view, hide all others.
   Also updates breadcrumb context labels.
   @param {string} viewId — id of the view to activate
   ----------------------------------------------------------- */
function showView(viewId) {
  const views = document.querySelectorAll('.view');
  views.forEach(v => {
    v.classList.remove('is-active');
    v.classList.add('hidden');
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('is-active');
  }
}

/* -----------------------------------------------------------
   Loading overlay — show/hide with label text
   @param {boolean} visible
   @param {string}  [label]
   ----------------------------------------------------------- */
function setLoading(visible, label = 'Loading…') {
  const overlay = document.getElementById('loading-overlay');
  const lbl     = document.getElementById('loading-label');
  if (!overlay) return;
  if (visible) {
    overlay.classList.add('is-active');
    if (lbl) lbl.textContent = label;
  } else {
    overlay.classList.remove('is-active');
  }
}

/* -----------------------------------------------------------
   Show / clear the login error banner
   @param {string|null} message — null hides the banner
   ----------------------------------------------------------- */
function setLoginError(message) {
  const alert = document.getElementById('login-error');
  const msg   = document.getElementById('login-error-msg');
  if (!alert) return;

  if (message) {
    // Use textContent — never innerHTML — to prevent XSS
    if (msg) msg.textContent = message;
    alert.classList.add('is-visible');
  } else {
    alert.classList.remove('is-visible');
  }
}

/* -----------------------------------------------------------
   Populate user display in header menu + footer
   Called after successful login
   @param {Object} user — { display_name, email }
   ----------------------------------------------------------- */
function populateUserDisplay(user) {
  const name = user?.display_name || 'User';
  const email = user?.email || '—';
  const avatar = (name[0] || 'U').toUpperCase();

  // Header: user menu trigger button
  const smallAvatar = document.getElementById('user-avatar-small');
  const nameDisplay = document.getElementById('user-name-display');
  const trigger = document.getElementById('user-menu-trigger');

  if (smallAvatar) smallAvatar.textContent = avatar;
  if (nameDisplay) nameDisplay.textContent = name;
  if (trigger) trigger.classList.remove('hidden');

  // Menu panel: user profile card
  const largeAvatar = document.getElementById('user-avatar-large');
  const profileName = document.getElementById('user-profile-name');
  const profileEmail = document.getElementById('user-profile-email');

  if (largeAvatar) largeAvatar.textContent = avatar;
  if (profileName) profileName.textContent = name;
  if (profileEmail) profileEmail.textContent = email;

  // Footer: session info
  const sessionUser = document.getElementById('session-user');
  if (sessionUser) sessionUser.textContent = `Logged in as: ${name}`;
}

/* -----------------------------------------------------------
   Reset user display (clear on logout)
   ----------------------------------------------------------- */
function resetUserDisplay() {
  // Header: user menu trigger button
  const smallAvatar = document.getElementById('user-avatar-small');
  const nameDisplay = document.getElementById('user-name-display');
  const trigger = document.getElementById('user-menu-trigger');

  if (smallAvatar) smallAvatar.textContent = '';
  if (nameDisplay) nameDisplay.textContent = '';
  if (trigger) trigger.classList.add('hidden');

  // Menu panel: user profile card (reset to defaults)
  const largeAvatar = document.getElementById('user-avatar-large');
  const profileName = document.getElementById('user-profile-name');
  const profileEmail = document.getElementById('user-profile-email');

  if (largeAvatar) largeAvatar.textContent = 'U';
  if (profileName) profileName.textContent = 'User';
  if (profileEmail) profileEmail.textContent = '—';

  // Footer: session info
  const sessionUser = document.getElementById('session-user');
  if (sessionUser) sessionUser.textContent = 'Logged in as: —';
}

/* -----------------------------------------------------------
   Backward compatibility: legacy showUserChip/hideUserChip
   (kept for compatibility with any existing calls)
   ----------------------------------------------------------- */
function showUserChip(username) {
  populateUserDisplay({ display_name: username });
}

function hideUserChip() {
  resetUserDisplay();
}

/* -----------------------------------------------------------
   Render bank cards into #banks-list
   @param {Array} banks — OBP bank objects
   @param {Function} onSelect — callback(bank)
   ----------------------------------------------------------- */
function renderBanks(banks, onSelect) {
  const skeleton = document.getElementById('banks-skeleton');
  const list     = document.getElementById('banks-list');
  const empty    = document.getElementById('banks-empty');

  if (skeleton) skeleton.classList.add('hidden');

  if (!banks.length) {
    if (list)  list.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (list) {
    list.innerHTML = ''; // clear previous
    list.classList.remove('hidden');

    banks.forEach(bank => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Select ${escapeHtml(bank.short_name || bank.id)}`);

      // Build card content using textContent — no innerHTML with data
      const icon = document.createElement('div');
      icon.className = 'card__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<i data-lucide="landmark"></i>';

      const title = document.createElement('p');
      title.className = 'card__title';
      title.textContent = bank.short_name || bank.full_name || bank.id;

      const meta = document.createElement('p');
      meta.className = 'card__meta';
      meta.textContent = bank.id;

      const action = document.createElement('div');
      action.className = 'card__action';
      action.innerHTML = 'View accounts <i data-lucide="arrow-right" aria-hidden="true"></i>';

      card.append(icon, title, meta, action);

      // Click AND keyboard (Enter/Space) activation
      const activate = () => onSelect(bank);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });

      list.appendChild(card);
    });

    // Re-initialise Lucide icons for newly added content
    if (window.lucide) window.lucide.createIcons();
  }
}

/* -----------------------------------------------------------
   Render account cards into #accounts-list
   @param {Array}    accounts — OBP account objects
   @param {Function} onSelect — callback(account)
   ----------------------------------------------------------- */
function renderAccounts(accounts, onSelect) {
  const skeleton = document.getElementById('accounts-skeleton');
  const list     = document.getElementById('accounts-list');
  const empty    = document.getElementById('accounts-empty');

  if (skeleton) skeleton.classList.add('hidden');

  if (!accounts.length) {
    if (list)  list.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (list) {
    list.innerHTML = '';
    list.classList.remove('hidden');

    accounts.forEach(acc => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');

      const title = document.createElement('p');
      title.className = 'card__title';
      title.textContent = acc.account_type || acc.label || acc.id;

      const meta = document.createElement('p');
      meta.className = 'card__meta';
      meta.textContent = `Account ID: ${acc.id}`;

      const action = document.createElement('div');
      action.className = 'card__action';
      action.innerHTML = 'View transactions <i data-lucide="arrow-right" aria-hidden="true"></i>';

      card.append(title, meta, action);

      const activate = () => onSelect(acc);
      card.addEventListener('click', activate);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });

      list.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }
}

/* -----------------------------------------------------------
   Render transactions into #transactions-body table
   @param {Array} transactions — OBP transaction objects
   ----------------------------------------------------------- */
function renderTransactions(transactions) {
  const skeleton = document.getElementById('transactions-skeleton');
  const wrap     = document.getElementById('transactions-table-wrap');
  const tbody    = document.getElementById('transactions-body');
  const empty    = document.getElementById('transactions-empty');

  if (skeleton) skeleton.classList.add('hidden');

  if (!transactions.length) {
    if (wrap)  wrap.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  if (tbody && wrap) {
    wrap.classList.remove('hidden');
    tbody.innerHTML = '';

    transactions.forEach(tx => {
      const detail    = tx.details || {};
      const value     = detail.value || {};
      const amount    = parseFloat(value.amount || 0);
      const currency  = escapeHtml(value.currency || '');
      const isCredit  = amount >= 0;

      const row = document.createElement('tr');

      // Date cell
      const dateCell = document.createElement('td');
      dateCell.className = 'col-date';
      const rawDate = detail.completed || detail.posted || '';
      dateCell.textContent = rawDate
        ? new Date(rawDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      // Description cell
      const descCell = document.createElement('td');
      descCell.className = 'col-desc';
      descCell.title = detail.description || detail.type || tx.id || '';
      descCell.textContent = detail.description || detail.type || 'Transaction';

      // Type badge cell
      const typeCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${isCredit ? 'badge-success' : 'badge-neutral'}`;
      badge.textContent = isCredit ? 'Credit' : 'Debit';
      typeCell.appendChild(badge);

      // Amount cell — right-aligned, tabular nums
      const amountCell = document.createElement('td');
      amountCell.className = `col-amount ${isCredit ? 'amount-credit' : 'amount-debit'}`;
      amountCell.textContent = `${isCredit ? '+' : ''}${currency} ${Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

      row.append(dateCell, descCell, typeCell, amountCell);
      tbody.appendChild(row);
    });
  }
}

/* ── Transaction Filtering ────────────────────────────────── */

// Store all transactions for filtering
let allTransactions = [];

/**
 * Check if any filters are currently applied
 * Returns true if any filter is non-default
 */
function isAnyFilterApplied() {
  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  const minAmount = document.getElementById('filter-amount-min')?.value || '';
  const maxAmount = document.getElementById('filter-amount-max')?.value || '';
  const searchText = document.getElementById('filter-search')?.value || '';
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';

  return typeFilter !== 'all' || minAmount || maxAmount || searchText || dateFrom || dateTo;
}

/**
 * Update reset button visibility based on filter state
 */
function updateResetButtonVisibility() {
  const resetBtn = document.getElementById('filter-reset');
  if (!resetBtn) return;

  if (isAnyFilterApplied()) {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }
}

/**
 * Toggle advanced filters section
 * Show/hide the advanced filter panel with animation
 */
function toggleAdvancedFilters() {
  const advancedSection = document.getElementById('filter-advanced-section');
  const toggleBtn = document.getElementById('filter-toggle-advanced');

  if (!advancedSection) return;

  const isHidden = advancedSection.classList.contains('hidden');

  if (isHidden) {
    // Show advanced filters
    advancedSection.classList.remove('hidden');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  } else {
    // Hide advanced filters
    advancedSection.classList.add('hidden');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * Parse date string to Date object
 * Handles YYYY-MM-DD format from date inputs
 */
function parseFilterDate(dateString) {
  if (!dateString) return null;
  // Date input format: YYYY-MM-DD
  // Parse as UTC to avoid timezone issues
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
}

/**
 * Apply transaction filters and re-render
 * Filter criteria: type, amount range, date range, search text
 */
function applyTransactionFilters() {
  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  const minAmount =  parseFloat(document.getElementById('filter-amount-min')?.value || '0') || 0;
  const maxAmount =  parseFloat(document.getElementById('filter-amount-max')?.value || Infinity) || Infinity;
  const searchText = (document.getElementById('filter-search')?.value || '').toLowerCase();
  const dateFromStr = document.getElementById('filter-date-from')?.value || '';
  const dateToStr = document.getElementById('filter-date-to')?.value || '';

  // Parse date filters
  const dateFrom = dateFromStr ? parseFilterDate(dateFromStr) : null;
  const dateTo = dateToStr ? parseFilterDate(dateToStr) : null;

  // Filter transactions
  const filtered = allTransactions.filter(tx => {
    const detail    = tx.details || {};
    const value     = detail.value || {};
    const amount    = parseFloat(value.amount || 0);
    const isCredit  = amount >= 0;
    const dateStr   = tx.date || '';

    // Type filter
    if (typeFilter === 'CREDIT' && !isCredit) return false;
    if (typeFilter === 'DEBIT' && isCredit) return false;

    // Amount filter
    const absAmount = Math.abs(amount);
    if (absAmount < minAmount || absAmount > maxAmount) return false;

    // Search filter (description or type)
    const desc = (detail.description || '').toLowerCase();
    const txType = (detail.type || '').toLowerCase();
    if (searchText && !desc.includes(searchText) && !txType.includes(searchText)) return false;

    // Date range filter
    if (dateStr) {
      // Parse transaction date (format: "DD Mon YYYY" or similar)
      const txDate = new Date(dateStr);
      if (dateFrom && txDate < dateFrom) return false;
      if (dateTo) {
        // Set dateTo to end of day for inclusive range
        const dateToEnd = new Date(dateTo);
        dateToEnd.setDate(dateToEnd.getDate() + 1);
        if (txDate >= dateToEnd) return false;
      }
    }

    return true;
  });

  // Re-render with filtered results
  renderTransactions(filtered);

  // Update reset button visibility
  updateResetButtonVisibility();
}

/**
 * Reset all transaction filters to defaults
 */
function resetTransactionFilters() {
  const typeFilter = document.getElementById('filter-type');
  const minAmount = document.getElementById('filter-amount-min');
  const maxAmount = document.getElementById('filter-amount-max');
  const searchText = document.getElementById('filter-search');
  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');

  if (typeFilter) typeFilter.value = 'all';
  if (minAmount) minAmount.value = '';
  if (maxAmount) maxAmount.value = '';
  if (searchText) searchText.value = '';
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';

  // Re-render with all transactions
  renderTransactions(allTransactions);

  // Hide reset button (no filters applied anymore)
  updateResetButtonVisibility();
}

/**
 * Setup transaction filter event listeners
 */
function setupTransactionFilters() {
  const typeFilter = document.getElementById('filter-type');
  const minAmount = document.getElementById('filter-amount-min');
  const maxAmount = document.getElementById('filter-amount-max');
  const searchText = document.getElementById('filter-search');
  const dateFrom = document.getElementById('filter-date-from');
  const dateTo = document.getElementById('filter-date-to');
  const resetBtn = document.getElementById('filter-reset');
  const toggleBtn = document.getElementById('filter-toggle-advanced');

  // Apply filters on input change
  [typeFilter, minAmount, maxAmount, searchText, dateFrom, dateTo].forEach(el => {
    if (el) {
      el.addEventListener('change', applyTransactionFilters);
      el.addEventListener('input', applyTransactionFilters);
    }
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', resetTransactionFilters);
  }

  // Toggle advanced filters
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAdvancedFilters);
  }

  // Initialize reset button visibility
  updateResetButtonVisibility();
}

/* -----------------------------------------------------------
   Dark/light mode toggle
   Reads system preference as default; manual toggle overrides.
   ----------------------------------------------------------- */
(function initThemeToggle() {
  const html   = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const THEME_KEY = 'ui_theme';

  // Detect saved preference, otherwise fall back to system preference.
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    saved = null;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let current = saved === 'dark' || saved === 'light'
    ? saved
    : (prefersDark ? 'dark' : 'light');
  html.setAttribute('data-theme', current);

  function updateIcon() {
    if (!toggle) return;
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    const iconName = current === 'dark' ? 'sun' : 'moon';

    toggle.setAttribute('aria-label', `Switch to ${current === 'dark' ? 'light' : 'dark'} mode`);
    toggle.setAttribute('title', `Switch to ${nextTheme} mode`);
    toggle.innerHTML = `<i data-lucide="${iconName}" aria-hidden="true"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      current = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', current);
      try {
        localStorage.setItem(THEME_KEY, current);
      } catch {
        // localStorage can fail in some private browsing contexts.
      }
      updateIcon();
    });
  }

  updateIcon();
})();