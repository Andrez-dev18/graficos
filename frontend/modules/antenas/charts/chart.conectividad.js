window.ChartRegistry = window.ChartRegistry || {};

window.ChartConectividadAntenas = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    _meses: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ],
    _tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,
    _paginationBound: false,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datos = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-antenas');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._bindPaginationEvents();
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

    formatFechaLarga(valor) {
        const partes = String(valor || '').split('-');
        if (partes.length !== 3) return valor;
        return `${Number(partes[2])} de ${this._meses[Number(partes[1]) - 1] || ''} de ${partes[0]}`;
    },

    formatHora(valor) {
        return String(Number(valor));
    },

    _spans(filas, claveFn) {
        const spans = {};
        let indice = 0;

        while (indice < filas.length) {
            const clave = claveFn(filas[indice]);
            let fin = indice + 1;

            while (fin < filas.length && claveFn(filas[fin]) === clave) {
                fin++;
            }

            spans[indice] = fin - indice;
            indice = fin;
        }

        return spans;
    },

    _inicializarTooltip() {
        if (!this._tooltipEl) {
            this._tooltipEl = document.getElementById('antenas-tooltip');
            if (!this._tooltipEl) {
                this._tooltipEl = document.createElement('div');
                this._tooltipEl.id = 'antenas-tooltip';
                this._tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[300px] max-w-[420px] font-sans';
                document.body.appendChild(this._tooltipEl);
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
            const objetivo = event.target.closest?.('[data-antenas-tt]');
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

            if (this._tooltipEl && !this._tooltipEl.classList.contains('hidden')) {
                this._posicionarTooltip();
            }
        }, { signal });

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.('[data-antenas-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this._tooltipEl) return;

        const indice = Number(elemento.dataset.antenasIndex);
        const fecha = elemento.dataset.antenasFecha;
        const hora = Number(elemento.dataset.antenasHora);
        const fila = this.datos?.filas?.[indice];
        const total = fila?.valores?.[`${fecha}|${hora}`];
        if (!fila || total === undefined) return;

        const campos = [
            ['Granja', fila.granja],
            ['Antena', fila.antena],
            ['Conexión', fila.conexion],
            ['Fecha', this.formatFechaLarga(fecha)],
            ['Hora', String(hora)],
            ['Número de registros', String(total)]
        ];

        this._tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, valor]) => `
                    <span class="text-slate-500 font-normal whitespace-nowrap">${this.escapeHtml(etiqueta)}:</span>
                    <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        this._tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this._tooltipEl) return;

        const tooltipWidth = this._tooltipEl.offsetWidth || 320;
        const tooltipHeight = this._tooltipEl.offsetHeight || 160;
        let x = this._mouseX + 14;
        let y = this._mouseY + 14;

        if (x + tooltipWidth > window.innerWidth - 12) {
            x = this._mouseX - tooltipWidth - 14;
        }
        if (y + tooltipHeight > window.innerHeight - 12) {
            y = this._mouseY - tooltipHeight - 14;
        }

        this._tooltipEl.style.left = `${Math.max(10, x)}px`;
        this._tooltipEl.style.top = `${Math.max(10, y)}px`;
    },

    _ocultarTooltip() {
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
        this._tooltipTarget = null;

        if (this._tooltipEl) {
            this._tooltipEl.classList.add('hidden');
        }
    },

    _bindPaginationEvents() {
        if (this._paginationBound || !this.containerRef) return;
        this._paginationBound = true;

        this.containerRef.addEventListener('click', event => {
            const boton = event.target.closest?.('[data-antenas-page]');
            if (!boton || boton.disabled) return;
            this.controllerRef?.cambiarPagina?.(Number(boton.dataset.antenasPage));
        });
    },

    _paginacion() {
        const page = Number(this.datos?.page || 1);
        const pageSize = Number(this.datos?.page_size_dias || 7);
        const totalDias = Number(this.datos?.total_dias || 0);
        const totalPaginas = Number(this.datos?.total_paginas || 0);
        const desde = totalDias > 0 ? ((page - 1) * pageSize) + 1 : 0;
        const hasta = totalDias > 0 ? Math.min((page - 1) * pageSize + (this.datos?.fechas?.length || 0), totalDias) : 0;
        const anterior = Math.max(1, page - 1);
        const siguiente = Math.min(totalPaginas || 1, page + 1);

        return `
            <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                <span>Mostrando días ${desde}–${hasta} de ${totalDias}</span>
                <div class="flex items-center gap-1.5">
                    <button type="button" data-antenas-page="${anterior}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page <= 1 || totalPaginas === 0 ? 'disabled' : ''}>‹</button>
                    <span class="px-1 font-semibold text-slate-600">Página ${totalPaginas ? page : 0} de ${totalPaginas}</span>
                    <button type="button" data-antenas-page="${siguiente}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page >= totalPaginas || totalPaginas === 0 ? 'disabled' : ''}>›</button>
                </div>
            </div>
        `;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();

        const fechas = Array.isArray(this.datos?.fechas) ? this.datos.fechas : [];
        const horas = Array.isArray(this.datos?.horas) ? this.datos.horas : Array.from({ length: 24 }, (_, i) => i);
        const filas = Array.isArray(this.datos?.filas) ? this.datos.filas : [];
        const spansGranja = this._spans(filas, fila => fila.granja);
        const spansAntena = this._spans(filas, fila => `${fila.granja}|${fila.antena}`);
        const totalHoras = fechas.length * horas.length;
        const anchoTabla = 345 + (totalHoras * 30);

        const fechaHeaders = fechas.map(fecha => `
            <th colspan="${horas.length}" class="px-2 py-1.5 text-center font-bold text-[10px] text-white bg-blue-600 border-r border-blue-500 whitespace-nowrap">
                ${this.escapeHtml(this.formatFechaLarga(fecha))}
            </th>
        `).join('');

        const horaHeaders = fechas.map(() => horas.map(hora => `
            <th class="px-0 py-1 text-center font-mono text-[9px] font-semibold text-blue-100 border-r border-blue-500">${this.formatHora(hora)}</th>
        `).join('')).join('');

        const body = filas.map((fila, indice) => {
            const iniciaGranja = spansGranja[indice];
            const iniciaAntena = spansAntena[indice];

            const celdas = fechas.map(fecha => horas.map(hora => {
                const total = fila.valores?.[`${fecha}|${hora}`];
                if (total === undefined) {
                    return '<td class="h-[22px] border-r border-b border-slate-100 p-0"></td>';
                }

                const color = fila.conexion === 'SI' ? '#59a14f' : '#e15759';
                return `
                    <td class="h-[22px] border-r border-b border-slate-100 p-0 text-center">
                        <div class="mx-auto h-[11px] w-[18px] rounded-[1px]"
                            style="background:${color};"
                            data-antenas-tt="1" data-antenas-index="${indice}"
                            data-antenas-fecha="${this.escapeHtml(fecha)}" data-antenas-hora="${hora}"></div>
                    </td>
                `;
            }).join('')).join('');

            return `
                <tr class="hover:bg-blue-50/30">
                    ${iniciaGranja
                        ? `<td rowspan="${iniciaGranja}" class="px-2 py-1 border-r border-b border-slate-200 text-[10px] font-semibold text-slate-700 align-middle" style="position:sticky;left:0;z-index:10;background:#fff;">${this.escapeHtml(fila.granja)}</td>`
                        : ''}
                    ${iniciaAntena
                        ? `<td rowspan="${iniciaAntena}" class="px-2 py-1 border-r border-b border-slate-200 text-[10px] text-slate-600 align-middle" style="position:sticky;left:120px;z-index:10;background:#fff;">${this.escapeHtml(fila.antena)}</td>`
                        : ''}
                    <td class="px-2 py-1 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-600" style="position:sticky;left:290px;z-index:10;background:#fff;">${this.escapeHtml(fila.conexion)}</td>
                    ${celdas}
                </tr>
            `;
        }).join('');

        contenedor.innerHTML = `
            <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col h-full min-h-0 overflow-hidden">
                <div class="shrink-0 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <h2 class="text-[15px] font-bold text-slate-800">ConectividadAntenas</h2>
                    <div class="flex items-center gap-4 text-[10px] font-semibold text-slate-600">
                        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-4 rounded-sm" style="background:#e15759;"></span>NO</span>
                        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-4 rounded-sm" style="background:#59a14f;"></span>SI</span>
                    </div>
                </div>
                <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table class="text-left border-collapse" style="table-layout:fixed;width:${anchoTabla}px;">
                        <colgroup>
                            <col style="width:120px;">
                            <col style="width:170px;">
                            <col style="width:55px;">
                            ${fechas.map(() => horas.map(() => '<col style="width:30px;">').join('')).join('')}
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr>
                                <th rowspan="2" class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500" style="position:sticky;left:0;z-index:40;background:#2563eb;">Granja</th>
                                <th rowspan="2" class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500" style="position:sticky;left:120px;z-index:40;background:#2563eb;">Antena</th>
                                <th rowspan="2" class="px-2 py-1.5 text-center text-[9px] font-bold border-r border-blue-500" style="position:sticky;left:290px;z-index:40;background:#2563eb;">Conexión</th>
                                ${fechaHeaders}
                            </tr>
                            <tr>${horaHeaders}</tr>
                        </thead>
                        <tbody>${body || `<tr><td colspan="${3 + totalHoras}" class="p-8 text-center text-xs text-slate-400">Sin datos para el período seleccionado.</td></tr>`}</tbody>
                    </table>
                </div>
                ${this._paginacion()}
            </section>
        `;
    }
};

window.ChartRegistry['ConectividadAntenas'] = window.ChartConectividadAntenas;
