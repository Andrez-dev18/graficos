/**
 * Módulo para CP06 CAABB (Costo de Producción de Alimento Balanceado)
 * Gráfica de Costo por Kg mensual con coloreado condicional, tabla de resumen superior
 * y matriz de detalle con colores exactos de Tableau (Barra azul sólida en PU y texto coloreado)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP06 CAABB'] = {
    // Paleta de colores exactos de Tableau
    COLORS: {
        TABLEAU_BLUE: '#4e79a7',       // Azul clásico Tableau para barras de PU
        TABLEAU_BLUE_DARK: '#2b5c8f',  // Azul oscuro para texto
        TABLEAU_GREEN: '#59a14f',      // Verde Tableau para barras de valoalim
        TABLEAU_GREEN_DARK: '#2e7d32', // Verde oscuro para texto y meta (<= 1.700)
        TABLEAU_RED: '#c0392b',        // Rojo oscuro Tableau (> 1.700)
        TABLEAU_AMBER: '#b8860b',      // Ámbar / Oro Tableau para barras de pesoalim
        TABLEAU_AMBER_DARK: '#946808'  // Ámbar oscuro para texto
    },

    render(controller, data) {
        // 1. Configurar Títulos y Visibilidad
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Costo de Produccion de Alimento Balanceado';

        const tituloTabla = document.getElementById('titulo-tabla-detalle');
        if (tituloTabla) tituloTabla.textContent = 'Detalle por Alimento Balanceado';

        const subtituloTabla = document.getElementById('subtitulo-tabla-detalle');
        if (subtituloTabla) subtituloTabla.textContent = 'Desglose mensual con barras de Peso Alimento, Valor Alimento y PU';

        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        // 2. Badges / Leyendas
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#2e7d32] bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#2e7d32]"></span> Bajo Meta (<= 1.700)
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#c0392b] bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-md">
                    <span class="w-2.5 h-2.5 rounded-full bg-[#c0392b]"></span> Sobre Meta (> 1.700)
                </span>
            `;
        }

        // 3. Renderizar Gráfica y Tabla Resumen Superior
        this.renderGraficaYResumen(controller, data);

        // 4. Renderizar Matriz Detalle con Barras Horizontales (Amarillo, Verde y Azul)
        this.renderTablaDetalleBarras(controller, data);
    },

    renderGraficaYResumen(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        // Limpiar contenedor y agregar estructura para Canvas + Resumen Superior
        contenedorGrafica.className = "flex flex-col w-full p-4 gap-4";
        contenedorGrafica.innerHTML = `
            <div class="relative w-full h-[320px]">
                <canvas id="chart-costo-produccion" style="image-rendering: -webkit-optimize-contrast;"></canvas>
            </div>
            <!-- Tabla Resumen Superior estilo Tableau -->
            <div class="w-full overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table class="w-full text-xs border-collapse table-auto">
                    <thead id="thead-resumen-cp06" class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200"></thead>
                    <tbody id="tbody-resumen-cp06" class="divide-y divide-slate-100 bg-white"></tbody>
                </table>
            </div>
        `;

        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        controller.destruirGraficaActual();

        const puntos = data.grafica || [];
        if (puntos.length === 0) {
            return;
        }

        const labels = puntos.map(p => p.mes_larga || p.mes_corta || p.key);
        const dataValores = puntos.map(p => Number(p.costo_x_kg || 0));

        const minVal = Math.min(...dataValores);
        const maxVal = Math.max(...dataValores);
        const minY = Math.max(0, Math.floor((minVal - 0.05) * 20) / 20);
        const maxY = Math.ceil((maxVal + 0.05) * 20) / 20;

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const pointColors = dataValores.map(v => (v <= 1.700 ? this.COLORS.TABLEAU_GREEN_DARK : this.COLORS.TABLEAU_RED));

        controller.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'PU Alimento',
                        data: dataValores,
                        borderColor: this.COLORS.TABLEAU_GREEN_DARK,
                        segment: {
                            borderColor: ctx => (ctx.p1.parsed.y <= 1.700 ? this.COLORS.TABLEAU_GREEN_DARK : this.COLORS.TABLEAU_RED)
                        },
                        tension: 0.05,
                        borderWidth: 2.5,
                        pointRadius: 5.5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        datalabels: {
                            align: 'top',
                            offset: 6,
                            color: ctx => (ctx.dataset.data[ctx.dataIndex] <= 1.700 ? this.COLORS.TABLEAU_GREEN_DARK : this.COLORS.TABLEAU_RED),
                            font: { size: 12, weight: 'bold' },
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
                    padding: { top: 25, bottom: 5, left: 10, right: 15 }
                },
                scales: {
                    y: {
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'PU',
                            font: { size: 11, weight: 'bold' },
                            color: '#64748b'
                        },
                        ticks: {
                            stepSize: 0.05,
                            callback: v => Number(v).toFixed(2).replace('.', ','),
                            font: { size: 10, weight: '500' },
                            color: '#64748b'
                        },
                        grid: { color: '#f1f5f9' }
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

                                const colorPU = (punto.costo_x_kg <= 1.700) ? this.COLORS.TABLEAU_GREEN_DARK : this.COLORS.TABLEAU_RED;

                                tooltipEl.innerHTML = `
                                    <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans">
                                        <span class="text-slate-500 font-normal">Mes:</span>
                                        <span class="text-slate-900 font-semibold text-left">${punto.mes_larga}</span>
                                        <span class="text-slate-500 font-normal">Valor Alimento:</span>
                                        <span class="text-slate-900 font-semibold text-left font-mono">S/ ${controller.formatearNumero(punto.sum_valoalim, 'decimal2')}</span>
                                        <span class="text-slate-500 font-normal">Peso Alimento:</span>
                                        <span class="text-slate-900 font-semibold text-left font-mono">${controller.formatearNumero(punto.sum_pesoalim, 'decimal2')} Kg</span>
                                        <span class="text-slate-500 font-normal">Costo x Kg (PU):</span>
                                        <span style="color: ${colorPU};" class="font-bold text-left font-mono">${Number(punto.costo_x_kg).toFixed(3).replace('.', ',')}</span>
                                    </div>
                                `;

                                tooltipEl.classList.remove('hidden');
                                const position = context.chart.canvas.getBoundingClientRect();
                                const tooltipWidth = tooltipEl.offsetWidth || 240;
                                const tooltipHeight = tooltipEl.offsetHeight || 110;

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

        // Renderizar la Tabla Resumen Superior
        const theadResumen = document.getElementById('thead-resumen-cp06');
        const tbodyResumen = document.getElementById('tbody-resumen-cp06');
        if (theadResumen && tbodyResumen) {
            let theadHtml = `
                <tr>
                    <th class="px-4 py-2 text-left text-slate-700 font-bold min-w-[130px] border-r border-slate-200"></th>
            `;
            puntos.forEach(p => {
                theadHtml += `<th class="px-3 py-2 text-center text-slate-800 font-bold border-r border-slate-200 min-w-[120px] text-[11px]">${p.mes_larga}</th>`;
            });
            theadHtml += `</tr>`;
            theadResumen.innerHTML = theadHtml;

            let rowValor = `<tr><td class="px-4 py-1.5 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200">Valor Alimento</td>`;
            let rowPeso  = `<tr><td class="px-4 py-1.5 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200">Peso Alimento</td>`;
            let rowCosto = `<tr><td class="px-4 py-1.5 font-bold text-slate-900 bg-slate-100/80 border-r border-slate-200">Costo x Kg</td>`;

            puntos.forEach(p => {
                const cXKg = Number(p.costo_x_kg);
                const cXKgStyle = (cXKg <= 1.700) ? `color: ${this.COLORS.TABLEAU_GREEN_DARK};` : `color: ${this.COLORS.TABLEAU_RED};`;

                rowValor += `<td class="px-3 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100">${controller.formatearNumero(p.sum_valoalim, 'decimal2')}</td>`;
                rowPeso  += `<td class="px-3 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100">${controller.formatearNumero(p.sum_pesoalim, 'decimal2')}</td>`;
                rowCosto += `<td class="px-3 py-1.5 text-right font-mono font-bold border-r border-slate-100" style="${cXKgStyle}">${Number(p.costo_x_kg).toFixed(3).replace('.', ',')}</td>`;
            });

            rowValor += `</tr>`;
            rowPeso  += `</tr>`;
            rowCosto += `</tr>`;

            tbodyResumen.innerHTML = rowValor + rowPeso + rowCosto;
        }
    },

    renderTablaDetalleBarras(controller, data) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');
        if (!thead || !tbody) return;

        const periodos = data.periodos || [];
        const tablaDetalle = data.tablaDetalle || [];

        if (periodos.length === 0 || tablaDetalle.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">No hay datos detallados para el período seleccionado.</td></tr>`;
            return;
        }

        // 1. Calcular escalas máximas para las barras horizontales
        let maxPesoEncontrado = 0;
        let maxValoEncontrado = 0;

        tablaDetalle.forEach(item => {
            Object.values(item.meses || {}).forEach(m => {
                if (m.pesoalim && m.pesoalim > maxPesoEncontrado) maxPesoEncontrado = m.pesoalim;
                if (m.valoalim && m.valoalim > maxValoEncontrado) maxValoEncontrado = m.valoalim;
            });
        });

        // Escalas de referencia de Tableau
        const scaleMaxPeso = Math.max(3000000, maxPesoEncontrado); // Eje Tableau: 1M 2M 3M
        const scaleMaxValo = Math.max(4000000, maxValoEncontrado); // Eje Tableau: 0M 2M 4M
        const scaleMaxPU = 4.0;                                     // Eje Tableau: 0 2 4

        const maxBarPx = 42; // Ancho máximo de la barra sólida en píxeles

        // 2. Construir Encabezados Multi-nivel estilo Tableau con Ejes
        let fila1MesesHtml = '';
        let fila2SubcolsHtml = '';

        periodos.forEach(p => {
            fila1MesesHtml += `
                <th colspan="3" class="py-2 px-2 text-center font-bold text-white bg-blue-700 border-r-2 border-blue-900 border-b border-blue-800 text-[11px]">
                    ${p.mes_larga || p.key}
                </th>
            `;

            fila2SubcolsHtml += `
                <th class="py-1 px-1.5 text-center text-slate-700 bg-slate-100 border-r border-slate-200 text-[10px] min-w-[125px] font-semibold">
                    <div class="text-slate-800 font-bold mb-0.5">pesoalim</div>
                    <div class="flex justify-between text-[8px] font-mono text-slate-400 font-normal px-1 border-t border-slate-200 pt-0.5">
                        <span>1M</span><span>2M</span><span>3M</span>
                    </div>
                </th>
                <th class="py-1 px-1.5 text-center text-slate-700 bg-slate-100 border-r border-slate-200 text-[10px] min-w-[125px] font-semibold">
                    <div class="text-slate-800 font-bold mb-0.5">valoalim</div>
                    <div class="flex justify-between text-[8px] font-mono text-slate-400 font-normal px-1 border-t border-slate-200 pt-0.5">
                        <span>0M</span><span>2M</span><span>4M</span>
                    </div>
                </th>
                <th class="py-1 px-1.5 text-center text-slate-800 bg-slate-100 border-r-2 border-slate-300 text-[10px] min-w-[110px] font-bold">
                    <div class="text-slate-800 font-bold mb-0.5">PU</div>
                    <div class="flex justify-between text-[8px] font-mono text-slate-400 font-normal px-1 border-t border-slate-200 pt-0.5">
                        <span>0</span><span>2</span><span>4</span>
                    </div>
                </th>
            `;
        });

        const theadHtml = `
            <tr class="text-[11px] border-b border-blue-800">
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-800 sticky left-0 z-30 border-r border-b border-blue-900 min-w-[85px]">
                    codigo
                </th>
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-800 sticky left-[85px] z-30 border-r-2 border-blue-950 border-b border-blue-900 min-w-[220px]">
                    nomalim
                </th>
                ${fila1MesesHtml}
            </tr>
            <tr class="border-b border-slate-200 uppercase tracking-wider">
                ${fila2SubcolsHtml}
            </tr>
        `;

        thead.innerHTML = theadHtml;

        // 3. Construir Filas con las 3 Barras Sólidas (Amarillo/Ámbar, Verde y Azul)
        let tbodyHtml = '';

        tablaDetalle.forEach(item => {
            let celdasMeses = '';

            periodos.forEach((p, pIdx) => {
                const mesData = item.meses[p.key];
                const borderDivider = 'border-r-2 border-slate-300';

                if (mesData && (mesData.pesoalim > 0 || mesData.valoalim > 0 || mesData.pu > 0)) {
                    const pesoVal = Number(mesData.pesoalim || 0);
                    const valoVal = Number(mesData.valoalim || 0);
                    const puVal   = Number(mesData.pu || 0);

                    const pesoStr = controller.formatearNumero(pesoVal, 'decimal2');
                    const valoStr = controller.formatearNumero(valoVal, 'decimal2');
                    const puStr   = Number(puVal).toFixed(3).replace('.', ',');

                    // Anchos de barra calculados en píxeles (igual que en Tableau)
                    const wPeso = (pesoVal > 0) ? Math.max(3, Math.min(maxBarPx, Math.round((pesoVal / scaleMaxPeso) * maxBarPx))) : 0;
                    const wValo = (valoVal > 0) ? Math.max(3, Math.min(maxBarPx, Math.round((valoVal / scaleMaxValo) * maxBarPx))) : 0;
                    const wPU   = (puVal > 0)   ? Math.max(3, Math.min(maxBarPx, Math.round((puVal / scaleMaxPU) * maxBarPx))) : 0;

                    // 1. Columna Peso: Barra Ámbar + Texto Ámbar
                    const tdPeso = `
                        <td class="px-2 py-1 border-r border-slate-100 border-b whitespace-nowrap bg-white">
                            <div class="flex items-center gap-1.5 w-full justify-start">
                                <div class="h-3.5 flex-shrink-0" style="width: ${wPeso}px; background-color: ${this.COLORS.TABLEAU_AMBER};"></div>
                                <span class="font-mono text-[10.5px] font-medium" style="color: ${this.COLORS.TABLEAU_AMBER_DARK};">${pesoStr}</span>
                            </div>
                        </td>
                    `;

                    // 2. Columna Valor: Barra Verde + Texto Verde
                    const tdValor = `
                        <td class="px-2 py-1 border-r border-slate-100 border-b whitespace-nowrap bg-white">
                            <div class="flex items-center gap-1.5 w-full justify-start">
                                <div class="h-3.5 flex-shrink-0" style="width: ${wValo}px; background-color: ${this.COLORS.TABLEAU_GREEN};"></div>
                                <span class="font-mono text-[10.5px] font-medium" style="color: ${this.COLORS.TABLEAU_GREEN_DARK};">${valoStr}</span>
                            </div>
                        </td>
                    `;

                    // 3. Columna PU: Barra Azul + Texto Azul
                    const tdPU = `
                        <td class="px-2 py-1 ${borderDivider} border-b whitespace-nowrap bg-white">
                            <div class="flex items-center gap-1.5 w-full justify-start">
                                <div class="h-3.5 flex-shrink-0" style="width: ${wPU}px; background-color: ${this.COLORS.TABLEAU_BLUE};"></div>
                                <span class="font-mono text-[10.5px] font-medium" style="color: ${this.COLORS.TABLEAU_BLUE_DARK};">${puStr}</span>
                            </div>
                        </td>
                    `;

                    celdasMeses += tdPeso + tdValor + tdPU;
                } else {
                    // Celda Vacía
                    celdasMeses += `
                        <td class="px-2 py-1 text-center font-mono text-[10px] text-slate-200 border-r border-slate-100 border-b whitespace-nowrap"></td>
                        <td class="px-2 py-1 text-center font-mono text-[10px] text-slate-200 border-r border-slate-100 border-b whitespace-nowrap"></td>
                        <td class="px-2 py-1 text-center font-mono text-[10px] text-slate-200 ${borderDivider} border-b whitespace-nowrap"></td>
                    `;
                }
            });

            tbodyHtml += `
                <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                    <td class="px-3 py-1 font-mono font-semibold text-slate-800 bg-white border-r border-b border-slate-200 text-[10.5px] sticky left-0 z-20 shadow-xs">
                        ${item.codigo}
                    </td>
                    <td class="px-3 py-1 text-slate-700 bg-white border-r-2 border-blue-900/30 border-b text-[10.5px] sticky left-[85px] z-20 shadow-xs truncate max-w-[220px]" title="${item.nomalim}">
                        ${item.nomalim}
                    </td>
                    ${celdasMeses}
                </tr>
            `;
        });

        tbody.innerHTML = tbodyHtml;
    }
};
