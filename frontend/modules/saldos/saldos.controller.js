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
    }

    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        this.inicializarComponentesFiltros();
        this.setupEventListeners();
        this.setupModalEventListeners();

        PeriodoHelper.renderizarInputs();
        await this.cargarFiltrosIniciales();

        // Primera carga inicial al abrir la vista
        await this.cargarDatosDesdeServidor();
    }

    inicializarComponentesFiltros() {

        // 2. Cuenta Venta (Se mantiene igual)
        this.msCuentaVenta = new CustomMultiSelect({
            btnId: 'ms-cuentaventa-btn',
            labelId: 'ms-cuentaventa-label',
            dropdownId: 'ms-cuentaventa-dropdown',
            searchId: 'ms-cuentaventa-search',
            optionsContainerId: 'ms-cuentaventa-options',
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
            options: []
        });

        // 4. Vencimiento (Líneas por Zona)
        this.msVencimiento = new CustomMultiSelect({
            btnId: 'ms-vencimiento-btn',
            labelId: 'ms-vencimiento-label',
            dropdownId: 'ms-vencimiento-dropdown',
            searchId: 'ms-vencimiento-search',
            optionsContainerId: 'ms-vencimiento-options',
            options: []
        });

        // 5. Decisión (Líneas por Zona)
        this.msDecision = new CustomMultiSelect({
            btnId: 'ms-decision-btn',
            labelId: 'ms-decision-label',
            dropdownId: 'ms-decision-dropdown',
            searchId: 'ms-decision-search',
            optionsContainerId: 'ms-decision-options',
            options: []
        });

        // 6. Observación (Líneas por Zona)
        this.msObservacion = new CustomMultiSelect({
            btnId: 'ms-observacion-btn',
            labelId: 'ms-observacion-label',
            dropdownId: 'ms-observacion-dropdown',
            searchId: 'ms-observacion-search',
            optionsContainerId: 'ms-observacion-options',
            options: []
        });
    }

    setupEventListeners() {
        // Toggle Colapsar Filtros
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
            this.sincronizarVisibilidadEnCaliente();
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

        const { cuenta, fechaFormateada, saldofinal } = this.puntoSeleccionado;

        document.getElementById('modal-titulo-vista').textContent = `Ver datos: Cuenta ${cuenta}`;
        document.getElementById('modal-subtitulo-filas').textContent = `Día de fechacarga: ${fechaFormateada}`;

        // Llenar pestaña Resumen
        const tbodyResumen = document.getElementById('tbody-modal-resumen');
        if (tbodyResumen) {
            tbodyResumen.innerHTML = `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 border-r border-slate-200 font-semibold">${cuenta}</td>
                    <td class="px-4 py-3 border-r border-slate-200">${fechaFormateada}</td>
                    <td class="px-4 py-3 text-right font-bold text-slate-900">${this.formatearNumeroTableau(saldofinal, true)}</td>
                </tr>
            `;
        }

        this.cambiarTabModal('resumen');
        modal.classList.remove('hidden');

        // Cargar datos completos en background
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
        const tbody = document.getElementById('tbody-modal-completos');
        const totalSpan = document.getElementById('total-modal-saldofinal');

        loader?.classList.remove('hidden');
        tabla?.classList.add('hidden');
        if (tbody) tbody.innerHTML = '';

        try {
            const totalClientesOpciones = this.msNomCliente.options.length;
            const selectedClientes = this.msNomCliente.getSelectedValues();
            const clientesPayload = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;

            const res = await this.service.obtenerDetalle({
                cuentaventa: this.puntoSeleccionado.cuenta,
                fechacarga: this.puntoSeleccionado.fecha,
                clientes: clientesPayload
            });

            loader?.classList.add('hidden');

            if (res.success && res.payload && res.payload.datos_completos) {
                const filas = res.payload.datos_completos;
                document.getElementById('modal-subtitulo-filas').textContent = `${filas.length} filas encontradas (${this.puntoSeleccionado.fechaFormateada})`;

                // Calcular suma total de los saldos finales listados
                const totalGeneral = filas.reduce((acc, curr) => acc + Number(curr.saldofinal || 0), 0);

                tbody.innerHTML = filas.map(item => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-2.5 border-r border-slate-200 font-medium">${item.cuentaventa}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 whitespace-nowrap">${this.puntoSeleccionado.fechaFormateada}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 text-slate-500 whitespace-nowrap">${this.formatearFechaCortaTableau(item.fechacarga)}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 font-mono text-slate-600">${item.codcliente}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 font-semibold text-slate-800">${item.nomcliente}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 text-slate-600 whitespace-nowrap">${item.condicionpago}</td>
                        <td class="px-4 py-2.5 border-r border-slate-200 font-mono text-slate-600 whitespace-nowrap">${item.numerodoc}</td>
                        <td class="px-4 py-2.5 text-right font-bold text-slate-900">${this.formatearNumeroTableau(item.saldofinal, true)}</td>
                    </tr>
                `).join('');

                // Asignar el total formateado en el footer
                if (totalSpan) {
                    totalSpan.textContent = this.formatearNumeroTableau(totalGeneral, true);
                }

                tabla?.classList.remove('hidden');
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No se encontraron datos para este registro.</td></tr>`;
                if (totalSpan) totalSpan.textContent = '0,00';
                tabla?.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error al cargar datos completos en el modal:', error);
            loader?.classList.add('hidden');
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-rose-500">Error al cargar datos desde el servidor.</td></tr>`;
            if (totalSpan) totalSpan.textContent = '0,00';
            tabla?.classList.remove('hidden');
        }
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
     * Sincroniza la visibilidad en caliente sin recargar la página ni pedir datos existentes
     */
    async sincronizarVisibilidadEnCaliente() {
        const selectedCuentas = this.msCuentaVenta.getSelectedValues();
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        // Recalcula el ancho de las columnas en caliente según la cantidad activa
        this.aplicarLayoutGrid();

        // 1. Ocultar o mostrar tarjetas ya renderizadas en el DOM
        const tarjetas = contenedor.querySelectorAll('[data-cuenta-id]');
        tarjetas.forEach(card => {
            const cuentaId = card.getAttribute('data-cuenta-id');
            if (selectedCuentas.includes(cuentaId)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });

        // 2. Identificar si hay cuentas seleccionadas que aún no existen en caché
        const cuentasFaltantes = selectedCuentas.filter(c => !this.cacheData[c]);

        if (cuentasFaltantes.length > 0) {
            await this.cargarCuentasFaltantes(cuentasFaltantes);
        }

        // Mensaje de estado vacío si no hay ninguna visible
        const hayVisibles = Array.from(tarjetas).some(c => !c.classList.contains('hidden')) || cuentasFaltantes.length > 0;
        let emptyMsg = document.getElementById('mensaje-sin-cuentas');

        if (!hayVisibles && selectedCuentas.length === 0) {
            if (!emptyMsg) {
                emptyMsg = document.createElement('div');
                emptyMsg.id = 'mensaje-sin-cuentas';
                emptyMsg.className = 'col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium';
                emptyMsg.textContent = 'No hay cuentas seleccionadas para mostrar.';
                contenedor.appendChild(emptyMsg);
            }
            emptyMsg.classList.remove('hidden');
        } else if (emptyMsg) {
            emptyMsg.classList.add('hidden');
        }
    }

    /**
     * Muestra u oculta los filtros correspondientes según el tipo de gráfico seleccionado
     */
    alternarVisibilidadFiltrosSegunTipo() {
        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'saltosXcobrarXbarra';
        const esBarras = tipoGrafico === 'saltosXcobrarXbarra';
        const esLineas = tipoGrafico === '02SalxCobrarxZona';

        const wrapperCliente = document.getElementById('wrapper-filtro-nomcliente');
        const wrapperVenc = document.getElementById('wrapper-filtro-vencimiento');
        const wrapperDec = document.getElementById('wrapper-filtro-decision');
        const wrapperObs = document.getElementById('wrapper-filtro-observacion');

        // NOMCLIENTE solo visible en Barras
        if (wrapperCliente) {
            wrapperCliente.classList.toggle('hidden', !esBarras);
        }

        // Vencimiento, Decisión y Observación solo visibles en Líneas por Zona
        [wrapperVenc, wrapperDec, wrapperObs].forEach(el => {
            if (el) el.classList.toggle('hidden', !esLineas);
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
            this.sincronizarVisibilidadEnCaliente();
            return;
        }

        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'saltosXcobrarXbarra';
        const esVistaZona = tipoGrafico === '02SalxCobrarxZona';

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
            if (esVistaZona) {
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
     * Trae de la API únicamente las cuentas que faltan por renderizar
     */
    async cargarCuentasFaltantes(cuentasFaltantes) {
        try {
            const totalClientesOpciones = this.msNomCliente.options.length;
            const selectedClientes = this.msNomCliente.getSelectedValues();
            const clientesPayload = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;

            const payload = {
                fecha_inicio: this.currentPeriodo.inicio,
                fecha_fin: this.currentPeriodo.fin,
                cuentas: cuentasFaltantes,
                clientes: clientesPayload
            };

            const res = await this.service.obtenerGraficoData(payload);
            if (res.success && res.payload && res.payload.data) {
                cuentasFaltantes.forEach(cta => {
                    const datosCta = res.payload.data[cta] || [];
                    this.cacheData[cta] = datosCta;
                    this.crearTarjetaYChart(cta, datosCta);
                });
            }
        } catch (error) {
            console.error('Error cargando cuentas faltantes:', error);
        }
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

                        self.puntoSeleccionado = {
                            cuenta: cuenta,
                            fecha: fechaOriginal,
                            fechaFormateada: fechaTexto,
                            saldofinal: monto
                        };

                        // Posicionar y mostrar el menú flotante 'Ver datos'
                        const popup = document.getElementById('popup-menu-barra');
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

                    <!-- LIENZO DEL MINI-GRÁFICO COMPACTO (110px) -->
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
                                cuenta: cuenta,
                                zona: zona,
                                fecha: fechaOriginal,
                                fechaFormateada: fechaTexto,
                                saldofinal: monto
                            };

                            const popup = document.getElementById('popup-menu-barra');
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
                            padding: 8,
                            callbacks: {
                                title: (ctx) => ctx[0].label,
                                label: (context) => `Zona ${zona}: S/. ${self.formatearNumeroTableau(context.raw, true)}`
                            }
                        }
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

}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new SaldosController();
    controller.init();
});