(function () {
    'use strict';

    var SANIDAD_BASE = (window.location && window.location.origin ? window.location.origin : '') + '/sanidad';
    var API_CRUD = SANIDAD_BASE + '/modules/temperatura/crud_temp_transporte_pollo_bb.php';

    function el(id) {
        return document.getElementById(id);
    }

    function get(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP_' + r.status);
            return r.json();
        });
    }

    function escHtml(s) {
        if (!s) return '';
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(s));
        return d.innerHTML;
    }

    function escAttr(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function ttpbbGalponUtil(raw) {
        var s = String(raw || '').trim();
        if (!s || s === '—' || s === '-' || /^n\/a$/i.test(s) || /^null$/i.test(s)) return '';
        return s;
    }

    function ttpbbPrimerGalpon(raw) {
        var s = ttpbbGalponUtil(raw);
        if (!s) return '';
        var toks = s.split(/[\s,;|]+/).filter(function (t) {
            return t && t !== '-' && t !== '—';
        });
        return toks.length ? toks[0] : s;
    }

    function ttpbbOpenHcGraficaModal(det) {
        var fn = window.hcTtpbbOpenModal
            || (window.TtpbbGraficaModal && window.TtpbbGraficaModal.open);
        if (typeof fn !== 'function') {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Gráfica', text: 'No se pudo abrir el modal.' });
            }
            return false;
        }
        fn(det);
        return true;
    }

    function ttpbbConVerGrafica(codGranja, campania, galpones, placa, idsCab) {
        codGranja = String(codGranja || '').trim();
        campania = String(campania || '').trim();
        if (campania === '—') campania = '';
        var galpon = ttpbbPrimerGalpon(galpones);
        idsCab = String(idsCab || '').trim();
        placa = String(placa || '').trim();
        var metaHc = el('ttpbb-con-meta');
        if (metaHc) metaHc.textContent = '';
        if (!codGranja && !idsCab) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Consulta', text: 'Faltan datos para cargar la gráfica.' });
            }
            return Promise.reject(new Error('Faltan datos'));
        }
        var det = {
            parametro: 'Temperatura de transporte de pollo BB',
            tipoDato: 'Temperatura',
            tareaKey: 'CRIANZA_TEMPERATURA_DE_TRANSPORTE_DE_POLLO_BB',
            tempCamion: true,
            lazy: true,
            dias: [],
            granja: codGranja,
            campania: campania,
            galpon: galpon,
            galponLabel: galpon,
            placa: placa
        };
        if (!codGranja || !campania) {
            det.idCab = idsCab;
        }
        if (!ttpbbOpenHcGraficaModal(det)) {
            return Promise.reject(new Error('Modal no disponible'));
        }
        return Promise.resolve();
    }

    /* ─── Periodo: toggle visibilidad según tipo ─── */
    function ttpbbConActualizarVisibilidadPeriodo() {
        var t = (el('ttpbb-con-periodo-tipo') || {}).value || 'ENTRE_MESES';
        ['ttpbb-con-field-fecha-unica', 'ttpbb-con-field-entre-fechas', 'ttpbb-con-field-mes-unico', 'ttpbb-con-field-entre-meses'].forEach(function (id) {
            var e = el(id);
            if (e) e.classList.add('hc-hidden');
        });
        if (t === 'POR_FECHA') {
            var e = el('ttpbb-con-field-fecha-unica');
            if (e) e.classList.remove('hc-hidden');
        } else if (t === 'ENTRE_FECHAS') {
            var e = el('ttpbb-con-field-entre-fechas');
            if (e) e.classList.remove('hc-hidden');
        } else if (t === 'POR_MES') {
            var e = el('ttpbb-con-field-mes-unico');
            if (e) e.classList.remove('hc-hidden');
        } else if (t === 'ENTRE_MESES') {
            var e = el('ttpbb-con-field-entre-meses');
            if (e) e.classList.remove('hc-hidden');
        }
    }

    /* ─── Cargar granjas en el select ─── */
    function ttpbbConCargarGranjasSelect() {
        var sel = el('ttpbb-con-granja-select');
        if (!sel) return;
        get(API_CRUD + '?action=granjas')
            .then(function (d) {
                if (!d.success || !d.data) return;
                sel.innerHTML = '<option value="">Todas</option>';
                var porZona = {};
                d.data.forEach(function (g) {
                    var z = g.zona || 'Sin zona';
                    if (!porZona[z]) porZona[z] = [];
                    porZona[z].push(g);
                });
                var zonas = Object.keys(porZona).sort();
                zonas.forEach(function (zona) {
                    var grp = document.createElement('optgroup');
                    grp.label = zona;
                    porZona[zona].sort(function (a, b) {
                        return (a.nomGranja || a.codGranja || '').localeCompare(b.nomGranja || b.codGranja || '');
                    }).forEach(function (g) {
                        var opt = document.createElement('option');
                        opt.value = g.codGranja || '';
                        opt.textContent = (g.codGranja || '') + ' - ' + (g.nomGranja || g.codGranja || '');
                        grp.appendChild(opt);
                    });
                    sel.appendChild(grp);
                });
            })
            .catch(function (e) {
                console.warn('[TTPBB] Error cargando granjas:', e);
            });
    }

    /* ─── Cargar lista de registros ─── */
    function ttpbbConCargarLista() {
        var meta = el('ttpbb-con-meta');
        var g = (el('ttpbb-con-granja-select') && el('ttpbb-con-granja-select').value || '').trim();
        var params = 'action=lista_cab';
        var tipoPer = (el('ttpbb-con-periodo-tipo') && el('ttpbb-con-periodo-tipo').value || '').trim();
        if (tipoPer === 'TODOS' || !tipoPer) {
            // sin filtro de fechas
        } else if (tipoPer === 'POR_FECHA') {
            var fu = (el('ttpbb-con-fecha-unica') && el('ttpbb-con-fecha-unica').value || '').trim();
            if (fu) { params += '&fechaInicio=' + encodeURIComponent(fu) + '&fechaFin=' + encodeURIComponent(fu); }
        } else if (tipoPer === 'ENTRE_FECHAS') {
            var fi = (el('ttpbb-con-fecha-inicio') && el('ttpbb-con-fecha-inicio').value || '').trim();
            var ff = (el('ttpbb-con-fecha-fin') && el('ttpbb-con-fecha-fin').value || '').trim();
            if (fi && ff) { params += '&fechaInicio=' + encodeURIComponent(fi) + '&fechaFin=' + encodeURIComponent(ff); }
        } else if (tipoPer === 'POR_MES') {
            var mu = (el('ttpbb-con-mes-unico') && el('ttpbb-con-mes-unico').value || '').trim();
            if (mu && /^\d{4}-\d{2}$/.test(mu)) {
                params += '&fechaInicio=' + encodeURIComponent(mu + '-01');
                var ud = new Date(parseInt(mu.substring(0, 4), 10), parseInt(mu.substring(5, 7), 10), 0).getDate();
                params += '&fechaFin=' + encodeURIComponent(mu + '-' + String(ud).padStart(2, '0'));
            }
        } else {
            // ENTRE_MESES
            var mi = (el('ttpbb-con-mes-inicio') && el('ttpbb-con-mes-inicio').value || '').trim();
            var mf = (el('ttpbb-con-mes-fin') && el('ttpbb-con-mes-fin').value || '').trim();
            if (mi && /^\d{4}-\d{2}$/.test(mi)) { params += '&fechaInicio=' + encodeURIComponent(mi + '-01'); }
            if (mf && /^\d{4}-\d{2}$/.test(mf)) {
                var udf = new Date(parseInt(mf.substring(0, 4), 10), parseInt(mf.substring(5, 7), 10), 0).getDate();
                params += '&fechaFin=' + encodeURIComponent(mf + '-' + String(udf).padStart(2, '0'));
            }
        }
        if (g) params += '&granja=' + encodeURIComponent(g);

        if (meta) meta.textContent = 'Cargando registros...';
        get(API_CRUD + '?' + params)
            .then(function (d) {
                if (!d.success) {
                    if (meta) meta.textContent = d.message || 'Error al cargar';
                    renderTtpbbListaTable([]);
                    return;
                }
                if (meta) meta.textContent = '';
                renderTtpbbListaTable(d.data || []);
            })
            .catch(function () {
                if (meta) meta.textContent = 'Error de red al consultar registros.';
                renderTtpbbListaTable([]);
            });
    }

    function renderTtpbbListaTable(data) {
        var tbody = el('ttpbb-con-tbody-lista');
        var countEl = el('ttpbb-con-table-count');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!data || !data.length) {
            if (countEl) countEl.textContent = '0 registros';
            return;
        }
        var frag = document.createDocumentFragment();
        for (var i = 0; i < data.length; i++) {
            var r = data[i];
            if (!r) continue;
            var tr = document.createElement('tr');
            tr.className = (i % 2 === 0) ? 'bg-white hover:bg-blue-50/40' : 'bg-gray-50 hover:bg-blue-50/40';
            var periodo = '';
            if (r.fecha_desde && r.fecha_hasta) {
                periodo = r.fecha_desde.substring(0, 10) + ' ~ ' + r.fecha_hasta.substring(0, 10);
            } else if (r.fecha_desde) {
                periodo = r.fecha_desde.substring(0, 10);
            }
            var nomGr = r.nomGranja || r.codGranja || '—';
            var campRaw = String(r.campania || '').trim();
            var galpRaw = ttpbbGalponUtil(r.galpones || r.galpon || r.codGalpon || '');
            var camp = campRaw || '—';
            var galp = galpRaw || '—';
            var idsCabRaw = String(r.ids_cab || '').trim();
            var numLect = r.total_lecturas || 0;
            var placa = r.placaCamion || '—';
            var empTrans = r.empTransporte || '—';
            var usuario = r.usuarioNombre || '—';
            periodo += ' (' + numLect + ' lecturas)';
            tr.innerHTML = '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-500">' + (i + 1) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap font-medium text-gray-800">' + escHtml(nomGr) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap font-mono text-gray-700">' + escHtml(camp) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap">' + escHtml(galp) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-600">' + escHtml(periodo) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-600">' + escHtml(usuario) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap font-mono">' + escHtml(placa) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap text-gray-600">' + escHtml(empTrans) + '</td>'
                + '<td class="px-3 py-2 border-b border-gray-100 whitespace-nowrap">'
                + '<button type="button" class="ttpbb-btn-con-ver hc-cell-ver-btn" title="Ver gráfica y datos" aria-label="Ver gráfica y datos" '
                + 'data-cod-granja="' + escAttr(r.codGranja || '') + '" data-campania="' + escAttr(campRaw) + '" data-galpones="' + escAttr(galpRaw) + '" data-ids-cab="' + escAttr(idsCabRaw) + '" data-placa="' + escAttr(r.placaCamion || '') + '">'
                + '<i class="fa-solid fa-chart-line mr-1"></i>Ver más</button>'
                + '</td>';
            frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        if (countEl) {
            countEl.textContent = data.length + (data.length === 1 ? ' registro' : ' registros');
        }
        bindTtpbbConAcciones();
    }

    function bindTtpbbConAcciones() {
        var tbody = el('ttpbb-con-tbody-lista');
        if (!tbody) return;
        var verBtns = tbody.querySelectorAll('.ttpbb-btn-con-ver');
        verBtns.forEach(function (btn) {
            if (btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', function () {
                var codGr = btn.getAttribute('data-cod-granja') || '';
                var camp = btn.getAttribute('data-campania') || '';
                var galp = btn.getAttribute('data-galpones') || '';
                var idsCab = btn.getAttribute('data-ids-cab') || '';
                var placaVer = btn.getAttribute('data-placa') || '';
                ttpbbConVerGrafica(codGr, camp, galp, placaVer, idsCab);
            });
        });
    }

    function initApp() {
        var btnFiltrar = el('ttpbb-btn-con-filtrar');
        if (btnFiltrar) btnFiltrar.addEventListener('click', ttpbbConCargarLista);

        var periodoTipo = el('ttpbb-con-periodo-tipo');
        if (periodoTipo) {
            periodoTipo.addEventListener('change', ttpbbConActualizarVisibilidadPeriodo);
        }
        ttpbbConActualizarVisibilidadPeriodo();

        ttpbbConCargarGranjasSelect();

        // Cargar lista automáticamente en inicio
        ttpbbConCargarLista();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
