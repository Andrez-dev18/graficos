/**
 * Componente genérico AQP Empresa - InfoMercados
 * Soporta AQPCantEmpresa, AQPPesoEmpresa, AQPKilosEmpresa,
 * AQPSolesEmpresa y AQPPrecioEmpresa.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartInfoMercadosAQPEmpresa = {
    chart: null,

    paleta: [
        '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#F1CE63', '#76B7B2',
        '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC', '#86BCB6', '#D37295'
    ],

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const series = Array.isArray(data && data.series) ? data.series : [];
        const dias = Array.isArray(data && data.dias) && data.dias.length > 0
            ? data.dias
            : Array.from({ length: 31 }, (_, i) => i + 1);
        const labels = dias.map(dia => String(dia));

        const anio = (data && data.anio) || '2026';
        const titulo = (data && data.titulo) || 'Comportamiento de Aves AREQUIPA';
        const tipoFormato = (data && data.tipo_formato) || 'numero';
        const decimales = Number.isFinite(Number(data && data.decimales))
            ? Number(data.decimales)
            : 2;
        const unidad = (data && data.unidad) || '';
        const etiquetaMetrica = (data && data.etiqueta_metrica) || 'valor';
        const etiquetaEje = (data && data.etiqueta_eje) || etiquetaMetrica;
        const compactoEje = !!(data && data.compacto_eje);

        const promedio = (data && data.promedio !== null && data.promedio !== undefined)
            ? Number(data.promedio)
            : null;

        const tieneDatos = series.some(serie =>
            Array.isArray(serie.valores) &&
            serie.valores.some(valor => valor !== null && valor !== undefined)
        );

        const header = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">${titulo}</h2>
                        <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Año ${anio}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 font-medium mt-0.5">Comparativo mensual por día</p>
                </div>
                <span class="text-[11px] text-slate-400 font-medium">Haz clic en la leyenda para ocultar o mostrar un mes</span>
            </div>
        `;

        if (!tieneDatos) {
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

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="p-3 sm:p-4">
                    <div class="w-full overflow-x-auto custom-scrollbar pb-1">
                        <div class="relative h-[600px] min-w-[1200px]">
                            <canvas id="aqpempresa-canvas"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('aqpempresa-canvas');
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

        const nf = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });

        const formatearValor = (valor) => {
            const numero = Number(valor);
            if (!Number.isFinite(numero)) return '';

            if (tipoFormato === 'moneda') {
                const abs = Math.abs(numero);
                return `${numero < 0 ? '-' : ''}S/ ${nf.format(abs)}`;
            }

            return nf.format(numero) + (unidad ? ` ${unidad}` : '');
        };

        const formatearEje = (valor) => {
            const numero = Number(valor) || 0;
            const abs = Math.abs(numero);

            if (compactoEje) {
                let texto;
                if (abs >= 1000000) {
                    texto = `${(numero / 1000000).toFixed(1).replace('.', ',')}M`;
                } else if (abs >= 1000) {
                    texto = `${Math.round(numero / 1000)}K`;
                } else {
                    texto = nf.format(numero);
                }
                return tipoFormato === 'moneda' ? `S/ ${texto}` : texto;
            }

            return tipoFormato === 'moneda' ? `S/ ${nf.format(numero)}` : nf.format(numero);
        };

        const datasets = [];
        const promedios = [];

        series.forEach((serie, indice) => {
            const color = this.paleta[indice % this.paleta.length];
            const valores = dias.map((_, i) => {
                const valor = Array.isArray(serie.valores) ? serie.valores[i] : null;
                if (valor === null || valor === undefined) return null;
                const numero = Number(valor);
                return Number.isFinite(numero) ? numero : null;
            });

            valores.forEach(valor => {
                if (valor !== null) promedios.push(valor);
            });

            datasets.push({
                label: serie.label,
                data: valores,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 1.8,
                pointRadius: 2.5,
                pointHoverRadius: 5,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                fill: false,
                tension: 0,
                spanGaps: true,
                isMonthLine: true,
                month: serie.mes
            });

            const tendencia = this.calcularTendencia(valores);
            if (tendencia) {
                datasets.push({
                    label: `${serie.label} - tendencia`,
                    data: tendencia,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 1.4,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    isTrendline: true,
                    month: serie.mes
                });
            }
        });

        const promedioFinal = (promedio !== null && Number.isFinite(promedio))
            ? promedio
            : (promedios.length > 0 ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null);

        if (promedioFinal !== null) {
            datasets.push({
                label: 'Promedio',
                data: dias.map(() => promedioFinal),
                borderColor: '#4b5563',
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                isAverage: true
            });
        }

        const verticalLabelsPlugin = {
            id: 'aqpVerticalLabels',
            afterDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                if (!ctx || !chartArea) return;

                ctx.save();
                ctx.font = '600 10.5px "Segoe UI", sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                const ocupados = [];
                const candidatos = [];

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    if (dataset.isTrendline || dataset.isAverage) return;
                    if (!dataset.isMonthLine || !chart.isDatasetVisible(datasetIndex)) return;

                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || !Array.isArray(meta.data)) return;

                    meta.data.forEach((element, index) => {
                        const valor = dataset.data[index];
                        if (valor === null || valor === undefined) return;

                        const texto = formatearValor(valor);
                        const anchoTexto = ctx.measureText(texto).width;
                        const x = element.x + 3;
                        const y = element.y - 3;
                        const anchoEtiqueta = 12;
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

                if (promedioFinal !== null) {
                    const yPromedio = chart.scales.y.getPixelForValue(promedioFinal);
                    if (yPromedio >= chartArea.top && yPromedio <= chartArea.bottom) {
                        ctx.fillStyle = '#4b5563';
                        ctx.font = '700 11px "Segoe UI", sans-serif';
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText('Promedio', chartArea.left + 8, yPromedio - 3);
                    }
                }

                ctx.restore();
            }
        };

        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            plugins: [verticalLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
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
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 8,
                            font: { size: 10 },
                            filter: (item) => {
                                const texto = String(item.text || '');
                                return !texto.endsWith('- tendencia') && texto !== 'Promedio';
                            }
                        },
                        onClick: (event, item, legend) => {
                            const chart = legend.chart;
                            const dataset = chart.data.datasets[item.datasetIndex];
                            if (!dataset || !dataset.isMonthLine) return;

                            const visible = chart.isDatasetVisible(item.datasetIndex);

                            chart.data.datasets.forEach((actual, indice) => {
                                if (actual.month === dataset.month && (actual.isMonthLine || actual.isTrendline)) {
                                    chart.setDatasetVisibility(indice, !visible);
                                }
                            });

                            chart.update();
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#334155',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 12,
                        bodyFont: { size: 12 },
                        displayColors: false,
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const dataset = context.dataset;
                                if (dataset.isTrendline || dataset.isAverage) return [];

                                const dia = context.dataIndex + 1;
                                const mes = String(dataset.label || '').toLowerCase();
                                const valor = context.parsed.y;

                                return [
                                    `Día de fecha: ${dia}`,
                                    `Mes de fecha: ${mes}`,
                                    `${etiquetaMetrica}: ${formatearValor(valor)}`
                                ];
                            }
                        },
                        filter: (item) => {
                            const dataset = item.dataset;
                            return !dataset.isTrendline && !dataset.isAverage;
                        }
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
                            color: '#475569',
                            font: { size: 11 }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grace: '10%',
                        grid: {
                            color: 'rgba(148, 163, 184, 0.24)',
                            drawTicks: false
                        },
                        border: { display: false },
                        ticks: {
                            color: '#475569',
                            font: { size: 11 },
                            callback: (value) => formatearEje(value)
                        },
                        title: {
                            display: true,
                            text: etiquetaEje,
                            color: '#64748b',
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    },

    calcularTendencia(valores) {
        const puntos = [];

        valores.forEach((valor, indice) => {
            if (valor === null || valor === undefined) return;
            const numero = Number(valor);
            if (Number.isFinite(numero)) {
                puntos.push({ x: indice + 1, y: numero });
            }
        });

        if (puntos.length < 2) return null;

        const n = puntos.length;
        let sumaX = 0;
        let sumaY = 0;
        let sumaXY = 0;
        let sumaX2 = 0;

        puntos.forEach(punto => {
            sumaX += punto.x;
            sumaY += punto.y;
            sumaXY += punto.x * punto.y;
            sumaX2 += punto.x * punto.x;
        });

        const denominador = (n * sumaX2) - (sumaX * sumaX);
        if (denominador === 0) return null;

        const pendiente = ((n * sumaXY) - (sumaX * sumaY)) / denominador;
        const intercepto = (sumaY - (pendiente * sumaX)) / n;

        return valores.map((_, indice) => {
            const x = indice + 1;
            return (pendiente * x) + intercepto;
        });
    },

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.ChartRegistry['InfoMercadosAQPEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
window.ChartRegistry['InfoMercadosAQPCantEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
window.ChartRegistry['InfoMercadosAQPPesoEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
window.ChartRegistry['InfoMercadosAQPKilosEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
window.ChartRegistry['InfoMercadosAQPSolesEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
window.ChartRegistry['InfoMercadosAQPPrecioEmpresa'] = window.ChartInfoMercadosAQPEmpresa;
