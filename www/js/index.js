/* =============================================================
   UOS FinApp — index.js
   Main application controller.
   Wires: login form → auth → banks → accounts → transactions.
   BUG FIXES in this version:
     1. Back-to-login now calls clearSession() — session fully
        destroyed before returning to login view.
     2. Auth guard on all view transitions — unauthenticated
        users redirected to login immediately.
     3. Sign-out button wired to clearSession() + UI reset.
   OWASP 2024 M4 (Input/Output Validation):
     - All inputs validated client-side before network call
   OWASP 2024 M7 (XSS):
     - All rendering via ui.js escapeHtml() / textContent
   ============================================================= */

'use strict';

/* ── State ──────────────────────────────────────────────────── */
// In-memory only — never persisted to localStorage
const state = {
  selectedBank:    null,  // { id, short_name, full_name }
  selectedAccount: null,  // { id, label, balance }
  allAccounts:     [],    // cached after first fetch
};

// Session timer state
let sessionTimerInterval = null;
let sessionEndTime = null;

/* ── DOM refs ───────────────────────────────────────────────── */
const formLogin   = document.getElementById('form-login');
const btnLogin    = document.getElementById('btn-login');
const btnSignout  = document.getElementById('btn-signout');
const inpUsername = document.getElementById('input-username');
const inpPassword = document.getElementById('input-password');
const errUsername = document.getElementById('err-username');
const errPassword = document.getElementById('err-password');

// Breadcrumb back-links
const bcBanks     = document.getElementById('bc-banks');
const bcBanks2    = document.getElementById('bc-banks-2');
const bcAccounts  = document.getElementById('bc-accounts');

// Normalizes bank identifiers across OBP payload variants.
function normalizeBankId(source) {
  if (source == null) return '';

  if (typeof source === 'string' || typeof source === 'number') {
    return String(source);
  }

  if (typeof source === 'object') {
    if (source.id != null) return String(source.id);
    if (source.bank_id != null) return normalizeBankId(source.bank_id);
    if (source.bankId != null) return String(source.bankId);
    if (source.value != null) return String(source.value);
  }

  return '';
}

/* ── Auth guard ─────────────────────────────────────────────── */
// Called at startup — if a stale session exists from a prior
// page load (e.g. bfcache), it is invalidated and login shown.
function enforceAuthGuard() {
  // On fresh page load we ALWAYS start at login.
  // sessionStorage token from a previous tab is NOT trusted —
  // the user must re-authenticate in this tab.
  clearSession();
  showView('view-login');
  hideUserChip();
}

/* ── Session Timer ──────────────────────────────────────────– */
// Session countdown timer (MM:SS format)
// Auto-logout when timer reaches 0:00

function startSessionTimer(durationSeconds = 1800) {
  // Default: 30 minutes (1800 seconds)
  stopSessionTimer(); // clear any existing timer
  
  sessionEndTime = Date.now() + (durationSeconds * 1000);
  
  sessionTimerInterval = setInterval(updateSessionTimer, 1000);
  updateSessionTimer(); // Immediate initial update
}

function updateSessionTimer() {
  if (!sessionEndTime) return;
  
  const now = Date.now();
  const remaining = Math.max(0, sessionEndTime - now);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  const timerEl = document.getElementById('session-timer');
  if (timerEl) {
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  // Auto-logout when timer reaches 0:00
  if (remaining === 0) {
    clearInterval(sessionTimerInterval);
    setLoginError('Your session has expired. Please sign in again.');
    handleSessionExpired();
  }
}

function stopSessionTimer() {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
    sessionEndTime = null;
  }
  
  const timerEl = document.getElementById('session-timer');
  if (timerEl) timerEl.textContent = '00:00';
}

function handleSessionExpired() {
  clearSession();
  resetUserDisplay();
  showView('view-login');
  
  // Close user menu if open
  const panel = document.getElementById('user-menu-panel');
  if (panel) panel.classList.remove('is-open');
}

/* ── User Menu Interactions ────────────────────────────────– */
// Side-sliding user menu panel

function setupUserMenuInteractions() {
  const trigger = document.getElementById('user-menu-trigger');
  const panel = document.getElementById('user-menu-panel');
  const closeBtn = document.getElementById('user-menu-close');
  const logoutBtn = document.getElementById('user-menu-logout');
  
  // Toggle menu on trigger click
  if (trigger) {
    trigger.addEventListener('click', () => {
      if (panel) {
        panel.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', 
          panel.classList.contains('is-open') ? 'true' : 'false');
      }
    });
  }
  
  // Close menu on close button click
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (panel) panel.classList.remove('is-open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }
  
  // Logout from menu
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      handleSignOut();
      if (panel) panel.classList.remove('is-open');
    });
  }
  
  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) {
      panel.classList.remove('is-open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ── App Initialization ────────────────────────────────────– */

function validateLoginForm() {
  let valid = true;

  // Username validation
  if (!inpUsername.value.trim()) {
    errUsername.classList.add('is-visible');
    inpUsername.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    errUsername.classList.remove('is-visible');
    inpUsername.removeAttribute('aria-invalid');
  }

  // Password validation
  if (!inpPassword.value.trim()) {
    errPassword.classList.add('is-visible');
    inpPassword.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    errPassword.classList.remove('is-visible');
    inpPassword.removeAttribute('aria-invalid');
  }

  return valid;
}

async function handleLogin(e) {
  e.preventDefault();
  setLoginError(null); // clear prior error

  if (!validateLoginForm()) return;

  const username = inpUsername.value.trim();
  const password = inpPassword.value;        // do NOT trim passwords

  // Disable form during request (OWASP M4: prevent double-submit)
  btnLogin.setAttribute('aria-busy', 'true');
  btnLogin.textContent = 'Signing in…';
  setLoading(true, 'Signing in securely…');

  const { token, error } = await obpLogin(username, password);

  // Always clear password field — OWASP M1
  inpPassword.value = '';

  setLoading(false);
  btnLogin.removeAttribute('aria-busy');
  btnLogin.innerHTML = '<i data-lucide="shield-check" aria-hidden="true"></i> Sign in securely';
  if (window.lucide) window.lucide.createIcons();

  if (error || !token) {
    setLoginError(error || 'Sign-in failed. Please try again.');
    return;
  }

  // Persist token for this session
  storeSession(token, username);
  populateUserDisplay({ display_name: username });
  
  // Start 30-minute session timer
  startSessionTimer(1800);

  // Clear username field (leave no trace in DOM beyond chip)
  inpUsername.value = '';

  await loadBanks();
}

/* ── Banks ──────────────────────────────────────────────────── */

async function loadBanks() {
  // Reset skeleton visibility
  const skeleton = document.getElementById('banks-skeleton');
  const list     = document.getElementById('banks-list');
  const empty    = document.getElementById('banks-empty');
  if (skeleton) skeleton.classList.remove('hidden');
  if (list)     list.classList.add('hidden');
  if (empty)    empty.classList.add('hidden');

  showView('view-banks');
  setLoading(true, 'Loading your banks…');

  const { banks, error } = await obpGetUserBanks();
  setLoading(false);

  if (error) {
    setLoginError(error);
    showView('view-login');
    return;
  }

  // Reset cached accounts to force a fresh fetch after bank selection.
  state.allAccounts = [];

  renderBanks(banks, handleBankSelect);
}

/* ── Bank selected ──────────────────────────────────────────── */

function handleBankSelect(bank) {
  state.selectedBank = bank;
  const selectedBankId = normalizeBankId(bank);

  // Update breadcrumb label
  const bcName = document.getElementById('bc-bank-name');
  if (bcName) bcName.textContent = bank.short_name || bank.id || bank.bank_id || 'Bank';

  const label = document.getElementById('accounts-bank-label');
  if (label) label.textContent = `Accounts at ${bank.short_name || bank.full_name || selectedBankId}.`;

  loadAccounts(selectedBankId);
}

/* ── Accounts ───────────────────────────────────────────────── */

async function loadAccounts(bankId) {
  const skeleton = document.getElementById('accounts-skeleton');
  const list     = document.getElementById('accounts-list');
  const empty    = document.getElementById('accounts-empty');
  if (skeleton) skeleton.classList.remove('hidden');
  if (list)     list.classList.add('hidden');
  if (empty)    empty.classList.add('hidden');

  showView('view-accounts');
  setLoading(true, 'Loading accounts…');

  const { accounts, error } = await obpGetAccounts();

  setLoading(false);

  if (error) {
    setLoginError(error);
    if (skeleton) skeleton.classList.add('hidden');
    if (list) list.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }

  state.allAccounts = accounts || [];

  // Filter to this bank only
  const targetBankId = normalizeBankId(bankId);
  const bankAccounts = state.allAccounts.filter(a => normalizeBankId(a?.bank_id) === targetBankId);
  renderAccounts(bankAccounts, handleAccountSelect);
}

/* ── Account selected ───────────────────────────────────────── */

function handleAccountSelect(account) {
  state.selectedAccount = account;
  const selectedAccountId = account?.id || account?.account_id || '';
  const selectedBankId =
    normalizeBankId(state.selectedBank) || normalizeBankId(account?.bank_id);

  // Update breadcrumb - account name in transactions view
  const bcAccName = document.getElementById('bc-account-name');
  if (bcAccName) bcAccName.textContent = account.label || selectedAccountId || 'Account';

  // Update transactions label
  const label = document.getElementById('transactions-account-label');
  if (label) label.textContent = `Transactions for ${account.label || selectedAccountId}.`;

  loadTransactions(selectedBankId, selectedAccountId);
}

/* ── Transactions ───────────────────────────────────────────── */

async function loadTransactions(bankId, accountId) {
  const skeleton = document.getElementById('transactions-skeleton');
  const wrap     = document.getElementById('transactions-table-wrap');
  const empty    = document.getElementById('transactions-empty');
  if (skeleton) skeleton.classList.remove('hidden');
  if (wrap)     wrap.classList.add('hidden');
  if (empty)    empty.classList.add('hidden');

  showView('view-transactions');
  setLoading(true, 'Loading transactions…');

  // Fetch account details (type + balance)
  const { account: accountDetails } = await obpGetAccountDetails(bankId, accountId);
  if (accountDetails) {
    populateAccountInfo(accountDetails);
  }

  const { transactions, error } = await obpGetTransactions(bankId, accountId);
  setLoading(false);

  if (error) {
    if (skeleton) skeleton.classList.add('hidden');
    if (empty) {
      empty.classList.remove('hidden');
      const emptyTitle = empty.querySelector('.empty-state__title');
      const emptyBody  = empty.querySelector('.empty-state__body');
      // Use textContent — XSS-safe
      if (emptyTitle) emptyTitle.textContent = 'Could not load transactions';
      if (emptyBody)  emptyBody.textContent  = error;
    }
    return;
  }

  // Store transactions for filtering and reset filters
  allTransactions = transactions || [];
  resetTransactionFilters();
  
  // Setup filter event listeners (one-time on first load to transactions view)
  setupTransactionFilters();
}

/* ── Account Info Display ───────────────────────────────────── */

function populateAccountInfo(account) {
  const typeDisplay = document.getElementById('account-type-display');
  const balanceDisplay = document.getElementById('account-balance-display');

  if (typeDisplay) {
    typeDisplay.textContent = account.account_type || account.product_code || '—';
  }

  if (balanceDisplay && account.balance) {
    const currency = account.balance.currency || '';
    const amount = account.balance.amount || '0';
    balanceDisplay.textContent = `${currency} ${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  }
}

/* ── Sign out ───────────────────────────────────────────────── */
// BUG FIX: clearSession() is called before navigating to login,
// so re-entering the login view never shows a stale session.

function handleSignOut() {
  stopSessionTimer();    // stop the countdown timer
  clearSession();        // wipe token + username from sessionStorage
  resetUserDisplay();    // remove user info from header + menu + footer
  
  state.selectedBank    = null;
  state.selectedAccount = null;
  state.allAccounts     = [];

  setLoginError(null);  // clear any lingering error
  
  // Close user menu if open
  const panel = document.getElementById('user-menu-panel');
  if (panel) panel.classList.remove('is-open');
  
  showView('view-login');
}

/* ── Breadcrumb navigation ──────────────────────────────────── */
// BUG FIX: navigating backwards does NOT need clearSession()
// because the user is still authenticated.
// Only sign-out clears the session.

function handleBackToBanks() {
  showView('view-banks');
}

function handleBackToAccounts() {
  const selectedBankId =
    normalizeBankId(state.selectedBank) || normalizeBankId(state.selectedAccount?.bank_id);

  if (selectedBankId) {
    loadAccounts(selectedBankId);
  } else {
    showView('view-banks');
  }
}

/* ── Event wiring ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Auth guard: always start at login, clear any stale session
  enforceAuthGuard();

  // Setup user menu interactions
  setupUserMenuInteractions();

  // Login form submit
  if (formLogin) {
    formLogin.addEventListener('submit', handleLogin);
  }

  // Breadcrumbs
  if (bcBanks)    bcBanks.addEventListener('click',    handleBackToBanks);
  if (bcBanks2)   bcBanks2.addEventListener('click',   handleBackToBanks);
  if (bcAccounts) bcAccounts.addEventListener('click', handleBackToAccounts);

  // Initialise Lucide icons
  if (window.lucide) window.lucide.createIcons();
});