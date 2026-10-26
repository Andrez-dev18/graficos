window.ChartAlmacenMermasMermaDiariaCliente = {
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

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        const payload = controller.cachePayload || {};
        const clientes = Array.isArray(data) ? data : [];
        const fechas = Array.isArray(payload.fechas) ? payload.fechas : [];
        const titulo = payload.titulo || 'Porcentaje de Merma Diaria por Fecha de Proceso segmentado por cliente';
        const subtitulo = payload.subtitulo || 'Merma total sobre la entrada';
        const etiquetaY = payload.etiqueta_y || 'Porcentaje de Merma';
        const maxY = Math.max(15, Number(payload.max_y) || 0);
        const stepY = Number(payload.step_y) || 5;
        const etiquetas = fechas.map(fecha => this.formatearFecha(fecha));

        if (clientes.length === 0 || fechas.length === 0) {
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
                    <div class="text-[11px] text-slate-500 font-medium">
                        Período: <strong class="text-slate-800 font-semibold">${controller.currentPeriodo.inicio} al ${controller.currentPeriodo.fin}</strong>
                    </div>
                </div>
                <div class="px-4 pt-3 pb-6 sm:px-6">
                    <div class="grid items-center border-b border-slate-100 pb-2 mb-1" style="grid-template-columns: 112px minmax(0, 1fr);">
                        <p class="text-center text-[12px] font-bold text-slate-600">cliente</p>
                        <p class="text-center text-[12px] font-bold text-slate-600">${this.escapeHtml(etiquetaY)}</p>
                    </div>
                    <div class="grid" style="grid-template-columns: 112px minmax(0, 1fr);">
                        ${clientes.map((fila, indice) => {
                            const esUltima = indice === clientes.length - 1;
                            const altura = esUltima ? 220 : 190;
                            return `
                                <div class="flex items-center justify-end pr-3 text-[11px] font-bold text-slate-700 uppercase ${esUltima ? '' : 'border-b border-slate-100'}" style="min-height: ${altura}px;">
                                    ${this.escapeHtml(fila.cliente)}
                                </div>
                                <div class="relative ${esUltima ? '' : 'border-b border-slate-100'}" style="height: ${altura}px;">
                                    <canvas id="canvas-merma-cliente-${indice}"></canvas>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        clientes.forEach((fila, indice) => {
            const canvas = document.getElementById(`canvas-merma-cliente-${indice}`);
            if (!canvas) return;

            const esUltima = indice === clientes.length - 1;
            const valores = fechas.map((_, posicion) => {
                const valor = fila.valores ? fila.valores[posicion] : null;
                return valor === null || valor === undefined || isNaN(valor) ? null : Number(valor);
            });
            const tendencia = this.calcularTendencia(valores);
            const datasets = [{
                label: etiquetaY,
                data: valores,
                borderColor: '#e15759',
                backgroundColor: '#e15759',
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 4,
                pointBackgroundColor: '#e15759',
                pointBorderColor: '#e15759',
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

            const self = this;
            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: etiquetas, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    animation: { duration: 180 },
                    interaction: { mode: 'nearest', intersect: false },
                    layout: { padding: { top: 20, right: 14, bottom: 4, left: 4 } },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            mode: 'nearest',
                            intersect: false,
                            displayColors: false,
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
                            offset: 3,
                            clamp: true,
                            color: '#334155',
                            font: { family: '"Segoe UI", sans-serif', size: 8, weight: '600' },
                            formatter: value => self.formatearPorcentaje(value)
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            border: { display: esUltima, color: '#cbd5e1', width: 1 },
                            ticks: {
                                display: esUltima,
                                autoSkip: false,
                                maxRotation: 90,
                                minRotation: 90,
                                color: '#334155',
                                padding: 6,
                                font: { family: '"Segoe UI", sans-serif', size: 8, weight: '600' }
                            }
                        },
                        y: {
                            min: 0,
                            max: maxY,
                            afterFit: scale => { scale.width = 62; },
                            grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                            border: { color: '#cbd5e1', width: 1 },
                            title: {
                                display: true,
                                text: etiquetaY,
                                color: '#475569',
                                font: { family: '"Segoe UI", sans-serif', size: 9, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: stepY,
                                color: '#334155',
                                font: { family: '"Segoe UI", sans-serif', size: 9, weight: '600' },
                                padding: 6,
                                callback: value => self.formatearPorcentaje(value)
                            }
                        }
                    }
                }
            });

            controller.activeCharts.push(chart);
        });
    }
};
