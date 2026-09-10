/**
 * Controlador para la vista del módulo Transportes
 */
class TransportesController {
    constructor() {
        this.service = new TransportesService();
        this.chartTendencia = null;

        // Estado de filtros del formulario principal
        this.filtrosForm = {
            fechaInicio: '',
            fechaFin: '',
            validador: 'TODO'
        };

        // Estado de interacción reactiva cruzada (al hacer clic en gráficos/tablas)
        this.filtroActivo = {
            fecha: null,      // '2026-09-09', etc.
            validador: null,  // 'completo' | 'incompleto'
            placa: null       // 'VBT863', etc.
        };

        // Almacenamiento de datos devueltos por el backend
        this.datosMetricas = [];
        this.datosHojasRuta = [];
        this.datosDetalleRuta = [];

        this.init();
    }

    async init() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        this.setupPeriodo();
        this.setupListeners();
        this.setupTooltips();
        await this.onCargarClick();
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.renderizarInputs) {
            PeriodoHelper.renderizarInputs();

            // Por defecto últimos 15 días si no se seleccionó
            const inputIni = document.getElementById('input-fecha-inicio');
            const inputFin = document.getElementById('input-fecha-fin');
            if (inputIni && !inputIni.value) {
                const hoy = new Date();
                const hace15 = new Date();
                hace15.setDate(hoy.getDate() - 15);
                inputIni.value = PeriodoHelper.formatYMD(hace15);
            }
            if (inputFin && !inputFin.value) {
                inputFin.value = PeriodoHelper.formatYMD(new Date());
            }
        }
    }

    setupTooltips() {
        const tooltip = document.getElementById('tooltip-tableau-transporte');
        if (!tooltip) return;

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip-totales]');
            if (target) {
                const fechatxt = target.getAttribute('data-tt-fecha');
                const validador = target.getAttribute('data-tt-validador');
                const pct = target.getAttribute('data-tt-pct');
                const cant = target.getAttribute('data-tt-cant');
                const total = target.getAttribute('data-tt-total');

                tooltip.innerHTML = `
                    <div class="space-y-1">
                        <div class="text-[11px] font-bold text-slate-800 border-b border-slate-100 pb-1">
                            ${fechatxt}
                        </div>
                        <div class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                            <span class="text-slate-400">validador:</span>
                            <span class="font-bold text-slate-800 text-right capitalize">${validador}</span>
                            <span class="text-slate-400">% de total:</span>
                            <span class="font-bold font-mono text-slate-900 text-right">${pct}</span>
                            ${cant ? `<span class="text-slate-400">Conteo:</span><span class="font-semibold text-slate-700 text-right">${cant}</span>` : ''}
                            ${total ? `<span class="text-slate-400">Total Día:</span><span class="font-semibold text-slate-700 text-right">${total}</span>` : ''}
                        </div>
                    </div>
                `;

                tooltip.classList.remove('hidden');
                const tooltipWidth = tooltip.offsetWidth || 220;
                const tooltipHeight = tooltip.offsetHeight || 100;
                const x = Math.min(e.clientX + 14, window.innerWidth - tooltipWidth - 20);
                const y = Math.min(e.clientY + 14, window.innerHeight - tooltipHeight - 20);

                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;
            } else {
                tooltip.classList.add('hidden');
            }
        });
    }

    setupListeners() {
        // Selector de tipo de período dinámico
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) {
            selPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
            });
        }

        // Toggle plegar / desplegar barra de filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const contFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');

        if (btnToggle && contFiltros) {
            btnToggle.addEventListener('click', () => {
                const estaOculto = contFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = estaOculto ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = estaOculto ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', async () => {
            await this.onCargarClick();
        });

        // Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', async () => {
            await this.limpiarFiltros();
        });

    }

    mostrarLoaders() {
        const loaderHtml = `
            <div class="h-full w-full flex flex-col items-center justify-center gap-2 text-blue-600 p-8">
                <svg class="animate-spin h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span class="text-xs font-semibold text-slate-500">Cargando datos de transportes...</span>
            </div>
        `;

        const contTotales = document.getElementById('contenedor-totales-diarios');
        const tbodyHojas = document.getElementById('tbody-hojas-ruta');
        const tbodyDetalle = document.getElementById('tbody-detalle-ruta');

        if (contTotales) contTotales.innerHTML = loaderHtml;
        if (tbodyHojas) tbodyHojas.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-xs text-slate-400">Consultando hojas de ruta...</td></tr>`;
        if (tbodyDetalle) tbodyDetalle.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-xs text-slate-400">Consultando detalle de eventos...</td></tr>`;
    }

    async onCargarClick() {
        let rango = {};
        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
            rango = PeriodoHelper.obtenerRangoFechas();
        }

        this.filtrosForm.fechaInicio = rango.fechaInicio || rango.inicio || '2026-08-24';
        this.filtrosForm.fechaFin = rango.fechaFin || rango.fin || '2026-09-09';
        this.filtrosForm.validador = 'TODO';

        // Reset filtro interactivo
        this.filtroActivo = { fecha: null, validador: null, placa: null };
        this.actualizarBadgeFiltro();

        this.mostrarLoaders();

        const payloadFiltros = {
            fecha_inicio: this.filtrosForm.fechaInicio,
            fecha_fin: this.filtrosForm.fechaFin,
            validador: this.filtrosForm.validador
        };

        const res = await this.service.obtenerDashboard(payloadFiltros);

        if (res && res.success && res.payload) {
            const payload = res.payload;

            // Mapeo métricas
            this.datosMetricas = (payload.metricas || []).map(m => ({
                fechaYMD: m.fechaproceso,
                fechaTxt: this.formatearFechaTableau(m.fechaproceso),
                completo: Number(m.pct_completo || 0),
                incompleto: Number(m.pct_incompleto || 0),
                totalDespachos: Number(m.total_despachos || 0),
                cantCompleto: Number(m.cant_completo || 0),
                cantIncompleto: Number(m.cant_incompleto || 0)
            }));

            // Mapeo hojas de ruta
            this.datosHojasRuta = (payload.hojas_ruta || []).map(h => ({
                fecha: h.fechaproceso,
                diaTxt: h.fecha_txt || this.formatearFechaTableau(h.fechaproceso),
                zona: h.zona || 'SIN ZONA',
                transportista: h.transportista || '',
                chofer: h.chofer || '',
                placa: h.placa || '',
                validador: (h.validador || '').toLowerCase()
            }));

            // Mapeo detalle eventos
            this.datosDetalleRuta = (payload.detalle_eventos || []).map(d => ({
                fecha: d.fechaproceso,
                zona: d.zona || 'SIN ZONA',
                placa: d.placa || '',
                dia: d.dia || d.fechaproceso,
                diaTxt: d.dia_txt || this.formatearDiaCorta(d.dia || d.fechaproceso),
                hora: d.hora || '',
                tipo: d.tipo || '',
                validador: (d.validador || '').toLowerCase()
            }));
        } else {
            console.error('Error o respuesta vacía del servidor:', res?.message);
            this.datosMetricas = [];
            this.datosHojasRuta = [];
            this.datosDetalleRuta = [];
        }

        this.renderizarTodo();
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_fechas';
        this.setupPeriodo();

        this.filtroActivo = { fecha: null, validador: null, placa: null };
        this.actualizarBadgeFiltro();
        await this.onCargarClick();
    }

    actualizarBadgeFiltro() {
        const labelPlaca = document.getElementById('label-placa-filtrada');
        if (labelPlaca) {
            if (this.filtroActivo.placa) {
                labelPlaca.textContent = `Placa: ${this.filtroActivo.placa}`;
                labelPlaca.classList.remove('hidden');
            } else {
                labelPlaca.classList.add('hidden');
            }
        }
    }

    formatearFechaTableau(fecha) {
        if (!fecha) return '';
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        const partes = fecha.split('-');
        if (partes.length !== 3) return fecha;
        const dia = parseInt(partes[2]);
        const mes = meses[parseInt(partes[1]) - 1] || partes[1];
        const anio = partes[0];
        return `${dia} de ${mes} de ${anio}`;
    }

    formatearDiaCorta(fecha) {
        if (!fecha || fecha === '0000-00-00') return '';
        const partes = fecha.split('-');
        if (partes.length !== 3) return fecha;
        const dia = parseInt(partes[2]);
        const mes = parseInt(partes[1]);
        const anio = partes[0];
        return `${dia}/${mes}/${anio}`;
    }

    renderizarTodo() {
        this.renderizarTotalesDiarios();
        this.renderizarChartTendencia();
        this.renderizarHojasRuta();
        this.renderizarDetalleRuta();
    }

    /**
     * 1. TOTALES DIARIOS: Matriz Tableau con Barras Verticales por Fila de Fecha
     * Soporta Filtro Cruzado, Foco en elemento y difuminado del resto
     */
    renderizarTotalesDiarios() {
        const cont = document.getElementById('contenedor-totales-diarios');
        if (!cont) return;

        let datos = [...this.datosMetricas];

        // Orden descendente por fecha (estilo Tableau: 9/9/2026, 8/9/2026, 7/9/2026...)
        datos.sort((a, b) => b.fechaYMD.localeCompare(a.fechaYMD));

        if (datos.length === 0) {
            cont.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin datos para el período seleccionado.</div>`;
            return;
        }

        const hayFiltro = Boolean(this.filtroActivo.fecha || this.filtroActivo.validador);

        // Caso especial Tableau: Cuando el filtro proviene del gráfico de líneas (TENDENCIA DIARIA),
        // solo queda visible el elemento del punto seleccionado (fecha seleccionada, validador al 100% y Total general al 100%)
        if (this.filtroActivo.origen === 'tendencia' && this.filtroActivo.fecha) {
            const d = datos.find(item => item.fechaYMD === this.filtroActivo.fecha);
            if (d) {
                const partesFec = d.fechaYMD.split('-');
                const fechaCorta = `${parseInt(partesFec[2])}/${parseInt(partesFec[1])}/${partesFec[0]}`;
                const valFiltro = this.filtroActivo.validador || 'completo';
                const esComp = (valFiltro === 'completo');
                const colorBarra = esComp ? '#59A14F' : '#E15759';
                const labelValidador = esComp ? 'completo' : 'incompleto';

                const htmlTendencia = `
                    <table class="w-full text-xs border-collapse table-fixed">
                        <colgroup>
                            <col style="width: 80px;">
                            <col style="width: 20px;">
                            <col style="width: 44px;">
                            <col>
                            <col>
                        </colgroup>
                        <thead class="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200">
                            <tr class="text-[10px] text-slate-400 font-normal">
                                <th colspan="3" class="py-1.5 pl-3 text-left font-normal text-slate-400">fechaproceso</th>
                                <th colspan="2" class="py-1.5 text-center font-normal text-slate-500 tracking-wider">validador</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <!-- Columna Fecha -->
                                <td class="pl-3 py-4 whitespace-nowrap align-middle text-[11px] font-semibold text-slate-800">
                                    <div class="cursor-pointer hover:text-blue-600 transition-colors" data-accion="toggle-filtro-linea" title="Hacer clic para restaurar">
                                        ${fechaCorta}
                                    </div>
                                </td>

                                <!-- Columna Label Vertical "% de total conteo" -->
                                <td class="p-0 text-center align-middle select-none">
                                    <div class="h-64 flex items-center justify-center">
                                        <span class="text-[8px] text-slate-400 whitespace-nowrap [writing-mode:vertical-lr] rotate-180 transform select-none">
                                            % de total conteo
                                        </span>
                                    </div>
                                </td>

                                <!-- Columna Eje Y (100%, 80%, 60%, 40%, 20%, 0%) -->
                                <td class="pr-2 py-2 text-right text-[9px] font-mono text-slate-400 select-none align-middle border-r border-slate-200/60">
                                    <div class="flex flex-col justify-between h-64 text-[9px] leading-none py-1">
                                        <span>100%</span>
                                        <span>80%</span>
                                        <span>60%</span>
                                        <span>40%</span>
                                        <span>20%</span>
                                        <span>0%</span>
                                    </div>
                                </td>

                                <!-- Columna Seleccionada (completo o incompleto al 100%) -->
                                <td class="p-2 text-center align-bottom cursor-pointer hover:opacity-90 transition-opacity celda-barra-totales"
                                    data-accion="toggle-filtro-linea"
                                    data-tooltip-totales="true"
                                    data-tt-fecha="${d.fechaTxt}"
                                    data-tt-validador="${labelValidador}"
                                    data-tt-pct="100,0%"
                                    data-tt-cant="${esComp ? d.cantCompleto : d.cantIncompleto}"
                                    data-tt-total="${d.totalDespachos}"
                                    title="Hacer clic para restaurar vista normal">
                                    <div class="flex flex-col items-center justify-end h-64 w-full relative px-3">
                                        <span class="text-[10px] font-mono font-bold text-slate-900 mb-1 whitespace-nowrap">
                                            100,0%
                                        </span>
                                        <div class="w-full max-w-[140px] transition-all rounded-xs" style="height: 100%; background-color: ${colorBarra};"></div>
                                    </div>
                                </td>

                                <!-- Columna TOTAL GENERAL al 100% -->
                                <td class="p-2 pr-3 text-center align-bottom cursor-pointer hover:opacity-90 transition-opacity celda-barra-totales"
                                    data-accion="toggle-filtro-linea"
                                    data-tooltip-totales="true"
                                    data-tt-fecha="${d.fechaTxt}"
                                    data-tt-validador="Total general"
                                    data-tt-pct="100,0%"
                                    data-tt-cant="${d.totalDespachos}"
                                    data-tt-total="${d.totalDespachos}"
                                    title="Hacer clic para restaurar vista normal">
                                    <div class="flex flex-col items-center justify-end h-64 w-full relative px-3">
                                        <span class="text-[10px] font-mono font-bold text-slate-900 mb-1 whitespace-nowrap">
                                            100,0%
                                        </span>
                                        <div class="w-full max-w-[140px] bg-[#76B7B2] transition-all rounded-xs" style="height: 100%;"></div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot class="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xs border-t border-slate-200 text-[10px] text-slate-500">
                            <tr>
                                <td colspan="3" class="py-2.5 pl-3"></td>
                                <td class="py-2.5 text-center font-medium text-slate-600">${labelValidador}</td>
                                <td class="py-2.5 pr-3 text-center font-medium text-slate-600">Total general</td>
                            </tr>
                        </tfoot>
                    </table>
                `;

                cont.innerHTML = htmlTendencia;

                // Click listener para toggle de reseteo al hacer clic en los elementos
                cont.querySelectorAll('[data-accion="toggle-filtro-linea"]').forEach(el => {
                    el.addEventListener('click', () => {
                        this.filtroActivo = { fecha: null, validador: null, placa: null, origen: null };
                        this.actualizarBadgeFiltro();
                        this.renderizarTodo();
                    });
                });

                return;
            }
        }

        // Renderizado estilo Tableau fiel normal: fechaproceso compacto, label vertical "% de total conteo", y barras ocupando todo el ancho
        const html = `
            <table class="w-full text-xs border-collapse table-fixed">
                <colgroup>
                    <col style="width: 76px;">
                    <col style="width: 18px;">
                    <col style="width: 34px;">
                    <col>
                    <col>
                    <col>
                </colgroup>
                <thead class="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200">
                    <tr class="text-[10px] text-slate-400 font-normal">
                        <th colspan="3" class="py-1.5 pl-3 text-left font-normal text-slate-400">fechaproceso</th>
                        <th colspan="3" class="py-1.5 text-center font-normal text-slate-500 tracking-wider">validador</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${datos.map(d => {
                        const partesFec = d.fechaYMD.split('-');
                        const fechaCorta = `${parseInt(partesFec[2])}/${parseInt(partesFec[1])}/${partesFec[0]}`;
                        
                        // Focos específicos por celda
                        const esFocoCompleto = (this.filtroActivo.fecha === d.fechaYMD && this.filtroActivo.validador === 'completo');
                        const esFocoIncompleto = (this.filtroActivo.fecha === d.fechaYMD && this.filtroActivo.validador === 'incompleto');
                        const esFocoTotal = (this.filtroActivo.fecha === d.fechaYMD && this.filtroActivo.origen === 'total');
                        const esFocoTodaFecha = (this.filtroActivo.fecha === d.fechaYMD && !this.filtroActivo.validador && this.filtroActivo.origen !== 'total');

                        // COMPLETO
                        const selComp = esFocoCompleto || esFocoTodaFecha;
                        const opComp = (!hayFiltro || selComp) ? 'opacity-100' : 'opacity-25';
                        const borComp = esFocoCompleto ? 'border-2 border-black ring-1 ring-black shadow-xs' : (selComp ? 'border border-slate-700' : '');
                        const txtComp = selComp ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50');

                        // INCOMPLETO
                        const selIncomp = esFocoIncompleto || esFocoTodaFecha;
                        const opIncomp = (!hayFiltro || selIncomp) ? 'opacity-100' : 'opacity-25';
                        const borIncomp = esFocoIncompleto ? 'border-2 border-black ring-1 ring-black shadow-xs' : (selIncomp ? 'border border-slate-700' : '');
                        const txtIncomp = selIncomp ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50');

                        // TOTAL GENERAL
                        const selTot = esFocoTotal || esFocoTodaFecha;
                        const opTot = (!hayFiltro || selTot) ? 'opacity-100' : 'opacity-25';
                        const borTot = esFocoTotal ? 'border-2 border-black ring-1 ring-black shadow-xs' : (selTot ? 'border border-slate-700' : '');
                        const txtTot = selTot ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50');

                        // FECHA
                        const esFechaActiva = (this.filtroActivo.fecha === d.fechaYMD);
                        const opFec = (!hayFiltro || esFechaActiva) ? 'opacity-100' : 'opacity-35';
                        const txtFec = esFechaActiva ? 'text-blue-700 font-bold' : 'text-slate-700 font-medium';

                        return `
                            <tr class="hover:bg-blue-50/20 transition-colors ${esFechaActiva ? 'bg-blue-50/40' : ''}">
                                <!-- Columna Fecha Compacta -->
                                <td class="pl-3 py-2 whitespace-nowrap align-middle text-[11px] transition-opacity duration-200 ${opFec}">
                                    <div class="cursor-pointer hover:text-blue-600 transition-colors ${txtFec}" data-accion="filtrar-fecha" data-fecha="${d.fechaYMD}" title="Filtrar por esta fecha">
                                        ${fechaCorta}
                                    </div>
                                </td>

                                <!-- Columna Label Vertical "% de total conteo" -->
                                <td class="p-0 text-center align-middle select-none">
                                    <div class="h-20 flex items-center justify-center">
                                        <span class="text-[7.5px] text-slate-400 whitespace-nowrap [writing-mode:vertical-lr] rotate-180 transform scale-90 select-none">
                                            % de total conteo
                                        </span>
                                    </div>
                                </td>

                                <!-- Columna Eje Y (100%, 50%, 0%) con línea divisoria sutil -->
                                <td class="pr-1.5 py-1 text-right text-[8px] font-mono text-slate-400 select-none align-middle border-r border-slate-200/60">
                                    <div class="flex flex-col justify-between h-20 text-[8px] leading-none py-0.5">
                                        <span>100%</span>
                                        <span>50%</span>
                                        <span>0%</span>
                                    </div>
                                </td>

                                <!-- Columna COMPLETO (Barra Verde) -->
                                <td class="p-1 text-center align-bottom cursor-pointer hover:bg-emerald-50/30 transition-colors celda-barra-totales"
                                    data-tooltip-totales="true"
                                    data-tt-fecha="${d.fechaTxt}"
                                    data-tt-validador="completo"
                                    data-tt-pct="${d.completo.toFixed(2).replace('.', ',')}%"
                                    data-tt-cant="${d.cantCompleto}"
                                    data-tt-total="${d.totalDespachos}"
                                    data-fecha="${d.fechaYMD}" data-validador="completo">
                                    <div class="flex flex-col items-center justify-end h-20 w-full relative px-2 sm:px-3 transition-opacity duration-200 ${opComp}">
                                        <span class="text-[9px] font-mono mb-0.5 whitespace-nowrap transition-colors ${txtComp}">
                                            ${d.completo.toFixed(2).replace('.', ',')}%
                                        </span>
                                        <div class="w-full max-w-[110px] bg-[#59A14F] hover:brightness-95 transition-all ${borComp}" style="height: ${Math.max(d.completo, 2)}%;"></div>
                                    </div>
                                </td>

                                <!-- Columna INCOMPLETO (Barra Roja) -->
                                <td class="p-1 text-center align-bottom cursor-pointer hover:bg-rose-50/30 transition-colors celda-barra-totales"
                                    data-tooltip-totales="true"
                                    data-tt-fecha="${d.fechaTxt}"
                                    data-tt-validador="incompleto"
                                    data-tt-pct="${d.incompleto.toFixed(2).replace('.', ',')}%"
                                    data-tt-cant="${d.cantIncompleto}"
                                    data-tt-total="${d.totalDespachos}"
                                    data-fecha="${d.fechaYMD}" data-validador="incompleto">
                                    <div class="flex flex-col items-center justify-end h-20 w-full relative px-2 sm:px-3 transition-opacity duration-200 ${opIncomp}">
                                        <span class="text-[9px] font-mono mb-0.5 whitespace-nowrap transition-colors ${txtIncomp}">
                                            ${d.incompleto.toFixed(2).replace('.', ',')}%
                                        </span>
                                        <div class="w-full max-w-[110px] bg-[#E15759] hover:brightness-95 transition-all ${borIncomp}" style="height: ${Math.max(d.incompleto, 2)}%;"></div>
                                    </div>
                                </td>

                                <!-- Columna TOTAL GENERAL (Barra Teal 100%) -->
                                <td class="p-1 pr-3 text-center align-bottom cursor-pointer hover:bg-teal-50/30 transition-colors celda-barra-totales"
                                    data-tooltip-totales="true"
                                    data-tt-fecha="${d.fechaTxt}"
                                    data-tt-validador="Total general"
                                    data-tt-pct="100,00%"
                                    data-tt-cant="${d.totalDespachos}"
                                    data-tt-total="${d.totalDespachos}"
                                    data-fecha="${d.fechaYMD}" data-validador="TODO">
                                    <div class="flex flex-col items-center justify-end h-20 w-full relative px-2 sm:px-3 transition-opacity duration-200 ${opTot}">
                                        <span class="text-[9px] font-mono mb-0.5 whitespace-nowrap transition-colors ${txtTot}">
                                            100,00%
                                        </span>
                                        <div class="w-full max-w-[110px] bg-[#76B7B2] hover:brightness-95 transition-all ${borTot}" style="height: 100%;"></div>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
                <tfoot class="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xs border-t border-slate-200 text-[10px] text-slate-500">
                    <tr>
                        <td colspan="3" class="py-2 pl-3"></td>
                        <td class="py-2 text-center font-normal text-slate-600">completo</td>
                        <td class="py-2 text-center font-normal text-slate-600">incompleto</td>
                        <td class="py-2 pr-3 text-center font-normal text-slate-600">Total general</td>
                    </tr>
                </tfoot>
            </table>
        `;

        cont.innerHTML = html;

        // Listeners interactivos en celdas de Totales Diarios con Toggle
        cont.querySelectorAll('.celda-barra-totales').forEach(celda => {
            celda.addEventListener('click', () => {
                const fecha = celda.getAttribute('data-fecha');
                const validador = celda.getAttribute('data-validador');

                const esMismaSeleccion = (
                    this.filtroActivo.fecha === fecha &&
                    ((validador === 'TODO' && this.filtroActivo.origen === 'total') ||
                     (validador !== 'TODO' && this.filtroActivo.validador === validador))
                );

                if (esMismaSeleccion) {
                    // Toggle off -> vuelve a la normalidad
                    this.filtroActivo = { fecha: null, validador: null, placa: null, origen: null };
                } else {
                    // Foco en este elemento
                    this.filtroActivo.fecha = fecha;
                    this.filtroActivo.validador = (validador === 'TODO') ? null : validador;
                    this.filtroActivo.origen = (validador === 'TODO') ? 'total' : 'barra';
                    this.filtroActivo.placa = null;
                }

                this.actualizarBadgeFiltro();
                this.renderizarTodo();
            });
        });

        cont.querySelectorAll('[data-accion="filtrar-fecha"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fecha = btn.getAttribute('data-fecha');
                const esMismaFecha = (this.filtroActivo.fecha === fecha && !this.filtroActivo.validador && this.filtroActivo.origen !== 'total');

                if (esMismaFecha) {
                    // Toggle off -> vuelve a la normalidad
                    this.filtroActivo = { fecha: null, validador: null, placa: null, origen: null };
                } else {
                    this.filtroActivo.fecha = fecha;
                    this.filtroActivo.validador = null;
                    this.filtroActivo.origen = 'fecha';
                    this.filtroActivo.placa = null;
                }

                this.actualizarBadgeFiltro();
                this.renderizarTodo();
            });
        });
    }

    /**
     * 2. TENDENCIA DIARIA: Gráfico de Líneas con Datalabels idéntico a Tableau
     * Se sincroniza con el filtro cruzado activo
     */
    renderizarChartTendencia() {
        const canvas = document.getElementById('chart-tendencia-diaria');
        if (!canvas) return;

        // Orden cronológico ascendente para el eje temporal
        let datos = [...this.datosMetricas].sort((a, b) => a.fechaYMD.localeCompare(b.fechaYMD));

        // Si el filtro proviene de TOTALES DIARIOS o FECHA (no de la propia TENDENCIA),
        // aislamos esa fecha a un punto único estilo Tableau
        if (this.filtroActivo.origen && this.filtroActivo.origen !== 'tendencia' && this.filtroActivo.fecha) {
            datos = datos.filter(d => d.fechaYMD === this.filtroActivo.fecha);
        }

        this.chartTendenciaDatos = datos;

        if (datos.length === 0) {
            if (this.chartTendencia) {
                this.chartTendencia.data.labels = [];
                this.chartTendencia.data.datasets = [];
                this.chartTendencia.update();
            }
            return;
        }

        const labels = datos.map(d => d.fechaTxt);
        const dataCompleto = datos.map(d => d.completo);
        const dataIncompleto = datos.map(d => d.incompleto);

        const datasets = [];
        const esFiltroDesdeTendencia = (this.filtroActivo.origen === 'tendencia');
        const selectedVal = this.filtroActivo.validador;
        const selectedIdx = datos.findIndex(d => d.fechaYMD === this.filtroActivo.fecha);

        // DATASET INCOMPLETO
        if (!this.filtroActivo.validador || this.filtroActivo.validador === 'incompleto' || esFiltroDesdeTendencia) {
            const esActivo = (esFiltroDesdeTendencia && selectedVal === 'incompleto');
            const esAtenuado = (esFiltroDesdeTendencia && selectedVal && selectedVal !== 'incompleto');

            const colorLinea = esAtenuado ? 'rgba(225, 87, 89, 0.22)' : '#E15759';
            const colorPuntos = esAtenuado ? 'rgba(225, 87, 89, 0.25)' : '#E15759';
            const colorTexto = esAtenuado ? 'rgba(225, 87, 89, 0.35)' : '#E15759';

            datasets.push({
                label: 'incompleto',
                data: dataIncompleto,
                borderColor: colorLinea,
                backgroundColor: colorLinea,
                tension: 0.15,
                borderWidth: esActivo ? 2.5 : (esAtenuado ? 1.5 : 2),
                pointRadius: datos.map((_, i) => (esActivo && i === selectedIdx ? 7 : (esAtenuado ? 3 : 5))),
                pointHoverRadius: 8,
                pointBackgroundColor: colorPuntos,
                pointBorderColor: datos.map((_, i) => (esActivo && i === selectedIdx ? '#000000' : colorPuntos)),
                pointBorderWidth: datos.map((_, i) => (esActivo && i === selectedIdx ? 2.5 : 1)),
                datalabels: {
                    align: 'top',
                    offset: 3,
                    color: (ctx) => (esActivo && ctx.dataIndex === selectedIdx ? '#0f172a' : colorTexto),
                    font: (ctx) => ({ size: 10, weight: (esActivo && ctx.dataIndex === selectedIdx) ? 'bold' : (esAtenuado ? 'normal' : 'bold') }),
                    formatter: (v) => `${v.toFixed(2).replace('.', ',')}%`
                }
            });
        }

        // DATASET COMPLETO
        if (!this.filtroActivo.validador || this.filtroActivo.validador === 'completo' || esFiltroDesdeTendencia) {
            const esActivo = (esFiltroDesdeTendencia && selectedVal === 'completo');
            const esAtenuado = (esFiltroDesdeTendencia && selectedVal && selectedVal !== 'completo');

            const colorLinea = esAtenuado ? 'rgba(89, 161, 79, 0.22)' : '#59A14F';
            const colorPuntos = esAtenuado ? 'rgba(89, 161, 79, 0.25)' : '#59A14F';
            const colorTexto = esAtenuado ? 'rgba(89, 161, 79, 0.35)' : '#59A14F';

            datasets.push({
                label: 'completo',
                data: dataCompleto,
                borderColor: colorLinea,
                backgroundColor: colorLinea,
                tension: 0.15,
                borderWidth: esActivo ? 2.5 : (esAtenuado ? 1.5 : 2),
                pointRadius: datos.map((_, i) => (esActivo && i === selectedIdx ? 7 : (esAtenuado ? 3 : 5))),
                pointHoverRadius: 8,
                pointBackgroundColor: colorPuntos,
                pointBorderColor: datos.map((_, i) => (esActivo && i === selectedIdx ? '#000000' : colorPuntos)),
                pointBorderWidth: datos.map((_, i) => (esActivo && i === selectedIdx ? 2.5 : 1)),
                datalabels: {
                    align: 'bottom',
                    offset: 3,
                    color: (ctx) => (esActivo && ctx.dataIndex === selectedIdx ? '#0f172a' : colorTexto),
                    font: (ctx) => ({ size: 10, weight: (esActivo && ctx.dataIndex === selectedIdx) ? 'bold' : (esAtenuado ? 'normal' : 'bold') }),
                    formatter: (v) => `${v.toFixed(2).replace('.', ',')}%`
                }
            });
        }

        // Si ya existe la instancia, solo actualizamos los datos para evitar destruir el canvas durante eventos activos
        if (this.chartTendencia && this.chartTendencia.ctx) {
            this.chartTendencia.data.labels = labels;
            this.chartTendencia.data.datasets = datasets;
            this.chartTendencia.update();
            return;
        }

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        this.chartTendencia = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 20, bottom: 10, left: 10, right: 10 }
                },
                onClick: (event, elements) => {
                    if (elements && elements.length > 0) {
                        const el = elements[0];
                        const idx = el.index;
                        const datasetIdx = el.datasetIndex;

                        const currentDatasets = this.chartTendencia?.data?.datasets || [];
                        const valSelected = currentDatasets[datasetIdx]?.label;
                        const item = this.chartTendenciaDatos?.[idx];

                        if (item) {
                            const esMismaSeleccion = (
                                this.filtroActivo.origen === 'tendencia' &&
                                this.filtroActivo.fecha === item.fechaYMD &&
                                this.filtroActivo.validador === valSelected
                            );

                            if (esMismaSeleccion) {
                                // Toggle off -> vuelve a la normalidad
                                this.filtroActivo = { fecha: null, validador: null, placa: null, origen: null };
                            } else {
                                this.filtroActivo.fecha = item.fechaYMD;
                                this.filtroActivo.validador = valSelected;
                                this.filtroActivo.placa = null;
                                this.filtroActivo.origen = 'tendencia';
                            }

                            // Usar setTimeout para desacoplar del ciclo de eventos síncrono de Chart.js
                            setTimeout(() => {
                                this.actualizarBadgeFiltro();
                                this.renderizarTodo();
                            }, 0);
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: '% de total conteo',
                            font: { size: 10, weight: 'bold' },
                            color: '#64748b'
                        },
                        ticks: {
                            stepSize: 20,
                            callback: v => `${v}%`,
                            font: { size: 9 },
                            color: '#64748b'
                        },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Día de fechaproceso',
                            font: { size: 10, weight: 'bold' },
                            color: '#64748b'
                        },
                        ticks: {
                            font: { size: 9 },
                            color: '#64748b',
                            maxRotation: 90,
                            minRotation: 90,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 10,
                        boxPadding: 4,
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(2).replace('.', ',')}%`
                        }
                    }
                }
            }
        });
    }

    /**
     * 3. HOJAS DE RUTA: Tabla Jerárquica con Rowspan Contiguo por Fecha, Zona y Transportista
     */
    renderizarHojasRuta() {
        const tbody = document.getElementById('tbody-hojas-ruta');
        const badge = document.getElementById('badge-conteo-hojas');
        if (!tbody) return;

        // Filtrar según filtros interactivos
        let filtradas = this.datosHojasRuta.filter(h => {
            if (this.filtroActivo.fecha && h.fecha !== this.filtroActivo.fecha) return false;
            if (this.filtroActivo.validador && h.validador !== this.filtroActivo.validador) return false;
            return true;
        });

        // Orden cronológico y jerárquico idéntico a Tableau: fecha DESC, zona ASC, transportista ASC, chofer ASC, placa ASC
        const ordenadas = [...filtradas].sort((a, b) => {
            const cmpFec = b.fecha.localeCompare(a.fecha);
            if (cmpFec !== 0) return cmpFec;
            const cmpZona = a.zona.localeCompare(b.zona);
            if (cmpZona !== 0) return cmpZona;
            const cmpTrans = a.transportista.localeCompare(b.transportista);
            if (cmpTrans !== 0) return cmpTrans;
            const cmpChof = a.chofer.localeCompare(b.chofer);
            if (cmpChof !== 0) return cmpChof;
            const cmpPlaca = a.placa.localeCompare(b.placa);
            if (cmpPlaca !== 0) return cmpPlaca;
            return a.validador.localeCompare(b.validador);
        });

        if (badge) badge.textContent = `${ordenadas.length} despachos`;

        if (ordenadas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-xs text-slate-400">Sin registros para el filtro seleccionado.</td></tr>`;
            return;
        }

        // Pre-calcular bloques contiguos para Rowspan exacto
        const nHojas = ordenadas.length;
        const fechaSpans = new Array(nHojas).fill(0);
        const zonaSpans = new Array(nHojas).fill(0);
        const transSpans = new Array(nHojas).fill(0);

        for (let i = 0; i < nHojas; ) {
            let j = i;
            while (j < nHojas && ordenadas[j].fecha === ordenadas[i].fecha) {
                j++;
            }
            fechaSpans[i] = j - i;
            i = j;
        }

        for (let i = 0; i < nHojas; ) {
            let j = i;
            while (
                j < nHojas &&
                ordenadas[j].fecha === ordenadas[i].fecha &&
                ordenadas[j].zona === ordenadas[i].zona
            ) {
                j++;
            }
            zonaSpans[i] = j - i;
            i = j;
        }

        for (let i = 0; i < nHojas; ) {
            let j = i;
            while (
                j < nHojas &&
                ordenadas[j].fecha === ordenadas[i].fecha &&
                ordenadas[j].zona === ordenadas[i].zona &&
                ordenadas[j].transportista === ordenadas[i].transportista
            ) {
                j++;
            }
            transSpans[i] = j - i;
            i = j;
        }

        let html = '';
        const hayPlaca = Boolean(this.filtroActivo.placa);

        for (let i = 0; i < nHojas; i++) {
            const h = ordenadas[i];
            const esSeleccionada = this.filtroActivo.placa === h.placa;
            const opFila = (!hayPlaca || esSeleccionada) ? 'opacity-100' : 'opacity-35 transition-opacity duration-200';

            let celdaFecha = '';
            if (fechaSpans[i] > 0) {
                celdaFecha = `
                    <td rowspan="${fechaSpans[i]}" class="px-3 py-2 font-semibold text-slate-800 bg-white border-r border-b border-slate-200 align-middle text-[11px] text-center whitespace-normal max-w-[100px]">
                        ${h.diaTxt}
                    </td>
                `;
            }

            let celdaZona = '';
            if (zonaSpans[i] > 0) {
                celdaZona = `
                    <td rowspan="${zonaSpans[i]}" class="px-3 py-2 font-medium text-slate-700 bg-white border-r border-b border-slate-200 align-middle text-[11px] uppercase whitespace-nowrap">
                        ${h.zona}
                    </td>
                `;
            }

            let celdaTransportista = '';
            if (transSpans[i] > 0) {
                celdaTransportista = `
                    <td rowspan="${transSpans[i]}" class="px-3 py-2 text-slate-700 bg-white border-r border-b border-slate-200 align-middle text-[11px] max-w-[190px] truncate" title="${h.transportista}">
                        ${h.transportista}
                    </td>
                `;
            }

            const colorVal = (h.validador === 'incompleto') ? 'text-rose-600' : 'text-emerald-700';

            html += `
                <tr class="hover:bg-blue-50/70 transition-all text-[11px] border-b border-slate-100 cursor-pointer fila-hoja-click ${opFila} ${esSeleccionada ? 'bg-blue-100/90 font-bold border-l-4 border-blue-600' : ''}" data-placa="${h.placa}">
                    ${celdaFecha}
                    ${celdaZona}
                    ${celdaTransportista}
                    <td class="px-3 py-2 text-slate-700 border-r border-b border-slate-100 whitespace-nowrap max-w-[180px] truncate" title="${h.chofer}">
                        ${h.chofer}
                    </td>
                    <td class="px-3 py-2 font-mono font-medium text-slate-900 text-center border-r border-b border-slate-100 whitespace-nowrap">
                        ${h.placa}
                    </td>
                    <td class="px-3 py-2 text-left whitespace-nowrap font-medium border-b border-slate-100 ${colorVal}">
                        ${h.validador}
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;

        // Listener para seleccionar placa y filtrar el Panel 4
        tbody.querySelectorAll('.fila-hoja-click').forEach(fila => {
            fila.addEventListener('click', () => {
                const placa = fila.getAttribute('data-placa');
                this.filtroActivo.placa = (this.filtroActivo.placa === placa) ? null : placa;
                this.actualizarBadgeFiltro();
                this.renderizarHojasRuta();
                this.renderizarDetalleRuta();
            });
        });
    }

    /**
     * 4. DETALLE DE RUTA: Tabla Jerárquica con Eventos y Marcadores Visuales Idéntica a Tableau
     */
    renderizarDetalleRuta() {
        const tbody = document.getElementById('tbody-detalle-ruta');
        const badge = document.getElementById('badge-conteo-detalle');
        if (!tbody) return;

        let filtrados = this.datosDetalleRuta.filter(d => {
            // Filtro interactivo
            if (this.filtroActivo.fecha && d.fecha !== this.filtroActivo.fecha) return false;
            if (this.filtroActivo.validador && d.validador !== this.filtroActivo.validador) return false;
            if (this.filtroActivo.placa && d.placa !== this.filtroActivo.placa) return false;
            return true;
        });

        // Orden estricto jerárquico como en Tableau: fecha ASC, zona ASC, placa ASC, dia ASC, hora ASC
        const ordenados = [...filtrados].sort((a, b) => {
            const cmpFec = a.fecha.localeCompare(b.fecha);
            if (cmpFec !== 0) return cmpFec;
            const cmpZona = a.zona.localeCompare(b.zona);
            if (cmpZona !== 0) return cmpZona;
            const cmpPlaca = a.placa.localeCompare(b.placa);
            if (cmpPlaca !== 0) return cmpPlaca;
            const cmpDia = a.dia.localeCompare(b.dia);
            if (cmpDia !== 0) return cmpDia;
            return a.hora.localeCompare(b.hora);
        });

        if (badge) badge.textContent = `${ordenados.length} eventos`;

        if (ordenados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-xs text-slate-400">Sin eventos de ruta para la selección.</td></tr>`;
            return;
        }

        // Pre-calcular bloques contiguos exactos para evitar descuadres de columnas
        const nDet = ordenados.length;
        const zonaSpans = new Array(nDet).fill(0);
        const placaSpans = new Array(nDet).fill(0);
        const diaSpans = new Array(nDet).fill(0);

        // Bloque contiguo de misma fecha y zona
        for (let i = 0; i < nDet; ) {
            let j = i;
            while (
                j < nDet &&
                ordenados[j].fecha === ordenados[i].fecha &&
                ordenados[j].zona === ordenados[i].zona
            ) {
                j++;
            }
            zonaSpans[i] = j - i;
            i = j;
        }

        // Bloque contiguo de misma fecha, zona y placa
        for (let i = 0; i < nDet; ) {
            let j = i;
            while (
                j < nDet &&
                ordenados[j].fecha === ordenados[i].fecha &&
                ordenados[j].zona === ordenados[i].zona &&
                ordenados[j].placa === ordenados[i].placa
            ) {
                j++;
            }
            placaSpans[i] = j - i;
            i = j;
        }

        // Bloque contiguo de misma fecha, zona, placa y día
        for (let i = 0; i < nDet; ) {
            let j = i;
            const diaI = ordenados[i].diaTxt || this.formatearDiaCorta(ordenados[i].dia);
            while (
                j < nDet &&
                ordenados[j].fecha === ordenados[i].fecha &&
                ordenados[j].zona === ordenados[i].zona &&
                ordenados[j].placa === ordenados[i].placa &&
                (ordenados[j].diaTxt || this.formatearDiaCorta(ordenados[j].dia)) === diaI
            ) {
                j++;
            }
            diaSpans[i] = j - i;
            i = j;
        }

        let html = '';
        for (let i = 0; i < nDet; i++) {
            const d = ordenados[i];
            const diaDisplay = d.diaTxt || this.formatearDiaCorta(d.dia);

            let celdaZona = '';
            if (zonaSpans[i] > 0) {
                celdaZona = `
                    <td rowspan="${zonaSpans[i]}" class="px-3 py-2 font-semibold text-slate-800 bg-white border-r border-b border-slate-200 align-middle text-[11px] uppercase whitespace-nowrap">
                        ${d.zona}
                    </td>
                `;
            }

            let celdaPlaca = '';
            if (placaSpans[i] > 0) {
                celdaPlaca = `
                    <td rowspan="${placaSpans[i]}" class="px-3 py-2 font-mono font-medium text-slate-900 bg-white border-r border-b border-slate-200 align-middle text-center text-[11px] whitespace-nowrap">
                        ${d.placa}
                    </td>
                `;
            }

            let celdaDia = '';
            if (diaSpans[i] > 0) {
                celdaDia = `
                    <td rowspan="${diaSpans[i]}" class="px-3 py-2 text-slate-700 bg-white border-r border-b border-slate-200 align-middle text-center text-[11px] whitespace-nowrap">
                        ${diaDisplay}
                    </td>
                `;
            }

            const colorSquare = (d.validador === 'incompleto') ? 'bg-[#E15759]' : 'bg-[#59A14F]';

            html += `
                <tr class="hover:bg-slate-50 transition-colors text-[11px] border-b border-slate-100">
                    ${celdaZona}
                    ${celdaPlaca}
                    ${celdaDia}
                    <td class="px-3 py-2 font-mono text-slate-700 text-center border-r border-b border-slate-100 whitespace-nowrap">
                        ${d.hora}
                    </td>
                    <td class="px-3 py-2 text-slate-800 font-normal border-r border-b border-slate-100 whitespace-nowrap">
                        ${d.tipo}
                    </td>
                    <td class="px-3 py-2 text-center align-middle border-b border-slate-100">
                        <span class="inline-block w-3.5 h-3.5 rounded-none ${colorSquare}" title="${d.validador}"></span>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;
    }
}

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => {
    window.transportesController = new TransportesController();
});