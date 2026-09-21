/**
 * Componente de Gráfico / Dashboard Modular: DashAnalisisPlacasGral
 * Módulo: mermaPlaca
 * 
 * Dashboard Integral con 6 Vistas Sincronizadas:
 * 1. Mermas Por Fecha (Gráfico de barras horizontales scrollable con paleta por rangos: Rojo, Naranja, Amarillo, Lima, Verde).
 * 2. Mermas Generales por Código (Tabla de Placa -> CodItem con redondeo entero y barras de % exactas).
 * 3. Mermas Individuales Generales (Gráfico de barras horizontales scrollable con degradado divergente: Rojo -> Coral -> Naranja -> Gris -> Lima -> Verde).
 * 4. Por Día (Matriz jerárquica: Placa -> Fecha -> CD -> Item con mini-barras y celdas en blanco si % es 0).
 * 5. Por Código (Matriz jerárquica: Placa -> Item -> CD -> Fecha con mini-barras y celdas en blanco si % es 0).
 * 6. Por CD (Matriz jerárquica: Placa -> CD -> Fecha -> Item con mini-barras y celdas en blanco si % es 0).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.DashAnalisisPlacasGralChart = {
    controllerRef: null,
    datosBackend: null,
    multiPlaca: null,
    multiCliente: null,
    multiItem: null,
    chartMermasFecha: null,
    chartMermasIndiv: null,

    render(controller, data) {
        this.controllerRef = controller;
        this.datosBackend = data || {};

        // Asegurar que tooltips flotantes antiguos queden ocultos
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) {
            tt.classList.add('hidden');
            tt.style.display = 'none';
            tt.innerHTML = '';
        }

        // Ocultar contenedores estándar no usados
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
        this.setupFilters(this.datosBackend.opciones_filtros || {});

        // Renderizar estructura HTML del Dashboard
        this.renderLayout();

        // Renderizar gráficos y tablas internas
        this.renderChartsAndTables();
    },

    getSelectedFilters() {
        const filters = {};
        if (this.multiPlaca) {
            const placas = this.multiPlaca.getSelectedValues();
            if (placas.length > 0 && placas.length < (this.multiPlaca.options ? this.multiPlaca.options.length : 999)) {
                filters.placa = placas;
            }
        }
        if (this.multiCliente) {
            const clientes = this.multiCliente.getSelectedValues();
            if (clientes.length > 0 && clientes.length < (this.multiCliente.options ? this.multiCliente.options.length : 999)) {
                filters.cdcliente = clientes;
            }
        }
        if (this.multiItem) {
            const items = this.multiItem.getSelectedValues();
            if (items.length > 0 && items.length < (this.multiItem.options ? this.multiItem.options.length : 999)) {
                filters.coditem = items;
            }
        }
        return filters;
    },

    setupFilters(opciones = {}) {
        // 1. Filtro Placa
        const contPlaca = document.getElementById('contenedor-filtro-placa-merma');
        if (contPlaca) contPlaca.classList.remove('hidden');

        const placasDisp = opciones.placas || [];
        if (typeof CustomMultiSelect !== 'undefined' && placasDisp.length > 0) {
            if (!this.multiPlaca) {
                const optPlaca = placasDisp.map(p => ({
                    id: String(p).trim(),
                    label: String(p).trim(),
                    selected: true
                }));
                this.multiPlaca = new CustomMultiSelect({
                    btnId: 'btn-dropdown-placa-merma',
                    dropdownId: 'dropdown-placa-merma',
                    optionsContainerId: 'container-options-placa-merma',
                    labelId: 'label-placa-merma',
                    searchId: 'search-placa-merma',
                    title: 'Placa',
                    options: optPlaca
                });
            }
        }

        // 2. Filtro Cliente
        const contCli = document.getElementById('contenedor-filtro-cliente-merma');
        if (contCli) contCli.classList.remove('hidden');

        const clientesDisp = opciones.clientes || [];
        if (typeof CustomMultiSelect !== 'undefined' && clientesDisp.length > 0) {
            if (!this.multiCliente) {
                const optCli = clientesDisp.map(c => ({
                    id: String(c).trim(),
                    label: String(c).trim(),
                    selected: true
                }));
                this.multiCliente = new CustomMultiSelect({
                    btnId: 'btn-dropdown-cliente-merma',
                    dropdownId: 'dropdown-cliente-merma',
                    optionsContainerId: 'container-options-cliente-merma',
                    labelId: 'label-cliente-merma',
                    searchId: 'search-cliente-merma',
                    title: 'Cliente',
                    options: optCli
                });
            }
        }

        // 3. Filtro CodItem
        const contItem = document.getElementById('contenedor-filtro-item-merma');
        if (contItem) contItem.classList.remove('hidden');

        const itemsDisp = opciones.items || ['100', '103', '107'];
        if (typeof CustomMultiSelect !== 'undefined' && itemsDisp.length > 0) {
            if (!this.multiItem) {
                const optItem = itemsDisp.map(it => ({
                    id: String(it).trim(),
                    label: String(it).trim(),
                    selected: true
                }));
                this.multiItem = new CustomMultiSelect({
                    btnId: 'btn-dropdown-item-merma',
                    dropdownId: 'dropdown-item-merma',
                    optionsContainerId: 'container-options-item-merma',
                    labelId: 'label-item-merma',
                    searchId: 'search-item-merma',
                    title: 'Item',
                    options: optItem
                });
            }
        }

        // Ocultar filtro transacción en este dashboard
        const contTrans = document.getElementById('contenedor-filtro-transaccion-merma');
        if (contTrans) contTrans.classList.add('hidden');
    },

    renderLayout() {
        const contenedor = document.getElementById('contenedor-grafica-costo');
        if (!contenedor) return;

        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-6 p-4 sm:p-6 bg-slate-50/50">

                <!-- FILA 1: MERMAS POR FECHA (SCROLLABLE) + MERMAS GENERALES POR CODIGO (TABLA) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    <!-- 1. MERMAS POR FECHA (CON SCROLL VERTICAL) -->
                    <div class="xl:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Mermas Por Fecha</h3>
                                <p class="text-[11px] text-slate-500">% Merma por placa ordenado descendentemente (Scroll vertical activo)</p>
                            </div>
                        </div>
                        <div class="p-3 flex-1 overflow-y-auto custom-scrollbar max-h-[520px] bg-white">
                            <div id="container-canvas-mermas-fecha" class="relative w-full">
                                <canvas id="chart-mermas-fecha"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- 2. MERMAS GENERALES POR CÓDIGO (CON REDONDEO EXACTO TABLEAU) -->
                    <div class="xl:col-span-7 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Mermas Generales por Codigo</h3>
                                <p class="text-[11px] text-slate-500">Desglose de entradas E100, E101, merma S8XX y % merma con mini-barras</p>
                            </div>
                        </div>
                        <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar bg-white">
                            <table id="tabla-mermas-codigo" class="w-full text-xs border-collapse table-auto">
                                <thead class="sticky top-0 z-10 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                    <tr>
                                        <th class="px-3 py-2 text-left border-r border-blue-500 min-w-[85px]">Placa</th>
                                        <th class="px-2 py-2 text-center border-r border-blue-500 min-w-[65px]">CodItem</th>
                                        <th class="px-3 py-2 text-right border-r border-blue-500 min-w-[100px]">E100Entrada</th>
                                        <th class="px-3 py-2 text-right border-r border-blue-500 min-w-[100px]">E101Entrada</th>
                                        <th class="px-3 py-2 text-right border-r border-blue-500 min-w-[100px]">S8XXMerma</th>
                                        <th class="px-3 py-2 text-right min-w-[125px]">%MermaPeso</th>
                                    </tr>
                                </thead>
                                <tbody id="tbody-mermas-codigo" class="divide-y divide-slate-100 bg-white"></tbody>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- FILA 2: MERMAS INDIVIDUALES GENERALES (SCROLLABLE) + SUB-GRIDS CON BARRAS GANTT -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    <!-- 3. MERMAS INDIVIDUALES GENERALES (CON SCROLL VERTICAL Y DEGRADADO DIVERGENTE) -->
                    <div class="xl:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                        <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 class="text-sm font-bold text-slate-900 tracking-tight">Mermas Individuales Generales</h3>
                                <p class="text-[11px] text-slate-500">Mermas por viaje individual con paleta divergente rojo-gris-verde (Scroll vertical)</p>
                            </div>
                        </div>
                        <div class="p-3 flex-1 overflow-y-auto custom-scrollbar max-h-[520px] bg-white">
                            <div id="container-canvas-mermas-indiv" class="relative w-full">
                                <canvas id="chart-mermas-indiv"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- 4, 5, 6: MATRICES TRIPLES CON CABECERAS BLUE-600 -->
                    <div class="xl:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <!-- TABLA: POR DÍA -->
                        <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                            <div class="px-3 py-2.5 bg-slate-100 border-b border-slate-200">
                                <h4 class="text-xs font-bold text-slate-900">Por Dia</h4>
                            </div>
                            <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                                <table id="tabla-por-dia" class="w-full text-[11px] border-collapse table-auto">
                                    <thead class="sticky top-0 z-10 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                        <tr>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Placa</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Día de FecProceso</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">CDCliente</th>
                                            <th class="px-1 py-1.5 text-center border-r border-blue-500">CodItem</th>
                                            <th class="px-1.5 py-1.5 text-right min-w-[85px]">%MermaPeso</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-por-dia" class="divide-y divide-slate-100 bg-white"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- TABLA: POR CÓDIGO -->
                        <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                            <div class="px-3 py-2.5 bg-slate-100 border-b border-slate-200">
                                <h4 class="text-xs font-bold text-slate-900">Por Codigo</h4>
                            </div>
                            <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                                <table id="tabla-por-codigo" class="w-full text-[11px] border-collapse table-auto">
                                    <thead class="sticky top-0 z-10 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                        <tr>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Placa</th>
                                            <th class="px-1 py-1.5 text-center border-r border-blue-500">CodItem</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">CDCliente</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Día de FecProceso</th>
                                            <th class="px-1.5 py-1.5 text-right min-w-[85px]">%MermaPeso</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-por-codigo" class="divide-y divide-slate-100 bg-white"></tbody>
                                </table>
                            </div>
                        </div>

                        <!-- TABLA: POR CD -->
                        <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                            <div class="px-3 py-2.5 bg-slate-100 border-b border-slate-200">
                                <h4 class="text-xs font-bold text-slate-900">Por CD</h4>
                            </div>
                            <div class="flex-1 overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar">
                                <table id="tabla-por-cd" class="w-full text-[11px] border-collapse table-auto">
                                    <thead class="sticky top-0 z-10 bg-blue-600 text-white font-bold border-b border-blue-700 shadow-xs">
                                        <tr>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Placa</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">CDCliente</th>
                                            <th class="px-1.5 py-1.5 text-left border-r border-blue-500">Día de FecProceso</th>
                                            <th class="px-1 py-1.5 text-center border-r border-blue-500">CodItem</th>
                                            <th class="px-1.5 py-1.5 text-right min-w-[85px]">%MermaPeso</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tbody-por-cd" class="divide-y divide-slate-100 bg-white"></tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        `;
    },

    renderChartsAndTables() {
        this.renderChartMermasFecha();
        this.renderTablaMermasCodigo();
        this.renderChartMermasIndiv();
        this.renderTablasJerarquicas();
    },

    renderChartMermasFecha() {
        const canvas = document.getElementById('chart-mermas-fecha');
        const container = document.getElementById('container-canvas-mermas-fecha');
        if (!canvas || !container) return;

        if (this.chartMermasFecha) {
            this.chartMermasFecha.destroy();
            this.chartMermasFecha = null;
        }

        const data = this.datosBackend || {};
        const lista = data.mermas_por_fecha || [];

        // Scroll dinámico: altura proporcional al número total de placas
        const canvasHeight = Math.max(480, lista.length * 20);
        container.style.height = `${canvasHeight}px`;

        const labels = lista.map(p => p.placa);
        const values = lista.map(p => p.porc_merma_peso);
        // Paleta original perfecta por rangos
        const colors = values.map(v => this.getColorForPercentage(v));

        const ctx = canvas.getContext('2d');
        this.chartMermasFecha = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 2,
                    borderSkipped: false,
                    barThickness: 11
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    axis: 'y',
                    intersect: true // Solo activa tooltip al pasar el cursor encima de la barra exacta
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        intersect: true,
                        mode: 'nearest',
                        axis: 'y',
                        backgroundColor: '#1e293b',
                        titleColor: '#ffffff',
                        bodyColor: '#f1f5f9',
                        borderColor: '#475569',
                        borderWidth: 1,
                        padding: 8,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                return `Placa: ${items[0].label}`;
                            },
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const item = lista[idx];
                                return [
                                    `% Merma: ${this.formatNum(item.porc_merma_peso, 2)}%`,
                                    `Merma (S8XX): ${this.formatInteger(item.s8xx_merma)} kg`,
                                    `Entradas (E100+E101): ${this.formatInteger(item.total_entrada)} kg`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        offset: 4,
                        formatter: (val) => `${this.formatNum(val, 2)}%`,
                        font: { size: 9, weight: 'bold' },
                        color: (ctx) => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            if (val >= 4.0) return '#b91c1c';
                            if (val >= 3.5) return '#c2410c';
                            if (val >= 3.0) return '#a16207';
                            if (val >= 2.5) return '#4d7c0f';
                            return '#047857';
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            callback: (v) => `${this.formatNum(v, 2)}%`,
                            font: { size: 9 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { size: 9, weight: 'bold' }, color: '#1e293b' }
                    }
                }
            },
            plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : []
        });
    },

    renderTablaMermasCodigo() {
        const tbody = document.getElementById('tbody-mermas-codigo');
        if (!tbody) return;

        const data = this.datosBackend || {};
        const lista = data.mermas_por_codigo || [];

        if (lista.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400 italic">
                        No se encontraron registros para los filtros seleccionados
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        lista.forEach(p => {
            const placa = p.placa;
            const items = p.items || [];
            const tot = p.total || {};
            const numItems = items.length;

            items.forEach((it, idx) => {
                let placaCell = '';
                if (idx === 0) {
                    placaCell = `
                        <td rowspan="${numItems + 1}" class="px-3 py-2 align-top font-bold text-slate-900 border-r border-slate-200 bg-white">
                            ${placa}
                        </td>
                    `;
                }

                const colorBar = this.getColorForPercentage(it.porc_merma_peso);
                const barWidth = Math.min(100, Math.max(4, it.porc_merma_peso * 10));

                html += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        ${placaCell}
                        <td class="px-2 py-1.5 text-center font-mono font-semibold text-slate-700 border-r border-slate-100">${it.coditem}</td>
                        <td class="px-3 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100">${this.formatInteger(it.e100_entrada)}</td>
                        <td class="px-3 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100">${this.formatInteger(it.e101_entrada)}</td>
                        <td class="px-3 py-1.5 text-right font-mono text-slate-800 border-r border-slate-100">${this.formatInteger(it.s8xx_merma)}</td>
                        <td class="px-3 py-1.5 text-right font-mono font-bold text-slate-900">
                            <div class="flex items-center justify-end gap-2">
                                <span>${this.formatNum(it.porc_merma_peso, 2)}%</span>
                                <div class="w-10 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                    <div class="h-full rounded-full" style="width: ${barWidth}%; background-color: ${colorBar};"></div>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            });

            // Fila Total de la Placa
            const colorTotBar = this.getColorForPercentage(tot.porc_merma_peso);
            const barTotWidth = Math.min(100, Math.max(4, tot.porc_merma_peso * 10));

            html += `
                <tr class="bg-slate-100/70 font-bold border-b border-slate-200">
                    <td class="px-2 py-1.5 text-center font-bold text-slate-900 border-r border-slate-200">Total</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-900 border-r border-slate-200">${this.formatInteger(tot.e100_entrada)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-900 border-r border-slate-200">${this.formatInteger(tot.e101_entrada)}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-slate-900 border-r border-slate-200">${this.formatInteger(tot.s8xx_merma)}</td>
                    <td class="px-3 py-1.5 text-right font-mono font-extrabold text-slate-950">
                        <div class="flex items-center justify-end gap-2">
                            <span>${this.formatNum(tot.porc_merma_peso, 2)}%</span>
                            <div class="w-10 bg-slate-200 h-1.5 rounded-full overflow-hidden shrink-0 border border-slate-300">
                                <div class="h-full rounded-full" style="width: ${barTotWidth}%; background-color: ${colorTotBar};"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    renderChartMermasIndiv() {
        const canvas = document.getElementById('chart-mermas-indiv');
        const container = document.getElementById('container-canvas-mermas-indiv');
        if (!canvas || !container) return;

        if (this.chartMermasIndiv) {
            this.chartMermasIndiv.destroy();
            this.chartMermasIndiv = null;
        }

        const data = this.datosBackend || {};
        const lista = data.mermas_individuales || [];

        // Scroll dinámico para todas las mermas individuales
        const canvasHeight = Math.max(480, lista.length * 20);
        container.style.height = `${canvasHeight}px`;

        const labels = lista.map(it => it.detalle);
        const values = lista.map(it => it.porc_merma_peso);

        // Paleta divergente: Rojo -> Coral -> Naranja -> Gris (~3.5%) -> Lima -> Verde
        const colors = values.map(v => this.getColorMermasIndiv(v));

        const ctx = canvas.getContext('2d');
        this.chartMermasIndiv = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 2,
                    borderSkipped: false,
                    barThickness: 11
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    axis: 'y',
                    intersect: true // Tooltip solo al colocar cursor sobre la barra exacta
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        intersect: true,
                        mode: 'nearest',
                        axis: 'y',
                        backgroundColor: '#1e293b',
                        titleColor: '#ffffff',
                        bodyColor: '#f1f5f9',
                        borderColor: '#475569',
                        borderWidth: 1,
                        padding: 8,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                return items[0].label;
                            },
                            label: (ctx) => {
                                const idx = ctx.dataIndex;
                                const item = lista[idx];
                                return [
                                    `% Merma: ${this.formatNum(item.porc_merma_peso, 2)}%`,
                                    `Fecha: ${item.fecha_dmy}`,
                                    `Merma (S8XX): ${this.formatInteger(item.s8xx_merma)} kg`,
                                    `Entradas (E100+E101): ${this.formatInteger(item.total_entrada)} kg`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        offset: 4,
                        formatter: (val) => `${this.formatNum(val, 2)}%`,
                        font: { size: 9, weight: 'bold' },
                        color: (ctx) => {
                            const val = ctx.dataset.data[ctx.dataIndex];
                            if (val >= 4.5) return '#991b1b';
                            if (val >= 3.8) return '#c2410c';
                            if (val <= 2.0) return '#15803d';
                            return '#475569';
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            callback: (v) => `${this.formatNum(v, 2)}%`,
                            font: { size: 9 }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 9, weight: 'medium' },
                            color: '#1e293b',
                            callback: function(value) {
                                const label = this.getLabelForValue(value);
                                return label.length > 35 ? label.substring(0, 33) + '...' : label;
                            }
                        }
                    }
                }
            },
            plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : []
        });
    },

    renderTablasJerarquicas() {
        const data = this.datosBackend || {};

        // 1. Por Día: Placa (rowspan) -> Día de FecProceso (rowspan) -> CDCliente (rowspan) -> CodItem -> %MermaPeso
        this.renderTablaPorDia(data.por_dia || []);

        // 2. Por Código: Placa (rowspan) -> CodItem (rowspan) -> CDCliente (rowspan) -> Día de FecProceso -> %MermaPeso
        this.renderTablaPorCodigo(data.por_codigo || []);

        // 3. Por CD: Placa (rowspan) -> CDCliente (rowspan) -> Día de FecProceso (rowspan) -> CodItem -> %MermaPeso
        this.renderTablaPorCD(data.por_cd || []);
    },

    renderTablaPorDia(lista) {
        const tbody = document.getElementById('tbody-por-dia');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400 italic">Sin datos</td></tr>';
            return;
        }

        // Estructurar árbol: Placa -> Fecha -> Cliente -> Items
        const tree = {};
        lista.forEach(r => {
            const p = r.placa || '';
            const f = r.fecha || '';
            const c = r.cliente || '';
            if (!tree[p]) tree[p] = {};
            if (!tree[p][f]) tree[p][f] = {};
            if (!tree[p][f][c]) tree[p][f][c] = [];
            tree[p][f][c].push(r);
        });

        let html = '';
        Object.entries(tree).forEach(([placaKey, fechas]) => {
            let placaSpan = 0;
            Object.values(fechas).forEach(clis => {
                Object.values(clis).forEach(items => {
                    placaSpan += items.length;
                });
            });

            let isFirstPlacaRow = true;

            Object.entries(fechas).forEach(([fechaKey, clis]) => {
                let fechaSpan = 0;
                Object.values(clis).forEach(items => {
                    fechaSpan += items.length;
                });

                let isFirstFechaRow = true;

                Object.entries(clis).forEach(([cliKey, items]) => {
                    const cliSpan = items.length;
                    let isFirstCliRow = true;

                    items.forEach(r => {
                        const hasMerma = r.porc_merma_peso > 0;
                        const barWidth = Math.min(100, Math.max(6, r.porc_merma_peso * 10));
                        const colorBar = this.getColorForPercentage(r.porc_merma_peso);

                        html += `<tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">`;

                        if (isFirstPlacaRow) {
                            const placaLabel = placaKey !== '0' && placaKey !== '' ? placaKey : '';
                            html += `<td rowspan="${placaSpan}" class="px-2 py-1 align-top font-bold text-slate-900 border-r border-slate-200 bg-white">${placaLabel}</td>`;
                            isFirstPlacaRow = false;
                        }

                        if (isFirstFechaRow) {
                            html += `<td rowspan="${fechaSpan}" class="px-2 py-1 align-top text-slate-700 font-mono text-[10px] whitespace-nowrap border-r border-slate-200 bg-white">${fechaKey}</td>`;
                            isFirstFechaRow = false;
                        }

                        if (isFirstCliRow) {
                            html += `<td rowspan="${cliSpan}" class="px-2 py-1 align-top text-slate-700 truncate max-w-[70px] border-r border-slate-200 bg-white" title="${cliKey}">${cliKey}</td>`;
                            isFirstCliRow = false;
                        }

                        html += `<td class="px-1.5 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${r.coditem}</td>`;

                        html += `<td class="px-2 py-1 text-right font-mono min-w-[85px]">`;
                        if (hasMerma) {
                            html += `
                                <div class="flex items-center justify-end gap-1.5">
                                    <div class="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                        <div class="h-full rounded-full" style="width: ${barWidth}%; background-color: ${colorBar};"></div>
                                    </div>
                                    <span class="font-bold text-[10px] text-slate-900">${this.formatNum(r.porc_merma_peso, 2)}%</span>
                                </div>
                            `;
                        }
                        html += `</td></tr>`;
                    });
                });
            });
        });

        tbody.innerHTML = html;
    },

    renderTablaPorCodigo(lista) {
        const tbody = document.getElementById('tbody-por-codigo');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400 italic">Sin datos</td></tr>';
            return;
        }

        // Estructurar árbol: Placa -> CodItem -> Cliente -> Fechas
        const tree = {};
        lista.forEach(r => {
            const p = r.placa || '';
            const it = r.coditem || '';
            const c = r.cliente || '';
            if (!tree[p]) tree[p] = {};
            if (!tree[p][it]) tree[p][it] = {};
            if (!tree[p][it][c]) tree[p][it][c] = [];
            tree[p][it][c].push(r);
        });

        let html = '';
        Object.entries(tree).forEach(([placaKey, items]) => {
            let placaSpan = 0;
            Object.values(items).forEach(clis => {
                Object.values(clis).forEach(fechas => {
                    placaSpan += fechas.length;
                });
            });

            let isFirstPlacaRow = true;

            Object.entries(items).forEach(([itemKey, clis]) => {
                let itemSpan = 0;
                Object.values(clis).forEach(fechas => {
                    itemSpan += fechas.length;
                });

                let isFirstItemRow = true;

                Object.entries(clis).forEach(([cliKey, fechas]) => {
                    const cliSpan = fechas.length;
                    let isFirstCliRow = true;

                    fechas.forEach(r => {
                        const hasMerma = r.porc_merma_peso > 0;
                        const barWidth = Math.min(100, Math.max(6, r.porc_merma_peso * 10));
                        const colorBar = this.getColorForPercentage(r.porc_merma_peso);

                        html += `<tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">`;

                        if (isFirstPlacaRow) {
                            const placaLabel = placaKey !== '0' && placaKey !== '' ? placaKey : '';
                            html += `<td rowspan="${placaSpan}" class="px-2 py-1 align-top font-bold text-slate-900 border-r border-slate-200 bg-white">${placaLabel}</td>`;
                            isFirstPlacaRow = false;
                        }

                        if (isFirstItemRow) {
                            html += `<td rowspan="${itemSpan}" class="px-2 py-1 align-top text-center font-mono font-bold text-blue-700 border-r border-slate-200 bg-white">${itemKey}</td>`;
                            isFirstItemRow = false;
                        }

                        if (isFirstCliRow) {
                            html += `<td rowspan="${cliSpan}" class="px-2 py-1 align-top text-slate-700 truncate max-w-[70px] border-r border-slate-200 bg-white" title="${cliKey}">${cliKey}</td>`;
                            isFirstCliRow = false;
                        }

                        html += `<td class="px-1.5 py-1 text-slate-600 font-mono text-[10px] whitespace-nowrap border-r border-slate-100">${r.fecha}</td>`;

                        html += `<td class="px-2 py-1 text-right font-mono min-w-[85px]">`;
                        if (hasMerma) {
                            html += `
                                <div class="flex items-center justify-end gap-1.5">
                                    <div class="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                        <div class="h-full rounded-full" style="width: ${barWidth}%; background-color: ${colorBar};"></div>
                                    </div>
                                    <span class="font-bold text-[10px] text-slate-900">${this.formatNum(r.porc_merma_peso, 2)}%</span>
                                </div>
                            `;
                        }
                        html += `</td></tr>`;
                    });
                });
            });
        });

        tbody.innerHTML = html;
    },

    renderTablaPorCD(lista) {
        const tbody = document.getElementById('tbody-por-cd');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-400 italic">Sin datos</td></tr>';
            return;
        }

        // Estructurar árbol: Placa -> Cliente -> Fechas -> Items
        const tree = {};
        lista.forEach(r => {
            const p = r.placa || '';
            const c = r.cliente || '';
            const f = r.fecha || '';
            if (!tree[p]) tree[p] = {};
            if (!tree[p][c]) tree[p][c] = {};
            if (!tree[p][c][f]) tree[p][c][f] = [];
            tree[p][c][f].push(r);
        });

        let html = '';
        Object.entries(tree).forEach(([placaKey, clis]) => {
            let placaSpan = 0;
            Object.values(clis).forEach(fechas => {
                Object.values(fechas).forEach(items => {
                    placaSpan += items.length;
                });
            });

            let isFirstPlacaRow = true;

            Object.entries(clis).forEach(([cliKey, fechas]) => {
                let cliSpan = 0;
                Object.values(fechas).forEach(items => {
                    cliSpan += items.length;
                });

                let isFirstCliRow = true;

                Object.entries(fechas).forEach(([fechaKey, items]) => {
                    const fechaSpan = items.length;
                    let isFirstFechaRow = true;

                    items.forEach(r => {
                        const hasMerma = r.porc_merma_peso > 0;
                        const barWidth = Math.min(100, Math.max(6, r.porc_merma_peso * 10));
                        const colorBar = this.getColorForPercentage(r.porc_merma_peso);

                        html += `<tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">`;

                        if (isFirstPlacaRow) {
                            const placaLabel = placaKey !== '0' && placaKey !== '' ? placaKey : '';
                            html += `<td rowspan="${placaSpan}" class="px-2 py-1 align-top font-bold text-slate-900 border-r border-slate-200 bg-white">${placaLabel}</td>`;
                            isFirstPlacaRow = false;
                        }

                        if (isFirstCliRow) {
                            html += `<td rowspan="${cliSpan}" class="px-2 py-1 align-top text-slate-700 font-semibold truncate max-w-[70px] border-r border-slate-200 bg-white" title="${cliKey}">${cliKey}</td>`;
                            isFirstCliRow = false;
                        }

                        if (isFirstFechaRow) {
                            html += `<td rowspan="${fechaSpan}" class="px-2 py-1 align-top text-slate-600 font-mono text-[10px] whitespace-nowrap border-r border-slate-200 bg-white">${fechaKey}</td>`;
                            isFirstFechaRow = false;
                        }

                        html += `<td class="px-1.5 py-1 text-center font-mono text-slate-600 border-r border-slate-100">${r.coditem}</td>`;

                        html += `<td class="px-2 py-1 text-right font-mono min-w-[85px]">`;
                        if (hasMerma) {
                            html += `
                                <div class="flex items-center justify-end gap-1.5">
                                    <div class="w-8 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                        <div class="h-full rounded-full" style="width: ${barWidth}%; background-color: ${colorBar};"></div>
                                    </div>
                                    <span class="font-bold text-[10px] text-slate-900">${this.formatNum(r.porc_merma_peso, 2)}%</span>
                                </div>
                            `;
                        }
                        html += `</td></tr>`;
                    });
                });
            });
        });

        tbody.innerHTML = html;
    },

    /**
     * Paleta por umbrales para Mermas Por Fecha y Tablas
     */
    getColorForPercentage(porc) {
        if (porc === null || porc === undefined || isNaN(porc)) return '#94a3b8';
        const v = Number(porc);
        if (v >= 4.0) return '#ef4444'; // Rojo vibrante
        if (v >= 3.5) return '#f97316'; // Naranja
        if (v >= 3.0) return '#eab308'; // Amarillo
        if (v >= 2.5) return '#84cc16'; // Lima
        return '#10b981';                  // Verde
    },

    /**
     * Paleta divergente para Mermas Individuales Generales (Rojo -> Coral -> Naranja -> Gris -> Lima -> Verde)
     */
    getColorMermasIndiv(porc) {
        if (porc === null || porc === undefined || isNaN(porc) || porc <= 0) return '#94a3b8';
        const val = Number(porc);
        if (val >= 8.0) return '#991b1b'; // Rojo muy oscuro
        if (val >= 6.0) return '#dc2626'; // Rojo intenso
        if (val >= 4.5) return '#ef4444'; // Rojo coral
        if (val >= 3.8) return '#f97316'; // Naranja suave
        if (val >= 3.0) return '#94a3b8'; // Gris neutro (~3.5%)
        if (val >= 2.0) return '#84cc16'; // Verde lima
        return '#16a34a';                 // Verde bosque
    },

    formatInteger(val) {
        if (val === null || val === undefined || isNaN(val)) return '0';
        return Math.round(Number(val)).toLocaleString('es-PE', {
            maximumFractionDigits: 0
        });
    },

    formatNum(val, decimals = 2) {
        if (val === null || val === undefined || isNaN(val)) return '0,00';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    destroy() {
        const tt = document.getElementById('tooltip-tableau-costos');
        if (tt) {
            tt.classList.add('hidden');
            tt.style.display = 'none';
            tt.innerHTML = '';
        }
        if (this.chartMermasFecha) {
            this.chartMermasFecha.destroy();
            this.chartMermasFecha = null;
        }
        if (this.chartMermasIndiv) {
            this.chartMermasIndiv.destroy();
            this.chartMermasIndiv = null;
        }
    }
};

// Registrar en ChartRegistry
window.ChartRegistry['DashAnalisisPlacasGral'] = window.DashAnalisisPlacasGralChart;
