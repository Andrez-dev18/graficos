/**
 * Componente CantidadesTabla - CriadorEmpre
 * Tabla semanal por Tipo y Provincia.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartCriadorEmpreCantidadesTabla = {
    tooltipId: 'criadorempre-cantidades-tooltip',
    tooltipVisible: false,
    tooltipKey: null,

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.ocultarTooltip();

        const columnas = Array.isArray(data && data.columnas) ? data.columnas : [];
        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const subtotales = Array.isArray(data && data.subtotales) ? data.subtotales : [];
        const totalGeneral = (data && data.total_general) || { valores: [] };

        const titulo = (data && data.titulo) || 'Volumen Semanal Total';
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';

        const header = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            ${this.escapeHtml(this.formatearPeriodo(fechaInicio, fechaFin))}
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-400 font-medium mt-0.5">Cantidad semanal por tipo y provincia</p>
                </div>
                <div class="flex items-center gap-2">
                            <button id="btn-export-cantidades" type="button"
                                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
            </div>
        `;

        if (columnas.length === 0 || filas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    ${header}
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;

            const btnExportVacio = document.getElementById('btn-export-cantidades');
            if (btnExportVacio) btnExportVacio.remove();
            return;
        }

        const grupos = [];
        columnas.forEach(columna => {
            const anio = Number(columna.anio);
            let grupo = grupos.find(item => item.anio === anio);

            if (!grupo) {
                grupo = { anio, columnas: [] };
                grupos.push(grupo);
            }

            grupo.columnas.push(columna);
        });

        const filasPorTipo = new Map();
        filas.forEach(fila => {
            const tipo = String(fila.tipo || '');
            if (!filasPorTipo.has(tipo)) {
                filasPorTipo.set(tipo, []);
            }
            filasPorTipo.get(tipo).push(fila);
        });

        const subtotalPorTipo = new Map();
        subtotales.forEach(subtotal => {
            subtotalPorTipo.set(String(subtotal.tipo || ''), subtotal);
        });

        const totalColumnas = columnas.length;

        let theadHtml = `
            <tr>
                <th rowspan="2" class="sticky-tipo col-tipo bg-blue-700 px-3 py-2 text-left font-bold text-white">Tipo</th>
                <th rowspan="2" class="sticky-provincia col-provincia bg-blue-700 px-3 py-2 text-left font-bold text-white">Provincia</th>
                ${grupos.map(grupo => `
                    <th colspan="${grupo.columnas.length}" class="bg-blue-700 px-2 py-1.5 text-center font-bold text-white whitespace-nowrap">
                        ${grupo.anio}
                    </th>
                `).join('')}
            </tr>
            <tr>
                ${grupos.flatMap(grupo => grupo.columnas.map(columna => `
                    <th class="col-semana bg-blue-700 px-2 py-2 text-center font-bold text-white whitespace-nowrap">
                        ${this.escapeHtml(columna.label || `Semana ${columna.semana}`)}
                    </th>
                `)).join('')}
            </tr>
        `;

        let tbodyHtml = '';

        filasPorTipo.forEach((filasTipo, tipo) => {
            filasTipo.forEach((fila, indice) => {
                let celdas = '';

                if (indice === 0) {
                    celdas += `
                        <td rowspan="${filasTipo.length + 1}"
                            class="sticky-tipo col-tipo bg-white px-3 py-2 align-top font-bold text-slate-800">
                            ${this.escapeHtml(tipo)}
                        </td>
                    `;
                }

                celdas += `
                    <td class="sticky-provincia col-provincia bg-white px-3 py-2 font-medium text-slate-700">
                        ${this.escapeHtml(fila.provincia || '')}
                    </td>
                `;

                for (let i = 0; i < totalColumnas; i++) {
                    const columna = columnas[i];
                    const valor = Array.isArray(fila.valores) ? fila.valores[i] : null;

                    celdas += `
                        <td class="col-semana bg-white px-2 py-2 text-right font-mono text-slate-800 hover:bg-blue-50/60"
                            data-tipo="${this.escapeHtml(tipo)}"
                            data-provincia="${this.escapeHtml(fila.provincia || '')}"
                            data-anio="${this.escapeHtml(String(columna.anio || ''))}"
                            data-semana="${this.escapeHtml(String(columna.semana || ''))}"
                            data-valor="${valor === null || valor === undefined ? '' : valor}">
                            ${this.formatearValor(valor)}
                        </td>
                    `;
                }

                tbodyHtml += `<tr class="hover:bg-slate-50/60 transition-colors">${celdas}</tr>`;
            });

            const subtotal = subtotalPorTipo.get(tipo) || { valores: [] };
            let celdasSubtotal = `
                <td class="sticky-provincia col-provincia bg-slate-100 px-3 py-2 font-bold text-slate-900">
                    Total
                </td>
            `;

            for (let i = 0; i < totalColumnas; i++) {
                const valor = Array.isArray(subtotal.valores) ? subtotal.valores[i] : null;
                const columna = columnas[i];

                celdasSubtotal += `
                    <td class="col-semana bg-slate-100 px-2 py-2 text-right font-mono font-bold text-slate-900"
                        data-tipo="${this.escapeHtml(tipo)}"
                        data-subtotal="true"
                        data-anio="${this.escapeHtml(String(columna.anio || ''))}"
                        data-semana="${this.escapeHtml(String(columna.semana || ''))}"
                        data-valor="${valor === null || valor === undefined ? '' : valor}">
                        ${this.formatearValor(valor)}
                    </td>
                `;
            }

            tbodyHtml += `<tr class="bg-slate-100">${celdasSubtotal}</tr>`;
        });

        let celdasTotalGeneral = `
            <td colspan="2" class="sticky-tipo bg-slate-200 px-3 py-2 font-bold text-slate-900">
                Total general
            </td>
        `;

        for (let i = 0; i < totalColumnas; i++) {
            const valor = Array.isArray(totalGeneral.valores) ? totalGeneral.valores[i] : null;
            const columna = columnas[i];

            celdasTotalGeneral += `
                <td class="col-semana bg-slate-200 px-2 py-2 text-right font-mono font-bold text-slate-900"
                    data-total="true"
                    data-anio="${this.escapeHtml(String(columna.anio || ''))}"
                    data-semana="${this.escapeHtml(String(columna.semana || ''))}"
                    data-valor="${valor === null || valor === undefined ? '' : valor}">
                    ${this.formatearValor(valor)}
                </td>
            `;
        }

        tbodyHtml += `<tr class="border-t-2 border-slate-300 bg-slate-200">${celdasTotalGeneral}</tr>`;

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="overflow-auto max-h-[70vh] custom-scrollbar">
                    <table id="criador-cantidades-tabla" class="criador-tabla w-full text-xs border-collapse table-auto select-none">
                        <thead class="sticky top-0 z-30 bg-blue-700 text-white">
                            ${theadHtml}
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${tbodyHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.inicializarTooltip(contenedor);
        this.inicializarExportacion();
    },

    inicializarExportacion() {
        const btnExport = document.getElementById('btn-export-cantidades');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
            if (typeof ExcelExportHelper === 'undefined') {
                alert('No se encontró la utilidad de exportación a Excel.');
                return;
            }

            ExcelExportHelper.exportarTabla('criador-cantidades-tabla', 'CantidadesTabla', {
                nombreHoja: 'CantidadesTabla'
            });
        });
    },

    inicializarTooltip(contenedor) {
        const tabla = contenedor.querySelector('.criador-tabla');
        if (!tabla) return;

        tabla.addEventListener('mouseover', (event) => {
            const celda = event.target.closest('td[data-tipo][data-provincia]');
            if (!celda) return;
            this.mostrarTooltip(celda, event);
        });

        tabla.addEventListener('mousemove', (event) => {
            if (!this.tooltipVisible) return;
            const celda = event.target.closest('td[data-tipo][data-provincia]');
            if (!celda) {
                this.ocultarTooltip();
                return;
            }
            this.posicionarTooltip(event);
        });

        tabla.addEventListener('mouseleave', () => this.ocultarTooltip());

        const scroll = contenedor.querySelector('.custom-scrollbar');
        if (scroll) {
            scroll.addEventListener('scroll', () => this.ocultarTooltip(), { passive: true });
        }
    },

    mostrarTooltip(celda, evento) {
        const valorRaw = celda.getAttribute('data-valor');

        if (valorRaw === null || valorRaw === '') {
            this.ocultarTooltip();
            return;
        }

        const tipo = celda.getAttribute('data-tipo') || '';
        const provincia = celda.getAttribute('data-provincia') || '';
        const anio = celda.getAttribute('data-anio') || '';
        const semana = celda.getAttribute('data-semana') || '';
        const key = `${tipo}|${provincia}|${anio}|${semana}|${valorRaw}`;
        const tooltipEl = this.obtenerTooltipEl();

        if (this.tooltipKey !== key) {
            tooltipEl.innerHTML = `
                <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:7px 18px; align-items:start;">
                    <span style="color:#64748b;">Tipo:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(tipo)}</span>
                    <span style="color:#64748b;">NomProvincia:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(provincia)}</span>
                    <span style="color:#64748b;">Semana de fecha:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">Semana ${this.escapeHtml(semana)}</span>
                    <span style="color:#64748b;">Año de fecha:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(anio)}</span>
                    <span style="color:#64748b;">cantidad:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.formatearValor(valorRaw)}</span>
                </div>
            `;
            this.tooltipKey = key;
        }

        this.tooltipVisible = true;
        tooltipEl.style.opacity = '1';
        this.posicionarTooltip(evento);
    },

    posicionarTooltip(evento) {
        const tooltipEl = document.getElementById(this.tooltipId);
        if (!tooltipEl) return;

        const offset = 14;
        let left = evento.clientX + offset;
        let top = evento.clientY + offset;

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;

        const rect = tooltipEl.getBoundingClientRect();

        if (rect.right > window.innerWidth - 10) {
            left = evento.clientX - rect.width - offset;
        }

        if (rect.bottom > window.innerHeight - 10) {
            top = evento.clientY - rect.height - offset;
        }

        tooltipEl.style.left = `${Math.max(8, left)}px`;
        tooltipEl.style.top = `${Math.max(8, top)}px`;
    },

    obtenerTooltipEl() {
        let tooltipEl = document.getElementById(this.tooltipId);

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = this.tooltipId;
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.zIndex = '9999';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.1s ease';
            tooltipEl.style.background = '#ffffff';
            tooltipEl.style.border = '1px solid #cbd5e1';
            tooltipEl.style.borderRadius = '6px';
            tooltipEl.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            tooltipEl.style.padding = '12px 14px';
            tooltipEl.style.color = '#334155';
            tooltipEl.style.fontFamily = '"Segoe UI", sans-serif';
            tooltipEl.style.fontSize = '13px';
            tooltipEl.style.lineHeight = '1.5';
            document.body.appendChild(tooltipEl);
        }

        return tooltipEl;
    },

    ocultarTooltip() {
        this.tooltipVisible = false;
        this.tooltipKey = null;

        const tooltipEl = document.getElementById(this.tooltipId);
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    },

    formatearValor(valor) {
        if (valor === null || valor === undefined || valor === '') return '';

        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';

        if (!this.formateador) {
            this.formateador = new Intl.NumberFormat('de-DE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
        }

        return this.formateador.format(numero);
    },

    formatearPeriodo(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return 'Rango seleccionado';

        const inicio = String(fechaInicio).split('-');
        const fin = String(fechaFin).split('-');

        if (inicio.length !== 3 || fin.length !== 3) {
            return `${fechaInicio} al ${fechaFin}`;
        }

        return `${inicio[2]}/${inicio[1]}/${inicio[0]} - ${fin[2]}/${fin[1]}/${fin[0]}`;
    },

    escapeHtml(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[caracter]));
    },

    destroy() {
        this.ocultarTooltip();

        const tooltipEl = document.getElementById(this.tooltipId);
        if (tooltipEl) {
            tooltipEl.remove();
        }
    }
};

window.ChartRegistry['CriadorEmpreCantidadesTabla'] = window.ChartCriadorEmpreCantidadesTabla;
