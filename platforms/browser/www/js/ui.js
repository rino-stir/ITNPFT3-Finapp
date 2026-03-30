/**
 * Shows one application view and hides all others.
 * @param {string} viewId Target section ID to display.
 * @returns {void}
 */
export function showView(viewId) {
    document.querySelectorAll('.view').forEach(function (viewElement) {
        const isTarget = viewElement.id === viewId;
        viewElement.hidden = !isTarget;
        viewElement.classList.toggle('is-active', isTarget);
    });
}

/**
 * Updates text content in a status region.
 * @param {string} selector CSS selector for target status element.
 * @param {string} message Message text.
 * @returns {void}
 */
export function setStatus(selector, message) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = message;
    }
}

/**
 * Renders banks table with action buttons.
 * @param {Array<object>} banks OBP bank records.
 * @returns {string} HTML table markup.
 */
export function renderBanksTable(banks) {
    const rows = banks.map(function (bank) {
        const bankId = bank.id || bank.bank_id || '';

        return '<tr>' +
            '<td>' + escapeHtml(bankId) + '</td>' +
            '<td>' + escapeHtml(bank.full_name || '') + '</td>' +
            '<td>' + escapeHtml(bank.bank_code || '') + '</td>' +
            '<td><button class="table-action" data-bank-id="' + escapeHtml(bankId) + '">Select</button></td>' +
            '</tr>';
    }).join('');

    return '<table class="data-table"><thead><tr><th>Bank ID</th><th>Name</th><th>Short Name</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/**
 * Renders account selection table for chosen bank.
 * @param {Array<object>} accounts OBP account records.
 * @returns {string} HTML table markup.
 */
export function renderAccountsTable(accounts) {
    const rows = accounts.map(function (account) {
        return '<tr>' +
            '<td>' + escapeHtml(account.bank_id || '') + '</td>' +
            '<td>' + escapeHtml(account.id || account.account_id || '') + '</td>' +
            '<td>' + escapeHtml((account.label || account.product_code || 'Account')) + '</td>' +
            '<td><button class="table-action" data-account-id="' + escapeHtml(account.id || account.account_id || '') + '">Select</button></td>' +
            '</tr>';
    }).join('');

    return '<table class="data-table"><thead><tr><th>Bank</th><th>Account</th><th>Name</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/**
 * Renders transactions table.
 * @param {Array<object>} transactions OBP transaction records.
 * @returns {string} HTML table markup.
 */
export function renderTransactionsTable(transactions) {
    const rows = transactions.map(function (transaction) {
        const details = transaction.details || {};
        const value = details.value || {};

        return '<tr>' +
            '<td>' + escapeHtml(details.posted || '') + '</td>' +
            '<td>' + escapeHtml(details.description || '') + '</td>' +
            '<td>' + escapeHtml(value.currency || '') + '</td>' +
            '<td>' + escapeHtml(value.amount || '') + '</td>' +
            '</tr>';
    }).join('');

    return '<table class="data-table"><thead><tr><th>Date</th><th>Description</th><th>Currency</th><th>Amount</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

/**
 * Converts unknown error into readable UI text.
 * @param {unknown} error Error object or text.
 * @returns {string} User-facing error message.
 */
export function normalizeErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string' && error.length > 0) {
        return error;
    }

    return 'Request failed. Please try again.';
}

/**
 * Escapes user-controlled text before HTML injection.
 * @param {string} value Raw value.
 * @returns {string} Escaped safe value.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
