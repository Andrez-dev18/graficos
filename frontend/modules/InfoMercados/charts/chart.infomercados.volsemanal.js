/**
 * Componente VolSemanal - InfoMercados
 * Gráfico de líneas con las 53 semanas del año 2026.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartInfoMercadosVolSemanal = {
    chart: null,

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const semanas = Array.isArray(data && data.semanas) ? data.semanas : [];
        const labels = semanas.map(item => item.label || `Semana ${item.semana}`);
        const valores = semanas.map(item => {
            if (item.cantidad === null || item.cantidad === undefined) return null;
            const numero = Number(item.cantidad);
            return Number.isFinite(numero) ? numero : null;
        });

        const anio = (data && data.anio) || '2026';
        const titulo = (data && data.titulo) || 'Volumen Semanal Arequipa';

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">${titulo}</h2>
                            <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">Año ${anio}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 font-medium mt-0.5">Cantidad semanal · 53 semanas</p>
                    </div>
                    <span class="text-[11px] text-slate-400 font-medium">Desliza horizontalmente para ver todas las semanas</span>
                </div>

                <div class="p-3 sm:p-4">
                    <div class="w-full overflow-x-auto custom-scrollbar pb-1">
                        <div class="relative h-[560px] min-w-[1600px]">
                            <canvas id="volsemanal-canvas"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('volsemanal-canvas');
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

        const nf = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 });
        const compact = (value) => {
            const numero = Number(value) || 0;
            const abs = Math.abs(numero);

            if (abs >= 1000000) {
                return `${(numero / 1000000).toFixed(1).replace('.', ',')}M`;
            }
            if (abs >= 1000) {
                return `${Math.round(numero / 1000)}K`;
            }
            return nf.format(numero);
        };

        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: valores,
                    borderColor: '#4E79A7',
                    backgroundColor: 'rgba(78, 121, 167, 0.10)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    spanGaps: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#4E79A7',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1,
                    pointHitRadius: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 350 },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: { top: 32, right: 18, bottom: 8, left: 10 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.94)',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                const valor = context.parsed.y;
                                return valor === null || valor === undefined
                                    ? 'Sin datos'
                                    : `Cantidad: ${nf.format(valor)}`;
                            }
                        }
                    },
                    datalabels: {
                        display: (context) => {
                            const valor = context.dataset.data[context.dataIndex];
                            return valor !== null && valor !== undefined;
                        },
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        clamp: true,
                        color: '#334155',
                        font: {
                            size: 9.5,
                            weight: '600'
                        },
                        formatter: (value) => {
                            if (value === null || value === undefined) return '';
                            return nf.format(value);
                        }
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
                            font: { size: 10 }
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
                            font: { size: 10 },
                            callback: (value) => compact(value)
                        },
                        title: {
                            display: true,
                            text: 'cantidad',
                            color: '#64748b',
                            font: { size: 11, weight: '600' }
                        }
                    }
                }
            }
        });
    },

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.ChartRegistry['InfoMercadosVolSemanal'] = window.ChartInfoMercadosVolSemanal;
