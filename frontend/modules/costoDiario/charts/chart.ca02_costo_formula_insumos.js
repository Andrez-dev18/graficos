/**
 * Módulo para CA02 CostoFormula-Insumos
 * - Superior: Gráfico de Línea "Costo Formula Alimento General"
 *   * Scroll horizontal independiente
 *   * Eje Y: PU con escala dinámica
 *   * Colores Tableau: Verde (#59a14f) para PU < 1.6115 y Rojo (#e15759) para PU >= 1.6115
 *   * Tooltip sobrio y funcional: Fecha y PU
 * - Inferior Izquierda: Tabla Matriz "Detalle de Insumos"
 *   * Insumos vs Fechas (filtro superior)
 *   * Cabecera y columna de insumos fijas con fondo 100% opaco y sombra separadora
 *   * Formato latino de 3 decimales para PU (ej. 0,270; 4,542)
 * - Inferior Derecha: Gráficos de Línea Apilados "Tendencia de Insumos"
 *   * Filtro de rango de fechas independiente para fechahisto (fecha = fechahisto)
 *   * Small Multiples (multi-gráficos por insumo)
 *   * Eje X: Día de fechahisto, Eje Y: PU (0 a 40)
 */
window.ChartRegistry = window.ChartRegistry || {};

const CA02_DEFINITION = {
    controller: null,
    datosDashboard: null,
    chartGeneral: null,
    tendenciaCharts: [],

    destroy() {
        if (this.chartGeneral) {
            this.chartGeneral.destroy();
            this.chartGeneral = null;
        }
        this.destroyTendenciaCharts();
    },

    destroyTendenciaCharts() {
        if (this.tendenciaCharts && this.tendenciaCharts.length > 0) {
            this.tendenciaCharts.forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
            this.tendenciaCharts = [];
        }
    },

    formatDecimal(val, decimals = 3) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '-';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    getSelectedFilters() {
        const fIniTend = document.getElementById('ca02-tend-fecha-inicio')?.value;
        const fFinTend = document.getElementById('ca02-tend-fecha-fin')?.value;
        return {
            fecha_inicio_tendencia: fIniTend || undefined,
            fecha_fin_tendencia: fFinTend || undefined
        };
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};

        // 1. Ocultar cabecera externa redundante
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // Construir layout completo
        this.renderLayout();
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const puntosGeneral = this.datosDashboard.puntos_general || [];
        const detalleInsumos = this.datosDashboard.detalle_insumos || { fechas: [], items: [] };
        const tendenciaInsumos = this.datosDashboard.tendencia_insumos || { fechas: [], items: [] };

        // Ancho dinámico para el gráfico superior
        const minWidthGeneral = Math.max(1200, puntosGeneral.length * 52);

        // Obtener fechas para los inputs del filtro de tendencia
        let fIniTend = document.getElementById('ca02-tend-fecha-inicio')?.value;
        let fFinTend = document.getElementById('ca02-tend-fecha-fin')?.value;
        if (!fIniTend && puntosGeneral.length > 0) {
            fIniTend = puntosGeneral[0].fecha;
        }
        if (!fFinTend && puntosGeneral.length > 0) {
            fFinTend = puntosGeneral[puntosGeneral.length - 1].fecha;
        }
        if (!fIniTend) fIniTend = '2026-07-31';
        if (!fFinTend) fFinTend = '2026-08-30';

        contenedorGrafica.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedorGrafica.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CA02 -->
            <div class="w-full flex flex-col gap-6">
                
                <!-- 1. TARJETA SUPERIOR: COSTO FORMULA ALIMENTO GENERAL -->
                <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="flex flex-wrap items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200 gap-3">
                        <div class="flex items-center gap-2.5">
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Costo Formula Alimento General</h2>
                        </div>
                        <div class="flex items-center gap-4 text-xs font-medium text-slate-600">
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-full bg-[#59a14f] inline-block"></span>
                                <span>&lt; 1,6115 (Óptimo)</span>
                            </span>
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-full bg-[#e15759] inline-block"></span>
                                <span>&ge; 1,6115 (Alerta)</span>
                            </span>
                            <span class="text-slate-400">|</span>
                            <span class="text-slate-500 font-semibold">${puntosGeneral.length} días registrados</span>
                        </div>
                    </div>

                    <div class="w-full p-4 overflow-x-auto custom-scrollbar" style="min-height: 280px;">
                        <div style="width: 100%; min-width: ${minWidthGeneral}px; height: 250px; position: relative;">
                            <canvas id="ca02-canvas-general"></canvas>
                        </div>
                    </div>
                </div>

                <!-- 2. TARJETA INFERIOR: SPLIT 2 PANELES (DETALLE INSUMOS + TENDENCIA INSUMOS) -->
                <div class="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    <!-- PANEL IZQUIERDO: DETALLE DE INSUMOS (MATRIZ) -->
                    <div class="lg:col-span-6 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div class="flex items-center gap-2">
                                
                                <h3 class="text-sm font-bold text-slate-800">Detalle de Insumos</h3>
                                <span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                                    ${detalleInsumos.items ? detalleInsumos.items.length : 0} insumos
                                </span>
                            </div>
                        </div>

                        <!-- Contenedor Tabla Matriz con Sticky Header y Sticky First Column completamente opaca -->
                        <div class="w-full overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar bg-white">
                            <table id="ca02-tabla-matriz-insumos" class="w-full text-xs border-collapse text-left">
                                <thead class="sticky top-0 z-20 bg-slate-100 text-slate-700 border-b border-slate-300 shadow-xs">
                                    <tr id="ca02-matriz-thead-tr">
                                        <!-- Columnas de fechas generadas dinámicamente -->
                                    </tr>
                                </thead>
                                <tbody id="ca02-matriz-tbody" class="divide-y divide-slate-100 text-slate-800">
                                    <!-- Filas generadas dinámicamente -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- PANEL DERECHO: TENDENCIA DE INSUMOS (SMALL MULTIPLES) -->
                    <div class="lg:col-span-6 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="flex flex-col gap-2.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    
                                    <h3 class="text-sm font-bold text-slate-800">Tendencia de Insumos</h3>
                                    <span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                                        ${tendenciaInsumos.items ? tendenciaInsumos.items.length : 0} insumos
                                    </span>
                                </div>
                            </div>

                            <!-- SUB-FILTRO DE FECHA EXCLUSIVO PARA TENDENCIA DE INSUMOS -->
                            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 text-xs">
                                <span class="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Rango Fechas Tendencia:</span>
                                <div class="flex items-center gap-1.5">
                                    <input type="date" id="ca02-tend-fecha-inicio" value="${fIniTend}"
                                        class="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md px-2 py-1 shadow-xs focus:outline-none focus:border-blue-500">
                                    <span class="text-slate-400 font-bold">-</span>
                                    <input type="date" id="ca02-tend-fecha-fin" value="${fFinTend}"
                                        class="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-md px-2 py-1 shadow-xs focus:outline-none focus:border-blue-500">
                                </div>
                                <button id="ca02-btn-filtrar-tendencia" type="button"
                                    class="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-md shadow-xs transition-all cursor-pointer text-xs">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                                    </svg>
                                    <span>Aplicar</span>
                                </button>
                            </div>
                        </div>

                        <!-- Contenedor scrollable con las tarjetas apiladas de tendencia -->
                        <div id="ca02-contenedor-tendencias-items" class="flex flex-col gap-3 p-3 overflow-y-auto max-h-[520px] custom-scrollbar bg-slate-50/50">
                            <!-- Items de tendencia generados dinámicamente -->
                        </div>
                    </div>

                </div>

            </div>
        `;

        // Renderizar componentes
        this.renderGraficoGeneral();
        this.renderTablaMatriz();
        this.renderTendenciasInsumos();

        // Configurar escuchadores de eventos interactivos
        this.setupEventosLocales();
    },

    setupEventosLocales() {
        // Botón Aplicar rango de fechas para Tendencia
        const btnFiltrarTend = document.getElementById('ca02-btn-filtrar-tendencia');
        if (btnFiltrarTend) {
            btnFiltrarTend.addEventListener('click', async () => {
                await this.recargarSoloTendencias();
            });
        }
    },

    async recargarSoloTendencias() {
        const btn = document.getElementById('ca02-btn-filtrar-tendencia');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg class="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Cargando...</span>`;
        }

        try {
            const fIniTend = document.getElementById('ca02-tend-fecha-inicio')?.value;
            const fFinTend = document.getElementById('ca02-tend-fecha-fin')?.value;

            let rangoPrincipal = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rangoPrincipal = PeriodoHelper.obtenerRangoFechas();
            }

            const payload = {
                fecha_inicio: rangoPrincipal.fechaInicio || rangoPrincipal.inicio || '2026-07-31',
                fecha_fin: rangoPrincipal.fechaFin || rangoPrincipal.fin || '2026-08-30',
                tipo_grafico: 'CA02 CostoFormula-Insumos',
                fecha_inicio_tendencia: fIniTend || undefined,
                fecha_fin_tendencia: fFinTend || undefined
            };

            const res = await this.controller.service.obtenerDashboard(payload);
            const data = (res && (res.payload || res.data)) || res || {};
            if (data && data.tendencia_insumos) {
                this.datosDashboard.tendencia_insumos = data.tendencia_insumos;
                this.renderTendenciasInsumos();
            }
        } catch (err) {
            console.error('Error al recargar tendencias CA02:', err);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    },

    /**
     * 1. Gráfico Superior: Costo Formula Alimento General
     */
    renderGraficoGeneral() {
        const canvas = document.getElementById('ca02-canvas-general');
        if (!canvas) return;

        if (this.chartGeneral) {
            this.chartGeneral.destroy();
            this.chartGeneral = null;
        }

        const puntos = this.datosDashboard.puntos_general || [];
        const labels = puntos.map(p => `${p.label}\n${p.dia_semana || ''}`);
        const valores = puntos.map(p => p.pu);
        const coloresPuntos = puntos.map(p => p.color);

        const ctx = canvas.getContext('2d');
        const self = this;

        // Calcular min y max para escala Y dinámica
        let minVal = Math.min(...valores);
        let maxVal = Math.max(...valores);
        if (minVal === Infinity || isNaN(minVal)) { minVal = 1.4; maxVal = 1.8; }
        const yMin = Math.max(0, Math.floor((minVal - 0.05) * 10) / 10);
        const yMax = Math.ceil((maxVal + 0.05) * 10) / 10;

        this.chartGeneral = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: valores,
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    pointBackgroundColor: coloresPuntos,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 4.5,
                    pointHoverRadius: 7,
                    tension: 0.1,
                    segment: {
                        borderColor: ctx => {
                            const p0 = ctx.p0DataIndex;
                            const p1 = ctx.p1DataIndex;
                            const val0 = valores[p0];
                            const val1 = valores[p1];
                            const val = (val0 + val1) / 2;
                            return val >= 1.6115 ? '#e15759' : '#59a14f';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                                return pt ? `${pt.fecha} (${pt.dia_semana || ''})` : '';
                            },
                            label: (item) => `PU: S/ ${self.formatDecimal(item.raw, 3)}`
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        anchor: 'start',
                        offset: 4,
                        color: ctx => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            return val >= 1.6115 ? '#c0392b' : '#27ae60';
                        },
                        font: {
                            family: 'sans-serif',
                            size: 10,
                            weight: 'bold'
                        },
                        formatter: (value) => self.formatDecimal(value, 3)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10, weight: '600' },
                            color: '#475569',
                            maxRotation: 0,
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
                            callback: (val) => self.formatDecimal(val, 2)
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    /**
     * 2. Tabla Matriz: Detalle de Insumos vs Fechas
     */
    renderTablaMatriz() {
        const theadTr = document.getElementById('ca02-matriz-thead-tr');
        const tbody = document.getElementById('ca02-matriz-tbody');
        if (!theadTr || !tbody) return;

        const detalle = this.datosDashboard.detalle_insumos || { fechas: [], items: [] };
        const fechas = detalle.fechas || [];
        const items = detalle.items || [];

        // Generar Cabeceras
        let theadHtml = `
            <th class="sticky left-0 z-30 px-3 py-2.5 font-bold text-slate-700 border-r border-slate-300 min-w-[200px]" style="background-color: #f1f5f9; opacity: 1; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.12);">
                Insumo
            </th>
        `;

        fechas.forEach(fInfo => {
            theadHtml += `
                <th class="px-2.5 py-2 text-center font-bold text-slate-700 border-r border-slate-200 min-w-[75px] whitespace-nowrap bg-slate-100">
                    <div class="text-[11px]">${fInfo.label}</div>
                    <div class="text-[9px] text-slate-500 font-normal uppercase">${fInfo.dia_semana || ''}</div>
                </th>
            `;
        });

        theadTr.innerHTML = theadHtml;

        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${fechas.length + 1}" class="text-center py-8 text-slate-400 font-medium">
                        No se encontraron insumos para el rango seleccionado.
                    </td>
                </tr>
            `;
            return;
        }

        let tbodyHtml = '';
        items.forEach((item, idx) => {
            const isEven = idx % 2 === 0;
            const bgSolid = isEven ? '#ffffff' : '#f8fafc';
            
            tbodyHtml += `<tr class="hover:bg-blue-50/50 transition-colors group">`;
            
            // Columna Fija Insumo con fondo 100% sólido y sombra para no traslucir
            tbodyHtml += `
                <td class="sticky left-0 z-10 px-3 py-2 font-semibold text-slate-800 border-r border-slate-300 truncate max-w-[220px]"
                    style="background-color: ${bgSolid}; opacity: 1; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.12);"
                    title="${item.item_label}">
                    <span class="text-[10px] font-bold text-slate-400 block">${item.coditem}</span>
                    <span class="truncate block text-slate-700">${item.nomitem}</span>
                </td>
            `;

            // Columnas de Fechas
            fechas.forEach(fInfo => {
                const valObj = item.valores ? item.valores[fInfo.fecha] : null;
                const pu = valObj && valObj.pu !== undefined ? valObj.pu : null;
                const formatted = pu !== null ? this.formatDecimal(pu, 3) : '-';
                const cellColor = pu !== null ? 'text-slate-800 font-semibold' : 'text-slate-300 font-normal';

                tbodyHtml += `
                    <td class="px-2 py-1.5 text-right border-r border-slate-100 ${cellColor} whitespace-nowrap" style="background-color: ${bgSolid};">
                        ${formatted}
                    </td>
                `;
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    },

    /**
     * 3. Gráficos Inferiores: Tendencia de Insumos (Small Multiples)
     */
    renderTendenciasInsumos() {
        const contenedor = document.getElementById('ca02-contenedor-tendencias-items');
        if (!contenedor) return;

        this.destroyTendenciaCharts();

        const tendenciaData = this.datosDashboard.tendencia_insumos || { fechas: [], items: [] };
        const items = tendenciaData.items || [];

        if (items.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center py-8 text-slate-400 font-medium">
                    No hay datos de tendencias disponibles para el rango seleccionado.
                </div>
            `;
            return;
        }

        // Construir tarjetas para cada insumo
        let cardsHtml = '';
        items.forEach((item, index) => {
            cardsHtml += `
                <div class="w-full bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-1">
                    <div class="flex items-center justify-between px-1">
                        <div class="flex items-center gap-2 truncate">
                            <span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                ${item.coditem}
                            </span>
                            <span class="text-xs font-bold text-slate-800 truncate" title="${item.nomitem}">
                                ${item.nomitem}
                            </span>
                        </div>
                        <span class="text-[10px] text-slate-400 font-semibold shrink-0">
                            ${item.puntos ? item.puntos.length : 0} pts
                        </span>
                    </div>
                    <div class="w-full relative" style="height: 135px;">
                        <canvas id="ca02-tend-canvas-${index}"></canvas>
                    </div>
                </div>
            `;
        });

        contenedor.innerHTML = cardsHtml;

        // Renderizar cada mini gráfico de línea
        items.forEach((item, index) => {
            const canvas = document.getElementById(`ca02-tend-canvas-${index}`);
            if (!canvas) return;

            const puntos = item.puntos || [];
            // Formato mes/dia para el eje X (ej. 8/2, 8/3, 8/29)
            const labels = puntos.map(p => {
                const f = p.fechahisto || p.fecha;
                if (f) {
                    const parts = f.split('-');
                    if (parts.length === 3) {
                        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                    }
                }
                return p.dia || p.label || f;
            });
            const dataPU = puntos.map(p => p.pu);

            // Escala Y fija 0 a 40 para consistencia como en Tableau, o dinámica si supera 40
            const maxVal = Math.max(...dataPU, 1);
            const yMax = maxVal > 35 ? Math.ceil(maxVal * 1.25) : 40;

            const ctx = canvas.getContext('2d');
            const self = this;

            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'PU',
                        data: dataPU,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderWidth: 1.8,
                        pointBackgroundColor: '#2563eb',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        pointRadius: 3,
                        pointHoverRadius: 5.5,
                        fill: true,
                        tension: 0.2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 32,
                            bottom: 2,
                            left: 6,
                            right: 6
                        }
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleFont: { size: 10, weight: 'bold' },
                            bodyFont: { size: 10 },
                            padding: 6,
                            displayColors: false,
                            callbacks: {
                                title: (ctxs) => {
                                    const pt = puntos[ctxs[0].dataIndex];
                                    return pt ? `${pt.fecha} (${pt.dia_semana || ''})` : '';
                                },
                                label: (ctx) => `PU: S/ ${self.formatDecimal(ctx.raw, 3)}`
                            }
                        },
                        datalabels: {
                            display: true,
                            rotation: -90,
                            align: 'end',
                            anchor: 'end',
                            offset: 6,
                            color: '#1e3a8a',
                            font: {
                                size: 10,
                                weight: 'bold'
                            },
                            formatter: (value) => self.formatDecimal(value, 3)
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                font: { size: 8.5, weight: '600' },
                                color: '#64748b',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 14
                            }
                        },
                        y: {
                            min: 0,
                            max: yMax,
                            grid: { color: '#f8fafc' },
                            ticks: {
                                font: { size: 9 },
                                color: '#94a3b8',
                                stepSize: yMax >= 40 ? 10 : undefined,
                                callback: (v) => self.formatDecimal(v, 0)
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.tendenciaCharts.push(chart);
        });
    }
};

// Registrar en ChartRegistry para invocación modular
window.ChartRegistry['CA02 CostoFormula-Insumos'] = CA02_DEFINITION;
window.ChartRegistry['CA02CostoFormula-Insumos'] = CA02_DEFINITION;
window.ChartRegistry['CA02 CostoFormulaInsumos'] = CA02_DEFINITION;
window.ChartRegistry['CA02CostoFormulaInsumos'] = CA02_DEFINITION;
window.ChartRegistry['CA02'] = CA02_DEFINITION;
