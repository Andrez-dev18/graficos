/**
 * Controlador del módulo productoSusti (Productos Sustitutos).
 */
const PRODUCTO_SUSTI_CONFIG = {
    ProdGeneral: {
        tipoGrafico: 'ProdGeneral',
        titulo: 'ProdGeneral · Consolidado Semanal',
        subtitulo: 'Suma de peso y precio promedio semanal de todos los productos seleccionados'
    },
    ProdIndividual: {
        tipoGrafico: 'ProdIndividual',
        titulo: 'ProdIndividual · Desglose por Producto',
        subtitulo: 'Evolución semanal independiente para cada producto sustituto'
    }
};

class ProductoSustiController {
    constructor() {
        this.service = new ProductoSustiService();
        this.tipoGraficoActual = 'ProdGeneral';
        this.config = PRODUCTO_SUSTI_CONFIG[this.tipoGraficoActual];
        this.datos = null;
        this.productosOptions = [];
        this.productosDefault = [];
        this.fechaMin = null;
        this.fechaMax = null;
        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;
        this.msProductos = null;
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
            console.error('Error al iniciar productoSusti:', error);
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
                this.config = PRODUCTO_SUSTI_CONFIG[this.tipoGraficoActual] || PRODUCTO_SUSTI_CONFIG.ProdGeneral;
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
        this.fechaMin = data.fecha_min || '2021-10-11';
        this.fechaMax = data.fecha_max || new Date().toISOString().split('T')[0];
        this.fechaInicioDefault = data.fecha_inicio_default || this.fechaMin;
        this.fechaFinDefault = data.fecha_fin_default || this.fechaMax;
        this.productosOptions = Array.isArray(data.productos) ? data.productos : [];
        this.productosDefault = Array.isArray(data.productos_default) ? data.productos_default : [];

        this.inicializarMultiselectProductos();
        this.filtrosCargados = true;
    }

    inicializarMultiselectProductos() {
        if (typeof CustomMultiSelect === 'undefined') {
            console.error('CustomMultiSelect no está disponible en window.');
            return;
        }

        const opciones = this.productosOptions.map(p => {
            const id = String(p.id || p.codigo || p.label);
            const isDefaultSelected = this.productosDefault.length > 0
                ? this.productosDefault.includes(id) || this.productosDefault.includes(p.codigo)
                : true;
            return {
                id: id,
                label: p.label || id,
                selected: isDefaultSelected
            };
        });

        this.msProductos = new CustomMultiSelect({
            btnId: 'ms-productos-btn',
            labelId: 'ms-productos-label',
            dropdownId: 'ms-productos-dropdown',
            searchId: 'ms-productos-search',
            optionsContainerId: 'ms-productos-options',
            title: 'Productos',
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

        let productos = [];
        if (this.msProductos && typeof this.msProductos.getSelectedValues === 'function') {
            productos = this.msProductos.getSelectedValues();
        }

        return {
            tipo_grafico: this.tipoGraficoActual,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            productos: productos
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
            this.mostrarError(error.message || 'Error al obtener los datos de Productos Sustitutos.');
        } finally {
            this.cargando = false;
            this.mostrarBotonCargando(false);
            if (esPrimeraCarga) {
                this.mostrarLoader(false);
            }
        }
    }

    renderizarGrafico(data) {
        if (typeof ChartProductosSustitutos !== 'undefined') {
            ChartProductosSustitutos.render(this, data, 'contenedor-graficos-lista');
        } else {
            console.error('ChartProductosSustitutos no está cargado');
        }
    }

    limpiarFiltros() {
        if (this.msProductos && typeof this.msProductos.setSelectedValues === 'function') {
            this.msProductos.setSelectedValues(this.productosDefault, true);
        }
        this.inicializarPeriodo();
        this.cargarDashboard();
    }

    mostrarLoader(mostrar) {
        if (!this.loaderInicial) return;
        if (mostrar) {
            this.loaderInicial.classList.remove('hidden', 'opacity-0');
            this.loaderInicial.classList.add('flex');
        } else {
            this.loaderInicial.classList.add('opacity-0');
            setTimeout(() => {
                this.loaderInicial.classList.add('hidden');
                this.loaderInicial.classList.remove('flex');
            }, 300);
        }
    }

    mostrarBotonCargando(cargando) {
        if (!this.btnCargar) return;
        this.btnCargar.disabled = cargando;
        if (cargando) {
            this.btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
            this.btnCargar.innerHTML = `
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando...</span>
            `;
        } else {
            this.btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
            this.btnCargar.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
                    </path>
                </svg>
                <span>Cargar</span>
            `;
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.productoSustiController = new ProductoSustiController();
});
