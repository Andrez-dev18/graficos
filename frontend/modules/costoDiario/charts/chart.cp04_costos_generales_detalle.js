/**
 * Módulo Frontend para CP04 CostosGeneralesDetalleAlDia
 * - Panel Izquierdo:
 *   * Tabla Resumen: "Costo Produccion por Kg de Pollo Vivo" (linea, nomlinea, valor, Kilos Prod, CU, Total general)
 * - Panel Derecho:
 *   * Tabla Detalle: "Detalle del costo Unitario por Linea" (cencos, galpon, linea, codigo, nomcodigo, unidad, cantidad, peso, valor, kilosprodacu, CU)
 *   * Agrupación visual idéntica a Tableau: cencos, galpón y línea solo se muestran en la primera fila del grupo con líneas divisorias
 *   * Footer de Total general con sumatorias y CU total
 * - Filtro Multiselect por Clasificación ([linea] + " " + [nomlinea])
 * - Filtro Cruzado: Clic en una fila de la Tabla 1 filtra inmediatamente el detalle en la Tabla 2
 * - Tooltips flotantes estilo Tableau
 * - Cabeceras de tabla: bg-blue-600 text-white
 */
window.ChartRegistry = window.ChartRegistry || {};

const CP04_DEFINITION = {
    controller: null,
    datosBackend: null,
    multiClasif: null,
    lineaSeleccionada: null,
    terminoBusquedaDetalle: '',

    destroy() {
        this.hideTooltip();
        this.lineaSeleccionada = null;
        this.terminoBusquedaDetalle = '';
        this.multiClasif = null;
    },

    formatNum(val, decimals = 0) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        const num = Number(val);
        const fixed = num.toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimals > 0 ? parts.join(',') : parts[0];
    },

    formatFecha(fechaStr) {
        if (!fechaStr) return '';
        const parts = String(fechaStr).split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return fechaStr;
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';

        if (data.fecha) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatFecha(data.fecha)}</span>
            `;
        }

        if (data.cencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">cencos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.cencos}</span>
            `;
        }

        if (data.galpon !== undefined && data.galpon !== null && data.galpon !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">galpon:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.galpon}</span>
            `;
        }

        if (data.linea) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">linea:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.linea}</span>
            `;
        }

        if (data.nomlinea) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomlinea:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomlinea}</span>
            `;
        }

        if (data.codigo) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">codigo:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.codigo}</span>
            `;
        }

        if (data.nomcodigo) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomcodigo:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomcodigo}</span>
            `;
        }

        if (data.unidad) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">unidad:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.unidad}</span>
            `;
        }

        if (data.cantidad !== undefined && data.cantidad !== null && data.cantidad !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">cantidad:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.cantidad, 2)}</span>
            `;
        }

        if (data.peso !== undefined && data.peso !== null && data.peso !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">peso:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.peso, 2)}</span>
            `;
        }

        if (data.valor !== undefined && data.valor !== null && data.valor !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">valor:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-900">${this.formatNum(data.valor, 2)}</span>
            `;
        }

        if (data.kilosprod !== undefined && data.kilosprod !== null && data.kilosprod !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Kilos Prod:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.kilosprod, 2)}</span>
            `;
        }

        if (data.cu !== undefined && data.cu !== null && data.cu !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">CU:</span>
                <span class="font-bold text-blue-700 text-left font-mono text-xs">${this.formatNum(data.cu, 3)}</span>
            `;
        }

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                ${itemsHtml}
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const tooltipWidth = tooltipEl.offsetWidth || 260;
        const tooltipHeight = tooltipEl.offsetHeight || 140;

        let left = e.clientX + 15;
        let top = e.clientY - 20;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = e.clientX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight - 12) {
            top = window.innerHeight - tooltipHeight - 12;
        }

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
    },

    hideTooltip() {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
        }
    },

    getSelectedFilters() {
        if (this.multiClasif) {
            const selected = typeof this.multiClasif.getSelectedValues === 'function' 
                ? this.multiClasif.getSelectedValues() 
                : (this.multiClasif.options ? this.multiClasif.options.filter(o => o.selected).map(o => o.id) : []);
            if (selected && selected.length > 0 && selected.length < this.multiClasif.options.length) {
                return { clasificacion: selected };
            }
        }
        return {};
    },

    render(controller, data) {
        this.controller = controller;
        this.datosBackend = data || {};
        this.lineaSeleccionada = null;

        // 1. Ocultar cabecera redundante superior
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar inferior
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Configurar y mostrar filtro multiselect de Clasificación
        this.setupFilters(this.datosBackend);

        // 4. Renderizar layout visual
        this.renderLayout();
    },

    setupFilters(data) {
        const contFiltro = document.getElementById('contenedor-filtro-clasificacion-cp04');
        if (contFiltro) contFiltro.classList.remove('hidden');

        const clasifsDisp = (data.filtros_disponibles && data.filtros_disponibles.clasificaciones) || [];

        if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0) {
            const optClasif = clasifsDisp.map(c => {
                const id = (c.clasificacion || `${c.linea} ${c.nomlinea}`).trim();
                return {
                    id: id,
                    label: id,
                    selected: true
                };
            });

            if (!this.multiClasif) {
                this.multiClasif = new CustomMultiSelect({
                    btnId: 'btn-dropdown-clasificacion-cp04',
                    dropdownId: 'dropdown-clasificacion-cp04',
                    optionsContainerId: 'container-options-clasificacion-cp04',
                    labelId: 'label-clasificacion-cp04',
                    searchId: 'search-clasificacion-cp04',
                    title: 'Clasificación',
                    options: optClasif,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiClasif.setOptions(optClasif);
            }
            this.multiClasif.selectAll(false);
        }
    },

    filtrarLocalmente() {
        if (!this.datosBackend) return;

        const selectedClasif = this.multiClasif 
            ? (typeof this.multiClasif.getSelectedValues === 'function' 
                ? this.multiClasif.getSelectedValues() 
                : (this.multiClasif.options ? this.multiClasif.options.filter(o => o.selected).map(o => o.id) : [])) 
            : [];
        const isAll = !selectedClasif || selectedClasif.length === 0 || (this.multiClasif && this.multiClasif.options && selectedClasif.length === this.multiClasif.options.length);

        const allResumen = (this.datosBackend.resumen_costo_produccion && this.datosBackend.resumen_costo_produccion.filas) || [];
        const allDetalle = (this.datosBackend.detalle_costo_unitario && this.datosBackend.detalle_costo_unitario.filas) || [];

        // 1. Filtrar filas de Resumen por Clasificación
        let resumenFiltrado = isAll ? allResumen : allResumen.filter(r => {
            const c1 = (r.clasificacion || '').trim();
            const c2 = (r.linea || '').trim();
            return selectedClasif.some(sel => sel.trim() === c1 || sel.trim() === c2 || sel.trim().startsWith(c2 + ' '));
        });

        // 2. Filtrar filas de Detalle por Clasificación
        let detalleFiltrado = isAll ? allDetalle : allDetalle.filter(d => {
            const c1 = (d.clasificacion || `${d.linea} ${d.nomlinea}`).trim();
            const c2 = (d.linea || '').trim();
            return selectedClasif.some(sel => sel.trim() === c1 || sel.trim() === c2 || sel.trim().startsWith(c2 + ' '));
        });

        // 3. Aplicar Filtro Cruzado de Línea seleccionada en Tabla 1
        if (this.lineaSeleccionada) {
            detalleFiltrado = detalleFiltrado.filter(d => String(d.linea).trim() === String(this.lineaSeleccionada).trim());
        }

        // 4. Aplicar Búsqueda de texto en Tabla Detalle
        if (this.terminoBusquedaDetalle && this.terminoBusquedaDetalle.trim() !== '') {
            const term = this.terminoBusquedaDetalle.trim().toLowerCase();
            detalleFiltrado = detalleFiltrado.filter(d => {
                return (d.cencos && String(d.cencos).toLowerCase().includes(term)) ||
                       (d.codigo && String(d.codigo).toLowerCase().includes(term)) ||
                       (d.nomcodigo && String(d.nomcodigo).toLowerCase().includes(term)) ||
                       (d.linea && String(d.linea).toLowerCase().includes(term)) ||
                       (d.nomlinea && String(d.nomlinea).toLowerCase().includes(term));
            });
        }

        this.renderTablaResumen(resumenFiltrado);
        this.renderTablaDetalle(detalleFiltrado);
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const allResumen = (this.datosBackend.resumen_costo_produccion && this.datosBackend.resumen_costo_produccion.filas) || [];

        if (allResumen.length === 0) {
            contenedor.className = "flex flex-col w-full p-8 bg-slate-50 items-center justify-center text-center";
            contenedor.innerHTML = `
                <div class="p-4 bg-blue-50 text-blue-600 rounded-full mb-3">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-700 uppercase">Sin Datos Disponibles</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-sm">No se encontraron registros de costos generales para la fecha seleccionada (${this.datosBackend.fecha_formateada || this.datosBackend.fecha || ''}).</p>
            `;
            return;
        }

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CP04 COSTOS GENERALES DETALLE AL DIA -->
            <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                <!-- ========================================== -->
                <!-- COLUMNA IZQUIERDA: TABLA 1 RESUMEN -->
                <!-- ========================================== -->
                <div class="xl:col-span-5 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="px-4 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-slate-800">Costo Produccion por Kg de Pollo Vivo</h3>
                        </div>
                        <span id="cp04-badge-total-lineas" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            ${allResumen.length} Líneas
                        </span>
                    </div>

                    <div class="w-full overflow-x-auto max-h-[720px] custom-scrollbar">
                        <table class="w-full text-xs border-collapse select-none">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold shadow-xs">
                                <tr>
                                    <th class="px-2.5 py-2 text-left border-r border-slate-200 w-12">linea</th>
                                    <th class="px-3 py-2 text-left border-r border-slate-200">nomlinea</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">Kilos Prod</th>
                                    <th class="px-3 py-2 text-right">CU</th>
                                </tr>
                            </thead>
                            <tbody id="cp04-tbody-resumen" class="divide-y divide-slate-100 text-slate-800">
                                <!-- Filas dinámicas -->
                            </tbody>
                            <tfoot id="cp04-tfoot-resumen" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md">
                                <!-- Totales -->
                            </tfoot>
                        </table>
                    </div>
                </div>

                <!-- ========================================== -->
                <!-- COLUMNA DERECHA: TABLA 2 DETALLE -->
                <!-- ========================================== -->
                <div class="xl:col-span-7 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-slate-800">Detalle del costo Unitario por Linea</h3>
                            <span id="cp04-badge-filtro-activo" class="hidden text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                                Filtrado por Línea
                            </span>
                        </div>

                        <!-- Buscador rápido para la tabla detalle -->
                        <div class="flex items-center gap-2">
                            <div class="relative">
                                <input id="cp04-input-buscar-detalle" type="text" placeholder="Buscar código, insumo..."
                                    class="w-48 sm:w-56 text-xs px-2.5 py-1.5 pl-7 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-normal">
                                <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                            <span id="cp04-badge-total-detalles" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 whitespace-nowrap">
                                0 Registros
                            </span>
                        </div>
                    </div>

                    <div class="w-full overflow-x-auto max-h-[720px] custom-scrollbar">
                        <table class="w-full text-xs border-collapse select-none">
                            <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                <tr>
                                    <th class="px-2 py-2 border-r border-slate-200">cencos</th>
                                    <th class="px-1.5 py-2 border-r border-slate-200">galpon</th>
                                    <th class="px-2 py-2 border-r border-slate-200">linea</th>
                                    <th class="px-2.5 py-2 text-left border-r border-slate-200">codigo</th>
                                    <th class="px-3 py-2 text-left border-r border-slate-200">nomcodigo</th>
                                    <th class="px-2 py-2 border-r border-slate-200">unidad</th>
                                    <th class="px-2.5 py-2 text-right border-r border-slate-200">cantidad</th>
                                    <th class="px-2.5 py-2 text-right border-r border-slate-200">peso</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">valor</th>
                                    <th class="px-3 py-2 text-right border-r border-slate-200">kilosprodacu</th>
                                    <th class="px-2.5 py-2 text-right">CU</th>
                                </tr>
                            </thead>
                            <tbody id="cp04-tbody-detalle" class="divide-y divide-slate-100 text-slate-800">
                                <!-- Filas dinámicas agrupadas estilo Tableau -->
                            </tbody>
                            <tfoot id="cp04-tfoot-detalle" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md">
                                <!-- Totales -->
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
        `;

        // Listener para el buscador rápido de detalles
        const inputBuscar = document.getElementById('cp04-input-buscar-detalle');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.terminoBusquedaDetalle = e.target.value || '';
                this.filtrarLocalmente();
            });
        }

        this.filtrarLocalmente();
    },

    /**
     * 1. Render de Tabla Resumen "Costo Produccion por Kg de Pollo Vivo"
     */
    renderTablaResumen(filas) {
        const tbody = document.getElementById('cp04-tbody-resumen');
        const tfoot = document.getElementById('cp04-tfoot-resumen');
        const badge = document.getElementById('cp04-badge-total-lineas');
        if (!tbody) return;

        if (badge && filas) {
            badge.textContent = `${filas.length} ${filas.length === 1 ? 'Línea' : 'Líneas'}`;
        }

        let totalValor = 0.0;
        let kilosProdDia = 0.0;
        const fechaActiva = this.datosBackend.fecha || '';

        let html = '';
        filas.forEach(r => {
            const val = Number(r.valor) || 0;
            const kg = Number(r.kilos_prod) || 0;
            const cu = (kg > 0) ? (val / kg) : (Number(r.cu) || 0);

            if (kilosProdDia === 0.0 && kg > 0) kilosProdDia = kg;
            totalValor += val;

            const isSelected = this.lineaSeleccionada && String(this.lineaSeleccionada).trim() === String(r.linea).trim();
            const rowClass = isSelected 
                ? 'bg-blue-100/70 text-blue-900 font-bold ring-1 ring-blue-400' 
                : 'hover:bg-blue-50/50 cursor-pointer transition-colors';

            html += `
                <tr class="cp04-row-resumen ${rowClass}" 
                    data-linea="${r.linea || ''}" 
                    data-nomlinea="${r.nomlinea || ''}"
                    data-valor="${val}"
                    data-kilosprod="${kg}"
                    data-cu="${cu}"
                    data-fecha="${fechaActiva}">
                    <td class="px-2.5 py-1.5 text-left font-mono font-bold text-slate-900 border-r border-slate-100">${r.linea || ''}</td>
                    <td class="px-3 py-1.5 text-left border-r border-slate-100 font-medium">${r.nomlinea || ''}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100">${this.formatNum(kg, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Render Total general en tfoot
        const totalCU = (kilosProdDia > 0) ? (totalValor / kilosProdDia) : 0.0;
        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td class="px-2.5 py-2 text-left font-bold border-r border-slate-200"></td>
                    <td class="px-3 py-2 text-left font-bold border-r border-slate-200">Total general</td>
                    <td class="px-3 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(totalValor, 2)}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(kilosProdDia, 2)}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
                </tr>
            `;
        }

        // Eventos de Tooltip y Filtro Cruzado al hacer clic en una fila de la Tabla 1
        const self = this;
        tbody.querySelectorAll('.cp04-row-resumen').forEach(tr => {
            tr.addEventListener('mouseenter', (e) => {
                self.showTooltip(e, {
                    fecha: tr.getAttribute('data-fecha'),
                    linea: tr.getAttribute('data-linea'),
                    nomlinea: tr.getAttribute('data-nomlinea'),
                    valor: tr.getAttribute('data-valor'),
                    kilosprod: tr.getAttribute('data-kilosprod'),
                    cu: tr.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mousemove', (e) => {
                self.showTooltip(e, {
                    fecha: tr.getAttribute('data-fecha'),
                    linea: tr.getAttribute('data-linea'),
                    nomlinea: tr.getAttribute('data-nomlinea'),
                    valor: tr.getAttribute('data-valor'),
                    kilosprod: tr.getAttribute('data-kilosprod'),
                    cu: tr.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mouseleave', () => {
                self.hideTooltip();
            });

            // Click para activar / desactivar Filtro Cruzado por Línea
            tr.addEventListener('click', (e) => {
                e.stopPropagation();
                const linea = tr.getAttribute('data-linea');
                if (self.lineaSeleccionada === linea) {
                    self.lineaSeleccionada = null;
                } else {
                    self.lineaSeleccionada = linea;
                }
                self.filtrarLocalmente();
            });
        });
    },

    /**
     * 2. Render de Tabla Detalle "Detalle del costo Unitario por Linea" con Agrupación Tableau
     */
    renderTablaDetalle(filas) {
        const tbody = document.getElementById('cp04-tbody-detalle');
        const tfoot = document.getElementById('cp04-tfoot-detalle');
        const badgeTotal = document.getElementById('cp04-badge-total-detalles');
        const badgeFiltro = document.getElementById('cp04-badge-filtro-activo');
        if (!tbody) return;

        if (badgeTotal) {
            badgeTotal.textContent = `${this.formatNum(filas.length, 0)} Registros`;
        }

        if (badgeFiltro) {
            if (this.lineaSeleccionada) {
                badgeFiltro.textContent = `Línea: ${this.lineaSeleccionada}`;
                badgeFiltro.classList.remove('hidden');
            } else {
                badgeFiltro.classList.add('hidden');
            }
        }

        if (filas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="px-4 py-8 text-center text-slate-400">
                        No se encontraron registros de detalle para los filtros activos.
                    </td>
                </tr>
            `;
            if (tfoot) tfoot.innerHTML = '';
            return;
        }

        const fechaActiva = this.datosBackend.fecha || '';
        let html = '';

        let totalCantidad = 0.0;
        let totalPeso = 0.0;
        let totalValor = 0.0;
        let kilosProdDia = 0.0;

        let lastCencos = null;
        let lastGalpon = null;
        let lastLinea = null;

        filas.forEach((r, idx) => {
            const cant = Number(r.cantidad) || 0;
            const peso = Number(r.peso) || 0;
            const val = Number(r.valor) || 0;
            const kgAcu = Number(r.kilosprodacu) || 0;
            const cu = (kgAcu > 0) ? (val / kgAcu) : (Number(r.cu) || 0);

            if (kilosProdDia === 0.0 && kgAcu > 0) kilosProdDia = kgAcu;
            totalCantidad += cant;
            totalPeso += peso;
            totalValor += val;

            const cencosStr = String(r.cencos || '').trim();
            const galponStr = (r.galpon !== undefined && r.galpon !== null) ? String(r.galpon).trim() : '';
            const lineaStr = String(r.linea || '').trim();

            const isCencosChange = cencosStr !== lastCencos;
            const isGalponChange = isCencosChange || (galponStr !== lastGalpon);
            const isLineaChange = isGalponChange || (lineaStr !== lastLinea);

            // Estilos de borde de división entre grupos como en Tableau
            let borderTopClass = '';
            if (idx > 0) {
                if (isCencosChange) {
                    borderTopClass = 'border-t-2 border-slate-400';
                } else if (isGalponChange) {
                    borderTopClass = 'border-t border-slate-300';
                } else if (isLineaChange) {
                    borderTopClass = 'border-t border-slate-200';
                }
            }

            // En Tableau, cencos, galpón y línea solo se imprimen en la primera fila de su cambio
            const cencosDisplay = isCencosChange ? cencosStr : '';
            const galponDisplay = isGalponChange ? galponStr : '';
            const lineaDisplay = isLineaChange ? lineaStr : '';

            lastCencos = cencosStr;
            lastGalpon = galponStr;
            lastLinea = lineaStr;

            html += `
                <tr class="cp04-row-detalle hover:bg-blue-50/40 transition-colors ${borderTopClass}"
                    data-cencos="${cencosStr}"
                    data-galpon="${galponStr}"
                    data-linea="${lineaStr}"
                    data-nomlinea="${r.nomlinea || ''}"
                    data-codigo="${r.codigo || ''}"
                    data-nomcodigo="${r.nomcodigo || ''}"
                    data-unidad="${r.unidad || ''}"
                    data-cantidad="${cant}"
                    data-peso="${peso}"
                    data-valor="${val}"
                    data-kilosprod="${kgAcu}"
                    data-cu="${cu}"
                    data-fecha="${fechaActiva}">
                    <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-900 border-r border-slate-100">${cencosDisplay}</td>
                    <td class="px-1.5 py-1.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-100">${galponDisplay}</td>
                    <td class="px-2 py-1.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-100">${lineaDisplay}</td>
                    <td class="px-2.5 py-1.5 text-left font-mono font-bold text-slate-800 border-r border-slate-100 whitespace-nowrap">${r.codigo || ''}</td>
                    <td class="px-3 py-1.5 text-left border-r border-slate-100 truncate max-w-[200px]" title="${r.nomcodigo || ''}">${r.nomcodigo || ''}</td>
                    <td class="px-2 py-1.5 text-center font-mono border-r border-slate-100">${r.unidad || ''}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${this.formatNum(cant, 2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100">${this.formatNum(peso, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono font-semibold border-r border-slate-100">${this.formatNum(val, 2)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-600 border-r border-slate-100">${this.formatNum(kgAcu, 2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900">${this.formatNum(cu, 3)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        // Render Footer Total general de Tabla 2
        const totalCU = (kilosProdDia > 0) ? (totalValor / kilosProdDia) : 0.0;
        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td class="px-2 py-2 border-r border-slate-200"></td>
                    <td class="px-1.5 py-2 border-r border-slate-200"></td>
                    <td class="px-2 py-2 border-r border-slate-200"></td>
                    <td class="px-2.5 py-2 border-r border-slate-200"></td>
                    <td class="px-3 py-2 text-left font-bold border-r border-slate-200">Total general</td>
                    <td class="px-2 py-2 border-r border-slate-200"></td>
                    <td class="px-2.5 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(totalCantidad, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(totalPeso, 2)}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(totalValor, 2)}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold border-r border-slate-200">${this.formatNum(kilosProdDia, 2)}</td>
                    <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700">${this.formatNum(totalCU, 3)}</td>
                </tr>
            `;
        }

        // Tooltips para filas de la Tabla 2
        const self = this;
        tbody.querySelectorAll('.cp04-row-detalle').forEach(tr => {
            tr.addEventListener('mouseenter', (e) => {
                self.showTooltip(e, {
                    fecha: tr.getAttribute('data-fecha'),
                    cencos: tr.getAttribute('data-cencos'),
                    galpon: tr.getAttribute('data-galpon'),
                    linea: tr.getAttribute('data-linea'),
                    nomlinea: tr.getAttribute('data-nomlinea'),
                    codigo: tr.getAttribute('data-codigo'),
                    nomcodigo: tr.getAttribute('data-nomcodigo'),
                    unidad: tr.getAttribute('data-unidad'),
                    cantidad: tr.getAttribute('data-cantidad'),
                    peso: tr.getAttribute('data-peso'),
                    valor: tr.getAttribute('data-valor'),
                    kilosprod: tr.getAttribute('data-kilosprod'),
                    cu: tr.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mousemove', (e) => {
                self.showTooltip(e, {
                    fecha: tr.getAttribute('data-fecha'),
                    cencos: tr.getAttribute('data-cencos'),
                    galpon: tr.getAttribute('data-galpon'),
                    linea: tr.getAttribute('data-linea'),
                    nomlinea: tr.getAttribute('data-nomlinea'),
                    codigo: tr.getAttribute('data-codigo'),
                    nomcodigo: tr.getAttribute('data-nomcodigo'),
                    unidad: tr.getAttribute('data-unidad'),
                    cantidad: tr.getAttribute('data-cantidad'),
                    peso: tr.getAttribute('data-peso'),
                    valor: tr.getAttribute('data-valor'),
                    kilosprod: tr.getAttribute('data-kilosprod'),
                    cu: tr.getAttribute('data-cu')
                });
            });

            tr.addEventListener('mouseleave', () => {
                self.hideTooltip();
            });
        });
    }
};

// Registrar en ChartRegistry para invocación modular
window.ChartRegistry['CP04 CostosGeneralesDetalleAlDia'] = CP04_DEFINITION;
window.ChartRegistry['CP04CostosGeneralesDetalleAlDia'] = CP04_DEFINITION;
window.ChartRegistry['CP04 CostosGeneralesDetalle'] = CP04_DEFINITION;
window.ChartRegistry['CP04CostosGeneralesDetalle'] = CP04_DEFINITION;
window.ChartRegistry['CP04 Costos Generales Detalle Al Dia'] = CP04_DEFINITION;
window.ChartRegistry['CP04'] = CP04_DEFINITION;
