const INFO_MERCADO2_GRAFICOS = {
    DashParticipacionMercadoAQP: {
        familia: 'AQP',
        tipoGrafico: 'ParticipacionMercadoAQP',
        chartKey: 'InfoMercadosParticipacionAQP',
        titulo: 'Participación de Mercado AQP',
        filtros: [
            {
                clave: 'empresas',
                etiqueta: 'EMPRESA',
                titulo: 'EMPRESA',
                placeholder: 'Buscar empresa...'
            }
        ]
    },
    DashParticipacionMercadoPROV: {
        familia: 'PROV',
        tipoGrafico: 'ParticipacionMercadoPROV',
        chartKey: 'InfoMercadosParticipacionPROV',
        titulo: 'Participación de Mercado PROV',
        filtros: [
            {
                clave: 'provincias',
                etiqueta: 'PROVINCIA',
                titulo: 'PROVINCIA',
                placeholder: 'Buscar provincia...'
            },
            {
                clave: 'proveedores',
                etiqueta: 'PROVEEDOR',
                titulo: 'PROVEEDOR',
                placeholder: 'Buscar proveedor...'
            }
        ]
    }
};

class InfoMercado2Controller {
    constructor() {
        this.service = new InfoMercado2Service();
        this.tipoGraficoActual = 'DashParticipacionMercadoAQP';
        this.config = INFO_MERCADO2_GRAFICOS[this.tipoGraficoActual];
        this.datos = null;
        this.multiselects = {};
        this.ultimoRango = null;
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
            this.inicializarPeriodoDefecto();
            await this.cargarConFiltros(true);
        } catch (error) {
            console.error('Error al cargar InfoMercado2:', error);
            this.mostrarError(error.message || 'No se pudo cargar el gráfico.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-infomercado2');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
        this.selectTipoPeriodo = document.getElementById('select-tipo-periodo');
        this.contenedorFiltrosDimension = document.getElementById('contenedor-filtros-dimension');
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
                await this.cargarConFiltros();
            });
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', async () => {
                this.inicializarPeriodoDefecto();

                Object.values(this.multiselects).forEach(multiselect => {
                    if (!multiselect) return;
                    multiselect.options.forEach(opcion => opcion.selected = true);
                    multiselect.updateLabel(false);
                    multiselect.render();
                });

                await this.cargarConFiltros();
            });
        }
    }

    async cambiarGrafico(tipo) {
        const config = INFO_MERCADO2_GRAFICOS[tipo];
        if (!config) return;

        this.requestSeq += 1;
        this.destruirGrafico();
        this.destruirFiltrosDimension();
        this.tipoGraficoActual = tipo;
        this.config = config;
        this.actualizarSubtitulo();
        this.limpiarError();

        await this.cargarConFiltros();
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

    async cargarConFiltros(esCargaInicial = false) {
        const seq = ++this.requestSeq;
        this.cargando = true;
        this.limpiarError();

        if (!esCargaInicial) {
            this.mostrarLoader(true);
            this.setBotonCargando(true);
        }

        try {
            const rango = this.obtenerRango();
            await this.cargarFiltrosDimension(rango);

            const solicitud = {
                tipo_grafico: this.config.tipoGrafico,
                anio: '2026',
                fecha_inicio: rango.fechaInicio,
                fecha_fin: rango.fechaFin
            };

            this.config.filtros.forEach(filtro => {
                solicitud[filtro.clave] = this.multiselects[filtro.clave]
                    ? this.multiselects[filtro.clave].getSelectedValues()
                    : [];
            });

            const data = await this.service.obtenerParticipacion(this.config.familia, solicitud);

            if (seq !== this.requestSeq || !this.config) {
                return;
            }

            if (!data || !Array.isArray(data.series)) {
                throw new Error('No se recibieron datos para el gráfico.');
            }

            this.datos = data;
            this.actualizarSubtitulo(data.titulo);
            this.render();
        } catch (error) {
            if (seq === this.requestSeq) {
                console.error('Error al cargar el gráfico:', error);
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

    async cargarFiltrosDimension(rango) {
        const data = await this.service.obtenerFiltrosParticipacion(
            this.config.familia,
            rango.fechaInicio,
            rango.fechaFin
        );

        const claveRango = `${rango.fechaInicio}|${rango.fechaFin}`;
        const cambioRango = this.ultimoRango !== null && this.ultimoRango !== claveRango;

        this.config.filtros.forEach(filtro => {
            const opciones = (Array.isArray(data[filtro.clave]) ? data[filtro.clave] : []).map(item => ({
                id: String(item.id),
                label: item.label || String(item.id),
                selected: true
            }));

            if (!this.multiselects[filtro.clave]) {
                this.crearFiltroDimension(filtro, opciones);
            } else {
                this.multiselects[filtro.clave].setOptions(opciones);

                if (cambioRango) {
                    this.multiselects[filtro.clave].selectAll(false);
                }
            }
        });

        this.ultimoRango = claveRango;
    }

    crearFiltroDimension(filtro, opciones) {
        if (!this.contenedorFiltrosDimension) return;
        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('No se encontró CustomMultiSelect.');
        }

        const id = `ms-${filtro.clave}`;
        this.contenedorFiltrosDimension.insertAdjacentHTML('beforeend', `
            <div class="relative flex flex-col">
                <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">${filtro.etiqueta}</label>
                <button id="${id}-btn" type="button"
                    class="flex items-center justify-between gap-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-semibold rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer min-w-[230px] max-w-[320px]">
                    <span id="${id}-label" class="truncate text-left select-none">(Todo)</span>
                    <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div id="${id}-dropdown"
                    class="custom-multiselect-dropdown hidden absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 flex flex-col gap-2">
                    <input id="${id}-search" type="text" placeholder="${filtro.placeholder || 'Buscar...'}"
                        class="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-normal">
                    <div id="${id}-options" class="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1 text-xs"></div>
                </div>
            </div>
        `);

        this.multiselects[filtro.clave] = new CustomMultiSelect({
            btnId: `${id}-btn`,
            labelId: `${id}-label`,
            dropdownId: `${id}-dropdown`,
            searchId: `${id}-search`,
            optionsContainerId: `${id}-options`,
            title: filtro.titulo,
            options: opciones
        });
    }

    destruirFiltrosDimension() {
        this.multiselects = {};
        this.ultimoRango = null;
        if (this.contenedorFiltrosDimension) {
            this.contenedorFiltrosDimension.innerHTML = '';
        }
    }

    destruirGrafico() {
        const componente = window.ChartRegistry && window.ChartRegistry[this.config.chartKey];
        if (componente && typeof componente.destroy === 'function') {
            componente.destroy();
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

    actualizarSubtitulo(titulo = null) {
        if (!this.subtituloModulo) return;

        this.subtituloModulo.textContent = titulo
            ? `${titulo} · Rango seleccionado`
            : `${this.config.titulo} · Rango seleccionado`;
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
                    titulo: 'Cargando InfoMercado2',
                    subtitulo: 'Obteniendo información de mercado...'
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
    window.infoMercado2Controller = new InfoMercado2Controller();
});
