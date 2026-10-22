const CRIADOR_EMPRE_GRAFICOS = {
    CantidadesTabla: {
        tipoGrafico: 'CantidadesTabla',
        titulo: 'Volumen Semanal Total',
        chartKey: 'CriadorEmpreCantidadesTabla'
    },
    CantidadesGrafico: {
        tipoGrafico: 'CantidadesGrafico',
        titulo: 'Volumen Semanal Total',
        chartKey: 'CriadorEmpreCantidadesGrafico'
    },
    DashCantidades: {
        tipoGrafico: 'DashCantidades',
        titulo: 'Volumen Semanal Total',
        chartKeys: ['CriadorEmpreCantidadesTabla', 'CriadorEmpreCantidadesGrafico']
    }
};

class CriadorEmpreController {
    constructor() {
        this.service = new CriadorEmpreService();
        this.tipoGraficoActual = 'CantidadesTabla';
        this.config = CRIADOR_EMPRE_GRAFICOS[this.tipoGraficoActual];
        this.datos = null;
        this.tiposOptions = [];
        this.provinciasOptions = [];
        this.proveedoresOptions = [];
        this.tiposDefault = [];
        this.provinciasDefault = [];
        this.proveedoresDefault = [];
        this.aniosOptions = [];
        this.anioInicioDefault = null;
        this.anioFinDefault = null;
        this.msTipo = null;
        this.msProvincia = null;
        this.msProveedor = null;
        this.filtrosCargados = false;
        this.cargando = false;
        this.requestSeq = 0;
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
            this.inicializarPeriodoDefecto();
            await this.cargarFiltros();
            await this.cargarDashboard(true);
        } catch (error) {
            console.error('Error al cargar CriadorEmpre:', error);
            this.mostrarError(error.message || 'No se pudo cargar el gráfico.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-criadorempre');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.filtrosPeriodoFechas = document.getElementById('filtros-periodo-fechas');
        this.filtrosAnioGrafico = document.getElementById('filtros-anio-grafico');
        this.selectAnioInicio = document.getElementById('select-anio-inicio');
        this.selectAnioFin = document.getElementById('select-anio-fin');
        this.filtroProvincia = document.getElementById('filtro-provincia');
        this.filtroProveedor = document.getElementById('filtro-proveedor');
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
                if (this.esDashCantidades()) {
                    this.inicializarPeriodoAnioActual();
                } else {
                    this.inicializarPeriodoDefecto();
                }

                this.resetSeleccionFiltros();
                await this.cargarDashboard();
            });
        }
    }

    async cambiarGrafico(tipo) {
        const config = CRIADOR_EMPRE_GRAFICOS[tipo];
        if (!config) return;

        this.requestSeq += 1;
        this.destruirComponenteActual();
        if (this.contenedorGraficos) {
            this.contenedorGraficos.innerHTML = '';
        }
        this.tipoGraficoActual = tipo;
        this.config = config;
        this.datos = null;
        this.actualizarVisibilidadFiltros();

        if (this.esDashCantidades()) {
            this.inicializarPeriodoAnioActual();
        }

        this.actualizarSubtitulo();
        this.limpiarError();
        await this.cargarDashboard();
    }

    esGraficoTabla(tipo = this.tipoGraficoActual) {
        return tipo === 'CantidadesTabla';
    }

    esGraficoLineas(tipo = this.tipoGraficoActual) {
        return tipo === 'CantidadesGrafico';
    }

    esDashCantidades(tipo = this.tipoGraficoActual) {
        return tipo === 'DashCantidades';
    }

    actualizarVisibilidadFiltros() {
        const mostrarPeriodo = this.esGraficoTabla() || this.esDashCantidades();
        const mostrarAnios = this.esGraficoLineas();
        const mostrarProvincia = !mostrarAnios;
        const mostrarProveedor = this.esDashCantidades();

        this.toggleElemento(this.filtrosPeriodoFechas, mostrarPeriodo);
        this.toggleElemento(this.filtrosAnioGrafico, mostrarAnios);
        this.toggleElemento(this.filtroProvincia, mostrarProvincia);
        this.toggleElemento(this.filtroProveedor, mostrarProveedor);
    }

    toggleElemento(elemento, mostrar) {
        if (!elemento) return;
        elemento.classList.toggle('hidden', !mostrar);
        elemento.classList.toggle('flex', mostrar);
    }

    destruirComponenteActual() {
        const keys = this.config.chartKeys || [this.config.chartKey];

        keys.forEach(key => {
            const componente = window.ChartRegistry && window.ChartRegistry[key];
            if (componente && typeof componente.destroy === 'function') {
                componente.destroy();
            }
        });
    }

    inicializarPeriodoDefecto() {
        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper.');
        }

        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        PeriodoHelper.renderizarInputs();

        const hoy = new Date();
        const diaAnterior = Math.min(
            hoy.getDate(),
            new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate()
        );
        const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, diaAnterior);

        const inputInicio = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');

        if (inputInicio) inputInicio.value = this.formatearFecha(desde);
        if (inputFin) inputFin.value = this.formatearFecha(hoy);
    }

    inicializarPeriodoAnioActual() {
        if (typeof PeriodoHelper === 'undefined') {
            throw new Error('No se encontró PeriodoHelper.');
        }

        if (this.selectTipoPeriodo) {
            this.selectTipoPeriodo.value = 'entre_fechas';
        }

        PeriodoHelper.renderizarInputs();

        const hoy = new Date();
        const inputInicio = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');

        if (inputInicio) inputInicio.value = `${hoy.getFullYear()}-01-01`;
        if (inputFin) inputFin.value = this.formatearFecha(hoy);
    }

    formatearFecha(fecha) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        return `${anio}-${mes}-${dia}`;
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
        this.provinciasOptions = Array.isArray(data.provincias) ? data.provincias : [];
        this.proveedoresOptions = Array.isArray(data.proveedores) ? data.proveedores : [];
        this.tiposDefault = Array.isArray(data.tipos_default) ? data.tipos_default : [];
        this.provinciasDefault = Array.isArray(data.provincias_default) ? data.provincias_default : [];
        this.proveedoresDefault = Array.isArray(data.proveedores_default) ? data.proveedores_default : [];

        if (this.tiposDefault.length === 0) {
            this.tiposDefault = this.tiposOptions.map(item => String(item.id));
        }

        if (this.provinciasDefault.length === 0) {
            this.provinciasDefault = this.provinciasOptions.map(item => String(item.id));
        }

        if (this.proveedoresDefault.length === 0) {
            this.proveedoresDefault = this.proveedoresOptions.map(item => String(item.id));
        }

        this.inicializarMultiSelects();
        this.inicializarSelectsAnio(data);
        this.filtrosCargados = true;
    }

    inicializarSelectsAnio(data = {}) {
        this.aniosOptions = Array.isArray(data.anios)
            ? data.anios.map(valor => parseInt(valor, 10)).filter(valor => Number.isFinite(valor))
            : [];

        if (this.aniosOptions.length === 0) {
            this.anioInicioDefault = null;
            this.anioFinDefault = null;
            return;
        }

        const anioMin = Math.min(...this.aniosOptions);
        const anioMax = Math.max(...this.aniosOptions);
        const inicio = parseInt(data.anio_inicio_default, 10);
        const fin = parseInt(data.anio_fin_default, 10);

        this.anioInicioDefault = Number.isFinite(inicio) ? inicio : Math.max(anioMin, anioMax - 1);
        this.anioFinDefault = Number.isFinite(fin) ? fin : anioMax;

        const opcionesHtml = this.aniosOptions
            .map(anio => `<option value="${anio}">${anio}</option>`)
            .join('');

        if (this.selectAnioInicio) {
            this.selectAnioInicio.innerHTML = opcionesHtml;
            this.selectAnioInicio.value = String(this.anioInicioDefault);
        }

        if (this.selectAnioFin) {
            this.selectAnioFin.innerHTML = opcionesHtml;
            this.selectAnioFin.value = String(this.anioFinDefault);
        }
    }

    inicializarMultiSelects() {
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect.');
        }

        const opcionesTipo = this.tiposOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: this.tiposDefault.includes(id)
            };
        });

        const opcionesProvincia = this.provinciasOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: this.provinciasDefault.includes(id)
            };
        });

        const opcionesProveedor = this.proveedoresOptions.map(item => {
            const id = String(item.id);
            return {
                id,
                label: item.label || id,
                selected: this.proveedoresDefault.includes(id)
            };
        });

        if (!this.msTipo) {
            this.msTipo = new CustomMultiSelect({
                btnId: 'ms-tipo-btn',
                labelId: 'ms-tipo-label',
                dropdownId: 'ms-tipo-dropdown',
                searchId: 'ms-tipo-search',
                optionsContainerId: 'ms-tipo-options',
                title: 'TIPO',
                options: opcionesTipo
            });
        } else {
            this.msTipo.clearSelection(false);
            this.msTipo.setOptions(opcionesTipo);
        }

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
        } else {
            this.msProveedor.clearSelection(false);
            this.msProveedor.setOptions(opcionesProveedor);
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

        if (this.msProvincia) {
            this.msProvincia.options.forEach(opcion => {
                opcion.selected = this.provinciasDefault.includes(opcion.id);
            });
            this.msProvincia.updateLabel(false);
            this.msProvincia.render();
        }

        if (this.msProveedor) {
            this.msProveedor.options.forEach(opcion => {
                opcion.selected = this.proveedoresDefault.includes(opcion.id);
            });
            this.msProveedor.updateLabel(false);
            this.msProveedor.render();
        }

        if (this.selectAnioInicio && this.anioInicioDefault !== null) {
            this.selectAnioInicio.value = String(this.anioInicioDefault);
        }

        if (this.selectAnioFin && this.anioFinDefault !== null) {
            this.selectAnioFin.value = String(this.anioFinDefault);
        }
    }

    obtenerSolicitud() {
        const tipos = this.msTipo ? this.msTipo.getSelectedValues() : [];
        const provinciasTabla = this.msProvincia ? this.msProvincia.getSelectedValues() : [];
        const proveedores = this.msProveedor ? this.msProveedor.getSelectedValues() : [];

        if (this.esDashCantidades()) {
            const rango = this.obtenerRango();

            return {
                tipo_grafico: this.config.tipoGrafico,
                fecha_inicio: rango.fechaInicio,
                fecha_fin: rango.fechaFin,
                tipos,
                provincias: provinciasTabla,
                proveedores
            };
        }

        if (this.esGraficoLineas()) {
            // CantidadesGrafico usa las mismas 7 provincias configuradas en Tableau.
            const provincias = this.provinciasDefault.length > 0
                ? this.provinciasDefault
                : this.provinciasOptions.map(item => String(item.id));

            const anioInicio = parseInt(this.selectAnioInicio ? this.selectAnioInicio.value : '', 10);
            const anioFin = parseInt(this.selectAnioFin ? this.selectAnioFin.value : '', 10);

            if (!Number.isFinite(anioInicio) || !Number.isFinite(anioFin)) {
                throw new Error('Selecciona un rango de años válido.');
            }

            if (anioInicio > anioFin) {
                throw new Error('El año inicial no puede ser mayor que el año final.');
            }

            return {
                tipo_grafico: this.config.tipoGrafico,
                anio_inicio: anioInicio,
                anio_fin: anioFin,
                tipos,
                provincias
            };
        }

        const rango = this.obtenerRango();

        return {
            tipo_grafico: this.config.tipoGrafico,
            fecha_inicio: rango.fechaInicio,
            fecha_fin: rango.fechaFin,
            tipos,
            provincias: provinciasTabla
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

            if (this.esDashCantidades()) {
                if (!data || !data.tabla || !data.grafico) {
                    throw new Error('No se recibieron datos para DashCantidades.');
                }
            } else if (!data || !Array.isArray(data.columnas)) {
                throw new Error('No se recibieron datos para CriadorEmpre.');
            }

            this.datos = data;
            this.actualizarSubtitulo(data);
            this.render();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar CriadorEmpre:', error);
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
        if (this.esDashCantidades()) {
            const componenteTabla = window.ChartRegistry && window.ChartRegistry['CriadorEmpreCantidadesTabla'];
            const componenteGrafico = window.ChartRegistry && window.ChartRegistry['CriadorEmpreCantidadesGrafico'];

            if (!componenteTabla || !componenteGrafico) {
                this.mostrarError('No se encontraron los componentes de DashCantidades.');
                return;
            }

            this.contenedorGraficos.innerHTML = `
                <div id="dash-cantidades-tabla"></div>
                <div id="dash-cantidades-grafico"></div>
            `;

            componenteTabla.render(this, this.datos.tabla, 'dash-cantidades-tabla');
            componenteGrafico.render(this, this.datos.grafico, 'dash-cantidades-grafico');
            return;
        }

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
        const fechaInicio = (data && (data.fecha_inicio || (data.tabla && data.tabla.fecha_inicio))) || '';
        const fechaFin = (data && (data.fecha_fin || (data.tabla && data.tabla.fecha_fin))) || '';

        if (this.esGraficoLineas() && data && data.anio_inicio && data.anio_fin) {
            this.subtituloModulo.textContent = `${titulo} · ${data.anio_inicio} - ${data.anio_fin}`;
            return;
        }

        if (fechaInicio && fechaFin) {
            this.subtituloModulo.textContent = `${titulo} · ${fechaInicio} al ${fechaFin}`;
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
                    titulo: 'Cargando CriadorEmpre',
                    subtitulo: 'Obteniendo volumen semanal...'
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
    window.criadorEmpreController = new CriadorEmpreController();
});
