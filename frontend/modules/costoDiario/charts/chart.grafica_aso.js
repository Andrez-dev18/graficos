/**
 * Módulo para GraficaASO (Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor)
 * - 2 Gráficos de línea sincronizados apilados verticalmente con scroll horizontal independiente:
 *   * Panel Superior: "CU Diario" (Sin Factor)
 *   * Panel Inferior: "CU Diario + 0.366 (Factor)" (Con Factor)
 * - Labels numéricos rotados a 90 grados (-90°) en cada nodo/punto
 * - Eje X con fechas en formato YYYY/MM/DD rotadas a 90°
 * - Tooltip simple: día, fechahisto y CU correspondiente
 * - Semáforo Tableau: Verde (< 4.295 / < 4.661), Naranja (4.295 - 4.315 / 4.661 - 4.681), Rojo (> 4.315 / > 4.681)
 */
window.ChartRegistry = window.ChartRegistry || {};

const GRAFICA_ASO_DEFINITION = {
    controller: null,
    datosDashboard: null,
    chartSinFactor: null,
    chartConFactor: null,

    destroy() {
        if (this.chartSinFactor) {
            this.chartSinFactor.destroy();
            this.chartSinFactor = null;
        }
        if (this.chartConFactor) {
            this.chartConFactor.destroy();
            this.chartConFactor = null;
        }
    },

    formatDecimal(val, decimals = 3) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '-';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};

        // 1. Ocultar cabecera externa redundante
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // Construir layout
        this.renderLayout();
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const puntos = this.datosDashboard.puntos || [];
        const resumen = this.datosDashboard.resumen || {};
        const minWidth = Math.max(1200, puntos.length * 48);

        contenedorGrafica.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedorGrafica.innerHTML = `
            <!-- TARJETA PRINCIPAL GRAFICA ASO -->
            <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                
                <!-- Cabecera con título y resumen -->
                <div class="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 gap-3">
                    <div class="flex items-center gap-2.5">
                        <div>
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                                Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor
                            </h2>
                            <span class="text-xs text-slate-500 font-medium">Día de fechahisto</span>
                        </div>
                    </div>
                    
                    <!-- Resumen / Badges -->
                    <div class="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                        <span class="flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#59a14f] inline-block"></span>
                            <span>Óptimo</span>
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#f28e2b] inline-block"></span>
                            <span>Alerta media</span>
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#e15759] inline-block"></span>
                            <span>Elevado</span>
                        </span>
                        <span class="text-slate-300">|</span>
                        <div class="bg-blue-50 text-blue-800 font-bold px-2.5 py-1 rounded-md border border-blue-200/60">
                            Promedio CU: S/ ${this.formatDecimal(resumen.promedio_cu, 3)}
                        </div>
                        <div class="bg-indigo-50 text-indigo-800 font-bold px-2.5 py-1 rounded-md border border-indigo-200/60">
                            Promedio + Factor: S/ ${this.formatDecimal(resumen.promedio_cu_factor, 3)}
                        </div>
                    </div>
                </div>

                <!-- Contenedor scrollable con los 2 gráficos sincronizados -->
                <div class="w-full p-4 overflow-x-auto custom-scrollbar flex flex-col gap-6">
                    <div style="width: 100%; min-width: ${minWidth}px; display: flex; flex-direction: column; gap: 16px;">
                        
                        <!-- 1. Gráfico Superior: CU Diario (Sin Factor) -->
                        <div class="w-full flex flex-col bg-white rounded-lg p-2">
                            <div class="text-xs font-bold text-slate-600 mb-1 ml-2">CUDiario</div>
                            <div style="width: 100%; height: 260px; position: relative;">
                                <canvas id="aso-canvas-sin-factor"></canvas>
                            </div>
                        </div>

                        <div class="w-full border-t border-slate-200/80 my-1"></div>

                        <!-- 2. Gráfico Inferior: CU Diario + 0.366 (Con Factor) -->
                        <div class="w-full flex flex-col bg-white rounded-lg p-2">
                            <div class="text-xs font-bold text-slate-600 mb-1 ml-2">CU Diario + 0.366 (Factor)</div>
                            <div style="width: 100%; height: 300px; position: relative;">
                                <canvas id="aso-canvas-con-factor"></canvas>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        `;

        // Renderizar ambos gráficos
        this.renderGraficoSinFactor();
        this.renderGraficoConFactor();
    },

    /**
     * 1. Gráfico Superior: CU Diario (Sin Factor)
     */
    renderGraficoSinFactor() {
        const canvas = document.getElementById('aso-canvas-sin-factor');
        if (!canvas) return;

        if (this.chartSinFactor) {
            this.chartSinFactor.destroy();
            this.chartSinFactor = null;
        }

        const puntos = this.datosDashboard.puntos || [];
        const labels = puntos.map(p => p.fecha.replace(/-/g, '/'));
        const valores = puntos.map(p => p.cu_diario);
        const coloresPuntos = puntos.map(p => p.color_cu);

        const ctx = canvas.getContext('2d');
        const self = this;

        // Escala Y dinámica
        let minVal = Math.min(...valores);
        let maxVal = Math.max(...valores);
        if (minVal === Infinity || isNaN(minVal)) { minVal = 4.0; maxVal = 4.5; }
        const yMin = Math.max(0, Math.floor((minVal - 0.1) * 10) / 10);
        const yMax = Math.ceil((maxVal + 0.1) * 10) / 10;

        this.chartSinFactor = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'CU Diario',
                    data: valores,
                    borderColor: '#64748b',
                    borderWidth: 2,
                    pointBackgroundColor: coloresPuntos,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: 0.15,
                    segment: {
                        borderColor: ctx => {
                            const val0 = valores[ctx.p0DataIndex];
                            const val1 = valores[ctx.p1DataIndex];
                            const val = (val0 + val1) / 2;
                            if (val > 4.315) return '#e15759'; // Rojo
                            if (val >= 4.295) return '#f28e2b'; // Naranja
                            return '#59a14f'; // Verde
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 36,
                        bottom: 4,
                        left: 8,
                        right: 8
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 8,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const pt = puntos[items[0].dataIndex];
                                return pt ? `${pt.fecha.replace(/-/g, '/')} (${pt.dia_semana || ''})` : '';
                            },
                            label: (item) => `CU: S/ ${self.formatDecimal(item.raw, 3)}`
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'end',
                        anchor: 'end',
                        offset: 6,
                        color: ctx => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            if (val > 4.315) return '#b91c1c';
                            if (val >= 4.295) return '#c2410c';
                            return '#15803d';
                        },
                        font: {
                            family: 'sans-serif',
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: (value) => self.formatDecimal(value, 3)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            display: false
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 10 },
                            color: '#64748b',
                            callback: (v) => self.formatDecimal(v, 1)
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    /**
     * 2. Gráfico Inferior: CU Diario + 0.366 (Con Factor)
     */
    renderGraficoConFactor() {
        const canvas = document.getElementById('aso-canvas-con-factor');
        if (!canvas) return;

        if (this.chartConFactor) {
            this.chartConFactor.destroy();
            this.chartConFactor = null;
        }

        const puntos = this.datosDashboard.puntos || [];
        const labels = puntos.map(p => p.fecha.replace(/-/g, '/'));
        const valores = puntos.map(p => p.cu_factor);
        const coloresPuntos = puntos.map(p => p.color_factor);

        const ctx = canvas.getContext('2d');
        const self = this;

        // Escala Y dinámica
        let minVal = Math.min(...valores);
        let maxVal = Math.max(...valores);
        if (minVal === Infinity || isNaN(minVal)) { minVal = 4.3; maxVal = 5.0; }
        const yMin = Math.max(0, Math.floor((minVal - 0.1) * 10) / 10);
        const yMax = Math.ceil((maxVal + 0.1) * 10) / 10;

        this.chartConFactor = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'CU Diario + Factor',
                    data: valores,
                    borderColor: '#64748b',
                    borderWidth: 2,
                    pointBackgroundColor: coloresPuntos,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: 0.15,
                    segment: {
                        borderColor: ctx => {
                            const val0 = valores[ctx.p0DataIndex];
                            const val1 = valores[ctx.p1DataIndex];
                            const val = (val0 + val1) / 2;
                            if (val > 4.681) return '#e15759'; // Rojo
                            if (val >= 4.661) return '#f28e2b'; // Naranja
                            return '#59a14f'; // Verde
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 36,
                        bottom: 8,
                        left: 8,
                        right: 8
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 8,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            title: (items) => {
                                const pt = puntos[items[0].dataIndex];
                                return pt ? `${pt.fecha.replace(/-/g, '/')} (${pt.dia_semana || ''})` : '';
                            },
                            label: (item) => `CU (+Factor): S/ ${self.formatDecimal(item.raw, 3)}`
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'end',
                        anchor: 'end',
                        offset: 6,
                        color: ctx => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            if (val > 4.681) return '#b91c1c';
                            if (val >= 4.661) return '#c2410c';
                            return '#15803d';
                        },
                        font: {
                            family: 'sans-serif',
                            size: 11,
                            weight: 'bold'
                        },
                        formatter: (value) => self.formatDecimal(value, 3)
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 9, weight: '600' },
                            color: '#475569',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 10 },
                            color: '#64748b',
                            callback: (v) => self.formatDecimal(v, 1)
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }
};

// Registrar en ChartRegistry para invocación modular
window.ChartRegistry['GraficaASO'] = GRAFICA_ASO_DEFINITION;
window.ChartRegistry['Grafica ASO'] = GRAFICA_ASO_DEFINITION;
window.ChartRegistry['CP06 GraficaASO'] = GRAFICA_ASO_DEFINITION;
window.ChartRegistry['CP06GraficaASO'] = GRAFICA_ASO_DEFINITION;
window.ChartRegistry['CP06'] = GRAFICA_ASO_DEFINITION;
window.ChartRegistry['Tendencia Costo Pollo Vivo'] = GRAFICA_ASO_DEFINITION;
