'use strict';

import { APP_CONFIG } from './config.js';

const SESSION_STARTED_AT_KEY = APP_CONFIG.SESSION_TOKEN_KEY + '_started_at';
const MAX_SESSION_AGE_SECONDS = 1800;

/**
 * Stores token in session storage and tracks session start time.
 * @param {string} token DirectLogin token.
 * @returns {void}
 */
export function storeToken(token) {
    const safeToken = String(token || '').trim();
    if (safeToken.length === 0) {
        return;
    }

    sessionStorage.setItem(APP_CONFIG.SESSION_TOKEN_KEY, safeToken);
    sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(Date.now()));
}

/**
 * Gets current token from session storage.
 * @returns {string|null} Token or null.
 */
export function getToken() {
    return sessionStorage.getItem(APP_CONFIG.SESSION_TOKEN_KEY);
}

/**
 * Stores selected bank identifier.
 * @param {string} bankId Selected bank id.
 * @returns {void}
 */
export function storeBankId(bankId) {
    const safeValue = String(bankId || '').trim();
    if (safeValue.length > 0) {
        sessionStorage.setItem(APP_CONFIG.SESSION_BANK_KEY, safeValue);
    }
}

/**
 * Gets selected bank identifier.
 * @returns {string|null} Bank id or null.
 */
export function getBankId() {
    return sessionStorage.getItem(APP_CONFIG.SESSION_BANK_KEY);
}

/**
 * Stores selected account identifier.
 * @param {string} accountId Selected account id.
 * @returns {void}
 */
export function storeAccountId(accountId) {
    const safeValue = String(accountId || '').trim();
    if (safeValue.length > 0) {
        sessionStorage.setItem(APP_CONFIG.SESSION_ACCOUNT_KEY, safeValue);
    }
}

/**
 * Gets selected account identifier.
 * @returns {string|null} Account id or null.
 */
export function getAccountId() {
    return sessionStorage.getItem(APP_CONFIG.SESSION_ACCOUNT_KEY);
}

/**
 * Clears all session keys and emits a session-cleared event.
 * @returns {void}
 */
export function clearSession() {
    sessionStorage.removeItem(APP_CONFIG.SESSION_TOKEN_KEY);
    sessionStorage.removeItem(APP_CONFIG.SESSION_BANK_KEY);
    sessionStorage.removeItem(APP_CONFIG.SESSION_ACCOUNT_KEY);
    sessionStorage.removeItem(SESSION_STARTED_AT_KEY);

    document.dispatchEvent(new CustomEvent('session:cleared'));
}

/**
 * Calculates session age in seconds.
 * @returns {number} Session age in seconds.
 */
export function getSessionAge() {
    const startedAt = Number(sessionStorage.getItem(SESSION_STARTED_AT_KEY));
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
        return 0;
    }

    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * Checks whether current session token is present and not expired.
 * @returns {boolean} True when session is valid.
 */
export function isSessionValid() {
    const hasToken = Boolean(getToken());
    const ageSeconds = getSessionAge();
    return hasToken && ageSeconds < MAX_SESSION_AGE_SECONDS;
}

window.addEventListener('beforeunload', function () {
    clearSession();
});
