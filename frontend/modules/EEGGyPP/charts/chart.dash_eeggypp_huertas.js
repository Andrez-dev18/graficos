/**
 * Componente: Dash_EEGGyPP_Huertas
 * Módulo: LIMA 1 EE_GGyPP
 * 
 * - Matriz Jerárquica: Provincia -> Zona -> Producto -> Tipo -> Código y Descripción.
 * - Subtotales por Tipo y Fila de Total General.
 * - 3 Métricas de Costo con formateo exacto de Tableau (Peso Venta, Costo Ventas Importe, Costo Ventas Precio).
 * - Panel lateral: "Nombres de medidas" (3 medidas).
 * - Filtro Cruzado Interactivo: Al hacer clic en una medida, resalta/subraya y enfoca la columna correspondiente.
 * - Exportación a Excel.
 */

window.ChartRegistry = window.ChartRegistry || {};

window.ChartDashEEGGyPP_Huertas = {
    controllerRef: null,
    datosBackend: null,
    containerRef: null,
    medidaSeleccionada: null, // Guarda la columna activa seleccionada para el filtro cruzado

    // Formateadores numéricos idénticos a Tableau (es-PE: coma decimal, punto de miles)
    formatNum(val, dec = 2) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        }).format(val);
    },

    formatSoles(val, dec = 2) {
        if (val === null || val === undefined || isNaN(val)) return 'S/0,00';
        const num = parseFloat(val);
        const isNeg = num < 0;
        const absFmt = new Intl.NumberFormat('es-PE', {
            minimumFractionDigits: dec,
            maximumFractionDigits: dec
        }).format(Math.abs(num));

        return isNeg ? `S/-${absFmt}` : `S/${absFmt}`;
    },

    render(controller, data, targetContainer = null) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.containerRef = (typeof targetContainer === 'string' ? document.getElementById(targetContainer) : targetContainer) 
            || document.getElementById('contenedor-vista-eeggypp')
            || document.getElementById('contenedor-graficos-lista');

        this.renderView();
    },

    renderView() {
        const contenedor = this.containerRef || document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const data = this.datosBackend || {};
        const provincias = data.provincias || [];
        const totalGeneral = data.total_general || {};

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <!-- ENCABEZADO DE TARJETA CON EXCEL -->
                <div id="card-header-grafica-principal" class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div class="flex items-center gap-2.5">
                        <h2 id="titulo-grafica-principal" class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                            ${data.titulo || 'Dash_EEGGyPP_Huertas'}
                        </h2>
                    </div>
                    <div id="contenedor-acciones-grafica" class="flex items-center gap-2">
                        <button id="btn-exportar-eeggypp-huertas-excel" type="button"
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
                    <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-4 items-start text-slate-800 font-sans">
                        
                        <!-- COLUMNA IZQUIERDA: MATRIZ DE DATOS (XL: 10 COLUMNAS) -->
                        <div class="xl:col-span-10 bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                            <!-- TITULO CENTRADO BANNER TABLEAU -->
                            <div class="w-full py-2 text-center font-extrabold text-xs sm:text-sm tracking-wider text-slate-900 border-b border-slate-300 bg-slate-100 uppercase select-none">
                                ${data.titulo || 'COSTO DE VENTA DEL POLLO BENEFICIADO y TROZADO'}
                            </div>
                            <div class="w-full overflow-x-auto custom-scrollbar">
                                <table id="tabla-dash-eeggypp-huertas" class="w-full text-[11px] border-collapse font-sans select-none min-w-[950px]">
                            
                            <!-- CABECERA DE LA TABLA -->
                            <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-20">
                                <tr class="divide-x divide-slate-200 text-center">
                                    <th class="px-2.5 py-2.5 text-left w-24 bg-slate-100 text-slate-800">Provincia</th>
                                    <th class="px-2.5 py-2.5 text-left w-36 bg-slate-100 text-slate-800">Zona</th>
                                    <th class="px-2.5 py-2.5 text-left w-20 bg-[#dfedeb] text-slate-800">Producto</th>
                                    <th class="px-2.5 py-2.5 text-left w-24 bg-slate-100">Tipo</th>
                                    <th class="px-2 py-2.5 text-left w-16 bg-slate-100">Codigo</th>
                                    <th class="px-3 py-2.5 text-left bg-slate-100">Descripcion</th>
                                    <th data-col="peso_venta" class="celda-medida px-2.5 py-2.5 text-right text-blue-900 bg-blue-50/50 transition-all cursor-pointer hover:bg-blue-100/80">Peso Venta</th>
                                    <th data-col="costo_ventas_importe" class="celda-medida px-2.5 py-2.5 text-right text-rose-900 bg-rose-50/50 transition-all cursor-pointer hover:bg-rose-100/80">Costo Ventas Importe</th>
                                    <th data-col="costo_ventas_precio" class="celda-medida px-2.5 py-2.5 text-right text-rose-900 bg-rose-50/50 transition-all cursor-pointer hover:bg-rose-100/80">Costo Ventas Precio</th>
                                </tr>
                            </thead>

                            <!-- CUERPO DE LA TABLA MATRIZ -->
                            <tbody class="divide-y divide-slate-200">
                                ${this.renderFilasMatriz(provincias)}
                            </tbody>

                            <!-- TOTAL GENERAL FOOTER -->
                            <tfoot class="border-t-2 border-slate-400 bg-slate-100 font-extrabold text-slate-900 sticky bottom-0 z-20 shadow-md">
                                <tr class="divide-x divide-slate-300">
                                    <td colspan="6" class="px-3 py-2 text-left tracking-wider text-xs font-black">
                                        Total general
                                    </td>
                                    <td data-col="peso_venta" class="celda-medida px-2.5 py-2 text-right text-blue-900 transition-all">${this.formatNum(totalGeneral.peso_venta, 2)}</td>
                                    <td data-col="costo_ventas_importe" class="celda-medida px-2.5 py-2 text-right text-red-600 transition-all">${this.formatSoles(totalGeneral.costo_ventas_importe, 2)}</td>
                                    <td data-col="costo_ventas_precio" class="celda-medida px-2.5 py-2 text-right text-red-600 transition-all">${this.formatSoles(totalGeneral.costo_ventas_precio, 3)}</td>
                                </tr>
                            </tfoot>

                        </table>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: SOLO NOMBRES DE MEDIDAS (XL: 2 COLUMNAS) -->
                <div class="xl:col-span-2 flex flex-col gap-3">
                    <div class="bg-white border border-slate-300 rounded-xl p-3 shadow-xs">
                        <div class="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                            <h4 class="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fas fa-palette text-blue-500 text-xs"></i>
                                Nombres de medidas
                            </h4>
                            <button id="btn-limpiar-medida-eeggypp-huertas" type="button" title="Restablecer foco"
                                class="text-[10px] text-slate-400 hover:text-blue-600 transition-colors ${this.medidaSeleccionada ? '' : 'hidden'}">
                                <i class="fas fa-undo"></i>
                            </button>
                        </div>
                        
                        <div class="flex flex-col gap-1 text-xs select-none">
                            
                            <div data-medida="peso_venta" class="item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:bg-slate-100 transition-all cursor-pointer">
                                <span class="w-3 h-3 rounded-xs bg-blue-600 shrink-0"></span>
                                <span class="text-slate-800 text-[11px] font-medium">Peso Venta</span>
                            </div>

                            <div data-medida="costo_ventas_importe" class="item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:bg-slate-100 transition-all cursor-pointer">
                                <span class="w-3 h-3 rounded-xs bg-rose-600 shrink-0"></span>
                                <span class="text-slate-800 text-[11px] font-medium">Costo Ventas Importe</span>
                            </div>

                            <div data-medida="costo_ventas_precio" class="item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:bg-slate-100 transition-all cursor-pointer">
                                <span class="w-3 h-3 rounded-xs bg-rose-700 shrink-0"></span>
                                <span class="text-slate-800 text-[11px] font-medium">Costo Ventas Precio</span>
                            </div>

                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
        `;

        this.setupEventListeners();
        this.aplicarFiltroCruzadoMedida();
    },

    /**
     * Renderiza dinámicamente las filas jerárquicas con rowspan
     * Jerarquía: Provincia -> Zona -> Producto -> Tipo -> Item + Subtotal por Tipo
     */
    renderFilasMatriz(provincias) {
        if (!provincias || provincias.length === 0) {
            return `<tr><td colspan="9" class="p-8 text-center text-slate-400 italic">No hay datos disponibles para los filtros seleccionados</td></tr>`;
        }

        let html = '';

        provincias.forEach(prov => {
            const provNombre = prov.provincia;
            const zonas = prov.zonas || [];

            // 1. Calcular total de filas ocupadas por la Provincia
            let totalFilasProvincia = 0;
            zonas.forEach(z => {
                const grupos = z.grupos || [];
                grupos.forEach(p => {
                    const tipos = p.tipos || [];
                    tipos.forEach(t => {
                        totalFilasProvincia += (t.items ? t.items.length : 0) + 1; // items + subtotal de tipo
                    });
                });
            });

            let esPrimerRowProvincia = true;

            zonas.forEach(zonaObj => {
                const zonaNombre = zonaObj.zona;
                const grupos = zonaObj.grupos || [];

                // 2. Calcular total de filas ocupadas por la Zona
                let totalFilasZona = 0;
                grupos.forEach(p => {
                    const tipos = p.tipos || [];
                    tipos.forEach(t => {
                        totalFilasZona += (t.items ? t.items.length : 0) + 1; // items + subtotal de tipo
                    });
                });

                let esPrimerRowZona = true;

                grupos.forEach(prod => {
                    const productoNombre = prod.producto;
                    const tipos = prod.tipos || [];

                    // 3. Calcular total de filas ocupadas por el Producto
                    let totalFilasProducto = 0;
                    tipos.forEach(t => {
                        totalFilasProducto += (t.items ? t.items.length : 0) + 1; // items + subtotal de tipo
                    });

                    let esPrimerRowProducto = true;

                    tipos.forEach(tipo => {
                        const tipoNombre = tipo.tipo;
                        const items = tipo.items || [];
                        const totalItemsTipo = items.length;
                        let esPrimerRowTipo = true;

                        // Render de cada fila de Item (Código / Descripción)
                        items.forEach(item => {
                            html += `
                                <tr class="divide-x divide-slate-200 hover:bg-blue-50/40 transition-colors">
                                    ${esPrimerRowProvincia ? `<td rowspan="${totalFilasProvincia}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${provNombre}</td>` : ''}
                                    ${esPrimerRowZona ? `<td rowspan="${totalFilasZona}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${zonaNombre}</td>` : ''}
                                    ${esPrimerRowProducto ? `<td rowspan="${totalFilasProducto}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-[#dfedeb] border-r border-slate-300 text-left">${productoNombre}</td>` : ''}
                                    ${esPrimerRowTipo ? `<td rowspan="${totalItemsTipo}" class="px-2.5 py-2 font-semibold text-slate-800 align-top bg-white border-r border-slate-200 text-left">${tipoNombre}</td>` : ''}
                                    <td class="px-2 py-1.5 font-medium text-slate-700 text-left">${item.codigo}</td>
                                    <td class="px-3 py-1.5 text-slate-800 text-left truncate max-w-[280px]" title="${item.descripcion}">${item.descripcion}</td>
                                    <td data-col="peso_venta" class="celda-medida px-2.5 py-1.5 text-right font-medium text-slate-900 transition-all">${this.formatNum(item.peso_venta, 2)}</td>
                                    <td data-col="costo_ventas_importe" class="celda-medida px-2.5 py-1.5 text-right font-medium text-rose-700 transition-all">${this.formatSoles(item.costo_ventas_importe, 2)}</td>
                                    <td data-col="costo_ventas_precio" class="celda-medida px-2.5 py-1.5 text-right font-medium text-rose-700 transition-all">${this.formatSoles(item.costo_ventas_precio, 3)}</td>
                                </tr>
                            `;
                            esPrimerRowProvincia = false;
                            esPrimerRowZona = false;
                            esPrimerRowProducto = false;
                            esPrimerRowTipo = false;
                        });

                        // Fila de SUBTOTAL DE TIPO (Exacto como Tableau: Columna Tipo muestra "Total", Descripción vacía)
                        const subTipo = tipo.subtotal || {};
                        html += `
                            <tr class="divide-x divide-slate-200 bg-slate-50/90 font-bold text-slate-900 border-b border-slate-300">
                                ${esPrimerRowProvincia ? `<td rowspan="${totalFilasProvincia}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${provNombre}</td>` : ''}
                                ${esPrimerRowZona ? `<td rowspan="${totalFilasZona}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-white border-r border-slate-300 text-left">${zonaNombre}</td>` : ''}
                                ${esPrimerRowProducto ? `<td rowspan="${totalFilasProducto}" class="px-2.5 py-2 font-bold text-slate-900 align-top bg-[#dfedeb] border-r border-slate-300 text-left">${productoNombre}</td>` : ''}
                                <td class="px-2.5 py-1.5 text-left font-bold text-slate-900 bg-slate-100">Total</td>
                                <td colspan="2" class="px-2 py-1.5 bg-slate-100"></td>
                                <td data-col="peso_venta" class="celda-medida px-2.5 py-1.5 text-right font-bold text-blue-900 transition-all">${this.formatNum(subTipo.peso_venta, 2)}</td>
                                <td data-col="costo_ventas_importe" class="celda-medida px-2.5 py-1.5 text-right font-bold text-red-600 transition-all">${this.formatSoles(subTipo.costo_ventas_importe, 2)}</td>
                                <td data-col="costo_ventas_precio" class="celda-medida px-2.5 py-2 text-right font-bold text-red-600 transition-all">${this.formatSoles(subTipo.costo_ventas_precio, 3)}</td>
                            </tr>
                        `;
                        esPrimerRowProvincia = false;
                        esPrimerRowZona = false;
                        esPrimerRowProducto = false;
                    });
                });
            });
        });

        return html;
    },

    setupEventListeners() {
        // Exportar a Excel
        const btnExport = document.getElementById('btn-exportar-eeggypp-huertas-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-dash-eeggypp-huertas', 'Dash_EEGGyPP_Huertas');
                } else {
                    alert('Exportando tabla a Excel...');
                }
            };
        }

        // Filtro Cruzado: Clic en opciones de Nombres de Medidas
        const itemsMedida = document.querySelectorAll('.item-nombre-medida');
        itemsMedida.forEach(item => {
            item.addEventListener('click', () => {
                const colKey = item.getAttribute('data-medida');
                this.medidaSeleccionada = (this.medidaSeleccionada === colKey) ? null : colKey;
                this.aplicarFiltroCruzadoMedida();
            });
        });

        // Clic directo en las cabeceras de columnas para activar el filtro
        const thMedidas = document.querySelectorAll('thead th.celda-medida');
        thMedidas.forEach(th => {
            th.addEventListener('click', () => {
                const colKey = th.getAttribute('data-col');
                this.medidaSeleccionada = (this.medidaSeleccionada === colKey) ? null : colKey;
                this.aplicarFiltroCruzadoMedida();
            });
        });

        // Botón limpiar filtro de medida
        const btnResetMedida = document.getElementById('btn-limpiar-medida-eeggypp-huertas');
        if (btnResetMedida) {
            btnResetMedida.addEventListener('click', (e) => {
                e.stopPropagation();
                this.medidaSeleccionada = null;
                this.aplicarFiltroCruzadoMedida();
            });
        }
    },

    /**
     * Aplica los estilos de foco / subrayado y difuminado cruzado a la columna activa
     */
    aplicarFiltroCruzadoMedida() {
        const sel = this.medidaSeleccionada;
        const btnReset = document.getElementById('btn-limpiar-medida-eeggypp-huertas');
        if (btnReset) {
            btnReset.classList.toggle('hidden', !sel);
        }

        // 1. Actualizar el estado visual en la lista de Nombres de medidas
        const itemsMedida = document.querySelectorAll('.item-nombre-medida');
        itemsMedida.forEach(item => {
            const col = item.getAttribute('data-medida');
            if (!sel) {
                item.className = 'item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:bg-slate-100 transition-all cursor-pointer';
            } else if (col === sel) {
                item.className = 'item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg bg-blue-50 border border-blue-400 font-bold shadow-xs ring-1 ring-blue-300 transition-all cursor-pointer';
            } else {
                item.className = 'item-nombre-medida flex items-center gap-2 p-1.5 rounded-lg border border-transparent opacity-45 hover:opacity-80 transition-all cursor-pointer';
            }
        });

        // 2. Actualizar las celdas de la tabla (TH, TD, TFOOT)
        const todasCeldasMedidas = document.querySelectorAll('#tabla-dash-eeggypp-huertas .celda-medida');
        todasCeldasMedidas.forEach(cell => {
            const col = cell.getAttribute('data-col');
            cell.classList.remove('col-highlight', 'col-dimmed');

            if (sel) {
                if (col === sel) {
                    cell.classList.add('col-highlight');
                } else {
                    cell.classList.add('col-dimmed');
                }
            }
        });
    }
};

window.ChartRegistry['Dash_EEGGyPP_Huertas'] = window.ChartDashEEGGyPP_Huertas;
