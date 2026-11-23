window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisMermas = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    seleccionesMesGlo: [],
    seleccionesMesLote: [],
    _paginationBound: false,
    _selectionBound: false,
    _tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,
    _meses: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ],

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datos = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-dash-analisis');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._bindSelectionEvents();
        this.renderView();
    },

    limpiarSelecciones(recargar = false) {
        this.seleccionesMesGlo = [];
        this.seleccionesMesLote = [];
        if (recargar) {
            this.controllerRef?.cargarAnalisisMermasSeleccion?.([], []);
        } else {
            this.renderView();
        }
    },

    _claveSeleccion(tipo, fila, periodo) {
        return [
            tipo,
            fila.codigo || '',
            fila.descripcion || '',
            fila.lote || '',
            fila.tipo === 'total' ? '' : (fila.transaccion || ''),
            periodo || ''
        ].join('|');
    },

    _seleccionActiva(tipo, fila, periodo) {
        const clave = this._claveSeleccion(tipo, fila, periodo);
        const lista = tipo === 'mes_glo' ? this.seleccionesMesGlo : this.seleccionesMesLote;
        return lista.some(seleccion => this._claveSeleccion(
            tipo,
            {
                codigo: seleccion.codigo,
                descripcion: seleccion.descripcion,
                lote: seleccion.lote,
                transaccion: seleccion.transaccion,
                tipo: seleccion.transaccion ? 'detalle' : 'total'
            },
            seleccion.mes
        ) === clave);
    },

    _seleccionar(tipo, fila, periodo, conCtrl) {
        if (tipo === 'dia_lote') return;

        const seleccion = {
            codigo: fila.codigo || '',
            descripcion: fila.descripcion || '',
            lote: tipo === 'mes_lote' ? (fila.lote || '') : '',
            transaccion: fila.tipo === 'total' ? '' : (fila.transaccion || ''),
            mes: periodo || ''
        };

        const listaActual = tipo === 'mes_glo' ? this.seleccionesMesGlo : this.seleccionesMesLote;
        const clave = this._claveSeleccion(tipo, fila, periodo);
        const existe = listaActual.some(item => this._claveSeleccion(
            tipo,
            {
                codigo: item.codigo,
                descripcion: item.descripcion,
                lote: item.lote,
                transaccion: item.transaccion,
                tipo: item.transaccion ? 'detalle' : 'total'
            },
            item.mes
        ) === clave);

        let nuevaLista;
        if (conCtrl) {
            nuevaLista = existe
                ? listaActual.filter(item => this._claveSeleccion(
                    tipo,
                    {
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        lote: item.lote,
                        transaccion: item.transaccion,
                        tipo: item.transaccion ? 'detalle' : 'total'
                    },
                    item.mes
                ) !== clave)
                : listaActual.concat([seleccion]);
        } else {
            nuevaLista = existe && listaActual.length === 1 ? [] : [seleccion];
        }

        if (tipo === 'mes_glo') {
            this.seleccionesMesGlo = nuevaLista;
            this.seleccionesMesLote = [];
        } else {
            this.seleccionesMesLote = nuevaLista;
        }

        this.controllerRef?.cargarAnalisisMermasSeleccion?.(
            this.seleccionesMesGlo,
            this.seleccionesMesLote
        );
    },

    _bindSelectionEvents() {
        if (this._selectionBound || !this.containerRef) return;
        this._selectionBound = true;

        this.containerRef.addEventListener('click', event => {
            const limpiar = event.target.closest?.('[data-mermas-clear]');
            if (limpiar) {
                this.limpiarSelecciones(true);
                return;
            }

            const celda = event.target.closest?.('[data-mermas-cell]');
            if (!celda) return;

            const tipo = celda.dataset.mermasTipo;
            const indice = Number(celda.dataset.mermasIndex);
            const periodo = celda.dataset.mermasPeriodo;
            const fila = this.datos?.[tipo]?.filas?.[indice];
            if (!fila) return;

            this._seleccionar(tipo, fila, periodo, event.ctrlKey || event.metaKey);
        });
    },

    _inicializarTooltip() {
        if (!this._tooltipEl) {
            this._tooltipEl = document.getElementById('consumo-lima-mermas-tooltip');
            if (!this._tooltipEl) {
                this._tooltipEl = document.createElement('div');
                this._tooltipEl.id = 'consumo-lima-mermas-tooltip';
                this._tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[340px] max-w-[480px] font-sans';
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
            const objetivo = event.target.closest?.('[data-mermas-tip]');
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
            const objetivo = event.target.closest?.('[data-mermas-tip]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this._tooltipEl) return;

        const tipo = elemento.dataset.mermasTipo;
        const indice = Number(elemento.dataset.mermasIndex);
        const periodo = elemento.dataset.mermasPeriodo;
        const medida = elemento.dataset.mermasMedida || 'pct';
        const fila = this.datos?.[tipo]?.filas?.[indice];
        const valor = fila?.valores?.[periodo];
        if (!fila || !valor) return;

        const campos = [
            ['CodArticulo', fila.codigo],
            ['NomArticulo', fila.descripcion],
            ['Transaccion', fila.tipo === 'total' ? 'Todo' : fila.transaccion]
        ];

        if (tipo === 'mes_lote' || tipo === 'dia_lote') {
            campos.push(['LoteArticulo', fila.lote]);
        }

        campos.push([
            tipo === 'dia_lote' ? 'Día de Fecha' : 'Mes de Fecha',
            tipo === 'dia_lote' ? this.formatDia(periodo) : this.formatMes(periodo)
        ]);
        campos.push([
            medida === 'peso' ? 'Peso' : '% de total',
            medida === 'peso' ? this.formatPeso(valor.peso) : this.formatPct(valor.pct)
        ]);

        this._tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, contenido]) => `
                    <span class="text-slate-500 font-normal whitespace-nowrap">${this.escapeHtml(etiqueta)}:</span>
                    <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(contenido)}</span>
                `).join('')}
            </div>
        `;

        this._tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this._tooltipEl) return;

        const tooltipWidth = this._tooltipEl.offsetWidth || 360;
        const tooltipHeight = this._tooltipEl.offsetHeight || 180;
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

    escapeHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatPeso(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numero);
    },

    formatPct(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';
        return `${(numero * 100).toFixed(2).replace('.', ',')}%`;
    },

    formatMes(valor) {
        const partes = String(valor || '').split('-');
        if (partes.length !== 2) return valor;
        const mes = Number(partes[1]);
        return `${this._meses[mes - 1] || ''} ${partes[0]}`;
    },

    formatDia(valor) {
        return String(valor || '').replace(/-/g, '/');
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

    _valorCelda(fila, periodo, tipo = null, indice = null) {
        const valor = fila?.valores?.[periodo];
        const seleccionable = tipo && tipo !== 'dia_lote' && indice !== null;
        const activo = seleccionable && this._seleccionActiva(tipo, fila, periodo);
        const dataAttrs = tipo && indice !== null
            ? `data-mermas-tipo="${tipo}" data-mermas-index="${indice}" data-mermas-periodo="${this.escapeHtml(periodo)}"`
            : '';
        const tipAttrs = tipo && indice !== null ? 'data-mermas-tip="1"' : '';
        const clickAttrs = seleccionable ? 'data-mermas-cell="1"' : '';
        const clase = activo ? ' bg-blue-100' : '';
        const estilo = activo ? ' background-color:#dbeafe;' : '';
        const cursor = seleccionable ? 'cursor-pointer' : 'cursor-default';

        if (!valor) {
            return '<td class="px-2 py-1 border-r border-slate-100 cursor-default"></td><td class="px-2 py-1 border-r border-slate-100 cursor-default"></td>';
        }

        return `
            <td ${dataAttrs} ${tipAttrs} ${clickAttrs} data-mermas-medida="peso" class="px-2 py-1 border-r border-slate-100 text-right font-mono text-[10px] whitespace-nowrap ${cursor}${clase}" style="${estilo}">${this.formatPeso(valor.peso)}</td>
            <td ${dataAttrs} ${tipAttrs} ${clickAttrs} data-mermas-medida="pct" class="px-2 py-1 border-r border-slate-100 text-right font-mono text-[10px] text-slate-500 whitespace-nowrap ${cursor}${clase}" style="${estilo}">${this.formatPct(valor.pct)}</td>
        `;
    },

    _cabecera(periodos, etiquetaFn, dimensiones) {
        return `
            <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                <tr>
                    ${dimensiones.map(campo => `<th rowspan="2" class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">${campo}</th>`).join('')}
                    ${periodos.map(periodo => `<th colspan="2" class="px-2 py-1.5 text-center text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">${etiquetaFn(periodo)}</th>`).join('')}
                </tr>
                <tr>
                    ${periodos.map(() => `
                        <th class="px-2 py-1.5 text-right text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">Peso</th>
                        <th class="px-2 py-1.5 text-right text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">% de total</th>
                    `).join('')}
                </tr>
            </thead>
        `;
    },

    _totalGeneral(periodos, valores, colspan) {
        return `
            <tr class="bg-slate-50 font-bold">
                <td colspan="${colspan}" class="px-2 py-1.5 text-[10px] font-bold text-slate-800 border-r border-slate-200">Total general</td>
                ${periodos.map(periodo => {
                    const valor = valores?.[periodo];
                    return this._valorCelda({ valores: { [periodo]: valor } }, periodo);
                }).join('')}
            </tr>
        `;
    },

    _titulo(tipo) {
        const colores = {
            mes_glo: '#4e79a7',
            mes_lote: '#4e79a7',
            dia_lote: '#4e79a7'
        };
        return colores[tipo] || '#4e79a7';
    },

    _chipSeleccion() {
        const total = this.seleccionesMesGlo.length + this.seleccionesMesLote.length;
        if (!total) return '';

        const partes = [];
        if (this.seleccionesMesGlo.length) partes.push(`${this.seleccionesMesGlo.length} en Mermas Por Mes`);
        if (this.seleccionesMesLote.length) partes.push(`${this.seleccionesMesLote.length} en Mes y Lote`);

        return `
            <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-[10px]">
                <span class="font-semibold"><i class="fa-solid fa-filter mr-1.5"></i>Filtro cruzado: ${partes.join(' · ')}</span>
                <button type="button" data-mermas-clear="1"
                    class="px-2 py-1 rounded border border-blue-200 bg-white/70 hover:bg-white font-bold text-blue-700 cursor-pointer">
                    Quitar filtro
                </button>
            </div>
        `;
    },

    _tablaTop() {
        const payload = this.datos?.mes_glo || { filas: [], total_general: {} };
        const meses = Array.isArray(this.datos?.meses) ? this.datos.meses : [];
        const filas = Array.isArray(payload.filas) ? payload.filas : [];
        const spans = this._spans(filas, fila => `${fila.codigo}|${fila.descripcion}`);
        const colspanDims = 3;
        const columnas = colspanDims + meses.length * 2;

        const body = filas.length
            ? filas.map((fila, indice) => {
                const inicia = spans[indice];
                const celdas = meses.map(mes => this._valorCelda(fila, mes, 'mes_glo', indice)).join('');
                return `
                    <tr class="${fila.tipo === 'total' ? 'bg-slate-100 font-bold' : 'hover:bg-blue-50/40'}">
                        ${inicia
                            ? `<td rowspan="${inicia}" class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono align-top">${this.escapeHtml(fila.codigo)}</td>
                               <td rowspan="${inicia}" class="px-2 py-1 border-r border-slate-100 text-[10px] align-top">${this.escapeHtml(fila.descripcion)}</td>`
                            : ''}
                        <td class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono">${this.escapeHtml(fila.transaccion)}</td>
                        ${celdas}
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="${columnas}" class="px-3 py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</td></tr>`;

        const totalGeneral = this._totalGeneral(meses, payload.total_general, colspanDims);

        return `
            <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col min-h-0 overflow-hidden">
                <div class="shrink-0 px-4 py-2 border-b border-slate-200">
                    <h2 class="text-[13px] font-bold tracking-tight" style="color:${this._titulo('mes_glo')};">Mermas Por Mes</h2>
                </div>
                <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table class="text-left border-collapse" style="table-layout:fixed;width:${267 + meses.length * 160}px;">
                        <colgroup>
                            <col style="width:82px;">
                            <col style="width:125px;">
                            <col style="width:60px;">
                            ${meses.map(() => '<col style="width:95px;"><col style="width:65px;">').join('')}
                        </colgroup>
                        ${this._cabecera(meses, valor => this.formatMes(valor), ['CodArticulo', 'NomArticulo', 'Transaccion'])}
                        <tbody>${body}${filas.length ? totalGeneral : ''}</tbody>
                    </table>
                </div>
            </section>
        `;
    },

    _tablaLote(tipo, titulo, periodos, formatearPeriodo) {
        const payload = this.datos?.[tipo] || { filas: [], total_general: {} };
        const filas = Array.isArray(payload.filas) ? payload.filas : [];
        const spansLote = this._spans(filas, fila => `${fila.codigo}|${fila.descripcion}|${fila.lote}`);
        const spansArticulo = this._spans(filas, fila => `${fila.codigo}|${fila.descripcion}`);
        const colspanDims = 4;
        const columnas = colspanDims + periodos.length * 2;

        const body = filas.length
            ? filas.map((fila, indice) => {
                const iniciaArticulo = spansArticulo[indice];
                const iniciaLote = spansLote[indice];
                const celdas = periodos.map(periodo => this._valorCelda(
                    fila,
                    periodo,
                    tipo,
                    indice
                )).join('');
                return `
                    <tr class="${fila.tipo === 'total' ? 'bg-slate-100 font-bold' : 'hover:bg-blue-50/40'}">
                        ${iniciaArticulo
                            ? `<td rowspan="${iniciaArticulo}" class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono align-top">${this.escapeHtml(fila.codigo)}</td>
                               <td rowspan="${iniciaArticulo}" class="px-2 py-1 border-r border-slate-100 text-[10px] align-top">${this.escapeHtml(fila.descripcion)}</td>`
                            : ''}
                        ${iniciaLote
                            ? `<td rowspan="${iniciaLote}" class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono align-top">${this.escapeHtml(fila.lote)}</td>`
                            : ''}
                        <td class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono">${this.escapeHtml(fila.transaccion)}</td>
                        ${celdas}
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="${columnas}" class="px-3 py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</td></tr>`;

        const totalGeneral = this._totalGeneral(periodos, payload.total_general, colspanDims);

        return `
            <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col min-h-0 overflow-hidden">
                <div class="shrink-0 px-4 py-2 border-b border-slate-200">
                    <h2 class="text-[13px] font-bold tracking-tight" style="color:${this._titulo(tipo)};">${this.escapeHtml(titulo)}</h2>
                </div>
                <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:${620 + periodos.length * 130}px;">
                        <colgroup>
                            <col style="width:76px;">
                            <col style="width:110px;">
                            <col style="width:82px;">
                            <col style="width:46px;">
                            ${periodos.map(() => '<col style="width:88px;"><col style="width:60px;">').join('')}
                        </colgroup>
                        ${this._cabecera(periodos, formatearPeriodo, ['CodArticulo', 'NomArticulo', 'LoteArticulo', 'Transaccion'])}
                        <tbody>${body}${filas.length ? totalGeneral : ''}</tbody>
                    </table>
                </div>
            </section>
        `;
    },

    _paginacion() {
        const paginacion = this.datos?.paginacion || {};
        const page = Number(paginacion.page || 1);
        const totalPaginas = Number(paginacion.total_paginas || 0);
        const totalGrupos = Number(paginacion.total_grupos || 0);
        const anterior = Math.max(1, page - 1);
        const siguiente = Math.min(totalPaginas || 1, page + 1);

        return `
            <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] text-slate-500">
                <span>${totalGrupos.toLocaleString('es-PE')} grupos de lote</span>
                <div class="flex items-center gap-1.5">
                    <button type="button" data-mermas-page="${anterior}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page <= 1 || totalPaginas === 0 ? 'disabled' : ''}>‹</button>
                    <span class="px-1 font-semibold text-slate-600">Página ${totalPaginas ? page : 0} de ${totalPaginas}</span>
                    <button type="button" data-mermas-page="${siguiente}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page >= totalPaginas || totalPaginas === 0 ? 'disabled' : ''}>›</button>
                </div>
            </div>
        `;
    },

    _bindPagination() {
        if (this._paginationBound || !this.containerRef) return;
        this._paginationBound = true;

        this.containerRef.addEventListener('click', event => {
            const boton = event.target.closest?.('[data-mermas-page]');
            if (!boton || boton.disabled) return;
            this.controllerRef?.cambiarPaginaMermas?.(Number(boton.dataset.mermasPage));
        });
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        const meses = Array.isArray(this.datos?.meses) ? this.datos.meses : [];
        const dias = Array.isArray(this.datos?.dias) ? this.datos.dias : [];

        contenedor.innerHTML = `
            <div class="flex h-full min-h-0 flex-col gap-1">
                ${this._chipSeleccion()}
                <div class="shrink-0">${this._tablaTop()}</div>
                <div class="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-1">
                    ${this._tablaLote('mes_lote', 'Mermas por Mes y Lote', meses, valor => this.formatMes(valor))}
                    ${this._tablaLote('dia_lote', 'Mermas por Día y Lote', dias, valor => this.formatDia(valor))}
                </div>
                ${this._paginacion()}
            </div>
        `;

        this._bindPagination();
    }
};

window.ChartRegistry['AnalisisMermas'] = window.ChartAnalisisMermas;
