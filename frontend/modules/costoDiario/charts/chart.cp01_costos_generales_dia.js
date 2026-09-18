/**
 * Módulo para CP01 CostosGeneralesPorDia
 * - Izquierda: Dos gráficos de línea apilados verticalmente con división horizontal
 *   * Superior: CU Diario (Sin Factor)
 *   * Inferior: CU Diario + 0.366 (Factor) con etiquetas de fecha en el eje X
 * - Derecha: Tabla de Costo de Producción por Kg de Pollo Vivo sin Factor
 * - Filtro multiselect de Clasificación
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP01 CostosGeneralesPorDia'] = {
    multiClasif: null,
    controller: null,
    datosDashboard: null,
    chartSin: null,
    chartCon: null,
    fechaSeleccionada: null,

    destroy() {
        if (this.chartSin) {
            this.chartSin.destroy();
            this.chartSin = null;
        }
        if (this.chartCon) {
            this.chartCon.destroy();
            this.chartCon = null;
        }
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data;

        // 1. Títulos
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor';

        // 2. Mostrar filtro de clasificación
        const contFiltroClasif = document.getElementById('contenedor-filtro-clasificacion-cp01');
        if (contFiltroClasif) contFiltroClasif.classList.remove('hidden');

        // 3. Inicializar MultiSelect de Clasificación
        if (data.catalogo_clasificaciones) {
            this.initMultiSelect(controller, data.catalogo_clasificaciones);
        }

        // 4. Ocultar tabla inferior tradicional
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 5. Establecer fecha seleccionada
        this.fechaSeleccionada = data.fecha_seleccionada || (data.dias_disponibles && data.dias_disponibles.length > 0 ? data.dias_disponibles[data.dias_disponibles.length - 1] : null);

        // 6. Renderizar Layout Dual (Gráfica Izquierda en 2 paneles + Tabla Derecha)
        this.renderLayoutDual();
    },

    initMultiSelect(controller, catalogo) {
        if (!window.CustomMultiSelect) return;

        const options = catalogo.map(c => ({
            id: c.linea,
            label: c.clasificacion,
            selected: true
        }));

        if (!this.multiClasif) {
            this.multiClasif = new CustomMultiSelect({
                btnId: 'btn-dropdown-clasificacion-cp01',
                labelId: 'label-clasificacion-cp01',
                dropdownId: 'dropdown-clasificacion-cp01',
                searchId: 'search-clasificacion-cp01',
                optionsContainerId: 'container-options-clasificacion-cp01',
                title: 'Clasificación',
                options: options
            });
        } else {
            this.multiClasif.setOptions(options);
        }
    },

    getSelectedFilters() {
        if (this.multiClasif && typeof this.multiClasif.getSelectedValues === 'function') {
            const values = this.multiClasif.getSelectedValues();
            const total = this.multiClasif.options.length;
            if (values.length === total || values.length === 0) {
                return null;
            }
            return values;
        }
        return null;
    },

    renderLayoutDual() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.className = "flex flex-col w-full p-2 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <div class="flex flex-col xl:flex-row items-stretch gap-4 w-full">
                
                <!-- GRÁFICA DE TENDENCIA EN 2 PANELES APILADOS (IZQUIERDA ~56%) -->
                <div class="w-full xl:w-[56%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex flex-col items-center justify-center px-4 py-2 bg-slate-50 border-b border-slate-200">
                        <h2 class="text-xs sm:text-sm font-bold text-slate-800 text-center tracking-tight">Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor</h2>
                        <span class="text-[11px] text-slate-500 font-medium mt-0.5">Día de fechahisto</span>
                    </div>

                    <!-- Panel Superior: CU Diario -->
                    <div class="w-full p-2 relative h-[270px]">
                        <canvas id="canvas-cp01-sin-factor"></canvas>
                    </div>

                    <!-- Línea de División Horizontal Clara -->
                    <div class="w-full border-b-2 border-slate-300"></div>

                    <!-- Panel Inferior: CU Diario + 0.366 (Factor) -->
                    <div class="w-full p-2 relative h-[295px]">
                        <canvas id="canvas-cp01-con-factor"></canvas>
                    </div>
                </div>

                <!-- TABLA DETALLE (DERECHA ~44%) -->
                <div class="w-full xl:w-[44%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <!-- Cabecera de Tarjeta -->
                    <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100/80 border-b border-slate-300">
                        <div>
                            <h2 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Costo Producción por Kg de Pollo Vivo sin Factor</h2>
                            <p id="subtitulo-tabla-cp01" class="text-[10px] text-slate-600 font-medium">
                                Fecha: <strong class="text-blue-700 font-mono">${this.fechaSeleccionada || '-'}</strong>
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="cp01-btn-export-excel" type="button"
                                class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>

                    <!-- Contenedor Scrollable Tabla -->
                    <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[590px] custom-scrollbar">
                        <table id="tabla-cp01-costo-produccion" class="w-full text-[11px] border-collapse font-sans">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-2xs">
                                <tr>
                                    <th class="px-2 py-2 text-left border-r border-blue-500/60 font-mono font-semibold tracking-wide min-w-[45px]">linea</th>
                                    <th class="px-2.5 py-2 text-left border-r border-blue-500/60 font-semibold tracking-wide min-w-[140px]">nomlinea</th>
                                    <th class="px-2.5 py-2 text-right border-r border-blue-500/60 font-semibold tracking-wide min-w-[85px]">valor</th>
                                    <th class="px-2.5 py-2 text-right border-r border-blue-500/60 font-semibold tracking-wide min-w-[85px]">Kilos Prod</th>
                                    <th class="px-2.5 py-2 text-right font-semibold tracking-wide min-w-[55px]">CU</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-lineas-cp01" class="divide-y divide-slate-100 bg-white">
                                <!-- Generado dinámicamente -->
                            </tbody>
                            <tfoot id="tfoot-lineas-cp01" class="sticky bottom-0 z-20 bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400 shadow-2xs">
                                <!-- Generado dinámicamente -->
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Renderizar Gráficas y Tabla
        this.renderCharts();
        this.renderTabla();
        // Configurar exportación a Excel para CP01
        const btnExport = document.getElementById('cp01-btn-export-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    const fechaNom = (this.fechaSeleccionada || 'general').replace(/[^a-zA-Z0-9]/g, '_');
                    ExcelExportHelper.exportarTabla('tabla-cp01-costo-produccion', `CP01_Costo_Produccion_${fechaNom}`);
                }
            };
        }
    },

    renderCharts() {
        const canvasSin = document.getElementById('canvas-cp01-sin-factor');
        const canvasCon = document.getElementById('canvas-cp01-con-factor');
        if (!canvasSin || !canvasCon) return;

        if (this.chartSin) {
            this.chartSin.destroy();
            this.chartSin = null;
        }
        if (this.chartCon) {
            this.chartCon.destroy();
            this.chartCon = null;
        }

        const puntos = this.datosDashboard.puntos_grafica || [];
        if (puntos.length === 0) return;

        const labels = puntos.map(p => p.fecha_corta);
        const dataSinFactor = puntos.map(p => p.cu_sin_factor);
        const dataConFactor = puntos.map(p => p.cu_con_factor);

        // Colores: primer punto verde (#16a34a), resto rojo (#e15759)
        const pointColors = puntos.map((p, i) => i === 0 ? '#16a34a' : '#e15759');

        // 1. GRÁFICA SUPERIOR: CU Diario (Sin Factor)
        const ctxSin = canvasSin.getContext('2d');
        this.chartSin = new Chart(ctxSin, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CU Diario',
                        data: dataSinFactor,
                        borderColor: '#e15759',
                        backgroundColor: '#e15759',
                        pointBackgroundColor: pointColors,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        tension: 0.05
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 22, right: 15, left: 5, bottom: 5 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 8,
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 11 },
                        callbacks: {
                            label(context) {
                                return `CU Diario: ${Number(context.parsed.y).toFixed(3).replace('.', ',')}`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        offset: 4,
                        clip: false,
                        font: { size: 9.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                        color(context) {
                            return context.dataIndex === 0 ? '#16a34a' : '#e15759';
                        },
                        formatter(value) {
                            return Number(value).toFixed(3).replace('.', ',');
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: true, color: '#f8fafc' },
                        ticks: { display: false } // Ocultar textos en panel superior para alinear con el inferior
                    },
                    y: {
                        position: 'left',
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'CU Diario',
                            font: { size: 10, weight: 'bold' },
                            color: '#475569'
                        },
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 9.5, family: 'system-ui, -apple-system, sans-serif' },
                            callback: (v) => Number(v).toFixed(1).replace('.', ',')
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        // 2. GRÁFICA INFERIOR: CU Diario + 0.366 (Factor)
        const ctxCon = canvasCon.getContext('2d');
        this.chartCon = new Chart(ctxCon, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CU Diario + 0.366 (Factor)',
                        data: dataConFactor,
                        borderColor: '#e15759',
                        backgroundColor: '#e15759',
                        pointBackgroundColor: pointColors,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        tension: 0.05
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 22, right: 15, left: 5, bottom: 5 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 8,
                        titleFont: { size: 11, weight: 'bold' },
                        bodyFont: { size: 11 },
                        callbacks: {
                            label(context) {
                                return `CU Diario + 0.366: ${Number(context.parsed.y).toFixed(3).replace('.', ',')}`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        offset: 4,
                        clip: false,
                        font: { size: 9.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                        color(context) {
                            return context.dataIndex === 0 ? '#16a34a' : '#e15759';
                        },
                        formatter(value) {
                            return Number(value).toFixed(3).replace('.', ',');
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: true, color: '#f8fafc' },
                        ticks: {
                            display: true,
                            font: { size: 9.5, family: 'system-ui, -apple-system, sans-serif' },
                            maxRotation: 90,
                            minRotation: 90,
                            color: '#475569'
                        }
                    },
                    y: {
                        position: 'left',
                        grace: '10%',
                        title: {
                            display: true,
                            text: 'CU Diario + 0.366 (Factor)',
                            font: { size: 10, weight: 'bold' },
                            color: '#475569'
                        },
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 9.5, family: 'system-ui, -apple-system, sans-serif' },
                            callback: (v) => Number(v).toFixed(1).replace('.', ',')
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    renderTabla() {
        const tbody = document.getElementById('tbody-lineas-cp01');
        const tfoot = document.getElementById('tfoot-lineas-cp01');
        if (!tbody) return;

        const items = this.datosDashboard.tabla_lineas || [];
        const totales = this.datosDashboard.totales_tabla || null;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 font-medium">No se encontraron líneas para esta fecha</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let html = '';
        items.forEach(r => {
            const valStr = Number(r.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const kgStr = Number(r.kilos_prod).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const cuStr = Number(r.cu).toFixed(3).replace('.', ',');

            html += `
                <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="px-2 py-1 text-left font-mono border-r border-slate-100 text-slate-800">${r.linea}</td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-100 text-slate-700 truncate max-w-[170px]" title="${r.nomlinea}">${r.nomlinea}</td>
                    <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-800">${valStr}</td>
                    <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-500">${kgStr}</td>
                    <td class="px-2.5 py-1 text-right font-mono font-semibold text-slate-800">${cuStr}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Fila de Total General
        if (tfoot && totales) {
            const tValStr = Number(totales.valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const tKgStr = Number(totales.kilos_prod).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const tCuStr = Number(totales.cu).toFixed(3).replace('.', ',');

            tfoot.innerHTML = `
                <tr>
                    <td class="px-2 py-2 text-left border-r border-slate-300"></td>
                    <td class="px-2.5 py-2 text-left border-r border-slate-300 font-bold uppercase text-slate-900">${totales.nomlinea}</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-slate-300 text-slate-900 font-bold">${tValStr}</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-slate-300 text-slate-700">${tKgStr}</td>
                    <td class="px-2.5 py-2 text-right font-mono text-slate-900 font-bold">${tCuStr}</td>
                </tr>
            `;
        }
    }
};
