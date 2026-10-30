/**
 * Componente de Gráfico / Dashboard Modular: DashAnalisisMermaEscalable
 * Módulo: mermaPlaca
 * 
 * Dashboard con 2 Tablas Sincronizadas y Dinámicas por Mes:
 * 1. Mermas Mes General (AnalisisMermasEscalableGral):
 *    - Filas: CodTra con métricas mensuales (Cant, Peso, Valor, S8XXMerma, %MermaPeso)
 *    - Total General en footer con porcentaje de merma exacto.
 * 2. Mermas Mes Desglosado por Ítem (AnalisisMermasEscalable):
 *    - Filas: CodItem -> CodTra con métricas mensuales.
 *    - Subtotales por CodItem y Total General en footer.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashAnalisisMermaEscalableChart = {
    controllerRef: null,
    datosBackend: null,
    multiPlaca: null,
    multiCliente: null,
    multiItem: null,
    multiTrans: null,
    listenersAttached: false,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Ocultar tooltip flotante previo
        this.hideTooltip();

        // Ocultar tarjetas estándar no usadas
        const cardDetalle = document.getElementById('card-tabla-metricas');
        if (cardDetalle) cardDetalle.classList.add('hidden');

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.style.minHeight = 'auto';
            contenedorGrafica.style.padding = '0';
        }

        // Configurar filtros modulares
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // Renderizar estructura HTML del Dashboard
        this.renderLayout();

        // Renderizar las dos tablas
        this.renderTablas();

        // Adjuntar eventos de tooltips interactivos
        this.attachTableTooltips();

        // Configurar exportación individual a Excel
        this.setupExportListeners();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiPlaca) {
            const placas = this.multiPlaca.getSelectedValues();
            if (placas.length > 0 && placas.length < (this.multiPlaca.options ? this.multiPlaca.options.length : 999)) {
                filters.placa = placas;
            }
        }
        if (this.multiCliente) {
            const clientes = this.multiCliente.getSelectedValues();
            if (clientes.length > 0 && clientes.length < (this.multiCliente.options ? this.multiCliente.options.length : 999)) {
                filters.cdcliente = clientes;
            }
        }
        if (this.multiItem) {
            const items = this.multiItem.getSelectedValues();
            if (items.length > 0 && items.length < (this.multiItem.options ? this.multiItem.options.length : 999)) {
                filters.coditem = items;
            }
        }
        if (this.multiTrans) {
            const trans = this.multiTrans.getSelectedValues();
            if (trans.length > 0 && trans.length < (this.multiTrans.options ? this.multiTrans.options.length : 999)) {
                filters.codtra = trans;
            }
        }
        return filters;
    },

    setupFilters(opciones = {}) {
        // Ocultar Corporativo (no aplica para este dashboard)
        document.getElementById('contenedor-filtro-corporativo-merma')?.classList.add('hidden');

        // 1. Filtro Placa
        const contPlaca = document.getElementById('contenedor-filtro-placa-merma');
        if (contPlaca) contPlaca.classList.remove('hidden');

        const placasDisp = opciones.placas || [];
        if (typeof CustomMultiSelect !== 'undefined' && placasDisp.length > 0) {
            if (!this.multiPlaca) {
                const optPlaca = placasDisp.map(p => ({
                    id: String(p).trim(),
                    label: String(p).trim(),
                    selected: true
                }));
                this.multiPlaca = new CustomMultiSelect({
                    btnId: 'btn-dropdown-placa-merma',
                    dropdownId: 'dropdown-placa-merma',
                    optionsContainerId: 'container-options-placa-merma',
                    labelId: 'label-placa-merma',
                    searchId: 'search-placa-merma',
                    title: 'Placa',
                    options: optPlaca
                });
            }
        }

        // 2. Filtro Cliente
        const contCli = document.getElementById('contenedor-filtro-cliente-merma');
        if (contCli) contCli.classList.remove('hidden');

        const clientesDisp = opciones.clientes || [];
        if (typeof CustomMultiSelect !== 'undefined' && clientesDisp.length > 0) {
            if (!this.multiCliente) {
                const optCli = clientesDisp.map(c => ({
                    id: String(c).trim(),
                    label: String(c).trim(),
                    selected: true
                }));
                this.multiCliente = new CustomMultiSelect({
                    btnId: 'btn-dropdown-cliente-merma',
                    dropdownId: 'dropdown-cliente-merma',
                    optionsContainerId: 'container-options-cliente-merma',
                    labelId: 'label-cliente-merma',
                    searchId: 'search-cliente-merma',
                    title: 'Cliente',
                    options: optCli
                });
            }
        }

        // 3. Filtro CodItem
        const contItem = document.getElementById('contenedor-filtro-item-merma');
        if (contItem) contItem.classList.remove('hidden');

        const itemsDisp = opciones.items || ['100', '103', '107'];
        if (typeof CustomMultiSelect !== 'undefined' && itemsDisp.length > 0) {
            if (!this.multiItem) {
                const optItem = itemsDisp.map(it => ({
                    id: String(it).trim(),
                    label: String(it).trim(),
                    selected: true
                }));
                this.multiItem = new CustomMultiSelect({
                    btnId: 'btn-dropdown-item-merma',
                    dropdownId: 'dropdown-item-merma',
                    optionsContainerId: 'container-options-item-merma',
                    labelId: 'label-item-merma',
                    searchId: 'search-item-merma',
                    title: 'Ítem',
                    options: optItem
                });
            }
        }

        // 4. Filtro CodTra
        const contTrans = document.getElementById('contenedor-filtro-transaccion-merma');
        if (contTrans) contTrans.classList.remove('hidden');

        const transDisp = opciones.transacciones || [];
        if (typeof CustomMultiSelect !== 'undefined' && transDisp.length > 0) {
            if (!this.multiTrans) {
                const optTrans = transDisp.map(t => ({
                    id: String(t.codtra || t).trim(),
                    label: `${t.codtra || t} - ${t.descri || ''}`.trim(),
                    selected: true
                }));
                this.multiTrans = new CustomMultiSelect({
                    btnId: 'btn-dropdown-transaccion-merma',
                    dropdownId: 'dropdown-transaccion-merma',
                    optionsContainerId: 'container-options-transaccion-merma',
                    labelId: 'label-transaccion-merma',
                    searchId: 'search-transaccion-merma',
                    title: 'Transacción',
                    options: optTrans
                });
            }
        }
    },

    resetFilters() {
        if (this.multiPlaca) this.multiPlaca.selectAll(true);
        if (this.multiCliente) this.multiCliente.selectAll(true);
        if (this.multiItem) this.multiItem.selectAll(true);
        if (this.multiTrans) this.multiTrans.selectAll(true);
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- TABLA 1: MERMAS MES GENERAL (Izquierda - 5 cols xl) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Mermas Mes</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Resumen General por Transacción</span>
                            </div>
                            <button id="btn-export-excel-escalable-general" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar bg-white">
                            <table id="tabla-escalable-general" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead id="thead-escalable-general" class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <!-- Dinámico por meses -->
                                </thead>
                                <tbody id="tbody-escalable-general" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                                <tfoot id="tfoot-escalable-general" class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md">
                                    <!-- Dinámico -->
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- TABLA 2: MERMAS MES DESGLOSADO POR ÍTEM (Derecha - 7 cols xl) -->
                    <div class="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Mermas Mes</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Desglose por Ítem y Transacción</span>
                            </div>
                            <button id="btn-export-excel-escalable-desglosada" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar bg-white">
                            <table id="tabla-escalable-desglosada" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead id="thead-escalable-desglosada" class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <!-- Dinámico por meses -->
                                </thead>
                                <tbody id="tbody-escalable-desglosada" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                                <tfoot id="tfoot-escalable-desglosada" class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md">
                                    <!-- Dinámico -->
                                </tfoot>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        `;
    },

    setupExportListeners() {
        document.getElementById('btn-export-excel-escalable-general')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-escalable-general', 'Mermas_Mes_General', {
                    nombreHoja: 'Mermas Mes General'
                });
            }
        });

        document.getElementById('btn-export-excel-escalable-desglosada')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-escalable-desglosada', 'Mermas_Mes_Desglose_Item', {
                    nombreHoja: 'Mermas Mes Desglosada'
                });
            }
        });
    },

    renderTablas() {
        const meses = this.datosBackend.meses || [];
        const formatNum = (val, dec = 2, blankIfZero = false) => {
            if (val === null || val === undefined || isNaN(val)) return blankIfZero ? '' : '0.00';
            if (blankIfZero && Math.abs(val) < 0.0001) return '';
            return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };

        this.renderTablaGeneral(meses, formatNum);
        this.renderTablaDesglosada(meses, formatNum);
    },

    /**
     * Renderizado de TABLA 1: General por CodTra
     */
    renderTablaGeneral(meses, formatNum) {
        const thead = document.getElementById('thead-escalable-general');
        const tbody = document.getElementById('tbody-escalable-general');
        const tfoot = document.getElementById('tfoot-escalable-general');
        if (!thead || !tbody) return;

        const generalData = this.datosBackend.tabla_general || {};
        const filas = generalData.filas || [];
        const totalGen = generalData.total_general || {};

        // 1. Construir Encabezado Multinivel
        let headRow1 = `
            <tr>
                <th rowspan="2" class="px-3 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 align-middle bg-blue-600">CodTra</th>
        `;
        let headRow2 = `<tr>`;

        meses.forEach(m => {
            headRow1 += `<th colspan="5" class="px-2 py-1.5 text-center font-bold tracking-wider border-r border-blue-500/40 bg-blue-600 text-white">${m.label}</th>`;
            headRow2 += `
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Cant</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Peso</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Valor</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">S8XXMerma</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">%MermaPeso</th>
            `;
        });

        // Columna de Total General Horizontal
        headRow1 += `<th colspan="5" class="px-2 py-1.5 text-center font-extrabold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Total general</th>`;
        headRow2 += `
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Cant</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Peso</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Valor</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">S8XXMerma</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">%MermaPeso</th>
        `;

        headRow1 += `</tr>`;
        headRow2 += `</tr>`;
        thead.innerHTML = headRow1 + headRow2;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${1 + (meses.length + 1) * 5}" class="py-8 text-center text-slate-400 italic">No hay datos disponibles para el período y filtros seleccionados.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        // 2. Construir Filas
        let bodyHtml = '';
        filas.forEach(f => {
            const tra = f.codtra || '';
            const desc = f.descri || '';
            bodyHtml += `
                <tr class="hover:bg-blue-50/40 transition-colors">
                    <td class="px-3 py-1.5 font-bold text-slate-800 border-r border-slate-200 bg-white" title="${desc}">${tra}</td>
            `;

            meses.forEach(m => {
                const mKey = m.key;
                const vals = (f.meses && f.meses[mKey]) || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: null };

                const cantStr = formatNum(vals.cant, 2, false);
                const pesoStr = formatNum(vals.peso, 2, false);
                const valStr  = formatNum(vals.valor, 2, false);
                const merStr  = formatNum(vals.s8xx_merma, 2, false);
                const pctStr  = vals.porc_merma_peso !== null ? `${formatNum(vals.porc_merma_peso, 2)}%` : '';

                const tooltipCell = encodeURIComponent(JSON.stringify({
                    'Transacción': `${tra} - ${desc}`,
                    'Mes': m.label,
                    'Cantidad': cantStr,
                    'Peso': `${pesoStr} Kg`,
                    'Valor': `S/ ${valStr}`,
                    'S8XX Merma': `${merStr} Kg`,
                    '% Merma Peso': pctStr || '-'
                }));

                bodyHtml += `
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${cantStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${pesoStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${valStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${merStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${pctStr}</td>
                `;
            });

            // Celdas de Total General Horizontal por Fila
            const hVals = f.total_horizontal || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: null };
            const hCant = formatNum(hVals.cant, 2, false);
            const hPeso = formatNum(hVals.peso, 2, false);
            const hVal  = formatNum(hVals.valor, 2, false);
            const hMer  = formatNum(hVals.s8xx_merma, 2, false);
            const hPct  = hVals.porc_merma_peso !== null ? `${formatNum(hVals.porc_merma_peso, 2)}%` : '';

            const tooltipHoriz = encodeURIComponent(JSON.stringify({
                'Transacción': `${tra} - ${desc}`,
                'Total': 'Total General Horizontal',
                'Cantidad': hCant,
                'Peso': `${hPeso} Kg`,
                'Valor': `S/ ${hVal}`,
                'S8XX Merma': `${hMer} Kg`,
                '% Merma Peso': hPct || '-'
            }));

            bodyHtml += `
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hCant}</td>
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hPeso}</td>
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hVal}</td>
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hMer}</td>
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hPct}</td>
            `;

            bodyHtml += `</tr>`;
        });
        tbody.innerHTML = bodyHtml;

        // 3. Construir Footer Total General
        if (tfoot) {
            let footHtml = `
                <tr>
                    <td class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-600 bg-blue-700">Total general</td>
            `;

            meses.forEach(m => {
                const mKey = m.key;
                const vals = totalGen[mKey] || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };

                const cantStr = formatNum(vals.cant, 2, false);
                const pesoStr = formatNum(vals.peso, 2, false);
                const valStr  = formatNum(vals.valor, 2, false);
                const merStr  = formatNum(vals.s8xx_merma, 2, false);
                const pctStr  = `${formatNum(vals.porc_merma_peso, 2)}%`;

                const tooltipTotal = encodeURIComponent(JSON.stringify({
                    'Tipo': 'Total General',
                    'Mes': m.label,
                    'Cantidad Total': cantStr,
                    'Peso Total': `${pesoStr} Kg`,
                    'Valor Total': `S/ ${valStr}`,
                    'S8XX Merma Total': `${merStr} Kg`,
                    '% Merma Peso Total': pctStr
                }));

                footHtml += `
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${cantStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${pesoStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${valStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${merStr}</td>
                    <td class="px-2 py-2 text-right font-mono font-black text-amber-200 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${pctStr}</td>
                `;
            });

            // Intersección Total General Horizontal y Vertical
            const hTot = generalData.total_horizontal || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };
            const hTotCant = formatNum(hTot.cant, 2, false);
            const hTotPeso = formatNum(hTot.peso, 2, false);
            const hTotVal  = formatNum(hTot.valor, 2, false);
            const hTotMer  = formatNum(hTot.s8xx_merma, 2, false);
            const hTotPct  = `${formatNum(hTot.porc_merma_peso, 2)}%`;

            const tooltipGrandTotal = encodeURIComponent(JSON.stringify({
                'Tipo': 'Gran Total Consolidado',
                'Cantidad Total': hTotCant,
                'Peso Total': `${hTotPeso} Kg`,
                'Valor Total': `S/ ${hTotVal}`,
                'S8XX Merma Total': `${hTotMer} Kg`,
                '% Merma Peso Total': hTotPct
            }));

            footHtml += `
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotCant}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotPeso}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotVal}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotMer}</td>
                <td class="px-2 py-2 text-right font-mono font-black text-amber-300 bg-blue-900 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotPct}</td>
            `;

            footHtml += `</tr>`;
            tfoot.innerHTML = footHtml;
        }
    },

    /**
     * Renderizado de TABLA 2: Desglosado por CodItem y CodTra
     */
    renderTablaDesglosada(meses, formatNum) {
        const thead = document.getElementById('thead-escalable-desglosada');
        const tbody = document.getElementById('tbody-escalable-desglosada');
        const tfoot = document.getElementById('tfoot-escalable-desglosada');
        if (!thead || !tbody) return;

        const desglosadaData = this.datosBackend.tabla_desglosada || {};
        const items = desglosadaData.items || [];
        const totalGen = desglosadaData.total_general || {};

        // 1. Construir Encabezado Multinivel
        let headRow1 = `
            <tr>
                <th rowspan="2" class="px-3 py-2 text-center font-bold tracking-wider border-r border-blue-500/40 align-middle bg-blue-600">CodItem</th>
                <th rowspan="2" class="px-3 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 align-middle bg-blue-600">CodTra</th>
        `;
        let headRow2 = `<tr>`;

        meses.forEach(m => {
            headRow1 += `<th colspan="5" class="px-2 py-1.5 text-center font-bold tracking-wider border-r border-blue-500/40 bg-blue-600 text-white">${m.label}</th>`;
            headRow2 += `
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Cant</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Peso</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">Valor</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">S8XXMerma</th>
                <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-500/40">%MermaPeso</th>
            `;
        });

        // Columna de Total General Horizontal
        headRow1 += `<th colspan="5" class="px-2 py-1.5 text-center font-extrabold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Total general</th>`;
        headRow2 += `
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Cant</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Peso</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">Valor</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">S8XXMerma</th>
            <th class="px-2 py-1.5 text-right font-bold tracking-wider border-r border-blue-400 bg-blue-700 text-white">%MermaPeso</th>
        `;

        headRow1 += `</tr>`;
        headRow2 += `</tr>`;
        thead.innerHTML = headRow1 + headRow2;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${2 + (meses.length + 1) * 5}" class="py-8 text-center text-slate-400 italic">No hay datos disponibles para el período y filtros seleccionados.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        // 2. Construir Filas por Ítem y Subtotales
        let bodyHtml = '';
        items.forEach(itGroup => {
            const itemCode = itGroup.coditem || '';
            const transacciones = itGroup.transacciones || [];
            const subtotales = itGroup.subtotales || {};
            const itemRowsCount = transacciones.length;

            transacciones.forEach((tRow, idx) => {
                const isFirstRow = (idx === 0);
                const tra = tRow.codtra || '';
                const desc = tRow.descri || '';

                bodyHtml += `
                    <tr class="hover:bg-blue-50/40 transition-colors">
                        ${isFirstRow ? `<td class="px-3 py-1.5 text-center font-bold text-slate-900 border-r border-slate-200 align-top bg-white" rowspan="${itemRowsCount}">${itemCode}</td>` : ''}
                        <td class="px-3 py-1.5 font-bold text-slate-800 border-r border-slate-200 bg-slate-50/20" title="${desc}">${tra}</td>
                `;

                meses.forEach(m => {
                    const mKey = m.key;
                    const vals = (tRow.meses && tRow.meses[mKey]) || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: null };

                    const cantStr = formatNum(vals.cant, 2, false);
                    const pesoStr = formatNum(vals.peso, 2, false);
                    const valStr  = formatNum(vals.valor, 2, false);
                    const merStr  = formatNum(vals.s8xx_merma, 2, false);
                    const pctStr  = vals.porc_merma_peso !== null ? `${formatNum(vals.porc_merma_peso, 2)}%` : '';

                    const tooltipCell = encodeURIComponent(JSON.stringify({
                        'Ítem': itemCode,
                        'Transacción': `${tra} - ${desc}`,
                        'Mes': m.label,
                        'Cantidad': cantStr,
                        'Peso': `${pesoStr} Kg`,
                        'Valor': `S/ ${valStr}`,
                        'S8XX Merma': `${merStr} Kg`,
                        '% Merma Peso': pctStr || '-'
                    }));

                    bodyHtml += `
                        <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${cantStr}</td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${pesoStr}</td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${valStr}</td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${merStr}</td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${pctStr}</td>
                    `;
                });

                // Celdas de Total General Horizontal por Fila de Transacción
                const hVals = tRow.total_horizontal || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: null };
                const hCant = formatNum(hVals.cant, 2, false);
                const hPeso = formatNum(hVals.peso, 2, false);
                const hVal  = formatNum(hVals.valor, 2, false);
                const hMer  = formatNum(hVals.s8xx_merma, 2, false);
                const hPct  = hVals.porc_merma_peso !== null ? `${formatNum(hVals.porc_merma_peso, 2)}%` : '';

                const tooltipHoriz = encodeURIComponent(JSON.stringify({
                    'Ítem': itemCode,
                    'Transacción': `${tra} - ${desc}`,
                    'Total': 'Total General Horizontal',
                    'Cantidad': hCant,
                    'Peso': `${hPeso} Kg`,
                    'Valor': `S/ ${hVal}`,
                    'S8XX Merma': `${hMer} Kg`,
                    '% Merma Peso': hPct || '-'
                }));

                bodyHtml += `
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hCant}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hPeso}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hVal}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hMer}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-800 bg-slate-50/70 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipHoriz}">${hPct}</td>
                `;

                bodyHtml += `</tr>`;
            });

            // Subtotal por CodItem (como en Tableau con etiqueta "Total")
            bodyHtml += `
                <tr class="bg-slate-100/90 font-bold text-slate-900 border-t border-b-2 border-slate-300">
                    <td colspan="2" class="px-3 py-1.5 text-left font-bold text-slate-700 tracking-wide border-r border-slate-200">
                        Total
                    </td>
            `;

            meses.forEach(m => {
                const mKey = m.key;
                const subVals = subtotales[mKey] || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };

                const cantStr = formatNum(subVals.cant, 2, false);
                const pesoStr = formatNum(subVals.peso, 2, false);
                const valStr  = formatNum(subVals.valor, 2, false);
                const merStr  = formatNum(subVals.s8xx_merma, 2, false);
                const pctStr  = `${formatNum(subVals.porc_merma_peso, 2)}%`;

                const tooltipSub = encodeURIComponent(JSON.stringify({
                    'Tipo': `Subtotal Ítem ${itemCode}`,
                    'Mes': m.label,
                    'Cantidad': cantStr,
                    'Peso': `${pesoStr} Kg`,
                    'Valor': `S/ ${valStr}`,
                    'S8XX Merma': `${merStr} Kg`,
                    '% Merma Peso': pctStr
                }));

                bodyHtml += `
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSub}">${cantStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSub}">${pesoStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSub}">${valStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSub}">${merStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSub}">${pctStr}</td>
                `;
            });

            // Subtotal Horizontal por CodItem
            const sHVals = itGroup.subtotal_horizontal || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };
            const sHCant = formatNum(sHVals.cant, 2, false);
            const sHPeso = formatNum(sHVals.peso, 2, false);
            const sHVal  = formatNum(sHVals.valor, 2, false);
            const sHMer  = formatNum(sHVals.s8xx_merma, 2, false);
            const sHPct  = `${formatNum(sHVals.porc_merma_peso, 2)}%`;

            const tooltipSubHoriz = encodeURIComponent(JSON.stringify({
                'Tipo': `Gran Subtotal Ítem ${itemCode}`,
                'Total': 'Total Horizontal Consolidado',
                'Cantidad': sHCant,
                'Peso': `${sHPeso} Kg`,
                'Valor': `S/ ${sHVal}`,
                'S8XX Merma': `${sHMer} Kg`,
                '% Merma Peso': sHPct
            }));

            bodyHtml += `
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/60 border-r border-slate-300 cursor-default" data-tooltip-fields="${tooltipSubHoriz}">${sHCant}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/60 border-r border-slate-300 cursor-default" data-tooltip-fields="${tooltipSubHoriz}">${sHPeso}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/60 border-r border-slate-300 cursor-default" data-tooltip-fields="${tooltipSubHoriz}">${sHVal}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/60 border-r border-slate-300 cursor-default" data-tooltip-fields="${tooltipSubHoriz}">${sHMer}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/60 border-r border-slate-300 cursor-default" data-tooltip-fields="${tooltipSubHoriz}">${sHPct}</td>
            `;

            bodyHtml += `</tr>`;
        });

        tbody.innerHTML = bodyHtml;

        // 3. Construir Footer Total General
        if (tfoot) {
            let footHtml = `
                <tr>
                    <td colspan="2" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-600 bg-blue-700">Total general</td>
            `;

            meses.forEach(m => {
                const mKey = m.key;
                const vals = totalGen[mKey] || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };

                const cantStr = formatNum(vals.cant, 2, false);
                const pesoStr = formatNum(vals.peso, 2, false);
                const valStr  = formatNum(vals.valor, 2, false);
                const merStr  = formatNum(vals.s8xx_merma, 2, false);
                const pctStr  = `${formatNum(vals.porc_merma_peso, 2)}%`;

                const tooltipTotal = encodeURIComponent(JSON.stringify({
                    'Tipo': 'Total General Desglosado',
                    'Mes': m.label,
                    'Cantidad Total': cantStr,
                    'Peso Total': `${pesoStr} Kg`,
                    'Valor Total': `S/ ${valStr}`,
                    'S8XX Merma Total': `${merStr} Kg`,
                    '% Merma Peso Total': pctStr
                }));

                footHtml += `
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${cantStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${pesoStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${valStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${merStr}</td>
                    <td class="px-2 py-2 text-right font-mono font-black text-amber-200 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotal}">${pctStr}</td>
                `;
            });

            // Intersección Total General Horizontal y Vertical para Tabla Desglosada
            const hTot = desglosadaData.total_horizontal || { cant: 0, peso: 0, valor: 0, s8xx_merma: 0, porc_merma_peso: 0 };
            const hTotCant = formatNum(hTot.cant, 2, false);
            const hTotPeso = formatNum(hTot.peso, 2, false);
            const hTotVal  = formatNum(hTot.valor, 2, false);
            const hTotMer  = formatNum(hTot.s8xx_merma, 2, false);
            const hTotPct  = `${formatNum(hTot.porc_merma_peso, 2)}%`;

            const tooltipGrandTotal = encodeURIComponent(JSON.stringify({
                'Tipo': 'Gran Total Consolidado Desglosado',
                'Cantidad Total': hTotCant,
                'Peso Total': `${hTotPeso} Kg`,
                'Valor Total': `S/ ${hTotVal}`,
                'S8XX Merma Total': `${hTotMer} Kg`,
                '% Merma Peso Total': hTotPct
            }));

            footHtml += `
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotCant}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotPeso}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotVal}</td>
                <td class="px-2 py-2 text-right font-mono bg-blue-800 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotMer}</td>
                <td class="px-2 py-2 text-right font-mono font-black text-amber-300 bg-blue-900 border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrandTotal}">${hTotPct}</td>
            `;

            footHtml += `</tr>`;
            tfoot.innerHTML = footHtml;
        }
    },

    attachTableTooltips() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const tableCells = document.querySelectorAll('[data-tooltip-fields]');
        tableCells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                const rawData = cell.getAttribute('data-tooltip-fields');
                if (!rawData) return;

                try {
                    const dataObj = JSON.parse(decodeURIComponent(rawData));
                    let contentHtml = '<div class="flex flex-col gap-1.5">';

                    Object.entries(dataObj).forEach(([label, val]) => {
                        const isPrimary = ['Tipo', 'Transacción', 'Ítem', 'Mes'].includes(label);
                        contentHtml += `
                            <div class="flex justify-between items-center gap-4 text-xs ${isPrimary ? 'font-bold border-b border-slate-100 pb-1 text-slate-800' : 'text-slate-600'}">
                                <span class="font-medium text-slate-400">${label}:</span>
                                <span class="font-mono ${isPrimary ? 'text-blue-700' : 'text-slate-800'}">${val}</span>
                            </div>
                        `;
                    });

                    contentHtml += '</div>';
                    tooltipEl.innerHTML = contentHtml;
                    tooltipEl.classList.remove('hidden');
                    tooltipEl.style.display = 'block';
                    this.positionTooltip(e, tooltipEl);
                } catch (err) {
                    console.error('Error parseando datos de tooltip:', err);
                }
            });

            cell.addEventListener('mousemove', (e) => {
                this.positionTooltip(e, tooltipEl);
            });

            cell.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    },

    positionTooltip(e, tooltipEl) {
        if (!tooltipEl) return;
        const offset = 14;
        let x = e.clientX + offset;
        let y = e.clientY + offset;

        const ttWidth = tooltipEl.offsetWidth || 240;
        const ttHeight = tooltipEl.offsetHeight || 110;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        if (x + ttWidth > winWidth - 10) {
            x = e.clientX - ttWidth - offset;
        }
        if (y + ttHeight > winHeight - 10) {
            y = e.clientY - ttHeight - offset;
        }

        tooltipEl.style.left = '0px';
        tooltipEl.style.top = '0px';
        tooltipEl.style.transform = `translate3d(${Math.max(10, x)}px, ${Math.max(10, y)}px, 0)`;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
            tooltipEl.style.display = 'none';
            tooltipEl.style.transform = 'none';
            tooltipEl.style.left = '';
            tooltipEl.style.top = '';
            tooltipEl.innerHTML = '';
        }
    },

    destroy() {
        this.hideTooltip();
    }
};

// Registrar en ChartRegistry
window.ChartRegistry['DashAnalisisMermaEscalable'] = window.DashAnalisisMermaEscalableChart;
