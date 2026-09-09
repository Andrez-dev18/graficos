class AlmacenMermasVivoController {
    constructor() {
        this.service = new AlmacenMermasVivoService();

        // Estado y Filtros Activos
        this.currentPeriodo = { inicio: '', fin: '' };
        this.cacheData = null;
        this.activeCharts = [];

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

        // Primera carga automática
        await this.onCargarClick();
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

        return {
            tipo_grafico: document.getElementById('select-tipo-grafico')?.value || 'PorcMermaProcesoDiaClientePlaca',
            dato: document.getElementById('select-filtro-dato')?.value || 'TODO',
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

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center">
                <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <h3 class="text-base font-bold text-slate-800">Consultando ${filtros.tipo_grafico}...</h3>
                <p class="text-xs text-slate-500 mt-1">Cargando métricas de mermas para el período seleccionado</p>
            </div>
        `;

        try {
            const res = await this.service.consultarGrafico(filtros.tipo_grafico, filtros);

            if (res && res.success && res.payload && res.payload.data && res.payload.data.length > 0) {
                this.cacheData = res.payload.data;
                this.enrutarRenderizado(filtros.tipo_grafico, this.cacheData);
            } else {
                this.cacheData = null;
                contenedor.innerHTML = `
                    <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center">
                        <h3 class="text-sm font-bold text-slate-700">No se encontraron registros</h3>
                        <p class="text-xs text-slate-500 mt-1">Intente cambiando el rango de fechas o el filtro de datos.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-rose-200 p-8 flex flex-col items-center justify-center text-center text-rose-600">
                    <h3 class="text-sm font-bold">Error de consulta</h3>
                    <p class="text-xs text-rose-500 mt-1">${error.message || 'Error inesperado.'}</p>
                </div>
            `;
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

        this.destruirGraficos();
        this.cacheData = null;
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) contenedor.innerHTML = '';

        // Recargar automáticamente tras limpiar
        this.onCargarClick();
    }
}

// Instanciación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.almacenMermasVivoController = new AlmacenMermasVivoController();
});