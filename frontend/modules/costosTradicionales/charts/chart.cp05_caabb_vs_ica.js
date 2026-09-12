/**
 * Módulo para CP05 CAABBvsICA (Costo por Kg de AABB vs ICA)
 * Gráfica de doble eje (Costo x Kg vs ICA) y Matriz de detalle por Centro de Costo y Mes
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP05 CAABBvsICA'] = {
    render(controller, data) {
        // 1. Configurar Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Costo por Kg de AABB vs ICA';

        const tituloTabla = document.getElementById('titulo-tabla-detalle');
        if (tituloTabla) tituloTabla.textContent = 'Costo por Kg de AABB vs ICA Detalle';

        const subtituloTabla = document.getElementById('subtitulo-tabla-detalle');
        if (subtituloTabla) subtituloTabla.textContent = 'Desglose mensual y por Centro de Costo (cencos)';

        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.remove('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        // 2. Badges / Leyendas
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#2b5c8f]"></span> Costo x Kg
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#d97706]"></span> ICA
                </span>
            `;
        }

        // 3. Renderizar Gráfica y Tabla
        this.renderGrafica(controller, data);
        this.renderTabla(controller, data);
    },

    renderGrafica(controller, data) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        controller.destruirGraficaActual();

        const puntos = data.grafica || [];
        if (puntos.length === 0) {
            return;
        }

        const labels = puntos.map(p => p.mes_larga || p.mes_corta || p.key);
        const dataCostoXKg = puntos.map(p => Number(p.costo_x_kg || 0));
        const dataICA = puntos.map(p => Number(p.ica || 0));

        // Calcular escalas mínimas y máximas dinámicas
        const minCosto = Math.min(...dataCostoXKg);
        const maxCosto = Math.max(...dataCostoXKg);
        const minICA = Math.min(...dataICA);
        const maxICA = Math.max(...dataICA);

        const yMinCosto = Math.max(0, Math.floor((minCosto - 0.05) * 50) / 50);
        const yMaxCosto = Math.ceil((maxCosto + 0.05) * 50) / 50;

        const yMinICA = Math.max(0, Math.floor((minICA - 0.05) * 50) / 50);
        const yMaxICA = Math.ceil((maxICA + 0.05) * 50) / 50;

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        controller.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Costo x Kg',
                        data: dataCostoXKg,
                        borderColor: '#2b5c8f',
                        backgroundColor: '#2b5c8f',
                        tension: 0.1,
                        borderWidth: 2.2,
                        pointRadius: 4.5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#2b5c8f',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        yAxisID: 'y',
                        datalabels: {
                            align: 'top',
                            offset: 6,
                            color: '#2b5c8f',
                            font: { size: 11, weight: 'bold' },
                            formatter: (v) => Number(v).toFixed(3).replace('.', ',')
                        }
                    },
                    {
                        label: 'ICA',
                        data: dataICA,
                        borderColor: '#d97706',
                        backgroundColor: '#d97706',
                        tension: 0.1,
                        borderWidth: 2.2,
                        pointRadius: 4.5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#d97706',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        yAxisID: 'y1',
                        datalabels: {
                            align: 'top',
                            offset: 6,
                            color: '#d97706',
                            font: { size: 11, weight: 'bold' },
                            formatter: (v) => Number(v).toFixed(3).replace('.', ',')
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 25, bottom: 5, left: 10, right: 10 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: yMinCosto,
                        max: yMaxCosto,
                        title: {
                            display: true,
                            text: 'Costo x Kg',
                            font: { size: 11, weight: 'bold' },
                            color: '#2b5c8f'
                        },
                        ticks: {
                            stepSize: 0.02,
                            callback: v => Number(v).toFixed(2).replace('.', ','),
                            font: { size: 10, weight: '500' },
                            color: '#64748b'
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: yMinICA,
                        max: yMaxICA,
                        title: {
                            display: true,
                            text: 'ICA',
                            font: { size: 11, weight: 'bold' },
                            color: '#d97706'
                        },
                        ticks: {
                            stepSize: 0.02,
                            callback: v => Number(v).toFixed(2).replace('.', ','),
                            font: { size: 10, weight: '500' },
                            color: '#64748b'
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: {
                            font: { size: 11, weight: '600' },
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
                                const idx = tooltipModel.dataPoints[0].dataIndex;
                                const punto = puntos[idx];
                                if (!punto) return;

                                tooltipEl.innerHTML = `
                                    <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans">
                                        <span class="text-slate-500 font-normal">Mes:</span>
                                        <span class="text-slate-900 font-semibold text-left">${punto.mes_larga}</span>
                                        <span class="text-slate-500 font-normal">Costo x Kg:</span>
                                        <span class="text-[#2b5c8f] font-bold text-left font-mono">${Number(punto.costo_x_kg).toFixed(3).replace('.', ',')}</span>
                                        <span class="text-slate-500 font-normal">ICA:</span>
                                        <span class="text-[#d97706] font-bold text-left font-mono">${Number(punto.ica).toFixed(3).replace('.', ',')}</span>
                                    </div>
                                `;

                                tooltipEl.classList.remove('hidden');
                                const position = context.chart.canvas.getBoundingClientRect();
                                const tooltipWidth = tooltipEl.offsetWidth || 220;
                                const tooltipHeight = tooltipEl.offsetHeight || 100;

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
    },

    renderTabla(controller, data) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');
        if (!thead || !tbody) return;

        const detalleMeses = data.detalleMeses || [];
        if (detalleMeses.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">No hay datos detallados para el período seleccionado.</td></tr>`;
            return;
        }

        // ==========================================
        // 1. CONSTRUIR ENCABEZADOS (THEAD)
        // ==========================================
        let fila1MesesHtml = '';
        let fila2CencosHtml = '';

        detalleMeses.forEach(m => {
            const cencosList = m.cencosList || [];
            const cantCols = cencosList.length;

            fila1MesesHtml += `
                <th colspan="${cantCols}" class="py-2 px-2 text-center font-bold text-white bg-blue-700 border-r-2 border-blue-900 border-b border-blue-800 text-[11px]">
                    ${m.mes}
                </th>
            `;

            cencosList.forEach((cencos, idx) => {
                const isTotal = (cencos === 'Total');
                const isLastInMonth = (idx === cencosList.length - 1);
                const borderR = isLastInMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-200';
                const bgHeader = isTotal ? 'bg-slate-200 font-bold text-slate-900' : 'bg-slate-100 font-semibold text-slate-600';

                fila2CencosHtml += `
                    <th class="py-1 px-2 text-center ${bgHeader} ${borderR} text-[10px] min-w-[75px] font-mono">
                        ${cencos}
                    </th>
                `;
            });
        });

        const theadHtml = `
            <tr class="text-[11px] border-b border-blue-800">
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-800 sticky left-0 z-30 border-r border-b border-blue-900 min-w-[140px]">
                    Mes de fecha / cencos
                </th>
                ${fila1MesesHtml}
            </tr>
            <tr class="border-b border-slate-200 uppercase tracking-wider">
                ${fila2CencosHtml}
            </tr>
        `;

        thead.innerHTML = theadHtml;

        // ==========================================
        // 2. CONSTRUIR FILAS DE INDICADORES (TBODY)
        // ==========================================
        const metricasDef = [
            { id: 'kg_alimento', nombre: 'Kg Alimento', formato: 'entero' },
            { id: 'saca_kg',     nombre: 'SACA Kg',     formato: 'entero' },
            { id: 'saca_und',    nombre: 'SACA Und',    formato: 'entero' },
            { id: 'costo_x_kg',  nombre: 'Costo x Kg',  formato: 'decimal3' },
            { id: 'ica',         nombre: 'ICA',         formato: 'decimal3' }
        ];

        let tbodyHtml = '';

        metricasDef.forEach(metrica => {
            let celdasMetrica = '';

            detalleMeses.forEach(m => {
                const cencosList = m.cencosList || [];
                cencosList.forEach((cencos, idx) => {
                    const colData = m.columnas[cencos] || {};
                    const rawVal = colData[metrica.id];
                    const formattedVal = controller.formatearNumero(rawVal, metrica.formato);

                    const isTotal = (cencos === 'Total');
                    const isLastInMonth = (idx === cencosList.length - 1);
                    const borderR = isLastInMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-100';
                    const bgClass = isTotal ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700';

                    celdasMetrica += `
                        <td class="px-2 py-1.5 text-right font-mono text-[10.5px] ${bgClass} ${borderR} border-b whitespace-nowrap hover:bg-blue-50/50 transition-colors">
                            ${formattedVal}
                        </td>
                    `;
                });
            });

            tbodyHtml += `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td class="px-3 py-2 font-bold text-slate-800 bg-white border-r border-b border-slate-200 text-[11px] sticky left-0 z-20 shadow-xs">
                        ${metrica.nombre}
                    </td>
                    ${celdasMetrica}
                </tr>
            `;
        });

        tbody.innerHTML = tbodyHtml;
    }
};
