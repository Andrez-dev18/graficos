/**
 * Controlador para la vista Análisis de Precios (LIMA 1 AnalisisPrecios)
 * Administra filtros de período (PeriodoHelper), filtros multiselect (TDOC, LINEA VENTA, CORPORATIVO, NOMCLIENTE, PROVINCIA, ZONA)
 * y despacho polimórfico a ChartRegistry.
 */
class AnalisisPreciosController {
    constructor() {
        this.service = new AnalisisPreciosService();
        this.chartInstance = null;
        this.chartTipoActual = null;
        this.datosDashboard = null;

        this.init();
    }

    destruirGraficaActual() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) {
            tt.classList.add('hidden');
            tt.style.display = 'none';
            tt.innerHTML = '';
        }
        if (this.chartTipoActual && window.ChartRegistry && window.ChartRegistry[this.chartTipoActual] && typeof window.ChartRegistry[this.chartTipoActual].destroy === 'function') {
            window.ChartRegistry[this.chartTipoActual].destroy();
        }
        if (this.chartInstance) {
            try {
                this.chartInstance.destroy();
            } catch (e) {
                console.warn('Error al destruir gráfico:', e);
            }
            this.chartInstance = null;
        }
    }

    async init() {
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Análisis de Precios',
                subtitulo: 'Inicializando gráficos y filtros...'
            });
        }
        try {
            this.setupPeriodo();
            this.setupListeners();
            await this.onCargarClick();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined') {
            const selPeriodo = document.getElementById('select-tipo-periodo');
            if (selPeriodo) {
                selPeriodo.value = 'entre_fechas';
            }
            PeriodoHelper.renderizarInputs();
        }
    }

    setupListeners() {
        // Selector de tipo de período dinámico
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) {
            selPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
            });
        }

        // Selector de tipo de gráfico
        const selTipoGrafico = document.getElementById('select-tipo-grafico');
        if (selTipoGrafico) {
            selTipoGrafico.addEventListener('change', async () => {
                await this.onCargarClick();
            });
        }

        // Toggle plegar / desplegar barra de filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const contFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');

        if (btnToggle && contFiltros) {
            btnToggle.addEventListener('click', () => {
                const estaOculto = contFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = estaOculto ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = estaOculto ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', async () => {
            await this.onCargarClick();
        });

        // Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', async () => {
            this.setupPeriodo();
            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'DashAnalisiPrecios';
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].resetFilters === 'function') {
                window.ChartRegistry[tipoGrafico].resetFilters();
            }
            await this.onCargarClick();
        });
    }

    async onCargarClick() {
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
        }

        try {
            const selTipoGrafico = document.getElementById('select-tipo-grafico');
            const tipoGrafico = selTipoGrafico ? selTipoGrafico.value : 'DashAnalisiPrecios';

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarEnContenedor('contenedor-grafica-costo', {
                    titulo: `Consultando ${tipoGrafico}...`,
                    subtitulo: 'Cargando datos de precios para el período...'
                });
            }

            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const tipoPeriodo = document.getElementById('select-tipo-periodo')?.value;
            if (tipoPeriodo === 'por_fecha') {
                const fUnica = document.getElementById('input-fecha-unica')?.value;
                if (fUnica) {
                    rango.fechaInicio = fUnica;
                    rango.fechaFin = fUnica;
                }
            }

            let extraFilters = {};
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].getSelectedFilters === 'function') {
                const selected = window.ChartRegistry[tipoGrafico].getSelectedFilters();
                if (selected && typeof selected === 'object') {
                    extraFilters = { ...extraFilters, ...selected };
                }
            }

            // Si es la carga inicial y aún no se instanciaron los filtros, aplicar los valores por defecto de Tableau
            if (!window.ChartRegistry?.[tipoGrafico]?.multiProvincia && !extraFilters.provincia) {
                extraFilters.provincia = ['AREQUIPA'];
            }
            if (tipoGrafico === 'DashAnalisiPrecios' && !window.ChartRegistry?.[tipoGrafico]?.multiZona && !extraFilters.zona) {
                extraFilters.zona = ['ZONA CONO NORTE'];
            }

            const filtros = {
                fecha_inicio: rango.fechaInicio || '2026-06-01',
                fecha_fin: rango.fechaFin || '2026-06-30',
                tipo_grafico: tipoGrafico,
                ...extraFilters
            };

            this.chartTipoActual = tipoGrafico;
            this.destruirGraficaActual();

            // Consultar datos al servicio
            const resp = await this.service.obtenerDashboard(filtros);

            if (!resp || resp.status !== 'success') {
                console.error('Error al obtener datos:', resp);
                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.mostrarError('contenedor-grafica-costo', {
                        mensaje: 'No se pudieron cargar los datos del dashboard.'
                    });
                }
                return;
            }

            this.datosDashboard = resp.payload || resp.data;

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-grafica-costo');
            }

            // Delegar renderizado al componente registrado en ChartRegistry
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
                window.ChartRegistry[tipoGrafico].render(this, this.datosDashboard);
            } else {
                console.warn(`No se encontró componente registrado para tipo_grafico="${tipoGrafico}".`);
            }

        } catch (error) {
            console.error('Error en onCargarClick:', error);
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-grafica-costo', {
                    mensaje: 'Ocurrió un error al procesar el análisis de precios.'
                });
            }
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.restaurarBoton('btn-cargar');
            }
        }
    }
}

// Inicializar controlador al cargar DOM
document.addEventListener('DOMContentLoaded', () => {
    window.analisisPreciosController = new AnalisisPreciosController();
});
