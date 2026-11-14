/**
 * Módulo para CA01 CostoFormulaPorTipoAlimento (CA01 CostoFormulaPorTipoAA...)
 * - Superior: Gráfico de Línea "Costo Formula Alimento General"
 *   * Scroll horizontal independiente
 *   * Eje Y: PU con escala dinámica
 *   * Colores Tableau: Verde (#59a14f) para PU < 1.6115 y Rojo (#e15759) para PU >= 1.6115
 *   * Interacción de Filtro Cruzado al hacer clic en cualquier punto del gráfico de línea
 * - Inferior: Gráfico de Barras "Detalle de Tipo de Alimento"
 *   * Modo Normal: Paneles continuos para cada fórmula/alimento (Small Multiples)
 *   * Modo Filtro Cruzado: Vista agrupada por Tipo de Alimento y Fórmula para el día seleccionado con cabeceras a 2 niveles
 *   * Ancho de barras unificado y constante (barThickness: 34px) para perfecta armonía visual
 *   * Eje Y: PU (0 a 2.5 en filtro cruzado / 0 a 5 en modo general)
 *   * Barras coloreadas según el catálogo Tableau (NULL: #f8a35b, 24 ACABADO 2: #f28e2b, etc.)
 * - Leyenda interactiva de tipos de alimento al pie
 */
window.ChartRegistry = window.ChartRegistry || {};

const CA01_DEFINITION = {
    controller: null,
    datosDashboard: null,
    chartGeneral: null,
    detalleCharts: [],
    fechasSeleccionadas: [], // Fechas activas en filtro cruzado
    ultimoIndiceSeleccionado: null,

    // Paleta de colores exacta de Tableau
    coloresTipo: {
        'NULL': '#f8a35b',            // Durazno / Naranja suave de Tableau
        '21 PRE INICIO': '#86bcb6',    // Celeste claro / Cian Tableau
        '22 INICIO': '#4e79a7',        // Azul Tableau
        '23 ACABADO 1': '#e15759',     // Rojo / Coral Tableau
        '24 ACABADO 2': '#f28e2b',     // Naranja Tableau
        '25 TERMINADOR': '#b07aa1',    // Malva / Mostaza Tableau
        '26 FINALIZADOR': '#59a14f',   // Verde Tableau
        '26 FINALIZADOR 1': '#8cd17d', // Verde claro Tableau
        '27 FINALIZADOR 2': '#499894'  // Verde azulado / Teal Tableau
    },

    destroy() {
        if (this.chartGeneral) {
            this.chartGeneral.destroy();
            this.chartGeneral = null;
        }
        this.destroyDetalleCharts();
    },

    destroyDetalleCharts() {
        if (this.detalleCharts && this.detalleCharts.length > 0) {
            this.detalleCharts.forEach(c => {
                if (c && typeof c.destroy === 'function') c.destroy();
            });
            this.detalleCharts = [];
        }
    },

    formatDecimal(val, decimals = 3) {
        if (val === null || val === undefined || isNaN(val)) return '-';
        return Number(val).toLocaleString('es-PE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    render(controller, data) {
        this.controller = controller;

        // 1. Ocultar cabecera externa redundante
        const headerPrincipal = document.getElementById('card-header-grafica-principal');
        if (headerPrincipal) headerPrincipal.classList.add('hidden');

        // 2. Ocultar tarjeta de tabla estándar
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        this.datosDashboard = data || {};
        this.fechasSeleccionadas = []; // Reiniciar filtro cruzado al cargar
        this.ultimoIndiceSeleccionado = null;

        // Construir la estructura DOM del dashboard
        this.renderLayout();
    },

    renderLayout() {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const puntosGeneral = this.datosDashboard.puntos_general || [];
        const minWidthGeneral = Math.max(1200, puntosGeneral.length * 52);

        contenedorGrafica.className = "flex flex-col w-full p-2 bg-slate-50/50 gap-6";
        contenedorGrafica.innerHTML = `
            <!-- CONTENEDOR GENERAL DE LAS 2 TARJETAS APILADAS -->
            <div class="w-full flex flex-col gap-6">
                
                <!-- 1. TARJETA SUPERIOR: COSTO FORMULA ALIMENTO GENERAL -->
                <div class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <!-- Cabecera -->
                    <div class="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <div class="flex items-center gap-2">
                            <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Costo Formula Alimento General</h2>
                        </div>
                        <span class="text-xs text-slate-500 font-medium">${puntosGeneral.length} días registrados</span>
                    </div>

                    <!-- Contenedor con Scroll Horizontal Independiente -->
                    <div class="w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-white p-3">
                        <div style="min-width: ${minWidthGeneral}px; height: 300px;" class="relative">
                            <canvas id="canvas-ca01-general"></canvas>
                        </div>
                    </div>
                </div>

                <!-- 2. TARJETA INFERIOR: DETALLE DE TIPO DE ALIMENTO -->
                <div id="card-detalle-tipo-alimento" class="w-full flex flex-col bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden">
                    <!-- Cabecera dinámica -->
                    <div id="cabecera-detalle-alimento" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <!-- Renderizado dinámico -->
                    </div>

                    <!-- Contenedor de Gráficas de Detalle (General o Filtro Cruzado) -->
                    <div id="contenedor-body-detalle" class="w-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-white p-4">
                        <!-- Renderizado dinámico -->
                    </div>

                    <!-- 3. LEYENDA INTERACTIVA INFERIOR (TIPO) FIEL A TABLEAU -->
                    <div class="w-full bg-slate-50/90 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                        <span class="font-bold text-slate-700 uppercase tracking-wider text-[11px]">tipo</span>
                        
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['NULL']};"></span>
                            <span class="text-slate-600 text-[11px]">NULL</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['21 PRE INICIO']};"></span>
                            <span class="text-slate-600 text-[11px]">21 PRE INICIO</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['22 INICIO']};"></span>
                            <span class="text-slate-600 text-[11px]">22 INICIO</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['23 ACABADO 1']};"></span>
                            <span class="text-slate-600 text-[11px]">23 ACABADO 1</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['24 ACABADO 2']};"></span>
                            <span class="text-slate-600 text-[11px]">24 ACABADO 2</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['25 TERMINADOR']};"></span>
                            <span class="text-slate-600 text-[11px]">25 TERMINADOR</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['26 FINALIZADOR']};"></span>
                            <span class="text-slate-600 text-[11px]">26 FINALIZADOR</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['26 FINALIZADOR 1']};"></span>
                            <span class="text-slate-600 text-[11px]">26 FINALIZADOR 1</span>
                        </div>
                        <div class="flex items-center gap-1.5 cursor-default select-none">
                            <span class="w-3.5 h-3.5 rounded-xs" style="background-color: ${this.coloresTipo['27 FINALIZADOR 2']};"></span>
                            <span class="text-slate-600 text-[11px]">27 FINALIZADOR 2</span>
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.renderChartGeneral();
        this.renderDetalleSection();
    },

    renderChartGeneral() {
        const canvas = document.getElementById('canvas-ca01-general');
        if (!canvas) return;

        if (this.chartGeneral) {
            this.chartGeneral.destroy();
            this.chartGeneral = null;
        }

        const puntos = this.datosDashboard.puntos_general || [];
        if (puntos.length === 0) return;

        const labels = puntos.map(p => p.label || p.fecha);
        const dataValues = puntos.map(p => p.pu);

        // Límites dinámicos para el eje Y
        const minVal = Math.min(...dataValues);
        const maxVal = Math.max(...dataValues);
        const yMin = Math.max(0, Math.floor((minVal - 0.005) * 500) / 500);
        const yMax = Math.ceil((maxVal + 0.005) * 500) / 500;

        // Radios y bordes de puntos (resaltar los días activos en filtro cruzado)
        const fechasSelGeneral = new Set(this.fechasSeleccionadas);
        const pointRadii = puntos.map(p => fechasSelGeneral.has(p.fecha) ? 7 : 3.5);
        const pointBorderWidths = puntos.map(p => fechasSelGeneral.has(p.fecha) ? 2.5 : 1);
        const pointBorderColors = puntos.map(p => fechasSelGeneral.has(p.fecha) ? '#0f172a' : '#ffffff');

        const ctx = canvas.getContext('2d');

        this.chartGeneral = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    borderColor: '#59a14f', // Verde Tableau
                    borderWidth: 2,
                    pointBackgroundColor: puntos.map(p => p.pu >= 1.6115 ? '#e15759' : '#59a14f'),
                    pointBorderColor: pointBorderColors,
                    pointBorderWidth: pointBorderWidths,
                    pointRadius: pointRadii,
                    pointHoverRadius: 7,
                    tension: 0.15,
                    fill: false,
                    segment: {
                        borderColor: ctxSeg => {
                            const val = ctxSeg.p1.parsed.y;
                            return val >= 1.6115 ? '#e15759' : '#59a14f';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25, bottom: 5, left: 10, right: 15 }
                },
                onClick: (event, elements) => {
                    const nativeEvent = event && event.native ? event.native : event;
                    const conCtrl = !!(nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey));
                    const conShift = !!(nativeEvent && nativeEvent.shiftKey);

                    // Clic en área vacía: limpiar selección (auto-clear de Tableau)
                    if (!elements || elements.length === 0) {
                        if (this.fechasSeleccionadas.length) {
                            this.fechasSeleccionadas = [];
                            this.ultimoIndiceSeleccionado = null;
                            this.updateGeneralChartSelection();
                            this.renderDetalleSection();
                        }
                        return;
                    }

                    const idx = elements[0].index;
                    const puntoPresionado = puntos[idx];
                    if (!puntoPresionado) return;

                    const fecha = puntoPresionado.fecha;

                    if (conShift) {
                        const inicio = this.ultimoIndiceSeleccionado !== null ? this.ultimoIndiceSeleccionado : idx;
                        const min = Math.min(inicio, idx);
                        const max = Math.max(inicio, idx);
                        const rango = [];
                        for (let i = min; i <= max; i++) {
                            if (puntos[i]) rango.push(puntos[i].fecha);
                        }

                        if (conCtrl) {
                            const set = new Set(this.fechasSeleccionadas);
                            rango.forEach(f => set.add(f));
                            this.fechasSeleccionadas = Array.from(set);
                        } else {
                            this.fechasSeleccionadas = rango;
                        }
                        this.ultimoIndiceSeleccionado = idx;
                    } else if (conCtrl) {
                        const posicion = this.fechasSeleccionadas.indexOf(fecha);
                        if (posicion >= 0) {
                            this.fechasSeleccionadas.splice(posicion, 1);
                        } else {
                            this.fechasSeleccionadas.push(fecha);
                        }
                        this.ultimoIndiceSeleccionado = idx;
                    } else {
                        const soloEste = this.fechasSeleccionadas.length === 1 && this.fechasSeleccionadas[0] === fecha;
                        this.fechasSeleccionadas = soloEste ? [] : [fecha];
                        this.ultimoIndiceSeleccionado = soloEste ? null : idx;
                    }

                    this.fechasSeleccionadas = this.ordenarFechasSeleccionadas();
                    this.updateGeneralChartSelection();
                    this.renderDetalleSection();
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => this.customTooltipGeneral(context)
                    },
                    datalabels: {
                        display: true,
                        align: (ctxLabel) => {
                            const idx = ctxLabel.dataIndex;
                            return idx % 2 === 0 ? 'top' : 'bottom';
                        },
                        offset: 4,
                        font: {
                            family: 'ui-sans-serif, system-ui, sans-serif',
                            size: 9,
                            weight: '500'
                        },
                        color: (ctxLabel) => {
                            const val = ctxLabel.dataset.data[ctxLabel.dataIndex];
                            return val >= 1.6115 ? '#991b1b' : '#166534';
                        },
                        formatter: (value) => this.formatDecimal(value, 3)
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: true,
                            color: '#f1f5f9',
                            drawBorder: false
                        },
                        ticks: {
                            font: { size: 9, family: 'sans-serif' },
                            color: '#64748b',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'PU',
                            font: { size: 10, weight: 'bold' },
                            color: '#475569'
                        },
                        min: yMin,
                        max: yMax,
                        ticks: {
                            stepSize: 0.002,
                            font: { size: 9 },
                            color: '#64748b',
                            callback: (val) => this.formatDecimal(val, 3)
                        },
                        grid: {
                            color: '#e2e8f0',
                            drawBorder: false
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    },

    updateGeneralChartSelection() {
        if (!this.chartGeneral) return;
        const puntos = this.datosDashboard.puntos_general || [];
        const seleccionadas = new Set(this.fechasSeleccionadas);
        this.chartGeneral.data.datasets[0].pointRadius = puntos.map(p => seleccionadas.has(p.fecha) ? 7 : 3.5);
        this.chartGeneral.data.datasets[0].pointBorderWidth = puntos.map(p => seleccionadas.has(p.fecha) ? 2.5 : 1);
        this.chartGeneral.data.datasets[0].pointBorderColor = puntos.map(p => seleccionadas.has(p.fecha) ? '#0f172a' : '#ffffff');
        this.chartGeneral.update('none');
    },

    ordenarFechasSeleccionadas() {
        const set = new Set(this.fechasSeleccionadas);
        const ordenadas = [];
        (this.datosDashboard.puntos_general || []).forEach(p => {
            if (set.has(p.fecha)) {
                ordenadas.push(p.fecha);
                set.delete(p.fecha);
            }
        });
        set.forEach(fecha => ordenadas.push(fecha));
        return ordenadas;
    },

    normalizarFecha(fecha) {
        return String(fecha || '').replace(/-/g, '/');
    },

    diaSemanaDesdeFecha(fecha) {
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const limpia = String(fecha || '').replace(/\//g, '-');
        const date = new Date(`${limpia}T00:00:00`);
        if (isNaN(date.getTime())) return '';
        return dias[date.getDay()] || '';
    },

    capturarScroll(el) {
        return el ? { top: el.scrollTop, left: el.scrollLeft } : null;
    },

    restaurarScroll(el, estado) {
        if (!el || !estado) return;
        el.scrollTop = estado.top;
        el.scrollLeft = estado.left;
    },

    renderDetalleSection() {
        if (this.fechasSeleccionadas.length > 0) {
            this.renderFiltroCruzado();
        } else {
            this.renderDetalleGeneral();
        }
    },

    /**
     * Renderizado Normal (Sin filtro cruzado): Paneles horizontales por cada ítem
     */
    renderDetalleGeneral() {
        this.destroyDetalleCharts();

        const cabeceraEl = document.getElementById('cabecera-detalle-alimento');
        const bodyEl = document.getElementById('contenedor-body-detalle');
        if (!cabeceraEl || !bodyEl) return;

        const itemsDetalle = this.datosDashboard.items_detalle || [];

        cabeceraEl.innerHTML = `
            <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Detalle de Tipo de Alimento</h2>
            </div>
            <span class="text-xs text-slate-500 font-medium">${itemsDetalle.length} fórmulas / alimentos</span>
        `;

        let itemsPanelsHtml = '';
        itemsDetalle.forEach((item, idx) => {
            const numPuntos = (item.puntos || []).length;
            const itemWidth = Math.max(260, numPuntos * 54);
            itemsPanelsHtml += `
                <div class="flex flex-col border-r border-slate-200 pr-5 shrink-0" style="min-width: ${itemWidth}px;">
                    <!-- Cabecera de Ítem / Fórmula -->
                    <div class="px-2 py-1.5 mb-2 text-center">
                        <span class="text-[11px] font-semibold text-slate-700 tracking-tight select-all">${item.item_label || item.nomitem}</span>
                    </div>
                    <!-- Canvas para las barras del ítem -->
                    <div style="height: 300px; width: ${itemWidth}px;" class="relative">
                        <canvas id="canvas-ca01-item-${idx}"></canvas>
                    </div>
                </div>
            `;
        });

        bodyEl.innerHTML = `
            <div class="flex flex-row items-stretch gap-6 min-w-max">
                ${itemsPanelsHtml}
            </div>
        `;

        // Renderizar los gráficos de barras con ancho constante
        itemsDetalle.forEach((item, idx) => {
            const canvas = document.getElementById(`canvas-ca01-item-${idx}`);
            if (!canvas) return;

            const puntos = item.puntos || [];
            if (puntos.length === 0) return;

            const labels = puntos.map(p => [p.diaSemana + ',', p.fecha]);
            const dataValues = puntos.map(p => p.pu);
            const bgColors = puntos.map(p => this.coloresTipo[p.tipo] || '#f8a35b');

            const ctx = canvas.getContext('2d');

            const chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        hoverBackgroundColor: bgColors,
                        borderRadius: 1,
                        borderSkipped: false,
                        barThickness: 34,
                        maxBarThickness: 34
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 25, bottom: 5, left: (idx === 0 ? 5 : 0), right: 5 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => this.customTooltipDetalle(context, item)
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            font: {
                                family: 'ui-sans-serif, system-ui, sans-serif',
                                size: 9,
                                weight: '500'
                            },
                            color: '#475569',
                            formatter: (value) => this.formatDecimal(value, 3)
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                font: { size: 9, family: 'sans-serif' },
                                color: '#64748b',
                                maxRotation: 90,
                                minRotation: 90,
                                autoSkip: false
                            }
                        },
                        y: {
                            title: {
                                display: idx === 0,
                                text: 'PU',
                                font: { size: 10, weight: 'bold' },
                                color: '#475569'
                            },
                            min: 0,
                            max: 5,
                            ticks: {
                                stepSize: 1,
                                font: { size: 9 },
                                color: '#64748b',
                                display: idx === 0
                            },
                            grid: {
                                color: '#e2e8f0',
                                drawBorder: false
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.detalleCharts.push(chartInstance);
        });
    },

    /**
     * Renderizado de Filtro Cruzado: Agrupado por Tipo de Alimento + Fórmula
     * para uno o varios días seleccionados en la línea.
     */
    renderFiltroCruzado() {
        this.destroyDetalleCharts();

        const cabeceraEl = document.getElementById('cabecera-detalle-alimento');
        const bodyEl = document.getElementById('contenedor-body-detalle');
        if (!cabeceraEl || !bodyEl) return;

        const scrollBody = this.capturarScroll(bodyEl);
        const itemsDetalle = this.datosDashboard.items_detalle || [];
        const fechasOrdenadas = this.ordenarFechasSeleccionadas();
        const fechasDetalle = fechasOrdenadas.map(f => this.normalizarFecha(f));
        const totalDias = fechasDetalle.length;

        if (totalDias === 0) {
            this.renderDetalleGeneral();
            return;
        }

        // 1. Agrupar por tipo y por ítem, guardando el punto de cada día seleccionado.
        const gruposPorTipo = new Map();

        itemsDetalle.forEach(item => {
            const puntosPorFechaItem = new Map();
            (item.puntos || []).forEach(pt => {
                puntosPorFechaItem.set(this.normalizarFecha(pt.fecha), pt);
            });

            const puntosPorTipo = new Map();
            fechasDetalle.forEach(fecha => {
                const punto = puntosPorFechaItem.get(fecha);
                if (!punto) return;

                const tipo = punto.tipo || 'NULL';
                if (!puntosPorTipo.has(tipo)) {
                    puntosPorTipo.set(tipo, new Map());
                }
                puntosPorTipo.get(tipo).set(fecha, punto);
            });

            puntosPorTipo.forEach((puntosTipo, tipo) => {
                if (!gruposPorTipo.has(tipo)) {
                    gruposPorTipo.set(tipo, new Map());
                }

                const puntosPorFecha = new Map();
                fechasDetalle.forEach(fecha => {
                    puntosPorFecha.set(fecha, puntosTipo.get(fecha) || null);
                });

                gruposPorTipo.get(tipo).set(String(item.coditem), {
                    item,
                    puntosPorFecha
                });
            });
        });

        const tiposOrdenados = Array.from(gruposPorTipo.keys()).sort((a, b) => a.localeCompare(b));

        const fechaTexto = fechasOrdenadas[0] || '';
        let diaUnico = '';
        if (totalDias === 1) {
            const fechaBuscada = fechasDetalle[0];
            for (const item of itemsDetalle) {
                const punto = (item.puntos || []).find(pt => this.normalizarFecha(pt.fecha) === fechaBuscada);
                if (punto && punto.diaSemana) {
                    diaUnico = punto.diaSemana;
                    break;
                }
            }
        }
        const diaTexto = totalDias === 1
            ? `${diaUnico || this.diaSemanaDesdeFecha(fechaTexto)}, ${fechaTexto}`
            : `${totalDias} días seleccionados`;
        const fechasTitle = fechasDetalle.join(', ');

        // Cabecera con botón de reset
        cabeceraEl.innerHTML = `
            <div class="flex items-center gap-3">
                <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Detalle de Tipo de Alimento</h2>
                <div class="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-2.5 py-1 rounded-lg font-semibold" title="${fechasTitle}">
                    <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                    </svg>
                    <span>Filtro activo: ${diaTexto}</span>
                </div>
            </div>
            <button id="btn-reset-filtro-cruzado" type="button" 
                class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg border border-slate-300 transition-all cursor-pointer shadow-2xs">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <span>Ver todos los días</span>
            </button>
        `;

        document.getElementById('btn-reset-filtro-cruzado')?.addEventListener('click', () => {
            this.fechasSeleccionadas = [];
            this.ultimoIndiceSeleccionado = null;
            this.updateGeneralChartSelection();
            this.renderDetalleSection();
        });

        if (!tiposOrdenados.length) {
            bodyEl.innerHTML = `<div class="p-8 text-center text-slate-400 italic">No hay datos para los días seleccionados</div>`;
            this.restaurarScroll(bodyEl, scrollBody);
            return;
        }

        // 3. Construir la estructura HTML de columnas por Tipo y por Ítem (como en Tableau)
        let htmlGruposTipo = '';
        const fechaColWidth = 76; // Ancho constante por columna de fecha
        const itemColWidth = totalDias * fechaColWidth;

        tiposOrdenados.forEach((tipo, tipoIdx) => {
            const itemsDelTipo = Array.from(gruposPorTipo.get(tipo).values())
                .sort((a, b) => String(a.item.coditem).localeCompare(String(b.item.coditem)));
            const tipoWidth = itemsDelTipo.length * itemColWidth;

            let subheadersHtml = '';
            itemsDelTipo.forEach(entry => {
                const it = entry.item;
                const cod = it.coditem;
                const nomCorto = it.nomitem.length > 12 ? (it.nomitem.substring(0, 11) + '..') : it.nomitem;
                subheadersHtml += `
                    <div class="flex flex-col items-center justify-start text-[10px] leading-tight text-slate-600 text-center shrink-0 border-r border-slate-100 px-0.5"
                        style="width: ${itemColWidth}px; min-width: ${itemColWidth}px;" title="${it.item_label}">
                        <span class="font-bold text-slate-700">${cod}</span>
                        <span class="truncate w-full text-[9px] text-slate-500">${nomCorto}</span>
                    </div>
                `;
            });

            htmlGruposTipo += `
                <div class="flex flex-col border-r-2 border-slate-300 shrink-0" style="min-width: ${tipoWidth}px;">
                    <!-- Nivel 1: Cabecera Tipo de Alimento -->
                    <div class="py-1 px-2 border-b border-slate-200 bg-slate-50/80 text-center text-[11px] font-bold text-slate-700 tracking-tight">
                        ${tipo}
                    </div>
                    <!-- Nivel 2: Subcabecera de Fórmulas / Ítems -->
                    <div class="flex flex-row items-stretch border-b border-slate-200 py-1 bg-white">
                        ${subheadersHtml}
                    </div>
                    <!-- Canvas para las barras de este tipo -->
                    <div style="height: 280px; width: ${tipoWidth}px;" class="relative">
                        <canvas id="canvas-ca01-tipo-${tipoIdx}"></canvas>
                    </div>
                </div>
            `;
        });

        bodyEl.innerHTML = `
            <div class="flex flex-row items-stretch min-w-max border border-slate-200 rounded-lg overflow-hidden bg-white">
                ${htmlGruposTipo}
            </div>
        `;

        // 4. Renderizar un gráfico de barras por cada grupo de tipo con grosor exacto unificado (34px)
        tiposOrdenados.forEach((tipo, tipoIdx) => {
            const canvas = document.getElementById(`canvas-ca01-tipo-${tipoIdx}`);
            if (!canvas) return;

            const itemsDelTipo = Array.from(gruposPorTipo.get(tipo).values())
                .sort((a, b) => String(a.item.coditem).localeCompare(String(b.item.coditem)));
            const colorTipo = this.coloresTipo[tipo] || '#499894';

            const labels = [];
            const dataValues = [];
            const bgColors = [];
            const registrosBarras = [];

            itemsDelTipo.forEach(entry => {
                fechasDetalle.forEach(fecha => {
                    const punto = entry.puntosPorFecha.get(fecha) || null;
                    const dia = punto && punto.diaSemana ? punto.diaSemana : this.diaSemanaDesdeFecha(fecha);
                    const fechaMostrar = punto && punto.fecha ? punto.fecha : fecha;

                    labels.push([dia + ',', fechaMostrar]);
                    dataValues.push(punto ? punto.pu : null);
                    bgColors.push(colorTipo);
                    registrosBarras.push({
                        item: entry.item,
                        punto,
                        diaSemana: dia
                    });
                });
            });

            const ctx = canvas.getContext('2d');

            const chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataValues,
                        backgroundColor: bgColors,
                        hoverBackgroundColor: bgColors,
                        borderRadius: 1,
                        borderSkipped: false,
                        barThickness: 34,
                        maxBarThickness: 34
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 25, bottom: 5, left: (tipoIdx === 0 ? 5 : 0), right: 5 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: false,
                            external: (context) => {
                                const tooltipEl = document.getElementById('tooltip-tableau-costos');
                                if (!tooltipEl) return;
                                const { chart, tooltip } = context;
                                if (tooltip.opacity === 0) {
                                    tooltipEl.classList.add('hidden');
                                    return;
                                }
                                const dataIndex = tooltip.dataPoints[0].dataIndex;
                                const registro = registrosBarras[dataIndex];
                                if (!registro || !registro.punto) return;

                                const it = registro.item;
                                const punto = registro.punto;

                                tooltipEl.innerHTML = `
                                    <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex justify-between items-center text-xs">
                                        <span>${registro.diaSemana}, ${punto.fecha}</span>
                                        <span class="text-blue-600 font-semibold">${punto.tipo}</span>
                                    </div>
                                    <div class="flex flex-col gap-1 text-[11px] text-slate-700">
                                        <div class="flex justify-between gap-4">
                                            <span class="text-slate-500">Precio Unitario (PU):</span>
                                            <span class="font-bold font-mono text-slate-900">${this.formatDecimal(punto.pu, 3)}</span>
                                        </div>
                                        <div class="flex justify-between gap-4">
                                            <span class="text-slate-500">Fórmula:</span>
                                            <span class="text-slate-800 text-[10px] font-semibold">${it.coditem} - ${it.nomitem}</span>
                                        </div>
                                        ${punto.tot_valor ? `
                                        <div class="flex justify-between gap-4">
                                            <span class="text-slate-500">Total Valor:</span>
                                            <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_valor, 2)}</span>
                                        </div>` : ''}
                                        ${punto.tot_peso ? `
                                        <div class="flex justify-between gap-4">
                                            <span class="text-slate-500">Total Peso:</span>
                                            <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_peso, 2)}</span>
                                        </div>` : ''}
                                    </div>
                                `;

                                tooltipEl.classList.remove('hidden');
                                const position = chart.canvas.getBoundingClientRect();
                                const posX = position.left + tooltip.caretX + 12;
                                const posY = position.top + tooltip.caretY - 10;
                                tooltipEl.style.left = Math.min(posX, window.innerWidth - 260) + 'px';
                                tooltipEl.style.top = Math.max(10, Math.min(posY, window.innerHeight - 150)) + 'px';
                            }
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            offset: 2,
                            font: {
                                family: 'ui-sans-serif, system-ui, sans-serif',
                                size: 9,
                                weight: '500'
                            },
                            color: '#475569',
                            formatter: (value) => (value === null || value === undefined ? '' : this.formatDecimal(value, 3))
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            ticks: {
                                font: { size: 9, family: 'sans-serif' },
                                color: '#64748b',
                                maxRotation: 90,
                                minRotation: 90,
                                autoSkip: false
                            }
                        },
                        y: {
                            title: {
                                display: tipoIdx === 0,
                                text: 'PU',
                                font: { size: 10, weight: 'bold' },
                                color: '#475569'
                            },
                            min: 0,
                            max: 2.5,
                            ticks: {
                                stepSize: 0.5,
                                font: { size: 9 },
                                color: '#64748b',
                                display: tipoIdx === 0,
                                callback: (val) => this.formatDecimal(val, 1)
                            },
                            grid: {
                                color: '#e2e8f0',
                                drawBorder: false
                            }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            this.detalleCharts.push(chartInstance);
        });

        this.restaurarScroll(bodyEl, scrollBody);
    },

    customTooltipGeneral(context) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const { chart, tooltip } = context;
        if (tooltip.opacity === 0) {
            tooltipEl.classList.add('hidden');
            return;
        }

        const dataIndex = tooltip.dataPoints[0].dataIndex;
        const punto = this.datosDashboard.puntos_general[dataIndex];
        if (!punto) return;

        tooltipEl.innerHTML = `
            <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex justify-between items-center text-xs">
                <span>Costo Formula General</span>
                <span class="text-blue-600 font-mono">${punto.fecha || punto.label}</span>
            </div>
            <div class="flex flex-col gap-1 text-[11px] text-slate-700">
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Precio Unitario (PU):</span>
                    <span class="font-bold font-mono text-slate-900">${this.formatDecimal(punto.pu, 3)}</span>
                </div>
                ${punto.tot_valor ? `
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Total Valor:</span>
                    <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_valor, 2)}</span>
                </div>` : ''}
                ${punto.tot_peso ? `
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Total Peso:</span>
                    <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_peso, 2)}</span>
                </div>` : ''}
                <div class="mt-1 pt-1 border-t border-slate-100 text-[10px] text-blue-600 font-semibold text-center">
                    Clic: 1 día · Ctrl+clic: varios días
                </div>
            </div>
        `;

        tooltipEl.classList.remove('hidden');
        const position = chart.canvas.getBoundingClientRect();
        const posX = position.left + tooltip.caretX + 12;
        const posY = position.top + tooltip.caretY - 10;
        tooltipEl.style.left = Math.min(posX, window.innerWidth - 260) + 'px';
        tooltipEl.style.top = Math.max(10, Math.min(posY, window.innerHeight - 150)) + 'px';
    },

    customTooltipDetalle(context, item) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const { chart, tooltip } = context;
        if (tooltip.opacity === 0) {
            tooltipEl.classList.add('hidden');
            return;
        }

        const dataIndex = tooltip.dataPoints[0].dataIndex;
        const punto = item.puntos[dataIndex];
        if (!punto) return;

        tooltipEl.innerHTML = `
            <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex justify-between items-center text-xs">
                <span>${punto.diaSemana}, ${punto.fecha}</span>
                <span class="text-orange-600 font-semibold">${punto.tipo}</span>
            </div>
            <div class="flex flex-col gap-1 text-[11px] text-slate-700">
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Precio Unitario (PU):</span>
                    <span class="font-bold font-mono text-slate-900">${this.formatDecimal(punto.pu, 3)}</span>
                </div>
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Ítem:</span>
                    <span class="text-slate-800 text-[10px] truncate max-w-[200px]">${item.item_label || item.nomitem}</span>
                </div>
                ${punto.tot_valor ? `
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Total Valor:</span>
                    <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_valor, 2)}</span>
                </div>` : ''}
                ${punto.tot_peso ? `
                <div class="flex justify-between gap-4">
                    <span class="text-slate-500">Total Peso:</span>
                    <span class="font-mono text-slate-700">${this.formatDecimal(punto.tot_peso, 2)}</span>
                </div>` : ''}
            </div>
        `;

        tooltipEl.classList.remove('hidden');
        const position = chart.canvas.getBoundingClientRect();
        const posX = position.left + tooltip.caretX + 12;
        const posY = position.top + tooltip.caretY - 10;
        tooltipEl.style.left = Math.min(posX, window.innerWidth - 260) + 'px';
        tooltipEl.style.top = Math.max(10, Math.min(posY, window.innerHeight - 150)) + 'px';
    }
};

// Registro bajo los posibles nombres de selector
window.ChartRegistry['CA01 CostoFormulaPorTipoAlimento'] = CA01_DEFINITION;
window.ChartRegistry['CA01 CostoFormulaPorTipoAA'] = CA01_DEFINITION;
