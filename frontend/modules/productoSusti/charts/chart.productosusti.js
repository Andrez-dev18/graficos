/**
 * Componente Visual ChartProductosSustitutos - CoreBI
 * Implementación de los 2 gráficos de Tableau:
 * 1. ProdGeneral (tableu2.png): Gráfico general consolidado de barras por semana con doble eje.
 * 2. ProdIndividual (tableu1.png): Paneles apilados por producto con eje X sincronizado y scroll horizontal.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartProductosSustitutos = {
    charts: [],
    syncScrollHandler: null,

    colores: {
        peso:      '#4E79A7', // Azul clásico Tableau
        pesoHover: '#3b5f88',
        precio:    '#F28E2B', // Naranja clásico Tableau
        borde:     '#CBD5E1',
        texto:     '#475569',
        fondoPar:  '#F8FAFC'
    },

    destroy() {
        if (Array.isArray(this.charts)) {
            this.charts.forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
        }
        this.charts = [];

        // Limpiar sincronización de scroll si existía
        const wrappers = document.querySelectorAll('.sync-scroll-product-susti');
        wrappers.forEach(w => {
            w.onscroll = null;
        });
    },

    // Formateador numérico de miles estilo Tableau (ej: 126.000)
    formatTableau(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    // Formateador moneda estilo Tableau (ej: S/ 4,5)
    formatMoneda(num) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return 'S/ ' + Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
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

    // Plugin personalizado de Chart.js para dibujar valores numéricos arriba de las barras y de las líneas
    getBarValuesPlugin() {
        const self = this;
        return {
            id: 'barValuesPlugin',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;

                // 1. DIBUJAR LABELS VERTICALES SOBRE LAS BARRAS (Dataset 0: peso)
                const metaBars = chart.getDatasetMeta(0);
                if (metaBars && !metaBars.hidden && chart.data.datasets[0]) {
                    ctx.save();
                    ctx.font = '600 9px sans-serif';
                    ctx.fillStyle = '#334155';

                    metaBars.data.forEach((bar, index) => {
                        const val = chart.data.datasets[0].data[index];
                        if (val !== null && val !== undefined && val > 0) {
                            const labelText = self.formatTableau(val, 0);
                            ctx.save();
                            ctx.translate(bar.x, bar.y - 4);
                            ctx.rotate(-Math.PI / 2);
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(labelText, 0, 0);
                            ctx.restore();
                        }
                    });
                    ctx.restore();
                }

                // 2. DIBUJAR LABELS SOBRE LOS PUNTOS DE LA LÍNEA (Dataset 1: Prom. precioPub)
                const metaLine = chart.getDatasetMeta(1);
                if (metaLine && !metaLine.hidden && chart.data.datasets[1]) {
                    ctx.save();
                    ctx.font = 'bold 9.5px sans-serif';
                    ctx.fillStyle = '#D97706'; // Naranja Tableau para resaltar precio
                    ctx.textAlign = 'center';

                    metaLine.data.forEach((pt, index) => {
                        const val = chart.data.datasets[1].data[index];
                        if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
                            const labelText = self.formatMoneda(val);
                            const isNearTop = pt.y < 22;
                            const labelY = isNearTop ? pt.y + 14 : pt.y - 7;
                            ctx.textBaseline = isNearTop ? 'top' : 'bottom';
                            ctx.fillText(labelText, pt.x, labelY);
                        }
                    });
                    ctx.restore();
                }
            }
        };
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const labels = Array.isArray(data && data.labels) ? data.labels : [];
        const tipoGrafico = (data && data.tipo_grafico) || 'ProdGeneral';
        const general = (data && data.general) || { pesos: [], precios: [] };
        const individual = Array.isArray(data && data.individual) ? data.individual : [];
        const kpis = (data && data.kpis) || {};

        if (labels.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center text-slate-400">
                    <i class="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
                    <p class="text-base font-semibold text-slate-700">No se encontraron datos</p>
                    <p class="text-xs text-slate-400 mt-1">Prueba seleccionando otro rango de fechas o más productos.</p>
                </div>
            `;
            return;
        }

        // Ancho por semana: 36px mínimo por barra para lectura cómoda de etiquetas verticales.
        // Se usa max(100%, ...) para que SIEMPRE ocupe el 100% del contenedor sin dejar espacio en blanco vacío a la derecha,
        // y solo active el scroll horizontal cuando haya muchas semanas.
        const pxPorSemana = 36;

        if (tipoGrafico === 'ProdGeneral') {
            this.renderProdGeneral(contenedor, labels, general, pxPorSemana, kpis);
        } else {
            this.renderProdIndividual(contenedor, labels, individual, pxPorSemana, kpis);
        }
    },

    /**
     * RENDERIZADO: ProdGeneral (tableu2.png / tableu3.png)
     * Gráfico único consolidado con todos los productos sumados
     */
    renderProdGeneral(contenedor, labels, general, pxPorSemana, kpis) {
        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-4">
                <!-- CABECERA DEL GRÁFICO -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                                Consolidado
                            </span>
                            <h2 class="text-lg font-bold text-slate-800">Productos Sustitutos</h2>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">Semana de fecha · Suma de peso y precio público promedio</p>
                    </div>

                    <!-- LEYENDA ESTILO TABLEAU -->
                    <div class="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded-xs" style="background-color: ${this.colores.peso};"></span>
                            <span>peso (kg)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-1.5 rounded-full" style="background-color: ${this.colores.precio};"></span>
                            <span>Prom. precioPub (S/)</span>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR CON SCROLL HORIZONTAL (100% de ancho garantizado sin espacios vacíos) -->
                <div class="w-full overflow-x-auto custom-scrollbar pt-8 pb-2" style="scrollbar-width: thin;">
                    <div style="min-width: 100%; width: max(100%, ${labels.length * pxPorSemana}px); height: 480px; position: relative;">
                        <canvas id="canvas-prod-general"></canvas>
                    </div>
                </div>
            </div>
        `;

        const ctx = document.getElementById('canvas-prod-general');
        if (!ctx) return;

        // Calcular valor máximo para dar margen superior a las etiquetas verticales
        const maxPeso = Math.max(...general.pesos, 0);
        const yAxisMax = maxPeso > 0 ? maxPeso * 1.30 : 100;

        const validPrecios = general.precios.filter(p => p !== null && !isNaN(p));
        const maxPrecio = validPrecios.length > 0 ? Math.max(...validPrecios) : 0;
        const yPrecioMax = maxPrecio > 0 ? Math.ceil(maxPrecio * 1.25) : 10;

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'peso',
                        data: general.pesos,
                        backgroundColor: this.colores.peso,
                        hoverBackgroundColor: this.colores.pesoHover,
                        borderRadius: 2,
                        barPercentage: 0.75,
                        categoryPercentage: 0.85,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Prom. precioPub',
                        data: general.precios,
                        borderColor: this.colores.precio,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 2.2,
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: this.colores.precio,
                        pointBorderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'yPrecio',
                        spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.datasetIndex === 0) {
                                    return `peso: ${this.formatTableau(ctx.raw)} kg`;
                                } else {
                                    return `Prom. precioPub: ${this.formatMoneda(ctx.raw)}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 9, weight: '600' },
                            color: '#64748B',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        }
                    },
                    y: {
                        position: 'left',
                        title: { display: true, text: 'peso', color: '#64748B', font: { size: 11, weight: 'bold' } },
                        beginAtZero: true,
                        max: yAxisMax,
                        grid: { color: '#F1F5F9' },
                        ticks: {
                            color: '#64748B',
                            font: { size: 10 },
                            callback: (v) => {
                                if (v >= 1000) return (v / 1000) + 'K';
                                return v;
                            }
                        }
                    },
                    yPrecio: {
                        position: 'right',
                        title: { display: true, text: 'Precio', color: '#64748B', font: { size: 11, weight: 'bold' } },
                        beginAtZero: true,
                        max: yPrecioMax,
                        grid: { display: false },
                        ticks: {
                            color: '#64748B',
                            font: { size: 10 },
                            callback: (v) => v > 0 ? 'S/ ' + v : '0'
                        }
                    }
                }
            },
            plugins: [this.getBarValuesPlugin()]
        });

        this.charts.push(chart);
    },

    /**
     * RENDERIZADO: ProdIndividual (tableu1.png)
     * Paneles apilados por producto con sincronización horizontal
     */
    renderProdIndividual(contenedor, labels, individual, pxPorSemana, kpis) {
        if (individual.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center text-slate-400">
                    <p class="text-base font-semibold text-slate-700">No hay productos seleccionados</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6 flex flex-col gap-4">
                <!-- CABECERA -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                Desglose Individual
                            </span>
                            <h2 class="text-lg font-bold text-slate-800">Productos Sustitutos</h2>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">Semana de fecha · Detalle por cada producto individual</p>
                    </div>

                    <!-- LEYENDA -->
                    <div class="flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-600">
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-3 rounded-xs" style="background-color: ${this.colores.peso};"></span>
                            <span>peso (kg)</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="w-3 h-1.5 rounded-full" style="background-color: ${this.colores.precio};"></span>
                            <span>Prom. precioPub (S/)</span>
                        </div>
                    </div>
                </div>

                <!-- CONTENEDOR DE GRÁFICOS INDIVIDUALES (CADA UNO CON SU PROPIO SCROLL INTERNO) -->
                <div class="flex flex-col gap-6 pt-2 pb-2">
        `;

        individual.forEach((item, idx) => {
            html += `
                <div class="w-full bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 relative flex flex-col gap-3 shadow-xs">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span class="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${this.colores.peso};"></span>
                            ${this.escapeHtml(item.producto)}
                        </span>
                        <span class="text-xs font-semibold text-slate-500">Total: ${this.formatTableau(item.pesos.reduce((a, b) => a + b, 0))} kg</span>
                    </div>

                    <!-- SCROLL INTERNO PROPIO PARA CADA GRÁFICO -->
                    <div class="w-full overflow-x-auto custom-scrollbar pt-4 pb-2" style="scrollbar-width: thin;">
                        <div style="min-width: 100%; width: max(100%, ${labels.length * pxPorSemana}px); height: 260px; position: relative;">
                            <canvas id="canvas-prod-ind-${idx}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        contenedor.innerHTML = html;

        // Renderizar cada sub-gráfico Chart.js
        individual.forEach((item, idx) => {
            const canvas = document.getElementById(`canvas-prod-ind-${idx}`);
            if (!canvas) return;

            const maxPeso = Math.max(...item.pesos, 0);
            const yAxisMax = maxPeso > 0 ? maxPeso * 1.30 : 100;

            const validPrecios = item.precios.filter(p => p !== null && !isNaN(p));
            const maxPrecio = validPrecios.length > 0 ? Math.max(...validPrecios) : 0;
            const yPrecioMax = maxPrecio > 0 ? Math.ceil(maxPrecio * 1.25) : 10;

            const chart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'peso',
                            data: item.pesos,
                            backgroundColor: this.colores.peso,
                            hoverBackgroundColor: this.colores.pesoHover,
                            borderRadius: 2,
                            barPercentage: 0.75,
                            categoryPercentage: 0.85,
                            yAxisID: 'y'
                        },
                        {
                            type: 'line',
                            label: 'Prom. precioPub',
                            data: item.precios,
                            borderColor: this.colores.precio,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#FFFFFF',
                            pointBorderColor: this.colores.precio,
                            pointBorderWidth: 1.5,
                            tension: 0.1,
                            yAxisID: 'yPrecio',
                            spanGaps: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 250 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { size: 12, weight: 'bold' },
                            bodyFont: { size: 11 },
                            padding: 10,
                            cornerRadius: 8,
                            callbacks: {
                                title: (items) => `${item.producto} · ${items[0].label}`,
                                label: (ctx) => {
                                    if (ctx.datasetIndex === 0) {
                                        return `peso: ${this.formatTableau(ctx.raw)} kg`;
                                    } else {
                                        return `Prom. precioPub: ${this.formatMoneda(ctx.raw)}`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true, // Cada gráfico muestra sus semanas en su propio scroll
                            grid: { display: false },
                            ticks: {
                                font: { size: 9, weight: '600' },
                                color: '#64748B',
                                maxRotation: 90,
                                minRotation: 90,
                                autoSkip: false
                            }
                        },
                        y: {
                            position: 'left',
                            title: { display: true, text: 'peso', color: '#64748B', font: { size: 10, weight: 'bold' } },
                            beginAtZero: true,
                            max: yAxisMax,
                            grid: { color: '#F8FAFC' },
                            ticks: {
                                color: '#64748B',
                                font: { size: 9 },
                                callback: (v) => {
                                    if (v >= 1000) return (v / 1000) + 'K';
                                    return v;
                                }
                            }
                        },
                        yPrecio: {
                            position: 'right',
                            title: { display: true, text: 'Precio', color: '#64748B', font: { size: 10, weight: 'bold' } },
                            beginAtZero: true,
                            max: yPrecioMax,
                            grid: { display: false },
                            ticks: {
                                color: '#64748B',
                                font: { size: 9 },
                                callback: (v) => v > 0 ? 'S/ ' + v : '0'
                            }
                        }
                    }
                },
                plugins: [this.getBarValuesPlugin()]
            });

            this.charts.push(chart);
        });
    }
};
