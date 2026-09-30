/**
 * Componente: RevisionInsumos (PLANTA ALIMENTO / ALMACEN / AnalisisCostoDiario)
 * Módulo: AnalisisCostoDiario
 * 
 * 1. Gráfica Superior: "Tendencia de Insumos Consumidos" (histcostdiaalim - Insumos 2)
 *    * Columnas Fijas: Item, transaccion, Eje Y PU (dinámico/20, 10, 0)
 *    * Gráfica de línea azul con puntos y etiquetas horizontales limpias
 *    * Eje X: Día de fecha perfectamente alineado
 *    * Hit-target amplio invisible (r=12) para evitar parpadeos en los puntos
 *    * Tooltip interactivo flotante con diseño exacto de Tableau
 *    * Scroll vertical y horizontal con columnas sticky 100% opacas
 * 
 * 2. Vista Inferior: Matriz "Detalle de Insumos que Pertencen a la Formula" (histcostdiaalim - Insumos)
 *    * Cabecera con estilo bg-blue-600 y text-white (sin bordes blancos ni desalineaciones)
 *    * Jerarquía de filas: tipo -> Item -> transaccion -> Medida (PU / peso)
 *    * Columna Total general fija (sticky left) y columnas diarias de fecha descendentes
 *    * Tooltip flotante interactivo en todas las celdas de datos (PU y peso)
 *    * Footer con estilo limpio y sutil según diseño original de Tableau ("Total")
 *    * Exportación a Excel estilizada (.xlsx con cabecera bg-blue-600 y totales)
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartRevisionInsumos = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,

    // Variables para renderizado virtual/por lotes
    itemsTendenciaFiltrados: [],
    fechasTendenciaFiltradas: [],
    indiceLoteTendencia: 0,
    TAMANO_LOTE: 30,

    formatDecimal(val, dec = 3) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        }).format(val);
    },

    formatEntero(val) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    },

    formatFechaLarga(dateStr) {
        if (!dateStr || dateStr === 'Total general' || dateStr.includes('Total')) return dateStr;
        const partes = String(dateStr).split('-');
        if (partes.length !== 3) return dateStr;
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const dia = parseInt(partes[2], 10);
        const mesIdx = parseInt(partes[1], 10) - 1;
        const mes = meses[mesIdx] || '';
        const anio = partes[0];
        return `${dia} de ${mes} de ${anio}`;
    },

    getTooltipElement() {
        let el = document.getElementById('tableau-global-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tableau-global-tooltip';
            el.className = 'fixed hidden bg-white rounded-md shadow-2xl border border-slate-300 text-xs font-sans text-slate-800 z-[99999] transition-opacity duration-75';
            el.style.pointerEvents = 'none';
            el.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.08)';
            el.style.padding = '10px 14px';
            el.style.fontSize = '12px';
            el.style.lineHeight = '1.5';
            el.style.minWidth = '230px';
            document.body.appendChild(el);
        }
        return el;
    },

    showTooltip(e, data) {
        const tooltip = this.getTooltipElement();
        if (!tooltip || !data) return;

        const { item, tipo, transaccion, diaFecha, medida, valor } = data;

        let rowsHtml = '';
        if (item) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">Item:</span>
                <span class="font-semibold text-slate-900">${item}</span>
            `;
        }
        if (tipo) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">tipo:</span>
                <span class="font-semibold text-slate-800">${tipo}</span>
            `;
        }
        if (transaccion) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">transaccion:</span>
                <span class="font-semibold text-slate-800">${transaccion}</span>
            `;
        }
        if (diaFecha) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">Día de fecha:</span>
                <span class="font-semibold text-slate-800">${this.formatFechaLarga(diaFecha)}</span>
            `;
        }
        if (medida && valor !== undefined && valor !== null && valor !== '') {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">${medida}:</span>
                <span class="font-bold text-slate-900">${valor}</span>
            `;
        }

        tooltip.innerHTML = `
            <div style="display: grid; grid-template-columns: auto 1fr; column-gap: 14px; row-gap: 3.5px; align-items: baseline;">
                ${rowsHtml}
            </div>
        `;

        tooltip.classList.remove('hidden');
        this.positionTooltip(e, tooltip);
    },

    positionTooltip(e, tooltip) {
        const offset = 14;
        let x = e.clientX + offset;
        let y = e.clientY + offset;

        const tooltipRect = tooltip.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        if (x + tooltipRect.width > winWidth - 10) {
            x = e.clientX - tooltipRect.width - offset;
        }
        if (y + tooltipRect.height > winHeight - 10) {
            y = e.clientY - tooltipRect.height - offset;
        }

        tooltip.style.left = `${Math.max(8, x)}px`;
        tooltip.style.top = `${Math.max(8, y)}px`;
    },

    hideTooltip() {
        const tooltip = document.getElementById('tableau-global-tooltip');
        if (tooltip) {
            tooltip.classList.add('hidden');
        }
    },

    render(controller, data, targetContainer = null) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof targetContainer === 'string' ? document.getElementById(targetContainer) : targetContainer) 
            || document.getElementById('contenedor-graficos-lista');

        this.renderView();
    },

    renderView() {
        const contenedor = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const tendenciaSeries = data.tendencia_insumos || [];
        const matriz = data.matriz_insumos || { columnas_fechas: [], items: [] };
        const resumen = data.resumen || {};

        if (tendenciaSeries.length === 0 && matriz.items.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fas fa-filter text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para los filtros seleccionados</h3>
                    <p class="text-xs text-slate-400 mt-1">Intenta ajustando el rango de fechas, fecha histórica o los ítems en el panel superior.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = `
            <div class="flex flex-col gap-6 w-full">
                
                <!-- 1. GRÁFICA SUPERIOR: Tendencia de Insumos Consumidos -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <i class="fas fa-chart-line text-sm"></i>
                            </div>
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Tendencia de Insumos Consumidos</h2>
                                <p class="text-xs text-slate-500">
                                    Fecha Histórica: <span class="font-bold text-slate-700">${data.fechahisto || ''}</span> | 
                                    Período: ${data.fecha_inicio || ''} al ${data.fecha_fin || ''} | 
                                    ${resumen.total_dias || 0} Días
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <span class="text-slate-500">Total Peso: <strong class="text-blue-700">${this.formatDecimal(resumen.total_peso, 2)} kg</strong></span>
                                <span class="text-slate-300">|</span>
                                <span class="text-slate-500">Total Valor: <strong class="text-emerald-700">S/ ${this.formatDecimal(resumen.total_valor, 2)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 sm:p-5">
                        <!-- BANNER TITULO TABLEAU -->
                        <div class="text-center font-bold text-sm sm:text-base text-slate-900 mb-3 select-none tracking-tight">
                            <u>Tendencia de Insumos Consumidos</u>
                        </div>

                        <!-- CONTENEDOR DE GRÁFICAS DE TENDENCIA CON SCROLL VERTICAL Y HORIZONTAL -->
                        <div id="contenedor-revision-tendencias-scroll" class="p-0 overflow-x-auto overflow-y-auto max-h-[440px] custom-scrollbar border border-slate-200 rounded-xl bg-white">
                            <!-- Generado dinámicamente -->
                        </div>
                    </div>
                </div>

                <!-- 2. VISTA INFERIOR: Detalle de Insumos que Pertenecen a la Formula -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
                        <div class="text-center w-full font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                            <u>Detalle de Insumos que Pertencen a la Formula</u>
                        </div>
                        <button id="btn-exportar-revision-excel" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs ml-auto shrink-0">
                            <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>

                    <!-- TABLA MATRIZ JERÁRQUICA CON SCROLL VERTICAL Y HORIZONTAL -->
                    <div class="p-0 overflow-x-auto overflow-y-auto max-h-[540px] custom-scrollbar border-b border-slate-200">
                        <div id="contenedor-tabla-matriz-revision">
                            ${this.renderTablaMatriz(matriz, resumen)}
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.renderTendenciaStackedView();
        this.setupEventListeners();
    },

    renderTendenciaStackedView() {
        const contScroll = document.getElementById('contenedor-revision-tendencias-scroll');
        if (!contScroll) return;

        const data = this.datosBackend || {};
        const fechas = data.columnas_fechas || [];
        const items = data.tendencia_insumos || [];

        this.itemsTendenciaFiltrados = items;
        this.fechasTendenciaFiltradas = fechas;
        this.indiceLoteTendencia = 0;

        if (items.length === 0 || fechas.length === 0) {
            contScroll.innerHTML = `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron datos de tendencia.
                </div>
            `;
            return;
        }

        const stickyColsWidth = 170 + 65 + 45; // 280px
        const contWidth = contScroll.clientWidth || 1100;
        const itemWidth = Math.max(contWidth - stickyColsWidth - 10, fechas.length * 52);

        // Estructura fija con Cabecera bg-blue-600 y text-white
        contScroll.innerHTML = `
            <div style="min-width: ${stickyColsWidth + itemWidth}px;" class="select-none relative">
                
                <!-- HEADER SUPERIOR DE TENDENCIA: Item + transaccion + PU + Fechas -->
                <div class="flex items-center text-white font-bold text-[11px] sticky top-0 shadow-2xs" style="background-color: #2563eb; z-index: 35;">
                    <div class="w-[170px] min-w-[170px] py-2.5 px-3 border-r border-blue-500 sticky left-0 text-white" style="background-color: #2563eb; z-index: 38;">
                        Item
                    </div>
                    <div class="w-[65px] min-w-[65px] py-2.5 px-2 text-center border-r border-blue-500 sticky left-[170px] text-white" style="background-color: #2563eb; z-index: 38;">
                        transaccion
                    </div>
                    <div class="w-[45px] min-w-[45px] py-2.5 px-1 text-center border-r border-blue-500 sticky left-[235px] text-[10px] text-blue-100" style="background-color: #2563eb; z-index: 38;">
                        PU
                    </div>
                    <div class="py-2.5 px-3 text-center grow font-bold text-white" style="background-color: #2563eb;">
                        Día de fecha
                    </div>
                </div>

                <!-- CONTENEDOR DE FILAS DE INSUMOS APILADAS -->
                <div id="lista-filas-tendencia-revision" class="divide-y divide-slate-200 bg-white">
                </div>

                <!-- EJE X INFERIOR CON FECHAS -->
                <div class="flex items-start border-t border-slate-200 sticky bottom-0 shadow-2xs" style="background-color: #f8fafc; z-index: 35;">
                    <div class="w-[170px] min-w-[170px] sticky left-0 border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    <div class="w-[65px] min-w-[65px] sticky left-[170px] border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    <div class="w-[45px] min-w-[45px] sticky left-[235px] border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    
                    <div class="grow h-[85px] relative" style="background-color: #f8fafc;">
                        <svg width="${itemWidth}" height="85" viewBox="0 0 ${itemWidth} 85" class="w-full h-full block" style="pointer-events: none;">
                            ${this.generarSvgEjeXFechas(fechas, itemWidth)}
                        </svg>
                    </div>
                </div>

            </div>
        `;

        this.renderSiguienteLoteTendencia(itemWidth);

        // Scroll infinito bajo demanda
        contScroll.onscroll = () => {
            if (contScroll.scrollTop + contScroll.clientHeight >= contScroll.scrollHeight - 300) {
                this.renderSiguienteLoteTendencia(itemWidth);
            }
        };
    },

    generarSvgEjeXFechas(fechas, itemWidth) {
        const padLeft = 24;
        const padRight = 24;
        const drawWidth = itemWidth - padLeft - padRight;
        const stepX = fechas.length > 1 ? drawWidth / (fechas.length - 1) : drawWidth;

        let svg = '';
        fechas.forEach((f, idx) => {
            const x = padLeft + idx * stepX;
            const labelFecha = f.dia_mes || f.ymd || f.fecha;
            svg += `
                <line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="6" stroke="#cbd5e1" stroke-width="1" style="pointer-events: none;" />
                <text x="${x.toFixed(1)}" y="12" 
                    transform="rotate(-90 ${x.toFixed(1)} 12)" 
                    text-anchor="end" font-size="9" font-family="sans-serif" 
                    font-weight="500" fill="#475569" style="pointer-events: none; user-select: none;">
                    ${labelFecha}
                </text>
            `;
        });
        return svg;
    },

    renderSiguienteLoteTendencia(itemWidthParam = null) {
        const listaCont = document.getElementById('lista-filas-tendencia-revision');
        if (!listaCont) return;

        const totalItems = this.itemsTendenciaFiltrados.length;
        if (this.indiceLoteTendencia >= totalItems) return;

        const finLote = Math.min(this.indiceLoteTendencia + this.TAMANO_LOTE, totalItems);
        const lote = this.itemsTendenciaFiltrados.slice(this.indiceLoteTendencia, finLote);
        this.indiceLoteTendencia = finLote;

        const fechas = this.fechasTendenciaFiltradas;
        const stickyColsWidth = 170 + 65 + 45;
        const contScroll = document.getElementById('contenedor-revision-tendencias-scroll');
        const contWidth = contScroll ? contScroll.clientWidth : 1100;
        const itemWidth = itemWidthParam || Math.max(contWidth - stickyColsWidth - 10, fechas.length * 52);

        const itemHeight = 60;
        const padTop = 16;
        const padBottom = 8;
        const padLeft = 24;
        const padRight = 24;
        const drawWidth = itemWidth - padLeft - padRight;
        const drawHeight = itemHeight - padTop - padBottom;
        const stepX = fechas.length > 1 ? drawWidth / (fechas.length - 1) : drawWidth;

        const fragment = document.createDocumentFragment();

        lote.forEach(it => {
            // Calcular escala Y dinámica según el valor máximo de este ítem
            let maxPU = 0;
            it.puntos.forEach(p => {
                if (p.pu !== null && p.pu !== undefined && p.pu > maxPU) {
                    maxPU = p.pu;
                }
            });

            let maxY = 20;
            let ticks = [20, 10, 0];

            if (maxPU > 20) {
                maxY = Math.ceil(maxPU / 5) * 5;
                const mid = Math.round(maxY / 2);
                ticks = [maxY, mid, 0];
            } else if (maxPU > 0 && maxPU <= 3) {
                maxY = 20;
                ticks = [20, 10, 0];
            }

            const getY = (pu) => {
                const clamped = Math.min(maxY, Math.max(0, pu));
                return padTop + drawHeight - (clamped / maxY) * drawHeight;
            };

            const yTop = getY(ticks[0]);
            const yMid = getY(ticks[1]);
            const y0   = getY(0);

            let pathD = '';
            let pointsSvg = '';
            let hasFirst = false;

            it.puntos.forEach((p, pIdx) => {
                const x = padLeft + pIdx * stepX;

                if (p.pu !== null && p.pu !== undefined) {
                    const pu = p.pu;
                    const y = getY(pu);

                    if (!hasFirst) {
                        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                        hasFirst = true;
                    } else {
                        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                    }

                    const labelText = this.formatDecimal(pu, 3);

                    // Grupo interactivo con hit-target invisible de 24px (r=12)
                    pointsSvg += `
                        <g class="data-point-target" style="cursor: pointer;"
                            data-item="${encodeURIComponent(it.item)}"
                            data-tipo="${encodeURIComponent(it.tipo)}"
                            data-transaccion="${encodeURIComponent(it.transaccion)}"
                            data-fecha="${p.fecha}"
                            data-pu="${labelText}">
                            <!-- Hit target invisible generoso para estabilidad total sin parpadeo -->
                            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="transparent"></circle>
                            <!-- Punto visible -->
                            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" 
                                fill="#2563eb" stroke="#ffffff" stroke-width="1.4" 
                                style="pointer-events: none;">
                            </circle>
                            <!-- Etiqueta de valor -->
                            <text x="${x.toFixed(1)}" y="${(y - 5).toFixed(1)}" 
                                text-anchor="middle" font-size="9" font-family="sans-serif" font-weight="600" 
                                fill="#1e293b" style="pointer-events: none; user-select: none;">${labelText}</text>
                        </g>
                    `;
                }
            });

            const rowDiv = document.createElement('div');
            rowDiv.id = `revision-row-${it.key}`;
            rowDiv.className = `flex items-center bg-white hover:bg-slate-50/60 transition-colors`;

            rowDiv.innerHTML = `
                <!-- 1. Columna Item (Sticky Izquierda, 100% Opaco) -->
                <div class="w-[170px] min-w-[170px] p-2.5 sticky left-0 border-r border-slate-200 flex flex-col justify-center" style="background-color: #ffffff; z-index: 25;">
                    <span class="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2" title="${it.item}">
                        ${it.item}
                    </span>
                </div>

                <!-- 2. Columna Transaccion (Sticky Izquierda, 100% Opaco) -->
                <div class="w-[65px] min-w-[65px] h-[${itemHeight}px] sticky left-[170px] border-r border-slate-200 flex items-center justify-center text-[10.5px] font-semibold text-slate-600" style="background-color: #ffffff; z-index: 25;">
                    ${it.transaccion}
                </div>

                <!-- 3. Columna Eje Y PU (Sticky Izquierda, 100% Opaco) -->
                <div class="w-[45px] min-w-[45px] h-[${itemHeight}px] sticky left-[235px] border-r border-slate-200 flex flex-col justify-between items-end py-1 px-1.5 text-[8.5px] font-semibold text-slate-400 select-none" style="background-color: #ffffff; z-index: 25;">
                    <span>${ticks[0]}</span>
                    <span>${ticks[1]}</span>
                    <span>${ticks[2]}</span>
                </div>

                <!-- 4. Área de Gráfica SVG -->
                <div class="grow h-[${itemHeight}px] relative bg-transparent overflow-hidden" style="z-index: 10;">
                    <svg width="${itemWidth}" height="${itemHeight}" viewBox="0 0 ${itemWidth} ${itemHeight}" class="w-full h-full block">
                        <!-- Líneas de cuadrícula a top, mid y 0 -->
                        <line x1="0" y1="${yTop.toFixed(1)}" x2="${itemWidth}" y2="${yTop.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" style="pointer-events: none;" />
                        <line x1="0" y1="${yMid.toFixed(1)}" x2="${itemWidth}" y2="${yMid.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" style="pointer-events: none;" />
                        <line x1="0" y1="${y0.toFixed(1)}" x2="${itemWidth}" y2="${y0.toFixed(1)}" stroke="#e2e8f0" stroke-width="1" style="pointer-events: none;" />
                        
                        <!-- Línea de datos -->
                        ${pathD ? `<path d="${pathD}" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" style="pointer-events: none;" />` : ''}
                        
                        <!-- Puntos interactivos y etiquetas -->
                        ${pointsSvg}
                    </svg>
                </div>
            `;

            fragment.appendChild(rowDiv);
        });

        listaCont.appendChild(fragment);
    },

    renderTablaMatriz(matriz, resumen = {}) {
        const todasColumnas = matriz.columnas_fechas || [];
        const items = matriz.items || [];
        const totalesPorDia = matriz.totales_por_dia || resumen.totales_por_dia || {};

        if (items.length === 0) {
            return `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron insumos para los filtros seleccionados.
                </div>
            `;
        }

        // Ordenar fechas descendentemente (como en Tableau: más reciente a la izquierda)
        const columnasDesc = [...todasColumnas].reverse();

        // Totales globales
        const granTotalPeso = resumen.total_peso || items.reduce((acc, it) => acc + (it.total_peso || 0), 0);
        const granTotalValor = resumen.total_valor || items.reduce((acc, it) => acc + (it.total_valor || 0), 0);
        const puGlobal = resumen.pu_promedio || (granTotalPeso > 0 ? granTotalValor / granTotalPeso : 0);

        let html = `
            <table class="w-full text-left text-xs select-none" style="border-collapse: separate; border-spacing: 0;">
                <thead>
                    <!-- SUPER-HEADER TABLEAU: tipo, Item, transa.., Medida, Total general + Día de fecha -->
                    <tr class="bg-blue-600 text-white font-bold">
                        <th rowspan="2" class="py-2 px-3 whitespace-nowrap sticky top-0 left-0 z-30 text-[11px] text-white" 
                            style="background-color: #2563eb; width: 80px; min-width: 80px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            tipo
                        </th>
                        <th rowspan="2" class="py-2 px-3 whitespace-nowrap sticky top-0 left-[80px] z-30 text-[11px] text-white" 
                            style="background-color: #2563eb; width: 220px; min-width: 220px; max-width: 280px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            Item
                        </th>
                        <th rowspan="2" class="py-2 px-2 text-center whitespace-nowrap sticky top-0 left-[300px] z-30 text-[11px] text-white" 
                            style="background-color: #2563eb; width: 65px; min-width: 65px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            transa..
                        </th>
                        <th rowspan="2" class="py-2 px-2 text-center whitespace-nowrap sticky top-0 left-[365px] z-30 text-[10px] text-blue-100" 
                            style="background-color: #2563eb; width: 55px; min-width: 55px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            Medida
                        </th>
                        <th rowspan="2" class="py-2 px-3 text-right whitespace-nowrap sticky top-0 left-[420px] z-30 text-[11px] text-white" 
                            style="background-color: #1d4ed8; width: 105px; min-width: 105px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1e40af;">
                            Total general
                        </th>
                        <th colspan="${columnasDesc.length}" class="py-1.5 px-3 text-center sticky top-0 z-20 text-[11px] text-white font-bold" 
                            style="background-color: #2563eb; border-bottom: 1px solid #3b82f6; height: 26px;">
                            Día de fecha
                        </th>
                    </tr>
                    <!-- SUB-HEADER CON FECHAS DIARIAS -->
                    <tr class="bg-blue-600 text-white font-bold">
        `;

        columnasDesc.forEach(col => {
            html += `
                <th class="py-1.5 px-2.5 text-center whitespace-nowrap sticky top-[26px] z-20 text-[10px] text-white" 
                    style="background-color: #2563eb; min-width: 88px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                    <div class="font-bold text-white">${col.dia_semana || ''},</div>
                    <div class="text-[9.5px] text-blue-100 font-normal">${col.ymd || col.fecha}</div>
                </th>
            `;
        });

        html += `
                    </tr>
                </thead>
                <tbody class="bg-white font-medium text-slate-700">
        `;

        let currentTipo = '';

        items.forEach((it, idx) => {
            const isFirstOfTipo = (it.tipo !== currentTipo);
            if (isFirstOfTipo) currentTipo = it.tipo;

            const bgRow = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';

            const encodedItem = encodeURIComponent(it.item);
            const encodedTipo = encodeURIComponent(it.tipo);
            const encodedTrans = encodeURIComponent(it.transaccion);

            // FILA 1: MEDIDA PU
            html += `
                <tr class="transition-colors hover:bg-slate-50/80">
                    <td rowspan="2" class="py-1.5 px-3 sticky left-0 z-10 text-[11px] text-slate-600 font-semibold truncate align-top" 
                        style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                        ${it.tipo}
                    </td>
                    <td rowspan="2" class="py-1.5 px-3 sticky left-[80px] z-10 min-w-[220px] max-w-[280px] truncate text-[11px] align-top" 
                        style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;" title="${it.item}">
                        <span class="text-slate-900 truncate font-semibold">${it.item}</span>
                    </td>
                    <td rowspan="2" class="py-1.5 px-2 text-center sticky left-[300px] z-10 text-[11px] text-slate-600 font-medium align-top" 
                        style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                        ${it.transaccion}
                    </td>
                    
                    <!-- MEDIDA PU -->
                    <td class="py-1 px-2 text-center sticky left-[365px] z-10 text-[10px] text-slate-500 font-bold" 
                        style="background-color: ${bgRow}; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        PU
                    </td>
                    <td class="py-1 px-3 text-right sticky left-[420px] z-10 text-[11px] font-bold text-slate-900 cursor-default hover:bg-blue-100" 
                        style="background-color: #eff6ff; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #f1f5f9;"
                        data-tooltip="1"
                        data-item="${encodedItem}"
                        data-tipo="${encodedTipo}"
                        data-transaccion="${encodedTrans}"
                        data-fecha="Total general"
                        data-medida="PU"
                        data-valor="${this.formatDecimal(it.pu_promedio, 3)}">
                        ${this.formatDecimal(it.pu_promedio, 3)}
                    </td>
            `;

            columnasDesc.forEach(col => {
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                const cellText = valObj && valObj.pu !== null ? this.formatDecimal(valObj.pu, 3) : '';
                html += `
                    <td class="py-1 px-2 text-right text-[11px] text-slate-800 whitespace-nowrap cursor-default hover:bg-blue-50/70" 
                        style="background-color: ${bgRow}; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;"
                        ${cellText ? `data-tooltip="1" data-item="${encodedItem}" data-tipo="${encodedTipo}" data-transaccion="${encodedTrans}" data-fecha="${col.fecha}" data-medida="PU" data-valor="${cellText}"` : ''}>
                        ${cellText}
                    </td>
                `;
            });

            html += `</tr>`;

            // FILA 2: MEDIDA PESO
            html += `
                <tr class="transition-colors hover:bg-slate-50/80">
                    <!-- MEDIDA PESO -->
                    <td class="py-1 px-2 text-center sticky left-[365px] z-10 text-[10px] text-slate-400 font-semibold" 
                        style="background-color: ${bgRow}; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                        peso
                    </td>
                    <td class="py-1 px-3 text-right sticky left-[420px] z-10 text-[11px] text-blue-700 font-semibold cursor-default hover:bg-blue-100" 
                        style="background-color: #eff6ff; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;"
                        data-tooltip="1"
                        data-item="${encodedItem}"
                        data-tipo="${encodedTipo}"
                        data-transaccion="${encodedTrans}"
                        data-fecha="Total general"
                        data-medida="peso"
                        data-valor="${this.formatDecimal(it.total_peso, 2)}">
                        ${this.formatDecimal(it.total_peso, 2)}
                    </td>
            `;

            columnasDesc.forEach(col => {
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                const cellText = valObj && valObj.peso !== null && valObj.peso > 0 ? this.formatDecimal(valObj.peso, 2) : '';
                html += `
                    <td class="py-1 px-2 text-right text-[10.5px] text-slate-500 whitespace-nowrap cursor-default hover:bg-blue-50/70" 
                        style="background-color: ${bgRow}; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #e2e8f0;"
                        ${cellText ? `data-tooltip="1" data-item="${encodedItem}" data-tipo="${encodedTipo}" data-transaccion="${encodedTrans}" data-fecha="${col.fecha}" data-medida="peso" data-valor="${cellText}"` : ''}>
                        ${cellText}
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                </tbody>

                <!-- FOOTER TOTAL GENERAL (DISEÑO EXACTO TABLEAU) -->
                <tfoot class="sticky bottom-0 z-30 font-medium bg-white">
                    <!-- FILA 1: MEDIDA PU -->
                    <tr class="bg-white">
                        <td class="py-1.5 px-3 sticky left-0 z-40 text-[11px] font-semibold text-slate-700" 
                            style="background-color: #ffffff; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                            Total
                        </td>
                        <td class="py-1.5 px-3 sticky left-[80px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        </td>
                        <td class="py-1.5 px-2 text-center sticky left-[300px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        </td>
                        <td class="py-1 px-2 text-center sticky left-[365px] z-40 text-[10px] text-slate-600 font-bold" 
                            style="background-color: #ffffff; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                            PU
                        </td>
                        <td class="py-1 px-3 text-right sticky left-[420px] z-40 text-[11px] font-bold text-slate-900 cursor-default hover:bg-slate-100" 
                            style="background-color: #f1f5f9; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #f1f5f9;"
                            data-tooltip="1"
                            data-item="Total general"
                            data-tipo="(Todo)"
                            data-transaccion="(Todo)"
                            data-fecha="Total general"
                            data-medida="PU"
                            data-valor="${this.formatDecimal(puGlobal, 3)}">
                            ${this.formatDecimal(puGlobal, 3)}
                        </td>
        `;

        columnasDesc.forEach(col => {
            const totCol = totalesPorDia[col.fecha] || null;
            const puVal = totCol && totCol.pu > 0 ? this.formatDecimal(totCol.pu, 3) : '';
            html += `
                <td class="py-1 px-2 text-right text-[11px] font-semibold text-slate-800 whitespace-nowrap cursor-default hover:bg-slate-50" 
                    style="background-color: #ffffff; border-top: 1.5px solid #cbd5e1; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;"
                    ${puVal ? `data-tooltip="1" data-item="Total general" data-tipo="(Todo)" data-transaccion="(Todo)" data-fecha="${col.fecha}" data-medida="PU" data-valor="${puVal}"` : ''}>
                    ${puVal}
                </td>
            `;
        });

        html += `
                    </tr>

                    <!-- FILA 2: MEDIDA PESO -->
                    <tr class="bg-white">
                        <td class="py-1.5 px-3 sticky left-0 z-40 text-[11px]" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1;">
                        </td>
                        <td class="py-1.5 px-3 sticky left-[80px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1;">
                        </td>
                        <td class="py-1.5 px-2 text-center sticky left-[300px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1;">
                        </td>
                        <td class="py-1 px-2 text-center sticky left-[365px] z-40 text-[10px] text-slate-400 font-semibold" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1;">
                            peso
                        </td>
                        <td class="py-1 px-3 text-right sticky left-[420px] z-40 text-[11px] text-blue-700 font-semibold cursor-default hover:bg-slate-100" 
                            style="background-color: #f1f5f9; border-right: 1px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1;"
                            data-tooltip="1"
                            data-item="Total general"
                            data-tipo="(Todo)"
                            data-transaccion="(Todo)"
                            data-fecha="Total general"
                            data-medida="peso"
                            data-valor="${this.formatDecimal(granTotalPeso, 2)}">
                            ${this.formatDecimal(granTotalPeso, 2)}
                        </td>
        `;

        columnasDesc.forEach(col => {
            const totCol = totalesPorDia[col.fecha] || null;
            const pesoVal = totCol && totCol.peso > 0 ? this.formatDecimal(totCol.peso, 2) : '';
            html += `
                <td class="py-1 px-2 text-right text-[10.5px] text-slate-600 whitespace-nowrap cursor-default hover:bg-slate-50" 
                    style="background-color: #ffffff; border-right: 1px solid #f1f5f9; border-bottom: 1.5px solid #cbd5e1;"
                    ${pesoVal ? `data-tooltip="1" data-item="Total general" data-tipo="(Todo)" data-transaccion="(Todo)" data-fecha="${col.fecha}" data-medida="peso" data-valor="${pesoVal}"` : ''}>
                    ${pesoVal}
                </td>
            `;
        });

        html += `
                    </tr>
                </tfoot>
            </table>
        `;

        return html;
    },

    setupEventListeners() {
        const btnExport = document.getElementById('btn-exportar-revision-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                this.exportarExcel();
            };
        }

        // Delegación de eventos para el Tooltip interactivo (en gráfico y en tabla)
        const cont = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (cont && !cont._hasRevisionTooltipEvents) {
            cont._hasRevisionTooltipEvents = true;

            cont.addEventListener('mouseover', (e) => {
                // 1. Grupo de punto en gráfico de líneas
                const pointGroup = e.target.closest('.data-point-target');
                if (pointGroup) {
                    const item = decodeURIComponent(pointGroup.getAttribute('data-item') || '');
                    const tipo = decodeURIComponent(pointGroup.getAttribute('data-tipo') || '');
                    const transaccion = decodeURIComponent(pointGroup.getAttribute('data-transaccion') || '');
                    const diaFecha = pointGroup.getAttribute('data-fecha');
                    const valor = pointGroup.getAttribute('data-pu');
                    this.showTooltip(e, {
                        item,
                        tipo,
                        transaccion,
                        diaFecha,
                        medida: 'PU',
                        valor
                    });
                    return;
                }

                // 2. Celda de tabla con data-tooltip
                const cell = e.target.closest('[data-tooltip="1"]');
                if (cell) {
                    const item = decodeURIComponent(cell.getAttribute('data-item') || '');
                    const tipo = decodeURIComponent(cell.getAttribute('data-tipo') || '');
                    const transaccion = decodeURIComponent(cell.getAttribute('data-transaccion') || '');
                    const diaFecha = cell.getAttribute('data-fecha');
                    const medida = cell.getAttribute('data-medida');
                    const valor = cell.getAttribute('data-valor');

                    if (valor) {
                        this.showTooltip(e, {
                            item,
                            tipo,
                            transaccion,
                            diaFecha,
                            medida,
                            valor
                        });
                    }
                    return;
                }
            });

            cont.addEventListener('mousemove', (e) => {
                const tooltip = document.getElementById('tableau-global-tooltip');
                if (tooltip && !tooltip.classList.contains('hidden')) {
                    this.positionTooltip(e, tooltip);
                }
            });

            cont.addEventListener('mouseout', (e) => {
                const related = e.relatedTarget;
                const leavingPoint = e.target.closest('.data-point-target');
                const leavingCell = e.target.closest('[data-tooltip="1"]');

                if (leavingPoint || leavingCell) {
                    if (!related || (!related.closest('.data-point-target') && !related.closest('[data-tooltip="1"]'))) {
                        this.hideTooltip();
                    }
                }
            });
        }
    },

    exportarExcel() {
        const matriz = this.datosBackend.matriz_insumos || { columnas_fechas: [], items: [] };
        const resumen = this.datosBackend.resumen || {};
        const totalesPorDia = matriz.totales_por_dia || resumen.totales_por_dia || {};

        if (typeof XLSX === 'undefined') {
            alert('Exportando datos a Excel...');
            return;
        }

        const columnas = matriz.columnas_fechas || [];

        // Estilos Oficiales bg-blue-600 para Cabeceras Excel (xlsx-js-style)
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

        const footerPuStyle = {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "0F172A" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "94A3B8" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const footerPesoStyle = {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1D4ED8" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "medium", color: { rgb: "94A3B8" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
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
        const headers = ['Tipo', 'Item', 'Transacción', 'Medida', 'Total general'];
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

        // Filas 1..N: Datos (2 filas por cada ítem: PU y Peso)
        let rIdx = 1;
        (matriz.items || []).forEach(it => {
            // Fila PU
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: it.tipo || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: it.item || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: it.transaccion || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 's', v: 'PU', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 4 })] = { t: 'n', v: Number(it.pu_promedio || 0), z: '#,##0.000', s: numberStyleRight };

            columnas.forEach((col, cOffset) => {
                const cIdx = 5 + cOffset;
                const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                if (valObj && valObj.pu !== null && valObj.pu !== undefined) {
                    ws[refCell] = { t: 'n', v: Number(valObj.pu), z: '#,##0.000', s: numberStyleRight };
                } else {
                    ws[refCell] = { t: 's', v: '', s: textStyleLeft };
                }
            });

            rIdx++;

            // Fila Peso
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: it.tipo || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: it.item || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: it.transaccion || '', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 's', v: 'peso', s: textStyleLeft };
            ws[XLSX.utils.encode_cell({ r: rIdx, c: 4 })] = { t: 'n', v: Number(it.total_peso || 0), z: '#,##0.00', s: numberStyleRight };

            columnas.forEach((col, cOffset) => {
                const cIdx = 5 + cOffset;
                const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                if (valObj && valObj.peso !== null && valObj.peso !== undefined && valObj.peso > 0) {
                    ws[refCell] = { t: 'n', v: Number(valObj.peso), z: '#,##0.00', s: numberStyleRight };
                } else {
                    ws[refCell] = { t: 's', v: '', s: textStyleLeft };
                }
            });

            rIdx++;
        });

        // Totales Footer en Excel
        const granTotalPeso = resumen.total_peso || (matriz.items || []).reduce((acc, it) => acc + (it.total_peso || 0), 0);
        const granTotalValor = resumen.total_valor || (matriz.items || []).reduce((acc, it) => acc + (it.total_valor || 0), 0);
        const puGlobal = resumen.pu_promedio || (granTotalPeso > 0 ? granTotalValor / granTotalPeso : 0);

        // Footer Fila PU
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: 'TOTAL', s: { ...footerPuStyle, alignment: { horizontal: 'left' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: '', s: footerPuStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: '', s: footerPuStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 's', v: 'PU', s: { ...footerPuStyle, alignment: { horizontal: 'center' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 4 })] = { t: 'n', v: Number(puGlobal), z: '#,##0.000', s: footerPuStyle };

        columnas.forEach((col, cOffset) => {
            const cIdx = 5 + cOffset;
            const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
            const totCol = totalesPorDia[col.fecha];
            if (totCol && totCol.pu > 0) {
                ws[refCell] = { t: 'n', v: Number(totCol.pu), z: '#,##0.000', s: footerPuStyle };
            } else {
                ws[refCell] = { t: 's', v: '', s: footerPuStyle };
            }
        });

        rIdx++;

        // Footer Fila Peso
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: '', s: footerPesoStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: '', s: footerPesoStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: '', s: footerPesoStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 's', v: 'peso', s: { ...footerPesoStyle, alignment: { horizontal: 'center' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 4 })] = { t: 'n', v: Number(granTotalPeso), z: '#,##0.00', s: footerPesoStyle };

        columnas.forEach((col, cOffset) => {
            const cIdx = 5 + cOffset;
            const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
            const totCol = totalesPorDia[col.fecha];
            if (totCol && totCol.peso > 0) {
                ws[refCell] = { t: 'n', v: Number(totCol.peso), z: '#,##0.00', s: footerPesoStyle };
            } else {
                ws[refCell] = { t: 's', v: '', s: footerPesoStyle };
            }
        });

        rIdx++;

        const range = { s: { r: 0, c: 0 }, e: { r: rIdx - 1, c: headers.length - 1 } };
        ws['!ref'] = XLSX.utils.encode_range(range);

        // Auto Column Widths
        const colWidths = [
            { wch: 14 }, // Tipo
            { wch: 36 }, // Item
            { wch: 14 }, // Transaccion
            { wch: 10 }, // Medida
            { wch: 16 }, // Total general
        ];
        columnas.forEach(() => {
            colWidths.push({ wch: 18 });
        });
        ws['!cols'] = colWidths;

        // Alturas de filas
        const rowHeights = [{ hpt: 26 }];
        for (let r = 1; r < rIdx; r++) {
            rowHeights.push({ hpt: 19 });
        }
        ws['!rows'] = rowHeights;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Insumos Formula');

        const fHisto = this.datosBackend.fechahisto || '';
        const fIni = this.datosBackend.fecha_inicio || '';
        const fFin = this.datosBackend.fecha_fin || '';
        XLSX.writeFile(wb, `Revision_Insumos_${fHisto}_${fIni}_${fFin}.xlsx`);
    }
};

window.ChartRegistry['RevisionInsumos'] = window.ChartRevisionInsumos;
window.ChartRegistry['Dash_RevisionInsumos'] = window.ChartRevisionInsumos;
