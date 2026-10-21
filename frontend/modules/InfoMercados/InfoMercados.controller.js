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
        this.datosParticipacionAqp = null;
        this.datosParticipacionProv = null;
        this.datosDashAqp = null;
        this.datosDashProv = null;
        this.filtrosAqpCargados = false;
        this.filtrosProvCargados = false;
        this.filtrosParticipacionCargados = false;
        this.filtrosParticipacionProvCargados = false;
        this.mesesOptions = [];
        this.empresasOptions = [];
        this.provinciasOptions = [];
        this.proveedoresOptions = [];
        this.mesesProvOptions = [];
        this.empresasParticipacionOptions = [];
        this.provinciasParticipacionOptions = [];
        this.proveedoresParticipacionOptions = [];
        this.msMes = null;
        this.msEmpresa = null;
        this.msProvincia = null;
        this.msProveedor = null;
        this.msMesProv = null;
        this.msEmpresaParticipacion = null;
        this.msProvinciaParticipacion = null;
        this.msProveedorParticipacion = null;
        this.cargando = false;
        this.requestSeq = 0;
        this.filtrosAqpPromise = null;
        this.filtrosProvPromise = null;
        this.filtrosParticipacionPromise = null;
        this.filtrosParticipacionProvPromise = null;
        this.periodoParticipacionInicializado = false;
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
        this.filtroMesProv = document.getElementById('filtro-mes-prov');
        this.filtrosParticipacionPeriodo = document.getElementById('filtros-participacion-periodo');
        this.filtrosParticipacion = document.getElementById('filtros-participacion');
        this.filtrosParticipacionProv = document.getElementById('filtros-participacion-prov');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
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
                if (this.esDashAnalisisAqp()) {
                    await this.cargarDashAnalisisAqpConFiltros();
                } else if (this.esDashAnalisisProv()) {
                    await this.cargarDashAnalisisProvConFiltros();
                } else if (this.esParticipacionAqp()) {
                    await this.cargarParticipacionAqpConFiltros();
                } else if (this.esParticipacionProv()) {
                    await this.cargarParticipacionProvConFiltros();
                } else if (this.esGraficoAqp()) {
                    await this.cargarAqpEmpresaConFiltros();
                } else if (this.esGraficoProv()) {
                    await this.cargarProvEmpresaConFiltros();
                }
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', async () => {
                if (this.esDashAnalisisAqp()) {
                    this.limpiarSeleccionFiltrosAqp();
                    await this.cargarDashAnalisisAqpConFiltros();
                } else if (this.esDashAnalisisProv()) {
                    this.limpiarSeleccionFiltrosDashProv();
                    await this.cargarDashAnalisisProvConFiltros();
                } else if (this.esParticipacionAqp()) {
                    this.limpiarSeleccionFiltrosParticipacion();
                    await this.cargarParticipacionAqpConFiltros();
                } else if (this.esParticipacionProv()) {
                    this.limpiarSeleccionFiltrosParticipacionProv();
                    await this.cargarParticipacionProvConFiltros();
                } else if (this.esGraficoAqp()) {
                    this.limpiarSeleccionFiltrosAqp();
                    await this.cargarAqpEmpresaConFiltros();
                } else if (this.esGraficoProv()) {
                    this.limpiarSeleccionFiltrosProv();
                    await this.cargarProvEmpresaConFiltros();
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
    }

    esGraficoAqp(tipo = this.tipoGraficoActual) {
        return !!tipo && tipo.indexOf('AQP') === 0;
    }

    esGraficoProv(tipo = this.tipoGraficoActual) {
        return !!tipo && tipo.indexOf('PROV') === 0;
    }

    esParticipacionAqp(tipo = this.tipoGraficoActual) {
        return tipo === 'ParticipacionMercadoAQP';
    }

    esParticipacionProv(tipo = this.tipoGraficoActual) {
        return tipo === 'ParticipacionMercadoPROV';
    }

    esDashAnalisisAqp(tipo = this.tipoGraficoActual) {
        return tipo === 'DashAnalisisAQP';
    }

    esDashAnalisisProv(tipo = this.tipoGraficoActual) {
        return tipo === 'DashAnalisisPROV';
    }

    esDashboard(tipo = this.tipoGraficoActual) {
        return this.esDashAnalisisAqp(tipo) || this.esDashAnalisisProv(tipo);
    }

    esGraficoEmpresa(tipo = this.tipoGraficoActual) {
        return this.esGraficoAqp(tipo) || this.esGraficoProv(tipo) || this.esParticipacionAqp(tipo) || this.esParticipacionProv(tipo) || this.esDashboard(tipo);
    }

    async cambiarTipoGrafico(tipo) {
        this.requestSeq += 1;
        this.tipoGraficoActual = tipo || 'VolSemanal';

        const componenteEmpresa = window.ChartRegistry && window.ChartRegistry['InfoMercadosEmpresa'];
        if (componenteEmpresa && typeof componenteEmpresa.destroyAll === 'function') {
            componenteEmpresa.destroyAll();
        }

        const componenteParticipacion = window.ChartRegistry && window.ChartRegistry['InfoMercadosParticipacionAQP'];
        if (componenteParticipacion && typeof componenteParticipacion.destroy === 'function') {
            componenteParticipacion.destroy();
        }

        this.actualizarSubtitulo();
        this.actualizarVisibilidadFiltros();
        this.limpiarError();

        if (this.esDashAnalisisAqp()) {
            await this.cargarDashAnalisisAqpConFiltros();
            return;
        }

        if (this.esDashAnalisisProv()) {
            await this.cargarDashAnalisisProvConFiltros();
            return;
        }

        if (this.esParticipacionAqp()) {
            await this.cargarParticipacionAqpConFiltros();
            return;
        }

        if (this.esParticipacionProv()) {
            await this.cargarParticipacionProvConFiltros();
            return;
        }

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

        if (this.esDashAnalisisAqp()) {
            this.subtituloModulo.textContent = titulo
                ? `${titulo} · Año 2026`
                : 'Análisis AQP · Año 2026';
            return;
        }

        if (this.esDashAnalisisProv()) {
            this.subtituloModulo.textContent = titulo
                ? `${titulo} · Año 2026`
                : 'Análisis PROV · Año 2026';
            return;
        }

        if (this.esParticipacionAqp()) {
            this.subtituloModulo.textContent = titulo
                ? `${titulo} · Año 2026`
                : 'Participación de Mercado AQP · Año 2026';
            return;
        }

        if (this.esParticipacionProv()) {
            this.subtituloModulo.textContent = titulo
                ? `${titulo} · Año 2026`
                : 'Participación de Mercado PROV · Año 2026';
            return;
        }

        const familia = this.esGraficoProv() ? 'PROVINCIAS' : 'AREQUIPA';
        this.subtituloModulo.textContent = titulo
            ? `${titulo} · Año 2026`
            : `Comportamiento de Aves ${familia} · Año 2026`;
    }

    actualizarVisibilidadFiltros() {
        const mostrarAqp = this.esGraficoAqp() || this.esDashAnalisisAqp();
        const mostrarProv = this.esGraficoProv() || this.esDashAnalisisProv();
        const mostrarMesProv = this.esDashAnalisisProv();
        const mostrarParticipacionAqp = this.esParticipacionAqp();
        const mostrarParticipacionProv = this.esParticipacionProv();
        const mostrarParticipacion = mostrarParticipacionAqp || mostrarParticipacionProv;
        const mostrarAcciones = mostrarAqp || mostrarProv || mostrarParticipacion;

        this.toggleElemento(this.filtrosAqp, mostrarAqp);
        this.toggleElemento(this.filtrosProv, mostrarProv);
        this.toggleElemento(this.filtroMesProv, mostrarMesProv);
        this.toggleElemento(this.filtrosParticipacionPeriodo, mostrarParticipacion);
        this.toggleElemento(this.filtrosParticipacion, mostrarParticipacionAqp);
        this.toggleElemento(this.filtrosParticipacionProv, mostrarParticipacionProv);
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

    async cargarDashAnalisisAqpConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            if (!this.filtrosAqpCargados) {
                await this.cargarFiltrosAqpEmpresa();
            }

            const meses = this.msMes
                ? this.msMes.getSelectedValues().map(valor => parseInt(valor, 10)).filter(valor => !isNaN(valor))
                : this.mesesOptions.map(item => parseInt(item.mes, 10));

            const empresas = this.msEmpresa
                ? this.msEmpresa.getSelectedValues()
                : this.empresasOptions.map(item => String(item.id));

            const tipos = ['AQPCantEmpresa', 'AQPPesoEmpresa', 'AQPKilosEmpresa', 'AQPSolesEmpresa'];
            const datos = await Promise.all(tipos.map(tipo => this.service.obtenerAqpEmpresa({
                tipo_grafico: tipo,
                anio: '2026',
                meses,
                empresas
            })));

            if (seq !== this.requestSeq || !this.esDashAnalisisAqp()) {
                return;
            }

            if (datos.some(item => !item || !Array.isArray(item.series))) {
                throw new Error('No se recibieron todos los gráficos de Análisis AQP.');
            }

            this.datosDashAqp = datos;
            this.actualizarSubtitulo('Análisis AQP');
            this.renderDashAnalisisAqp();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar Análisis AQP:', error);
                this.mostrarError(error.message || 'No se pudo cargar el dashboard AQP.');
            }
        } finally {
            if (seq === this.requestSeq) {
                this.cargando = false;
                this.setBotonCargando(false);
                this.mostrarLoader(false);
            }
        }
    }

    async cargarDashAnalisisProvConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            if (!this.filtrosProvCargados) {
                await this.cargarFiltrosProvEmpresa();
            }

            const meses = this.msMesProv
                ? this.msMesProv.getSelectedValues().map(valor => parseInt(valor, 10)).filter(valor => !isNaN(valor))
                : this.mesesProvOptions.map(item => parseInt(item.mes, 10));

            const provincias = this.msProvincia
                ? this.msProvincia.getSelectedValues()
                : this.provinciasOptions.map(item => String(item.id));

            const proveedores = this.msProveedor
                ? this.msProveedor.getSelectedValues()
                : this.proveedoresOptions.map(item => String(item.id));

            const tipos = ['PROVCantEmpresa', 'PROVPesoEmpresa', 'PROVKilosEmpresa', 'PROVSolesEmpresa'];
            const datos = await Promise.all(tipos.map(tipo => this.service.obtenerProvEmpresa({
                tipo_grafico: tipo,
                anio: '2026',
                meses,
                provincias,
                proveedores
            })));

            if (seq !== this.requestSeq || !this.esDashAnalisisProv()) {
                return;
            }

            if (datos.some(item => !item || !Array.isArray(item.series))) {
                throw new Error('No se recibieron todos los gráficos de Análisis PROV.');
            }

            this.datosDashProv = datos;
            this.actualizarSubtitulo('Análisis PROV');
            this.renderDashAnalisisProv();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar Análisis PROV:', error);
                this.mostrarError(error.message || 'No se pudo cargar el dashboard PROV.');
            }
        } finally {
            if (seq === this.requestSeq) {
                this.cargando = false;
                this.setBotonCargando(false);
                this.mostrarLoader(false);
            }
        }
    }

    async cargarParticipacionAqpConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            this.inicializarPeriodoParticipacion();

            if (!this.filtrosParticipacionCargados) {
                await this.cargarFiltrosParticipacionAqp();
            }

            await this.cargarParticipacionAqp(seq);
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar Participación de Mercado AQP:', error);
                this.mostrarError(error.message || 'No se pudo cargar el gráfico de participación.');
            }
        } finally {
            if (seq === this.requestSeq) {
                this.cargando = false;
                this.setBotonCargando(false);
                this.mostrarLoader(false);
            }
        }
    }

    async cargarParticipacionProvConFiltros() {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();
        this.mostrarLoader(true);
        this.setBotonCargando(true);

        try {
            if (!this.filtrosParticipacionProvCargados) {
                await this.cargarFiltrosParticipacionProv();
            }

            this.inicializarPeriodoParticipacion();

            await this.cargarParticipacionProv(seq);
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar Participación de Mercado PROV:', error);
                this.mostrarError(error.message || 'No se pudo cargar el gráfico de participación PROV.');
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
                this.mesesProvOptions = Array.isArray(data.meses) ? data.meses : [];
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

    async cargarFiltrosParticipacionAqp() {
        if (this.filtrosParticipacionCargados) return;

        if (!this.filtrosParticipacionPromise) {
            this.filtrosParticipacionPromise = (async () => {
                const data = await this.service.obtenerParticipacionMercadoAqpFiltros('2026');

                this.empresasParticipacionOptions = Array.isArray(data.empresas) ? data.empresas : [];
                this.inicializarMultiSelectParticipacion();
                this.filtrosParticipacionCargados = true;
            })();
        }

        try {
            await this.filtrosParticipacionPromise;
        } finally {
            this.filtrosParticipacionPromise = null;
        }
    }

    inicializarMultiSelectParticipacion() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect para los filtros de participación.');
        }

        const opcionesEmpresa = this.empresasParticipacionOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.id),
            selected: true
        }));

        if (!this.msEmpresaParticipacion) {
            this.msEmpresaParticipacion = new CustomMultiSelect({
                btnId: 'ms-empresa-part-btn',
                labelId: 'ms-empresa-part-label',
                dropdownId: 'ms-empresa-part-dropdown',
                searchId: 'ms-empresa-part-search',
                optionsContainerId: 'ms-empresa-part-options',
                title: 'EMPRESA',
                options: opcionesEmpresa
            });
        } else {
            this.msEmpresaParticipacion.clearSelection(false);
            this.msEmpresaParticipacion.setOptions(opcionesEmpresa);
        }
    }

    inicializarPeriodoParticipacion() {
        if (this.periodoParticipacionInicializado) return;

        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper para el filtro de período.');
        }

        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_meses';
        }

        PeriodoHelper.renderizarInputs();
        this.periodoParticipacionInicializado = true;
    }

    async cargarFiltrosParticipacionProv() {
        if (this.filtrosParticipacionProvCargados) return;

        if (!this.filtrosParticipacionProvPromise) {
            this.filtrosParticipacionProvPromise = (async () => {
                const data = await this.service.obtenerParticipacionMercadoProvFiltros('2026');

                this.provinciasParticipacionOptions = Array.isArray(data.provincias) ? data.provincias : [];
                this.proveedoresParticipacionOptions = Array.isArray(data.proveedores) ? data.proveedores : [];
                this.inicializarMultiSelectsParticipacionProv();
                this.filtrosParticipacionProvCargados = true;
            })();
        }

        try {
            await this.filtrosParticipacionProvPromise;
        } finally {
            this.filtrosParticipacionProvPromise = null;
        }
    }

    inicializarMultiSelectsParticipacionProv() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect para los filtros de participación PROV.');
        }

        const opcionesProvincia = this.provinciasParticipacionOptions.map(item => {
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

        const opcionesProveedor = this.proveedoresParticipacionOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.id),
            selected: true
        }));

        if (!this.msProvinciaParticipacion) {
            this.msProvinciaParticipacion = new CustomMultiSelect({
                btnId: 'ms-provincia-part-btn',
                labelId: 'ms-provincia-part-label',
                dropdownId: 'ms-provincia-part-dropdown',
                searchId: 'ms-provincia-part-search',
                optionsContainerId: 'ms-provincia-part-options',
                title: 'PROVINCIA',
                options: opcionesProvincia
            });
        } else {
            this.msProvinciaParticipacion.clearSelection(false);
            this.msProvinciaParticipacion.setOptions(opcionesProvincia);
        }

        if (!this.msProveedorParticipacion) {
            this.msProveedorParticipacion = new CustomMultiSelect({
                btnId: 'ms-proveedor-part-btn',
                labelId: 'ms-proveedor-part-label',
                dropdownId: 'ms-proveedor-part-dropdown',
                searchId: 'ms-proveedor-part-search',
                optionsContainerId: 'ms-proveedor-part-options',
                title: 'PROVEEDOR',
                options: opcionesProveedor
            });
        } else {
            this.msProveedorParticipacion.clearSelection(false);
            this.msProveedorParticipacion.setOptions(opcionesProveedor);
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

        const opcionesMes = this.mesesProvOptions.map(item => ({
            id: String(item.id),
            label: item.label || String(item.mes),
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

        if (!this.msMesProv) {
            this.msMesProv = new CustomMultiSelect({
                btnId: 'ms-mes-prov-btn',
                labelId: 'ms-mes-prov-label',
                dropdownId: 'ms-mes-prov-dropdown',
                searchId: 'ms-mes-prov-search',
                optionsContainerId: 'ms-mes-prov-options',
                title: 'MES',
                options: opcionesMes
            });
        } else {
            this.msMesProv.clearSelection(false);
            this.msMesProv.setOptions(opcionesMes);
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

    async cargarParticipacionAqp(seq = this.requestSeq) {
        const tipoSolicitado = this.tipoGraficoActual;

        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper para el filtro de período.');
        }

        const rango = PeriodoHelper.obtenerRangoFechas();

        if (!rango.fechaInicio || !rango.fechaFin) {
            throw new Error('Selecciona un período válido para Participación de Mercado AQP.');
        }

        const empresas = this.msEmpresaParticipacion
            ? this.msEmpresaParticipacion.getSelectedValues()
            : this.empresasParticipacionOptions.map(item => String(item.id));

        const data = await this.service.obtenerParticipacionMercadoAqp({
            tipo_grafico: tipoSolicitado,
            anio: '2026',
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            empresas
        });

        if (!data || !Array.isArray(data.series)) {
            throw new Error('No se recibieron datos para Participación de Mercado AQP.');
        }

        if (seq !== this.requestSeq || tipoSolicitado !== this.tipoGraficoActual) {
            return;
        }

        this.datosParticipacionAqp = data;
        this.actualizarSubtitulo(data.titulo);
        this.renderParticipacionAqp();
    }

    async cargarParticipacionProv(seq = this.requestSeq) {
        const tipoSolicitado = this.tipoGraficoActual;

        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper para el filtro de período.');
        }

        const rango = PeriodoHelper.obtenerRangoFechas();

        if (!rango.fechaInicio || !rango.fechaFin) {
            throw new Error('Selecciona un período válido para Participación de Mercado PROV.');
        }

        const provincias = this.msProvinciaParticipacion
            ? this.msProvinciaParticipacion.getSelectedValues()
            : this.provinciasParticipacionOptions.map(item => String(item.id));

        const proveedores = this.msProveedorParticipacion
            ? this.msProveedorParticipacion.getSelectedValues()
            : this.proveedoresParticipacionOptions.map(item => String(item.id));

        const data = await this.service.obtenerParticipacionMercadoProv({
            tipo_grafico: tipoSolicitado,
            anio: '2026',
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            provincias,
            proveedores
        });

        if (!data || !Array.isArray(data.series)) {
            throw new Error('No se recibieron datos para Participación de Mercado PROV.');
        }

        if (seq !== this.requestSeq || tipoSolicitado !== this.tipoGraficoActual) {
            return;
        }

        this.datosParticipacionProv = data;
        this.actualizarSubtitulo(data.titulo);
        this.renderParticipacionProv();
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

    limpiarSeleccionFiltrosDashProv() {
        this.limpiarSeleccionFiltrosProv();

        if (this.msMesProv) {
            this.msMesProv.options.forEach(opcion => opcion.selected = true);
            this.msMesProv.updateLabel(false);
            this.msMesProv.render();
        }
    }

    limpiarSeleccionFiltrosParticipacion() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_meses';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        if (this.msEmpresaParticipacion) {
            this.msEmpresaParticipacion.options.forEach(opcion => opcion.selected = true);
            this.msEmpresaParticipacion.updateLabel(false);
            this.msEmpresaParticipacion.render();
        }
    }

    limpiarSeleccionFiltrosParticipacionProv() {
        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_meses';
        }

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        if (this.msProvinciaParticipacion) {
            this.msProvinciaParticipacion.options.forEach(opcion => opcion.selected = opcion.id === 'ILO');
            if (!this.msProvinciaParticipacion.options.some(opcion => opcion.selected) && this.msProvinciaParticipacion.options.length > 0) {
                this.msProvinciaParticipacion.options[0].selected = true;
            }
            this.msProvinciaParticipacion.updateLabel(false);
            this.msProvinciaParticipacion.render();
        }

        if (this.msProveedorParticipacion) {
            this.msProveedorParticipacion.options.forEach(opcion => opcion.selected = true);
            this.msProveedorParticipacion.updateLabel(false);
            this.msProveedorParticipacion.render();
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

    renderDashAnalisisAqp() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosEmpresa'];

        if (!componente || typeof componente.renderDashboard !== 'function') {
            this.mostrarError('No se encontró el componente de Análisis AQP.');
            return;
        }

        componente.renderDashboard(this, this.datosDashAqp, 'contenedor-graficos-lista', {
            height: 320,
            minWidth: 1000
        });
    }

    renderDashAnalisisProv() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosEmpresa'];

        if (!componente || typeof componente.renderDashboard !== 'function') {
            this.mostrarError('No se encontró el componente de Análisis PROV.');
            return;
        }

        componente.renderDashboard(this, this.datosDashProv, 'contenedor-graficos-lista', {
            height: 320,
            minWidth: 1000
        });
    }

    renderParticipacionAqp() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosParticipacionAQP'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de Participación de Mercado AQP.');
            return;
        }

        componente.render(this, this.datosParticipacionAqp, 'contenedor-graficos-lista');
    }

    renderParticipacionProv() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosParticipacionPROV'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de Participación de Mercado PROV.');
            return;
        }

        componente.render(this, this.datosParticipacionProv, 'contenedor-graficos-lista');
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
