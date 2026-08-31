/**
 * Componente Reutilizable CustomMultiSelect
 */
class CustomMultiSelect {
    constructor({ btnId, labelId, dropdownId, searchId, optionsContainerId, options = [], title, onChange }) {
        this.btn = document.getElementById(btnId);
        this.label = document.getElementById(labelId);
        this.dropdown = document.getElementById(dropdownId);
        this.search = document.getElementById(searchId);
        this.container = document.getElementById(optionsContainerId);
        this.title = title;
        this.searchQuery = '';
        this.onChange = onChange;
        this.initialized = false;

        this.options = options.map((item, idx) => {
            const id = typeof item === 'object' ? String(item.id) : String(item);
            const label = typeof item === 'object' ? String(item.label || item.id) : String(item);
            const isSelected = (typeof item === 'object' && item.selected !== undefined) ? Boolean(item.selected) : true;
            return { id, label, selected: isSelected };
        });

        if (this.btn && this.dropdown && this.container) {
            this.init();
        }
    }

    init() {
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => {
                if (d !== this.dropdown) d.classList.add('hidden');
            });

            const isHidden = this.dropdown.classList.contains('hidden');
            if (isHidden) {
                this.dropdown.classList.remove('hidden');
                if (this.search) this.search.focus();
            } else {
                this.dropdown.classList.add('hidden');
            }
        });

        this.dropdown.addEventListener('click', (e) => e.stopPropagation());

        if (this.search) {
            this.search.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        this.updateLabel();
        this.render();
        this.initialized = true;
    }

    updateLabel() {
        if (!this.label) return;
        const seleccionados = this.options.filter(o => o.selected);
        const total = this.options.length;

        if (seleccionados.length === 0) {
            this.label.textContent = 'Ninguno seleccionado';
            this.label.className = 'truncate text-slate-400 font-normal';
        } else if (seleccionados.length === total && total > 1) {
            this.label.textContent = 'Todos seleccionados';
            this.label.className = 'truncate text-slate-800 font-semibold';
        } else if (seleccionados.length === 1) {
            this.label.textContent = seleccionados[0].label;
            this.label.className = 'truncate text-slate-800 font-semibold';
        } else {
            this.label.textContent = `${seleccionados.length} seleccionados`;
            this.label.className = 'truncate text-slate-800 font-semibold';
        }

        if (this.initialized && typeof this.onChange === 'function') {
            this.onChange();
        }
    }

    render() {
        if (!this.container) return;
        const query = this.searchQuery.toLowerCase().trim();
        const filtrados = this.options.filter(op => op.label.toLowerCase().includes(query));
        const todosSeleccionados = this.options.length > 0 && this.options.every(o => o.selected);

        let html = '';
        if (!query || 'todos'.includes(query)) {
            html += `
                <label class="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 rounded-lg cursor-pointer group transition-colors">
                    <input type="checkbox" class="chk-todos w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer" ${todosSeleccionados ? 'checked' : ''}>
                    <span class="text-xs font-bold text-blue-700 group-hover:text-blue-800 uppercase tracking-wider">(TODO)</span>
                </label>
                <div class="my-1 border-t border-slate-100"></div>
            `;
        }

        if (filtrados.length === 0) {
            html += `<div class="px-3 py-3 text-xs text-slate-400 text-center">No se encontraron opciones</div>`;
        } else {
            filtrados.forEach(op => {
                html += `
                    <label class="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                        <input type="checkbox" data-id="${op.id}" ${op.selected ? 'checked' : ''} class="chk-item w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer">
                        <span class="text-xs text-slate-700 group-hover:text-slate-900 font-medium">${op.label}</span>
                    </label>
                `;
            });
        }

        this.container.innerHTML = html;

        const chkTodos = this.container.querySelector('.chk-todos');
        if (chkTodos) {
            chkTodos.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                this.options.forEach(o => o.selected = isChecked);
                this.updateLabel();
                this.render();
            });
        }

        const chksItem = this.container.querySelectorAll('.chk-item');
        chksItem.forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const opcion = this.options.find(o => o.id === id);
                if (opcion) opcion.selected = e.target.checked;
                this.updateLabel();
                this.render();
            });
        });
    }

    getSelectedValues() {
        return this.options.filter(o => o.selected).map(o => o.id);
    }

    selectAll(triggerChange = true) {
        this.options.forEach(o => o.selected = true);
        this.updateLabel();
        this.render();
        if (triggerChange && typeof this.onChange === 'function') this.onChange();
    }

    setOptions(newOptions, defaultSelectFirst = false) {
        const previousSelected = this.getSelectedValues();

        this.options = newOptions.map((item, idx) => {
            const id = typeof item === 'object' ? String(item.id) : String(item);
            const label = typeof item === 'object' ? String(item.label || item.id) : String(item);

            let isSelected = false;
            if (previousSelected.length > 0) {
                isSelected = previousSelected.includes(id);
            } else if (typeof item === 'object' && item.selected !== undefined) {
                isSelected = Boolean(item.selected);
            } else if (defaultSelectFirst && idx === 0) {
                isSelected = true;
            }

            return { id, label, selected: isSelected };
        });

        this.updateLabel();
        this.render();
    }

    clearSelection() {
        this.options.forEach(o => o.selected = false);
        this.updateLabel();
        this.render();
    }

}

// CERRAR DROPDOWNS AL HACER CLICK FUERA
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-multiselect-dropdown').forEach(d => d.classList.add('hidden'));
});

// --- DATOS QUEMADOS EXTRAÍDOS DE TABLEAU ---
const rawData = [
    // Cuenta 121201
    { fecha: '2026-08-01', cuentaventa: '121201', nomcliente: 'ABARCA CASANI FLORENCIA MARIA', saldofinal: 369250 },
    { fecha: '2026-08-02', cuentaventa: '121201', nomcliente: 'ABARCA CASTILLO YLBER', saldofinal: 1198330 },
    { fecha: '2026-08-03', cuentaventa: '121201', nomcliente: 'ABARCA HUAINA IVAN ANTONIO', saldofinal: 1059547 },
    { fecha: '2026-08-04', cuentaventa: '121201', nomcliente: 'ABRAHAM FLORES AGUILAR', saldofinal: 1193026 },
    { fecha: '2026-08-05', cuentaventa: '121201', nomcliente: 'ABRIL HUISACAYNA LILIANA', saldofinal: 1408855 },
    { fecha: '2026-08-06', cuentaventa: '121201', nomcliente: 'ACERO ALE LUCERO PAOLA', saldofinal: 772033 },

    // Cuenta 121202
    { fecha: '2026-08-01', cuentaventa: '121202', nomcliente: 'ABARCA CASANI FLORENCIA MARIA', saldofinal: 507924 },
    { fecha: '2026-08-02', cuentaventa: '121202', nomcliente: 'ABARCA CASTILLO YLBER', saldofinal: 764966 },
    { fecha: '2026-08-03', cuentaventa: '121202', nomcliente: 'ABARCA HUAINA IVAN ANTONIO', saldofinal: 640849 },
    { fecha: '2026-08-04', cuentaventa: '121202', nomcliente: 'ABRAHAM FLORES AGUILAR', saldofinal: 537767 },
    { fecha: '2026-08-05', cuentaventa: '121202', nomcliente: 'ABRIL HUISACAYNA LILIANA', saldofinal: 728863 },
    { fecha: '2026-08-06', cuentaventa: '121202', nomcliente: 'ACERO ALE LUCERO PAOLA', saldofinal: 775657 },

    // Cuenta 121204
    { fecha: '2026-08-01', cuentaventa: '121204', nomcliente: 'ABARCA CASANI FLORENCIA MARIA', saldofinal: 90783 },
    { fecha: '2026-08-02', cuentaventa: '121204', nomcliente: 'ABARCA CASTILLO YLBER', saldofinal: 90783 },
    { fecha: '2026-08-03', cuentaventa: '121204', nomcliente: 'ABARCA HUAINA IVAN ANTONIO', saldofinal: 84911 },
    { fecha: '2026-08-04', cuentaventa: '121204', nomcliente: 'ABRAHAM FLORES AGUILAR', saldofinal: 83124 },
    { fecha: '2026-08-05', cuentaventa: '121204', nomcliente: 'ABRIL HUISACAYNA LILIANA', saldofinal: 91060 },
    { fecha: '2026-08-06', cuentaventa: '121204', nomcliente: 'ACERO ALE LUCERO PAOLA', saldofinal: 88359 }
];

const service = new saldosService();
// Instancias de Filtros
let msTipoGrafico, msCuentaVenta, msNomCliente;

let chartsInstancias = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Registro del plugin datalabels
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    // 2. Multiselect: Tipo de Gráfico
    msTipoGrafico = new CustomMultiSelect({
        btnId: 'ms-tipografico-btn',
        labelId: 'ms-tipografico-label',
        dropdownId: 'ms-tipografico-dropdown',
        searchId: 'ms-tipografico-search',
        optionsContainerId: 'ms-tipografico-options',
        options: [
            { id: 'saltosXcobrarXbarra', label: 'saltosXcobrarXbarra', selected: true }
        ],
        onChange: () => actualizarGraficos()
    });

    // 3. Multiselect vacíos iniciales (se poblarán desde la BD)
    msCuentaVenta = new CustomMultiSelect({
        btnId: 'ms-cuentaventa-btn',
        labelId: 'ms-cuentaventa-label',
        dropdownId: 'ms-cuentaventa-dropdown',
        searchId: 'ms-cuentaventa-search',
        optionsContainerId: 'ms-cuentaventa-options',
        options: [],
        onChange: () => actualizarGraficos()
    });

    msNomCliente = new CustomMultiSelect({
        btnId: 'ms-nomcliente-btn',
        labelId: 'ms-nomcliente-label',
        dropdownId: 'ms-nomcliente-dropdown',
        searchId: 'ms-nomcliente-search',
        optionsContainerId: 'ms-nomcliente-options',
        options: [],
        onChange: () => actualizarGraficos()
    });

    // 4. Toggle Plegar/Desplegar Filtros
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

    // 5. Botones Cargar y Limpiar
    const btnCargar = document.getElementById('btn-cargar');
    if (btnCargar) btnCargar.addEventListener('click', actualizarGraficos);

    const btnLimpiar = document.getElementById('btn-limpiar');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            msCuentaVenta.clearSelection();
            msNomCliente.clearSelection();
            actualizarGraficos();
        });
    }

    // 6. Selector de Disposición
    const selectDisp = document.getElementById('select-disposicion-graficos');
    const iconVertical = document.getElementById('icon-disp-vertical');
    const iconHorizontal = document.getElementById('icon-disp-horizontal');

    if (selectDisp) {
        selectDisp.addEventListener('change', () => {
            const esHorizontal = selectDisp.value === 'horizontal';
            if (iconVertical && iconHorizontal) {
                iconVertical.classList.toggle('hidden', esHorizontal);
                iconHorizontal.classList.toggle('hidden', !esHorizontal);
            }
            actualizarGraficos();
        });
    }

    // Listener del selector de período
    const selectTipoPeriodo = document.getElementById('select-tipo-periodo');
    if (selectTipoPeriodo) {
        selectTipoPeriodo.addEventListener('change', () => {
            renderizarInputsPeriodo();
        });
    }

    // Inicializar inputs de fecha
    renderizarInputsPeriodo();

    // 7. Cargar filtros de la BD y render inicial
    await cargarFiltrosDesdeBD();
    await actualizarGraficos();
});

/**
 * Renderiza los inputs exactos según la opción de período seleccionada
 */
function renderizarInputsPeriodo() {
    const tipo = document.getElementById('select-tipo-periodo')?.value || 'entre_fechas';
    const contenedor = document.getElementById('contenedor-inputs-periodo');
    if (!contenedor) return;

    // Valores por defecto orientados al año 2026
    const mesActual = '2026-08';
    const mesAnterior = '2026-07';
    const fechaHoy = '2026-08-30';
    const fechaInicioMes = '2026-08-01';
    const semanaActual = '2026-W35';
    const semanaAnterior = '2026-W31';

    let html = '';

    switch (tipo) {
        case 'por_mes':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">MES</label>
                    <input type="month" id="input-periodo-mes" value="${mesActual}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
            `;
            break;

        case 'entre_meses':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE MES</label>
                    <input type="month" id="input-periodo-mes-desde" value="${mesAnterior}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
                <span class="text-slate-400 font-bold self-center mb-2">-</span>
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA MES</label>
                    <input type="month" id="input-periodo-mes-hasta" value="${mesActual}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
            `;
            break;

        case 'por_fecha':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">FECHA</label>
                    <input type="date" id="input-periodo-fecha-unica" value="${fechaHoy}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
            `;
            break;

        case 'entre_fechas':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE</label>
                    <input type="date" id="input-periodo-fecha-desde" value="${fechaInicioMes}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
                <span class="text-slate-400 font-bold self-center mb-2">-</span>
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA</label>
                    <input type="date" id="input-periodo-fecha-hasta" value="${fechaHoy}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
            `;
            break;

        case 'ultima_semana':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">ÚLTIMA SEMANA</label>
                    <input type="text" value="Últimos 7 días" disabled
                        class="bg-slate-100 border border-slate-200 text-slate-600 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-xs cursor-not-allowed">
                </div>
            `;
            break;

        case 'entre_semanas':
            html = `
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE SEMANA</label>
                    <input type="week" id="input-periodo-semana-desde" value="${semanaAnterior}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
                <span class="text-slate-400 font-bold self-center mb-2">-</span>
                <div class="flex flex-col">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA SEMANA</label>
                    <input type="week" id="input-periodo-semana-hasta" value="${semanaActual}"
                        class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                </div>
            `;
            break;
    }

    contenedor.innerHTML = html;
}

/**
 * Calcula { fechaInicio, fechaFin } en formato YYYY-MM-DD según el tipo e inputs activos
 */
function calcularRangoFechas() {
    const tipo = document.getElementById('select-tipo-periodo')?.value || 'entre_fechas';
    const formatear = (d) => d.toISOString().split('T')[0];
    let inicio = '';
    let fin = '';

    if (tipo === 'por_mes') {
        const val = document.getElementById('input-periodo-mes')?.value || '2026-08';
        const [y, m] = val.split('-').map(Number);
        inicio = `${val}-01`;
        fin = formatear(new Date(y, m, 0));
    } else if (tipo === 'entre_meses') {
        const valDesde = document.getElementById('input-periodo-mes-desde')?.value || '2026-07';
        const valHasta = document.getElementById('input-periodo-mes-hasta')?.value || '2026-08';
        const [yH, mH] = valHasta.split('-').map(Number);
        inicio = `${valDesde}-01`;
        fin = formatear(new Date(yH, mH, 0));
    } else if (tipo === 'por_fecha') {
        const val = document.getElementById('input-periodo-fecha-unica')?.value || '2026-08-30';
        inicio = val;
        fin = val;
    } else if (tipo === 'entre_fechas') {
        inicio = document.getElementById('input-periodo-fecha-desde')?.value || '2026-08-01';
        fin = document.getElementById('input-periodo-fecha-hasta')?.value || '2026-08-30';
    } else if (tipo === 'ultima_semana') {
        const dFin = new Date(2026, 7, 30); // 30 de agosto de 2026
        const dIni = new Date(dFin);
        dIni.setDate(dFin.getDate() - 7);
        inicio = formatear(dIni);
        fin = formatear(dFin);
    } else if (tipo === 'entre_semanas') {
        const valDesde = document.getElementById('input-periodo-semana-desde')?.value || '2026-W31';
        const valHasta = document.getElementById('input-periodo-semana-hasta')?.value || '2026-W35';

        const obtenerFechaSemana = (str, esFin = false) => {
            const [y, w] = str.split('-W').map(Number);
            const simple = new Date(y, 0, 1 + (w - 1) * 7);
            const dow = simple.getDay();
            const ISOweekStart = simple;
            if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
            else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
            if (esFin) ISOweekStart.setDate(ISOweekStart.getDate() + 6);
            return formatear(ISOweekStart);
        };
        inicio = obtenerFechaSemana(valDesde, false);
        fin = obtenerFechaSemana(valHasta, true);
    }

    return { fechaInicio: inicio, fechaFin: fin };
}

async function cargarFiltrosDesdeBD() {
    try {
        const res = await service.obtenerFiltros();
        if (res.success && res.data) {
            const { cuentas, clientes } = res.data;

            // Seleccionar las 3 primeras cuentas por defecto
            const cuentasOpciones = cuentas.map((c, idx) => ({
                id: c.id,
                label: c.label,
                selected: idx < 3
            }));

            // Todos los clientes seleccionados por defecto
            const clientesOpciones = clientes.map(cli => ({
                id: cli.id,
                label: cli.label,
                selected: true
            }));

            msCuentaVenta.setOptions(cuentasOpciones);
            msNomCliente.setOptions(clientesOpciones);
        }
    } catch (error) {
        console.error('Error cargando filtros iniciales:', error);
    }
}

async function actualizarGraficos() {
    chartsInstancias.forEach(c => c.destroy());
    chartsInstancias = [];

    const contenedor = document.getElementById('contenedor-graficos-lista');

    // Obtener las fechas dinámicamente según el período activo
    const { fechaInicio: fInicio, fechaFin: fFin } = calcularRangoFechas();

    const selectedCuentas = msCuentaVenta.getSelectedValues();
    const selectedClientes = msNomCliente.getSelectedValues();
    const modoDisposicion = document.getElementById('select-disposicion-graficos')?.value || 'vertical';

    // Ajustar clases del contenedor según disposición
    if (modoDisposicion === 'horizontal') {
        contenedor.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pb-10 items-start';
    } else {
        contenedor.className = 'flex flex-col gap-6 mt-6 pb-10';
    }

    if (selectedCuentas.length === 0) {
        contenedor.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-medium">
                No hay cuentas seleccionadas para mostrar.
            </div>
        `;
        return;
    }

    // Feedback de carga
    contenedor.innerHTML = `
        <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-blue-600 font-medium flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Consultando datos del servidor...</span>
        </div>
    `;

    try {
        const totalClientesOpciones = msNomCliente.options.length;
        const selectedClientes = msNomCliente.getSelectedValues();

        // Si están todos seleccionados, enviamos un array vacío para que el backend aplique la suma global sin WHERE de clientes
        const clientesPayload = (selectedClientes.length === totalClientesOpciones) ? [] : selectedClientes;

        const payloadFiltros = {
            fecha_inicio: fInicio,
            fecha_fin: fFin,
            cuentas: selectedCuentas,
            clientes: clientesPayload
        };

        const res = await service.obtenerGraficoData(payloadFiltros);
        contenedor.innerHTML = '';

        if (!res.success || !res.payload || !res.payload.data) {
            contenedor.innerHTML = `
                <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                    No se encontraron registros para los filtros seleccionados.
                </div>
            `;
            return;
        }

        const dataAgrupada = res.payload.data;

        selectedCuentas.forEach((cuenta, idx) => {
            const datosCuenta = dataAgrupada[cuenta] || [];
            const canvasId = `chart-cuenta-${idx}`;
            const tarjeta = document.createElement('div');
            tarjeta.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-between';

            tarjeta.innerHTML = `
                <!-- HEADER DE LA TARJETA -->
                <div class="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg border border-blue-100">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            Cuenta ${cuenta}
                        </span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <span class="text-slate-400 font-medium">Período: <strong class="text-slate-700 font-semibold">${fInicio} al ${fFin}</strong></span>
                        <span class="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded border border-slate-200">Soles</span>
                    </div>
                </div>

                <!-- CONTENEDOR CON SCROLL HORIZONTAL -->
                <div class="relative w-full overflow-x-auto pb-2">
                    <div class="${modoDisposicion === 'horizontal' ? 'min-w-[480px]' : 'min-w-[700px]'} h-[300px]">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            `;

            contenedor.appendChild(tarjeta);

            // Instanciar Chart.js
            const ctx = document.getElementById(canvasId).getContext('2d');
            const nuevoChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: datosCuenta.map(d => d.fecha),
                    datasets: [{
                        label: 'Saldofinal',
                        data: datosCuenta.map(d => d.saldofinal),
                        backgroundColor: '#2a4fa0',
                        hoverBackgroundColor: '#1d4ed8',
                        borderRadius: 3,
                        barPercentage: 0.65
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { top: 25 }
                    },
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            anchor: 'end',
                            align: 'top',
                            rotation: -90,
                            offset: 4,
                            color: '#2563eb',
                            font: { size: 9, weight: 'bold' },
                            formatter: (val) => new Intl.NumberFormat('es-PE').format(val)
                        },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `Monto: S/. ${new Intl.NumberFormat('es-PE').format(ctx.raw)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`,
                                font: { size: 10 }
                            },
                            grid: { color: '#f1f5f9' }
                        },
                        x: {
                            ticks: {
                                font: { size: 9 },
                                maxRotation: 90,
                                minRotation: 90
                            },
                            grid: { display: false }
                        }
                    }
                }
            });

            chartsInstancias.push(nuevoChart);
        });
    } catch (error) {
        console.error('Error al actualizar gráficos:', error);
        contenedor.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-rose-500 font-medium">
                Ocurrió un error al cargar los datos del servidor.
            </div>
        `;
    }
}