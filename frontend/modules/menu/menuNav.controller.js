class MenuNavController {
    constructor() {
        this.navContainer = document.getElementById('navMenuPrincipal');
    }

    async init() {
        if (!this.navContainer) return;

        const response = await AuthService.obtenerMenu();

        if (response.success && response.data && response.data.length > 0) {
            // 1. Filtrar los módulos que NO sean de tipo 'main' para el menú lateral
            this.renderizarMenu(response.data);

            // 2. Determinar la pantalla inicial del rol (Prioridad: tipo 'main', si no, el primer item del menú)
            const moduloMain = this.buscarModuloMain(response.data);
            const primerItem = this.obtenerPrimerModuloNavegable(response.data);
            const moduloInicial = moduloMain || primerItem;

            if (moduloInicial) {
                window.moduloInicialPorDefecto = moduloInicial;
            }

            const lastUrl = sessionStorage.getItem('last_dashboard_url');
            const params = new URLSearchParams(window.location.search);

            // 3. Cargar la vista inicial si no hay sesión previa guardada tras F5
            if (lastUrl) {
                this.restaurarMenuActivo();
            } else if (!params.has('vista') && moduloInicial) {
                const url = moduloInicial.url;
                const param = moduloInicial.tipo_param || '';
                const titulo = moduloInicial.titulo || moduloInicial.nom_mod;

                if (typeof loadDashboardAndData === 'function') {
                    loadDashboardAndData(url, param, titulo);
                }

                if (moduloInicial.tipo !== 'main') {
                    this.seleccionarModuloPorUrl(url);
                }
            }
        } else {
            this.navContainer.innerHTML = `
                <div class="text-center p-4 text-gray-400 text-sm">
                    No tienes módulos asignados.
                </div>
            `;
        }
    }

    buscarModuloMain(nodos) {
        if (!nodos || !Array.isArray(nodos)) return null;

        for (const nodo of nodos) {
            if (nodo.tipo === 'main') {
                return nodo;
            }
            if (nodo.children && nodo.children.length > 0) {
                const encontrado = this.buscarModuloMain(nodo.children);
                if (encontrado) return encontrado;
            }
        }
        return null;
    }

    obtenerPrimerModuloNavegable(nodos) {
        if (!nodos || !Array.isArray(nodos)) return null;

        for (const nodo of nodos) {
            if (nodo.tipo !== 'group' && nodo.tipo !== 'main' && nodo.url && nodo.url !== '#' && nodo.url.trim() !== '') {
                return nodo;
            }
            if (nodo.children && nodo.children.length > 0) {
                const encontrado = this.obtenerPrimerModuloNavegable(nodo.children);
                if (encontrado) return encontrado;
            }
        }
        return null;
    }

    renderizarMenu(menuData) {
        // Filtramos para que NUNCA aparezcan en el menú lateral los módulos de tipo 'main'
        const modulosVisibles = menuData.filter(nodo => nodo.tipo !== 'main');

        let html = `
            <div class="mb-4">
                <p class="text-blue-300 text-xs uppercase font-semibold mb-2 px-3">Dashboards</p>
            </div>
        `;

        // Recorremos el Nivel 1 (Grupos principales y módulos visibles)
        modulosVisibles.forEach(nodoPrincipal => {
            html += this.crearGrupoPrincipal(nodoPrincipal);
        });

        // Inyectamos todo al DOM
        this.navContainer.innerHTML = html;

        // Llamamos a tu función de numeración DESPUÉS de pintar el menú
        if (typeof autoNumerarMenus === 'function') {
            autoNumerarMenus();
        }
    }

    seleccionarModuloPorUrl(url) {
        if (!url) return;
        const links = document.querySelectorAll('.menu-link');
        let activeLink = null;

        for (const link of links) {
            const onclickAttr = link.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes(url)) {
                activeLink = link;
                break;
            }
        }

        if (activeLink) {
            if (typeof selectMenuItem === 'function') {
                selectMenuItem(activeLink);
            }

            let currentNode = activeLink;
            while (currentNode) {
                if (currentNode.classList && currentNode.classList.contains('submenu')) {
                    currentNode.classList.remove('hidden');
                    const btnPadre = currentNode.previousElementSibling;
                    if (btnPadre && (btnPadre.tagName === 'BUTTON')) {
                        const flechaAbajo = btnPadre.querySelector('.fa-chevron-down');
                        const flechaDerecha = btnPadre.querySelector('.fa-chevron-right');

                        if (flechaAbajo) flechaAbajo.classList.add('rotate-180');
                        if (flechaDerecha) flechaDerecha.classList.add('rotate-90');
                    }
                }
                if (currentNode.id === 'navMenuPrincipal') break;
                currentNode = currentNode.parentElement;
            }

            setTimeout(() => {
                activeLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }

    restaurarMenuActivo() {
        const lastUrl = sessionStorage.getItem('last_dashboard_url');
        if (!lastUrl) return;
        this.seleccionarModuloPorUrl(lastUrl);
    }

    crearGrupoPrincipal(nodo) {
        const icono = nodo.icono || 'fa-solid fa-folder';

        let hijosHtml = '';
        if (nodo.children && nodo.children.length > 0) {
            nodo.children.forEach(hijo => {
                hijosHtml += this.crearSubnivel(hijo);
            });
        }

        return `
        <div id="${nodo.cod_mod}" class="menu-group">
            <button class="menu-item flex items-center justify-between w-full px-4 py-3 text-white rounded-lg"
                onclick="toggleSubmenu('submenu-${nodo.cod_mod}', this)">
                <span class="flex items-center gap-3">
                    <i class="${icono} w-5"></i>
                    <span class="font-medium">${nodo.nom_mod}</span>
                </span>
                <i class="fas fa-chevron-down text-sm"></i>
            </button>
            <div id="submenu-${nodo.cod_mod}" class="submenu hidden pl-10 mt-2 space-y-4">
                ${hijosHtml}
            </div>
        </div>
        `;
    }

    crearSubnivel(nodo) {

        if (nodo.tipo === 'group') {
            const icono = nodo.icono ? `<i class="${nodo.icono}"></i>` : '<i class="fa-solid fa-folder"></i>';
            let hijosHtml = '';

            // Recorremos los hijos y volvemos a llamar a crearSubnivel de forma recursiva
            if (nodo.children && nodo.children.length > 0) {
                nodo.children.forEach(hijo => {
                    hijosHtml += this.crearSubnivel(hijo);
                });
            }

            return `
            <div id="${nodo.cod_mod}" class="text-sm menu-sub-control mt-2">
                <button class="submenu-toggle flex items-center justify-between w-full text-gray-300 hover:text-white py-1"
                    onclick="toggleSubmenu('submenu-${nodo.cod_mod}', this); event.stopPropagation();">
                    <span>${icono} ${nodo.nom_mod}</span>
                    <i class="fas fa-chevron-right text-xs"></i>
                </button>
                <div id="submenu-${nodo.cod_mod}" class="submenu hidden pl-4 mt-2 space-y-2 border-l border-white-600">
                    ${hijosHtml}
                </div>
            </div>
            `;
        }
        // Si el nodo es directamente un enlace final (Sin importar en qué nivel esté)
        else {
            return this.crearEnlaceFinal(nodo);
        }
    }

    crearEnlaceFinal(nodo) {
        // Renderiza el enlace puro de forma limpia con soporte para IDs y parámetros
        const url = nodo.url || '#';
        const param = nodo.tipo_param || '';
        const titulo = nodo.titulo || nodo.nom_mod;
        const icono = nodo.icono ? `<i class="${nodo.icono}"></i>` : '<i class="fa-link fa-solid"></i>';

        return `
        <div id="${nodo.cod_mod}" class="text-sm menu-sub-control">
            <a href="#"
                onclick="selectMenuItem(this); loadDashboardAndData('${url}', '${param}', '${titulo}'); event.stopPropagation();"
                class="menu-link flex items-center justify-between w-full text-gray-400 hover:text-white py-1">
                <span>${icono} ${nodo.nom_mod}</span>
            </a>
        </div>
        `;
    }
}

// 1. Instanciamos la clase (¡Asegúrate de que el nombre coincida con tu class ...!)
window.menuPrincipal = new MenuNavController();

// 2. Inicialización a prueba de balas
if (document.readyState === 'loading') {
    // Si la página SIGUE cargando, esperamos el evento
    document.addEventListener('DOMContentLoaded', () => {
        window.menuPrincipal.init();
    });
} else {
    // Si la página YA cargó (lo normal al estar al final del body), lo disparamos directo
    window.menuPrincipal.init();
}