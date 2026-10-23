/**
 * Componente de hojas individuales de barras - Tiendas y Mercados
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartTiendasMercadosBarras = {
    charts: [],

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const helper = window.TiendasMercadosHelper;
        if (!helper) {
            contenedor.innerHTML = '<div class="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">No se encontró el helper de Tiendas y Mercados.</div>';
            return;
        }

        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const tipoGrafico = (data && data.tipo_grafico) || (controller && controller.config && controller.config.tipoGrafico) || '';

        if (filas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800">${helper.escapeHtml(tipoGrafico || 'Tiendas y Mercados')}</h2>
                        <p class="text-[11px] text-slate-400 mt-0.5">${helper.escapeHtml(helper.formatearPeriodo(data.fecha_inicio || '', data.fecha_fin || ''))}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const resumen = helper.construirResumen(data);
        this.charts = tipoGrafico === 'BarraPorcGeneraltam'
            ? helper.renderBarraGeneraltam(contenedor, resumen, 620)
            : helper.renderHojaBarras(contenedor, tipoGrafico, resumen, 420);
    },

    destroy() {
        if (window.TiendasMercadosHelper) {
            window.TiendasMercadosHelper.ocultarTooltip();
        }

        this.charts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = [];
    }
};

window.ChartRegistry['TiendasMercadosBarras'] = window.ChartTiendasMercadosBarras;
