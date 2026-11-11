
let searchableLinks = [];
let chartResults = [];
let selectedSearchIndex = -1;
let currentSearchQuery = '';

const CHART_SELECTION_KEY = '__corebiChartSelection';

function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(value, term) {
    const safe = escapeHtml(value);

    if (!term) return safe;

    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    return safe.replace(regex, '<span class="text-blue-600 font-black bg-blue-50">$1</span>');
}

function extraerUrlEnlace(link) {
    if (link.dataset && link.dataset.url) return link.dataset.url;

    const onclick = link.getAttribute('onclick') || '';
    const match = onclick.match(/loadDashboardAndData\(\s*'([^']*)'/);

    return match ? match[1] : '';
}

function initSearchEngine() {
    const links = document.querySelectorAll('.sidebar .menu-link');

    searchableLinks = Array.from(links).map((link, index) => {
        const textoPlano = link.textContent.replace(/\n/g, '').replace(/ +/g, ' ').trim();
        let breadcrumbs = [];
        let parent = link.closest('.submenu');

        while (parent) {
            const toggleBtn = parent.previousElementSibling;

            if (toggleBtn && toggleBtn.tagName === 'BUTTON') {
                const btnText = toggleBtn.textContent.replace(/\n/g, '').replace(/ +/g, ' ').trim();
                breadcrumbs.unshift(btnText);
            }

            parent = parent.parentElement.closest('.submenu');
        }

        return {
            index,
            text: textoPlano,
            path: breadcrumbs.join('  >  '),
            element: link,
            url: extraerUrlEnlace(link),
            titulo: link.dataset.titulo || textoPlano,
            codMod: link.dataset.codMod || ''
        };
    });

    if (window.ChartDiscovery) {
        window.ChartDiscovery.setUpdateCallback(() => {
            const modal = document.getElementById('searchModal');

            if (modal && !modal.classList.contains('hidden')) {
                renderSearchResults(currentSearchQuery);
            }
        });

        window.ChartDiscovery.preload(searchableLinks);
    }
}

function openSearchModal() {
    if (searchableLinks.length === 0) {
        initSearchEngine();
    } else if (window.ChartDiscovery) {
        window.ChartDiscovery.preload(searchableLinks);
    }

    document.getElementById('searchModal').classList.remove('hidden');

    const input = document.getElementById('searchInput');
    input.value = '';
    input.focus();
    currentSearchQuery = '';
    renderSearchResults('');
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.add('hidden');
}

function closeSearchModalOnBg(e) {
    if (e.target.id === 'searchModal') closeSearchModal();
}

document.getElementById('searchInput').addEventListener('input', function (e) {
    renderSearchResults(e.target.value);
});

function obtenerChartItems() {
    const items = [];
    const seen = new Set();

    if (!window.ChartDiscovery) return items;

    searchableLinks.forEach(link => {
        const selectors = window.ChartDiscovery.getSelectors(link.url);

        selectors.forEach(selector => {
            selector.options.forEach(option => {
                const key = `${link.url}|${selector.id}|${selector.name}|${option.value}`;

                if (seen.has(key)) return;

                seen.add(key);

                items.push({
                    link,
                    selectorId: selector.id,
                    selectorName: selector.name,
                    selectorLabel: selector.label,
                    value: option.value,
                    label: option.label
                });
            });
        });
    });

    return items;
}

function renderMenuResult(item, query) {
    return `
        <button type="button" data-result-type="menu" id="searchResult-${item.index}"
            onclick="executeSearchResult(${item.index})"
            class="search-item w-full text-left p-3 hover:bg-white focus:bg-white hover:shadow-md focus:shadow-md border border-transparent hover:border-blue-200 focus:border-blue-400 rounded-xl transition-all mb-1 group flex items-center justify-between outline-none">
            <div class="min-w-0">
                <p class="text-[10px] text-gray-400 mb-1 font-bold tracking-wider uppercase"><i class="fas fa-folder-open text-gray-300 mr-1"></i> ${highlightText(item.path, query)}</p>
                <p class="text-gray-800 font-medium group-hover:text-blue-700">${highlightText(item.text, query)}</p>
            </div>
            <div class="w-8 h-8 shrink-0 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <i class="fas fa-arrow-right text-gray-400 group-hover:text-blue-600"></i>
            </div>
        </button>
    `;
}

function renderChartResult(item, index, query) {
    return `
        <button type="button" data-result-type="chart" data-chart-value="${escapeHtml(item.value)}"
            data-menu-url="${escapeHtml(item.link.url)}" data-menu-title="${escapeHtml(item.link.text)}"
            onclick="executeChartSearchResult(${index})"
            class="search-item w-full text-left p-3 hover:bg-white focus:bg-white hover:shadow-md focus:shadow-md border border-transparent hover:border-blue-200 focus:border-blue-400 rounded-xl transition-all mb-1 group flex items-center justify-between outline-none">
            <div class="min-w-0">
                <p class="text-[10px] text-gray-400 mb-1 font-bold tracking-wider uppercase"><i class="fas fa-folder-open text-gray-300 mr-1"></i> ${highlightText(item.link.path, query)}</p>
                <p class="text-gray-800 font-medium group-hover:text-blue-700">${highlightText(item.link.text, query)}</p>
                <p class="mt-0.5 text-xs font-medium text-gray-500">
                    <i class="fa-solid fa-chart-simple text-blue-500 mr-1"></i>${highlightText(item.label, query)}
                </p>
            </div>
            <div class="w-8 h-8 shrink-0 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                <i class="fas fa-arrow-right text-gray-400 group-hover:text-blue-600"></i>
            </div>
        </button>
    `;
}

function renderSearchResults(query) {
    currentSearchQuery = query;

    const container = document.getElementById('searchResults');
    selectedSearchIndex = -1;

    if (!query.trim()) {
        chartResults = [];
        container.innerHTML = `
                    <div class="p-10 text-center text-gray-400">
                        <i class="fas fa-keyboard text-5xl mb-4 text-gray-300"></i>
                        <p class="text-sm font-medium text-gray-500">Escribe el nombre del menú o tipo de gráfico que buscas...</p>
                    </div>`;
        return;
    }

    const term = query.toLowerCase().trim();
    const menuMatches = searchableLinks.filter(item =>
        item.text.toLowerCase().includes(term) || item.path.toLowerCase().includes(term)
    );
    const chartMatches = obtenerChartItems().filter(item => {
        const fields = [
            item.label,
            item.selectorLabel,
            item.link.text,
            item.link.titulo,
            item.link.path
        ].join(' ').toLowerCase();

        return fields.includes(term);
    });

    chartResults = chartMatches;

    let html = '';

    menuMatches.forEach(item => {
        html += renderMenuResult(item, query);
    });

    chartMatches.forEach((item, index) => {
        html += renderChartResult(item, index, query);
    });

    const pending = window.ChartDiscovery && window.ChartDiscovery.isPending();
    const loading = `
        <div class="px-3 py-2 text-center text-xs text-gray-400">
            <i class="fas fa-spinner fa-spin mr-1"></i> Buscando tipos de gráfico...
        </div>
    `;

    if (!html && pending) {
        html = loading;
    } else if (!html) {
        html = `
                    <div class="p-10 text-center text-gray-500">
                        <i class="fas fa-search-minus text-4xl mb-3 text-gray-300"></i>
                        <p>No se encontraron resultados para "<strong class="text-gray-700">${escapeHtml(query)}</strong>"</p>
                    </div>`;
    } else if (pending) {
        html += loading;
    }

    container.innerHTML = html;
}

function enfocarMenu(item) {
    if (!item) return;

    const url = item.url || '';

    setTimeout(() => {
        if (url && window.menuPrincipal && typeof window.menuPrincipal.seleccionarModuloPorUrl === 'function') {
            window.menuPrincipal.seleccionarModuloPorUrl(url);
        }

        setTimeout(() => {
            try {
                item.element.focus({ preventScroll: true });
            } catch (error) {
                return;
            }
        }, 250);
    }, 50);
}

function buscarSelector(doc, item) {
    if (item.selectorId) {
        const byId = doc.getElementById(item.selectorId);

        if (byId) return byId;
    }

    if (item.selectorName) {
        return Array.from(doc.querySelectorAll('select'))
            .find(select => select.getAttribute('name') === item.selectorName) || null;
    }

    return null;
}

function frameMatchesUrl(frame, url) {
    if (!frame || !url) return true;

    try {
        const target = new URL(url, window.location.href).pathname;
        const current = frame.contentWindow.location.pathname;
        return target === current;
    } catch (error) {
        return false;
    }
}

function rutaModulo(url) {
    try {
        return new URL(url, window.location.href).pathname;
    } catch (error) {
        return '';
    }
}

function guardarSeleccionPendiente(item) {
    try {
        sessionStorage.setItem(CHART_SELECTION_KEY, JSON.stringify({
            url: rutaModulo(item.link.url),
            selectorId: item.selectorId || '',
            selectorName: item.selectorName || '',
            value: item.value,
            ts: Date.now()
        }));
    } catch (error) {
        return;
    }
}

function limpiarSeleccionPendiente(item) {
    try {
        const raw = sessionStorage.getItem(CHART_SELECTION_KEY);

        if (!raw) return;

        const pendiente = JSON.parse(raw);

        if (!pendiente) {
            sessionStorage.removeItem(CHART_SELECTION_KEY);
            return;
        }

        if (pendiente.url === rutaModulo(item.link.url) && pendiente.value === item.value) {
            sessionStorage.removeItem(CHART_SELECTION_KEY);
        }
    } catch (error) {
        return;
    }
}

function moduloSigueCargando(doc) {
    const boton = doc.getElementById('btn-cargar') || doc.getElementById('btnCargar');

    if (boton && (boton.disabled || /cargando/i.test(boton.textContent || ''))) {
        return true;
    }

    return Array.from(doc.querySelectorAll('button, [role="status"], .loading'))
        .some(elemento => {
            if (elemento.classList && elemento.classList.contains('hidden')) return false;

            return /cargando/i.test(elemento.textContent || '');
        });
}

function aplicarGraficoEnIframe(item, attempt = 0) {
    const frame = document.getElementById('dashboardFrame');
    let doc = null;

    try {
        doc = frame && frame.contentDocument;
    } catch (error) {
        doc = null;
    }

    if (doc && doc.readyState === 'complete' && frameMatchesUrl(frame, item.link.url)) {
        const select = buscarSelector(doc, item);

        if (select) {
            if (select.value === item.value) {
                limpiarSeleccionPendiente(item);
                return;
            }

            const exists = Array.from(select.options).some(option => option.value === item.value);

            if (exists && !moduloSigueCargando(doc)) {
                select.value = item.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                limpiarSeleccionPendiente(item);
                return;
            }
        }
    }

    if (attempt < 150) {
        setTimeout(() => aplicarGraficoEnIframe(item, attempt + 1), 100);
    } else {
        limpiarSeleccionPendiente(item);
    }
}

function executeSearchResult(realIndex) {
    closeSearchModal();

    const item = searchableLinks[realIndex];

    if (!item) return;

    try {
        sessionStorage.removeItem(CHART_SELECTION_KEY);
    } catch (error) { }

    item.element.click();
    enfocarMenu(item);
}

function executeChartSearchResult(chartIndex) {
    closeSearchModal();

    const item = chartResults[chartIndex];

    if (!item || !item.link) return;

    const frame = document.getElementById('dashboardFrame');
    const mismoModulo = frame && frame.contentDocument &&
        frame.contentDocument.readyState === 'complete' &&
        frameMatchesUrl(frame, item.link.url);

    if (!mismoModulo) {
        guardarSeleccionPendiente(item);
    }

    item.link.element.click();
    enfocarMenu(item.link);
    aplicarGraficoEnIframe(item);
}

document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('searchModal');
    const isModalOpen = !modal.classList.contains('hidden');

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isModalOpen ? closeSearchModal() : openSearchModal();
    }

    if (!isModalOpen) return;

    if (e.key === 'Escape') closeSearchModal();

    const items = document.querySelectorAll('.search-item');

    if (items.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedSearchIndex = (selectedSearchIndex + 1) % items.length;
            items[selectedSearchIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedSearchIndex = (selectedSearchIndex - 1 + items.length) % items.length;
            items[selectedSearchIndex].focus();
        }
    }
});
