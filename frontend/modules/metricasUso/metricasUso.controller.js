const doughnutValueLabelsPlugin = {
    id: 'doughnutValueLabels',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);

        if (!dataset || !meta || !meta.data) return;

        ctx.save();
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(15, 23, 42, 0.55)';
        ctx.shadowBlur = 3;

        meta.data.forEach((arc, index) => {
            const valor = Number(dataset.data[index] || 0);
            if (valor <= 0) return;

            const posicion = arc.tooltipPosition();
            ctx.fillText(valor.toLocaleString('es-PE'), posicion.x, posicion.y);
        });

        ctx.restore();
    }
};

const horizontalBarValueLabelsPlugin = {
    id: 'horizontalBarValueLabels',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const dataset = chart.data.datasets[0];
        const meta = chart.getDatasetMeta(0);

        if (!dataset || !meta || !meta.data) return;

        ctx.save();
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#475569';

        meta.data.forEach((bar, index) => {
            const valor = Number(dataset.data[index] || 0);
            if (valor <= 0) return;

            ctx.fillText(valor.toLocaleString('es-PE'), bar.x + 6, bar.y);
        });

        ctx.restore();
    }
};

class MetricasUsoController {
    constructor() {
        this.service = new MetricasUsoService();
        this.charts = {};
        this.paletaRoles = [
            '#2563eb',
            '#059669',
            '#d97706',
            '#7c3aed',
            '#0891b2',
            '#e11d48',
            '#4f46e5',
            '#0d9488',
            '#ea580c',
            '#64748b'
        ];
        this.tabActiva = 'modulos';
        this.tablas = {
            modulos: null,
            usuarios: null,
            inactivos: null
        };
        this.periodoActual = {
            desde: '',
            hasta: ''
        };
        this.maxValues = {
            modulos: {},
            usuarios: {},
            inactivos: {}
        };
        this.busquedaDebounce = null;
        this.modalModulosRequest = 0;
    }

    init() {
        this.aplicarNombre(this.obtenerNombreUsuario());
        this.programarActualizacionNombre();
        this.setupPeriodo();
        this.setupListeners();
        this.cargarDatos();
    }

    programarActualizacionNombre() {
        let intentos = 0;

        const intervalo = setInterval(() => {
            intentos++;

            const nombre = this.obtenerNombreUsuario();

            if (nombre) {
                this.aplicarNombre(nombre);
                clearInterval(intervalo);
                return;
            }

            if (intentos >= 10) {
                clearInterval(intervalo);
            }
        }, 300);
    }

    obtenerNombreUsuario() {
        const nombreSesion = this.obtenerNombreDesdeSesion();
        if (nombreSesion) {
            return nombreSesion;
        }

        try {
            const elementoPadre = window.parent && window.parent !== window && window.parent.document
                ? window.parent.document.getElementById('username')
                : null;

            if (elementoPadre) {
                const nombrePadre = (elementoPadre.textContent || '').trim();
                if (nombrePadre && nombrePadre !== 'Usuario Admin') {
                    return nombrePadre;
                }
            }
        } catch (error) {
            // El padre puede no ser accesible; se ignora.
        }

        return '';
    }

    obtenerNombreDesdeSesion() {
        try {
            const usuarioRaw = sessionStorage.getItem('usuario');
            if (usuarioRaw) {
                const usuario = JSON.parse(usuarioRaw);
                if (usuario.nombre) {
                    return usuario.nombre;
                }
            }
        } catch (error) {
            // Se intenta con el sessionStorage del padre.
        }

        try {
            if (window.parent && window.parent !== window) {
                const usuarioRaw = window.parent.sessionStorage.getItem('usuario');
                if (usuarioRaw) {
                    const usuario = JSON.parse(usuarioRaw);
                    if (usuario.nombre) {
                        return usuario.nombre;
                    }
                }
            }
        } catch (error) {
            // Se ignora si no es accesible.
        }

        return '';
    }

    aplicarNombre(nombre) {
        if (!nombre) {
            return;
        }

        const elemento = document.getElementById('lblNombreUsuario');

        if (elemento) {
            elemento.textContent = nombre;
        }
    }

    setupPeriodo() {
        const select = document.getElementById('select-tipo-periodo');

        if (select) {
            select.value = 'por_mes';
        }

        if (window.PeriodoHelper && typeof PeriodoHelper.renderizarInputs === 'function') {
            PeriodoHelper.renderizarInputs();
        }
    }

    setupListeners() {
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (window.PeriodoHelper && typeof PeriodoHelper.renderizarInputs === 'function') {
                PeriodoHelper.renderizarInputs();
            }
        });

        document.getElementById('btnCargar')?.addEventListener('click', () => {
            this.cargarDatos();
        });

        document.querySelectorAll('#tabsDetalle [data-tab]').forEach(boton => {
            boton.addEventListener('click', () => this.activarTab(boton.dataset.tab));
        });

        const inputBuscar = document.getElementById('inputBuscarTabla');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (event) => {
                clearTimeout(this.busquedaDebounce);

                const valor = event.target.value || '';

                this.busquedaDebounce = setTimeout(() => {
                    const tabla = this.tablas[this.tabActiva];
                    if (tabla) {
                        tabla.search(valor).draw();
                    }
                }, 400);
            });
        }

        const selectOrden = document.getElementById('selectOrdenTabla');
        if (selectOrden) {
            selectOrden.addEventListener('change', () => {
                const tabla = this.tablas[this.tabActiva];
                if (!tabla) return;

                const [columna, direccion] = (selectOrden.value || '0:asc').split(':');
                tabla.order([parseInt(columna, 10), direccion === 'desc' ? 'desc' : 'asc']).draw();
            });
        }

        document.getElementById('btnLimpiarTabla')?.addEventListener('click', () => {
            const input = document.getElementById('inputBuscarTabla');
            if (input) input.value = '';

            this.configurarOpcionesOrden(this.tabActiva);

            const tabla = this.tablas[this.tabActiva];
            if (tabla) {
                tabla.search('').order(this.ordenPorDefecto(this.tabActiva)).page(0).draw();
            }
        });

        document.getElementById('btnCerrarModalModulos')?.addEventListener('click', () => {
            this.cerrarModalModulosUsuario();
        });

        document.getElementById('modalModulosUsuario')?.addEventListener('click', (event) => {
            if (event.target.id === 'modalModulosUsuario') {
                this.cerrarModalModulosUsuario();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.cerrarModalModulosUsuario();
            }
        });

        document.getElementById('tblUsuariosDetalle')?.addEventListener('click', (event) => {
            const boton = event.target.closest('[data-ver-modulos]');
            if (!boton) return;

            this.abrirModalModulosUsuario(boton.dataset.codUsuario, boton.dataset.nombre);
        });
    }

    async cargarDatos() {
        if (!window.PeriodoHelper || typeof PeriodoHelper.obtenerRangoFechas !== 'function') {
            this.mostrarMensaje('No se pudo inicializar el filtro de fechas.', 'error');
            return;
        }

        const rango = PeriodoHelper.obtenerRangoFechas();
        const desde = rango.fechaInicio || rango.inicio || '';
        const hasta = rango.fechaFin || rango.fin || '';

        if (!desde || !hasta) {
            this.mostrarMensaje('Selecciona un período válido.', 'error');
            return;
        }

        const inicio = new Date(`${desde}T00:00:00`);
        const fin = new Date(`${hasta}T00:00:00`);

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
            this.mostrarMensaje('El período seleccionado no es válido.', 'error');
            return;
        }

        if ((fin - inicio) / 86400000 > 366) {
            this.mostrarMensaje('El rango máximo permitido es 1 año.', 'error');
            return;
        }

        this.ocultarMensaje();
        this.setCargando(true);

        try {
            const data = await this.service.obtenerDashboard(desde, hasta);

            this.mostrarContenido();
            this.renderizar(data);
            this.ocultarMensaje();
        } catch (error) {
            if (error.status === 403) {
                this.mostrarAccesoDenegado();
            } else {
                this.mostrarMensaje(error.message || 'No se pudieron cargar las métricas.', 'error');
            }
        } finally {
            this.setCargando(false);
        }
    }

    setCargando(cargando) {
        const overlay = document.getElementById('loadingOverlay');
        const boton = document.getElementById('btnCargar');

        if (overlay) {
            overlay.classList.toggle('hidden', !cargando);
            overlay.classList.toggle('flex', cargando);
        }

        if (boton) {
            boton.disabled = cargando;
        }
    }

    mostrarContenido() {
        document.getElementById('contenidoMetricas')?.classList.remove('hidden');
        document.getElementById('accesoDenegado')?.classList.add('hidden');
    }

    mostrarAccesoDenegado() {
        document.getElementById('contenidoMetricas')?.classList.add('hidden');
        document.getElementById('accesoDenegado')?.classList.remove('hidden');
        this.ocultarMensaje();
    }

    mostrarMensaje(mensaje, tipo = 'info') {
        const elemento = document.getElementById('mensajeEstado');
        if (!elemento) return;

        const esError = tipo === 'error';
        const estilos = esError
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-blue-200 bg-blue-50 text-blue-700';
        const icono = esError ? 'fa-circle-exclamation' : 'fa-circle-info';

        elemento.className = `rounded-lg border px-4 py-3 text-sm ${estilos}`;
        elemento.innerHTML = `<i class="fa-solid ${icono} mr-2"></i>${this.escaparHtml(mensaje)}`;
        elemento.classList.remove('hidden');
    }

    ocultarMensaje() {
        document.getElementById('mensajeEstado')?.classList.add('hidden');
    }

    renderizar(data) {
        this.aplicarUsuario(data.usuario);
        this.actualizarPeriodo(data.periodo);
        this.renderizarKpis(data.kpis || {});
        this.renderizarGraficos(data);
        this.renderizarTablas(data);
    }

    aplicarUsuario(usuario) {
        if (usuario && usuario.nombre) {
            this.aplicarNombre(usuario.nombre);
            return;
        }

        const nombre = this.obtenerNombreUsuario();

        if (nombre) {
            this.aplicarNombre(nombre);
        }
    }

    actualizarPeriodo(periodo) {
        const elemento = document.getElementById('periodoActual');
        if (!elemento) return;

        if (!periodo || !periodo.desde || !periodo.hasta) {
            elemento.textContent = '—';
            return;
        }

        elemento.textContent = `${this.formatearFechaCorta(periodo.desde)} - ${this.formatearFechaCorta(periodo.hasta)}`;
    }

    renderizarKpis(kpis) {
        const moduloTop = kpis.moduloTop || null;

        this.setTexto('kpiUsuariosActivos', this.formatearNumero(kpis.usuariosActivos || 0));
        this.setTexto('kpiUsuariosActivosDetalle', `${this.formatearNumero(kpis.usuariosConAcceso || 0)} con acceso actual`);

        this.setTexto('kpiIngresos', this.formatearNumero(kpis.totalIngresos || 0));
        this.setTexto('kpiIngresosDetalle', `${this.formatearNumero(kpis.usuariosIngresaron || 0)} usuarios ingresaron`);

        this.setTexto('kpiConsultas', this.formatearNumero(kpis.totalConsultas || 0));
        this.setTexto('kpiConsultasDetalle', `${this.formatearNumero(kpis.promedioConsultas || 0)} promedio por usuario activo`);

        const elementoModulo = document.getElementById('kpiModuloTop');
        const detalleModulo = document.getElementById('kpiModuloTopDetalle');

        if (elementoModulo) {
            elementoModulo.textContent = moduloTop ? moduloTop.nom_mod : 'Sin actividad';
            elementoModulo.title = moduloTop ? moduloTop.nom_mod : '';
        }

        if (detalleModulo) {
            detalleModulo.textContent = moduloTop
                ? `${this.formatearNumero(moduloTop.consultas)} consultas · ${this.formatearNumero(moduloTop.usuarios)} usuarios`
                : 'Sin consultas en el período';
        }
    }

    renderizarGraficos(data) {
        this.destruirGraficos();

        this.renderizarSerieDiaria(data.serieDiaria || []);
        this.renderizarRoles(data.roles || []);
        this.renderizarTopModulos(data.topModulos || []);
        this.renderizarTopUsuarios(data.topUsuarios || []);
    }

    destruirGraficos() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });

        this.charts = {};
    }

    renderizarSerieDiaria(serie) {
        const canvas = document.getElementById('chartSerieDiaria');
        if (!canvas) return;

        this.serieDiaria = serie;

        const labels = serie.map(item => this.formatearDiaCorto(item.dia));
        const consultas = serie.map(item => Number(item.consultas) || 0);
        const ingresos = serie.map(item => Number(item.ingresos) || 0);

        this.charts.serie = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Consultas',
                        data: consultas,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        fill: true,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Ingresos',
                        data: ingresos,
                        borderColor: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.04)',
                        fill: false,
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 2,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            boxHeight: 8,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';

                                const dia = this.serieDiaria[items[0].dataIndex];
                                return dia ? this.formatearFechaTooltip(dia.dia) : '';
                            },
                            afterBody: (items) => {
                                if (!items.length) return [];

                                const dia = this.serieDiaria[items[0].dataIndex];

                                if (!dia) return [];

                                return [
                                    '',
                                    `Usuarios activos: ${this.formatearNumero(dia.usuariosActivos || 0)}`,
                                    `Usuarios que ingresaron: ${this.formatearNumero(dia.usuariosIngresaron || 0)}`,
                                    `Módulos a que ingresaron: ${this.formatearNumero(dia.modulosDistintos || 0)}`,
                                    `Promedio consultas/usuario: ${this.formatearNumero(dia.promedioConsultas || 0)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            font: { size: 10 }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.15)' },
                        ticks: {
                            precision: 0,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    renderizarRoles(roles) {
        const canvas = document.getElementById('chartRoles');
        if (!canvas) return;

        const labels = roles.map(item => item.rol);
        const valores = roles.map(item => Number(item.usuarios) || 0);

        this.charts.roles = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: valores,
                    backgroundColor: this.paletaRoles,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            plugins: [doughnutValueLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            boxHeight: 8,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        cornerRadius: 6
                    }
                }
            }
        });
    }

    renderizarTopModulos(modulos) {
        const canvas = document.getElementById('chartTopModulos');
        if (!canvas) return;

        const labels = modulos.map(item => this.truncar(item.nom_mod, 30));
        const valores = modulos.map(item => Number(item.consultas) || 0);
        const nombres = modulos.map(item => item.nom_mod);

        this.charts.modulos = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Consultas',
                    data: valores,
                    backgroundColor: 'rgba(37, 99, 235, 0.75)',
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            plugins: [horizontalBarValueLabelsPlugin],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { right: 34 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            title: (items) => items.length ? nombres[items[0].dataIndex] : '',
                            label: (context) => {
                                const item = modulos[context.dataIndex];
                                return `${this.formatearNumero(item.consultas)} consultas · ${this.formatearNumero(item.usuarios)} usuarios`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.15)' },
                        ticks: {
                            precision: 0,
                            font: { size: 10 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    renderizarTopUsuarios(usuarios) {
        const canvas = document.getElementById('chartTopUsuarios');
        if (!canvas) return;

        const labels = usuarios.map(item => this.truncar(item.nombre || item.cod_usuario, 30));
        const valores = usuarios.map(item => Number(item.consultas) || 0);
        const nombres = usuarios.map(item => item.nombre || item.cod_usuario);

        this.charts.usuarios = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Consultas',
                    data: valores,
                    backgroundColor: 'rgba(5, 150, 105, 0.75)',
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            plugins: [horizontalBarValueLabelsPlugin],
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, elements) => {
                    if (!elements.length) return;

                    const item = usuarios[elements[0].index];
                    if (!item) return;

                    this.abrirModalModulosUsuario(item.cod_usuario, item.nombre || item.cod_usuario);
                },
                onHover: (event, elements) => {
                    if (!event.native || !event.native.target) return;

                    event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
                },
                layout: {
                    padding: { right: 34 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            title: (items) => items.length ? nombres[items[0].dataIndex] : '',
                            label: (context) => {
                                const item = usuarios[context.dataIndex];
                                return `${this.formatearNumero(item.consultas)} consultas · ${this.formatearNumero(item.modulos)} módulos · ${this.formatearNumero(item.ingresos)} ingresos`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.15)' },
                        ticks: {
                            precision: 0,
                            font: { size: 10 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    obtenerPeriodoModal() {
        if (this.periodoActual && this.periodoActual.desde && this.periodoActual.hasta) {
            return this.periodoActual;
        }

        if (window.PeriodoHelper && typeof PeriodoHelper.obtenerRangoFechas === 'function') {
            const rango = PeriodoHelper.obtenerRangoFechas();

            return {
                desde: rango.fechaInicio || rango.inicio || '',
                hasta: rango.fechaFin || rango.fin || ''
            };
        }

        return { desde: '', hasta: '' };
    }

    async abrirModalModulosUsuario(codUsuario, nombre) {
        const modal = document.getElementById('modalModulosUsuario');
        const body = document.getElementById('modalModulosUsuarioBody');

        if (!modal || !body || !codUsuario) return;

        const periodo = this.obtenerPeriodoModal();
        const requestId = ++this.modalModulosRequest;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        this.setTexto('modalModulosUsuarioNombre', nombre || codUsuario);
        this.setTexto('modalModulosUsuarioPeriodo', 'Período: ' + (
            periodo.desde && periodo.hasta
                ? `${this.formatearFechaCorta(periodo.desde)} - ${this.formatearFechaCorta(periodo.hasta)}`
                : '—'
        ));
        this.setTexto('modalModulosUsuarioResumen', 'Cargando…');

        body.innerHTML = `
            <tr>
                <td colspan="4" class="px-5 py-10 text-center text-sm text-slate-500">
                    <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 align-middle"></span>
                    Cargando módulos...
                </td>
            </tr>
        `;

        try {
            const data = await this.service.obtenerModulosUsuario(codUsuario, periodo);

            if (requestId !== this.modalModulosRequest) return;

            this.renderizarModulosUsuario(data);
        } catch (error) {
            if (requestId !== this.modalModulosRequest) return;

            body.innerHTML = `
                <tr>
                    <td colspan="4" class="px-5 py-10 text-center text-sm text-red-600">
                        ${this.escaparHtml(error.message || 'No se pudieron cargar los módulos.')}
                    </td>
                </tr>
            `;
            this.setTexto('modalModulosUsuarioResumen', 'Error');
        }
    }

    renderizarModulosUsuario(data) {
        const body = document.getElementById('modalModulosUsuarioBody');

        if (!body) return;

        const modulos = data.modulos || [];
        const periodo = data.periodo || {};

        if (!modulos.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="4" class="px-5 py-10 text-center text-sm text-slate-500">
                        El usuario no registra consultas a módulos en el período seleccionado.
                    </td>
                </tr>
            `;
        } else {
            body.innerHTML = modulos.map(item => `
                <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td class="px-5 py-3">
                        <p class="text-sm font-medium text-slate-800">${this.escaparHtml(item.nom_mod)}</p>
                        <p class="text-[11px] text-slate-400">${this.escaparHtml(item.cod_mod)}</p>
                    </td>
                    <td class="px-5 py-3 text-xs text-slate-600">${this.escaparHtml(item.categoria || 'Sin categoría')}</td>
                    <td class="px-5 py-3 text-right text-sm font-semibold text-slate-800">${this.formatearNumero(item.consultas)}</td>
                    <td class="px-5 py-3 text-right text-xs text-slate-500">${this.formatearFechaHora(item.ultimo_acceso)}</td>
                </tr>
            `).join('');
        }

        this.setTexto('modalModulosUsuarioPeriodo', 'Período: ' + (
            periodo.desde && periodo.hasta
                ? `${this.formatearFechaCorta(periodo.desde)} - ${this.formatearFechaCorta(periodo.hasta)}`
                : '—'
        ));
        this.setTexto('modalModulosUsuarioResumen', `${this.formatearNumero(data.totalModulos || 0)} módulos · ${this.formatearNumero(data.totalConsultas || 0)} consultas`);
    }

    cerrarModalModulosUsuario() {
        const modal = document.getElementById('modalModulosUsuario');

        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    renderizarTablas(data) {
        clearTimeout(this.busquedaDebounce);
        this.periodoActual = data.periodo || this.periodoActual;

        const kpis = data.kpis || {};

        this.setTexto('contadorTabModulos', this.formatearNumero(kpis.modulosConActividad || 0));
        this.setTexto('contadorTabUsuarios', this.formatearNumero(kpis.usuariosConActividad || kpis.usuariosActivos || 0));
        this.setTexto('contadorTabInactivos', this.formatearNumero(data.totalUsuariosSinActividad || 0));

        const inputBuscar = document.getElementById('inputBuscarTabla');
        if (inputBuscar) {
            inputBuscar.value = '';
            inputBuscar.placeholder = this.placeholderBusqueda(this.tabActiva);
        }

        this.configurarOpcionesOrden(this.tabActiva);

        ['modulos', 'usuarios', 'inactivos'].forEach(tab => {
            if (this.tablas[tab]) {
                this.tablas[tab]
                    .search('')
                    .order(this.ordenPorDefecto(tab))
                    .page(0)
                    .ajax.reload(null, false);
            }
        });

        if (!this.tablas[this.tabActiva]) {
            this.inicializarTabla(this.tabActiva);
        }
    }

    inicializarTabla(tab) {
        const idTabla = this.idTabla(tab);
        const elemento = document.getElementById(idTabla);

        if (!elemento || typeof window.jQuery === 'undefined' || !window.jQuery.fn.DataTable) {
            return;
        }

        const $tabla = window.jQuery(elemento);

        if (window.jQuery.fn.DataTable.isDataTable($tabla)) {
            $tabla.DataTable().destroy();
        }

        const metodo = {
            modulos: 'obtenerModulosDatatable',
            usuarios: 'obtenerUsuariosDatatable',
            inactivos: 'obtenerInactivosDatatable'
        }[tab];

        this.tablas[tab] = $tabla.DataTable({
            processing: true,
            serverSide: true,
            autoWidth: false,
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100],
            searching: true,
            order: this.ordenPorDefecto(tab),
            layout: {
                topStart: null,
                topEnd: null,
                bottomStart: ['info', 'pageLength'],
                bottomEnd: 'paging'
            },
            language: {
                url: 'https://cdn.datatables.net/plug-ins/2.0.8/i18n/es-ES.json'
            },
            ajax: async (dataRequests, callback) => {
                try {
                    const response = await this.service[metodo](dataRequests, this.periodoActual);
                    this.maxValues[tab] = (response.meta && response.meta.maxValues) ? response.meta.maxValues : {};
                    this.actualizarContadorTab(tab, response.recordsTotal || 0);
                    callback(response);
                } catch (error) {
                    console.error(`Error cargando tabla ${tab}:`, error);
                    callback({
                        draw: dataRequests.draw || 1,
                        recordsTotal: 0,
                        recordsFiltered: 0,
                        data: []
                    });
                }
            },
            columns: this.obtenerColumnasTabla(tab)
        });
    }

    idTabla(tab) {
        return {
            modulos: 'tblModulosDetalle',
            usuarios: 'tblUsuariosDetalle',
            inactivos: 'tblInactivosDetalle'
        }[tab] || '';
    }

    obtenerColumnasTabla(tab) {
        if (tab === 'modulos') {
            return [
                {
                    data: 'nom_mod',
                    render: (data, type, row) => this.renderModulo(row)
                },
                {
                    data: 'consultas',
                    className: 'text-right',
                    render: (data) => this.renderBarra(data, 'modulos', 'consultas')
                },
                {
                    data: 'usuarios',
                    className: 'text-right',
                    render: (data) => this.renderBarra(data, 'modulos', 'usuarios')
                },
                {
                    data: 'ultimo_acceso',
                    className: 'text-right',
                    render: (data) => this.renderFecha(data)
                }
            ];
        }

        if (tab === 'usuarios') {
            return [
                {
                    data: 'nombre',
                    render: (data, type, row) => this.renderUsuario(row)
                },
                {
                    data: 'roles',
                    render: (data) => this.renderRoles(data)
                },
                {
                    data: 'ingresos',
                    className: 'text-right',
                    render: (data) => this.renderBarra(data, 'usuarios', 'ingresos')
                },
                {
                    data: 'consultas',
                    className: 'text-right',
                    render: (data) => this.renderBarra(data, 'usuarios', 'consultas')
                },
                {
                    data: 'modulos',
                    className: 'text-right',
                    render: (data, type, row) => this.renderModulosUsuarioBoton(data, row)
                },
                {
                    data: 'ultima_actividad',
                    className: 'text-right',
                    render: (data) => this.renderFecha(data)
                }
            ];
        }

        return [
            {
                data: 'cod_usuario',
                render: (data) => `<span class="text-sm font-semibold text-slate-800">${this.escaparHtml(data)}</span>`
            },
            {
                data: 'nombre',
                render: (data) => `<span class="text-sm text-slate-600">${this.escaparHtml(data || '—')}</span>`
            },
            {
                data: 'roles',
                render: (data) => this.renderRoles(data)
            }
        ];
    }

    renderModulo(row) {
        return `
            <div class="min-w-[220px]">
                <p class="text-sm font-medium text-slate-800">${this.escaparHtml(row.nom_mod)}</p>
                <p class="mt-0.5">
                    <span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        ${this.escaparHtml(row.categoria || 'Sin categoría')}
                    </span>
                </p>
            </div>
        `;
    }

    renderUsuario(row) {
        const nombre = row.nombre || row.cod_usuario || '';
        const mostrarCodigo = nombre !== row.cod_usuario;
        const iniciales = this.obtenerIniciales(nombre);

        return `
            <div class="flex min-w-[220px] items-center gap-2.5">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-600">
                    ${this.escaparHtml(iniciales)}
                </div>
                <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-slate-800">${this.escaparHtml(nombre)}</p>
                    ${mostrarCodigo ? `<p class="text-[11px] text-slate-400">${this.escaparHtml(row.cod_usuario)}</p>` : ''}
                </div>
            </div>
        `;
    }

    renderModulosUsuarioBoton(cantidad, row) {
        const codUsuario = row.cod_usuario || '';
        const nombre = row.nombre || codUsuario;

        return `
            <button type="button" data-ver-modulos
                data-cod-usuario="${this.escaparHtml(codUsuario)}"
                data-nombre="${this.escaparHtml(nombre)}"
                class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                title="Ver módulos consultados">
                ${this.formatearNumero(cantidad)}
                <i class="fa-solid fa-eye text-[10px]"></i>
            </button>
        `;
    }

    renderRoles(roles) {
        const lista = String(roles || '')
            .split(',')
            .map(rol => rol.trim())
            .filter(Boolean);

        if (lista.length === 0) {
            return '<span class="text-xs text-slate-400">—</span>';
        }

        return `<div class="flex flex-wrap gap-1">${lista.map(rol => `<span class="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">${this.escaparHtml(rol)}</span>`).join('')}</div>`;
    }

    renderFecha(valor) {
        return `<span class="whitespace-nowrap text-xs text-slate-500"><i class="fa-regular fa-clock mr-1 text-[10px]"></i>${this.formatearFechaHora(valor)}</span>`;
    }

    renderBarra(valor, tab, campo) {
        const numero = Number(valor) || 0;
        const maximo = Number(this.maxValues[tab] && this.maxValues[tab][campo]) || 0;
        const porcentaje = maximo > 0 ? Math.max(4, Math.round((numero / maximo) * 100)) : 4;

        return `
            <div class="barra-dato">
                <span class="barra-dato__relleno" style="width: ${porcentaje}%"></span>
                <span class="barra-dato__valor">${this.formatearNumero(numero)}</span>
            </div>
        `;
    }

    obtenerIniciales(nombre) {
        const texto = String(nombre || '').trim();

        if (!texto) {
            return '?';
        }

        const partes = texto.split(/\s+/).filter(Boolean);

        if (partes.length === 1) {
            return partes[0].slice(0, 2).toUpperCase();
        }

        return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
    }

    actualizarContadorTab(tab, total) {
        const ids = {
            modulos: 'contadorTabModulos',
            usuarios: 'contadorTabUsuarios',
            inactivos: 'contadorTabInactivos'
        };

        if (ids[tab]) {
            this.setTexto(ids[tab], this.formatearNumero(total || 0));
        }
    }

    activarTab(tab) {
        if (!['modulos', 'usuarios', 'inactivos'].includes(tab)) {
            return;
        }

        clearTimeout(this.busquedaDebounce);
        this.tabActiva = tab;

        document.querySelectorAll('#tabsDetalle [data-tab]').forEach(boton => {
            const activo = boton.dataset.tab === tab;

            boton.setAttribute('aria-selected', activo ? 'true' : 'false');
            boton.classList.toggle('border-blue-600', activo);
            boton.classList.toggle('text-slate-900', activo);
            boton.classList.toggle('border-transparent', !activo);
            boton.classList.toggle('text-slate-500', !activo);
            boton.classList.toggle('hover:text-slate-700', !activo);

            const badge = boton.querySelector('span');

            if (badge) {
                badge.classList.toggle('bg-blue-50', activo);
                badge.classList.toggle('text-blue-700', activo);
                badge.classList.toggle('bg-slate-100', !activo);
                badge.classList.toggle('text-slate-500', !activo);
            }
        });

        document.getElementById('panelModulos')?.classList.toggle('hidden', tab !== 'modulos');
        document.getElementById('panelUsuarios')?.classList.toggle('hidden', tab !== 'usuarios');
        document.getElementById('panelInactivos')?.classList.toggle('hidden', tab !== 'inactivos');

        const inputBuscar = document.getElementById('inputBuscarTabla');
        if (inputBuscar) {
            inputBuscar.value = '';
            inputBuscar.placeholder = this.placeholderBusqueda(tab);
        }

        this.configurarOpcionesOrden(tab);

        if (!this.tablas[tab]) {
            this.inicializarTabla(tab);
        } else {
            this.tablas[tab]
                .search('')
                .order(this.ordenPorDefecto(tab))
                .page(0)
                .columns.adjust()
                .draw(false);
        }
    }

    configurarOpcionesOrden(tab) {
        const opciones = {
            modulos: [
                { value: '1:desc', label: 'Consultas ↓' },
                { value: '2:desc', label: 'Usuarios ↓' },
                { value: '0:asc', label: 'Módulo A-Z' },
                { value: '3:desc', label: 'Último acceso ↓' }
            ],
            usuarios: [
                { value: '3:desc', label: 'Consultas ↓' },
                { value: '2:desc', label: 'Ingresos ↓' },
                { value: '4:desc', label: 'Módulos ↓' },
                { value: '0:asc', label: 'Usuario A-Z' },
                { value: '5:desc', label: 'Último acceso ↓' }
            ],
            inactivos: [
                { value: '1:asc', label: 'Nombre A-Z' },
                { value: '0:asc', label: 'Usuario A-Z' },
                { value: '2:asc', label: 'Rol A-Z' }
            ]
        };

        const select = document.getElementById('selectOrdenTabla');

        if (!select || !opciones[tab]) {
            return;
        }

        select.innerHTML = opciones[tab]
            .map(opcion => `<option value="${opcion.value}">${opcion.label}</option>`)
            .join('');
        select.value = opciones[tab][0].value;
    }

    ordenPorDefecto(tab) {
        return {
            modulos: [[1, 'desc']],
            usuarios: [[3, 'desc']],
            inactivos: [[1, 'asc']]
        }[tab] || [[0, 'asc']];
    }

    placeholderBusqueda(tab) {
        return {
            modulos: 'Buscar módulo o categoría...',
            usuarios: 'Buscar usuario o rol...',
            inactivos: 'Buscar usuario, nombre o rol...'
        }[tab] || 'Buscar...';
    }

    setTexto(id, texto) {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = texto;
        }
    }

    formatearNumero(valor) {
        const numero = Number(valor || 0);
        return isNaN(numero) ? '0' : numero.toLocaleString('es-PE');
    }

    formatearFechaCorta(fecha) {
        if (!fecha) return '—';

        const valor = new Date(`${fecha}T00:00:00`);
        if (isNaN(valor.getTime())) return fecha;

        return valor.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatearDiaCorto(dia) {
        if (!dia) return '';

        const valor = new Date(`${dia}T00:00:00`);
        if (isNaN(valor.getTime())) return dia;

        return valor.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit'
        });
    }

    formatearFechaTooltip(dia) {
        if (!dia) return '';

        const valor = new Date(`${dia}T00:00:00`);
        if (isNaN(valor.getTime())) return dia;

        return valor.toLocaleDateString('es-PE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    formatearFechaHora(valor) {
        if (!valor) return '—';

        const fecha = new Date(String(valor).replace(' ', 'T'));
        if (isNaN(fecha.getTime())) return '—';

        return fecha.toLocaleString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    truncar(texto, maximo) {
        const valor = String(texto || '');
        return valor.length > maximo ? `${valor.slice(0, maximo - 1)}…` : valor;
    }

    escaparHtml(valor) {
        return String(valor || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

window.metricasUsoController = new MetricasUsoController();

document.addEventListener('DOMContentLoaded', () => {
    window.metricasUsoController.init();
});
