/**
 * Componente visual - Control de Clientes
 * Vistas: ParetoCorporativos / ParetoCorporativosZona / ParetoCorporativosSubZona.
 * Tres paneles de barras (unidades, kilos y soles) con etiquetas jerárquicas.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartControlClientesPareto = {
    tooltipId: 'control-clientes-pareto-tooltip',

    destroy() {
        this.ocultarTooltip();
    },

    formatNumero(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatKilos(num) {
        return this.formatNumero(num, 2) + ' Kg';
    },

    formatSolesLabel(num) {
        return 'S/ ' + this.formatNumero(num, 2);
    },

    formatSolesTooltip(num) {
        return 'S/' + this.formatNumero(num, 2);
    },

    formatCompact(value) {
        const numero = Number(value);
        if (!Number.isFinite(numero) || numero === 0) return '0';
        if (Math.abs(numero) >= 1000) {
            return `${Math.round(numero / 1000)}K`;
        }
        return this.formatNumero(numero, 0);
    },

    escapeHtml(texto) {
        if (!texto) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    obtenerConfig(tipoGrafico) {
        if (tipoGrafico === 'ParetoCorporativosSubZona') {
            return {
                niveles: ['zona', 'subzona', 'coorporativo'],
                subtitulo: 'Por zona, subzona y corporativo'
            };
        }

        if (tipoGrafico === 'ParetoCorporativosZona') {
            return {
                niveles: ['zona', 'coorporativo'],
                subtitulo: 'Por zona y corporativo'
            };
        }

        return {
            niveles: ['coorporativo'],
            subtitulo: 'Por corporativo'
        };
    },

    obtenerTooltipEl() {
        let el = document.getElementById(this.tooltipId);

        if (!el) {
            el = document.createElement('div');
            el.id = this.tooltipId;
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '9999';
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.1s ease';
            el.style.background = '#ffffff';
            el.style.border = '1px solid #cbd5e1';
            el.style.borderRadius = '4px';
            el.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            el.style.padding = '11px 14px';
            el.style.color = '#334155';
            el.style.fontFamily = '"Segoe UI", sans-serif';
            el.style.fontSize = '12.5px';
            el.style.lineHeight = '1.6';
            el.style.wordBreak = 'break-word';
            document.body.appendChild(el);

            document.addEventListener('scroll', () => this.ocultarTooltip(), { capture: true, passive: true });
        }

        return el;
    },

    ocultarTooltip() {
        const el = document.getElementById(this.tooltipId);
        if (el) {
            el.style.opacity = '0';
        }
    },

    mostrarTooltip(fila, clientX, clientY) {
        const tooltipEl = this.obtenerTooltipEl();

        const filas = [
            ['coorporativo:', fila.coorporativo || ''],
            ['subzona:', fila.subzona || '(Todo)'],
            ['zona:', fila.zona || '(Todo)'],
            ['total_kilos:', this.formatKilos(fila.total_kilos)],
            ['total_soles:', this.formatSolesTooltip(fila.total_soles)],
            ['total_unidad:', this.formatNumero(fila.total_unidad, 0)]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(110px, 1fr); gap:5px 20px; align-items:start;">
                ${filas.map(([etiqueta, valor]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';

        const tooltipWidth = Math.min(390, window.innerWidth - 24);
        const tooltipHeight = tooltipEl.getBoundingClientRect().height || 155;
        tooltipEl.style.width = `${tooltipWidth}px`;

        const offset = 14;
        let left = clientX + offset;
        let top = clientY + offset;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = clientX - tooltipWidth - offset;
        }

        left = Math.max(8, left);
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 12));

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
    },

    agruparPor(lista, clave) {
        const grupos = [];

        lista.forEach(fila => {
            let actual = grupos[grupos.length - 1];
            if (!actual || actual.valor !== fila[clave]) {
                actual = { valor: fila[clave], filas: [] };
                grupos.push(actual);
            }
            actual.filas.push(fila);
        });

        return grupos;
    },

    celdaGrupo(valor, rowspan, esZona) {
        return `
            <td rowspan="${rowspan}" class="px-2 py-0 align-top border-r border-slate-200 ${esZona ? 'bg-slate-50/50' : 'bg-white'}">
                <div class="pt-1 text-[10.5px] font-bold text-slate-700 leading-tight">${this.escapeHtml(valor || '')}</div>
            </td>
        `;
    },

    celdaCorporativo(fila) {
        return `
            <td class="px-2 py-0 align-middle border-r border-slate-200">
                <div class="truncate text-[10.5px] font-medium text-slate-700" title="${this.escapeHtml(fila.coorporativo || '')}">
                    ${this.escapeHtml(fila.coorporativo || '')}
                </div>
            </td>
        `;
    },

    celdasBarras(fila, metricas) {
        return metricas.map(metrica => {
            const valor = Number(fila[metrica.clave]) || 0;
            const porcentaje = metrica.max > 0 ? Math.min(100, Math.max(0, (valor / metrica.max) * 100)) : 0;
            const etiqueta = metrica.formatoLabel(valor);
            const lineas = metrica.ticks.map(tick => `
                <span class="absolute top-0 bottom-0 w-px bg-slate-200/70" style="left:${tick.pct}%"></span>
            `).join('');

            return `
                <td class="px-2 py-0 align-middle border-l border-slate-100">
                    <div class="relative" style="height:20px; width:calc(100% - 96px);">
                        ${lineas}
                        <div class="cc-pareto-bar absolute top-1/2 -translate-y-1/2 left-0 h-[12px] rounded-sm cursor-pointer"
                            data-fila-index="${fila._index}"
                            style="width:${porcentaje}%; background:#4E79A7;"></div>
                        <span class="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-700 whitespace-nowrap"
                            style="left:calc(${porcentaje}% + 6px);">${this.escapeHtml(etiqueta)}</span>
                    </div>
                </td>
            `;
        }).join('');
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const filasRaw = Array.isArray(data && data.filas) ? data.filas : [];
        const tipoGrafico = (data && data.tipo_grafico) || 'ParetoCorporativos';
        const config = this.obtenerConfig(tipoGrafico);
        const titulo = (data && data.titulo) || 'Pareto de Ventas Corporativas';

        if (filasRaw.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-5 py-4 border-b border-slate-200">
                        <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(config.subtitulo)} · Unidades, kilos y soles</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const filas = filasRaw.map((fila, index) => ({
            ...fila,
            _index: index,
            total_unidad: Number(fila.total_unidad) || 0,
            total_kilos: Number(fila.total_kilos) || 0,
            total_soles: Number(fila.total_soles) || 0
        }));

        const metricas = [
            {
                clave: 'total_unidad',
                label: 'total_unidad',
                step: 50000,
                formatoLabel: (valor) => this.formatNumero(valor, 0)
            },
            {
                clave: 'total_kilos',
                label: 'total_kilos',
                step: 100000,
                formatoLabel: (valor) => this.formatKilos(valor)
            },
            {
                clave: 'total_soles',
                label: 'total_soles',
                step: 1000000,
                formatoLabel: (valor) => this.formatSolesLabel(valor)
            }
        ];

        metricas.forEach(metrica => {
            let maxValor = 0;
            filas.forEach(fila => {
                if (fila[metrica.clave] > maxValor) maxValor = fila[metrica.clave];
            });

            metrica.max = Math.max(metrica.step, Math.ceil(maxValor / metrica.step) * metrica.step);
            metrica.ticks = [];

            for (let valor = 0; valor <= metrica.max; valor += metrica.step) {
                metrica.ticks.push({
                    value: valor,
                    pct: metrica.max > 0 ? (valor / metrica.max) * 100 : 0
                });
            }
        });

        const filasHtml = [];
        const niveles = config.niveles;

        if (!niveles.includes('zona')) {
            filas.forEach(fila => {
                filasHtml.push(`
                    <tr class="h-[22px] border-b border-slate-100 hover:bg-slate-50/60">
                        ${this.celdaCorporativo(fila)}
                        ${this.celdasBarras(fila, metricas)}
                    </tr>
                `);
            });
        } else if (!niveles.includes('subzona')) {
            const gruposZona = this.agruparPor(filas, 'zona');

            gruposZona.forEach(grupoZona => {
                grupoZona.filas.forEach((fila, index) => {
                    const celdas = [];

                    if (index === 0) {
                        celdas.push(this.celdaGrupo(grupoZona.valor, grupoZona.filas.length, true));
                    }

                    celdas.push(this.celdaCorporativo(fila));
                    celdas.push(this.celdasBarras(fila, metricas));

                    filasHtml.push(`
                        <tr class="h-[22px] border-b border-slate-100 hover:bg-slate-50/60 ${index === 0 ? 'border-t border-slate-200' : ''}">
                            ${celdas.join('')}
                        </tr>
                    `);
                });
            });
        } else {
            const gruposZona = this.agruparPor(filas, 'zona');

            gruposZona.forEach(grupoZona => {
                const subgrupos = this.agruparPor(grupoZona.filas, 'subzona');
                let primeraFilaZona = true;

                subgrupos.forEach(grupoSub => {
                    grupoSub.filas.forEach((fila, index) => {
                        const celdas = [];

                        if (primeraFilaZona) {
                            celdas.push(this.celdaGrupo(grupoZona.valor, grupoZona.filas.length, true));
                            primeraFilaZona = false;
                        }

                        if (index === 0) {
                            celdas.push(this.celdaGrupo(grupoSub.valor, grupoSub.filas.length, false));
                        }

                        celdas.push(this.celdaCorporativo(fila));
                        celdas.push(this.celdasBarras(fila, metricas));

                        filasHtml.push(`
                            <tr class="h-[22px] border-b border-slate-100 hover:bg-slate-50/60 ${index === 0 ? 'border-t border-slate-200' : ''}">
                                ${celdas.join('')}
                            </tr>
                        `);
                    });
                });
            });
        }

        const leftWidths = niveles.length === 3
            ? [80, 110, 230]
            : niveles.length === 2
                ? [90, 220]
                : [280];

        const colgroup = leftWidths.map(width => `<col style="width:${width}px">`).join('') + '<col><col><col>';

        const headersIzquierda = niveles.map(nivel => `
            <th class="sticky top-0 z-20 bg-slate-50/95 px-2 py-2 text-left text-[10px] font-semibold text-slate-500 border-b border-r border-slate-200">
                ${this.escapeHtml(nivel)}
            </th>
        `).join('');

        const headersMetricas = metricas.map(metrica => {
            const mostrarTodas = metrica.ticks.length <= 8;

            const ticksHtml = metrica.ticks.map((tick, tickIndex) => {
                if (!mostrarTodas && tickIndex % 2 !== 0) return '';
                let transform = 'translateX(-50%)';
                let left = `${tick.pct}%`;

                if (tick.pct <= 0) {
                    transform = 'none';
                    left = '0%';
                } else if (tick.pct >= 100) {
                    transform = 'translateX(-100%)';
                    left = '100%';
                }

                return `<span class="absolute top-0 text-[8.5px] font-semibold text-slate-400 whitespace-nowrap" style="left:${left}; transform:${transform};">${this.formatCompact(tick.value)}</span>`;
            }).join('');

            return `
                <th class="sticky top-0 z-20 bg-slate-50/95 px-2 pt-2 pb-1 align-bottom border-b border-l border-slate-200">
                    <div class="text-[11px] font-semibold text-slate-600">${this.escapeHtml(metrica.label)}</div>
                    <div class="relative mt-1 h-4" style="width:calc(100% - 96px);">${ticksHtml}</div>
                </th>
            `;
        }).join('');

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-100">
                    <h2 class="text-lg font-bold text-slate-800">${this.escapeHtml(titulo)}</h2>
                    <p class="text-xs text-slate-400 mt-0.5">${this.escapeHtml(config.subtitulo)} · Unidades, kilos y soles</p>
                </div>
                <div class="w-full overflow-auto custom-scrollbar" style="max-height: 72vh;">
                    <table class="w-full table-fixed border-collapse text-[10.5px]">
                        <colgroup>${colgroup}</colgroup>
                        <thead>
                            <tr>${headersIzquierda}${headersMetricas}</tr>
                        </thead>
                        <tbody>
                            ${filasHtml.join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = contenedor.querySelector('tbody');
        if (!tbody) return;

        const filasPorIndice = {};
        filas.forEach(fila => {
            filasPorIndice[fila._index] = fila;
        });

        tbody.addEventListener('mousemove', (event) => {
            const barra = event.target.closest('[data-fila-index]');
            if (!barra) {
                this.ocultarTooltip();
                return;
            }

            const fila = filasPorIndice[Number(barra.getAttribute('data-fila-index'))];
            if (!fila) {
                this.ocultarTooltip();
                return;
            }

            this.mostrarTooltip(fila, event.clientX, event.clientY);
        });

        tbody.addEventListener('mouseleave', () => this.ocultarTooltip());

        const scroll = contenedor.querySelector('.custom-scrollbar');
        if (scroll) {
            scroll.addEventListener('scroll', () => this.ocultarTooltip(), { passive: true });
        }
    }
};

window.ChartRegistry['ControlClientesPareto'] = window.ChartControlClientesPareto;
