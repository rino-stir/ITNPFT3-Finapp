import { getToken } from './security.js';
import { APP_CONFIG } from './config.js';

const OBP_API_BASE = APP_CONFIG.OBP_BASE_URL + '/obp/' + APP_CONFIG.OBP_API_VERSION;

/**
 * Executes a fetch request with timeout and normalizes errors.
 * @param {string} url Endpoint URL.
 * @param {RequestInit} options Fetch options.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function requestJson(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, 15000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(errorBody || 'Request failed');
        }

        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Builds Direct Login token auth header value.
 * @returns {string} Authorization header value.
 */
function buildTokenAuthorization() {
    const token = getToken();

    if (!token) {
        throw new Error('Session is not valid. Please login again.');
    }

    return 'DirectLogin token=' + token;
}

/**
 * Authenticates user against OBP Direct Login endpoint.
 * @param {string} username OBP provider username.
 * @param {string} password OBP password.
 * @returns {Promise<{token: string}>} Token response payload.
 */
export function directLogin(username, password) {
    const consumerKey = APP_CONFIG.OBP_CONSUMER_KEY;

    if (!consumerKey) {
        throw new Error('Missing app consumer key');
    }

    return requestJson(APP_CONFIG.OBP_BASE_URL + APP_CONFIG.OBP_DIRECT_LOGIN_PATH, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            Authorization: 'DirectLogin username=' + username + ', password=' + password + ', consumer_key=' + consumerKey
        }
    });
}

/**
 * Retrieves banks from OBP sandbox using the active DirectLogin session token.
 * @returns {Promise<{banks: Array<object>}>} OBP banks list payload.
 */
export function getBanks() {
    return requestJson(OBP_API_BASE + '/banks', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: buildTokenAuthorization()
        }
    });
}

/**
 * Retrieves authenticated account list for active session.
 * @returns {Promise<{accounts: Array<object>}>} Accounts payload.
 */
export function getAccounts() {
    return requestJson(OBP_API_BASE + '/my/accounts', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: buildTokenAuthorization()
        }
    });
}

/**
 * Retrieves transactions for selected bank and account.
 * @param {string} bankId Selected bank ID.
 * @param {string} accountId Selected account ID.
 * @returns {Promise<{transactions: Array<object>}>} Transactions payload.
 */
export function getTransactions(bankId, accountId) {
    return requestJson(
    OBP_API_BASE + '/my/banks/' + encodeURIComponent(bankId) + '/accounts/' + encodeURIComponent(accountId) + '/owner/transactions',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: buildTokenAuthorization()
            }
        }
    );
}
