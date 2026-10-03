/**
 * Componente: Dash_Ventas2025_Todos (Ventas por Coorporativo - Cliente)
 * Módulo: Ventas2025 (Paginación Backend Ultra Rápida)
 * 
 * - Matriz Jerárquica Pivotada por Fechas:
 *   Provincia -> RUC -> Coorporativo -> Código -> Cliente -> 5 Métricas (Cantidad, Peso, Importe, PrecioU, PesoProm).
 * - Fila de Subtotal 'Total' por cada Corporativo.
 * - Fila de 'Total general' global en tfoot.
 * - Paginación en Backend a 100 registros por página.
 * - Exportación a Excel completa del 100% de registros.
 */

window.ChartRegistry = window.ChartRegistry || {};

// Formatters estáticos cacheados
const _fmtEntero = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const _fmtDecimal2 = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _fmtDecimal3 = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

window.ChartDashVentas2025_Todos = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,

    formatEntero(val) {
        if (val === null || val === undefined || val === '') return '';
        const num = Number(val);
        if (isNaN(num)) return '';
        return _fmtEntero.format(num);
    },

    formatDecimal(val, dec = 2) {
        if (val === null || val === undefined || val === '') return '';
        const num = Number(val);
        if (isNaN(num)) return '';
        return dec === 3 ? _fmtDecimal3.format(num) : _fmtDecimal2.format(num);
    },

    formatSoles(val, dec = 2) {
        if (val === null || val === undefined || val === '') return '';
        const num = Number(val);
        if (isNaN(num)) return '';
        const isNeg = num < 0;
        const absFmt = _fmtDecimal2.format(Math.abs(num));
        return isNeg ? `S/-${absFmt}` : `S/ ${absFmt}`;
    },

    render(controller, data, targetContainer = null) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof targetContainer === 'string' ? document.getElementById(targetContainer) : targetContainer) 
            || document.getElementById('contenedor-vista-ventas2025')
            || document.getElementById('contenedor-graficos-lista');

        this.renderView();
    },

    renderView() {
        const contenedor = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const provincias = data.provincias || [];
        const columnasFechas = data.columnas_fechas || [];
        const totalGeneral = data.total_general || {};
        const pag = data.paginacion || {
            pagina_actual: 1,
            limite: 100,
            total_corporativos: 0,
            total_paginas: 1,
            start_item: 0,
            end_item: 0
        };

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <!-- ENCABEZADO DE TARJETA CON EXCEL -->
                <div id="card-header-grafica-principal" class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <i class="fas fa-table text-sm"></i>
                        </div>
                        <div>
                            <h2 id="titulo-grafica-principal" class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                ${data.titulo || 'Ventas por Coorporativo - Cliente'}
                            </h2>
                            <p class="text-xs text-slate-500">
                                Período: ${data.fecha_inicio || ''} al ${data.fecha_fin || ''} | ${columnasFechas.length} Días evaluados | Total: ${pag.total_corporativos} Corporativos
                            </p>
                        </div>
                    </div>
                    <div id="contenedor-acciones-grafica" class="flex items-center gap-2">
                        <button id="btn-exportar-ventas2025-excel" type="button"
                            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                            <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                            </svg>
                            <span>Exportar Excel</span>
                        </button>
                    </div>
                </div>

                <div class="p-4 sm:p-5">
                    <div class="w-full bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        
                        <div id="scroll-wrapper-ventas2025-todos" class="w-full overflow-x-auto custom-scrollbar max-h-[720px]" style="contain: content; will-change: scroll-position; transform: translateZ(0);">
                            <table id="tabla-ventas2025-todos" class="w-full text-[11px] border-collapse font-sans select-none min-w-[1200px]">
                                
                                <!-- CABECERA DE LA TABLA (bg-blue-600 y text-white) -->
                                <thead class="bg-blue-600 text-white font-bold border-b border-blue-700 sticky top-0 z-20 shadow-xs">
                                    <tr class="divide-x divide-blue-500/60 text-center">
                                        <th class="px-2.5 py-2.5 text-left w-24 whitespace-nowrap">provincia</th>
                                        <th class="px-2 py-2.5 text-left w-24 whitespace-nowrap">ruc</th>
                                        <th class="px-2.5 py-2.5 text-left min-w-[160px] whitespace-nowrap">Coorporativo</th>
                                        <th class="px-2 py-2.5 text-left w-20 whitespace-nowrap">codigo</th>
                                        <th class="px-3 py-2.5 text-left min-w-[180px] whitespace-nowrap">Cliente</th>
                                        <th class="px-2.5 py-2.5 text-left w-24 whitespace-nowrap">Métrica</th>
                                        ${this.renderCabecerasFechas(columnasFechas)}
                                    </tr>
                                </thead>

                                <!-- CUERPO DE LA TABLA -->
                                <tbody id="tbody-ventas2025-todos" class="divide-y divide-slate-200">
                                    ${this.renderFilasMatriz(provincias, columnasFechas)}
                                </tbody>

                                <!-- TOTAL GENERAL FOOTER -->
                                <tfoot class="border-t-2 border-slate-400 bg-slate-100 font-extrabold text-slate-900 sticky bottom-0 z-10 shadow-md">
                                    ${this.renderTotalGeneral(totalGeneral, columnasFechas)}
                                </tfoot>

                            </table>
                        </div>

                        <!-- BARRA DE PAGINACIÓN BACKEND -->
                        <div id="paginacion-ventas2025-todos" class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                            ${this.renderBarraPaginacion(pag)}
                        </div>

                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    },

    renderBarraPaginacion(pag) {
        if (!pag || pag.total_corporativos === 0) return '';
        const { pagina_actual, limite, total_corporativos, total_paginas, start_item, end_item } = pag;

        return `
            <div class="flex items-center gap-3">
                <span class="font-medium text-slate-700">
                    Mostrando <strong class="text-slate-900">${start_item}</strong> a <strong class="text-slate-900">${end_item}</strong> de <strong class="text-slate-900">${total_corporativos}</strong> corporativos
                </span>
                <div class="flex items-center gap-1.5 ml-2">
                    <span class="text-slate-500">Mostrar:</span>
                    <select id="select-por-pagina-todos" class="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
                        <option value="25" ${limite == 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${limite == 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${limite == 100 ? 'selected' : ''}>100</option>
                        <option value="999999" ${limite >= 999999 ? 'selected' : ''}>Todos</option>
                    </select>
                </div>
            </div>

            <div class="flex items-center gap-1">
                <button id="btn-pag-primero" type="button" ${pagina_actual <= 1 ? 'disabled' : ''}
                    class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer">
                    « Primero
                </button>
                <button id="btn-pag-anterior" type="button" ${pagina_actual <= 1 ? 'disabled' : ''}
                    class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer">
                    ‹ Anterior
                </button>
                <span class="px-3 py-1 bg-blue-50 text-blue-700 font-bold border border-blue-200 rounded">
                    Página ${pagina_actual} de ${total_paginas}
                </span>
                <button id="btn-pag-siguiente" type="button" ${pagina_actual >= total_paginas ? 'disabled' : ''}
                    class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer">
                    Siguiente ›
                </button>
                <button id="btn-pag-ultimo" type="button" ${pagina_actual >= total_paginas ? 'disabled' : ''}
                    class="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer">
                    Último »
                </button>
            </div>
        `;
    },

    renderCabecerasFechas(columnasFechas) {
        if (!columnasFechas || columnasFechas.length === 0) return '';
        let html = '';
        const len = columnasFechas.length;
        for (let i = 0; i < len; i++) {
            const col = columnasFechas[i];
            html += `
                <th class="px-2 py-2 text-center font-bold whitespace-nowrap min-w-[92px]">
                    <div class="text-[10px] lowercase font-semibold opacity-90">${col.dia_semana},</div>
                    <div class="text-[11px] font-bold tracking-tight">${col.ymd}</div>
                </th>
            `;
        }
        return html;
    },

    renderFilasMatriz(provincias, columnasFechas) {
        if (!provincias || provincias.length === 0) {
            const colsCount = 6 + (columnasFechas ? columnasFechas.length : 0);
            return `<tr><td colspan="${colsCount}" class="p-8 text-center text-slate-400 italic">No hay datos disponibles para los filtros seleccionados</td></tr>`;
        }

        let html = '';
        const metricas = [
            { key: 'cantidad',  label: 'Cantidad',  fmt: (v) => this.formatEntero(v) },
            { key: 'peso',      label: 'Peso',      fmt: (v) => this.formatDecimal(v, 2) },
            { key: 'importe',   label: 'Importe',   fmt: (v) => this.formatSoles(v, 2) },
            { key: 'precio_u',  label: 'PrecioU',   fmt: (v) => this.formatDecimal(v, 3) },
            { key: 'peso_prom', label: 'PesoProm',  fmt: (v) => this.formatDecimal(v, 3) }
        ];

        const numCols = columnasFechas ? columnasFechas.length : 0;

        provincias.forEach(prov => {
            const provNombre = prov.provincia;
            const coorporativos = prov.coorporativos || [];

            let totalFilasProv = 0;
            coorporativos.forEach(coorp => {
                const clientes = coorp.clientes || [];
                totalFilasProv += (clientes.length * 5) + 5;
            });

            let esPrimerRowProv = true;

            coorporativos.forEach(coorp => {
                const ruc = coorp.ruc;
                const coorpNombre = coorp.coorporativo;
                const clientes = coorp.clientes || [];
                const subFechas = coorp.subtotal_fechas || {};
                const totalFilasCoorp = (clientes.length * 5) + 5;

                let esPrimerRowCoorp = true;

                clientes.forEach(cli => {
                    const codCli = cli.codigo;
                    const nomCli = cli.cliente;
                    const cliFechas = cli.fechas || {};

                    metricas.forEach((m, mIdx) => {
                        let celdasFechas = '';
                        for (let cIdx = 0; cIdx < numCols; cIdx++) {
                            const col = columnasFechas[cIdx];
                            const valObj = cliFechas[col.fecha] || {};
                            const rawVal = valObj[m.key];
                            const txt = m.fmt(rawVal);
                            celdasFechas += `<td class="px-2 py-1 text-right font-medium text-slate-800 whitespace-nowrap">${txt}</td>`;
                        }

                        html += `
                            <tr class="divide-x divide-slate-200 hover:bg-blue-50/40">
                                ${esPrimerRowProv ? `<td rowspan="${totalFilasProv}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${provNombre}</td>` : ''}
                                ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2 py-1.5 font-bold text-slate-800 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${ruc}</td>` : ''}
                                ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${coorpNombre}</td>` : ''}
                                ${mIdx === 0 ? `<td rowspan="5" class="px-2 py-1.5 font-medium text-slate-700 align-top bg-white border-r border-slate-200 text-left whitespace-nowrap">${codCli}</td>` : ''}
                                ${mIdx === 0 ? `<td rowspan="5" class="px-3 py-1.5 font-medium text-slate-800 align-top bg-white border-r border-slate-200 text-left max-w-[220px]" title="${nomCli}">${nomCli}</td>` : ''}
                                <td class="px-2.5 py-1 text-left font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 whitespace-nowrap">${m.label}</td>
                                ${celdasFechas}
                            </tr>
                        `;

                        esPrimerRowProv = false;
                        esPrimerRowCoorp = false;
                    });
                });

                // Subtotal Total Corporativo
                metricas.forEach((m, mIdx) => {
                    let celdasSubFechas = '';
                    for (let cIdx = 0; cIdx < numCols; cIdx++) {
                        const col = columnasFechas[cIdx];
                        const valObj = subFechas[col.fecha] || {};
                        const rawVal = valObj[m.key];
                        const txt = m.fmt(rawVal);
                        celdasSubFechas += `<td class="px-2 py-1 text-right font-bold text-blue-900 bg-blue-50/30 whitespace-nowrap">${txt}</td>`;
                    }

                    html += `
                        <tr class="divide-x divide-slate-200 bg-slate-50/90 font-bold text-slate-900 ${mIdx === 4 ? 'border-b-2 border-slate-300' : ''}">
                            ${esPrimerRowProv ? `<td rowspan="${totalFilasProv}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${provNombre}</td>` : ''}
                            ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2 py-1.5 font-bold text-slate-800 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${ruc}</td>` : ''}
                            ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${coorpNombre}</td>` : ''}
                            ${mIdx === 0 ? `<td rowspan="5" colspan="2" class="px-2.5 py-1.5 font-bold text-slate-900 bg-slate-100 align-top border-r border-slate-300 text-left">Total</td>` : ''}
                            <td class="px-2.5 py-1 text-left font-bold text-slate-900 bg-slate-100 border-r border-slate-200 whitespace-nowrap">${m.label}</td>
                            ${celdasSubFechas}
                        </tr>
                    `;
                    esPrimerRowProv = false;
                    esPrimerRowCoorp = false;
                });

            });
        });

        return html;
    },

    renderTotalGeneral(totalGeneral, columnasFechas) {
        if (!totalGeneral || !totalGeneral.fechas) return '';

        const metricas = [
            { key: 'cantidad',  label: 'Cantidad',  fmt: (v) => this.formatEntero(v) },
            { key: 'peso',      label: 'Peso',      fmt: (v) => this.formatDecimal(v, 2) },
            { key: 'importe',   label: 'Importe',   fmt: (v) => this.formatSoles(v, 2) },
            { key: 'precio_u',  label: 'PrecioU',   fmt: (v) => this.formatDecimal(v, 3) },
            { key: 'peso_prom', label: 'PesoProm',  fmt: (v) => this.formatDecimal(v, 3) }
        ];

        const gFechas = totalGeneral.fechas || {};
        const numCols = columnasFechas ? columnasFechas.length : 0;
        let html = '';

        metricas.forEach((m, mIdx) => {
            let celdasGFechas = '';
            for (let cIdx = 0; cIdx < numCols; cIdx++) {
                const col = columnasFechas[cIdx];
                const valObj = gFechas[col.fecha] || {};
                const rawVal = valObj[m.key];
                const txt = m.fmt(rawVal);
                celdasGFechas += `<td class="px-2 py-1 text-right font-black text-blue-950 bg-blue-100/40 whitespace-nowrap">${txt}</td>`;
            }

            html += `
                <tr class="divide-x divide-slate-300 font-extrabold text-slate-900 bg-slate-100">
                    ${mIdx === 0 ? `<td rowspan="5" colspan="5" class="px-3 py-2 text-left tracking-wider text-xs font-black bg-slate-200 align-top whitespace-nowrap">Total general</td>` : ''}
                    <td class="px-2.5 py-1 text-left font-bold text-slate-900 bg-slate-200 border-r border-slate-300 whitespace-nowrap">${m.label}</td>
                    ${celdasGFechas}
                </tr>
            `;
        });

        return html;
    },

    setupEventListeners() {
        const data = this.datosBackend || {};
        const pag = data.paginacion || {};

        // Botones Paginación
        const btnPrimero = document.getElementById('btn-pag-primero');
        if (btnPrimero && this.controllerRef) {
            btnPrimero.onclick = () => this.controllerRef.irAPagina(1);
        }

        const btnAnterior = document.getElementById('btn-pag-anterior');
        if (btnAnterior && this.controllerRef) {
            btnAnterior.onclick = () => this.controllerRef.irAPagina((pag.pagina_actual || 1) - 1);
        }

        const btnSiguiente = document.getElementById('btn-pag-siguiente');
        if (btnSiguiente && this.controllerRef) {
            btnSiguiente.onclick = () => this.controllerRef.irAPagina((pag.pagina_actual || 1) + 1);
        }

        const btnUltimo = document.getElementById('btn-pag-ultimo');
        if (btnUltimo && this.controllerRef) {
            btnUltimo.onclick = () => this.controllerRef.irAPagina(pag.total_paginas || 1);
        }

        const selectPorPagina = document.getElementById('select-por-pagina-todos');
        if (selectPorPagina && this.controllerRef) {
            selectPorPagina.onchange = (e) => this.controllerRef.cambiarLimite(parseInt(e.target.value, 10));
        }

        // Exportar a Excel Completo (100% de registros del Backend)
        const btnExport = document.getElementById('btn-exportar-ventas2025-excel');
        if (btnExport) {
            btnExport.onclick = async () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    const datosCompletos = await this.controllerRef.exportarTodoExcel('Todos');
                    const fullData = datosCompletos || data;
                    const provincias = fullData.provincias || [];
                    const columnasFechas = fullData.columnas_fechas || [];
                    const totalGeneral = fullData.total_general || {};

                    const tempTable = document.createElement('table');
                    tempTable.innerHTML = `
                        <thead>
                            <tr>
                                <th>provincia</th>
                                <th>ruc</th>
                                <th>Coorporativo</th>
                                <th>codigo</th>
                                <th>Cliente</th>
                                <th>Métrica</th>
                                ${this.renderCabecerasFechas(columnasFechas)}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderFilasMatriz(provincias, columnasFechas)}
                        </tbody>
                        <tfoot>
                            ${this.renderTotalGeneral(totalGeneral, columnasFechas)}
                        </tfoot>
                    `;
                    ExcelExportHelper.exportarTabla(tempTable, 'Ventas_por_Coorporativo_Cliente_2025');
                } else {
                    alert('Exportando tabla a Excel...');
                }
            };
        }
    }
};

window.ChartRegistry['Todos'] = window.ChartDashVentas2025_Todos;
window.ChartRegistry['Dash_Ventas2025_Todos'] = window.ChartDashVentas2025_Todos;
