/**
 * Componente de Gráfico / Dashboard Modular: AnalisisMermasEscalable3
 * Módulo: mermaPlaca
 * 
 * Tabla Matriz Dinámica Pivotada por Transacciones con Desglose por Cliente e Ítem (Tableau AnalisisMermasEscalable3):
 * - Filas: CDCliente -> CodItem -> Mes de FecProceso (con subtotales 'Total' por Ítem) x 5 Indicadores (Cant, Peso, Valor, S8XXMerma, %MermaPeso).
 * - Columnas: Transacciones dinámicas ordenadas alfabéticamente (CodTra + Descripción) + Columna 'Total general' horizontal al final.
 * - Footer: 5 filas consolidadas de Total General Absoluto.
 * - Cabeceras bg-blue-600, columnas sticky, tooltips y exportación a Excel nativa.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.AnalisisMermasEscalable3Chart = {
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

        // Nivel 1 Header: Cliente, Item, Mes, Indicador, y bloque Transacciones + Total general
        let thLevel1 = `
            <th rowspan="2" class="sticky left-0 z-30 bg-blue-600 px-3 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">
                CDCliente
            </th>
            <th rowspan="2" class="sticky left-[120px] z-30 bg-blue-600 px-2.5 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[70px]">
                CodItem
            </th>
            <th rowspan="2" class="sticky left-[190px] z-30 bg-blue-600 px-3 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[110px]">
                Mes de FecProceso
            </th>
            <th rowspan="2" class="sticky left-[300px] z-30 bg-blue-600 px-2.5 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[85px]">
                Indicador
            </th>
            <th colspan="${columnas.length}" class="bg-blue-700 px-3 py-1.5 text-center border-r-2 border-blue-400 font-bold text-xs uppercase tracking-wider text-white">
                Transacciones
            </th>
            <th rowspan="2" class="sticky right-0 z-30 bg-blue-700 px-3 py-2.5 text-center border-l-2 border-blue-400 font-bold uppercase tracking-wider text-[10px] min-w-[105px]">
                Total general
            </th>
        `;

        // Nivel 2 Header: Cada CodTra + Descripción en vertical/truncate
        let thLevel2 = '';
        columnas.forEach(c => {
            thLevel2 += `
                <th class="px-2 py-2 text-center border-r border-blue-500 bg-blue-600 text-white font-bold text-[10px] min-w-[95px] max-w-[115px]" title="${c.descri}">
                    <div class="font-mono font-bold text-xs text-white">${c.codtra}</div>
                    <div class="text-[9px] font-normal text-blue-100 truncate leading-tight mt-0.5" title="${c.descri}">
                        ${c.descri}
                    </div>
                </th>
            `;
        });

        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- TARJETA PRINCIPAL: ANALISIS MERMAS ESCALABLE 3 -->
                <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 class="text-sm font-bold text-slate-900 tracking-tight">Mermas Mes (AnalisisMermasEscalable3)</h3>
                            <p class="text-[11px] text-slate-500">Matriz mensual con desglose por Cliente e Ítem con transacciones pivotadas y subtotales exactos de Tableau</p>
                        </div>

                        <!-- BOTÓN EXPORTAR A EXCEL -->
                        <div class="flex items-center gap-2">
                            <button id="btn-export-escalable3" type="button"
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
                        <table id="tabla-analisis-escalable3" class="w-full text-xs border-collapse table-auto select-none">
                            <thead id="thead-analisis-escalable3" class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 font-bold shadow-xs select-none">
                                <tr>${thLevel1}</tr>
                                <tr>${thLevel2}</tr>
                            </thead>
                            <tbody id="tbody-analisis-escalable3" class="divide-y divide-slate-100 bg-white"></tbody>
                            <tfoot id="tfoot-analisis-escalable3" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Evento botón Excel
        const btnExport = document.getElementById('btn-export-escalable3');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-analisis-escalable3', 'Mermas_Mes_Escalable3');
                }
            };
        }
    },

    renderTabla() {
        const tbody = document.getElementById('tbody-analisis-escalable3');
        const tfoot = document.getElementById('tfoot-analisis-escalable3');
        if (!tbody || !tfoot) return;

        const data = this.datosBackend || {};
        const clientes = data.clientes || [];
        const columnas = data.columnas || [];
        const totalGen = data.total_general || {};

        const totalCols = columnas.length + 5;

        if (clientes.length === 0 || columnas.length === 0) {
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

        clientes.forEach(cli => {
            const cliName = cli.cdcliente;
            const items = cli.items || [];
            const cliTotales = cli.totales || {};
            const cliColTotales = cli.columnas_totales || {};

            // Calcular el número total de filas del cliente (cada item tiene (meses + 1 subtotal) * 5)
            let totalFilasCliente = 0;
            items.forEach(it => {
                const numMeses = (it.meses || []).length;
                totalFilasCliente += (numMeses + 1) * 5; // meses + 1 bloque de 5 filas de subtotal item
            });

            let isFirstRowCli = true;

            items.forEach(it => {
                const itCode = it.coditem;
                const meses = it.meses || [];
                const itTotales = it.totales || {};
                const itColTotales = it.columnas_totales || {};

                // El rowspan de CodItem cubre todos sus meses y la fila Total del item
                const totalFilasItem = (meses.length + 1) * 5;
                let isFirstRowItem = true;

                // 1. Filas por cada Mes
                meses.forEach(m => {
                    const mesNombre = m.mes;
                    const colsData = m.columnas || {};
                    const mesTotGen = m.totales || {};

                    indicadores.forEach((ind, indIdx) => {
                        let cellsHtml = '';

                        // Columna 1: CDCliente (rowspan total del cliente)
                        if (isFirstRowCli && indIdx === 0) {
                            cellsHtml += `
                                <td rowspan="${totalFilasCliente}" class="sticky left-0 z-10 bg-white align-top px-3 py-2.5 font-bold text-slate-900 border-r border-slate-300 shadow-2xs">
                                    ${cliName}
                                </td>
                            `;
                            isFirstRowCli = false;
                        }

                        // Columna 2: CodItem (rowspan del item que cubre meses + total)
                        if (isFirstRowItem && indIdx === 0) {
                            cellsHtml += `
                                <td rowspan="${totalFilasItem}" class="sticky left-[120px] z-10 bg-white align-top px-2.5 py-2.5 font-bold text-slate-800 border-r border-slate-200">
                                    ${itCode}
                                </td>
                            `;
                            isFirstRowItem = false;
                        }

                        // Columna 3: Mes de FecProceso (rowspan="5")
                        if (indIdx === 0) {
                            cellsHtml += `
                                <td rowspan="5" class="sticky left-[190px] z-10 bg-white align-top px-3 py-2.5 font-semibold text-slate-700 border-r border-slate-200">
                                    ${mesNombre}
                                </td>
                            `;
                        }

                        // Columna 4: Indicador
                        const isBorderBottom = (indIdx === 4) ? 'border-b border-slate-200' : 'border-b border-slate-100';
                        cellsHtml += `
                            <td class="sticky left-[300px] z-10 bg-white group-hover:bg-slate-50 px-2.5 py-1.5 font-medium text-slate-600 border-r border-slate-300 ${isBorderBottom}">
                                ${ind.l}
                            </td>
                        `;

                        // Celdas dinámicas por transacción
                        columnas.forEach(col => {
                            const colVal = colsData[col.codtra] || {};
                            const rawVal = colVal[ind.k];
                            const valFmt = this.formatCellValue(rawVal, ind);

                            cellsHtml += `
                                <td class="cell-esc px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 ${isBorderBottom} hover:bg-blue-50/60"
                                    data-cliente="${cliName}" data-item="${itCode}" data-mes="${mesNombre}" data-tra="${col.codtra} (${col.descri})" data-indicador="${ind.l}" data-valor="${valFmt}">
                                    ${valFmt}
                                </td>
                            `;
                        });

                        // Columna Total general horizontal del Mes
                        const rawMesTot = mesTotGen[ind.k];
                        const mesTotFmt = this.formatCellValue(rawMesTot, ind);

                        cellsHtml += `
                            <td class="cell-esc sticky right-0 z-10 px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-50 border-l-2 border-slate-300 ${isBorderBottom} hover:bg-blue-50"
                                data-cliente="${cliName}" data-item="${itCode}" data-mes="${mesNombre}" data-tra="Total Mes" data-indicador="${ind.l}" data-valor="${mesTotFmt}">
                                ${mesTotFmt}
                            </td>
                        `;

                        const rowBg = (indIdx % 2 === 0) ? 'bg-white' : 'bg-slate-50/30';
                        tbodyHtml += `<tr class="group hover:bg-slate-50/80 transition-colors ${rowBg}">${cellsHtml}</tr>`;
                    });
                });

                // 2. Filas de Subtotal del Ítem (Label 'Total' en la columna Mes de FecProceso)
                indicadores.forEach((ind, indIdx) => {
                    let itTotCells = '';

                    // Columna 3: 'Total' (rowspan="5")
                    if (indIdx === 0) {
                        itTotCells += `
                            <td rowspan="5" class="sticky left-[190px] z-10 bg-slate-100/90 align-top px-3 py-2 font-bold text-slate-800 border-r border-slate-300 text-xs">
                                Total
                            </td>
                        `;
                    }

                    const isBorderBottom = (indIdx === 4) ? 'border-b-2 border-slate-300' : 'border-b border-slate-200';
                    itTotCells += `
                        <td class="sticky left-[300px] z-10 bg-slate-100/90 px-2.5 py-1.5 font-bold text-slate-800 border-r border-slate-300 ${isBorderBottom}">
                            ${ind.l}
                        </td>
                    `;

                    // Celdas por columna dinámica
                    columnas.forEach(col => {
                        const colTot = itColTotales[col.codtra] || {};
                        const rawVal = colTot[ind.k];
                        const valFmt = this.formatCellValue(rawVal, ind);

                        itTotCells += `
                            <td class="cell-esc px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-100/70 border-r border-slate-200 ${isBorderBottom} hover:bg-slate-200/80"
                                data-cliente="${cliName}" data-item="${itCode} Total" data-mes="Total Ítem" data-tra="${col.codtra}" data-indicador="${ind.l}" data-valor="${valFmt}">
                                ${valFmt}
                            </td>
                        `;
                    });

                    // Columna Total general horizontal del Subtotal
                    const rawItTot = itTotales[ind.k];
                    const itTotFmt = this.formatCellValue(rawItTot, ind);

                    itTotCells += `
                        <td class="cell-esc sticky right-0 z-10 px-2.5 py-1.5 text-right font-mono font-extrabold text-slate-950 bg-slate-200/80 border-l-2 border-slate-300 ${isBorderBottom}"
                            data-cliente="${cliName}" data-item="${itCode} Total" data-mes="Total Ítem" data-tra="Total General Ítem" data-indicador="${ind.l}" data-valor="${itTotFmt}">
                            ${itTotFmt}
                        </td>
                    `;

                    tbodyHtml += `<tr class="bg-slate-100/60 hover:bg-slate-200/70 transition-colors">${itTotCells}</tr>`;
                });
            });
        });

        tbody.innerHTML = tbodyHtml;

        // FOOTER TOTAL GENERAL (5 FILAS)
        let tfootHtml = '';
        const footCols = totalGen.columnas || {};
        const footTot = totalGen.totales || {};

        indicadores.forEach((ind, indIdx) => {
            let footCellsHtml = '';

            if (indIdx === 0) {
                footCellsHtml += `
                    <td rowspan="5" colspan="3" class="sticky left-0 z-20 bg-slate-200 px-3 py-2.5 font-bold text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[11px] align-top">
                        Total general
                    </td>
                `;
            }

            footCellsHtml += `
                <td class="sticky left-[300px] z-20 bg-slate-200 px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-300 border-b border-slate-300">
                    ${ind.l}
                </td>
            `;

            columnas.forEach(col => {
                const cVal = footCols[col.codtra] || {};
                const rawVal = cVal[ind.k];
                const valFmt = this.formatCellValue(rawVal, ind);

                footCellsHtml += `
                    <td class="cell-esc px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-300 border-b border-slate-300 bg-slate-100"
                        data-cliente="Total general" data-item="Todos" data-mes="Total general" data-tra="${col.codtra} (${col.descri})" data-indicador="${ind.l}" data-valor="${valFmt}">
                        ${valFmt}
                    </td>
                `;
            });

            const rawAbsVal = footTot[ind.k];
            const absValFmt = this.formatCellValue(rawAbsVal, ind);

            footCellsHtml += `
                <td class="cell-esc sticky right-0 z-20 px-2.5 py-1.5 text-right font-mono font-extrabold text-slate-950 border-l-2 border-slate-400 border-b border-slate-300 bg-slate-300"
                    data-cliente="Total general" data-item="Todos" data-mes="Total general" data-tra="Gran Total Absoluto" data-indicador="${ind.l}" data-valor="${absValFmt}">
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
                    'Cliente': ds.cliente,
                    'Código Ítem': ds.item,
                    'Mes de Proceso': ds.mes,
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
        const ttHeight = 140;
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
window.ChartRegistry['AnalisisMermasEscalable3'] = window.AnalisisMermasEscalable3Chart;
