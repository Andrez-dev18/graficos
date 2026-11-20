window.ChartRegistry = window.ChartRegistry || {};

window.ChartDashAnalisis = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    pareto: [],
    listado: null,
    seleccionesPareto: [],
    modoListado: false,
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
        this.listado = this.datos.listado || {};
        this.seleccionesPareto = [];
        this.modoListado = controller?.chartTipoActual === 'Listado' || this.datos.modo_listado === true;
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

    formatFecha(valor) {
        const texto = String(valor || '');
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return partes ? `${partes[1]}/${partes[2]}/${partes[3]}` : texto;
    },

    formatFechaDMY(valor) {
        const texto = String(valor || '');
        const partes = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : texto;
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
            const objetivo = event.target.closest?.('[data-eventos-tt]');
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
            const objetivo = event.target.closest?.('[data-eventos-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const tipo = elemento.dataset.eventosTt;
        const indice = Number(elemento.dataset.eventosIndex);
        const fila = tipo === 'pareto' ? this.pareto[indice] : (this.listado?.filas || [])[indice];
        if (!fila) return;

        const campos = tipo === 'pareto'
            ? [
                ['area', fila.area],
                ['causatipo', fila.causatipo],
                ['cliente', fila.cliente],
                ['codigoconta', fila.codigoconta],
                ['fechaproceso', '*'],
                ['Número de registros', this.formatCantidad(fila.registros)]
            ]
            : [
                ['area', fila.area],
                ['causatipo', fila.causatipo],
                ['cliente', fila.cliente],
                ['codigoconta', fila.codigoconta],
                ['descripcion', fila.descripcion],
                ['horaregistro', fila.horaregistro],
                ['placa', fila.placa],
                ['usuario', fila.usuario],
                ['Día de fecharegistro', this.formatFecha(fila.fecharegistro)],
                ['fechaproceso', this.formatFechaDMY(fila.fechaproceso)],
                ['Número de registros', '1']
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

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">${this.modoListado ? 'Listado' : 'DashAnalisis'}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.modoListado ? 'Detalle de eventos por agente causal' : 'Pareto y listado de eventos por agente causal'}</p>
                    </div>
                    <span id="eventos-total-pareto" class="text-[10px] font-semibold text-slate-500"></span>
                </div>
                ${this.modoListado ? '' : '<div id="eventos-pareto"></div><div class="border-t border-slate-200"></div>'}
                <div id="eventos-listado"></div>
            </section>
        `;

        if (!this.modoListado) {
            this.renderPareto();
        }
        this.renderListado();
    },

    renderPareto() {
        const contenedor = document.getElementById('eventos-pareto');
        if (!contenedor) return;

        const total = this.pareto.length;
        const badge = document.getElementById('eventos-total-pareto');
        if (badge) {
            badge.textContent = `${total} grupos · ${this.pareto.reduce((sum, fila) => sum + Number(fila.registros || 0), 0).toLocaleString('es-PE')} registros`;
        }

        if (!total) {
            contenedor.innerHTML = `
                <div class="px-5 py-4 border-b border-slate-200">
                    <h3 class="text-sm font-bold text-slate-800">Pareto</h3>
                </div>
                <div class="p-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</div>
            `;
            return;
        }

        const max = Math.max(1, ...this.pareto.map(fila => Number(fila.registros) || 0));
        const paso = this.pasoBonito(max / 5);
        const maxAxis = Math.max(paso, Math.ceil(max / paso) * paso);
        const ticks = [];
        for (let valor = 0; valor <= maxAxis + (paso / 2); valor += paso) {
            ticks.push(Math.round(valor * 100) / 100);
        }

        const filas = this.pareto.map((fila, index) => {
            const anterior = index > 0 ? this.pareto[index - 1] : null;
            const mostrarCliente = !anterior || anterior.cliente !== fila.cliente;
            const activa = this.esFilaSeleccionada(fila);
            const porcentaje = Math.max(0.8, (Number(fila.registros) / maxAxis) * 100);
            const etiquetaIzquierda = porcentaje > 78;
            const labelPos = etiquetaIzquierda ? porcentaje : porcentaje;
            const transform = etiquetaIzquierda ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
            const gap = etiquetaIzquierda ? -6 : 6;

            return `
                <tr class="cursor-pointer border-b border-slate-100 transition-colors ${activa ? 'bg-blue-100' : 'hover:bg-blue-50/60'}"
                    data-pareto-index="${index}">
                    <td class="px-2 py-1.5 text-[11px] font-semibold text-slate-700 border-r border-slate-100">${mostrarCliente ? this.escapeHtml(fila.cliente) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100 truncate" title="${this.escapeHtml(fila.causatipo)}">${this.escapeHtml(fila.causatipo)}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-100">${this.escapeHtml(fila.codigoconta)}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100">${this.escapeHtml(fila.area)}</td>
                    <td class="px-2 py-1.5">
                        <div class="relative h-5" style="margin-right:42px;" data-eventos-tt="pareto" data-eventos-index="${index}">
                            <div class="absolute left-0 top-1/2 h-2.5 -translate-y-1/2" style="width:${porcentaje}%;background:#4e79a7;"></div>
                            <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-slate-700"
                                style="left:calc(${labelPos}% ${gap < 0 ? '-' : '+'} ${Math.abs(gap)}px);transform:${transform};text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.formatCantidad(fila.registros)}</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        contenedor.innerHTML = `
            <div class="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-800">Pareto</h3>
                <span class="text-[10px] font-semibold text-slate-500">Número de registros</span>
            </div>
            <div class="overflow-auto custom-scrollbar" style="max-height:430px;">
                <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:900px;">
                    <colgroup>
                        <col style="width:160px;">
                        <col style="width:330px;">
                        <col style="width:95px;">
                        <col style="width:160px;">
                        <col>
                    </colgroup>
                    <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                        <tr>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">cliente</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">causatipo</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">codigoconta</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">area</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold">Número de registros</th>
                        </tr>
                    </thead>
                    <tbody id="eventos-pareto-body">${filas}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="px-2 py-2 text-[9px] font-semibold text-slate-400 border-t border-slate-200">Número de registros</td>
                            <td class="px-2 pt-1 pb-2 border-t border-slate-200">
                                <div class="relative h-5" style="margin-right:42px;">
                                    ${ticks.map(tick => {
                                        const left = maxAxis > 0 ? (tick / maxAxis) * 100 : 0;
                                        const transform = tick === 0 ? 'translate(0, 0)' : (tick === maxAxis ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
                                        return `<span class="absolute top-0 font-mono text-[9px] text-slate-500" style="left:${left}%;transform:${transform};">${this.formatCantidad(tick)}</span>`;
                                    }).join('')}
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        document.getElementById('eventos-pareto-body')?.addEventListener('click', event => {
            const fila = event.target.closest?.('[data-pareto-index]');
            if (!fila) return;
            this.seleccionarPareto(Number(fila.dataset.paretoIndex), event.ctrlKey || event.metaKey);
        });
    },

    pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

        return factor * base;
    },

    renderListado() {
        const contenedor = document.getElementById('eventos-listado');
        if (!contenedor) return;

        const listado = this.listado || {};
        const filas = Array.isArray(listado.filas) ? listado.filas : [];
        const total = Number(listado.total) || 0;
        const page = Number(listado.page) || 1;
        const pageSize = Number(listado.page_size) || 50;
        const totalPaginas = Number(listado.total_paginas) || 0;
        const desde = total ? ((page - 1) * pageSize) + 1 : 0;
        const hasta = total ? Math.min(page * pageSize, total) : 0;

        const body = filas.map((fila, index) => {
            const anterior = index > 0 ? filas[index - 1] : null;
            const mostrar = campo => {
                if (!anterior) return true;
                return String(anterior[campo] ?? '') !== String(fila[campo] ?? '');
            };

            return `
                <tr class="hover:bg-slate-50/70">
                    <td class="px-2 py-1.5 font-mono text-[10px] text-slate-600 border-r border-slate-100 whitespace-nowrap">${mostrar('fechaproceso') ? this.escapeHtml(this.modoListado ? this.formatFechaDMY(fila.fechaproceso) : this.formatFecha(fila.fechaproceso)) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] font-medium text-slate-700 border-r border-slate-100">${mostrar('cliente') ? this.escapeHtml(fila.cliente) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100">${mostrar('area') ? this.escapeHtml(fila.area) : ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-100">${mostrar('codigoconta') ? this.escapeHtml(fila.codigoconta) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-slate-100" title="${mostrar('causatipo') ? this.escapeHtml(fila.causatipo) : ''}">${mostrar('causatipo') ? this.escapeHtml(fila.causatipo) : ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-700 border-r border-slate-100">${mostrar('placa') ? this.escapeHtml(fila.placa) : ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-100 whitespace-nowrap">${mostrar('fecharegistro') ? this.escapeHtml(this.formatFecha(fila.fecharegistro)) : ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-100">${mostrar('horaregistro') ? this.escapeHtml(fila.horaregistro) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-700 border-r border-slate-100 truncate" title="${this.escapeHtml(fila.descripcion)}" style="max-width:360px;">${this.escapeHtml(fila.descripcion)}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 truncate" title="${this.escapeHtml(fila.usuario)}" style="max-width:170px;">${this.escapeHtml(fila.usuario)}</td>
                    <td class="px-2 py-1.5 text-center border-r border-slate-100">
                        <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:#4e79a7;"
                            data-eventos-tt="listado" data-eventos-index="${index}"></span>
                    </td>
                </tr>
            `;
        }).join('');

        const selecciones = this.seleccionesPareto;
        const filtroTexto = selecciones.length === 1
            ? `Filtro Pareto: ${selecciones[0].cliente || '(Sin cliente)'} · ${selecciones[0].codigoconta || ''} · ${selecciones[0].causatipo || ''}`
            : (selecciones.length > 1 ? `${selecciones.length} combinaciones Pareto seleccionadas` : '');

        contenedor.innerHTML = `
            <div class="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center ${this.modoListado ? 'justify-end' : 'justify-between'} gap-2">
                ${this.modoListado ? '' : `
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">Listado</h3>
                        <p class="text-[10px] text-slate-500 mt-0.5">${filtroTexto || 'Detalle de eventos proceso mermas'}</p>
                    </div>
                `}
                <span class="text-[10px] font-semibold text-slate-500">${total.toLocaleString('es-PE')} registros</span>
            </div>
            <div class="overflow-auto custom-scrollbar" style="max-height:460px;">
                <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:1500px;">
                    <colgroup>
                        <col style="width:95px;">
                        <col style="width:120px;">
                        <col style="width:130px;">
                        <col style="width:90px;">
                        <col style="width:280px;">
                        <col style="width:80px;">
                        <col style="width:110px;">
                        <col style="width:82px;">
                        <col style="width:360px;">
                        <col style="width:180px;">
                        <col style="width:92px;">
                    </colgroup>
                    <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                        <tr>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">fechaproceso</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">cliente</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">area</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">codigoconta</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">causatipo</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">placa</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">Día de fecharegistro</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold border-r border-blue-500">horaregistro</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">descripcion</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500">usuario</th>
                            <th class="px-2 py-2 text-center text-[10px] font-bold">Número de registros</th>
                        </tr>
                    </thead>
                    <tbody>${body || '<tr><td colspan="11" class="p-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</td></tr>'}</tbody>
                </table>
            </div>
            <div class="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span class="text-[10px] text-slate-500">${total ? `${desde.toLocaleString('es-PE')}–${hasta.toLocaleString('es-PE')} de ${total.toLocaleString('es-PE')}` : '0 registros'}</span>
                <div class="flex items-center gap-1">
                    <button type="button" class="px-2.5 py-1 text-[10px] font-semibold rounded border border-slate-200 bg-white disabled:opacity-40" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
                    <span class="px-2 text-[10px] font-semibold text-slate-600">${totalPaginas ? `${page} / ${totalPaginas}` : '0 / 0'}</span>
                    <button type="button" class="px-2.5 py-1 text-[10px] font-semibold rounded border border-slate-200 bg-white disabled:opacity-40" data-page="${Math.min(Math.max(1, totalPaginas), page + 1)}" ${!totalPaginas || page >= totalPaginas ? 'disabled' : ''}>Siguiente</button>
                </div>
            </div>
        `;

        contenedor.querySelectorAll('[data-page]').forEach(button => {
            button.addEventListener('click', () => {
                if (button.disabled) return;
                this.controllerRef?.cargarListado?.(this.seleccionesPareto, Number(button.dataset.page));
            });
        });
    },

    clavePareto(fila) {
        return [fila.cliente, fila.causatipo, fila.codigoconta, fila.area].join('\u001F');
    },

    seleccionarPareto(index, conCtrl = false) {
        const fila = this.pareto[index];
        if (!fila) return;

        const clave = this.clavePareto(fila);
        const existe = this.seleccionesPareto.some(actual => this.clavePareto(actual) === clave);

        if (conCtrl) {
            this.seleccionesPareto = existe
                ? this.seleccionesPareto.filter(actual => this.clavePareto(actual) !== clave)
                : this.seleccionesPareto.concat([{
                    cliente: fila.cliente,
                    causatipo: fila.causatipo,
                    codigoconta: fila.codigoconta,
                    area: fila.area
                }]);
        } else if (this.seleccionesPareto.length === 1 && existe) {
            this.seleccionesPareto = [];
        } else {
            this.seleccionesPareto = [{
                cliente: fila.cliente,
                causatipo: fila.causatipo,
                codigoconta: fila.codigoconta,
                area: fila.area
            }];
        }

        this.renderPareto();
        this.controllerRef?.actualizarChipFiltro?.();
        this.controllerRef?.cargarListado?.(this.seleccionesPareto, 1);
    },

    actualizarListado(listado) {
        this.listado = listado || {};
        this.renderListado();
    },

    esFilaSeleccionada(fila) {
        const clave = this.clavePareto(fila);
        return this.seleccionesPareto.some(actual => this.clavePareto(actual) === clave);
    },

    tieneSeleccion() {
        return this.seleccionesPareto.length > 0;
    },

    resumenSeleccion() {
        const total = this.seleccionesPareto.length;
        if (!total) return '';
        if (total > 1) return `${total} combinaciones seleccionadas`;

        const seleccion = this.seleccionesPareto[0];
        return [seleccion.cliente || '(Sin cliente)', seleccion.codigoconta, seleccion.causatipo, seleccion.area]
            .filter(Boolean)
            .join(' · ');
    },

    limpiarSeleccion(recargar = true) {
        this.seleccionesPareto = [];
        this.renderPareto();
        this.controllerRef?.actualizarChipFiltro?.();
        if (recargar) {
            this.controllerRef?.cargarListado?.(this.seleccionesPareto, 1);
        }
    }
};

window.ChartRegistry['DashAnalisis'] = window.ChartDashAnalisis;
window.ChartRegistry['Listado'] = window.ChartDashAnalisis;
