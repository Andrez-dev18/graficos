window.ChartRegistry = window.ChartRegistry || {};

window.ChartTabulacionesPu = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    seleccionesConsumos: [],
    _selectionBound: false,
    _tooltipEl: null,
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
        this.seleccionesConsumos = [];
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-dash-analisis');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._bindSelectionEvents();
        this.renderView();
    },

    _claveBarra(serie, barra) {
        return [
            serie?.descripcion || '',
            serie?.transaccion || '',
            barra?.fecha || '',
            barra?.lote || ''
        ].join('|');
    },

    _barraSeleccionada(serie, barra) {
        const clave = this._claveBarra(serie, barra);
        return this.seleccionesConsumos.some(item => item.clave === clave);
    },

    _seleccionarBarra(serie, barra, conCtrl) {
        const clave = this._claveBarra(serie, barra);
        const existe = this.seleccionesConsumos.some(item => item.clave === clave);
        let selecciones;

        if (conCtrl) {
            selecciones = existe
                ? this.seleccionesConsumos.filter(item => item.clave !== clave)
                : this.seleccionesConsumos.concat([{ clave }]);
        } else {
            selecciones = existe && this.seleccionesConsumos.length === 1 ? [] : [{ clave }];
        }

        this.seleccionesConsumos = selecciones;
        this.renderView();
    },

    _bindSelectionEvents() {
        if (this._selectionBound || !this.containerRef) return;
        this._selectionBound = true;

        this.containerRef.addEventListener('click', event => {
            const limpiar = event.target.closest?.('[data-pu-clear]');
            if (limpiar) {
                this.seleccionesConsumos = [];
                this.renderView();
                return;
            }

            const barraEl = event.target.closest?.('[data-pu-select]');
            if (!barraEl) return;

            const serieIndice = Number(barraEl.dataset.puSerie);
            const barraIndice = Number(barraEl.dataset.puBarra);
            const serie = this.datos?.consumos?.[serieIndice];
            const barra = serie?.barras?.[barraIndice];
            if (!serie || !barra) return;

            this._seleccionarBarra(serie, barra, event.ctrlKey || event.metaKey);
        });
    },

    escapeHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatNumber(valor, decimales = 2) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        }).format(numero);
    },

    formatPU(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';
        return `S/ ${this.formatNumber(numero, 3)}`;
    },

    formatFecha(valor) {
        return String(valor || '').replace(/-/g, '/');
    },

    _pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;
        return factor * base;
    },

    _ejePu(maximo, tipo, filtrado = false) {
        const max = Math.max(0.01, Number(maximo) || 0.01);
        let paso;
        let maxAxis;

        if ((tipo === 'consumos' || filtrado) && max <= 1.2) {
            paso = 0.2;
            maxAxis = Math.max(1.2, Math.ceil(max / paso) * paso);
        } else {
            paso = Math.max(0.1, this._pasoBonito(max / 4));
            maxAxis = Math.ceil(max / paso) * paso;
            if (tipo === 'compras' && !filtrado) {
                maxAxis = Math.max(2, maxAxis);
            }
        }

        const ticks = [];
        for (let valor = 0; valor <= maxAxis + (paso / 2); valor += paso) {
            ticks.push(Math.round(valor * 10000) / 10000);
        }

        return { maxAxis, paso, ticks };
    },

    _inicializarTooltip() {
        if (!this._tooltipEl) {
            this._tooltipEl = document.getElementById('consumo-lima-pu-tooltip');
            if (!this._tooltipEl) {
                this._tooltipEl = document.createElement('div');
                this._tooltipEl.id = 'consumo-lima-pu-tooltip';
                this._tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[320px] max-w-[460px] font-sans';
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
            const objetivo = event.target.closest?.('[data-pu-tt]');
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
            const objetivo = event.target.closest?.('[data-pu-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _mostrarTooltip(elemento) {
        if (!this._tooltipEl) return;

        const tipo = elemento.dataset.puTipo;
        const serieIndice = Number(elemento.dataset.puSerie);
        const barraIndice = Number(elemento.dataset.puBarra);
        const serie = this.datos?.[tipo]?.[serieIndice];
        const barra = serie?.barras?.[barraIndice];
        if (!serie || !barra) return;

        const campos = [
            ['NomArticulo', serie.descripcion],
            ['Transaccion', serie.transaccion],
            ['LoteArticulo', barra.lote],
            ['Día de fechaproceso', this.formatFecha(barra.fecha)],
            ['Valor', `S/ ${this.formatNumber(barra.valor, 3)}`],
            ['Peso', `${this.formatNumber(barra.peso, 2)} Kg`],
            ['PU', this.formatPU(barra.pu)]
        ];

        this._tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans leading-snug">
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

    _columnas(series) {
        const mapa = new Map();

        series.forEach(serie => {
            (serie.barras || []).forEach(barra => {
                const clave = `${barra.fecha}|${barra.lote}`;
                if (!mapa.has(clave)) {
                    mapa.set(clave, { clave, fecha: barra.fecha, lote: barra.lote });
                }
            });
        });

        return [...mapa.values()].sort((a, b) => {
            if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
            return a.lote.localeCompare(b.lote);
        });
    },

    _lineasGrid(eje) {
        return eje.ticks.map(tick => {
            const bottom = eje.maxAxis > 0 ? (tick / eje.maxAxis) * 100 : 0;
            return `<div class="absolute left-0 right-0 border-t border-slate-200" style="bottom:${bottom}%;"></div>`;
        }).join('');
    },

    _etiquetasEje(eje) {
        return eje.ticks.map(tick => {
            const bottom = eje.maxAxis > 0 ? (tick / eje.maxAxis) * 100 : 0;
            return `<div class="absolute right-1 text-[10.5px] font-mono text-slate-600" style="bottom:calc(${bottom}% - 7px);">${this.formatNumber(tick, 1)}</div>`;
        }).join('');
    },

    _filaSerie(serie, serieIndice, tipo, columnas, eje, mostrarDescripcion, altura) {
        const mapaBarras = new Map((serie.barras || []).map((barra, indice) => [
            `${barra.fecha}|${barra.lote}`,
            { barra, indice }
        ]));

        const columnasHtml = columnas.map(columna => {
            const item = mapaBarras.get(columna.clave);
            if (!item || !Number.isFinite(Number(item.barra.pu))) {
                return '<div class="flex items-end justify-center"></div>';
            }

            const barra = item.barra;
            const altura = Math.max(0, Math.min(100, (Number(barra.pu) / eje.maxAxis) * 100));
            const seleccionable = tipo === 'consumos';
            const haySeleccion = seleccionable && this.seleccionesConsumos.length > 0;
            const activa = seleccionable && this._barraSeleccionada(serie, barra);
            const color = seleccionable && haySeleccion && !activa ? '#cbd5e1' : '#4e79a7';
            const attrs = seleccionable
                ? `data-pu-select="1" data-pu-serie="${serieIndice}" data-pu-barra="${item.indice}"`
                : '';

            return `
                <div class="relative flex items-end justify-center h-full">
                    <div class="relative w-[16px] ${seleccionable ? 'cursor-pointer' : 'cursor-default'}" style="height:${altura}%;background:${color};"
                        ${attrs}
                        data-pu-tt="1" data-pu-tipo="${tipo}" data-pu-serie="${serieIndice}" data-pu-barra="${item.indice}">
                        <span class="absolute left-1/2 whitespace-nowrap font-mono text-[10.5px] font-semibold text-slate-700"
                            style="bottom:calc(100% + 4px);transform:translateX(-50%) rotate(-90deg);transform-origin:bottom center;text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.formatPU(barra.pu)}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="flex min-w-0" style="min-width:${216 + columnas.length * 30}px;">
                <div class="w-[160px] shrink-0 px-2 pt-2 text-[11.5px] font-semibold leading-tight text-slate-700 text-right">
                    ${mostrarDescripcion ? this.escapeHtml(serie.descripcion) : ''}
                    <span class="block text-[10.5px] font-normal text-slate-500">${this.escapeHtml(serie.transaccion)}</span>
                </div>
                <div class="w-[56px] shrink-0 relative" style="height:${altura}px;">
                    <span class="absolute left-0 top-0 text-[10.5px] font-semibold text-slate-500">PU</span>
                    <div class="absolute inset-y-0 right-0">
                        ${this._etiquetasEje(eje)}
                    </div>
                </div>
                <div class="flex-1 min-w-0 relative" style="height:${altura}px;">
                    ${this._lineasGrid(eje)}
                    <div class="relative grid h-full items-end" style="grid-template-columns:repeat(${columnas.length},minmax(30px,1fr));">
                        ${columnasHtml}
                    </div>
                </div>
            </div>
        `;
    },

    _etiquetasColumnas(columnas) {
        return `
            <div class="flex min-w-0" style="min-width:${216 + columnas.length * 30}px;position:sticky;bottom:0;z-index:20;background:#fff;border-top:1px solid #e2e8f0;">
                <div class="w-[160px] shrink-0"></div>
                <div class="w-[56px] shrink-0"></div>
                <div class="flex-1 min-w-0 grid" style="grid-template-columns:repeat(${columnas.length},minmax(30px,1fr));">
                    ${columnas.map(columna => `
                        <div class="h-[82px] flex justify-center pt-1">
                            <span class="text-[10.5px] text-slate-600 font-mono font-medium whitespace-nowrap"
                                style="writing-mode:vertical-rl;transform:rotate(180deg);">${this.escapeHtml(columna.lote)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _comprasFiltradas() {
        const compras = Array.isArray(this.datos?.compras) ? this.datos.compras : [];

        if (!this.seleccionesConsumos.length) {
            return compras;
        }

        const claves = new Set(this.seleccionesConsumos.map(item => item.clave));

        return compras.map(serie => {
            const barras = (serie.barras || []).filter(barra => claves.has(this._claveBarra(serie, barra)));
            return barras.length ? { ...serie, barras } : null;
        }).filter(Boolean);
    },

    _chipSeleccion() {
        if (!this.seleccionesConsumos.length) return '';

        return `
            <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-[10px]">
                <span class="font-semibold"><i class="fa-solid fa-filter mr-1.5"></i>Filtro cruzado: ${this.seleccionesConsumos.length} barra${this.seleccionesConsumos.length === 1 ? '' : 's'} seleccionada${this.seleccionesConsumos.length === 1 ? '' : 's'}</span>
                <button type="button" data-pu-clear="1"
                    class="px-2 py-1 rounded border border-blue-200 bg-white/70 hover:bg-white font-bold text-blue-700 cursor-pointer">
                    Quitar filtro
                </button>
            </div>
        `;
    },

    _renderPanel(tipo, titulo, color, seriesOverride = null, filtrado = false) {
        const series = Array.isArray(seriesOverride)
            ? seriesOverride
            : (Array.isArray(this.datos?.[tipo]) ? this.datos[tipo] : []);
        const barras = series.flatMap(serie => serie.barras || []);
        const maxPu = barras.reduce((max, barra) => Math.max(max, Number(barra.pu) || 0), 0);
        const eje = this._ejePu(maxPu, tipo, filtrado);
        const columnas = this._columnas(series);

        const altura = tipo === 'consumos'
            ? 170
            : (series.length >= 4 ? 96 : 118);

        const contenido = series.length && columnas.length
            ? series.map((serie, indice) => this._filaSerie(
                serie,
                indice,
                tipo,
                columnas,
                eje,
                indice === 0 || series[indice - 1]?.descripcion !== serie.descripcion,
                altura
            )).join('')
            : '<div class="p-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</div>';

        return `
            <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col min-h-0 overflow-hidden">
                <div class="shrink-0 px-4 py-2 border-b border-slate-200">
                    <h2 class="text-[13px] font-bold tracking-tight" style="color:${color};">${this.escapeHtml(titulo)}</h2>
                </div>
                <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <div class="w-full min-w-0 px-3 pt-3 pb-1">
                        ${contenido}
                        ${series.length && columnas.length ? this._etiquetasColumnas(columnas) : ''}
                    </div>
                </div>
            </section>
        `;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        contenedor.innerHTML = `
            <div class="flex h-full min-h-0 flex-col gap-1">
                ${this._chipSeleccion()}
                <div class="grid flex-1 min-h-0 grid-rows-[minmax(0,0.9fr)_minmax(0,1.5fr)] gap-1">
                    ${this._renderPanel('consumos', 'TABULACION DE CONSUMOS', '#499894')}
                    ${this._renderPanel(
                        'compras',
                        'TABULACION DE INGRESOS DE COMPRA',
                        '#4e79a7',
                        this._comprasFiltradas(),
                        this.seleccionesConsumos.length > 0
                    )}
                </div>
            </div>
        `;
    }
};

window.ChartRegistry['TabulacionesPU'] = window.ChartTabulacionesPu;

