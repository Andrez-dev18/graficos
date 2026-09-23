/**
 * Componente de Gráfico / Vista: PT (Producto Terminado)
 * Módulo: PPPT2026
 * 
 * Renderiza la matriz de Costos por Galpón y Código de Costo según el libro Tableau PPT 2026 (Hoja PT),
 * calculando sobre timfipt (Prod Term), con filtro interactivo de LÍMITE (dual range slider con rAF throttling),
 * columnas estáticas/fijas a la izquierda (Cencos, nombre, CodigoCosto) y exportación a Excel con estilos Tableau.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartPT = {
    controllerRef: null,
    datosBackend: null,
    filasCompletas: [],
    multiActividad: null,
    maxLimiteGlobal: 284761.56,
    moneyFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    rafId: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Pre-procesar números para máxima velocidad de filtrado
        const rawFilas = (data && data.filas) ? data.filas : [];
        this.filasCompletas = rawFilas.map(f => ({
            ...f,
            _t: Number(f.total) || 0,
            _g1: Number(f.g1) || 0,
            _g2: Number(f.g2) || 0,
            _g3: Number(f.g3) || 0,
            _g4: Number(f.g4) || 0,
            _g5: Number(f.g5) || 0,
            _g6: Number(f.g6) || 0,
            _g7: Number(f.g7) || 0,
            _g8: Number(f.g8) || 0,
            _g9: Number(f.g9) || 0,
            _g10: Number(f.g10) || 0,
            _g11: Number(f.g11) || 0,
            _g12: Number(f.g12) || 0
        }));

        // 1. Poblar / actualizar opciones de filtros
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // 2. Inicializar / sincronizar slider de LÍMITE con los datos
        this.setupLimiteSlider();

        // 3. Renderizar estructura base y contenido
        this.renderTableStructure();
        this.updateTableBody(this.filasCompletas, this.datosBackend.totales);
        this.setupExportListeners();
    },

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    },

    haveSameOptions(instance, newArr) {
        if (!instance || !instance.options || !newArr) return false;
        if (instance.options.length !== newArr.length) return false;
        for (let i = 0; i < newArr.length; i++) {
            if (instance.options[i].id !== String(newArr[i]).trim()) return false;
        }
        return true;
    },

    resetFilters() {
        if (this.multiActividad) {
            this.multiActividad.options.forEach(o => {
                o.selected = (o.id === 'AV');
            });
            this.multiActividad.updateLabel(false);
            this.multiActividad.render();
        }
        this.resetLimiteSlider();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiActividad) {
            const vals = this.multiActividad.getSelectedValues();
            if (vals.length > 0) {
                filters.actividad = vals;
            }
        }
        return filters;
    },

    setupFilters(opciones = {}) {
        if (typeof CustomMultiSelect === 'undefined') return;

        const actDisp = opciones.actividades || ['AV', 'H2'];

        if (!this.multiActividad) {
            const optActividad = actDisp.map(a => ({
                id: String(a).trim(),
                label: String(a).trim(),
                selected: (String(a).trim() === 'AV')
            }));

            this.multiActividad = new CustomMultiSelect({
                btnId: 'btn-dropdown-actividad-pppt',
                dropdownId: 'dropdown-actividad-pppt',
                optionsContainerId: 'container-options-actividad-pppt',
                labelId: 'label-actividad-pppt',
                searchId: 'search-actividad-pppt',
                title: 'ACTIVIDAD',
                options: optActividad
            });
        } else if (actDisp.length > 0 && !this.haveSameOptions(this.multiActividad, actDisp)) {
            const currentSelected = this.multiActividad.getSelectedValues();
            const optActividad = actDisp.map(a => ({
                id: String(a).trim(),
                label: String(a).trim(),
                selected: currentSelected.length > 0 ? currentSelected.includes(String(a).trim()) : (String(a).trim() === 'AV')
            }));
            this.multiActividad.setOptions(optActividad);
        }
    },

    setupLimiteSlider() {
        const sliderMin = document.getElementById('input-limite-min');
        const sliderMax = document.getElementById('input-limite-max');
        const labelMin = document.getElementById('label-limite-min');
        const labelMax = document.getElementById('label-limite-max');
        const highlight = document.getElementById('slider-track-highlight');

        if (!sliderMin || !sliderMax) return;

        // Máximo exacto fijado por Tableau para PT
        this.maxLimiteGlobal = 284761.56;

        sliderMin.min = "0";
        sliderMin.max = String(this.maxLimiteGlobal);
        sliderMin.step = "0.01";
        sliderMin.value = "0";

        sliderMax.min = "0";
        sliderMax.max = String(this.maxLimiteGlobal);
        sliderMax.step = "0.01";
        sliderMax.value = String(this.maxLimiteGlobal);

        if (labelMin) labelMin.textContent = this.formatTotal(0);
        if (labelMax) labelMax.textContent = this.formatTotal(this.maxLimiteGlobal);
        if (highlight) {
            highlight.style.left = '0%';
            highlight.style.width = '100%';
        }

        // Remover listeners anteriores clonando los elementos
        const newMin = sliderMin.cloneNode(true);
        const newMax = sliderMax.cloneNode(true);
        sliderMin.parentNode.replaceChild(newMin, sliderMin);
        sliderMax.parentNode.replaceChild(newMax, sliderMax);

        const onSliderChange = () => {
            let val1 = parseFloat(newMin.value) || 0;
            let val2 = parseFloat(newMax.value) || 0;

            if (val1 > val2) {
                const temp = val1;
                val1 = val2;
                val2 = temp;
            }

            // Actualización visual instantánea de los labels y la barra (0ms lag)
            if (labelMin) labelMin.textContent = this.formatTotal(val1);
            if (labelMax) labelMax.textContent = this.formatTotal(val2);

            if (highlight) {
                const pctMin = (val1 / this.maxLimiteGlobal) * 100;
                const pctMax = (val2 / this.maxLimiteGlobal) * 100;
                highlight.style.left = `${pctMin}%`;
                highlight.style.width = `${pctMax - pctMin}%`;
            }

            // Sincronización del renderizado con requestAnimationFrame
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }
            this.rafId = requestAnimationFrame(() => {
                this.filtrarPorLimite(val1, val2);
            });
        };

        newMin.addEventListener('input', onSliderChange);
        newMax.addEventListener('input', onSliderChange);
    },

    resetLimiteSlider() {
        const sliderMin = document.getElementById('input-limite-min');
        const sliderMax = document.getElementById('input-limite-max');
        const labelMin = document.getElementById('label-limite-min');
        const labelMax = document.getElementById('label-limite-max');
        const highlight = document.getElementById('slider-track-highlight');

        if (sliderMin && sliderMax) {
            sliderMin.value = "0";
            sliderMax.value = String(this.maxLimiteGlobal);
            if (labelMin) labelMin.textContent = this.formatTotal(0);
            if (labelMax) labelMax.textContent = this.formatTotal(this.maxLimiteGlobal);
            if (highlight) {
                highlight.style.left = '0%';
                highlight.style.width = '100%';
            }
            this.filtrarPorLimite(0, this.maxLimiteGlobal);
        }
    },

    filtrarPorLimite(minVal, maxVal) {
        const isFullRange = (minVal <= 0.001 && maxVal >= (this.maxLimiteGlobal - 0.01));
        const totalRows = this.filasCompletas.length;
        const filtradas = [];

        const totales = {
            g1: 0.0, g2: 0.0, g3: 0.0, g4: 0.0,
            g5: 0.0, g6: 0.0, g7: 0.0, g8: 0.0,
            g9: 0.0, g10: 0.0, g11: 0.0, g12: 0.0,
            total: 0.0
        };

        for (let i = 0; i < totalRows; i++) {
            const f = this.filasCompletas[i];
            let include = isFullRange;

            if (!include) {
                const t = f._t;
                if (t >= minVal && t <= maxVal) {
                    include = true;
                } else if (
                    (f._g1 > 0 && f._g1 >= minVal && f._g1 <= maxVal) ||
                    (f._g2 > 0 && f._g2 >= minVal && f._g2 <= maxVal) ||
                    (f._g3 > 0 && f._g3 >= minVal && f._g3 <= maxVal) ||
                    (f._g4 > 0 && f._g4 >= minVal && f._g4 <= maxVal) ||
                    (f._g5 > 0 && f._g5 >= minVal && f._g5 <= maxVal) ||
                    (f._g6 > 0 && f._g6 >= minVal && f._g6 <= maxVal) ||
                    (f._g7 > 0 && f._g7 >= minVal && f._g7 <= maxVal) ||
                    (f._g8 > 0 && f._g8 >= minVal && f._g8 <= maxVal) ||
                    (f._g9 > 0 && f._g9 >= minVal && f._g9 <= maxVal) ||
                    (f._g10 > 0 && f._g10 >= minVal && f._g10 <= maxVal) ||
                    (f._g11 > 0 && f._g11 >= minVal && f._g11 <= maxVal) ||
                    (f._g12 > 0 && f._g12 >= minVal && f._g12 <= maxVal)
                ) {
                    include = true;
                }
            }

            if (include) {
                filtradas.push(f);
                totales.g1 += f._g1;
                totales.g2 += f._g2;
                totales.g3 += f._g3;
                totales.g4 += f._g4;
                totales.g5 += f._g5;
                totales.g6 += f._g6;
                totales.g7 += f._g7;
                totales.g8 += f._g8;
                totales.g9 += f._g9;
                totales.g10 += f._g10;
                totales.g11 += f._g11;
                totales.g12 += f._g12;
                totales.total += f._t;
            }
        }

        this.datosBackend.filas = filtradas;
        this.datosBackend.totales = totales;

        this.updateTableBody(filtradas, totales);
    },

    formatCurrency(val) {
        if (!val || val === 0) return '';
        return 'S/' + this.moneyFormatter.format(val);
    },

    formatTotal(val) {
        if (!val || val === 0) return 'S/0.00';
        return 'S/' + this.moneyFormatter.format(val);
    },

    renderTableStructure() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        // Solo renderizar la estructura exterior si no existe ya
        if (document.getElementById('tabla-pt-pppt2026')) return;

        const tableHtml = `
            <div class="w-full flex flex-col bg-white overflow-hidden">
                <!-- ENCABEZADO DE TABLA ESTANDARIZADO CON BOTÓN EXCEL -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">PT</h2>
                            <span id="badge-total-registros-pt" class="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">0 registros</span>
                        </div>
                        <span class="text-[11px] text-slate-400 font-medium">Costos por Galpón y Código de Costo</span>
                    </div>

                    <!-- BOTÓN EXPORTAR EXCEL ESTÁNDAR -->
                    <button id="btn-export-excel-pt" type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span>Excel</span>
                    </button>
                </div>

                <!-- Tabla Scrolleable con Columnas Fijas a la izquierda (Cencos, nombre, CodigoCosto) -->
                <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                    <table id="tabla-pt-pppt2026" class="w-full text-xs border-collapse border border-slate-200 select-text">
                        <thead class="sticky top-0 z-20 shadow-xs">
                            <!-- Nivel 1: Categorías principales (Columnas congeladas a la izquierda con z-30) -->
                            <tr class="bg-blue-600 text-white font-semibold text-[11px]">
                                <th rowspan="2" class="sticky left-0 z-30 bg-blue-600 px-2.5 py-2 text-left border-r border-blue-500 w-[80px] min-w-[80px] max-w-[80px]">Cencos</th>
                                <th rowspan="2" class="sticky left-[80px] z-30 bg-blue-600 px-2.5 py-2 text-left border-r border-blue-500 w-[180px] min-w-[180px] max-w-[180px]">nombre</th>
                                <th rowspan="2" class="sticky left-[260px] z-30 bg-blue-600 px-2.5 py-2 text-center border-r-2 border-blue-800 w-[90px] min-w-[90px] max-w-[90px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.2)]">CodigoCosto</th>
                                <th colspan="12" class="px-2.5 py-1.5 text-center border-r border-blue-500 font-bold tracking-wide uppercase">Galpon</th>
                                <th rowspan="2" class="px-2.5 py-2 text-right min-w-[120px] bg-blue-700">Total general</th>
                            </tr>
                            <!-- Nivel 2: Columnas de Galpones -->
                            <tr class="bg-blue-600 text-white font-semibold text-[11px]">
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">1</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">2</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">3</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">4</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">5</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">6</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">7</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">8</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">9</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">10</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">11</th>
                                <th class="px-2.5 py-1.5 text-center border-r border-blue-500 min-w-[85px]">12</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-pt-pppt2026" class="divide-y divide-slate-100 bg-white">
                        </tbody>
                        <tfoot id="tfoot-pt-pppt2026" class="sticky bottom-0 z-20 bg-white border-t-2 border-slate-300 shadow-md text-[11px] text-slate-800">
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        contenedorGrafica.innerHTML = tableHtml;
    },

    updateTableBody(filas, totales) {
        const tbody = document.getElementById('tbody-pt-pppt2026');
        const tfoot = document.getElementById('tfoot-pt-pppt2026');
        const badge = document.getElementById('badge-total-registros-pt');

        if (!tbody || !tfoot) {
            this.renderTableStructure();
            return this.updateTableBody(filas, totales);
        }

        if (badge) {
            badge.textContent = `${filas.length.toLocaleString('es-PE')} registros`;
        }

        if (filas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="16" class="px-4 py-12 text-center text-slate-400 font-medium">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i class="fa-solid fa-inbox text-3xl text-slate-300"></i>
                            <span>No se encontraron registros para los filtros o rango de límite seleccionado.</span>
                        </div>
                    </td>
                </tr>
            `;
            tfoot.innerHTML = '';
            return;
        }

        const rowsBuffer = [];

        for (let i = 0; i < filas.length; i++) {
            const r = filas[i];

            rowsBuffer.push(`
                <tr class="hover:bg-blue-50/40 transition-colors border-b border-slate-200 text-[11px] text-slate-700 group">
                    <td class="sticky left-0 z-10 bg-white group-hover:bg-blue-50/60 px-2.5 py-1.5 font-mono font-bold text-slate-800 border-r border-slate-200 w-[80px] min-w-[80px] max-w-[80px]">${r.cencos}</td>
                    <td class="sticky left-[80px] z-10 bg-white group-hover:bg-blue-50/60 px-2.5 py-1.5 font-medium text-slate-700 border-r border-slate-200 w-[180px] min-w-[180px] max-w-[180px] truncate" title="${r.nombre}">${r.nombre}</td>
                    <td class="sticky left-[260px] z-10 bg-slate-50 group-hover:bg-blue-50/80 px-2.5 py-1.5 text-center font-mono font-bold text-slate-600 border-r-2 border-slate-300 w-[90px] min-w-[90px] max-w-[90px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">${r.codigo_costo}</td>
                    
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g1)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g2)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g3)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g4)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g5)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g6)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g7)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g8)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g9)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g10)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g11)}</td>
                    <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r._g12)}</td>
                    
                    <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">${this.formatTotal(r._t)}</td>
                </tr>
            `);
        }

        tbody.innerHTML = rowsBuffer.join('');

        // Renderizar tfoot con subtotales y eje Tableau
        const axisCellHtml = `
            <td class="px-1.5 py-1 border-r border-slate-200 bg-white select-none">
                <div class="flex flex-col items-center w-full">
                    <div class="w-full flex justify-between text-[8.5px] text-slate-400 font-sans tracking-tight px-0.5">
                        <span>0M</span>
                        <span>20M</span>
                        <span>40M</span>
                    </div>
                    <div class="text-[10px] font-semibold text-slate-600 mt-0.5">Prod Term</div>
                </div>
            </td>
        `;

        let axisColsHtml = '';
        for (let i = 1; i <= 13; i++) {
            axisColsHtml += axisCellHtml;
        }

        tfoot.innerHTML = `
            ${totales ? `
            <tr class="bg-slate-100 font-bold border-b border-slate-200">
                <td colspan="3" class="sticky left-0 z-30 bg-slate-200 px-3 py-1.5 text-right uppercase tracking-wider font-bold border-r-2 border-slate-300 w-[350px] min-w-[350px] max-w-[350px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                    Total General:
                </td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g1)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g2)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g3)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g4)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g5)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g6)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g7)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g8)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g9)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g10)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g11)}</td>
                <td class="px-2 py-1.5 text-right font-mono border-r border-slate-300 whitespace-nowrap">${this.formatTotal(totales.g12)}</td>
                <td class="px-2.5 py-1.5 text-right font-mono font-bold text-blue-900 bg-blue-100/60 whitespace-nowrap">${this.formatTotal(totales.total)}</td>
            </tr>
            ` : ''}

            <tr class="bg-white border-t border-slate-200 divide-x divide-slate-200">
                <td colspan="3" class="sticky left-0 z-30 bg-white border-r-2 border-slate-300 w-[350px] min-w-[350px] max-w-[350px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]"></td>
                ${axisColsHtml}
            </tr>
        `;
    },

    setupExportListeners() {
        const btnExport = document.getElementById('btn-export-excel-pt');
        if (!btnExport) return;

        // Remover listeners anteriores clonando
        const newBtn = btnExport.cloneNode(true);
        btnExport.parentNode.replaceChild(newBtn, btnExport);

        newBtn.addEventListener('click', () => {
            const filas = (this.datosBackend && this.datosBackend.filas) ? this.datosBackend.filas : [];
            if (!filas.length) {
                alert('No hay datos disponibles para exportar.');
                return;
            }

            if (typeof XLSX === 'undefined') {
                alert('Librería de exportación XLSX no disponible.');
                return;
            }

            // Estilos oficiales estándar
            const headerStyle = {
                fill: { fgColor: { rgb: "2563EB" } }, // #2563EB
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
                alignment: { vertical: "center", horizontal: "left" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            const dataStyleCenter = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            const dataStyleCurrency = {
                font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
                alignment: { vertical: "center", horizontal: "right" },
                border: {
                    top: { style: "thin", color: { rgb: "E2E8F0" } },
                    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                    left: { style: "thin", color: { rgb: "E2E8F0" } },
                    right: { style: "thin", color: { rgb: "E2E8F0" } }
                }
            };

            // Fila de encabezado nivel 1
            const rowHead1 = [
                { t: 's', v: 'Cencos', s: headerStyle },
                { t: 's', v: 'nombre', s: headerStyle },
                { t: 's', v: 'CodigoCosto', s: headerStyle },
                { t: 's', v: 'Galpon', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: 'Total general', s: headerStyle }
            ];

            // Fila de encabezado nivel 2
            const rowHead2 = [
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '', s: headerStyle },
                { t: 's', v: '1', s: headerStyle },
                { t: 's', v: '2', s: headerStyle },
                { t: 's', v: '3', s: headerStyle },
                { t: 's', v: '4', s: headerStyle },
                { t: 's', v: '5', s: headerStyle },
                { t: 's', v: '6', s: headerStyle },
                { t: 's', v: '7', s: headerStyle },
                { t: 's', v: '8', s: headerStyle },
                { t: 's', v: '9', s: headerStyle },
                { t: 's', v: '10', s: headerStyle },
                { t: 's', v: '11', s: headerStyle },
                { t: 's', v: '12', s: headerStyle },
                { t: 's', v: '', s: headerStyle }
            ];

            // Filas de datos
            const dataRows = filas.map(f => [
                { t: 's', v: f.cencos || '', s: dataStyleCenter },
                { t: 's', v: f.nombre || '', s: dataStyleLeft },
                { t: 's', v: f.codigo_costo || '', s: dataStyleCenter },
                { t: 'n', v: f._g1, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g2, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g3, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g4, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g5, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g6, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g7, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g8, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g9, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g10, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g11, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._g12, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: f._t, z: '"S/ "#,##0.00', s: dataStyleCurrency }
            ]);

            const sheetData = [rowHead1, rowHead2, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Merges de encabezados
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Cencos
                { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // nombre
                { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // CodigoCosto
                { s: { r: 0, c: 3 }, e: { r: 0, c: 14 } }, // Galpon 1..12
                { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }  // Total general
            ];

            // Re-asignar estilos y formatos z a cada celda generada
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (ws[addr] && sheetData[R] && sheetData[R][C]) {
                        ws[addr].s = sheetData[R][C].s;
                        if (sheetData[R][C].z) ws[addr].z = sheetData[R][C].z;
                    }
                }
            }

            ws['!cols'] = [
                { wch: 12 }, // Cencos
                { wch: 28 }, // nombre
                { wch: 14 }, // CodigoCosto
                { wch: 13 }, // G1
                { wch: 13 }, // G2
                { wch: 13 }, // G3
                { wch: 13 }, // G4
                { wch: 13 }, // G5
                { wch: 13 }, // G6
                { wch: 13 }, // G7
                { wch: 13 }, // G8
                { wch: 13 }, // G9
                { wch: 13 }, // G10
                { wch: 13 }, // G11
                { wch: 13 }, // G12
                { wch: 16 }  // Total general
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PT');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `PPT2026_PT_${fechaStr}.xlsx`);
        });
    }
};

window.ChartRegistry['PT'] = window.ChartPT;
window.ChartRegistry['DashPT'] = window.ChartPT;
