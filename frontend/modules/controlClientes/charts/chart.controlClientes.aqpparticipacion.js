window.ChartRegistry = window.ChartRegistry || {};

window.ChartControlClientesAqpParticipacion = {
    charts: [],
    tooltipId: 'control-clientes-aqp-participacion-tooltip',

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

    mostrarTooltip(context, data, panel) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const chart = context.chart;
        const etiqueta = String((chart.data.labels && chart.data.labels[punto.dataIndex]) || '');
        const valor = Number(punto.raw) || 0;

        const filas = [
            [`${data.dimension_label}:`, etiqueta],
            [`${panel.tooltip}:`, `${this.formatNumero(valor, panel.decimales)}%`]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 22px; align-items:start;">
                ${filas.map(([campo, valorCampo]) => `
                    <span style="color:#64748b;">${this.escapeHtml(campo)}</span>
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

    formatearEtiqueta(valor, panel) {
        if (valor === null || valor === undefined || isNaN(valor)) return '';

        if (panel.tipo_label === 'fraccion_kg') {
            return `${this.formatNumero(valor / 100, 2)} Kg`;
        }

        if (panel.tipo_label === 'fraccion_soles') {
            return `S/${this.formatNumero(valor / 100, 2)}`;
        }

        return `${this.formatNumero(valor, panel.decimales)}%`;
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const paneles = Array.isArray(data && data.paneles) ? data.paneles : [];
        const titulo = (data && data.titulo) || 'Participación (AQP)';
        const subtitulo = (data && data.subtitulo) || 'Porcentaje de participación';
        const dimensionLabel = (data && data.dimension_label) || 'subzona';
        const esCorporativo = (data && data.dimension) === 'coorporativo';

        if (filas.length === 0 || paneles.length === 0) {
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

        const labels = filas.map(fila => String(fila.label || ''));
        const canvasPrefix = 'canvas-control-clientes-aqp-participacion';
        const esMultiple = paneles.length > 1;
        const etiquetaFontSize = esCorporativo ? 9.5 : 10.5;
        const xFontSize = esCorporativo ? 10 : 11;
        const anchoMinimo = esCorporativo ? Math.max(1200, labels.length * 32 + 120) : 0;

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                    <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <p class="text-center text-[13px] font-bold text-slate-600 mb-2">${this.escapeHtml(dimensionLabel)}</p>
                    ${paneles.map((panel, indice) => {
                        const esUltimo = indice === paneles.length - 1;
                        const altura = esMultiple ? (esUltimo ? 230 : 190) : (esCorporativo ? 720 : 520);
                        const canvasHtml = `<canvas id="${canvasPrefix}-${indice}"></canvas>`;

                        if (esCorporativo && !esMultiple) {
                            return `
                                <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                                    <div class="relative" style="width: max(100%, ${anchoMinimo}px); height: ${altura}px;">
                                        ${canvasHtml}
                                    </div>
                                </div>
                            `;
                        }

                        return `
                            <div class="relative w-full ${esUltimo ? '' : 'border-b border-slate-100'}" style="height: ${altura}px;">
                                ${canvasHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        const self = this;

        paneles.forEach((panel, indice) => {
            const canvas = document.getElementById(`${canvasPrefix}-${indice}`);
            if (!canvas) return;

            const esUltimo = indice === paneles.length - 1;
            const valores = filas.map(fila => Number(fila[panel.clave]) || 0);
            const maxValor = Math.max(...valores, 0);
            const paso = Number(panel.step_y) || 1;
            const maxY = Math.max(paso * 2, Math.ceil(maxValor / paso) * paso);

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: panel.etiqueta,
                        data: valores,
                        backgroundColor: panel.color || '#4E79A7',
                        borderColor: panel.color || '#4E79A7',
                        borderWidth: 0,
                        borderRadius: 2,
                        barPercentage: esCorporativo ? 0.85 : 0.62,
                        categoryPercentage: esCorporativo ? 0.9 : 0.8,
                        maxBarThickness: esCorporativo ? 26 : 76
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
                        padding: { top: 24, right: 18, bottom: 4, left: 8 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => this.mostrarTooltip(context, data, panel)
                        },
                        datalabels: {
                            display: (ctx) => {
                                const valor = ctx.dataset.data[ctx.dataIndex];
                                return valor !== null && valor !== undefined && !isNaN(valor);
                            },
                            anchor: 'end',
                            align: 'top',
                            offset: 3,
                            clamp: true,
                            color: '#334155',
                            font: {
                                family: '"Segoe UI", sans-serif',
                                size: etiquetaFontSize,
                                weight: '600'
                            },
                            formatter: (value) => self.formatearEtiqueta(value, panel)
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: esUltimo, color: '#cbd5e1', width: 1 },
                            ticks: {
                                display: esUltimo,
                                autoSkip: false,
                                maxRotation: esCorporativo ? 90 : 0,
                                minRotation: esCorporativo ? 90 : 0,
                                color: '#334155',
                                padding: 6,
                                font: {
                                    family: '"Segoe UI", sans-serif',
                                    size: xFontSize,
                                    weight: '600'
                                }
                            }
                        },
                        y: {
                            min: 0,
                            max: maxY,
                            afterFit: (scale) => { scale.width = 78; },
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                            border: { color: '#cbd5e1', width: 1 },
                            title: {
                                display: true,
                                text: panel.etiqueta,
                                color: '#475569',
                                font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: paso,
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 11, weight: '600' },
                                padding: 10,
                                callback: (value) => `${value}%`
                            }
                        }
                    }
                }
            });

            this.charts.push(chart);
        });
    }
};

window.ChartRegistry['ControlClientesAqpParticipacion'] = window.ChartControlClientesAqpParticipacion;
