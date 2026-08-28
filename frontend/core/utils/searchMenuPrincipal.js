
let searchableLinks = [];
let selectedSearchIndex = -1;

// 1. Recolectar todos los enlaces del menú al abrir el buscador
function initSearchEngine() {
    const links = document.querySelectorAll('.sidebar .menu-link');
    searchableLinks = Array.from(links).map((link, index) => {
        // Sacar el nombre del reporte
        const textoPlano = link.textContent.replace(/\n/g, '').replace(/ +/g, ' ').trim();

        // Sacar la ruta de migas (Carpeta Padre > Subcarpeta)
        let breadcrumbs = [];
        let parent = link.closest('.submenu');
        while (parent) {
            const toggleBtn = parent.previousElementSibling;
            if (toggleBtn && toggleBtn.tagName === 'BUTTON') {
                let btnText = toggleBtn.textContent.replace(/\n/g, '').replace(/ +/g, ' ').trim();
                breadcrumbs.unshift(btnText);
            }
            parent = parent.parentElement.closest('.submenu');
        }

        return {
            index: index,
            text: textoPlano,
            path: breadcrumbs.join('  >  '),
            element: link // Guardamos el DOM element para clickearlo
        };
    });
}

function openSearchModal() {
    if (searchableLinks.length === 0) initSearchEngine();
    document.getElementById('searchModal').classList.remove('hidden');
    const input = document.getElementById('searchInput');
    input.value = '';
    input.focus();
    renderSearchResults('');
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.add('hidden');
}

function closeSearchModalOnBg(e) {
    if (e.target.id === 'searchModal') closeSearchModal();
}

// 2. Filtrar resultados al escribir
document.getElementById('searchInput').addEventListener('input', function (e) {
    renderSearchResults(e.target.value);
});

function renderSearchResults(query) {
    const container = document.getElementById('searchResults');
    selectedSearchIndex = -1;

    if (!query.trim()) {
        container.innerHTML = `
                    <div class="p-10 text-center text-gray-400">
                        <i class="fas fa-keyboard text-5xl mb-4 text-gray-300"></i>
                        <p class="text-sm font-medium text-gray-500">Escribe el nombre del dashboard o reporte que buscas...</p>
                    </div>`;
        return;
    }

    const term = query.toLowerCase().trim();
    // Buscar en el título del enlace o en su carpeta padre
    const results = searchableLinks.filter(item =>
        item.text.toLowerCase().includes(term) || item.path.toLowerCase().includes(term)
    );

    if (results.length === 0) {
        container.innerHTML = `
                    <div class="p-10 text-center text-gray-500">
                        <i class="fas fa-search-minus text-4xl mb-3 text-gray-300"></i>
                        <p>No se encontraron resultados para "<strong class="text-gray-700">${query}</strong>"</p>
                    </div>`;
        return;
    }

    container.innerHTML = results.map((item, i) => {
        // Pintar de azul la palabra que coincide
        const regex = new RegExp(`(${term})`, 'gi');
        const highlightedText = item.text.replace(regex, '<span class="text-blue-600 font-black bg-blue-50">$1</span>');

        return `
                <button id="searchResult-${i}" onclick="executeSearchResult(${item.index})" 
                    class="search-item w-full text-left p-3 hover:bg-white focus:bg-white hover:shadow-md focus:shadow-md border border-transparent hover:border-blue-200 focus:border-blue-400 rounded-xl transition-all mb-1 group flex items-center justify-between outline-none">
                    <div>
                        <p class="text-[10px] text-gray-400 mb-1 font-bold tracking-wider uppercase"><i class="fas fa-folder-open text-gray-300 mr-1"></i> ${item.path}</p>
                        <p class="text-gray-800 font-medium group-hover:text-blue-700">${highlightedText}</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <i class="fas fa-arrow-right text-gray-400 group-hover:text-blue-600"></i>
                    </div>
                </button>
                `;
    }).join('');
}

// 3. Simular el clic en el menú real
function executeSearchResult(realIndex) {
    closeSearchModal();
    const linkTarget = searchableLinks[realIndex].element;

    // Simula exactamente como si el usuario hubiera clickeado el menú con su mouse
    if (linkTarget) {
        linkTarget.click();
    }
}

// 4. Atajos de teclado (Navegación con flechas, Enter y Ctrl+K)
document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('searchModal');
    const isModalOpen = !modal.classList.contains('hidden');

    // Abrir con Ctrl+K o Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isModalOpen ? closeSearchModal() : openSearchModal();
    }

    if (isModalOpen) {
        if (e.key === 'Escape') closeSearchModal();

        // Navegar con flechas arriba/abajo
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
    }
});
