/* =============================================================
   UOS FinApp — ui.js
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
   Update header user chip after login
   @param {string} username
   ----------------------------------------------------------- */
function showUserChip(username) {
  const chip   = document.getElementById('user-chip');
  const name   = document.getElementById('user-name');
  const avatar = document.getElementById('user-avatar');
  const signout = document.getElementById('btn-signout');

  if (chip) chip.classList.remove('hidden');
  if (name) name.textContent = username;                          // XSS-safe
  if (avatar) avatar.textContent = (username[0] || 'U').toUpperCase(); // XSS-safe
  if (signout) signout.classList.remove('hidden');
}

/* -----------------------------------------------------------
   Hide user chip and sign-out button (called on logout)
   ----------------------------------------------------------- */
function hideUserChip() {
  const chip    = document.getElementById('user-chip');
  const signout = document.getElementById('btn-signout');
  if (chip)    chip.classList.add('hidden');
  if (signout) signout.classList.add('hidden');
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

      const balanceLabel = document.createElement('p');
      balanceLabel.className = 'card__balance-label';
      balanceLabel.textContent = 'Available balance';

      // Format balance safely
      const bal = acc.balance;
      const amount = bal
        ? `${escapeHtml(bal.currency)} ${Number(bal.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        : '—';

      const balance = document.createElement('p');
      balance.className = 'card__balance';
      balance.textContent = amount;  // textContent — safe

      const title = document.createElement('p');
      title.className = 'card__title';
      title.textContent = acc.label || acc.id;

      const meta = document.createElement('p');
      meta.className = 'card__meta';
      meta.textContent = `Account ID: ${acc.id}`;

      const action = document.createElement('div');
      action.className = 'card__action';
      action.innerHTML = 'View transactions <i data-lucide="arrow-right" aria-hidden="true"></i>';

      card.append(balanceLabel, balance, title, meta, action);

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

/* -----------------------------------------------------------
   Dark/light mode toggle
   Reads system preference as default; manual toggle overrides.
   ----------------------------------------------------------- */
(function initThemeToggle() {
  const html   = document.documentElement;
  const toggle = document.getElementById('theme-toggle');

  // Detect system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let current = prefersDark ? 'dark' : 'light';
  html.setAttribute('data-theme', current);

  function updateIcon() {
    if (!toggle) return;
    toggle.setAttribute('aria-label', `Switch to ${current === 'dark' ? 'light' : 'dark'} mode`);
    toggle.innerHTML = current === 'dark'
      ? '<i data-lucide="sun" aria-hidden="true"></i>'
      : '<i data-lucide="moon" aria-hidden="true"></i>';
    if (window.lucide) window.lucide.createIcons();
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      current = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', current);
      updateIcon();
    });
  }

  updateIcon();
})();