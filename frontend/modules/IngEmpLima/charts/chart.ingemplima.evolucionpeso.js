/**
 * Componente EvolucionPeso - IngEmpLima
 * Gráfico de líneas de evolución diaria de pesos promedios por empresa.
 * Réplica idéntica a Tableau Server.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartIngEmpLimaEvolucionPeso = {
    chart: null,
    tooltipId: 'ingemplima-peso-tooltip',
    tooltipTimer: null,
    activePointKey: null,
    paletaDefault: [
        '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
        '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ],
    coloresEmpresa: {
        'SAN FERNANDO S.A.': '#00007f',
        'REDONDOS S.A.': '#aa0000',
        'GRUPO SANTA ELENA S.A': '#edc948',
        'AGRO INVERS LOS ABEDULES SCRL': '#4e79a7',
        'AGROP.PLUMA BLANCA S.A.C.': '#76b7b2',
        'EL ROCIO S.A.': '#e15759',
        'TECAVI': '#005500',
        'GHCORP S.A.C': '#76b7b2',
        'RICO POLLO S.A.C': '#b07aa1'
    },

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

        const fechas = Array.isArray(data && data.fechas) ? data.fechas : [];
        const seriesRaw = Array.isArray(data && data.series) ? data.series : [];
        const titulo = (data && data.titulo) || 'Evolucion de Pesos Promedios Diarios';
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';

        const series = seriesRaw
            .map((serie, indice) => {
                const empresa = String(serie.empresa || serie.label || '');
                return {
                    empresa,
                    label: String(serie.label || empresa),
                    valores: Array.isArray(serie.valores) ? serie.valores : [],
                    color: this.colorEmpresa(empresa, indice)
                };
            })
            .filter(serie => serie.empresa !== '' && serie.valores.some(v => v !== null && v !== undefined));

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
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-slate-600">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">NomEmpresa:</span>
                    ${series.map(serie => `
                        <span class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded-[2px] shrink-0" style="background:${serie.color}"></span>
                            <span class="text-slate-700 text-xs">${this.escapeHtml(serie.label)}</span>
                        </span>
                    `).join('')}
                </div>
            </div>
        `;

        if (fechas.length === 0 || series.length === 0) {
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

        const labels = fechas.map(f => f.label || f.fecha);
        const minWidth = Math.max(1200, fechas.length * 30 + 160);

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <div class="text-center text-xs font-semibold text-slate-500 mb-1">Día de fecha</div>
                    <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                        <div class="relative" style="width:${minWidth}px; height: 620px;">
                            <canvas id="canvas-ingemplima-peso" style="display: block; width: 100%; height: 100%; image-rendering: -webkit-optimize-contrast; text-rendering: geometricPrecision;"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('canvas-ingemplima-peso');
        if (!canvas) return;

        // Calcular min y max del eje Y de pesos
        const pesosValidos = [];
        series.forEach(s => {
            s.valores.forEach(v => {
                if (v !== null && v !== undefined && Number.isFinite(Number(v))) {
                    pesosValidos.push(Number(v));
                }
            });
        });

        const rawMax = pesosValidos.length > 0 ? Math.max(...pesosValidos) : 3;
        const maxY = Math.max(3.0, Math.ceil(rawMax * 5) / 5);

        const datasets = series.map(serie => {
            return {
                label: serie.label,
                data: serie.valores.map(v => (v !== null && Number.isFinite(Number(v))) ? Number(v) : null),
                rawData: serie.valores,
                borderColor: serie.color,
                backgroundColor: serie.color,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: serie.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointHitRadius: 12,
                fill: false,
                tension: 0,
                spanGaps: true
            };
        });

        const tooltipHandler = (context) => this.mostrarTooltipGrafico(context, fechas);

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
                        right: 25,
                        bottom: 15,
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
                            maxRotation: 90,
                            minRotation: 90,
                            color: '#334155',
                            font: {
                                size: 10.5,
                                weight: '500',
                                family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                            },
                            padding: 8,
                            callback: (val, index) => labels[index]
                        }
                    },
                    y: {
                        min: 0,
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

        const scroll = contenedor.querySelector('.custom-scrollbar');
        if (scroll) {
            scroll.addEventListener('scroll', () => this.ocultarTooltip(), { passive: true });
        }
    },

    colorEmpresa(nombre, indice) {
        if (this.coloresEmpresa[nombre]) {
            return this.coloresEmpresa[nombre];
        }
        return this.paletaDefault[indice % this.paletaDefault.length];
    },

    mostrarTooltipGrafico(context, fechas) {
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

        const fechaObj = fechas[dataIndex] || {};
        const fechaLabel = fechaObj.label || fechaObj.fecha || '';
        const canvasRect = chart.canvas.getBoundingClientRect();
        const tooltipX = canvasRect.left + tooltip.caretX;
        const tooltipY = canvasRect.top + tooltip.caretY;
        const labelEmpresa = dataset.label;
        const pesoValor = Number(rawVal);

        this.tooltipTimer = setTimeout(() => {
            this.renderizarTooltip(labelEmpresa, fechaLabel, pesoValor, tooltipX, tooltipY);
            this.tooltipTimer = null;
        }, 500);
    },

    renderizarTooltip(empresa, fechaLabel, peso, tooltipX, tooltipY) {
        let el = document.getElementById(this.tooltipId);

        if (!el) {
            el = document.createElement('div');
            el.id = this.tooltipId;
            el.className = 'fixed hidden pointer-events-none z-50 bg-white text-slate-800 text-[12px] rounded shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-slate-300 font-sans p-3 leading-relaxed transition-opacity duration-150';
            document.body.appendChild(el);
        }

        const pesoFormateado = peso.toFixed(3).replace('.', ',');

        el.innerHTML = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 260px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; line-height: 1.6;">
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">NomEmpresa:</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${this.escapeHtml(empresa)}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">Día de fecha:</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${this.escapeHtml(fechaLabel)}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; padding-right: 20px; white-space: nowrap;">Peso promedio:</td>
                        <td style="color: #0f172a; text-align: right; font-weight: 500;">${pesoFormateado} kg</td>
                    </tr>
                </table>
            </div>
        `;

        el.classList.remove('hidden');

        const elRect = el.getBoundingClientRect();
        let left = tooltipX - elRect.width / 2;
        let top = tooltipY - elRect.height - 14;

        if (top < 10) {
            top = tooltipY + 16;
        }

        if (left < 10) left = 10;
        if (left + elRect.width > window.innerWidth - 10) {
            left = window.innerWidth - elRect.width - 10;
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

window.ChartRegistry['IngEmpLimaEvolucionPeso'] = window.ChartIngEmpLimaEvolucionPeso;
