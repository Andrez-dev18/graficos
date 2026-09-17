/**
 * Módulo Frontend para CP06 AnalisisContablePorGalpon
 * Título: "Costo Unitario por Cencos/Linea/Galpon"
 * 
 * Tabla pivotada horizontal por Galpones con 5 métricas por galpón:
 * [cantidad | peso | valor | Prom. saca_kilos | CU]
 * 
 * Características:
 * - Cabeceras de tabla: bg-blue-600 text-white con estructura 2 niveles (Galpón -> Métricas)
 * - Agrupación visual por Cencos con subtotales por galpón (Total Valor y Total CU)
 * - Filtro Multiselect por Clasificación ([linea] + " " + [nomlinea])
 * - Buscador rápido en tiempo real por Granja/Cencos o Línea
 * - Tooltips flotantes interactivos estilo Tableau
 */
window.ChartRegistry = window.ChartRegistry || {};

const CP06_DEFINITION = {
    controller: null,
    datosBackend: null,
    multiClasif: null,
    busqueda: '',

    destroy() {
        this.hideTooltip();
        this.busqueda = '';
    },

    formatNum(val, decimals = 0) {
        if (val === null || val === undefined || isNaN(val) || val === '') return '';
        const num = Number(val);
        const fixed = num.toFixed(decimals);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decimals > 0 ? parts.join(',') : parts[0];
    },

    showTooltip(e, data) {
        let tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'tooltip-tableau-costos';
            tooltipEl.className = 'fixed z-50 pointer-events-none bg-white text-slate-800 text-[11px] rounded-xs shadow-2xl border border-slate-300 p-3 min-w-[240px] max-w-[360px] font-sans transition-opacity duration-75';
            document.body.appendChild(tooltipEl);
        }

        let itemsHtml = `
            <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex items-center justify-between">
                <span>Granja: ${data.cencos || ''}</span>
                <span class="text-[10px] text-slate-500 font-normal">${data.fecha || ''}</span>
            </div>
        `;

        if (data.nomcencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Nombre Cencos:</span>
                <span class="text-slate-900 font-medium text-left truncate max-w-[200px]">${data.nomcencos}</span>
            `;
        }
        if (data.galpon) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Galpón:</span>
                <span class="text-slate-900 font-bold text-left">${data.galpon}</span>
            `;
        }
        if (data.linea) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Línea:</span>
                <span class="text-slate-900 font-semibold text-left">${data.linea} - ${data.nomlinea || ''}</span>
            `;
        }
        if (data.cantidad !== undefined && data.cantidad !== null && data.cantidad !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Cantidad:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.cantidad, 2)}</span>
            `;
        }
        if (data.peso !== undefined && data.peso !== null && data.peso !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Peso:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.peso, 2)} kg</span>
            `;
        }
        if (data.valor !== undefined && data.valor !== null && data.valor !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Valor:</span>
                <span class="text-slate-900 font-bold text-left font-mono">S/ ${this.formatNum(data.valor, 2)}</span>
            `;
        }
        if (data.saca_kilos !== undefined && data.saca_kilos !== null && data.saca_kilos !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Prom. Saca Kilos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${this.formatNum(data.saca_kilos, 2)} kg</span>
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
        this.busqueda = '';

        // 1. Ocultar cabecera redundante superior
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar inferior
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Configurar y mostrar filtro multiselect de Clasificación
        this.setupFilters(this.datosBackend);

        // 4. Renderizar layout visual de la tabla pivotada
        this.renderLayout();
    },

    setupFilters(data) {
        const contFiltro = document.getElementById('contenedor-filtro-clasificacion-cp06');
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
                    btnId: 'btn-dropdown-clasificacion-cp06',
                    dropdownId: 'dropdown-clasificacion-cp06',
                    optionsContainerId: 'container-options-clasificacion-cp06',
                    labelId: 'label-clasificacion-cp06',
                    searchId: 'search-clasificacion-cp06',
                    title: 'Clasificación',
                    options: optClasif,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiClasif.setOptions(optClasif);
            }
        }
    },

    filtrarLocalmente() {
        if (!this.datosBackend || !this.datosBackend.cencos_bloques) return;
        this.renderTabla();
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        const bloques = this.datosBackend.cencos_bloques || [];

        if (bloques.length === 0) {
            contenedor.className = "relative w-full min-h-[420px] p-6 flex flex-col items-center justify-center text-center";
            contenedor.innerHTML = `
                <div class="p-3 bg-amber-50 text-amber-600 rounded-full mb-3">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                </div>
                <h3 class="text-sm font-bold text-slate-800">Sin datos para la fecha seleccionada</h3>
                <p class="text-xs text-slate-400 mt-1 max-w-sm">No se encontraron movimientos de almacén ni producción para ${this.datosBackend.fecha_formateada || this.datosBackend.fecha || ''}.</p>
            `;
            return;
        }

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-4";
        contenedor.innerHTML = `
            <!-- CONTENEDOR PRINCIPAL CP06 -->
            <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                
                <!-- HEADER SUPERIOR TABLA -->
                <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
                            Costo Unitario por Cencos/Linea/Galpon
                        </h2>
                        <span id="cp06-badge-fecha" class="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                            Fecha: ${this.datosBackend.fecha_formateada || this.datosBackend.fecha || ''}
                        </span>
                    </div>

                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <input id="cp06-buscar-input" type="text" placeholder="Buscar granja o línea..."
                                class="w-48 sm:w-60 text-xs px-3 py-1.5 pl-8 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-normal">
                            <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <span id="cp06-badge-granjas" class="text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-1.5 rounded border border-slate-200 whitespace-nowrap">
                            ${bloques.length} Granjas
                        </span>
                    </div>
                </div>

                <!-- CONTENEDOR DE LA TABLA PIVOTADA CON SCROLL HORIZONTAL -->
                <div class="w-full overflow-x-auto max-h-[720px] custom-scrollbar">
                    <table id="cp06-tabla-principal" class="w-full text-xs border-collapse select-none">
                        <thead id="cp06-thead" class="sticky top-0 z-30 bg-blue-600 text-white shadow-xs">
                            <!-- Generado dinámicamente según los galpones de cada cencos o el máximo global -->
                        </thead>
                        <tbody id="cp06-tbody" class="divide-y divide-slate-100 text-slate-800">
                            <!-- Renderizado dinámico -->
                        </tbody>
                    </table>
                </div>

            </div>
        `;

        // Event listener para buscador rápido
        const inputBuscar = document.getElementById('cp06-buscar-input');
        if (inputBuscar) {
            inputBuscar.addEventListener('input', (e) => {
                this.busqueda = (e.target.value || '').trim().toLowerCase();
                this.renderTabla();
            });
        }

        this.renderTabla();
    },

    renderTabla() {
        const thead = document.getElementById('cp06-thead');
        const tbody = document.getElementById('cp06-tbody');
        const badgeGranjas = document.getElementById('cp06-badge-granjas');
        if (!thead || !tbody) return;

        const allBloques = this.datosBackend.cencos_bloques || [];
        const selectedClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selectedClasif && selectedClasif.length > 0 && selectedClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        // 1. Filtrar bloques y filas
        let bloquesFiltrados = [];

        allBloques.forEach(b => {
            const matchCencos = !this.busqueda || 
                b.cencos.toLowerCase().includes(this.busqueda) || 
                b.nomcencos.toLowerCase().includes(this.busqueda);

            let filasValidas = b.filas.filter(f => {
                // Filtro clasificación
                if (isFilteringClasif) {
                    const clasifStr = `${f.linea} ${f.nomlinea}`.trim();
                    const matchFiltro = selectedClasif.some(sel => {
                        return sel === f.linea || sel === clasifStr || sel.startsWith(f.linea);
                    });
                    if (!matchFiltro) return false;
                }

                // Filtro búsqueda rápida por línea
                if (this.busqueda && !matchCencos) {
                    return f.linea.toLowerCase().includes(this.busqueda) || f.nomlinea.toLowerCase().includes(this.busqueda);
                }

                return true;
            });

            if (filasValidas.length > 0 || (matchCencos && !isFilteringClasif)) {
                bloquesFiltrados.push({
                    cencos: b.cencos,
                    nomcencos: b.nomcencos,
                    galpones: b.galpones,
                    filas: filasValidas,
                    totales: b.totales
                });
            }
        });

        if (badgeGranjas) {
            badgeGranjas.textContent = `${bloquesFiltrados.length} Granjas`;
        }

        if (bloquesFiltrados.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="15" class="py-12 text-center text-slate-400 italic">No hay registros coincidentes con los filtros aplicados</td></tr>`;
            return;
        }

        // 2. Determinar la lista consolidada de galpones para el ancho de la tabla
        let galponesSet = new Set();
        bloquesFiltrados.forEach(b => {
            b.galpones.forEach(g => galponesSet.add(g));
        });
        const galponesList = Array.from(galponesSet).sort((a, b) => Number(a) - Number(b));

        // 3. Renderizar THEAD de dos niveles
        let thRow1 = `
            <tr>
                <th rowspan="2" class="px-2.5 py-2 text-left border-r border-blue-500/60 w-16 sticky left-0 z-40 bg-blue-600 font-bold">cencos</th>
                <th rowspan="2" class="px-3 py-2 text-left border-r border-blue-500/60 min-w-[140px] sticky left-16 z-40 bg-blue-600 font-bold">nomcencos</th>
                <th rowspan="2" class="px-2 py-2 text-center border-r border-blue-500/60 w-14 sticky left-[204px] z-40 bg-blue-600 font-bold">linea</th>
        `;

        let thRow2 = `<tr>`;

        galponesList.forEach(g => {
            thRow1 += `
                <th colspan="5" class="px-3 py-1.5 text-center border-r border-blue-500/60 font-bold bg-blue-700/80 border-b border-blue-500/40">
                    Galpón ${g}
                </th>
            `;

            thRow2 += `
                <th class="px-2.5 py-1.5 text-right border-r border-blue-500/40 font-semibold min-w-[75px]">cantidad</th>
                <th class="px-2.5 py-1.5 text-right border-r border-blue-500/40 font-semibold min-w-[85px]">peso</th>
                <th class="px-3 py-1.5 text-right border-r border-blue-500/40 font-semibold min-w-[95px]">valor</th>
                <th class="px-3 py-1.5 text-right border-r border-blue-500/40 font-semibold min-w-[100px]">Prom. saca_k...</th>
                <th class="px-2.5 py-1.5 text-right border-r border-blue-500/60 font-bold min-w-[65px] bg-blue-700/40">CU</th>
            `;
        });

        thRow1 += `</tr>`;
        thRow2 += `</tr>`;
        thead.innerHTML = thRow1 + thRow2;

        // 4. Renderizar TBODY agrupado por Cencos
        let tbodyHtml = '';

        bloquesFiltrados.forEach((b, bIdx) => {
            const numFilas = b.filas.length;
            const cencosBorderClass = bIdx > 0 ? "border-t-2 border-slate-300" : "";

            // Recalcular totales por galpón si hay filtros de clasificación aplicados
            const totalesGalpon = {};
            galponesList.forEach(g => {
                totalesGalpon[g] = { valor: 0.0, cu: 0.0 };
            });

            b.filas.forEach((f, fIdx) => {
                const isFirstRowOfCencos = fIdx === 0;
                const rowHoverClass = "hover:bg-blue-50/40 transition-colors";
                const rowBorderClass = isFirstRowOfCencos ? cencosBorderClass : "border-t border-slate-100";

                let cencosCell = '';
                let nomcencosCell = '';

                if (isFirstRowOfCencos) {
                    cencosCell = `<span class="font-bold text-slate-800 font-mono">${b.cencos}</span>`;
                    cencosCell += `<div class="text-[10px] text-slate-400 font-normal">${numFilas} líneas</div>`;
                    nomcencosCell = `<span class="font-semibold text-slate-800 truncate block max-w-[150px]" title="${b.nomcencos}">${b.nomcencos}</span>`;
                }

                let cellsGalponesHtml = '';

                galponesList.forEach(g => {
                    const gData = f.galpones[g];
                    if (gData) {
                        const cant = Number(gData.cantidad) || 0;
                        const peso = Number(gData.peso) || 0;
                        const val  = Number(gData.valor) || 0;
                        const saca = Number(gData.saca_kilos) || 0;
                        const cu   = Number(gData.cu) || 0;

                        totalesGalpon[g].valor += val;
                        totalesGalpon[g].cu += cu;

                        cellsGalponesHtml += `
                            <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100 ${cant === 0 ? 'text-slate-300' : 'text-slate-700'}"
                                data-cencos="${b.cencos}" data-nomcencos="${b.nomcencos}" data-galpon="${g}" data-linea="${f.linea}" data-nomlinea="${f.nomlinea}"
                                data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                                ${cant !== 0 ? this.formatNum(cant, 0) : '0'}
                            </td>
                            <td class="px-2.5 py-1.5 text-right font-mono border-r border-slate-100 ${peso === 0 ? 'text-slate-300' : 'text-slate-700'}"
                                data-cencos="${b.cencos}" data-nomcencos="${b.nomcencos}" data-galpon="${g}" data-linea="${f.linea}" data-nomlinea="${f.nomlinea}"
                                data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                                ${peso !== 0 ? this.formatNum(peso, 2) : '0,00'}
                            </td>
                            <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 font-medium text-slate-800"
                                data-cencos="${b.cencos}" data-nomcencos="${b.nomcencos}" data-galpon="${g}" data-linea="${f.linea}" data-nomlinea="${f.nomlinea}"
                                data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                                ${this.formatNum(val, 2)}
                            </td>
                            <td class="px-3 py-1.5 text-right font-mono border-r border-slate-100 text-slate-500"
                                data-cencos="${b.cencos}" data-nomcencos="${b.nomcencos}" data-galpon="${g}" data-linea="${f.linea}" data-nomlinea="${f.nomlinea}"
                                data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                                ${saca > 0 ? this.formatNum(saca, 2) : '-'}
                            </td>
                            <td class="px-2.5 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-50/50"
                                data-cencos="${b.cencos}" data-nomcencos="${b.nomcencos}" data-galpon="${g}" data-linea="${f.linea}" data-nomlinea="${f.nomlinea}"
                                data-cantidad="${cant}" data-peso="${peso}" data-valor="${val}" data-saca_kilos="${saca}" data-cu="${cu.toFixed(3)}">
                                ${this.formatNum(cu, 3)}
                            </td>
                        `;
                    } else {
                        cellsGalponesHtml += `
                            <td class="px-2.5 py-1.5 text-right font-mono text-slate-300 border-r border-slate-100">-</td>
                            <td class="px-2.5 py-1.5 text-right font-mono text-slate-300 border-r border-slate-100">-</td>
                            <td class="px-3 py-1.5 text-right font-mono text-slate-300 border-r border-slate-100">-</td>
                            <td class="px-3 py-1.5 text-right font-mono text-slate-300 border-r border-slate-100">-</td>
                            <td class="px-2.5 py-1.5 text-right font-mono text-slate-300 border-r border-slate-200 bg-slate-50/50">-</td>
                        `;
                    }
                });

                tbodyHtml += `
                    <tr class="cp06-row ${rowBorderClass} ${rowHoverClass}" data-cencos="${b.cencos}" data-linea="${f.linea}">
                        <td class="px-2.5 py-1.5 border-r border-slate-200 sticky left-0 z-20 bg-white select-none">${cencosCell}</td>
                        <td class="px-3 py-1.5 border-r border-slate-200 sticky left-16 z-20 bg-white select-none">${nomcencosCell}</td>
                        <td class="px-2 py-1.5 text-center font-mono font-bold text-slate-700 border-r border-slate-200 sticky left-[204px] z-20 bg-white" title="${f.nomlinea || ''}">
                            ${f.linea}
                        </td>
                        ${cellsGalponesHtml}
                    </tr>
                `;
            });

            // Fila de SUBTOTAL / TOTAL DEL CENCOS
            let subtotalGalponesHtml = '';
            galponesList.forEach(g => {
                const totVal = totalesGalpon[g] ? totalesGalpon[g].valor : 0;
                const totCu  = totalesGalpon[g] ? totalesGalpon[g].cu : 0;

                subtotalGalponesHtml += `
                    <td class="px-2.5 py-2 text-right border-r border-slate-200"></td>
                    <td class="px-2.5 py-2 text-right border-r border-slate-200"></td>
                    <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">${this.formatNum(totVal, 2)}</td>
                    <td class="px-3 py-2 text-right border-r border-slate-200"></td>
                    <td class="px-2.5 py-2 text-right font-mono font-bold text-blue-700 border-r border-slate-300 bg-blue-50/50">${this.formatNum(totCu, 3)}</td>
                `;
            });

            tbodyHtml += `
                <tr class="bg-slate-100/90 font-bold border-t border-b-2 border-slate-300 shadow-2xs select-none">
                    <td class="px-2.5 py-2 border-r border-slate-200 sticky left-0 z-20 bg-slate-100"></td>
                    <td class="px-3 py-2 border-r border-slate-200 sticky left-16 z-20 bg-slate-100"></td>
                    <td class="px-2 py-2 text-center uppercase tracking-wide text-slate-900 border-r border-slate-200 sticky left-[204px] z-20 bg-slate-100">Total</td>
                    ${subtotalGalponesHtml}
                </tr>
            `;
        });

        tbody.innerHTML = tbodyHtml;
        this.bindEvents();
    },

    bindEvents() {
        const self = this;
        const cells = document.querySelectorAll('#cp06-tbody td[data-cencos]');

        cells.forEach(td => {
            td.addEventListener('mouseenter', function(e) {
                self.showTooltip(e, {
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            td.addEventListener('mousemove', function(e) {
                self.showTooltip(e, {
                    fecha: self.datosBackend.fecha_formateada || self.datosBackend.fecha,
                    cencos: this.getAttribute('data-cencos'),
                    nomcencos: this.getAttribute('data-nomcencos'),
                    galpon: this.getAttribute('data-galpon'),
                    linea: this.getAttribute('data-linea'),
                    nomlinea: this.getAttribute('data-nomlinea'),
                    cantidad: this.getAttribute('data-cantidad'),
                    peso: this.getAttribute('data-peso'),
                    valor: this.getAttribute('data-valor'),
                    saca_kilos: this.getAttribute('data-saca_kilos'),
                    cu: this.getAttribute('data-cu')
                });
            });

            td.addEventListener('mouseleave', function() {
                self.hideTooltip();
            });
        });
    }
};

// Registro modular
window.ChartRegistry['CP06 AnalisisContablePorGalpon'] = CP06_DEFINITION;
window.ChartRegistry['CP06AnalisisContablePorGalpon'] = CP06_DEFINITION;
window.ChartRegistry['CP06'] = CP06_DEFINITION;
