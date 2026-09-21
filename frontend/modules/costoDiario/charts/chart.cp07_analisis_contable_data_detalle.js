/**
 * Módulo Frontend para CP07 AnalisisContableDataDetalle
 * 
 * Dashboard Contable Data Detalle compuesto por 3 paneles interactivos sincronizados:
 * 1. Panel 1 (Izquierda): "Costo Unitario por Cencos/Galpon/Linea" (cencos, galpon, linea, cantidad, peso, valor, saca_kilos, CU)
 * 2. Panel 2 (Derecha Arriba): "Detalle del costo Unitario por Linea" (cencos, galpon, linea, codigo, nomcodigo, transaccion, cantidad, peso, valor, PU Kilo, PU Cantidad) con barras horizontales
 * 3. Panel 3 (Derecha Abajo): "Formula" (item, nomalim, transaccion, insumo, lineainsu, valor, porinsu, Valor Insu, pvacons, Valor Dist)
 * 
 * Características:
 * - Cabeceras de tabla: bg-blue-600 text-white
 * - Barras horizontales color ciruela/púrpura (#a86591) en PU Kilo y PU Cantidad idénticas a Tableau
 * - Subtotales agrupados por Cencos/Galpón/Línea
 * - Filtros superiores: Clasificación, Granja (nomcencos), Galpón y selector de Linea Insumo (100, 101, 102, 103, (Todo))
 * - Sincronización cruzada:
 *   - Clic en Panel 1 filtra Panel 2 y Panel 3 por Cencos/Galpón/Línea
 *   - Clic en un Alimento de Panel 2 enfoca Panel 3 en dicha fórmula
 * - Tooltips flotantes interactivos estilo Tableau
 */
window.ChartRegistry = window.ChartRegistry || {};

const CP07_DEFINITION = {
    controller: null,
    datosBackend: null,
    multiClasif: null,
    multiGranja: null,
    multiGalpon: null,

    // Estados de filtrado interactivo
    cencosSeleccionado: null,
    galponSeleccionado: null,
    lineaSeleccionada: null,
    alimentoSeleccionado: null,
    filtroLineainsu: '(Todo)',

    destroy() {
        this.hideTooltip();
        this.cencosSeleccionado = null;
        this.galponSeleccionado = null;
        this.lineaSeleccionada = null;
        this.alimentoSeleccionado = null;
        this.filtroLineainsu = '(Todo)';
    },

    formatNum(val, decimals = 0) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '-';
        const num = Number(val);
        const fixed = num.toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimals > 0 ? parts.join(',') : parts[0];
    },

    showTooltip(e, data) {
        let tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'tooltip-tableau-costos';
            tooltipEl.className = 'fixed z-50 pointer-events-none bg-white text-slate-800 text-[11px] rounded-xs shadow-2xl border border-slate-300 p-3 min-w-[240px] max-w-[360px] font-sans transition-opacity duration-75';
            document.body.appendChild(tooltipEl);
        }

        let itemsHtml = `
            <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                <span>${data.titulo || 'Detalle Contable'}</span>
                <span class="text-[10px] text-slate-500 font-normal">${data.fecha || ''}</span>
            </div>
        `;

        if (data.cencos) itemsHtml += `<span class="text-slate-500 font-normal">Cencos:</span><span class="text-slate-900 font-medium font-mono">${data.cencos} - ${data.nomcencos || ''}</span>`;
        if (data.galpon !== undefined && data.galpon !== '') itemsHtml += `<span class="text-slate-500 font-normal">Galpón:</span><span class="text-slate-900 font-bold">${data.galpon}</span>`;
        if (data.linea) itemsHtml += `<span class="text-slate-500 font-normal">Línea:</span><span class="text-slate-900 font-semibold">${data.linea} - ${data.nomlinea || ''}</span>`;
        if (data.codigo) itemsHtml += `<span class="text-slate-500 font-normal">Código:</span><span class="text-slate-900 font-medium font-mono">${data.codigo} - ${data.nomcodigo || ''}</span>`;
        if (data.transaccion) itemsHtml += `<span class="text-slate-500 font-normal">Trx:</span><span class="text-slate-900 font-bold">${data.transaccion}</span>`;
        if (data.insumo) itemsHtml += `<span class="text-slate-500 font-normal">Insumo:</span><span class="text-slate-900 font-semibold truncate max-w-[200px]">${data.insumo}</span>`;
        if (data.lineainsu) itemsHtml += `<span class="text-slate-500 font-normal">Línea Insu:</span><span class="text-slate-900">${data.lineainsu}</span>`;
        if (data.cantidad !== undefined && data.cantidad !== '') itemsHtml += `<span class="text-slate-500 font-normal">Cantidad:</span><span class="text-slate-900 font-mono font-semibold">${this.formatNum(data.cantidad, 2)}</span>`;
        if (data.peso !== undefined && data.peso !== '') itemsHtml += `<span class="text-slate-500 font-normal">Peso:</span><span class="text-slate-900 font-mono font-semibold">${this.formatNum(data.peso, 2)} kg</span>`;
        if (data.valor !== undefined && data.valor !== '') itemsHtml += `<span class="text-slate-500 font-normal">Valor:</span><span class="text-slate-900 font-mono font-bold text-blue-900">S/ ${this.formatNum(data.valor, 2)}</span>`;
        if (data.saca_kilos !== undefined && data.saca_kilos !== '') itemsHtml += `<span class="text-slate-500 font-normal">Saca Kilos:</span><span class="text-slate-900 font-mono">${this.formatNum(data.saca_kilos, 2)}</span>`;
        if (data.cu !== undefined && data.cu !== '') itemsHtml += `<span class="text-slate-500 font-normal">CU:</span><span class="font-bold text-blue-700 font-mono">${this.formatNum(data.cu, 3)}</span>`;
        if (data.pu_kilo !== undefined && data.pu_kilo !== '') itemsHtml += `<span class="text-slate-500 font-normal">PU Kilo:</span><span class="font-bold text-slate-800 font-mono">${this.formatNum(data.pu_kilo, 2)}</span>`;
        if (data.pu_cant !== undefined && data.pu_cant !== '') itemsHtml += `<span class="text-slate-500 font-normal">PU Cant:</span><span class="font-bold text-slate-800 font-mono">${this.formatNum(data.pu_cant, 3)}</span>`;
        if (data.porinsu !== undefined && data.porinsu !== '') itemsHtml += `<span class="text-slate-500 font-normal">% Insumo:</span><span class="font-semibold text-slate-800 font-mono">${this.formatNum(data.porinsu, 2)}%</span>`;
        if (data.valor_insu !== undefined && data.valor_insu !== '') itemsHtml += `<span class="text-slate-500 font-normal">Valor Insu:</span><span class="font-bold text-slate-900 font-mono">S/ ${this.formatNum(data.valor_insu, 2)}</span>`;
        if (data.pvacons !== undefined && data.pvacons !== '') itemsHtml += `<span class="text-slate-500 font-normal">% VaCons:</span><span class="font-semibold text-slate-800 font-mono">${this.formatNum(data.pvacons, 2)}%</span>`;
        if (data.valor_dist !== undefined && data.valor_dist !== '') itemsHtml += `<span class="text-slate-500 font-normal">Valor Dist:</span><span class="font-bold text-blue-700 font-mono">S/ ${this.formatNum(data.valor_dist, 2)}</span>`;

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

        if (left + tooltipWidth > window.innerWidth - 12) left = e.clientX - tooltipWidth - 15;
        if (top + tooltipHeight > window.innerHeight - 12) top = window.innerHeight - tooltipHeight - 12;

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) tooltipEl.classList.add('hidden');
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiClasif) {
            const selected = typeof this.multiClasif.getSelectedValues === 'function'
                ? this.multiClasif.getSelectedValues()
                : (this.multiClasif.options ? this.multiClasif.options.filter(o => o.selected).map(o => o.id) : []);
            if (selected && selected.length > 0 && selected.length < this.multiClasif.options.length) {
                filters.clasificacion = selected;
            }
        }
        if (this.multiGranja) {
            const selectedG = typeof this.multiGranja.getSelectedValues === 'function'
                ? this.multiGranja.getSelectedValues()
                : (this.multiGranja.options ? this.multiGranja.options.filter(o => o.selected).map(o => o.id) : []);
            if (selectedG && selectedG.length > 0 && selectedG.length < this.multiGranja.options.length) {
                filters.cencos = selectedG;
            }
        }
        if (this.multiGalpon) {
            const selectedGal = typeof this.multiGalpon.getSelectedValues === 'function'
                ? this.multiGalpon.getSelectedValues()
                : (this.multiGalpon.options ? this.multiGalpon.options.filter(o => o.selected).map(o => o.id) : []);
            if (selectedGal && selectedGal.length > 0 && selectedGal.length < this.multiGalpon.options.length) {
                filters.galpon = selectedGal;
            }
        }
        return filters;
    },

    render(controller, data) {
        this.controller = controller;
        this.datosBackend = data || {};
        this.cencosSeleccionado = null;
        this.galponSeleccionado = null;
        this.lineaSeleccionada = null;
        this.alimentoSeleccionado = null;
        this.filtroLineainsu = '(Todo)';

        // 1. Ocultar cabeceras redundantes
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 2. Configurar Filtros Superiores (Clasificación, Granja, Galpón)
        this.setupFilters(this.datosBackend);

        // 3. Renderizar Layout Visual de 3 Paneles
        this.renderLayout();
    },

    setupFilters(data) {
        // Filtro Clasificación
        const contClasif = document.getElementById('contenedor-filtro-clasificacion-cp07');
        if (contClasif) contClasif.classList.remove('hidden');

        const clasifsDisp = (data.filtros_disponibles && data.filtros_disponibles.clasificaciones) || [];
        if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0) {
            const optClasif = clasifsDisp.map(c => {
                const id = (c.clasificacion || `${c.linea} ${c.nomlinea}`).trim();
                return { id: id, label: id, selected: true };
            });

            if (!this.multiClasif) {
                this.multiClasif = new CustomMultiSelect({
                    btnId: 'btn-dropdown-clasificacion-cp07',
                    dropdownId: 'dropdown-clasificacion-cp07',
                    optionsContainerId: 'container-options-clasificacion-cp07',
                    labelId: 'label-clasificacion-cp07',
                    searchId: 'search-clasificacion-cp07',
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

        // Filtro Granja / Cencos
        const contGranja = document.getElementById('contenedor-filtro-granja-cp07');
        if (contGranja) contGranja.classList.remove('hidden');

        const cencosDisp = (data.filtros_disponibles && data.filtros_disponibles.cencos) || [];
        if (typeof CustomMultiSelect !== 'undefined' && cencosDisp.length > 0) {
            const optGranja = cencosDisp.map(c => {
                const id = String(c.cencos).trim();
                const label = `${c.cencos} ${c.nomcencos || ''}`.trim();
                return { id: id, label: label, selected: true };
            });

            if (!this.multiGranja) {
                this.multiGranja = new CustomMultiSelect({
                    btnId: 'btn-dropdown-granja-cp07',
                    dropdownId: 'dropdown-granja-cp07',
                    optionsContainerId: 'container-options-granja-cp07',
                    labelId: 'label-granja-cp07',
                    searchId: 'search-granja-cp07',
                    title: 'Granja',
                    options: optGranja,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiGranja.setOptions(optGranja);
            }
        }

        // Filtro Galpón
        const contGalpon = document.getElementById('contenedor-filtro-galpon-cp07');
        if (contGalpon) contGalpon.classList.remove('hidden');

        const galponesDisp = (data.filtros_disponibles && data.filtros_disponibles.galpones) || [];
        if (typeof CustomMultiSelect !== 'undefined' && galponesDisp.length > 0) {
            const optGalpon = galponesDisp.map(g => {
                const id = String(g).trim();
                const label = id === '0' || id === '' ? 'Galpón 0 (Comodín)' : `Galpón ${id}`;
                return { id: id, label: label, selected: true };
            });

            if (!this.multiGalpon) {
                this.multiGalpon = new CustomMultiSelect({
                    btnId: 'btn-dropdown-galpon-cp07',
                    dropdownId: 'dropdown-galpon-cp07',
                    optionsContainerId: 'container-options-galpon-cp07',
                    labelId: 'label-galpon-cp07',
                    searchId: 'search-galpon-cp07',
                    title: 'Galpón',
                    options: optGalpon,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiGalpon.setOptions(optGalpon);
            }
        }
    },

    filtrarLocalmente() {
        if (!this.datosBackend) return;
        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const p1Filas = (this.datosBackend.panel1_costo_unitario && this.datosBackend.panel1_costo_unitario.filas) || [];

        if (p1Filas.length === 0) {
            contenedor.className = "relative w-full min-h-[420px] p-6 flex flex-col items-center justify-center text-center";
            contenedor.innerHTML = `
                <div class="p-3 bg-amber-50 text-amber-600 rounded-full mb-3">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-800">Sin datos contables disponibles</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-sm">No se encontraron movimientos contables para ${this.datosBackend.fecha_formateada || this.datosBackend.fecha || ''}.</p>
            `;
            return;
        }

        // Opciones completas de lineainsu
        const opcionesLineasInsu = [
            '(Todo)',
            '100 Materia Prima',
            '101 Conservantes/Secuestrante/Fungicida',
            '102 Antibiótico',
            '103 Vitaminas / Minerales'
        ];

        let optLineasInsuHtml = '';
        opcionesLineasInsu.forEach(li => {
            const isSel = this.filtroLineainsu === li ? 'selected' : '';
            optLineasInsuHtml += `<option value="${li}" ${isSel}>${li}</option>`;
        });

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CP07 (SPLIT IZQUIERDA / DERECHA) -->
            <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                <!-- COLUMNA IZQUIERDA: PANEL 1 (Costo Unitario por Cencos/Galpon/Linea) -->
                <div class="xl:col-span-5 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800">Costo Unitario por Cencos/Galpon/Linea</h3>
                        </div>
                        <div class="flex items-center gap-2">
                            <span id="cp07-badge-p1" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                0 Reg
                            </span>
                            <button id="cp07-btn-export-p1" type="button"
                                class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>

                    <div class="w-full overflow-x-auto max-h-[820px] custom-scrollbar">
                        <table id="tabla-cp07-p1" class="w-full text-xs border-collapse select-none">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                <tr>
                                    <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                    <th class="px-1.5 py-2 border-r border-slate-200">gal..</th>
                                    <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                    <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                    <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">saca_kilos</th>
                                    <th class="px-2.5 py-2 text-right">CU</th>
                                </tr>
                            </thead>
                            <tbody id="cp07-tbody-p1" class="divide-y divide-slate-100 text-slate-800"></tbody>
                            <tfoot id="cp07-tfoot-p1" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                        </table>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: PANEL 2 (Detalle Costo Unitario por Línea) + PANEL 3 (Formula) -->
                <div class="xl:col-span-7 flex flex-col gap-6">

                    <!-- PANEL 2: Detalle del costo Unitario por Linea -->
                    <div class="flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Detalle del costo Unitario por Linea</h3>
                                <span id="cp07-badge-p2-filtro" class="hidden text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                    Filtrado
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp07-badge-p2" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Reg
                                </span>
                                <button id="cp07-btn-export-p2" type="button"
                                    class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[380px] custom-scrollbar">
                            <table id="tabla-cp07-p2" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                        <th class="px-1.5 py-2 border-r border-slate-200">gal.</th>
                                        <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200">codigo</th>
                                        <th class="px-1.5 py-2 border-r border-slate-200">Trx</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                        <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-3 py-2 text-left border-r border-slate-200 min-w-[110px]">PU Kilo</th>
                                        <th class="px-3 py-2 text-left min-w-[100px]">P...</th>
                                    </tr>
                                </thead>
                                <tbody id="cp07-tbody-p2" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp07-tfoot-p2" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- PANEL 3: Formula -->
                    <div class="flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <h3 class="text-xs sm:text-sm font-bold text-slate-800">Formula</h3>
                                <div class="flex items-center gap-2 text-xs">
                                    <label class="text-[11px] font-bold text-slate-600">lineainsu:</label>
                                    <select id="cp07-select-lineainsu"
                                        class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-medium rounded-lg px-2.5 py-1 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                                        ${optLineasInsuHtml}
                                    </select>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp07-badge-p3" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                    0 Insumos
                                </span>
                                <button id="cp07-btn-export-p3" type="button"
                                    class="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[400px] custom-scrollbar">
                            <table id="tabla-cp07-p3" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200">item</th>
                                        <th class="px-1.5 py-2 border-r border-slate-200">Trx</th>
                                        <th class="px-3 py-2 text-left border-r border-slate-200">insumo</th>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200">lineainsu</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">valor</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">% insu</th>
                                        <th class="px-2.5 py-2 text-right border-r border-slate-200">Valor Insu</th>
                                        <th class="px-2 py-2 text-right border-r border-slate-200">% vaCons</th>
                                        <th class="px-2.5 py-2 text-right">Valor Dist</th>
                                    </tr>
                                </thead>
                                <tbody id="cp07-tbody-p3" class="divide-y divide-slate-100 text-slate-800"></tbody>
                                <tfoot id="cp07-tfoot-p3" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        `;

        // Bind selector de lineainsu
        document.getElementById('cp07-select-lineainsu')?.addEventListener('change', (e) => {
            this.filtroLineainsu = e.target.value;
            this.renderPanel3();
        });

        // Configurar exportación a Excel para las 3 tablas de CP07
        const fechaNom = (this.datosBackend.fecha_formateada || this.datosBackend.fecha || 'general').replace(/[^a-zA-Z0-9]/g, '_');
        const sufijoFiltro = (this.cencosSeleccionado ? `_${this.cencosSeleccionado}` : '') + (this.lineaSeleccionada ? `_L${this.lineaSeleccionada}` : '');

        const btnP1 = document.getElementById('cp07-btn-export-p1');
        if (btnP1) {
            btnP1.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp07-p1', `CP07_Costo_Unitario_Cencos_Galpon_Linea_${fechaNom}`);
                }
            };
        }

        const btnP2 = document.getElementById('cp07-btn-export-p2');
        if (btnP2) {
            btnP2.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp07-p2', `CP07_Detalle_Costo_Unitario_Linea${sufijoFiltro}_${fechaNom}`);
                }
            };
        }

        const btnP3 = document.getElementById('cp07-btn-export-p3');
        if (btnP3) {
            btnP3.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    const sufijoAlim = this.alimentoSeleccionado ? `_${this.alimentoSeleccionado}` : '';
                    ExcelExportHelper.exportarTabla('tabla-cp07-p3', `CP07_Formula_Insumos${sufijoAlim}_${fechaNom}`);
                }
            };
        }

        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();
    },

    renderPanel1() {
        const tbody = document.getElementById('cp07-tbody-p1');
        const tfoot = document.getElementById('cp07-tfoot-p1');
        const badge = document.getElementById('cp07-badge-p1');
        if (!tbody || !tfoot) return;

        const allFilas = (this.datosBackend.panel1_costo_unitario && this.datosBackend.panel1_costo_unitario.filas) || [];
        const selectedClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selectedClasif && selectedClasif.length > 0 && selectedClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        const selectedGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        const isFilteringGranja = selectedGranjas && selectedGranjas.length > 0 && selectedGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999);

        const selectedGalpones = this.multiGalpon ? this.multiGalpon.getSelectedValues() : [];
        const isFilteringGalpon = selectedGalpones && selectedGalpones.length > 0 && selectedGalpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999);

        let filas = allFilas.filter(r => {
            if (isFilteringGranja && !selectedGranjas.includes(r.cencos)) return false;
            if (isFilteringGalpon && !selectedGalpones.includes(r.galpon)) return false;

            if (isFilteringClasif) {
                const clasifStr = `${r.linea} ${r.nomlinea}`.trim();
                const match = selectedClasif.some(sel => sel === r.linea || sel === clasifStr || sel.startsWith(r.linea));
                if (!match) return false;
            }
            return true;
        });

        if (badge) badge.textContent = `${filas.length} Reg`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-6 text-center text-slate-400 italic">No hay registros coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalCant = 0.0, totalPeso = 0.0, totalVal = 0.0, totalCU = 0.0;
        let lastCencos = null, lastGalpon = null;
        let rowsHtml = '';

        filas.forEach(r => {
            const cant = Number(r.cantidad) || 0;
            const peso = Number(r.peso) || 0;
            const val  = Number(r.valor) || 0;
            const saca = Number(r.saca_kilos) || 0;
            const cu   = Number(r.cu) || 0;

            totalCant += cant;
            totalPeso += peso;
            totalVal  += val;
            totalCU   += cu;

            const isNewCencos = r.cencos !== lastCencos;
            const isNewGalpon = isNewCencos || r.galpon !== lastGalpon;
            lastCencos = r.cencos;
            lastGalpon = r.galpon;

            const cencosDisplay = isNewCencos ? `<span class="font-bold text-slate-800 font-mono">${r.cencos}</span>` : '';
            const galponDisplay = isNewGalpon ? `<span class="font-bold text-slate-700 font-mono">${r.galpon}</span>` : '';

            const isSelected = this.cencosSeleccionado === r.cencos && this.galponSeleccionado === r.galpon && this.lineaSeleccionada === r.linea;
            const rowClass = isSelected
                ? "bg-blue-100/90 font-semibold text-blue-900 cursor-pointer"
                : (isNewGalpon ? "border-t border-slate-300 hover:bg-blue-50/50 cursor-pointer" : "hover:bg-slate-50 cursor-pointer");

            rowsHtml += `
                <tr class="cp07-row-p1 ${rowClass}"
                    data-cencos="${r.cencos}" data-nomcencos="${r.nomcencos}" data-galpon="${r.galpon}" data-linea="${r.linea}" data-nomlinea="${r.nomlinea}"
                    data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                    <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${cencosDisplay}</td>
                    <td class="px-1.5 py-1.5 text-center border-r border-slate-100 select-none">${galponDisplay}</td>
                    <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-700 border-r border-slate-100" title="${r.nomlinea || ''}">${r.linea}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${cant !== 0 ? this.formatNum(cant, 0) : '0'}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${peso !== 0 ? this.formatNum(peso, 2) : '0,00'}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-medium">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 text-slate-500">${saca > 0 ? this.formatNum(saca, 2) : '-'}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-2 text-center border-r border-slate-200"></td>
                <td class="px-1.5 py-2 text-center border-r border-slate-200"></td>
                <td class="px-2 py-2 text-center font-bold text-slate-900 border-r border-slate-200 uppercase">Total</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalCant, 0)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalVal, 2)}</td>
                <td class="px-3 py-2 text-right border-r border-slate-200"></td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
            </tr>
        `;

        this.bindPanel1Events();
    },

    bindPanel1Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp07-row-p1');

        rows.forEach(tr => {
            tr.addEventListener('click', function() {
                const cencos = this.getAttribute('data-cencos');
                const galpon = this.getAttribute('data-galpon');
                const linea  = this.getAttribute('data-linea');

                if (self.cencosSeleccionado === cencos && self.galponSeleccionado === galpon && self.lineaSeleccionada === linea) {
                    self.cencosSeleccionado = null;
                    self.galponSeleccionado = null;
                    self.lineaSeleccionada = null;
                } else {
                    self.cencosSeleccionado = cencos;
                    self.galponSeleccionado = galpon;
                    self.lineaSeleccionada = linea;
                }

                self.renderPanel1();
                self.renderPanel2();
                self.renderPanel3();
            });

            tr.addEventListener('mouseenter', function(e) {
                self.showTooltip(e, {
                    titulo: 'Costo Unitario',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.showTooltip(e, {
                    titulo: 'Costo Unitario',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    },

    renderPanel2() {
        const tbody = document.getElementById('cp07-tbody-p2');
        const tfoot = document.getElementById('cp07-tfoot-p2');
        const badge = document.getElementById('cp07-badge-p2');
        const badgeFiltro = document.getElementById('cp07-badge-p2-filtro');
        if (!tbody || !tfoot) return;

        const allFilas = (this.datosBackend.panel2_detalle_linea && this.datosBackend.panel2_detalle_linea.filas) || [];
        const selectedClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selectedClasif && selectedClasif.length > 0 && selectedClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        const selectedGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        const isFilteringGranja = selectedGranjas && selectedGranjas.length > 0 && selectedGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999);

        const selectedGalpones = this.multiGalpon ? this.multiGalpon.getSelectedValues() : [];
        const isFilteringGalpon = selectedGalpones && selectedGalpones.length > 0 && selectedGalpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999);

        let isCrossFiltered = this.cencosSeleccionado || this.galponSeleccionado !== null || this.lineaSeleccionada;
        if (badgeFiltro) {
            badgeFiltro.classList.toggle('hidden', !isCrossFiltered);
            if (isCrossFiltered) {
                badgeFiltro.textContent = `Filtro: ${this.cencosSeleccionado || ''} G:${this.galponSeleccionado || ''} L:${this.lineaSeleccionada || ''}`;
            }
        }

        let filas = allFilas.filter(r => {
            if (this.cencosSeleccionado && r.cencos !== this.cencosSeleccionado) return false;
            if (this.galponSeleccionado !== null && r.galpon !== this.galponSeleccionado) return false;
            if (this.lineaSeleccionada && r.linea !== this.lineaSeleccionada) return false;

            if (isFilteringGranja && !selectedGranjas.includes(r.cencos)) return false;
            if (isFilteringGalpon && !selectedGalpones.includes(r.galpon)) return false;

            if (isFilteringClasif) {
                const clasifStr = `${r.linea} ${r.nomlinea}`.trim();
                const match = selectedClasif.some(sel => sel === r.linea || sel === clasifStr || sel.startsWith(r.linea));
                if (!match) return false;
            }
            return true;
        });

        if (badge) badge.textContent = `${filas.length} Reg`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="py-6 text-center text-slate-400 italic">No hay registros de detalle coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        // Calcular máximos de PU Kilo y PU Cant para el tamaño de las barras ciruela
        let maxPuKilo = 1.0;
        let maxPuCant = 1.0;
        filas.forEach(r => {
            const pk = Number(r.pu_kilo) || 0;
            const pc = Number(r.pu_cant) || 0;
            if (pk > maxPuKilo) maxPuKilo = pk;
            if (pc > maxPuCant) maxPuCant = pc;
        });

        let totalCant = 0.0, totalPeso = 0.0, totalVal = 0.0;
        let rowsHtml = '';

        // Agrupar filas por [cencos_galpon_linea] para generar subtotales exactos como en Tableau
        let grupos = {};
        filas.forEach(r => {
            const key = `${r.cencos}_${r.galpon}_${r.linea}`;
            if (!grupos[key]) {
                grupos[key] = {
                    cencos: r.cencos,
                    galpon: r.galpon,
                    linea: r.linea,
                    filas: [],
                    subtotalCant: 0,
                    subtotalPeso: 0,
                    subtotalVal: 0
                };
            }
            grupos[key].filas.push(r);
            grupos[key].subtotalCant += Number(r.cantidad) || 0;
            grupos[key].subtotalPeso += Number(r.peso) || 0;
            grupos[key].subtotalVal  += Number(r.valor) || 0;

            totalCant += Number(r.cantidad) || 0;
            totalPeso += Number(r.peso) || 0;
            totalVal  += Number(r.valor) || 0;
        });

        Object.values(grupos).forEach(grp => {
            grp.filas.forEach((r, fIdx) => {
                const cant = Number(r.cantidad) || 0;
                const peso = Number(r.peso) || 0;
                const val  = Number(r.valor) || 0;
                const puK  = Number(r.pu_kilo) || 0;
                const puC  = Number(r.pu_cant) || 0;

                const cencosDisplay = fIdx === 0 ? `<span class="font-bold text-slate-800 font-mono">${r.cencos}</span>` : '';
                const galponDisplay = fIdx === 0 ? `<span class="font-bold text-slate-700 font-mono">${r.galpon}</span>` : '';
                const lineaDisplay  = fIdx === 0 ? `<span class="font-bold text-slate-800 font-mono">${r.linea}</span>` : '';

                const isAlimento = r.linea === '002' || (r.codigo && r.codigo.startsWith('PL'));
                const isSelected = this.alimentoSeleccionado === r.codigo;
                const rowSelectedClass = isSelected ? "bg-amber-100 font-semibold text-amber-900" : (isAlimento ? "cursor-pointer hover:bg-amber-50/60" : "hover:bg-slate-50");

                // En Tableau, la columna principal de barra es PU Kilo (o PU Cantidad si peso == 0)
                const valorPU = peso > 0 ? puK : puC;
                const widthPu = valorPU > 0 ? Math.min(100, Math.max(12, (valorPU / Math.max(maxPuKilo, 100)) * 100)) : 0;

                const barPuHtml = valorPU > 0 ? `
                    <div class="flex items-center justify-end gap-1.5 w-full">
                        <div class="h-3.5 bg-[#a86591] rounded-2xs transition-all shrink-0" style="width: ${widthPu}px; max-width: 60%;"></div>
                        <span class="font-mono text-[11px] text-slate-800 font-semibold text-right">${this.formatNum(valorPU, peso > 0 && puK < 10 ? 3 : 2)}</span>
                    </div>
                ` : '<span class="text-slate-300">-</span>';

                const secPuHtml = (peso > 0 && puC > 0) ? `
                    <span class="font-mono text-[11px] text-slate-700 text-right block">${this.formatNum(puC, 3)}</span>
                ` : '<span class="text-slate-300">-</span>';

                rowsHtml += `
                    <tr class="cp07-row-p2 ${rowSelectedClass} transition-colors border-t border-slate-100"
                        data-cencos="${r.cencos}" data-nomcencos="${r.nomcencos}" data-galpon="${r.galpon}" data-linea="${r.linea}" data-nomlinea="${r.nomlinea}"
                        data-codigo="${r.codigo}" data-nomcodigo="${r.nomcodigo}" data-transaccion="${r.transaccion}"
                        data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-pu_kilo="${puK.toFixed(3)}" data-pu_cant="${puC.toFixed(3)}">
                        <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${cencosDisplay}</td>
                        <td class="px-1.5 py-1.5 text-center border-r border-slate-100 select-none">${galponDisplay}</td>
                        <td class="px-2 py-1.5 text-center border-r border-slate-100 select-none">${lineaDisplay}</td>
                        <td class="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap" title="${r.nomcodigo}">
                            <div class="flex items-center gap-1.5">
                                <span class="font-semibold ${isAlimento ? 'text-blue-900 font-bold' : 'text-slate-800'}">${r.codigo}</span>
                                <span class="text-[11px] text-slate-500 truncate max-w-[135px]">${r.nomcodigo}</span>
                            </div>
                        </td>
                        <td class="px-1.5 py-1.5 text-center font-mono font-bold text-slate-600 border-r border-slate-100">${r.transaccion}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${cant !== 0 ? this.formatNum(cant, 2) : '0,00'}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${peso !== 0 ? this.formatNum(peso, 2) : '0,00'}</td>
                        <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-semibold">${this.formatNum(val, 2)}</td>
                        <td class="px-2.5 py-1 border-r border-slate-100">${barPuHtml}</td>
                        <td class="px-2.5 py-1">${secPuHtml}</td>
                    </tr>
                `;
            });

            // Subtotal PU de la Línea
            const subtotalVal = grp.subtotalVal;
            const subtotalPeso = grp.subtotalPeso;
            const subtotalCant = grp.subtotalCant;
            const subtotalPUPrincipal = subtotalPeso > 0 ? (subtotalVal / subtotalPeso) : (subtotalCant > 0 ? (subtotalVal / subtotalCant) : 0);
            const subtotalPUSecundario = (subtotalPeso > 0 && subtotalCant > 0) ? (subtotalVal / subtotalCant) : 0;

            const subBarPuHtml = subtotalPUPrincipal > 0 ? `
                <div class="flex items-center justify-end gap-1.5 w-full">
                    <span class="font-mono text-[11px] text-slate-900 font-bold text-right">${this.formatNum(subtotalPUPrincipal, subtotalPeso > 0 && subtotalPUPrincipal < 10 ? 3 : 2)}</span>
                </div>
            ` : '';

            const subSecPuHtml = subtotalPUSecundario > 0 ? `
                <span class="font-mono text-[11px] text-slate-800 font-bold text-right block">${this.formatNum(subtotalPUSecundario, 3)}</span>
            ` : '';

            // Fila de Total de la Línea
            rowsHtml += `
                <tr class="bg-slate-50/80 font-bold border-t border-b border-slate-200 select-none text-[11px]">
                    <td class="border-r border-slate-200"></td>
                    <td class="border-r border-slate-200"></td>
                    <td class="border-r border-slate-200"></td>
                    <td class="px-3 py-1 text-right text-slate-500 font-semibold border-r border-slate-200" colspan="2">Total</td>
                    <td class="px-2.5 py-1 text-right font-mono text-slate-800 border-r border-slate-200">${this.formatNum(grp.subtotalCant, 2)}</td>
                    <td class="px-2.5 py-1 text-right font-mono text-slate-800 border-r border-slate-200 border-l-2 border-l-emerald-600">${this.formatNum(grp.subtotalPeso, 2)}</td>
                    <td class="px-3 py-1 text-right font-mono text-slate-900 border-r border-slate-200 border-l-2 border-l-emerald-600">${this.formatNum(grp.subtotalVal, 2)}</td>
                    <td class="px-2.5 py-1 border-r border-slate-200 text-right">${subBarPuHtml}</td>
                    <td class="px-2.5 py-1 text-right">${subSecPuHtml}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2 py-2 text-center border-r border-slate-200" colspan="5"><span class="font-bold text-slate-900 uppercase">Total General</span></td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalCant, 2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalVal, 2)}</td>
                <td class="px-2.5 py-2 text-right border-r border-slate-200"></td>
                <td class="px-2 py-2 text-right"></td>
            </tr>
        `;

        this.bindPanel2Events();
    },

    bindPanel2Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp07-row-p2');

        rows.forEach(tr => {
            tr.addEventListener('click', function() {
                const codigo = this.getAttribute('data-codigo');
                const linea  = this.getAttribute('data-linea');

                if (linea === '002' || (codigo && codigo.startsWith('PL'))) {
                    if (self.alimentoSeleccionado === codigo) {
                        self.alimentoSeleccionado = null;
                    } else {
                        self.alimentoSeleccionado = codigo;
                    }
                    self.renderPanel2();
                    self.renderPanel3();
                }
            });

            tr.addEventListener('mouseenter', function(e) {
                self.showTooltip(e, {
                    titulo: 'Detalle Línea',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    codigo: this.getAttribute('data-codigo'),
                    nomcodigo: this.getAttribute('data-nomcodigo'),
                    transaccion: this.getAttribute('data-transaccion'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    pu_kilo: this.getAttribute('data-pu_kilo'),
                    pu_cant: this.getAttribute('data-pu_cant')
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.showTooltip(e, {
                    titulo: 'Detalle Línea',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    codigo: this.getAttribute('data-codigo'),
                    nomcodigo: this.getAttribute('data-nomcodigo'),
                    transaccion: this.getAttribute('data-transaccion'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    pu_kilo: this.getAttribute('data-pu_kilo'),
                    pu_cant: this.getAttribute('data-pu_cant')
                });
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    },

    renderPanel3() {
        const tbody = document.getElementById('cp07-tbody-p3');
        const tfoot = document.getElementById('cp07-tfoot-p3');
        const badge = document.getElementById('cp07-badge-p3');
        if (!tbody || !tfoot) return;

        const allFilas = (this.datosBackend.panel3_formula && this.datosBackend.panel3_formula.filas) || [];

        let filas = allFilas.filter(r => {
            if (this.alimentoSeleccionado && r.item !== this.alimentoSeleccionado) {
                return false;
            }
            if (this.filtroLineainsu && this.filtroLineainsu !== '(Todo)' && this.filtroLineainsu !== 'TODOS') {
                const prefixMatch = this.filtroLineainsu.substring(0, 3);
                if (r.lineainsu !== this.filtroLineainsu && !r.lineainsu.startsWith(prefixMatch)) {
                    return false;
                }
            }
            return true;
        });

        if (badge) badge.textContent = `${filas.length} Insumos`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-slate-400 italic">No hay fórmulas coincidentes</td></tr>`;
            tfoot.innerHTML = '';
            return;
        }

        let totalValInsu = 0.0, totalValDist = 0.0;
        let lastItem = null;
        let rowsHtml = '';

        filas.forEach(r => {
            const valInsu = Number(r.valor_insu) || 0;
            const valDist = Number(r.valor_dist) || 0;

            totalValInsu += valInsu;
            totalValDist += valDist;

            const isNewItem = r.item !== lastItem;
            lastItem = r.item;

            const groupBorderClass = isNewItem ? "border-t-2 border-slate-300 bg-slate-50/20" : "border-t border-slate-100";
            const itemDisplay = isNewItem ? `<span class="font-bold text-blue-900 font-mono">${r.item}</span>` : '';
            const trxDisplay = isNewItem ? `<span class="font-bold text-slate-600 font-mono">${r.transaccion}</span>` : '';
            const valDisplay = isNewItem ? `<span class="font-mono font-bold text-slate-800">${this.formatNum(r.valor, 2)}</span>` : '';

            rowsHtml += `
                <tr class="cp07-row-p3 ${groupBorderClass} hover:bg-blue-50/40 transition-colors"
                    data-item="${r.item}" data-nomalim="${r.nomalim}" data-transaccion="${r.transaccion}"
                    data-insumo="${r.insumo}" data-lineainsu="${r.lineainsu}" data-valor="${r.valor}"
                    data-porinsu="${r.porinsu}" data-valor_insu="${valInsu}" data-pvacons="${r.pvacons}" data-valor_dist="${valDist}">
                    <td class="px-2.5 py-1.5 border-r border-slate-100 select-none">${itemDisplay}</td>
                    <td class="px-1.5 py-1.5 text-center border-r border-slate-100 select-none">${trxDisplay}</td>
                    <td class="px-3 py-1.5 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap" title="${r.nominsu}">
                        <div class="flex items-center gap-1.5">
                            <span class="font-semibold text-slate-900">${r.codinsu}</span>
                            <span class="text-[11px] text-slate-500 truncate max-w-[150px]">${r.nominsu}</span>
                        </div>
                    </td>
                    <td class="px-2.5 py-1.5 text-slate-600 border-r border-slate-100 text-[11px] whitespace-nowrap">${r.lineainsu}</td>
                    <td class="px-2.5 py-1.5 text-right border-r border-slate-100 select-none">${valDisplay}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(r.porinsu, 2)}%</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-semibold text-slate-800 border-r border-slate-100">${this.formatNum(valInsu, 2)}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(r.pvacons, 2)}%</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-blue-700">${this.formatNum(valDist, 2)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rowsHtml;

        tfoot.innerHTML = `
            <tr class="border-t-2 border-slate-300">
                <td class="px-2.5 py-2 text-center border-r border-slate-200" colspan="6"><span class="font-bold text-slate-900 uppercase">Total Insumos</span></td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totalValInsu, 2)}</td>
                <td class="px-2 py-2 text-right border-r border-slate-200"></td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalValDist, 2)}</td>
            </tr>
        `;

        this.bindPanel3Events();
    },

    bindPanel3Events() {
        const self = this;
        const rows = document.querySelectorAll('.cp07-row-p3');

        rows.forEach(tr => {
            tr.addEventListener('mouseenter', function(e) {
                self.showTooltip(e, {
                    titulo: 'Insumo Fórmula',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    codigo: this.getAttribute('data-item'),
                    nomcodigo: this.getAttribute('data-nomalim'),
                    transaccion: this.getAttribute('data-transaccion'),
                    insumo: this.getAttribute('data-insumo'),
                    lineainsu: this.getAttribute('data-lineainsu'),
                    valor: this.getAttribute('data-valor'),
                    porinsu: this.getAttribute('data-porinsu'),
                    valor_insu: this.getAttribute('data-valor_insu'),
                    pvacons: this.getAttribute('data-pvacons'),
                    valor_dist: this.getAttribute('data-valor_dist')
                });
            });

            tr.addEventListener('mousemove', function(e) {
                self.showTooltip(e, {
                    titulo: 'Insumo Fórmula',
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    codigo: this.getAttribute('data-item'),
                    nomcodigo: this.getAttribute('data-nomalim'),
                    transaccion: this.getAttribute('data-transaccion'),
                    insumo: this.getAttribute('data-insumo'),
                    lineainsu: this.getAttribute('data-lineainsu'),
                    valor: this.getAttribute('data-valor'),
                    porinsu: this.getAttribute('data-porinsu'),
                    valor_insu: this.getAttribute('data-valor_insu'),
                    pvacons: this.getAttribute('data-pvacons'),
                    valor_dist: this.getAttribute('data-valor_dist')
                });
            });

            tr.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    }
};

// Registro modular
window.ChartRegistry['CP07 AnalisisContableDataDetalle'] = CP07_DEFINITION;
window.ChartRegistry['CP07AnalisisContableDataDetalle'] = CP07_DEFINITION;
window.ChartRegistry['CP07'] = CP07_DEFINITION;
