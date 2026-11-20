window.ChartRegistry = window.ChartRegistry || {};

window.ChartPareto = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    pareto: [],
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
        this.pareto = Array.isArray(this.datos.pareto) ? this.datos.pareto : [];
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

    pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

        return factor * base;
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
            const objetivo = event.target.closest?.('[data-pareto-tt]');
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
            const objetivo = event.target.closest?.('[data-pareto-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const indice = Number(elemento.dataset.paretoIndex);
        const fila = this.pareto[indice];
        if (!fila) return;

        const campos = [
            ['area', fila.area],
            ['causatipo', fila.causatipo],
            ['cliente', fila.cliente],
            ['codigoconta', fila.codigoconta],
            ['fechaproceso', '*'],
            ['Número de registros', this.formatCantidad(fila.registros)]
        ];

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, valor]) => `
                    <span class="text-slate-500 font-normal whitespace-nowrap">${this.escapeHtml(etiqueta)}:</span>
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

    _calcularRowspans() {
        const spans = {};
        let indice = 0;

        while (indice < this.pareto.length) {
            const cliente = this.pareto[indice].cliente;
            let fin = indice;

            while (fin < this.pareto.length && this.pareto[fin].cliente === cliente) {
                fin++;
            }

            spans[indice] = fin - indice;
            indice = fin;
        }

        return spans;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();

        if (!this.pareto.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-chart-bar text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para Pareto</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        const max = Math.max(1, ...this.pareto.map(fila => Number(fila.registros) || 0));
        const paso = Math.max(1, Math.ceil(this.pasoBonito(max / 18)));
        const maxAxis = Math.max(
            paso,
            Math.ceil((max + paso) / (paso * 2)) * (paso * 2)
        );
        const ticks = [];

        for (let valor = 0; valor <= maxAxis + (paso / 2); valor += paso) {
            ticks.push(Math.round(valor * 100) / 100);
        }

        const rowspans = this._calcularRowspans();
        const totalRegistros = this.pareto.reduce((sum, fila) => sum + Number(fila.registros || 0), 0);

        const filas = this.pareto.map((fila, indice) => {
            const iniciaCliente = rowspans[indice];
            const registros = Number(fila.registros) || 0;
            const porcentaje = Math.max(0.8, (registros / maxAxis) * 100);
            const etiquetaIzquierda = porcentaje > 78;
            const transform = etiquetaIzquierda ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
            const gap = etiquetaIzquierda ? -6 : 6;

            return `
                <tr class="border-b border-slate-100 hover:bg-blue-50/40">
                    ${iniciaCliente
                        ? `<td rowspan="${iniciaCliente}" class="px-2 py-1.5 text-[11px] font-semibold text-slate-700 border-r border-slate-200 align-top">${this.escapeHtml(fila.cliente)}</td>`
                        : ''}
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-200 truncate" title="${this.escapeHtml(fila.causatipo)}">${this.escapeHtml(fila.causatipo)}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200">${this.escapeHtml(fila.codigoconta)}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-200">${this.escapeHtml(fila.area)}</td>
                    <td class="px-2 py-1.5">
                        <div class="relative h-5 cursor-default" style="margin-right:42px;" data-pareto-tt="1" data-pareto-index="${indice}">
                            <div class="absolute left-0 top-1/2 h-2.5 -translate-y-1/2" style="width:${porcentaje}%;background:#4e79a7;"></div>
                            <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-slate-700"
                                style="left:calc(${porcentaje}% ${gap < 0 ? '-' : '+'} ${Math.abs(gap)}px);transform:${transform};text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.formatCantidad(registros)}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">Pareto</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Eventos ordenados por cliente y número de registros</p>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-500">${this.pareto.length.toLocaleString('es-PE')} grupos · ${totalRegistros.toLocaleString('es-PE')} registros</span>
                </div>
                <div class="overflow-auto custom-scrollbar" style="max-height:calc(100vh - 280px);min-height:520px;">
                    <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:1100px;">
                        <colgroup>
                            <col style="width:90px;">
                            <col style="width:260px;">
                            <col style="width:90px;">
                            <col style="width:145px;">
                            <col>
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">cliente</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">causatipo</th>
                                <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">codigoconta</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">area</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold"></th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" class="px-2 pt-1 pb-1 text-[9px] font-semibold text-slate-400 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;"></td>
                                <td class="px-2 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                                    <div class="relative h-4" style="margin-right:42px;">
                                        ${ticks.map(tick => {
                                            const left = maxAxis > 0 ? (tick / maxAxis) * 100 : 0;
                                            const transform = tick === 0 ? 'translate(0, 0)' : (tick === maxAxis ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
                                            return `<span class="absolute top-0 font-mono text-[8px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatCantidad(tick)}</span>`;
                                        }).join('')}
                                    </div>
                                    <div class="mt-0.5 text-center text-[8px] font-semibold text-slate-500">Número de registros</div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        `;
    }
};

window.ChartRegistry['Pareto'] = window.ChartPareto;
