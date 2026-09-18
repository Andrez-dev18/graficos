/**
 * Módulo para CA04 RevisionAlimento
 * - Superior Izquierda: "Costo Formula / Costo mas Factor" (2 gráficos de líneas apilados con división horizontal)
 *   * Panel Superior: PU (Sin Factor) con puntos verdes (inicio) y rojos
 *   * Panel Inferior: PU + CF(0.127) + CM(0.013) con etiquetas de fecha en eje X
 * - Superior Derecha: "Costo de Formula Individual por Alimento" (Gráficas de líneas apiladas por insumo/alimento)
 * - Inferior: "Detalle de Costos de Formula por Tipo de AABB" (Tabla matricial con Subtotales por Tipo, PU y Peso)
 * - Tooltip flotante Tableau interactivo
 * - Persistencia del factor CF en BD por periodo ('YYYY-MM')
 * - Renderizado en alta definición (devicePixelRatio)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CA04 RevisionAlimento'] = {
    controller: null,
    datosDashboard: null,
    periodoActual: '2026-08',
    chartGeneralSin: null,
    chartGeneralCon: null,
    miniChartsIndividuales: [],
    filtroCruzadoActivo: null,
    factorCF: 0.127,
    FACTOR_CM: 0.013,

    destroy() {
        this.destruirCharts();
        this.hideTooltip();
    },

    toggleModalCF(e) {
        if (e) e.stopPropagation();
        const popover = document.getElementById('popover-config-cf-ca04');
        if (!popover) return;
        const isHidden = popover.classList.contains('hidden');
        if (isHidden) {
            popover.classList.remove('hidden');
            const input = document.getElementById('input-factor-cf-ca04');
            if (input) {
                input.value = this.factorCF.toFixed(3);
                input.focus();
                input.select();
            }
            this.updatePreviewCF();
        } else {
            popover.classList.add('hidden');
        }
    },

    updatePreviewCF() {
        const input = document.getElementById('input-factor-cf-ca04');
        const previewTotal = document.getElementById('preview-factor-total-ca04');
        const previewVal = document.getElementById('preview-val-cf-ca04');
        if (!input) return;
        const val = parseFloat(input.value) || 0;
        const total = val + this.FACTOR_CM;
        if (previewTotal) previewTotal.textContent = `+${total.toFixed(3)}`;
        if (previewVal) previewVal.textContent = val.toFixed(3);
    },

    async aplicarFactorCF() {
        const input = document.getElementById('input-factor-cf-ca04');
        if (!input) return;
        const nuevoCF = parseFloat(input.value);
        if (isNaN(nuevoCF) || nuevoCF < 0) {
            alert('Por favor ingresa un valor válido para el factor CF.');
            return;
        }

        this.factorCF = nuevoCF;

        // 1. Persistir en Backend (Base de datos tabla conf_factor_alimento)
        if (this.controller && this.controller.service && typeof this.controller.service.guardarFactorAlimento === 'function') {
            try {
                await this.controller.service.guardarFactorAlimento({
                    periodo: this.periodoActual || '2026-08',
                    factor_cf: this.factorCF
                });
            } catch (err) {
                console.warn('Error al guardar factor CF en backend:', err);
            }
        }

        // 2. Actualizar Badge y Label del eje
        const badge = document.getElementById('badge-val-cf-ca04');
        if (badge) badge.textContent = this.factorCF.toFixed(3);

        const labelEje = document.getElementById('label-eje-con-factor-ca04');
        if (labelEje) labelEje.textContent = `PU + CF (${this.factorCF.toFixed(3)}) + CM(0.013)`;

        // 3. Cerrar Popover
        const popover = document.getElementById('popover-config-cf-ca04');
        if (popover) popover.classList.add('hidden');

        // 4. Recalcular y actualizar la gráfica inferior reactivamente
        this.recalcularGraficaConFactor();
    },

    async resetFactorCF() {
        const input = document.getElementById('input-factor-cf-ca04');
        if (input) input.value = '0.127';
        this.updatePreviewCF();
        await this.aplicarFactorCF();
    },

    recalcularGraficaConFactor() {
        if (!this.chartGeneralCon) return;

        const dataSrc = this.getData();
        const dataSin = dataSrc.generalSinFactor || [];
        const totalFactor = this.factorCF + this.FACTOR_CM;
        const dataCon = dataSin.map(v => Number((v + totalFactor).toFixed(3)));

        const minVal = dataCon.length ? Math.min(...dataCon) : 1.7;
        const maxVal = dataCon.length ? Math.max(...dataCon) : 1.8;

        const sumCon = dataCon.reduce((acc, v) => acc + v, 0);
        const avgCon = dataCon.length > 0 ? (sumCon / dataCon.length) : 0;
        const pointColorsCon = dataCon.map(v => v >= avgCon ? '#e15759' : '#59a14f');

        this.chartGeneralCon.data.datasets[0].data = dataCon;
        this.chartGeneralCon.data.datasets[0].pointBackgroundColor = pointColorsCon;
        this.chartGeneralCon.data.datasets[0].segment = {
            borderColor: ctx => {
                const p0Val = dataCon[ctx.p0DataIndex];
                const p1Val = dataCon[ctx.p1DataIndex];
                return (p0Val >= avgCon || p1Val >= avgCon) ? '#e15759' : '#59a14f';
            }
        };
        this.chartGeneralCon.options.scales.y.min = Math.floor((minVal - 0.01) * 100) / 100;
        this.chartGeneralCon.options.scales.y.max = Math.ceil((maxVal + 0.01) * 100) / 100;
        this.chartGeneralCon.update('active');
    },

    destruirCharts() {
        if (this.chartGeneralSin) {
            try { this.chartGeneralSin.destroy(); } catch (e) {}
            this.chartGeneralSin = null;
        }
        if (this.chartGeneralCon) {
            try { this.chartGeneralCon.destroy(); } catch (e) {}
            this.chartGeneralCon = null;
        }
        if (this.miniChartsIndividuales && this.miniChartsIndividuales.length > 0) {
            this.miniChartsIndividuales.forEach(c => {
                try { c.destroy(); } catch (e) {}
            });
            this.miniChartsIndividuales = [];
        }
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';
        if (data.tipo) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Tipo AABB:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.tipo}</span>
            `;
        }
        if (data.item) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Alimento:</span>
                <span class="text-slate-900 font-semibold text-left">${data.item}</span>
            `;
        }
        if (data.dia) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Día de fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.dia}</span>
            `;
        }
        if (data.pu !== undefined && data.pu !== null && data.pu !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">PU:</span>
                <span class="font-bold text-left font-mono text-xs text-blue-900">${data.pu}</span>
            `;
        }
        if (data.puFactor !== undefined && data.puFactor !== null && data.puFactor !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">PU + Factor:</span>
                <span class="font-bold text-left font-mono text-xs text-rose-700">${data.puFactor}</span>
            `;
        }
        if (data.peso !== undefined && data.peso !== null && data.peso !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Peso:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-800">${data.peso} kg</span>
            `;
        }

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                ${itemsHtml}
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const tooltipWidth = tooltipEl.offsetWidth || 260;
        const tooltipHeight = tooltipEl.offsetHeight || 140;

        let left = e.clientX + 15;
        let top = e.clientY - 20;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = e.clientX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight - 12) {
            top = window.innerHeight - tooltipHeight - 12;
        }

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
        }
    },

    onCellHover(e, el) {
        const tipo = el.getAttribute('data-tipo');
        const item = el.getAttribute('data-item');
        const dia = el.getAttribute('data-dia');
        const pu = el.getAttribute('data-pu');
        const peso = el.getAttribute('data-peso');

        this.showTooltip(e, { tipo, item, dia, pu, peso });
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};
        this.filtroCruzadoActivo = null;

        // Cargar factor CF y periodo recibidos del backend
        if (data && data.factor_cf !== undefined && data.factor_cf !== null) {
            this.factorCF = parseFloat(data.factor_cf);
        }
        if (data && data.periodo) {
            this.periodoActual = data.periodo;
        }

        // 1. Título principal
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'CA04 Revisión de Alimento';

        // 2. Ocultar tarjeta de tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Renderizar Layout completo
        this.renderLayout();
    },

    getData() {
        if (
            this.datosDashboard &&
            this.datosDashboard.fechasLabels &&
            this.datosDashboard.fechasLabels.length > 0
        ) {
            return this.datosDashboard;
        }

        // Fallback por defecto si no hubiese datos aún
        return {
            fechasLabels: [],
            generalSinFactor: [],
            generalConFactor: [],
            seriesIndividuales: [],
            columnasFechas: [],
            gruposAABB: []
        };
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const dataSrc = this.getData();

        contenedorGrafica.className = "flex flex-col w-full p-2 gap-4 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <!-- 1. SECCIÓN SUPERIOR: 2 PANELES (IZQUIERDA: COSTO FORMULA / COSTO MAS FACTOR | DERECHA: COSTO INDIVIDUAL) -->
            <div class="flex flex-col xl:flex-row items-stretch gap-4 w-full">
                
                <!-- 1.1 PANEL SUPERIOR IZQUIERDO: COSTO FORMULA / COSTO MAS FACTOR (~48%) -->
                <div class="w-full xl:w-[48%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-2 bg-slate-100/90 border-b border-slate-300">
                        <h2 class="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Costo Formula / Costo mas Factor</h2>

                        <!-- BOTÓN MODAL / POPOVER CONFIGURACIÓN FACTOR CF -->
                        <div class="relative">
                            <button id="btn-ajustar-cf-ca04" type="button"
                                class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all cursor-pointer shadow-2xs"
                                onclick="window.ChartRegistry['CA04 RevisionAlimento'].toggleModalCF(event)">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                                <span>CF: <strong id="badge-val-cf-ca04">${this.factorCF.toFixed(3)}</strong></span>
                            </button>

                            <!-- POPOVER COMPACTO DE CONFIGURACIÓN -->
                            <div id="popover-config-cf-ca04"
                                class="hidden absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3 flex flex-col gap-2.5 font-sans"
                                onclick="event.stopPropagation()">
                                <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span class="text-xs font-bold text-slate-800">Ajustar Factor CF</span>
                                    <span class="text-[10px] text-slate-400 font-mono">CM = 0.013</span>
                                </div>

                                <div class="flex flex-col gap-1">
                                    <label for="input-factor-cf-ca04" class="text-[10px] font-bold text-slate-600 uppercase">Valor CF (${this.periodoActual}):</label>
                                    <input id="input-factor-cf-ca04" type="number" step="0.001" min="0" max="10" value="${this.factorCF.toFixed(3)}"
                                        class="w-full text-xs font-mono font-bold text-blue-900 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        oninput="window.ChartRegistry['CA04 RevisionAlimento'].updatePreviewCF()">
                                </div>

                                <div class="bg-blue-50/70 p-2 rounded-lg text-[10.5px] text-blue-900 font-medium">
                                    Factor Total: <strong id="preview-factor-total-ca04" class="font-mono font-bold text-blue-700">+${(this.factorCF + this.FACTOR_CM).toFixed(3)}</strong>
                                    <span class="block text-[9.5px] text-slate-500 mt-0.5">PU + CF (<span id="preview-val-cf-ca04">${this.factorCF.toFixed(3)}</span>) + CM (0.013)</span>
                                </div>

                                <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                                    <button type="button"
                                        class="px-2.5 py-1 text-[10.5px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                        onclick="window.ChartRegistry['CA04 RevisionAlimento'].resetFactorCF()">
                                        Restablecer
                                    </button>
                                    <button type="button"
                                        class="px-3 py-1 text-[10.5px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs cursor-pointer"
                                        onclick="window.ChartRegistry['CA04 RevisionAlimento'].aplicarFactorCF()">
                                        Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col p-2 gap-2 flex-1 justify-center">
                        <!-- Sub-panel Superior: PU -->
                        <div class="w-full flex items-center">
                            <div class="w-[50px] shrink-0 text-center font-bold text-[10px] text-slate-700">
                                PU
                            </div>
                            <div class="flex-1 relative h-[145px]">
                                <canvas id="canvas-ca04-general-sin"></canvas>
                            </div>
                        </div>

                        <!-- Línea Divisoria Clara -->
                        <div class="w-full border-b border-slate-200 my-0.5"></div>

                        <!-- Sub-panel Inferior: PU + CF(xxx) + CM(0.013) -->
                        <div class="w-full flex items-center">
                            <div id="label-eje-con-factor-ca04" class="w-[50px] shrink-0 text-center font-bold text-[9px] text-slate-700 leading-tight px-0.5">
                                PU + CF (${this.factorCF.toFixed(3)}) + CM(0.013)
                            </div>
                            <div class="flex-1 relative h-[170px]">
                                <canvas id="canvas-ca04-general-con"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 1.2 PANEL SUPERIOR DERECHO: COSTO DE FORMULA INDIVIDUAL POR ALIMENTO (~52%) -->
                <div class="w-full xl:w-[52%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex flex-col px-4 py-2 bg-slate-100/90 border-b border-slate-300">
                        <h2 class="text-xs sm:text-sm font-bold text-slate-900 tracking-tight text-center">Costo de Formula Individual por Alimento</h2>
                    </div>

                    <!-- Contenedor Scrollable de Series por Alimento -->
                    <div id="contenedor-ca04-individuales" class="flex-1 p-3 flex flex-col gap-2 overflow-y-auto max-h-[350px] custom-scrollbar">
                        ${this.renderRowsIndividuales(dataSrc.seriesIndividuales)}
                    </div>
                </div>

            </div>

            <!-- 2. SECCIÓN INFERIOR: DETALLE DE COSTOS DE FORMULA POR TIPO DE AABB (TABLA MATRIZ CON SUB-TOTALES) -->
            <div class="w-full bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 border-b border-slate-300">
                    <div class="flex items-center gap-2">
                        <h2 class="text-sm font-bold text-slate-900 tracking-tight">Detalle de Costos de Formula por Tipo de AABB</h2>
                        <span class="text-[11px] text-slate-500 font-medium">Día de fecha (Orden descendente)</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="ca04-btn-export-aabb" type="button"
                            class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto overflow-y-auto max-h-[460px] custom-scrollbar">
                    <table id="tabla-aabb-ca04" class="w-full text-[11px] border-collapse font-sans min-w-[850px] select-none">
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 shadow-2xs">
                            <tr>
                                <th class="px-2.5 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[100px] sticky left-0 z-30">tipo</th>
                                <th class="px-3 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[240px] sticky left-[100px] z-30">Item</th>
                                <th class="px-2 py-2 text-center bg-blue-600 font-bold border-r border-blue-500/60 min-w-[55px]">Métrica</th>
                                <th class="px-3 py-2 text-right bg-blue-600 font-bold border-r-2 border-blue-700 min-w-[110px]">Total general</th>
                                ${(dataSrc.columnasFechas || []).map(c => `
                                    <th class="px-2.5 py-2 text-right font-semibold text-white border-r border-blue-500/60 bg-blue-600 min-w-[105px] whitespace-pre-line leading-tight">
                                        ${c.label}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${this.renderBodyTablaAABB(dataSrc.gruposAABB || [], dataSrc.columnasFechas || [])}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Cerrar popover al hacer clic fuera
        document.addEventListener('click', () => {
            const popover = document.getElementById('popover-config-cf-ca04');
            if (popover && !popover.classList.contains('hidden')) {
                popover.classList.add('hidden');
            }
        });

        // Configurar exportación a Excel para la tabla CA04
        const btnExportAabb = document.getElementById('ca04-btn-export-aabb');
        if (btnExportAabb) {
            btnExportAabb.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-aabb-ca04', 'CA04_Detalle_Costos_Formula_AABB');
                }
            };
        }

        // Renderizar todos los gráficos Chart.js
        this.renderChartsGenerales(dataSrc);
        this.renderChartsIndividuales(dataSrc);
    },

    renderRowsIndividuales(series) {
        if (!series || series.length === 0) {
            return `<div class="p-4 text-center text-xs text-slate-400">No hay alimentos disponibles para el período seleccionado.</div>`;
        }

        let html = '';
        series.forEach((s, idx) => {
            const isLast = idx === series.length - 1;
            html += `
                <div class="flex items-center w-full border-b border-slate-200 pb-1.5 pt-0.5 hover:bg-slate-50/50 transition-colors">
                    <!-- Label Izquierda -->
                    <div class="w-[180px] sm:w-[210px] shrink-0 text-left pr-2 flex flex-col justify-center border-r border-slate-200">
                        <span class="text-[10.5px] font-bold text-slate-800 leading-tight truncate" title="${s.item_label}">${s.item_label}</span>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">${s.coditem}</span>
                            <span class="text-[9px] text-slate-400 font-semibold uppercase">PU</span>
                        </div>
                    </div>

                    <!-- Canvas Mini Line Chart -->
                    <div class="flex-1 relative ${isLast ? 'h-[85px]' : 'h-[72px]'} px-2">
                        <canvas id="canvas-ca04-indiv-${idx}"></canvas>
                    </div>
                </div>
            `;
        });
        return html;
    },

    renderChartsGenerales(dataSrc) {
        const canvasSin = document.getElementById('canvas-ca04-general-sin');
        const canvasCon = document.getElementById('canvas-ca04-general-con');
        if (!canvasSin || !canvasCon) return;

        const labels = dataSrc.fechasLabels || [];
        const dataSin = dataSrc.generalSinFactor || [];
        const dataCon = dataSrc.generalConFactor || [];

        if (dataSin.length === 0) return;

        // Calcular promedio de PU (Sin Factor) para definir semáforo Tableau (>= Promedio: Rojo, < Promedio: Verde)
        const sumSin = dataSin.reduce((acc, v) => acc + v, 0);
        const avgSin = dataSin.length > 0 ? (sumSin / dataSin.length) : 0;
        const pointColorsSin = dataSin.map(v => v >= avgSin ? '#e15759' : '#59a14f');

        const self = this;

        const minSin = Math.min(...dataSin);
        const maxSin = Math.max(...dataSin);

        // 1. Gráfica Superior: PU Sin Factor
        this.chartGeneralSin = new Chart(canvasSin.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU',
                    data: dataSin,
                    borderColor: '#e15759',
                    segment: {
                        borderColor: ctx => {
                            const p0Val = dataSin[ctx.p0DataIndex];
                            const p1Val = dataSin[ctx.p1DataIndex];
                            return (p0Val >= avgSin || p1Val >= avgSin) ? '#e15759' : '#59a14f';
                        }
                    },
                    backgroundColor: '#e15759',
                    pointBackgroundColor: pointColorsSin,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.2,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    tension: 0.05
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: { padding: { top: 18, bottom: 2, left: 5, right: 12 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                self.hideTooltip();
                                return;
                            }
                            const dataPoint = tooltipModel.dataPoints && tooltipModel.dataPoints[0];
                            if (dataPoint) {
                                const idx = dataPoint.dataIndex;
                                const fecha = labels[idx];
                                const val = Number(dataPoint.raw).toFixed(3).replace('.', ',');
                                const pos = context.chart.canvas.getBoundingClientRect();
                                self.showTooltip({ clientX: pos.left + tooltipModel.caretX, clientY: pos.top + tooltipModel.caretY }, {
                                    item: 'Costo Formula General',
                                    dia: fecha,
                                    pu: val
                                });
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        offset: 3,
                        font: { size: 8.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                        color: (ctx) => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            return val >= avgSin ? '#c62828' : '#2e7d32';
                        },
                        formatter: (v) => {
                            if (v !== null && v !== undefined && !isNaN(v)) {
                                return Number(v).toFixed(3).replace('.', ',');
                            }
                            return '';
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: true, color: '#f8fafc' },
                        ticks: { display: false }
                    },
                    y: {
                        min: Math.floor((minSin - 0.01) * 100) / 100,
                        max: Math.ceil((maxSin + 0.01) * 100) / 100,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                            callback: v => Number(v).toFixed(2).replace('.', ',')
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        // 2. Gráfica Inferior: PU + Factor (Con etiquetas en eje X)
        const sumCon = dataCon.reduce((acc, v) => acc + v, 0);
        const avgCon = dataCon.length > 0 ? (sumCon / dataCon.length) : 0;
        const pointColorsCon = dataCon.map(v => v >= avgCon ? '#e15759' : '#59a14f');

        const minCon = Math.min(...dataCon);
        const maxCon = Math.max(...dataCon);

        this.chartGeneralCon = new Chart(canvasCon.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PU + Factor',
                    data: dataCon,
                    borderColor: '#e15759',
                    segment: {
                        borderColor: ctx => {
                            const p0Val = dataCon[ctx.p0DataIndex];
                            const p1Val = dataCon[ctx.p1DataIndex];
                            return (p0Val >= avgCon || p1Val >= avgCon) ? '#e15759' : '#59a14f';
                        }
                    },
                    backgroundColor: '#e15759',
                    pointBackgroundColor: pointColorsCon,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.2,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    tension: 0.05
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: { padding: { top: 18, bottom: 2, left: 5, right: 12 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                self.hideTooltip();
                                return;
                            }
                            const dataPoint = tooltipModel.dataPoints && tooltipModel.dataPoints[0];
                            if (dataPoint) {
                                const idx = dataPoint.dataIndex;
                                const fecha = labels[idx];
                                const valFactor = Number(dataPoint.raw).toFixed(3).replace('.', ',');
                                const pos = context.chart.canvas.getBoundingClientRect();
                                const totalFactorStr = (self.factorCF + self.FACTOR_CM).toFixed(3);
                                self.showTooltip({ clientX: pos.left + tooltipModel.caretX, clientY: pos.top + tooltipModel.caretY }, {
                                    item: `Costo mas Factor (+${totalFactorStr})`,
                                    dia: fecha,
                                    puFactor: valFactor
                                });
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        align: 'top',
                        offset: 3,
                        font: { size: 8.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                        color: (ctx) => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            return val >= avgCon ? '#c62828' : '#2e7d32';
                        },
                        formatter: (v) => {
                            if (v !== null && v !== undefined && !isNaN(v)) {
                                return Number(v).toFixed(3).replace('.', ',');
                            }
                            return '';
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: true, color: '#f8fafc' },
                        ticks: {
                            display: true,
                            maxRotation: 90,
                            minRotation: 90,
                            font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                            color: '#475569'
                        }
                    },
                    y: {
                        min: Math.floor((minCon - 0.01) * 100) / 100,
                        max: Math.ceil((maxCon + 0.01) * 100) / 100,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                            callback: v => Number(v).toFixed(2).replace('.', ',')
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    renderChartsIndividuales(dataSrc) {
        const series = dataSrc.seriesIndividuales || [];
        const labelsX = dataSrc.fechasLabels || [];
        const self = this;

        series.forEach((s, idx) => {
            const canvas = document.getElementById(`canvas-ca04-indiv-${idx}`);
            if (!canvas) return;

            const isLast = idx === series.length - 1;

            // Mapear los puntos al array de fechas completo
            const mapaPuntos = {};
            (s.puntos || []).forEach(p => { 
                mapaPuntos[p.dia] = p.val; 
            });

            const dataPuntos = labelsX.map(fec => mapaPuntos[fec] !== undefined ? mapaPuntos[fec] : null);

            const validVals = dataPuntos.filter(v => v !== null && v !== undefined);
            const minIndiv = validVals.length ? Math.min(...validVals) : 1.4;
            const maxIndiv = validVals.length ? Math.max(...validVals) : 2.0;

            const ch = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labelsX,
                    datasets: [{
                        label: s.item_label,
                        data: dataPuntos,
                        borderColor: s.color || '#2b8a8f',
                        backgroundColor: s.color || '#2b8a8f',
                        pointBackgroundColor: s.color || '#2b8a8f',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.2,
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        tension: 0.05,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    layout: { padding: { top: 16, bottom: isLast ? 2 : 2, left: 5, right: 12 } },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => {
                                const tooltipModel = context.tooltip;
                                if (tooltipModel.opacity === 0) {
                                    self.hideTooltip();
                                    return;
                                }
                                const dataPoint = tooltipModel.dataPoints && tooltipModel.dataPoints[0];
                                if (dataPoint && dataPoint.raw !== null) {
                                    const pIdx = dataPoint.dataIndex;
                                    const fecha = labelsX[pIdx];
                                    const val = Number(dataPoint.raw).toFixed(3).replace('.', ',');
                                    const pos = context.chart.canvas.getBoundingClientRect();
                                    self.showTooltip({ clientX: pos.left + tooltipModel.caretX, clientY: pos.top + tooltipModel.caretY }, {
                                        item: s.item_label,
                                        dia: fecha,
                                        pu: val
                                    });
                                }
                            }
                        },
                        datalabels: {
                            display: true,
                            align: 'top',
                            offset: 3,
                            font: { size: 8.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                            color: '#1e293b',
                            formatter: (v) => {
                                if (v !== null && v !== undefined) {
                                    return Number(v).toFixed(3).replace('.', ',');
                                }
                                return '';
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: true, color: '#f8fafc' },
                            ticks: {
                                display: isLast,
                                maxRotation: 90,
                                minRotation: 90,
                                font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                                color: '#475569'
                            }
                        },
                        y: {
                            min: Math.floor((minIndiv - 0.05) * 10) / 10,
                            max: Math.ceil((maxIndiv + 0.05) * 10) / 10,
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                                callback: v => Number(v).toFixed(1).replace('.', ',')
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.miniChartsIndividuales.push(ch);
        });
    },

    renderBodyTablaAABB(grupos, columnasFechas) {
        if (!grupos || grupos.length === 0) {
            return `<tr><td colspan="${4 + (columnasFechas ? columnasFechas.length : 0)}" class="p-4 text-center text-xs text-slate-400">No hay datos para la tabla en este período.</td></tr>`;
        }

        let html = '';

        grupos.forEach(g => {
            const totalFilasGrupo = (g.items.length * 2) + 2; // 2 filas por item + 2 filas de subtotal

            g.items.forEach((it, idx) => {
                const isFirstItem = idx === 0;

                // Fila 1 del Item: PU
                html += `
                    <tr class="hover:bg-slate-50/70 transition-colors group">
                        ${isFirstItem ? `
                            <td rowspan="${totalFilasGrupo}" class="px-2.5 py-1.5 text-left font-bold text-slate-800 border-r border-slate-300 sticky left-0 z-10 bg-white group-hover:bg-slate-50 align-top uppercase">
                                ${g.tipo}
                            </td>
                        ` : ''}
                        <td rowspan="2" class="px-3 py-1.5 text-left font-semibold text-slate-800 border-r border-slate-300 sticky left-[100px] z-10 bg-white group-hover:bg-slate-50 truncate max-w-[260px] align-middle" title="${it.item}">
                            ${it.item}
                        </td>
                        <td class="px-2 py-1 text-center font-bold text-[10px] text-slate-500 bg-slate-50/70 border-r border-slate-200">
                            PU
                        </td>
                        <td class="px-3 py-1 text-right font-mono font-bold text-blue-900 border-r-2 border-slate-400 bg-slate-50/50">
                            ${it.total_pu}
                        </td>
                        ${columnasFechas.map(col => {
                            const valObj = it.valores[col.id];
                            const puVal = valObj ? valObj.pu : '';
                            const pesoVal = valObj ? valObj.peso : '';
                            return `
                                <td class="px-2.5 py-1 text-right font-mono text-slate-800 border-r border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors"
                                    data-tipo="${g.tipo}"
                                    data-item="${it.item}"
                                    data-dia="${col.id}"
                                    data-pu="${puVal}"
                                    data-peso="${pesoVal}"
                                    onmousemove="window.ChartRegistry['CA04 RevisionAlimento'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA04 RevisionAlimento'].hideTooltip()">
                                    ${puVal}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;

                // Fila 2 del Item: Peso
                html += `
                    <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-200 group">
                        <td class="px-2 py-1 text-center font-medium text-[10px] text-slate-400 bg-slate-50/70 border-r border-slate-200">
                            peso
                        </td>
                        <td class="px-3 py-1 text-right font-mono font-semibold text-slate-700 border-r-2 border-slate-400 bg-slate-50/50">
                            ${it.total_peso}
                        </td>
                        ${columnasFechas.map(col => {
                            const valObj = it.valores[col.id];
                            const puVal = valObj ? valObj.pu : '';
                            const pesoVal = valObj ? valObj.peso : '';
                            return `
                                <td class="px-2.5 py-1 text-right font-mono text-slate-600 border-r border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors"
                                    data-tipo="${g.tipo}"
                                    data-item="${it.item}"
                                    data-dia="${col.id}"
                                    data-pu="${puVal}"
                                    data-peso="${pesoVal}"
                                    onmousemove="window.ChartRegistry['CA04 RevisionAlimento'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA04 RevisionAlimento'].hideTooltip()">
                                    ${pesoVal}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;
            });

            // FILAS DE SUBTOTAL POR TIPO DE AABB
            if (g.subtotal) {
                // Subtotal Fila 1: PU
                html += `
                    <tr class="bg-slate-100/90 font-bold border-t border-slate-300">
                        <td rowspan="2" class="px-3 py-1.5 text-left font-bold text-slate-900 border-r border-slate-300 sticky left-[100px] z-10 bg-slate-100 align-middle uppercase tracking-wide">
                            ${g.subtotal.label}
                        </td>
                        <td class="px-2 py-1 text-center font-bold text-[10px] text-slate-700 bg-slate-200/80 border-r border-slate-300">
                            PU
                        </td>
                        <td class="px-3 py-1 text-right font-mono font-bold text-blue-900 border-r-2 border-slate-400 bg-slate-200/50">
                            ${g.subtotal.total_pu}
                        </td>
                        ${columnasFechas.map(col => {
                            const valObj = g.subtotal.valores[col.id];
                            const puVal = valObj ? valObj.pu : '';
                            const pesoVal = valObj ? valObj.peso : '';
                            return `
                                <td class="px-2.5 py-1 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-100/80"
                                    data-tipo="${g.tipo}"
                                    data-item="Total ${g.tipo}"
                                    data-dia="${col.id}"
                                    data-pu="${puVal}"
                                    data-peso="${pesoVal}"
                                    onmousemove="window.ChartRegistry['CA04 RevisionAlimento'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA04 RevisionAlimento'].hideTooltip()">
                                    ${puVal}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;

                // Subtotal Fila 2: Peso
                html += `
                    <tr class="bg-slate-100/90 font-bold border-b-2 border-slate-300">
                        <td class="px-2 py-1 text-center font-semibold text-[10px] text-slate-600 bg-slate-200/80 border-r border-slate-300">
                            peso
                        </td>
                        <td class="px-3 py-1 text-right font-mono font-bold text-slate-800 border-r-2 border-slate-400 bg-slate-200/50">
                            ${g.subtotal.total_peso}
                        </td>
                        ${columnasFechas.map(col => {
                            const valObj = g.subtotal.valores[col.id];
                            const puVal = valObj ? valObj.pu : '';
                            const pesoVal = valObj ? valObj.peso : '';
                            return `
                                <td class="px-2.5 py-1 text-right font-mono font-bold text-slate-700 border-r border-slate-200 bg-slate-100/80"
                                    data-tipo="${g.tipo}"
                                    data-item="Total ${g.tipo}"
                                    data-dia="${col.id}"
                                    data-pu="${puVal}"
                                    data-peso="${pesoVal}"
                                    onmousemove="window.ChartRegistry['CA04 RevisionAlimento'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA04 RevisionAlimento'].hideTooltip()">
                                    ${pesoVal}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `;
            }
        });

        return html;
    }
};
