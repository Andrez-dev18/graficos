/**
 * Módulo para CP09 CZonaGranja (Costo por Zona Geográfica y Granja)
 * Réplica exacta de Tableau:
 * 1. Vista de 1 solo mes: Gráfico de líneas continuas por zona (LA JOYA en azul, MOLLENDO en naranja) con etiquetas de CU.
 * 2. Vista de múltiples meses: Matriz / Small Multiples de Tableau con filas por cada mes, eje Y (CU: 4, 4.5, 5),
 *    puntos por cencos y etiquetas superiores, con divisor vertical y códigos rotados en el eje inferior.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP09 CZonaGranja'] = {
    COLORS: {
        LA_JOYA: '#4e79a7',       // Azul clásico Tableau
        MOLLENDO: '#f28e2b',      // Naranja clásico Tableau
        GRID: '#f1f5f9',
        DIVIDER: '#cbd5e1',
        TEXT: '#334155',
        TEXT_MUTED: '#64748b'
    },

    render(controller, data) {
        // 1. Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Costo por Zona Geografica y Granja';

        // Ocultar filtros secundarios y tarjeta de tabla (en Tableau CP09 es solo el lienzo)
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 2. Badges / Leyendas Tableau
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#4e79a7] bg-blue-50 border border-blue-200 px-3 py-1 rounded-md shadow-2xs">
                        <span class="w-3 h-3 rounded-full bg-[#4e79a7]"></span> LA JOYA
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#d97316] bg-orange-50 border border-orange-200 px-3 py-1 rounded-md shadow-2xs">
                        <span class="w-3 h-3 rounded-full bg-[#f28e2b]"></span> MOLLENDO
                    </span>
                </div>
            `;
        }

        const periodos = data.periodos || [];

        // 3. Renderizar según cantidad de meses
        if (periodos.length <= 1) {
            this.renderUnSoloMes(controller, data);
        } else {
            this.renderMultiplesMesesTableau(controller, data);
        }
    },

    /**
     * VISTA 1: Un solo mes seleccionado (Línea continua por zona como en image.png / dosmeses.png)
     */
    renderUnSoloMes(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.className = "flex flex-col w-full p-0 gap-0";
        contenedorGrafica.innerHTML = `
            <div class="relative w-full h-[480px] sm:h-[530px] p-4">
                <canvas id="chart-cp09-canvas" style="image-rendering: -webkit-optimize-contrast;"></canvas>
            </div>
        `;

        const canvas = document.getElementById('chart-cp09-canvas');
        if (!canvas) return;

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }
        if (typeof controller.destruirGraficaActual === 'function') {
            controller.destruirGraficaActual();
        }

        const periodos = data.periodos || [];
        const fMes = periodos.length > 0 ? periodos[0].key : Object.keys(data.series_por_mes || {})[0];
        const mesData = (data.series_por_mes && data.series_por_mes[fMes]) || { 'LA JOYA': [], 'MOLLENDO': [] };

        const puntosJoya = mesData['LA JOYA'] || [];
        const puntosMollendo = mesData['MOLLENDO'] || [];

        if (puntosJoya.length === 0 && puntosMollendo.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText('No hay datos para el período seleccionado', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labelsX = [];
        const fullPuntosJoya = [];
        const fullPuntosMollendo = [];
        const metaPoints = [];

        puntosJoya.forEach(p => {
            labelsX.push(p.cencos);
            fullPuntosJoya.push(p.cu);
            fullPuntosMollendo.push(null);
            metaPoints.push(p);
        });

        puntosMollendo.forEach(p => {
            labelsX.push(p.cencos);
            fullPuntosJoya.push(null);
            fullPuntosMollendo.push(p.cu);
            metaPoints.push(p);
        });

        const allCUs = [...puntosJoya.map(p => p.cu), ...puntosMollendo.map(p => p.cu)];
        const minVal = Math.min(...allCUs);
        const maxVal = Math.max(...allCUs);
        const minY = Math.max(0, Math.floor((minVal - 0.15) * 10) / 10);
        const maxY = Math.ceil((maxVal + 0.15) * 10) / 10;

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        controller.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labelsX,
                datasets: [
                    {
                        label: 'LA JOYA',
                        data: fullPuntosJoya,
                        borderColor: this.COLORS.LA_JOYA,
                        backgroundColor: this.COLORS.LA_JOYA,
                        tension: 0.05,
                        borderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 7.5,
                        pointBackgroundColor: this.COLORS.LA_JOYA,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        spanGaps: false,
                        datalabels: {
                            display: (context) => context.dataset.data[context.dataIndex] !== null,
                            align: 'top',
                            offset: 6,
                            color: '#334155',
                            font: { size: 10.5, weight: 'bold' },
                            formatter: (v) => v !== null ? Number(v).toFixed(3).replace('.', ',') : ''
                        }
                    },
                    {
                        label: 'MOLLENDO',
                        data: fullPuntosMollendo,
                        borderColor: this.COLORS.MOLLENDO,
                        backgroundColor: this.COLORS.MOLLENDO,
                        tension: 0.05,
                        borderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 7.5,
                        pointBackgroundColor: this.COLORS.MOLLENDO,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        spanGaps: false,
                        datalabels: {
                            display: (context) => context.dataset.data[context.dataIndex] !== null,
                            align: 'top',
                            offset: 6,
                            color: '#334155',
                            font: { size: 10.5, weight: 'bold' },
                            formatter: (v) => v !== null ? Number(v).toFixed(3).replace('.', ',') : ''
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 25, bottom: 10, left: 15, right: 15 }
                },
                scales: {
                    y: {
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'CU',
                            font: { size: 11, weight: 'bold' },
                            color: '#64748b'
                        },
                        ticks: {
                            stepSize: 0.1,
                            callback: v => Number(v).toFixed(1).replace('.', ','),
                            font: { size: 10, weight: '500' },
                            color: '#64748b'
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'zonageo / cencos',
                            font: { size: 11, weight: 'bold' },
                            color: '#64748b'
                        },
                        ticks: {
                            font: { size: 10, weight: '600' },
                            color: '#475569',
                            maxRotation: 0,
                            autoSkip: false
                        },
                        grid: {
                            display: true,
                            color: (ctx) => (ctx.index === puntosJoya.length ? '#94a3b8' : '#f8fafc'),
                            lineWidth: (ctx) => (ctx.index === puntosJoya.length ? 1.5 : 1)
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => this.customTooltip(context, metaPoints, controller)
                    }
                }
            }
        });
    },

    /**
     * VISTA 2: Múltiples meses seleccionados (Small Multiples de Tableau como en tableu.png)
     */
    renderMultiplesMesesTableau(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }

        const periodos = data.periodos || [];
        const seriesPorMes = data.series_por_mes || {};
        const listaJoya = data.cencos_joya || [];
        const listaMollendo = data.cencos_mollendo || [];

        // 1. Obtener lista unificada de todos los cencos para las columnas
        const allCencosJoya = listaJoya.map(item => item.cencos);
        const allCencosMollendo = listaMollendo.map(item => item.cencos);
        const allCencosTotal = [...allCencosJoya, ...allCencosMollendo];

        const numJoya = allCencosJoya.length;
        const numMollendo = allCencosMollendo.length;
        const totalCols = allCencosTotal.length;

        // Escala Y fija de Tableau: 3.5 a 5.5 con marcas en 4, 4.5, 5
        const minY = 3.6;
        const maxY = 5.4;
        const rowHeight = 76; // Altura de cada fila de mes en px

        // 2. Construir Filas de Meses
        let filasMesesHtml = '';

        periodos.forEach((p, pIdx) => {
            const fMes = p.key;
            const mesData = seriesPorMes[fMes] || { 'LA JOYA': [], 'MOLLENDO': [] };
            const joyaMap = {};
            (mesData['LA JOYA'] || []).forEach(item => { joyaMap[item.cencos] = item; });

            const mollendoMap = {};
            (mesData['MOLLENDO'] || []).forEach(item => { mollendoMap[item.cencos] = item; });

            // Generar puntos SVG para esta fila
            let svgPointsHtml = '';

            // Grid lines horizontales (4, 4.5, 5)
            const y4   = this.calcYPos(4.0, minY, maxY, rowHeight);
            const y4_5 = this.calcYPos(4.5, minY, maxY, rowHeight);
            const y5   = this.calcYPos(5.0, minY, maxY, rowHeight);

            const gridLinesSvg = `
                <line x1="0" y1="${y4}" x2="100%" y2="${y4}" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="${y4_5}" x2="100%" y2="${y4_5}" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="${y5}" x2="100%" y2="${y5}" stroke="#f1f5f9" stroke-width="1" />
            `;

            // Puntos de LA JOYA
            allCencosJoya.forEach((cencos, idx) => {
                const punto = joyaMap[cencos];
                if (punto && punto.cu > 0) {
                    const xPct = ((idx + 0.5) / totalCols) * 100;
                    const yPx = this.calcYPos(punto.cu, minY, maxY, rowHeight);
                    const cuStr = Number(punto.cu).toFixed(3).replace('.', ',');

                    svgPointsHtml += `
                        <g class="cursor-pointer group" 
                           data-punto='${JSON.stringify(punto)}'
                           onmouseenter="window.ChartRegistry['CP09 CZonaGranja'].onPointHover(event)"
                           onmouseleave="window.ChartRegistry['CP09 CZonaGranja'].onPointLeave(event)">
                            <circle cx="${xPct}%" cy="${yPx}" r="4" fill="${this.COLORS.LA_JOYA}" stroke="#ffffff" stroke-width="1" />
                            <text x="${xPct}%" y="${yPx - 6}" text-anchor="middle" font-size="8.5" font-family="monospace" font-weight="600" fill="#334155">${cuStr}</text>
                        </g>
                    `;
                }
            });

            // Puntos de MOLLENDO
            allCencosMollendo.forEach((cencos, idx) => {
                const punto = mollendoMap[cencos];
                if (punto && punto.cu > 0) {
                    const xPct = ((numJoya + idx + 0.5) / totalCols) * 100;
                    const yPx = this.calcYPos(punto.cu, minY, maxY, rowHeight);
                    const cuStr = Number(punto.cu).toFixed(3).replace('.', ',');

                    svgPointsHtml += `
                        <g class="cursor-pointer group" 
                           data-punto='${JSON.stringify(punto)}'
                           onmouseenter="window.ChartRegistry['CP09 CZonaGranja'].onPointHover(event)"
                           onmouseleave="window.ChartRegistry['CP09 CZonaGranja'].onPointLeave(event)">
                            <circle cx="${xPct}%" cy="${yPx}" r="4" fill="${this.COLORS.MOLLENDO}" stroke="#ffffff" stroke-width="1" />
                            <text x="${xPct}%" y="${yPx - 6}" text-anchor="middle" font-size="8.5" font-family="monospace" font-weight="600" fill="#334155">${cuStr}</text>
                        </g>
                    `;
                }
            });

            // Divisor vertical entre Joya y Mollendo
            const joyaDividerPct = (numJoya / totalCols) * 100;

            filasMesesHtml += `
                <div class="flex items-stretch border-b border-slate-200/90 hover:bg-slate-50/40 transition-colors">
                    <!-- Eje Y y Nombre del Mes -->
                    <div class="w-[120px] flex-shrink-0 flex items-center justify-between px-2.5 py-1 border-r border-slate-300 bg-white">
                        <div class="text-[10px] font-semibold text-slate-700 leading-tight">
                            ${p.mes_larga || p.key}
                        </div>
                        <div class="flex flex-col justify-between items-end h-[60px] text-[8.5px] font-mono text-slate-400 pl-1 border-l border-slate-100">
                            <span>5</span>
                            <span class="font-bold text-slate-500">4,5</span>
                            <span>4</span>
                        </div>
                    </div>
                    <!-- Área Gráfica SVG de la Fila -->
                    <div class="flex-1 relative" style="height: ${rowHeight}px;">
                        <svg class="w-full h-full" style="overflow: visible;">
                            ${gridLinesSvg}
                            <!-- Línea divisoria de zonas -->
                            <line x1="${joyaDividerPct}%" y1="0" x2="${joyaDividerPct}%" y2="100%" stroke="${this.COLORS.DIVIDER}" stroke-width="1.5" stroke-dasharray="2,2" />
                            ${svgPointsHtml}
                        </svg>
                    </div>
                </div>
            `;
        });

        // 3. Encabezados Superiores e Inferiores (Cencos rotados 90°)
        const joyaWidthPct = (numJoya / totalCols) * 100;
        const mollendoWidthPct = (numMollendo / totalCols) * 100;

        let bottomCencosLabelsHtml = '';
        allCencosTotal.forEach(cencos => {
            bottomCencosLabelsHtml += `
                <div class="flex-1 flex justify-center items-start overflow-visible">
                    <span class="text-[8.5px] font-mono text-slate-500 font-medium whitespace-nowrap transform -rotate-90 origin-top-left translate-y-8 translate-x-2">
                        ${cencos}
                    </span>
                </div>
            `;
        });

        // 4. Renderizar Todo el Contenedor
        contenedorGrafica.className = "flex flex-col w-full p-2 bg-white overflow-x-auto custom-scrollbar";
        contenedorGrafica.innerHTML = `
            <div class="min-w-[950px] flex flex-col border border-slate-200 rounded-xl bg-white shadow-2xs">
                
                <!-- Encabezado de Zonas estilo Tableau -->
                <div class="flex items-center border-b-2 border-slate-300 bg-slate-50 text-[11px] font-bold text-slate-700">
                    <div class="w-[120px] flex-shrink-0 px-3 py-2 border-r border-slate-300 text-left font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                        Mes de fecha
                    </div>
                    <div class="flex-1 flex items-center">
                        <div class="text-center py-2 border-r-2 border-slate-400 font-bold text-blue-800" style="width: ${joyaWidthPct}%;">
                            LA JOYA
                        </div>
                        <div class="text-center py-2 font-bold text-orange-800" style="width: ${mollendoWidthPct}%;">
                            MOLLENDO
                        </div>
                    </div>
                </div>

                <!-- Filas de Cada Mes -->
                <div class="flex flex-col divide-y divide-slate-200">
                    ${filasMesesHtml}
                </div>

                <!-- Eje Inferior de Cencos (Rotados) -->
                <div class="flex items-stretch border-t-2 border-slate-300 bg-slate-50/70 pt-1 pb-14">
                    <div class="w-[120px] flex-shrink-0 px-3 py-2 border-r border-slate-300 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        zonageo / cencos
                    </div>
                    <div class="flex-1 flex items-stretch">
                        ${bottomCencosLabelsHtml}
                    </div>
                </div>

            </div>
        `;
    },

    calcYPos(val, minY, maxY, height) {
        const padding = 10;
        const usableHeight = height - padding * 2;
        const clamped = Math.max(minY, Math.min(maxY, val));
        const pct = (clamped - minY) / (maxY - minY);
        return height - padding - (pct * usableHeight);
    },

    onPointHover(e) {
        const g = e.currentTarget;
        const puntoJson = g.getAttribute('data-punto');
        if (!puntoJson) return;
        const punto = JSON.parse(puntoJson);

        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const colorZona = (punto.zonageo === 'LA JOYA') ? this.COLORS.LA_JOYA : this.COLORS.MOLLENDO;

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                <span class="text-slate-500 font-normal">Zona:</span>
                <span class="font-bold text-left" style="color: ${colorZona};">${punto.zonageo}</span>
                
                <span class="text-slate-500 font-normal">Cencos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${punto.cencos}</span>

                <span class="text-slate-500 font-normal">Granja:</span>
                <span class="text-slate-900 font-semibold text-left">${punto.nomcencos}</span>

                <span class="text-slate-500 font-normal">Mes:</span>
                <span class="text-slate-900 font-semibold text-left">${punto.mes_larga}</span>

                <span class="text-slate-500 font-normal">Total Importe:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">S/ ${Number(punto.sum_timfipt).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                <span class="text-slate-500 font-normal">Kg Vendidos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${Number(punto.avg_kgvendidos).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg</span>

                <span class="text-slate-500 font-normal">CU:</span>
                <span class="font-bold text-left font-mono text-sm" style="color: ${colorZona};">${Number(punto.cu).toFixed(3).replace('.', ',')}</span>
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const rect = g.getBoundingClientRect();
        const tooltipWidth = tooltipEl.offsetWidth || 250;
        const tooltipHeight = tooltipEl.offsetHeight || 140;

        let left = rect.left + 15;
        let top = rect.top - 20;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = rect.left - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight - 12) {
            top = window.innerHeight - tooltipHeight - 12;
        }

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
    },

    onPointLeave(e) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
        }
    },

    customTooltip(context, metaPoints, controller) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.classList.add('hidden');
            return;
        }

        if (tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
            const idx = tooltipModel.dataPoints[0].dataIndex;
            const punto = metaPoints[idx];
            if (!punto) return;

            const colorZona = (punto.zonageo === 'LA JOYA') ? this.COLORS.LA_JOYA : this.COLORS.MOLLENDO;

            tooltipEl.innerHTML = `
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                    <span class="text-slate-500 font-normal">Zona:</span>
                    <span class="font-bold text-left" style="color: ${colorZona};">${punto.zonageo}</span>
                    
                    <span class="text-slate-500 font-normal">Cencos:</span>
                    <span class="text-slate-900 font-semibold text-left font-mono">${punto.cencos}</span>

                    <span class="text-slate-500 font-normal">Granja:</span>
                    <span class="text-slate-900 font-semibold text-left">${punto.nomcencos}</span>

                    <span class="text-slate-500 font-normal">Mes:</span>
                    <span class="text-slate-900 font-semibold text-left">${punto.mes_larga}</span>

                    <span class="text-slate-500 font-normal">Total Importe:</span>
                    <span class="text-slate-900 font-semibold text-left font-mono">S/ ${controller.formatearNumero(punto.sum_timfipt, 'decimal2')}</span>

                    <span class="text-slate-500 font-normal">Kg Vendidos:</span>
                    <span class="text-slate-900 font-semibold text-left font-mono">${controller.formatearNumero(punto.avg_kgvendidos, 'decimal2')} Kg</span>

                    <span class="text-slate-500 font-normal">CU:</span>
                    <span class="font-bold text-left font-mono text-sm" style="color: ${colorZona};">${Number(punto.cu).toFixed(3).replace('.', ',')}</span>
                </div>
            `;

            tooltipEl.classList.remove('hidden');
            const position = context.chart.canvas.getBoundingClientRect();
            const tooltipWidth = tooltipEl.offsetWidth || 250;
            const tooltipHeight = tooltipEl.offsetHeight || 140;

            let left = position.left + tooltipModel.caretX + 14;
            let top = position.top + tooltipModel.caretY - 20;

            if (left + tooltipWidth > window.innerWidth - 12) {
                left = position.left + tooltipModel.caretX - tooltipWidth - 14;
            }
            if (top + tooltipHeight > window.innerHeight - 12) {
                top = window.innerHeight - tooltipHeight - 12;
            }

            tooltipEl.style.left = `${Math.max(10, left)}px`;
            tooltipEl.style.top = `${Math.max(10, top)}px`;
        }
    }
};
