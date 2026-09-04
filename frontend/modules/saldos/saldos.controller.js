class SaldosController {
    constructor() {
        this.service = new saldosService();
        this.chartsMap = new Map();
        this.cacheData = {};
        this.currentPeriodo = { inicio: '', fin: '' };
        this.puntoSeleccionado = null;

        this.msTipoGrafico = null;
        this.msCuentaVenta = null;
        this.msNomCliente = null;

        this.msVencimiento = null;
        this.msDecision = null;
        this.msObservacion = null;

        this.paletaColores = [
            { bar: '#4e79a7', hover: '#3b5f88', bgBadge: 'bg-blue-50', textBadge: 'text-blue-600', borderBadge: 'border-blue-100' },
            { bar: '#f28e2b', hover: '#c96f1b', bgBadge: 'bg-amber-50', textBadge: 'text-amber-600', borderBadge: 'border-amber-100' },
            { bar: '#e15759', hover: '#b83b3d', bgBadge: 'bg-rose-50', textBadge: 'text-rose-600', borderBadge: 'border-rose-100' },
            { bar: '#76b7b2', hover: '#55928d', bgBadge: 'bg-teal-50', textBadge: 'text-teal-600', borderBadge: 'border-teal-100' },
            { bar: '#59a14f', hover: '#407a38', bgBadge: 'bg-emerald-50', textBadge: 'text-emerald-600', borderBadge: 'border-emerald-100' },
            { bar: '#edc948', hover: '#c29f27', bgBadge: 'bg-yellow-50', textBadge: 'text-yellow-700', borderBadge: 'border-yellow-100' },
            { bar: '#b07aa1', hover: '#8c597e', bgBadge: 'bg-purple-50', textBadge: 'text-purple-600', borderBadge: 'border-purple-100' },
            { bar: '#ff9da7', hover: '#d4727d', bgBadge: 'bg-pink-50', textBadge: 'text-pink-600', borderBadge: 'border-pink-100' },
            { bar: '#9c755f', hover: '#75523f', bgBadge: 'bg-stone-100', textBadge: 'text-stone-700', borderBadge: 'border-stone-200' },
            { bar: '#6366f1', hover: '#4f46e5', bgBadge: 'bg-indigo-50', textBadge: 'text-indigo-600', borderBadge: 'border-indigo-100' },
            { bar: '#06b6d4', hover: '#0891b2', bgBadge: 'bg-cyan-50', textBadge: 'text-cyan-600', borderBadge: 'border-cyan-100' }
        ];

        // Estado del Modal de Análisis de Deudores (20Dash)
        this.deudoresModalState = {
            corporativos: [],
            docs: [],
            corpSeleccionado: null
        };

        // Estado de la Matriz Corporativos por Zona (18CorporativosZonaDeudores)
        this.matrizZonaDeudoresState = {
            dataOriginal: null,
            zonasSeleccionadas: [] // vacío significa "todas las zonas visibles"
        };
    }

    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        // FUERZA ALTA RESOLUCIÓN (SUPER-SAMPLING) EN TODOS LOS CANVAS
        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        this.inicializarComponentesFiltros();
        this.setupEventListeners();
        this.setupModalEventListeners();

        PeriodoHelper.renderizarInputs();
        await this.cargarFiltrosIniciales();

        // Primera carga inicial al abrir la vista
        await this.cargarDatosDesdeServidor();
    }

    inicializarComponentesFiltros() {

        // 2. Cuenta Venta
        this.msCuentaVenta = new CustomMultiSelect({
            btnId: 'ms-cuentaventa-btn',
            labelId: 'ms-cuentaventa-label',
            dropdownId: 'ms-cuentaventa-dropdown',
            searchId: 'ms-cuentaventa-search',
            optionsContainerId: 'ms-cuentaventa-options',
            selectAllId: 'ms-cuentaventa-select-all',
            clearId: 'ms-cuentaventa-clear',
            placeholder: 'Todas las cuentas',
            options: [],
            onChange: () => this.sincronizarVisibilidadEnCaliente()
        });

        // 3. Nombre Cliente (Barras)
        this.msNomCliente = new CustomMultiSelect({
            btnId: 'ms-nomcliente-btn',
            labelId: 'ms-nomcliente-label',
            dropdownId: 'ms-nomcliente-dropdown',
            searchId: 'ms-nomcliente-search',
            optionsContainerId: 'ms-nomcliente-options',
            selectAllId: 'ms-nomcliente-select-all',
            clearId: 'ms-nomcliente-clear',
            placeholder: 'Todos los clientes',
            options: []
        });

        // 4. Vencimiento (Líneas por Zona)
        this.msVencimiento = new CustomMultiSelect({
            btnId: 'ms-vencimiento-btn',
            labelId: 'ms-vencimiento-label',
            dropdownId: 'ms-vencimiento-dropdown',
            searchId: 'ms-vencimiento-search',
            optionsContainerId: 'ms-vencimiento-options',
            selectAllId: 'ms-vencimiento-select-all',
            clearId: 'ms-vencimiento-clear',
            placeholder: 'Todos los vencimientos',
            options: []
        });

        // 5. Decisión (Líneas por Zona)
        this.msDecision = new CustomMultiSelect({
            btnId: 'ms-decision-btn',
            labelId: 'ms-decision-label',
            dropdownId: 'ms-decision-dropdown',
            searchId: 'ms-decision-search',
            optionsContainerId: 'ms-decision-options',
            selectAllId: 'ms-decision-select-all',
            clearId: 'ms-decision-clear',
            placeholder: 'Todas las decisiones',
            options: []
        });

        // 6. Observación (Líneas por Zona)
        this.msObservacion = new CustomMultiSelect({
            btnId: 'ms-observacion-btn',
            labelId: 'ms-observacion-label',
            dropdownId: 'ms-observacion-dropdown',
            searchId: 'ms-observacion-search',
            optionsContainerId: 'ms-observacion-options',
            selectAllId: 'ms-observacion-select-all',
            clearId: 'ms-observacion-clear',
            placeholder: 'Todas las observaciones',
            options: []
        });
    }

    setupEventListeners() {
        // Toggle Colapsar Filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const panelFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');
        const btnExportarExcel = document.getElementById('btn-exportar-excel-modal');

        if (btnToggle && panelFiltros) {
            btnToggle.addEventListener('click', () => {
                const isHidden = panelFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = isHidden ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // Selector de Período
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            PeriodoHelper.renderizarInputs();
        });

        // Selector de Disposición (Actualiza el Grid CSS en caliente sin destruir canvas)
        document.getElementById('select-disposicion-graficos')?.addEventListener('change', (e) => {
            const esHorizontal = e.target.value === 'horizontal';
            document.getElementById('icon-disp-vertical')?.classList.toggle('hidden', esHorizontal);
            document.getElementById('icon-disp-horizontal')?.classList.toggle('hidden', !esHorizontal);
            this.aplicarLayoutGrid();
        });

        // Botón Cargar: Limpia caché forzando nueva consulta con los filtros seleccionados
        document.getElementById('btn-cargar')?.addEventListener('click', () => {
            this.limpiarGraficos();
            this.cargarDatosDesdeServidor();
        });

        // Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.msCuentaVenta?.clearSelection();
            this.msNomCliente?.selectAll();
            this.msDecision?.selectAll();
            this.msObservacion?.selectAll();
            this.limpiarGraficos();
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#popup-menu-barra')) {
                document.getElementById('popup-menu-barra')?.classList.add('hidden');
            }
        });

        // Selector de Tipo de Gráfico (Cambio único)
        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => {
            this.alternarVisibilidadFiltrosSegunTipo();
        });


        btnExportarExcel?.addEventListener('click', () => {
            this.exportarExcelDesdeModal();
        });

    }

    sincronizarVisibilidadEnCaliente() {
        const selectedCuentas = this.msCuentaVenta ? this.msCuentaVenta.getSelectedValues() : [];
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        // Recalcular columnas del Grid si está en modo horizontal
        this.aplicarLayoutGrid();

        // Ocultar o mostrar tarjetas existentes
        const tarjetas = contenedor.querySelectorAll('[data-cuenta-id]');
        tarjetas.forEach(card => {
            const cuentaId = card.getAttribute('data-cuenta-id');
            if (selectedCuentas.includes(cuentaId)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    setupModalEventListeners() {
        const btnVerDatos = document.getElementById('btn-abrir-ver-datos');
        const btnCerrarModal = document.getElementById('btn-cerrar-modal');
        const modal = document.getElementById('modal-ver-datos');
        const tabResumen = document.getElementById('tab-btn-resumen');
        const tabCompletos = document.getElementById('tab-btn-completos');

        btnVerDatos?.addEventListener('click', () => {
            document.getElementById('popup-menu-barra')?.classList.add('hidden');
            if (this.puntoSeleccionado) {
                this.abrirModalVerDatos();
            }
        });

        btnCerrarModal?.addEventListener('click', () => {
            modal?.classList.add('hidden');
        });

        // Cambio de Tabs en el Modal
        tabResumen?.addEventListener('click', () => this.cambiarTabModal('resumen'));
        tabCompletos?.addEventListener('click', () => this.cambiarTabModal('completos'));

        // Listeners para Modal Análisis de Deudores (20Dash)
        const btnAbrirDeudores = document.getElementById('btn-abrir-analisis-corporativos');
        const btnCerrarDeudores = document.getElementById('btn-cerrar-modal-deudores');
        const btnDeseleccionarCorp = document.getElementById('btn-deseleccionar-corp');

        btnAbrirDeudores?.addEventListener('click', () => {
            document.getElementById('popup-menu-barra')?.classList.add('hidden');
            if (this.puntoSeleccionado) {
                this.abrirModalAnalisisDeudores();
            }
        });

        btnCerrarDeudores?.addEventListener('click', () => {
            document.getElementById('modal-analisis-deudores')?.classList.add('hidden');
        });

        btnDeseleccionarCorp?.addEventListener('click', () => {
            this.seleccionarCorporativoDeudor(null);
        });
    }

    obtenerTemaCuenta(cuenta) {
        // Asigna un color fijo según el índice de la opción en el multiselect
        const index = this.msCuentaVenta?.options.findIndex(o => o.id === cuenta) ?? -1;
        const colorIndex = (index >= 0 ? index : Math.abs(parseInt(cuenta, 10) || 0)) % this.paletaColores.length;
        return this.paletaColores[colorIndex];
    }

    async abrirModalVerDatos() {
        const modal = document.getElementById('modal-ver-datos');
        if (!modal || !this.puntoSeleccionado) return;

        const { tipoGrafico, metrica, cuenta, nomcuentaventa, zona, fechaFormateada, saldofinal, saldoinicial, resta_saldo, ratioCobranza } = this.puntoSeleccionado;
        const tipoActivo = tipoGrafico || (this.msTipoGrafico ? this.msTipoGrafico.getSelectedValues()[0] : 'saltosXcobrarXbarra');
        const schema = ModalSchemas.getSchema(tipoActivo, metrica);

        const helpers = {
            formatearNumero: (n, d) => this.formatearNumeroTableau(n, d),
            formatearFechaCorta: (f) => this.formatearFechaCortaTableau(f),
            formatearFecha: (f) => this.formatearFechaTableau(f)
        };

        const subTitulo = nomcuentaventa ? ` - ${nomcuentaventa}` : '';
        document.getElementById('modal-titulo-vista').textContent = `Ver datos: Cuenta ${cuenta}${subTitulo}`;
        document.getElementById('modal-subtitulo-filas').textContent = `Día de fechacarga: ${fechaFormateada}${zona ? ` - Zona: ${zona}` : ''}`;

        // 1. Renderizar pestaña Resumen dinámicamente
        const theadResumen = document.getElementById('thead-modal-resumen');
        const tbodyResumen = document.getElementById('tbody-modal-resumen');

        ModalSchemas.renderThead(theadResumen, schema.resumen, false);

        const dataResumen = {
            cuentaventa: cuenta,
            nomcuentaventa: nomcuentaventa || '',
            zonafiscal: zona || '',
            dia_fechacarga: fechaFormateada,
            saldofinal: saldofinal,
            saldoinicial: saldoinicial || 0,
            resta_saldo: resta_saldo || 0,
            ratio_cobranza: ratioCobranza || 0
        };

        ModalSchemas.renderResumenTbody(tbodyResumen, schema.resumen, dataResumen, helpers);

        this.cambiarTabModal('resumen');
        modal.classList.remove('hidden');

        // 2. Cargar datos completos en background
        await this.cargarDatosCompletosModal();
    }

    cambiarTabModal(tab) {
        const tabResumen = document.getElementById('tab-btn-resumen');
        const tabCompletos = document.getElementById('tab-btn-completos');
        const vistaResumen = document.getElementById('vista-tab-resumen');
        const vistaCompletos = document.getElementById('vista-tab-completos');

        if (tab === 'resumen') {
            tabResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            tabCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaResumen.classList.remove('hidden');
            vistaCompletos.classList.add('hidden');
        } else {
            tabCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            tabResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaCompletos.classList.remove('hidden');
            vistaResumen.classList.add('hidden');
        }
    }

    async cargarDatosCompletosModal() {
        const loader = document.getElementById('loader-modal-detalle');
        const tabla = document.getElementById('tabla-modal-completos');
        const thead = document.getElementById('thead-modal-completos');
        const tbody = document.getElementById('tbody-modal-completos');
        const tfoot = document.getElementById('tfoot-modal-completos');

        loader?.classList.remove('hidden');
        tabla?.classList.add('hidden');
        if (tbody) tbody.innerHTML = '';

        const tipoGrafico = this.puntoSeleccionado.tipoGrafico || (this.msTipoGrafico ? this.msTipoGrafico.getSelectedValues()[0] : 'saltosXcobrarXbarra');
        const metrica = this.puntoSeleccionado.metrica || '';
        const schema = ModalSchemas.getSchema(tipoGrafico, metrica);

        const helpers = {
            formatearNumero: (n, d) => this.formatearNumeroTableau(n, d),
            formatearFechaCorta: (f) => this.formatearFechaCortaTableau(f),
            formatearFecha: (f) => this.formatearFechaTableau(f)
        };

        // Renderizar cabecera de datos completos dinámicamente con ModalSchemas
        ModalSchemas.renderThead(thead, schema.detalle, true);

        try {
            let payloadDetalle = {
                tipo_grafico: tipoGrafico,
                cuentaventa: this.puntoSeleccionado.cuenta,
                fechacarga: this.puntoSeleccionado.fecha
            };

            if (tipoGrafico === '02SalxCobrarxZona') {
                // FILTROS ESPECÍFICOS DE LÍNEAS POR ZONA
                payloadDetalle.zonafiscal = this.puntoSeleccionado.zona;
                payloadDetalle.vencimientos = this.msVencimiento ? this.msVencimiento.getSelectedValues() : [];
                payloadDetalle.decisiones = this.msDecision ? this.msDecision.getSelectedValues() : [];
                payloadDetalle.observaciones = this.msObservacion ? this.msObservacion.getSelectedValues() : [];
            } else if (tipoGrafico === '08IndAnticipos') {
                // Anticipos no requiere filtros por clientes ni por zona
            } else if (tipoGrafico === '20DashAnalisisCtasMaxDeudoresDocs') {
                payloadDetalle.vencimientos = this.msVencimiento ? this.msVencimiento.getSelectedValues() : [];
                payloadDetalle.decisiones = this.msDecision ? this.msDecision.getSelectedValues() : [];
                payloadDetalle.observaciones = this.msObservacion ? this.msObservacion.getSelectedValues() : [];
            } else {
                // FILTROS ESPECÍFICOS DE BARRAS
                const totalClientesOpciones = this.msNomCliente ? this.msNomCliente.options.length : 0;
                const selectedClientes = this.msNomCliente ? this.msNomCliente.getSelectedValues() : [];
                payloadDetalle.clientes = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;
            }

            const res = await this.service.obtenerDetalle(payloadDetalle);

            loader?.classList.add('hidden');

            if (res.success && res.payload && res.payload.datos_completos) {
                const filas = res.payload.datos_completos;
                const subtituloZona = this.puntoSeleccionado.zona ? ` - Zona: ${this.puntoSeleccionado.zona}` : '';
                document.getElementById('modal-subtitulo-filas').textContent = `${filas.length} filas encontradas (${this.puntoSeleccionado.fechaFormateada}${subtituloZona})`;

                // Asignar día formateado a cada fila para la columna 'Día de fechacarga'
                filas.forEach(f => {
                    f.dia_fechacarga = this.puntoSeleccionado.fechaFormateada;
                });

                // Si es Anticipos y viene el resumen con valores exactos, actualizar la pestaña Resumen
                if (tipoGrafico === '08IndAnticipos' && res.payload.resumen) {
                    const r = res.payload.resumen;
                    const dataResumenActualizado = {
                        cuentaventa: r.cuentaventa || this.puntoSeleccionado.cuenta,
                        nomcuentaventa: r.nomcuentaventa || this.puntoSeleccionado.nomcuentaventa,
                        dia_fechacarga: this.puntoSeleccionado.fechaFormateada,
                        ratio_cobranza: r.ratio_cobranza,
                        resta_saldo: r.resta_saldo,
                        saldofinal: r.saldofinal,
                        saldoinicial: r.saldoinicial
                    };
                    const tbodyResumen = document.getElementById('tbody-modal-resumen');
                    ModalSchemas.renderResumenTbody(tbodyResumen, schema.resumen, dataResumenActualizado, helpers);
                }

                const totalGeneral = filas.reduce((acc, curr) => acc + Number(curr.saldofinal || 0), 0);

                // Renderizar tbody y tfoot dinámicamente con ModalSchemas
                ModalSchemas.renderDetalleTbody(tbody, schema.detalle, filas, helpers);
                ModalSchemas.renderTfoot(tfoot, schema.detalle, totalGeneral, helpers);

                tabla?.classList.remove('hidden');
            } else {
                tbody.innerHTML = `<tr><td colspan="${schema.detalle.length}" class="px-4 py-6 text-center text-slate-400">No se encontraron datos para este registro.</td></tr>`;
                ModalSchemas.renderTfoot(tfoot, schema.detalle, 0, helpers);
                tabla?.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error al cargar datos completos en el modal:', error);
            loader?.classList.add('hidden');
            tbody.innerHTML = `<tr><td colspan="${schema.detalle.length}" class="px-4 py-6 text-center text-rose-500">Error al cargar datos desde el servidor.</td></tr>`;
            ModalSchemas.renderTfoot(tfoot, schema.detalle, 0, helpers);
            tabla?.classList.remove('hidden');
        }
    }

    /**
     * Abre y consulta los datos para el modal de Análisis de Deudores (20Dash)
     */
    async abrirModalAnalisisDeudores() {
        const modal = document.getElementById('modal-analisis-deudores');
        if (!modal || !this.puntoSeleccionado) return;

        const { cuenta, nomcuentaventa, fecha, fechaFormateada } = this.puntoSeleccionado;

        document.getElementById('modal-deudores-titulo').textContent = `Análisis de Deudores: Cuenta ${cuenta}${nomcuentaventa ? ` - ${nomcuentaventa}` : ''}`;
        document.getElementById('modal-deudores-subtitulo').textContent = `Día de fechacarga: ${fechaFormateada}`;

        const loader = document.getElementById('loader-modal-deudores');
        const contenido = document.getElementById('contenido-modal-deudores');

        loader?.classList.remove('hidden');
        contenido?.classList.add('hidden');
        modal.classList.remove('hidden');

        try {
            const payload = {
                cuentaventa: cuenta,
                fechacarga: fecha,
                vencimientos: this.msVencimiento ? this.msVencimiento.getSelectedValues() : [],
                decisiones: this.msDecision ? this.msDecision.getSelectedValues() : [],
                observaciones: this.msObservacion ? this.msObservacion.getSelectedValues() : []
            };

            const res = await this.service.obtenerAnalisisCorporativos(payload);

            loader?.classList.add('hidden');

            if (res.success && res.payload) {
                this.deudoresModalState.corporativos = res.payload.corporativos || [];
                this.deudoresModalState.docs = res.payload.docs || [];
                this.deudoresModalState.corpSeleccionado = null;

                this.renderizarListaCorporativos();
                this.renderizarListadoDocs();

                contenido?.classList.remove('hidden');
            } else {
                alert('No se pudieron obtener los datos de deudores.');
                modal.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error al abrir modal análisis deudores:', error);
            loader?.classList.add('hidden');
            alert('Ocurrió un error al consultar los datos del servidor.');
            modal.classList.add('hidden');
        }
    }

    /**
     * Renderiza la columna izquierda: CORPORATIVOS MAS DEUDORES (Visión Corporativa)
     */
    renderizarListaCorporativos() {
        const contenedor = document.getElementById('lista-corporativos-deudores');
        if (!contenedor) return;

        const { corporativos, corpSeleccionado } = this.deudoresModalState;

        if (corporativos.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">No se encontraron corporativos deudores.</div>`;
            return;
        }

        // Calcular el monto máximo para la escala de las barras
        const maxSaldo = Math.max(...corporativos.map(c => c.total_saldofinal), 1);

        contenedor.innerHTML = corporativos.map(c => {
            const esActivo = (corpSeleccionado === c.nomcorporativo);
            const tieneSeleccion = Boolean(corpSeleccionado);

            // Tableau: Si está seleccionado, azul claro en el texto/celda. Si hay selección y no es este, atenúa las barras en gris claro (#cbd5e1)
            const fondoNom = esActivo ? 'bg-sky-200 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50';
            const colorBarraTotal = esActivo ? '#4e79a7' : (tieneSeleccion ? '#e2e8f0' : '#4e79a7');
            const colorBarraSegmentada = esActivo ? '#4e79a7' : (tieneSeleccion ? '#cbd5e1' : '#4e79a7');

            const pctAncho = Math.min(Math.max((c.total_saldofinal / maxSaldo) * 100, 1), 100);

            // En Tableau los segmentos individuales respetan el orden exacto ordenado por horacreacion DESC
            const montosDocs = (c.montos_docs && c.montos_docs.length > 0) ? c.montos_docs : [{ monto: c.total_saldofinal }];

            const segmentosHtml = montosDocs.map(docItem => {
                const m = (typeof docItem === 'object' && docItem !== null) ? Number(docItem.monto || 0) : Number(docItem || 0);
                const subPct = (m / (c.total_saldofinal || 1)) * 100;
                return `<div style="width: ${subPct}%;" class="h-full border-r border-white/60 flex items-center justify-center text-[9px] font-mono text-white px-0.5 overflow-hidden" title="Doc: S/ ${this.formatearNumeroTableau(m, false)}">
                    ${subPct > 15 ? this.formatearNumeroTableau(m, false) : ''}
                </div>`;
            }).join('');

            return `
                <div class="corporativo-item grid grid-cols-12 items-center px-3 py-1 cursor-pointer transition-colors"
                     data-corp="${encodeURIComponent(c.nomcorporativo)}">
                    
                    <!-- 1. Nombre del Corporativo (Estilo celda Tableau) -->
                    <div class="col-span-5 pr-2">
                        <div class="text-[11px] truncate px-1.5 py-0.5 rounded-xs ${fondoNom}" title="${c.nomcorporativo}">
                            ${c.nomcorporativo}
                        </div>
                    </div>

                    <!-- 2. Gráficos de barras (Docs vs Total) -->
                    <div class="col-span-7 grid grid-cols-2 gap-2 h-4 items-center">
                        <!-- Panel Izquierdo: Segmentos Docs (de menor a mayor) -->
                        <div class="w-full h-full flex justify-end">
                            <div class="h-full flex overflow-hidden rounded-none" style="background-color: ${colorBarraSegmentada}; width: ${pctAncho}%;">
                                ${segmentosHtml}
                            </div>
                        </div>

                        <!-- Panel Derecho: Total con etiqueta externa/interna -->
                        <div class="w-full h-full flex items-center justify-start relative">
                            <div class="h-full rounded-none transition-all" style="background-color: ${colorBarraTotal}; width: ${pctAncho}%;"></div>
                            <span class="ml-1 text-[10px] font-mono font-normal text-slate-700">
                                ${this.formatearNumeroTableau(c.total_saldofinal, false)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Listeners en cada fila de corporativo
        contenedor.querySelectorAll('.corporativo-item').forEach(el => {
            el.addEventListener('click', () => {
                const corp = decodeURIComponent(el.getAttribute('data-corp'));
                this.seleccionarCorporativoDeudor(corp);
            });
        });
    }

    /**
     * Selecciona o deselecciona un corporativo para filtrar ListadoDoc
     */
    seleccionarCorporativoDeudor(corp) {
        // Toggle: si ya estaba seleccionado, lo deselecciona
        if (this.deudoresModalState.corpSeleccionado === corp) {
            this.deudoresModalState.corpSeleccionado = null;
        } else {
            this.deudoresModalState.corpSeleccionado = corp;
        }

        const btnDeseleccionar = document.getElementById('btn-deseleccionar-corp');
        const labelActivo = document.getElementById('label-filtro-corp-activo');

        if (this.deudoresModalState.corpSeleccionado) {
            btnDeseleccionar?.classList.remove('hidden');
            if (labelActivo) labelActivo.textContent = `Filtrado por: ${this.deudoresModalState.corpSeleccionado}`;
        } else {
            btnDeseleccionar?.classList.add('hidden');
            if (labelActivo) labelActivo.textContent = 'Todos los documentos';
        }

        this.renderizarListaCorporativos();
        this.renderizarListadoDocs();
    }

    /**
     * Renderiza la columna derecha: ListadoDoc
     */
    renderizarListadoDocs() {
        const tbody = document.getElementById('tbody-listado-docs');
        const badgeContador = document.getElementById('badge-contador-docs');
        if (!tbody) return;

        const { docs, corpSeleccionado } = this.deudoresModalState;

        // Filtrar si hay un corporativo seleccionado
        const docsFiltrados = corpSeleccionado
            ? docs.filter(d => d.nomcorporativo === corpSeleccionado)
            : docs;

        if (badgeContador) {
            badgeContador.textContent = `${docsFiltrados.length} docs`;
        }

        if (docsFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs text-slate-400">No se encontraron documentos para este criterio.</td></tr>`;
            return;
        }

        tbody.innerHTML = docsFiltrados.map(d => {
            const pctVal = Number(d.pct_cobrado || 0);
            const pctAncho = Math.min(Math.max(pctVal * 100, 0), 100);

            // Regla de color Tableau: verde si cobró (porcentaje alto), rojo si cobró muy poco (< 0.50 y > 0)
            const esVerde = pctVal >= 0.50;
            const colorBarra = esVerde ? '#59a14f' : '#e15759';
            // Formato de 5 decimales idéntico a Tableau (ej: 0,05000 o 0,00000)
            const textoPct = pctVal.toFixed(5).replace('.', ',');

            const sIniFmt = this.formatearNumeroTableau(d.saldoinicial, true);
            const sFinFmt = this.formatearNumeroTableau(d.saldofinal, true);
            // En Tableau la primera columna es "fechac.." (Día de fechacarga), ej: 1/8/2026
            const fCorta = this.formatearFechaCortaTableau(d.fechacarga);

            return `
                <tr class="hover:bg-slate-50 transition-colors text-[11px]">
                    <td class="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">${fCorta}</td>
                    <td class="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">${d.numerodoc}</td>
                    <td class="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">${d.horacreacion}</td>
                    <td class="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">${d.condicionpago}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono text-slate-700 whitespace-nowrap">${sIniFmt}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono text-slate-700 whitespace-nowrap">${sFinFmt}</td>
                    <td class="px-2.5 py-1.5 whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                            <div class="w-28 h-3.5 flex items-center relative">
                                ${pctAncho > 0 ? `<div class="h-full rounded-none" style="width: ${pctAncho}%; background-color: ${colorBarra};"></div>` : ''}
                            </div>
                            <span class="text-[10px] font-mono text-slate-700">
                                ${textoPct}
                            </span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async cargarFiltrosIniciales() {
        try {
            // 1. Cargar filtros de Barras (Cuentas y Clientes)
            const resBarra = await this.service.obtenerFiltros();
            if (resBarra.success && resBarra.data) {
                const { cuentas, clientes } = resBarra.data;

                const cuentasOpciones = cuentas.map((c, idx) => ({
                    id: c.id,
                    label: c.label,
                    selected: idx < 3
                }));

                const clientesOpciones = clientes.map(cli => ({
                    id: cli.id,
                    label: cli.label,
                    selected: true
                }));

                this.msCuentaVenta.setOptions(cuentasOpciones);
                this.msNomCliente.setOptions(clientesOpciones);
            }

            // 2. Cargar filtros de Líneas (Vencimiento, Decisión, Observación)
            const resLinea = await this.service.obtenerFiltrosLinea();
            if (resLinea.success && resLinea.data) {
                const { vencimientos, decisiones, observaciones } = resLinea.data;

                // Vencimiento: por defecto solo 'VENCIDO' marcado (como en Tableau)
                this.msVencimiento.setOptions(vencimientos.map(v => ({
                    id: v.id,
                    label: v.label,
                    selected: v.id.toUpperCase() === 'VENCIDO'
                })));

                // Decisión: todos seleccionados
                this.msDecision.setOptions(decisiones.map(d => ({
                    id: d.id,
                    label: d.label,
                    selected: true
                })));

                // Observación: todos seleccionados
                this.msObservacion.setOptions(observaciones.map(o => ({
                    id: o.id,
                    label: o.label,
                    selected: true
                })));
            }

            // Aplicar visibilidad inicial de los filtros según lo que esté marcado
            this.alternarVisibilidadFiltrosSegunTipo();

        } catch (error) {
            console.error('Error al cargar filtros iniciales:', error);
        }
    }

    aplicarLayoutGrid() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';

        if (modoDisposicion === 'horizontal') {
            const totalVisibles = this.msCuentaVenta ? this.msCuentaVenta.getSelectedValues().length : 0;

            if (totalVisibles === 1) {
                contenedor.className = 'grid grid-cols-1 gap-6 mt-6 pb-10 items-start min-w-0';
            } else if (totalVisibles === 2) {
                contenedor.className = 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pb-10 items-start min-w-0';
            } else {
                contenedor.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pb-10 items-start min-w-0';
            }
        } else {
            contenedor.className = 'flex flex-col gap-6 mt-6 pb-10 min-w-0';
        }
    }

    limpiarGraficos() {
        this.chartsMap.forEach(chart => {
            if (chart && chart._resizeObserver) {
                chart._resizeObserver.disconnect();
            }
            if (Array.isArray(chart)) {
                chart.forEach(c => c && typeof c.destroy === 'function' && c.destroy());
            } else if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.chartsMap.clear();
        this.cacheData = {};
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) contenedor.innerHTML = '';
    }


    /**
     * Muestra u oculta los filtros correspondientes según el tipo de gráfico seleccionado
     */
    alternarVisibilidadFiltrosSegunTipo() {
        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'saltosXcobrarXbarra';
        const esBarras = tipoGrafico === 'saltosXcobrarXbarra';
        const esCorporativosZona = tipoGrafico === '18CorporativosZonaDeudores';
        const usaFiltrosDoc = tipoGrafico === '02SalxCobrarxZona' || tipoGrafico === '20DashAnalisisCtasMaxDeudoresDocs' || esCorporativosZona;

        const wrapperCliente = document.getElementById('wrapper-filtro-nomcliente');
        const wrapperVenc = document.getElementById('wrapper-filtro-vencimiento');
        const wrapperDec = document.getElementById('wrapper-filtro-decision');
        const wrapperObs = document.getElementById('wrapper-filtro-observacion');
        const wrapperDisp = document.getElementById('wrapper-filtro-disposicion');

        if (wrapperCliente) {
            wrapperCliente.classList.toggle('hidden', !esBarras);
        }

        if (wrapperDisp) {
            wrapperDisp.classList.toggle('hidden', esCorporativosZona);
        }

        [wrapperVenc, wrapperDec, wrapperObs].forEach(el => {
            if (el) el.classList.toggle('hidden', !usaFiltrosDoc);
        });
    }

    /**
     * Consulta al servidor todas las cuentas seleccionadas (al presionar 'Cargar' o al inicio)
     */
    async cargarDatosDesdeServidor() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        this.limpiarGraficos();
        this.aplicarLayoutGrid();
        const { fechaInicio: fInicio, fechaFin: fFin } = PeriodoHelper.calcularRangoFechas();
        this.currentPeriodo = { inicio: fInicio, fin: fFin };

        const selectedCuentas = this.msCuentaVenta.getSelectedValues();
        if (selectedCuentas.length === 0) {
            contenedor.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium">
                    No hay cuentas seleccionadas para consultar.
                </div>
            `;
            return;
        }

        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'saltosXcobrarXbarra';
        const esVistaZona = tipoGrafico === '02SalxCobrarxZona';
        const esVistaAnticipos = tipoGrafico === '08IndAnticipos';
        const esVistaAnalisisCuentas = tipoGrafico === '20DashAnalisisCtasMaxDeudoresDocs';
        const esVistaCorporativosZona = tipoGrafico === '18CorporativosZonaDeudores';

        contenedor.innerHTML = `
            <div id="loader-graficos" class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-blue-600 font-medium flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Consultando datos del servidor...</span>
            </div>
        `;

        try {
            if (esVistaCorporativosZona) {
                // CONSULTA PARA 18CorporativosZonaDeudores (Matriz Corporativos x Zona Fiscal)
                const payload = {
                    fecha_inicio: fInicio,
                    fecha_fin: fFin,
                    fechacarga: fFin, // Toma la fecha de corte exacta como en Tableau
                    cuentas: selectedCuentas,
                    vencimientos: this.msVencimiento ? this.msVencimiento.getSelectedValues() : [],
                    decisiones: this.msDecision ? this.msDecision.getSelectedValues() : [],
                    observaciones: this.msObservacion ? this.msObservacion.getSelectedValues() : []
                };

                const res = await this.service.obtenerCorporativosZonaDeudores(payload);
                document.getElementById('loader-graficos')?.remove();

                if (!res.success || !res.data || !res.data.corporativos || res.data.corporativos.length === 0) {
                    contenedor.innerHTML = `
                        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                            No se encontraron registros de corporativos deudores para los filtros seleccionados.
                        </div>
                    `;
                    return;
                }

                this.crearMatrizCorporativosZonaDeudores(res.data);

            } else if (esVistaAnalisisCuentas) {
                // CONSULTA PARA 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
                const payload = {
                    fecha_inicio: fInicio,
                    fecha_fin: fFin,
                    cuentas: selectedCuentas,
                    vencimientos: this.msVencimiento ? this.msVencimiento.getSelectedValues() : [],
                    decisiones: this.msDecision ? this.msDecision.getSelectedValues() : [],
                    observaciones: this.msObservacion ? this.msObservacion.getSelectedValues() : []
                };

                const res = await this.service.obtenerGraficoAnalisisCuentas(payload);
                document.getElementById('loader-graficos')?.remove();

                if (!res.success || !res.payload || !res.payload.data || Object.keys(res.payload.data).length === 0) {
                    contenedor.innerHTML = `
                        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                            No se encontraron registros de saldos por cuenta para los filtros seleccionados.
                        </div>
                    `;
                    return;
                }

                this.cacheData = res.payload.data;
                this.crearDashboardAnalisisCuentas(this.cacheData, selectedCuentas);

            } else if (esVistaAnticipos) {
                // CONSULTA PARA 08IndAnticipos
                const payload = {
                    fecha_inicio: fInicio,
                    fecha_fin: fFin,
                    cuentas: selectedCuentas
                };

                const res = await this.service.obtenerGraficoAnticiposData(payload);
                document.getElementById('loader-graficos')?.remove();

                if (!res.success || !res.payload || !res.payload.data || Object.keys(res.payload.data).length === 0) {
                    contenedor.innerHTML = `
                        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                            No se encontraron datos de anticipos para las cuentas y fechas seleccionadas.
                        </div>
                    `;
                    return;
                }

                this.cacheData = res.payload.data;
                selectedCuentas.forEach(cuenta => {
                    if (this.cacheData[cuenta]) {
                        this.crearTarjetaYChartAnticipos(cuenta, this.cacheData[cuenta]);
                    }
                });

            } else if (esVistaZona) {
                // PAYLOAD PARA GRÁFICO DE LÍNEAS POR ZONA
                const payload = {
                    fecha_inicio: fInicio,
                    fecha_fin: fFin,
                    cuentas: selectedCuentas,
                    vencimientos: this.msVencimiento.getSelectedValues(),
                    decisiones: this.msDecision.getSelectedValues(),
                    observaciones: this.msObservacion.getSelectedValues()
                };

                const res = await this.service.obtenerGraficoLineaData(payload);
                document.getElementById('loader-graficos')?.remove();

                if (!res.success || !res.payload || !res.payload.data || Object.keys(res.payload.data).length === 0) {
                    contenedor.innerHTML = `
                        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                            No se encontraron registros de zonas para los filtros seleccionados.
                        </div>
                    `;
                    return;
                }

                this.cacheData = res.payload.data;
                selectedCuentas.forEach(cuenta => {
                    if (this.cacheData[cuenta]) {
                        this.crearTarjetaYChartLineasZona(cuenta, this.cacheData[cuenta]);
                    }
                });

            } else {
                // PAYLOAD PARA GRÁFICO DE BARRAS POR CLIENTE
                const totalClientesOpciones = this.msNomCliente.options.length;
                const selectedClientes = this.msNomCliente.getSelectedValues();
                const clientesPayload = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;

                const payload = {
                    fecha_inicio: fInicio,
                    fecha_fin: fFin,
                    cuentas: selectedCuentas,
                    clientes: clientesPayload
                };

                const res = await this.service.obtenerGraficoData(payload);
                document.getElementById('loader-graficos')?.remove();

                if (!res.success || !res.payload || !res.payload.data) {
                    contenedor.innerHTML = `
                        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                            No se encontraron registros para los filtros seleccionados.
                        </div>
                    `;
                    return;
                }

                this.cacheData = res.payload.data;
                selectedCuentas.forEach(cuenta => {
                    this.crearTarjetaYChart(cuenta, this.cacheData[cuenta] || []);
                });
            }

        } catch (error) {
            console.error('Error al cargar datos:', error);
            contenedor.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                    Ocurrió un error al consultar el servidor.
                </div>
            `;
        }
    }

    /**
     * Renderiza la matriz de Corporativos más Deudores por Zona Fiscal (18CorporativosZonaDeudores)
     * Reproduce exactamente la visualización de Tableau con sus columnas por zona, barras y leyenda.
     */
    crearMatrizCorporativosZonaDeudores(data) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        this.matrizZonaDeudoresState.dataOriginal = data;
        this.matrizZonaDeudoresState.zonasSeleccionadas = []; // Al inicio: todas visibles

        const { corporativos } = data;

        const tarjetaHtml = `
            <div class="col-span-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <!-- CABECERA DE LA TARJETA -->
                <div class="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 class="text-base font-bold text-slate-800 tracking-tight">CORPORATIVOS MAS DEUDORES POR ZONA</h3>
                        <p class="text-xs text-slate-500 font-medium mt-0.5" id="matriz-subtitulo-info">
                            Vision Corporativa &bull; <span class="font-semibold text-slate-700">${corporativos.length} corporativos</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg border border-blue-200">
                            18CorporativosZonaDeudores
                        </span>
                    </div>
                </div>

                <!-- CONTENEDOR PRINCIPAL: TABLA MATRIZ + LEYENDA LATERAL -->
                <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                    <!-- ÁREA DE LA TABLA MATRICIAL CON SCROLL -->
                    <div id="contenedor-tabla-matriz-zonas" class="flex-1 overflow-x-auto overflow-y-auto max-h-[680px] custom-scrollbar">
                        <!-- Generado dinámicamente -->
                    </div>

                    <!-- PANEL LATERAL: LEYENDA ZONA FISCAL REACTIVA -->
                    <div class="w-full lg:w-48 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/40 p-4 shrink-0 flex flex-col">
                        <div class="flex items-center justify-between mb-2.5">
                            <h4 class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">zonafiscal</h4>
                            <button id="btn-reset-zonas-matriz" class="hidden text-[10px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer">
                                Ver todas
                            </button>
                        </div>
                        <p class="text-[10px] text-slate-400 mb-2 leading-tight">Haz clic para filtrar o alternar zonas:</p>
                        <div id="lista-botones-zonas-matriz" class="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                            <!-- Botones generados dinámicamente -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        contenedor.innerHTML = tarjetaHtml;

        // Botón "Ver todas"
        document.getElementById('btn-reset-zonas-matriz')?.addEventListener('click', () => {
            this.matrizZonaDeudoresState.zonasSeleccionadas = [];
            this.actualizarVistaMatrizZonas();
        });

        // Renderizado inicial
        this.actualizarVistaMatrizZonas();
    }

    /**
     * Re-renderiza la tabla matricial y el panel lateral según las zonas seleccionadas
     */
    actualizarVistaMatrizZonas() {
        const { dataOriginal, zonasSeleccionadas } = this.matrizZonaDeudoresState;
        if (!dataOriginal) return;

        const { zonas: todasZonas, corporativos, max_saldo } = dataOriginal;
        const maxVal = max_saldo > 0 ? max_saldo : 1;

        // Si zonasSeleccionadas está vacío, se muestran todas
        const zonasActivas = zonasSeleccionadas.length > 0
            ? todasZonas.filter(z => zonasSeleccionadas.includes(z))
            : todasZonas;

        // Paleta oficial de colores por Zona Fiscal idéntica a Tableau
        const colorMapZonas = {
            'AREQUIPA': '#a0cbe8',
            'CAMANA':   '#f28e2b',
            'CUZCO':    '#8cd17d',
            'ILO':      '#b6992d',
            'JULIACA':  '#edc948',
            'LA JOYA':  '#499894',
            'MOLLENDO': '#ff9d9a',
            'MOQUEGUA': '#d4a6c8',
            'PEDREGAL': '#79706e',
            'PUNO':     '#bab0ac',
            'TACNA':    '#fabfd2'
        };
        const obtenerColorZona = (zona) => colorMapZonas[zona.toUpperCase()] || '#4e79a7';

        // 1. Renderizar Botones de la Leyenda Lateral
        const btnReset = document.getElementById('btn-reset-zonas-matriz');
        if (btnReset) {
            btnReset.classList.toggle('hidden', zonasSeleccionadas.length === 0);
        }

        const contenedorBotones = document.getElementById('lista-botones-zonas-matriz');
        if (contenedorBotones) {
            contenedorBotones.innerHTML = todasZonas.map(z => {
                const color = obtenerColorZona(z);
                const estaSeleccionada = zonasSeleccionadas.includes(z);
                const modoTodos = zonasSeleccionadas.length === 0;

                // Estilos reactivos tipo botón
                let clasesBtn = 'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer text-left ';
                if (modoTodos) {
                    clasesBtn += 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70';
                } else if (estaSeleccionada) {
                    clasesBtn += 'bg-blue-50 border-blue-400 text-blue-800 font-bold shadow-xs';
                } else {
                    clasesBtn += 'bg-white/60 border-slate-200/60 text-slate-400 hover:border-slate-300 hover:text-slate-600 opacity-60';
                }

                return `
                    <button type="button" 
                            class="btn-zona-filtro ${clasesBtn}" 
                            data-zona="${z}"
                            title="${estaSeleccionada ? 'Quitar filtro de ' + z : 'Filtrar por ' + z}">
                        <div class="flex items-center gap-2 truncate">
                            <span class="w-3 h-3 rounded-xs shrink-0 shadow-2xs" style="background-color: ${color};"></span>
                            <span class="truncate">${z}</span>
                        </div>
                        ${estaSeleccionada ? `<span class="text-blue-600 text-[10px] ml-1 shrink-0 font-bold">&check;</span>` : ''}
                    </button>
                `;
            }).join('');

            // Asignar listeners a cada botón
            contenedorBotones.querySelectorAll('.btn-zona-filtro').forEach(btn => {
                btn.addEventListener('click', () => {
                    const zona = btn.getAttribute('data-zona');
                    if (this.matrizZonaDeudoresState.zonasSeleccionadas.includes(zona)) {
                        // Quitar de la selección
                        this.matrizZonaDeudoresState.zonasSeleccionadas = this.matrizZonaDeudoresState.zonasSeleccionadas.filter(item => item !== zona);
                    } else {
                        // Agregar a la selección
                        this.matrizZonaDeudoresState.zonasSeleccionadas.push(zona);
                    }
                    this.actualizarVistaMatrizZonas();
                });
            });
        }

        // 2. Filtrar y ordenar corporativos que tengan deuda en al menos una de las zonas activas
        const corporativosVisibles = corporativos.filter(corp => {
            return zonasActivas.some(z => (corp.zonas[z] || 0) > 0);
        });

        // 3. Renderizar Tabla Matricial
        const contenedorTabla = document.getElementById('contenedor-tabla-matriz-zonas');
        if (!contenedorTabla) return;

        // Actualizar subtítulo con info de corporativos visibles
        const subInfo = document.getElementById('matriz-subtitulo-info');
        if (subInfo) {
            const txtFiltro = zonasSeleccionadas.length > 0 
                ? ` &bull; Filtrado por: <span class="text-blue-700 font-semibold">${zonasActivas.join(', ')}</span>`
                : '';
            subInfo.innerHTML = `Vision Corporativa &bull; <span class="font-semibold text-slate-700">${corporativosVisibles.length} corporativos</span>${txtFiltro}`;
        }

        if (zonasActivas.length === 0 || corporativosVisibles.length === 0) {
            contenedorTabla.innerHTML = `
                <div class="p-12 text-center text-slate-400 text-xs">
                    No se encontraron registros de deudores para las zonas seleccionadas.
                </div>
            `;
            return;
        }

        // Cabeceras de columnas activas
        const theadZonasHtml = zonasActivas.map(z => `
            <th class="px-2 py-2.5 text-center font-semibold text-[11px] tracking-wide whitespace-nowrap border-l border-blue-500/40 min-w-[110px]">
                <span>${z}</span>
            </th>
        `).join('');

        // Pie de columnas activas
        const tfootZonasHtml = zonasActivas.map(() => `
            <td class="px-2 py-1 text-center font-mono text-[9px] text-slate-400 border-l border-slate-200">
                <div class="flex justify-between px-1">
                    <span>0K</span>
                    <span>50K</span>
                    <span>100K</span>
                </div>
                <div class="text-[9px] text-slate-400 text-center mt-0.5">saldofinal</div>
            </td>
        `).join('');

        // Filas de corporativos visibles
        const tbodyRowsHtml = corporativosVisibles.map((corp, idx) => {
            const bgFila = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

            const celdasZonasHtml = zonasActivas.map(z => {
                const monto = corp.zonas[z] || 0;
                if (monto <= 0) {
                    return `<td class="px-2 py-1.5 border-l border-slate-100 text-center"></td>`;
                }

                const pctAncho = Math.min(Math.max((monto / maxVal) * 100, 3), 100);
                const colorBarra = obtenerColorZona(z);
                const montoFmt = this.formatearNumeroTableau(monto, false);

                return `
                    <td class="px-2 py-1.5 border-l border-slate-100 align-middle">
                        <div class="flex items-center gap-1.5 w-full">
                            <div class="flex-1 h-3.5 bg-slate-100 rounded-none overflow-hidden relative">
                                <div class="h-full rounded-none transition-all duration-300" 
                                     style="width: ${pctAncho}%; background-color: ${colorBarra};"
                                     title="${corp.nomcorporativo} - ${z}: S/ ${this.formatearNumeroTableau(monto, true)}">
                                </div>
                            </div>
                            <span class="text-[10.5px] font-mono text-slate-700 font-medium whitespace-nowrap min-w-[42px] text-right">
                                ${montoFmt}
                            </span>
                        </div>
                    </td>
                `;
            }).join('');

            return `
                <tr class="${bgFila} hover:bg-blue-50/50 transition-colors group">
                    <td class="sticky left-0 z-10 px-3 py-1.5 text-xs text-slate-700 font-medium whitespace-nowrap max-w-[260px] truncate bg-inherit shadow-[1px_0_0_0_rgba(226,232,240,1)]" 
                        title="${corp.nomcorporativo}">
                        ${corp.nomcorporativo}
                    </td>
                    ${celdasZonasHtml}
                </tr>
            `;
        }).join('');

        contenedorTabla.innerHTML = `
            <table class="w-full text-left text-xs border-collapse">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white uppercase text-[10.5px] tracking-wider border-b border-slate-200 shadow-xs">
                    <tr>
                        <th class="sticky left-0 z-30 bg-blue-600 px-3 py-2.5 font-bold whitespace-nowrap min-w-[220px] shadow-[1px_0_0_0_rgba(37,99,235,1)]">
                            <div class="flex items-center gap-1">
                                <span>nomcorporativo</span>
                                <svg class="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18M3 8h12m-12 4h6"></path></svg>
                            </div>
                        </th>
                        ${theadZonasHtml}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-700">
                    ${tbodyRowsHtml}
                </tbody>
                <tfoot class="sticky bottom-0 z-20 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200">
                    <tr>
                        <td class="sticky left-0 z-30 bg-slate-50 px-3 py-1 font-mono text-[9px] text-slate-400"></td>
                        ${tfootZonasHtml}
                    </tr>
                </tfoot>
            </table>
        `;
    }


    formatearFechaTableau(fechaStr) {
        if (!fechaStr) return '';
        const [year, month, day] = fechaStr.split('-').map(Number);
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${day} de ${meses[month - 1]} de ${year}`;
    }

    formatearNumeroTableau(numero, incluirDecimales = true) {
        if (numero === null || numero === undefined) return incluirDecimales ? '0,00' : '0';
        const num = Number(numero);
        if (isNaN(num)) return '0,00';

        if (!incluirDecimales) {
            return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }

        const partes = num.toFixed(2).split('.');
        partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return partes.join(',');
    }

    formatearFechaCortaTableau(fechaStr) {
        if (!fechaStr) return '';
        const [year, month, day] = fechaStr.split('-').map(Number);
        return `${day}/${month}/${year}`;
    }

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
     * Crea el DOM de una tarjeta y su gráfico Chart.js
     */
    crearTarjetaYChart(cuenta, datosCuenta) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const canvasId = `chart-cuenta-${cuenta}`;
        const tema = this.obtenerTemaCuenta(cuenta);

        if (this.chartsMap.has(cuenta)) {
            this.chartsMap.get(cuenta).destroy();
            this.chartsMap.delete(cuenta);
        }

        const tarjetaExistente = contenedor.querySelector(`[data-cuenta-id="${cuenta}"]`);
        if (tarjetaExistente) {
            tarjetaExistente.remove();
        }

        // Formatear las fechas para el eje X
        const labelsFormateados = datosCuenta.map(d => this.formatearFechaTableau(d.fecha));
        const totalPuntos = datosCuenta.length;
        const pxMinimoPorBarra = (modoDisposicion === 'horizontal') ? 34 : 40;
        const anchoMinimoRequerido = totalPuntos * pxMinimoPorBarra;

        const tarjeta = document.createElement('div');
        tarjeta.setAttribute('data-cuenta-id', cuenta);
        tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all';

        tarjeta.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <!-- BADGE CON COLORES DINÁMICOS -->
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${tema.bgBadge} ${tema.textBadge} font-bold text-xs rounded-lg border ${tema.borderBadge}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        Cuenta ${cuenta}
                    </span>
                    <span class="text-xs text-slate-400 font-medium">(${totalPuntos} días registrados)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong></span>
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">Soles</span>
                </div>
            </div>

            <div class="relative w-full overflow-x-auto pb-3 custom-scrollbar">
                <div style="width: max(100%, ${anchoMinimoRequerido}px); height: 550px;" class="relative">
                    <canvas id="${canvasId}"></canvas>
                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);

        const canvasEl = document.getElementById(canvasId);
        const chartExistente = Chart.getChart(canvasEl);
        if (chartExistente) {
            chartExistente.destroy();
        }

        const self = this;
        const ctx = canvasEl.getContext('2d');
        const nuevoChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labelsFormateados,
                datasets: [{
                    label: 'saldofinal',
                    data: datosCuenta.map(d => d.saldofinal),
                    backgroundColor: tema.bar,
                    hoverBackgroundColor: tema.hover,
                    borderWidth: 0,
                    borderRadius: 1,
                    maxBarThickness: 32,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        const fechaOriginal = datosCuenta[index].fecha;
                        const fechaTexto = labelsFormateados[index];
                        const monto = datosCuenta[index].saldofinal;
                        const nomCuenta = (datosCuenta[index] && datosCuenta[index].nomcuentaventa) ? datosCuenta[index].nomcuentaventa : '';

                        self.puntoSeleccionado = {
                            tipoGrafico: 'saltosXcobrarXbarra',
                            cuenta: cuenta,
                            nomcuentaventa: nomCuenta,
                            fecha: fechaOriginal,
                            fechaFormateada: fechaTexto,
                            saldofinal: monto
                        };

                        // Posicionar y mostrar el menú flotante 'Ver datos'
                        const popup = document.getElementById('popup-menu-barra');
                        const btnDeudores = document.getElementById('btn-abrir-analisis-corporativos');
                        if (btnDeudores) btnDeudores.classList.add('hidden');
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
                    padding: { top: 35, bottom: 5, left: 10, right: 10 }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        rotation: -90,
                        offset: 6,
                        color: '#1e293b',
                        font: { size: 10, weight: '500' },
                        formatter: (val) => self.formatearNumeroTableau(val)
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
                        titleFont: { size: 12, weight: 'normal' },
                        bodyFont: { size: 12, family: 'sans-serif' },
                        displayColors: false,
                        callbacks: {
                            title: () => '', // Ocultamos el título default para armar la estructura personalizada
                            label: (context) => {
                                const fechaLabel = context.label;
                                const valorFormateado = self.formatearNumeroTableau(context.raw);
                                return [
                                    `cuentaventa:        ${cuenta}`,
                                    `Día de fechacarga: ${fechaLabel}`,
                                    `saldofinal:            ${valorFormateado}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => v === 0 ? '0K' : `${(v / 1000).toFixed(0)}K`,
                            font: { size: 11 },
                            color: '#64748b'
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        ticks: {
                            font: { size: 11 },
                            color: '#475569',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                }
            }
        });

        this.chartsMap.set(cuenta, nuevoChart);
    }

    formatearFechaConDiaSemana(fechaStr) {
        if (!fechaStr) return '';
        const [year, month, day] = fechaStr.split('-').map(Number);
        const fecha = new Date(year, month - 1, day);
        const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        return `${diasSemana[fecha.getDay()]}, ${day} de ${meses[month - 1]} de ${year}`;
    }

    /**
     * Construye los filtros actuales del modal y detona la descarga del Excel
     */
    async exportarExcelDesdeModal() {
        if (!this.puntoSeleccionado) return;

        const btnExportar = document.getElementById('btn-exportar-excel-modal');
        const contenidoOriginal = btnExportar ? btnExportar.innerHTML : '';

        try {
            // Feedback visual de carga en el botón
            if (btnExportar) {
                btnExportar.disabled = true;
                btnExportar.classList.add('opacity-70', 'cursor-not-allowed');
                btnExportar.innerHTML = `
                    <svg class="animate-spin h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Generando...</span>
                `;
            }

            const tipoGrafico = this.puntoSeleccionado.tipoGrafico || (this.msTipoGrafico ? this.msTipoGrafico.getSelectedValues()[0] : 'saltosXcobrarXbarra');
            let payloadDetalle = {
                tipo_grafico: tipoGrafico,
                cuentaventa: this.puntoSeleccionado.cuenta,
                fechacarga: this.puntoSeleccionado.fecha
            };

            if (tipoGrafico === '02SalxCobrarxZona') {
                // Filtros de líneas por zona
                payloadDetalle.zonafiscal = this.puntoSeleccionado.zona;
                payloadDetalle.vencimientos = this.msVencimiento ? this.msVencimiento.getSelectedValues() : [];
                payloadDetalle.decisiones = this.msDecision ? this.msDecision.getSelectedValues() : [];
                payloadDetalle.observaciones = this.msObservacion ? this.msObservacion.getSelectedValues() : [];
            } else if (tipoGrafico === '08IndAnticipos') {
                // Anticipos no filtra por cliente ni zona
            } else if (tipoGrafico === '20DashAnalisisCtasMaxDeudoresDocs') {
                payloadDetalle.vencimientos = this.msVencimiento ? this.msVencimiento.getSelectedValues() : [];
                payloadDetalle.decisiones = this.msDecision ? this.msDecision.getSelectedValues() : [];
                payloadDetalle.observaciones = this.msObservacion ? this.msObservacion.getSelectedValues() : [];
            } else {
                // Filtros de barras por cliente
                const totalClientesOpciones = this.msNomCliente ? this.msNomCliente.options.length : 0;
                const selectedClientes = this.msNomCliente ? this.msNomCliente.getSelectedValues() : [];
                payloadDetalle.clientes = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;
            }

            await this.service.exportarDetalleExcel(payloadDetalle);

        } catch (error) {
            console.error('Error al exportar archivo Excel:', error);
            alert('Ocurrió un inconveniente al generar el archivo Excel.');
        } finally {
            // Restaurar estado del botón
            if (btnExportar) {
                btnExportar.disabled = false;
                btnExportar.classList.remove('opacity-70', 'cursor-not-allowed');
                btnExportar.innerHTML = contenidoOriginal;
            }
        }
    }

    /**
     * Renderiza una tarjeta por cuenta con mini-gráficos de líneas apilados por cada Zona Fiscal (Small Multiples)
     */
    crearTarjetaYChartLineasZona(cuenta, dataCuenta) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const tema = this.obtenerTemaCuenta(cuenta);

        // 1. Destruir instancias previas de esta cuenta
        if (this.chartsMap.has(cuenta)) {
            const chartPrevio = this.chartsMap.get(cuenta);
            if (chartPrevio && chartPrevio._resizeObserver) {
                chartPrevio._resizeObserver.disconnect();
            }
            if (Array.isArray(chartPrevio)) {
                chartPrevio.forEach(c => c && typeof c.destroy === 'function' && c.destroy());
            } else if (chartPrevio && typeof chartPrevio.destroy === 'function') {
                chartPrevio.destroy();
            }
            this.chartsMap.delete(cuenta);
        }

        const tarjetaExistente = contenedor.querySelector(`[data-cuenta-id="${cuenta}"]`);
        if (tarjetaExistente) {
            tarjetaExistente.remove();
        }

        // 2. Obtener eje temporal unificado
        const fechasSet = new Set();
        const zonas = Object.keys(dataCuenta.zonas || {});
        zonas.forEach(zona => {
            dataCuenta.zonas[zona].forEach(p => fechasSet.add(p.fecha));
        });
        const todasFechas = Array.from(fechasSet).sort();
        const labelsFormateados = todasFechas.map(f => this.formatearFechaTableau(f));

        const totalPuntos = todasFechas.length;
        const pxMinimoPorPunto = (modoDisposicion === 'horizontal') ? 34 : 38;
        const anchoMinimoRequerido = totalPuntos * pxMinimoPorPunto;
        const nomCuenta = dataCuenta.nomcuentaventa || '';

        // 3. Construir la estructura DOM
        const tarjeta = document.createElement('div');
        tarjeta.setAttribute('data-cuenta-id', cuenta);
        tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all';

        // Pistas compactas por cada zona (110px de alto)
        let pistasZonasHTML = '';
        zonas.forEach((zona, idx) => {
            const canvasId = `chart-linea-${cuenta}-${idx}`;
            const colorTema = this.paletaColores[idx % this.paletaColores.length];

            pistasZonasHTML += `
                <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                    <!-- ETIQUETA LATERAL DE LA ZONA -->
                    <div class="w-32 sm:w-36 shrink-0 flex flex-col justify-center pr-3 border-r border-slate-100 bg-white z-10 sticky left-0">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${colorTema.bgBadge} ${colorTema.textBadge} border ${colorTema.borderBadge} w-fit">
                            <span class="w-2 h-2 rounded-full" style="background-color: ${colorTema.bar};"></span>
                            ${zona}
                        </span>
                        <span class="text-[10px] text-slate-400 mt-0.5 font-medium">saldofinal</span>
                    </div>

                    <!-- LIENZO DEL MINI-GRÁFICO COMPACTO -->
                    <div class="flex-1 relative min-w-0" style="height: 110px;">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            `;
        });

        // Eje X inferior idéntico a Tableau
        const canvasEjeXId = `chart-ejex-${cuenta}`;

        tarjeta.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${tema.bgBadge} ${tema.textBadge} font-bold text-xs rounded-lg border ${tema.borderBadge}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                        </svg>
                        Cuenta ${cuenta}
                    </span>
                    <span class="text-xs font-semibold text-slate-700">${nomCuenta}</span>
                    <span class="text-xs text-slate-400 font-medium">(${zonas.length} zonas registradas)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong></span>
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">Soles</span>
                </div>
            </div>

            <!-- CONTENEDOR PRINCIPAL: SCROLL HORIZONTAL RESPONSIVE -->
            <div class="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                <div style="min-width: max(100%, ${anchoMinimoRequerido + 144}px);" class="w-full flex flex-col">
                    
                    <!-- PISTAS DE ZONAS: SCROLL VERTICAL -->
                    <div class="max-h-[440px] overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col pr-1">
                        ${pistasZonasHTML}
                    </div>

                    <!-- EJE X FIJO EN LA BASE -->
                    <div class="sticky bottom-0 z-20 bg-white border-t border-slate-200 flex items-stretch shadow-xs min-w-0">
                        <div class="w-32 sm:w-36 shrink-0 flex items-start justify-end pt-2 pr-3 border-r border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 z-30">
                            Día de fechacarga
                        </div>
                        <div class="flex-1 relative min-w-0" style="height: 135px;">
                            <canvas id="${canvasEjeXId}"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);

        // 4. Instanciar los mini-gráficos de cada zona
        const chartsArray = [];
        const self = this;

        zonas.forEach((zona, idx) => {
            const canvasId = `chart-linea-${cuenta}-${idx}`;
            const canvasEl = document.getElementById(canvasId);
            if (!canvasEl) return;

            const colorTema = this.paletaColores[idx % this.paletaColores.length];
            const mapaFechaValor = new Map(dataCuenta.zonas[zona].map(p => [p.fecha, p.saldofinal]));
            const serieValores = todasFechas.map(f => mapaFechaValor.get(f) ?? 0);

            const ctx = canvasEl.getContext('2d');
            const miniChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labelsFormateados,
                    datasets: [{
                        label: zona,
                        data: serieValores,
                        borderColor: colorTema.bar,
                        backgroundColor: colorTema.bar,
                        borderWidth: 1.8,
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: colorTema.bar,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.2,
                        tension: 0.1,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 18, bottom: 4, left: 10, right: 10 }
                    },
                    onClick: (event, elements) => {
                        if (elements && elements.length > 0) {
                            const pointIndex = elements[0].index;
                            const fechaOriginal = todasFechas[pointIndex];
                            const fechaTexto = labelsFormateados[pointIndex];
                            const monto = serieValores[pointIndex];

                            self.puntoSeleccionado = {
                                tipoGrafico: '02SalxCobrarxZona',
                                cuenta: cuenta,
                                nomcuentaventa: nomCuenta,
                                zona: zona,
                                fecha: fechaOriginal,
                                fechaFormateada: fechaTexto,
                                saldofinal: monto
                            };

                            const popup = document.getElementById('popup-menu-barra');
                            const btnDeudores = document.getElementById('btn-abrir-analisis-corporativos');
                            if (btnDeudores) btnDeudores.classList.add('hidden');
                            if (popup) {
                                popup.style.left = `${event.native.clientX + 10}px`;
                                popup.style.top = `${event.native.clientY + 10}px`;
                                popup.classList.remove('hidden');
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            color: '#334155',
                            font: { size: 11, weight: '600' },
                            formatter: (val) => (val > 0 ? self.formatearNumeroTableau(val, false) : ''),
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
                            displayColors: false, // Oculta el recuadro de color para emular Tableau
                            titleFont: { size: 11, weight: 'normal' },
                            bodyFont: { size: 11, family: 'sans-serif' },
                            callbacks: {
                                title: () => '', // Oculta el título predeterminado de Chart.js
                                label: (context) => {
                                    const index = context.dataIndex;
                                    const fechaOriginal = todasFechas[index];
                                    const fechaLarga = self.formatearFechaConDiaSemana(fechaOriginal);
                                    const valorFormateado = self.formatearNumeroTableau(context.raw, false);

                                    return [
                                        `cuentaventa:          ${cuenta}`,
                                        `nomcuentaventa:  ${nomCuenta}`,
                                        `zonafiscal:             ${zona}`,
                                        `Día de fechacarga: ${fechaLarga}`,
                                        `saldofinal:             ${valorFormateado}`
                                    ];
                                }
                            }
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => v === 0 ? '0K' : `${(v / 1000).toFixed(0)}K`,
                                font: { size: 10.5 },
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

            chartsArray.push(miniChart);
        });

        // 5. Renderizado directo y exacto del Eje X estático inferior (sin cortes ni espacios vacíos)
        const canvasEjeXEl = document.getElementById(canvasEjeXId);
        if (canvasEjeXEl) {
            const renderEjeX = () => {
                const primerChart = chartsArray[0];
                if (!primerChart || !primerChart.scales || !primerChart.scales.x) return;

                const parent = canvasEjeXEl.parentElement;
                const width = parent.clientWidth || canvasEjeXEl.clientWidth;
                const height = parent.clientHeight || 135;
                if (!width || !height) return;

                const dpr = window.devicePixelRatio || 1;
                canvasEjeXEl.width = width * dpr;
                canvasEjeXEl.height = height * dpr;
                canvasEjeXEl.style.width = width + 'px';
                canvasEjeXEl.style.height = height + 'px';

                const ctx = canvasEjeXEl.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

                // Configuración de texto para las fechas (-90° estándar Tableau / Chart.js)
                ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = '#475569';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                labelsFormateados.forEach((label, i) => {
                    const x = primerChart.scales.x.getPixelForValue(i);
                    if (x === undefined || isNaN(x)) return;

                    // Tick mark vertical de 4px
                    ctx.beginPath();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, 4);
                    ctx.stroke();

                    // Fecha completa rotada -90°: orientada de abajo hacia arriba terminando junto al tick
                    ctx.save();
                    ctx.translate(x, 8);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                });
            };

            const resizeObserver = new ResizeObserver(() => {
                // Si la tarjeta ya no está en el DOM, desconectamos y salimos
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
            chartsArray._resizeObserver = resizeObserver; // Guardamos la referencia para destruirlo a tiempo

            setTimeout(() => {
                if (document.body.contains(tarjeta)) {
                    renderEjeX();
                }
            }, 60);
        }

        this.chartsMap.set(cuenta, chartsArray);
    }

    /**
     * Devuelve un color interpolado entre rojo y verde según el porcentaje (60% a 100%)
     */
    obtenerColorPorcentaje(pct) {
        if (pct === null || pct === undefined || isNaN(pct)) return '#94a3b8';
        // Normalizar entre 60% y 100%
        const min = 60;
        const max = 100;
        const clamped = Math.max(min, Math.min(max, pct));
        const factor = (clamped - min) / (max - min); // 0.0 (rojo) a 1.0 (verde)

        // Rojo: rgb(239, 68, 68) | Verde: rgb(22, 163, 74)
        const r = Math.round(239 + factor * (22 - 239));
        const g = Math.round(68 + factor * (163 - 68));
        const b = Math.round(68 + factor * (74 - 68));

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Renderiza una tarjeta por cuenta con 4 pistas de métricas apiladas (08IndAnticipos)
     */
    crearTarjetaYChartAnticipos(cuenta, dataCuenta) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const tema = this.obtenerTemaCuenta(cuenta);

        // 1. Destruir instancias previas
        if (this.chartsMap.has(cuenta)) {
            const chartPrevio = this.chartsMap.get(cuenta);
            if (chartPrevio && chartPrevio._resizeObserver) {
                chartPrevio._resizeObserver.disconnect();
            }
            if (Array.isArray(chartPrevio)) {
                chartPrevio.forEach(c => c && typeof c.destroy === 'function' && c.destroy());
            } else if (chartPrevio && typeof chartPrevio.destroy === 'function') {
                chartPrevio.destroy();
            }
            this.chartsMap.delete(cuenta);
        }

        const tarjetaExistente = contenedor.querySelector(`[data-cuenta-id="${cuenta}"]`);
        if (tarjetaExistente) {
            tarjetaExistente.remove();
        }

        const puntos = dataCuenta.fechas || [];
        const labelsFormateados = puntos.map(p => this.formatearFechaTableau(p.fecha));
        const totalPuntos = puntos.length;
        const pxMinimoPorPunto = (modoDisposicion === 'horizontal') ? 38 : 46; 
        const anchoMinimoRequerido = totalPuntos * pxMinimoPorPunto;
        const nomCuenta = dataCuenta.nomcuentaventa || '';

        // Definición de las 4 pistas
        const configuracionPistas = [
            {
                id: `pista-pct-${cuenta}`,
                titulo: 'Indicador Porcentaje',
                clave: 'porcentaje_cobranza',
                color: '#e15759',
                esPorcentaje: true
            },
            {
                id: `pista-inicial-${cuenta}`,
                titulo: 'saldoinicial',
                clave: 'saldoinicial',
                color: '#4e79a7',
                esPorcentaje: false
            },
            {
                id: `pista-resta-${cuenta}`,
                titulo: 'Resta saldoinicial men...',
                clave: 'resta_saldo',
                color: '#4e79a7',
                esPorcentaje: false
            },
            {
                id: `pista-final-${cuenta}`,
                titulo: 'saldofinal',
                clave: 'saldofinal',
                color: '#4e79a7',
                esPorcentaje: false
            }
        ];

        // 2. Construir HTML de las pistas
        let pistasHTML = '';
        configuracionPistas.forEach(p => {
            pistasHTML += `
                <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                    <div class="w-36 sm:w-44 shrink-0 flex flex-col justify-center pr-3 border-r border-slate-100 bg-white z-10 sticky left-0">
                        <span class="text-[11px] font-bold text-slate-700 truncate">${p.titulo}</span>
                        <span class="text-[10px] text-slate-400 mt-0.5 font-medium">${p.esPorcentaje ? 'Ratio cobranza' : 'Monto'}</span>
                    </div>
                    <div class="flex-1 relative min-w-0" style="height: 115px;">
                        <canvas id="${p.id}"></canvas>
                    </div>
                </div>
            `;
        });

        const canvasEjeXId = `chart-ejex-anticipos-${cuenta}`;
        const tarjeta = document.createElement('div');
        tarjeta.setAttribute('data-cuenta-id', cuenta);
        tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all';

        tarjeta.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${tema.bgBadge} ${tema.textBadge} font-bold text-xs rounded-lg border ${tema.borderBadge}">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                        </svg>
                        Cuenta ${cuenta}
                    </span>
                    <span class="text-xs font-semibold text-slate-700">${nomCuenta}</span>
                    <span class="text-xs text-slate-400 font-medium">(Indicadores de Anticipos - Acumulable)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong></span>
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">Soles / %</span>
                </div>
            </div>

            <div class="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                <div style="min-width: max(100%, ${anchoMinimoRequerido + 176}px);" class="w-full flex flex-col">
                    
                    <div class="flex flex-col pr-1">
                        ${pistasHTML}
                    </div>

                    <!-- EJE X FIJO -->
                    <div class="sticky bottom-0 z-20 bg-white border-t border-slate-200 flex items-stretch shadow-xs min-w-0">
                        <div class="w-36 sm:w-44 shrink-0 flex items-start justify-end pt-2 pr-3 border-r border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 z-30">
                            Día de fechacarga
                        </div>
                        <div class="flex-1 relative min-w-0" style="height: 135px;">
                            <canvas id="${canvasEjeXId}"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);

        // 3. Renderizado de mini-gráficos
        const chartsArray = [];
        const self = this;

        configuracionPistas.forEach((pistaConfig) => {
            const canvasEl = document.getElementById(pistaConfig.id);
            if (!canvasEl) return;

            const serieValores = puntos.map(pt => pt[pistaConfig.clave] ?? 0);
            const ctx = canvasEl.getContext('2d');

            // Configuración del dataset
            let datasetConfig = {
                data: serieValores,
                borderWidth: 2,
                borderCapStyle: 'round',
                borderJoinStyle: 'round',
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBorderWidth: 1.5,
                pointBorderColor: '#ffffff',
                tension: 0.05, 
                fill: false
            };

            if (pistaConfig.esPorcentaje) {
                // DINAMISMO ROJO-VERDE: Segmentación y color dinámico por punto
                datasetConfig.borderColor = (ctx) => self.obtenerColorPorcentaje(ctx.dataset.data[0]);
                datasetConfig.segment = {
                    borderColor: (ctx) => {
                        const val = ctx.p1.parsed.y;
                        return self.obtenerColorPorcentaje(val);
                    }
                };
                datasetConfig.pointBackgroundColor = (ctx) => self.obtenerColorPorcentaje(ctx.raw);
                datasetConfig.pointBorderColor = '#ffffff';
                datasetConfig.pointBorderWidth = 1;
            } else {
                datasetConfig.borderColor = pistaConfig.color;
                datasetConfig.backgroundColor = pistaConfig.color;
                datasetConfig.pointBackgroundColor = pistaConfig.color;
                datasetConfig.pointBorderColor = '#ffffff';
                datasetConfig.pointBorderWidth = 1;
            }

            const miniChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labelsFormateados,
                    datasets: [datasetConfig]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 18, bottom: 4, left: 10, right: 10 }
                    },
                    onClick: (event, elements) => {
                        // Abrir el detalle al clickear en cualquier pista de Anticipos
                        if (elements && elements.length > 0) {
                            const pointIndex = elements[0].index;
                            const puntoActual = puntos[pointIndex] || {};
                            const fechaOriginal = puntoActual.fecha;
                            const fechaTexto = labelsFormateados[pointIndex];
                            const pct = Number(puntoActual.porcentaje_cobranza || 0);
                            const ratio = pct / 100;
                            const restaVal = (puntoActual.saldoinicial !== undefined && puntoActual.saldofinal !== undefined)
                                ? (Number(puntoActual.saldoinicial) - Number(puntoActual.saldofinal))
                                : puntoActual.resta_saldo;

                            self.puntoSeleccionado = {
                                tipoGrafico: '08IndAnticipos',
                                metrica: pistaConfig.clave,
                                cuenta: cuenta,
                                nomcuentaventa: nomCuenta,
                                fecha: fechaOriginal,
                                fechaFormateada: fechaTexto,
                                porcentaje: pct,
                                ratioCobranza: ratio,
                                saldofinal: puntoActual.saldofinal,
                                saldoinicial: puntoActual.saldoinicial,
                                resta_saldo: restaVal
                            };

                            const popup = document.getElementById('popup-menu-barra');
                            const btnDeudores = document.getElementById('btn-abrir-analisis-corporativos');
                            if (btnDeudores) btnDeudores.classList.add('hidden');
                            if (popup) {
                                popup.style.left = `${event.native.clientX + 10}px`;
                                popup.style.top = `${event.native.clientY + 10}px`;
                                popup.classList.remove('hidden');
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: (ctx) => (ctx.dataset.data[ctx.dataIndex] < 0 ? 'start' : 'end'),
                            align: (ctx) => (ctx.dataset.data[ctx.dataIndex] < 0 ? 'bottom' : 'top'),
                            offset: 2,
                            color: '#334155',
                            // Fuente más compacta para evitar que los números colisionen
                            font: { size: 10, weight: '600' },
                            formatter: (val) => {
                                if (val === null || val === undefined) return '';
                                if (pistaConfig.esPorcentaje) {
                                    return (val / 100).toFixed(2).replace('.', ',');
                                }
                                return self.formatearNumeroTableau(val, false);
                            }
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
                            displayColors: false, // Sin recuadros de color
                            titleFont: { size: 11, weight: 'normal' },
                            bodyFont: { size: 11, family: 'sans-serif' },
                            callbacks: {
                                title: () => '', // Sin título por defecto
                                label: (context) => {
                                    const index = context.dataIndex;
                                    const puntoActual = puntos[index] || {};
                                    const fechaLarga = self.formatearFechaConDiaSemana(puntoActual.fecha);

                                    // 1. TOOLTIP PARA EL INDICADOR PORCENTAJE
                                    if (pistaConfig.esPorcentaje) {
                                        const valorPct = Number(puntoActual.porcentaje_cobranza || 0).toFixed(2).replace('.', ',');
                                        return [
                                            `nomcuentaventa:  ${nomCuenta}`,
                                            `Día de fechacarga: ${fechaLarga}`,
                                            `Indicador:                ${valorPct}%`
                                        ];
                                    }

                                    // 2. TOOLTIP COMPLETO PARA LAS PISTAS DE MONTOS
                                    const sFinal = self.formatearNumeroTableau(puntoActual.saldofinal, false);
                                    const sInicial = self.formatearNumeroTableau(puntoActual.saldoinicial, false);
                                    const sCobrado = self.formatearNumeroTableau(puntoActual.resta_saldo, true);

                                    return [
                                        `nomcuentaventa:  ${nomCuenta}`,
                                        `Día de fechacarga: ${fechaLarga}`,
                                        `cuentaventa:          ${cuenta}`,
                                        `saldofinal:                ${sFinal}`,
                                        `saldoinicial:             ${sInicial}`,
                                        `Cobrado:                 ${sCobrado}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            // Si es la pista de porcentaje, fijar el rango estricto de 0 a 100 como en Tableau
                            min: pistaConfig.esPorcentaje ? 0 : undefined,
                            max: pistaConfig.esPorcentaje ? 100 : undefined,
                            ticks: {
                                callback: (v) => pistaConfig.esPorcentaje ? `${v}%` : (v === 0 ? '0' : `${(v / 1000).toFixed(0)}K`),
                                font: { size: 9.5 },
                                color: '#94a3b8',
                                maxTicksLimit: pistaConfig.esPorcentaje ? 5 : 3
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

            chartsArray.push(miniChart);
        });

        // 4. Renderizado directo del Eje X estático
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

                labelsFormateados.forEach((label, i) => {
                    const x = primerChart.scales.x.getPixelForValue(i);
                    if (x === undefined || isNaN(x)) return;

                    ctx.beginPath();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, 4);
                    ctx.stroke();

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
            chartsArray._resizeObserver = resizeObserver;

            setTimeout(() => {
                if (document.body.contains(tarjeta)) {
                    renderEjeX();
                }
            }, 60);
        }

        this.chartsMap.set(cuenta, chartsArray);
    }

    /**
     * Construye la vista de pistas para 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
     */
    crearDashboardAnalisisCuentas(dataCuentas, selectedCuentas) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const cuentasValidas = selectedCuentas.filter(cta => dataCuentas[cta]);
        if (cuentasValidas.length === 0) {
            contenedor.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium">
                    No se encontraron registros de saldos por cuenta para los filtros seleccionados.
                </div>
            `;
            return;
        }

        // 1. Unificar y ordenar todas las fechas presentes en la consulta
        const conjuntoFechas = new Set();
        cuentasValidas.forEach(cta => {
            if (dataCuentas[cta] && Array.isArray(dataCuentas[cta].fechas)) {
                dataCuentas[cta].fechas.forEach(pt => conjuntoFechas.add(pt.fecha));
            }
        });
        const todasFechas = Array.from(conjuntoFechas).sort();

        if (todasFechas.length === 0) {
            contenedor.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium">
                    No hay fechas registradas para los filtros aplicados.
                </div>
            `;
            return;
        }

        const labelsFormateados = todasFechas.map(f => this.formatearFechaConDiaSemana(f));
        const totalPuntos = todasFechas.length;
        const pxMinimoPorPunto = 38;
        const anchoMinimoRequerido = totalPuntos * pxMinimoPorPunto;

        // Paleta Tableau idéntica a la vista original
        const coloresTableau = {
            '121201': '#2563EB', // Azul
            '121202': '#D97706', // Ámbar / Naranja
            '121204': '#DC2626', // Rojo
            '121205': '#0D9488', // Verde Azulado / Teal
            '121207': '#16A34A', // Verde
            '121210': '#78716C'  // Gris cálido / Café
        };

        // 2. Construir la estructura DOM
        const tarjeta = document.createElement('div');
        tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between transition-all min-w-0';

        let pistasHTML = '';
        cuentasValidas.forEach((cuenta, idx) => {
            const infoCuenta = dataCuentas[cuenta];
            const nomCuenta = infoCuenta.nomcuentaventa || `Cuenta ${cuenta}`;
            const canvasId = `chart-analisis-cuenta-${cuenta}`;
            const color = coloresTableau[cuenta] || (this.paletaColores[idx % this.paletaColores.length]?.bar || '#2563EB');

            pistasHTML += `
                <div class="flex items-stretch border-b border-slate-100 last:border-b-0 py-1 min-w-0">
                    <!-- ETIQUETA LATERAL: CUENTA, NOMBRE Y SALDOFINAL -->
                    <div class="w-48 sm:w-56 shrink-0 flex items-center justify-between pr-3 border-r border-slate-200 bg-white z-10 sticky left-0 shadow-xs">
                        <div class="flex flex-col min-w-0 pr-2">
                            <div class="flex items-center gap-1.5">
                                <span class="w-2.5 h-2.5 rounded-xs shrink-0" style="background-color: ${color};"></span>
                                <span class="text-xs font-bold text-slate-800 font-mono">${cuenta}</span>
                            </div>
                            <span class="text-[11px] text-slate-500 font-medium truncate mt-0.5" title="${nomCuenta}">${nomCuenta}</span>
                        </div>
                        <div class="shrink-0 text-right">
                            <span class="text-[10px] text-slate-400 font-semibold tracking-wider block">saldofinal</span>
                        </div>
                    </div>

                    <!-- LIENZO DEL MINI-GRÁFICO -->
                    <div class="flex-1 relative min-w-0" style="height: 85px;">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            `;
        });

        const canvasEjeXId = 'chart-ejex-analisis-cuentas';

        tarjeta.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200/60">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                        Saldos por Cobrar por Cuenta de Venta
                    </span>
                    <span class="text-xs text-slate-400 font-medium">(${cuentasValidas.length} cuentas registradas)</span>
                </div>
                <div class="flex items-center gap-2 text-[11px]">
                    <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong></span>
                    <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">Soles</span>
                </div>
            </div>

            <!-- CONTENEDOR PRINCIPAL: SCROLL HORIZONTAL RESPONSIVE -->
            <div class="relative w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                <div style="min-width: max(100%, ${anchoMinimoRequerido + 230}px);" class="w-full flex flex-col">
                    
                    <!-- PISTAS DE CUENTAS: SCROLL VERTICAL -->
                    <div class="max-h-[520px] overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col pr-1">
                        ${pistasHTML}
                    </div>

                    <!-- EJE X FIJO EN LA BASE -->
                    <div class="sticky bottom-0 z-20 bg-white border-t border-slate-200 flex items-stretch shadow-xs min-w-0">
                        <div class="w-48 sm:w-56 shrink-0 flex items-start justify-end pt-2 pr-3 border-r border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 z-30">
                            Día de fechacarga
                        </div>
                        <div class="flex-1 relative min-w-0" style="height: 155px;">
                            <canvas id="${canvasEjeXId}"></canvas>
                        </div>
                    </div>

                </div>
            </div>
        `;

        contenedor.appendChild(tarjeta);

        // 3. Instanciar los mini-gráficos por cuenta
        const chartsArray = [];
        const self = this;

        cuentasValidas.forEach((cuenta, idx) => {
            const canvasId = `chart-analisis-cuenta-${cuenta}`;
            const canvasEl = document.getElementById(canvasId);
            if (!canvasEl) return;

            const infoCuenta = dataCuentas[cuenta];
            const nomCuenta = infoCuenta.nomcuentaventa || `Cuenta ${cuenta}`;
            const color = coloresTableau[cuenta] || (this.paletaColores[idx % this.paletaColores.length]?.bar || '#2563EB');

            const mapaFechaValor = new Map(infoCuenta.fechas.map(p => [p.fecha, p.saldofinal]));
            const serieValores = todasFechas.map(f => mapaFechaValor.get(f) ?? null);

            const valoresNumericos = serieValores.filter(v => v !== null && v !== undefined);
            const maxVal = valoresNumericos.length > 0 ? Math.max(...valoresNumericos) : 0;
            const usaMillones = maxVal >= 1000000;

            const ctx = canvasEl.getContext('2d');
            const miniChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labelsFormateados,
                    datasets: [{
                        data: serieValores,
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round',
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        tension: 0.1,
                        fill: false,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    layout: {
                        padding: { top: 22, bottom: 4, left: 10, right: 10 }
                    },
                    onClick: (event, elements) => {
                        if (elements && elements.length > 0) {
                            const pointIndex = elements[0].index;
                            const fechaOriginal = todasFechas[pointIndex];
                            const fechaTexto = labelsFormateados[pointIndex];
                            const monto = serieValores[pointIndex];

                            self.puntoSeleccionado = {
                                tipoGrafico: '20DashAnalisisCtasMaxDeudoresDocs',
                                cuenta: cuenta,
                                nomcuentaventa: nomCuenta,
                                fecha: fechaOriginal,
                                fechaFormateada: fechaTexto,
                                saldofinal: monto
                            };

                            const popup = document.getElementById('popup-menu-barra');
                            const btnDeudores = document.getElementById('btn-abrir-analisis-corporativos');
                            if (btnDeudores) btnDeudores.classList.remove('hidden');
                            if (popup) {
                                popup.style.left = `${event.native.clientX + 10}px`;
                                popup.style.top = `${event.native.clientY + 10}px`;
                                popup.classList.remove('hidden');
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            color: '#334155',
                            font: { size: 9, weight: '500' },
                            formatter: (val) => {
                                if (val === null || val === undefined) return '';
                                return self.formatearNumeroTableau(val, false);
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: '#ffffff',
                            titleColor: '#0f172a',
                            bodyColor: '#334155',
                            borderColor: '#cbd5e1',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                                title: () => '',
                                label: (context) => {
                                    const index = context.dataIndex;
                                    const fOriginal = todasFechas[index];
                                    const fLarga = self.formatearFechaConDiaSemana(fOriginal);
                                    const sFinal = self.formatearNumeroTableau(context.raw, true);
                                    return [
                                        `cuentaventa:       ${cuenta}`,
                                        `nomcuentaventa:    ${nomCuenta}`,
                                        `Día de fechacarga: ${fLarga}`,
                                        `saldofinal:        ${sFinal}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => {
                                    if (v === 0) return '0M';
                                    if (usaMillones) return `${(v / 1000000).toFixed(0)}M`;
                                    return `${(v / 1000).toFixed(0)}K`;
                                },
                                font: { size: 9.5 },
                                color: '#94a3b8',
                                maxTicksLimit: 3
                            },
                            grid: { color: '#f1f5f9' }
                        },
                        x: {
                            ticks: { display: false },
                            grid: { color: '#f8fafc' }
                        }
                    }
                }
            });

            chartsArray.push(miniChart);
        });

        // 4. Renderizar Eje X inferior idéntico a Tableau
        const canvasEjeXEl = document.getElementById(canvasEjeXId);
        if (canvasEjeXEl && chartsArray.length > 0) {
            const renderEjeX = () => {
                const primerChart = chartsArray[0];
                if (!primerChart || !primerChart.scales || !primerChart.scales.x) return;

                const parent = canvasEjeXEl.parentElement;
                const width = parent.clientWidth || canvasEjeXEl.clientWidth;
                const height = parent.clientHeight || 155;
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

                // Formato de texto para las fechas (-90° estilo Tableau)
                ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = '#475569';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                labelsFormateados.forEach((label, i) => {
                    const x = primerChart.scales.x.getPixelForValue(i);
                    if (x === undefined || isNaN(x)) return;

                    // Tick mark vertical de 4px
                    ctx.beginPath();
                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 1;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, 4);
                    ctx.stroke();

                    // Fecha completa rotada -90°
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
            chartsArray._resizeObserver = resizeObserver;

            setTimeout(() => {
                if (document.body.contains(tarjeta)) {
                    renderEjeX();
                }
            }, 60);
        }

        this.chartsMap.set('analisis_cuentas', chartsArray);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new SaldosController();
    controller.init();
});