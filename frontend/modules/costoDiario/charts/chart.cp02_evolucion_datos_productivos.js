/**
 * Módulo para CP02 EvolucionDatosProductivos
 * - Superior: Tabla Matricial "Datos Productivos" (Total general + Días desglosados por Cencos y Galpón)
 *   * Tooltip flotante Tableau
 *   * Filtro cruzado interactivo al hacer clic en cualquier celda (toggle on/off)
 * - Inferior Izquierda: "Tendencia por Día" (Gráfica sincronizada multieje de 7 métricas clave)
 *   * Responde dinámicamente al filtro cruzado (muestra la fecha/registro seleccionado)
 * - Inferior Derecha: "Comparativo por Cencos Galpón" (Gráfica de barras por cada galpón y fecha)
 *   * Responde dinámicamente al filtro cruzado (muestra solo la columna seleccionada)
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP02 EvolucionDatosProductivos'] = {
    controller: null,
    datosDashboard: null,
    miniCharts: [],
    filtroCruzadoActivo: null, // { colIdx, dia, cencos, galpon, metricaKey }

    // Métricas y su configuración de colores según Tableau
    metricasConfig: [
        { key: 'pollos', label: 'Pollos Vendidos', color: '#1f4e79', yMax: 120000, isK: true, decimals: 0 },
        { key: 'kilos', label: 'Kilos Vendidos', color: '#4fa8d1', yMax: 350000, isK: true, decimals: 0 },
        { key: 'peso', label: 'Peso Prome Venta', color: '#7f7f7f', yMax: 3.5, isK: false, decimals: 3 },
        { key: 'ica', label: 'ICA', color: '#f28e2b', yMax: 2.0, isK: false, decimals: 3 },
        { key: 'edad', label: 'Prom Edad Venta', color: '#59a14f', yMax: 50, isK: false, decimals: 3 },
        { key: 'mort', label: '% Mort', color: '#8c8c00', yMax: 10, isK: false, decimals: 3 },
        { key: 'pgd', label: 'PGD', color: '#b58900', yMax: 0.1, isK: false, decimals: 3 }
    ],

    cencosNombres: {
        '627196': 'GRANJA HUACHO 1',
        '631137': 'GRANJA HUACHO 2',
        '630137': 'GRANJA HUACHO 3',
        '632137': 'GRANJA MOLLENDO 1',
        '643020': 'GRANJA MOLLENDO 2'
    },

    destroy() {
        this.destruirMiniCharts();
        this.hideTooltip();
    },

    destruirMiniCharts() {
        if (this.miniCharts && this.miniCharts.length > 0) {
            this.miniCharts.forEach(c => {
                try { c.destroy(); } catch (e) {}
            });
            this.miniCharts = [];
        }
    },

    showTooltip(e, data) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        let itemsHtml = '';
        if (data.cencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Cencos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${data.cencos}</span>
            `;
        }
        if (data.nomcencos) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Granja:</span>
                <span class="text-slate-900 font-semibold text-left">${data.nomcencos}</span>
            `;
        }
        if (data.galpon) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Galpón:</span>
                <span class="text-blue-700 font-bold text-left font-mono">${data.galpon}</span>
            `;
        }
        if (data.dia) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">Día de fecha:</span>
                <span class="text-slate-900 font-semibold text-left">${data.dia}</span>
            `;
        }
        if (data.metricaLabel) {
            itemsHtml += `
                <span class="text-slate-500 font-normal">${data.metricaLabel}:</span>
                <span class="font-bold text-left font-mono text-xs" style="color: ${data.color || '#1e293b'};">${data.valor}</span>
            `;
        }

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                ${itemsHtml}
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const tooltipWidth = tooltipEl.offsetWidth || 250;
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

    onCellHover(e, el) {
        const dia = el.getAttribute('data-dia');
        const cencos = el.getAttribute('data-cencos');
        const nomcencos = el.getAttribute('data-nomcencos') || this.cencosNombres[cencos] || `GRANJA ${cencos}`;
        const galpon = el.getAttribute('data-galpon');
        const metricaLabel = el.getAttribute('data-metrica');
        const valor = el.getAttribute('data-valor');
        const color = el.getAttribute('data-color');

        this.showTooltip(e, { dia, cencos, nomcencos, galpon, metricaLabel, valor, color });
    },

    onCellClick(el) {
        const colIdx = parseInt(el.getAttribute('data-col-idx'), 10);
        const dia = el.getAttribute('data-dia');
        const cencos = el.getAttribute('data-cencos');
        const galpon = el.getAttribute('data-galpon');
        const metricaKey = el.getAttribute('data-metrica-key');

        // Toggle: si hace clic en la misma celda, se desactiva el filtro cruzado
        if (
            this.filtroCruzadoActivo &&
            this.filtroCruzadoActivo.colIdx === colIdx &&
            this.filtroCruzadoActivo.metricaKey === metricaKey
        ) {
            this.filtroCruzadoActivo = null;
        } else {
            this.filtroCruzadoActivo = { colIdx, dia, cencos, galpon, metricaKey };
        }

        this.aplicarFiltroCruzado();
    },

    getData() {
        if (this.datosDashboard && this.datosDashboard.columnasTabla && this.datosDashboard.columnasTabla.length > 0) {
            return {
                totalGeneral: this.datosDashboard.totalGeneral,
                columnasTabla: this.datosDashboard.columnasTabla,
                columnasComparativo: this.datosDashboard.columnasComparativo || [...this.datosDashboard.columnasTabla].reverse(),
                datosTendencia: this.datosDashboard.datosTendencia
            };
        }
        return this.getMockData();
    },

    aplicarFiltroCruzado() {
        const dataSrc = this.getData();
        const allCells = document.querySelectorAll('#tabla-datos-productivos-cp02 .celda-matriz-dato');

        if (!this.filtroCruzadoActivo) {
            // Restaurar estado visual completo sin filtro
            allCells.forEach(td => {
                td.classList.remove('opacity-25', 'text-slate-300', 'bg-blue-100', 'ring-2', 'ring-blue-500', 'font-bold', 'text-blue-900');
                td.classList.add('text-slate-700');
            });

            // Restaurar gráficas inferiores con todos los datos
            this.renderMiniChartsTendencia(dataSrc.datosTendencia);
            const contBarras = document.getElementById('contenedor-comparativo-barras-cp02');
            if (contBarras) {
                contBarras.innerHTML = this.renderComparativoBarras(dataSrc.columnasComparativo || dataSrc.columnasTabla);
            }
            return;
        }

        // Aplicar atenuación / resaltado a las celdas de la tabla matriz
        const active = this.filtroCruzadoActivo;
        allCells.forEach(td => {
            const cIdx = parseInt(td.getAttribute('data-col-idx'), 10);
            const mKey = td.getAttribute('data-metrica-key');

            if (cIdx === active.colIdx && mKey === active.metricaKey) {
                td.classList.remove('opacity-25', 'text-slate-300', 'text-slate-700');
                td.classList.add('bg-blue-100', 'ring-2', 'ring-blue-500', 'font-bold', 'text-blue-900');
            } else {
                td.classList.remove('bg-blue-100', 'ring-2', 'ring-blue-500', 'font-bold', 'text-blue-900', 'text-slate-700');
                td.classList.add('opacity-25', 'text-slate-300');
            }
        });

        // Filtrar datos para Tendencia por Día (solo el punto seleccionado)
        const selectedCol = dataSrc.columnasTabla[active.colIdx];
        if (selectedCol) {
            const fechaCorta = selectedCol.dia.split(', ')[1];
            const filteredTendencia = {
                fechas: [fechaCorta],
                pollos: [parseFloat(String(selectedCol.pollos).replace(/\./g, '').replace(',', '.'))],
                kilos: [parseFloat(String(selectedCol.kilos).replace(/\./g, '').replace(',', '.'))],
                peso: [parseFloat(String(selectedCol.peso).replace(/\./g, '').replace(',', '.'))],
                ica: [parseFloat(String(selectedCol.ica).replace(/\./g, '').replace(',', '.'))],
                edad: [parseFloat(String(selectedCol.edad).replace(/\./g, '').replace(',', '.'))],
                mort: [parseFloat(String(selectedCol.mort).replace(/\./g, '').replace(',', '.'))],
                pgd: [parseFloat(String(selectedCol.pgd).replace(/\./g, '').replace(',', '.'))],
                // Textos originales para datalabels exactos
                rawLabels: {
                    pollos: selectedCol.pollos,
                    kilos: selectedCol.kilos,
                    peso: selectedCol.peso,
                    ica: selectedCol.ica,
                    edad: selectedCol.edad,
                    mort: selectedCol.mort,
                    pgd: selectedCol.pgd
                }
            };

            this.renderMiniChartsTendencia(filteredTendencia, true);

            // Filtrar Comparativo por Cencos Galpon (solo la columna seleccionada)
            const contBarras = document.getElementById('contenedor-comparativo-barras-cp02');
            if (contBarras) {
                contBarras.innerHTML = this.renderComparativoBarras([selectedCol]);
            }
        }
    },

    render(controller, data) {
        this.controller = controller;
        this.datosDashboard = data || {};
        this.filtroCruzadoActivo = null;

        // 1. Título principal
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'CP02 Evolución Datos Productivos';

        // 2. Ocultar filtro de clasificación de CP01
        const contFiltroClasif = document.getElementById('contenedor-filtro-clasificacion-cp01');
        if (contFiltroClasif) contFiltroClasif.classList.add('hidden');

        // 3. Ocultar tarjeta de tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // 4. Renderizar Maqueta / Diseño completo
        this.renderLayout();
    },

    // Datos hardcodeados / quemados fieles a tableu.png para validar diseño y layout
    getMockData() {
        const rawCols = [
            { dia: 'miércoles, 2024/04/24', cencos: '627196', galpon: '2', pollos: '35.597', kilos: '100.586', peso: '2,826', ica: '1,549', edad: '42,582', mort: '4,507', pgd: '0,066' },
            { dia: 'miércoles, 2024/04/24', cencos: '631137', galpon: '3', pollos: '35.765', kilos: '98.521', peso: '2,755', ica: '1,588', edad: '44,283', mort: '4,636', pgd: '0,062' },
            { dia: 'miércoles, 2024/04/24', cencos: '631137', galpon: '4', pollos: '36.522', kilos: '99.821', peso: '2,733', ica: '1,616', edad: '44,447', mort: '4,550', pgd: '0,061' },
            { dia: 'martes, 2024/04/23', cencos: '627196', galpon: '1', pollos: '36.694', kilos: '99.943', peso: '2,724', ica: '1,527', edad: '41,661', mort: '3,767', pgd: '0,065' },
            { dia: 'martes, 2024/04/23', cencos: '631137', galpon: '2', pollos: '36.436', kilos: '102.241', peso: '2,806', ica: '1,610', edad: '45,379', mort: '4,832', pgd: '0,062' },
            { dia: 'lunes, 2024/04/22', cencos: '631137', galpon: '1', pollos: '36.261', kilos: '101.563', peso: '2,801', ica: '1,552', edad: '43,972', mort: '4,526', pgd: '0,064' },
            { dia: 'domingo, 2024/04/21', cencos: '630137', galpon: '4', pollos: '34.193', kilos: '95.126', peso: '2,782', ica: '1,554', edad: '43,654', mort: '3,473', pgd: '0,064' },
            { dia: 'sábado, 2024/04/20', cencos: '630137', galpon: '2', pollos: '37.478', kilos: '102.590', peso: '2,737', ica: '1,572', edad: '43,591', mort: '2,707', pgd: '0,063' },
            { dia: 'sábado, 2024/04/20', cencos: '630137', galpon: '3', pollos: '36.792', kilos: '99.590', peso: '2,707', ica: '1,564', edad: '42,798', mort: '3,421', pgd: '0,063' },
            { dia: 'viernes, 2024/04/19', cencos: '630137', galpon: '1', pollos: '36.234', kilos: '97.299', peso: '2,685', ica: '1,562', edad: '43,120', mort: '3,606', pgd: '0,062' },
            { dia: 'viernes, 2024/04/19', cencos: '632137', galpon: '4', pollos: '36.620', kilos: '96.580', peso: '2,637', ica: '1,581', edad: '43,251', mort: '5,156', pgd: '0,061' },
            { dia: 'jueves, 2024/04/18', cencos: '632137', galpon: '2', pollos: '35.015', kilos: '97.058', peso: '2,772', ica: '1,533', edad: '42,905', mort: '5,042', pgd: '0,065' },
            { dia: 'jueves, 2024/04/18', cencos: '632137', galpon: '3', pollos: '35.735', kilos: '93.806', peso: '2,625', ica: '1,558', edad: '43,122', mort: '7,807', pgd: '0,061' },
            { dia: 'miércoles, 2024/04/17', cencos: '632137', galpon: '1', pollos: '35.643', kilos: '100.366', peso: '2,816', ica: '1,525', edad: '42,625', mort: '4,301', pgd: '0,066' },
            { dia: 'miércoles, 2024/04/17', cencos: '643020', galpon: '11', pollos: '24.373', kilos: '65.078', peso: '2,670', ica: '1,577', edad: '43,219', mort: '4,192', pgd: '0,062' },
            { dia: 'martes, 2024/04/16', cencos: '643020', galpon: '9', pollos: '24.040', kilos: '60.711', peso: '2,525', ica: '1,628', edad: '43,847', mort: '5,180', pgd: '0,058' },
            { dia: 'martes, 2024/04/16', cencos: '643020', galpon: '10', pollos: '23.744', kilos: '60.248', peso: '2,537', ica: '1,631', edad: '42,658', mort: '5,630', pgd: '0,059' },
            { dia: 'lunes, 2024/04/15', cencos: '643020', galpon: '4', pollos: '24.431', kilos: '65.042', peso: '2,662', ica: '1,601', edad: '44,360', mort: '5,031', pgd: '0,060' },
            { dia: 'lunes, 2024/04/15', cencos: '643020', galpon: '7', pollos: '24.349', kilos: '61.391', peso: '2,521', ica: '1,559', edad: '42,443', mort: '4,177', pgd: '0,060' },
            { dia: 'lunes, 2024/04/15', cencos: '643020', galpon: '8', pollos: '24.488', kilos: '64.494', peso: '2,634', ica: '1,556', edad: '43,052', mort: '3,575', pgd: '0,061' },
            { dia: 'domingo, 2024/04/14', cencos: '643020', galpon: '3', pollos: '23.863', kilos: '63.663', peso: '2,668', ica: '1,585', edad: '44,019', mort: '4,786', pgd: '0,061' },
            { dia: 'domingo, 2024/04/14', cencos: '643020', galpon: '5', pollos: '24.593', kilos: '69.490', peso: '2,826', ica: '1,561', edad: '44,092', mort: '4,611', pgd: '0,064' }
        ];

        const columnasTabla = rawCols.map(c => ({
            ...c,
            nomcencos: this.cencosNombres[c.cencos] || `GRANJA ${c.cencos}`
        }));

        // Fechas para la gráfica de tendencia (24 días de abril)
        const fechasTendencia = [];
        for (let i = 1; i <= 24; i++) {
            fechasTendencia.push(`2024/04/${String(i).padStart(2, '0')}`);
        }

        const datosTendencia = {
            fechas: fechasTendencia,
            pollos: [48683, 73698, 49815, 74436, 70523, 70978, 36101, 73345, 33468, 71836, 71752, 108930, 48353, 72894, 73268, 47784, 60016, 70750, 72854, 74270, 34193, 73130, 107884, 107884],
            kilos: [126410, 192952, 129961, 191569, 195941, 199967, 97175, 209112, 99700, 207586, 198343, 304692, 200024, 190928, 193879, 120959, 165444, 190864, 193879, 202180, 95126, 202184, 298928, 298928],
            peso: [2.597, 2.618, 2.609, 2.574, 2.778, 2.817, 2.692, 2.851, 2.979, 2.890, 2.764, 2.797, 2.676, 2.744, 2.606, 2.531, 2.757, 2.698, 2.661, 2.722, 2.782, 2.801, 2.765, 2.771],
            ica: [1.580, 1.553, 1.537, 1.567, 1.559, 1.595, 1.600, 1.556, 1.615, 1.568, 1.565, 1.570, 1.558, 1.574, 1.572, 1.630, 1.545, 1.545, 1.572, 1.568, 1.554, 1.552, 1.569, 1.584],
            edad: [41.933, 41.863, 42.289, 43.156, 42.360, 43.447, 43.929, 43.935, 44.132, 43.532, 43.268, 43.498, 44.395, 43.194, 43.286, 43.256, 42.625, 43.219, 43.186, 43.198, 43.654, 43.514, 43.514, 43.514],
            mort: [3.482, 4.052, 2.676, 2.839, 4.474, 4.840, 5.728, 4.286, 4.689, 3.708, 3.716, 4.145, 3.922, 4.920, 4.265, 5.405, 4.257, 4.391, 6.461, 3.063, 3.473, 4.526, 4.300, 4.564],
            pgd: [0.062, 0.062, 0.062, 0.061, 0.065, 0.065, 0.061, 0.065, 0.068, 0.066, 0.064, 0.064, 0.062, 0.062, 0.060, 0.059, 0.064, 0.063, 0.062, 0.063, 0.064, 0.064, 0.063, 0.063]
        };

        return {
            totalGeneral: { pollos: '1.555.222', kilos: '4.244.871', peso: '2,729', ica: '1,569', edad: '43,226', mort: '4,251', pgd: '0,063' },
            columnasTabla,
            columnasComparativo: [...columnasTabla].reverse(),
            datosTendencia
        };
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const dataSrc = this.getData();

        contenedorGrafica.className = "flex flex-col w-full p-2 gap-4 bg-slate-50/50";
        contenedorGrafica.innerHTML = `
            <!-- 1. SECCIÓN SUPERIOR: TABLA MATRICIAL "DATOS PRODUCTIVOS" -->
            <div class="w-full bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden flex flex-col">
                <div class="flex items-center justify-between px-4 py-2 bg-slate-100/90 border-b border-slate-300">
                    <div>
                        <h2 class="text-sm font-bold text-slate-900 tracking-tight">Datos Productivos</h2>
                        <span class="text-[11px] text-slate-500 font-medium">Día de fecha / cencos / galpon (Haz clic en una celda para filtro cruzado)</span>
                    </div>

                    <!-- LEYENDA FLOTANTE DE MEDIDAS -->
                    <div class="flex flex-wrap items-center gap-2 text-[10px] bg-white px-2.5 py-1 rounded-md border border-slate-200">
                        <span class="font-bold text-slate-600 mr-1">Nombres de medidas:</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #1f4e79;"></span> Pollos Vendidos</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #4fa8d1;"></span> Kilos Vendidos</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #7f7f7f;"></span> Peso Prome Venta</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #f28e2b;"></span> ICA</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #59a14f;"></span> Prom Edad Venta</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #8c8c00;"></span> % Mort</span>
                        <span class="flex items-center gap-1 font-semibold text-slate-700"><span class="w-2.5 h-2.5 rounded-xs" style="background-color: #b58900;"></span> PGD</span>
                    </div>
                </div>

                <!-- CONTENEDOR DE LA TABLA MATRICIAL SCROLLABLE -->
                <div class="overflow-x-auto overflow-y-auto max-h-[360px] custom-scrollbar">
                    <table id="tabla-datos-productivos-cp02" class="text-[11px] border-collapse font-sans min-w-full select-none">
                        <thead class="sticky top-0 z-20 bg-slate-100 text-slate-800 border-b border-slate-300">
                            <!-- Nivel 1: Días -->
                            <tr class="border-b border-slate-200">
                                <th rowspan="3" class="px-3 py-2 text-left bg-slate-200/90 font-bold border-r border-slate-300 min-w-[130px] sticky left-0 z-30">Métrica</th>
                                <th rowspan="3" class="px-3 py-2 text-right bg-slate-100 font-bold border-r-2 border-slate-400 min-w-[100px]">Total general</th>
                                ${this.renderHeaderDias(dataSrc.columnasTabla)}
                            </tr>
                            <!-- Nivel 2: Cencos -->
                            <tr class="border-b border-slate-200">
                                ${this.renderHeaderCencos(dataSrc.columnasTabla)}
                            </tr>
                            <!-- Nivel 3: Galpón -->
                            <tr>
                                ${this.renderHeaderGalpones(dataSrc.columnasTabla)}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 bg-white">
                            ${this.renderBodyMatriz(dataSrc)}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 2. SECCIÓN INFERIOR: TENDENCIA POR DÍA + COMPARATIVO POR CENCOS GALPÓN -->
            <div class="flex flex-col xl:flex-row items-stretch gap-4 w-full">
                
                <!-- 2.1 TENDENCIA POR DÍA (IZQUIERDA ~50%) -->
                <div class="w-full xl:w-[50%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex flex-col px-4 py-2 bg-slate-100/80 border-b border-slate-300">
                        <h2 class="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Tendencia por Día</h2>
                        <span class="text-[11px] text-slate-500 font-medium">Día de fecha</span>
                    </div>

                    <!-- Gráficas de Líneas Apiladas por Métrica -->
                    <div id="contenedor-tendencia-filas-cp02" class="flex-1 p-3 flex flex-col gap-2 overflow-y-auto max-h-[560px] custom-scrollbar">
                        ${this.renderRowsTendencia(dataSrc.datosTendencia)}
                    </div>
                </div>

                <!-- 2.2 COMPARATIVO POR CENCOS GALPÓN (DERECHA ~50%) -->
                <div class="w-full xl:w-[50%] flex flex-col bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    <div class="flex flex-col px-4 py-2 bg-slate-100/80 border-b border-slate-300">
                        <h2 class="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">Comparativo por Cencos Galpon</h2>
                        <span class="text-[11px] text-slate-500 font-medium">Desglose gráfico por Galpón y Fecha</span>
                    </div>

                    <!-- Tabla de Barras Verticales por Galpón -->
                    <div id="contenedor-comparativo-barras-cp02" class="flex-1 overflow-x-auto overflow-y-auto max-h-[560px] custom-scrollbar p-2">
                        ${this.renderComparativoBarras(dataSrc.columnasComparativo || dataSrc.columnasTabla)}
                    </div>
                </div>

            </div>
        `;

        // Renderizar mini-charts de tendencia después de inyectar el HTML
        this.renderMiniChartsTendencia(dataSrc.datosTendencia);
    },

    renderHeaderDias(columnas) {
        // Agrupar columnas por día
        const diasMap = {};
        columnas.forEach(c => {
            diasMap[c.dia] = (diasMap[c.dia] || 0) + 1;
        });

        let html = '';
        Object.keys(diasMap).forEach(dia => {
            html += `<th colspan="${diasMap[dia]}" class="px-2 py-1 text-center font-bold text-slate-800 border-r border-slate-300 bg-slate-50 truncate">${dia}</th>`;
        });
        return html;
    },

    renderHeaderCencos(columnas) {
        // Agrupar por cencos dentro de cada día
        const cencosGrupos = [];
        let curDia = null;
        let curCencos = null;
        let count = 0;

        columnas.forEach(c => {
            if (c.dia === curDia && c.cencos === curCencos) {
                count++;
            } else {
                if (curCencos !== null) {
                    cencosGrupos.push({ dia: curDia, cencos: curCencos, span: count });
                }
                curDia = c.dia;
                curCencos = c.cencos;
                count = 1;
            }
        });
        if (curCencos !== null) {
            cencosGrupos.push({ dia: curDia, cencos: curCencos, span: count });
        }

        let html = '';
        cencosGrupos.forEach(g => {
            html += `<th colspan="${g.span}" class="px-2 py-0.5 text-center font-mono font-semibold text-slate-700 border-r border-slate-200 bg-slate-100/60">${g.cencos}</th>`;
        });
        return html;
    },

    renderHeaderGalpones(columnas) {
        let html = '';
        columnas.forEach(c => {
            html += `<th class="px-2 py-0.5 text-center font-mono font-bold text-blue-700 border-r border-slate-200 min-w-[55px] bg-slate-50">${c.galpon}</th>`;
        });
        return html;
    },

    renderBodyMatriz(dataMock) {
        const rows = [
            { key: 'pollos', label: 'Pollos Vendidos', total: dataMock.totalGeneral.pollos, color: '#1f4e79' },
            { key: 'kilos', label: 'Kilos Vendidos', total: dataMock.totalGeneral.kilos, color: '#4fa8d1' },
            { key: 'peso', label: 'Peso Prome Venta', total: dataMock.totalGeneral.peso, color: '#7f7f7f' },
            { key: 'ica', label: 'ICA', total: dataMock.totalGeneral.ica, color: '#f28e2b' },
            { key: 'edad', label: 'Prom Edad Venta', total: dataMock.totalGeneral.edad, color: '#59a14f' },
            { key: 'mort', label: '% Mort', total: dataMock.totalGeneral.mort, color: '#8c8c00' },
            { key: 'pgd', label: 'PGD', total: dataMock.totalGeneral.pgd, color: '#b58900' }
        ];

        let html = '';
        rows.forEach(r => {
            html += `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="px-3 py-1 text-left font-semibold text-slate-800 border-r border-slate-300 sticky left-0 z-10 bg-white truncate flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${r.color};"></span>
                        <span>${r.label}</span>
                    </td>
                    <td class="px-2.5 py-1 text-right font-mono font-bold text-slate-900 border-r-2 border-slate-400 bg-slate-50/50">${r.total}</td>
                    ${dataMock.columnasTabla.map((col, cIdx) => `
                        <td class="celda-matriz-dato px-2 py-1 text-right font-mono text-slate-700 border-r border-slate-100 cursor-pointer hover:bg-blue-50/80 transition-all"
                            data-col-idx="${cIdx}"
                            data-dia="${col.dia}"
                            data-cencos="${col.cencos}"
                            data-nomcencos="${col.nomcencos}"
                            data-galpon="${col.galpon}"
                            data-metrica="${r.label}"
                            data-metrica-key="${r.key}"
                            data-valor="${col[r.key]}"
                            data-color="${r.color}"
                            onclick="window.ChartRegistry['CP02 EvolucionDatosProductivos'].onCellClick(this)"
                            onmousemove="window.ChartRegistry['CP02 EvolucionDatosProductivos'].onCellHover(event, this)"
                            onmouseleave="window.ChartRegistry['CP02 EvolucionDatosProductivos'].hideTooltip()">
                            ${col[r.key]}
                        </td>
                    `).join('')}
                </tr>
            `;
        });
        return html;
    },

    renderRowsTendencia(datosTendencia) {
        const rows = [
            { id: 'mini-chart-pollos', label: 'Pollos Vendidos', yTitle: '0K - 100K' },
            { id: 'mini-chart-kilos', label: 'Kilos Vendidos', yTitle: '100K - 300K' },
            { id: 'mini-chart-peso', label: 'Peso Prome Venta', yTitle: '0 - 2' },
            { id: 'mini-chart-ica', label: 'ICA', yTitle: '0 - 1' },
            { id: 'mini-chart-edad', label: 'Prom Edad Venta', yTitle: '0 - 40' },
            { id: 'mini-chart-mort', label: '% Mort', yTitle: '0 - 5' },
            { id: 'mini-chart-pgd', label: 'PGD', yTitle: '0,0 - 0,1', isLast: true }
        ];

        let html = '';
        rows.forEach((r, idx) => {
            html += `
                <div class="flex items-center w-full border-b border-slate-200 pb-1.5">
                    <div class="w-[120px] shrink-0 text-left pr-2 flex flex-col justify-center">
                        <span class="text-[10px] font-bold text-slate-800 leading-tight">${r.label}</span>
                        <span class="text-[9px] text-slate-400 font-mono">Valor</span>
                    </div>
                    <div class="flex-1 relative ${r.isLast ? 'h-[75px]' : 'h-[55px]'}">
                        <canvas id="${r.id}"></canvas>
                    </div>
                </div>
            `;
        });
        return html;
    },

    renderMiniChartsTendencia(datosTendencia, isFiltered = false) {
        this.destruirMiniCharts();

        const labels = isFiltered ? datosTendencia.fechas : datosTendencia.fechas.map(f => f.replace('2024/', ''));

        const configs = [
            { id: 'mini-chart-pollos', key: 'pollos', label: 'Pollos Vendidos', data: datosTendencia.pollos, color: '#1f4e79', isK: true, decimals: 0, isLast: false },
            { id: 'mini-chart-kilos', key: 'kilos', label: 'Kilos Vendidos', data: datosTendencia.kilos, color: '#4fa8d1', isK: true, decimals: 0, isLast: false },
            { id: 'mini-chart-peso', key: 'peso', label: 'Peso Prome Venta', data: datosTendencia.peso, color: '#7f7f7f', isK: false, decimals: 3, isLast: false },
            { id: 'mini-chart-ica', key: 'ica', label: 'ICA', data: datosTendencia.ica, color: '#f28e2b', isK: false, decimals: 3, isLast: false },
            { id: 'mini-chart-edad', key: 'edad', label: 'Prom Edad Venta', data: datosTendencia.edad, color: '#59a14f', isK: false, decimals: 3, isLast: false },
            { id: 'mini-chart-mort', key: 'mort', label: '% Mort', data: datosTendencia.mort, color: '#8c8c00', isK: false, decimals: 3, isLast: false },
            { id: 'mini-chart-pgd', key: 'pgd', label: 'PGD', data: datosTendencia.pgd, color: '#b58900', isK: false, decimals: 3, isLast: true }
        ];

        const self = this;

        configs.forEach(cfg => {
            const canvas = document.getElementById(cfg.id);
            if (!canvas) return;

            const ch = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: cfg.label,
                        data: cfg.data,
                        borderColor: cfg.color,
                        backgroundColor: cfg.color,
                        pointBackgroundColor: cfg.color,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: isFiltered ? 5 : 3,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                    layout: { padding: { top: 16, bottom: cfg.isLast ? 2 : 2, left: 5, right: 5 } },
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
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
                                    const idx = dataPoint.dataIndex;
                                    const fecha = datosTendencia.fechas[idx];
                                    const val = dataPoint.raw;
                                    const valStr = cfg.isK ? Number(val).toLocaleString('es-PE') : Number(val).toFixed(cfg.decimals).replace('.', ',');
                                    
                                    const pos = context.chart.canvas.getBoundingClientRect();
                                    const fakeEvent = {
                                        clientX: pos.left + tooltipModel.caretX,
                                        clientY: pos.top + tooltipModel.caretY
                                    };

                                    self.showTooltip(fakeEvent, {
                                        dia: fecha,
                                        metricaLabel: cfg.label,
                                        valor: valStr,
                                        color: cfg.color
                                    });
                                }
                            }
                        },
                        datalabels: {
                            display: true,
                            align: 'top',
                            offset: 3,
                            font: { size: isFiltered ? 9.5 : 8.5, weight: 'bold', family: 'system-ui, -apple-system, sans-serif' },
                            color: '#1e293b',
                            formatter: (v, ctx) => {
                                if (isFiltered) {
                                    return (datosTendencia.rawLabels && datosTendencia.rawLabels[cfg.key]) || (cfg.isK ? Number(v).toLocaleString('es-PE') : Number(v).toFixed(cfg.decimals).replace('.', ','));
                                }
                                if (ctx.dataIndex % 2 === 0 || ctx.dataIndex === cfg.data.length - 1) {
                                    return cfg.isK ? `${Math.round(v / 1000)}K` : Number(v).toFixed(cfg.decimals).replace('.', ',');
                                }
                                return '';
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: true, color: '#f8fafc' },
                            ticks: {
                                display: cfg.isLast,
                                maxRotation: 90,
                                minRotation: 90,
                                font: { size: isFiltered ? 9 : 8.5, weight: '500', family: 'system-ui, -apple-system, sans-serif' },
                                color: '#475569'
                            }
                        },
                        y: {
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                font: { size: 8.5, family: 'system-ui, -apple-system, sans-serif' },
                                callback: (v) => cfg.isK ? `${(v/1000).toFixed(0)}K` : Number(v).toFixed(1).replace('.', ',')
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.miniCharts.push(ch);
        });
    },

    renderComparativoBarras(columnas) {
        // Renderizar tabla visual con mini barras verticales por cada columna
        const rows = [
            { key: 'pollos', label: 'Pollos Vendidos', color: '#1f4e79', max: 40000 },
            { key: 'kilos', label: 'Kilos Vendidos', color: '#4fa8d1', max: 110000 },
            { key: 'peso', label: 'Peso Prome Venta', color: '#7f7f7f', max: 3.2 },
            { key: 'ica', label: 'ICA', color: '#f28e2b', max: 2.0 },
            { key: 'edad', label: 'Prom Edad Venta', color: '#59a14f', max: 50 },
            { key: 'mort', label: '% Mort', color: '#8c8c00', max: 10 },
            { key: 'pgd', label: 'PGD', color: '#b58900', max: 0.1 }
        ];

        let html = `
            <table class="w-full text-[10px] border-collapse font-sans min-w-[300px]">
                <thead class="sticky top-0 z-20 bg-slate-100 border-b border-slate-300">
                    <tr>
                        <th class="px-2 py-1 text-left bg-slate-200 font-bold border-r border-slate-300 min-w-[110px] sticky left-0 z-30">Métrica</th>
                        ${columnas.map(c => `
                            <th class="px-1 py-1 text-center font-mono text-[9px] border-r border-slate-200 bg-slate-50 min-w-[48px]">
                                <span class="block text-slate-500 font-normal transform -rotate-90 origin-center my-4">${c.dia.split(', ')[1]}</span>
                                <span class="block text-blue-700 font-bold">${c.galpon}</span>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
        `;

        rows.forEach(r => {
            html += `
                <tr class="hover:bg-slate-50/80">
                    <td class="px-2 py-2 text-left font-bold text-slate-800 border-r border-slate-300 sticky left-0 z-10 bg-white truncate">
                        <span class="block text-[10px] leading-tight">${r.label}</span>
                        <span class="block text-[8px] text-slate-400 font-normal">Valor</span>
                    </td>
                    ${columnas.map(col => {
                        const rawVal = parseFloat(col[r.key].replace(/\./g, '').replace(',', '.'));
                        const pct = Math.min(100, Math.max(10, (rawVal / r.max) * 100));
                        return `
                            <td class="px-0.5 py-1 text-center border-r border-slate-100 align-bottom h-[60px] cursor-pointer hover:bg-blue-50/50 transition-colors"
                                data-dia="${col.dia}"
                                data-cencos="${col.cencos}"
                                data-nomcencos="${col.nomcencos}"
                                data-galpon="${col.galpon}"
                                data-metrica="${r.label}"
                                data-valor="${col[r.key]}"
                                data-color="${r.color}"
                                onmousemove="window.ChartRegistry['CP02 EvolucionDatosProductivos'].onCellHover(event, this)"
                                onmouseleave="window.ChartRegistry['CP02 EvolucionDatosProductivos'].hideTooltip()">
                                <div class="flex flex-col items-center justify-end h-full w-full pointer-events-none">
                                    <span class="text-[8px] font-mono text-slate-700 font-semibold mb-0.5">${col[r.key]}</span>
                                    <div class="w-full max-w-[28px] rounded-t-xs transition-all" style="height: ${pct}%; background-color: ${r.color};"></div>
                                </div>
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    }
};
