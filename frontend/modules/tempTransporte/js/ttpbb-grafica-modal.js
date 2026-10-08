(function (global) {
    'use strict';

    var SANIDAD_BASE = (window.location && window.location.origin ? window.location.origin : '') + '/sanidad';
    var SANIDAD_TOKEN = 'Bearer d9f7a6b3-4c8e-11ee-be56-0242ac120002';
    var DEFAULT_SERIE_URL = SANIDAD_BASE + '/modules/temperatura/crud_temp_transporte_pollo_bb.php';

    var chartTemp = null;
    var chartHum = null;
    var tabActual = 'grafica';
    var ctx = null;
    var serieUrlOverride = '';

    function $(id) {
        return document.getElementById(id);
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    function fmtMiles(v) {
        if (v == null) return v;
        var s = String(v).trim();
        if (s === '' || s === '-' || s === '\u2014') return v;
        if (!/^-?\d+(\.\d+)?$/.test(s)) return v;
        var neg = s.charAt(0) === '-';
        var body = neg ? s.slice(1) : s;
        var parts = body.split('.');
        var intPart = parts[0];
        if (intPart.length <= 3) return v;
        intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        var out = intPart + (parts.length > 1 ? '.' + parts[1] : '');
        return (neg ? '-' : '') + out;
    }

    function pad3(raw, fromEnd) {
        var s = String(raw || '').replace(/\s+/g, '');
        while (s.length < 3) s = '0' + s;
        return fromEnd ? s.slice(-3) : s.slice(0, 3);
    }

    function serieUrl() {
        if (serieUrlOverride) return serieUrlOverride;
        var md = $('hc-modal-temp-ttpbb');
        var u = md ? String(md.getAttribute('data-serie-url') || '').trim() : '';
        return u || DEFAULT_SERIE_URL;
    }

    function configure(opts) {
        opts = opts || {};
        if (opts.serieUrl) serieUrlOverride = String(opts.serieUrl);
    }

    function closeModal() {
        var md = $('hc-modal-temp-ttpbb');
        var bd = $('hc-backdrop-temp-ttpbb');
        if (md) md.classList.add('lay-hidden');
        if (bd) bd.classList.add('lay-hidden');
        if (chartTemp && typeof chartTemp.destroy === 'function') chartTemp.destroy();
        chartTemp = null;
        if (chartHum && typeof chartHum.destroy === 'function') chartHum.destroy();
        chartHum = null;
        ctx = null;
    }

    function setTab(tab) {
        tabActual = tab;
        var panelGrafica = $('hc-ttpbb-panel-grafica');
        var panelDatos = $('hc-ttpbb-panel-datos');
        if (panelGrafica) panelGrafica.classList.toggle('lay-hidden', tab !== 'grafica');
        if (panelDatos) panelDatos.classList.toggle('lay-hidden', tab !== 'datos');
        document.querySelectorAll('.hc-ttpbb-tab').forEach(function (b) {
            var v = b.getAttribute('data-hc-ttpbb-tab');
            if (v === tab) {
                b.className = 'hc-ttpbb-tab text-xs px-3 py-1.5 rounded border font-medium bg-blue-600 text-white border-blue-600';
                b.setAttribute('aria-selected', 'true');
            } else {
                b.className = 'hc-ttpbb-tab text-xs px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
                b.setAttribute('aria-selected', 'false');
            }
        });
    }

    function tsToIso(ts) {
        var d = new Date(ts * 1000);
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T'
            + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function fitYRange(vals, clampLo, clampHi) {
        var nums = [];
        (vals || []).forEach(function (v) {
            if (v != null && isFinite(Number(v))) nums.push(Number(v));
        });
        if (!nums.length) {
            var fbLo = clampLo != null && isFinite(clampLo) ? clampLo : 0;
            var fbHi = clampHi != null && isFinite(clampHi) ? clampHi : 1;
            return { min: fbLo, max: fbHi };
        }
        var lo = Math.min.apply(null, nums);
        var hi = Math.max.apply(null, nums);
        if (lo === hi) { lo -= 1; hi += 1; }
        var pad = Math.max(0.3, (hi - lo) * 0.06);
        lo -= pad;
        hi += pad;
        if (clampLo != null && isFinite(clampLo)) lo = Math.max(clampLo, lo);
        if (clampHi != null && isFinite(clampHi)) hi = Math.min(clampHi, hi);
        if (lo >= hi) hi = lo + 1;
        return { min: lo, max: hi };
    }

    function mapSeriePayload(pl) {
        var all = [];
        var serie = Array.isArray(pl.serie) ? pl.serie : [];
        for (var i = 0; i < serie.length; i++) {
            var p = serie[i];
            var tiso = String(p.t || '');
            var fecha = tiso.length >= 10 ? tiso.substring(0, 10) : '';
            var hora = tiso.length >= 16 ? tiso.substring(11, 16) : '';
            var tempVal = (p.temp != null) ? Number(p.temp) : null;
            var humVal = (p.hum != null) ? Number(p.hum) : null;
            all.push({
                fecha_hora: tiso,
                fecha: fecha,
                hora: hora,
                temperatura: isNaN(tempVal) ? null : tempVal,
                humedad: isNaN(humVal) ? null : humVal
            });
        }
        all.sort(function (a, b) { return String(a.fecha_hora).localeCompare(String(b.fecha_hora)); });

        var cityData = null;
        var xMarkers = Array.isArray(pl.chartXMarkers) ? pl.chartXMarkers : [];
        if (xMarkers.length) {
            var markersSorted = xMarkers.slice().sort(function (a, b) {
                var ra = a.routeOrder != null && !isNaN(Number(a.routeOrder)) ? Number(a.routeOrder) : 9999;
                var rb = b.routeOrder != null && !isNaN(Number(b.routeOrder)) ? Number(b.routeOrder) : 9999;
                return ra - rb;
            });
            for (var mi = 0; mi < markersSorted.length; mi++) {
                var m = markersSorted[mi];
                var mIso;
                if (m.t != null) {
                    var mt = Number(m.t);
                    if (!isNaN(mt)) {
                        mIso = tsToIso(mt);
                    } else if (typeof m.t === 'string') {
                        mIso = String(m.t);
                    }
                }
                if (!mIso) continue;
                var cityIdx = all.length - 1;
                for (var ai = 0; ai < all.length; ai++) {
                    if (all[ai].fecha_hora >= mIso) {
                        cityIdx = ai;
                        break;
                    }
                }
                m.cityIdx = cityIdx;
            }
            cityData = { markers: markersSorted };
        }

        return {
            all: all,
            stdMin: pl.stdMin != null ? Number(pl.stdMin) : null,
            stdMax: pl.stdMax != null ? Number(pl.stdMax) : null,
            humStdMin: pl.stdHumMin != null ? Number(pl.stdHumMin) : null,
            humStdMax: pl.stdHumMax != null ? Number(pl.stdHumMax) : null,
            cityData: cityData,
            placa: pl.placaCamion || pl.placa || '',
            empTransporte: pl.empTransporte || ''
        };
    }

    function fetchAll() {
        if (!ctx || !ctx.granja || !ctx.campania) {
            if (ctx && ctx.idCab) {
                return fetch(serieUrl() + '?action=serie&idCab=' + encodeURIComponent(ctx.idCab), {
                    credentials: 'same-origin',
                    headers: { 'Authorization': SANIDAD_TOKEN }
                })
                    .then(function (resp) { return resp.json(); })
                    .then(function (d) {
                        if (!d.success || !d.payload || !d.payload.serie) {
                            return { all: [], stdMin: null, stdMax: null, humStdMin: null, humStdMax: null, cityData: null };
                        }
                        return mapSeriePayload(d.payload);
                    })['catch'](function () {
                        return { all: [], stdMin: null, stdMax: null, humStdMin: null, humStdMax: null, cityData: null };
                    });
            }
            return Promise.resolve({ all: [], stdMin: null, stdMax: null, humStdMin: null, humStdMax: null, cityData: null });
        }

        var granjaQ = pad3(ctx.granja, false);
        var campaniaQ = pad3(ctx.campania, true);
        var galponQ = String(ctx.galpon || '').trim();
        var url = serieUrl()
            + '?action=serie'
            + '&granja=' + encodeURIComponent(granjaQ)
            + '&campania=' + encodeURIComponent(campaniaQ);
        if (galponQ) {
            url += '&galpones=' + encodeURIComponent(galponQ)
                + '&codGalpon=' + encodeURIComponent(galponQ);
        }
        if (ctx.placa) url += '&placa=' + encodeURIComponent(ctx.placa);

        return fetch(url, {
            credentials: 'same-origin',
            headers: { 'Authorization': SANIDAD_TOKEN }
        })
            .then(function (resp) { return resp.json(); })
            .then(function (d) {
                if (!d.success || !d.payload || !d.payload.serie) {
                    return { all: [], stdMin: null, stdMax: null, humStdMin: null, humStdMax: null, cityData: null };
                }
                var mapped = mapSeriePayload(d.payload);
                if (mapped.placa && ctx) ctx.placa = mapped.placa;
                return mapped;
            })['catch'](function () {
                return { all: [], stdMin: null, stdMax: null, humStdMin: null, humStdMax: null, cityData: null };
            });
    }

    function cityLabelsPlugin() {
        return {
            id: 'hcTtpbbCityLabels',
            afterDraw: function (chart) {
                var cfg = chart.options.plugins && chart.options.plugins.hcTtpbbCityLabels;
                var markers = cfg && cfg.markers ? cfg.markers : [];
                if (!markers.length) return;
                var xScale = chart.scales.x;
                if (!xScale || typeof xScale.getPixelForValue !== 'function') return;
                var c = chart.ctx;
                var chartArea = chart.chartArea;
                var plotTop = chartArea.top;
                var plotBottom = chartArea.bottom;
                var xAxisBottom = typeof xScale.bottom === 'number' ? xScale.bottom : plotBottom;

                c.save();
                c.strokeStyle = 'rgba(71, 85, 105, 0.45)';
                c.lineWidth = 1;
                c.setLineDash([3, 3]);
                for (var mi = 0; mi < markers.length; mi++) {
                    var mIdx = markers[mi].cityIdx;
                    if (mIdx == null) continue;
                    var mx = xScale.getPixelForValue(mIdx);
                    if (!isFinite(mx)) continue;
                    c.beginPath();
                    c.moveTo(mx, plotTop);
                    c.lineTo(mx, plotBottom);
                    c.stroke();
                }
                c.setLineDash([]);

                var markerPxs = [];
                for (var pi = 0; pi < markers.length; pi++) {
                    var pIdx = markers[pi].cityIdx;
                    if (pIdx == null) continue;
                    var px = xScale.getPixelForValue(pIdx);
                    if (!isFinite(px)) continue;
                    markerPxs.push({ idx: pi, px: px, marker: markers[pi] });
                }

                var yBase = xAxisBottom + 6;
                for (var pj = 0; pj < markerPxs.length; pj++) {
                    var item = markerPxs[pj];
                    var m = item.marker;
                    var cx = item.px;
                    if (!isFinite(cx)) continue;
                    if (cx < chartArea.left - 8 || cx > chartArea.right + 8) continue;
                    var cName = String(m.ciudad || '').trim();
                    if (!cName) continue;
                    var hora = String(m.horaDet4 || '').trim();
                    var label = hora ? (cName + ' ' + hora) : cName;
                    c.save();
                    c.translate(cx, yBase);
                    c.rotate(-Math.PI / 2);
                    c.textAlign = 'right';
                    c.textBaseline = 'middle';
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 9px system-ui, -apple-system, sans-serif';
                    c.fillText(label, 0, 0);
                    c.restore();
                }
                c.restore();
            }
        };
    }

    function renderGrafica(all, stdMin, stdMax, humStdMin, humStdMax, cityData) {
        if (!all || !all.length) {
            var empty = $('hc-ttpbb-empty');
            var chartWrapTemp = $('hc-ttpbb-chart-wrap-temp');
            var chartWrapHum = $('hc-ttpbb-chart-wrap-hum');
            if (empty) empty.classList.remove('lay-hidden');
            if (chartWrapTemp) chartWrapTemp.classList.add('lay-hidden');
            if (chartWrapHum) chartWrapHum.classList.add('lay-hidden');
            return;
        }
        if (typeof Chart === 'undefined') return;

        var labels = all.map(function (r) {
            return (r.fecha && r.hora) ? (r.fecha.substring(8, 10) + '/' + r.fecha.substring(5, 7) + ' ' + r.hora) : r.fecha_hora;
        });
        var hasTempStd = (stdMin != null && !isNaN(stdMin)) || (stdMax != null && !isNaN(stdMax));
        var hasHumStd = (humStdMin != null && !isNaN(humStdMin)) || (humStdMax != null && !isNaN(humStdMax));

        var cvTemp = $('hc-ttpbb-chart-temp');
        var wrapTemp = $('hc-ttpbb-chart-wrap-temp');
        if (cvTemp && wrapTemp) {
            wrapTemp.classList.remove('lay-hidden');
            if (chartTemp && typeof chartTemp.destroy === 'function') chartTemp.destroy();

            var cityMapData = cityData && cityData.markers ? cityData.markers : null;
            var tempHeight = cityMapData ? 440 : 360;
            wrapTemp.style.height = tempHeight + 'px';
            wrapTemp.style.minHeight = tempHeight + 'px';
            cvTemp.height = tempHeight;

            var tempData = all.map(function (r) { return r.temperatura; });
            var yTemp = fitYRange(tempData, null, null);
            var tempPointColors = all.map(function (r) {
                var v = r.temperatura;
                if (v == null || isNaN(v)) return '#94a3b8';
                if (hasTempStd) {
                    var ok = true;
                    if (stdMin != null && !isNaN(stdMin) && v < Number(stdMin)) ok = false;
                    if (stdMax != null && !isNaN(stdMax) && v > Number(stdMax)) ok = false;
                    return ok ? '#16a34a' : '#dc2626';
                }
                return '#ef4444';
            });

            var dsT = [{
                label: 'Temperatura (°C)',
                data: tempData,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                pointBorderWidth: 0,
                pointHoverBorderWidth: 0,
                pointBackgroundColor: tempPointColors,
                pointBorderColor: tempPointColors,
                tension: 0.15,
                fill: false
            }];
            if (stdMin != null && !isNaN(stdMin)) {
                dsT.push({
                    label: 'Std mín °C (' + Number(stdMin).toFixed(1) + ')',
                    data: all.map(function () { return stdMin; }),
                    borderColor: '#64748b',
                    borderWidth: 1,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false
                });
            }
            if (stdMax != null && !isNaN(stdMax)) {
                dsT.push({
                    label: 'Std máx °C (' + Number(stdMax).toFixed(1) + ')',
                    data: all.map(function () { return stdMax; }),
                    borderColor: '#ca8a04',
                    borderWidth: 1,
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false
                });
            }

            chartTemp = new Chart(cvTemp.getContext('2d'), {
                type: 'line',
                data: { labels: labels, datasets: dsT },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: cityMapData ? { padding: { bottom: 108 } } : {},
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        title: { display: true, text: 'Temperatura' },
                        legend: { position: 'top', align: 'end' },
                        tooltip: {
                            callbacks: {
                                label: function (c0) {
                                    var lbl = c0.dataset.label || '';
                                    var val = c0.parsed.y;
                                    if (val == null || isNaN(val)) return null;
                                    return lbl + ': ' + val.toFixed(1);
                                }
                            }
                        },
                        hcTtpbbCityLabels: cityMapData ? { markers: cityMapData } : false
                    },
                    scales: {
                        x: {
                            display: true,
                            ticks: { maxRotation: 90, minRotation: 90, autoSkip: true, font: { size: 9 } }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            title: { display: true, text: '°C', font: { size: 11 } },
                            min: yTemp.min,
                            max: yTemp.max,
                            afterFit: function (axis) { axis.width = 56; },
                            grid: { color: 'rgba(148, 163, 184, 0.2)' }
                        }
                    }
                },
                plugins: cityMapData ? [cityLabelsPlugin()] : []
            });
        }

        var cvHum = $('hc-ttpbb-chart-hum');
        var wrapHum = $('hc-ttpbb-chart-wrap-hum');
        var humData = all.map(function (r) { return r.humedad; });
        var hasHumData = humData.some(function (v) { return v != null && !isNaN(v); });
        var yHum = fitYRange(humData, 0, 100);
        if (cvHum && wrapHum) {
            wrapHum.classList.remove('lay-hidden');
            wrapHum.style.height = '360px';
            wrapHum.style.minHeight = '360px';
            cvHum.height = 360;
            if (hasHumData) {
                if (chartHum && typeof chartHum.destroy === 'function') chartHum.destroy();
                var dsH = [{
                    label: 'Humedad (%)',
                    data: humData,
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointBorderWidth: 0,
                    pointHoverBorderWidth: 0,
                    pointBackgroundColor: '#ea580c',
                    pointBorderColor: '#ea580c',
                    tension: 0.15,
                    fill: false
                }];
                if (humStdMin != null && !isNaN(humStdMin)) {
                    dsH.push({
                        label: 'Std mín % (' + Number(humStdMin).toFixed(1) + ')',
                        data: all.map(function () { return humStdMin; }),
                        borderColor: '#64748b',
                        borderWidth: 1,
                        borderDash: [6, 3],
                        pointRadius: 0,
                        fill: false
                    });
                }
                if (humStdMax != null && !isNaN(humStdMax)) {
                    dsH.push({
                        label: 'Std máx % (' + Number(humStdMax).toFixed(1) + ')',
                        data: all.map(function () { return humStdMax; }),
                        borderColor: '#ca8a04',
                        borderWidth: 1,
                        borderDash: [6, 3],
                        pointRadius: 0,
                        fill: false
                    });
                }
                chartHum = new Chart(cvHum.getContext('2d'), {
                    type: 'line',
                    data: { labels: labels, datasets: dsH },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { bottom: 72 } },
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            title: { display: true, text: 'Humedad relativa' },
                            legend: { position: 'top', align: 'end' },
                            tooltip: {
                                callbacks: {
                                    label: function (c0) {
                                        var lbl = c0.dataset.label || '';
                                        var val = c0.parsed.y;
                                        if (val == null || isNaN(val)) return null;
                                        return lbl + ': ' + val.toFixed(1);
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                display: true,
                                ticks: { maxRotation: 90, minRotation: 90, autoSkip: true, font: { size: 9 } }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                min: yHum.min,
                                max: yHum.max,
                                title: { display: true, text: '% HR', font: { size: 11 } },
                                afterFit: function (axis) { axis.width = 56; },
                                grid: { color: 'rgba(148, 163, 184, 0.2)' }
                            }
                        }
                    }
                });
            }
        }
    }

    function renderDatos(all, stdMin, stdMax, humStdMin, humStdMax, cityData) {
        var host = $('hc-ttpbb-datos-host');
        if (!host) return;
        if (!all || !all.length) {
            host.innerHTML = '<p class="text-xs text-slate-500 p-2">Sin datos.</p>';
            return;
        }
        var cityMap = {};
        var markers = cityData && cityData.markers ? cityData.markers : [];
        for (var mi = 0; mi < markers.length; mi++) {
            var mk = markers[mi];
            var cIdx = mk.cityIdx;
            if (cIdx == null) continue;
            var cName = String(mk.ciudad || '').trim();
            if (!cName) continue;
            cityMap[cIdx] = cName;
        }
        var hasTempStd = (stdMin != null && !isNaN(stdMin)) || (stdMax != null && !isNaN(stdMax));
        var hasHumStd = (humStdMin != null && !isNaN(humStdMin)) || (humStdMax != null && !isNaN(humStdMax));
        var stdTempLabel = '';
        if (stdMin != null && !isNaN(stdMin) && stdMax != null && !isNaN(stdMax)) {
            stdTempLabel = Number(stdMin).toFixed(1) + ' – ' + Number(stdMax).toFixed(1) + ' °C';
        } else if (stdMin != null && !isNaN(stdMin)) {
            stdTempLabel = '\u2265 ' + Number(stdMin).toFixed(1) + ' °C';
        } else if (stdMax != null && !isNaN(stdMax)) {
            stdTempLabel = '\u2264 ' + Number(stdMax).toFixed(1) + ' °C';
        }
        var stdHumLabel = '';
        if (humStdMin != null && !isNaN(humStdMin) && humStdMax != null && !isNaN(humStdMax)) {
            stdHumLabel = Number(humStdMin).toFixed(1) + ' – ' + Number(humStdMax).toFixed(1) + ' %';
        } else if (humStdMin != null && !isNaN(humStdMin)) {
            stdHumLabel = '\u2265 ' + Number(humStdMin).toFixed(1) + ' %';
        } else if (humStdMax != null && !isNaN(humStdMax)) {
            stdHumLabel = '\u2264 ' + Number(humStdMax).toFixed(1) + ' %';
        }

        var h = '<div class="mb-3 text-xs text-gray-500">' + fmtMiles(markers.length) + ' ciudades en el recorrido | ' + fmtMiles(all.length) + ' lecturas</div>';
        h += '<div class="overflow-auto"><table class="w-full text-[0.8rem] border-collapse">';
        h += '<thead><tr class="bg-slate-100 text-left">'
            + '<th class="p-2 border-b font-semibold text-slate-700">N°</th>'
            + '<th class="p-2 border-b font-semibold text-slate-700">Fecha</th>'
            + '<th class="p-2 border-b font-semibold text-slate-700">Hora</th>'
            + '<th class="p-2 border-b font-semibold text-slate-700">Recorrido</th>';
        if (hasTempStd) h += '<th class="p-2 border-b font-semibold text-slate-700 text-right">Std Temp</th>';
        h += '<th class="p-2 border-b font-semibold text-slate-700 text-right">Temperatura (°C)</th>';
        if (hasHumStd) h += '<th class="p-2 border-b font-semibold text-slate-700 text-right">Std Hum</th>';
        h += '<th class="p-2 border-b font-semibold text-slate-700 text-right">Humedad (%)</th></tr></thead><tbody>';

        for (var i = 0; i < all.length; i++) {
            var r = all[i];
            var fechaEs = '';
            if (r.fecha && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) {
                fechaEs = r.fecha.substring(8, 10) + '/' + r.fecha.substring(5, 7) + '/' + r.fecha.substring(0, 4);
            } else {
                fechaEs = r.fecha || '';
            }
            var tempVal = r.temperatura != null ? r.temperatura.toFixed(1) : '—';
            var humVal = r.humedad != null ? r.humedad.toFixed(1) : '—';
            var tempColor = '#64748b';
            if (hasTempStd && r.temperatura != null && !isNaN(r.temperatura)) {
                var ok = true;
                if (stdMin != null && !isNaN(stdMin) && r.temperatura < Number(stdMin)) ok = false;
                if (stdMax != null && !isNaN(stdMax) && r.temperatura > Number(stdMax)) ok = false;
                tempColor = ok ? '#16a34a' : '#dc2626';
            }
            var humColor = '#64748b';
            if (hasHumStd && r.humedad != null && !isNaN(r.humedad)) {
                var okH = true;
                if (humStdMin != null && !isNaN(humStdMin) && r.humedad < Number(humStdMin)) okH = false;
                if (humStdMax != null && !isNaN(humStdMax) && r.humedad > Number(humStdMax)) okH = false;
                humColor = okH ? '#16a34a' : '#dc2626';
            }
            var bg = i % 2 === 0 ? '' : 'bg-slate-50';
            h += '<tr class="' + bg + '">'
                + '<td class="p-2 border-b text-slate-600">' + (i + 1) + '</td>'
                + '<td class="p-2 border-b text-slate-700">' + fechaEs + '</td>'
                + '<td class="p-2 border-b text-slate-600">' + (r.hora || '') + '</td>'
                + '<td class="p-2 border-b font-semibold text-indigo-700 whitespace-nowrap">' + esc(cityMap[i] || '') + '</td>';
            if (hasTempStd) h += '<td class="p-2 border-b text-right text-slate-500 text-[0.75rem]">' + stdTempLabel + '</td>';
            h += '<td class="p-2 border-b text-right font-semibold" style="color:' + tempColor + ';">' + tempVal + '</td>';
            if (hasHumStd) h += '<td class="p-2 border-b text-right text-slate-500 text-[0.75rem]">' + stdHumLabel + '</td>';
            h += '<td class="p-2 border-b text-right" style="color:' + humColor + ';">' + humVal + '</td></tr>';
        }
        h += '</tbody></table></div>';
        host.innerHTML = h;
    }

    function applyResult(r) {
        var loading = $('hc-ttpbb-loading');
        var empty = $('hc-ttpbb-empty');
        var meta = $('hc-ttpbb-meta');
        if (loading) loading.classList.add('lay-hidden');
        var all = (r && r.all) ? r.all : [];
        if (!all.length) {
            if (empty) empty.classList.remove('lay-hidden');
            return;
        }
        var statsDentro = 0, statsDebajo = 0, statsEncima = 0;
        var stdMinVal = r.stdMin, stdMaxVal = r.stdMax;
        for (var si = 0; si < all.length; si++) {
            var tv = all[si].temperatura;
            if (tv == null || isNaN(tv)) continue;
            if (stdMinVal != null && !isNaN(stdMinVal) && tv < Number(stdMinVal)) statsDebajo++;
            else if (stdMaxVal != null && !isNaN(stdMaxVal) && tv > Number(stdMaxVal)) statsEncima++;
            else statsDentro++;
        }
        if (meta && ctx) {
            var bitsMeta = 'Granja: ' + ctx.granja
                + ' | Campaña: ' + ctx.campania
                + ' | Galpón: ' + ctx.galponLabel;
            if (r.placa) bitsMeta += ' | Camión: ' + r.placa;
            if (r.empTransporte) bitsMeta += ' | Empresa: ' + r.empTransporte;
            var fmtPctOnly = function (num, total) {
                if (!total) return '0%';
                var p = Math.round(1000 * num / total) / 10;
                return String(p).replace(/\.0$/, '') + '%';
            };
            meta.innerHTML = esc(bitsMeta)
                + '<div class="hc-ttpbb-std-row">'
                + '<span>Cumple std: ' + statsDentro + '/' + all.length + ' <strong style="color:#16a34a">' + esc(fmtPctOnly(statsDentro, all.length)) + '</strong></span>'
                + '<span>Encima std: ' + statsEncima + '/' + all.length + ' <strong style="color:#dc2626">' + esc(fmtPctOnly(statsEncima, all.length)) + '</strong></span>'
                + '<span>Debajo std: ' + statsDebajo + '/' + all.length + ' <strong style="color:#dc2626">' + esc(fmtPctOnly(statsDebajo, all.length)) + '</strong></span>'
                + '</div>';
        }
        renderGrafica(all, r.stdMin, r.stdMax, r.humStdMin, r.humStdMax, r.cityData);
        renderDatos(all, r.stdMin, r.stdMax, r.humStdMin, r.humStdMax, r.cityData);
    }

    function openModal(payload) {
        if (!payload) return;
        var md = $('hc-modal-temp-ttpbb');
        var bd = $('hc-backdrop-temp-ttpbb');
        if (!md || !bd) return;
        var tit = $('hc-ttpbb-titulo');
        var meta = $('hc-ttpbb-meta');
        var loading = $('hc-ttpbb-loading');
        var empty = $('hc-ttpbb-empty');
        var chartWrapTemp = $('hc-ttpbb-chart-wrap-temp');
        var chartWrapHum = $('hc-ttpbb-chart-wrap-hum');

        ctx = {
            granja: String(payload.granja || '').trim(),
            campania: String(payload.campania || '').trim(),
            galpon: String(payload.galpon || '').trim(),
            galponLabel: String(payload.galponLabel || payload.galpon || '').trim(),
            placa: String(payload.placa || '').trim(),
            idCab: String(payload.idCab || payload.idsCab || '').trim()
        };

        if (tit) tit.textContent = 'Temperatura de transporte de pollo BB';
        if (meta) {
            meta.textContent = 'Granja: ' + ctx.granja
                + ' | Campaña: ' + ctx.campania
                + ' | Galpón: ' + ctx.galponLabel;
        }

        md.classList.remove('lay-hidden');
        bd.classList.remove('lay-hidden');
        setTab('grafica');
        if (empty) {
            empty.textContent = 'Sin lecturas para este galpón.';
            empty.classList.add('lay-hidden');
        }
        if (chartWrapTemp) chartWrapTemp.classList.add('lay-hidden');
        if (chartWrapHum) chartWrapHum.classList.add('lay-hidden');
        if (loading) loading.classList.remove('lay-hidden');

        var datosHost = $('hc-ttpbb-datos-host');
        if (datosHost) datosHost.innerHTML = '';
        if (chartTemp && typeof chartTemp.destroy === 'function') chartTemp.destroy();
        chartTemp = null;
        if (chartHum && typeof chartHum.destroy === 'function') chartHum.destroy();
        chartHum = null;

        var ready;
        if (payload.seriePayload && payload.seriePayload.serie) {
            ready = Promise.resolve(mapSeriePayload(payload.seriePayload));
        } else {
            ready = fetchAll();
        }
        ready.then(applyResult)['catch'](function () {
            if (loading) loading.classList.add('lay-hidden');
            if (empty) {
                empty.textContent = 'Error al cargar lecturas.';
                empty.classList.remove('lay-hidden');
            }
        });
    }

    function bindUi() {
        var closeBtn = $('hc-ttpbb-close');
        var cancelBtn = $('hc-ttpbb-cancel');
        var bd = $('hc-backdrop-temp-ttpbb');
        if (closeBtn && closeBtn.getAttribute('data-ttpbb-bound') !== '1') {
            closeBtn.setAttribute('data-ttpbb-bound', '1');
            closeBtn.addEventListener('click', closeModal);
        }
        if (cancelBtn && cancelBtn.getAttribute('data-ttpbb-bound') !== '1') {
            cancelBtn.setAttribute('data-ttpbb-bound', '1');
            cancelBtn.addEventListener('click', closeModal);
        }
        if (bd && bd.getAttribute('data-ttpbb-bound') !== '1') {
            bd.setAttribute('data-ttpbb-bound', '1');
            bd.addEventListener('click', closeModal);
        }
        document.querySelectorAll('.hc-ttpbb-tab').forEach(function (b) {
            if (b.getAttribute('data-hc-ttpbb-listener') === '1') return;
            b.setAttribute('data-hc-ttpbb-listener', '1');
            b.addEventListener('click', function () {
                setTab(b.getAttribute('data-hc-ttpbb-tab') || 'grafica');
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindUi);
    } else {
        bindUi();
    }

    var api = {
        open: openModal,
        close: closeModal,
        configure: configure,
        setTab: setTab
    };
    global.TtpbbGraficaModal = api;
    global.hcTtpbbOpenModal = openModal;
    global.hcTtpbbCloseModal = closeModal;
    global.hcTtpbbSetTab = setTab;
})(window);
