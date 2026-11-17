/**
 * Componente: CostoFormula-Insumos (PLANTA ALIMENTO / ALMACEN / AnalisisCostoDiario)
 * Módulo: AnalisisCostoDiario
 * 
 * 1. Gráfica Superior: Line Chart "Costo Formula Alimento General" (histcostdiaalim2)
 *    * Eje X: Fechas con formato yyyy/mm/dd, ddd en rotación -90°
 *    * Eje Y: PU (Costo Unitario promedio diario)
 *    * Línea continua con gradiente de color divergente (verde en PU bajo -> rojo en PU alto)
 *    * Puntos con etiquetas numéricas (1,538, etc.)
 *    * Interactividad: Clic en punto filtra "Detalle de Insumos" por la unión de fechas seleccionadas.
 *      (NO afecta a Tendencia de Insumos).
 * 
 * 2. Vista Inferior Izquierda: Matriz "Detalle de Insumos" (histcostdiaalim)
 *    * Cabecera con estilo bg-blue-600 y text-white.
 *    * Columnas: tipo, Item, fechas diarias (o unión de fechas seleccionadas).
 *    * Exportación a Excel estilizada (.xlsx con cabecera bg-blue-600 y texto blanco).
 *    * Celdas: PU unitario (3 decimales).
 *    * Interactividad: Clic en fila/celda de insumo filtra "Tendencia de Insumos" por la unión de insumos seleccionados.
 * 
 * 3. Vista Inferior Derecha: "Tendencia de Insumos" (histcostdiaalim)
 *    * Crosstab de Item × fechas con PU y color por tipo, fiel a Insumos3 de Tableau.
 *    * Filtro propio de fechas (Fecha Inicio y Fin) ubicado en la parte SUPERIOR.
 *    * Renderizado virtualizado/por lotes para grandes volúmenes.
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartCostoFormulaInsumos = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,
    chartGeneralInstance: null,
    
    // Estado local
    insumosSeleccionados: [],
    fechasSeleccionadas: [],
    filtroTendenciaInicio: null,
    filtroTendenciaFin: null,

    // Variables para renderizado virtual/por lotes
    itemsTendenciaFiltrados: [],
    fechasTendenciaFiltradas: [],
    indiceLoteTendencia: 0,
    TAMANO_LOTE: 30,

    formatDecimal(val, dec = 3) {
        if (val === null || val === undefined || isNaN(val)) return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        }).format(val);
    },

    formatEntero(val) {
        if (val === null || val === undefined || isNaN(val)) return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    },

    alternarEnLista(lista, valor, aditivo) {
        const existe = lista.includes(valor);

        if (!aditivo) {
            if (lista.length === 1 && existe) return [];
            return [valor];
        }

        return existe ? lista.filter(v => v !== valor) : lista.concat([valor]);
    },

    colorConAlpha(hex, alpha) {
        const limpio = String(hex || '').replace('#', '');
        if (limpio.length !== 6) return hex;
        const r = parseInt(limpio.slice(0, 2), 16);
        const g = parseInt(limpio.slice(2, 4), 16);
        const b = parseInt(limpio.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    colorTipoInsumo(tipo) {
        const clave = String(tipo || '').trim().toUpperCase();
        const mapa = {
            INSUMO: '#2563eb',
            FABRICACIO: '#059669',
            'FABRICACIÓN': '#059669',
            FORMULA: '#d97706'
        };
        return mapa[clave] || '#64748b';
    },

    destroyCharts() {
        if (this.chartGeneralInstance) {
            this.chartGeneralInstance.destroy();
            this.chartGeneralInstance = null;
        }
    },

    render(controller, data, targetContainer = null) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof targetContainer === 'string' ? document.getElementById(targetContainer) : targetContainer) 
            || document.getElementById('contenedor-graficos-lista');

        // Inicializar filtros propios de fecha para Tendencia de Insumos
        this.filtroTendenciaInicio = this.datosBackend.fecha_inicio || '2026-03-01';
        this.filtroTendenciaFin = this.datosBackend.fecha_fin || '2026-03-31';
        this.fechasSeleccionadas = [];
        this.insumosSeleccionados = [];

        this.destroyCharts();
        this.renderView();
    },

    renderView() {
        const contenedor = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const generalData = data.alimento_general || [];
        const matriz = data.insumos_matriz || { columnas_fechas: [], items: [] };
        const resumen = data.resumen_general || {};

        if (generalData.length === 0 && matriz.items.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fas fa-chart-line text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para el rango seleccionado</h3>
                    <p class="text-xs text-slate-400 mt-1">Intenta ajustando el rango de fechas en el filtro superior.</p>
                </div>
            `;
            return;
        }

        const minWidthGeneral = Math.max(900, generalData.length * 44);

        contenedor.innerHTML = `
            <div class="flex flex-col gap-6 w-full">
                
                <!-- 1. GRÁFICA SUPERIOR: Costo Formula Alimento General -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <i class="fas fa-chart-line text-sm"></i>
                            </div>
                            <div>
                                <h2 class="text-base font-bold text-slate-900 tracking-tight">Costo Formula Alimento General</h2>
                                <p class="text-xs text-slate-500">
                                    Período: ${data.fecha_inicio || ''} al ${data.fecha_fin || ''} | ${generalData.length} Días evaluados | PU Promedio: <span class="font-bold text-slate-800">${this.formatDecimal(resumen.pu_promedio, 3)}</span>
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <span class="text-slate-500">Mín: <strong class="text-emerald-600">${this.formatDecimal(resumen.min_pu, 3)}</strong></span>
                                <span class="text-slate-300">|</span>
                                <span class="text-slate-500">Máx: <strong class="text-rose-600">${this.formatDecimal(resumen.max_pu, 3)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 sm:p-5">
                        <!-- BANNER TITULO TABLEAU -->
                        <div class="text-center font-bold text-sm sm:text-base text-slate-900 mb-2 select-none tracking-tight">
                            <u>Costo Formula Alimento General</u>
                        </div>

                        <!-- Canvas contenedor con scroll horizontal -->
                        <div class="w-full overflow-x-auto custom-scrollbar">
                            <div style="min-width: ${minWidthGeneral}px; height: 260px; position: relative;">
                                <canvas id="canvas-alimento-general-insumos"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. SECCIÓN INFERIOR: Detalle de Insumos (Izquierda) + Tendencia de Insumos (Derecha) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- 2.1 VISTA MATRIZ: Detalle de Insumos (6 Cols en XL) -->
                    <div class="xl:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                                    <u>Detalle de Insumos</u>
                                </span>
                                <span id="badge-filtro-fecha-contenedor"></span>
                            </div>
                            <button id="btn-exportar-insumos-excel" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs ml-auto shrink-0">
                                <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>

                        <!-- TABLA MATRIZ CON SCROLL VERTICAL Y HORIZONTAL -->
                        <div class="p-0 overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border-b border-slate-200">
                            <div id="contenedor-tabla-matriz-insumos">
                                ${this.renderTablaMatriz(matriz)}
                            </div>
                        </div>
                    </div>

                    <!-- 2.2 VISTA GRÁFICA: Tendencia de Insumos (6 Cols en XL) -->
                    <div class="xl:col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <!-- BANNER TITULO TABLEAU -->
                        <div class="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                            <div class="text-center w-full font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                                <u>Tendencia de Insumos</u>
                            </div>
                        </div>

                        <!-- FILTRO PROPIO DE FECHAS UBICADO ARRIBA PARA AHORRAR ESPACIO (SIN RESTRICCIONES DE DÍAS) -->
                        <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-slate-700 select-none">fecha</span>
                                <div class="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
                                    <input type="date" id="input-filtro-tendencia-ini" 
                                        value="${this.filtroTendenciaInicio}" 
                                        class="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer">
                                    <span class="text-slate-400 font-bold">─</span>
                                    <input type="date" id="input-filtro-tendencia-fin" 
                                        value="${this.filtroTendenciaFin}" 
                                        class="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer">
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2">
                                <span id="contenedor-btn-quitar-insumo"></span>
                                <button id="btn-reset-filtro-tendencia" type="button"
                                    class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-all cursor-pointer shadow-2xs"
                                    title="Restablecer fechas de tendencia">
                                    <i class="fas fa-undo text-[10px] text-slate-400"></i>
                                    <span>Restablecer</span>
                                </button>
                            </div>
                        </div>

                        <!-- CONTENEDOR DE GRÁFICAS DE TENDENCIA (MULTI-FILA O INDIVIDUAL SEGÚN SELECCIÓN) -->
                        <div id="contenedor-tendencias-insumos-scroll" class="p-0 overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border-b border-slate-200 bg-white">
                            <!-- Generado dinámicamente -->
                        </div>
                    </div>

                </div>

            </div>
        `;

        this.initChartGeneral(generalData);
        this.renderTendenciaContent();
        this.setupEventListeners();
    },

    renderTablaMatriz(matriz) {
        const todasColumnas = matriz.columnas_fechas || [];
        const items = matriz.items || [];
        const fechasSeleccionadas = new Set(this.fechasSeleccionadas);

        // Si hay fechas seleccionadas en el gráfico general, mostrar la unión
        const columnas = this.fechasSeleccionadas.length
            ? todasColumnas.filter(c => fechasSeleccionadas.has(c.fecha))
            : todasColumnas;

        if (items.length === 0) {
            return `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron insumos para el rango seleccionado.
                </div>
            `;
        }

        let html = `
            <table class="w-full border-collapse text-left text-xs select-none">
                <thead>
                    <tr class="bg-blue-600 text-white font-bold sticky top-0 z-20 shadow-2xs" style="background-color: #2563eb;">
                        <th class="py-2.5 px-3 whitespace-nowrap sticky left-0 z-30 border-r border-blue-500 text-[11px] min-w-[85px] text-white" style="background-color: #2563eb;">
                            tipo
                        </th>
                        <th class="py-2.5 px-3 whitespace-nowrap sticky left-[85px] z-30 border-r border-blue-500 text-[11px] min-w-[200px] max-w-[260px] text-white" style="background-color: #2563eb;">
                            Item
                        </th>
        `;

        columnas.forEach(col => {
            const isSingle = this.fechasSeleccionadas.length > 0;
            html += `
                <th class="py-2 px-3 text-center whitespace-nowrap min-w-[85px] border-r border-blue-500 text-[10.5px] text-white ${isSingle ? 'bg-blue-700' : ''}" style="background-color: ${isSingle ? '#1d4ed8' : '#2563eb'};">
                    <div class="text-[10px] text-blue-100 font-medium">${isSingle ? 'Día de fecha..' : ''}</div>
                    <div class="font-bold text-white">${col.dia_semana || ''},</div>
                    <div class="text-[10px] text-blue-100 font-normal">${col.ymd || col.fecha}</div>
                </th>
            `;
        });

        html += `
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white font-medium text-slate-700">
        `;

        let currentTipo = '';

        items.forEach((it, idx) => {
            const isSelected = this.insumosSeleccionados.includes(it.coditem);
            const isFirstOfTipo = (it.tipo !== currentTipo);
            if (isFirstOfTipo) currentTipo = it.tipo;

            const rowBg = isSelected 
                ? 'bg-blue-100 font-semibold ring-2 ring-blue-500' 
                : (idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-100/50');

            const stickyCellBg = isSelected ? '#dbeafe' : '#ffffff';

            html += `
                <tr id="matriz-row-${it.coditem}" class="transition-colors cursor-pointer row-insumo ${rowBg}" data-coditem="${it.coditem}">
                    <td class="py-1.5 px-3 sticky left-0 z-10 border-r border-slate-200 text-[11px] text-slate-600 font-semibold truncate" style="background-color: ${stickyCellBg};">
                        ${it.tipo}
                    </td>
                    <td class="py-1.5 px-3 sticky left-[85px] z-10 border-r border-slate-200 min-w-[200px] max-w-[260px] truncate text-[11px]" style="background-color: ${stickyCellBg};" title="${it.item}">
                        <span class="text-slate-900 truncate font-semibold">${it.item}</span>
                    </td>
            `;

            columnas.forEach(col => {
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                const cellText = valObj ? this.formatDecimal(valObj.pu, 3) : '';
                const cellClass = valObj 
                    ? (isSelected ? 'bg-blue-100 font-bold text-blue-900' : 'text-slate-800') 
                    : 'text-slate-300 font-normal';

                html += `
                    <td class="py-1.5 px-3 text-right border-r border-slate-100 text-[11px] whitespace-nowrap ${cellClass}">
                        ${cellText}
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    },

    renderTendenciaContent() {
        this.renderTendenciaCrosstab();
    },

    renderTendenciaCrosstab() {
        const contScroll = document.getElementById('contenedor-tendencias-insumos-scroll');
        if (!contScroll) return;

        const data = this.datosBackend || {};
        const matriz = data.insumos_matriz || { columnas_fechas: [], items: [] };
        const todasFechas = matriz.columnas_fechas || [];
        const seleccionados = new Set(this.insumosSeleccionados);
        const items = seleccionados.size
            ? (matriz.items || []).filter(it => seleccionados.has(it.coditem))
            : (matriz.items || []);

        // Filtrar fechas según filtro propio de Tendencia de Insumos
        const fIni = this.filtroTendenciaInicio || (todasFechas[0] ? todasFechas[0].fecha : '');
        const fFin = this.filtroTendenciaFin || (todasFechas[todasFechas.length - 1] ? todasFechas[todasFechas.length - 1].fecha : '');
        const fechasFiltradas = todasFechas.filter(f => (!fIni || f.fecha >= fIni) && (!fFin || f.fecha <= fFin));

        this.itemsTendenciaFiltrados = items;
        this.fechasTendenciaFiltradas = fechasFiltradas;
        this.indiceLoteTendencia = 0;

        if (items.length === 0 || fechasFiltradas.length === 0) {
            contScroll.innerHTML = `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron datos de tendencia para el rango de fechas seleccionado.
                </div>
            `;
            return;
        }

        const itemWidth = 260;
        const fechaWidth = 88;
        const minWidth = itemWidth + fechasFiltradas.length * fechaWidth;

        const headersFechas = fechasFiltradas.map(f => `
            <th class="px-2 py-2 text-center border-r border-blue-500 text-[10px] whitespace-nowrap" style="background-color: #2563eb; min-width: ${fechaWidth}px;">
                <div class="text-[9px] font-medium text-blue-100">${f.dia_semana || ''}</div>
                <div class="font-bold text-white">${f.ymd || String(f.fecha || '').replace(/-/g, '/')}</div>
            </th>
        `).join('');

        contScroll.innerHTML = `
            <div style="min-width: ${minWidth}px;" class="select-none relative">
                <table class="w-full border-collapse text-xs bg-white">
                    <thead class="sticky top-0 z-30">
                        <tr class="bg-blue-600 text-white">
                            <th class="sticky left-0 z-40 px-3 py-2 text-left font-bold border-r border-blue-500" style="background-color: #2563eb; min-width: ${itemWidth}px;">
                                Item
                            </th>
                            ${headersFechas}
                        </tr>
                    </thead>
                    <tbody id="tbody-tendencia-insumos" class="divide-y divide-slate-100 bg-white"></tbody>
                </table>
            </div>
        `;

        // Renderizar primer lote de filas inmediatamente
        this.renderSiguienteLoteTendencia();

        // Escuchar scroll para renderizado incremental bajo demanda
        contScroll.onscroll = () => {
            if (contScroll.scrollTop + contScroll.clientHeight >= contScroll.scrollHeight - 300) {
                this.renderSiguienteLoteTendencia();
            }
        };
    },

    renderSiguienteLoteTendencia() {
        const tbody = document.getElementById('tbody-tendencia-insumos');
        if (!tbody) return;

        const totalItems = this.itemsTendenciaFiltrados.length;
        if (this.indiceLoteTendencia >= totalItems) return;

        const finLote = Math.min(this.indiceLoteTendencia + this.TAMANO_LOTE, totalItems);
        const lote = this.itemsTendenciaFiltrados.slice(this.indiceLoteTendencia, finLote);
        this.indiceLoteTendencia = finLote;

        const fechas = this.fechasTendenciaFiltradas;
        const fragment = document.createDocumentFragment();

        lote.forEach(it => {
            const color = this.colorTipoInsumo(it.tipo);
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/70 transition-colors';
            tr.setAttribute('data-coditem', it.coditem);

            let html = `
                <td class="sticky left-0 z-20 px-3 py-2 border-r border-slate-200 bg-white" style="background-color: #ffffff;">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color};"></span>
                        <div class="flex flex-col min-w-0">
                            <span class="text-[11px] font-semibold text-slate-800 truncate" title="${it.item}">${it.item}</span>
                            <span class="text-[9px] text-slate-400 uppercase">${it.tipo || ''}</span>
                        </div>
                    </div>
                </td>
            `;

            fechas.forEach(f => {
                const valObj = it.valores_por_dia ? it.valores_por_dia[f.fecha] : null;
                const tieneDato = valObj && valObj.pu !== null && valObj.pu !== undefined;
                const texto = tieneDato ? this.formatDecimal(valObj.pu, 3) : '';
                const fondo = tieneDato ? this.colorConAlpha(color, 0.08) : '#ffffff';
                const colorTexto = tieneDato ? color : '#cbd5e1';

                html += `
                    <td class="px-2 py-1.5 text-right border-r border-slate-100 font-mono text-[10.5px] whitespace-nowrap"
                        style="background-color: ${fondo}; color: ${colorTexto};">
                        ${texto}
                    </td>
                `;
            });

            tr.innerHTML = html;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    },

    initChartGeneral(generalData) {
        const canvas = document.getElementById('canvas-alimento-general-insumos');
        if (!canvas || typeof Chart === 'undefined') return;

        // X Axis labels formatted as: "2026/03/01, dom"
        const labels = generalData.map(d => `${d.ymd || d.fecha}, ${d.dia_corto || d.dia_semana || ''}`);
        const dataValues = generalData.map(d => d.pu);

        const minVal = Math.min(...dataValues);
        const maxVal = Math.max(...dataValues);
        const yMin = Math.floor((minVal - 0.005) * 100) / 100;
        const yMax = Math.ceil((maxVal + 0.005) * 100) / 100;

        // Diverging color matching Tableau red_green_diverging palette
        const getColorForRatio = (val) => {
            const ratio = (maxVal > minVal) ? (val - minVal) / (maxVal - minVal) : 0.5;
            if (ratio <= 0.20) return '#2d8e87'; // Dark green / teal
            if (ratio <= 0.40) return '#499844'; // Green
            if (ratio <= 0.65) return '#e88938'; // Orange / peach
            if (ratio <= 0.85) return '#db4343'; // Red
            return '#991b1b';                   // Dark red
        };

        const pointColors = dataValues.map(v => getColorForRatio(v));

        this.chartGeneralInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: dataValues,
                    borderColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return '#c2584f';
                        // Continuous vertical gradient from bottom (min/green) to top (max/red)
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, '#2d8e87');    // Green at low PU
                        gradient.addColorStop(0.35, '#499844'); // Light green
                        gradient.addColorStop(0.60, '#e88938'); // Peach / orange
                        gradient.addColorStop(0.85, '#db4343'); // Red
                        gradient.addColorStop(1, '#991b1b');    // Dark red
                        return gradient;
                    },
                    borderWidth: 2.2,
                    backgroundColor: 'rgba(194, 88, 79, 0.03)',
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: generalData.map(d => this.fechasSeleccionadas.includes(d.fecha) ? '#0f172a' : '#ffffff'),
                    pointBorderWidth: generalData.map(d => this.fechasSeleccionadas.includes(d.fecha) ? 2.5 : 1.5),
                    pointRadius: generalData.map(d => this.fechasSeleccionadas.length === 0 ? 4.5 : (this.fechasSeleccionadas.includes(d.fecha) ? 7 : 3)),
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25, bottom: 5, left: 10, right: 15 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 6,
                        displayColors: false,
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 10.5 },
                        callbacks: {
                            beforeTitle: () => '✓ Mantener solamente   ⊘ Excluir',
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                return `Día de fecha: ${generalData[idx] ? generalData[idx].fecha_label : items[0].label}`;
                            },
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const item = generalData[idx] || {};
                                return [
                                    `PU:    ${this.formatDecimal(item.pu, 3)}`,
                                    `Peso:  ${this.formatDecimal(item.peso, 2)} kg`,
                                    `Valor: S/ ${this.formatDecimal(item.valor, 2)}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        align: 'top',
                        anchor: 'end',
                        offset: 4,
                        color: '#1e293b',
                        font: { size: 10, weight: 'bold' },
                        formatter: (val) => this.formatDecimal(val, 3)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9.5, weight: '500' },
                            maxRotation: 90,
                            minRotation: 90
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        title: {
                            display: true,
                            text: 'PU',
                            color: '#64748b',
                            font: { size: 11, weight: 'bold' }
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            callback: (v) => this.formatDecimal(v, 2)
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const pt = generalData[idx];
                        if (pt && pt.fecha) {
                            const native = event?.native || event;
                            const aditivo = !!(native && (native.ctrlKey || native.metaKey));
                            this.onFechaGeneralClick(pt.fecha, aditivo);
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    onFechaGeneralClick(fecha, aditivo = false) {
        this.fechasSeleccionadas = this.alternarEnLista(this.fechasSeleccionadas, fecha, aditivo);
        this.actualizarEstilosGeneral();
        this.actualizarTablaMatriz();
        this.actualizarBadgeFechas();
    },

    actualizarEstilosGeneral() {
        const instancia = this.chartGeneralInstance;
        if (!instancia) return;

        const generalData = this.datosBackend?.alimento_general || [];
        const seleccion = new Set(this.fechasSeleccionadas);
        const dataset = instancia.data.datasets[0];

        if (!dataset) return;

        dataset.pointBorderColor = generalData.map(d => seleccion.has(d.fecha) ? '#0f172a' : '#ffffff');
        dataset.pointBorderWidth = generalData.map(d => seleccion.has(d.fecha) ? 2.5 : 1.5);
        dataset.pointRadius = generalData.map(d => {
            if (!this.fechasSeleccionadas.length) return 4.5;
            return seleccion.has(d.fecha) ? 7 : 3;
        });

        instancia.update();
    },

    actualizarTablaMatriz() {
        const cont = document.getElementById('contenedor-tabla-matriz-insumos');
        if (!cont || !this.datosBackend?.insumos_matriz) return;

        cont.innerHTML = this.renderTablaMatriz(this.datosBackend.insumos_matriz);
        this.bindTableEvents();
    },

    actualizarBadgeFechas() {
        const badgeCont = document.getElementById('badge-filtro-fecha-contenedor');
        if (!badgeCont) return;

        const n = this.fechasSeleccionadas.length;
        if (!n) {
            badgeCont.innerHTML = '';
            return;
        }

        badgeCont.innerHTML = `
            <button id="btn-quitar-filtro-fechas" type="button"
                class="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-2 py-0.5 transition-all cursor-pointer shadow-2xs"
                title="Mostrar todas las fechas">
                <span>Fechas: ${n}</span>
                <i class="fas fa-times text-[10px]"></i>
            </button>
        `;

        const btnQuitar = document.getElementById('btn-quitar-filtro-fechas');
        if (btnQuitar) {
            btnQuitar.onclick = (event) => {
                event.stopPropagation();
                this.fechasSeleccionadas = [];
                this.actualizarEstilosGeneral();
                this.actualizarTablaMatriz();
                this.actualizarBadgeFechas();
            };
        }
    },

    onInsumoSelect(coditem, aditivo = false) {
        this.insumosSeleccionados = this.alternarEnLista(this.insumosSeleccionados, coditem, aditivo);
        this.actualizarSeleccionVisualMatriz();
        this.actualizarBotonInsumos();
        this.renderTendenciaContent();
    },

    actualizarSeleccionVisualMatriz() {
        const rows = document.querySelectorAll('.row-insumo');
        rows.forEach(r => {
            const itemCode = r.getAttribute('data-coditem');
            const isSelected = this.insumosSeleccionados.includes(itemCode);
            const col1 = r.children[0];
            const col2 = r.children[1];

            if (isSelected) {
                r.className = 'transition-colors cursor-pointer row-insumo bg-blue-100 font-semibold ring-2 ring-blue-500';
                if (col1) col1.style.backgroundColor = '#dbeafe';
                if (col2) col2.style.backgroundColor = '#dbeafe';
            } else {
                r.className = 'transition-colors cursor-pointer row-insumo bg-white hover:bg-slate-50';
                if (col1) col1.style.backgroundColor = '#ffffff';
                if (col2) col2.style.backgroundColor = '#ffffff';
            }
        });
    },

    actualizarBotonInsumos() {
        const cont = document.getElementById('contenedor-btn-quitar-insumo');
        if (!cont) return;

        const n = this.insumosSeleccionados.length;
        if (!n) {
            cont.innerHTML = '';
            return;
        }

        cont.innerHTML = `
            <button id="btn-quitar-filtro-insumo" type="button"
                class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all cursor-pointer shadow-2xs">
                <i class="fas fa-list text-[10px]"></i>
                <span>Ver todos los insumos (${n})</span>
            </button>
        `;

        const btn = document.getElementById('btn-quitar-filtro-insumo');
        if (btn) {
            btn.onclick = () => {
                this.insumosSeleccionados = [];
                this.actualizarSeleccionVisualMatriz();
                this.actualizarBotonInsumos();
                this.renderTendenciaContent();
            };
        }
    },

    setupEventListeners() {
        // 1. Click en filas de la matriz
        this.bindTableEvents();

        // 2. Exportar a Excel
        const btnExport = document.getElementById('btn-exportar-insumos-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                this.exportarExcel();
            };
        }

        // 3. Filtro propio de fechas de Tendencia de Insumos (sin restricciones de min/max)
        const inputIni = document.getElementById('input-filtro-tendencia-ini');
        const inputFin = document.getElementById('input-filtro-tendencia-fin');
        const btnReset = document.getElementById('btn-reset-filtro-tendencia');

        if (inputIni) {
            inputIni.addEventListener('change', () => {
                this.filtroTendenciaInicio = inputIni.value;
                this.renderTendenciaContent();
            });
        }

        if (inputFin) {
            inputFin.addEventListener('change', () => {
                this.filtroTendenciaFin = inputFin.value;
                this.renderTendenciaContent();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.filtroTendenciaInicio = this.datosBackend.fecha_inicio || '2026-03-01';
                this.filtroTendenciaFin = this.datosBackend.fecha_fin || '2026-03-31';
                if (inputIni) inputIni.value = this.filtroTendenciaInicio;
                if (inputFin) inputFin.value = this.filtroTendenciaFin;
                this.renderTendenciaContent();
            });
        }
    },

    bindTableEvents() {
        const rows = document.querySelectorAll('.row-insumo');
        rows.forEach(r => {
            r.onclick = (event) => {
                const coditem = r.getAttribute('data-coditem');
                if (coditem) {
                    this.onInsumoSelect(coditem, event.ctrlKey || event.metaKey);
                }
            };
        });
    },

    exportarExcel() {
        const matriz = this.datosBackend.insumos_matriz || { columnas_fechas: [], items: [] };

        if (typeof XLSX === 'undefined') {
            alert('Exportando datos a Excel...');
            return;
        }

        const fechasSeleccionadas = new Set(this.fechasSeleccionadas);
        const columnas = this.fechasSeleccionadas.length
            ? (matriz.columnas_fechas || []).filter(c => fechasSeleccionadas.has(c.fecha))
            : (matriz.columnas_fechas || []);

        // 1. Estilos Oficiales bg-blue-600 para Cabeceras Excel (xlsx-js-style)
        const headerStyle = {
            fill: { fgColor: { rgb: "2563EB" } }, // bg-blue-600
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "1D4ED8" } },
                bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                left: { style: "thin", color: { rgb: "3B82F6" } },
                right: { style: "thin", color: { rgb: "3B82F6" } }
            }
        };

        const textStyleLeft = {
            font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: "left" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const numberStyleRight = {
            font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const ws = {};
        const headers = ['Tipo', 'Item', 'PU Promedio'];
        columnas.forEach(col => {
            headers.push(`${col.dia_semana || ''}, ${col.ymd || col.fecha}`);
        });

        // Fila 0: Encabezados con fondo azul bg-blue-600 y texto blanco
        headers.forEach((h, cIdx) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
            ws[cellRef] = {
                t: 's',
                v: h,
                s: headerStyle
            };
        });

        // Filas 1..N: Datos de Detalle de Insumos
        let rIdx = 1;
        (matriz.items || []).forEach(it => {
            // Col 0: Tipo
            const refTipo = XLSX.utils.encode_cell({ r: rIdx, c: 0 });
            ws[refTipo] = { t: 's', v: it.tipo || '', s: textStyleLeft };

            // Col 1: Item
            const refItem = XLSX.utils.encode_cell({ r: rIdx, c: 1 });
            ws[refItem] = { t: 's', v: it.item || it.nomitem || '', s: textStyleLeft };

            // Col 2: PU Promedio
            const refPuProm = XLSX.utils.encode_cell({ r: rIdx, c: 2 });
            ws[refPuProm] = { t: 'n', v: Number(it.pu_promedio || 0), z: '#,##0.000', s: numberStyleRight };

            // Columnas de fechas
            columnas.forEach((col, cOffset) => {
                const cIdx = 3 + cOffset;
                const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;

                if (valObj && valObj.pu !== null && valObj.pu !== undefined) {
                    ws[refCell] = { t: 'n', v: Number(valObj.pu), z: '#,##0.000', s: numberStyleRight };
                } else {
                    ws[refCell] = { t: 's', v: '', s: textStyleLeft };
                }
            });

            rIdx++;
        });

        const range = { s: { r: 0, c: 0 }, e: { r: rIdx - 1, c: headers.length - 1 } };
        ws['!ref'] = XLSX.utils.encode_range(range);

        // Auto Column Widths
        const colWidths = [
            { wch: 14 }, // Tipo
            { wch: 36 }, // Item
            { wch: 14 }, // PU Promedio
        ];
        columnas.forEach(() => {
            colWidths.push({ wch: 18 });
        });
        ws['!cols'] = colWidths;

        // Alturas de filas
        const rowHeights = [{ hpt: 26 }];
        for (let r = 1; r < rIdx; r++) {
            rowHeights.push({ hpt: 20 });
        }
        ws['!rows'] = rowHeights;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Insumos');

        const fIni = this.datosBackend.fecha_inicio || '';
        const fFin = this.datosBackend.fecha_fin || '';
        XLSX.writeFile(wb, `Detalle_Insumos_${fIni}_${fFin}.xlsx`);
    }
};

window.ChartRegistry['CostoFormula-Insumos'] = window.ChartCostoFormulaInsumos;
window.ChartRegistry['Dash_CostoFormulaInsumos'] = window.ChartCostoFormulaInsumos;
