window.ChartAlmacenMermasTendenciaMermas = {
    ALTURAS: [250, 200, 160, 160, 150, 170, 150, 235],

    formatNumero(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatearPorcentaje(valor) {
        return `${this.formatNumero(valor, 2)}%`;
    },

    escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatearFecha(periodo) {
        const partes = String(periodo || '').split('-').map(Number);
        if (partes.length !== 3 || partes.some(p => isNaN(p))) return String(periodo || '');

        const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
        return new Intl.DateTimeFormat('es-PE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(fecha).toLowerCase();
    },

    calcularTendencia(valores) {
        const puntos = valores
            .map((valor, indice) => ({ x: indice, y: valor }))
            .filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));

        if (puntos.length < 2) return null;

        const n = puntos.length;
        const sumX = puntos.reduce((a, p) => a + p.x, 0);
        const sumY = puntos.reduce((a, p) => a + p.y, 0);
        const sumXY = puntos.reduce((a, p) => a + (p.x * p.y), 0);
        const sumX2 = puntos.reduce((a, p) => a + (p.x * p.x), 0);
        const denominador = (n * sumX2) - (sumX * sumX);

        if (denominador === 0) return null;

        const pendiente = ((n * sumXY) - (sumX * sumY)) / denominador;
        const intercepto = (sumY - (pendiente * sumX)) / n;
        return valores.map((_, indice) => (pendiente * indice) + intercepto);
    },

    maximoY(valores) {
        const limpios = valores.filter(v => v !== null && v !== undefined && !isNaN(v));
        const maximo = limpios.length ? Math.max(...limpios) : 0;
        if (maximo <= 0.5) return Math.max(0.1, Math.ceil(maximo * 1.2 * 100) / 100);
        return Math.ceil(maximo * 1.2 * 2) / 2;
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        const payload = controller.cachePayload || {};
        const series = Array.isArray(payload.series) ? payload.series : [];
        const fechas = Array.isArray(payload.fechas) ? payload.fechas : [];
        const titulo = payload.titulo || 'Tendencias de Porcentaje de Merma Diaria por Fecha de Proceso/Cliente/Tipo de Merma';
        const subtitulo = payload.subtitulo || 'Merma Total y detalle sobre la entrada';
        const cliente = payload.cliente && payload.cliente !== 'TODO' ? payload.cliente : 'Todo';
        const dato = payload.dato || 'Peso';
        const etiquetas = fechas.map(fecha => this.formatearFecha(fecha));
        const tieneDatos = series.some(serie => Array.isArray(serie.valores) && serie.valores.some(v => v !== null && v !== undefined));

        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }

        if (!series.length || !fechas.length || !tieneDatos) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-sm text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const anchoMinimo = Math.max(900, fechas.length * 38);

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-base text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="text-sm text-slate-500 font-medium text-right">
                        <div>Período: <strong class="text-slate-800 font-semibold">${controller.currentPeriodo.inicio} al ${controller.currentPeriodo.fin}</strong></div>
                        <div>Cliente: <strong class="text-slate-800 font-semibold">${this.escapeHtml(cliente)}</strong> · Dato: <strong class="text-slate-800 font-semibold">${this.escapeHtml(dato)}</strong></div>
                    </div>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                        <div class="w-full" style="min-width:${anchoMinimo}px;">
                            ${series.map((serie, indice) => `
                                <div class="relative" style="height:${this.ALTURAS[indice] || 130}px;">
                                    <canvas id="canvas-tendencia-mermas-${indice}"></canvas>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.tooltipEl = document.createElement('div');
        this.tooltipEl.id = 'tooltip-tendencia-mermas';
        this.tooltipEl.className = 'pointer-events-none fixed z-[9999] hidden min-w-[320px] max-w-[420px] rounded-md border border-slate-300 bg-white p-3.5 text-[16px] text-slate-700 shadow-2xl';
        document.body.appendChild(this.tooltipEl);
        this.tooltipData = { series, fechas, cliente };

        series.forEach((serie, indice) => {
            const canvas = document.getElementById(`canvas-tendencia-mermas-${indice}`);
            if (!canvas) return;

            const valores = fechas.map((_, posicion) => {
                const valor = serie.valores ? serie.valores[posicion] : null;
                return valor === null || valor === undefined || isNaN(valor) ? null : Number(valor);
            });
            const tendencia = this.calcularTendencia(valores);
            const maxY = this.maximoY(valores);
            const esUltima = indice === series.length - 1;
            const esTotal = indice === 0;
            const color = '#2563eb';
            const self = this;

            const datasets = [{
                label: serie.label,
                data: valores,
                borderColor: color,
                backgroundColor: color,
                borderWidth: esTotal ? 2.4 : 2,
                pointRadius: esTotal ? 3 : 2.5,
                pointHoverRadius: 5,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                tension: 0,
                spanGaps: false,
                fill: false
            }];

            if (tendencia) {
                datasets.push({
                    label: 'Tendencia',
                    data: tendencia,
                    borderColor: '#475569',
                    borderWidth: 1.3,
                    borderDash: [7, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false
                });
            }

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: etiquetas,
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 3),
                    animation: false,
                    interaction: {
                        mode: 'nearest',
                        intersect: false
                    },
                    layout: {
                        padding: { top: 20, right: 22, bottom: esUltima ? 8 : 2, left: 8 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            position: 'nearest',
                            external: context => self.actualizarTooltip(context)
                        },
                        datalabels: {
                            display: ctx => {
                                const valor = ctx.dataset.data[ctx.dataIndex];
                                return ctx.datasetIndex === 0 && valor !== null && valor !== undefined && !isNaN(valor);
                            },
                            anchor: 'end',
                            align: 'top',
                            offset: 3,
                            clamp: true,
                            color: color,
                            font: { family: '"Segoe UI", sans-serif', size: esTotal ? 12.5 : 11.5, weight: '600' },
                            formatter: valor => self.formatearPorcentaje(valor)
                        }
                    },
                    scales: {
                        x: {
                            display: esUltima,
                            grid: { display: false },
                            border: { color: '#cbd5e1', width: 1 },
                            ticks: {
                                autoSkip: false,
                                maxRotation: 90,
                                minRotation: 90,
                                color: '#334155',
                                padding: 9,
                                font: { family: '"Segoe UI", sans-serif', size: 12, weight: '600' }
                            }
                        },
                        y: {
                            min: 0,
                            max: maxY,
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                            border: { color: '#cbd5e1', width: 1 },
                            title: {
                                display: true,
                                text: serie.label,
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 14, weight: '600' }
                            },
                            ticks: {
                                color: '#334155',
                                padding: 8,
                                font: { family: '"Segoe UI", sans-serif', size: 12, weight: '600' },
                                callback: value => self.formatearPorcentaje(value)
                            }
                        }
                    }
                }
            });

            canvas.addEventListener('mouseleave', () => this.ocultarTooltip());
            controller.activeCharts.push(chart);
        });
    },

    actualizarTooltip(context) {
        const el = this.tooltipEl;
        const tooltip = context.tooltip;

        if (!el) return;

        if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) {
            this.ocultarTooltip();
            return;
        }

        const indice = tooltip.dataPoints[0].dataIndex;
        const datos = this.tooltipData || {};
        const series = Array.isArray(datos.series) ? datos.series : [];
        const valores = {};

        series.forEach(serie => {
            valores[serie.key] = serie.valores ? serie.valores[indice] : null;
        });

        const filas = [
            ['cliente', datos.cliente || 'Todo'],
            ['mermatotal', valores.mermatotal],
            ['mermaalmacenaje', valores.mermaalmacenaje],
            ['mermamuertodistribucion', valores.mermamuertodistribucion],
            ['mermamuertotransporte', valores.mermamuertotransporte],
            ['mermanoapto', valores.mermanoapto],
            ['mermatransporte', valores.mermatransporte]
        ];

        el.innerHTML = `
            <div class="flex flex-col gap-1.5">
                ${filas.map(([etiqueta, valor]) => {
                    const texto = etiqueta === 'cliente'
                        ? this.escapeHtml(valor)
                        : this.formatearPorcentaje(valor === null || valor === undefined ? 0 : valor);
                    return `
                        <div class="flex items-center justify-between gap-8 leading-tight">
                            <span class="text-slate-500">${etiqueta}:</span>
                            <span class="font-bold text-slate-900 text-right">${texto}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        el.classList.remove('hidden');

        const rect = context.chart.canvas.getBoundingClientRect();
        const margen = 14;
        let x = rect.left + tooltip.caretX + margen;
        let y = rect.top + tooltip.caretY + margen;
        const ancho = el.offsetWidth;
        const alto = el.offsetHeight;

        if (x + ancho > window.innerWidth - 8) {
            x = rect.left + tooltip.caretX - ancho - margen;
        }
        if (y + alto > window.innerHeight - 8) {
            y = rect.top + tooltip.caretY - alto - margen;
        }

        el.style.left = `${Math.max(8, x)}px`;
        el.style.top = `${Math.max(8, y)}px`;
    },

    ocultarTooltip() {
        if (this.tooltipEl) {
            this.tooltipEl.classList.add('hidden');
        }
    }
};
