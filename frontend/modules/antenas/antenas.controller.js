class AntenasController {
    constructor() {
        this.service = new AntenasService();
        this.cargando = false;
        this.datos = null;
        this.pageSizeDias = 7;
        this.page = 1;
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupPeriodo();
        this.setupListeners();

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Conectividad Antenas',
                subtitulo: 'Inicializando período y matriz...'
            });
        }

        try {
            await this.cargarDashboard();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    cachearElementos() {
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.contenedorInputsPeriodo = document.getElementById('contenedor-inputs-periodo');
        this.contenedorGraficos = document.getElementById('contenedor-antenas');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.mensajeError = document.getElementById('mensaje-error');
    }

    setupPeriodo() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }
    }

    setupListeners() {
        this.btnCargar?.addEventListener('click', () => this.cargarDashboard(1));
        this.btnLimpiar?.addEventListener('click', () => this.limpiarFiltros());

        this.selectTipoPeriodo?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', event => {
            const contenedor = document.getElementById('contenedor-filtros-contenido');
            const label = document.getElementById('label-toggle-filtros');
            const icon = document.getElementById('icon-toggle-filtros');
            if (!contenedor) return;

            const oculto = contenedor.classList.toggle('hidden');
            event.currentTarget.setAttribute('aria-expanded', String(!oculto));
            if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
            if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    async cargarDashboard(page = 1) {
        if (this.cargando) return;

        this.limpiarError();

        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : {};

        if (!rango.fechaInicio || !rango.fechaFin) {
            this.mostrarError('Seleccione un rango de fechas válido.');
            return;
        }

        this.cargando = true;
        this.page = Math.max(1, Number(page) || 1);

        if (this.btnCargar && typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton(this.btnCargar, { texto: 'Cargando...' });
        }

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarEnContenedor('contenedor-antenas', {
                titulo: 'Consultando Conectividad Antenas...',
                subtitulo: 'Obteniendo estados de conexión por hora'
            });
        }

        try {
            const respuesta = await this.service.obtenerDashboard({
                fecha_inicio: rango.fechaInicio,
                fecha_fin: rango.fechaFin,
                page: this.page,
                page_size_dias: this.pageSizeDias
            });

            if (!respuesta.success) {
                throw new Error(respuesta.message || 'No se pudo cargar el dashboard.');
            }

            this.datos = respuesta.payload;
            this.page = Number(this.datos?.page || this.page);

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-antenas');
            }

            const chart = window.ChartRegistry?.['ConectividadAntenas'];
            if (!chart || typeof chart.render !== 'function') {
                throw new Error('No se encontró el componente ConectividadAntenas.');
            }

            chart.render(this, this.datos, this.contenedorGraficos);
        } catch (error) {
            this.mostrarError(error.message || 'No se pudo cargar el dashboard.');
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-antenas', {
                    mensaje: 'No se pudo cargar el dashboard.',
                    detalle: error.message || 'Intente nuevamente.'
                });
            }
        } finally {
            this.cargando = false;
            if (this.btnCargar && typeof LoadingHelper !== 'undefined') {
                LoadingHelper.restaurarBoton(this.btnCargar);
            }
        }
    }

    async cambiarPagina(page) {
        if (this.cargando) return;

        const actual = Number(this.datos?.page || 1);
        const destino = Math.max(1, Number(page) || 1);
        if (destino === actual) return;

        await this.cargarDashboard(destino);
    }

    limpiarFiltros() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        this.page = 1;
        this.cargarDashboard(1);
    }

    mostrarError(mensaje) {
        if (!this.mensajeError) return;
        this.mensajeError.textContent = mensaje;
        this.mensajeError.classList.remove('hidden');
    }

    limpiarError() {
        if (!this.mensajeError) return;
        this.mensajeError.textContent = '';
        this.mensajeError.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.antenasController = new AntenasController();
});
