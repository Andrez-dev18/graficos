/**
 * Componente de Gráfico / Vista: PT (Producto Terminado)
 * Módulo: PPPT2026
 * 
 * Renderiza la matriz de Costos por Galpón y Código de Costo según el libro Tableau PPT 2026,
 * con filtro interactivo de LÍMITE (dual range slider), agrupación por Cencos y exportación a Excel.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartPT = {
    controllerRef: null,
    datosBackend: null,
    filasCompletas: [],
    multiActividad: null,
    maxLimiteGlobal: 284761.56,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};
        this.filasCompletas = (data && data.filas) ? [...data.filas] : [];

        // 1. Poblar / actualizar opciones de filtros
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // 2. Inicializar / sincronizar slider de LÍMITE con los datos
        this.setupLimiteSlider();

        // 3. Renderizar tabla y exportación
        this.renderTable();
        this.setupExportListeners();
    },

    destroy() {},

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

        // Máximo exacto fijado por Tableau
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

            if (labelMin) labelMin.textContent = this.formatTotal(val1);
            if (labelMax) labelMax.textContent = this.formatTotal(val2);

            if (highlight) {
                const pctMin = (val1 / this.maxLimiteGlobal) * 100;
                const pctMax = (val2 / this.maxLimiteGlobal) * 100;
                highlight.style.left = `${pctMin}%`;
                highlight.style.width = `${pctMax - pctMin}%`;
            }

            // Filtrar instantáneamente en memoria
            this.filtrarPorLimite(val1, val2);
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

        const filtradas = this.filasCompletas.filter(f => {
            if (isFullRange) return true;
            // Verificar si el total o cualquiera de los galpones activos cae dentro del rango
            const t = Number(f.total) || 0;
            if (t >= minVal && t <= maxVal) return true;

            for (let i = 1; i <= 12; i++) {
                const gVal = Number(f[`g${i}`]) || 0;
                if (gVal > 0 && gVal >= minVal && gVal <= maxVal) {
                    return true;
                }
            }
            return false;
        });

        // Recalcular totales sumatorios
        const totales = {
            g1: 0.0, g2: 0.0, g3: 0.0, g4: 0.0,
            g5: 0.0, g6: 0.0, g7: 0.0, g8: 0.0,
            g9: 0.0, g10: 0.0, g11: 0.0, g12: 0.0,
            total: 0.0
        };

        filtradas.forEach(f => {
            for (let i = 1; i <= 12; i++) {
                totales[`g${i}`] += Number(f[`g${i}`]) || 0;
            }
            totales.total += Number(f.total) || 0;
        });

        this.datosBackend.filas = filtradas;
        this.datosBackend.totales = totales;

        this.renderTable();
        this.setupExportListeners();
    },

    formatCurrency(val) {
        if (val === null || val === undefined || val === '') return '';
        const n = Number(val);
        if (isNaN(n) || n === 0) return '';
        return 'S/' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatTotal(val) {
        if (val === null || val === undefined || val === '') return 'S/0.00';
        const n = Number(val);
        if (isNaN(n)) return 'S/0.00';
        return 'S/' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    renderTable() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const filas = (this.datosBackend && this.datosBackend.filas) ? this.datosBackend.filas : [];
        const totales = (this.datosBackend && this.datosBackend.totales) ? this.datosBackend.totales : null;

        // Calcular conteo de filas por cada Cencos para el agrupamiento / rowspan
        const cencosCounts = {};
        filas.forEach(r => {
            const k = r.cencos || 'SIN_CENCOS';
            cencosCounts[k] = (cencosCounts[k] || 0) + 1;
        });

        let rowsHtml = '';
        if (filas.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="16" class="px-4 py-12 text-center text-slate-400 font-medium">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i class="fa-solid fa-inbox text-3xl text-slate-300"></i>
                            <span>No se encontraron registros para los filtros o rango de límite seleccionado.</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            let prevCencos = null;

            filas.forEach((r) => {
                const isNewCencos = (r.cencos !== prevCencos);
                const span = isNewCencos ? cencosCounts[r.cencos || 'SIN_CENCOS'] : 0;
                if (isNewCencos) {
                    prevCencos = r.cencos;
                }

                rowsHtml += `
                    <tr class="hover:bg-blue-50/40 transition-colors border-b border-slate-200 text-[11px] text-slate-700">
                        ${isNewCencos ? `<td rowspan="${span}" class="px-2.5 py-1.5 align-top font-mono font-bold text-slate-800 border-r border-slate-200 bg-white">${r.cencos}</td>` : ''}
                        ${isNewCencos ? `<td rowspan="${span}" class="px-2.5 py-1.5 align-top font-medium text-slate-700 border-r border-slate-200 bg-white max-w-[180px] truncate" title="${r.nombre}">${r.nombre}</td>` : ''}
                        
                        <td class="px-2.5 py-1.5 text-center font-mono font-bold text-slate-600 border-r border-slate-200 bg-slate-50/20">${r.codigo_costo}</td>
                        
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g1)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g2)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g3)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g4)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g5)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g6)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g7)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g8)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g9)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g10)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g11)}</td>
                        <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-200 whitespace-nowrap">${this.formatCurrency(r.g12)}</td>
                        
                        <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">${this.formatTotal(r.total)}</td>
                    </tr>
                `;
            });
        }

        // Fila de totales y pie de tabla Tableau en tfoot si hay registros
        let tfootHtml = '';
        if (filas.length > 0) {
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
            for (let i = 1; i <= 12; i++) {
                axisColsHtml += axisCellHtml;
            }
            // Para la columna de Total general
            axisColsHtml += axisCellHtml;

            tfootHtml = `
                <tfoot class="sticky bottom-0 z-20 bg-white border-t-2 border-slate-300 shadow-md text-[11px] text-slate-800">
                    <!-- 1. FILA DE TOTALES GENERALES -->
                    ${totales ? `
                    <tr class="bg-slate-100 font-bold border-b border-slate-200">
                        <td colspan="3" class="px-3 py-1.5 text-right uppercase tracking-wider font-bold border-r border-slate-300 bg-slate-200/80">
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

                    <!-- 2. FILA DE PIE DE EJE TABLEAU (0M 20M 40M y Prod Term) -->
                    <tr class="bg-white border-t border-slate-200 divide-x divide-slate-200">
                        <td colspan="3" class="border-r border-slate-200 bg-white"></td>
                        ${axisColsHtml}
                    </tr>
                </tfoot>
            `;
        }

        const tableHtml = `
            <div class="w-full flex flex-col bg-white overflow-hidden">
                <!-- ENCABEZADO DE TABLA ESTANDARIZADO CON BOTÓN EXCEL -->
                <div class="px-5 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">PT</h2>
                            <span class="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">${filas.length} registros</span>
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

                <!-- Tabla Scrolleable -->
                <div class="overflow-x-auto overflow-y-auto max-h-[640px] custom-scrollbar">
                    <table id="tabla-pt-pppt2026" class="w-full text-xs border-collapse border border-slate-200 select-text">
                        <thead class="sticky top-0 z-20 shadow-xs">
                            <!-- Nivel 1: Categorías principales -->
                            <tr class="bg-blue-600 text-white font-semibold text-[11px]">
                                <th rowspan="2" class="px-2.5 py-2 text-left border-r border-blue-500 min-w-[80px]">Cencos</th>
                                <th rowspan="2" class="px-2.5 py-2 text-left border-r border-blue-500 min-w-[180px]">nombre</th>
                                <th rowspan="2" class="px-2.5 py-2 text-center border-r border-blue-500 min-w-[90px]">CodigoCosto</th>
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
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${rowsHtml}
                        </tbody>
                        ${tfootHtml}
                    </table>
                </div>
            </div>
        `;

        contenedorGrafica.innerHTML = tableHtml;
    },

    setupExportListeners() {
        const btnExport = document.getElementById('btn-export-excel-pt');
        if (!btnExport) return;

        btnExport.addEventListener('click', () => {
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
                { t: 'n', v: Number(f.g1) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g2) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g3) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g4) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g5) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g6) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g7) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g8) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g9) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g10) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g11) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.g12) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency },
                { t: 'n', v: Number(f.total) || 0, z: '"S/ "#,##0.00', s: dataStyleCurrency }
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
