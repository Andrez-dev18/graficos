/**
 * Componente de Gráfico / Vista: AnalisisPreciosELS
 * Módulo: analisisPrecios
 * 
 * Renderiza la tabla detallada de Análisis de Precios ELS con agrupación por FechProc,
 * subtotales por fecha de proceso, métricas calculadas (Importe, Peso, Cantidad, PUsinIGV_Kgs, PUconIGV_Kgs)
 * y filtros dinámicos Tableau (PROVINCIA, CORPORATIVO, NOMCLIENTE, ZONA, LINEA VENTA, TDOC).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.AnalisisPreciosELSChart = {
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

        // Configurar y poblar dropdowns de filtros dinámicos
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // Asegurar que contenedores de gráficos secundarios no interfieran
        const cardDetalle = document.getElementById('card-tabla-metricas');
        if (cardDetalle) cardDetalle.classList.add('hidden');

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.style.minHeight = 'auto';
            contenedorGrafica.style.padding = '0';
        }

        // Renderizar tabla
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
        if (this.multiZona) this.multiZona.selectAll(false);
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

        // Visibilidad de filtros para AnalisisPreciosELS (ocultar TDOC que no pertenece a este dashboard)
        document.getElementById('contenedor-filtro-tdoc-precios')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-linea-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-corporativo-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-cliente-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-provincia-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-zona-precios')?.classList.remove('hidden');

        // 1. LINEA VENTA (601 Pollo Vivo)
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

        // 6. ZONA (todas seleccionadas por defecto en AnalisisPreciosELS)
        const zonasDisp = opciones.zonas || [];
        if (!this.multiZona) {
            const optZona = zonasDisp.map(z => ({
                id: String(z).trim(),
                label: String(z).trim(),
                selected: true
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

        const grupos = (this.datosBackend && this.datosBackend.grupos_fech_proc) ? this.datosBackend.grupos_fech_proc : [];
        const resumen = this.datosBackend.resumen || {};

        const formatNumber = (num, decimals = 2) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        };

        const formatCurrency = (num) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return 'S/ ' + formatNumber(num, 2);
        };

        let rowsHtml = '';
        if (grupos.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="19" class="px-4 py-8 text-center text-slate-400 font-medium">
                        No se encontraron registros para los filtros seleccionados.
                    </td>
                </tr>
            `;
        } else {
            let globalIndex = 0;
            grupos.forEach((grupo) => {
                const filasGrupo = grupo.filas || [];
                const sub = grupo.subtotal || {};

                filasGrupo.forEach((row) => {
                    globalIndex++;
                    const rowDataJson = JSON.stringify(row).replace(/"/g, '&quot;');

                    rowsHtml += `
                        <tr class="hover:bg-blue-50/60 transition-colors border-b border-slate-100 text-[11px] text-slate-700 data-row-els" data-info="${rowDataJson}">
                            <td class="px-2 py-1 text-center font-semibold text-slate-400 border-r border-slate-100">${globalIndex}</td>
                            <td class="px-2 py-1 whitespace-nowrap font-medium text-slate-800 border-r border-slate-100">${row.provincia}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.codCorporativo}</td>
                            <td class="px-2 py-1 whitespace-nowrap text-slate-700 max-w-[140px] truncate border-r border-slate-100" title="${row.nomCorporativo}">${row.nomCorporativo}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.codCliente}</td>
                            <td class="px-2 py-1 whitespace-nowrap text-slate-700 max-w-[130px] truncate border-r border-slate-100" title="${row.nomCliente}">${row.nomCliente}</td>
                            <td class="px-2 py-1 text-center whitespace-nowrap font-bold text-slate-900 border-r border-slate-100 bg-slate-50/40">${row.fechProc}</td>
                            <td class="px-2 py-1 text-center whitespace-nowrap font-medium text-slate-700 border-r border-slate-100">${row.fechTra}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${row.td}</td>
                            <td class="px-2 py-1 whitespace-nowrap text-slate-700 max-w-[150px] truncate border-r border-slate-100" title="${row.zona}">${row.zona}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-800 font-semibold border-r border-slate-100">${row.nroDoc}</td>
                            <td class="px-2 py-1 whitespace-nowrap text-slate-600 border-r border-slate-100">${row.lineaVenta}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-700 font-bold border-r border-slate-100">${row.codItem}</td>
                            <td class="px-2 py-1 whitespace-nowrap text-slate-800 font-medium border-r border-slate-100">${row.nomItem}</td>
                            <td class="px-2 py-1 text-center font-bold text-slate-500 border-r border-slate-200">${row.unidad}</td>

                            <!-- MÉTRICAS -->
                            <td class="px-2 py-1 text-right font-mono font-medium text-slate-800 border-r border-slate-100 bg-blue-50/20">${formatCurrency(row.importe)}</td>
                            <td class="px-2 py-1 text-right font-mono font-medium text-slate-800 border-r border-slate-100 bg-blue-50/20">${formatNumber(row.peso, 2)} KGS</td>
                            <td class="px-2 py-1 text-right font-mono font-medium text-slate-800 border-r border-slate-100 bg-slate-50/40">${formatNumber(row.cantidad, 2)} UND</td>
                            <td class="px-2 py-1 text-right font-mono font-semibold text-teal-700 border-r border-slate-100 bg-teal-50/20">${formatCurrency(row.puSinIgvKgs)}</td>
                            <td class="px-2 py-1 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">${formatCurrency(row.puConIgvKgs)}</td>
                        </tr>
                    `;
                });

                // FILA DE SUBTOTAL POR FECH_PROC
                rowsHtml += `
                    <tr class="bg-slate-100 font-bold text-slate-900 border-t border-b-2 border-slate-300 text-[11px]">
                        <td colspan="7" class="px-3 py-1.5 text-left font-bold text-slate-700 uppercase tracking-wide border-r border-slate-200">
                            Total
                        </td>
                        <td colspan="8" class="px-2 py-1.5 border-r border-slate-200 bg-slate-100"></td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-800 border-r border-slate-200 bg-blue-50/40">${formatCurrency(sub.importe)}</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-900 border-r border-slate-200 bg-blue-50/40">${formatNumber(sub.peso, 2)} KGS</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-200/50">${formatNumber(sub.cantidad, 2)} UND</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-teal-800 border-r border-slate-200 bg-teal-50/40">${formatCurrency(sub.puSinIgvKgs)}</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40">${formatCurrency(sub.puConIgvKgs)}</td>
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
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">AnalisisPreciosELS</h2>
                            </div>
                            <span class="text-[11px] text-slate-400 font-medium">Análisis detallado de precios unitarios con subtotales por fecha de proceso (FechProc)</span>
                        </div>
                        <button id="btn-export-excel-precios-els" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>

                    <!-- TABLA CONTENEDORA CON SCROLLBAR -->
                    <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar w-full">
                        <table id="tabla-analisis-precios-els" class="w-full text-left border-collapse table-auto select-none text-[11px]">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-700 shadow-xs">
                                <tr>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 w-10 font-semibold">#</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">Provincia</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodCorporativo</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomCorporativo</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodCliente</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomCliente</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">FechProc</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">Día de Fecha</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">Td..</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">Zona</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">NroDoc</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">LineaVenta</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">CodItem</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap">NomItem</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold whitespace-nowrap">unidad</th>

                                    <!-- CABECERAS DE MÉTRICAS -->
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[110px] font-semibold">Importe</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[100px] font-semibold">Peso</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[90px] font-semibold">Cantidad</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 min-w-[90px] font-semibold">PUsinIGV_Kgs</th>
                                    <th class="px-2 py-1.5 text-center min-w-[90px] font-semibold">PUconIGV_Kgs</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 bg-white">
                                ${rowsHtml}
                            </tbody>
                            <tfoot class="sticky bottom-0 z-20 bg-blue-700 text-white font-extrabold shadow-md text-[11px]">
                                <tr>
                                    <td colspan="15" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-600 bg-blue-700">
                                        Total General
                                    </td>
                                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${formatCurrency(resumen.total_importe)}</td>
                                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${formatNumber(resumen.total_peso, 2)} KGS</td>
                                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${formatNumber(resumen.total_cantidad, 2)} UND</td>
                                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${formatCurrency(resumen.pu_sin_igv_kgs)}</td>
                                    <td class="px-2 py-2 text-right font-mono font-black text-amber-300 bg-blue-800 cursor-default">${formatCurrency(resumen.pu_con_igv_kgs)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                </div>
            </div>
        `;
    },

    attachTooltips() {
        const rows = document.querySelectorAll('.data-row-els');
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
                            <div><span class="font-semibold text-slate-500">Zona/Glosa:</span> ${item.zona}</div>
                            <div><span class="font-semibold text-slate-500">Corporativo:</span> ${item.nomCorporativo} (${item.codCorporativo})</div>
                            <div><span class="font-semibold text-slate-500">Cliente:</span> ${item.nomCliente} (${item.codCliente})</div>
                            <div><span class="font-semibold text-slate-500">FechProc:</span> ${item.fechProc}</div>
                            <div><span class="font-semibold text-slate-500">FechTra:</span> ${item.fechTra}</div>
                            <div><span class="font-semibold text-slate-500">Doc:</span> ${item.td}-${item.nroDoc}</div>
                            <div><span class="font-semibold text-slate-500">Línea:</span> ${item.lineaVenta}</div>
                            <div><span class="font-semibold text-slate-500">Unidad:</span> ${item.unidad}</div>
                        </div>
                        <div class="border-t border-slate-200 pt-1 mt-1 space-y-0.5 text-[11px]">
                            <div class="flex justify-between"><span class="font-bold text-blue-700">Importe:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.importe)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-blue-900">Peso:</span> <span class="font-bold text-slate-800">${formatNum(item.peso)} ${item.unidad}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-slate-700">Cantidad:</span> <span class="font-bold text-slate-800">${formatNum(item.cantidad)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-teal-700">PU sin IGV Kgs:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.puSinIgvKgs)}</span></div>
                            <div class="flex justify-between"><span class="font-bold text-emerald-700">PU con IGV Kgs:</span> <span class="font-bold text-slate-800">S/ ${formatNum(item.puConIgvKgs)}</span></div>
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
        const btnExport = document.getElementById('btn-export-excel-precios-els');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
            const grupos = (this.datosBackend && this.datosBackend.grupos_fech_proc) ? this.datosBackend.grupos_fech_proc : [];
            const resumen = this.datosBackend.resumen || {};

            if (!grupos.length) {
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
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                alignment: { vertical: "center", horizontal: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "1D4ED8" } },
                    bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                    left: { style: "thin", color: { rgb: "3B82F6" } },
                    right: { style: "thin", color: { rgb: "3B82F6" } }
                }
            };

            const subtotalStyle = {
                fill: { fgColor: { rgb: "F1F5F9" } }, // Tailwind bg-slate-100
                font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "0F172A" } },
                border: {
                    top: { style: "thin", color: { rgb: "94A3B8" } },
                    bottom: { style: "medium", color: { rgb: "94A3B8" } },
                    left: { style: "thin", color: { rgb: "CBD5E1" } },
                    right: { style: "thin", color: { rgb: "CBD5E1" } }
                }
            };

            const footerStyle = {
                fill: { fgColor: { rgb: "1D4ED8" } }, // Tailwind bg-blue-700
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                border: {
                    top: { style: "medium", color: { rgb: "1E40AF" } },
                    bottom: { style: "medium", color: { rgb: "1E40AF" } },
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
                { key: 'codCorporativo', label: 'CodCorporativo', type: 'center', width: 16 },
                { key: 'nomCorporativo', label: 'NomCorporativo', type: 'left', width: 26 },
                { key: 'codCliente', label: 'CodCliente', type: 'center', width: 14 },
                { key: 'nomCliente', label: 'NomCliente', type: 'left', width: 26 },
                { key: 'fechProc', label: 'FechProc', type: 'center', width: 14 },
                { key: 'fechTra', label: 'Día de Fecha', type: 'center', width: 14 },
                { key: 'td', label: 'Td', type: 'center', width: 8 },
                { key: 'zona', label: 'Zona', type: 'left', width: 24 },
                { key: 'nroDoc', label: 'NroDoc', type: 'center', width: 14 },
                { key: 'lineaVenta', label: 'LineaVenta', type: 'left', width: 18 },
                { key: 'codItem', label: 'CodItem', type: 'center', width: 12 },
                { key: 'nomItem', label: 'NomItem', type: 'left', width: 24 },
                { key: 'unidad', label: 'unidad', type: 'center', width: 10 },
                { key: 'importe', label: 'Importe', type: 'currency', width: 16 },
                { key: 'peso', label: 'Peso', type: 'number', width: 14 },
                { key: 'cantidad', label: 'Cantidad', type: 'number', width: 14 },
                { key: 'puSinIgvKgs', label: 'PUsinIGV_Kgs', type: 'currency', width: 16 },
                { key: 'puConIgvKgs', label: 'PUconIGV_Kgs', type: 'currency', width: 16 }
            ];

            // 1. Encabezado
            const headerRow = columns.map(col => ({
                t: 's',
                v: col.label,
                s: headerStyle
            }));

            const sheetData = [headerRow];
            let globalIdx = 0;

            grupos.forEach(grupo => {
                const filasGrupo = grupo.filas || [];
                const sub = grupo.subtotal || {};

                filasGrupo.forEach(f => {
                    globalIdx++;
                    const dataRow = columns.map(col => {
                        const rawVal = (col.key === 'indice') ? globalIdx : f[col.key];
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
                    sheetData.push(dataRow);
                });

                // Fila de Subtotal
                const subRow = columns.map((col, cIdx) => {
                    if (cIdx === 0) {
                        return {
                            t: 's',
                            v: 'Total',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "left" } }
                        };
                    } else if (col.key === 'importe') {
                        return {
                            t: 'n',
                            v: sub.importe,
                            z: '"S/ "#,##0.00',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "right" } }
                        };
                    } else if (col.key === 'peso') {
                        return {
                            t: 'n',
                            v: sub.peso,
                            z: '#,##0.00',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "right" } }
                        };
                    } else if (col.key === 'cantidad') {
                        return {
                            t: 'n',
                            v: sub.cantidad,
                            z: '#,##0.00',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "right" } }
                        };
                    } else if (col.key === 'puSinIgvKgs') {
                        return {
                            t: 'n',
                            v: sub.puSinIgvKgs,
                            z: '"S/ "#,##0.00',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "right" } }
                        };
                    } else if (col.key === 'puConIgvKgs') {
                        return {
                            t: 'n',
                            v: sub.puConIgvKgs,
                            z: '"S/ "#,##0.00',
                            s: { ...subtotalStyle, alignment: { vertical: "center", horizontal: "right" } }
                        };
                    } else {
                        return {
                            t: 's',
                            v: '',
                            s: { ...subtotalStyle }
                        };
                    }
                });
                sheetData.push(subRow);
            });

            // Fila de Total General
            const grandTotalRow = columns.map((col, cIdx) => {
                if (cIdx === 0) {
                    return {
                        t: 's',
                        v: 'TOTAL GENERAL',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "left" } }
                    };
                } else if (col.key === 'importe') {
                    return {
                        t: 'n',
                        v: resumen.total_importe,
                        z: '"S/ "#,##0.00',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "right" } }
                    };
                } else if (col.key === 'peso') {
                    return {
                        t: 'n',
                        v: resumen.total_peso,
                        z: '#,##0.00',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "right" } }
                    };
                } else if (col.key === 'cantidad') {
                    return {
                        t: 'n',
                        v: resumen.total_cantidad,
                        z: '#,##0.00',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "right" } }
                    };
                } else if (col.key === 'puSinIgvKgs') {
                    return {
                        t: 'n',
                        v: resumen.pu_sin_igv_kgs,
                        z: '"S/ "#,##0.00',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "right" } }
                    };
                } else if (col.key === 'puConIgvKgs') {
                    return {
                        t: 'n',
                        v: resumen.pu_con_igv_kgs,
                        z: '"S/ "#,##0.00',
                        s: { ...footerStyle, alignment: { vertical: "center", horizontal: "right" } }
                    };
                } else {
                    return {
                        t: 's',
                        v: '',
                        s: { ...footerStyle }
                    };
                }
            });
            sheetData.push(grandTotalRow);

            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Re-asignar estilos y formatos z celda por celda
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
            ws['!rows'] = [{ hpt: 26 }, ...sheetData.slice(1).map(() => ({ hpt: 20 }))];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'AnalisisPreciosELS');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `AnalisisPreciosELS_${fechaStr}.xlsx`);
        });
    }
};

// Registrar en ChartRegistry para acceso polimórfico
window.ChartRegistry['AnalisisPreciosELS'] = window.AnalisisPreciosELSChart;
window.ChartRegistry['DashAnalisisPreciosELS'] = window.AnalisisPreciosELSChart;
