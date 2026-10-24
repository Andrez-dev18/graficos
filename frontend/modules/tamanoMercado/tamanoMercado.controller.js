/**
 * Controlador de Frontend - Tamaño de Mercado (CoreBI)
 */
const TAMANO_MERCADO_CONFIG = {
    Participacion: {
        tipoGrafico: 'Participacion',
        titulo: 'Participación · Cuota de Mercado',
        subtitulo: 'Líneas de participación diaria por empresa'
    },
    Unidades: {
        tipoGrafico: 'Unidades',
        titulo: 'Unidades Diarias',
        subtitulo: 'Cantidad de aves comercializadas y peso promedio por día'
    },
    Pesos: {
        tipoGrafico: 'Pesos',
        titulo: 'Pesos Diarios',
        subtitulo: 'Kilos comercializados y peso promedio por día'
    },
    Importe: {
        tipoGrafico: 'Importe',
        titulo: 'Importe Diario',
        subtitulo: 'Soles comercializados y peso promedio por día'
    }
};

class TamanoMercadoController {
    constructor() {
        this.service = new TamanoMercadoService();

        // Estado
        this.tipoGraficoActual = 'Participacion';
        this.config = TAMANO_MERCADO_CONFIG[this.tipoGraficoActual];
        this.datos = null;

        this.provinciasOptions = [];
        this.provinciasDefault = [];
        this.empresasOptions = [];
        this.empresasDefault = [];

        this.fechaMin = null;
        this.fechaMax = null;
        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;

        this.msProvincia = null;
        this.msEmpresas = null;
        this.filtrosCargados = false;
        this.cargando = false;

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
            console.error('Error al iniciar Tamaño de Mercado:', error);
            this.mostrarError(error.message || 'No se pudo cargar el módulo.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.contenedorGraficos = document.getElementById('contenedor-graficos-lista');
        this.mensajeError = document.getElementById('mensaje-error');
        this.loaderInicial = document.getElementById('loader-inicial-pagina');
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
            this.selectTipoGrafico.addEventListener('change', async (e) => {
                this.tipoGraficoActual = e.target.value;
                this.config = TAMANO_MERCADO_CONFIG[this.tipoGraficoActual] || TAMANO_MERCADO_CONFIG.Participacion;
                this.actualizarSubtitulo();

                if (this.datos) {
                    this.datos.tipo_grafico = this.tipoGraficoActual;
                    this.renderizarGrafico(this.datos);
                } else {
                    await this.cargarDashboard();
                }
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
            this.btnCargar.addEventListener('click', () => {
                this.cargarDashboard();
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', () => {
                this.limpiarFiltros();
            });
        }
    }

    actualizarSubtitulo() {
        if (this.subtituloModulo && this.config) {
            this.subtituloModulo.textContent = this.config.subtitulo;
        }
    }

    async cargarFiltros() {
        const data = await this.service.obtenerFiltros();

        this.fechaMin = data.fecha_min || '2023-05-01';
        this.fechaMax = data.fecha_max || new Date().toISOString().split('T')[0];
        this.fechaInicioDefault = data.fecha_inicio_default || this.fechaMin;
        this.fechaFinDefault = data.fecha_fin_default || this.fechaMax;

        this.provinciasOptions = Array.isArray(data.provincias) ? data.provincias : [];
        this.provinciasDefault = Array.isArray(data.provincias_default)
            ? data.provincias_default.map(String)
            : this.provinciasOptions.map(p => String(p.id));
        this.empresasOptions = Array.isArray(data.empresas) ? data.empresas : [];
        this.empresasDefault = Array.isArray(data.empresas_default) ? data.empresas_default : [];

        this.inicializarMultiselectProvincia();
        this.inicializarMultiselectEmpresas();
        this.filtrosCargados = true;
    }

    inicializarMultiselectProvincia() {
        if (typeof CustomMultiSelect === 'undefined') {
            console.error('CustomMultiSelect no está disponible en window.');
            return;
        }

        const opciones = this.provinciasOptions.map(p => {
            const id = String(p.id || p.label);
            return {
                id: id,
                label: p.label || id,
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
                title: 'Provincia',
                options: opciones
            });
        } else {
            this.msProvincia.clearSelection(false);
            this.msProvincia.setOptions(opciones);
        }
    }

    inicializarMultiselectEmpresas() {
        if (typeof CustomMultiSelect === 'undefined') {
            console.error('CustomMultiSelect no está disponible en window.');
            return;
        }

        const opciones = this.empresasOptions.map(e => {
            const id = String(e.id || e.label);
            const isSelected = this.empresasDefault.length > 0 
                ? this.empresasDefault.includes(id) 
                : true;
            return {
                id: id,
                label: e.label || id,
                selected: isSelected
            };
        });

        this.msEmpresas = new CustomMultiSelect({
            btnId: 'ms-empresas-btn',
            labelId: 'ms-empresas-label',
            dropdownId: 'ms-empresas-dropdown',
            searchId: 'ms-empresas-search',
            optionsContainerId: 'ms-empresas-options',
            title: 'Empresas',
            options: opciones
        });
    }

    inicializarPeriodo() {
        if (typeof PeriodoHelper === 'undefined') {
            console.error('PeriodoHelper no está disponible');
            return;
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

    construirFiltrosPayload() {
        let fechaInicio = this.fechaInicioDefault;
        let fechaFin = this.fechaFinDefault;

        if (typeof PeriodoHelper !== 'undefined') {
            const rango = PeriodoHelper.obtenerRangoFechas();
            if (rango && rango.fechaInicio) fechaInicio = rango.fechaInicio;
            if (rango && rango.fechaFin) fechaFin = rango.fechaFin;
        }

        let provincias = [];
        if (this.msProvincia && typeof this.msProvincia.getSelectedValues === 'function') {
            provincias = this.msProvincia.getSelectedValues();
        }

        let empresas = [];
        if (this.msEmpresas && typeof this.msEmpresas.getSelectedValues === 'function') {
            empresas = this.msEmpresas.getSelectedValues();
        }

        return {
            tipo_grafico: this.tipoGraficoActual,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            provincias: provincias,
            empresas: empresas
        };
    }

    async cargarDashboard(esPrimeraCarga = false) {
        if (this.cargando) return;
        this.cargando = true;
        this.limpiarError();
        this.mostrarBotonCargando(true);

        try {
            const filtros = this.construirFiltrosPayload();
            const data = await this.service.obtenerDashboard(filtros);
            this.datos = data;
            this.datos.tipo_grafico = this.tipoGraficoActual;
            this.renderizarGrafico(this.datos);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.mostrarError(error.message || 'Error al obtener los datos de Tamaño de Mercado.');
        } finally {
            this.cargando = false;
            this.mostrarBotonCargando(false);
            if (esPrimeraCarga) {
                this.mostrarLoader(false);
            }
        }
    }

    renderizarGrafico(data) {
        if (typeof ChartTamanoMercado !== 'undefined') {
            ChartTamanoMercado.render(this, data, 'contenedor-graficos-lista');
        } else {
            console.error('ChartTamanoMercado no está cargado');
        }
    }

    limpiarFiltros() {
        this.inicializarPeriodo();
        if (this.msProvincia && typeof this.msProvincia.selectAll === 'function') {
            this.msProvincia.selectAll();
        }
        if (this.msEmpresas && typeof this.msEmpresas.selectAll === 'function') {
            this.msEmpresas.selectAll();
        }
        this.cargarDashboard();
    }

    mostrarLoader(mostrar) {
        if (this.loaderInicial) {
            if (mostrar) {
                this.loaderInicial.classList.remove('opacity-0', 'pointer-events-none');
            } else {
                this.loaderInicial.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => {
                    this.loaderInicial.style.display = 'none';
                }, 300);
            }
        }
    }

    mostrarBotonCargando(cargando) {
        if (!this.btnCargar) return;
        const icono = this.btnCargar.querySelector('svg');
        const texto = this.btnCargar.querySelector('span');

        if (cargando) {
            this.btnCargar.disabled = true;
            this.btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
            if (icono) icono.classList.add('animate-spin');
            if (texto) texto.textContent = 'Cargando...';
        } else {
            this.btnCargar.disabled = false;
            this.btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
            if (icono) icono.classList.remove('animate-spin');
            if (texto) texto.textContent = 'Cargar';
        }
    }

    mostrarError(mensaje) {
        if (this.mensajeError) {
            this.mensajeError.textContent = mensaje;
            this.mensajeError.classList.remove('hidden');
        }
    }

    limpiarError() {
        if (this.mensajeError) {
            this.mensajeError.textContent = '';
            this.mensajeError.classList.add('hidden');
        }
    }
}

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
    window.tamanoMercadoController = new TamanoMercadoController();
});
