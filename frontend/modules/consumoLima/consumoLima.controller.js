class ConsumoLimaController {
    constructor() {
        this.service = new ConsumoLimaService();
        this.chartTipoActual = 'DashAnalisis';
        this.pageSize = 50;
        this.cargando = false;
        this.cargandoPagina = false;
        this.datos = null;
        this._payloadActual = null;
        this._seleccionesMermas = {
            selecciones_mes_glo: [],
            selecciones_mes_lote: []
        };
        this._seleccionesDocumentos = [];
        this._origenDocumentos = '';
        this._filtroDocumentosToken = 0;
        this._defaults = {
            almacen: 'MA1',
            articulo: 'M0000001',
            transacciones: ['S003', 'S811']
        };
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupPeriodo();
        this.setupFiltros();
        this.setupListeners();

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Consumos Lima',
                subtitulo: 'Inicializando filtros y tablas...'
            });
        }

        try {
            await this.cargarFiltros();
            await this.cargarTodo();
        } catch (error) {
            this.mostrarError(error.message || 'No se pudo inicializar Consumos Lima.');
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
        this.contenedorGraficos = document.getElementById('contenedor-dash-analisis');
        this.contenedorFiltroTransaccion = document.getElementById('contenedor-filtro-transaccion');
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

    setupFiltros() {
        if (typeof CustomMultiSelect !== 'undefined') {
            this.multiAlmacen = new CustomMultiSelect({
                btnId: 'btn-dropdown-almacen',
                labelId: 'label-almacen',
                dropdownId: 'dropdown-almacen',
                searchId: 'search-almacen',
                optionsContainerId: 'container-options-almacen',
                title: 'Almacén',
                options: []
            });

            this.multiArticulo = new CustomMultiSelect({
                btnId: 'btn-dropdown-articulo',
                labelId: 'label-articulo',
                dropdownId: 'dropdown-articulo',
                searchId: 'search-articulo',
                optionsContainerId: 'container-options-articulo',
                title: 'Artículo',
                options: []
            });

            this.multiLote = new CustomMultiSelect({
                btnId: 'btn-dropdown-lote',
                labelId: 'label-lote',
                dropdownId: 'dropdown-lote',
                searchId: 'search-lote',
                optionsContainerId: 'container-options-lote',
                title: 'Lote',
                options: []
            });

            this.multiTransaccion = new CustomMultiSelect({
                btnId: 'btn-dropdown-transaccion',
                labelId: 'label-transaccion',
                dropdownId: 'dropdown-transaccion',
                searchId: 'search-transaccion',
                optionsContainerId: 'container-options-transaccion',
                title: 'Transacción',
                options: []
            });
        }

        this.actualizarFiltroTransaccion();
    }

    actualizarFiltroTransaccion() {
        if (!this.contenedorFiltroTransaccion) return;
        this.contenedorFiltroTransaccion.classList.toggle('hidden', this.chartTipoActual !== 'AnalisisMermas');
    }

    setupListeners() {
        this.btnCargar?.addEventListener('click', () => {
            this.cargarTodo();
        });

        this.btnLimpiar?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        this.selectTipoGrafico?.addEventListener('change', () => {
            this.chartTipoActual = this.selectTipoGrafico.value || 'DashAnalisis';
            this.actualizarFiltroTransaccion();
            this.cargarTodo();
        });

        this.selectTipoPeriodo?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', event => {
            const boton = event.currentTarget;
            const contenedor = document.getElementById('contenedor-filtros-contenido');
            const label = document.getElementById('label-toggle-filtros');
            const icon = document.getElementById('icon-toggle-filtros');
            if (!contenedor) return;

            const oculto = contenedor.classList.toggle('hidden');
            boton.setAttribute('aria-expanded', String(!oculto));
            if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
            if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        this._bindExportEvents();
    }

    _bindExportEvents() {
        if (this._exportBound || !this.contenedorGraficos) return;
        this._exportBound = true;

        this.contenedorGraficos.addEventListener('click', event => {
            const contenedorExport = event.target.closest?.('[data-export-table]');
            if (!contenedorExport) return;

            const tableId = contenedorExport.dataset.exportTable;
            const nombre = contenedorExport.dataset.exportName;
            if (tableId && typeof ExcelExportHelper !== 'undefined') {
                ExcelExportHelper.exportarTabla(tableId, nombre || tableId);
            }
        });
    }

    async cargarFiltros() {
        const respuesta = await this.service.obtenerFiltros();

        if (!respuesta.success) {
            throw new Error(respuesta.message || 'No se pudieron obtener los filtros.');
        }

        const opciones = respuesta.payload || {};
        const almacenes = Array.isArray(opciones.almacenes) ? opciones.almacenes : [];
        const articulos = Array.isArray(opciones.articulos) ? opciones.articulos : [];
        const lotes = Array.isArray(opciones.lotes) ? opciones.lotes : [];
        const transacciones = Array.isArray(opciones.transacciones) ? opciones.transacciones : [];

        this.multiAlmacen?.setOptions(almacenes, false);
        this.multiArticulo?.setOptions(articulos, false);
        this.multiLote?.setOptions(lotes, false);
        this.multiTransaccion?.setOptions(transacciones, false);

        const almacenDefault = almacenes.includes(this._defaults.almacen)
            ? this._defaults.almacen
            : (almacenes[0] || '');
        const articuloDefault = articulos.some(articulo => articulo.id === this._defaults.articulo)
            ? this._defaults.articulo
            : (articulos[0]?.id || '');
        const transaccionesDefault = this._defaults.transacciones.filter(transaccion => transacciones.includes(transaccion));

        this.multiAlmacen?.setSelectedValues(almacenDefault ? [almacenDefault] : [], false);
        this.multiArticulo?.setSelectedValues(articuloDefault ? [articuloDefault] : [], false);
        this.multiTransaccion?.setSelectedValues(
            transaccionesDefault.length ? transaccionesDefault : transacciones,
            false
        );

        this._defaults.almacen = almacenDefault;
        this._defaults.articulo = articuloDefault;
    }

    obtenerSeleccion(componente, nombre) {
        if (!componente) return [];

        const seleccionados = componente.getSelectedValues();
        const total = componente.options.length;

        if (total === 0) return [];

        if (seleccionados.length === 0) {
            throw new Error(`Seleccione al menos un ${nombre}.`);
        }

        if (seleccionados.length === total) {
            return [];
        }

        return seleccionados;
    }

    obtenerPayloadBase() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : {};

        if (!rango.fechaInicio || !rango.fechaFin) {
            throw new Error('Seleccione un rango de fechas válido.');
        }

        return {
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            almacenes: this.obtenerSeleccion(this.multiAlmacen, 'almacén'),
            articulos: this.obtenerSeleccion(this.multiArticulo, 'artículo'),
            lotes: this.obtenerSeleccion(this.multiLote, 'lote'),
            transacciones: this.chartTipoActual === 'AnalisisMermas'
                ? this.obtenerSeleccion(this.multiTransaccion, 'transacción')
                : []
        };
    }

    async cargarTodo() {
        if (this.cargando) return;

        this.limpiarError();

        let payloadBase;
        try {
            payloadBase = this.obtenerPayloadBase();
        } catch (error) {
            this.mostrarError(error.message);
            return;
        }

        this.cargando = true;
        this._payloadActual = payloadBase;
        this._seleccionesMermas = {
            selecciones_mes_glo: [],
            selecciones_mes_lote: []
        };
        this._seleccionesDocumentos = [];
        this._origenDocumentos = '';
        this._filtroDocumentosToken += 1;

        if (this.chartTipoActual === 'AnalisisMermas') {
            const chartMermasAnterior = window.ChartRegistry?.['AnalisisMermas'];
            if (chartMermasAnterior && typeof chartMermasAnterior.limpiarSelecciones === 'function') {
                chartMermasAnterior.limpiarSelecciones(false);
            }
        }

        if (this.btnCargar && typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton(this.btnCargar, { texto: 'Cargando...' });
        }

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarEnContenedor('contenedor-dash-analisis', {
                titulo: 'Consultando Consumos Lima...',
                subtitulo: this.chartTipoActual === 'TabulacionesPU'
                    ? 'Obteniendo tabulaciones de PU'
                    : (this.chartTipoActual === 'AnalisisMermas'
                        ? 'Obteniendo análisis de mermas'
                        : 'Obteniendo consumos, compras y documentos')
            });
        }

        try {
            const payload = {
                ...payloadBase,
                page: 1,
                page_size: this.pageSize
            };

            if (this.chartTipoActual === 'AnalisisMermas') {
                const respuesta = await this.service.obtenerAnalisisMermas(payload);

                if (!respuesta.success) {
                    throw new Error(respuesta.message || 'No se pudo cargar AnalisisMermas.');
                }

                this.datos = respuesta.payload;

                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.ocultarEnContenedor('contenedor-dash-analisis');
                }

                const chartMermas = window.ChartRegistry?.['AnalisisMermas'];
                if (!chartMermas || typeof chartMermas.render !== 'function') {
                    throw new Error('No se encontró el componente AnalisisMermas.');
                }

                chartMermas.render(this, this.datos, this.contenedorGraficos);
                return;
            }

            if (this.chartTipoActual === 'TabulacionesPU') {
                const respuesta = await this.service.obtenerTabulacionesPu(payload);

                if (!respuesta.success) {
                    throw new Error(respuesta.message || 'No se pudo cargar Tabulaciones de PU.');
                }

                this.datos = respuesta.payload;

                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.ocultarEnContenedor('contenedor-dash-analisis');
                }

                const chartTabulaciones = window.ChartRegistry?.['TabulacionesPU'];
                if (!chartTabulaciones || typeof chartTabulaciones.render !== 'function') {
                    throw new Error('No se encontró el componente TabulacionesPU.');
                }

                chartTabulaciones.render(this, this.datos, this.contenedorGraficos);
                return;
            }

            const [consumos, comprasAlmacen, comprasDocumentos] = await Promise.all([
                this.service.obtenerConsumos(payload),
                this.service.obtenerComprasAlmacen(payload),
                this.service.obtenerComprasDocumentos(payload)
            ]);

            const error = [consumos, comprasAlmacen, comprasDocumentos].find(respuesta => !respuesta.success);
            if (error) {
                throw new Error(error.message || 'No se pudieron cargar las tablas.');
            }

            this.datos = {
                consumos: consumos.payload,
                compras_almacen: comprasAlmacen.payload,
                compras_documentos: comprasDocumentos.payload
            };

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-dash-analisis');
            }

            const chart = window.ChartRegistry?.['DashAnalisis'];
            if (!chart || typeof chart.render !== 'function') {
                throw new Error('No se encontró el componente DashAnalisis.');
            }

            chart.render(this, this.datos, this.contenedorGraficos);
        } catch (error) {
            this.mostrarError(error.message || 'No se pudieron cargar las tablas.');
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-dash-analisis', {
                    mensaje: 'No se pudieron cargar las tablas.',
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

    async aplicarFiltroDocumentos(documentos = [], origen = '') {
        if (this.chartTipoActual !== 'DashAnalisis') return;
        if (this.cargando || !this._payloadActual) return;

        const selecciones = Array.from(new Set(
            (Array.isArray(documentos) ? documentos : [])
                .map(documento => String(documento))
                .filter(documento => /^\d+$/.test(documento) && Number(documento) > 0)
        ));
        const origenValido = selecciones.length && ['consumos', 'compras_almacen'].includes(origen)
            ? origen
            : '';

        this._seleccionesDocumentos = selecciones;
        this._origenDocumentos = origenValido;

        const token = this._filtroDocumentosToken + 1;
        this._filtroDocumentosToken = token;
        this.limpiarError();

        const base = { ...this._payloadActual };
        const paginaOrigen = selecciones.length
            ? Math.max(1, Number(this.datos?.[origenValido]?.page || 1))
            : 1;
        const payloadTabla = tipo => {
            const esOrigen = Boolean(selecciones.length && tipo === origenValido);
            const payload = {
                ...base,
                page: esOrigen ? paginaOrigen : 1,
                page_size: this.pageSize
            };

            if (selecciones.length && !esOrigen) {
                payload.documentos = selecciones;
            }

            return payload;
        };

        try {
            const [consumos, comprasAlmacen, comprasDocumentos] = await Promise.all([
                this.service.obtenerConsumos(payloadTabla('consumos')),
                this.service.obtenerComprasAlmacen(payloadTabla('compras_almacen')),
                this.service.obtenerComprasDocumentos(payloadTabla('compras_documentos'))
            ]);

            if (token !== this._filtroDocumentosToken) return;

            const error = [consumos, comprasAlmacen, comprasDocumentos].find(respuesta => !respuesta.success);
            if (error) {
                throw new Error(error.message || 'No se pudo aplicar el filtro por documento.');
            }

            this.datos = {
                consumos: consumos.payload,
                compras_almacen: comprasAlmacen.payload,
                compras_documentos: comprasDocumentos.payload
            };

            const chart = window.ChartRegistry?.['DashAnalisis'];
            if (chart && typeof chart.render === 'function') {
                chart.render(this, this.datos, this.contenedorGraficos);
            }
        } catch (error) {
            if (token === this._filtroDocumentosToken) {
                this.mostrarError(error.message || 'No se pudo aplicar el filtro por documento.');
            }
        }
    }

    async cambiarPagina(tipo, page) {
        if (this.chartTipoActual !== 'DashAnalisis') return;
        if (this.cargandoPagina || this.cargando || !this._payloadActual) return;

        const metodos = {
            consumos: 'obtenerConsumos',
            compras_almacen: 'obtenerComprasAlmacen',
            compras_documentos: 'obtenerComprasDocumentos'
        };

        const metodo = metodos[tipo];
        if (!metodo || typeof this.service[metodo] !== 'function') return;

        const actual = this.datos?.[tipo];
        const totalPaginas = Number(actual?.total_paginas || 0);
        const pagina = Math.max(1, Math.min(totalPaginas || 1, Number(page) || 1));

        if (actual && pagina === Number(actual.page)) return;

        this.cargandoPagina = true;
        this.limpiarError();

        try {
            const documentos = (this._seleccionesDocumentos.length && tipo !== this._origenDocumentos)
                ? this._seleccionesDocumentos
                : null;
            const respuesta = await this.service[metodo]({
                ...this._payloadActual,
                ...(documentos ? { documentos } : {}),
                page: pagina,
                page_size: this.pageSize
            });

            if (!respuesta.success) {
                throw new Error(respuesta.message || 'No se pudo cargar la página.');
            }

            this.datos[tipo] = respuesta.payload;

            const chart = window.ChartRegistry?.['DashAnalisis'];
            if (chart && typeof chart.actualizarTabla === 'function') {
                chart.actualizarTabla(tipo, respuesta.payload);
            }
        } catch (error) {
            this.mostrarError(error.message || 'No se pudo cargar la página.');
        } finally {
            this.cargandoPagina = false;
        }
    }

    async cambiarPaginaMermas(page) {
        if (this.chartTipoActual !== 'AnalisisMermas') return;
        if (this.cargandoPagina || this.cargando || !this._payloadActual) return;

        const paginacion = this.datos?.paginacion || {};
        const totalPaginas = Number(paginacion.total_paginas || 0);
        const pagina = Math.max(1, Math.min(totalPaginas || 1, Number(page) || 1));

        if (pagina === Number(paginacion.page)) return;

        this.cargandoPagina = true;
        this.limpiarError();

        try {
            const respuesta = await this.service.obtenerAnalisisMermas({
                ...this._payloadActual,
                ...this._seleccionesMermas,
                page: pagina,
                page_size: this.pageSize
            });

            if (!respuesta.success) {
                throw new Error(respuesta.message || 'No se pudo cargar la pǭgina.');
            }

            this.datos = respuesta.payload;
            const chart = window.ChartRegistry?.['AnalisisMermas'];
            if (chart && typeof chart.render === 'function') {
                chart.render(this, this.datos, this.contenedorGraficos);
            }
        } catch (error) {
            this.mostrarError(error.message || 'No se pudo cargar la pǭgina.');
        } finally {
            this.cargandoPagina = false;
        }
    }

    async cargarAnalisisMermasSeleccion(seleccionesMesGlo = [], seleccionesMesLote = []) {
        if (this.chartTipoActual !== 'AnalisisMermas') return;
        if (this.cargandoPagina || this.cargando || !this._payloadActual) return;

        this._seleccionesMermas = {
            selecciones_mes_glo: seleccionesMesGlo,
            selecciones_mes_lote: seleccionesMesLote
        };

        this.cargandoPagina = true;
        this.limpiarError();

        try {
            const respuesta = await this.service.obtenerAnalisisMermas({
                ...this._payloadActual,
                ...this._seleccionesMermas,
                page: 1,
                page_size: this.pageSize
            });

            if (!respuesta.success) {
                throw new Error(respuesta.message || 'No se pudo aplicar el filtro.');
            }

            this.datos = respuesta.payload;
            const chart = window.ChartRegistry?.['AnalisisMermas'];
            if (chart && typeof chart.render === 'function') {
                chart.render(this, this.datos, this.contenedorGraficos);
            }
        } catch (error) {
            this.mostrarError(error.message || 'No se pudo aplicar el filtro.');
        } finally {
            this.cargandoPagina = false;
        }
    }

    limpiarFiltros() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        this.multiAlmacen?.setSelectedValues(this._defaults.almacen ? [this._defaults.almacen] : [], false);
        this.multiArticulo?.setSelectedValues(this._defaults.articulo ? [this._defaults.articulo] : [], false);
        this.multiLote?.selectAll(false);
        this.multiTransaccion?.setSelectedValues(this._defaults.transacciones, false);

        this.cargarTodo();
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
    window.consumoLimaController = new ConsumoLimaController();
});
