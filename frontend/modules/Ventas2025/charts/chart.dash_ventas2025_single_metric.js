/**
 * Componente: Dash_Ventas2025_SingleMetric (Cantidad, Peso, Valor)
 * Módulo: Ventas2025
 * 
 * - Renderiza la matriz pivotada por fechas para una métrica individual.
 * - Jerarquía: Provincia -> RUC -> Coorporativo -> Código -> Cliente.
 * - Fila de Subtotal 'Total' por cada Corporativo.
 * - Fila de 'Total general' global en tfoot.
 * - Formato numérico específico según la métrica (Entero para Cantidad, Decimal para Peso, Soles para Valor).
 * - Exportación a Excel completa.
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartDashVentas2025_SingleMetric = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,

    formatValor(val, metrica) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        const num = parseFloat(val);

        if (metrica === 'cantidad') {
            return new Intl.NumberFormat('es-PE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num);
        }

        if (metrica === 'peso') {
            return new Intl.NumberFormat('es-PE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        }

        if (metrica === 'importe' || metrica === 'valor') {
            const isNeg = num < 0;
            const absFmt = new Intl.NumberFormat('es-PE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(Math.abs(num));
            return isNeg ? `S/-${absFmt}` : `S/ ${absFmt}`;
        }

        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
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
        const metrica = (data.metrica || 'cantidad').toLowerCase();
        const tipoGrafico = data.tipo_grafico || 'Cantidad';

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
                                ${data.titulo || `Ventas por Coorporativo - Cliente (${tipoGrafico})`}
                            </h2>
                            <p class="text-xs text-slate-500">
                                Período: ${data.fecha_inicio || ''} al ${data.fecha_fin || ''} | ${columnasFechas.length} Días evaluados
                            </p>
                        </div>
                    </div>
                    <div id="contenedor-acciones-grafica" class="flex items-center gap-2">
                        <button id="btn-exportar-ventas2025-single-excel" type="button"
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
                        
                        <div class="w-full overflow-x-auto custom-scrollbar max-h-[750px]">
                            <table id="tabla-ventas2025-single" class="w-full text-[11px] border-collapse font-sans select-none min-w-[1100px]">
                                
                                <!-- CABECERA DE LA TABLA (bg-blue-600 y text-white) -->
                                <thead class="bg-blue-600 text-white font-bold border-b border-blue-700 sticky top-0 z-20 shadow-xs">
                                    <tr class="divide-x divide-blue-500/60 text-center">
                                        <th class="px-2.5 py-2.5 text-left w-24 whitespace-nowrap">provincia</th>
                                        <th class="px-2.5 py-2.5 text-left w-24 whitespace-nowrap">ruc</th>
                                        <th class="px-2.5 py-2.5 text-left min-w-[160px] whitespace-nowrap">Coorporativo</th>
                                        <th class="px-2 py-2.5 text-left w-20 whitespace-nowrap">codigo</th>
                                        <th class="px-3 py-2.5 text-left min-w-[180px] whitespace-nowrap">Cliente</th>
                                        ${this.renderCabecerasFechas(columnasFechas)}
                                    </tr>
                                </thead>

                                <!-- CUERPO DE LA TABLA -->
                                <tbody class="divide-y divide-slate-200">
                                    ${this.renderFilasMatriz(provincias, columnasFechas, metrica)}
                                </tbody>

                                <!-- TOTAL GENERAL FOOTER -->
                                <tfoot class="border-t-2 border-slate-400 bg-slate-100 font-extrabold text-slate-900 sticky bottom-0 z-10 shadow-md">
                                    ${this.renderTotalGeneral(totalGeneral, columnasFechas, metrica)}
                                </tfoot>

                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners(tipoGrafico);
    },

    renderCabecerasFechas(columnasFechas) {
        if (!columnasFechas || columnasFechas.length === 0) return '';
        return columnasFechas.map(col => `
            <th class="px-2 py-2 text-center font-bold whitespace-nowrap min-w-[92px]">
                <div class="text-[10px] lowercase font-semibold opacity-90">${col.dia_semana},</div>
                <div class="text-[11px] font-bold tracking-tight">${col.ymd}</div>
            </th>
        `).join('');
    },

    renderFilasMatriz(provincias, columnasFechas, metrica) {
        if (!provincias || provincias.length === 0) {
            const colsCount = 5 + (columnasFechas ? columnasFechas.length : 0);
            return `<tr><td colspan="${colsCount}" class="p-8 text-center text-slate-400 italic">No hay datos disponibles para los filtros seleccionados</td></tr>`;
        }

        let html = '';

        provincias.forEach(prov => {
            const provNombre = prov.provincia;
            const coorporativos = prov.coorporativos || [];

            // 1. Total filas de la provincia
            let totalFilasProv = 0;
            coorporativos.forEach(coorp => {
                const clientes = coorp.clientes || [];
                totalFilasProv += clientes.length + 1; // 1 fila por cliente + 1 fila de Total Corporativo
            });

            let esPrimerRowProv = true;

            coorporativos.forEach(coorp => {
                const ruc = coorp.ruc;
                const coorpNombre = coorp.coorporativo;
                const clientes = coorp.clientes || [];
                const subFechas = coorp.subtotal_fechas || {};
                const totalFilasCoorp = clientes.length + 1;

                let esPrimerRowCoorp = true;

                // Render cada Cliente
                clientes.forEach(cli => {
                    const codCli = cli.codigo;
                    const nomCli = cli.cliente;
                    const cliFechas = cli.fechas || {};

                    html += `
                        <tr class="divide-x divide-slate-200 hover:bg-blue-50/30 transition-colors">
                            ${esPrimerRowProv ? `<td rowspan="${totalFilasProv}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${provNombre}</td>` : ''}
                            ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-800 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${ruc}</td>` : ''}
                            ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${coorpNombre}</td>` : ''}
                            <td class="px-2 py-1.5 font-medium text-slate-700 align-top bg-white border-r border-slate-200 text-left whitespace-nowrap">${codCli}</td>
                            <td class="px-3 py-1.5 font-medium text-slate-800 align-top bg-white border-r border-slate-200 text-left max-w-[220px]" title="${nomCli}">${nomCli}</td>
                            ${columnasFechas.map(col => {
                                const rawVal = cliFechas[col.fecha];
                                const txt = this.formatValor(rawVal, metrica);
                                return `<td class="px-2 py-1 text-right font-medium text-slate-800 whitespace-nowrap">${txt}</td>`;
                            }).join('')}
                        </tr>
                    `;

                    esPrimerRowProv = false;
                    esPrimerRowCoorp = false;
                });

                // Fila de SUBTOTAL 'Total' del Corporativo
                html += `
                    <tr class="divide-x divide-slate-200 bg-slate-50/90 font-bold text-slate-900 border-b-2 border-slate-300">
                        ${esPrimerRowProv ? `<td rowspan="${totalFilasProv}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${provNombre}</td>` : ''}
                        ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-800 align-top bg-white border-r border-slate-300 text-left whitespace-nowrap">${ruc}</td>` : ''}
                        ${esPrimerRowCoorp ? `<td rowspan="${totalFilasCoorp}" class="px-2.5 py-1.5 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${coorpNombre}</td>` : ''}
                        <td colspan="2" class="px-2.5 py-1.5 font-bold text-slate-900 bg-slate-100 align-top border-r border-slate-300 text-left">Total</td>
                        ${columnasFechas.map(col => {
                            const rawVal = subFechas[col.fecha];
                            const txt = this.formatValor(rawVal, metrica);
                            return `<td class="px-2 py-1 text-right font-bold text-blue-900 bg-blue-50/30 whitespace-nowrap">${txt}</td>`;
                        }).join('')}
                    </tr>
                `;
                esPrimerRowProv = false;
                esPrimerRowCoorp = false;
            });
        });

        return html;
    },

    renderTotalGeneral(totalGeneral, columnasFechas, metrica) {
        if (!totalGeneral || !totalGeneral.fechas) return '';

        const gFechas = totalGeneral.fechas || {};

        return `
            <tr class="divide-x divide-slate-300 font-extrabold text-slate-900 bg-slate-100">
                <td colspan="5" class="px-3 py-2 text-left tracking-wider text-xs font-black bg-slate-200 align-top whitespace-nowrap">Total general</td>
                ${columnasFechas.map(col => {
                    const rawVal = gFechas[col.fecha];
                    const txt = this.formatValor(rawVal, metrica);
                    return `<td class="px-2 py-1 text-right font-black text-blue-950 bg-blue-100/40 whitespace-nowrap">${txt}</td>`;
                }).join('')}
            </tr>
        `;
    },

    setupEventListeners(tipoGrafico) {
        // Exportar a Excel
        const btnExport = document.getElementById('btn-exportar-ventas2025-single-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-ventas2025-single', `Ventas_Coorporativo_Cliente_2025_${tipoGrafico}`);
                } else {
                    alert('Exportando tabla a Excel...');
                }
            };
        }
    }
};

window.ChartRegistry['Cantidad'] = window.ChartDashVentas2025_SingleMetric;
window.ChartRegistry['Peso'] = window.ChartDashVentas2025_SingleMetric;
window.ChartRegistry['Valor'] = window.ChartDashVentas2025_SingleMetric;
window.ChartRegistry['Dash_Ventas2025_Cantidad'] = window.ChartDashVentas2025_SingleMetric;
window.ChartRegistry['Dash_Ventas2025_Peso'] = window.ChartDashVentas2025_SingleMetric;
window.ChartRegistry['Dash_Ventas2025_Valor'] = window.ChartDashVentas2025_SingleMetric;
