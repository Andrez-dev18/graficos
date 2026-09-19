/**
 * Componente de Gráfico / Dashboard Modular: AnalisisMermasEscalable2
 * Módulo: mermaPlaca
 * 
 * Tabla Matriz Dinámica Pivotada por Transacciones (Tableau Mermas Mes):
 * - Filas: Mes de FecProceso (con rowspan 5) x 5 Indicadores (Cant, Peso, Valor, S8XXMerma, %MermaPeso).
 * - Columnas: CodItem agrupador superior + Transacciones dinámicas + Columna 'Total' por Ítem + Columna 'Total general' al final.
 * - Total General: 5 filas consolidadas en el footer (tfoot) con subtotales por ítem y total general absoluto.
 * - Cabeceras bg-blue-600, columnas sticky, tooltips y exportación a Excel nativa.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.AnalisisMermasEscalable2Chart = {
    controllerRef: null,
    datosBackend: null,
    multiPlaca: null,
    multiCliente: null,
    multiItem: null,
    multiTrans: null,
    eventsBound: false,
    rafId: null,
    mouseX: 0,
    mouseY: 0,
    currentCell: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Ocultar contenedores estándar no usados
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

        // Renderizar estructura HTML de la tabla
        this.renderLayout();

        // Renderizar filas de la tabla
        this.renderTabla();

        // Delegación de eventos para tooltips ultra rápidos
        this.bindEventsDelegation();
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

        // 3. Filtro CodItem: Todos seleccionados por defecto
        const contItem = document.getElementById('contenedor-filtro-item-merma');
        if (contItem) contItem.classList.remove('hidden');

        const itemsDisp = opciones.items || ['100', '103', '107'];
        if (typeof CustomMultiSelect !== 'undefined' && itemsDisp.length > 0) {
            if (!this.multiItem) {
                const optItem = itemsDisp.map(it => {
                    const sIt = String(it).trim();
                    return {
                        id: sIt,
                        label: sIt,
                        selected: true // Todos seleccionados por defecto
                    };
                });
                this.multiItem = new CustomMultiSelect({
                    btnId: 'btn-dropdown-item-merma',
                    dropdownId: 'dropdown-item-merma',
                    optionsContainerId: 'container-options-item-merma',
                    labelId: 'label-item-merma',
                    searchId: 'search-item-merma',
                    title: 'Item',
                    options: optItem
                });
            }
        }

        // 4. Filtro CodTra (Transacción)
        const contTrans = document.getElementById('contenedor-filtro-transaccion-merma');
        if (contTrans) contTrans.classList.remove('hidden');

        const transDisp = opciones.transacciones || [];
        if (typeof CustomMultiSelect !== 'undefined' && transDisp.length > 0) {
            if (!this.multiTrans) {
                const optTrans = transDisp.map(t => ({
                    id: String(t.codtra).trim(),
                    label: `${t.codtra} - ${t.descri}`,
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

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const columnas = data.columnas || [];

        // Agrupar columnas por CodItem
        const itemsGroup = {};
        columnas.forEach(c => {
            if (!itemsGroup[c.coditem]) itemsGroup[c.coditem] = [];
            itemsGroup[c.coditem].push(c);
        });

        // Nivel 1 Header: Mes, Indicador, y CodItems con su colspan (+1 por la columna Total del item)
        let thLevel1 = `
            <th rowspan="2" class="sticky left-0 z-30 bg-blue-600 px-3 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                Mes de FecProceso
            </th>
            <th rowspan="2" class="sticky left-[120px] z-30 bg-blue-600 px-2.5 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[90px]">
                Indicador
            </th>
        `;

        // Nivel 2 Header: Cada CodTra + Descripción y columna Total
        let thLevel2 = '';

        Object.entries(itemsGroup).forEach(([itemCode, colsItem]) => {
            // Colspan = cantidad de transacciones + 1 columna de Total por Ítem
            thLevel1 += `
                <th colspan="${colsItem.length + 1}" class="bg-blue-700 px-3 py-1.5 text-center border-r-2 border-blue-400 font-bold text-xs uppercase tracking-wider text-white">
                    ${itemCode}
                </th>
            `;

            colsItem.forEach(c => {
                thLevel2 += `
                    <th class="px-2 py-2 text-center border-r border-blue-500 bg-blue-600 text-white font-bold text-[10px] min-w-[95px] max-w-[110px]" title="${c.descri}">
                        <div class="font-mono font-bold text-xs text-white">${c.codtra}</div>
                        <div class="text-[9px] font-normal text-blue-100 truncate leading-tight mt-0.5" title="${c.descri}">
                            ${c.descri}
                        </div>
                    </th>
                `;
            });

            // Columna Subtotal 'Total' del ítem
            thLevel2 += `
                <th class="px-2 py-2 text-center border-r-2 border-blue-400 bg-blue-700 text-white font-bold text-xs min-w-[95px]">
                    Total
                </th>
            `;
        });

        // Columna final 'Total general' horizontal
        thLevel1 += `
            <th rowspan="2" class="sticky right-0 z-30 bg-blue-700 px-3 py-2.5 text-center border-l-2 border-blue-400 font-bold uppercase tracking-wider text-[10px] min-w-[105px]">
                Total general
            </th>
        `;

        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- TARJETA PRINCIPAL: ANALISIS MERMAS ESCALABLE 2 -->
                <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 class="text-sm font-bold text-slate-900 tracking-tight">Mermas Mes (AnalisisMermasEscalable2)</h3>
                            <p class="text-[11px] text-slate-500">Matriz mensual pivotada por transacciones con totales por ítem y total general</p>
                        </div>

                        <!-- BOTÓN EXPORTAR A EXCEL -->
                        <div class="flex items-center gap-2">
                            <button id="btn-export-escalable2" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- CONTENEDOR DE LA TABLA MATRIZ PIVOTADA -->
                    <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                        <table id="tabla-analisis-escalable2" class="w-full text-xs border-collapse table-auto select-none">
                            <thead id="thead-analisis-escalable2" class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 font-bold shadow-xs select-none">
                                <tr>${thLevel1}</tr>
                                <tr>${thLevel2}</tr>
                            </thead>
                            <tbody id="tbody-analisis-escalable2" class="divide-y divide-slate-100 bg-white"></tbody>
                            <tfoot id="tfoot-analisis-escalable2" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Evento botón Excel
        const btnExport = document.getElementById('btn-export-escalable2');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-analisis-escalable2', 'Mermas_Mes_Escalable2');
                }
            };
        }
    },

    renderTabla() {
        const tbody = document.getElementById('tbody-analisis-escalable2');
        const tfoot = document.getElementById('tfoot-analisis-escalable2');
        if (!tbody || !tfoot) return;

        const data = this.datosBackend || {};
        const meses = data.meses || [];
        const columnas = data.columnas || [];
        const totalGenItems = data.total_general_items || {};
        const totalGenAbsoluto = data.total_general_absoluto || {};

        // Agrupar columnas por CodItem para renderizar ordenadamente
        const itemsGroup = {};
        columnas.forEach(c => {
            if (!itemsGroup[c.coditem]) itemsGroup[c.coditem] = [];
            itemsGroup[c.coditem].push(c);
        });

        const totalCols = columnas.length + Object.keys(itemsGroup).length + 3;

        if (meses.length === 0 || columnas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${totalCols}" class="py-10 text-center text-slate-400 italic">
                        No se encontraron registros para el rango de fechas y filtros seleccionados
                    </td>
                </tr>
            `;
            tfoot.innerHTML = '';
            return;
        }

        const indicadores = [
            { k: 'cant', l: 'Cant', isCur: false, isPorc: false },
            { k: 'peso', l: 'Peso', isCur: false, isPorc: false },
            { k: 'valor', l: 'Valor', isCur: true, isPorc: false },
            { k: 's8xx_merma', l: 'S8XXMerma', isCur: false, isPorc: false },
            { k: 'porc_merma_peso', l: '%MermaPeso', isCur: false, isPorc: true }
        ];

        let tbodyHtml = '';

        meses.forEach(m => {
            const mesNombre = m.mes;
            const itemsMes = m.items || {};
            const mesTotGen = m.total_general || {};

            indicadores.forEach((ind, indIdx) => {
                let cellsHtml = '';

                // Columna 1: Mes de FecProceso (rowspan="5")
                if (indIdx === 0) {
                    cellsHtml += `
                        <td rowspan="5" class="sticky left-0 z-10 bg-white align-top px-3 py-2.5 font-bold text-slate-800 border-r border-slate-200 shadow-2xs">
                            ${mesNombre}
                        </td>
                    `;
                }

                // Columna 2: Indicador (Cant, Peso, Valor, S8XXMerma, %MermaPeso)
                const isBorderBottom = (indIdx === 4) ? 'border-b border-slate-200' : 'border-b border-slate-100';
                cellsHtml += `
                    <td class="sticky left-[120px] z-10 bg-white group-hover:bg-slate-50 px-2.5 py-1.5 font-semibold text-slate-700 border-r border-slate-300 ${isBorderBottom}">
                        ${ind.l}
                    </td>
                `;

                // Celdas por cada ítem y sus transacciones
                Object.entries(itemsGroup).forEach(([itemCode, colsItem]) => {
                    const itemData = itemsMes[itemCode] || {};
                    const colsData = itemData.columnas || {};
                    const itemTotales = itemData.totales || {};

                    colsItem.forEach(col => {
                        const colData = colsData[col.codtra] || {};
                        const rawVal = colData[ind.k];
                        const valFmt = this.formatCellValue(rawVal, ind);

                        cellsHtml += `
                            <td class="cell-esc px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 ${isBorderBottom} hover:bg-blue-50/60"
                                data-mes="${mesNombre}" data-item="${col.coditem}" data-tra="${col.codtra} (${col.descri})" data-indicador="${ind.l}" data-valor="${valFmt}">
                                ${valFmt}
                            </td>
                        `;
                    });

                    // Celda Subtotal 'Total' del ítem
                    const rawItemTotal = itemTotales[ind.k];
                    const itemTotFmt = this.formatCellValue(rawItemTotal, ind);

                    cellsHtml += `
                        <td class="cell-esc px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-50/80 border-r-2 border-slate-300 ${isBorderBottom} hover:bg-slate-100"
                            data-mes="${mesNombre}" data-item="${itemCode} Total" data-tra="Subtotal Ítem" data-indicador="${ind.l}" data-valor="${itemTotFmt}">
                            ${itemTotFmt}
                        </td>
                    `;
                });

                // Celda 'Total general' horizontal del mes
                const rawMonthGen = mesTotGen[ind.k];
                const monthGenFmt = this.formatCellValue(rawMonthGen, ind);

                cellsHtml += `
                    <td class="cell-esc sticky right-0 z-10 px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-50 border-l-2 border-slate-300 ${isBorderBottom} hover:bg-blue-50"
                        data-mes="${mesNombre}" data-item="Total general" data-tra="Total General Mes" data-indicador="${ind.l}" data-valor="${monthGenFmt}">
                        ${monthGenFmt}
                    </td>
                `;

                const rowBg = (indIdx % 2 === 0) ? 'bg-white' : 'bg-slate-50/30';
                tbodyHtml += `<tr class="group hover:bg-slate-50/80 transition-colors ${rowBg}">${cellsHtml}</tr>`;
            });
        });

        tbody.innerHTML = tbodyHtml;

        // FOOTER TOTAL GENERAL (5 FILAS)
        let tfootHtml = '';

        indicadores.forEach((ind, indIdx) => {
            let footCellsHtml = '';

            // Columna 1: Total general (rowspan="5")
            if (indIdx === 0) {
                footCellsHtml += `
                    <td rowspan="5" class="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 font-bold text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[11px] align-top">
                        Total general
                    </td>
                `;
            }

            // Columna 2: Indicador
            footCellsHtml += `
                <td class="sticky left-[120px] z-20 bg-slate-100 px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-300 border-b border-slate-200">
                    ${ind.l}
                </td>
            `;

            // Celdas por cada ítem y sus transacciones consolidadas
            Object.entries(itemsGroup).forEach(([itemCode, colsItem]) => {
                const itemGen = totalGenItems[itemCode] || {};
                const colsGen = itemGen.columnas || {};
                const itemTotGen = itemGen.totales || {};

                colsItem.forEach(col => {
                    const colGen = colsGen[col.codtra] || {};
                    const rawVal = colGen[ind.k];
                    const valFmt = this.formatCellValue(rawVal, ind);

                    footCellsHtml += `
                        <td class="cell-esc px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 border-b border-slate-200 bg-slate-100"
                            data-mes="Total general" data-item="${col.coditem}" data-tra="${col.codtra} (${col.descri})" data-indicador="${ind.l}" data-valor="${valFmt}">
                            ${valFmt}
                        </td>
                    `;
                });

                // Celda Subtotal 'Total' del ítem en Footer
                const rawItemGenTot = itemTotGen[ind.k];
                const itemGenTotFmt = this.formatCellValue(rawItemGenTot, ind);

                footCellsHtml += `
                    <td class="cell-esc px-2 py-1.5 text-right font-mono font-extrabold text-slate-950 border-r-2 border-slate-300 border-b border-slate-200 bg-slate-200/60"
                        data-mes="Total general" data-item="${itemCode} Total" data-tra="Subtotal Consolidado" data-indicador="${ind.l}" data-valor="${itemGenTotFmt}">
                        ${itemGenTotFmt}
                    </td>
                `;
            });

            // Celda Gran Total Absoluto (Footer derecha)
            const rawAbsVal = totalGenAbsoluto[ind.k];
            const absValFmt = this.formatCellValue(rawAbsVal, ind);

            footCellsHtml += `
                <td class="cell-esc sticky right-0 z-20 px-2.5 py-1.5 text-right font-mono font-extrabold text-slate-950 border-l-2 border-slate-300 border-b border-slate-200 bg-slate-200/80"
                    data-mes="Total general" data-item="Gran Total" data-tra="Total General Absoluto" data-indicador="${ind.l}" data-valor="${absValFmt}">
                    ${absValFmt}
                </td>
            `;

            tfootHtml += `<tr>${footCellsHtml}</tr>`;
        });

        tfoot.innerHTML = tfootHtml;
    },

    formatCellValue(val, ind) {
        if (val === undefined || val === null || isNaN(val)) {
            return ind.isPorc ? '' : '0,00';
        }
        if (Math.abs(val) < 0.0001) {
            val = 0;
        }
        if (ind.isPorc) {
            return this.formatNum(val, 2) + '%';
        }
        return this.formatNum(val, 2);
    },

    bindEventsDelegation() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.addEventListener('pointerover', (e) => {
            const cell = e.target.closest('.cell-esc');
            if (cell && cell !== this.currentCell) {
                this.currentCell = cell;
                const ds = cell.dataset;

                this.showTooltip(e, {
                    'Mes de Proceso': ds.mes,
                    'Código Ítem': ds.item,
                    'Transacción': ds.tra,
                    'Indicador': ds.indicador,
                    'Valor': ds.valor
                });
            }
        }, { passive: true });

        contenedor.addEventListener('pointermove', (e) => {
            if (this.currentCell) {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => {
                        this.updateTooltipPosition();
                        this.rafId = null;
                    });
                }
            }
        }, { passive: true });

        contenedor.addEventListener('pointerout', (e) => {
            const cell = e.target.closest('.cell-esc');
            if (cell && (!e.relatedTarget || !cell.contains(e.relatedTarget))) {
                this.currentCell = null;
                this.hideTooltip();
            }
        }, { passive: true });
    },

    showTooltip(e, fields) {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt) return;

        let rowsHtml = '';
        Object.entries(fields).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                rowsHtml += `
                    <div class="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100 last:border-0">
                        <span class="text-slate-500 font-medium">${k}:</span>
                        <span class="text-slate-900 font-semibold font-mono text-right">${v}</span>
                    </div>
                `;
            }
        });

        tt.innerHTML = `
            <div class="flex flex-col gap-1 text-[11px] font-sans">
                ${rowsHtml}
            </div>
        `;

        tt.classList.remove('hidden');
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.updateTooltipPosition();
    },

    updateTooltipPosition() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt || tt.classList.contains('hidden')) return;

        const ttWidth = 260;
        const ttHeight = 130;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let finalX = this.mouseX + 16;
        let finalY = this.mouseY + 16;

        if (finalX + ttWidth > winWidth - 10) {
            finalX = this.mouseX - ttWidth - 16;
        }
        if (finalY + ttHeight > winHeight - 10) {
            finalY = this.mouseY - ttHeight - 16;
        }

        tt.style.left = '0px';
        tt.style.top = '0px';
        tt.style.transform = `translate3d(${Math.max(10, finalX)}px, ${Math.max(10, finalY)}px, 0)`;
    },

    hideTooltip() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) tt.classList.add('hidden');
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    },

    formatNum(val, decimals = 2) {
        if (val === null || val === undefined || isNaN(val)) return '0,00';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    destroy() {
        this.hideTooltip();
        this.currentCell = null;
    }
};

// Registrar en ChartRegistry
window.ChartRegistry['AnalisisMermasEscalable2'] = window.AnalisisMermasEscalable2Chart;
