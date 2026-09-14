/**
 * Módulo para CP11 AnalisisCostoProd (Análisis Costo Mensual Pollo Vivo)
 * Réplica exacta de Tableau:
 * - Banner Superior de KPIs: Valor Total, Kg Vendidos y CU Mes + Leyenda Liquidado (NO: Verde, SI: Azul).
 * - Tabla 1 (Sup. Izquierda ~40%): "Costo por Granja" (cencos, nomcencos, Valor, Prom. kgvendidosgranja, CU Granja).
 * - Tabla 2 (Sup. Derecha ~60%): "Costo por Granja Galpón" (cencos, nomcencos, columnas dinámicas por Galpón).
 * - Tabla 3 (Inferior 100%): "Costo por Granja Galpón Línea" (cencos, nomcencos, Clasificación, columnas dinámicas por Galpón).
 * - Cabeceras de tabla con estilo institucional: bg-blue-600 text-white font-bold.
 * - Sincronización interactiva: Clic en cualquier granja de la Tabla 1 filtra de inmediato las Tablas 2 y 3.
 * - Paginación ágil en la Tabla 3 para un renderizado ultra rápido.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP11 AnalisisCostoProd'] = {
    kpis: null,
    galponesDisponibles: [],
    datosGranjas: [],
    datosGranjaGalpon: [],
    datosGranjaGalponLinea: [],
    cencosFiltroActivo: null,
    lineasFiltradas: [],
    paginaActualLineas: 1,
    filasPorPaginaLineas: 100,

    render(controller, data) {
        // 1. Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Análisis Costo Mensual Pollo Vivo';

        // Ocultar filtros de otros reportes
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const contFiltroClasifCP12 = document.getElementById('contenedor-filtro-clasificacion-cp12');
        if (contFiltroClasifCP12) contFiltroClasifCP12.classList.add('hidden');

        const contFiltroClasifCP13 = document.getElementById('contenedor-filtro-clasificacion-cp13');
        if (contFiltroClasifCP13) contFiltroClasifCP13.classList.add('hidden');

        const contFiltroGranjaCP14 = document.getElementById('contenedor-filtro-granja-cp14');
        if (contFiltroGranjaCP14) contFiltroGranjaCP14.classList.add('hidden');

        const contFiltroGalponCP14 = document.getElementById('contenedor-filtro-galpon-cp14');
        if (contFiltroGalponCP14) contFiltroGalponCP14.classList.add('hidden');

        const contFiltroClasifCP14 = document.getElementById('contenedor-filtro-clasificacion-cp14');
        if (contFiltroClasifCP14) contFiltroClasifCP14.classList.add('hidden');

        // Limpiar badges superiores
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) contenedorBadges.innerHTML = '';

        // Ocultar tabla inferior tradicional
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }

        // 2. Guardar estado
        this.kpis = data.kpis || { total_valor: 0, total_kg: 0, cu_mes: 0, fechames: '' };
        this.galponesDisponibles = data.galpones_disponibles || [];
        this.datosGranjas = data.tabla_granja || [];
        this.datosGranjaGalpon = data.tabla_granja_galpon || [];
        this.datosGranjaGalponLinea = data.tabla_granja_galpon_linea || [];
        this.cencosFiltroActivo = null;
        this.paginaActualLineas = 1;

        // 3. Renderizar layout de 3 tablas
        this.renderLayoutTriple(controller);
    },

    renderLayoutTriple(controller) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const kpiValStr = Number(this.kpis.total_valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const kpiKgStr = Number(this.kpis.total_kg || 0).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
        const kpiCuStr = Number(this.kpis.cu_mes || 0).toFixed(3).replace('.', ',');

        contenedorGrafica.className = "flex flex-col w-full gap-4 p-3 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <!-- 1. BANNER KPI SUPERIOR (TABLEAU REPLICA) -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3.5 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <div class="flex flex-col">
                    
                    <span class="text-[11px] text-slate-500 font-medium">Período: <strong class="text-slate-700">${this.kpis.fechames}</strong></span>
                </div>

                <!-- Métricas Clave -->
                <div class="flex flex-wrap items-center gap-6 sm:gap-10">
                    <div class="flex flex-col items-center sm:items-end">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</span>
                        <span class="text-base font-bold font-mono text-slate-800">S/ ${kpiValStr}</span>
                    </div>
                    <div class="flex flex-col items-center sm:items-end">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kg Vendidos</span>
                        <span class="text-base font-bold font-mono text-slate-700">${kpiKgStr}</span>
                    </div>
                    <div class="flex flex-col items-center sm:items-end">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">CU Mes</span>
                        <span class="text-base font-bold font-mono text-slate-900">${kpiCuStr}</span>
                    </div>
                </div>

                <!-- Leyenda Liquidado -->
                <div class="flex flex-col items-start sm:items-end border-l sm:border-l-0 pl-3 sm:pl-0 border-slate-200">
                    <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">liquidado</span>
                    <div class="flex items-center gap-3 text-xs">
                        <span class="flex items-center gap-1.5 font-semibold text-slate-700">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#16a34a]"></span> NO
                        </span>
                        <span class="flex items-center gap-1.5 font-semibold text-slate-700">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#2563eb]"></span> SI
                        </span>
                    </div>
                </div>
            </div>

            <!-- 2. SECCIÓN SUPERIOR: 2 TABLAS PARALELAS -->
            <div class="flex flex-col lg:flex-row items-stretch gap-4 w-full">
                
                <!-- TABLA 1: COSTO POR GRANJA (IZQUIERDA ~38%) -->
                <div class="w-full lg:w-[38%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div>
                            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo por Granja</h3>
                            <p class="text-[10px] text-slate-500 font-normal">Resumen de costos y liquidación por cencos</p>
                        </div>
                    </div>

                    <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar">
                        <table class="w-full text-[11px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th class="px-2.5 py-2 text-left border-r border-blue-500/60 font-mono font-semibold tracking-wide min-w-[55px]">cencos</th>
                                    <th class="px-2.5 py-2 text-left border-r border-blue-500/60 font-semibold tracking-wide min-w-[120px]">nomcencos</th>
                                    <th class="px-2.5 py-2 text-right border-r border-blue-500/60 font-semibold tracking-wide min-w-[85px]">Valor</th>
                                    <th class="px-2.5 py-2 text-right border-r border-blue-500/60 font-semibold tracking-wide min-w-[85px]">Prom. kgvendidosgranja</th>
                                    <th class="px-2.5 py-2 text-right font-semibold tracking-wide min-w-[65px]">CU Granja</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-granjas-cp11" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TABLA 2: COSTO POR GRANJA GALPON (DERECHA ~62%) -->
                <div class="w-full lg:w-[62%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div class="flex items-center gap-2">
                            <div>
                                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo por Granja Galpon</h3>
                                <p id="subtitulo-granja-galpon-cp11" class="text-[10px] text-slate-500 font-normal">Todas las granjas</p>
                            </div>
                            <button id="btn-limpiar-filtro-cp11" type="button"
                                    class="hidden px-2 py-0.5 text-[10px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors cursor-pointer">
                                Ver todo
                            </button>
                        </div>
                    </div>

                    <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar">
                        <table class="w-full text-[10.5px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th rowspan="2" class="px-2 py-2 text-left border-r border-b border-blue-500/60 font-mono font-semibold tracking-wide min-w-[55px] align-middle">cencos</th>
                                    <th rowspan="2" class="px-2.5 py-2 text-left border-r border-b border-blue-500/60 font-semibold tracking-wide min-w-[120px] align-middle">nomcencos</th>
                                    ${this.galponesDisponibles.map(g => `
                                        <th colspan="3" class="px-2 py-1 text-center border-r border-b border-blue-500/60 font-semibold tracking-wide">
                                            ${g}
                                        </th>
                                    `).join('')}
                                </tr>
                                <tr>
                                    ${this.galponesDisponibles.map(() => `
                                        <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[75px]">Valor</th>
                                        <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[75px]">Prom. kgvendi..</th>
                                        <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[60px]">CU Glpn</th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody id="tbody-granja-galpon-cp11" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <!-- 3. SECCIÓN INFERIOR: TABLA 3 (ANCHO COMPLETO 100%) -->
            <div class="w-full flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                <div class="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 border-b border-slate-300">
                    <div>
                        <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo por Granja Galpon Linea</h3>
                        <p id="subtitulo-lineas-cp11" class="text-[10px] text-slate-500 font-normal">Desglose detallado por clasificación y galpón</p>
                    </div>
                </div>

                <div id="contenedor-scroll-lineas-cp11" class="flex-1 overflow-x-auto overflow-y-auto max-h-[560px] custom-scrollbar">
                    <table class="w-full text-[10.5px] border-collapse font-sans">
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                            <tr>
                                <th rowspan="2" class="px-2 py-2 text-left border-r border-b border-blue-500/60 font-mono font-semibold tracking-wide min-w-[55px] align-middle">cencos</th>
                                <th rowspan="2" class="px-2.5 py-2 text-left border-r border-b border-blue-500/60 font-semibold tracking-wide min-w-[120px] align-middle">nomcencos</th>
                                <th rowspan="2" class="px-3 py-2 text-left border-r border-b border-blue-500/60 font-semibold tracking-wide min-w-[140px] align-middle">Clasificacion</th>
                                ${this.galponesDisponibles.map(g => `
                                    <th colspan="3" class="px-2 py-1 text-center border-r border-b border-blue-500/60 font-semibold tracking-wide">
                                        ${g}
                                    </th>
                                `).join('')}
                            </tr>
                            <tr>
                                ${this.galponesDisponibles.map(() => `
                                    <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[75px]">Valor</th>
                                    <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[75px]">Prom. kgvendi..</th>
                                    <th class="px-2 py-1 text-right border-r border-blue-500/60 font-medium text-[10px] min-w-[60px]">CU Linea</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody id="tbody-lineas-cp11" class="divide-y divide-slate-100 bg-white">
                            <!-- Generado dinámicamente -->
                        </tbody>
                    </table>
                </div>

                <!-- Paginación Inferior Tabla 3 -->
                <div id="paginacion-lineas-cp11" class="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-600">
                    <!-- Generado dinámicamente -->
                </div>
            </div>
        `;

        // 4. Listeners
        this.setupListeners(controller);

        // 5. Renderizar tablas
        this.renderTablaGranjas();
        this.renderTablaGranjaGalpon();
        this.filtrarYRenderizarLineas();
    },

    setupListeners(controller) {
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp11');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.seleccionarGranja(null);
            });
        }
    },

    renderTablaGranjas() {
        const tbody = document.getElementById('tbody-granjas-cp11');
        if (!tbody) return;

        const items = this.datosGranjas;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron granjas</td></tr>`;
            return;
        }

        let html = '';
        items.forEach(r => {
            const isSelected = (this.cencosFiltroActivo === r.cencos);
            const rowClass = isSelected
                ? 'bg-slate-100/90 font-semibold border-l-4 border-l-slate-700'
                : 'hover:bg-slate-50/70 transition-colors cursor-pointer';

            const valStr = Number(r.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const kgStr = Number(r.kg_vendidos_granja).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const cuStr = Number(r.cu_granja).toFixed(3).replace('.', ',');

            // Color condicional según liquidado (NO: Verde, SI: Azul)
            const isLiquidadoSi = (r.liquidado === 'SI');
            const cuColor = isLiquidadoSi ? 'text-[#2563eb]' : 'text-[#16a34a]';

            html += `
                <tr class="${rowClass}" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].seleccionarGranja('${r.cencos}')">
                    <td class="px-2.5 py-1.5 text-left font-mono border-r border-slate-100 text-slate-800">${r.cencos}</td>
                    <td class="px-2.5 py-1.5 text-left border-r border-slate-100 text-slate-800 ${isSelected ? 'font-bold' : ''}">${r.nomcencos}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100 text-slate-700">S/ ${valStr}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100 text-slate-500">${kgStr}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-semibold ${cuColor}">${cuStr}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    renderTablaGranjaGalpon() {
        const tbody = document.getElementById('tbody-granja-galpon-cp11');
        const subtitulo = document.getElementById('subtitulo-granja-galpon-cp11');
        const btnLimpiar = document.getElementById('btn-limpiar-filtro-cp11');
        if (!tbody) return;

        let items = this.datosGranjaGalpon;

        if (this.cencosFiltroActivo) {
            items = this.datosGranjaGalpon.filter(r => r.cencos === this.cencosFiltroActivo);
            const granjaObj = this.datosGranjas.find(g => g.cencos === this.cencosFiltroActivo);
            const nombreGranja = granjaObj ? granjaObj.nomcencos : this.cencosFiltroActivo;
            if (subtitulo) subtitulo.innerHTML = `Filtro: <strong class="text-slate-900">${nombreGranja} (${this.cencosFiltroActivo})</strong>`;
            if (btnLimpiar) btnLimpiar.classList.remove('hidden');
        } else {
            if (subtitulo) subtitulo.textContent = 'Todas las granjas';
            if (btnLimpiar) btnLimpiar.classList.add('hidden');
        }

        const totalCols = 2 + (this.galponesDisponibles.length * 3);

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${totalCols}" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron galpones</td></tr>`;
            return;
        }

        let html = '';
        items.forEach(r => {
            const isSelected = (this.cencosFiltroActivo === r.cencos);
            const rowClass = isSelected
                ? 'bg-slate-100/90 font-semibold border-l-4 border-l-slate-700 cursor-pointer'
                : 'hover:bg-slate-50/70 transition-colors cursor-pointer';

            let galponesHtml = '';

            this.galponesDisponibles.forEach(g => {
                const gData = (r.galpones && r.galpones[g]) ? r.galpones[g] : null;

                if (gData) {
                    const valStr = Number(gData.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const kgStr = Number(gData.kg_vendidos_galpon).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const cuStr = Number(gData.cu_glpn).toFixed(3).replace('.', ',');

                    const isLiqSi = (gData.liquidado === 'SI');
                    const cuColor = isLiqSi ? 'text-[#2563eb]' : 'text-[#16a34a]';

                    galponesHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-700">S/ ${valStr}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-500">${kgStr}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-semibold ${cuColor}">${cuStr}</td>
                    `;
                } else {
                    galponesHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                    `;
                }
            });

            html += `
                <tr class="${rowClass}" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].seleccionarGranja('${r.cencos}')">
                    <td class="px-2 py-1 text-left font-mono border-r border-slate-200 text-slate-800">${r.cencos}</td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap ${isSelected ? 'font-bold text-slate-900' : ''}">${r.nomcencos}</td>
                    ${galponesHtml}
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    seleccionarGranja(cencos) {
        if (this.cencosFiltroActivo === cencos) {
            this.cencosFiltroActivo = null;
        } else {
            this.cencosFiltroActivo = cencos;
        }

        this.paginaActualLineas = 1;
        this.renderTablaGranjas();
        this.renderTablaGranjaGalpon();
        this.filtrarYRenderizarLineas();
    },

    filtrarYRenderizarLineas() {
        const subtitulo = document.getElementById('subtitulo-lineas-cp11');

        let items = this.datosGranjaGalponLinea;

        if (this.cencosFiltroActivo) {
            items = this.datosGranjaGalponLinea.filter(r => r.cencos === this.cencosFiltroActivo);
            const granjaObj = this.datosGranjas.find(g => g.cencos === this.cencosFiltroActivo);
            const nombreGranja = granjaObj ? granjaObj.nomcencos : this.cencosFiltroActivo;
            if (subtitulo) subtitulo.innerHTML = `Filtro: <strong class="text-slate-900">${nombreGranja} (${this.cencosFiltroActivo})</strong>`;
        } else {
            if (subtitulo) subtitulo.textContent = 'Desglose detallado por clasificación y galpón';
        }

        this.lineasFiltradas = items;
        this.renderPaginaLineas();
    },

    renderPaginaLineas() {
        const tbody = document.getElementById('tbody-lineas-cp11');
        const pagContainer = document.getElementById('paginacion-lineas-cp11');
        if (!tbody) return;

        const totalItems = this.lineasFiltradas.length;
        const totalPaginas = Math.ceil(totalItems / this.filasPorPaginaLineas) || 1;

        if (this.paginaActualLineas > totalPaginas) this.paginaActualLineas = totalPaginas;
        if (this.paginaActualLineas < 1) this.paginaActualLineas = 1;

        const startIdx = (this.paginaActualLineas - 1) * this.filasPorPaginaLineas;
        const endIdx = Math.min(startIdx + this.filasPorPaginaLineas, totalItems);
        const pageRows = this.lineasFiltradas.slice(startIdx, endIdx);

        const totalCols = 3 + (this.galponesDisponibles.length * 3);

        if (pageRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${totalCols}" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron líneas de costo</td></tr>`;
            if (pagContainer) pagContainer.innerHTML = '';
            return;
        }

        let html = '';
        pageRows.forEach(r => {
            let galponesHtml = '';

            this.galponesDisponibles.forEach(g => {
                const gData = (r.galpones && r.galpones[g]) ? r.galpones[g] : null;

                if (gData) {
                    const valStr = Number(gData.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const kgStr = Number(gData.kg_vendidos_galpon).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                    const cuStr = Number(gData.cu_linea).toFixed(3).replace('.', ',');

                    galponesHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-800">S/ ${valStr}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-500">${kgStr}</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 font-medium text-slate-800">${cuStr}</td>
                    `;
                } else {
                    galponesHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 text-slate-300">-</td>
                    `;
                }
            });

            html += `
                <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="px-2 py-1 text-left font-mono border-r border-slate-200 text-slate-800 whitespace-nowrap">${r.cencos}</td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-medium text-slate-700 whitespace-nowrap">${r.nomcencos}</td>
                    <td class="px-3 py-1 text-left border-r border-slate-200 text-slate-800 whitespace-nowrap">${r.clasificacion}</td>
                    ${galponesHtml}
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
                    <button type="button" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].cambiarPagina(1)"
                            ${this.paginaActualLineas === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &laquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].cambiarPagina(${this.paginaActualLineas - 1})"
                            ${this.paginaActualLineas === 1 ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &lsaquo;
                    </button>
                    <span class="px-2 py-0.5 text-slate-700 font-semibold">Pág. ${this.paginaActualLineas} de ${totalPaginas}</span>
                    <button type="button" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].cambiarPagina(${this.paginaActualLineas + 1})"
                            ${this.paginaActualLineas === totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &rsaquo;
                    </button>
                    <button type="button" onclick="window.ChartRegistry['CP11 AnalisisCostoProd'].cambiarPagina(${totalPaginas})"
                            ${this.paginaActualLineas === totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400"' : 'class="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"'}>
                        &raquo;
                    </button>
                </div>
            `;
        }
    },

    cambiarPagina(nuevaPag) {
        this.paginaActualLineas = nuevaPag;
        this.renderPaginaLineas();
        const contScroll = document.getElementById('contenedor-scroll-lineas-cp11');
        if (contScroll) contScroll.scrollTop = 0;
    }
};
