/**
 * Controlador para la vista PPT multi-año (2024, 2025, 2026)
 * Administra filtros de período (PeriodoHelper), tipo de gráfico, año de conexión y despacho a ChartRegistry.
 */
class PPPT2026Controller {
    constructor() {
        this.service = new PPPT2026Service();
        this.chartTipoActual = 'PT';
        this.anioActual = '2026';
        this.datosDashboard = null;
        this.init();
    }

    async init() {
        const selectAnio = document.getElementById('select-anio');
        if (selectAnio) {
            this.anioActual = selectAnio.value || '2026';
        }
        this.actualizarTitulos();

        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando PPT',
                subtitulo: 'Inicializando gráficos y filtros...'
            });
        }
        try {
            this.setupPeriodo();
            this.setupListeners();
            await this.onCargarClick();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    mesActual() {
        return String(new Date().getMonth() + 1).padStart(2, '0');
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined') {
            const selPeriodo = document.getElementById('select-tipo-periodo');
            if (selPeriodo) {
                selPeriodo.value = 'por_mes';
            }
            PeriodoHelper.renderizarInputs();
            this.sincronizarPeriodoConAnio();
        }
    }

    sincronizarPeriodoConAnio() {
        const tipoPeriodo = document.getElementById('select-tipo-periodo')?.value;

        if (tipoPeriodo === 'por_mes') {
            const inputMes = document.getElementById('input-mes-unico');
            if (inputMes) {
                inputMes.value = `${this.anioActual}-${this.mesActual()}`;
            }
            return;
        }

        this.aplicarAnioAInputsPeriodo();
    }

    aplicarAnioAInputsPeriodo() {
        const contenedor = document.getElementById('contenedor-inputs-periodo');
        if (!contenedor) return;

        const inputs = contenedor.querySelectorAll('input[type="date"], input[type="month"], input[type="hidden"]');

        inputs.forEach((input) => {
            if (!input.value || input.value.length < 4) return;

            const valorOriginal = input.value;
            input.value = `${this.anioActual}${valorOriginal.substring(4)}`;

            if (!input.value) {
                if (input.type === 'date') {
                    input.value = `${this.anioActual}-${this.mesActual()}-01`;
                } else if (input.type === 'month') {
                    input.value = `${this.anioActual}-${this.mesActual()}`;
                }
            }
        });
    }

    actualizarTitulos() {
        const anio = this.anioActual || '2026';
        document.title = `PPT ${anio} - LIMA 1`;

        const titulo = document.getElementById('titulo-modulo-pppt');
        if (titulo) {
            titulo.textContent = `PPT ${anio}`;
        }

        const subtitulo = document.getElementById('subtitulo-modulo-pppt');
        if (subtitulo) {
            subtitulo.textContent = `Módulo de costos por galpón y actividades PPT ${anio}`;
        }
    }

    normalizarMesAlAnio(mes) {
        const valor = String(mes || '').trim();
        if (/^\d{4}-\d{2}/.test(valor)) {
            return `${this.anioActual}${valor.substring(4, 7)}`;
        }
        return `${this.anioActual}-${this.mesActual()}`;
    }

    setupListeners() {
        // Selector de año
        const selAnio = document.getElementById('select-anio');
        if (selAnio) {
            selAnio.addEventListener('change', async (e) => {
                this.anioActual = e.target.value || '2026';
                this.actualizarTitulos();
                this.sincronizarPeriodoConAnio();
                await this.onCargarClick();
            });
        }

        // Selector de tipo de período dinámico
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) {
            selPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                    this.sincronizarPeriodoConAnio();
                }
            });
        }

        // Selector de tipo de gráfico
        const selTipoGrafico = document.getElementById('select-tipo-grafico');
        if (selTipoGrafico) {
            selTipoGrafico.addEventListener('change', async () => {
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
            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'PT';
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].resetFilters === 'function') {
                window.ChartRegistry[tipoGrafico].resetFilters();
            }
            await this.onCargarClick();
        });
    }

    async onCargarClick() {
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
        }

        try {
            const selectAnio = document.getElementById('select-anio');
            if (selectAnio) {
                this.anioActual = selectAnio.value || this.anioActual || '2026';
            }

            const selTipoGrafico = document.getElementById('select-tipo-grafico');
            const tipoGrafico = selTipoGrafico ? selTipoGrafico.value : 'PT';
            this.chartTipoActual = tipoGrafico;

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarEnContenedor('contenedor-grafica-costo', {
                    titulo: `Consultando ${tipoGrafico} ${this.anioActual}...`,
                    subtitulo: 'Cargando métricas del período...'
                });
            }

            // Extraer fechas / mes
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const tipoPeriodo = document.getElementById('select-tipo-periodo')?.value;
            let mesSeleccionado = '';
            if (tipoPeriodo === 'por_mes') {
                mesSeleccionado = document.getElementById('input-mes-unico')?.value || `${this.anioActual}-${this.mesActual()}`;
            } else if (rango.fechaInicio) {
                mesSeleccionado = rango.fechaInicio.substring(0, 7);
            }

            mesSeleccionado = this.normalizarMesAlAnio(mesSeleccionado);

            // Extraer filtros adicionales del componente activo (ej. actividad)
            let extraFilters = {};
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico] && typeof window.ChartRegistry[tipoGrafico].getSelectedFilters === 'function') {
                const selected = window.ChartRegistry[tipoGrafico].getSelectedFilters();
                if (selected && typeof selected === 'object') {
                    extraFilters = { ...extraFilters, ...selected };
                }
            }

            // Filtro por defecto en la primera carga
            if (!extraFilters.actividad) {
                extraFilters.actividad = ['AV'];
            }

            const filtros = {
                anio: this.anioActual,
                tipo_grafico: tipoGrafico,
                mes: mesSeleccionado,
                fecha_inicio: rango.fechaInicio || '',
                fecha_fin: rango.fechaFin || '',
                ...extraFilters
            };

            // Consultar datos reales al backend
            const resp = await this.service.obtenerDashboard(filtros);

            if (!resp || resp.status !== 'success') {
                console.error('Error al obtener datos:', resp);
                if (typeof LoadingHelper !== 'undefined') {
                    LoadingHelper.mostrarError('contenedor-grafica-costo', {
                        mensaje: 'No se pudieron cargar los datos del dashboard.'
                    });
                }
                return;
            }

            this.datosDashboard = resp.payload || resp.data;

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-grafica-costo');
            }

            // Delegar renderizado al componente registrado en ChartRegistry
            if (window.ChartRegistry && window.ChartRegistry[tipoGrafico]) {
                window.ChartRegistry[tipoGrafico].render(this, this.datosDashboard);
            } else {
                console.warn(`No se encontró componente registrado para tipo_grafico="${tipoGrafico}".`);
            }
        } catch (error) {
            console.error('Error en onCargarClick:', error);
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-grafica-costo', {
                    mensaje: 'Ocurrió un error al procesar el dashboard PPT.'
                });
            }
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.restaurarBoton('btn-cargar');
            }
        }
    }
}

// Inicialización automática cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.pppt2026Controller = new PPPT2026Controller();
});
