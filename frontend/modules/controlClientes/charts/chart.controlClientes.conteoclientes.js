window.ChartRegistry = window.ChartRegistry || {};

window.ChartControlClientesConteoClientes = {
    charts: [],
    tooltipId: 'control-clientes-conteo-clientes-tooltip',

    destroy() {
        this.ocultarTooltip();

        this.charts.forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = [];
    },

    formatNumero(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    escapeHtml(texto) {
        if (!texto) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    obtenerTooltipEl() {
        let el = document.getElementById(this.tooltipId);

        if (!el) {
            el = document.createElement('div');
            el.id = this.tooltipId;
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '9999';
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.1s ease';
            el.style.background = '#ffffff';
            el.style.border = '1px solid #cbd5e1';
            el.style.borderRadius = '4px';
            el.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            el.style.padding = '11px 14px';
            el.style.color = '#334155';
            el.style.fontFamily = '"Segoe UI", sans-serif';
            el.style.fontSize = '12.5px';
            el.style.lineHeight = '1.6';
            el.style.wordBreak = 'break-word';
            document.body.appendChild(el);

            document.addEventListener('scroll', () => this.ocultarTooltip(), { capture: true, passive: true });
        }

        return el;
    },

    ocultarTooltip() {
        const el = document.getElementById(this.tooltipId);
        if (el) el.style.opacity = '0';
    },

    mostrarTooltip(context, zona, anios) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const chart = context.chart;
        const anio = anios[punto.dataIndex];
        const valor = Number(punto.raw) || 0;

        const filas = [
            ['zona:', zona],
            ['año:', anio],
            ['clientes:', this.formatNumero(valor)]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(100px, 1fr); gap:6px 22px; align-items:start;">
                ${filas.map(([campo, valorCampo]) => `
                    <span style="color:#64748b;">${this.escapeHtml(campo)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valorCampo)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';

        const tooltipWidth = Math.min(340, window.innerWidth - 24);
        const tooltipHeight = tooltipEl.getBoundingClientRect().height || 84;
        tooltipEl.style.width = `${tooltipWidth}px`;

        const rect = chart.canvas.getBoundingClientRect();
        const offset = 14;
        let left = rect.left + tooltip.caretX + offset;
        let top = rect.top + tooltip.caretY;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = rect.left + tooltip.caretX - tooltipWidth - offset;
        }

        left = Math.max(8, left);
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 12));

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const zonas = Array.isArray(data && data.zonas) ? data.zonas : [];
        const anios = Array.isArray(data && data.anios) ? data.anios : [];
        const titulo = (data && data.titulo) || 'Conteo de Clientes por Año';
        const subtitulo = (data && data.subtitulo) || 'Clientes únicos por zona y año';
        const etiquetaZona = (data && data.etiqueta_zona) || 'zona';
        const etiquetaAnio = (data && data.etiqueta_anio) || 'Año de fecha';
        const etiquetaY = (data && data.etiqueta_y) || 'Recuento de clientes';
        const maxY = Math.max(150, Number(data && data.max_y) || 0);
        const stepY = Number(data && data.step_y) || 50;

        if (zonas.length === 0 || anios.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-4 border-b border-slate-200">
                        <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
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

        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }

        const canvasPrefix = 'canvas-control-clientes-conteo';

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                    <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <div class="w-full overflow-x-auto custom-scrollbar">
                        <div class="min-w-[760px]">
                            <div class="grid items-center border-b border-slate-100 pb-2 mb-1" style="grid-template-columns: 112px minmax(0, 1fr);">
                                <p class="text-center text-[12px] font-bold text-slate-600">${this.escapeHtml(etiquetaZona)}</p>
                                <p class="text-center text-[12px] font-bold text-slate-600">${this.escapeHtml(etiquetaAnio)}</p>
                            </div>
                            <div class="grid" style="grid-template-columns: 112px minmax(0, 1fr);">
                                ${zonas.map((fila, indice) => {
                                    const esUltima = indice === zonas.length - 1;
                                    const altura = esUltima ? 118 : 98;
                                    return `
                                        <div class="flex items-center justify-end pr-3 text-[11.5px] font-semibold text-slate-600 ${esUltima ? '' : 'border-b border-slate-100'}" style="min-height: ${altura}px;">
                                            ${this.escapeHtml(fila.zona)}
                                        </div>
                                        <div class="relative ${esUltima ? '' : 'border-b border-slate-100'}" style="height: ${altura}px;">
                                            <canvas id="${canvasPrefix}-${indice}"></canvas>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const self = this;

        zonas.forEach((fila, indice) => {
            const canvas = document.getElementById(`${canvasPrefix}-${indice}`);
            if (!canvas) return;

            const esUltima = indice === zonas.length - 1;
            const valores = anios.map((anio, posicion) => Number(fila.valores && fila.valores[posicion]) || 0);

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: anios.map(anio => String(anio)),
                    datasets: [{
                        label: 'Clientes',
                        data: valores,
                        backgroundColor: '#4E79A7',
                        borderColor: '#4E79A7',
                        borderWidth: 0,
                        borderRadius: 2,
                        barPercentage: 0.62,
                        categoryPercentage: 0.8,
                        maxBarThickness: 110
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                    animation: { duration: 220 },
                    interaction: {
                        mode: 'nearest',
                        intersect: true
                    },
                    layout: {
                        padding: { top: 24, right: 14, bottom: 4, left: 4 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => this.mostrarTooltip(context, fila.zona, anios)
                        },
                        datalabels: {
                            display: (ctx) => {
                                const valor = ctx.dataset.data[ctx.dataIndex];
                                return valor !== null && valor !== undefined && !isNaN(valor) && Number(valor) > 0;
                            },
                            anchor: 'end',
                            align: 'top',
                            offset: 3,
                            clamp: true,
                            color: '#334155',
                            font: {
                                family: '"Segoe UI", sans-serif',
                                size: 10.5,
                                weight: '600'
                            },
                            formatter: (value) => self.formatNumero(value)
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: esUltima, color: '#cbd5e1', width: 1 },
                            ticks: {
                                display: esUltima,
                                autoSkip: false,
                                maxRotation: 0,
                                minRotation: 0,
                                color: '#334155',
                                padding: 6,
                                font: {
                                    family: '"Segoe UI", sans-serif',
                                    size: 11,
                                    weight: '600'
                                }
                            }
                        },
                        y: {
                            min: 0,
                            max: maxY,
                            afterFit: (scale) => { scale.width = 62; },
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                            border: { color: '#cbd5e1', width: 1 },
                            title: {
                                display: true,
                                text: etiquetaY,
                                color: '#475569',
                                font: { family: '"Segoe UI", sans-serif', size: 9.5, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: stepY,
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 9.5, weight: '600' },
                                padding: 6
                            }
                        }
                    }
                }
            });

            this.charts.push(chart);
        });
    }
};

window.ChartRegistry['ControlClientesConteoClientes'] = window.ChartControlClientesConteoClientes;
