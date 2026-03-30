'use strict';

/**
 * Shows one view, hides others, and animates the entered view.
 * @param {string} viewId Target section ID.
 * @returns {void}
 */
export function showView(viewId) {
    document.querySelectorAll('.view').forEach(function (viewElement) {
        const isTarget = viewElement.id === viewId;
        viewElement.hidden = !isTarget;
        viewElement.classList.toggle('is-active', isTarget);

        if (isTarget) {
            viewElement.classList.add('view-enter');
            const onDone = function () {
                viewElement.classList.remove('view-enter');
                viewElement.removeEventListener('animationend', onDone);
            };
            viewElement.addEventListener('animationend', onDone);
        }
    });
}

/**
 * Updates text content in a status region.
 * @param {string} selector CSS selector for status node.
 * @param {string} message Display text.
 * @returns {void}
 */
export function setStatus(selector, message) {
    const element = document.querySelector(selector);
    if (!element) {
        return;
    }

    element.textContent = typeof message === 'string' ? message : '';
}

/**
 * Sets the login error message in an assertive live region.
 * @param {string|null} message Error text or null to clear.
 * @returns {void}
 */
export function setLoginError(message) {
    const element = document.querySelector('#login-error');
    if (!element) {
        return;
    }

    const text = typeof message === 'string' ? message.trim() : '';
    element.textContent = text;
    element.hidden = text.length === 0;
}

/**
 * Displays the signed-in user chip with initials and name.
 * @param {string} username Username to show.
 * @returns {void}
 */
export function showUserChip(username) {
    const userChip = document.querySelector('#user-chip');
    const nameNode = document.querySelector('#user-chip-name');
    const initialsNode = document.querySelector('#user-chip-initials');
    const signOutButton = document.querySelector('#btn-signout');

    if (!userChip || !nameNode || !initialsNode || !signOutButton) {
        return;
    }

    const safeName = String(username || '').trim();
    const initials = safeName.slice(0, 2).toUpperCase() || '--';

    nameNode.textContent = safeName;
    initialsNode.textContent = initials;
    userChip.hidden = false;
    signOutButton.hidden = false;
}

/**
 * Hides the user chip and sign-out button.
 * @returns {void}
 */
export function hideUserChip() {
    const userChip = document.querySelector('#user-chip');
    const nameNode = document.querySelector('#user-chip-name');
    const initialsNode = document.querySelector('#user-chip-initials');
    const signOutButton = document.querySelector('#btn-signout');

    if (nameNode) {
        nameNode.textContent = '';
    }

    if (initialsNode) {
        initialsNode.textContent = '--';
    }

    if (userChip) {
        userChip.hidden = true;
    }

    if (signOutButton) {
        signOutButton.hidden = true;
    }
}

/**
 * Shows or hides a named skeleton block.
 * @param {'banks'|'accounts'|'transactions'} scope Skeleton scope.
 * @param {boolean} visible Whether the skeleton should be visible.
 * @returns {void}
 */
export function setSkeletonVisibility(scope, visible) {
    const element = document.querySelector('#' + scope + '-skeleton');
    if (!element) {
        return;
    }

    element.hidden = !visible;
}

/**
 * Renders banks content and manages skeleton/empty states.
 * @param {HTMLElement} container Target container.
 * @param {Array<object>} banks Banks data.
 * @returns {void}
 */
export function renderBanks(container, banks) {
    container.replaceChildren();

    if (!Array.isArray(banks) || banks.length === 0) {
        container.appendChild(createEmptyState('No banks available', 'We could not find any banks linked to this sandbox user yet.'));
        setSkeletonVisibility('banks', false);
        return;
    }

    const table = createTable(
        ['Bank ID', 'Name', 'Short Name', 'Action'],
        banks.map(function (bank) {
            const row = document.createElement('tr');
            const bankId = String(bank.id || bank.bank_id || '');

            row.appendChild(createCell(bankId));
            row.appendChild(createCell(String(bank.full_name || '')));
            row.appendChild(createCell(String(bank.short_name || bank.bank_code || '')));

            const actionCell = document.createElement('td');
            const button = document.createElement('button');
            button.className = 'table-action';
            button.type = 'button';
            button.dataset.bankId = bankId;
            button.textContent = 'Select';
            actionCell.appendChild(button);
            row.appendChild(actionCell);
            return row;
        })
    );

    container.appendChild(table);
    setSkeletonVisibility('banks', false);
}

/**
 * Renders accounts content and manages skeleton/empty states.
 * @param {HTMLElement} container Target container.
 * @param {Array<object>} accounts Accounts data.
 * @returns {void}
 */
export function renderAccounts(container, accounts) {
    container.replaceChildren();

    if (!Array.isArray(accounts) || accounts.length === 0) {
        container.appendChild(createEmptyState('No accounts found', 'This bank has no available accounts for the signed-in user.'));
        setSkeletonVisibility('accounts', false);
        return;
    }

    const table = createTable(
        ['Bank', 'Account', 'Name', 'Action'],
        accounts.map(function (account) {
            const row = document.createElement('tr');
            const accountId = String(account.id || account.account_id || '');

            row.appendChild(createCell(String(account.bank_id || '')));
            row.appendChild(createCell(accountId));
            row.appendChild(createCell(String(account.label || account.product_code || 'Account')));

            const actionCell = document.createElement('td');
            const button = document.createElement('button');
            button.className = 'table-action';
            button.type = 'button';
            button.dataset.accountId = accountId;
            button.textContent = 'Select';
            actionCell.appendChild(button);
            row.appendChild(actionCell);
            return row;
        })
    );

    container.appendChild(table);
    setSkeletonVisibility('accounts', false);
}

/**
 * Renders transactions content and manages skeleton/empty states.
 * @param {HTMLElement} container Target container.
 * @param {Array<object>} transactions Transactions data.
 * @returns {void}
 */
export function renderTransactions(container, transactions) {
    container.replaceChildren();

    if (!Array.isArray(transactions) || transactions.length === 0) {
        container.appendChild(createEmptyState('No recent transactions', 'Try another account or adjust your date range to see activity.'));
        setSkeletonVisibility('transactions', false);
        return;
    }

    const table = createTable(
        ['Date', 'Description', 'Currency', 'Amount'],
        transactions.map(function (transaction) {
            const details = transaction && transaction.details ? transaction.details : {};
            const value = details.value || {};
            const row = document.createElement('tr');

            row.appendChild(createCell(String(details.posted || '')));
            row.appendChild(createCell(String(details.description || '')));
            row.appendChild(createCell(String(value.currency || '')));
            row.appendChild(createCell(String(value.amount || '')));
            return row;
        })
    );

    container.appendChild(table);
    setSkeletonVisibility('transactions', false);
}

/**
 * Normalizes unknown errors to user-friendly text.
 * @param {unknown} error Error candidate.
 * @returns {string} Readable message.
 */
export function normalizeErrorMessage(error) {
    if (typeof error === 'string' && error.trim().length > 0) {
        return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message || '').trim();
        if (errorMessage.length > 0) {
            return errorMessage;
        }
    }

    return 'Something went wrong. Please try again.';
}

/**
 * Builds a generic empty-state message block.
 * @param {string} title Empty state title.
 * @param {string} body Empty state body message.
 * @returns {HTMLElement} Empty state element.
 */
function createEmptyState(title, body) {
    const wrap = document.createElement('article');
    const heading = document.createElement('h3');
    const message = document.createElement('p');

    wrap.className = 'card';
    heading.className = 'card-title';
    message.className = 'helper-text';

    heading.textContent = title;
    message.textContent = body;

    wrap.appendChild(heading);
    wrap.appendChild(message);
    return wrap;
}

/**
 * Creates a semantic data table element.
 * @param {Array<string>} headers Column headers.
 * @param {Array<HTMLTableRowElement>} rows Table rows.
 * @returns {HTMLTableElement} Table node.
 */
function createTable(headers, rows) {
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const body = document.createElement('tbody');

    table.className = 'data-table';

    headers.forEach(function (text) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = text;
        headRow.appendChild(th);
    });

    rows.forEach(function (row) {
        body.appendChild(row);
    });

    head.appendChild(headRow);
    table.appendChild(head);
    table.appendChild(body);
    return table;
}

/**
 * Creates a table cell with text content.
 * @param {string} value Cell text.
 * @returns {HTMLTableCellElement} Table cell element.
 */
function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
}
