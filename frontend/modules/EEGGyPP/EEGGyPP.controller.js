/**
 * Controlador para el Módulo LIMA 1 EE_GGyPP
 * Conecta los selectores del HTML base con el Servicio, CustomMultiSelect reactivo en cascada y el ChartRegistry.
 */
class EEGGyPPController {
    constructor() {
        this.service = new EEGGyPPService();
        this.chartTipoActual = 'Dash_EEGGyPP';
        this.datosDashboard = null;

        this.msProceso = null;
        this.msProvincia = null;
        this.msZona = null;

        this.todasLasZonas = [];
        this.provZonasMapa = [];

        this.init();
    }

    async init() {
        this.setupMultiSelects();
        this.setupListeners();
        await this.cargarFiltrosIniciales();
        await this.onCargarClick();
    }

    /**
     * Configura los componentes de selección múltiple (CustomMultiSelect)
     */
    setupMultiSelects() {
        this.msProceso = new CustomMultiSelect({
            btnId: 'ms-proceso-btn',
            labelId: 'ms-proceso-label',
            dropdownId: 'ms-proceso-dropdown',
            searchId: 'ms-proceso-search',
            optionsContainerId: 'ms-proceso-options',
            title: 'PROCESO',
            options: [
                { id: 'BENEFICIADO', label: 'BENEFICIADO', selected: true },
                { id: 'TROZADO', label: 'TROZADO', selected: false }
            ]
        });

        this.msProvincia = new CustomMultiSelect({
            btnId: 'ms-provincia-btn',
            labelId: 'ms-provincia-label',
            dropdownId: 'ms-provincia-dropdown',
            searchId: 'ms-provincia-search',
            optionsContainerId: 'ms-provincia-options',
            title: 'PROVINCIA',
            options: [
                { id: 'AREQUIPA', label: 'AREQUIPA', selected: true },
                { id: 'JULIACA', label: 'JULIACA', selected: true },
                { id: 'PUNO', label: 'PUNO', selected: true }
            ],
            onChange: () => {
                this.onProvinciaChange();
            }
        });

        this.msZona = new CustomMultiSelect({
            btnId: 'ms-zona-btn',
            labelId: 'ms-zona-label',
            dropdownId: 'ms-zona-dropdown',
            searchId: 'ms-zona-search',
            optionsContainerId: 'ms-zona-options',
            title: 'ZONA',
            options: [
                { id: 'PACHACUTEC-MERCADOS', label: 'PACHACUTEC-MERCADOS', selected: true },
                { id: 'PACHACUTEC-PATEROS', label: 'PACHACUTEC-PATEROS', selected: false },
                { id: 'PALOMAR-HORIZONTAL', label: 'PALOMAR-HORIZONTAL', selected: false },
                { id: 'PALOMAR-TIENDA', label: 'PALOMAR-TIENDA', selected: false },
                { id: 'NO TIENE ZONA', label: 'NO TIENE ZONA', selected: false }
            ]
        });
    }

    async cargarFiltrosIniciales() {
        try {
            const filtros = await this.service.obtenerFiltrosIniciales();
            if (filtros) {
                if (Array.isArray(filtros.procesos) && filtros.procesos.length > 0) {
                    const procOpts = filtros.procesos.map(p => ({
                        id: p.id,
                        label: p.label || p.id,
                        selected: p.id === 'BENEFICIADO'
                    }));
                    this.msProceso.setOptions(procOpts);
                }

                if (Array.isArray(filtros.provincias) && filtros.provincias.length > 0) {
                    const provOpts = filtros.provincias.map(p => ({
                        id: p.id,
                        label: p.label || p.id,
                        selected: p.id === 'AREQUIPA'
                    }));
                    this.msProvincia.setOptions(provOpts);
                }

                if (Array.isArray(filtros.zonas)) {
                    this.todasLasZonas = filtros.zonas;
                }

                if (Array.isArray(filtros.prov_zonas)) {
                    this.provZonasMapa = filtros.prov_zonas;
                }

                // Filtrar zonas disponibles según la provincia seleccionada
                this.onProvinciaChange(true);
            }
        } catch (e) {
            console.warn('Error cargando filtros iniciales:', e);
        }
    }

    /**
     * Cascada reactiva: Al cambiar la Provincia, actualiza las Zonas relevantes disponibles
     */
    onProvinciaChange(isInitial = false) {
        if (!this.msProvincia || !this.msZona) return;

        const provinciasSel = this.msProvincia.getSelectedValues();
        let zonasDisponibles = [];

        if (provinciasSel.length === 0 || provinciasSel.length === this.msProvincia.options.length) {
            // Todas las zonas
            zonasDisponibles = this.todasLasZonas.map(z => z.id);
        } else {
            // Solo zonas que pertenecen a las provincias seleccionadas
            const zonasFiltradas = this.provZonasMapa
                .filter(item => provinciasSel.includes(item.provincia))
                .map(item => item.zona);
            zonasDisponibles = Array.from(new Set(zonasFiltradas));
        }

        const currentZonaSelected = this.msZona.getSelectedValues();
        const newZonaOptions = zonasDisponibles.map(z => {
            let isSelected = false;
            if (isInitial) {
                isSelected = (z === 'PACHACUTEC-MERCADOS');
            } else if (currentZonaSelected.includes(z)) {
                isSelected = true;
            } else if (currentZonaSelected.length === 0) {
                isSelected = true;
            }
            return { id: z, label: z, selected: isSelected };
        });

        // Si ninguna quedó seleccionada, seleccionar la primera por defecto
        if (newZonaOptions.length > 0 && !newZonaOptions.some(o => o.selected)) {
            newZonaOptions[0].selected = true;
        }

        this.msZona.setOptions(newZonaOptions);
    }

    setupListeners() {
        // Toggle de Filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const contFiltros = document.getElementById('contenedor-filtros-contenido');
        const labelToggle = document.getElementById('label-toggle-filtros');
        const iconToggle = document.getElementById('icon-toggle-filtros');

        if (btnToggle && contFiltros) {
            btnToggle.addEventListener('click', () => {
                const isHidden = contFiltros.classList.contains('hidden');
                if (isHidden) {
                    contFiltros.classList.remove('hidden');
                    if (labelToggle) labelToggle.textContent = 'Ocultar filtros';
                    if (iconToggle) iconToggle.style.transform = 'rotate(0deg)';
                } else {
                    contFiltros.classList.add('hidden');
                    if (labelToggle) labelToggle.textContent = 'Mostrar filtros';
                    if (iconToggle) iconToggle.style.transform = 'rotate(180deg)';
                }
            });
        }

        // Selector Tipo Gráfico
        const selTipo = document.getElementById('select-tipo-grafico');
        if (selTipo) {
            selTipo.addEventListener('change', async (e) => {
                this.chartTipoActual = e.target.value;
                await this.onCargarClick();
            });
        }

        // Botón Cargar
        const btnCargar = document.getElementById('btn-cargar');
        if (btnCargar) {
            btnCargar.addEventListener('click', async () => {
                await this.onCargarClick();
            });
        }

        // Botón Limpiar
        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.limpiarFiltros();
            });
        }

        // Cerrar dropdowns al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-multiselect-dropdown') && !e.target.closest('button[id$="-btn"]')) {
                document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => d.classList.add('hidden'));
            }
        });
    }

    limpiarFiltros() {
        if (this.msProceso) {
            this.msProceso.options.forEach(o => o.selected = (o.id === 'BENEFICIADO'));
            this.msProceso.updateLabel();
            this.msProceso.render();
        }
        if (this.msProvincia) {
            this.msProvincia.options.forEach(o => o.selected = (o.id === 'AREQUIPA'));
            this.msProvincia.updateLabel();
            this.msProvincia.render();
            this.onProvinciaChange();
        }
        if (this.msZona) {
            this.msZona.options.forEach(o => o.selected = (o.id === 'PACHACUTEC-MERCADOS'));
            this.msZona.updateLabel();
            this.msZona.render();
        }

        this.onCargarClick();
    }

    obtenerFiltrosSeleccionados() {
        const procesos = this.msProceso ? this.msProceso.getSelectedValues() : ['BENEFICIADO'];
        const provincias = this.msProvincia ? this.msProvincia.getSelectedValues() : ['AREQUIPA'];
        const zonas = this.msZona ? this.msZona.getSelectedValues() : ['PACHACUTEC-MERCADOS'];

        return {
            tipo_grafico: this.chartTipoActual,
            proceso: procesos,
            provincia: provincias,
            zona: zonas
        };
    }

    async onCargarClick() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 bg-white rounded-xl">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                    <p class="text-sm font-semibold text-slate-600">Cargando reporte de EE_GGyPP...</p>
                </div>
            `;
        }

        const filtros = this.obtenerFiltrosSeleccionados();
        this.datosDashboard = await this.service.obtenerDashboard(filtros);

        this.renderGraficoActual();
    }

    renderGraficoActual() {
        const targetChart = window.ChartRegistry && window.ChartRegistry[this.chartTipoActual];
        const contenedor = document.getElementById('contenedor-graficos-lista');

        if (targetChart && typeof targetChart.render === 'function') {
            targetChart.render(this, this.datosDashboard, contenedor);
        } else {
            if (contenedor) {
                contenedor.innerHTML = `
                    <div class="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
                        <i class="fas fa-chart-line text-slate-400 text-3xl mb-2"></i>
                        <h3 class="text-sm font-bold text-slate-700 uppercase">Vista en construcción</h3>
                        <p class="text-xs text-slate-400 mt-1">El componente para ${this.chartTipoActual} se completará en la siguiente fase.</p>
                    </div>
                `;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.EEGGyPPControllerInstance = new EEGGyPPController();
});
