/**
 * Componente PrecioPorMes - IngEmpLima
 * Gráfico de comparación de promedios de peso por día del mes (1 al 31) entre diferentes meses,
 * con línea de tendencia logarítmica (fit='log').
 * Réplica exacta a Tableau Server.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartIngEmpLimaPrecioPorMes = {
    chart: null,
    tooltipId: 'ingemplima-preciopormes-tooltip',
    tooltipTimer: null,
    activePointKey: null,

    // Colores exactos de Tableau para cada mes
    coloresNombreMes: {
        'mayo':       '#e15759',
        'junio':      '#76b7b2',
        'julio':      '#59a14f',
        'agosto':     '#edc948',
        'septiembre': '#b07aa1',
        'octubre':    '#ff9da7',
        'enero':      '#4e79a7',
        'febrero':    '#f28e2b',
        'marzo':      '#e15759',
        'abril':      '#76b7b2',
        'noviembre':  '#9c755f',
        'diciembre':  '#bab0ac'
    },
    coloresMesNum: {
        1:  '#4e79a7',
        2:  '#f28e2b',
        3:  '#e15759',
        4:  '#76b7b2',
        5:  '#e15759',
        6:  '#76b7b2',
        7:  '#59a14f',
        8:  '#edc948',
        9:  '#b07aa1',
        10: '#ff9da7',
        11: '#9c755f',
        12: '#bab0ac'
    },
    paletaDefault: [
        '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
        '#4e79a7', '#f28e2b', '#9c755f', '#bab0ac'
    ],

    destroy() {
        this.cancelarTimerTooltip();
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.ocultarTooltip();
    },

    cancelarTimerTooltip() {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const dias = Array.isArray(data && data.dias) ? data.dias : Array.from({ length: 31 }, (_, i) => i + 1);
        const seriesRaw = Array.isArray(data && data.series) ? data.series : [];
        const titulo = (data && data.titulo) || 'Precios Promedios por Mes';
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';
        const empresas = Array.isArray(data && data.empresas) ? data.empresas : [];

        const series = seriesRaw
            .map((serie, indice) => {
                const nombreKey = String(serie.nombre || serie.label || '').toLowerCase();
                const color = this.coloresNombreMes[nombreKey]
                    || this.coloresMesNum[serie.mes_num]
                    || this.paletaDefault[indice % this.paletaDefault.length];

                return {
                    ym: serie.ym || '',
                    mesNum: serie.mes_num || (indice + 1),
                    nombre: serie.nombre || serie.label,
                    label: String(serie.label || `Mes ${indice + 1}`),
                    valores: Array.isArray(serie.valores) ? serie.valores : [],
                    color
                };
            })
            .filter(serie => serie.valores.some(v => v !== null && v !== undefined));

        const empresasTexto = empresas.length > 0
            ? (empresas.length <= 2 ? empresas.join(', ') : `${empresas.length} empresas seleccionadas`)
            : 'Todas';

        const header = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                    <div class="flex items-center gap-2.5">
                        <h2 class="text-lg font-bold text-slate-800 tracking-tight">
                            ${this.escapeHtml(titulo)}
                        </h2>
                        <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            ${this.escapeHtml(this.formatearPeriodo(fechaInicio, fechaFin))}
                        </span>
                    </div>
                    <div class="text-xs text-slate-500 mt-0.5">
                        <span class="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Empresa(s):</span>
                        <span class="font-medium text-slate-700">${this.escapeHtml(empresasTexto)}</span>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-slate-600">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mes de fecha:</span>
                    ${series.map(serie => `
                        <div class="flex items-center gap-2.5">
                            <span class="flex items-center gap-1.5">
                                <span class="w-3.5 h-3.5 rounded-[2px] shrink-0" style="background:${serie.color}"></span>
                                <span class="text-slate-700 text-xs">${this.escapeHtml(serie.label)}</span>
                            </span>
                            <span class="flex items-center gap-1 text-[11px] text-slate-400 font-normal">
                                <span class="w-3.5 h-0 border-t-2 border-dashed shrink-0" style="border-color:${serie.color}"></span>
                                <span>Tendencia</span>
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        if (series.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    ${header}
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (typeof Chart === 'undefined') {
            contenedor.innerHTML = `
                <div class="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
                    <i class="fas fa-exclamation-triangle text-amber-500 text-3xl mb-2"></i>
                    <h3 class="text-sm font-bold text-slate-700 uppercase">No se pudo cargar Chart.js</h3>
                    <p class="text-xs text-slate-400 mt-1">Verifica la conexión con la librería de gráficos.</p>
                </div>
            `;
            return;
        }

        const labels = dias.map(d => String(d));

        // El gráfico ocupa el 100% del ancho disponible sin limitar ni cortar
        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="px-4 pt-4 pb-6 sm:px-6 w-full">
                    <div class="text-center text-xs font-semibold text-slate-500 mb-1">Día de fecha</div>
                    <div class="w-full relative" style="height: 620px;">
                        <canvas id="canvas-ingemplima-preciopormes" style="display: block; width: 100%; height: 100%; image-rendering: -webkit-optimize-contrast; text-rendering: geometricPrecision;"></canvas>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('canvas-ingemplima-preciopormes');
        if (!canvas) return;

        // Calcular valor máximo para fijar la escala de Tableau
        let maxVal = 0;
        series.forEach(s => {
            s.valores.forEach(v => {
                if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
                    const num = Number(v);
                    if (num > maxVal) maxVal = num;
                }
            });
        });

        const maxY = Math.max(3.0, Math.ceil(maxVal * 5) / 5);

        const datasets = [];

        series.forEach(serie => {
            // 1. Serie real de puntos del mes
            datasets.push({
                label: serie.label,
                tipo: 'real',
                mesLabel: serie.label,
                data: serie.valores.map(v => (v !== null && Number.isFinite(Number(v))) ? Number(v) : null),
                rawData: serie.valores,
                borderColor: serie.color,
                backgroundColor: serie.color,
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 6,
                pointBackgroundColor: serie.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointHitRadius: 10,
                fill: false,
                tension: 0,
                spanGaps: true
            });

            // 2. Línea de tendencia logarítmica (fit='log')
            const tendencia = this.calcularTendenciaLog(serie.valores);
            if (tendencia) {
                datasets.push({
                    label: `${serie.label} (Tendencia)`,
                    tipo: 'tendencia',
                    mesLabel: serie.label,
                    data: tendencia,
                    rawData: tendencia,
                    borderColor: serie.color,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0,
                    fill: false,
                    tension: 0.2
                });
            }
        });

        const tooltipHandler = (context) => this.mostrarTooltipGrafico(context, dias);

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2.5, window.devicePixelRatio || 1),
                animation: { duration: 250 },
                interaction: {
                    mode: 'nearest',
                    axis: 'xy',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 15,
                        right: 20,
                        bottom: 10,
                        left: 10
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: tooltipHandler
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(226, 232, 240, 0.7)',
                            drawTicks: true,
                            tickLength: 6
                        },
                        border: {
                            color: '#94a3b8',
                            width: 1
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: '#334155',
                            font: {
                                size: 11,
                                weight: '500',
                                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                            },
                            padding: 8
                        },
                        title: {
                            display: true,
                            text: 'Día de fecha',
                            color: '#64748b',
                            font: {
                                size: 12,
                                weight: '600'
                            },
                            padding: { top: 8 }
                        }
                    },
                    y: {
                        min: 0.0,
                        max: maxY,
                        grid: {
                            color: 'rgba(226, 232, 240, 0.8)',
                            drawTicks: false
                        },
                        border: {
                            color: '#94a3b8',
                            width: 1
                        },
                        ticks: {
                            stepSize: 0.2,
                            color: '#334155',
                            font: {
                                size: 11,
                                weight: '500',
                                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                            },
                            padding: 10,
                            callback: (value) => Number(value).toFixed(1).replace('.', ',')
                        },
                        title: {
                            display: true,
                            text: 'Prom. peso_promedio',
                            color: '#475569',
                            font: {
                                size: 12,
                                weight: '600',
                                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                            },
                            padding: { bottom: 10 }
                        }
                    }
                }
            }
        });
    },

    calcularTendenciaLog(valores) {
        let n = 0;
        let sumLnX = 0;
        let sumY = 0;
        let sumLnX2 = 0;
        let sumLnXY = 0;

        for (let i = 0; i < valores.length; i++) {
            const val = valores[i];
            if (val !== null && val !== undefined && Number.isFinite(Number(val)) && Number(val) > 0) {
                const x = i + 1; // dia 1..31
                const y = Number(val);
                const lnX = Math.log(x);
                n++;
                sumLnX += lnX;
                sumY += y;
                sumLnX2 += lnX * lnX;
                sumLnXY += lnX * y;
            }
        }

        if (n < 2) return null;

        const denom = n * sumLnX2 - sumLnX * sumLnX;
        if (Math.abs(denom) < 1e-9) return null;

        const b = (n * sumLnXY - sumLnX * sumY) / denom;
        const a = (sumY - b * sumLnX) / n;

        const trend = [];
        for (let i = 0; i < valores.length; i++) {
            const x = i + 1;
            const yTrend = a + b * Math.log(x);
            trend.push(Math.round(yTrend * 1000) / 1000);
        }
        return trend;
    },

    mostrarTooltipGrafico(context, dias) {
        const { chart, tooltip } = context;

        if (tooltip.opacity === 0) {
            this.cancelarTimerTooltip();
            this.ocultarTooltip();
            this.activePointKey = null;
            return;
        }

        const dataPoints = tooltip.dataPoints || [];
        if (dataPoints.length === 0) {
            this.cancelarTimerTooltip();
            this.ocultarTooltip();
            this.activePointKey = null;
            return;
        }

        const point = dataPoints[0];
        const pointKey = `${point.datasetIndex}_${point.dataIndex}`;

        if (this.activePointKey === pointKey) {
            return;
        }

        this.cancelarTimerTooltip();
        this.ocultarTooltip();
        this.activePointKey = pointKey;

        const dataIndex = point.dataIndex;
        const dataset = chart.data.datasets[point.datasetIndex];
        const rawVal = dataset.rawData ? dataset.rawData[dataIndex] : null;

        if (rawVal === null || rawVal === undefined) {
            this.activePointKey = null;
            return;
        }

        const dia = dias[dataIndex] || (dataIndex + 1);
        const canvasRect = chart.canvas.getBoundingClientRect();
        const tooltipX = canvasRect.left + tooltip.caretX;
        const tooltipY = canvasRect.top + tooltip.caretY;
        const mesLabel = dataset.mesLabel || dataset.label;
        const valor = Number(rawVal);
        const esTendencia = dataset.tipo === 'tendencia';

        this.tooltipTimer = setTimeout(() => {
            this.renderizarTooltip(mesLabel, dia, valor, esTendencia, tooltipX, tooltipY);
            this.tooltipTimer = null;
        }, 500);
    },

    renderizarTooltip(mesLabel, dia, valor, esTendencia, tooltipX, tooltipY) {
        let el = document.getElementById(this.tooltipId);

        if (!el) {
            el = document.createElement('div');
            el.id = this.tooltipId;
            el.className = 'fixed hidden pointer-events-none z-50 bg-white text-slate-800 text-[12px] rounded shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-slate-300 font-sans p-3 leading-relaxed transition-opacity duration-150';
            document.body.appendChild(el);
        }

        const valorFormateado = valor.toFixed(3).replace('.', ',');
        const labelMetrica = esTendencia ? 'Tendencia (log):' : 'Prom. peso_promedio:';

        // Estructura idéntica a Tableau: Día de fecha, Mes de fecha, Prom. peso_promedio
        el.innerHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 230px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.6;">
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">Día de fecha:</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${dia}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">Mes de fecha:</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${this.escapeHtml(mesLabel)}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">${labelMetrica}</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${valorFormateado}</td>
                    </tr>
                </table>
            </div>
        `;

        el.classList.remove('hidden');

        const elRect = el.getBoundingClientRect();
        let left = tooltipX - elRect.width / 2;
        let top = tooltipY - elRect.height - 14;

        if (left < 10) left = 10;
        if (left + elRect.width > window.innerWidth - 10) {
            left = window.innerWidth - elRect.width - 10;
        }

        if (top < 10) {
            top = tooltipY + 16;
        }

        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
    },

    ocultarTooltip() {
        this.cancelarTimerTooltip();
        const el = document.getElementById(this.tooltipId);
        if (el) {
            el.classList.add('hidden');
        }
    },

    formatearPeriodo(inicio, fin) {
        if (!inicio && !fin) return 'Periodo no disponible';
        if (inicio && fin) return `${inicio} al ${fin}`;
        return inicio || fin;
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

window.ChartRegistry['IngEmpLimaPrecioPorMes'] = window.ChartIngEmpLimaPrecioPorMes;
