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
        modoCombinadoHz: 'ninguno',
        unificarUbicacion: false,
        unificarUbicacionHz: true
    };

    let ultimaListaRenderizada = [];
    let currentFetchToken = 0;
    let tiposGraficaInicializados = false;

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
    const TIPOS_SIN_SEMANA_HZ = TIPOS_PESAJE_DIAS_HZ.concat(['luminometria']);
    // Tipos de pesaje con consulta batch multi-día (una petición por tipo).
    const TIPOS_PESAJE_BATCH_HZ = ['pesaje_pollo', 'ganancia_peso', 'cv_peso', 'cv_ganancia'];
    // Tipos ocultos en la pestaña de gráficos horizontales.
    const TIPOS_OCULTOS_HZ = ['nivel_cloro', 'respiratorio', 'digestivo'];

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
            actualizarVisibilidadLuminometriaHz();
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

        actualizarVisibilidadSemanaHz();
        actualizarVisibilidadLuminometriaHz();

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
                const resp = await fetch(`../../backend/interconsulta/pesaje-dias?tipo=${encodeURIComponent(tipoPesaje)}`, { credentials: 'same-origin' });
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

    function actualizarVisibilidadSemanaHz() {
        const container = document.getElementById('container-filtro-semana-hz');
        if (!container || !msGraficosHz) return;
        const seleccionados = msGraficosHz.getSelectedValues();
        const showSemana = seleccionados.length === 0 || seleccionados.some(t => !TIPOS_SIN_SEMANA_HZ.includes(t));
        container.classList.toggle('hidden', !showSemana);
    }

    function actualizarVisibilidadLuminometriaHz() {
        const wrapModo = document.getElementById('container-filtro-lum-modo-hz');
        const wrapPunto = document.getElementById('container-filtro-lum-punto-hz');
        if (!msGraficosHz) return;
        const show = msGraficosHz.getSelectedValues().includes('luminometria');
        [wrapModo, wrapPunto].forEach(el => {
            if (!el) return;
            if (show) {
                el.classList.remove('hidden');
                el.classList.add('flex');
            } else {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });
        if (show) {
            cargarPuntosLuminometriaHz();
        }
    }

    async function cargarPuntosLuminometriaHz() {
        const sel = document.getElementById('select-lum-punto-hz');
        if (!sel) return;
        try {
            const resp = await fetch('../../backend/interconsulta/luminometria-puntos?_t=' + Date.now(), { credentials: 'same-origin' });
            const data = await resp.json();
            const cur = sel.value;
            sel.innerHTML = '<option value="">Todos</option>';
            (data.data || []).forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                sel.appendChild(opt);
            });
            if (cur) sel.value = cur;
        } catch (err) {
            console.error('Error al cargar puntos luminometría:', err);
        }
    }

    function obtenerIdGranjaObj(g) {
        return String(g.granja || g.codigo || g.nombre);
    }

    function buildOpcionesUbicacionSeparadas(granjasObj) {
        const multiGranja = granjasObj.length > 1;
        const opcionesCampanias = [];
        const opcionesGalpones = [];
        const seenCamp = new Set();
        const seenGalp = new Set();

        granjasObj.forEach(g => {
            const gId = obtenerIdGranjaObj(g);
            const gNombre = g.nombre && g.nombre !== g.granja ? ` — ${g.nombre}` : '';
            const gLabel = gId + gNombre;

            if (Array.isArray(g.campanias)) {
                g.campanias.forEach(c => {
                    const cVal = (typeof c === 'object' && c !== null) ? (c.campania || c.id || c.codigo || '') : c;
                    const cStr = String(cVal !== undefined && cVal !== null ? cVal : '').trim();
                    if (!cStr) return;
                    const id = multiGranja ? `${gId}__${cStr}` : cStr;
                    if (!seenCamp.has(id)) {
                        seenCamp.add(id);
                        opcionesCampanias.push({
                            id,
                            label: multiGranja ? `${gLabel} — Camp. ${cStr}` : `Campaña ${cStr}`
                        });
                    }
                });
            }

            if (Array.isArray(g.galpones)) {
                g.galpones.forEach(gp => {
                    const gpVal = (typeof gp === 'object' && gp !== null) ? (gp.galpon || gp.id || '') : gp;
                    const gpStr = String(gpVal !== undefined && gpVal !== null ? gpVal : '').trim();
                    if (!gpStr) return;
                    const id = multiGranja ? `${gId}__${gpStr}` : gpStr;
                    if (!seenGalp.has(id)) {
                        seenGalp.add(id);
                        opcionesGalpones.push({
                            id,
                            label: multiGranja ? `${gLabel} — Galpón ${gpStr}` : `Galpón ${gpStr}`
                        });
                    }
                });
            }
        });

        return { opcionesCampanias, opcionesGalpones };
    }

    function valorCampaniaApi(selId) {
        const s = String(selId);
        return s.includes('__') ? s.split('__').pop() : s;
    }

    function valorGalponApi(selId) {
        const s = String(selId);
        return s.includes('__') ? s.split('__').pop() : s;
    }

    function campaniaSeleccionCoincide(selId, granjaId, campaniaValor) {
        const s = String(selId);
        const cStr = String(campaniaValor);
        if (s.includes('__')) {
            const parts = s.split('__');
            return parts[0] === String(granjaId) && parts[1] === cStr;
        }
        return s === cStr;
    }

    function galponSeleccionCoincide(selId, granjaId, galponValor) {
        const s = String(selId);
        const gpStr = String(galponValor);
        if (s.includes('__')) {
            const parts = s.split('__');
            return parts[0] === String(granjaId) && parts[1] === gpStr;
        }
        return s === gpStr;
    }

    function campaniaSeleccionValidaParaGranja(selId, granjaId, campaniasDeGranja) {
        const campApi = valorCampaniaApi(selId);
        if (!campaniasDeGranja.includes(String(campApi))) return false;
        const s = String(selId);
        if (s.includes('__')) {
            return s.split('__')[0] === String(granjaId);
        }
        return true;
    }

    function galponSeleccionValidoParaGranja(selId, granjaId, galponesDeGranja) {
        const galApi = valorGalponApi(selId);
        if (!galponesDeGranja.includes(String(galApi))) return false;
        const s = String(selId);
        if (s.includes('__')) {
            return s.split('__')[0] === String(granjaId);
        }
        return true;
    }

    function pickSeleccionUbicacion(primary, fallback) {
        if (primary) {
            const vals = primary.getSelectedValues();
            if (vals.length > 0) return vals;
        }
        return fallback ? fallback.getSelectedValues() : [];
    }

    function obtenerSeleccionUbicacionConsulta(esHorizontal = false) {
        if (esHorizontal) {
            if (state.unificarUbicacionHz && msUbicacionUnificadaHz) {
                return {
                    esUnificado: true,
                    unificado: msUbicacionUnificadaHz.getSelectedCombinations(),
                    granjas: [],
                    campanias: [],
                    galpones: []
                };
            }
            return {
                esUnificado: false,
                unificado: [],
                granjas: msGranjaHz ? msGranjaHz.getSelectedValues() : [],
                campanias: msCampaniaHz ? msCampaniaHz.getSelectedValues() : [],
                galpones: msGalponHz ? msGalponHz.getSelectedValues() : []
            };
        }

        if (state.unificarUbicacion && msUbicacionUnificada) {
            return {
                esUnificado: true,
                unificado: msUbicacionUnificada.getSelectedCombinations(),
                granjas: [],
                campanias: [],
                galpones: []
            };
        }
        return {
            esUnificado: false,
            unificado: [],
            granjas: pickSeleccionUbicacion(msGranja, null),
            campanias: pickSeleccionUbicacion(msCampania, null),
            galpones: pickSeleccionUbicacion(msGalpon, null)
        };
    }

    function actualizarCampaniasYGalponesHz() {
        if (!msGranjaHz || !msCampaniaHz || !msGalponHz) return;
        const granjasSeleccionadas = msGranjaHz.getSelectedValues();
        const granjasObj = cacheGranjasData.filter(g => granjasSeleccionadas.includes(obtenerIdGranjaObj(g)));

        const { opcionesCampanias, opcionesGalpones } = buildOpcionesUbicacionSeparadas(granjasObj);

        const todasGranjas = cacheGranjasData.length > 0
            && granjasSeleccionadas.length >= cacheGranjasData.length;
        const campPrev = msCampaniaHz.getSelectedValues();
        const galPrev = msGalponHz.getSelectedValues();
        const marcarTodos = todasGranjas && campPrev.length === 0 && galPrev.length === 0;

        if (marcarTodos) {
            msCampaniaHz.setOptions(opcionesCampanias.map(o => ({ ...o, selected: true })), false);
            msGalponHz.setOptions(opcionesGalpones.map(o => ({ ...o, selected: true })), false);
        } else {
            msCampaniaHz.setOptions(opcionesCampanias, true);
            msGalponHz.setOptions(opcionesGalpones, true);
        }
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
            const response = await fetch(`../../backend/interconsulta/granjas-campanias-galpones?${qs}`, { credentials: 'same-origin' });
            const data = await response.json();

            if (!data.success) return;

            cacheGranjasData = data.granjas || [];

            const opcionesGranjas = cacheGranjasData.map(g => ({
                id: g.granja || g.codigo || g.nombre,
                label: (g.granja || '') + (g.nombre && g.nombre !== g.granja ? ' — ' + g.nombre : '')
            }));

            // TAB 1: Selecciona solo la primera por defecto
            msGranja.setOptions(opcionesGranjas, true);
            if (msUbicacionUnificada) {
                const preserveSel = msUbicacionUnificada.selectedGalpones.size > 0;
                msUbicacionUnificada.setData(cacheGranjasData, false);
                if (!preserveSel && typeof msUbicacionUnificada.selectMuestraInicial === 'function') {
                    msUbicacionUnificada.selectMuestraInicial(false);
                }
            }
            if (msUbicacionUnificadaHz) {
                const preserveSelHz = msUbicacionUnificadaHz.selectedGalpones.size > 0;
                msUbicacionUnificadaHz.setData(cacheGranjasData, false);
                if (!preserveSelHz) {
                    msUbicacionUnificadaHz.selectAll(false);
                }
            }
            actualizarTextoResumenPeriodo();

            if (msGranjaHz) {
                const preserveGranjasHz = msGranjaHz.getSelectedValues().length > 0;
                if (preserveGranjasHz) {
                    msGranjaHz.setOptions(opcionesGranjas, false);
                } else {
                    msGranjaHz.setOptions(opcionesGranjas.map(g => ({ ...g, selected: true })), false);
                }
            }

            actualizarCampaniasYGalpones();
            actualizarCampaniasYGalponesHz();
        } catch (err) {
            console.error('Error al cargar catálogo de granjas:', err);
        }
    }

    function actualizarCampaniasYGalpones() {
        const granjasSeleccionadas = msGranja.getSelectedValues();
        const granjasObj = cacheGranjasData.filter(g => granjasSeleccionadas.includes(obtenerIdGranjaObj(g)));

        const { opcionesCampanias, opcionesGalpones } = buildOpcionesUbicacionSeparadas(granjasObj);

        msCampania.setOptions(opcionesCampanias, true);
        msGalpon.setOptions(opcionesGalpones, true);
    }

    async function cargarTiposGrafica() {
        try {
            const response = await fetch('../../backend/interconsulta/tipos-grafica', { credentials: 'same-origin' });
            const data = await response.json();

            if (!data.success || !Array.isArray(data.data)) return;

            const opcionesVerticales = [];
            const opcionesHz = [];
            data.data.forEach(t => {
                const id = t.id || t.tipo;
                const label = t.label || t.nombre || id;
                if (!id) return;
                if (!t.soloHorizontal) {
                    opcionesVerticales.push({ id, label });
                }
                if (!TIPOS_OCULTOS_HZ.includes(id)) {
                    opcionesHz.push({ id, label });
                }
            });

            if (opcionesVerticales.length > 0 || opcionesHz.length > 0) {
                msGraficos.setOptions(opcionesVerticales, false);
                if (msGraficosHz) {
                    msGraficosHz.setOptions(opcionesHz, false);
                    actualizarVisibilidadDiasPesajeHz();
                    actualizarVisibilidadLuminometriaHz();
                }
                if (!tiposGraficaInicializados) {
                    msGraficos.selectOnlyIds(['mortalidad'], false);
                    if (msGraficosHz) msGraficosHz.selectOnlyIds(['mortalidad'], false);
                    tiposGraficaInicializados = true;
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
        const hoy = new Date();
        const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

        const elDesde = document.getElementById('input-fecha-desde');
        const elHasta = document.getElementById('input-fecha-hasta');
        if (elDesde && elHasta) {
            if (!elDesde.value) elDesde.value = formatISOFecha(haceUnAnio);
            if (!elHasta.value) elHasta.value = formatISOFecha(hoy);
            return;
        }
        if (!contenedorFechasDinamicas) return;

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

    // --- FILTRO GRANJAS / CAMPAÑAS / GALPONES + PERIODO COLAPSADO EN DROPDOWN ---
    const btnTogglePeriodoUbicacion = document.getElementById('btn-toggle-periodo-ubicacion');
    const panelPeriodoUbicacion = document.getElementById('panel-periodo-ubicacion');
    const iconChevronPeriodoUbicacion = document.getElementById('icon-chevron-periodo-ubicacion');
    const labelResumenPeriodo = document.getElementById('label-resumen-periodo');
    const labelResumenPeriodoHz = document.getElementById('label-resumen-periodo-hz');
    const chkUnificarUbicacionHz = document.getElementById('chk-unificar-ubicacion-hz');

    function formatearFechaResumen(iso) {
        if (!iso || typeof iso !== 'string') return '';
        const p = iso.split('-');
        if (p.length !== 3) return iso;
        return `${p[2]}/${p[1]}/${p[0]}`;
    }

    function actualizarTextoResumenPeriodo() {
        const desde = document.getElementById('input-fecha-desde');
        const hasta = document.getElementById('input-fecha-hasta');
        let resumen = 'Entre fechas';
        if (desde && hasta && desde.value && hasta.value) {
            resumen = `${formatearFechaResumen(desde.value)} — ${formatearFechaResumen(hasta.value)}`;
        }
        if (labelResumenPeriodo) labelResumenPeriodo.textContent = resumen;
        if (labelResumenPeriodoHz) labelResumenPeriodoHz.textContent = resumen;
    }

    if (btnTogglePeriodoUbicacion && panelPeriodoUbicacion) {
        btnTogglePeriodoUbicacion.addEventListener('click', (e) => {
            e.stopPropagation();
            const abierto = !panelPeriodoUbicacion.classList.contains('hidden');
            panelPeriodoUbicacion.classList.toggle('hidden', abierto);
            if (iconChevronPeriodoUbicacion) {
                iconChevronPeriodoUbicacion.classList.toggle('rotate-180', !abierto);
            }
        });
    }

    const inputFechaDesdeFiltro = document.getElementById('input-fecha-desde');
    const inputFechaHastaFiltro = document.getElementById('input-fecha-hasta');
    if (inputFechaDesdeFiltro) {
        inputFechaDesdeFiltro.addEventListener('change', async () => {
            state.periodo = 'entre_fechas';
            actualizarTextoResumenPeriodo();
            await cargarCatalogoGranjas();
            consultarGraficosApi();
        });
    }
    if (inputFechaHastaFiltro) {
        inputFechaHastaFiltro.addEventListener('change', async () => {
            state.periodo = 'entre_fechas';
            actualizarTextoResumenPeriodo();
            await cargarCatalogoGranjas();
            consultarGraficosApi();
        });
    }

    if (selectPeriodo) {
        state.periodo = selectPeriodo.value || 'entre_fechas';
    }
    actualizarTextoResumenPeriodo();

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
            if (typeof syncDockLeyendaHz === 'function') {
                syncDockLeyendaHz();
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
    const inputSemanaHz = document.getElementById('input-semana-hz');
    const selectSexoGlobalHz = document.getElementById('select-sexo-global-hz');
    const checkLineasSuavesHz = document.getElementById('check-lineas-suaves-hz');
    const checkSepararGraficosHz = document.getElementById('check-separar-graficos-hz');

    if (inputFechaInicioHz && !inputFechaInicioHz.value) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        inputFechaInicioHz.value = (typeof formatISOFecha === 'function') ? formatISOFecha(d) : d.toISOString().split('T')[0];
    }
    if (inputFechaFinHz && !inputFechaFinHz.value) {
        const d = new Date();
        inputFechaFinHz.value = (typeof formatISOFecha === 'function') ? formatISOFecha(d) : d.toISOString().split('T')[0];
    }

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
            forzarLineasEnCombinado: false,
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
        const contieneSemana = tiposSeleccionados.some(t => !TIPOS_SIN_SEMANA_HZ.includes(t));

        if (contieneSemana && (isNaN(semana) || semana < 1 || semana > 10)) {
            mostrarAlertaToast('Por favor ingrese un número de semana válido (1-10)');
            return;
        }

        const diasSeleccionados = msDiasPesajeHz ? msDiasPesajeHz.getSelectedValues() : [];
        if (contienePesaje && diasSeleccionados.length === 0) {
            mostrarAlertaToast('Por favor seleccione al menos un Día de Pesaje');
            return;
        }

        const tareasConsulta = [];
        tiposSeleccionados.forEach(tipo => {
            if (TIPOS_PESAJE_BATCH_HZ.includes(tipo)) {
                tareasConsulta.push({
                    tipo: tipo,
                    dia: null,
                    semana: null,
                    dias: diasSeleccionados.map(d => parseInt(d, 10)).filter(d => !isNaN(d))
                });
            } else if (TIPOS_PESAJE_DIAS_HZ.includes(tipo)) {
                diasSeleccionados.forEach(d => {
                    const diaNum = parseInt(d, 10);
                    if (isNaN(diaNum)) {
                        return;
                    }
                    tareasConsulta.push({
                        tipo: tipo,
                        dia: diaNum,
                        semana: null,
                        dias: null
                    });
                });
            } else if (tipo === 'luminometria') {
                const modoEl = document.getElementById('select-lum-modo-hz');
                const puntoEl = document.getElementById('select-lum-punto-hz');
                tareasConsulta.push({
                    tipo: tipo,
                    modo: modoEl ? modoEl.value : 'subzona',
                    location: puntoEl ? puntoEl.value : '',
                    dia: null,
                    semana: null,
                    dias: null
                });
            } else {
                tareasConsulta.push({
                    tipo: tipo,
                    dia: null,
                    semana: semana,
                    dias: null
                });
            }
        });

        const ubicacionSel = obtenerSeleccionUbicacionConsulta(true);

        const opcionesFiltro = {
            sexo,
            lineasSuaves,
            separarGraficos,
            esUnificado: ubicacionSel.esUnificado,
            granjas: ubicacionSel.granjas,
            campanias: ubicacionSel.campanias,
            galpones: ubicacionSel.galpones,
            unificado: ubicacionSel.unificado,
            mostrarPctChart: true
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
            let huboError = false;
            const limiteConcurrente = 2;

            const consultarTarea = async (t) => {
                const params = new URLSearchParams({
                    tipo: t.tipo,
                    fechaInicio: fechaInicio,
                    fechaFin: fechaFin
                });
                if (Array.isArray(t.dias) && t.dias.length > 0) {
                    params.set('dias', t.dias.join(','));
                } else if (t.dia !== null && t.dia !== undefined) {
                    params.set('dia', String(t.dia));
                } else if (t.tipo === 'luminometria') {
                    if (t.modo) params.set('modo', t.modo);
                    if (t.location) params.set('location', t.location);
                } else {
                    params.set('semana', String(t.semana));
                }

                const resp = await fetch(`../../backend/interconsulta/acumulado-semanal?${params.toString()}`, { credentials: 'same-origin' });
                return resp.json();
            };

            const procesarRespuesta = (json, tipo) => {
                if (!json) {
                    huboError = true;
                    return;
                }
                if (!json.success) {
                    huboError = true;
                    mostrarAlertaToast(json.message || `Error al cargar gráfica ${tipo}`);
                    return;
                }
                if (Array.isArray(json.items)) {
                    json.items.forEach(item => respuestasExitosas.push(item));
                } else {
                    respuestasExitosas.push(json);
                }
            };

            let cursorTarea = 0;
            const ejecutarTrabajador = async () => {
                while (cursorTarea < tareasConsulta.length) {
                    const t = tareasConsulta[cursorTarea++];
                    try {
                        const json = await consultarTarea(t);
                        procesarRespuesta(json, t.tipo);
                    } catch (err) {
                        huboError = true;
                        console.error('Error al consultar gráfica horizontal:', t.tipo, err);
                    } finally {
                        completadas++;
                        if (typeof actualizarIndicadorProgresoHz === 'function') {
                            actualizarIndicadorProgresoHz(completadas, total);
                        }
                    }
                }
            };

            const nTrabajadores = Math.max(1, Math.min(limiteConcurrente, tareasConsulta.length));
            const trabajadores = [];
            for (let i = 0; i < nTrabajadores; i++) {
                trabajadores.push(ejecutarTrabajador());
            }
            await Promise.all(trabajadores);

            if (typeof renderizarGraficoHorizontal === 'function' && respuestasExitosas.length > 0) {
                const modoCombHz = state.modoCombinadoHz || 'ninguno';

                if (modoCombHz === 'tipo' && respuestasExitosas.length >= 2) {
                    const noCombinables = [];
                    const combinables = [];

                    respuestasExitosas.forEach(r => {
                        if (r.tipo === 'luminometria') {
                            noCombinables.push(r);
                        } else {
                            combinables.push(r);
                        }
                    });

                    if (combinables.length >= 2) {
                        const dataComb = construirDataCombinadaHz(combinables);
                        if (dataComb) {
                            dataComb.forzarLineasEnCombinado = false;
                            renderizarGraficoHorizontal(dataComb, opcionesFiltro);
                        }
                    } else if (combinables.length === 1) {
                        renderizarGraficoHorizontal(combinables[0], opcionesFiltro);
                    }

                    noCombinables.forEach(r => {
                        renderizarGraficoHorizontal(r, opcionesFiltro);
                    });
                } else {
                    respuestasExitosas.forEach(r => {
                        renderizarGraficoHorizontal(r, opcionesFiltro);
                    });
                }
            }

            if (huboError && respuestasExitosas.length === 0) {
                mostrarAlertaToast('Error de conexión al cargar gráficos horizontales');
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
                const gObj = cacheGranjasData.find(item => (item.granja || item.codigo || item.nombre) === g);
                const campaniasDeGranja = gObj && Array.isArray(gObj.campanias) ? gObj.campanias.map(String) : campanias;
                const galponesDeGranja = gObj && Array.isArray(gObj.galpones) ? gObj.galpones.map(String) : galpones;

                const campaniasValidas = campanias.filter(c => campaniaSeleccionValidaParaGranja(c, g, campaniasDeGranja));
                const galponesValidos = galpones.filter(gp => galponSeleccionValidoParaGranja(gp, g, galponesDeGranja));

                campaniasValidas.forEach(c => {
                    galponesValidos.forEach(gp => {
                        tiposGraficos.forEach((t, idxTipo) => {
                            if (metadatosPeticiones.length < MAX_PETICIONES) {
                                metadatosPeticiones.push({
                                    orden: metadatosPeticiones.length,
                                    ordenTipo: idxTipo,
                                    granja: g,
                                    campania: valorCampaniaApi(c),
                                    galpon: valorGalponApi(gp),
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

        const totalPeticiones = metadatosPeticiones.length;

        function finalizarRenderCombinadoSiListo() {
            if (state.modoCombinado === 'ninguno') return;
            if (peticionesCompletadas < totalPeticiones) return;
            let listaFinal = configsValidas;
            if (state.modoCombinado === 'tipo' && tiposGraficos.length >= 2) {
                listaFinal = construirConfigsCombinadas(configsValidas);
            } else if (state.modoCombinado === 'granja') {
                listaFinal = construirConfigsBenchmarkingGranjas(configsValidas);
            }
            ultimaListaRenderizada = listaFinal;
            configGraficos = listaFinal;
            renderizarGraficosDinamicos(listaFinal, false);
            ocultarLoaderGraficos();
        }

        metadatosPeticiones.forEach(meta => {
            const params = new URLSearchParams({
                tipo: meta.tipo,
                granja: meta.granja,
                campania: meta.campania,
                galpon: meta.galpon,
                seccion: meta.tipo === 'mortalidad' ? 'all' : 'linea'
            });

            fetch(`../../backend/interconsulta/grafica-data?${params.toString()}`, { credentials: 'same-origin' })
                .then(res => {
                    if (!res.ok) {
                        return res.text().then(text => {
                            throw new Error(`HTTP ${res.status}: ${(text || '').slice(0, 200)}`);
                        });
                    }
                    return res.json();
                })
                .then(res => {
                    if (activeFetchToken !== currentFetchToken) return;
                    peticionesCompletadas++;
                    actualizarIndicadorProgreso(peticionesCompletadas, totalPeticiones);

                    const tieneDatos = typeof respuestaGraficaTieneDatos === 'function'
                        ? respuestaGraficaTieneDatos(res)
                        : Boolean(res && (res.success || (res.linea && res.linea.success)));

                    if (tieneDatos && typeof adaptarRespuestaApi === 'function') {
                        let item;
                        try {
                            item = adaptarRespuestaApi(res, (meta.orden !== undefined ? meta.orden + 1 : configsValidas.length + 1), meta);
                        } catch (adaptErr) {
                            console.warn('Error al adaptar respuesta de gráfica:', meta, adaptErr, res);
                            item = null;
                        }
                        if (item) {
                            const idxCfg = configsValidas.findIndex(c =>
                                c.granja === meta.granja &&
                                c.campania === meta.campania &&
                                c.galpon === meta.galpon &&
                                c.tipo === meta.tipo
                            );
                            if (idxCfg >= 0) {
                                configsValidas[idxCfg] = item;
                            } else {
                                configsValidas.push(item);
                            }

                            if (state.modoCombinado === 'ninguno') {
                                renderizarGraficosDinamicos([item], true);
                            } else {
                                finalizarRenderCombinadoSiListo();
                            }
                            return;
                        }
                    }

                    console.warn('Gráfica sin datos reconocidos:', meta, res);
                    const itemSinDatos = (typeof crearItemSinDatos === 'function') ? crearItemSinDatos(meta) : null;
                    if (itemSinDatos) {
                        configsValidas.push(itemSinDatos);
                        if (state.modoCombinado === 'ninguno') {
                            renderizarGraficosDinamicos([itemSinDatos], true);
                        } else {
                            finalizarRenderCombinadoSiListo();
                        }
                    } else if (configsValidas.length === 0 && peticionesCompletadas === totalPeticiones) {
                        renderizarGraficosDinamicos([], false);
                        ocultarLoaderGraficos();
                    } else {
                        finalizarRenderCombinadoSiListo();
                    }
                })
                .catch(err => {
                    if (activeFetchToken !== currentFetchToken) return;
                    peticionesCompletadas++;
                    actualizarIndicadorProgreso(peticionesCompletadas, totalPeticiones);
                    console.warn('Error al cargar gráfica individual:', meta, err);

                    const itemSinDatos = (typeof crearItemSinDatos === 'function') ? crearItemSinDatos(meta) : null;
                    if (itemSinDatos) {
                        configsValidas.push(itemSinDatos);
                        if (state.modoCombinado === 'ninguno') {
                            renderizarGraficosDinamicos([itemSinDatos], true);
                        } else {
                            finalizarRenderCombinadoSiListo();
                        }
                    } else if (configsValidas.length === 0 && peticionesCompletadas === totalPeticiones) {
                        renderizarGraficosDinamicos([], false);
                        ocultarLoaderGraficos();
                    } else {
                        finalizarRenderCombinadoSiListo();
                    }
                });
        });
    }

    function suprimirIndividualesCubiertosPorCombinado(lista) {
        const combinados = lista.filter(i => i.esCombinado && i.tipo === 'combinado');
        if (!combinados.length) return lista;

        const mismoUbicacion = (a, b) =>
            String(a.granja) === String(b.granja) &&
            String(a.campania) === String(b.campania) &&
            String(a.galpon) === String(b.galpon);

        return lista.filter(item => {
            if (item.esCombinado && item.tipo === 'combinado') return true;
            const cubierto = combinados.some(c =>
                mismoUbicacion(c, item) &&
                Array.isArray(c.tiposCombinados) &&
                c.tiposCombinados.includes(item.tipo)
            );
            return !cubierto;
        });
    }

    function construirConfigsCombinadas(listaConfigs) {
        const porGalpon = {};
        const individualesNoCombinables = [];
        let avisoLineasCombinado = false;

        listaConfigs.forEach(item => {
            if (item.sinDatos) {
                individualesNoCombinables.push(item);
            } else {
                const key = `${item.granja}_${item.campania}_${item.galpon}`;
                if (!porGalpon[key]) porGalpon[key] = [];
                porGalpon[key].push(item);
            }
        });

        const result = [];
        let idxCounter = 1;

        Object.keys(porGalpon).forEach(key => {
            const itemsGalpon = porGalpon[key];
            if (itemsGalpon.length >= 2) {
                const primerItem = itemsGalpon[0];
                const seriesList = itemsGalpon.slice(0, 5).map((it, i) => ({
                    tipo: it.tipo,
                    unidad: it.unidad,
                    barMode: it.barMode,
                    axisId: PALETA_EJES[i % PALETA_EJES.length].axisId,
                    color: PALETA_EJES[i % PALETA_EJES.length].color,
                    position: PALETA_EJES[i % PALETA_EJES.length].position,
                    dataMacho: it.dataMacho,
                    dataHembra: it.dataHembra,
                    dataStd: it.dataStd,
                    horasAplicacion: it.horasAplicacion || [],
                    dataHoras: it.dataHoras || null,
                    franjas: it.franjas || null,
                    signoActivo: it.signoActivo || 'todos',
                    dataEstornudoM: it.dataEstornudoM,
                    dataEstornudoH: it.dataEstornudoH,
                    dataRonqueraM: it.dataRonqueraM,
                    dataRonqueraH: it.dataRonqueraH,
                    dataDigestivoA: it.dataDigestivoA,
                    dataDigestivoP: it.dataDigestivoP,
                    dataDigestivoS: it.dataDigestivoS,
                    dataDigestivoR: it.dataDigestivoR,
                    metricasMedicacion: it.metricasMedicacion,
                    dataMedicacion: it.dataMedicacion,
                    dataLarvaM: it.dataLarvaM,
                    dataLarvaH: it.dataLarvaH,
                    dataAdultoM: it.dataAdultoM,
                    dataAdultoH: it.dataAdultoH,
                    dataVivos: it.dataVivos,
                    dataMuertos: it.dataMuertos,
                    dataPerimetro: it.dataPerimetro,
                    dataTecho: it.dataTecho,
                    dataConsumoTodos: it.dataConsumoTodos,
                    plagaMedicion: it.plagaMedicion,
                    ambitoActivo: it.ambitoActivo
                }));

                const cloroItem = itemsGalpon.find(it => it.tipo === 'nivel_cloro' || (it.horasAplicacion && it.horasAplicacion.length > 0));
                const horasApp = cloroItem ? (cloroItem.horasAplicacion || []) : [];
                const tieneSemanal = itemsGalpon.some(it => it.tipo === 'ganancia_peso');
                const itemSemanalRef = itemsGalpon.find(it => it.tipo === 'ganancia_peso' && it.labels && it.labels.length === 7);

                const titulosYTipos = seriesList.map(s => {
                    const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[s.tipo]) ? TIPO_GRAFICO_MAP[s.tipo] : { label: s.tipo };
                    return cfg.label;
                });

                const incluyeMetricasBarra = itemsGalpon.some(it =>
                    typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(it.tipo)
                );
                const combinedItem = {
                    idCard: `card-grafico-comb-${idxCounter}`,
                    canvasId: `chart-comb-${idxCounter}`,
                    granja: primerItem.granja,
                    campania: primerItem.campania,
                    galpon: primerItem.galpon,
                    tipo: 'combinado',
                    esCombinado: true,
                    forzarLineasEnCombinado: false,
                    chartType: 'line',
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

        return suprimirIndividualesCubiertosPorCombinado(result);
    }

    function construirConfigsBenchmarkingGranjas(listaConfigs) {
        const porTipo = {};
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
                    dataHoras: it.dataHoras || null,
                    franjas: it.franjas || null,
                    signoActivo: it.signoActivo || 'todos',
                    barMode: it.barMode,
                    dataEstornudoM: it.dataEstornudoM,
                    dataEstornudoH: it.dataEstornudoH,
                    dataRonqueraM: it.dataRonqueraM,
                    dataRonqueraH: it.dataRonqueraH,
                    dataDigestivoA: it.dataDigestivoA,
                    dataDigestivoP: it.dataDigestivoP,
                    dataDigestivoS: it.dataDigestivoS,
                    dataDigestivoR: it.dataDigestivoR,
                    metricasMedicacion: it.metricasMedicacion,
                    dataMedicacion: it.dataMedicacion,
                    plagaMedicion: it.plagaMedicion,
                    ambitoActivo: it.ambitoActivo
                }));

                const cloroItem = itemsTipo.find(it => it.tipo === 'nivel_cloro' || (it.horasAplicacion && it.horasAplicacion.length > 0));
                const horasApp = cloroItem ? (cloroItem.horasAplicacion || []) : [];

                const esBarra = typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(tipoKey);

                const combinedItem = {
                    idCard: `card-grafico-bench-${idxCounter}`,
                    canvasId: `chart-bench-${idxCounter}`,
                    granja: primerItem.granja,
                    campania: primerItem.campania,
                    galpon: primerItem.galpon,
                    tipo: tipoKey,
                    esCombinado: true,
                    modoCombinado: 'granja',
                    forzarLineasEnCombinado: esBarra,
                    chartType: esBarra ? 'line' : (primerItem.chartType || 'line'),
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

        return result;
    }

    const selectModoCombinado = document.getElementById('select-modo-combinado');
    if (selectModoCombinado) {
        selectModoCombinado.addEventListener('change', (e) => {
            state.modoCombinado = e.target.value;
            state.combinarGraficos = (e.target.value === 'tipo');

            if (state.modoCombinado === 'tipo') {
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
            } else if (state.modoCombinado === 'granja') {
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

            if (Array.isArray(ultimaListaRenderizada) && ultimaListaRenderizada.length > 0) {
                renderizarGraficosDinamicos(ultimaListaRenderizada);
            } else if (Array.isArray(configGraficos) && configGraficos.length > 0) {
                renderizarGraficosDinamicos(configGraficos);
            }
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
    const contenedorUbicacionSeparadosHz = document.getElementById('contenedor-ubicacion-separados-hz');
    const contenedorUbicacionUnificadoHz = document.getElementById('contenedor-ubicacion-unificado-hz');

    function aplicarModoUbicacionVertical(unificado, triggerConsulta = false) {
        state.unificarUbicacion = unificado;

        if (contenedorUbicacionSeparados) {
            contenedorUbicacionSeparados.classList.toggle('hidden', unificado);
        }
        if (contenedorUbicacionUnificado) {
            contenedorUbicacionUnificado.classList.toggle('hidden', !unificado);
        }
        if (chkUnificarUbicacion) {
            chkUnificarUbicacion.checked = unificado;
        }

        if (typeof filtrarYMostrarGraficos === 'function') {
            filtrarYMostrarGraficos();
        }
        if (triggerConsulta) {
            consultarGraficosApi();
        }
    }

    function aplicarModoUbicacionHorizontal(unificado) {
        state.unificarUbicacionHz = unificado;

        if (contenedorUbicacionSeparadosHz) {
            contenedorUbicacionSeparadosHz.classList.toggle('hidden', unificado);
        }
        if (contenedorUbicacionUnificadoHz) {
            contenedorUbicacionUnificadoHz.classList.toggle('hidden', !unificado);
        }
        if (chkUnificarUbicacionHz) {
            chkUnificarUbicacionHz.checked = unificado;
        }

        if (unificado && msUbicacionUnificadaHz && msUbicacionUnificadaHz.selectedGalpones.size === 0) {
            msUbicacionUnificadaHz.selectAll(false);
        }
    }

    if (chkUnificarUbicacion) {
        chkUnificarUbicacion.addEventListener('change', (e) => {
            aplicarModoUbicacionVertical(e.target.checked, true);
        });
    }
    if (chkUnificarUbicacionHz) {
        chkUnificarUbicacionHz.addEventListener('change', (e) => {
            aplicarModoUbicacionHorizontal(e.target.checked);
        });
    }

    aplicarModoUbicacionVertical(false);
    aplicarModoUbicacionHorizontal(true);

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

    function obtenerCanvasGraficoParaPdf(card) {
        if (!card) return null;
        const canvases = Array.from(card.querySelectorAll('canvas'));
        const mainCanvas = canvases.find(c => !String(c.id).endsWith('-pct'));
        const pctCanvas = canvases.find(c => String(c.id).endsWith('-pct'));
        if (!mainCanvas) return null;

        const mainChart = (typeof chartInstances !== 'undefined' && chartInstances[mainCanvas.id])
            ? chartInstances[mainCanvas.id]
            : ((typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(mainCanvas) : null);
        const pctChart = pctCanvas
            ? ((typeof chartInstances !== 'undefined' && chartInstances[pctCanvas.id])
                ? chartInstances[pctCanvas.id]
                : ((typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(pctCanvas) : null))
            : null;

        const mainSrc = (mainChart && mainChart.canvas) ? mainChart.canvas : mainCanvas;
        if (!pctCanvas || !pctChart) return mainSrc;

        const pctSrc = pctChart.canvas || pctCanvas;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.max(mainSrc.width, pctSrc.width);
        offCanvas.height = pctSrc.height + mainSrc.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
        offCtx.drawImage(pctSrc, 0, 0);
        offCtx.drawImage(mainSrc, 0, pctSrc.height);
        return offCanvas;
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
                    card.querySelectorAll('canvas').forEach(canvas => {
                        const chart = (typeof chartInstances !== 'undefined' && chartInstances[canvas.id])
                            ? chartInstances[canvas.id]
                            : ((typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(canvas) : null);
                        if (chart) {
                            const originalDpr = chart.options.devicePixelRatio || window.devicePixelRatio || 1;
                            chart.options.devicePixelRatio = 3.0;
                            chart.resize();
                            chartsParaRestaurar.push({ chart, originalDpr });
                        }
                    });
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

                    const srcCanvas = obtenerCanvasGraficoParaPdf(card);
                    if (!srcCanvas) return;

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
            form.action = '../../backend/interconsulta/exportar-pdf';
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
        window.gUmbrales = window.gUmbrales || {};
        await cargarTiposGrafica();
        await cargarCatalogoGranjas();
        await consultarGraficosApi();
    })();
});
