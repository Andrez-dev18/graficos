/**
 * GraficoIndicadores - Indicador de stock de jabas por item y provincia.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartGraficoIndicadores = {
    containerRef: null,
    controllerRef: null,
    datosBackend: null,
    _fechas: [],
    _items: [],
    _provincias: [],
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _resizeObserver: null,
    _resizeTimer: null,
    _lastWidth: 0,
    _activo: false,
    _tooltipAbort: null,

    render(controller, data, container) {
        this._activo = true;
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-graficos-lista');

        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._observarAncho();
        this.renderView();
    },

    destroy() {
        this._activo = false;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        clearTimeout(this._resizeTimer);
        this._resizeTimer = null;

        this._ocultarTooltip();

        if (this._tooltipAbort) {
            this._tooltipAbort.abort();
            this._tooltipAbort = null;
        }
        this._tooltipContainer = null;

        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }
    },

    escapeHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatPorcentaje(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';
        return `${(Number(valor) * 100).toFixed(2)}%`;
    },

    _inicializarTooltip() {
        if (!this.tooltipEl) {
            this.tooltipEl = document.getElementById('indicador-tooltip');
            if (!this.tooltipEl) {
                this.tooltipEl = document.createElement('div');
                this.tooltipEl.id = 'indicador-tooltip';
                this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[300px] max-w-[420px] font-sans';
                document.body.appendChild(this.tooltipEl);
            }
        }

        if (!this._tooltipGlobalBound) {
            window.addEventListener('scroll', () => this._ocultarTooltip(), true);
            this._tooltipGlobalBound = true;
        }
    },

    _bindTooltipEvents() {
        const contenedor = this.containerRef;
        if (!contenedor || this._tooltipContainer === contenedor) return;
        this._tooltipContainer = contenedor;

        if (this._tooltipAbort) {
            this._tooltipAbort.abort();
        }
        this._tooltipAbort = new AbortController();
        const signal = this._tooltipAbort.signal;

        contenedor.addEventListener('mouseover', event => {
            const objetivo = event.target.closest?.('[data-indicador-tt]');
            if (!objetivo || objetivo === this._tooltipTarget) return;

            this._ocultarTooltip();
            this._tooltipTarget = objetivo;
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            clearTimeout(this._tooltipTimer);
            this._tooltipTimer = setTimeout(() => {
                if (this._tooltipTarget === objetivo) {
                    this._mostrarTooltip(objetivo);
                }
            }, 500);
        }, { signal });

        contenedor.addEventListener('mousemove', event => {
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            if (this.tooltipEl && !this.tooltipEl.classList.contains('hidden')) {
                this._posicionarTooltip();
            }
        }, { signal });

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.('[data-indicador-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const panel = elemento.dataset.indicadorPanel;
        const indice = Number(elemento.dataset.indicadorRow);
        const fecha = elemento.dataset.indicadorFecha;
        const series = panel === 'items' ? this._items : this._provincias;
        const serie = series[indice];
        if (!serie) return;

        const punto = (serie.puntos || []).find(item => item.fecha === fecha);
        if (!punto) return;

        const provincia = panel === 'items' ? 'Todas' : (serie.provincia || '—');

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                <span class="text-slate-500 font-normal whitespace-nowrap">Item:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(serie.item)}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">codalmacen:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(serie.codalmacen)}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">provincia:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(provincia)}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Día de fechaproceso:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(this._formatFechaLarga(fecha))}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Indicador:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(this.formatPorcentaje(punto.indicador))}</span>
            </div>
        `;

        this.tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this.tooltipEl) return;

        const tooltipWidth = this.tooltipEl.offsetWidth || 340;
        const tooltipHeight = this.tooltipEl.offsetHeight || 155;
        let x = this._mouseX + 14;
        let y = this._mouseY + 14;

        if (x + tooltipWidth > window.innerWidth - 12) {
            x = this._mouseX - tooltipWidth - 14;
        }
        if (y + tooltipHeight > window.innerHeight - 12) {
            y = this._mouseY - tooltipHeight - 14;
        }

        this.tooltipEl.style.left = `${Math.max(10, x)}px`;
        this.tooltipEl.style.top = `${Math.max(10, y)}px`;
    },

    _ocultarTooltip() {
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
        this._tooltipTarget = null;

        if (this.tooltipEl) {
            this.tooltipEl.classList.add('hidden');
        }
    },

    _observarAncho() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        if (typeof ResizeObserver === 'undefined' || !this.containerRef) return;

        this._lastWidth = Math.round(this.containerRef.clientWidth || 0);
        this._resizeObserver = new ResizeObserver(entries => {
            if (!this._activo) return;

            const ancho = Math.round(entries[0]?.contentRect?.width || 0);
            if (!ancho || Math.abs(ancho - this._lastWidth) < 4) return;

            this._lastWidth = ancho;
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                if (!this._activo) return;
                if (!this.containerRef?.querySelector('#indicador-panel-items')) return;
                this.renderView();
            }, 120);
        });
        this._resizeObserver.observe(this.containerRef);
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor || !this._activo) return;

        this._ocultarTooltip();

        const data = this.datosBackend || {};
        const fechas = Array.isArray(data.fechas) ? data.fechas.slice() : [];
        const items = Array.isArray(data.items) ? data.items : [];
        const provincias = Array.isArray(data.provincias) ? data.provincias : [];

        if (!fechas.length || (!items.length && !provincias.length)) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-chart-line text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para Indicador de Jabas</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste el período o los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        this._fechas = fechas;
        this._items = items;
        this._provincias = provincias;

        const fechaInicio = this._formatFechaCorta(data.fecha_inicio || fechas[0]);
        const fechaFin = this._formatFechaCorta(data.fecha_fin || fechas[fechas.length - 1]);
        const gradiente = 'linear-gradient(90deg,#a3123a 0%,#e33f43 16.67%,#f8816b 33.33%,#ced7c3 50%,#73ba67 66.67%,#44914e 83.33%,#24693d 100%)';

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">Indicador Stock de Jabas</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(fechaInicio)} a ${this.escapeHtml(fechaFin)} · ${this._items.length} ítems · ${this._provincias.length} series provinciales</p>
                    </div>
                    <div class="flex flex-col items-end gap-1.5">
                        <span class="text-[10px] font-bold text-slate-500">Objetivo 80%</span>
                        <div class="flex items-center gap-2 text-[9px] font-semibold text-slate-500">
                            <span>60.00%</span>
                            <span class="w-28 h-2 rounded-sm border border-slate-200" style="background:${gradiente};"></span>
                            <span>100.00%</span>
                        </div>
                    </div>
                </div>

                <div class="px-4 pt-4">
                    <div id="indicador-panel-items"></div>
                </div>

                <div class="mx-4 my-5 border-t border-slate-200"></div>

                <div class="px-4 pb-2">
                    <div id="indicador-panel-provincias"></div>
                </div>
            </section>
        `;

        this._renderPanel('items', this._items, {
            labelWidth: 195,
            axisWidth: 56,
            rowHeight: 142,
            axisHeight: 92,
            density: 12,
            ticks: [1, 0.5, 0],
            headerLabel: 'codalmacen / Item',
            dateStyle: 'compact'
        });

        this._renderPanel('provincias', this._provincias, {
            labelWidth: 300,
            axisWidth: 56,
            rowHeight: 76,
            axisHeight: 96,
            density: 25,
            ticks: [1, 0.8, 0.6, 0.4, 0.2, 0],
            headerLabel: 'codalmacen / provincia / Item',
            dateStyle: 'long'
        });
    },

    _renderPanel(panel, series, config) {
        const contenedor = document.getElementById(`indicador-panel-${panel}`);
        if (!contenedor) return;

        const anchoContenedor = Math.max(360, contenedor.clientWidth || 0);
        const labelWidth = config.labelWidth;
        const axisWidth = config.axisWidth;
        const anchoDisponible = Math.max(520, anchoContenedor - labelWidth - axisWidth - 8);
        const anchoPorFecha = Math.max(520, (this._fechas.length - 1) * 32 + 24);
        const plotWidth = Math.max(anchoDisponible, anchoPorFecha);
        const minWidth = labelWidth + axisWidth + plotWidth;
        const rowHeight = config.rowHeight;
        const axisHeight = config.axisHeight;
        const paquete = {
            panel,
            fechas: this._fechas,
            labelWidth,
            axisWidth,
            plotWidth,
            rowHeight,
            axisHeight,
            ticks: config.ticks || [1, 0.5, 0],
            labelStep: this._pasoEtiquetas(plotWidth, this._fechas.length, config.density),
            dateStyle: config.dateStyle
        };

        const filas = series.length
            ? series.map((serie, index) => this._renderFila(serie, index, paquete)).join('')
            : `<div class="px-3 py-6 text-xs text-slate-400">Sin series para este nivel.</div>`;

        const ejeFechas = this._renderEjeFechas(paquete);

        contenedor.innerHTML = `
            <div class="overflow-x-auto custom-scrollbar">
                <div style="min-width:${minWidth}px;">
                    <div class="flex items-center border-b border-slate-200 bg-slate-100" style="height:32px;">
                        <div class="px-2 text-[10px] font-bold text-slate-600 border-r border-slate-200" style="width:${labelWidth}px;min-width:${labelWidth}px;position:sticky;left:0;z-index:30;background:#f1f5f9;">${this.escapeHtml(config.headerLabel)}</div>
                        <div class="border-r border-slate-200" style="width:${axisWidth}px;min-width:${axisWidth}px;position:sticky;left:${labelWidth}px;z-index:30;background:#f1f5f9;"></div>
                        <div class="text-center text-[10px] font-semibold text-slate-600" style="width:${plotWidth}px;min-width:${plotWidth}px;">Día de fechaproceso</div>
                    </div>
                    ${filas}
                    <div class="flex border-t border-slate-200 bg-white" style="height:${axisHeight}px;min-width:${minWidth}px;">
                        <div class="border-r border-slate-200 bg-white" style="width:${labelWidth}px;min-width:${labelWidth}px;position:sticky;left:0;z-index:20;background:#ffffff;"></div>
                        <div class="border-r border-slate-200 bg-white" style="width:${axisWidth}px;min-width:${axisWidth}px;position:sticky;left:${labelWidth}px;z-index:20;background:#ffffff;"></div>
                        <div class="relative bg-white" style="width:${plotWidth}px;min-width:${plotWidth}px;height:${axisHeight}px;">${ejeFechas}</div>
                    </div>
                </div>
            </div>
        `;
    },

    _renderFila(serie, indice, ctx) {
        const puntos = new Map();
        (serie.puntos || []).forEach(punto => {
            const valor = Number(punto.indicador);
            if (Number.isFinite(valor)) {
                puntos.set(punto.fecha, valor);
            }
        });

        const {
            fechas,
            labelWidth,
            axisWidth,
            plotWidth,
            rowHeight,
            labelStep,
            ticks
        } = ctx;
        const plotPad = 10;
        const plotHeight = rowHeight - plotPad * 2;
        const anchoGrafico = Math.max(1, plotWidth - plotPad * 2);
        const segmentos = [];
        const marcas = [];
        const etiquetas = [];
        const nulos = fechas.reduce((total, fecha) => total + (puntos.has(fecha) ? 0 : 1), 0);
        let anterior = null;

        fechas.forEach((fecha, fechaIndex) => {
            if (!puntos.has(fecha)) {
                anterior = null;
                return;
            }

            const valor = Math.max(0, Math.min(1, Number(puntos.get(fecha))));
            const x = plotPad + (fechas.length <= 1 ? anchoGrafico / 2 : fechaIndex * (anchoGrafico / (fechas.length - 1)));
            const y = plotPad + (1 - valor) * plotHeight;
            const color = this._colorIndicador(valor);
            const texto = this.formatPorcentaje(valor);

            if (anterior) {
                segmentos.push(`
                    <line x1="${anterior.x.toFixed(1)}" y1="${anterior.y.toFixed(1)}"
                        x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
                        stroke="${this._colorIndicador((anterior.valor + valor) / 2)}"
                        stroke-width="1.7" stroke-linecap="round"></line>
                `);
            }

            marcas.push(`
                <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${color}"
                    stroke="#ffffff" stroke-width="0.8" pointer-events="none"></circle>
                <circle data-indicador-tt="1" data-indicador-panel="${ctx.panel}" data-indicador-row="${indice}"
                    data-indicador-fecha="${this.escapeHtml(fecha)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"
                    r="9" fill="transparent" pointer-events="all" style="cursor:pointer;"></circle>
            `);

            if (fechaIndex % labelStep === 0 || fechaIndex === fechas.length - 1) {
                const labelY = Math.max(18, Math.min(rowHeight - 6, y - 4));
                const anchor = y < 38 ? 'end' : 'start';
                etiquetas.push(`
                    <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}"
                        transform="rotate(-90 ${x.toFixed(1)} ${labelY.toFixed(1)})"
                        text-anchor="${anchor}" font-size="10.5" font-weight="700"
                        fill="${color}" stroke="#ffffff" stroke-width="1.8" paint-order="stroke"
                        pointer-events="none">${this.escapeHtml(texto)}</text>
                `);
            }

            anterior = { x, y, valor };
        });

        const lineasGrilla = ticks.map(tick => {
            const y = plotPad + (1 - tick) * plotHeight;
            return `<line x1="${plotPad}" y1="${y.toFixed(1)}" x2="${(plotWidth - plotPad).toFixed(1)}" y2="${y.toFixed(1)}"
                stroke="${tick === 0 || tick === 1 ? '#cbd5e1' : '#e2e8f0'}"
                stroke-width="1" ${tick === 0 || tick === 1 ? '' : 'stroke-dasharray="2 2"'}></line>`;
        }).join('');

        return `
            <div class="flex border-b border-slate-100" style="height:${rowHeight}px;">
                <div class="flex items-center border-r border-slate-200 bg-white" style="width:${labelWidth}px;min-width:${labelWidth}px;position:sticky;left:0;z-index:20;background:#ffffff;">
                    ${this._renderEtiquetaSerie(serie, ctx.panel, labelWidth)}
                </div>
                <div class="relative border-r border-slate-200 bg-white" style="width:${axisWidth}px;min-width:${axisWidth}px;position:sticky;left:${labelWidth}px;z-index:20;background:#ffffff;">
                    <span class="absolute left-0.5 top-1/2 -translate-y-1/2 text-[7.5px] font-semibold text-slate-400" style="writing-mode:vertical-rl;transform:translateY(-50%) rotate(180deg);">Indicador</span>
                    <div class="flex h-full flex-col justify-between py-[10px] pl-4 pr-2 text-right text-[9px] font-mono text-slate-400">
                        ${ticks.map(tick => `<span>${Number(tick).toFixed(1)}</span>`).join('')}
                    </div>
                </div>
                <div class="relative bg-white" style="width:${plotWidth}px;min-width:${plotWidth}px;height:${rowHeight}px;">
                    ${nulos > 0 ? `<span class="absolute right-1 top-1 z-10 rounded bg-slate-200/90 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500 pointer-events-none">${nulos} nulos</span>` : ''}
                    <svg width="${plotWidth}" height="${rowHeight}" viewBox="0 0 ${plotWidth} ${rowHeight}" class="block overflow-visible">
                        ${lineasGrilla}
                        ${segmentos.join('')}
                        ${marcas.join('')}
                        ${etiquetas.join('')}
                    </svg>
                </div>
            </div>
        `;
    },

    _renderEtiquetaSerie(serie, panel, labelWidth) {
        const codalmacen = this.escapeHtml(serie.codalmacen);
        const item = this.escapeHtml(serie.item);
        const provincia = this.escapeHtml(serie.provincia);

        if (panel === 'provincias') {
            return `
                <div class="flex items-stretch h-full w-full">
                    <div class="flex items-center justify-center border-r border-slate-100 px-1 text-[9px] font-semibold text-slate-500" style="width:34px;min-width:34px;writing-mode:vertical-rl;transform:rotate(180deg);">${codalmacen}</div>
                    <div class="flex flex-col justify-center min-w-0 px-2">
                        <span class="text-[10px] font-semibold text-slate-700 truncate" title="${provincia}">${provincia || '&nbsp;'}</span>
                        <span class="text-[10px] text-slate-500 truncate" title="${item}">${item}</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="flex flex-col justify-center min-w-0 px-3" style="width:${labelWidth}px;">
                <span class="text-[9px] font-semibold text-slate-500 uppercase truncate" title="${codalmacen}">${codalmacen}</span>
                <span class="text-[11px] font-semibold text-slate-800 truncate" title="${item}">${item}</span>
            </div>
        `;
    },

    _renderEjeFechas(ctx) {
        const { fechas, plotWidth, labelStep, dateStyle } = ctx;
        const plotPad = 10;
        const anchoGrafico = Math.max(1, plotWidth - plotPad * 2);

        return fechas.map((fecha, index) => {
            if (index % labelStep !== 0 && index !== fechas.length - 1) return '';

            const x = plotPad + (fechas.length <= 1 ? anchoGrafico / 2 : index * (anchoGrafico / (fechas.length - 1)));
            const label = dateStyle === 'compact'
                ? this._formatFechaCompacta(fecha)
                : this._formatFechaLarga(fecha);

            return `
                <div class="absolute text-[8.5px] text-slate-600 whitespace-nowrap"
                    style="left:${(x - 5).toFixed(1)}px; top:6px; writing-mode:vertical-rl; transform:rotate(180deg); transform-origin:center; line-height:1;">
                    ${this.escapeHtml(label)}
                </div>
            `;
        }).join('');
    },

    _pasoEtiquetas(plotWidth, cantidad, densidad = 28) {
        const maximo = Math.max(8, Math.floor(plotWidth / Math.max(12, densidad)));
        return Math.max(1, Math.ceil(cantidad / maximo));
    },

    _formatFechaCorta(fecha) {
        return String(fecha || '').replace(/-/g, '/');
    },

    _formatFechaCompacta(fecha) {
        const partes = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!partes) return String(fecha || '');

        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const fechaLocal = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
        const dia = dias[fechaLocal.getDay()] || '';

        return `${dia}, ${partes[1]}/${partes[2]}/${partes[3]}`;
    },

    _formatFechaLarga(fecha) {
        const partes = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!partes) return String(fecha || '');

        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        return `${Number(partes[3])} de ${meses[Number(partes[2]) - 1]} de ${partes[1]}`;
    },

    _colorIndicador(valor) {
        const paradas = [
            [0, [163, 18, 58]],
            [1 / 6, [227, 63, 67]],
            [2 / 6, [248, 129, 107]],
            [0.5, [206, 215, 195]],
            [4 / 6, [115, 186, 103]],
            [5 / 6, [68, 145, 78]],
            [1, [36, 105, 61]]
        ];
        const t = Math.max(0, Math.min(1, (Number(valor) - 0.6) / 0.4));

        let indice = 1;
        while (indice < paradas.length && t > paradas[indice][0]) {
            indice++;
        }

        const [inicioT, inicioRgb] = paradas[Math.max(0, indice - 1)];
        const [finT, finRgb] = paradas[Math.min(paradas.length - 1, indice)];
        const factor = finT === inicioT ? 0 : (t - inicioT) / (finT - inicioT);
        const rgb = inicioRgb.map((canal, posicion) => Math.round(canal + (finRgb[posicion] - canal) * factor));

        return `rgb(${rgb.join(',')})`;
    }
};

window.ChartRegistry['GraficoIndicadores'] = window.ChartGraficoIndicadores;
