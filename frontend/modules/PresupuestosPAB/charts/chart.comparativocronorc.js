/**
 * Componente de Gráfico / Vista: DashComparativoCronoRC
 * Módulo: Presupuestos PAB
 * 
 * Replicación exacta del dashboard "DashComparativoCronoRC" de Tableau según tableu.png, tableu1.png y tableu2.png:
 * 1. Tabla Superior: "PRESUPUESTO" (~55% ancho izquierdo, lista de partidas del presupuesto agrupadas por cencos y partida).
 * 2. Tabla Inferior Izquierda: "CRONOGRAMA" (Cuotas programadas, fechas de vencimiento y subtotales por (cencos, partida) + Total General idénticos a Tableau).
 * 3. Tabla Inferior Derecha: "REGISTRO COMPRAS" (Comprobantes de compra ejecutados con RUC, Proveedor, TipoDoc, NroDoc, Fechas, Montos y subtotales por (cencos, partida) + Total General idénticos a Tableau).
 * 4. Acción Interactiva: Al hacer clic en cualquier partida de la tabla superior, sincroniza y filtra las tablas inferiores por cencos y partida.
 * 5. Exportación a Excel multi-hoja.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartComparativoCronoRC = {
    controllerRef: null,
    datosBackend: null,
    partidaSeleccionada: null,
    cencosSeleccionado: null,
    solesFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.partidaSeleccionada = null;
        this.cencosSeleccionado = null;

        this.renderStructure();
        this.setupEventListeners();
    },

    formatSoles(val) {
        if (val === null || val === undefined || isNaN(val)) return 'S/ 0.00';
        const isNeg = val < 0;
        const absVal = Math.abs(val);
        const fmt = this.solesFormatter.format(absVal);
        return isNeg ? `S/ -${fmt}` : `S/ ${fmt}`;
    },

    formatFecha(str) {
        if (!str) return '';
        const clean = String(str).trim().slice(0, 10);
        if (clean === '0000-00-00' || clean === '0000/00/00') return '0000/00/00';
        return clean.replace(/-/g, '/');
    },

    renderStructure() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const presuNombre = data.presupuesto_nombre || '202403 AMPLIACIÓN PLANTA DE ALIMENTO';
        const resumenPartidas = data.resumen_partidas || [];
        const detalleCrono = data.detalle_crono || [];
        const detalleRC = data.detalle_rc || [];

        // Filtrar si hay una partida seleccionada interactivamente (por cencos y partida)
        const cronoFiltrado = (this.partidaSeleccionada && this.cencosSeleccionado)
            ? detalleCrono.filter(c => c.cencos === this.cencosSeleccionado && c.partida === this.partidaSeleccionada)
            : (this.partidaSeleccionada
                ? detalleCrono.filter(c => c.partida === this.partidaSeleccionada)
                : detalleCrono);

        const rcFiltrado = (this.partidaSeleccionada && this.cencosSeleccionado)
            ? detalleRC.filter(r => r.cencos === this.cencosSeleccionado && r.partida === this.partidaSeleccionada)
            : (this.partidaSeleccionada
                ? detalleRC.filter(r => r.partida === this.partidaSeleccionada)
                : detalleRC);

        // Agrupar Cronograma filtrado por (cencos + partida) para subtotales y estructura jerárquica
        const cronoPorGrupo = {};
        cronoFiltrado.forEach(c => {
            const grpKey = `${c.cencos || ''}|${c.partida}`;
            if (!cronoPorGrupo[grpKey]) {
                cronoPorGrupo[grpKey] = {
                    cencos: c.cencos,
                    nombre_ccos: c.nombre_ccos,
                    partida: c.partida,
                    nompartida: c.nompartida,
                    items: [],
                    subtotal: 0.0
                };
            }
            cronoPorGrupo[grpKey].items.push(c);
            cronoPorGrupo[grpKey].subtotal += parseFloat(c.importe || 0);
        });

        // Agrupar Registro de Compras filtrado por (cencos + partida) para subtotales
        const rcPorGrupo = {};
        rcFiltrado.forEach(r => {
            const grpKey = `${r.cencos || ''}|${r.partida}`;
            if (!rcPorGrupo[grpKey]) {
                rcPorGrupo[grpKey] = {
                    cencos: r.cencos,
                    nombre_ccos: r.nombre_ccos,
                    partida: r.partida,
                    nompartida: r.nompartida,
                    items: [],
                    subtotal: 0.0
                };
            }
            rcPorGrupo[grpKey].items.push(r);
            rcPorGrupo[grpKey].subtotal += parseFloat(r.valor || 0);
        });

        // 1. FILAS TABLA SUPERIOR (PRESUPUESTO) - Agrupadas por cencos
        const cencosBlocks = {};
        resumenPartidas.forEach(p => {
            const ck = p.cencos || 'GENERAL';
            if (!cencosBlocks[ck]) {
                cencosBlocks[ck] = {
                    cencos: p.cencos,
                    nombre_ccos: p.nombre_ccos,
                    items: []
                };
            }
            cencosBlocks[ck].items.push(p);
        });

        // Calcular total de filas abarcadas por el rowspan de presupuesto (partidas + subtotales de cencos)
        let totalDataRows = resumenPartidas.length + Object.keys(cencosBlocks).length;
        let rowsPresupuestoHtml = '';
        let presuNameRendered = false;

        Object.keys(cencosBlocks).forEach((ck) => {
            const block = cencosBlocks[ck];
            const blockLen = block.items.length;

            block.items.forEach((p, idx) => {
                const isSelected = (this.partidaSeleccionada === p.partida && this.cencosSeleccionado === p.cencos);
                const rowClass = isSelected
                    ? 'bg-blue-100/90 font-bold border-l-4 border-l-blue-600'
                    : 'hover:bg-blue-50/40 transition-colors border-b border-slate-200';

                rowsPresupuestoHtml += `
                    <tr class="cursor-pointer text-xs text-slate-700 ${rowClass}" data-cencos="${p.cencos}" data-partida="${p.partida}">
                        ${!presuNameRendered ? `
                            <td class="px-3 py-2 font-medium text-slate-800 border-r border-slate-200 align-top max-w-[150px] leading-tight" rowspan="${totalDataRows}">${presuNombre}</td>
                        ` : ''}
                        ${idx === 0 ? `
                            <td class="px-2.5 py-2 font-mono text-slate-600 border-r border-slate-200 align-top whitespace-nowrap" rowspan="${blockLen + 1}">${p.cencos}</td>
                            <td class="px-3 py-2 text-slate-700 border-r border-slate-200 align-top max-w-[140px] leading-tight" rowspan="${blockLen + 1}">${p.nombre_ccos}</td>
                        ` : ''}
                        <td class="px-2.5 py-2 font-bold text-slate-900 border-r border-slate-200 text-center whitespace-nowrap align-top">${p.partida}</td>
                        <td class="px-3 py-2 text-slate-800 border-r border-slate-200 font-medium align-top max-w-[320px] truncate" title="${p.nompartida}">${p.nompartida}</td>
                        <td class="px-2.5 py-2 text-center text-blue-600 font-bold select-none text-base align-middle">
                            ●
                        </td>
                    </tr>
                `;
                presuNameRendered = true;
            });

            // Subtotal por cencos (3 celdas, pues cencos y nombre_ccos están en rowspan con la fila 1)
            rowsPresupuestoHtml += `
                <tr class="bg-slate-50/80 border-b border-slate-200 text-xs text-slate-700">
                    <td class="px-2.5 py-1.5 border-r border-slate-200 text-center font-semibold text-slate-800">Total</td>
                    <td class="px-3 py-1.5 border-r border-slate-200 font-normal text-slate-400"></td>
                    <td class="px-2.5 py-1.5 text-center text-blue-600 font-bold select-none text-base align-middle">●</td>
                </tr>
            `;
        });

        // Fila Total al pie de la tabla PRESUPUESTO (6 columnas exactas)
        const rowTotalPresupuestoHtml = `
            <tr class="bg-slate-100 border-t-2 border-slate-300 text-xs font-bold text-slate-800">
                <td class="px-3 py-2 border-r border-slate-300 text-left font-bold text-slate-900" colspan="3">Total</td>
                <td class="px-2.5 py-2 border-r border-slate-300 text-center"></td>
                <td class="px-3 py-2 border-r border-slate-300 font-normal text-slate-500"></td>
                <td class="px-2.5 py-2 text-center text-blue-600 font-bold select-none text-base align-middle">●</td>
            </tr>
        `;

        // 2. FILAS TABLA INFERIOR IZQUIERDA (CRONOGRAMA)
        let rowsCronoHtml = '';
        let totCronoCalculado = 0;
        const cronoGroupKeys = Object.keys(cronoPorGrupo);

        let totalVisualRowsCrono = 0;
        cronoGroupKeys.forEach(gKey => {
            totalVisualRowsCrono += cronoPorGrupo[gKey].items.length + 1; // items + subtotal
        });

        let cronoPresuRendered = false;
        cronoGroupKeys.forEach((gKey) => {
            const grp = cronoPorGrupo[gKey];
            totCronoCalculado += grp.subtotal;

            grp.items.forEach((it, idx) => {
                rowsCronoHtml += `
                    <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100 text-xs text-slate-700">
                        ${!cronoPresuRendered ? `
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top max-w-[130px] leading-tight" rowspan="${totalVisualRowsCrono}">${presuNombre}</td>
                        ` : ''}
                        <td class="px-2 py-1.5 font-bold text-slate-900 border-r border-slate-200 text-center whitespace-nowrap align-top">${idx === 0 ? grp.partida : ''}</td>
                        <td class="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 max-w-[200px] truncate align-top" title="${grp.nompartida}">${idx === 0 ? grp.nompartida : ''}</td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-800 border-r border-slate-200 whitespace-nowrap align-top">${it.nrocuota}</td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200 whitespace-nowrap align-top">${this.formatFecha(it.fechavenc)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right text-slate-800 whitespace-nowrap align-top">${this.formatSoles(parseFloat(it.importe))}</td>
                    </tr>
                `;
                cronoPresuRendered = true;
            });

            // Fila de Subtotal por (cencos, partida) en Cronograma
            rowsCronoHtml += `
                <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-semibold text-slate-700">Total</td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1 font-mono text-right font-bold text-slate-900 whitespace-nowrap">${this.formatSoles(grp.subtotal)}</td>
                </tr>
            `;
        });

        // 3. FILAS TABLA INFERIOR DERECHA (REGISTRO COMPRAS)
        let rowsRCHtml = '';
        let totRCCalculado = 0;
        const rcGroupKeys = Object.keys(rcPorGrupo);

        let totalVisualRowsRC = 0;
        rcGroupKeys.forEach(gKey => {
            totalVisualRowsRC += rcPorGrupo[gKey].items.length + 1; // items + subtotal
        });

        let rcPresuRendered = false;
        rcGroupKeys.forEach((gKey) => {
            const grp = rcPorGrupo[gKey];
            totRCCalculado += grp.subtotal;

            grp.items.forEach((it, idx) => {
                rowsRCHtml += `
                    <tr class="hover:bg-blue-50/30 transition-colors border-b border-slate-100 text-xs text-slate-700">
                        ${!rcPresuRendered ? `
                            <td class="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 align-top max-w-[130px] leading-tight" rowspan="${totalVisualRowsRC}">${presuNombre}</td>
                        ` : ''}
                        <td class="px-2 py-1.5 font-bold text-slate-900 border-r border-slate-200 text-center whitespace-nowrap align-top">${idx === 0 ? grp.partida : ''}</td>
                        <td class="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 max-w-[150px] truncate align-top" title="${grp.nompartida}">${idx === 0 ? grp.nompartida : ''}</td>
                        <td class="px-2 py-1.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap align-top">${it.ruc}</td>
                        <td class="px-2 py-1.5 text-slate-800 border-r border-slate-200 max-w-[130px] truncate align-top" title="${it.nombre_proveedor}">${it.nombre_proveedor}</td>
                        <td class="px-1.5 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200 whitespace-nowrap align-top">${it.tipodoc}</td>
                        <td class="px-2 py-1.5 font-mono text-slate-800 border-r border-slate-200 whitespace-nowrap max-w-[85px] truncate align-top" title="${it.nrodoc}">${it.nrodoc}</td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200 whitespace-nowrap align-top">${this.formatFecha(it.dfectra)}</td>
                        <td class="px-2 py-1.5 font-mono text-center text-slate-700 border-r border-slate-200 whitespace-nowrap align-top">${this.formatFecha(it.dfecven)}</td>
                        <td class="px-2.5 py-1.5 font-mono text-right text-slate-800 whitespace-nowrap align-top">${this.formatSoles(parseFloat(it.valor))}</td>
                    </tr>
                `;
                rcPresuRendered = true;
            });

            // Fila de Subtotal por (cencos, partida) en RC
            rowsRCHtml += `
                <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1 text-left border-r border-slate-200 font-semibold text-slate-700">Total</td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-1.5 py-1 border-r border-slate-200"></td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2 py-1 border-r border-slate-200"></td>
                    <td class="px-2.5 py-1 font-mono text-right font-bold text-slate-900 whitespace-nowrap">${this.formatSoles(grp.subtotal)}</td>
                </tr>
            `;
        });

        // Totales Generales
        const totGeneralCronoFinal = (this.partidaSeleccionada && this.cencosSeleccionado) ? totCronoCalculado : (data.totales ? data.totales.total_crono : totCronoCalculado);
        const totGeneralRCFinal    = (this.partidaSeleccionada && this.cencosSeleccionado) ? totRCCalculado : (data.totales ? data.totales.total_rc : totRCCalculado);

        // Estructura completa del HTML
        const tableHtml = `
            <div class="flex flex-col gap-6 w-full pb-8">
                
                <!-- CARD SUPERIOR: PRESUPUESTO -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col w-full">
                    
                    <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
                        <div class="flex items-center gap-3">
                            <div>
                                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">DashComparativoCronoRC</h2>
                                <p class="text-xs text-slate-500 font-medium">${presuNombre}</p>
                            </div>
                            <span class="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                                ${resumenPartidas.length} partidas
                            </span>
                        </div>

                        <!-- BOTONES DE ACCIÓN SUPERIOR -->
                        <div class="flex items-center gap-3 ml-auto">
                            ${this.partidaSeleccionada ? `
                                <button id="btn-reset-filtro-partida" type="button"
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 shadow-2xs transition-all cursor-pointer">
                                    <span>Ver Todas las Partidas</span>
                                </button>
                            ` : ''}

                            <!-- BOTÓN EXPORTAR EXCEL COMPLETO -->
                            <button id="btn-export-excel-pab" type="button"
                                class="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span>Excel</span>
                            </button>
                        </div>
                    </div>

                    <!-- CONTENEDOR DE LA TABLA SUPERIOR -->
                    <div class="p-4 w-full flex justify-start">
                        <div class="w-full lg:w-[65%] border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                            
                            <!-- TÍTULO DE REPORTE SUPERIOR -->
                            <div class="w-full bg-white py-2 text-center select-none border-b border-slate-200">
                                <h1 class="text-base font-bold text-slate-800 tracking-wide underline underline-offset-4 decoration-slate-400">
                                    PRESUPUESTO
                                </h1>
                            </div>

                            <!-- TABLA SCROLLEABLE -->
                            <div class="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar">
                                <table id="tabla-crono-presupuesto" class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                                    <thead class="sticky top-0 z-20 shadow-xs bg-blue-600">
                                        <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-700">
                                            <th class="px-3 py-2.5 text-left border-r border-blue-500/60 min-w-[140px]">presupuesto</th>
                                            <th class="px-2.5 py-2.5 text-left border-r border-blue-500/60 min-w-[70px]">cencos</th>
                                            <th class="px-3 py-2.5 text-left border-r border-blue-500/60 min-w-[130px]">nombre (ccos)</th>
                                            <th class="px-2.5 py-2.5 text-center border-r border-blue-500/60 min-w-[60px]">partida</th>
                                            <th class="px-3 py-2.5 text-left border-r border-blue-500/60 min-w-[260px]">partida (presupartidas)</th>
                                            <th class="px-2.5 py-2.5 text-center min-w-[40px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100 bg-white">
                                        ${rowsPresupuestoHtml}
                                        ${rowTotalPresupuestoHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- CONTENEDOR DE DOS TABLAS INFERIORES EN PARALELO (CRONOGRAMA & REGISTRO COMPRAS) -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                    
                    <!-- 1. TABLA INFERIOR IZQUIERDA: CRONOGRAMA -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="w-full bg-white py-2.5 text-center select-none border-b border-slate-200">
                            <h1 class="text-base font-bold text-slate-800 tracking-wide underline underline-offset-4 decoration-slate-400">
                                CRONOGRAMA
                            </h1>
                        </div>

                        <div class="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                            <table class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                                <thead class="sticky top-0 z-20 shadow-xs bg-blue-600">
                                    <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-700">
                                        <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[130px]">presupuesto</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[50px]">partida</th>
                                        <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[170px]">partida (presupartidas)</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[45px]">nrocuota</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[75px]">fechavenc</th>
                                        <th class="px-2.5 py-2 text-right min-w-[95px]">importe</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 bg-white">
                                    ${rowsCronoHtml || '<tr><td colspan="6" class="p-4 text-center text-slate-400">No hay cuotas programadas</td></tr>'}
                                </tbody>
                                <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-xs text-slate-900 shadow-md">
                                    <tr>
                                        <td class="px-2 py-2 border-r border-slate-300" colspan="2"></td>
                                        <td class="px-2.5 py-2 text-left border-r border-slate-300 font-bold">Total General</td>
                                        <td class="px-2 py-2 border-r border-slate-300" colspan="2"></td>
                                        <td class="px-2.5 py-2 font-mono text-right font-bold text-slate-900 whitespace-nowrap">${this.formatSoles(totGeneralCronoFinal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- 2. TABLA INFERIOR DERECHA: REGISTRO COMPRAS -->
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                        <div class="w-full bg-white py-2.5 text-center select-none border-b border-slate-200">
                            <h1 class="text-base font-bold text-slate-800 tracking-wide underline underline-offset-4 decoration-slate-400">
                                REGISTRO COMPRAS
                            </h1>
                        </div>

                        <div class="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                            <table class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                                <thead class="sticky top-0 z-20 shadow-xs bg-blue-600">
                                    <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-700">
                                        <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[130px]">presupuesto</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[50px]">partida</th>
                                        <th class="px-2.5 py-2 text-left border-r border-blue-500/60 min-w-[140px]">partida (presupartidas)</th>
                                        <th class="px-2 py-2 text-left border-r border-blue-500/60 min-w-[85px]">dprocli</th>
                                        <th class="px-2 py-2 text-left border-r border-blue-500/60 min-w-[120px]">nombre (ccte)</th>
                                        <th class="px-1.5 py-2 text-center border-r border-blue-500/60 min-w-[38px]">tdoc</th>
                                        <th class="px-2 py-2 text-left border-r border-blue-500/60 min-w-[65px]">dnumfac</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[70px]">dfectra</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500/60 min-w-[70px]">dfecven</th>
                                        <th class="px-2.5 py-2 text-right min-w-[90px]">dimport</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 bg-white">
                                    ${rowsRCHtml || '<tr><td colspan="10" class="p-4 text-center text-slate-400">No hay documentos ejecutados</td></tr>'}
                                </tbody>
                                <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-xs text-slate-900 shadow-md">
                                    <tr>
                                        <td class="px-2 py-2 border-r border-slate-300" colspan="2"></td>
                                        <td class="px-2.5 py-2 text-left border-r border-slate-300 font-bold" colspan="3">Total General</td>
                                        <td class="px-1.5 py-2 border-r border-slate-300" colspan="4"></td>
                                        <td class="px-2.5 py-2 font-mono text-right font-bold text-slate-900 whitespace-nowrap">${this.formatSoles(totGeneralRCFinal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                </div>

            </div>
        `;

        contenedor.innerHTML = tableHtml;
    },

    setupEventListeners() {
        // 1. Clic interactivo en las filas de la tabla superior PRESUPUESTO (por cencos y partida)
        const rowsPresu = document.querySelectorAll('#tabla-crono-presupuesto tbody tr[data-partida]');
        rowsPresu.forEach(row => {
            row.addEventListener('click', () => {
                const c = row.getAttribute('data-cencos');
                const p = row.getAttribute('data-partida');
                if (this.partidaSeleccionada === p && this.cencosSeleccionado === c) {
                    this.partidaSeleccionada = null; // Toggle off
                    this.cencosSeleccionado = null;
                } else {
                    this.partidaSeleccionada = p; // Filtrar por esa partida y cencos
                    this.cencosSeleccionado = c;
                }
                this.renderStructure();
                this.setupEventListeners();
            });
        });

        // 2. Botón para restablecer y ver todas las partidas
        const btnReset = document.getElementById('btn-reset-filtro-partida');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.partidaSeleccionada = null;
                this.cencosSeleccionado = null;
                this.renderStructure();
                this.setupEventListeners();
            });
        }

        // 3. Exportación a Excel Multi-Hoja
        const btnExport = document.getElementById('btn-export-excel-pab');
        if (!btnExport) return;

        const newBtn = btnExport.cloneNode(true);
        btnExport.parentNode.replaceChild(newBtn, btnExport);

        newBtn.addEventListener('click', () => {
            const data = this.datosBackend || {};
            const resumen = data.resumen_partidas || [];
            const crono = data.detalle_crono || [];
            const rc = data.detalle_rc || [];

            if (!resumen.length && !crono.length && !rc.length) {
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

            const wb = XLSX.utils.book_new();

            // Hoja 1: Resumen Presupuesto
            const head1 = [
                { t: 's', v: 'Presupuesto', s: headerStyle },
                { t: 's', v: 'Cencos', s: headerStyle },
                { t: 's', v: 'Centro Costo', s: headerStyle },
                { t: 's', v: 'Partida', s: headerStyle },
                { t: 's', v: 'Descripción Partida', s: headerStyle }
            ];

            const rows1 = resumen.map(p => [
                { t: 's', v: data.presupuesto_nombre || '', s: dataStyleLeft },
                { t: 's', v: p.cencos || data.cencos || '', s: dataStyleCenter },
                { t: 's', v: p.nombre_ccos || data.nombre_ccos || '', s: dataStyleLeft },
                { t: 's', v: p.partida || '', s: dataStyleCenter },
                { t: 's', v: p.nompartida || '', s: dataStyleLeft }
            ]);

            const ws1 = XLSX.utils.aoa_to_sheet([head1, ...rows1]);
            ws1['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 45 }];
            XLSX.utils.book_append_sheet(wb, ws1, 'Presupuesto');

            // Hoja 2: Cronograma Detalle
            const head2 = [
                { t: 's', v: 'Presupuesto', s: headerStyle },
                { t: 's', v: 'Cencos', s: headerStyle },
                { t: 's', v: 'Centro Costo', s: headerStyle },
                { t: 's', v: 'Partida', s: headerStyle },
                { t: 's', v: 'Descripción', s: headerStyle },
                { t: 's', v: 'NroCuota', s: headerStyle },
                { t: 's', v: 'Fecha Vencimiento', s: headerStyle },
                { t: 's', v: 'Importe', s: headerStyle }
            ];
            const rows2 = crono.map(c => [
                { t: 's', v: c.presupuesto || data.presupuesto_nombre || '', s: dataStyleLeft },
                { t: 's', v: c.cencos || '', s: dataStyleCenter },
                { t: 's', v: c.nombre_ccos || '', s: dataStyleLeft },
                { t: 's', v: c.partida || '', s: dataStyleCenter },
                { t: 's', v: c.nompartida || '', s: dataStyleLeft },
                { t: 'n', v: parseInt(c.nrocuota || 0), s: dataStyleCenter },
                { t: 's', v: c.fechavenc || '', s: dataStyleCenter },
                { t: 'n', v: parseFloat(c.importe || 0), z: '"S/ "#,##0.00', s: dataStyleCurrency }
            ]);
            const ws2 = XLSX.utils.aoa_to_sheet([head2, ...rows2]);
            ws2['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 45 }, { wch: 10 }, { wch: 16 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, ws2, 'Cronograma');

            // Hoja 3: Registro Compras Detalle
            const head3 = [
                { t: 's', v: 'Presupuesto', s: headerStyle },
                { t: 's', v: 'Cencos', s: headerStyle },
                { t: 's', v: 'Centro Costo', s: headerStyle },
                { t: 's', v: 'Partida', s: headerStyle },
                { t: 's', v: 'Descripción', s: headerStyle },
                { t: 's', v: 'RUC', s: headerStyle },
                { t: 's', v: 'Proveedor', s: headerStyle },
                { t: 's', v: 'TipoDoc', s: headerStyle },
                { t: 's', v: 'NroDoc', s: headerStyle },
                { t: 's', v: 'Fecha Emisión', s: headerStyle },
                { t: 's', v: 'Fecha Vencimiento', s: headerStyle },
                { t: 's', v: 'Monto', s: headerStyle }
            ];
            const rows3 = rc.map(r => [
                { t: 's', v: r.presupuesto || data.presupuesto_nombre || '', s: dataStyleLeft },
                { t: 's', v: r.cencos || '', s: dataStyleCenter },
                { t: 's', v: r.nombre_ccos || '', s: dataStyleLeft },
                { t: 's', v: r.partida || '', s: dataStyleCenter },
                { t: 's', v: r.nompartida || '', s: dataStyleLeft },
                { t: 's', v: r.ruc || '', s: dataStyleCenter },
                { t: 's', v: r.nombre_proveedor || '', s: dataStyleLeft },
                { t: 's', v: r.tipodoc || '', s: dataStyleCenter },
                { t: 's', v: r.nrodoc || '', s: dataStyleLeft },
                { t: 's', v: r.dfectra || '', s: dataStyleCenter },
                { t: 's', v: r.dfecven || '', s: dataStyleCenter },
                { t: 'n', v: parseFloat(r.valor || 0), z: '"S/ "#,##0.00', s: dataStyleCurrency }
            ]);
            const ws3 = XLSX.utils.aoa_to_sheet([head3, ...rows3]);
            ws3['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 35 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, ws3, 'Registro_Compras');

            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Comparativo_Crono_RC_${data.presupuesto_seleccionado || '202403'}_${fechaStr}.xlsx`);
        });
    }
};

window.ChartRegistry['DashComparativoCronoRC'] = window.ChartComparativoCronoRC;
window.ChartRegistry['ComparativoCronoRC'] = window.ChartComparativoCronoRC;
window.ChartRegistry['CronoRC'] = window.ChartComparativoCronoRC;
