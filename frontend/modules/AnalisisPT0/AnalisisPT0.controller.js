/**
 * Controlador de DashAnalisisPT0.
 * Administra filtros de fecha, carga de data y filtro cruzado entre tablas.
 */
class AnalisisPT0Controller {
    constructor() {
        this.service = new AnalisisPT0Service();
        this.base = [];
        this.dashboard2Data = null;
        this.rangoDisponible = null;
        this.seleccion = null;
        this.cargando = false;
        this.anioActual = '2026';
        this.tipoGraficoActual = 'DashAnalisisPT0';
        this.talmOptions = [];
        this.talmDefault = 'PB7';
        this.talmDefaults = {};
        this.talmPorVista = {};
        this.talmSeleccionados = [];
        this.multiTalm = null;

        this.charts = [
            {
                key: 'detalle_fecha',
                registry: 'AnalisisPT0DetalleFecha',
                container: 'contenedor-detalle-fecha'
            },
            {
                key: 'detalle_cliente',
                registry: 'AnalisisPT0DetalleCliente',
                container: 'contenedor-detalle-cliente'
            },
            {
                key: 'detalle_cliente_traan',
                registry: 'AnalisisPT0DetalleClienteTraan',
                container: 'contenedor-detalle-cliente-traan'
            },
            {
                key: 'detalle_dia',
                registry: 'AnalisisPT0DetalleDia',
                container: 'contenedor-detalle-dia'
            }
        ];

        this.sourceLabels = {
            detalle_fecha: 'DetalleFecha',
            detalle_cliente: 'DetalleCliente',
            detalle_cliente_traan: 'DetalleClienteTraan'
        };

        this.init();
    }

    async init() {
        this.cachearElementos();

        if (this.selectAnio) {
            this.anioActual = this.selectAnio.value || '2026';
        }

        this.actualizarTitulos();
        this.setupListeners();
        this.actualizarVisibilidadTipoGrafico();
        await this.cargarFiltrosIniciales();
    }

    cachearElementos() {
        this.selectAnio = document.getElementById('select-anio');
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.tituloModulo = document.getElementById('titulo-modulo-pt0');
        this.subtituloModulo = document.getElementById('subtitulo-modulo-pt0');
        this.inputMes = document.getElementById('input-mes');
        this.inputDia = document.getElementById('input-dia');
        this.contenedorFiltroTalm = document.getElementById('contenedor-filtro-talm');
        this.contenedorDash = document.getElementById('contenedor-graficos-lista');
        this.contenedorAlmaFecha = document.getElementById('contenedor-almafecha');
        this.contenedorFechaCliente = document.getElementById('contenedor-fechacliente');
        this.contenedorFechaClienteTrans = document.getElementById('contenedor-fechaclientetrans');
        this.contenedorFechaClienteTransCod = document.getElementById('contenedor-fechaclientetranscod');
        this.contenedorDashboard2 = document.getElementById('contenedor-dashboard2');
        this.contenedorDash2AlmaFecha = document.getElementById('contenedor-dashboard2-almafecha');
        this.contenedorDash2FechaCliente = document.getElementById('contenedor-dashboard2-fechacliente');
        this.contenedorDash2FechaClienteTransCod = document.getElementById('contenedor-dashboard2-fechaclientetranscod');
        this.btnCargar = document.getElementById('btn-cargar');
        this.btnLimpiar = document.getElementById('btn-limpiar');
        this.btnQuitarFiltro = document.getElementById('btn-quitar-filtro');
        this.chipFiltro = document.getElementById('chip-filtro-activo');
        this.chipFiltroTexto = document.getElementById('chip-filtro-texto');
        this.mensajeError = document.getElementById('mensaje-error');
        this.loaderInicial = document.getElementById('loader-inicial-pagina');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
    }

    setupListeners() {
        if (this.selectAnio) {
            this.selectAnio.addEventListener('change', async (event) => {
                this.anioActual = event.target.value || '2026';
                this.actualizarTitulos();
                this.seleccion = null;
                this.talmPorVista = {};
                this.talmSeleccionados = [];
                await this.cargarFiltrosIniciales();
            });
        }

        if (this.btnCargar) {
            this.btnCargar.addEventListener('click', () => this.cargarDashboard());
        }

        if (this.btnLimpiar) {
            this.btnLimpiar.addEventListener('click', () => this.restablecer());
        }

        if (this.btnQuitarFiltro) {
            this.btnQuitarFiltro.addEventListener('click', () => {
                this.seleccion = null;
                this.renderTablas();
            });
        }

        if (this.inputMes) {
            this.inputMes.addEventListener('change', () => {
                if (this.inputDia && this.inputDia.value && this.inputDia.value.slice(0, 7) !== this.inputMes.value) {
                    this.inputDia.value = '';
                }
                this.actualizarLimitesDia();
            });
        }

        if (this.inputDia) {
            this.inputDia.addEventListener('change', () => {
                if (this.inputDia.value && this.inputMes) {
                    this.inputMes.value = this.inputDia.value.slice(0, 7);
                }
                this.actualizarLimitesDia();
            });
        }

        [this.inputMes, this.inputDia].forEach(input => {
            if (!input) return;
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter') this.cargarDashboard();
            });
        });

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
    }

    actualizarTitulos() {
        const anio = this.anioActual || '2026';
        document.title = `Análisis PT0 ${anio} - Planta Beneficio`;

        if (this.tituloModulo) {
            this.tituloModulo.textContent = `Análisis PT0 ${anio}`;
        }

        if (this.subtituloModulo) {
            this.subtituloModulo.textContent = `DashAnalisisPT0 ${anio} · Movimientos Planta Beneficio`;
        }
    }

    async cargarFiltrosIniciales() {
        this.mostrarLoader(true);

        const respuesta = await this.service.obtenerFiltros(this.anioActual);

        if (!respuesta.success) {
            this.mostrarLoader(false);
            this.mostrarError(respuesta.message || 'No se pudieron obtener las fechas disponibles.');
            return;
        }

        const data = respuesta.data || {};
        this.anioActual = data.anio || this.anioActual;

        if (this.selectAnio) {
            this.selectAnio.value = this.anioActual;
        }
        this.actualizarTitulos();

        this.rangoDisponible = data;
        this.talmOptions = Array.isArray(data.talm_options) ? data.talm_options : [];
        this.talmDefault = data.talm_default || 'PB7';
        this.talmDefaults = data.talm_defaults || {};
        this.inicializarMultiTalm();

        const hoy = new Date();
        const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
        const mes = data.ultimo_mes
            || (data.ultimo_mes_inicio ? data.ultimo_mes_inicio.slice(0, 7) : `${this.anioActual}-${mesActual}`);

        if (this.inputMes) this.inputMes.value = mes;
        if (this.inputDia) this.inputDia.value = '';

        this.actualizarLimitesDia();

        await this.cargarDashboard(true);
        this.mostrarLoader(false);
    }

    actualizarLimitesDia() {
        if (!this.inputMes) return;

        const anio = this.anioActual || '2026';

        // El selector de mes debe permitir todos los meses del año,
        // aunque no existan datos para algunos de ellos.
        this.inputMes.min = `${anio}-01`;
        this.inputMes.max = `${anio}-12`;

        if (!this.inputDia) return;

        const mes = this.inputMes.value;
        if (!mes) {
            this.inputDia.min = '';
            this.inputDia.max = '';
            return;
        }

        const [anioMes, numeroMes] = mes.split('-').map(Number);
        const ultimoDiaMes = new Date(anioMes, numeroMes, 0).getDate();
        const minDia = `${mes}-01`;
        const maxDia = `${mes}-${String(ultimoDiaMes).padStart(2, '0')}`;

        this.inputDia.min = minDia;
        this.inputDia.max = maxDia;

        if (this.inputDia.value && (this.inputDia.value < minDia || this.inputDia.value > maxDia)) {
            this.inputDia.value = '';
        }
    }

    inicializarMultiTalm() {
        if (typeof CustomMultiSelect === 'undefined') return;
        if (!document.getElementById('btn-dropdown-talm')) return;

        const defaults = this.obtenerDefaultsVista(this.tipoGraficoActual);
        const opciones = this.talmOptions.map(item => ({
            id: item.codigo,
            label: item.codigo,
            selected: defaults.includes(item.codigo)
        }));

        if (this.multiTalm) {
            this.multiTalm.clearSelection(false);
            this.multiTalm.setOptions(opciones);
            return;
        }

        this.multiTalm = new CustomMultiSelect({
            btnId: 'btn-dropdown-talm',
            labelId: 'label-talm',
            dropdownId: 'dropdown-talm',
            searchId: 'search-talm',
            optionsContainerId: 'container-options-talm',
            title: 'TALM',
            options: opciones,
            onChange: () => {
                if (!this.multiTalm) return;
                this.talmPorVista[this.tipoGraficoActual] = this.multiTalm.getSelectedValues();
            }
        });
    }

    obtenerDefaultsVista(vista) {
        const defaults = this.talmDefaults[vista];
        if (Array.isArray(defaults) && defaults.length > 0) {
            return defaults;
        }

        return [this.talmDefault];
    }

    aplicarSeleccionTalm(codigos) {
        if (!this.multiTalm) return;

        const seleccionados = new Set(codigos || []);
        this.multiTalm.options.forEach(opcion => {
            opcion.selected = seleccionados.has(opcion.id);
        });

        this.multiTalm.updateLabel(false);
        this.multiTalm.render();
        this.talmPorVista[this.tipoGraficoActual] = this.multiTalm.getSelectedValues();
    }

    establecerTalmDefault() {
        this.aplicarSeleccionTalm(this.obtenerDefaultsVista(this.tipoGraficoActual));
    }

    cambiarTipoGrafico(valor) {
        this.tipoGraficoActual = valor || 'DashAnalisisPT0';

        if (this.selectTipoGrafico && this.selectTipoGrafico.value !== this.tipoGraficoActual) {
            this.selectTipoGrafico.value = this.tipoGraficoActual;
        }

        this.seleccion = null;

        if (this.tipoGraficoActual !== 'DashAnalisisPT0' && this.multiTalm) {
            const seleccion = this.talmPorVista[this.tipoGraficoActual]
                || this.obtenerDefaultsVista(this.tipoGraficoActual);
            this.aplicarSeleccionTalm(seleccion);
        }

        this.actualizarVisibilidadTipoGrafico();

        if (this.rangoDisponible) {
            this.cargarDashboard();
        }
    }

    actualizarVisibilidadTipoGrafico() {
        const esAlmaFecha = this.tipoGraficoActual === 'AlmaFecha';
        const esFechaCliente = this.tipoGraficoActual === 'FechaCliente';
        const esFechaClienteTrans = this.tipoGraficoActual === 'FechaClienteTrans';
        const esFechaClienteTransCod = this.tipoGraficoActual === 'FechaClienteTransCod';
        const esDashboard2 = this.tipoGraficoActual === 'Dashboard2';
        const usaTalm = esAlmaFecha || esFechaCliente || esFechaClienteTrans || esFechaClienteTransCod || esDashboard2;

        if (this.contenedorFiltroTalm) {
            this.contenedorFiltroTalm.classList.toggle('hidden', !usaTalm);
            this.contenedorFiltroTalm.classList.toggle('flex', usaTalm);
        }

        if (this.contenedorDash) {
            this.contenedorDash.classList.toggle('hidden', usaTalm);
        }

        if (this.contenedorAlmaFecha) {
            this.contenedorAlmaFecha.classList.toggle('hidden', !esAlmaFecha);
        }

        if (this.contenedorFechaCliente) {
            this.contenedorFechaCliente.classList.toggle('hidden', !esFechaCliente);
        }

        if (this.contenedorFechaClienteTrans) {
            this.contenedorFechaClienteTrans.classList.toggle('hidden', !esFechaClienteTrans);
        }

        if (this.contenedorFechaClienteTransCod) {
            this.contenedorFechaClienteTransCod.classList.toggle('hidden', !esFechaClienteTransCod);
        }

        if (this.contenedorDashboard2) {
            this.contenedorDashboard2.classList.toggle('hidden', !esDashboard2);
            this.contenedorDashboard2.classList.toggle('flex', esDashboard2);
        }
    }

    async cargarDashboard(esCargaInicial = false) {
        if (this.cargando) return;

        this.limpiarError();

        const mes = (this.inputMes && this.inputMes.value) || '';
        const dia = (this.inputDia && this.inputDia.value) || '';

        if (!mes) {
            this.mostrarError('Debes seleccionar el mes.');
            return;
        }

        const tipoGrafico = (this.selectTipoGrafico && this.selectTipoGrafico.value) || 'DashAnalisisPT0';
        this.tipoGraficoActual = tipoGrafico;

        const payload = {
            anio: this.anioActual,
            tipo_grafico: tipoGrafico,
            mes,
            dia
        };

        if (tipoGrafico === 'AlmaFecha' || tipoGrafico === 'FechaCliente' || tipoGrafico === 'FechaClienteTrans' || tipoGrafico === 'FechaClienteTransCod' || tipoGrafico === 'Dashboard2') {
            payload.talm = this.multiTalm ? this.multiTalm.getSelectedValues() : [];
        }

        this.cargando = true;
        this.setBotonCargando(true);

        if (!esCargaInicial) this.mostrarLoader(true);

        try {
            const respuesta = await this.service.obtenerDashboard(payload);

            if (!respuesta.success) {
                this.mostrarError(respuesta.message || 'No se pudo cargar la información.');
                return;
            }

            const data = respuesta.data || {};
            this.base = Array.isArray(data.base) ? data.base : [];
            this.dashboard2Data = data;
            this.tipoGraficoActual = data.tipo_grafico || tipoGrafico;
            this.talmSeleccionados = Array.isArray(data.talm_seleccionados) ? data.talm_seleccionados : [];
            this.seleccion = null;
            this.actualizarVisibilidadTipoGrafico();

            if (data.filtros) {
                if (this.inputMes && data.filtros.mes) {
                    this.inputMes.value = data.filtros.mes;
                }
                if (this.inputDia) {
                    this.inputDia.value = data.filtros.dia || '';
                }
                this.actualizarLimitesDia();
            }

            if (data.rango_disponible) {
                this.rangoDisponible = data.rango_disponible;
            }

            this.renderTablas();
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
            this.mostrarLoader(false);
        }
    }

    restablecer() {
        const data = this.rangoDisponible || {};
        const hoy = new Date();
        const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
        const mes = data.ultimo_mes
            || (data.ultimo_mes_inicio ? data.ultimo_mes_inicio.slice(0, 7) : `${this.anioActual}-${mesActual}`);

        if (this.inputMes) {
            this.inputMes.value = mes;
        }
        if (this.inputDia) {
            this.inputDia.value = '';
        }

        this.actualizarLimitesDia();
        this.establecerTalmDefault();
        this.seleccion = null;
        this.cargarDashboard();
    }

    renderTablas() {
        if (this.tipoGraficoActual === 'AlmaFecha') {
            const componente = window.ChartRegistry && window.ChartRegistry['AnalisisPT0AlmaFecha'];

            if (componente) {
                componente.render(
                    this,
                    {
                        base: this.base,
                        talm: this.talmSeleccionados
                    },
                    'contenedor-almafecha'
                );
            } else {
                console.warn('No se encontró el componente AnalisisPT0AlmaFecha.');
            }

            this.actualizarChipFiltro();
            return;
        }

        if (this.tipoGraficoActual === 'FechaCliente') {
            const componente = window.ChartRegistry && window.ChartRegistry['AnalisisPT0FechaCliente'];

            if (componente) {
                componente.render(
                    this,
                    {
                        base: this.base,
                        talm: this.talmSeleccionados
                    },
                    'contenedor-fechacliente'
                );
            } else {
                console.warn('No se encontró el componente AnalisisPT0FechaCliente.');
            }

            this.actualizarChipFiltro();
            return;
        }

        if (this.tipoGraficoActual === 'FechaClienteTrans') {
            const componente = window.ChartRegistry && window.ChartRegistry['AnalisisPT0FechaClienteTrans'];

            if (componente) {
                componente.render(
                    this,
                    {
                        base: this.base,
                        talm: this.talmSeleccionados
                    },
                    'contenedor-fechaclientetrans'
                );
            } else {
                console.warn('No se encontró el componente AnalisisPT0FechaClienteTrans.');
            }

            this.actualizarChipFiltro();
            return;
        }

        if (this.tipoGraficoActual === 'FechaClienteTransCod') {
            const componente = window.ChartRegistry && window.ChartRegistry['AnalisisPT0FechaClienteTransCod'];

            if (componente) {
                componente.render(
                    this,
                    {
                        base: this.base,
                        talm: this.talmSeleccionados
                    },
                    'contenedor-fechaclientetranscod'
                );
            } else {
                console.warn('No se encontró el componente AnalisisPT0FechaClienteTransCod.');
            }

            this.actualizarChipFiltro();
            return;
        }

        if (this.tipoGraficoActual === 'Dashboard2') {
            const data = this.dashboard2Data || {};
            const talm = this.talmSeleccionados;

            window.ChartRegistry?.['AnalisisPT0AlmaFecha']?.render(
                this,
                { base: data.alma_fecha || [], talm },
                'contenedor-dashboard2-almafecha'
            );

            window.ChartRegistry?.['AnalisisPT0FechaCliente']?.render(
                this,
                { base: data.fecha_cliente || [], talm },
                'contenedor-dashboard2-fechacliente'
            );

            window.ChartRegistry?.['AnalisisPT0FechaClienteTransCod']?.render(
                this,
                { base: data.fecha_cliente_transcod || [], talm, paginar: false },
                'contenedor-dashboard2-fechaclientetranscod'
            );

            this.actualizarChipFiltro();
            return;
        }

        this.charts.forEach(chart => {
            const componente = window.ChartRegistry && window.ChartRegistry[chart.registry];
            if (!componente) {
                console.warn(`No se encontró el componente ${chart.registry}.`);
                return;
            }

            componente.render(
                this,
                {
                    base: this.obtenerBasePara(chart.key),
                    seleccion: this.seleccion
                },
                chart.container
            );
        });

        this.actualizarChipFiltro();
    }

    obtenerBasePara(tabla) {
        if (!this.seleccion || !this.seleccion.items || !this.seleccion.items.length) {
            return this.base;
        }

        if (this.seleccion.source === tabla) {
            return this.base;
        }

        return this.base.filter(fila =>
            this.seleccion.items.some(item => this.coincideItem(fila, item))
        );
    }

    coincideItem(fila, item) {
        const dims = item.dims || {};

        for (const [key, value] of Object.entries(dims)) {
            if (String(fila[key]) !== String(value)) return false;
        }

        if (item.tipo && fila.tipo !== item.tipo) return false;

        return true;
    }

    claveSeleccion(item) {
        const dims = item.dims || {};
        const keys = Object.keys(dims).sort();
        const normalizado = {};

        keys.forEach(key => {
            normalizado[key] = dims[key];
        });

        return JSON.stringify({
            tipo: item.tipo || null,
            dims: normalizado
        });
    }

    seleccionar(source, values, tipo = null, aditivo = false) {
        const dimensionesPorFuente = {
            detalle_fecha: ['anio_mes', 'fecha'],
            detalle_cliente: ['anio_mes', 'fecha', 'cliente'],
            detalle_cliente_traan: ['anio_mes', 'fecha', 'cliente', 'tran']
        };

        const keys = dimensionesPorFuente[source];
        if (!keys) return;

        const dims = {};
        keys.forEach(key => {
            dims[key] = values[key];
        });

        const item = {
            dims,
            tipo: (tipo === 'Entrada' || tipo === 'Salida') ? tipo : null
        };

        if (!this.seleccion || this.seleccion.source !== source) {
            this.seleccion = { source, items: [] };
            aditivo = false;
        }

        const items = this.seleccion.items;
        const clave = this.claveSeleccion(item);
        const existe = items.some(actual => this.claveSeleccion(actual) === clave);
        const soloEste = items.length === 1 && existe;

        if (!aditivo) {
            if (soloEste) {
                this.seleccion = null;
                this.renderTablas();
                return;
            }

            this.seleccion.items = [item];
        } else if (existe) {
            this.seleccion.items = items.filter(actual => this.claveSeleccion(actual) !== clave);
        } else {
            this.seleccion.items = items.concat([item]);
        }

        if (!this.seleccion.items.length) {
            this.seleccion = null;
        }

        this.renderTablas();
    }

    actualizarChipFiltro() {
        if (!this.chipFiltro || !this.chipFiltroTexto) return;

        if (!this.seleccion || !this.seleccion.items || !this.seleccion.items.length) {
            this.chipFiltro.classList.add('hidden');
            return;
        }

        const items = this.seleccion.items;
        const partes = [];

        if (this.seleccion.source) {
            partes.push(this.sourceLabels[this.seleccion.source] || this.seleccion.source);
        }

        if (items.length === 1) {
            const dims = items[0].dims || {};

            if (dims.fecha) {
                partes.push(this.formatearFecha(dims.fecha));
            }

            if (dims.cliente) {
                partes.push(`Cliente ${dims.cliente}`);
            }

            if (dims.tran) {
                partes.push(`Tran ${dims.tran}`);
            }

            if (items[0].tipo) {
                partes.push(items[0].tipo);
            }
        } else {
            partes.push(`${items.length} selecciones`);

            const fechas = new Set(
                items.map(item => item.dims && item.dims.fecha).filter(Boolean)
            );

            if (fechas.size) {
                partes.push(`${fechas.size} fecha${fechas.size === 1 ? '' : 's'}`);
            }
        }

        this.chipFiltroTexto.textContent = partes.join(' · ');
        this.chipFiltro.classList.remove('hidden');
    }

    formatearFecha(fecha) {
        return window.AnalisisPT0Helper
            ? window.AnalisisPT0Helper.fmtFecha(fecha)
            : fecha;
    }

    mostrarLoader(mostrar) {
        if (typeof LoadingHelper === 'undefined') {
            if (this.loaderInicial) this.loaderInicial.classList.toggle('hidden', !mostrar);
            return;
        }

        if (mostrar) {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Análisis PT0',
                subtitulo: 'Obteniendo fechas y movimientos...'
            });
        } else {
            LoadingHelper.ocultarInicial();
        }
    }

    setBotonCargando(cargando) {
        if (!this.btnCargar || typeof LoadingHelper === 'undefined') return;

        if (cargando) {
            LoadingHelper.iniciarBoton(this.btnCargar, { texto: 'Cargando...' });
        } else {
            LoadingHelper.restaurarBoton(this.btnCargar);
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
    window.analisisPT0Controller = new AnalisisPT0Controller();
});

