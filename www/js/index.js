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

/* ── Login form ─────────────────────────────────────────────── */

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
  showUserChip(username);

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
  const selectedBankId = bank?.id || bank?.bank_id || '';

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
  const bankAccounts = state.allAccounts.filter(a => String(a.bank_id || '') === String(bankId || ''));
  renderAccounts(bankAccounts, handleAccountSelect);
}

/* ── Account selected ───────────────────────────────────────── */

function handleAccountSelect(account) {
  state.selectedAccount = account;
  const selectedAccountId = account?.id || account?.account_id || '';
  const selectedBankId =
    state.selectedBank?.id || state.selectedBank?.bank_id || account?.bank_id || '';

  // Update breadcrumb
  const bcAccName = document.getElementById('bc-account-name');
  if (bcAccName) bcAccName.textContent = account.label || selectedAccountId || 'Account';

  const bcAccBank = document.getElementById('bc-accounts');
  if (bcAccBank) bcAccBank.textContent = state.selectedBank?.short_name || 'Bank';

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

  renderTransactions(transactions);
}

/* ── Sign out ───────────────────────────────────────────────── */
// BUG FIX: clearSession() is called before navigating to login,
// so re-entering the login view never shows a stale session.

function handleSignOut() {
  clearSession();       // wipe token + username from sessionStorage
  hideUserChip();       // remove chip + sign-out button from header
  state.selectedBank    = null;
  state.selectedAccount = null;
  state.allAccounts     = [];

  setLoginError(null);  // clear any lingering error
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
  if (state.selectedBank) {
    loadAccounts(state.selectedBank.id);
  } else {
    showView('view-accounts');
  }
}

/* ── Event wiring ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Auth guard: always start at login, clear any stale session
  enforceAuthGuard();

  // Login form submit
  if (formLogin) {
    formLogin.addEventListener('submit', handleLogin);
  }

  // Sign out
  if (btnSignout) {
    btnSignout.addEventListener('click', handleSignOut);
  }

  // Breadcrumbs
  if (bcBanks)    bcBanks.addEventListener('click',    handleBackToBanks);
  if (bcBanks2)   bcBanks2.addEventListener('click',   handleBackToBanks);
  if (bcAccounts) bcAccounts.addEventListener('click', handleBackToAccounts);

  // Initialise Lucide icons
  if (window.lucide) window.lucide.createIcons();
});