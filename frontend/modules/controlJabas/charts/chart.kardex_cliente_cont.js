/**
 * KardexClienteCont - Kardex contable de jabas por cliente.
 *
 * Tabla con movimientos por fecha, cliente y transacción:
 * - barra de SUM(cantidad)
 * - punto de saldo acumulado
 *
 * No tiene filtro cruzado.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartKardexClienteCont = {
    containerRef: null,
    datosBackend: null,
    _formatter: null,
    _formatterKardex: null,
    _stores: [],
    _rowHeight: 48,
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-graficos-lista');
        this._inicializarTooltip();
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
                maximumFractionDigits: 2
            });
        }

        return this._formatter.format(Number(valor));
    },

    formatKardexCantidad(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';

        if (!this._formatterKardex) {
            this._formatterKardex = new Intl.NumberFormat('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        return this._formatterKardex.format(Number(valor));
    },

    _inicializarTooltip() {
        if (!this.tooltipEl) {
            this.tooltipEl = document.getElementById('kardex-tooltip');
            if (!this.tooltipEl) {
                this.tooltipEl = document.createElement('div');
                this.tooltipEl.id = 'kardex-tooltip';
                this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[360px] max-w-[520px] font-sans';
                document.body.appendChild(this.tooltipEl);
            }
        }

        if (!this._tooltipGlobalBound) {
            window.addEventListener('scroll', () => this._ocultarTooltip(), true);
            this._tooltipGlobalBound = true;
        }
    },

    _bindTooltipEvents(contenedor) {
        if (!contenedor) return;

        contenedor.addEventListener('mouseover', event => {
            const objetivo = event.target.closest?.('[data-kardex-tt]');
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
            }, 300);
        });

        contenedor.addEventListener('mousemove', event => {
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            if (this.tooltipEl && !this.tooltipEl.classList.contains('hidden')) {
                this._posicionarTooltip();
            }
        });

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.('[data-kardex-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const fila = elemento.closest('tr');
        if (!fila) return;

        const valor = nombre => this.escapeHtml(fila.getAttribute(`data-kardex-${nombre}`) || '');

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                <span class="text-slate-500 font-normal whitespace-nowrap">codalmacen:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('codalmacen')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">codtransaccion:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('codtransaccion')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">nomcliente:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('nomcliente')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">nomtransaccion:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('nomtransaccion')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Día de fechacontable:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('fecha')}</span>
                <span class="text-slate-500 font-normal leading-snug">Ejecutando Suma de cantidad junto con Tabla (abajo):</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('acumulado')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">cantidad:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('cantidad')}</span>
            </div>
        `;

        this.tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this.tooltipEl) return;

        const tooltipWidth = this.tooltipEl.offsetWidth || 380;
        const tooltipHeight = this.tooltipEl.offsetHeight || 170;
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

    colorTransaccion(codigo) {
        const colores = {
            E000: '#4e79a7',
            E020: '#59a14f',
            E444: '#76b7b2',
            S444: '#b07aa1',
            S020: '#e15759',
            S400: '#edc948',
            E400: '#f28e2b'
        };

        return colores[codigo] || '#64748b';
    },

    colorAcumulado(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '#64748b';

        const limite = 15;
        const t = Math.max(-1, Math.min(1, numero / limite));
        const rojo = [225, 87, 89];
        const oro = [237, 201, 72];
        const verde = [89, 161, 79];
        const inicio = oro;
        const fin = t < 0 ? verde : rojo;
        const factor = Math.abs(t);
        const rgb = inicio.map((canal, indice) => Math.round(canal + (fin[indice] - canal) * factor));

        return `rgb(${rgb.join(',')})`;
    },

    agruparPorAlmacen(filas) {
        const grupos = new Map();

        filas.forEach(fila => {
            const almacen = fila.codalmacen || 'SIN ALMACEN';
            if (!grupos.has(almacen)) {
                grupos.set(almacen, []);
            }
            grupos.get(almacen).push(fila);
        });

        return [...grupos.entries()].map(([almacen, movimientos]) => {
            let maxAbs = 1;
            let minAcumulado = 0;
            let maxAcumulado = 0;

            movimientos.forEach(fila => {
                maxAbs = Math.max(maxAbs, Math.abs(Number(fila.cantidad) || 0));
                minAcumulado = Math.min(minAcumulado, Number(fila.acumulado) || 0);
                maxAcumulado = Math.max(maxAcumulado, Number(fila.acumulado) || 0);
            });

            return {
                almacen,
                movimientos,
                maxAbs,
                minAcumulado,
                maxAcumulado,
                rangoAcumulado: Math.max(1, maxAcumulado - minAcumulado)
            };
        });
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();

        const data = this.datosBackend || {};
        const filas = data.filas || [];
        const resumen = data.resumen || {};

        if (!filas.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-boxes-stacked text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron movimientos para el Kardex</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste la fecha, el almacén o el cliente seleccionado.</p>
                </div>
            `;
            return;
        }

        this._stores = this.agruparPorAlmacen(filas);

        const nombreCliente = this.escapeHtml(data.nomcliente || '');
        const fechaInicio = this.escapeHtml(data.fecha_inicio || '');
        const fechaFin = this.escapeHtml(data.fecha_fin || '');

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">Kardex Contable de Jabas por Cliente</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${nombreCliente} · ${fechaInicio} a ${fechaFin}</p>
                    </div>
                    <div class="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
                        <span>Movimientos: <strong class="text-slate-800 font-mono">${this.formatCantidad(resumen.movimientos || filas.length)}</strong></span>
                        <span>Total: <strong class="text-slate-800 font-mono">${this.formatCantidad(resumen.total || 0)}</strong></span>
                    </div>
                </div>
                <div id="kardex-stores" class="divide-y divide-slate-200"></div>
            </section>
        `;

        const storesCont = document.getElementById('kardex-stores');
        if (!storesCont) return;

        storesCont.innerHTML = this._stores.map((store, index) => this.renderStore(store, index)).join('');
        this._bindTooltipEvents(storesCont);

        this._stores.forEach((store, index) => {
            this.inicializarStore(store, index);
        });
    },

    renderStore(store, index) {
        const id = `kardex-store-${index}`;

        return `
            <div class="w-full">
                <div id="${id}-scroll" class="overflow-auto custom-scrollbar" style="height:clamp(380px, calc(100vh - 350px), 620px); contain:layout paint;">
                    <table class="text-left border-collapse" style="table-layout:fixed; width:max(100%, 1180px); min-width:1180px;">
                        <colgroup>
                            <col style="width:156px;">
                            <col style="width:188px;">
                            <col style="width:80px;">
                            <col style="width:256px;">
                            <col style="width:280px;">
                            <col style="width:220px;">
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr style="-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;">
                                <th class="px-2 py-2.5 text-[12px] font-bold uppercase tracking-normal border-r border-blue-500 align-middle" style="background-color:#2563eb;font-size:12px;line-height:1.2;letter-spacing:0.01em;">Día de fechacontable</th>
                                <th class="px-2 py-2.5 text-[12px] font-bold uppercase tracking-normal border-r border-blue-500 align-middle" style="background-color:#2563eb;font-size:12px;line-height:1.2;letter-spacing:0.01em;">nomcliente</th>
                                <th class="px-2 py-2.5 text-[12px] font-bold uppercase tracking-normal border-r border-blue-500 align-middle" style="background-color:#2563eb;font-size:12px;line-height:1.2;letter-spacing:0.01em;">codtransaccion</th>
                                <th class="px-2 py-2.5 text-[12px] font-bold uppercase tracking-normal border-r border-blue-500 align-middle" style="background-color:#2563eb;font-size:12px;line-height:1.2;letter-spacing:0.01em;">nomtransaccion</th>
                                <th colspan="2" class="px-2 py-2.5 text-center text-[12px] font-bold uppercase tracking-normal border-r border-blue-500 align-middle" style="background-color:#2563eb;font-size:12px;line-height:1.2;letter-spacing:0.01em;">${this.escapeHtml(store.almacen)}</th>
                            </tr>
                            <tr style="-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;">
                                <th class="px-2 py-1.5 text-[10.5px] font-semibold text-white border-r border-blue-500" style="background-color:#2563eb;font-size:10.5px;" colspan="4"></th>
                                <th class="px-2 py-1.5 text-[10.5px] font-semibold text-white border-r border-blue-500 text-center" style="background-color:#2563eb;font-size:10.5px;">cantidad</th>
                                <th class="px-2 py-1.5 text-[10px] font-semibold text-white text-center" style="background-color:#2563eb;font-size:10.5px;">Ejecutando Suma de cantidad</th>
                            </tr>
                        </thead>
                        <tbody id="${id}-body"></tbody>
                        <tfoot class="sticky bottom-0 z-30" style="background:#f8fafc;">
                            <tr>
                                <td colspan="4" class="border-t border-slate-200"></td>
                                <td class="px-2 py-1.5 text-[10.5px] font-semibold text-slate-600 text-center border-t border-l border-slate-200" style="font-size:10.5px;">cantidad</td>
                                <td class="px-2 py-1.5 text-[10.5px] font-semibold text-slate-600 text-center border-t border-l border-slate-200" style="font-size:10.5px;">Ejecutando Suma de cantidad</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    },

    inicializarStore(store, index) {
        const scroll = document.getElementById(`kardex-store-${index}-scroll`);
        const tbody = document.getElementById(`kardex-store-${index}-body`);
        if (!scroll || !tbody) return;

        store.scroll = scroll;
        store.tbody = tbody;
        store.start = -1;
        store.end = -1;
        store.raf = null;

        scroll.addEventListener('scroll', () => {
            if (store.raf) return;
            store.raf = requestAnimationFrame(() => {
                store.raf = null;
                this.renderStoreWindow(store);
            });
        }, { passive: true });

        this.renderStoreWindow(store, true);
        requestAnimationFrame(() => this.renderStoreWindow(store, true));
    },

    renderStoreWindow(store, force = false) {
        if (!store.tbody || !store.scroll) return;

        const total = store.movimientos.length;
        const rowHeight = this._rowHeight;
        const viewport = Math.max(store.scroll.clientHeight || 0, 400);
        const start = Math.max(0, Math.floor(store.scroll.scrollTop / rowHeight) - 10);
        const end = Math.min(total, Math.ceil((store.scroll.scrollTop + viewport) / rowHeight) + 10);

        if (!force && start === store.start && end === store.end) return;

        store.start = start;
        store.end = end;

        let html = '';
        if (start > 0) {
            html += `<tr aria-hidden="true"><td colspan="6" style="height:${start * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        for (let i = start; i < end; i++) {
            html += this.renderStoreRow(store, store.movimientos[i]);
        }

        if (end < total) {
            html += `<tr aria-hidden="true"><td colspan="6" style="height:${(total - end) * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        store.tbody.innerHTML = html;
    },

    renderStoreRow(store, fila) {
        const cantidad = Number(fila.cantidad) || 0;
        const acumulado = Number(fila.acumulado) || 0;
        const ancho = Math.min(48, (Math.abs(cantidad) / store.maxAbs) * 48);
        const inicioBarra = cantidad < 0 ? 50 - ancho : 50;
        const posicionAcumulado = ((acumulado - store.minAcumulado) / store.rangoAcumulado) * 100;
        const posicionCum = Math.max(2, Math.min(98, posicionAcumulado));
        const colorTrans = this.colorTransaccion(fila.codtransaccion);
        const colorCum = this.colorAcumulado(acumulado);
        const cantidadTexto = this.formatKardexCantidad(cantidad);
        const acumuladoTexto = this.formatKardexCantidad(acumulado);
        const posicionLabelBarra = cantidad < 0
            ? `calc(${inicioBarra}% - 4px)`
            : `calc(${inicioBarra + ancho}% + 4px)`;
        const transformLabelBarra = cantidad < 0 ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
        const transformLabelCum = posicionCum > 82 ? 'translate(-100%, -50%)' : 'translate(8px, -50%)';
        const fechaTexto = fila.label || fila.ymd || fila.fecha;

        return `
            <tr class="hover:bg-slate-50/70" style="height:${this._rowHeight}px;"
                data-kardex-codalmacen="${this.escapeHtml(fila.codalmacen || store.almacen)}"
                data-kardex-codtransaccion="${this.escapeHtml(fila.codtransaccion)}"
                data-kardex-nomcliente="${this.escapeHtml(fila.nomcliente)}"
                data-kardex-nomtransaccion="${this.escapeHtml(fila.nomtransaccion)}"
                data-kardex-fecha="${this.escapeHtml(fechaTexto)}"
                data-kardex-acumulado="${this.escapeHtml(acumuladoTexto)}"
                data-kardex-cantidad="${this.escapeHtml(cantidadTexto)}">
                <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100">${this.escapeHtml(fechaTexto)}</td>
                <td class="px-2 py-1.5 text-[10px] text-slate-700 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.nomcliente)}">${this.escapeHtml(fila.nomcliente)}</td>
                <td class="px-2 py-1.5 text-[10px] font-mono font-semibold text-slate-600 border-r border-b border-slate-100">${this.escapeHtml(fila.codtransaccion)}</td>
                <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100 leading-tight" title="${this.escapeHtml(fila.nomtransaccion)}">
                    <span class="line-clamp-2">${this.escapeHtml(fila.nomtransaccion)}</span>
                </td>
                <td class="px-2 py-1.5 border-r border-b border-slate-100" data-kardex-tt="1">
                    <div class="relative w-full h-4">
                        <div class="absolute inset-y-0" style="left:48px; right:48px;">
                            <div class="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200"></div>
                            <div class="absolute top-1/2 h-3 -translate-y-1/2 opacity-80" style="left:${inicioBarra}%; width:${ancho}%; background:${colorTrans};"></div>
                            <span class="absolute top-1/2 font-mono font-semibold text-slate-800 whitespace-nowrap pointer-events-none"
                                style="left:${posicionLabelBarra}; transform:${transformLabelBarra}; font-size:10px; font-variant-numeric:tabular-nums;">${this.escapeHtml(cantidadTexto)}</span>
                        </div>
                    </div>
                </td>
                <td class="px-2 py-1.5 border-b border-slate-100" data-kardex-tt="1">
                    <div class="relative w-full h-4">
                        <div class="absolute left-0 right-0 top-1/2 h-px bg-slate-100"></div>
                        <div class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white shadow-sm" style="left:${posicionCum}%; background:${colorCum};"></div>
                        <span class="absolute top-1/2 font-mono font-semibold text-slate-800 whitespace-nowrap pointer-events-none"
                            style="left:${posicionCum}%; transform:${transformLabelCum}; font-size:10px; font-variant-numeric:tabular-nums; text-shadow:0 0 2px #ffffff, 0 0 2px #ffffff;">${this.escapeHtml(acumuladoTexto)}</span>
                    </div>
                </td>
            </tr>
        `;
    }
};

window.ChartRegistry['KardexClienteCont'] = window.ChartKardexClienteCont;

