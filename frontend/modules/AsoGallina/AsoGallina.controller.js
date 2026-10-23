const ASO_GALLINA_CONFIG = {
    DashGallina: {
        tipoGrafico: 'DashGallina',
        titulo: 'DashGallina · Unidades, Pesos Promedios y Kilogramos',
        chartKey: 'AsoGallinaDashGallina'
    },
    GallUnd: {
        tipoGrafico: 'GallUnd',
        titulo: 'ANALISIS DE GALLINA (UND)',
        chartKey: 'AsoGallinaGallUnd'
    },
    GallPeso: {
        tipoGrafico: 'GallPeso',
        titulo: 'ANALISIS DE GALLINA (Peso Prom)',
        chartKey: 'AsoGallinaGallPeso'
    },
    GallKilos: {
        tipoGrafico: 'GallKilos',
        titulo: 'ANALISIS DE GALLINA (kilos)',
        chartKey: 'AsoGallinaGallKilos'
    }
};

class AsoGallinaController {
    constructor() {
        this.service = new AsoGallinaService();
        this.tipoGraficoActual = 'DashGallina';
        this.config = ASO_GALLINA_CONFIG[this.tipoGraficoActual];
        this.datos = null;
        this.tiposOptions = [];
        this.tiposDefault = [];
        this.fechaMin = null;
        this.fechaMax = null;
        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;
        this.msTipo = null;
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
            console.error('Error al iniciar AsoGallina:', error);
            this.mostrarError(error.message || 'No se pudo cargar el módulo.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-asogallina');
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
        const config = ASO_GALLINA_CONFIG[tipo];
        if (!config) return;

        this.requestSeq += 1;
        this.destruirComponenteActual();
        this.tipoGraficoActual = tipo;
        this.config = config;
        this.actualizarSubtitulo();
        this.limpiarError();

        // Si ya tenemos datos completos cargados en memoria, podemos renderizar al instante
        if (this.datos && this.datos.series && this.datos.labels) {
            const dataClone = Object.assign({}, this.datos, { tipo_grafico: tipo });
            const componente = window.ChartRegistry && window.ChartRegistry[config.chartKey];
            if (componente && typeof componente.render === 'function') {
                componente.render(this, dataClone);
                return;
            }
        }

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

        this.tiposOptions = Array.isArray(data.tipos) ? data.tipos : [];
        this.tiposDefault = Array.isArray(data.tipos_default) ? data.tipos_default : ['GALLINA REPRODUCTORA'];
        this.fechaMin = data.fecha_min || null;
        this.fechaMax = data.fecha_max || null;
        this.fechaInicioDefault = data.fecha_inicio_default || null;
        this.fechaFinDefault = data.fecha_fin_default || null;

        this.inicializarMultiSelect();
        this.filtrosCargados = true;
    }

    inicializarMultiSelect() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect.');
        }

        const opcionesTipo = this.tiposOptions.map(item => {
            const id = String(item.id || item.codigo);
            return {
                id,
                label: item.label || id,
                selected: this.tiposDefault.includes(id)
            };
        });

        if (!this.msTipo) {
            this.msTipo = new CustomMultiSelect({
                btnId: 'ms-tipo-btn',
                labelId: 'ms-tipo-label',
                dropdownId: 'ms-tipo-dropdown',
                searchId: 'ms-tipo-search',
                optionsContainerId: 'ms-tipo-options',
                title: 'Tipo de Gallina',
                options: opcionesTipo
            });
        } else {
            this.msTipo.clearSelection(false);
            this.msTipo.setOptions(opcionesTipo);
        }
    }

    resetSeleccionFiltros() {
        if (this.msTipo) {
            this.msTipo.options.forEach(opcion => {
                opcion.selected = this.tiposDefault.includes(opcion.id);
            });
            this.msTipo.updateLabel(false);
            this.msTipo.render();
        }
    }

    obtenerSolicitud() {
        const rango = this.obtenerRango();
        const tipos = this.msTipo ? this.msTipo.getSelectedValues() : [];

        return {
            tipo_grafico: this.config.tipoGrafico,
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            tipos
        };
    }

    async cargarDashboard(esCargaInicial = false) {
        if (this.cargando) return;

        this.cargando = true;
        this.limpiarError();

        if (this.btnCargar) {
            this.btnCargar.disabled = true;
            this.btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
        }

        if (!esCargaInicial) {
            this.mostrarLoader(true);
        }

        const currentSeq = ++this.requestSeq;

        try {
            const payload = this.obtenerSolicitud();
            const data = await this.service.obtenerDashboard(payload);

            if (currentSeq !== this.requestSeq) {
                return;
            }

            this.datos = data;
            const componente = window.ChartRegistry && window.ChartRegistry[this.config.chartKey];

            if (!componente || typeof componente.render !== 'function') {
                throw new Error(`El componente de gráfico para ${this.config.chartKey} no está registrado.`);
            }

            componente.render(this, data);
        } catch (error) {
            console.error('Error al cargar datos de AsoGallina:', error);
            this.mostrarError(error.message || 'No se pudieron cargar los datos.');
        } finally {
            this.cargando = false;
            this.mostrarLoader(false);

            if (this.btnCargar) {
                this.btnCargar.disabled = false;
                this.btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    }

    actualizarSubtitulo() {
        if (this.subtituloModulo && this.config) {
            this.subtituloModulo.textContent = `${this.config.titulo} · Rango seleccionado`;
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

    mostrarLoader(mostrar) {
        if (this.loaderInicial) {
            if (mostrar) {
                this.loaderInicial.classList.remove('hidden');
                this.loaderInicial.style.opacity = '1';
            } else {
                this.loaderInicial.style.opacity = '0';
                setTimeout(() => {
                    this.loaderInicial.classList.add('hidden');
                }, 200);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.asoGallinaController = new AsoGallinaController();
});
