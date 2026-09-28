/**
 * Controlador para el Módulo Ventas2024
 * Conecta los selectores del HTML base con el Servicio, CustomMultiSelect y el ChartRegistry.
 */
class Ventas2024Controller {
    constructor() {
        this.service = new Ventas2024Service();
        this.chartTipoActual = 'Todos';
        this.datosDashboard = null;

        this.msProvincia = null;
        this.msCoorporativo = null;
        this.msTDoc = null;

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
        // Multi-select Provincia
        this.msProvincia = new CustomMultiSelect({
            btnId: 'ms-provincia-btn',
            labelId: 'ms-provincia-label',
            dropdownId: 'ms-provincia-dropdown',
            searchId: 'ms-provincia-search',
            optionsContainerId: 'ms-provincia-options',
            title: 'PROVINCIA',
            options: [
                { id: 'AREQUIPA', label: 'AREQUIPA', selected: true },
                { id: 'CAMANA', label: 'CAMANA', selected: true },
                { id: 'CUZCO', label: 'CUZCO', selected: true },
                { id: 'ILO', label: 'ILO', selected: true },
                { id: 'LA JOYA', label: 'LA JOYA', selected: true },
                { id: 'MOLLENDO', label: 'MOLLENDO', selected: true },
                { id: 'MOQUEGUA', label: 'MOQUEGUA', selected: true },
                { id: 'PEDREGAL', label: 'PEDREGAL', selected: true },
                { id: 'TACNA', label: 'TACNA', selected: true }
            ]
        });

        // Multi-select Corporativo
        this.msCoorporativo = new CustomMultiSelect({
            btnId: 'ms-coorporativo-btn',
            labelId: 'ms-coorporativo-label',
            dropdownId: 'ms-coorporativo-dropdown',
            searchId: 'ms-coorporativo-search',
            optionsContainerId: 'ms-coorporativo-options',
            title: 'COORPORATIVO',
            options: []
        });

        // Multi-select Tipo de Documento
        this.msTDoc = new CustomMultiSelect({
            btnId: 'ms-tdoc-btn',
            labelId: 'ms-tdoc-label',
            dropdownId: 'ms-tdoc-dropdown',
            searchId: 'ms-tdoc-search',
            optionsContainerId: 'ms-tdoc-options',
            title: 'TDOC',
            options: [
                { id: '01', label: '01 - Factura', selected: true },
                { id: '03', label: '03 - Boleta', selected: true },
                { id: '07', label: '07 - Nota de Crédito', selected: true },
                { id: '08', label: '08 - Nota de Débito', selected: true }
            ]
        });
    }

    async cargarFiltrosIniciales() {
        try {
            const filtros = await this.service.obtenerFiltrosIniciales();
            if (filtros) {
                // Provincias
                if (Array.isArray(filtros.provincias) && filtros.provincias.length > 0) {
                    const provOpts = filtros.provincias.map(p => ({
                        id: p.id,
                        label: p.label || p.id,
                        selected: true
                    }));
                    this.msProvincia.setOptions(provOpts);
                }

                // Corporativos
                if (Array.isArray(filtros.coorporativos) && filtros.coorporativos.length > 0) {
                    const coorpOpts = filtros.coorporativos.map(c => ({
                        id: c.id,
                        label: c.label || c.id,
                        selected: true
                    }));
                    this.msCoorporativo.setOptions(coorpOpts);
                }

                // Tipos de Documento
                if (Array.isArray(filtros.tdocs) && filtros.tdocs.length > 0) {
                    const tdocOpts = filtros.tdocs.map(t => ({
                        id: t.id,
                        label: t.label || t.id,
                        selected: true
                    }));
                    this.msTDoc.setOptions(tdocOpts);
                }

                // Fechas por defecto
                if (filtros.fecha_defecto) {
                    const inputIni = document.getElementById('input-fecha-inicio');
                    const inputFin = document.getElementById('input-fecha-fin');
                    if (inputIni && filtros.fecha_defecto.inicio) inputIni.value = filtros.fecha_defecto.inicio;
                    if (inputFin && filtros.fecha_defecto.fin) inputFin.value = filtros.fecha_defecto.fin;
                }
            }
        } catch (e) {
            console.warn('Error cargando filtros iniciales:', e);
        }
    }

    setupListeners() {
        // Selector Tipo de Gráfico
        const selectTipoGrafico = document.getElementById('select-tipo-grafico');
        if (selectTipoGrafico) {
            selectTipoGrafico.addEventListener('change', async (e) => {
                this.chartTipoActual = e.target.value;
                await this.onCargarClick();
            });
        }

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
        const selectTipo = document.getElementById('select-tipo-grafico');
        if (selectTipo) selectTipo.value = 'Todos';
        this.chartTipoActual = 'Todos';

        const inputIni = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');
        if (inputIni) inputIni.value = '2024-06-01';
        if (inputFin) inputFin.value = '2024-06-21';

        if (this.msProvincia) {
            this.msProvincia.options.forEach(o => o.selected = true);
            this.msProvincia.updateLabel();
            this.msProvincia.render();
        }
        if (this.msCoorporativo) {
            this.msCoorporativo.options.forEach(o => o.selected = true);
            this.msCoorporativo.updateLabel();
            this.msCoorporativo.render();
        }
        if (this.msTDoc) {
            this.msTDoc.options.forEach(o => o.selected = true);
            this.msTDoc.updateLabel();
            this.msTDoc.render();
        }

        this.onCargarClick();
    }

    obtenerFiltrosSeleccionados() {
        const selectTipo = document.getElementById('select-tipo-grafico');
        const tipoGrafico = selectTipo ? selectTipo.value : (this.chartTipoActual || 'Todos');
        this.chartTipoActual = tipoGrafico;

        const inputIni = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');

        const fechaIni = inputIni ? inputIni.value : '2024-06-01';
        const fechaFin = inputFin ? inputFin.value : '2024-06-21';

        const provincias = this.msProvincia ? this.msProvincia.getSelectedValues() : [];
        const coorporativos = this.msCoorporativo ? this.msCoorporativo.getSelectedValues() : [];
        const tdocs = this.msTDoc ? this.msTDoc.getSelectedValues() : [];

        return {
            tipo_grafico: tipoGrafico,
            fecha_inicio: fechaIni,
            fecha_fin: fechaFin,
            provincia: provincias,
            coorporativo: coorporativos,
            tdoc: tdocs
        };
    }

    async onCargarClick() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-xs border border-slate-200/80">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                    <p class="text-sm font-semibold text-slate-600">Cargando reporte de Ventas 2024...</p>
                </div>
            `;
        }

        const filtros = this.obtenerFiltrosSeleccionados();
        this.datosDashboard = await this.service.obtenerDashboard(filtros);

        this.renderGraficoActual();
    }

    renderGraficoActual() {
        const targetChart = window.ChartRegistry && (
            window.ChartRegistry[this.chartTipoActual] || 
            window.ChartRegistry[`Dash_Ventas2024_${this.chartTipoActual}`] || 
            window.ChartRegistry['Todos']
        );
        const contenedor = document.getElementById('contenedor-graficos-lista');

        if (targetChart && typeof targetChart.render === 'function') {
            targetChart.render(this, this.datosDashboard, contenedor);
        } else {
            if (contenedor) {
                contenedor.innerHTML = `
                    <div class="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
                        <i class="fas fa-exclamation-triangle text-amber-500 text-3xl mb-2"></i>
                        <h3 class="text-sm font-bold text-slate-700 uppercase">Error al renderizar</h3>
                        <p class="text-xs text-slate-400 mt-1">No se encontró el componente de visualización para ${this.chartTipoActual}.</p>
                    </div>
                `;
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.Ventas2024ControllerInstance = new Ventas2024Controller();
});
