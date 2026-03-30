'use strict';

import { getToken } from './security.js';
import { APP_CONFIG } from './config.js';

const OBP_API_BASE = APP_CONFIG.OBP_BASE_URL + '/obp/' + APP_CONFIG.OBP_API_VERSION;

const ERROR_MESSAGES = Object.freeze({
    400: 'The request was invalid. Please review your input and try again.',
    401: 'Your session is no longer valid. Please sign in again.',
    403: 'You do not have permission to access this resource.',
    404: 'The requested resource could not be found.',
    429: 'Too many requests were sent. Please wait and try again.',
    500: 'The banking service is temporarily unavailable. Please try again shortly.',
    502: 'The banking gateway is unavailable right now. Please try again shortly.',
    503: 'The banking service is undergoing maintenance. Please try again later.'
});

/**
 * Executes an OBP request and returns a non-throwing result.
 * @param {string} url Endpoint URL.
 * @param {RequestInit} options Request options.
 * @returns {Promise<{data: any, error: string|null, status: number}>} Result envelope.
 */
async function requestJson(url, options) {
    if (!navigator.onLine) {
        return {
            data: null,
            error: 'You appear to be offline. Please check your internet connection and try again.',
            status: 0
        };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(function () {
        controller.abort();
    }, 15000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        const text = await response.text();
        const parsed = tryParseJson(text);

        if (!response.ok) {
            return {
                data: null,
                error: mapHttpError(response.status, parsed, text),
                status: response.status
            };
        }

        return {
            data: parsed || {},
            error: null,
            status: response.status
        };
    } catch (error) {
        const wasAborted = error && typeof error === 'object' && error.name === 'AbortError';
        return {
            data: null,
            error: wasAborted
                ? 'The request took too long. Please try again.'
                : 'We could not reach the banking service. Please try again.',
            status: 0
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Builds DirectLogin token auth header value.
 * @returns {{authorization: string|null, error: string|null}} Header envelope.
 */
function buildTokenAuthorization() {
    const token = getToken();

    if (!token) {
        return {
            authorization: null,
            error: 'Your session is no longer valid. Please sign in again.'
        };
    }

    return {
        authorization: 'DirectLogin token=' + token,
        error: null
    };
}

/**
 * Authenticates user against OBP Direct Login endpoint.
 * @param {string} username OBP provider username.
 * @param {string} password OBP password.
 * @returns {Promise<{token: string|null, error: string|null}>} Login envelope.
 */
export async function directLogin(username, password) {
    const consumerKey = APP_CONFIG.OBP_CONSUMER_KEY;

    if (!consumerKey) {
        return {
            token: null,
            error: 'App configuration is missing the OBP consumer key.'
        };
    }

    const result = await requestJson(APP_CONFIG.OBP_BASE_URL + APP_CONFIG.OBP_DIRECT_LOGIN_PATH, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            Authorization: 'DirectLogin username=' + username + ', password=' + password + ', consumer_key=' + consumerKey
        }
    });

    if (result.error) {
        return {
            token: null,
            error: result.status === 401
                ? 'Incorrect username or password. Please check your details and try again.'
                : result.error
        };
    }

    return {
        token: String((result.data && result.data.token) || ''),
        error: null
    };
}

/**
 * Retrieves banks from OBP sandbox using the active session token.
 * @returns {Promise<{banks: Array<object>, error: string|null}>} Banks envelope.
 */
export async function getBanks() {
    const auth = buildTokenAuthorization();
    if (auth.error || !auth.authorization) {
        return { banks: [], error: auth.error };
    }

    const result = await requestJson(OBP_API_BASE + '/banks', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: auth.authorization
        }
    });

    return {
        banks: Array.isArray(result.data && result.data.banks) ? result.data.banks : [],
        error: result.error
    };
}

/**
 * Retrieves authenticated account list for active session.
 * @returns {Promise<{accounts: Array<object>, error: string|null}>} Accounts envelope.
 */
export async function getAccounts() {
    const auth = buildTokenAuthorization();
    if (auth.error || !auth.authorization) {
        return { accounts: [], error: auth.error };
    }

    const result = await requestJson(OBP_API_BASE + '/my/accounts', {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: auth.authorization
        }
    });

    return {
        accounts: Array.isArray(result.data && result.data.accounts) ? result.data.accounts : [],
        error: result.error
    };
}

/**
 * Retrieves only banks associated with the signed-in user's accounts.
 * @returns {Promise<{banks: Array<object>, error: string|null}>} User banks envelope.
 */
export async function getUserBanks() {
    const accountsResponse = await getAccounts();
    if (accountsResponse.error) {
        return {
            banks: [],
            error: accountsResponse.error
        };
    }

    const banksResponse = await getBanks();
    if (banksResponse.error) {
        return {
            banks: [],
            error: banksResponse.error
        };
    }

    const userBankIds = new Set(
        accountsResponse.accounts
            .map(function (account) {
                return account.bank_id;
            })
            .filter(Boolean)
    );

    const userBanks = banksResponse.banks.filter(function (bank) {
        const bankId = bank.id || bank.bank_id;
        return userBankIds.has(bankId);
    });

    return {
        banks: userBanks,
        error: null
    };
}

/**
 * Retrieves transactions for selected bank and account.
 * @param {string} bankId Selected bank ID.
 * @param {string} accountId Selected account ID.
 * @returns {Promise<{transactions: Array<object>, error: string|null}>} Transactions envelope.
 */
export async function getTransactions(bankId, accountId) {
    const auth = buildTokenAuthorization();
    if (auth.error || !auth.authorization) {
        return { transactions: [], error: auth.error };
    }

    const result = await requestJson(
        OBP_API_BASE + '/my/banks/' + encodeURIComponent(bankId) + '/accounts/' + encodeURIComponent(accountId) + '/transactions',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: auth.authorization
            }
        }
    );

    return {
        transactions: Array.isArray(result.data && result.data.transactions) ? result.data.transactions : [],
        error: result.error
    };
}

/**
 * Converts HTTP failures into plain-English messages.
 * @param {number} status HTTP status code.
 * @param {any} parsed Parsed response body when possible.
 * @param {string} rawBody Raw text body.
 * @returns {string} Friendly message.
 */
function mapHttpError(status, parsed, rawBody) {
    const defaultMessage = ERROR_MESSAGES[status] || 'The banking request could not be completed. Please try again.';

    if (parsed && typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
        return defaultMessage;
    }

    if (typeof rawBody === 'string' && rawBody.trim().length > 0) {
        return defaultMessage;
    }

    return defaultMessage;
}

/**
 * Tries to parse JSON text payload safely.
 * @param {string} payload Raw response text.
 * @returns {any|null} Parsed object or null.
 */
function tryParseJson(payload) {
    if (typeof payload !== 'string' || payload.trim().length === 0) {
        return null;
    }

    try {
        return JSON.parse(payload);
    } catch (error) {
        return null;
    }
}
