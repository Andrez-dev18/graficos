/**
 * Controlador para la vista PPT 2026
 * Administra filtros de período (PeriodoHelper), tipo de gráfico y despacho a ChartRegistry.
 */
class PPPT2026Controller {
    constructor() {
        this.service = new PPPT2026Service();
        this.chartTipoActual = 'PT';
        this.datosDashboard = null;
        this.init();
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
                selPeriodo.value = 'por_mes';
            }
            PeriodoHelper.renderizarInputs();

            // Asignar mes 2026-04 por defecto coincidiendo con Tableau si el campo está vacío
            const inputMes = document.getElementById('input-mes-unico');
            if (inputMes && !inputMes.value) {
                inputMes.value = '2026-04';
            }
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
            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'PT';
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
            const tipoGrafico = selTipoGrafico ? selTipoGrafico.value : 'PT';
            this.chartTipoActual = tipoGrafico;

            // Extraer fechas / mes
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const tipoPeriodo = document.getElementById('select-tipo-periodo')?.value;
            let mesSeleccionado = '';
            if (tipoPeriodo === 'por_mes') {
                mesSeleccionado = document.getElementById('input-mes-unico')?.value || '2026-04';
            } else if (rango.fechaInicio) {
                mesSeleccionado = rango.fechaInicio.substring(0, 7);
            }

            // Extraer filtros adicionales del componente activo (ej. actividad)
            let extraFilters = {};
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].getSelectedFilters === 'function') {
                const selected = window.ChartRegistry[tipoGrafico].getSelectedFilters();
                if (selected && typeof selected === 'object') {
                    extraFilters = { ...extraFilters, ...selected };
                }
            }

            // Filtro por defecto en la primera carga
            if (!extraFilters.actividad) {
                extraFilters.actividad = ['AV'];
            }

            const filtros = {
                tipo_grafico: tipoGrafico,
                mes: mesSeleccionado,
                fecha_inicio: rango.fechaInicio || '',
                fecha_fin: rango.fechaFin || '',
                ...extraFilters
            };

            // Consultar datos reales al backend
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

// Inicialización automática cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.pppt2026Controller = new PPPT2026Controller();
});
