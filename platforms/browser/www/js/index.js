import { directLogin, getAccounts, getTransactions, getUserBanks } from './obp-api.js';
import { APP_CONFIG, injectCSP, logger } from './config.js';
import {
    clearSession,
    getSessionAge,
    getToken,
    isSessionValid,
    storeAccountId,
    storeBankId,
    storeToken
} from './security.js';
import {
    normalizeErrorMessage,
    renderAccountsTable,
    renderBanksTable,
    renderTransactionsTable,
    setStatus,
    showView
} from './ui.js';

const state = {
    banks: [],
    accounts: [],
    transactions: [],
    selectedBankId: '',
    selectedAccountId: ''
};

/**
 * Logs debug details in development mode only.
 * @param {string} message Log message.
 * @param {unknown} [payload] Optional structured payload.
 * @returns {void}
 */
function logDebug(message, payload) {
    if (APP_CONFIG.LOG_ENABLED) {
        logger.log(message, payload || '');
    }
}

/**
 * Initializes app event listeners and startup behavior.
 * @returns {void}
 */
function init() {
    document.querySelector('#form-login').addEventListener('submit', onLoginSubmit);
    document.querySelector('#btn-logout').addEventListener('click', onLogout);
    document.querySelector('#btn-to-about').addEventListener('click', function () {
        showView('view-about');
    });
    document.querySelector('#btn-about-back').addEventListener('click', function () {
        showView('view-security');
    });
    document.querySelector('#btn-to-login').addEventListener('click', function () {
        showView('view-login');
    });
    document.querySelector('#btn-to-banks').addEventListener('click', function () {
        showView('view-banks');
    });
    document.querySelector('#btn-to-accounts').addEventListener('click', function () {
        showView('view-accounts');
    });
    document.querySelector('#bank-search').addEventListener('input', onBankFilterChange);
    document.querySelector('#txn-search').addEventListener('input', applyTransactionFilters);
    document.querySelector('#txn-date-from').addEventListener('change', applyTransactionFilters);
    document.querySelector('#txn-date-to').addEventListener('change', applyTransactionFilters);

    populateAppMeta();
    updateSessionStatus();
    showView('view-login');
}

/**
 * Renders app metadata in footer and About view.
 * @returns {void}
 */
function populateAppMeta() {
    const footerInfo = document.querySelector('#app-footer-info');
    const aboutVersion = document.querySelector('#about-app-version');

    if (footerInfo) {
        footerInfo.textContent = 'App v' + APP_CONFIG.APP_VERSION;
    }

    if (aboutVersion) {
        aboutVersion.textContent = APP_CONFIG.APP_VERSION;
    }
}

/**
 * Handles login form submission and starts banks loading.
 * @param {SubmitEvent} event Form submit event.
 * @returns {Promise<void>} Async completion state.
 */
async function onLoginSubmit(event) {
    event.preventDefault();

    const username = String(document.querySelector('#input-username').value || '').trim();
    const password = String(document.querySelector('#input-password').value || '').trim();
    if (!username || !password) {
        setStatus('#login-status', 'Username and password are required.');
        return;
    }

    try {
        setStatus('#login-status', 'Signing in...');
        const response = await directLogin(username, password);
        storeToken(response.token || '');

        updateSessionStatus();
        setStatus('#login-status', 'Login successful. Loading banks...');
        await loadBanks();
        showView('view-banks');
    } catch (error) {
        setStatus('#login-status', normalizeErrorMessage(error));
    }
}

/**
 * Loads banks from OBP and renders interactive table.
 * @returns {Promise<void>} Async completion state.
 */
async function loadBanks() {
    const response = await getUserBanks();
    state.banks = response.banks || [];

    const container = document.querySelector('#banks-table-container');
    container.innerHTML = renderBanksTable(state.banks);
    setStatus('#banks-status', state.banks.length + ' banks loaded.');

    // Event delegation keeps handlers resilient across rerenders.
    container.querySelectorAll('button[data-bank-id]').forEach(function (button) {
        button.addEventListener('click', function () {
            const bankId = String(button.getAttribute('data-bank-id') || '');
            void onBankSelected(bankId);
        });
    });
}

/**
 * Handles bank selection and loads account data.
 * @param {string} bankId Selected bank identifier.
 * @returns {Promise<void>} Async completion state.
 */
async function onBankSelected(bankId) {
    state.selectedBankId = bankId;
    storeBankId(bankId);

    try {
        setStatus('#banks-status', 'Loading accounts...');
        const response = await getAccounts();
        const allAccounts = response.accounts || [];

        state.accounts = allAccounts.filter(function (account) {
            return account.bank_id === state.selectedBankId;
        });

        const container = document.querySelector('#accounts-table-container');
        container.innerHTML = renderAccountsTable(state.accounts);
        setStatus('#accounts-status', state.accounts.length + ' accounts loaded.');

        container.querySelectorAll('button[data-account-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                const accountId = String(button.getAttribute('data-account-id') || '');
                void onAccountSelected(accountId);
            });
        });

        showView('view-accounts');
    } catch (error) {
        setStatus('#banks-status', normalizeErrorMessage(error));
    }
}

/**
 * Handles account selection and loads transactions.
 * @param {string} accountId Selected account identifier.
 * @returns {Promise<void>} Async completion state.
 */
async function onAccountSelected(accountId) {
    state.selectedAccountId = accountId;
    storeAccountId(accountId);

    try {
        setStatus('#accounts-status', 'Loading transactions...');
        const response = await getTransactions(state.selectedBankId, state.selectedAccountId);
        state.transactions = response.transactions || [];
        renderTransactionRegion(state.transactions);
        setStatus('#transactions-status', state.transactions.length + ' transactions loaded.');
        showView('view-transactions');
    } catch (error) {
        setStatus('#accounts-status', normalizeErrorMessage(error));
    }
}

/**
 * Renders transactions table for current filtered records.
 * @param {Array<object>} transactions Transaction list to render.
 * @returns {void}
 */
function renderTransactionRegion(transactions) {
    document.querySelector('#transactions-list-container').innerHTML = renderTransactionsTable(transactions);
}

/**
 * Applies current search and date filters to in-memory transactions.
 * @returns {void}
 */
function applyTransactionFilters() {
    const searchValue = String(document.querySelector('#txn-search').value || '').toLowerCase();
    const fromValue = String(document.querySelector('#txn-date-from').value || '');
    const toValue = String(document.querySelector('#txn-date-to').value || '');

    const filtered = state.transactions.filter(function (transaction) {
        const details = transaction.details || {};
        const postedRaw = String(details.posted || '').slice(0, 10);
        const description = String(details.description || '').toLowerCase();
        const matchesText = description.includes(searchValue);
        const matchesFrom = !fromValue || postedRaw >= fromValue;
        const matchesTo = !toValue || postedRaw <= toValue;
        return matchesText && matchesFrom && matchesTo;
    });

    renderTransactionRegion(filtered);
    setStatus('#transactions-status', filtered.length + ' transactions match filters.');
}

/**
 * Filters banks list by search text.
 * @returns {void}
 */
function onBankFilterChange() {
    const query = String(document.querySelector('#bank-search').value || '').toLowerCase();
    const filtered = state.banks.filter(function (bank) {
        const id = String(bank.id || bank.bank_id || '').toLowerCase();
        const name = String(bank.full_name || '').toLowerCase();
        return id.includes(query) || name.includes(query);
    });

    const container = document.querySelector('#banks-table-container');
    container.innerHTML = renderBanksTable(filtered);
    setStatus('#banks-status', filtered.length + ' banks match filter.');

    container.querySelectorAll('button[data-bank-id]').forEach(function (button) {
        button.addEventListener('click', function () {
            const bankId = String(button.getAttribute('data-bank-id') || '');
            void onBankSelected(bankId);
        });
    });
}

/**
 * Clears session token and returns user to login view.
 * @returns {void}
 */
function onLogout() {
    clearSession();
    updateSessionStatus();
    setStatus('#sec-session-info', 'Session cleared.');
    showView('view-login');
}

/**
 * Updates global session text and production-safe security message.
 * @returns {void}
 */
function updateSessionStatus() {
    const hasSession = isSessionValid() && Boolean(getToken());
    const statusText = hasSession ? 'Session: active' : 'Session: none';
    document.querySelector('#global-session-status').textContent = statusText;

    if (APP_CONFIG.ENV === 'development') {
        const age = getSessionAge();
        setStatus('#sec-session-info', hasSession
            ? 'Development mode session is active. Age: ' + age + 's.'
            : 'Development mode session is not active.');
        return;
    }

    // Production mode never writes token value into DOM.
    setStatus('#sec-session-info', hasSession ? 'Session is active.' : 'Session is not active.');
}

document.addEventListener('deviceready', function () {
    logDebug('Cordova ready');
}, false);

document.addEventListener('session:cleared', function () {
    state.banks = [];
    state.accounts = [];
    state.transactions = [];
    state.selectedBankId = '';
    state.selectedAccountId = '';

    const banksContainer = document.querySelector('#banks-table-container');
    const accountsContainer = document.querySelector('#accounts-table-container');
    const transactionsContainer = document.querySelector('#transactions-list-container');

    if (banksContainer) {
        banksContainer.innerHTML = '';
    }

    if (accountsContainer) {
        accountsContainer.innerHTML = '';
    }

    if (transactionsContainer) {
        transactionsContainer.innerHTML = '';
    }
});

injectCSP();
document.addEventListener('DOMContentLoaded', init, { once: true });
