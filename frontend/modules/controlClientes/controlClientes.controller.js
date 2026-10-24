/**
 * Controlador del módulo Control de Clientes.
 */
const CONTROL_CLIENTES_CONFIG = {
    UndCorporativos: {
        tipoGrafico: 'UndCorporativos',
        titulo: 'Tendencia por Unidades',
        chartKey: 'ControlClientesUndCorporativos',
        implemented: true,
        mostrarCorporativo: true,
        mostrarZonas: false,
        mostrarSubzonas: false
    },
    PesoCorporativos: {
        tipoGrafico: 'PesoCorporativos',
        titulo: 'Tendencia por Pesos y Tipos',
        chartKey: 'ControlClientesPesoCorporativos',
        implemented: true,
        mostrarCorporativo: true,
        mostrarZonas: false,
        mostrarSubzonas: false
    },
    AqpSubClientes: {
        tipoGrafico: 'AqpSubClientes',
        titulo: 'Participación por Corporativo (AQP)',
        chartKey: 'ControlClientesAqpParticipacion',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: false,
        zonasDefault: ['AREQUIPA']
    },
    AqpSubZonasCant: {
        tipoGrafico: 'AqpSubZonasCant',
        titulo: 'Participación por Subzona (AQP) · Unidades',
        chartKey: 'ControlClientesAqpParticipacion',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true,
        zonasDefault: ['AREQUIPA']
    },
    AqpSubZonasPeso: {
        tipoGrafico: 'AqpSubZonasPeso',
        titulo: 'Participación por Subzona (AQP) · Unidades, Kilos y Soles',
        chartKey: 'ControlClientesAqpParticipacion',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true,
        zonasDefault: ['AREQUIPA']
    },
    ParticipacionUnd: {
        tipoGrafico: 'ParticipacionUnd',
        titulo: 'Participación por Zona · Unidades',
        implemented: true,
        chartKey: 'ControlClientesParticipacionZona',
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true
    },
    ParticipacionKilos: {
        tipoGrafico: 'ParticipacionKilos',
        titulo: 'Participación por Zona · Kilos',
        implemented: true,
        chartKey: 'ControlClientesParticipacionZona',
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true
    },
    ConteoClientes: {
        tipoGrafico: 'ConteoClientes',
        titulo: 'Conteo de Clientes por Año',
        chartKey: 'ControlClientesConteoClientes',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: false
    },
    ParetoCorporativos: {
        tipoGrafico: 'ParetoCorporativos',
        titulo: 'Pareto de Ventas Corporativas',
        chartKey: 'ControlClientesPareto',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true
    },
    ParetoCorporativosZona: {
        tipoGrafico: 'ParetoCorporativosZona',
        titulo: 'Pareto de Ventas por Zona y Corporativo',
        chartKey: 'ControlClientesPareto',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true
    },
    ParetoCorporativosSubZona: {
        tipoGrafico: 'ParetoCorporativosSubZona',
        titulo: 'Pareto de Ventas por Zona, Subzona y Corporativo',
        chartKey: 'ControlClientesPareto',
        implemented: true,
        mostrarCorporativo: false,
        mostrarZonas: true,
        mostrarSubzonas: true
    }
};

class ControlClientesController {
    constructor() {
        this.service = new ControlClientesService();
        this.tipoGraficoActual = 'UndCorporativos';
        this.config = CONTROL_CLIENTES_CONFIG[this.tipoGraficoActual];
        this.datos = null;

        this.corporativos = [];
        this.coorporativoDefault = '';
        this.coorporativoSeleccionado = '';

        this.zonasOptions = [];
        this.subzonasOptions = [];
        this.msZonas = null;
        this.msSubzonas = null;

        this.fechaInicioDefault = null;
        this.fechaFinDefault = null;

        this.filtrosCargados = false;
        this.cargando = false;
        this.requestSeq = 0;

        this.init();
    }

    async init() {
        this.cachearElementos();
        this.actualizarVisibilidadFiltros();

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
            console.error('Error al iniciar Control de Clientes:', error);
            this.mostrarError(error.message || 'No se pudo cargar el módulo.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.subtituloModulo = document.getElementById('subtitulo-modulo-controlclientes');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.filtroCorporativo = document.getElementById('filtro-corporativo');
        this.filtroZonas = document.getElementById('filtro-zonas');
        this.filtroSubzonas = document.getElementById('filtro-subzonas');
        this.btnCorporativo = document.getElementById('corporativo-btn');
        this.labelCorporativo = document.getElementById('corporativo-label');
        this.dropdownCorporativo = document.getElementById('corporativo-dropdown');
        this.searchCorporativo = document.getElementById('corporativo-search');
        this.optionsCorporativo = document.getElementById('corporativo-options');
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

        if (this.btnCorporativo && this.dropdownCorporativo) {
            this.btnCorporativo.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleCorporativo();
            });
        }

        if (this.searchCorporativo) {
            this.searchCorporativo.addEventListener('input', (event) => {
                this.renderizarOpcionesCorporativo(event.target.value);
            });
        }

        if (this.optionsCorporativo) {
            this.optionsCorporativo.addEventListener('click', (event) => {
                const opcion = event.target.closest('[data-corporativo]');
                if (!opcion) return;
                this.seleccionarCorporativo(opcion.getAttribute('data-corporativo'));
            });
        }

        document.addEventListener('click', (event) => {
            if (this.filtroCorporativo && !this.filtroCorporativo.contains(event.target)) {
                this.cerrarCorporativo();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.cerrarCorporativo();
            }
        });

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

    async cambiarGrafico(tipo) {
        const config = CONTROL_CLIENTES_CONFIG[tipo];
        if (!config) return;

        const componenteAnterior = window.ChartRegistry && this.config && this.config.chartKey
            ? window.ChartRegistry[this.config.chartKey]
            : null;

        if (componenteAnterior && typeof componenteAnterior.destroy === 'function') {
            componenteAnterior.destroy();
        }

        this.requestSeq += 1;
        this.tipoGraficoActual = tipo;
        this.config = config;
        this.datos = null;

        if (this.contenedorGraficos) {
            this.contenedorGraficos.innerHTML = '';
        }

        this.actualizarVisibilidadFiltros();
        this.aplicarFiltrosPorDefectoVista();
        this.actualizarSubtitulo();
        this.limpiarError();
        this.cerrarCorporativo();

        if (!config.implemented) {
            this.setBotonCargando(false);
            this.mostrarLoader(false);
            this.renderPlaceholder();
            return;
        }

        await this.cargarDashboard();
    }

    renderPlaceholder() {
        if (!this.contenedorGraficos) return;

        this.contenedorGraficos.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 text-center">
                <div class="mx-auto w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <i class="fas fa-chart-line text-xl"></i>
                </div>
                <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(this.config.titulo)}</h2>
                <p class="text-sm text-slate-500 mt-1">Esta vista se implementará en la siguiente iteración.</p>
            </div>
        `;
    }

    async cargarFiltros() {
        const data = await this.service.obtenerFiltros(this.config.tipoGrafico);

        this.corporativos = Array.isArray(data.corporativos) ? data.corporativos : [];
        this.coorporativoDefault = data.coorporativo_default || 'BOLIVAR PUMA JOSE ANTONIO';
        this.coorporativoSeleccionado = this.coorporativoDefault;
        this.fechaInicioDefault = data.fecha_inicio_default || data.fecha_min || null;
        this.fechaFinDefault = data.fecha_fin_default || data.fecha_max || null;

        this.zonasOptions = Array.isArray(data.zonas) ? data.zonas : [];
        this.subzonasOptions = Array.isArray(data.subzonas) ? data.subzonas : [];

        this.actualizarLabelCorporativo();
        this.renderizarOpcionesCorporativo();
        this.inicializarMultiselectZonas();
        this.inicializarMultiselectSubzonas();
        this.filtrosCargados = true;
        this.aplicarFiltrosPorDefectoVista();
    }

    inicializarMultiselectZonas() {
        if (typeof CustomMultiSelect === 'undefined') {
            console.error('CustomMultiSelect no está disponible en window.');
            return;
        }

        const opciones = this.zonasOptions.map(item => {
            const id = String(item.id || item.label);
            return { id, label: item.label || id, selected: true };
        });

        if (!this.msZonas) {
            this.msZonas = new CustomMultiSelect({
                btnId: 'ms-zonas-btn',
                labelId: 'ms-zonas-label',
                dropdownId: 'ms-zonas-dropdown',
                searchId: 'ms-zonas-search',
                optionsContainerId: 'ms-zonas-options',
                title: 'Zona',
                options: opciones
            });
        } else {
            this.msZonas.clearSelection(false);
            this.msZonas.setOptions(opciones);
        }
    }

    inicializarMultiselectSubzonas() {
        if (typeof CustomMultiSelect === 'undefined') {
            console.error('CustomMultiSelect no está disponible en window.');
            return;
        }

        const opciones = this.subzonasOptions.map(item => {
            const id = String(item.id || item.label);
            return { id, label: item.label || id, selected: true };
        });

        if (!this.msSubzonas) {
            this.msSubzonas = new CustomMultiSelect({
                btnId: 'ms-subzonas-btn',
                labelId: 'ms-subzonas-label',
                dropdownId: 'ms-subzonas-dropdown',
                searchId: 'ms-subzonas-search',
                optionsContainerId: 'ms-subzonas-options',
                title: 'Subzona',
                options: opciones
            });
        } else {
            this.msSubzonas.clearSelection(false);
            this.msSubzonas.setOptions(opciones);
        }
    }

    actualizarVisibilidadFiltros() {
        const config = this.config || {};
        const mostrarCorporativo = config.mostrarCorporativo !== false;

        if (this.filtroCorporativo) {
            this.filtroCorporativo.classList.toggle('hidden', !mostrarCorporativo);
        }
        if (this.filtroZonas) {
            this.filtroZonas.classList.toggle('hidden', !config.mostrarZonas);
        }
        if (this.filtroSubzonas) {
            this.filtroSubzonas.classList.toggle('hidden', !config.mostrarSubzonas);
        }

        if (!mostrarCorporativo) {
            this.cerrarCorporativo();
        }
    }

    aplicarFiltrosPorDefectoVista() {
        if (this.msZonas) {
            const zonasDefault = Array.isArray(this.config.zonasDefault) ? this.config.zonasDefault : [];
            if (zonasDefault.length > 0 && typeof this.msZonas.setSelectedValues === 'function') {
                this.msZonas.setSelectedValues(zonasDefault);
            } else if (typeof this.msZonas.selectAll === 'function') {
                this.msZonas.selectAll();
            }
        }

        if (this.msSubzonas && typeof this.msSubzonas.selectAll === 'function') {
            this.msSubzonas.selectAll();
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

    normalizar(texto) {
        return String(texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    renderizarOpcionesCorporativo(filtro = '') {
        if (!this.optionsCorporativo) return;

        const busqueda = this.normalizar(filtro).trim();
        const opciones = busqueda === ''
            ? this.corporativos
            : this.corporativos.filter(item => this.normalizar(item.label || item.id).includes(busqueda));

        if (opciones.length === 0) {
            this.optionsCorporativo.innerHTML = '<div class="px-3 py-3 text-xs text-slate-400 text-center">Sin resultados</div>';
            return;
        }

        this.optionsCorporativo.innerHTML = opciones.map(item => {
            const id = String(item.id || item.label || '');
            const label = String(item.label || id);
            const activo = id === this.coorporativoSeleccionado;
            return `
                <button type="button" data-corporativo="${this.escapeHtml(id)}"
                    class="w-full text-left px-2.5 py-2 rounded-lg transition-colors ${activo ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50 font-medium'}">
                    <span class="block truncate" title="${this.escapeHtml(label)}">${this.escapeHtml(label)}</span>
                </button>
            `;
        }).join('');
    }

    actualizarLabelCorporativo() {
        if (!this.labelCorporativo) return;

        if (this.coorporativoSeleccionado) {
            this.labelCorporativo.textContent = this.coorporativoSeleccionado;
            this.labelCorporativo.title = this.coorporativoSeleccionado;
            this.labelCorporativo.className = 'truncate text-left select-none text-slate-800 font-semibold';
        } else {
            this.labelCorporativo.textContent = 'Selecciona un corporativo';
            this.labelCorporativo.title = '';
            this.labelCorporativo.className = 'truncate text-left select-none text-slate-400 font-normal';
        }
    }

    toggleCorporativo() {
        if (this.dropdownCorporativo.classList.contains('hidden')) {
            this.abrirCorporativo();
        } else {
            this.cerrarCorporativo();
        }
    }

    abrirCorporativo() {
        if (!this.dropdownCorporativo) return;
        this.dropdownCorporativo.classList.remove('hidden');
        if (this.searchCorporativo) {
            this.searchCorporativo.value = '';
            this.searchCorporativo.focus();
        }
        this.renderizarOpcionesCorporativo('');

        const activo = this.optionsCorporativo
            ? this.optionsCorporativo.querySelector('[data-corporativo].bg-blue-50')
            : null;
        if (activo) {
            activo.scrollIntoView({ block: 'nearest' });
        }
    }

    cerrarCorporativo() {
        if (!this.dropdownCorporativo) return;
        this.dropdownCorporativo.classList.add('hidden');
        if (this.searchCorporativo) {
            this.searchCorporativo.value = '';
        }
    }

    seleccionarCorporativo(id) {
        if (!id) return;
        this.coorporativoSeleccionado = String(id);
        this.actualizarLabelCorporativo();
        this.cerrarCorporativo();
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

        const zonas = this.msZonas && typeof this.msZonas.getSelectedValues === 'function'
            ? this.msZonas.getSelectedValues()
            : [];
        const subzonas = this.msSubzonas && typeof this.msSubzonas.getSelectedValues === 'function'
            ? this.msSubzonas.getSelectedValues()
            : [];

        return {
            tipo_grafico: this.config.tipoGrafico,
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            coorporativo: this.coorporativoSeleccionado,
            zonas,
            subzonas
        };
    }

    async cargarDashboard(esCargaInicial = false) {
        if (!this.config || !this.config.implemented) return;

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

            const usaFilas = ['ControlClientesPareto', 'ControlClientesParticipacionZona', 'ControlClientesAqpParticipacion'].includes(this.config.chartKey);
            const esConteoClientes = this.config.chartKey === 'ControlClientesConteoClientes';
            const datosValidos = data && (esConteoClientes
                ? Array.isArray(data.zonas) && Array.isArray(data.anios)
                : usaFilas ? Array.isArray(data.filas) : Array.isArray(data.labels));

            if (!datosValidos) {
                throw new Error('No se recibieron datos de Control de Clientes.');
            }

            this.datos = data;
            this.actualizarSubtitulo(data);
            this.render();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar Control de Clientes:', error);
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
        if (!this.datos) return;

        const componente = window.ChartRegistry && window.ChartRegistry[this.config.chartKey];
        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente del gráfico.');
            return;
        }

        componente.render(this, this.datos, 'contenedor-graficos-lista');
    }

    actualizarSubtitulo(data = null) {
        if (!this.subtituloModulo) return;

        const base = (this.config && this.config.titulo) || 'Control de Clientes';
        const coorporativo = (data && data.coorporativo) || this.coorporativoSeleccionado;
        const implementada = Boolean(this.config && this.config.implemented);
        const mostrarCorporativo = this.config && this.config.mostrarCorporativo !== false;

        this.subtituloModulo.textContent = implementada && mostrarCorporativo && coorporativo
            ? `${base} · ${coorporativo}`
            : base;
    }

    limpiarFiltros() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        this.inicializarPeriodo();

        if (this.coorporativoDefault) {
            this.coorporativoSeleccionado = this.coorporativoDefault;
        }

        this.actualizarLabelCorporativo();
        this.renderizarOpcionesCorporativo();
        this.cerrarCorporativo();

        this.aplicarFiltrosPorDefectoVista();

        if (!this.config.implemented) {
            this.renderPlaceholder();
            return;
        }

        this.cargarDashboard();
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
        const texto = this.btnCargar.querySelector('span');
        if (texto) texto.textContent = cargando ? 'Cargando...' : 'Cargar';
    }

    mostrarLoader(mostrar) {
        if (typeof LoadingHelper !== 'undefined') {
            if (mostrar) {
                LoadingHelper.mostrarInicial({
                    titulo: 'Cargando Control de Clientes',
                    subtitulo: 'Obteniendo tendencia de unidades...'
                });
            } else {
                LoadingHelper.ocultarInicial();
            }
            return;
        }

        if (!this.loaderInicial) return;
        this.loaderInicial.classList.toggle('hidden', !mostrar);
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

    escapeHtml(texto) {
        if (!texto) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.controlClientesController = new ControlClientesController();
});
