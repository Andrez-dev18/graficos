class VentasResumenController {
    constructor() {
        this.service = new VentasResumenService();

        // Instancias de Multiselect
        this.msNomDevolucion = null;

        // Estado y Filtros Activos
        this.currentPeriodo = { inicio: '', fin: '' };
        this.chartsMap = new Map();
        this.puntoSeleccionado = null;

        // Opciones por defecto para inicialización rápida
        this.opcionesFiltros = {
            lineasProceso: [],
            zonasFiscales: [],
            items: [],
            nomDevoluciones: []
        };

        this.init();
    }

    /**
     * Inicialización del controlador
     */
    async init() {
        this.setupMultiSelects();
        this.setupPeriodo();
        this.setupEventListeners();
        this.setupModales();
        await this.cargarFiltrosServidor();
    }

    /**
     * Configura el componente de selección múltiple (CustomMultiSelect)
     */
    setupMultiSelects() {
        this.msNomDevolucion = new CustomMultiSelect({
            btnId: 'ms-nomdevolucion-btn',
            labelId: 'ms-nomdevolucion-label',
            dropdownId: 'ms-nomdevolucion-dropdown',
            searchId: 'ms-nomdevolucion-search',
            optionsContainerId: 'ms-nomdevolucion-options',
            title: 'NOMDEVOLUCION',
            options: []
        });
    }

    /**
     * Inicializa PeriodoHelper y los inputs dinámicos de período
     */
    setupPeriodo() {
        PeriodoHelper.renderizarInputs();
    }

    /**
     * Registra todos los event listeners de la interfaz
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

        // 2. Selector de Período (renderiza inputs dinámicamente)
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            PeriodoHelper.renderizarInputs();
        });

        // 3. Selector de Disposición (Actualiza iconos)
        document.getElementById('select-disposicion-graficos')?.addEventListener('change', (e) => {
            const esHorizontal = e.target.value === 'horizontal';
            document.getElementById('icon-disp-vertical')?.classList.toggle('hidden', esHorizontal);
            document.getElementById('icon-disp-horizontal')?.classList.toggle('hidden', !esHorizontal);
            this.aplicarLayoutGrid();
        });

        // 4. Selector de Métrica (Unidades vs Pesos)
        document.getElementById('select-metrica-vista')?.addEventListener('change', () => {
            console.log('Métrica cambiada a:', document.getElementById('select-metrica-vista')?.value);
        });

        // 5. Selector de Tipo de Gráfico
        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => {
            console.log('Tipo de gráfico cambiado a:', document.getElementById('select-tipo-grafico')?.value);
        });

        // 6. Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', () => {
            this.onCargarClick();
        });

        // 7. Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        // 8. Cerrar dropdowns de multiselect y menú flotante al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-multiselect-dropdown') && !e.target.closest('button[id$="-btn"]')) {
                document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => d.classList.add('hidden'));
            }

            const popup = document.getElementById('popup-menu-barra');
            if (popup && !popup.contains(e.target) && !e.target.closest('canvas')) {
                popup.classList.add('hidden');
            }
        });
    }

    /**
     * Configuración de eventos para los modales
     */
    setupModales() {
        // Modal "Ver Datos" Tableau
        const modalVerDatos = document.getElementById('modal-ver-datos');
        const btnCerrarModal = document.getElementById('btn-cerrar-modal');
        const tabBtnResumen = document.getElementById('tab-btn-resumen');
        const tabBtnCompletos = document.getElementById('tab-btn-completos');
        const vistaResumen = document.getElementById('vista-tab-resumen');
        const vistaCompletos = document.getElementById('vista-tab-completos');

        btnCerrarModal?.addEventListener('click', () => {
            modalVerDatos?.classList.add('hidden');
        });

        tabBtnResumen?.addEventListener('click', () => {
            this.cambiarTabModal('resumen', tabBtnResumen, tabBtnCompletos, vistaResumen, vistaCompletos);
        });

        tabBtnCompletos?.addEventListener('click', () => {
            this.cambiarTabModal('completos', tabBtnResumen, tabBtnCompletos, vistaResumen, vistaCompletos);
        });

        // Modal Secundario
        const modalSecundario = document.getElementById('modal-analisis-secundario');
        const btnCerrarSecundario = document.getElementById('btn-cerrar-modal-secundario');
        btnCerrarSecundario?.addEventListener('click', () => {
            modalSecundario?.classList.add('hidden');
        });

        // Cerrar modales con tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modalVerDatos?.classList.add('hidden');
                modalSecundario?.classList.add('hidden');
                document.getElementById('popup-menu-barra')?.classList.add('hidden');
            }
        });
    }

    /**
     * Alterna pestañas dentro del modal Ver Datos
     */
    cambiarTabModal(tab, btnResumen, btnCompletos, vistaResumen, vistaCompletos) {
        if (tab === 'resumen') {
            btnResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            btnCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaResumen?.classList.remove('hidden');
            vistaCompletos?.classList.add('hidden');
        } else {
            btnCompletos.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 transition-all text-left cursor-pointer';
            btnResumen.className = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-left cursor-pointer';
            vistaCompletos?.classList.remove('hidden');
            vistaResumen?.classList.add('hidden');
        }
    }

    /**
     * Consulta y llena las opciones de los filtros desde el backend
     */
    async cargarFiltrosServidor() {
        try {
            const res = await this.service.obtenerFiltros();
            if (res && res.success) {
                this.opcionesFiltros = res;
                this.poblarFiltrosUI();
            } else {
                this.poblarFiltrosUIFallback();
            }
        } catch (error) {
            console.warn('Cargando opciones base para los filtros:', error);
            this.poblarFiltrosUIFallback();
        }
    }

    /**
     * Puebla los selects con los datos devueltos por el backend
     */
    poblarFiltrosUI() {
        // Linea de proceso
        const selLinea = document.getElementById('select-lineaproceso');
        if (selLinea && this.opcionesFiltros.lineasProceso?.length > 0) {
            selLinea.innerHTML = this.opcionesFiltros.lineasProceso.map((lp, idx) => 
                `<option value="${lp.id || lp}" ${idx === 0 ? 'selected' : ''}>${lp.label || lp}</option>`
            ).join('');
        }

        // Zona fiscal
        const selZona = document.getElementById('select-zonafiscal');
        if (selZona && this.opcionesFiltros.zonasFiscales?.length > 0) {
            selZona.innerHTML = `<option value="TODO" selected>(Todo)</option>` + 
                this.opcionesFiltros.zonasFiscales.map(z => `<option value="${z.id || z}">${z.label || z}</option>`).join('');
        }

        // Item
        const selItem = document.getElementById('select-item');
        if (selItem && this.opcionesFiltros.items?.length > 0) {
            selItem.innerHTML = `<option value="TODO" selected>(Todo)</option>` + 
                this.opcionesFiltros.items.map(it => `<option value="${it.id || it}">${it.label || it}</option>`).join('');
        }

        // NomDevolucion (MultiSelect)
        if (this.msNomDevolucion && this.opcionesFiltros.nomDevoluciones?.length > 0) {
            this.msNomDevolucion.setOptions(this.opcionesFiltros.nomDevoluciones);
        }
    }

    /**
     * Opciones de respaldo visual si aún no está listo el endpoint
     */
    poblarFiltrosUIFallback() {
        const selLinea = document.getElementById('select-lineaproceso');
        if (selLinea) {
            selLinea.innerHTML = `
                <option value="1 P. Vivo" selected>1 P. Vivo</option>
                <option value="2 P. Beneficiado">2 P. Beneficiado</option>
            `;
        }

        const selZona = document.getElementById('select-zonafiscal');
        if (selZona) {
            selZona.innerHTML = `
                <option value="TODO" selected>(Todo)</option>
                <option value="AREQUIPA">AREQUIPA</option>
                <option value="CAMANA">CAMANA</option>
                <option value="CUSCO">CUSCO</option>
                <option value="JULIACA">JULIACA</option>
                <option value="LIMA">LIMA</option>
                <option value="MOQUEGUA">MOQUEGUA</option>
                <option value="PUNO">PUNO</option>
                <option value="TACNA">TACNA</option>
            `;
        }

        const selItem = document.getElementById('select-item');
        if (selItem) {
            selItem.innerHTML = `
                <option value="TODO" selected>(Todo)</option>
            `;
        }
    }

    /**
     * Obtiene el payload consolidado de filtros listos para enviar a los endpoints
     */
    obtenerFiltrosActivos() {
        const periodo = PeriodoHelper.obtenerRangoFechas();
        this.currentPeriodo = periodo;

        return {
            tipo_grafico: document.getElementById('select-tipo-grafico')?.value || '07VentasSacCoor',
            metrica: document.getElementById('select-metrica-vista')?.value || 'unidades',
            lineaproceso: document.getElementById('select-lineaproceso')?.value || '',
            zonafiscal: document.getElementById('select-zonafiscal')?.value || 'TODO',
            item: document.getElementById('select-item')?.value || 'TODO',
            nomdevoluciones: this.msNomDevolucion ? this.msNomDevolucion.getSelectedValues() : [],
            fecha_inicio: periodo.inicio,
            fecha_fin: periodo.fin
        };
    }

    /**
     * Handler al pulsar el botón Cargar
     */
    onCargarClick() {
        const filtros = this.obtenerFiltrosActivos();
        console.log('Cargando con filtros:', filtros);
        // La lógica de renderizado se implementará en la siguiente fase
    }

    /**
     * Limpia y resetea los filtros a sus valores predeterminados
     */
    limpiarFiltros() {
        document.getElementById('select-tipo-periodo').value = 'entre_fechas';
        PeriodoHelper.renderizarInputs();

        document.getElementById('select-tipo-grafico').value = '07VentasSacCoor';
        document.getElementById('select-metrica-vista').value = 'unidades';

        const selZona = document.getElementById('select-zonafiscal');
        if (selZona) selZona.value = 'TODO';

        const selItem = document.getElementById('select-item');
        if (selItem) selItem.value = 'TODO';

        if (this.msNomDevolucion) {
            this.msNomDevolucion.selectAll();
        }

        console.log('Filtros reseteados');
    }

    /**
     * Aplica la clase de grilla CSS según la disposición (Vertical / Horizontal)
     */
    aplicarLayoutGrid() {
        const modo = document.getElementById('select-disposicion-graficos')?.value || 'vertical';
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        if (modo === 'horizontal') {
            contenedor.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pb-10';
        } else {
            contenedor.className = 'flex flex-col gap-6 mt-6 pb-10';
        }
    }
}

// Instanciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ventasResumenController = new VentasResumenController();
});
