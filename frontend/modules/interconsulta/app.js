/**
 * Control de Filtros Personalizados y Fechas Dinámicas
 * Controlador Principal del Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO GENERAL ---
    const state = {
        periodo: 'entre_fechas',
        agruparPor: 'semana',
        periodoGraficos: 'dia',
        modoCombinado: 'ninguno',
        combinarGraficos: false,
        modoCombinadoHz: 'ninguno'
    };

    let ultimaListaRenderizada = [];
    let currentFetchToken = 0;
    let cacheGranjasData = [];
    window.cacheGranjasData = cacheGranjasData;

    // --- INSTANCIACIÓN DE MULTI-SELECTS PERSONALIZADOS ---
    const msGranja = new CustomMultiSelect({
        btnId: 'ms-granja-btn',
        labelId: 'ms-granja-label',
        dropdownId: 'ms-granja-dropdown',
        searchId: 'ms-granja-search',
        optionsContainerId: 'ms-granja-options',
        title: 'Granja',
        options: [],
        onChange: () => {
            actualizarCampaniasYGalpones();
            filtrarYMostrarGraficos();
        }
    });

    const msCampania = new CustomMultiSelect({
        btnId: 'ms-campania-btn',
        labelId: 'ms-campania-label',
        dropdownId: 'ms-campania-dropdown',
        searchId: 'ms-campania-search',
        optionsContainerId: 'ms-campania-options',
        title: 'Campaña',
        options: [],
        onChange: () => filtrarYMostrarGraficos()
    });

    const msGalpon = new CustomMultiSelect({
        btnId: 'ms-galpon-btn',
        labelId: 'ms-galpon-label',
        dropdownId: 'ms-galpon-dropdown',
        searchId: 'ms-galpon-search',
        optionsContainerId: 'ms-galpon-options',
        title: 'Galpón',
        options: [],
        onChange: () => filtrarYMostrarGraficos()
    });

    const msGraficos = new CustomMultiSelect({
        btnId: 'ms-graficos-btn',
        labelId: 'ms-graficos-label',
        dropdownId: 'ms-graficos-dropdown',
        searchId: 'ms-graficos-search',
        optionsContainerId: 'ms-graficos-options',
        title: 'Tipo de Gráficos',
        options: [
            { id: 'mortalidad', label: 'Mortalidad' }
        ],
        onChange: () => {
            if (state.combinarGraficos) {
                const seleccionados = msGraficos.getSelectedValues();
                if (seleccionados.length > 5) {
                    mostrarAlertaToast('Máximo 5 tipos de gráfico permitidos en modo combinado');
                    msGraficos.options.forEach(opt => {
                        if (seleccionados.slice(5).includes(opt.id)) {
                            opt.selected = false;
                        }
                    });
                    msGraficos.updateLabel();
                    msGraficos.render();
                }
            }
            filtrarYMostrarGraficos();
        }
    });

    window.msGranja = msGranja;
    window.msCampania = msCampania;
    window.msGalpon = msGalpon;
    window.msGraficos = msGraficos;

    const msUbicacionUnificada = new CustomHierarchicalMultiSelect({
        btnId: 'ms-unificado-btn',
        labelId: 'ms-unificado-label',
        dropdownId: 'ms-unificado-dropdown',
        searchId: 'ms-unificado-search',
        optionsContainerId: 'ms-unificado-options',
        btnTodosId: 'btn-unificado-todos',
        btnLimpiarId: 'btn-unificado-limpiar',
        onChange: () => {
            filtrarYMostrarGraficos();
        }
    });

    window.msUbicacionUnificada = msUbicacionUnificada;

    // --- INSTANCIACIÓN DE MULTI-SELECTS PARA TAB 2 (GRÁFICOS HORIZONTALES) ---
    const msGranjaHz = new CustomMultiSelect({
        btnId: 'ms-granja-btn-hz',
        labelId: 'ms-granja-label-hz',
        dropdownId: 'ms-granja-dropdown-hz',
        searchId: 'ms-granja-search-hz',
        optionsContainerId: 'ms-granja-options-hz',
        title: 'Granja',
        options: [],
        onChange: () => {
            actualizarCampaniasYGalponesHz();
        }
    });

    const msCampaniaHz = new CustomMultiSelect({
        btnId: 'ms-campania-btn-hz',
        labelId: 'ms-campania-label-hz',
        dropdownId: 'ms-campania-dropdown-hz',
        searchId: 'ms-campania-search-hz',
        optionsContainerId: 'ms-campania-options-hz',
        title: 'Campaña',
        options: [],
        onChange: () => {}
    });

    const msGalponHz = new CustomMultiSelect({
        btnId: 'ms-galpon-btn-hz',
        labelId: 'ms-galpon-label-hz',
        dropdownId: 'ms-galpon-dropdown-hz',
        searchId: 'ms-galpon-search-hz',
        optionsContainerId: 'ms-galpon-options-hz',
        title: 'Galpón',
        options: [],
        onChange: () => {}
    });

    const TIPOS_PESAJE_DIAS_HZ = ['pesaje_pollo', 'cv_peso', 'ganancia_peso', 'cv_ganancia'];

    const msDiasPesajeHz = new CustomMultiSelect({
        btnId: 'ms-dias-pesaje-btn-hz',
        labelId: 'ms-dias-pesaje-label-hz',
        dropdownId: 'ms-dias-pesaje-dropdown-hz',
        searchId: 'ms-dias-pesaje-search-hz',
        optionsContainerId: 'ms-dias-pesaje-options-hz',
        title: 'Días de Pesaje',
        options: [],
        onChange: () => {}
    });

    const msGraficosHz = new CustomMultiSelect({
        btnId: 'ms-graficos-btn-hz',
        labelId: 'ms-graficos-label-hz',
        dropdownId: 'ms-graficos-dropdown-hz',
        searchId: 'ms-graficos-search-hz',
        optionsContainerId: 'ms-graficos-options-hz',
        title: 'Tipo de Gráficos',
        options: [
            { id: 'mortalidad', label: 'Mortalidad' }
        ],
        onChange: () => {
            if (state.modoCombinadoHz === 'tipo') {
                const seleccionados = msGraficosHz.getSelectedValues();
                if (seleccionados.length > 5) {
                    mostrarAlertaToast('Máximo 5 tipos de gráfico permitidos en modo combinado');
                    msGraficosHz.options.forEach(opt => {
                        if (seleccionados.slice(5).includes(opt.id)) {
                            opt.selected = false;
                        }
                    });
                    msGraficosHz.updateLabel();
                    msGraficosHz.render();
                }
            }
            actualizarVisibilidadDiasPesajeHz();
        }
    });

    const msUbicacionUnificadaHz = new CustomHierarchicalMultiSelect({
        btnId: 'ms-unificado-btn-hz',
        labelId: 'ms-unificado-label-hz',
        dropdownId: 'ms-unificado-dropdown-hz',
        searchId: 'ms-unificado-search-hz',
        optionsContainerId: 'ms-unificado-options-hz',
        btnTodosId: 'btn-unificado-todos-hz',
        btnLimpiarId: 'btn-unificado-limpiar-hz',
        onChange: () => {}
    });

    window.msGranjaHz = msGranjaHz;
    window.msCampaniaHz = msCampaniaHz;
    window.msGalponHz = msGalponHz;
    window.msGraficosHz = msGraficosHz;
    window.msDiasPesajeHz = msDiasPesajeHz;
    window.msUbicacionUnificadaHz = msUbicacionUnificadaHz;

    async function actualizarVisibilidadDiasPesajeHz() {
        const container = document.getElementById('container-filtro-dias-pesaje-hz');
        if (!container || !msGraficosHz) return;

        const seleccionados = msGraficosHz.getSelectedValues();
        const pesajeSeleccionados = seleccionados.filter(t => TIPOS_PESAJE_DIAS_HZ.includes(t));

        if (pesajeSeleccionados.length === 0) {
            container.classList.add('hidden');
            container.classList.remove('flex');
            return;
        }

        container.classList.remove('hidden');
        container.classList.add('flex');

        try {
            const mapDias = new Map();
            for (const tipoPesaje of pesajeSeleccionados) {
                const resp = await fetch(`../../backend/interconsulta/pesaje-dias?tipo=${encodeURIComponent(tipoPesaje)}`);
                const json = await resp.json();
                if (json && json.success && Array.isArray(json.dias)) {
                    json.dias.forEach(d => {
                        if (!mapDias.has(d.dia)) {
                            mapDias.set(d.dia, d);
                        }
                    });
                }
            }

            const diasOrdenados = Array.from(mapDias.values()).sort((a, b) => a.dia - b.dia);
            const opcionesDias = diasOrdenados.map(d => ({
                id: String(d.dia),
                label: d.semana !== null && d.semana !== undefined ? `Día ${d.dia} (Semana ${d.semana})` : (d.dia === 1 ? `Día ${d.dia} (Inicial)` : `Día ${d.dia}`)
            }));

            const prevSeleccionados = msDiasPesajeHz ? msDiasPesajeHz.getSelectedValues() : [];
            msDiasPesajeHz.setOptions(opcionesDias, false);

            if (prevSeleccionados.length > 0) {
                msDiasPesajeHz.options.forEach(opt => {
                    if (prevSeleccionados.includes(opt.id)) {
                        opt.selected = true;
                    }
                });
                msDiasPesajeHz.updateLabel();
                msDiasPesajeHz.render();
            } else {
                msDiasPesajeHz.clearSelection();
            }
        } catch (err) {
            console.error('Error al cargar catálogo de días de pesaje:', err);
        }
    }

    function actualizarCampaniasYGalponesHz() {
        if (!msGranjaHz || !msCampaniaHz || !msGalponHz) return;
        const granjasSeleccionadas = (msGranjaHz.getSelectedValues() || []).map(String);
        const granjasObj = cacheGranjasData.filter(g => granjasSeleccionadas.includes(String(g.granja || g.codigo || g.nombre)));

        const setCampanias = new Set();
        const setGalpones = new Set();

        granjasObj.forEach(g => {
            if (Array.isArray(g.campanias)) {
                g.campanias.forEach(c => setCampanias.add(String(c)));
            }
            if (Array.isArray(g.galpones)) {
                g.galpones.forEach(gp => setGalpones.add(String(gp)));
            }
        });

        const opcionesCampanias = Array.from(setCampanias).map(c => ({
            id: String(c),
            label: `Campaña ${c}`,
            selected: true
        }));

        const opcionesGalpones = Array.from(setGalpones).map(gp => ({
            id: String(gp),
            label: `Galpón ${gp}`,
            selected: true
        }));

        msCampaniaHz.setOptions(opcionesCampanias, false);
        msCampaniaHz.selectAll(false);
        msGalponHz.setOptions(opcionesGalpones, false);
        msGalponHz.selectAll(false);
    }

    function obtenerParametrosPeriodo() {
        const p = { periodoTipo: state.periodo };

        const inputFechaUnica = document.getElementById('input-fecha-unica');
        const inputFechaDesde = document.getElementById('input-fecha-desde');
        const inputFechaHasta = document.getElementById('input-fecha-hasta');
        const inputMesUnico = document.getElementById('input-mes-unico');
        const inputMesDesde = document.getElementById('input-mes-desde');
        const inputMesHasta = document.getElementById('input-mes-hasta');

        if (state.periodo === 'por_fecha' && inputFechaUnica) {
            p.fechaUnica = inputFechaUnica.value;
        } else if (state.periodo === 'entre_fechas') {
            if (inputFechaDesde) p.fechaInicio = inputFechaDesde.value;
            if (inputFechaHasta) p.fechaFin = inputFechaHasta.value;
        } else if (state.periodo === 'por_mes' && inputMesUnico) {
            p.mesUnico = inputMesUnico.value;
        } else if (state.periodo === 'entre_meses') {
            if (inputMesDesde) p.mesInicio = inputMesDesde.value;
            if (inputMesHasta) p.mesFin = inputMesHasta.value;
        }
        return p;
    }

    async function cargarCatalogoGranjas() {
        try {
            const params = obtenerParametrosPeriodo();
            const qs = new URLSearchParams(params).toString();
            const response = await fetch(`../../backend/interconsulta/granjas-campanias-galpones?${qs}`);
            const data = await response.json();

            if (!data.success) return;

            cacheGranjasData = (data.granjas || []).map(g => ({
                ...g,
                granja: String(g.granja || g.codigo || g.nombre || ''),
                codigo: g.codigo ? String(g.codigo) : String(g.granja || ''),
                nombre: g.nombre ? String(g.nombre) : '',
                campanias: Array.isArray(g.campanias) ? g.campanias.map(String) : [],
                galpones: Array.isArray(g.galpones) ? g.galpones.map(String) : []
            }));
            window.cacheGranjasData = cacheGranjasData;

            const opcionesGranjas = cacheGranjasData.map(g => ({
                id: String(g.granja || g.codigo || g.nombre),
                label: (g.granja || '') + (g.nombre && g.nombre !== g.granja ? ' — ' + g.nombre : '')
            }));

            // TAB 1: Selecciona solo la primera por defecto
            msGranja.setOptions(opcionesGranjas, true);
            if (msUbicacionUnificada) {
                msUbicacionUnificada.setData(cacheGranjasData, false);
            }

            // TAB 2: Multi-selects para vista horizontal
            if (msGranjaHz) {
                msGranjaHz.setOptions(opcionesGranjas, false);
                msGranjaHz.selectAll(false);
            }
            if (msUbicacionUnificadaHz) {
                msUbicacionUnificadaHz.setData(cacheGranjasData, true);
            }

            actualizarCampaniasYGalpones();
            actualizarCampaniasYGalponesHz();
        } catch (err) {
            console.error('Error al cargar catálogo de granjas:', err);
        }
    }

    function actualizarCampaniasYGalpones() {
        const granjasSeleccionadas = (msGranja ? msGranja.getSelectedValues() : []).map(String);
        const granjasObj = cacheGranjasData.filter(g => granjasSeleccionadas.includes(String(g.granja || g.codigo || g.nombre)));

        const setCampanias = new Set();
        const setGalpones = new Set();

        granjasObj.forEach(g => {
            if (Array.isArray(g.campanias)) {
                g.campanias.forEach(c => setCampanias.add(String(c)));
            }
            if (Array.isArray(g.galpones)) {
                g.galpones.forEach(gp => setGalpones.add(String(gp)));
            }
        });

        const opcionesCampanias = Array.from(setCampanias).map(c => ({
            id: String(c),
            label: `Campaña ${c}`
        }));

        const opcionesGalpones = Array.from(setGalpones).map(gp => ({
            id: String(gp),
            label: `Galpón ${gp}`
        }));

        msCampania.setOptions(opcionesCampanias, true);
        msGalpon.setOptions(opcionesGalpones, true);
    }

    async function cargarTiposGrafica() {
        try {
            const response = await fetch('../../backend/interconsulta/tipos-grafica');
            const data = await response.json();

            if (!data.success || !Array.isArray(data.data)) return;

            const opcionesTipos = [];
            data.data.forEach(t => {
                const id = t.id || t.tipo;
                const label = t.label || t.nombre || id;
                if (id) {
                    opcionesTipos.push({ id, label });
                }
            });

            if (opcionesTipos.length > 0) {
                msGraficos.setOptions(opcionesTipos, true);
                if (msGraficosHz) {
                    msGraficosHz.setOptions(opcionesTipos, true);
                    actualizarVisibilidadDiasPesajeHz();
                }
            }
        } catch (err) {
            console.error('Error al cargar tipos de gráfica:', err);
        }
    }

    // --- FECHAS DINÁMICAS Y SELECCIÓN DE PERIODO ---
    const selectPeriodo = document.getElementById('select-periodo');
    const selectAgrupar = document.getElementById('select-agrupar');
    const contenedorFechasDinamicas = document.getElementById('contenedor-fechas-dinamicas');
    const btnCargar = document.getElementById('btn-cargar');

    function renderizarInputsFecha() {
        if (!contenedorFechasDinamicas) return;

        const hoy = new Date();
        const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

        let html = '';

        switch (state.periodo) {
            case 'por_fecha':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fecha</label>
                        <input type="date" id="input-fecha-unica" value="${formatISOFecha(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;

            case 'entre_fechas':
                html = `
                    <div class="flex items-center gap-2">
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Desde</label>
                            <input type="date" id="input-fecha-desde" value="${formatISOFecha(haceUnAnio)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                        <span class="text-slate-400 text-sm font-bold self-end pb-2.5">-</span>
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Hasta</label>
                            <input type="date" id="input-fecha-hasta" value="${formatISOFecha(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                    </div>
                `;
                break;

            case 'por_mes':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mes</label>
                        <input type="month" id="input-mes-unico" value="${formatISOMes(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;

            case 'entre_meses':
                html = `
                    <div class="flex items-center gap-2">
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Desde Mes</label>
                            <input type="month" id="input-mes-desde" value="${formatISOMes(mesAnterior)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                        <span class="text-slate-400 text-sm font-bold self-end pb-2.5">-</span>
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Hasta Mes</label>
                            <input type="month" id="input-mes-hasta" value="${formatISOMes(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                    </div>
                `;
                break;

            case 'ultima_semana':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rango Activo</label>
                        <div class="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-2">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span>${getRangoUltimaSemana()}</span>
                        </div>
                    </div>
                `;
                break;

            case 'entre_semanas':
                html = `
                    <div class="flex items-center gap-2">
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Desde Semana</label>
                            <input type="week" id="input-semana-desde" value="${getISOWeekString(mesAnterior)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                        <span class="text-slate-400 text-sm font-bold self-end pb-2.5">-</span>
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Hasta Semana</label>
                            <input type="week" id="input-semana-hasta" value="${getISOWeekString(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                    </div>
                `;
                break;
        }

        contenedorFechasDinamicas.innerHTML = html;

        contenedorFechasDinamicas.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('change', () => cargarCatalogoGranjas());
        });
    }

    // --- MODAL DE CONFIGURACIÓN DE PERIODO GRANJAS ---
    const modalPeriodo = document.getElementById('modal-periodo-granjas');
    const btnAbrirModalPeriodo = document.getElementById('btn-abrir-modal-periodo');
    const btnCerrarModalPeriodo = document.getElementById('btn-cerrar-modal-periodo');
    const btnCancelarModalPeriodo = document.getElementById('btn-cancelar-modal-periodo');
    const btnAplicarModalPeriodo = document.getElementById('btn-aplicar-modal-periodo');
    const labelResumenPeriodo = document.getElementById('label-resumen-periodo');
    const labelResumenPeriodoHz = document.getElementById('label-resumen-periodo-hz');
    const btnAbrirModalPeriodoHz = document.getElementById('btn-abrir-modal-periodo-hz');

    function actualizarTextoResumenPeriodo() {
        if (!selectPeriodo) return;
        const selectedOpt = selectPeriodo.options[selectPeriodo.selectedIndex];
        if (selectedOpt) {
            if (labelResumenPeriodo) labelResumenPeriodo.textContent = selectedOpt.textContent.trim();
            if (labelResumenPeriodoHz) labelResumenPeriodoHz.textContent = selectedOpt.textContent.trim();
        }
    }

    function abrirModalPeriodo() {
        if (!modalPeriodo) return;
        modalPeriodo.classList.remove('hidden');
        const content = modalPeriodo.querySelector('.modal-card-content');
        setTimeout(() => {
            modalPeriodo.classList.remove('opacity-0');
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    }

    function cerrarModalPeriodo() {
        if (!modalPeriodo) return;
        const content = modalPeriodo.querySelector('.modal-card-content');
        if (content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
        }
        modalPeriodo.classList.add('opacity-0');
        setTimeout(() => {
            modalPeriodo.classList.add('hidden');
        }, 200);
    }

    if (btnAbrirModalPeriodo) {
        btnAbrirModalPeriodo.addEventListener('click', abrirModalPeriodo);
    }
    if (btnAbrirModalPeriodoHz) {
        btnAbrirModalPeriodoHz.addEventListener('click', abrirModalPeriodo);
    }
    if (btnCerrarModalPeriodo) {
        btnCerrarModalPeriodo.addEventListener('click', cerrarModalPeriodo);
    }
    if (btnCancelarModalPeriodo) {
        btnCancelarModalPeriodo.addEventListener('click', cerrarModalPeriodo);
    }
    if (modalPeriodo) {
        modalPeriodo.addEventListener('click', (e) => {
            if (e.target === modalPeriodo) cerrarModalPeriodo();
        });
    }

    // --- SWITCH UNIFICAR FILTROS UBICACIÓN TAB 2 ---
    const chkUnificarUbicacionHz = document.getElementById('chk-unificar-ubicacion-hz');
    const contenedorUbicacionSeparadosHz = document.getElementById('contenedor-ubicacion-separados-hz');
    const contenedorUbicacionUnificadoHz = document.getElementById('contenedor-ubicacion-unificado-hz');

    if (chkUnificarUbicacionHz) {
        chkUnificarUbicacionHz.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (contenedorUbicacionSeparadosHz) contenedorUbicacionSeparadosHz.classList.add('hidden');
                if (contenedorUbicacionUnificadoHz) contenedorUbicacionUnificadoHz.classList.remove('hidden');
            } else {
                if (contenedorUbicacionSeparadosHz) contenedorUbicacionSeparadosHz.classList.remove('hidden');
                if (contenedorUbicacionUnificadoHz) contenedorUbicacionUnificadoHz.classList.add('hidden');
            }
        });
    }
    if (btnAplicarModalPeriodo) {
        btnAplicarModalPeriodo.addEventListener('click', () => {
            actualizarTextoResumenPeriodo();
            cerrarModalPeriodo();
            if (btnCargar) btnCargar.click();
        });
    }

    if (selectPeriodo) {
        selectPeriodo.addEventListener('change', (e) => {
            state.periodo = e.target.value;
            renderizarInputsFecha();
            actualizarTextoResumenPeriodo();
            cargarCatalogoGranjas();
        });
        actualizarTextoResumenPeriodo();
    }

    const selectPeriodoGraficos = document.getElementById('select-periodo-graficos');
    const contenedorFechasGraficos = document.getElementById('contenedor-fechas-graficos');

    function renderizarInputsFechaGraficos() {
        if (!contenedorFechasGraficos) return;

        const hoy = new Date();
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        let html = '';

        switch (state.periodoGraficos) {
            case 'dia':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fecha</label>
                        <input type="date" id="input-graf-fecha-unica" value="${formatISOFecha(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            case 'semana':
                html = `
                    <div class="flex items-center gap-2">
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Desde Semana</label>
                            <input type="week" id="input-graf-semana-desde" value="${getISOWeekString(mesAnterior)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                        <span class="text-slate-400 text-sm font-bold self-end pb-2.5">-</span>
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Hasta Semana</label>
                            <input type="week" id="input-graf-semana-hasta" value="${getISOWeekString(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                    </div>
                `;
                break;
            case 'mes':
                html = `
                    <div class="flex items-center gap-2">
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Desde Mes</label>
                            <input type="month" id="input-graf-mes-desde" value="${formatISOMes(mesAnterior)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                        <span class="text-slate-400 text-sm font-bold self-end pb-2.5">-</span>
                        <div class="flex flex-col">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Hasta Mes</label>
                            <input type="month" id="input-graf-mes-hasta" value="${formatISOMes(hoy)}" class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                        </div>
                    </div>
                `;
                break;
        }

        contenedorFechasGraficos.innerHTML = html;
    }

    if (selectPeriodoGraficos) {
        selectPeriodoGraficos.addEventListener('change', (e) => {
            state.periodoGraficos = e.target.value;
            renderizarInputsFechaGraficos();
        });
    }

    if (selectAgrupar) {
        selectAgrupar.addEventListener('change', (e) => {
            state.agruparPor = e.target.value;
        });
    }

    // --- TABS DE NAVEGACIÓN ENTRE VISTAS ---
    let tabActivoActual = 'dinamicos';
    const tabDinamicos = document.getElementById('tab-graficos-dinamicos');
    const tabHorizontales = document.getElementById('tab-graficos-horizontales');
    const contenedorFiltrosHorizontales = document.getElementById('contenedor-filtros-horizontales');
    const contenedorGraficosHorizontales = document.getElementById('contenedor-graficos-horizontales');
    const contenedorGraficos = document.getElementById('contenedor-graficos');

    let horizontalesCargadoPrimeraVez = false;

    function cambiarTabPrincipal(tab) {
        tabActivoActual = tab;
        const seccionDinamicos = document.getElementById('seccion-graficos-dinamicos');
        const vistaFiltros1 = document.getElementById('contenedor-filtros-contenido');
        const vistaFiltros2 = document.getElementById('contenedor-filtros-horizontales');
        const vistaGraficos2 = document.getElementById('contenedor-graficos-horizontales');

        if (tab === 'dinamicos') {
            if (tabDinamicos) {
                tabDinamicos.className = 'flex items-center gap-2.5 px-5 py-3.5 text-xs sm:text-sm font-bold bg-white text-blue-600 border-r border-slate-200/80 rounded-tl-2xl z-10 transition-all cursor-pointer';
                const iconDiv = tabDinamicos.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-1.5 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center';
            }
            if (tabHorizontales) {
                tabHorizontales.className = 'flex items-center gap-2.5 px-5 py-3.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-50 border-r border-slate-200/80 transition-all cursor-pointer';
                const iconDiv = tabHorizontales.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-1.5 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center';
            }

            if (vistaFiltros1) vistaFiltros1.classList.remove('hidden');
            if (vistaFiltros2) vistaFiltros2.classList.add('hidden');
            if (seccionDinamicos) seccionDinamicos.classList.remove('hidden');
            if (vistaGraficos2) vistaGraficos2.classList.add('hidden');
        } else if (tab === 'horizontales') {
            if (tabHorizontales) {
                tabHorizontales.className = 'flex items-center gap-2.5 px-5 py-3.5 text-xs sm:text-sm font-bold bg-white text-blue-600 border-r border-slate-200/80 z-10 transition-all cursor-pointer';
                const iconDiv = tabHorizontales.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-1.5 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center';
            }
            if (tabDinamicos) {
                tabDinamicos.className = 'flex items-center gap-2.5 px-5 py-3.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-50 border-r border-slate-200/80 rounded-tl-2xl transition-all cursor-pointer';
                const iconDiv = tabDinamicos.querySelector('div');
                if (iconDiv) iconDiv.className = 'p-1.5 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center';
            }

            if (vistaFiltros1) vistaFiltros1.classList.add('hidden');
            if (vistaFiltros2) vistaFiltros2.classList.remove('hidden');
            if (seccionDinamicos) seccionDinamicos.classList.add('hidden');
            if (vistaGraficos2) vistaGraficos2.classList.remove('hidden');

            if (!horizontalesCargadoPrimeraVez) {
                horizontalesCargadoPrimeraVez = true;
                consultarGraficosHorizontales();
            }
        }
    }

    if (tabDinamicos) {
        tabDinamicos.addEventListener('click', () => cambiarTabPrincipal('dinamicos'));
    }
    if (tabHorizontales) {
        tabHorizontales.addEventListener('click', () => cambiarTabPrincipal('horizontales'));
    }

    // --- TOGGLE DESPLEGAR / PLEGAR TARJETA DE FILTROS ---
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros');
    const contenedorFiltrosContenido = document.getElementById('contenedor-filtros-contenido');
    const labelToggleFiltros = document.getElementById('label-toggle-filtros');
    const iconToggleFiltros = document.getElementById('icon-toggle-filtros');
    const cabeceraFiltros = document.getElementById('cabecera-filtros');

    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', () => {
            const currentFilterContainer = (tabActivoActual === 'dinamicos') 
                ? contenedorFiltrosContenido 
                : contenedorFiltrosHorizontales;
            if (!currentFilterContainer) return;

            const isHidden = currentFilterContainer.classList.contains('hidden');
            if (isHidden) {
                currentFilterContainer.classList.remove('hidden');
                if (labelToggleFiltros) labelToggleFiltros.textContent = 'Ocultar filtros';
                if (iconToggleFiltros) iconToggleFiltros.classList.remove('rotate-180');
            } else {
                currentFilterContainer.classList.add('hidden');
                if (labelToggleFiltros) labelToggleFiltros.textContent = 'Mostrar filtros';
                if (iconToggleFiltros) iconToggleFiltros.classList.add('rotate-180');
            }
        });
    }

    // --- CONTROLADOR DE CARGA PARA GRÁFICOS HORIZONTALES (TAB 2) ---
    const btnCargarHz = document.getElementById('btn-cargar-hz');
    const btnLimpiarHz = document.getElementById('btn-limpiar-hz');
    const inputFechaInicioHz = document.getElementById('input-fecha-inicio-hz');
    const inputFechaFinHz = document.getElementById('input-fecha-fin-hz');
    const hoyHz = new Date();
    const haceUnAnioHz = new Date(hoyHz.getFullYear() - 1, hoyHz.getMonth(), hoyHz.getDate());
    if (inputFechaInicioHz && !inputFechaInicioHz.value) inputFechaInicioHz.value = formatISOFecha(haceUnAnioHz);
    if (inputFechaFinHz && !inputFechaFinHz.value) inputFechaFinHz.value = formatISOFecha(hoyHz);
    const inputSemanaHz = document.getElementById('input-semana-hz');
    const selectSexoGlobalHz = document.getElementById('select-sexo-global-hz');
    const checkLineasSuavesHz = document.getElementById('check-lineas-suaves-hz');
    const checkSepararGraficosHz = document.getElementById('check-separar-graficos-hz');

    // Inicializar estado del check separar según el sexo seleccionado
    function sincronizarEstadoCheckSeparar() {
        if (!checkSepararGraficosHz || !selectSexoGlobalHz) return;
        const esAmbos = (selectSexoGlobalHz.value === 'ambos');
        checkSepararGraficosHz.disabled = !esAmbos;
        const parentLabel = checkSepararGraficosHz.closest('label');
        if (parentLabel) {
            parentLabel.classList.toggle('opacity-50', !esAmbos);
            parentLabel.classList.toggle('cursor-not-allowed', !esAmbos);
            parentLabel.classList.toggle('bg-slate-50', !esAmbos);
        }
    }
    sincronizarEstadoCheckSeparar();

    function construirDataCombinadaHz(respuestasValidas) {
        if (!Array.isArray(respuestasValidas) || respuestasValidas.length === 0) return null;
        if (respuestasValidas.length === 1) return respuestasValidas[0];

        const mapaLotes = new Map();
        respuestasValidas.forEach(resp => {
            if (Array.isArray(resp.registros)) {
                resp.registros.forEach(r => {
                    const key = `${r.granjaNombre || r.granja}_${r.campania}_${r.galpon}`;
                    if (!mapaLotes.has(key)) {
                        mapaLotes.set(key, {
                            granja: r.granja,
                            granjaNombre: r.granjaNombre || r.granja,
                            campania: r.campania,
                            galpon: r.galpon,
                            fechaSemana: r.fechaSemana || r.fechaCarga,
                            fechaCarga: r.fechaCarga
                        });
                    }
                });
            }
        });

        const registrosUnificados = Array.from(mapaLotes.values());
        if (registrosUnificados.length === 0) return null;

        const primerResp = respuestasValidas[0];
        const titulos = respuestasValidas.map(r => r.nombre || r.tipo);

        const seriesList = respuestasValidas.slice(0, 5).map((resp, i) => {
            const paleta = PALETA_EJES[i % PALETA_EJES.length];
            const dataM = [];
            const dataH = [];
            const dataComb = [];
            const dataStdM = [];
            const dataStdH = [];
            const dataStdComb = [];
            const dataCvM = [];
            const dataCvH = [];
            const dataCvComb = [];

            registrosUnificados.forEach(lote => {
                const reg = (resp.registros || []).find(r =>
                    String(r.granjaNombre || r.granja) === String(lote.granjaNombre || lote.granja) &&
                    String(r.campania) === String(lote.campania) &&
                    String(r.galpon) === String(lote.galpon)
                );

                if (reg) {
                    const vM = (reg.valorM !== null && reg.valorM !== undefined && !isNaN(reg.valorM)) ? Number(reg.valorM) : null;
                    const vH = (reg.valorH !== null && reg.valorH !== undefined && !isNaN(reg.valorH)) ? Number(reg.valorH) : null;
                    dataM.push(vM);
                    dataH.push(vH);
                    let vC = null;
                    if (vM !== null && vH !== null) vC = Number(((vM + vH) / 2).toFixed(4));
                    else if (vM !== null) vC = vM;
                    else if (vH !== null) vC = vH;
                    dataComb.push(vC);

                    const sM = (reg.estandarM !== null && reg.estandarM !== undefined && !isNaN(reg.estandarM)) ? Number(reg.estandarM) : null;
                    const sH = (reg.estandarH !== null && reg.estandarH !== undefined && !isNaN(reg.estandarH)) ? Number(reg.estandarH) : null;
                    dataStdM.push(sM);
                    dataStdH.push(sH);
                    let sC = null;
                    if (sM !== null && sH !== null) sC = Number(((sM + sH) / 2).toFixed(4));
                    else if (sM !== null) sC = sM;
                    else if (sH !== null) sC = sH;
                    dataStdComb.push(sC);

                    const cM = (reg.cvM !== null && reg.cvM !== undefined && !isNaN(reg.cvM)) ? Number(reg.cvM) : null;
                    const cH = (reg.cvH !== null && reg.cvH !== undefined && !isNaN(reg.cvH)) ? Number(reg.cvH) : null;
                    dataCvM.push(cM);
                    dataCvH.push(cH);
                    let cC = null;
                    if (cM !== null && cH !== null) cC = Number(((cM + cH) / 2).toFixed(4));
                    else if (cM !== null) cC = cM;
                    else if (cH !== null) cC = cH;
                    dataCvComb.push(cC);
                } else {
                    dataM.push(null);
                    dataH.push(null);
                    dataComb.push(null);
                    dataStdM.push(null);
                    dataStdH.push(null);
                    dataStdComb.push(null);
                    dataCvM.push(null);
                    dataCvH.push(null);
                    dataCvComb.push(null);
                }
            });

            return {
                tipo: resp.tipo,
                nombre: resp.nombre || resp.tipo,
                unidad: resp.unidad || '',
                axisId: paleta.axisId,
                color: paleta.color,
                bg: paleta.bg,
                position: paleta.position,
                dataM,
                dataH,
                dataComb,
                dataStdM,
                dataStdH,
                dataStdComb,
                dataCvM,
                dataCvH,
                dataCvComb
            };
        });

        return {
            tipo: 'combinado',
            nombre: titulos.join(' vs '),
            semana: primerResp.semana,
            periodo: primerResp.periodo,
            unidad: seriesList.map(s => s.unidad).filter(Boolean).join(' / '),
            esCombinado: true,
            seriesList: seriesList,
            registros: registrosUnificados
        };
    }

    async function consultarGraficosHorizontales() {
        const fechaInicio = inputFechaInicioHz ? inputFechaInicioHz.value.trim() : '';
        const fechaFin = inputFechaFinHz ? inputFechaFinHz.value.trim() : '';
        const semana = inputSemanaHz ? parseInt(inputSemanaHz.value, 10) : 1;
        const sexo = selectSexoGlobalHz ? selectSexoGlobalHz.value : 'macho';
        const lineasSuaves = checkLineasSuavesHz ? checkLineasSuavesHz.checked : false;
        const separarGraficos = checkSepararGraficosHz ? checkSepararGraficosHz.checked : false;

        const tiposSeleccionados = msGraficosHz ? msGraficosHz.getSelectedValues() : [];

        if (!fechaInicio || !fechaFin) {
            mostrarAlertaToast('Por favor seleccione Fecha Inicio y Fecha Fin');
            return;
        }

        if (tiposSeleccionados.length === 0) {
            mostrarAlertaToast('Por favor seleccione al menos un Tipo de Gráfico');
            return;
        }

        const contienePesaje = tiposSeleccionados.some(t => TIPOS_PESAJE_DIAS_HZ.includes(t));
        const contieneNoPesaje = tiposSeleccionados.some(t => !TIPOS_PESAJE_DIAS_HZ.includes(t));

        if (contieneNoPesaje && (isNaN(semana) || semana < 1 || semana > 10)) {
            mostrarAlertaToast('Por favor ingrese un número de semana válido (1-10)');
            return;
        }

        const diasSeleccionados = msDiasPesajeHz ? msDiasPesajeHz.getSelectedValues() : [];
        if (contienePesaje && diasSeleccionados.length === 0) {
            mostrarAlertaToast('Por favor seleccione al menos un Día de Pesaje');
            return;
        }

        const tareasConsulta = [];
        let ordenSeq = 0;
        tiposSeleccionados.forEach(tipo => {
            if (TIPOS_PESAJE_DIAS_HZ.includes(tipo)) {
                diasSeleccionados.forEach(d => {
                    tareasConsulta.push({
                        orden: ordenSeq++,
                        tipo: tipo,
                        dia: parseInt(d, 10),
                        semana: null
                    });
                });
            } else {
                tareasConsulta.push({
                    orden: ordenSeq++,
                    tipo: tipo,
                    dia: null,
                    semana: semana
                });
            }
        });

        const esUnificado = chkUnificarUbicacionHz ? chkUnificarUbicacionHz.checked : false;
        const granjas = msGranjaHz ? msGranjaHz.getSelectedValues() : [];
        const campanias = msCampaniaHz ? msCampaniaHz.getSelectedValues() : [];
        const galpones = msGalponHz ? msGalponHz.getSelectedValues() : [];
        const unificado = (esUnificado && msUbicacionUnificadaHz) ? msUbicacionUnificadaHz.getSelectedValues() : [];

        const opcionesFiltro = {
            sexo,
            lineasSuaves,
            separarGraficos,
            esUnificado,
            granjas,
            campanias,
            galpones,
            unificado
        };

        if (btnCargarHz) {
            btnCargarHz.classList.add('animate-pulse');
            btnCargarHz.disabled = true;
        }

        // Limpiar gráficos horizontales previos
        if (typeof limpiarGraficosHorizontales === 'function') {
            limpiarGraficosHorizontales();
        }

        const total = tareasConsulta.length;
        let completadas = 0;
        if (typeof actualizarIndicadorProgresoHz === 'function') {
            actualizarIndicadorProgresoHz(0, total);
        }

        try {
            const respuestasExitosas = [];
            const modoCombHz = state.modoCombinadoHz || 'ninguno';

            const promesas = tareasConsulta.map(async (t) => {
                const params = {
                    tipo: t.tipo,
                    fechaInicio: fechaInicio,
                    fechaFin: fechaFin
                };
                if (t.dia !== null && t.dia !== undefined) {
                    params.dia = t.dia;
                } else {
                    params.semana = t.semana;
                }
                const qs = new URLSearchParams(params).toString();

                try {
                    const resp = await fetch(`../../backend/interconsulta/acumulado-semanal?${qs}`);
                    const json = await resp.json();

                    completadas++;
                    if (typeof actualizarIndicadorProgresoHz === 'function') {
                        actualizarIndicadorProgresoHz(completadas, total);
                    }

                    if (json && json.success) {
                        json.orden = t.orden;
                        respuestasExitosas.push(json);

                        // Si no es combinado, renderizar progresivamente de inmediato conforme llega cada respuesta
                        if (modoCombHz === 'ninguno') {
                            if (typeof renderizarGraficoHorizontal === 'function') {
                                renderizarGraficoHorizontal(json, opcionesFiltro);
                            }
                        }
                    } else if (json && !json.success) {
                        mostrarAlertaToast(json.message || `Error al cargar gráfica ${t.tipo}`);
                    }
                } catch (fetchErr) {
                    completadas++;
                    if (typeof actualizarIndicadorProgresoHz === 'function') {
                        actualizarIndicadorProgresoHz(completadas, total);
                    }
                    console.error(`Error al cargar gráfica horizontal ${t.tipo}:`, fetchErr);
                }
            });

            await Promise.all(promesas);

            if (modoCombHz === 'tipo' && typeof renderizarGraficoHorizontal === 'function' && respuestasExitosas.length > 0) {
                const noCombinables = [];
                const combinables = [];

                respuestasExitosas.forEach(r => {
                    if (r.tipo === 'respiratorio' || r.tipo === 'digestivo' || r.tipo === 'nivel_cloro') {
                        noCombinables.push(r);
                    } else {
                        combinables.push(r);
                    }
                });

                if (noCombinables.length > 0) {
                    mostrarAlertaToast('Los gráficos de barras (nivel de cloro, respiratorio y digestivo) no se pueden combinar por el momento');
                }

                if (combinables.length >= 2) {
                    const dataComb = construirDataCombinadaHz(combinables);
                    if (dataComb) {
                        dataComb.orden = 0;
                        renderizarGraficoHorizontal(dataComb, opcionesFiltro);
                    }
                } else if (combinables.length === 1) {
                    renderizarGraficoHorizontal(combinables[0], opcionesFiltro);
                }

                noCombinables.forEach(r => {
                    renderizarGraficoHorizontal(r, opcionesFiltro);
                });
            }
        } catch (err) {
            console.error('Error al consultar gráficos horizontales:', err);
            mostrarAlertaToast('Error de conexión al cargar gráficos horizontales');
            if (typeof actualizarIndicadorProgresoHz === 'function') {
                actualizarIndicadorProgresoHz(total, total);
            }
        } finally {
            if (btnCargarHz) {
                btnCargarHz.classList.remove('animate-pulse');
                btnCargarHz.disabled = false;
            }
        }
    }

    if (btnCargarHz) {
        btnCargarHz.addEventListener('click', consultarGraficosHorizontales);
    }

    if (btnLimpiarHz) {
        btnLimpiarHz.addEventListener('click', () => {
            if (typeof limpiarGraficosHorizontales === 'function') {
                limpiarGraficosHorizontales();
            }
        });
    }

    if (checkLineasSuavesHz) {
        checkLineasSuavesHz.addEventListener('change', (e) => {
            if (typeof actualizarTensionGraficosHorizontales === 'function') {
                actualizarTensionGraficosHorizontales(e.target.checked);
            }
        });
    }

    if (checkSepararGraficosHz) {
        checkSepararGraficosHz.addEventListener('change', (e) => {
            if (typeof actualizarSeparacionGraficosHorizontales === 'function') {
                actualizarSeparacionGraficosHorizontales(e.target.checked);
            }
        });
    }

    if (selectSexoGlobalHz) {
        selectSexoGlobalHz.addEventListener('change', (e) => {
            sincronizarEstadoCheckSeparar();
            if (typeof actualizarSexoGraficosHorizontales === 'function') {
                actualizarSexoGraficosHorizontales(e.target.value);
            }
        });
    }

    const selectModoCombinadoHz = document.getElementById('select-modo-combinado-hz');
    if (selectModoCombinadoHz) {
        selectModoCombinadoHz.addEventListener('change', (e) => {
            state.modoCombinadoHz = e.target.value;

            if (state.modoCombinadoHz === 'tipo') {
                const seleccionados = msGraficosHz ? msGraficosHz.getSelectedValues() : [];
                if (seleccionados.includes('respiratorio') || seleccionados.includes('digestivo')) {
                    mostrarAlertaToast('Las evaluaciones respiratoria y digestiva no se pueden combinar por el momento');
                }
                if (seleccionados.length > 5) {
                    mostrarAlertaToast('Máximo 5 tipos de gráfico permitidos en modo combinado');
                    msGraficosHz.options.forEach(opt => {
                        if (seleccionados.slice(5).includes(opt.id)) {
                            opt.selected = false;
                        }
                    });
                    msGraficosHz.updateLabel();
                    msGraficosHz.render();
                }
            }

            consultarGraficosHorizontales();
        });
    }

    const btnTamanoTextoIncHz = document.getElementById('btn-tamano-texto-inc-hz');
    const btnTamanoTextoDecHz = document.getElementById('btn-tamano-texto-dec-hz');

    if (btnTamanoTextoIncHz) {
        btnTamanoTextoIncHz.addEventListener('click', () => {
            if (typeof cambiarTamanoTextoGraficosHorizontales === 'function') {
                cambiarTamanoTextoGraficosHorizontales(1);
            }
        });
    }

    if (btnTamanoTextoDecHz) {
        btnTamanoTextoDecHz.addEventListener('click', () => {
            if (typeof cambiarTamanoTextoGraficosHorizontales === 'function') {
                cambiarTamanoTextoGraficosHorizontales(-1);
            }
        });
    }

    async function consultarGraficosApi() {
        const isUnificado = Boolean(state.unificarUbicacion);
        const tiposGraficos = msGraficos ? msGraficos.getSelectedValues() : [];

        if (tiposGraficos.length === 0) {
            renderizarGraficosDinamicos([]);
            return;
        }

        const MAX_PETICIONES = 24;
        const metadatosPeticiones = [];

        if (isUnificado && msUbicacionUnificada) {
            const combinaciones = msUbicacionUnificada.getSelectedCombinations();
            if (combinaciones.length === 0) {
                renderizarGraficosDinamicos([]);
                return;
            }

            combinaciones.forEach(comb => {
                tiposGraficos.forEach((t, idxTipo) => {
                    if (metadatosPeticiones.length < MAX_PETICIONES) {
                        metadatosPeticiones.push({
                            orden: metadatosPeticiones.length,
                            ordenTipo: idxTipo,
                            granja: comb.granja,
                            campania: comb.campania,
                            galpon: comb.galpon,
                            tipo: t
                        });
                    }
                });
            });
        } else {
            const granjas = msGranja ? msGranja.getSelectedValues() : [];
            const campanias = msCampania ? msCampania.getSelectedValues() : [];
            const galpones = msGalpon ? msGalpon.getSelectedValues() : [];

            if (granjas.length === 0 || campanias.length === 0 || galpones.length === 0) {
                renderizarGraficosDinamicos([]);
                return;
            }

            granjas.forEach(g => {
                const gObj = cacheGranjasData.find(item => String(item.granja || item.codigo || item.nombre) === String(g));
                const campaniasDeGranja = gObj && Array.isArray(gObj.campanias) ? gObj.campanias.map(String) : campanias;
                const galponesDeGranja = gObj && Array.isArray(gObj.galpones) ? gObj.galpones.map(String) : galpones;

                const campaniasValidas = campanias.filter(c => campaniasDeGranja.includes(String(c)));
                const galponesValidos = galpones.filter(gp => galponesDeGranja.includes(String(gp)));

                campaniasValidas.forEach(c => {
                    galponesValidos.forEach(gp => {
                        tiposGraficos.forEach((t, idxTipo) => {
                            if (metadatosPeticiones.length < MAX_PETICIONES) {
                                metadatosPeticiones.push({
                                    orden: metadatosPeticiones.length,
                                    ordenTipo: idxTipo,
                                    granja: g,
                                    campania: c,
                                    galpon: gp,
                                    tipo: t
                                });
                            }
                        });
                    });
                });
            });
        }

        if (metadatosPeticiones.length === 0) {
            renderizarGraficosDinamicos([]);
            return;
        }

        mostrarLoaderGraficos();

        const activeFetchToken = ++currentFetchToken;
        const configsValidas = [];
        let peticionesCompletadas = 0;

        renderizarGraficosDinamicos([], false);
        actualizarIndicadorProgreso(0, metadatosPeticiones.length);

        metadatosPeticiones.forEach(meta => {
            const params = new URLSearchParams({
                tipo: meta.tipo,
                granja: meta.granja,
                campania: meta.campania,
                galpon: meta.galpon,
                seccion: meta.tipo === 'mortalidad' ? 'all' : 'linea'
            });

            fetch(`../../backend/interconsulta/grafica-data?${params.toString()}`)
                .then(res => res.json())
                .then(res => {
                    if (activeFetchToken !== currentFetchToken) return;
                    peticionesCompletadas++;
                    actualizarIndicadorProgreso(peticionesCompletadas, metadatosPeticiones.length);

                    if (res && (res.success || (res.linea && res.linea.success) || (Array.isArray(res.dataPorDia) && res.dataPorDia.length > 0))) {
                        const item = adaptarRespuestaApi(res, (meta.orden !== undefined ? meta.orden + 1 : configsValidas.length + 1), meta);
                        configsValidas.push(item);

                        if (state.modoCombinado === 'ninguno') {
                            renderizarGraficosDinamicos([item], true);
                        } else {
                            let listaFinal = configsValidas;
                            if (state.modoCombinado === 'tipo' && tiposGraficos.length >= 2) {
                                listaFinal = construirConfigsCombinadas(configsValidas);
                            } else if (state.modoCombinado === 'granja') {
                                listaFinal = construirConfigsBenchmarkingGranjas(configsValidas);
                            }
                            ultimaListaRenderizada = listaFinal;
                            renderizarGraficosDinamicos(listaFinal, false);
                        }
                    } else {
                        // Tarjeta informativa "Sin Datos" para mantener alineación por campaña/galpón
                        const itemSinDatos = (typeof crearItemSinDatos === 'function') ? crearItemSinDatos(meta) : null;
                        if (itemSinDatos) {
                            configsValidas.push(itemSinDatos);
                            if (state.modoCombinado === 'ninguno') {
                                renderizarGraficosDinamicos([itemSinDatos], true);
                            } else {
                                let listaFinal = configsValidas;
                                if (state.modoCombinado === 'tipo' && tiposGraficos.length >= 2) {
                                    listaFinal = construirConfigsCombinadas(configsValidas);
                                } else if (state.modoCombinado === 'granja') {
                                    listaFinal = construirConfigsBenchmarkingGranjas(configsValidas);
                                }
                                ultimaListaRenderizada = listaFinal;
                                renderizarGraficosDinamicos(listaFinal, false);
                            }
                        } else if (configsValidas.length === 0 && peticionesCompletadas === metadatosPeticiones.length) {
                            renderizarGraficosDinamicos([], false);
                        }
                    }
                })
                .catch(err => {
                    if (activeFetchToken !== currentFetchToken) return;
                    peticionesCompletadas++;
                    actualizarIndicadorProgreso(peticionesCompletadas, metadatosPeticiones.length);
                    console.warn('Error al cargar gráfica individual:', err);

                    const itemSinDatos = (typeof crearItemSinDatos === 'function') ? crearItemSinDatos(meta) : null;
                    if (itemSinDatos) {
                        configsValidas.push(itemSinDatos);
                        if (state.modoCombinado === 'ninguno') {
                            renderizarGraficosDinamicos([itemSinDatos], true);
                        } else {
                            let listaFinal = configsValidas;
                            if (state.modoCombinado === 'tipo' && tiposGraficos.length >= 2) {
                                listaFinal = construirConfigsCombinadas(configsValidas);
                            } else if (state.modoCombinado === 'granja') {
                                listaFinal = construirConfigsBenchmarkingGranjas(configsValidas);
                            }
                            ultimaListaRenderizada = listaFinal;
                            renderizarGraficosDinamicos(listaFinal, false);
                        }
                    } else if (configsValidas.length === 0 && peticionesCompletadas === metadatosPeticiones.length) {
                        renderizarGraficosDinamicos([], false);
                    }
                });
        });
    }

    function construirConfigsCombinadas(listaConfigs) {
        const porGalpon = {};
        const individualesNoCombinables = [];
        let huboNoCombinables = false;

        listaConfigs.forEach(item => {
            if (item.sinDatos) {
                individualesNoCombinables.push(item);
            } else if (item.tipo === 'respiratorio' || item.tipo === 'digestivo' || item.tipo === 'nivel_cloro' || item.tipo === 'medicacion') {
                individualesNoCombinables.push(item);
                huboNoCombinables = true;
            } else {
                const key = `${item.granja}_${item.campania}_${item.galpon}`;
                if (!porGalpon[key]) porGalpon[key] = [];
                porGalpon[key].push(item);
            }
        });

        if (huboNoCombinables && typeof mostrarAlertaToast === 'function') {
            mostrarAlertaToast('Los gráficos de barras (medicaciones, nivel de cloro, respiratorio y digestivo) no se pueden combinar por el momento');
        }

        const result = [];
        let idxCounter = 1;

        Object.keys(porGalpon).forEach(key => {
            const itemsGalpon = porGalpon[key];
            if (itemsGalpon.length >= 2) {
                const primerItem = itemsGalpon[0];
                const seriesList = itemsGalpon.slice(0, 5).map((it, i) => ({
                    tipo: it.tipo,
                    unidad: it.unidad,
                    axisId: PALETA_EJES[i % PALETA_EJES.length].axisId,
                    color: PALETA_EJES[i % PALETA_EJES.length].color,
                    position: PALETA_EJES[i % PALETA_EJES.length].position,
                    dataMacho: it.dataMacho,
                    dataHembra: it.dataHembra,
                    dataStd: it.dataStd,
                    horasAplicacion: it.horasAplicacion || [],
                    dataHoras: it.dataHoras || null
                }));

                const cloroItem = itemsGalpon.find(it => it.tipo === 'nivel_cloro' || (it.horasAplicacion && it.horasAplicacion.length > 0));
                const horasApp = cloroItem ? (cloroItem.horasAplicacion || []) : [];
                const tieneSemanal = itemsGalpon.some(it => it.tipo === 'ganancia_peso');
                const itemSemanalRef = itemsGalpon.find(it => it.tipo === 'ganancia_peso' && it.labels && it.labels.length === 7);

                const titulosYTipos = seriesList.map(s => {
                    const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[s.tipo]) ? TIPO_GRAFICO_MAP[s.tipo] : { label: s.tipo };
                    return cfg.label;
                });

                const combinedItem = {
                    idCard: `card-grafico-comb-${idxCounter}`,
                    canvasId: `chart-comb-${idxCounter}`,
                    granja: primerItem.granja,
                    campania: primerItem.campania,
                    galpon: primerItem.galpon,
                    tipo: 'combinado',
                    esCombinado: true,
                    seriesList: seriesList,
                    tiposCombinados: seriesList.map(s => s.tipo),
                    titulo: titulosYTipos.join(' vs '),
                    infoBadge: `${primerItem.infoBadge} (${seriesList.length} Ejes)`,
                    vistaActiva: tieneSemanal ? 'semanal' : 'diario',
                    soloSemanal: tieneSemanal,
                    esSemanal: tieneSemanal,
                    desdeVal: 'inicio',
                    hastaVal: 'fin',
                    sexoActiva: (document.getElementById('select-sexo-global')?.value) || (typeof sexoGlobal !== 'undefined' ? sexoGlobal : 'macho'),
                    horaActiva: 'todas',
                    horasAplicacion: horasApp,
                    labels: (tieneSemanal && itemSemanalRef) ? itemSemanalRef.labels : primerItem.labels,
                    dataFechas: primerItem.dataFechas,

                    dataMacho: primerItem.dataMacho,
                    dataHembra: primerItem.dataHembra,
                    dataStd: primerItem.dataStd
                };

                result.push(combinedItem);
                idxCounter++;
            } else if (itemsGalpon.length === 1) {
                result.push(itemsGalpon[0]);
            }
        });

        individualesNoCombinables.forEach(item => {
            result.push(item);
        });

        return result;
    }

    function construirConfigsBenchmarkingGranjas(listaConfigs) {
        const porTipo = {};
        let huboNoCombinables = false;

        listaConfigs.forEach(item => {
            const t = item.tipo || 'mortalidad';
            if (!porTipo[t]) porTipo[t] = [];
            porTipo[t].push(item);
        });

        const result = [];
        let idxCounter = 1;

        Object.keys(porTipo).forEach(tipoKey => {
            const itemsTipo = porTipo[tipoKey];
            const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipoKey]) ? TIPO_GRAFICO_MAP[tipoKey] : { label: tipoKey, unidad: '%' };

            if (tipoKey === 'respiratorio' || tipoKey === 'digestivo' || tipoKey === 'nivel_cloro' || tipoKey === 'medicacion') {
                if (itemsTipo.length >= 2) {
                    huboNoCombinables = true;
                }
                itemsTipo.forEach(it => {
                    result.push(it);
                });
                return;
            }

            if (itemsTipo.length >= 2) {
                const primerItem = itemsTipo[0];
                const esSoloSemanal = Boolean(tipoKey === 'ganancia_peso');
                const seriesList = itemsTipo.slice(0, 5).map((it, i) => ({
                    tipo: it.tipo,
                    granja: it.granja,
                    campania: it.campania,
                    galpon: it.galpon,
                    infoBadge: it.infoBadge,
                    unidad: it.unidad,
                    axisId: 'y',
                    color: PALETA_EJES[i % PALETA_EJES.length].color,
                    bg: PALETA_EJES[i % PALETA_EJES.length].bg,
                    position: 'left',
                    dataMacho: it.dataMacho,
                    dataHembra: it.dataHembra,
                    dataStd: it.dataStd,
                    horasAplicacion: it.horasAplicacion || [],
                    dataHoras: it.dataHoras || null
                }));

                const cloroItem = itemsTipo.find(it => it.tipo === 'nivel_cloro' || (it.horasAplicacion && it.horasAplicacion.length > 0));
                const horasApp = cloroItem ? (cloroItem.horasAplicacion || []) : [];

                const combinedItem = {
                    idCard: `card-grafico-bench-${idxCounter}`,
                    canvasId: `chart-bench-${idxCounter}`,
                    granja: primerItem.granja,
                    campania: primerItem.campania,
                    galpon: primerItem.galpon,
                    tipo: tipoKey,
                    esCombinado: true,
                    modoCombinado: 'granja',
                    seriesList: seriesList,
                    titulo: `Benchmarking: ${cfg.label}`,
                    infoBadge: `${cfg.label} (${seriesList.length} Granjas/Galpones)`,
                    vistaActiva: esSoloSemanal ? 'semanal' : 'diario',
                    soloSemanal: esSoloSemanal,
                    esSemanal: esSoloSemanal,
                    desdeVal: 'inicio',
                    hastaVal: 'fin',
                    sexoActiva: (document.getElementById('select-sexo-global')?.value) || (typeof sexoGlobal !== 'undefined' ? sexoGlobal : 'macho'),
                    horaActiva: 'todas',
                    horasAplicacion: horasApp,
                    labels: primerItem.labels,
                    dataFechas: primerItem.dataFechas,
                    unidad: cfg.unidad || '%',
                    dataMacho: primerItem.dataMacho,
                    dataHembra: primerItem.dataHembra,
                    dataStd: primerItem.dataStd
                };

                result.push(combinedItem);
                idxCounter++;
            } else if (itemsTipo.length === 1) {
                result.push(itemsTipo[0]);
            }
        });

        if (huboNoCombinables && typeof mostrarAlertaToast === 'function') {
            mostrarAlertaToast('Las evaluaciones respiratoria y digestiva no se pueden combinar por el momento');
        }

        return result;
    }

    const selectModoCombinado = document.getElementById('select-modo-combinado');
    if (selectModoCombinado) {
        selectModoCombinado.addEventListener('change', (e) => {
            state.modoCombinado = e.target.value;
            state.combinarGraficos = (e.target.value === 'tipo');

            if (state.modoCombinado === 'tipo') {
                const seleccionados = msGraficos.getSelectedValues();
                if (seleccionados.includes('respiratorio') || seleccionados.includes('digestivo')) {
                    mostrarAlertaToast('Las evaluaciones respiratoria y digestiva no se pueden combinar por el momento');
                }
                if (seleccionados.length > 5) {
                    mostrarAlertaToast('Máximo 5 tipos de gráfico permitidos en modo combinado');
                    msGraficos.options.forEach(opt => {
                        if (seleccionados.slice(5).includes(opt.id)) {
                            opt.selected = false;
                        }
                    });
                    msGraficos.updateLabel();
                    msGraficos.render();
                }
            } else if (state.modoCombinado === 'granja') {
                const seleccionados = msGraficos ? msGraficos.getSelectedValues() : [];
                if (seleccionados.includes('respiratorio') || seleccionados.includes('digestivo')) {
                    mostrarAlertaToast('Las evaluaciones respiratoria y digestiva no se pueden combinar por el momento');
                }
                const granjas = msGranja ? msGranja.getSelectedValues() : [];
                const campanias = msCampania ? msCampania.getSelectedValues() : [];
                const galpones = msGalpon ? msGalpon.getSelectedValues() : [];
                const totalComb = granjas.length * campanias.length * galpones.length;
                if (totalComb > 5) {
                    mostrarAlertaToast('Máximo 5 series de granjas/galpones en modo benchmarking');
                }
            }

            consultarGraficosApi();
        });
    }

    const selectTipoVisualizacion = document.getElementById('select-tipo-visualizacion');
    if (selectTipoVisualizacion) {
        selectTipoVisualizacion.addEventListener('change', (e) => {
            if (typeof cambiarTipoVisualizacionGlobal === 'function') {
                cambiarTipoVisualizacionGlobal(e.target.value);
            }
        });
    }

    const checkLineasSuaves = document.getElementById('check-lineas-suaves');
    if (checkLineasSuaves) {
        checkLineasSuaves.addEventListener('change', () => {
            if (typeof actualizarTensionLineasGraficos === 'function') {
                actualizarTensionLineasGraficos();
            }
        });
    }

    const selectDisposicionGraficos = document.getElementById('select-disposicion-graficos');
    const iconDispVertical = document.getElementById('icon-disp-vertical');
    const iconDispHorizontal = document.getElementById('icon-disp-horizontal');

    if (selectDisposicionGraficos) {
        selectDisposicionGraficos.addEventListener('change', (e) => {
            const disp = e.target.value;
            state.disposicion = disp;
            window.disposicionGraficosGlobal = disp;

            if (iconDispVertical && iconDispHorizontal) {
                iconDispVertical.classList.toggle('hidden', disp === 'horizontal');
                iconDispHorizontal.classList.toggle('hidden', disp !== 'horizontal');
            }

            filtrarYMostrarGraficos();
        });
    }

    const chkCombinarGraficos = document.getElementById('chk-combinar-graficos');
    if (chkCombinarGraficos) {
        chkCombinarGraficos.addEventListener('change', (e) => {
            state.combinarGraficos = e.target.checked;
            state.modoCombinado = e.target.checked ? 'tipo' : 'ninguno';
            consultarGraficosApi();
        });
    }

    const chkUnificarUbicacion = document.getElementById('chk-unificar-ubicacion');
    const contenedorUbicacionSeparados = document.getElementById('contenedor-ubicacion-separados');
    const contenedorUbicacionUnificado = document.getElementById('contenedor-ubicacion-unificado');

    if (chkUnificarUbicacion && contenedorUbicacionSeparados && contenedorUbicacionUnificado) {
        chkUnificarUbicacion.addEventListener('change', (e) => {
            const isUnificado = e.target.checked;
            state.unificarUbicacion = isUnificado;

            if (isUnificado) {
                contenedorUbicacionSeparados.classList.add('hidden');
                contenedorUbicacionUnificado.classList.remove('hidden');
            } else {
                contenedorUbicacionSeparados.classList.remove('hidden');
                contenedorUbicacionUnificado.classList.add('hidden');
            }
        });
    }

    if (btnCargar) {
        btnCargar.addEventListener('click', async () => {
            btnCargar.classList.add('opacity-80', 'pointer-events-none');
            const iconCargar = btnCargar.querySelector('.icon-cargar');
            if (iconCargar) iconCargar.classList.add('animate-spin');

            try {
                await consultarGraficosApi();
            } finally {
                btnCargar.classList.remove('opacity-80', 'pointer-events-none');
                if (iconCargar) iconCargar.classList.remove('animate-spin');
            }
        });
    }

    function capturarGraficosDashboardParaPdf() {
        const panelsVisibles = Array.from(document.querySelectorAll('.section-tipo-panel')).filter(p => !p.classList.contains('hidden'));
        
        if (panelsVisibles.length === 0) {
            mostrarAlertaToast('No hay gráficos cargados o visibles en pantalla para exportar.');
            return;
        }

        const btnExportar = document.getElementById('btn-exportar-pdf');
        const labelOriginal = btnExportar ? btnExportar.innerHTML : '';
        if (btnExportar) {
            btnExportar.classList.add('opacity-75', 'pointer-events-none');
            btnExportar.innerHTML = `
                <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generando PDF...</span>
            `;
        }

        try {
            const selectDispEl = document.getElementById('select-disposicion-graficos');
            const disposicion = (selectDispEl && selectDispEl.value) 
                ? selectDispEl.value 
                : ((typeof window !== 'undefined' && window.disposicionGraficosGlobal) ? window.disposicionGraficosGlobal : 'vertical');

            // 1. ELEVAR TEMPORALMENTE A RESOLUCIÓN 3.0 (300 DPI) SOLO LOS GRÁFICOS VISIBLES
            const chartsParaRestaurar = [];
            panelsVisibles.forEach(panel => {
                const cards = Array.from(panel.querySelectorAll('[id^="card-grafico-"]')).filter(c => !c.classList.contains('hidden'));
                cards.forEach(card => {
                    const canvas = card.querySelector('canvas');
                    if (!canvas) return;
                    const chart = (typeof chartInstances !== 'undefined' && chartInstances[canvas.id]) 
                        ? chartInstances[canvas.id] 
                        : ((typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(canvas) : null);
                    if (chart) {
                        const originalDpr = chart.options.devicePixelRatio || window.devicePixelRatio || 1;
                        chart.options.devicePixelRatio = 3.0; // 300 DPI Ultra HD para el PDF
                        chart.resize();
                        chartsParaRestaurar.push({ chart, originalDpr });
                    }
                });
            });

            const seccionesData = [];
            let totalGraficosProcesados = 0;

            panelsVisibles.forEach(panel => {
                const cardsVisiblesEnPanel = Array.from(panel.querySelectorAll('[id^="card-grafico-"]')).filter(c => !c.classList.contains('hidden'));
                if (cardsVisiblesEnPanel.length === 0) return;

                // Extraer el label y tipo de la sección
                const panelTitleEl = panel.querySelector('.span-count-graficas')?.previousElementSibling || panel.querySelector('.text-xs.font-bold');
                const seccionLabel = panelTitleEl ? panelTitleEl.textContent.trim() : 'MÉTRICA';
                const tipoKey = panel.id.replace('sec-tipo-', '') || 'mortalidad';

                const graficosDePanel = [];

                cardsVisiblesEnPanel.forEach(card => {
                    const cardId = card.id;
                    const itemConfig = (typeof configGraficos !== 'undefined' && Array.isArray(configGraficos)) 
                        ? configGraficos.find(c => c.idCard === cardId) 
                        : null;

                    const canvas = card.querySelector('canvas');
                    if (!canvas) return;

                    const canvasId = canvas.id;
                    const chart = (typeof chartInstances !== 'undefined' && chartInstances[canvasId]) 
                        ? chartInstances[canvasId] 
                        : ((typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(canvas) : null);

                    const srcCanvas = (chart && chart.canvas) ? chart.canvas : canvas;

                    // Crear canvas auxiliar con las dimensiones nativas en 300 DPI
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = srcCanvas.width;
                    offCanvas.height = srcCanvas.height;
                    const offCtx = offCanvas.getContext('2d');

                    // Fondo blanco sólido
                    offCtx.fillStyle = '#ffffff';
                    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

                    // Copiar 1:1 el canvas en Ultra Alta Definición
                    offCtx.drawImage(srcCanvas, 0, 0);

                    // Extraer PNG lossless
                    const base64Img = offCanvas.toDataURL('image/png');

                    if (!base64Img) return;

                    const tituloText = itemConfig?.titulo || card.querySelector('h3, .font-bold')?.textContent?.trim() || 'Gráfico SIP';
                    const granjaText = itemConfig?.granja && itemConfig.granja !== 'multiple' ? `${itemConfig.granja}` : '';
                    const campaniaText = itemConfig?.campania && itemConfig.campania !== 'multiple' ? `Camp ${itemConfig.campania}` : '';
                    const galponText = itemConfig?.galpon && itemConfig.galpon !== 'multiple' ? `Galpón ${itemConfig.galpon}` : '';
                    const sexoText = itemConfig?.sexoActiva ? `Sexo: ${itemConfig.sexoActiva.toUpperCase()}` : '';

                    graficosDePanel.push({
                        idCard: cardId,
                        titulo: tituloText,
                        granja: granjaText,
                        campania: campaniaText,
                        galpon: galponText,
                        sexo: sexoText,
                        imagenBase64: base64Img
                    });

                    totalGraficosProcesados++;
                });

                if (graficosDePanel.length > 0) {
                    seccionesData.push({
                        tipo: tipoKey,
                        label: seccionLabel,
                        graficos: graficosDePanel
                    });
                }
            });

            // 2. RESTAURAR INMEDIATAMENTE LA RESOLUCIÓN DE LA WEB PARA QUE SIGA ULTRA RÁPIDA (60 FPS)
            chartsParaRestaurar.forEach(item => {
                item.chart.options.devicePixelRatio = item.originalDpr;
                item.chart.resize();
            });

            if (seccionesData.length === 0 || totalGraficosProcesados === 0) {
                mostrarAlertaToast('No se pudieron procesar los gráficos en pantalla.');
                return;
            }

            const payload = {
                disposicion: disposicion,
                totalGraficos: totalGraficosProcesados,
                secciones: seccionesData
            };

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'reportePDF/reporte_graficos_pdf.php';
            form.target = '_blank';
            form.style.display = 'none';

            const inputPayload = document.createElement('input');
            inputPayload.type = 'hidden';
            inputPayload.name = 'payload';
            inputPayload.value = JSON.stringify(payload);

            form.appendChild(inputPayload);
            document.body.appendChild(form);
            form.submit();
            setTimeout(() => form.remove(), 1200);

        } catch (err) {
            console.error('Error al exportar PDF:', err);
            mostrarAlertaToast('Ocurrió un error al preparar los gráficos para el PDF.');
        } finally {
            if (btnExportar) {
                setTimeout(() => {
                    btnExportar.classList.remove('opacity-75', 'pointer-events-none');
                    btnExportar.innerHTML = labelOriginal;
                }, 800);
            }
        }
    }

    const btnExportarPdf = document.getElementById('btn-exportar-pdf');
    if (btnExportarPdf) {
        btnExportarPdf.addEventListener('click', () => {
            capturarGraficosDashboardParaPdf();
        });
    }

    const selectSexoGlobal = document.getElementById('select-sexo-global');
    if (selectSexoGlobal) {
        selectSexoGlobal.addEventListener('change', (e) => {
            if (typeof cambiarSexoGlobal === 'function') {
                cambiarSexoGlobal(e.target.value);
            }
        });
    }

    const btnLimpiar = document.getElementById('btn-limpiar');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (msGranja) msGranja.clearSelection();
            if (msCampania) msCampania.clearSelection();
            if (msGalpon) msGalpon.clearSelection();
            if (msGraficos) msGraficos.clearSelection();
            if (msUbicacionUnificada) msUbicacionUnificada.clearSelection();

            if (selectSexoGlobal) selectSexoGlobal.value = 'macho';
            if (typeof sexoGlobal !== 'undefined') sexoGlobal = 'macho';

            renderizarGraficosDinamicos([]);
        });
    }

    // --- PANTALLA COMPLETA ---
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const iconFullscreenEnter = document.getElementById('icon-fullscreen-enter');
    const iconFullscreenExit = document.getElementById('icon-fullscreen-exit');
    const labelFullscreen = document.getElementById('label-fullscreen');

    function actualizarIconosFullscreen() {
        const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (iconFullscreenEnter && iconFullscreenExit) {
            iconFullscreenEnter.classList.toggle('hidden', isFull);
            iconFullscreenExit.classList.toggle('hidden', !isFull);
        }
        if (labelFullscreen) {
            labelFullscreen.textContent = isFull ? 'Salir' : 'Pantalla Completa';
        }
        if (btnFullscreen) {
            btnFullscreen.setAttribute('title', isFull ? 'Salir de Pantalla Completa' : 'Pantalla Completa');
        }
    }

    if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    elem.mozRequestFullScreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        });

        document.addEventListener('fullscreenchange', actualizarIconosFullscreen);
        document.addEventListener('webkitfullscreenchange', actualizarIconosFullscreen);
        document.addEventListener('mozfullscreenchange', actualizarIconosFullscreen);
        document.addEventListener('MSFullscreenChange', actualizarIconosFullscreen);
    }

    // Inicializar inputs de fecha y catálogos dinámicos
    renderizarInputsFecha();
    renderizarInputsFechaGraficos();

    // Cargar catálogos dinámicos desde endpoints PHP y luego consultar gráficas
    (async function init() {
        await cargarTiposGrafica();
        await cargarCatalogoGranjas();
        await consultarGraficosApi();
    })();
});
