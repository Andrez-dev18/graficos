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

                    // Helper para atributos de tooltip en celdas regulares
                    const makeCellAttrs = (colName, colVal) => {
                        return `data-amarre="${this.escapeHtml(it.amarre)}" ` +
                               `data-n1="${this.escapeHtml(gN1.nombre)}" ` +
                               `data-n2="${this.escapeHtml(gN2.nombre)}" ` +
                               `data-nompartida="${this.escapeHtml(it.nompartida)}" ` +
                               `data-nropartida="${this.escapeHtml(it.nropartida)}" ` +
                               `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                               `data-colname="${this.escapeHtml(colName)}" ` +
                               `data-colval="${this.escapeHtml(colVal)}"`;
                    };

                    rowsHtml.push(`
                        <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-200 text-[11px] text-slate-700">
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${esPrimeraFilaGlobal ? presupuestoNombre : ''}</td>
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${gN1.nombre}</td>
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top">${gN2.nombre}</td>
                            <td class="px-2 py-1.5 font-mono text-center text-slate-600 border-r border-slate-200">${it.nropartida}</td>
                            <td class="px-2 py-1.5 font-mono text-center text-slate-600 border-r border-slate-200">${it.amarre}</td>
                            <td class="px-2.5 py-1.5 font-normal text-slate-700 border-r border-slate-200 max-w-[240px] truncate" title="${it.nompartida}">${it.nompartida}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Presupuestado', this.formatSoles(it.presupuestado))}>${this.formatSoles(it.presupuestado)}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Ejecutado', this.formatSoles(it.ejecutado))}>${this.formatSoles(it.ejecutado)}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('Saldo', this.formatSoles(it.saldo))}>${this.formatSoles(it.saldo)}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('valord_presupuesto', this.formatDolares(it.valord_presupuesto))}>${this.formatDolares(it.valord_presupuesto)}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('valord_regcompras', this.formatDolares(it.valord_regcompras))}>${this.formatDolares(it.valord_regcompras)}</td>
                            <td class="tooltip-cell px-2.5 py-1.5 font-mono text-right ${difClass} cursor-pointer hover:bg-blue-100/50" ${makeCellAttrs('diferenciad', this.formatDolares(it.diferenciad))}>${this.formatDolares(it.diferenciad)}</td>
                        </tr>
                    `);
                    esPrimeraFilaGlobal = false;
                });

                // Fila de Total N2 (Subtotal de la partida N2)
                const ejecN2Class = getEjecutadoClass(gN2.total.ejecutado, true);
                const saldoN2Class = getSaldoClass(gN2.total.saldo, true);
                const ejecDolarN2Class = getEjecutadoDolarClass(gN2.total.valord_regcompras, true);
                const difN2Class = getSaldoClass(gN2.total.diferenciad, true);

                const makeSubtotalN2Attrs = (colName, colVal) => {
                    return `data-n1="${this.escapeHtml(gN1.nombre)}" ` +
                           `data-n2="${this.escapeHtml(gN2.nombre)}" ` +
                           `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                           `data-colname="Total ${this.escapeHtml(colName)}" ` +
                           `data-colval="${this.escapeHtml(colVal)}"`;
                };

                rowsHtml.push(`
                    <tr class="bg-slate-50/60 border-b border-slate-200 text-[11px] text-slate-800 font-semibold">
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200">Total</td>
                        <td class="px-2 py-1.5 border-r border-slate-200"></td>
                        <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('Presupuestado', this.formatSoles(gN2.total.presupuestado))}>${this.formatSoles(gN2.total.presupuestado)}</td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecN2Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('Ejecutado', this.formatSoles(gN2.total.ejecutado))}>${this.formatSoles(gN2.total.ejecutado)}</td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoN2Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('Saldo', this.formatSoles(gN2.total.saldo))}>${this.formatSoles(gN2.total.saldo)}</td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('valord_presupuesto', this.formatDolares(gN2.total.valord_presupuesto))}>${this.formatDolares(gN2.total.valord_presupuesto)}</td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarN2Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('valord_regcompras', this.formatDolares(gN2.total.valord_regcompras))}>${this.formatDolares(gN2.total.valord_regcompras)}</td>
                        <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right ${difN2Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN2Attrs('diferenciad', this.formatDolares(gN2.total.diferenciad))}>${this.formatDolares(gN2.total.diferenciad)}</td>
                    </tr>
                `);
            });

            // Fila de Total N1 (Subtotal de la categoría N1)
            const ejecN1Class = getEjecutadoClass(gN1.total.ejecutado, true);
            const saldoN1Class = getSaldoClass(gN1.total.saldo, true);
            const ejecDolarN1Class = getEjecutadoDolarClass(gN1.total.valord_regcompras, true);
            const difN1Class = getSaldoClass(gN1.total.diferenciad, true);

            const makeSubtotalN1Attrs = (colName, colVal) => {
                return `data-n1="${this.escapeHtml(gN1.nombre)}" ` +
                       `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                       `data-colname="Total ${this.escapeHtml(colName)}" ` +
                       `data-colval="${this.escapeHtml(colVal)}"`;
            };

            rowsHtml.push(`
                <tr class="bg-slate-100/80 border-b-2 border-slate-300 text-[11px] text-slate-900 font-bold">
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 text-left border-r border-slate-200">Total</td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2 py-1.5 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1.5 border-r border-slate-200"></td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('Presupuestado', this.formatSoles(gN1.total.presupuestado))}>${this.formatSoles(gN1.total.presupuestado)}</td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecN1Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('Ejecutado', this.formatSoles(gN1.total.ejecutado))}>${this.formatSoles(gN1.total.ejecutado)}</td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${saldoN1Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('Saldo', this.formatSoles(gN1.total.saldo))}>${this.formatSoles(gN1.total.saldo)}</td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('valord_presupuesto', this.formatDolares(gN1.total.valord_presupuesto))}>${this.formatDolares(gN1.total.valord_presupuesto)}</td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right border-r border-slate-200 ${ejecDolarN1Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('valord_regcompras', this.formatDolares(gN1.total.valord_regcompras))}>${this.formatDolares(gN1.total.valord_regcompras)}</td>
                    <td class="tooltip-subtotal-cell px-2.5 py-1.5 font-mono text-right ${difN1Class} cursor-pointer hover:bg-blue-100/50" ${makeSubtotalN1Attrs('diferenciad', this.formatDolares(gN1.total.diferenciad))}>${this.formatDolares(gN1.total.diferenciad)}</td>
                </tr>
            `);
        });

        // Estructura completa del card y tabla
        const grandEjecClass = getEjecutadoClass(grandTotal.ejecutado, true);
        const grandSaldoClass = getSaldoClass(grandTotal.saldo, true);
        const grandEjecDolarClass = getEjecutadoDolarClass(grandTotal.valord_regcompras, true);
        const grandDifClass = getSaldoClass(grandTotal.diferenciad, true);

        const makeTotalGeneralAttrs = (colName, colVal) => {
            return `data-presupuesto="${this.escapeHtml(presupuestoNombre)}" ` +
                   `data-colname="Total General ${this.escapeHtml(colName)}" ` +
                   `data-colval="${this.escapeHtml(colVal)}"`;
        };

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
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right border-r border-slate-300 cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('Presupuestado', this.formatSoles(grandTotal.presupuestado))}>${this.formatSoles(grandTotal.presupuestado)}</td>
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandEjecClass} cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('Ejecutado', this.formatSoles(grandTotal.ejecutado))}>${this.formatSoles(grandTotal.ejecutado)}</td>
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandSaldoClass} cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('Saldo', this.formatSoles(grandTotal.saldo))}>${this.formatSoles(grandTotal.saldo)}</td>
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right border-r border-slate-300 cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('valord_presupuesto', this.formatDolares(grandTotal.valord_presupuesto))}>${this.formatDolares(grandTotal.valord_presupuesto)}</td>
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right border-r border-slate-300 ${grandEjecDolarClass} cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('valord_regcompras', this.formatDolares(grandTotal.valord_regcompras))}>${this.formatDolares(grandTotal.valord_regcompras)}</td>
                                <td class="tooltip-total-cell px-2.5 py-2 font-mono text-right ${grandDifClass} cursor-pointer hover:bg-blue-100/50" ${makeTotalGeneralAttrs('diferenciad', this.formatDolares(grandTotal.diferenciad))}>${this.formatDolares(grandTotal.diferenciad)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- TOOLTIP FLOTANTE TIPO TABLEAU -->
                <div id="tooltip-presupuesto-pab" class="fixed z-50 pointer-events-none hidden bg-white/95 backdrop-blur-xs p-3 rounded-xl shadow-2xl border border-slate-200 text-xs transition-opacity duration-150"></div>
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

        this.setupTooltips();
    },

    setupTooltips() {
        const tooltip = document.getElementById('tooltip-presupuesto-pab');
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

        // 1. Tooltip para Celdas Regulares
        document.querySelectorAll('.tooltip-cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                const amarre = cell.getAttribute('data-amarre') || '';
                const n1 = cell.getAttribute('data-n1') || '';
                const n2 = cell.getAttribute('data-n2') || '';
                const nompartida = cell.getAttribute('data-nompartida') || '';
                const nropartida = cell.getAttribute('data-nropartida') || '';
                const presupuesto = cell.getAttribute('data-presupuesto') || '';
                const colname = cell.getAttribute('data-colname') || '';
                const colval = cell.getAttribute('data-colval') || '';

                tooltip.innerHTML = `
                    <div class="space-y-1 text-slate-700 select-none text-[11px] leading-snug min-w-[260px] max-w-[360px]">
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">amarre:</span><span class="col-span-8 font-bold text-slate-900 font-mono">${amarre}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">n1:</span><span class="col-span-8 font-bold text-slate-900">${n1}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">n2:</span><span class="col-span-8 font-bold text-slate-900">${n2}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">nompartida:</span><span class="col-span-8 font-bold text-slate-900">${nompartida}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">nropartida:</span><span class="col-span-8 font-bold text-slate-900 font-mono">${nropartida}</span></div>
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">presupuesto:</span><span class="col-span-8 font-bold text-slate-900">${presupuesto}</span></div>
                        <div class="grid grid-cols-12 gap-x-2 border-t border-slate-100 pt-1 mt-1"><span class="col-span-5 text-slate-700 font-semibold">${colname}:</span><span class="col-span-7 font-mono font-bold text-blue-700">${colval}</span></div>
                    </div>
                `;
                tooltip.classList.remove('hidden');
            });

            cell.addEventListener('mousemove', posicionarTooltip);
            cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
        });

        // 2. Tooltip para Subtotales
        document.querySelectorAll('.tooltip-subtotal-cell').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                const n1 = cell.getAttribute('data-n1') || '';
                const n2 = cell.getAttribute('data-n2') || '';
                const presupuesto = cell.getAttribute('data-presupuesto') || '';
                const colname = cell.getAttribute('data-colname') || '';
                const colval = cell.getAttribute('data-colval') || '';

                tooltip.innerHTML = `
                    <div class="space-y-1 text-slate-700 select-none text-[11px] leading-snug min-w-[240px]">
                        ${n1 ? `<div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">n1:</span><span class="col-span-8 font-bold text-slate-900">${n1}</span></div>` : ''}
                        ${n2 ? `<div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">n2:</span><span class="col-span-8 font-bold text-slate-900">${n2}</span></div>` : ''}
                        <div class="grid grid-cols-12 gap-x-2"><span class="col-span-4 text-slate-500 font-normal">presupuesto:</span><span class="col-span-8 font-bold text-slate-900">${presupuesto}</span></div>
                        <div class="grid grid-cols-12 gap-x-2 border-t border-slate-100 pt-1 mt-1"><span class="col-span-5 text-slate-700 font-semibold">${colname}:</span><span class="col-span-7 font-mono font-bold text-blue-700">${colval}</span></div>
                    </div>
                `;
                tooltip.classList.remove('hidden');
            });

            cell.addEventListener('mousemove', posicionarTooltip);
            cell.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
        });

        // 3. Tooltip para Total General
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

window.ChartRegistry['DashPresupuesto202410'] = window.ChartPresupuesto202410;
window.ChartRegistry['Presupuesto202410'] = window.ChartPresupuesto202410;
