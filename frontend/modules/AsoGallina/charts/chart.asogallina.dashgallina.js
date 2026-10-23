/**
 * Componente Visual DashGallina - AsoGallina
 * - Cabeceras de contenedor limpias y profesionales estilo CoreBI con badge y leyendas
 * - Scroll horizontal con ancho dinámico adaptativo para legibilidad perfecta de fechas
 * - Seccionado jerárquico por mes (cabecera superior de meses y líneas divisorias)
 * - Título superior "Mes de fecha / Día de fecha"
 * - Fechas completas en vertical 90° (YYYY/MM/DD) sin amontonarse ni recortarse
 * - Eje dual sincronizado (Eje izquierdo: métrica diaria / Eje derecho: promedio mensual)
 * - Línea de promedio mensual en segmentos horizontales planos por mes con corte en el cambio de mes
 * - Etiquetas flotantes con valores en los extremos de cada línea de promedio mensual
 * - Tooltip estilo Tableau con delay de 500ms
 * - Máxima nitidez y alta resolución (devicePixelRatio >= 2 y líneas pixel-snapped)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAsoGallinaDashGallina = {
    charts: {
        und: null,
        peso: null,
        kilos: null
    },

    tooltipTimer: null,
    activeTooltipKey: null,

    colores: {
        naranja: '#F28E2B',
        azul:    '#4E79A7',
        turquesa:'#76B7B2',
        rojo:    '#E15759',
        grisBorde:'#CBD5E1',
        grisTexto:'#475569'
    },

    destroy() {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }
        this.activeTooltipKey = null;

        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });

        const tooltipEl = document.getElementById('tableau-floating-tooltip');
        if (tooltipEl && tooltipEl.parentNode) {
            tooltipEl.parentNode.removeChild(tooltipEl);
        }
    },

    // Formateador numérico estilo Tableau (punto para miles, coma para decimales)
    formatTableau(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    // Peso: respeta la precisión real del valor (3 a 6 decimales)
    formatPesoAdaptativo(num) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 6
        });
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const labels = Array.isArray(data && data.labels) ? data.labels : [];
        const series = (data && data.series) || {};
        const bloquesMes = Array.isArray(data && data.bloques_mes) ? data.bloques_mes : [];
        const puntosMeses = Array.isArray(data && data.puntos_meses) ? data.puntos_meses : [];
        const tipoGrafico = (data && data.tipo_grafico) || 'DashGallina';
        const filtros = (data && data.filtros_aplicados) || {};

        if (labels.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center text-slate-400">
                    <i class="fas fa-inbox text-4xl text-slate-300 mb-3"></i>
                    <p class="text-base font-semibold text-slate-700">No se encontraron datos</p>
                    <p class="text-xs text-slate-400 mt-1">Prueba seleccionando otro rango de fechas o tipos de gallina.</p>
                </div>
            `;
            return;
        }

        const tiposLabel = Array.isArray(filtros.tipos) && filtros.tipos.length > 0 
            ? filtros.tipos.join(', ') 
            : 'GALLINA REPRODUCTORA';

        const showUnd = tipoGrafico === 'DashGallina' || tipoGrafico === 'GallUnd';
        const showPeso = tipoGrafico === 'DashGallina' || tipoGrafico === 'GallPeso';
        const showKilos = tipoGrafico === 'DashGallina' || tipoGrafico === 'GallKilos';

        // Ancho mínimo dinámico: 34px por fecha para máxima claridad y holgura
        const minWidth = Math.max(1100, labels.length * 34 + 140);
        const chartHeight = tipoGrafico === 'DashGallina' ? 390 : 500;

        let htmlCards = '';

        if (showUnd) {
            htmlCards += `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                            <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">ANALISIS DE GALLINA (UND)</h2>
                            <span class="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                ${this.escapeHtml(tiposLabel)}
                            </span>
                        </div>
                        <div class="flex items-center gap-4 text-xs font-semibold">
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.naranja};"></span>
                                <span class="text-slate-700">Unidades Diarias</span>
                            </span>
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.azul};"></span>
                                <span class="text-slate-700">Promedio Mensual (PromMenUnd)</span>
                            </span>
                        </div>
                    </div>
                    <div class="p-4 sm:p-5">
                        <div class="w-full overflow-x-auto custom-scrollbar pb-3 scroll-gallina">
                            <div class="relative" style="width: ${minWidth}px; height: ${chartHeight}px;">
                                <canvas id="canvas-gall-und"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (showPeso) {
            htmlCards += `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                            <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">ANALISIS DE GALLINA (Peso Prom)</h2>
                            <span class="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                ${this.escapeHtml(tiposLabel)}
                            </span>
                        </div>
                        <div class="flex items-center gap-4 text-xs font-semibold">
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.naranja};"></span>
                                <span class="text-slate-700">Peso Promedio Diario</span>
                            </span>
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.turquesa};"></span>
                                <span class="text-slate-700">Promedio Mensual (PromMenPeso)</span>
                            </span>
                        </div>
                    </div>
                    <div class="p-4 sm:p-5">
                        <div class="w-full overflow-x-auto custom-scrollbar pb-3 scroll-gallina">
                            <div class="relative" style="width: ${minWidth}px; height: ${chartHeight}px;">
                                <canvas id="canvas-gall-peso"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (showKilos) {
            htmlCards += `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-2.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                            <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">ANALISIS DE GALLINA (kilos)</h2>
                            <span class="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                ${this.escapeHtml(tiposLabel)}
                            </span>
                        </div>
                        <div class="flex items-center gap-4 text-xs font-semibold">
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.turquesa};"></span>
                                <span class="text-slate-700">Kilos Diarios</span>
                            </span>
                            <span class="flex items-center gap-1.5">
                                <span class="w-3 h-3 rounded-[2px]" style="background:${this.colores.rojo};"></span>
                                <span class="text-slate-700">Promedio Mensual (PromMenKilos)</span>
                            </span>
                        </div>
                    </div>
                    <div class="p-4 sm:p-5">
                        <div class="w-full overflow-x-auto custom-scrollbar pb-3 scroll-gallina">
                            <div class="relative" style="width: ${minWidth}px; height: ${chartHeight}px;">
                                <canvas id="canvas-gall-kilos"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        contenedor.innerHTML = `
            <div class="flex flex-col gap-6">
                ${htmlCards}
            </div>
        `;

        if (showUnd) {
            this.crearGraficoUnidades(labels, series.unidades || {}, bloquesMes, puntosMeses);
        }
        if (showPeso) {
            this.crearGraficoPeso(labels, series.peso || {}, bloquesMes, puntosMeses);
        }
        if (showKilos) {
            this.crearGraficoKilos(labels, series.kilos || {}, bloquesMes, puntosMeses);
        }

        // Asegurar que el scroll horizontal inicie desde el comienzo (izquierda)
        setTimeout(() => {
            const scrolls = document.querySelectorAll('.scroll-gallina');
            scrolls.forEach(el => {
                el.scrollLeft = 0;
            });
        }, 60);
    },

    /**
     * Plugin de Chart.js con Pixel-Snapping para nitidez absoluta:
     * 1. Cabecera "Mes de fecha / Día de fecha"
     * 2. Celdas de meses superiores (ej. "junio de 2026")
     * 3. Líneas divisorias verticales nítidas entre meses
     * 4. Etiquetas flotantes en los extremos de cada promedio mensual (line-ends)
     */
    crearPluginTableau(bloquesMes, puntosMeses, metricType, colorPromedio) {
        const self = this;
        return {
            id: `tableauSections_${metricType}`,
            afterDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                if (!chartArea || !scales.x || !scales.y) return;

                const xScale = scales.x;
                const yScale = scales.y;
                const totalPoints = chart.data.labels.length;
                if (totalPoints === 0 || bloquesMes.length === 0) return;

                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                const topY = chartArea.top;
                const bottomY = chartArea.bottom;
                const headerTop = Math.round(topY - 30) + 0.5;
                const headerBottom = Math.round(topY) + 0.5;

                // 1. Título superior "Mes de fecha / Día de fecha"
                ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                ctx.fillStyle = '#475569';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText('Mes de fecha / Día de fecha', Math.round((chartArea.left + chartArea.right) / 2), headerTop - 4);

                // 2. Líneas horizontales de la banda de meses (pixel-snapped a 0.5 para máxima nitidez)
                ctx.strokeStyle = '#CBD5E1';
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(chartArea.left, headerTop);
                ctx.lineTo(chartArea.right, headerTop);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(chartArea.left, headerBottom);
                ctx.lineTo(chartArea.right, headerBottom);
                ctx.stroke();

                // 3. Dibujar bloques de mes y divisores verticales nítidos
                bloquesMes.forEach((bloque, bIdx) => {
                    const idxIni = bloque.index_inicio;
                    const idxFin = bloque.index_fin;

                    const rawStart = (idxIni === 0)
                        ? chartArea.left
                        : (xScale.getPixelForValue(idxIni) + xScale.getPixelForValue(idxIni - 1)) / 2;

                    const rawEnd = (idxFin === totalPoints - 1)
                        ? chartArea.right
                        : (xScale.getPixelForValue(idxFin) + xScale.getPixelForValue(idxFin + 1)) / 2;

                    const xStart = Math.round(rawStart) + 0.5;
                    const xEnd   = Math.round(rawEnd) + 0.5;

                    // Línea vertical izquierda del mes
                    ctx.strokeStyle = '#CBD5E1';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(xStart, headerTop);
                    ctx.lineTo(xStart, bottomY + 68);
                    ctx.stroke();

                    // Si es el último bloque, dibujar línea derecha final
                    if (bIdx === bloquesMes.length - 1) {
                        ctx.beginPath();
                        ctx.moveTo(xEnd, headerTop);
                        ctx.lineTo(xEnd, bottomY + 68);
                        ctx.stroke();
                    }

                    // Texto del mes (ej. "junio de 2026") centrado en su bloque
                    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                    ctx.fillStyle = '#334155';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const xCentro = Math.round((xStart + xEnd) / 2);
                    ctx.fillText(bloque.mes_label, xCentro, Math.round((headerTop + headerBottom) / 2));

                    // 4. Etiquetas numéricas en los extremos del promedio mensual (line-ends)
                    let valorProm = 0;
                    let decimals = 0;
                    if (metricType === 'und') {
                        valorProm = bloque.prom_unidades;
                        decimals = 0;
                    } else if (metricType === 'peso') {
                        valorProm = bloque.prom_peso;
                        decimals = 2;
                    } else if (metricType === 'kilos') {
                        valorProm = bloque.prom_kilos;
                        decimals = 0;
                    }

                    const yPixel = yScale.getPixelForValue(valorProm);

                    if (yPixel >= chartArea.top && yPixel <= chartArea.bottom) {
                        const textoVal = self.formatTableau(valorProm, decimals);

                        ctx.font = '700 10.5px system-ui, -apple-system, sans-serif';
                        ctx.fillStyle = colorPromedio;

                        const pxIni = Math.round(xScale.getPixelForValue(idxIni));
                        const pxFin = Math.round(xScale.getPixelForValue(idxFin));
                        const snapY = Math.round(yPixel);

                        // Extremo izquierdo
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(textoVal, pxIni + 2, snapY - 3);

                        // Extremo derecho (si hay más de 1 día en el mes)
                        if (idxFin > idxIni) {
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(textoVal, pxFin - 2, snapY - 3);
                        }
                    }
                });

                ctx.restore();
            }
        };
    },

    /**
     * Tooltip personalizado estilo Tableau Server con Delay de 500ms
     */
    getCustomTooltip(metricType, metricLabel, metricPromLabel, decimalsDiario, decimalsProm, puntosMeses) {
        const self = this;
        return {
            enabled: false,
            external: function(context) {
                let tooltipEl = document.getElementById('tableau-floating-tooltip');
                if (!tooltipEl) {
                    tooltipEl = document.createElement('div');
                    tooltipEl.id = 'tableau-floating-tooltip';
                    tooltipEl.style.position = 'absolute';
                    tooltipEl.style.background = '#ffffff';
                    tooltipEl.style.border = '1px solid #d1d5db';
                    tooltipEl.style.borderRadius = '3px';
                    tooltipEl.style.boxShadow = '0 4px 14px rgba(0,0,0,0.14)';
                    tooltipEl.style.padding = '8px 12px';
                    tooltipEl.style.pointerEvents = 'none';
                    tooltipEl.style.zIndex = '1000';
                    tooltipEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    tooltipEl.style.fontSize = '12px';
                    tooltipEl.style.lineHeight = '1.6';
                    tooltipEl.style.color = '#1e293b';
                    tooltipEl.style.minWidth = '190px';
                    tooltipEl.style.opacity = '0';
                    tooltipEl.style.transition = 'opacity 0.15s ease';
                    document.body.appendChild(tooltipEl);
                }

                const tooltipModel = context.tooltip;

                // Si el cursor salió del gráfico o punto
                if (tooltipModel.opacity === 0) {
                    if (self.tooltipTimer) {
                        clearTimeout(self.tooltipTimer);
                        self.tooltipTimer = null;
                    }
                    self.activeTooltipKey = null;
                    tooltipEl.style.opacity = '0';
                    return;
                }

                if (tooltipModel.body && tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
                    const dp = tooltipModel.dataPoints[0];
                    const dataIndex = dp.dataIndex;
                    const chart = context.chart;
                    const pointKey = `${metricType}_${dataIndex}`;

                    const position = chart.canvas.getBoundingClientRect();
                    const targetLeft = (position.left + window.pageXOffset + tooltipModel.caretX + 15) + 'px';
                    const targetTop  = (position.top  + window.pageYOffset + tooltipModel.caretY - 20) + 'px';

                    // Si se cambió de punto, reiniciar delay de 500ms
                    if (self.activeTooltipKey !== pointKey) {
                        if (self.tooltipTimer) {
                            clearTimeout(self.tooltipTimer);
                            self.tooltipTimer = null;
                        }

                        self.activeTooltipKey = pointKey;
                        tooltipEl.style.opacity = '0';

                        const diaFecha = chart.data.labels[dataIndex] || '';
                        const mesFecha = puntosMeses[dataIndex] || '';

                        const dsDiario = chart.data.datasets[0];
                        const dsProm   = chart.data.datasets[1];

                        const valDiario = (dsDiario && dsDiario.data) ? dsDiario.data[dataIndex] : null;
                        const valProm   = (dsProm && dsProm.data)     ? dsProm.data[dataIndex]   : null;

                        const valDiarioTxt = metricType === 'peso'
                            ? self.formatPesoAdaptativo(valDiario)
                            : self.formatTableau(valDiario, decimalsDiario);
                        const valPromTxt = metricType === 'peso'
                            ? self.formatPesoAdaptativo(valProm)
                            : self.formatTableau(valProm, decimalsProm);

                        tooltipEl.innerHTML = `
                            <div style="display:flex; justify-content:space-between; gap:16px;">
                                <span style="color:#64748b;">Día de fecha:</span>
                                <span style="font-weight:600; color:#0f172a;">${diaFecha}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; gap:16px;">
                                <span style="color:#64748b;">Mes de fecha:</span>
                                <span style="font-weight:600; color:#0f172a;">${mesFecha}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; gap:16px; margin-top:2px;">
                                <span style="color:#64748b;">${metricLabel}:</span>
                                <span style="font-weight:700; color:#0f172a;">${valDiarioTxt}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; gap:16px;">
                                <span style="color:#64748b;">${metricPromLabel}:</span>
                                <span style="font-weight:700; color:#475569;">${valPromTxt}</span>
                            </div>
                        `;

                        tooltipEl.style.left = targetLeft;
                        tooltipEl.style.top  = targetTop;

                        self.tooltipTimer = setTimeout(() => {
                            if (self.activeTooltipKey === pointKey && tooltipEl) {
                                tooltipEl.style.opacity = '1';
                            }
                        }, 500);
                    } else {
                        tooltipEl.style.left = targetLeft;
                        tooltipEl.style.top  = targetTop;
                    }
                }
            }
        };
    },

    /**
     * Calcula los límites del eje Y dinámicamente:
     * - Si hay caídas a cero (web1.png): min = 0 asegurando que el punto no se corte.
     * - Si no hay ceros (web.png): auto-escalado con buffer del 20-25% para que los picos
     *   y fluctuaciones diarias se aprecien claramente en toda la altura de la tarjeta.
     */
    calcularPasoBonito(valor) {
        if (!Number.isFinite(valor) || valor <= 0) return 0.001;

        const magnitud = Math.pow(10, Math.floor(Math.log10(valor)));
        const normalizado = valor / magnitud;

        let paso;
        if (normalizado <= 1) paso = 1;
        else if (normalizado <= 2) paso = 2;
        else if (normalizado <= 2.5) paso = 2.5;
        else if (normalizado <= 5) paso = 5;
        else paso = 10;

        return paso * magnitud;
    },

    calcularLimitesEje(diario, promedio, metricType) {
        const todos = [...diario, ...promedio].filter(v => v !== null && v !== undefined && !isNaN(v) && typeof v === 'number');
        if (todos.length === 0) {
            if (metricType === 'und') return { min: 0, max: 15000 };
            if (metricType === 'peso') return { min: 0, max: 6 };
            return { min: 0, max: 70000 };
        }

        const minReal = Math.min(...todos);
        const maxReal = Math.max(...todos);
        const hayCero = minReal <= 0.0001;

        if (metricType === 'und') {
            if (hayCero) {
                const max = Math.ceil((maxReal * 1.1) / 2000) * 2000;
                return { min: 0, max: Math.max(max, 2000) };
            }
            // Auto-escalado dinámico (web.png)
            const delta = Math.max(maxReal - minReal, 600);
            const buffer = Math.max(delta * 0.25, 400);
            const step = delta > 6000 ? 1000 : 500;
            const minCalc = Math.max(0, Math.floor((minReal - buffer) / step) * step);
            const maxCalc = Math.ceil((maxReal + buffer) / step) * step;
            return { min: minCalc, max: maxCalc };
        }

        if (metricType === 'peso') {
            if (hayCero) {
                // Caída a 0 (web1.png): el mínimo es 0 exacto sin cortar el punto
                const max = Math.ceil(maxReal * 1.15);
                return { min: 0, max: Math.max(max, 5) };
            }

            // Escala dinámica como Tableau: se adapta a rangos pequeños
            // para que las variaciones diarias no queden aplanadas.
            const rango = Math.max(maxReal - minReal, 0.0001);
            const step = this.calcularPasoBonito(rango / 10);
            const minCalc = Math.max(0, Math.floor(minReal / step) * step);
            const maxCalc = Math.ceil((maxReal + step) / step) * step;
            const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 4;

            return { min: minCalc, max: maxCalc, step, decimals };
        }

        if (metricType === 'kilos') {
            if (hayCero) {
                const max = Math.ceil((maxReal * 1.1) / 10000) * 10000;
                return { min: 0, max: Math.max(max, 10000) };
            }
            // Auto-escalado dinámico (web.png)
            const delta = Math.max(maxReal - minReal, 2500);
            const buffer = Math.max(delta * 0.25, 2000);
            const step = delta > 25000 ? 5000 : 2500;
            const minCalc = Math.max(0, Math.floor((minReal - buffer) / step) * step);
            const maxCalc = Math.ceil((maxReal + buffer) / step) * step;
            return { min: minCalc, max: maxCalc };
        }

        return { min: 0, max: Math.ceil(maxReal * 1.1) };
    },

    crearGraficoUnidades(labels, dataSerie, bloquesMes, puntosMeses) {
        const ctx = document.getElementById('canvas-gall-und');
        if (!ctx) return;

        const diario = Array.isArray(dataSerie.diario) ? dataSerie.diario : [];
        const promedio = Array.isArray(dataSerie.promedio) ? dataSerie.promedio : [];

        const { min: yAxisMin, max: yAxisMax } = this.calcularLimitesEje(diario, promedio, 'und');
        const plugin = this.crearPluginTableau(bloquesMes, puntosMeses, 'und', this.colores.azul);

        this.charts.und = new Chart(ctx, {
            type: 'line',
            plugins: [plugin],
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'unidades',
                        data: diario,
                        yAxisID: 'y',
                        borderColor: this.colores.naranja,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: this.colores.naranja,
                        clip: false,
                        tension: 0,
                        order: 2
                    },
                    {
                        label: 'PromMenUnd',
                        data: promedio,
                        yAxisID: 'y1',
                        borderColor: this.colores.azul,
                        backgroundColor: 'transparent',
                        borderWidth: 2.2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        clip: false,
                        tension: 0,
                        spanGaps: false,
                        segment: {
                            borderColor: ctx => (puntosMeses[ctx.p0DataIndex] !== puntosMeses[ctx.p1DataIndex] ? 'transparent' : undefined)
                        },
                        order: 1
                    }
                ]
            },
            options: this.getBaseOptions('und', 'unidades', 'PromMenUnd', 0, 0, yAxisMax, puntosMeses, yAxisMin)
        });
    },

    crearGraficoPeso(labels, dataSerie, bloquesMes, puntosMeses) {
        const ctx = document.getElementById('canvas-gall-peso');
        if (!ctx) return;

        const diario = Array.isArray(dataSerie.diario) ? dataSerie.diario : [];
        const promedio = Array.isArray(dataSerie.promedio) ? dataSerie.promedio : [];

        const { min: yAxisMin, max: yAxisMax, step: yAxisStep, decimals: yAxisDecimals } = this.calcularLimitesEje(diario, promedio, 'peso');
        const plugin = this.crearPluginTableau(bloquesMes, puntosMeses, 'peso', this.colores.turquesa);

        this.charts.peso = new Chart(ctx, {
            type: 'line',
            plugins: [plugin],
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'peso',
                        data: diario,
                        yAxisID: 'y',
                        borderColor: this.colores.naranja,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: this.colores.naranja,
                        clip: false,
                        tension: 0,
                        order: 2
                    },
                    {
                        label: 'PromMenPeso',
                        data: promedio,
                        yAxisID: 'y1',
                        borderColor: this.colores.turquesa,
                        backgroundColor: 'transparent',
                        borderWidth: 2.2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        clip: false,
                        tension: 0,
                        spanGaps: false,
                        segment: {
                            borderColor: ctx => (puntosMeses[ctx.p0DataIndex] !== puntosMeses[ctx.p1DataIndex] ? 'transparent' : undefined)
                        },
                        order: 1
                    }
                ]
            },
            options: this.getBaseOptions('peso', 'peso', 'PromMenPeso', 6, 6, yAxisMax, puntosMeses, yAxisMin, yAxisStep, yAxisDecimals)
        });
    },

    crearGraficoKilos(labels, dataSerie, bloquesMes, puntosMeses) {
        const ctx = document.getElementById('canvas-gall-kilos');
        if (!ctx) return;

        const diario = Array.isArray(dataSerie.diario) ? dataSerie.diario : [];
        const promedio = Array.isArray(dataSerie.promedio) ? dataSerie.promedio : [];

        const { min: yAxisMin, max: yAxisMax } = this.calcularLimitesEje(diario, promedio, 'kilos');
        const plugin = this.crearPluginTableau(bloquesMes, puntosMeses, 'kilos', this.colores.rojo);

        this.charts.kilos = new Chart(ctx, {
            type: 'line',
            plugins: [plugin],
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'kilos',
                        data: diario,
                        yAxisID: 'y',
                        borderColor: this.colores.turquesa,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 2.5,
                        pointHoverRadius: 5,
                        pointBackgroundColor: this.colores.turquesa,
                        clip: false,
                        tension: 0,
                        order: 2
                    },
                    {
                        label: 'PromMenKilos',
                        data: promedio,
                        yAxisID: 'y1',
                        borderColor: this.colores.rojo,
                        backgroundColor: 'transparent',
                        borderWidth: 2.2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        clip: false,
                        tension: 0,
                        spanGaps: false,
                        segment: {
                            borderColor: ctx => (puntosMeses[ctx.p0DataIndex] !== puntosMeses[ctx.p1DataIndex] ? 'transparent' : undefined)
                        },
                        order: 1
                    }
                ]
            },
            options: this.getBaseOptions('kilos', 'kilos', 'PromMenKilos', 0, 0, yAxisMax, puntosMeses, yAxisMin)
        });
    },

    getBaseOptions(metricType, metricLabel, metricPromLabel, decimalsDiario, decimalsProm, yAxisMax, puntosMeses, yAxisMin = 0, yAxisStep = null, yAxisDecimals = null) {
        const self = this;
        return {
            responsive: true,
            maintainAspectRatio: false,
            // Forzar resolución Retina / HiDPI (2x mínimo) para eliminar cualquier pixelado o borrosidad
            devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
            layout: {
                padding: {
                    top: 48,
                    bottom: 25,
                    left: 8,
                    right: 8
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: this.getCustomTooltip(metricType, metricLabel, metricPromLabel, decimalsDiario, decimalsProm, puntosMeses)
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(226, 232, 240, 0.4)',
                        tickColor: 'transparent',
                        drawOnChartArea: true
                    },
                    ticks: {
                        font: { size: 10, family: 'system-ui, -apple-system, sans-serif', weight: '500' },
                        color: '#475569',
                        maxRotation: 90,
                        minRotation: 90,
                        autoSkip: false // Con scroll horizontal y minWidth suficiente, no se omite ninguna fecha
                    }
                },
                y: {
                    position: 'left',
                    min: yAxisMin,
                    max: yAxisMax,
                    title: {
                        display: true,
                        text: metricLabel,
                        color: '#475569',
                        font: { size: 11, weight: '600', family: 'system-ui, -apple-system, sans-serif' }
                    },
                    grid: {
                        color: 'rgba(226, 232, 240, 0.7)'
                    },
                    ticks: {
                        font: { size: 10, family: 'system-ui, -apple-system, sans-serif' },
                        color: '#475569',
                        ...(yAxisStep ? { stepSize: yAxisStep } : {}),
                        callback: function(val) {
                            if (metricType === 'peso') {
                                return self.formatTableau(val, (yAxisDecimals !== null && yAxisDecimals !== undefined) ? yAxisDecimals : 1);
                            }
                            if (val >= 1000) {
                                const kVal = val / 1000;
                                return (kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1)) + 'K';
                            }
                            return self.formatTableau(val, 0);
                        }
                    }
                },
                y1: {
                    position: 'right',
                    min: yAxisMin,
                    max: yAxisMax,
                    title: {
                        display: true,
                        text: metricPromLabel,
                        color: '#475569',
                        font: { size: 11, weight: '600', family: 'system-ui, -apple-system, sans-serif' }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        font: { size: 10, family: 'system-ui, -apple-system, sans-serif' },
                        color: '#475569',
                        ...(yAxisStep ? { stepSize: yAxisStep } : {}),
                        callback: function(val) {
                            if (metricType === 'peso') {
                                return self.formatTableau(val, (yAxisDecimals !== null && yAxisDecimals !== undefined) ? yAxisDecimals : 1);
                            }
                            if (val >= 1000) {
                                const kVal = val / 1000;
                                return (kVal % 1 === 0 ? kVal.toFixed(0) : kVal.toFixed(1)) + 'K';
                            }
                            return self.formatTableau(val, 0);
                        }
                    }
                }
            }
        };
    }
};

window.ChartRegistry['AsoGallinaDashGallina'] = window.ChartAsoGallinaDashGallina;
window.ChartRegistry['AsoGallinaGallUnd']      = window.ChartAsoGallinaDashGallina;
window.ChartRegistry['AsoGallinaGallPeso']     = window.ChartAsoGallinaDashGallina;
window.ChartRegistry['AsoGallinaGallKilos']    = window.ChartAsoGallinaDashGallina;
