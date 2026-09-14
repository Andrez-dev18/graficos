/**
 * Módulo para CP12 ParetoCP (Pareto del Costo & Costo por Granja Galpon Linea)
 * Réplica exacta de Tableau:
 * - Tabla 1 (Izquierda): "Pareto del Costo" agrupado por Clasificación con Valor, Kg Vendidos y CU Mensual.
 * - Tabla 2 (Derecha): "Costo por Granja Galpon Linea" con desglose jerárquico y subtotales por Galpón y Cencos.
 * - Filtro multiselect dinámico de Clasificación en la barra de filtros superior.
 * - Cabeceras de tabla con estilo institucional: bg-blue-600 y text-white.
 * - Sincronización interactiva: Clic en cualquier fila de Pareto filtra el detalle inmediatamente.
 * - Paginación y renderizado fluido para navegar entre miles de filas sin congelamientos.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP12 ParetoCP'] = {
    multiClasif: null,
    datosPareto: [],
    datosDetalle: [],
    totalesPareto: null,
    totalKg: 0,
    clasifFiltroActivo: null,
    detalleFiltrado: [],
    paginaActualDetalle: 1,
    filasPorPaginaDetalle: 200,

    render(controller, data) {
        // 1. Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Pareto del Costo & Costo por Granja Galpón Línea';

        // Ocultar filtros tradicionales y de otros reportes
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const contFiltroGranjaCP14 = document.getElementById('contenedor-filtro-granja-cp14');
        if (contFiltroGranjaCP14) contFiltroGranjaCP14.classList.add('hidden');

        const contFiltroGalponCP14 = document.getElementById('contenedor-filtro-galpon-cp14');
        if (contFiltroGalponCP14) contFiltroGalponCP14.classList.add('hidden');

        const contFiltroClasifCP14 = document.getElementById('contenedor-filtro-clasificacion-cp14');
        if (contFiltroClasifCP14) contFiltroClasifCP14.classList.add('hidden');

        // Mostrar filtro de Clasificación exclusivo de CP12
        const contFiltroClasifCP12 = document.getElementById('contenedor-filtro-clasificacion-cp12');
        if (contFiltroClasifCP12) contFiltroClasifCP12.classList.remove('hidden');

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
        this.datosPareto = data.tabla_pareto || [];
        this.datosDetalle = data.tabla_detalle || [];
        this.totalesPareto = data.totales_pareto || null;
        this.totalKg = data.total_kg_vendidos || 0;
        this.clasifFiltroActivo = null;
        this.paginaActualDetalle = 1;

        // 4. Badges Superiores
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md shadow-2xs">
                        <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                        Líneas Pareto: <strong class="text-blue-800">${this.datosPareto.length}</strong>
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md shadow-2xs">
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Kg Vendidos: <strong class="text-emerald-700">${Number(this.totalKg).toLocaleString('es-PE', { maximumFractionDigits: 0 })} kg</strong>
                    </span>
                </div>
            `;
        }

        // 5. Renderizar el lienzo de dos tablas
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
                btnId: 'btn-dropdown-clasificacion-cp12',
                labelId: 'label-clasificacion-cp12',
                dropdownId: 'dropdown-clasificacion-cp12',
                searchId: 'search-clasificacion-cp12',
                optionsContainerId: 'container-options-clasificacion-cp12',
                title: 'Clasificación',
                options: options
            });
        } else {
            // Actualizar opciones existentes si cambió el período
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
                return null; // Todos seleccionados o ninguno
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
            <div class="flex flex-col lg:flex-row items-stretch gap-3 w-full">
                
                <!-- TABLA 1: PARETO DEL COSTO (IZQUIERDA) -->
                <div class="w-full lg:w-[42%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div>
                            <h2 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Pareto del Costo</h2>
                            <p class="text-[10px] text-slate-500 font-normal">Resumen de costos por clasificación</p>
                        </div>
                    </div>

                    <!-- Contenedor Scrollable Tabla 1 -->
                    <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[620px] custom-scrollbar">
                        <table class="w-full text-[11px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th class="px-3 py-2.5 text-left border-r border-blue-500/60 font-semibold tracking-wide">Clasificacion</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500/60 font-semibold tracking-wide">Valor</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500/60 font-semibold tracking-wide">Kg Vendidos</th>
                                    <th class="px-3 py-2.5 text-right font-semibold tracking-wide">CU Mensual</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-pareto-cp12" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                            <tfoot id="tfoot-pareto-cp12" class="sticky bottom-0 z-20 bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400 shadow-2xs">
                                <!-- Generado dinámicamente -->
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- TABLA 2: COSTO POR GRANJA GALPON LINEA (DERECHA) -->
                <div class="w-full lg:w-[58%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div class="flex items-center gap-2">
                            <div>
                                <h2 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo por Granja Galpon Linea</h2>
                                <p id="subtitulo-detalle-cp12" class="text-[10px] text-slate-500 font-normal">Todas las clasificaciones</p>
                            </div>
                            <button id="btn-limpiar-filtro-cp12" type="button"
                                    class="hidden px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer">
                                Ver todo
                            </button>
                        </div>
                    </div>

                    <!-- Contenedor Scrollable Tabla 2 -->
                    <div id="contenedor-scroll-detalle-cp12" class="flex-1 overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
                        <table class="w-full text-[10.5px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 font-semibold tracking-wide">Clasificacion</th>
                                    <th class="px-2 py-2.5 text-left border-r border-blue-500/60 font-mono font-semibold tracking-wide">cencos</th>
                                    <th class="px-1.5 py-2.5 text-center border-r border-blue-500/60 font-semibold tracking-wide">gal..</th>
                                    <th class="px-2 py-2.5 text-left border-r border-blue-500/60 font-mono font-semibold tracking-wide">tcodigo</th>
                                    <th class="px-3 py-2.5 text-left border-r border-blue-500/60 font-semibold tracking-wide">nomcodigo</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500/60 font-semibold tracking-wide">Valor</th>
                                    <th class="px-2.5 py-2.5 text-right border-r border-blue-500/60 font-semibold tracking-wide">Kg Vendidos</th>
                                    <th class="px-2.5 py-2.5 text-right font-semibold tracking-wide">CU Mensual</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-detalle-cp12" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                        </table>
                    </div>

                    <!-- Paginación / Contador Inferior Tabla 2 -->
                    <div id="paginacion-detalle-cp12" class="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600">
                        <!-- Generado dinámicamente -->
                    </div>
                </div>

            </div>
        `;

        // 6. Vincular eventos
        this.setupListeners(controller);

        // 7. Dibujar contenidos iniciales
        this.renderTablaPareto();
        this.filtrarYRenderizarDetalle();
    },

    setupListeners(controller) {
        // Botón limpiar filtro de clasificación
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp12');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.seleccionarClasificacion(null);
            });
        }
    },

    renderTablaPareto() {
        const tbody = document.getElementById('tbody-pareto-cp12');
        const tfoot = document.getElementById('tfoot-pareto-cp12');
        if (!tbody) return;

        const items = this.datosPareto;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron clasificaciones</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let html = '';
        items.forEach(r => {
            const isSelected = (this.clasifFiltroActivo === r.clasificacion);
            const rowClass = isSelected
                ? 'bg-blue-50 font-semibold border-l-4 border-l-blue-600'
                : 'hover:bg-slate-50/80 transition-colors cursor-pointer';

            const valorStr = Number(r.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const kgStr = Number(r.kg_vendidos).toLocaleString('es-PE', { maximumFractionDigits: 0 });
            const cuStr = Number(r.cu_mensual).toFixed(3).replace('.', ',');

            html += `
                <tr class="${rowClass}" onclick="window.ChartRegistry['CP12 ParetoCP'].seleccionarClasificacion('${r.clasificacion.replace(/'/g, "\\'")}')">
                    <td class="px-3 py-1.5 text-left border-r border-slate-100 text-slate-800 ${isSelected ? 'text-blue-800 font-bold' : ''}">
                        ${r.clasificacion}
                    </td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 text-slate-700">
                        S/ ${valorStr}
                    </td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 text-slate-500">
                        ${kgStr}
                    </td>
                    <td class="px-3 py-1.5 text-right font-mono font-semibold text-slate-800">
                        ${cuStr}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Fila Total General
        if (tfoot && this.totalesPareto) {
            const t = this.totalesPareto;
            const tValorStr = Number(t.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const tKgStr = Number(t.kg_vendidos).toLocaleString('es-PE', { maximumFractionDigits: 0 });
            const tCuStr = Number(t.cu_mensual).toFixed(3).replace('.', ',');

            tfoot.innerHTML = `
                <tr>
                    <td class="px-3 py-2 text-left border-r border-slate-300 uppercase">${t.clasificacion}</td>
                    <td class="px-3 py-2 text-right font-mono border-r border-slate-300 text-blue-900 font-bold">S/ ${tValorStr}</td>
                    <td class="px-3 py-2 text-right font-mono border-r border-slate-300 text-slate-700">${tKgStr}</td>
                    <td class="px-3 py-2 text-right font-mono text-blue-900 font-bold">${tCuStr}</td>
                </tr>
            `;
        }
    },

    seleccionarClasificacion(clasif) {
        if (this.clasifFiltroActivo === clasif) {
            this.clasifFiltroActivo = null; // Toggle para desmarcar
        } else {
            this.clasifFiltroActivo = clasif;
        }

        this.paginaActualDetalle = 1;
        this.renderTablaPareto();
        this.filtrarYRenderizarDetalle();
    },

    filtrarYRenderizarDetalle() {
        const subtitulo = document.getElementById('subtitulo-detalle-cp12');
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp12');

        if (this.clasifFiltroActivo) {
            if (subtitulo) subtitulo.innerHTML = `Filtro: <strong class="text-blue-700">${this.clasifFiltroActivo}</strong>`;
            if (btnLimpiar) btnLimpiar.classList.remove('hidden');
        } else {
            if (subtitulo) subtitulo.textContent = 'Todas las clasificaciones';
            if (btnLimpiar) btnLimpiar.classList.add('hidden');
        }

        // Filtrar datos de la tabla detalle
        let items = this.datosDetalle;

        if (this.clasifFiltroActivo) {
            const clasifTarget = this.clasifFiltroActivo;
            let currentClasif = '';
            items = this.datosDetalle.filter(r => {
                if (r.clasificacion) currentClasif = r.clasificacion;
                return currentClasif === clasifTarget;
            });
        }

        this.detalleFiltrado = items;
        this.renderPaginaDetalle();
    },

    renderPaginaDetalle() {
        const tbody = document.getElementById('tbody-detalle-cp12');
        const pagContainer = document.getElementById('paginacion-detalle-cp12');
        if (!tbody) return;

        const totalItems = this.detalleFiltrado.length;
        const totalPaginas = Math.ceil(totalItems / this.filasPorPaginaDetalle) || 1;

        if (this.paginaActualDetalle > totalPaginas) this.paginaActualDetalle = totalPaginas;
        if (this.paginaActualDetalle < 1) this.paginaActualDetalle = 1;

        const startIdx = (this.paginaActualDetalle - 1) * this.filasPorPaginaDetalle;
        const endIdx = Math.min(startIdx + this.filasPorPaginaDetalle, totalItems);
        const pageRows = this.detalleFiltrado.slice(startIdx, endIdx);

        if (pageRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron registros de detalle</td></tr>`;
            if (pagContainer) pagContainer.innerHTML = '';
            return;
        }

        let html = '';
        pageRows.forEach(r => {
            const valorStr = Number(r.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const kgStr = Number(r.kg_vendidos).toLocaleString('es-PE', { maximumFractionDigits: 0 });
            const cuStr = Number(r.cu_mensual).toFixed(3).replace('.', ',');

            if (r.tipo_fila === 'subtotal_cencos') {
                html += `
                    <tr class="bg-slate-100/90 font-bold text-slate-900 border-b-2 border-slate-300">
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2 py-1.5 border-r border-slate-200 font-bold text-slate-700 uppercase">Total</td>
                        <td class="px-1.5 py-1.5 border-r border-slate-200 text-center"></td>
                        <td class="px-2 py-1.5 border-r border-slate-200 font-mono"></td>
                        <td class="px-3 py-1.5 border-r border-slate-200 font-semibold text-slate-600">${r.nomcencos ? `Total ${r.nomcencos}` : ''}</td>
                        <td class="px-3 py-1.5 text-right font-mono border-r border-slate-200 text-blue-900">S/ ${valorStr}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 text-slate-600">${kgStr}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono text-blue-900 font-bold">${cuStr}</td>
                    </tr>
                `;
            } else if (r.tipo_fila === 'subtotal_galpon') {
                html += `
                    <tr class="bg-slate-50/90 font-semibold text-slate-800 border-b border-slate-200">
                        <td class="px-2.5 py-1 border-r border-slate-200"></td>
                        <td class="px-2 py-1 border-r border-slate-200 font-mono"></td>
                        <td class="px-1.5 py-1 border-r border-slate-200 text-center font-bold text-slate-600">Total</td>
                        <td class="px-2 py-1 border-r border-slate-200 font-mono"></td>
                        <td class="px-3 py-1 border-r border-slate-200"></td>
                        <td class="px-3 py-1 text-right font-mono border-r border-slate-200 text-slate-900 font-bold">S/ ${valorStr}</td>
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-200 text-slate-500">${kgStr}</td>
                        <td class="px-2.5 py-1 text-right font-mono text-slate-800 font-semibold">${cuStr}</td>
                    </tr>
                `;
            } else {
                html += `
                    <tr class="hover:bg-slate-50/70 transition-colors">
                        <td class="px-2.5 py-1 text-left border-r border-slate-100 font-medium text-slate-700 whitespace-nowrap">${r.clasificacion}</td>
                        <td class="px-2 py-1 text-left border-r border-slate-100 font-mono text-slate-800 whitespace-nowrap" title="${r.nomcencos || ''}">${r.cencos}</td>
                        <td class="px-1.5 py-1 text-center border-r border-slate-100 font-medium text-slate-700">${r.galpon}</td>
                        <td class="px-2 py-1 text-left border-r border-slate-100 font-mono text-slate-600">${r.tcodigo}</td>
                        <td class="px-3 py-1 text-left border-r border-slate-100 text-slate-700 max-w-[200px] truncate" title="${r.nomcodigo || ''}">${r.nomcodigo}</td>
                        <td class="px-3 py-1 text-right font-mono border-r border-slate-100 text-slate-800">S/ ${valorStr}</td>
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-500">${kgStr}</td>
                        <td class="px-2.5 py-1 text-right font-mono font-medium text-slate-700">${cuStr}</td>
                    </tr>
                `;
            }
        });

        tbody.innerHTML = html;

        // Renderizar controles de paginación
        if (pagContainer) {
            pagContainer.innerHTML = `
                <div>
                    Mostrando <strong class="text-slate-800">${(startIdx + 1).toLocaleString('es-PE')}</strong> a <strong class="text-slate-800">${endIdx.toLocaleString('es-PE')}</strong> de <strong class="text-slate-800">${totalItems.toLocaleString('es-PE')}</strong> filas
                </div>
                <div class="flex items-center gap-1.5">
                    <button type="button" onclick="window.ChartRegistry['CP12 ParetoCP'].cambiarPagina(1)"
                            ${this.paginaActualDetalle === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &laquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP12 ParetoCP'].cambiarPagina(${this.paginaActualDetalle - 1})"
                            ${this.paginaActualDetalle === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &lsaquo;
                    </button>
                    <span class="px-2 py-0.5 text-slate-700 font-semibold">Pág. ${this.paginaActualDetalle} de ${totalPaginas}</span>
                    <button type="button" onclick="window.ChartRegistry['CP12 ParetoCP'].cambiarPagina(${this.paginaActualDetalle + 1})"
                            ${this.paginaActualDetalle === totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &rsaquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP12 ParetoCP'].cambiarPagina(${totalPaginas})"
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
        const contScroll = document.getElementById('contenedor-scroll-detalle-cp12');
        if (contScroll) contScroll.scrollTop = 0;
    }
};
