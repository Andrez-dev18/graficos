/**
 * Módulo Frontend para CP05 AnalisisContableCostosDiarios
 * Dashboard Contable de Costos Diarios compuesto por 4 tablas interactivas:
 * 1. Tabla 1 (Arriba Izquierda): "Costo Produccion por Kg de Pollo Vivo" (linea, nomlinea, valor, Kilos Prod, CU)
 * 2. Tabla 2 (Arriba Derecha): "Costo Produccion por Kg de Pollo Vivo" (linea, codigo, cantidad, peso, valor, saca_kilos, CU)
 * 3. Tabla 3 (Abajo Izquierda): "Costo Produccion por Kg de Pollo Vivo/Linea" (cencos, linea, cantidad, peso, valor, saca_kilos, CU)
 * 4. Tabla 4 (Abajo Derecha): "Costo Unitario por Linea/Cencos/Galpon" (cencos, galpon, linea, cantidad, peso, valor, saca_kilos, CU)
 * 
 * Características:
 * - Cabeceras de tabla: bg-blue-600 text-white
 * - Agrupación visual idéntica a Tableau con bordes sutiles entre grupos
 * - Filtro Multiselect por Clasificación ([linea] + " " + [nomlinea])
 * - Filtro Cruzado: Clic en una fila de la Tabla 1 filtra el detalle en las demás tablas
 * - Buscador rápido individual en tablas de detalle
 * - Tooltips flotantes estilo Tableau
 * - Totales generales y CU en el pie de cada tabla
 */
window.ChartRegistry = window.ChartRegistry || {};

const CP05_DEFINITION = {
    controller: null,
    datosBackend: null,
    multiClasif: null,
    lineaSeleccionada: null,
    busquedaT2: '',
    busquedaT3: '',
    busquedaT4: '',

    destroy() {
        this.hideTooltip();
        this.lineaSeleccionada = null;
        this.busquedaT2 = '';
        this.busquedaT3 = '';
        this.busquedaT4 = '';
    },

    formatNum(val, decimals = 0) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        const num = Number(val);
        const fixed = num.toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimals > 0 ? parts.join(',') : parts[0];
    },

    formatFecha(fechaStr) {
        if (!fechaStr) return '';
        const parts = String(fechaStr).split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return fechaStr;
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';

        if (data.fecha) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatFecha(data.fecha)}</span>
            `;
        }

        if (data.cencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">cencos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.cencos}</span>
            `;
        }

        if (data.nomcencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomcencos:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomcencos}</span>
            `;
        }

        if (data.galpon !== undefined && data.galpon !== null && data.galpon !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">galpon:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.galpon}</span>
            `;
        }

        if (data.linea) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">linea:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.linea}</span>
            `;
        }

        if (data.nomlinea) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomlinea:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomlinea}</span>
            `;
        }

        if (data.codigo) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">codigo:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.codigo}</span>
            `;
        }

        if (data.nomcodigo) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomcodigo:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomcodigo}</span>
            `;
        }

        if (data.cantidad !== undefined && data.cantidad !== null && data.cantidad !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">cantidad:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.cantidad, 2)}</span>
            `;
        }

        if (data.peso !== undefined && data.peso !== null && data.peso !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">peso:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.peso, 2)}</span>
            `;
        }

        if (data.valor !== undefined && data.valor !== null && data.valor !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">valor:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-900">${this.formatNum(data.valor, 2)}</span>
            `;
        }

        if (data.kilos_prod !== undefined && data.kilos_prod !== null && data.kilos_prod !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Kilos Prod:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.kilos_prod, 2)}</span>
            `;
        }

        if (data.saca_kilos !== undefined && data.saca_kilos !== null && data.saca_kilos !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">saca_kilos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.saca_kilos, 2)}</span>
            `;
        }

        if (data.cu !== undefined && data.cu !== null && data.cu !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">CU:</span>
                <span class="font-bold text-blue-700 text-left font-mono text-xs">${this.formatNum(data.cu, 3)}</span>
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

    getSelectedFilters() {
        if (this.multiClasif) {
            const selected = typeof this.multiClasif.getSelectedValues === 'function' 
                ? this.multiClasif.getSelectedValues() 
                : (this.multiClasif.options ? this.multiClasif.options.filter(o => o.selected).map(o => o.id) : []);
            if (selected && selected.length > 0 && selected.length < this.multiClasif.options.length) {
                return { clasificacion: selected };
            }
        }
        return {};
    },

    render(controller, data) {
        this.controller = controller;
        this.datosBackend = data || {};
        this.lineaSeleccionada = null;

        // 1. Ocultar cabecera redundante superior
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar inferior
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Configurar y mostrar filtro multiselect de Clasificación
        this.setupFilters(this.datosBackend);

        // 4. Renderizar layout visual de 4 tablas
        this.renderLayout();
    },

    setupFilters(data) {
        const contFiltro = document.getElementById('contenedor-filtro-clasificacion-cp05');
        if (contFiltro) contFiltro.classList.remove('hidden');

        const clasifsDisp = (data.filtros_disponibles && data.filtros_disponibles.clasificaciones) || [];

        if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0) {
            const optClasif = clasifsDisp.map(c => {
                const id = (c.clasificacion || `${c.linea} ${c.nomlinea}`).trim();
                return {
                    id: id,
                    label: id,
                    selected: true
                };
            });

            if (!this.multiClasif) {
                this.multiClasif = new CustomMultiSelect({
                    btnId: 'btn-dropdown-clasificacion-cp05',
                    dropdownId: 'dropdown-clasificacion-cp05',
                    optionsContainerId: 'container-options-clasificacion-cp05',
                    labelId: 'label-clasificacion-cp05',
                    searchId: 'search-clasificacion-cp05',
                    title: 'Clasificación',
                    options: optClasif,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiClasif.setOptions(optClasif);
            }
        }
    },

    filtrarLocalmente() {
        if (!this.datosBackend) return;

        const selectedClasif = this.multiClasif 
            ? (typeof this.multiClasif.getSelectedValues === 'function' 
                ? this.multiClasif.getSelectedValues() 
                : (this.multiClasif.options ? this.multiClasif.options.filter(o => o.selected).map(o => o.id) : [])) 
            : [];
        const isAll = !selectedClasif || selectedClasif.length === 0 || (this.multiClasif && this.multiClasif.options && selectedClasif.length === this.multiClasif.options.length);

        const allT1 = (this.datosBackend.tabla1_resumen && this.datosBackend.tabla1_resumen.filas) || [];
        const allT2 = (this.datosBackend.tabla2_por_codigo && this.datosBackend.tabla2_por_codigo.filas) || [];
        const allT3 = (this.datosBackend.tabla3_por_cencos_linea && this.datosBackend.tabla3_por_cencos_linea.filas) || [];
        const allT4 = (this.datosBackend.tabla4_por_galpon_linea && this.datosBackend.tabla4_por_galpon_linea.filas) || [];

        const matchClasif = (r) => {
            if (isAll) return true;
            const c1 = (r.clasificacion || `${r.linea} ${r.nomlinea}`).trim();
            const c2 = (r.linea || '').trim();
            return selectedClasif.some(sel => sel.trim() === c1 || sel.trim() === c2 || sel.trim().startsWith(c2 + ' '));
        };

        // 1. Filtrar Tabla 1
        const t1Filtrada = allT1.filter(matchClasif);

        // 2. Filtrar Tabla 2
        let t2Filtrada = allT2.filter(matchClasif);
        if (this.lineaSeleccionada) {
            t2Filtrada = t2Filtrada.filter(d => String(d.linea).trim() === String(this.lineaSeleccionada).trim());
        }
        if (this.busquedaT2 && this.busquedaT2.trim() !== '') {
            const term = this.busquedaT2.trim().toLowerCase();
            t2Filtrada = t2Filtrada.filter(d => 
                (d.codigo && String(d.codigo).toLowerCase().includes(term)) ||
                (d.nomcodigo && String(d.nomcodigo).toLowerCase().includes(term)) ||
                (d.linea && String(d.linea).toLowerCase().includes(term)) ||
                (d.nomlinea && String(d.nomlinea).toLowerCase().includes(term))
            );
        }

        // 3. Filtrar Tabla 3
        let t3Filtrada = allT3.filter(matchClasif);
        if (this.lineaSeleccionada) {
            t3Filtrada = t3Filtrada.filter(d => String(d.linea).trim() === String(this.lineaSeleccionada).trim());
        }
        if (this.busquedaT3 && this.busquedaT3.trim() !== '') {
            const term = this.busquedaT3.trim().toLowerCase();
            t3Filtrada = t3Filtrada.filter(d => 
                (d.cencos && String(d.cencos).toLowerCase().includes(term)) ||
                (d.nomcencos && String(d.nomcencos).toLowerCase().includes(term)) ||
                (d.linea && String(d.linea).toLowerCase().includes(term)) ||
                (d.nomlinea && String(d.nomlinea).toLowerCase().includes(term))
            );
        }

        // 4. Filtrar Tabla 4
        let t4Filtrada = allT4.filter(matchClasif);
        if (this.lineaSeleccionada) {
            t4Filtrada = t4Filtrada.filter(d => String(d.linea).trim() === String(this.lineaSeleccionada).trim());
        }
        if (this.busquedaT4 && this.busquedaT4.trim() !== '') {
            const term = this.busquedaT4.trim().toLowerCase();
            t4Filtrada = t4Filtrada.filter(d => 
                (d.cencos && String(d.cencos).toLowerCase().includes(term)) ||
                (d.nomcencos && String(d.nomcencos).toLowerCase().includes(term)) ||
                (d.galpon && String(d.galpon).toLowerCase().includes(term)) ||
                (d.linea && String(d.linea).toLowerCase().includes(term)) ||
                (d.nomlinea && String(d.nomlinea).toLowerCase().includes(term))
            );
        }

        this.renderTabla1(t1Filtrada);
        this.renderTabla2(t2Filtrada);
        this.renderTabla3(t3Filtrada);
        this.renderTabla4(t4Filtrada);
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const allT1 = (this.datosBackend.tabla1_resumen && this.datosBackend.tabla1_resumen.filas) || [];

        if (allT1.length === 0) {
            contenedor.className = "flex flex-col w-full p-8 bg-slate-50 items-center justify-center text-center";
            contenedor.innerHTML = `
                <div class="p-4 bg-blue-50 text-blue-600 rounded-full mb-3">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-700 uppercase">Sin Datos Disponibles</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-sm">No se encontraron registros contables para la fecha seleccionada (${this.datosBackend.fecha_formateada || this.datosBackend.fecha || ''}).</p>
            `;
            return;
        }

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CP05 ANALISIS CONTABLE COSTOS DIARIOS (2X2 GRID) -->
            <div class="w-full flex flex-col gap-6">

                <!-- FILA 1: TABLA 1 (RESUMEN) Y TABLA 2 (POR CÓDIGO) -->
                <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    
                    <!-- TABLA 1: Costo Produccion por Kg de Pollo Vivo -->
                    <div class="xl:col-span-5 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Costo Produccion por Kg de Pollo Vivo</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp05-badge-t1" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    ${allT1.length} Líneas
                                </span>
                                <button id="cp05-btn-export-t1" type="button"
                                    class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-md transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>
                        <div class="w-full overflow-x-auto max-h-[500px] custom-scrollbar">
                            <table id="tabla-cp05-t1" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold shadow-xs">
                                    <tr>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200 w-12">linea</th>
                                        <th class="px-3 py-2 text-left border-r border-slate-200">nomlinea</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">Kilos Prod</th>
                                        <th class="px-3 py-2 text-right">CU</th>
                                    </tr>
                                </thead>
                                <tbody id="cp05-tbody-t1" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp05-tfoot-t1" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- TABLA 2: Costo Produccion por Kg de Pollo Vivo (Por Código) -->
                    <div class="xl:col-span-7 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Costo Produccion por Kg de Pollo Vivo</h3>
                                <span id="cp05-badge-t2-filtro" class="hidden text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                    Filtrado
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp05-badge-t2" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Reg
                                </span>
                                <button id="cp05-btn-export-t2" type="button"
                                    class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-md transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>
                        <div class="w-full overflow-x-auto max-h-[500px] custom-scrollbar">
                            <table id="tabla-cp05-t2" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200">codigo</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">saca_kilos</th>
                                        <th class="px-2.5 py-2 text-right">CU</th>
                                    </tr>
                                </thead>
                                <tbody id="cp05-tbody-t2" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp05-tfoot-t2" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- FILA 2: TABLA 3 (POR CENCOS/LÍNEA) Y TABLA 4 (POR CENCOS/GALPÓN/LÍNEA) -->
                <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

                    <!-- TABLA 3: Costo Produccion por Kg de Pollo Vivo/Linea -->
                    <div class="xl:col-span-5 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Costo Produccion por Kg de Pollo Vivo/Linea</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp05-badge-t3" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Reg
                                </span>
                                <button id="cp05-btn-export-t3" type="button"
                                    class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-md transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>
                        <div class="w-full overflow-x-auto max-h-[500px] custom-scrollbar">
                            <table id="tabla-cp05-t3" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                        <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">saca_kilos</th>
                                        <th class="px-2.5 py-2 text-right">CU</th>
                                    </tr>
                                </thead>
                                <tbody id="cp05-tbody-t3" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp05-tfoot-t3" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- TABLA 4: Costo Unitario por Linea/Cencos/Galpon -->
                    <div class="xl:col-span-7 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Costo Unitario por Linea/Cencos/Galpon</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp05-badge-t4" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Reg
                                </span>
                                <button id="cp05-btn-export-t4" type="button"
                                    class="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-md transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>
                        <div class="w-full overflow-x-auto max-h-[500px] custom-scrollbar">
                            <table id="tabla-cp05-t4" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                        <th class="px-1.5 py-2 border-r border-slate-200">galpon</th>
                                        <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">saca_kilos</th>
                                        <th class="px-2.5 py-2 text-right">CU</th>
                                    </tr>
                                </thead>
                                <tbody id="cp05-tbody-t4" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp05-tfoot-t4" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        `;

        const inT4 = document.getElementById('cp05-buscar-t4');
        if (inT4) {
            inT4.addEventListener('input', (e) => {
                this.busquedaT4 = e.target.value;
                this.filtrarLocalmente();
            });
        }

        // Configurar exportación a Excel para las 4 tablas de CP05
        const fechaNom = (this.datosBackend.fecha || 'general').replace(/[^a-zA-Z0-9]/g, '_');
        const sufijoLinea = this.lineaSeleccionada ? `_Linea_${this.lineaSeleccionada}` : '';

        const btnT1 = document.getElementById('cp05-btn-export-t1');
        if (btnT1) {
            btnT1.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp05-t1', `CP05_Costo_Produccion_Resumen_${fechaNom}`);
                }
            };
        }

        const btnT2 = document.getElementById('cp05-btn-export-t2');
        if (btnT2) {
            btnT2.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp05-t2', `CP05_Costo_Produccion_Por_Codigo${sufijoLinea}_${fechaNom}`);
                }
            };
        }

        const btnT3 = document.getElementById('cp05-btn-export-t3');
        if (btnT3) {
            btnT3.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp05-t3', `CP05_Costo_Produccion_Cencos_Linea${sufijoLinea}_${fechaNom}`);
                }
            };
        }

        const btnT4 = document.getElementById('cp05-btn-export-t4');
        if (btnT4) {
            btnT4.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp05-t4', `CP05_Costo_Unitario_Cencos_Galpon_Linea${sufijoLinea}_${fechaNom}`);
                }
            };
        }

        this.filtrarLocalmente();
    },

    renderTabla1(filas) {
        const tbody = document.getElementById('cp05-tbody-t1');
        const tfoot = document.getElementById('cp05-tfoot-t1');
        const badge = document.getElementById('cp05-badge-t1');
        if (!tbody || !tfoot) return;

        if (badge) badge.textContent = `${filas.length} Líneas`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 italic">No hay registros</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalValor = 0.0;
        let kilosProdDia = 0.0;

        let rowsHtml = '';
        filas.forEach(r => {
            const val = Number(r.valor) || 0;
            const kg  = Number(r.kilos_prod) || 0;
            const cu  = (kg > 0) ? (val / kg) : (Number(r.cu) || 0);

            if (kilosProdDia === 0 && kg > 0) {
                kilosProdDia = kg;
            }
            totalValor += val;

            const isSelected = this.lineaSeleccionada && String(this.lineaSeleccionada).trim() === String(r.linea).trim();
            const rowClass = isSelected
                ? "bg-blue-100/90 font-semibold text-blue-900 cursor-pointer"
                : "hover:bg-slate-100 cursor-pointer transition-colors";

            rowsHtml += `
                <tr class="cp05-row-t1 ${rowClass}" 
                    data-linea="${r.linea || ''}" 
                    data-nomlinea="${r.nomlinea || ''}"
                    data-valor="${val}"
                    data-kilos_prod="${kg}"
                    data-cu="${cu.toFixed(3)}"
                    data-fecha="${this.datosBackend.fecha || ''}">
                    <td class="px-2.5 py-1.5 font-mono text-slate-500 border-r border-slate-100">${r.linea || ''}</td>
                    <td class="px-3 py-1.5 font-medium text-slate-800 border-r border-slate-100">${r.nomlinea || ''}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(kg, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        const totalCU = (kilosProdDia > 0) ? (totalValor / kilosProdDia) : 0;

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2.5 py-2 text-left border-r border-slate-200"></td>
                <td class="px-3 py-2 text-left font-bold text-slate-900 border-r border-slate-200 uppercase">Total general</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalValor, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-700 border-r border-slate-200">${this.formatNum(kilosProdDia, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
            </tr>
        `;

        this.bindTabla1Events();
    },

    bindTabla1Events() {
        const rows = document.querySelectorAll('.cp05-row-t1');
        const self = this;

        rows.forEach(tr => {
            tr.addEventListener('click', function () {
                const linea = this.getAttribute('data-linea');
                if (self.lineaSeleccionada === linea) {
                    self.lineaSeleccionada = null;
                } else {
                    self.lineaSeleccionada = linea;
                }
                self.filtrarLocalmente();
            });

            tr.addEventListener('mouseenter', function (e) {
                self.showTooltip(e, {
                    fecha: this.getAttribute('data-fecha'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    valor: this.getAttribute('data-valor'),
                    kilos_prod: this.getAttribute('data-kilos_prod'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mousemove', function (e) {
                self.showTooltip(e, {
                    fecha: this.getAttribute('data-fecha'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    valor: this.getAttribute('data-valor'),
                    kilos_prod: this.getAttribute('data-kilos_prod'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mouseleave', function () {
                self.hideTooltip();
            });
        });
    },

    renderTabla2(filas) {
        const tbody = document.getElementById('cp05-tbody-t2');
        const tfoot = document.getElementById('cp05-tfoot-t2');
        const badge = document.getElementById('cp05-badge-t2');
        const badgeFiltro = document.getElementById('cp05-badge-t2-filtro');
        if (!tbody || !tfoot) return;

        if (badge) badge.textContent = `${filas.length} Reg`;
        if (badgeFiltro) {
            badgeFiltro.classList.toggle('hidden', !this.lineaSeleccionada);
            if (this.lineaSeleccionada) {
                badgeFiltro.textContent = `Línea: ${this.lineaSeleccionada}`;
            }
        }

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 italic">No hay registros coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalCant = 0.0;
        let totalPeso = 0.0;
        let totalVal  = 0.0;
        let globalKilosProd = 0.0;

        let lastLinea = null;
        let rowsHtml = '';

        filas.forEach(r => {
            const cant = Number(r.cantidad) || 0;
            const peso = Number(r.peso) || 0;
            const val  = Number(r.valor) || 0;
            const kg   = Number(r.saca_kilos) || 0;
            const cu   = (r.cu !== undefined && r.cu !== null) ? Number(r.cu) : ((kg > 0) ? (val / kg) : 0);

            if (globalKilosProd === 0 && kg > 0) {
                globalKilosProd = kg;
            }

            totalCant += cant;
            totalPeso += peso;
            totalVal  += val;

            const currentLinea = String(r.linea || '').trim();
            const isNewLinea = currentLinea !== lastLinea;
            lastLinea = currentLinea;

            const groupBorderClass = isNewLinea ? "border-t border-slate-300 bg-slate-50/20" : "";
            const lineaDisplay = isNewLinea ? `<span class="font-bold text-slate-700 font-mono">${currentLinea}</span>` : '';

            rowsHtml += `
                <tr class="cp05-row-t2 hover:bg-blue-50/50 transition-colors ${groupBorderClass}"
                    data-linea="${r.linea || ''}"
                    data-nomlinea="${r.nomlinea || ''}"
                    data-codigo="${r.codigo || ''}"
                    data-nomcodigo="${r.nomcodigo || ''}"
                    data-cantidad="${cant}"
                    data-peso="${peso}"
                    data-valor="${val}"
                    data-saca_kilos="${kg}"
                    data-cu="${cu.toFixed(3)}"
                    data-fecha="${this.datosBackend.fecha || ''}">
                    <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${lineaDisplay}</td>
                    <td class="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap" title="${r.nomcodigo || ''}">
                        <div class="flex items-center gap-1.5">
                            <span class="font-semibold text-blue-900">${r.codigo || ''}</span>
                            <span class="text-[11px] text-slate-500 truncate max-w-[180px]">${r.nomcodigo || ''}</span>
                        </div>
                    </td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${cant !== 0 ? this.formatNum(cant, 2) : '-'}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${peso !== 0 ? this.formatNum(peso, 2) : '-'}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-semibold">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(kg, 2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        const t2Totales = (this.datosBackend.tabla2_por_codigo && this.datosBackend.tabla2_por_codigo.totales) || {};
        const totalCU = (t2Totales.cu !== undefined) ? Number(t2Totales.cu) : ((globalKilosProd > 0) ? (totalVal / globalKilosProd) : 0);

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-2 text-center border-r border-slate-200"></td>
                <td class="px-2.5 py-2 text-left font-bold text-slate-900 border-r border-slate-200 uppercase">Total general</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalCant, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalVal, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-700 border-r border-slate-200">${this.formatNum(globalKilosProd, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
            </tr>
        `;

        this.bindTooltipEvents('.cp05-row-t2');
    },

    renderTabla3(filas) {
        const tbody = document.getElementById('cp05-tbody-t3');
        const tfoot = document.getElementById('cp05-tfoot-t3');
        const badge = document.getElementById('cp05-badge-t3');
        if (!tbody || !tfoot) return;

        if (badge) badge.textContent = `${filas.length} Reg`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 italic">No hay registros coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalCant = 0.0;
        let totalPeso = 0.0;
        let totalVal  = 0.0;
        let globalKilosProd = 0.0;

        let lastCencos = null;
        let rowsHtml = '';

        filas.forEach(r => {
            const cant = Number(r.cantidad) || 0;
            const peso = Number(r.peso) || 0;
            const val  = Number(r.valor) || 0;
            const kg   = Number(r.saca_kilos) || 0;
            const cu   = (r.cu !== undefined && r.cu !== null) ? Number(r.cu) : ((kg > 0) ? (val / kg) : 0);

            totalCant += cant;
            totalPeso += peso;
            totalVal  += val;

            const currentCencos = String(r.cencos || '').trim();
            const isNewCencos = currentCencos !== lastCencos;
            lastCencos = currentCencos;

            const groupBorderClass = isNewCencos ? "border-t border-slate-300 bg-slate-50/20" : "";
            const cencosDisplay = isNewCencos ? `<span class="font-bold text-slate-700 font-mono">${currentCencos}</span>` : '';

            rowsHtml += `
                <tr class="cp05-row-t3 hover:bg-blue-50/50 transition-colors ${groupBorderClass}"
                    data-cencos="${r.cencos || ''}"
                    data-nomcencos="${r.nomcencos || ''}"
                    data-linea="${r.linea || ''}"
                    data-nomlinea="${r.nomlinea || ''}"
                    data-cantidad="${cant}"
                    data-peso="${peso}"
                    data-valor="${val}"
                    data-saca_kilos="${kg}"
                    data-cu="${cu.toFixed(3)}"
                    data-fecha="${this.datosBackend.fecha || ''}">
                    <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${cencosDisplay}</td>
                    <td class="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap" title="${r.nomlinea || ''}">
                        <div class="flex items-center gap-1.5">
                            <span class="font-semibold text-blue-900">${r.linea || ''}</span>
                            <span class="text-[11px] text-slate-500 truncate max-w-[140px]">${r.nomlinea || ''}</span>
                        </div>
                    </td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${cant !== 0 ? this.formatNum(cant, 2) : '-'}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${peso !== 0 ? this.formatNum(peso, 2) : '-'}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-semibold">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(kg, 2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        // Kilos prod global de T1 para el footer
        const t3Totales = (this.datosBackend.tabla3_por_cencos_linea && this.datosBackend.tabla3_por_cencos_linea.totales) || {};
        const t1Totales = (this.datosBackend.tabla1_resumen && this.datosBackend.tabla1_resumen.totales) || {};
        globalKilosProd = Number(t1Totales.kilos_prod) || 0;
        const totalCU = (t3Totales.cu !== undefined) ? Number(t3Totales.cu) : ((globalKilosProd > 0) ? (totalVal / globalKilosProd) : 0);

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-2 text-center border-r border-slate-200"></td>
                <td class="px-2.5 py-2 text-left font-bold text-slate-900 border-r border-slate-200 uppercase">Total general</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalCant, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalVal, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-700 border-r border-slate-200">${this.formatNum(globalKilosProd, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
            </tr>
        `;

        this.bindTooltipEvents('.cp05-row-t3');
    },

    renderTabla4(filas) {
        const tbody = document.getElementById('cp05-tbody-t4');
        const tfoot = document.getElementById('cp05-tfoot-t4');
        const badge = document.getElementById('cp05-badge-t4');
        if (!tbody || !tfoot) return;

        if (badge) badge.textContent = `${filas.length} Reg`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">No hay registros coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalCant = 0.0;
        let totalPeso = 0.0;
        let totalVal  = 0.0;
        let globalKilosProd = 0.0;

        let lastCencos = null;
        let lastGalponKey = null;
        let rowsHtml = '';

        filas.forEach(r => {
            const cant = Number(r.cantidad) || 0;
            const peso = Number(r.peso) || 0;
            const val  = Number(r.valor) || 0;
            const kg   = Number(r.saca_kilos) || 0;
            const cu   = (r.cu !== undefined && r.cu !== null) ? Number(r.cu) : ((kg > 0) ? (val / kg) : 0);

            totalCant += cant;
            totalPeso += peso;
            totalVal  += val;

            const currentCencos = String(r.cencos || '').trim();
            const currentGalponKey = `${currentCencos}_${String(r.galpon || '').trim()}`;

            const isNewCencos = currentCencos !== lastCencos;
            const isNewGalpon = currentGalponKey !== lastGalponKey;

            lastCencos = currentCencos;
            lastGalponKey = currentGalponKey;

            const groupBorderClass = isNewGalpon ? "border-t border-slate-300 bg-slate-50/20" : "";
            const cencosDisplay = isNewCencos ? `<span class="font-bold text-slate-700 font-mono">${currentCencos}</span>` : '';
            const galponDisplay = isNewGalpon ? `<span class="font-semibold text-slate-600 font-mono">${r.galpon || ''}</span>` : '';

            rowsHtml += `
                <tr class="cp05-row-t4 hover:bg-blue-50/50 transition-colors ${groupBorderClass}"
                    data-cencos="${r.cencos || ''}"
                    data-nomcencos="${r.nomcencos || ''}"
                    data-galpon="${r.galpon || ''}"
                    data-linea="${r.linea || ''}"
                    data-nomlinea="${r.nomlinea || ''}"
                    data-cantidad="${cant}"
                    data-peso="${peso}"
                    data-valor="${val}"
                    data-saca_kilos="${kg}"
                    data-cu="${cu.toFixed(3)}"
                    data-fecha="${this.datosBackend.fecha || ''}">
                    <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${cencosDisplay}</td>
                    <td class="px-1.5 py-1.5 text-center border-r border-slate-100 select-none">${galponDisplay}</td>
                    <td class="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap" title="${r.nomlinea || ''}">
                        <div class="flex items-center gap-1.5">
                            <span class="font-semibold text-blue-900">${r.linea || ''}</span>
                            <span class="text-[11px] text-slate-500 truncate max-w-[140px]">${r.nomlinea || ''}</span>
                        </div>
                    </td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${cant !== 0 ? this.formatNum(cant, 2) : '-'}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${peso !== 0 ? this.formatNum(peso, 2) : '-'}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-semibold">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(kg, 2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        // Kilos prod global de T1 para el footer
        const t4Totales = (this.datosBackend.tabla4_por_galpon_linea && this.datosBackend.tabla4_por_galpon_linea.totales) || {};
        const t1Totales = (this.datosBackend.tabla1_resumen && this.datosBackend.tabla1_resumen.totales) || {};
        globalKilosProd = Number(t1Totales.kilos_prod) || 0;
        const totalCU = (t4Totales.cu !== undefined) ? Number(t4Totales.cu) : ((globalKilosProd > 0) ? (totalVal / globalKilosProd) : 0);

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-2 text-center border-r border-slate-200"></td>
                <td class="px-1.5 py-2 text-center border-r border-slate-200"></td>
                <td class="px-2.5 py-2 text-left font-bold text-slate-900 border-r border-slate-200 uppercase">Total general</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalCant, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalVal, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-700 border-r border-slate-200">${this.formatNum(globalKilosProd, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
            </tr>
        `;

        this.bindTooltipEvents('.cp05-row-t4');
    },

    bindTooltipEvents(selector) {
        const rows = document.querySelectorAll(selector);
        const self = this;

        rows.forEach(tr => {
            tr.addEventListener('mouseenter', function (e) {
                self.showTooltip(e, {
                    fecha: this.getAttribute('data-fecha'),
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    codigo: this.getAttribute('data-codigo'),
                    nomcodigo: this.getAttribute('data-nomcodigo'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mousemove', function (e) {
                self.showTooltip(e, {
                    fecha: this.getAttribute('data-fecha'),
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    codigo: this.getAttribute('data-codigo'),
                    nomcodigo: this.getAttribute('data-nomcodigo'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mouseleave', function () {
                self.hideTooltip();
            });
        });
    }
};

// Registrar en ChartRegistry para invocación modular
window.ChartRegistry['CP05 AnalisisContableCostosDiarios'] = CP05_DEFINITION;
window.ChartRegistry['CP05AnalisisContableCostosDiarios'] = CP05_DEFINITION;
window.ChartRegistry['CP05 Analisis Contable Costos Diarios'] = CP05_DEFINITION;
window.ChartRegistry['CP05 Analisis Contable'] = CP05_DEFINITION;
window.ChartRegistry['CP05'] = CP05_DEFINITION;
