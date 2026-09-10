/**
 * Controlador para la vista Costos Tradicionales
 * Administra filtros de período, alternancia entre CP01 (Costo Producción) y CP02 (CPV vs CA)
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

        // Selector de tipo de gráfico (CP01 vs CP02)
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

            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'CPO1CostoProduccion';

            const payloadFiltros = {
                fecha_inicio: rango.fechaInicio || rango.inicio || '2024-01-01',
                fecha_fin: rango.fechaFin || rango.fin || '2025-10-31',
                tipo_grafico: tipoGrafico
            };

            const res = await this.service.obtenerDashboard(payloadFiltros);

            if (res && (res.success || res.status === 'success')) {
                const data = res.payload || res.data || res;
                this.datosDashboard = data;

                if (tipoGrafico === 'CP02 CPVvsCA') {
                    this.configurarVistaCP02(data);
                } else {
                    this.configurarVistaCP01(data);
                }
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
            case 'decimal2':
                // e.g. 2,40 (2 decimales con coma)
                return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
            case 'decimal3':
                // e.g. 2,616 / 4,538 (3 decimales con coma)
                return num.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace('.', ',');
            default:
                return num.toString();
        }
    }

    /**
     * Configura y renderiza la vista para CP01 (Costo de Producción Pollo Vivo + Tabla)
     */
    configurarVistaCP01(data) {
        // Título
        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo de Producción Pollo Vivo - MES';

        // Ajustar altura del contenedor para CP01 (380px)
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full h-[360px] sm:h-[380px] p-4";
        }

        // Badges / Leyenda estática para CP01
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        const benchmark = data.benchmark || 4.538;
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-md">
                    Promedio / Meta: ${this.formatearNumero(benchmark, 'decimal3')}
                </span>
                <span class="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium hidden sm:inline-flex">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Bajo Meta (Favorable)
                </span>
                <span class="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium hidden sm:inline-flex">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Sobre Meta (Alto)
                </span>
            `;
        }

        // Mostrar Tabla de Métricas
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        // Renderizar
        this.renderizarGraficaCP01(data);
        this.renderizarTablaMetricas(data);
    }

    /**
     * Configura y renderiza la vista para CP02 (Costo Producción vs Costo Alimentación - Doble Eje)
     */
    configurarVistaCP02(data) {
        // Título
        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo de Producción Pollo vivo vs. Costo de Alimentación (S/ por Kg)';

        // Ajustar altura responsive expansiva para CP02 (Ocupa casi toda la pantalla disponible)
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[520px] h-[calc(100vh-250px)] max-h-[750px] p-4";
        }

        // Limpiar contenedor de badges externos porque usaremos la leyenda nativa interactiva de Chart.js
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        // Ocultar Tabla de Métricas (en Tableau CP02 no incluye tabla de detalle)
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // Renderizar Gráfica Doble Eje con leyenda interactiva
        this.renderizarGraficaCP02(data);
    }

    /**
     * 1. Renderizado de Gráfica CP01 (Línea con Referencia Benchmark)
     */
    renderizarGraficaCP01(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCosto = data.graficaCosto || [];
        const benchmark = data.benchmark || 4.538;

        if (graficaCosto.length === 0) return;

        const labels = graficaCosto.map(d => d.mes_larga || d.mes_corta || d.key);
        const valoresCosto = graficaCosto.map(d => Number(d.costo || 0));

        const coloresPuntos = graficaCosto.map(d => (d.estado === 'bajo' ? '#16a34a' : '#b91c1c'));
        const coloresHover = graficaCosto.map(d => (d.estado === 'bajo' ? '#15803d' : '#991b1b'));

        const datasetCosto = {
            label: 'Costo de Producción',
            data: valoresCosto,
            borderColor: '#475569',
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

        const datasetBenchmark = {
            label: `Promedio / Meta (${this.formatearNumero(benchmark, 'decimal3')})`,
            data: labels.map(() => benchmark),
            borderColor: '#3b82f6',
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
                    padding: { top: 24, bottom: 8, left: 10, right: 42 }
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
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
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
     * 2. Renderizado de Gráfica CP02 (Doble Eje con Leyenda Interactiva y Anticolisión Inteligente de Labels)
     */
    renderizarGraficaCP02(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCP02 = data.graficaCP02 || [];
        if (graficaCP02.length === 0) return;

        const labels = graficaCP02.map(d => d.mes_larga || d.mes_corta || d.key);
        const valoresProd = graficaCP02.map(d => Number(d.costo_produccion || 0));
        const valoresAlim = graficaCP02.map(d => Number(d.costo_alimentacion || 0));

        // Escalas Y1 (Izquierda: PROD PV) y Y2 (Derecha: Cost Alim)
        let minProd = 3.8, maxProd = 4.7;
        if (valoresProd.length > 0) {
            const minV = Math.min(...valoresProd);
            const maxV = Math.max(...valoresProd);
            minProd = Math.min(3.8, Math.floor((minV - 0.1) * 10) / 10);
            maxProd = Math.max(4.7, Math.ceil((maxV + 0.1) * 10) / 10);
        }

        let minAlim = 2.40, maxAlim = 2.74;
        if (valoresAlim.length > 0) {
            const minV = Math.min(...valoresAlim);
            const maxV = Math.max(...valoresAlim);
            minAlim = Math.min(2.40, Math.floor((minV - 0.04) * 100) / 100);
            maxAlim = Math.max(2.74, Math.ceil((maxV + 0.04) * 100) / 100);
        }

        // Función inteligente para evitar colisiones y superposición de etiquetas numéricas
        const getSmartAlignment = (datasetIdx, dataIdx) => {
            const prodVal = valoresProd[dataIdx];
            const alimVal = valoresAlim[dataIdx];

            // Normalización relativa de posición vertical en el canvas (0 = inferior, 1 = superior)
            const normProd = (prodVal - minProd) / (maxProd - minProd || 1);
            const normAlim = (alimVal - minAlim) / (maxAlim - minAlim || 1);

            const diff = normProd - normAlim;

            if (datasetIdx === 0) {
                // Dataset PROD PV (Azul)
                // Si la línea azul está muy cerca o por debajo de la roja (ej. Julio / Agosto o valle en Abril)
                if (diff < 0.12 || (dataIdx > 0 && prodVal < valoresProd[dataIdx - 1] && dataIdx < valoresProd.length - 1 && prodVal < valoresProd[dataIdx + 1])) {
                    return 'bottom';
                }
                return 'top';
            } else {
                // Dataset Cost Alim (Rojo)
                // Si la línea roja está visualmente por encima o cruza, ponerla arriba
                if (diff < 0.12) {
                    return 'top';
                }
                return 'bottom';
            }
        };

        // Dataset 1: PROD PV (Azul Tableau - Eje Y Izquierdo)
        const datasetProd = {
            label: 'PROD PV',
            data: valoresProd,
            yAxisID: 'y',
            borderColor: '#4f7cac',
            backgroundColor: '#4f7cac',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#4f7cac',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            datalabels: {
                align: (context) => getSmartAlignment(0, context.dataIndex),
                offset: 6,
                color: '#2b5c8f',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        // Dataset 2: Cost Alim (Rojo/Coral Tableau - Eje Y Derecho)
        const datasetAlim = {
            label: 'Cost Alim',
            data: valoresAlim,
            yAxisID: 'y1',
            borderColor: '#c0392b',
            backgroundColor: '#c0392b',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#c0392b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            datalabels: {
                align: (context) => getSmartAlignment(1, context.dataIndex),
                offset: 6,
                color: '#c0392b',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

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
                datasets: [datasetProd, datasetAlim]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 28, bottom: 12, left: 12, right: 12 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    // Eje Y Izquierdo (PROD PV)
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: minProd,
                        max: maxProd,
                        title: {
                            display: true,
                            text: 'PROD PV',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.1,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    // Eje Y Derecho (Cost Alim)
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minAlim,
                        max: maxAlim,
                        title: {
                            display: true,
                            text: 'Cost Alim',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.02,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(2).replace('.', ',')
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    // Leyenda interactiva nativa con estilo circular clicable para ocultar/mostrar series
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 12,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
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
                            if (dataIndex === null || !graficaCP02[dataIndex]) return;

                            const item = graficaCP02[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-[#2b5c8f] font-semibold">PROD PV:</span>
                                    <span class="text-[#2b5c8f] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_produccion, 'decimal3')} S//Kg</span>
                                    <span class="text-[#991b1b] font-semibold">Cost Alim:</span>
                                    <span class="text-[#991b1b] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_alimentacion, 'decimal3')} S//Kg</span>
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
     * 3. Renderizado de la Tabla de Indicadores (Detalle Costo de Producción Pollo Vivo - MES para CP01)
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

        // Cabecera en 2 Niveles
        let theadHtml = `
            <tr class="bg-blue-600 text-white font-bold text-xs uppercase tracking-wider">
                <th class="py-2 px-3 text-center border-b border-r border-blue-500 sticky left-0 z-30 bg-blue-600">
                    Mes de fecha
                </th>
                <th colspan="${periodos.length}" class="py-2 px-3 text-center border-b border-blue-500">
                    Mes de fecha
                </th>
            </tr>
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

        // Cuerpo de la Tabla con las 7 Filas de Métricas
        let tbodyHtml = '';

        tablaMetricas.forEach((metrica, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/70' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-200/80">
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
