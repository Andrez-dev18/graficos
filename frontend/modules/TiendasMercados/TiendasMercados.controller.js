const TIENDAS_MERCADOS_CONFIG = {
    PorcGeneral: {
        tipoGrafico: 'PorcGeneral',
        titulo: 'Porcentaje general',
        chartKey: 'TiendasMercadosBarras'
    },
    PorcGeneralcant: {
        tipoGrafico: 'PorcGeneralcant',
        titulo: 'Cantidades generales',
        chartKey: 'TiendasMercadosBarras'
    },
    PorTipoEstable: {
        tipoGrafico: 'PorTipoEstable',
        titulo: 'Porcentaje por tamaño',
        chartKey: 'TiendasMercadosBarras'
    },
    PorTipoEstableCant: {
        tipoGrafico: 'PorTipoEstableCant',
        titulo: 'Cantidades por tamaño',
        chartKey: 'TiendasMercadosBarras'
    },
    DashGral: {
        tipoGrafico: 'DashGral',
        titulo: 'Tiendas y Mercados',
        chartKey: 'TiendasMercadosDashGral'
    },
    PastelPorcGeneralcant: {
        tipoGrafico: 'PastelPorcGeneralcant',
        titulo: 'Participación general por provincia',
        chartKey: 'TiendasMercadosPasteles'
    },
    PastelPorcGeneraltam: {
        tipoGrafico: 'PastelPorcGeneraltam',
        titulo: 'Distribución por tamaño',
        chartKey: 'TiendasMercadosPasteles'
    },
    BarraPorcGeneraltam: {
        tipoGrafico: 'BarraPorcGeneraltam',
        titulo: 'Cantidades generales',
        chartKey: 'TiendasMercadosBarras'
    },
    DashPastel: {
        tipoGrafico: 'DashPastel',
        titulo: 'Tiendas y Mercados · Distribución',
        chartKey: 'TiendasMercadosPasteles'
    }
};

class TiendasMercadosController {
    constructor() {
        this.service = new TiendasMercadosService();
        this.tipoGraficoActual = 'PorcGeneral';
        this.config = TIENDAS_MERCADOS_CONFIG[this.tipoGraficoActual];
        this.datos = null;
        this.provinciasOptions = [];
        this.provinciasDefault = [];
        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;
        this.msProvincia = null;
        this.filtrosCargados = false;
        this.cargando = false;
        this.requestSeq = 0;
        this.init();
    }

    async init() {
        this.cachearElementos();

        if (this.selectTipoGrafico) {
            this.selectTipoGrafico.value = this.tipoGraficoActual;
        }

        this.setupListeners();
        this.actualizarSubtitulo();
        this.limpiarError();
        this.mostrarLoader(true);

        try {
            await this.cargarFiltros();
            this.inicializarPeriodo();
            await this.cargarDashboard(true);
        } catch (error) {
            console.error('Error al iniciar TiendasMercados:', error);
            this.mostrarError(error.message || 'No se pudo cargar el módulo.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-tiendasmercados');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.contenedorGraficos = document.getElementById('contenedor-graficos-lista');
        this.mensajeError = document.getElementById('mensaje-error');
    }

    setupListeners() {
        if (this.btnToggleFiltros && this.contenedorFiltros) {
            this.btnToggleFiltros.addEventListener('click', () => {
                const oculto = this.contenedorFiltros.classList.toggle('hidden');

                if (this.labelToggleFiltros) {
                    this.labelToggleFiltros.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
                }

                if (this.iconToggleFiltros) {
                    this.iconToggleFiltros.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        if (this.selectTipoGrafico) {
            this.selectTipoGrafico.addEventListener('change', async (event) => {
                await this.cambiarGrafico(event.target.value);
            });
        }

        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
            });
        }

        if (this.btnCargar) {
            this.btnCargar.addEventListener('click', async () => {
                await this.cargarDashboard();
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', async () => {
                this.inicializarPeriodo();
                this.resetSeleccionFiltros();
                await this.cargarDashboard();
            });
        }
    }

    async cambiarGrafico(tipo) {
        const config = TIENDAS_MERCADOS_CONFIG[tipo];
        if (!config) return;

        this.requestSeq += 1;
        this.destruirComponenteActual();
        if (this.contenedorGraficos) {
            this.contenedorGraficos.innerHTML = '';
        }

        this.tipoGraficoActual = tipo;
        this.config = config;
        this.datos = null;
        this.actualizarSubtitulo();
        this.limpiarError();
        await this.cargarDashboard();
    }

    destruirComponenteActual() {
        const componente = window.ChartRegistry && window.ChartRegistry[this.config.chartKey];
        if (componente && typeof componente.destroy === 'function') {
            componente.destroy();
        }
    }

    async cargarFiltros() {
        if (this.filtrosCargados) return;

        const data = await this.service.obtenerFiltros(this.config.tipoGrafico);

        this.provinciasOptions = Array.isArray(data.provincias) ? data.provincias : [];
        this.provinciasDefault = Array.isArray(data.provincias_default) ? data.provincias_default : [];
        this.fechaInicioDefault = data.fecha_inicio_default || null;
        this.fechaFinDefault = data.fecha_fin_default || null;

        if (this.provinciasDefault.length === 0) {
            this.provinciasDefault = this.provinciasOptions.map(item => String(item.id));
        }

        this.inicializarMultiSelect();
        this.filtrosCargados = true;
    }

    inicializarMultiSelect() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect.');
        }

        const opcionesProvincia = this.provinciasOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: this.provinciasDefault.includes(id)
            };
        });

        if (!this.msProvincia) {
            this.msProvincia = new CustomMultiSelect({
                btnId: 'ms-provincia-btn',
                labelId: 'ms-provincia-label',
                dropdownId: 'ms-provincia-dropdown',
                searchId: 'ms-provincia-search',
                optionsContainerId: 'ms-provincia-options',
                title: 'PROVINCIA',
                options: opcionesProvincia
            });
        } else {
            this.msProvincia.clearSelection(false);
            this.msProvincia.setOptions(opcionesProvincia);
        }
    }

    resetSeleccionFiltros() {
        if (this.msProvincia) {
            this.msProvincia.options.forEach(opcion => {
                opcion.selected = this.provinciasDefault.includes(opcion.id);
            });
            this.msProvincia.updateLabel(false);
            this.msProvincia.render();
        }
    }

    inicializarPeriodo() {
        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper.');
        }

        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        PeriodoHelper.renderizarInputs();

        const inputInicio = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');

        if (inputInicio && this.fechaInicioDefault) inputInicio.value = this.fechaInicioDefault;
        if (inputFin && this.fechaFinDefault) inputFin.value = this.fechaFinDefault;
    }

    obtenerRango() {
        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper.');
        }

        const rango = PeriodoHelper.obtenerRangoFechas();
        if (!rango.fechaInicio || !rango.fechaFin) {
            throw new Error('Selecciona un rango de fechas válido.');
        }

        return rango;
    }

    obtenerSolicitud() {
        const rango = this.obtenerRango();
        const provincias = this.msProvincia ? this.msProvincia.getSelectedValues() : [];

        return {
            tipo_grafico: this.config.tipoGrafico,
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            provincias
        };
    }

    async cargarDashboard(esCargaInicial = false) {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();

        if (!esCargaInicial) {
            this.mostrarLoader(true);
            this.setBotonCargando(true);
        }

        try {
            if (!this.filtrosCargados) {
                await this.cargarFiltros();
            }

            const data = await this.service.obtenerDashboard(this.obtenerSolicitud());

            if (seq !== this.requestSeq || !this.config) return;

            if (!data || !Array.isArray(data.filas)) {
                throw new Error('No se recibieron datos de Tiendas y Mercados.');
            }

            this.datos = data;
            this.actualizarSubtitulo(data);
            this.render();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar TiendasMercados:', error);
                this.mostrarError(error.message || 'No se pudo cargar la información.');
            }
        } finally {
            if (seq === this.requestSeq) {
                this.cargando = false;
                this.setBotonCargando(false);
                this.mostrarLoader(false);
            }
        }
    }

    render() {
        const componente = window.ChartRegistry && window.ChartRegistry[this.config.chartKey];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente del gráfico.');
            return;
        }

        componente.render(this, this.datos, 'contenedor-graficos-lista');
    }

    actualizarSubtitulo(data = null) {
        if (!this.subtituloModulo) return;

        const titulo = this.config.titulo || (data && data.titulo) || 'Tiendas y Mercados';
        const inicio = data && data.fecha_inicio ? data.fecha_inicio : '';
        const fin = data && data.fecha_fin ? data.fecha_fin : '';

        this.subtituloModulo.textContent = inicio && fin
            ? `${titulo} · ${inicio} al ${fin}`
            : `${titulo} · Rango seleccionado`;
    }

    setBotonCargando(cargando) {
        if (!this.btnCargar) return;

        if (typeof LoadingHelper !== 'undefined') {
            if (cargando) {
                LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
            } else {
                LoadingHelper.restaurarBoton('btn-cargar');
            }
            return;
        }

        this.btnCargar.disabled = cargando;
    }

    mostrarLoader(mostrar) {
        if (typeof LoadingHelper !== 'undefined') {
            if (mostrar) {
                LoadingHelper.mostrarInicial({
                    titulo: 'Cargando Tiendas y Mercados',
                    subtitulo: 'Obteniendo información de establecimientos...'
                });
            } else {
                LoadingHelper.ocultarInicial();
            }
            return;
        }

        const loader = document.getElementById('loader-inicial-pagina');
        if (loader) {
            loader.classList.toggle('hidden', !mostrar);
        }
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
    window.tiendasMercadosController = new TiendasMercadosController();
});
