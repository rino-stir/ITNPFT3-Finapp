import { APP_CONFIG } from './config.js';

/**
 * @module security
 * @description Manages OBP authentication token lifecycle.
 * Stores token in sessionStorage (OWASP: never in localStorage, never in DOM).
 * Clears all session data on logout, error, or tab close.
 * OWASP A07:2021 Identification & Authentication Failures mitigated by:
 *   - Short token lifetime (sessionStorage = tab lifetime only)
 *   - Explicit clearSession() on logout
 *   - No token exposure in URL params or DOM attributes
 */

const SESSION_STARTED_AT_KEY = APP_CONFIG.SESSION_TOKEN_KEY + '_started_at';
const MAX_SESSION_AGE_SECONDS = 1800;

/**
 * Redirects user to login view in the current single-page flow.
 * @returns {void}
 */
function redirectToLoginView() {
    const loginView = document.getElementById('view-login');

    if (!loginView) {
        return;
    }

    document.querySelectorAll('.view').forEach(function (viewElement) {
        const isLogin = viewElement.id === 'view-login';
        viewElement.hidden = !isLogin;
        viewElement.classList.toggle('is-active', isLogin);
        viewElement.classList.toggle('active', isLogin);
    });
}

/**
 * Stores token securely in sessionStorage and tracks session start time.
 * SECURITY NOTE: token never logged, never appended to DOM.
 * @param {string} token OBP Direct Login token.
 * @returns {void}
 */
export function storeToken(token) {
    if (typeof token !== 'string' || token.trim().length === 0) {
        throw new TypeError('Token must be a non-empty string.');
    }

    sessionStorage.setItem(APP_CONFIG.SESSION_TOKEN_KEY, token.trim());
    sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(Date.now()));
}

/**
 * Reads token from sessionStorage. If token is absent, clears state and redirects to login.
 * @returns {string|null} Token value or null when missing.
 */
export function getToken() {
    const token = sessionStorage.getItem(APP_CONFIG.SESSION_TOKEN_KEY);

    if (!token) {
        clearSession();
        redirectToLoginView();
        return null;
    }

    return token;
}

/**
 * Stores selected bank identifier in sessionStorage.
 * @param {string} bankId Selected bank ID.
 * @returns {void}
 */
export function storeBankId(bankId) {
    if (typeof bankId === 'string' && bankId.length > 0) {
        sessionStorage.setItem(APP_CONFIG.SESSION_BANK_KEY, bankId);
    }
}

/**
 * Retrieves selected bank identifier from sessionStorage.
 * @returns {string|null} Bank ID or null.
 */
export function getBankId() {
    return sessionStorage.getItem(APP_CONFIG.SESSION_BANK_KEY);
}

/**
 * Stores selected account identifier in sessionStorage.
 * @param {string} accountId Selected account ID.
 * @returns {void}
 */
export function storeAccountId(accountId) {
    if (typeof accountId === 'string' && accountId.length > 0) {
        sessionStorage.setItem(APP_CONFIG.SESSION_ACCOUNT_KEY, accountId);
    }
}

/**
 * Retrieves selected account identifier from sessionStorage.
 * @returns {string|null} Account ID or null.
 */
export function getAccountId() {
    return sessionStorage.getItem(APP_CONFIG.SESSION_ACCOUNT_KEY);
}

/**
 * Clears all app session keys, wipes password field, and emits session-cleared event.
 * @returns {void}
 */
export function clearSession() {
    sessionStorage.removeItem(APP_CONFIG.SESSION_TOKEN_KEY);
    sessionStorage.removeItem(APP_CONFIG.SESSION_BANK_KEY);
    sessionStorage.removeItem(APP_CONFIG.SESSION_ACCOUNT_KEY);
    sessionStorage.removeItem(SESSION_STARTED_AT_KEY);

    const passwordInputBySpec = document.getElementById('password');
    if (passwordInputBySpec) {
        passwordInputBySpec.value = '';
    }

    const passwordInputCurrent = document.getElementById('input-password');
    if (passwordInputCurrent) {
        passwordInputCurrent.value = '';
    }

    document.dispatchEvent(new CustomEvent('session:cleared'));
}

/**
 * Returns elapsed session age in seconds since token was stored.
 * @returns {number} Elapsed seconds, or 0 when no session start timestamp exists.
 */
export function getSessionAge() {
    const startedAtRaw = sessionStorage.getItem(SESSION_STARTED_AT_KEY);

    if (!startedAtRaw) {
        return 0;
    }

    const startedAt = Number(startedAtRaw);

    if (!Number.isFinite(startedAt) || startedAt <= 0) {
        return 0;
    }

    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * Validates active session based on token presence and max age.
 * Returns false and triggers logout flow when invalid.
 * @returns {boolean} True when token exists and age is below 1800 seconds.
 */
export function isSessionValid() {
    const token = sessionStorage.getItem(APP_CONFIG.SESSION_TOKEN_KEY);
    const ageSeconds = getSessionAge();
    const isValid = Boolean(token) && ageSeconds < MAX_SESSION_AGE_SECONDS;

    if (!isValid) {
        clearSession();
        redirectToLoginView();
    }

    return isValid;
}

window.addEventListener('beforeunload', function () {
    clearSession();
});

// SECURITY NOTE (OWASP A02:2021 Cryptographic Failures):
// sessionStorage is not encrypted at rest. For a production banking app,
// use server-side sessions + HttpOnly cookies. sessionStorage is acceptable
// for this sandbox/demo context as no real financial data is accessed.
