window.DashTasasdeInteresView = {
    chart: null,

    COLORES: {
        bcr: '#4e79a7',
        bcp: '#f28e2b',
        banbif: '#59a14f'
    },

    render(contenedor, payload) {
        if (!contenedor) return;

        this.destroy();

        const periodos = payload && Array.isArray(payload.periodos)
            ? payload.periodos.filter(item => item.bcr !== null || item.bcp !== null || item.banbif !== null)
            : [];

        if (!periodos.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-10 text-center text-slate-400 font-medium">
                    No se encontraron tasas de interés para mostrar.
                </div>
            `;
            return;
        }

        contenedor.innerHTML = `
            <section class="dash-card p-4 sm:p-5">
                <div class="relative mb-4 flex min-h-[38px] items-center justify-center">
                    <h2 class="text-xl font-bold text-slate-900 underline underline-offset-4">Tasas de Interés</h2>
                    <div class="absolute right-0 top-0 flex items-center gap-4 text-xs font-medium text-slate-600">
                        ${this.leyenda(this.COLORES.bcp, 'bcp')}
                        ${this.leyenda(this.COLORES.bcr, 'bcr')}
                        ${this.leyenda(this.COLORES.banbif, 'banbif')}
                    </div>
                </div>
                <div class="relative w-full" style="height:720px;">
                    <canvas id="tasas-interes-canvas"></canvas>
                </div>
            </section>
        `;

        if (typeof Chart === 'undefined') {
            contenedor.innerHTML = `
                <div class="dash-card p-10 text-center text-rose-700 font-semibold">
                    No se pudo cargar Chart.js para dibujar el gráfico.
                </div>
            `;
            return;
        }

        if (typeof ChartDataLabels !== 'undefined' && !Chart.registry.plugins.get('datalabels')) {
            Chart.register(ChartDataLabels);
        }

        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2.5);

        const labels = periodos.map(item => item.label);
        const bcr = periodos.map(item => this.numero(item.bcr));
        const bcp = periodos.map(item => this.numero(item.bcp));
        const banbif = periodos.map(item => this.numero(item.banbif));
        const canvas = contenedor.querySelector('#tasas-interes-canvas');

        if (!canvas) return;

        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'bcr',
                        data: bcr,
                        yAxisID: 'y',
                        backgroundColor: this.COLORES.bcr,
                        borderColor: this.COLORES.bcr,
                        borderWidth: 0,
                        barPercentage: 0.72,
                        categoryPercentage: 0.9,
                        maxBarThickness: 40,
                        datalabels: this.etiquetasDatos(this.COLORES.bcr)
                    },
                    {
                        type: 'line',
                        label: 'bcp',
                        data: bcp,
                        yAxisID: 'y1',
                        borderColor: this.COLORES.bcp,
                        backgroundColor: this.COLORES.bcp,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHitRadius: 12,
                        tension: 0,
                        spanGaps: false,
                        datalabels: this.etiquetasDatos(this.COLORES.bcp)
                    },
                    {
                        type: 'line',
                        label: 'banbif',
                        data: banbif,
                        yAxisID: 'y1',
                        borderColor: this.COLORES.banbif,
                        backgroundColor: this.COLORES.banbif,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHitRadius: 12,
                        tension: 0,
                        spanGaps: false,
                        datalabels: this.etiquetasDatos(this.COLORES.banbif)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: { top: 18, right: 8, left: 0, bottom: 0 }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        usePointStyle: true,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: (context) => {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                return ` ${context.dataset.label}: ${Number(valor).toFixed(3)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            autoSkip: false,
                            minRotation: 90,
                            maxRotation: 90,
                            padding: 8,
                            color: '#475569',
                            font: { size: 10 }
                        }
                    },
                    y: {
                        position: 'left',
                        min: 3,
                        max: 8,
                        grid: { color: '#e2e8f0' },
                        border: { display: false },
                        title: {
                            display: true,
                            text: 'bcr',
                            color: '#475569',
                            font: { size: 12, weight: '600' }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#64748b',
                            font: { size: 11 },
                            callback: (value) => Number(value).toFixed(1)
                        }
                    },
                    y1: {
                        position: 'right',
                        min: 3,
                        max: 8,
                        grid: { display: false },
                        border: { display: false },
                        title: {
                            display: true,
                            text: 'Valor',
                            color: '#475569',
                            font: { size: 12, weight: '600' }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#64748b',
                            font: { size: 11 },
                            callback: (value) => Number(value).toFixed(1)
                        }
                    }
                }
            }
        });
    },

    numero(valor) {
        if (valor === null || valor === undefined || valor === '') return null;
        const n = Number(valor);
        return Number.isFinite(n) ? n : null;
    },

    etiquetasDatos(color) {
        return {
            display: (context) => {
                const valor = context.dataset.data[context.dataIndex];
                return valor !== null && valor !== undefined;
            },
            formatter: (value) => Number(value).toFixed(3),
            color,
            anchor: 'end',
            align: 'top',
            offset: 4,
            clip: false,
            font: { size: 10, weight: '600' }
        };
    },

    leyenda(color, texto) {
        return `
            <span class="inline-flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" style="background:${color};"></span>
                ${texto}
            </span>
        `;
    },

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};
