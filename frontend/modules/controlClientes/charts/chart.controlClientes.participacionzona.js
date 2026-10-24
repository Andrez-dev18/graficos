/**
 * Componente visual - Control de Clientes
 * Vistas: ParticipacionUnd / ParticipacionKilos (barras verticales de participación por zona).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartControlClientesParticipacionZona = {
    chart: null,
    tooltipId: 'control-clientes-participacion-zona-tooltip',

    destroy() {
        this.ocultarTooltip();

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    },

    formatNumero(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatPorcentaje(num) {
        return this.formatNumero(num, 2);
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

        const chart = context.chart;
        const zona = String((chart.data.labels && chart.data.labels[punto.dataIndex]) || '');
        const valor = Number(punto.raw) || 0;

        const filas = [
            ['zona:', zona],
            [`${data.etiqueta_tooltip}:`, `${this.formatPorcentaje(valor)}%`]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 22px; align-items:start;">
                ${filas.map(([etiqueta, valorCampo]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valorCampo)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';

        const tooltipWidth = Math.min(430, window.innerWidth - 24);
        const tooltipHeight = tooltipEl.getBoundingClientRect().height || 70;
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

        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const titulo = (data && data.titulo) || 'Participación por Zona';
        const subtitulo = (data && data.subtitulo) || 'Porcentaje de participación por zona';
        const etiqueta = (data && data.etiqueta) || '% de total total_unidad';
        const color = (data && data.color) || '#4E79A7';

        if (filas.length === 0) {
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

        const labels = filas.map(fila => String(fila.zona || ''));
        const valores = filas.map(fila => Number(fila.porcentaje) || 0);
        const canvasId = 'canvas-control-clientes-participacion-zona';

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <span class="w-3 h-3 rounded-sm shrink-0" style="background:${this.escapeHtml(color)}"></span>
                        <span>${this.escapeHtml(etiqueta)}</span>
                    </div>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <p class="text-center text-[13px] font-bold text-slate-600 mb-2">zona</p>
                    <div class="relative w-full" style="height: 520px;">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const self = this;

        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: etiqueta,
                    data: valores,
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 0,
                    borderRadius: 2,
                    barPercentage: 0.62,
                    categoryPercentage: 0.8,
                    maxBarThickness: 72
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                animation: { duration: 250 },
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                layout: {
                    padding: { top: 20, right: 18, bottom: 4, left: 8 }
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
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        clamp: true,
                        color: '#334155',
                        font: { family: '"Segoe UI", sans-serif', size: 10.5, weight: '600' },
                        formatter: (value) => {
                            if (value === null || value === undefined || isNaN(value)) return '';
                            return `${self.formatPorcentaje(value)}%`;
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { color: '#cbd5e1', width: 1 },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 0,
                            minRotation: 0,
                            color: '#334155',
                            font: { family: '"Segoe UI", sans-serif', size: 11, weight: '600' }
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                        border: { color: '#cbd5e1', width: 1 },
                        title: {
                            display: true,
                            text: etiqueta,
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                        },
                        ticks: {
                            stepSize: 10,
                            color: '#334155',
                            font: { family: '"Segoe UI", sans-serif', size: 11, weight: '600' },
                            padding: 10,
                            callback: (value) => `${value}%`
                        }
                    }
                }
            }
        });
    }
};

window.ChartRegistry['ControlClientesParticipacionZona'] = window.ChartControlClientesParticipacionZona;
