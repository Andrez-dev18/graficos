/**
 * Gráficas de liquidación HC (ICA e indicadores) — Producción Aves.
 * Port de modules/sip/historia-clinica-graficas/js/hcliq-dashboard.js sobre el
 * bridge de corebi (backend/produccionAves/graficas -> API de Sanidad).
 */
(function () {
    var RECURSO = {
        data: 'liquidaciones',
        galpones: 'liquidaciones-galpones',
        zonas: 'liquidaciones-zonas',
        granjas: 'liquidaciones-granjas'
    };

    var CATALOGO = [];
    var metaByGranja = {};
    var paramMetaByKey = {};
    var paramOrder = [];
    var selectedParams = [];
    var appliedParams = [];
    var hcliqChart = null;
    var hcliqCharts = [];
    var chartPayload = null;
    var chartModo = 'global';
    var galponSel = '';
    var listaRows = [];
    var hcliqReqSeq = 0;
    var msParametros = null;
    var msGranjas = null;
    var selectedGranjas = [];

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
        var s = n.toFixed(dec);
        var suffix = meta && meta.suffix ? String(meta.suffix) : '';
        return suffix ? (s + suffix) : s;
    }
    function fmtValor(v, pk) {
        var meta = paramMetaByKey[pk || ''] || {};
        return fmtValorMeta(v, { decimals: meta.decimals, suffix: meta.suffix });
    }
    function el(id) {
        return document.getElementById(id);
    }
    function val(id) {
        var n = el(id);
        return n ? String(n.value || '').trim() : '';
    }
    function parseFechaEs(s) {
        var t = String(s || '').trim();
        var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) return '';
        return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    }
    function msgError(res) {
        return (res && res.message) ? String(res.message) : 'Error al cargar la información';
    }
    function swal(opts) {
        if (typeof Swal === 'undefined') {
            return;
        }
        Swal.fire(opts);
    }

    /* ---- Periodo ---- */
    function periodoParams() {
        var p = {};
        p.periodoTipo = val('hcliq-periodoTipo');
        p.fechaUnica = parseFechaEs(val('hcliq-fechaUnica'));
        p.fechaInicio = parseFechaEs(val('hcliq-fechaInicio'));
        p.fechaFin = parseFechaEs(val('hcliq-fechaFin'));
        p.mesUnico = val('hcliq-mesUnico');
        p.mesInicio = val('hcliq-mesInicio');
        p.mesFin = val('hcliq-mesFin');
        return p;
    }
    function aplicarVisibilidadPeriodo() {
        var t = val('hcliq-periodoTipo');
        ['hcliq-periodoPorFecha', 'hcliq-periodoEntreFechas', 'hcliq-periodoPorMes', 'hcliq-periodoEntreMeses'].forEach(function (id) {
            var n = el(id);
            if (n) n.classList.add('hc-hidden');
        });
        if (t === 'POR_FECHA') el('hcliq-periodoPorFecha').classList.remove('hc-hidden');
        else if (t === 'ENTRE_FECHAS') el('hcliq-periodoEntreFechas').classList.remove('hc-hidden');
        else if (t === 'POR_MES') el('hcliq-periodoPorMes').classList.remove('hc-hidden');
        else if (t === 'ENTRE_MESES') el('hcliq-periodoEntreMeses').classList.remove('hc-hidden');
    }
    function periodoValido() {
        var t = val('hcliq-periodoTipo');
        if (t === 'POR_FECHA') return !!parseFechaEs(val('hcliq-fechaUnica'));
        if (t === 'ENTRE_FECHAS') {
            return !!parseFechaEs(val('hcliq-fechaInicio')) && !!parseFechaEs(val('hcliq-fechaFin'));
        }
        if (t === 'POR_MES') return !!val('hcliq-mesUnico');
        if (t === 'ENTRE_MESES') {
            return !!val('hcliq-mesInicio') && !!val('hcliq-mesFin');
        }
        return true;
    }
    function ymActual() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function ymRelativo(meses) {
        var d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + meses);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    function isoRelativo(dias, primerDiaMes) {
        var d = new Date();
        if (primerDiaMes) {
            d = new Date(d.getFullYear(), d.getMonth(), 1);
        }
        d.setDate(d.getDate() + dias);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function aplicarPeriodoDefecto() {
        var set = function (id, v) {
            var n = el(id);
            if (n && !String(n.value || '').trim()) n.value = v;
        };
        set('hcliq-mesInicio', ymRelativo(-3));
        set('hcliq-mesFin', ymActual());
        set('hcliq-mesUnico', ymActual());
        set('hcliq-fechaInicio', isoRelativo(0, true));
        set('hcliq-fechaFin', isoRelativo(0, false));
        set('hcliq-fechaUnica', String(new Date().getDate()).padStart(2, '0') + '/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + new Date().getFullYear());
    }

    /* ---- Filtros ---- */
    function modoValue() {
        return val('hcliq-modo') || 'global';
    }
    function combinarValue() {
        return val('hcliq-combinar') || 'combinado';
    }
    function buildParams() {
        var p = Object.assign({}, periodoParams());
        if (selectedParams.length > 0) {
            p.parametroKeys = selectedParams.join(',');
        }
        var zona = val('hcliq-zona');
        if (zona) p.zona = zona;
        var modo = modoValue();
        p.modo = modo;
        if (modo === 'granja') {
            p.granja = normGranja(val('hcliq-granja'));
        } else if (modo === 'granjas') {
            p.granjas = selectedGranjas.map(normGranja).join(',');
        }
        return p;
    }
    function etiquetaGranja(cod) {
        var c = normGranja(cod);
        var n = (metaByGranja[c] || '').trim();
        return n ? (c + ' — ' + n) : c;
    }
    function toggleGranjaField() {
        var modo = modoValue();
        var wrap = el('hcliq-granja-wrap');
        if (wrap) wrap.style.display = modo === 'granja' ? '' : 'none';
        var wrapGranjas = el('hcliq-granjas-wrap');
        if (wrapGranjas) wrapGranjas.style.display = modo === 'granjas' ? '' : 'none';
    }
    function setLoading(on) {
        var ov = el('hcliq-loading');
        if (ov) ov.classList.toggle('hc-hidden', !on);
        var btn = el('hcliq-btn-filtrar');
        if (btn) {
            btn.disabled = !!on;
            btn.style.opacity = on ? '0.7' : '';
        }
    }
    function setPendiente(on) {
        var btn = el('hcliq-btn-filtrar');
        if (btn) btn.setAttribute('data-pending', on ? '1' : '0');
        var lbl = el('hcliq-btn-filtrar-label');
        if (lbl) lbl.textContent = on ? 'Aplicar cambios' : 'Filtrar';
    }

    /* ---- Tabla de liquidaciones ---- */
    function tablaColspan() {
        return 8 + appliedParams.length;
    }
    function renderTablaHead() {
        var head = el('hcliq-tabla-lista-head');
        if (!head) return;
        var html = '<tr><th class="hcliq-col-exp"></th><th>N</th><th>Zona</th><th>Granja</th><th>Campaña</th><th>Inicio</th><th>Fin (liquidación)</th>';
        appliedParams.forEach(function (pk) {
            var m = paramMetaByKey[pk] || {};
            html += '<th>' + esc(m.label || pk) + '</th>';
        });
        html += '<th>Galpones</th></tr>';
        head.innerHTML = html;
    }
    function renderLista(rows) {
        var body = el('hcliq-tabla-lista-body');
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
        PA.api(RECURSO.galpones, {
            granja: normGranja(r.granja),
            campania: String(r.campania || '').trim(),
            parametroKeys: appliedParams.join(',')
        }).then(function (res) {
            if (!res || res.success === false) throw new Error(msgError(res));
            det.querySelector('.hcliq-det-wrap').innerHTML = renderGalponesDetalle(res.data || []);
        }).catch(function (err) {
            det.querySelector('.hcliq-det-wrap').innerHTML = '<div class="hcliq-det-error">' + esc((err && err.message) || 'No se pudo cargar la información.') + '</div>';
        });
    }

    /* ---- Gráfico ---- */
    function pointLabelsPlugin() {
        return {
            id: 'hcliqPointLabels',
            afterDatasetsDraw: function (chart) {
                var ctx = chart.ctx;
                chart.data.datasets.forEach(function (dataset, dsIndex) {
                    var m = chart.getDatasetMeta(dsIndex);
                    if (!m || m.hidden) return;
                    m.data.forEach(function (point, index) {
                        var raw = dataset.data[index];
                        if (raw == null || raw === '') return;
                        var label = fmtValorMeta(raw, dataset);
                        if (!label || label === '—') return;
                        ctx.save();
                        ctx.font = '600 10px system-ui, sans-serif';
                        ctx.fillStyle = dataset.borderColor || '#334155';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(label, point.x, point.y - 8);
                        ctx.restore();
                    });
                });
            }
        };
    }
    function buildScales(parametros) {
        var scales = {};
        var list = parametros && parametros.length ? parametros : [{ key: '', label: 'Valor', axisId: 'y', color: '#334155' }];
        list.forEach(function (pm, i) {
            var id = pm.axisId || (i === 0 ? 'y' : ('y' + i));
            scales[id] = {
                position: i === 0 ? 'left' : 'right',
                display: true,
                grid: { drawOnChartArea: i === 0 },
                title: { display: true, text: String(pm.label || '') },
                ticks: { color: pm.color || undefined }
            };
            if (i > 1) {
                scales[id].offset = true;
            }
        });
        scales.x = {
            title: { display: true, text: 'Mes liquidación' },
            ticks: {
                callback: function (value) {
                    var raw = this.getLabelForValue(value);
                    return fmtMesCorto(raw) || String(raw);
                }
            }
        };
        return scales;
    }
    function granjaDatasetsDesdePorGalpon(payload, galpon) {
        var labels = payload.labels || [];
        var parametros = payload.parametros || [];
        var porg = payload.porGalpon || [];
        var gk = galponKey(galpon);
        return parametros.map(function (pm) {
            var porMes = {};
            porg.forEach(function (row) {
                if (String(row.parametroKey || '') !== String(pm.key)) return;
                if (galponKey(row.galpon) !== gk) return;
                porMes[String(row.mes)] = row.valor;
            });
            return {
                label: String(pm.label || pm.key) + ' · Galpón ' + galpon,
                data: labels.map(function (lab) { return Object.prototype.hasOwnProperty.call(porMes, lab) ? porMes[lab] : null; }),
                borderColor: pm.color,
                backgroundColor: pm.background,
                borderDash: [],
                tension: 0.2,
                spanGaps: false,
                pointRadius: 4,
                pointHoverRadius: 6,
                parametroKey: pm.key,
                decimals: pm.decimals,
                suffix: pm.suffix,
                serie: 'Galpón ' + galpon,
                yAxisID: pm.axisId
            };
        });
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
                    var titulo = fmtMesEspanol(raw);
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
                    var serie = ds.label ? ds.label : '';
                    return (serie ? serie + ': ' : '') + fmtValorMeta(v, ds);
                }
            }
        };
    }
    function chartBaseOptions(payload, modo) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 28 } },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' },
                title: { display: false },
                tooltip: chartTooltip(payload, modo)
            }
        };
    }
    function drawChart(payload, datasets, modo) {
        var wrap = el('hcliq-chart-wrap');
        var host = el('hcliq-chart-host');
        var titulo = el('hcliq-chart-titulo');
        if (!wrap || !host) return;
        wrap.classList.remove('lay-hidden');
        if (titulo) titulo.textContent = payload.titulo || 'Gráficas';
        destroyCharts();
        host.innerHTML = '';
        var labels = payload.labels || [];
        var parametros = payload.parametros || [];
        var modoChart = String(modo || modoValue()).trim() || 'global';
        var lista = (datasets || []).map(function (ds) {
            return Object.assign({ fill: false, borderWidth: 2 }, ds);
        });

        if (modoChart === 'granjas') {
            lista = lista.map(function (ds) {
                if (!ds.serie) return ds;
                var friendly = etiquetaGranja(ds.serie);
                return Object.assign({}, ds, {
                    label: String(ds.label || '').split(String(ds.serie)).join(friendly)
                });
            });
        }

        if (combinarValue() === 'separado' && parametros.length > 1) {
            host.classList.add('hcliq-charts-grid');
            if (wrap) wrap.classList.add('hcliq-chart-wrap--grid');
            parametros.forEach(function (pm) {
                var dsP = lista.filter(function (ds) {
                    return String(ds.parametroKey || '') === String(pm.key || '');
                });
                var panel = document.createElement('div');
                panel.className = 'hcliq-chart-panel';
                var cap = document.createElement('div');
                cap.className = 'hcliq-chart-panel-title';
                cap.innerHTML = '<span class="hcliq-ms-dot" style="background:' + esc(pm.color || '#334155') + '"></span>'
                    + '<span>' + esc(pm.label || pm.key || '') + '</span>';
                var body = document.createElement('div');
                body.className = 'hcliq-chart-panel-body';
                var cv = document.createElement('canvas');
                body.appendChild(cv);
                panel.appendChild(cap);
                panel.appendChild(body);
                host.appendChild(panel);
                var opts = chartBaseOptions(payload, modoChart);
                opts.scales = buildScales([pm]);
                hcliqCharts.push(new Chart(cv.getContext('2d'), {
                    type: 'line',
                    data: { labels: labels, datasets: dsP },
                    plugins: [pointLabelsPlugin()],
                    options: opts
                }));
            });
            return;
        }

        host.classList.remove('hcliq-charts-grid');
        if (wrap) wrap.classList.remove('hcliq-chart-wrap--grid');
        var canvas = document.createElement('canvas');
        canvas.id = 'hcliq-chart';
        canvas.setAttribute('aria-label', 'Gráfico de indicadores por zona');
        host.appendChild(canvas);
        var options = chartBaseOptions(payload, modoChart);
        options.scales = buildScales(parametros);
        hcliqChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: lista },
            plugins: parametros.length > 1 ? [] : [pointLabelsPlugin()],
            options: options
        });
        hcliqCharts.push(hcliqChart);
    }
    function loadGalponesChart(galpones, modo) {
        var wrap = el('hcliq-chart-galpon-wrap');
        if (wrap) wrap.classList.toggle('hc-hidden', modo !== 'granja');
        var sel = el('hcliq-chart-galpon');
        if (!sel) return;
        var prev = galponSel;
        var html = '<option value="">Todos prom.</option>';
        (galpones || []).forEach(function (gp) {
            var g = String(gp || '').trim();
            if (!g) return;
            html += '<option value="' + esc(g) + '">' + esc(g) + '</option>';
        });
        sel.innerHTML = html;
        if (prev && sel.querySelector('option[value="' + prev.replace(/"/g, '\\"') + '"]')) {
            sel.value = prev;
            galponSel = prev;
        } else {
            sel.value = '';
            galponSel = '';
        }
    }
    function renderChart(payload, modo) {
        chartModo = String(modo || modoValue()).trim() || 'global';
        var wrap = el('hcliq-chart-wrap');
        if (!payload) return;
        if (chartModo === 'granja') {
            loadGalponesChart(payload.galpones || [], chartModo);
        } else {
            galponSel = '';
            loadGalponesChart([], chartModo);
        }
        var datasets = payload.datasets || [];
        if (chartModo === 'granja' && galponSel !== '') {
            datasets = granjaDatasetsDesdePorGalpon(payload, galponSel);
        }
        if (!(payload.labels || []).length || !datasets.length) {
            if (wrap) wrap.classList.add('lay-hidden');
            return;
        }
        drawChart(payload, datasets, chartModo);
    }
    function avisoSinDatos(rows, payload) {
        var hayChart = payload && (payload.labels || []).length > 0 && (payload.datasets || []).length > 0;
        if (hayChart || (rows && rows.length)) return;
        swal({
            icon: 'info',
            title: 'Sin datos',
            text: 'No hay liquidaciones liquidadas para el periodo y filtros seleccionados.'
        });
    }

    /* ---- Carga de datos ---- */
    function aplicarRespuesta(res, modo) {
        chartPayload = res.chart || {};
        appliedParams = selectedParams.slice();
        setPendiente(false);
        renderTablaHead();
        renderLista(res.data || []);
        avisoSinDatos(res.data || [], chartPayload);
        renderChart(chartPayload, res.modo || modo);
    }
    function filtrar() {
        if (!periodoValido()) {
            swal({ icon: 'warning', title: 'Periodo', text: 'Complete el periodo de consulta.' });
            return;
        }
        var modo = modoValue();
        if (modo === 'granja' && !normGranja(val('hcliq-granja'))) {
            swal({ icon: 'warning', title: 'Granja', text: 'Seleccione una granja para la vista por granja.' });
            return;
        }
        if (modo === 'granjas' && !selectedGranjas.length) {
            swal({ icon: 'warning', title: 'Granjas', text: 'Seleccione al menos una granja para la vista por granjas.' });
            return;
        }
        if (!selectedParams.length) {
            swal({ icon: 'warning', title: 'Parámetro', text: 'Seleccione al menos un parámetro.' });
            return;
        }
        var seq = ++hcliqReqSeq;
        setLoading(true);
        PA.api(RECURSO.data, buildParams()).then(function (res) {
            if (seq !== hcliqReqSeq) return;
            if (!res || res.success === false) {
                throw new Error(msgError(res));
            }
            aplicarRespuesta(res, modo);
        }).catch(function (err) {
            swal({ icon: 'error', title: 'Error', text: (err && err.message) || 'No se pudo cargar la información.' });
        }).then(function () {
            if (seq === hcliqReqSeq) setLoading(false);
        });
    }

    /* ---- Catálogos ---- */
    function registrarCatalogo(lista) {
        if (!Array.isArray(lista) || !lista.length) return;
        CATALOGO = lista;
        paramMetaByKey = {};
        paramOrder = [];
        lista.forEach(function (p) {
            var k = String(p.key || '');
            if (k === '') return;
            paramMetaByKey[k] = p;
            paramOrder.push(k);
        });
        if (!paramOrder.length) {
            paramOrder = ['ICA_2_4'];
            paramMetaByKey['ICA_2_4'] = { key: 'ICA_2_4', label: 'ICA 2.4', decimals: 3, suffix: '' };
        }
    }
    function initParametrosMS() {
        selectedParams = [paramOrder[0]];
        msParametros = new HcliqMultiSelect({
            btnId: 'hcliq-param-btn',
            labelId: 'hcliq-param-label',
            dropdownId: 'hcliq-param-dropdown',
            searchId: 'hcliq-param-search',
            optionsContainerId: 'hcliq-param-options',
            maxSelected: 4,
            onChange: function (ids) {
                var orden = paramOrder.filter(function (k) { return ids.indexOf(k) >= 0; });
                if (!orden.length) {
                    orden = [paramOrder[0]];
                    msParametros.setSelected(orden);
                }
                selectedParams = orden;
                setPendiente(true);
            }
        });
        msParametros.setOptions(CATALOGO.map(function (p) {
            return { id: String(p.key || ''), label: String(p.label || p.key || ''), color: String(p.color || '') };
        }), selectedParams);
    }
    function initGranjasMS() {
        msGranjas = new HcliqMultiSelect({
            btnId: 'hcliq-granjas-btn',
            labelId: 'hcliq-granjas-label',
            dropdownId: 'hcliq-granjas-dropdown',
            searchId: 'hcliq-granjas-search',
            optionsContainerId: 'hcliq-granjas-options',
            maxSelected: 6,
            onChange: function (ids) {
                selectedGranjas = ids.slice();
                setPendiente(true);
            }
        });
    }
    function loadZonas() {
        return PA.api(RECURSO.zonas).then(function (res) {
            var sel = el('hcliq-zona');
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
    function loadGranjas() {
        var zona = val('hcliq-zona');
        return PA.api(RECURSO.granjas, zona ? { zona: zona } : {}).then(function (res) {
            var sel = el('hcliq-granja');
            if (!sel || !res) return;
            metaByGranja = {};
            var html = '<option value="">— Seleccione —</option>';
            (res.data || []).forEach(function (g) {
                var cod = String(g.granja || '').trim();
                if (!cod || cod.charAt(0) !== '6') return;
                var nk = normGranja(cod);
                metaByGranja[nk] = String(g.nombre || '').trim();
                html += '<option value="' + esc(nk) + '">' + esc((nk + (g.nombre ? ' — ' + g.nombre : ''))) + '</option>';
            });
            sel.innerHTML = html;
            if (sel.value && !sel.querySelector('option[value="' + sel.value.replace(/"/g, '\\"') + '"]')) {
                sel.value = '';
            }
            selectedGranjas = selectedGranjas.filter(function (cod) { return !!metaByGranja[cod]; });
            if (msGranjas) {
                msGranjas.setOptions(Object.keys(metaByGranja).sort().map(function (cod) {
                    return { id: cod, label: etiquetaGranja(cod) };
                }), selectedGranjas);
            }
        }).catch(function () {});
    }
    function cargarCatalogoParametros() {
        /* El catálogo (labels, decimales, colores) viaja en la propia respuesta de liquidaciones */
        return PA.api(RECURSO.data, Object.assign({ modo: 'global' }, periodoParams())).then(function (res) {
            if (res && res.success === false) return null;
            if (res && res.parametros) registrarCatalogo(res.parametros);
            return res || null;
        }).catch(function () { return null; });
    }

    /* ---- Fechas (flatpickr) ---- */
    function initFlatpickr() {
        if (typeof flatpickr === 'undefined') return;
        var locale = (flatpickr.l10ns && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'es';
        document.querySelectorAll('.hc-fp-mes').forEach(function (n) {
            flatpickr(n, {
                locale: locale,
                plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: 'Y-m', altFormat: 'm/y' })],
                allowInput: true
            });
        });
        document.querySelectorAll('.hc-input-fecha-es').forEach(function (n) {
            flatpickr(n, {
                locale: locale,
                dateFormat: 'd/m/Y',
                allowInput: true
            });
        });
    }
    function marcarCambiosServidor() {
        setPendiente(true);
    }
    function initEventos() {
        el('hcliq-periodoTipo').addEventListener('change', function () {
            aplicarVisibilidadPeriodo();
            marcarCambiosServidor();
        });
        ['hcliq-fechaUnica', 'hcliq-fechaInicio', 'hcliq-fechaFin', 'hcliq-mesUnico', 'hcliq-mesInicio', 'hcliq-mesFin'].forEach(function (id) {
            var n = el(id);
            if (n) n.addEventListener('change', marcarCambiosServidor);
        });
        el('hcliq-zona').addEventListener('change', function () {
            marcarCambiosServidor();
            loadGranjas();
        });
        el('hcliq-modo').addEventListener('change', function () {
            toggleGranjaField();
            marcarCambiosServidor();
        });
        el('hcliq-granja').addEventListener('change', marcarCambiosServidor);
        el('hcliq-chart-galpon').addEventListener('change', function () {
            galponSel = String(this.value || '').trim();
            if (chartPayload) {
                var datasets = galponSel !== '' ? granjaDatasetsDesdePorGalpon(chartPayload, galponSel) : (chartPayload.datasets || []);
                drawChart(chartPayload, datasets, 'granja');
            }
        });
        el('hcliq-combinar').addEventListener('change', function () {
            if (!chartPayload) return;
            var datasets = chartPayload.datasets || [];
            if (chartModo === 'granja' && galponSel !== '') {
                datasets = granjaDatasetsDesdePorGalpon(chartPayload, galponSel);
            }
            drawChart(chartPayload, datasets, chartModo);
        });
        el('hcliq-btn-filtrar').addEventListener('click', filtrar);
        ['hcliq-fechaUnica', 'hcliq-fechaInicio', 'hcliq-fechaFin'].forEach(function (id) {
            var n = el(id);
            if (n) n.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    filtrar();
                }
            });
        });
        el('hcliq-tabla-lista-body').addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-act]');
            if (!btn) return;
            if (btn.getAttribute('data-act') === 'toggle') {
                toggleDetalleGalpones(btn);
            }
        });
    }

    function iniciar() {
        aplicarPeriodoDefecto();
        aplicarVisibilidadPeriodo();
        toggleGranjaField();
        initFlatpickr();
        /* El multiselect de granjas debe existir antes de resolver loadGranjas() */
        initGranjasMS();
        setLoading(true);

        Promise.all([loadZonas(), loadGranjas(), cargarCatalogoParametros()]).then(function (resultados) {
            var res = resultados[2];
            initParametrosMS();
            initEventos();
            if (res && res.chart) {
                aplicarRespuesta(res, res.modo || 'global');
            } else {
                filtrar();
            }
            setLoading(false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
