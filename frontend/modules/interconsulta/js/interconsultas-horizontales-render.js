/**
 * Módulo de Renderizado para Gráficos Horizontales (Acumulado Semanal)
 * Dashboard de Interconsultas
 */

(function (window) {
    'use strict';

    const instanciasGraficosHz = {};
    const cacheGraficosHz = {};
    const cacheDataPorTipoHz = {};

    const NIVELES_ESCALA_TEXTO = [0.80, 0.90, 1.00, 1.15, 1.30, 1.45];
    let indiceEscalaTexto = 2; // 100% por defecto

    function getEscalaTextoActual() {
        return NIVELES_ESCALA_TEXTO[indiceEscalaTexto] || 1.00;
    }

    function getTamanoFuente(base) {
        return Math.round(base * getEscalaTextoActual() * 10) / 10;
    }

    function getColWidthPorLote() {
        const escala = getEscalaTextoActual();
        return Math.round(26 * Math.max(1, escala * 1.05));
    }

    /**
     * Retorna la cantidad de decimales según el tipo de gráfico:
     * 3 decimales para consumo_alimento, pesaje_pollo y ganancia_peso; 2 decimales para el resto.
     */
    function getDecimalesPorTipo(tipo) {
        if (tipo === 'consumo_alimento' || tipo === 'pesaje_pollo' || tipo === 'ganancia_peso') {
            return 3;
        }
        return 2;
    }

    /**
     * Formatea fecha YYYY-MM-DD a formato corto '25-Jun'
     */
    function formatearFechaCorta(fechaStr) {
        if (!fechaStr) return '';
        const parts = String(fechaStr).split('-');
        if (parts.length !== 3) return fechaStr;
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dia = parseInt(parts[2], 10);
        const mesIdx = parseInt(parts[1], 10) - 1;
        const mesNom = meses[mesIdx] || parts[1];
        return `${dia < 10 ? '0' + dia : dia}-${mesNom}`;
    }

    /**
     * Muestra la pastilla flotante animada con el progreso de carga para gráficos horizontales
     */
    function actualizarIndicadorProgresoHz(completadas, total) {
        let barra = document.getElementById('ic-progreso-carga-graficos-hz');
        if (!barra) {
            barra = document.createElement('div');
            barra.id = 'ic-progreso-carga-graficos-hz';
            barra.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/80 backdrop-blur-xs transition-all duration-300 pointer-events-none opacity-0 translate-y-4';
            document.body.appendChild(barra);
        }

        const btnCargarHz = document.getElementById('btn-cargar-hz');

        if (completadas < total && total > 0) {
            const pct = Math.round((completadas / total) * 100);
            barra.innerHTML = `
                <svg class="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando gráficas horizontales (${completadas}/${total})</span>
                <div class="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden ml-0.5">
                    <div class="bg-blue-500 h-full transition-all duration-200" style="width: ${pct}%"></div>
                </div>
            `;
            barra.classList.remove('opacity-0', 'translate-y-4');
            if (btnCargarHz) {
                btnCargarHz.classList.add('opacity-80');
                const icon = btnCargarHz.querySelector('.icon-cargar');
                if (icon) icon.classList.add('animate-spin');
            }
        } else {
            barra.innerHTML = `
                <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-sky-300">Todas las gráficas horizontales cargadas</span>
            `;
            if (btnCargarHz) {
                btnCargarHz.classList.remove('opacity-80');
                const icon = btnCargarHz.querySelector('.icon-cargar');
                if (icon) icon.classList.remove('animate-spin');
            }
            setTimeout(() => {
                barra.classList.add('opacity-0', 'translate-y-4');
            }, 1200);
        }
    }

    /**
     * Limpia y destruye todas las instancias de gráficos horizontales
     */
    function limpiarGraficosHorizontales() {
        Object.keys(instanciasGraficosHz).forEach(key => {
            if (instanciasGraficosHz[key]) {
                try {
                    instanciasGraficosHz[key].destroy();
                } catch (e) {
                    console.warn('Error al destruir gráfico horizontal:', e);
                }
                delete instanciasGraficosHz[key];
            }
        });

        Object.keys(cacheGraficosHz).forEach(key => {
            delete cacheGraficosHz[key];
        });

        Object.keys(cacheDataPorTipoHz).forEach(key => {
            delete cacheDataPorTipoHz[key];
        });

        const contenedor = document.getElementById('contenedor-graficos-horizontales');
        if (contenedor) {
            contenedor.innerHTML = '';
        }
    }

    function insertarCardEnOrdenHz(contenedor, card, itemOrden) {
        card.dataset.orden = itemOrden;
        const existingCards = Array.from(contenedor.children);
        const siblingCard = existingCards.find(child => {
            const childOrden = parseInt(child.dataset.orden, 10);
            return !isNaN(childOrden) && childOrden > itemOrden;
        });

        if (siblingCard) {
            contenedor.insertBefore(card, siblingCard);
        } else {
            contenedor.appendChild(card);
        }
    }

    /**
     * Renderiza un gráfico horizontal de acumulado semanal
     * @param {Object} data - Respuesta del endpoint get_sip_grafica_acumulado_semanal.php
     * @param {Object} opcionesFiltro - { sexo, lineasSuaves, separarGraficos, granjas, campanias, galpones, unificado, esUnificado }
     */
    function renderizarGraficoHorizontal(data, opcionesFiltro) {
        const contenedor = document.getElementById('contenedor-graficos-horizontales');
        if (!contenedor || !data || !Array.isArray(data.registros)) return;

        const itemOrden = (data && data.orden !== undefined) ? parseInt(data.orden, 10) : 0;
        const tipo = data.tipo || 'mortalidad';
        const tipoKey = data.dia ? `${tipo}-dia-${data.dia}` : tipo;
        const cardId = `card-grafico-hz-${tipoKey}`;

        // Guardar en caché por tipo para manipulación reactiva
        cacheDataPorTipoHz[tipoKey] = {
            data,
            opcionesFiltro: { ...opcionesFiltro }
        };

        // Filtrar registros según selección de ubicación del usuario
        let registrosFiltrados = data.registros;

        const {
            sexo = 'macho',
            lineasSuaves = false,
            separarGraficos = false,
            esUnificado = false,
            granjas = [],
            campanias = [],
            galpones = [],
            unificado = []
        } = opcionesFiltro || {};

        if (esUnificado && Array.isArray(unificado) && unificado.length > 0) {
            registrosFiltrados = registrosFiltrados.filter(r => {
                return unificado.some(u => {
                    const matchGranja = (u.granja && (String(u.granja) === String(r.granja) || String(u.granja) === String(r.granjaNombre)));
                    const matchCampania = (!u.campania || String(u.campania) === String(r.campania));
                    const matchGalpon = (!u.galpon || String(u.galpon) === String(r.galpon));
                    return matchGranja && matchCampania && matchGalpon;
                });
            });
        } else {
            if (Array.isArray(granjas) && granjas.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => granjas.includes(String(r.granja)) || granjas.includes(String(r.granjaNombre)));
            }
            if (Array.isArray(campanias) && campanias.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => campanias.includes(String(r.campania)));
            }
            if (Array.isArray(galpones) && galpones.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => galpones.includes(String(r.galpon)));
            }
        }

        // Destruir instancias previas de este tipo
        const posiblesCanvasIds = [
            `canvas-hz-${tipoKey}`,
            `canvas-hz-${tipoKey}-macho`,
            `canvas-hz-${tipoKey}-hembra`
        ];
        posiblesCanvasIds.forEach(cId => {
            if (instanciasGraficosHz[cId]) {
                try {
                    instanciasGraficosHz[cId].destroy();
                } catch (e) {}
                delete instanciasGraficosHz[cId];
            }
            if (cacheGraficosHz[cId]) {
                delete cacheGraficosHz[cId];
            }
        });

        let existingCard = document.getElementById(cardId);
        if (existingCard) {
            existingCard.remove();
        }

        const textoPeriodoHz = data.dia ? `Día ${data.dia}${data.semana ? ' (Semana ' + data.semana + ')' : ''}` : `Semana ${data.semana || 1}`;

        if (registrosFiltrados.length === 0) {
            const emptyCard = document.createElement('div');
            emptyCard.id = cardId;
            emptyCard.className = 'w-full bg-white rounded-2xl p-8 text-center text-slate-500 font-medium border border-slate-200/80 shadow-sm';
            emptyCard.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2">
                    <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-sm font-semibold text-slate-700">Sin datos para ${data.nombre || tipo} - ${textoPeriodoHz}</p>
                    <p class="text-xs text-slate-400">No se encontraron lotes con los filtros seleccionados.</p>
                </div>
            `;
            insertarCardEnOrdenHz(contenedor, emptyCard, itemOrden);
            return;
        }

        // Construir Eje X y Datasets
        const labels = [];
        const dataM = [];
        const dataH = [];
        const dataComb = [];
        const dataCvM = [];
        const dataCvH = [];
        const dataCvComb = [];
        const dataStdM = [];
        const dataStdH = [];
        const dataStdComb = [];

        let tieneCv = false;
        let tieneStdM = false;
        let tieneStdH = false;

        registrosFiltrados.forEach(r => {
            const granjaStr = r.granjaNombre || r.granja;
            const fechaStr = formatearFechaCorta(r.fechaSemana || r.fechaCarga);
            const labelX = `${granjaStr}-${r.campania}-${r.galpon}: ${fechaStr}`;
            labels.push(labelX);

            const vM = (r.valorM !== null && r.valorM !== undefined && !isNaN(r.valorM)) ? Number(r.valorM) : null;
            const vH = (r.valorH !== null && r.valorH !== undefined && !isNaN(r.valorH)) ? Number(r.valorH) : null;
            dataM.push(vM);
            dataH.push(vH);

            let vC = null;
            if (vM !== null && vH !== null) vC = Number(((vM + vH) / 2).toFixed(4));
            else if (vM !== null) vC = vM;
            else if (vH !== null) vC = vH;
            dataComb.push(vC);

            const sM = (r.estandarM !== null && r.estandarM !== undefined && !isNaN(r.estandarM)) ? Number(r.estandarM) : null;
            const sH = (r.estandarH !== null && r.estandarH !== undefined && !isNaN(r.estandarH)) ? Number(r.estandarH) : null;
            dataStdM.push(sM);
            dataStdH.push(sH);
            let sC = null;
            if (sM !== null && sH !== null) sC = Number(((sM + sH) / 2).toFixed(4));
            else if (sM !== null) sC = sM;
            else if (sH !== null) sC = sH;
            dataStdComb.push(sC);
            if (sM !== null) tieneStdM = true;
            if (sH !== null) tieneStdH = true;

            const cM = (r.cvM !== null && r.cvM !== undefined && !isNaN(r.cvM)) ? Number(r.cvM) : null;
            const cH = (r.cvH !== null && r.cvH !== undefined && !isNaN(r.cvH)) ? Number(r.cvH) : null;
            dataCvM.push(cM);
            dataCvH.push(cH);
            let cC = null;
            if (cM !== null && cH !== null) cC = Number(((cM + cH) / 2).toFixed(4));
            else if (cM !== null) cC = cM;
            else if (cH !== null) cC = cH;
            dataCvComb.push(cC);
            if (cM !== null || cH !== null) tieneCv = true;
        });

        // Crear contenedor HTML de la tarjeta
        const card = document.createElement('div');
        card.id = cardId;
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        const nombreGrafico = data.nombre || tipo.toUpperCase();
        const esSeparado = (sexo === 'ambos' && Boolean(separarGraficos));

        let textoSexo = 'Macho';
        if (sexo === 'ambos') {
            textoSexo = esSeparado ? 'Macho y Hembra (Separados)' : 'Macho y Hembra';
        } else if (sexo === 'combinado') {
            textoSexo = 'Combinado (Promedio)';
        } else if (sexo === 'hembra') {
            textoSexo = 'Hembra';
        }

        const minCanvasWidth = Math.max(600, registrosFiltrados.length * getColWidthPorLote());
        const tensionVal = lineasSuaves ? 0.35 : 0;

        if (esSeparado) {
            // MODO SEPARADO: 2 Gráficos Apilados dentro de la misma tarjeta
            const canvasWrapperIdM = `wrapper-canvas-hz-${tipoKey}-macho`;
            const canvasWrapperIdH = `wrapper-canvas-hz-${tipoKey}-hembra`;
            const canvasIdM = `canvas-hz-${tipoKey}-macho`;
            const canvasIdH = `canvas-hz-${tipoKey}-hembra`;
            const btnResetZoomIdM = `btn-reset-zoom-hz-${tipoKey}-macho`;
            const btnResetZoomIdH = `btn-reset-zoom-hz-${tipoKey}-hembra`;

            card.innerHTML = `
                <!-- HEADER DE LA TARJETA -->
                <div class="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                            ${nombreGrafico}
                        </span>
                        <span class="subtitulo-hz-sexo text-xs font-bold text-slate-700">${textoPeriodoHz} - ${textoSexo}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-400">
                        <span>Período: <strong class="text-slate-600 font-semibold">${data.periodo?.desde || ''}</strong> al <strong class="text-slate-600 font-semibold">${data.periodo?.hasta || ''}</strong></span>
                        <span class="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                            Unidad: ${data.unidad || ''}${tieneCv ? ' / CV%' : ''}
                        </span>
                    </div>
                </div>

                <!-- CONTENEDOR 1: MACHO -->
                <div class="p-4 sm:p-5 pb-3">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md flex items-center gap-1.5 shadow-2xs">
                            <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                            Macho
                        </span>
                        <button id="${btnResetZoomIdM}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span>Reset Zoom Macho</span>
                        </button>
                    </div>
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperIdM}" style="min-width: ${minCanvasWidth}px; height: 380px; position: relative;">
                            <canvas id="${canvasIdM}" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                </div>

                <!-- DIVISOR SUAVE -->
                <div class="border-t border-slate-100 mx-5 my-1"></div>

                <!-- CONTENEDOR 2: HEMBRA -->
                <div class="p-4 sm:p-5 pt-3">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 rounded-md flex items-center gap-1.5 shadow-2xs">
                            <span class="w-2 h-2 rounded-full bg-rose-600"></span>
                            Hembra
                        </span>
                        <button id="${btnResetZoomIdH}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span>Reset Zoom Hembra</span>
                        </button>
                    </div>
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperIdH}" style="min-width: ${minCanvasWidth}px; height: 380px; position: relative;">
                            <canvas id="${canvasIdH}" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                </div>
            `;

            insertarCardEnOrdenHz(contenedor, card, itemOrden);

            // Instanciar Gráfico Macho
            const datasetsM = crearDatasetsHz('macho', data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartM = crearInstanciaChartHz(canvasIdM, labels, datasetsM, data, btnResetZoomIdM, tieneCv);

            // Instanciar Gráfico Hembra
            const datasetsH = crearDatasetsHz('hembra', data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartH = crearInstanciaChartHz(canvasIdH, labels, datasetsH, data, btnResetZoomIdH, tieneCv);

            if (chartM) {
                cacheGraficosHz[canvasIdM] = {
                    chartInstance: chartM,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId: canvasWrapperIdM,
                    tieneCv,
                    tipo: tipoKey
                };
            }

            if (chartH) {
                cacheGraficosHz[canvasIdH] = {
                    chartInstance: chartH,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId: canvasWrapperIdH,
                    tieneCv,
                    tipo: tipoKey
                };
            }

        } else {
            // MODO UNIFICADO: 1 Solo Gráfico
            const canvasWrapperId = `wrapper-canvas-hz-${tipoKey}`;
            const canvasId = `canvas-hz-${tipoKey}`;
            const btnResetZoomId = `btn-reset-zoom-hz-${tipoKey}`;

            card.innerHTML = `
                <!-- HEADER DE LA TARJETA -->
                <div class="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                            ${nombreGrafico}
                        </span>
                        <span class="subtitulo-hz-sexo text-xs font-bold text-slate-700">${textoPeriodoHz} - ${textoSexo}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-400">
                        <span>Período: <strong class="text-slate-600 font-semibold">${data.periodo?.desde || ''}</strong> al <strong class="text-slate-600 font-semibold">${data.periodo?.hasta || ''}</strong></span>
                        <span class="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                            Unidad: ${data.unidad || ''}${tieneCv ? ' / CV%' : ''}
                        </span>
                        <button id="${btnResetZoomId}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs" title="Restablecer zoom del gráfico">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            <span>Reset Zoom</span>
                        </button>
                    </div>
                </div>

                <!-- ÁREA SCROLLABLE DEL GRÁFICO -->
                <div class="p-4 sm:p-6">
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperId}" style="min-width: ${minCanvasWidth}px; height: 530px; position: relative;">
                            <canvas id="${canvasId}" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>
                    </div>
                </div>
            `;

            insertarCardEnOrdenHz(contenedor, card, itemOrden);

            const datasets = crearDatasetsHz(sexo, data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartInstance = crearInstanciaChartHz(canvasId, labels, datasets, data, btnResetZoomId, tieneCv);

            if (chartInstance) {
                cacheGraficosHz[canvasId] = {
                    chartInstance,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId,
                    tieneCv,
                    tipo: tipoKey
                };
            }
        }
    }

    /**
     * Construye una instancia de Chart.js configurada para gráficos horizontales con soporte de doble eje
     */
    function crearInstanciaChartHz(canvasId, labels, datasets, data, btnResetZoomId, tieneCv) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const btnResetZoom = btnResetZoomId ? document.getElementById(btnResetZoomId) : null;

        const plugins = [];
        if (window.ChartDataLabels) {
            plugins.push(window.ChartDataLabels);
        }

        const scalesConfig = {
            x: {
                grid: {
                    color: 'rgba(226, 232, 240, 0.7)',
                    drawBorder: false
                },
                ticks: {
                    autoSkip: false,
                    maxRotation: 90,
                    minRotation: 90,
                    font: {
                        size: getTamanoFuente(10.5),
                        weight: '600',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#334155'
                }
            }
        };

        if (data.esCombinado && Array.isArray(data.seriesList)) {
            data.seriesList.forEach((s, idx) => {
                scalesConfig[s.axisId] = {
                    beginAtZero: true,
                    position: s.position,
                    grid: {
                        drawOnChartArea: idx === 0,
                        color: 'rgba(226, 232, 240, 0.7)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: `${s.nombre} (${s.unidad || ''})`,
                        font: {
                            size: getTamanoFuente(11),
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: s.color
                    },
                    ticks: {
                        font: {
                            size: getTamanoFuente(10.5),
                            weight: '600',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: s.color
                    }
                };
            });
        } else {
            scalesConfig.y = {
                beginAtZero: true,
                position: 'left',
                grid: {
                    color: 'rgba(226, 232, 240, 0.7)',
                    drawBorder: false
                },
                title: {
                    display: true,
                    text: data.unidad || '',
                    font: {
                        size: getTamanoFuente(12),
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#475569'
                },
                ticks: {
                    font: {
                        size: getTamanoFuente(11),
                        weight: '600',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#475569'
                }
            };

            // Segundo Eje Y (Derecho) para Coeficiente de Variación (CV%)
            if (tieneCv) {
                scalesConfig.yCv = {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(226, 232, 240, 0.5)',
                        drawBorder: true
                    },
                    title: {
                        display: true,
                        text: 'CV %',
                        font: {
                            size: getTamanoFuente(12),
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: '#0284c7'
                    },
                    ticks: {
                        font: {
                            size: getTamanoFuente(11),
                            weight: '600',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: '#0284c7',
                        callback: function (val) {
                            return val + '%';
                        }
                    }
                };
            }
        }

        const chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            plugins: plugins,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: {
                        top: 25,
                        right: (tieneCv || (data.esCombinado && data.seriesList && data.seriesList.some(s => s.position === 'right'))) ? 35 : 25,
                        bottom: 15,
                        left: 10
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                            onPanComplete: () => {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                speed: 0.1
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                            onZoomComplete: () => {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 9,
                            boxHeight: 9,
                            padding: 16,
                            font: {
                                size: 12,
                                weight: '600',
                                family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            },
                            color: '#1e293b'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            title: function (tooltipItems) {
                                if (tooltipItems.length > 0) {
                                    return tooltipItems[0].label;
                                }
                                return '';
                            },
                            label: function (context) {
                                const val = context.parsed.y;
                                if (val === null || val === undefined) return `${context.dataset.label}: S/D`;
                                if (context.dataset.yAxisID === 'yCv' || String(context.dataset.label).includes('CV')) {
                                    return `${context.dataset.label}: ${Number(val).toFixed(2)}%`;
                                }
                                const dec = getDecimalesPorTipo(data.tipo || '');
                                return `${context.dataset.label}: ${Number(val).toFixed(dec)} ${data.unidad || ''}`;
                            }
                        }
                    }
                },
                scales: scalesConfig
            }
        });

        // Eventos para restablecer zoom
        if (btnResetZoom) {
            btnResetZoom.addEventListener('click', () => {
                if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                    chartInstance.resetZoom();
                    btnResetZoom.classList.add('hidden');
                }
            });
        }

        canvas.addEventListener('dblclick', () => {
            if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                chartInstance.resetZoom();
                if (btnResetZoom) btnResetZoom.classList.add('hidden');
            }
        });

        instanciasGraficosHz[canvasId] = chartInstance;
        return chartInstance;
    }

    /**
     * Construye la lista de datasets de Chart.js según el sexo seleccionado con soporte de Estándares y Coeficiente de Variación (CV%)
     */
    function crearDatasetsHz(sexo, data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH) {
        const datasets = [];
        const fontDatalabelsSize = getTamanoFuente(10);
        const dec = getDecimalesPorTipo(tipo);

        if (data.esCombinado && Array.isArray(data.seriesList)) {
            data.seriesList.forEach((s, idx) => {
                let arrData = s.dataM;
                if (sexo === 'hembra') arrData = s.dataH;
                else if (sexo === 'combinado') arrData = s.dataComb;

                const decS = getDecimalesPorTipo(s.tipo);

                datasets.push({
                    label: `${s.nombre} (${s.unidad || ''})`,
                    data: arrData,
                    yAxisID: s.axisId || 'y',
                    borderColor: s.color,
                    backgroundColor: s.bg || s.color,
                    borderWidth: 2.2,
                    pointBackgroundColor: s.color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: idx % 2 === 0 ? 'top' : 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: s.color,
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return (value !== null && value !== undefined && !isNaN(value)) ? Number(value).toFixed(decS) : '';
                        }
                    }
                });
            });
            return datasets;
        }

        const labelPeriodo = data.dia ? `D${data.dia}` : `S${data.semana || 1}`;

        if (sexo === 'macho' || sexo === 'ambos') {
            // Valor Real Macho
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Macho`,
                data: dataM,
                yAxisID: 'y',
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#1d4ed8',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Macho (si existe en los datos - Verde Normal)
            if (tieneStdM && Array.isArray(dataStdM)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Macho`,
                    data: dataStdM,
                    yAxisID: 'y',
                    borderColor: '#16a34a',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#16a34a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#15803d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Macho (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvM)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Macho (%)`,
                    data: dataCvM,
                    yAxisID: 'yCv',
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#0284c7',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#0369a1',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        if (sexo === 'hembra' || sexo === 'ambos') {
            // Valor Real Hembra
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Hembra`,
                data: dataH,
                yAxisID: 'y',
                borderColor: '#ea0c43',
                backgroundColor: 'rgba(234, 88, 12, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#ea0c43',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#be123c',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Hembra (si existe en los datos - Verde Oscuro)
            if (tieneStdH && Array.isArray(dataStdH)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Hembra`,
                    data: dataStdH,
                    yAxisID: 'y',
                    borderColor: '#166534',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#166534',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#14532d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Hembra (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvH)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Hembra (%)`,
                    data: dataCvH,
                    yAxisID: 'yCv',
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#ea580c',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#c2410c',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        if (sexo === 'combinado') {
            // Valor Real Combinado
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Combinado`,
                data: dataComb,
                yAxisID: 'y',
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#6d28d9',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Combinado (si existe en los datos - Verde Promedio #15803d)
            if ((tieneStdM || tieneStdH) && Array.isArray(dataStdComb)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Combinado`,
                    data: dataStdComb,
                    yAxisID: 'y',
                    borderColor: '#15803d',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#15803d',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#15803d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Combinado (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvComb)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Combinado (%)`,
                    data: dataCvComb,
                    yAxisID: 'yCv',
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#5b21b6',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        return datasets;
    }

    /**
     * Actualiza en caliente el sexo visualizado en todas las gráficas horizontales activas sin recargar el endpoint
     */
    function actualizarSexoGraficosHorizontales(nuevoSexo) {
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            const item = cacheDataPorTipoHz[tipo];
            if (item && item.data) {
                item.opcionesFiltro.sexo = nuevoSexo;
                renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
            }
        });
    }

    /**
     * Actualiza en caliente la separación de gráficas (apiladas / unificadas) sin recargar el endpoint
     */
    function actualizarSeparacionGraficosHorizontales(separar) {
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            const item = cacheDataPorTipoHz[tipo];
            if (item && item.data) {
                item.opcionesFiltro.separarGraficos = Boolean(separar);
                renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
            }
        });
    }

    /**
     * Actualiza dinámicamente la curvatura de las líneas en todos los gráficos horizontales activos
     */
    function actualizarTensionGraficosHorizontales(esSuave) {
        const tensionVal = esSuave ? 0.35 : 0;
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            if (cacheDataPorTipoHz[tipo]) {
                cacheDataPorTipoHz[tipo].opcionesFiltro.lineasSuaves = esSuave;
            }
        });
        Object.keys(instanciasGraficosHz).forEach(key => {
            const chart = instanciasGraficosHz[key];
            if (chart && chart.data && Array.isArray(chart.data.datasets)) {
                chart.data.datasets.forEach(ds => {
                    ds.tension = tensionVal;
                });
                chart.update();
            }
        });
    }

    /**
     * Aumenta o disminuye en caliente el tamaño de letra y espaciado de todos los gráficos horizontales
     * @param {number} direccion - (+1 para agrandar, -1 para disminuir)
     */
    function cambiarTamanoTextoGraficosHorizontales(direccion) {
        const nuevoIndice = indiceEscalaTexto + (direccion > 0 ? 1 : -1);
        if (nuevoIndice < 0 || nuevoIndice >= NIVELES_ESCALA_TEXTO.length) {
            return;
        }
        indiceEscalaTexto = nuevoIndice;

        const escala = getEscalaTextoActual();
        const pctTexto = `${Math.round(escala * 100)}%`;

        const labelTamano = document.getElementById('label-tamano-texto-hz');
        if (labelTamano) {
            labelTamano.textContent = pctTexto;
        }

        const sizeX = getTamanoFuente(10.5);
        const sizeY = getTamanoFuente(11);
        const sizeYTitle = getTamanoFuente(12);
        const sizeLabels = getTamanoFuente(10);
        const colWidth = getColWidthPorLote();

        Object.keys(cacheGraficosHz).forEach(canvasId => {
            const item = cacheGraficosHz[canvasId];
            if (!item || !item.chartInstance) return;

            const chart = item.chartInstance;

            // Actualizar ancho del contenedor wrapper si es necesario
            const wrapper = document.getElementById(item.canvasWrapperId);
            if (wrapper && Array.isArray(item.registrosFiltrados)) {
                const nuevoAncho = Math.max(600, item.registrosFiltrados.length * colWidth);
                wrapper.style.minWidth = `${nuevoAncho}px`;
            }

            // Actualizar fuentes de escalas dinámicamente
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(scaleKey => {
                    if (scaleKey === 'x') {
                        if (chart.options.scales.x.ticks && chart.options.scales.x.ticks.font) {
                            chart.options.scales.x.ticks.font.size = sizeX;
                        }
                    } else {
                        const sc = chart.options.scales[scaleKey];
                        if (sc.ticks && sc.ticks.font) sc.ticks.font.size = sizeY;
                        if (sc.title && sc.title.font) sc.title.font.size = sizeYTitle;
                    }
                });
            }

            // Actualizar fuentes de datalabels en cada dataset
            if (Array.isArray(chart.data.datasets)) {
                chart.data.datasets.forEach(ds => {
                    if (ds.datalabels && ds.datalabels.font) {
                        ds.datalabels.font.size = sizeLabels;
                    }
                });
            }

            chart.resize();
            chart.update();
        });
    }

    // Exportar al objeto global
    window.renderizarGraficoHorizontal = renderizarGraficoHorizontal;
    window.limpiarGraficosHorizontales = limpiarGraficosHorizontales;
    window.actualizarTensionGraficosHorizontales = actualizarTensionGraficosHorizontales;
    window.actualizarSexoGraficosHorizontales = actualizarSexoGraficosHorizontales;
    window.actualizarSeparacionGraficosHorizontales = actualizarSeparacionGraficosHorizontales;
    window.cambiarTamanoTextoGraficosHorizontales = cambiarTamanoTextoGraficosHorizontales;
    window.actualizarIndicadorProgresoHz = actualizarIndicadorProgresoHz;

})(window);
