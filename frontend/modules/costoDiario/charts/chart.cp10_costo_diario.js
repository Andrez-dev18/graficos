/**
 * Componente de Gráfico / Dashboard Modular: CP10 CostoDiario
 * 
 * Estructura de 2 Paneles de Tablas Interactivas de Alto Rendimiento:
 * 1. Costo Producción por Kg de Pollo Vivo Dia a Dia (Cabecera Azul bg-blue-600, Footer Total General)
 * 2. Datos Productivos por Día (Cabecera Azul bg-blue-600, Filtro de Fecha fechahisto integrado dentro del contenedor)
 */
window.CP10CostoDiarioChart = {
    datosBackend: null,
    controllerRef: null,
    eventsBound: false,
    rafId: null,
    mouseX: 0,
    mouseY: 0,
    currentCell: null,

    render(controller, data) {
        if (!data && controller && controller.tabla1_costo_dia_a_dia) {
            data = controller;
        }
        this.controllerRef = controller;
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

        // Configurar filtro de Mes general
        this.setupGeneralFilters(this.datosBackend);

        // Renderizar estructura HTML de los paneles
        this.renderLayout();

        // Renderizar ambas tablas
        this.renderTabla1();
        this.renderTabla2();

        // Configurar selector de fecha interno de la Tabla 2
        this.setupCardFechaSelector();

        // Delegación de eventos para tooltips ultra rápidos
        this.bindEventsDelegation();
    },

    getSelectedFilters() {
        const filters = {};
        const selMes = document.getElementById('select-mes-cp10');
        if (selMes && selMes.value) {
            filters.mes = selMes.value;
        }
        const selDia = document.getElementById('cp10-card-select-dia');
        if (selDia && selDia.value) {
            filters.fecha_dia = selDia.value;
        }
        return filters;
    },

    setupGeneralFilters(data) {
        const meses = data.meses_disponibles || [];
        const mesActivo = data.mes_seleccionado || '';

        // Filtro Mes en barra superior
        const contMes = document.getElementById('contenedor-filtro-mes-cp10');
        const selMes = document.getElementById('select-mes-cp10');
        if (contMes && selMes) {
            contMes.classList.remove('hidden');
            selMes.innerHTML = meses.map(m => `
                <option value="${m.val}" ${m.val === mesActivo ? 'selected' : ''}>${m.label}</option>
            `).join('');

            selMes.onchange = async () => {
                if (this.controllerRef) {
                    await this.controllerRef.onCargarClick();
                }
            };
        }
    },

    setupCardFechaSelector() {
        const selDia = document.getElementById('cp10-card-select-dia');
        const btnPrev = document.getElementById('cp10-btn-prev-dia');
        const btnNext = document.getElementById('cp10-btn-next-dia');
        const diasMes = this.datosBackend.dias_disponibles_mes || [];
        const diaActivo = this.datosBackend.dia_seleccionado || (this.datosBackend.tabla2_datos_productivos_dia && this.datosBackend.tabla2_datos_productivos_dia.dia_activo) || '';

        if (!selDia) return;

        selDia.innerHTML = diasMes.map(d => {
            const parts = d.split('-');
            const diaNum = parseInt(parts[2], 10);
            return `<option value="${d}" ${d === diaActivo ? 'selected' : ''}>Día ${diaNum} (${d})</option>`;
        }).join('');

        selDia.onchange = async () => {
            await this.cambiarDiaActivo(selDia.value);
        };

        if (btnPrev) {
            btnPrev.onclick = async () => {
                const currentIdx = diasMes.indexOf(selDia.value);
                if (currentIdx > 0) {
                    const prevDia = diasMes[currentIdx - 1];
                    selDia.value = prevDia;
                    await this.cambiarDiaActivo(prevDia);
                }
            };
        }

        if (btnNext) {
            btnNext.onclick = async () => {
                const currentIdx = diasMes.indexOf(selDia.value);
                if (currentIdx >= 0 && currentIdx < diasMes.length - 1) {
                    const nextDia = diasMes[currentIdx + 1];
                    selDia.value = nextDia;
                    await this.cambiarDiaActivo(nextDia);
                }
            };
        }
    },

    async cambiarDiaActivo(nuevoDia) {
        const selMes = document.getElementById('select-mes-cp10');
        const mesVal = selMes ? selMes.value : this.datosBackend.mes_seleccionado;

        try {
            const service = this.controllerRef?.service || new CostoDiarioService();
            const res = await service.obtenerDashboard({
                tipo_grafico: 'CP10 CostoDiario',
                mes: mesVal,
                fecha_dia: nuevoDia
            });

            const data = (res && (res.payload || res.data)) || res || {};
            this.datosBackend.tabla2_datos_productivos_dia = data.tabla2_datos_productivos_dia;
            this.datosBackend.dia_seleccionado = data.dia_seleccionado;

            // Actualizar Tabla 2
            this.renderTabla2();

            // Sincronizar select
            const selDia = document.getElementById('cp10-card-select-dia');
            if (selDia && selDia.value !== data.dia_seleccionado) {
                selDia.value = data.dia_seleccionado;
            }
        } catch (err) {
            console.error('Error al actualizar día en CP10:', err);
        }
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">
                
                <!-- PANEL 1: COSTO PRODUCCIÓN POR KG DE POLLO VIVO DÍA A DÍA -->
                <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <div class="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                                <i class="fa-solid fa-chart-line text-sm"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Costo Producción por Kg de Pollo Vivo Dia a Dia</h3>
                                <p class="text-[11px] text-slate-500">Evolución diaria acumulada del costo unitario y variaciones vs día anterior (<span class="font-semibold text-slate-700">${this.datosBackend.mes_label || ''}</span>)</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Dif. Ant < 0 (Ahorro)
                            </span>
                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                Dif. Ant > 0 (Incremento)
                            </span>
                        </div>
                    </div>
                    
                    <div class="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                        <table id="tabla-cp10-costo-dia" class="w-full text-xs border-collapse table-auto">
                            <thead id="thead-cp10-t1" class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 font-bold shadow-xs select-none"></thead>
                            <tbody id="tbody-cp10-t1" class="divide-y divide-slate-100 bg-white"></tbody>
                            <tfoot id="tfoot-cp10-t1" class="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 shadow-md"></tfoot>
                        </table>
                    </div>
                </div>

                <!-- PANEL 2: DATOS PRODUCTIVOS POR DÍA (CON FILTRO DE FECHA INTERNO) -->
                <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                    <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <div class="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                                <i class="fa-solid fa-feather-pointed text-sm"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Datos Productivos por Dia</h3>
                                <p class="text-[11px] text-slate-500">Indicadores zootécnicos por granja y galpón al día de cierre seleccionado</p>
                            </div>
                        </div>

                        <!-- FILTRO INTERNO DE FECHAHISTO (TABLEAU STYLE) -->
                        <div class="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Día de corte:</span>
                            
                            <button id="cp10-btn-prev-dia" type="button" title="Día anterior"
                                class="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
                                </svg>
                            </button>

                            <select id="cp10-card-select-dia"
                                class="bg-transparent text-xs font-bold text-blue-700 focus:outline-none cursor-pointer border-none py-0.5 pr-6">
                            </select>

                            <button id="cp10-btn-next-dia" type="button" title="Día siguiente"
                                class="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar">
                        <table id="tabla-cp10-prod-dia" class="w-full text-xs border-collapse table-auto">
                            <thead id="thead-cp10-t2" class="sticky top-0 z-20 bg-blue-600 text-white border-b border-blue-700 font-bold shadow-xs select-none"></thead>
                            <tbody id="tbody-cp10-t2" class="divide-y divide-slate-100 bg-white"></tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;
    },

    renderTabla1() {
        const t1Data = this.datosBackend.tabla1_costo_dia_a_dia || {};
        const diasHeaders = t1Data.dias_headers || [];
        const filas = t1Data.filas || [];
        const totalGen = t1Data.total_general || {};

        const thead = document.getElementById('thead-cp10-t1');
        const tbody = document.getElementById('tbody-cp10-t1');
        const tfoot = document.getElementById('tfoot-cp10-t1');
        if (!thead || !tbody || !tfoot) return;

        if (filas.length === 0 || diasHeaders.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="p-8 text-center text-slate-400 italic">No hay datos disponibles para el mes seleccionado</td>
                </tr>
            `;
            tfoot.innerHTML = '';
            return;
        }

        // Fila 1 de cabecera: Línea, Nombre Línea, Días del Mes
        let thRow1 = `
            <th rowspan="2" class="sticky left-0 z-30 bg-blue-600 px-3 py-2 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[70px]">Línea</th>
            <th rowspan="2" class="sticky left-[70px] z-30 bg-blue-600 px-3 py-2 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[10px] min-w-[180px]">Nombre Línea</th>
        `;

        // Fila 2 de cabecera: Subcolumnas CU y Dif. Ant..
        let thRow2 = '';

        diasHeaders.forEach((dh, idx) => {
            const isFirst = (idx === 0);
            const colSpan = isFirst ? 1 : 2;
            thRow1 += `
                <th colspan="${colSpan}" class="px-3 py-2 text-center border-r border-blue-500 bg-blue-600 font-bold text-[11px] whitespace-nowrap">
                    ${dh.label}
                </th>
            `;

            if (isFirst) {
                thRow2 += `
                    <th class="px-3 py-1.5 text-right border-r border-blue-600 bg-blue-700 font-semibold text-[10px] min-w-[75px]">CU</th>
                `;
            } else {
                thRow2 += `
                    <th class="px-3 py-1.5 text-right border-r border-blue-600 bg-blue-700 font-semibold text-[10px] min-w-[75px]">CU</th>
                    <th class="px-3 py-1.5 text-right border-r border-blue-600 bg-blue-700 font-semibold text-[10px] min-w-[75px]">Dif. Ant..</th>
                `;
            }
        });

        thead.innerHTML = `
            <tr class="border-b border-blue-700">${thRow1}</tr>
            <tr class="border-b border-blue-800">${thRow2}</tr>
        `;

        // Filas del cuerpo
        let rowsHtml = '';
        filas.forEach(f => {
            let cellsHtml = `
                <td class="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-2 font-mono font-bold text-slate-700 border-r border-slate-200">${f.linea}</td>
                <td class="sticky left-[70px] z-10 bg-white group-hover:bg-slate-50 px-3 py-2 font-medium text-slate-800 border-r border-slate-300 truncate max-w-[200px]" title="${f.nomlinea}">${f.nomlinea}</td>
            `;

            diasHeaders.forEach((dh, idx) => {
                const isFirst = (idx === 0);
                const dData = (f.dias && f.dias[dh.fecha]) || null;

                if (!dData || dData.sin_datos || dData.cu === null) {
                    cellsHtml += `<td class="px-3 py-2 text-right border-r border-slate-100 text-slate-300">-</td>`;
                    if (!isFirst) {
                        cellsHtml += `<td class="px-3 py-2 text-right border-r border-slate-100 text-slate-300">-</td>`;
                    }
                } else {
                    const cuFmt = this.formatNum(dData.cu, 3);
                    const valFmt = this.formatNum(dData.valor, 2);
                    const comFmt = this.formatNum(dData.comodin, 2);

                    // Celda CU
                    cellsHtml += `
                        <td class="cell-t1 px-3 py-2 text-right font-mono font-semibold text-slate-800 border-r border-slate-100 hover:bg-blue-50/60 transition-colors cursor-default"
                            data-linea="${f.linea}"
                            data-nomlinea="${f.nomlinea}"
                            data-fecha="${dh.label}"
                            data-tipo="CU"
                            data-cu="${cuFmt}"
                            data-valor="${valFmt}"
                            data-comodin="${comFmt}">
                            ${cuFmt}
                        </td>
                    `;

                    // Celda Dif. Ant..
                    if (!isFirst) {
                        const dif = dData.dif_ant;
                        let difColorClass = 'text-slate-500';
                        let difFmt = '-';

                        if (dif !== null && dif !== undefined) {
                            if (dif > 0) {
                                difColorClass = 'text-rose-600 font-bold bg-rose-50/40';
                                difFmt = '+' + this.formatNum(dif, 3);
                            } else if (dif < 0) {
                                difColorClass = 'text-emerald-700 font-bold bg-emerald-50/40';
                                difFmt = this.formatNum(dif, 3);
                            } else {
                                difColorClass = 'text-slate-400';
                                difFmt = '0,000';
                            }
                        }

                        cellsHtml += `
                            <td class="cell-t1 px-3 py-2 text-right font-mono ${difColorClass} border-r border-slate-100 hover:bg-blue-50/60 transition-colors cursor-default"
                                data-linea="${f.linea}"
                                data-nomlinea="${f.nomlinea}"
                                data-fecha="${dh.label}"
                                data-tipo="Dif. Anterior"
                                data-cu="${cuFmt}"
                                data-dif="${difFmt}"
                                data-valor="${valFmt}"
                                data-comodin="${comFmt}">
                                ${difFmt}
                            </td>
                        `;
                    }
                }
            });

            rowsHtml += `<tr class="group hover:bg-slate-50/80 transition-colors">${cellsHtml}</tr>`;
        });

        tbody.innerHTML = rowsHtml;

        // Fila de Total General en Footer
        let footCells = `
            <td colspan="2" class="sticky left-0 z-20 bg-slate-100 px-3 py-2.5 font-bold text-slate-900 border-r border-slate-300 uppercase tracking-wider text-[11px]">Total general</td>
        `;

        diasHeaders.forEach((dh, idx) => {
            const isFirst = (idx === 0);
            const totData = totalGen[dh.fecha] || null;

            if (!totData || totData.sin_datos || totData.cu === null) {
                footCells += `<td class="px-3 py-2.5 text-right font-mono font-bold text-slate-400 border-r border-slate-200">-</td>`;
                if (!isFirst) {
                    footCells += `<td class="px-3 py-2.5 text-right font-mono font-bold text-slate-400 border-r border-slate-200">-</td>`;
                }
            } else {
                const cuFmt = this.formatNum(totData.cu, 3);
                const valFmt = this.formatNum(totData.valor, 2);
                const comFmt = this.formatNum(totData.comodin, 2);

                footCells += `
                    <td class="cell-t1 px-3 py-2.5 text-right font-mono font-bold text-blue-900 border-r border-slate-200 bg-slate-100 hover:bg-blue-100/60 cursor-default"
                        data-linea="TOTAL"
                        data-nomlinea="Total General"
                        data-fecha="${dh.label}"
                        data-tipo="Total CU"
                        data-cu="${cuFmt}"
                        data-valor="${valFmt}"
                        data-comodin="${comFmt}">
                        ${cuFmt}
                    </td>
                `;

                if (!isFirst) {
                    const dif = totData.dif_ant;
                    let difColorClass = 'text-slate-600';
                    let difFmt = '-';

                    if (dif !== null && dif !== undefined) {
                        if (dif > 0) {
                            difColorClass = 'text-rose-600 font-bold bg-rose-50';
                            difFmt = '+' + this.formatNum(dif, 3);
                        } else if (dif < 0) {
                            difColorClass = 'text-emerald-700 font-bold bg-emerald-50';
                            difFmt = this.formatNum(dif, 3);
                        } else {
                            difColorClass = 'text-slate-500';
                            difFmt = '0,000';
                        }
                    }

                    footCells += `
                        <td class="cell-t1 px-3 py-2.5 text-right font-mono ${difColorClass} border-r border-slate-200 hover:bg-blue-100/60 cursor-default"
                            data-linea="TOTAL"
                            data-nomlinea="Total General"
                            data-fecha="${dh.label}"
                            data-tipo="Total Dif. Anterior"
                            data-cu="${cuFmt}"
                            data-dif="${difFmt}"
                            data-valor="${valFmt}"
                            data-comodin="${comFmt}">
                            ${difFmt}
                        </td>
                    `;
                }
            }
        });

        tfoot.innerHTML = `<tr>${footCells}</tr>`;
    },

    renderTabla2() {
        const t2Data = this.datosBackend.tabla2_datos_productivos_dia || {};
        const columnas = t2Data.columnas || [];
        const totalGen = t2Data.total_general || {};

        const thead = document.getElementById('thead-cp10-t2');
        const tbody = document.getElementById('tbody-cp10-t2');

        if (!thead || !tbody) return;

        if (columnas.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="p-8 text-center text-slate-400 italic">No hay registros de ventas/producción para la fecha seleccionada</td>
                </tr>
            `;
            return;
        }

        // Agrupar columnas por fecha_label para cabecera nivel 1
        const fechasGroup = [];
        let currFec = null;
        let currCount = 0;

        columnas.forEach(c => {
            if (c.fecha_label !== currFec) {
                if (currFec !== null) {
                    fechasGroup.push({ label: currFec, count: currCount });
                }
                currFec = c.fecha_label;
                currCount = 1;
            } else {
                currCount++;
            }
        });
        if (currFec !== null) {
            fechasGroup.push({ label: currFec, count: currCount });
        }

        // Fila 1 Cabecera: Métrica (rowspan 3), Total general (rowspan 3), Fechas (colspan)
        let thRow1 = `
            <th rowspan="3" class="sticky left-0 z-30 bg-blue-600 px-4 py-2.5 text-left border-r border-blue-500 font-bold uppercase tracking-wider text-[11px] min-w-[170px]">Métrica</th>
            <th rowspan="3" class="sticky left-[170px] z-30 bg-blue-700 text-white px-3 py-2.5 text-right border-r border-blue-500 font-bold uppercase tracking-wider text-[11px] min-w-[110px] shadow-xs">Total general</th>
        `;
        fechasGroup.forEach(fg => {
            thRow1 += `
                <th colspan="${fg.count}" class="px-3 py-2 text-center border-r border-blue-500 bg-blue-600 font-bold text-[11px] whitespace-nowrap">
                    ${fg.label}
                </th>
            `;
        });

        // Fila 2 Cabecera: Granja (nomcencos / cencos)
        let thRow2 = '';
        columnas.forEach(c => {
            thRow2 += `
                <th class="px-3 py-1.5 text-center border-r border-blue-600 bg-blue-700 font-semibold text-[10px] min-w-[100px] truncate max-w-[120px]" title="${c.cencos} ${c.nomcencos || ''}">
                    ${c.cencos}
                </th>
            `;
        });

        // Fila 3 Cabecera: Galpón
        let thRow3 = '';
        columnas.forEach(c => {
            thRow3 += `
                <th class="px-3 py-1.5 text-center border-r border-blue-700 bg-blue-800 font-bold text-[10px] min-w-[100px]">
                    ${c.galpon}
                </th>
            `;
        });

        thead.innerHTML = `
            <tr class="border-b border-blue-700">${thRow1}</tr>
            <tr class="border-b border-blue-800">${thRow2}</tr>
            <tr class="border-b border-blue-900">${thRow3}</tr>
        `;

        // Definición de las 7 Métricas
        const metricasDef = [
            { key: 'saca_und', label: 'Pollos Vendidos', decimals: 0, isPercent: false },
            { key: 'saca_kilos', label: 'Kilos Vendidos', decimals: 0, isPercent: false },
            { key: 'peso_promedio', label: 'Peso Prome Venta', decimals: 3, isPercent: false },
            { key: 'ica', label: 'ICA', decimals: 3, isPercent: false },
            { key: 'prom_edad_ven', label: 'Prom Edad Venta', decimals: 3, isPercent: false },
            { key: 'porc_mort', label: '% Mort', decimals: 3, isPercent: true },
            { key: 'pgd', label: 'PGD', decimals: 3, isPercent: false }
        ];

        let tbodyHtml = '';
        metricasDef.forEach((m, idx) => {
            const totVal = totalGen[m.key];
            const totFmt = this.formatNum(totVal, m.decimals) + (m.isPercent ? '%' : '');

            let cells = `
                <td class="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 border-r border-slate-300 whitespace-nowrap">${m.label}</td>
                <td class="sticky left-[170px] z-10 bg-blue-50/70 group-hover:bg-blue-100/60 px-3 py-2.5 font-mono font-bold text-blue-950 border-r border-slate-300 text-right shadow-xs">${totFmt}</td>
            `;

            columnas.forEach(c => {
                const val = c.valores ? c.valores[m.key] : 0;
                const valFmt = this.formatNum(val, m.decimals) + (m.isPercent ? '%' : '');

                cells += `
                    <td class="cell-t2 px-3 py-2 text-right font-mono font-medium text-slate-700 border-r border-slate-100 hover:bg-blue-50/60 transition-colors cursor-default"
                        data-metrica="${m.label}"
                        data-fecha="${c.fecha_label}"
                        data-granja="${c.cencos} ${c.nomcencos || ''}"
                        data-galpon="${c.galpon}"
                        data-valor="${valFmt}">
                        ${valFmt}
                    </td>
                `;
            });

            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
            tbodyHtml += `<tr class="group ${rowBg} hover:bg-slate-50 transition-colors">${cells}</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    },

    bindEventsDelegation() {
        if (this.eventsBound) return;
        this.eventsBound = true;

        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        // Tooltips ultra fluidos via delegación de eventos
        contenedor.addEventListener('pointerover', (e) => {
            const cell = e.target.closest('.cell-t1, .cell-t2');
            if (cell && cell !== this.currentCell) {
                this.currentCell = cell;
                const ds = cell.dataset;

                if (cell.classList.contains('cell-t1')) {
                    this.showTooltip(e, {
                        'Línea': ds.linea === 'TOTAL' ? 'TOTAL GENERAL' : `${ds.linea} ${ds.nomlinea}`,
                        'Fecha': ds.fecha,
                        'Tipo': ds.tipo,
                        'Costo Unitario (CU)': `S/ ${ds.cu}`,
                        'Dif. Anterior': ds.dif ? `S/ ${ds.dif}` : null,
                        'Valor Acumulado': `S/ ${ds.valor}`,
                        'Comodín / Kilos': `${ds.comodin} Kg`
                    });
                } else if (cell.classList.contains('cell-t2')) {
                    this.showTooltip(e, {
                        'Métrica': ds.metrica,
                        'Fecha': ds.fecha,
                        'Granja': ds.granja,
                        'Galpón': `Galpón ${ds.galpon}`,
                        'Valor': ds.valor
                    });
                }
            }
        }, { passive: true });

        contenedor.addEventListener('pointermove', (e) => {
            if (this.currentCell) {
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => {
                        this.updateTooltipPosition();
                        this.rafId = null;
                    });
                }
            }
        }, { passive: true });

        contenedor.addEventListener('pointerout', (e) => {
            const cell = e.target.closest('.cell-t1, .cell-t2');
            if (cell && (!e.relatedTarget || !cell.contains(e.relatedTarget))) {
                this.currentCell = null;
                this.hideTooltip();
            }
        }, { passive: true });
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
    },

    destroy() {
        this.hideTooltip();
        this.currentCell = null;
    }
};

// Registrar en ChartRegistry
if (typeof window.ChartRegistry !== 'undefined') {
    window.ChartRegistry['CP10 CostoDiario'] = window.CP10CostoDiarioChart;
    window.ChartRegistry['CP10'] = window.CP10CostoDiarioChart;
}
