/**
 * Componente PreciosTabla - CriadorEmpre
 * Tabla semanal de precios por provincia y proveedor corregido.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartCriadorEmprePreciosTabla = {
    datos: null,
    tooltipId: 'criadorempre-precios-tabla-tooltip',

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.ocultarTooltip();
        this.datos = data || null;

        const columnas = Array.isArray(data && data.columnas) ? data.columnas : [];
        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const subtotales = Array.isArray(data && data.subtotales) ? data.subtotales : [];
        const titulo = (data && data.titulo) || 'Precio de Proveedores de Pollo BB';
        const tipo = (data && data.tipo) || 'Pollo bebe';
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
                    <p class="text-[11px] text-slate-400 font-medium mt-0.5">Precio promedio semanal por provincia y proveedor</p>
                </div>
                <button id="btn-export-precios-tabla" type="button" title="Exportar a Excel" aria-label="Exportar a Excel"
                    class="flex items-center justify-center w-9 h-9 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                    <i class="fas fa-file-excel text-base"></i>
                </button>
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

            const btnExportVacio = document.getElementById('btn-export-precios-tabla');
            if (btnExportVacio) btnExportVacio.remove();
            return;
        }

        const gruposAnio = [];
        columnas.forEach(columna => {
            const anio = Number(columna.anio);
            let grupo = gruposAnio.find(item => item.anio === anio);
            if (!grupo) {
                grupo = { anio, columnas: [] };
                gruposAnio.push(grupo);
            }
            grupo.columnas.push(columna);
        });

        const filasPorProvincia = new Map();
        filas.forEach(fila => {
            const provincia = String(fila.provincia || '');
            if (!filasPorProvincia.has(provincia)) {
                filasPorProvincia.set(provincia, []);
            }
            filasPorProvincia.get(provincia).push(fila);
        });

        const subtotalPorProvincia = new Map();
        subtotales.forEach(subtotal => {
            subtotalPorProvincia.set(String(subtotal.provincia || ''), subtotal);
        });

        const totalColumnas = columnas.length;
        let theadHtml = `
            <tr>
                <th rowspan="2" class="sticky-prov col-prov bg-blue-700 px-3 py-2 text-left font-bold text-white">NomProvin.</th>
                <th rowspan="2" class="sticky-supplier col-supplier bg-blue-700 px-3 py-2 text-left font-bold text-white">NombreCorregido</th>
                ${gruposAnio.map(grupo => `
                    <th colspan="${grupo.columnas.length}" class="bg-blue-700 px-2 py-1.5 text-center font-bold text-white whitespace-nowrap">
                        ${grupo.anio}
                    </th>
                `).join('')}
            </tr>
            <tr>
                ${gruposAnio.flatMap(grupo => grupo.columnas.map(columna => `
                    <th class="col-semana bg-blue-700 px-2 py-2 text-center font-bold text-white whitespace-nowrap">
                        ${this.escapeHtml(columna.label || `Semana ${columna.semana}`)}
                    </th>
                `)).join('')}
            </tr>
        `;

        let tbodyHtml = '';

        filasPorProvincia.forEach((filasProvincia, provincia) => {
            filasProvincia.forEach((fila, indice) => {
                let celdas = '';

                if (indice === 0) {
                    celdas += `
                        <td rowspan="${filasProvincia.length + 1}"
                            class="sticky-prov col-prov bg-white px-3 py-2 align-top font-bold text-slate-800">
                            ${this.escapeHtml(provincia)}
                        </td>
                    `;
                }

                celdas += `
                    <td class="sticky-supplier col-supplier bg-white px-3 py-2 font-medium text-slate-700">
                        ${this.escapeHtml(fila.proveedor || '')}
                    </td>
                `;

                for (let i = 0; i < totalColumnas; i++) {
                    const columna = columnas[i];
                    const valor = Array.isArray(fila.valores) ? fila.valores[i] : null;

                    celdas += `
                        <td class="col-semana bg-white px-2 py-2 text-right font-mono text-slate-800 hover:bg-blue-50/60"
                            data-tipo="${this.escapeHtml(tipo)}"
                            data-provincia="${this.escapeHtml(provincia)}"
                            data-proveedor="${this.escapeHtml(fila.proveedor || '')}"
                            data-anio="${this.escapeHtml(String(columna.anio || ''))}"
                            data-semana="${this.escapeHtml(String(columna.semana || ''))}"
                            data-valor="${valor === null || valor === undefined ? '' : valor}">
                            ${this.formatearPrecio(valor)}
                        </td>
                    `;
                }

                tbodyHtml += `<tr class="hover:bg-slate-50/60 transition-colors">${celdas}</tr>`;
            });

            const subtotal = subtotalPorProvincia.get(provincia) || { valores: [] };
            let celdasSubtotal = `
                <td class="sticky-supplier col-supplier bg-slate-100 px-3 py-2 font-bold text-slate-900">
                    Subtotal
                </td>
            `;

            for (let i = 0; i < totalColumnas; i++) {
                const valor = Array.isArray(subtotal.valores) ? subtotal.valores[i] : null;
                const columna = columnas[i];

                celdasSubtotal += `
                    <td class="col-semana bg-slate-100 px-2 py-2 text-right font-mono font-bold text-slate-900"
                        data-tipo="${this.escapeHtml(tipo)}"
                        data-provincia="${this.escapeHtml(provincia)}"
                        data-proveedor="Subtotal"
                        data-subtotal="true"
                        data-anio="${this.escapeHtml(String(columna.anio || ''))}"
                        data-semana="${this.escapeHtml(String(columna.semana || ''))}"
                        data-valor="${valor === null || valor === undefined ? '' : valor}">
                        ${this.formatearPrecio(valor)}
                    </td>
                `;
            }

            tbodyHtml += `<tr class="bg-slate-100">${celdasSubtotal}</tr>`;
        });

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="overflow-auto max-h-[70vh] custom-scrollbar">
                    <table id="criadorempre-precios-tabla" class="precios-tabla w-full text-xs border-collapse table-auto select-none">
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

    inicializarTooltip(contenedor) {
        const tabla = contenedor.querySelector('.precios-tabla');
        if (!tabla) return;

        tabla.addEventListener('mouseover', (event) => {
            const celda = event.target.closest('td[data-provincia][data-semana]');
            if (!celda) return;
            this.mostrarTooltip(celda, event);
        });

        tabla.addEventListener('mousemove', (event) => {
            if (!this.tooltipVisible) return;
            const celda = event.target.closest('td[data-provincia][data-semana]');
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
        const proveedor = celda.getAttribute('data-proveedor') || '';
        const anio = celda.getAttribute('data-anio') || '';
        const semana = celda.getAttribute('data-semana') || '';
        const key = `${tipo}|${provincia}|${proveedor}|${anio}|${semana}|${valorRaw}`;
        const tooltipEl = this.obtenerTooltipEl();

        if (this.tooltipKey !== key) {
            tooltipEl.innerHTML = `
                <div style="display:grid; grid-template-columns:auto minmax(130px, 1fr); gap:7px 18px; align-items:start;">
                    <span style="color:#64748b;">Tipo:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(tipo)}</span>
                    <span style="color:#64748b;">NomProvincia:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(provincia)}</span>
                    <span style="color:#64748b;">NombreCorregido:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(proveedor)}</span>
                    <span style="color:#64748b;">Semana de fecha:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">Semana ${this.escapeHtml(semana)}</span>
                    <span style="color:#64748b;">Año de fecha:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(anio)}</span>
                    <span style="color:#64748b;">PrecioProm:</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.formatearPrecio(valorRaw)}</span>
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

    inicializarExportacion() {
        const btnExport = document.getElementById('btn-export-precios-tabla');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
            this.exportarExcel();
        });
    },

    exportarExcel() {
        if (typeof XLSX === 'undefined') {
            alert('No se encontró la librería de exportación a Excel.');
            return;
        }

        const datos = this.datos || {};
        const columnas = Array.isArray(datos.columnas) ? datos.columnas : [];
        const filas = Array.isArray(datos.filas) ? datos.filas : [];
        const subtotales = Array.isArray(datos.subtotales) ? datos.subtotales : [];

        if (columnas.length === 0 || filas.length === 0) {
            return;
        }

        const subtotalPorProvincia = new Map();
        subtotales.forEach(subtotal => {
            subtotalPorProvincia.set(String(subtotal.provincia || ''), subtotal);
        });

        const filasPorProvincia = new Map();
        filas.forEach(fila => {
            const provincia = String(fila.provincia || '');
            if (!filasPorProvincia.has(provincia)) {
                filasPorProvincia.set(provincia, []);
            }
            filasPorProvincia.get(provincia).push(fila);
        });

        const aoa = [
            [
                'NomProvin.',
                'NombreCorregido',
                ...columnas.map(columna => `${columna.label} (${columna.anio})`)
            ]
        ];

        const filasSubtotal = new Set();

        filasPorProvincia.forEach((filasProvincia, provincia) => {
            filasProvincia.forEach(fila => {
                aoa.push([
                    provincia,
                    fila.proveedor || '',
                    ...columnas.map((_, indice) => {
                        const valor = Array.isArray(fila.valores) ? fila.valores[indice] : null;
                        return valor === null || valor === undefined ? '' : Number(valor);
                    })
                ]);
            });

            const subtotal = subtotalPorProvincia.get(provincia) || { valores: [] };
            aoa.push([
                provincia,
                'Subtotal',
                ...columnas.map((_, indice) => {
                    const valor = Array.isArray(subtotal.valores) ? subtotal.valores[indice] : null;
                    return valor === null || valor === undefined ? '' : Number(valor);
                })
            ]);
            filasSubtotal.add(aoa.length - 1);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const estilos = typeof ExcelExportHelper !== 'undefined' ? ExcelExportHelper.ESTILOS : null;

        for (let r = 0; r < aoa.length; r++) {
            for (let c = 0; c < aoa[r].length; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                const cell = ws[addr];
                if (!cell) continue;

                if (r === 0) {
                    if (estilos) cell.s = { ...estilos.headerPrincipal };
                } else if (filasSubtotal.has(r)) {
                    if (estilos) {
                        cell.s = { ...estilos.footerCell };
                        if (c < 2) {
                            cell.s.alignment = { vertical: 'center', horizontal: 'left' };
                        }
                    }
                    if (typeof cell.v === 'number') cell.z = '0.000';
                } else if (typeof cell.v === 'number') {
                    if (estilos) cell.s = { ...estilos.dataCellRight };
                    cell.z = '0.000';
                } else if (estilos) {
                    cell.s = { ...estilos.dataCellLeft };
                }
            }
        }

        ws['!cols'] = [
            { wch: 14 },
            { wch: 24 },
            ...columnas.map(() => ({ wch: 11 }))
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PreciosTabla');

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `PreciosTabla_${fecha}.xlsx`);
    },

    formatearPrecio(valor) {
        if (valor === null || valor === undefined || valor === '') return '';

        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';

        if (!this.formateadorPrecio) {
            this.formateadorPrecio = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            });
        }

        return this.formateadorPrecio.format(numero);
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

        this.datos = null;
    }
};

window.ChartRegistry['CriadorEmprePreciosTabla'] = window.ChartCriadorEmprePreciosTabla;
