/**
 * DashJabasCont - Control de Jabas
 *
 * Dos paneles:
 * - Stock de Jabas Contable (matriz de fechas)
 * - Stock Contable Lineal de Jabas (small multiples)
 *
 * Filtro cruzado bidireccional entre ambos paneles.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartDashJabasCont = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,
    seleccion: {
        source: null,
        items: []
    },
    _filasTablaActual: [],
    _gruposLinealActual: [],
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _resizeBound: false,
    _lineResizeObserver: null,
    _lineResizeTimer: null,
    _lineWidth: 0,
    _tablaVirtual: null,
    _tablaResizeObserver: null,
    _linealVirtual: null,
    _fechasTablaActual: [],
    _fechasLinealActual: [],
    _formatter: null,
    _delegatedContainer: null,
    _delegatedAbort: null,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-graficos-lista');
        this.seleccion = { source: null, items: [] };
        this._inicializarTooltip();
        this._inicializarResize();
        this._inicializarEventosDelegados();
        this.renderView();
    },

    _inicializarResize() {
        if (this._resizeBound) return;
        this._resizeBound = true;

        if (typeof ResizeObserver !== 'undefined') return;

        let timer = null;
        window.addEventListener('resize', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (this.containerRef) this.renderView();
            }, 150);
        });
    },

    _observarAnchoLineal(contenedor) {
        this._lineWidth = Math.round(contenedor.getBoundingClientRect().width || contenedor.clientWidth || 0);

        if (typeof ResizeObserver === 'undefined') return;

        if (this._lineResizeObserver) {
            this._lineResizeObserver.disconnect();
        }

        this._lineResizeObserver = new ResizeObserver(entries => {
            const ancho = Math.round(entries[0]?.contentRect?.width || 0);
            if (!ancho || Math.abs(ancho - this._lineWidth) < 2) return;

            this._lineWidth = ancho;
            clearTimeout(this._lineResizeTimer);
            this._lineResizeTimer = setTimeout(() => {
                if (document.getElementById('jabas-lineal-cont') !== contenedor) return;
                this.renderLineal();
            }, 100);
        });

        this._lineResizeObserver.observe(contenedor);
    },

    _inicializarEventosDelegados() {
        const contenedor = this.containerRef;
        if (!contenedor || this._delegatedContainer === contenedor) return;

        if (this._delegatedAbort) {
            this._delegatedAbort.abort();
        }

        this._delegatedContainer = contenedor;
        this._delegatedAbort = new AbortController();
        const opciones = { signal: this._delegatedAbort.signal };
        const selectorTooltip = '.jabas-celda-valor, [data-jabas-point]';

        contenedor.addEventListener('click', event => {
            const celda = event.target.closest?.('.jabas-celda-valor');
            if (celda) {
                const filaIndex = Number(celda.dataset.filaIndex);
                const fecha = celda.dataset.fecha;
                const fila = this._filasTablaActual[filaIndex];
                if (!fila) return;

                this.alternarSeleccion('tabla', this.itemDesdeFila(fila, fecha), event.ctrlKey || event.metaKey);
                return;
            }

            const punto = event.target.closest?.('[data-jabas-point]');
            if (!punto) return;

            const grupoIndex = Number(punto.dataset.grupoIndex);
            const fecha = punto.dataset.fecha;
            const fila = this._gruposLinealActual[grupoIndex];
            if (!fila) return;

            this.alternarSeleccion('lineal', this.itemDesdeFila(fila, fecha), event.ctrlKey || event.metaKey);
        }, opciones);

        contenedor.addEventListener('mouseover', event => {
            const objetivo = event.target.closest?.(selectorTooltip);
            if (!objetivo || objetivo === this._tooltipTarget) return;

            this.ocultarTooltip();
            this._tooltipTarget = objetivo;
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            clearTimeout(this._tooltipTimer);
            this._tooltipTimer = setTimeout(() => {
                if (this._tooltipTarget === objetivo) {
                    this._mostrarTooltip(objetivo);
                }
            }, 500);
        }, opciones);

        contenedor.addEventListener('mousemove', event => {
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            if (
                this._tooltipTarget &&
                this.tooltipEl &&
                !this.tooltipEl.classList.contains('hidden')
            ) {
                this._posicionarTooltip();
            }
        }, opciones);

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.(selectorTooltip);
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this.ocultarTooltip();
            }
        }, opciones);
    },

    _inicializarTooltip() {
        if (this.tooltipEl) return;

        this.tooltipEl = document.getElementById('jabas-tooltip');
        if (!this.tooltipEl) {
            this.tooltipEl = document.createElement('div');
            this.tooltipEl.id = 'jabas-tooltip';
            this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[240px] max-w-[360px] font-sans';
            document.body.appendChild(this.tooltipEl);
        }

        if (!this._tooltipGlobalBound) {
            window.addEventListener('scroll', () => this.ocultarTooltip(), true);
            this._tooltipGlobalBound = true;
        }
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const valor = attr => this.escapeHtml(elemento.getAttribute(attr) || '');

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans">
                <span class="text-slate-500 font-normal">item:</span>
                <span class="text-slate-900 font-semibold text-left">${valor('data-tt-item')}</span>
                <span class="text-slate-500 font-normal">codalmacen:</span>
                <span class="text-slate-900 font-semibold text-left">${valor('data-tt-codalmacen')}</span>
                <span class="text-slate-500 font-normal">nomcliente:</span>
                <span class="text-slate-900 font-semibold text-left">${valor('data-tt-nomcliente')}</span>
                <span class="text-slate-500 font-normal">Día de fechacontable:</span>
                <span class="text-slate-900 font-semibold text-left">${valor('data-tt-fecha')}</span>
                <span class="text-slate-500 font-normal">cantidad:</span>
                <span class="text-slate-900 font-semibold text-left">${valor('data-tt-cantidad')}</span>
            </div>
        `;

        this.tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this.tooltipEl) return;

        const tooltipWidth = this.tooltipEl.offsetWidth || 280;
        const tooltipHeight = this.tooltipEl.offsetHeight || 130;
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

    ocultarTooltip() {
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
        this._tooltipTarget = null;

        if (this.tooltipEl) {
            this.tooltipEl.classList.add('hidden');
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

    formatCantidad(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';

        if (!this._formatter) {
            this._formatter = new Intl.NumberFormat('es-PE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        }

        return this._formatter.format(Number(valor));
    },

    claveGrupo(fila) {
        return [fila.codalmacen, fila.nomcliente, fila.coditem].join('\u001F');
    },

    claveItem(item) {
        return [item.codalmacen, item.nomcliente, item.coditem, item.fecha].join('\u001F');
    },

    itemDesdeFila(fila, fecha) {
        return {
            codalmacen: fila.codalmacen,
            nomcliente: fila.nomcliente,
            coditem: fila.coditem,
            fecha
        };
    },

    esItemSeleccionado(item) {
        const clave = this.claveItem(item);
        return this.seleccion.items.some(actual => this.claveItem(actual) === clave);
    },

    tieneSeleccion() {
        return this.seleccion.items.length > 0;
    },

    resumenSeleccion() {
        const n = this.seleccion.items.length;
        const fuente = this.seleccion.source === 'lineal' ? 'Línea' : 'Tabla';
        return `${fuente} · ${n} ${n === 1 ? 'selección' : 'selecciones'}`;
    },

    limpiarSeleccion() {
        this.seleccion = { source: null, items: [] };
        this.renderView();
        this.controllerRef?.actualizarChipFiltro?.();
    },

    alternarSeleccion(source, item, aditivo = false) {
        const fuenteAnterior = this.seleccion.source;

        if (this.seleccion.source !== source) {
            this.seleccion = { source, items: [] };
            aditivo = false;
        }

        const clave = this.claveItem(item);
        const existe = this.seleccion.items.some(actual => this.claveItem(actual) === clave);
        const soloEste = this.seleccion.items.length === 1 && existe;

        if (!aditivo) {
            if (soloEste) {
                this.seleccion = { source: null, items: [] };
            } else {
                this.seleccion.items = [item];
            }
        } else if (existe) {
            this.seleccion.items = this.seleccion.items.filter(actual => this.claveItem(actual) !== clave);
        } else {
            this.seleccion.items = this.seleccion.items.concat([item]);
        }

        if (!this.seleccion.items.length) {
            this.seleccion.source = null;
        }

        const cambioFuente = fuenteAnterior && fuenteAnterior !== this.seleccion.source;

        if (cambioFuente || !this.seleccion.items.length) {
            this.renderView();
        } else if (this.seleccion.source === 'tabla') {
            this._renderTablaWindow(true);
            this.renderLineal();
        } else if (this.seleccion.source === 'lineal') {
            this._renderLinealWindow(true);
            this.renderTabla();
        } else {
            this.renderView();
        }

        this.controllerRef?.actualizarChipFiltro?.();
    },

    fechasSeleccionadas() {
        const set = new Set(this.seleccion.items.map(item => item.fecha));
        return (this.datosBackend?.fechas || []).filter(fecha => set.has(fecha.fecha));
    },

    filasFiltradas() {
        const grupos = new Set(this.seleccion.items.map(item => this.claveGrupo(item)));
        return (this.datosBackend?.filas || []).filter(fila => grupos.has(this.claveGrupo(fila)));
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this.ocultarTooltip();

        const data = this.datosBackend || {};
        const filas = data.filas || [];
        const fechas = data.fechas || [];

        if (!filas.length || !fechas.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-boxes-stacked text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para la selección</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste la fecha o los almacenes seleccionados.</p>
                </div>
            `;
            return;
        }

        const scrollTabla = document.getElementById('jabas-tabla-scroll');
        const scrollLineal = document.getElementById('jabas-lineal-scroll');
        const tablaScrollLeft = scrollTabla?.scrollLeft || 0;
        const tablaScrollTop = scrollTabla?.scrollTop || 0;
        const linealScrollLeft = scrollLineal?.scrollLeft || 0;
        const linealScrollTop = scrollLineal?.scrollTop || 0;

        const resumen = data.resumen || {};

        contenedor.innerHTML = `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                        <div>
                            <h2 class="text-base font-bold text-slate-900 tracking-tight">Stock de Jabas Contable</h2>
                            <p class="text-xs text-slate-500 mt-0.5">Stock contable por cliente, ítem y fecha</p>
                        </div>
                        <span class="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                            ${filas.length} filas
                        </span>
                    </div>
                    <div id="jabas-tabla-cont" style="height:clamp(480px, calc(100vh - 280px), 640px); min-height:0;"></div>
                </section>

                <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                    <div class="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                        <div>
                            <h2 class="text-base font-bold text-slate-900 tracking-tight">Stock Contable Lineal de Jabas</h2>
                            <p class="text-xs text-slate-500 mt-0.5">Evolución diaria por cliente e ítem</p>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                            <span>Total general: <strong class="text-slate-800 font-mono">${this.formatCantidad(resumen.total)}</strong></span>
                        </div>
                    </div>
                    <div id="jabas-lineal-cont" style="height:clamp(480px, calc(100vh - 280px), 640px); min-height:0;"></div>
                </section>
            </div>
        `;

        this.renderTabla();
        this.renderLineal();

        const nuevaTabla = document.getElementById('jabas-tabla-scroll');
        const nuevaLineal = document.getElementById('jabas-lineal-scroll');
        if (nuevaTabla) {
            nuevaTabla.scrollLeft = tablaScrollLeft;
            nuevaTabla.scrollTop = tablaScrollTop;
        }
        if (nuevaLineal) {
            nuevaLineal.scrollLeft = linealScrollLeft;
            nuevaLineal.scrollTop = linealScrollTop;
        }

        setTimeout(() => {
            this._renderTablaWindow(true);
            this._renderLinealWindow(true);
        }, 0);
    },

    filtrarTabla() {
        const esDestino = this.tieneSeleccion() && this.seleccion.source !== 'tabla';
        if (!esDestino) {
            return {
                filas: this.datosBackend?.filas || [],
                fechas: [...(this.datosBackend?.fechas || [])].reverse()
            };
        }

        return {
            filas: this.filasFiltradas(),
            fechas: this.fechasSeleccionadas().sort((a, b) => b.fecha.localeCompare(a.fecha))
        };
    },

    renderTabla() {
        const contenedor = document.getElementById('jabas-tabla-cont');
        if (!contenedor) return;

        const scrollPrevio = document.getElementById('jabas-tabla-scroll');
        const scrollLeftPrevio = scrollPrevio?.scrollLeft || 0;
        const scrollTopPrevio = scrollPrevio?.scrollTop || 0;
        const { filas, fechas } = this.filtrarTabla();
        this._filasTablaActual = filas;
        this._fechasTablaActual = fechas;

        if (!filas.length || !fechas.length) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin datos para el filtro seleccionado.</div>`;
            this._tablaVirtual = null;
            return;
        }

        const anchoFechas = fechas.length * 58;
        const minWidth = 354 + anchoFechas;

        const headersFechas = fechas.map(fecha => `
            <th class="px-1 py-1 text-center align-middle border-r border-blue-500 min-w-[58px]" style="background-color:#2563eb;">
                <div class="h-[58px] flex items-center justify-center">
                    <span class="text-[8px] font-semibold text-blue-50" style="writing-mode: vertical-rl; transform: rotate(180deg);">
                        ${this.escapeHtml(fecha.ymd)}
                    </span>
                </div>
            </th>
        `).join('');

        this._tablaVirtual = {
            start: -1,
            end: -1,
            rowHeight: 28,
            buffer: 10,
            raf: null
        };

        contenedor.innerHTML = `
            <div id="jabas-tabla-scroll" class="h-full overflow-auto custom-scrollbar" style="contain:layout paint;">
                <table class="text-left border-collapse" style="table-layout:fixed; width:${minWidth}px; min-width:${minWidth}px;">
                    <colgroup>
                        <col style="width:64px;">
                        <col style="width:180px;">
                        <col style="width:110px;">
                        ${fechas.map(() => '<col style="width:58px;">').join('')}
                    </colgroup>
                    <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                        <tr>
                            <th class="jabas-col-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border-r border-blue-500 align-middle" style="background-color:#2563eb;">codalmacen</th>
                            <th class="jabas-col-2 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border-r border-blue-500 align-middle" style="background-color:#2563eb;">nomcliente</th>
                            <th class="jabas-col-3 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider border-r border-blue-500 align-middle" style="background-color:#2563eb;">item</th>
                            ${headersFechas}
                        </tr>
                    </thead>
                    <tbody id="jabas-tabla-body"></tbody>
                </table>
            </div>
        `;

        const scroll = document.getElementById('jabas-tabla-scroll');
        if (scroll) {
            scroll.addEventListener('scroll', () => {
                const estado = this._tablaVirtual;
                if (!estado || estado.raf) return;

                estado.raf = requestAnimationFrame(() => {
                    estado.raf = null;
                    this._renderTablaWindow();
                });
            }, { passive: true });
            this._observarAltoTabla(scroll);
        }

        this._renderTablaWindow(true);

        if (scroll) {
            scroll.scrollLeft = scrollLeftPrevio;
            scroll.scrollTop = scrollTopPrevio;
            this._renderTablaWindow(true);
        }

        requestAnimationFrame(() => this._renderTablaWindow(true));
    },

    _renderTablaFila(fila, filaIndex) {
        const fechas = this._fechasTablaActual || [];
        const filaHeight = this._tablaVirtual?.rowHeight || 28;

        const fechaCells = fechas.map(fecha => {
            const tieneValor = Object.prototype.hasOwnProperty.call(fila.valores || {}, fecha.fecha);
            const valor = tieneValor ? fila.valores[fecha.fecha] : null;
            const seleccionada = this.seleccion.source === 'tabla'
                && this.esItemSeleccionado(this.itemDesdeFila(fila, fecha.fecha));

            if (!tieneValor) {
                return `<td class="px-1 py-1.5 text-center text-[10px] text-slate-300 border-r border-b border-slate-100"></td>`;
            }

            return `
                <td class="jabas-celda-valor px-1 py-1.5 text-right font-mono text-[10px] border-r border-b border-slate-100 cursor-pointer transition-colors
                    ${seleccionada ? 'bg-blue-100 text-blue-900 font-bold ring-1 ring-inset ring-blue-500' : (Number(valor) < 0 ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50')}"
                    data-fila-index="${filaIndex}" data-fecha="${this.escapeHtml(fecha.fecha)}"
                    data-tt-item="${this.escapeHtml(fila.item)}"
                    data-tt-codalmacen="${this.escapeHtml(fila.codalmacen)}"
                    data-tt-nomcliente="${this.escapeHtml(fila.nomcliente)}"
                    data-tt-fecha="${this.escapeHtml(fecha.label)}"
                    data-tt-cantidad="${this.escapeHtml(this.formatCantidad(valor))}">
                    ${this.escapeHtml(this.formatCantidad(valor))}
                </td>
            `;
        }).join('');

        return `
            <tr class="hover:bg-slate-50/60" style="height:${filaHeight}px;">
                <td class="jabas-col-1 px-2 py-1.5 text-[10px] font-semibold text-slate-700 border-r border-b border-slate-100">${this.escapeHtml(fila.codalmacen)}</td>
                <td class="jabas-col-2 px-2 py-1.5 text-[10px] text-slate-700 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.nomcliente)}">${this.escapeHtml(fila.nomcliente)}</td>
                <td class="jabas-col-3 px-2 py-1.5 text-[10px] text-slate-700 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.item)}">${this.escapeHtml(fila.item)}</td>
                ${fechaCells}
            </tr>
        `;
    },

    _renderTablaWindow(force = false) {
        const tbody = document.getElementById('jabas-tabla-body');
        const scroll = document.getElementById('jabas-tabla-scroll');
        const estado = this._tablaVirtual;

        if (!tbody || !scroll || !estado) return;

        const total = this._filasTablaActual.length;
        if (!total) {
            tbody.innerHTML = '';
            estado.start = 0;
            estado.end = 0;
            return;
        }

        const rowHeight = estado.rowHeight;
        const panel = document.getElementById('jabas-tabla-cont');
        const viewport = Math.max(scroll.clientHeight || 0, panel?.clientHeight || 0, 400);
        const start = Math.max(0, Math.floor(scroll.scrollTop / rowHeight) - estado.buffer);
        const end = Math.min(total, Math.ceil((scroll.scrollTop + viewport) / rowHeight) + estado.buffer);

        if (!force && start === estado.start && end === estado.end) return;

        estado.start = start;
        estado.end = end;

        const colspan = 3 + (this._fechasTablaActual?.length || 0);
        let html = '';

        if (start > 0) {
            html += `<tr aria-hidden="true"><td colspan="${colspan}" style="height:${start * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        for (let index = start; index < end; index++) {
            html += this._renderTablaFila(this._filasTablaActual[index], index);
        }

        if (end < total) {
            html += `<tr aria-hidden="true"><td colspan="${colspan}" style="height:${(total - end) * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        tbody.innerHTML = html;
    },

    _observarAltoTabla(scroll) {
        if (typeof ResizeObserver === 'undefined') return;

        if (this._tablaResizeObserver) {
            this._tablaResizeObserver.disconnect();
        }

        this._tablaResizeObserver = new ResizeObserver(() => {
            this._renderTablaWindow(true);
        });
        this._tablaResizeObserver.observe(scroll);
    },

    filtrarLineal() {
        const esDestino = this.tieneSeleccion() && this.seleccion.source !== 'lineal';
        if (!esDestino) {
            return {
                filas: this.datosBackend?.filas || [],
                fechas: this.datosBackend?.fechas || []
            };
        }

        return {
            filas: this.filasFiltradas(),
            fechas: this.fechasSeleccionadas()
        };
    },

    renderLineal() {
        const contenedor = document.getElementById('jabas-lineal-cont');
        if (!contenedor) return;

        const scrollPrevio = document.getElementById('jabas-lineal-scroll');
        const scrollLeftPrevio = scrollPrevio?.scrollLeft || 0;
        const scrollTopPrevio = scrollPrevio?.scrollTop || 0;
        const { filas, fechas } = this.filtrarLineal();
        this._gruposLinealActual = filas;
        this._fechasLinealActual = fechas;

        if (!filas.length || !fechas.length) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin datos para el filtro seleccionado.</div>`;
            this._linealVirtual = null;
            this._linealCtx = null;
            return;
        }

        const valores = [];
        filas.forEach(fila => {
            fechas.forEach(fecha => {
                if (Object.prototype.hasOwnProperty.call(fila.valores || {}, fecha.fecha)) {
                    valores.push(Number(fila.valores[fecha.fecha]));
                }
            });
        });

        const maxValor = Math.max(0, ...valores);
        const minValor = Math.min(0, ...valores);
        const amplitud = Math.max(1, maxValor - minValor);
        const pasoBruto = amplitud / 4;
        const potencia = Math.pow(10, Math.floor(Math.log10(pasoBruto || 1)));
        const normalizado = pasoBruto / potencia;
        const paso = (normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10) * potencia;
        const yMax = Math.ceil(maxValor / paso) * paso;
        const yMin = Math.floor(minValor / paso) * paso;
        const rango = Math.max(1, yMax - yMin);
        const ticksY = [];

        for (let tick = yMax; tick >= yMin - 1e-9; tick -= paso) {
            ticksY.push(Math.round(tick * 1000) / 1000);
        }
        if (!ticksY.length || ticksY[ticksY.length - 1] !== yMin) {
            ticksY.push(yMin);
        }

        const labelWidth = 280;
        const axisWidth = 58;
        const rowHeight = 84;
        const axisHeight = 120;
        const anchoContenedor = Math.max(320, contenedor.clientWidth || 0);
        const anchoDisponible = Math.max(240, anchoContenedor - labelWidth - axisWidth - 8);
        const anchoMinimo = Math.max(280, (fechas.length - 1) * 18 + 16);
        const plotWidth = Math.max(anchoDisponible, anchoMinimo);
        const minWidth = labelWidth + axisWidth + plotWidth;
        const espacioFecha = (plotWidth - 16) / Math.max(1, fechas.length - 1);
        const fontSizeEtiqueta = Math.max(8, Math.min(10.5, espacioFecha * 0.48));

        this._linealCtx = {
            filas,
            fechas,
            labelWidth,
            axisWidth,
            rowHeight,
            axisHeight,
            plotWidth,
            minWidth,
            yMax,
            yMin,
            rango,
            ticksY,
            fontSizeEtiqueta
        };

        this._linealVirtual = {
            start: -1,
            end: -1,
            rowHeight,
            buffer: 4,
            raf: null
        };

        const ejeFechas = fechas.map((fecha, index) => {
            const x = 8 + index * ((plotWidth - 16) / Math.max(1, fechas.length - 1));
            return `
                <div class="absolute text-[9.5px] text-slate-600 whitespace-nowrap"
                    style="left:${(x - 4).toFixed(1)}px; top:6px; writing-mode:vertical-rl; transform:rotate(180deg); transform-origin:center; line-height:1;">
                    ${this.escapeHtml(fecha.label || fecha.ymd)}
                </div>
            `;
        }).join('');

        contenedor.innerHTML = `
            <div id="jabas-lineal-wrap" style="height:100%; min-height:0; display:flex; flex-direction:column;">
                <div id="jabas-lineal-scroll" class="custom-scrollbar" style="flex:1 1 auto; min-height:0; overflow:auto; contain:layout paint;">
                    <div style="min-width:${minWidth}px;">
                        <div class="flex border-b border-slate-200" style="position:sticky; top:0; z-index:40;">
                            <div class="sticky left-0 z-30 px-3 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider border-r border-blue-500" style="width:${labelWidth}px; min-width:${labelWidth}px;">
                                codalmacen / nomcliente / item
                            </div>
                            <div class="sticky z-30 bg-blue-600 border-r border-blue-500" style="left:${labelWidth}px; width:${axisWidth}px; min-width:${axisWidth}px;"></div>
                            <div class="relative bg-blue-600 text-center text-[10px] font-normal text-blue-100 border-blue-500" style="width:${plotWidth}px; min-width:${plotWidth}px;">
                                <div class="py-2">Día de fechacontable</div>
                            </div>
                        </div>
                        <div id="jabas-lineal-rows"></div>
                        <div id="jabas-eje-fechas" class="flex border-t border-slate-200" style="position:sticky; bottom:0; z-index:50; min-width:${minWidth}px; height:${axisHeight}px; background:#ffffff;">
                            <div class="sticky left-0 bg-white border-r border-slate-200" style="z-index:55; width:${labelWidth}px; min-width:${labelWidth}px;"></div>
                            <div class="sticky bg-white border-r border-slate-200" style="left:${labelWidth}px; z-index:55; width:${axisWidth}px; min-width:${axisWidth}px;"></div>
                            <div class="relative bg-white" style="width:${plotWidth}px; min-width:${plotWidth}px; height:${axisHeight}px;">
                                ${ejeFechas}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const scroll = document.getElementById('jabas-lineal-scroll');
        if (scroll) {
            scroll.addEventListener('scroll', () => {
                const estado = this._linealVirtual;
                if (!estado || estado.raf) return;

                estado.raf = requestAnimationFrame(() => {
                    estado.raf = null;
                    this._renderLinealWindow();
                });
            }, { passive: true });
        }

        this._renderLinealWindow(true);

        if (scroll) {
            scroll.scrollLeft = scrollLeftPrevio;
            scroll.scrollTop = scrollTopPrevio;
            this._renderLinealWindow(true);
        }

        this._observarAnchoLineal(contenedor);
    },

    _renderLinealFila(fila, grupoIndex) {
        const ctx = this._linealCtx;
        if (!ctx) return '';

        const {
            fechas,
            labelWidth,
            axisWidth,
            rowHeight,
            plotWidth,
            yMax,
            rango,
            ticksY,
            fontSizeEtiqueta
        } = ctx;

        const puntos = [];
        const etiquetas = [];
        const segmentos = [];
        let segmento = '';

        fechas.forEach((fecha, fechaIndex) => {
            const tieneValor = Object.prototype.hasOwnProperty.call(fila.valores || {}, fecha.fecha);
            if (!tieneValor) {
                if (segmento) {
                    segmentos.push(segmento);
                    segmento = '';
                }
                return;
            }

            const valor = Number(fila.valores[fecha.fecha]);
            const x = 8 + fechaIndex * ((plotWidth - 16) / Math.max(1, fechas.length - 1));
            const y = 8 + ((yMax - valor) / rango) * (rowHeight - 16);
            const seleccionado = this.seleccion.source === 'lineal'
                && this.esItemSeleccionado(this.itemDesdeFila(fila, fecha.fecha));
            const color = valor < 0 ? '#db4343' : (valor > 0 ? '#499844' : '#64748b');

            const labelY = y < 14 ? y + 14 : y - 8;
            const cantidadTexto = this.formatCantidad(valor);

            segmento += `${segmento ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
            puntos.push(`
                <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${seleccionado ? 5 : 3.2}" fill="${color}"
                    stroke="${seleccionado ? '#0f172a' : '#ffffff'}" stroke-width="${seleccionado ? 2 : 1}"
                    pointer-events="none"></circle>
                <circle data-jabas-point="true" data-grupo-index="${grupoIndex}" data-fecha="${this.escapeHtml(fecha.fecha)}"
                    data-tt-item="${this.escapeHtml(fila.item)}"
                    data-tt-codalmacen="${this.escapeHtml(fila.codalmacen)}"
                    data-tt-nomcliente="${this.escapeHtml(fila.nomcliente)}"
                    data-tt-fecha="${this.escapeHtml(fecha.label)}"
                    data-tt-cantidad="${this.escapeHtml(cantidadTexto)}"
                    cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="transparent"
                    pointer-events="all" class="cursor-pointer"></circle>
            `);
            etiquetas.push(`
                <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="${fontSizeEtiqueta.toFixed(1)}"
                    font-weight="700" fill="#1e293b" stroke="#ffffff" stroke-width="1.5"
                    paint-order="stroke" pointer-events="none">${this.escapeHtml(cantidadTexto)}</text>
            `);
        });

        if (segmento) segmentos.push(segmento);

        const paths = segmentos.map(path => `
            <path d="${path}" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path>
        `).join('');

        return `
            <div class="flex border-b border-slate-100" style="height:${rowHeight}px;">
                <div class="sticky left-0 z-20 flex flex-col justify-center px-3 py-2 border-r border-slate-200 bg-white" style="width:${labelWidth}px; min-width:${labelWidth}px;">
                    <span class="text-[10px] font-semibold text-slate-500 uppercase truncate" title="${this.escapeHtml(fila.codalmacen)}">${this.escapeHtml(fila.codalmacen)}</span>
                    <span class="text-[11px] font-semibold text-slate-800 truncate" title="${this.escapeHtml(fila.nomcliente)}">${this.escapeHtml(fila.nomcliente)}</span>
                    <span class="text-[10px] text-slate-500 truncate" title="${this.escapeHtml(fila.item)}">${this.escapeHtml(fila.item)}</span>
                </div>
                <div class="sticky z-20 flex flex-col justify-between items-end py-2 pr-2 text-[9px] font-mono text-slate-400 bg-white border-r border-slate-200" style="left:${labelWidth}px; width:${axisWidth}px; min-width:${axisWidth}px;">
                    ${ticksY.map(tick => `<span>${this.escapeHtml(this.formatCantidad(tick))}</span>`).join('')}
                </div>
                <div class="relative" style="width:${plotWidth}px; min-width:${plotWidth}px; height:${rowHeight}px;">
                    <svg width="${plotWidth}" height="${rowHeight}" viewBox="0 0 ${plotWidth} ${rowHeight}" class="block">
                        ${ticksY.map(tick => {
                            const y = 8 + ((yMax - tick) / rango) * (rowHeight - 16);
                            return `<line x1="8" y1="${y.toFixed(1)}" x2="${plotWidth - 8}" y2="${y.toFixed(1)}" stroke="${tick === 0 ? '#cbd5e1' : '#e2e8f0'}" stroke-width="1" ${tick === 0 ? '' : 'stroke-dasharray="2 2"'}></line>`;
                        }).join('')}
                        ${paths}
                        ${puntos.join('')}
                        ${etiquetas.join('')}
                    </svg>
                </div>
            </div>
        `;
    },

    _renderLinealWindow(force = false) {
        const rowsCont = document.getElementById('jabas-lineal-rows');
        const scroll = document.getElementById('jabas-lineal-scroll');
        const estado = this._linealVirtual;

        if (!rowsCont || !scroll || !estado) return;

        const total = this._gruposLinealActual.length;
        if (!total) {
            rowsCont.innerHTML = '';
            estado.start = 0;
            estado.end = 0;
            return;
        }

        const rowHeight = estado.rowHeight;
        const viewport = scroll.clientHeight || 400;
        const start = Math.max(0, Math.floor(scroll.scrollTop / rowHeight) - estado.buffer);
        const end = Math.min(total, Math.ceil((scroll.scrollTop + viewport) / rowHeight) + estado.buffer);

        if (!force && start === estado.start && end === estado.end) return;

        estado.start = start;
        estado.end = end;

        let html = '';

        if (start > 0) {
            html += `<div aria-hidden="true" style="height:${start * rowHeight}px;"></div>`;
        }

        for (let index = start; index < end; index++) {
            html += this._renderLinealFila(this._gruposLinealActual[index], index);
        }

        if (end < total) {
            html += `<div aria-hidden="true" style="height:${(total - end) * rowHeight}px;"></div>`;
        }

        rowsCont.innerHTML = html;
    }
};

window.ChartRegistry['DashJabasCont'] = window.ChartDashJabasCont;

