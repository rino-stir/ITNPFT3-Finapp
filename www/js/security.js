/* =============================================================
   UOS FinApp — security.js
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