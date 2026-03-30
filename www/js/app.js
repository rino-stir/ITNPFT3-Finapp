/* global $, cordova, window */
(function () {
    'use strict';

    var App = {
        state: {
            selectedBankId: null,
            selectedAccountId: null
        },

        init: function () {
            this.bindEvents();
        },

        bindEvents: function () {
            document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);

            $(document).on('pagebeforeshow', '#page-security', this.onSecurityPageShow.bind(this));
            $(document).on('pagebeforeshow', '#page-banks', this.onBanksPageShow.bind(this));

            $(document).on('click', '#btn-login', this.onLoginTapped.bind(this));
            $(document).on('click', '#btn-logout', this.onLogoutTapped.bind(this));
        },

        onDeviceReady: function () {
            console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
            window.UI.showStatus('#login-status', 'Device ready. Enter OBP credentials to continue.', 'success');
            this.updateSessionIndicators();
        },

        onLoginTapped: function (event) {
            var username;
            var password;

            event.preventDefault();

            username = $('#input-username').val() || $('#username').val();
            password = $('#input-password').val() || $('#password').val();

            window.UI.setLoading('#page-login', true);
            window.Security.setSessionCredentials({
                username: username,
                hasPasswordInput: !!password
            });

            window.OBPApi.directLogin(username, password)
                .done(function (response) {
                    window.Security.setToken(response && response.token ? response.token : '');
                    window.UI.showStatus('#login-status', 'Login successful. Opening banks...', 'success');
                    $.mobile.changePage('#page-banks');
                })
                .fail(function (jqXHR) {
                    window.UI.showError('#login-status', window.UI.extractAjaxError(jqXHR));
                })
                .always(function () {
                    window.UI.setLoading('#page-login', false);
                    App.updateSessionIndicators();
                });
        },

        onBanksPageShow: function () {
            var self = this;

            window.UI.setLoading('#page-banks', true);
            window.OBPApi.getBanks()
                .done(function (response) {
                    window.UI.renderBanks('#banks-table-container', response && response.banks ? response.banks : []);

                    if (response && response.banks && response.banks.length > 0) {
                        self.state.selectedBankId = response.banks[0].id;
                    }
                })
                .fail(function (jqXHR) {
                    window.UI.showError('#banks-status', window.UI.extractAjaxError(jqXHR));
                })
                .always(function () {
                    window.UI.setLoading('#page-banks', false);
                });
        },

        onSecurityPageShow: function () {
            var token = window.Security.getToken();
            var securitySummary = window.Security.getSecuritySummary();
            var message = token
                ? 'Session token is present in memory. App consumer: ' + securitySummary.consumerIdMasked
                : 'No active token in memory. App consumer: ' + securitySummary.consumerIdMasked;

            $('#sec-session-info').text(message);
            this.updateSessionIndicators();
        },

        onLogoutTapped: function (event) {
            event.preventDefault();
            window.Security.clearSession();
            $('#sec-session-info').text('Session cleared from memory.');
            window.UI.showStatus('#login-status', 'Session cleared. Please login again.', 'success');
            this.updateSessionIndicators();
            $.mobile.changePage('#page-login');
        },

        updateSessionIndicators: function () {
            var text = window.Security.getToken() ? 'Session: active' : 'Session: none';

            $('#status-page-login').text(text);
            $('#status-page-banks').text(text);
            $('#status-page-accounts').text(text);
            $('#status-page-transactions').text(text);
            $('#status-page-security').text(text);
        }
    };

    window.App = App;
    App.init();
}());
