/**
 * Componente: RevisionAlimento (PLANTA ALIMENTO / ALMACEN / AnalisisCostoDiario)
 * Módulo: AnalisisCostoDiario
 * 
 * 1. Gráfico Superior Izquierdo: "Costo Formula / Costo mas Factor" (histcostdiaalim2 - Alimento 3)
 *    * Dos sub-gráficas apiladas compartiendo eje X (Día de fecha)
 *    * Fila 1: Eje Y PU (Costo de fórmula sin factor) con paleta divergente Verde -> Rojo según costo
 *    * Fila 2: Eje Y PU + CF(0.114) + CM(0.013) (Costo más factor)
 *    * Líneas limpias con marcadores circulares y etiquetas numéricas legibles (3 decimales)
 *    * Hit-targets invisibles (r=12) para estabilidad total del tooltip flotante estilo Tableau
 * 
 * 2. Gráfico Superior Derecho: "Costo de Formula Individual por Alimento" (histcostdiaalim2 - Alimento 2)
 *    * Matriz de líneas individuales por alimento (small-multiples / apiladas)
 *    * Columna sticky izquierda: Nombre del ítem y escala Y (PU)
 *    * Líneas cronológicas coloreadas según el tipo de AABB con puntos y etiquetas de valor
 *    * Scroll vertical limpio con scrollbar personalizado
 * 
 * 3. Vista Inferior: Matriz "Detalle de Costos de Formula por Tipo de AABB" (histcostdiaalim2 - Alimento)
 *    * Cabecera oficial bg-blue-600 con texto blanco
 *    * Jerarquía de filas: tipo -> Item (ordenado por PU DESC) -> Medida (PU / peso)
 *    * Subtotales ponderados por cada tipo de AABB y Total General en footer
 *    * Columna Total general fija (sticky left) y columnas diarias de fecha descendentes
 *    * Tooltip flotante interactivo en celdas de datos
 *    * Exportación a Excel estilizada (.xlsx con xlsx-js-style)
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartRevisionAlimento = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,

    // Formateadores numéricos
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

    // Paleta Divergente Rojo-Verde estilo Tableau (reverse=true: menor valor = verde, mayor valor = rojo)
    getDivergingColor(val, minVal, maxVal) {
        if (minVal >= maxVal) return '#16a34a';
        const ratio = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
        if (ratio < 0.5) {
            const t = ratio * 2;
            const r = Math.round(22 + (217 - 22) * t);
            const g = Math.round(163 + (119 - 163) * t);
            const b = Math.round(74 + (6 - 74) * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            const t = (ratio - 0.5) * 2;
            const r = Math.round(217 + (220 - 217) * t);
            const g = Math.round(119 + (38 - 119) * t);
            const b = Math.round(6 + (38 - 6) * t);
            return `rgb(${r}, ${g}, ${b})`;
        }
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

        const { item, tipo, diaFecha, medida, valor, peso, valorSoles } = data;

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
        if (peso !== undefined && peso !== null) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">peso:</span>
                <span class="font-semibold text-slate-800">${this.formatDecimal(peso, 2)} kg</span>
            `;
        }
        if (valorSoles !== undefined && valorSoles !== null) {
            rowsHtml += `
                <span class="text-slate-500 font-normal select-none">valor:</span>
                <span class="font-semibold text-slate-800">S/ ${this.formatDecimal(valorSoles, 2)}</span>
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
        const generalData = data.grafico_general || { puntos: [] };
        const individualData = data.grafico_individual || { series: [] };
        const matriz = data.matriz_alimento || { columnas_fechas: [], items: [], subtotales_tipo: [] };
        const resumen = data.resumen || {};

        if (generalData.puntos.length === 0 && matriz.items.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fas fa-filter text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para los filtros seleccionados</h3>
                    <p class="text-xs text-slate-400 mt-1">Intenta ajustando la fecha en el panel superior.</p>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = `
            <div class="flex flex-col gap-6 w-full">
                
                <!-- SECCIÓN SUPERIOR: 2 GRÁFICOS (IZQUIERDA: GENERAL / DERECHA: INDIVIDUAL) -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
                    
                    <!-- 1. GRÁFICO SUPERIOR IZQUIERDO: Costo Formula / Costo mas Factor -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-center bg-white">
                            <span class="font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                                <u>Costo Formula / Costo mas Factor</u>
                            </span>
                        </div>

                        <!-- Gráfico SVG sin bordes anidados para máximo aprovechamiento del espacio -->
                        <div class="p-3 sm:p-4 flex-1 flex flex-col justify-center overflow-x-auto custom-scrollbar">
                            ${this.renderSvgGraficoGeneral(generalData, data.columnas_fechas || [])}
                        </div>
                    </div>

                    <!-- 2. GRÁFICO SUPERIOR DERECHO: Costo de Formula Individual por Alimento -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-center bg-white">
                            <span class="font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                                <u>Costo de Formula Individual por Alimento</u>
                            </span>
                        </div>

                        <!-- Matriz individual scrollable sin doble contenedor -->
                        <div class="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                            <div id="contenedor-revision-alimento-individual-scroll" class="p-0 overflow-x-auto overflow-y-auto max-h-[350px] custom-scrollbar border border-slate-200 rounded-xl bg-white">
                                ${this.renderGraficoIndividual(individualData, data.columnas_fechas || [])}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- 3. SECCIÓN INFERIOR: Detalle de Costos de Formula por Tipo de AABB -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
                        <div class="text-center w-full font-bold text-sm sm:text-base text-slate-900 select-none tracking-tight">
                            <u>Detalle de Costos de Formula por Tipo de AABB</u>
                        </div>
                        <button id="btn-exportar-revision-alimento-excel" type="button"
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
                        <div id="contenedor-tabla-matriz-revision-alimento">
                            ${this.renderTablaMatriz(matriz, resumen)}
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.setupEventListeners();
    },

    /**
     * Renderiza el gráfico superior izquierdo (Costo Formula / Costo mas Factor)
     * Contiene 2 sub-gráficos apilados verticalmente con escala y paleta divergente de Tableau
     * Utiliza viewBox responsive para aprovechar el 100% del ancho del card
     */
    renderSvgGraficoGeneral(generalData, fechas) {
        const puntos = generalData.puntos || [];
        if (puntos.length === 0) {
            return `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No hay puntos para el gráfico general.
                </div>
            `;
        }

        const cf = generalData.factor_cf || 0.114;
        const cm = generalData.factor_cm || 0.013;
        const labelFactor = `PU + CF(${this.formatDecimal(cf, 3)}) + CM(${this.formatDecimal(cm, 3)})`;

        // Dimensiones normalizadas del SVG para llenar el 100% del contenedor sin espacios desperdiciados
        const viewBoxWidth = 880;
        const padLeft = 82;
        const padRight = 32;
        const drawWidth = viewBoxWidth - padLeft - padRight;
        const stepX = puntos.length > 1 ? drawWidth / (puntos.length - 1) : drawWidth;

        const chartHeight = 135; // Altura generosa de cada subgráfico
        const padY = 22;
        const drawHeight = chartHeight - padY * 2;

        // 1. Escala Subgráfico 1: PU
        let minPU = Infinity, maxPU = -Infinity;
        puntos.forEach(p => {
            if (p.pu !== null && p.pu !== undefined && p.pu > 0) {
                if (p.pu < minPU) minPU = p.pu;
                if (p.pu > maxPU) maxPU = p.pu;
            }
        });
        if (minPU === Infinity) { minPU = 1.51; maxPU = 1.55; }
        const rangePU = (maxPU - minPU) || 0.02;
        const yMinPU = Math.max(0, minPU - rangePU * 0.15);
        const yMaxPU = maxPU + rangePU * 0.15;

        // 2. Escala Subgráfico 2: PU Con Factor
        let minFactor = Infinity, maxFactor = -Infinity;
        puntos.forEach(p => {
            if (p.pu_con_factor !== null && p.pu_con_factor !== undefined && p.pu_con_factor > 0) {
                if (p.pu_con_factor < minFactor) minFactor = p.pu_con_factor;
                if (p.pu_con_factor > maxFactor) maxFactor = p.pu_con_factor;
            }
        });
        if (minFactor === Infinity) { minFactor = 1.64; maxFactor = 1.68; }
        const rangeFactor = (maxFactor - minFactor) || 0.02;
        const yMinFactor = Math.max(0, minFactor - rangeFactor * 0.15);
        const yMaxFactor = maxFactor + rangeFactor * 0.15;

        // Ticks para los ejes Y
        const ticksPU = [
            yMaxPU,
            (yMaxPU + yMinPU) / 2,
            yMinPU
        ];

        const ticksFactor = [
            yMaxFactor,
            (yMaxFactor + yMinFactor) / 2,
            yMinFactor
        ];

        const getY_PU = (val) => {
            return padY + drawHeight - ((val - yMinPU) / (yMaxPU - yMinPU || 1)) * drawHeight;
        };

        const getY_Factor = (val) => {
            return (chartHeight + 16) + padY + drawHeight - ((val - yMinFactor) / (yMaxFactor - yMinFactor || 1)) * drawHeight;
        };

        // Construir segmentos con degradado divergente según el valor de PU
        let segmentsPU = '';
        let pointsPU = '';
        let segmentsFactor = '';
        let pointsFactor = '';

        for (let i = 0; i < puntos.length; i++) {
            const p = puntos[i];
            const x = padLeft + i * stepX;
            const y1 = getY_PU(p.pu);
            const y2 = getY_Factor(p.pu_con_factor);

            const colorP = this.getDivergingColor(p.pu, minPU, maxPU);

            // Línea entre punto anterior y actual
            if (i > 0) {
                const prevP = puntos[i - 1];
                const prevX = padLeft + (i - 1) * stepX;
                const prevY1 = getY_PU(prevP.pu);
                const prevY2 = getY_Factor(prevP.pu_con_factor);

                segmentsPU += `
                    <line x1="${prevX.toFixed(1)}" y1="${prevY1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y1.toFixed(1)}" 
                        stroke="${colorP}" stroke-width="2.4" stroke-linecap="round" />
                `;

                segmentsFactor += `
                    <line x1="${prevX.toFixed(1)}" y1="${prevY2.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" 
                        stroke="${colorP}" stroke-width="2.4" stroke-linecap="round" />
                `;
            }

            const lblPU = this.formatDecimal(p.pu, 3);
            const lblFactor = this.formatDecimal(p.pu_con_factor, 3);

            // Puntos Subgráfico 1 (PU)
            pointsPU += `
                <g class="data-point-alimento-target" style="cursor: pointer;"
                    data-item="Costo Formula"
                    data-tipo="General"
                    data-fecha="${p.fecha}"
                    data-medida="PU"
                    data-valor="${lblPU}"
                    data-peso="${p.peso}"
                    data-valor-soles="${p.valor}">
                    <circle cx="${x.toFixed(1)}" cy="${y1.toFixed(1)}" r="12" fill="transparent"></circle>
                    <circle cx="${x.toFixed(1)}" cy="${y1.toFixed(1)}" r="3.4" 
                        fill="${colorP}" stroke="#ffffff" stroke-width="1.3" 
                        style="pointer-events: none;">
                    </circle>
                    <text x="${x.toFixed(1)}" y="${(y1 - 7).toFixed(1)}" 
                        text-anchor="middle" font-size="9.5" font-family="sans-serif" font-weight="700" 
                        fill="#0f172a" style="pointer-events: none; user-select: none;">${lblPU}</text>
                </g>
            `;

            // Puntos Subgráfico 2 (PU Con Factor)
            pointsFactor += `
                <g class="data-point-alimento-target" style="cursor: pointer;"
                    data-item="Costo Formula mas Factor"
                    data-tipo="General"
                    data-fecha="${p.fecha}"
                    data-medida="PU + Factor"
                    data-valor="${lblFactor}"
                    data-peso="${p.peso}"
                    data-valor-soles="${p.valor}">
                    <circle cx="${x.toFixed(1)}" cy="${y2.toFixed(1)}" r="12" fill="transparent"></circle>
                    <circle cx="${x.toFixed(1)}" cy="${y2.toFixed(1)}" r="3.4" 
                        fill="${colorP}" stroke="#ffffff" stroke-width="1.3" 
                        style="pointer-events: none;">
                    </circle>
                    <text x="${x.toFixed(1)}" y="${(y2 - 7).toFixed(1)}" 
                        text-anchor="middle" font-size="9.5" font-family="sans-serif" font-weight="700" 
                        fill="#0f172a" style="pointer-events: none; user-select: none;">${lblFactor}</text>
                </g>
            `;
        }

        // Eje X Fechas
        let ejeXFechas = '';
        const yEjeX = chartHeight * 2 + 20;
        puntos.forEach((p, idx) => {
            const x = padLeft + idx * stepX;
            const lbl = p.dia_mes || p.fecha;
            ejeXFechas += `
                <line x1="${x.toFixed(1)}" y1="${yEjeX}" x2="${x.toFixed(1)}" y2="${yEjeX + 5}" stroke="#cbd5e1" stroke-width="1" style="pointer-events: none;" />
                <text x="${x.toFixed(1)}" y="${yEjeX + 9}" 
                    transform="rotate(-90 ${x.toFixed(1)} ${yEjeX + 9})" 
                    text-anchor="end" font-size="9" font-family="sans-serif" 
                    font-weight="500" fill="#475569" style="pointer-events: none; user-select: none;">
                    ${lbl}
                </text>
            `;
        });

        const totalSvgHeight = yEjeX + 65;

        return `
            <svg viewBox="0 0 ${viewBoxWidth} ${totalSvgHeight}" class="w-full h-auto block select-none" style="width: 100%; max-height: 420px;">
                
                <!-- SUBGRÁFICO 1: PU -->
                <text x="16" y="${chartHeight / 2}" transform="rotate(-90 16 ${chartHeight / 2})" 
                    text-anchor="middle" font-size="11" font-family="sans-serif" font-weight="700" fill="#1e293b">
                    PU
                </text>
                <text x="${padLeft - 10}" y="${getY_PU(ticksPU[0]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksPU[0], 2)}</text>
                <text x="${padLeft - 10}" y="${getY_PU(ticksPU[1]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksPU[1], 2)}</text>
                <text x="${padLeft - 10}" y="${getY_PU(ticksPU[2]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksPU[2], 2)}</text>
                
                <!-- Líneas de Cuadrícula PU -->
                <line x1="${padLeft}" y1="${getY_PU(ticksPU[0])}" x2="${viewBoxWidth - padRight}" y2="${getY_PU(ticksPU[0])}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                <line x1="${padLeft}" y1="${getY_PU(ticksPU[1])}" x2="${viewBoxWidth - padRight}" y2="${getY_PU(ticksPU[1])}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                <line x1="${padLeft}" y1="${getY_PU(ticksPU[2])}" x2="${viewBoxWidth - padRight}" y2="${getY_PU(ticksPU[2])}" stroke="#e2e8f0" stroke-width="1" />

                <!-- Líneas y Puntos PU -->
                ${segmentsPU}
                ${pointsPU}

                <!-- SEPARADOR -->
                <line x1="${padLeft}" y1="${chartHeight + 8}" x2="${viewBoxWidth - padRight}" y2="${chartHeight + 8}" stroke="#e2e8f0" stroke-width="1" />

                <!-- SUBGRÁFICO 2: PU + FACTOR -->
                <text x="16" y="${chartHeight + 16 + chartHeight / 2}" transform="rotate(-90 16 ${chartHeight + 16 + chartHeight / 2})" 
                    text-anchor="middle" font-size="9.5" font-family="sans-serif" font-weight="700" fill="#1e293b">
                    ${labelFactor}
                </text>
                <text x="${padLeft - 10}" y="${getY_Factor(ticksFactor[0]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksFactor[0], 2)}</text>
                <text x="${padLeft - 10}" y="${getY_Factor(ticksFactor[1]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksFactor[1], 2)}</text>
                <text x="${padLeft - 10}" y="${getY_Factor(ticksFactor[2]) + 3.5}" text-anchor="end" font-size="9" font-family="sans-serif" fill="#64748b">${this.formatDecimal(ticksFactor[2], 2)}</text>

                <!-- Líneas de Cuadrícula PU Con Factor -->
                <line x1="${padLeft}" y1="${getY_Factor(ticksFactor[0])}" x2="${viewBoxWidth - padRight}" y2="${getY_Factor(ticksFactor[0])}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                <line x1="${padLeft}" y1="${getY_Factor(ticksFactor[1])}" x2="${viewBoxWidth - padRight}" y2="${getY_Factor(ticksFactor[1])}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2 2" />
                <line x1="${padLeft}" y1="${getY_Factor(ticksFactor[2])}" x2="${viewBoxWidth - padRight}" y2="${getY_Factor(ticksFactor[2])}" stroke="#e2e8f0" stroke-width="1" />

                <!-- Líneas y Puntos PU Con Factor -->
                ${segmentsFactor}
                ${pointsFactor}

                <!-- EJE X FECHAS COMPARTIDO -->
                ${ejeXFechas}

            </svg>
        `;
    },

    /**
     * Renderiza el gráfico superior derecho (Costo de Formula Individual por Alimento)
     */
    renderGraficoIndividual(individualData, fechas) {
        const series = individualData.series || [];
        if (series.length === 0 || fechas.length === 0) {
            return `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron datos individuales por alimento.
                </div>
            `;
        }

        const stickyColsWidth = 150 + 35; // 185px
        const contScrollWidth = Math.max(550, (fechas.length - 1) * 32 + 50);
        const totalRowWidth = stickyColsWidth + contScrollWidth;

        const rowHeight = 65;
        const padTop = 14;
        const padBottom = 8;
        const padLeft = 20;
        const padRight = 20;
        const drawWidth = contScrollWidth - padLeft - padRight;
        const drawHeight = rowHeight - padTop - padBottom;
        const stepX = fechas.length > 1 ? drawWidth / (fechas.length - 1) : drawWidth;

        let rowsHtml = '';

        series.forEach((it) => {
            // Calcular escala Y para este alimento
            let maxPU = 0, minPU = Infinity;
            it.puntos.forEach(p => {
                if (p.pu !== null && p.pu !== undefined && p.pu > 0) {
                    if (p.pu > maxPU) maxPU = p.pu;
                    if (p.pu < minPU) minPU = p.pu;
                }
            });

            let maxY = 2.0;
            let minY = 1.4;
            let ticks = [2.0, 1.8, 1.6, 1.4];

            if (maxPU > 0) {
                if (maxPU > 2.0 || minPU < 1.4) {
                    maxY = Math.ceil(maxPU * 10) / 10;
                    minY = Math.max(0, Math.floor(minPU * 10) / 10);
                    const step = (maxY - minY) / 3;
                    ticks = [maxY, Number((minY + step * 2).toFixed(1)), Number((minY + step).toFixed(1)), minY];
                }
            }

            const getY = (pu) => {
                const clamped = Math.min(maxY, Math.max(minY, pu));
                return padTop + drawHeight - ((clamped - minY) / (maxY - minY || 1)) * drawHeight;
            };

            let pathD = '';
            let pointsSvg = '';
            let hasFirst = false;

            it.puntos.forEach((p, pIdx) => {
                const x = padLeft + pIdx * stepX;

                if (p.pu !== null && p.pu !== undefined && p.pu > 0) {
                    const pu = p.pu;
                    const y = getY(pu);

                    if (!hasFirst) {
                        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
                        hasFirst = true;
                    } else {
                        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
                    }

                    const labelText = this.formatDecimal(pu, 3);
                    const lineColor = it.color || '#2563eb';

                    pointsSvg += `
                        <g class="data-point-alimento-target" style="cursor: pointer;"
                            data-item="${encodeURIComponent(it.item)}"
                            data-tipo="${encodeURIComponent(it.tipo)}"
                            data-fecha="${p.fecha}"
                            data-medida="PU"
                            data-valor="${labelText}"
                            data-peso="${p.peso || 0}"
                            data-valor-soles="${p.valor || 0}">
                            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="12" fill="transparent"></circle>
                            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" 
                                fill="${lineColor}" stroke="#ffffff" stroke-width="1.2" 
                                style="pointer-events: none;">
                            </circle>
                            <text x="${x.toFixed(1)}" y="${(y - 5).toFixed(1)}" 
                                text-anchor="middle" font-size="8.5" font-family="sans-serif" font-weight="600" 
                                fill="#1e293b" style="pointer-events: none; user-select: none;">${labelText}</text>
                        </g>
                    `;
                }
            });

            rowsHtml += `
                <div class="flex items-center bg-white hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                    <!-- 1. Columna Item (Sticky Izquierda) -->
                    <div class="w-[150px] min-w-[150px] p-2 sticky left-0 border-r border-slate-200 flex flex-col justify-center" style="background-color: #ffffff; z-index: 25;">
                        <span class="text-[9.5px] font-semibold text-slate-800 leading-tight line-clamp-2" title="${it.item}">
                            ${it.item}
                        </span>
                    </div>

                    <!-- 2. Columna Eje Y PU (Sticky Izquierda) -->
                    <div class="w-[35px] min-w-[35px] h-[${rowHeight}px] sticky left-[150px] border-r border-slate-200 flex flex-col justify-between items-end py-1 px-1.5 text-[8px] font-semibold text-slate-400 select-none" style="background-color: #ffffff; z-index: 25;">
                        <span>${ticks[0]}</span>
                        <span>${ticks[1]}</span>
                        <span>${ticks[2]}</span>
                        <span>${ticks[3]}</span>
                    </div>

                    <!-- 3. Área de Gráfica SVG -->
                    <div class="grow h-[${rowHeight}px] relative bg-transparent overflow-hidden" style="z-index: 10;">
                        <svg width="${contScrollWidth}" height="${rowHeight}" viewBox="0 0 ${contScrollWidth} ${rowHeight}" class="w-full h-full block">
                            <!-- Líneas de cuadrícula -->
                            <line x1="0" y1="${getY(ticks[0]).toFixed(1)}" x2="${contScrollWidth}" y2="${getY(ticks[0]).toFixed(1)}" stroke="#f8fafc" stroke-width="1" />
                            <line x1="0" y1="${getY(ticks[1]).toFixed(1)}" x2="${contScrollWidth}" y2="${getY(ticks[1]).toFixed(1)}" stroke="#f8fafc" stroke-width="1" stroke-dasharray="2 2" />
                            <line x1="0" y1="${getY(ticks[2]).toFixed(1)}" x2="${contScrollWidth}" y2="${getY(ticks[2]).toFixed(1)}" stroke="#f8fafc" stroke-width="1" stroke-dasharray="2 2" />
                            <line x1="0" y1="${getY(ticks[3]).toFixed(1)}" x2="${contScrollWidth}" y2="${getY(ticks[3]).toFixed(1)}" stroke="#e2e8f0" stroke-width="1" />
                            
                            <!-- Línea de datos -->
                            ${pathD ? `<path d="${pathD}" fill="none" stroke="${it.color || '#2563eb'}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" style="pointer-events: none;" />` : ''}
                            
                            <!-- Puntos interactivos -->
                            ${pointsSvg}
                        </svg>
                    </div>
                </div>
            `;
        });

        // Eje X inferior con Fechas
        let svgEjeXFechas = '';
        fechas.forEach((f, idx) => {
            const x = padLeft + idx * stepX;
            const labelFecha = f.dia_mes || f.ymd || f.fecha;
            svgEjeXFechas += `
                <line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="4" stroke="#cbd5e1" stroke-width="1" style="pointer-events: none;" />
                <text x="${x.toFixed(1)}" y="8" 
                    transform="rotate(-90 ${x.toFixed(1)} 8)" 
                    text-anchor="end" font-size="8.5" font-family="sans-serif" 
                    font-weight="500" fill="#475569" style="pointer-events: none; user-select: none;">
                    ${labelFecha}
                </text>
            `;
        });

        return `
            <div style="min-width: ${totalRowWidth}px;" class="select-none relative">
                
                <!-- HEADER SUPERIOR: Item + PU + Día de fecha -->
                <div class="flex items-center text-white font-bold text-[10.5px] sticky top-0 shadow-2xs" style="background-color: #2563eb; z-index: 35;">
                    <div class="w-[150px] min-w-[150px] py-2 px-2.5 border-r border-blue-500 sticky left-0 text-white" style="background-color: #2563eb; z-index: 38;">
                        Item
                    </div>
                    <div class="w-[35px] min-w-[35px] py-2 px-1 text-center border-r border-blue-500 sticky left-[150px] text-[9.5px] text-blue-100" style="background-color: #2563eb; z-index: 38;">
                        PU
                    </div>
                    <div class="py-2 px-3 text-center grow font-bold text-white" style="background-color: #2563eb;">
                        Día de fecha
                    </div>
                </div>

                <!-- CONTENEDOR DE FILAS INDIVIDUALES -->
                <div class="divide-y divide-slate-100 bg-white">
                    ${rowsHtml}
                </div>

                <!-- EJE X INFERIOR -->
                <div class="flex items-start border-t border-slate-200 sticky bottom-0 shadow-2xs" style="background-color: #f8fafc; z-index: 35;">
                    <div class="w-[150px] min-w-[150px] sticky left-0 border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    <div class="w-[35px] min-w-[35px] sticky left-[150px] border-r border-slate-200" style="background-color: #f8fafc; z-index: 38;"></div>
                    
                    <div class="grow h-[70px] relative" style="background-color: #f8fafc;">
                        <svg width="${contScrollWidth}" height="70" viewBox="0 0 ${contScrollWidth} 70" class="w-full h-full block" style="pointer-events: none;">
                            ${svgEjeXFechas}
                        </svg>
                    </div>
                </div>

            </div>
        `;
    },

    /**
     * Renderiza la tabla matriz jerárquica inferior (Detalle de Costos de Formula por Tipo de AABB)
     */
    renderTablaMatriz(matriz, resumen = {}) {
        const todasColumnas = matriz.columnas_fechas || [];
        const items = matriz.items || [];
        const subtotalesTipo = matriz.subtotales_tipo || [];
        const totalesPorDia = matriz.totales_por_dia || resumen.totales_por_dia || {};

        if (items.length === 0) {
            return `
                <div class="p-8 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron alimentos para los filtros seleccionados.
                </div>
            `;
        }

        // Ordenar fechas descendentemente (como en Tableau: más reciente a la izquierda)
        const columnasDesc = [...todasColumnas].reverse();

        // Totales globales
        const granTotalPeso = resumen.total_peso || items.reduce((acc, it) => acc + (it.total_peso || 0), 0);
        const granTotalValor = resumen.total_valor || items.reduce((acc, it) => acc + (it.total_valor || 0), 0);
        const puGlobal = resumen.pu_promedio || (granTotalPeso > 0 ? granTotalValor / granTotalPeso : 0);

        // Agrupar items por tipo preservando el orden ya ordenado por PU DESC
        const itemsPorTipo = {};
        items.forEach(it => {
            const t = it.tipo || 'OTROS';
            if (!itemsPorTipo[t]) itemsPorTipo[t] = [];
            itemsPorTipo[t].push(it);
        });

        const subtotalMap = {};
        subtotalesTipo.forEach(st => {
            subtotalMap[st.tipo] = st;
        });

        let html = `
            <table class="w-full text-left text-xs select-none" style="border-collapse: separate; border-spacing: 0;">
                <thead>
                    <!-- SUPER-HEADER TABLEAU: tipo, Item, Medida, Total general + Día de fecha -->
                    <tr class="bg-blue-600 text-white font-bold">
                        <th rowspan="2" class="py-2 px-3 whitespace-nowrap sticky top-0 left-0 z-30 text-[11px] text-white" 
                            style="background-color: #2563eb; width: 110px; min-width: 110px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            tipo
                        </th>
                        <th rowspan="2" class="py-2 px-3 whitespace-nowrap sticky top-0 left-[110px] z-30 text-[11px] text-white" 
                            style="background-color: #2563eb; width: 260px; min-width: 260px; max-width: 320px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            Item
                        </th>
                        <th rowspan="2" class="py-2 px-2 text-center whitespace-nowrap sticky top-0 left-[370px] z-30 text-[10px] text-blue-100" 
                            style="background-color: #2563eb; width: 55px; min-width: 55px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1d4ed8;">
                            Medida
                        </th>
                        <th rowspan="2" class="py-2 px-3 text-right whitespace-nowrap sticky top-0 left-[425px] z-30 text-[11px] text-white" 
                            style="background-color: #1d4ed8; width: 110px; min-width: 110px; border-right: 1px solid #3b82f6; border-bottom: 2px solid #1e40af;">
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

        // Renderizar por cada grupo de TIPO
        Object.keys(itemsPorTipo).forEach(tipoName => {
            const grupoItems = itemsPorTipo[tipoName];
            const subtotal = subtotalMap[tipoName] || null;
            const tipoRowspan = (grupoItems.length * 2) + 2;

            grupoItems.forEach((it, idx) => {
                const isFirstItemOfTipo = (idx === 0);
                const bgRow = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';
                const encodedItem = encodeURIComponent(it.item);
                const encodedTipo = encodeURIComponent(it.tipo);

                // FILA 1: MEDIDA PU
                html += `<tr class="transition-colors hover:bg-slate-50/80">`;

                if (isFirstItemOfTipo) {
                    html += `
                        <td rowspan="${tipoRowspan}" class="py-2 px-3 sticky left-0 z-10 text-[11px] text-slate-800 font-bold truncate align-top" 
                            style="background-color: #ffffff; border-right: 1.5px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;">
                            ${it.tipo}
                        </td>
                    `;
                }

                html += `
                    <td rowspan="2" class="py-1.5 px-3 sticky left-[110px] z-10 min-w-[260px] max-w-[320px] truncate text-[11px] align-top" 
                        style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;" title="${it.item}">
                        <span class="text-slate-900 truncate font-semibold">${it.item}</span>
                    </td>
                    
                    <!-- MEDIDA PU -->
                    <td class="py-1 px-2 text-center sticky left-[370px] z-10 text-[10px] text-slate-500 font-bold" 
                        style="background-color: ${bgRow}; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        PU
                    </td>
                    <td class="py-1 px-3 text-right sticky left-[425px] z-10 text-[11px] font-bold text-slate-900 cursor-default hover:bg-blue-100" 
                        style="background-color: #eff6ff; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #f1f5f9;"
                        data-tooltip="1"
                        data-item="${encodedItem}"
                        data-tipo="${encodedTipo}"
                        data-fecha="Total general"
                        data-medida="PU"
                        data-valor="${this.formatDecimal(it.pu_promedio, 3)}"
                        data-peso="${it.total_peso}"
                        data-valor-soles="${it.total_valor}">
                        ${this.formatDecimal(it.pu_promedio, 3)}
                    </td>
                `;

                columnasDesc.forEach(col => {
                    const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                    const cellText = valObj && valObj.pu !== null && valObj.pu > 0 ? this.formatDecimal(valObj.pu, 3) : '';
                    html += `
                        <td class="py-1 px-2 text-right text-[11px] text-slate-800 whitespace-nowrap cursor-default hover:bg-blue-50/70" 
                            style="background-color: ${bgRow}; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;"
                            ${cellText ? `data-tooltip="1" data-item="${encodedItem}" data-tipo="${encodedTipo}" data-fecha="${col.fecha}" data-medida="PU" data-valor="${cellText}" data-peso="${valObj.peso}" data-valor-soles="${valObj.valor}"` : ''}>
                            ${cellText}
                        </td>
                    `;
                });

                html += `</tr>`;

                // FILA 2: MEDIDA PESO
                html += `
                    <tr class="transition-colors hover:bg-slate-50/80">
                        <!-- MEDIDA PESO -->
                        <td class="py-1 px-2 text-center sticky left-[370px] z-10 text-[10px] text-slate-400 font-semibold" 
                            style="background-color: ${bgRow}; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                            peso
                        </td>
                        <td class="py-1 px-3 text-right sticky left-[425px] z-10 text-[11px] text-blue-700 font-semibold cursor-default hover:bg-blue-100" 
                            style="background-color: #eff6ff; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #e2e8f0;"
                            data-tooltip="1"
                            data-item="${encodedItem}"
                            data-tipo="${encodedTipo}"
                            data-fecha="Total general"
                            data-medida="peso"
                            data-valor="${this.formatDecimal(it.total_peso, 2)}"
                            data-peso="${it.total_peso}"
                            data-valor-soles="${it.total_valor}">
                            ${this.formatDecimal(it.total_peso, 2)}
                        </td>
                `;

                columnasDesc.forEach(col => {
                    const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                    const cellText = valObj && valObj.peso !== null && valObj.peso > 0 ? this.formatDecimal(valObj.peso, 2) : '';
                    html += `
                        <td class="py-1 px-2 text-right text-[10.5px] text-slate-500 whitespace-nowrap cursor-default hover:bg-blue-50/70" 
                            style="background-color: ${bgRow}; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #e2e8f0;"
                            ${cellText ? `data-tooltip="1" data-item="${encodedItem}" data-tipo="${encodedTipo}" data-fecha="${col.fecha}" data-medida="peso" data-valor="${cellText}" data-peso="${valObj ? valObj.peso : ''}" data-valor-soles="${valObj ? valObj.valor : ''}"` : ''}>
                            ${cellText}
                        </td>
                    `;
                });

                html += `</tr>`;
            });

            // FILAS SUBTOTAL DE TIPO
            const subTotPeso = subtotal ? subtotal.total_peso : 0;
            const subTotPu = subtotal ? subtotal.pu_promedio : 0;
            const subTotValor = subtotal ? subtotal.total_valor : 0;
            const encodedSubTipo = encodeURIComponent(tipoName);

            // Subtotal Fila 1: PU
            html += `
                <tr class="bg-slate-50 font-semibold" style="border-top: 1px solid #cbd5e1;">
                    <td rowspan="2" class="py-1.5 px-3 sticky left-[110px] z-10 text-[11px] font-bold text-slate-800" 
                        style="background-color: #f8fafc; border-right: 1px solid #e2e8f0; border-bottom: 2px solid #cbd5e1;">
                        Total
                    </td>
                    <td class="py-1 px-2 text-center sticky left-[370px] z-10 text-[10px] text-slate-600 font-bold" 
                        style="background-color: #f8fafc; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        PU
                    </td>
                    <td class="py-1 px-3 text-right sticky left-[425px] z-10 text-[11px] font-bold text-slate-900 cursor-default hover:bg-slate-200" 
                        style="background-color: #f1f5f9; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #f1f5f9;"
                        data-tooltip="1"
                        data-item="Total ${tipoName}"
                        data-tipo="${encodedSubTipo}"
                        data-fecha="Total general"
                        data-medida="PU"
                        data-valor="${this.formatDecimal(subTotPu, 3)}"
                        data-peso="${subTotPeso}"
                        data-valor-soles="${subTotValor}">
                        ${this.formatDecimal(subTotPu, 3)}
                    </td>
            `;

            columnasDesc.forEach(col => {
                const diaObj = subtotal && subtotal.valores_por_dia ? subtotal.valores_por_dia[col.fecha] : null;
                const cellText = diaObj && diaObj.pu > 0 ? this.formatDecimal(diaObj.pu, 3) : '';
                html += `
                    <td class="py-1 px-2 text-right text-[11px] font-semibold text-slate-800 whitespace-nowrap cursor-default hover:bg-slate-100" 
                        style="background-color: #f8fafc; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;"
                        ${cellText ? `data-tooltip="1" data-item="Total ${tipoName}" data-tipo="${encodedSubTipo}" data-fecha="${col.fecha}" data-medida="PU" data-valor="${cellText}" data-peso="${diaObj.peso}" data-valor-soles="${diaObj.valor}"` : ''}>
                        ${cellText}
                    </td>
                `;
            });

            html += `</tr>`;

            // Subtotal Fila 2: Peso
            html += `
                <tr class="bg-slate-50 font-semibold" style="border-bottom: 2px solid #cbd5e1;">
                    <td class="py-1 px-2 text-center sticky left-[370px] z-10 text-[10px] text-slate-500 font-semibold" 
                        style="background-color: #f8fafc; border-right: 1px solid #e2e8f0; border-bottom: 2px solid #cbd5e1;">
                        peso
                    </td>
                    <td class="py-1 px-3 text-right sticky left-[425px] z-10 text-[11px] text-blue-700 font-bold cursor-default hover:bg-slate-200" 
                        style="background-color: #f1f5f9; border-right: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;"
                        data-tooltip="1"
                        data-item="Total ${tipoName}"
                        data-tipo="${encodedSubTipo}"
                        data-fecha="Total general"
                        data-medida="peso"
                        data-valor="${this.formatDecimal(subTotPeso, 2)}"
                        data-peso="${subTotPeso}"
                        data-valor-soles="${subTotValor}">
                        ${this.formatDecimal(subTotPeso, 2)}
                    </td>
            `;

            columnasDesc.forEach(col => {
                const diaObj = subtotal && subtotal.valores_por_dia ? subtotal.valores_por_dia[col.fecha] : null;
                const cellText = diaObj && diaObj.peso > 0 ? this.formatDecimal(diaObj.peso, 2) : '';
                html += `
                    <td class="py-1 px-2 text-right text-[10.5px] text-slate-600 whitespace-nowrap cursor-default hover:bg-slate-100" 
                        style="background-color: #f8fafc; border-right: 1px solid #f1f5f9; border-bottom: 2px solid #cbd5e1;"
                        ${cellText ? `data-tooltip="1" data-item="Total ${tipoName}" data-tipo="${encodedSubTipo}" data-fecha="${col.fecha}" data-medida="peso" data-valor="${cellText}" data-peso="${diaObj ? diaObj.peso : ''}" data-valor-soles="${diaObj ? diaObj.valor : ''}"` : ''}>
                        ${cellText}
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                </tbody>

                <!-- FOOTER TOTAL GENERAL -->
                <tfoot class="sticky bottom-0 z-30 font-medium bg-white">
                    <!-- FILA 1: MEDIDA PU -->
                    <tr class="bg-white">
                        <td class="py-1.5 px-3 sticky left-0 z-40 text-[11px] font-bold text-slate-800" 
                            style="background-color: #ffffff; border-top: 2px solid #94a3b8; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                            Total
                        </td>
                        <td class="py-1.5 px-3 sticky left-[110px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-top: 2px solid #94a3b8; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                        </td>
                        <td class="py-1 px-2 text-center sticky left-[370px] z-40 text-[10px] text-slate-600 font-bold" 
                            style="background-color: #ffffff; border-top: 2px solid #94a3b8; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #f1f5f9;">
                            PU
                        </td>
                        <td class="py-1 px-3 text-right sticky left-[425px] z-40 text-[11px] font-bold text-slate-900 cursor-default hover:bg-slate-100" 
                            style="background-color: #f1f5f9; border-top: 2px solid #94a3b8; border-right: 1px solid #cbd5e1; border-bottom: 1px solid #f1f5f9;"
                            data-tooltip="1"
                            data-item="Total general"
                            data-tipo="(Todo)"
                            data-fecha="Total general"
                            data-medida="PU"
                            data-valor="${this.formatDecimal(puGlobal, 3)}"
                            data-peso="${granTotalPeso}"
                            data-valor-soles="${granTotalValor}">
                            ${this.formatDecimal(puGlobal, 3)}
                        </td>
        `;

        columnasDesc.forEach(col => {
            const totCol = totalesPorDia[col.fecha] || null;
            const puVal = totCol && totCol.pu > 0 ? this.formatDecimal(totCol.pu, 3) : '';
            html += `
                <td class="py-1 px-2 text-right text-[11px] font-semibold text-slate-800 whitespace-nowrap cursor-default hover:bg-slate-50" 
                    style="background-color: #ffffff; border-top: 2px solid #94a3b8; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;"
                    ${puVal ? `data-tooltip="1" data-item="Total general" data-tipo="(Todo)" data-fecha="${col.fecha}" data-medida="PU" data-valor="${puVal}" data-peso="${totCol ? totCol.peso : ''}" data-valor-soles="${totCol ? totCol.valor : ''}"` : ''}>
                    ${puVal}
                </td>
            `;
        });

        html += `
                    </tr>

                    <!-- FILA 2: MEDIDA PESO -->
                    <tr class="bg-white">
                        <td class="py-1.5 px-3 sticky left-0 z-40 text-[11px]" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 2px solid #94a3b8;">
                        </td>
                        <td class="py-1.5 px-3 sticky left-[110px] z-40 text-[11px]" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 2px solid #94a3b8;">
                        </td>
                        <td class="py-1 px-2 text-center sticky left-[370px] z-40 text-[10px] text-slate-400 font-semibold" 
                            style="background-color: #ffffff; border-right: 1px solid #e2e8f0; border-bottom: 2px solid #94a3b8;">
                            peso
                        </td>
                        <td class="py-1 px-3 text-right sticky left-[425px] z-40 text-[11px] text-blue-700 font-bold cursor-default hover:bg-slate-100" 
                            style="background-color: #f1f5f9; border-right: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8;"
                            data-tooltip="1"
                            data-item="Total general"
                            data-tipo="(Todo)"
                            data-fecha="Total general"
                            data-medida="peso"
                            data-valor="${this.formatDecimal(granTotalPeso, 2)}"
                            data-peso="${granTotalPeso}"
                            data-valor-soles="${granTotalValor}">
                            ${this.formatDecimal(granTotalPeso, 2)}
                        </td>
        `;

        columnasDesc.forEach(col => {
            const totCol = totalesPorDia[col.fecha] || null;
            const pesoVal = totCol && totCol.peso > 0 ? this.formatDecimal(totCol.peso, 2) : '';
            html += `
                <td class="py-1 px-2 text-right text-[10.5px] text-slate-600 whitespace-nowrap cursor-default hover:bg-slate-50" 
                    style="background-color: #ffffff; border-right: 1px solid #f1f5f9; border-bottom: 2px solid #94a3b8;"
                    ${pesoVal ? `data-tooltip="1" data-item="Total general" data-tipo="(Todo)" data-fecha="${col.fecha}" data-medida="peso" data-valor="${pesoVal}" data-peso="${totCol ? totCol.peso : ''}" data-valor-soles="${totCol ? totCol.valor : ''}"` : ''}>
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
        const btnExport = document.getElementById('btn-exportar-revision-alimento-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                this.exportarExcel();
            };
        }

        // Delegación de eventos para Tooltip
        const cont = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (cont && !cont._hasRevisionAlimentoTooltipEvents) {
            cont._hasRevisionAlimentoTooltipEvents = true;

            cont.addEventListener('mouseover', (e) => {
                // 1. Puntos en gráficos de línea
                const pointGroup = e.target.closest('.data-point-alimento-target');
                if (pointGroup) {
                    const item = decodeURIComponent(pointGroup.getAttribute('data-item') || '');
                    const tipo = decodeURIComponent(pointGroup.getAttribute('data-tipo') || '');
                    const diaFecha = pointGroup.getAttribute('data-fecha');
                    const medida = pointGroup.getAttribute('data-medida');
                    const valor = pointGroup.getAttribute('data-valor');
                    const peso = pointGroup.getAttribute('data-peso');
                    const valorSoles = pointGroup.getAttribute('data-valor-soles');
                    this.showTooltip(e, {
                        item,
                        tipo,
                        diaFecha,
                        medida,
                        valor,
                        peso: peso ? Number(peso) : null,
                        valorSoles: valorSoles ? Number(valorSoles) : null
                    });
                    return;
                }

                // 2. Celdas de tabla matriz
                const cell = e.target.closest('[data-tooltip="1"]');
                if (cell) {
                    const item = decodeURIComponent(cell.getAttribute('data-item') || '');
                    const tipo = decodeURIComponent(cell.getAttribute('data-tipo') || '');
                    const diaFecha = cell.getAttribute('data-fecha');
                    const medida = cell.getAttribute('data-medida');
                    const valor = cell.getAttribute('data-valor');
                    const peso = cell.getAttribute('data-peso');
                    const valorSoles = cell.getAttribute('data-valor-soles');

                    if (valor) {
                        this.showTooltip(e, {
                            item,
                            tipo,
                            diaFecha,
                            medida,
                            valor,
                            peso: peso ? Number(peso) : null,
                            valorSoles: valorSoles ? Number(valorSoles) : null
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
                const leavingPoint = e.target.closest('.data-point-alimento-target');
                const leavingCell = e.target.closest('[data-tooltip="1"]');

                if (leavingPoint || leavingCell) {
                    if (!related || (!related.closest('.data-point-alimento-target') && !related.closest('[data-tooltip="1"]'))) {
                        this.hideTooltip();
                    }
                }
            });
        }
    },

    exportarExcel() {
        const matriz = this.datosBackend.matriz_alimento || { columnas_fechas: [], items: [], subtotales_tipo: [] };
        const resumen = this.datosBackend.resumen || {};
        const totalesPorDia = matriz.totales_por_dia || resumen.totales_por_dia || {};

        if (typeof XLSX === 'undefined') {
            alert('Exportando datos a Excel...');
            return;
        }

        const columnas = matriz.columnas_fechas || [];

        // Estilos para Excel
        const headerStyle = {
            fill: { fgColor: { rgb: "2563EB" } },
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "1D4ED8" } },
                bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                left: { style: "thin", color: { rgb: "3B82F6" } },
                right: { style: "thin", color: { rgb: "3B82F6" } }
            }
        };

        const subtotalPuStyle = {
            fill: { fgColor: { rgb: "F1F5F9" } },
            font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "0F172A" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "CBD5E1" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const subtotalPesoStyle = {
            fill: { fgColor: { rgb: "F1F5F9" } },
            font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "1D4ED8" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "medium", color: { rgb: "CBD5E1" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const footerPuStyle = {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "0F172A" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "medium", color: { rgb: "94A3B8" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        };

        const footerPesoStyle = {
            fill: { fgColor: { rgb: "F8FAFC" } },
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "1D4ED8" } },
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
        const headers = ['Tipo', 'Item', 'Medida', 'Total general'];
        columnas.forEach(col => {
            headers.push(`${col.dia_semana || ''}, ${col.ymd || col.fecha}`);
        });

        // Fila 0: Encabezados
        headers.forEach((h, cIdx) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
            ws[cellRef] = {
                t: 's',
                v: h,
                s: headerStyle
            };
        });

        // Filas de datos agrupadas por tipo
        const itemsPorTipo = {};
        (matriz.items || []).forEach(it => {
            const t = it.tipo || 'OTROS';
            if (!itemsPorTipo[t]) itemsPorTipo[t] = [];
            itemsPorTipo[t].push(it);
        });

        const subtotalMap = {};
        (matriz.subtotales_tipo || []).forEach(st => {
            subtotalMap[st.tipo] = st;
        });

        let rIdx = 1;
        Object.keys(itemsPorTipo).forEach(tipoName => {
            const grupo = itemsPorTipo[tipoName];
            const subtotal = subtotalMap[tipoName];

            grupo.forEach(it => {
                // Fila PU
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: it.tipo || '', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: it.item || '', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'PU', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(it.pu_promedio || 0), z: '#,##0.000', s: numberStyleRight };

                columnas.forEach((col, cOffset) => {
                    const cIdx = 4 + cOffset;
                    const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                    const valObj = it.valores_por_dia ? it.valores_por_dia[col.fecha] : null;
                    if (valObj && valObj.pu !== null && valObj.pu !== undefined && valObj.pu > 0) {
                        ws[refCell] = { t: 'n', v: Number(valObj.pu), z: '#,##0.000', s: numberStyleRight };
                    } else {
                        ws[refCell] = { t: 's', v: '', s: textStyleLeft };
                    }
                });

                rIdx++;

                // Fila Peso
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: it.tipo || '', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: it.item || '', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'peso', s: textStyleLeft };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(it.total_peso || 0), z: '#,##0.00', s: numberStyleRight };

                columnas.forEach((col, cOffset) => {
                    const cIdx = 4 + cOffset;
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

            // Subtotal Tipo
            if (subtotal) {
                // Subtotal PU
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: `Total ${tipoName}`, s: { ...subtotalPuStyle, alignment: { horizontal: 'left' } } };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: '', s: subtotalPuStyle };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'PU', s: { ...subtotalPuStyle, alignment: { horizontal: 'center' } } };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(subtotal.pu_promedio || 0), z: '#,##0.000', s: subtotalPuStyle };

                columnas.forEach((col, cOffset) => {
                    const cIdx = 4 + cOffset;
                    const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                    const valObj = subtotal.valores_por_dia ? subtotal.valores_por_dia[col.fecha] : null;
                    if (valObj && valObj.pu > 0) {
                        ws[refCell] = { t: 'n', v: Number(valObj.pu), z: '#,##0.000', s: subtotalPuStyle };
                    } else {
                        ws[refCell] = { t: 's', v: '', s: subtotalPuStyle };
                    }
                });
                rIdx++;

                // Subtotal Peso
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: '', s: subtotalPesoStyle };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: '', s: subtotalPesoStyle };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'peso', s: { ...subtotalPesoStyle, alignment: { horizontal: 'center' } } };
                ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(subtotal.total_peso || 0), z: '#,##0.00', s: subtotalPesoStyle };

                columnas.forEach((col, cOffset) => {
                    const cIdx = 4 + cOffset;
                    const refCell = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
                    const valObj = subtotal.valores_por_dia ? subtotal.valores_por_dia[col.fecha] : null;
                    if (valObj && valObj.peso > 0) {
                        ws[refCell] = { t: 'n', v: Number(valObj.peso), z: '#,##0.00', s: subtotalPesoStyle };
                    } else {
                        ws[refCell] = { t: 's', v: '', s: subtotalPesoStyle };
                    }
                });
                rIdx++;
            }
        });

        // Totales Footer en Excel
        const granTotalPeso = resumen.total_peso || (matriz.items || []).reduce((acc, it) => acc + (it.total_peso || 0), 0);
        const granTotalValor = resumen.total_valor || (matriz.items || []).reduce((acc, it) => acc + (it.total_valor || 0), 0);
        const puGlobal = resumen.pu_promedio || (granTotalPeso > 0 ? granTotalValor / granTotalPeso : 0);

        // Footer Fila PU
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 0 })] = { t: 's', v: 'TOTAL', s: { ...footerPuStyle, alignment: { horizontal: 'left' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 1 })] = { t: 's', v: '', s: footerPuStyle };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'PU', s: { ...footerPuStyle, alignment: { horizontal: 'center' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(puGlobal), z: '#,##0.000', s: footerPuStyle };

        columnas.forEach((col, cOffset) => {
            const cIdx = 4 + cOffset;
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
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 2 })] = { t: 's', v: 'peso', s: { ...footerPesoStyle, alignment: { horizontal: 'center' } } };
        ws[XLSX.utils.encode_cell({ r: rIdx, c: 3 })] = { t: 'n', v: Number(granTotalPeso), z: '#,##0.00', s: footerPesoStyle };

        columnas.forEach((col, cOffset) => {
            const cIdx = 4 + cOffset;
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

        // Column Widths
        const colWidths = [
            { wch: 18 }, // Tipo
            { wch: 38 }, // Item
            { wch: 10 }, // Medida
            { wch: 16 }, // Total general
        ];
        columnas.forEach(() => {
            colWidths.push({ wch: 18 });
        });
        ws['!cols'] = colWidths;

        // Row Heights
        const rowHeights = [{ hpt: 26 }];
        for (let r = 1; r < rIdx; r++) {
            rowHeights.push({ hpt: 19 });
        }
        ws['!rows'] = rowHeights;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Costos Formula AABB');

        const fHisto = this.datosBackend.fechahisto || '';
        const fIni = this.datosBackend.fecha_inicio || '';
        const fFin = this.datosBackend.fecha_fin || '';
        XLSX.writeFile(wb, `Revision_Alimento_${fHisto}_${fIni}_${fFin}.xlsx`);
    }
};

window.ChartRegistry['RevisionAlimento'] = window.ChartRevisionAlimento;
window.ChartRegistry['Dash_RevisionAlimento'] = window.ChartRevisionAlimento;
