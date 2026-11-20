/**
 * Controlador del módulo Eventos Merma.
 */
class EventosMermaController {
    constructor() {
        this.service = new EventosMermaService();
        this.chartTipoActual = 'DashAnalisis';
        this.datosDashboard = null;
        this.cargando = false;
        this.cargandoListado = false;
        this._listadoPendiente = null;
        this._listadoSeq = 0;
        this._filtrosPayload = {};
        this.multiArea = null;
        this.multiCliente = null;
        this.searchProceso = null;
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupPeriodo();
        this.setupFiltros();
        this.setupListeners();
        this.actualizarChipFiltro();

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Análisis Eventos Mermas',
                subtitulo: 'Inicializando filtros y periodos...'
            });
        }

        try {
            await this.cargarFiltros();
            await this.onCargarClick();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.contenedorInputsPeriodo = document.getElementById('contenedor-inputs-periodo');
        this.contenedorGraficos = document.getElementById('contenedor-graficos-lista');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.chipFiltro = document.getElementById('chip-filtro-activo');
        this.chipFiltroTexto = document.getElementById('chip-filtro-texto');
        this.mensajeError = document.getElementById('mensaje-error');
    }

    setupPeriodo() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_meses';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }
    }

    setupFiltros() {
        if (typeof SearchableSelect !== 'undefined') {
            this.searchProceso = new SearchableSelect({
                containerId: 'searchable-filtro-proceso',
                title: 'Proceso',
                placeholder: '(Todo)',
                options: []
            });
        }

        if (typeof CustomMultiSelect !== 'undefined') {
            this.multiArea = new CustomMultiSelect({
                btnId: 'btn-dropdown-area',
                labelId: 'label-area',
                dropdownId: 'dropdown-area',
                searchId: 'search-area',
                optionsContainerId: 'container-options-area',
                title: 'ÁREA',
                options: []
            });

            this.multiCliente = new CustomMultiSelect({
                btnId: 'btn-dropdown-cliente',
                labelId: 'label-cliente',
                dropdownId: 'dropdown-cliente',
                searchId: 'search-cliente',
                optionsContainerId: 'container-options-cliente',
                title: 'CLIENTE',
                options: []
            });
        }
    }

    setupListeners() {
        this.selectTipoPeriodo?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        this.selectTipoGrafico?.addEventListener('change', () => {
            this.chartTipoActual = this.selectTipoGrafico.value || 'DashAnalisis';
            this.onCargarClick();
        });

        this.btnCargar?.addEventListener('click', () => this.onCargarClick());
        this.btnLimpiar?.addEventListener('click', () => this.limpiarFiltros());

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            const contenedor = document.getElementById('contenedor-filtros-contenido');
            const label = document.getElementById('label-toggle-filtros');
            const icon = document.getElementById('icon-toggle-filtros');
            if (!contenedor) return;

            const oculto = contenedor.classList.toggle('hidden');
            if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
            if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        document.getElementById('btn-quitar-filtro')?.addEventListener('click', () => {
            const chart = window.ChartRegistry?.[this.chartTipoActual];
            if (chart && typeof chart.limpiarSeleccion === 'function') {
                chart.limpiarSeleccion();
            }
        });
    }

    async cargarFiltros() {
        const respuesta = await this.service.obtenerFiltros();
        if (!respuesta.success) {
            this.mostrarError(respuesta.message || 'No se pudieron obtener los filtros.');
            return;
        }

        const opciones = respuesta.payload || {};
        const procesos = Array.isArray(opciones.procesos) ? opciones.procesos : [];
        const areas = Array.isArray(opciones.areas) ? opciones.areas : [];
        const clientes = Array.isArray(opciones.clientes) ? opciones.clientes : [];

        this.searchProceso?.setOptions(procesos);
        this.searchProceso?.setValue('', false);

        this.multiArea?.setOptions(areas.map(valor => ({ id: valor, label: valor })), false);
        this.multiArea?.setSelectedValues(areas, false);

        this.multiCliente?.setOptions(clientes.map(valor => ({ id: valor, label: valor })), false);
        this.multiCliente?.setSelectedValues(clientes, false);
    }

    obtenerPayloadBase() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : {};

        return {
            fecha_inicio: rango.fechaInicio || '',
            fecha_fin: rango.fechaFin || '',
            proceso: this.searchProceso?.getValue() || '',
            areas: this.multiArea?.getSelectedValues() || [],
            clientes: this.multiCliente?.getSelectedValues() || []
        };
    }

    async onCargarClick() {
        if (this.cargando) return;

        this.limpiarError();
        const payload = this.obtenerPayloadBase();

        if (!payload.fecha_inicio || !payload.fecha_fin) {
            this.mostrarError('Seleccione un período válido.');
            return;
        }

        this._filtrosPayload = payload;
        this._listadoPendiente = null;
        this._listadoSeq += 1;
        this.cargando = true;

        if (this.btnCargar && typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton(this.btnCargar, { texto: 'Cargando...' });
        }
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarEnContenedor('contenedor-graficos-lista', {
                titulo: 'Consultando Eventos Merma...',
                subtitulo: 'Obteniendo datos de eventos merma'
            });
        }

        try {
            const esListado = this.chartTipoActual === 'Listado';
            const esPorc = this.chartTipoActual === 'Porc';
            const esPorcDia = this.chartTipoActual === 'PorcDia';
            const esCantDia = this.chartTipoActual === 'CantDia';
            const esPareto = this.chartTipoActual === 'Pareto';
            let respuesta;

            if (esListado) {
                respuesta = await this.service.obtenerListado({
                    ...payload,
                    tipo_grafico: this.chartTipoActual,
                    page: 1,
                    page_size: 50
                });
            } else if (esPorc) {
                respuesta = await this.service.obtenerPorc({
                    ...payload,
                    tipo_grafico: this.chartTipoActual
                });
            } else if (esPorcDia) {
                respuesta = await this.service.obtenerPorcDia({
                    ...payload,
                    tipo_grafico: this.chartTipoActual
                });
            } else if (esCantDia) {
                respuesta = await this.service.obtenerCantDia({
                    ...payload,
                    tipo_grafico: this.chartTipoActual
                });
            } else if (esPareto) {
                respuesta = await this.service.obtenerPareto({
                    ...payload,
                    tipo_grafico: this.chartTipoActual
                });
            } else {
                respuesta = await this.service.obtenerDashAnalisis({
                    ...payload,
                    tipo_grafico: this.chartTipoActual,
                    page: 1,
                    page_size: 50
                });
            }

            if (!respuesta.success) {
                this.mostrarError(respuesta.message || 'No se pudo cargar el dashboard.');
                return;
            }

            const payloadRespuesta = respuesta.payload || {};
            this.datosDashboard = esListado
                ? { ...payloadRespuesta, pareto: [], modo_listado: true }
                : payloadRespuesta;

            const componente = window.ChartRegistry?.[this.chartTipoActual];
            if (!componente || typeof componente.render !== 'function') {
                throw new Error(`No se encontró el componente ${this.chartTipoActual}.`);
            }

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-graficos-lista');
            }

            componente.render(this, this.datosDashboard, this.contenedorGraficos);
            this.actualizarChipFiltro();
        } catch (error) {
            console.error('Error al cargar Eventos Merma:', error);
            this.mostrarError(error.message || 'No se pudo cargar el dashboard.');
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-graficos-lista', {
                    mensaje: 'No se pudo cargar Eventos Merma.',
                    detalle: error.message || 'Intente nuevamente.'
                });
            }
        } finally {
            this.cargando = false;
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-graficos-lista');
                if (this.btnCargar) {
                    LoadingHelper.restaurarBoton(this.btnCargar);
                }
            }
        }
    }

    async cargarListado(seleccion = null, page = 1) {
        if (this.cargandoListado) {
            this._listadoPendiente = { seleccion, page };
            return;
        }

        const seq = ++this._listadoSeq;
        this.cargandoListado = true;

        try {
            const respuesta = await this.service.obtenerListado({
                ...this._filtrosPayload,
                tipo_grafico: this.chartTipoActual,
                pareto: seleccion,
                page,
                page_size: 50
            });

            if (seq !== this._listadoSeq) return;

            if (!respuesta.success) {
                this.mostrarError(respuesta.message || 'No se pudo cargar el listado.');
                return;
            }

            const componente = window.ChartRegistry?.[this.chartTipoActual];
            componente?.actualizarListado?.(respuesta.payload?.listado || {});
        } catch (error) {
            console.error('Error al cargar listado de Eventos Merma:', error);
            this.mostrarError('No se pudo cargar el listado de Eventos Merma.');
        } finally {
            this.cargandoListado = false;

            if (this._listadoPendiente) {
                const pendiente = this._listadoPendiente;
                this._listadoPendiente = null;
                this.cargarListado(pendiente.seleccion, pendiente.page);
            }
        }
    }

    limpiarFiltros() {
        this.selectTipoPeriodo.value = 'entre_meses';
        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        this.searchProceso?.setValue('', false);

        if (this.multiArea) {
            this.multiArea.selectAll(false);
            this.multiArea.updateLabel(false);
            this.multiArea.render();
        }

        if (this.multiCliente) {
            this.multiCliente.selectAll(false);
            this.multiCliente.updateLabel(false);
            this.multiCliente.render();
        }

        const chart = window.ChartRegistry?.[this.chartTipoActual];
        chart?.limpiarSeleccion?.(false);
        this.limpiarError();
        this.onCargarClick();
    }

    actualizarChipFiltro() {
        if (!this.chipFiltro || !this.chipFiltroTexto) return;

        const chart = window.ChartRegistry?.[this.chartTipoActual];
        const tieneSeleccion = chart && typeof chart.tieneSeleccion === 'function'
            ? chart.tieneSeleccion()
            : false;

        if (!tieneSeleccion) {
            this.chipFiltro.classList.add('hidden');
            return;
        }

        this.chipFiltroTexto.textContent = typeof chart.resumenSeleccion === 'function'
            ? chart.resumenSeleccion()
            : 'Selección activa';
        this.chipFiltro.classList.remove('hidden');
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
    window.eventosMermaController = new EventosMermaController();
});
