/**
 * Componente de Gráfico / Vista: AnalisisPartidas (Compras por Partida)
 * Módulo: Presupuestos PAB
 * 
 * Replicación exacta del dashboard "AnalisisPartidas" de Tableau (Hoja RC / Compras por Partida):
 * - El filtro "Presupuesto" se ubica en la barra superior de filtros de la aplicación (solo visible cuando este reporte está activo).
 * - Leyenda exacta de TipoDoc:
 *   - 01: #4E79A7 (Azul Tableau)
 *   - 50: #FF9D9A (Salmón Tableau)
 *   - 91: #E15759 (Rojo Tableau)
 *   - Total: #59A14F (Verde Tableau)
 * - Tabla con columnas: Partida, Zona, TipoD.., SerieAlfa, NroDoc, RUC, nombre, Cencos, Valor.
 * - Gráfico de barras horizontales con el color exacto de TipoDoc y barra verde en cada subtotal "Total".
 * - Texto | S/1.000,00 inmediatamente tras la barra.
 * - Eje graduado inferior (0K, 20K, 40K ... 340K) con etiqueta "Valor".
 * - Exportación a Excel completa.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPartidas = {
    controllerRef: null,
    datosBackend: null,
    solesFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        this.renderStructure();
        this.setupEventListeners();
    },

    formatSoles(val) {
        if (val === null || val === undefined || isNaN(val)) return 'S/0,00';
        const isNeg = val < 0;
        const absVal = Math.abs(val);
        const fmt = this.solesFormatter.format(absVal);
        return isNeg ? `S/-${fmt}` : `S/${fmt}`;
    },

    getBarColor(tipodoc) {
        const tipo = String(tipodoc || '').trim();
        switch (tipo) {
            case '01':
                return '#4E79A7'; // Azul Tableau
            case '50':
                return '#FF9D9A'; // Salmón / Rosa Tableau
            case '91':
                return '#E15759'; // Rojo Tableau
            case '02':
                return '#F28E2B'; // Naranja Tableau
            case '07':
                return '#EDC948'; // Amarillo Tableau
            case '97':
                return '#76B7B2'; // Turquesa Tableau
            case '00':
                return '#B07AA1'; // Púrpura Tableau
            case 'Total':
                return '#59A14F'; // Verde Tableau Subtotales
            default:
                return '#76B7B2';
        }
    },

    renderStructure() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const titulo = data.titulo || "Compras por Partida";
        const presuSeleccionado = data.presupuesto_seleccionado || '202410';
        const partidas = data.partidas || [];
        const granTotal = data.gran_total || 0;
        const totalDocs = data.total_documentos || 0;

        // Calcular el valor máximo global para la escala de las barras
        let maxValGlobal = 0;
        partidas.forEach(p => {
            if (p.subtotal > maxValGlobal) maxValGlobal = p.subtotal;
            (p.items || []).forEach(it => {
                if (it.valor > maxValGlobal) maxValGlobal = it.valor;
            });
        });
        if (maxValGlobal <= 0) maxValGlobal = 1000;

        // Redondear escala superior para el eje graduado (ej: 340K para 202410)
        let maxScale = Math.ceil(maxValGlobal * 1.15);
        if (maxScale < 1000) maxScale = 1000;
        const rawStep = maxScale / 8;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        let step = Math.ceil(rawStep / magnitude) * magnitude;
        if (step <= 0) step = 1000;
        maxScale = Math.ceil(maxScale / step) * step;

        // Generar ticks para el eje graduado
        const ticks = [];
        for (let v = 0; v <= maxScale; v += step) {
            const label = v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`);
            ticks.push({ val: v, label, pct: (v / maxScale) * 100 });
        }

        // Generar filas de la tabla
        let rowsHtml = '';
        partidas.forEach((p) => {
            const items = p.items || [];
            items.forEach((it, itIdx) => {
                const barWidthPct = (it.valor > 0) ? Math.min(100, Math.max(0.5, (it.valor / maxScale) * 100)) : 0;
                const barColor = this.getBarColor(it.tipodoc);
                const glosaEscapada = (it.glosa || '').replace(/"/g, '&quot;');

                rowsHtml += `
                    <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-200 text-xs text-slate-700" title="${glosaEscapada}">
                        <td class="px-2.5 py-1.5 font-medium text-slate-900 border-r border-slate-200 align-top whitespace-nowrap">${itIdx === 0 ? p.partida : ''}</td>
                        <td class="px-2 py-1.5 font-medium text-slate-700 border-r border-slate-200 align-top whitespace-nowrap">${it.zona}</td>
                        <td class="px-2 py-1.5 font-medium text-slate-700 border-r border-slate-200 align-top text-center whitespace-nowrap">${it.tipodoc}</td>
                        <td class="px-2 py-1.5 font-medium text-slate-700 border-r border-slate-200 align-top whitespace-nowrap">${it.seriealfa}</td>
                        <td class="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-200 align-top whitespace-nowrap">${it.nrodoc}</td>
                        <td class="px-2.5 py-1.5 font-mono text-slate-700 border-r border-slate-200 align-top whitespace-nowrap">${it.ruc}</td>
                        <td class="px-2.5 py-1.5 text-slate-800 border-r border-slate-200 align-top max-w-[260px] truncate" title="${it.nombre}">${it.nombre}</td>
                        <td class="px-2 py-1.5 font-medium text-slate-600 border-r border-slate-200 align-top whitespace-nowrap">${it.cencos}</td>
                        
                        <!-- COLUMNA GRÁFICA DE BARRA (VALOR) -->
                        <td class="px-2 py-1 align-middle min-w-[380px] w-full">
                            <div class="flex items-center gap-1.5 w-full h-5">
                                ${it.valor > 0 ? `
                                    <div class="h-4 rounded-none transition-all duration-300 shrink-0" style="width: ${barWidthPct}%; background-color: ${barColor}; min-width: 4px;"></div>
                                ` : ''}
                                <span class="text-[11px] font-mono text-slate-800 whitespace-nowrap select-none font-normal shrink-0">
                                    | ${this.formatSoles(it.valor)}
                                </span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            // Fila de SUBTOTAL "Total" de la Partida
            const subtotalWidthPct = (p.subtotal > 0) ? Math.min(100, Math.max(0.5, (p.subtotal / maxScale) * 100)) : 0;
            const subtotalColor = this.getBarColor('Total');

            rowsHtml += `
                <tr class="bg-white border-b-2 border-slate-300 text-xs font-medium text-slate-800">
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 font-normal text-slate-700 border-r border-slate-200 text-left">
                        Total
                    </td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    
                    <!-- BARRA VERDE DE SUBTOTAL -->
                    <td class="px-2 py-1 align-middle min-w-[380px] w-full">
                        <div class="flex items-center gap-1.5 w-full h-5">
                            ${p.subtotal > 0 ? `
                                <div class="h-4 rounded-none transition-all duration-300 shrink-0" style="width: ${subtotalWidthPct}%; background-color: ${subtotalColor}; min-width: 4px;"></div>
                            ` : ''}
                            <span class="text-[11px] font-mono text-slate-900 whitespace-nowrap select-none font-normal shrink-0">
                                | ${this.formatSoles(p.subtotal)}
                            </span>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Eje inferior graduado
        const axisHtml = `
            <div class="relative w-full h-8 pt-1 select-none">
                <div class="relative w-full h-4">
                    ${ticks.map(t => `
                        <div class="absolute -translate-x-1/2 flex flex-col items-center" style="left: ${t.pct}%;">
                            <div class="w-px h-1.5 bg-slate-400 mb-0.5"></div>
                            <span class="text-[10px] font-mono text-slate-500">${t.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="text-center text-[11px] font-bold text-slate-600 tracking-wider uppercase mt-1">
                    Valor
                </div>
            </div>
        `;

        const tableHtml = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col w-full">
                <!-- ENCABEZADO DE TARJETA CON LEYENDA Y EXCEL -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div class="flex items-center gap-3">
                        <div>
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">AnalisisPartidas</h2>
                            <p class="text-xs text-slate-500 font-medium">Presupuesto: <span class="font-bold text-blue-700 font-mono">${presuSeleccionado}</span></p>
                        </div>
                        <span class="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                            ${partidas.length} partidas / ${totalDocs} registros
                        </span>
                    </div>

                    <!-- LEYENDA TIPODOC Y BOTÓN EXCEL -->
                    <div class="flex flex-wrap items-center gap-4 ml-auto">
                        
                        <!-- LEYENDA DE TIPODOC TABLEAU -->
                        <div class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
                            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wide">TipoDoc:</span>
                            <div class="flex items-center gap-1.5">
                                <span class="w-3.5 h-3.5 inline-block shrink-0 rounded-2xs" style="background-color: #4E79A7;"></span>
                                <span class="text-xs font-semibold text-slate-700">01</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="w-3.5 h-3.5 inline-block shrink-0 rounded-2xs" style="background-color: #FF9D9A;"></span>
                                <span class="text-xs font-semibold text-slate-700">50</span>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <span class="w-3.5 h-3.5 inline-block shrink-0 rounded-2xs" style="background-color: #E15759;"></span>
                                <span class="text-xs font-semibold text-slate-700">91</span>
                            </div>
                            <div class="flex items-center gap-1.5 border-l border-slate-300 pl-2">
                                <span class="w-3.5 h-3.5 inline-block shrink-0 rounded-2xs" style="background-color: #59A14F;"></span>
                                <span class="text-xs font-bold text-slate-800">Total</span>
                            </div>
                        </div>

                        <!-- BOTÓN EXPORTAR EXCEL -->
                        <button id="btn-export-excel-pab" type="button"
                            class="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>
                </div>

                <!-- ÁREA PRINCIPAL: TÍTULO + TABLA FULL WIDTH -->
                <div class="p-4 w-full flex flex-col">
                    
                    <!-- TÍTULO DE REPORTE ESTILO TABLEAU -->
                    <div class="w-full bg-white py-2 text-center select-none mb-3">
                        <h1 class="text-lg font-bold text-slate-800 tracking-wide underline underline-offset-4 decoration-slate-400">
                            ${titulo}
                        </h1>
                    </div>

                    <!-- TABLA SCROLLEABLE FULL WIDTH -->
                    <div class="overflow-x-auto overflow-y-auto max-h-[700px] custom-scrollbar border border-slate-200 rounded-lg w-full">
                        <table id="tabla-analisis-partidas" class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                            <thead class="sticky top-0 z-20 shadow-xs bg-blue-600">
                                <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-700">
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 min-w-[65px]">Partida</th>
                                    <th class="px-2 py-2.5 text-left border-r border-blue-500/60 min-w-[50px]">Zona</th>
                                    <th class="px-2 py-2.5 text-center border-r border-blue-500/60 min-w-[50px]">TipoD..</th>
                                    <th class="px-2 py-2.5 text-left border-r border-blue-500/60 min-w-[60px]">SerieAlfa</th>
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 min-w-[90px]">NroDoc</th>
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 min-w-[105px]">RUC</th>
                                    <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 min-w-[240px]">nombre</th>
                                    <th class="px-2 py-2.5 text-left border-r border-blue-500/60 min-w-[60px]">Cencos</th>
                                    <th class="px-2.5 py-2.5 text-left min-w-[380px]">Valor</th>
                                </tr>
                            </thead>
                            <tbody id="tbody-analisis-partidas" class="divide-y divide-slate-100 bg-white">
                                ${rowsHtml}
                            </tbody>
                            <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-xs text-slate-900 shadow-md">
                                <tr>
                                    <td class="px-2.5 py-2 border-r border-slate-300"></td>
                                    <td class="px-2 py-2 text-left font-bold text-slate-900 border-r border-slate-300" colspan="7">
                                        Gran Total
                                    </td>
                                    <td class="px-2.5 py-2 font-mono text-left font-bold text-slate-900">
                                        | ${this.formatSoles(granTotal)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        <!-- EJE GRADUADO INFERIOR -->
                        <div class="px-4 py-2 bg-white border-t border-slate-200 w-full">
                            <div class="flex w-full">
                                <div class="w-[670px] shrink-0"></div>
                                <div class="flex-1 min-w-[380px]">
                                    ${axisHtml}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        contenedor.innerHTML = tableHtml;
    },

    setupEventListeners() {
        // Botón Exportar a Excel
        const btnExport = document.getElementById('btn-export-excel-pab');
        if (!btnExport) return;

        const newBtn = btnExport.cloneNode(true);
        btnExport.parentNode.replaceChild(newBtn, btnExport);

        newBtn.addEventListener('click', () => {
            const data = this.datosBackend || {};
            const partidas = data.partidas || [];
            if (!partidas.length) {
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

            const dataStyleCenter = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "center" }
            };

            const dataStyleCurrency = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const subtotalStyle = {
                fill: { fgColor: { rgb: "F1F5F9" } },
                font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "166534" } },
                alignment: { vertical: "center", horizontal: "right" },
                border: {
                    top: { style: "thin", color: { rgb: "CBD5E1" } },
                    bottom: { style: "medium", color: { rgb: "94A3B8" } }
                }
            };

            const rowHead = [
                { t: 's', v: 'Partida', s: headerStyle },
                { t: 's', v: 'Zona', s: headerStyle },
                { t: 's', v: 'TipoDoc', s: headerStyle },
                { t: 's', v: 'SerieAlfa', s: headerStyle },
                { t: 's', v: 'NroDoc', s: headerStyle },
                { t: 's', v: 'RUC', s: headerStyle },
                { t: 's', v: 'Nombre / Proveedor', s: headerStyle },
                { t: 's', v: 'Cencos', s: headerStyle },
                { t: 's', v: 'Glosa', s: headerStyle },
                { t: 's', v: 'Valor', s: headerStyle }
            ];

            const dataRows = [];
            partidas.forEach(p => {
                (p.items || []).forEach(it => {
                    dataRows.push([
                        { t: 's', v: it.partida || '', s: dataStyleCenter },
                        { t: 's', v: it.zona || '', s: dataStyleCenter },
                        { t: 's', v: it.tipodoc || '', s: dataStyleCenter },
                        { t: 's', v: it.seriealfa || '', s: dataStyleCenter },
                        { t: 's', v: it.nrodoc || '', s: dataStyleLeft },
                        { t: 's', v: it.ruc || '', s: dataStyleLeft },
                        { t: 's', v: it.nombre || '', s: dataStyleLeft },
                        { t: 's', v: it.cencos || '', s: dataStyleCenter },
                        { t: 's', v: it.glosa || '', s: dataStyleLeft },
                        { t: 'n', v: it.valor, z: '"S/ "#,##0.00', s: dataStyleCurrency }
                    ]);
                });

                // Fila de subtotal de partida
                dataRows.push([
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: 'Total ' + p.partida, s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 's', v: '', s: subtotalStyle },
                    { t: 'n', v: p.subtotal, z: '"S/ "#,##0.00', s: subtotalStyle }
                ]);
            });

            // Fila Gran Total
            dataRows.push([
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: 'Gran Total', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 'n', v: data.gran_total || 0, z: '"S/ "#,##0.00', s: headerStyle }
            ]);

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
                { wch: 10 }, // Partida
                { wch: 8 },  // Zona
                { wch: 8 },  // TipoDoc
                { wch: 10 }, // SerieAlfa
                { wch: 14 }, // NroDoc
                { wch: 14 }, // RUC
                { wch: 38 }, // Nombre
                { wch: 10 }, // Cencos
                { wch: 40 }, // Glosa
                { wch: 18 }  // Valor
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'ComprasPorPartida');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Compras_Por_Partida_${data.presupuesto_seleccionado || '202410'}_${fechaStr}.xlsx`);
        });
    }
};

window.ChartRegistry['AnalisisPartidas'] = window.ChartAnalisisPartidas;
window.ChartRegistry['ComprasPorPartida'] = window.ChartAnalisisPartidas;
window.ChartRegistry['RC'] = window.ChartAnalisisPartidas;
