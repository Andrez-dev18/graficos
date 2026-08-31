class SaldosController {
    constructor() {
        this.service = new saldosService();
        this.chartsMap = new Map();
        this.cacheData = {};
        this.currentPeriodo = { inicio: '', fin: '' };

        this.msTipoGrafico = null;
        this.msCuentaVenta = null;
        this.msNomCliente = null;
    }

    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        this.inicializarComponentesFiltros();
        this.setupEventListeners();

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
            contenedor.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pb-10 items-start';
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

    formatearNumeroTableau(numero) {
        if (numero === null || numero === undefined) return '0';
        return Math.round(Number(numero)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /**
     * Crea el DOM de una tarjeta y su gráfico Chart.js
     */
    crearTarjetaYChart(cuenta, datosCuenta) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const canvasId = `chart-cuenta-${cuenta}`;

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
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg border border-blue-100">
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

            <!-- CONTENEDOR DEL CANVAS CON LA ALTURA DESEADA (520px) -->
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
                    backgroundColor: '#4e79a7',
                    hoverBackgroundColor: '#3b5f88',
                    borderWidth: 0,
                    borderRadius: 1,
                    maxBarThickness: 32,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }]
            },
            options: {
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