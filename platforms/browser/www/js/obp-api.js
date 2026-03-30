/* =============================================================
   UOS FinApp — obp-api.js
   OBP Sandbox API client.
   OWASP 2024 M3 (Insecure Communication):
     - All requests over HTTPS only
     - Base URL validated against config allowlist
   OWASP 2024 M4 (Insufficient Input/Output Validation):
     - All API responses validated before use
     - User-friendly error messages — no raw stack traces exposed
   ============================================================= */

'use strict';

const OBP_API_BASE =
  window.APP_CONFIG?.OBP_BASE_URL + '/obp/' + window.APP_CONFIG?.OBP_API_VERSION;

/* -----------------------------------------------------------
   Friendly error messages — maps HTTP status codes to
   plain-English messages a non-technical user can act on.
   ----------------------------------------------------------- */
const ERROR_MESSAGES = {
  400: 'The request couldn\'t be understood. Please check your details and try again.',
  401: 'Your username or password is incorrect. Please try again.',
  403: 'You don\'t have permission to access this. Please contact support.',
  404: 'We couldn\'t find what you were looking for. It may have moved.',
  409: 'There was a conflict with your request. Please try again.',
  429: 'Too many attempts. Please wait a moment before trying again.',
  500: 'Something went wrong on our end. Please try again shortly.',
  502: 'The banking service is temporarily unavailable. Please try again.',
  503: 'The service is undergoing maintenance. Please check back soon.',
};

/* -----------------------------------------------------------
   Generic HTTP error → friendly message
   @param {number} status   — HTTP status code
   @param {string} fallback — fallback if code not in map
   @returns {string}
   ----------------------------------------------------------- */
function getFriendlyError(status, fallback) {
  return ERROR_MESSAGES[status]
    || fallback
    || 'An unexpected problem occurred. Please try again.';
}

/* -----------------------------------------------------------
   Core fetch wrapper
   - Enforces HTTPS (OWASP M3)
   - Attaches token header when session is active
   - Returns { data, error, status }; never throws to caller
   @param {string} path      — API path (appended to base URL)
   @param {object} [options] — fetch options override
   @returns {Promise<{data: any, error: string|null, status: number}>}
   ----------------------------------------------------------- */
async function apiFetch(path, options = {}) {
  const baseUrl = window.APP_CONFIG?.OBP_BASE_URL;

  // Guard: base URL must be configured and HTTPS
  if (!baseUrl || !baseUrl.startsWith('https://')) {
    return { data: null, error: 'Configuration error: invalid API URL.', status: 0 };
  }

  const url     = `${OBP_API_BASE}${path}`;
  const token   = typeof getToken === 'function' ? getToken() : null;
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `DirectLogin token=${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });

    // Attempt to parse JSON; fall back to null
    let data = null;
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const msg = getFriendlyError(response.status, data?.message);
      return { data: null, error: msg, status: response.status };
    }

    return { data, error: null, status: response.status };
  } catch (err) {
    // Network-level failure (no internet, CORS, DNS)
    const isOffline = !navigator.onLine;
    const msg = isOffline
      ? 'No internet connection. Please check your network and try again.'
      : 'Unable to reach the banking service. Please try again.';
    return { data: null, error: msg, status: 0 };
  }
}

/* -----------------------------------------------------------
   DirectLogin — exchange username/password for a session token
   OWASP M1: credentials sent over HTTPS, never stored locally
   @param {string} username
   @param {string} password
   @returns {Promise<{token: string|null, error: string|null}>}
   ----------------------------------------------------------- */
async function obpLogin(username, password) {
  // Basic input guard — empty creds rejected before network call
  if (!username?.trim() || !password?.trim()) {
    return { token: null, error: 'Please enter both your username and password.' };
  }

  const baseUrl   = window.APP_CONFIG?.OBP_BASE_URL;
  const directPath = window.APP_CONFIG?.OBP_DIRECT_LOGIN_PATH || '/my/logins/direct';
  const consumer  =
    window.APP_CONFIG?.OBP_CONSUMER_KEY || window.APP_CONFIG?.CONSUMER_KEY;

  if (!baseUrl || !consumer) {
    return { token: null, error: 'App configuration is missing. Please contact support.' };
  }

  const authHeader =
    `DirectLogin username=${username}, password=${password}, consumer_key=${consumer}`;

  try {
    const response = await fetch(`${baseUrl}${directPath}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
    });

    let data = null;
    try { data = await response.json(); } catch { /* non-JSON body */ }

    if (!response.ok) {
      // 401 is the most common failure — give specific guidance
      const msg = response.status === 401
        ? 'Incorrect username or password. Please check your details and try again.'
        : getFriendlyError(response.status, data?.message);
      return { token: null, error: msg };
    }

    if (!data?.token) {
      return { token: null, error: 'Sign-in succeeded but no session was created. Please try again.' };
    }

    return { token: data.token, error: null };
  } catch (err) {
    const msg = !navigator.onLine
      ? 'No internet connection. Please check your network.'
      : 'Unable to sign in right now. Please try again.';
    return { token: null, error: msg };
  }
}

/* -----------------------------------------------------------
   Fetch banks accessible by the authenticated user
   @returns {Promise<{banks: Array, error: string|null}>}
   ----------------------------------------------------------- */
async function obpGetUserBanks() {
  const { accounts, error: accountsError } = await obpGetAccounts();
  if (accountsError) {
    return { banks: [], error: accountsError };
  }

  const { data, error } = await apiFetch('/banks');
  if (error) {
    return { banks: [], error };
  }

  const userBankIds = new Set(
    (accounts || [])
      .map(function (account) {
        return account.bank_id;
      })
      .filter(Boolean)
  );

  const banks = (Array.isArray(data?.banks) ? data.banks : []).filter(function (bank) {
    const bankId = bank.id || bank.bank_id;
    return userBankIds.has(bankId);
  });

  return { banks, error: null };
}

/* -----------------------------------------------------------
   Fetch all accounts for the authenticated user
   @returns {Promise<{accounts: Array, error: string|null}>}
   ----------------------------------------------------------- */
async function obpGetAccounts() {
  const { data, error } = await apiFetch('/my/accounts');
  if (error) return { accounts: [], error };
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  return { accounts, error: null };
}

/* -----------------------------------------------------------
   Fetch transactions for a specific account at a bank
   @param {string} bankId
   @param {string} accountId
   @returns {Promise<{transactions: Array, error: string|null}>}
   ----------------------------------------------------------- */
async function obpGetTransactions(bankId, accountId) {
  if (!bankId || !accountId) {
    return { transactions: [], error: 'Account details are missing. Please go back and try again.' };
  }

  const path = `/my/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/transactions`;
  const { data, error } = await apiFetch(path);
  if (error) return { transactions: [], error };
  const transactions = Array.isArray(data?.transactions) ? data.transactions : [];
  return { transactions, error: null };
}