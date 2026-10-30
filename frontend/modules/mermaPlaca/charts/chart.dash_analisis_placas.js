/**
 * Componente de Gráfico / Dashboard Modular: DashAnalisisPlacas
 * Módulo: mermaPlaca
 *
 * Dashboard Integral con 5 Secciones Sincronizadas (Master-Detail):
 * 1. Liquidación de Placas (Tabla Maestra: CDCliente -> Placa -> CodItem con columnas de transacciones Cant, Peso, PP).
 * 2. Análisis de Ventas (Detalle de Sale filtrado por la placa y fecha seleccionada).
 * 3. Tiempos de Ruta (Eventos y rutas de dmruta para la placa).
 * 4. Agente Causal (Causas de dmagentescausalesmermas para la placa y fecha).
 * 5. Cumplimiento Objetivo (Mermas por Placa y Desglose por Código con Objetivo, Real y Diferencia).
 *
 * Optimizaciones:
 * - Paginación cliente independiente por tabla (selector global de filas).
 * - Filtro cruzado en memoria usando la data ya cargada, con fallback a backend.
 * - Tooltips por referencia de fila (sin JSON duplicado en cada celda).
 * - Export Excel completo de todas las filas del filtro actual.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashAnalisisPlacasChart = {
    controllerRef: null,
    datosBackend: null,
    placaSeleccionada: null,
    fecProcesoSeleccionada: null,
    fecProcesoFormateada: '',

    _pageSize: 50,
    _pages: { liq: 1, ventas: 1, rutas: 1, causal: 1, cumpPlaca: 1, cumpCod: 1 },
    _view: null,
    _base: null,
    _baseCompleto: true,
    _baseEsFiltrada: false,
    _liqPages: [],
    _liqPageSizes: [],
    _liqCols: [],
    _ttStore: { liq: {}, ventas: {}, rutas: {}, causal: {}, cumpPlaca: {}, cumpCod: {} },
    _uids: { liq: 0 },
    _cacheSeleccion: {},
    _clickHandler: null,
    _pageHandler: null,
    _sizeHandler: null,
    _tableTooltipHandler: null,
    _tableTooltipMoveHandler: null,
    _tableTooltipOutHandler: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        const filtros = this.datosBackend.filtros || {};
        this.placaSeleccionada = filtros.placa_seleccionada || null;
        this.fecProcesoSeleccionada = filtros.fecproceso_seleccionada || null;
        this.fecProcesoFormateada = this.fecProcesoSeleccionada ? this.fecProcesoSeleccionada.replace(/-/g, '/') : '';

        this._pageSize = 50;
        this._resetAllPages();
        this._cacheSeleccion = {};
        this._ventasLoadSeq = 0;
        this._destroyed = false;

        this.hideTooltip();

        const cardDetalle = document.getElementById('card-tabla-metricas');
        if (cardDetalle) cardDetalle.classList.add('hidden');

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.style.minHeight = 'auto';
            contenedorGrafica.style.padding = '0';
        }

        this.setupFilters();
        this._buildViewModel();
        this.renderLayout();

        this.renderTablaLiquidacion();
        this.renderTablaVentas();
        this.renderTablaRutas();
        this.renderTablaAgcausal();
        this.renderTablaCumplimiento();

        this.setupInteractiveSelection();
        this.setupPagination();
        this.attachTableTooltips();
        this.setupExportListeners();

        this._precargarVentasCompletas();
    },

    resetSelection() {
        this.placaSeleccionada = null;
        this.fecProcesoSeleccionada = null;
        this.fecProcesoFormateada = '';
    },

    resetFilters() {
        this.resetSelection();
    },

    getSelectedFilters() {
        return {
            placa_seleccionada: this.placaSeleccionada,
            fecproceso_seleccionada: this.fecProcesoSeleccionada
        };
    },

    setupFilters() {
        document.getElementById('contenedor-filtro-corporativo-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-placa-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-cliente-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-item-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-transaccion-merma')?.classList.add('hidden');
    },

    // -----------------------------------------------------------------
    // MODELO DE DATOS / CACHÉ
    // -----------------------------------------------------------------
    _buildViewModel() {
        const d = this.datosBackend || {};
        const ventas = d.seccion_ventas || {};
        const rutas = d.seccion_tiempos_ruta || {};
        const causal = d.seccion_agente_causal || {};
        const cump = d.seccion_cumplimiento || {};
        const cumpCodData = cump.tabla_codigo || {};

        const ventasPaginado = ventas.paginado === true;
        this._otrosCompletos = rutas.completo !== false
            && causal.completo !== false
            && cump.completo !== false
            && cumpCodData.completo !== false;
        this._ventasServerMode = ventasPaginado;
        this._ventasServerConfig = ventasPaginado ? {
            total: Number(ventas.total_registros) || 0,
            page: Number(ventas.page) || 1,
            pageSize: Number(ventas.page_size) || this._pageSize,
            totalMetrics: ventas.total || null
        } : null;
        this._ventasInitial = ventasPaginado ? {
            rows: (ventas.filas || []).slice(),
            total: Number(ventas.total_registros) || 0,
            page: Number(ventas.page) || 1,
            pageSize: Number(ventas.page_size) || this._pageSize,
            totalMetrics: ventas.total || null
        } : null;
        this._preloadSeq = 0;

        this._base = {
            ventas: ventasPaginado ? null : (ventas.filas || []),
            rutas: rutas.filas || [],
            causal: causal.filas || [],
            cumpPlaca: cump.tabla_placa || [],
            cumpCod: cumpCodData.filas || [],
            meta: {
                ventasPlaca: ventas.placa || '(Todas)',
                ventasFec: ventas.fecproceso_formateada || this.fecProcesoFormateada,
                rutasPlaca: rutas.placa || '(Todas)',
                rutasFec: rutas.fecproceso_formateada || this.fecProcesoFormateada,
                causalPlaca: causal.placa || '(Todas)',
                causalFec: causal.fecproceso_formateada || this.fecProcesoFormateada,
                cumpPlaca: cump.placa || '(Todas)',
                cumpFec: cump.fecproceso_formateada || this.fecProcesoFormateada
            },
            cumpTotal: cumpCodData.total || null
        };

        this._baseCompleto = !ventasPaginado && this._otrosCompletos;
        this._baseEsFiltrada = !!(d.filtros && d.filtros.placa_seleccionada);

        this._view = {
            ventas: this._base.ventas || (ventas.filas || []),
            rutas: this._base.rutas,
            causal: this._base.causal,
            cumpPlaca: this._base.cumpPlaca,
            cumpCod: this._base.cumpCod,
            meta: { ...this._base.meta },
            cumpTotal: this._base.cumpTotal
        };
    },

    _buildMetaFor(placa, fecFmt) {
        return {
            ventasPlaca: placa,
            ventasFec: fecFmt,
            rutasPlaca: placa,
            rutasFec: fecFmt,
            causalPlaca: placa,
            causalFec: fecFmt,
            cumpPlaca: placa,
            cumpFec: fecFmt
        };
    },

    _puedeFiltrarEnMemoria() {
        return !!(this._base && this._baseCompleto && !this._baseEsFiltrada);
    },

    _filtrarEnMemoria(placa, fecproceso) {
        const norm = (v) => String(v === null || v === undefined ? '' : v).replace(/-/g, '').trim();
        const target = norm(placa);
        const fecha = fecproceso ? String(fecproceso).slice(0, 10) : null;
        const fechaFila = (r) => String(r.fecproceso || r.fechaproceso || '').slice(0, 10);
        const mismaFecha = (r) => !fecha || fechaFila(r) === fecha;

        const ventas = this._base.ventas.filter(r => norm(r.placa) === target && mismaFecha(r));
        const causal = this._base.causal.filter(r => norm(r.placa) === target && mismaFecha(r));
        const cumpPlaca = this._base.cumpPlaca.filter(r => norm(r.placa) === target && mismaFecha(r));
        const cumpCod = this._base.cumpCod.filter(r => norm(r.placa) === target && mismaFecha(r));
        const rutas = this._base.rutas.filter(r => norm(r.placa) === target && mismaFecha(r));
        const fecFmt = fecproceso ? String(fecproceso).replace(/-/g, '/') : '';

        return {
            ventas,
            rutas,
            causal,
            cumpPlaca,
            cumpCod,
            meta: this._buildMetaFor(placa, fecFmt),
            cumpTotal: this._computeCumpTotal(cumpCod)
        };
    },

    _computeVentasTotal(rows) {
        let cant = 0, peso = 0, valor = 0;
        rows.forEach(f => {
            cant += Number(f.cantidad) || 0;
            peso += Number(f.peso) || 0;
            valor += Number(f.valor) || 0;
        });
        return {
            cantidad: cant,
            peso: peso,
            valor: valor,
            peso_prom_venta: Math.abs(cant) > 0.0001 ? (peso / cant) : 0,
            precio_prom_venta: Math.abs(peso) > 0.0001 ? (valor / peso) : 0
        };
    },

    _round2(v) {
        return Math.round((Number(v) || 0) * 100) / 100;
    },

    _computeCumpTotal(rows) {
        let sumObj = 0, sumEnt = 0, sumMer = 0;
        rows.forEach(r => {
            sumObj += Number(r.objetivo) || 0;
            sumEnt += Number(r.entrada) || 0;
            sumMer += Number(r.mermatotal) || 0;
        });
        const objetivo = rows.length ? (sumObj / rows.length) : 0;
        const real = sumEnt > 0 ? ((sumMer / sumEnt) * 100) : 0;
        return {
            objetivo: this._round2(objetivo),
            real: this._round2(real),
            dif: this._round2(real - objetivo),
            entrada: sumEnt,
            mermatotal: sumMer
        };
    },

    _resetAllPages() {
        this._pages = { liq: 1, ventas: 1, rutas: 1, causal: 1, cumpPlaca: 1, cumpCod: 1 };
    },

    _resetDetailPages() {
        this._pages.ventas = 1;
        this._pages.rutas = 1;
        this._pages.causal = 1;
        this._pages.cumpPlaca = 1;
        this._pages.cumpCod = 1;
    },

    _clampPage(page, pages) {
        const p = Number(page) || 1;
        const total = Math.max(1, Number(pages) || 1);
        return Math.min(Math.max(1, p), total);
    },

    // -----------------------------------------------------------------
    // LAYOUT
    // -----------------------------------------------------------------
    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        contenedorGrafica.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- SECCIÓN 1: LIQUIDACIÓN DE PLACAS (Top - Ancho Completo) -->
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Liquidacion de Placas</h2>
                                <span class="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Tabla Maestra</span>
                            </div>
                            <span class="text-[11px] text-slate-400 font-medium">Haga clic en una placa para analizar sus ventas, tiempos de ruta, causas y cumplimiento de objetivo</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <label for="select-filas-pagina-global" class="text-[11px] text-slate-400 font-semibold hidden sm:inline">Filas/pág.</label>
                            <select id="select-filas-pagina-global" class="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                                <option value="25">25</option>
                                <option value="50" selected>50</option>
                                <option value="100">100</option>
                            </select>
                            <button id="btn-export-placas-liq" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>
                    <div class="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar bg-white">
                        <table id="tabla-analisis-placas-liq" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                            <thead id="thead-placas-liq" class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                <!-- Dinámico -->
                            </thead>
                            <tbody id="tbody-placas-liq" class="divide-y divide-slate-100 bg-white">
                                <!-- Dinámico -->
                            </tbody>
                            <tfoot id="tfoot-placas-liq" class="sticky bottom-0 z-20 bg-slate-100 font-bold border-t-2 border-slate-300 shadow-md">
                                <!-- Dinámico -->
                            </tfoot>
                        </table>
                    </div>
                    <div id="paginacion-liq"></div>
                </div>

                <!-- FILA MEDIA: VENTAS (Izq 7 cols) & TIEMPOS DE RUTA (Der 5 cols) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- SECCIÓN 2: ANÁLISIS DE VENTAS (7 cols) -->
                    <div class="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Analisis de Ventas</h2>
                                    <span id="badge-ventas-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        ${this.placaSeleccionada ? `Placa: ${this.placaSeleccionada}${this.fecProcesoFormateada ? ' | Fecha: ' + this.fecProcesoFormateada : ''}` : 'Placas: (Todas)'}
                                    </span>
                                </div>
                                <span class="text-[11px] text-slate-400 font-medium">Línea 601 agrupada por cliente, documento y código</span>
                            </div>
                            <button id="btn-export-placas-ventas" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar bg-white">
                            <table id="tabla-analisis-placas-ventas" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead id="thead-placas-ventas" class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">FecProceso</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Placa</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">FecReg</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Mín. ttime</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Máx. ttime</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">Corporativo</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">CodCliente</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">NomCliente</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">RutaComercial</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">td..</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">NroDoc</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">tcodigo</th>
                                        <th class="px-2 py-2 text-right font-bold border-r border-blue-500/40">Cantidad</th>
                                        <th class="px-2 py-2 text-right font-bold border-r border-blue-500/40">Peso</th>
                                        <th class="px-2 py-2 text-right font-bold border-r border-blue-500/40">Valor</th>
                                        <th class="px-2 py-2 text-right font-bold border-r border-blue-500/40">PesoPromV..</th>
                                        <th class="px-2 py-2 text-right font-bold">PrecioProm..</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-placas-ventas" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                                <tfoot id="tfoot-placas-ventas" class="sticky bottom-0 z-20 bg-slate-100 font-bold border-t-2 border-slate-300 shadow-md">
                                    <!-- Dinámico -->
                                </tfoot>
                            </table>
                        </div>
                        <div id="paginacion-ventas"></div>
                    </div>

                    <!-- SECCIÓN 3: TIEMPOS DE RUTA (5 cols) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Tiempos de Ruta</h2>
                                    <span id="badge-rutas-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        ${this.placaSeleccionada ? 'Placa: ' + this.placaSeleccionada : 'Placas: (Todas)'}
                                    </span>
                                </div>
                                <span class="text-[11px] text-slate-400 font-medium">Control de garitas, galpones y planta de beneficio</span>
                            </div>
                            <button id="btn-export-placas-rutas" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[420px] custom-scrollbar bg-white">
                            <table id="tabla-analisis-placas-rutas" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Placa</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">nume..</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Día de fecha</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">hora</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">evento</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">localizacion</th>
                                        <th class="px-2 py-2 text-center font-bold">arearespons..</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-placas-rutas" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                            </table>
                        </div>
                        <div id="paginacion-rutas"></div>
                    </div>

                </div>

                <!-- FILA INFERIOR: AGENTE CAUSAL (Izq 7 cols) & CUMPLIMIENTO OBJETIVO (Der 5 cols) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
                    
                    <!-- SECCIÓN 4: AGENTE CAUSAL (7 cols) -->
                    <div class="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Agente Causal</h2>
                                    <span id="badge-causal-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        ${this.placaSeleccionada ? 'Placa: ' + this.placaSeleccionada : 'Placas: (Todas)'}
                                    </span>
                                </div>
                                <span class="text-[11px] text-slate-400 font-medium">Registro de incidencias, demoras y justificaciones operativas</span>
                            </div>
                            <button id="btn-export-placas-agcausal" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar bg-white">
                            <table id="tabla-analisis-placas-agcausal" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">FecProceso</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">cliente</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Placa</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">area</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">codigoconta</th>
                                        <th class="px-2 py-2 text-left font-bold border-r border-blue-500/40">causatipo</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">Día de fecharegi..</th>
                                        <th class="px-2 py-2 text-center font-bold border-r border-blue-500/40">horaregistro</th>
                                        <th class="px-3 py-2 text-left font-bold">descripcion</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-placas-agcausal" class="divide-y divide-slate-100 bg-white">
                                    <!-- Dinámico -->
                                </tbody>
                            </table>
                        </div>
                        <div id="paginacion-causal"></div>
                    </div>

                    <!-- SECCIÓN 5: CUMPLIMIENTO OBJETIVO (5 cols) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Cumplimiento Objetivo</h2>
                                    <span id="badge-cumplimiento-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        ${this.placaSeleccionada ? 'Placa: ' + this.placaSeleccionada : 'Placas: (Todas)'}
                                    </span>
                                </div>
                                <span class="text-[11px] text-slate-400 font-medium">Porcentaje objetivo, real y diferencia de merma</span>
                            </div>
                            <button id="btn-export-placas-cumplimiento" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                        <div class="p-3 flex flex-col gap-4 bg-white">
                            
                            <!-- Subtabla 1: Placa General -->
                            <div class="flex flex-col">
                                <div class="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                                    <div class="overflow-y-auto max-h-[170px] custom-scrollbar">
                                        <table id="tabla-cumplimiento-placa" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                            <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th class="px-2 py-1.5 text-center font-bold border-r border-slate-200">FecProceso</th>
                                                    <th class="px-2 py-1.5 text-left font-bold border-r border-slate-200">zonaorigen</th>
                                                    <th class="px-2 py-1.5 text-left font-bold border-r border-slate-200">cliente</th>
                                                    <th class="px-2 py-1.5 text-center font-bold border-r border-slate-200">Placa</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Objetivo</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Real</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Dif</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">entrada</th>
                                                    <th class="px-2 py-1.5 text-right font-bold">mermatotal</th>
                                                </tr>
                                            </thead>
                                            <tbody id="tbody-cumplimiento-placa" class="divide-y divide-slate-100 bg-white">
                                                <!-- Dinámico -->
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div id="paginacion-cumpPlaca"></div>
                            </div>

                            <!-- Subtabla 2: Desglose por Código -->
                            <div class="flex flex-col">
                                <div class="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                                    <div class="overflow-y-auto max-h-[170px] custom-scrollbar">
                                        <table id="tabla-cumplimiento-codigo" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                            <thead class="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th class="px-2 py-1.5 text-center font-bold border-r border-slate-200">FecProceso</th>
                                                    <th class="px-2 py-1.5 text-left font-bold border-r border-slate-200">zonaorigen</th>
                                                    <th class="px-2 py-1.5 text-left font-bold border-r border-slate-200">cliente</th>
                                                    <th class="px-2 py-1.5 text-center font-bold border-r border-slate-200">Placa</th>
                                                    <th class="px-2 py-1.5 text-center font-bold border-r border-slate-200">codigo</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Objetivo</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Real</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">Dif</th>
                                                    <th class="px-2 py-1.5 text-right font-bold border-r border-slate-200">entrada</th>
                                                    <th class="px-2 py-1.5 text-right font-bold">mermatotal</th>
                                                </tr>
                                            </thead>
                                            <tbody id="tbody-cumplimiento-codigo" class="divide-y divide-slate-100 bg-white">
                                                <!-- Dinámico -->
                                            </tbody>
                                            <tfoot id="tfoot-cumplimiento-codigo" class="bg-slate-50 font-bold border-t border-slate-300">
                                                <!-- Dinámico -->
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                                <div id="paginacion-cumpCod"></div>
                            </div>

                        </div>
                    </div>

                </div>

            </div>
        `;
    },

    formatNum(val, dec = 2, blankIfZero = false) {
        if (val === null || val === undefined || isNaN(val)) return blankIfZero ? '' : '0.00';
        if (blankIfZero && Math.abs(val) < 0.0001) return '';
        return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },

    // -----------------------------------------------------------------
    // PAGINACIÓN
    // -----------------------------------------------------------------
    _barraHtml(tabla, page, pages, start, end, total) {
        const disPrev = page <= 1 ? 'disabled' : '';
        const disNext = page >= pages ? 'disabled' : '';
        return `<div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500">
            <span>Mostrando <strong class="text-slate-700">${start.toLocaleString('en-US')}-${end.toLocaleString('en-US')}</strong> de <strong class="text-slate-700">${total.toLocaleString('en-US')}</strong> filas</span>
            <div class="flex items-center gap-1">
                <button type="button" data-page-table="${tabla}" data-page="1" ${disPrev} class="px-2 py-0.5 rounded border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">&laquo;</button>
                <button type="button" data-page-table="${tabla}" data-page="${page - 1}" ${disPrev} class="px-2 py-0.5 rounded border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">&lsaquo;</button>
                <span class="px-2 font-semibold text-slate-700">Pág. ${page} de ${pages}</span>
                <button type="button" data-page-table="${tabla}" data-page="${page + 1}" ${disNext} class="px-2 py-0.5 rounded border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">&rsaquo;</button>
                <button type="button" data-page-table="${tabla}" data-page="${pages}" ${disNext} class="px-2 py-0.5 rounded border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100">&raquo;</button>
            </div>
        </div>`;
    },

    _renderBarra(tabla, page, totalRows) {
        const el = document.getElementById('paginacion-' + tabla);
        if (!el) return;
        const pages = Math.max(1, Math.ceil(totalRows / this._pageSize));
        const start = totalRows ? ((page - 1) * this._pageSize + 1) : 0;
        const end = Math.min(page * this._pageSize, totalRows);
        el.innerHTML = this._barraHtml(tabla, page, pages, start, end, totalRows);
    },

    _liqRowRange(page) {
        let start = 0;
        for (let i = 0; i < page - 1; i++) start += (this._liqPageSizes[i] || 0);
        const end = start + (this._liqPageSizes[page - 1] || 0);
        const total = this._liqPageSizes.reduce((a, b) => a + b, 0);
        return [total ? start + 1 : 0, end, total];
    },

    _renderBarraLiq(page) {
        const el = document.getElementById('paginacion-liq');
        if (!el) return;
        const pages = Math.max(1, this._liqPages.length);
        const [start, end, total] = this._liqRowRange(page);
        el.innerHTML = this._barraHtml('liq', page, pages, start, end, total);
    },

    cambiarPagina(tabla, page) {
        if (!tabla || !(tabla in this._pages)) return;
        this._pages[tabla] = Number(page) || 1;
        if (tabla === 'liq') this.renderTablaLiquidacion();
        else if (tabla === 'ventas') {
            if (this._ventasServerMode && this._ventasServerConfig) {
                this._cargarPaginaVentas(Number(page) || 1);
            } else {
                this.renderTablaVentas();
            }
        }
        else if (tabla === 'rutas') this.renderTablaRutas();
        else if (tabla === 'causal') this.renderTablaAgcausal();
        else if (tabla === 'cumpPlaca') this.renderTablaCumplimientoPlaca();
        else if (tabla === 'cumpCod') this.renderTablaCumplimientoCodigo();
    },

    setupPagination() {
        const container = document.getElementById('contenedor-grafica-costo');
        if (container) {
            if (this._pageHandler) container.removeEventListener('click', this._pageHandler);
            this._pageHandler = (e) => {
                const btn = e.target.closest('[data-page-table]');
                if (!btn || btn.disabled) return;
                e.preventDefault();
                this.cambiarPagina(btn.getAttribute('data-page-table'), Number(btn.getAttribute('data-page')));
            };
            container.addEventListener('click', this._pageHandler);
        }

        const sel = document.getElementById('select-filas-pagina-global');
        if (sel) {
            sel.value = String(this._pageSize);
            if (this._sizeHandler) sel.removeEventListener('change', this._sizeHandler);
            this._sizeHandler = () => {
                const size = Number(sel.value) || 50;
                if (size === this._pageSize) return;
                this._pageSize = size;
                this._resetAllPages();
                this.renderTablaLiquidacion();
                if (this._ventasServerMode && this._ventasServerConfig) {
                    this._cargarPaginaVentas(1);
                } else {
                    this.renderTablaVentas();
                }
                this.renderTablaRutas();
                this.renderTablaAgcausal();
                this.renderTablaCumplimiento();
            };
            sel.addEventListener('change', this._sizeHandler);
        }
    },

    // -----------------------------------------------------------------
    // 1. RENDER TABLA LIQUIDACIÓN DE PLACAS
    // -----------------------------------------------------------------
    _buildLiqPages(clientes) {
        const size = this._pageSize;
        const pages = [];
        const sizes = [];
        let current = [];
        let count = 0;

        clientes.forEach(cGroup => {
            const rows = (cGroup.placas || []).reduce((acc, p) => acc + ((p.items && p.items.length) ? p.items.length : 1), 0) || 1;
            if (current.length && count + rows > size) {
                pages.push(current);
                sizes.push(count);
                current = [];
                count = 0;
            }
            current.push(cGroup);
            count += rows;
        });

        if (current.length || !pages.length) {
            pages.push(current);
            sizes.push(count);
        }

        this._liqPages = pages;
        this._liqPageSizes = sizes;
    },

    renderTablaLiquidacion() {
        const thead = document.getElementById('thead-placas-liq');
        const tbody = document.getElementById('tbody-placas-liq');
        const tfoot = document.getElementById('tfoot-placas-liq');
        if (!thead || !tbody) return;

        const liqData = this.datosBackend.seccion_liquidacion || null;
        if (!liqData) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td class="py-8 text-center text-slate-400 italic">Sin datos de liquidación para el período seleccionado.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            this._liqCols = [];
            this._liqPages = [[]];
            this._liqPageSizes = [0];
            this._renderBarraLiq(1);
            return;
        }

        const colTrans = liqData.columnas_transacciones || [];
        this._liqCols = colTrans;

        let headRow1 = `
            <tr>
                <th rowspan="2" class="sticky left-0 z-30 bg-blue-600 px-3 py-2 text-left font-bold tracking-wider border-r border-blue-500/40 align-middle">CDCliente</th>
                <th rowspan="2" class="sticky left-[120px] z-30 bg-blue-600 px-3 py-2 text-center font-bold tracking-wider border-r border-blue-500/40 align-middle">Placa</th>
                <th rowspan="2" class="sticky left-[200px] z-30 bg-blue-600 px-3 py-2 text-center font-bold tracking-wider border-r border-blue-500/40 align-middle">CodItem</th>
        `;
        let headRow2 = `<tr>`;

        colTrans.forEach(t => {
            headRow1 += `
                <th colspan="3" class="px-2 py-1.5 text-center font-bold tracking-wider border-r border-blue-500/40 bg-blue-600 text-white" title="${t.descri}">
                    <span>${t.codtra}</span>
                    <div class="text-[9px] font-normal text-blue-100 truncate max-w-[130px] mx-auto">${t.descri}</div>
                </th>
            `;
            headRow2 += `
                <th class="px-2 py-1 text-right font-bold tracking-wider border-r border-blue-500/40">Cant</th>
                <th class="px-2 py-1 text-right font-bold tracking-wider border-r border-blue-500/40">Peso</th>
                <th class="px-2 py-1 text-right font-bold tracking-wider border-r border-blue-500/40">PP</th>
            `;
        });

        headRow1 += `</tr>`;
        headRow2 += `</tr>`;
        thead.innerHTML = headRow1 + headRow2;

        const clientes = liqData.clientes || [];
        if (clientes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + colTrans.length * 3}" class="py-8 text-center text-slate-400 italic">No hay registros de liquidación para el período seleccionado.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            this._liqPages = [[]];
            this._liqPageSizes = [0];
            this._renderBarraLiq(1);
            return;
        }

        this._buildLiqPages(clientes);
        const page = this._clampPage(this._pages.liq, this._liqPages.length);
        this._pages.liq = page;
        const groups = this._liqPages[page - 1] || [];

        tbody.innerHTML = this._buildLiqBodyHtml(groups, false);

        if (tfoot) {
            if (liqData.total_general && liqData.total_general.transacciones) {
                tfoot.innerHTML = this._buildLiqFootRows(liqData.total_general, true);
            } else {
                tfoot.innerHTML = '';
            }
        }

        this._renderBarraLiq(page);
    },

    _buildLiqBodyHtml(groups, forExport) {
        const colTrans = this._liqCols || [];
        let bodyHtml = '';

        if (!forExport) {
            this._ttStore.liq = {};
            this._uids.liq = 0;
        }

        (groups || []).forEach(cGroup => {
            const tfecfac = cGroup.tfecfac || '';
            const cdCliente = cGroup.cdcliente || '';
            const subtotal = cGroup.subtotal_cliente || {};
            const placas = cGroup.placas || [];
            const totalFilasItems = placas.reduce((acc, p) => acc + (p.items ? p.items.length : 1), 0);
            let filaIdxCliente = 0;

            placas.forEach(pGroup => {
                const placa = pGroup.placa || '';
                const fecproceso = pGroup.tfecfac || tfecfac;
                const items = pGroup.items || [];
                const itemsCount = items.length;
                const isSelected = (placa !== '' && placa === this.placaSeleccionada);

                items.forEach((iData, idxItem) => {
                    const isFirstRowOfClient = (filaIdxCliente === 0);
                    const isFirstItemOfPlaca = (idxItem === 0);
                    const codItem = iData.coditem || '';
                    const baseCells = 1 + (isFirstRowOfClient ? 1 : 0) + (isFirstItemOfPlaca ? 1 : 0);

                    const rowClass = isSelected
                        ? 'bg-blue-100/90 font-bold border-l-4 border-l-blue-600 text-blue-900 transition-colors'
                        : 'hover:bg-blue-50/50 transition-colors cursor-pointer';

                    let ttAttr = '';
                    if (!forExport) {
                        const uid = 'l' + (++this._uids.liq);
                        this._ttStore.liq[uid] = {
                            kind: 'item',
                            cdCliente,
                            placa,
                            codItem,
                            transacciones: iData.transacciones || {}
                        };
                        ttAttr = ` data-tt-table="liq" data-tt-uid="${uid}" data-tt-base="${baseCells}"`;
                    }

                    bodyHtml += `
                        <tr class="${rowClass}" data-placa-row="${placa}" data-fecproceso-row="${fecproceso}"${ttAttr}>
                            ${isFirstRowOfClient ? `<td data-role="cliente" class="sticky left-0 z-10 bg-white px-3 py-1.5 font-bold text-slate-800 border-r border-slate-200 tracking-wide align-top" rowspan="${totalFilasItems}">${cdCliente}</td>` : ''}
                            ${isFirstItemOfPlaca ? `<td data-role="placa" class="sticky left-[120px] z-10 ${isSelected ? 'bg-blue-100/90 font-bold text-blue-900' : 'bg-white font-medium text-slate-800'} px-3 py-1.5 text-center border-r border-slate-200 align-top" rowspan="${itemsCount}">${placa || ''}</td>` : ''}
                            <td data-role="item" class="sticky left-[200px] z-10 ${isSelected ? 'bg-blue-100/90 font-semibold' : 'bg-white'} px-3 py-1.5 text-center font-mono text-slate-800 border-r border-slate-200">${codItem}</td>
                    `;

                    colTrans.forEach(t => {
                        const vals = (iData.transacciones && iData.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
                        const cStr = this.formatNum(vals.cant, 0, true);
                        const pStr = this.formatNum(vals.peso, 2, true);
                        const ppStr = this.formatNum(vals.pp, 3, true);

                        bodyHtml += `
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default">${cStr}</td>
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default">${pStr}</td>
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default">${ppStr}</td>
                        `;
                    });

                    bodyHtml += `</tr>`;
                    filaIdxCliente++;
                });
            });

            let subAttr = '';
            if (!forExport) {
                const uid = 'l' + (++this._uids.liq);
                this._ttStore.liq[uid] = {
                    kind: 'sub',
                    cdCliente,
                    transacciones: subtotal.transacciones || {}
                };
                subAttr = ` data-tt-table="liq" data-tt-uid="${uid}" data-tt-base="3"`;
            }

            bodyHtml += `
                <tr class="bg-slate-100 font-bold text-slate-900 border-t border-b-2 border-slate-300"${subAttr}>
                    <td class="sticky left-0 z-10 bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-r border-slate-300"></td>
                    <td class="sticky left-[120px] z-10 bg-slate-100 px-3 py-1.5 text-center font-bold text-slate-800 border-r border-slate-300">Total</td>
                    <td class="sticky left-[200px] z-10 bg-slate-100 px-3 py-1.5 text-center border-r border-slate-300"></td>
            `;

            colTrans.forEach(t => {
                const vals = (subtotal.transacciones && subtotal.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
                const cStr = this.formatNum(vals.cant, 0, true);
                const pStr = this.formatNum(vals.peso, 2, true);
                const ppStr = this.formatNum(vals.pp, 3, true);

                bodyHtml += `
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default">${cStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default">${pStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default">${ppStr}</td>
                `;
            });
            bodyHtml += `</tr>`;
        });

        return bodyHtml;
    },

    _buildLiqFootRows(totalGral, store) {
        const colTrans = this._liqCols || [];
        let uidAttr = '';
        if (store) {
            const uid = 'l' + (++this._uids.liq);
            this._ttStore.liq[uid] = {
                kind: 'total',
                transacciones: totalGral.transacciones || {}
            };
            uidAttr = ` data-tt-table="liq" data-tt-uid="${uid}" data-tt-base="3"`;
        }

        let footHtml = `
            <tr class="bg-slate-200 font-extrabold text-slate-900 border-t-2 border-slate-400"${uidAttr}>
                <td class="sticky left-0 z-30 bg-slate-200 px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300"></td>
                <td class="sticky left-[120px] z-30 bg-slate-200 px-3 py-2 text-center uppercase tracking-wider font-extrabold border-r border-slate-300">Total general</td>
                <td class="sticky left-[200px] z-30 bg-slate-200 px-3 py-2 text-center border-r border-slate-300"></td>
        `;

        colTrans.forEach(t => {
            const vals = (totalGral.transacciones && totalGral.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
            const cStr = this.formatNum(vals.cant, 0, true);
            const pStr = this.formatNum(vals.peso, 2, true);
            const ppStr = this.formatNum(vals.pp, 3, true);

            footHtml += `
                <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default">${cStr}</td>
                <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default">${pStr}</td>
                <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default">${ppStr}</td>
            `;
        });
        footHtml += `</tr>`;
        return footHtml;
    },

    // -----------------------------------------------------------------
    // 2. RENDER TABLA ANÁLISIS DE VENTAS
    // -----------------------------------------------------------------
    renderTablaVentas() {
        const tbody = document.getElementById('tbody-placas-ventas');
        const tfoot = document.getElementById('tfoot-placas-ventas');
        if (!tbody) return;

        const rows = this._view.ventas || [];
        const meta = this._view.meta;
        const fecFmt = meta.ventasFec || this.fecProcesoFormateada;
        const placa = meta.ventasPlaca || '(Todas)';
        const esTodas = (placa === '(Todas)');

        const badgeV = document.getElementById('badge-ventas-placa');
        if (badgeV) {
            badgeV.textContent = esTodas ? `Placas: (Todas) | Período: ${fecFmt || 'Actual'}` : `Placa: ${placa} | Fecha: ${fecFmt}`;
        }

        if (this._ventasServerMode && this._ventasServerConfig) {
            const cfg = this._ventasServerConfig;
            const total = Number(cfg.total) || 0;
            const pages = Math.max(1, Math.ceil(total / this._pageSize));
            const page = this._clampPage(cfg.page || this._pages.ventas || 1, pages);
            cfg.page = page;
            cfg.pageSize = this._pageSize;
            this._pages.ventas = page;

            if (total === 0) {
                tbody.innerHTML = `<tr><td colspan="17" class="py-8 text-center text-slate-400 italic">No hay registros de ventas para ${esTodas ? 'las placas' : 'la placa ' + placa} en ${fecFmt}.</td></tr>`;
                if (tfoot) tfoot.innerHTML = '';
                this._renderBarra('ventas', 1, 0);
                return;
            }

            this._ttStore.ventas = {};
            let bodyHtml = '';
            const start = (page - 1) * this._pageSize;
            rows.forEach((f, i) => {
                bodyHtml += this._buildVentasRow(f, start + i, true);
            });
            tbody.innerHTML = bodyHtml || `<tr><td colspan="17" class="py-8 text-center text-slate-400 italic">Cargando ventas...</td></tr>`;

            if (tfoot) {
                tfoot.innerHTML = this._buildVentasFootRows(cfg.totalMetrics || this._computeVentasTotal(rows), true);
            }
            this._renderBarra('ventas', page, total);
            return;
        }

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="17" class="py-8 text-center text-slate-400 italic">No hay registros de ventas para ${esTodas ? 'las placas' : 'la placa ' + placa} en ${fecFmt}.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            this._renderBarra('ventas', 1, 0);
            return;
        }

        const page = this._clampPage(this._pages.ventas, Math.ceil(rows.length / this._pageSize));
        this._pages.ventas = page;
        const start = (page - 1) * this._pageSize;
        const slice = rows.slice(start, start + this._pageSize);

        this._ttStore.ventas = {};
        let bodyHtml = '';
        slice.forEach((f, i) => {
            bodyHtml += this._buildVentasRow(f, start + i, true);
        });
        tbody.innerHTML = bodyHtml;

        if (tfoot) {
            tfoot.innerHTML = this._buildVentasFootRows(this._computeVentasTotal(rows), true);
        }
        this._renderBarra('ventas', page, rows.length);
    },

    _buildVentasRow(f, idx, store) {
        const cantStr = this.formatNum(f.cantidad, 0);
        const pesoStr = this.formatNum(f.peso, 2);
        const valStr = `S/ ${this.formatNum(f.valor, 2)}`;
        const ppStr = this.formatNum(f.peso_prom_venta, 3);
        const prStr = this.formatNum(f.precio_prom_venta, 3);

        let ttAttr = '';
        if (store) {
            const uid = 'v' + idx;
            this._ttStore.ventas[uid] = {
                kind: 'row',
                data: {
                    'Placa': f.placa,
                    'Cliente': `${f.codcliente} - ${f.nomcliente}`,
                    'Corporativo': f.corporativo,
                    'Ruta': f.rutacomercial,
                    'Doc': `${f.tdoc} ${f.nrodoc}`,
                    'Código': f.tcodigo,
                    'Cantidad': cantStr,
                    'Peso': `${pesoStr} Kg`,
                    'Valor': valStr,
                    'PesoPromVenta': ppStr,
                    'PrecioPromVenta': prStr
                }
            };
            ttAttr = ` data-tt-table="ventas" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="hover:bg-blue-50/50 transition-colors"${ttAttr}>
                <td class="px-2 py-1.5 text-center font-mono text-slate-500 border-r border-slate-100">${this._view.meta.ventasFec || this.fecProcesoFormateada}</td>
                <td class="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">${f.placa}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-700 border-r border-slate-100">${f.fecreg_dmy || f.fecreg}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${f.min_time || ''}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${f.max_time || ''}</td>
                <td class="px-2 py-1.5 text-left font-medium text-slate-800 border-r border-slate-100 truncate max-w-[130px]" title="${f.corporativo}">${f.corporativo}</td>
                <td class="px-2 py-1.5 text-left font-mono text-slate-700 border-r border-slate-100">${f.codcliente}</td>
                <td class="px-2 py-1.5 text-left text-slate-800 border-r border-slate-100 truncate max-w-[140px]" title="${f.nomcliente}">${f.nomcliente}</td>
                <td class="px-2 py-1.5 text-left font-medium text-slate-700 border-r border-slate-100">${f.rutacomercial}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${f.tdoc}</td>
                <td class="px-2 py-1.5 text-left font-mono text-slate-700 border-r border-slate-100">${f.nrodoc}</td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-100">${f.tcodigo}</td>
                <td class="px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 cursor-default">${cantStr}</td>
                <td class="px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 cursor-default">${pesoStr}</td>
                <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-900 border-r border-slate-100 cursor-default">${valStr}</td>
                <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default">${ppStr}</td>
                <td class="px-2 py-1.5 text-right font-mono text-slate-700 cursor-default">${prStr}</td>
            </tr>
        `;
    },

    _buildVentasFootRows(total, store) {
        const totCantStr = this.formatNum(total.cantidad, 0);
        const totPesoStr = this.formatNum(total.peso, 2);
        const totValStr = `S/ ${this.formatNum(total.valor, 2)}`;
        const totPPStr = this.formatNum(total.peso_prom_venta, 3);
        const totPrStr = this.formatNum(total.precio_prom_venta, 3);

        let uidAttr = '';
        if (store) {
            const uid = 'foot';
            this._ttStore.ventas[uid] = {
                kind: 'row',
                data: {
                    'Tipo': 'Total Ventas',
                    'Cantidad Total': totCantStr,
                    'Peso Total': `${totPesoStr} Kg`,
                    'Valor Total': totValStr,
                    'Peso Promedio': totPPStr,
                    'Precio Promedio': totPrStr
                }
            };
            uidAttr = ` data-tt-table="ventas" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="bg-slate-100/95 font-bold text-slate-800 border-t border-slate-300"${uidAttr}>
                <td colspan="12" class="px-3 py-1.5 text-left font-bold text-slate-700 border-r border-slate-300">Total</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default">${totCantStr}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default">${totPesoStr}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default">${totValStr}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default">${totPPStr}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 cursor-default">${totPrStr}</td>
            </tr>
            <tr class="bg-blue-700 text-white font-extrabold shadow-inner">
                <td colspan="12" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-600">Total general</td>
                <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${totCantStr}</td>
                <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${totPesoStr}</td>
                <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${totValStr}</td>
                <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default">${totPPStr}</td>
                <td class="px-2 py-2 text-right font-mono cursor-default">${totPrStr}</td>
            </tr>
        `;
    },

    // -----------------------------------------------------------------
    // 3. RENDER TABLA TIEMPOS DE RUTA
    // -----------------------------------------------------------------
    renderTablaRutas() {
        const tbody = document.getElementById('tbody-placas-rutas');
        if (!tbody) return;

        const rows = this._view.rutas || [];
        const meta = this._view.meta;
        const placa = meta.rutasPlaca || '(Todas)';
        const fecFmt = meta.rutasFec || this.fecProcesoFormateada;
        const esTodas = (placa === '(Todas)');

        const badgeR = document.getElementById('badge-rutas-placa');
        if (badgeR) {
            badgeR.textContent = esTodas ? 'Placas: (Todas)' : `Placa: ${placa} | Fecha: ${fecFmt}`;
        }

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 italic">No hay rutas registradas para ${esTodas ? 'las placas' : 'la placa ' + placa}${esTodas ? '' : ' en ' + fecFmt}.</td></tr>`;
            this._renderBarra('rutas', 1, 0);
            return;
        }

        const page = this._clampPage(this._pages.rutas, Math.ceil(rows.length / this._pageSize));
        this._pages.rutas = page;
        const start = (page - 1) * this._pageSize;
        const slice = rows.slice(start, start + this._pageSize);

        this._ttStore.rutas = {};
        let bodyHtml = '';
        slice.forEach((r, i) => {
            bodyHtml += this._buildRutasRow(r, start + i, placa, true);
        });
        tbody.innerHTML = bodyHtml;
        this._renderBarra('rutas', page, rows.length);
    },

    _buildRutasRow(r, idx, placa, store) {
        const rowPlaca = r.placa || placa;
        let ttAttr = '';
        if (store) {
            const uid = 'r' + idx;
            this._ttStore.rutas[uid] = {
                kind: 'row',
                data: {
                    'Placa': rowPlaca,
                    'Ruta': r.numeroruta,
                    'Fecha': r.fecha_formateada || r.fecha,
                    'Hora': r.hora,
                    'Evento': r.evento,
                    'Localización': r.localizacion,
                    'Área Responsable': r.arearesponsable
                }
            };
            ttAttr = ` data-tt-table="rutas" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="hover:bg-blue-50/50 transition-colors cursor-default"${ttAttr}>
                <td class="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">${rowPlaca}</td>
                <td class="px-2 py-1.5 text-center font-mono font-medium text-slate-700 border-r border-slate-100">${r.numeroruta || ''}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${r.fecha_formateada || r.fecha}</td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-100">${r.hora || ''}</td>
                <td class="px-2 py-1.5 text-left font-medium text-slate-800 border-r border-slate-100">${r.evento || ''}</td>
                <td class="px-2 py-1.5 text-left text-slate-700 border-r border-slate-100 truncate max-w-[180px]" title="${r.localizacion}">${r.localizacion || ''}</td>
                <td class="px-2 py-1.5 text-center">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        ${r.arearesponsable || 'TRANSPORTE'}
                    </span>
                </td>
            </tr>
        `;
    },

    // -----------------------------------------------------------------
    // 4. RENDER TABLA AGENTE CAUSAL
    // -----------------------------------------------------------------
    renderTablaAgcausal() {
        const tbody = document.getElementById('tbody-placas-agcausal');
        if (!tbody) return;

        const rows = this._view.causal || [];
        const meta = this._view.meta;
        const fecFmt = meta.causalFec || this.fecProcesoFormateada;
        const placa = meta.causalPlaca || '(Todas)';
        const esTodas = (placa === '(Todas)');

        const badgeC = document.getElementById('badge-causal-placa');
        if (badgeC) {
            badgeC.textContent = esTodas ? `Placas: (Todas) | Período: ${fecFmt || 'Actual'}` : `Placa: ${placa} | Fecha: ${fecFmt}`;
        }

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400 italic">No hay agentes causales registrados para ${esTodas ? 'las placas' : 'la placa ' + placa} en ${fecFmt}.</td></tr>`;
            this._renderBarra('causal', 1, 0);
            return;
        }

        const page = this._clampPage(this._pages.causal, Math.ceil(rows.length / this._pageSize));
        this._pages.causal = page;
        const start = (page - 1) * this._pageSize;
        const slice = rows.slice(start, start + this._pageSize);

        this._ttStore.causal = {};
        let bodyHtml = '';
        slice.forEach((c, i) => {
            bodyHtml += this._buildCausalRow(c, start + i, fecFmt, placa, true);
        });
        tbody.innerHTML = bodyHtml;
        this._renderBarra('causal', page, rows.length);
    },

    _buildCausalRow(c, idx, fecFmt, placa, store) {
        const rowPlaca = c.placa || placa;
        let ttAttr = '';
        if (store) {
            const uid = 'c' + idx;
            this._ttStore.causal[uid] = {
                kind: 'row',
                data: {
                    'Fecha Proceso': fecFmt,
                    'Cliente': c.cliente,
                    'Placa': rowPlaca,
                    'Área': c.area,
                    'Código': c.codigoconta,
                    'Causa': c.causatipo,
                    'Fecha Registro': c.fecharegistro_fmt || c.fecharegistro,
                    'Hora Registro': c.horaregistro,
                    'Descripción': c.descripcion
                }
            };
            ttAttr = ` data-tt-table="causal" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="hover:bg-blue-50/50 transition-colors"${ttAttr}>
                <td class="px-2 py-1.5 text-center font-mono text-slate-500 border-r border-slate-100">${fecFmt}</td>
                <td class="px-2 py-1.5 text-left font-medium text-slate-800 border-r border-slate-100">${c.cliente || ''}</td>
                <td class="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">${rowPlaca}</td>
                <td class="px-2 py-1.5 text-left font-medium text-blue-700 border-r border-slate-100">${c.area || ''}</td>
                <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-700 border-r border-slate-100">${c.codigoconta || ''}</td>
                <td class="px-2 py-1.5 text-left font-semibold text-slate-800 border-r border-slate-100">${c.causatipo || ''}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${c.fecharegistro_fmt || c.fecharegistro || ''}</td>
                <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${c.horaregistro || ''}</td>
                <td class="px-3 py-1.5 text-left text-slate-700 max-w-[340px] truncate cursor-default" title="${c.descripcion}">${c.descripcion || ''}</td>
            </tr>
        `;
    },

    // -----------------------------------------------------------------
    // 5. RENDER TABLA CUMPLIMIENTO OBJETIVO
    // -----------------------------------------------------------------
    renderTablaCumplimiento() {
        this.renderTablaCumplimientoPlaca();
        this.renderTablaCumplimientoCodigo();
    },

    renderTablaCumplimientoPlaca() {
        const tbodyPlaca = document.getElementById('tbody-cumplimiento-placa');
        if (!tbodyPlaca) return;

        const rows = this._view.cumpPlaca || [];
        const meta = this._view.meta;
        const fecFmt = meta.cumpFec || this.fecProcesoFormateada;
        const placa = meta.cumpPlaca || '(Todas)';
        const esTodas = (placa === '(Todas)');

        const badgeCum = document.getElementById('badge-cumplimiento-placa');
        if (badgeCum) {
            badgeCum.textContent = esTodas ? `Placas: (Todas) | Período: ${fecFmt || 'Actual'}` : `Placa: ${placa} | Fecha: ${fecFmt}`;
        }

        if (rows.length === 0) {
            tbodyPlaca.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 italic">No hay datos de cumplimiento para esta placa.</td></tr>`;
            this._renderBarra('cumpPlaca', 1, 0);
            return;
        }

        const page = this._clampPage(this._pages.cumpPlaca, Math.ceil(rows.length / this._pageSize));
        this._pages.cumpPlaca = page;
        const start = (page - 1) * this._pageSize;
        const slice = rows.slice(start, start + this._pageSize);

        this._ttStore.cumpPlaca = {};
        let htmlP = '';
        slice.forEach((p, i) => {
            htmlP += this._buildCumpPlacaRow(p, start + i, fecFmt, true);
        });
        tbodyPlaca.innerHTML = htmlP;
        this._renderBarra('cumpPlaca', page, rows.length);
    },

    _buildCumpPlacaRow(p, idx, fecFmt, store) {
        const isNegative = (p.dif < 0);
        const difColor = isNegative ? 'text-emerald-700 bg-emerald-50' : (p.dif > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-700');

        let ttAttr = '';
        if (store) {
            const uid = 'cp' + idx;
            this._ttStore.cumpPlaca[uid] = {
                kind: 'row',
                data: {
                    'Zona': p.zonaorigen,
                    'Cliente': p.cliente,
                    'Placa': p.placa,
                    'Objetivo': `${this.formatNum(p.objetivo, 2)}%`,
                    'Real': `${this.formatNum(p.real, 2)}%`,
                    'Diferencia': `${this.formatNum(p.dif, 2)}%`,
                    'Entrada': `${this.formatNum(p.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(p.mermatotal, 2)} Kg`
                }
            };
            ttAttr = ` data-tt-table="cumpPlaca" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors cursor-default"${ttAttr}>
                <td class="px-2 py-1 text-center font-mono text-slate-500 border-r border-slate-100">${fecFmt}</td>
                <td class="px-2 py-1 text-left font-medium text-slate-800 border-r border-slate-100">${p.zonaorigen}</td>
                <td class="px-2 py-1 text-left font-medium text-slate-800 border-r border-slate-100">${p.cliente}</td>
                <td class="px-2 py-1 text-center font-bold text-slate-800 border-r border-slate-100">${p.placa}</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100">${this.formatNum(p.objetivo, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono font-bold text-blue-700 border-r border-slate-100">${this.formatNum(p.real, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono font-bold ${difColor} border-r border-slate-100">${this.formatNum(p.dif, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100">${this.formatNum(p.entrada, 2)}</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700">${this.formatNum(p.mermatotal, 2)}</td>
            </tr>
        `;
    },

    renderTablaCumplimientoCodigo() {
        const tbodyCod = document.getElementById('tbody-cumplimiento-codigo');
        const tfootCod = document.getElementById('tfoot-cumplimiento-codigo');
        if (!tbodyCod) return;

        const rows = this._view.cumpCod || [];
        const meta = this._view.meta;
        const fecFmt = meta.cumpFec || this.fecProcesoFormateada;
        const total = this._view.cumpTotal || this._computeCumpTotal(rows);

        if (rows.length === 0) {
            tbodyCod.innerHTML = `<tr><td colspan="10" class="py-4 text-center text-slate-400 italic">No hay desglose por código disponible.</td></tr>`;
            if (tfootCod) tfootCod.innerHTML = '';
            this._renderBarra('cumpCod', 1, 0);
            return;
        }

        const page = this._clampPage(this._pages.cumpCod, Math.ceil(rows.length / this._pageSize));
        this._pages.cumpCod = page;
        const start = (page - 1) * this._pageSize;
        const slice = rows.slice(start, start + this._pageSize);

        this._ttStore.cumpCod = {};
        let htmlC = '';
        slice.forEach((c, i) => {
            htmlC += this._buildCumpCodRow(c, start + i, fecFmt, true);
        });
        tbodyCod.innerHTML = htmlC;

        if (tfootCod) {
            tfootCod.innerHTML = this._buildCumpFootRows(total, true);
        }
        this._renderBarra('cumpCod', page, rows.length);
    },

    _buildCumpCodRow(c, idx, fecFmt, store) {
        const isNegative = (c.dif < 0);
        const difColor = isNegative ? 'text-emerald-700 bg-emerald-50' : (c.dif > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-700');

        let ttAttr = '';
        if (store) {
            const uid = 'cc' + idx;
            this._ttStore.cumpCod[uid] = {
                kind: 'row',
                data: {
                    'Zona': c.zonaorigen,
                    'Cliente': c.cliente,
                    'Placa': c.placa,
                    'Código': c.codigo,
                    'Objetivo': `${this.formatNum(c.objetivo, 2)}%`,
                    'Real': `${this.formatNum(c.real, 2)}%`,
                    'Diferencia': `${this.formatNum(c.dif, 2)}%`,
                    'Entrada': `${this.formatNum(c.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(c.mermatotal, 2)} Kg`
                }
            };
            ttAttr = ` data-tt-table="cumpCod" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors cursor-default"${ttAttr}>
                <td class="px-2 py-1 text-center font-mono text-slate-500 border-r border-slate-100">${fecFmt}</td>
                <td class="px-2 py-1 text-left font-medium text-slate-800 border-r border-slate-100">${c.zonaorigen}</td>
                <td class="px-2 py-1 text-left font-medium text-slate-800 border-r border-slate-100">${c.cliente}</td>
                <td class="px-2 py-1 text-center font-bold text-slate-800 border-r border-slate-100">${c.placa}</td>
                <td class="px-2 py-1 text-center font-mono font-bold text-slate-700 border-r border-slate-100">${c.codigo}</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100">${this.formatNum(c.objetivo, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono font-bold text-blue-700 border-r border-slate-100">${this.formatNum(c.real, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono font-bold ${difColor} border-r border-slate-100">${this.formatNum(c.dif, 2)}%</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100">${this.formatNum(c.entrada, 2)}</td>
                <td class="px-2 py-1 text-right font-mono text-slate-700">${this.formatNum(c.mermatotal, 2)}</td>
            </tr>
        `;
    },

    _buildCumpFootRows(total, store) {
        const isNegTot = (total.dif < 0);
        const difColTot = isNegTot ? 'text-emerald-700' : (total.dif > 0 ? 'text-rose-700' : 'text-slate-800');

        let uidAttr = '';
        if (store) {
            const uid = 'foot';
            this._ttStore.cumpCod[uid] = {
                kind: 'row',
                data: {
                    'Tipo': 'Total Cumplimiento',
                    'Objetivo': `${this.formatNum(total.objetivo, 2)}%`,
                    'Real': `${this.formatNum(total.real, 2)}%`,
                    'Diferencia': `${this.formatNum(total.dif, 2)}%`,
                    'Entrada Total': `${this.formatNum(total.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(total.mermatotal, 2)} Kg`
                }
            };
            uidAttr = ` data-tt-table="cumpCod" data-tt-uid="${uid}"`;
        }

        return `
            <tr class="bg-slate-100/95 font-bold text-slate-900 border-t border-slate-300"${uidAttr}>
                <td colspan="5" class="px-2 py-1.5 text-left font-bold text-slate-700 border-r border-slate-300">Total</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default">${this.formatNum(total.objetivo, 2)}%</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-800 border-r border-slate-200 cursor-default">${this.formatNum(total.real, 2)}%</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold ${difColTot} border-r border-slate-200 cursor-default">${this.formatNum(total.dif, 2)}%</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default">${this.formatNum(total.entrada, 2)}</td>
                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 cursor-default">${this.formatNum(total.mermatotal, 2)}</td>
            </tr>
        `;
    },

    // -----------------------------------------------------------------
    // INTERACCIÓN MASTER-DETAIL: CLICK EN FILA DE PLACA
    // -----------------------------------------------------------------
    setupInteractiveSelection() {
        const container = document.getElementById('contenedor-grafica-costo');
        if (!container) return;

        if (this._clickHandler) container.removeEventListener('click', this._clickHandler);
        this._clickHandler = async (e) => {
            const row = e.target.closest('tr[data-placa-row]');
            if (!row) return;

            const placa = row.getAttribute('data-placa-row');
            const fecproceso = row.getAttribute('data-fecproceso-row');
            if (!placa || placa === '0') return;

            if (this.placaSeleccionada && this.placaSeleccionada === placa) {
                await this.deseleccionarPlaca();
            } else {
                await this.seleccionarPlaca(placa, fecproceso);
            }
        };
        container.addEventListener('click', this._clickHandler);
    },

    async seleccionarPlaca(placa, fecproceso) {
        this.placaSeleccionada = placa;
        this.fecProcesoSeleccionada = fecproceso;
        this.fecProcesoFormateada = fecproceso ? fecproceso.replace(/-/g, '/') : '';
        this._ventasLoadSeq = (this._ventasLoadSeq || 0) + 1;

        this.updateSelectionHighlight();
        this.actualizarBadgesCabecera(placa, this.fecProcesoFormateada);

        if (this._puedeFiltrarEnMemoria()) {
            this._view = this._filtrarEnMemoria(placa, fecproceso);
            this._resetDetailPages();
            this.renderTablaVentas();
            this.renderTablaRutas();
            this.renderTablaAgcausal();
            this.renderTablaCumplimiento();
        } else {
            this.mostrarPlaceholdersCarga(placa);
            await this.cargarDetallePlaca(placa, fecproceso);
        }
    },

    async deseleccionarPlaca() {
        this.placaSeleccionada = null;
        this.fecProcesoSeleccionada = null;
        this.fecProcesoFormateada = '';
        this._ventasLoadSeq = (this._ventasLoadSeq || 0) + 1;

        this.updateSelectionHighlight();
        this.actualizarBadgesCabecera('(Todas)', 'Período Completo');

        if (this._base && this._baseCompleto && !this._baseEsFiltrada) {
            this._ventasServerMode = false;
            this._ventasServerConfig = null;
            this._view = {
                ventas: this._base.ventas,
                rutas: this._base.rutas,
                causal: this._base.causal,
                cumpPlaca: this._base.cumpPlaca,
                cumpCod: this._base.cumpCod,
                meta: { ...this._base.meta },
                cumpTotal: this._base.cumpTotal
            };
            this._resetDetailPages();
            this.renderTablaVentas();
            this.renderTablaRutas();
            this.renderTablaAgcausal();
            this.renderTablaCumplimiento();
        } else if (this._base && this._otrosCompletos && this._ventasInitial) {
            this._ventasServerMode = true;
            this._ventasServerConfig = {
                total: this._ventasInitial.total,
                page: this._ventasInitial.page,
                pageSize: this._ventasInitial.pageSize,
                totalMetrics: this._ventasInitial.totalMetrics
            };
            this._view = {
                ventas: this._ventasInitial.rows,
                rutas: this._base.rutas,
                causal: this._base.causal,
                cumpPlaca: this._base.cumpPlaca,
                cumpCod: this._base.cumpCod,
                meta: { ...this._base.meta },
                cumpTotal: this._base.cumpTotal
            };
            this._resetDetailPages();
            this.renderTablaVentas();
            this.renderTablaRutas();
            this.renderTablaAgcausal();
            this.renderTablaCumplimiento();
        } else {
            this.mostrarPlaceholdersCarga('(Todas)');
            await this.cargarDetallePlaca(null, null);
        }
    },

    updateSelectionHighlight() {
        const tbody = document.getElementById('tbody-placas-liq');
        if (!tbody) return;
        const sel = this.placaSeleccionada;

        tbody.querySelectorAll('tr[data-placa-row]').forEach(tr => {
            const isSel = !!(sel && tr.getAttribute('data-placa-row') === sel);
            tr.classList.toggle('bg-blue-100/90', isSel);
            tr.classList.toggle('font-bold', isSel);
            tr.classList.toggle('border-l-4', isSel);
            tr.classList.toggle('border-l-blue-600', isSel);
            tr.classList.toggle('text-blue-900', isSel);
            tr.classList.toggle('hover:bg-blue-50/50', !isSel);
            tr.classList.toggle('cursor-pointer', !isSel);

            const placaTd = tr.querySelector('td[data-role="placa"]');
            if (placaTd) {
                placaTd.classList.toggle('bg-blue-100/90', isSel);
                placaTd.classList.toggle('bg-white', !isSel);
                placaTd.classList.toggle('font-bold', isSel);
                placaTd.classList.toggle('font-medium', !isSel);
                placaTd.classList.toggle('text-blue-900', isSel);
                placaTd.classList.toggle('text-slate-800', !isSel);
            }

            const itemTd = tr.querySelector('td[data-role="item"]');
            if (itemTd) {
                itemTd.classList.toggle('bg-blue-100/90', isSel);
                itemTd.classList.toggle('bg-white', !isSel);
                itemTd.classList.toggle('font-semibold', isSel);
            }
        });
    },

    actualizarBadgesCabecera(placa, fecFmt) {
        const esTodas = (!placa || placa === '(Todas)');
        const txtVentas = esTodas ? `Placas: (Todas) | Período: ${fecFmt || 'Actual'}` : `Placa: ${placa} | Fecha: ${fecFmt}`;
        const txtSimple = esTodas ? `Placas: (Todas)` : `Placa: ${placa}`;

        const badgeV = document.getElementById('badge-ventas-placa');
        if (badgeV) badgeV.textContent = txtVentas;

        const badgeR = document.getElementById('badge-rutas-placa');
        if (badgeR) badgeR.textContent = esTodas ? txtSimple : `Placa: ${placa} | Fecha: ${fecFmt}`;

        const badgeC = document.getElementById('badge-causal-placa');
        if (badgeC) badgeC.textContent = txtSimple;

        const badgeCum = document.getElementById('badge-cumplimiento-placa');
        if (badgeCum) badgeCum.textContent = txtSimple;
    },

    mostrarPlaceholdersCarga(placa) {
        const txtPlaca = (placa === '(Todas)' || !placa) ? 'todas las placas' : `placa ${placa}`;
        const tV = document.getElementById('tbody-placas-ventas');
        if (tV) tV.innerHTML = `<tr><td colspan="17" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando ventas para ${txtPlaca}...</td></tr>`;

        const tR = document.getElementById('tbody-placas-rutas');
        if (tR) tR.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando rutas para ${txtPlaca}...</td></tr>`;

        const tA = document.getElementById('tbody-placas-agcausal');
        if (tA) tA.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando causas para ${txtPlaca}...</td></tr>`;

        const tC = document.getElementById('tbody-cumplimiento-placa');
        if (tC) tC.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-blue-600 font-medium animate-pulse">Cargando cumplimiento para ${txtPlaca}...</td></tr>`;
    },

    _getRangoActual() {
        let rango = {};
        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
            rango = PeriodoHelper.obtenerRangoFechas();
        }
        const fechaInicio = rango.fechaInicio || document.getElementById('input-fecha-inicio')?.value || '2026-03-30';
        const fechaFin = rango.fechaFin || document.getElementById('input-fecha-fin')?.value || fechaInicio;
        return { fechaInicio, fechaFin };
    },

    async _cargarPaginaVentas(page) {
        if (!this._ventasServerConfig || !this.controllerRef || !this.controllerRef.service) return;
        const cfg = this._ventasServerConfig;
        const { fechaInicio, fechaFin } = this._getRangoActual();
        const pages = Math.max(1, Math.ceil((Number(cfg.total) || 0) / this._pageSize));
        const destino = this._clampPage(page, pages);
        const seq = ++this._ventasLoadSeq;

        cfg.page = destino;
        this._pages.ventas = destino;
        this._renderBarra('ventas', destino, Number(cfg.total) || 0);

        const tbodyLoading = document.getElementById('tbody-placas-ventas');
        if (tbodyLoading) {
            tbodyLoading.innerHTML = `<tr><td colspan="17" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando página ${destino}...</td></tr>`;
        }

        try {
            const response = await this.controllerRef.service.obtenerDashboard({
                tipo_grafico: 'DashAnalisisPlacas',
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                placa_seleccionada: this.placaSeleccionada,
                fecproceso_seleccionada: this.fecProcesoSeleccionada,
                incluir_liquidacion: false,
                solo_ventas: true,
                paginado_ventas: true,
                page_size: this._pageSize,
                page_ventas: destino
            });

            if (seq !== this._ventasLoadSeq || this._destroyed) return;
            const isOk = response && (response.success === true || response.status === 'success');
            if (!isOk) return;

            const payload = response.payload || response.data || response;
            const sec = payload.seccion_ventas || {};
            cfg.total = Number(sec.total_registros) || Number(cfg.total) || 0;
            cfg.totalMetrics = sec.total || cfg.totalMetrics;
            cfg.page = Number(sec.page) || destino;
            cfg.pageSize = Number(sec.page_size) || this._pageSize;
            this._pages.ventas = cfg.page;
            this._view.ventas = sec.filas || [];
            this._view.meta = {
                ...this._view.meta,
                ventasPlaca: sec.placa || this._view.meta.ventasPlaca,
                ventasFec: sec.fecproceso_formateada || this._view.meta.ventasFec
            };
            this.renderTablaVentas();
        } catch (err) {
            console.error('Error paginando ventas:', err);
        }
    },

    async _precargarVentasCompletas() {
        if (!this._ventasServerMode || !this._ventasServerConfig) return;
        if (!this._otrosCompletos) return;
        const total = Number(this._ventasServerConfig.total) || 0;
        if (total === 0 || total > 5000) return;
        if (!this.controllerRef || !this.controllerRef.service) return;

        const seq = ++this._preloadSeq;
        try {
            const { fechaInicio, fechaFin } = this._getRangoActual();
            const response = await this.controllerRef.service.obtenerDashboard({
                tipo_grafico: 'DashAnalisisPlacas',
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                incluir_liquidacion: false,
                solo_ventas: true,
                paginado_ventas: false
            });

            if (seq !== this._preloadSeq || this._destroyed) return;
            const isOk = response && (response.success === true || response.status === 'success');
            if (!isOk) return;

            const payload = response.payload || response.data || response;
            const sec = payload.seccion_ventas || {};
            if (sec.completo === false) return;

            this._base.ventas = sec.filas || [];
            this._baseCompleto = this._otrosCompletos;
            this._ventasServerMode = false;
            this._ventasServerConfig = null;

            if (!this.placaSeleccionada) {
                this._view.ventas = this._base.ventas;
                this._view.meta = {
                    ...this._view.meta,
                    ventasPlaca: sec.placa || '(Todas)',
                    ventasFec: sec.fecproceso_formateada || this._view.meta.ventasFec
                };
                this._pages.ventas = 1;
                this.renderTablaVentas();
            }
        } catch (err) {
            console.warn('No se pudo precargar ventas completas:', err);
        }
    },

    async cargarDetallePlaca(placa, fecproceso) {
        if (!this.controllerRef || !this.controllerRef.service) return;

        try {
            const { fechaInicio, fechaFin } = this._getRangoActual();
            const key = `${fechaInicio}|${fechaFin}|${placa || '(Todas)'}|${fecproceso || ''}`;

            if (this._cacheSeleccion[key]) {
                this._applyViewFromPayload(this._cacheSeleccion[key], placa, fecproceso);
                return;
            }

            const response = await this.controllerRef.service.obtenerDashboard({
                tipo_grafico: 'DashAnalisisPlacas',
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                placa_seleccionada: placa,
                fecproceso_seleccionada: fecproceso,
                incluir_liquidacion: false
            });

            if (this._destroyed) return;

            const isOk = response && (response.success === true || response.status === 'success');
            if (isOk) {
                const payload = response.payload || response.data || response;
                this._cacheSeleccion[key] = payload;
                const claves = Object.keys(this._cacheSeleccion);
                while (claves.length > 10) {
                    delete this._cacheSeleccion[claves.shift()];
                }
                this._applyViewFromPayload(payload, placa, fecproceso);
            } else {
                console.warn('Respuesta inesperada al consultar detalle de placa:', response);
            }
        } catch (err) {
            console.error('Error al actualizar detalle de placa:', err);
        }
    },

    _applyViewFromPayload(payload, placa, fecproceso) {
        this._ventasLoadSeq = (this._ventasLoadSeq || 0) + 1;
        this._ventasServerMode = false;
        this._ventasServerConfig = null;

        const ventasSec = payload.seccion_ventas || {};
        const rutasSec = payload.seccion_tiempos_ruta || {};
        const causalSec = payload.seccion_agente_causal || {};
        const cumpSec = payload.seccion_cumplimiento || {};
        const cumpCodData = cumpSec.tabla_codigo || {};
        const fecFmt = fecproceso ? String(fecproceso).replace(/-/g, '/') : '';

        const ventas = ventasSec.filas || [];
        const rutas = rutasSec.filas || [];
        const causal = causalSec.filas || [];
        const cumpPlaca = cumpSec.tabla_placa || [];
        const cumpCod = cumpCodData.filas || [];

        let meta;
        if (placa) {
            meta = this._buildMetaFor(placa, fecFmt);
        } else {
            meta = {
                ventasPlaca: ventasSec.placa || '(Todas)',
                ventasFec: ventasSec.fecproceso_formateada || fecFmt,
                rutasPlaca: rutasSec.placa || '(Todas)',
                rutasFec: rutasSec.fecproceso_formateada || fecFmt,
                causalPlaca: causalSec.placa || '(Todas)',
                causalFec: causalSec.fecproceso_formateada || fecFmt,
                cumpPlaca: cumpSec.placa || '(Todas)',
                cumpFec: cumpSec.fecproceso_formateada || fecFmt
            };
        }

        if (!placa) {
            this._base = {
                ventas: ventas,
                rutas: rutas,
                causal: causal,
                cumpPlaca: cumpPlaca,
                cumpCod: cumpCod,
                meta: { ...meta },
                cumpTotal: cumpCodData.total || this._computeCumpTotal(cumpCod)
            };
            this._otrosCompletos = rutasSec.completo !== false
                && causalSec.completo !== false
                && cumpSec.completo !== false
                && cumpCodData.completo !== false;
            this._baseCompleto = ventasSec.completo !== false && this._otrosCompletos;
            this._baseEsFiltrada = false;
        }

        this._view = {
            ventas: ventas,
            rutas: rutas,
            causal: causal,
            cumpPlaca: cumpPlaca,
            cumpCod: cumpCod,
            meta: meta,
            cumpTotal: cumpCodData.total || this._computeCumpTotal(cumpCod)
        };

        this._resetDetailPages();
        this.renderTablaVentas();
        this.renderTablaRutas();
        this.renderTablaAgcausal();
        this.renderTablaCumplimiento();
    },

    // -----------------------------------------------------------------
    // EXPORTACIÓN A EXCEL (TODAS LAS FILAS DEL FILTRO)
    // -----------------------------------------------------------------
    setupExportListeners() {
        document.getElementById('btn-export-placas-liq')?.addEventListener('click', () => {
            const liqData = this.datosBackend.seccion_liquidacion || {};
            const clientes = liqData.clientes || [];
            const body = this._buildLiqBodyHtml(clientes, true);
            const foot = (liqData.total_general && liqData.total_general.transacciones)
                ? '<tfoot>' + this._buildLiqFootRows(liqData.total_general, false) + '</tfoot>'
                : '';
            this._exportConDatos('tabla-analisis-placas-liq', body, foot, 'Liquidacion_Placas', 'Liquidacion Placas');
        });

        document.getElementById('btn-export-placas-ventas')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget;
            const originalHtml = btn.innerHTML;
            let rows = this._view.ventas || [];

            if (this._ventasServerMode && this._ventasServerConfig && this.controllerRef && this.controllerRef.service) {
                btn.disabled = true;
                btn.innerHTML = '<span>Generando...</span>';
                try {
                    const { fechaInicio, fechaFin } = this._getRangoActual();
                    const response = await this.controllerRef.service.obtenerDashboard({
                        tipo_grafico: 'DashAnalisisPlacas',
                        fecha_inicio: fechaInicio,
                        fecha_fin: fechaFin,
                        placa_seleccionada: this.placaSeleccionada,
                        fecproceso_seleccionada: this.fecProcesoSeleccionada,
                        incluir_liquidacion: false,
                        solo_ventas: true,
                        paginado_ventas: false
                    });
                    const payload = response && (response.payload || response.data || response);
                    rows = (payload && payload.seccion_ventas && payload.seccion_ventas.filas) || [];
                } catch (err) {
                    console.error('Error exportando ventas completas:', err);
                    rows = this._view.ventas || [];
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }

            const body = rows.map((f, i) => this._buildVentasRow(f, i, false)).join('');
            const foot = rows.length ? '<tfoot>' + this._buildVentasFootRows(this._computeVentasTotal(rows), false) + '</tfoot>' : '';
            this._exportConDatos('tabla-analisis-placas-ventas', body, foot, `Ventas_Placa_${this.placaSeleccionada || 'Todas'}`, 'Analisis Ventas');
        });

        document.getElementById('btn-export-placas-rutas')?.addEventListener('click', () => {
            const rows = this._view.rutas || [];
            const placa = this._view.meta.rutasPlaca;
            const body = rows.map((r, i) => this._buildRutasRow(r, i, placa, false)).join('');
            this._exportConDatos('tabla-analisis-placas-rutas', body, '', `Rutas_Placa_${this.placaSeleccionada || 'Todas'}`, 'Tiempos Ruta');
        });

        document.getElementById('btn-export-placas-agcausal')?.addEventListener('click', () => {
            const rows = this._view.causal || [];
            const meta = this._view.meta;
            const body = rows.map((c, i) => this._buildCausalRow(c, i, meta.causalFec, meta.causalPlaca, false)).join('');
            this._exportConDatos('tabla-analisis-placas-agcausal', body, '', `Agente_Causal_Placa_${this.placaSeleccionada || 'Todas'}`, 'Agente Causal');
        });

        document.getElementById('btn-export-placas-cumplimiento')?.addEventListener('click', () => {
            const rows = this._view.cumpCod || [];
            const meta = this._view.meta;
            const total = this._view.cumpTotal || this._computeCumpTotal(rows);
            const body = rows.map((c, i) => this._buildCumpCodRow(c, i, meta.cumpFec, false)).join('');
            const foot = rows.length ? '<tfoot>' + this._buildCumpFootRows(total, false) + '</tfoot>' : '';
            this._exportConDatos('tabla-cumplimiento-codigo', body, foot, `Cumplimiento_Placa_${this.placaSeleccionada || 'Todas'}`, 'Cumplimiento Objetivo');
        });
    },

    _exportConDatos(tableId, bodyHtml, footHtml, nombreArchivo, nombreHoja) {
        if (typeof ExcelExportHelper === 'undefined') return;
        const live = document.getElementById(tableId);
        if (!live) return;

        const theadHtml = live.tHead ? live.tHead.outerHTML : '';
        const temp = document.createElement('table');
        temp.style.position = 'fixed';
        temp.style.left = '-99999px';
        temp.style.top = '0';
        temp.innerHTML = theadHtml + '<tbody>' + bodyHtml + '</tbody>' + (footHtml || '');
        document.body.appendChild(temp);

        try {
            ExcelExportHelper.exportarTabla(temp, nombreArchivo, { nombreHoja: nombreHoja });
        } finally {
            document.body.removeChild(temp);
        }
    },

    // -----------------------------------------------------------------
    // TOOLTIPS FLOTANTES
    // -----------------------------------------------------------------
    attachTableTooltips() {
        const container = document.getElementById('contenedor-grafica-costo');
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!container || !tooltipEl) return;

        if (this._tableTooltipHandler) {
            container.removeEventListener('mouseover', this._tableTooltipHandler);
            container.removeEventListener('mousemove', this._tableTooltipMoveHandler);
            container.removeEventListener('mouseout', this._tableTooltipOutHandler);
            this._tableTooltipHandler = null;
            this._tableTooltipMoveHandler = null;
            this._tableTooltipOutHandler = null;
        }

        let currentCell = null;

        this._tableTooltipHandler = (e) => {
            const td = e.target.closest('td');
            const tr = e.target.closest('tr[data-tt-uid]');
            if (!td || !tr) {
                if (currentCell) {
                    currentCell = null;
                    this.hideTooltip();
                }
                return;
            }
            if (td === currentCell) return;
            currentCell = td;

            const table = tr.getAttribute('data-tt-table');
            const uid = tr.getAttribute('data-tt-uid');
            const entry = (this._ttStore[table] && this._ttStore[table][uid]) || null;
            if (!entry) return;

            let obj = null;
            if (entry.kind === 'row') {
                obj = entry.data;
            } else {
                const base = Number(tr.getAttribute('data-tt-base')) || 0;
                const block = Math.floor((td.cellIndex - base) / 3);
                const col = this._liqCols[block];
                if (col) {
                    const vals = (entry.transacciones && entry.transacciones[col.codtra]) || { cant: 0, peso: 0, pp: 0 };
                    const cStr = this.formatNum(vals.cant, 0, true);
                    const pStr = this.formatNum(vals.peso, 2, true);
                    const ppStr = this.formatNum(vals.pp, 3, true);
                    const trans = `${col.codtra} - ${col.descri}`;

                    if (entry.kind === 'item') {
                        obj = {
                            'Cliente': entry.cdCliente,
                            'Placa': entry.placa || '(Vacío)',
                            'Ítem': entry.codItem,
                            'Transacción': trans,
                            'Cantidad': cStr || '0',
                            'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                            'PP': ppStr || '0.000'
                        };
                    } else if (entry.kind === 'sub') {
                        obj = {
                            'Tipo': `Subtotal ${entry.cdCliente}`,
                            'Transacción': trans,
                            'Cantidad': cStr || '0',
                            'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                            'PP': ppStr || '0.000'
                        };
                    } else if (entry.kind === 'total') {
                        obj = {
                            'Tipo': 'Total General',
                            'Transacción': trans,
                            'Cantidad': cStr || '0',
                            'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                            'PP': ppStr || '0.000'
                        };
                    }
                }
            }

            if (!obj) return;

            tooltipEl.innerHTML = this._buildTooltipContent(obj);
            tooltipEl.classList.remove('hidden');
            tooltipEl.style.display = 'block';
            this.positionTooltip(e, tooltipEl);
        };

        this._tableTooltipMoveHandler = (e) => {
            if (!currentCell || tooltipEl.classList.contains('hidden')) return;
            this.positionTooltip(e, tooltipEl);
        };

        this._tableTooltipOutHandler = (e) => {
            if (!currentCell) return;
            const related = e.relatedTarget ? e.relatedTarget.closest('td') : null;
            if (related === currentCell) return;
            currentCell = null;
            this.hideTooltip();
        };

        container.addEventListener('mouseover', this._tableTooltipHandler);
        container.addEventListener('mousemove', this._tableTooltipMoveHandler);
        container.addEventListener('mouseout', this._tableTooltipOutHandler);
    },

    _buildTooltipContent(dataObj) {
        let contentHtml = '<div class="flex flex-col gap-1.5">';
        Object.entries(dataObj).forEach(([label, val]) => {
            const isPrimary = ['Tipo', 'Placa', 'Cliente', 'Corporativo', 'Transacción', 'Ruta', 'Evento'].includes(label);
            contentHtml += `
                <div class="flex justify-between items-center gap-4 text-xs ${isPrimary ? 'font-bold border-b border-slate-100 pb-1 text-slate-800' : 'text-slate-600'}">
                    <span class="font-medium text-slate-400">${label}:</span>
                    <span class="font-mono ${isPrimary ? 'text-blue-700' : 'text-slate-800'}">${val}</span>
                </div>
            `;
        });
        contentHtml += '</div>';
        return contentHtml;
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
        this._destroyed = true;
        this._ventasLoadSeq = (this._ventasLoadSeq || 0) + 1;
        this._preloadSeq = (this._preloadSeq || 0) + 1;
        const container = document.getElementById('contenedor-grafica-costo');
        if (container) {
            if (this._tableTooltipHandler) {
                container.removeEventListener('mouseover', this._tableTooltipHandler);
                container.removeEventListener('mousemove', this._tableTooltipMoveHandler);
                container.removeEventListener('mouseout', this._tableTooltipOutHandler);
            }
            if (this._clickHandler) {
                container.removeEventListener('click', this._clickHandler);
            }
            if (this._pageHandler) {
                container.removeEventListener('click', this._pageHandler);
            }
        }
        this._tableTooltipHandler = null;
        this._tableTooltipMoveHandler = null;
        this._tableTooltipOutHandler = null;
        this._clickHandler = null;
        this._pageHandler = null;
        this._sizeHandler = null;
        this._view = null;
        this._base = null;
        this._cacheSeleccion = {};
        this.hideTooltip();
    }
};

// Registrar en ChartRegistry
window.ChartRegistry['DashAnalisisPlacas'] = window.DashAnalisisPlacasChart;
