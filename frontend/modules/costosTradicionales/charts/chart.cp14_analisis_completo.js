/**
 * Módulo para CP14 AnalisisCompleto (Costo Detallado por Granja Galpon Linea)
 * Utiliza CustomMultiSelect de utils-graficos para Clasificación, Granja y Galpón.
 * Carga inicial ultra liviana (filtros desmarcados por defecto para ahorro de recursos)
 * y renderizado optimizado por bloques para fluidez total.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP14 AnalisisCompleto'] = {
    multiClasif: null,
    multiGranja: null,
    multiGalpon: null,
    filtrosInicializados: false,

    render(controller, data) {
        // 1. Títulos
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Costo Detallado por Granja Galpon Linea';

        // Ocultar filtros tradicionales
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        // Mostrar contenedores de filtros de CP14
        document.getElementById('contenedor-filtro-granja-cp14')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-galpon-cp14')?.classList.remove('hidden');
        document.getElementById('contenedor-filtro-clasificacion-cp14')?.classList.remove('hidden');

        // Ocultar tarjeta separada de tabla
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 2. Inicializar / poblar los CustomMultiSelect con opciones disponibles
        if (data.filtros_disponibles) {
            this.initMultiSelects(controller, data.filtros_disponibles);
        }

        // 3. Badges / Estado
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            const count = data.total_registros || 0;
            contenedorBadges.innerHTML = `
                <div class="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span class="inline-flex items-center gap-1.5 text-slate-700 bg-slate-100 px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                        <span class="w-2 h-2 rounded-full ${count > 0 ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                        Registros: <strong class="text-blue-700 font-bold">${count.toLocaleString('es-PE')}</strong>
                    </span>
                </div>
            `;
        }

        // 4. Renderizar la Matriz o Mensaje de Selección
        this.renderMatrizJerarquica(controller, data);
    },

    initMultiSelects(controller, filtrosDisp) {
        if (!window.CustomMultiSelect) return;

        // 1. Clasificación
        if (!this.multiClasif && filtrosDisp.clasificaciones) {
            this.multiClasif = new CustomMultiSelect({
                btnId: 'btn-dropdown-clasificacion-cp14',
                labelId: 'label-clasificacion-cp14',
                dropdownId: 'dropdown-clasificacion-cp14',
                searchId: 'search-clasificacion-cp14',
                optionsContainerId: 'container-options-clasificacion-cp14',
                title: 'Clasificación',
                options: filtrosDisp.clasificaciones.map(c => ({ id: c, label: c, selected: false }))
            });
        }

        // 2. Granja (nomcencos)
        if (!this.multiGranja && filtrosDisp.granjas) {
            this.multiGranja = new CustomMultiSelect({
                btnId: 'btn-dropdown-granja-cp14',
                labelId: 'label-granja-cp14',
                dropdownId: 'dropdown-granja-cp14',
                searchId: 'search-granja-cp14',
                optionsContainerId: 'container-options-granja-cp14',
                title: 'Granja',
                options: filtrosDisp.granjas.map(g => ({ id: g, label: g, selected: false }))
            });
        }

        // 3. Galpón
        if (!this.multiGalpon && filtrosDisp.galpones) {
            this.multiGalpon = new CustomMultiSelect({
                btnId: 'btn-dropdown-galpon-cp14',
                labelId: 'label-galpon-cp14',
                dropdownId: 'dropdown-galpon-cp14',
                searchId: 'search-galpon-cp14',
                optionsContainerId: 'container-options-galpon-cp14',
                title: 'Galpón',
                options: filtrosDisp.galpones.map(gal => ({ id: gal, label: 'Galpón ' + gal, selected: false }))
            });
        }
    },

    getSelectedFilters() {
        return {
            clasificacion: this.multiClasif ? this.multiClasif.getSelectedValues() : [],
            nomcencos: this.multiGranja ? this.multiGranja.getSelectedValues() : [],
            galpon: this.multiGalpon ? this.multiGalpon.getSelectedValues() : []
        };
    },

    renderMatrizJerarquica(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }

        const periodos = data.periodos || [];
        const jerarquia = data.jerarquia || [];

        // Estado Inicial: Ningún filtro seleccionado (Ahorro de recursos y carga instantánea)
        if (data.requiere_seleccion || jerarquia.length === 0) {
            contenedorGrafica.className = "flex flex-col w-full p-8 items-center justify-center bg-slate-50/50 border border-dashed border-slate-200 rounded-xl my-2";
            contenedorGrafica.innerHTML = `
                <div class="text-center py-10 max-w-md mx-auto">
                    <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                        </svg>
                    </div>
                    <h3 class="text-sm font-bold text-slate-800 mb-1">Seleccione filtros para generar la tabla</h3>
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Para optimizar el rendimiento y consultar rápidamente, elija una o más <strong>Clasificaciones</strong>, <strong>Granjas</strong> o <strong>Galpones</strong> en la barra superior.
                    </p>
                </div>
            `;
            return;
        }

        // 1. Construir Encabezados Multi-nivel con estilo estándar web (bg-blue-600 / bg-blue-700 text-white)
        let fila1MesesHtml = '';
        let fila2SubcolsHtml = '';

        periodos.forEach(p => {
            fila1MesesHtml += `
                <th colspan="3" class="py-2.5 px-3 text-center font-bold text-white bg-blue-700 border-r-2 border-blue-900 border-b border-blue-600 text-[11px] whitespace-nowrap">
                    ${p.mes_larga || p.key}
                </th>
            `;

            fila2SubcolsHtml += `
                <th class="py-1.5 px-2 text-right text-white bg-blue-600 border-r border-blue-500/70 text-[10px] min-w-[105px] font-semibold whitespace-nowrap">
                    Valor
                </th>
                <th class="py-1.5 px-2 text-right text-white bg-blue-600 border-r border-blue-500/70 text-[10px] min-w-[95px] font-semibold whitespace-nowrap">
                    Kg Vendidos
                </th>
                <th class="py-1.5 px-2 text-right text-white bg-blue-600 border-r-2 border-blue-900 text-[10px] min-w-[85px] font-bold whitespace-nowrap">
                    CU Mensual
                </th>
            `;
        });

        const totalCols = 6 + (periodos.length * 3);

        const theadHtml = `
            <thead class="sticky top-0 z-40 shadow-xs">
                <tr class="text-[11px] border-b border-blue-700">
                    <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-700 sticky left-0 z-50 border-r border-b border-blue-600 min-w-[150px] max-w-[150px]">
                        Clasificación
                    </th>
                    <th rowspan="2" class="px-2 py-2 text-left font-bold text-white bg-blue-700 sticky left-[150px] z-50 border-r border-b border-blue-600 min-w-[65px] max-w-[65px]">
                        cencos
                    </th>
                    <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-700 sticky left-[215px] z-50 border-r border-b border-blue-600 min-w-[120px] max-w-[120px]">
                        nomcencos
                    </th>
                    <th rowspan="2" class="px-2 py-2 text-center font-bold text-white bg-blue-700 sticky left-[335px] z-50 border-r border-b border-blue-600 min-w-[50px] max-w-[50px]">
                        gal..
                    </th>
                    <th rowspan="2" class="px-2 py-2 text-left font-bold text-white bg-blue-700 sticky left-[385px] z-50 border-r border-b border-blue-600 min-w-[65px] max-w-[65px]">
                        tcodigo
                    </th>
                    <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-700 sticky left-[450px] z-50 border-r-2 border-blue-900 border-b border-blue-600 min-w-[160px] max-w-[160px]">
                        nomcodigo
                    </th>
                    ${fila1MesesHtml}
                </tr>
                <tr class="border-b border-blue-800">
                    ${fila2SubcolsHtml}
                </tr>
            </thead>
        `;

        // 2. Aplanar el árbol jerárquico a un array lineal liviano para Virtual Scrolling
        const flatRows = [];

        jerarquia.forEach(clasif => {
            const clasifLabel = clasif.clasificacion;

            clasif.cencos_list.forEach(cencosItem => {
                const cencosVal = cencosItem.cencos;
                const nomcencosVal = cencosItem.nomcencos;

                cencosItem.galpon_list.forEach(galponItem => {
                    const galponVal = galponItem.galpon;

                    // Items individuales
                    galponItem.items_list.forEach(item => {
                        flatRows.push({
                            type: 'item',
                            clasif: clasifLabel,
                            cencos: cencosVal,
                            nomcencos: nomcencosVal,
                            galpon: galponVal,
                            tcodigo: item.tcodigo,
                            nomcodigo: item.nomcodigo,
                            meses: item.meses
                        });
                    });

                    // Subtotal Galpón
                    flatRows.push({
                        type: 'total_galpon',
                        clasif: '',
                        cencos: '',
                        nomcencos: '',
                        galpon: 'Total',
                        tcodigo: '',
                        nomcodigo: '',
                        meses: galponItem.totales_mes
                    });
                });

                // Subtotal Cencos
                flatRows.push({
                    type: 'total_cencos',
                    clasif: '',
                    cencos: '',
                    nomcencos: 'Total',
                    galpon: '',
                    tcodigo: '',
                    nomcodigo: '',
                    meses: cencosItem.totales_mes
                });
            });
        });

        // 3. Fila de Total General (Footer)
        const totalesGenerales = data.totales_generales_mes || {};
        let celdasTotalGeneral = '';

        periodos.forEach(p => {
            const totGen = totalesGenerales[p.key];
            if (totGen && (totGen.valor > 0 || totGen.kg > 0 || totGen.cu > 0)) {
                const valorStr = 'S/ ' + controller.formatearNumero(totGen.valor, 'decimal2');
                const kgStr = Number(totGen.kg).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                const cuStr = Number(totGen.cu).toFixed(3).replace('.', ',');

                celdasTotalGeneral += `
                    <td class="px-2 py-2 text-right font-mono font-bold text-[11px] text-slate-900 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 whitespace-nowrap">
                        ${valorStr}
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-bold text-[11px] text-slate-800 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 whitespace-nowrap">
                        ${kgStr}
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-black text-[11px] text-blue-950 bg-slate-200 border-r-2 border-slate-400 border-t-2 border-b-2 border-slate-400 whitespace-nowrap">
                        ${cuStr}
                    </td>
                `;
            } else {
                celdasTotalGeneral += `
                    <td class="px-2 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400"></td>
                    <td class="px-2 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400"></td>
                    <td class="px-2 py-2 bg-slate-200 border-r-2 border-slate-400 border-t-2 border-b-2 border-slate-400"></td>
                `;
            }
        });

        const tfootHtml = `
            <tfoot class="sticky bottom-0 z-30 font-bold bg-slate-200">
                <tr class="border-t-2 border-b-2 border-slate-400">
                    <td class="px-3 py-2 text-left font-bold text-xs text-slate-900 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 sticky left-0 z-40">
                        Total general
                    </td>
                    <td class="px-2 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 sticky left-[150px] z-40"></td>
                    <td class="px-3 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 sticky left-[215px] z-40"></td>
                    <td class="px-2 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 sticky left-[335px] z-40"></td>
                    <td class="px-2 py-2 bg-slate-200 border-r border-slate-300 border-t-2 border-b-2 border-slate-400 sticky left-[385px] z-40"></td>
                    <td class="px-3 py-2 bg-slate-200 border-r-2 border-slate-400 border-t-2 border-b-2 border-slate-400 sticky left-[450px] z-40"></td>
                    ${celdasTotalGeneral}
                </tr>
            </tfoot>
        `;

        // 4. Montar la estructura DOM inicial con Virtual Scroller
        contenedorGrafica.className = "flex flex-col w-full p-2 bg-white";
        contenedorGrafica.innerHTML = `
            <div id="virtual-scroll-container-cp14" class="w-full overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table class="w-full text-xs border-collapse table-auto">
                    ${theadHtml}
                    <tbody id="virtual-tbody-cp14" class="bg-white"></tbody>
                    ${tfootHtml}
                </table>
            </div>
        `;

        const scrollContainer = document.getElementById('virtual-scroll-container-cp14');
        const virtualTbody = document.getElementById('virtual-tbody-cp14');
        if (!scrollContainer || !virtualTbody) return;

        // 5. Motor de Virtualización DOM (Solo pinta las ~40 filas visibles en pantalla)
        const ROW_HEIGHT = 28; // Altura en px por fila
        const OVERSCAN = 15;   // Filas de margen superior/inferior para scroll suave

        const renderSingleRow = (item) => {
            if (item.type === 'item') {
                let celdasMeses = '';
                periodos.forEach(p => {
                    const pData = item.meses[p.key];
                    if (pData && (pData.valor > 0 || pData.kg > 0 || pData.cu > 0)) {
                        const valorStr = 'S/ ' + controller.formatearNumero(pData.valor, 'decimal2');
                        const kgStr = Number(pData.kg).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                        const cuStr = Number(pData.cu).toFixed(3).replace('.', ',');

                        celdasMeses += `
                            <td class="px-2 py-1 text-right font-mono text-[10.5px] text-slate-700 border-r border-slate-100 border-b border-slate-100 whitespace-nowrap">
                                ${valorStr}
                            </td>
                            <td class="px-2 py-1 text-right font-mono text-[10.5px] text-slate-600 border-r border-slate-100 border-b border-slate-100 whitespace-nowrap">
                                ${kgStr}
                            </td>
                            <td class="px-2 py-1 text-right font-mono text-[10.5px] font-semibold text-slate-900 border-r-2 border-slate-300 border-b border-slate-100 whitespace-nowrap">
                                ${cuStr}
                            </td>
                        `;
                    } else {
                        celdasMeses += `
                            <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-200 border-r border-slate-100 border-b border-slate-100"></td>
                            <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-200 border-r border-slate-100 border-b border-slate-100"></td>
                            <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-200 border-r-2 border-slate-300 border-b border-slate-100"></td>
                        `;
                    }
                });

                return `
                    <tr class="hover:bg-blue-50/30 transition-colors" style="height: ${ROW_HEIGHT}px;">
                        <td class="px-3 py-1 font-semibold text-[10.5px] text-slate-800 bg-white border-r border-b border-slate-100 sticky left-0 z-20 truncate max-w-[150px]" title="${item.clasif}">
                            ${item.clasif}
                        </td>
                        <td class="px-2 py-1 font-mono text-[10.5px] text-slate-700 bg-white border-r border-b border-slate-100 sticky left-[150px] z-20">
                            ${item.cencos}
                        </td>
                        <td class="px-3 py-1 text-[10.5px] text-slate-700 bg-white border-r border-b border-slate-100 sticky left-[215px] z-20 truncate max-w-[120px]" title="${item.nomcencos}">
                            ${item.nomcencos}
                        </td>
                        <td class="px-2 py-1 text-center font-mono text-[10.5px] text-slate-600 bg-white border-r border-b border-slate-100 sticky left-[335px] z-20">
                            ${item.galpon}
                        </td>
                        <td class="px-2 py-1 font-mono text-[10.5px] text-slate-500 bg-white border-r border-b border-slate-100 sticky left-[385px] z-20">
                            ${item.tcodigo}
                        </td>
                        <td class="px-3 py-1 text-[10.5px] text-slate-600 bg-white border-r-2 border-slate-300 border-b border-slate-100 text-left sticky left-[450px] z-20 truncate max-w-[160px]" title="${item.nomcodigo}">
                            ${item.nomcodigo}
                        </td>
                        ${celdasMeses}
                    </tr>
                `;
            } else if (item.type === 'total_galpon') {
                let celdasTotGalpon = '';
                periodos.forEach(p => {
                    const totG = item.meses[p.key];
                    if (totG && (totG.valor > 0 || totG.kg > 0 || totG.cu > 0)) {
                        const valorStr = 'S/ ' + controller.formatearNumero(totG.valor, 'decimal2');
                        const kgStr = Number(totG.kg).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                        const cuStr = Number(totG.cu).toFixed(3).replace('.', ',');

                        celdasTotGalpon += `
                            <td class="px-2 py-1 text-right font-mono font-bold text-[10.5px] text-slate-800 bg-slate-50 border-r border-slate-200 border-b border-slate-200 whitespace-nowrap">
                                ${valorStr}
                            </td>
                            <td class="px-2 py-1 text-right font-mono font-semibold text-[10.5px] text-slate-700 bg-slate-50 border-r border-slate-200 border-b border-slate-200 whitespace-nowrap">
                                ${kgStr}
                            </td>
                            <td class="px-2 py-1 text-right font-mono font-bold text-[10.5px] text-blue-900 bg-slate-50 border-r-2 border-slate-300 border-b border-slate-200 whitespace-nowrap">
                                ${cuStr}
                            </td>
                        `;
                    } else {
                        celdasTotGalpon += `
                            <td class="px-2 py-1 bg-slate-50 border-r border-slate-200 border-b border-slate-200"></td>
                            <td class="px-2 py-1 bg-slate-50 border-r border-slate-200 border-b border-slate-200"></td>
                            <td class="px-2 py-1 bg-slate-50 border-r-2 border-slate-300 border-b border-slate-200"></td>
                        `;
                    }
                });

                return `
                    <tr class="bg-slate-50 font-bold" style="height: ${ROW_HEIGHT}px;">
                        <td class="px-3 py-1 bg-slate-50 border-r border-b border-slate-200 sticky left-0 z-20"></td>
                        <td class="px-2 py-1 bg-slate-50 border-r border-b border-slate-200 sticky left-[150px] z-20"></td>
                        <td class="px-3 py-1 bg-slate-50 border-r border-b border-slate-200 sticky left-[215px] z-20"></td>
                        <td class="px-2 py-1 text-center font-bold text-[10.5px] text-slate-700 bg-slate-50 border-r border-b border-slate-200 sticky left-[335px] z-20">
                            Total
                        </td>
                        <td class="px-2 py-1 bg-slate-50 border-r border-b border-slate-200 sticky left-[385px] z-20"></td>
                        <td class="px-3 py-1 bg-slate-50 border-r-2 border-slate-300 border-b border-slate-200 sticky left-[450px] z-20"></td>
                        ${celdasTotGalpon}
                    </tr>
                `;
            } else if (item.type === 'total_cencos') {
                let celdasTotCencos = '';
                periodos.forEach(p => {
                    const totC = item.meses[p.key];
                    if (totC && (totC.valor > 0 || totC.kg > 0 || totC.cu > 0)) {
                        const valorStr = 'S/ ' + controller.formatearNumero(totC.valor, 'decimal2');
                        const kgStr = Number(totC.kg).toLocaleString('es-PE', { maximumFractionDigits: 0 });
                        const cuStr = Number(totC.cu).toFixed(3).replace('.', ',');

                        celdasTotCencos += `
                            <td class="px-2 py-1.5 text-right font-mono font-bold text-[11px] text-slate-900 bg-slate-100 border-r border-slate-200 border-b-2 border-slate-300 whitespace-nowrap">
                                ${valorStr}
                            </td>
                            <td class="px-2 py-1.5 text-right font-mono font-bold text-[11px] text-slate-800 bg-slate-100 border-r border-slate-200 border-b-2 border-slate-300 whitespace-nowrap">
                                ${kgStr}
                            </td>
                            <td class="px-2 py-1.5 text-right font-mono font-bold text-[11px] text-blue-950 bg-slate-100 border-r-2 border-slate-300 border-b-2 border-slate-300 whitespace-nowrap">
                                ${cuStr}
                            </td>
                        `;
                    } else {
                        celdasTotCencos += `
                            <td class="px-2 py-1.5 bg-slate-100 border-r border-slate-200 border-b-2 border-slate-300"></td>
                            <td class="px-2 py-1.5 bg-slate-100 border-r border-slate-200 border-b-2 border-slate-300"></td>
                            <td class="px-2 py-1.5 bg-slate-100 border-r-2 border-slate-300 border-b-2 border-slate-300"></td>
                        `;
                    }
                });

                return `
                    <tr class="bg-slate-100 font-bold" style="height: ${ROW_HEIGHT}px;">
                        <td class="px-3 py-1.5 bg-slate-100 border-r border-b-2 border-slate-300 sticky left-0 z-20"></td>
                        <td class="px-2 py-1.5 bg-slate-100 border-r border-b-2 border-slate-300 sticky left-[150px] z-20"></td>
                        <td class="px-3 py-1.5 text-left font-bold text-[11px] text-slate-900 bg-slate-100 border-r border-b-2 border-slate-300 sticky left-[215px] z-20">
                            Total
                        </td>
                        <td class="px-2 py-1.5 bg-slate-100 border-r border-b-2 border-slate-300 sticky left-[335px] z-20"></td>
                        <td class="px-2 py-1.5 bg-slate-100 border-r border-b-2 border-slate-300 sticky left-[385px] z-20"></td>
                        <td class="px-3 py-1.5 bg-slate-100 border-r-2 border-slate-300 border-b-2 border-slate-300 sticky left-[450px] z-20"></td>
                        ${celdasTotCencos}
                    </tr>
                `;
            }
            return '';
        };

        let lastStartIndex = -1;
        let isTicking = false;

        const updateVirtualRows = () => {
            const scrollTop = scrollContainer.scrollTop;
            const viewportHeight = scrollContainer.clientHeight || 550;

            const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
            const endIndex = Math.min(flatRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);

            if (startIndex === lastStartIndex) {
                isTicking = false;
                return;
            }
            lastStartIndex = startIndex;

            const topPadding = startIndex * ROW_HEIGHT;
            const bottomPadding = Math.max(0, (flatRows.length - endIndex) * ROW_HEIGHT);

            const buffer = [];
            if (topPadding > 0) {
                buffer.push(`<tr style="height:${topPadding}px; pointer-events:none;"><td colspan="${totalCols}" style="padding:0; border:none; height:${topPadding}px;"></td></tr>`);
            }

            for (let i = startIndex; i < endIndex; i++) {
                buffer.push(renderSingleRow(flatRows[i]));
            }

            if (bottomPadding > 0) {
                buffer.push(`<tr style="height:${bottomPadding}px; pointer-events:none;"><td colspan="${totalCols}" style="padding:0; border:none; height:${bottomPadding}px;"></td></tr>`);
            }

            virtualTbody.innerHTML = buffer.join('');
            isTicking = false;
        };

        // Renderizado inicial de las primeras filas visibles
        updateVirtualRows();

        // Event listener de scroll ultra liviano usando requestAnimationFrame
        scrollContainer.addEventListener('scroll', () => {
            if (!isTicking) {
                requestAnimationFrame(updateVirtualRows);
                isTicking = true;
            }
        }, { passive: true });
    }
};
