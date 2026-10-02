/**
 * Controlador para el Módulo AnalisisCostoDiario
 * Integra PeriodoHelper, CustomMultiSelect, Servicio y ChartRegistry para los 3 Dashboards:
 * 1. CostoFormulaPorTipoAABB
 * 2. CostoFormula-Insumos
 * 3. RevisionInsumos
 */
class AnalisisCostoDiarioController {
    constructor() {
        this.service = new AnalisisCostoDiarioService();
        this.chartTipoActual = 'CostoFormulaPorTipoAABB';
        this.datosDashboard = null;
        this.filtrosIniciales = null;

        // Instancias de CustomMultiSelect para RevisionInsumos
        this.multiTipoRevision = null;
        this.multiTransaccionRevision = null;
        this.multiItemsRevision = null;

        this.init();
    }

    async init() {
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.mostrarInicial({
                titulo: 'Cargando Análisis Costo Diario',
                subtitulo: 'Inicializando período y filtros...'
            });
        }
        try {
            this.setupPeriodo();
            this.setupListeners();
            await this.cargarFiltrosIniciales();
            this.actualizarVisibilidadFiltros();
            await this.onCargarClick();
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarInicial();
            }
        }
    }

    setupPeriodo() {
        // Inicializar selector de periodos
        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();

            // Fechas por defecto
            const inputIni = document.getElementById('input-fecha-inicio');
            const inputFin = document.getElementById('input-fecha-fin');
            if (inputIni) inputIni.value = '2026-02-19';
            if (inputFin) inputFin.value = '2026-03-21';
        }
    }

    async cargarFiltrosIniciales() {
        try {
            this.filtrosIniciales = await this.service.obtenerFiltrosIniciales();
            if (this.filtrosIniciales) {
                if (this.filtrosIniciales.fecha_defecto) {
                    const def = this.filtrosIniciales.fecha_defecto;
                    const inputIni = document.getElementById('input-fecha-inicio');
                    const inputFin = document.getElementById('input-fecha-fin');
                    if (inputIni && def.inicio) inputIni.value = def.inicio;
                    if (inputFin && def.fin) inputFin.value = def.fin;
                }

                // Inicializar CustomMultiSelects para RevisionInsumos
                this.poblarFiltrosRevisionInsumos();
            }
        } catch (e) {
            console.warn('Error cargando filtros iniciales:', e);
        }
    }

    poblarFiltrosRevisionInsumos() {
        const meta = this.filtrosIniciales?.revision_insumos_meta;
        if (!meta) return;

        // 1. Fecha Histórica por defecto
        const inputHisto = document.getElementById('input-fechahisto');
        if (inputHisto && meta.fechahisto_defecto) {
            inputHisto.value = meta.fechahisto_defecto;
        }

        if (typeof CustomMultiSelect === 'undefined') return;

        // 2. CustomMultiSelect: TIPO (INSUMO, FABRICACIO)
        const tiposDisponibles = meta.tipos_disponibles || ['INSUMO', 'FABRICACIO'];
        const optTipos = tiposDisponibles.map(t => ({
            id: t,
            label: t,
            selected: t === 'INSUMO' // INSUMO seleccionado por defecto según Tableau
        }));

        if (!this.multiTipoRevision && document.getElementById('btn-dropdown-tipo-revision')) {
            this.multiTipoRevision = new CustomMultiSelect({
                btnId: 'btn-dropdown-tipo-revision',
                labelId: 'label-tipo-revision',
                dropdownId: 'dropdown-tipo-revision',
                searchId: 'search-tipo-revision',
                optionsContainerId: 'container-options-tipo-revision',
                title: 'TIPO',
                options: optTipos
            });
        }

        // 3. CustomMultiSelect: TRANSACCIÓN (S003, E003, S811)
        const transDisponibles = meta.transacciones_disponibles || ['S003', 'E003', 'S811'];
        const optTrans = transDisponibles.map(tr => ({
            id: tr,
            label: tr,
            selected: tr === 'S003' // S003 seleccionado por defecto según Tableau
        }));

        if (!this.multiTransaccionRevision && document.getElementById('btn-dropdown-transaccion-revision')) {
            this.multiTransaccionRevision = new CustomMultiSelect({
                btnId: 'btn-dropdown-transaccion-revision',
                labelId: 'label-transaccion-revision',
                dropdownId: 'dropdown-transaccion-revision',
                searchId: 'search-transaccion-revision',
                optionsContainerId: 'container-options-transaccion-revision',
                title: 'TRANSACCIÓN',
                options: optTrans
            });
        }

        // 4. CustomMultiSelect: ÍTEMS
        const itemsDisp = meta.items_disponibles || [];
        const itemsDefecto = meta.items_defecto || [];

        const optItems = itemsDisp.map(it => {
            const label = it.label || `${it.coditem} ${it.nomitem}`.trim();
            const id = label;
            const isSelected = itemsDefecto.some(def => 
                def.trim().toLowerCase() === id.toLowerCase() || 
                def.trim().toLowerCase() === (it.coditem || '').toLowerCase()
            );
            return {
                id: id,
                label: label,
                selected: isSelected
            };
        });

        if (!this.multiItemsRevision && document.getElementById('btn-dropdown-items-revision')) {
            this.multiItemsRevision = new CustomMultiSelect({
                btnId: 'btn-dropdown-items-revision',
                labelId: 'label-items-revision',
                dropdownId: 'dropdown-items-revision',
                searchId: 'search-items-revision',
                optionsContainerId: 'container-options-items-revision',
                title: 'ITEMS',
                options: optItems
            });
        }
    }

    actualizarVisibilidadFiltros() {
        const contRevision = document.getElementById('contenedor-filtros-revision-insumos');
        if (contRevision) {
            if (this.chartTipoActual === 'RevisionInsumos') {
                contRevision.classList.remove('hidden');
                contRevision.classList.add('flex');
            } else {
                contRevision.classList.add('hidden');
                contRevision.classList.remove('flex');
            }
        }

        // Si es RevisionAlimento, cambiar periodo a 'por_fecha' automáticamente
        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo && typeof PeriodoHelper !== 'undefined') {
            if (this.chartTipoActual === 'RevisionAlimento') {
                if (selectPeriodo.value !== 'por_fecha') {
                    selectPeriodo.value = 'por_fecha';
                    PeriodoHelper.renderizarInputs();
                    const inputFecha = document.getElementById('input-fecha-unica');
                    if (inputFecha) {
                        const defHisto = this.filtrosIniciales?.revision_insumos_meta?.fechahisto_defecto || '2026-02-26';
                        inputFecha.value = defHisto;
                    }
                }
            } else if (this.chartTipoActual !== 'RevisionAlimento' && selectPeriodo.value === 'por_fecha') {
                // Restaurar entre_fechas al volver a otros dashboards
                selectPeriodo.value = 'entre_fechas';
                PeriodoHelper.renderizarInputs();
                const inputIni = document.getElementById('input-fecha-inicio');
                const inputFin = document.getElementById('input-fecha-fin');
                if (inputIni) inputIni.value = '2026-02-19';
                if (inputFin) inputFin.value = '2026-03-21';
            }
        }
    }

    setupListeners() {
        // Cambio de Dashboard
        const selectDashboard = document.getElementById('select-dashboard');
        if (selectDashboard) {
            selectDashboard.addEventListener('change', async () => {
                this.chartTipoActual = selectDashboard.value;
                this.actualizarVisibilidadFiltros();
                await this.onCargarClick();
            });
        }

        // Cambio de tipo de período
        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo) {
            selectPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
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
    }

    limpiarFiltros() {
        const selectDashboard = document.getElementById('select-dashboard');
        if (selectDashboard) {
            selectDashboard.value = 'CostoFormulaPorTipoAABB';
            this.chartTipoActual = 'CostoFormulaPorTipoAABB';
            this.actualizarVisibilidadFiltros();
        }

        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo) {
            selectPeriodo.value = 'entre_fechas';
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        }

        const inputIni = document.getElementById('input-fecha-inicio');
        const inputFin = document.getElementById('input-fecha-fin');
        if (inputIni) inputIni.value = '2026-02-19';
        if (inputFin) inputFin.value = '2026-03-21';

        // Reset filtros específicos de RevisionInsumos
        const inputHisto = document.getElementById('input-fechahisto');
        if (inputHisto) {
            inputHisto.value = '2026-02-26';
        }

        if (this.multiTipoRevision) {
            this.multiTipoRevision.options.forEach(o => o.selected = (o.id === 'INSUMO'));
            this.multiTipoRevision.updateLabel(false);
            this.multiTipoRevision.render();
        }

        if (this.multiTransaccionRevision) {
            this.multiTransaccionRevision.options.forEach(o => o.selected = (o.id === 'S003'));
            this.multiTransaccionRevision.updateLabel(false);
            this.multiTransaccionRevision.render();
        }

        if (this.multiItemsRevision) {
            const itemsDefecto = this.filtrosIniciales?.revision_insumos_meta?.items_defecto || [];
            this.multiItemsRevision.options.forEach(o => {
                o.selected = itemsDefecto.some(def => 
                    def.trim().toLowerCase() === o.id.toLowerCase() ||
                    o.id.toLowerCase().startsWith(def.trim().toLowerCase().split(' ')[0])
                );
            });
            this.multiItemsRevision.updateLabel(false);
            this.multiItemsRevision.render();
        }

        this.onCargarClick();
    }

    obtenerFiltrosSeleccionados() {
        let rango = { fechaInicio: '2026-02-19', fechaFin: '2026-03-21' };

        if (typeof PeriodoHelper !== 'undefined') {
            rango = PeriodoHelper.obtenerRangoFechas();
        }

        const selectDashboard = document.getElementById('select-dashboard');
        if (selectDashboard) {
            this.chartTipoActual = selectDashboard.value;
        }

        const params = {
            tipo_grafico: this.chartTipoActual || 'CostoFormulaPorTipoAABB',
            fecha_inicio: rango.fechaInicio || '2026-02-19',
            fecha_fin: rango.fechaFin || '2026-03-21'
        };

        // Filtros específicos para RevisionAlimento
        if (this.chartTipoActual === 'RevisionAlimento') {
            const inputFechaUnica = document.getElementById('input-fecha-unica');
            const fHisto = (inputFechaUnica && inputFechaUnica.value) ? inputFechaUnica.value : (rango.fechaFin || '2026-02-26');
            params.fechahisto = fHisto;
            params.fecha_inicio = rango.fechaInicio || `${fHisto.substring(0, 7)}-01`;
            params.fecha_fin = fHisto;
        }

        // Filtros adicionales cuando el dashboard es RevisionInsumos
        if (this.chartTipoActual === 'RevisionInsumos') {
            const inputHisto = document.getElementById('input-fechahisto');
            params.fechahisto = inputHisto && inputHisto.value ? inputHisto.value : '2026-02-26';

            // 1. Tipo
            if (this.multiTipoRevision) {
                const tiposSel = this.multiTipoRevision.getSelectedValues();
                const totalTipos = this.multiTipoRevision.options.length;
                if (tiposSel.length === totalTipos && totalTipos > 1) {
                    params.tipo = null; // Todos
                } else if (tiposSel.length === 0) {
                    params.tipo = [];
                } else {
                    params.tipo = tiposSel;
                }
            } else {
                params.tipo = 'INSUMO';
            }

            // 2. Transacción
            if (this.multiTransaccionRevision) {
                const transSel = this.multiTransaccionRevision.getSelectedValues();
                const totalTrans = this.multiTransaccionRevision.options.length;
                if (transSel.length === totalTrans && totalTrans > 1) {
                    params.transaccion = null; // Todos
                } else if (transSel.length === 0) {
                    params.transaccion = [];
                } else {
                    params.transaccion = transSel;
                }
            } else {
                params.transaccion = 'S003';
            }

            // 3. Ítems
            if (this.multiItemsRevision) {
                const itemsSel = this.multiItemsRevision.getSelectedValues();
                const totalItems = this.multiItemsRevision.options.length;
                if (itemsSel.length === totalItems && totalItems > 1) {
                    params.items = null; // Todos los ítems
                } else if (itemsSel.length === 0) {
                    params.items = [];
                } else {
                    params.items = itemsSel;
                }
            } else {
                params.items = this.filtrosIniciales?.revision_insumos_meta?.items_defecto || null;
            }
        }

        return params;
    }

    async onCargarClick() {
        if (typeof LoadingHelper !== 'undefined') {
            LoadingHelper.iniciarBoton('btn-cargar', { texto: 'Cargando...' });
            LoadingHelper.mostrarEnContenedor('contenedor-graficos-lista', {
                titulo: `Consultando ${this.chartTipoActual}...`,
                subtitulo: 'Cargando análisis de costo diario...'
            });
        }

        try {
            const filtros = this.obtenerFiltrosSeleccionados();
            this.datosDashboard = await this.service.obtenerDashboard(filtros);

            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.ocultarEnContenedor('contenedor-graficos-lista');
            }

            // Si el dashboard es RevisionInsumos y se retornaron nuevos items_disponibles, actualizar CustomMultiSelect
            if (this.chartTipoActual === 'RevisionInsumos' && this.multiItemsRevision && this.datosDashboard?.metadatos_filtros?.items_disponibles) {
                const nuevosItems = this.datosDashboard.metadatos_filtros.items_disponibles;
                if (nuevosItems.length > 0 && nuevosItems.length !== this.multiItemsRevision.options.length) {
                    const prevSel = this.multiItemsRevision.getSelectedValues();
                    const optItems = nuevosItems.map(it => {
                        const label = it.label || `${it.coditem} ${it.nomitem}`.trim();
                        const id = label;
                        return {
                            id: id,
                            label: label,
                            selected: prevSel.length > 0 ? prevSel.includes(id) : false
                        };
                    });
                    this.multiItemsRevision.setOptions(optItems);
                }
            }

            this.renderGraficoActual();
        } catch (error) {
            console.error('Error al cargar análisis de costo diario:', error);
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.mostrarError('contenedor-graficos-lista', {
                    mensaje: 'Ocurrió un error al obtener los datos de Análisis de Costo Diario.'
                });
            }
        } finally {
            if (typeof LoadingHelper !== 'undefined') {
                LoadingHelper.restaurarBoton('btn-cargar');
            }
        }
    }

    renderGraficoActual() {
        const targetChart = window.ChartRegistry && (
            window.ChartRegistry[this.chartTipoActual] || 
            window.ChartRegistry['Dash_' + this.chartTipoActual.replace(/-/g, '')]
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
    window.AnalisisCostoDiarioControllerInstance = new AnalisisCostoDiarioController();
});
