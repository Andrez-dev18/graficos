/**
 * Componente: CostoFormula-Insumos (PLANTA ALIMENTO / ALMACEN / AnalisisCostoDiario)
 * Módulo: AnalisisCostoDiario
 * 
 * 1. Gráfica Superior: Line Chart "Costo Formula Alimento General" (histcostdiaalim2)
 *    * Eje X: Fechas con formato yyyy/mm/dd, ddd en rotación -90°
 *    * Eje Y: PU (Costo Unitario promedio diario)
 *    * Línea continua con gradiente de color divergente (verde en PU bajo -> rojo en PU alto)
 *    * Puntos con etiquetas numéricas (1,538, etc.)
 *    * Interactividad: Clic en punto filtra "Detalle de Insumos" para mostrar únicamente esa fecha seleccionada.
 *      (NO afecta a Tendencia de Insumos).
 * 
 * 2. Vista Inferior Izquierda: Matriz "Detalle de Insumos" (histcostdiaalim)
 *    * Cabecera con estilo bg-blue-600 y text-white.
 *    * Columnas: tipo, Item, Fechas diarias (o fecha única cuando está filtrado).
 *    * Exportación a Excel estilizada (.xlsx con cabecera bg-blue-600 y texto blanco).
 *    * Celdas: PU unitario (3 decimales).
 *    * Interactividad: Clic en fila/celda de insumo filtra "Tendencia de Insumos" para ese insumo específico.
 * 
 * 3. Vista Inferior Derecha: "Tendencia de Insumos" (histcostdiaalim)
 *    * Cabecera con estilo bg-blue-600 y text-white.
 *    * Filtro propio de fechas (Fecha Inicio y Fin) ubicado en la parte SUPERIOR para ahorrar espacio.
 *    * Modo Multidimensional: Renderizado virtualizado/por lotes con columnas fijas 100% opacas.
 *    * Modo Filtrado (Insumo individual): Gráfica expandida para el insumo seleccionado con eje Y adaptativo.
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartCostoFormulaInsumos = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,
    chartGeneralInstance: null,
    chartSingleTendenciaInstance: null,
    
    // Estado local
    insumoSeleccionado: null,
    fechaSeleccionada: null,
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

    destroyCharts() {
        if (this.chartGeneralInstance) {
            this.chartGeneralInstance.destroy();
            this.chartGeneralInstance = null;
        }
        if (this.chartSingleTendenciaInstance) {
            this.chartSingleTendenciaInstance.destroy();
            this.chartSingleTendenciaInstance = null;
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
        this.fechaSeleccionada = null;
        this.insumoSeleccionado = null;

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

        // Si hay una fecha seleccionada en el gráfico general, filtrar solo esa fecha
        const columnas = this.fechaSeleccionada 
            ? todasColumnas.filter(c => c.fecha === this.fechaSeleccionada)
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
            const isSingle = !!this.fechaSeleccionada;
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
            const isSelected = (this.insumoSeleccionado === it.coditem);
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
        if (this.insumoSeleccionado) {
            this.renderTendenciaSingleItem();
        } else {
            this.renderTendenciaStackedView();
        }
    },

    renderTendenciaStackedView() {
        const contScroll = document.getElementById('contenedor-tendencias-insumos-scroll');
        if (!contScroll) return;

        if (this.chartSingleTendenciaInstance) {
            this.chartSingleTendenciaInstance.destroy();
            this.chartSingleTendenciaInstance = null;
        }

        const data = this.datosBackend || {};
        const matriz = data.insumos_matriz || { columnas_fechas: [], items: [] };
        const todasFechas = matriz.columnas_fechas || [];
        const items = matriz.items || [];

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

        const itemWidth = Math.max(540, fechasFiltradas.length * 36);

        // Estructura fija con Cabecera bg-blue-600 y text-white
        contScroll.innerHTML = `
            <div style="min-width: ${170 + 45 + itemWidth}px;" class="select-none relative">
                
                <!-- HEADER SUPERIOR DE TENDENCIA: Item (Izquierda) + PU + Día de fechahisto (Derecha) -->
                <div class="flex items-center text-white font-bold text-[11px] sticky top-0 shadow-2xs" style="background-color: #2563eb; z-index: 35;">
                    <div class="w-[170px] min-w-[170px] py-2.5 px-3 border-r border-blue-500 sticky left-0 text-white" style="background-color: #2563eb; z-index: 38;">
                        Item
                    </div>
                    <div class="w-[45px] min-w-[45px] py-2.5 px-1 text-center border-r border-blue-500 sticky left-[170px] text-[10px] text-blue-100" style="background-color: #2563eb; z-index: 38;">
                        PU
                    </div>
                    <div class="py-2.5 px-3 text-center grow font-bold text-white" style="background-color: #2563eb;">
                        Día de fechahisto
                    </div>
                </div>

                <!-- CONTENEDOR DE FILAS DE INSUMOS APILADAS -->
                <div id="lista-filas-tendencia-items" class="divide-y divide-slate-200 bg-white">
                </div>

                <!-- EJE X INFERIOR CON FECHAS -->
                <div class="flex items-start border-t border-slate-200 sticky bottom-0 shadow-2xs" style="background-color: #f8fafc; z-index: 35;">
                    <div class="w-[170px] min-w-[170px] sticky left-0 border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    <div class="w-[45px] min-w-[45px] sticky left-[170px] border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    
                    <div class="grow h-[85px] relative" style="background-color: #f8fafc;">
                        <svg width="${itemWidth}" height="85" viewBox="0 0 ${itemWidth} 85" class="w-full h-full block">
                            ${this.generarSvgEjeXFechas(fechasFiltradas, itemWidth)}
                        </svg>
                    </div>
                </div>

            </div>
        `;

        // Renderizar primer lote de filas inmediatamente
        this.renderSiguienteLoteTendencia();

        // Escuchar scroll para renderizado infinito / incremental bajo demanda
        contScroll.onscroll = () => {
            if (contScroll.scrollTop + contScroll.clientHeight >= contScroll.scrollHeight - 300) {
                this.renderSiguienteLoteTendencia();
            }
        };
    },

    generarSvgEjeXFechas(fechas, itemWidth) {
        const padLeft = 18;
        const padRight = 18;
        const drawWidth = itemWidth - padLeft - padRight;
        const stepX = fechas.length > 1 ? drawWidth / (fechas.length - 1) : drawWidth;

        let svg = '';
        fechas.forEach((f, idx) => {
            const x = padLeft + idx * stepX;
            const labelFecha = f.ymd || f.fecha.replace(/-/g, '/');
            svg += `
                <text x="${x.toFixed(1)}" y="10" 
                    transform="rotate(-90 ${x.toFixed(1)} 10)" 
                    text-anchor="end" font-size="9.5" font-family="sans-serif" 
                    font-weight="500" fill="#64748b">
                    ${labelFecha}..
                </text>
            `;
        });
        return svg;
    },

    renderSiguienteLoteTendencia() {
        const listaCont = document.getElementById('lista-filas-tendencia-items');
        if (!listaCont) return;

        const totalItems = this.itemsTendenciaFiltrados.length;
        if (this.indiceLoteTendencia >= totalItems) return;

        const finLote = Math.min(this.indiceLoteTendencia + this.TAMANO_LOTE, totalItems);
        const lote = this.itemsTendenciaFiltrados.slice(this.indiceLoteTendencia, finLote);
        this.indiceLoteTendencia = finLote;

        const fechas = this.fechasTendenciaFiltradas;
        const itemWidth = Math.max(540, fechas.length * 36);
        const itemHeight = 78;
        const padTop = 22;
        const padBottom = 8;
        const padLeft = 18;
        const padRight = 18;
        const drawWidth = itemWidth - padLeft - padRight;
        const drawHeight = itemHeight - padTop - padBottom;
        const stepX = fechas.length > 1 ? drawWidth / (fechas.length - 1) : drawWidth;

        const getY = (pu) => {
            const clamped = Math.min(40, Math.max(0, pu));
            return padTop + drawHeight - (clamped / 40) * drawHeight;
        };

        const y40 = getY(40);
        const y20 = getY(20);
        const y0 = getY(0);

        const fragment = document.createDocumentFragment();

        lote.forEach(it => {
            const isSelected = (this.insumoSeleccionado === it.coditem);
            const stickyBg = isSelected ? '#dbeafe' : '#ffffff';

            let pathD = '';
            let pointsSvg = '';
            let hasFirst = false;

            fechas.forEach((f, fIdx) => {
                const x = padLeft + fIdx * stepX;
                const valObj = it.valores_por_dia ? it.valores_por_dia[f.fecha] : null;

                if (valObj && valObj.pu !== null && valObj.pu !== undefined) {
                    const pu = valObj.pu;
                    const y = getY(pu);

                    if (!hasFirst) {
                        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                        hasFirst = true;
                    } else {
                        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                    }

                    const labelText = this.formatDecimal(pu, 3);

                    pointsSvg += `
                        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" 
                            fill="#2563eb" stroke="#ffffff" stroke-width="1.2" 
                            class="transition-all cursor-pointer">
                            <title>${it.item}\nFecha: ${f.ymd || f.fecha}\nPU: ${labelText}\nPeso: ${this.formatDecimal(valObj.peso, 2)} kg\nValor: S/ ${this.formatDecimal(valObj.valor, 2)}</title>
                        </circle>
                        <text x="${x.toFixed(1)}" y="${(y - 4).toFixed(1)}" 
                            transform="rotate(-90 ${x.toFixed(1)} ${(y - 4).toFixed(1)})" 
                            text-anchor="start" font-size="8.5" font-family="sans-serif" font-weight="700" 
                            fill="#1e293b">${labelText}</text>
                    `;
                }
            });

            const rowDiv = document.createElement('div');
            rowDiv.id = `tendencia-row-${it.coditem}`;
            rowDiv.className = `flex items-center row-tendencia-item ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-white hover:bg-slate-50/60'} transition-colors cursor-pointer`;
            rowDiv.setAttribute('data-coditem', it.coditem);

            rowDiv.innerHTML = `
                <!-- 1. Columna Item (Sticky Izquierda, 100% Opaco) -->
                <div class="w-[170px] min-w-[170px] p-2.5 sticky left-0 border-r border-slate-200 flex flex-col justify-center" style="background-color: ${stickyBg}; z-index: 25;">
                    <span class="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-3" title="${it.item}">
                        ${it.item}
                    </span>
                </div>

                <!-- 2. Columna Eje Y PU (0, 20, 40) (Sticky Izquierda, 100% Opaco) -->
                <div class="w-[45px] min-w-[45px] h-[${itemHeight}px] sticky left-[170px] border-r border-slate-200 flex flex-col justify-between items-end py-1.5 px-1.5 text-[9.5px] font-semibold text-slate-400 select-none" style="background-color: ${stickyBg}; z-index: 25;">
                    <span>40</span>
                    <span>20</span>
                    <span>0</span>
                </div>

                <!-- 3. Área de Gráfica SVG -->
                <div class="grow h-[${itemHeight}px] relative bg-transparent overflow-hidden" style="z-index: 10;">
                    <svg width="${itemWidth}" height="${itemHeight}" viewBox="0 0 ${itemWidth} ${itemHeight}" class="w-full h-full block">
                        <!-- Líneas de cuadrícula a 40, 20 y 0 -->
                        <line x1="0" y1="${y40.toFixed(1)}" x2="${itemWidth}" y2="${y40.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                        <line x1="0" y1="${y20.toFixed(1)}" x2="${itemWidth}" y2="${y20.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                        <line x1="0" y1="${y0.toFixed(1)}" x2="${itemWidth}" y2="${y0.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
                        
                        <!-- Línea de datos -->
                        ${pathD ? `<path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />` : ''}
                        
                        <!-- Puntos y etiquetas -->
                        ${pointsSvg}
                    </svg>
                </div>
            `;

            rowDiv.onclick = () => {
                this.onInsumoSelect(it.coditem);
            };

            fragment.appendChild(rowDiv);
        });

        listaCont.appendChild(fragment);
    },

    renderTendenciaSingleItem() {
        const contScroll = document.getElementById('contenedor-tendencias-insumos-scroll');
        if (!contScroll) return;

        if (this.chartSingleTendenciaInstance) {
            this.chartSingleTendenciaInstance.destroy();
            this.chartSingleTendenciaInstance = null;
        }

        const data = this.datosBackend || {};
        const matriz = data.insumos_matriz || { columnas_fechas: [], items: [] };
        const todasFechas = matriz.columnas_fechas || [];
        const items = matriz.items || [];

        const found = items.find(it => it.coditem === this.insumoSeleccionado);
        if (!found) {
            this.renderTendenciaStackedView();
            return;
        }

        // Filtrar fechas según filtro propio de Tendencia de Insumos
        const fIni = this.filtroTendenciaInicio || (todasFechas[0] ? todasFechas[0].fecha : '');
        const fFin = this.filtroTendenciaFin || (todasFechas[todasFechas.length - 1] ? todasFechas[todasFechas.length - 1].fecha : '');
        const fechasFiltradas = todasFechas.filter(f => (!fIni || f.fecha >= fIni) && (!fFin || f.fecha <= fFin));

        const labels = [];
        const dataValues = [];
        const pointMeta = [];
        let minPu = null;
        let maxPu = null;

        fechasFiltradas.forEach(f => {
            const valObj = found.valores_por_dia ? found.valores_por_dia[f.fecha] : null;
            labels.push(`${f.ymd || f.fecha}, ${f.dia_corto || f.dia_semana || ''}`);
            
            if (valObj && valObj.pu !== null && valObj.pu !== undefined) {
                const pu = valObj.pu;
                dataValues.push(pu);
                pointMeta.push(valObj);
                if (minPu === null || pu < minPu) minPu = pu;
                if (maxPu === null || pu > maxPu) maxPu = pu;
            } else {
                dataValues.push(null);
                pointMeta.push(null);
            }
        });

        // Escala Y adaptativa de alta resolución (como en filtro2.png)
        let yMin = 0;
        let yMax = 40;
        if (minPu !== null && maxPu !== null) {
            const diff = maxPu - minPu;
            if (diff <= 0.05) {
                yMin = Math.floor((minPu - 0.01) * 100) / 100;
                yMax = Math.ceil((maxPu + 0.01) * 100) / 100;
            } else {
                yMin = Math.floor((minPu - diff * 0.1) * 100) / 100;
                yMax = Math.ceil((maxPu + diff * 0.1) * 100) / 100;
            }
            if (yMin < 0) yMin = 0;
        }

        const minWidth = Math.max(500, fechasFiltradas.length * 36);

        contScroll.innerHTML = `
            <div class="p-4 flex flex-col gap-2">
                <!-- CABECERA ITEM INDIVIDUAL -->
                <div class="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item Seleccionado</span>
                        <h4 class="text-sm font-bold text-slate-900">${found.item}</h4>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-400 uppercase">Día de fechahisto</span>
                </div>

                <!-- CANVAS DE ALTA RESOLUCIÓN -->
                <div class="w-full overflow-x-auto custom-scrollbar">
                    <div style="min-width: ${minWidth}px; height: 380px; position: relative;">
                        <canvas id="canvas-tendencia-single-insumo"></canvas>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('canvas-tendencia-single-insumo');
        if (!canvas || typeof Chart === 'undefined') return;

        this.chartSingleTendenciaInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: dataValues,
                    borderColor: '#2563eb',
                    borderWidth: 2.2,
                    backgroundColor: 'rgba(37, 99, 235, 0.04)',
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#1d4ed8',
                    spanGaps: true
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
                            title: (items) => `Día de fecha: ${fechasFiltradas[items[0].dataIndex]?.label_largo || items[0].label}`,
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const p = pointMeta[idx] || {};
                                return [
                                    `Item: ${found.item}`,
                                    `tipo: ${found.tipo}`,
                                    `PU:   ${this.formatDecimal(p.pu, 3)}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        rotation: -90,
                        offset: 4,
                        color: '#1e293b',
                        font: { size: 9, weight: 'bold' },
                        formatter: (val) => val !== null ? this.formatDecimal(val, 3) : ''
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9, weight: '500' },
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
                }
            },
            plugins: [ChartDataLabels]
        });
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
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4.5,
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
                            this.onFechaGeneralClick(pt.fecha);
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    onFechaGeneralClick(fecha) {
        if (this.fechaSeleccionada === fecha) {
            this.fechaSeleccionada = null; // Toggle off para mostrar todas las fechas
        } else {
            this.fechaSeleccionada = fecha; // Filtra ÚNICAMENTE Detalle de Insumos
        }

        // 1. Actualización quirúrgica del DOM de Detalle de Insumos
        const cont = document.getElementById('contenedor-tabla-matriz-insumos');
        if (cont && this.datosBackend.insumos_matriz) {
            cont.innerHTML = this.renderTablaMatriz(this.datosBackend.insumos_matriz);
            this.bindTableEvents();
        }

        // 2. Actualizar badge de filtro de fecha en la cabecera de Detalle de Insumos
        const badgeCont = document.getElementById('badge-filtro-fecha-contenedor');
        if (badgeCont) {
            if (this.fechaSeleccionada) {
                badgeCont.innerHTML = `
                    <button id="btn-quitar-filtro-fecha" type="button"
                        class="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-2 py-0.5 transition-all cursor-pointer shadow-2xs"
                        title="Mostrar todas las fechas">
                        <span>Fecha: ${this.fechaSeleccionada}</span>
                        <i class="fas fa-times text-[10px]"></i>
                    </button>
                `;
                const btnQuitar = document.getElementById('btn-quitar-filtro-fecha');
                if (btnQuitar) {
                    btnQuitar.onclick = (e) => {
                        e.stopPropagation();
                        this.onFechaGeneralClick(this.fechaSeleccionada);
                    };
                }
            } else {
                badgeCont.innerHTML = '';
            }
        }
    },

    onInsumoSelect(coditem) {
        if (this.insumoSeleccionado === coditem) {
            this.insumoSeleccionado = null; // Toggle para ver todos los insumos
        } else {
            this.insumoSeleccionado = coditem; // Filtra Tendencia de Insumos a este insumo
        }

        // 1. Actualizar selección visual en Detalle de Insumos
        const rows = document.querySelectorAll('.row-insumo');
        rows.forEach(r => {
            const itemCode = r.getAttribute('data-coditem');
            const isSelected = (this.insumoSeleccionado === itemCode);
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

        // 2. Actualizar botón "Ver todos los insumos" en la cabecera de tendencia
        const btnQuitarInsumoCont = document.getElementById('contenedor-btn-quitar-insumo');
        if (btnQuitarInsumoCont) {
            if (this.insumoSeleccionado) {
                btnQuitarInsumoCont.innerHTML = `
                    <button id="btn-quitar-filtro-insumo" type="button"
                        class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all cursor-pointer shadow-2xs">
                        <i class="fas fa-list text-[10px]"></i>
                        <span>Ver todos los insumos</span>
                    </button>
                `;
                const btnQ = document.getElementById('btn-quitar-filtro-insumo');
                if (btnQ) {
                    btnQ.onclick = () => {
                        this.onInsumoSelect(this.insumoSeleccionado);
                    };
                }
            } else {
                btnQuitarInsumoCont.innerHTML = '';
            }
        }

        // 3. Renderizar Tendencia de Insumos (vista individual adaptativa o apilada)
        this.renderTendenciaContent();
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
                this.insumoSeleccionado = null;
                if (inputIni) inputIni.value = this.filtroTendenciaInicio;
                if (inputFin) inputFin.value = this.filtroTendenciaFin;

                const btnQuitarInsumoCont = document.getElementById('contenedor-btn-quitar-insumo');
                if (btnQuitarInsumoCont) btnQuitarInsumoCont.innerHTML = '';

                // Desmarcar filas seleccionadas en la matriz
                const rows = document.querySelectorAll('.row-insumo');
                rows.forEach(r => {
                    r.className = 'transition-colors cursor-pointer row-insumo bg-white hover:bg-slate-50';
                    if (r.children[0]) r.children[0].style.backgroundColor = '#ffffff';
                    if (r.children[1]) r.children[1].style.backgroundColor = '#ffffff';
                });

                this.renderTendenciaContent();
            });
        }
    },

    bindTableEvents() {
        const rows = document.querySelectorAll('.row-insumo');
        rows.forEach(r => {
            r.onclick = () => {
                const coditem = r.getAttribute('data-coditem');
                if (coditem) {
                    this.onInsumoSelect(coditem);
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

        const columnas = this.fechaSeleccionada 
            ? (matriz.columnas_fechas || []).filter(c => c.fecha === this.fechaSeleccionada)
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
