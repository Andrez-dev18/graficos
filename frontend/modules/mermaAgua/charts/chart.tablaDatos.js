window.MermaAguaTablaDatos = {
    render(contenedor, data) {
        if (!contenedor) return;

        this.datos = data || {};

        const fechas = Array.isArray(this.datos.fechas) ? this.datos.fechas : [];
        const procesos = Array.isArray(this.datos.procesos) ? this.datos.procesos : [];
        const subdatos = this.ordenarSubdatos(this.datos.subdatos || []);

        if (!procesos.length || !fechas.length || !subdatos.length) {
            contenedor.innerHTML = this.buildEmptyState(this.datos);
            return;
        }

        contenedor.innerHTML = this.buildLayout(this.datos, fechas, procesos, subdatos);
        this.initTooltip();
        this.bindTooltip(contenedor);
    },

    buildLayout(data, fechas, procesos, subdatos) {
        const filtros = data.filtros_aplicados || {};
        const resumen = this.escapeHtml(filtros.resumen || '');
        const codcencos = this.escapeHtml(data.codcencos || '—');
        const nomcencos = this.escapeHtml(filtros.nomcencos || '');
        const codcencosTooltip = this.escapeHtml(data.codcencos || '—');
        const nomcencosTooltip = this.escapeHtml(filtros.nomcencos || '');
        const totalFilas = procesos.length * fechas.length;

        const anchoProceso = 14;
        const anchoFecha = 20;
        const anchoSubdato = subdatos.length ? (66 / subdatos.length) : 16;

        const colgroup = `
            <colgroup>
                <col style="width:${anchoProceso}%">
                <col style="width:${anchoFecha}%">
                ${subdatos.map(() => `<col style="width:${anchoSubdato}%">`).join('')}
            </colgroup>
        `;

        const filas = procesos.map((proceso, indiceProceso) => {
            const series = {};
            (proceso.series || []).forEach((serie) => {
                series[serie.subdato] = serie.valores || [];
            });

            return fechas.map((fecha, indiceFecha) => {
                const fechaLarga = this.formatFechaLarga(fecha);

                const celdas = subdatos.map((subdato) => {
                    const valores = series[subdato.id] || [];
                    const valor = valores[indiceFecha];
                    const valorFormateado = this.formatNum(valor, 3);
                    return `<td class="px-3 py-1.5 text-right font-mono text-slate-700 border-r border-slate-100 cursor-default"
                        data-tooltip-agua="1"
                        data-codcencos="${codcencosTooltip}"
                        data-nomcencos="${nomcencosTooltip}"
                        data-proceso="${this.escapeHtml(proceso.proceso)}"
                        data-subdato="${this.escapeHtml(subdato.label || subdato.id)}"
                        data-fecha="${this.escapeHtml(fechaLarga)}"
                        data-valor="${this.escapeHtml(valorFormateado)}">${valorFormateado}</td>`;
                }).join('');

                const procesoCell = indiceFecha === 0
                    ? `<td rowspan="${fechas.length}" class="px-3 py-2 text-left align-top font-bold text-slate-800 bg-slate-50 border-r border-slate-200">${this.escapeHtml(proceso.proceso)}</td>`
                    : '';

                return `
                    <tr class="${indiceProceso % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}">
                        ${procesoCell}
                        <td class="px-3 py-1.5 text-left text-slate-600 border-r border-slate-100 whitespace-nowrap">${this.escapeHtml(fechaLarga)}</td>
                        ${celdas}
                    </tr>
                `;
            }).join('');
        }).join('');

        const headerSubdatos = subdatos.map((subdato) => `
            <th class="px-3 py-2 text-right font-bold text-[11px] border-r border-blue-500 last:border-r-0 whitespace-nowrap">
                ${this.escapeHtml(subdato.label || subdato.id)}
            </th>
        `).join('');

        return `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-4 py-3 sm:px-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">TablaDatos</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Promedio diario por proceso y tipo de dato · ${resumen}</p>
                    </div>
                    <div class="text-[11px] text-slate-500 font-semibold">
                        ${totalFilas} filas · ${fechas.length} días
                    </div>
                </div>

                <div class="w-full overflow-auto max-h-[620px] custom-scrollbar">
                    <table class="w-full table-fixed text-xs border-collapse">
                        ${colgroup}
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white">
                            <tr>
                                <th rowspan="4" class="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10px] bg-blue-600 border-r border-blue-500">proceso</th>
                                <th rowspan="4" class="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10px] bg-blue-600 border-r border-blue-500">Día de fecha</th>
                                <th colspan="${subdatos.length}" class="px-3 py-2 text-center font-bold text-[10px] bg-blue-600 border-r border-blue-500">
                                    codcencos / nomcencos / subdato
                                </th>
                            </tr>
                            <tr>
                                <th colspan="${subdatos.length}" class="px-3 py-1.5 text-center font-bold text-[11px] bg-blue-600 border-r border-blue-500">${codcencos}</th>
                            </tr>
                            <tr>
                                <th colspan="${subdatos.length}" class="px-3 py-1.5 text-center font-bold text-[11px] bg-blue-600 border-r border-blue-500">${nomcencos}</th>
                            </tr>
                            <tr class="bg-blue-600">
                                ${headerSubdatos}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${filas}
                        </tbody>
                    </table>
                </div>

                <div class="px-4 sm:px-6 py-2 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>Fuente: factmermaagua</span>
                    <span>${data.fecha_corte_dmy ? `Corte: ${this.escapeHtml(data.fecha_corte_dmy)}` : ''}</span>
                </div>
            </section>
        `;
    },

    initTooltip() {
        let el = document.getElementById('tooltip-tabla-agua');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tooltip-tabla-agua';
            document.body.appendChild(el);
        }

        el.className = 'hidden fixed z-[9999] pointer-events-none bg-white border border-slate-300 shadow-xl rounded-md px-3 py-2 text-[12px] text-slate-700 min-w-[265px]';
        el.style.left = '0px';
        el.style.top = '0px';
        this.tooltipEl = el;
    },

    bindTooltip(contenedor) {
        const table = contenedor.querySelector('table');
        if (!table || !this.tooltipEl) return;

        let celdaActual = null;

        table.addEventListener('mouseover', (event) => {
            const celda = event.target.closest('td[data-tooltip-agua="1"]');
            if (!celda || celda === celdaActual) return;

            this.hideTooltip();
            celdaActual = celda;
            this.tooltipTimer = setTimeout(() => {
                if (celdaActual === celda) {
                    this.showTooltip(celda);
                }
            }, 500);
        });

        table.addEventListener('mouseout', (event) => {
            const celda = event.target.closest('td[data-tooltip-agua="1"]');
            if (!celda) return;
            if (event.relatedTarget && celda.contains(event.relatedTarget)) return;
            if (celda === celdaActual) {
                celdaActual = null;
                this.hideTooltip();
            }
        });

        table.addEventListener('mouseleave', () => {
            celdaActual = null;
            this.hideTooltip();
        });
    },

    showTooltip(celda) {
        const el = this.tooltipEl;
        if (!el) return;

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:auto 1fr;column-gap:16px;row-gap:3px;white-space:nowrap;">
                <span style="color:#94a3b8;">codcencos:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.codcencos || '')}</span>
                <span style="color:#94a3b8;">nomcencos:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.nomcencos || '')}</span>
                <span style="color:#94a3b8;">proceso:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.proceso || '')}</span>
                <span style="color:#94a3b8;">subdato:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.subdato || '')}</span>
                <span style="color:#94a3b8;">Día de fecha:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.fecha || '')}</span>
                <span style="color:#94a3b8;">Prom. valor:</span>
                <span style="font-weight:600;color:#1e293b;">${this.escapeHtml(celda.dataset.valor || '')}</span>
            </div>
        `;

        el.classList.remove('hidden');

        const rect = celda.getBoundingClientRect();
        const tooltipRect = el.getBoundingClientRect();

        let left = rect.right + 10;
        let top = rect.top;

        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = rect.left - tooltipRect.width - 10;
        }

        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = window.innerHeight - tooltipRect.height - 8;
        }

        el.style.left = `${Math.max(8, left)}px`;
        el.style.top = `${Math.max(8, top)}px`;
    },

    hideTooltip() {
        if (this.tooltipTimer) {
            clearTimeout(this.tooltipTimer);
            this.tooltipTimer = null;
        }

        if (this.tooltipEl) {
            this.tooltipEl.classList.add('hidden');
        }
    },

    ordenarSubdatos(subdatos) {
        const orden = ['Limite I', 'Limite C', 'Limite S', 'm3'];
        return [...subdatos].sort((a, b) => {
            const ia = orden.indexOf(a.id);
            const ib = orden.indexOf(b.id);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
    },

    formatFechaLarga(fecha) {
        const partes = String(fecha).split('-').map(Number);
        if (partes.length !== 3) return String(fecha);

        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${partes[2]} de ${meses[partes[1] - 1] || ''} de ${partes[0]}`;
    },

    formatNum(valor, decimales = 3) {
        if (valor === null || valor === undefined || valor === '') return '—';
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '—';

        return numero.toLocaleString('es-PE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    buildEmptyState(data) {
        const filtros = data?.filtros_aplicados || {};
        const resumen = this.escapeHtml(filtros.resumen || '');

        return `
            <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <div class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <i class="fa-solid fa-table"></i>
                </div>
                <p class="text-sm font-semibold text-slate-700">Sin datos disponibles</p>
                <p class="text-xs text-slate-500 mt-1">No se encontraron registros para los filtros seleccionados.</p>
                ${resumen ? `<p class="text-[10px] text-slate-400 mt-2">${resumen}</p>` : ''}
            </div>
        `;
    },

    destroy() {
        this.hideTooltip();
        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }
    }
};
