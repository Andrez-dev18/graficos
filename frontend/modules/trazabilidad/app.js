/* ════════════════════════════════════════════════════════════════════════════
   TRAZABILIDAD — JavaScript
════════════════════════════════════════════════════════════════════════════ */

var SANIDAD_BASE = (window.location && window.location.origin ? window.location.origin : '') + '/sanidad';
window.SANIDAD_BASE = SANIDAD_BASE;

var TRZ_API = {
    origenAves: SANIDAD_BASE + '/includes/get_origen_aves.php',
    granjas: SANIDAD_BASE + '/modules/planificacion/cronograma/get_granjas.php',
    analisisFiltro: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_analisis_filtro.php',
    analisisDetalle: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_analisis_detalle.php',
    analisisCodRef: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_analisis_codref.php',
    analisisPeriodo: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_analisis_periodo.php',
    analisisPorcentaje: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_analisis_porcentaje.php',
    tiposMuestra: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_tipos_muestra.php',
    reporteResultados: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_reporte_resultados.php',
    reporteEnfermedades: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/get_reporte_enfermedades.php',
    generarPdf: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/generar_trazabilidad_pdf.php',
    generarReporteResultadosPdf: SANIDAD_BASE + '/modules/laboratorio/trazabilidad/generar_reporte_resultados_pdf.php'
};
window.TRZ_API = TRZ_API;

// ── Paletas ────────────────────────────────────────────────────────────────
/** Paleta viva y distinguible (ok en claro / oscuro). */
var TRZ_PAL_LIGHT = [
    '#e11d48', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0284c7',
    '#6366f1', '#9333ea', '#db2777', '#059669', '#2563eb', '#c026d3',
    '#0891b2', '#4f46e5', '#b91c1c', '#15803d', '#7c3aed'
];
var TRZ_PAL_DARK = [
    '#fb7185', '#fdba74', '#fde047', '#4ade80', '#5eead4', '#38bdf8',
    '#a5b4fc', '#d8b4fe', '#f472b6', '#34d399', '#93c5fd', '#e879f9',
    '#22d3ee', '#c4b5fd', '#fca5a5', '#86efac', '#c084fc'
];
function trzPalette() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
        ? TRZ_PAL_DARK : TRZ_PAL_LIGHT;
}
/** Color desglose por índice de resultado: salto en la paleta para no tonos vecinos. */
function trzPaletteDetColor(palette, idxSerie) {
    var n = palette.length;
    if (n < 1) return '#64748b';
    var step = Math.max(1, Math.floor(n / 3));
    return palette[(idxSerie * step + idxSerie * 7) % n];
}
function trzIsDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** Último tema aplicado (evita redibujos duplicados). */
var trzThemeLast = null;
var trzThemeSyncTimer = null;

function trzResolveIx2DarkCssHref() {
    var path = (window.location.pathname || '').replace(/\\/g, '/');
    var idx = path.indexOf('/modules/');
    if (idx < 0) return '../../../css/ix2-module-dark.css';
    var rest = path.slice(idx + '/modules/'.length);
    var parts = rest.split('/').filter(Boolean);
    if (parts.length) parts.pop();
    var ups = parts.length + 1;
    var prefix = '';
    for (var u = 0; u < ups; u++) prefix += '../';
    var base = prefix + 'css/ix2-module-dark.css';
    var v = (typeof window.SIP_ASVER !== 'undefined' && window.SIP_ASVER) ? String(window.SIP_ASVER) : '';
    return v ? (base + (base.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(v)) : base;
}

/** Mantiene hoja oscura global alineada con fetch-auth / sidebar. */
function trzSyncIx2DarkStylesheet(enableDark) {
    var lk = document.getElementById('sip-ix2-module-dark');
    if (!enableDark) {
        if (lk) lk.remove();
        return;
    }
    if (lk || document.querySelector('link[href*="ix2-module-dark"]')) return;
    var link = document.createElement('link');
    link.id = 'sip-ix2-module-dark';
    link.rel = 'stylesheet';
    link.href = trzResolveIx2DarkCssHref();
    (document.head || document.documentElement).appendChild(link);
}

function trzApplyThemeMode(mode) {
    var dark = mode === 'dark';
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { root.style.colorScheme = dark ? 'dark' : 'light'; } catch (eCs) {}
    trzSyncIx2DarkStylesheet(dark);
}

/** Reacciona al switch del sidebar (storage) o inyección del host (MutationObserver). */
function trzUpdateChartJsThemeDefaults() {
    if (typeof Chart === 'undefined' || !Chart.defaults) return;
    var isDark = trzIsDark();
    Chart.defaults.color = isDark ? '#a1a1aa' : '#475569';
    Chart.defaults.borderColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
    Chart.defaults.backgroundColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';
}

function trzOnThemeChanged() {
    var mode = trzIsDark() ? 'dark' : 'light';
    if (mode === trzThemeLast) return;
    trzThemeLast = mode;
    trzSyncIx2DarkStylesheet(mode === 'dark');
    trzUpdateChartJsThemeDefaults();
    trzInitFpFechas();
    trzInitFpMes();
    trzRedrawAllCharts();
}

function trzScheduleThemeRefresh() {
    if (trzThemeSyncTimer) clearTimeout(trzThemeSyncTimer);
    trzThemeSyncTimer = setTimeout(function() {
        trzThemeSyncTimer = null;
        trzOnThemeChanged();
    }, 30);
}

function trzInitThemeSync() {
    trzThemeLast = trzIsDark() ? 'dark' : 'light';
    trzSyncIx2DarkStylesheet(trzThemeLast === 'dark');
    trzUpdateChartJsThemeDefaults();

    try {
        var obs = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].attributeName === 'data-theme') {
                    trzScheduleThemeRefresh();
                    break;
                }
            }
        });
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (eObs) { /* ignore */ }

    window.addEventListener('storage', function(ev) {
        if (ev.key !== 'ix2-theme') return;
        var next = (ev.newValue || '').toLowerCase();
        if (next !== 'dark' && next !== 'light') return;
        trzApplyThemeMode(next);
        trzScheduleThemeRefresh();
    });
}

// ── Estado ────────────────────────────────────────────────────────────────
var trzCharts1 = [];   // un Chart.js por análisis en Tab 1
var trzCharts1Det = []; // desglose por resultado (Tab 1)
var trzCharts1CodRef = []; // desglose por codRef (Tab 1)
var trzDataCodRef = null;
var trzCodRefCacheKey = '';
/** Resultado activo en gráfica 3 por tarjeta (clave normalizada, alineada con gráfica 2). */
var trzCodRefResByCard = {};
/** Estado UI por tarjeta para redibujar gráfica 3 sin perder selección. */
var trzCodRefUiByCard = {};
var trzChart2  = null;
/** Mini-gráficos desglose Tab 2 (uno por análisis) */
var trzCharts2DetList = [];
var trzDataDetalle = null;
var trzDetalleCacheKey = '';
var trzTipoMuestraActual = '';  // código del tipo de muestra seleccionado en Tab 2
var trzFpFechas2 = [];          // instancias flatpickr Tab 2
var trzFpMes2    = [];
var trzDataTab1 = null;
var trzDataTab2 = null;
var trzTab1Loaded = false;
var trzTab2Loaded = false;
var trzTab3Loaded = false;
var trzTab4Loaded = false;
var trzDataReporte = null;
var trzDataEnfermedades = null;
var trzActiveTab = 1;
// Análisis seleccionados por tab (null = todos)
var trzSelected1 = null;
var trzSelected2 = null;
var trzSelectedReport = null;
var trzDataAnalisisFiltro = null;
var trzAnalisisFiltroKey = '';
var trzFpFechas = [];
var trzFpMes = [];

/** Código normalizado (checkbox = string; JSON puede venir como número). */
function trzNormCod(cod) {
    return String(cod == null ? '' : cod).trim();
}

/** true si el ítem pasa el filtro de análisis (null = todos, [] = ninguno). */
function trzItemEnSeleccionAnalisis(item, selected) {
    if (selected === null) return true;
    if (!selected.length) return false;
    var cod = trzNormCod(item.cod);
    if (cod !== '') {
        return selected.some(function(s) { return trzNormCod(s) === cod; });
    }
    var nom = String(item.nom || '').trim().toLowerCase();
    return selected.some(function(s) {
        return String(s || '').trim().toLowerCase() === nom;
    });
}

/** Tras recargar API, conserva solo códigos que siguen en la lista. */
function trzReconciliarSeleccionAnalisis(selected, items) {
    if (selected === null) return null;
    var allCodes = (items || []).map(function(it) { return trzNormCod(it.cod); }).filter(function(c) { return c !== ''; });
    var uniqAll = allCodes.filter(function(c, i, a) { return a.indexOf(c) === i; });
    var matched = selected.map(trzNormCod).filter(function(sc) {
        return sc !== '' && allCodes.indexOf(sc) >= 0;
    });
    var uniqMatched = matched.filter(function(c, i, a) { return a.indexOf(c) === i; });
    if (!uniqMatched.length) return [];
    if (uniqMatched.length >= uniqAll.length) return null;
    return uniqMatched;
}

// ── Helpers fecha ─────────────────────────────────────────────────────────
function trzParseFechaEs(s) {
    if (!s) return '';
    s = String(s).trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[1]).padStart(2,'0');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return '';
}
function trzLocalYmd(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── Período → rango de fechas ─────────────────────────────────────────────
function trzGetRangoTab1() {
    var tipo = (document.getElementById('trz-periodoTipo')||{}).value || 'ENTRE_FECHAS';
    var hoy  = new Date();
    if (tipo === 'TODOS') return null;
    if (tipo === 'POR_FECHA') {
        var fu = trzParseFechaEs((document.getElementById('trz-fechaUnica')||{}).value);
        return fu ? { desde: fu, hasta: fu } : null;
    }
    if (tipo === 'ENTRE_FECHAS') {
        var fi = trzParseFechaEs((document.getElementById('trz-fechaInicio')||{}).value);
        var ff = trzParseFechaEs((document.getElementById('trz-fechaFin')||{}).value);
        return (fi && ff) ? { desde: fi, hasta: ff } : null;
    }
    if (tipo === 'POR_MES') {
        var mu = ((document.getElementById('trz-mesUnico')||{}).value||'').trim();
        if (!/^\d{4}-\d{2}$/.test(mu)) return null;
        var p = mu.split('-');
        var last = new Date(+p[0], +p[1], 0);
        return { desde: mu+'-01', hasta: trzLocalYmd(last) };
    }
    if (tipo === 'ENTRE_MESES') {
        var mi = ((document.getElementById('trz-mesInicio')||{}).value||'').trim();
        var mf = ((document.getElementById('trz-mesFin')||{}).value||'').trim();
        if (!/^\d{4}-\d{2}$/.test(mi)||!/^\d{4}-\d{2}$/.test(mf)) return null;
        var pm = mf.split('-');
        var lastDay = new Date(+pm[0], +pm[1], 0);
        return { desde: mi+'-01', hasta: trzLocalYmd(lastDay) };
    }
    if (tipo === 'ULTIMA_SEMANA') {
        var d7 = new Date(hoy); d7.setDate(hoy.getDate()-6);
        return { desde: trzLocalYmd(d7), hasta: trzLocalYmd(hoy) };
    }
    return null;
}

// ── Mostrar/ocultar campos de período (filtro global) ────────────────────
function trzOnPeriodoChange() {
    var tipo = (document.getElementById('trz-periodoTipo')||{}).value||'';
    var ids  = ['trz-periodoPorFecha','trz-periodoEntreFechas','trz-periodoPorMes','trz-periodoEntreMeses'];
    // displays usados al mostrar cada bloque (flex para los de dos inputs, block para los simples)
    var flex = { 'trz-periodoEntreFechas': 'flex', 'trz-periodoEntreMeses': 'flex' };
    ids.forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
    var target = null;
    if      (tipo==='POR_FECHA')    target='trz-periodoPorFecha';
    else if (tipo==='ENTRE_FECHAS') target='trz-periodoEntreFechas';
    else if (tipo==='POR_MES')      target='trz-periodoPorMes';
    else if (tipo==='ENTRE_MESES')  target='trz-periodoEntreMeses';
    if (target) {
        var e = document.getElementById(target);
        if (e) e.style.display = flex[target] || 'block';
    }
}

// ── flatpickr ─────────────────────────────────────────────────────────────
function trzInitFpFechas() {
    if (typeof flatpickr === 'undefined') return;
    trzFpFechas.forEach(function(fp){ try{fp.destroy();}catch(e){} });
    trzFpFechas = [];
    var loc = (flatpickr.l10ns&&flatpickr.l10ns.es) ? flatpickr.l10ns.es : {};
    ['trz-fechaUnica','trz-fechaInicio','trz-fechaFin'].forEach(function(id){
        var el = document.getElementById(id);
        if (!el) return;
        trzFpFechas.push(flatpickr(el,{
            locale:loc, dateFormat:'d/m/Y', allowInput:true,
            clickOpens:true, appendTo:document.body, disableMobile:true,
        }));
    });
}
function trzInitFpMes() {
    if (typeof flatpickr==='undefined'||typeof monthSelectPlugin==='undefined') return;
    trzFpMes.forEach(function(fp){ try{fp.destroy();}catch(e){} });
    trzFpMes = [];
    var loc = (flatpickr.l10ns&&flatpickr.l10ns.es) ? flatpickr.l10ns.es : {};
    var isDark = trzIsDark();
    var plugOpts = { shorthand:false, dateFormat:'Y-m', altFormat:'F Y', theme:isDark?'dark':'light' };
    var altCls = 'hc-per-input hc-fp-mes-alt';
    var d = new Date();
    var pad = function(n){ return String(n).padStart(2,'0'); };
    var curYm = d.getFullYear()+'-'+pad(d.getMonth()+1);
    [['trz-mesUnico',curYm],['trz-mesInicio',d.getFullYear()+'-01'],['trz-mesFin',d.getFullYear()+'-12']].forEach(function(pair){
        var id=pair[0], fallback=pair[1];
        var el=document.getElementById(id);
        if(!el) return;
        var v=String(el.value||'').trim();
        var def=(/^\d{4}-\d{2}$/.test(v))?v:fallback;
        trzFpMes.push(flatpickr(el,{
            locale:loc, plugins:[monthSelectPlugin(plugOpts)],
            altInput:true, altInputClass:altCls, dateFormat:'Y-m',
            altFormat:'F Y', defaultDate:def,
            minDate:new Date(d.getFullYear()-8,0,1),
            maxDate:new Date(d.getFullYear()+3,11,31),
            disableMobile:true, allowInput:false, clickOpens:true, appendTo:document.body,
        }));
    });
}

// ── Spinner ───────────────────────────────────────────────────────────────
function trzSpinner(n, show) {
    var el = document.getElementById('trz-spinner'+n);
    if (!el) return;
    el.classList.toggle('hc-hidden', !show);
}

// ── Origen (TODOS / GRS / EXTERNO / TRASPATIO) ───────────────────────────
function trzGetOrigen() {
    return (document.getElementById('trz-sel-origen') || {}).value || 'GRS';
}
function trzGetCodOrigen() {
    return (document.getElementById('trz-sel-cod-origen') || {}).value || '';
}

function trzOnOrigenChange(origen) {
    var fieldGranjas  = document.getElementById('trz-field-granjas');
    var fieldExt      = document.getElementById('trz-field-origen-ext');
    var labelExt      = document.getElementById('trz-label-origen-ext');
    var esTODOS = (origen === 'TODOS');
    var esGRS   = (origen === 'GRS');
    if (fieldGranjas) fieldGranjas.style.display = esGRS ? '' : 'none';
    if (fieldExt)     fieldExt.style.display     = (esGRS || esTODOS) ? 'none' : '';
    if (labelExt)     labelExt.innerHTML =
        '<i class="fas fa-tag mr-1" style="color:#3b82f6"></i>'
        + (origen === 'EXTERNO' ? 'Externo' : 'Traspatio');
    if (!esGRS && !esTODOS) trzCargarCodigosOrigen(origen);
    // Resetear selección de granjas al cambiar origen
    trzGranjasSeleccionadas = [];
    trzActualizarLabelsGranja();
    trzAplicarFiltroGlobal();
}

function trzCargarCodigosOrigen(tipo) {
    var sel = document.getElementById('trz-sel-cod-origen');
    if (!sel) return;
    sel.innerHTML = '<option value="">Cargando…</option>';
    $.getJSON(TRZ_API.origenAves, { tipo: tipo }, function(rows) {
        sel.innerHTML = '<option value="">Todos</option>';
        (rows || []).forEach(function(r) {
            sel.innerHTML += '<option value="' + trzEscHtml(r.codigo) + '">'
                + trzEscHtml(r.codigo) + '</option>';
        });
    }).fail(function() {
        sel.innerHTML = '<option value="">Error al cargar</option>';
    });
}

function trzGetOrigenParams() {
    var origen    = trzGetOrigen();
    var codOrigen = trzGetCodOrigen();
    var params    = { origen: origen };
    if (origen === 'GRS') {
        if (trzGranjasSeleccionadas && trzGranjasSeleccionadas.length) {
            params['granja[]'] = trzGranjasSeleccionadas;
        }
    } else if (codOrigen) {
        params.codOrigen = codOrigen;
    }
    return params;
}

// ── Aplicar filtro global (recarga ambas pestañas) ────────────────────────
function trzAplicarFiltroGlobal() {
    trzTab1Loaded = false;
    trzTab2Loaded = false;
    trzTab3Loaded = false;
    trzTab4Loaded = false;
    trzDetalleCacheKey = '';
    trzCodRefCacheKey = '';
    trzDataDetalle = null;
    trzDataCodRef = null;
    trzDataReporte = null;
    trzDataEnfermedades = null;
    trzSelectedReport = null;
    trzDataAnalisisFiltro = null;
    trzAnalisisFiltroKey = '';
    trzActualizarLabelAnalisisGlobal();
    trzCargarTab1();
    trzCargarTab2();
    if (trzActiveTab === 3) trzCargarReporte();
    if (trzActiveTab === 4) trzCargarReporteEnfermedades();
}

// ── Actualiza el label del botón de análisis global según la pestaña activa ─
function trzActualizarLabelAnalisisGlobal() {
    var lbl = document.getElementById('trz-label-sel-global');
    if (!lbl) return;
    var sel;
    if (trzActiveTab === 2) sel = trzSelected2;
    else if (trzActiveTab === 3 || trzActiveTab === 4) sel = trzSelectedReport;
    else sel = trzSelected1;
    if (sel === null || sel === undefined) {
        lbl.textContent = 'Todos los análisis';
    } else if (sel.length === 0) {
        lbl.textContent = 'Ningún análisis';
    } else {
        lbl.textContent = sel.length + ' análisis';
    }
}

function trzFetchAnalisisFiltro(done) {
    var params = trzBuildDetalleParams();
    var key = JSON.stringify(params);
    if (key === trzAnalisisFiltroKey && trzDataAnalisisFiltro) {
        if (typeof done === 'function') done();
        return;
    }
    $.post(TRZ_API.analisisFiltro, params, function(resp) {
        trzDataAnalisisFiltro = (resp && resp.items) ? resp.items : [];
        trzAnalisisFiltroKey = key;
        if (typeof done === 'function') done();
    }, 'json').fail(function() {
        trzDataAnalisisFiltro = [];
        trzAnalisisFiltroKey = key;
        if (typeof done === 'function') done();
    });
}

function trzOpenDialogAnalisisGlobal() {
    if (trzActiveTab === 2) {
        trzFetchAnalisisFiltro(function() { trzOpenDialog(2); });
        return;
    }
    if (trzActiveTab === 3 || trzActiveTab === 4) {
        trzFetchAnalisisFiltro(function() { trzOpenDialog(3); });
        return;
    }
    trzFetchAnalisisFiltro(function() { trzOpenDialog(1); });
}

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.trz-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var tabId = this.getAttribute('data-tab');
        document.querySelectorAll('.trz-tab').forEach(function(b) {
            b.classList.remove('trz-tab-active');
        });
        document.querySelectorAll('.trz-tab-panel').forEach(function(p) {
            p.classList.remove('trz-panel-active');
        });
        this.classList.add('trz-tab-active');
        var panel = document.getElementById(tabId);
        if (panel) panel.classList.add('trz-panel-active');

        if (tabId === 'tab-periodo') {
            trzActiveTab = 1;
            trzOnTabGraficos();
            trzActualizarLabelAnalisisGlobal();
            trzRefreshTablaResumen();
        }
        if (tabId === 'tab-porcentaje') {
            trzActiveTab = 2;
            trzOnTabGraficos();
            trzActualizarLabelAnalisisGlobal();
            if (!trzTab2Loaded) trzCargarTab2();
            else trzRefreshTablaResumen();
        }
        if (tabId === 'tab-reporte') {
            trzOnTabReporte();
        }
        if (tabId === 'tab-enfermedades') {
            trzOnTabEnfermedades();
        }
    });
});

// ── Dialogs de análisis ───────────────────────────────────────────────────
function trzOpenDialog(n) {
    var dlg = document.getElementById('trz-dialog-'+n);
    if (!dlg) return;
    trzRenderDialog(n);
    dlg.showModal();
}
function trzCloseDialog(n) {
    var dlg = document.getElementById('trz-dialog-'+n);
    if (dlg) dlg.close();
}
function trzRenderDialog(n) {
    var body = document.getElementById('trz-dialog-body-'+n);
    if (!body) return;
    var selected = n === 1 ? trzSelected1 : (n === 2 ? trzSelected2 : trzSelectedReport);
    var items = [];
    if (trzDataAnalisisFiltro && trzDataAnalisisFiltro.length) {
        items = trzDataAnalisisFiltro.map(function(it) {
            return {
                cod: it.cod,
                nom: it.nom,
                paquete: it.paquete || '',
                paqueteNom: it.paqueteNom || ''
            };
        });
    } else if (n === 1 && trzDataTab1 && trzDataTab1.analisis) {
        items = trzDataTab1.analisis.map(function(a){ return { cod: a.cod, nom: a.nom, paquete: '', paqueteNom: '' }; });
    } else if (n === 2 && trzDataTab2 && trzDataTab2.items) {
        items = trzDataTab2.items.map(function(it){ return { cod: it.cod, nom: it.nom, paquete: it.paquete || '', paqueteNom: it.paqueteNom || '' }; });
    }
    if (!items.length) {
        body.innerHTML = '<span style="color:var(--trz-text-muted);font-size:.82rem">Sin análisis disponibles</span>';
        return;
    }

    items.sort(function(a, b){ return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' }); });

    var searchId = 'trz-dialog-search-' + n;
    var masterId = 'trz-chk-master-' + n;
    var checkboxesHtml = '';

    if (n === 2) {
        var grupos = {};
        var orden  = [];
        items.forEach(function(it) {
            var key = it.paqueteNom || '(Sin paquete)';
            if (!grupos[key]) { grupos[key] = []; orden.push(key); }
            grupos[key].push(it);
        });
        orden.forEach(function(key) {
            checkboxesHtml += '<div class="trz-dialog-pkg-header">' + trzEscHtml(key) + '</div>';
            checkboxesHtml += grupos[key].map(function(it) {
                var chk    = (selected === null || trzItemEnSeleccionAnalisis(it, selected)) ? ' checked' : '';
                var codEsc = trzEscHtml(trzNormCod(it.cod));
                var nomEsc = trzEscHtml(it.nom);
                return '<label><input type="checkbox" class="trz-dialog-item-chk" value="'+codEsc+'"'+chk+'> '+nomEsc+'</label>';
            }).join('');
        });
    } else {
        checkboxesHtml = items.map(function(it) {
            var chk    = (selected === null || trzItemEnSeleccionAnalisis(it, selected)) ? ' checked' : '';
            var codEsc = trzEscHtml(trzNormCod(it.cod));
            var nomEsc = trzEscHtml(it.nom);
            return '<label><input type="checkbox" class="trz-dialog-item-chk" value="'+codEsc+'"'+chk+'> '+nomEsc+'</label>';
        }).join('');
    }

    var allOn = (selected === null);
    body.innerHTML =
        '<label class="trz-dialog-master-row" for="'+masterId+'">'
      + '<input type="checkbox" id="'+masterId+'"' + (allOn ? ' checked' : '') + '> Marcar / desmarcar todos'
      + '</label>'
      + '<input type="search" id="'+searchId+'" class="trz-dialog-search" placeholder="Buscar análisis…">'
      + checkboxesHtml;

    var masterEl = document.getElementById(masterId);
    if (masterEl) {
        masterEl.addEventListener('change', function() {
            body.querySelectorAll('input.trz-dialog-item-chk').forEach(function(cb) { cb.checked = masterEl.checked; });
        });
    }

    var searchEl = document.getElementById(searchId);
    if (searchEl) {
        searchEl.addEventListener('input', function() {
            var q = this.value.toLowerCase();
            body.querySelectorAll('label:not(.trz-dialog-master-row)').forEach(function(lbl) {
                if (!lbl.querySelector || !lbl.querySelector('.trz-dialog-item-chk')) return;
                lbl.style.display = lbl.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
            });
            body.querySelectorAll('.trz-dialog-pkg-header').forEach(function(hdr) {
                var next = hdr.nextElementSibling;
                var hasVisible = false;
                while (next && !next.classList.contains('trz-dialog-pkg-header')) {
                    if (next.style.display !== 'none') { hasVisible = true; break; }
                    next = next.nextElementSibling;
                }
                hdr.style.display = hasVisible ? '' : 'none';
            });
        });
        searchEl.value = '';
    }
}
function trzApplyDialog(n) {
    var body = document.getElementById('trz-dialog-body-'+n);
    if (!body) return;
    var itemBoxes = body.querySelectorAll('input.trz-dialog-item-chk[type="checkbox"]');
    var checked = [];
    itemBoxes.forEach(function(cb){ if (cb.checked) checked.push(cb.value); });
    var total = itemBoxes.length;
    var normChecked = checked.map(trzNormCod);
    if (checked.length === total) {
        if (n === 1) trzSelected1 = null;
        else if (n === 2) trzSelected2 = null;
        else trzSelectedReport = null;
    } else if (checked.length === 0) {
        if (n === 1) trzSelected1 = [];
        else if (n === 2) trzSelected2 = [];
        else trzSelectedReport = [];
    } else {
        if (n === 1) trzSelected1 = normChecked;
        else if (n === 2) trzSelected2 = normChecked;
        else trzSelectedReport = normChecked;
    }
    trzActualizarLabelAnalisisGlobal();
    trzCloseDialog(n);
    if (n === 1 && trzDataTab1) trzDibujarChart1();
    if (n === 2 && trzDataTab2) trzDibujarChart2();
    if (n === 3) {
        trzTab3Loaded = false;
        trzTab4Loaded = false;
        trzDataReporte = null;
        trzDataEnfermedades = null;
        if (trzActiveTab === 3) trzCargarReporte();
        if (trzActiveTab === 4) trzCargarReporteEnfermedades();
    }
    trzRefreshTablaResumen();
}
// Cerrar dialog al clic en backdrop
document.querySelectorAll('.trz-dialog').forEach(function(dlg){
    dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
});

function trzFindDetalleAnalisis(cod, nom) {
    if (!trzDataDetalle || !trzDataDetalle.analisis) return null;
    var i, a;
    var codN = trzNormCod(cod);
    for (i = 0; i < trzDataDetalle.analisis.length; i++) {
        a = trzDataDetalle.analisis[i];
        if (codN && trzNormCod(a.cod) === codN) return a;
    }
    for (i = 0; i < trzDataDetalle.analisis.length; i++) {
        a = trzDataDetalle.analisis[i];
        if (a.nom === nom) return a;
    }
    return null;
}

/** Suma en el período (serie mensual agregada) de un resultado para un ítem Tab 2 */
function trzSumResultadoPeriodoItem(it, resLabel) {
    var d = trzFindDetalleAnalisis(it.cod, it.nom);
    if (!d || !d.resultados) return 0;
    var sum = 0;
    d.resultados.forEach(function(r) {
        if (r.resultado !== resLabel) return;
        (r.data || []).forEach(function(v) { sum += (v || 0); });
    });
    return sum;
}

function trzEsResultadoNegativo(res) {
    return String(res || '').toUpperCase().trim() === 'NEGATIVO';
}

/** Vacío / NULL en BD llega como "(Sin resultado)" en get_analisis_detalle */
function trzEsSinResultadoLabel(res) {
    var n = String(res || '').trim().toUpperCase().replace(/\s+/g, ' ');
    return n === '(SIN RESULTADO)' || n === 'SIN RESULTADO';
}

function trzResultadoOcultoEnGraficos(res) {
    return trzEsResultadoNegativo(res) || trzEsSinResultadoLabel(res);
}

function trzFiltrarResultadosGraficos(resultados) {
    return (resultados || []).filter(function(r) {
        return !trzResultadoOcultoEnGraficos(r.resultado);
    });
}

/** Al menos un conteo en la serie principal (no NEG, no sin resultado), según get_analisis_periodo */
function trzAnalisisConResultadosValidosVisibles(a) {
    var pos = (a.data || []).reduce(function(s, v) { return s + (v || 0); }, 0);
    return pos > 0;
}

function trzTintHexAlpha(base, alphaHex2) {
    var s = String(base || '');
    var m = s.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
    if (!m) return base;
    return '#' + m[1] + String(alphaHex2 || 'ff').slice(0, 2);
}
/** Relleno semitransparente (#rrggbb + canal alfa 00–ff). */
function trzBarFillRgb(baseHex, alphaHex2) {
    var h = String(baseHex || '').replace(/^#/, '');
    if (!/^[0-9a-fA-F]{6}$/i.test(h)) return 'rgba(100,116,139,0.45)';
    return '#' + h.toLowerCase() + String(alphaHex2 || '88').slice(0, 2);
}

/** Resalta en el gráfico de desglose todas las barras del mismo índice (mes). */
function trzApplyDetalleHoverIndex(detChart, index) {
    if (!detChart || !detChart.data || !detChart.data.datasets) return;
    detChart.data.datasets.forEach(function(ds) {
        var bases = ds._trzBaseBg;
        if (!bases || !bases.length) return;
        ds.backgroundColor = bases.map(function(base, j) {
            if (index === null) return base;
            return j === index ? trzTintHexAlpha(base, 'ff') : trzTintHexAlpha(base, '3a');
        });
        ds.borderWidth = ds.data.map(function(_, j) {
            return (index !== null && j === index) ? 3 : 1;
        });
    });
    detChart.update('none');
}

function trzBuildDetalleParams() {
    var rango = trzGetRangoTab1();
    var params = trzGetOrigenParams();
    if (rango) { params.fechaInicio = rango.desde; params.fechaFin = rango.hasta; }
    if (trzTipoMuestraActual) params.tipoMuestra = trzTipoMuestraActual;
    return params;
}

function trzFetchDetalle(done) {
    var params = trzBuildDetalleParams();
    var key = JSON.stringify(params);
    if (key === trzDetalleCacheKey && trzDataDetalle) {
        if (typeof done === 'function') done();
        return;
    }
    $.post(TRZ_API.analisisDetalle, params, function(resp) {
        if (resp && resp.analisis) {
            trzDataDetalle = resp;
            trzDetalleCacheKey = key;
        } else {
            trzDataDetalle = { meses: [], etiquetas: [], analisis: [] };
            trzDetalleCacheKey = key;
        }
        if (typeof done === 'function') done();
    }, 'json').fail(function() {
        trzDataDetalle = { meses: [], etiquetas: [], analisis: [] };
        trzDetalleCacheKey = key;
        if (typeof done === 'function') done();
    });
}

function trzFetchCodRef(done) {
    var params = trzBuildDetalleParams();
    var key = JSON.stringify(params);
    if (key === trzCodRefCacheKey && trzDataCodRef) {
        if (typeof done === 'function') done();
        return;
    }
    $.post(TRZ_API.analisisCodRef, params, function(resp) {
        if (resp && resp.analisis) {
            trzDataCodRef = resp;
            trzCodRefCacheKey = key;
        } else {
            trzDataCodRef = { meses: [], etiquetas: [], analisis: [], formato: {} };
            trzCodRefCacheKey = key;
        }
        if (typeof done === 'function') done();
    }, 'json').fail(function() {
        trzDataCodRef = { meses: [], etiquetas: [], analisis: [], formato: {} };
        trzCodRefCacheKey = key;
        if (typeof done === 'function') done();
    });
}

function trzFetchTab1Extras(done) {
    var pending = 2;
    function tick() {
        pending--;
        if (pending <= 0 && typeof done === 'function') done();
    }
    trzFetchDetalle(tick);
    trzFetchCodRef(tick);
}

function trzFindCodrefAnalisis(cod, nom) {
    if (!trzDataCodRef || !trzDataCodRef.analisis) return null;
    var i, row;
    var codN = trzNormCod(cod);
    for (i = 0; i < trzDataCodRef.analisis.length; i++) {
        row = trzDataCodRef.analisis[i];
        if (codN && trzNormCod(row.cod) === codN) return row;
    }
    for (i = 0; i < trzDataCodRef.analisis.length; i++) {
        row = trzDataCodRef.analisis[i];
        if (row.nom === nom) return row;
    }
    return null;
}

function trzNormResultadoKey(res) {
    var s = String(res || '').trim().toUpperCase().replace(/\s+/g, ' ');
    return s || '(SIN RESULTADO)';
}

function trzFindCodrefResultadoBlock(crRow, resKey) {
    if (!crRow || !crRow.resultados) return null;
    var k = trzNormResultadoKey(resKey);
    var i, b;
    for (i = 0; i < crRow.resultados.length; i++) {
        b = crRow.resultados[i];
        if (trzNormResultadoKey(b.resultado) === k) return b;
    }
    return null;
}

/** Orden de pestañas = misma que gráfica 2 (solo resultados con codRef). */
function trzCodRefTabsFromDetalle(crRow, resFiltrados) {
    var tabs = [];
    var seen = {};
    (resFiltrados || []).forEach(function(r) {
        var key = trzNormResultadoKey(r.resultado);
        if (seen[key]) return;
        var block = trzFindCodrefResultadoBlock(crRow, key);
        if (!block || !block.refs || !block.refs.length) return;
        seen[key] = true;
        tabs.push({
            key: key,
            label: String(r.resultado || key),
            block: block,
        });
    });
    if (!tabs.length && crRow && crRow.resultados) {
        crRow.resultados.forEach(function(b) {
            var key = trzNormResultadoKey(b.resultado);
            if (!b.refs || !b.refs.length || seen[key]) return;
            seen[key] = true;
            tabs.push({ key: key, label: String(b.resultado || key), block: b });
        });
    }
    return tabs;
}

function trzPickDefaultCodrefKey(tabs, resFiltrados) {
    if (!tabs.length) return '';
    var stored = '';
    return tabs[0].key;
}

function trzShortResLabel(lbl, max) {
    var s = String(lbl || '');
    max = max || 28;
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
}

/** Cabecera HTML alineada entre las 3 gráficas de Tab 1. */
function trzCreateChartPanelHead(titleText, subtitleText) {
    var head = document.createElement('div');
    head.className = 'trz-chart-panel-head';
    var titleEl = document.createElement('p');
    titleEl.className = 'trz-chart-panel-title';
    titleEl.textContent = titleText || '';
    head.appendChild(titleEl);
    var subtitleEl = null;
    if (subtitleText) {
        subtitleEl = document.createElement('p');
        subtitleEl.className = 'trz-chart-panel-subtitle';
        subtitleEl.textContent = subtitleText;
        head.appendChild(subtitleEl);
    }
    return { head: head, subtitleEl: subtitleEl };
}

var TRZ_GRANJA_ABREV = {
    '627': 'SG', '621': 'ST', '644': 'REN', '642': 'SL', '667': 'TUC', '664': 'VENT',
    '663': 'T ESP', '661': 'PON I', '637': 'JM II', '636': 'JM I', '635': 'GDA V',
    '634': 'GDA IV', '666': 'T NOS', '665': 'TNUE', '662': 'PON II', '628': 'GL I',
    '623': 'GL II', '625': 'GL III', '643': 'VCH', '632': 'GDA III', '630': 'GDA I',
    '631': 'GDA II'
};

/** Granja = 3 primeros dígitos (igual que ../../backend/trazabilidad/analisis-codref). */
function trzLabelCodRefDisplay(codRef, apiLabel) {
    var t = String(codRef || '').replace(/\s+/g, '');
    if (!t) return String(apiLabel || '');
    var lbl = String(apiLabel || '');
    if (lbl.indexOf(' \u00b7 ') >= 0 && lbl.indexOf(t) >= 0) return lbl;

    var abrev = t.length >= 3 ? (TRZ_GRANJA_ABREV[t.substr(0, 3)] || '') : '';
    if (abrev) return abrev + ' \u00b7 ' + t;
    return lbl || t;
}

/** Alinea data[] de la API codRef al eje de meses de la gráfica 1 (misma X en las 3 gráficas). */
function trzAlignDataToMeses(data, srcMeses, tgtMeses) {
    data = data || [];
    srcMeses = srcMeses || [];
    tgtMeses = tgtMeses || [];
    if (!tgtMeses.length) return data.slice();
    var same = srcMeses.length === tgtMeses.length;
    if (same) {
        for (var k = 0; k < tgtMeses.length; k++) {
            if (srcMeses[k] !== tgtMeses[k]) { same = false; break; }
        }
    }
    if (same) {
        var out = data.slice();
        while (out.length < tgtMeses.length) out.push(0);
        return out.length > tgtMeses.length ? out.slice(0, tgtMeses.length) : out;
    }
    var byMes = {};
    srcMeses.forEach(function(m, ix) { byMes[m] = Number(data[ix]) || 0; });
    return tgtMeses.map(function(m) { return byMes[m] != null ? byMes[m] : 0; });
}

function trzDibujarChart1CodRef(canvasWrap, tabs, resKey, i, etiquetas, palette, opts) {
    if (!canvasWrap) return null;
    var isDark    = opts.isDark;
    var textCol   = opts.textCol;
    var gridCol   = opts.gridCol;
    var tab1PadDet = opts.tab1PadDet;
    var tab1SubPad = opts.tab1SubPad;
    var barAnim   = opts.barAnim;
    var fillA     = opts.fillA;
    var yMaxGlobal = opts.yMax;
    var nomAnalisis = opts.nomAnalisis || '';
    var accentColor = opts.accentColor || '#3b82f6';

    var tab = null;
    var j;
    for (j = 0; j < tabs.length; j++) {
        if (tabs[j].key === resKey) { tab = tabs[j]; break; }
    }
    if (!tab && tabs.length) tab = tabs[0];

    canvasWrap.innerHTML = '';
    if (!tab || !tab.block || !tab.block.refs || !tab.block.refs.length) {
        canvasWrap.innerHTML = '<p style="color:var(--trz-text-muted);font-size:.78rem;padding:1rem;text-align:center">'
            + 'Sin codRef para este resultado.</p>';
        return null;
    }

    var refs = tab.block.refs;
    var canvas = document.createElement('canvas');
    canvasWrap.appendChild(canvas);

    var tgtMeses = opts.targetMeses || (trzDataTab1 && trzDataTab1.meses) || [];
    var srcMeses = opts.codRefMeses || (trzDataCodRef && trzDataCodRef.meses) || tgtMeses;
    var mesN = etiquetas.length;
    if (tgtMeses.length && tgtMeses.length !== mesN) {
        mesN = tgtMeses.length;
    }
    var yMax = 1;
    var dsCod = refs.map(function(refRow, j) {
        var c = trzPaletteDetColor(palette, j + 1);
        var raw = trzAlignDataToMeses(refRow.data, srcMeses, tgtMeses.length ? tgtMeses : srcMeses);
        while (raw.length < mesN) raw.push(0);
        if (raw.length > mesN) raw = raw.slice(0, mesN);
        raw.forEach(function(v) { yMax = Math.max(yMax, Number(v) || 0); });
        var lbl = trzLabelCodRefDisplay(refRow.codRef, refRow.label);
        var normals = raw.map(function() { return trzBarFillRgb(c, fillA); });
        return {
            label: lbl,
            codRef: refRow.codRef || '',
            data: raw,
            _trzBaseBg: normals.slice(),
            backgroundColor: normals.slice(),
            borderColor: c,
            borderWidth: 2,
            borderRadius: 5,
            borderSkipped: false,
        };
    });
    yMax = Math.max(1, Math.ceil(Math.max(yMax, yMaxGlobal * 0.35) * 1.15));

    var ch = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: etiquetas, datasets: dsCod },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: barAnim,
            interaction: { mode: 'nearest', axis: 'xy', intersect: false },
            datasets: { bar: { categoryPercentage: 0.72, barPercentage: 0.92 } },
            plugins: {
                title: { display: false },
                legend: {
                    display: true,
                    position: 'bottom',
                    align: 'center',
                    labels: {
                        color: textCol,
                        boxWidth: 12,
                        font: { size: 10, weight: '500' },
                        padding: 6
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e1e2e' : '#fff',
                    titleColor: isDark ? '#e4e4e7' : '#0f172a',
                    bodyColor: isDark ? '#d4d4d8' : '#334155',
                    borderColor: isDark ? '#52525b' : '#cbd5e1',
                    borderWidth: 1,
                    padding: 10,
                    bodyFont: { size: 11 },
                    callbacks: {
                        title: function(titems) {
                            if (!titems || !titems.length) return '';
                            var ix = titems[0].dataIndex;
                            var mes = etiquetas[ix] != null ? String(etiquetas[ix]) : '';
                            return mes ? ('Período: ' + mes) : 'Período';
                        },
                        afterTitle: function() {
                            var lines = [];
                            if (nomAnalisis) lines.push('Análisis: ' + nomAnalisis);
                            lines.push('Resultado: ' + tab.label);
                            return lines;
                        },
                        label: function(ctx) {
                            var v = ctx.parsed.y;
                            return ' ' + (ctx.dataset.label || ctx.dataset.codRef || '') + ': ' + v;
                        }
                    }
                },
            },
            layout: { padding: tab1PadDet },
            scales: {
                x: {
                    stacked: false,
                    offset: true,
                    ticks: { color: textCol, font: { size: 9 }, maxRotation: 45, minRotation: 0, autoSkip: false },
                    grid: { color: gridCol, drawBorder: false }
                },
                y: {
                    beginAtZero: true,
                    max: yMax,
                    grace: 0,
                    ticks: { color: textCol, font: { size: 10 }, precision: 0 },
                    grid: { color: gridCol, drawBorder: false }
                }
            }
        }
    });
    return ch;
}

function trzRefreshChart1CodRefPanel(cardKey, i) {
    var ui = trzCodRefUiByCard[cardKey];
    if (!ui || !ui.wrapRef || !ui.canvasWrap) return;
    var resKey = trzCodRefResByCard[cardKey] || '';
    var activeTab = null;
    var t;
    for (t = 0; t < ui.tabs.length; t++) {
        if (ui.tabs[t].key === resKey) { activeTab = ui.tabs[t]; break; }
    }
    if (!activeTab && ui.tabs.length) activeTab = ui.tabs[0];
    if (ui.subtitleEl) {
        ui.subtitleEl.textContent = activeTab ? trzShortResLabel(activeTab.label, 36) : '';
    }
    var prev = trzCharts1CodRef[i];
    if (prev) try { prev.destroy(); } catch (eD) {}
    trzCharts1CodRef[i] = trzDibujarChart1CodRef(
        ui.canvasWrap, ui.tabs, resKey, i, ui.etiquetas, ui.palette,
        Object.assign({}, ui.chartOpts, {
            nomAnalisis: ui.nomAnalisis,
            accentColor: ui.accentColor || '#3b82f6',
        })
    );
    if (ui.tabsEl) {
        ui.tabsEl.querySelectorAll('.trz-chart-ref-tab').forEach(function(b) {
            b.classList.toggle('trz-ref-tab-active', b.dataset.resKey === resKey);
        });
    }
}

function trzSetChart1CodRefResultado(cardKey, i, resKey, accentColor) {
    trzCodRefResByCard[cardKey] = trzNormResultadoKey(resKey);
    var ui = trzCodRefUiByCard[cardKey];
    if (ui) ui.accentColor = accentColor || ui.accentColor;
    trzRefreshChart1CodRefPanel(cardKey, i);
}

function trzMountChart1CodRefPanel(wrapRef, cardKey, crRow, resFiltrados, i, etiquetas, palette, chartOpts, nomAnalisis) {
    if (!wrapRef) return;

    var tabs = trzCodRefTabsFromDetalle(crRow, resFiltrados);
    var resAct = trzCodRefResByCard[cardKey];
    var hasAct = false;
    tabs.forEach(function(t) { if (t.key === resAct) hasAct = true; });
    if (!hasAct) {
        resAct = tabs.length ? tabs[0].key : '';
        trzCodRefResByCard[cardKey] = resAct;
    }

    wrapRef.innerHTML = '';
    var activeTab0 = null;
    tabs.forEach(function(t) { if (t.key === resAct) activeTab0 = t; });
    if (!activeTab0 && tabs.length) activeTab0 = tabs[0];
    var head3 = trzCreateChartPanelHead(
        'Desglose por origen',
        activeTab0 ? trzShortResLabel(activeTab0.label, 36) : ''
    );
    wrapRef.appendChild(head3.head);

    if (!tabs.length) {
        var empty = document.createElement('p');
        empty.style.cssText = 'color:var(--trz-text-muted);font-size:.78rem;padding:1rem;text-align:center;flex:1';
        empty.textContent = 'Sin codRef asociados a los resultados visibles.';
        wrapRef.appendChild(empty);
        trzCodRefUiByCard[cardKey] = { wrapRef: wrapRef, tabs: [], canvasWrap: null, tabsEl: null };
        trzCharts1CodRef[i] = null;
        return;
    }

    var tabsEl = document.createElement('div');
    tabsEl.className = 'trz-chart-ref-tabs';
    tabsEl.setAttribute('role', 'tablist');
    tabs.forEach(function(t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trz-chart-ref-tab' + (t.key === resAct ? ' trz-ref-tab-active' : '');
        btn.setAttribute('role', 'tab');
        btn.textContent = trzShortResLabel(t.label, 22);
        btn.title = t.label;
        btn.dataset.resKey = t.key;
        btn.addEventListener('click', function() {
            var col = chartOpts.accentColor || '#3b82f6';
            trzSetChart1CodRefResultado(cardKey, i, t.key, col);
        });
        tabsEl.appendChild(btn);
    });
    wrapRef.appendChild(tabsEl);

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'trz-chart-ref-canvas-wrap';
    wrapRef.appendChild(canvasWrap);

    var accent0 = chartOpts.accentColor || '#3b82f6';
    trzCodRefUiByCard[cardKey] = {
        wrapRef: wrapRef,
        canvasWrap: canvasWrap,
        tabsEl: tabsEl,
        subtitleEl: head3.subtitleEl,
        tabs: tabs,
        etiquetas: etiquetas,
        palette: palette,
        chartOpts: chartOpts,
        nomAnalisis: nomAnalisis,
        accentColor: accent0,
    };

    trzCharts1CodRef[i] = trzDibujarChart1CodRef(
        canvasWrap, tabs, resAct, i, etiquetas, palette,
        Object.assign({}, chartOpts, { nomAnalisis: nomAnalisis, accentColor: accent0 })
    );
}

// ════════════════════════════════════════════════════════════════════════
// TAB 1
// ════════════════════════════════════════════════════════════════════════
function trzCargarTab1() {
    var rango = trzGetRangoTab1();
    var params = trzGetOrigenParams();
    if (rango) { params.fechaInicio = rango.desde; params.fechaFin = rango.hasta; }
    if (trzTipoMuestraActual) params.tipoMuestra = trzTipoMuestraActual;
    trzSpinner(1, true);
    $.post(TRZ_API.analisisPeriodo, params, function(resp){
        trzSpinner(1, false);
        if (resp && resp.analisis) {
            trzDataTab1 = resp;
            trzSelected1 = trzReconciliarSeleccionAnalisis(trzSelected1, resp.analisis);
            trzActualizarLabelAnalisisGlobal();
            trzFetchTab1Extras(function() { trzDibujarChart1(); });
            trzTab1Loaded = true;
        }
    }, 'json').fail(function(){
        trzSpinner(1, false);
    });
}

function trzDibujarChart1() {
    if (!trzDataTab1) return;
    var palette  = trzPalette();
    var isDark   = trzIsDark();
    var textCol  = isDark ? '#a1a1aa' : '#475569';
    var gridCol  = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
    var selected = trzSelected1;

    var mesesTab1 = trzDataTab1.meses || [];
    var etiquetas = trzDataTab1.etiquetas || mesesTab1;
    var mesesCodRef = (trzDataCodRef && trzDataCodRef.meses) ? trzDataCodRef.meses : mesesTab1;
    var analisis  = (trzDataTab1.analisis || []).filter(function(a){
        return trzItemEnSeleccionAnalisis(a, selected) && trzAnalisisConResultadosValidosVisibles(a);
    });

    // Orden alfabético por nombre
    analisis.sort(function(a, b){ return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' }); });

    // Destruir gráficas anteriores
    trzCharts1.forEach(function(ch){ try{ ch.destroy(); }catch(e){} });
    trzCharts1 = [];
    trzCharts1Det.forEach(function(ch){ if (ch) try{ ch.destroy(); }catch(e){} });
    trzCharts1Det = [];
    trzCharts1CodRef.forEach(function(ch){ if (ch) try{ ch.destroy(); }catch(e){} });
    trzCharts1CodRef = [];

    var grid = document.getElementById('trz-charts1-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!analisis.length) {
        grid.innerHTML = '<p style="color:var(--trz-text-muted);font-size:.875rem;padding:.5rem 0">Sin datos para el período seleccionado.</p>';
        trzRefreshTablaResumen();
        return;
    }

    /** Misma altura para temporal y desglose → eje X alineado */
    var tab1ChartPairHeight = 420;
    var tab1PadBottom = 78;
    /** Títulos fuera del canvas; padding reducido para alinear ejes X */
    var tab1PadTop = 28;
    var tab1PadDet = { top: tab1PadTop, bottom: tab1PadBottom, left: 16, right: 14 };
    var tab1PadMain = { top: tab1PadTop, bottom: tab1PadBottom, left: 16, right: 14 };
    var tab1SubPad = { top: 4, bottom: 10 };
    var barAnim = {
        duration: 780,
        easing: 'easeOutQuart',
        delay: function(ctx) {
            return ((ctx.dataIndex || 0) * 34) + ((typeof ctx.datasetIndex === 'number' ? ctx.datasetIndex : 0) * 22);
        }
    };
    var fillA = isDark ? '99' : 'a3';
    var chartOptsBase = {
        isDark: isDark,
        textCol: textCol,
        gridCol: gridCol,
        tab1PadDet: tab1PadDet,
        tab1SubPad: tab1SubPad,
        barAnim: barAnim,
        fillA: fillA,
        yMax: 1
    };

    // Una card por análisis: temporal | desglose resultado | codRef
    analisis.forEach(function(a, i) {
        var col    = palette[i % palette.length];
        var canvId = 'trz-chart1-' + i;
        var pctData = a.pct || [];
        var detRow = trzFindDetalleAnalisis(a.cod, a.nom);
        var resFiltrados = detRow ? trzFiltrarResultadosGraficos(detRow.resultados) : [];

        var yMax = 1;
        (a.data || []).forEach(function(v) { yMax = Math.max(yMax, Number(v) || 0); });
        resFiltrados.forEach(function(r) {
            (r.data || []).forEach(function(v) { yMax = Math.max(yMax, Number(v) || 0); });
        });
        yMax = Math.max(1, Math.ceil(yMax * 1.15));

        var card = document.createElement('div');
        card.className = 'trz-chart-card';

        var titleDiv = document.createElement('div');
        titleDiv.className = 'trz-chart-title';
        titleDiv.innerHTML = '<span style="display:inline-block;width:.55rem;height:.55rem;border-radius:50%;background:' + col + ';margin-right:.35rem"></span>'
            + trzEscHtml(a.nom);
        card.appendChild(titleDiv);

        var split = document.createElement('div');
        split.className = 'trz-chart-row-split';

        var wrap = document.createElement('div');
        wrap.className = 'trz-chart-wrap';
        wrap.style.height = tab1ChartPairHeight + 'px';
        wrap.appendChild(trzCreateChartPanelHead('Casos positivos por mes').head);
        var pctBand = document.createElement('div');
        pctBand.className = 'trz-chart-pct-band';
        wrap.appendChild(pctBand);
        var canvasWrapMain = document.createElement('div');
        canvasWrapMain.className = 'trz-chart-canvas-wrap';
        var canvas = document.createElement('canvas');
        canvas.id = canvId;
        canvasWrapMain.appendChild(canvas);
        wrap.appendChild(canvasWrapMain);

        var wrapR = document.createElement('div');
        wrapR.className = 'trz-chart-sub-wrap';
        wrapR.style.height = tab1ChartPairHeight + 'px';
        wrapR.appendChild(trzCreateChartPanelHead('Desglose por resultado').head);
        var canvasWrapDet = document.createElement('div');
        canvasWrapDet.className = 'trz-chart-canvas-wrap';
        wrapR.appendChild(canvasWrapDet);

        var wrapRef = document.createElement('div');
        wrapRef.className = 'trz-chart-ref-wrap';
        wrapRef.style.height = tab1ChartPairHeight + 'px';

        split.appendChild(wrap);
        split.appendChild(wrapR);
        split.appendChild(wrapRef);
        card.appendChild(split);
        grid.appendChild(card);

        var barLabelsPlugin = {
            id: 'trzBarLabels_' + i,
            afterDatasetsDraw: function(chart) {
                var ctx2  = chart.ctx;
                var areaTop = chart.chartArea.top;
                var pctY = areaTop - 14;
                chart.data.datasets.forEach(function(ds, di) {
                    chart.getDatasetMeta(di).data.forEach(function(bar, idx) {
                        var count = ds.data[idx];
                        var pct   = pctData[idx] || 0;
                        ctx2.save();
                        ctx2.textAlign = 'center';
                        ctx2.font = '10px sans-serif';
                        ctx2.fillStyle = textCol;
                        ctx2.textBaseline = 'bottom';
                        ctx2.fillText(pct + '%', bar.x, pctY);
                        if (count) {
                            ctx2.font = 'bold 10px sans-serif';
                            ctx2.fillStyle = textCol;
                            ctx2.textBaseline = 'bottom';
                            ctx2.fillText(count, bar.x, bar.y - 6);
                        }
                        ctx2.restore();
                    });
                });
            }
        };

        var chd = null;

        var ch = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'No negativo',
                    data: a.data,
                    backgroundColor: trzBarFillRgb(col, fillA),
                    borderColor: col,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: barAnim,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: false },
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1e1e2e' : '#fff',
                        titleColor: isDark ? '#e4e4e7' : '#0f172a',
                        bodyColor: isDark ? '#a1a1aa' : '#475569',
                        borderColor: isDark ? '#3f3f46' : '#e2e8f0',
                        borderWidth: 1, padding: 9,
                        callbacks: {
                            label: function(c){
                                var p = pctData[c.dataIndex];
                                return ' No-Neg: ' + c.parsed.y + '  (' + (p||0) + '%)';
                            }
                        }
                    },
                },
                layout: { padding: tab1PadMain },
                scales: {
                    x: {
                        ticks:{ color:textCol, font:{ size:9 }, maxRotation:45, minRotation:0, autoSkip:false },
                        grid:{ color:gridCol, drawBorder:false }
                    },
                    y: { beginAtZero:true, max: yMax, grace: 0, ticks:{color:textCol,font:{size:10},precision:0}, grid:{color:gridCol,drawBorder:false} }
                }
            },
            plugins: [barLabelsPlugin]
        });
        trzCharts1.push(ch);

        if (resFiltrados.length) {
            var canvasDet = document.createElement('canvas');
            canvasDet.id = 'trz-chart1-det-' + i;
            canvasWrapDet.appendChild(canvasDet);
            var mesN = etiquetas.length;
            var dsDet = resFiltrados.map(function(r, j) {
                var c = trzPaletteDetColor(palette, j);
                var lbl = String(r.resultado || '');
                if (lbl.length > 32) lbl = lbl.slice(0, 30) + '…';
                var raw = (r.data || []).slice();
                while (raw.length < mesN) raw.push(0);
                if (raw.length > mesN) raw = raw.slice(0, mesN);
                var fillAlpha = fillA;
                var normals = raw.map(function() {
                    return trzBarFillRgb(c, fillAlpha);
                });
                return {
                    label: lbl,
                    trzResKey: r.resultado,
                    data: raw,
                    _trzBaseBg: normals.slice(),
                    backgroundColor: normals.slice(),
                    borderColor: c,
                    borderWidth: 2,
                    borderRadius: 5,
                    borderSkipped: false,
                };
            });
            var detBarLabelsPlugin = {
                id: 'trzDetBarLabels_' + i,
                afterDatasetsDraw: function(chart) {
                    var ctx2 = chart.ctx;
                    chart.data.datasets.forEach(function(ds, di) {
                        var meta = chart.getDatasetMeta(di);
                        if (meta.hidden) return;
                        meta.data.forEach(function(bar, idx) {
                            var count = ds.data[idx];
                            if (count === null || count === undefined || Number(count) === 0) return;
                            ctx2.save();
                            ctx2.textAlign = 'center';
                            ctx2.font = 'bold 10px sans-serif';
                            ctx2.fillStyle = textCol;
                            ctx2.textBaseline = 'bottom';
                            ctx2.fillText(String(count), bar.x, bar.y - 6);
                            ctx2.restore();
                        });
                    });
                }
            };
            chd = new Chart(canvasDet.getContext('2d'), {
                type: 'bar',
                data: { labels: etiquetas, datasets: dsDet },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: barAnim,
                    /* Tooltip por la barra concreta (no todas las series del mismo mes) */
                    interaction: { mode: 'nearest', axis: 'xy', intersect: false },
                    datasets: {
                        bar: {
                            categoryPercentage: 0.72,
                            barPercentage: 0.92,
                        }
                    },
                    plugins: {
                        title: { display: false },
                        legend: {
                            display: true,
                            position: 'bottom',
                            align: 'center',
                            labels: { color: textCol, boxWidth: 12, font: { size: 9 }, padding: 8 }
                        },
                        tooltip: {
                            backgroundColor: isDark ? '#1e1e2e' : '#fff',
                            titleColor: isDark ? '#e4e4e7' : '#0f172a',
                            bodyColor: isDark ? '#d4d4d8' : '#334155',
                            borderColor: isDark ? '#52525b' : '#cbd5e1',
                            borderWidth: 1,
                            padding: 12,
                            titleMarginBottom: 8,
                            bodySpacing: 6,
                            boxWidth: 10,
                            boxHeight: 10,
                            boxPadding: 4,
                            usePointStyle: true,
                            displayColors: true,
                            caretSize: 8,
                            cornerRadius: 8,
                            callbacks: {
                                title: function(items) {
                                    if (!items || !items.length) return '';
                                    var ix = items[0].dataIndex;
                                    var mes = etiquetas[ix] != null ? String(etiquetas[ix]).trim() : '';
                                    var out = mes ? ('Período: ' + mes) : 'Período';
                                    if (a.nom) {
                                        return [out, 'Análisis: ' + String(a.nom)];
                                    }
                                    return out;
                                },
                                label: function(ctx) {
                                    var v = ctx.parsed.y;
                                    var nomRes = ctx.dataset.label || 'Resultado';
                                    if (v === null || v === undefined) return ' ' + nomRes + ': —';
                                    return ' ' + nomRes + ': ' + v + (v === 1 ? ' caso' : ' casos');
                                }
                            }
                        }
                    },
                    layout: { padding: tab1PadDet },
                    scales: {
                        x: {
                            stacked: false,
                            offset: true,
                            ticks: { color: textCol, font: { size: 9 }, maxRotation: 45, minRotation: 0, autoSkip: false },
                            grid: { color: gridCol, drawBorder: false }
                        },
                        y: {
                            stacked: false,
                            beginAtZero: true,
                            max: yMax,
                            grace: 0,
                            ticks: { color: textCol, font: { size: 10 }, precision: 0 },
                            grid: { color: gridCol, drawBorder: false }
                        }
                    }
                },
                plugins: [detBarLabelsPlugin]
            });
            trzCharts1Det.push(chd);
        } else {
            canvasWrapDet.innerHTML = '<p style="color:var(--trz-text-muted);font-size:.78rem;padding:1rem;text-align:center">Sin desglose por resultado</p>';
            trzCharts1Det.push(null);
        }

        var lastResKeyHover = null;
        ch.options.onHover = function(evt, els, chart) {
            var ix = els && els.length ? els[0].index : null;
            trzApplyDetalleHoverIndex(chd, ix);

            // Sincroniza gráfica 3 (codRef) con el resultado (dataset) hover en gráfica 2.
            var di = els && els.length ? els[0].datasetIndex : null;
            if (di !== null && dsDet && dsDet[di] && dsDet[di].trzResKey) {
                var newKey = dsDet[di].trzResKey;
                if (newKey !== lastResKeyHover) {
                    lastResKeyHover = newKey;
                    trzSetChart1CodRefResultado(cardKey, i, newKey, '#3b82f6');
                }
            }
        };

        var cardKey = trzNormCod(a.cod) || ('nom:' + a.nom);
        var crRow = trzFindCodrefAnalisis(a.cod, a.nom);
        var chartOpts = Object.assign({}, chartOptsBase, {
            yMax: yMax,
            targetMeses: mesesTab1,
            codRefMeses: mesesCodRef
        });
        trzMountChart1CodRefPanel(wrapRef, cardKey, crRow, resFiltrados, i, etiquetas, palette, chartOpts, a.nom);
    });

    trzRefreshTablaResumen();
}

// ════════════════════════════════════════════════════════════════════════
// TAB 2
// ════════════════════════════════════════════════════════════════════════
function trzCargarTab2() {
    trzSpinner(2, true);
    var rango2 = trzGetRangoTab1(); // comparte el mismo filtro global
    var params = trzGetOrigenParams();
    if (rango2) { params.fechaInicio = rango2.desde; params.fechaFin = rango2.hasta; }
    if (trzTipoMuestraActual) params.tipoMuestra = trzTipoMuestraActual;
    $.post(TRZ_API.analisisPorcentaje, params, function(resp){
        trzSpinner(2, false);
        if (resp && resp.items) {
            trzDataTab2 = resp;
            trzSelected2 = trzReconciliarSeleccionAnalisis(trzSelected2, resp.items);
            trzActualizarLabelAnalisisGlobal();
            trzFetchDetalle(function() { trzDibujarChart2(); });
            trzTab2Loaded = true;
        }
    }, 'json').fail(function(){
        trzSpinner(2, false);
    });
}

/** Recarga Tab 1 conservando trzSelected1 (exportación PDF). */
function trzRedrawAllCharts() {
    try {
        if (trzDataTab1 && trzTab1Loaded) trzDibujarChart1();
    } catch (e1) { console.error(e1); }
    try {
        if (trzDataTab2 && trzTab2Loaded) trzDibujarChart2();
    } catch (e2) { console.error(e2); }
}

// ── Cargar tipos de muestra para el select del Tab 2 ─────────────────────────
function trzCargarTiposMuestra() {
    $.get(TRZ_API.tiposMuestra, function(resp){
        var sel = document.getElementById('trz-tipo-muestra-sel');
        if (!sel || !resp || !resp.items) return;
        resp.items.forEach(function(tm){
            var opt = document.createElement('option');
            opt.value       = tm.codigo;
            opt.textContent = tm.nombre;
            sel.appendChild(opt);
        });
    }, 'json');
}

function trzDibujarChart2() {
    if (!trzDataTab2) return;
    var isDark   = trzIsDark();
    var textCol  = isDark ? '#a1a1aa' : '#475569';
    var gridCol  = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
    var selected = trzSelected2;
    var umbral   = 50;
    var pal      = trzPalette();

    var items = (trzDataTab2.items || []).filter(function(it){
        return trzItemEnSeleccionAnalisis(it, selected) && (it.positivos > 0);
    });

    items.sort(function(a, b){ return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' }); });

    var periodoLabel = trzDataTab2.periodoLabel || '';
    var t2El = document.getElementById('trz-chart2-title');
    if (t2El) t2El.textContent = '% CASOS POSITIVOS — ' + periodoLabel.toUpperCase();

    var t2detEl = document.getElementById('trz-chart2-det-title');
    if (t2detEl) t2detEl.textContent = 'Desglose por resultado (por análisis) — ' + periodoLabel.toUpperCase();

    var bgColors = items.map(function(it){
        return it.porcentaje >= umbral
            ? (isDark ? '#3b82f6cc' : '#1d4ed8bb')
            : (isDark ? '#f87171cc' : '#dc2626bb');
    });
    var borderColors = items.map(function(it){
        return it.porcentaje >= umbral
            ? (isDark ? '#60a5fa' : '#1d4ed8')
            : (isDark ? '#fca5a5' : '#dc2626');
    });

    if (trzChart2) { trzChart2.destroy(); trzChart2 = null; }
    (trzCharts2DetList || []).forEach(function(ch) { try { ch.destroy(); } catch (e) {} });
    trzCharts2DetList = [];

    var chartWrap = document.querySelector('#trz-chart2-card .trz-chart-wrap');
    if (!items.length) {
        if (chartWrap) {
            chartWrap.style.overflow = 'hidden';
            chartWrap.style.height = 'auto';
            chartWrap.innerHTML = '<p style="color:var(--trz-text-muted);font-size:.875rem;padding:1rem 0">Sin análisis con resultados en el período.</p>';
        }
        var detGridEmpty = document.getElementById('trz-chart2-det-grid');
        if (detGridEmpty) {
            detGridEmpty.innerHTML = '<p class="trz-t2-det-empty">Sin desglose.</p>';
        }
        trzRefreshTablaResumen();
        return;
    }

    var chartHeight = 420;
    var barW        = Math.max(60, Math.floor(860 / Math.max(items.length, 1)));
    var minW        = Math.max(560, items.length * barW);
    if (chartWrap) {
        chartWrap.style.overflowX = 'auto';
        chartWrap.style.overflowY = 'hidden';
        chartWrap.style.height    = chartHeight + 'px';
        chartWrap.innerHTML =
            '<div id="trz-chart2-inner" style="'
                + 'width:' + minW + 'px;min-width:' + minW + 'px;'
                + 'height:' + chartHeight + 'px;position:relative">'
                + '<canvas id="trz-chart2"></canvas>'
            + '</div>';
    }
    var canvasEl = document.getElementById('trz-chart2');
    if (!canvasEl) return;
    var ctx = canvasEl.getContext('2d');

    trzChart2 = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: items.map(function(it){ return it.nom; }),
            datasets: [{
                label: '% casos positivos (no negativo)',
                data: items.map(function(it){ return it.porcentaje; }),
                backgroundColor: bgColors,
                borderColor: borderColors,
                hoverBackgroundColor: bgColors.slice(),
                hoverBorderColor: borderColors.slice(),
                borderWidth: 1.5, borderRadius: 6, borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeOutBack' },
            animations: {
                colors: { duration: 0 },
            },
            interaction: { mode: 'index', intersect: false },
            elements: {
                bar: {
                    hoverBorderWidth: 2,
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: textCol, font: { size: 11 }, padding: 12 }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e1e2e' : '#fff',
                    titleColor: isDark ? '#e4e4e7' : '#0f172a',
                    bodyColor: isDark ? '#a1a1aa' : '#475569',
                    borderColor: isDark ? '#3f3f46' : '#e2e8f0',
                    borderWidth: 1, padding: 10,
                    callbacks: { label: function(c){ return ' '+c.parsed.y+'%'; } }
                },
            },
            layout: { padding: { top: 12 } },
            scales: {
                x: { ticks:{color:textCol,font:{size:11},maxRotation:35,minRotation:0}, grid:{color:gridCol,drawBorder:false} },
                y: {
                    beginAtZero:true, max:120,
                    ticks:{color:textCol,font:{size:11},callback:function(v){return v+'%';}},
                    grid:{color:gridCol,drawBorder:false}
                }
            }
        },
        plugins: [{
            id: 'trzBarLabels',
            afterDatasetsDraw: function(chart){
                var ctx2 = chart.ctx;
                chart.data.datasets.forEach(function(ds, i){
                    chart.getDatasetMeta(i).data.forEach(function(bar, idx){
                        var val = ds.data[idx];
                        if (val === null || val === undefined) return;
                        ctx2.save();
                        ctx2.font = 'bold 11px sans-serif';
                        ctx2.fillStyle = textCol;
                        ctx2.textAlign = 'center';
                        ctx2.textBaseline = 'bottom';
                        ctx2.fillText(val+'%', bar.x, bar.y - 4);
                        ctx2.restore();
                    });
                });
            }
        }]
    });

    // ── Desglose Tab 2: grilla — un panel por análisis (mini barras horizontales)
    var detGrid = document.getElementById('trz-chart2-det-grid');
    if (!items.length) {
        if (detGrid) detGrid.innerHTML = '<p class="trz-t2-det-empty">Sin desglose.</p>';
    } else {
        var resSet = {};
        items.forEach(function(it) {
            var d = trzFindDetalleAnalisis(it.cod, it.nom);
            if (!d || !d.resultados) return;
            d.resultados.forEach(function(r) {
                if (!trzResultadoOcultoEnGraficos(r.resultado)) resSet[r.resultado] = true;
            });
        });
        var resLabels = Object.keys(resSet).sort(function(a, b) {
            return a.localeCompare(b, 'es', { sensitivity: 'base' });
        });

        if (detGrid) {
            detGrid.innerHTML = '';
            if (!resLabels.length) {
                detGrid.innerHTML = '<p class="trz-t2-det-empty">Sin datos de desglose para los análisis mostrados.</p>';
            } else {
                var anyPanel = false;
                items.forEach(function(it) {
                    var pairs = [];
                    resLabels.forEach(function(res, j) {
                        var s = trzSumResultadoPeriodoItem(it, res);
                        if (s > 0) pairs.push({ res: res, sum: s, colorIdx: j });
                    });
                    if (!pairs.length) return;
                    anyPanel = true;

                    var panel = document.createElement('div');
                    panel.className = 'trz-t2-det-panel';

                    var head = document.createElement('div');
                    head.className = 'trz-t2-det-head';
                    var titleLine = document.createElement('div');
                    titleLine.textContent = it.nom || '';
                    head.appendChild(titleLine);

                    var chartWrap = document.createElement('div');
                    chartWrap.className = 'trz-t2-det-chart-wrap';
                    var canvas = document.createElement('canvas');
                    canvas.setAttribute('aria-label', 'Desglose por resultado — ' + (it.nom || ''));
                    chartWrap.appendChild(canvas);

                    panel.appendChild(head);
                    panel.appendChild(chartWrap);
                    detGrid.appendChild(panel);

                    var hPx = Math.max(168, pairs.length * 32 + 64);
                    chartWrap.style.height = hPx + 'px';

                    var lbls = pairs.map(function(p) {
                        return p.res.length > 48 ? p.res.slice(0, 46) + '…' : p.res;
                    });
                    var vals = pairs.map(function(p) { return p.sum; });
                    var bg = pairs.map(function(p) {
                        var c = trzPaletteDetColor(pal, p.colorIdx);
                        return c + (isDark ? 'dd' : 'e6');
                    });
                    var bd = pairs.map(function(p) { return trzPaletteDetColor(pal, p.colorIdx); });

                    var ch = new Chart(canvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: lbls,
                            datasets: [{
                                label: 'Casos',
                                data: vals,
                                backgroundColor: bg,
                                borderColor: bd,
                                hoverBackgroundColor: bg.slice(),
                                hoverBorderColor: bd.slice(),
                                borderWidth: 1,
                                borderRadius: 4,
                                borderSkipped: false,
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: { duration: 550, easing: 'easeOutQuart' },
                            animations: {
                                colors: { duration: 0 },
                            },
                            interaction: { mode: 'nearest', intersect: true, axis: 'y' },
                            elements: {
                                bar: { hoverBorderWidth: 2 },
                            },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: isDark ? '#1e1e2e' : '#fff',
                                    titleColor: isDark ? '#e4e4e7' : '#0f172a',
                                    bodyColor: isDark ? '#d4d4d8' : '#334155',
                                    borderColor: isDark ? '#52525b' : '#cbd5e1',
                                    borderWidth: 1,
                                    padding: 11,
                                    titleMarginBottom: 6,
                                    boxPadding: 4,
                                    usePointStyle: true,
                                    cornerRadius: 8,
                                    callbacks: {
                                        title: function(ti) {
                                            var i = ti[0].dataIndex;
                                            var r = pairs[i] ? pairs[i].res : '';
                                            var lines = r ? [String(r)] : ['Resultado'];
                                            if (it.nom) lines.push('Análisis: ' + String(it.nom));
                                            return lines.length > 1 ? lines : lines[0];
                                        },
                                        label: function(ctx) {
                                            var n = ctx.parsed.x;
                                            return ' ' + n + (n === 1 ? ' caso' : ' casos');
                                        }
                                    }
                                }
                            },
                            layout: { padding: { left: 4, right: 28, top: 6, bottom: 6 } },
                            scales: {
                                x: {
                                    beginAtZero: true,
                                    ticks: { color: textCol, font: { size: 10 }, precision: 0 },
                                    grid: { color: gridCol, drawBorder: false }
                                },
                                y: {
                                    ticks: { color: textCol, font: { size: 10 }, autoSkip: false },
                                    grid: { display: true, color: gridCol, drawBorder: false }
                                }
                            }
                        },
                        plugins: [{
                            id: 'trzBarLabelsH2',
                            afterDatasetsDraw: function(chart) {
                                var ctx2 = chart.ctx;
                                chart.data.datasets.forEach(function(ds, di) {
                                    chart.getDatasetMeta(di).data.forEach(function(bar, idx) {
                                        var val = ds.data[idx];
                                        if (val === null || val === undefined || val === 0) return;
                                        ctx2.save();
                                        ctx2.font = 'bold 11px sans-serif';
                                        ctx2.fillStyle = textCol;
                                        ctx2.textAlign = 'left';
                                        ctx2.textBaseline = 'middle';
                                        ctx2.fillText(String(val), bar.x + 6, bar.y);
                                        ctx2.restore();
                                    });
                                });
                            }
                        }]
                    });
                    trzCharts2DetList.push(ch);
                });
                if (!anyPanel) {
                    detGrid.innerHTML = '<p class="trz-t2-det-empty">Sin casos por resultado en el período.</p>';
                }
            }
        }
    }

    trzRefreshTablaResumen();
}

// ── Tabla resumen: actualiza según el tab activo y los análisis visibles ─────
function trzRefreshTablaResumen() {
    if (trzActiveTab === 1 && trzDataTab1) {
        var meses = trzDataTab1.meses || [];
        var etiquetas = trzDataTab1.etiquetas || [];
        var analisis = (trzDataTab1.analisis || []).filter(function(a) {
            return trzItemEnSeleccionAnalisis(a, trzSelected1) && trzAnalisisConResultadosValidosVisibles(a);
        });
        analisis.sort(function(a, b) { return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' }); });

        var mesOk = meses.length > 0 && analisis.length && (analisis[0].totales || []).length === meses.length;
        var labs = (etiquetas.length === meses.length) ? etiquetas : meses;
        if (!mesOk) {
            labs = ['Total período'];
        }

        var rows = analisis.map(function(a) {
            var cells = [];
            var ptEnv = 0;
            var ptCr = 0;
            var ptPos = 0;
            var i;
            if (mesOk) {
                for (i = 0; i < meses.length; i++) {
                    var env = (a.registrados || [])[i] || 0;
                    var cr = (a.totales || [])[i] || 0;
                    var pos = (a.data || [])[i] || 0;
                    cells.push({ env: env, cr: cr, pos: pos });
                    ptEnv += env;
                    ptCr += cr;
                    ptPos += pos;
                }
            } else {
                var posT = (a.data || []).reduce(function(s, v) { return s + (v || 0); }, 0);
                var envT = (a.registrados || []).reduce(function(s, v) { return s + (v || 0); }, 0);
                var crT = (a.totales || []).reduce(function(s, v) { return s + (v || 0); }, 0);
                cells.push({ env: envT, cr: crT, pos: posT });
                ptEnv = envT;
                ptCr = crT;
                ptPos = posT;
            }
            return { nom: a.nom, cells: cells, periodo: { env: ptEnv, cr: ptCr, pos: ptPos } };
        });

        trzActualizarTablaResumenPorMes(labs, rows);
    } else if (trzActiveTab === 2 && trzDataTab2) {
        var items = (trzDataTab2.items || []).filter(function(it) {
            return trzItemEnSeleccionAnalisis(it, trzSelected2) && (it.positivos > 0);
        });
        items.sort(function(a, b) { return a.nom.localeCompare(b.nom, 'es', { sensitivity: 'base' }); });

        var meses2 = trzDataTab2.meses || [];
        var etiquetas2 = trzDataTab2.etiquetas || [];
        var sampleIt = items[0];
        var mesOk2 = meses2.length > 0 && sampleIt && Array.isArray(sampleIt.totalesMes)
            && sampleIt.totalesMes.length === meses2.length;
        var labs2 = (etiquetas2.length === meses2.length) ? etiquetas2 : meses2;
        if (!mesOk2) {
            labs2 = ['Total período'];
        }

        var rows2 = items.map(function(it) {
            var cells = [];
            var ptEnv = 0;
            var ptCr = 0;
            var ptPos = 0;
            var i;
            if (mesOk2) {
                for (i = 0; i < meses2.length; i++) {
                    var env2 = (it.registradosMes || [])[i] || 0;
                    var cr2 = (it.totalesMes || [])[i] || 0;
                    var pos2 = (it.positivosMes[i] || 0);
                    cells.push({ env: env2, cr: cr2, pos: pos2 });
                    ptEnv += env2;
                    ptCr += cr2;
                    ptPos += pos2;
                }
            } else {
                cells.push({
                    env: it.totalRegistrados || 0,
                    cr: it.total || 0,
                    pos: it.positivos || 0,
                });
                ptEnv = it.totalRegistrados || 0;
                ptCr = it.total || 0;
                ptPos = it.positivos || 0;
            }
            return { nom: it.nom, cells: cells, periodo: { env: ptEnv, cr: ptCr, pos: ptPos } };
        });

        trzActualizarTablaResumenPorMes(labs2, rows2);
    }
}

// ── Tabla resumen global ──────────────────────────────────────────────────
var trzResumenOpen = true;
function trzToggleResumen() {
    trzResumenOpen = !trzResumenOpen;
    var body = document.getElementById('trz-resumen-body');
    var btn  = document.getElementById('trz-resumen-toggle');
    if (body) body.classList.toggle('trz-r-hidden', !trzResumenOpen);
    if (btn)  btn.classList.toggle('open', trzResumenOpen);
}

/** % positivos sobre enviados (total filas), un decimal */
function trzFmtPctResumen(enviados, positivos) {
    return enviados > 0 ? Math.round(positivos / enviados * 1000) / 10 : 0;
}

/** Cuatro celdas: Enviados | Con resultado | Positivos | % (sobre enviados) */
function trzTdResumenCuatro(enviados, conResultado, positivos) {
    var pct = trzFmtPctResumen(enviados, positivos);
    return '<td class="trz-rd-val">' + enviados + '</td>'
        + '<td class="trz-rd-val">' + conResultado + '</td>'
        + '<td class="trz-rd-val" style="font-weight:700">' + positivos + '</td>'
        + '<td class="trz-rd-val" style="font-weight:700;color:#3b82f6">' + pct + '%</td>';
}

/** Tabla resumen: por mes — Enviados | Con resultado | Positivos | % (positivos/enviados) */
function trzActualizarTablaResumenPorMes(mesLabels, rows) {
    var thead = document.getElementById('trz-resumen-thead');
    var tbody = document.getElementById('trz-resumen-tbody');
    var badge = document.getElementById('trz-resumen-badge');
    if (!thead || !tbody) return;

    var labs = mesLabels || [];
    var showPeriodoTot = labs.length > 1;

    if (!rows || !rows.length) {
        thead.innerHTML = '<tr><th class="trz-rh-row">Análisis</th></tr>';
        tbody.innerHTML = '<tr><td colspan="48" class="trz-rd-val" style="text-align:left;padding:.75rem;color:var(--trz-text-muted)">'
            + 'No hay análisis que cumplan los filtros para este resumen.</td></tr>';
        if (badge) badge.textContent = '';
        return;
    }

    var sorted = rows.slice().sort(function(a, b) {
        return (a.nom || '').localeCompare(b.nom || '', 'es', { sensitivity: 'base' });
    });

    var nMes = labs.length;
    var subHdr = '<th class="trz-rh-sub">Enviados</th>'
        + '<th class="trz-rh-sub">Con resultado</th>'
        + '<th class="trz-rh-sub">Positivos</th>'
        + '<th class="trz-rh-sub">%</th>';

    var thMes = labs.map(function(lbl) {
        return '<th colspan="4" class="trz-rh-col trz-rh-month">' + trzEscHtml(lbl) + '</th>';
    }).join('');
    var thPer = showPeriodoTot ? '<th colspan="4" class="trz-rh-col trz-rh-month">Total período</th>' : '';

    thead.innerHTML =
          '<tr><th rowspan="2" class="trz-rh-row">Análisis</th>' + thMes + thPer + '</tr>'
        + '<tr>' + Array(nMes).fill(subHdr).join('') + (showPeriodoTot ? subHdr : '') + '</tr>';

    tbody.innerHTML = sorted.map(function(r) {
        var cells = r.cells || [];
        var buf = '';
        var i;
        for (i = 0; i < nMes; i++) {
            var c = cells[i] || { env: 0, cr: 0, pos: 0 };
            buf += trzTdResumenCuatro(c.env || 0, c.cr || 0, c.pos || 0);
        }
        if (showPeriodoTot && r.periodo) {
            buf += trzTdResumenCuatro(r.periodo.env || 0, r.periodo.cr || 0, r.periodo.pos || 0);
        }
        return '<tr><td class="trz-rd-analisis" title="' + trzEscHtml(r.nom) + '">' + trzEscHtml(r.nom) + '</td>' + buf + '</tr>';
    }).join('');

    if (badge) badge.textContent = '(' + sorted.length + ' análisis · ' + nMes + ' ' + (nMes === 1 ? 'mes' : 'meses') + ')';
}

/**
 * Exportar PDF → el PDF se genera en el servidor con mPDF
 * (modules/laboratorio/trazabilidad/generar_trazabilidad_pdf.php).
 * El frontend solo abre la URL con los filtros actuales, sin congelarse.
 */
document.getElementById('trz-btn-export-pdf').addEventListener('click', function() {
    if (trzActiveTab === 3) {
        trzExportPdfReporte(false);
        return;
    }
    if (trzActiveTab === 4) {
        trzExportPdfReporte(true);
        return;
    }
    var params = trzGetOrigenParams();
    var rango  = trzGetRangoTab1();
    if (rango) {
        params.fechaInicio = rango.desde;
        params.fechaFin    = rango.hasta;
    }
    if (trzTipoMuestraActual) params.tipoMuestra = trzTipoMuestraActual;
    params.pdfTab = trzActiveTab;
    if (trzActiveTab === 1 && trzSelected1 !== null && trzSelected1 !== undefined) {
        if (trzSelected1.length === 0) params.analisis = [];
        else params['analisis[]'] = trzSelected1.slice();
    }
    if (trzActiveTab === 2 && trzSelected2 !== null && trzSelected2 !== undefined) {
        if (trzSelected2.length === 0) params.analisis = [];
        else params['analisis[]'] = trzSelected2.slice();
    }

    var url = TRZ_API.generarPdf + '?' + $.param(params);
    window.open(url, '_blank');
});

// ── Helpers ───────────────────────────────────────────────────────────────
function trzEscHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ════════════════════════════════════════════════════════════════════════
// FILTRO GRANJAS — árbol zona / subzona con chevrons
// ════════════════════════════════════════════════════════════════════════
var trzGranjasSeleccionadas = []; // [] = todas
var trzGranjasDisponibles   = [];
var trzGranjaCargadas       = false;

/* Abre el modal */
function trzAbrirModalGranjas() {
    var inp = document.getElementById('trzBuscarGranja');
    if (inp) inp.value = '';
    document.getElementById('trzGBackdrop').classList.add('trz-g-open');
    document.getElementById('trzGPanel').classList.add('trz-g-open');
    if (!trzGranjaCargadas) {
        trzCargarListaGranjas();
    } else {
        trzRenderArbolGranjas('');
    }
}

/* Cierra el modal */
function trzCerrarModalGranjas() {
    document.getElementById('trzGBackdrop').classList.remove('trz-g-open');
    document.getElementById('trzGPanel').classList.remove('trz-g-open');
}

/* Carga granjas desde el servidor */
function trzCargarListaGranjas() {
    var tree = document.getElementById('trzListaGranjasTree');
    if (tree) tree.innerHTML = '<span style="color:var(--trz-text-muted);font-size:.82rem">Cargando granjas…</span>';
    fetch(TRZ_API.granjas, { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(res) {
            var todas = (res && res.success && Array.isArray(res.data)) ? res.data : [];
            trzGranjasDisponibles = todas.filter(function(g) {
                return String(g.codigo || '').trim().charAt(0) === '6';
            });
            trzGranjaCargadas = true;
            trzRenderArbolGranjas('');
        })
        .catch(function() {
            var t = document.getElementById('trzListaGranjasTree');
            if (t) t.innerHTML = '<span style="color:#ef4444;font-size:.82rem">Error al cargar granjas</span>';
        });
}

/* Renderiza el árbol zona → subzona → granjas */
function trzRenderArbolGranjas(filtro) {
    var tree   = document.getElementById('trzListaGranjasTree');
    var chkAll = document.getElementById('trzChkTodasGranjas');
    if (!tree) return;
    var q = (filtro || '').toLowerCase().trim();

    var lista = trzGranjasDisponibles.filter(function(g) {
        if (!q) return true;
        return String(g.codigo || '').toLowerCase().indexOf(q) >= 0 ||
               String(g.nombre  || '').toLowerCase().indexOf(q) >= 0;
    });

    if (!lista.length) {
        tree.innerHTML = '<span style="color:var(--trz-text-muted);font-size:.82rem">Sin resultados</span>';
        if (chkAll) chkAll.checked = false;
        return;
    }

    var modoTodas = false; // vacío = todas, pero checkboxes desmarcados

    // Agrupar: zona → subzona → [granjas]
    var zonaMap = {}, zonaOrder = [];
    lista.forEach(function(g) {
        var z  = (String(g.zona    || '')).trim() || '(Sin zona)';
        var sz = (String(g.subzona || '')).trim() || '(Sin subzona)';
        if (!zonaMap[z])     { zonaMap[z] = {}; zonaOrder.push(z); }
        if (!zonaMap[z][sz]) { zonaMap[z][sz] = []; }
        zonaMap[z][sz].push(g);
    });
    zonaOrder.sort();

    var html = '';
    zonaOrder.forEach(function(z, zi) {
        var subzonas    = zonaMap[z];
        var szKeys      = Object.keys(subzonas).sort();
        var zBodyId     = 'trzZBody_' + zi;
        html += '<div class="trz-g-zone" data-trz-z="' + trzEscHtml(z) + '">';
        html +=   '<div class="trz-g-zone-head">'
                +   '<button type="button" class="trz-g-chev-btn trzGExpZ" data-body="' + zBodyId + '" aria-expanded="true">'
                +     '<i class="fas fa-chevron-right trz-g-chev trz-g-chev-open"></i>'
                +   '</button>'
                +   '<input type="checkbox" class="trzGChkZ w-4 h-4 cursor-pointer flex-shrink-0" data-z="' + trzEscHtml(z) + '">'
                +   '<span style="cursor:default">' + trzEscHtml(z) + '</span>'
                + '</div>';
        html +=   '<div id="' + zBodyId + '">';
        szKeys.forEach(function(sz, si) {
            var granjas  = subzonas[sz];
            var szBodyId = 'trzSZBody_' + zi + '_' + si;
            html += '<div class="trz-g-subzona" data-trz-sz="' + trzEscHtml(sz) + '">';
            html +=   '<div class="trz-g-sub-head">'
                    +   '<button type="button" class="trz-g-chev-btn trzGExpSZ" data-body="' + szBodyId + '" aria-expanded="true">'
                    +     '<i class="fas fa-chevron-right trz-g-chev trz-g-chev-open"></i>'
                    +   '</button>'
                    +   '<input type="checkbox" class="trzGChkSZ w-4 h-4 cursor-pointer flex-shrink-0" data-z="' + trzEscHtml(z) + '" data-sz="' + trzEscHtml(sz) + '">'
                    +   '<span style="cursor:default;font-size:.78rem">' + trzEscHtml(sz) + '</span>'
                    + '</div>';
            html +=   '<div class="trz-g-sub-granjas" id="' + szBodyId + '">';
            granjas.forEach(function(g) {
                var cod  = String(g.codigo || '').trim();
                var nom  = String(g.nombre  || cod).trim();
                var chkd = (modoTodas || trzGranjasSeleccionadas.indexOf(cod) >= 0) ? ' checked' : '';
                html += '<label class="trz-g-fila">'
                      + '<input type="checkbox" class="trzGChkG w-4 h-4 cursor-pointer flex-shrink-0"'
                      + ' value="' + trzEscHtml(cod) + '"'
                      + ' data-z="' + trzEscHtml(z) + '" data-sz="' + trzEscHtml(sz) + '"' + chkd + '>'
                      + '<span class="trz-g-fila-cod">' + trzEscHtml(cod) + '</span>'
                      + '<span class="trz-g-fila-nom" title="' + trzEscHtml(nom) + '">' + trzEscHtml(nom) + '</span>'
                      + '</label>';
            });
            html +=   '</div>';  // sub-granjas
            html += '</div>';    // subzona
        });
        html +=   '</div>';  // zone-body
        html += '</div>';    // zone
    });
    tree.innerHTML = html;

    trzSyncTodosMarcadores();

    // ── Eventos chevron zona ──────────────────────────────────────────
    tree.querySelectorAll('.trzGExpZ').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var bodyEl = document.getElementById(btn.getAttribute('data-body'));
            var ic     = btn.querySelector('.trz-g-chev');
            if (!bodyEl) return;
            var open = bodyEl.style.display !== 'none';
            bodyEl.style.display = open ? 'none' : '';
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            if (ic) ic.classList.toggle('trz-g-chev-open', !open);
        });
    });

    // ── Eventos chevron subzona ───────────────────────────────────────
    tree.querySelectorAll('.trzGExpSZ').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var bodyEl = document.getElementById(btn.getAttribute('data-body'));
            var ic     = btn.querySelector('.trz-g-chev');
            if (!bodyEl) return;
            var open = bodyEl.style.display !== 'none';
            bodyEl.style.display = open ? 'none' : '';
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            if (ic) ic.classList.toggle('trz-g-chev-open', !open);
        });
    });

    // ── Evento checkbox zona ──────────────────────────────────────────
    tree.querySelectorAll('.trzGChkZ').forEach(function(chkZ) {
        chkZ.addEventListener('change', function() {
            var z = chkZ.getAttribute('data-z');
            tree.querySelectorAll('.trzGChkG[data-z="' + z + '"]').forEach(function(c) { c.checked = chkZ.checked; });
            trzSyncSubzonasDeZona(z);
            trzSyncChkAll();
        });
    });

    // ── Evento checkbox subzona ───────────────────────────────────────
    tree.querySelectorAll('.trzGChkSZ').forEach(function(chkSZ) {
        chkSZ.addEventListener('change', function() {
            var z  = chkSZ.getAttribute('data-z');
            var sz = chkSZ.getAttribute('data-sz');
            tree.querySelectorAll('.trzGChkG[data-z="' + z + '"][data-sz="' + sz + '"]')
                .forEach(function(c) { c.checked = chkSZ.checked; });
            trzSyncZonaDeSubzona(z);
            trzSyncChkAll();
        });
    });

    // ── Evento checkbox granja individual ────────────────────────────
    tree.querySelectorAll('.trzGChkG').forEach(function(ch) {
        ch.addEventListener('change', function() {
            trzSyncSubzonasDeZona(ch.getAttribute('data-z'));
            trzSyncZonaDeSubzona(ch.getAttribute('data-z'));
            trzSyncChkAll();
        });
    });
}

/* Sincroniza checkbox de subzona según sus granjas */
function trzSyncSubzona(z, sz) {
    var tree = document.getElementById('trzListaGranjasTree');
    if (!tree) return;
    var gs = tree.querySelectorAll('.trzGChkG[data-z="' + z + '"][data-sz="' + sz + '"]');
    var n = gs.length, c = 0;
    gs.forEach(function(g) { if (g.checked) c++; });
    var chk = tree.querySelector('.trzGChkSZ[data-z="' + z + '"][data-sz="' + sz + '"]');
    if (chk) chk.checked = (n > 0 && c === n);
}

/* Sincroniza todas las subzonas de una zona */
function trzSyncSubzonasDeZona(z) {
    var tree = document.getElementById('trzListaGranjasTree');
    if (!tree) return;
    var szSet = {};
    tree.querySelectorAll('.trzGChkG[data-z="' + z + '"]').forEach(function(g) { szSet[g.getAttribute('data-sz')] = true; });
    Object.keys(szSet).forEach(function(sz) { trzSyncSubzona(z, sz); });
}

/* Sincroniza checkbox de zona según sus granjas */
function trzSyncZonaDeSubzona(z) {
    var tree = document.getElementById('trzListaGranjasTree');
    if (!tree) return;
    var gs = tree.querySelectorAll('.trzGChkG[data-z="' + z + '"]');
    var n = gs.length, c = 0;
    gs.forEach(function(g) { if (g.checked) c++; });
    var chkZ = tree.querySelector('.trzGChkZ[data-z="' + z + '"]');
    if (chkZ) chkZ.checked = (n > 0 && c === n);
}

/* Sincroniza el checkbox "Todas" */
function trzSyncChkAll() {
    var tree   = document.getElementById('trzListaGranjasTree');
    var chkAll = document.getElementById('trzChkTodasGranjas');
    if (!tree || !chkAll) return;
    var total    = tree.querySelectorAll('.trzGChkG').length;
    var marcados = tree.querySelectorAll('.trzGChkG:checked').length;
    chkAll.checked = (total > 0 && marcados === total);
}

/* Sincroniza todos los marcadores desde cero */
function trzSyncTodosMarcadores() {
    var tree = document.getElementById('trzListaGranjasTree');
    if (!tree) return;
    var zSet = {};
    tree.querySelectorAll('.trzGChkG').forEach(function(g) { zSet[g.getAttribute('data-z')] = true; });
    Object.keys(zSet).forEach(function(z) {
        trzSyncSubzonasDeZona(z);
        trzSyncZonaDeSubzona(z);
    });
    trzSyncChkAll();
}

/* Aplica la selección y recarga */
function trzAplicarGranjas() {
    var tree   = document.getElementById('trzListaGranjasTree');
    var chkAll = document.getElementById('trzChkTodasGranjas');
    if (!tree) { trzCerrarModalGranjas(); return; }

    var todos    = tree.querySelectorAll('.trzGChkG');
    var marcados = tree.querySelectorAll('.trzGChkG:checked');

    // vacío o "todas" marcado o todos marcados → sin restricción (todas las granjas)
    if (!todos.length || marcados.length === 0 || (chkAll && chkAll.checked) || marcados.length === todos.length) {
        trzGranjasSeleccionadas = [];
    } else {
        trzGranjasSeleccionadas = [];
        marcados.forEach(function(ch) { trzGranjasSeleccionadas.push(ch.value); });
    }

    trzActualizarLabelsGranja();
    trzCerrarModalGranjas();
    trzTab1Loaded = false;
    trzTab2Loaded = false;
    trzCargarTab1();
    if (trzActiveTab === 2) trzCargarTab2();
}

/* Filtra granjas visibles según búsqueda */
function trzFiltrarBusquedaGranjas(q) {
    var tree = document.getElementById('trzListaGranjasTree');
    if (!tree) return;
    q = (q || '').toLowerCase().trim();
    tree.querySelectorAll('.trz-g-fila').forEach(function(fila) {
        var cod = (fila.querySelector('.trz-g-fila-cod') || {}).textContent || '';
        var nom = (fila.querySelector('.trz-g-fila-nom') || {}).textContent || '';
        fila.style.display = (!q || cod.toLowerCase().indexOf(q) >= 0 || nom.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
    });
    // Ocultar subzonas vacías
    tree.querySelectorAll('.trz-g-subzona').forEach(function(sz) {
        var any = false;
        sz.querySelectorAll('.trz-g-fila').forEach(function(f) { if (f.style.display !== 'none') any = true; });
        sz.style.display = any ? '' : 'none';
    });
    // Ocultar zonas vacías
    tree.querySelectorAll('.trz-g-zone').forEach(function(z) {
        var any = false;
        z.querySelectorAll('.trz-g-subzona').forEach(function(s) { if (s.style.display !== 'none') any = true; });
        z.style.display = any ? '' : 'none';
    });
}

function trzActualizarLabelsGranja() {
    var lbl = document.getElementById('trz-label-granjas');
    var txt;
    if (!trzGranjasSeleccionadas || !trzGranjasSeleccionadas.length) {
        txt = 'Todas las granjas';
    } else if (trzGranjasSeleccionadas.length === 1) {
        txt = 'Granja ' + trzGranjasSeleccionadas[0];
    } else {
        txt = trzGranjasSeleccionadas.length + ' granjas';
    }
    if (lbl) lbl.textContent = txt;
}

// ── Init ──────────────────────────────────────────────────────────────────
(function init(){
    trzInitThemeSync();
    // Filtro global de período
    document.getElementById('trz-periodoTipo').addEventListener('change', trzOnPeriodoChange);
    trzOnPeriodoChange();
    trzInitFpFechas();
    trzInitFpMes();
    trzCargarTiposMuestra();
    trzCargarTab1();

    var selOrigen = document.getElementById('trz-sel-origen');
    if (selOrigen) {
        selOrigen.addEventListener('change', function() {
            trzOnOrigenChange(this.value);
        });
    }
    var selCodOrigen = document.getElementById('trz-sel-cod-origen');
    if (selCodOrigen) selCodOrigen.addEventListener('change', trzAplicarFiltroGlobal);

    // ── Eventos modal granjas ───────────────────────────────────────────────
    var btnCerrarG   = document.getElementById('trzBtnCerrarGranjas');
    var btnCancelarG = document.getElementById('trzBtnCancelarGranjas');
    var btnAplicarG  = document.getElementById('trzBtnAplicarGranjas');
    var inputSearch  = document.getElementById('trzBuscarGranja');
    var chkTodasG    = document.getElementById('trzChkTodasGranjas');
    var backdropG    = document.getElementById('trzGBackdrop');

    if (btnCerrarG)   btnCerrarG.addEventListener('click',   trzCerrarModalGranjas);
    if (btnCancelarG) btnCancelarG.addEventListener('click', trzCerrarModalGranjas);
    if (btnAplicarG)  btnAplicarG.addEventListener('click',  trzAplicarGranjas);
    if (inputSearch)  inputSearch.addEventListener('input',  function() { trzFiltrarBusquedaGranjas(this.value); });
    if (chkTodasG) {
        chkTodasG.addEventListener('change', function() {
            var tree = document.getElementById('trzListaGranjasTree');
            if (!tree) return;
            tree.querySelectorAll('.trzGChkG').forEach(function(c) { c.checked = chkTodasG.checked; });
            trzSyncTodosMarcadores();
        });
    }
    if (backdropG) backdropG.addEventListener('click', trzCerrarModalGranjas);

    // Listener select tipo de muestra → recarga ambas pestañas
    var selTipo = document.getElementById('trz-tipo-muestra-sel');
    if (selTipo) {
        selTipo.addEventListener('change', function(){
            trzTipoMuestraActual = this.value;
            trzTab1Loaded = false;
            trzTab2Loaded = false;
            trzTab3Loaded = false;
            trzTab4Loaded = false;
            trzDataReporte = null;
            trzDataEnfermedades = null;
            trzSelected1  = null;
            trzSelected2  = null;
            trzSelectedReport = null;
            trzDataAnalisisFiltro = null;
            trzAnalisisFiltroKey = '';
            trzActualizarLabelAnalisisGlobal();
            trzCargarTab1();
            if (trzActiveTab === 2) trzCargarTab2();
            if (trzActiveTab === 3) trzCargarReporte();
            if (trzActiveTab === 4) trzCargarReporteEnfermedades();
        });
    }
})();