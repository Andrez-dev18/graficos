class AlmacenMermasVivoController {
    constructor() {
        this.service = new AlmacenMermasVivoService();
        this.currentPeriodo = { inicio: '', fin: '' };
        this.cacheData = null;
        this.cachePayload = null;
        this.activeCharts = [];
        this.searchCliente = null;
        this.searchPlacaMatriz = null;
        this.filtrosMermaCargados = false;

        // Estado del combo de placas y modal DashPrueba1
        this.todasLasPlacas = [];
        this.modalDashState = {
            fechaproceso: '',
            fechaTxt: '',
            cliente: '',
            placaSeleccionada: '',
            viendoTodos: false
        };

        this.init();
    }

    /**
     * Inicialización del controlador con primera carga automática
     */
    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        // Calidad retina para canvas
        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        this.setupPeriodo();
        this.setupEventListeners();
        this.actualizarVisibilidadFiltros();
        this.inicializarFiltrosMerma();
        this.setupModales();

        // Mostrar loading inicial de página
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Almacén Mermas',
                subtitulo: 'Inicializando configuración y métricas...'
            });
        }

        try {
            // Primera carga automática
            await this.onCargarClick();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    /**
     * Inicializa PeriodoHelper estableciendo un rango dinámico de los últimos 7 días
     */
    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined' && typeof PeriodoHelper.renderizarInputs === 'function') {
            PeriodoHelper.renderizarInputs();

            const hoy = new Date();
            const haceSieteDias = new Date();
            haceSieteDias.setDate(hoy.getDate() - 7);

            const formatYMD = (d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const fInicioStr = formatYMD(haceSieteDias);
            const fFinStr = formatYMD(hoy);

            const inputInicio = document.getElementById('input-fecha-inicio') || document.querySelector('input[name="fecha_inicio"]');
            const inputFin = document.getElementById('input-fecha-fin') || document.querySelector('input[name="fecha_fin"]');

            if (inputInicio) inputInicio.value = fInicioStr;
            if (inputFin) inputFin.value = fFinStr;

            this.currentPeriodo = { inicio: fInicioStr, fin: fFinStr };
        }
    }

    /**
     * Registra listeners de botones y selectores
     */
    setupEventListeners() {
        // 1. Toggle Plegar / Desplegar Filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const panelFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');

        if (btnToggle && panelFiltros) {
            btnToggle.addEventListener('click', () => {
                const isHidden = panelFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = isHidden ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // 2. Selector de Período dinámico
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        // 3. Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', () => {
            this.onCargarClick();
        });

        // 4. Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => {
            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || '';
            if (tipoGrafico === 'TendenciaMermas') {
                this.aplicarPeriodoTendencia();
                this.aplicarClienteTendencia();
            }
            this.actualizarVisibilidadFiltros();
        });
    }

    aplicarPeriodoTendencia() {
        const select = document.getElementById('select-tipo-periodo');
        if (select) select.value = 'por_mes';

        if (typeof PeriodoHelper !== 'undefined' && typeof PeriodoHelper.renderizarInputs === 'function') {
            PeriodoHelper.renderizarInputs();
        }
    }

    aplicarClienteTendencia() {
        if (!this.searchCliente) return;
        const opciones = Array.isArray(this.searchCliente.options) ? this.searchCliente.options : [];
        if (opciones.some(opcion => opcion.value === 'AQP-BENE')) {
            this.searchCliente.setValue('AQP-BENE', false);
        }
    }

    actualizarVisibilidadFiltros() {
        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || '';
        const esDash = tipoGrafico === 'DashPrueba1';
        const esMatriz = tipoGrafico === 'PorcMermaDiariaProcesoCientePlaca';
        const esTendencia = tipoGrafico === 'TendenciaMermas';
        const requiereCliente = esMatriz || esTendencia;
        const ocultarDato = ['PorcMermaDiariaProceso', 'PorcMermaDiariaProcesoCiente', 'PorcMermaDiariaProcesoCientePlaca'].includes(tipoGrafico);

        document.getElementById('wrapper-filtro-placa')?.classList.toggle('hidden', !esDash);
        document.getElementById('wrapper-filtro-cliente')?.classList.toggle('hidden', !requiereCliente);
        document.getElementById('wrapper-filtro-placa-matriz')?.classList.toggle('hidden', !esMatriz);
        document.getElementById('wrapper-filtro-dato')?.classList.toggle('hidden', ocultarDato);
    }

    async inicializarFiltrosMerma() {
        if (this.filtrosMermaCargados || typeof SearchableSelect === 'undefined') return;
        this.filtrosMermaCargados = true;

        this.searchCliente = new SearchableSelect({
            containerId: 'searchable-filtro-cliente',
            title: 'Cliente',
            options: []
        });

        this.searchPlacaMatriz = new SearchableSelect({
            containerId: 'searchable-filtro-placa-matriz',
            title: 'Placa',
            options: []
        });

        try {
            const data = await this.service.obtenerFiltrosMerma();
            if (data && data.success && data.payload) {
                this.searchCliente?.setOptions(data.payload.clientes || []);
                this.searchPlacaMatriz?.setOptions(data.payload.placas || []);

                const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || '';
                if (tipoGrafico === 'TendenciaMermas') {
                    this.aplicarClienteTendencia();
                }
            }
        } catch (error) {
            console.error('No se pudieron cargar los filtros de mermas:', error);
        }
    }

    /**
     * Obtiene el payload consolidado de filtros activos
     */
    obtenerFiltrosActivos() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : ((typeof PeriodoHelper !== 'undefined' && PeriodoHelper.calcularRangoFechas) ? PeriodoHelper.calcularRangoFechas() : {});

        const fechaInicio = rango.fechaInicio || rango.inicio || '';
        const fechaFin = rango.fechaFin || rango.fin || '';
        this.currentPeriodo = { inicio: fechaInicio, fin: fechaFin };

        const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'PorcMermaProcesoDiaClientePlaca';
        const esMatriz = tipoGrafico === 'PorcMermaDiariaProcesoCientePlaca';
        const esTendencia = tipoGrafico === 'TendenciaMermas';
        const requiereCliente = esMatriz || esTendencia;
        const cliente = requiereCliente && this.searchCliente ? this.searchCliente.getValue() : '';
        const placa = esMatriz
            ? (this.searchPlacaMatriz ? this.searchPlacaMatriz.getValue() : '')
            : (document.getElementById('select-filtro-placa')?.value || 'TODO');

        return {
            tipo_grafico: tipoGrafico,
            dato: document.getElementById('select-filtro-dato')?.value || 'TODO',
            cliente: cliente || 'TODO',
            placa: placa || 'TODO',
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        };
    }

    /**
     * Destruye charts activos para evitar fugas de memoria
     */
    destruirGraficos() {
        this.activeCharts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.activeCharts = [];
    }

    /**
     * Handler al presionar Cargar
     */
    async onCargarClick() {
        const filtros = this.obtenerFiltrosActivos();
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        this.destruirGraficos();

        LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
        LoadingHelper.mostrarEnContenedor('contenedor-graficos-lista', {
            titulo: `Consultando ${filtros.tipo_grafico}...`,
            subtitulo: 'Cargando métricas de mermas para el período seleccionado'
        });

        try {
            const res = await this.service.consultarGrafico(filtros.tipo_grafico, filtros);
            LoadingHelper.ocultarEnContenedor('contenedor-graficos-lista');

            if (res && res.success && res.payload && res.payload.data && res.payload.data.length > 0) {
                this.cacheData = res.payload.data;
                this.cachePayload = res.payload;
                this.enrutarRenderizado(filtros.tipo_grafico, this.cacheData);
                this.poblarSelectPlacas(this.cacheData);
            } else {
                this.cacheData = null;
                this.cachePayload = null;
                LoadingHelper.mostrarVacio('contenedor-graficos-lista', {
                    mensaje: 'No se encontraron registros',
                    subtitulo: 'Intente cambiando el rango de fechas o el filtro de datos.'
                });
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            this.cacheData = null;
            this.cachePayload = null;
            LoadingHelper.mostrarError('contenedor-graficos-lista', {
                mensaje: 'Error de consulta',
                detalle: error.message || 'Error inesperado.'
            });
        } finally {
            LoadingHelper.restaurarBoton('btn-cargar');
        }
    }

    /**
     * Enruta a la función correspondiente según el gráfico seleccionado
     */
    enrutarRenderizado(tipoGrafico, data) {
        switch (tipoGrafico) {
            case 'PorcMermaProcesoDiaClientePlaca':
                this.renderizarPorcMermaProcesoDiaClientePlaca(data);
                break;
            case 'PorcMermaProcesoDiaCliente':
                this.renderizarPorcMermaProcesoDiaCliente(data);
                break;
            case 'PorcMermaProcesoDiaClienteZona':
                this.renderizarPorcMermaProcesoDiaClienteZona(data);
                break;
            case 'PorcMermaProcesoDiaClienteZonaPlaca':
                this.renderizarPorcMermaProcesoDiaClienteZonaPlaca(data);
                break;
            case 'PorcMermaDiariaProceso':
                this.renderizarPorcMermaDiariaLinea(data, 'dia');
                break;
            case 'PorcMermaDiariaProcesoMes':
                if (window.ChartAlmacenMermasMermaMensualCliente) {
                    window.ChartAlmacenMermasMermaMensualCliente.render(this, data, 'contenedor-graficos-lista');
                }
                break;
            case 'PorcMermaDiariaProcesoMesZona':
                this.renderizarPorcMermaDiariaLinea(data, 'mes');
                break;
            case 'PorcMermaDiariaProcesoCiente':
                if (window.ChartAlmacenMermasMermaDiariaCliente) {
                    window.ChartAlmacenMermasMermaDiariaCliente.render(this, data, 'contenedor-graficos-lista');
                }
                break;
            case 'PorcMermaDiariaProcesoCientePlaca':
                if (window.ChartAlmacenMermasMermaDiariaClientePlaca) {
                    window.ChartAlmacenMermasMermaDiariaClientePlaca.render(this, data, 'contenedor-graficos-lista');
                }
                break;
            case 'DashPrueba1':
                this.renderizarDashPrueba1(data);
                break;
            case 'TendenciaMermas':
                window.ChartAlmacenMermasTendenciaMermas.render(this, data, 'contenedor-graficos-lista');
                break;
            default:
                console.warn(`Vista no reconocida: ${tipoGrafico}`);
        }
    }

    /**
     * Helper para renderizar mini-barras horizontales estilo Tableau con porcentaje a la derecha
     */
    generarBarraTableau(pctValor, maxEscala = 6.0, metadatosFila = null) {
        return this.generarBarraColor(pctValor, maxEscala, '#1F77B4', metadatosFila, true);
    }

    /**
     * Helper universal para renderizar mini-barras horizontales estilo Tableau (porcentaje o valor absoluto)
     */
    generarBarraColor(valor, maxEscala = 6.0, colorHex = '#1F77B4', metadatosFila = null, esPorcentaje = true, metricLabel = 'mermatotal') {
        const val = Number(valor || 0);
        const anchoPct = maxEscala > 0 ? Math.min(Math.max((val / maxEscala) * 100, 0), 100) : 0;
        const textoFmt = esPorcentaje ? this.formatearPorcentaje(val) : this.formatearNumeroTableau(val);

        const esInteractiva = metadatosFila !== null;
        const attrsData = esInteractiva ? `
            data-cliente="${metadatosFila.cliente || ''}"
            data-fecha="${metadatosFila.fecha || ''}"
            data-metric-label="${metricLabel}"
            data-metric-val="${textoFmt}"
            data-total="${metadatosFila.total || textoFmt}"
        ` : '';

        return `
            <div class="flex items-center gap-1.5 w-full justify-start select-none">
                <div class="w-14 sm:w-16 h-3.5 bg-transparent flex justify-start items-center ${esInteractiva ? 'cursor-pointer barra-merma-hover' : ''}" ${attrsData}>
                    ${anchoPct > 0 ? `<div class="h-full transition-all rounded-none" style="width: ${anchoPct}%; background-color: ${colorHex};"></div>` : ''}
                </div>
                <span class="text-[10px] font-mono font-medium ${val > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'} whitespace-nowrap">
                    ${textoFmt}
                </span>
            </div>
        `;
    }

    /**
     * Helper para renderizar el punto de color y porcentaje de variación vs Objetivo
     */
    generarPuntoVariacion(pctVariacion, avgObjetivo, metadatosFila = null) {
        const obj = Number(avgObjetivo || 0);
        if (obj <= 0) {
            return `<span class="text-[10px] font-mono text-slate-300">-</span>`;
        }

        const val = Number(pctVariacion || 0);
        let color = '#E0AA15'; // Amarillo / margen medio
        if (val <= -5) {
            color = '#2CA02C'; // Verde: favorable (merma menor al objetivo)
        } else if (val >= 10) {
            color = '#D62728'; // Rojo: desfavorable (merma supera el objetivo)
        } else if (val > 5) {
            color = '#F28E2B'; // Naranja
        }

        const texto = `${this.formatearPorcentaje(val)}`;
        const esInteractiva = metadatosFila !== null;
        const attrsData = esInteractiva ? `
            data-cliente="${metadatosFila.cliente || ''}"
            data-fecha="${metadatosFila.fecha || ''}"
            data-metric-label="mermatotal"
            data-metric-val="${texto}"
            data-total="${texto}"
        ` : '';

        return `
            <div class="flex items-center justify-start gap-1.5 whitespace-nowrap select-none ${esInteractiva ? 'cursor-pointer barra-merma-hover' : ''}" ${attrsData}>
                <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs" style="background-color: ${color};"></span>
                <span class="text-[10px] font-mono font-bold" style="color: ${color};">
                    ${texto}
                </span>
            </div>
        `;
    }

    /**
     * Renderiza la línea diaria o mensual de porcentaje de merma
     */
    renderizarPorcMermaDiariaLinea(puntos, granularidad) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        const payload = this.cachePayload || {};
        const data = Array.isArray(puntos) ? puntos : [];
        const esMes = granularidad === 'mes';
        const titulo = payload.titulo || (esMes
            ? 'Porcentaje de Merma Mensualizada por Fecha de Proceso'
            : 'Porcentaje de Merma Diaria por Fecha de Proceso');
        const subtitulo = payload.subtitulo || 'Merma total sobre la entrada';
        const etiquetaY = payload.etiqueta_y || 'Porcentaje de Merma';

        const valores = data.map(p => {
            const valor = p ? p.valor : null;
            return valor === null || valor === undefined || isNaN(valor) ? null : Number(valor);
        });
        const hayDatos = valores.some(v => v !== null);

        if (data.length === 0 || !hayDatos) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const anios = [...new Set(data.map(p => String(p.periodo || '').slice(0, 4)).filter(Boolean))];
        const etiquetas = data.map(p => this.formatearEtiquetaPeriodo(p.periodo, granularidad, anios.length > 1));
        const maxValor = Math.max(...valores.filter(v => v !== null), 0);
        const maxY = Math.max(1, Math.ceil((maxValor * 1.05) / 0.5) * 0.5);
        const tendencia = this.calcularTendencia(valores);
        const canvasId = `canvas-merma-linea-${granularidad}`;
        const anchoMinimo = data.length * (esMes ? 100 : 36);

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="text-[11px] text-slate-500 font-medium">
                        Período: <strong class="text-slate-800 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong>
                    </div>
                </div>
                <div class="px-4 pt-4 pb-6 sm:px-6">
                    ${esMes && anios.length === 1 ? `<p class="text-center text-[12px] font-semibold text-slate-500 mb-2">${anios[0]}</p>` : ''}
                    <div class="w-full overflow-x-auto custom-scrollbar pb-3">
                        <div class="relative" style="width: max(100%, ${anchoMinimo}px); height: ${esMes ? 500 : 620}px;">
                            <canvas id="${canvasId}"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const datasets = [{
            label: etiquetaY,
            data: valores,
            borderColor: '#e15759',
            backgroundColor: '#e15759',
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: '#e15759',
            pointBorderColor: '#e15759',
            tension: 0,
            spanGaps: false,
            fill: false
        }];

        if (tendencia) {
            datasets.push({
                label: 'Tendencia',
                data: tendencia,
                borderColor: '#475569',
                borderWidth: 1.5,
                borderDash: [7, 5],
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0,
                fill: false
            });
        }

        const self = this;
        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                animation: { duration: 220 },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                layout: {
                    padding: { top: 26, right: 18, bottom: 8, left: 8 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        mode: 'nearest',
                        intersect: false,
                        filter: (item) => item.datasetIndex === 0,
                        callbacks: {
                            label: (item) => `${etiquetaY}: ${self.formatearPorcentaje(item.parsed.y)}`
                        }
                    },
                    datalabels: {
                        display: (ctx) => {
                            const valor = ctx.dataset.data[ctx.dataIndex];
                            return ctx.datasetIndex === 0 && valor !== null && valor !== undefined && !isNaN(valor);
                        },
                        anchor: 'end',
                        align: 'top',
                        offset: 6,
                        clamp: true,
                        color: '#334155',
                        font: {
                            family: '"Segoe UI", sans-serif',
                            size: esMes ? 11 : 9.5,
                            weight: '600'
                        },
                        formatter: (value) => self.formatearPorcentaje(value)
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { color: '#cbd5e1', width: 1 },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            color: '#334155',
                            padding: 10,
                            font: {
                                family: '"Segoe UI", sans-serif',
                                size: esMes ? 10.5 : 8.5,
                                weight: '600'
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: maxY,
                        grid: { color: 'rgba(226, 232, 240, 0.8)', drawTicks: false },
                        border: { color: '#cbd5e1', width: 1 },
                        title: {
                            display: true,
                            text: etiquetaY,
                            color: '#475569',
                            font: { family: '"Segoe UI", sans-serif', size: 12, weight: 'bold' }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#334155',
                            font: { family: '"Segoe UI", sans-serif', size: 10.5, weight: '600' },
                            padding: 10,
                            callback: (value) => self.formatearPorcentaje(value)
                        }
                    }
                }
            }
        });

        this.activeCharts.push(chart);
    }

    calcularTendencia(valores) {
        const puntos = valores
            .map((valor, indice) => ({ x: indice, y: valor }))
            .filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));

        if (puntos.length < 2) return null;

        const n = puntos.length;
        const sumX = puntos.reduce((acc, p) => acc + p.x, 0);
        const sumY = puntos.reduce((acc, p) => acc + p.y, 0);
        const sumXY = puntos.reduce((acc, p) => acc + (p.x * p.y), 0);
        const sumX2 = puntos.reduce((acc, p) => acc + (p.x * p.x), 0);
        const denominador = (n * sumX2) - (sumX * sumX);

        if (denominador === 0) return null;

        const pendiente = ((n * sumXY) - (sumX * sumY)) / denominador;
        const intercepto = (sumY - (pendiente * sumX)) / n;

        return valores.map((_, indice) => (pendiente * indice) + intercepto);
    }

    formatearEtiquetaPeriodo(periodo, granularidad, incluirAnio) {
        const partes = String(periodo || '').split('-').map(Number);
        if (partes.length < 2 || partes.some(p => isNaN(p))) return String(periodo || '');

        const anio = partes[0];
        const mes = partes[1];
        const dia = partes[2] || 1;

        if (granularidad === 'mes') {
            const fecha = new Date(anio, mes - 1, 1);
            const nombreMes = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fecha).toLowerCase();
            return incluirAnio ? `${nombreMes} ${anio}` : nombreMes;
        }

        const fecha = new Date(anio, mes - 1, dia);
        return new Intl.DateTimeFormat('es-PE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(fecha).toLowerCase();
    }

    /**
     * Renderiza la tabla completa Porcentaje de Merma Diaria por Fecha de Proceso / Cliente / Placa
     */
    renderizarPorcMermaProcesoDiaClientePlaca(filas) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (!filas || filas.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin registros para esta selección.</div>`;
            return;
        }

        const filasOrdenadas = [...filas].sort((a, b) => {
            const cmpFecha = (a.fechaproceso || '').localeCompare(b.fechaproceso || '');
            if (cmpFecha !== 0) return cmpFecha;
            const cmpCliente = (a.cliente || '').localeCompare(b.cliente || '');
            if (cmpCliente !== 0) return cmpCliente;
            return (a.placa || '').localeCompare(b.placa || '');
        });

        const conteoFecha = {};
        const conteoCliente = {};

        filasOrdenadas.forEach(f => {
            const fec = f.fechaproceso;
            const cliKey = `${f.fechaproceso}|${f.cliente}`;
            conteoFecha[fec] = (conteoFecha[fec] || 0) + 1;
            conteoCliente[cliKey] = (conteoCliente[cliKey] || 0) + 1;
        });

        const fechasRenderizadas = new Set();
        const clientesRenderizados = new Set();

        const card = document.createElement('div');
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        card.innerHTML = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Porcentaje de Merma Diaria por Fecha de Proceso/Cliente/Placa
                    </h2>
                    <p class="text-xs text-slate-500 mt-0.5">
                        Métricas de mermas relativas calculadas sobre la Entrada Total
                    </p>
                </div>
                <div class="text-[11px] text-slate-500 font-medium">
                    Período: <strong class="text-slate-800 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong>
                </div>
            </div>

            <div class="overflow-x-auto max-h-[76vh] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left text-xs border-separate border-spacing-0">
                    <thead class="sticky top-0 z-30 bg-blue-600 text-white border-b border-slate-300 shadow-xs">
                        <tr class="text-[10px] font-bold uppercase tracking-wider">
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">Día de fechap..</th>
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">cliente</th>
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">placa</th>
                            
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Total</th>
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Merma Almacenaje</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Muerto Distribucion</th>
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Muerto Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[110px] border-b border-r border-slate-200">Merma No Apto</th>
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Merma Bene Manual</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-slate-200">Merma Bene Mecaniza</th>
                        </tr>
                    </thead>
                    <tbody class="text-slate-700">
                        ${filasOrdenadas.map(r => {
            const fec = r.fechaproceso;
            const cliKey = `${r.fechaproceso}|${r.cliente}`;

            let celdaFecha = '';
            if (!fechasRenderizadas.has(fec)) {
                fechasRenderizadas.add(fec);
                celdaFecha = `
                                    <td rowspan="${conteoFecha[fec]}" class="px-3 py-2 font-semibold text-slate-800 bg-slate-50/80 border-r border-b border-slate-200 align-top text-left text-[11px]">
                                        <div class="sticky top-[42px] z-10 py-1 font-semibold text-slate-800">
                                            ${r.fecha_formateada || fec}
                                        </div>
                                    </td>
                                `;
            }

            let celdaCliente = '';
            if (!clientesRenderizados.has(cliKey)) {
                clientesRenderizados.add(cliKey);
                celdaCliente = `
                                    <td rowspan="${conteoCliente[cliKey]}" class="px-3 py-2 font-bold text-slate-800 bg-white border-r border-b border-slate-200 align-top text-left uppercase tracking-wider text-[11px]">
                                        <div class="sticky top-[42px] z-10 py-1 font-bold text-slate-800">
                                            ${r.cliente}
                                        </div>
                                    </td>
                                `;
            }

            // Metadatos empaquetados para la barra
            const meta = {
                cliente: r.cliente,
                fecha: r.fecha_formateada || fec,
                total: this.formatearPorcentaje(r.pct_mermatotal),
                alm: this.formatearPorcentaje(r.pct_mermaalmacenaje),
                muertodist: this.formatearPorcentaje(r.pct_mermamuertodistribucion),
                muertotransp: this.formatearPorcentaje(r.pct_mermamuertotransporte),
                noapto: this.formatearPorcentaje(r.pct_mermanoapto),
                transp: this.formatearPorcentaje(r.pct_mermatransporte)
            };

            return `
                                <tr class="hover:bg-slate-50/40 transition-colors text-[11px] border-b border-slate-100">
                                    ${celdaFecha}
                                    ${celdaCliente}
                                    <td class="px-3 py-2 font-mono font-medium text-slate-700 whitespace-nowrap border-r border-b border-slate-100 bg-white">
                                        ${r.placa}
                                    </td>

                                    <!-- 1. Merma Total -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatotal, 6.0, meta)}
                                    </td>

                                    <!-- 2. Merma Almacenaje -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermaalmacenaje, 4.0, meta)}
                                    </td>

                                    <!-- 3. Merma Muerto Distribucion -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermamuertodistribucion, 4.0, meta)}
                                    </td>

                                    <!-- 4. Merma Muerto Transporte -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermamuertotransporte, 4.0, meta)}
                                    </td>

                                    <!-- 5. Merma No Apto -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermanoapto, 4.0, meta)}
                                    </td>

                                    <!-- 6. Merma Transporte -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransporte, 6.0, meta)}
                                    </td>

                                    <!-- 7. Merma Bene Manual -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransbenemanual, 4.0, meta)}
                                    </td>

                                    <!-- 8. Merma Bene Mecaniza -->
                                    <td class="px-3 py-1.5 border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransbenemecani, 6.0, meta)}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>

                    <tfoot class="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300 text-[9px] font-mono text-slate-500">
                        <tr>
                            <td colspan="3" class="px-3 py-1 text-right font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200">
                                Escala
                            </td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00% 2,00% 4,00% 6,00%</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00 0,01 0,02 0,03 0,04</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00 0,02 0,04 0,06</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 text-left">0,00 0,02 0,04 0,06</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        contenedor.appendChild(card);
        this.asignarEventosTooltipMermas();
    }

    asignarEventosTooltipMermas() {
        const tooltip = document.getElementById('tooltip-tableau-mermas');
        if (!tooltip) return;

        document.querySelectorAll('.barra-merma-hover').forEach(barra => {
            barra.addEventListener('mouseenter', () => {
                const cliente = barra.getAttribute('data-cliente') || '';
                const fecha = barra.getAttribute('data-fecha') || '';
                const metricLabel = barra.getAttribute('data-metric-label') || 'mermatotal';
                const metricVal = barra.getAttribute('data-metric-val') || barra.getAttribute('data-total') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-12 gap-x-2 gap-y-1 text-[11px] leading-snug select-none min-w-[220px]">
                        <div class="col-span-5 text-slate-500 font-normal">cliente:</div>
                        <div class="col-span-7 font-bold text-slate-900">${cliente}</div>

                        <div class="col-span-5 text-slate-500 font-normal">Día de fechaproceso:</div>
                        <div class="col-span-7 font-bold text-slate-900 whitespace-nowrap">${fecha}</div>

                        <div class="col-span-5 text-slate-500 font-normal">${metricLabel}:</div>
                        <div class="col-span-7 font-mono font-bold text-slate-900">${metricVal}</div>
                    </div>
                `;

                tooltip.classList.remove('hidden');
            });

            barra.addEventListener('mousemove', (e) => {
                const offsetX = 16;
                const offsetY = 16;
                const tooltipWidth = tooltip.offsetWidth;
                const tooltipHeight = tooltip.offsetHeight;

                let posX = e.clientX + offsetX;
                let posY = e.clientY + offsetY;

                if (posX + tooltipWidth > window.innerWidth) {
                    posX = e.clientX - tooltipWidth - 10;
                }
                if (posY + tooltipHeight > window.innerHeight) {
                    posY = e.clientY - tooltipHeight - 10;
                }

                tooltip.style.left = `${posX}px`;
                tooltip.style.top = `${posY}px`;
            });

            barra.addEventListener('mouseleave', () => {
                tooltip.classList.add('hidden');
            });
        });
    }

    /**
     * Renderiza la tabla Porcentaje de Merma Diaria por Fecha de Proceso / Cliente
     */
    renderizarPorcMermaProcesoDiaCliente(filas) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (!filas || filas.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin registros para esta selección.</div>`;
            return;
        }

        const filasOrdenadas = [...filas].sort((a, b) => {
            const cmpFecha = (a.fechaproceso || '').localeCompare(b.fechaproceso || '');
            if (cmpFecha !== 0) return cmpFecha;
            return (a.cliente || '').localeCompare(b.cliente || '');
        });

        const conteoFecha = {};
        filasOrdenadas.forEach(f => {
            const fec = f.fechaproceso;
            conteoFecha[fec] = (conteoFecha[fec] || 0) + 1;
        });

        const fechasRenderizadas = new Set();

        const card = document.createElement('div');
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        card.innerHTML = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Porcentaje de Merma Diaria por Fecha de Proceso/Cliente
                    </h2>
                    <p class="text-xs text-slate-500 mt-0.5">
                        Métricas de mermas relativas calculadas sobre la Entrada Total
                    </p>
                </div>
                <div class="text-[11px] text-slate-500 font-medium">
                    Período: <strong class="text-slate-800 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong>
                </div>
            </div>

            <div class="overflow-x-auto max-h-[76vh] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left text-xs border-separate border-spacing-0">
                    <thead class="sticky top-0 z-30 bg-blue-600 text-white border-b border-slate-300 shadow-xs">
                        <tr class="text-[10px] font-bold uppercase tracking-wider">
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">Día de fechap..</th>
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">cliente</th>
                            
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Total</th>
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Merma Almacenaje</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Muerto Distribucion</th>
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Muerto Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[110px] border-b border-r border-slate-200">Merma No Apto</th>
                            <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Merma Bene Manual</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-slate-200">Merma Bene Mecaniza</th>
                        </tr>
                    </thead>
                    <tbody class="text-slate-700">
                        ${filasOrdenadas.map(r => {
            const fec = r.fechaproceso;

            let celdaFecha = '';
            if (!fechasRenderizadas.has(fec)) {
                fechasRenderizadas.add(fec);
                celdaFecha = `
                                    <td rowspan="${conteoFecha[fec]}" class="px-3 py-2 font-semibold text-slate-800 bg-slate-50/80 border-r border-b border-slate-200 align-top text-left text-[11px]">
                                        <div class="sticky top-[42px] z-10 py-1 font-semibold text-slate-800">
                                            ${r.fecha_formateada || fec}
                                        </div>
                                    </td>
                                `;
            }

            // Metadatos empaquetados para la barra y tooltip
            const meta = {
                cliente: r.cliente,
                fecha: r.fecha_formateada || fec,
                total: this.formatearPorcentaje(r.pct_mermatotal),
                alm: this.formatearPorcentaje(r.pct_mermaalmacenaje),
                muertodist: this.formatearPorcentaje(r.pct_mermamuertodistribucion),
                muertotransp: this.formatearPorcentaje(r.pct_mermamuertotransporte),
                noapto: this.formatearPorcentaje(r.pct_mermanoapto),
                transp: this.formatearPorcentaje(r.pct_mermatransporte)
            };

            return `
                                <tr class="hover:bg-slate-50/40 transition-colors text-[11px] border-b border-slate-100">
                                    ${celdaFecha}
                                    <td class="px-3 py-2 font-bold text-slate-800 bg-white border-r border-b border-slate-100 align-middle text-left uppercase tracking-wider text-[11px] whitespace-nowrap">
                                        ${r.cliente}
                                    </td>

                                    <!-- 1. Merma Total -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatotal, 6.0, meta)}
                                    </td>

                                    <!-- 2. Merma Almacenaje -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermaalmacenaje, 4.0, meta)}
                                    </td>

                                    <!-- 3. Merma Muerto Distribucion -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermamuertodistribucion, 4.0, meta)}
                                    </td>

                                    <!-- 4. Merma Muerto Transporte -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermamuertotransporte, 4.0, meta)}
                                    </td>

                                    <!-- 5. Merma No Apto -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermanoapto, 4.0, meta)}
                                    </td>

                                    <!-- 6. Merma Transporte -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransporte, 6.0, meta)}
                                    </td>

                                    <!-- 7. Merma Bene Manual -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransbenemanual, 4.0, meta)}
                                    </td>

                                    <!-- 8. Merma Bene Mecaniza -->
                                    <td class="px-3 py-1.5 border-b border-slate-100">
                                        ${this.generarBarraTableau(r.pct_mermatransbenemecani, 6.0, meta)}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>

                    <tfoot class="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300 text-[9px] font-mono text-slate-500">
                        <tr>
                            <td colspan="2" class="px-3 py-1 text-right font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200">
                                Escala
                            </td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00% 2,00% 4,00% 6,00%</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00 0,01 0,02 0,03 0,04</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00 0,02 0,04 0,06</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 text-left">0,00 0,02 0,04 0,06</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        contenedor.appendChild(card);
        this.asignarEventosTooltipMermas();
    }

    /**
     * Renderiza la tabla Porcentaje de Merma Diaria por Fecha de Proceso, Cliente y Zona (con Objetivo y Desvío)
     */
    renderizarPorcMermaProcesoDiaClienteZona(filas) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (!filas || filas.length === 0) {
            contenedor.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin registros para esta selección.</div>`;
            return;
        }

        const filasOrdenadas = [...filas].sort((a, b) => {
            const cmpFecha = (a.fechaproceso || '').localeCompare(b.fechaproceso || '');
            if (cmpFecha !== 0) return cmpFecha;
            const cmpZona = (a.zonaorigen || '').localeCompare(b.zonaorigen || '');
            if (cmpZona !== 0) return cmpZona;
            return (a.cliente || '').localeCompare(b.cliente || '');
        });

        const conteoFecha = {};
        const conteoZona = {};

        filasOrdenadas.forEach(f => {
            const fec = f.fechaproceso;
            const zonaKey = `${f.fechaproceso}|${f.zonaorigen || ''}`;
            conteoFecha[fec] = (conteoFecha[fec] || 0) + 1;
            conteoZona[zonaKey] = (conteoZona[zonaKey] || 0) + 1;
        });

        const fechasRenderizadas = new Set();
        const zonasRenderizadas = new Set();

        const card = document.createElement('div');
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        card.innerHTML = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Porcentaje de Merma Diaria por Fecha de Proceso, Cliente, Objetivo
                    </h2>
                    <p class="text-xs text-slate-500 mt-0.5">
                        Análisis comparativo de Merma vs Objetivo y desglose de mermas operativas
                    </p>
                </div>
                
                <div class="flex flex-wrap items-center gap-4 text-[11px]">
                    <!-- Leyenda de Desvío / Variación -->
                    <div class="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg">
                        <span class="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Variación vs Objetivo:</span>
                        <div class="flex items-center gap-1.5" title="Favorable: merma menor al objetivo">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#2CA02C]"></span>
                            <span class="font-mono text-slate-600 font-medium">&le; -5%</span>
                        </div>
                        <div class="flex items-center gap-1.5" title="En margen">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#E0AA15]"></span>
                            <span class="font-mono text-slate-600 font-medium">&plusmn;5%</span>
                        </div>
                        <div class="flex items-center gap-1.5" title="Desfavorable: merma superior al objetivo">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#D62728]"></span>
                            <span class="font-mono text-slate-600 font-medium">&ge; +10%</span>
                        </div>
                    </div>

                    <div class="text-slate-500 font-medium">
                        Período: <strong class="text-slate-800 font-semibold">${this.currentPeriodo.inicio} al ${this.currentPeriodo.fin}</strong>
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto max-h-[76vh] overflow-y-auto custom-scrollbar">
                <table class="w-full text-left text-xs border-separate border-spacing-0">
                    <thead class="sticky top-0 z-30 bg-blue-600 text-white border-b border-slate-300 shadow-xs">
                        <tr class="text-[10px] font-bold uppercase tracking-wider">
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">Día de fechap..</th>
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">zonaorigen</th>
                            <th class="px-3 py-2.5 whitespace-nowrap text-left border-b border-r border-slate-200">cliente</th>
                            
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Objetivo</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Total</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Total (Var)</th>
                            
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Entrada</th>
                            <th class="px-3 py-2.5 text-center min-w-[110px] border-b border-r border-slate-200">Merma Almacenaje</th>
                            <th class="px-3 py-2.5 text-center min-w-[120px] border-b border-r border-slate-200">Merma Muerto Distribucion</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Muerto Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[110px] border-b border-r border-slate-200">Merma No Apto</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-r border-slate-200">Merma Transporte</th>
                            <th class="px-3 py-2.5 text-center min-w-[110px] border-b border-r border-slate-200">Merma Bene Manual</th>
                            <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-slate-200">Merma Bene Mecaniza</th>
                        </tr>
                    </thead>
                    <tbody class="text-slate-700">
                        ${filasOrdenadas.map(r => {
            const fec = r.fechaproceso;
            const zonaKey = `${r.fechaproceso}|${r.zonaorigen || ''}`;

            let celdaFecha = '';
            if (!fechasRenderizadas.has(fec)) {
                fechasRenderizadas.add(fec);
                celdaFecha = `
                                    <td rowspan="${conteoFecha[fec]}" class="px-3 py-2 font-semibold text-slate-800 bg-slate-50/80 border-r border-b border-slate-200 align-top text-left text-[11px]">
                                        <div class="sticky top-[42px] z-10 py-1 font-semibold text-slate-800">
                                            ${r.fecha_formateada || fec}
                                        </div>
                                    </td>
                                `;
            }

            let celdaZona = '';
            if (!zonasRenderizadas.has(zonaKey)) {
                zonasRenderizadas.add(zonaKey);
                celdaZona = `
                                    <td rowspan="${conteoZona[zonaKey]}" class="px-3 py-2 font-bold text-slate-700 bg-slate-50/40 border-r border-b border-slate-200 align-top text-left uppercase tracking-wider text-[11px]">
                                        <div class="sticky top-[42px] z-10 py-1 font-bold text-slate-700">
                                            ${r.zonaorigen || ''}
                                        </div>
                                    </td>
                                `;
            }

            // Metadatos empaquetados para la barra interactiva y tooltip
            const meta = {
                cliente: r.cliente,
                fecha: r.fecha_formateada || fec,
                total: this.formatearPorcentaje(r.pct_mermatotal),
                alm: this.formatearNumeroTableau(r.sum_mermaalmacenaje),
                muertodist: this.formatearNumeroTableau(r.sum_mermamuertodistribucion),
                muertotransp: this.formatearNumeroTableau(r.sum_mermamuertotransporte),
                noapto: this.formatearNumeroTableau(r.sum_mermanoapto),
                transp: this.formatearNumeroTableau(r.sum_mermatransporte)
            };

            return `
                                <tr class="hover:bg-slate-50/40 transition-colors text-[11px] border-b border-slate-100">
                                    ${celdaFecha}
                                    ${celdaZona}
                                    <td class="px-3 py-2 font-bold text-slate-800 bg-white border-r border-b border-slate-100 align-middle text-left uppercase tracking-wider text-[11px] whitespace-nowrap">
                                        ${r.cliente}
                                    </td>

                                    <!-- 1. Objetivo (%) - Barra Verde -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.avg_objetivo, 5.0, '#59A14F', meta, true, 'objetivo')}
                                    </td>

                                    <!-- 2. Merma Total (%) - Barra Azul -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.pct_mermatotal, 5.0, '#1F77B4', meta, true, 'mermatotal')}
                                    </td>

                                    <!-- 3. Merma Total (Variación vs Objetivo) - Punto y % -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100 text-left">
                                        ${this.generarPuntoVariacion(r.pct_variacion, r.avg_objetivo, meta)}
                                    </td>

                                    <!-- 4. Entrada - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.total_entrada, 100000.0, '#8C8C8C', meta, false, 'entrada')}
                                    </td>

                                    <!-- 5. Merma Almacenaje - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermaalmacenaje, 40.0, '#8C8C8C', meta, false, 'mermaalmacenaje')}
                                    </td>

                                    <!-- 6. Merma Muerto Distribucion - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermamuertodistribucion, 10.0, '#8C8C8C', meta, false, 'mermamuertodistribucion')}
                                    </td>

                                    <!-- 7. Merma Muerto Transporte - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermamuertotransporte, 600.0, '#8C8C8C', meta, false, 'mermamuertotransporte')}
                                    </td>

                                    <!-- 8. Merma No Apto - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermanoapto, 60.0, '#8C8C8C', meta, false, 'mermanoapto')}
                                    </td>

                                    <!-- 9. Merma Transporte - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermatransporte, 3000.0, '#8C8C8C', meta, false, 'mermatransporte')}
                                    </td>

                                    <!-- 10. Merma Bene Manual - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-r border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermatransbenemanual, 100.0, '#8C8C8C', meta, false, 'mermatransbenemanual')}
                                    </td>

                                    <!-- 11. Merma Bene Mecaniza - Barra Gris + Valor -->
                                    <td class="px-3 py-1.5 border-b border-slate-100">
                                        ${this.generarBarraColor(r.sum_mermatransbenemecani, 2000.0, '#8C8C8C', meta, false, 'mermatransbenemecani')}
                                    </td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>

                    <tfoot class="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300 text-[9px] font-mono text-slate-500">
                        <tr>
                            <td colspan="3" class="px-3 py-1 text-right font-bold uppercase tracking-wider text-slate-600 border-r border-slate-200">
                                Escala
                            </td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00% 5,00%</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00% 5,00%</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">-50,00% 0,00% 50,00%</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0,00 100.000,00</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0 20 40</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0 5 10</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0 200 400 600</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0 20 40 60</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0 1000 2000 3000</td>
                            <td class="px-2 py-1 border-r border-slate-200 text-left">0</td>
                            <td class="px-2 py-1 text-left">0 1000 2000</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        contenedor.appendChild(card);
        this.asignarEventosTooltipMermas();
    }

    renderizarPorcMermaProcesoDiaClienteZonaPlaca(data) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = `<div class="p-6 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 font-semibold">Vista PorcMermaProcesoDiaClienteZonaPlaca en desarrollo.</div>`;
    }

    escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    formatearNumeroTableau(numero, decimales = 2) {
        if (numero === null || numero === undefined || isNaN(numero)) return '0,00';
        const num = Number(numero);
        const partes = num.toFixed(decimales).split('.');
        partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return partes.join(',');
    }

    formatearPorcentaje(pct) {
        if (pct === null || pct === undefined || isNaN(pct)) return '0,00%';
        return Number(pct).toFixed(2).replace('.', ',') + '%';
    }

    limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_fechas';

        this.setupPeriodo();

        const selGrafico = document.getElementById('select-tipo-grafico');
        if (selGrafico) selGrafico.value = 'PorcMermaProcesoDiaClientePlaca';

        const selDato = document.getElementById('select-filtro-dato');
        if (selDato) selDato.value = 'Valor';

        this.searchCliente?.reset();
        this.searchPlacaMatriz?.reset();
        this.actualizarVisibilidadFiltros();
        this.destruirGraficos();
        this.cacheData = null;
        this.cachePayload = null;
        this.todasLasPlacas = [];
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) contenedor.innerHTML = '';

        // Recargar automáticamente tras limpiar
        this.onCargarClick();
    }


    setupModales() {
        const modalDash = document.getElementById('modal-detalle-dashprueba');
        const btnCerrar = document.getElementById('btn-cerrar-modal-dash');
        const btnToggleVerTodos = document.getElementById('btn-toggle-modal-ver-todos');

        btnCerrar?.addEventListener('click', () => {
            modalDash?.classList.add('hidden');
        });

        // Alternar entre ver la placa seleccionada o ver todas las placas
        btnToggleVerTodos?.addEventListener('click', async () => {
            this.modalDashState.viendoTodos = !this.modalDashState.viendoTodos;
            btnToggleVerTodos.textContent = this.modalDashState.viendoTodos
                ? 'Ver placa seleccionada'
                : 'Ver todas las placas';

            await this.cargarDatosModalDash();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modalDash?.classList.add('hidden');
            }
        });
    }

    poblarSelectPlacas(filas) {
        const selPlaca = document.getElementById('select-filtro-placa');
        if (!selPlaca) return;

        const valorActual = selPlaca.value;

        // Solo repoblamos el universo de placas cuando se consulta sin filtro individual
        if (valorActual === 'TODO' || this.todasLasPlacas.length === 0) {
            const placasSet = new Set();
            filas.forEach(f => {
                if (f.placa) placasSet.add(f.placa.trim());
            });
            this.todasLasPlacas = Array.from(placasSet).sort();

            let optionsHtml = `<option value="TODO" selected>(Todo)</option>`;
            this.todasLasPlacas.forEach(p => {
                optionsHtml += `<option value="${p}">${p}</option>`;
            });
            selPlaca.innerHTML = optionsHtml;
        }

        if (valorActual && valorActual !== 'TODO') {
            selPlaca.value = valorActual;
        }
    }

    renderizarDashPrueba1(filas) {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        const filasOrdenadas = [...filas].sort((a, b) => {
            const cF = (a.fechaproceso || '').localeCompare(b.fechaproceso || '');
            if (cF !== 0) return cF;
            const cZ = (a.zonaorigen || '').localeCompare(b.zonaorigen || '');
            if (cZ !== 0) return cZ;
            const cC = (a.cliente || '').localeCompare(b.cliente || '');
            if (cC !== 0) return cC;
            return (a.placa || '').localeCompare(b.placa || '');
        });

        const conteoFecha = {}, conteoZona = {}, conteoCliente = {};
        filasOrdenadas.forEach(f => {
            const fec = f.fechaproceso;
            const zK = `${fec}|${f.zonaorigen || ''}`;
            const cK = `${fec}|${f.zonaorigen || ''}|${f.cliente}`;
            conteoFecha[fec] = (conteoFecha[fec] || 0) + 1;
            conteoZona[zK] = (conteoZona[zK] || 0) + 1;
            conteoCliente[cK] = (conteoCliente[cK] || 0) + 1;
        });

        const fechasVistas = new Set(), zonasVistas = new Set(), clientesVistos = new Set();
        const card = document.createElement('div');
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        card.innerHTML = `
        <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Merma de Proceso, Placa, Objetivo</h2>
                <p class="text-xs text-slate-500 mt-0.5">Haga clic sobre cualquier placa para ver su Hoja de Ruta y Agentes Causales</p>
            </div>
            <div class="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-[11px]">
                <span class="font-bold text-slate-700 text-[10px] uppercase">Semáforo:</span>
                <span class="inline-flex items-center gap-1 text-emerald-700 font-medium"><span class="w-2.5 h-2.5 rounded-full bg-[#2CA02C]"></span>&le; -5%</span>
                <span class="inline-flex items-center gap-1 text-amber-700 font-medium"><span class="w-2.5 h-2.5 rounded-full bg-[#E0AA15]"></span>&plusmn;5%</span>
                <span class="inline-flex items-center gap-1 text-rose-700 font-medium"><span class="w-2.5 h-2.5 rounded-full bg-[#D62728]"></span>&ge; +10%</span>
            </div>
        </div>

        <div class="overflow-x-auto max-h-[76vh] overflow-y-auto custom-scrollbar">
            <table class="w-full text-left text-xs border-separate border-spacing-0">
                <thead class="sticky top-0 z-30 bg-blue-600 text-white border-b border-slate-300 shadow-xs">
                    <tr class="text-[10px] font-bold uppercase tracking-wider">
                        <th class="px-3 py-2.5 whitespace-nowrap border-b border-r border-slate-200">Día de fechap..</th>
                        <th class="px-3 py-2.5 whitespace-nowrap border-b border-r border-slate-200">zonaorigen</th>
                        <th class="px-3 py-2.5 whitespace-nowrap border-b border-r border-slate-200">cliente</th>
                        <th class="px-3 py-2.5 whitespace-nowrap border-b border-r border-slate-200">placa</th>
                        <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Prom. objetivo</th>
                        <th class="px-3 py-2.5 text-center min-w-[140px] border-b border-r border-slate-200">Merma Total</th>
                        <th class="px-3 py-2.5 text-center min-w-[130px] border-b border-slate-200">Merma Total (Var)</th>
                    </tr>
                </thead>
                <tbody class="text-slate-700">
                    ${filasOrdenadas.map(r => {
            const fec = r.fechaproceso;
            const zK = `${fec}|${r.zonaorigen || ''}`;
            const cK = `${fec}|${r.zonaorigen || ''}|${r.cliente}`;

            let tdFecha = '';
            if (!fechasVistas.has(fec)) {
                fechasVistas.add(fec);
                tdFecha = `<td rowspan="${conteoFecha[fec]}" class="px-3 py-2 font-semibold text-slate-800 bg-slate-50/80 border-r border-b border-slate-200 align-top"><div class="sticky top-[42px] z-10 py-1">${r.fecha_formateada || fec}</div></td>`;
            }

            let tdZona = '';
            if (!zonasVistas.has(zK)) {
                zonasVistas.add(zK);
                tdZona = `<td rowspan="${conteoZona[zK]}" class="px-3 py-2 font-bold text-slate-700 bg-slate-50/40 border-r border-b border-slate-200 align-top uppercase"><div class="sticky top-[42px] z-10 py-1">${r.zonaorigen || ''}</div></td>`;
            }

            let tdCliente = '';
            if (!clientesVistos.has(cK)) {
                clientesVistos.add(cK);
                tdCliente = `<td rowspan="${conteoCliente[cK]}" class="px-3 py-2 font-bold text-slate-800 bg-white border-r border-b border-slate-200 align-top uppercase"><div class="sticky top-[42px] z-10 py-1">${r.cliente}</div></td>`;
            }

            const meta = { cliente: r.cliente, fecha: r.fecha_formateada || fec, total: this.formatearPorcentaje(r.pct_mermatotal) };

            return `
                            <tr class="hover:bg-blue-50/50 transition-colors text-[11px] border-b border-slate-100 fila-placa-click cursor-pointer"
                                data-fecha="${fec}" data-fecha-txt="${r.fecha_formateada || fec}" data-cliente="${r.cliente}" data-placa="${r.placa}">
                                ${tdFecha}
                                ${tdZona}
                                ${tdCliente}
                                <td class="px-3 py-2 font-mono font-bold text-blue-700 hover:text-blue-900 underline whitespace-nowrap border-r border-b border-slate-100 bg-white">${r.placa}</td>
                                <td class="px-3 py-1.5 border-r border-b border-slate-100">${this.generarBarraColor(r.prom_objetivo, 6.0, '#59A14F', meta, true, 'Prom. objetivo')}</td>
                                <td class="px-3 py-1.5 border-r border-b border-slate-100">${this.generarBarraColor(r.pct_mermatotal, 8.0, '#1F77B4', meta, true, 'Merma Total')}</td>
                                <td class="px-3 py-1.5 border-b border-slate-100 text-left">${this.generarPuntoVariacion(r.variacion_pct, r.prom_objetivo, meta)}</td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        </div>
    `;

        contenedor.appendChild(card);
        this.asignarEventosTooltipMermas();
        this.asignarEventosClickPlaca();
    }

    asignarEventosClickPlaca() {
        document.querySelectorAll('.fila-placa-click').forEach(fila => {
            fila.addEventListener('click', () => {
                const fechaproceso = fila.getAttribute('data-fecha');
                const fechaTxt = fila.getAttribute('data-fecha-txt');
                const cliente = fila.getAttribute('data-cliente');
                const placa = fila.getAttribute('data-placa');
                this.abrirModalDetalleDashPrueba({ fechaproceso, fechaTxt, cliente, placa });
            });
        });
    }

    async abrirModalDetalleDashPrueba({ fechaproceso, fechaTxt, cliente, placa }) {
        const modal = document.getElementById('modal-detalle-dashprueba');
        if (!modal) return;

        this.modalDashState = {
            fechaproceso,
            fechaTxt,
            cliente,
            placaSeleccionada: placa,
            viendoTodos: false
        };

        const btnToggle = document.getElementById('btn-toggle-modal-ver-todos');
        if (btnToggle) btnToggle.textContent = 'Ver todas las placas';

        modal.classList.remove('hidden');
        await this.cargarDatosModalDash();
    }

    async cargarDatosModalDash() {
        const loader = document.getElementById('loader-modal-dash');
        const contenido = document.getElementById('contenido-modal-dash');
        const titulo = document.getElementById('modal-dash-titulo');
        const subtitulo = document.getElementById('modal-dash-subtitulo');

        const { fechaproceso, fechaTxt, cliente, placaSeleccionada, viendoTodos } = this.modalDashState;

        if (titulo) {
            titulo.textContent = viendoTodos
                ? `Todas las unidades | ${fechaTxt}`
                : `Placa: ${placaSeleccionada} | ${cliente}`;
        }
        if (subtitulo) {
            subtitulo.textContent = viendoTodos
                ? `Mostrando eventos y causas de todas las placas del día`
                : `Día de fechaproceso: ${fechaTxt}`;
        }

        loader?.classList.remove('hidden');
        contenido?.classList.add('hidden');

        try {
            const payload = {
                fechaproceso: fechaproceso,
                placa: viendoTodos ? 'TODO' : placaSeleccionada
            };

            const res = await this.service.consultarDetallePlacaRutaCausales(payload);
            loader?.classList.add('hidden');

            if (res && res.success && res.payload) {
                const ruta = res.payload.ruta || [];
                const causales = res.payload.causales || [];

                this.renderizarTablaModalRuta(ruta, viendoTodos ? 'Todas' : placaSeleccionada);
                this.renderizarTablaModalCausales(causales, viendoTodos ? 'Todos' : cliente, viendoTodos ? 'Todas' : placaSeleccionada);

                contenido?.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Error al cargar datos del modal:', err);
            loader?.classList.add('hidden');
        }
    }

    renderizarTablaModalRuta(ruta, placa) {
        const tbody = document.getElementById('tbody-modal-ruta');
        const badge = document.getElementById('badge-contador-ruta');
        if (badge) badge.textContent = `${ruta.length} eventos`;
        if (!tbody) return;

        if (ruta.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-xs text-slate-400">Sin eventos en hoja de ruta.</td></tr>`;
            return;
        }

        tbody.innerHTML = ruta.map(r => {
            const area = (r.arearesponsable || '').trim().toUpperCase();
            const esGeneral = area === 'GENERAL';
            const esTransp = area === 'TRANSPORTE';

            return `
                <tr class="hover:bg-slate-50 text-[11px] border-b border-slate-100">
                    <td class="px-3 py-1.5 font-mono font-bold text-center border-r border-slate-100">${r.placa || placa}</td>
                    <td class="px-3 py-1.5 font-mono text-center border-r border-slate-100">${r.numeroruta || '-'}</td>
                    <td class="px-3 py-1.5 text-center border-r border-slate-100 whitespace-nowrap">${r.fecha || '-'}</td>
                    <td class="px-3 py-1.5 font-mono text-center border-r border-slate-100 whitespace-nowrap">${r.hora || '-'}</td>
                    <td class="px-3 py-1.5 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">${r.evento || '-'}</td>
                    <td class="px-3 py-1.5 text-slate-600 border-r border-slate-100">${r.localizacion || '-'}</td>
                    <td class="px-2 py-1.5 text-center border-r border-slate-100 w-20">
                        ${esGeneral ? '<span class="inline-block w-2.5 h-2.5 bg-[#2CA02C]"></span>' : ''}
                    </td>
                    <td class="px-2 py-1.5 text-center w-24">
                        ${esTransp ? '<span class="inline-block w-2.5 h-2.5 bg-[#1F77B4]"></span>' : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderizarTablaModalCausales(causales, cliente, placa) {
        const tbody = document.getElementById('tbody-modal-causales');
        const badge = document.getElementById('badge-contador-causales');
        if (badge) badge.textContent = `${causales.length} registros`;
        if (!tbody) return;

        if (causales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-6 text-center text-xs text-slate-400">Sin agentes causales registrados.</td></tr>`;
            return;
        }

        // 1. Ordenar por jerarquía Tableau: Cliente -> Placa -> Área -> Código -> Hora
        const lista = [...causales].sort((a, b) => {
            const cliA = a.cliente || cliente, cliB = b.cliente || cliente;
            if (cliA.localeCompare(cliB) !== 0) return cliA.localeCompare(cliB);

            const plcA = a.placa || placa, plcB = b.placa || placa;
            if (plcA.localeCompare(plcB) !== 0) return plcA.localeCompare(plcB);

            const arA = a.area || '', arB = b.area || '';
            if (arA.localeCompare(arB) !== 0) return arA.localeCompare(arB);

            const cdA = a.codigoconta || '', cdB = b.codigoconta || '';
            if (cdA.localeCompare(cdB) !== 0) return cdA.localeCompare(cdB);

            return (a.horaregistro || '').localeCompare(b.horaregistro || '');
        });

        // 2. Calcular spans contiguos para evitar desfasajes entre filas
        const n = lista.length;
        const spanCli = new Array(n).fill(1);
        const spanPlaca = new Array(n).fill(1);
        const spanArea = new Array(n).fill(1);

        for (let i = n - 2; i >= 0; i--) {
            const act = lista[i], sig = lista[i + 1];
            const mismoCli = (act.cliente || cliente) === (sig.cliente || cliente);
            const mismaPlaca = mismoCli && ((act.placa || placa) === (sig.placa || placa));
            const mismaArea = mismaPlaca && ((act.area || '') === (sig.area || ''));

            if (mismoCli) spanCli[i] = spanCli[i + 1] + 1;
            if (mismaPlaca) spanPlaca[i] = spanPlaca[i + 1] + 1;
            if (mismaArea) spanArea[i] = spanArea[i + 1] + 1;
        }

        let html = '';
        for (let i = 0; i < n; i++) {
            const c = lista[i];
            const cli = c.cliente || cliente;
            const plc = c.placa || placa;
            const ar = c.area || '-';

            // Celda Cliente
            let tdCli = '';
            if (i === 0 || spanCli[i - 1] === 1 || (lista[i - 1].cliente || cliente) !== cli) {
                tdCli = `<td rowspan="${spanCli[i]}" class="px-3 py-2 font-bold text-slate-800 bg-slate-50 border-r border-b border-slate-200 align-top uppercase whitespace-nowrap">${cli}</td>`;
            }

            // Celda Placa
            let tdPlaca = '';
            if (i === 0 || spanPlaca[i - 1] === 1 || (lista[i - 1].placa || placa) !== plc || (lista[i - 1].cliente || cliente) !== cli) {
                tdPlaca = `<td rowspan="${spanPlaca[i]}" class="px-3 py-2 font-mono font-bold text-slate-800 bg-white border-r border-b border-slate-200 align-top text-center whitespace-nowrap">${plc}</td>`;
            }

            // Celda Área
            let tdArea = '';
            if (i === 0 || spanArea[i - 1] === 1 || (lista[i - 1].area || '') !== (c.area || '') || (lista[i - 1].placa || placa) !== plc) {
                tdArea = `<td rowspan="${spanArea[i]}" class="px-3 py-2 font-medium text-slate-700 bg-white border-r border-b border-slate-200 align-top whitespace-nowrap">${ar}</td>`;
            }

            html += `
                <tr class="hover:bg-slate-50 transition-colors text-[11px] border-b border-slate-100">
                    ${tdCli}
                    ${tdPlaca}
                    ${tdArea}
                    <td class="px-3 py-1.5 font-mono font-bold text-indigo-700 text-center border-r border-slate-100 whitespace-nowrap align-top">${c.codigoconta || '-'}</td>
                    <td class="px-3 py-1.5 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap align-top">${c.causatipo || '-'}</td>
                    <td class="px-3 py-1.5 text-slate-600 text-center border-r border-slate-100 whitespace-nowrap align-top">${c.fecharegistro || '-'}</td>
                    <td class="px-3 py-1.5 font-mono text-slate-600 text-center border-r border-slate-100 whitespace-nowrap align-top">${c.horaregistro || '-'}</td>
                    <td class="px-3 py-1.5 text-slate-700 leading-snug align-top">${c.descripcion || '-'}</td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }

}

// Instanciación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.almacenMermasVivoController = new AlmacenMermasVivoController();
});