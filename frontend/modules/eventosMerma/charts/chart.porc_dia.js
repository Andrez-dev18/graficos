window.ChartRegistry = window.ChartRegistry || {};

window.ChartPorcDia = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    filas: [],
    fechas: [],
    _formatter: null,
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,
    _config: {},
    _meses: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ],

    render(controller, data, container) {
        this.renderVariante(controller, data, container, {});
    },

    renderVariante(controller, data, container, config = {}) {
        this._config = {
            conPorcentaje: true,
            fechaLarga: true,
            fechaTooltipDMY: true,
            titulo: 'PorcDia',
            subtitulo: 'Distribución diaria de eventos por cliente, área y causa',
            divisionesEje: 5,
            ...config
        };
        this.controllerRef = controller;
        this.datos = data || {};
        this.filas = Array.isArray(this.datos.filas) ? this.datos.filas : [];
        this.fechas = Array.isArray(this.datos.fechas)
            ? this.datos.fechas.map(fecha => String(fecha || ''))
            : [];
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

    formatPorcentajeEje(valor) {
        return `${Math.round(Number(valor) * 100)}%`;
    },

    formatFechaLarga(valor) {
        const texto = String(valor || '');
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!partes) return texto;

        const anio = Number(partes[1]);
        const mes = Number(partes[2]);
        const dia = Number(partes[3]);
        return `${dia} de ${this._meses[mes - 1] || ''} de ${anio}`;
    },

    formatFechaDMY(valor) {
        const texto = String(valor || '');
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : texto;
    },

    formatFechaSlash(valor) {
        const texto = String(valor || '');
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return partes ? `${partes[1]}/${partes[2]}/${partes[3]}` : texto;
    },

    formatFechaCabecera(valor) {
        return this._config.fechaLarga ? this.formatFechaLarga(valor) : this.formatFechaSlash(valor);
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
            const objetivo = event.target.closest?.('[data-porcdia-tt]');
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
            const objetivo = event.target.closest?.('[data-porcdia-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const indice = Number(elemento.dataset.porcdiaIndex);
        const fecha = elemento.dataset.porcdiaFecha;
        const fila = this.filas[indice];
        const valor = fila?.valores?.[fecha];
        if (!fila || !valor) return;

        const campos = [
            ['area', fila.area],
            ['causatipo', fila.causatipo],
            ['cliente', fila.cliente],
            ['codigoconta', fila.codigoconta],
            ['fechaproceso', this._config.fechaTooltipDMY ? this.formatFechaDMY(fecha) : this.formatFechaSlash(fecha)]
        ];

        if (this._config.conPorcentaje) {
            campos.push(['% de total Número de registros junto con area, causatipo, codigoconta', this.formatPorcentaje(valor.porcentaje)]);
        }

        campos.push(['Número de registros', this.formatCantidad(valor.registros)]);

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, contenido]) => `
                    <span class="text-slate-500 font-normal whitespace-normal break-words">${this.escapeHtml(etiqueta)}:</span>
                    <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(contenido)}</span>
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
        const clientes = {};
        const areas = {};
        let indice = 0;

        while (indice < this.filas.length) {
            const cliente = this.filas[indice].cliente;
            let finCliente = indice;

            while (finCliente < this.filas.length && this.filas[finCliente].cliente === cliente) {
                finCliente++;
            }

            clientes[indice] = finCliente - indice;

            let cursor = indice;
            while (cursor < finCliente) {
                if (this.filas[cursor].tipo === 'total') {
                    cursor++;
                    continue;
                }

                const area = this.filas[cursor].area;
                let finArea = cursor;

                while (
                    finArea < finCliente
                    && this.filas[finArea].tipo !== 'total'
                    && this.filas[finArea].area === area
                ) {
                    finArea++;
                }

                areas[cursor] = finArea - cursor;
                cursor = finArea;
            }

            indice = finCliente;
        }

        return { clientes, areas };
    },

    _celdaMedida(fila, indice, fecha, medida, esTotal, maxCountAxis) {
        const valor = fila?.valores?.[fecha];
        const registros = Number(valor?.registros || 0);
        const porcentaje = Number(valor?.porcentaje || 0);

        if (!valor || registros <= 0) {
            return '<td class="px-1 py-1 border-r border-slate-100"></td>';
        }

        const etiqueta = medida === 'porcentaje'
            ? this.formatPorcentaje(porcentaje)
            : this.formatCantidad(registros);
        const proporcion = medida === 'porcentaje'
            ? Math.max(0, Math.min(1, porcentaje))
            : Math.max(0, Math.min(1, registros / Math.max(1, Number(maxCountAxis) || 1)));
        const posicion = proporcion * 100;
        const etiquetaIzquierda = posicion >= 68;

        return `
            <td class="px-1 py-1 border-r border-slate-100">
                <div class="relative h-5 cursor-default" data-porcdia-tt="1" data-porcdia-index="${indice}" data-porcdia-fecha="${this.escapeHtml(fecha)}">
                    <span class="absolute top-1/2 h-2 w-2 rounded-full" style="left:${posicion}%;transform:translate(-50%,-50%);background:#4e79a7;"></span>
                    <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] ${esTotal ? 'font-bold' : 'font-semibold'} text-slate-700"
                        style="${etiquetaIzquierda ? `right:calc(${100 - posicion}% + 7px);` : `left:calc(${posicion}% + 7px);`}transform:translateY(-50%);text-shadow:0 0 2px #fff,0 0 2px #fff;">${etiqueta}</span>
                </div>
            </td>
        `;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();

        const conPorcentaje = this._config.conPorcentaje !== false;

        if (!this.filas.length || !this.fechas.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-chart-simple text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para ${this.escapeHtml(this._config.titulo)}</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        let maxCount = Math.max(1, Number(this.datos.max_registros) || 0);

        this.filas.forEach(fila => {
            Object.values(fila.valores || {}).forEach(valor => {
                maxCount = Math.max(maxCount, Number(valor.registros) || 0);
            });
        });

        const divisionesEje = Number(this._config.divisionesEje) || (conPorcentaje ? 5 : 6);
        const paso = Math.max(1, Math.ceil(this.pasoBonito(maxCount / divisionesEje)));
        const maxCountAxis = Math.max(paso, Math.ceil(maxCount / paso) * paso);
        const countTicks = [];

        for (let valor = 0; valor <= maxCountAxis + (paso / 2); valor += paso) {
            countTicks.push(Math.round(valor * 100) / 100);
        }

        const percentTicks = [0, 0.5, 1];
        const rowspans = this._calcularRowspans();
        const anchoMinimo = 570 + (this.fechas.length * 158);
        const columnasPorFecha = conPorcentaje ? 2 : 1;

        const body = this.filas.map((fila, indice) => {
            const esTotal = fila.tipo === 'total';
            const iniciaCliente = rowspans.clientes[indice];
            const iniciaArea = rowspans.areas[indice];
            const celdas = this.fechas.map(fecha => conPorcentaje
                ? `
                    ${this._celdaMedida(fila, indice, fecha, 'registros', esTotal, maxCountAxis)}
                    ${this._celdaMedida(fila, indice, fecha, 'porcentaje', esTotal, maxCountAxis)}
                `
                : this._celdaMedida(fila, indice, fecha, 'registros', esTotal, maxCountAxis)
            ).join('');

            if (esTotal) {
                return `
                    <tr class="border-b border-slate-200 bg-slate-100 font-bold">
                        ${iniciaCliente
                            ? `<td rowspan="${iniciaCliente}" class="px-2 py-1.5 text-[11px] font-bold text-slate-800 border-r border-slate-200" style="position:sticky;left:0;z-index:10;background:#fff;">${this.escapeHtml(fila.cliente)}</td>`
                            : ''}
                        <td colspan="3" class="px-2 py-1.5 text-[10px] font-bold text-slate-800 border-r border-slate-200" style="position:sticky;left:90px;z-index:10;background:#f1f5f9;">Total</td>
                        ${celdas}
                        <td></td>
                    </tr>
                `;
            }

            return `
                <tr class="border-b border-slate-100">
                    ${iniciaCliente
                        ? `<td rowspan="${iniciaCliente}" class="px-2 py-1.5 text-[11px] font-semibold text-slate-700 border-r border-slate-200" style="position:sticky;left:0;z-index:10;background:#fff;">${this.escapeHtml(fila.cliente)}</td>`
                        : ''}
                    ${iniciaArea
                        ? `<td rowspan="${iniciaArea}" class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-200" style="position:sticky;left:90px;z-index:10;background:#fff;">${this.escapeHtml(fila.area)}</td>`
                        : ''}
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200" style="position:sticky;left:200px;z-index:10;background:#fff;">${this.escapeHtml(fila.codigoconta)}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-200 truncate" title="${this.escapeHtml(fila.causatipo)}" style="position:sticky;left:290px;z-index:10;background:#fff;">${this.escapeHtml(fila.causatipo)}</td>
                    ${celdas}
                    <td></td>
                </tr>
            `;
        }).join('');

        const cabeceraFechas = this.fechas.map(fecha => `
            <th colspan="${columnasPorFecha}" class="px-1 py-1.5 text-center font-bold text-[9.5px] text-white bg-blue-600 border-r border-blue-500 whitespace-nowrap">${this.escapeHtml(this.formatFechaCabecera(fecha))}</th>
        `).join('');
        const claseGrupoFechas = this.fechas.length <= 4 ? 'text-center' : 'text-left pl-3';
        const countAxisHtml = countTicks.map(tick => {
            const left = maxCountAxis > 0 ? (tick / maxCountAxis) * 100 : 0;
            const transform = tick === 0 ? 'translate(0, 0)' : (tick === maxCountAxis ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
            return `<span class="absolute top-0 font-mono text-[8px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatCantidad(tick)}</span>`;
        }).join('');
        const percentAxisHtml = percentTicks.map(tick => {
            const left = tick * 100;
            const transform = tick === 0 ? 'translate(0, 0)' : (tick === 1 ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
            return `<span class="absolute top-0 font-mono text-[8px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatPorcentajeEje(tick)}</span>`;
        }).join('');

        const footerFechas = this.fechas.map(() => `
            <td class="px-1 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                <div class="relative h-4" style="margin-right:2px;">${countAxisHtml}</div>
                <div class="mt-0.5 text-center text-[8px] font-semibold text-slate-500">Número de registros</div>
            </td>
            ${conPorcentaje
                ? `<td class="px-1 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                    <div class="relative h-4" style="margin-right:2px;">${percentAxisHtml}</div>
                    <div class="mt-0.5 text-center text-[8px] font-semibold text-slate-500">% de total Número de registros</div>
                </td>`
                : ''}
        `).join('') + '<td style="position:sticky;bottom:0;z-index:30;background:#fff;border-top:1px solid #e2e8f0;"></td>';

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">${this.escapeHtml(this._config.titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(this._config.subtitulo)}</p>
                    </div>
                    <span class="text-[10px] font-semibold text-slate-500">${(this.datos.total_clientes || 0).toLocaleString('es-PE')} clientes · ${(this.datos.total_registros || 0).toLocaleString('es-PE')} registros · ${this.fechas.length.toLocaleString('es-PE')} días</span>
                </div>
                <div class="overflow-auto custom-scrollbar" style="max-height:650px;">
                    <table class="text-left border-collapse" style="table-layout:fixed;width:100%;min-width:${anchoMinimo}px;">
                        <colgroup>
                            <col style="width:90px;">
                            <col style="width:110px;">
                            <col style="width:90px;">
                            <col style="width:280px;">
                            ${this.fechas.map(() => conPorcentaje
                                ? '<col style="width:76px;"><col style="width:82px;">'
                                : '<col style="width:158px;">'
                            ).join('')}
                            <col>
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr>
                                <th rowspan="2" class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:0;z-index:40;background:#2563eb;">cliente</th>
                                <th rowspan="2" class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:90px;z-index:40;background:#2563eb;">area</th>
                                <th rowspan="2" class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:200px;z-index:40;background:#2563eb;">codigoconta</th>
                                <th rowspan="2" class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:290px;z-index:40;background:#2563eb;">causatipo</th>
                                <th colspan="${this.fechas.length * columnasPorFecha}" class="px-1 py-1 ${claseGrupoFechas} text-[10px] font-bold border-r border-blue-500">Día de fechaproceso</th>
                                <th rowspan="2" class="bg-blue-600"></th>
                            </tr>
                            <tr>
                                ${cabeceraFechas}
                            </tr>
                        </thead>
                        <tbody>${body}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" class="px-2 pt-1 pb-1 text-[8px] font-semibold text-slate-400 border-t border-slate-200" style="position:sticky;bottom:0;left:0;z-index:31;background:#fff;"></td>
                                ${footerFechas}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>
        `;
    }
};

window.ChartRegistry['PorcDia'] = window.ChartPorcDia;
