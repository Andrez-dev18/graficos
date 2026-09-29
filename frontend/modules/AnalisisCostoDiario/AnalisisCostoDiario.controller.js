/**
 * Controlador para el Módulo AnalisisCostoDiario
 * Integra PeriodoHelper, Servicio y ChartRegistry.
 */
class AnalisisCostoDiarioController {
    constructor() {
        this.service = new AnalisisCostoDiarioService();
        this.chartTipoActual = 'CostoFormulaPorTipoAABB';
        this.datosDashboard = null;
        this.filtrosIniciales = null;

        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        await this.cargarFiltrosIniciales();
        await this.onCargarClick();
    }

    setupPeriodo() {
        // Inicializar selector de periodos
        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();

            // Set default dates if entre_fechas is active
            const inputIni = document.getElementById('input-fecha-inicio');
            const inputFin = document.getElementById('input-fecha-fin');
            if (inputIni) inputIni.value = '2026-02-19';
            if (inputFin) inputFin.value = '2026-03-21';
        }
    }

    async cargarFiltrosIniciales() {
        try {
            this.filtrosIniciales = await this.service.obtenerFiltrosIniciales();
            if (this.filtrosIniciales && this.filtrosIniciales.fecha_defecto) {
                const def = this.filtrosIniciales.fecha_defecto;
                const inputIni = document.getElementById('input-fecha-inicio');
                const inputFin = document.getElementById('input-fecha-fin');
                if (inputIni && def.inicio) inputIni.value = def.inicio;
                if (inputFin && def.fin) inputFin.value = def.fin;
            }
        } catch (e) {
            console.warn('Error cargando filtros iniciales:', e);
        }
    }

    setupListeners() {
        // Cambio de tipo de período
        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo) {
            selectPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
            });
        }

        // Toggle de Filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const contFiltros = document.getElementById('contenedor-filtros-contenido');
        const labelToggle = document.getElementById('label-toggle-filtros');
        const iconToggle = document.getElementById('icon-toggle-filtros');

        if (btnToggle && contFiltros) {
            btnToggle.addEventListener('click', () => {
                const isHidden = contFiltros.classList.contains('hidden');
                if (isHidden) {
                    contFiltros.classList.remove('hidden');
                    if (labelToggle) labelToggle.textContent = 'Ocultar filtros';
                    if (iconToggle) iconToggle.style.transform = 'rotate(0deg)';
                } else {
                    contFiltros.classList.add('hidden');
                    if (labelToggle) labelToggle.textContent = 'Mostrar filtros';
                    if (iconToggle) iconToggle.style.transform = 'rotate(180deg)';
                }
            });
        }

        // Botón Cargar
        const btnCargar = document.getElementById('btn-cargar');
        if (btnCargar) {
            btnCargar.addEventListener('click', async () => {
                await this.onCargarClick();
            });
        }

        // Botón Limpiar
        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.limpiarFiltros();
            });
        }
    }

    limpiarFiltros() {
        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo) {
            selectPeriodo.value = 'entre_fechas';
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        }

        const inputIni = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');
        if (inputIni) inputIni.value = '2026-02-19';
        if (inputFin) inputFin.value = '2026-03-21';

        this.onCargarClick();
    }

    obtenerFiltrosSeleccionados() {
        let rango = { fechaInicio: '2026-02-19', fechaFin: '2026-03-21' };

        if (typeof PeriodoHelper !== 'undefined') {
            rango = PeriodoHelper.obtenerRangoFechas();
        }

        return {
            tipo_grafico: 'CostoFormulaPorTipoAABB',
            fecha_inicio: rango.fechaInicio || '2026-02-19',
            fecha_fin: rango.fechaFin || '2026-03-21'
        };
    }

    async onCargarClick() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-xs border border-slate-200/80">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                    <p class="text-sm font-semibold text-slate-600">Cargando Análisis de Costo Diario...</p>
                </div>
            `;
        }

        const filtros = this.obtenerFiltrosSeleccionados();
        this.datosDashboard = await this.service.obtenerDashboard(filtros);

        this.renderGraficoActual();
    }

    renderGraficoActual() {
        const targetChart = window.ChartRegistry && (
            window.ChartRegistry['CostoFormulaPorTipoAABB'] || 
            window.ChartRegistry['Dash_CostoFormulaPorTipoAABB']
        );
        const contenedor = document.getElementById('contenedor-graficos-lista');

        if (targetChart && typeof targetChart.render === 'function') {
            targetChart.render(this, this.datosDashboard, contenedor);
        } else {
            if (contenedor) {
                contenedor.innerHTML = `
                    <div class="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
                        <i class="fas fa-exclamation-triangle text-amber-500 text-3xl mb-2"></i>
                        <h3 class="text-sm font-bold text-slate-700 uppercase">Error al renderizar</h3>
                        <p class="text-xs text-slate-400 mt-1">No se encontró el componente de visualización para CostoFormulaPorTipoAABB.</p>
                    </div>
                `;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.AnalisisCostoDiarioControllerInstance = new AnalisisCostoDiarioController();
});
