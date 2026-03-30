'use strict';

const ENV = 'development';

/**
 * Runtime configuration for the OBP web banking app.
 * Set ENV to "production" before final submission build.
 * @type {Readonly<{
 * ENV: 'development'|'production',
 * OBP_BASE_URL: string,
 * OBP_API_VERSION: string,
 * SESSION_TOKEN_KEY: string,
 * SESSION_BANK_KEY: string,
 * SESSION_ACCOUNT_KEY: string,
 * LOG_ENABLED: boolean,
 * CONSUMER_KEY: string,
 * OBP_CONSUMER_KEY: string,
 * OBP_DIRECT_LOGIN_PATH: string,
 * USERNAME_STORAGE_KEY: string,
 * APP_VERSION: string,
 * APP_DEVELOPER: string,
 * APP_STUDENT_ID: string,
 * API_PROVIDER: string
 * }>}
 */
const APP_CONFIG = Object.freeze({
    ENV: ENV,
    OBP_BASE_URL: 'https://apisandbox.openbankproject.com',
    OBP_API_VERSION: 'v6.0.0',
    SESSION_TOKEN_KEY: 'obp_token',
    SESSION_BANK_KEY: 'obp_bank',
    SESSION_ACCOUNT_KEY: 'obp_account',
    LOG_ENABLED: ENV === 'development',
    CONSUMER_KEY: 's5zjt0nw1gtbtizmy0ggu2kl4fjzp3xnpijseg1z',
    OBP_CONSUMER_KEY: 's5zjt0nw1gtbtizmy0ggu2kl4fjzp3xnpijseg1z',
    OBP_DIRECT_LOGIN_PATH: '/my/logins/direct',
    USERNAME_STORAGE_KEY: 'obp_saved_username',
    APP_VERSION: '1.0.0',
    APP_DEVELOPER: 'Rinold Sagayaraj',
    APP_STUDENT_ID: '3079158',
    API_PROVIDER: 'https://apisandbox.openbankproject.com'
});

window.APP_CONFIG = APP_CONFIG;

/**
 * Builds Content Security Policy based on environment.
 * @returns {string} CSP string for current environment.
 */
function buildCspValue() {
    // if (APP_CONFIG.ENV === 'development') {
    //     return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://api.fontshare.com https://fonts.gstatic.com; connect-src 'self' https://apisandbox.openbankproject.com; img-src 'self' data:;";
    // }

    // return "default-src 'none'; script-src 'self'; style-src 'self' https://api.fontshare.com https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://api.fontshare.com https://fonts.gstatic.com; connect-src https://apisandbox.openbankproject.com; img-src 'self'; form-action 'self'; base-uri 'self';";
}

/**
 * Injects environment-specific CSP meta tag into document head.
 * @returns {void}
 */
function injectCSP() {
    const existingMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingMeta) {
        existingMeta.remove();
    }

    const cspMeta = document.createElement('meta');
    cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    cspMeta.setAttribute('content', buildCspValue());
    document.head.prepend(cspMeta);
}

/**
 * Environment-aware logger that suppresses output in production.
 * @type {{log: (...args: unknown[]) => void, warn: (...args: unknown[]) => void, error: (...args: unknown[]) => void}}
 */
const logger = {
    /**
     * Writes development log output with OBP prefix.
     * @param {...unknown} args Values to print.
     * @returns {void}
     */
    log: function (...args) {
        if (APP_CONFIG.ENV === 'development') {
            console.log('[OBP-DEV]', ...args);
        }
    },

    /**
     * Writes development warning output with OBP prefix.
     * @param {...unknown} args Values to print.
     * @returns {void}
     */
    warn: function (...args) {
        if (APP_CONFIG.ENV === 'development') {
            console.warn('[OBP-DEV]', ...args);
        }
    },

    /**
     * Writes development error output with OBP prefix.
     * @param {...unknown} args Values to print.
     * @returns {void}
     */
    error: function (...args) {
        if (APP_CONFIG.ENV === 'development') {
            console.error('[OBP-DEV]', ...args);
        }
    }
};

window.injectCSP = injectCSP;
window.logger = logger;
