class VentasResumenController {
    constructor() {
        this.service = new VentasResumenService();

        // Instancias de Multiselect
        this.msNomDevolucion = null;

        // Estado y Filtros Activos
        this.currentPeriodo = { inicio: '', fin: '' };
        this.chartsMap = new Map();
        this.activeCharts = [];
        this.resizeObservers = [];
        this.cacheData = null;
        this.puntoSeleccionado = null;

        // Estado del Modal de Análisis Secundario (Mini Gráficos Tableau)
        this.analisisSecundarioState = {
            clientes: [],
            devoluciones: [],
            clienteSeleccionado: null,
            filtroTipo: 'TODO'
        };

        // Opciones por defecto para inicialización rápida
        this.opcionesFiltros = {
            lineasProceso: [],
            zonasFiscales: [],
            items: [],
            nomDevoluciones: []
        };

        // Estado de selección cruzada Plan vs Real
        this.planRealFiltroActivo = null; // { zona: 'AREQUIPA', fecha: '2026-08-31' }
        this.cachePlanRealData = { porZona: [], porItem: [] };

        this.init();
    }

    /**
     * Inicialización del controlador
     */
    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        // Fuerza alta resolución (super-sampling) en todos los canvas
        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        this.setupMultiSelects();
        this.setupPeriodo();
        this.setupEventListeners();
        this.setupModales();
        await this.cargarFiltrosServidor();
    }

    /**
     * Configura el componente de selección múltiple (CustomMultiSelect)
     */
    setupMultiSelects() {
        this.msNomDevolucion = new CustomMultiSelect({
            btnId: 'ms-nomdevolucion-btn',
            labelId: 'ms-nomdevolucion-label',
            dropdownId: 'ms-nomdevolucion-dropdown',
            searchId: 'ms-nomdevolucion-search',
            optionsContainerId: 'ms-nomdevolucion-options',
            title: 'NOMDEVOLUCION',
            options: []
        });
    }

    /**
     * Inicializa PeriodoHelper y los inputs dinámicos de período
     */
    setupPeriodo() {
        PeriodoHelper.renderizarInputs();
    }

    /**
     * Registra todos los event listeners de la interfaz
     */
    setupEventListeners() {
        // 1. Toggle Plegar / Desplegar Filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const panelFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');

        if (btnToggle && panelFiltros) {
            btnToggle.addEventListener('click', () => {
                const isHidden = panelFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = isHidden ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // 2. Selector de Período (renderiza inputs dinámicamente)
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            PeriodoHelper.renderizarInputs();
        });

        // 3.1 Selector de Línea de Proceso (Reactivo: actualiza Zonas e Items en cascada)
        document.getElementById('select-lineaproceso')?.addEventListener('change', async (e) => {
            await this.onLineaProcesoChange(e.target.value);
        });

        // 3.2 Selector de Disposición (Actualiza iconos)
        document.getElementById('select-disposicion-graficos')?.addEventListener('change', (e) => {
            const esHorizontal = e.target.value === 'horizontal';
            document.getElementById('icon-disp-vertical')?.classList.toggle('hidden', esHorizontal);
            document.getElementById('icon-disp-horizontal')?.classList.toggle('hidden', !esHorizontal);
            this.aplicarLayoutGrid();
        });

        // 4. Selector de Métrica (Unidades vs Pesos) - Redibujar reactivamente si hay datos en memoria
        document.getElementById('select-metrica-vista')?.addEventListener('change', () => {
            if (this.cacheData) {
                this.renderizarGraficoVentasSacCoor(this.cacheData);
            }
        });

        // 5. Selector de Tipo de Gráfico
        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => {
            console.log('', document.getElementById('select-tipo-grafico')?.value);
        });

        // 6. Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', () => {
            this.onCargarClick();
        });

        // 7. Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        // 8. Cerrar dropdowns de multiselect y menú flotante al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-multiselect-dropdown') && !e.target.closest('button[id$="-btn"]')) {
                document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => d.classList.add('hidden'));
            }

            const popup = document.getElementById('popup-menu-barra');
            if (popup && !popup.contains(e.target) && !e.target.closest('canvas')) {
                popup.classList.add('hidden');
            }
        });
    }

    /**
     * Configuración de eventos para los modales
     */
    setupModales() {
        // Modal "Ver Datos" Tableau
        const modalVerDatos = document.getElementById('modal-ver-datos');
        const btnCerrarModal = document.getElementById('btn-cerrar-modal');
        const tabBtnResumen = document.getElementById('tab-btn-resumen');
        const tabBtnCompletos = document.getElementById('tab-btn-completos');
        const vistaResumen = document.getElementById('vista-tab-resumen');
        const vistaCompletos = document.getElementById('vista-tab-completos');

        btnCerrarModal?.addEventListener('click', () => {
            modalVerDatos?.classList.add('hidden');
        });

        tabBtnResumen?.addEventListener('click', () => {
            this.cambiarTabModal('resumen', tabBtnResumen, tabBtnCompletos, vistaResumen, vistaCompletos);
        });

        tabBtnCompletos?.addEventListener('click', () => {
            this.cambiarTabModal('completos', tabBtnResumen, tabBtnCompletos, vistaResumen, vistaCompletos);
        });

        // Modal Secundario
        const modalSecundario = document.getElementById('modal-analisis-secundario');
        const btnCerrarSecundario = document.getElementById('btn-cerrar-modal-secundario');
        const btnAbrirSecundario = document.getElementById('btn-abrir-analisis-secundario');
        const selectFiltroTipo = document.getElementById('select-filtro-tipo-secundario');
        const btnDeseleccionar = document.getElementById('btn-deseleccionar-cliente');

        btnAbrirSecundario?.addEventListener('click', () => {
            document.getElementById('popup-menu-barra')?.classList.add('hidden');
            this.abrirModalAnalisisSecundario();
        });

        btnCerrarSecundario?.addEventListener('click', () => {
            modalSecundario?.classList.add('hidden');
        });

        selectFiltroTipo?.addEventListener('change', (e) => {
            this.analisisSecundarioState.filtroTipo = e.target.value;
            this.renderizarTablaClientes();
        });

        btnDeseleccionar?.addEventListener('click', () => {
            this.seleccionarClienteAnalisis(null);
        });

        // Cerrar modales con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modalVerDatos?.classList.add('hidden');
                modalSecundario?.classList.add('hidden');
                document.getElementById('popup-menu-barra')?.classList.add('hidden');
            }
        });

        // Modal Plan vs Real (06VentasSaca)
        const modalPlanReal = document.getElementById('modal-plan-vs-real');
        const btnCerrarPlanReal = document.getElementById('btn-cerrar-modal-plan-real');
        const btnAbrirPlanReal = document.getElementById('btn-abrir-plan-real');

        btnAbrirPlanReal?.addEventListener('click', () => {
            document.getElementById('popup-menu-barra')?.classList.add('hidden');
            this.abrirModalPlanVsReal();
        });

        btnCerrarPlanReal?.addEventListener('click', () => {
            modalPlanReal?.classList.add('hidden');
        });

        // En el listener de tecla ESC, añade el modal:
        modalPlanReal?.classList.add('hidden');
    }

    /**
     * Alterna pestañas dentro del modal Ver Datos
     */
    cambiarTabModal(tab, btnResumen, btnCompletos, vistaResumen, vistaCompletos) {
        if (tab === 'resumen') {
            btnResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            btnCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaResumen?.classList.remove('hidden');
            vistaCompletos?.classList.add('hidden');
        } else {
            btnCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            btnResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaCompletos?.classList.remove('hidden');
            vistaResumen?.classList.add('hidden');
        }
    }

    /**
     * Consulta y llena las opciones de los filtros desde el backend
     */
    async cargarFiltrosServidor() {
        try {
            const res = await this.service.obtenerFiltros();
            if (res && res.success) {
                this.opcionesFiltros = res;
                this.poblarFiltrosUI();
            } else {
                this.poblarFiltrosUIFallback();
            }
        } catch (error) {
            console.warn('Cargando opciones base para los filtros:', error);
            this.poblarFiltrosUIFallback();
        }
    }

    /**
     * Puebla los selects con los datos devueltos por el backend
     */
    poblarFiltrosUI() {
        // Linea de proceso (con opción '(Todo)')
        const selLinea = document.getElementById('select-lineaproceso');
        if (selLinea && this.opcionesFiltros.lineasProceso?.length > 0) {
            selLinea.innerHTML = `<option value="TODO" selected>(Todo)</option>` +
                this.opcionesFiltros.lineasProceso.map(lp =>
                    `<option value="${lp.id || lp}">${lp.label || lp}</option>`
                ).join('');
        }

        // Zona fiscal
        this.renderizarZonas(this.opcionesFiltros.zonasFiscales || []);

        // Item
        this.renderizarItems(this.opcionesFiltros.items || []);

        // NomDevolucion (MultiSelect)
        if (this.msNomDevolucion && this.opcionesFiltros.nomDevoluciones?.length > 0) {
            this.msNomDevolucion.setOptions(this.opcionesFiltros.nomDevoluciones);
        }
    }

    /**
     * Renderiza las opciones en el select de Zonas Fiscales
     */
    renderizarZonas(zonas) {
        const selZona = document.getElementById('select-zonafiscal');
        if (!selZona) return;

        const valorPrevio = selZona.value;
        selZona.innerHTML = `<option value="TODO" selected>(Todo)</option>` +
            zonas.map(z => `<option value="${z.id || z}">${z.label || z}</option>`).join('');

        // Mantener selección previa si aún existe entre las opciones válidas
        if (valorPrevio && Array.from(selZona.options).some(o => o.value === valorPrevio)) {
            selZona.value = valorPrevio;
        }
    }

    /**
     * Renderiza las opciones en el select de Items
     */
    renderizarItems(items) {
        const selItem = document.getElementById('select-item');
        if (!selItem) return;

        const valorPrevio = selItem.value;
        selItem.innerHTML = `<option value="TODO" selected>(Todo)</option>` +
            items.map(it => `<option value="${it.id || it}">${it.label || it}</option>`).join('');

        // Mantener selección previa si aún existe entre las opciones válidas
        if (valorPrevio && Array.from(selItem.options).some(o => o.value === valorPrevio)) {
            selItem.value = valorPrevio;
        }
    }

    /**
     * Evento al cambiar la Línea de Proceso: consulta y actualiza reactivamente Zonas e Items
     */
    async onLineaProcesoChange(lineaProceso) {
        const selZona = document.getElementById('select-zonafiscal');
        const selItem = document.getElementById('select-item');

        if (selZona) {
            selZona.innerHTML = `<option value="TODO">(Cargando zonas...)</option>`;
            selZona.disabled = true;
        }
        if (selItem) {
            selItem.innerHTML = `<option value="TODO">(Cargando items...)</option>`;
            selItem.disabled = true;
        }

        try {
            const opciones = await this.service.obtenerOpcionesPorLinea(lineaProceso);
            this.renderizarZonas(opciones.zonasFiscales || []);
            this.renderizarItems(opciones.items || []);
        } catch (error) {
            console.error('Error al actualizar opciones en cascada:', error);
            if (selZona) selZona.innerHTML = `<option value="TODO" selected>(Todo)</option>`;
            if (selItem) selItem.innerHTML = `<option value="TODO" selected>(Todo)</option>`;
        } finally {
            if (selZona) selZona.disabled = false;
            if (selItem) selItem.disabled = false;
        }
    }

    /**
     * Opciones de respaldo visual si aún no está listo el endpoint
     */
    poblarFiltrosUIFallback() {
        const selLinea = document.getElementById('select-lineaproceso');
        if (selLinea) {
            selLinea.innerHTML = `
                <option value="TODO" selected>(Todo)</option>
                <option value="1 P. Vivo">1 P. Vivo</option>
                <option value="2 P. Beneficiado">2 P. Beneficiado</option>
            `;
        }

        const selZona = document.getElementById('select-zonafiscal');
        if (selZona) {
            selZona.innerHTML = `
                <option value="TODO" selected>(Todo)</option>
                <option value="AREQUIPA">AREQUIPA</option>
                <option value="CAMANA">CAMANA</option>
                <option value="CUSCO">CUSCO</option>
                <option value="JULIACA">JULIACA</option>
                <option value="LIMA">LIMA</option>
                <option value="MOQUEGUA">MOQUEGUA</option>
                <option value="PUNO">PUNO</option>
                <option value="TACNA">TACNA</option>
            `;
        }

        const selItem = document.getElementById('select-item');
        if (selItem) {
            selItem.innerHTML = `
                <option value="TODO" selected>(Todo)</option>
            `;
        }
    }

    /**
     * Obtiene el payload consolidado de filtros listos para enviar a los endpoints
     */
    obtenerFiltrosActivos() {
        const rango = PeriodoHelper.obtenerRangoFechas ? PeriodoHelper.obtenerRangoFechas() : (PeriodoHelper.calcularRangoFechas ? PeriodoHelper.calcularRangoFechas() : {});
        const fechaInicio = rango.fechaInicio || rango.inicio || '';
        const fechaFin = rango.fechaFin || rango.fin || '';
        this.currentPeriodo = { inicio: fechaInicio, fin: fechaFin };

        return {
            tipo_grafico: document.getElementById('select-tipo-grafico')?.value || '07VentasSacCoor',
            metrica: document.getElementById('select-metrica-vista')?.value || 'unidades',
            lineaproceso: document.getElementById('select-lineaproceso')?.value || 'TODO',
            zonafiscal: document.getElementById('select-zonafiscal')?.value || 'TODO',
            item: document.getElementById('select-item')?.value || 'TODO',
            nomdevoluciones: this.msNomDevolucion ? this.msNomDevolucion.getSelectedValues() : [],
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        };
    }

    /**
     * Destruye instancias activas de Chart.js y desconecta ResizeObservers
     */
    destruirGraficos() {
        this.activeCharts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.activeCharts = [];

        this.resizeObservers.forEach(ro => {
            if (ro && typeof ro.disconnect === 'function') {
                ro.disconnect();
            }
        });
        this.resizeObservers = [];
        this.chartsMap.clear();
    }

    /**
     * Handler al pulsar el botón Cargar
     */
    async onCargarClick() {
        const filtros = this.obtenerFiltrosActivos();
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        // Mostrar estado de carga
        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center">
                <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <h3 class="text-base font-bold text-slate-800">Consultando datos de ventas y devoluciones...</h3>
                <p class="text-xs text-slate-500 mt-1">Procesando registros de ventas y devoluciones secuenciales</p>
            </div>
        `;

        try {
            const res = await this.service.consultarVentasSacCoor(filtros);
            if (res && res.success && res.payload && res.payload.fechas && res.payload.fechas.length > 0) {
                this.cacheData = res.payload;
                this.renderizarGraficoVentasSacCoor(this.cacheData);
            } else {
                this.cacheData = null;
                this.destruirGraficos();
                contenedor.innerHTML = `
                    <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center">
                        <div class="p-4 bg-slate-50 text-slate-400 rounded-full mb-3">
                            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                            </svg>
                        </div>
                        <h3 class="text-sm font-bold text-slate-700">No se encontraron registros</h3>
                        <p class="text-xs text-slate-500 mt-1">Intente cambiando el rango de fechas o los filtros seleccionados.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al cargar datos del gráfico:', error);
            this.destruirGraficos();
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-rose-200 p-8 flex flex-col items-center justify-center text-center text-rose-600">
                    <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <h3 class="text-sm font-bold">Error al procesar la solicitud</h3>
                    <p class="text-xs text-rose-500 mt-1">${error.message || 'Ocurrió un error inesperado al consultar el servidor.'}</p>
                </div>
            `;
        }
    }

    /**
     * Renderiza el gráfico interactivo 07VentasSacCoor con la misma arquitectura probada de saldos
     */
    renderizarGraficoVentasSacCoor(data) {
        this.destruirGraficos();

        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const metrica = document.getElementById('select-metrica-vista')?.value || 'unidades';
        const esUnidades = metrica === 'unidades';
        const unidadTexto = esUnidades ? 'Unidades' : 'Pesos (Kg)';

        const fechas = data.fechas || [];
        const labelsCortos = data.labels || [];
        const totalPuntos = fechas.length;
        const lineaActiva = document.getElementById('select-lineaproceso')?.options[document.getElementById('select-lineaproceso')?.selectedIndex]?.text || data.lineaproceso || '(Todo)';

        // Determinar series según métrica
        const seriesData = esUnidades ? data.unidades : data.pesos;
        const totalGenSerie = seriesData.total_general || [];
        const ventasSerie = seriesData.ventas || [];
        const devsSerie = seriesData.devoluciones || [];
        const ratioSerie = seriesData.ratio_dev || [];

        // Nombres de pistas
        const track1Title = esUnidades ? 'Total Cant General' : 'Total Peso General';
        const track2Title = esUnidades ? 'Cantidad Ventas / Devoluciones' : 'Peso Ventas / Devoluciones';
        const track3Title = '% Devolucion';

        // Ancho mínimo por punto (igual que en saldos)
        const pxMinimoPorPunto = (modoDisposicion === 'horizontal') ? 38 : 46;
        const anchoMinimoRequerido = totalPuntos * pxMinimoPorPunto;

        const cardId = 'card-ventas-sac-coor';
        const canvasTrack1Id = 'canvas-sac-track1';
        const canvasTrack2Id = 'canvas-sac-track2';
        const canvasTrack3Id = 'canvas-sac-track3';
        const canvasEjeXId = 'canvas-sac-ejex';

        const tarjeta = document.createElement('div');
        tarjeta.id = cardId;
        tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all';

        tarjeta.innerHTML = `
            <!-- CABECERA LIMPIA ESTILO SALDOS (SIN TOTALES INNECESARIOS) -->
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-100">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                        </svg>
                        07VentasSacCoor
                    </span>
                    <span class="text-xs font-semibold text-slate-700">${lineaActiva}</span>
                    <span class="text-xs text-slate-400 font-medium">(Análisis SACA Secuencial de Ventas y Devoluciones)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong></span>
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">${unidadTexto}</span>
                </div>
            </div>

            <!-- CONTENEDOR CON UN SOLO SCROLLBAR (ESTRUCTURA DE SALDOS) -->
            <div class="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                <div style="min-width: max(100%, ${anchoMinimoRequerido + 176}px);" class="w-full flex flex-col">
                    
                    <div class="flex flex-col pr-1">
                        <!-- PISTA 1: TOTAL GENERAL -->
                        <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                            <div class="w-36 sm:w-44 shrink-0 flex flex-col justify-center pr-3 border-r border-slate-100 bg-white z-10 sticky left-0">
                                <span class="text-[11px] font-bold text-slate-700 truncate">${track1Title}</span>
                                <span class="text-[10px] text-slate-400 mt-0.5 font-medium">${esUnidades ? 'Total Unidades' : 'Total Kg'}</span>
                            </div>
                            <div class="flex-1 relative min-w-0" style="height: 140px;">
                                <canvas id="${canvasTrack1Id}"></canvas>
                            </div>
                        </div>

                        <!-- PISTA 2: VENTAS VS DEVOLUCIONES -->
                        <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                            <div class="w-36 sm:w-44 shrink-0 flex flex-col justify-center pr-3 border-r border-slate-100 bg-white z-10 sticky left-0">
                                <span class="text-[11px] font-bold text-slate-700 truncate">${track2Title}</span>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="inline-flex items-center gap-1 text-[9.5px] text-blue-700 font-semibold"><span class="w-2 h-2 rounded-full bg-[#4E79A7]"></span>Venta</span>
                                    <span class="inline-flex items-center gap-1 text-[9.5px] text-rose-600 font-semibold"><span class="w-2 h-2 rounded-full bg-[#BA2525]"></span>Dev</span>
                                </div>
                            </div>
                            <div class="flex-1 relative min-w-0" style="height: 160px;">
                                <canvas id="${canvasTrack2Id}"></canvas>
                            </div>
                        </div>

                        <!-- PISTA 3: % DEVOLUCIÓN -->
                        <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                            <div class="w-36 sm:w-44 shrink-0 flex flex-col justify-center pr-3 border-r border-slate-100 bg-white z-10 sticky left-0">
                                <span class="text-[11px] font-bold text-slate-700 truncate">${track3Title}</span>
                                <span class="text-[10px] text-emerald-600 font-medium mt-0.5">% Devolución</span>
                            </div>
                            <div class="flex-1 relative min-w-0" style="height: 140px;">
                                <canvas id="${canvasTrack3Id}"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- EJE X FIJO INFERIOR -->
                    <div class="sticky bottom-0 z-20 bg-white border-t border-slate-200 flex items-stretch shadow-xs min-w-0">
                        <div class="w-36 sm:w-44 shrink-0 flex items-start justify-end pt-2 pr-3 border-r border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 z-30">
                            fechaProceso
                        </div>
                        <div class="flex-1 relative min-w-0" style="height: 135px;">
                            <canvas id="${canvasEjeXId}"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);

        // 1. Instanciar Pistas
        const chartTrack1 = this.crearChartTrack1(canvasTrack1Id, labelsCortos, totalGenSerie, data, esUnidades);
        const chartTrack2 = this.crearChartTrack2(canvasTrack2Id, labelsCortos, ventasSerie, devsSerie, data, esUnidades);
        const chartTrack3 = this.crearChartTrack3(canvasTrack3Id, labelsCortos, ratioSerie, data, esUnidades);

        const chartsArray = [chartTrack1, chartTrack2, chartTrack3];
        this.activeCharts.push(...chartsArray);

        // 2. Renderizado directo del Eje X estático inferior (patrón idéntico a saldos)
        const canvasEjeXEl = document.getElementById(canvasEjeXId);
        if (canvasEjeXEl) {
            const renderEjeX = () => {
                const primerChart = chartsArray[0];
                if (!primerChart || !primerChart.scales || !primerChart.scales.x) return;

                const parent = canvasEjeXEl.parentElement;
                const width = parent.clientWidth || canvasEjeXEl.clientWidth;
                const height = parent.clientHeight || 135;
                if (!width || !height) return;

                const dpr = Math.max(window.devicePixelRatio || 1, 2);
                canvasEjeXEl.width = width * dpr;
                canvasEjeXEl.height = height * dpr;
                canvasEjeXEl.style.width = width + 'px';
                canvasEjeXEl.style.height = height + 'px';

                const ctx = canvasEjeXEl.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, width, height);

                const chartArea = primerChart.chartArea;
                if (!chartArea) return;

                // Línea divisoria superior del eje
                ctx.beginPath();
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1;
                ctx.moveTo(chartArea.left, 0.5);
                ctx.lineTo(chartArea.right, 0.5);
                ctx.stroke();

                ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = '#475569';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                labelsCortos.forEach((label, i) => {
                    const x = primerChart.scales.x.getPixelForValue(i);
                    if (x === undefined || isNaN(x)) return;

                    // Tick mark vertical de 4px
                    ctx.beginPath();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, 4);
                    ctx.stroke();

                    // Fecha rotada -90°
                    ctx.save();
                    ctx.translate(x, 8);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                });
            };

            const resizeObserver = new ResizeObserver(() => {
                if (!document.body.contains(tarjeta)) {
                    resizeObserver.disconnect();
                    return;
                }
                chartsArray.forEach(chart => {
                    if (chart && typeof chart.resize === 'function' && chart.canvas && chart.canvas.isConnected) {
                        chart.resize();
                    }
                });
                renderEjeX();
            });

            resizeObserver.observe(tarjeta);
            this.resizeObservers.push(resizeObserver);

            setTimeout(() => {
                if (document.body.contains(tarjeta)) {
                    renderEjeX();
                }
            }, 60);
        }
    }

    /**
     * Crea el gráfico para la Pista 1: Total General (Escala Dinámica Tableau)
     */
    crearChartTrack1(canvasId, labels, dataSerie, fullData, esUnidades) {
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return null;
        const ctx = canvasEl.getContext('2d');
        const self = this;

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: esUnidades ? 'Total Cant General' : 'Total Peso General',
                    data: dataSerie,
                    borderColor: '#4E79A7',
                    backgroundColor: '#4E79A7',
                    borderWidth: 2.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#4E79A7',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.2,
                    tension: 0,
                    fill: false
                }]
            },
            options: {
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const fechaOriginal = fullData.fechas[index];
                        const fechaTexto = labels[index];
                        const monto = dataSerie[index];

                        self.puntoSeleccionado = {
                            tipoGrafico: document.getElementById('select-tipo-grafico')?.value || '07VentasSacCoor',
                            pista: 'track1',
                            fecha: fechaOriginal,
                            fechaFormateada: fechaTexto,
                            valor: monto
                        };

                        const popup = document.getElementById('popup-menu-barra');
                        const tipoActivo = document.getElementById('select-tipo-grafico')?.value;
                        const btnSecundario = document.getElementById('btn-abrir-analisis-secundario');
                        const btnPlanReal = document.getElementById('btn-abrir-plan-real');

                        if (btnSecundario) btnSecundario.classList.toggle('hidden', tipoActivo === '06VentasSaca');
                        if (btnPlanReal) btnPlanReal.classList.toggle('hidden', tipoActivo !== '06VentasSaca');

                        if (popup) {
                            popup.style.left = `${event.native.clientX + 10}px`;
                            popup.style.top = `${event.native.clientY + 10}px`;
                            popup.classList.remove('hidden');
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 36, bottom: 8, left: 10, right: 10 }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 6,
                        color: '#475569',
                        font: { size: 10, weight: '500' },
                        formatter: (val) => self.formatearNumeroTableau(val, false),
                        display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) !== 0
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 4,
                        usePointStyle: false,
                        displayColors: false,
                        titleFont: { size: 11, weight: 'normal' },
                        bodyFont: { size: 11, family: 'sans-serif' },
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const idx = context.dataIndex;
                                const fRaw = fullData.fechas[idx];
                                const fLarga = self.formatearFechaConDiaSemana(fRaw);
                                const totVal = self.formatearNumeroTableau(context.raw, false);
                                return [
                                    `fechaProceso: ${fLarga}`,
                                    `${esUnidades ? 'Total Cant General' : 'Total Peso General'}: ${totVal}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grace: '10%',
                        ticks: {
                            callback: (v) => self.formatearTickEjeY(v),
                            font: { size: 9.5 },
                            color: '#94a3b8',
                            maxTicksLimit: 3
                        },
                        grid: { color: '#f8fafc' }
                    },
                    x: {
                        ticks: { display: false },
                        grid: { color: '#f8fafc' }
                    }
                }
            }
        });
    }

    /**
     * Crea el gráfico para la Pista 2: Ventas y Devoluciones (Tableau Style)
     */
    crearChartTrack2(canvasId, labels, ventasSerie, devsSerie, fullData, esUnidades) {
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return null;
        const ctx = canvasEl.getContext('2d');
        const self = this;

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Ventas',
                        data: ventasSerie,
                        borderColor: '#4E79A7',
                        backgroundColor: '#4E79A7',
                        borderWidth: 2.5,
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#4E79A7',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.2,
                        tension: 0,
                        fill: false
                    },
                    {
                        label: 'Devoluciones',
                        data: devsSerie,
                        borderColor: '#BA2525',
                        backgroundColor: '#BA2525',
                        borderWidth: 2.5,
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#BA2525',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.2,
                        tension: 0,
                        fill: false
                    }
                ]
            },
            options: {
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const fechaOriginal = fullData.fechas[index];
                        const fechaTexto = labels[index];
                        const datasetIndex = elements[0].datasetIndex;
                        const monto = datasetIndex === 0 ? ventasSerie[index] : devsSerie[index];

                        self.puntoSeleccionado = {
                            tipoGrafico: document.getElementById('select-tipo-grafico')?.value || '07VentasSacCoor',
                            pista: 'track2',
                            tipoSerie: datasetIndex === 0 ? 'ventas' : 'devoluciones',
                            fecha: fechaOriginal,
                            fechaFormateada: fechaTexto,
                            valor: monto
                        };

                        const popup = document.getElementById('popup-menu-barra');
                        const tipoActivo = document.getElementById('select-tipo-grafico')?.value;
                        const btnSecundario = document.getElementById('btn-abrir-analisis-secundario');
                        const btnPlanReal = document.getElementById('btn-abrir-plan-real');

                        if (btnSecundario) btnSecundario.classList.toggle('hidden', tipoActivo === '06VentasSaca');
                        if (btnPlanReal) btnPlanReal.classList.toggle('hidden', tipoActivo !== '06VentasSaca');

                        if (popup) {
                            popup.style.left = `${event.native.clientX + 10}px`;
                            popup.style.top = `${event.native.clientY + 10}px`;
                            popup.classList.remove('hidden');
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 36, bottom: 8, left: 10, right: 10 }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 6,
                        color: (ctx) => (ctx.datasetIndex === 0 ? '#4E79A7' : '#BA2525'),
                        font: { size: 10, weight: '500' },
                        formatter: (val) => self.formatearNumeroTableau(val, false),
                        display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) !== 0
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 4,
                        usePointStyle: false,
                        displayColors: false,
                        titleFont: { size: 11, weight: 'normal' },
                        bodyFont: { size: 11, family: 'sans-serif' },
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const idx = context.dataIndex;
                                const fRaw = fullData.fechas[idx];
                                const fLarga = self.formatearFechaConDiaSemana(fRaw);
                                const vVal = self.formatearNumeroTableau(ventasSerie[idx], false);
                                const dVal = self.formatearNumeroTableau(devsSerie[idx], false);
                                return [
                                    `fechaProceso: ${fLarga}`,
                                    `Ventas: ${vVal}`,
                                    `Devoluciones: ${dVal}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        grace: '8%',
                        ticks: {
                            callback: (v) => self.formatearTickEjeY(v),
                            font: { size: 9.5 },
                            color: '#94a3b8',
                            maxTicksLimit: 4
                        },
                        grid: {
                            color: (context) => (context.tick.value === 0 ? '#cbd5e1' : '#f8fafc'),
                            lineWidth: (context) => (context.tick.value === 0 ? 1.5 : 1)
                        }
                    },
                    x: {
                        ticks: { display: false },
                        grid: { color: '#f8fafc' }
                    }
                }
            }
        });
    }

    /**
     * Crea el gráfico para la Pista 3: % Devolución (Escala Dinámica Tableau)
     */
    crearChartTrack3(canvasId, labels, ratioSerie, fullData, esUnidades) {
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) return null;
        const ctx = canvasEl.getContext('2d');
        const self = this;

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '% Devolucion',
                    data: ratioSerie,
                    borderColor: '#1E6B27',
                    backgroundColor: '#1E6B27',
                    borderWidth: 2.8,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#1E6B27',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.2,
                    tension: 0,
                    fill: false
                }]
            },
            options: {
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const fechaOriginal = fullData.fechas[index];
                        const fechaTexto = labels[index];
                        const monto = ratioSerie[index];

                        self.puntoSeleccionado = {
                            tipoGrafico: document.getElementById('select-tipo-grafico')?.value || '07VentasSacCoor',
                            pista: 'track3',
                            fecha: fechaOriginal,
                            fechaFormateada: fechaTexto,
                            valor: monto
                        };

                        const popup = document.getElementById('popup-menu-barra');
                        const tipoActivo = document.getElementById('select-tipo-grafico')?.value;
                        const btnSecundario = document.getElementById('btn-abrir-analisis-secundario');
                        const btnPlanReal = document.getElementById('btn-abrir-plan-real');

                        if (btnSecundario) btnSecundario.classList.toggle('hidden', tipoActivo === '06VentasSaca');
                        if (btnPlanReal) btnPlanReal.classList.toggle('hidden', tipoActivo !== '06VentasSaca');

                        if (popup) {
                            popup.style.left = `${event.native.clientX + 10}px`;
                            popup.style.top = `${event.native.clientY + 10}px`;
                            popup.classList.remove('hidden');
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 36, bottom: 8, left: 10, right: 10 }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: 6,
                        color: '#1E6B27',
                        font: { size: 10, weight: '500' },
                        formatter: (val) => self.formatearPorcentaje(val),
                        display: (ctx) => Number(ctx.dataset.data[ctx.dataIndex]) > 0
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 4,
                        usePointStyle: false,
                        displayColors: false,
                        titleFont: { size: 11, weight: 'normal' },
                        bodyFont: { size: 11, family: 'sans-serif' },
                        callbacks: {
                            title: () => '',
                            label: (context) => {
                                const idx = context.dataIndex;
                                const fRaw = fullData.fechas[idx];
                                const fLarga = self.formatearFechaConDiaSemana(fRaw);
                                const pctVal = self.formatearPorcentaje(context.raw);
                                return [
                                    `fechaProceso: ${fLarga}`,
                                    `% Devolucion: ${pctVal}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grace: '10%',
                        ticks: {
                            callback: (v) => `${Number(v).toFixed(2).replace('.', ',')}%`,
                            font: { size: 9.5 },
                            color: '#94a3b8',
                            maxTicksLimit: 3
                        },
                        grid: { color: '#f8fafc' }
                    },
                    x: {
                        ticks: { display: false },
                        grid: { color: '#f8fafc' }
                    }
                }
            }
        });
    }

    /**
     * Abre y consulta los datos para el modal de Análisis Secundario (Mini Gráficos por Cliente)
     */
    async abrirModalAnalisisSecundario() {
        const modal = document.getElementById('modal-analisis-secundario');
        if (!modal) return;

        const loader = document.getElementById('loader-modal-secundario');
        const contenido = document.getElementById('contenido-modal-secundario');
        const subtitulo = document.getElementById('modal-secundario-subtitulo');

        const filtros = this.obtenerFiltrosActivos();
        let fechaConsulta = '';

        if (this.puntoSeleccionado && this.puntoSeleccionado.fecha) {
            fechaConsulta = this.puntoSeleccionado.fecha;
            if (subtitulo) {
                subtitulo.textContent = `Fecha seleccionada: ${this.formatearFechaConDiaSemana(fechaConsulta)}`;
            }
        } else {
            fechaConsulta = filtros.fecha_fin || filtros.fecha_inicio;
            if (subtitulo) {
                subtitulo.textContent = `Período: ${filtros.fecha_inicio} al ${filtros.fecha_fin}`;
            }
        }

        modal.classList.remove('hidden');
        loader?.classList.remove('hidden');
        contenido?.classList.add('hidden');

        try {
            const payload = {
                fecha: fechaConsulta,
                fecha_inicio: filtros.fecha_inicio,
                fecha_fin: filtros.fecha_fin,
                lineaproceso: filtros.lineaproceso,
                zonafiscal: filtros.zonafiscal,
                item: filtros.item,
                nomdevoluciones: filtros.nomdevoluciones
            };

            const res = await this.service.consultarAnalisisSecundario(payload);

            loader?.classList.add('hidden');

            if (res && res.success && res.payload) {
                this.analisisSecundarioState.clientes = res.payload.clientes || [];
                this.analisisSecundarioState.devoluciones = res.payload.devoluciones || [];
                this.analisisSecundarioState.clienteSeleccionado = null;
                this.analisisSecundarioState.filtroTipo = document.getElementById('select-filtro-tipo-secundario')?.value || 'TODO';

                this.renderizarTablaClientes();
                this.renderizarTablaDevoluciones();

                contenido?.classList.remove('hidden');
            } else {
                alert('No se pudieron obtener los datos de análisis por cliente.');
                modal.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error al abrir modal análisis secundario:', error);
            loader?.classList.add('hidden');
            alert('Ocurrió un error al consultar el servidor.');
            modal.classList.add('hidden');
        }
    }

    /**
     * Renderiza la columna izquierda: Lista de Clientes con Mini-Barras estilo Tableau
     */
    renderizarTablaClientes() {
        const contenedor = document.getElementById('lista-analisis-ventas');
        if (!contenedor) return;

        const { clientes, clienteSeleccionado, filtroTipo } = this.analisisSecundarioState;

        if (!clientes || clientes.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No se encontraron clientes para esta fecha.</div>`;
            return;
        }

        // Calcular los máximos absolutos según el filtro activo para la escala de las mini-barras
        let maxCant = 1;
        let maxPeso = 1;
        let maxSubtotal = 1;

        clientes.forEach(c => {
            let cant = 0, peso = 0, subtotal = 0;
            if (filtroTipo === 'VENTAS') {
                cant = Number(c.cant_ventas || 0);
                peso = Number(c.peso_ventas || 0);
                subtotal = Number(c.subtotal_ventas || 0);
            } else if (filtroTipo === 'DEVOLUCIONES') {
                cant = Math.abs(Number(c.cant_dev || 0));
                peso = Math.abs(Number(c.peso_dev || 0));
                subtotal = Math.abs(Number(c.subtotal_dev || 0));
            } else {
                // (Todo): En Tableau el orden y las barras de la vista principal son las Ventas
                cant = Math.max(Number(c.cant_ventas || 0), Number(c.cant_total || 0));
                peso = Math.max(Number(c.peso_ventas || 0), Number(c.peso_total || 0));
                subtotal = Math.max(Number(c.subtotal_ventas || 0), Number(c.subtotal_total || 0));
            }
            if (cant > maxCant) maxCant = cant;
            if (peso > maxPeso) maxPeso = peso;
            if (subtotal > maxSubtotal) maxSubtotal = subtotal;
        });

        contenedor.innerHTML = clientes.map(c => {
            const nom = c.corporativo || c.nomcliente || 'SIN NOMBRE';
            const esActivo = (clienteSeleccionado === nom);
            const fondoNom = esActivo ? 'bg-sky-200 text-slate-900 font-bold' : 'text-slate-700 hover:bg-slate-50';

            // Determinar valores a mostrar según filtroTipo
            let cantVal = 0, pesoVal = 0, subtotalVal = 0;
            let esDev = false;

            if (filtroTipo === 'VENTAS') {
                cantVal = Number(c.cant_ventas || 0);
                pesoVal = Number(c.peso_ventas || 0);
                subtotalVal = Number(c.subtotal_ventas || 0);
            } else if (filtroTipo === 'DEVOLUCIONES') {
                cantVal = Number(c.cant_dev || 0);
                pesoVal = Number(c.peso_dev || 0);
                subtotalVal = Number(c.subtotal_dev || 0);
                esDev = true;
            } else {
                // En la vista (Todo) de Tableau, las columnas muestran las Ventas netas/brutas del cliente
                cantVal = Number(c.cant_ventas || 0);
                pesoVal = Number(c.peso_ventas || 0);
                subtotalVal = Number(c.subtotal_ventas || 0);
            }

            const pctCant = Math.min(Math.max((Math.abs(cantVal) / maxCant) * 100, 0), 100);
            const pctPeso = Math.min(Math.max((Math.abs(pesoVal) / maxPeso) * 100, 0), 100);
            const pctSub = Math.min(Math.max((Math.abs(subtotalVal) / maxSubtotal) * 100, 0), 100);

            const colorBarra = esDev ? '#BA2525' : '#4E79A7';

            // Formatos de texto estilo Tableau
            const txtCant = this.formatearNumeroTableau(cantVal, false);
            const txtPeso = this.formatearNumeroTableau(pesoVal, true);
            const txtSub = (subtotalVal < 0 ? '-S/ ' : 'S/ ') + this.formatearNumeroTableau(Math.abs(subtotalVal), true);

            return `
                <div class="cliente-item grid grid-cols-12 items-center px-3 py-1.5 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                     data-cliente="${encodeURIComponent(nom)}">
                    <!-- 1. Nombre Cliente / Corporativo -->
                    <div class="col-span-4 pr-2">
                        <div class="text-[11px] truncate px-1.5 py-0.5 rounded-xs ${fondoNom}" title="${nom}">
                            ${nom}
                        </div>
                    </div>

                    <!-- 2. Mini Barras Horizontales con Valor a la Derecha (Tableau Style) -->
                    <div class="col-span-8 grid grid-cols-3 gap-2 h-4 items-center">
                        <!-- Cantidad -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            <div class="h-full rounded-none transition-all" style="background-color: ${colorBarra}; width: ${pctCant}%;"></div>
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-slate-700 whitespace-nowrap">
                                ${txtCant}
                            </span>
                        </div>

                        <!-- Peso -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            <div class="h-full rounded-none transition-all" style="background-color: ${colorBarra}; width: ${pctPeso}%;"></div>
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-slate-700 whitespace-nowrap">
                                ${txtPeso}
                            </span>
                        </div>

                        <!-- Subtotal -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            <div class="h-full rounded-none transition-all" style="background-color: ${colorBarra}; width: ${pctSub}%;"></div>
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-slate-700 whitespace-nowrap">
                                ${txtSub}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Event listener de selección de fila
        contenedor.querySelectorAll('.cliente-item').forEach(el => {
            el.addEventListener('click', () => {
                const nom = decodeURIComponent(el.getAttribute('data-cliente'));
                this.seleccionarClienteAnalisis(nom);
            });
        });
    }

    /**
     * Renderiza la columna derecha: Motivos de Devolución por Cliente con Mini-Barras Rojas
     */
    renderizarTablaDevoluciones() {
        const contenedor = document.getElementById('lista-analisis-devoluciones');
        const badgeContador = document.getElementById('badge-contador-devoluciones');
        const footerTotales = document.getElementById('footer-totales-devoluciones');
        if (!contenedor) return;

        const { devoluciones, clienteSeleccionado } = this.analisisSecundarioState;

        // Filtrar por cliente si hay uno seleccionado
        const devsFiltradas = clienteSeleccionado
            ? devoluciones.filter(d => (d.corporativo || d.nomcliente) === clienteSeleccionado)
            : devoluciones;

        if (badgeContador) {
            badgeContador.textContent = `${devsFiltradas.length} devoluciones`;
        }

        if (devsFiltradas.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No se encontraron devoluciones para este cliente.</div>`;
            if (footerTotales) footerTotales.innerHTML = '';
            return;
        }

        // Calcular los máximos de devoluciones para la escala de las barras rojas
        let maxDevCant = 1;
        let maxDevPeso = 1;
        let maxDevSubtotal = 1;

        devsFiltradas.forEach(d => {
            const c = Math.abs(Number(d.cantidad || 0));
            const p = Math.abs(Number(d.peso || 0));
            const s = Math.abs(Number(d.subtotal || 0));
            if (c > maxDevCant) maxDevCant = c;
            if (p > maxDevPeso) maxDevPeso = p;
            if (s > maxDevSubtotal) maxDevSubtotal = s;
        });

        // Calcular totales acumulados para el pie
        let totalCant = 0;
        let totalPeso = 0;
        let totalSubtotal = 0;

        contenedor.innerHTML = devsFiltradas.map(d => {
            const cant = Number(d.cantidad || 0);
            const peso = Number(d.peso || 0);
            const subtotal = Number(d.subtotal || 0);

            totalCant += cant;
            totalPeso += peso;
            totalSubtotal += subtotal;

            const pctCant = Math.min(Math.max((Math.abs(cant) / maxDevCant) * 100, 0), 100);
            const pctPeso = Math.min(Math.max((Math.abs(peso) / maxDevPeso) * 100, 0), 100);
            const pctSub = Math.min(Math.max((Math.abs(subtotal) / maxDevSubtotal) * 100, 0), 100);

            const txtCant = this.formatearNumeroTableau(cant, false);
            const txtPeso = this.formatearNumeroTableau(peso, true) + ' Kg';
            const txtSub = (subtotal < 0 ? '-S/ ' : 'S/ ') + this.formatearNumeroTableau(Math.abs(subtotal), true);

            return `
                <div class="grid grid-cols-12 items-center px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                    <!-- 1. Motivo de Devolución -->
                    <div class="col-span-2 font-semibold text-rose-700 truncate pr-1" title="${d.nomdevolucion}">
                        ${d.nomdevolucion}
                    </div>
                    <!-- 2. Nombre del Cliente / Corporativo -->
                    <div class="col-span-3 text-slate-600 truncate pr-1" title="${d.nomcliente || d.corporativo}">
                        ${d.nomcliente || d.corporativo}
                    </div>

                    <!-- 3. Mini Barras Rojas Horizontales con Valores (Tableau Style) -->
                    <div class="col-span-7 grid grid-cols-3 gap-2 h-4 items-center">
                        <!-- Cantidad -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            ${pctCant > 0 ? `<div class="h-full rounded-none transition-all bg-[#BA2525]" style="width: ${pctCant}%;"></div>` : ''}
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-rose-700 whitespace-nowrap">
                                ${txtCant}
                            </span>
                        </div>

                        <!-- Peso -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            ${pctPeso > 0 ? `<div class="h-full rounded-none transition-all bg-[#BA2525]" style="width: ${pctPeso}%;"></div>` : ''}
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-rose-700 whitespace-nowrap">
                                ${txtPeso}
                            </span>
                        </div>

                        <!-- Subtotal -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            ${pctSub > 0 ? `<div class="h-full rounded-none transition-all bg-[#BA2525]" style="width: ${pctSub}%;"></div>` : ''}
                            <span class="ml-1 text-[9.5px] font-mono font-medium text-rose-700 whitespace-nowrap">
                                ${txtSub}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Renderizar Footer Total General
        if (footerTotales) {
            const txtTotCant = this.formatearNumeroTableau(totalCant, false);
            const txtTotPeso = this.formatearNumeroTableau(totalPeso, true) + ' Kg';
            const txtTotSub = (totalSubtotal < 0 ? '-S/ ' : 'S/ ') + this.formatearNumeroTableau(Math.abs(totalSubtotal), true);

            footerTotales.innerHTML = `
                <div class="col-span-5 font-bold uppercase tracking-wider text-slate-800">
                    Total general
                </div>
                <div class="col-span-7 grid grid-cols-3 gap-2">
                    <div class="text-left font-mono font-bold text-rose-700 pl-1">${txtTotCant}</div>
                    <div class="text-left font-mono font-bold text-rose-700 pl-1">${txtTotPeso}</div>
                    <div class="text-left font-mono font-bold text-rose-700 pl-1">${txtTotSub}</div>
                </div>
            `;
        }
    }

    /**
     * Selecciona o deselecciona un cliente/corporativo reactivamente en el modal
     */
    seleccionarClienteAnalisis(nomCliente) {
        if (this.analisisSecundarioState.clienteSeleccionado === nomCliente) {
            this.analisisSecundarioState.clienteSeleccionado = null;
        } else {
            this.analisisSecundarioState.clienteSeleccionado = nomCliente;
        }

        const btnDeseleccionar = document.getElementById('btn-deseleccionar-cliente');
        const labelActivo = document.getElementById('label-filtro-cliente-activo');

        if (this.analisisSecundarioState.clienteSeleccionado) {
            btnDeseleccionar?.classList.remove('hidden');
            if (labelActivo) labelActivo.textContent = `Filtrado por: ${this.analisisSecundarioState.clienteSeleccionado}`;
        } else {
            btnDeseleccionar?.classList.add('hidden');
            if (labelActivo) labelActivo.textContent = 'Todos los clientes';
        }

        this.renderizarTablaClientes();
        this.renderizarTablaDevoluciones();
    }

    /**
     * Formateador de números estilo Tableau con separador de miles '.' y decimales ','
     */
    formatearNumeroTableau(numero, incluirDecimales = true) {
        if (numero === null || numero === undefined) return incluirDecimales ? '0,00' : '0';
        const num = Number(numero);
        if (isNaN(num)) return '0,00';

        if (!incluirDecimales) {
            const signo = num < 0 ? '-' : '';
            const absRedondeado = Math.abs(Math.round(num)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            return `${signo}${absRedondeado}`;
        }

        const partes = num.toFixed(2).split('.');
        partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return partes.join(',');
    }

    /**
     * Formatea porcentajes estilo Tableau ej: '0,21%'
     */
    formatearPorcentaje(pct) {
        if (pct === null || pct === undefined || isNaN(pct)) return '0,00%';
        return Number(pct).toFixed(2).replace('.', ',') + '%';
    }

    /**
     * Formatea ticks numéricos de los ejes Y ej: 10000 -> 10K
     */
    formatearTickEjeY(val) {
        if (val === 0) return '0';
        const absVal = Math.abs(val);
        const signo = val < 0 ? '-' : '';
        if (absVal >= 1000) {
            return `${signo}${(absVal / 1000).toFixed(0)}K`;
        }
        return `${val}`;
    }

    /**
     * Formatea fecha completa con día de la semana para tooltips
     */
    formatearFechaConDiaSemana(fechaStr) {
        if (!fechaStr) return '';
        const [year, month, day] = fechaStr.split('-').map(Number);
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const d = new Date(year, month - 1, day);
        const nombreDia = diasSemana[d.getDay()];
        return `${nombreDia}, ${day} de ${meses[month - 1]} de ${year}`;
    }

    /**
     * Limpia y resetea los filtros a sus valores predeterminados
     */
    limpiarFiltros() {
        document.getElementById('select-tipo-periodo').value = 'entre_fechas';
        PeriodoHelper.renderizarInputs();

        document.getElementById('select-tipo-grafico').value = '07VentasSacCoor';
        document.getElementById('select-metrica-vista').value = 'unidades';

        const selLinea = document.getElementById('select-lineaproceso');
        if (selLinea) selLinea.value = 'TODO';

        const selZona = document.getElementById('select-zonafiscal');
        if (selZona) selZona.value = 'TODO';

        const selItem = document.getElementById('select-item');
        if (selItem) selItem.value = 'TODO';

        if (this.msNomDevolucion) {
            this.msNomDevolucion.selectAll();
        }

        this.destruirGraficos();
        this.cacheData = null;
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) contenedor.innerHTML = '';
        console.log('Filtros reseteados');
    }

    /**
     * Aplica la clase de grilla CSS según la disposición (Vertical / Horizontal)
     */
    aplicarLayoutGrid() {
        const modo = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        if (modo === 'horizontal') {
            contenedor.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pb-10';
        } else {
            contenedor.className = 'flex flex-col gap-6 mt-6 pb-10';
        }
    }

    /**
     * Consulta y abre el modal de Cumplimiento Plan vs Real para la fecha o período seleccionado
     */
    async abrirModalPlanVsReal() {
        const modal = document.getElementById('modal-plan-vs-real');
        if (!modal) return;

        const loader = document.getElementById('loader-modal-plan-real');
        const contenido = document.getElementById('contenido-modal-plan-real');
        const subtitulo = document.getElementById('modal-plan-real-subtitulo');

        const filtros = this.obtenerFiltrosActivos();
        const fechaSeleccionada = (this.puntoSeleccionado && this.puntoSeleccionado.fecha) ? this.puntoSeleccionado.fecha : '';

        if (subtitulo) {
            subtitulo.textContent = fechaSeleccionada
                ? `Fecha evaluada: ${this.formatearFechaConDiaSemana(fechaSeleccionada)} (Rango: ${filtros.fecha_inicio} al ${filtros.fecha_fin})`
                : `Período completo: ${filtros.fecha_inicio} al ${filtros.fecha_fin}`;
        }

        modal.classList.remove('hidden');
        loader?.classList.remove('hidden');
        contenido?.classList.add('hidden');

        try {
            // Se envía el período completo para que los acumulados se calculen correctamente
            const payload = {
                fecha_inicio: filtros.fecha_inicio,
                fecha_fin: filtros.fecha_fin,
                lineaproceso: filtros.lineaproceso,
                zonafiscal: filtros.zonafiscal,
                item: filtros.item
            };

            const res = await this.service.consultarCumplimientoPlanReal(payload);
            loader?.classList.add('hidden');

            if (res && res.success && res.payload && res.payload.data) {
                this.cachePlanRealData = res.payload.data;
                this.planRealFiltroActivo = null; // Reiniciar selección

                this.renderizarMatrizPlanRealZonas(this.cachePlanRealData.porZona || []);
                this.renderizarMatrizPlanRealItems(this.cachePlanRealData.porItem || []);
                contenido?.classList.remove('hidden');
            } else {
                alert('No se encontraron registros de cumplimiento para el período seleccionado.');
                modal.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error al consultar Plan vs Real:', error);
            loader?.classList.add('hidden');
            alert('Ocurrió un error al obtener la información.');
            modal.classList.add('hidden');
        }
    }

    /**
     * Helper para pintar celdas con barras horizontales y etiquetas
     */
    generarCeldaBarra(valor, maxValor, colorHex) {
        const pct = maxValor > 0 ? Math.min(Math.max((valor / maxValor) * 100, 0), 100) : 0;
        const valorFmt = this.formatearNumeroTableau(valor, false);

        return `
            <div class="flex items-center gap-2 w-full justify-start">
                <div class="flex-1 h-3.5 bg-slate-100 rounded-none overflow-hidden relative max-w-[100px]">
                    <div class="h-full rounded-none" style="width: ${pct}%; background-color: ${colorHex};"></div>
                </div>
                <span class="text-[10px] font-mono font-medium text-slate-700 whitespace-nowrap min-w-[40px] text-right">
                    ${valorFmt}
                </span>
            </div>
        `;
    }

    /**
     * Helper para pintar el semáforo circular con el porcentaje
     */
    generarCeldaIndicador(ratio, esTotal = false) {
        const val = Number(ratio) || 0;
        const absVal = Math.abs(val);

        // 1. Paleta divergente por desviación absoluta (ABS) estilo Tableau
        let colorPunto = '#2e7d32'; // Verde base
        if (esTotal) {
            colorPunto = '#8c8c8c'; // Gris para fila Total
        } else if (absVal <= 5) {
            colorPunto = '#2e7d32'; // Verde oscuro
        } else if (absVal <= 10) {
            colorPunto = '#59a14f'; // Verde claro
        } else if (absVal <= 20) {
            colorPunto = '#f28e8c'; // Salmón / alerta moderada
        } else {
            colorPunto = '#a50026'; // Rojo intenso / Borgoña
        }

        // 2. Rango visible del eje (-50% a +50% Tableau)
        // Se limita el desplazamiento del centro para dejar 8px de margen en los bordes
        const maxEscala = 50;
        const desplazamientoMaximo = 34; // porcentaje máximo hacia izq o der desde el centro
        const offsetPct = Math.min(Math.max((val / maxEscala) * desplazamientoMaximo, -desplazamientoMaximo), desplazamientoMaximo);
        const posLeft = 50 + offsetPct; // 50% es la línea central

        const signo = (val > 0 ? '+' : '');
        const textoPct = `${signo}${val.toFixed(2).replace('.', ',')}%`;
        const esNegativo = val < 0;

        // Si el valor positivo es muy alto (> 25%), colocamos el texto a la izquierda del punto
        // para garantizar que nunca toque ni desborde el margen derecho de la celda
        const textoALaIzquierda = esNegativo || val > 25;

        return `
            <div class="relative w-full h-7 flex items-center justify-center min-w-[130px] px-2 select-none overflow-hidden">
                <!-- Línea guía vertical central (0,00%) -->
                <div class="absolute top-1 bottom-1 left-1/2 w-px bg-slate-300 pointer-events-none"></div>

                <!-- Contenedor del punto posicionado -->
                <div class="absolute flex items-center gap-1 transition-all"
                     style="left: ${posLeft}%; transform: translateX(${textoALaIzquierda ? '-100%' : '0%'});">
                    
                    ${textoALaIzquierda ? `<span class="text-[9.5px] font-mono font-bold text-slate-700 whitespace-nowrap">${textoPct}</span>` : ''}
                    
                    <span class="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white"
                          style="background-color: ${colorPunto};"
                          title="${textoPct}"></span>

                    ${!textoALaIzquierda ? `<span class="text-[9.5px] font-mono font-bold text-slate-700 whitespace-nowrap">${textoPct}</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Renderiza la tabla superior con acción de selección cruzada estilo Tableau
     */
    renderizarMatrizPlanRealZonas(filas) {
        const tbody = document.getElementById('tbody-plan-real-zonas');
        if (!tbody) return;

        if (!filas || filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-xs text-slate-400">Sin registros por zona.</td></tr>`;
            return;
        }

        // Limpiar espacios en blanco de las zonas
        filas.forEach(f => {
            f.zona = (f.zona || '').trim();
        });

        const maxPlan = Math.max(...filas.map(f => f.plan_diario || 0), 1);
        const maxReal = Math.max(...filas.map(f => f.real_diario || 0), 1);
        const maxPlanAcum = Math.max(...filas.map(f => f.plan_acum || 0), 1);
        const maxRealAcum = Math.max(...filas.map(f => f.real_acum || 0), 1);

        const conteoPorZona = {};
        filas.forEach(f => {
            conteoPorZona[f.zona] = (conteoPorZona[f.zona] || 0) + 1;
        });

        const zonasRenderizadas = new Set();
        const seleccion = this.planRealFiltroActivo;

        tbody.innerHTML = filas.map(r => {
            const esPrimeraFilaZona = !zonasRenderizadas.has(r.zona);
            let celdaZona = '';

            if (esPrimeraFilaZona) {
                zonasRenderizadas.add(r.zona);
                const totalFilasZona = conteoPorZona[r.zona];
                celdaZona = `
                    <td rowspan="${totalFilasZona}" class="px-3 py-2 font-bold text-slate-800 bg-slate-50 border-r border-slate-200 align-middle text-center uppercase tracking-wider text-[11px]">
                        ${r.zona}
                    </td>
                `;
            }

            const estaSeleccionada = seleccion && seleccion.zona === r.zona && seleccion.fecha === r.fecha;
            const haySeleccion = seleccion !== null;

            // Opacidad tenue de Tableau para filas no seleccionadas
            const opacidadClase = (haySeleccion && !estaSeleccionada) ? 'opacity-30 transition-opacity' : 'opacity-100 transition-opacity';
            const filaBorde = estaSeleccionada
                ? 'bg-amber-50/70 ring-2 ring-blue-500 ring-inset z-10'
                : 'hover:bg-slate-50/80';
            const fechaBg = estaSeleccionada ? 'bg-amber-200 text-amber-950 font-bold' : 'text-slate-600 font-medium';

            return `
                <tr class="fila-zona-click cursor-pointer select-none text-[11px] border-b border-slate-100 last:border-b-2 last:border-slate-300 ${filaBorde} ${opacidadClase}"
                    data-zona="${r.zona}" 
                    data-fecha="${r.fecha}">
                    ${celdaZona}
                    <td class="px-3 py-1.5 whitespace-nowrap text-center border-r border-slate-100 ${fechaBg}">
                        ${this.formatearFechaCortaTableau(r.fecha)}
                    </td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(r.plan_diario, maxPlan, '#59a14f')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(r.real_diario, maxReal, '#4e79a7')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaIndicador(r.ind_diario, false)}</td>
                    <td class="px-3 py-1.5 border-l border-slate-200">${this.generarCeldaBarra(r.plan_acum, maxPlanAcum, '#59a14f')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(r.real_acum, maxRealAcum, '#4e79a7')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaIndicador(r.ind_acum, false)}</td>
                </tr>
            `;
        }).join('');

        // Eventos de selección cruzada
        tbody.querySelectorAll('.fila-zona-click').forEach(fila => {
            fila.addEventListener('click', () => {
                const z = fila.getAttribute('data-zona');
                const f = fila.getAttribute('data-fecha');

                if (this.planRealFiltroActivo && this.planRealFiltroActivo.zona === z && this.planRealFiltroActivo.fecha === f) {
                    this.planRealFiltroActivo = null;
                } else {
                    this.planRealFiltroActivo = { zona: z, fecha: f };
                }

                this.renderizarMatrizPlanRealZonas(this.cachePlanRealData.porZona || []);
                this.renderizarMatrizPlanRealItems(this.cachePlanRealData.porItem || []);
            });
        });
    }

    /**
     * Renderiza la tabla inferior por Item con totales reactivos idénticos a Tableau
     */
    renderizarMatrizPlanRealItems(filas) {
        const tbody = document.getElementById('tbody-plan-real-items');
        if (!tbody) return;

        if (!filas || filas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-xs text-slate-400">Sin registros por item.</td></tr>`;
            return;
        }

        // Zona activa (por clic en la tabla superior o AREQUIPA por defecto)
        let zonaActiva = (this.planRealFiltroActivo?.zona || document.getElementById('select-zonafiscal')?.value || 'AREQUIPA').trim();
        if (!zonaActiva || zonaActiva === 'TODO') {
            zonaActiva = 'AREQUIPA';
        }

        const fechaActiva = this.planRealFiltroActivo?.fecha || null;

        // 1. Filtrar registros base reales (excluyendo filas 'Total' precocinadas)
        let baseItems = filas.filter(f => (f.zona || '').trim() === zonaActiva && !f.es_total);

        if (fechaActiva) {
            baseItems = baseItems.filter(f => f.fecha === fechaActiva);
        }

        if (baseItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-xs text-slate-400">Sin registros de items para la selección.</td></tr>`;
            return;
        }

        // Agrupar por producto y calcular sus filas diarias + fila Total reactiva
        const itemsMap = new Map();
        baseItems.forEach(r => {
            if (!itemsMap.has(r.coditem)) {
                itemsMap.set(r.coditem, {
                    coditem: r.coditem,
                    item: r.item,
                    zona: r.zona,
                    dias: []
                });
            }
            itemsMap.get(r.coditem).dias.push(r);
        });

        // Construir lista con subtotales calculados dinámicamente según lo visible
        let filasFinales = [];
        let totalGeneralPlan = 0;
        let totalGeneralReal = 0;

        // Ordenar productos
        const itemsOrdenados = Array.from(itemsMap.values()).sort((a, b) =>
            a.coditem.localeCompare(b.coditem, undefined, { numeric: true })
        );

        itemsOrdenados.forEach(prod => {
            prod.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));

            let subPlan = 0;
            let subReal = 0;

            prod.dias.forEach(d => {
                subPlan += Number(d.plan_diario || 0);
                subReal += Number(d.real_diario || 0);
                filasFinales.push({
                    ...d,
                    es_total: false
                });
            });

            totalGeneralPlan += subPlan;
            totalGeneralReal += subReal;

            const subInd = (subPlan > 0) ? ((subReal - subPlan) / subPlan) * 100 : 0;

            // Fila de Total por ítem
            filasFinales.push({
                zona: prod.zona,
                coditem: prod.coditem,
                item: prod.item,
                fecha: 'Total',
                plan_diario: subPlan,
                real_diario: subReal,
                ind_diario: subInd,
                es_total: true
            });
        });

        const maxPlan = Math.max(...filasFinales.map(f => f.plan_diario || 0), totalGeneralPlan, 1);
        const maxReal = Math.max(...filasFinales.map(f => f.real_diario || 0), totalGeneralReal, 1);

        // Conteo de filas para los rowspan
        const conteoPorItem = {};
        filasFinales.forEach(f => {
            conteoPorItem[f.coditem] = (conteoPorItem[f.coditem] || 0) + 1;
        });

        const totalFilasZona = filasFinales.length + (fechaActiva ? 1 : 0);
        const itemsRenderizados = new Set();
        let zonaYaRenderizada = false;

        let html = filasFinales.map(r => {
            const esTotal = r.es_total;

            let celdaZona = '';
            if (!zonaYaRenderizada) {
                zonaYaRenderizada = true;
                celdaZona = `
                    <td rowspan="${totalFilasZona}" class="px-3 py-2 font-bold text-slate-800 bg-slate-50 border-r border-slate-200 align-middle text-center uppercase tracking-wider text-[11px]">
                        ${r.zona}
                    </td>
                `;
            }

            let celdaItem = '';
            if (!itemsRenderizados.has(r.coditem)) {
                itemsRenderizados.add(r.coditem);
                const spanItem = conteoPorItem[r.coditem];
                celdaItem = `
                    <td rowspan="${spanItem}" class="px-3 py-2 font-semibold text-slate-800 bg-white border-r border-b-2 border-slate-200 align-middle text-left text-[11px]">
                        ${r.item}
                    </td>
                `;
            }

            const fechaTxt = esTotal ? 'Total' : this.formatearFechaCortaTableau(r.fecha);
            const filaEstilo = esTotal
                ? 'bg-slate-50/80 font-bold border-b-2 border-slate-200 text-slate-800'
                : 'hover:bg-slate-50/60 border-b border-slate-100 text-slate-700';

            return `
                <tr class="${filaEstilo} text-[11px] transition-colors">
                    ${celdaZona}
                    ${celdaItem}
                    <td class="px-3 py-1.5 whitespace-nowrap text-center font-medium border-r border-slate-100 ${esTotal ? 'font-bold text-slate-900' : 'text-slate-600'}">
                        ${fechaTxt}
                    </td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(r.plan_diario, maxPlan, '#59a14f')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(r.real_diario, maxReal, '#4e79a7')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaIndicador(r.ind_diario, esTotal)}</td>
                </tr>
            `;
        }).join('');

        // Fila Total General perfectamente alineada (colspan="2" abarcando Item + Día)
        if (fechaActiva) {
            const indGlobal = (totalGeneralPlan > 0) ? ((totalGeneralReal - totalGeneralPlan) / totalGeneralPlan) * 100 : 0;
            html += `
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-[11px]">
                    <td colspan="2" class="px-3 py-2 text-left uppercase tracking-wider font-bold border-r border-slate-200">
                        Total
                    </td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(totalGeneralPlan, maxPlan, '#59a14f')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaBarra(totalGeneralReal, maxReal, '#4e79a7')}</td>
                    <td class="px-3 py-1.5">${this.generarCeldaIndicador(indGlobal, true)}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }

    formatearFechaCortaTableau(fechaStr) {
        if (!fechaStr) return '';
        const [year, month, day] = fechaStr.split('-').map(Number);
        return `${day}/${month}/${year}`;
    }

}

// Instanciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ventasResumenController = new VentasResumenController();
});

