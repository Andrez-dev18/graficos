/**
 * Controlador para la vista Costos Tradicionales - Costo de Producción Pollo Vivo (CP01)
 * Administra filtros de período, renderizado del gráfico de líneas con línea de referencia y tabla de métricas
 */
class CostosTradicionalesController {
    constructor() {
        this.service = new CostosTradicionalesService();
        this.chartInstance = null;
        this.datosDashboard = null;

        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        this.setupTableTooltips();
        await this.onCargarClick();
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined') {
            const selPeriodo = document.getElementById('select-tipo-periodo');
            if (selPeriodo) {
                selPeriodo.value = 'entre_meses';
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

    setupTableTooltips() {
        const tooltip = document.getElementById('tooltip-tableau-costos');
        if (!tooltip) return;

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip-metrica]');
            if (target) {
                const indicador = target.getAttribute('data-tt-indicador') || '';
                const mes = target.getAttribute('data-tt-mes') || '';
                const valor = target.getAttribute('data-tt-valor') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">Indicador:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${indicador}</span>
                        <span class="text-slate-500 font-normal">Mes de fecha:</span>
                        <span class="text-slate-900 font-semibold text-left">${mes}</span>
                        <span class="text-slate-500 font-normal">Valor:</span>
                        <span class="text-slate-900 font-bold text-left font-mono">${valor}</span>
                    </div>
                `;

                tooltip.classList.remove('hidden');
                const tooltipWidth = tooltip.offsetWidth || 240;
                const tooltipHeight = tooltip.offsetHeight || 90;
                let x = e.clientX + 14;
                let y = e.clientY + 14;

                if (x + tooltipWidth > window.innerWidth - 12) {
                    x = e.clientX - tooltipWidth - 14;
                }
                if (y + tooltipHeight > window.innerHeight - 12) {
                    y = e.clientY - tooltipHeight - 12;
                }

                tooltip.style.left = `${Math.max(10, x)}px`;
                tooltip.style.top = `${Math.max(10, y)}px`;
            } else {
                if (!e.target.closest('#contenedor-grafica-costo') && !e.target.closest('#chart-costo-produccion')) {
                    tooltip.classList.add('hidden');
                }
            }
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

            const payloadFiltros = {
                fecha_inicio: rango.fechaInicio || rango.inicio || '2024-01-01',
                fecha_fin: rango.fechaFin || rango.fin || '2025-10-31'
            };

            const res = await this.service.obtenerDashboard(payloadFiltros);

            if (res && (res.success || res.status === 'success')) {
                const data = res.payload || res.data || res;
                this.datosDashboard = data;
                this.renderizarGraficaCosto(data);
                this.renderizarTablaMetricas(data);
            } else {
                console.error('Error en respuesta del servicio:', res);
            }
        } catch (err) {
            console.error('Excepción al cargar dashboard de costos tradicionales:', err);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_meses';
        this.setupPeriodo();
        await this.onCargarClick();
    }

    /**
     * Formateadores numéricos adaptados exactamente al formato Tableau
     */
    formatearNumero(valor, tipo) {
        if (valor === undefined || valor === null || isNaN(valor)) return '-';
        const num = Number(valor);

        switch (tipo) {
            case 'entero':
                // e.g. 2.111.852 (separador de miles con punto)
                return num.toLocaleString('es-ES', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/,/g, '.');
            case 'decimal1':
                // e.g. 42,2 (1 decimal con coma)
                return num.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('.', ',');
            case 'decimal3':
                // e.g. 2,616 / 4,538 (3 decimales con coma)
                return num.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace('.', ',');
            default:
                return num.toString();
        }
    }

    /**
     * 1. Renderizado del Gráfico de Líneas con Referencia (Costo de Producción Pollo Vivo - MES)
     */
    renderizarGraficaCosto(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        // Destruir instancia previa
        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCosto = data.graficaCosto || [];
        const benchmark = data.benchmark || 4.538;

        if (graficaCosto.length === 0) {
            return;
        }

        // Labels del eje X (e.g. 'enero de 2024', 'febrero de 2024', etc.)
        const labels = graficaCosto.map(d => d.mes_larga || d.mes_corta || d.key);
        const valoresCosto = graficaCosto.map(d => Number(d.costo || 0));

        // Colores condicionales por punto:
        // Verde para valores bajos / eficientes (<= 4.538 o estado 'bajo')
        // Rojo para valores altos (> 4.538 o estado 'alto')
        const coloresPuntos = graficaCosto.map(d => (d.estado === 'bajo' ? '#16a34a' : '#b91c1c'));
        const coloresHover = graficaCosto.map(d => (d.estado === 'bajo' ? '#15803d' : '#991b1b'));

        // Dataset de la Línea Principal de Costo
        const datasetCosto = {
            label: 'Costo de Producción',
            data: valoresCosto,
            borderColor: '#475569', // Color de la línea Tableau (slate oscuro/gris neutro)
            backgroundColor: '#475569',
            borderWidth: 2,
            tension: 0.05,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            pointBackgroundColor: coloresPuntos,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointHoverBackgroundColor: coloresHover,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            datalabels: {
                align: 'top',
                offset: 6,
                color: (context) => coloresPuntos[context.dataIndex] || '#1e293b',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        // Dataset de la Línea de Referencia Benchmark (4.538)
        const datasetBenchmark = {
            label: `Promedio / Meta (${this.formatearNumero(benchmark, 'decimal3')})`,
            data: labels.map(() => benchmark),
            borderColor: '#3b82f6', // Azul Tableau
            backgroundColor: '#3b82f6',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            datalabels: {
                display: (context) => context.dataIndex === context.dataset.data.length - 1,
                align: 'right',
                offset: 8,
                color: '#2563eb',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11.5,
                    weight: 'bold'
                },
                formatter: () => this.formatearNumero(benchmark, 'decimal3')
            }
        };

        // Escala Y personalizada: 3.8 a 4.8 con pasos de 0.2 adaptativa
        let minY = 3.8;
        let maxY = 4.8;
        if (valoresCosto.length > 0) {
            const minVal = Math.min(...valoresCosto, benchmark);
            const maxVal = Math.max(...valoresCosto, benchmark);
            minY = Math.min(3.8, Math.floor((minVal - 0.2) * 10) / 10);
            maxY = Math.max(4.8, Math.ceil((maxVal + 0.2) * 10) / 10);
        }

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetCosto, datasetBenchmark]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: {
                        top: 24,
                        bottom: 8,
                        left: 10,
                        right: 42 // Espacio para la etiqueta de benchmark a la derecha
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'Costo',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.2,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: {
                            color: '#f1f5f9',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !graficaCosto[dataIndex]) return;

                            const item = graficaCosto[dataIndex];
                            const estadoTexto = item.estado === 'bajo' 
                                ? '<span class="text-emerald-600 font-bold">Bajo Meta (Favorable)</span>' 
                                : '<span class="text-rose-600 font-bold">Sobre Meta (Alto)</span>';

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-slate-500 font-normal">Costo Producción:</span>
                                    <span class="text-slate-900 font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo, 'decimal3')}</span>
                                    <span class="text-slate-500 font-normal">Benchmark / Meta:</span>
                                    <span class="text-blue-600 font-semibold text-left font-mono">${this.formatearNumero(benchmark, 'decimal3')}</span>
                                    <span class="text-slate-500 font-normal">Estado:</span>
                                    <span class="text-left">${estadoTexto}</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 2. Renderizado de la Tabla de Indicadores (Detalle Costo de Producción Pollo Vivo - MES)
     */
    renderizarTablaMetricas(data = {}) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');

        if (!thead || !tbody) return;

        const periodos = data.periodos || [];
        const tablaMetricas = data.tablaMetricas || [];

        if (periodos.length === 0 || tablaMetricas.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="24" class="text-center py-10 text-slate-400">No hay métricas disponibles para el período seleccionado.</td></tr>`;
            return;
        }

        // 1. Construir Cabecera en 2 Niveles: Fila 1 (Mes de fecha) + Fila 2 (Indicador + Meses)
        let theadHtml = `
            <!-- Nivel 1: Título de Agrupador Superior -->
            <tr class="bg-blue-600 text-white font-bold text-xs uppercase tracking-wider">
                <th class="py-2 px-3 text-center border-b border-r border-blue-500 sticky left-0 z-30 bg-blue-600">
                    Mes de fecha
                </th>
                <th colspan="${periodos.length}" class="py-2 px-3 text-center border-b border-blue-500">
                    Mes de fecha
                </th>
            </tr>
            <!-- Nivel 2: Indicador y Nombres de Meses Abreviados (ene 2024, feb 2024, ...) -->
            <tr class="bg-blue-600 text-white font-bold text-xs">
                <th class="py-2.5 px-3 text-left border-r border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[220px] max-w-[260px] shadow-sm">
                    Indicador
                </th>
        `;

        periodos.forEach(p => {
            theadHtml += `
                <th class="py-2.5 px-3 text-center whitespace-nowrap border-r border-blue-500 min-w-[95px] font-semibold text-[11px]">
                    ${p.mes_corta}
                </th>
            `;
        });

        theadHtml += `</tr>`;
        thead.innerHTML = theadHtml;

        // 2. Construir Cuerpo de la Tabla con las 7 Filas de Métricas
        let tbodyHtml = '';

        tablaMetricas.forEach((metrica, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/70' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-200/80">
                    <!-- Nombre del Indicador (Sticky Left) -->
                    <td class="py-2 px-3 font-bold text-slate-800 text-[11px] border-r border-slate-200 sticky left-0 z-20 ${stickyBg} shadow-xs truncate">
                        ${metrica.nombre}
                    </td>
            `;

            periodos.forEach(p => {
                const valorRaw = metrica.valores ? metrica.valores[p.key] : null;
                const valorFormateado = this.formatearNumero(valorRaw, metrica.formato);

                tbodyHtml += `
                    <td class="py-2 px-3 text-right font-mono text-slate-700 text-[11.5px] border-r border-slate-200/60 whitespace-nowrap cursor-pointer hover:bg-blue-100/60 hover:text-blue-900 transition-colors"
                        data-tooltip-metrica="true"
                        data-tt-indicador="${metrica.nombre}"
                        data-tt-mes="${p.mes_larga || p.mes_corta}"
                        data-tt-valor="${valorFormateado}">
                        ${valorFormateado}
                    </td>
                `;
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    }
}

// Inicialización global cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.costosTradicionalesController = new CostosTradicionalesController();
});
