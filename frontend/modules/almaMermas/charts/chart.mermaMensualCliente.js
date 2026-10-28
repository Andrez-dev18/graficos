window.ChartAlmacenMermasMermaMensualCliente = {
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

    formatearMes(periodo) {
        const partes = String(periodo || '').split('-').map(Number);
        if (partes.length !== 2 || partes.some(p => isNaN(p))) return String(periodo || '');
        const fecha = new Date(partes[0], partes[1] - 1, 1);
        return new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fecha).toLowerCase();
    },

    extraerAnio(periodo) {
        const partes = String(periodo || '').split('-');
        return partes[0] || '';
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

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        const payload = controller.cachePayload || {};
        const clientes = Array.isArray(data) ? data : [];
        const meses = Array.isArray(payload.fechas) ? payload.fechas : [];
        const titulo = payload.titulo || 'Porcentaje de Merma Mensualizada por Fecha de Proceso y cliente';
        const subtitulo = payload.subtitulo || 'Merma total sobre la entrada';
        const etiquetaY = payload.etiqueta_y || 'Porcentaje de Merma';
        const maxY = Math.max(6, Number(payload.max_y) || 6);
        const stepY = Number(payload.step_y) || 2;
        const etiquetas = meses.map(m => this.formatearMes(m));

        // Ancho por mes cómodo para lectura
        const pxPorMes = Math.max(120, Math.floor(900 / Math.max(1, meses.length)));
        const anchoMinimo = 130 + (meses.length * pxPorMes);

        // Agrupación de años para la cabecera superior
        const aniosUnicos = [...new Set(meses.map(m => this.extraerAnio(m)))].filter(Boolean);
        const textoAnio = aniosUnicos.join(' - ');

        if (clientes.length === 0 || meses.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="text-[11px] text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                        Período: <strong class="text-slate-800 font-semibold">${controller.currentPeriodo.inicio} al ${controller.currentPeriodo.fin}</strong>
                    </div>
                </div>

                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                        <div class="w-full" style="min-width: ${anchoMinimo}px;">
                            <!-- CABECERA SUPERIOR: CLIENTE / FECHAPROCESO / AÑO -->
                            <div class="grid items-center border-b border-slate-200 pb-1.5 mb-1 bg-slate-50/70 text-slate-600 rounded-t-lg" style="grid-template-columns: 120px minmax(0, 1fr);">
                                <p class="text-center text-[11px] font-bold uppercase tracking-wider sticky left-0 z-30 bg-slate-50/90 py-1 border-r border-slate-200">
                                    cliente
                                </p>
                                <div class="text-center text-[11px] font-bold py-1">
                                    <span class="text-slate-400 font-normal">fechaproceso</span>
                                    ${textoAnio ? `<span class="ml-2 font-bold text-slate-700">${this.escapeHtml(textoAnio)}</span>` : ''}
                                </div>
                            </div>

                            <!-- FILAS POR CLIENTE (SMALL MULTIPLES) -->
                            <div class="grid" style="grid-template-columns: 120px minmax(0, 1fr);">
                                ${clientes.map((fila, indice) => {
                                    const esUltima = indice === clientes.length - 1;
                                    const altura = esUltima ? 210 : 180;
                                    return `
                                        <div class="flex items-center justify-end pr-3 text-[11px] font-bold text-slate-700 uppercase sticky left-0 z-20 bg-white border-r border-slate-200 ${esUltima ? '' : 'border-b border-slate-100'}" style="min-height: ${altura}px;">
                                            <span class="truncate" title="${this.escapeHtml(fila.cliente)}">${this.escapeHtml(fila.cliente)}</span>
                                        </div>
                                        <div class="relative ${esUltima ? '' : 'border-b border-slate-100'}" style="height: ${altura}px;">
                                            <canvas id="canvas-merma-mes-${indice}"></canvas>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        clientes.forEach((fila, indice) => {
            const canvas = document.getElementById(`canvas-merma-mes-${indice}`);
            if (!canvas) return;

            const esUltima = indice === clientes.length - 1;
            const valores = meses.map((_, posicion) => {
                const valor = fila.valores ? fila.valores[posicion] : null;
                return valor === null || valor === undefined || isNaN(valor) ? null : Number(valor);
            });

            const tendencia = this.calcularTendencia(valores);

            const datasets = [{
                label: etiquetaY,
                data: valores,
                borderColor: '#e15759',
                backgroundColor: '#e15759',
                borderWidth: 2.2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#e15759',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                tension: 0,
                spanGaps: true,
                fill: false
            }];

            if (tendencia) {
                datasets.push({
                    label: 'Tendencia',
                    data: tendencia,
                    borderColor: '#1e293b',
                    borderWidth: 1.6,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false
                });
            }

            const self = this;
            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: etiquetas, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    animation: { duration: 250 },
                    interaction: { mode: 'nearest', intersect: false },
                    layout: { padding: { top: 22, right: 24, bottom: esUltima ? 8 : 4, left: 10 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            mode: 'nearest',
                            intersect: false,
                            displayColors: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { size: 12, weight: 'bold' },
                            bodyFont: { size: 11 },
                            padding: 8,
                            cornerRadius: 6,
                            filter: item => item.datasetIndex === 0 && item.parsed && item.parsed.y !== null && item.parsed.y !== undefined,
                            callbacks: {
                                title: items => {
                                    if (!items || items.length === 0) return '';
                                    return `${fila.cliente} · ${items[0].label}`;
                                },
                                label: item => {
                                    if (!item || !item.parsed) return '';
                                    return `${etiquetaY}: ${self.formatearPorcentaje(item.parsed.y)}`;
                                }
                            }
                        },
                        datalabels: {
                            display: ctx => {
                                const valor = ctx.dataset.data[ctx.dataIndex];
                                return ctx.datasetIndex === 0 && valor !== null && valor !== undefined && !isNaN(valor);
                            },
                            anchor: 'end',
                            align: 'top',
                            offset: 4,
                            font: { size: 10, weight: 'bold' },
                            color: '#1e293b',
                            formatter: valor => self.formatearPorcentaje(valor)
                        }
                    },
                    scales: {
                        x: {
                            display: esUltima,
                            grid: { display: false },
                            ticks: {
                                font: { size: 11, weight: 'bold' },
                                color: '#475569',
                                autoSkip: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            min: 0,
                            max: maxY,
                            title: {
                                display: true,
                                text: etiquetaY,
                                font: { size: 9, weight: 'bold' },
                                color: '#64748B'
                            },
                            grid: {
                                color: '#f1f5f9',
                                drawBorder: false
                            },
                            ticks: {
                                stepSize: stepY,
                                font: { size: 9 },
                                color: '#64748B',
                                callback: valor => self.formatearPorcentaje(valor)
                            }
                        }
                    }
                }
            });

            if (controller && Array.isArray(controller.activeCharts)) {
                controller.activeCharts.push(chart);
            }
        });
    }
};
