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

        // Estado del filtro cruzado estilo Tableau (una sola fuente activa)
        this.filtroCruzado = {
            origen: null,   // 'totales' | 'tendencia' | 'hojas'
            pares: [],      // [{ fecha, validador }] validador null = Total general
            filasHR: []     // [{ fecha, zona, transportista, chofer, placa, validador }]
        };

        // Almacenamiento de datos devueltos por el backend
        this.datosMetricas = [];
        this.datosMetricasGranulares = [];
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
            // 1. Tooltip Totales Diarios (sobre las barras)
            const targetTotales = e.target.closest('[data-tooltip-totales]');
            if (targetTotales) {
                const fechatxt = targetTotales.getAttribute('data-tt-fecha');
                const validador = targetTotales.getAttribute('data-tt-validador');
                const pct = targetTotales.getAttribute('data-tt-pct');
                const cant = targetTotales.getAttribute('data-tt-cant');
                const total = targetTotales.getAttribute('data-tt-total');

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">validador:</span>
                        <span class="text-slate-900 font-semibold text-left">${validador}</span>
                        <span class="text-slate-500 font-normal">Día de fechaproceso:</span>
                        <span class="text-slate-900 font-semibold text-left">${fechatxt}</span>
                        <span class="text-slate-500 font-normal">% de total conteo:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${pct}</span>
                        ${cant ? `<span class="text-slate-500 font-normal">conteo:</span><span class="text-slate-900 font-semibold text-left">${cant}</span>` : ''}
                        ${total ? `<span class="text-slate-500 font-normal">Total general:</span><span class="text-slate-900 font-semibold text-left">${total}</span>` : ''}
                    </div>
                `;
                this.posicionarTooltip(tooltip, e);
                return;
            }

            // 2. Tooltip Hojas de Ruta (sobre la celda de validador)
            const targetHoja = e.target.closest('[data-tooltip-hoja]');
            if (targetHoja) {
                const chofer = targetHoja.getAttribute('data-tt-chofer') || '';
                const placa = targetHoja.getAttribute('data-tt-placa') || '';
                const transportista = targetHoja.getAttribute('data-tt-transportista') || '';
                const validador = targetHoja.getAttribute('data-tt-validador') || '';
                const zona = targetHoja.getAttribute('data-tt-zona') || '';
                const fechatxt = targetHoja.getAttribute('data-tt-fecha') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">chofer:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${chofer}</span>
                        <span class="text-slate-500 font-normal">placa:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${placa}</span>
                        <span class="text-slate-500 font-normal">transportista:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${transportista}</span>
                        <span class="text-slate-500 font-normal">validador:</span>
                        <span class="text-slate-900 font-semibold text-left">${validador}</span>
                        <span class="text-slate-500 font-normal">zona:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${zona}</span>
                        <span class="text-slate-500 font-normal">Día de fechaproceso:</span>
                        <span class="text-slate-900 font-semibold text-left">${fechatxt}</span>
                    </div>
                `;
                this.posicionarTooltip(tooltip, e);
                return;
            }

            // 3. Tooltip Detalle de Ruta (sobre los cuadrados de colores)
            const targetDetalle = e.target.closest('[data-tooltip-detalle]');
            if (targetDetalle) {
                const dia = targetDetalle.getAttribute('data-tt-dia') || '';
                const fechaproceso = targetDetalle.getAttribute('data-tt-fecha') || '';
                const hora = targetDetalle.getAttribute('data-tt-hora') || '';
                const placa = targetDetalle.getAttribute('data-tt-placa') || '';
                const tipo = targetDetalle.getAttribute('data-tt-tipo') || '';
                const validador = targetDetalle.getAttribute('data-tt-validador') || '';
                const zona = targetDetalle.getAttribute('data-tt-zona') || '';
                const conteo = targetDetalle.getAttribute('data-tt-conteo') || '1,000';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">dia:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${dia}</span>
                        <span class="text-slate-500 font-normal">fechaproceso:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${fechaproceso}</span>
                        <span class="text-slate-500 font-normal">hora:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${hora}</span>
                        <span class="text-slate-500 font-normal">placa:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${placa}</span>
                        <span class="text-slate-500 font-normal">tipo:</span>
                        <span class="text-slate-900 font-semibold text-left">${tipo}</span>
                        <span class="text-slate-500 font-normal">validador:</span>
                        <span class="text-slate-900 font-semibold text-left">${validador}</span>
                        <span class="text-slate-500 font-normal">zona:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${zona}</span>
                        <span class="text-slate-500 font-normal">conteo:</span>
                        <span class="text-slate-900 font-semibold text-left">${conteo}</span>
                    </div>
                `;
                this.posicionarTooltip(tooltip, e);
                return;
            }

            // Ocultar si no está sobre ningún target de tooltip (y no sobre el canvas)
            if (!e.target.closest('#chart-tendencia-diaria')) {
                tooltip.classList.add('hidden');
            }
        });
    }

    posicionarTooltip(tooltip, e) {
        tooltip.classList.remove('hidden');
        const tooltipWidth = tooltip.offsetWidth || 280;
        const tooltipHeight = tooltip.offsetHeight || 130;
        let x = e.clientX + 14;
        let y = e.clientY + 14;

        if (x + tooltipWidth > window.innerWidth - 12) {
            x = e.clientX - tooltipWidth - 14;
        }
        if (y + tooltipHeight > window.innerHeight - 12) {
            y = e.clientY - tooltipHeight - 14;
        }

        tooltip.style.left = `${Math.max(10, x)}px`;
        tooltip.style.top = `${Math.max(10, y)}px`;
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

        // Botones "Ver todos" del filtro cruzado
        ['btn-limpiar-totales', 'btn-limpiar-tendencia', 'btn-limpiar-hojas'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                this.limpiarFiltroCruzado();
            });
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
        this.filtroCruzado = { origen: null, pares: [], filasHR: [] };
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

            // Mapeo métricas granulares para el filtro desde HOJAS DE RUTA
            this.datosMetricasGranulares = (payload.metricas_granulares || []).map(m => ({
                fecha: m.fechaproceso,
                zona: m.zona || 'SIN ZONA',
                transportista: m.transportista || '',
                chofer: m.chofer || '',
                placa: m.placa || '',
                validador: (m.validador || '').toLowerCase(),
                conteo: Number(m.conteo || 0)
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
                transportista: d.transportista || '',
                chofer: d.chofer || '',
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
            this.datosMetricasGranulares = [];
            this.datosHojasRuta = [];
            this.datosDetalleRuta = [];
        }

        this.renderizarTodo();
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_fechas';
        this.setupPeriodo();

        this.filtroCruzado = { origen: null, pares: [], filasHR: [] };
        this.actualizarBadgeFiltro();
        await this.onCargarClick();
    }

    actualizarBadgeFiltro() {
        const resumen = document.getElementById('resumen-filtro-cruzado');
        const activo = this.hayFiltroCruzado();

        if (resumen) {
            if (activo) {
                resumen.textContent = this.resumenSeleccion();
                resumen.classList.remove('hidden');
            } else {
                resumen.classList.add('hidden');
            }
        }

        const botones = {
            totales: document.getElementById('btn-limpiar-totales'),
            tendencia: document.getElementById('btn-limpiar-tendencia'),
            hojas: document.getElementById('btn-limpiar-hojas')
        };

        Object.entries(botones).forEach(([origen, btn]) => {
            if (!btn) return;
            const visible = activo && this.filtroCruzado.origen === origen;
            btn.classList.toggle('hidden', !visible);
            if (visible) {
                const n = origen === 'hojas'
                    ? this.filtroCruzado.filasHR.length
                    : this.filtroCruzado.pares.length;
                btn.textContent = `Ver todos (${n})`;
            }
        });
    }

    normalizarDimension(valor) {
        return String(valor == null ? '' : valor).trim().toUpperCase();
    }

    normalizarValidador(valor) {
        if (valor === null || valor === undefined) return null;
        const v = String(valor).trim().toLowerCase();
        if (!v || v === 'todo' || v === 'total general' || v === '%all%') return null;
        return v;
    }

    clavePar(fecha, validador) {
        const val = this.normalizarValidador(validador);
        return `${fecha || ''}|${val === null ? 'TODO' : val}`;
    }

    esParExacto(fecha, validador) {
        const clave = this.clavePar(fecha, validador);
        return this.filtroCruzado.pares.some(p => this.clavePar(p.fecha, p.validador) === clave);
    }

    esPuntoSeleccionado(fecha, validador) {
        return this.esParExacto(fecha, validador) || this.esParExacto(fecha, null);
    }

    claveFilaHR(fila) {
        return [
            fila?.fecha || '',
            this.normalizarDimension(fila?.zona),
            this.normalizarDimension(fila?.transportista),
            this.normalizarDimension(fila?.chofer),
            this.normalizarDimension(fila?.placa),
            this.normalizarValidador(fila?.validador) || ''
        ].join('|');
    }

    esFilaHRSeleccionada(fila) {
        if (this.filtroCruzado.origen !== 'hojas' || !this.filtroCruzado.filasHR.length) return false;
        const clave = this.claveFilaHR(fila);
        return this.filtroCruzado.filasHR.some(f => this.claveFilaHR(f) === clave);
    }

    coincideConPares(fecha, validador) {
        const origen = this.filtroCruzado.origen;
        if (origen !== 'totales' && origen !== 'tendencia') return true;
        if (!this.filtroCruzado.pares.length) return true;

        const val = this.normalizarValidador(validador);
        return this.filtroCruzado.pares.some(p =>
            p.fecha === fecha && (p.validador === null || p.validador === val)
        );
    }

    hayFiltroCruzado() {
        if (!this.filtroCruzado.origen) return false;
        return this.filtroCruzado.origen === 'hojas'
            ? this.filtroCruzado.filasHR.length > 0
            : this.filtroCruzado.pares.length > 0;
    }

    resumenSeleccion() {
        if (this.filtroCruzado.origen === 'hojas') {
            const n = this.filtroCruzado.filasHR.length;
            return `${n} hoja${n === 1 ? '' : 's'} de ruta seleccionada${n === 1 ? '' : 's'}`;
        }

        const n = this.filtroCruzado.pares.length;
        const fechas = new Set(this.filtroCruzado.pares.map(p => p.fecha)).size;
        return `${n} ${n === 1 ? 'selección' : 'selecciones'} · ${fechas} fecha${fechas === 1 ? '' : 's'}`;
    }

    alternarPar(origen, fecha, validador, aditivo) {
        if (!fecha) return;

        const val = this.normalizarValidador(validador);

        if (this.filtroCruzado.origen !== origen) {
            this.filtroCruzado = { origen, pares: [], filasHR: [] };
            aditivo = false;
        }

        const pares = this.filtroCruzado.pares;
        const existe = pares.some(p => p.fecha === fecha && p.validador === val);
        const soloEste = pares.length === 1 && existe;

        if (!aditivo) {
            if (soloEste) {
                this.filtroCruzado = { origen: null, pares: [], filasHR: [] };
                return;
            }
            this.filtroCruzado.pares = [{ fecha, validador: val }];
        } else if (existe) {
            this.filtroCruzado.pares = pares.filter(p => !(p.fecha === fecha && p.validador === val));
        } else {
            const base = pares.filter(p =>
                p.fecha !== fecha || (val !== null && p.validador !== null)
            );
            this.filtroCruzado.pares = base.concat([{ fecha, validador: val }]);
        }

        if (!this.filtroCruzado.pares.length) {
            this.filtroCruzado.origen = null;
        }
    }

    alternarFilaHR(fila, aditivo) {
        const clave = this.claveFilaHR(fila);

        if (this.filtroCruzado.origen !== 'hojas') {
            this.filtroCruzado = { origen: 'hojas', pares: [], filasHR: [] };
            aditivo = false;
        }

        const filas = this.filtroCruzado.filasHR;
        const existe = filas.some(f => this.claveFilaHR(f) === clave);
        const soloEste = filas.length === 1 && existe;
        const normalizada = {
            fecha: fila.fecha,
            zona: fila.zona,
            transportista: fila.transportista,
            chofer: fila.chofer,
            placa: fila.placa,
            validador: this.normalizarValidador(fila.validador)
        };

        if (!aditivo) {
            if (soloEste) {
                this.filtroCruzado = { origen: null, pares: [], filasHR: [] };
                return;
            }
            this.filtroCruzado.filasHR = [normalizada];
        } else if (existe) {
            this.filtroCruzado.filasHR = filas.filter(f => this.claveFilaHR(f) !== clave);
        } else {
            this.filtroCruzado.filasHR = filas.concat([normalizada]);
        }

        if (!this.filtroCruzado.filasHR.length) {
            this.filtroCruzado.origen = null;
        }
    }

    limpiarFiltroCruzado() {
        this.filtroCruzado = { origen: null, pares: [], filasHR: [] };
        this.renderizarTodo();
    }

    construirMetrica(fecha, cantCompleto, cantIncompleto, total) {
        const totalFinal = Number(total || 0);
        return {
            fechaYMD: fecha,
            fechaTxt: this.formatearFechaTableau(fecha),
            cantCompleto: Number(cantCompleto || 0),
            cantIncompleto: Number(cantIncompleto || 0),
            totalDespachos: totalFinal,
            completo: totalFinal > 0 ? (Number(cantCompleto || 0) / totalFinal) * 100 : 0,
            incompleto: totalFinal > 0 ? (Number(cantIncompleto || 0) / totalFinal) * 100 : 0
        };
    }

    calcularMetricasDesdePares() {
        const mapa = new Map();

        for (const par of this.filtroCruzado.pares) {
            const d = this.datosMetricas.find(x => x.fechaYMD === par.fecha);
            if (!d) continue;

            const m = mapa.get(par.fecha) || {
                cantCompleto: 0,
                cantIncompleto: 0,
                total: 0,
                totalGeneral: false,
                tieneCompleto: false,
                tieneIncompleto: false
            };

            if (par.validador === null) {
                m.cantCompleto = d.cantCompleto;
                m.cantIncompleto = d.cantIncompleto;
                m.total = d.totalDespachos;
                m.totalGeneral = true;
                m.tieneCompleto = d.cantCompleto > 0;
                m.tieneIncompleto = d.cantIncompleto > 0;
            } else if (!m.totalGeneral) {
                if (par.validador === 'completo' && !m.tieneCompleto) {
                    m.cantCompleto = d.cantCompleto;
                    m.total += d.cantCompleto;
                    m.tieneCompleto = true;
                } else if (par.validador === 'incompleto' && !m.tieneIncompleto) {
                    m.cantIncompleto = d.cantIncompleto;
                    m.total += d.cantIncompleto;
                    m.tieneIncompleto = true;
                }
            }

            mapa.set(par.fecha, m);
        }

        return Array.from(mapa.entries()).map(([fecha, m]) =>
            this.construirMetrica(fecha, m.cantCompleto, m.cantIncompleto, m.total)
        );
    }

    calcularMetricasDesdeFilasHR() {
        const claves = new Set(this.filtroCruzado.filasHR.map(f => this.claveFilaHR(f)));
        const mapa = new Map();

        for (const g of this.datosMetricasGranulares) {
            if (!claves.has(this.claveFilaHR(g))) continue;

            const m = mapa.get(g.fecha) || { cantCompleto: 0, cantIncompleto: 0, total: 0 };
            const conteo = Number(g.conteo || 0);
            m.total += conteo;
            if (g.validador === 'completo') m.cantCompleto += conteo;
            else if (g.validador === 'incompleto') m.cantIncompleto += conteo;
            mapa.set(g.fecha, m);
        }

        return Array.from(mapa.entries()).map(([fecha, m]) =>
            this.construirMetrica(fecha, m.cantCompleto, m.cantIncompleto, m.total)
        );
    }

    obtenerMetricasFiltradas() {
        if (!this.hayFiltroCruzado()) return [];
        return this.filtroCruzado.origen === 'hojas'
            ? this.calcularMetricasDesdeFilasHR()
            : this.calcularMetricasDesdePares();
    }

    colorConAlpha(hex, alpha) {
        const limpio = String(hex || '').replace('#', '');
        if (limpio.length !== 6) return hex;
        const r = parseInt(limpio.slice(0, 2), 16);
        const g = parseInt(limpio.slice(2, 4), 16);
        const b = parseInt(limpio.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
        this.actualizarBadgeFiltro();
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

        const esDestino = this.hayFiltroCruzado() && this.filtroCruzado.origen !== 'totales';

        if (esDestino) {
            datos = this.obtenerMetricasFiltradas()
                .sort((a, b) => b.fechaYMD.localeCompare(a.fechaYMD));

            if (datos.length === 0) {
                cont.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Sin datos para la selección.</div>`;
                return;
            }
        }

        const hayFiltro = this.filtroCruzado.origen === 'totales' && this.filtroCruzado.pares.length > 0;

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
                        
                        const parComp = this.esParExacto(d.fechaYMD, 'completo');
                        const parIncomp = this.esParExacto(d.fechaYMD, 'incompleto');
                        const parTotal = this.esParExacto(d.fechaYMD, null);
                        const fechaActiva = this.filtroCruzado.pares.some(p => p.fecha === d.fechaYMD);
                        const tieneComp = Number(d.cantCompleto || 0) > 0;
                        const tieneIncomp = Number(d.cantIncompleto || 0) > 0;

                        // COMPLETO
                        const selComp = esDestino ? tieneComp : parComp;
                        const opComp = esDestino ? 'opacity-100' : ((!hayFiltro || selComp) ? 'opacity-100' : 'opacity-25');
                        const borComp = (!esDestino && parComp) ? 'border-2 border-black ring-1 ring-black shadow-xs' : '';
                        const txtComp = esDestino ? 'font-semibold text-slate-700' : (selComp ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50'));

                        // INCOMPLETO
                        const selIncomp = esDestino ? tieneIncomp : parIncomp;
                        const opIncomp = esDestino ? 'opacity-100' : ((!hayFiltro || selIncomp) ? 'opacity-100' : 'opacity-25');
                        const borIncomp = (!esDestino && parIncomp) ? 'border-2 border-black ring-1 ring-black shadow-xs' : '';
                        const txtIncomp = esDestino ? 'font-semibold text-slate-700' : (selIncomp ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50'));

                        // TOTAL GENERAL
                        const selTot = esDestino ? true : parTotal;
                        const opTot = esDestino ? 'opacity-100' : ((!hayFiltro || selTot) ? 'opacity-100' : 'opacity-25');
                        const borTot = (!esDestino && parTotal) ? 'border-2 border-black ring-1 ring-black shadow-xs' : '';
                        const txtTot = esDestino ? 'font-semibold text-slate-700' : (selTot ? 'font-bold text-slate-900' : (!hayFiltro ? 'font-semibold text-slate-700' : 'text-slate-300 opacity-50'));

                        // FECHA
                        const esFechaActiva = esDestino ? true : fechaActiva;
                        const opFec = esDestino ? 'opacity-100' : ((!hayFiltro || esFechaActiva) ? 'opacity-100' : 'opacity-35');
                        const txtFec = esFechaActiva ? 'text-blue-700 font-bold' : 'text-slate-700 font-medium';

                        const tdComp = (esDestino && !tieneComp)
                            ? `<td class="p-1 text-center align-bottom border-slate-100"></td>`
                            : `
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
                            `;

                        const tdIncomp = (esDestino && !tieneIncomp)
                            ? `<td class="p-1 text-center align-bottom border-slate-100"></td>`
                            : `
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
                            `;

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
                                ${tdComp}

                                <!-- Columna INCOMPLETO (Barra Roja) -->
                                ${tdIncomp}

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

        // Listeners interactivos en celdas de Totales Diarios (Ctrl = multiselección)
        cont.querySelectorAll('.celda-barra-totales').forEach(celda => {
            celda.addEventListener('click', (event) => {
                const fecha = celda.getAttribute('data-fecha');
                const validador = celda.getAttribute('data-validador');
                this.alternarPar('totales', fecha, validador, event.ctrlKey || event.metaKey);
                this.renderizarTodo();
            });
        });

        cont.querySelectorAll('[data-accion="filtrar-fecha"]').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const fecha = btn.getAttribute('data-fecha');
                this.alternarPar('totales', fecha, null, event.ctrlKey || event.metaKey);
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

        const esFuente = this.filtroCruzado.origen === 'tendencia';
        const esDestino = this.hayFiltroCruzado() && !esFuente;

        let datos;
        if (esDestino) {
            datos = this.obtenerMetricasFiltradas()
                .sort((a, b) => a.fechaYMD.localeCompare(b.fechaYMD));
        } else {
            datos = [...this.datosMetricas].sort((a, b) => a.fechaYMD.localeCompare(b.fechaYMD));
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
        const dataCompleto = datos.map(d => {
            if (!esDestino) return d.completo;
            return Number(d.cantCompleto || 0) > 0 ? d.completo : null;
        });
        const dataIncompleto = datos.map(d => {
            if (!esDestino) return d.incompleto;
            return Number(d.cantIncompleto || 0) > 0 ? d.incompleto : null;
        });

        const hayPares = esFuente && this.filtroCruzado.pares.length > 0;
        const datasets = [];

        const construirDataset = (label, data, color, align) => {
            const seleccionados = esFuente
                ? datos.map(d => this.esPuntoSeleccionado(d.fechaYMD, label))
                : datos.map(() => false);
            const haySeleccionDataset = seleccionados.some(Boolean);
            const atenuado = hayPares && !haySeleccionDataset;

            const colorLinea = atenuado ? this.colorConAlpha(color, 0.22) : color;
            const colorPuntos = atenuado ? this.colorConAlpha(color, 0.25) : color;
            const colorTexto = atenuado ? this.colorConAlpha(color, 0.35) : color;

            return {
                label,
                data,
                borderColor: colorLinea,
                backgroundColor: colorLinea,
                tension: 0.15,
                borderWidth: haySeleccionDataset ? 2.5 : (atenuado ? 1.5 : 2),
                pointRadius: datos.map((_, i) => seleccionados[i] ? 7 : (hayPares ? 3 : 5)),
                pointHoverRadius: 8,
                pointBackgroundColor: colorPuntos,
                pointBorderColor: datos.map((_, i) => seleccionados[i] ? '#000000' : colorPuntos),
                pointBorderWidth: datos.map((_, i) => seleccionados[i] ? 2.5 : 1),
                datalabels: {
                    align,
                    offset: 3,
                    color: (ctx) => seleccionados[ctx.dataIndex] ? '#0f172a' : colorTexto,
                    font: (ctx) => ({ size: 10, weight: seleccionados[ctx.dataIndex] ? 'bold' : (atenuado ? 'normal' : 'bold') }),
                    formatter: (v) => v === null || v === undefined ? '' : `${Number(v).toFixed(2).replace('.', ',')}%`
                }
            };
        };

        if (dataIncompleto.some(v => v !== null)) {
            datasets.push(construirDataset('incompleto', dataIncompleto, '#E15759', 'top'));
        }
        if (dataCompleto.some(v => v !== null)) {
            datasets.push(construirDataset('completo', dataCompleto, '#59A14F', 'bottom'));
        }

        if (datasets.length === 0) {
            if (this.chartTendencia) {
                this.chartTendencia.data.labels = labels;
                this.chartTendencia.data.datasets = [];
                this.chartTendencia.update();
            }
            return;
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
                    if (!elements || elements.length === 0) {
                        if (this.hayFiltroCruzado()) {
                            setTimeout(() => this.limpiarFiltroCruzado(), 0);
                        }
                        return;
                    }

                    const el = elements[0];
                    const idx = el.index;
                    const datasetIdx = el.datasetIndex;

                    const currentDatasets = this.chartTendencia?.data?.datasets || [];
                    const valSelected = currentDatasets[datasetIdx]?.label;
                    const item = this.chartTendenciaDatos?.[idx];

                    if (!item || !valSelected) return;

                    const native = event?.native || event;
                    const aditivo = !!(native && (native.ctrlKey || native.metaKey));

                    this.alternarPar('tendencia', item.fechaYMD, valSelected, aditivo);

                    // Usar setTimeout para desacoplar del ciclo de eventos síncrono de Chart.js
                    setTimeout(() => {
                        this.renderizarTodo();
                    }, 0);
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
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            const tooltipEl = document.getElementById('tooltip-tableau-transporte');
                            if (!tooltipEl) return;

                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltipModel.dataPoints && tooltipModel.dataPoints.length > 0) {
                                const dp = tooltipModel.dataPoints[0];
                                const dataset = dp.dataset;
                                const idx = dp.dataIndex;
                                const item = this.chartTendenciaDatos?.[idx];

                                if (!item) return;

                                const valSelected = dataset.label;
                                const esComp = (valSelected === 'completo');
                                const pct = Number(dp.raw || 0);
                                const cant = esComp ? item.cantCompleto : item.cantIncompleto;
                                const cantFormatted = new Intl.NumberFormat('es-PE').format(cant);

                                tooltipEl.innerHTML = `
                                    <div class="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-[11px] font-sans">
                                        <span class="text-slate-500 font-normal">validador:</span>
                                        <span class="text-slate-900 font-semibold text-left">${valSelected}</span>
                                        <span class="text-slate-500 font-normal">Día de fechaproceso:</span>
                                        <span class="text-slate-900 font-semibold text-left">${item.fechaTxt}</span>
                                        <span class="text-slate-500 font-normal">% de total conteo junto con validador:</span>
                                        <span class="text-slate-900 font-semibold text-left font-mono">${pct.toFixed(2).replace('.', ',')}%</span>
                                        <span class="text-slate-500 font-normal">conteo:</span>
                                        <span class="text-slate-900 font-semibold text-left">${cantFormatted}</span>
                                    </div>
                                `;

                                tooltipEl.classList.remove('hidden');

                                const position = context.chart.canvas.getBoundingClientRect();
                                const tooltipWidth = tooltipEl.offsetWidth || 280;
                                const tooltipHeight = tooltipEl.offsetHeight || 110;

                                let left = position.left + tooltipModel.caretX + 14;
                                let top = position.top + tooltipModel.caretY - 20;

                                if (left + tooltipWidth > window.innerWidth - 12) {
                                    left = position.left + tooltipModel.caretX - tooltipWidth - 14;
                                }
                                if (top + tooltipHeight > window.innerHeight - 12) {
                                    top = window.innerHeight - tooltipHeight - 12;
                                }
                                if (top < 10) top = 10;

                                tooltipEl.style.left = `${Math.max(10, left)}px`;
                                tooltipEl.style.top = `${Math.max(10, top)}px`;
                            }
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

        // Filtrar según filtros interactivos (destino de Totales/Tendencia)
        const filtradas = this.datosHojasRuta.filter(h => this.coincideConPares(h.fecha, h.validador));

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
        const haySeleccionHojas = this.filtroCruzado.origen === 'hojas' && this.filtroCruzado.filasHR.length > 0;

        for (let i = 0; i < nHojas; i++) {
            const h = ordenadas[i];
            const esSeleccionada = haySeleccionHojas && this.esFilaHRSeleccionada(h);
            const opFila = (!haySeleccionHojas || esSeleccionada) ? 'opacity-100' : 'opacity-35 transition-opacity duration-200';

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
                <tr class="hover:bg-blue-50/70 transition-all text-[11px] border-b border-slate-100 cursor-pointer fila-hoja-click ${opFila} ${esSeleccionada ? 'bg-blue-100/90 font-bold border-l-4 border-blue-600' : ''}" data-pos="${i}" data-placa="${h.placa}">
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
                        <span class="inline-block px-1 py-0.5 rounded-xs hover:bg-slate-100 hover:font-bold transition-all cursor-default"
                              data-tooltip-hoja="true"
                              data-tt-chofer="${h.chofer}"
                              data-tt-placa="${h.placa}"
                              data-tt-transportista="${h.transportista}"
                              data-tt-validador="${h.validador}"
                              data-tt-zona="${h.zona}"
                              data-tt-fecha="${h.diaTxt}">
                            ${h.validador}
                        </span>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;

        // Listener para seleccionar la fila HR completa (Ctrl = multiselección)
        tbody.querySelectorAll('.fila-hoja-click').forEach(fila => {
            fila.addEventListener('click', (event) => {
                const pos = Number(fila.getAttribute('data-pos'));
                const h = ordenadas[pos];
                if (!h) return;

                this.alternarFilaHR({
                    fecha: h.fecha,
                    zona: h.zona,
                    transportista: h.transportista,
                    chofer: h.chofer,
                    placa: h.placa,
                    validador: h.validador
                }, event.ctrlKey || event.metaKey);

                this.renderizarTodo();
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
            if (this.filtroCruzado.origen === 'hojas') {
                return !this.filtroCruzado.filasHR.length || this.esFilaHRSeleccionada(d);
            }
            return this.coincideConPares(d.fecha, d.validador);
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
                        <span class="inline-block w-3.5 h-3.5 rounded-none cursor-pointer ${colorSquare} hover:ring-1 hover:ring-black transition-all"
                              data-tooltip-detalle="true"
                              data-tt-dia="${diaDisplay}"
                              data-tt-fecha="${this.formatearDiaCorta(d.fecha)}"
                              data-tt-hora="${d.hora}"
                              data-tt-placa="${d.placa}"
                              data-tt-tipo="${d.tipo}"
                              data-tt-validador="${d.validador}"
                              data-tt-zona="${d.zona}"
                              data-tt-conteo="1,000"></span>
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