/**
 * Componente de Gráfico / Vista: DashRegaloELS
 * Módulo: analisisPrecios
 * 
 * Integra los 3 paneles sincronizados de Tableau:
 * 1. ParetoVentas (Barras horizontales: Cantidad, Peso, Importe, % de total Peso)
 * 2. PrecioVentas (Tabla cruzada: Día de Fecha x TDOC 01, 03, 07)
 * 3. MotivosNCVentas (Tabla detallada con motivos de Notas de Crédito)
 * Con filtrado interactivo al seleccionar un corporativo en Pareto y exportación a Excel multi-hoja estilizada.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashRegaloELSChart = {
    controllerRef: null,
    datosBackend: null,
    multiLinea: null,
    multiCorporativo: null,
    multiCliente: null,
    multiProvincia: null,
    corporativoSeleccionado: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.corporativoSeleccionado = null;

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

        // Renderizar layout principal de los 3 paneles
        this.renderDashboardLayout();
        this.attachInteractiveListeners();
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
        this.corporativoSeleccionado = null;
    },

    getSelectedFilters() {
        const filters = {};

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

        return filters;
    },

    setupFilters(opciones = {}) {
        if (typeof CustomMultiSelect === 'undefined') return;

        // Ocultar TDOC y ZONA (no existen en la barra lateral de DashRegaloELS)
        document.getElementById('contenedor-filtro-tdoc-precios')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-zona-precios')?.classList.add('hidden');

        // Mostrar filtros relevantes
        document.getElementById('contenedor-filtro-linea-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-corporativo-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-cliente-precios')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-provincia-precios')?.classList.remove('hidden');

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

        // 2. CORPORATIVO
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

        // 3. NOMCLIENTE
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

        // 4. PROVINCIA (AREQUIPA por defecto)
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
    },

    renderDashboardLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const paretoData = this.datosBackend.pareto_ventas || {};
        const paretoFilas = paretoData.filas || [];

        const formatNumber = (num, decimals = 2) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        };

        const formatCurrency = (num) => {
            if (num === null || num === undefined || isNaN(num)) return '-';
            return 'S/ ' + formatNumber(num, 2);
        };

        // Escalas fijas máximas de Tableau
        const scaleMaxCantidad = Math.max(60000, (paretoData.max_cantidad || 0) * 1.1);
        const scaleMaxPeso     = Math.max(200000, (paretoData.max_peso || 0) * 1.1);
        const scaleMaxImporte  = Math.max(1000000, (paretoData.max_importe || 0) * 1.1);
        const scaleMaxPorc     = Math.max(12, (paretoData.max_porc_peso || 0) * 1.15);

        // 1. Construir Filas de ParetoVentas
        let paretoRowsHtml = '';
        if (paretoFilas.length === 0) {
            paretoRowsHtml = `
                <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-slate-400 font-medium">
                        No se encontraron registros para los filtros seleccionados.
                    </td>
                </tr>
            `;
        } else {
            paretoFilas.forEach(row => {
                const pctCant = Math.min(100, Math.max(0, (row.cantidad / scaleMaxCantidad) * 100)).toFixed(1);
                const pctPeso = Math.min(100, Math.max(0, (row.peso / scaleMaxPeso) * 100)).toFixed(1);
                const pctImp  = Math.min(100, Math.max(0, (row.importe / scaleMaxImporte) * 100)).toFixed(1);
                const pctPorc = Math.min(100, Math.max(0, (row.porcPeso / scaleMaxPorc) * 100)).toFixed(1);

                const isSelected = (this.corporativoSeleccionado === row.nomCorporativo);
                const rowDataJson = JSON.stringify(row).replace(/"/g, '&quot;');

                paretoRowsHtml += `
                    <tr class="pareto-row cursor-pointer transition-colors border-b border-slate-100 text-[11px] ${isSelected ? 'bg-blue-100 font-bold' : 'hover:bg-blue-50/60 text-slate-700'}"
                        data-corp="${row.nomCorporativo}" data-info="${rowDataJson}">
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100 w-24">${row.codCorporativo}</td>
                        <td class="px-2 py-1 whitespace-nowrap font-medium text-slate-800 border-r border-slate-100 max-w-[180px] truncate" title="${row.nomCorporativo}">${row.nomCorporativo}</td>

                        <!-- 1. CANTIDAD -->
                        <td class="px-2 py-1 w-44 border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-blue-600/80 rounded-xs transition-all duration-300" style="width: ${pctCant}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.cantidad, 2)} UND</span>
                            </div>
                        </td>

                        <!-- 2. PESO -->
                        <td class="px-2 py-1 w-48 border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-blue-800/80 rounded-xs transition-all duration-300" style="width: ${pctPeso}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.peso, 2)} KGS</span>
                            </div>
                        </td>

                        <!-- 3. IMPORTE -->
                        <td class="px-2 py-1 w-48 border-r border-slate-200 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-indigo-600/80 rounded-xs transition-all duration-300" style="width: ${pctImp}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatCurrency(row.importe)}</span>
                            </div>
                        </td>

                        <!-- 4. % DE TOTAL PESO -->
                        <td class="px-2 py-1 w-32 bg-slate-50/30">
                            <div class="relative w-full h-5 bg-slate-100 rounded-xs overflow-hidden flex items-center">
                                <div class="absolute left-0 top-0 bottom-0 bg-teal-600/80 rounded-xs transition-all duration-300" style="width: ${pctPorc}%;"></div>
                                <span class="relative z-10 px-1.5 text-[10.5px] font-bold text-slate-800 drop-shadow-xs">${formatNumber(row.porcPeso, 2)}%</span>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        // 2. Construir Filas de PrecioVentas
        const rawPrecios = this.datosBackend.precio_ventas || [];
        const preciosFiltrados = this.corporativoSeleccionado 
            ? rawPrecios.filter(p => p.nomCorporativo === this.corporativoSeleccionado)
            : rawPrecios;

        let preciosRowsHtml = '';
        if (preciosFiltrados.length === 0) {
            preciosRowsHtml = `
                <tr>
                    <td colspan="5" class="px-4 py-6 text-center text-slate-400 font-medium">
                        No hay precios disponibles para el corporativo seleccionado.
                    </td>
                </tr>
            `;
        } else {
            preciosFiltrados.forEach(p => {
                preciosRowsHtml += `
                    <tr class="hover:bg-blue-50/50 border-b border-slate-100 text-[11px] text-slate-700">
                        <td class="px-2.5 py-1 whitespace-nowrap font-medium text-slate-800 border-r border-slate-100 max-w-[140px] truncate" title="${p.nomCorporativo}">${p.nomCorporativo}</td>
                        <td class="px-2.5 py-1 text-center font-mono font-medium text-slate-600 border-r border-slate-100">${p.diaFecha}</td>
                        <td class="px-2.5 py-1 text-right font-mono font-bold text-blue-700 border-r border-slate-100">${p.tdoc_01 !== null ? formatCurrency(p.tdoc_01) : '-'}</td>
                        <td class="px-2.5 py-1 text-right font-mono font-bold text-blue-800 border-r border-slate-100">${p.tdoc_03 !== null ? formatCurrency(p.tdoc_03) : '-'}</td>
                        <td class="px-2.5 py-1 text-right font-mono font-bold text-teal-700">${p.tdoc_07 !== null ? formatCurrency(p.tdoc_07) : '-'}</td>
                    </tr>
                `;
            });
        }

        // 3. Construir Filas de MotivosNCVentas
        const rawMotivos = this.datosBackend.motivos_nc_ventas || [];
        const motivosFiltrados = this.corporativoSeleccionado 
            ? rawMotivos.filter(m => m.nomCorporativo === this.corporativoSeleccionado)
            : rawMotivos;

        let motivosRowsHtml = '';
        if (motivosFiltrados.length === 0) {
            motivosRowsHtml = `
                <tr>
                    <td colspan="7" class="px-4 py-6 text-center text-slate-400 font-medium">
                        No hay motivos de NC registrados para el corporativo seleccionado.
                    </td>
                </tr>
            `;
        } else {
            motivosFiltrados.forEach(m => {
                motivosRowsHtml += `
                    <tr class="hover:bg-blue-50/50 border-b border-slate-100 text-[11px] text-slate-700">
                        <td class="px-2 py-1 whitespace-nowrap font-medium text-slate-800 border-r border-slate-100 max-w-[130px] truncate" title="${m.nomCorporativo}">${m.nomCorporativo}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${m.tdoc}</td>
                        <td class="px-2 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${m.diaFecha}</td>
                        <td class="px-2 py-1 whitespace-nowrap text-slate-700 border-r border-slate-100 max-w-[150px] truncate" title="${m.motivo}">${m.motivo || '-'}</td>
                        <td class="px-2 py-1 text-right font-mono font-medium text-slate-800 border-r border-slate-100">${formatCurrency(m.importeIgv)}</td>
                        <td class="px-2 py-1 text-right font-mono font-medium text-slate-800 border-r border-slate-100">${formatNumber(m.peso, 2)} KGS</td>
                        <td class="px-2 py-1 text-right font-mono font-bold text-teal-700">${formatCurrency(m.puConIgvKgs)}</td>
                    </tr>
                `;
            });
        }

        // Layout unificado de 3 paneles
        contenedorGrafica.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- ========================================== -->
                <!-- PANEL 1: PARETOVENTAS (SUPERIOR)           -->
                <!-- ========================================== -->
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div class="flex items-center gap-3">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">ParetoVentas</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Ranking comparativo por Corporativo (Haz clic en una fila para filtrar los paneles inferiores)</span>
                            </div>
                            ${this.corporativoSeleccionado ? `
                                <button id="btn-limpiar-seleccion-corp" type="button" class="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-all">
                                    Ver todos (${this.corporativoSeleccionado}) ✕
                                </button>
                            ` : ''}
                        </div>
                        <button id="btn-export-excel-regalo-els" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>

                    <div class="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar w-full">
                        <table id="tabla-pareto-ventas" class="w-full text-left border-collapse table-auto select-none text-[11px]">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-700 shadow-xs">
                                <tr>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 w-24 font-semibold">CodCorporativo</th>
                                    <th class="px-2 py-1.5 border-r border-blue-500/40 font-semibold whitespace-nowrap min-w-[180px]">NomCoorporativo</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold min-w-[140px]">Cantidad</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold min-w-[150px]">Peso</th>
                                    <th class="px-2 py-1.5 text-center border-r border-blue-500/40 font-semibold min-w-[150px]">Importe</th>
                                    <th class="px-2 py-1.5 text-center font-semibold min-w-[110px]">% de total Peso</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 bg-white">
                                ${paretoRowsHtml}
                            </tbody>
                            <tfoot class="sticky bottom-0 z-20 bg-slate-100 font-bold border-t-2 border-slate-300 shadow-md text-[10px] text-slate-600">
                                <tr>
                                    <td colspan="2" class="px-3 py-1.5 text-right uppercase tracking-wider text-slate-500 font-bold border-r border-slate-300">
                                        Escala de Métricas
                                    </td>
                                    <!-- Escala Cantidad -->
                                    <td class="px-2 py-1 border-r border-slate-300 bg-blue-50/50">
                                        <div class="flex justify-between text-[9.5px] text-blue-800 font-mono">
                                            <span>0K</span>
                                            <span>20K</span>
                                            <span>40K</span>
                                            <span>60K</span>
                                        </div>
                                    </td>
                                    <!-- Escala Peso -->
                                    <td class="px-2 py-1 border-r border-slate-300 bg-blue-50/50">
                                        <div class="flex justify-between text-[9.5px] text-blue-900 font-mono">
                                            <span>0K</span>
                                            <span>50K</span>
                                            <span>100K</span>
                                            <span>150K</span>
                                            <span>200K</span>
                                        </div>
                                    </td>
                                    <!-- Escala Importe -->
                                    <td class="px-2 py-1 border-r border-slate-300 bg-indigo-50/50">
                                        <div class="flex justify-between text-[9.5px] text-indigo-900 font-mono">
                                            <span>0K</span>
                                            <span>200K</span>
                                            <span>400K</span>
                                            <span>600K</span>
                                            <span>1000K</span>
                                        </div>
                                    </td>
                                    <!-- Escala % Peso -->
                                    <td class="px-2 py-1 bg-teal-50/50">
                                        <div class="flex justify-between text-[9.5px] text-teal-900 font-mono">
                                            <span>0%</span>
                                            <span>4%</span>
                                            <span>8%</span>
                                            <span>12%</span>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- ========================================== -->
                <!-- PANELES INFERIORES EN 2 COLUMNAS (1X2)     -->
                <!-- ========================================== -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- PANEL 2: PRECIOVENTAS (IZQUIERDA - 5 COLS XL) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">PrecioVentas</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Evolución de P.U. con IGV por TDOC</span>
                            </div>
                            <button id="btn-export-excel-precios-els" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar bg-white">
                            <table id="tabla-precio-ventas" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th rowspan="2" class="px-2.5 py-1.5 border-r border-blue-500/40 text-left align-middle font-semibold">NomCoorpora..</th>
                                        <th rowspan="2" class="px-2.5 py-1.5 border-r border-blue-500/40 text-center align-middle font-semibold">Día de Fech..</th>
                                        <th colspan="3" class="px-2.5 py-1 text-center font-semibold bg-blue-700 border-b border-blue-500/40">Tdoc</th>
                                    </tr>
                                    <tr>
                                        <th class="px-2.5 py-1 text-center font-semibold border-r border-blue-500/40 min-w-[70px]">01</th>
                                        <th class="px-2.5 py-1 text-center font-semibold border-r border-blue-500/40 min-w-[70px]">03</th>
                                        <th class="px-2.5 py-1 text-center font-semibold min-w-[70px]">07</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 bg-white">
                                    ${preciosRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- PANEL 3: MOTIVOSNCVENTAS (DERECHA - 7 COLS XL) -->
                    <div class="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">MotivosNCVentas</h2>
                                <span class="text-[11px] text-slate-400 font-medium">Detalle de Notas de Crédito, Motivos y Valores</span>
                            </div>
                            <button id="btn-export-excel-motivos-els" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar bg-white">
                            <table id="tabla-motivos-nc-ventas" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-left font-semibold">NomCoorporativo</th>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-center font-semibold">Tdoc</th>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-center font-semibold">Día de Fech..</th>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-left font-semibold">Motivo</th>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-right font-semibold">ImporteIgv</th>
                                        <th class="px-2 py-1.5 border-r border-blue-500/40 text-right font-semibold">Peso</th>
                                        <th class="px-2 py-1.5 text-right font-semibold">PUconIGV_Kgs</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 bg-white">
                                    ${motivosRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        `;
    },

    attachInteractiveListeners() {
        const rows = document.querySelectorAll('.pareto-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const corp = row.getAttribute('data-corp');
                if (this.corporativoSeleccionado === corp) {
                    this.corporativoSeleccionado = null;
                } else {
                    this.corporativoSeleccionado = corp;
                }
                this.renderDashboardLayout();
                this.attachInteractiveListeners();
                this.attachTooltips();
                this.setupExportListeners();
            });
        });

        document.getElementById('btn-limpiar-seleccion-corp')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.corporativoSeleccionado = null;
            this.renderDashboardLayout();
            this.attachInteractiveListeners();
            this.attachTooltips();
            this.setupExportListeners();
        });
    },

    attachTooltips() {
        const rows = document.querySelectorAll('.pareto-row');
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
                            ${item.nomCorporativo} (${item.codCorporativo})
                        </div>
                        <div class="space-y-0.5 text-[11px]">
                            <div class="flex justify-between"><span class="font-semibold text-slate-500">Cantidad:</span> <span class="font-bold text-slate-800">${formatNum(item.cantidad)} UND</span></div>
                            <div class="flex justify-between"><span class="font-semibold text-slate-500">Peso:</span> <span class="font-bold text-blue-900">${formatNum(item.peso)} KGS</span></div>
                            <div class="flex justify-between"><span class="font-semibold text-slate-500">Importe:</span> <span class="font-bold text-blue-700">S/ ${formatNum(item.importe)}</span></div>
                            <div class="flex justify-between"><span class="font-semibold text-slate-500">% de total Peso:</span> <span class="font-bold text-teal-700">${formatNum(item.porcPeso)}%</span></div>
                        </div>
                    </div>
                `;

                tooltip.classList.remove('hidden');
                tooltip.style.display = 'block';

                const x = e.clientX + 15;
                const y = e.clientY + 15;
                const maxW = window.innerWidth - 300;
                const maxH = window.innerHeight - 200;

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
        if (typeof XLSX === 'undefined') return;

        // Estilos oficiales bg-blue-600 y texto blanco
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

        const fechaStr = new Date().toISOString().slice(0, 10);

        // 1. EXPORTAR PARETO VENTAS (o TODO EL DASHBOARD)
        const btnExportPareto = document.getElementById('btn-export-excel-regalo-els');
        if (btnExportPareto) {
            btnExportPareto.addEventListener('click', () => {
                const paretoFilas = (this.datosBackend && this.datosBackend.pareto_ventas && this.datosBackend.pareto_ventas.filas) ? this.datosBackend.pareto_ventas.filas : [];
                const precioFilas = (this.datosBackend && this.datosBackend.precio_ventas) ? this.datosBackend.precio_ventas : [];
                const motivosFilas = (this.datosBackend && this.datosBackend.motivos_nc_ventas) ? this.datosBackend.motivos_nc_ventas : [];

                if (!paretoFilas.length && !precioFilas.length && !motivosFilas.length) {
                    alert('No hay datos disponibles para exportar.');
                    return;
                }

                const wb = XLSX.utils.book_new();

                if (paretoFilas.length > 0) {
                    const colsPareto = [
                        { label: 'CodCorporativo', key: 'codCorporativo', type: 'center', width: 16 },
                        { label: 'NomCoorporativo', key: 'nomCorporativo', type: 'left', width: 32 },
                        { label: 'Cantidad', key: 'cantidad', type: 'number', width: 16 },
                        { label: 'Peso', key: 'peso', type: 'number', width: 16 },
                        { label: 'Importe', key: 'importe', type: 'currency', width: 18 },
                        { label: '% de total Peso', key: 'porcPeso', type: 'percent', width: 16 }
                    ];

                    const headPareto = colsPareto.map(c => ({ t: 's', v: c.label, s: headerStyle }));
                    const bodyPareto = paretoFilas.map(f => colsPareto.map(c => {
                        const raw = f[c.key];
                        if (c.type === 'currency') return { t: 'n', v: Number(raw) || 0, z: '"S/ "#,##0.00', s: dataStyleRight };
                        if (c.type === 'number') return { t: 'n', v: Number(raw) || 0, z: '#,##0.00', s: dataStyleRight };
                        if (c.type === 'percent') return { t: 'n', v: (Number(raw) || 0) / 100, z: '0.00%', s: dataStyleRight };
                        if (c.type === 'center') return { t: 's', v: String(raw || ''), s: dataStyleCenter };
                        return { t: 's', v: String(raw || ''), s: dataStyleLeft };
                    }));

                    const wsPareto = XLSX.utils.aoa_to_sheet([headPareto, ...bodyPareto]);
                    wsPareto['!cols'] = colsPareto.map(c => ({ wch: c.width }));
                    XLSX.utils.book_append_sheet(wb, wsPareto, 'ParetoVentas');
                }

                if (precioFilas.length > 0) {
                    const colsPrecios = [
                        { label: 'NomCoorporativo', key: 'nomCorporativo', type: 'left', width: 32 },
                        { label: 'Día de Fecha', key: 'diaFecha', type: 'center', width: 14 },
                        { label: 'Tdoc 01', key: 'tdoc_01', type: 'currency', width: 14 },
                        { label: 'Tdoc 03', key: 'tdoc_03', type: 'currency', width: 14 },
                        { label: 'Tdoc 07', key: 'tdoc_07', type: 'currency', width: 14 }
                    ];

                    const headPrecios = colsPrecios.map(c => ({ t: 's', v: c.label, s: headerStyle }));
                    const bodyPrecios = precioFilas.map(f => colsPrecios.map(c => {
                        const raw = f[c.key];
                        if (c.type === 'currency') return { t: raw !== null ? 'n' : 's', v: raw !== null ? Number(raw) : '-', z: '"S/ "#,##0.00', s: dataStyleRight };
                        if (c.type === 'center') return { t: 's', v: String(raw || ''), s: dataStyleCenter };
                        return { t: 's', v: String(raw || ''), s: dataStyleLeft };
                    }));

                    const wsPrecios = XLSX.utils.aoa_to_sheet([headPrecios, ...bodyPrecios]);
                    wsPrecios['!cols'] = colsPrecios.map(c => ({ wch: c.width }));
                    XLSX.utils.book_append_sheet(wb, wsPrecios, 'PrecioVentas');
                }

                if (motivosFilas.length > 0) {
                    const colsMotivos = [
                        { label: 'NomCoorporativo', key: 'nomCorporativo', type: 'left', width: 32 },
                        { label: 'Tdoc', key: 'tdoc', type: 'center', width: 10 },
                        { label: 'Día de Fecha', key: 'diaFecha', type: 'center', width: 14 },
                        { label: 'Motivo', key: 'motivo', type: 'left', width: 28 },
                        { label: 'ImporteIgv', key: 'importeIgv', type: 'currency', width: 16 },
                        { label: 'Peso', key: 'peso', type: 'number', width: 16 },
                        { label: 'PUconIGV_Kgs', key: 'puConIgvKgs', type: 'currency', width: 16 }
                    ];

                    const headMotivos = colsMotivos.map(c => ({ t: 's', v: c.label, s: headerStyle }));
                    const bodyMotivos = motivosFilas.map(f => colsMotivos.map(c => {
                        const raw = f[c.key];
                        if (c.type === 'currency') return { t: 'n', v: Number(raw) || 0, z: '"S/ "#,##0.00', s: dataStyleRight };
                        if (c.type === 'number') return { t: 'n', v: Number(raw) || 0, z: '#,##0.00', s: dataStyleRight };
                        if (c.type === 'center') return { t: 's', v: String(raw || ''), s: dataStyleCenter };
                        return { t: 's', v: String(raw || ''), s: dataStyleLeft };
                    }));

                    const wsMotivos = XLSX.utils.aoa_to_sheet([headMotivos, ...bodyMotivos]);
                    wsMotivos['!cols'] = colsMotivos.map(c => ({ wch: c.width }));
                    XLSX.utils.book_append_sheet(wb, wsMotivos, 'MotivosNCVentas');
                }

                XLSX.writeFile(wb, `DashRegaloELS_Completo_${fechaStr}.xlsx`);
            });
        }

        // 2. EXPORTAR PRECIO VENTAS INDIVIDUAL
        const btnExportPrecios = document.getElementById('btn-export-excel-precios-els');
        if (btnExportPrecios) {
            btnExportPrecios.addEventListener('click', () => {
                const rawPrecios = (this.datosBackend && this.datosBackend.precio_ventas) ? this.datosBackend.precio_ventas : [];
                const precioFilas = this.corporativoSeleccionado
                    ? rawPrecios.filter(p => p.nomCorporativo === this.corporativoSeleccionado)
                    : rawPrecios;

                if (!precioFilas.length) {
                    alert('No hay datos de precios disponibles para exportar.');
                    return;
                }

                const wb = XLSX.utils.book_new();
                const colsPrecios = [
                    { label: 'NomCoorporativo', key: 'nomCorporativo', type: 'left', width: 32 },
                    { label: 'Día de Fecha', key: 'diaFecha', type: 'center', width: 14 },
                    { label: 'Tdoc 01', key: 'tdoc_01', type: 'currency', width: 14 },
                    { label: 'Tdoc 03', key: 'tdoc_03', type: 'currency', width: 14 },
                    { label: 'Tdoc 07', key: 'tdoc_07', type: 'currency', width: 14 }
                ];

                const headPrecios = colsPrecios.map(c => ({ t: 's', v: c.label, s: headerStyle }));
                const bodyPrecios = precioFilas.map(f => colsPrecios.map(c => {
                    const raw = f[c.key];
                    if (c.type === 'currency') return { t: raw !== null ? 'n' : 's', v: raw !== null ? Number(raw) : '-', z: '"S/ "#,##0.00', s: dataStyleRight };
                    if (c.type === 'center') return { t: 's', v: String(raw || ''), s: dataStyleCenter };
                    return { t: 's', v: String(raw || ''), s: dataStyleLeft };
                }));

                const wsPrecios = XLSX.utils.aoa_to_sheet([headPrecios, ...bodyPrecios]);
                wsPrecios['!cols'] = colsPrecios.map(c => ({ wch: c.width }));
                XLSX.utils.book_append_sheet(wb, wsPrecios, 'PrecioVentas');

                const sufijo = this.corporativoSeleccionado ? `_${this.corporativoSeleccionado.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
                XLSX.writeFile(wb, `PrecioVentas${sufijo}_${fechaStr}.xlsx`);
            });
        }

        // 3. EXPORTAR MOTIVOS NC VENTAS INDIVIDUAL
        const btnExportMotivos = document.getElementById('btn-export-excel-motivos-els');
        if (btnExportMotivos) {
            btnExportMotivos.addEventListener('click', () => {
                const rawMotivos = (this.datosBackend && this.datosBackend.motivos_nc_ventas) ? this.datosBackend.motivos_nc_ventas : [];
                const motivosFilas = this.corporativoSeleccionado
                    ? rawMotivos.filter(m => m.nomCorporativo === this.corporativoSeleccionado)
                    : rawMotivos;

                if (!motivosFilas.length) {
                    alert('No hay datos de motivos NC disponibles para exportar.');
                    return;
                }

                const wb = XLSX.utils.book_new();
                const colsMotivos = [
                    { label: 'NomCoorporativo', key: 'nomCorporativo', type: 'left', width: 32 },
                    { label: 'Tdoc', key: 'tdoc', type: 'center', width: 10 },
                    { label: 'Día de Fecha', key: 'diaFecha', type: 'center', width: 14 },
                    { label: 'Motivo', key: 'motivo', type: 'left', width: 28 },
                    { label: 'ImporteIgv', key: 'importeIgv', type: 'currency', width: 16 },
                    { label: 'Peso', key: 'peso', type: 'number', width: 16 },
                    { label: 'PUconIGV_Kgs', key: 'puConIgvKgs', type: 'currency', width: 16 }
                ];

                const headMotivos = colsMotivos.map(c => ({ t: 's', v: c.label, s: headerStyle }));
                const bodyMotivos = motivosFilas.map(f => colsMotivos.map(c => {
                    const raw = f[c.key];
                    if (c.type === 'currency') return { t: 'n', v: Number(raw) || 0, z: '"S/ "#,##0.00', s: dataStyleRight };
                    if (c.type === 'number') return { t: 'n', v: Number(raw) || 0, z: '#,##0.00', s: dataStyleRight };
                    if (c.type === 'center') return { t: 's', v: String(raw || ''), s: dataStyleCenter };
                    return { t: 's', v: String(raw || ''), s: dataStyleLeft };
                }));

                const wsMotivos = XLSX.utils.aoa_to_sheet([headMotivos, ...bodyMotivos]);
                wsMotivos['!cols'] = colsMotivos.map(c => ({ wch: c.width }));
                XLSX.utils.book_append_sheet(wb, wsMotivos, 'MotivosNCVentas');

                const sufijo = this.corporativoSeleccionado ? `_${this.corporativoSeleccionado.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
                XLSX.writeFile(wb, `MotivosNCVentas${sufijo}_${fechaStr}.xlsx`);
            });
        }
    }
};

// Registrar en ChartRegistry para acceso polimórfico
window.ChartRegistry['DashRegaloELS'] = window.DashRegaloELSChart;
window.ChartRegistry['RegaloELS'] = window.DashRegaloELSChart;

