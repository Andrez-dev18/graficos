/**
 * StockProvincias - Stock de Jabas por provincia.
 *
 * Resumen superior por provincia/codalmacen/item y detalle inferior por cliente/ítem.
 * La tabla superior filtra el detalle; no existe filtro inverso.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartStockProvincias = {
    containerRef: null,
    controllerRef: null,
    datosBackend: null,
    seleccion: [],
    detalle: [],
    _detalleVirtual: null,
    _formatter: null,
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.seleccion = [];
        this.detalle = [];
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
        return `${(Number(valor) * 100).toFixed(2)}%`;
    },

    _inicializarTooltip() {
        if (!this.tooltipEl) {
            this.tooltipEl = document.getElementById('stock-prov-tooltip');
            if (!this.tooltipEl) {
                this.tooltipEl = document.createElement('div');
                this.tooltipEl.id = 'stock-prov-tooltip';
                this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[350px] max-w-[520px] font-sans';
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

        contenedor.addEventListener('mouseover', event => {
            const objetivo = event.target.closest?.('[data-stock-tt]');
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
        });

        contenedor.addEventListener('mousemove', event => {
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            if (this.tooltipEl && !this.tooltipEl.classList.contains('hidden')) {
                this._posicionarTooltip();
            }
        });

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.('[data-stock-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        });
    },

    _formatearFechaTooltip() {
        const fecha = String(this.datosBackend?.fecha || '').trim();
        const partes = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        if (partes) {
            return `${Number(partes[3])} de ${meses[Number(partes[2]) - 1]} de ${partes[1]}`;
        }

        return String(this.datosBackend?.fecha_label || '').replace(/^[^,]+,?\s*/, '');
    },

    _formatearPorcentajeTooltip(valor) {
        if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '';
        return `${(Number(valor) * 100).toFixed(2).replace('.', ',')}%`;
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const indice = Number(elemento.dataset.stockIndex);
        const esDetalle = elemento.dataset.stockTt === 'detalle';
        const fila = esDetalle ? this.detalle[indice] : this.datosBackend?.filas?.[indice];
        if (!fila) return;

        const valor = campo => this.escapeHtml(fila[campo] ?? '');
        const cantidad = campo => this.escapeHtml(this.formatCantidad(fila[campo]));
        const indicador = this._formatearPorcentajeTooltip(fila.indicador);

        this.tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
                <span class="text-slate-500 font-normal whitespace-nowrap">Item:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('item')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">codalmacen:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('codalmacen')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">provincia:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('provincia')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">nomcliente:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${valor('nomcliente') || '—'}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Día de fechaproceso:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(this._formatearFechaTooltip())}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Saldo Inicial:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${cantidad('saldoinicial')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Jabas Distribuidas:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${cantidad('jabas_distribuidas')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Jabas Recogidas:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${cantidad('jabas_recogidas')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Saldo Final:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${cantidad('saldofinal')}</span>
                <span class="text-slate-500 font-normal whitespace-nowrap">Indicador.:</span>
                <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(indicador)}</span>
            </div>
        `;

        this.tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this.tooltipEl) return;

        const tooltipWidth = this.tooltipEl.offsetWidth || 380;
        const tooltipHeight = this.tooltipEl.offsetHeight || 190;
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

    claveFila(fila) {
        return [fila.provincia, fila.codalmacen, fila.coditem, fila.nomitem].join('\u001F');
    },

    estaSeleccionada(fila) {
        const clave = this.claveFila(fila);
        return this.seleccion.some(actual => this.claveFila(actual) === clave);
    },

    tieneSeleccion() {
        return this.seleccion.length > 0;
    },

    resumenSeleccion() {
        const n = this.seleccion.length;
        return `${n} ${n === 1 ? 'provincia seleccionada' : 'provincias seleccionadas'}`;
    },

    limpiarSeleccion() {
        this.seleccion = [];
        this.detalle = [];
        this.renderView();
        this.controllerRef?.actualizarChipFiltro?.();
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        const data = this.datosBackend || {};
        const filas = data.filas || [];

        if (!filas.length) {
            contenedor.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center">
                    <i class="fa-solid fa-store text-slate-300 text-4xl mb-3"></i>
                    <h3 class="text-sm font-bold text-slate-700">No se encontraron datos para Stock de Provincias</h3>
                    <p class="text-xs text-slate-400 mt-1">Ajuste la fecha, el almacén o los filtros seleccionados.</p>
                </div>
            `;
            return;
        }

        const total = data.total_general || {};
        const dominios = this.obtenerDominios(filas, 'resumen', total);
        const labelFecha = this.escapeHtml(data.fecha_label || data.fecha || '');

        contenedor.innerHTML = `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base font-bold text-slate-900 tracking-tight">Stock de Jabas - ${labelFecha}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Resumen por provincia y detalle de clientes</p>
                    </div>
                    <div class="text-[10px] font-semibold text-slate-500">
                        ${filas.length} provincias/ítems
                    </div>
                </div>
                <div class="overflow-auto custom-scrollbar" style="contain:layout paint;">
                    <table class="text-left border-collapse" style="table-layout:fixed; width:max(100%, 1500px); min-width:1500px;">
                        <colgroup>
                            <col style="width:136px;">
                            <col style="width:80px;">
                            <col style="width:284px;">
                            <col style="width:220px;">
                            <col style="width:220px;">
                            <col style="width:220px;">
                            <col style="width:180px;">
                            <col style="width:180px;">
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr>
                                <th class="px-2 py-2 text-[11px] font-bold border-r border-blue-500">provincia</th>
                                <th class="px-2 py-2 text-[11px] font-bold border-r border-blue-500">codalmacen</th>
                                <th class="px-2 py-2 text-[11px] font-bold border-r border-blue-500">Item</th>
                                <th class="px-2 py-2 text-[11px] font-bold text-center border-r border-blue-500">saldoinicial</th>
                                <th class="px-2 py-2 text-[11px] font-bold text-center border-r border-blue-500">Jabas Distribuidas</th>
                                <th class="px-2 py-2 text-[11px] font-bold text-center border-r border-blue-500">Jabas Recogidas</th>
                                <th class="px-2 py-2 text-[11px] font-bold text-center border-r border-blue-500">saldofinal</th>
                                <th class="px-2 py-2 text-[11px] font-bold text-center">Indicador</th>
                            </tr>
                        </thead>
                        <tbody id="stock-prov-body">
                            ${this.renderFilasResumen(filas, dominios)}
                        </tbody>
                        <tfoot class="sticky bottom-0" style="background:#f8fafc;">
                            <tr>
                                <td colspan="3" class="px-2 py-2 text-[10px] font-bold text-slate-600 border-t border-slate-200">Total general</td>
                                <td class="px-2 py-2 text-center border-t border-l border-slate-200">${this.renderMedida(total.saldoinicial, dominios.saldoinicial, '#59a14f', 'bar')}</td>
                                <td class="px-2 py-2 text-center border-t border-l border-slate-200">${this.renderMedida(total.jabas_distribuidas, dominios.jabas_distribuidas, '#e15759', 'square')}</td>
                                <td class="px-2 py-2 text-center border-t border-l border-slate-200">${this.renderMedida(total.jabas_recogidas, dominios.jabas_recogidas, '#4e79a7', 'square')}</td>
                                <td class="px-2 py-2 text-center border-t border-l border-slate-200">${this.renderMedida(total.saldofinal, dominios.saldofinal, '#000000', 'bar')}</td>
                                <td class="px-2 py-2 text-center border-t border-l border-slate-200">${this.renderIndicador(total.indicador, dominios.indicador)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <section class="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200">
                    <h2 class="text-base font-bold text-slate-900 tracking-tight">Detalle de Clientes</h2>
                    <p class="text-xs text-slate-500 mt-0.5">Seleccione una o varias provincias en el resumen superior</p>
                </div>
                <div id="stock-prov-detalle"></div>
            </section>
        `;

        this.renderDetalle();
        this.bindSeleccion();
    },

    pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

        return factor * base;
    },

    crearDominio(filas, campo, opciones = {}) {
        const valores = (filas || [])
            .map(fila => Number(fila?.[campo]))
            .filter(valor => Number.isFinite(valor));

        let min = valores.length ? Math.min(...valores) : 0;
        let max = valores.length ? Math.max(...valores) : 0;

        if (opciones.positivo) {
            min = 0;
            max = Math.max(0, max);
        } else {
            min = Math.min(0, min);
            max = Math.max(0, max);
        }

        if (min === max) {
            if (min === 0) {
                max = 1;
            } else if (min > 0) {
                min = 0;
            } else {
                max = 0;
            }
        }

        const objetivo = Math.max(1, Number(opciones.ticks) || 4);
        const paso = this.pasoBonito((max - min) / objetivo);
        let dominioMin = opciones.positivo ? 0 : Math.floor((min + paso * 1e-9) / paso) * paso;
        let dominioMax = Math.ceil((max - paso * 1e-9) / paso) * paso;

        if (!(dominioMax > dominioMin)) {
            dominioMax = dominioMin + paso;
        }

        return {
            min: Number(dominioMin.toPrecision(12)),
            max: Number(dominioMax.toPrecision(12)),
            paso
        };
    },

    obtenerDominios(filas, contexto = 'detalle', total = null) {
        const resumen = contexto === 'resumen';
        const filasSaldo = resumen && total
            ? filas.concat([{ saldoinicial: total.saldoinicial, saldofinal: total.saldofinal }])
            : filas;

        return {
            saldoinicial: this.crearDominio(filasSaldo, 'saldoinicial', { ticks: resumen ? 2 : 5 }),
            jabas_distribuidas: this.crearDominio(filas, 'jabas_distribuidas', {
                ticks: resumen ? 2 : 3,
                positivo: true
            }),
            jabas_recogidas: this.crearDominio(filas, 'jabas_recogidas', {
                ticks: resumen ? 2 : 3,
                positivo: true
            }),
            saldofinal: this.crearDominio(filasSaldo, 'saldofinal', { ticks: resumen ? 2 : 5 }),
            indicador: { min: 0, max: 1, paso: 0.2 }
        };
    },

    posicionDominio(valor, dominio) {
        const rango = Number(dominio?.max) - Number(dominio?.min);
        if (!(rango > 0)) return 0;

        const posicion = ((Number(valor) || 0) - Number(dominio.min)) / rango * 100;
        return Math.max(0, Math.min(100, posicion));
    },

    renderFilasResumen(filas, dominios) {
        return filas.map((fila, index) => {
            const seleccionada = this.estaSeleccionada(fila);
            const anterior = index > 0 ? filas[index - 1] : null;
            const mostrarProvincia = !anterior || anterior.provincia !== fila.provincia;
            const mostrarAlmacen = mostrarProvincia || anterior.codalmacen !== fila.codalmacen;
            return `
                <tr class="cursor-pointer hover:bg-blue-50/60 ${seleccionada ? 'bg-blue-100' : ''}"
                    data-stock-index="${index}" data-stock-tt="resumen" style="height:40px;">
                    <td class="px-2 py-1.5 text-[11px] font-semibold ${seleccionada ? 'text-blue-900' : 'text-slate-700'} border-r border-b border-slate-100">${mostrarProvincia ? this.escapeHtml(fila.provincia) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100">${mostrarAlmacen ? this.escapeHtml(fila.codalmacen) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.item)}">${this.escapeHtml(fila.item)}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.saldoinicial, dominios.saldoinicial, '#59a14f', 'bar')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.jabas_distribuidas, dominios.jabas_distribuidas, '#e15759', 'square')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.jabas_recogidas, dominios.jabas_recogidas, '#4e79a7', 'square')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.saldofinal, dominios.saldofinal, '#000000', 'bar')}</td>
                    <td class="px-2 py-1.5 border-b border-slate-100">${this.renderIndicador(fila.indicador, dominios.indicador)}</td>
                </tr>
            `;
        }).join('');
    },

    renderMedida(valor, dominio, color, tipo = 'bar') {
        const numero = Number(valor) || 0;
        const posicion = this.posicionDominio(numero, dominio);
        const cero = this.posicionDominio(0, dominio);
        const texto = this.formatCantidad(numero);
        const esCuadrado = tipo === 'square';
        const inicio = esCuadrado ? posicion : Math.min(posicion, cero);
        const ancho = esCuadrado ? 0 : Math.abs(posicion - cero);
        const finBarra = inicio + ancho;
        const etiquetaIzquierda = esCuadrado ? posicion > 78 : (numero < 0 || finBarra > 88);
        const puntoEtiqueta = esCuadrado ? posicion : (numero < 0 ? inicio : finBarra);
        const separacion = etiquetaIzquierda ? -6 : 6;
        const operador = separacion < 0 ? '-' : '+';
        const transformacion = etiquetaIzquierda ? 'translate(-100%, -50%)' : 'translate(0, -50%)';

        return `
            <div class="relative h-5 overflow-visible">
                <div class="absolute inset-y-0" style="left:38px; right:42px;">
                    ${esCuadrado
                        ? `<div class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2" style="left:${posicion}%; background:${color};"></div>`
                        : `<div class="absolute top-1/2 h-2.5 -translate-y-1/2" style="left:${inicio}%; width:${ancho}%; background:${color};"></div>`}
                    <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-slate-700"
                        style="left:calc(${puntoEtiqueta}% ${operador} ${Math.abs(separacion)}px); transform:${transformacion}; text-shadow:0 0 2px #ffffff, 0 0 3px #ffffff;">${texto}</span>
                </div>
            </div>
        `;
    },

    renderIndicador(valor, dominio = { min: 0, max: 1 }) {
        const numero = valor === null || valor === undefined ? null : Number(valor);
        if (numero === null || !Number.isFinite(numero)) {
            return '<div class="h-5"></div>';
        }

        const posicion = this.posicionDominio(numero, dominio);
        const color = this.colorIndicador(numero);
        const texto = this.formatPorcentaje(numero);
        const etiquetaIzquierda = posicion > 78;
        const separacion = etiquetaIzquierda ? -7 : 7;
        const operador = separacion < 0 ? '-' : '+';
        const transformacion = etiquetaIzquierda ? 'translate(-100%, -50%)' : 'translate(0, -50%)';

        return `
            <div class="relative h-5 overflow-visible">
                <div class="absolute inset-y-0" style="left:34px; right:44px;">
                    <span class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                        style="left:${posicion}%; background:${color};"></span>
                    <span class="absolute top-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-slate-700"
                        style="left:calc(${posicion}% ${operador} ${Math.abs(separacion)}px); transform:${transformacion}; text-shadow:0 0 2px #ffffff, 0 0 3px #ffffff;">${texto}</span>
                </div>
            </div>
        `;
    },

    colorIndicador(valor) {
        const t = Math.max(0, Math.min(1, Number(valor) || 0));
        const paradas = [
            [0, [163, 18, 58]],
            [1 / 6, [227, 63, 67]],
            [2 / 6, [248, 129, 107]],
            [0.5, [206, 215, 195]],
            [4 / 6, [115, 186, 103]],
            [5 / 6, [68, 145, 78]],
            [1, [36, 105, 61]]
        ];

        let indice = 1;
        while (indice < paradas.length && t > paradas[indice][0]) {
            indice++;
        }

        const [inicioT, inicioRgb] = paradas[Math.max(0, indice - 1)];
        const [finT, finRgb] = paradas[Math.min(paradas.length - 1, indice)];
        const factor = finT === inicioT ? 0 : (t - inicioT) / (finT - inicioT);
        const rgb = inicioRgb.map((canal, posicion) => Math.round(canal + (finRgb[posicion] - canal) * factor));

        return `rgb(${rgb.join(',')})`;
    },

    bindSeleccion() {
        const tbody = document.getElementById('stock-prov-body');
        if (!tbody) return;

        tbody.addEventListener('click', event => {
            const fila = event.target.closest?.('[data-stock-index]');
            if (!fila) return;

            const index = Number(fila.dataset.stockIndex);
            const item = (this.datosBackend?.filas || [])[index];
            if (!item) return;

            const clave = this.claveFila(item);
            const existe = this.seleccion.some(actual => this.claveFila(actual) === clave);

            if (event.ctrlKey || event.metaKey) {
                this.seleccion = existe
                    ? this.seleccion.filter(actual => this.claveFila(actual) !== clave)
                    : this.seleccion.concat([item]);
            } else if (this.seleccion.length === 1 && existe) {
                this.seleccion = [];
            } else {
                this.seleccion = [item];
            }

            this.renderView();
            this.controllerRef?.actualizarChipFiltro?.();
            this.controllerRef?.cargarDetalleStockProvincias?.(this.seleccion);
        });
    },

    actualizarDetalle(filas) {
        this.detalle = Array.isArray(filas) ? filas : [];
        this.renderDetalle();
    },

    renderDetalle() {
        const contenedor = document.getElementById('stock-prov-detalle');
        if (!contenedor) return;

        if (!this.seleccion.length) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Seleccione una provincia para ver el detalle.</div>`;
            this._detalleVirtual = null;
            return;
        }

        if (!this.detalle.length) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin detalle para la selección.</div>`;
            this._detalleVirtual = null;
            return;
        }

        contenedor.innerHTML = `
            <div id="stock-prov-det-scroll" class="overflow-auto custom-scrollbar" style="height:420px; contain:layout paint;">
                <table class="text-left border-collapse" style="table-layout:fixed; width:max(100%, 1600px); min-width:1600px;">
                    <colgroup>
                        <col style="width:130px;">
                        <col style="width:75px;">
                        <col style="width:260px;">
                        <col style="width:180px;">
                        <col style="width:200px;">
                        <col style="width:200px;">
                        <col style="width:200px;">
                        <col style="width:160px;">
                        <col style="width:160px;">
                    </colgroup>
                    <thead class="sticky top-0 z-30 bg-slate-100 text-slate-700">
                        <tr>
                            <th class="px-2 py-2 text-[10px] font-bold border-r border-slate-200">provincia</th>
                            <th class="px-2 py-2 text-[10px] font-bold border-r border-slate-200">codalmacen</th>
                            <th class="px-2 py-2 text-[10px] font-bold border-r border-slate-200">nomcliente</th>
                            <th class="px-2 py-2 text-[10px] font-bold border-r border-slate-200">Item</th>
                            <th class="px-2 py-2 text-[10px] font-bold text-center border-r border-slate-200">saldoinicial</th>
                            <th class="px-2 py-2 text-[10px] font-bold text-center border-r border-slate-200">Jabas Distribuidas</th>
                            <th class="px-2 py-2 text-[10px] font-bold text-center border-r border-slate-200">Jabas Recogidas</th>
                            <th class="px-2 py-2 text-[10px] font-bold text-center border-r border-slate-200">saldofinal</th>
                            <th class="px-2 py-2 text-[10px] font-bold text-center">Indicador</th>
                        </tr>
                    </thead>
                    <tbody id="stock-prov-det-body"></tbody>
                </table>
            </div>
        `;

        const scroll = document.getElementById('stock-prov-det-scroll');
        const tbody = document.getElementById('stock-prov-det-body');
        if (!scroll || !tbody) return;

        this._detalleVirtual = { scroll, tbody, start: -1, end: -1, raf: null };
        scroll.addEventListener('scroll', () => {
            const estado = this._detalleVirtual;
            if (!estado || estado.raf) return;
            estado.raf = requestAnimationFrame(() => {
                estado.raf = null;
                this.renderDetalleWindow();
            });
        }, { passive: true });

        this.renderDetalleWindow(true);
    },

    renderDetalleWindow(force = false) {
        const estado = this._detalleVirtual;
        if (!estado?.tbody || !estado?.scroll) return;

        const filas = this.detalle;
        const rowHeight = 34;
        const viewport = Math.max(estado.scroll.clientHeight || 0, 300);
        const start = Math.max(0, Math.floor(estado.scroll.scrollTop / rowHeight) - 8);
        const end = Math.min(filas.length, Math.ceil((estado.scroll.scrollTop + viewport) / rowHeight) + 8);

        if (!force && start === estado.start && end === estado.end) return;
        estado.start = start;
        estado.end = end;

        const dominios = this.obtenerDominios(filas, 'detalle');
        let html = '';

        if (start > 0) {
            html += `<tr aria-hidden="true"><td colspan="9" style="height:${start * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        for (let i = start; i < end; i++) {
            const fila = filas[i];
            const anterior = i > 0 ? filas[i - 1] : null;
            const mostrarProvincia = !anterior || anterior.provincia !== fila.provincia;
            const mostrarAlmacen = mostrarProvincia || anterior.codalmacen !== fila.codalmacen;
            html += `
                <tr style="height:${rowHeight}px;" data-stock-tt="detalle" data-stock-index="${i}">
                    <td class="px-2 py-1.5 text-[10px] font-semibold text-slate-700 border-r border-b border-slate-100">${mostrarProvincia ? this.escapeHtml(fila.provincia) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100">${mostrarAlmacen ? this.escapeHtml(fila.codalmacen) : ''}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.nomcliente)}">${this.escapeHtml(fila.nomcliente)}</td>
                    <td class="px-2 py-1.5 text-[10px] text-slate-600 border-r border-b border-slate-100 truncate" title="${this.escapeHtml(fila.item)}">${this.escapeHtml(fila.item)}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.saldoinicial, dominios.saldoinicial, '#59a14f', 'bar')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.jabas_distribuidas, dominios.jabas_distribuidas, '#e15759', 'square')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.jabas_recogidas, dominios.jabas_recogidas, '#4e79a7', 'square')}</td>
                    <td class="px-2 py-1.5 border-r border-b border-slate-100">${this.renderMedida(fila.saldofinal, dominios.saldofinal, '#000000', 'bar')}</td>
                    <td class="px-2 py-1.5 border-b border-slate-100">${this.renderIndicador(fila.indicador, dominios.indicador)}</td>
                </tr>
            `;
        }

        if (end < filas.length) {
            html += `<tr aria-hidden="true"><td colspan="9" style="height:${(filas.length - end) * rowHeight}px;padding:0;border:0;line-height:0;"></td></tr>`;
        }

        estado.tbody.innerHTML = html;
    }
};

window.ChartRegistry['StockProvincias'] = window.ChartStockProvincias;
