/**
 * Componente de Gráfico / Dashboard Modular: DashPlacaMerma
 * Módulo: mermaPlaca
 * 
 * Dashboard Integral con 3 Vistas Sincronizadas:
 * 1. Ventas Generales (Matriz de Sale agrupada por Corporativo -> Placa -> Detalle con subtotales y total general en footer).
 * 2. Mermas Generales (Tabla de DmMermas: Zonaorigen -> Cliente -> Placa con Objetivo, Real, Dif, Entrada, Merma y total general en footer).
 * 3. Panorama Almacén General (Matriz pivoteada de Movi_Producción por FecProceso -> CDCliente -> Placa -> CodItem con métricas Cant/Peso/Valor, columnas por transacción y total general en footer).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashPlacaMermaChart = {
    controllerRef: null,
    datosBackend: null,
    multiCorp: null,
    listenersAttached: false,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Asegurar que tooltips flotantes antiguos queden ocultos
        this.hideTooltip();

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

        // Renderizar estructura HTML del Dashboard
        this.renderLayout();

        // Renderizar tablas internas
        this.renderTables();

        // Adjuntar eventos de tooltips interactivos
        this.attachTableTooltips();

        // Adjuntar eventos para botones de exportar a Excel
        this.setupExportListeners();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiCorp) {
            const corps = this.multiCorp.getSelectedValues();
            if (corps.length > 0) {
                filters.corporativo = corps;
            } else {
                filters.corporativo = ['__NINGUNO__'];
            }
        } else {
            // Selección por defecto inicial requerida
            filters.corporativo = [
                'TAPIA GIRALDO HUMBERTO MELECIO',
                'TICONA GUEVARA VANESSA ELSA'
            ];
        }
        return filters;
    },

    setupFilters(opciones = {}) {
        // Asegurar que los otros filtros se mantengan ocultos para este dashboard
        document.getElementById('contenedor-filtro-placa-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-cliente-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-item-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-transaccion-merma')?.classList.add('hidden');

        // 1. Filtro Corporativo únicamente
        const contCorp = document.getElementById('contenedor-filtro-corporativo-merma');
        if (contCorp) contCorp.classList.remove('hidden');

        const corpsDisp = opciones.corporativos || [];
        const defaultSelectedCorps = [
            'TAPIA GIRALDO HUMBERTO MELECIO',
            'TICONA GUEVARA VANESSA ELSA'
        ];

        if (typeof CustomMultiSelect !== 'undefined' && corpsDisp.length > 0) {
            if (!this.multiCorp) {
                const optCorp = corpsDisp.map(c => {
                    const val = String(c).trim();
                    return {
                        id: val,
                        label: val,
                        selected: defaultSelectedCorps.includes(val)
                    };
                });

                // Ordenar: las opciones seleccionadas primero, luego el resto alfabéticamente
                optCorp.sort((a, b) => {
                    if (a.selected && !b.selected) return -1;
                    if (!a.selected && b.selected) return 1;
                    return a.label.localeCompare(b.label);
                });

                this.multiCorp = new CustomMultiSelect({
                    btnId: 'btn-dropdown-corporativo-merma',
                    dropdownId: 'dropdown-corporativo-merma',
                    optionsContainerId: 'container-options-corporativo-merma',
                    labelId: 'label-corporativo-merma',
                    searchId: 'search-corporativo-merma',
                    title: 'Corporativo',
                    options: optCorp
                });
            }
        }
    },

    resetFilters() {
        if (this.multiCorp) {
            const defaultSelectedCorps = [
                'TAPIA GIRALDO HUMBERTO MELECIO',
                'TICONA GUEVARA VANESSA ELSA'
            ];
            this.multiCorp.options.forEach(opt => {
                opt.selected = defaultSelectedCorps.includes(opt.id);
            });
            // Reordenar seleccionados primero
            this.multiCorp.options.sort((a, b) => {
                if (a.selected && !b.selected) return -1;
                if (!a.selected && b.selected) return 1;
                return a.label.localeCompare(b.label);
            });
            this.multiCorp.render();
            this.multiCorp.updateLabel();
        }
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- FILA SUPERIOR: 2 COLUMNAS (Ventas Generales y Mermas Generales) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- 1. VENTAS GENERALES (7/12 cols) -->
                    <div class="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Ventas Generales</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Facturación Detallada</span>
                            </div>
                            <button id="btn-export-excel-ventas-generales" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar bg-white">
                            <table id="tabla-ventas-generales" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40">Corporativo</th>
                                        <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40">Placa</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">FecReg</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">Mín. ttime</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">Máx. ttime</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">CodCliente</th>
                                        <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40">NomCliente</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">tdoc</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">nrodoc</th>
                                        <th class="px-2 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">tcodigo</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Cantidad</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Peso</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Valor</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Peso Prom Venta</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider">Precio Prom Venta</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-ventas-generales" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                                <tfoot id="tfoot-ventas-generales" class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md">
                                    <!-- Total general -->
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- 2. MERMAS GENERALES (5/12 cols) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Mermas Generales</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Indicadores y Desviación</span>
                            </div>
                            <button id="btn-export-excel-mermas-generales" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                    </path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar bg-white">
                            <table id="tabla-mermas-generales" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40">Zonaorigen</th>
                                        <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40">Cliente</th>
                                        <th class="px-2.5 py-2 text-center font-bold tracking-wider border-r border-blue-500/40">Placa</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Objetivo</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Real</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Dif</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider border-r border-blue-500/40">Entrada</th>
                                        <th class="px-2.5 py-2 text-right font-bold tracking-wider">Mermatotal</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-mermas-generales" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                                <tfoot id="tfoot-mermas-generales" class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md">
                                    <!-- Total general -->
                                </tfoot>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- FILA INFERIOR: PANORAMA ALMACÉN GENERAL (12 cols) -->
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                        <div>
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Panorama Almacén General</h2>
                            <span class="text-[11px] text-slate-400 font-medium">Movimientos y Transacciones por Código</span>
                        </div>
                        <button id="btn-export-excel-panorama-almacen" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                                </path>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>
                    <div class="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar bg-white">
                        <table id="tabla-panorama-almacen" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                            <thead id="thead-panorama-almacen" class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                <!-- Dinámico con transacciones -->
                            </thead>
                            <tbody id="tbody-panorama-almacen" class="divide-y divide-slate-100 bg-white">
                                <!-- Dinámico -->
                            </tbody>
                            <tfoot id="tfoot-panorama-almacen" class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md">
                                <!-- Total general -->
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;
    },

    setupExportListeners() {
        document.getElementById('btn-export-excel-ventas-generales')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-ventas-generales', 'Ventas_Generales_PlacaMerma', {
                    nombreHoja: 'Ventas Generales'
                });
            }
        });

        document.getElementById('btn-export-excel-mermas-generales')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-mermas-generales', 'Mermas_Generales_PlacaMerma', {
                    nombreHoja: 'Mermas Generales'
                });
            }
        });

        document.getElementById('btn-export-excel-panorama-almacen')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-panorama-almacen', 'Panorama_Almacen_General', {
                    nombreHoja: 'Panorama Almacen'
                });
            }
        });
    },

    renderTables() {
        this.renderVentasGenerales();
        this.renderMermasGenerales();
        this.renderPanoramaAlmacen();
    },

    /**
     * Renderizado de la tabla Ventas Generales con jerarquía, subtotales y total general en footer
     */
    renderVentasGenerales() {
        const tbody = document.getElementById('tbody-ventas-generales');
        const tfoot = document.getElementById('tfoot-ventas-generales');
        if (!tbody) return;

        const ventasTree = this.datosBackend.ventas_generales || [];
        if (ventasTree.length === 0) {
            tbody.innerHTML = `<tr><td colspan="15" class="py-8 text-center text-slate-400 italic">No hay datos de ventas para el período y filtros seleccionados.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        const formatNum = (val, dec = 2) => {
            if (val === null || val === undefined || isNaN(val)) return '0.00';
            return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };

        let html = '';
        let grandCant = 0;
        let grandPeso = 0;
        let grandValor = 0;

        ventasTree.forEach(corpGroup => {
            const corpName = corpGroup.corporativo || 'SIN CORPORATIVO';
            const placas = corpGroup.placas ? Object.values(corpGroup.placas) : [];
            const totalCorp = corpGroup.total_corp || {};

            grandCant += (totalCorp.cantidad || 0);
            grandPeso += (totalCorp.peso || 0);
            grandValor += (totalCorp.valor || 0);

            // Calcular total de filas que ocupará el corporativo (items de cada placa + 1 subtotal por cada placa)
            let corpRowsCount = 0;
            placas.forEach(p => {
                corpRowsCount += (p.items || []).length + 1;
            });

            let isFirstRowOfCorp = true;

            placas.forEach(placaGroup => {
                const placaName = placaGroup.placa || ' ';
                const items = placaGroup.items || [];
                const totalPlaca = placaGroup.total_placa || {};
                const placaRowsCount = items.length;

                items.forEach((row, idx) => {
                    const isFirstRowOfPlaca = (idx === 0);

                    const tooltipData = encodeURIComponent(JSON.stringify({
                        'Corporativo': corpName,
                        'Placa': placaName,
                        'Fecha Reg': row.fecreg_dmy,
                        'Cliente': `[${row.codcliente}] ${row.nomcliente}`,
                        'Doc': `${row.tdoc}-${row.nrodoc}`,
                        'Item': row.tcodigo,
                        'Cantidad': formatNum(row.cantidad, 0),
                        'Peso (Kg)': formatNum(row.peso, 2),
                        'Valor': `S/ ${formatNum(row.valor, 2)}`,
                        'Peso Prom': formatNum(row.peso_prom_venta, 3),
                        'Precio Prom': `S/ ${formatNum(row.precio_prom_venta, 2)}`
                    }));

                    html += `
                        <tr class="hover:bg-blue-50/40 transition-colors">
                            ${isFirstRowOfCorp ? `<td class="px-2.5 py-1.5 font-bold text-slate-800 border-r border-slate-200 align-top bg-white" rowspan="${corpRowsCount}">${corpName}</td>` : ''}
                            ${isFirstRowOfPlaca ? `<td class="px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-200 align-top bg-slate-50/30" rowspan="${placaRowsCount}">${placaName}</td>` : ''}
                            <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-100">${row.fecreg_dmy || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-500 border-r border-slate-100 font-mono text-[10px]">${row.min_time || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-500 border-r border-slate-100 font-mono text-[10px]">${row.max_time || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-100 font-mono text-[10px]">${row.codcliente || ''}</td>
                            <td class="px-2.5 py-1.5 text-left text-slate-700 font-medium border-r border-slate-100 truncate max-w-[170px]" title="${row.nomcliente || ''}">${row.nomcliente || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-500 border-r border-slate-100 font-mono">${row.tdoc || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-700 font-mono border-r border-slate-100">${row.nrodoc || ''}</td>
                            <td class="px-2 py-1.5 text-center text-slate-800 font-bold border-r border-slate-100">${row.tcodigo || ''}</td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-medium text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipData}">${formatNum(row.cantidad, 0)}</td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-medium text-slate-800 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipData}">${formatNum(row.peso, 2)}</td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-medium text-slate-800 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipData}">S/ ${formatNum(row.valor, 2)}</td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-medium text-slate-600 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipData}">${formatNum(row.peso_prom_venta, 3)}</td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-medium text-slate-600 cursor-default" data-tooltip-fields="${tooltipData}">S/ ${formatNum(row.precio_prom_venta, 2)}</td>
                        </tr>
                    `;
                    isFirstRowOfCorp = false;
                });

                // Subtotal por Placa
                const tooltipSubPlaca = encodeURIComponent(JSON.stringify({
                    'Tipo': `Subtotal Placa [${placaName}]`,
                    'Corporativo': corpName,
                    'Cantidad Total': formatNum(totalPlaca.cantidad, 0),
                    'Peso Total': `${formatNum(totalPlaca.peso, 2)} Kg`,
                    'Valor Total': `S/ ${formatNum(totalPlaca.valor, 2)}`,
                    'Peso Promedio': formatNum(totalPlaca.peso_prom_venta, 3),
                    'Precio Promedio': `S/ ${formatNum(totalPlaca.precio_prom_venta, 2)}`
                }));

                html += `
                    <tr class="bg-slate-100/80 font-semibold text-slate-900 border-t border-b border-slate-200">
                        <td colspan="9" class="px-3 py-1.5 text-left font-bold text-slate-700 tracking-wide border-r border-slate-200">
                            Total ${placaName ? placaName.trim() : ''}
                        </td>
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSubPlaca}">${formatNum(totalPlaca.cantidad, 0)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSubPlaca}">${formatNum(totalPlaca.peso, 2)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSubPlaca}">S/ ${formatNum(totalPlaca.valor, 2)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-700 border-r border-slate-200 cursor-default" data-tooltip-fields="${tooltipSubPlaca}">${formatNum(totalPlaca.peso_prom_venta, 3)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-700 cursor-default" data-tooltip-fields="${tooltipSubPlaca}">S/ ${formatNum(totalPlaca.precio_prom_venta, 2)}</td>
                    </tr>
                `;
            });

            // Subtotal por Corporativo
            const tooltipSubCorp = encodeURIComponent(JSON.stringify({
                'Tipo': `Total Corporativo [${corpName}]`,
                'Cantidad Total': formatNum(totalCorp.cantidad, 0),
                'Peso Total': `${formatNum(totalCorp.peso, 2)} Kg`,
                'Valor Total': `S/ ${formatNum(totalCorp.valor, 2)}`,
                'Peso Promedio': formatNum(totalCorp.peso_prom_venta, 3),
                'Precio Promedio': `S/ ${formatNum(totalCorp.precio_prom_venta, 2)}`
            }));

            html += `
                <tr class="bg-blue-50/90 font-bold text-blue-950 border-t-2 border-b-2 border-blue-300">
                    <td colspan="10" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-200">
                        Total ${corpName}
                    </td>
                    <td class="px-2.5 py-2 text-right font-mono font-extrabold border-r border-blue-200 cursor-default" data-tooltip-fields="${tooltipSubCorp}">${formatNum(totalCorp.cantidad, 0)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-extrabold border-r border-blue-200 cursor-default" data-tooltip-fields="${tooltipSubCorp}">${formatNum(totalCorp.peso, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-extrabold border-r border-blue-200 cursor-default" data-tooltip-fields="${tooltipSubCorp}">S/ ${formatNum(totalCorp.valor, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-extrabold border-r border-blue-200 cursor-default" data-tooltip-fields="${tooltipSubCorp}">${formatNum(totalCorp.peso_prom_venta, 3)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-extrabold cursor-default" data-tooltip-fields="${tooltipSubCorp}">S/ ${formatNum(totalCorp.precio_prom_venta, 2)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Renderizar Total General en Footer
        if (tfoot) {
            const grandPesoProm = Math.abs(grandCant) > 0.0001 ? (grandPeso / grandCant) : 0.0;
            const grandPrecioProm = Math.abs(grandPeso) > 0.0001 ? (grandValor / grandPeso) : 0.0;

            const tooltipGrand = encodeURIComponent(JSON.stringify({
                'Tipo': 'Total General Ventas',
                'Cantidad Total': formatNum(grandCant, 0),
                'Peso Total': `${formatNum(grandPeso, 2)} Kg`,
                'Valor Total': `S/ ${formatNum(grandValor, 2)}`,
                'Peso Prom General': formatNum(grandPesoProm, 3),
                'Precio Prom General': `S/ ${formatNum(grandPrecioProm, 2)}`
            }));

            tfoot.innerHTML = `
                <tr>
                    <td colspan="10" class="px-3 py-2 text-left uppercase tracking-wider border-r border-blue-600">Total general</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrand}">${formatNum(grandCant, 0)}</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrand}">${formatNum(grandPeso, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrand}">S/ ${formatNum(grandValor, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipGrand}">${formatNum(grandPesoProm, 3)}</td>
                    <td class="px-2.5 py-2 text-right font-mono cursor-default" data-tooltip-fields="${tooltipGrand}">S/ ${formatNum(grandPrecioProm, 2)}</td>
                </tr>
            `;
        }
    },

    /**
     * Renderizado de la tabla Mermas Generales con agrupación y total general en footer
     */
    renderMermasGenerales() {
        const tbody = document.getElementById('tbody-mermas-generales');
        const tfoot = document.getElementById('tfoot-mermas-generales');
        if (!tbody) return;

        const mermasList = this.datosBackend.mermas_generales || [];
        if (mermasList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 italic">No hay datos de mermas para el período y filtros seleccionados.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        const formatNum = (val, dec = 2) => {
            if (val === null || val === undefined || isNaN(val)) return '0.00';
            return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };

        // Estructurar árbol para cálculo de rowspan de zonaorigen y cliente
        const zonaTree = {};
        let totEntrada = 0;
        let totMerma = 0;
        let sumObj = 0;
        let countRows = 0;

        mermasList.forEach(row => {
            const z = row.zonaorigen || ' ';
            const c = row.cliente || ' ';
            if (!zonaTree[z]) zonaTree[z] = { totalRows: 0, clientes: {} };
            if (!zonaTree[z].clientes[c]) zonaTree[z].clientes[c] = [];
            zonaTree[z].clientes[c].push(row);
            zonaTree[z].totalRows++;

            totEntrada += (row.entrada || 0);
            totMerma += (row.mermatotal || 0);
            sumObj += (row.objetivo || 0);
            countRows++;
        });

        let html = '';

        Object.keys(zonaTree).forEach(zKey => {
            const zData = zonaTree[zKey];
            let isFirstRowOfZona = true;

            Object.keys(zData.clientes).forEach(cKey => {
                const cRows = zData.clientes[cKey];
                const cliRowsCount = cRows.length;

                cRows.forEach((row, idx) => {
                    const isFirstRowOfCli = (idx === 0);

                    const hasReal = row.real !== null && row.real !== undefined;
                    const hasDif = row.dif !== null && row.dif !== undefined;

                    const objVal = Number(row.objetivo || 0);
                    const realVal = hasReal ? Number(row.real) : null;
                    const difVal = hasDif ? Number(row.dif) : null;

                    const isMermaHigh = difVal !== null && difVal > 0;
                    const difClass = difVal === null ? 'text-slate-400' : (isMermaHigh ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold');
                    const realClass = realVal === null ? 'text-slate-400' : (isMermaHigh ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold');

                    const difStr = difVal === null ? '-' : (difVal > 0 ? `+${formatNum(difVal, 2)}%` : `${formatNum(difVal, 2)}%`);
                    const realStr = realVal === null ? '-' : `${formatNum(realVal, 2)}%`;
                    const objStr = `${formatNum(objVal, 2)}%`;

                    const tooltipMerma = encodeURIComponent(JSON.stringify({
                        'Zona Origen': zKey,
                        'Cliente': cKey,
                        'Placa': row.placa || 'SIN PLACA',
                        'Objetivo': objStr,
                        'Real': realStr,
                        'Desviación (Dif)': difStr,
                        'Entrada': `${formatNum(row.entrada, 2)} Kg`,
                        'Merma Total': `${formatNum(row.mermatotal, 2)} Kg`
                    }));

                    html += `
                        <tr class="hover:bg-blue-50/40 transition-colors">
                            ${isFirstRowOfZona ? `<td class="px-2.5 py-2 font-bold text-slate-800 border-r border-slate-200 align-top bg-white" rowspan="${zData.totalRows}">${zKey}</td>` : ''}
                            ${isFirstRowOfCli ? `<td class="px-2.5 py-2 font-semibold text-slate-700 border-r border-slate-200 align-top bg-white truncate max-w-[130px]" title="${cKey}" rowspan="${cliRowsCount}">${cKey}</td>` : ''}
                            <td class="px-2.5 py-2 text-center font-bold text-slate-900 border-r border-slate-100 bg-slate-50/40">${row.placa || ''}</td>
                            <td class="px-2.5 py-2 text-right font-mono font-medium text-slate-600 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipMerma}">${objStr}</td>
                            <td class="px-2.5 py-2 text-right font-mono ${realClass} border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipMerma}">${realStr}</td>
                            <td class="px-2.5 py-2 text-right font-mono ${difClass} border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipMerma}">${difStr}</td>
                            <td class="px-2.5 py-2 text-right font-mono font-medium text-slate-800 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipMerma}">${formatNum(row.entrada, 2)}</td>
                            <td class="px-2.5 py-2 text-right font-mono font-medium text-slate-800 cursor-default" data-tooltip-fields="${tooltipMerma}">${formatNum(row.mermatotal, 2)}</td>
                        </tr>
                    `;

                    isFirstRowOfZona = false;
                });
            });
        });

        tbody.innerHTML = html;

        // Renderizar Total General en Footer
        if (tfoot) {
            const totObj = countRows > 0 ? (sumObj / countRows) : 0.0;
            const totReal = totEntrada > 0 ? ((totMerma / totEntrada) * 100) : 0.0;
            const totDif = totReal - totObj;

            const tooltipTotMermas = encodeURIComponent(JSON.stringify({
                'Tipo': 'Total General Mermas',
                'Objetivo Promedio': `${formatNum(totObj, 2)}%`,
                'Real General': `${formatNum(totReal, 2)}%`,
                'Desviación Total': `${totDif > 0 ? '+' : ''}${formatNum(totDif, 2)}%`,
                'Entrada Total': `${formatNum(totEntrada, 2)} Kg`,
                'Merma Total': `${formatNum(totMerma, 2)} Kg`
            }));

            tfoot.innerHTML = `
                <tr>
                    <td colspan="3" class="px-3 py-2 text-left uppercase tracking-wider border-r border-blue-600">Total general</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotMermas}">${formatNum(totObj, 2)}%</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 ${totDif > 0 ? 'text-red-200' : 'text-emerald-200'} cursor-default" data-tooltip-fields="${tooltipTotMermas}">${formatNum(totReal, 2)}%</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 ${totDif > 0 ? 'text-red-200' : 'text-emerald-200'} cursor-default" data-tooltip-fields="${tooltipTotMermas}">${totDif > 0 ? '+' : ''}${formatNum(totDif, 2)}%</td>
                    <td class="px-2.5 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipTotMermas}">${formatNum(totEntrada, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono cursor-default" data-tooltip-fields="${tooltipTotMermas}">${formatNum(totMerma, 2)}</td>
                </tr>
            `;
        }
    },

    /**
     * Renderizado de la matriz pivot Panorama Almacén General con total general en footer
     */
    renderPanoramaAlmacen() {
        const thead = document.getElementById('thead-panorama-almacen');
        const tbody = document.getElementById('tbody-panorama-almacen');
        const tfoot = document.getElementById('tfoot-panorama-almacen');
        if (!thead || !tbody) return;

        const transCols = this.datosBackend.transacciones_columnas || [
            'E100', 'S209', 'E209', 'S201', 'S409', 'E409', 'S400', 'E400',
            'S110', 'E110', 'S700', 'E700', 'S800', 'S801', 'S803', 'S804',
            'E806', 'S806', 'S810', 'S823'
        ];
        const panoramaRows = this.datosBackend.panorama_almacen || [];

        // Generar encabezados de tabla con transacciones
        let headHtml = `
            <tr>
                <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 min-w-[80px]">FecProceso</th>
                <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 min-w-[90px]">CDCliente</th>
                <th class="px-2.5 py-2 text-center font-bold tracking-wider border-r border-blue-500/40 min-w-[80px]">Placa</th>
                <th class="px-2.5 py-2 text-center font-bold tracking-wider border-r border-blue-500/40 min-w-[60px]">CodItem</th>
                <th class="px-2.5 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 min-w-[60px]">Métricas</th>
        `;

        transCols.forEach(col => {
            headHtml += `<th class="px-2 py-2 text-right font-bold tracking-wider border-r border-blue-500/40 min-w-[70px]">${col}</th>`;
        });

        headHtml += `<th class="px-3 py-2 text-right font-extrabold tracking-wider min-w-[85px] bg-blue-700/50">Total general</th></tr>`;
        thead.innerHTML = headHtml;

        if (panoramaRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${5 + transCols.length + 1}" class="py-8 text-center text-slate-400 italic">No hay movimientos de almacén para el período y filtros seleccionados.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        const formatNum = (val, dec = 2, emptyIfZero = true) => {
            if (val === null || val === undefined || isNaN(val) || (emptyIfZero && Math.abs(val) < 0.0001)) {
                return '';
            }
            return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
        };

        let bodyHtml = '';
        const metricasOrden = ['Cant', 'Peso', 'Valor'];

        // Acumuladores para Footer Grand Totals
        const grandTotals = {
            'Cant': { valores: {}, total: 0 },
            'Peso': { valores: {}, total: 0 },
            'Valor': { valores: {}, total: 0 }
        };

        panoramaRows.forEach(itemGroup => {
            const fec = itemGroup.fecha || '';
            const cli = itemGroup.cdcliente || '';
            const plc = itemGroup.placa || '';
            const cod = itemGroup.coditem || '';
            const metricas = itemGroup.metricas || {};

            metricasOrden.forEach((met, mIdx) => {
                const metData = metricas[met] || { valores: {}, total: 0 };
                const vals = metData.valores || {};
                const tot = metData.total || 0;
                const dec = met === 'Cant' ? 0 : 2;

                grandTotals[met].total += tot;

                const isFirstRow = mIdx === 0;
                const isLastRow = mIdx === metricasOrden.length - 1;
                const rowBorderClass = isLastRow ? 'border-b-2 border-slate-200' : 'border-b border-slate-100';

                bodyHtml += `
                    <tr class="hover:bg-blue-50/40 transition-colors ${rowBorderClass}">
                        ${isFirstRow ? `<td class="px-2.5 py-1.5 text-center font-semibold text-slate-700 border-r border-slate-200 align-top bg-white" rowspan="3">${fec}</td>` : ''}
                        ${isFirstRow ? `<td class="px-2.5 py-1.5 text-left font-bold text-slate-800 border-r border-slate-200 align-top bg-white" rowspan="3">${cli}</td>` : ''}
                        ${isFirstRow ? `<td class="px-2.5 py-1.5 text-center font-bold text-slate-900 border-r border-slate-200 align-top bg-white" rowspan="3">${plc}</td>` : ''}
                        ${isFirstRow ? `<td class="px-2.5 py-1.5 text-center font-bold text-slate-800 border-r border-slate-200 align-top bg-white" rowspan="3">${cod}</td>` : ''}
                        
                        <td class="px-2.5 py-1 text-left font-bold text-slate-600 border-r border-slate-200 bg-slate-50/50">${met}</td>
                `;

                transCols.forEach(col => {
                    const cellVal = vals[col] ?? 0;
                    grandTotals[met].valores[col] = (grandTotals[met].valores[col] || 0) + cellVal;
                    const formatted = formatNum(cellVal, dec, true);

                    const tooltipCell = encodeURIComponent(JSON.stringify({
                        'Fecha': fec,
                        'Cliente': cli,
                        'Placa': plc,
                        'Item': cod,
                        'Métrica': met,
                        'Transacción': col,
                        'Valor': formatted || '0.00'
                    }));

                    bodyHtml += `<td class="px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tooltipCell}">${formatted}</td>`;
                });

                const formattedTot = formatNum(tot, dec, false);
                const tooltipRowTot = encodeURIComponent(JSON.stringify({
                    'Fecha': fec,
                    'Cliente': cli,
                    'Placa': plc,
                    'Item': cod,
                    'Métrica': met,
                    'Total Fila': formattedTot
                }));

                bodyHtml += `<td class="px-3 py-1 text-right font-mono font-bold text-slate-900 bg-slate-100/60 cursor-default" data-tooltip-fields="${tooltipRowTot}">${formattedTot}</td></tr>`;
            });
        });

        tbody.innerHTML = bodyHtml;

        // Renderizar Total General en Footer para Panorama Almacén (3 filas)
        if (tfoot) {
            let footHtml = '';
            metricasOrden.forEach((met, mIdx) => {
                const dec = met === 'Cant' ? 0 : 2;
                const isFirst = mIdx === 0;
                const isLast = mIdx === metricasOrden.length - 1;
                const borderClass = isLast ? '' : 'border-b border-blue-600';

                footHtml += `
                    <tr class="${borderClass}">
                        ${isFirst ? `<td colspan="4" class="px-3 py-1.5 text-left uppercase tracking-wider border-r border-blue-600 align-middle font-extrabold" rowspan="3">Total general</td>` : ''}
                        <td class="px-2.5 py-1 text-left font-bold border-r border-blue-600 bg-blue-800/40">${met}</td>
                `;

                transCols.forEach(col => {
                    const cVal = grandTotals[met].valores[col] || 0;
                    const formatted = formatNum(cVal, dec, true);

                    const tooltipFootCell = encodeURIComponent(JSON.stringify({
                        'Tipo': 'Total General Transacción',
                        'Métrica': met,
                        'Transacción': col,
                        'Total': formatted || '0.00'
                    }));

                    footHtml += `<td class="px-2 py-1 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${tooltipFootCell}">${formatted}</td>`;
                });

                const fTot = formatNum(grandTotals[met].total || 0, dec, false);
                const tooltipFootTot = encodeURIComponent(JSON.stringify({
                    'Tipo': 'Total General Consolidado',
                    'Métrica': met,
                    'Total Final': fTot
                }));

                footHtml += `<td class="px-3 py-1 text-right font-mono font-extrabold bg-blue-900/60 cursor-default" data-tooltip-fields="${tooltipFootTot}">${fTot}</td></tr>`;
            });

            tfoot.innerHTML = footHtml;
        }
    },

    /**
     * Delegación de eventos para Tooltips flotantes contextuales en tablas
     */
    attachTableTooltips() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica || this.listenersAttached) return;

        this.listenersAttached = true;

        contenedorGrafica.addEventListener('mouseover', (e) => {
            const cell = e.target.closest('[data-tooltip-fields]');
            if (cell) {
                try {
                    const raw = cell.getAttribute('data-tooltip-fields');
                    if (raw) {
                        const data = JSON.parse(decodeURIComponent(raw));
                        this.showTooltip(e, data);
                    }
                } catch (err) {
                    console.warn('Error al parsear tooltip:', err);
                }
            }
        });

        contenedorGrafica.addEventListener('mousemove', (e) => {
            const cell = e.target.closest('[data-tooltip-fields]');
            if (cell) {
                this.updateTooltipPosition(e);
            }
        });

        contenedorGrafica.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });

        document.addEventListener('scroll', () => {
            this.hideTooltip();
        }, true);
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
        tt.style.display = 'block';
        this.updateTooltipPosition(e);
    },

    updateTooltipPosition(e) {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt || tt.classList.contains('hidden')) return;

        const ttWidth = tt.offsetWidth || 260;
        const ttHeight = tt.offsetHeight || 140;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let finalX = e.clientX + 16;
        let finalY = e.clientY + 16;

        if (finalX + ttWidth > winWidth - 10) {
            finalX = e.clientX - ttWidth - 16;
        }
        if (finalY + ttHeight > winHeight - 10) {
            finalY = e.clientY - ttHeight - 16;
        }

        tt.style.left = '0px';
        tt.style.top = '0px';
        tt.style.transform = `translate3d(${Math.max(10, finalX)}px, ${Math.max(10, finalY)}px, 0)`;
    },

    hideTooltip() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) {
            tt.classList.add('hidden');
            tt.style.display = 'none';
        }
    },

    destroy() {
        this.hideTooltip();
        this.listenersAttached = false;
    }
};

window.ChartRegistry['DashPlacaMerma'] = window.DashPlacaMermaChart;
