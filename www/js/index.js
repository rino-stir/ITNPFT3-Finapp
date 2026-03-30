'use strict';

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
    hideUserChip,
    normalizeErrorMessage,
    renderAccounts,
    renderBanks,
    renderTransactions,
    setLoginError,
    setSkeletonVisibility,
    setStatus,
    showUserChip,
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
 * Logs development diagnostics only when enabled.
 * @param {string} message Message text.
 * @param {unknown} [payload] Optional payload.
 * @returns {void}
 */
function logDebug(message, payload) {
    if (APP_CONFIG.LOG_ENABLED) {
        logger.log(message, payload || '');
    }
}

/**
 * Initializes app event handlers and static metadata.
 * @returns {void}
 */
function init() {
    const loginForm = document.querySelector('#form-login');
    const signOutButton = document.querySelector('#btn-signout');
    const toLoginButton = document.querySelector('#btn-to-login');
    const toBanksButton = document.querySelector('#btn-to-banks');
    const toAccountsButton = document.querySelector('#btn-to-accounts');
    const toAboutButton = document.querySelector('#btn-to-about');
    const aboutBackButton = document.querySelector('#btn-about-back');
    const bankSearch = document.querySelector('#bank-search');
    const transactionSearch = document.querySelector('#txn-search');
    const dateFrom = document.querySelector('#txn-date-from');
    const dateTo = document.querySelector('#txn-date-to');
    const themeButton = document.querySelector('#btn-theme-toggle');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signOutButton) {
        signOutButton.addEventListener('click', handleSignOut);
    }

    if (toLoginButton) {
        toLoginButton.addEventListener('click', function () {
            showView('view-login');
        });
    }

    if (toBanksButton) {
        toBanksButton.addEventListener('click', function () {
            showProtectedView('view-banks');
        });
    }

    if (toAccountsButton) {
        toAccountsButton.addEventListener('click', function () {
            showProtectedView('view-accounts');
        });
    }

    if (toAboutButton) {
        toAboutButton.addEventListener('click', function () {
            showProtectedView('view-about');
        });
    }

    if (aboutBackButton) {
        aboutBackButton.addEventListener('click', function () {
            showProtectedView('view-security');
        });
    }

    if (bankSearch) {
        bankSearch.addEventListener('input', onBankFilterChange);
    }

    if (transactionSearch) {
        transactionSearch.addEventListener('input', applyTransactionFilters);
    }

    if (dateFrom) {
        dateFrom.addEventListener('change', applyTransactionFilters);
    }

    if (dateTo) {
        dateTo.addEventListener('change', applyTransactionFilters);
    }

    if (themeButton) {
        themeButton.addEventListener('click', toggleTheme);
    }

    applyThemePreference();
    populateAppMeta();
    enforceAuthGuard();
}

/**
 * Enforces a fresh unauthenticated state when the page loads.
 * @returns {void}
 */
function enforceAuthGuard() {
    clearSession();
    hideUserChip();
    resetState();
    clearViewData();
    setLoginError(null);
    setStatus('#login-status', '');
    setStatus('#global-session-status', 'Session: none');
    setStatus('#sec-session-info', 'Session is not active.');
    showView('view-login');
}

/**
 * Handles login form submission and starts banks loading.
 * @param {SubmitEvent} event Submit event.
 * @returns {Promise<void>} Async completion state.
 */
async function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.querySelector('#input-username');
    const passwordInput = document.querySelector('#input-password');
    const loginButton = document.querySelector('#btn-login');

    const username = String(usernameInput && usernameInput.value ? usernameInput.value : '').trim();
    const password = String(passwordInput && passwordInput.value ? passwordInput.value : '').trim();

    setLoginError(null);
    if (!username || !password) {
        setLoginError('Please enter both username and password.');
        return;
    }

    if (loginButton) {
        loginButton.disabled = true;
        loginButton.setAttribute('aria-busy', 'true');
    }

    setStatus('#login-status', 'Signing in...');

    try {
        const loginResult = await directLogin(username, password);

        if (loginResult.error || !loginResult.token) {
            setLoginError(normalizeErrorMessage(loginResult.error));
            return;
        }

        storeToken(loginResult.token);
        showUserChip(username);

        if (usernameInput) {
            usernameInput.value = '';
        }

        updateSessionStatus();
        setStatus('#login-status', 'Login successful. Loading banks...');
        await loadBanks();
        showView('view-banks');
    } finally {
        if (passwordInput) {
            passwordInput.value = '';
        }

        if (loginButton) {
            loginButton.disabled = false;
            loginButton.setAttribute('aria-busy', 'false');
        }
    }
}

/**
 * Clears session state and returns user to login.
 * @returns {void}
 */
function handleSignOut() {
    clearSession();
    hideUserChip();
    resetState();
    clearViewData();
    setLoginError(null);
    setStatus('#login-status', '');
    showView('view-login');
    updateSessionStatus();
}

/**
 * Loads user-scoped banks and renders the list.
 * @returns {Promise<void>} Async completion state.
 */
async function loadBanks() {
    const container = document.querySelector('#banks-table-container');
    if (!container) {
        return;
    }

    setSkeletonVisibility('banks', true);
    setStatus('#banks-status', 'Loading banks...');

    const response = await getUserBanks();

    if (response.error) {
        setSkeletonVisibility('banks', false);
        setStatus('#banks-status', normalizeErrorMessage(response.error));
        renderBanks(container, []);
        return;
    }

    state.banks = response.banks;
    renderBanks(container, state.banks);
    setStatus('#banks-status', state.banks.length + ' banks loaded.');

    container.querySelectorAll('button[data-bank-id]').forEach(function (button) {
        button.addEventListener('click', function () {
            const bankId = String(button.getAttribute('data-bank-id') || '');
            void onBankSelected(bankId);
        });
    });
}

/**
 * Handles bank selection and loads accounts for that bank.
 * @param {string} bankId Selected bank id.
 * @returns {Promise<void>} Async completion state.
 */
async function onBankSelected(bankId) {
    state.selectedBankId = bankId;
    storeBankId(bankId);

    const container = document.querySelector('#accounts-table-container');
    if (!container) {
        return;
    }

    setSkeletonVisibility('accounts', true);
    setStatus('#accounts-status', 'Loading accounts...');

    const response = await getAccounts();

    if (response.error) {
        setSkeletonVisibility('accounts', false);
        renderAccounts(container, []);
        setStatus('#accounts-status', normalizeErrorMessage(response.error));
        return;
    }

    state.accounts = response.accounts.filter(function (account) {
        return account.bank_id === state.selectedBankId;
    });

    renderAccounts(container, state.accounts);
    setStatus('#accounts-status', state.accounts.length + ' accounts loaded.');

    container.querySelectorAll('button[data-account-id]').forEach(function (button) {
        button.addEventListener('click', function () {
            const accountId = String(button.getAttribute('data-account-id') || '');
            void onAccountSelected(accountId);
        });
    });

    showProtectedView('view-accounts');
}

/**
 * Handles account selection and loads recent transactions.
 * @param {string} accountId Selected account id.
 * @returns {Promise<void>} Async completion state.
 */
async function onAccountSelected(accountId) {
    state.selectedAccountId = accountId;
    storeAccountId(accountId);

    const container = document.querySelector('#transactions-list-container');
    if (!container) {
        return;
    }

    setSkeletonVisibility('transactions', true);
    setStatus('#transactions-status', 'Loading transactions...');

    const response = await getTransactions(state.selectedBankId, state.selectedAccountId);

    if (response.error) {
        setSkeletonVisibility('transactions', false);
        renderTransactions(container, []);
        setStatus('#transactions-status', normalizeErrorMessage(response.error));
        return;
    }

    state.transactions = response.transactions.slice(0, 50);
    renderTransactions(container, state.transactions);
    setStatus('#transactions-status', state.transactions.length + ' transactions loaded.');
    showProtectedView('view-transactions');
}

/**
 * Filters transactions by search and date criteria.
 * @returns {void}
 */
function applyTransactionFilters() {
    const container = document.querySelector('#transactions-list-container');
    if (!container) {
        return;
    }

    const searchValue = String(document.querySelector('#txn-search')?.value || '').toLowerCase();
    const fromValue = String(document.querySelector('#txn-date-from')?.value || '');
    const toValue = String(document.querySelector('#txn-date-to')?.value || '');

    const filtered = state.transactions.filter(function (transaction) {
        const details = transaction.details || {};
        const postedRaw = String(details.posted || '').slice(0, 10);
        const description = String(details.description || '').toLowerCase();
        const matchesText = description.includes(searchValue);
        const matchesFrom = !fromValue || postedRaw >= fromValue;
        const matchesTo = !toValue || postedRaw <= toValue;
        return matchesText && matchesFrom && matchesTo;
    });

    renderTransactions(container, filtered);
    setStatus('#transactions-status', filtered.length + ' transactions match filters.');
}

/**
 * Filters loaded banks by id or full name.
 * @returns {void}
 */
function onBankFilterChange() {
    const container = document.querySelector('#banks-table-container');
    if (!container) {
        return;
    }

    const query = String(document.querySelector('#bank-search')?.value || '').toLowerCase();
    const filtered = state.banks.filter(function (bank) {
        const id = String(bank.id || bank.bank_id || '').toLowerCase();
        const name = String(bank.full_name || '').toLowerCase();
        return id.includes(query) || name.includes(query);
    });

    renderBanks(container, filtered);
    setStatus('#banks-status', filtered.length + ' banks match filter.');

    container.querySelectorAll('button[data-bank-id]').forEach(function (button) {
        button.addEventListener('click', function () {
            const bankId = String(button.getAttribute('data-bank-id') || '');
            void onBankSelected(bankId);
        });
    });
}

/**
 * Shows a protected view only when session is valid.
 * @param {string} viewId Target protected view id.
 * @returns {void}
 */
function showProtectedView(viewId) {
    if (!isSessionValid() || !getToken()) {
        handleSignOut();
        setLoginError('Your session has expired. Please sign in again.');
        return;
    }

    showView(viewId);
}

/**
 * Updates status labels for current session state.
 * @returns {void}
 */
function updateSessionStatus() {
    const hasSession = isSessionValid() && Boolean(getToken());
    const statusText = hasSession ? 'Session: active' : 'Session: none';
    setStatus('#global-session-status', statusText);

    if (APP_CONFIG.ENV === 'development' && hasSession) {
        const age = getSessionAge();
        setStatus('#sec-session-info', 'Development mode session is active. Age: ' + age + 's.');
        return;
    }

    setStatus('#sec-session-info', hasSession ? 'Session is active.' : 'Session is not active.');
}

/**
 * Renders metadata details in footer and About section.
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
 * Applies persisted theme preference to the document element.
 * @returns {void}
 */
function applyThemePreference() {
    const savedTheme = sessionStorage.getItem('ui_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * Toggles between light and dark theme and stores preference in session.
 * @returns {void}
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    sessionStorage.setItem('ui_theme', nextTheme);
}

/**
 * Clears in-memory state data.
 * @returns {void}
 */
function resetState() {
    state.banks = [];
    state.accounts = [];
    state.transactions = [];
    state.selectedBankId = '';
    state.selectedAccountId = '';
}

/**
 * Clears dynamic list containers and hides all skeletons.
 * @returns {void}
 */
function clearViewData() {
    const banksContainer = document.querySelector('#banks-table-container');
    const accountsContainer = document.querySelector('#accounts-table-container');
    const transactionsContainer = document.querySelector('#transactions-list-container');

    if (banksContainer) {
        banksContainer.replaceChildren();
    }

    if (accountsContainer) {
        accountsContainer.replaceChildren();
    }

    if (transactionsContainer) {
        transactionsContainer.replaceChildren();
    }

    setSkeletonVisibility('banks', false);
    setSkeletonVisibility('accounts', false);
    setSkeletonVisibility('transactions', false);
}

document.addEventListener('deviceready', function () {
    logDebug('Cordova ready');
}, false);

document.addEventListener('session:cleared', function () {
    clearViewData();
});

injectCSP();
document.addEventListener('DOMContentLoaded', init, { once: true });
