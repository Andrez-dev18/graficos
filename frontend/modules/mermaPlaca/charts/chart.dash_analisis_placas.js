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
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashAnalisisPlacasChart = {
    controllerRef: null,
    datosBackend: null,
    placaSeleccionada: null,
    fecProcesoSeleccionada: null,
    fecProcesoFormateada: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        const filtros = this.datosBackend.filtros || {};
        this.placaSeleccionada = filtros.placa_seleccionada || 'C8B727';
        this.fecProcesoSeleccionada = filtros.fecproceso_seleccionada || '2026-03-30';
        this.fecProcesoFormateada = this.fecProcesoSeleccionada ? this.fecProcesoSeleccionada.replace(/-/g, '/') : '';

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

        // Ocultar dropdowns de filtros no requeridos en este dashboard
        this.setupFilters();

        // Renderizar layout de 5 secciones
        this.renderLayout();

        // Renderizar cada una de las 5 tablas
        this.renderTablaLiquidacion();
        this.renderTablaVentas();
        this.renderTablaRutas();
        this.renderTablaAgcausal();
        this.renderTablaCumplimiento();

        // Adjuntar eventos de selección interactiva de placa en la tabla maestra
        this.setupInteractiveSelection();

        // Adjuntar eventos de tooltips flotantes
        this.attachTableTooltips();

        // Configurar botones de exportación individual a Excel
        this.setupExportListeners();
    },

    getSelectedFilters() {
        return {
            placa_seleccionada: this.placaSeleccionada,
            fecproceso_seleccionada: this.fecProcesoSeleccionada
        };
    },

    setupFilters() {
        // En DashAnalisisPlacas solo rige el filtro superior de rango de fechas FecProceso
        document.getElementById('contenedor-filtro-corporativo-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-placa-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-cliente-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-item-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-transaccion-merma')?.classList.add('hidden');
    },

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
                        <button id="btn-export-placas-liq" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Excel</span>
                        </button>
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
                                        Placa: ${this.placaSeleccionada}
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
                    </div>

                    <!-- SECCIÓN 3: TIEMPOS DE RUTA (5 cols) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Tiempos de Ruta</h2>
                                    <span id="badge-rutas-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        Placa: ${this.placaSeleccionada}
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
                                        Placa: ${this.placaSeleccionada}
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
                    </div>

                    <!-- SECCIÓN 5: CUMPLIMIENTO OBJETIVO (5 cols) -->
                    <div class="xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Cumplimiento Objetivo</h2>
                                    <span id="badge-cumplimiento-placa" class="bg-blue-50 text-blue-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-200">
                                        Placa: ${this.placaSeleccionada}
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
                        <div class="p-3 flex flex-col gap-4 overflow-y-auto max-h-[380px] custom-scrollbar bg-white">
                            
                            <!-- Subtabla 1: Placa General -->
                            <div class="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                                <table id="tabla-cumplimiento-placa" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                    <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
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

                            <!-- Subtabla 2: Desglose por Código -->
                            <div class="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                                <table id="tabla-cumplimiento-codigo" class="w-full text-[11px] border-collapse table-auto whitespace-nowrap">
                                    <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
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
    // 1. RENDER TABLA LIQUIDACIÓN DE PLACAS
    // -----------------------------------------------------------------
    renderTablaLiquidacion() {
        const thead = document.getElementById('thead-placas-liq');
        const tbody = document.getElementById('tbody-placas-liq');
        const tfoot = document.getElementById('tfoot-placas-liq');
        if (!thead || !tbody) return;

        const liqData = this.datosBackend.seccion_liquidacion || {};
        const colTrans = liqData.columnas_transacciones || [];
        const clientes = liqData.clientes || [];
        const totalFechas = liqData.total_fechas || 1;
        const totalGral = liqData.total_general || {};

        // Encabezados
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

        if (clientes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${3 + colTrans.length * 3}" class="py-8 text-center text-slate-400 italic">No hay registros de liquidación para el período seleccionado.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let bodyHtml = '';

        clientes.forEach(cGroup => {
            const tfecfac = cGroup.tfecfac || '';
            const fecDmy = cGroup.fec_dmy || tfecfac;
            const cdCliente = cGroup.cdcliente || '';
            const subtotal = cGroup.subtotal_cliente || {};
            const placas = cGroup.placas || [];

            // Calcular total de filas detalladas de ítems para este cliente
            const totalFilasItems = placas.reduce((acc, p) => acc + (p.items ? p.items.length : 1), 0);

            let filaIdxCliente = 0;

            // 1. Filas de Placas e Ítems (Renderizadas PRIMERO, idéntico a Tableau)
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

                    const rowClass = isSelected 
                        ? 'bg-blue-100/90 font-bold border-l-4 border-l-blue-600 text-blue-900 transition-colors'
                        : 'hover:bg-blue-50/50 transition-colors cursor-pointer';

                    bodyHtml += `
                        <tr class="${rowClass}" data-placa-row="${placa}" data-fecproceso-row="${fecproceso}">
                            ${isFirstRowOfClient ? `<td class="sticky left-0 z-10 bg-white px-3 py-1.5 font-bold text-slate-800 border-r border-slate-200 tracking-wide align-top" rowspan="${totalFilasItems}">${cdCliente}</td>` : ''}
                            ${isFirstItemOfPlaca ? `<td class="sticky left-[120px] z-10 ${isSelected ? 'bg-blue-100/90 font-bold text-blue-900' : 'bg-white font-medium text-slate-800'} px-3 py-1.5 text-center border-r border-slate-200 align-top" rowspan="${itemsCount}">${placa || ''}</td>` : ''}
                            <td class="sticky left-[200px] z-10 ${isSelected ? 'bg-blue-100/90 font-semibold' : 'bg-white'} px-3 py-1.5 text-center font-mono text-slate-800 border-r border-slate-200">${codItem}</td>
                    `;

                    colTrans.forEach(t => {
                        const vals = (iData.transacciones && iData.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
                        const cStr = this.formatNum(vals.cant, 0, true);
                        const pStr = this.formatNum(vals.peso, 2, true);
                        const ppStr = this.formatNum(vals.pp, 3, true);

                        const ttCell = encodeURIComponent(JSON.stringify({
                            'Cliente': cdCliente,
                            'Placa': placa || '(Vacío)',
                            'Ítem': codItem,
                            'Transacción': `${t.codtra} - ${t.descri}`,
                            'Cantidad': cStr || '0',
                            'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                            'PP': ppStr || '0.000'
                        }));

                        bodyHtml += `
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${ttCell}">${cStr}</td>
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${ttCell}">${pStr}</td>
                            <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${ttCell}">${ppStr}</td>
                        `;
                    });

                    bodyHtml += `</tr>`;
                    filaIdxCliente++;
                });
            });

            // 2. Fila de Subtotal de CDCliente (Placa: Total - Renderizada AL FINAL del cliente, como en Tableau)
            bodyHtml += `
                <tr class="bg-slate-100 font-bold text-slate-900 border-t border-b-2 border-slate-300">
                    <td class="sticky left-0 z-10 bg-slate-100 px-3 py-1.5 font-bold text-slate-800 border-r border-slate-300"></td>
                    <td class="sticky left-[120px] z-10 bg-slate-100 px-3 py-1.5 text-center font-bold text-slate-800 border-r border-slate-300">Total</td>
                    <td class="sticky left-[200px] z-10 bg-slate-100 px-3 py-1.5 text-center border-r border-slate-300"></td>
            `;

            colTrans.forEach(t => {
                const vals = (subtotal.transacciones && subtotal.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
                const cStr = this.formatNum(vals.cant, 0, true);
                const pStr = this.formatNum(vals.peso, 2, true);
                const ppStr = this.formatNum(vals.pp, 3, true);

                const ttSub = encodeURIComponent(JSON.stringify({
                    'Tipo': `Subtotal ${cdCliente}`,
                    'Transacción': `${t.codtra} - ${t.descri}`,
                    'Cantidad': cStr || '0',
                    'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                    'PP': ppStr || '0.000'
                }));

                bodyHtml += `
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttSub}">${cStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttSub}">${pStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttSub}">${ppStr}</td>
                `;
            });
            bodyHtml += `</tr>`;
        });

        tbody.innerHTML = bodyHtml;

        // 3. Fila de Total General al pie de la tabla (tfoot)
        if (tfoot && totalGral && totalGral.transacciones) {
            let footHtml = `
                <tr class="bg-slate-200 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td class="sticky left-0 z-30 bg-slate-200 px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300"></td>
                    <td class="sticky left-[120px] z-30 bg-slate-200 px-3 py-2 text-center uppercase tracking-wider font-extrabold border-r border-slate-300">Total general</td>
                    <td class="sticky left-[200px] z-30 bg-slate-200 px-3 py-2 text-center border-r border-slate-300"></td>
            `;

            colTrans.forEach(t => {
                const vals = (totalGral.transacciones && totalGral.transacciones[t.codtra]) || { cant: 0, peso: 0, pp: 0 };
                const cStr = this.formatNum(vals.cant, 0, true);
                const pStr = this.formatNum(vals.peso, 2, true);
                const ppStr = this.formatNum(vals.pp, 3, true);

                const ttTot = encodeURIComponent(JSON.stringify({
                    'Tipo': 'Total General',
                    'Transacción': `${t.codtra} - ${t.descri}`,
                    'Cantidad': cStr || '0',
                    'Peso': pStr ? `${pStr} Kg` : '0.00 Kg',
                    'PP': ppStr || '0.000'
                }));

                footHtml += `
                    <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default" data-tooltip-fields="${ttTot}">${cStr}</td>
                    <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default" data-tooltip-fields="${ttTot}">${pStr}</td>
                    <td class="px-2 py-2 text-right font-mono font-extrabold text-slate-900 border-r border-slate-300 cursor-default" data-tooltip-fields="${ttTot}">${ppStr}</td>
                `;
            });
            footHtml += `</tr>`;
            tfoot.innerHTML = footHtml;
        }
    },

    // -----------------------------------------------------------------
    // 2. RENDER TABLA ANÁLISIS DE VENTAS
    // -----------------------------------------------------------------
    renderTablaVentas() {
        const tbody = document.getElementById('tbody-placas-ventas');
        const tfoot = document.getElementById('tfoot-placas-ventas');
        if (!tbody) return;

        const ventasData = this.datosBackend.seccion_ventas || {};
        const filas = ventasData.filas || [];
        const total = ventasData.total || {};
        const fecFmt = ventasData.fecproceso_formateada || this.fecProcesoFormateada;
        const placa = ventasData.placa || this.placaSeleccionada;

        document.getElementById('badge-ventas-placa').textContent = `Placa: ${placa} | Fecha: ${fecFmt}`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="17" class="py-8 text-center text-slate-400 italic">No hay registros de ventas para la placa ${placa} en la fecha ${fecFmt}.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        let bodyHtml = '';
        filas.forEach(f => {
            const cantStr = this.formatNum(f.cantidad, 0);
            const pesoStr = this.formatNum(f.peso, 2);
            const valStr  = `S/ ${this.formatNum(f.valor, 2)}`;
            const ppStr   = this.formatNum(f.peso_prom_venta, 3);
            const prStr   = this.formatNum(f.precio_prom_venta, 3);

            const tt = encodeURIComponent(JSON.stringify({
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
            }));

            bodyHtml += `
                <tr class="hover:bg-blue-50/50 transition-colors">
                    <td class="px-2 py-1.5 text-center font-mono text-slate-500 border-r border-slate-100">${fecFmt}</td>
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
                    <td class="px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 cursor-default" data-tooltip-fields="${tt}">${cantStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100 cursor-default" data-tooltip-fields="${tt}">${pesoStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-medium text-slate-900 border-r border-slate-100 cursor-default" data-tooltip-fields="${tt}">${valStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default" data-tooltip-fields="${tt}">${ppStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono text-slate-700 cursor-default" data-tooltip-fields="${tt}">${prStr}</td>
                </tr>
            `;
        });
        tbody.innerHTML = bodyHtml;

        // Fila Total y Fila Total General
        if (tfoot) {
            const totCantStr = this.formatNum(total.cantidad, 0);
            const totPesoStr = this.formatNum(total.peso, 2);
            const totValStr  = `S/ ${this.formatNum(total.valor, 2)}`;
            const totPPStr   = this.formatNum(total.peso_prom_venta, 3);
            const totPrStr   = this.formatNum(total.precio_prom_venta, 3);

            const ttTot = encodeURIComponent(JSON.stringify({
                'Tipo': 'Total Ventas',
                'Cantidad Total': totCantStr,
                'Peso Total': `${totPesoStr} Kg`,
                'Valor Total': totValStr,
                'Peso Promedio': totPPStr,
                'Precio Promedio': totPrStr
            }));

            tfoot.innerHTML = `
                <tr class="bg-slate-100/95 font-bold text-slate-800 border-t border-slate-300">
                    <td colspan="12" class="px-3 py-1.5 text-left font-bold text-slate-700 border-r border-slate-300">Total</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${totCantStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${totPesoStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${totValStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${totPPStr}</td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 cursor-default" data-tooltip-fields="${ttTot}">${totPrStr}</td>
                </tr>
                <tr class="bg-blue-700 text-white font-extrabold shadow-inner">
                    <td colspan="12" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-blue-600">Total general</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${ttTot}">${totCantStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${ttTot}">${totPesoStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${ttTot}">${totValStr}</td>
                    <td class="px-2 py-2 text-right font-mono border-r border-blue-600 cursor-default" data-tooltip-fields="${ttTot}">${totPPStr}</td>
                    <td class="px-2 py-2 text-right font-mono cursor-default" data-tooltip-fields="${ttTot}">${totPrStr}</td>
                </tr>
            `;
        }
    },

    // -----------------------------------------------------------------
    // 3. RENDER TABLA TIEMPOS DE RUTA
    // -----------------------------------------------------------------
    renderTablaRutas() {
        const tbody = document.getElementById('tbody-placas-rutas');
        if (!tbody) return;

        const rutasData = this.datosBackend.seccion_tiempos_ruta || {};
        const filas = rutasData.filas || [];
        const placa = rutasData.placa || this.placaSeleccionada;

        document.getElementById('badge-rutas-placa').textContent = `Placa: ${placa}`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 italic">No hay rutas registradas para la placa ${placa}.</td></tr>`;
            return;
        }

        let bodyHtml = '';
        filas.forEach(r => {
            const tt = encodeURIComponent(JSON.stringify({
                'Placa': placa,
                'Ruta': r.numeroruta,
                'Fecha': r.fecha_formateada || r.fecha,
                'Hora': r.hora,
                'Evento': r.evento,
                'Localización': r.localizacion,
                'Área Responsable': r.arearesponsable
            }));

            bodyHtml += `
                <tr class="hover:bg-blue-50/50 transition-colors cursor-default" data-tooltip-fields="${tt}">
                    <td class="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">${placa}</td>
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
        });

        tbody.innerHTML = bodyHtml;
    },

    // -----------------------------------------------------------------
    // 4. RENDER TABLA AGENTE CAUSAL
    // -----------------------------------------------------------------
    renderTablaAgcausal() {
        const tbody = document.getElementById('tbody-placas-agcausal');
        if (!tbody) return;

        const causalData = this.datosBackend.seccion_agente_causal || {};
        const filas = causalData.filas || [];
        const fecFmt = causalData.fecproceso_formateada || this.fecProcesoFormateada;
        const placa = causalData.placa || this.placaSeleccionada;

        document.getElementById('badge-causal-placa').textContent = `Placa: ${placa} | Fecha: ${fecFmt}`;

        if (filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400 italic">No hay agentes causales registrados para la placa ${placa} en la fecha ${fecFmt}.</td></tr>`;
            return;
        }

        let bodyHtml = '';
        filas.forEach(c => {
            const tt = encodeURIComponent(JSON.stringify({
                'Fecha Proceso': fecFmt,
                'Cliente': c.cliente,
                'Placa': c.placa,
                'Área': c.area,
                'Código': c.codigoconta,
                'Causa': c.causatipo,
                'Fecha Registro': c.fecharegistro_fmt || c.fecharegistro,
                'Hora Registro': c.horaregistro,
                'Descripción': c.descripcion
            }));

            bodyHtml += `
                <tr class="hover:bg-blue-50/50 transition-colors">
                    <td class="px-2 py-1.5 text-center font-mono text-slate-500 border-r border-slate-100">${fecFmt}</td>
                    <td class="px-2 py-1.5 text-left font-medium text-slate-800 border-r border-slate-100">${c.cliente || ''}</td>
                    <td class="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-100">${c.placa || ''}</td>
                    <td class="px-2 py-1.5 text-left font-medium text-blue-700 border-r border-slate-100">${c.area || ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-700 border-r border-slate-100">${c.codigoconta || ''}</td>
                    <td class="px-2 py-1.5 text-left font-semibold text-slate-800 border-r border-slate-100">${c.causatipo || ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${c.fecharegistro_fmt || c.fecharegistro || ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-slate-600 border-r border-slate-100">${c.horaregistro || ''}</td>
                    <td class="px-3 py-1.5 text-left text-slate-700 max-w-[340px] truncate cursor-default" title="${c.descripcion}" data-tooltip-fields="${tt}">${c.descripcion || ''}</td>
                </tr>
            `;
        });

        tbody.innerHTML = bodyHtml;
    },

    // -----------------------------------------------------------------
    // 5. RENDER TABLA CUMPLIMIENTO OBJETIVO
    // -----------------------------------------------------------------
    renderTablaCumplimiento() {
        const tbodyPlaca = document.getElementById('tbody-cumplimiento-placa');
        const tbodyCod = document.getElementById('tbody-cumplimiento-codigo');
        const tfootCod = document.getElementById('tfoot-cumplimiento-codigo');
        if (!tbodyPlaca || !tbodyCod) return;

        const cumpData = this.datosBackend.seccion_cumplimiento || {};
        const tPlaca = cumpData.tabla_placa || [];
        const tCodData = cumpData.tabla_codigo || {};
        const tCodFilas = tCodData.filas || [];
        const tCodTotal = tCodData.total || {};

        const fecFmt = cumpData.fecproceso_formateada || this.fecProcesoFormateada;
        const placa = cumpData.placa || this.placaSeleccionada;

        document.getElementById('badge-cumplimiento-placa').textContent = `Placa: ${placa} | Fecha: ${fecFmt}`;

        // 1. Subtabla 1: Nivel Placa
        if (tPlaca.length === 0) {
            tbodyPlaca.innerHTML = `<tr><td colspan="9" class="py-4 text-center text-slate-400 italic">No hay datos de cumplimiento para esta placa.</td></tr>`;
        } else {
            let htmlP = '';
            tPlaca.forEach(p => {
                const isNegative = (p.dif < 0);
                const difColor = isNegative ? 'text-emerald-700 bg-emerald-50' : (p.dif > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-700');

                const tt = encodeURIComponent(JSON.stringify({
                    'Zona': p.zonaorigen,
                    'Cliente': p.cliente,
                    'Placa': p.placa,
                    'Objetivo': `${this.formatNum(p.objetivo, 2)}%`,
                    'Real': `${this.formatNum(p.real, 2)}%`,
                    'Diferencia': `${this.formatNum(p.dif, 2)}%`,
                    'Entrada': `${this.formatNum(p.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(p.mermatotal, 2)} Kg`
                }));

                htmlP += `
                    <tr class="hover:bg-slate-50 transition-colors cursor-default" data-tooltip-fields="${tt}">
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
            });
            tbodyPlaca.innerHTML = htmlP;
        }

        // 2. Subtabla 2: Desglose por Código
        if (tCodFilas.length === 0) {
            tbodyCod.innerHTML = `<tr><td colspan="10" class="py-4 text-center text-slate-400 italic">No hay desglose por código disponible.</td></tr>`;
            if (tfootCod) tfootCod.innerHTML = '';
        } else {
            let htmlC = '';
            tCodFilas.forEach(c => {
                const isNegative = (c.dif < 0);
                const difColor = isNegative ? 'text-emerald-700 bg-emerald-50' : (c.dif > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-700');

                const tt = encodeURIComponent(JSON.stringify({
                    'Zona': c.zonaorigen,
                    'Cliente': c.cliente,
                    'Placa': c.placa,
                    'Código': c.codigo,
                    'Objetivo': `${this.formatNum(c.objetivo, 2)}%`,
                    'Real': `${this.formatNum(c.real, 2)}%`,
                    'Diferencia': `${this.formatNum(c.dif, 2)}%`,
                    'Entrada': `${this.formatNum(c.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(c.mermatotal, 2)} Kg`
                }));

                htmlC += `
                    <tr class="hover:bg-slate-50 transition-colors cursor-default" data-tooltip-fields="${tt}">
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
            });
            tbodyCod.innerHTML = htmlC;

            // Fila Total de Subtabla 2
            if (tfootCod) {
                const isNegTot = (tCodTotal.dif < 0);
                const difColTot = isNegTot ? 'text-emerald-700' : (tCodTotal.dif > 0 ? 'text-rose-700' : 'text-slate-800');

                const ttTot = encodeURIComponent(JSON.stringify({
                    'Tipo': 'Total Cumplimiento',
                    'Objetivo': `${this.formatNum(tCodTotal.objetivo, 2)}%`,
                    'Real': `${this.formatNum(tCodTotal.real, 2)}%`,
                    'Diferencia': `${this.formatNum(tCodTotal.dif, 2)}%`,
                    'Entrada Total': `${this.formatNum(tCodTotal.entrada, 2)} Kg`,
                    'Merma Total': `${this.formatNum(tCodTotal.mermatotal, 2)} Kg`
                }));

                tfootCod.innerHTML = `
                    <tr class="bg-slate-100/95 font-bold text-slate-900 border-t border-slate-300">
                        <td colspan="5" class="px-2 py-1.5 text-left font-bold text-slate-700 border-r border-slate-300">Total</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${this.formatNum(tCodTotal.objetivo, 2)}%</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${this.formatNum(tCodTotal.real, 2)}%</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold ${difColTot} border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${this.formatNum(tCodTotal.dif, 2)}%</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200 cursor-default" data-tooltip-fields="${ttTot}">${this.formatNum(tCodTotal.entrada, 2)}</td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-800 cursor-default" data-tooltip-fields="${ttTot}">${this.formatNum(tCodTotal.mermatotal, 2)}</td>
                    </tr>
                `;
            }
        }
    },

    // -----------------------------------------------------------------
    // INTERACCIÓN MASTER-DETAIL: CLICK EN FILA DE PLACA
    // -----------------------------------------------------------------
    setupInteractiveSelection() {
        const table = document.getElementById('tabla-analisis-placas-liq');
        if (!table) return;

        table.addEventListener('click', async (e) => {
            const row = e.target.closest('tr[data-placa-row]');
            if (!row) return;

            const placa = row.getAttribute('data-placa-row');
            const fecproceso = row.getAttribute('data-fecproceso-row');

            if (!placa || placa === '0' || placa === this.placaSeleccionada) {
                // Si hace click en la misma placa o en placa vacía, no recargar
                return;
            }

            this.placaSeleccionada = placa;
            this.fecProcesoSeleccionada = fecproceso;
            this.fecProcesoFormateada = fecproceso ? fecproceso.replace(/-/g, '/') : '';

            // Actualizar estilo visual en la tabla maestra (re-render de tabla maestra para mantener rowspan limpio)
            this.renderTablaLiquidacion();

            // Poner placeholders de carga en las 4 tablas inferiores
            document.getElementById('tbody-placas-ventas').innerHTML = `<tr><td colspan="17" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando ventas para placa ${placa}...</td></tr>`;
            document.getElementById('tbody-placas-rutas').innerHTML = `<tr><td colspan="7" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando rutas para placa ${placa}...</td></tr>`;
            document.getElementById('tbody-placas-agcausal').innerHTML = `<tr><td colspan="9" class="py-8 text-center text-blue-600 font-medium animate-pulse">Cargando causas para placa ${placa}...</td></tr>`;
            document.getElementById('tbody-cumplimiento-placa').innerHTML = `<tr><td colspan="9" class="py-4 text-center text-blue-600 font-medium animate-pulse">Cargando cumplimiento...</td></tr>`;

            // Consultar datos de detalle para la nueva placa seleccionada
            await this.cargarDetallePlaca(placa, fecproceso);
        });
    },

    async cargarDetallePlaca(placa, fecproceso) {
        if (!this.controllerRef || !this.controllerRef.service) return;

        try {
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const response = await this.controllerRef.service.obtenerDashboard({
                tipo_grafico: 'DashAnalisisPlacas',
                fecha_inicio: rango.fechaInicio || '2026-03-30',
                fecha_fin: rango.fechaFin || '2026-05-01',
                placa_seleccionada: placa,
                fecproceso_seleccionada: fecproceso
            });

            if (response && response.status === 'success') {
                const payload = response.data || response.payload || response;
                this.datosBackend.seccion_ventas = payload.seccion_ventas || {};
                this.datosBackend.seccion_tiempos_ruta = payload.seccion_tiempos_ruta || {};
                this.datosBackend.seccion_agente_causal = payload.seccion_agente_causal || {};
                this.datosBackend.seccion_cumplimiento = payload.seccion_cumplimiento || {};

                // Re-renderizar las 4 secciones con los nuevos datos
                this.renderTablaVentas();
                this.renderTablaRutas();
                this.renderTablaAgcausal();
                this.renderTablaCumplimiento();

                // Re-adjuntar tooltips
                this.attachTableTooltips();
            }
        } catch (err) {
            console.error('Error al actualizar detalle de placa:', err);
        }
    },

    setupExportListeners() {
        document.getElementById('btn-export-placas-liq')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-analisis-placas-liq', 'Liquidacion_Placas', {
                    nombreHoja: 'Liquidacion Placas'
                });
            }
        });

        document.getElementById('btn-export-placas-ventas')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-analisis-placas-ventas', `Ventas_Placa_${this.placaSeleccionada}`, {
                    nombreHoja: 'Analisis Ventas'
                });
            }
        });

        document.getElementById('btn-export-placas-rutas')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-analisis-placas-rutas', `Rutas_Placa_${this.placaSeleccionada}`, {
                    nombreHoja: 'Tiempos Ruta'
                });
            }
        });

        document.getElementById('btn-export-placas-agcausal')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-analisis-placas-agcausal', `Agente_Causal_Placa_${this.placaSeleccionada}`, {
                    nombreHoja: 'Agente Causal'
                });
            }
        });

        document.getElementById('btn-export-placas-cumplimiento')?.addEventListener('click', () => {
            if (typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla('tabla-cumplimiento-codigo', `Cumplimiento_Placa_${this.placaSeleccionada}`, {
                    nombreHoja: 'Cumplimiento Objetivo'
                });
            }
        });
    },

    attachTableTooltips() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const tableCells = document.querySelectorAll('[data-tooltip-fields]');
        tableCells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                const rawData = cell.getAttribute('data-tooltip-fields');
                if (!rawData) return;

                try {
                    const dataObj = JSON.parse(decodeURIComponent(rawData));
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
                    tooltipEl.innerHTML = contentHtml;
                    tooltipEl.classList.remove('hidden');
                    tooltipEl.style.display = 'block';
                    this.positionTooltip(e, tooltipEl);
                } catch (err) {
                    console.error('Error parseando datos de tooltip:', err);
                }
            });

            cell.addEventListener('mousemove', (e) => {
                this.positionTooltip(e, tooltipEl);
            });

            cell.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    },

    positionTooltip(e, tooltipEl) {
        const offset = 12;
        let x = e.clientX + offset;
        let y = e.clientY + offset;

        const ttWidth = tooltipEl.offsetWidth || 220;
        const ttHeight = tooltipEl.offsetHeight || 100;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        if (x + ttWidth > winWidth - 10) {
            x = e.clientX - ttWidth - offset;
        }
        if (y + ttHeight > winHeight - 10) {
            y = e.clientY - ttHeight - offset;
        }

        tooltipEl.style.left = `${Math.max(10, x)}px`;
        tooltipEl.style.top = `${Math.max(10, y)}px`;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
            tooltipEl.style.display = 'none';
            tooltipEl.innerHTML = '';
        }
    },

    destroy() {
        this.hideTooltip();
    }
};

// Registrar en ChartRegistry
window.ChartRegistry['DashAnalisisPlacas'] = window.DashAnalisisPlacasChart;
