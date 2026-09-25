const BUDGET_PAIRS = {
    'DashPresupuesto202403': { pct: 'DashPresupuesto202403Pct', det: 'DashPresupuesto202403' },
    'DashPresupuesto202403Pct': { pct: 'DashPresupuesto202403Pct', det: 'DashPresupuesto202403' },
    'DashPresupuesto202404': { pct: 'DashPresupuesto202404Pct', det: 'DashPresupuesto202404' },
    'DashPresupuesto202404Pct': { pct: 'DashPresupuesto202404Pct', det: 'DashPresupuesto202404' },
    'DashPresupuesto202410': { pct: 'DashPresupuesto202410Pct', det: 'DashPresupuesto202410' },
    'DashPresupuesto202410Pct': { pct: 'DashPresupuesto202410Pct', det: 'DashPresupuesto202410' },
    'DashPresupuesto202503': { pct: 'DashPresupuesto202503Pct', det: 'DashPresupuesto202503' },
    'DashPresupuesto202503Pct': { pct: 'DashPresupuesto202503Pct', det: 'DashPresupuesto202503' }
};

/**
 * Controlador para el Módulo Presupuestos PAB
 * Administra filtros de período (PeriodoHelper), tipo de gráfico y despacho al ChartRegistry.
 */
class PresupuestosPABController {
    constructor() {
        this.service = new PresupuestosPABService();
        this.chartTipoActual = 'DashPresupuesto202403';
        this.datosDashboard = null;
        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        this.actualizarVisibilidadControles();
        await this.onCargarClick();
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined') {
            const selPeriodo = document.getElementById('select-tipo-periodo');
            if (selPeriodo) {
                selPeriodo.value = 'entre_fechas';
            }
            PeriodoHelper.renderizarInputs();
        }
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

        // Selector de tipo de gráfico
        const selTipoGrafico = document.getElementById('select-tipo-grafico');
        if (selTipoGrafico) {
            selTipoGrafico.addEventListener('change', async () => {
                this.actualizarVisibilidadControles();
                await this.onCargarClick();
            });
        }

        // Checkbox para combinar resumen % y detalle
        const chkMostrarAmbos = document.getElementById('check-mostrar-ambos');
        if (chkMostrarAmbos) {
            chkMostrarAmbos.addEventListener('change', async () => {
                await this.onCargarClick();
            });
        }

        // Selector dinámico de presupuesto en la barra superior de filtros
        const selFiltroPresu = document.getElementById('select-filtro-presupuesto');
        if (selFiltroPresu) {
            selFiltroPresu.addEventListener('change', async () => {
                await this.onCargarClick();
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
            this.setupPeriodo();
            await this.onCargarClick();
        });
    }

    actualizarVisibilidadControles() {
        const selTipoGrafico = document.getElementById('select-tipo-grafico');
        const contPresu = document.getElementById('contenedor-filtro-presupuesto');
        const contCombinar = document.getElementById('contenedor-check-combinar');

        const tipo = selTipoGrafico ? selTipoGrafico.value : '';
        const esPresupuesto = Boolean(BUDGET_PAIRS[tipo]);

        if (contCombinar) {
            if (esPresupuesto) {
                contCombinar.classList.remove('hidden');
            } else {
                contCombinar.classList.add('hidden');
            }
        }

        if (contPresu) {
            if (tipo === 'AnalisisPartidas' || tipo === 'ComprasPorPartida' || tipo === 'RC' || tipo === 'DashComparativoCronoRC' || tipo === 'ComparativoCronoRC') {
                contPresu.classList.remove('hidden');
            } else {
                contPresu.classList.add('hidden');
            }
        }
    }

    actualizarVisibilidadFiltroPresupuesto() {
        this.actualizarVisibilidadControles();
    }

    actualizarOpcionesPresupuesto(lista = [], seleccionado = '202410') {
        const selFiltroPresu = document.getElementById('select-filtro-presupuesto');
        if (!selFiltroPresu || !lista.length) return;

        const actualVal = selFiltroPresu.value || seleccionado;
        selFiltroPresu.innerHTML = lista.map(p => {
            const isSel = (p.codigo === actualVal) ? 'selected' : '';
            return `<option value="${p.codigo}" ${isSel}>${p.nombre || p.codigo}</option>`;
        }).join('');
    }

    async onCargarClick() {
        this.actualizarVisibilidadControles();

        const btnCargar = document.getElementById('btn-cargar');
        const originalBtnHtml = btnCargar ? btnCargar.innerHTML : '';

        if (btnCargar) {
            btnCargar.disabled = true;
            btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
            btnCargar.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando...</span>
            `;
        }

        try {
            const selTipoGrafico = document.getElementById('select-tipo-grafico');
            const tipoGrafico = selTipoGrafico ? selTipoGrafico.value : 'DashPresupuesto202403';
            this.chartTipoActual = tipoGrafico;

            const chkMostrarAmbos = document.getElementById('check-mostrar-ambos');
            const mostrarAmbos = chkMostrarAmbos ? chkMostrarAmbos.checked : false;
            const pair = BUDGET_PAIRS[tipoGrafico];

            // Extraer fechas del PeriodoHelper
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const selPresu = document.getElementById('select-filtro-presupuesto');
            const presuFiltro = (selPresu && selPresu.value) ? selPresu.value : '';

            const contGraficos = document.getElementById('contenedor-graficos-lista');
            if (contGraficos) contGraficos.innerHTML = '';

            if (mostrarAmbos && pair) {
                // Modo combinado: Cargar Resumen % (primero) y Detalle (segundo)
                const [respPct, respDet] = await Promise.all([
                    this.service.obtenerDashboard({
                        tipo_grafico: pair.pct,
                        fecha_inicio: rango.fechaInicio || '',
                        fecha_fin: rango.fechaFin || '',
                        presupuesto: presuFiltro
                    }),
                    this.service.obtenerDashboard({
                        tipo_grafico: pair.det,
                        fecha_inicio: rango.fechaInicio || '',
                        fecha_fin: rango.fechaFin || '',
                        presupuesto: presuFiltro
                    })
                ]);

                if (!respPct || respPct.status !== 'success' || !respDet || respDet.status !== 'success') {
                    console.error('Error al obtener datos combinados:', { respPct, respDet });
                    alert('No se pudieron cargar los datos combinados del presupuesto.');
                    return;
                }

                const dataPct = respPct.data || respPct.payload || {};
                const dataDet = respDet.data || respDet.payload || {};

                if (contGraficos) {
                    contGraficos.innerHTML = `
                        <div id="contenedor-resumen-pct" class="w-full"></div>
                        <div id="contenedor-detalle-presupuesto" class="w-full"></div>
                    `;
                }

                // Renderizar primero el resumen (%)
                if (window.ChartRegistry && window.ChartRegistry[pair.pct]) {
                    window.ChartRegistry[pair.pct].render(this, dataPct, 'contenedor-resumen-pct');
                }

                // Renderizar segundo el detalle
                if (window.ChartRegistry && window.ChartRegistry[pair.det]) {
                    window.ChartRegistry[pair.det].render(this, dataDet, 'contenedor-detalle-presupuesto');
                }

            } else {
                // Modo individual normal
                const filtros = {
                    tipo_grafico: tipoGrafico,
                    fecha_inicio: rango.fechaInicio || '',
                    fecha_fin: rango.fechaFin || ''
                };
                if (presuFiltro) {
                    filtros.presupuesto = presuFiltro;
                }

                // Consultar datos al servicio
                const resp = await this.service.obtenerDashboard(filtros);

                if (!resp || resp.status !== 'success') {
                    console.error('Error al obtener datos:', resp);
                    alert('No se pudieron cargar los datos del presupuesto.');
                    return;
                }

                this.datosDashboard = resp.data || resp.payload;

                // Si devuelve lista de presupuestos disponibles, sincronizar el select
                if (this.datosDashboard && this.datosDashboard.presupuestos_disponibles) {
                    this.actualizarOpcionesPresupuesto(
                        this.datosDashboard.presupuestos_disponibles,
                        this.datosDashboard.presupuesto_seleccionado || '202410'
                    );
                }

                // Renderizar según componente registrado en ChartRegistry
                if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
                    window.ChartRegistry[tipoGrafico].render(this, this.datosDashboard, contGraficos);
                } else if (window.ChartRegistry && window.ChartRegistry['DashPresupuesto202403']) {
                    // Fallback por defecto al reporte 202403
                    window.ChartRegistry['DashPresupuesto202403'].render(this, this.datosDashboard, contGraficos);
                } else {
                    console.warn(`No se encontró componente registrado para tipo_grafico="${tipoGrafico}".`);
                }
            }
        } catch (error) {
            console.error('Error en onCargarClick:', error);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }
}

// Inicialización automática al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.presupuestosPABController = new PresupuestosPABController();
});
