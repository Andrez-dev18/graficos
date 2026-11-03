window.MermaAguaVistaProceso = {
    charts: [],
    datos: null,
    tooltipEl: null,

    render(contenedor, data) {
        if (!contenedor) return;

        this.destroy();
        this.datos = data || {};
        this.initTooltip();

        const fechas = Array.isArray(this.datos.fechas) ? this.datos.fechas : [];
        const procesos = Array.isArray(this.datos.procesos) ? this.datos.procesos : [];

        if (!procesos.length || !fechas.length) {
            contenedor.innerHTML = this.buildEmptyState(this.datos);
            return;
        }

        contenedor.innerHTML = this.buildLayout(this.datos, fechas, procesos);

        const self = this;
        this.charts = procesos.map((proceso, indice) => {
            const canvas = document.getElementById(`canvas-agua-proceso-${indice}`);
            if (!canvas || typeof Chart === 'undefined') return null;

            return new Chart(canvas.getContext('2d'), this.buildChartConfig(proceso, fechas, indice === procesos.length - 1, self));
        }).filter(Boolean);
    },

    buildLayout(data, fechas, procesos) {
        const filtros = data.filtros_aplicados || {};
        const resumen = this.escapeHtml(filtros.resumen || '');
        const legenda = this.buildLegend(data.subdatos || []);

        const paneles = procesos.map((proceso, indice) => {
            const ultimo = indice === procesos.length - 1;
            return `
                <div class="flex items-stretch gap-1 sm:gap-2">
                    <div class="w-24 sm:w-28 shrink-0 flex items-center justify-end pr-1 sm:pr-2">
                        <span class="text-[11px] sm:text-[12px] font-bold text-slate-600 text-right leading-tight break-words">
                            ${this.escapeHtml(proceso.proceso)}
                        </span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="relative w-full" style="height: ${ultimo ? '210px' : '180px'};">
                            <canvas id="canvas-agua-proceso-${indice}" role="img" aria-label="Proceso ${this.escapeHtml(proceso.proceso)}"></canvas>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-4 py-3 sm:px-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">VistaProceso</h2>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Promedio diario por proceso y tipo de dato · ${resumen}
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
                        ${legenda}
                    </div>
                </div>

                <div class="p-2 sm:p-3">
                    <div class="flex flex-col gap-1">
                        ${paneles}
                    </div>
                </div>

                <div class="px-4 sm:px-6 py-2 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>Fuente: factmermaagua · ${fechas.length} días</span>
                    <span>${data.fecha_corte_dmy ? `Corte: ${this.escapeHtml(data.fecha_corte_dmy)}` : ''}</span>
                </div>
            </section>
        `;
    },

    buildLegend(subdatos) {
        return subdatos.map((subdato) => {
            const id = String(subdato.id || subdato.label || '');
            const color = this.getColor(id);
            return `
                <span class="inline-flex items-center gap-1.5">
                    <span class="inline-block w-4 h-0.5 rounded-full" style="background-color:${color};"></span>
                    <span>${this.escapeHtml(subdato.label || id)}</span>
                </span>
            `;
        }).join('');
    },

    buildChartConfig(proceso, fechas, esUltimo, self) {
        const labels = fechas.map((fecha) => self.formatFechaCorta(fecha));
        const series = [...(proceso.series || [])].sort((a, b) => self.ordenDibujo(a.subdato) - self.ordenDibujo(b.subdato));
        const escala = self.calcularEscala(series);

        const datasets = series.map((serie) => {
            const color = self.getColor(serie.subdato);
            const esM3 = serie.subdato === 'm3';
            return {
                label: serie.subdato,
                data: (serie.valores || []).map((valor) => {
                    if (valor === null || valor === undefined) return null;
                    const numero = Number(valor);
                    return Number.isFinite(numero) ? numero : null;
                }),
                borderColor: color,
                backgroundColor: color,
                borderWidth: esM3 ? 2 : 2,
                borderDash: esM3 ? [4, 3] : [],
                order: esM3 ? -1 : 0,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointHitRadius: 8,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                tension: 0,
                spanGaps: false,
                fill: false
            };
        });

        const valueLabelsPlugin = {
            id: `aguaValueLabels-${proceso.proceso}`,
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                if (!ctx) return;

                const colocadas = [];
                const salto = chart.width < 900 ? 2 : 1;

                ctx.save();
                ctx.font = '600 9px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || meta.hidden) return;

                    meta.data.forEach((point, index) => {
                        if (point.skip || index % salto !== 0) return;
                        const value = dataset.data[index];
                        if (value === null || value === undefined) return;

                        const texto = self.formatNum(value, 3);
                        const ancho = ctx.measureText(texto).width;
                        const x = point.x;
                        const y = point.y - 7;
                        const rect = {
                            left: x - ancho / 2 - 1,
                            right: x + ancho / 2 + 1,
                            top: y - 8,
                            bottom: y + 1
                        };

                        if (colocadas.some((otra) => !(
                            rect.right < otra.left ||
                            rect.left > otra.right ||
                            rect.bottom < otra.top ||
                            rect.top > otra.bottom
                        ))) {
                            return;
                        }

                        colocadas.push(rect);
                        ctx.fillStyle = dataset.borderColor;
                        ctx.fillText(texto, x, y);
                    });
                });

                ctx.restore();
            }
        };

        return {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                layout: {
                    padding: {
                        top: 24,
                        right: 12,
                        bottom: esUltimo ? 28 : 4,
                        left: 4
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,
                        mode: 'nearest',
                        intersect: false,
                        external: (context) => self.renderTooltip(context, proceso, fechas)
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: esUltimo,
                            color: '#475569',
                            font: {
                                size: 10,
                                weight: '600'
                            },
                            maxRotation: 0,
                            autoSkip: true,
                            autoSkipPadding: 8
                        }
                    },
                    y: {
                        min: escala.min,
                        max: escala.max,
                        grid: {
                            color: '#e2e8f0'
                        },
                        title: {
                            display: true,
                            text: 'Prom. valor',
                            color: '#64748b',
                            font: {
                                size: 10
                            }
                        },
                        ticks: {
                            stepSize: escala.step,
                            color: '#64748b',
                            font: {
                                size: 9
                            },
                            callback: (value) => self.formatNum(value, 1)
                        }
                    }
                }
            },
            plugins: [valueLabelsPlugin]
        };
    },

    initTooltip() {
        let el = document.getElementById('tooltip-merma-agua');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tooltip-merma-agua';
            document.body.appendChild(el);
        }

        el.className = 'hidden fixed z-[9999] pointer-events-none bg-white border border-slate-300 shadow-xl rounded-md px-3 py-2 text-[12px] text-slate-700 min-w-[255px]';
        el.style.left = '0px';
        el.style.top = '0px';
        this.tooltipEl = el;
    },

    renderTooltip(context, proceso, fechas) {
        const tooltip = context.tooltip;
        const el = this.tooltipEl;

        if (!el) return;

        if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints || !tooltip.dataPoints.length) {
            el.classList.add('hidden');
            return;
        }

        const punto = tooltip.dataPoints[0];
        const indice = punto.dataIndex;
        const fecha = fechas[indice];
        const subdato = punto.dataset?.label || '';
        const valor = punto.dataset?.data?.[indice];

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:auto 1fr;column-gap:16px;row-gap:3px;white-space:nowrap;">
                <span style="color:#94a3b8;">proceso:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(proceso.proceso)}</span>
                <span style="color:#94a3b8;">subdato:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(subdato)}</span>
                <span style="color:#94a3b8;">Día de fecha:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(this.formatFechaLarga(fecha))}</span>
                <span style="color:#94a3b8;">Prom. valor:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(this.formatNum(valor, 3))}</span>
            </div>
        `;

        el.classList.remove('hidden');

        const canvas = context.chart.canvas;
        const rect = canvas.getBoundingClientRect();
        const tooltipRect = el.getBoundingClientRect();

        let left = rect.left + tooltip.caretX + 14;
        let top = rect.top + tooltip.caretY - 12;

        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = rect.left + tooltip.caretX - tooltipRect.width - 14;
        }

        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = window.innerHeight - tooltipRect.height - 8;
        }

        el.style.left = `${Math.max(8, left)}px`;
        el.style.top = `${Math.max(8, top)}px`;
    },

    calcularEscala(series) {
        const numeros = [];

        series.forEach((serie) => {
            (serie.valores || []).forEach((valor) => {
                if (valor === null || valor === undefined) return;
                const numero = Number(valor);
                if (Number.isFinite(numero)) numeros.push(numero);
            });
        });

        if (!numeros.length) {
            return { min: 0, max: 2, step: 0.5 };
        }

        let min = Math.min(0, ...numeros);
        let max = Math.max(2, ...numeros);

        if (min < 0) {
            min = Math.floor((min - 0.25) * 2) / 2;
        } else {
            min = 0;
        }

        max = Math.ceil(max * 2) / 2;

        const rango = max - min;
        let step = 0.5;
        if (rango > 2.5) step = 1;
        if (rango > 6) step = 2;
        if (rango > 12) step = 5;

        return { min, max, step };
    },

    ordenDibujo(subdato) {
        const orden = {
            'Limite C': 0,
            'Limite I': 1,
            'Limite S': 2,
            'm3': 3
        };
        return orden[subdato] ?? 99;
    },

    getColor(subdato) {
        const colores = {
            'm3': '#000000',
            'Limite C': '#00007f',
            'Limite I': '#005500',
            'Limite S': '#ff0000'
        };
        return colores[subdato] || '#64748b';
    },

    formatFechaCorta(fecha) {
        const partes = String(fecha).split('-').map(Number);
        if (partes.length !== 3) return String(fecha);
        return `${partes[2]} de ${this.mesCorto(partes[1])}`;
    },

    formatFechaLarga(fecha) {
        const partes = String(fecha).split('-').map(Number);
        if (partes.length !== 3) return String(fecha);
        return `${partes[2]} de ${this.mesLargo(partes[1])} de ${partes[0]}`;
    },

    mesCorto(mes) {
        return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][mes - 1] || '';
    },

    mesLargo(mes) {
        return ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mes - 1] || '';
    },

    formatNum(valor, decimales = 3) {
        if (valor === null || valor === undefined || valor === '') return '—';
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '—';

        return numero.toLocaleString('es-PE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    buildEmptyState(data) {
        const filtros = data?.filtros_aplicados || {};
        const resumen = this.escapeHtml(filtros.resumen || '');
        return `
            <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <div class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <i class="fa-solid fa-droplet-slash"></i>
                </div>
                <p class="text-sm font-semibold text-slate-700">Sin datos disponibles</p>
                <p class="text-xs text-slate-500 mt-1">No se encontraron registros para los filtros seleccionados.</p>
                ${resumen ? `<p class="text-[10px] text-slate-400 mt-2">${resumen}</p>` : ''}
            </div>
        `;
    },

    destroy() {
        this.charts.forEach((chart) => {
            try {
                chart.destroy();
            } catch (e) {
                console.warn('Error al destruir gráfico de agua:', e);
            }
        });
        this.charts = [];

        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }
    }
};
