/**
 * Componente de Gráfico / Vista: DashPresupuesto202403%
 * Módulo: Presupuestos PAB
 * 
 * Renderiza el Resumen por N1 con Porcentaje de Avance según Tableau (Hoja Presupuesto202403% / DashPresupuesto202403%),
 * con las 6 columnas exactas: presupuesto, N1, Presupuestado, Ejecutado, Saldo, % Avance.
 * Cabeceras clásicas en azul (bg-blue-600 text-white), colores idénticos a Tableau (Saldos negativos en rojo,
 * positivos en verde; Ejecutado en azul interactivo; % Avance <50% en rojo y >=50% en verde; Totales en texto neutro).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartPresupuesto202403Pct = {
    controllerRef: null,
    datosBackend: null,
    solesFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pctFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        this.renderTableStructure();
        this.setupExportListeners();
    },

    formatSoles(val) {
        if (val === null || val === undefined || isNaN(val)) return 'S/0,00';
        const isNeg = val < 0;
        const absVal = Math.abs(val);
        const fmt = this.solesFormatter.format(absVal);
        return isNeg ? `S/-${fmt}` : `S/${fmt}`;
    },

    formatPct(val) {
        if (val === null || val === undefined || isNaN(val)) return '0,00%';
        return `${this.pctFormatter.format(val)}%`;
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    renderTableStructure() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const items = data.items || [];
        const presupuestoNombre = data.presupuesto_nombre || "202403 AMPLIACIÓN PLANTA DE ALIMENTO";
        const titulo = data.titulo || "Presupuesto Planta de Alimento";
        const totales = data.totales || {
            presupuestado: 0,
            ejecutado: 0,
            saldo: 0,
            porcentaje_avance: 0
        };

        const getSaldoClass = (val) => {
            if (val < -0.001) return 'text-red-600 font-semibold';
            if (val > 0.001) return 'text-emerald-700 font-semibold';
            return 'text-slate-600 font-normal';
        };

        const getPctClass = (val) => {
            if (val < 50.0) return 'text-red-600 font-semibold';
            return 'text-emerald-700 font-semibold';
        };

        // Generar filas HTML
        const rowsHtml = items.map((it, idx) => {
            const saldoClass = getSaldoClass(it.saldo);
            const pctClass = getPctClass(it.porcentaje_avance);

            const makeCellAttrs = (colName, colVal) => {
                return `data-n1="${this.escapeHtml(it.n1)}" ` +
                       `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                       `data-colname="${this.escapeHtml(colName)}" ` +
                       `data-colval="${this.escapeHtml(colVal)}"`;
            };

            return `
                <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-200 text-xs text-slate-700">
                    <td class="px-3 py-2 font-medium text-slate-800 border-r border-slate-200 align-top">${idx === 0 ? presupuestoNombre : ''}</td>
                    <td class="px-3 py-2 font-medium text-slate-800 border-r border-slate-200 align-top">${it.n1}</td>
                    <td class="tooltip-cell px-3 py-2 font-mono text-right text-slate-800 border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Presupuestado', this.formatSoles(it.presupuestado))}>${this.formatSoles(it.presupuestado)}</td>
                    <td class="tooltip-cell px-3 py-2 font-mono text-right text-blue-700 font-medium underline decoration-blue-300 border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Ejecutado', this.formatSoles(it.ejecutado))}>${this.formatSoles(it.ejecutado)}</td>
                    <td class="tooltip-cell px-3 py-2 font-mono text-right border-r border-slate-200 ${saldoClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Saldo', this.formatSoles(it.saldo))}>${this.formatSoles(it.saldo)}</td>
                    <td class="tooltip-cell px-3 py-2 font-mono text-right ${pctClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('% Avance', this.formatPct(it.porcentaje_avance))}>${this.formatPct(it.porcentaje_avance)}</td>
                </tr>
            `;
        });

        const makeTotalAttrs = (colName, colVal) => {
            return `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                   `data-colname="Total ${this.escapeHtml(colName)}" ` +
                   `data-colval="${this.escapeHtml(colVal)}"`;
        };

        // Estructura completa del card y tabla
        const tableHtml = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <!-- ENCABEZADO DE TARJETA CON EXCEL -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div class="flex items-center gap-2">
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">DashPresupuesto202403%</h2>
                        <span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">${items.length} categorías N1</span>
                    </div>

                    <!-- BOTÓN EXPORTAR EXCEL ESTÁNDAR -->
                    <button id="btn-export-excel-pab" type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span>Excel</span>
                    </button>
                </div>

                <!-- TÍTULO DE REPORTE ESTILO TABLEAU -->
                <div class="w-full bg-white py-3 border-b border-slate-100 text-center select-none">
                    <h1 class="text-lg font-bold text-slate-800 tracking-wide underline underline-offset-4 decoration-slate-400">
                        ${titulo}
                    </h1>
                </div>

                <!-- CONTENEDOR DE TABLA SCROLLEABLE -->
                <div class="overflow-x-auto overflow-y-auto max-h-[680px] custom-scrollbar">
                    <table id="tabla-presupuesto-pab" class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                        <thead class="sticky top-0 z-20 shadow-xs bg-blue-600">
                            <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-700">
                                <th class="px-3 py-2.5 text-left border-r border-blue-500/60 min-w-[220px]">presupuesto</th>
                                <th class="px-3 py-2.5 text-left border-r border-blue-500/60 min-w-[320px]">N1</th>
                                <th class="px-3 py-2.5 text-right border-r border-blue-500/60 min-w-[150px]">Presupuestado</th>
                                <th class="px-3 py-2.5 text-right border-r border-blue-500/60 min-w-[150px]">Ejecutado</th>
                                <th class="px-3 py-2.5 text-right border-r border-blue-500/60 min-w-[150px]">Saldo</th>
                                <th class="px-3 py-2.5 text-right min-w-[130px]">% Avance</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-presupuesto-pab" class="divide-y divide-slate-100 bg-white">
                            ${rowsHtml.join('')}
                        </tbody>
                        <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-xs text-slate-900 shadow-md">
                            <tr>
                                <td class="px-3 py-2.5 border-r border-slate-300"></td>
                                <td class="px-3 py-2.5 text-left font-bold text-slate-900 border-r border-slate-300">Total</td>
                                <td class="tooltip-total-cell px-3 py-2.5 font-mono text-right text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-blue-100/50" ${makeTotalAttrs('Presupuestado', this.formatSoles(totales.presupuestado))}>${this.formatSoles(totales.presupuestado)}</td>
                                <td class="tooltip-total-cell px-3 py-2.5 font-mono text-right text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-blue-100/50" ${makeTotalAttrs('Ejecutado', this.formatSoles(totales.ejecutado))}>${this.formatSoles(totales.ejecutado)}</td>
                                <td class="tooltip-total-cell px-3 py-2.5 font-mono text-right text-slate-900 border-r border-slate-300 cursor-pointer hover:bg-blue-100/50" ${makeTotalAttrs('Saldo', this.formatSoles(totales.saldo))}>${this.formatSoles(totales.saldo)}</td>
                                <td class="tooltip-total-cell px-3 py-2.5 font-mono text-right font-bold text-slate-900 cursor-pointer hover:bg-blue-100/50" ${makeTotalAttrs('% Avance', this.formatPct(totales.porcentaje_avance))}>${this.formatPct(totales.porcentaje_avance)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- TOOLTIP FLOTANTE TIPO TABLEAU -->
                <div id="tooltip-presupuesto-pct-pab" class="fixed z-50 pointer-events-none hidden bg-white/95 backdrop-blur-xs p-3 rounded-xl shadow-2xl border border-slate-200 text-xs transition-opacity duration-150"></div>
            </div>
        `;

        contenedor.innerHTML = tableHtml;
    },

    setupExportListeners() {
        const btnExport = document.getElementById('btn-export-excel-pab');
        if (!btnExport) return;

        const newBtn = btnExport.cloneNode(true);
        btnExport.parentNode.replaceChild(newBtn, btnExport);

        newBtn.addEventListener('click', () => {
            const data = this.datosBackend || {};
            const items = data.items || [];
            if (!items.length) {
                alert('No hay datos disponibles para exportar.');
                return;
            }

            if (typeof XLSX === 'undefined') {
                alert('Librería XLSX no disponible.');
                return;
            }

            const headerStyle = {
                fill: { fgColor: { rgb: "2563EB" } },
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                alignment: { vertical: "center", horizontal: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "1D4ED8" } },
                    bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                    left: { style: "thin", color: { rgb: "3B82F6" } },
                    right: { style: "thin", color: { rgb: "3B82F6" } }
                }
            };

            const dataStyleLeft = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "left" }
            };

            const dataStyleCurrencySoles = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStyleCurrencyBlue = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1D4ED8" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStyleCurrencyRed = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "DC2626" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStyleCurrencyGreen = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "15803D" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStyleCurrencyMuted = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "94A3B8" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStylePctGreen = {
                font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "15803D" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const dataStylePctRed = {
                font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "DC2626" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const rowHead = [
                { t: 's', v: 'presupuesto', s: headerStyle },
                { t: 's', v: 'N1', s: headerStyle },
                { t: 's', v: 'Presupuestado', s: headerStyle },
                { t: 's', v: 'Ejecutado', s: headerStyle },
                { t: 's', v: 'Saldo', s: headerStyle },
                { t: 's', v: '% Avance', s: headerStyle }
            ];

            const dataRows = items.map(it => {
                const sEjec = it.ejecutado > 0 ? dataStyleCurrencyBlue : dataStyleCurrencyMuted;
                const sSaldo = it.saldo < -0.001 ? dataStyleCurrencyRed : (it.saldo > 0.001 ? dataStyleCurrencyGreen : dataStyleCurrencyMuted);
                const sPct = it.porcentaje_avance < 50.0 ? dataStylePctRed : dataStylePctGreen;

                return [
                    { t: 's', v: data.presupuesto_nombre || '', s: dataStyleLeft },
                    { t: 's', v: it.n1 || '', s: dataStyleLeft },
                    { t: 'n', v: it.presupuestado, z: '"S/ "#,##0.00', s: dataStyleCurrencySoles },
                    { t: 'n', v: it.ejecutado, z: '"S/ "#,##0.00', s: sEjec },
                    { t: 'n', v: it.saldo, z: '"S/ "#,##0.00', s: sSaldo },
                    { t: 'n', v: it.porcentaje_avance / 100, z: '0.00%', s: sPct }
                ];
            });

            const ws = XLSX.utils.aoa_to_sheet([rowHead, ...dataRows]);
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    const valObj = (R === 0) ? rowHead[C] : dataRows[R - 1][C];
                    if (ws[addr] && valObj) {
                        if (valObj.s) ws[addr].s = valObj.s;
                        if (valObj.z) ws[addr].z = valObj.z;
                    }
                }
            }

            ws['!cols'] = [
                { wch: 35 }, // presupuesto
                { wch: 50 }, // N1
                { wch: 20 }, // Presupuestado
                { wch: 20 }, // Ejecutado
                { wch: 20 }, // Saldo
                { wch: 16 }  // % Avance
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto202403Pct');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `PresupuestosPAB_202403_Porcentaje_${fechaStr}.xlsx`);
        });

        this.setupTooltips();
    },

    setupTooltips() {
        const tooltip = document.getElementById('tooltip-presupuesto-pct-pab');
        if (!tooltip) return;

        const posicionarTooltip = (e) => {
            const offsetX = 16;
            const offsetY = 16;
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;

            let posX = e.clientX + offsetX;
            let posY = e.clientY + offsetY;

            if (posX + tooltipWidth > window.innerWidth) {
                posX = e.clientX - tooltipWidth - 10;
            }
            if (posY + tooltipHeight > window.innerHeight) {
                posY = e.clientY - tooltipHeight - 10;
            }

            tooltip.style.left = `${posX}px`;
            tooltip.style.top = `${posY}px`;
        };

        // 1. Tooltip para Celdas Regulares (N1)
        document.querySelectorAll('.tooltip-cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                const n1 = cell.getAttribute('data-n1') || '';
                const presupuesto = cell.getAttribute('data-presupuesto') || '';
                const colname = cell.getAttribute('data-colname') || '';
                const colval = cell.getAttribute('data-colval') || '';

                tooltip.innerHTML = `
                    <div class="space-y-1 text-slate-700 select-none text-[11px] leading-snug min-w-[240px] max-w-[340px]">
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">n1:</span><span class="col-span-8 font-bold text-slate-900">${n1}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">presupuesto:</span><span class="col-span-8 font-bold text-slate-900">${presupuesto}</span></div>
                        <div class="grid grid-cols-12 gap-x-2 border-t border-slate-100 pt-1 mt-1"><span class="col-span-5 text-slate-700 font-semibold">${colname}:</span><span class="col-span-7 font-mono font-bold text-blue-700">${colval}</span></div>
                    </div>
                `;
                tooltip.classList.remove('hidden');
            });

            cell.addEventListener('mousemove', posicionarTooltip);
            cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
        });

        // 2. Tooltip para Total General
        document.querySelectorAll('.tooltip-total-cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                const presupuesto = cell.getAttribute('data-presupuesto') || '';
                const colname = cell.getAttribute('data-colname') || '';
                const colval = cell.getAttribute('data-colval') || '';

                tooltip.innerHTML = `
                    <div class="space-y-1 text-slate-700 select-none text-[11px] leading-snug min-w-[220px]">
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">presupuesto:</span><span class="col-span-8 font-bold text-slate-900">${presupuesto}</span></div>
                        <div class="grid grid-cols-12 gap-x-2 border-t border-slate-100 pt-1 mt-1"><span class="col-span-5 text-slate-700 font-semibold">${colname}:</span><span class="col-span-7 font-mono font-bold text-blue-800">${colval}</span></div>
                    </div>
                `;
                tooltip.classList.remove('hidden');
            });

            cell.addEventListener('mousemove', posicionarTooltip);
            cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
        });
    }
};

window.ChartRegistry['DashPresupuesto202403Pct'] = window.ChartPresupuesto202403Pct;
window.ChartRegistry['DashPresupuesto202403%'] = window.ChartPresupuesto202403Pct;
window.ChartRegistry['Presupuesto202403%'] = window.ChartPresupuesto202403Pct;
