const ING_EMP_LIMA_GRAFICOS = {
    ParticipacionMercadoDiaria: {
        tipoGrafico: 'ParticipacionMercadoDiaria',
        titulo: 'Participacion del Mercado Diaria',
        chartKey: 'IngEmpLimaParticipacionMercadoDiaria'
    },
    ParticipacionMercadoSemanal: {
        tipoGrafico: 'ParticipacionMercadoSemanal',
        titulo: 'Participacion del Mercado Semanal',
        chartKey: 'IngEmpLimaParticipacionMercadoSemanal'
    },
    EvolucionPeso: {
        tipoGrafico: 'EvolucionPeso',
        titulo: 'Evolucion de Pesos Promedios Diarios',
        chartKey: 'IngEmpLimaEvolucionPeso'
    },
    EvolucionPesoPrecio: {
        tipoGrafico: 'EvolucionPesoPrecio',
        titulo: 'Evolucion de Pesos y Precios Promedios por Empresa',
        chartKey: 'IngEmpLimaEvolucionPesoPrecio'
    },
    EvolucionPrecio: {
        tipoGrafico: 'EvolucionPrecio',
        titulo: 'Evolucion de Precios por Empresa',
        chartKey: 'IngEmpLimaEvolucionPrecio'
    },
    Kilogramos: {
        tipoGrafico: 'Kilogramos',
        titulo: 'Pesos en Kilogramos por Empresa',
        chartKey: 'IngEmpLimaKilogramos'
    },
    PrecioPorMes: {
        tipoGrafico: 'PrecioPorMes',
        titulo: 'Precios Promedios por Mes',
        chartKey: 'IngEmpLimaPrecioPorMes'
    }
};

class IngEmpLimaController {
    constructor() {
        this.service = new IngEmpLimaService();
        this.tipoGraficoActual = 'ParticipacionMercadoDiaria';
        this.config = ING_EMP_LIMA_GRAFICOS[this.tipoGraficoActual];
        this.datos = null;
        this.empresasOptions = [];
        this.empresasDefault = [];
        this.fechaMin = null;
        this.fechaMax = null;
        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;
        this.msEmpresa = null;
        this.msMes = null;
        this.mesesOptions = [];
        this.mesesDefault = [];
        this.filtrosCargados = false;
        this.cargando = false;
        this.requestSeq = 0;
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupListeners();
        this.actualizarSubtitulo();
        this.limpiarError();
        this.mostrarLoader(true);

        try {
            await this.cargarFiltros();
            this.inicializarPeriodo();
            await this.cargarDashboard(true);
        } catch (error) {
            console.error('Error al iniciar IngEmpLima:', error);
            this.mostrarError(error.message || 'No se pudo cargar el módulo.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-ingemplima');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.filtroMes = document.getElementById('filtro-mes');
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
        const config = ING_EMP_LIMA_GRAFICOS[tipo];
        if (!config) return;

        this.requestSeq += 1;
        this.destruirComponenteActual();
        if (this.contenedorGraficos) {
            this.contenedorGraficos.innerHTML = '';
        }
        this.tipoGraficoActual = tipo;
        this.config = config;
        this.datos = null;

        if (this.filtroMes) {
            if (tipo === 'PrecioPorMes') {
                this.filtroMes.classList.remove('hidden');
            } else {
                this.filtroMes.classList.add('hidden');
            }
        }

        if ((tipo === 'EvolucionPesoPrecio' || tipo === 'PrecioPorMes') && this.msEmpresa) {
            const actual = this.msEmpresa.getSelectedValues();
            if (actual.length > 2 && typeof this.msEmpresa.setSelectedValues === 'function') {
                this.msEmpresa.setSelectedValues(['SAN FERNANDO S.A.']);
            }
        }

        this.actualizarSubtitulo();
        this.limpiarError();
        await this.cargarDashboard();
    }

    destruirComponenteActual() {
        const key = this.config.chartKey;
        const componente = window.ChartRegistry && window.ChartRegistry[key];
        if (componente && typeof componente.destroy === 'function') {
            componente.destroy();
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

        if (inputInicio && this.fechaInicioDefault) {
            inputInicio.value = this.fechaInicioDefault;
        }
        if (inputFin && this.fechaFinDefault) {
            inputFin.value = this.fechaFinDefault;
        }
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

    async cargarFiltros() {
        if (this.filtrosCargados) return;

        const data = await this.service.obtenerFiltros(this.config.tipoGrafico);

        this.empresasOptions = Array.isArray(data.empresas) ? data.empresas : [];
        this.empresasDefault = Array.isArray(data.empresas_default) ? data.empresas_default : [];
        this.fechaMin = data.fecha_min || null;
        this.fechaMax = data.fecha_max || null;
        this.fechaInicioDefault = data.fecha_inicio_default || null;
        this.fechaFinDefault = data.fecha_fin_default || null;

        if (this.empresasDefault.length === 0) {
            this.empresasDefault = this.empresasOptions.map(item => String(item.id));
        }

        this.inicializarMultiSelects();
        this.filtrosCargados = true;
    }

    inicializarMultiSelects() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect.');
        }

        const opcionesEmpresa = this.empresasOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: this.empresasDefault.includes(id)
            };
        });

        if (!this.msEmpresa) {
            this.msEmpresa = new CustomMultiSelect({
                btnId: 'ms-empresa-btn',
                labelId: 'ms-empresa-label',
                dropdownId: 'ms-empresa-dropdown',
                searchId: 'ms-empresa-search',
                optionsContainerId: 'ms-empresa-options',
                title: 'NomEmpresa',
                options: opcionesEmpresa
            });
        } else {
            this.msEmpresa.clearSelection(false);
            this.msEmpresa.setOptions(opcionesEmpresa);
        }

        // Inicializar multiselect de Meses para PrecioPorMes
        const mesesNombres = [
            { id: '1',  label: 'enero' },
            { id: '2',  label: 'febrero' },
            { id: '3',  label: 'marzo' },
            { id: '4',  label: 'abril' },
            { id: '5',  label: 'mayo' },
            { id: '6',  label: 'junio' },
            { id: '7',  label: 'julio' },
            { id: '8',  label: 'agosto' },
            { id: '9',  label: 'septiembre' },
            { id: '10', label: 'octubre' },
            { id: '11', label: 'noviembre' },
            { id: '12', label: 'diciembre' }
        ];

        this.mesesOptions = mesesNombres;
        this.mesesDefault = ['5', '6', '7', '8', '9', '10'];

        const opcionesMes = this.mesesOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label,
                selected: this.mesesDefault.includes(id)
            };
        });

        if (!this.msMes) {
            const btnMes = document.getElementById('ms-mes-btn');
            if (btnMes) {
                this.msMes = new CustomMultiSelect({
                    btnId: 'ms-mes-btn',
                    labelId: 'ms-mes-label',
                    dropdownId: 'ms-mes-dropdown',
                    searchId: 'ms-mes-search',
                    optionsContainerId: 'ms-mes-options',
                    title: 'Mes de fecha',
                    options: opcionesMes
                });
            }
        } else {
            this.msMes.clearSelection(false);
            this.msMes.setOptions(opcionesMes);
        }

        if (this.filtroMes) {
            if (this.tipoGraficoActual === 'PrecioPorMes') {
                this.filtroMes.classList.remove('hidden');
            } else {
                this.filtroMes.classList.add('hidden');
            }
        }
    }

    resetSeleccionFiltros() {
        if (this.msEmpresa) {
            this.msEmpresa.options.forEach(opcion => {
                opcion.selected = this.empresasDefault.includes(opcion.id);
            });
            this.msEmpresa.updateLabel(false);
            this.msEmpresa.render();
        }

        if (this.msMes) {
            this.msMes.options.forEach(opcion => {
                opcion.selected = this.mesesDefault.includes(opcion.id);
            });
            this.msMes.updateLabel(false);
            this.msMes.render();
        }
    }

    obtenerSolicitud() {
        const rango = this.obtenerRango();
        const empresas = this.msEmpresa ? this.msEmpresa.getSelectedValues() : [];
        const meses = (this.msMes && this.tipoGraficoActual === 'PrecioPorMes')
            ? this.msMes.getSelectedValues()
            : [];

        return {
            tipo_grafico: this.config.tipoGrafico,
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            empresas,
            meses
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

            const solicitud = this.obtenerSolicitud();
            const data = await this.service.obtenerDashboard(solicitud);

            if (seq !== this.requestSeq || !this.config) {
                return;
            }

            if (!data || (!Array.isArray(data.fechas) && !Array.isArray(data.semanas) && !Array.isArray(data.dias))) {
                throw new Error('No se recibieron datos para IngEmpLima.');
            }

            this.datos = data;
            this.actualizarSubtitulo(data);
            this.render();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar IngEmpLima:', error);
                this.mostrarError(error.message || 'No se pudo cargar el gráfico.');
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

        const titulo = (data && data.titulo) || this.config.titulo;
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';

        if (fechaInicio && fechaFin) {
            this.subtituloModulo.textContent = `${titulo} ·`;
            return;
        }

        this.subtituloModulo.textContent = `${titulo} · Rango seleccionado`;
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
                    titulo: 'Cargando Ingreso Empresas Lima',
                    subtitulo: 'Calculando participación diaria...'
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
    window.ingEmpLimaController = new IngEmpLimaController();
});
