/**
 * Tema claro/oscuro para módulos temperatura (alineado con switch sidebar ix2).
 * Lee html[data-theme] y escucha cambios del host iframe.
 */
(function (global) {
    'use strict';

    var listeners = [];
    var observerStarted = false;

    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function chartColors() {
        if (isDark()) {
            return {
                tick: '#a1a1aa',
                grid: 'rgba(161, 161, 170, 0.22)',
                title: '#f4f4f5',
                legend: '#e4e4e7',
                tooltipBg: 'rgba(39, 39, 42, 0.96)',
                tooltipTitle: '#f4f4f5',
                tooltipBody: '#e4e4e7',
                tooltipBorder: '#52525b'
            };
        }
        return {
            tick: '#374151',
            grid: 'rgba(156, 163, 175, 0.45)',
            title: '#111827',
            legend: '#374151',
            tooltipBg: 'rgba(255, 255, 255, 0.96)',
            tooltipTitle: '#111827',
            tooltipBody: '#374151',
            tooltipBorder: '#e5e7eb'
        };
    }

    function notify() {
        var i;
        for (i = 0; i < listeners.length; i++) {
            try {
                listeners[i](isDark());
            } catch (e) { /* ignore */ }
        }
    }

    function onChange(fn) {
        if (typeof fn !== 'function') {
            return function () {};
        }
        listeners.push(fn);
        startObserver();
        return function () {
            listeners = listeners.filter(function (f) { return f !== fn; });
        };
    }

    function startObserver() {
        if (observerStarted) {
            return;
        }
        observerStarted = true;
        try {
            var obs = new MutationObserver(function (mutations) {
                var i;
                for (i = 0; i < mutations.length; i++) {
                    if (mutations[i].attributeName === 'data-theme') {
                        notify();
                        break;
                    }
                }
            });
            obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        } catch (e) { /* ignore */ }

        global.addEventListener('storage', function (ev) {
            if (ev && ev.key === 'ix2-theme') {
                var mode = String(ev.newValue || '').trim().toLowerCase();
                if (mode === 'dark' || mode === 'light') {
                    document.documentElement.setAttribute('data-theme', mode);
                    document.documentElement.style.colorScheme = mode;
                    notify();
                }
            }
        });
    }

    global.TempTheme = {
        isDark: isDark,
        chartColors: chartColors,
        onChange: onChange
    };
})(typeof window !== 'undefined' ? window : this);
