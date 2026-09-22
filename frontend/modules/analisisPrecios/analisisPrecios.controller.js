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
        this.setupPeriodo();
        this.setupListeners();
        await this.onCargarClick();
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
        const btnCargar = document.getElementById('btn-cargar');
        const originalBtnHtml = btnCargar ? btnCargar.innerHTML : '';

        if (btnCargar) {
            btnCargar.disabled = true;
            btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
            btnCargar.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando...</span>
            `;
        }

        try {
            const selTipoGrafico = document.getElementById('select-tipo-grafico');
            const tipoGrafico = selTipoGrafico ? selTipoGrafico.value : 'DashAnalisiPrecios';

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
                alert('No se pudieron cargar los datos del dashboard.');
                return;
            }

            this.datosDashboard = resp.payload || resp.data;

            // Delegar renderizado al componente registrado en ChartRegistry
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
                window.ChartRegistry[tipoGrafico].render(this, this.datosDashboard);
            } else {
                console.warn(`No se encontró componente registrado para tipo_grafico="${tipoGrafico}".`);
            }

        } catch (error) {
            console.error('Error en onCargarClick:', error);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }
}

// Inicializar controlador al cargar DOM
document.addEventListener('DOMContentLoaded', () => {
    window.analisisPreciosController = new AnalisisPreciosController();
});
