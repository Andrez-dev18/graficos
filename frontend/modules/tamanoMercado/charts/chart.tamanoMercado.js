/**
 * Componente Visual ChartTamanoMercado - CoreBI
 * Implementación de los gráficos de Tableau para Tamaño de Mercado:
 * 1. Participacion (gráfico de líneas: % diario por empresa)
 * 2. Unidades (Preparado para Doble Eje: Cantidad + Peso Promedio)
 * 3. Pesos (Preparado para Doble Eje: Kilos + Peso Promedio)
 * 4. Importe (Preparado para Doble Eje: Soles + Peso Promedio)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartTamanoMercado = {
    chart: null,

    colores: {
        borde:     '#CBD5E1',
        texto:     '#475569',
        fondoPar:  '#F8FAFC'
    },

    destroy() {
        this.hideTooltip();

        if (this.chart && typeof this.chart.destroy === 'function') {
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

    formatPorcentaje(num, decimals = 1) {
        if (num === null || num === undefined || isNaN(num)) return '0.0%';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + '%';
    },

    formatMoneda(num) {
        if (num === null || num === undefined || isNaN(num)) return 'S/ 0.00';
        return 'S/ ' + Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    formatPesoPromedio(num) {
        if (num === null || num === undefined || isNaN(num)) return '0,000 Kg';
        return this.formatNumero(num, 3) + ' Kg';
    },

    getMedidaConfig(tipo) {
        const configs = {
            Unidades: {
                titulo: 'Unidades Diarias',
                subtitulo: 'Cantidad de aves comercializadas y peso promedio por día',
                clave: 'unidades',
                medida: 'Unidades',
                etiquetaTooltip: 'Cantidad',
                color: '#E15759',
                ejeTitulo: 'Unidades',
                formatoValor: (valor) => this.formatNumero(valor, 0) + ' UND',
                formatoEje: (valor) => this.formatNumero(valor, 0)
            },
            Pesos: {
                titulo: 'Pesos Diarios',
                subtitulo: 'Kilos comercializados y peso promedio por día',
                clave: 'pesos',
                medida: 'Peso',
                etiquetaTooltip: 'Peso',
                color: '#4E79A7',
                ejeTitulo: 'Kilos',
                formatoValor: (valor) => this.formatNumero(valor, 2) + ' Kg',
                formatoEje: (valor) => this.formatNumero(valor, 0)
            },
            Importe: {
                titulo: 'Importe Diario',
                subtitulo: 'Soles comercializados y peso promedio por día',
                clave: 'importes',
                medida: 'ImporteTotal',
                etiquetaTooltip: 'ImporteTotal',
                color: '#76B7B2',
                ejeTitulo: 'Soles',
                formatoValor: (valor) => 'S/ ' + this.formatNumero(valor, 2),
                formatoEje: (valor) => this.formatNumero(valor, 0)
            }
        };

        return configs[tipo] || configs.Unidades;
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    getTooltipElement() {
        let tooltipEl = document.getElementById('tamano-mercado-tooltip');

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'tamano-mercado-tooltip';
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.zIndex = '9999';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.1s ease';
            tooltipEl.style.background = '#ffffff';
            tooltipEl.style.border = '1px solid #cbd5e1';
            tooltipEl.style.borderRadius = '4px';
            tooltipEl.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            tooltipEl.style.padding = '11px 14px';
            tooltipEl.style.color = '#334155';
            tooltipEl.style.fontFamily = '"Segoe UI", sans-serif';
            tooltipEl.style.fontSize = '13px';
            tooltipEl.style.lineHeight = '1.55';
            tooltipEl.style.maxWidth = '560px';
            tooltipEl.style.wordBreak = 'break-word';
            document.body.appendChild(tooltipEl);

            document.addEventListener('scroll', () => this.hideTooltip(), { capture: true, passive: true });
        }

        return tooltipEl;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tamano-mercado-tooltip');
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    },

    showTooltip(context) {
        const tooltipEl = this.getTooltipElement();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.hideTooltip();
            return;
        }

        const meta = punto.dataset.metaTooltip;
        let filas;

        if (meta) {
            filas = [
                ['Día de fecha:', this.formatFecha(punto.label)],
                [`${meta.etiqueta}:`, meta.formato(punto.raw)]
            ];
        } else {
            filas = [
                ['Empresas:', punto.dataset.label],
                ['Día de fecha:', this.formatFecha(punto.label)],
                ['% de total cantidad junto con Tabla (abajo):', this.formatPorcentaje(punto.raw, 2)]
            ];
        }

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 20px; align-items:start;">
                ${filas.map(([etiqueta, valor]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';
        this.positionTooltip(context.chart, tooltip, tooltipEl);
    },

    positionTooltip(chart, tooltip, tooltipEl) {
        const rect = chart.canvas.getBoundingClientRect();
        const offset = 14;
        const tooltipWidth = Math.min(560, window.innerWidth - 24);
        const tooltipHeight = tooltipEl.getBoundingClientRect().height || 120;

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

    formatFecha(fecha) {
        return String(fecha || '').replace(/-/g, '/');
    },

    /**
     * Renderizador principal
     */
    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const labels = Array.isArray(data && data.labels) ? data.labels : [];
        const tipoGrafico = (data && data.tipo_grafico) || 'Participacion';
        const participacion = (data && data.participacion) || { series: [], totales_dia: [] };

        if (labels.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center text-slate-400">
                    <i class="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
                    <p class="text-base font-semibold text-slate-700">No se encontraron datos</p>
                    <p class="text-xs text-slate-400 mt-1">Prueba seleccionando otro rango de fechas o provincia.</p>
                </div>
            `;
            return;
        }

        if (tipoGrafico === 'Participacion') {
            this.renderParticipacion(contenedor, labels, participacion);
        } else if (['Unidades', 'Pesos', 'Importe'].includes(tipoGrafico)) {
            this.renderMedida(contenedor, labels, data, tipoGrafico);
        }
    },

    /**
     * RENDERIZADO: Participación (Stacked Bar 100%)
     */
    /**
     * RENDERIZADO: Participación (gráfico de líneas por empresa)
     */
    renderParticipacion(contenedor, labels, participacion) {
        const series = Array.isArray(participacion.series) ? participacion.series : [];
        const labelsFecha = labels.map(fecha => this.formatFecha(fecha));

        const html = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-6">
                <!-- CABECERA DEL GRÁFICO -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-lg font-bold text-slate-800">Participación Diaria por Empresa</h2>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">Porcentaje de unidades comercializadas por día</p>
                    </div>

                </div>

                <!-- GRÁFICO DE LÍNEAS -->
                <div class="w-full">
                    <p class="text-center text-[13px] font-bold text-slate-600 mb-2">Día de fecha</p>
                    <div class="relative w-full" style="height: 600px;">
                        <canvas id="canvas-participacion"></canvas>
                    </div>
                </div>
            </div>
        `;

        contenedor.innerHTML = html;

        const canvas = document.getElementById('canvas-participacion');
        if (!canvas) return;

        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }

        const datasets = series.map(s => ({
            label: s.nombre,
            data: s.porcentajes,
            borderColor: s.color,
            backgroundColor: s.color,
            borderWidth: 1.5,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBorderWidth: 0,
            pointBackgroundColor: s.color,
            tension: 0,
            fill: false,
            spanGaps: false,
            rawUnidades: s.unidades,
            rawPesos: s.pesos
        }));

        let maxPct = 0;
        series.forEach(s => {
            (Array.isArray(s.porcentajes) ? s.porcentajes : []).forEach(v => {
                const numero = Number(v);
                if (Number.isFinite(numero) && numero > maxPct) maxPct = numero;
            });
        });
        const yMax = Math.max(5, Math.ceil(maxPct / 5) * 5);

        const self = this;
        this.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labelsFecha,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                animation: { duration: 300 },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                layout: {
                    padding: { top: 32, right: 18, bottom: 4, left: 4 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => this.showTooltip(context)
                    },
                    datalabels: {
                        display: (ctx) => {
                            const valor = ctx.dataset.data[ctx.dataIndex];
                            return valor !== null && valor !== undefined && !isNaN(valor);
                        },
                        anchor: 'center',
                        align: 'top',
                        offset: 4,
                        rotation: -90,
                        clamp: true,
                        color: (ctx) => ctx.dataset.borderColor,
                        font: { family: '"Segoe UI", sans-serif', size: 10, weight: '700' },
                        formatter: (value) => {
                            if (value === null || value === undefined || isNaN(value)) return '';
                            return self.formatPorcentaje(value, 2);
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: '"Segoe UI", sans-serif', size: 10.5, weight: '600' },
                            color: '#475569',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: yMax,
                        title: {
                            display: true,
                            text: '% de total cantidad',
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                        },
                        grid: { color: '#F1F5F9' },
                        ticks: {
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 11.5, weight: '600' },
                            stepSize: 5,
                            callback: (v) => v + '%'
                        }
                    }
                }
            }
        });
    },

    /**
     * RENDERIZADO: Unidades / Pesos / Importe (doble eje: medida + peso promedio)
     */
    renderMedida(contenedor, labels, data, tipo) {
        const config = this.getMedidaConfig(tipo);
        const resumen = (data && data.resumen_diario) || {};
        const valores = Array.isArray(resumen[config.clave]) ? resumen[config.clave] : [];
        const promedios = Array.isArray(resumen.promedio_peso) ? resumen.promedio_peso : [];
        const labelsFecha = labels.map(fecha => this.formatFecha(fecha));

        const html = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-6">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(config.titulo)}</h2>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(config.subtitulo)}</p>
                    </div>
                </div>

                <div class="w-full">
                    <p class="text-center text-[13px] font-bold text-slate-600 mb-2">Día de fecha</p>
                    <div class="relative w-full" style="height: 600px;">
                        <canvas id="canvas-medida"></canvas>
                    </div>
                </div>
            </div>
        `;

        contenedor.innerHTML = html;

        const canvas = document.getElementById('canvas-medida');
        if (!canvas) return;

        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }

        const self = this;
        const primaryMeta = {
            etiqueta: config.etiquetaTooltip,
            formato: (valor) => config.formatoValor(valor)
        };
        const secondaryMeta = {
            etiqueta: 'Peso promedio',
            formato: (valor) => self.formatPesoPromedio(valor)
        };

        const datasets = [
            {
                label: config.medida,
                data: valores,
                borderColor: config.color,
                backgroundColor: config.color,
                borderWidth: 1.5,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBorderWidth: 0,
                pointBackgroundColor: config.color,
                tension: 0,
                fill: false,
                spanGaps: false,
                yAxisID: 'y',
                metaTooltip: primaryMeta
            },
            {
                label: 'Peso promedio',
                data: promedios,
                borderColor: '#F28E2B',
                backgroundColor: '#F28E2B',
                borderWidth: 1.5,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBorderWidth: 0,
                pointBackgroundColor: '#F28E2B',
                tension: 0,
                fill: false,
                spanGaps: false,
                yAxisID: 'y1',
                metaTooltip: secondaryMeta
            }
        ];

        this.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labelsFecha,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                animation: { duration: 300 },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                layout: {
                    padding: { top: 32, right: 16, bottom: 4, left: 4 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => this.showTooltip(context)
                    },
                    datalabels: {
                        display: (ctx) => {
                            const valor = ctx.dataset.data[ctx.dataIndex];
                            return valor !== null && valor !== undefined && !isNaN(valor);
                        },
                        anchor: 'center',
                        align: 'top',
                        offset: 4,
                        rotation: -90,
                        clamp: true,
                        color: (ctx) => ctx.dataset.borderColor,
                        font: { family: '"Segoe UI", sans-serif', size: 10, weight: '700' },
                        formatter: (value, ctx) => {
                            if (value === null || value === undefined || isNaN(value)) return '';
                            return ctx.datasetIndex === 0
                                ? config.formatoValor(value)
                                : self.formatPesoPromedio(value);
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { family: '"Segoe UI", sans-serif', size: 10.5, weight: '600' },
                            color: '#475569',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: config.ejeTitulo,
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                        },
                        grid: { color: '#F1F5F9' },
                        ticks: {
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 11.5, weight: '600' },
                            callback: (valor) => config.formatoEje(valor)
                        }
                    },
                    y1: {
                        position: 'right',
                        min: 2,
                        max: 7,
                        title: {
                            display: true,
                            text: 'Peso promedio (Kg)',
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                        },
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 11.5, weight: '600' },
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
};
