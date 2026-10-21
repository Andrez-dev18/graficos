/**
 * Controlador de InfoMercados.
 * Administra VolSemanal y los gráficos AQP Empresa.
 */
class InfoMercadosController {
    constructor() {
        this.service = new InfoMercadosService();
        this.tipoGraficoActual = 'VolSemanal';
        this.datosVolSemanal = null;
        this.datosAqpEmpresa = null;
        this.filtrosAqpCargados = false;
        this.mesesOptions = [];
        this.empresasOptions = [];
        this.msMes = null;
        this.msEmpresa = null;
        this.cargando = false;
        this.requestSeq = 0;
        this.filtrosAqpPromise = null;
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupListeners();
        this.actualizarSubtitulo();
        this.actualizarVisibilidadFiltros();
        this.limpiarError();
        this.mostrarLoader(true);

        try {
            await this.cargarVolSemanal(true);
        } catch (error) {
            console.error('Error al cargar InfoMercados:', error);
            this.mostrarError(error.message || 'No se pudo cargar el gráfico.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-infomercados');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.filtrosAqp = document.getElementById('filtros-aqpempresa');
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
                await this.cambiarTipoGrafico(event.target.value);
            });
        }

        if (this.btnCargar) {
            this.btnCargar.addEventListener('click', async () => {
                if (this.esGraficoAqp()) {
                    await this.cargarAqpEmpresaConFiltros();
                }
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', async () => {
                this.limpiarSeleccionFiltrosAqp();
                await this.cargarAqpEmpresaConFiltros();
            });
        }
    }

    esGraficoAqp(tipo = this.tipoGraficoActual) {
        return tipo && tipo !== 'VolSemanal';
    }

    async cambiarTipoGrafico(tipo) {
        this.requestSeq += 1;
        this.tipoGraficoActual = tipo || 'VolSemanal';
        this.actualizarSubtitulo();
        this.actualizarVisibilidadFiltros();
        this.limpiarError();

        if (this.esGraficoAqp()) {
            await this.cargarAqpEmpresaConFiltros();
            return;
        }

        if (this.datosVolSemanal) {
            this.cargando = false;
            this.setBotonCargando(false);
            this.mostrarLoader(false);
            this.renderVolSemanal();
        } else {
            this.cargando = false;
            this.setBotonCargando(false);
            this.mostrarLoader(true);
            try {
                await this.cargarVolSemanal(true);
            } catch (error) {
                console.error('Error al cargar VolSemanal:', error);
                this.mostrarError(error.message || 'No se pudo cargar Volumen Semanal.');
            } finally {
                this.mostrarLoader(false);
            }
        }
    }

    actualizarSubtitulo(titulo = null) {
        if (!this.subtituloModulo) return;

        if (this.tipoGraficoActual === 'VolSemanal') {
            this.subtituloModulo.textContent = 'Volumen Semanal Arequipa · Año 2026';
            return;
        }

        this.subtituloModulo.textContent = titulo
            ? `${titulo} · Año 2026`
            : 'Comportamiento de Aves AREQUIPA · Año 2026';
    }

    actualizarVisibilidadFiltros() {
        if (!this.filtrosAqp) return;

        const mostrar = this.esGraficoAqp();
        this.filtrosAqp.classList.toggle('hidden', !mostrar);
        this.filtrosAqp.classList.toggle('flex', mostrar);
    }

    async cargarVolSemanal(esCargaInicial = false) {
        if (!esCargaInicial) {
            this.mostrarLoader(true);
        }

        try {
            const data = await this.service.obtenerVolSemanal('2026');

            if (!data || !Array.isArray(data.semanas) || data.semanas.length === 0) {
                throw new Error('No se recibieron datos para Volumen Semanal.');
            }

            this.datosVolSemanal = data;
            this.actualizarSubtitulo();
            this.renderVolSemanal();
        } finally {
            if (!esCargaInicial) {
                this.mostrarLoader(false);
            }
        }
    }

    async cargarAqpEmpresaConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            if (!this.filtrosAqpCargados) {
                await this.cargarFiltrosAqpEmpresa();
            }

            await this.cargarAqpEmpresa(seq);
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar AQP Empresa:', error);
                this.mostrarError(error.message || 'No se pudo cargar el gráfico AQP.');
            }
        } finally {
            if (seq === this.requestSeq) {
                this.cargando = false;
                this.setBotonCargando(false);
                this.mostrarLoader(false);
            }
        }
    }

    async cargarFiltrosAqpEmpresa() {
        if (this.filtrosAqpCargados) return;

        if (!this.filtrosAqpPromise) {
            this.filtrosAqpPromise = (async () => {
                const data = await this.service.obtenerAqpEmpresaFiltros('2026');

                this.mesesOptions = Array.isArray(data.meses) ? data.meses : [];
                this.empresasOptions = Array.isArray(data.empresas) ? data.empresas : [];
                this.inicializarMultiSelects();
                this.filtrosAqpCargados = true;
            })();
        }

        try {
            await this.filtrosAqpPromise;
        } finally {
            this.filtrosAqpPromise = null;
        }
    }

    inicializarMultiSelects() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect para los filtros.');
        }

        const opcionesMes = this.mesesOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.mes),
            selected: true
        }));

        const opcionesEmpresa = this.empresasOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.id),
            selected: true
        }));

        if (!this.msMes) {
            this.msMes = new CustomMultiSelect({
                btnId: 'ms-mes-aqp-btn',
                labelId: 'ms-mes-aqp-label',
                dropdownId: 'ms-mes-aqp-dropdown',
                searchId: 'ms-mes-aqp-search',
                optionsContainerId: 'ms-mes-aqp-options',
                title: 'MES',
                options: opcionesMes
            });
        } else {
            this.msMes.clearSelection(false);
            this.msMes.setOptions(opcionesMes);
        }

        if (!this.msEmpresa) {
            this.msEmpresa = new CustomMultiSelect({
                btnId: 'ms-empresa-aqp-btn',
                labelId: 'ms-empresa-aqp-label',
                dropdownId: 'ms-empresa-aqp-dropdown',
                searchId: 'ms-empresa-aqp-search',
                optionsContainerId: 'ms-empresa-aqp-options',
                title: 'EMPRESA',
                options: opcionesEmpresa
            });
        } else {
            this.msEmpresa.clearSelection(false);
            this.msEmpresa.setOptions(opcionesEmpresa);
        }
    }

    async cargarAqpEmpresa(seq = this.requestSeq) {
        const tipoSolicitado = this.tipoGraficoActual;

        const meses = this.msMes
            ? this.msMes.getSelectedValues().map(valor => parseInt(valor, 10)).filter(valor => !isNaN(valor))
            : this.mesesOptions.map(item => parseInt(item.mes, 10));

        const empresas = this.msEmpresa
            ? this.msEmpresa.getSelectedValues()
            : this.empresasOptions.map(item => String(item.id));

        const data = await this.service.obtenerAqpEmpresa({
            tipo_grafico: tipoSolicitado,
            anio: '2026',
            meses,
            empresas
        });

        if (!data || !Array.isArray(data.series)) {
            throw new Error('No se recibieron datos para el gráfico AQP.');
        }

        if (seq !== this.requestSeq || tipoSolicitado !== this.tipoGraficoActual) {
            return;
        }

        this.datosAqpEmpresa = data;
        this.actualizarSubtitulo(data.titulo);
        this.renderAqpEmpresa();
    }

    limpiarSeleccionFiltrosAqp() {
        if (this.msMes) {
            this.msMes.options.forEach(opcion => opcion.selected = true);
            this.msMes.updateLabel(false);
            this.msMes.render();
        }

        if (this.msEmpresa) {
            this.msEmpresa.options.forEach(opcion => opcion.selected = true);
            this.msEmpresa.updateLabel(false);
            this.msEmpresa.render();
        }
    }

    renderVolSemanal() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosVolSemanal'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de Volumen Semanal.');
            return;
        }

        componente.render(this, this.datosVolSemanal, 'contenedor-graficos-lista');
    }

    renderAqpEmpresa() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosAQPEmpresa'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de AQP Empresa.');
            return;
        }

        componente.render(this, this.datosAqpEmpresa, 'contenedor-graficos-lista');
    }

    setBotonCargando(cargando) {
        if (typeof LoadingHelper !== 'undefined') {
            if (cargando) {
                LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
            } else {
                LoadingHelper.restaurarBoton('btn-cargar');
            }
            return;
        }

        if (!this.btnCargar) return;
        this.btnCargar.disabled = cargando;
    }

    mostrarLoader(mostrar) {
        if (typeof LoadingHelper !== 'undefined') {
            if (mostrar) {
                LoadingHelper.mostrarInicial({
                    titulo: 'Cargando InfoMercados',
                    subtitulo: 'Obteniendo información de mercados...'
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
    window.infoMercadosController = new InfoMercadosController();
});
