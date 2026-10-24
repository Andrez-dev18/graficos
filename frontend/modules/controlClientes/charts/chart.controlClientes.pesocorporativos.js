/**
 * Componente visual - Control de Clientes
 * Vista: PesoCorporativos (tres paneles apilados: brasa, carne y total en kilos).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartControlClientesPesoCorporativos = {
    charts: [],
    tooltipId: 'control-clientes-peso-tooltip',

    destroy() {
        this.ocultarTooltip();

        this.charts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
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

    formatNumeroAuto(num) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            maximumFractionDigits: 2
        });
    },

    formatFecha(fecha) {
        return String(fecha || '').replace(/-/g, '/');
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
            el.style.fontSize = '13px';
            el.style.lineHeight = '1.55';
            el.style.wordBreak = 'break-word';
            document.body.appendChild(el);

            document.addEventListener('scroll', () => this.ocultarTooltip(), { capture: true, passive: true });
        }

        return el;
    },

    ocultarTooltip() {
        const el = document.getElementById(this.tooltipId);
        if (el) {
            el.style.opacity = '0';
        }
    },

    mostrarTooltip(context, data) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const indice = punto.dataIndex;
        const series = Array.isArray(data.series) ? data.series : [];
        const labels = Array.isArray(data.labels) ? data.labels : [];

        const filas = [
            ['Día de fecha:', this.formatFecha(labels[indice] || '')]
        ];

        series.forEach(serie => {
            const valores = Array.isArray(serie.valores) ? serie.valores : [];
            const valor = valores[indice];
            filas.push([`${serie.label}:`, this.formatNumeroAuto(valor)]);
        });

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(100px, 1fr); gap:6px 20px; align-items:start;">
                ${filas.map(([etiqueta, valor]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';
        this.posicionarTooltip(context.chart, tooltip, tooltipEl);
    },

    posicionarTooltip(chart, tooltip, tooltipEl) {
        const rect = chart.canvas.getBoundingClientRect();
        const offset = 14;
        const tooltipWidth = Math.min(380, window.innerWidth - 24);
        const tooltipHeight = tooltipEl.getBoundingClientRect().height || 135;

        tooltipEl.style.width = `${tooltipWidth}px`;

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

        const labels = Array.isArray(data && data.labels) ? data.labels : [];
        const series = Array.isArray(data && data.series) ? data.series : [];
        const titulo = (data && data.titulo) || 'Tendencia por Pesos y Tipos';
        const coorporativo = (data && data.coorporativo) || '';

        if (labels.length === 0 || series.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-4 border-b border-slate-200">
                        <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(coorporativo)} · Kilos por día</p>
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

        const labelsFecha = labels.map(fecha => this.formatFecha(fecha));
        const anchoMinimo = labels.length * 66;
        const canvasPrefix = 'control-clientes-peso';

        const panelesHtml = series.map((serie, indice) => {
            const esUltimo = indice === series.length - 1;
            return `
                <div class="relative w-full ${esUltimo ? '' : 'border-b border-slate-100'}" style="height: ${esUltimo ? 220 : 180}px;">
                    <canvas id="${canvasPrefix}-${indice}"></canvas>
                </div>
            `;
        }).join('');

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                    <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(coorporativo)} · Kilos por día</p>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <p class="text-center text-[13px] font-bold text-slate-600 mb-2">Día de fecha</p>
                    <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                        <div class="relative" style="width: max(100%, ${anchoMinimo}px);">
                            ${panelesHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        series.forEach((serie, indice) => {
            const canvas = document.getElementById(`${canvasPrefix}-${indice}`);
            if (!canvas) return;

            const esUltimo = indice === series.length - 1;
            const valores = (Array.isArray(serie.valores) ? serie.valores : []).map(valor => {
                const numero = Number(valor);
                return Number.isFinite(numero) ? numero : null;
            });
            const valoresValidos = valores.filter(valor => valor !== null);
            const minValor = valoresValidos.length > 0 ? Math.min(...valoresValidos) : 0;
            const maxValor = valoresValidos.length > 0 ? Math.max(...valoresValidos) : 0;
            const rango = maxValor - minValor;
            const paso = rango <= 2000 ? 200 : rango <= 5000 ? 500 : 1000;
            const minY = minValor < 0 ? Math.floor(minValor / paso) * paso : 0;
            const maxY = Math.max(paso, Math.ceil((maxValor * 1.08) / paso) * paso);

            const self = this;

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labelsFecha,
                    datasets: [{
                        label: serie.label,
                        data: valores,
                        borderColor: serie.color,
                        backgroundColor: serie.color,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: serie.color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        fill: false,
                        tension: 0,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                    animation: { duration: 250 },
                    interaction: {
                        mode: 'nearest',
                        intersect: false
                    },
                    layout: {
                        padding: { top: 34, right: 24, bottom: esUltimo ? 8 : 2, left: 24 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => this.mostrarTooltip(context, data)
                        },
                        datalabels: {
                            display: (ctx) => {
                                const valor = ctx.dataset.data[ctx.dataIndex];
                                return valor !== null && valor !== undefined && !isNaN(valor);
                            },
                            rotation: 0,
                            anchor: 'end',
                            align: 'top',
                            offset: 4,
                            clamp: true,
                            color: '#334155',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: '600' },
                            formatter: (value) => {
                                if (value === null || value === undefined || isNaN(value)) return '';
                                return self.formatNumeroAuto(value);
                            }
                        }
                    },
                    scales: {
                        x: {
                            offset: true,
                            grid: {
                                color: 'rgba(226, 232, 240, 0.7)',
                                drawTicks: true,
                                tickLength: 5
                            },
                            border: {
                                display: esUltimo,
                                color: '#cbd5e1',
                                width: 1
                            },
                            ticks: {
                                display: esUltimo,
                                autoSkip: false,
                                maxRotation: 90,
                                minRotation: 90,
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 11.5, weight: '600' },
                                padding: 8
                            }
                        },
                        y: {
                            min: minY,
                            max: maxY,
                            afterFit: (scale) => { scale.width = 78; },
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                            border: { color: '#cbd5e1', width: 1 },
                            title: {
                                display: true,
                                text: serie.label,
                                color: '#475569',
                                font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                            },
                            ticks: {
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 11, weight: '600' },
                                padding: 14,
                                stepSize: paso,
                                callback: (value) => self.formatNumero(value, 0)
                            }
                        }
                    }
                }
            });

            this.charts.push(chart);
        });

        const scroll = contenedor.querySelector('.custom-scrollbar');
        if (scroll) {
            scroll.addEventListener('scroll', () => this.ocultarTooltip(), { passive: true });
        }
    }
};

window.ChartRegistry['ControlClientesPesoCorporativos'] = window.ChartControlClientesPesoCorporativos;
