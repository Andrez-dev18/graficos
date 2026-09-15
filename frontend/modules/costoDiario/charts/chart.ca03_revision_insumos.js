/**
 * Módulo para CA03 RevisionInsumos
 * - Filtros específicos: Tipo, Transacción, Item (CustomMultiSelect)
 * - Superior: "Tendencia de Insumos Consumidos" (Gráficas de líneas apiladas por insumo)
 *   * Tooltip flotante Tableau
 *   * Alta nitidez (devicePixelRatio)
 * - Inferior: "Detalle de Insumos que Pertenecen a la Formula" (Tabla matricial con filas PU y Peso)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CA03 RevisionInsumos'] = {
    controller: null,
    datosDashboard: null,
    lineCharts: [],
    multiTipo: null,
    multiTrans: null,
    multiItem: null,
    filtroCruzadoActivo: null,

    destroy() {
        this.destruirLineCharts();
        this.hideTooltip();
    },

    destruirLineCharts() {
        if (this.lineCharts && this.lineCharts.length > 0) {
            this.lineCharts.forEach(c => {
                try { c.destroy(); } catch (e) {}
            });
            this.lineCharts = [];
        }
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';
        if (data.item) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Item:</span>
                <span class="text-slate-900 font-semibold text-left">${data.item}</span>
            `;
        }
        if (data.transaccion) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Transacción:</span>
                <span class="text-blue-700 font-bold text-left font-mono">${data.transaccion}</span>
            `;
        }
        if (data.dia) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Día de fecha:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.dia}</span>
            `;
        }
        if (data.pu) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">PU:</span>
                <span class="font-bold text-left font-mono text-xs text-blue-900">${data.pu}</span>
            `;
        }
        if (data.peso) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Peso:</span>
                <span class="font-bold text-left font-mono text-xs text-slate-800">${data.peso} kg</span>
            `;
        }

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                ${itemsHtml}
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const tooltipWidth = tooltipEl.offsetWidth || 260;
        const tooltipHeight = tooltipEl.offsetHeight || 130;

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
        const item = el.getAttribute('data-item');
        const transaccion = el.getAttribute('data-transaccion');
        const dia = el.getAttribute('data-dia');
        const pu = el.getAttribute('data-pu');
        const peso = el.getAttribute('data-peso');

        this.showTooltip(e, { item, transaccion, dia, pu, peso });
    },

    initFilters(catalogoTipos = [], catalogoTrans = [], catalogoItems = [], seleccionados = {}) {
        // 1. Mostrar contenedores de filtros de CA03
        document.getElementById('contenedor-filtro-tipo-ca03')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-transaccion-ca03')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-item-ca03')?.classList.remove('hidden');

        // Ocultar filtro de CP01
        document.getElementById('contenedor-filtro-clasificacion-cp01')?.classList.add('hidden');

        if (!window.CustomMultiSelect) return;

        // Multiselect Tipo
        const defaultTipos = seleccionados.tipos || ['INSUMO'];
        const optTipos = catalogoTipos.map(t => ({
            id: t,
            label: t,
            selected: defaultTipos.includes(t)
        }));
        if (!this.multiTipo) {
            this.multiTipo = new CustomMultiSelect({
                btnId: 'btn-dropdown-tipo-ca03',
                labelId: 'label-tipo-ca03',
                dropdownId: 'dropdown-tipo-ca03',
                searchId: 'search-tipo-ca03',
                optionsContainerId: 'container-options-tipo-ca03',
                title: 'Tipo',
                options: optTipos
            });
        } else {
            this.multiTipo.setOptions(optTipos);
        }

        // Multiselect Transacción
        const defaultTrans = seleccionados.transacciones || ['E003', 'S003'];
        const optTrans = catalogoTrans.map(tr => ({
            id: tr,
            label: tr,
            selected: defaultTrans.includes(tr)
        }));
        if (!this.multiTrans) {
            this.multiTrans = new CustomMultiSelect({
                btnId: 'btn-dropdown-transaccion-ca03',
                labelId: 'label-transaccion-ca03',
                dropdownId: 'dropdown-transaccion-ca03',
                searchId: 'search-transaccion-ca03',
                optionsContainerId: 'container-options-transaccion-ca03',
                title: 'Transacción',
                options: optTrans
            });
        } else {
            this.multiTrans.setOptions(optTrans);
        }

        // Multiselect Items
        const defaultSelectedItems = seleccionados.items && seleccionados.items.length > 0 ? seleccionados.items : [];
        const optItems = catalogoItems.map(it => ({
            id: it.coditem,
            label: it.item_label,
            selected: defaultSelectedItems.length === 0 || defaultSelectedItems.includes(it.coditem) || defaultSelectedItems.includes(it.item_label)
        }));
        if (!this.multiItem) {
            this.multiItem = new CustomMultiSelect({
                btnId: 'btn-dropdown-item-ca03',
                labelId: 'label-item-ca03',
                dropdownId: 'dropdown-item-ca03',
                searchId: 'search-item-ca03',
                optionsContainerId: 'container-options-item-ca03',
                title: 'Item',
                options: optItems
            });
        } else {
            this.multiItem.setOptions(optItems);
        }
    },

    getSelectedFilters() {
        const filtros = {};

        if (this.multiTipo && typeof this.multiTipo.getSelectedValues === 'function') {
            const vals = this.multiTipo.getSelectedValues();
            if (vals.length > 0 && vals.length < this.multiTipo.options.length) {
                filtros.tipos = vals;
            } else if (vals.length === 0) {
                filtros.tipos = [];
            }
        }

        if (this.multiTrans && typeof this.multiTrans.getSelectedValues === 'function') {
            const vals = this.multiTrans.getSelectedValues();
            if (vals.length > 0 && vals.length < this.multiTrans.options.length) {
                filtros.transacciones = vals;
            } else if (vals.length === 0) {
                filtros.transacciones = [];
            }
        }

        if (this.multiItem && typeof this.multiItem.getSelectedValues === 'function') {
            const vals = this.multiItem.getSelectedValues();
            if (vals.length > 0 && vals.length < this.multiItem.options.length) {
                filtros.items = vals;
            } else if (vals.length === 0) {
                filtros.items = [];
            }
        }

        return filtros;
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};
        this.filtroCruzadoActivo = null;

        // 1. Título principal
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'CA03 Revisión de Insumos';

        // 2. Ocultar tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 3. Inicializar Filtros Específicos
        this.initFilters(
            data.catalogo_tipos || [],
            data.catalogo_transacciones || [],
            data.catalogo_items || [],
            data.filtros_seleccionados || {}
        );

        // 4. Renderizar Layout
        this.renderLayout();
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const data = this.datosDashboard;
        const tablaMatriz = data.tabla_matriz || [];
        const seriesLineas = data.grafica_lineas || [];
        const columnasFechas = data.columnas_fechas || [];

        if (tablaMatriz.length === 0) {
            contenedorGrafica.className = "flex flex-col w-full p-6 items-center justify-center bg-white border border-slate-200 rounded-2xl min-h-[300px]";
            contenedorGrafica.innerHTML = `
                <div class="text-center text-slate-400">
                    <svg class="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="font-bold text-slate-600">No se encontraron registros</p>
                    <p class="text-xs text-slate-400">Prueba ajustando los filtros de fecha, tipo, transacción o insumo.</p>
                </div>
            `;
            return;
        }

        contenedorGrafica.className = "flex flex-col w-full p-2 gap-4 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <!-- 1. SECCIÓN SUPERIOR: TENDENCIA DE INSUMOS CONSUMIDOS (GRÁFICAS DE LÍNEAS APILADAS) -->
            <div class="w-full bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 border-b border-slate-300">
                    <h2 class="text-sm font-bold text-slate-900 tracking-tight">Tendencia de Insumos Consumidos</h2>
                    <span class="text-[11px] text-slate-500 font-medium">PU por Día de fecha e Insumo</span>
                </div>

                <div class="p-3 flex flex-col gap-2 overflow-y-auto max-h-[460px] custom-scrollbar">
                    ${this.renderRowsLineas(seriesLineas)}
                </div>
            </div>

            <!-- 2. SECCIÓN INFERIOR: DETALLE DE INSUMOS QUE PERTENECEN A LA FORMULA (TABLA MATRIZ) -->
            <div class="w-full bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 border-b border-slate-300">
                    <h2 class="text-sm font-bold text-slate-900 tracking-tight">Detalle de Insumos que Pertencen a la Formula</h2>
                    <span class="text-[11px] text-slate-500 font-medium">Día de fecha (Orden descendente)</span>
                </div>

                <div class="overflow-x-auto overflow-y-auto max-h-[480px] custom-scrollbar">
                    <table id="tabla-insumos-ca03" class="w-full text-[11px] border-collapse font-sans min-w-[750px] select-none">
                        <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 shadow-2xs">
                            <tr>
                                <th class="px-2.5 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[80px] sticky left-0 z-30">tipo</th>
                                <th class="px-3 py-2 text-left bg-blue-600 font-bold border-r border-blue-500/60 min-w-[200px] sticky left-[80px] z-30">Item</th>
                                <th class="px-2 py-2 text-center bg-blue-600 font-bold border-r border-blue-500/60 min-w-[70px] sticky left-[280px] z-30">transa...</th>
                                <th class="px-2 py-2 text-center bg-blue-600 font-bold border-r border-blue-500/60 min-w-[55px]">Métrica</th>
                                <th class="px-3 py-2 text-right bg-blue-600 font-bold border-r-2 border-blue-700 min-w-[110px]">Total general</th>
                                ${columnasFechas.map(c => `
                                    <th class="px-2.5 py-2 text-right font-semibold text-white border-r border-blue-500/60 bg-blue-600 min-w-[105px] truncate" title="${c.dia_label}">
                                        ${c.dia_label}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${this.renderBodyMatriz(tablaMatriz, columnasFechas)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Renderizar mini-charts de líneas
        this.renderLineCharts(seriesLineas);
    },

    renderRowsLineas(series) {
        let html = '';
        series.forEach((s, idx) => {
            const isLast = idx === series.length - 1;
            html += `
                <div class="flex items-center w-full border-b border-slate-200 pb-2 pt-1 hover:bg-slate-50/50 transition-colors">
                    <!-- Cabecera Izquierda de la Fila -->
                    <div class="w-[220px] sm:w-[250px] shrink-0 text-left pr-3 flex flex-col justify-center border-r border-slate-200">
                        <span class="text-[11px] font-bold text-slate-800 leading-tight truncate" title="${s.item_label}">${s.item_label}</span>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">${s.transaccion}</span>
                            <span class="text-[9px] text-slate-400 font-semibold uppercase">PU</span>
                        </div>
                    </div>

                    <!-- Canvas de la Gráfica de Líneas -->
                    <div class="flex-1 relative ${isLast ? 'h-[95px]' : 'h-[80px]'} px-2">
                        <canvas id="canvas-ca03-linea-${idx}"></canvas>
                    </div>
                </div>
            `;
        });
        return html;
    },

    renderLineCharts(series) {
        this.destruirLineCharts();
        const self = this;
        const labelsX = this.datosDashboard.labels_eje_x || [];

        series.forEach((s, idx) => {
            const canvas = document.getElementById(`canvas-ca03-linea-${idx}`);
            if (!canvas) return;

            const isLast = idx === series.length - 1;
            const dataPuntos = s.puntos.map(p => p.pu);

            // Calcular min / max para una escala estética
            const validVals = dataPuntos.filter(v => v !== null && !isNaN(v));
            let yMin = 0;
            let yMax = 20;
            if (validVals.length > 0) {
                const maxVal = Math.max(...validVals);
                if (maxVal > 20) {
                    yMax = Math.ceil(maxVal * 1.15);
                }
            }

            const ch = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labelsX,
                    datasets: [{
                        label: s.item_label,
                        data: dataPuntos,
                        borderColor: '#2b5c8f',
                        backgroundColor: '#2b5c8f',
                        pointBackgroundColor: '#2b5c8f',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 3.5,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        tension: 0.05,
                        spanGaps: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    layout: { padding: { top: 18, bottom: isLast ? 2 : 2, left: 5, right: 15 } },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => {
                                const tooltipModel = context.tooltip;
                                if (tooltipModel.opacity === 0) {
                                    self.hideTooltip();
                                    return;
                                }
                                const dataPoint = tooltipModel.dataPoints && tooltipModel.dataPoints[0];
                                if (dataPoint) {
                                    const pIdx = dataPoint.dataIndex;
                                    const puntoObj = s.puntos[pIdx];
                                    if (puntoObj) {
                                        const pos = context.chart.canvas.getBoundingClientRect();
                                        const fakeEvent = {
                                            clientX: pos.left + tooltipModel.caretX,
                                            clientY: pos.top + tooltipModel.caretY
                                        };
                                        self.showTooltip(fakeEvent, {
                                            item: s.item_label,
                                            transaccion: s.transaccion,
                                            dia: puntoObj.fecha_corta,
                                            pu: puntoObj.pu_label,
                                            peso: puntoObj.peso_label
                                        });
                                    }
                                }
                            }
                        },
                        datalabels: {
                            display: true,
                            align: 'top',
                            offset: 3,
                            font: { size: 9, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                            color: '#1e293b',
                            formatter: (v, ctx) => {
                                const puntoObj = s.puntos[ctx.dataIndex];
                                return puntoObj ? puntoObj.pu_label : '';
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: true, color: '#f8fafc' },
                            ticks: {
                                display: isLast,
                                maxRotation: 90,
                                minRotation: 90,
                                font: { size: 9, family: 'system-ui, -apple-system, sans-serif' },
                                color: '#475569'
                            }
                        },
                        y: {
                            min: yMin,
                            max: yMax,
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                                callback: (v) => Number(v).toFixed(0)
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.lineCharts.push(ch);
        });
    },

    renderBodyMatriz(tablaMatriz, columnasFechas) {
        let html = '';

        tablaMatriz.forEach(r => {
            // Fila 1: PU
            html += `
                <tr class="hover:bg-slate-50/70 transition-colors group">
                    <td rowspan="2" class="px-2.5 py-1.5 text-left font-semibold text-slate-700 border-r border-slate-300 sticky left-0 z-10 bg-white group-hover:bg-slate-50 truncate align-middle">
                        ${r.tipo}
                    </td>
                    <td rowspan="2" class="px-3 py-1.5 text-left font-bold text-slate-800 border-r border-slate-300 sticky left-[80px] z-10 bg-white group-hover:bg-slate-50 truncate max-w-[240px] align-middle" title="${r.item_label}">
                        ${r.item_label}
                    </td>
                    <td rowspan="2" class="px-2 py-1.5 text-center font-mono font-bold text-blue-700 border-r border-slate-300 sticky left-[280px] z-10 bg-white group-hover:bg-slate-50 align-middle">
                        ${r.transaccion}
                    </td>
                    <td class="px-2 py-1 text-center font-bold text-[10px] text-slate-500 bg-slate-50/70 border-r border-slate-200">
                        PU
                    </td>
                    <td class="px-3 py-1 text-right font-mono font-bold text-blue-900 border-r-2 border-slate-400 bg-slate-50/50">
                        ${r.total_pu}
                    </td>
                    ${columnasFechas.map(col => {
                        const vd = r.valores_diarios[col.fecha];
                        const puStr = vd ? vd.pu : '';
                        const pesoStr = vd ? vd.peso : '';
                        return `
                            <td class="px-2.5 py-1 text-right font-mono text-slate-800 border-r border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors"
                                data-item="${r.item_label}"
                                data-transaccion="${r.transaccion}"
                                data-dia="${col.fecha_corta}"
                                data-pu="${puStr}"
                                data-peso="${pesoStr}"
                                onmousemove="window.ChartRegistry['CA03 RevisionInsumos'].onCellHover(event, this)"
                                onmouseleave="window.ChartRegistry['CA03 RevisionInsumos'].hideTooltip()">
                                ${puStr}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;

            // Fila 2: Peso
            html += `
                <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-200 group">
                    <td class="px-2 py-1 text-center font-medium text-[10px] text-slate-400 bg-slate-50/70 border-r border-slate-200">
                        peso
                    </td>
                    <td class="px-3 py-1 text-right font-mono font-semibold text-slate-700 border-r-2 border-slate-400 bg-slate-50/50">
                        ${r.total_peso}
                    </td>
                    ${columnasFechas.map(col => {
                        const vd = r.valores_diarios[col.fecha];
                        const puStr = vd ? vd.pu : '';
                        const pesoStr = vd ? vd.peso : '';
                        return `
                            <td class="px-2.5 py-1 text-right font-mono text-slate-600 border-r border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-colors"
                                data-item="${r.item_label}"
                                data-transaccion="${r.transaccion}"
                                data-dia="${col.fecha_corta}"
                                data-pu="${puStr}"
                                data-peso="${pesoStr}"
                                onmousemove="window.ChartRegistry['CA03 RevisionInsumos'].onCellHover(event, this)"
                                onmouseleave="window.ChartRegistry['CA03 RevisionInsumos'].hideTooltip()">
                                ${pesoStr}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        });

        return html;
    }
};
