/**
 * Módulo para CP13 EvolucionCosto (Evolución del Costo Mensual por Línea & Costo por Granja Línea)
 * Réplica exacta de Tableau:
 * - Tabla 1 (Izquierda): "Evolución del Costo Mensual por Línea"
 *   - Clasificación con dos subfilas por mes:
 *     1) CU Mensual: En color salmón/rojo (#e15759).
 *     2) Diferencia Mes Anterior: Negativo en Verde (#16a34a), Positivo en Morado (#af7aa1).
 * - Tabla 2 (Derecha): "Costo por Granja Línea"
 *   - Clasificación, Cencos, Nomcencos y 3 columnas por cada mes (Valor, Kg Vendidos, CU Mensual).
 * - Cabeceras de tabla con diseño institucional: bg-blue-600 con texto blanco.
 * - Sincronización interactiva: Clic en cualquier fila de la Tabla 1 filtra el detalle de la Tabla 2.
 * - Soporte para filtro multiselect de Clasificación y rango dinámico de meses.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP13 EvolucionCosto'] = {
    multiClasif: null,
    periodos: [],
    datosEvolucion: [],
    datosDetalle: [],
    clasifFiltroActivo: null,
    detalleFiltrado: [],
    paginaActualDetalle: 1,
    filasPorPaginaDetalle: 150,

    render(controller, data) {
        // 1. Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Evolución del Costo Mensual por Línea & Costo por Granja Línea';

        // Ocultar filtros de otros reportes
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const contFiltroClasifCP12 = document.getElementById('contenedor-filtro-clasificacion-cp12');
        if (contFiltroClasifCP12) contFiltroClasifCP12.classList.add('hidden');

        const contFiltroGranjaCP14 = document.getElementById('contenedor-filtro-granja-cp14');
        if (contFiltroGranjaCP14) contFiltroGranjaCP14.classList.add('hidden');

        const contFiltroGalponCP14 = document.getElementById('contenedor-filtro-galpon-cp14');
        if (contFiltroGalponCP14) contFiltroGalponCP14.classList.add('hidden');

        const contFiltroClasifCP14 = document.getElementById('contenedor-filtro-clasificacion-cp14');
        if (contFiltroClasifCP14) contFiltroClasifCP14.classList.add('hidden');

        // Mostrar filtro de Clasificación exclusivo de CP13
        const contFiltroClasifCP13 = document.getElementById('contenedor-filtro-clasificacion-cp13');
        if (contFiltroClasifCP13) contFiltroClasifCP13.classList.remove('hidden');

        // Ocultar tabla inferior tradicional
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }

        // 2. Inicializar / Actualizar CustomMultiSelect de Clasificación
        if (data.catalogo_clasificaciones) {
            this.initMultiSelect(controller, data.catalogo_clasificaciones);
        }

        // 3. Guardar estado
        this.periodos = data.periodos || [];
        this.datosEvolucion = data.tabla_evolucion || [];
        this.datosDetalle = data.tabla_detalle || [];
        this.clasifFiltroActivo = null;
        this.paginaActualDetalle = 1;

        // 4. Badges Superiores (Limpios sin pastillas)
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        // 5. Renderizar el layout dual
        this.renderLayoutDual(controller);
    },

    initMultiSelect(controller, catalogo) {
        if (!window.CustomMultiSelect) return;

        const options = catalogo.map(c => ({
            id: c.clasificacion,
            label: c.clasificacion,
            selected: true
        }));

        if (!this.multiClasif) {
            this.multiClasif = new CustomMultiSelect({
                btnId: 'btn-dropdown-clasificacion-cp13',
                labelId: 'label-clasificacion-cp13',
                dropdownId: 'dropdown-clasificacion-cp13',
                searchId: 'search-clasificacion-cp13',
                optionsContainerId: 'container-options-clasificacion-cp13',
                title: 'Clasificación',
                options: options
            });
        } else {
            this.multiClasif.options = options;
            this.multiClasif.updateLabel();
            this.multiClasif.render();
        }
    },

    getSelectedFilters() {
        if (this.multiClasif && typeof this.multiClasif.getSelectedIds === 'function') {
            const ids = this.multiClasif.getSelectedIds();
            const total = this.multiClasif.options.length;
            if (ids.length === total || ids.length === 0) {
                return null;
            }
            return ids;
        }
        return null;
    },

    renderLayoutDual(controller) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.className = "flex flex-col w-full p-2 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <div class="flex flex-col xl:flex-row items-stretch gap-3.5 w-full">
                
                <!-- TABLA 1: EVOLUCION DEL COSTO MENSUAL POR LINEA (IZQUIERDA ~45%) -->
                <div class="w-full xl:w-[46%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div>
                            <h2 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Evolución del Costo Mensual por Línea</h2>
                            <p class="text-[10px] text-slate-500 font-normal">CU Mensual y Diferencia respecto al mes anterior</p>
                        </div>
                    </div>

                    <!-- Contenedor Scrollable Tabla 1 -->
                    <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                        <table class="w-full text-[11px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th class="px-3 py-2.5 text-left border-r border-blue-500/60 font-semibold tracking-wide min-w-[150px]">Clasificacion</th>
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 font-semibold tracking-wide min-w-[125px]">Medida</th>
                                    ${this.periodos.map(p => `
                                        <th class="px-2.5 py-2.5 text-right border-r border-blue-500/60 font-semibold tracking-wide min-w-[75px] capitalize">
                                            ${p.nombre_mes}
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody id="tbody-evolucion-cp13" class="divide-y divide-slate-200 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TABLA 2: COSTO POR GRANJA LINEA (DERECHA ~55%) -->
                <div class="w-full xl:w-[54%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div class="flex items-center gap-2">
                            <div>
                                <h2 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo por Granja Línea</h2>
                                <p id="subtitulo-detalle-cp13" class="text-[10px] text-slate-500 font-normal">Todas las clasificaciones</p>
                            </div>
                            <button id="btn-limpiar-filtro-cp13" type="button"
                                    class="hidden px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors cursor-pointer">
                                Ver todo
                            </button>
                        </div>
                    </div>

                    <!-- Contenedor Scrollable Tabla 2 -->
                    <div id="contenedor-scroll-detalle-cp13" class="flex-1 overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                        <table class="w-full text-[10.5px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th rowspan="2" class="px-2.5 py-2 text-left border-r border-b border-blue-500/60 font-semibold tracking-wide min-w-[130px] align-middle">Clasificacion</th>
                                    <th rowspan="2" class="px-2 py-2 text-left border-r border-b border-blue-500/60 font-mono font-semibold tracking-wide min-w-[60px] align-middle">cencos</th>
                                    <th rowspan="2" class="px-2.5 py-2 text-left border-r border-b border-blue-500/60 font-semibold tracking-wide min-w-[120px] align-middle">Granja</th>
                                    ${this.periodos.map(p => `
                                        <th colspan="3" class="px-2 py-1 text-center border-r border-b border-blue-500/60 font-semibold tracking-wide capitalize">
                                            ${p.nombre_mes}
                                        </th>
                                    `).join('')}
                                </tr>
                                <tr>
                                    ${this.periodos.map(() => `
                                        <th class="px-2 py-1.5 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[80px]">Valor</th>
                                        <th class="px-2 py-1.5 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[75px]">Kg Vendidos</th>
                                        <th class="px-2 py-1.5 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[70px]">CU Mensual</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody id="tbody-detalle-cp13" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                        </table>
                    </div>

                    <!-- Paginación / Contador Inferior Tabla 2 -->
                    <div id="paginacion-detalle-cp13" class="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600">
                        <!-- Generado dinámicamente -->
                    </div>
                </div>

            </div>
        `;

        // 6. Vincular eventos
        this.setupListeners(controller);

        // 7. Renderizar contenidos
        this.renderTablaEvolucion();
        this.filtrarYRenderizarDetalle();
    },

    setupListeners(controller) {
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp13');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.seleccionarClasificacion(null);
            });
        }
    },

    renderTablaEvolucion() {
        const tbody = document.getElementById('tbody-evolucion-cp13');
        if (!tbody) return;

        const items = this.datosEvolucion;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${2 + this.periodos.length}" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron clasificaciones</td></tr>`;
            return;
        }

        let html = '';
        items.forEach(r => {
            const isSelected = (this.clasifFiltroActivo === r.clasificacion);
            const blockClass = isSelected
                ? 'bg-slate-100/90 font-semibold'
                : 'hover:bg-slate-50/70 transition-colors';

            const clasifEscaped = r.clasificacion.replace(/'/g, "\\'");

            // Fila 1: CU Mensual (en rojo/salmón)
            let row1Cols = '';
            // Fila 2: Diferencia Mes Anterior (negativo en verde, positivo en rojo)
            let row2Cols = '';

            this.periodos.forEach((p, idx) => {
                const mesKey = p.key;
                const mData = (r.meses && r.meses[mesKey]) ? r.meses[mesKey] : { valor: 0, cu_mensual: 0, dif_mes_anterior: null };
                
                const cu = Number(mData.cu_mensual || 0);
                const cuStr = cu.toFixed(3).replace('.', ',');

                row1Cols += `
                    <td class="px-2 py-1 text-right font-mono font-semibold text-[#e15759] border-r border-slate-200">
                        ${cuStr}
                    </td>
                `;

                const dif = mData.dif_mes_anterior;
                if (idx === 0 || dif === null || dif === undefined) {
                    row2Cols += `
                        <td class="px-2 py-1 text-right font-mono text-slate-300 border-r border-slate-200">
                            -
                        </td>
                    `;
                } else {
                    const difNum = Number(dif);
                    const difStr = difNum.toFixed(3).replace('.', ',');
                    let difColor = 'text-slate-500';
                    if (difNum < 0) {
                        difColor = 'text-[#16a34a] font-semibold'; // Reducción de costo (Verde)
                    } else if (difNum > 0) {
                        difColor = 'text-[#e15759] font-semibold'; // Incremento de costo (Rojo)
                    }

                    row2Cols += `
                        <td class="px-2 py-1 text-right font-mono ${difColor} border-r border-slate-200">
                            ${difStr}
                        </td>
                    `;
                }
            });

            html += `
                <!-- Fila 1: CU Mensual -->
                <tr class="${blockClass} cursor-pointer border-t border-slate-200" onclick="window.ChartRegistry['CP13 EvolucionCosto'].seleccionarClasificacion('${clasifEscaped}')">
                    <td rowspan="2" class="px-3 py-2 text-left border-r border-slate-300 font-medium text-slate-800 align-middle ${isSelected ? 'text-slate-900 font-bold border-l-4 border-l-slate-700' : ''}">
                        ${r.clasificacion}
                    </td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 text-slate-700 font-medium whitespace-nowrap">
                        CU Mensual
                    </td>
                    ${row1Cols}
                </tr>
                <!-- Fila 2: Diferencia Mes Anterior -->
                <tr class="${blockClass} cursor-pointer border-b border-slate-300" onclick="window.ChartRegistry['CP13 EvolucionCosto'].seleccionarClasificacion('${clasifEscaped}')">
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 text-slate-500 font-normal whitespace-nowrap">
                        Diferencia Mes Anterior
                    </td>
                    ${row2Cols}
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    seleccionarClasificacion(clasif) {
        if (this.clasifFiltroActivo === clasif) {
            this.clasifFiltroActivo = null;
        } else {
            this.clasifFiltroActivo = clasif;
        }

        this.paginaActualDetalle = 1;
        this.renderTablaEvolucion();
        this.filtrarYRenderizarDetalle();
    },

    filtrarYRenderizarDetalle() {
        const subtitulo = document.getElementById('subtitulo-detalle-cp13');
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp13');

        if (this.clasifFiltroActivo) {
            if (subtitulo) subtitulo.innerHTML = `Filtro: <strong class="text-slate-900">${this.clasifFiltroActivo}</strong>`;
            if (btnLimpiar) btnLimpiar.classList.remove('hidden');
        } else {
            if (subtitulo) subtitulo.textContent = 'Todas las clasificaciones';
            if (btnLimpiar) btnLimpiar.classList.add('hidden');
        }

        let items = this.datosDetalle;

        if (this.clasifFiltroActivo) {
            const target = this.clasifFiltroActivo;
            items = this.datosDetalle.filter(r => r.clasificacion === target);
        }

        this.detalleFiltrado = items;
        this.renderPaginaDetalle();
    },

    renderPaginaDetalle() {
        const tbody = document.getElementById('tbody-detalle-cp13');
        const pagContainer = document.getElementById('paginacion-detalle-cp13');
        if (!tbody) return;

        const totalItems = this.detalleFiltrado.length;
        const totalPaginas = Math.ceil(totalItems / this.filasPorPaginaDetalle) || 1;

        if (this.paginaActualDetalle > totalPaginas) this.paginaActualDetalle = totalPaginas;
        if (this.paginaActualDetalle < 1) this.paginaActualDetalle = 1;

        const startIdx = (this.paginaActualDetalle - 1) * this.filasPorPaginaDetalle;
        const endIdx = Math.min(startIdx + this.filasPorPaginaDetalle, totalItems);
        const pageRows = this.detalleFiltrado.slice(startIdx, endIdx);

        const totalCols = 3 + (this.periodos.length * 3);

        if (pageRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${totalCols}" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron registros de detalle</td></tr>`;
            if (pagContainer) pagContainer.innerHTML = '';
            return;
        }

        let html = '';
        pageRows.forEach(r => {
            let mesesHtml = '';

            this.periodos.forEach(p => {
                const mesKey = p.key;
                const mData = (r.meses && r.meses[mesKey]) ? r.meses[mesKey] : { valor: 0, kg_vendidos: 0, cu_mensual: 0 };
                
                const valStr = Number(mData.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const kgStr = Number(mData.kg_vendidos).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                const cuStr = Number(mData.cu_mensual).toFixed(3).replace('.', ',');

                mesesHtml += `
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-800">
                        S/ ${valStr}
                    </td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-500">
                        ${kgStr}
                    </td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-medium text-slate-800">
                        ${cuStr}
                    </td>
                `;
            });

            html += `
                <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-100">
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">${r.clasificacion}</td>
                    <td class="px-2 py-1 text-left border-r border-slate-200 font-mono text-slate-800 whitespace-nowrap">${r.cencos}</td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">${r.nomcencos}</td>
                    ${mesesHtml}
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Renderizar controles de paginación
        if (pagContainer) {
            pagContainer.innerHTML = `
                <div>
                    Mostrando <strong class="text-slate-800">${(startIdx + 1).toLocaleString('es-PE')}</strong> a <strong class="text-slate-800">${endIdx.toLocaleString('es-PE')}</strong> de <strong class="text-slate-800">${totalItems.toLocaleString('es-PE')}</strong> filas
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.ChartRegistry['CP13 EvolucionCosto'].cambiarPagina(1)"
                            ${this.paginaActualDetalle === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &laquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP13 EvolucionCosto'].cambiarPagina(${this.paginaActualDetalle - 1})"
                            ${this.paginaActualDetalle === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &lsaquo;
                    </button>
                    <span class="px-2 py-0.5 text-slate-700 font-semibold">Pág. ${this.paginaActualDetalle} de ${totalPaginas}</span>
                    <button type="button" onclick="window.ChartRegistry['CP13 EvolucionCosto'].cambiarPagina(${this.paginaActualDetalle + 1})"
                            ${this.paginaActualDetalle === totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &rsaquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP13 EvolucionCosto'].cambiarPagina(${totalPaginas})"
                            ${this.paginaActualDetalle === totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &raquo;
                    </button>
                </div>
            `;
        }
    },

    cambiarPagina(nuevaPag) {
        this.paginaActualDetalle = nuevaPag;
        this.renderPaginaDetalle();
        const contScroll = document.getElementById('contenedor-scroll-detalle-cp13');
        if (contScroll) contScroll.scrollTop = 0;
    }
};
