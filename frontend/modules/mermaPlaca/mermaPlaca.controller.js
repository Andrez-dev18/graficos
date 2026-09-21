/**
 * Controlador para la vista Análisis Mermas por Placa
 * Administra filtros de período (PeriodoHelper), tipo de gráfico y alternancia de vistas
 */
class MermaPlacaController {
    constructor() {
        this.service = new MermaPlacaService();
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
            const inputIni = document.getElementById('input-fecha-inicio');
            const inputFin = document.getElementById('input-fecha-fin');
            if (inputIni) inputIni.value = '2026-06-01';
            if (inputFin) inputFin.value = '2026-07-31';
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
            await this.limpiarFiltros();
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
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'MermasMes';

            let extraFilters = {};
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].getSelectedFilters === 'function') {
                const selected = window.ChartRegistry[tipoGrafico].getSelectedFilters();
                if (selected) {
                    if (Array.isArray(selected)) {
                        extraFilters.clasificacion = selected;
                    } else if (typeof selected === 'object') {
                        extraFilters = { ...extraFilters, ...selected };
                    }
                }
            }

            const payloadFiltros = {
                fecha_inicio: rango.fechaInicio || rango.inicio || '2026-08-01',
                fecha_fin: rango.fechaFin || rango.fin || '2026-08-31',
                tipo_grafico: tipoGrafico,
                ...extraFilters
            };

            const res = await this.service.obtenerDashboard(payloadFiltros);

            // Despacho Modular automático mediante ChartRegistry si existe
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
                const data = (res && (res.payload || res.data)) || res || {};
                this.datosDashboard = data;
                this.chartTipoActual = tipoGrafico;
                this.destruirGraficaActual();
                this.ocultarTodosLosFiltrosModulares();
                window.ChartRegistry[tipoGrafico].render(this, data);
            } else {
                this.ocultarTodosLosFiltrosModulares();
                this.renderEstadoInicial(tipoGrafico, payloadFiltros);
            }
        } catch (err) {
            console.error('Error al cargar dashboard de merma por placa:', err);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }

    ocultarTodosLosFiltrosModulares() {
        document.getElementById('contenedor-filtro-placa-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-cliente-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-item-merma')?.classList.add('hidden');
        document.getElementById('contenedor-filtro-transaccion-merma')?.classList.add('hidden');
    }

    renderEstadoInicial(tipoGrafico, filtros) {
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = tipoGrafico;

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.remove('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[420px] p-4 flex items-center justify-center";
            contenedorGrafica.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <div class="p-3.5 bg-blue-50 text-blue-600 rounded-2xl mb-3 shadow-2xs border border-blue-100">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                    </div>
                    <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wide mb-1">${tipoGrafico}</h3>
                    <p class="text-xs text-slate-400 max-w-sm">Rango seleccionado: <span class="font-semibold text-slate-600 font-mono">${filtros.fecha_inicio}</span> al <span class="font-semibold text-slate-600 font-mono">${filtros.fecha_fin}</span>.</p>
                </div>
            `;
        }

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_fechas';
        this.setupPeriodo();

        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'MermasMes';

        if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
            const mod = window.ChartRegistry[tipoGrafico];
            if (mod.multiPlaca) mod.multiPlaca.selectAll(false);
            if (mod.multiCliente) mod.multiCliente.selectAll(false);
            if (mod.multiItem) mod.multiItem.selectAll(false);
            if (mod.multiTrans) mod.multiTrans.selectAll(false);
        }

        await this.onCargarClick();
    }
}

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
    window.mermaPlacaController = new MermaPlacaController();
});
