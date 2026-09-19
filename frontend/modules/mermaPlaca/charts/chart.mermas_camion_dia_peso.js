/**
 * Componente de Gráfico / Dashboard Modular: MermasCamionDiaPeso
 * Módulo: mermaPlaca
 * 
 * Tabla Matriz Exacta de Liquidación de Placas Pesos (Tableau):
 * - Agrupación por Fecha (FecProceso) con rowspan.
 * - Agrupación por Cliente (CDCliente) con rowspan (incluye subtotal Total).
 * - Agrupación por Placa con rowspan para múltiples ítems.
 * - Fila de Subtotal por Cliente ('Total') con porcentaje consolidado.
 * - Cabeceras bg-blue-600, columnas fijas (sticky), tooltips ultra rápidos y exportación a Excel nativa.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.MermasCamionDiaPesoChart = {
    controllerRef: null,
    datosBackend: null,
    multiPlaca: null,
    multiCliente: null,
    multiItem: null,
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
                const optItem = itemsDisp.map(it => {
                    const sIt = String(it).trim();
                    const isDefault = ['100', '103', '107'].includes(sIt);
                    return {
                        id: sIt,
                        label: sIt,
                        selected: isDefault
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
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- TARJETA PRINCIPAL: LIQUIDACION DE PLACAS PESOS -->
                <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Liquidacion de Placas Pesos (MermasCamionDiaPeso)</h3>
                                <p class="text-[11px] text-slate-500">Liquidación diaria de mermas por camión y cliente en peso (kg) y valorización (S/)</p>
                            </div>
                        </div>

                        <!-- BOTÓN EXPORTAR A EXCEL -->
                        <div class="flex items-center gap-2">
                            <button id="btn-export-mermas-camion" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- CONTENEDOR DE LA TABLA MATRIZ -->
                    <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                        <table id="tabla-mermas-camion-dia" class="w-full text-xs border-collapse table-auto select-none">
                            <thead id="thead-mermas-camion-dia" class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 font-bold shadow-xs select-none">
                                <tr>
                                    <th class="sticky left-0 z-30 bg-blue-600 px-3 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[95px]">FecProceso</th>
                                    <th class="sticky left-[95px] z-30 bg-blue-600 px-2.5 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[120px]">CDCliente</th>
                                    <th class="sticky left-[215px] z-30 bg-blue-600 px-2.5 py-2.5 text-center border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[90px]">Placa</th>
                                    <th class="sticky left-[305px] z-30 bg-blue-600 px-2 py-2.5 text-center border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[65px]">CodItem</th>
                                    
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[95px]">%MermaPeso</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[110px]">E100Entrada</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[100px]">S8XXMerma</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[105px]">S800Transporte</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[105px]">S801Almacenaje</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[95px]">S803NoApto</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[95px]">S804Muerto</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[110px]">S809BeneficioM..</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[110px]">S810BeneficioM..</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[105px]">S823Distribucion</th>
                                    
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[125px]">E100ValEntrada</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[115px]">S8XXValMerma</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[120px]">S800ValTranspo..</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[115px]">S801ValAlmacen..</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[105px]">S803ValNoApto</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[105px]">S804ValMuerto</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[115px]">S809ValBenefici..</th>
                                    <th class="px-3 py-2.5 text-right border-r border-blue-500 bg-blue-600 font-bold text-[11px] min-w-[115px]">S810ValBenefici..</th>
                                    <th class="px-3 py-2.5 text-right bg-blue-600 font-bold text-[11px] min-w-[115px]">S823ValDistribu..</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-mermas-camion-dia" class="divide-y divide-slate-100 bg-white"></tbody>
                            <tfoot id="tfoot-mermas-camion-dia" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Evento botón Excel
        const btnExport = document.getElementById('btn-export-mermas-camion');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-mermas-camion-dia', 'Liquidacion_Placas_Pesos');
                }
            };
        }
    },

    renderTabla() {
        const tbody = document.getElementById('tbody-mermas-camion-dia');
        const tfoot = document.getElementById('tfoot-mermas-camion-dia');
        if (!tbody || !tfoot) return;

        const data = this.datosBackend || {};
        const fechas = data.fechas || [];
        const totalGen = data.total_general || {};

        if (fechas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="23" class="py-10 text-center text-slate-400 italic">
                        No se encontraron registros para el rango de fechas y filtros seleccionados
                    </td>
                </tr>
            `;
            tfoot.innerHTML = '';
            return;
        }

        const pesosKeys = [
            { k: 'e100_entrada', l: 'E100Entrada' },
            { k: 's8xx_merma', l: 'S8XXMerma' },
            { k: 's800_transporte', l: 'S800Transporte' },
            { k: 's801_almacenaje', l: 'S801Almacenaje' },
            { k: 's803_no_apto', l: 'S803NoApto' },
            { k: 's804_muerto', l: 'S804Muerto' },
            { k: 's809_beneficio_m', l: 'S809BeneficioM..' },
            { k: 's810_beneficio_m', l: 'S810BeneficioM..' },
            { k: 's823_distribucion', l: 'S823Distribucion' }
        ];

        const valoresKeys = [
            { k: 'e100_val_entrada', l: 'E100ValEntrada' },
            { k: 's8xx_val_merma', l: 'S8XXValMerma' },
            { k: 's800_val_transpo', l: 'S800ValTranspo..' },
            { k: 's801_val_almacen', l: 'S801ValAlmacen..' },
            { k: 's803_val_no_apto', l: 'S803ValNoApto' },
            { k: 's804_val_muerto', l: 'S804ValMuerto' },
            { k: 's809_val_benefici', l: 'S809ValBenefici..' },
            { k: 's810_val_benefici', l: 'S810ValBenefici..' },
            { k: 's823_val_distribu', l: 'S823ValDistribu..' }
        ];

        let tbodyHtml = '';

        fechas.forEach(fecObj => {
            // Calcular el total de filas que ocupa toda la fecha (filas de items + 1 subtotal por cada cliente)
            let totalFilasFecha = 0;
            fecObj.clientes.forEach(cliObj => {
                let filasCli = 0;
                cliObj.placas.forEach(plcObj => {
                    filasCli += plcObj.items.length;
                });
                totalFilasFecha += filasCli + 1; // +1 por la fila de subtotal 'Total'
            });

            let fechaFirstPrinted = false;

            fecObj.clientes.forEach(cliObj => {
                // Calcular total de filas del cliente (ítems + 1 subtotal)
                let filasClienteTotal = 1; // +1 por subtotal
                cliObj.placas.forEach(plcObj => {
                    filasClienteTotal += plcObj.items.length;
                });

                let clienteFirstPrinted = false;

                cliObj.placas.forEach(plcObj => {
                    const itemsPlaca = plcObj.items || [];
                    const placaRowCount = itemsPlaca.length;

                    itemsPlaca.forEach((item, itemIdx) => {
                        let cellsHtml = '';

                        // 1. Columna Fecha (rowspan)
                        if (!fechaFirstPrinted) {
                            cellsHtml += `
                                <td rowspan="${totalFilasFecha}" class="sticky left-0 z-10 bg-white align-top px-3 py-2.5 font-bold text-slate-800 border-r border-slate-200 shadow-2xs font-mono">
                                    ${fecObj.fecha_fmt || fecObj.fecha}
                                </td>
                            `;
                            fechaFirstPrinted = true;
                        }

                        // 2. Columna Cliente (rowspan)
                        if (!clienteFirstPrinted) {
                            cellsHtml += `
                                <td rowspan="${filasClienteTotal}" class="sticky left-[95px] z-10 bg-white align-top px-2.5 py-2.5 font-bold text-slate-800 border-r border-slate-200 shadow-2xs">
                                    ${cliObj.cdcliente}
                                </td>
                            `;
                            clienteFirstPrinted = true;
                        }

                        // 3. Columna Placa (rowspan por ítems de la placa)
                        if (itemIdx === 0) {
                            cellsHtml += `
                                <td rowspan="${placaRowCount}" class="sticky left-[215px] z-10 bg-white align-top px-2.5 py-2 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                                    ${plcObj.placa || ''}
                                </td>
                            `;
                        }

                        // 4. Columna CodItem
                        cellsHtml += `
                            <td class="sticky left-[305px] z-10 bg-white group-hover:bg-slate-50 px-2 py-2 text-center font-mono font-bold text-blue-700 border-r border-slate-300">
                                ${item.coditem}
                            </td>
                        `;

                        // 5. Columna %MermaPeso
                        const porcFmt = (item.porc_merma_peso !== null && item.porc_merma_peso !== undefined) 
                            ? this.formatNum(item.porc_merma_peso, 2) + '%' 
                            : '';
                        cellsHtml += `
                            <td class="cell-mcp px-3 py-2 text-right font-mono font-semibold text-slate-800 border-r border-slate-100 hover:bg-blue-50/60"
                                data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="${plcObj.placa}" data-item="${item.coditem}" data-metrica="%MermaPeso" data-valor="${porcFmt}">
                                ${porcFmt}
                            </td>
                        `;

                        // 6. Columnas de Peso
                        pesosKeys.forEach(pk => {
                            const val = item[pk.k];
                            const valFmt = this.formatNum(val, 2);
                            cellsHtml += `
                                <td class="cell-mcp px-3 py-2 text-right font-mono text-slate-700 border-r border-slate-100 hover:bg-blue-50/60"
                                    data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="${plcObj.placa}" data-item="${item.coditem}" data-metrica="${pk.l}" data-valor="${valFmt}">
                                    ${valFmt}
                                </td>
                            `;
                        });

                        // 7. Columnas de Valor
                        valoresKeys.forEach((vk, vIdx) => {
                            const isLast = (vIdx === valoresKeys.length - 1);
                            const val = item[vk.k];
                            const valFmt = 'S/ ' + this.formatNum(val, 2);
                            const borderR = isLast ? '' : 'border-r border-slate-100';
                            cellsHtml += `
                                <td class="cell-mcp px-3 py-2 text-right font-mono text-slate-800 ${borderR} hover:bg-blue-50/60"
                                    data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="${plcObj.placa}" data-item="${item.coditem}" data-metrica="${vk.l}" data-valor="${valFmt}">
                                    ${valFmt}
                                </td>
                            `;
                        });

                        tbodyHtml += `<tr class="group hover:bg-slate-50/80 transition-colors">${cellsHtml}</tr>`;
                    });
                });

                // 8. FILA DE SUBTOTAL DEL CLIENTE ('Total')
                const sub = cliObj.subtotal || {};
                const subPorcFmt = this.formatNum(sub.porc_merma_peso, 2) + '%';
                let subCellsHtml = '';

                // Columna Placa (vacía)
                subCellsHtml += `
                    <td class="sticky left-[215px] z-10 bg-slate-50/90 px-2.5 py-2 text-center border-r border-slate-200"></td>
                `;

                // Columna CodItem ('Total')
                subCellsHtml += `
                    <td class="sticky left-[305px] z-10 bg-slate-50/90 px-2 py-2 text-center font-bold text-slate-800 border-r border-slate-300">
                        Total
                    </td>
                `;

                // %MermaPeso subtotal
                subCellsHtml += `
                    <td class="cell-mcp px-3 py-2 text-right font-mono font-bold text-blue-900 bg-slate-50/90 border-r border-slate-200"
                        data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="TOTAL" data-item="TOTAL" data-metrica="%MermaPeso" data-valor="${subPorcFmt}">
                        ${subPorcFmt}
                    </td>
                `;

                // Pesos subtotal
                pesosKeys.forEach(pk => {
                    const val = sub[pk.k];
                    const valFmt = this.formatNum(val, 2);
                    subCellsHtml += `
                        <td class="cell-mcp px-3 py-2 text-right font-mono font-bold text-slate-900 bg-slate-50/90 border-r border-slate-200"
                            data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="TOTAL" data-item="TOTAL" data-metrica="${pk.l}" data-valor="${valFmt}">
                            ${valFmt}
                        </td>
                    `;
                });

                // Valores subtotal
                valoresKeys.forEach((vk, vIdx) => {
                    const isLast = (vIdx === valoresKeys.length - 1);
                    const val = sub[vk.k];
                    const valFmt = 'S/ ' + this.formatNum(val, 2);
                    const borderR = isLast ? '' : 'border-r border-slate-200';
                    subCellsHtml += `
                        <td class="cell-mcp px-3 py-2 text-right font-mono font-bold text-slate-900 bg-slate-50/90 ${borderR}"
                            data-fecha="${fecObj.fecha}" data-cliente="${cliObj.cdcliente}" data-placa="TOTAL" data-item="TOTAL" data-metrica="${vk.l}" data-valor="${valFmt}">
                            ${valFmt}
                        </td>
                    `;
                });

                tbodyHtml += `<tr class="bg-slate-50/90 font-bold border-b border-slate-200 hover:bg-slate-100/90 transition-colors">${subCellsHtml}</tr>`;
            });
        });

        tbody.innerHTML = tbodyHtml;

        // FOOTER TOTAL GENERAL
        let tfootHtml = `
            <tr>
                <td colspan="4" class="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 font-bold text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[11px]">
                    Total general
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-blue-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="%MermaPeso" data-valor="${this.formatNum(totalGen.porc_merma_peso, 2)}%">
                    ${this.formatNum(totalGen.porc_merma_peso, 2)}%
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="E100Entrada" data-valor="${this.formatNum(totalGen.e100_entrada, 2)}">
                    ${this.formatNum(totalGen.e100_entrada, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S8XXMerma" data-valor="${this.formatNum(totalGen.s8xx_merma, 2)}">
                    ${this.formatNum(totalGen.s8xx_merma, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S800Transporte" data-valor="${this.formatNum(totalGen.s800_transporte, 2)}">
                    ${this.formatNum(totalGen.s800_transporte, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S801Almacenaje" data-valor="${this.formatNum(totalGen.s801_almacenaje, 2)}">
                    ${this.formatNum(totalGen.s801_almacenaje, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S803NoApto" data-valor="${this.formatNum(totalGen.s803_no_apto, 2)}">
                    ${this.formatNum(totalGen.s803_no_apto, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S804Muerto" data-valor="${this.formatNum(totalGen.s804_muerto, 2)}">
                    ${this.formatNum(totalGen.s804_muerto, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S809BeneficioM.." data-valor="${this.formatNum(totalGen.s809_beneficio_m, 2)}">
                    ${this.formatNum(totalGen.s809_beneficio_m, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S810BeneficioM.." data-valor="${this.formatNum(totalGen.s810_beneficio_m, 2)}">
                    ${this.formatNum(totalGen.s810_beneficio_m, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S823Distribucion" data-valor="${this.formatNum(totalGen.s823_distribucion, 2)}">
                    ${this.formatNum(totalGen.s823_distribucion, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="E100ValEntrada" data-valor="S/ ${this.formatNum(totalGen.e100_val_entrada, 2)}">
                    S/ ${this.formatNum(totalGen.e100_val_entrada, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S8XXValMerma" data-valor="S/ ${this.formatNum(totalGen.s8xx_val_merma, 2)}">
                    S/ ${this.formatNum(totalGen.s8xx_val_merma, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S800ValTranspo.." data-valor="S/ ${this.formatNum(totalGen.s800_val_transpo, 2)}">
                    S/ ${this.formatNum(totalGen.s800_val_transpo, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S801ValAlmacen.." data-valor="S/ ${this.formatNum(totalGen.s801_val_almacen, 2)}">
                    S/ ${this.formatNum(totalGen.s801_val_almacen, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S803ValNoApto" data-valor="S/ ${this.formatNum(totalGen.s803_val_no_apto, 2)}">
                    S/ ${this.formatNum(totalGen.s803_val_no_apto, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S804ValMuerto" data-valor="S/ ${this.formatNum(totalGen.s804_val_muerto, 2)}">
                    S/ ${this.formatNum(totalGen.s804_val_muerto, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S809ValBenefici.." data-valor="S/ ${this.formatNum(totalGen.s809_val_benefici, 2)}">
                    S/ ${this.formatNum(totalGen.s809_val_benefici, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S810ValBenefici.." data-valor="S/ ${this.formatNum(totalGen.s810_val_benefici, 2)}">
                    S/ ${this.formatNum(totalGen.s810_val_benefici, 2)}
                </td>
                <td class="cell-mcp px-3 py-2.5 text-right font-mono font-bold text-slate-900"
                    data-fecha="Total general" data-cliente="TODOS" data-placa="TODAS" data-item="TODOS" data-metrica="S823ValDistribu.." data-valor="S/ ${this.formatNum(totalGen.s823_val_distribu, 2)}">
                    S/ ${this.formatNum(totalGen.s823_val_distribu, 2)}
                </td>
            </tr>
        `;

        tfoot.innerHTML = tfootHtml;
    },

    bindEventsDelegation() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.addEventListener('pointerover', (e) => {
            const cell = e.target.closest('.cell-mcp');
            if (cell && cell !== this.currentCell) {
                this.currentCell = cell;
                const ds = cell.dataset;

                this.showTooltip(e, {
                    'Fecha de Proceso': ds.fecha,
                    'Cliente': ds.cliente,
                    'Placa': ds.placa,
                    'Código Item': ds.item,
                    'Métrica': ds.metrica,
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
            const cell = e.target.closest('.cell-mcp');
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
window.ChartRegistry['MermasCamionDiaPeso'] = window.MermasCamionDiaPesoChart;
