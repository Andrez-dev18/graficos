/**
 * Componente de Gráfico / Dashboard Modular: CP09 Sanidad
 * 
 * Estructura de 3 Paneles interactivos con alto rendimiento y semaforización:
 * 1. Datos Productivos (Pivot: Galpón / Métrica x Granjas)
 * 2. Detalle Venta Productiva (Pivot: Galpón / DescriVenta [Cant Pollo, % Cant Pollo] x Granjas)
 * 3. Datos de Costo (Pivot: Galpón / Clasificación x Granjas [CU, Dif en CU con semaforización])
 */
window.CP09SanidadChart = {
    datosBackend: null,
    multiGranja: null,
    multiGalpon: null,
    multiClasif: null,
    eventsBound: false,

    render(controller, data) {
        if (!data && controller && controller.tabla1_datos_productivos) {
            data = controller;
        }
        this.datosBackend = data || {};

        // Ocultar contenedores estándar
        const cardDetalle = document.getElementById('card-tabla-metricas');
        if (cardDetalle) cardDetalle.classList.add('hidden');

        const cardHeader = document.getElementById('card-header-grafica-principal');
        if (cardHeader) cardHeader.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.style.minHeight = 'auto';
            contenedorGrafica.style.padding = '0';
        }

        // Configurar filtros modulares
        this.setupFilters(this.datosBackend);

        // Renderizar estructura HTML de paneles
        this.renderLayout();

        // Renderizar las 3 tablas
        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();

        // Delegación de eventos de alto rendimiento
        this.bindEventsDelegation();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiGranja) {
            const granjas = this.multiGranja.getSelectedValues();
            if (granjas.length > 0 && granjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999)) {
                filters.nomcencos = granjas;
            }
        }
        if (this.multiGalpon) {
            const galpones = this.multiGalpon.getSelectedValues();
            if (galpones.length > 0 && galpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999)) {
                filters.galpon = galpones;
            }
        }
        if (this.multiClasif) {
            const clasifs = this.multiClasif.getSelectedValues();
            if (clasifs.length > 0 && clasifs.length < (this.multiClasif.options ? this.multiClasif.options.length : 999)) {
                filters.clasificacion = clasifs;
            }
        }
        return filters;
    },

    setupFilters(data) {
        const opciones = data.opciones_filtros || {};

        // 1. Filtro Granja
        const contGranja = document.getElementById('contenedor-filtro-granja-cp09');
        if (contGranja) contGranja.classList.remove('hidden');

        const granjasDisp = opciones.granjas || [];
        if (typeof CustomMultiSelect !== 'undefined' && granjasDisp.length > 0) {
            const optGranja = granjasDisp.map(g => ({
                id: String(g.cencos).trim(),
                label: g.label || `${g.cencos} ${g.nomcencos || ''}`.trim(),
                selected: true
            }));

            if (!this.multiGranja) {
                this.multiGranja = new CustomMultiSelect({
                    btnId: 'btn-dropdown-granja-cp09',
                    dropdownId: 'dropdown-granja-cp09',
                    optionsContainerId: 'container-options-granja-cp09',
                    labelId: 'label-granja-cp09',
                    searchId: 'search-granja-cp09',
                    title: 'Granja',
                    options: optGranja,
                    onChange: () => this.filtrarLocalmente()
                });
            } else {
                this.multiGranja.setOptions(optGranja);
            }
        }

        // 2. Filtro Galpón
        const contGalpon = document.getElementById('contenedor-filtro-galpon-cp09');
        if (contGalpon) contGalpon.classList.remove('hidden');

        const galponesDisp = opciones.galpones || [];
        if (typeof CustomMultiSelect !== 'undefined' && galponesDisp.length > 0) {
            const optGalpon = galponesDisp.map(g => ({
                id: String(g).trim(),
                label: `Galpón ${g}`,
                selected: true
            }));

            if (!this.multiGalpon) {
                this.multiGalpon = new CustomMultiSelect({
                    btnId: 'btn-dropdown-galpon-cp09',
                    dropdownId: 'dropdown-galpon-cp09',
                    optionsContainerId: 'container-options-galpon-cp09',
                    labelId: 'label-galpon-cp09',
                    searchId: 'search-galpon-cp09',
                    title: 'Galpón',
                    options: optGalpon,
                    onChange: () => this.filtrarLocalmente()
                });
            } else {
                this.multiGalpon.setOptions(optGalpon);
            }
        }

        // 3. Filtro Clasificación
        const contClasif = document.getElementById('contenedor-filtro-clasificacion-cp09');
        if (contClasif) contClasif.classList.remove('hidden');

        const clasifsDisp = opciones.clasificaciones || [];
        if (typeof CustomMultiSelect !== 'undefined' && clasifsDisp.length > 0) {
            const optClasif = clasifsDisp.map(c => {
                const label = c.label || `${c.linea} ${c.nomlinea || ''}`.trim();
                return {
                    id: String(c.linea).trim(),
                    label: label,
                    selected: true
                };
            });

            if (!this.multiClasif) {
                this.multiClasif = new CustomMultiSelect({
                    btnId: 'btn-dropdown-clasificacion-cp09',
                    dropdownId: 'dropdown-clasificacion-cp09',
                    optionsContainerId: 'container-options-clasificacion-cp09',
                    labelId: 'label-clasificacion-cp09',
                    searchId: 'search-clasificacion-cp09',
                    title: 'Clasificación',
                    options: optClasif,
                    onChange: () => this.filtrarLocalmente()
                });
            } else {
                this.multiClasif.setOptions(optClasif);
            }
        }
    },

    filtrarLocalmente() {
        this.renderPanel1();
        this.renderPanel2();
        this.renderPanel3();
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 text-slate-800 font-sans">

                <!-- FILA SUPERIOR: Panel 1 (Datos Productivos) y Panel 2 (Detalle Venta Productiva) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    
                    <!-- PANEL 1: Datos Productivos -->
                    <div class="xl:col-span-6 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Datos Productivos</h3>
                            <span id="cp09-badge-p1" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                0 Granjas
                            </span>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[480px] custom-scrollbar" id="cp09-container-p1"></div>
                    </div>

                    <!-- PANEL 2: Detalle Venta Productiva -->
                    <div class="xl:col-span-6 flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Detalle Venta Productiva</h3>
                            <span id="cp09-badge-p2" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                                0 Registros
                            </span>
                        </div>

                        <div class="w-full overflow-x-auto max-h-[480px] custom-scrollbar" id="cp09-container-p2"></div>
                    </div>

                </div>

                <!-- FILA INFERIOR: Panel 3 (Datos de Costo) con Colores Condicionales -->
                <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <h3 class="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">Datos de Costo</h3>
                            <div class="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Dif &gt; 0 (Aumento)
                                </span>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Dif &lt; 0 (Ahorro / Base)
                                </span>
                            </div>
                        </div>
                        <span id="cp09-badge-p3" class="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 whitespace-nowrap">
                            0 Líneas
                        </span>
                    </div>

                    <div class="w-full overflow-x-auto max-h-[580px] custom-scrollbar" id="cp09-container-p3"></div>
                </div>

            </div>
        `;
    },

    // =========================================================================
    // PANEL 1: DATOS PRODUCTIVOS
    // =========================================================================
    renderPanel1() {
        const container = document.getElementById('cp09-container-p1');
        const badge = document.getElementById('cp09-badge-p1');
        if (!container || !this.datosBackend) return;

        const t1 = this.datosBackend.tabla1_datos_productivos || {};
        let granjas = t1.granjas || this.datosBackend.granjas_headers || [];
        let galpones = t1.galpones || this.datosBackend.galpones_headers || [];
        const filasPorGalpon = t1.filas_por_galpon || {};

        // Filtrar Granjas
        const selGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        if (selGranjas.length > 0 && selGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999)) {
            granjas = granjas.filter(g => selGranjas.includes(String(g.cencos)));
        }

        // Filtrar Galpones
        const selGalpones = this.multiGalpon ? this.multiGalpon.getSelectedValues() : [];
        if (selGalpones.length > 0 && selGalpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999)) {
            galpones = galpones.filter(gal => selGalpones.includes(String(gal)));
        }

        if (badge) badge.textContent = `${granjas.length} Granjas / ${galpones.length} Galpones`;

        if (granjas.length === 0 || galpones.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay datos productivos para los filtros seleccionados</div>`;
            return;
        }

        // Cabeceras (2 filas)
        let headerRow1 = `
            <tr>
                <th class="px-2 py-2 border-r border-slate-200" rowspan="2">galpon</th>
                <th class="px-3 py-2 text-left border-r border-slate-200" rowspan="2">Métrica</th>
        `;
        let headerRow2 = `<tr>`;

        granjas.forEach(g => {
            headerRow1 += `<th class="px-2.5 py-1 border-r border-slate-200 bg-blue-700 text-center font-bold" colspan="1">${g.cencos}</th>`;
            headerRow2 += `<th class="px-2.5 py-1 text-center border-r border-slate-200 text-[10px] font-normal truncate max-w-[130px]" title="${g.nomcencos}">${g.nomcencos}</th>`;
        });

        headerRow1 += `</tr>`;
        headerRow2 += `</tr>`;

        // Filas del cuerpo
        let tbodyHtml = '';
        galpones.forEach(gal => {
            const galData = filasPorGalpon[gal];
            if (!galData || !galData.metricas) return;

            const metricas = galData.metricas;
            metricas.forEach((m, idx) => {
                const isFirst = idx === 0;
                const borderTop = isFirst ? 'border-t-2 border-slate-300' : 'border-t border-slate-100';
                
                tbodyHtml += `<tr class="hover:bg-slate-50 transition-colors ${borderTop} cp09-row-p1">`;

                if (isFirst) {
                    tbodyHtml += `<td class="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50 align-middle" rowspan="${metricas.length}">${gal}</td>`;
                }

                tbodyHtml += `<td class="px-3 py-1 text-left font-mono font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap text-[11px]">${m.label}</td>`;

                granjas.forEach(g => {
                    const val = m.valores ? m.valores[g.cencos] : null;
                    const valStr = val !== null && val !== undefined ? this.formatNum(val, m.decimals) : '-';

                    tbodyHtml += `
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-800 cp09-cell-p1"
                            data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}" data-galpon="${gal}"
                            data-metrica="${m.label}" data-val="${valStr}">
                            ${valStr}
                        </td>
                    `;
                });

                tbodyHtml += `</tr>`;
            });
        });

        container.innerHTML = `
            <table class="w-full text-xs border-collapse select-none">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                    ${headerRow1}
                    ${headerRow2}
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-800">
                    ${tbodyHtml}
                </tbody>
            </table>
        `;
    },

    // =========================================================================
    // PANEL 2: DETALLE VENTA PRODUCTIVA (Formato Tableau Exacto)
    // =========================================================================
    renderPanel2() {
        const container = document.getElementById('cp09-container-p2');
        const badge = document.getElementById('cp09-badge-p2');
        if (!container || !this.datosBackend) return;

        const t2 = this.datosBackend.tabla2_detalle_venta || {};
        let granjas = t2.granjas || this.datosBackend.granjas_headers || [];
        let galpones = t2.galpones || this.datosBackend.galpones_headers || [];
        const filasPorGalpon = t2.filas_por_galpon || {};

        // Filtrar Granjas
        const selGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        if (selGranjas.length > 0 && selGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999)) {
            granjas = granjas.filter(g => selGranjas.includes(String(g.cencos)));
        }

        // Filtrar Galpones
        const selGalpones = this.multiGalpon ? this.multiGalpon.getSelectedValues() : [];
        if (selGalpones.length > 0 && selGalpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999)) {
            galpones = galpones.filter(gal => selGalpones.includes(String(gal)));
        }

        if (badge) badge.textContent = `${granjas.length} Granjas / ${galpones.length} Galpones`;

        if (granjas.length === 0 || galpones.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay detalle de venta productiva para los filtros seleccionados</div>`;
            return;
        }

        // Cabeceras Tableau (2 filas: Fila 1 = cencos, Fila 2 = nomcencos)
        let headerRow1 = `
            <tr>
                <th class="px-2 py-2 border-r border-slate-200" rowspan="2">galpon</th>
                <th class="px-3 py-2 text-left border-r border-slate-200" colspan="2" rowspan="2">DescriVenta</th>
        `;
        let headerRow2 = `<tr>`;

        granjas.forEach(g => {
            headerRow1 += `<th class="px-2.5 py-1 border-r border-slate-200 bg-blue-700 text-center font-bold" colspan="1">${g.cencos}</th>`;
            headerRow2 += `<th class="px-2.5 py-1 text-center border-r border-slate-200 bg-blue-600 text-[10px] font-normal truncate max-w-[140px]" colspan="1" title="${g.nomcencos}">${g.nomcencos}</th>`;
        });

        headerRow1 += `</tr>`;
        headerRow2 += `</tr>`;

        // Filas del cuerpo: Cada tipo tiene 2 filas (Fila 1: Cant Pollo, Fila 2: % Cant Pollo)
        let tbodyHtml = '';
        galpones.forEach(gal => {
            const galData = filasPorGalpon[gal];
            if (!galData || !galData.tipos || galData.tipos.length === 0) return;

            const tipos = galData.tipos;

            tipos.forEach((t, tIdx) => {
                const isFirstTipo = tIdx === 0;
                const borderTop = isFirstTipo ? 'border-t-2 border-slate-300' : 'border-t border-slate-200';

                // Fila 1: Cant Pollo
                tbodyHtml += `<tr class="hover:bg-slate-50 transition-colors ${borderTop} cp09-row-p2">`;

                if (isFirstTipo) {
                    tbodyHtml += `<td class="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50 align-middle" rowspan="${tipos.length * 2}">${gal}</td>`;
                }

                tbodyHtml += `<td class="px-3 py-1 text-left font-mono font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap text-[11px] align-middle" rowspan="2">${t.descriventa}</td>`;
                tbodyHtml += `<td class="px-2 py-1 text-left font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap text-[10px] font-medium">Cant Pollo</td>`;

                granjas.forEach(g => {
                    const gData = t.valores ? t.valores[g.cencos] : null;
                    const cantStr = gData && gData.cantidad ? this.formatNum(gData.cantidad, 0) : '-';

                    tbodyHtml += `
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-800 cp09-cell-p2"
                            data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}" data-galpon="${gal}"
                            data-descriventa="${t.descriventa}" data-metrica="Cant Pollo" data-val="${cantStr}">
                            ${cantStr}
                        </td>
                    `;
                });

                tbodyHtml += `</tr>`;

                // Fila 2: % Cant Pollo
                tbodyHtml += `<tr class="hover:bg-slate-50 transition-colors border-t border-slate-100 cp09-row-p2">`;
                tbodyHtml += `<td class="px-2 py-1 text-left font-mono text-slate-500 border-r border-slate-200 whitespace-nowrap text-[10px] font-medium">% Cant Pollo</td>`;

                granjas.forEach(g => {
                    const gData = t.valores ? t.valores[g.cencos] : null;
                    const porcStr = gData && gData.porcentaje !== undefined && gData.cantidad > 0 ? `${this.formatNum(gData.porcentaje, 2)}%` : '-';

                    tbodyHtml += `
                        <td class="px-2.5 py-1 text-right font-mono border-r border-slate-100 text-slate-600 cp09-cell-p2"
                            data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}" data-galpon="${gal}"
                            data-descriventa="${t.descriventa}" data-metrica="% Cant Pollo" data-val="${porcStr}">
                            ${porcStr}
                        </td>
                    `;
                });

                tbodyHtml += `</tr>`;
            });
        });

        container.innerHTML = `
            <table class="w-full text-xs border-collapse select-none">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                    ${headerRow1}
                    ${headerRow2}
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-800">
                    ${tbodyHtml}
                </tbody>
            </table>
        `;
    },

    // =========================================================================
    // PANEL 3: DATOS DE COSTO (Semaforización Tableau Exacta)
    // =========================================================================
    renderPanel3() {
        const container = document.getElementById('cp09-container-p3');
        const badge = document.getElementById('cp09-badge-p3');
        if (!container || !this.datosBackend) return;

        const t3 = this.datosBackend.tabla3_datos_costo || {};
        let granjas = t3.granjas || this.datosBackend.granjas_headers_t3 || this.datosBackend.granjas_headers || [];
        let galpones = t3.galpones || this.datosBackend.galpones_headers || [];
        const filasPorGalpon = t3.filas_por_galpon || {};

        // Filtrar Granjas
        const selGranjas = this.multiGranja ? this.multiGranja.getSelectedValues() : [];
        if (selGranjas.length > 0 && selGranjas.length < (this.multiGranja.options ? this.multiGranja.options.length : 999)) {
            granjas = granjas.filter(g => selGranjas.includes(String(g.cencos)));
        }

        // Filtrar Galpones
        const selGalpones = this.multiGalpon ? this.multiGalpon.getSelectedValues() : [];
        if (selGalpones.length > 0 && selGalpones.length < (this.multiGalpon.options ? this.multiGalpon.options.length : 999)) {
            galpones = galpones.filter(gal => selGalpones.includes(String(gal)));
        }

        // Filtrar Clasificación
        const selClasif = this.multiClasif ? this.multiClasif.getSelectedValues() : [];
        const isFilteringClasif = selClasif.length > 0 && selClasif.length < (this.multiClasif.options ? this.multiClasif.options.length : 999);

        let totalLineasRender = 0;

        // Cabeceras (3 filas)
        let headerRow0 = `
            <tr>
                <th class="px-2 py-2 border-r border-slate-200" rowspan="3">galpon</th>
                <th class="px-3 py-2 text-left border-r border-slate-200" rowspan="3">Clasificacion</th>
        `;
        let headerRow1 = `<tr>`;
        let headerRow2 = `<tr>`;

        granjas.forEach((g, gIdx) => {
            const isFirstGranja = gIdx === 0;
            const cols = isFirstGranja ? 1 : 2;

            headerRow0 += `<th class="px-2.5 py-1 border-r border-slate-200 bg-blue-700 text-center font-bold" colspan="${cols}">${g.cencos}</th>`;
            headerRow1 += `<th class="px-2.5 py-0.5 text-center border-r border-slate-200 bg-blue-600 text-[10px] font-normal truncate max-w-[140px]" colspan="${cols}" title="${g.nomcencos}">${g.nomcencos}</th>`;
            
            if (isFirstGranja) {
                headerRow2 += `<th class="px-2 py-1 text-right border-r border-slate-200 text-[10px] font-semibold">CU</th>`;
            } else {
                headerRow2 += `
                    <th class="px-2 py-1 text-right border-r border-slate-200 text-[10px] font-semibold">CU</th>
                    <th class="px-2 py-1 text-right border-r border-slate-200 text-[10px] font-semibold">Dif en CU</th>
                `;
            }
        });

        headerRow0 += `</tr>`;
        headerRow1 += `</tr>`;
        headerRow2 += `</tr>`;

        // Filas del cuerpo
        let tbodyHtml = '';
        galpones.forEach(gal => {
            const galData = filasPorGalpon[gal];
            if (!galData || !galData.lineas) return;

            let lineas = galData.lineas;
            if (isFilteringClasif) {
                lineas = lineas.filter(l => selClasif.includes(String(l.linea)) || selClasif.some(sc => sc === l.clasificacion || sc.startsWith(l.linea)));
            }

            totalLineasRender += lineas.length;

            lineas.forEach((l, lIdx) => {
                const isFirstLinea = lIdx === 0;
                const borderTop = isFirstLinea ? 'border-t-2 border-slate-300' : 'border-t border-slate-100';

                tbodyHtml += `<tr class="hover:bg-slate-50 transition-colors ${borderTop} cp09-row-p3">`;

                if (isFirstLinea) {
                    tbodyHtml += `<td class="px-2 py-1.5 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50 align-middle" rowspan="${lineas.length}">${gal}</td>`;
                }

                tbodyHtml += `<td class="px-3 py-1 text-left font-mono font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap text-[11px] truncate max-w-[220px]" title="${l.clasificacion}">${l.clasificacion}</td>`;

                let prevValCu = null;

                granjas.forEach((g, gIdx) => {
                    const isFirstGranja = gIdx === 0;
                    const gData = l.valores ? l.valores[g.cencos] : null;
                    const tieneData = gData && !gData.sin_datos && gData.cu > 0;
                    const cu = tieneData ? gData.cu : null;

                    const cuStr = cu !== null ? this.formatNum(cu, 3) : '';
                    
                    let cuClass = 'text-slate-900';
                    let difStr = '';
                    let difClass = 'text-slate-300';

                    if (isFirstGranja) {
                        // La 1ª granja base en Tableau se colorea en verde suave si tiene valor
                        if (tieneData) {
                            cuClass = 'bg-emerald-50/80 text-emerald-800 font-semibold';
                        }
                    } else {
                        if (tieneData && prevValCu !== null) {
                            const dif = cu - prevValCu;
                            if (Math.abs(dif) >= 0.0005) {
                                if (dif > 0) {
                                    cuClass = 'bg-rose-50/80 text-rose-800 font-semibold';
                                    difClass = 'bg-rose-50 text-rose-700 font-semibold';
                                    difStr = `+${this.formatNum(dif, 3)}`;
                                } else {
                                    cuClass = 'bg-emerald-50/80 text-emerald-800 font-semibold';
                                    difClass = 'bg-emerald-50 text-emerald-700 font-semibold';
                                    difStr = this.formatNum(dif, 3);
                                }
                            } else {
                                difClass = 'text-slate-400 font-normal';
                                difStr = '0,000';
                            }
                        } else if (tieneData) {
                            cuClass = 'bg-emerald-50/80 text-emerald-800 font-semibold';
                            difClass = 'text-slate-400 font-normal';
                            difStr = '-';
                        }
                    }

                    if (tieneData) {
                        prevValCu = cu;
                    }

                    tbodyHtml += `
                        <td class="px-2 py-1 text-right font-mono border-r border-slate-100 ${cuClass} cp09-cell-p3"
                            data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}" data-galpon="${gal}"
                            data-clasificacion="${l.clasificacion}" data-cu="${cuStr}" data-dif="${difStr}">
                            ${cuStr}
                        </td>
                    `;

                    if (!isFirstGranja) {
                        tbodyHtml += `
                            <td class="px-2 py-1 text-right font-mono border-r border-slate-100 ${difClass} cp09-cell-p3"
                                data-cencos="${g.cencos}" data-nomcencos="${g.nomcencos}" data-galpon="${gal}"
                                data-clasificacion="${l.clasificacion}" data-cu="${cuStr}" data-dif="${difStr}">
                                ${difStr}
                            </td>
                        `;
                    }
                });

                tbodyHtml += `</tr>`;
            });
        });

        if (badge) badge.textContent = `${totalLineasRender} Líneas Mostradas`;

        if (granjas.length === 0 || galpones.length === 0 || totalLineasRender === 0) {
            container.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay datos de costos para los filtros seleccionados</div>`;
            return;
        }

        container.innerHTML = `
            <table class="w-full text-xs border-collapse select-none">
                <thead class="sticky top-0 z-20 bg-blue-600 text-white border-b border-slate-300 font-bold text-center shadow-xs">
                    ${headerRow0}
                    ${headerRow1}
                    ${headerRow2}
                </thead>
                <tbody class="divide-y divide-slate-100 text-slate-800">
                    ${tbodyHtml}
                </tbody>
            </table>
        `;
    },

    // =========================================================================
    // DELEGACIÓN DE EVENTOS Y TOOLTIP DE ULTRA ALTO RENDIMIENTO (60 FPS)
    // =========================================================================
    bindEventsDelegation() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        this.currentCell = null;
        this.rafId = null;
        this.mouseX = 0;
        this.mouseY = 0;

        ['p1', 'p2', 'p3'].forEach(panel => {
            const container = document.getElementById(`cp09-container-${panel}`);
            if (!container) return;

            container.addEventListener('mouseover', (e) => {
                const cell = e.target.closest(`.cp09-cell-${panel}`);
                if (!cell || cell === this.currentCell) return;
                this.currentCell = cell;

                const cencos = cell.getAttribute('data-cencos');
                const nomcencos = cell.getAttribute('data-nomcencos');
                const galpon = cell.getAttribute('data-galpon');

                if (panel === 'p1') {
                    const metrica = cell.getAttribute('data-metrica');
                    const val = cell.getAttribute('data-val');
                    this.showTooltip(e, {
                        'cencos': cencos,
                        'galpon': galpon,
                        'nomcencos': nomcencos,
                        [metrica]: val
                    });
                } else if (panel === 'p2') {
                    const descriventa = cell.getAttribute('data-descriventa');
                    const metrica = cell.getAttribute('data-metrica');
                    const val = cell.getAttribute('data-val');
                    this.showTooltip(e, {
                        'cencos': cencos,
                        'galpon': galpon,
                        'nomcencos': nomcencos,
                        'DescriVenta': descriventa,
                        [metrica]: val
                    });
                } else if (panel === 'p3') {
                    const clasif = cell.getAttribute('data-clasificacion');
                    const cu = cell.getAttribute('data-cu');
                    const dif = cell.getAttribute('data-dif');
                    this.showTooltip(e, {
                        'cencos': cencos,
                        'galpon': galpon,
                        'nomcencos': nomcencos,
                        'Clasificacion': clasif,
                        'CU': cu,
                        'Dif en CU': dif || '-'
                    });
                }
            }, { passive: true });

            container.addEventListener('mousemove', (e) => {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;

                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => {
                        this.updateTooltipPosition();
                        this.rafId = null;
                    });
                }
            }, { passive: true });

            container.addEventListener('mouseout', (e) => {
                const cell = e.target.closest(`.cp09-cell-${panel}`);
                if (cell && (!e.relatedTarget || !cell.contains(e.relatedTarget))) {
                    this.currentCell = null;
                    this.hideTooltip();
                }
            }, { passive: true });
        });
    },

    showTooltip(e, fields) {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt) return;

        let rowsHtml = '';
        Object.entries(fields).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') {
                rowsHtml += `
                    <div class="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100 last:border-0">
                        <span class="text-slate-500 font-medium">${k}:</span>
                        <span class="text-slate-900 font-semibold font-mono text-right">${v}</span>
                    </div>
                `;
            }
        });

        tt.innerHTML = `
            <div class="flex flex-col gap-1 text-[11px] font-sans">
                ${rowsHtml}
            </div>
        `;

        tt.classList.remove('hidden');
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.updateTooltipPosition();
    },

    updateTooltipPosition() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (!tt || tt.classList.contains('hidden')) return;

        const ttWidth = 240;
        const ttHeight = 120;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let finalX = this.mouseX + 16;
        let finalY = this.mouseY + 16;

        if (finalX + ttWidth > winWidth - 10) {
            finalX = this.mouseX - ttWidth - 16;
        }
        if (finalY + ttHeight > winHeight - 10) {
            finalY = this.mouseY - ttHeight - 16;
        }

        tt.style.left = '0px';
        tt.style.top = '0px';
        tt.style.transform = `translate3d(${Math.max(10, finalX)}px, ${Math.max(10, finalY)}px, 0)`;
    },

    hideTooltip() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) tt.classList.add('hidden');
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    },

    formatNum(val, decimals = 2) {
        if (val === null || val === undefined || isNaN(val)) return '0,00';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
};

// Registrar en ChartRegistry
if (typeof window.ChartRegistry !== 'undefined') {
    window.ChartRegistry['CP09 Sanidad'] = window.CP09SanidadChart;
    window.ChartRegistry['CP09'] = window.CP09SanidadChart;
}
