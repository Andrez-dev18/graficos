/**
 * Módulo para CA05 AnalisisFormulas
 * - Título: "Analisis de Cumplimiento de Formula Vs Insumos Consumidos"
 * - Tabla matricial con columnas:
 *   * Agrupación fija: codalim, nomalim, codinsu, nominsu
 *   * Columnas por Día de Fecha (y Total General):
 *     - pesalim, valalim, % Formulas, Peso Formula, Peso Consumido, Valor Consumido, CUcons, Diff Pesos
 *   * Fila Total (subtotal por cada codalim)
 * - Filtros modulares: Insumos (multi-select), Alimento/Codalim (multi-select)
 * - Tooltip Tableau idéntico al capturado en tableu.png
 * - Cabecera bg-blue-600 y text-white
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CA05 AnalisisFormulas'] = {
    controller: null,
    datosDashboard: null,
    multiInsumo: null,
    multiCodalim: null,

    destroy() {
        this.hideTooltip();
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';
        if (data.codalim) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">codalim:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.codalim}</span>
            `;
        }
        if (data.codinsu) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">codinsu:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.codinsu}</span>
            `;
        }
        if (data.nomalim) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nomalim:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomalim}</span>
            `;
        }
        if (data.nominsu) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">nominsu:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nominsu}</span>
            `;
        }
        if (data.dia) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Día de fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.dia}</span>
            `;
        }
        if (data.pesoFormula !== undefined && data.pesoFormula !== null && data.pesoFormula !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Peso Formula:</span>
                <span class="font-bold text-left font-mono text-xs text-emerald-700">${data.pesoFormula}</span>
            `;
        }
        if (data.pesoConsumido !== undefined && data.pesoConsumido !== null && data.pesoConsumido !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Peso Consumido:</span>
                <span class="font-bold text-left font-mono text-xs text-emerald-700">${data.pesoConsumido}</span>
            `;
        }
        if (data.valorConsumido !== undefined && data.valorConsumido !== null && data.valorConsumido !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Valor Consumido:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-800">${data.valorConsumido}</span>
            `;
        }
        if (data.cuCons !== undefined && data.cuCons !== null && data.cuCons !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">CUcons:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-800">${data.cuCons}</span>
            `;
        }
        if (data.diffPesos !== undefined && data.diffPesos !== null && data.diffPesos !== '') {
            const isNegative = String(data.diffPesos).trim().startsWith('-');
            itemsHtml += `
                <span class="text-slate-500 font-normal">Diff Pesos:</span>
                <span class="font-bold text-left font-mono text-xs ${!isNegative ? 'text-emerald-700' : 'text-rose-700'}">${data.diffPesos}</span>
            `;
        }
        if (data.color2 !== undefined && data.color2 !== null && data.color2 !== '') {
            itemsHtml += `
                <span class="text-slate-500 font-normal">color2:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.color2}</span>
            `;
        }

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                ${itemsHtml}
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const tooltipWidth = tooltipEl.offsetWidth || 280;
        const tooltipHeight = tooltipEl.offsetHeight || 160;

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

    onCellHover(e, el) {
        const codalim = el.getAttribute('data-codalim');
        const nomalim = el.getAttribute('data-nomalim');
        const codinsu = el.getAttribute('data-codinsu');
        const nominsu = el.getAttribute('data-nominsu');
        const dia = el.getAttribute('data-dia') || 'Todo';
        const pesoFormula = el.getAttribute('data-peso-formula');
        const pesoConsumido = el.getAttribute('data-peso-consumido');
        const valorConsumido = el.getAttribute('data-valor-consumido');
        const cuCons = el.getAttribute('data-cucons');
        const diffPesos = el.getAttribute('data-diff-pesos');
        const color2 = el.getAttribute('data-color2');

        this.showTooltip(e, {
            codalim,
            nomalim,
            codinsu,
            nominsu,
            dia,
            pesoFormula,
            pesoConsumido,
            valorConsumido,
            cuCons,
            diffPesos,
            color2
        });
    },

    setupFilters(data) {
        document.getElementById('contenedor-filtro-insumo-ca05')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-codalim-ca05')?.classList.remove('hidden');

        const catalogoInsumos = data.catalogo_insumos || data.catalogoInsumos || [];
        const catalogoAlimentos = data.catalogo_alimentos || data.catalogoAlimentos || [];

        // 1. Insumos
        if (typeof CustomMultiSelect !== 'undefined') {
            const optInsumos = catalogoInsumos.map(i => ({
                id: i.codinsu,
                label: i.label || `${i.codinsu} ${i.nominsu}`,
                selected: true
            }));

            if (!this.multiInsumo) {
                this.multiInsumo = new CustomMultiSelect({
                    btnId: 'btn-dropdown-insumo-ca05',
                    dropdownId: 'dropdown-insumo-ca05',
                    optionsContainerId: 'container-options-insumo-ca05',
                    labelId: 'label-insumo-ca05',
                    searchId: 'search-insumo-ca05',
                    title: 'Insumos',
                    options: optInsumos,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiInsumo.setOptions(optInsumos);
                this.multiInsumo.selectAll(false);
            }
        }

        // 2. Alimentos / Codalim
        if (typeof CustomMultiSelect !== 'undefined') {
            const optAlimentos = catalogoAlimentos.map(a => ({
                id: a.codalim,
                label: a.label || `${a.codalim} ${a.nomalim}`,
                selected: true
            }));

            if (!this.multiCodalim) {
                this.multiCodalim = new CustomMultiSelect({
                    btnId: 'btn-dropdown-codalim-ca05',
                    dropdownId: 'dropdown-codalim-ca05',
                    optionsContainerId: 'container-options-codalim-ca05',
                    labelId: 'label-codalim-ca05',
                    searchId: 'search-codalim-ca05',
                    title: 'Alimento',
                    options: optAlimentos,
                    onChange: () => {
                        this.filtrarLocalmente();
                    }
                });
            } else {
                this.multiCodalim.setOptions(optAlimentos);
                this.multiCodalim.selectAll(false);
            }
        }
    },

    getSelectedFilters() {
        // En CA05 el filtrado por insumo y codalim se realiza de forma local e instantánea sobre la matriz completa.
        // Al pulsar "Cargar" siempre se consulta la matriz íntegra para el período seleccionado.
        return {};
    },

    filtrarLocalmente() {
        const selectedInsumos = this.multiInsumo ? this.multiInsumo.getSelectedValues() : [];
        const selectedCodalim = this.multiCodalim ? this.multiCodalim.getSelectedValues() : [];

        const gruposOriginales = (this.datosDashboard && this.datosDashboard.grupos_alimentos) || [];
        const diasColumnas = (this.datosDashboard && this.datosDashboard.dias_columnas) || [];

        let gruposFiltrados = JSON.parse(JSON.stringify(gruposOriginales));

        if (selectedCodalim.length > 0 && !selectedCodalim.includes('(Todo)') && !selectedCodalim.includes('TODOS')) {
            gruposFiltrados = gruposFiltrados.filter(g => selectedCodalim.includes(g.codalim));
        }

        if (selectedInsumos.length > 0 && !selectedInsumos.includes('(Todo)') && !selectedInsumos.includes('TODOS')) {
            gruposFiltrados.forEach(g => {
                g.insumos = g.insumos.filter(ins => selectedInsumos.includes(ins.codinsu));
            });
            gruposFiltrados = gruposFiltrados.filter(g => g.insumos.length > 0);
        }

        const tbody = document.getElementById('tbody-ca05-tabla');
        if (tbody) {
            tbody.innerHTML = this.renderBodyTabla(gruposFiltrados, diasColumnas);
        }
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};

        // 1. Título principal
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'CA05 Análisis de Cumplimiento de Fórmula Vs Insumos Consumidos';

        // 2. Ocultar tarjeta de tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Renderizar filtros modulares
        this.setupFilters(this.datosDashboard);

        // 4. Renderizar Layout completo
        this.renderLayout();
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const dataSrc = this.datosDashboard || {};
        const diasColumnas = dataSrc.dias_columnas || [];
        const gruposAlimentos = dataSrc.grupos_alimentos || [];

        contenedorGrafica.className = "flex flex-col w-full p-2 gap-4 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <!-- TABLA MATRICIAL PRINCIPAL CA05 -->
            <div class="w-full bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 border-b border-slate-300">
                    <div class="flex items-center gap-2">
                        <h2 class="text-sm font-bold text-slate-900 tracking-tight">Analisis de Cumplimiento de Formula Vs Insumos Consumidos</h2>
                        <span class="text-[11px] text-slate-500 font-medium">Día de fecha (Agrupado por Alimento e Insumo)</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="ca05-btn-export-excel" type="button"
                            class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                            <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                                <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                            </svg>
                            <span>Excel</span>
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto overflow-y-auto max-h-[680px] custom-scrollbar">
                    <table id="tabla-ca05-analisis-formulas" class="w-full text-[11px] border-collapse font-sans min-w-[1250px] select-none">
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 shadow-2xs">
                            <!-- Nivel 1: Cabecera de Agrupación Temporal -->
                            <tr>
                                <th rowspan="2" class="px-2.5 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[90px] sticky left-0 z-30">codalim</th>
                                <th rowspan="2" class="px-3 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[200px] max-w-[240px] sticky left-[90px] z-30">nomalim</th>
                                <th rowspan="2" class="px-2.5 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[85px] sticky left-[290px] z-30">codinsu</th>
                                <th rowspan="2" class="px-3 py-2 text-left bg-blue-600 font-bold border-r-2 border-blue-700 min-w-[170px] sticky left-[375px] z-30">nominsu</th>
                                
                                <!-- Columnas por Día de Fecha -->
                                ${diasColumnas.map(d => `
                                    <th colspan="8" class="px-3 py-1.5 text-center font-bold text-white border-r-2 border-blue-700 bg-blue-600">
                                        ${d.label}
                                    </th>
                                `).join('')}

                                <!-- Total General -->
                                <th colspan="8" class="px-3 py-1.5 text-center font-bold text-white bg-blue-700/90 border-l border-blue-500/80">
                                    Total general
                                </th>
                            </tr>

                            <!-- Nivel 2: Sub-cabeceras de Métricas -->
                            <tr class="bg-blue-600 text-white border-t border-blue-500/50">
                                <!-- Métricas por Día -->
                                ${diasColumnas.map(() => `
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[75px]">pesalim</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[75px]">valalim</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[75px]">% Formulas</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[85px]">Peso Formula</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[85px]">Peso Consumido</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[90px]">Valor Consumido</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 min-w-[65px]">CUcons</th>
                                    <th class="px-2 py-1.5 text-right font-semibold text-white border-r-2 border-blue-700 min-w-[70px]">Diff Pesos</th>
                                `).join('')}

                                <!-- Métricas Total General -->
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[75px]">pesalim</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[75px]">valalim</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[75px]">% Formulas</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[85px]">Peso Formula</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[85px]">Peso Consumido</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[90px]">Valor Consumido</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white border-r border-blue-500/50 bg-blue-700/80 min-w-[65px]">CUcons</th>
                                <th class="px-2 py-1.5 text-right font-semibold text-white bg-blue-700/80 min-w-[70px]">Diff Pesos</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-ca05-tabla" class="divide-y divide-slate-100 bg-white">
                            ${this.renderBodyTabla(gruposAlimentos, diasColumnas)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        const btnExport = document.getElementById('ca05-btn-export-excel');
        if (btnExport) {
            btnExport.onclick = () => {
                if (typeof ExcelExportHelper !== 'undefined') {
                    ExcelExportHelper.exportarTabla('tabla-ca05-analisis-formulas', 'CA05_Analisis_Formulas_Insumos');
                }
            };
        }
    },

    renderBodyTabla(grupos, diasColumnas) {
        if (!grupos || grupos.length === 0) {
            return `<tr><td colspan="20" class="p-8 text-center text-xs text-slate-400">No hay registros disponibles para los filtros seleccionados.</td></tr>`;
        }

        let html = '';

        grupos.forEach(g => {
            const totalFilasGrupo = (g.insumos || []).length + (g.total ? 1 : 0);

            (g.insumos || []).forEach((ins, idx) => {
                const isFirst = idx === 0;

                html += `
                    <tr class="hover:bg-blue-50/40 transition-colors group">
                        ${isFirst ? `
                            <td rowspan="${totalFilasGrupo}" class="px-2.5 py-1.5 text-left font-mono font-bold text-slate-800 border-r border-slate-300 sticky left-0 z-10 bg-white group-hover:bg-slate-50 align-top">
                                ${g.codalim}
                            </td>
                            <td rowspan="${totalFilasGrupo}" class="px-3 py-1.5 text-left font-semibold text-slate-800 border-r border-slate-300 sticky left-[90px] z-10 bg-white group-hover:bg-slate-50 align-top max-w-[240px] leading-tight" title="${g.nomalim}">
                                ${g.nomalim}
                            </td>
                        ` : ''}

                        <!-- Insumo fijo -->
                        <td class="px-2.5 py-1 text-left font-mono text-slate-700 border-r border-slate-200 sticky left-[290px] z-10 bg-white group-hover:bg-slate-50">
                            ${ins.codinsu}
                        </td>
                        <td class="px-3 py-1 text-left text-slate-800 border-r-2 border-slate-300 sticky left-[375px] z-10 bg-white group-hover:bg-slate-50 truncate max-w-[170px]" title="${ins.nominsu}">
                            ${ins.nominsu}
                        </td>

                        <!-- Columnas por Día -->
                        ${diasColumnas.map(d => {
                            const diaData = (ins.valores_diarios && ins.valores_diarios[d.id]) || {};
                            const color2 = diaData.color2 !== undefined ? diaData.color2 : (ins.color2 !== undefined ? ins.color2 : 1);
                            const cellColorCls = color2 === 0 ? 'text-emerald-700' : 'text-blue-700';

                            return `
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} font-medium border-r border-slate-100 bg-slate-50/20">${diaData.pesalim || ''}</td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} font-medium border-r border-slate-100 bg-slate-50/20">${diaData.valalim || ''}</td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} border-r border-slate-100 font-semibold">${diaData.porc_formula || ''}</td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} border-r border-slate-100 font-semibold cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="${d.label}" data-color2="${color2}"
                                    data-peso-formula="${diaData.peso_formula || ''}" data-peso-consumido="${diaData.peso_consumido || ''}" data-valor-consumido="${diaData.valor_consumido || ''}" data-cucons="${diaData.cucons || ''}" data-diff-pesos="${diaData.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaData.peso_formula || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} border-r border-slate-100 font-semibold cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="${d.label}" data-color2="${color2}"
                                    data-peso-formula="${diaData.peso_formula || ''}" data-peso-consumido="${diaData.peso_consumido || ''}" data-valor-consumido="${diaData.valor_consumido || ''}" data-cucons="${diaData.cucons || ''}" data-diff-pesos="${diaData.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaData.peso_consumido || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} border-r border-slate-100 cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="${d.label}" data-color2="${color2}"
                                    data-peso-formula="${diaData.peso_formula || ''}" data-peso-consumido="${diaData.peso_consumido || ''}" data-valor-consumido="${diaData.valor_consumido || ''}" data-cucons="${diaData.cucons || ''}" data-diff-pesos="${diaData.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaData.valor_consumido || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${cellColorCls} border-r border-slate-100">${diaData.cucons || ''}</td>
                                <td class="px-2 py-1 text-right font-mono font-bold border-r-2 border-slate-300 ${cellColorCls}">
                                    ${diaData.diff_pesos || ''}
                                </td>
                            `;
                        }).join('')}

                        <!-- Columnas Total General -->
                        ${(() => {
                            const color2Gen = ins.color2 !== undefined ? ins.color2 : 1;
                            const genColorCls = color2Gen === 0 ? 'text-emerald-700' : 'text-blue-700';
                            return `
                                <td class="px-2 py-1 text-right font-mono text-slate-400 border-r border-slate-100 bg-slate-50/50"></td>
                                <td class="px-2 py-1 text-right font-mono text-slate-400 border-r border-slate-100 bg-slate-50/50"></td>
                                <td class="px-2 py-1 text-right font-mono text-slate-400 border-r border-slate-100 bg-slate-50/50"></td>
                                <td class="px-2 py-1 text-right font-mono ${genColorCls} border-r border-slate-100 font-semibold bg-slate-50/30 cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="Total general" data-color2="${color2Gen}"
                                    data-peso-formula="${ins.peso_formula || ''}" data-peso-consumido="${ins.peso_consumido || ''}" data-valor-consumido="${ins.valor_consumido || ''}" data-cucons="${ins.cucons || ''}" data-diff-pesos="${ins.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${ins.peso_formula || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${genColorCls} border-r border-slate-100 font-semibold bg-slate-50/30 cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="Total general" data-color2="${color2Gen}"
                                    data-peso-formula="${ins.peso_formula || ''}" data-peso-consumido="${ins.peso_consumido || ''}" data-valor-consumido="${ins.valor_consumido || ''}" data-cucons="${ins.cucons || ''}" data-diff-pesos="${ins.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${ins.peso_consumido || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${genColorCls} border-r border-slate-100 bg-slate-50/30 cursor-pointer hover:bg-slate-100/60"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-codinsu="${ins.codinsu}" data-nominsu="${ins.nominsu}" data-dia="Total general" data-color2="${color2Gen}"
                                    data-peso-formula="${ins.peso_formula || ''}" data-peso-consumido="${ins.peso_consumido || ''}" data-valor-consumido="${ins.valor_consumido || ''}" data-cucons="${ins.cucons || ''}" data-diff-pesos="${ins.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${ins.valor_consumido || ''}
                                </td>
                                <td class="px-2 py-1 text-right font-mono ${genColorCls} border-r border-slate-100 bg-slate-50/30">${ins.cucons || ''}</td>
                                <td class="px-2 py-1 text-right font-mono font-bold bg-slate-50/30 ${genColorCls}">
                                    ${ins.diff_pesos || ''}
                                </td>
                            `;
                        })()}
                    </tr>
                `;
            });

            // Fila de Total / Subtotal del Alimento
            if (g.total) {
                html += `
                    <tr class="bg-slate-100/95 font-bold border-b-2 border-slate-300">
                        <td colspan="2" class="px-3 py-1.5 text-left font-bold text-slate-900 border-r-2 border-slate-300 sticky left-[290px] z-10 bg-slate-100 uppercase tracking-wider text-[10.5px]">
                            Total
                        </td>

                        <!-- Totales por Día -->
                        ${diasColumnas.map(d => {
                            const diaTot = (g.total.valores_diarios && g.total.valores_diarios[d.id]) || {};
                            return `
                                <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200"></td>
                                <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200"></td>
                                <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200"></td>
                                <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-900 border-r border-slate-200 bg-slate-200/40 cursor-pointer hover:bg-blue-100"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="${d.label}"
                                    data-peso-formula="${diaTot.peso_formula || ''}" data-peso-consumido="${diaTot.peso_consumido || ''}" data-valor-consumido="${diaTot.valor_consumido || ''}" data-diff-pesos="${diaTot.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaTot.peso_formula || ''}
                                </td>
                                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-200/40 cursor-pointer hover:bg-blue-100"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="${d.label}"
                                    data-peso-formula="${diaTot.peso_formula || ''}" data-peso-consumido="${diaTot.peso_consumido || ''}" data-valor-consumido="${diaTot.valor_consumido || ''}" data-diff-pesos="${diaTot.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaTot.peso_consumido || ''}
                                </td>
                                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-200/40 cursor-pointer hover:bg-blue-100"
                                    data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="${d.label}"
                                    data-peso-formula="${diaTot.peso_formula || ''}" data-peso-consumido="${diaTot.peso_consumido || ''}" data-valor-consumido="${diaTot.valor_consumido || ''}" data-diff-pesos="${diaTot.diff_pesos || ''}"
                                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                                    ${diaTot.valor_consumido || ''}
                                </td>
                                <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200"></td>
                                <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r-2 border-slate-300 bg-slate-200/40">
                                    ${diaTot.diff_pesos || ''}
                                </td>
                            `;
                        }).join('')}

                        <!-- Totales General -->
                        <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200 bg-slate-200/30"></td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200 bg-slate-200/30"></td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200 bg-slate-200/30"></td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-blue-900 border-r border-slate-200 bg-slate-200/50 cursor-pointer hover:bg-blue-100"
                            data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="Total general"
                            data-peso-formula="${g.total.peso_formula || ''}" data-peso-consumido="${g.total.peso_consumido || ''}" data-valor-consumido="${g.total.valor_consumido || ''}" data-diff-pesos="${g.total.diff_pesos || ''}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${g.total.peso_formula || ''}
                        </td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-200/50 cursor-pointer hover:bg-blue-100"
                            data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="Total general"
                            data-peso-formula="${g.total.peso_formula || ''}" data-peso-consumido="${g.total.peso_consumido || ''}" data-valor-consumido="${g.total.valor_consumido || ''}" data-diff-pesos="${g.total.diff_pesos || ''}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${g.total.peso_consumido || ''}
                        </td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200 bg-slate-200/50 cursor-pointer hover:bg-blue-100"
                            data-codalim="${g.codalim}" data-nomalim="${g.nomalim}" data-nominsu="Total Alimento" data-dia="Total general"
                            data-peso-formula="${g.total.peso_formula || ''}" data-peso-consumido="${g.total.peso_consumido || ''}" data-valor-consumido="${g.total.valor_consumido || ''}" data-diff-pesos="${g.total.diff_pesos || ''}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${g.total.valor_consumido || ''}
                        </td>
                        <td class="px-2 py-1.5 text-right font-mono text-slate-400 border-r border-slate-200 bg-slate-200/30"></td>
                        <td class="px-2 py-1.5 text-right font-mono font-bold text-slate-900 bg-slate-200/50">
                            ${g.total.diff_pesos || ''}
                        </td>
                    </tr>
                `;
            }
        });

        // ==========================================
        // CÁLCULO Y FILA DE TOTAL GENERAL (GLOBAL)
        // ==========================================
        const parseNum = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            const clean = String(val).replace(/\./g, '').replace(',', '.');
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        const formatNum = (val) => {
            return Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const totalOriginalGrupos = (this.datosDashboard?.grupos_alimentos || []).length;
        const selectedInsumos = this.multiInsumo ? this.multiInsumo.getSelectedValues() : [];
        const selectedCodalim = this.multiCodalim ? this.multiCodalim.getSelectedValues() : [];
        const sinFiltrosLocales = (selectedInsumos.length === 0 || selectedInsumos.includes('(Todo)')) &&
                                  (selectedCodalim.length === 0 || selectedCodalim.includes('(Todo)'));
        const esVistaCompleta = sinFiltrosLocales && grupos.length === totalOriginalGrupos && this.datosDashboard?.total_general;

        let totGenPesoFormStr = '';
        let totGenPesoConsStr = '';
        let totGenValConsStr = '';
        let totGenDiffStr = '';

        const totGenDiarioMap = {};

        if (esVistaCompleta) {
            const tg = this.datosDashboard.total_general;
            totGenPesoFormStr = tg.peso_formula;
            totGenPesoConsStr = tg.peso_consumido;
            totGenValConsStr = tg.valor_consumido;
            totGenDiffStr = tg.diff_pesos;

            diasColumnas.forEach(d => {
                const diaB = tg.valores_diarios?.[d.id] || {};
                totGenDiarioMap[d.id] = {
                    peso_formula: diaB.peso_formula || formatNum(0),
                    peso_consumido: diaB.peso_consumido || formatNum(0),
                    valor_consumido: diaB.valor_consumido || formatNum(0),
                    diff_pesos: diaB.diff_pesos || formatNum(0)
                };
            });
        } else {
            let rawPesoForm = 0;
            let rawPesoCons = 0;
            let rawValCons = 0;

            const rawDiario = {};
            diasColumnas.forEach(d => {
                rawDiario[d.id] = { peso_formula: 0, peso_consumido: 0, valor_consumido: 0 };
            });

            grupos.forEach(g => {
                (g.insumos || []).forEach(ins => {
                    rawPesoForm += (ins.raw_peso_formula !== undefined ? ins.raw_peso_formula : parseNum(ins.peso_formula));
                    rawPesoCons += (ins.raw_peso_consumido !== undefined ? ins.raw_peso_consumido : parseNum(ins.peso_consumido));
                    rawValCons += (ins.raw_valor_consumido !== undefined ? ins.raw_valor_consumido : parseNum(ins.valor_consumido));

                    diasColumnas.forEach(d => {
                        const diaData = (ins.valores_diarios && ins.valores_diarios[d.id]) || {};
                        rawDiario[d.id].peso_formula += (diaData.raw_peso_formula !== undefined ? diaData.raw_peso_formula : parseNum(diaData.peso_formula));
                        rawDiario[d.id].peso_consumido += (diaData.raw_peso_consumido !== undefined ? diaData.raw_peso_consumido : parseNum(diaData.peso_consumido));
                        rawDiario[d.id].valor_consumido += (diaData.raw_valor_consumido !== undefined ? diaData.raw_valor_consumido : parseNum(diaData.valor_consumido));
                    });
                });
            });

            totGenPesoFormStr = formatNum(rawPesoForm);
            totGenPesoConsStr = formatNum(rawPesoCons);
            totGenValConsStr = formatNum(rawValCons);
            totGenDiffStr = formatNum(rawPesoForm - rawPesoCons);

            diasColumnas.forEach(d => {
                const dia = rawDiario[d.id];
                totGenDiarioMap[d.id] = {
                    peso_formula: formatNum(dia.peso_formula),
                    peso_consumido: formatNum(dia.peso_consumido),
                    valor_consumido: formatNum(dia.valor_consumido),
                    diff_pesos: formatNum(dia.peso_formula - dia.peso_consumido)
                };
            });
        }

        html += `
            <tr class="bg-slate-200/95 text-slate-900 font-extrabold border-t-2 border-b-2 border-slate-400">
                <td colspan="4" class="px-3 py-2 text-left font-black text-slate-900 border-r-2 border-slate-400 sticky left-0 z-10 bg-slate-200 uppercase tracking-wider text-[11px]">
                    Total general
                </td>

                <!-- Totales por Día -->
                ${diasColumnas.map(d => {
                    const dia = totGenDiarioMap[d.id] || { peso_formula: '0,00', peso_consumido: '0,00', valor_consumido: '0,00', diff_pesos: '0,00' };

                    return `
                        <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300"></td>
                        <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300"></td>
                        <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300"></td>
                        <td class="px-2 py-2 text-right font-mono font-black text-blue-950 border-r border-slate-300 bg-slate-300/50 cursor-pointer hover:bg-blue-100"
                            data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="${d.label}"
                            data-peso-formula="${dia.peso_formula}" data-peso-consumido="${dia.peso_consumido}" data-valor-consumido="${dia.valor_consumido}" data-diff-pesos="${dia.diff_pesos}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${dia.peso_formula}
                        </td>
                        <td class="px-2 py-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 bg-slate-300/50 cursor-pointer hover:bg-blue-100"
                            data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="${d.label}"
                            data-peso-formula="${dia.peso_formula}" data-peso-consumido="${dia.peso_consumido}" data-valor-consumido="${dia.valor_consumido}" data-diff-pesos="${dia.diff_pesos}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${dia.peso_consumido}
                        </td>
                        <td class="px-2 py-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 bg-slate-300/50 cursor-pointer hover:bg-blue-100"
                            data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="${d.label}"
                            data-peso-formula="${dia.peso_formula}" data-peso-consumido="${dia.peso_consumido}" data-valor-consumido="${dia.valor_consumido}" data-diff-pesos="${dia.diff_pesos}"
                            onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                            ${dia.valor_consumido}
                        </td>
                        <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300"></td>
                        <td class="px-2 py-2 text-right font-mono font-black text-slate-950 border-r-2 border-slate-400 bg-slate-300/50">
                            ${dia.diff_pesos}
                        </td>
                    `;
                }).join('')}

                <!-- Totales General (Global) -->
                <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300 bg-slate-300/40"></td>
                <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300 bg-slate-300/40"></td>
                <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300 bg-slate-300/40"></td>
                <td class="px-2 py-2 text-right font-mono font-black text-blue-950 border-r border-slate-300 bg-slate-300/60 cursor-pointer hover:bg-blue-100"
                    data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="Total general"
                    data-peso-formula="${totGenPesoFormStr}" data-peso-consumido="${totGenPesoConsStr}" data-valor-consumido="${totGenValConsStr}" data-diff-pesos="${totGenDiffStr}"
                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                    ${totGenPesoFormStr}
                </td>
                <td class="px-2 py-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 bg-slate-300/60 cursor-pointer hover:bg-blue-100"
                    data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="Total general"
                    data-peso-formula="${totGenPesoFormStr}" data-peso-consumido="${totGenPesoConsStr}" data-valor-consumido="${totGenValConsStr}" data-diff-pesos="${totGenDiffStr}"
                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                    ${totGenPesoConsStr}
                </td>
                <td class="px-2 py-2 text-right font-mono font-black text-slate-950 border-r border-slate-300 bg-slate-300/60 cursor-pointer hover:bg-blue-100"
                    data-nomalim="Total General" data-nominsu="Todos los Insumos" data-dia="Total general"
                    data-peso-formula="${totGenPesoFormStr}" data-peso-consumido="${totGenPesoConsStr}" data-valor-consumido="${totGenValConsStr}" data-diff-pesos="${totGenDiffStr}"
                    onmousemove="window.ChartRegistry['CA05 AnalisisFormulas'].onCellHover(event, this)"
                    onmouseleave="window.ChartRegistry['CA05 AnalisisFormulas'].hideTooltip()">
                    ${totGenValConsStr}
                </td>
                <td class="px-2 py-2 text-right font-mono text-slate-400 border-r border-slate-300 bg-slate-300/40"></td>
                <td class="px-2 py-2 text-right font-mono font-black text-slate-950 bg-slate-300/60">
                    ${totGenDiffStr}
                </td>
            </tr>
        `;

        return html;
    }
};
