/**
 * Dashboard Gráficas liquidación.
 */
(function () {
    var apiCfg = window.HCLIQ_API || {};
    var API_PAYLOAD = apiCfg.chart || '';
    var API_GALPONES = apiCfg.galpones || '';
    var API_GRANJAS = apiCfg.granjasCrud || '';
    var API_UBICACION = apiCfg.ubicacion || '';
    var CATALOGO = Array.isArray(window.HCLIQ_PARAMETROS) ? window.HCLIQ_PARAMETROS : [];

    var metaByGranja = {};
    var paramMetaByKey = {};
    var paramOrder = [];
    var selectedParams = [];
    var appliedParams = [];
    var hcliqChart = null;
    var hcliqCharts = [];
    var chartPayload = null;
    var chartModo = 'global';
    var listaRows = [];
    var hcliqReqSeq = 0;
    var msParametros = null;
    var msUbicacion = null;
    var catalogoUbicacion = [];
    var selectedGranjas = [];
    var selCampaniasPorGranja = {};
    var selGalponesPorGranja = {};
    var modoAplicado = null;
    /* Query del ultimo payload cargado: si la seleccion actual exige otro, hay que pedirlo al servidor */
    var chartQs = '';
    function payloadVigente() {
        return chartQs !== '' && chartQs === buildQueryParams().toString();
    }
    /* Galpones / ubicacion: si el grafico cargado no corresponde a la accion o granja actual, se aplica solo */
    function aplicarSiDesfasado() {
        if (!selectedParams.length) return;
        if (payloadVigente()) {
            refrescarGraficoActual();
            return;
        }
        var modo = modoValue();
        if (modo === 'granja' && !normGranja((document.getElementById('hcliq-granja') || {}).value)) return;
        if (modo === 'granjas' && !selectedGranjas.length) return;
        filtrar();
    }
    var msGalpones = null;
    /* Campañas de la granja elegida (modo 'Elegir una granja'), según el periodo */
    var msCampanias = null;
    var campaniasGranjaTodas = [];
    var selectedCampaniasGranja = [];
    var selectedGalpones = [];
    var galponCatalogo = {};
    /* Serie del modo detalle de granja sin galpón restringido */
    var HCLIQ_SERIE_GRANJA_TODOS = 'Consolidado general';
    /* Opción de promedio dentro del selector de galpones */
    var HCLIQ_OPT_PROMEDIO = '__promedio__';

    /* Paleta de series: colores alternos para que galpones y parámetros no repitan tono */
    var HCLIQ_PALETA = [
        '#2563eb', '#f97316', '#10b981', '#a855f7', '#ef4444',
        '#0891b2', '#eab308', '#ec4899', '#14b8a6', '#6366f1',
        '#84cc16', '#f43f5e', '#0ea5e9', '#d946ef', '#22c55e',
        '#f59e0b', '#8b5cf6', '#06b6d4', '#fb7185', '#65a30d'
    ];

    /* Zonas (gráficos individuales / modo global) */
    var HCLIQ_PALETA_ZONA = {
        'La Joya': { border: '#f97316', background: 'rgba(249,115,22,0.12)' },
        'Mollendo': { border: '#64748b', background: 'rgba(100,116,139,0.12)' },
        'Molendo': { border: '#64748b', background: 'rgba(100,116,139,0.12)' },
        'Arequipa': { border: '#2563eb', background: 'rgba(37,99,235,0.12)' },
        'Sin zona': { border: '#94a3b8', background: 'rgba(148,163,184,0.12)' }
    };

    function esDatasetReal(ds) {
        return !/meta/i.test(String((ds && ds.serie) || (ds && ds.label) || ''));
    }

    function colorZonaEntidad(serie, titulo) {
        var cand = [serie, titulo];
        for (var ci = 0; ci < cand.length; ci++) {
            var z = String(cand[ci] == null ? '' : cand[ci]).trim();
            if (z && HCLIQ_PALETA_ZONA[z]) return HCLIQ_PALETA_ZONA[z];
        }
        return null;
    }

    function aplicarColorParDataset(ds, par) {
        if (!par) return ds;
        return Object.assign({}, ds, {
            borderColor: par.border,
            backgroundColor: par.background || colorSerieRgba(par.border, 0.12)
        });
    }

    function aplicarPaletaVariada(datasets) {
        var idx = 0;
        return (datasets || []).map(function (ds) {
            if (!esDatasetReal(ds)) return ds;
            var c = colorSerie(idx++);
            return Object.assign({}, ds, {
                borderColor: c,
                backgroundColor: colorSerieRgba(c, 0.14)
            });
        });
    }

    function remapearColoresCombinado(lista, combin, parametros) {
        if (combin === 'separado') return lista;
        if (combin === 'tipo' && (parametros || []).length > 1) return lista;
        return aplicarPaletaVariada(lista);
    }

    function colorSerie(indice) {
        var i = Math.floor(Number(indice));
        if (!isFinite(i) || i < 0) i = 0;
        return HCLIQ_PALETA[i % HCLIQ_PALETA.length];
    }

    function colorSerieRgba(hex, alfa) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex;
        return 'rgba(' + parseInt(h.slice(0, 2), 16) + ','
            + parseInt(h.slice(2, 4), 16) + ','
            + parseInt(h.slice(4, 6), 16) + ',' + alfa + ')';
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }
    function normGranja(g) {
        var s = String(g || '').trim();
        if (!s) return '';
        return s.length >= 3 ? s.slice(0, 3) : s.padStart(3, '0');
    }
    function galponKey(gp) {
        var s = String(gp == null ? '' : gp).trim();
        if (!s) return '';
        if (/^\d+$/.test(s)) {
            var n = s.replace(/^0+/, '');
            return n === '' ? '0' : n;
        }
        var m = s.match(/(\d+)$/);
        if (m) {
            var n2 = String(m[1]).replace(/^0+/, '');
            if (n2 !== '') return n2;
        }
        return s;
    }
    function fmtFechaEs(ymd) {
        var t = String(ymd || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t || '—';
        var p = t.split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
    }
    function fmtFechaCorta(ymd) {
        var t = String(ymd || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t || '';
        var p = t.split('-');
        return p[2] + '/' + p[1] + '/' + p[0].slice(-2);
    }
    function fmtMesCorto(ym) {
        var t = String(ym || '').trim();
        if (!/^\d{4}-\d{2}$/.test(t)) return t || '';
        return t.slice(5, 7) + '/' + t.slice(2, 4);
    }
    function fmtMesEspanol(ym) {
        var t = String(ym || '').trim();
        if (!/^\d{4}-\d{2}$/.test(t)) return t || '';
        var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        var m = parseInt(t.slice(5, 7), 10);
        var nombre = meses[m - 1] || '';
        return nombre ? (nombre + ' ' + t.slice(0, 4)) : fmtMesCorto(t);
    }
    function fmtValorMeta(v, meta) {
        if (v == null || v === '') return '—';
        var n = Number(v);
        if (!isFinite(n)) return '—';
        var dec = meta && meta.decimals != null ? Number(meta.decimals) : 3;
        if (!isFinite(dec) || dec < 0) dec = 3;
        var s = esConteoK(n, dec) ? fmtK(n) : n.toFixed(dec);
        var suffix = meta && meta.suffix ? String(meta.suffix) : '';
        return suffix ? (s + suffix) : s;
    }
    /* Conteos (und/kg, 0 decimales) >= 1000 se muestran en miles como el PDF: 1,593,882 -> 1,594K */
    function esConteoK(n, dec) { return Number(dec) === 0 && Math.abs(n) >= 1000; }
    function fmtK(n) { var k = Math.sign(n) * Math.floor(Math.abs(Number(n)) / 1000 + 0.5); /* half-up */ return k.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + 'K'; }
    function fmtValorFull(v, meta) {
        var n = Number(v);
        var dec = meta && meta.decimals != null ? Number(meta.decimals) : 3;
        return (isFinite(n) && esConteoK(n, dec)) ? ' (' + n.toLocaleString('es-PE', { maximumFractionDigits: 0 }) + ')' : '';
    }
    function fmtValor(v, pk) {
        var meta = paramMetaByKey[pk || ''] || {};
        return fmtValorMeta(v, { decimals: meta.decimals, suffix: meta.suffix });
    }
    function get(url) {
        if (typeof window.hcliqSanidadFetchJson === 'function') {
            return window.hcliqSanidadFetchJson(url);
        }
        return fetch(url, { credentials: 'include' }).then(function (r) {
            if (r.status === 401) {
                throw new Error('auth');
            }
            return r.text().then(function (txt) {
                try {
                    return JSON.parse(txt);
                } catch (e) {
                    var plain = String(txt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    throw new Error(plain ? plain.slice(0, 400) : 'Respuesta no válida del servidor');
                }
            });
        });
    }
    function parseFechaEs(s) {
        var t = String(s || '').trim();
        var m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (!m) return '';
        return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    }
    function hcAppendPeriodoParams(p) {
        var tipo = (document.getElementById('hcliq-periodoTipo') || {}).value || '';
        p.set('periodoTipo', tipo);
        p.set('fechaUnica', parseFechaEs((document.getElementById('hcliq-fechaUnica') || {}).value));
        p.set('fechaInicio', parseFechaEs((document.getElementById('hcliq-fechaInicio') || {}).value));
        p.set('fechaFin', parseFechaEs((document.getElementById('hcliq-fechaFin') || {}).value));
        p.set('mesUnico', ((document.getElementById('hcliq-mesUnico') || {}).value || '').trim());
        p.set('mesInicio', ((document.getElementById('hcliq-mesInicio') || {}).value || '').trim());
        p.set('mesFin', ((document.getElementById('hcliq-mesFin') || {}).value || '').trim());
    }
    function aplicarVisibilidadPeriodo() {
        var t = (document.getElementById('hcliq-periodoTipo') || {}).value || '';
        ['hcliq-periodoPorFecha', 'hcliq-periodoEntreFechas', 'hcliq-periodoPorMes', 'hcliq-periodoEntreMeses'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.classList.add('hc-hidden');
        });
        if (t === 'POR_FECHA') document.getElementById('hcliq-periodoPorFecha').classList.remove('hc-hidden');
        else if (t === 'ENTRE_FECHAS') document.getElementById('hcliq-periodoEntreFechas').classList.remove('hc-hidden');
        else if (t === 'POR_MES') document.getElementById('hcliq-periodoPorMes').classList.remove('hc-hidden');
        else if (t === 'ENTRE_MESES') document.getElementById('hcliq-periodoEntreMeses').classList.remove('hc-hidden');
    }
    function hcPeriodoValido() {
        var t = (document.getElementById('hcliq-periodoTipo') || {}).value || '';
        if (t === 'POR_FECHA') return !!parseFechaEs((document.getElementById('hcliq-fechaUnica') || {}).value);
        if (t === 'ENTRE_FECHAS') {
            return !!parseFechaEs((document.getElementById('hcliq-fechaInicio') || {}).value)
                && !!parseFechaEs((document.getElementById('hcliq-fechaFin') || {}).value);
        }
        if (t === 'POR_MES') return !!((document.getElementById('hcliq-mesUnico') || {}).value || '').trim();
        if (t === 'ENTRE_MESES') {
            return !!(((document.getElementById('hcliq-mesInicio') || {}).value || '').trim())
                && !!(((document.getElementById('hcliq-mesFin') || {}).value || '').trim());
        }
        return true;
    }
    function modoValue() {
        return ((document.getElementById('hcliq-modo') || {}).value || 'global').trim();
    }
    function combinarValue() {
        var v = ((document.getElementById('hcliq-combinar') || {}).value || 'tipo').trim();
        return v === 'combinado' ? 'tipo' : v;
    }
    function buildQueryParams() {
        var p = new URLSearchParams();
        hcAppendPeriodoParams(p);
        if (selectedParams.length > 0) {
            p.set('parametroKeys', selectedParams.join(','));
        }
        var modo = modoValue();
        if (modo === 'global') {
            var zona = ((document.getElementById('hcliq-zona') || {}).value || '').trim();
            if (zona) p.set('zona', zona);
        }
        p.set('modo', modo);
        if (modo === 'granja') {
            var gSel = normGranja((document.getElementById('hcliq-granja') || {}).value);
            p.set('granja', gSel);
            /* Todas marcadas (o ninguna) = sin filtro de campaña */
            if (selectedCampaniasGranja.length && selectedCampaniasGranja.length < campaniasGranjaTodas.length) {
                p.set('campanias', gSel + ':' + selectedCampaniasGranja.join(','));
            }
        } else if (modo === 'granjas') {
            p.set('granjas', selectedGranjas.map(normGranja).join(','));
            p.set('campanias', selUbicacionEncoded(selCampaniasPorGranja));
            p.set('galponesPorGranja', selUbicacionEncoded(selGalponesPorGranja));
        }
        return p;
    }
    function selUbicacionEncoded(mapa) {
        return Object.keys(mapa).map(function (g) {
            var vals = mapa[g] || [];
            return vals.length ? (normGranja(g) + ':' + vals.join(',')) : '';
        }).filter(function (s) { return s !== ''; }).join(';');
    }
    function etiquetaGranja(cod) {
        var c = normGranja(cod);
        var n = (metaByGranja[c] || '').trim();
        return n ? (c + ' · ' + n) : c;
    }
    function actualizarGalponesGranja() {
        var wrap = document.getElementById('hcliq-galpon-wrap');
        if (!wrap) return;
        var modo = modoValue();
        var sel = document.getElementById('hcliq-granja');
        var gId = sel ? normGranja(sel.value) : '';
        var mostrar = modo === 'granja' && gId !== '';
        wrap.style.display = mostrar ? '' : 'none';
        var wrapC = document.getElementById('hcliq-campania-wrap');
        if (wrapC) wrapC.style.display = modo === 'granja' ? '' : 'none';
        var btnC = document.getElementById('hcliq-campania-btn');
        if (btnC) {
            btnC.disabled = !mostrar;
            btnC.title = mostrar ? '' : 'Seleccione primero una granja';
        }
        /* En comparar granjas la selección viene del modal jerárquico y no se limpia */
        if (modo === 'global' && selectedGalpones.length) {
            selectedGalpones = [];
            galponCatalogo = {};
            if (msGalpones) msGalpones.setOptions([], []);
        }
    }
    function galponCatalogoPromedio() {
        return { serie: '', galpon: '', label: 'Consolidado general', indice: -1, color: '#64748b' };
    }
    function opcionPromedio() {
        return { id: HCLIQ_OPT_PROMEDIO, label: 'Consolidado general', color: '#64748b' };
    }
    /* Galpones del catálogo de la granja elegida, disponibles antes de filtrar */
    /* Campañas de la granja elegida dentro del periodo (catálogo del selector de ubicación) */
    function loadCampaniasDeCatalogo(conservar) {
        var sel = document.getElementById('hcliq-granja');
        var gId = sel ? normGranja(sel.value) : '';
        var prev = conservar ? selectedCampaniasGranja.slice() : [];
        var lista = [];
        if (gId !== '') {
            catalogoUbicacion.forEach(function (g) {
                if (normGranja(String(g.granja || g.codigo || g.nombre)) !== gId) return;
                (g.campanias || []).forEach(function (c) {
                    var cs = String(c);
                    if (cs !== '' && lista.indexOf(cs) < 0) lista.push(cs);
                });
            });
        }
        lista.sort(function (a, b) { return b.localeCompare(a, undefined, { numeric: true }); });
        campaniasGranjaTodas = lista;
        var keep = prev.filter(function (c) { return lista.indexOf(c) >= 0; });
        selectedCampaniasGranja = keep.length ? keep : lista.slice();
        if (msCampanias) {
            msCampanias.setOptions(lista.map(function (c) {
                return { id: c, label: 'Campaña ' + c };
            }), selectedCampaniasGranja);
        }
    }
    function loadGalponesDeCatalogo() {
        var sel = document.getElementById('hcliq-granja');
        var gId = sel ? normGranja(sel.value) : '';
        selectedGalpones = [];
        galponCatalogo = {};
        if (msGalpones) msGalpones.setOptions([], []);
        if (gId === '') return;
        var entrada = null;
        catalogoUbicacion.forEach(function (g) {
            if (normGranja(String(g.granja || g.codigo || g.nombre)) === gId) entrada = g;
        });
        var lista = entrada && Array.isArray(entrada.galpones) ? entrada.galpones.slice() : [];
        lista.sort(function (a, b) {
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        });
        var opciones = [];
        lista.forEach(function (gp, i) {
            var k = galponKey(gp);
            if (k === '') return;
            var id = galponToken(HCLIQ_SERIE_GRANJA_TODOS, k);
            if (galponCatalogo[id]) return;
            var label = 'Galpón ' + String(gp);
            galponCatalogo[id] = { serie: HCLIQ_SERIE_GRANJA_TODOS, galpon: k, label: label, indice: i, color: colorSerie(i) };
            opciones.push({ id: id, label: label, color: colorSerie(i) });
        });
        galponCatalogo[HCLIQ_OPT_PROMEDIO] = galponCatalogoPromedio();
        if (msGalpones) msGalpones.setOptions([opcionPromedio()].concat(opciones), []);
    }
    function toggleGranjaField() {
        var modo = modoValue();
        var cambioModo = modo !== modoAplicado;
        if (cambioModo) {
            modoAplicado = modo;
            selectedGalpones = [];
            galponCatalogo = {};
            if (msGalpones) msGalpones.setOptions([], []);
        }
        var wrapZona = document.getElementById('hcliq-zona-wrap');
        if (wrapZona) wrapZona.style.display = modo === 'global' ? '' : 'none';
        var wrap = document.getElementById('hcliq-granja-wrap');
        if (wrap) wrap.style.display = modo === 'granja' ? '' : 'none';
        var wrapUbic = document.getElementById('hcliq-ubicacion-wrap');
        if (wrapUbic) wrapUbic.style.display = modo === 'granjas' ? '' : 'none';
        actualizarEtiquetaCombinar();
        if (cambioModo) {
            if (modo === 'granjas') {
                syncSeleccionUbicacion();
                if (chartPayload) refrescarGraficoActual();
            } else if (modo === 'granja') {
                loadGranjaOpciones();
                if (chartPayload) refrescarGraficoActual();
            } else if (chartPayload) {
                refrescarGraficoActual();
            }
        }
        actualizarGalponesGranja();
    }
    /* 0 parametros: sin graficos, mensaje en el area de graficos y Filtrar deshabilitado */
    var HCLIQ_MSG_SIN_PARAM = 'Seleccione al menos un par\u00e1metro';
    function hcSinParamsUI() {
        var sin = !selectedParams.length;
        var host = document.getElementById('hcliq-chart-host');
        var msg = document.getElementById('hcliq-sin-param');
        if (sin && !msg && host && host.parentNode) {
            msg = document.createElement('div');
            msg.id = 'hcliq-sin-param';
            msg.style.cssText = 'padding:24px;text-align:center;color:#64748b;font-weight:600;';
            msg.textContent = HCLIQ_MSG_SIN_PARAM;
            host.parentNode.insertBefore(msg, host);
        }
        if (msg) msg.style.display = sin ? '' : 'none';
        if (host) host.style.display = sin ? 'none' : '';
        var btn = document.getElementById('hcliq-btn-filtrar');
        if (btn && btn.getAttribute('aria-busy') !== 'true') {
            btn.disabled = sin;
            if (sin) btn.title = HCLIQ_MSG_SIN_PARAM; else if (btn.title === HCLIQ_MSG_SIN_PARAM) btn.removeAttribute('title');
        }
    }
    function setLoading(on) {
        var ov = document.getElementById('hcliq-loading');
        if (ov) {
            ov.classList.toggle('hc-hidden', !on);
            ov.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
        var btn = document.getElementById('hcliq-btn-filtrar');
        if (btn) {
            btn.disabled = !!on || !selectedParams.length;
            btn.setAttribute('aria-busy', on ? 'true' : 'false');
        }
    }
    function setPendiente(on) {
        var btn = document.getElementById('hcliq-btn-filtrar');
        if (btn) btn.setAttribute('data-pending', on ? '1' : '0');
        var lbl = document.getElementById('hcliq-btn-filtrar-label');
        if (lbl && !(btn && btn.disabled)) lbl.textContent = on ? 'Aplicar cambios' : 'Filtrar';
    }
    function tablaColspan() {
        return 9 + appliedParams.length;
    }
    function renderTablaHead() {
        var head = document.getElementById('hcliq-tabla-lista-head');
        if (!head) return;
        var html = '<tr><th class="hcliq-col-exp"></th><th>N</th><th>Zona</th><th>Granja</th><th>Campaña</th><th>Inicio</th><th>Fin (liquidación)</th>';
        appliedParams.forEach(function (pk) {
            var m = paramMetaByKey[pk] || {};
            html += '<th>' + esc(m.label || pk) + '</th>';
        });
        html += '<th>Galpones</th><th>Acciones</th></tr>';
        head.innerHTML = html;
    }
    function renderLista(rows) {
        var body = document.getElementById('hcliq-tabla-lista-body');
        if (!body) return;
        listaRows = rows || [];
        if (!listaRows.length) {
            body.innerHTML = '<tr><td colspan="' + tablaColspan() + '" class="text-center text-gray-500 py-6">Sin liquidaciones para los filtros seleccionados.</td></tr>';
            return;
        }
        body.innerHTML = listaRows.map(function (r, idx) {
            var g = esc(r.granja);
            var c = esc(r.campania);
            var zonaTxt = esc(r.zona || r.subzona || '—');
            var nGalp = Number(r.num_galpones);
            var expCell = (isFinite(nGalp) && nGalp > 0)
                ? '<button type="button" class="hcliq-exp-btn" data-act="toggle" data-idx="' + idx + '" aria-expanded="false" title="Ver galpones"><i class="fas fa-chevron-right hcliq-chev"></i></button>'
                : '<span class="hcliq-exp-none"></span>';
            var valCells = '';
            var vmap = r.valores_por_parametro || {};
            appliedParams.forEach(function (pk) {
                valCells += '<td>' + esc(fmtValor(vmap[pk], pk)) + '</td>';
            });
            return '<tr>'
                + '<td class="hcliq-col-exp">' + expCell + '</td>'
                + '<td>' + esc(String(idx + 1)) + '</td>'
                + '<td>' + zonaTxt + '</td>'
                + '<td>' + esc(etiquetaGranja(r.granja)) + '</td>'
                + '<td>' + c + '</td>'
                + '<td>' + esc(fmtFechaEs(r.fecha_inicio)) + '</td>'
                + '<td>' + esc(fmtFechaEs(r.fecha_fin)) + '</td>'
                + valCells
                + '<td>' + esc(String(r.num_galpones != null ? r.num_galpones : '—')) + '</td>'
                + '<td><div class="hcliq-actions">'
                + '<button type="button" class="hcliq-btn-link" data-act="hc" data-granja="' + g + '" data-campania="' + c + '"><i class="fas fa-notes-medical"></i> Ver HC</button>'
                + '</div></td>'
                + '</tr>';
        }).join('');
    }
    function renderGalponesDetalle(galpones) {
        if (!galpones || !galpones.length) {
            return '<div class="hcliq-det-empty">Sin galpones registrados para esta campaña.</div>';
        }
        var html = '<table class="hcliq-det-table"><thead><tr><th>Galpón</th>';
        appliedParams.forEach(function (pk) {
            var m = paramMetaByKey[pk] || {};
            html += '<th>' + esc(m.label || pk) + '</th>';
        });
        html += '</tr></thead><tbody>';
        galpones.forEach(function (gp) {
            var valores = gp.valores || {};
            html += '<tr><td>' + esc(gp.galpon || '—') + '</td>';
            appliedParams.forEach(function (pk) {
                html += '<td>' + esc(fmtValor(valores[pk], pk)) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    }
    function toggleDetalleGalpones(btn) {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var row = btn.closest('tr');
        if (!row || !isFinite(idx)) return;
        var chev = btn.querySelector('.hcliq-chev');
        var next = row.nextElementSibling;
        if (next && next.classList.contains('hcliq-det-row')) {
            var abrir = next.classList.contains('lay-hidden');
            next.classList.toggle('lay-hidden', !abrir);
            btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
            if (chev) chev.classList.toggle('hcliq-chev-open', !!abrir);
            return;
        }
        var r = listaRows[idx];
        if (!r) return;
        var det = document.createElement('tr');
        det.className = 'hcliq-det-row';
        det.innerHTML = '<td colspan="' + tablaColspan() + '"><div class="hcliq-det-wrap"><div class="hcliq-det-loading"><span class="hcliq-spinner"></span> Cargando galpones…</div></div></td>';
        row.parentNode.insertBefore(det, row.nextSibling);
        btn.setAttribute('aria-expanded', 'true');
        if (chev) chev.classList.add('hcliq-chev-open');
        var p = new URLSearchParams();
        p.set('granja', normGranja(r.granja));
        p.set('campania', String(r.campania || '').trim());
        p.set('parametroKeys', appliedParams.join(','));
        get(API_GALPONES + '?' + p.toString()).then(function (res) {
            if (!res || !res.success) throw new Error((res && res.message) || 'Error al cargar galpones');
            det.querySelector('.hcliq-det-wrap').innerHTML = renderGalponesDetalle(res.data || []);
        }).catch(function (err) {
            var msg = String((err && err.message) || '');
            var esAuth = msg === 'auth' || msg === 'No autorizado (token Sanidad)' || msg.toLowerCase().indexOf('autorizado') !== -1;
            if (esAuth) {
                /* Quitar la fila de detalle y cerrar el chevron */
                det.parentNode && det.parentNode.removeChild(det);
                btn.setAttribute('aria-expanded', 'false');
                if (chev) chev.classList.remove('hcliq-chev-open');
                /* Abrir login de Sanidad en nueva ventana */
                var loginUrl = (window.SANIDAD_BASE || '/sanidad') + '/login.php';
                window.open(loginUrl, '_blank', 'noopener');
                return;
            }
            det.querySelector('.hcliq-det-wrap').innerHTML = '<div class="hcliq-det-error">' + esc(msg || 'No se pudo cargar la información.') + '</div>';
        });
    }
    /* Etiquetas de valor en cada nodo: halo para legibilidad y reubicación si chocan (modo combinado) */
    function hcliqPointLabelsPlugin() {
        return {
            id: 'hcliqPointLabels',
            afterDatasetsDraw: function (chart) {
                var ctx = chart.ctx;
                var tc = temaGrafico();
                var puestos = [];
                var h = 11;
                function choca(r) {
                    for (var i = 0; i < puestos.length; i++) {
                        var p = puestos[i];
                        if (r.x1 < p.x2 && r.x2 > p.x1 && r.y1 < p.y2 && r.y2 > p.y1) return true;
                    }
                    return false;
                }
                ctx.save();
                ctx.font = '600 10px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.lineJoin = 'round';
                chart.data.datasets.forEach(function (dataset, dsIndex) {
                    if (!chart.isDatasetVisible(dsIndex)) return;
                    var m = chart.getDatasetMeta(dsIndex);
                    if (!m || !m.data) return;
                    m.data.forEach(function (point, index) {
                        var raw = dataset.data[index];
                        if (raw == null || raw === '' || !isFinite(Number(raw)) || !point || point.skip) return;
                        if (!isFinite(point.x) || !isFinite(point.y)) return;
                        var real = dataset._real && dataset._real[index] != null ? dataset._real[index] : raw;
                        var label = fmtValorMeta(real, dataset) + (real !== raw ? ' ▲' : '');
                        var w = ctx.measureText(label).width + 4;
                        var cands = [point.y - 7, point.y + 7 + h, point.y - 7 - h, point.y + 7 + 2 * h];
                        var yb = cands[0];
                        for (var k = 0; k < cands.length; k++) {
                            var r = { x1: point.x - w / 2, x2: point.x + w / 2, y1: cands[k] - h, y2: cands[k] };
                            if (r.y1 < 0 || r.y2 > chart.height) continue;
                            if (!choca(r)) { yb = cands[k]; break; }
                        }
                        puestos.push({ x1: point.x - w / 2, x2: point.x + w / 2, y1: yb - h, y2: yb });
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = tc.tooltipBg || 'rgba(255, 255, 255, 0.9)';
                        ctx.strokeText(label, point.x, yb);
                        ctx.fillStyle = dataset.borderColor || tc.legend;
                        ctx.fillText(label, point.x, yb);
                    });
                });
                ctx.restore();
            }
        };
    }
    /* Colores de Chart.js según html[data-theme] (helper compartido de assets/js) */
    function temaGrafico() {
        if (window.TempTheme && typeof window.TempTheme.chartColors === 'function') {
            return window.TempTheme.chartColors();
        }
        return {
            tick: '#374151',
            grid: 'rgba(156, 163, 175, 0.45)',
            title: '#111827',
            legend: '#374151',
            tooltipBg: 'rgba(255, 255, 255, 0.96)',
            tooltipTitle: '#111827',
            tooltipBody: '#374151',
            tooltipBorder: '#e5e7eb'
        };
    }

    function buildScales(parametros, payload) {
        var tc = temaGrafico();
        var ejeCampania = payload && payload.ejeX === 'campania';
        var scales = {};
        var list = parametros && parametros.length ? parametros : [{ key: '', label: 'Valor', axisId: 'y', color: colorSerie(0) }];
        list.forEach(function (pm, i) {
            var id = pm.axisId || (i === 0 ? 'y' : ('y' + i));
            var ejeTitulo = pm.color ? String(pm.color) : tc.title;
            var ejeTick = pm.color ? String(pm.color) : tc.tick;
            scales[id] = {
                position: i % 2 === 0 ? 'left' : 'right', /* hasta 6 ejes alternando izq./der. */
                display: true,
                grid: { drawOnChartArea: i === 0, color: tc.grid },
                border: { color: ejeTitulo },
                title: { display: true, text: String(pm.label || ''), color: ejeTitulo },
                ticks: {
                    color: ejeTick,
                    callback: function (value, idx, ticks) { return esConteoK(Number(value), pm.decimals) ? fmtK(Number(value)) : Chart.Ticks.formatters.numeric.call(this, value, idx, ticks); }
                }
            };
        });
        scales.x = {
            title: { display: true, text: ejeCampania ? 'Campaña' : 'Mes liquidación', color: tc.title },
            grid: { color: tc.grid },
            border: { color: tc.grid },
            ticks: {
                color: tc.tick,
                callback: function (value) {
                    var raw = this.getLabelForValue(value);
                    if (ejeCampania) return String(raw);
                    return fmtMesCorto(raw) || String(raw);
                }
            }
        };
        /* Un solo punto / categoria: centrado en el eje X en vez de pegado al borde */
        if (((payload && payload.labels) || []).length === 1) scales.x.offset = true;
        return scales;
    }
    /* Selección de galpones: token "serie|galpón" (la serie identifica zona o granja) */
    function galponToken(serie, galpon) {
        return String(serie == null ? '' : serie) + '|' + galponKey(galpon);
    }

    function galponOpciones(payload, modo) {
        var porg = payload.porGalpon || [];
        var serieUnica = '';
        porg.forEach(function (row) {
            if (serieUnica === '' && String(row.serie || '') !== '') {
                serieUnica = String(row.serie);
            }
        });

        var lista = [];
        var vistos = {};
        if (modo === 'granja' && (payload.galpones || []).length) {
            (payload.galpones || []).forEach(function (gp) {
                var gk = galponKey(gp);
                if (gk === '' || vistos[gk]) return;
                vistos[gk] = true;
                lista.push({ serie: serieUnica, galpon: gk, galponLabel: String(gp || gk) });
            });
        } else {
            porg.forEach(function (row) {
                var gk = galponKey(row.galpon);
                var serie = String(row.serie || '');
                var id = galponToken(serie, gk);
                if (gk === '' || vistos[id]) return;
                vistos[id] = true;
                lista.push({ serie: serie, galpon: gk, galponLabel: String(row.galpon || gk) });
            });
        }

        lista.sort(function (a, b) {
            if (a.serie !== b.serie) return String(a.serie).localeCompare(String(b.serie));
            var na = parseInt(a.galpon, 10);
            var nb = parseInt(b.galpon, 10);
            if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
            return String(a.galpon).localeCompare(String(b.galpon));
        });

        var out = [opcionPromedio()];
        lista.forEach(function (item, idx) {
            var etiqueta = (modo === 'granjas' && item.serie !== '')
                ? (etiquetaGranja(item.serie) + ' · Galpón ' + item.galponLabel)
                : ('Galpón ' + item.galponLabel);
            out.push({
                id: galponToken(item.serie, item.galpon),
                serie: item.serie,
                galpon: item.galpon,
                label: etiqueta,
                indice: idx
            });
        });

        return out;
    }

    function galponesSeleccionadosChart() {
        return selectedGalpones.filter(function (id) {
            return !!galponCatalogo[id];
        });
    }

    function galponDatasets(payload, selecciones) {
        var labels = payload.labels || [];
        var parametros = payload.parametros || [];
        var porg = payload.porGalpon || [];
        var totalParam = parametros.length || 1;
        var out = [];

        if (selecciones.indexOf(HCLIQ_OPT_PROMEDIO) >= 0) {
            out = out.concat(datasetsPromedio(payload));
        }

        selecciones.forEach(function (id) {
            if (id === HCLIQ_OPT_PROMEDIO) return;
            var item = galponCatalogo[id];
            if (!item) return;
            parametros.forEach(function (pm, pi) {
                var porMes = {};
                porg.forEach(function (row) {
                    if (String(row.parametroKey || '') !== String(pm.key)) return;
                    if (String(row.serie || '') !== String(item.serie)) return;
                    if (galponKey(row.galpon) !== item.galpon) return;
                    porMes[String(row.mes)] = row.valor;
                });
                var color = colorSerie(item.indice * totalParam + pi);
                out.push({
                    label: String(pm.label || pm.key || '') + ' · ' + item.label,
                    data: labels.map(function (lab) {
                        return Object.prototype.hasOwnProperty.call(porMes, lab) ? porMes[lab] : null;
                    }),
                    borderColor: color,
                    backgroundColor: colorSerieRgba(color, 0.14),
                    borderDash: [],
                    tension: 0.2,
                    spanGaps: chartModo === 'granjas',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    parametroKey: pm.key,
                    decimals: pm.decimals,
                    suffix: pm.suffix,
                    serie: item.serie,
                    galponId: id,
                    yAxisID: pm.axisId
                });
            });
        });

        return out;
    }

    /* Serie de promedio de la granja (sin restringir galpón) */
    function datasetsPromedio(payload) {
        return (payload.datasets || []).map(function (ds) {
            return Object.assign({}, ds, {
                label: 'Consolidado general · ' + String(ds.label || ''),
                galponId: HCLIQ_OPT_PROMEDIO,
                serie: ''
            });
        });
    }

    function datasetsActuales(payload) {
        var selecciones = galponesSeleccionadosChart();
        if (selecciones.length && (chartModo === 'granja' || chartModo === 'granjas')) {
            return galponDatasets(payload, selecciones);
        }
        return payload.datasets || [];
    }
    function destroyCharts() {
        hcliqCharts.forEach(function (c) {
            try { c.destroy(); } catch (e) { /* noop */ }
        });
        hcliqCharts = [];
        hcliqChart = null;
    }
    function chartTooltip(payload, modo) {
        return {
            callbacks: {
                title: function (items) {
                    if (!items || !items.length) return '';
                    var labels = payload.labels || [];
                    var raw = String(labels[items[0].dataIndex] || '');
                    var meta = (payload.labelMeta || {})[raw] || null;
                    var fechas = (meta && meta.fechas) ? meta.fechas : [];
                    var camps = (meta && meta.campanias) ? meta.campanias : [];
                    var titulo = payload.ejeX === 'campania' ? ('Campaña ' + raw) : fmtMesEspanol(raw);
                    if (fechas.length === 1) {
                        titulo += '  ·  Liquidación ' + fmtFechaCorta(fechas[0]);
                    }
                    if (modo === 'granja' && camps.length === 1) {
                        titulo += '  ·  Campaña ' + camps[0];
                    }
                    return titulo;
                },
                label: function (ctx) {
                    var ds = ctx.dataset || {};
                    var v = ctx.parsed && ctx.parsed.y != null ? ctx.parsed.y : ctx.raw;
                    var fuera = ds._real && ds._real[ctx.dataIndex] != null;
                    if (fuera) v = ds._real[ctx.dataIndex];
                    var serie = ds.label ? ds.label : '';
                    var prov = (paramMetaByKey[ds.parametroKey || ''] || {}).provisional;
                    return (serie ? serie + ': ' : '') + fmtValorMeta(v, ds) + fmtValorFull(v, ds) + (prov ? ' (provisional)' : '')
                        + (esParcial(payload, ctx.dataIndex) ? ' — Mes en curso / datos parciales' : '')
                        + (fuera ? ' — fuera de escala' : '');
                }
            }
        };
    }
    function chartBaseOptions(payload, modo) {
        var tc = temaGrafico();
        return {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 28 } },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                zoom: {
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
                    pan: { enabled: true, mode: 'xy' }
                },
                legend: {
                    position: 'bottom',
                    labels: { color: tc.legend, usePointStyle: true, boxWidth: 8, boxHeight: 8 }
                },
                title: { display: false },
                tooltip: Object.assign({
                    backgroundColor: tc.tooltipBg,
                    titleColor: tc.tooltipTitle,
                    bodyColor: tc.tooltipBody,
                    borderColor: tc.tooltipBorder,
                    borderWidth: 1
                }, chartTooltip(payload, modo))
            }
        };
    }
    /* Comparativo interanual (mes actual vs mismo mes del año anterior y promedio del periodo) */
    function yoyTabla(payload, pm) {
        var y = payload && payload.yoy ? payload.yoy[pm.key] : null;
        if (!y || !(y.zonas || []).length) return null;
        var f = function (v) { return fmtValorMeta(v, { decimals: pm.decimals, suffix: '' }); };
        var cel = function (a, b) {
            var ok = a != null && b != null;
            return '<td>' + f(a) + '</td><td>' + f(b) + '</td><td>' + (ok ? f(b - a) : '—') + '</td><td>'
                + (ok && Number(a) !== 0 ? ((b - a) * 100 / Math.abs(a)).toFixed(1) + '%' : '—') + '</td>';
        };
        var MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        var h = '<table class="hcliq-yoy"><thead><tr><th rowspan="2">' + esc(pm.label || pm.key) + '</th>';
        y.zonas.forEach(function (z) { h += '<th colspan="4">' + esc(z.serie) + '</th>'; });
        h += '</tr><tr>';
        y.zonas.forEach(function () { h += '<th>' + y.anioPrev + '</th><th>' + y.anio + '</th><th>Dif.</th><th>% Dif.</th>'; });
        h += '</tr></thead><tbody>';
        MES.forEach(function (nm, i) {
            h += '<tr><td' + ((y.parciales || []).indexOf(i + 1) >= 0 ? ' title="Mes en curso / datos parciales">' + nm + '*' : '>' + nm) + '</td>';
            y.zonas.forEach(function (z) { var m = z.meses[i] || {}; h += cel(m.prev, m.cur); });
            h += '</tr>';
        });
        h += '<tr class="hcliq-yoy-prom"><td>Promedio</td>';
        y.zonas.forEach(function (z) { h += cel(z.promPrev, z.promCur); });
        var d = document.createElement('div');
        d.className = 'hcliq-yoy-wrap';
        d.innerHTML = h + '</tr></tbody></table>';
        return d;
    }
    function yoyHost(host) {
        var yh = document.getElementById('hcliq-yoy');
        if (!yh && host && host.parentElement) {
            yh = document.createElement('div');
            yh.id = 'hcliq-yoy';
            host.parentElement.insertAdjacentElement('afterend', yh);
        }
        return yh;
    }
    /* Mes en curso / datos parciales: punto hueco, tramo punteado, fuera del autoescalado */
    /* Zoom/pan (chartjs-plugin-zoom): rueda = zoom, arrastrar = pan, doble clic = restablecer */
    if (window.Chart && window.ChartZoom) { try { Chart.register(window.ChartZoom); } catch (e) { /* ya registrado */ } }
    function hcZoomReset(cv) {
        cv.addEventListener('dblclick', function () {
            var ch = window.Chart && Chart.getChart ? Chart.getChart(cv) : null;
            if (ch && ch.resetZoom) ch.resetZoom();
        });
    }
    function esParcial(payload, i) {
        var lab = ((payload && payload.labels) || [])[i];
        return lab != null && ((payload.parciales || []).indexOf(String(lab)) >= 0);
    }
    function marcarParciales(ds, payload) {
        if (!(payload && (payload.parciales || []).length)) return ds;
        ds.segment = { borderDash: function (c) { return esParcial(payload, c.p1DataIndex) ? [6, 4] : undefined; } };
        ds.pointBackgroundColor = function (c) { return esParcial(payload, c.dataIndex) ? '#fff' : c.dataset.borderColor; };
        ds.pointBorderColor = function (c) { return c.dataset.borderColor; };
        ds.clip = false;
        return ds;
    }
    /* Escala Y sobre puntos normales: excluye parciales y atípicos (IQR×3); los atípicos se dibujan en el borde con ▲ y valor real */
    function escalaSinParciales(scales, dsList, payload) {
        var rango = {}, atip = [];
        (dsList || []).forEach(function (ds) {
            var ax = ds.yAxisID || 'y';
            var src = ds._real ? ds.data.map(function (v, i) { return ds._real[i] != null ? ds._real[i] : v; }) : ds.data;
            var vals = (src || []).map(function (v, i) { return (v == null || v === '' || esParcial(payload, i) || !isFinite(Number(v))) ? null : Number(v); });
            var ok = vals.filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
            var lo = -Infinity, hi = Infinity;
            if (ok.length >= 4) {
                var q = function (p) { var k = (ok.length - 1) * p, f = Math.floor(k); return ok[f] + (ok[Math.min(f + 1, ok.length - 1)] - ok[f]) * (k - f); };
                var q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
                if (iqr > 0) { lo = q1 - 3 * iqr; hi = q3 + 3 * iqr; }
            }
            vals.forEach(function (n, i) {
                if (n == null) return;
                if (n < lo || n > hi) { atip.push({ ds: ds, i: i, n: n, ax: ax }); return; }
                var r = rango[ax] || (rango[ax] = { min: n, max: n });
                r.min = Math.min(r.min, n); r.max = Math.max(r.max, n);
            });
        });
        if (!atip.length && !(payload && (payload.parciales || []).length)) return;
        Object.keys(rango).forEach(function (ax) {
            if (!scales[ax]) return;
            var r = rango[ax], pad = (r.max - r.min) * 0.1 || Math.abs(r.max) * 0.05 || 1;
            scales[ax].min = r.min - pad;
            scales[ax].max = r.max + pad;
        });
        atip.forEach(function (a) {
            var sc = scales[a.ax];
            if (!sc || sc.max == null) return;
            var ds = a.ds;
            if (!ds._real) ds._real = [];
            ds._real[a.i] = a.n;
            ds.data = ds.data.slice();
            ds.data[a.i] = a.n > sc.max ? sc.max : sc.min;
            var estilos = ds.data.map(function (v, i) { return ds._real[i] != null ? 'triangle' : 'circle'; });
            ds.pointStyle = estilos;
            ds.pointRadius = ds.data.map(function (v, i) { return ds._real[i] != null ? 7 : 4; });
        });
    }
    function hcliqPanel(host, tituloPanel, color, dsPanel, labels, parametros, payload, modoChart) {
        var panel = document.createElement('div');
        panel.className = 'hcliq-chart-panel';
        var cap = document.createElement('div');
        cap.className = 'hcliq-chart-panel-title';
        cap.innerHTML = '<span class="hcliq-ms-dot" style="background:' + esc(color) + '"></span>'
            + '<span>' + esc(tituloPanel) + '</span>';
        var body = document.createElement('div');
        body.className = 'hcliq-chart-panel-body';
        var cv = document.createElement('canvas');
        body.appendChild(cv);
        panel.appendChild(cap);
        panel.appendChild(body);
        if (parametros.length === 1) {
            var yt = yoyTabla(payload, parametros[0]);
            if (yt) panel.appendChild(yt);
        }
        host.appendChild(panel);
        var opts = chartBaseOptions(payload, modoChart);
        opts.scales = buildScales(parametros, payload);
        escalaSinParciales(opts.scales, dsPanel, payload);
        hcliqCharts.push(new Chart(cv.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: dsPanel },
            plugins: [hcliqPointLabelsPlugin()],
            options: opts
        }));
        hcZoomReset(cv);
        /* Tras armar la rejilla, recalcula tamanos (el primer canvas nace con la rejilla de 1 columna) */
        if (!hcliqResizePend) {
            hcliqResizePend = true;
            requestAnimationFrame(function () {
                hcliqResizePend = false;
                hcliqCharts.forEach(function (c) { try { c.resize(); } catch (e) { /* noop */ } });
            });
        }
    }
    var hcliqResizePend = false;

    /* Agrupa datasets por entidad (galpón, granja o zona) para el modo "Sin combinar" */
    function panelesPorEntidad(lista, parametros, modoChart) {
        var grupos = [];
        var porClave = {};
        lista.forEach(function (ds) {
            var clave = ds.galponId ? String(ds.galponId) : String(ds.serie == null ? '' : ds.serie);
            if (clave === '') clave = '__unico__';
            if (!porClave[clave]) {
                var item = ds.galponId ? galponCatalogo[ds.galponId] : null;
                var titulo = item
                    ? item.label
                    : (modoChart === 'granjas'
                        ? etiquetaGranja(ds.serie)
                        : String(ds.serie || (parametros[0] && parametros[0].label) || ''));
                var zc = colorZonaEntidad(ds.serie, titulo);
                porClave[clave] = {
                    titulo: titulo,
                    color: (item && item.color) || (zc && zc.border) || ds.borderColor || colorSerie(grupos.length),
                    ds: []
                };
                grupos.push(porClave[clave]);
            }
            porClave[clave].ds.push(ds);
        });
        grupos.forEach(function (g) {
            g.sinDatos = !g.ds.some(function (d) {
                return (d.data || []).some(function (v) { return v != null && v !== ''; });
            });
        });
        return grupos;
    }
    function drawChart(payload, datasets, modo) {
        var wrap = document.getElementById('hcliq-chart-wrap');
        var host = document.getElementById('hcliq-chart-host');
        var titulo = document.getElementById('hcliq-chart-titulo');
        if (!wrap || !host) return;
        wrap.classList.remove('lay-hidden');
        if (titulo) titulo.textContent = payload.titulo || 'Gráficas';
        destroyCharts();
        host.innerHTML = '';
        var yh0 = yoyHost(host);
        if (yh0) yh0.innerHTML = '';
        var labels = payload.labels || [];
        var parametros = payload.parametros || [];
        var modoChart = String(modo || modoValue()).trim() || 'global';
        var lista = (datasets || []).map(function (ds) {
            return marcarParciales(Object.assign({ fill: false, borderWidth: 2 }, ds), payload);
        });

        if (modoChart === 'granjas') {
            lista = lista.map(function (ds) {
                if (!ds.serie || ds.galponId) return ds;
                var friendly = etiquetaGranja(ds.serie);
                return Object.assign({}, ds, {
                    label: String(ds.label || '').split(String(ds.serie)).join(friendly)
                });
            });
        }

        var combin = combinarValue();
        /* Sin combinar: un gráfico por parámetro y, si hay varias, por zona / granja / galpón */
        if (combin === 'separado') {
            var gruposEnt = panelesPorEntidad(lista, parametros, modoChart);
            var paneles = [];
            gruposEnt.forEach(function (gp) {
                var porParam = {};
                var ordenP = [];
                gp.ds.forEach(function (ds) {
                    var k = String(ds.parametroKey || '');
                    if (!porParam[k]) {
                        porParam[k] = [];
                        ordenP.push(k);
                    }
                    porParam[k].push(ds);
                });
                ordenP.forEach(function (k) {
                    var pm = null;
                    parametros.forEach(function (p) { if (String(p.key || '') === k) pm = p; });
                    var tP = pm ? String(pm.label || pm.key || '') : '';
                    var multiE = gruposEnt.length > 1;
                    var titulo = multiE ? (ordenP.length > 1 && tP ? (gp.titulo + ' · ' + tP) : gp.titulo) : (tP || gp.titulo);
                    paneles.push({
                        titulo: titulo + (gp.sinDatos ? ' (sin datos)' : ''),
                        color: multiE ? gp.color : ((pm && pm.color) || gp.color),
                        ds: porParam[k],
                        params: pm ? [pm] : parametros
                    });
                });
            });
            paneles.forEach(function (pn) {
                var reales = pn.ds.filter(esDatasetReal);
                if (reales.length === 1) {
                    var zc = colorZonaEntidad(reales[0].serie, pn.titulo);
                    if (zc) {
                        pn.ds = pn.ds.map(function (d) {
                            return esDatasetReal(d) ? aplicarColorParDataset(d, zc) : d;
                        });
                        pn.color = zc.border;
                    } else if (reales[0].borderColor) {
                        pn.color = reales[0].borderColor;
                    }
                } else if (reales.length > 1) {
                    var vi = 0;
                    pn.ds = pn.ds.map(function (d) {
                        if (!esDatasetReal(d)) return d;
                        var c = colorSerie(vi++);
                        return Object.assign({}, d, {
                            borderColor: c,
                            backgroundColor: colorSerieRgba(c, 0.14)
                        });
                    });
                }
            });
            if (paneles.length === 1) lista = paneles[0].ds;
            if (paneles.length > 1) {
                host.classList.add('hcliq-charts-grid');
                if (wrap) wrap.classList.add('hcliq-chart-wrap--grid');
                /* La rejilla crece con sus paneles: con alto fijo se desborda y tapa la tabla */
                if (host.parentElement) host.parentElement.style.height = 'auto';
                paneles.forEach(function (pn) {
                    hcliqPanel(host, pn.titulo, pn.color, pn.ds, labels, pn.params, payload, modoChart);
                });
                return;
            }
        }

        /* Combinar entidades: un panel por parámetro con granjas, campañas o galpones como líneas */
        if (combin === 'entidad' && parametros.length > 1) {
            host.classList.add('hcliq-charts-grid');
            if (wrap) wrap.classList.add('hcliq-chart-wrap--grid');
                /* La rejilla crece con sus paneles: con alto fijo se desborda y tapa la tabla */
                if (host.parentElement) host.parentElement.style.height = 'auto';
            parametros.forEach(function (pm) {
                var dsP = lista.filter(function (ds) {
                    return String(ds.parametroKey || '') === String(pm.key || '');
                });
                if (!dsP.length) return;
                dsP = remapearColoresCombinado(dsP, combin, parametros);
                hcliqPanel(host, pm.label || pm.key || '', pm.color || colorSerie(0), dsP, labels, [pm], payload, modoChart);
            });
            return;
        }

        host.classList.remove('hcliq-charts-grid');
        if (wrap) wrap.classList.remove('hcliq-chart-wrap--grid');
        if (host.parentElement) host.parentElement.style.height = '';
        lista = remapearColoresCombinado(lista, combin, parametros);
        var canvas = document.createElement('canvas');
        canvas.id = 'hcliq-chart';
        canvas.setAttribute('aria-label', 'Gráfico de indicadores por zona');
        host.appendChild(canvas);
        var options = chartBaseOptions(payload, modoChart);
        options.scales = buildScales(parametros, payload);
        escalaSinParciales(options.scales, lista, payload);
        hcliqChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: lista },
            plugins: [hcliqPointLabelsPlugin()],
            options: options
        });
        hcliqCharts.push(hcliqChart);
        hcZoomReset(canvas);
        var yh = yoyHost(host);
        if (yh) parametros.forEach(function (pm) { var t = yoyTabla(payload, pm); if (t) yh.appendChild(t); });
    }
    /* Entidades graficables según la selección en vivo (antes de filtrar) */
    function entidadesChart() {
        var modo = modoValue();
        if (modo === 'granjas') {
            var selGp = galponesSeleccionadosChart();
            if (selGp.length) return selGp.length;
            if (selectedGalpones.length) return selectedGalpones.length;
            return Math.max(1, selectedGranjas.length);
        }
        if (modo === 'granja') {
            var selG = galponesSeleccionadosChart();
            return Math.max(1, selG.length || selectedGalpones.length);
        }
        var sel = galponesSeleccionadosChart();
        if (sel.length) return sel.length;
        /* Elegir zona: una zona concreta no tiene nada que combinar; 'Todas' cuenta como 2+ */
        var zonaSel = ((document.getElementById('hcliq-zona') || {}).value || '').trim();
        if (modo === 'global') return zonaSel !== '' ? 1 : Math.max(2, zonasEnCatalogo());
        if (!chartPayload) return zonasEnCatalogo();
        var set = {};
        (chartPayload.datasets || []).forEach(function (ds) {
            var s = String(ds.serie == null ? '' : ds.serie);
            if (s !== '') set[s] = 1;
        });
        var n = Object.keys(set).length;
        if (n === 0) return (chartPayload.datasets || []).length ? 1 : 0;
        return n;
    }
    function zonasEnCatalogo() {
        var set = {};
        (catalogoUbicacion || []).forEach(function (g) {
            var z = String(g.zona || '').trim();
            if (z !== '') set[z] = 1;
        });
        var n = Object.keys(set).length;
        return n > 0 ? n : 1;
    }
    function actualizarEtiquetaCombinar() {
        var sel = document.getElementById('hcliq-combinar');
        if (!sel) return;
        var nParam = selectedParams.length
            || (chartPayload && (chartPayload.parametros || []).length)
            || 1;
        var nEnt = entidadesChart();
        var modo = modoValue();
        var optTipo = sel.querySelector('option[value="tipo"]');
        var optEnt = sel.querySelector('option[value="entidad"]');
        var entTxt = modo === 'granja' ? 'campañas o galpones' : (modo === 'global' ? 'zonas' : 'granjas, campañas o galpones');
        if (optEnt) {
            optEnt.textContent = modo === 'granja'
                ? 'Combinar campañas / galpones'
                : (modo === 'global' ? 'Combinar zonas' : 'Combinar granjas / campañas');
            optEnt.style.display = '';
            optEnt.disabled = nEnt <= 1;
            optEnt.title = nEnt <= 1 ? ('Requiere 2 o más ' + entTxt) : '';
        }
        if (optTipo) {
            optTipo.style.display = '';
            optTipo.disabled = nParam <= 1 || nParam > 6;
            optTipo.title = nParam <= 1 ? 'Requiere 2 o más parámetros' : (nParam > 6 ? 'Máximo 6 parámetros (6 ejes)' : '');
        }
        if (sel.value === 'tipo' && (nParam <= 1 || nParam > 6)) sel.value = 'separado';
        if (sel.value === 'entidad' && nEnt <= 1) sel.value = 'separado';
        /* Siempre visible: si no hay nada que combinar queda deshabilitado con el motivo en el tooltip */
        var sinOpc = nParam <= 1 && nEnt <= 1;
        sel.disabled = false; /* siempre se puede abrir; solo se deshabilitan las opciones que no aplican */
        sel.title = sinOpc ? ('Para combinar seleccione 2 o más parámetros o 2 o más ' + entTxt) : '';
        var wrap = document.getElementById('hcliq-combinar-wrap');
        if (wrap) {
            wrap.style.display = '';
            wrap.title = sel.title;
        }
    }

    function loadGalponesChartOpciones(payload, modo) {
        var conGalpones = !!payload && (modo === 'granja' || modo === 'granjas');
        galponCatalogo = {};
        if (!conGalpones) {
            selectedGalpones = [];
            if (msGalpones) msGalpones.setOptions([], []);
            actualizarEtiquetaCombinar();
            return;
        }
        var totalParam = (payload.parametros || []).length || 1;
        var opciones = galponOpciones(payload, modo);
        var idPorGalpon = {};
        var opcionesMs = [];
        opciones.forEach(function (o) {
            var esPromedio = o.id === HCLIQ_OPT_PROMEDIO;
            var color = esPromedio ? '#64748b' : colorSerie(o.indice * totalParam);
            galponCatalogo[o.id] = {
                serie: o.serie,
                galpon: o.galpon,
                label: o.label,
                indice: o.indice,
                color: color
            };
            opcionesMs.push({ id: o.id, label: o.label, color: color });
            if (o.galpon && !idPorGalpon[o.galpon]) idPorGalpon[o.galpon] = o.id;
        });
        selectedGalpones = selectedGalpones.map(function (id) {
            if (galponCatalogo[id]) return id;
            if (modo !== 'granja') return id;
            var k = String(id).split('|').pop();
            return idPorGalpon[k] || id;
        });
        /* Galpón elegido sin valores en el periodo: se conserva (gráfico vacío) en vez de caer al promedio */
        selectedGalpones.forEach(function (id) {
            if (galponCatalogo[id] || id === HCLIQ_OPT_PROMEDIO) return;
            var partes = String(id).split('|');
            var gk = galponKey(partes.pop());
            var serie = modo === 'granja' ? ((opciones[1] && opciones[1].serie) || HCLIQ_SERIE_GRANJA_TODOS) : partes.join('|');
            if (gk === '') return;
            var idx = opcionesMs.length;
            var color = colorSerie(idx * totalParam);
            var label = (modo === 'granjas' && serie !== '' ? (etiquetaGranja(serie) + ' · ') : '') + 'Galpón ' + gk;
            var nuevoId = galponToken(serie, gk);
            galponCatalogo[nuevoId] = { serie: serie, galpon: gk, label: label, indice: idx, color: color };
            opcionesMs.push({ id: nuevoId, label: label, color: color });
            if (nuevoId !== id) selectedGalpones[selectedGalpones.indexOf(id)] = nuevoId;
        });
        selectedGalpones = selectedGalpones.filter(function (id, i, arr) {
            return !!galponCatalogo[id] && arr.indexOf(id) === i;
        });
        if (msGalpones) msGalpones.setOptions(opcionesMs, selectedGalpones);
        actualizarEtiquetaCombinar();
        actualizarGalponesGranja();
    }

    function renderChart(payload, modo) {
        chartModo = String(modo || modoValue()).trim() || 'global';
        if (chartModo === 'granjas') syncSeleccionUbicacion();
        var wrap = document.getElementById('hcliq-chart-wrap');
        if (!payload) return;
        loadGalponesChartOpciones(payload, chartModo);
        var datasets = datasetsActuales(payload);
        if (!(payload.labels || []).length || !datasets.length) {
            if (wrap) wrap.classList.add('lay-hidden');
            return;
        }
        drawChart(payload, datasets, chartModo);
    }

    function refrescarGraficoActual() {
        if (!chartPayload) return;
        var datasets = datasetsActuales(chartPayload);
        if (!(chartPayload.labels || []).length || !datasets.length) {
            return;
        }
        drawChart(chartPayload, datasets, chartModo);
    }
    function avisoSinDatos(rows, payload) {
        var hayChart = payload && (payload.labels || []).length > 0 && (payload.datasets || []).length > 0;
        if (hayChart || (rows && rows.length)) return;
        Swal.fire({
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay liquidaciones liquidadas para el periodo y filtros seleccionados.'
        });
    }
    function openHc(granja, campania) {
        var qs = 'granja=' + encodeURIComponent(granja)
            + '&campania=' + encodeURIComponent(campania) + '&periodoTipo=TODOS';
        var base = window.SANIDAD_BASE || '';
        var urlMod = base + '/modules/sip/historia-clinica/dashboard-historia-clinica.php?' + qs;
        if (window.top !== window.self && typeof window.top.ix2LoadModuleSinContexto === 'function') {
            window.top.ix2LoadModuleSinContexto(urlMod.replace(/^\//, ''), 'Historia clínica');
        } else {
            window.open(urlMod, '_blank', 'noopener');
        }
    }
    function filtrar() {
        var btnF = document.getElementById('hcliq-btn-filtrar');
        if (btnF && btnF.disabled) return;
        if (!hcPeriodoValido()) {
            Swal.fire({ icon: 'warning', title: 'Periodo', text: 'Complete el periodo de consulta.' });
            return;
        }
        var modo = modoValue();
        if (modo === 'granja' && !normGranja((document.getElementById('hcliq-granja') || {}).value)) {
            Swal.fire({ icon: 'warning', title: 'Granja', text: 'Seleccione una granja para la vista por granja.' });
            return;
        }
        if (modo === 'granjas' && !selectedGranjas.length) {
            Swal.fire({ icon: 'warning', title: 'Granjas', text: 'Seleccione al menos una granja para la vista por granjas.' });
            return;
        }
        if (!selectedParams.length) {
            hcSinParamsUI();
            return;
            Swal.fire({ icon: 'warning', title: 'Parámetro', text: 'Seleccione al menos un parámetro.' });
            return;
        }
        var p = buildQueryParams();
        var seq = ++hcliqReqSeq;
        setLoading(true);
        loadUbicacionCatalogo().then(function () {
            if (seq !== hcliqReqSeq) return null;
            loadGranjas();
            if (modo === 'granja') loadCampaniasDeCatalogo(true);
            if (modo === 'granjas' && !selectedGranjas.length) {
                throw new Error('Seleccione al menos una granja para la vista por granjas.');
            }
            p = buildQueryParams();
            return get(API_PAYLOAD + '?' + p.toString());
        }).then(function (res) {
            if (!res) return;
            if (seq !== hcliqReqSeq) return;
            if (!res.success) {
                throw new Error((res && res.message) || 'Error al cargar la información');
            }
            if (Array.isArray(res.parametros) && res.parametros.length) {
                aplicarCatalogoParametros(res.parametros);
            }
            chartPayload = res.chart || {};
            chartQs = p.toString();
            appliedParams = selectedParams.slice();
            setPendiente(false);
            renderTablaHead();
            renderLista(res.data || []);
            avisoSinDatos(res.data || [], chartPayload);
            renderChart(chartPayload, res.modo || modo);
        }).catch(function (err) {
            if (String(err && err.message) === 'auth') return;
            Swal.fire({ icon: 'error', title: 'Error', text: (err && err.message) || 'No se pudo cargar la información.' });
        }).then(function () {
            if (seq === hcliqReqSeq) setLoading(false);
        });
    }
    function defaultParamKey(list) {
        var items = Array.isArray(list) ? list : CATALOGO;
        if (!items || !items.length) return 'CARGA_INICIAL';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var l = String(it.label || '').toLowerCase();
            var k = String(it.key || '').toLowerCase();
            if (l.indexOf('carga inicial') !== -1 || k.indexOf('carga_inicial') !== -1 || k === 'carga_inicial') {
                return String(it.key);
            }
        }
        return String(items[0].key || '');
    }

    function aplicarCatalogoParametros(list) {
        if (!Array.isArray(list) || !list.length) return;
        CATALOGO = list;
        paramOrder = list.map(function (p) { return String(p.key || '') }).filter(function (k) { return k !== ''; });
        list.forEach(function (p) {
            paramMetaByKey[String(p.key || '')] = p;
        });
        var defKey = defaultParamKey(list);
        if (!selectedParams.length || (selectedParams.length === 1 && (selectedParams[0] === 'ICA_2_4' || selectedParams[0] === 'CARGA_INICIAL'))) {
            selectedParams = [defKey];
        }
        if (msParametros) {
            msParametros.setOptions(list.map(function (p) {
                return { id: String(p.key || ''), label: String(p.label || p.key || ''), color: String(p.color || '') };
            }), selectedParams.length ? selectedParams : [defKey]);
        }
    }

    function initParametrosMS() {
        paramOrder = CATALOGO.map(function (p) { return String(p.key || '') }).filter(function (k) { return k !== ''; });
        CATALOGO.forEach(function (p) {
            paramMetaByKey[String(p.key || '')] = p;
        });
        if (!paramOrder.length) {
            paramOrder = ['CARGA_INICIAL', 'ICA_2_4'];
            paramMetaByKey['CARGA_INICIAL'] = { key: 'CARGA_INICIAL', label: 'Carga inicial (und)', decimals: 0, suffix: ' und' };
            paramMetaByKey['ICA_2_4'] = { key: 'ICA_2_4', label: 'ICA 2.4', decimals: 3, suffix: '' };
        }
        var defKey = defaultParamKey(CATALOGO.length ? CATALOGO : [{ key: 'CARGA_INICIAL', label: 'Carga inicial (und)' }]);
        selectedParams = [defKey];
        msParametros = new HcliqMultiSelect({
            btnId: 'hcliq-param-btn',
            labelId: 'hcliq-param-label',
            dropdownId: 'hcliq-param-dropdown',
            searchId: 'hcliq-param-search',
            optionsContainerId: 'hcliq-param-options',
            maxSelected: 0, /* sin tope; multieje se limita a 6 en actualizarEtiquetaCombinar */
            onChange: function (ids) {
                var orden = paramOrder.filter(function (k) { return ids.indexOf(k) >= 0; });
                selectedParams = orden;
                actualizarEtiquetaCombinar();
                hcSinParamsUI();
                setPendiente(true);
            }
        });
        msParametros.setOptions(CATALOGO.map(function (p) {
            return { id: String(p.key || ''), label: String(p.label || p.key || ''), color: String(p.color || '') };
        }), selectedParams);
    }
    function refrescarCampaniasPeriodo() {
        if (modoValue() !== 'granja') return;
        loadUbicacionCatalogo().then(function () { loadCampaniasDeCatalogo(true); });
    }
    function initCampaniasMS() {
        msCampanias = new HcliqMultiSelect({
            btnId: 'hcliq-campania-btn',
            labelId: 'hcliq-campania-label',
            dropdownId: 'hcliq-campania-dropdown',
            searchId: 'hcliq-campania-search',
            optionsContainerId: 'hcliq-campania-options',
            maxSelected: 500,
            emptyLabel: 'Todas',
            onChange: function (ids) {
                selectedCampaniasGranja = ids.slice();
                setPendiente(!payloadVigente());
            }
        });
        /* Igual que el selector de ubicación: al cerrar con cambios se consulta sola */
        var dd = document.getElementById('hcliq-campania-dropdown');
        if (dd && typeof MutationObserver === 'function') {
            new MutationObserver(function () {
                if (dd.classList.contains('hc-hidden') && modoValue() === 'granja' && chartQs !== '' && !payloadVigente()) aplicarSiDesfasado();
            }).observe(dd, { attributes: true, attributeFilter: ['class'] });
        }
    }
    function initGalponesMS() {
        msGalpones = new HcliqMultiSelect({
            btnId: 'hcliq-galpon-btn',
            labelId: 'hcliq-galpon-label',
            dropdownId: 'hcliq-galpon-dropdown',
            searchId: 'hcliq-galpon-search',
            optionsContainerId: 'hcliq-galpon-options',
            maxSelected: 40,
            emptyLabel: 'Ninguno',
            maxMessage: 'Máximo {n} galpones por consulta.',
            onChange: function (ids) {
                selectedGalpones = ids.slice();
                actualizarEtiquetaCombinar();
                aplicarSiDesfasado();
            }
        });
    }

    function initUbicacionMS() {
        if (typeof CustomHierarchicalMultiSelect !== 'function') return;
        /* Al cerrar el selector jerarquico con cambios pendientes se aplica la consulta */
        var ddUbic = document.getElementById('hcliq-ubic-dropdown');
        if (ddUbic && typeof MutationObserver === 'function') {
            new MutationObserver(function () {
                if (ddUbic.classList.contains('hidden') && modoValue() === 'granjas' && !payloadVigente()) aplicarSiDesfasado();
            }).observe(ddUbic, { attributes: true, attributeFilter: ['class'] });
        }
        msUbicacion = new CustomHierarchicalMultiSelect({
            btnId: 'hcliq-ubic-btn',
            labelId: 'hcliq-ubic-label',
            dropdownId: 'hcliq-ubic-dropdown',
            searchId: 'hcliq-ubic-search',
            optionsContainerId: 'hcliq-ubic-options',
            btnLimpiarId: 'hcliq-ubic-limpiar',
            strictGalpones: true,
            onChange: function () {
                syncSeleccionUbicacion();
                actualizarEtiquetaCombinar();
                setPendiente(true);
            }
        });
    }
    /* Traduce la selección jerárquica a granjas, campañas y galpones del gráfico */
    function syncSeleccionUbicacion() {
        if (!msUbicacion || modoValue() !== 'granjas') return;
        selectedGranjas = [];
        selCampaniasPorGranja = {};
        selGalponesPorGranja = {};
        var galponesChart = [];
        catalogoUbicacion.forEach(function (g) {
            var gRaw = String(g.granja || g.codigo || g.nombre);
            var gId = normGranja(gRaw);
            if (gId === '' || !msUbicacion.selectedGranjas.has(gRaw)) return;
            selectedGranjas.push(gId);
            var camps = [];
            (g.campanias || []).forEach(function (c) {
                if (msUbicacion.selectedCampanias.has(gRaw + '__' + c)) camps.push(String(c));
            });
            var galps = [];
            (g.galpones || []).forEach(function (gp) {
                if (msUbicacion.selectedGalpones.has(gRaw + '__' + gp)) {
                    galps.push(String(gp));
                    galponesChart.push(galponToken(gId, gp));
                }
            });
            var completo = camps.length === (g.campanias || []).length;
            if (camps.length && !completo) selCampaniasPorGranja[gId] = camps;
            var completoG = galps.length === (g.galpones || []).length;
            if (galps.length && !completoG) selGalponesPorGranja[gId] = galps;
        });
        selectedGranjas = selectedGranjas.filter(function (g, i, arr) { return arr.indexOf(g) === i; });
        selectedGalpones = galponesChart.filter(function (g, i, arr) { return arr.indexOf(g) === i; });
    }
    function loadUbicacionCatalogo() {
        if (!msUbicacion) return Promise.resolve();
        var p = new URLSearchParams();
        hcAppendPeriodoParams(p);
        p.set('fuenteLiq', '1'); /* mismas campañas que el gráfico (liquidaciones movi_zonas) */
        return get(API_UBICACION + '?' + p.toString()).then(function (res) {
            if (!res || !res.success) return;
            catalogoUbicacion = res.granjas || [];
            catalogoUbicacion.forEach(function (g) {
                var nk = normGranja(g.granja || '');
                if (nk !== '' && g.nombre) metaByGranja[nk] = String(g.nombre).trim();
            });
            /* Nombres llegan después de la tabla: re-pintar para mostrar 'código · nombre' */
            if (typeof listaRows !== 'undefined' && listaRows && listaRows.length) renderLista(listaRows);
            var prev = {
                granjas: new Set(msUbicacion.selectedGranjas),
                campanias: new Set(msUbicacion.selectedCampanias),
                galpones: new Set(msUbicacion.selectedGalpones)
            };
            msUbicacion.setData(catalogoUbicacion, false);
            if (prev.granjas.size > 0) {
                reaplicarSeleccionUbicacion(prev);
            }
            syncSeleccionUbicacion();
        }).catch(function () {});
    }
    /* Conserva la selección previa limitada al catálogo vigente del periodo */
    function reaplicarSeleccionUbicacion(prev) {
        msUbicacion.selectedGranjas.clear();
        msUbicacion.selectedCampanias.clear();
        msUbicacion.selectedGalpones.clear();
        catalogoUbicacion.forEach(function (g) {
            var gRaw = String(g.granja || g.codigo || g.nombre);
            if (!prev.granjas.has(gRaw)) return;
            msUbicacion.selectedGranjas.add(gRaw);
            (g.campanias || []).forEach(function (c) {
                if (prev.campanias.has(gRaw + '__' + c)) msUbicacion.selectedCampanias.add(gRaw + '__' + c);
            });
            (g.galpones || []).forEach(function (gp) {
                if (prev.galpones.has(gRaw + '__' + gp)) msUbicacion.selectedGalpones.add(gRaw + '__' + gp);
            });
        });
        msUbicacion.updateLabel();
        msUbicacion.render();
    }
    function loadZonas() {
        return get(API_GRANJAS + '?action=zonas').then(function (res) {
            var sel = document.getElementById('hcliq-zona');
            if (!sel) return;
            var html = '<option value="">Todas</option>';
            (res && res.data ? res.data : []).forEach(function (z) {
                var zz = String(z || '').trim();
                if (!zz) return;
                html += '<option value="' + esc(zz) + '">' + esc(zz) + '</option>';
            });
            sel.innerHTML = html;
        }).catch(function () {});
    }
    /* Granjas agrupadas por zona (encabezados en negrita del select Granja) */
    function loadGranjas() {
        var sel = document.getElementById('hcliq-granja');
        if (!sel) return Promise.resolve();
        var prev = String(sel.value || '');
        var grupos = {};
        var zonas = [];
        catalogoUbicacion.forEach(function (g) {
            var cod = normGranja(String(g.granja || g.codigo || g.nombre));
            if (cod === '' || cod.charAt(0) !== '6') return;
            metaByGranja[cod] = String(g.nombre || '').trim();
            var z = String(g.zona || '').trim() || 'Sin zona';
            if (!grupos[z]) {
                grupos[z] = [];
                zonas.push(z);
            }
            grupos[z].push({ cod: cod, nombre: String(g.nombre || '').trim() });
        });
        zonas.sort(function (a, b) { return a.localeCompare(b); });
        var html = '<option value="">— Seleccione —</option>';
        zonas.forEach(function (z) {
            html += '<optgroup label="' + esc(z) + '">';
            grupos[z].sort(function (a, b) { return a.cod.localeCompare(b.cod); }).forEach(function (g) {
                html += '<option value="' + esc(g.cod) + '">' + esc(g.cod + (g.nombre ? ' · ' + g.nombre : '')) + '</option>';
            });
            html += '</optgroup>';
        });
        sel.innerHTML = html;
        if (prev !== '' && sel.querySelector('option[value="' + prev.replace(/"/g, '\\"') + '"]')) {
            sel.value = prev;
        } else {
            sel.value = '';
        }
        return Promise.resolve();
    }
    function loadGranjaOpciones() {
        return loadGranjas().then(function () {
            loadCampaniasDeCatalogo(false);
            loadGalponesDeCatalogo();
            actualizarGalponesGranja();
        });
    }
    function hcInitFlatpickrMesEspanol() {
        if (typeof flatpickr === 'undefined') return;
        var locale = (flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es';
        document.querySelectorAll('.hc-fp-mes').forEach(function (el) {
            flatpickr(el, {
                locale: locale,
                plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: 'Y-m', altFormat: 'm-Y' })],
                allowInput: true,
                altInput: true,
                altInputClass: 'hc-per-input hc-fp-mes'
            });
        });
        document.querySelectorAll('.hc-input-fecha-es').forEach(function (el) {
            flatpickr(el, {
                locale: locale,
                dateFormat: 'd-m-Y',
                allowInput: true
            });
        });
    }
    /* Entre meses: siempre ene del año anterior .. dic del año actual */
    function hcDefaultEntreMeses() {
        var y = new Date().getFullYear();
        [['hcliq-mesInicio', (y - 1) + '-01'], ['hcliq-mesFin', y + '-12']].forEach(function (p) {
            var el = document.getElementById(p[0]);
            if (!el) return;
            if (el._flatpickr) el._flatpickr.setDate(p[1], false, 'Y-m');
            el.value = p[1];
        });
    }
    function marcarCambiosServidor() {
        setPendiente(true);
    }
    /* Diseño de gráficos: 'h' = 2 columnas, 'v' = uno por fila (persistido) */
    function hcAplicarLayout(modo) {
        var host = document.getElementById('hcliq-chart-host');
        if (!host) return;
        modo = modo === 'v' ? 'v' : 'h';
        host.classList.toggle('hcliq-lay-v', modo === 'v');
        host.classList.toggle('hcliq-lay-h', modo === 'h');
        document.querySelectorAll('.hcliq-lay-btn').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-lay') === modo); });
        try { localStorage.setItem('hcliq-layout', modo); } catch (e) { /* noop */ }
        requestAnimationFrame(function () { hcliqCharts.forEach(function (c) { try { c.resize(); } catch (e) { /* noop */ } }); });
    }
    function initLayoutToggle() {
        var guardado = 'h';
        try { guardado = localStorage.getItem('hcliq-layout') || 'h'; } catch (e) { /* noop */ }
        document.querySelectorAll('.hcliq-lay-btn').forEach(function (b) {
            b.addEventListener('click', function () { hcAplicarLayout(b.getAttribute('data-lay')); });
        });
        hcAplicarLayout(guardado);
    }
    function initEventos() {
        initLayoutToggle();
        document.getElementById('hcliq-periodoTipo').addEventListener('change', function () {
            if (this.value === 'ENTRE_MESES') hcDefaultEntreMeses();
            aplicarVisibilidadPeriodo();
            marcarCambiosServidor();
            refrescarCampaniasPeriodo();
        });
        ['hcliq-fechaUnica', 'hcliq-fechaInicio', 'hcliq-fechaFin', 'hcliq-mesUnico', 'hcliq-mesInicio', 'hcliq-mesFin'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function () {
                marcarCambiosServidor();
                refrescarCampaniasPeriodo();
            });
        });
        document.getElementById('hcliq-zona').addEventListener('change', function () {
            actualizarEtiquetaCombinar();
            marcarCambiosServidor();
        });
        document.getElementById('hcliq-modo').addEventListener('change', function () {
            toggleGranjaField();
            marcarCambiosServidor();
        });
        document.getElementById('hcliq-granja').addEventListener('change', function () {
            loadCampaniasDeCatalogo(false);
            loadGalponesDeCatalogo();
            actualizarGalponesGranja();
            marcarCambiosServidor();
        });
        document.getElementById('hcliq-combinar').addEventListener('change', function () {
            actualizarEtiquetaCombinar();
            refrescarGraficoActual();
        });
        document.getElementById('hcliq-btn-filtrar').addEventListener('click', filtrar);
        ['hcliq-fechaUnica', 'hcliq-fechaInicio', 'hcliq-fechaFin'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    filtrar();
                }
            });
        });
        document.getElementById('hcliq-tabla-lista-body').addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-act]');
            if (!btn) return;
            var act = btn.getAttribute('data-act');
            if (act === 'toggle') {
                toggleDetalleGalpones(btn);
                return;
            }
            if (act === 'hc') {
                openHc(btn.getAttribute('data-granja') || '', btn.getAttribute('data-campania') || '');
            }
        });
    }
    aplicarVisibilidadPeriodo();
    toggleGranjaField();
    hcInitFlatpickrMesEspanol();
    hcDefaultEntreMeses();
    initParametrosMS();
    initUbicacionMS();
    initGalponesMS();
    initCampaniasMS();
    initEventos();
    if (window.TempTheme && typeof window.TempTheme.onChange === 'function') {
        window.TempTheme.onChange(function () {
            refrescarGraficoActual();
        });
    }
    Promise.all([loadZonas(), loadUbicacionCatalogo()]).then(function () {
        return loadGranjaOpciones();
    }).then(function () {
        filtrar();
    });
})();
