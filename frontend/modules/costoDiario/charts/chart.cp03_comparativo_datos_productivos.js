/**
 * Módulo Frontend para CP03 ComparativoDatosProductivos
 * - Panel Izquierdo:
 *   * Tabla Superior: "Datos Productivos por Granja Galpon" (Cencos, Galpón, Unidades, Kilos, PesoProm, ICA, PromEdad, %Mort, PGD)
 *     - Tooltip Tableau flotante con: cencos, galpon, fecha, nomcencos y métrica seleccionada
 *   * Tabla Inferior: "Diferencias de Datos Productivos" (Métricas y Diferencias por Galpón y Cencos)
 *     - Tooltip Tableau flotante con: left([cencos], 3) al inicio, cencos, galpon, fecha, nomcencos y métrica seleccionada
 * - Panel Derecho:
 *   * "Comparativo Datos Productivos": Small Multiples de 7 filas de Barras por Cencos y Galpón
 *     - Eje Y fijo a la izquierda (Títulos de Medidas y Escalas de valores) que NO se desplaza al hacer scroll
 *     - Separación y agrupación visual de las barras por Cencos con divisores verticales y cabecera superior
 *     - Tooltip Tableau flotante interactivo en cada barra
 *   * KilosVendidos (#b05252), UnidadesVendidas (#6baed6), PesoPromedio (#59a14f), ICA (#f28e2b), PromEdadVenta (#e6af2e), %Mortalidad (#76b7b2), PGD (#499894)
 *   * Etiquetas numéricas a 90° en cada barra
 *   * Scroll horizontal independiente
 */
window.ChartRegistry = window.ChartRegistry || {};

const CP03_DEFINITION = {
    controller: null,
    datosBackend: null,
    multiGranja: null,
    charts: [],

    destroy() {
        this.hideTooltip();
        if (this.charts && this.charts.length > 0) {
            this.charts.forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
            this.charts = [];
        }
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

        // En la tabla de diferencias, left([cencos], 3) aparece al inicio
        if (data.leftCencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">left([cencos], 3):</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.leftCencos}</span>
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

        if (data.fecha) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatFecha(data.fecha)}</span>
            `;
        }

        if (data.nomcencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomcencos:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomcencos}</span>
            `;
        }

        if (data.metricaNombre && data.metricaValor !== undefined && data.metricaValor !== null && data.metricaValor !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">${data.metricaNombre}:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-900">${data.metricaValor}</span>
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
        if (this.multiGranja) {
            const selected = typeof this.multiGranja.getSelectedValues === 'function' 
                ? this.multiGranja.getSelectedValues() 
                : (this.multiGranja.options ? this.multiGranja.options.filter(o => o.selected).map(o => o.id) : []);
            if (selected && selected.length > 0 && selected.length < this.multiGranja.options.length) {
                return { cencos: selected };
            }
        }
        return {};
    },

    render(controller, data) {
        this.controller = controller;
        this.datosBackend = data || {};

        // 1. Ocultar cabecera redundante superior
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar inferior
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Configurar filtro multiselect de Granjas
        this.setupFilters(this.datosBackend);

        // 4. Renderizar layout visual
        this.renderLayout();
    },

    setupFilters(data) {
        const contFiltro = document.getElementById('contenedor-filtro-granja-cp03');
        if (contFiltro) contFiltro.classList.remove('hidden');

        const granjasDisp = (data.filtros_disponibles && data.filtros_disponibles.granjas) || 
                            (data.granjas ? data.granjas.map(g => ({ cencos: g.cencos, nomcencos: g.nomcencos || g.cencos })) : []);

        if (typeof CustomMultiSelect !== 'undefined' && granjasDisp.length > 0) {
            const optGranjas = granjasDisp.map(g => ({
                id: String(g.cencos),
                label: g.nomcencos ? `${g.cencos} - ${g.nomcencos}` : String(g.cencos),
                selected: true
            }));

            if (!this.multiGranja) {
                this.multiGranja = new CustomMultiSelect({
                    btnId: 'btn-dropdown-granja-cp03',
                    dropdownId: 'dropdown-granja-cp03',
                    optionsContainerId: 'container-options-granja-cp03',
                    labelId: 'label-granja-cp03',
                    searchId: 'search-granja-cp03',
                    title: 'Granjas',
                    options: optGranjas,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiGranja.setOptions(optGranjas);
            }
        }
    },

    filtrarLocalmente() {
        if (!this.datosBackend) return;
        const selectedCencos = this.multiGranja 
            ? (typeof this.multiGranja.getSelectedValues === 'function' 
                ? this.multiGranja.getSelectedValues() 
                : (this.multiGranja.options ? this.multiGranja.options.filter(o => o.selected).map(o => o.id) : [])) 
            : [];
        const isAll = !selectedCencos || selectedCencos.length === 0 || (this.multiGranja && this.multiGranja.options && selectedCencos.length === this.multiGranja.options.length);

        const allGranjas = this.datosBackend.granjas || [];
        const allDifs = this.datosBackend.diferencias || [];

        let granjasFiltradas = isAll ? allGranjas : allGranjas.filter(g => selectedCencos.includes(String(g.cencos)));
        let difsFiltradas = isAll ? allDifs : allDifs.filter(d => selectedCencos.includes(String(d.cencos)));

        this.renderTablaGranjaGalpon(granjasFiltradas);

        if (this.seleccionCruzada) {
            const sc = this.seleccionCruzada;

            // Filtrar Diferencias
            difsFiltradas = difsFiltradas.filter(d => {
                if (sc.galpon === 'Total') {
                    return String(d.cencos) === String(sc.cencos);
                }
                return String(d.cencos) === String(sc.cencos) && String(d.galpon) === String(sc.galpon);
            });

            // Filtrar Barras
            const granjasParaBarras = [];
            granjasFiltradas.forEach(g => {
                if (String(g.cencos) === String(sc.cencos)) {
                    if (sc.galpon === 'Total') {
                        granjasParaBarras.push(g);
                    } else {
                        const gpSelected = (g.galpones || []).find(gp => String(gp.galpon) === String(sc.galpon));
                        if (gpSelected) {
                            const gpTotal = {
                                ...gpSelected,
                                galpon: 'Total',
                                is_total: true
                            };
                            granjasParaBarras.push({
                                ...g,
                                galpones: [gpSelected, gpTotal]
                            });
                        }
                    }
                }
            });

            this.renderTablaDiferencias(difsFiltradas);
            this.renderSmallMultiplesBarras(granjasParaBarras);
        } else {
            this.renderTablaDiferencias(difsFiltradas);
            this.renderSmallMultiplesBarras(granjasFiltradas);
        }
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const allGranjas = this.datosBackend.granjas || [];
        const allDifs = this.datosBackend.diferencias || [];

        if (allGranjas.length === 0) {
            contenedor.className = "flex flex-col w-full p-8 bg-slate-50 items-center justify-center text-center";
            contenedor.innerHTML = `
                <div class="p-4 bg-blue-50 text-blue-600 rounded-full mb-3">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-700 uppercase">Sin Datos Productivos</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-sm">No se encontraron registros de datos productivos para los filtros seleccionados.</p>
            `;
            return;
        }

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CP03 COMPARATIVO DATOS PRODUCTIVOS -->
            <div class="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                <!-- ========================================== -->
                <!-- COLUMNA IZQUIERDA: 2 TABLAS DE DATOS -->
                <!-- ========================================== -->
                <div class="xl:col-span-6 flex flex-col gap-6">
                    
                    <!-- 1. TABLA SUPERIOR: DATOS PRODUCTIVOS POR GRANJA GALPON -->
                    <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <h3 class="text-sm font-bold text-slate-800">Datos Productivos por Granja Galpon</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <span id="cp03-badge-total-granjas" class="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    ${allGranjas.length} ${allGranjas.length === 1 ? 'Granja' : 'Granjas'}
                                </span>
                                <button id="cp03-btn-export-granjas" type="button"
                                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[460px] custom-scrollbar">
                            <table id="tabla-cp03-granja-galpon" class="w-full text-xs border-collapse text-right select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold shadow-xs">
                                    <tr>
                                        <th class="px-2.5 py-2 text-left border-r border-slate-200">cencos</th>
                                        <th class="px-2 py-2 text-center border-r border-slate-200">galpon</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">UnidadesVendi..</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">KilosVendidos</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">PesoPromedio</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">ICA</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">PromEdadVenta</th>
                                        <th class="px-2.5 py-2 border-r border-slate-200">%Mortalidad</th>
                                        <th class="px-2.5 py-2">PGD</th>
                                    </tr>
                                </thead>
                                <tbody id="cp03-tbody-granja-galpon" class="divide-y divide-slate-100 text-slate-800">
                                    <!-- Filas generadas dinámicamente -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 2. TABLA INFERIOR: DIFERENCIAS DE DATOS PRODUCTIVOS -->
                    <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <h3 class="text-sm font-bold text-slate-800">Diferencias de Datos Productivos</h3>
                            </div>
                            <div class="flex items-center gap-2">
                                <button id="cp03-btn-export-diferencias" type="button"
                                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                        <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                                    </svg>
                                    <span>Excel</span>
                                </button>
                            </div>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[480px] custom-scrollbar">
                            <table id="tabla-cp03-diferencias" class="w-full text-xs border-collapse select-none">
                                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                                    <tr id="cp03-dif-thead-row1"></tr>
                                    <tr id="cp03-dif-thead-row2"></tr>
                                </thead>
                                <tbody id="cp03-tbody-diferencias" class="divide-y divide-slate-100 text-slate-800 text-right">
                                    <!-- Métricas y diferencias generadas -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- ========================================== -->
                <!-- COLUMNA DERECHA: COMPARATIVO SMALL MULTIPLES -->
                <!-- ========================================== -->
                <div class="xl:col-span-6 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 gap-2">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm font-bold text-slate-800">Comparativo Datos Productivos</h3>
                        </div>

                        <!-- Leyenda de colores de medidas -->
                        <div class="flex flex-wrap items-center gap-3 text-[11px] font-medium">
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#b05252]"></span>KilosVendidos</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#6baed6]"></span>UnidadesVendidas</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#59a14f]"></span>PesoPromedio</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#f28e2b]"></span>ICA</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#e6af2e]"></span>PromEdadVenta</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#76b7b2]"></span>%Mortalidad</span>
                            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-[#499894]"></span>PGD</span>
                        </div>
                    </div>

                    <!-- Layout 2 Paneles: Eje Y Fijo + Área de Barras Scrollable con Separaciones -->
                    <div class="w-full flex overflow-hidden bg-white">
                        
                        <!-- Panel Izquierdo Fijo: Títulos de Medidas y Escalas Numéricas del Eje Y -->
                        <div id="cp03-panel-fijo-eje-y" class="w-36 sm:w-40 shrink-0 flex flex-col border-r border-slate-200 bg-white z-10 select-none">
                            <!-- Renderizado dinámico de las 7 filas fijas de títulos y escalas -->
                        </div>

                        <!-- Panel Derecho con Scroll Horizontal: Cabecera Cencos + Canvases -->
                        <div class="flex-1 overflow-x-auto custom-scrollbar bg-slate-50/20">
                            <div id="cp03-contenedor-scroll-barras" class="flex flex-col select-none">
                                <!-- Cabecera de Cencos agrupados y las 7 filas de barras -->
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        `;

        this.filtrarLocalmente();

        // Configurar exportación a Excel para las tablas de CP03
        const btnExportGranjas = document.getElementById('cp03-btn-export-granjas');
        if (btnExportGranjas) {
            btnExportGranjas.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp03-granja-galpon', 'CP03_Datos_Productivos_Granja_Galpon');
                }
            };
        }

        const btnExportDiferencias = document.getElementById('cp03-btn-export-diferencias');
        if (btnExportDiferencias) {
            btnExportDiferencias.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-cp03-diferencias', 'CP03_Diferencias_Datos_Productivos');
                }
            };
        }

    },

    /**
     * 1. Render de Tabla "Datos Productivos por Granja Galpon" con Tooltips Interactivos
     */
    renderTablaGranjaGalpon(granjas) {
        const tbody = document.getElementById('cp03-tbody-granja-galpon');
        const badge = document.getElementById('cp03-badge-total-granjas');
        if (badge && granjas) {
            badge.textContent = `${granjas.length} ${granjas.length === 1 ? 'Granja' : 'Granjas'}`;
        }
        if (!tbody) return;

        const sc = this.seleccionCruzada;
        let html = '';
        (granjas || []).forEach(g => {
            const galpones = g.galpones || [];
            const count = galpones.length;
            const granjaNom = g.nomcencos || '';
            const granjaFecha = g.fecha || '';

            galpones.forEach((gp, idx) => {
                const isTotal = gp.is_total || gp.isTotal || gp.galpon === 'Total';
                const cencosVal = String(g.cencos);
                const nomcencosVal = gp.nomcencos || granjaNom;
                const galponVal = String(gp.galpon);
                const fechaVal = gp.fecha || granjaFecha;

                const isRowActive = sc && sc.cencos === cencosVal && sc.galpon === galponVal;
                const isRowDimmed = sc && !isRowActive;

                let rowClass = isTotal ? 'bg-slate-50 font-bold border-b-2 border-slate-200' : 'hover:bg-blue-50/40';
                if (isRowDimmed) {
                    rowClass += ' opacity-35';
                }

                const valUnidades = this.formatNum(gp.unidades, 0);
                const valKilos = this.formatNum(gp.kilos, 2);
                const valPesoProm = this.formatNum(gp.peso_promedio ?? gp.pesoProm, 3);
                const valIca = this.formatNum(gp.ica, 3);
                const valEdad = this.formatNum(gp.prom_edad_venta ?? gp.edad, 3);
                const valMort = this.formatNum(gp.porc_mortalidad ?? gp.mort, 3) ? (this.formatNum(gp.porc_mortalidad ?? gp.mort, 3) + '%') : '';
                const valPgd = this.formatNum(gp.pgd, 3);

                const getCellClass = (metricaNombre) => {
                    const isCellSelected = sc && sc.cencos === cencosVal && sc.galpon === galponVal && sc.metrica === metricaNombre;
                    if (isCellSelected) {
                        return 'bg-blue-100 text-blue-900 ring-2 ring-blue-500 font-bold shadow-xs z-10';
                    }
                    if (isRowActive) {
                        return 'bg-blue-50/60 font-semibold';
                    }
                    return '';
                };

                html += `<tr class="${rowClass} transition-opacity duration-150">`;
                if (idx === 0) {
                    html += `<td rowspan="${count}" 
                                class="cp03-td-tooltip px-2.5 py-1.5 text-left font-bold text-slate-900 border-r border-slate-200 align-top bg-white cursor-pointer ${getCellClass('cencos')}"
                                data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                                data-metrica-nombre="cencos" data-metrica-valor="${cencosVal}">${g.cencos}</td>`;
                }
                html += `
                    <td class="cp03-td-tooltip px-2 py-1.5 text-center border-r border-slate-100 ${isTotal ? 'font-bold' : ''} cursor-pointer ${getCellClass('galpon')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="galpon" data-metrica-valor="${galponVal}">${gp.galpon}</td>
                    <td class="cp03-td-tooltip px-2.5 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('UnidadesVendidas')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="UnidadesVendidas" data-metrica-valor="${valUnidades}">${valUnidades}</td>
                    <td class="cp03-td-tooltip px-2.5 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('KilosVendidos')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="KilosVendidos" data-metrica-valor="${valKilos}">${valKilos}</td>
                    <td class="cp03-td-tooltip px-2.5 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('PesoPromedio')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="PesoPromedio" data-metrica-valor="${valPesoProm}">${valPesoProm}</td>
                    <td class="cp03-td-tooltip px-2 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('ICA')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="ICA" data-metrica-valor="${valIca}">${valIca}</td>
                    <td class="cp03-td-tooltip px-2.5 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('PromEdadVenta')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="PromEdadVenta" data-metrica-valor="${valEdad}">${valEdad}</td>
                    <td class="cp03-td-tooltip px-2.5 py-1.5 border-r border-slate-100 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('%Mortalidad')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="%Mortalidad" data-metrica-valor="${valMort}">${valMort.replace('%', '')}</td>
                    <td class="cp03-td-tooltip px-2 py-1.5 cursor-pointer hover:bg-blue-100/50 transition-colors ${getCellClass('PGD')}"
                        data-cencos="${cencosVal}" data-nomcencos="${nomcencosVal}" data-galpon="${galponVal}" data-fecha="${fechaVal}"
                        data-metrica-nombre="PGD" data-metrica-valor="${valPgd}">${valPgd}</td>
                </tr>`;
            });
        });

        tbody.innerHTML = html;

        // Configurar Eventos para Tooltip y Filtro Cruzado
        const self = this;
        tbody.querySelectorAll('.cp03-td-tooltip').forEach(td => {
            td.addEventListener('mouseenter', (e) => {
                self.showTooltip(e, {
                    cencos: td.getAttribute('data-cencos'),
                    nomcencos: td.getAttribute('data-nomcencos'),
                    galpon: td.getAttribute('data-galpon'),
                    fecha: td.getAttribute('data-fecha'),
                    metricaNombre: td.getAttribute('data-metrica-nombre'),
                    metricaValor: td.getAttribute('data-metrica-valor')
                });
            });

            td.addEventListener('mousemove', (e) => {
                self.showTooltip(e, {
                    cencos: td.getAttribute('data-cencos'),
                    nomcencos: td.getAttribute('data-nomcencos'),
                    galpon: td.getAttribute('data-galpon'),
                    fecha: td.getAttribute('data-fecha'),
                    metricaNombre: td.getAttribute('data-metrica-nombre'),
                    metricaValor: td.getAttribute('data-metrica-valor')
                });
            });

            td.addEventListener('mouseleave', () => {
                self.hideTooltip();
            });

            // Click para activar / desactivar FILTRO CRUZADO
            td.addEventListener('click', (e) => {
                e.stopPropagation();
                const cencos = td.getAttribute('data-cencos');
                const galpon = td.getAttribute('data-galpon');
                const metrica = td.getAttribute('data-metrica-nombre');

                if (self.seleccionCruzada && self.seleccionCruzada.cencos === cencos && self.seleccionCruzada.galpon === galpon && self.seleccionCruzada.metrica === metrica) {
                    self.seleccionCruzada = null;
                } else {
                    self.seleccionCruzada = { cencos, galpon, metrica };
                }

                self.filtrarLocalmente();
            });
        });
    },

    /**
     * 2. Render de Tabla "Diferencias de Datos Productivos" con Tooltips Interactivos y left([cencos], 3)
     */
    renderTablaDiferencias(diferencias) {
        const thRow1 = document.getElementById('cp03-dif-thead-row1');
        const thRow2 = document.getElementById('cp03-dif-thead-row2');
        const tbody = document.getElementById('cp03-tbody-diferencias');
        if (!thRow1 || !thRow2 || !tbody) return;

        const cols = diferencias || [];
        if (cols.length === 0) {
            thRow1.innerHTML = `<th class="px-3 py-2 text-left bg-slate-100">Métricas</th>`;
            thRow2.innerHTML = '';
            tbody.innerHTML = `<tr><td class="px-3 py-3 text-center text-slate-400">Sin datos de diferencias</td></tr>`;
            return;
        }

        // Agrupar columnas por galpón para generar los encabezados con colspan
        const galponGrupos = {};
        cols.forEach(c => {
            const g = String(c.galpon);
            if (!galponGrupos[g]) galponGrupos[g] = [];
            galponGrupos[g].push(c);
        });

        // Cabecera Nivel 1: Métricas + Galpones agrupados
        let th1 = `<th rowspan="2" class="px-3 py-2 text-left border-r border-slate-300 ">Métricas</th>`;
        Object.keys(galponGrupos).forEach((g, idx) => {
            const count = galponGrupos[g].length;
            const bgClass = idx % 2 === 0 ? 'bg-blue-700' : 'bg-blue-600';
            th1 += `<th colspan="${count}" class="px-2 py-1.5 border-r border-slate-300 ${bgClass} text-white font-bold">${g}</th>`;
        });
        thRow1.innerHTML = th1;

        // Cabecera Nivel 2: Cencos por columna
        let th2 = '';
        cols.forEach(c => {
            th2 += `<th class="px-2 py-1 border-r border-slate-200 text-[11px] font-semibold">${c.cencos}</th>`;
        });
        thRow2.innerHTML = th2;

        // Filas de Métricas
        const filas = [
            { label: 'Cant Pollos Producidos', key: 'cant', dec: 0 },
            { label: 'Kilos Producidos', key: 'kilos', dec: 2 },
            { label: 'Peso Promedio Venta', key: 'peso', dec: 3 },
            { label: 'ICA', key: 'ica', dec: 3 },
            { label: 'Promedio Edad Venta', key: 'edad', dec: 3 },
            { label: '% Mortalidad', key: 'mort', dec: 3 },
            { label: 'PGD', key: 'pgd', dec: 3 },
            { label: 'Diferencia en Cant Pollo', key: 'dCant', dec: 0, isDif: true },
            { label: 'Diferencia en Kilos Producidos', key: 'dKilos', dec: 2, isDif: true },
            { label: 'Diferencia en P.Promedio', key: 'dPeso', dec: 3, isDif: true },
            { label: 'Diferencia en ICA.', key: 'dIca', dec: 3, isDif: true },
            { label: 'Diferencia en Prom.Edad Venta', key: 'dEdad', dec: 3, isDif: true },
            { label: 'Diferencia en %Mortalidad', key: 'dMort', dec: 3, isDif: true },
            { label: 'Diferencia en PGD.', key: 'dPgd', dec: 3, isDif: true }
        ];

        let html = '';
        filas.forEach(f => {
            const isDif = f.isDif;
            const bgClass = isDif ? 'bg-slate-50/80 font-medium' : 'hover:bg-blue-50/40';
            html += `<tr class="${bgClass}">`;
            html += `<td class="px-3 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">${f.label}</td>`;
            cols.forEach(c => {
                const val = c[f.key];
                let formatted = val !== null && val !== undefined ? this.formatNum(val, f.dec) : '';
                let formattedConUnidad = formatted;
                if (formatted !== '' && (f.key === 'mort' || f.key === 'dMort' || f.label.includes('Mortalidad'))) {
                    formattedConUnidad += '%';
                }

                const leftCencos = c.cencos ? String(c.cencos).substring(0, 3) : '';

                html += `<td class="cp03-dif-td-tooltip px-2 py-1.5 border-r border-slate-100 text-slate-800 whitespace-nowrap cursor-pointer hover:bg-emerald-100/50 transition-colors"
                            data-left-cencos="${leftCencos}"
                            data-cencos="${c.cencos || ''}"
                            data-nomcencos="${c.nomcencos || ''}"
                            data-galpon="${c.galpon || ''}"
                            data-fecha="${c.fecha || ''}"
                            data-metrica-nombre="${f.label}"
                            data-metrica-valor="${formattedConUnidad}">${formatted}</td>`;
            });
            html += `</tr>`;
        });

        tbody.innerHTML = html;

        // Configurar Eventos para Tooltip en Tabla Diferencias
        const self = this;
        tbody.querySelectorAll('.cp03-dif-td-tooltip').forEach(td => {
            td.addEventListener('mouseenter', (e) => {
                self.showTooltip(e, {
                    leftCencos: td.getAttribute('data-left-cencos'),
                    cencos: td.getAttribute('data-cencos'),
                    nomcencos: td.getAttribute('data-nomcencos'),
                    galpon: td.getAttribute('data-galpon'),
                    fecha: td.getAttribute('data-fecha'),
                    metricaNombre: td.getAttribute('data-metrica-nombre'),
                    metricaValor: td.getAttribute('data-metrica-valor')
                });
            });

            td.addEventListener('mousemove', (e) => {
                self.showTooltip(e, {
                    leftCencos: td.getAttribute('data-left-cencos'),
                    cencos: td.getAttribute('data-cencos'),
                    nomcencos: td.getAttribute('data-nomcencos'),
                    galpon: td.getAttribute('data-galpon'),
                    fecha: td.getAttribute('data-fecha'),
                    metricaNombre: td.getAttribute('data-metrica-nombre'),
                    metricaValor: td.getAttribute('data-metrica-valor')
                });
            });

            td.addEventListener('mouseleave', () => {
                self.hideTooltip();
            });
        });
    },

    /**
     * 3. Render de Small Multiples de Barras Verticales:
     *    - Eje Y Fijo a la Izquierda (Títulos + Ticks de Escala)
     *    - Separación y Agrupación por Cencos a la Derecha con divisores verticales
     *    - Tooltip Tableau Flotante
     */
    renderSmallMultiplesBarras(granjas) {
        const panelFijo = document.getElementById('cp03-panel-fijo-eje-y');
        const contScroll = document.getElementById('cp03-contenedor-scroll-barras');
        if (!panelFijo || !contScroll) return;

        this.destroy();

        // 1. Extraer todos los ítems ordenados por Cencos y Galpón
        const barItems = [];
        const cencosGrupos = [];
        let runningIndex = 0;

        (granjas || []).forEach(g => {
            const galpones = g.galpones || [];
            const count = galpones.length;
            if (count === 0) return;

            cencosGrupos.push({
                cencos: g.cencos,
                nomcencos: g.nomcencos || '',
                count: count,
                startIndex: runningIndex,
                endIndex: runningIndex + count - 1
            });

            galpones.forEach(gp => {
                const isTotal = gp.is_total || gp.isTotal || gp.galpon === 'Total';
                barItems.push({
                    cencos: g.cencos,
                    nomcencos: gp.nomcencos || g.nomcencos || '',
                    fecha: gp.fecha || g.fecha || '',
                    galpon: gp.galpon,
                    isTotal: isTotal,
                    labelTop: isTotal ? `${g.cencos} Total` : `${g.cencos} G${gp.galpon}`,
                    unidades: Number(gp.unidades) || 0,
                    kilos: Number(gp.kilos) || 0,
                    pesoProm: (gp.peso_promedio !== null && gp.peso_promedio !== undefined) ? Number(gp.peso_promedio) : ((gp.pesoProm !== null && gp.pesoProm !== undefined) ? Number(gp.pesoProm) : null),
                    ica: (gp.ica !== null && gp.ica !== undefined) ? Number(gp.ica) : null,
                    edad: (gp.prom_edad_venta !== null && gp.prom_edad_venta !== undefined) ? Number(gp.prom_edad_venta) : ((gp.edad !== null && gp.edad !== undefined) ? Number(gp.edad) : null),
                    mort: (gp.porc_mortalidad !== null && gp.porc_mortalidad !== undefined) ? Number(gp.porc_mortalidad) : ((gp.mort !== null && gp.mort !== undefined) ? Number(gp.mort) : null),
                    pgd: (gp.pgd !== null && gp.pgd !== undefined) ? Number(gp.pgd) : null
                });
                runningIndex++;
            });
        });

        if (barItems.length === 0) {
            panelFijo.innerHTML = '';
            contScroll.innerHTML = '';
            return;
        }

        const labelsX = barItems.map(b => b.galpon);

        const isFiltered = barItems.length <= 4;

        // 2. Ancho proporcional por barra para scroll horizontal
        const barWidthPx = isFiltered ? 55 : 34;
        const totalWidthPx = isFiltered ? Math.max(160, barItems.length * barWidthPx) : Math.max(680, barItems.length * barWidthPx);

        // Calcular anchos en píxeles para cada grupo Cencos
        cencosGrupos.forEach(cg => {
            cg.widthPx = cg.count * barWidthPx;
        });

        // 3. Calcular máximos dinámicos para que ninguna barra quede fuera de rango
        const maxVal = (key) => {
            const vals = barItems.map(b => b[key]).filter(v => v !== null && !isNaN(v));
            return vals.length > 0 ? Math.max(...vals) : 10;
        };

        const formatK = (n) => {
            if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
            if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
            return String(n);
        };

        let maxKilos, maxUnds, maxPeso, maxIca, maxEdad, maxMort, maxPgd;
        let ticksKilos, ticksUnds, ticksPeso, ticksIca, ticksEdad, ticksMort, ticksPgd;

        if (isFiltered) {
            const kVal = maxVal('kilos');
            maxKilos = Math.max(100000, Math.ceil((kVal * 1.05) / 10000) * 10000);
            ticksKilos = [formatK(maxKilos), formatK(Math.round(maxKilos / 2)), '0K'];

            const uVal = maxVal('unidades');
            maxUnds = Math.max(40000, Math.ceil((uVal * 1.1) / 10000) * 10000);
            ticksUnds = [formatK(maxUnds), formatK(Math.round(maxUnds / 2)), '0K'];

            maxPeso = 3;
            ticksPeso = ['3', '2', '1', '0'];

            maxIca = 1.5;
            ticksIca = ['1,5', '1,0', '0,5', '0'];

            maxEdad = 40;
            const eVal = maxVal('edad');
            if (eVal > 40) maxEdad = Math.ceil(eVal / 10) * 10;
            ticksEdad = [String(maxEdad), String(Math.round(maxEdad / 2)), '0'];

            maxMort = 3;
            const mVal = maxVal('mort');
            if (mVal > 3) maxMort = Math.ceil(mVal);
            ticksMort = [String(maxMort), String(Math.round(maxMort / 2)), '0'];

            maxPgd = 0.08;
            ticksPgd = ['0,08', '0,06', '0,04', '0,02', '0'];
        } else {
            maxKilos = Math.max(1500000, Math.ceil((maxVal('kilos') * 1.15) / 100000) * 100000);
            ticksKilos = [formatK(maxKilos), formatK(maxKilos * 2 / 3), formatK(maxKilos / 3), '0K'];

            maxUnds = Math.max(600000, Math.ceil((maxVal('unidades') * 1.15) / 50000) * 50000);
            ticksUnds = [formatK(maxUnds), formatK(maxUnds * 2 / 3), formatK(maxUnds / 3), '0K'];

            maxPeso = Math.max(6, Math.ceil(maxVal('pesoProm') * 1.2));
            ticksPeso = [String(maxPeso), String(Math.round(maxPeso * 2 / 3)), String(Math.round(maxPeso / 3)), '0'];

            maxIca = Math.max(3, Math.ceil(maxVal('ica') * 1.2));
            ticksIca = [String(maxIca), String(Math.round(maxIca * 2 / 3)), String(Math.round(maxIca / 3)), '0'];

            maxEdad = Math.max(80, Math.ceil(maxVal('edad') * 1.15));
            ticksEdad = [String(maxEdad), String(Math.round(maxEdad * 0.75)), String(Math.round(maxEdad * 0.5)), String(Math.round(maxEdad * 0.25)), '0'];

            maxMort = Math.max(40, Math.ceil(maxVal('mort') * 1.2));
            ticksMort = [maxMort + '%', Math.round(maxMort / 2) + '%', '0%'];

            maxPgd = Math.max(0.15, Number((maxVal('pgd') * 1.2).toFixed(2)));
            ticksPgd = [this.formatNum(maxPgd, 2), this.formatNum(maxPgd * 2 / 3, 2), this.formatNum(maxPgd / 3, 2), '0'];
        }

        const medidas = [
            { 
                titulo: 'KilosVendidos', 
                key: 'kilos', 
                color: '#b05252', 
                max: maxKilos, 
                dec: 2, 
                height: 145,
                ticks: ticksKilos
            },
            { 
                titulo: 'UnidadesVendidas', 
                key: 'unidades', 
                color: '#6baed6', 
                max: maxUnds, 
                dec: 0, 
                height: 145,
                ticks: ticksUnds
            },
            { 
                titulo: 'PesoPromedio', 
                key: 'pesoProm', 
                color: '#59a14f', 
                max: maxPeso, 
                dec: 3, 
                height: 135,
                ticks: ticksPeso
            },
            { 
                titulo: 'ICA', 
                key: 'ica', 
                color: '#f28e2b', 
                max: maxIca, 
                dec: 3, 
                height: 135,
                ticks: ticksIca
            },
            { 
                titulo: 'PromEdadVenta', 
                key: 'edad', 
                color: '#e6af2e', 
                max: maxEdad, 
                dec: 3, 
                height: 135,
                ticks: ticksEdad
            },
            { 
                titulo: '%Mortalidad', 
                key: 'mort', 
                color: '#76b7b2', 
                max: maxMort, 
                dec: 3, 
                height: 135, 
                isMort: true,
                ticks: ticksMort
            },
            { 
                titulo: 'PGD', 
                key: 'pgd', 
                color: '#499894', 
                max: maxPgd, 
                dec: 3, 
                height: 155, 
                showX: true,
                ticks: ticksPgd
            }
        ];

        // 5. Renderizar Panel Izquierdo Fijo (Cabecera + 7 Medidas fijas)
        let leftHtml = `
            <div class="h-8 bg-slate-100 border-b border-slate-300 px-2.5 flex items-center justify-between font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                <span>Medida</span>
                <span>Escala</span>
            </div>
        `;

        medidas.forEach(m => {
            const ticksHtml = m.ticks.map(t => `<span class="leading-none">${t}</span>`).join('');
            leftHtml += `
                <div class="flex items-stretch justify-between border-b border-slate-200 px-2.5 py-1" style="height: ${m.height}px;">
                    <div class="text-[11px] font-bold text-slate-700 flex items-center pr-1 truncate" title="${m.titulo}">
                        ${m.titulo}
                    </div>
                    <div class="flex flex-col justify-between items-end text-[9px] font-semibold text-slate-400 font-mono select-none pt-4 ${m.showX ? 'pb-7' : 'pb-1'}">
                        ${ticksHtml}
                    </div>
                </div>
            `;
        });

        panelFijo.innerHTML = leftHtml;

        // 6. Renderizar Panel Derecho con Scroll Horizontal
        // Cabecera superior de Cencos agrupados
        let cencosHeaderHtml = `
            <div class="flex items-stretch bg-slate-100 border-b border-slate-300 font-bold text-xs text-slate-700 h-8" style="width: ${totalWidthPx}px;">
        `;
        cencosGrupos.forEach((cg, i) => {
            const bgClass = i % 2 === 0 ? 'bg-slate-100' : 'bg-slate-200/60';
            cencosHeaderHtml += `
                <div class="flex items-center justify-center border-r-2 border-slate-300 ${bgClass} px-1 truncate text-[11px] font-bold text-slate-800 tracking-wide select-none" 
                     style="width: ${cg.widthPx}px; min-width: ${cg.widthPx}px;" title="${cg.cencos} - ${cg.nomcencos}">
                    ${cg.cencos}
                </div>
            `;
        });
        cencosHeaderHtml += `</div>`;

        // 7 Filas de Canvases para cada medida
        let rightCanvasesHtml = '';
        medidas.forEach((m, idx) => {
            rightCanvasesHtml += `
                <div class="relative border-b border-slate-200" style="width: ${totalWidthPx}px; height: ${m.height}px;">
                    <canvas id="cp03-canvas-bar-${idx}" width="${totalWidthPx}" height="${m.height}"></canvas>
                </div>
            `;
        });

        contScroll.innerHTML = cencosHeaderHtml + rightCanvasesHtml;

        // 7. Instanciar Chart.js para cada medida con plugin de divisores de Cencos y Tooltips
        const self = this;

        // Plugin personalizado para dibujar divisores y fondos alternados por Cencos
        const cencosDividerPlugin = {
            id: 'cencosDividerPlugin',
            beforeDatasetsDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                if (!chartArea || !scales.x) return;
                const xScale = scales.x;

                // Fondos alternados por grupo Cencos
                cencosGrupos.forEach((cg, i) => {
                    const startX = i === 0 ? chartArea.left : ((xScale.getPixelForValue(cg.startIndex - 1) + xScale.getPixelForValue(cg.startIndex)) / 2);
                    const endX = i === cencosGrupos.length - 1 ? chartArea.right : ((xScale.getPixelForValue(cg.endIndex) + xScale.getPixelForValue(cg.endIndex + 1)) / 2);

                    if (i % 2 === 1) {
                        ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
                        ctx.fillRect(startX, chartArea.top, endX - startX, chartArea.bottom - chartArea.top);
                    }
                });
            },
            afterDatasetsDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                if (!chartArea || !scales.x) return;
                const xScale = scales.x;

                // Líneas divisorias verticales entre cada Cencos
                ctx.save();
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);

                for (let i = 0; i < cencosGrupos.length - 1; i++) {
                    const cg = cencosGrupos[i];
                    const nextCg = cencosGrupos[i + 1];
                    const xBound = (xScale.getPixelForValue(cg.endIndex) + xScale.getPixelForValue(nextCg.startIndex)) / 2;

                    ctx.beginPath();
                    ctx.moveTo(xBound, chartArea.top - 4);
                    ctx.lineTo(xBound, chartArea.bottom);
                    ctx.stroke();
                }
                ctx.restore();
            }
        };

        medidas.forEach((m, idx) => {
            const canvas = document.getElementById(`cp03-canvas-bar-${idx}`);
            if (!canvas) return;

            const dataValues = barItems.map(b => b[m.key]);

            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labelsX,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: m.color,
                        borderWidth: 0,
                        barPercentage: 0.82,
                        categoryPercentage: 0.92
                    }]
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    animation: false,
                    layout: {
                        padding: {
                            top: 24,
                            bottom: m.showX ? 2 : 0,
                            left: 0,
                            right: 0
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false, // Tooltip HTML flotante sincronizado
                            external: function(context) {
                                const { chart: cInstance, tooltip: cTooltip } = context;
                                if (!cTooltip || cTooltip.opacity === 0 || !cTooltip.dataPoints || cTooltip.dataPoints.length === 0) {
                                    self.hideTooltip();
                                    return;
                                }

                                const dataIndex = cTooltip.dataPoints[0].dataIndex;
                                const b = barItems[dataIndex];
                                if (!b) return;

                                const val = b[m.key];
                                let formatted = val !== null && val !== undefined ? self.formatNum(val, m.dec) : '';
                                if (m.isMort && formatted !== '') formatted += '%';

                                const position = cInstance.canvas.getBoundingClientRect();
                                const fakeEvent = {
                                    clientX: position.left + cTooltip.caretX,
                                    clientY: position.top + cTooltip.caretY
                                };

                                self.showTooltip(fakeEvent, {
                                    cencos: b.cencos,
                                    nomcencos: b.nomcencos,
                                    galpon: b.galpon,
                                    fecha: b.fecha,
                                    metricaNombre: m.titulo,
                                    metricaValor: formatted
                                });
                            }
                        },
                        datalabels: {
                            display: true,
                            rotation: isFiltered ? 0 : -90,
                            align: 'end',
                            anchor: 'end',
                            offset: isFiltered ? 2 : 4,
                            color: '#1e293b',
                            font: {
                                size: isFiltered ? 9 : 8,
                                weight: 'bold'
                            },
                            formatter: (v) => self.formatNum(v, m.dec)
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: {
                                display: !!m.showX,
                                font: { size: 9, weight: '600' },
                                color: '#475569',
                                maxRotation: 0,
                                autoSkip: false
                            }
                        },
                        y: {
                            display: false, // Oculto porque está fijo a la izquierda
                            min: 0,
                            max: m.max
                        }
                    }
                },
                plugins: [ChartDataLabels, cencosDividerPlugin]
            });

            // Ocultar tooltip al salir del canvas
            canvas.addEventListener('mouseleave', () => {
                self.hideTooltip();
            });

            this.charts.push(chart);
        });
    }
};

// Registrar en ChartRegistry para invocación modular
window.ChartRegistry['CP03 ComparativoDatosProductivos'] = CP03_DEFINITION;
window.ChartRegistry['CP03ComparativoDatosProductivos'] = CP03_DEFINITION;
window.ChartRegistry['CP03'] = CP03_DEFINITION;
window.ChartRegistry['Comparativo Datos Productivos'] = CP03_DEFINITION;
