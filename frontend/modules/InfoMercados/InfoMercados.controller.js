/**
 * Controlador de InfoMercados.
 * Administra VolSemanal, los gráficos AQP Empresa y los gráficos PROV Empresa.
 */
class InfoMercadosController {
    constructor() {
        this.service = new InfoMercadosService();
        this.tipoGraficoActual = 'VolSemanal';
        this.datosVolSemanal = null;
        this.datosAqpEmpresa = null;
        this.datosProvEmpresa = null;
        this.filtrosAqpCargados = false;
        this.filtrosProvCargados = false;
        this.mesesOptions = [];
        this.empresasOptions = [];
        this.provinciasOptions = [];
        this.proveedoresOptions = [];
        this.msMes = null;
        this.msEmpresa = null;
        this.msProvincia = null;
        this.msProveedor = null;
        this.cargando = false;
        this.requestSeq = 0;
        this.filtrosAqpPromise = null;
        this.filtrosProvPromise = null;
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
        this.filtrosProv = document.getElementById('filtros-provempresa');
        this.accionesGrafico = document.getElementById('acciones-grafico');
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
                } else if (this.esGraficoProv()) {
                    await this.cargarProvEmpresaConFiltros();
                }
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', async () => {
                if (this.esGraficoAqp()) {
                    this.limpiarSeleccionFiltrosAqp();
                    await this.cargarAqpEmpresaConFiltros();
                } else if (this.esGraficoProv()) {
                    this.limpiarSeleccionFiltrosProv();
                    await this.cargarProvEmpresaConFiltros();
                }
            });
        }
    }

    esGraficoAqp(tipo = this.tipoGraficoActual) {
        return !!tipo && tipo.indexOf('AQP') === 0;
    }

    esGraficoProv(tipo = this.tipoGraficoActual) {
        return !!tipo && tipo.indexOf('PROV') === 0;
    }

    esGraficoEmpresa(tipo = this.tipoGraficoActual) {
        return this.esGraficoAqp(tipo) || this.esGraficoProv(tipo);
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

        if (this.esGraficoProv()) {
            await this.cargarProvEmpresaConFiltros();
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

        const familia = this.esGraficoProv() ? 'PROVINCIAS' : 'AREQUIPA';
        this.subtituloModulo.textContent = titulo
            ? `${titulo} · Año 2026`
            : `Comportamiento de Aves ${familia} · Año 2026`;
    }

    actualizarVisibilidadFiltros() {
        const mostrarAqp = this.esGraficoAqp();
        const mostrarProv = this.esGraficoProv();
        const mostrarAcciones = mostrarAqp || mostrarProv;

        this.toggleElemento(this.filtrosAqp, mostrarAqp);
        this.toggleElemento(this.filtrosProv, mostrarProv);
        this.toggleElemento(this.accionesGrafico, mostrarAcciones);
    }

    toggleElemento(elemento, mostrar) {
        if (!elemento) return;
        elemento.classList.toggle('hidden', !mostrar);
        elemento.classList.toggle('flex', mostrar);
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

    async cargarProvEmpresaConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            if (!this.filtrosProvCargados) {
                await this.cargarFiltrosProvEmpresa();
            }

            await this.cargarProvEmpresa(seq);
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar PROV Empresa:', error);
                this.mostrarError(error.message || 'No se pudo cargar el gráfico PROV.');
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
                this.inicializarMultiSelectsAqp();
                this.filtrosAqpCargados = true;
            })();
        }

        try {
            await this.filtrosAqpPromise;
        } finally {
            this.filtrosAqpPromise = null;
        }
    }

    async cargarFiltrosProvEmpresa() {
        if (this.filtrosProvCargados) return;

        if (!this.filtrosProvPromise) {
            this.filtrosProvPromise = (async () => {
                const data = await this.service.obtenerProvEmpresaFiltros('2026');

                this.provinciasOptions = Array.isArray(data.provincias) ? data.provincias : [];
                this.proveedoresOptions = Array.isArray(data.proveedores) ? data.proveedores : [];
                this.inicializarMultiSelectsProv();
                this.filtrosProvCargados = true;
            })();
        }

        try {
            await this.filtrosProvPromise;
        } finally {
            this.filtrosProvPromise = null;
        }
    }

    inicializarMultiSelectsAqp() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect para los filtros AQP.');
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

    inicializarMultiSelectsProv() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect para los filtros PROV.');
        }

        const opcionesProvincia = this.provinciasOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: id === 'ILO'
            };
        });

        if (opcionesProvincia.length > 0 && !opcionesProvincia.some(opcion => opcion.selected)) {
            opcionesProvincia[0].selected = true;
        }

        const opcionesProveedor = this.proveedoresOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.id),
            selected: true
        }));

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
        }

        if (!this.msProveedor) {
            this.msProveedor = new CustomMultiSelect({
                btnId: 'ms-proveedor-btn',
                labelId: 'ms-proveedor-label',
                dropdownId: 'ms-proveedor-dropdown',
                searchId: 'ms-proveedor-search',
                optionsContainerId: 'ms-proveedor-options',
                title: 'PROVEEDOR',
                options: opcionesProveedor
            });
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

    async cargarProvEmpresa(seq = this.requestSeq) {
        const tipoSolicitado = this.tipoGraficoActual;

        const provincias = this.msProvincia
            ? this.msProvincia.getSelectedValues()
            : this.provinciasOptions.map(item => String(item.id));

        const proveedores = this.msProveedor
            ? this.msProveedor.getSelectedValues()
            : this.proveedoresOptions.map(item => String(item.id));

        const data = await this.service.obtenerProvEmpresa({
            tipo_grafico: tipoSolicitado,
            anio: '2026',
            provincias,
            proveedores
        });

        if (!data || !Array.isArray(data.series)) {
            throw new Error('No se recibieron datos para el gráfico PROV.');
        }

        if (seq !== this.requestSeq || tipoSolicitado !== this.tipoGraficoActual) {
            return;
        }

        this.datosProvEmpresa = data;
        this.actualizarSubtitulo(data.titulo);
        this.renderProvEmpresa();
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

    limpiarSeleccionFiltrosProv() {
        if (this.msProvincia) {
            this.msProvincia.options.forEach(opcion => opcion.selected = opcion.id === 'ILO');
            if (!this.msProvincia.options.some(opcion => opcion.selected) && this.msProvincia.options.length > 0) {
                this.msProvincia.options[0].selected = true;
            }
            this.msProvincia.updateLabel(false);
            this.msProvincia.render();
        }

        if (this.msProveedor) {
            this.msProveedor.options.forEach(opcion => opcion.selected = true);
            this.msProveedor.updateLabel(false);
            this.msProveedor.render();
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
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosEmpresa'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de AQP Empresa.');
            return;
        }

        componente.render(this, this.datosAqpEmpresa, 'contenedor-graficos-lista');
    }

    renderProvEmpresa() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosEmpresa'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de PROV Empresa.');
            return;
        }

        componente.render(this, this.datosProvEmpresa, 'contenedor-graficos-lista');
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
