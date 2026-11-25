class AntenasController {
    constructor() {
        this.service = new AntenasService();
        this.cargando = false;
        this.datos = null;
        this.pageSizeDias = 7;
        this.page = 1;
        this.filtrosVista = {
            granja: '',
            antena: '',
            estado: 'todos',
            busqueda: ''
        };
        this._busquedaTimer = null;
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
        this.selectFiltroGranja = document.getElementById('select-filtro-granja');
        this.selectFiltroAntena = document.getElementById('select-filtro-antena');
        this.selectFiltroEstado = document.getElementById('select-filtro-estado');
        this.inputBusquedaAntena = document.getElementById('input-busqueda-antena');
        this.btnLimpiarVista = document.getElementById('btn-limpiar-vista');
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

        this.selectFiltroGranja?.addEventListener('change', event => {
            this.filtrosVista.granja = event.target.value || '';
            this.filtrosVista.antena = '';
            this._poblarFiltroAntenas();
            this._actualizarVista();
        });

        this.selectFiltroAntena?.addEventListener('change', event => {
            this.filtrosVista.antena = event.target.value || '';
            this._actualizarVista();
        });

        this.selectFiltroEstado?.addEventListener('change', event => {
            this.filtrosVista.estado = event.target.value || 'todos';
            this._actualizarVista();
        });

        this.inputBusquedaAntena?.addEventListener('input', event => {
            this.filtrosVista.busqueda = event.target.value || '';
            clearTimeout(this._busquedaTimer);
            this._busquedaTimer = setTimeout(() => this._actualizarVista(), 200);
        });

        this.btnLimpiarVista?.addEventListener('click', () => {
            clearTimeout(this._busquedaTimer);
            this._resetFiltrosVista();
            this._poblarFiltroAntenas();
            this._actualizarVista();
        });

        this._bindVistaEvents();
    }

    _bindVistaEvents() {
        if (this._vistaBound || !this.contenedorGraficos) return;
        this._vistaBound = true;

        this.contenedorGraficos.addEventListener('click', event => {
            const boton = event.target.closest?.('[data-antenas-solo-fallas]');
            if (!boton) return;

            this.filtrosVista.estado = 'fallas';
            if (this.selectFiltroEstado) this.selectFiltroEstado.value = 'fallas';
            this._actualizarVista();
        });
    }

    _resetFiltrosVista() {
        this.filtrosVista = {
            granja: '',
            antena: '',
            estado: 'todos',
            busqueda: ''
        };

        if (this.selectFiltroGranja) this.selectFiltroGranja.value = '';
        if (this.selectFiltroAntena) this.selectFiltroAntena.value = '';
        if (this.selectFiltroEstado) this.selectFiltroEstado.value = 'todos';
        if (this.inputBusquedaAntena) this.inputBusquedaAntena.value = '';
    }

    _valoresUnicos(campo) {
        const valores = [];
        const vistos = new Set();

        (this.datos?.filas || []).forEach(fila => {
            const valor = fila?.[campo];
            if (!valor || vistos.has(valor)) return;
            vistos.add(valor);
            valores.push(valor);
        });

        return valores;
    }

    _llenarSelect(select, opciones, valorActual, textoInicial) {
        if (!select) return;

        select.innerHTML = '';
        select.add(new Option(textoInicial, ''));
        opciones.forEach(opcion => select.add(new Option(opcion, opcion)));
        select.value = opciones.includes(valorActual) ? valorActual : '';
    }

    _poblarFiltroGranjas() {
        const granjas = this._valoresUnicos('granja');
        const actual = granjas.includes(this.filtrosVista.granja) ? this.filtrosVista.granja : '';
        this.filtrosVista.granja = actual;
        this._llenarSelect(this.selectFiltroGranja, granjas, actual, 'Todas las granjas');
    }

    _poblarFiltroAntenas() {
        const granja = this.filtrosVista.granja;
        const filas = (this.datos?.filas || []).filter(fila => !granja || fila.granja === granja);
        const antenas = [];
        const vistos = new Set();

        filas.forEach(fila => {
            if (!fila.antena || vistos.has(fila.antena)) return;
            vistos.add(fila.antena);
            antenas.push(fila.antena);
        });

        const actual = antenas.includes(this.filtrosVista.antena) ? this.filtrosVista.antena : '';
        this.filtrosVista.antena = actual;
        this._llenarSelect(this.selectFiltroAntena, antenas, actual, 'Todas las antenas');
    }

    _actualizarOpcionesFiltros() {
        this._poblarFiltroGranjas();
        this._poblarFiltroAntenas();

        if (this.selectFiltroEstado) {
            this.selectFiltroEstado.value = this.filtrosVista.estado;
        }

        if (this.inputBusquedaAntena) {
            this.inputBusquedaAntena.value = this.filtrosVista.busqueda;
        }
    }

    _actualizarVista() {
        const chart = window.ChartRegistry?.['ConectividadAntenas'];
        if (!chart || typeof chart.render !== 'function' || !this.datos) return;
        chart.render(this, this.datos, this.contenedorGraficos);
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
            this._actualizarOpcionesFiltros();

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

        clearTimeout(this._busquedaTimer);
        this._resetFiltrosVista();
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
