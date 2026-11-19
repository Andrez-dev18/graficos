/**
 * Controlador del módulo Control de Jabas.
 * Dashboard inicial: DashJabasCont
 */
class ControlJabasController {
    constructor() {
        this.service = new ControlJabasService();
        this.chartTipoActual = 'DashJabasCont';
        this.datosDashboard = null;
        this.filtrosIniciales = null;
        this.cargando = false;
        this._cargaToken = 0;
        this._recargaPendiente = false;
        this.multiAlmacen = null;
        this.searchCliente = null;
        this.searchTipoCliente = null;
        this.clientesKardex = [];
        this.clientesKey = '';
        this.clienteTocado = false;
        this.filtrosStockKey = '';
        this.filtrosPorGrafico = {
            DashJabasCont: { cliente: false },
            DashJabasPro: { cliente: false },
            KardexClienteCont: { cliente: true },
            KardexClientePro: { cliente: true },
            StockProvincias: { cliente: true, tipocliente: true, fechaUnica: true },
            GraficoIndicadores: { cliente: true, tipocliente: true }
        };
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupPeriodo();
        this.setupMultiAlmacen();
        this.setupBuscadorCliente();
        this.setupBuscadorTipoCliente();
        this.setupListeners();
        this.actualizarVisibilidadFiltros();

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Control de Jabas',
                subtitulo: 'Obteniendo configuración y stock...'
            });
        }

        try {
            await this.cargarFiltrosIniciales();
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
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.contenedorGraficos = document.getElementById('contenedor-graficos-lista');
        this.chipFiltro = document.getElementById('chip-filtro-activo');
        this.chipFiltroTexto = document.getElementById('chip-filtro-texto');
        this.mensajeError = document.getElementById('mensaje-error');
        this.wrapperFiltroCliente = document.getElementById('wrapper-filtro-cliente');
        this.contenedorSearchCliente = document.getElementById('searchable-filtro-cliente');
        this.wrapperFiltroTipoCliente = document.getElementById('wrapper-filtro-tipocliente');
        this.contenedorSearchTipoCliente = document.getElementById('searchable-filtro-tipocliente');
        this.wrapperFiltroPeriodo = document.getElementById('wrapper-filtro-periodo');
    }

    setupPeriodo() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_meses';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }
    }

    setupMultiAlmacen() {
        if (typeof CustomMultiSelect === 'undefined') return;

        this.multiAlmacen = new CustomMultiSelect({
            btnId: 'btn-dropdown-almacen',
            labelId: 'label-almacen',
            dropdownId: 'dropdown-almacen',
            searchId: 'search-almacen',
            optionsContainerId: 'container-options-almacen',
            title: 'ALMACÉN',
            options: [
                { id: 'JAB', label: 'JAB', selected: true },
                { id: 'JAG', label: 'JAG', selected: false },
                { id: 'TNB', label: 'TNB', selected: false }
            ]
        });
    }

    setupBuscadorCliente() {
        if (typeof SearchableSelect === 'undefined' || !this.contenedorSearchCliente) return;

        this.searchCliente = new SearchableSelect({
            containerId: 'searchable-filtro-cliente',
            title: 'Cliente',
            placeholder: '(Todo)',
            options: [],
            onChange: () => {
                this.clienteTocado = true;
            }
        });
    }

    setupBuscadorTipoCliente() {
        if (typeof SearchableSelect === 'undefined' || !this.contenedorSearchTipoCliente) return;

        this.searchTipoCliente = new SearchableSelect({
            containerId: 'searchable-filtro-tipocliente',
            title: 'Tipo de cliente',
            placeholder: '(Todo)',
            options: []
        });
    }

    actualizarVisibilidadFiltros() {
        const config = this.filtrosPorGrafico[this.chartTipoActual] || {};
        this.wrapperFiltroCliente?.classList.toggle('hidden', !config.cliente);
        this.wrapperFiltroTipoCliente?.classList.toggle('hidden', !config.tipocliente);
        this.wrapperFiltroPeriodo?.classList.toggle('hidden', !!config.fechaUnica);
    }

    esKardex() {
        return this.chartTipoActual === 'KardexClienteCont'
            || this.chartTipoActual === 'KardexClientePro';
    }

    claveFiltrosClientes() {
        const rango = this.obtenerRango();
        const almacenes = this.multiAlmacen ? this.multiAlmacen.getSelectedValues() : ['JAB'];
        return [this.chartTipoActual, rango.fechaInicio, rango.fechaFin, almacenes.slice().sort().join('|')].join('::');
    }

    async cargarClientesKardex(force = false) {
        if (!this.searchCliente) return true;

        const rango = this.obtenerRango();
        if (!rango.fechaInicio || !rango.fechaFin) return false;

        const almacenes = this.multiAlmacen ? this.multiAlmacen.getSelectedValues() : ['JAB'];
        const key = this.claveFiltrosClientes();

        if (!force && this.clientesKey === key && this.clientesKardex.length) {
            return true;
        }

        try {
            const respuesta = await this.service.obtenerClientes({
                tipo_grafico: this.chartTipoActual,
                fecha_inicio: rango.fechaInicio,
                fecha_fin: rango.fechaFin,
                codalmacenes: almacenes
            });

            if (!respuesta.success) {
                this.mostrarError(respuesta.message || 'No se pudieron obtener los clientes.');
                return false;
            }

            const payload = respuesta.payload || {};
            const clientes = Array.isArray(payload.clientes) ? payload.clientes : [];
            this.clientesKardex = clientes;
            this.clientesKey = key;

            this.searchCliente.setOptions(clientes);

            const valorActual = this.searchCliente.getValue();
            const valorValido = valorActual && clientes.includes(valorActual);

            if (!valorValido && valorActual !== '') {
                this.clienteTocado = false;
            }

            if (!this.clienteTocado && (!valorActual || !valorValido)) {
                const defecto = payload.cliente_defecto || clientes[0] || '';
                this.searchCliente.setValue(defecto, false);
            }

            return true;
        } catch (error) {
            console.error('Error al cargar clientes del Kardex:', error);
            this.mostrarError('No se pudieron obtener los clientes del Kardex.');
            return false;
        }
    }

    async prepararClienteKardex() {
        if (!this.searchCliente) return false;

        const cargado = await this.cargarClientesKardex();
        if (!cargado) return false;

        const cliente = this.searchCliente.getValue();
        if (!cliente) {
            this.mostrarError('Seleccione un cliente para visualizar el Kardex.');
            return false;
        }

        return true;
    }

    esStockProvincias() {
        return this.chartTipoActual === 'StockProvincias';
    }

    esGraficoIndicadores() {
        return this.chartTipoActual === 'GraficoIndicadores';
    }

    actualizarOpcionesGraficoIndicadores(opciones = {}) {
        const tipoclientes = Array.isArray(opciones.tipoclientes) ? opciones.tipoclientes : [];
        const clientes = Array.isArray(opciones.clientes) ? opciones.clientes : [];

        this.searchTipoCliente?.setOptions(tipoclientes);
        this.searchCliente?.setOptions(clientes);

        if (this.searchTipoCliente && !tipoclientes.includes(this.searchTipoCliente.getValue())) {
            this.searchTipoCliente.setValue('', false);
        }
        if (this.searchCliente && !clientes.includes(this.searchCliente.getValue())) {
            this.searchCliente.setValue('', false);
        }
    }

    async prepararFiltrosStockProvincias(force = false) {
        const rango = this.obtenerRango();
        if (!rango.fechaInicio || !rango.fechaFin) return false;

        const almacenes = this.multiAlmacen ? this.multiAlmacen.getSelectedValues() : ['JAB'];
        const key = [rango.fechaInicio, almacenes.slice().sort().join('|')].join('::');

        if (!force && this.filtrosStockKey === key) return true;

        const respuesta = await this.service.obtenerStockProvinciasFiltros({
            fecha: rango.fechaInicio,
            codalmacenes: almacenes
        });

        if (!respuesta.success) {
            this.mostrarError(respuesta.message || 'No se pudieron obtener los filtros de provincias.');
            return false;
        }

        const payload = respuesta.payload || {};
        const tipoclientes = Array.isArray(payload.tipoclientes) ? payload.tipoclientes : [];
        const clientes = Array.isArray(payload.clientes) ? payload.clientes : [];
        this.filtrosStockKey = key;

        this.searchTipoCliente?.setOptions(tipoclientes);
        this.searchCliente?.setOptions(clientes);

        if (this.searchTipoCliente && !tipoclientes.includes(this.searchTipoCliente.getValue())) {
            this.searchTipoCliente.setValue('', false);
        }
        if (this.searchCliente && !clientes.includes(this.searchCliente.getValue())) {
            this.searchCliente.setValue('', false);
        }

        return true;
    }

    async cargarDetalleStockProvincias(seleccion = []) {
        if (!this.esStockProvincias() || !Array.isArray(seleccion) || !seleccion.length) {
            window.ChartRegistry?.StockProvincias?.actualizarDetalle?.([]);
            return;
        }

        const rango = this.obtenerRango();
        const almacenes = this.multiAlmacen ? this.multiAlmacen.getSelectedValues() : ['JAB'];

        const respuesta = await this.service.obtenerStockProvinciasDetalle({
            fecha: rango.fechaInicio,
            codalmacenes: almacenes,
            tipocliente: this.searchTipoCliente?.getValue() || '',
            nomcliente: this.searchCliente?.getValue() || '',
            seleccion
        });

        if (!respuesta.success) {
            this.mostrarError(respuesta.message || 'No se pudo cargar el detalle.');
            window.ChartRegistry?.StockProvincias?.actualizarDetalle?.([]);
            return;
        }

        window.ChartRegistry?.StockProvincias?.actualizarDetalle?.(
            respuesta.payload?.filas || []
        );
    }

    setupListeners() {
        this.selectTipoPeriodo?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        this.selectTipoGrafico?.addEventListener('change', () => {
            const tipoAnterior = this.chartTipoActual;
            const tipoNuevo = this.selectTipoGrafico.value || 'DashJabasCont';

            window.ChartRegistry?.[tipoAnterior]?.destroy?.();

            this.chartTipoActual = tipoNuevo;
            this._cargaToken += 1;

            if (this.contenedorGraficos) {
                this.contenedorGraficos.innerHTML = '';
            }

            if (this.esStockProvincias()) {
                this.clienteTocado = false;
                this.searchCliente?.setValue('', false);
                this.searchTipoCliente?.setValue('', false);
                this.filtrosStockKey = '';
            } else if (this.esGraficoIndicadores()) {
                this.clienteTocado = false;
                this.searchCliente?.setValue('', false);
                this.searchTipoCliente?.setValue('', false);
            }

            this.actualizarVisibilidadFiltros();

            if (this.cargando) {
                this._recargaPendiente = true;
                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.mostrarEnContenedor('contenedor-graficos-lista', {
                        titulo: 'Consultando Control de Jabas...',
                        subtitulo: 'Obteniendo stock contable y evolución diaria'
                    });
                }
                return;
            }

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
            const componente = window.ChartRegistry?.[this.chartTipoActual];
            if (componente && typeof componente.limpiarSeleccion === 'function') {
                componente.limpiarSeleccion();
            }
            this.actualizarChipFiltro();
        });
    }

    async cargarFiltrosIniciales() {
        const respuesta = await this.service.obtenerFiltros();
        if (!respuesta.success) {
            this.mostrarError(respuesta.message || 'No se pudieron obtener los filtros.');
            return;
        }

        this.filtrosIniciales = respuesta.data || {};
    }

    obtenerRango() {
        const tipo = this.selectTipoPeriodo?.value;

        if (tipo === 'por_fecha') {
            const fecha = document.getElementById('input-fecha-unica')?.value || '';
            return { fechaInicio: fecha, fechaFin: fecha };
        }

        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
            return PeriodoHelper.obtenerRangoFechas() || {};
        }
        return { fechaInicio: '', fechaFin: '' };
    }

    async onCargarClick() {
        if (this.cargando) {
            this._recargaPendiente = true;
            return;
        }

        this._recargaPendiente = false;
        const token = ++this._cargaToken;
        const tipoSolicitado = this.chartTipoActual;
        const esKardex = tipoSolicitado === 'KardexClienteCont' || tipoSolicitado === 'KardexClientePro';
        const esStockProvincias = tipoSolicitado === 'StockProvincias';
        const esGraficoIndicadores = tipoSolicitado === 'GraficoIndicadores';

        this.limpiarError();

        const almacenes = this.multiAlmacen ? this.multiAlmacen.getSelectedValues() : ['JAB'];
        if (!almacenes.length) {
            this.mostrarError('Seleccione al menos un almacén.');
            return;
        }

        const rango = this.obtenerRango();
        if (!rango.fechaInicio || !rango.fechaFin) {
            this.mostrarError('Seleccione una fecha válida.');
            return;
        }

        if (esKardex) {
            const clienteListo = await this.prepararClienteKardex();
            if (!clienteListo) return;
        } else if (esStockProvincias) {
            const filtrosListos = await this.prepararFiltrosStockProvincias();
            if (!filtrosListos) return;
        }

        if (token !== this._cargaToken || tipoSolicitado !== this.chartTipoActual) {
            return;
        }

        this.cargando = true;

        if (this.btnCargar && typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton(this.btnCargar, { texto: 'Cargando...' });
        }
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarEnContenedor('contenedor-graficos-lista', {
                titulo: 'Consultando Control de Jabas...',
                subtitulo: 'Obteniendo stock contable y evolución diaria'
            });
        }

        try {
            const payload = {
                tipo_grafico: tipoSolicitado,
                fecha_inicio: rango.fechaInicio,
                fecha_fin: rango.fechaFin,
                codalmacenes: almacenes
            };

            if (esKardex || esGraficoIndicadores) {
                payload.nomcliente = this.searchCliente?.getValue() || '';
            }

            if (esGraficoIndicadores) {
                payload.tipocliente = this.searchTipoCliente?.getValue() || '';
            }

            let respuesta;
            if (esStockProvincias) {
                payload.fecha = rango.fechaInicio;
                payload.tipocliente = this.searchTipoCliente?.getValue() || '';
                payload.nomcliente = this.searchCliente?.getValue() || '';
                respuesta = await this.service.obtenerStockProvincias(payload);
            } else {
                respuesta = await this.service.obtenerDashboard(payload);
            }

            if (token !== this._cargaToken || tipoSolicitado !== this.chartTipoActual) {
                return;
            }

            if (!respuesta.success) {
                this.mostrarError(respuesta.message || 'No se pudo cargar la información.');
                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.mostrarError('contenedor-graficos-lista', {
                        mensaje: 'No se pudo cargar Control de Jabas.',
                        detalle: respuesta.message || 'Intente nuevamente.'
                    });
                }
                return;
            }

            this.datosDashboard = respuesta.payload || {};

            if (esGraficoIndicadores) {
                this.actualizarOpcionesGraficoIndicadores(this.datosDashboard.opciones || {});
            }

            const componente = window.ChartRegistry?.[tipoSolicitado];
            if (!componente || typeof componente.render !== 'function') {
                throw new Error(`No se encontró el componente ${tipoSolicitado}.`);
            }

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-graficos-lista');
            }

            componente.render(this, this.datosDashboard, this.contenedorGraficos);
            this.actualizarChipFiltro();
        } catch (error) {
            console.error('Error al cargar Control de Jabas:', error);
            this.mostrarError(error.message || 'No se pudo cargar la información.');
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-graficos-lista', {
                    mensaje: 'Ocurrió un error al cargar Control de Jabas.',
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

            if (this._recargaPendiente) {
                this._recargaPendiente = false;
                this.onCargarClick();
            }
        }
    }

    limpiarFiltros() {
        this.selectTipoPeriodo.value = 'entre_meses';
        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        if (this.multiAlmacen) {
            this.multiAlmacen.setSelectedValues(['JAB'], false);
            this.multiAlmacen.updateLabel(false);
            this.multiAlmacen.render();
        }

        if (this.searchCliente) {
            this.clienteTocado = false;
            this.clientesKey = '';
            this.searchCliente.setValue('', false);
        }

        if (this.searchTipoCliente) {
            this.searchTipoCliente.setValue('', false);
        }

        this.filtrosStockKey = '';
        this.actualizarVisibilidadFiltros();
        this.limpiarError();
        this.onCargarClick();
    }

    actualizarChipFiltro() {
        if (!this.chipFiltro || !this.chipFiltroTexto) return;

        const componente = window.ChartRegistry?.[this.chartTipoActual];
        const tieneSeleccion = componente && typeof componente.tieneSeleccion === 'function'
            ? componente.tieneSeleccion()
            : false;

        if (!tieneSeleccion) {
            this.chipFiltro.classList.add('hidden');
            return;
        }

        this.chipFiltroTexto.textContent = componente.resumenSeleccion
            ? componente.resumenSeleccion()
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
    window.controlJabasController = new ControlJabasController();
});
