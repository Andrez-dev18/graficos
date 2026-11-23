window.ChartRegistry = window.ChartRegistry || {};

window.ChartConsumoLimaDashAnalisis = {
    controllerRef: null,
    containerRef: null,
    datos: {},
    _formatter: null,
    tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,
    _paginationBound: false,

    _config: {
        consumos: {
            titulo: 'Analisis Almacen (Consumos )',
            color: '#499894',
            medidas: ['valor', 'peso', 'pu']
        },
        compras_almacen: {
            titulo: 'Analisis Almacen (Compra)',
            color: '#4e79a7',
            medidas: ['valor', 'peso', 'cantidad', 'pu']
        },
        compras_documentos: {
            titulo: 'Documentos de Compras',
            color: '#b6992d',
            medidas: ['importe_soles', 'importe_dolares', 'peso', 'cantidad', 'pu_soles', 'pu_dolares', 'tc']
        }
    },

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datos = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-dash-analisis');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._bindPaginationEvents();
        this.renderView();
    },

    actualizarTabla(tipo, payload) {
        this.datos[tipo] = payload;
        this._ocultarTooltip();

        const card = document.getElementById(`consumo-card-${tipo}`);
        if (!card) {
            this.renderView();
            return;
        }

        card.outerHTML = this._renderCard(tipo);
        const scroll = document.querySelector(`#consumo-card-${tipo} .custom-scrollbar`);
        if (scroll) scroll.scrollTop = 0;
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
        if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '';

        if (!this._formatter) {
            this._formatter = {};
        }

        const key = String(decimales);
        if (!this._formatter[key]) {
            this._formatter[key] = new Intl.NumberFormat('es-ES', {
                minimumFractionDigits: decimales,
                maximumFractionDigits: decimales
            });
        }

        return this._formatter[key].format(Number(valor));
    },

    formatMoney(valor, moneda = 'S/', decimales = 2) {
        if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '';
        const numero = Number(valor);
        const absoluto = this.formatNumber(Math.abs(numero), decimales);
        return numero < 0 ? `-${moneda} ${absoluto}` : `${moneda} ${absoluto}`;
    },

    formatPeso(valor) {
        if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '';
        const numero = Number(valor);
        return numero < 0
            ? `-${this.formatNumber(Math.abs(numero), 2)} Kg`
            : `${this.formatNumber(numero, 2)} Kg`;
    },

    formatCantidad(valor) {
        if (valor === null || valor === undefined || valor === '' || Number.isNaN(Number(valor))) return '';
        const numero = Number(valor);
        return numero < 0
            ? `-${this.formatNumber(Math.abs(numero), 2)} Und`
            : `${this.formatNumber(numero, 2)} Und`;
    },

    formatDocumento(valor) {
        if (valor === null || valor === undefined || valor === '') return '';
        const numero = Number(valor);
        return Number.isNaN(numero) ? String(valor) : String(Math.trunc(numero));
    },

    formatFecha(valor) {
        return String(valor || '').replace(/-/g, '/');
    },

    formatMedida(medida, valor) {
        switch (medida) {
            case 'valor':
            case 'importe_soles':
                return this.formatMoney(valor, 'S/', 2);
            case 'importe_dolares':
            case 'pu_dolares':
                return this.formatMoney(valor, 'US$', 2);
            case 'peso':
                return this.formatPeso(valor);
            case 'cantidad':
                return this.formatCantidad(valor);
            case 'pu':
                return this.formatMoney(valor, 'S/', 3);
            case 'pu_soles':
                return this.formatMoney(valor, 'S/', 2);
            case 'tc':
                return this.formatMoney(valor, 'S/', 3);
            default:
                return this.formatNumber(valor, 2);
        }
    },

    _pasoBonito(valor) {
        const seguro = Math.max(Math.abs(Number(valor) || 0), Number.EPSILON);
        const exponente = Math.floor(Math.log10(seguro));
        const base = Math.pow(10, exponente);
        const fraccion = seguro / base;
        const factor = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

        return factor * base;
    },

    _crearEjesDocumentos(payload) {
        const maximos = payload.maximos || {};
        const filas = Array.isArray(payload.filas) ? payload.filas : [];
        const medidas = this._config.compras_documentos.medidas;
        const ejes = {};

        medidas.forEach(medida => {
            let maximo = Number(maximos[medida] || 0);

            if (maximo <= 0) {
                maximo = Math.max(1, ...filas.map(fila => Math.max(0, Number(fila[medida]) || 0)));
            }

            const paso = Math.max(1, Math.ceil(this._pasoBonito(maximo / 3)));
            const maxAxis = Math.max(paso, Math.ceil(maximo / paso) * paso);
            const ticks = [];

            for (let valor = 0; valor <= maxAxis + (paso / 2); valor += paso) {
                ticks.push(Math.round(valor * 100) / 100);
            }

            ejes[medida] = { maxAxis, paso, ticks };
        });

        return ejes;
    },

    _formatearEjeDocumento(valor, medida) {
        const numero = Number(valor) || 0;
        const absoluto = Math.abs(numero);

        if (['importe_soles', 'importe_dolares', 'peso', 'cantidad'].includes(medida)) {
            if (absoluto >= 1000000) {
                const escalado = numero / 1000000;
                return `${this.formatNumber(escalado, Number.isInteger(escalado) ? 0 : 1)}M`;
            }
            if (absoluto >= 1000) {
                const escalado = numero / 1000;
                return `${this.formatNumber(escalado, Number.isInteger(escalado) ? 0 : 1)}K`;
            }
        }

        return this.formatNumber(numero, Number.isInteger(numero) ? 0 : 1);
    },

    _celdaDocumento(fila, indice, medida, eje) {
        const valor = Number(fila[medida]);
        const maxAxis = Math.max(1, Number(eje?.maxAxis) || 1);
        const etiqueta = this.formatMedida(medida, fila[medida]);

        if (!etiqueta) {
            return '<td class="px-1 py-1 border-r border-slate-100"></td>';
        }

        const proporcion = Number.isFinite(valor) && valor > 0
            ? Math.min(1, valor / maxAxis)
            : 0;
        const ancho = proporcion * 100;
        const etiquetaIzquierda = ancho > 72;
        const estiloEtiqueta = etiquetaIzquierda
            ? `right:calc(${100 - ancho}% + 4px);`
            : `left:calc(${ancho}% + 4px);`;

        return `
            <td class="px-1 py-1 border-r border-slate-100">
                <div class="relative h-5">
                    ${ancho > 0
                        ? `<div class="absolute left-0 top-1/2 h-2 -translate-y-1/2" style="width:${ancho}%;background:#59a14f;opacity:.88;"></div>`
                        : ''}
                    <span class="absolute top-1/2 whitespace-nowrap font-mono text-[9px] font-semibold text-slate-700"
                        style="${estiloEtiqueta}transform:translateY(-50%);text-shadow:0 0 2px #fff,0 0 2px #fff;">${this.escapeHtml(etiqueta)}</span>
                </div>
            </td>
        `;
    },

    _inicializarTooltip() {
        if (!this.tooltipEl) {
            this.tooltipEl = document.getElementById('consumo-lima-tooltip');
            if (!this.tooltipEl) {
                this.tooltipEl = document.createElement('div');
                this.tooltipEl.id = 'consumo-lima-tooltip';
                this.tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[360px] max-w-[500px] font-sans';
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
            const objetivo = event.target.closest?.('[data-consumo-tt]');
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
            const objetivo = event.target.closest?.('[data-consumo-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
        }, { signal });
    },

    _bindPaginationEvents() {
        if (this._paginationBound || !this.containerRef) return;
        this._paginationBound = true;

        this.containerRef.addEventListener('click', event => {
            const boton = event.target.closest?.('[data-consumo-page]');
            if (!boton || boton.disabled) return;

            const tipo = boton.dataset.consumoTipo;
            const page = Number(boton.dataset.consumoPage);
            this.controllerRef?.cambiarPagina?.(tipo, page);
        });
    },

    _mostrarTooltip(elemento) {
        if (!this.tooltipEl) return;

        const tipo = elemento.dataset.consumoTipo;
        const indice = Number(elemento.dataset.consumoIndex);
        const fila = this.datos?.[tipo]?.filas?.[indice];
        if (!fila) return;

        const campos = this._camposTooltip(tipo, fila);
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

    _camposTooltip(tipo, fila) {
        if (tipo === 'compras_documentos') {
            return [
                ['CodProveedor', fila.codproveedor],
                ['Amarre', fila.amarre],
                ['NroDocumento', this.formatDocumento(fila.documento)],
                ['NomProveedor', fila.nomproveedor],
                ['dglosa', fila.dglosa === '*' ? '*' : fila.dglosa],
                ['Cantidad', this.formatCantidad(fila.cantidad)],
                ['ImporteDolares', this.formatMoney(fila.importe_dolares, 'US$', 2)],
                ['ImporteSoles', this.formatMoney(fila.importe_soles, 'S/', 2)],
                ['Peso', this.formatPeso(fila.peso)],
                ['PU Soles', this.formatMoney(fila.pu_soles, 'S/', 2)],
                ['PU Dolares', this.formatMoney(fila.pu_dolares, 'US$', 2)],
                ['TC', this.formatMoney(fila.tc, 'S/', 3)]
            ];
        }

        const campos = [
            ['Día de fechaproceso', this.formatFecha(fila.fecha)],
            ['CodArticulo', fila.codigo],
            ['NomArticulo', fila.descripcion],
            ['lote', fila.lote],
            ['Transaccion', fila.transaccion],
            ['NroDocumento', this.formatDocumento(fila.documento)],
            ['Valor', this.formatMoney(fila.valor, 'S/', 2)]
        ];

        if (tipo === 'compras_almacen') {
            campos.push(['Cantidad', this.formatCantidad(fila.cantidad)]);
        }

        campos.push(['Peso', this.formatPeso(fila.peso)]);
        campos.push(['PU', this.formatMoney(fila.pu, 'S/', 3)]);
        return campos;
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

    _calcularRowspansDocumentos(filas) {
        const spans = {};
        let indice = 0;

        while (indice < filas.length) {
            const fila = filas[indice];
            let fin = indice + 1;

            while (
                fin < filas.length
                && filas[fin].documento === fila.documento
                && filas[fin].codproveedor === fila.codproveedor
                && filas[fin].nomproveedor === fila.nomproveedor
            ) {
                fin++;
            }

            spans[indice] = fin - indice;
            indice = fin;
        }

        return spans;
    },

    _celda(texto, clase = '') {
        return `<td class="px-2 py-1 border-r border-slate-100 text-[10px] text-slate-600 ${clase}">${texto}</td>`;
    },

    _tablaConsumos(tipo) {
        const config = this._config[tipo];
        const payload = this.datos[tipo] || { filas: [], total: 0, page: 1, page_size: 50, total_paginas: 0 };
        const filas = Array.isArray(payload.filas) ? payload.filas : [];
        const esComprasAlmacen = tipo === 'compras_almacen';
        const columnas = 6 + config.medidas.length;
        const rowspans = {};
        const body = filas.length
            ? filas.map((fila, indice) => {
                const celdasMedidas = config.medidas.map(medida => {
                    const valor = this.formatMedida(medida, fila[medida]);
                    return `<td class="px-2 py-1 border-r border-slate-100 text-right font-mono text-[10px] whitespace-nowrap">${this.escapeHtml(valor)}</td>`;
                }).join('');

                return `
                    <tr class="hover:bg-blue-50/40" data-consumo-tt="1" data-consumo-tipo="${tipo}" data-consumo-index="${indice}">
                        ${this._celda(this.escapeHtml(this.formatFecha(fila.fecha)), 'whitespace-nowrap text-slate-500')}
                        ${this._celda(this.escapeHtml(fila.codigo), 'font-mono whitespace-nowrap')}
                        ${this._celda(this.escapeHtml(fila.descripcion), 'truncate')}
                        ${this._celda(this.escapeHtml(fila.lote), 'font-mono whitespace-nowrap')}
                        ${this._celda(this.escapeHtml(fila.transaccion), 'text-center font-mono whitespace-nowrap')}
                        ${this._celda(this.escapeHtml(this.formatDocumento(fila.documento)), 'font-mono whitespace-nowrap')}
                        ${celdasMedidas}
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="${columnas}" class="px-3 py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</td></tr>`;

        const medidas = config.medidas.map(medida => {
            const titulos = {
                valor: 'Valor',
                peso: 'Peso',
                cantidad: 'Cantidad',
                pu: 'PU'
            };
            return `<th class="px-2 py-1.5 text-right text-[9px] font-bold text-white border-r border-blue-500 whitespace-nowrap">${titulos[medida] || medida}</th>`;
        }).join('');

        return `
            <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:${esComprasAlmacen ? 780 : 700}px;">
                    <colgroup>
                        <col style="width:74px;">
                        <col style="width:68px;">
                        <col style="width:120px;">
                        <col style="width:66px;">
                        <col style="width:36px;">
                        <col style="width:80px;">
                        ${config.medidas.map(medida => `<col style="width:${medida === 'pu' ? 76 : 88}px;">`).join('')}
                    </colgroup>
                    <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                        <tr>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            <th class="px-2 py-1.5 border-r border-blue-500"></th>
                            ${medidas}
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        `;
    },

    _tablaDocumentos() {
        const payload = this.datos.compras_documentos || { filas: [], total: 0, page: 1, page_size: 50, total_paginas: 0 };
        const filas = Array.isArray(payload.filas) ? payload.filas : [];
        const rowspans = this._calcularRowspansDocumentos(filas);
        const medidas = this._config.compras_documentos.medidas;
        const ejes = this._crearEjesDocumentos(payload);
        const titulos = {
            importe_soles: 'ImporteSoles',
            importe_dolares: 'ImporteDolares',
            peso: 'Peso',
            cantidad: 'Cantidad',
            pu_soles: 'PU Soles',
            pu_dolares: 'PU Dolares',
            tc: 'TC'
        };

        const body = filas.length
            ? filas.map((fila, indice) => {
                const iniciaGrupo = rowspans[indice];
                const celdasMedidas = medidas.map(medida => this._celdaDocumento(fila, indice, medida, ejes[medida])).join('');

                return `
                    <tr class="hover:bg-blue-50/40" data-consumo-tt="1" data-consumo-tipo="compras_documentos" data-consumo-index="${indice}">
                        ${iniciaGrupo
                            ? `<td rowspan="${iniciaGrupo}" class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono text-slate-600 align-top">${this.escapeHtml(this.formatDocumento(fila.documento))}</td>
                               <td rowspan="${iniciaGrupo}" class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono text-slate-600 align-top">${this.escapeHtml(fila.codproveedor)}</td>
                               <td rowspan="${iniciaGrupo}" class="px-2 py-1 border-r border-slate-100 text-[10px] text-slate-600 align-top truncate" title="${this.escapeHtml(fila.nomproveedor)}">${this.escapeHtml(fila.nomproveedor)}</td>`
                            : ''}
                        <td class="px-2 py-1 border-r border-slate-100 text-[10px] font-mono text-slate-600 whitespace-nowrap">${this.escapeHtml(fila.amarre)}</td>
                        ${celdasMedidas}
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="${4 + medidas.length}" class="px-3 py-8 text-center text-xs text-slate-400">Sin datos para los filtros seleccionados.</td></tr>`;

        const cabecerasMedidas = medidas.map(medida => `
            <th class="px-2 py-1.5 text-right text-[9px] font-bold text-white border-r border-blue-500 whitespace-nowrap">${titulos[medida]}</th>
        `).join('');

        const footerMedidas = medidas.map(medida => {
            const eje = ejes[medida];
            const ticks = eje.ticks.map(tick => {
                const left = eje.maxAxis > 0 ? (tick / eje.maxAxis) * 100 : 0;
                const transform = tick === 0 ? 'translate(0, 0)' : (tick === eje.maxAxis ? 'translate(-100%, 0)' : 'translate(-50%, 0)');
                return `<span class="absolute top-0 font-mono text-[7px] text-slate-500" style="left:${left}%;transform:${transform};">${this._formatearEjeDocumento(tick, medida)}</span>`;
            }).join('');

            return `
                <td class="px-1 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;z-index:30;background:#fff;">
                    <div class="relative h-3">${ticks}</div>
                    <div class="mt-0.5 text-center text-[7px] font-semibold text-slate-500 whitespace-nowrap">${titulos[medida]}</div>
                </td>
            `;
        }).join('');

        return `
            <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                <table class="w-full text-left border-collapse" style="table-layout:fixed;min-width:1130px;">
                    <colgroup>
                        <col style="width:64px;">
                        <col style="width:96px;">
                        <col style="width:250px;">
                        <col style="width:80px;">
                        ${medidas.map(() => '<col style="width:96px;">').join('')}
                    </colgroup>
                    <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                        <tr>
                            <th class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">NroDocumento</th>
                            <th class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">CodProveedor</th>
                            <th class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">NomProveedor</th>
                            <th class="px-2 py-1.5 text-left text-[9px] font-bold border-r border-blue-500 whitespace-nowrap">Amarre</th>
                            ${cabecerasMedidas}
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="px-1 pt-1 pb-1 border-t border-slate-200" style="position:sticky;bottom:0;left:0;z-index:31;background:#fff;"></td>
                            ${footerMedidas}
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    },

    _renderPaginacion(tipo, payload) {
        const total = Number(payload.total || 0);
        const page = Number(payload.page || 1);
        const pageSize = Number(payload.page_size || 50);
        const totalPaginas = Number(payload.total_paginas || 0);
        const desde = total > 0 ? ((page - 1) * pageSize) + 1 : 0;
        const hasta = total > 0 ? Math.min(page * pageSize, total) : 0;
        const anterior = Math.max(1, page - 1);
        const siguiente = Math.min(totalPaginas || 1, page + 1);

        return `
            <div class="shrink-0 px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                <span>Mostrando ${total ? `${desde}–${hasta}` : '0'} de ${total.toLocaleString('es-PE')}</span>
                <div class="flex items-center gap-1.5">
                    <button type="button" data-consumo-page="${anterior}" data-consumo-tipo="${tipo}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page <= 1 || totalPaginas === 0 ? 'disabled' : ''}>‹</button>
                    <span class="px-1 font-semibold text-slate-600">Página ${totalPaginas ? page : 0} de ${totalPaginas}</span>
                    <button type="button" data-consumo-page="${siguiente}" data-consumo-tipo="${tipo}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page >= totalPaginas || totalPaginas === 0 ? 'disabled' : ''}>›</button>
                </div>
            </div>
        `;
    },

    _renderCard(tipo) {
        const config = this._config[tipo];
        const payload = this.datos[tipo] || { filas: [], total: 0, page: 1, page_size: 50, total_paginas: 0 };
        const esDocumentos = tipo === 'compras_documentos';
        const total = Number(payload.total || 0);

        return `
            <section id="consumo-card-${tipo}" class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col min-h-0 ${esDocumentos ? 'xl:col-span-2' : ''}">
                <div class="shrink-0 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                    <h2 class="text-[12px] font-bold tracking-tight" style="color:${config.color};">${config.titulo}</h2>
                    <span class="text-[9px] font-semibold text-slate-400">${total.toLocaleString('es-PE')} registros</span>
                </div>
                ${esDocumentos ? this._tablaDocumentos() : this._tablaConsumos(tipo)}
                ${this._renderPaginacion(tipo, payload)}
            </section>
        `;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        contenedor.innerHTML = `
            <div class="grid h-full min-h-0 grid-cols-1 xl:grid-cols-2 xl:grid-rows-2 gap-3">
                ${this._renderCard('consumos')}
                ${this._renderCard('compras_almacen')}
                ${this._renderCard('compras_documentos')}
            </div>
        `;
    }
};

window.ChartRegistry['DashAnalisis'] = window.ChartConsumoLimaDashAnalisis;
