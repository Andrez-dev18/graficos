/**
 * Renderizado de Paneles Dinámicos, Tarjetas Blancas y Filtrado
 */

function icTipoIconHtml(tipo) {
    if (typeof SipGraficaIcons !== 'undefined' && typeof SipGraficaIcons.iconHtml === 'function') {
        return SipGraficaIcons.iconHtml(tipo);
    }
    const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipo]) ? TIPO_GRAFICO_MAP[tipo] : null;
    return cfg && cfg.iconSvg ? cfg.iconSvg : '';
}

function contarGraficasVisiblesEnPanel(cardEl) {
    const gridEl = cardEl.closest('[id^="grid-sec-"]');
    return gridEl
        ? gridEl.querySelectorAll('[id^="card-grafico-"]:not(.hidden)').length
        : 1;
}

function resolverAlturaMainChartCard(cardEl, singleFullWidth) {
    const g = (typeof configGraficos !== 'undefined')
        ? configGraficos.find(item => item.idCard === cardEl.id)
        : null;
    if (g && g.esCombinado) return 480;

    if (singleFullWidth) return 450;

    const visibleInPanel = contarGraficasVisiblesEnPanel(cardEl);
    if (visibleInPanel === 1) return 450;
    if (visibleInPanel === 2) return 360;
    return 320;
}

function obtenerLayoutOptsCard(cardEl, singleFullWidth) {
    const visibleInPanel = contarGraficasVisiblesEnPanel(cardEl);
    const stack = cardEl.querySelector('.chart-stack');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const enFullscreen = Boolean(stack && fsEl === stack);
    const cardW = cardEl.clientWidth || cardEl.querySelector('.chart-canvas-wrapper')?.clientWidth || 300;
    return {
        width: cardW,
        singleFullWidth: Boolean(singleFullWidth || visibleInPanel === 1),
        columns: visibleInPanel,
        fullscreen: enFullscreen
    };
}

function redimensionarChartsCard(cardEl, layoutOpts) {
    if (!cardEl || typeof Chart === 'undefined' || !Chart.getChart) return;
    const SGS = (typeof SipGraficaShared !== 'undefined') ? SipGraficaShared : null;
    const opts = layoutOpts || obtenerLayoutOptsCard(cardEl, false);

    const pctCanvas = cardEl.querySelector('canvas[id$="-pct"]');
    const mainCanvas = cardEl.querySelector('canvas:not([id$="-pct"])');
    const pctChart = pctCanvas ? Chart.getChart(pctCanvas) : null;
    const mainChart = mainCanvas ? Chart.getChart(mainCanvas) : null;

    if (mainChart && typeof mainChart.resize === 'function') {
        mainChart.resize();
    }
    if (pctChart && typeof pctChart.resize === 'function') {
        pctChart.resize();
    }
    if (pctChart && SGS && typeof SGS.applyPctAdaptiveLayout === 'function') {
        SGS.applyPctAdaptiveLayout(pctChart, opts);
        pctChart.update('none');
    }
    if (mainChart && SGS && typeof SGS.applyMainChartDatalabelLayout === 'function') {
        SGS.applyMainChartDatalabelLayout(mainChart, opts);
        mainChart.update('none');
    }
    if (mainChart && pctChart && SGS && typeof SGS.finalizePctChartPair === 'function') {
        SGS.finalizePctChartPair(mainChart, pctChart);
    }
}

function aplicarAlturasAdaptativasCard(cardEl, singleFullWidth) {
    if (!cardEl || typeof SipGraficaShared === 'undefined') return;
    const SGS = SipGraficaShared;
    const layoutOpts = obtenerLayoutOptsCard(cardEl, singleFullWidth);
    const stack = cardEl.querySelector('.chart-stack');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    const enFullscreen = Boolean(stack && fsEl === stack);

    const mainWrap = cardEl.querySelector('.chart-canvas-wrapper');
    const pctWrap = cardEl.querySelector('.chart-pct-wrapper');
    const cardW = layoutOpts.width;
    const pctVisible = pctWrap && !pctWrap.classList.contains('hidden');

    if (enFullscreen && stack) {
        const vh = window.innerHeight || 800;
        const pctH = Math.round(vh * 0.36);
        const mainH = Math.round(vh * 0.56);
        if (pctWrap) pctWrap.style.height = `${pctH}px`;
        if (mainWrap) mainWrap.style.height = `${mainH}px`;
        layoutOpts.fullscreen = true;
        layoutOpts.width = stack.clientWidth || cardW;
    } else {
        const mainH = resolverAlturaMainChartCard(cardEl, layoutOpts.singleFullWidth);
        if (mainWrap) mainWrap.style.height = `${mainH}px`;
        if (pctWrap && pctVisible && typeof SGS.calcPctChartHeight === 'function') {
            const pctH = SGS.calcPctChartHeight(mainH, layoutOpts.singleFullWidth, cardW);
            pctWrap.style.height = `${pctH}px`;
        } else if (pctWrap && !pctVisible) {
            pctWrap.style.height = '0px';
        }
    }

    requestAnimationFrame(() => redimensionarChartsCard(cardEl, layoutOpts));
}

function bindCardFullscreen(cardEl) {
    if (!cardEl) return;
    const btn = cardEl.querySelector('.btn-card-fullscreen');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
        const target = cardEl.querySelector('.chart-stack') || cardEl;
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (fsEl) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
            if (exit) exit.call(document);
            return;
        }
        const req = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
        if (req) req.call(target);
    });
}

function initFullscreenChartsInterconsultas() {
    if (window._icFullscreenChartsBound) return;
    window._icFullscreenChartsBound = true;

    const onFsChange = () => {
        document.querySelectorAll('[id^="card-grafico-"]').forEach(cardEl => {
            if (cardEl.classList.contains('hidden')) return;
            const visibleInPanel = contarGraficasVisiblesEnPanel(cardEl);
            aplicarAlturasAdaptativasCard(cardEl, visibleInPanel === 1);
        });
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);
}

initFullscreenChartsInterconsultas();

function mostrarAlertaToast(mensaje) {
    let toast = document.getElementById('ic-toast-alerta');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ic-toast-alerta';
        toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 transition-all transform translate-y-4 opacity-0 pointer-events-none';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> <span>${mensaje}</span>`;

    toast.classList.remove('translate-y-4', 'opacity-0', 'pointer-events-none');

    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0', 'pointer-events-none');
    }, 3500);
}

function actualizarIndicadorProgreso(completadas, total) {
    let barra = document.getElementById('ic-progreso-carga-graficos');
    if (!barra) {
        barra = document.createElement('div');
        barra.id = 'ic-progreso-carga-graficos';
        barra.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/80 backdrop-blur-xs transition-all duration-300 pointer-events-none opacity-0 translate-y-4';
        document.body.appendChild(barra);
    }

    const btnCargar = document.getElementById('btn-cargar');

    if (completadas < total && total > 0) {
        const pct = Math.round((completadas / total) * 100);
        barra.innerHTML = `
            <svg class="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Cargando gráficas (${completadas}/${total})</span>
            <div class="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden ml-0.5">
                <div class="bg-blue-500 h-full transition-all duration-200" style="width: ${pct}%"></div>
            </div>
        `;
        barra.classList.remove('opacity-0', 'translate-y-4');
        if (btnCargar) {
            btnCargar.classList.add('opacity-80');
            const icon = btnCargar.querySelector('.icon-cargar');
            if (icon) icon.classList.add('animate-spin');
        }
    } else {
        barra.innerHTML = `
            <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
            </svg>
            <span class="text-sky-300">Todas las gráficas cargadas</span>
        `;
        if (btnCargar) {
            btnCargar.classList.remove('opacity-80');
            const icon = btnCargar.querySelector('.icon-cargar');
            if (icon) icon.classList.remove('animate-spin');
        }
        setTimeout(() => {
            barra.classList.add('opacity-0', 'translate-y-4');
        }, 1200);
    }
}

function mostrarLoaderGraficos() {
    const contenedor = document.getElementById('contenedor-graficos');
    const msgSinGraficos = document.getElementById('mensaje-sin-graficos');
    if (msgSinGraficos) msgSinGraficos.classList.add('hidden');

    if (contenedor) {
        contenedor.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-sm transition-all">
                <svg class="w-10 h-10 text-blue-600 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm font-semibold text-slate-700">Cargando gráficas...</p>
                <p class="text-xs text-slate-400 mt-1">Obteniendo datos desde el servidor</p>
            </div>
        `;
    }
}

function ocultarLoaderGraficos() {
    const barra = document.getElementById('ic-progreso-carga-graficos');
    if (barra) {
        barra.classList.add('opacity-0', 'translate-y-4');
    }
    const btnCargar = document.getElementById('btn-cargar');
    if (btnCargar) {
        btnCargar.classList.remove('opacity-80');
        const icon = btnCargar.querySelector('.icon-cargar');
        if (icon) icon.classList.remove('animate-spin');
    }
}
function renderizarGraficosDinamicos(listaConfigs, esIncremental = false) {
    if (!esIncremental) {
        configGraficos = listaConfigs;
    } else {
        listaConfigs.forEach(it => {
            const idx = configGraficos.findIndex(c =>
                c.canvasId === it.canvasId ||
                (c.granja === it.granja && c.campania === it.campania && c.galpon === it.galpon && c.tipo === it.tipo)
            );
            if (idx >= 0) {
                if (configGraficos[idx].sinDatos && !it.sinDatos) {
                    configGraficos[idx] = it;
                }
            } else {
                configGraficos.push(it);
            }
        });
    }

    const contenedor = document.getElementById('contenedor-graficos');
    if (!contenedor) return;

    if (!esIncremental) {
        Object.keys(chartInstances).forEach(id => {
            if (chartInstances[id]) {
                chartInstances[id].destroy();
                delete chartInstances[id];
            }
        });
        contenedor.innerHTML = '';
    }

    const selectDispEl = document.getElementById('select-disposicion-graficos');
    const disposicion = (selectDispEl && selectDispEl.value) 
        ? selectDispEl.value 
        : ((typeof window !== 'undefined' && window.disposicionGraficosGlobal) ? window.disposicionGraficosGlobal : 'vertical');
    const esHorizontal = (disposicion === 'horizontal');

    const gruposPorTipo = {};
    listaConfigs.forEach(item => {
        const tipo = item.tipo || 'mortalidad';
        if (!gruposPorTipo[tipo]) gruposPorTipo[tipo] = [];
        gruposPorTipo[tipo].push(item);
    });

    const numGrupos = Object.keys(gruposPorTipo).length;
    const requiereScrollInicial = (esHorizontal && numGrupos > 3);

    if (!esIncremental) {
        if (esHorizontal) {
            if (requiereScrollInicial) {
                contenedor.className = 'w-full flex flex-row items-stretch gap-4 overflow-x-auto pb-6';
            } else {
                contenedor.className = 'w-full flex flex-row items-stretch gap-4 overflow-x-hidden pb-2';
            }
        } else {
            contenedor.className = 'w-full flex flex-col gap-6';
        }
    }

    if (!listaConfigs || listaConfigs.length === 0) {
        if (!esIncremental) {
            const msgSinGraficos = document.getElementById('mensaje-sin-graficos');
            if (msgSinGraficos) msgSinGraficos.classList.remove('hidden');
        }
        return;
    }

    const msgSinGraficos = document.getElementById('mensaje-sin-graficos');
    if (msgSinGraficos) msgSinGraficos.classList.add('hidden');

    const itemsACrear = [];
    const itemsUiPct = [];

    Object.keys(gruposPorTipo).forEach(tipoKey => {
        const itemsGrupo = gruposPorTipo[tipoKey];
        const sectionId = `sec-tipo-${tipoKey}`;
        const gridId = `grid-sec-${tipoKey}`;

        let sectionEl = document.getElementById(sectionId);
        let gridEl = document.getElementById(gridId);

        if (!sectionEl || !gridEl) {
            const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipoKey]) ? TIPO_GRAFICO_MAP[tipoKey] : {
                label: tipoKey.toUpperCase(),
                unidad: '',
                badgeBg: 'bg-slate-100',
                badgeText: 'text-slate-700',
                badgeBorder: 'border-slate-200',
                iconSvg: ''
            };

            let sectionLabel = cfg.label;
            if (itemsGrupo[0] && itemsGrupo[0].modoCombinado === 'granja') {
                sectionLabel = `Comparativa de ${cfg.label}`;
            } else if (tipoKey === 'combinado' && itemsGrupo[0]) {
                const item0 = itemsGrupo[0];
                if (Array.isArray(item0.tiposCombinados)) {
                    const labelsMap = item0.tiposCombinados.map(t => {
                        const c = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[t]) ? TIPO_GRAFICO_MAP[t] : { label: t };
                        return c.label;
                    });
                    if (labelsMap.length > 2) {
                        const ult = labelsMap.pop();
                        sectionLabel = `${labelsMap.join(', ')} y ${ult.toLowerCase()}`;
                    } else if (labelsMap.length === 2) {
                        sectionLabel = `${labelsMap[0]} y ${labelsMap[1].toLowerCase()}`;
                    }
                } else if (item0.tipo1 && item0.tipo2) {
                    const cfg1 = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[item0.tipo1]) ? TIPO_GRAFICO_MAP[item0.tipo1] : { label: item0.tipo1 };
                    const cfg2 = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[item0.tipo2]) ? TIPO_GRAFICO_MAP[item0.tipo2] : { label: item0.tipo2 };
                    sectionLabel = `${cfg1.label} y ${cfg2.label.toLowerCase()}`;
                }
            }

            const panelClases = esHorizontal
                ? (requiereScrollInicial
                    ? 'section-tipo-panel flex-shrink-0 w-full sm:w-[480px] md:w-[540px] lg:w-[600px] xl:w-[640px] bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between self-stretch transition-all'
                    : 'section-tipo-panel flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between self-stretch transition-all')
                : 'section-tipo-panel w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col';

            const gridClases = esHorizontal
                ? 'flex flex-col gap-4 w-full flex-1 justify-start'
                : `grid grid-cols-1 ${itemsGrupo.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : ''} gap-4 w-full`;

            const ordenTipo = (itemsGrupo[0] && itemsGrupo[0].ordenTipo !== undefined) ? itemsGrupo[0].ordenTipo : 999;

            const sectionHtml = `
                <div id="${sectionId}" data-orden-tipo="${ordenTipo}" class="${panelClases}">
                    <div class="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-3 py-1.5 rounded-lg ${cfg.badgeBg} ${cfg.badgeText} border ${cfg.badgeBorder} flex items-center gap-1.5 shadow-sm">
                                ${icTipoIconHtml(tipoKey)} ${sectionLabel}
                            </span>
                            <span class="span-count-graficas text-xs font-semibold text-slate-400">
                                (${itemsGrupo.length} ${itemsGrupo.length === 1 ? 'gráfica' : 'gráficas'})
                            </span>
                        </div>
                    </div>
                    <div id="${gridId}" class="${gridClases}"></div>
                </div>
            `;

            const newSectionWrapper = document.createElement('div');
            newSectionWrapper.innerHTML = sectionHtml.trim();
            const newSectionEl = newSectionWrapper.firstElementChild;

            const existingSections = Array.from(contenedor.querySelectorAll('.section-tipo-panel'));
            const siblingSection = existingSections.find(s => {
                const sOrden = parseInt(s.dataset.ordenTipo, 10);
                return !isNaN(sOrden) && sOrden > ordenTipo;
            });

            if (siblingSection) {
                contenedor.insertBefore(newSectionEl, siblingSection);
            } else {
                contenedor.appendChild(newSectionEl);
            }

            gridEl = document.getElementById(gridId);
            sectionEl = document.getElementById(sectionId);
        }

        itemsGrupo.forEach(item => {
            const cardExistente = document.getElementById(item.idCard);
            if (cardExistente) {
                if (item.sinDatos || cardExistente.getAttribute('data-sin-datos') !== '1') {
                    if (!item.sinDatos) {
                        if (typeof asegurarUiPctTarjeta === 'function') {
                            asegurarUiPctTarjeta(item, cardExistente);
                        }
                        if (typeof itemGraficoLineaSoportaPctUi === 'function' && itemGraficoLineaSoportaPctUi(item)) {
                            itemsUiPct.push(item);
                        }
                    }
                    return;
                }
                cardExistente.remove();
            }

            const itemOrden = item.orden !== undefined ? item.orden : 9999;

            if (item.sinDatos) {
                const cardHtml = `
                <div id="${item.idCard}" data-sin-datos="1" data-orden="${itemOrden}" class="bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between transition-all w-full flex-1">
                    <div class="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-2 border-b border-slate-200/60 min-h-[42px] flex-shrink-0">
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            <span class="inline-block w-2 h-2 rounded-full bg-slate-300"></span>
                            <span>Sin Datos Disponibles</span>
                        </div>
                        <span class="inline-flex items-center border border-slate-200 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 shadow-2xs">
                            ${item.infoBadge}
                        </span>
                    </div>
                    <div class="relative w-full h-[320px] rounded-lg border border-dashed border-slate-200 bg-white/70 flex flex-col items-center justify-center p-6 text-center">
                        <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <p class="text-xs font-bold text-slate-700 mb-1">Sin registros para esta campaña</p>
                        <p class="text-[11px] text-slate-400 max-w-[240px] leading-relaxed">No se encontraron evaluaciones registradas de ${item.tipo || 'esta métrica'} en ${item.infoBadge}.</p>
                    </div>
                </div>`;

                const newCardWrapper = document.createElement('div');
                newCardWrapper.innerHTML = cardHtml.trim();
                const newCardEl = newCardWrapper.firstElementChild;

                const existingCards = Array.from(gridEl.children);
                const siblingCard = existingCards.find(child => {
                    const childOrden = parseInt(child.dataset.orden, 10);
                    return !isNaN(childOrden) && childOrden > itemOrden;
                });

                if (siblingCard) {
                    gridEl.insertBefore(newCardEl, siblingCard);
                } else {
                    gridEl.appendChild(newCardEl);
                }
                return;
            }

            const cardHtml = `
            <div id="${item.idCard}" data-orden="${itemOrden}" class="bg-slate-50/50 rounded-xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between transition-all w-full flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-2 border-b border-slate-200/60 min-h-[42px] flex-shrink-0">
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Vista:</span>
                            <div class="inline-flex rounded-lg p-0.5 bg-white border border-slate-200">
                                <button type="button" data-chart="${item.canvasId}" data-vista="diario"
                                    ${item.soloSemanal ? 'disabled' : ''}
                                    class="btn-vista px-2 py-0.5 text-xs ${item.vistaActiva === 'diario' ? 'font-semibold bg-blue-600 text-white shadow-2xs' : (item.soloSemanal ? 'text-slate-300 opacity-40 cursor-not-allowed pointer-events-none' : 'font-medium text-slate-600 hover:text-slate-900')} rounded-md transition-all">Diario</button>
                                <button type="button" data-chart="${item.canvasId}" data-vista="acumulado"
                                    ${item.soloSemanal ? 'disabled' : ''}
                                    class="btn-vista px-2 py-0.5 text-xs ${item.vistaActiva === 'acumulado' ? 'font-semibold bg-blue-600 text-white shadow-2xs' : (item.soloSemanal ? 'text-slate-300 opacity-40 cursor-not-allowed pointer-events-none' : 'font-medium text-slate-600 hover:text-slate-900')} rounded-md transition-all">Acumulado</button>
                                <button type="button" data-chart="${item.canvasId}" data-vista="semanal"
                                    class="btn-vista px-2 py-0.5 text-xs ${item.vistaActiva === 'semanal' ? 'font-semibold bg-blue-600 text-white shadow-2xs' : 'font-medium text-slate-600 hover:text-slate-900'} rounded-md transition-all">Semanal</button>
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Desde:</span>
                            <select data-chart="${item.canvasId}" class="select-desde bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="inicio">Inicio</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Hasta:</span>
                            <select data-chart="${item.canvasId}" class="select-hasta bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="fin">Fin</option>
                            </select>
                        </div>
                        ${(item.tipo === 'mortalidad' || item.tipo === 'consumo_alimento' || item.tipo === 'ganancia_peso' || item.tipo === 'pesaje_pollo' || item.tipo === 'respiratorio' || item.tipo === 'gorgojos' || (item.esCombinado && Array.isArray(item.tiposCombinados) && item.tiposCombinados.some(t => t === 'mortalidad' || t === 'consumo_alimento' || t === 'ganancia_peso' || t === 'pesaje_pollo' || t === 'respiratorio' || t === 'gorgojos'))) ? `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Sexo:</span>
                            <select data-chart="${item.canvasId}" class="select-sexo bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="macho" ${item.sexoActiva === 'macho' ? 'selected' : ''}>Macho</option>
                                <option value="hembra" ${item.sexoActiva === 'hembra' ? 'selected' : ''}>Hembra</option>
                                <option value="ambos" ${item.sexoActiva === 'ambos' ? 'selected' : ''}>Ambos</option>
                                ${(item.tipo === 'consumo_alimento' || (item.esCombinado && Array.isArray(item.tiposCombinados) && item.tiposCombinados.includes('consumo_alimento'))) ? `<option value="combinado" ${item.sexoActiva === 'combinado' ? 'selected' : ''}>Combinado (Prom)</option>` : ''}
                            </select>
                        </div>
                        ` : ''}
                        ${item.tipo === 'respiratorio' ? `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Signo:</span>
                            <select data-chart="${item.canvasId}" class="select-signo bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="todos" ${(item.signoActivo || 'todos') === 'todos' ? 'selected' : ''}>Todos</option>
                                <option value="estornudo" ${(item.signoActivo || 'todos') === 'estornudo' ? 'selected' : ''}>Estornudo</option>
                                <option value="ronquera" ${(item.signoActivo || 'todos') === 'ronquera' ? 'selected' : ''}>Ronquera</option>
                            </select>
                        </div>
                        ` : ''}
                        ${item.tipo === 'gorgojos' ? `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Medición:</span>
                            <select data-chart="${item.canvasId}" class="select-plaga-medicion bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="todos" ${(item.plagaMedicion || 'todos') === 'todos' ? 'selected' : ''}>Todos</option>
                                <option value="larvas" ${(item.plagaMedicion || 'todos') === 'larvas' ? 'selected' : ''}>Larvas</option>
                                <option value="adultos" ${(item.plagaMedicion || 'todos') === 'adultos' ? 'selected' : ''}>Adultos</option>
                            </select>
                        </div>
                        ` : ''}
                        ${item.tipo === 'roedores' ? (function () {
                            const ambRoed = item.ambitoActivo || 'avistamiento';
                            const medRoed = item.plagaMedicion || 'todos';
                            const optsMedRoed = ambRoed === 'consumo'
                                ? [
                                    { v: 'todos', t: 'Todos' },
                                    { v: 'perimetro', t: 'Perímetro' },
                                    { v: 'techo', t: 'Techo' }
                                ]
                                : [
                                    { v: 'todos', t: 'Todos' },
                                    { v: 'vivos', t: 'Vivos' },
                                    { v: 'muertos', t: 'Muertos' }
                                ];
                            const medOk = optsMedRoed.some(o => o.v === medRoed) ? medRoed : 'todos';
                            return `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Ámbito:</span>
                            <select data-chart="${item.canvasId}" class="select-ambito-plaga bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="avistamiento" ${ambRoed === 'avistamiento' ? 'selected' : ''}>Avistamiento</option>
                                <option value="consumo" ${ambRoed === 'consumo' ? 'selected' : ''}>Consumo</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Medición:</span>
                            <select data-chart="${item.canvasId}" class="select-plaga-medicion bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                ${optsMedRoed.map(o => `<option value="${o.v}" ${medOk === o.v ? 'selected' : ''}>${o.t}</option>`).join('')}
                            </select>
                        </div>`;
                        })() : ''}
                        ${(Array.isArray(item.horasAplicacion) && item.horasAplicacion.length > 0) ? `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Hora:</span>
                            <select data-chart="${item.canvasId}" class="select-hora bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="todas" ${(item.horaActiva || 'todas') === 'todas' ? 'selected' : ''}>Todas</option>
                                ${item.horasAplicacion.map(h => `<option value="${h}" ${(item.horaActiva || 'todas') === h ? 'selected' : ''}>${h}</option>`).join('')}
                            </select>
                        </div>
                        ` : ''}
                        ${item.tipo === 'pesaje_pollo' ? `
                        <label class="flex items-center gap-1 cursor-pointer select-none text-xs font-medium text-slate-600">
                            <input type="checkbox" data-chart="${item.canvasId}" class="chk-proy-pesaje w-3.5 h-3.5 rounded text-blue-600" ${item.proyActiva ? 'checked' : ''} ${item.campaniaAbierta === false ? 'disabled' : ''}>
                            <span>Proyección</span>
                        </label>
                        ` : ''}
                        ${(typeof itemGraficoLineaSoportaPctUi === 'function' && itemGraficoLineaSoportaPctUi(item)) ? `
                        <label class="flex items-center gap-1 cursor-pointer select-none text-xs font-medium text-slate-600">
                            <input type="checkbox" data-chart="${item.canvasId}" class="chk-mostrar-pct-card w-3.5 h-3.5 rounded text-blue-600" ${(typeof icItemMuestraPct === 'function' ? icItemMuestraPct(item) : true) ? 'checked' : ''}>
                            <span>Grafico %</span>
                        </label>
                        ` : ''}
                        ${item.tipo === 'mortalidad' ? `
                        <div class="flex items-center gap-1">
                            <span class="font-medium text-slate-500">Gráfico:</span>
                            <select data-chart="${item.canvasId}" class="select-grafico bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                                <option value="linea" ${(item.graficoActivo || 'linea') === 'linea' ? 'selected' : ''}>${(typeof NOMBRES_TIPO_VISUALIZACION !== 'undefined' && item.tipoVisualizacion && NOMBRES_TIPO_VISUALIZACION[item.tipoVisualizacion]) ? NOMBRES_TIPO_VISUALIZACION[item.tipoVisualizacion] : ((typeof tipoVisualizacionGlobal !== 'undefined' && tipoVisualizacionGlobal !== 'default' && typeof NOMBRES_TIPO_VISUALIZACION !== 'undefined' && NOMBRES_TIPO_VISUALIZACION[tipoVisualizacionGlobal]) ? NOMBRES_TIPO_VISUALIZACION[tipoVisualizacionGlobal] : 'Línea')}</option>
                                <option value="causas" ${(item.graficoActivo || 'linea') === 'causas' ? 'selected' : ''}>Causa</option>
                                <option value="pareto" ${(item.graficoActivo || 'linea') === 'pareto' ? 'selected' : ''}>Pareto</option>
                            </select>
                        </div>
                        ` : ''}
                    </div>

                    <div class="flex items-center gap-1.5">
                        <button type="button" class="btn-card-fullscreen p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition cursor-pointer" title="Pantalla completa">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                        </button>
                        <span class="inline-flex items-center border-2 border-sky-500 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 inset-ring inset-ring-blue-700/10 shadow-sm">
                            ${item.infoBadge}
                        </span>
                    </div>
                </div>
                ${(typeof itemGraficoLineaSoportaPctUi === 'function' && itemGraficoLineaSoportaPctUi(item)) ? `
                <div class="chart-stack flex flex-col gap-0">
                    <div class="chart-pct-wrapper relative w-full h-[220px] overflow-hidden min-h-0${(typeof icItemMuestraPct === 'function' && !icItemMuestraPct(item)) ? ' hidden' : ''}">
                        <canvas id="${item.canvasId}-pct"></canvas>
                    </div>
                    <div class="chart-canvas-wrapper relative w-full h-[320px] transition-all duration-300">
                        <canvas id="${item.canvasId}"></canvas>
                    </div>
                </div>` : `
                <div class="chart-canvas-wrapper relative w-full h-[320px] transition-all duration-300">
                    <canvas id="${item.canvasId}"></canvas>
                </div>`}
            </div>`;

            const newCardWrapper = document.createElement('div');
            newCardWrapper.innerHTML = cardHtml.trim();
            const newCardEl = newCardWrapper.firstElementChild;

            const existingCards = Array.from(gridEl.children);
            const siblingCard = existingCards.find(child => {
                const childOrden = parseInt(child.dataset.orden, 10);
                return !isNaN(childOrden) && childOrden > itemOrden;
            });

            if (siblingCard) {
                gridEl.insertBefore(newCardEl, siblingCard);
            } else {
                gridEl.appendChild(newCardEl);
            }

            const singleFullWidth = !esHorizontal && itemsGrupo.length === 1;
            aplicarAlturasAdaptativasCard(newCardEl, singleFullWidth);
            bindCardFullscreen(newCardEl);

            itemsACrear.push(item);
        });

        if (gridEl && sectionEl) {
            const spanCount = sectionEl.querySelector('.span-count-graficas');
            if (spanCount) {
                const total = gridEl.children.length;
                spanCount.textContent = `(${total} ${total === 1 ? 'gráfica' : 'gráficas'})`;
            }
        }
    });

    itemsACrear.forEach(item => crearGraficoChartJS(item));
    itemsUiPct.forEach(item => {
        if (typeof inicializarFiltrosTarjeta === 'function') {
            inicializarFiltrosTarjeta(item);
        }
        if (typeof crearGraficoChartJS === 'function') {
            crearGraficoChartJS(item);
        }
    });
    filtrarYMostrarGraficos();
}

function filtrarYMostrarGraficos() {
    const chkUnif = document.getElementById('chk-unificar-ubicacion');
    const isUnificado = Boolean(chkUnif && chkUnif.checked && typeof msUbicacionUnificada !== 'undefined' && msUbicacionUnificada);

    let selGranjas = [];
    let selCampanias = [];
    let selGalpones = [];
    let selCombinations = [];

    if (isUnificado) {
        selCombinations = msUbicacionUnificada.getSelectedCombinations();
    } else {
        selGranjas = (typeof msGranja !== 'undefined' && msGranja) ? msGranja.getSelectedValues() : [];
        selCampanias = (typeof msCampania !== 'undefined' && msCampania) ? msCampania.getSelectedValues() : [];
        selGalpones = (typeof msGalpon !== 'undefined' && msGalpon) ? msGalpon.getSelectedValues() : [];
    }

    const selTipos = (typeof msGraficos !== 'undefined' && msGraficos) ? msGraficos.getSelectedValues() : [];

    const selectDispEl = document.getElementById('select-disposicion-graficos');
    const disposicion = (selectDispEl && selectDispEl.value) 
        ? selectDispEl.value 
        : ((typeof window !== 'undefined' && window.disposicionGraficosGlobal) ? window.disposicionGraficosGlobal : 'vertical');
    const esHorizontal = (disposicion === 'horizontal');

    let totalVisibleCount = 0;
    const paneles = Array.from(document.querySelectorAll('.section-tipo-panel'));
    const panelesInfo = [];

    paneles.forEach(panel => {
        const cardsInPanel = panel.querySelectorAll('[id^="card-grafico-"]');
        let visibleInPanel = 0;

        cardsInPanel.forEach(card => {
            const gId = card.id;
            const g = configGraficos.find(item => item.idCard === gId);
            if (!g) return;

            let matchUbicacion = false;
            if (g.granja === 'multiple' || g.modoCombinado === 'granja') {
                matchUbicacion = true;
            } else if (isUnificado) {
                matchUbicacion = selCombinations.some(c => 
                    String(c.granja) === String(g.granja) && 
                    String(c.campania) === String(g.campania) && 
                    String(c.galpon) === String(g.galpon)
                );
            } else {
                const matchGranja = selGranjas.includes(g.granja);
                const matchCampania = selCampanias.some(c => {
                    const s = String(c);
                    const cStr = String(g.campania);
                    if (s.includes('__')) {
                        const parts = s.split('__');
                        return parts[0] === String(g.granja) && parts[1] === cStr;
                    }
                    return s === cStr;
                });
                const matchGalpon = selGalpones.some(gp => {
                    const s = String(gp);
                    const gpStr = String(g.galpon);
                    if (s.includes('__')) {
                        const parts = s.split('__');
                        return parts[0] === String(g.granja) && parts[1] === gpStr;
                    }
                    return s === gpStr;
                });
                matchUbicacion = matchGranja && matchCampania && matchGalpon;
            }

            const matchTipo = (g.esCombinado && g.modoCombinado !== 'granja')
                ? (Array.isArray(g.tiposCombinados)
                    ? g.tiposCombinados.some(t => selTipos.includes(t))
                    : (selTipos.includes(g.tipo1) || selTipos.includes(g.tipo2)))
                : selTipos.includes(g.tipo);

            let ocultoPorCombinado = false;
            if (!g.esCombinado && g.tipo !== 'combinado') {
                ocultoPorCombinado = configGraficos.some(c =>
                    c.esCombinado &&
                    c.tipo === 'combinado' &&
                    c.modoCombinado !== 'granja' &&
                    String(c.granja) === String(g.granja) &&
                    String(c.campania) === String(g.campania) &&
                    String(c.galpon) === String(g.galpon) &&
                    Array.isArray(c.tiposCombinados) &&
                    c.tiposCombinados.includes(g.tipo)
                );
            }

            if (matchUbicacion && matchTipo && !ocultoPorCombinado) {
                card.classList.remove('hidden');
                visibleInPanel++;
                totalVisibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        panelesInfo.push({ panel, visibleInPanel, cardsInPanel });
    });

    const totalPanelesVisibles = panelesInfo.filter(p => p.visibleInPanel > 0).length;
    const requiereScroll = (esHorizontal && totalPanelesVisibles > 3);

    const contenedor = document.getElementById('contenedor-graficos');
    if (contenedor && esHorizontal) {
        if (requiereScroll) {
            contenedor.className = 'w-full flex flex-row items-stretch gap-4 overflow-x-auto pb-6';
        } else {
            contenedor.className = 'w-full flex flex-row items-stretch gap-4 overflow-x-hidden pb-2';
        }
    }

    panelesInfo.forEach(({ panel, visibleInPanel, cardsInPanel }) => {
        const countSpan = panel.querySelector('.span-count-graficas');
        if (countSpan) {
            countSpan.textContent = `(${visibleInPanel} ${visibleInPanel === 1 ? 'gráfica' : 'gráficas'})`;
        }

        if (visibleInPanel === 0) {
            panel.classList.add('hidden');
        } else {
            panel.classList.remove('hidden');

            if (esHorizontal) {
                if (requiereScroll) {
                    panel.className = 'section-tipo-panel flex-shrink-0 w-full sm:w-[480px] md:w-[540px] lg:w-[600px] xl:w-[640px] bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between self-stretch transition-all';
                } else {
                    panel.className = 'section-tipo-panel flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between self-stretch transition-all';
                }
            } else {
                panel.className = 'section-tipo-panel w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col gap-4';
            }

            cardsInPanel.forEach(card => {
                if (!card.classList.contains('hidden')) {
                    const canvasWrapper = card.querySelector('.chart-canvas-wrapper');
                    if (canvasWrapper) {
                        const gId = card.id;
                        const g = configGraficos.find(item => item.idCard === gId);
                        if (g && g.esCombinado) {
                            canvasWrapper.className = 'chart-canvas-wrapper relative w-full h-[440px] sm:h-[480px] transition-all duration-300';
                        } else if (esHorizontal) {
                            canvasWrapper.className = 'chart-canvas-wrapper relative w-full h-[320px] transition-all duration-300';
                        } else if (visibleInPanel === 1) {
                            canvasWrapper.className = 'chart-canvas-wrapper relative w-full h-[400px] sm:h-[450px] transition-all duration-300';
                        } else if (visibleInPanel === 2) {
                            canvasWrapper.className = 'chart-canvas-wrapper relative w-full h-[360px] transition-all duration-300';
                        } else {
                            canvasWrapper.className = 'chart-canvas-wrapper relative w-full h-[300px] transition-all duration-300';
                        }
                    }
                }
            });

            const gridEl = panel.querySelector('[id^="grid-sec-"]');
            if (gridEl) {
                if (esHorizontal) {
                    gridEl.className = 'flex flex-col gap-4 w-full flex-1 justify-start transition-all duration-300';
                } else {
                    gridEl.className = 'grid gap-4 w-full transition-all duration-300';
                    if (visibleInPanel === 1) {
                        gridEl.classList.add('grid-cols-1');
                    } else if (visibleInPanel === 2) {
                        gridEl.classList.add('grid-cols-1', 'md:grid-cols-2');
                    } else {
                        gridEl.classList.add('grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3');
                    }
                }
            }
        }
    });

    const msgSinGraficos = document.getElementById('mensaje-sin-graficos');
    if (msgSinGraficos) {
        if (totalVisibleCount === 0) {
            msgSinGraficos.classList.remove('hidden');
        } else {
            msgSinGraficos.classList.add('hidden');
        }
    }

    setTimeout(() => {
        document.querySelectorAll('[id^="card-grafico-"]:not(.hidden)').forEach(cardEl => {
            const visibleInPanel = contarGraficasVisiblesEnPanel(cardEl);
            aplicarAlturasAdaptativasCard(cardEl, visibleInPanel === 1);
        });
    }, 50);
}
