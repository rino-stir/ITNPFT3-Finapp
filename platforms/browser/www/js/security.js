/* =============================================================
   FT3 FinApp — security.js
   Session lifecycle: store, retrieve, clear token.
   OWASP 2024 M1 (Improper Credential Usage):
     - Token in sessionStorage only (auto-wiped on tab close)
     - Never logged, never exposed in DOM attributes
     - clearSession() called on logout AND back-to-login nav
   OWASP 2024 M2 (Inadequate Supply Chain):
     - No third-party auth libraries; all logic is first-party
   ============================================================= */

'use strict';

const SESSION_KEY = 'obp_token';   // sessionStorage key
const USER_KEY    = 'obp_user';    // sessionStorage key for display name

/* -----------------------------------------------------------
   Store token after successful DirectLogin
   @param {string} token  — OBP DirectLogin token
   @param {string} user   — username for display
   ----------------------------------------------------------- */
function storeSession(token, user) {
  if (!token || typeof token !== 'string') {
    console.warn('[Security] storeSession: invalid token rejected');
    return;
  }
  try {
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, user || 'User');
  } catch (err) {
    // sessionStorage unavailable in some private browsing contexts
    console.warn('[Security] sessionStorage unavailable:', err.message);
  }
}

/* -----------------------------------------------------------
   Retrieve token from sessionStorage
   @returns {string|null}
   ----------------------------------------------------------- */
function getToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/* -----------------------------------------------------------
   Retrieve stored display username
   @returns {string}
   ----------------------------------------------------------- */
function getStoredUser() {
  try {
    return sessionStorage.getItem(USER_KEY) || 'User';
  } catch {
    return 'User';
  }
}

/* -----------------------------------------------------------
   Check if a session is currently active
   @returns {boolean}
   ----------------------------------------------------------- */
function isAuthenticated() {
  return Boolean(getToken());
}

/* -----------------------------------------------------------
   Clear session — called on sign-out AND back-to-login nav.
   Wipes token AND username from sessionStorage.
   OWASP M1: ensures credentials not recoverable after logout.
   ----------------------------------------------------------- */
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (err) {
    console.warn('[Security] clearSession error:', err.message);
  }
}

/* -----------------------------------------------------------
   Auto-clear session when tab/window closes.
   Defence-in-depth: sessionStorage already scoped to the tab,
   but this catches edge cases (e.g. bfcache rehydration).
   ----------------------------------------------------------- */
window.addEventListener('beforeunload', clearSession);

/* ── Bank Preference Persistence (localStorage) ───────────────── */
/* Non-sensitive bank selection is stored in localStorage so the app
   can skip the bank selection step on repeated visits. This is 
   separate from token storage (which stays sessionStorage only). */

const BANK_PREF_PREFIX = 'obp_last_bank_';

/* -----------------------------------------------------------
   Store last selected bank to localStorage
   @param {string} bankId — normalized bank id
   @param {Object} bankData — bank object with id, short_name, etc
   @param {string} username — for user-scoped preference isolation
   ----------------------------------------------------------- */
function storeRememberedBank(bankId, bankData, username) {
  if (!bankId || !username) return;
  try {
    const key = BANK_PREF_PREFIX + username;
    const payload = {
      id: bankId,
      shortName: bankData?.short_name || bankData?.short_name || bankId,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Security] storeRememberedBank error:', err.message);
  }
}

/* -----------------------------------------------------------
   Retrieve last selected bank from localStorage
   @param {string} username — for user-scoped preference retrieval
   @returns {Object|null} — { id, shortName, timestamp } or null
   ----------------------------------------------------------- */
function getRememberedBank(username) {
  if (!username) return null;
  try {
    const key = BANK_PREF_PREFIX + username;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.id && typeof parsed.id === 'string') {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[Security] getRememberedBank error:', err.message);
    return null;
  }
}

/* -----------------------------------------------------------
   Validate remembered bank against current accessible banks
   @param {string} bankId — remembered bank id to validate
   @param {Array} availableBanks — current list of accessible banks
   @returns {Object|null} — full bank object if valid, null if stale
   ----------------------------------------------------------- */
function validateRememberedBank(bankId, availableBanks) {
  if (!bankId || !Array.isArray(availableBanks) || availableBanks.length === 0) {
    return null;
  }
  const found = availableBanks.find(bank => {
    const normalizedBankId = bank.id || bank.bank_id;
    return String(normalizedBankId) === String(bankId);
  });
  return found || null;
}

/* -----------------------------------------------------------
   Clear remembered bank preference (e.g. on explicit account removal)
   @param {string} username — for user-scoped preference removal
   ----------------------------------------------------------- */
function clearRememberedBank(username) {
  if (!username) return;
  try {
    const key = BANK_PREF_PREFIX + username;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[Security] clearRememberedBank error:', err.message);
  }
}