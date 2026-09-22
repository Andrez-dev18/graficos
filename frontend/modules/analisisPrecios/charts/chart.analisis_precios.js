/**
 * Componente de Gráfico / Vista: AnalisisPrecios
 * Módulo: analisisPrecios
 * 
 * Renderiza la tabla detallada de Análisis de Precios con filtros Tableau relevantes:
 * (TDOC, LINEA VENTA, CORPORATIVO, NOMCLIENTE, PROVINCIA, ZONA),
 * con actualización en cascada de opciones relevantes y preselección idéntica a Tableau:
 * Provincia='AREQUIPA', Zona='ZONA CONO NORTE'.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.AnalisisPreciosChart = {
    controllerRef: null,
    datosBackend: null,
    multiTdoc: null,
    multiLinea: null,
    multiCorporativo: null,
    multiCliente: null,
    multiProvincia: null,
    multiZona: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        this.hideTooltip();

        // Configurar y poblar dropdowns de filtros dinámicos si existen opciones
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // Asegurar que contenedores de gráficos clásicos no interfieran
        const cardDetalle = document.getElementById('card-tabla-metricas');
        if (cardDetalle) cardDetalle.classList.add('hidden');

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.style.minHeight = 'auto';
            contenedorGrafica.style.padding = '0';
        }

        // Renderizar layout de tabla
        this.renderTableLayout();
        this.attachTooltips();
        this.setupExportListeners();
    },

    destroy() {
        this.hideTooltip();
    },

    haveSameOptions(instance, newArr) {
        if (!instance || !instance.options || !newArr) return false;
        if (instance.options.length !== newArr.length) return false;
        for (let i = 0; i < newArr.length; i++) {
            if (instance.options[i].id !== String(newArr[i]).trim()) return false;
        }
        return true;
    },

    resetFilters() {
        if (this.multiTdoc) this.multiTdoc.selectAll(false);
        if (this.multiLinea) this.multiLinea.selectAll(false);
        if (this.multiCorporativo) this.multiCorporativo.selectAll(false);
        if (this.multiCliente) this.multiCliente.selectAll(false);
        if (this.multiProvincia) {
            this.multiProvincia.options.forEach(o => {
                o.selected = (o.id === 'AREQUIPA');
            });
            this.multiProvincia.updateLabel(false);
            this.multiProvincia.render();
        }
        if (this.multiZona) {
            this.multiZona.options.forEach(o => {
                o.selected = (o.id === 'ZONA CONO NORTE');
            });
            this.multiZona.updateLabel(false);
            this.multiZona.render();
        }
    },

    getSelectedFilters() {
        const filters = {};

        if (this.multiTdoc) {
            const vals = this.multiTdoc.getSelectedValues();
            if (vals.length === 0) {
                filters.tdoc = ['__NINGUNO__'];
            } else if (vals.length < (this.multiTdoc.options ? this.multiTdoc.options.length : 999)) {
                filters.tdoc = vals;
            }
        }

        if (this.multiLinea) {
            const vals = this.multiLinea.getSelectedValues();
            if (vals.length === 0) {
                filters.linea_venta = ['__NINGUNO__'];
            } else if (vals.length < (this.multiLinea.options ? this.multiLinea.options.length : 999)) {
                filters.linea_venta = vals;
            }
        }

        if (this.multiCorporativo) {
            const vals = this.multiCorporativo.getSelectedValues();
            if (vals.length === 0) {
                filters.corporativo = ['__NINGUNO__'];
            } else if (vals.length < (this.multiCorporativo.options ? this.multiCorporativo.options.length : 999)) {
                filters.corporativo = vals;
            }
        }

        if (this.multiCliente) {
            const vals = this.multiCliente.getSelectedValues();
            if (vals.length === 0) {
                filters.nomcliente = ['__NINGUNO__'];
            } else if (vals.length < (this.multiCliente.options ? this.multiCliente.options.length : 999)) {
                filters.nomcliente = vals;
            }
        }

        if (this.multiProvincia) {
            const vals = this.multiProvincia.getSelectedValues();
            if (vals.length === 0) {
                filters.provincia = ['__NINGUNO__'];
            } else if (vals.length < (this.multiProvincia.options ? this.multiProvincia.options.length : 999)) {
                filters.provincia = vals;
            }
        }

        if (this.multiZona) {
            const vals = this.multiZona.getSelectedValues();
            if (vals.length === 0) {
                filters.zona = ['__NINGUNO__'];
            } else if (vals.length < (this.multiZona.options ? this.multiZona.options.length : 999)) {
                filters.zona = vals;
            }
        }

        return filters;
    },

    setupFilters(opciones = {}) {
        if (typeof CustomMultiSelect === 'undefined') return;

        // Visibilidad de filtros para DashAnalisiPrecios
        document.getElementById('contenedor-filtro-tdoc-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-linea-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-corporativo-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-cliente-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-provincia-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-zona-precios')?.classList.remove('hidden');

        // 1. TDOC (01, 03, 07, 08)
        const tdocsDisp = opciones.tdocs || ['01', '03', '07', '08'];
        if (!this.multiTdoc) {
            const optTdoc = tdocsDisp.map(t => ({ id: String(t).trim(), label: String(t).trim(), selected: true }));
            this.multiTdoc = new CustomMultiSelect({
                btnId: 'btn-dropdown-tdoc-precios',
                dropdownId: 'dropdown-tdoc-precios',
                optionsContainerId: 'container-options-tdoc-precios',
                labelId: 'label-tdoc-precios',
                searchId: 'search-tdoc-precios',
                title: 'TDOC',
                options: optTdoc
            });
        }

        // 2. LINEA VENTA (601 Pollo Vivo)
        const lineasDisp = opciones.lineas || ['601 Pollo Vivo'];
        if (!this.multiLinea) {
            const optLinea = lineasDisp.map(l => ({ id: String(l).trim(), label: String(l).trim(), selected: true }));
            this.multiLinea = new CustomMultiSelect({
                btnId: 'btn-dropdown-linea-precios',
                dropdownId: 'dropdown-linea-precios',
                optionsContainerId: 'container-options-linea-precios',
                labelId: 'label-linea-precios',
                searchId: 'search-linea-precios',
                title: 'LINEA VENTA',
                options: optLinea
            });
        }

        // 3. CORPORATIVO
        const corpDisp = opciones.corporativos || [];
        if (!this.multiCorporativo) {
            const optCorp = corpDisp.map(c => ({ id: String(c).trim(), label: String(c).trim(), selected: true }));
            this.multiCorporativo = new CustomMultiSelect({
                btnId: 'btn-dropdown-corporativo-precios',
                dropdownId: 'dropdown-corporativo-precios',
                optionsContainerId: 'container-options-corporativo-precios',
                labelId: 'label-corporativo-precios',
                searchId: 'search-corporativo-precios',
                title: 'CORPORATIVO',
                options: optCorp
            });
        } else if (corpDisp.length > 0 && !this.haveSameOptions(this.multiCorporativo, corpDisp)) {
            const optCorp = corpDisp.map(c => ({ id: String(c).trim(), label: String(c).trim() }));
            this.multiCorporativo.setOptions(optCorp);
        }

        // 4. NOMCLIENTE
        const cliDisp = opciones.clientes || [];
        if (!this.multiCliente) {
            const optCli = cliDisp.map(c => ({ id: String(c).trim(), label: String(c).trim(), selected: true }));
            this.multiCliente = new CustomMultiSelect({
                btnId: 'btn-dropdown-cliente-precios',
                dropdownId: 'dropdown-cliente-precios',
                optionsContainerId: 'container-options-cliente-precios',
                labelId: 'label-cliente-precios',
                searchId: 'search-cliente-precios',
                title: 'NOMCLIENTE',
                options: optCli
            });
        } else if (cliDisp.length > 0 && !this.haveSameOptions(this.multiCliente, cliDisp)) {
            const optCli = cliDisp.map(c => ({ id: String(c).trim(), label: String(c).trim() }));
            this.multiCliente.setOptions(optCli);
        }

        // 5. PROVINCIA (AREQUIPA por defecto)
        const provDisp = opciones.provincias || [];
        const tieneArequipa = provDisp.includes('AREQUIPA');
        if (!this.multiProvincia) {
            const optProv = provDisp.map(p => ({
                id: String(p).trim(),
                label: String(p).trim(),
                selected: tieneArequipa ? (String(p).trim() === 'AREQUIPA') : true
            }));
            this.multiProvincia = new CustomMultiSelect({
                btnId: 'btn-dropdown-provincia-precios',
                dropdownId: 'dropdown-provincia-precios',
                optionsContainerId: 'container-options-provincia-precios',
                labelId: 'label-provincia-precios',
                searchId: 'search-provincia-precios',
                title: 'PROVINCIA',
                options: optProv
            });
        } else if (provDisp.length > 0 && !this.haveSameOptions(this.multiProvincia, provDisp)) {
            const optProv = provDisp.map(p => ({ id: String(p).trim(), label: String(p).trim() }));
            this.multiProvincia.setOptions(optProv);
        }

        // 6. ZONA (16 zonas con ZONA CONO NORTE por defecto)
        const zonasDisp = opciones.zonas || [];
        const tieneConoNorte = zonasDisp.includes('ZONA CONO NORTE');
        if (!this.multiZona) {
            const optZona = zonasDisp.map(z => ({
                id: String(z).trim(),
                label: String(z).trim(),
                selected: tieneConoNorte ? (String(z).trim() === 'ZONA CONO NORTE') : true
            }));
            this.multiZona = new CustomMultiSelect({
                btnId: 'btn-dropdown-zona-precios',
                dropdownId: 'dropdown-zona-precios',
                optionsContainerId: 'container-options-zona-precios',
                labelId: 'label-zona-precios',
                searchId: 'search-zona-precios',
                title: 'ZONA',
                options: optZona
            });
        } else if (zonasDisp.length > 0 && !this.haveSameOptions(this.multiZona, zonasDisp)) {
            const optZona = zonasDisp.map(z => ({ id: String(z).trim(), label: String(z).trim() }));
            this.multiZona.setOptions(optZona);
        }
    },

    renderTableLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const filas = (this.datosBackend && this.datosBackend.filas) ? this.datosBackend.filas : [];

        // Escalas máximas fijadas según los ejes de Tableau
        const maxImporte = 30000;
        const maxPeso = 6000;
        const maxCantidad = 2000;
        const maxPUKg = 15;
        const maxPUUnd = 40;

        const formatNumber = (num, decimals = 2) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        };

        const formatCurrency = (num) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return 'S/ ' + formatNumber(num, 2);
        };

        let rowsHtml = '';
        if (filas.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="19" class="px-4 py-8 text-center text-slate-400 font-medium">
                        No se encontraron registros para los filtros seleccionados.
                    </td>
                </tr>
            `;
        } else {
            filas.forEach((row) => {
                const pctImporte = Math.min(100, Math.max(0, (row.importe / maxImporte) * 100)).toFixed(1);
                const pctPeso = Math.min(100, Math.max(0, (row.peso / maxPeso) * 100)).toFixed(1);
                const pctCantidad = Math.min(100, Math.max(0, (row.cantidad / maxCantidad) * 100)).toFixed(1);
                const pctPUKg = Math.min(100, Math.max(0, (row.puConIgvKgs / maxPUKg) * 100)).toFixed(1);
                const pctPUUnd = Math.min(100, Math.max(0, (row.puUnd / maxPUUnd) * 100)).toFixed(1);

                const rowDataJson = JSON.stringify(row).replace(/"/g, '&quot;');

                rowsHtml += `
                    <tr class="hover:bg-blue-50/60 transition-colors border-b border-slate-100 text-[11px] text-slate-700 data-row" data-info="${rowDataJson}">
                        <td class="px-2 py-1 text-center font-semibold text-slate-400 border-r border-slate-100">${row.indice}</td>
                        <td class="px-2 py-1 whitespace-nowrap font-medium text-slate-800 border-r border-slate-100">${row.provincia}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-600 border-r border-slate-100">${row.zona}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.codCorporativo}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-700 max-w-[130px] truncate border-r border-slate-100" title="${row.nomCorporativo}">${row.nomCorporativo}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.codCliente}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-700 max-w-[120px] truncate border-r border-slate-100" title="${row.nomCliente}">${row.nomCliente}</td>
                        <td class="px-2 py-1 text-center whitespace-nowrap font-medium text-slate-700 border-r border-slate-100">${row.fecha}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.td}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-800 font-semibold border-r border-slate-100">${row.nroDoc}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-600 border-r border-slate-100">${row.lineaVenta}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-700 font-bold border-r border-slate-100">${row.codItem}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-800 font-medium border-r border-slate-100">${row.nomItem}</td>
                        <td class="px-2 py-1 text-center font-bold text-slate-500 border-r border-slate-200">${row.unidad}</td>

                        <!-- 1. BARRA IMPORTE -->
                        <td class="px-2 py-1 w-32 min-w-[120px] border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-blue-500/80 rounded-xs transition-all duration-300" style="width: ${pctImporte}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatCurrency(row.importe)}</span>
                            </div>
                        </td>

                        <!-- 2. BARRA PESO -->
                        <td class="px-2 py-1 w-28 min-w-[100px] border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-blue-700/80 rounded-xs transition-all duration-300" style="width: ${pctPeso}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.peso, 2)}</span>
                            </div>
                        </td>

                        <!-- 3. BARRA CANTIDAD -->
                        <td class="px-2 py-1 w-28 min-w-[100px] border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-slate-600/80 rounded-xs transition-all duration-300" style="width: ${pctCantidad}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.cantidad, 2)}</span>
                            </div>
                        </td>

                        <!-- 4. BARRA PU CON IGV KGS -->
                        <td class="px-2 py-1 w-24 min-w-[90px] border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-teal-600/80 rounded-xs transition-all duration-300" style="width: ${pctPUKg}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.puConIgvKgs, 2)}</span>
                            </div>
                        </td>

                        <!-- 5. BARRA PU UND -->
                        <td class="px-2 py-1 w-24 min-w-[90px] bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-emerald-600/80 rounded-xs transition-all duration-300" style="width: ${pctPUUnd}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.puUnd, 2)}</span>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        contenedorGrafica.innerHTML = `
            <div class="w-full flex flex-col p-4 sm:p-6 bg-slate-50/50">
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    
                    <!-- ENCABEZADO DE TABLA ESTANDARIZADO -->
                    <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">AnalisisPrecios</h2>
                            </div>
                            <span class="text-[11px] text-slate-400 font-medium">Evolución de precios unitarios, pesos e importes por transacción e ítem</span>
                        </div>
                        <button id="btn-export-excel-precios" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>

                        <!-- TABLA CONTENEDORA CON SCROLLBAR -->
                    <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar w-full">
                        <table id="tabla-analisis-precios" class="w-full text-left border-collapse table-auto select-none text-[11px]">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-700 shadow-xs">
                                <tr>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 w-10 font-semibold">#</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">Provincia</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">Zona</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodCorporativo</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomCorporativo</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodCliente</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomCliente</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">Día de Fecha</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">Td..</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">NroDoc</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">LineaVenta</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodItem</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomItem</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">unidad</th>

                                    <!-- CABECERAS DE MÉTRICAS -->
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[120px] font-semibold">Importe</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[100px] font-semibold">Peso</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[100px] font-semibold">Cantidad</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[90px] font-semibold">PUConIGV_Kgs</th>
                                    <th class="px-2 py-1.5 text-center min-w-[90px] font-semibold">PU_Und</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 bg-white">
                                ${rowsHtml}
                            </tbody>
                            <tfoot class="no-export sticky bottom-0 z-20 bg-slate-100 font-bold border-t-2 border-slate-300 shadow-md text-[10.5px] text-slate-600">
                                <tr>
                                    <td colspan="14" class="px-3 py-2 text-right uppercase tracking-wider text-slate-500 font-bold border-r border-slate-300">
                                        Escala de Métricas (Tableau)
                                    </td>
                                    
                                    <!-- ESCALA IMPORTE -->
                                    <td class="px-2 py-1.5 border-r border-slate-300 bg-blue-50/50">
                                        <div class="flex justify-between text-[10px] text-blue-800 font-mono">
                                            <span>10K</span>
                                            <span>20K</span>
                                            <span>30K</span>
                                        </div>
                                    </td>

                                    <!-- ESCALA PESO -->
                                    <td class="px-2 py-1.5 border-r border-slate-300 bg-blue-50/50">
                                        <div class="flex justify-between text-[10px] text-blue-900 font-mono">
                                            <span>0K</span>
                                            <span>2K</span>
                                            <span>4K</span>
                                            <span>6K</span>
                                        </div>
                                    </td>

                                    <!-- ESCALA CANTIDAD -->
                                    <td class="px-2 py-1.5 border-r border-slate-300 bg-slate-100">
                                        <div class="flex justify-between text-[10px] text-slate-700 font-mono">
                                            <span>0</span>
                                            <span>1000</span>
                                            <span>2000</span>
                                        </div>
                                    </td>

                                    <!-- ESCALA PUConIGV_Kgs -->
                                    <td class="px-2 py-1.5 border-r border-slate-300 bg-teal-50/50">
                                        <div class="flex justify-between text-[10px] text-teal-800 font-mono">
                                            <span>0</span>
                                            <span>5</span>
                                            <span>10</span>
                                            <span>15</span>
                                        </div>
                                    </td>

                                    <!-- ESCALA PU_Und -->
                                    <td class="px-2 py-1.5 bg-emerald-50/50">
                                        <div class="flex justify-between text-[10px] text-emerald-800 font-mono">
                                            <span>0</span>
                                            <span>10</span>
                                            <span>20</span>
                                            <span>30</span>
                                            <span>40</span>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                </div>
            </div>
        `;
    },

    attachTooltips() {
        const rows = document.querySelectorAll('.data-row');
        const tooltip = document.getElementById('tooltip-tableau-costos');
        if (!tooltip) return;

        rows.forEach(row => {
            row.addEventListener('mousemove', (e) => {
                const infoStr = row.getAttribute('data-info');
                if (!infoStr) return;

                const item = JSON.parse(infoStr);

                const formatNum = (num) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                tooltip.innerHTML = `
                    <div class="space-y-1 font-sans">
                        <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                            ${item.nomItem} (${item.codItem})
                        </div>
                        <div class="grid grid-cols-2 gap-x-2 text-[11px] text-slate-600">
                            <div><span class="font-semibold text-slate-500">Provincia:</span> ${item.provincia}</div>
                            <div><span class="font-semibold text-slate-500">Zona:</span> ${item.zona}</div>
                            <div><span class="font-semibold text-slate-500">Corporativo:</span> ${item.nomCorporativo} (${item.codCorporativo})</div>
                            <div><span class="font-semibold text-slate-500">Cliente:</span> ${item.nomCliente} (${item.codCliente})</div>
                            <div><span class="font-semibold text-slate-500">Fecha:</span> ${item.fecha}</div>
                            <div><span class="font-semibold text-slate-500">Doc:</span> ${item.td}-${item.nroDoc}</div>
                            <div><span class="font-semibold text-slate-500">Línea:</span> ${item.lineaVenta}</div>
                            <div><span class="font-semibold text-slate-500">Unidad:</span> ${item.unidad}</div>
                        </div>
                        <div class="border-t border-slate-200 pt-1 mt-1 space-y-0.5 text-[11px]">
                            <div class="flex justify-between"><span class="font-bold text-blue-700">Importe:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.importe)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-blue-900">Peso:</span> <span class="font-bold text-slate-800">${formatNum(item.peso)} ${item.unidad}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-slate-700">Cantidad:</span> <span class="font-bold text-slate-800">${formatNum(item.cantidad)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-teal-700">PU con IGV Kgs:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.puConIgvKgs)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-emerald-700">PU Und:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.puUnd)}</span></div>
                        </div>
                    </div>
                `;

                tooltip.classList.remove('hidden');
                tooltip.style.display = 'block';

                const x = e.clientX + 15;
                const y = e.clientY + 15;
                const maxW = window.innerWidth - 320;
                const maxH = window.innerHeight - 260;

                tooltip.style.left = `${Math.min(x, maxW)}px`;
                tooltip.style.top = `${Math.min(y, maxH)}px`;
            });

            row.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    },

    hideTooltip() {
        const tooltip = document.getElementById('tooltip-tableau-costos');
        if (tooltip) {
            tooltip.classList.add('hidden');
            tooltip.style.display = 'none';
        }
    },

    setupExportListeners() {
        const btnExport = document.getElementById('btn-export-excel-precios');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
            const filas = (this.datosBackend && this.datosBackend.filas) ? this.datosBackend.filas : [];
            if (!filas.length) {
                alert('No hay datos disponibles para exportar.');
                return;
            }

            if (typeof XLSX === 'undefined') {
                alert('Librería de exportación XLSX no disponible.');
                return;
            }

            // Estilo oficial estándar bg-blue-600 con texto blanco
            const headerStyle = {
                fill: { fgColor: { rgb: "2563EB" } }, // Tailwind bg-blue-600
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } }, // text-white
                alignment: { vertical: "center", horizontal: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "1D4ED8" } },
                    bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                    left: { style: "thin", color: { rgb: "3B82F6" } },
                    right: { style: "thin", color: { rgb: "3B82F6" } }
                }
            };

            const dataStyleLeft = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "left" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            const dataStyleCenter = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            const dataStyleRight = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "right" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            const columns = [
                { key: 'indice', label: '#', type: 'center', width: 6 },
                { key: 'provincia', label: 'Provincia', type: 'left', width: 14 },
                { key: 'zona', label: 'Zona', type: 'left', width: 22 },
                { key: 'codCorporativo', label: 'CodCorporativo', type: 'center', width: 16 },
                { key: 'nomCorporativo', label: 'NomCorporativo', type: 'left', width: 26 },
                { key: 'codCliente', label: 'CodCliente', type: 'center', width: 14 },
                { key: 'nomCliente', label: 'NomCliente', type: 'left', width: 26 },
                { key: 'fecha', label: 'Día de Fecha', type: 'center', width: 14 },
                { key: 'td', label: 'Td', type: 'center', width: 8 },
                { key: 'nroDoc', label: 'NroDoc', type: 'center', width: 14 },
                { key: 'lineaVenta', label: 'LineaVenta', type: 'left', width: 18 },
                { key: 'codItem', label: 'CodItem', type: 'center', width: 12 },
                { key: 'nomItem', label: 'NomItem', type: 'left', width: 24 },
                { key: 'unidad', label: 'unidad', type: 'center', width: 10 },
                { key: 'importe', label: 'Importe', type: 'currency', width: 16 },
                { key: 'peso', label: 'Peso', type: 'number', width: 14 },
                { key: 'cantidad', label: 'Cantidad', type: 'number', width: 14 },
                { key: 'puConIgvKgs', label: 'PUConIGV_Kgs', type: 'currency', width: 16 },
                { key: 'puUnd', label: 'PU_Und', type: 'number', width: 14 }
            ];

            // Construir matriz de datos y celdas con estilos
            const headerRow = columns.map(col => ({
                t: 's',
                v: col.label,
                s: headerStyle
            }));

            const dataRows = filas.map(f => {
                return columns.map(col => {
                    const rawVal = f[col.key];
                    if (col.type === 'currency') {
                        return {
                            t: 'n',
                            v: Number(rawVal) || 0,
                            z: '"S/ "#,##0.00',
                            s: dataStyleRight
                        };
                    } else if (col.type === 'number') {
                        return {
                            t: 'n',
                            v: Number(rawVal) || 0,
                            z: '#,##0.00',
                            s: dataStyleRight
                        };
                    } else if (col.type === 'center') {
                        return {
                            t: typeof rawVal === 'number' ? 'n' : 's',
                            v: rawVal !== null && rawVal !== undefined ? rawVal : '',
                            s: dataStyleCenter
                        };
                    } else {
                        return {
                            t: 's',
                            v: rawVal !== null && rawVal !== undefined ? String(rawVal) : '',
                            s: dataStyleLeft
                        };
                    }
                });
            });

            const sheetData = [headerRow, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Re-asignar estilos y formatos z a cada celda generada
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (ws[addr] && sheetData[R] && sheetData[R][C]) {
                        ws[addr].s = sheetData[R][C].s;
                        if (sheetData[R][C].z) ws[addr].z = sheetData[R][C].z;
                    }
                }
            }

            ws['!cols'] = columns.map(c => ({ wch: c.width }));
            ws['!rows'] = [{ hpt: 26 }, ...filas.map(() => ({ hpt: 20 }))];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'AnalisisPrecios');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `AnalisisPrecios_${fechaStr}.xlsx`);
        });
    }
};

// Registrar en ChartRegistry para acceso polimórfico
window.ChartRegistry['DashAnalisiPrecios'] = window.AnalisisPreciosChart;
window.ChartRegistry['AnalisisPrecios'] = window.AnalisisPreciosChart;
window.ChartRegistry['DashAnalisisPrecios'] = window.AnalisisPreciosChart;
