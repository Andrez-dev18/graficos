/**
 * Componente Participación de Mercado AQP - InfoMercados
 * Gráfico de líneas por empresa con porcentaje diario sobre el total.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartInfoMercadosParticipacionAQP = {
    chart: null,
    tooltipId: 'infomercados-participacion-aqp-tooltip',
    tooltipDelayMs: 500,
    tooltipTimer: null,
    tooltipVisible: false,
    tooltipKey: null,
    tooltipPendingKey: null,

    paleta: [
        '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#F1CE63', '#76B7B2',
        '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC', '#86BCB6', '#D37295'
    ],

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const fechas = Array.isArray(data && data.fechas) ? data.fechas : [];
        const series = Array.isArray(data && data.series) ? data.series : [];
        const labels = fechas.map(item => item.label || item.fecha || '');

        const anio = (data && data.anio) || '2026';
        const titulo = (data && data.titulo) || 'Participación de Mercado';
        const etiquetaSerie = (data && data.etiqueta_serie) || 'NomEmpresa';
        const etiquetaLeyenda = (data && data.etiqueta_leyenda) || 'EMPRESAS';
        const tipoSerie = etiquetaSerie === 'NomProveedor' ? 'proveedor' : 'empresa';

        const porcentajes = [];
        series.forEach(serie => {
            (Array.isArray(serie.valores) ? serie.valores : []).forEach(valor => {
                if (valor && Number.isFinite(Number(valor.porcentaje))) {
                    porcentajes.push(Number(valor.porcentaje));
                }
            });
        });

        const limiteSuperior = porcentajes.length > 0 && Math.max(...porcentajes) > 85 ? 100 : null;

        const nf = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const nfEntero = new Intl.NumberFormat('de-DE', {
            maximumFractionDigits: 0
        });

        const formatearPorcentaje = (valor) => {
            const numero = Number(valor);
            return Number.isFinite(numero) ? `${nf.format(numero)}%` : '';
        };

        const formatearEje = (valor) => {
            const numero = Number(valor);
            return Number.isFinite(numero) ? `${nfEntero.format(numero)}%` : '';
        };

        const escapeHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, caracter => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[caracter]));

        const header = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">${escapeHtml(titulo)}</h2>
                        <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Año ${escapeHtml(anio)}</span>
                    </div>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Participación porcentual diaria por ${escapeHtml(tipoSerie)}</p>
                </div>
                <span class="text-xs text-slate-400 font-medium">Haz clic en la leyenda para ocultar o mostrar ${tipoSerie === 'proveedor' ? 'un proveedor' : 'una empresa'}</span>
            </div>
        `;

        const tieneDatos = series.some(serie =>
            Array.isArray(serie.valores) &&
            serie.valores.some(valor => valor && Number.isFinite(Number(valor.porcentaje)))
        );

        if (fechas.length === 0 || !tieneDatos) {
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

        const minWidth = Math.max(1200, fechas.length * 56 + 150);
        const dprObjetivo = Math.max(4, window.devicePixelRatio || 1);
        const dprMaximo = Math.max(1, Math.min(4, 16000 / minWidth));
        const dprFinal = Math.min(dprObjetivo, dprMaximo);

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
                    <div class="flex-1 min-w-0 overflow-x-auto custom-scrollbar pb-1">
                        <div class="relative h-[700px]" style="min-width:${minWidth}px">
                            <canvas id="participacion-aqp-canvas"></canvas>
                        </div>
                    </div>
                    <div class="w-full lg:w-52 shrink-0">
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">${escapeHtml(etiquetaLeyenda)}</p>
                        <div id="participacion-aqp-legend"
                            class="flex flex-wrap lg:flex-col gap-1.5 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
                            ${series.map((serie, indice) => {
                                const color = this.paleta[indice % this.paleta.length];
                                const label = escapeHtml(serie.label || serie.empresa || '');
                                return `
                                    <button type="button" data-dataset-index="${indice}" aria-pressed="true"
                                        title="${label}"
                                        class="participacion-legend-item flex items-start gap-2 text-left px-1.5 py-1 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                                        <span class="w-3 h-3 rounded-[2px] shrink-0 mt-0.5" style="background:${color}"></span>
                                        <span class="text-[12px] font-semibold text-slate-600 leading-snug">${label}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('participacion-aqp-canvas');
        if (!canvas) return;

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

        const datasets = series.map((serie, indice) => {
            const color = this.paleta[indice % this.paleta.length];
            const valoresRaw = fechas.map((_, i) => {
                const valor = Array.isArray(serie.valores) ? serie.valores[i] : null;
                return valor && typeof valor === 'object' ? valor : null;
            });
            const valores = valoresRaw.map(valor => {
                if (!valor) return null;
                const numero = Number(valor.porcentaje);
                return Number.isFinite(numero) ? numero : null;
            });

            return {
                label: serie.label || serie.empresa || '',
                data: valores,
                rawValues: valoresRaw,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2.6,
                pointRadius: 3,
                pointHoverRadius: 6.5,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointHitRadius: 10,
                fill: false,
                tension: 0,
                spanGaps: true
            };
        });

        const verticalLabelsPlugin = {
            id: 'participacionAqpVerticalLabels',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                if (!ctx || !chartArea) return;

                ctx.save();
                ctx.font = '700 11.5px "Segoe UI", sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                const ocupados = [];
                const candidatos = [];

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    if (!chart.isDatasetVisible(datasetIndex)) return;

                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || !Array.isArray(meta.data)) return;

                    meta.data.forEach((element, index) => {
                        const valor = dataset.data[index];
                        if (valor === null || valor === undefined) return;

                        const texto = formatearPorcentaje(valor);
                        if (!texto) return;

                        const anchoTexto = ctx.measureText(texto).width;
                        const x = element.x + 3;
                        const y = element.y - 5;
                        const anchoEtiqueta = 14;
                        const altoEtiqueta = anchoTexto;

                        candidatos.push({
                            x1: x,
                            y1: y - altoEtiqueta,
                            x2: x + anchoEtiqueta,
                            y2: y,
                            x,
                            y,
                            texto,
                            color: dataset.borderColor,
                            valor
                        });
                    });
                });

                candidatos.sort((a, b) => b.valor - a.valor);

                candidatos.forEach(candidato => {
                    if (candidato.y1 < chartArea.top || candidato.y2 > chartArea.bottom) return;
                    if (candidato.x1 < chartArea.left || candidato.x2 > chartArea.right) return;

                    const colisiona = ocupados.some(ocupado =>
                        !(candidato.x2 < ocupado.x1 ||
                          candidato.x1 > ocupado.x2 ||
                          candidato.y2 < ocupado.y1 ||
                          candidato.y1 > ocupado.y2)
                    );

                    if (colisiona) return;
                    ocupados.push(candidato);

                    ctx.save();
                    ctx.translate(candidato.x, candidato.y);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = candidato.color;
                    ctx.fillText(candidato.texto, 0, 0);
                    ctx.restore();
                });

                ctx.restore();
            }
        };

        const tooltipDelayMs = Number(this.tooltipDelayMs) || 500;

        const obtenerTooltipEl = () => {
            let tooltipEl = document.getElementById(this.tooltipId);

            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = this.tooltipId;
                tooltipEl.style.position = 'absolute';
                tooltipEl.style.pointerEvents = 'none';
                tooltipEl.style.zIndex = '9999';
                tooltipEl.style.opacity = '0';
                tooltipEl.style.transition = 'opacity 0.12s ease';
                tooltipEl.style.background = 'rgba(255, 255, 255, 0.99)';
                tooltipEl.style.border = '1px solid #cbd5e1';
                tooltipEl.style.borderRadius = '8px';
                tooltipEl.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
                tooltipEl.style.padding = '12px 14px';
                tooltipEl.style.color = '#334155';
                tooltipEl.style.fontFamily = '"Segoe UI", sans-serif';
                tooltipEl.style.fontSize = '13px';
                tooltipEl.style.lineHeight = '1.5';
                document.body.appendChild(tooltipEl);
            }

            return tooltipEl;
        };

        const ocultarTooltip = () => {
            if (this.tooltipTimer) {
                clearTimeout(this.tooltipTimer);
                this.tooltipTimer = null;
            }

            this.tooltipVisible = false;
            this.tooltipKey = null;
            this.tooltipPendingKey = null;

            const tooltipEl = document.getElementById(this.tooltipId);
            if (tooltipEl) {
                tooltipEl.style.opacity = '0';
            }
        };

        const mostrarTooltip = (chart, tooltip, tooltipEl) => {
            const punto = tooltip.dataPoints && tooltip.dataPoints[0];

            if (!punto) {
                ocultarTooltip();
                return;
            }

            const dataset = punto.dataset;
            const valorRaw = Array.isArray(dataset.rawValues)
                ? dataset.rawValues[punto.dataIndex]
                : null;
            const valor = valorRaw && Number.isFinite(Number(valorRaw.porcentaje))
                ? Number(valorRaw.porcentaje)
                : Number(punto.parsed.y);

            if (!Number.isFinite(valor)) {
                ocultarTooltip();
                return;
            }

            const empresa = dataset.label || '';
            const fecha = labels[punto.dataIndex] || '';
            const color = dataset.borderColor || '#4E79A7';

            tooltipEl.style.borderLeft = `3px solid ${color}`;
            tooltipEl.innerHTML = `
                <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:7px 18px; align-items:start;">
                    <span style="color:#64748b;">${escapeHtml(etiquetaSerie)}:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${escapeHtml(empresa)}</span>
                    <span style="color:#64748b;">Día de fecha:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${escapeHtml(fecha)}</span>
                    <span style="color:#64748b; max-width:250px;">% de total cantidad junto con Tabla (abajo):</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${formatearPorcentaje(valor)}</span>
                </div>
            `;

            const rect = chart.canvas.getBoundingClientRect();
            let left = rect.left + window.scrollX + tooltip.caretX + 14;
            let top = rect.top + window.scrollY + tooltip.caretY;

            tooltipEl.style.opacity = '1';
            tooltipEl.style.left = `${left}px`;
            tooltipEl.style.top = `${top}px`;
            tooltipEl.style.transform = 'translateY(-50%)';

            const tooltipRect = tooltipEl.getBoundingClientRect();

            if (tooltipRect.right > window.innerWidth - 12) {
                left = rect.left + window.scrollX + tooltip.caretX - tooltipRect.width - 14;
                tooltipEl.style.left = `${Math.max(8, left)}px`;
            }

            if (tooltipRect.bottom > window.innerHeight - 12) {
                top = window.scrollY + window.innerHeight - tooltipRect.height - 12;
                tooltipEl.style.top = `${Math.max(8, top)}px`;
            }

            this.tooltipVisible = true;
            this.tooltipKey = `${punto.datasetIndex}:${punto.dataIndex}`;
            this.tooltipPendingKey = null;
        };

        const externalTooltipHandler = (context) => {
            const { chart, tooltip } = context;
            const tooltipEl = obtenerTooltipEl();
            const punto = tooltip.dataPoints && tooltip.dataPoints[0];

            if (!punto || tooltip.opacity === 0) {
                ocultarTooltip();
                return;
            }

            const dataset = punto.dataset;
            const valorRaw = Array.isArray(dataset.rawValues)
                ? dataset.rawValues[punto.dataIndex]
                : null;
            const valor = valorRaw && Number.isFinite(Number(valorRaw.porcentaje))
                ? Number(valorRaw.porcentaje)
                : Number(punto.parsed.y);

            if (!Number.isFinite(valor)) {
                ocultarTooltip();
                return;
            }

            const key = `${punto.datasetIndex}:${punto.dataIndex}`;

            if (this.tooltipVisible) {
                mostrarTooltip(chart, tooltip, tooltipEl);
                return;
            }

            if (this.tooltipPendingKey === key) {
                return;
            }

            if (this.tooltipTimer) {
                clearTimeout(this.tooltipTimer);
                this.tooltipTimer = null;
            }

            this.tooltipPendingKey = key;
            this.tooltipTimer = setTimeout(() => {
                this.tooltipTimer = null;
                const tooltipActual = document.getElementById(this.tooltipId);
                if (!tooltipActual) return;
                mostrarTooltip(chart, tooltip, tooltipActual);
            }, tooltipDelayMs);
        };

        const tooltipHandler = externalTooltipHandler.bind(this);

        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            plugins: [verticalLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: dprFinal,
                animation: { duration: 300 },
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                layout: {
                    padding: { top: 42, right: 12, bottom: 8, left: 8 }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,
                        external: tooltipHandler
                    },
                    datalabels: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 11.5 }
                        },
                        title: {
                            display: true,
                            text: 'Día de fecha',
                            color: '#64748b',
                            font: { family: '"Segoe UI", sans-serif', size: 13.5, weight: '600' }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ...(limiteSuperior !== null
                            ? { max: limiteSuperior, grace: '0%' }
                            : { grace: '2%' }),
                        grid: {
                            color: 'rgba(148, 163, 184, 0.24)',
                            drawTicks: false
                        },
                        border: { display: false },
                        ticks: {
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 11.5 },
                            stepSize: 5,
                            callback: (value) => formatearEje(value)
                        },
                        title: {
                            display: true,
                            text: '% del total cantidad',
                            color: '#64748b',
                            font: { family: '"Segoe UI", sans-serif', size: 13.5, weight: '600' }
                        }
                    }
                }
            }
        });

        const leyenda = document.getElementById('participacion-aqp-legend');
        if (leyenda) {
            leyenda.querySelectorAll('[data-dataset-index]').forEach(boton => {
                boton.addEventListener('click', () => {
                    if (!this.chart) return;

                    const indice = Number(boton.dataset.datasetIndex);
                    const visible = this.chart.isDatasetVisible(indice);
                    this.chart.setDatasetVisibility(indice, !visible);
                    this.chart.update();

                    boton.classList.toggle('opacity-40', visible);
                    boton.setAttribute('aria-pressed', String(!visible));
                });
            });
        }
    },

    destroy() {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }

        this.tooltipVisible = false;
        this.tooltipKey = null;
        this.tooltipPendingKey = null;

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        const tooltipEl = document.getElementById(this.tooltipId);
        if (tooltipEl) {
            tooltipEl.remove();
        }
    }
};

window.ChartRegistry['InfoMercadosParticipacionAQP'] = window.ChartInfoMercadosParticipacionAQP;
window.ChartRegistry['InfoMercadosParticipacionPROV'] = window.ChartInfoMercadosParticipacionAQP;
