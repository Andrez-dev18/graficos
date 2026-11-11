(function () {
    const CHART_HINT = /(tipo[\s_-]*gr[aá]fico|tipografico|dashboard|tipo[\s_-]*vista|select[\s_-]*vista|gr[aá]fico|chart|vista)/i;
    const EXCLUDE_HINT = /(tipo[\s_-]*periodo|periodo|fecha|anio|año|mes\b|granja|galpon|galp[oó]n|zona|cliente|producto|insumo|alimento|categor|clasific|ubicacion|sexo|disposicion|metrica|visualizacion|dato|campana|empresa|proveedor|provincia|item|codigo|documento|vendedor|corporativo|subcliente|cuenta|linea|modo|combinar|combinado|filtro)/i;

    const cache = new Map();
    const inFlight = new Map();
    const started = new Set();

    let pending = 0;
    let onUpdate = null;
    let notifyTimer = null;

    function normalizeUrl(url) {
        try {
            const parsed = new URL(url, window.location.href);
            return parsed.origin + parsed.pathname;
        } catch (error) {
            return String(url || '').split('?')[0].split('#')[0];
        }
    }

    function absoluteUrl(url) {
        try {
            return new URL(url, window.location.href).href;
        } catch (error) {
            return '';
        }
    }

    function isLocalHtmlUrl(url) {
        if (!url || url === '#' || /^javascript:/i.test(String(url))) {
            return false;
        }

        try {
            const parsed = new URL(url, window.location.href);
            return parsed.origin === window.location.origin && /\.html?$/i.test(parsed.pathname);
        } catch (error) {
            return false;
        }
    }

    function selectorKey(selector) {
        return `${selector.id || ''}|${selector.name || ''}`;
    }

    function getLabel(doc, select) {
        const aria = select.getAttribute('aria-label');

        if (aria && aria.trim()) {
            return aria.trim();
        }

        const id = select.getAttribute('id');

        if (id) {
            const label = Array.from(doc.querySelectorAll('label'))
                .find(item => item.getAttribute('for') === id);

            if (label && label.textContent.trim()) {
                return label.textContent.trim();
            }
        }

        const parentLabel = select.closest('label');

        if (parentLabel && parentLabel.textContent.trim()) {
            return parentLabel.textContent.trim();
        }

        return '';
    }

    function extractSelectors(doc) {
        const selectors = new Map();

        doc.querySelectorAll('select').forEach(select => {
            const id = select.getAttribute('id') || '';
            const name = select.getAttribute('name') || '';
            const label = getLabel(doc, select);
            const hint = `${id} ${name} ${label} ${select.getAttribute('title') || ''}`.trim();
            const forced = select.dataset.chartSelector === 'true' ||
                select.classList.contains('chart-selector') ||
                select.classList.contains('js-chart-selector');

            if (!id && !name) return;

            if (!forced && !CHART_HINT.test(hint)) return;
            if (!forced && EXCLUDE_HINT.test(hint)) return;
            if (select.multiple) return;

            const options = Array.from(select.options || [])
                .map(option => ({
                    value: option.value,
                    label: (option.textContent || '').replace(/\s+/g, ' ').trim()
                }))
                .filter(option => option.value !== '');

            if (options.length < 2) return;

            const item = {
                id,
                name,
                label: label || 'Tipo de gráfico',
                options
            };

            selectors.set(selectorKey(item), item);
        });

        return Array.from(selectors.values());
    }

    function notify() {
        if (typeof onUpdate !== 'function') return;

        clearTimeout(notifyTimer);
        notifyTimer = setTimeout(() => onUpdate(), 100);
    }

    function discover(url) {
        const href = absoluteUrl(url);
        const key = normalizeUrl(url);

        if (!href || !isLocalHtmlUrl(href)) {
            return Promise.resolve();
        }

        if (cache.has(key) && cache.get(key).status === 'ready') {
            return Promise.resolve();
        }

        if (inFlight.has(key)) {
            return inFlight.get(key);
        }

        pending++;
        notify();

        const promise = fetch(href, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-cache'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return response.text();
            })
            .then(html => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                cache.set(key, {
                    status: 'ready',
                    selectors: extractSelectors(doc)
                });
            })
            .catch(() => {
                cache.set(key, {
                    status: 'error',
                    selectors: []
                });
            })
            .finally(() => {
                pending = Math.max(0, pending - 1);
                inFlight.delete(key);
                notify();
            });

        inFlight.set(key, promise);

        return promise;
    }

    function preload(links) {
        const urls = [];
        const seen = new Set();

        (links || []).forEach(link => {
            const url = link && link.url;

            if (!isLocalHtmlUrl(url)) return;

            const key = normalizeUrl(url);

            if (seen.has(key) || started.has(key)) return;

            seen.add(key);
            started.add(key);
            urls.push(url);
        });

        if (!urls.length) {
            notify();
            return Promise.resolve();
        }

        const queue = urls.slice();
        const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
            while (queue.length) {
                const url = queue.shift();
                await discover(url);
            }
        });

        return Promise.all(workers);
    }

    function getSelectors(url) {
        const entry = cache.get(normalizeUrl(url));
        return entry && entry.status === 'ready' ? entry.selectors : [];
    }

    function refreshFromDocument(url, doc) {
        if (!doc) return;

        const selectors = extractSelectors(doc);

        if (!selectors.length) return;

        const key = normalizeUrl(url);
        const current = cache.get(key);
        const merged = new Map();

        if (current && current.selectors) {
            current.selectors.forEach(selector => merged.set(selectorKey(selector), selector));
        }

        selectors.forEach(selector => merged.set(selectorKey(selector), selector));

        cache.set(key, {
            status: 'ready',
            selectors: Array.from(merged.values())
        });

        notify();
    }

    function setUpdateCallback(callback) {
        onUpdate = callback;
    }

    function isPending() {
        return pending > 0;
    }

    function bindFrame() {
        const frame = document.getElementById('dashboardFrame');

        if (!frame) return;

        frame.addEventListener('load', () => {
            try {
                if (!frame.contentWindow || !frame.contentDocument) return;

                const href = frame.contentWindow.location.href;

                if (!href || href === 'about:blank') return;

                refreshFromDocument(href, frame.contentDocument);
            } catch (error) {
                return;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindFrame);
    } else {
        bindFrame();
    }

    window.ChartDiscovery = {
        normalizeUrl,
        preload,
        getSelectors,
        refreshFromDocument,
        setUpdateCallback,
        isPending
    };
})();
