/**
 * Controlador para la vista Costos Tradicional Día
 * Administra filtros de período, renderizado del gráfico de líneas particionado por año y tabla matricial jerárquica
 */
class CostosDiasController {
    constructor() {
        this.service = new CostosDiasService();
        this.chartInstances = [];
        this.datosDashboard = null;
        this.ultimosFiltros = null;

        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        this.setupTooltips();
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

        // Botón Exportar PDF
        document.getElementById('btn-exportar-pdf')?.addEventListener('click', () => {
            this.exportarPdf();
        });
    }

    setupTooltips() {
        const tooltip = document.getElementById('tooltip-tableau-costos');
        if (!tooltip) return;

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip-costos]');
            if (target) {
                const familia = target.getAttribute('data-tt-familia') || '';
                const subfamilia = target.getAttribute('data-tt-subfamilia') || '';
                const mes = target.getAttribute('data-tt-mes') || '';
                const cu = target.getAttribute('data-tt-cu') || '';
                const dif = target.getAttribute('data-tt-dif') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">Familia:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${familia}</span>
                        <span class="text-slate-500 font-normal">SubFamilia:</span>
                        <span class="text-slate-900 font-semibold text-left">${subfamilia}</span>
                        <span class="text-slate-500 font-normal">Mes:</span>
                        <span class="text-slate-900 font-semibold text-left">${mes}</span>
                        <span class="text-slate-500 font-normal">Costo Unitario (CU):</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${cu}</span>
                        ${dif ? `<span class="text-slate-500 font-normal">Diferencia (Dif):</span><span class="text-slate-900 font-semibold text-left font-mono">${dif}</span>` : ''}
                    </div>
                `;

                tooltip.classList.remove('hidden');
                const tooltipWidth = tooltip.offsetWidth || 280;
                const tooltipHeight = tooltip.offsetHeight || 120;
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
                if (!e.target.closest('#contenedor-grafica-costo') && !e.target.closest('[id^="chart-costo-"]')) {
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
                fecha_inicio: rango.fechaInicio || rango.inicio || '2025-01-01',
                fecha_fin: rango.fechaFin || rango.fin || '2025-12-31'
            };
            this.ultimosFiltros = payloadFiltros;

            const res = await this.service.obtenerDashboard(payloadFiltros);

            if (res && (res.success || res.status === 'success')) {
                const data = res.payload || res.data || res;
                this.datosDashboard = data;
                this.renderizarGraficaCosto(data);
                this.renderizarMatrizDetalle(data);
            } else {
                console.error('Error en respuesta de dashboard:', res);
            }
        } catch (err) {
            console.error('Excepción al cargar dashboard:', err);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }

    async exportarPdf() {
        if (!this.datosDashboard) {
            alert('Primero debe cargar los datos.');
            return;
        }
        if (typeof html2canvas === 'undefined') {
            alert('No se encontró la librería para capturar el gráfico.');
            return;
        }

        const ventanaPdf = window.open('', '_blank');
        if (!ventanaPdf) {
            alert('El navegador bloqueó la nueva pestaña. Habilita las ventanas emergentes para este sitio.');
            return;
        }

        ventanaPdf.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>Generando PDF...</title></head>
            <body style="font-family:Segoe UI,sans-serif;background:#f8fafc;color:#334155;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;">
                    <div style="width:34px;height:34px;border:4px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;margin:0 auto 14px;animation:spin 0.8s linear infinite;"></div>
                    <p style="font-size:14px;font-weight:600;">Generando PDF...</p>
                </div>
                <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
            </body>
            </html>
        `);

        const btn = document.getElementById('btn-exportar-pdf');
        const htmlOriginal = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
            btn.innerHTML = `
                <svg class="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Generando...</span>
            `;
        }

        try {
            document.getElementById('tooltip-tableau-costos')?.classList.add('hidden');

            const card = document.getElementById('card-grafica-costo');
            if (!card) {
                throw new Error('No se encontró la tarjeta del gráfico.');
            }

            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            const canvas = await html2canvas(card, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });
            const chartImage = canvas.toDataURL('image/png');

            const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
                ? PeriodoHelper.obtenerRangoFechas()
                : {};
            const filtros = this.ultimosFiltros || {
                fecha_inicio: rango.fechaInicio || rango.inicio || '',
                fecha_fin: rango.fechaFin || rango.fin || ''
            };

            const blob = await this.service.exportarPdf({
                chartImage: chartImage,
                datos: this.datosDashboard,
                filtros: filtros
            });

            const url = window.URL.createObjectURL(blob);
            ventanaPdf.location.href = url;
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (error) {
            try { ventanaPdf.close(); } catch (e) { /* Ignorar */ }
            console.error('Error al exportar PDF:', error);
            alert(error.message || 'No se pudo generar el PDF.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
                btn.innerHTML = htmlOriginal;
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
     * 1. Renderizado de Gráfica de Costo particionada por año estilo Tableau
     */
    renderizarGraficaCosto(data = {}) {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        // Destruir instancias previas
        if (this.chartInstances && this.chartInstances.length > 0) {
            this.chartInstances.forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            });
        }
        this.chartInstances = [];

        const aniosEstructura = data.aniosEstructura || [];
        const graficaCosto = data.graficaCosto || [];
        const graficaPorAnio = data.graficaPorAnio || {};

        if (aniosEstructura.length === 0 || graficaCosto.length === 0) {
            contenedor.innerHTML = `<div class="w-full flex items-center justify-center text-slate-400 text-sm py-12">No hay datos de gráfica para el período seleccionado.</div>`;
            return;
        }

        // 1. Calcular escala compartida global para todos los años
        const todosValores = graficaCosto.map(d => Number(d.costo || 0));
        let minY = 4.0;
        let maxY = 4.7;
        if (todosValores.length > 0) {
            const minV = Math.min(...todosValores);
            const maxV = Math.max(...todosValores);
            minY = Math.max(0, Math.floor((minV - 0.15) * 10) / 10);
            maxY = Math.ceil((maxV + 0.15) * 10) / 10;
        }

        // 2. Generar el layout HTML de paneles por año
        let panelsHtml = '';
        aniosEstructura.forEach((item, aIdx) => {
            const anio = item.anio;
            const cantMeses = (item.meses || []).length;
            const isLast = (aIdx === aniosEstructura.length - 1);

            panelsHtml += `
                <div class="flex-1 flex flex-col min-w-0 h-full ${!isLast ? 'border-r border-slate-200 pr-2 mr-2' : ''}" style="flex: ${cantMeses};">
                    <!-- Cabecera de año centrada -->
                    <div class="text-center pb-1 text-xs font-mono font-bold text-slate-500 tracking-wider">
                        ${anio}
                    </div>
                    <!-- Canvas para la serie del año -->
                    <div class="relative w-full flex-1 min-h-0">
                        <canvas id="chart-costo-${anio}" style="image-rendering: -webkit-optimize-contrast;"></canvas>
                    </div>
                </div>
            `;
        });

        contenedor.innerHTML = panelsHtml;

        // 3. Instanciar Chart.js para cada panel de año
        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        aniosEstructura.forEach((item, aIdx) => {
            const anio = item.anio;
            const canvas = document.getElementById(`chart-costo-${anio}`);
            if (!canvas) return;

            const puntosDelAnio = graficaPorAnio[anio] || [];
            const labels = puntosDelAnio.map(p => p.mes);
            const dataValores = puntosDelAnio.map(p => Number(p.costo || 0));
            const isFirstPanel = (aIdx === 0);

            const dataset = {
                label: `Costo Unitario ${anio}`,
                data: dataValores,
                borderColor: '#2b5c8f',
                backgroundColor: '#2b5c8f',
                tension: 0.05,
                borderWidth: 2,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                pointBackgroundColor: '#2b5c8f',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                datalabels: {
                    align: 'top',
                    offset: 6,
                    color: '#1e293b',
                    font: { 
                        family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                        size: 10.5, 
                        weight: 'bold' 
                    },
                    formatter: (v) => `S/ ${Number(v).toFixed(3).replace('.', ',')}`
                }
            };

            const chart = new Chart(canvas, {
                type: 'line',
                plugins: pluginsConfig,
                data: {
                    labels: labels,
                    datasets: [dataset]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 5,
                            left: isFirstPanel ? 5 : 10,
                            right: 15
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        intersect: true
                    },
                    scales: {
                        y: {
                            min: minY,
                            max: maxY,
                            display: isFirstPanel,
                            title: {
                                display: isFirstPanel,
                                text: 'Grafica',
                                font: { 
                                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                    size: 11, 
                                    weight: 'bold' 
                                },
                                color: '#64748b'
                            },
                            ticks: {
                                stepSize: 0.1,
                                callback: v => Number(v).toFixed(1).replace('.', ','),
                                font: { 
                                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                    size: 10,
                                    weight: '500'
                                },
                                color: '#64748b'
                            },
                            grid: { 
                                color: '#f1f5f9',
                                drawTicks: isFirstPanel
                            }
                        },
                        x: {
                            ticks: {
                                font: { 
                                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                    size: 10.5, 
                                    weight: '600' 
                                },
                                color: '#475569'
                            },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => {
                                const tooltipEl = document.getElementById('tooltip-tableau-costos');
                                if (!tooltipEl) return;

                                const tooltipModel = context.tooltip;
                                if (tooltipModel.opacity === 0) {
                                    tooltipEl.classList.add('hidden');
                                    return;
                                }

                                if (tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
                                    const dp = tooltipModel.dataPoints[0];
                                    const punto = puntosDelAnio[dp.dataIndex];
                                    const mesNombre = punto ? punto.mes : dp.label;
                                    const anioPunto = punto ? punto.anio : anio;
                                    const valorCosto = punto ? punto.costo : Number(dp.raw || 0);

                                    tooltipEl.innerHTML = `
                                        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans">
                                            <span class="text-slate-500 font-normal">Mes:</span>
                                            <span class="text-slate-900 font-semibold text-left">${mesNombre} ${anioPunto}</span>
                                            <span class="text-slate-500 font-normal">Costo Unitario Total:</span>
                                            <span class="text-slate-900 font-semibold text-left font-mono">S/ ${Number(valorCosto).toFixed(3).replace('.', ',')}</span>
                                        </div>
                                    `;

                                    tooltipEl.classList.remove('hidden');
                                    const position = context.chart.canvas.getBoundingClientRect();
                                    const tooltipWidth = tooltipEl.offsetWidth || 240;
                                    const tooltipHeight = tooltipEl.offsetHeight || 90;

                                    let left = position.left + tooltipModel.caretX + 14;
                                    let top = position.top + tooltipModel.caretY - 20;

                                    if (left + tooltipWidth > window.innerWidth - 12) {
                                        left = position.left + tooltipModel.caretX - tooltipWidth - 14;
                                    }
                                    if (top + tooltipHeight > window.innerHeight - 12) {
                                        top = window.innerHeight - tooltipHeight - 12;
                                    }

                                    tooltipEl.style.left = `${Math.max(10, left)}px`;
                                    tooltipEl.style.top = `${Math.max(10, top)}px`;
                                }
                            }
                        }
                    }
                }
            });

            this.chartInstances.push(chart);
        });
    }

    /**
     * 2. Renderizado de Matriz Jerárquica Detalle Familia / SubFamilia agrupada por año
     */
    renderizarMatrizDetalle(data = {}) {
        const thead = document.getElementById('thead-detalle-costos');
        const tbody = document.getElementById('tbody-detalle-costos');
        const tfoot = document.getElementById('tfoot-detalle-costos');

        if (!thead || !tbody) return;

        const matrizFamilias  = data.matrizFamilias || [];
        const periodos        = data.periodos || [];
        const aniosEstructura = data.aniosEstructura || [];
        const graficaCosto    = data.graficaCosto || [];

        if (periodos.length === 0 || matrizFamilias.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400">No hay datos para el período seleccionado.</td></tr>`;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        // Crear un mapa de último mes de cada año para aplicar bordes divisorios verticales
        const ultimosMesesPorAnio = {};
        aniosEstructura.forEach(item => {
            if (item.meses && item.meses.length > 0) {
                const lastM = item.meses[item.meses.length - 1];
                ultimosMesesPorAnio[lastM.key] = true;
            }
        });

        // 1. Encabezados Multinivel
        // Fila 1: Años
        let filaAniosHtml = '';
        let globalPeriodIndex = 0;

        aniosEstructura.forEach((item, aIdx) => {
            let yearColspan = 0;
            (item.meses || []).forEach(() => {
                if (globalPeriodIndex === 0) {
                    yearColspan += 1; // Solo CU
                } else {
                    yearColspan += 2; // CU y Dif
                }
                globalPeriodIndex++;
            });

            const isLastYear = (aIdx === aniosEstructura.length - 1);
            filaAniosHtml += `
                <th colspan="${yearColspan}" class="py-1.5 text-center font-bold text-white bg-blue-700 ${!isLastYear ? 'border-r-2 border-blue-900' : ''} border-b border-blue-800 tracking-wider text-[11px]">
                    ${item.anio}
                </th>
            `;
        });

        // Fila 2 (Meses) y Fila 3 (Subcolumnas CU / Dif)
        let filaMesesHtml = '';
        let filaSubcolsHtml = '';

        periodos.forEach((p, pIdx) => {
            const isLastInYear = (ultimosMesesPorAnio[p.key] === true && pIdx < periodos.length - 1);
            const borderDivider = isLastInYear ? 'border-r-2 border-blue-900' : 'border-r border-blue-700/70';
            const borderSubcolDivider = isLastInYear ? 'border-r-2 border-slate-300' : 'border-r border-slate-200';

            if (pIdx === 0) {
                filaMesesHtml += `
                    <th colspan="1" class="py-2 px-2 text-center font-bold bg-blue-600 text-white ${borderDivider} border-b min-w-[90px] text-[11px]">
                        ${p.mes}
                    </th>
                `;
                filaSubcolsHtml += `
                    <th class="py-1 px-1.5 text-center text-slate-600 bg-slate-100 ${borderSubcolDivider} font-bold text-[9.5px]">CU</th>
                `;
            } else {
                filaMesesHtml += `
                    <th colspan="2" class="py-2 px-2 text-center font-bold bg-blue-600 text-white ${borderDivider} border-b min-w-[120px] text-[11px]">
                        ${p.mes}
                    </th>
                `;
                filaSubcolsHtml += `
                    <th class="py-1 px-1.5 text-center text-slate-600 bg-slate-100 border-r border-slate-200 font-bold text-[9.5px]">CU</th>
                    <th class="py-1 px-1.5 text-center text-slate-500 bg-slate-100 ${borderSubcolDivider} font-bold text-[9.5px]">Dif</th>
                `;
            }
        });

        const theadHtml = `
            <!-- Fila 1: Año agrupador -->
            <tr class="text-[10px] border-b border-blue-700/60">
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-600 sticky left-0 z-30 border-r border-b border-blue-700/70 min-w-[170px] text-[11px]">
                    Familia
                </th>
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-600 sticky left-[170px] z-30 border-r border-b border-blue-700/70 min-w-[210px] text-[11px]">
                    SubFamilia
                </th>
                ${filaAniosHtml}
            </tr>

            <!-- Fila 2: Meses -->
            <tr class="border-b border-blue-700/60">
                ${filaMesesHtml}
            </tr>

            <!-- Fila 3: Subcolumnas CU y Dif -->
            <tr class="text-[9px] font-bold text-slate-400 bg-slate-100 border-b border-slate-200 uppercase tracking-wider">
                <th class="px-3 py-1 bg-slate-100 sticky left-0 z-30 border-r border-slate-200"></th>
                <th class="px-3 py-1 bg-slate-100 sticky left-[170px] z-30 border-r border-slate-200"></th>
                ${filaSubcolsHtml}
            </tr>
        `;

        thead.innerHTML = theadHtml;

        // 2. Filas de Familias y SubFamilias
        let tbodyHtml = '';

        matrizFamilias.forEach(f => {
            const nSub = f.subfamilias.length;

            f.subfamilias.forEach((sub, idx) => {
                let celdaFamilia = '';
                if (idx === 0) {
                    celdaFamilia = `
                        <td rowspan="${nSub}" class="px-3 py-2.5 font-bold text-slate-800 bg-white border-r border-b border-slate-200 align-top text-[11px] sticky left-0 z-20 shadow-xs">
                            <span class="hover:text-blue-600 transition-colors cursor-default">${f.familia}</span>
                        </td>
                    `;
                }

                // Generar celdas mensuales para esta subfamilia
                let celdasPeriodos = '';
                periodos.forEach((p, pIdx) => {
                    const dataMes = sub.valores[p.key] || { cu: 0, dif: null };
                    const cuFormateado = (typeof dataMes.cu === 'number') ? `S/${Number(dataMes.cu).toFixed(3).replace('.', ',')}` : '-';
                    const isLastInYear = (ultimosMesesPorAnio[p.key] === true && pIdx < periodos.length - 1);
                    const borderDivider = isLastInYear ? 'border-r-2 border-slate-300' : 'border-r border-slate-200';

                    // Color condicional para CU estilo Tableau
                    let colorCuClass = 'text-slate-800 font-medium font-mono';
                    if (pIdx === 0) {
                        colorCuClass = 'text-rose-600 font-semibold font-mono';
                    } else if (typeof dataMes.dif === 'number') {
                        if (dataMes.dif > 0) {
                            colorCuClass = 'text-emerald-600 font-semibold font-mono';
                        } else if (dataMes.dif < 0) {
                            colorCuClass = 'text-rose-600 font-semibold font-mono';
                        } else {
                            colorCuClass = 'text-slate-700 font-medium font-mono';
                        }
                    }

                    const cuTd = `
                        <td class="px-1.5 py-1.5 text-center ${pIdx === 0 ? borderDivider : 'border-r border-slate-100'} border-b whitespace-nowrap text-[10.5px] hover:bg-blue-50/50 transition-colors cursor-default ${colorCuClass}"
                            data-tooltip-costos="true"
                            data-tt-familia="${f.familia}"
                            data-tt-subfamilia="${sub.subfamilia}"
                            data-tt-mes="${p.mes} ${p.anio}"
                            data-tt-cu="${cuFormateado}"
                            data-tt-dif="${typeof dataMes.dif === 'number' ? Number(dataMes.dif).toFixed(3).replace('.', ',') : ''}">
                            ${cuFormateado}
                        </td>
                    `;

                    if (pIdx === 0) {
                        celdasPeriodos += cuTd;
                    } else {
                        let difHtml = '<span class="text-slate-300 font-mono text-[9.5px]">-</span>';
                        if (typeof dataMes.dif === 'number') {
                            const difNum = Number(dataMes.dif);
                            const difVal = difNum.toFixed(3).replace('.', ',');
                            if (difNum > 0) {
                                difHtml = `<span class="text-emerald-600 font-mono font-medium text-[9.5px]">${difVal}</span>`;
                            } else if (difNum < 0) {
                                difHtml = `<span class="text-rose-600 font-mono font-medium text-[9.5px]">${difVal}</span>`;
                            } else {
                                difHtml = `<span class="text-slate-400 font-mono text-[9.5px]">0,000</span>`;
                            }
                        }

                        const difTd = `
                            <td class="px-1 py-1.5 text-center ${borderDivider} border-b whitespace-nowrap text-[9.5px] bg-slate-50/30 font-mono">
                                ${difHtml}
                            </td>
                        `;

                        celdasPeriodos += cuTd + difTd;
                    }
                });

                tbodyHtml += `
                    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                        ${celdaFamilia}
                        <td class="px-3 py-2 text-slate-700 bg-white border-r border-b border-slate-200 align-middle text-[11px] sticky left-[170px] z-10 truncate max-w-[210px] shadow-xs" title="${sub.subfamilia}">
                            ${sub.subfamilia}
                        </td>
                        ${celdasPeriodos}
                    </tr>
                `;
            });
        });

        tbody.innerHTML = tbodyHtml;

        // 3. Fila de Totales en Pie de Tabla
        if (tfoot) {
            let celdasTotales = '';
            periodos.forEach((p, pIdx) => {
                const punto = graficaCosto.find(g => g.key === p.key);
                const totalCU = punto ? `S/${Number(punto.costo).toFixed(3).replace('.', ',')}` : '-';
                const isLastInYear = (ultimosMesesPorAnio[p.key] === true && pIdx < periodos.length - 1);
                const borderDivider = isLastInYear ? 'border-r-2 border-slate-300' : 'border-r border-slate-200';

                const totalCuTd = `
                    <td class="px-1.5 py-2 text-center font-mono font-bold text-slate-900 ${pIdx === 0 ? borderDivider : 'border-r border-slate-200'} whitespace-nowrap text-[11px] bg-blue-50/60">
                        ${totalCU}
                    </td>
                `;

                if (pIdx === 0) {
                    celdasTotales += totalCuTd;
                } else {
                    let difTotalHtml = '<span class="text-slate-400 font-mono text-[9.5px]">-</span>';
                    if (punto && typeof punto.dif === 'number') {
                        const difNum = Number(punto.dif);
                        const difVal = difNum.toFixed(3).replace('.', ',');
                        difTotalHtml = `<span class="text-slate-800 font-bold font-mono text-[10px]">${difVal}</span>`;
                    }

                    const difTotalTd = `
                        <td class="px-1 py-2 text-center ${borderDivider} bg-blue-50/40 text-[10px] font-mono">
                            ${difTotalHtml}
                        </td>
                    `;
                    celdasTotales += totalCuTd + difTotalTd;
                }
            });

            tfoot.innerHTML = `
                <tr class="bg-blue-50/70 border-t-2 border-slate-300 font-bold text-[11px]">
                    <td class="px-3 py-2 text-slate-900 bg-blue-50 sticky left-0 z-30 border-r border-slate-200" colspan="2">
                        TOTAL GENERAL
                    </td>
                    ${celdasTotales}
                </tr>
            `;
        }
    }
}

// Inicialización automática al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.costosDiasController = new CostosDiasController();
});
