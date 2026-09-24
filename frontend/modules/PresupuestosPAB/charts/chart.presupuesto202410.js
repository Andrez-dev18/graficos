/**
 * Componente de Gráfico / Vista: DashPresupuesto202410
 * Módulo: Presupuestos PAB
 * 
 * Renderiza la matriz de Presupuestos Planta Incubacion según Tableau (Hoja Presupuesto202410 / DashPresupuesto202410),
 * con estructura jerárquica (presupuesto, N1, N2, nropartida, amarre, nompartida),
 * subtotales por N2, N1 y Total General, formato de moneda en Soles (S/) y Dólares (US$),
 * cabeceras clásicas en azul (bg-blue-600 text-white), resaltado de diferencias negativas en rojo,
 * enlaces ejecutados en azul y exportación a Excel con estilos Tableau.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartPresupuesto202410 = {
    controllerRef: null,
    datosBackend: null,
    solesFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    dolaresFormatter: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

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

    formatDolares(val) {
        if (val === null || val === undefined || isNaN(val)) return 'US$0,00';
        const isNeg = val < 0;
        const absVal = Math.abs(val);
        const fmt = this.solesFormatter.format(absVal);
        return isNeg ? `US$-${fmt}` : `US$${fmt}`;
    },

    renderTableStructure() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const items = data.items || [];
        const presupuestoNombre = data.presupuesto_nombre || "202410 IMPLEMENTACIÓN EQUIPOS NIR";
        const titulo = data.titulo || "Presupuestos Planta Incubacion";

        // Agrupar items por N1 y N2 para calcular subtotales y renderizar con jerarquía
        const gruposN1 = {};
        let grandTotal = {
            presupuestado: 0,
            ejecutado: 0,
            saldo: 0,
            valord_presupuesto: 0,
            valord_regcompras: 0,
            diferenciad: 0
        };

        items.forEach(item => {
            const n1 = item.n1 || "OTROS";
            const n2 = item.n2 || "OTROS";

            if (!gruposN1[n1]) {
                gruposN1[n1] = {
                    nombre: n1,
                    gruposN2: {},
                    total: { presupuestado: 0, ejecutado: 0, saldo: 0, valord_presupuesto: 0, valord_regcompras: 0, diferenciad: 0 }
                };
            }

            if (!gruposN1[n1].gruposN2[n2]) {
                gruposN1[n1].gruposN2[n2] = {
                    nombre: n2,
                    items: [],
                    total: { presupuestado: 0, ejecutado: 0, saldo: 0, valord_presupuesto: 0, valord_regcompras: 0, diferenciad: 0 }
                };
            }

            gruposN1[n1].gruposN2[n2].items.push(item);

            // Acumular subtotal N2
            gruposN1[n1].gruposN2[n2].total.presupuestado += (item.presupuestado || 0);
            gruposN1[n1].gruposN2[n2].total.ejecutado += (item.ejecutado || 0);
            gruposN1[n1].gruposN2[n2].total.saldo += (item.saldo || 0);
            gruposN1[n1].gruposN2[n2].total.valord_presupuesto += (item.valord_presupuesto || 0);
            gruposN1[n1].gruposN2[n2].total.valord_regcompras += (item.valord_regcompras || 0);
            gruposN1[n1].gruposN2[n2].total.diferenciad += (item.diferenciad || 0);

            // Acumular subtotal N1
            gruposN1[n1].total.presupuestado += (item.presupuestado || 0);
            gruposN1[n1].total.ejecutado += (item.ejecutado || 0);
            gruposN1[n1].total.saldo += (item.saldo || 0);
            gruposN1[n1].total.valord_presupuesto += (item.valord_presupuesto || 0);
            gruposN1[n1].total.valord_regcompras += (item.valord_regcompras || 0);
            gruposN1[n1].total.diferenciad += (item.diferenciad || 0);

            // Acumular gran total
            grandTotal.presupuestado += (item.presupuestado || 0);
            grandTotal.ejecutado += (item.ejecutado || 0);
            grandTotal.saldo += (item.saldo || 0);
            grandTotal.valord_presupuesto += (item.valord_presupuesto || 0);
            grandTotal.valord_regcompras += (item.valord_regcompras || 0);
            grandTotal.diferenciad += (item.diferenciad || 0);
        });

        // Generar filas HTML
        const rowsHtml = [];
        const n1Keys = Object.keys(gruposN1);
        let esPrimeraFilaGlobal = true;

        const getSaldoClass = (val, isBold = false) => {
            const b = isBold ? 'font-bold' : 'font-semibold';
            if (val < -0.001) return `text-red-600 ${b}`;
            if (val > 0.001) return `text-emerald-700 ${b}`;
            return `text-slate-500 font-normal`;
        };

        const getEjecutadoClass = (val, isTotal = false) => {
            if (val > 0) {
                return isTotal 
                    ? 'text-blue-700 font-bold' 
                    : 'text-blue-700 font-medium underline decoration-blue-300 cursor-pointer';
            }
            return isTotal ? 'text-slate-400 font-bold' : 'text-slate-400 font-normal';
        };

        const getEjecutadoDolarClass = (val, isTotal = false) => {
            if (val > 0) {
                return isTotal ? 'text-blue-700 font-bold' : 'text-blue-700 font-medium';
            }
            return isTotal ? 'text-slate-400 font-bold' : 'text-slate-400 font-normal';
        };

        n1Keys.forEach((n1Key) => {
            const gN1 = gruposN1[n1Key];
            const n2Keys = Object.keys(gN1.gruposN2);

            n2Keys.forEach((n2Key) => {
                const gN2 = gN1.gruposN2[n2Key];

                // Filas de partidas individuales
                gN2.items.forEach((it) => {
                    const ejecClass = getEjecutadoClass(it.ejecutado, false);
                    const saldoClass = getSaldoClass(it.saldo, false);
                    const ejecDolarClass = getEjecutadoDolarClass(it.valord_regcompras, false);
                    const difClass = getSaldoClass(it.diferenciad, false);

                    rowsHtml.push(`
                        <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-200 text-[11px] text-slate-700">
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${esPrimeraFilaGlobal ? presupuestoNombre : ''}</td>
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${gN1.nombre}</td>
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${gN2.nombre}</td>
                            <td class="px-2 py-1.5 font-mono text-center text-slate-600 border-r border-slate-200">${it.nropartida}</td>
                            <td class="px-2 py-1.5 font-mono text-center text-slate-600 border-r border-slate-200">${it.amarre}</td>
                            <td class="px-2.5 py-1.5 font-normal text-slate-700 border-r border-slate-200 max-w-[240px] truncate" title="${it.nompartida}">${it.nompartida}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatSoles(it.presupuestado)}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecClass}">${this.formatSoles(it.ejecutado)}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoClass}">${this.formatSoles(it.saldo)}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatDolares(it.valord_presupuesto)}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarClass}">${this.formatDolares(it.valord_regcompras)}</td>
                            <td class="px-2.5 py-1.5 font-mono text-right ${difClass}">${this.formatDolares(it.diferenciad)}</td>
                        </tr>
                    `);
                    esPrimeraFilaGlobal = false;
                });

                // Fila de Total N2 (Subtotal de la partida N2)
                const ejecN2Class = getEjecutadoClass(gN2.total.ejecutado, true);
                const saldoN2Class = getSaldoClass(gN2.total.saldo, true);
                const ejecDolarN2Class = getEjecutadoDolarClass(gN2.total.valord_regcompras, true);
                const difN2Class = getSaldoClass(gN2.total.diferenciad, true);

                rowsHtml.push(`
                    <tr class="bg-slate-50/60 border-b border-slate-200 text-[11px] text-slate-800 font-semibold">
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200">Total</td>
                        <td class="px-2 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatSoles(gN2.total.presupuestado)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecN2Class}">${this.formatSoles(gN2.total.ejecutado)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoN2Class}">${this.formatSoles(gN2.total.saldo)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatDolares(gN2.total.valord_presupuesto)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarN2Class}">${this.formatDolares(gN2.total.valord_regcompras)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right ${difN2Class}">${this.formatDolares(gN2.total.diferenciad)}</td>
                    </tr>
                `);
            });

            // Fila de Total N1 (Subtotal de la categoría N1)
            const ejecN1Class = getEjecutadoClass(gN1.total.ejecutado, true);
            const saldoN1Class = getSaldoClass(gN1.total.saldo, true);
            const ejecDolarN1Class = getEjecutadoDolarClass(gN1.total.valord_regcompras, true);
            const difN1Class = getSaldoClass(gN1.total.diferenciad, true);

            rowsHtml.push(`
                <tr class="bg-slate-100/80 border-b-2 border-slate-300 text-[11px] text-slate-900 font-bold">
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 text-left border-r border-slate-200">Total</td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatSoles(gN1.total.presupuestado)}</td>
                    <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecN1Class}">${this.formatSoles(gN1.total.ejecutado)}</td>
                    <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoN1Class}">${this.formatSoles(gN1.total.saldo)}</td>
                    <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200">${this.formatDolares(gN1.total.valord_presupuesto)}</td>
                    <td class="px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarN1Class}">${this.formatDolares(gN1.total.valord_regcompras)}</td>
                    <td class="px-2.5 py-1.5 font-mono text-right ${difN1Class}">${this.formatDolares(gN1.total.diferenciad)}</td>
                </tr>
            `);
        });

        // Estructura completa del card y tabla
        const grandEjecClass = getEjecutadoClass(grandTotal.ejecutado, true);
        const grandSaldoClass = getSaldoClass(grandTotal.saldo, true);
        const grandEjecDolarClass = getEjecutadoDolarClass(grandTotal.valord_regcompras, true);
        const grandDifClass = getSaldoClass(grandTotal.diferenciad, true);

        const tableHtml = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <!-- ENCABEZADO DE TARJETA CON EXCEL -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div class="flex items-center gap-2">
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">DashPresupuesto202410</h2>
                        <span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">${items.length} partidas</span>
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
                            <tr class="bg-blue-600 text-white font-bold text-[11px] border-b border-blue-700">
                                <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[150px]">presupuesto</th>
                                <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[160px]">N1</th>
                                <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[180px]">N2</th>
                                <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[70px]">nropartida</th>
                                <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[70px]">amarre</th>
                                <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[220px]">nompartida</th>
                                <th class="px-2.5 py-2 text-right border-r border-blue-500/60 min-w-[120px]">Presupuestado</th>
                                <th class="px-2.5 py-2 text-right border-r border-blue-500/60 min-w-[120px]">Ejecutado</th>
                                <th class="px-2.5 py-2 text-right border-r border-blue-500/60 min-w-[120px]">Saldo</th>
                                <th class="px-2.5 py-2 text-right border-r border-blue-500/60 min-w-[130px]">valord_presupuesto</th>
                                <th class="px-2.5 py-2 text-right border-r border-blue-500/60 min-w-[130px]">valord_regcompras</th>
                                <th class="px-2.5 py-2 text-right min-w-[120px]">diferenciad</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-presupuesto-pab" class="divide-y divide-slate-100 bg-white">
                            ${rowsHtml.join('')}
                        </tbody>
                        <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-[11px] text-slate-900 shadow-md">
                            <tr>
                                <td colspan="3" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300">Total General</td>
                                <td class="px-2 py-2 border-r border-slate-300"></td>
                                <td class="px-2 py-2 border-r border-slate-300"></td>
                                <td class="px-2.5 py-2 border-r border-slate-300"></td>
                                <td class="px-2.5 py-2 font-mono text-right border-r border-slate-300">${this.formatSoles(grandTotal.presupuestado)}</td>
                                <td class="px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandEjecClass}">${this.formatSoles(grandTotal.ejecutado)}</td>
                                <td class="px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandSaldoClass}">${this.formatSoles(grandTotal.saldo)}</td>
                                <td class="px-2.5 py-2 font-mono text-right border-r border-slate-300">${this.formatDolares(grandTotal.valord_presupuesto)}</td>
                                <td class="px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandEjecDolarClass}">${this.formatDolares(grandTotal.valord_regcompras)}</td>
                                <td class="px-2.5 py-2 font-mono text-right ${grandDifClass}">${this.formatDolares(grandTotal.diferenciad)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
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

            const dataStyleCenter = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "center" }
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

            const dataStyleCurrencyDolares = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "right" }
            };

            const rowHead = [
                { t: 's', v: 'presupuesto', s: headerStyle },
                { t: 's', v: 'N1', s: headerStyle },
                { t: 's', v: 'N2', s: headerStyle },
                { t: 's', v: 'nropartida', s: headerStyle },
                { t: 's', v: 'amarre', s: headerStyle },
                { t: 's', v: 'nompartida', s: headerStyle },
                { t: 's', v: 'Presupuestado', s: headerStyle },
                { t: 's', v: 'Ejecutado', s: headerStyle },
                { t: 's', v: 'Saldo', s: headerStyle },
                { t: 's', v: 'valord_presupuesto', s: headerStyle },
                { t: 's', v: 'valord_regcompras', s: headerStyle },
                { t: 's', v: 'diferenciad', s: headerStyle }
            ];

            const dataRows = items.map(it => {
                const sEjec = it.ejecutado > 0 ? dataStyleCurrencyBlue : dataStyleCurrencyMuted;
                const sSaldo = it.saldo < -0.001 ? dataStyleCurrencyRed : (it.saldo > 0.001 ? dataStyleCurrencyGreen : dataStyleCurrencyMuted);
                const sEjecD = it.valord_regcompras > 0 ? dataStyleCurrencyBlue : dataStyleCurrencyMuted;
                const sDifD = it.diferenciad < -0.001 ? dataStyleCurrencyRed : (it.diferenciad > 0.001 ? dataStyleCurrencyGreen : dataStyleCurrencyMuted);

                return [
                    { t: 's', v: data.presupuesto_nombre || '', s: dataStyleLeft },
                    { t: 's', v: it.n1 || '', s: dataStyleLeft },
                    { t: 's', v: it.n2 || '', s: dataStyleLeft },
                    { t: 's', v: it.nropartida || '', s: dataStyleCenter },
                    { t: 's', v: it.amarre || '', s: dataStyleCenter },
                    { t: 's', v: it.nompartida || '', s: dataStyleLeft },
                    { t: 'n', v: it.presupuestado, z: '"S/ "#,##0.00', s: dataStyleCurrencySoles },
                    { t: 'n', v: it.ejecutado, z: '"S/ "#,##0.00', s: sEjec },
                    { t: 'n', v: it.saldo, z: '"S/ "#,##0.00', s: sSaldo },
                    { t: 'n', v: it.valord_presupuesto, z: '"US$ "#,##0.00', s: dataStyleCurrencyDolares },
                    { t: 'n', v: it.valord_regcompras, z: '"US$ "#,##0.00', s: sEjecD },
                    { t: 'n', v: it.diferenciad, z: '"US$ "#,##0.00', s: sDifD }
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
                { wch: 30 }, // presupuesto
                { wch: 25 }, // N1
                { wch: 25 }, // N2
                { wch: 12 }, // nropartida
                { wch: 12 }, // amarre
                { wch: 35 }, // nompartida
                { wch: 16 }, // Presupuestado
                { wch: 16 }, // Ejecutado
                { wch: 16 }, // Saldo
                { wch: 18 }, // valord_presupuesto
                { wch: 18 }, // valord_regcompras
                { wch: 16 }  // diferenciad
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto202410');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `PresupuestosPAB_202410_${fechaStr}.xlsx`);
        });
    }
};

window.ChartRegistry['DashPresupuesto202410'] = window.ChartPresupuesto202410;
window.ChartRegistry['Presupuesto202410'] = window.ChartPresupuesto202410;
