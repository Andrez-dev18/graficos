/**
 * Componente: CostoFormulaPorTipoAABB (PLANTA ALIMENTO / ALMACEN / AnalisisCostoDiario)
 * Módulo: AnalisisCostoDiario
 * 
 * - Gráfica Superior: Line Chart "Costo Formula Alimento General"
 *   * Eje X: Fechas (día_mes: 19 feb, 20 feb, ...)
 *   * Eje Y: PU (Costo Unitario promedio diario = SUM(valor)/SUM(peso))
 *   * Puntos con etiquetas numéricas exactas (1,538, etc.)
 *   * Interactividad: Clic en punto filtra o enfoca el día en la gráfica inferior.
 * 
 * - Gráfica Inferior: Bar Chart "Detalle de Tipo de Alimento"
 *   * Eje X: Fechas (dddd, yyyy/mm/dd)
 *   * Barras coloreadas por Tipo de Alimento según paleta oficial de Tableau.
 *   * Tooltip y etiquetas con Ítem y PU (5,249, etc.)
 * 
 * - Leyenda interactiva de Tipos de Alimento al pie.
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartCostoFormulaPorTipoAABB = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,
    chartGeneralInstance: null,
    chartDetalleInstance: null,
    fechaSeleccionada: null,

    coloresTipo: {
        '21 PRE INICIO':     '#78b5e3', // Azul claro
        '22 INICIO':         '#305f8f', // Azul oscuro
        '23 ACABADO 1':      '#db4343', // Rojo
        '24 ACABADO 2':      '#e88938', // Naranja
        '25 TERMINADOR':     '#967b2d', // Marrón / Mostaza
        '26 FINALIZADOR':    '#499844', // Verde
        '26 FINALIZADOR 1':  '#3b7a37', // Verde oscuro
        '27 FINALIZADOR 2':  '#2d8e87', // Teal / Verde azulado
        'SIN TIPO':          '#94a3b8'
    },

    formatDecimal(val, dec = 3) {
        if (val === null || val === undefined || isNaN(val)) return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        }).format(val);
    },

    formatEntero(val) {
        if (val === null || val === undefined || isNaN(val)) return '';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val);
    },

    destroyCharts() {
        if (this.chartGeneralInstance) {
            this.chartGeneralInstance.destroy();
            this.chartGeneralInstance = null;
        }
        if (this.chartDetalleInstance) {
            this.chartDetalleInstance.destroy();
            this.chartDetalleInstance = null;
        }
    },

    render(controller, data, targetContainer = null) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof targetContainer === 'string' ? document.getElementById(targetContainer) : targetContainer) 
            || document.getElementById('contenedor-graficos-lista');

        this.destroyCharts();
        this.renderView();
    },

    getDetalleWidth(count) {
        if (!count || count <= 0) return 900;
        const pxPerBar = count > 500 ? 40 : (count > 200 ? 46 : 56);
        return Math.min(29500, Math.max(900, count * pxPerBar));
    },

    renderView() {
        const contenedor = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const generalData = data.alimento_general || [];
        const detalleData = data.alimento_detalle || [];
        const resumen = data.resumen_general || {};

        if (generalData.length === 0 && detalleData.length === 0) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fas fa-chart-line text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para el rango seleccionado</h3>
                    <p class="text-xs text-slate-400 mt-1">Intenta ajustando el rango de fechas en el filtro superior.</p>
                </div>
            `;
            return;
        }

        const minWidthGeneral = Math.max(900, generalData.length * 44);
        const minWidthDetalle = this.getDetalleWidth(detalleData.length);

        contenedor.innerHTML = `
            <div class="flex flex-col gap-6 w-full">
                
                <!-- 1. GRÁFICA SUPERIOR: Costo Formula Alimento General -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <i class="fas fa-chart-line text-sm"></i>
                            </div>
                            <div>
                                <h2 class="text-base font-bold text-slate-900 tracking-tight">Costo Formula Alimento General</h2>
                                <p class="text-xs text-slate-500">
                                    Período: ${data.fecha_inicio || ''} al ${data.fecha_fin || ''} | ${generalData.length} Días evaluados
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                                <span class="text-slate-500">Mín: <strong class="text-emerald-600">${this.formatDecimal(resumen.min_pu, 3)}</strong></span>
                                <span class="text-slate-300">|</span>
                                <span class="text-slate-500">Máx: <strong class="text-rose-600">${this.formatDecimal(resumen.max_pu, 3)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 sm:p-5">
                        <!-- BANNER TITULO TABLEAU -->
                        <div class="text-center font-bold text-sm sm:text-base text-slate-900 mb-2 select-none tracking-tight">
                            <u>Costo Formula Alimento General</u>
                        </div>

                        <!-- Canvas contenedor con scroll horizontal -->
                        <div class="w-full overflow-x-auto custom-scrollbar">
                            <div style="min-width: ${minWidthGeneral}px; height: 260px; position: relative;">
                                <canvas id="canvas-alimento-general"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. GRÁFICA INFERIOR: Detalle de Tipo de Alimento -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <i class="fas fa-chart-bar text-sm"></i>
                            </div>
                            <div>
                                <h2 class="text-base font-bold text-slate-900 tracking-tight">Detalle de Tipo de Alimento</h2>
                                <p class="text-xs text-slate-500">
                                    Costo unitario (PU) agrupado por fórmula y tipo de alimento
                                </p>
                            </div>
                        </div>                       
                    </div>

                    <div class="p-4 sm:p-5">
                        <!-- BANNER TITULO TABLEAU -->
                        <div class="text-center font-bold text-sm sm:text-base text-slate-900 mb-2 select-none tracking-tight">
                            <u>Detalle de Tipo de Alimento</u>
                        </div>

                        <!-- Canvas contenedor con scroll horizontal -->
                        <div class="w-full overflow-x-auto custom-scrollbar">
                            <div style="min-width: ${minWidthDetalle}px; height: 340px; position: relative;">
                                <canvas id="canvas-alimento-detalle"></canvas>
                            </div>
                        </div>

                        <!-- LEYENDA DE TIPOS DE ALIMENTO TABLEAU -->
                        <div class="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-700 select-none">
                            <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">tipo:</span>
                            ${this.renderLeyendaTipos()}
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.initChartGeneral(generalData);
        this.initChartDetalle(detalleData);
        this.setupEventListeners();
    },

    renderLeyendaTipos() {
        return Object.entries(this.coloresTipo)
            .filter(([k]) => k !== 'SIN TIPO')
            .map(([tipo, color]) => `
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-xs inline-block" style="background-color: ${color};"></span>
                    <span class="text-[11px] font-semibold text-slate-700">${tipo}</span>
                </div>
            `).join('');
    },

    initChartGeneral(generalData) {
        const canvas = document.getElementById('canvas-alimento-general');
        if (!canvas || typeof Chart === 'undefined') return;

        const labels = generalData.map(d => d.dia_mes);
        const dataValues = generalData.map(d => d.pu);

        // Calculate min/max for scale
        const minVal = Math.min(...dataValues);
        const maxVal = Math.max(...dataValues);
        const yMin = Math.floor((minVal - 0.005) * 100) / 100;
        const yMax = Math.ceil((maxVal + 0.005) * 100) / 100;

        // Dynamic point colors (diverging from min to max)
        const avgVal = (minVal + maxVal) / 2;
        const pointColors = dataValues.map(v => (v <= avgVal ? '#499844' : '#db4343'));

        this.chartGeneralInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: dataValues,
                    borderColor: '#c2584f',
                    borderWidth: 2.2,
                    backgroundColor: 'rgba(194, 88, 79, 0.05)',
                    fill: false,
                    tension: 0.1,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25, bottom: 5, left: 10, right: 15 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                return generalData[idx] ? generalData[idx].fecha_label : items[0].label;
                            },
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const item = generalData[idx] || {};
                                return [
                                    `PU: ${this.formatDecimal(item.pu, 3)}`,
                                    `Peso: ${this.formatDecimal(item.peso, 2)} kg`,
                                    `Valor: S/ ${this.formatDecimal(item.valor, 2)}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        align: 'top',
                        anchor: 'end',
                        offset: 4,
                        color: '#1e293b',
                        font: { size: 10, weight: 'bold' },
                        formatter: (val) => this.formatDecimal(val, 3)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10, weight: '600' },
                            maxRotation: 90,
                            minRotation: 90
                        }
                    },
                    y: {
                        min: yMin,
                        max: yMax,
                        title: {
                            display: true,
                            text: 'PU',
                            color: '#64748b',
                            font: { size: 11, weight: 'bold' }
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 10 },
                            callback: (v) => this.formatDecimal(v, 2)
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const idx = elements[0].index;
                        const pt = generalData[idx];
                        if (pt && pt.fecha) {
                            this.onFechaGeneralClick(pt.fecha);
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    formatFechaTick(d) {
        if (d.dia_semana && d.ymd) {
            return [d.dia_semana + ',', d.ymd];
        }
        if (d.fecha_label && d.fecha_label.includes(',')) {
            const parts = d.fecha_label.split(',');
            return [parts[0].trim() + ',', (parts[1] || '').trim()];
        }
        if (d.fecha) {
            const dt = new Date(d.fecha + 'T00:00:00');
            if (!isNaN(dt.getTime())) {
                const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                const dia = dias[dt.getDay()];
                const ymd = d.fecha.replace(/-/g, '/');
                return [dia + ',', ymd];
            }
            return [d.fecha];
        }
        return [''];
    },

    initChartDetalle(detalleData) {
        const canvas = document.getElementById('canvas-alimento-detalle');
        if (!canvas || typeof Chart === 'undefined') return;

        const canvasParent = canvas.parentElement;
        if (canvasParent) {
            canvasParent.style.minWidth = this.getDetalleWidth(detalleData.length) + 'px';
        }

        // Generate unique category labels per bar to prevent Chart.js from grouping same-date items
        const labels = detalleData.map((d, i) => `${i}__${d.fecha}`);
        const dataValues = detalleData.map(d => d.pu);
        const bgColors = detalleData.map(d => this.coloresTipo[d.tipo] || '#94a3b8');

        const self = this;
        const itemHeadersPlugin = {
            id: 'itemHeadersPlugin',
            afterDraw(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || meta.data.length === 0) return;

                ctx.save();
                
                let currentItemKey = null;
                let currentItemLabel = '';
                let currentTipo = '';
                let startIndex = 0;

                for (let i = 0; i <= detalleData.length; i++) {
                    const d = detalleData[i];
                    const itemKey = d ? `${d.tipo}__${d.coditem}` : null;

                    if (itemKey !== currentItemKey) {
                        if (currentItemKey !== null) {
                            const endIndex = i - 1;
                            const firstBar = meta.data[startIndex];
                            const lastBar = meta.data[endIndex];

                            if (firstBar && lastBar) {
                                const barW = firstBar.width || 30;
                                const left = firstBar.x - barW / 2;
                                const right = lastBar.x + barW / 2;
                                const centerX = (left + right) / 2;
                                const topY = chart.chartArea.top - 18;

                                // Header formula text
                                ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                                ctx.fillStyle = '#64748b';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                
                                let text = currentItemLabel;
                                const maxTextWidth = (right - left) - 8;
                                if (ctx.measureText(text).width > maxTextWidth && maxTextWidth > 40) {
                                    while (text.length > 5 && ctx.measureText(text + '...').width > maxTextWidth) {
                                        text = text.slice(0, -1);
                                    }
                                    text += '...';
                                }
                                
                                if (maxTextWidth > 35) {
                                    ctx.fillText(text, centerX, topY);
                                }

                                // Separator line
                                if (i < detalleData.length) {
                                    const nextBar = meta.data[i];
                                    const sepX = right + (nextBar ? (nextBar.x - nextBar.width / 2 - right) / 2 : 2);
                                    ctx.beginPath();
                                    ctx.strokeStyle = '#cbd5e1';
                                    ctx.lineWidth = 1;
                                    ctx.setLineDash([3, 3]);
                                    ctx.moveTo(sepX, chart.chartArea.top - 28);
                                    ctx.lineTo(sepX, chart.chartArea.bottom);
                                    ctx.stroke();
                                    ctx.setLineDash([]);
                                }
                            }
                        }
                        currentItemKey = itemKey;
                        currentItemLabel = d ? d.item : '';
                        currentTipo = d ? d.tipo : '';
                        startIndex = i;
                    }
                }

                ctx.restore();
            }
        };

        this.chartDetalleInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderColor: bgColors,
                    borderWidth: 1,
                    borderRadius: 2,
                    barPercentage: 0.8,
                    categoryPercentage: 0.88
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 35, bottom: 5, left: 10, right: 15 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                const d = detalleData[idx];
                                return d ? d.item : '';
                            },
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const d = detalleData[idx] || {};
                                return [
                                    `Tipo: ${d.tipo}`,
                                    `Fecha: ${d.fecha_label || d.fecha}`,
                                    `PU: ${self.formatDecimal(d.pu, 3)}`,
                                    `Peso: ${self.formatDecimal(d.peso, 2)} kg`,
                                    `Valor: S/ ${self.formatDecimal(d.valor, 2)}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'end',
                        offset: 2,
                        color: '#1e293b',
                        font: { size: detalleData.length > 400 ? 8 : 9, weight: 'bold' },
                        formatter: (val) => val ? self.formatDecimal(val, 3) : ''
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            callback: (val, index) => {
                                const d = detalleData[index];
                                return d ? self.formatFechaTick(d) : '';
                            },
                            color: '#64748b',
                            font: { size: detalleData.length > 400 ? 8 : 8.5, weight: '600' },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false
                        }
                    },
                    y: {
                        min: 0,
                        max: 6,
                        title: {
                            display: true,
                            text: 'PU',
                            color: '#64748b',
                            font: { size: 11, weight: 'bold' }
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            stepSize: 2,
                            color: '#64748b',
                            font: { size: 10 },
                            callback: (v) => self.formatDecimal(v, 0)
                        }
                    }
                }
            },
            plugins: [ChartDataLabels, itemHeadersPlugin]
        });
    },

    onFechaGeneralClick(fecha) {
        if (this.fechaSeleccionada === fecha) {
            this.fechaSeleccionada = null; // Toggle off
        } else {
            this.fechaSeleccionada = fecha;
        }

        const detalleData = this.datosBackend.alimento_detalle || [];
        const filtered = this.fechaSeleccionada 
            ? detalleData.filter(d => d.fecha === this.fechaSeleccionada)
            : detalleData;

        if (this.chartDetalleInstance) {
            this.chartDetalleInstance.destroy();
            this.chartDetalleInstance = null;
        }
        this.initChartDetalle(filtered);
    },

    setupEventListeners() {
        // Exportar a Excel
        const btnExport = document.getElementById('btn-exportar-detalle-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                this.exportarExcel();
            };
        }
    },

    exportarExcel() {
        const generalData = this.datosBackend.alimento_general || [];
        const detalleData = this.datosBackend.alimento_detalle || [];

        if (typeof XLSX === 'undefined') {
            alert('Exportando datos a Excel...');
            return;
        }

        const wb = XLSX.utils.book_new();

        // 1. Hoja Alimento General
        const wsGeneralData = [
            ['Fecha', 'Día', 'Peso (kg)', 'Valor (S/)', 'PU']
        ];
        generalData.forEach(d => {
            wsGeneralData.push([d.fecha, d.dia_mes, d.peso, d.valor, d.pu]);
        });
        const wsGen = XLSX.utils.aoa_to_sheet(wsGeneralData);
        XLSX.utils.book_append_sheet(wb, wsGen, 'Alimento General');

        // 2. Hoja Detalle Tipo
        const wsDetalleData = [
            ['Fecha', 'Fecha Detalle', 'Tipo', 'Código Ítem', 'Nombre Ítem', 'Peso (kg)', 'Valor (S/)', 'PU']
        ];
        detalleData.forEach(d => {
            wsDetalleData.push([d.fecha, d.fecha_label, d.tipo, d.coditem, d.nomitem, d.peso, d.valor, d.pu]);
        });
        const wsDet = XLSX.utils.aoa_to_sheet(wsDetalleData);
        XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle Tipo Alimento');

        XLSX.writeFile(wb, `Costo_Formula_Por_Tipo_AABB_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
};

window.ChartRegistry['CostoFormulaPorTipoAABB'] = window.ChartCostoFormulaPorTipoAABB;
window.ChartRegistry['Dash_CostoFormulaPorTipoAABB'] = window.ChartCostoFormulaPorTipoAABB;
