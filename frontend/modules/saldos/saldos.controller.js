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
        // 1. Tipo de Gráfico
        this.msTipoGrafico = new CustomMultiSelect({
            btnId: 'ms-tipografico-btn',
            labelId: 'ms-tipografico-label',
            dropdownId: 'ms-tipografico-dropdown',
            searchId: 'ms-tipografico-search',
            optionsContainerId: 'ms-tipografico-options',
            options: [
                { id: 'saltosXcobrarXbarra', label: 'saltosXcobrarXbarra', selected: true }
            ]
        });

        // 2. Cuenta Venta (Al cambiar, solo oculta/muestra en caliente o carga las faltantes)
        this.msCuentaVenta = new CustomMultiSelect({
            btnId: 'ms-cuentaventa-btn',
            labelId: 'ms-cuentaventa-label',
            dropdownId: 'ms-cuentaventa-dropdown',
            searchId: 'ms-cuentaventa-search',
            optionsContainerId: 'ms-cuentaventa-options',
            options: [],
            onChange: () => this.sincronizarVisibilidadEnCaliente()
        });

        // 3. Nombre Cliente (No recarga en cada clic; se aplica al dar 'Cargar')
        this.msNomCliente = new CustomMultiSelect({
            btnId: 'ms-nomcliente-btn',
            labelId: 'ms-nomcliente-label',
            dropdownId: 'ms-nomcliente-dropdown',
            searchId: 'ms-nomcliente-search',
            optionsContainerId: 'ms-nomcliente-options',
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
                        <td class="px-4 py-2.5 border-r border-slate-200 font-semibold text-slate-800">${item.nomcliente}</td>
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
            const res = await this.service.obtenerFiltros();
            if (res.success && res.data) {
                const { cuentas, clientes } = res.data;

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
        } catch (error) {
            console.error('Error al cargar filtros iniciales:', error);
        }
    }

    aplicarLayoutGrid() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';

        if (modoDisposicion === 'horizontal') {
            // Contamos cuántas cuentas están seleccionadas/visibles actualmente
            const totalVisibles = this.msCuentaVenta ? this.msCuentaVenta.getSelectedValues().length : 0;

            if (totalVisibles === 1) {
                // 1 gráfico: ocupa todo el ancho disponible
                contenedor.className = 'grid grid-cols-1 gap-6 mt-6 pb-10 items-start';
            } else if (totalVisibles === 2) {
                // 2 gráficos: mitad y mitad (2 columnas exactas)
                contenedor.className = 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pb-10 items-start';
            } else {
                // 3 o más gráficos: hasta 3 columnas
                contenedor.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pb-10 items-start';
            }
        } else {
            contenedor.className = 'flex flex-col gap-6 mt-6 pb-10';
        }
    }

    limpiarGraficos() {
        this.chartsMap.forEach(chart => chart.destroy());
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
     * Consulta al servidor todas las cuentas seleccionadas (al presionar 'Cargar' o al inicio)
     */
    async cargarDatosDesdeServidor() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        // 1. Destruir instancias previas y limpiar memoria antes de inyectar HTML
        this.limpiarGraficos();

        this.aplicarLayoutGrid();
        const { fechaInicio: fInicio, fechaFin: fFin } = PeriodoHelper.calcularRangoFechas();
        this.currentPeriodo = { inicio: fInicio, fin: fFin };

        const selectedCuentas = this.msCuentaVenta.getSelectedValues();
        if (selectedCuentas.length === 0) {
            this.sincronizarVisibilidadEnCaliente();
            return;
        }

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

            // Renderizar cada tarjeta
            selectedCuentas.forEach(cuenta => {
                this.crearTarjetaYChart(cuenta, this.cacheData[cuenta] || []);
            });

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
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new SaldosController();
    controller.init();
});