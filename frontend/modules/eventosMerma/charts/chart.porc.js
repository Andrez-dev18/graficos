window.ChartRegistry = window.ChartRegistry || {};

window.ChartPorc = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    filas: [],
    _formatter: null,
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datos = data || {};
        this.filas = Array.isArray(this.datos.filas) ? this.datos.filas : [];
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-graficos-lista');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this.renderView();
    },

    escapeHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatCantidad(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';

        if (!this._formatter) {
            this._formatter = new Intl.NumberFormat('es-PE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        }

        return this._formatter.format(Number(valor));
    },

    formatPorcentaje(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';
        return `${(Number(valor) * 100).toFixed(2).replace('.', ',')}%`;
    },

    _inicializarTooltip() {
        if (!this.tooltipEl) {
            this.tooltipEl = document.getElementById('eventos-merma-tooltip');
            if (!this.tooltipEl) {
                this.tooltipEl = document.createElement('div');
                this.tooltipEl.id = 'eventos-merma-tooltip';
                this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[360px] max-w-[460px] font-sans';
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
            const objetivo = event.target.closest?.('[data-porc-tt]');
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
            const objetivo = event.target.closest?.('[data-porc-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const indice = Number(elemento.dataset.porcIndex);
        const fila = this.filas[indice];
        if (!fila) return;

        const campos = [
            ['area', fila.area],
            ['causatipo', fila.causatipo],
            ['cliente', fila.cliente],
            ['codigoconta', fila.codigoconta],
            ['fechaproceso', '*'],
            ['% de total Número de registros junto con area, causatipo, codigoconta', this.formatPorcentaje(fila.porcentaje)],
            ['Número de registros', this.formatCantidad(fila.registros)]
        ];

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, valor]) => `
                    <span class="text-slate-500 font-normal whitespace-normal break-words">${this.escapeHtml(etiqueta)}:</span>
                    <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        this.tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this.tooltipEl) return;

        const tooltipWidth = this.tooltipEl.offsetWidth || 400;
        const tooltipHeight = this.tooltipEl.offsetHeight || 220;
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

    pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

        return factor * base;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();

        if (!this.filas.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-chart-simple text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para Porc</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        const maxCount = Math.max(1, ...this.filas.map(fila => Number(fila.registros) || 0));
        const paso = this.pasoBonito(maxCount / 5);
        const maxCountAxis = Math.max(paso, Math.ceil(maxCount / paso) * paso);
        const countTicks = [];
        for (let valor = 0; valor <= maxCountAxis + (paso / 2); valor += paso) {
            countTicks.push(Math.round(valor * 100) / 100);
        }
        const percentTicks = [0, 0.2, 0.4, 0.6, 0.8, 1];

        const body = this.filas.map((fila, index) => {
            const esTotal = fila.tipo === 'total';
            const anterior = index > 0 ? this.filas[index - 1] : null;
            const mostrarCliente = !esTotal && (!anterior || anterior.tipo === 'total' || anterior.cliente !== fila.cliente);
            const mostrarArea = !esTotal && (!anterior || anterior.tipo === 'total' || anterior.area !== fila.area);
            const countPct = Math.max(0.8, (Number(fila.registros) / maxCountAxis) * 100);
            const percentPct = Math.max(0.8, Math.max(0, Math.min(1, Number(fila.porcentaje) || 0)) * 100);
            const countLabelLeft = countPct > 78;
            const percentLabelLeft = percentPct > 78;

            return `
                <tr class="border-b border-slate-100 ${esTotal ? 'bg-slate-100 font-bold' : 'hover:bg-blue-50/50'}">
                    ${esTotal
                        ? `<td colspan="4" class="px-2 py-1.5 text-[10px] font-bold text-slate-800 border-r border-slate-100">Total</td>`
                        : `
                            <td class="px-2 py-1.5 text-[11px] font-semibold text-slate-700 border-r border-slate-100">${mostrarCliente ? this.escapeHtml(fila.cliente) : ''}</td>
                            <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100">${mostrarArea ? this.escapeHtml(fila.area) : ''}</td>
                            <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-100">${this.escapeHtml(fila.codigoconta)}</td>
                            <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100 truncate" title="${this.escapeHtml(fila.causatipo)}">${this.escapeHtml(fila.causatipo)}</td>
                        `}
                    <td class="px-2 py-1.5 border-r border-slate-100">
                        <div class="relative h-5" style="margin-right:42px;" data-porc-tt="1" data-porc-index="${index}">
                            <div class="absolute left-0 top-1/2 h-2.5 -translate-y-1/2" style="width:${countPct}%;background:#4e79a7;"></div>
                            <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] ${esTotal ? 'font-bold' : 'font-semibold'} text-slate-700"
                                style="left:calc(${countPct}% ${countLabelLeft ? '-' : '+'} 6px);transform:${countLabelLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)'};text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.formatCantidad(fila.registros)}</span>
                        </div>
                    </td>
                    <td class="px-2 py-1.5">
                        <div class="relative h-5" style="margin-right:48px;" data-porc-tt="1" data-porc-index="${index}">
                            <div class="absolute left-0 top-1/2 h-2.5 -translate-y-1/2" style="width:${percentPct}%;background:#4e79a7;"></div>
                            <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] ${esTotal ? 'font-bold' : 'font-semibold'} text-slate-700"
                                style="left:calc(${percentPct}% ${percentLabelLeft ? '-' : '+'} 6px);transform:${percentLabelLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)'};text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.formatPorcentaje(fila.porcentaje)}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">Porc</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Distribución de eventos por cliente, área y causa</p>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-500">${(this.datos.total_clientes || 0).toLocaleString('es-PE')} clientes · ${(this.datos.total_registros || 0).toLocaleString('es-PE')} registros</span>
                </div>
                <div class="overflow-auto custom-scrollbar" style="max-height:650px;">
                    <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:1300px;">
                        <colgroup>
                            <col style="width:145px;">
                            <col style="width:155px;">
                            <col style="width:100px;">
                            <col style="width:360px;">
                            <col style="width:250px;">
                            <col style="width:250px;">
                        </colgroup>
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                            <tr>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">cliente</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">area</th>
                                <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">codigoconta</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">causatipo</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">Número de registros</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold">% de total Número de registros</th>
                            </tr>
                        </thead>
                        <tbody>${body}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" class="px-2 pt-1 pb-1 text-[9px] font-semibold text-slate-400 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;"></td>
                                <td class="px-2 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                                    <div class="relative h-4" style="margin-right:42px;">
                                        ${countTicks.map(tick => {
                                            const left = maxCountAxis > 0 ? (tick / maxCountAxis) * 100 : 0;
                                            const transform = tick === 0 ? 'translate(0, 0)' : (tick === maxCountAxis ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
                                            return `<span class="absolute top-0 font-mono text-[9px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatCantidad(tick)}</span>`;
                                        }).join('')}
                                    </div>
                                    <div class="mt-0.5 text-center text-[9px] font-semibold text-slate-500">Número de registros</div>
                                </td>
                                <td class="px-2 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                                    <div class="relative h-4" style="margin-right:48px;">
                                        ${percentTicks.map(tick => {
                                            const left = tick * 100;
                                            const transform = tick === 0 ? 'translate(0, 0)' : (tick === 1 ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
                                            return `<span class="absolute top-0 font-mono text-[9px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatPorcentaje(tick)}</span>`;
                                        }).join('')}
                                    </div>
                                    <div class="mt-0.5 text-center text-[9px] font-semibold text-slate-500">% de total Número de registros</div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        `;
    }
};

window.ChartRegistry['Porc'] = window.ChartPorc;
