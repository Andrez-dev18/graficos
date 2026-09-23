/**
 * Componente de Gráfico / Vista: PPResu (Resumen Producto en Proceso por Centro de Costo)
 * Módulo: PPPT2026
 * 
 * Renderiza la matriz de Costos Resumen por Granja/Centro de Costos según Tableau PPT 2026 (Hoja PPResu),
 * calculando sobre timfipp (Prod Proc), con texto plano en galpones, barra proporcional Tableau (#499894)
 * en Total general (filas y footer) y eje Prod Proc (0M 20M 40M), filtro LÍMITE (0.00 a 411,759.44 exacto),
 * columnas congeladas fijas (Cencos, nombre) y exportación a Excel con estilos Tableau.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartPPResu = {
    controllerRef: null,
    datosBackend: null,
    filasCompletas: [],
    multiActividad: null,
    maxLimiteGlobal: 411759.44,
    scaleMaxTotal: 2500000.00,
    scaleMaxFooterGalpon: 40000000.00,
    moneyFormatter: new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    rafId: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Pre-procesar números para máxima velocidad de filtrado
        const rawFilas = (data && data.filas) ? data.filas : [];
        let maxRowTotal = 0;

        const parseGalpon = (v) => (v !== null && v !== undefined && v !== '') ? Number(v) : null;

        this.filasCompletas = rawFilas.map(f => {
            const t = Number(f.total) || 0;
            if (t > maxRowTotal) maxRowTotal = t;
            const g1 = parseGalpon(f.g1);
            const g2 = parseGalpon(f.g2);
            const g3 = parseGalpon(f.g3);
            const g4 = parseGalpon(f.g4);
            const g5 = parseGalpon(f.g5);
            const g6 = parseGalpon(f.g6);
            const g7 = parseGalpon(f.g7);
            const g8 = parseGalpon(f.g8);
            const g9 = parseGalpon(f.g9);
            const g10 = parseGalpon(f.g10);
            const g11 = parseGalpon(f.g11);
            const g12 = parseGalpon(f.g12);

            return {
                ...f,
                _t: t,
                _g1: g1, _g2: g2, _g3: g3, _g4: g4,
                _g5: g5, _g6: g6, _g7: g7, _g8: g8,
                _g9: g9, _g10: g10, _g11: g11, _g12: g12
            };
        });

        // Límite fijado exacto de Tableau: 411,759.44
        this.maxLimiteGlobal = 411759.44;
        this.scaleMaxTotal = Math.max(100000, maxRowTotal > 0 ? maxRowTotal * 1.05 : 2500000.00);

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
                } else {
                    for (let g = 1; g <= 12; g++) {
                        const gVal = f['_g' + g];
                        if (gVal !== null && gVal >= minVal && gVal <= maxVal) {
                            include = true;
                            break;
                        }
                    }
                }
            }

            if (include) {
                filtradas.push(f);
                for (let g = 1; g <= 12; g++) {
                    const gVal = f['_g' + g];
                    if (gVal !== null) {
                        totales['g' + g] += gVal;
                    }
                }
                totales.total += f._t;
            }
        }

        this.datosBackend.filas = filtradas;
        this.datosBackend.totales = totales;

        this.updateTableBody(filtradas, totales);
    },

    formatCurrency(val) {
        if (val === null || val === undefined) return '';
        if (val === 0) return 'S/0,00';
        return 'S/' + this.moneyFormatter.format(val);
    },

    formatTotal(val) {
        if (!val || val === 0) return 'S/0,00';
        return 'S/' + this.moneyFormatter.format(val);
    },

    renderTableStructure() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        // Solo renderizar la estructura exterior si no existe ya
        if (document.getElementById('tabla-ppresu-pppt2026')) return;

        const tableHtml = `
            <div class="w-full flex flex-col bg-white overflow-hidden">
                <!-- ENCABEZADO DE TABLA ESTANDARIZADO CON BOTÓN EXCEL (PALETA INDIGO TABLEAU) -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">PPResu</h2>
                            <span id="badge-total-registros-ppresu" class="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">0 registros</span>
                        </div>
                        <span class="text-[11px] text-slate-400 font-medium">Resumen Consolidado por Centro de Costos (Producto en Proceso)</span>
                    </div>

                    <!-- BOTÓN EXPORTAR EXCEL ESTÁNDAR -->
                    <button id="btn-export-excel-ppresu" type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs transition-all cursor-pointer">
                        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        <span>Excel</span>
                    </button>
                </div>

                <!-- Tabla Scrolleable con Columnas Fijas a la izquierda (Cencos, nombre) - Paleta Indigo -->
                <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                    <table id="tabla-ppresu-pppt2026" class="min-w-full text-xs border-collapse border border-slate-200 select-text">
                        <thead class="sticky top-0 z-20 shadow-xs">
                            <!-- Nivel 1: Categorías principales (Columnas congeladas a la izquierda con z-30) -->
                            <tr class="bg-indigo-700 text-white font-semibold text-[11px]">
                                <th rowspan="2" class="sticky left-0 z-30 bg-indigo-700 px-2.5 py-2 text-left border-r border-indigo-600 w-[85px] min-w-[85px] max-w-[85px]">Cencos</th>
                                <th rowspan="2" class="sticky left-[85px] z-30 bg-indigo-700 px-2.5 py-2 text-left border-r-2 border-indigo-900 w-[190px] min-w-[190px] max-w-[190px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.2)]">nombre</th>
                                <th colspan="12" class="px-2.5 py-1.5 text-center border-r border-indigo-600 font-bold tracking-wide uppercase">Galpon</th>
                                <th rowspan="2" class="px-3 py-2 text-left min-w-[230px] w-[230px] max-w-[230px] bg-indigo-800">Total general</th>
                            </tr>
                            <!-- Nivel 2: Columnas de Galpones -->
                            <tr class="bg-indigo-700 text-white font-semibold text-[11px]">
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">1</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">2</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">3</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">4</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">5</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">6</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">7</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">8</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">9</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">10</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">11</th>
                                <th class="px-2 py-1.5 text-center border-r border-indigo-600 min-w-[95px] w-[95px] max-w-[95px]">12</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-ppresu-pppt2026" class="divide-y divide-slate-100 bg-white">
                        </tbody>
                        <tfoot id="tfoot-ppresu-pppt2026" class="sticky bottom-0 z-20 bg-white border-t-2 border-slate-300 shadow-md text-[11px] text-slate-800">
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        contenedorGrafica.innerHTML = tableHtml;
    },

    updateTableBody(filas, totales) {
        const tbody = document.getElementById('tbody-ppresu-pppt2026');
        const tfoot = document.getElementById('tfoot-ppresu-pppt2026');
        const badge = document.getElementById('badge-total-registros-ppresu');

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
                    <td colspan="15" class="px-4 py-12 text-center text-slate-400 font-medium">
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

        // Renderizado de celda de galpón: EXACTO A TABLEAU (texto plano; blanco si es null/sin galpón; S/0,00 si es 0)
        const renderGalponCell = (val) => {
            if (val === null || val === undefined) {
                return `<td class="px-2 py-1.5 text-left font-mono border-r border-slate-200 text-slate-700 w-[95px] min-w-[95px] max-w-[95px] whitespace-nowrap"></td>`;
            }
            if (val === 0) {
                return `<td class="px-2 py-1.5 text-left font-mono border-r border-slate-200 text-slate-700 w-[95px] min-w-[95px] max-w-[95px] whitespace-nowrap">S/0,00</td>`;
            }
            return `<td class="px-2 py-1.5 text-left font-mono border-r border-slate-200 text-slate-700 w-[95px] min-w-[95px] max-w-[95px] whitespace-nowrap">${this.formatCurrency(val)}</td>`;
        };

        const rowsBuffer = [];

        for (let i = 0; i < filas.length; i++) {
            const r = filas[i];
            // Ancho en píxeles de la barra proporcional según eje Tableau (máx ~105px para 2.5M) para no desbordar la cuadrícula
            const barWidthPx = Math.min(105, Math.max(0, Math.round((r._t / 2500000) * 105)));

            rowsBuffer.push(`
                <tr class="hover:bg-indigo-50/40 transition-colors border-b border-slate-200 text-[11px] text-slate-700 group">
                    <td class="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/60 px-2.5 py-1.5 font-mono font-bold text-slate-800 border-r border-slate-200 w-[85px] min-w-[85px] max-w-[85px] truncate">${r.cencos}</td>
                    <td class="sticky left-[85px] z-10 bg-white group-hover:bg-indigo-50/60 px-2.5 py-1.5 font-semibold text-slate-800 border-r-2 border-slate-300 w-[190px] min-w-[190px] max-w-[190px] truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]" title="${r.nombre}">${r.nombre}</td>
                    
                    ${renderGalponCell(r._g1)}
                    ${renderGalponCell(r._g2)}
                    ${renderGalponCell(r._g3)}
                    ${renderGalponCell(r._g4)}
                    ${renderGalponCell(r._g5)}
                    ${renderGalponCell(r._g6)}
                    ${renderGalponCell(r._g7)}
                    ${renderGalponCell(r._g8)}
                    ${renderGalponCell(r._g9)}
                    ${renderGalponCell(r._g10)}
                    ${renderGalponCell(r._g11)}
                    ${renderGalponCell(r._g12)}
                    
                    <!-- TOTAL GENERAL CON BARRA PROPORCIONAL EXACTA DE TABLEAU (SIN DESBORDE) -->
                    <td class="px-2 py-1 w-[230px] min-w-[230px] max-w-[230px] bg-slate-50/30 border-r border-slate-200">
                        <div class="flex items-center gap-1.5 w-full h-5 overflow-hidden">
                            ${r._t > 0 ? `<div class="h-3.5 bg-[#499894] rounded-xs shrink-0" style="width: ${barWidthPx}px; min-width: 2px;"></div>` : ''}
                            <span class="text-[11px] font-mono font-medium text-slate-800 whitespace-nowrap">${this.formatTotal(r._t)}</span>
                        </div>
                    </td>
                </tr>
            `);
        }

        tbody.innerHTML = rowsBuffer.join('');

        // Renderizar celdas del footer para Galpones 1 a 12 con barra horizontal pequeña a la izquierda + total
        const renderFooterGalponCell = (val) => {
            const numVal = val || 0;
            const barW = Math.min(25, Math.max(0, Math.round((numVal / 40000000) * 25)));
            return `
                <td class="px-1.5 py-1 border-r border-slate-300 bg-slate-100 w-[95px] min-w-[95px] max-w-[95px]">
                    <div class="flex items-center gap-1 w-full h-5 overflow-hidden">
                        ${numVal > 0 ? `<div class="h-3 bg-[#499894] rounded-xs shrink-0" style="width: ${barW}px; min-width: 2px;"></div>` : ''}
                        <span class="text-[10px] font-mono font-bold text-slate-900 whitespace-nowrap">${this.formatTotal(numVal)}</span>
                    </div>
                </td>
            `;
        };

        const axisCellHtml = `
            <td class="px-1 py-1 border-r border-slate-200 bg-white select-none w-[95px] min-w-[95px] max-w-[95px]">
                <div class="flex flex-col items-center w-full">
                    <div class="w-full flex justify-between text-[8px] text-slate-400 font-mono tracking-tight px-0.5">
                        <span>0M</span>
                        <span>20M</span>
                        <span>40M</span>
                    </div>
                    <div class="text-[9.5px] font-semibold text-slate-600 mt-0.5">Prod Proc</div>
                </div>
            </td>
        `;

        let axisColsHtml = '';
        for (let i = 1; i <= 12; i++) {
            axisColsHtml += axisCellHtml;
        }

        tfoot.innerHTML = `
            ${totales ? `
            <tr class="bg-slate-100 font-bold border-b border-slate-200">
                <td colspan="2" class="sticky left-0 z-30 bg-slate-200 px-3 py-1.5 text-left uppercase tracking-wider font-bold border-r-2 border-slate-300 w-[275px] min-w-[275px] max-w-[275px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]">
                    Total general
                </td>
                ${renderFooterGalponCell(totales.g1)}
                ${renderFooterGalponCell(totales.g2)}
                ${renderFooterGalponCell(totales.g3)}
                ${renderFooterGalponCell(totales.g4)}
                ${renderFooterGalponCell(totales.g5)}
                ${renderFooterGalponCell(totales.g6)}
                ${renderFooterGalponCell(totales.g7)}
                ${renderFooterGalponCell(totales.g8)}
                ${renderFooterGalponCell(totales.g9)}
                ${renderFooterGalponCell(totales.g10)}
                ${renderFooterGalponCell(totales.g11)}
                ${renderFooterGalponCell(totales.g12)}
                
                <!-- TOTAL GENERAL EN FOOTER: BARRA SÓLIDA VERDE/TEAL CON TEXTO BLANCO -->
                <td class="px-2 py-1 w-[230px] min-w-[230px] max-w-[230px] bg-slate-100">
                    <div class="relative w-full h-5.5 bg-[#499894] rounded-xs flex items-center justify-start px-2 shadow-2xs">
                        <span class="relative z-10 text-[11px] font-mono font-bold text-white drop-shadow-xs whitespace-nowrap">${this.formatTotal(totales.total)}</span>
                    </div>
                </td>
            </tr>
            ` : ''}

            <tr class="bg-white border-t border-slate-200 divide-x divide-slate-200">
                <td colspan="2" class="sticky left-0 z-30 bg-white border-r-2 border-slate-300 w-[275px] min-w-[275px] max-w-[275px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]"></td>
                ${axisColsHtml}
                <td class="bg-white w-[230px] min-w-[230px] max-w-[230px]"></td>
            </tr>
        `;
    },

    setupExportListeners() {
        const btnExport = document.getElementById('btn-export-excel-ppresu');
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

            // Estilos oficiales estándar en tono Indigo / Tableau
            const headerStyle = {
                fill: { fgColor: { rgb: "4338CA" } }, // #4338CA (Indigo 700)
                font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                alignment: { vertical: "center", horizontal: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "3730A3" } },
                    bottom: { style: "medium", color: { rgb: "3730A3" } },
                    left: { style: "thin", color: { rgb: "6366F1" } },
                    right: { style: "thin", color: { rgb: "6366F1" } }
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
                f._g1 !== null ? { t: 'n', v: f._g1, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g2 !== null ? { t: 'n', v: f._g2, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g3 !== null ? { t: 'n', v: f._g3, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g4 !== null ? { t: 'n', v: f._g4, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g5 !== null ? { t: 'n', v: f._g5, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g6 !== null ? { t: 'n', v: f._g6, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g7 !== null ? { t: 'n', v: f._g7, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g8 !== null ? { t: 'n', v: f._g8, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g9 !== null ? { t: 'n', v: f._g9, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g10 !== null ? { t: 'n', v: f._g10, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g11 !== null ? { t: 'n', v: f._g11, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                f._g12 !== null ? { t: 'n', v: f._g12, z: '"S/ "#,##0.00', s: dataStyleCurrency } : { t: 's', v: '', s: dataStyleCurrency },
                { t: 'n', v: f._t, z: '"S/ "#,##0.00', s: dataStyleCurrency }
            ]);

            const sheetData = [rowHead1, rowHead2, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);

            // Merges de encabezados
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Cencos
                { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // nombre
                { s: { r: 0, c: 2 }, e: { r: 0, c: 13 } }, // Galpon 1..12
                { s: { r: 0, c: 14 }, e: { r: 1, c: 14 } }  // Total general
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
                { wch: 30 }, // nombre
                { wch: 14 }, // G1
                { wch: 14 }, // G2
                { wch: 14 }, // G3
                { wch: 14 }, // G4
                { wch: 14 }, // G5
                { wch: 14 }, // G6
                { wch: 14 }, // G7
                { wch: 14 }, // G8
                { wch: 14 }, // G9
                { wch: 14 }, // G10
                { wch: 14 }, // G11
                { wch: 14 }, // G12
                { wch: 18 }  // Total general
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PPResu');
            const fechaStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `PPT2026_PPResu_${fechaStr}.xlsx`);
        });
    }
};

window.ChartRegistry['PPResu'] = window.ChartPPResu;
window.ChartRegistry['DashPPResu'] = window.ChartPPResu;
