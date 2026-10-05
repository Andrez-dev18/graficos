/**
 * sip-grafica-mortalidad-render.js
 * Renderizado mortalidad (línea M/H, causas, pareto) alineado con HC.
 * Requiere: Chart.js, SipGraficaShared (opcional), chartjs-plugin-zoom (causas/pareto).
 */
(function () {
    'use strict';

    var DIA_MIN = 1;
    var DIA_MAX = 47;
    var LINE_COLOR = '#2563eb';
    var COL_OK = '#2563eb';
    var COL_BAD = '#dc2626';

    var CAUSE_COLORS_RGB = [
        [220, 38, 38], [37, 99, 235], [22, 163, 74], [147, 51, 234], [8, 145, 178],
        [219, 39, 119], [101, 163, 13], [79, 70, 229], [13, 148, 136], [225, 29, 72],
        [100, 116, 139], [192, 38, 211], [30, 58, 95], [146, 64, 14], [136, 19, 55],
        [21, 128, 61], [124, 58, 237]
    ];
    var CAUSE_COLORS = CAUSE_COLORS_RGB.map(function (rgb) {
        return 'rgba(' + rgb.join(',') + ',0.50)';
    });

    var charts = {};
    var colorMap = {};

    function SGS() {
        return window.SipGraficaShared || null;
    }

    function applyAnim(options, chartType) {
        var lib = SGS();
        if (lib && lib.applyChartAnimations) {
            return lib.applyChartAnimations(options, chartType);
        }
        options.animation = { duration: 780, easing: 'easeOutQuart' };
        return options;
    }

    function basePlugins(extra) {
        var lib = SGS();
        if (lib && lib.baseChartPlugins) {
            return lib.baseChartPlugins(extra || []);
        }
        return extra || [];
    }

    function fmtVal(v) {
        var lib = SGS();
        if (lib && lib.fmtVal) return lib.fmtVal(v);
        if (v == null || !isFinite(v)) return '';
        return String(v);
    }

    function fmtFecha(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
        return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
    }

    function destroy(key) {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    }

    function padLineData(linea) {
        var src = (linea && Array.isArray(linea.dataPorDia)) ? linea.dataPorDia : [];
        var byDia = {};
        src.forEach(function (d) {
            if (d && d.dia != null) byDia[parseInt(d.dia, 10)] = d;
        });
        var out = [];
        for (var d = DIA_MIN; d <= DIA_MAX; d++) {
            if (byDia[d]) {
                out.push(byDia[d]);
                continue;
            }
            var empty = { dia: d, fecha: null, estandar: { min: null, max: null }, macho: { valor: null, cumple: null }, hembra: { valor: null, cumple: null } };
            if (linea && linea.fechaInicio && /^\d{4}-\d{2}-\d{2}/.test(String(linea.fechaInicio))) {
                var dt = new Date(String(linea.fechaInicio).slice(0, 10) + 'T12:00:00');
                if (!isNaN(dt.getTime())) {
                    dt.setDate(dt.getDate() + (d - 1));
                    empty.fecha = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
                }
            }
            out.push(empty);
        }
        return out;
    }

    function normalizeCausas(causas, pareto) {
        if (!causas || !Array.isArray(causas.porFecha)) {
            return { fechas: [], causas: [], matriz: [], porFecha: [] };
        }
        var orden = [];
        if (pareto && Array.isArray(pareto.items)) {
            pareto.items.forEach(function (it) {
                var nom = it.nombre || it.causa || '';
                if (nom && orden.indexOf(nom) === -1) orden.push(nom);
            });
        }
        var totalesMap = {};
        causas.porFecha.forEach(function (dia) {
            (dia.causas || []).forEach(function (c) {
                var nom = c.nombre || c.causa || '';
                if (!nom) return;
                if (!totalesMap[nom]) totalesMap[nom] = 0;
                totalesMap[nom] += c.total || 0;
                if (orden.indexOf(nom) === -1) orden.push(nom);
            });
        });
        orden.sort(function (a, b) { return (totalesMap[b] || 0) - (totalesMap[a] || 0); });
        var causaIdx = {};
        orden.forEach(function (nom, i) { causaIdx[nom] = i; });
        var fechas = [];
        var matriz = [];
        causas.porFecha.forEach(function (dia) {
            fechas.push(dia.fecha);
            var row = new Array(orden.length);
            for (var z = 0; z < orden.length; z++) row[z] = 0;
            (dia.causas || []).forEach(function (c) {
                var nom = c.nombre || c.causa || '';
                if (nom && causaIdx[nom] != null) row[causaIdx[nom]] = c.total || 0;
            });
            matriz.push(row);
        });
        var totalesPorCausa = orden.map(function (nom) {
            return { causa: nom, total: totalesMap[nom] || 0 };
        });
        return { fechas: fechas, causas: orden, matriz: matriz, totalesPorCausa: totalesPorCausa, porFecha: causas.porFecha };
    }

    function renderLinea(canvasOrId, key, linea, sexo, label) {
        destroy(key);
        var canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas) return null;

        var sexKey = sexo === 'H' || sexo === 'hembra' ? 'hembra' : 'macho';
        var dataPorDia = padLineData(linea);
        var labels = dataPorDia.map(function (d) { return d.dia; });
        var valores = dataPorDia.map(function (d) {
            var s = d[sexKey];
            return s && s.valor != null ? s.valor : null;
        });
        var stdData = dataPorDia.map(function (d) {
            return d.estandar && d.estandar.max != null ? d.estandar.max : null;
        });
        var pointColors = dataPorDia.map(function (d) {
            var s = d[sexKey];
            if (!s || s.valor == null) return LINE_COLOR;
            if (s.cumple === false) return COL_BAD;
            if (s.cumple === true) return COL_OK;
            return LINE_COLOR;
        });

        var datasets = [{
            label: label || (sexKey === 'macho' ? 'Macho' : 'Hembra'),
            data: valores,
            borderColor: LINE_COLOR,
            backgroundColor: 'rgba(37,99,235,0.12)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            tension: 0.2,
            spanGaps: true
        }];

        var lib = SGS();
        if (lib && lib.buildStdDataset) {
            datasets.push(lib.buildStdDataset('Estándar', stdData));
        } else {
            datasets.push({
                label: 'Estándar',
                data: stdData,
                type: 'line',
                borderColor: '#16a34a',
                borderDash: [6, 3],
                pointRadius: 0,
                spanGaps: true,
                _hcStdDs: true
            });
        }

        var yRange = lib && lib.calcYRange
            ? lib.calcYRange(datasets, null, null, dataPorDia.map(function (d) {
                return { stdMax: d.estandar ? d.estandar.max : null, stdMin: d.estandar ? d.estandar.min : null };
            }))
            : { min: 0, max: null };

        charts[key] = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: applyAnim({
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                        filter: function (ti) { return !ti.dataset._hcStdDs; },
                        callbacks: {
                            title: function (items) {
                                if (!items || !items.length) return '';
                                var idx = items[0].dataIndex;
                                var dd = dataPorDia[idx];
                                var diaLbl = 'D' + (dd && dd.dia != null ? dd.dia : (idx + 1));
                                var fechaTxt = dd && dd.fecha ? ' (' + fmtFecha(dd.fecha) + ')' : '';
                                return 'Día ' + diaLbl + fechaTxt;
                            },
                            label: function (ctx) {
                                var val = ctx.parsed.y;
                                if (val == null || isNaN(val)) return null;
                                var idx = ctx.dataIndex;
                                var dd = dataPorDia[idx];
                                var stdVal = dd && dd.estandar && dd.estandar.max != null ? dd.estandar.max : null;
                                var lines = ['valor: ' + fmtVal(val)];
                                if (stdVal != null && isFinite(stdVal)) {
                                    lines.push('std: ' + fmtVal(stdVal));
                                    lines.push('dif: ' + fmtVal(val - stdVal));
                                }
                                return lines;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: DIA_MIN,
                        max: DIA_MAX,
                        ticks: {
                            stepSize: 1,
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            font: { size: 9 },
                            callback: function (v) { return 'D' + Math.round(v); }
                        }
                    },
                    y: {
                        title: { display: true, text: (linea && linea.unidad) ? linea.unidad : '%' },
                        min: yRange.min,
                        max: yRange.max
                    }
                }
            }, 'line'),
            plugins: basePlugins()
        });
        return charts[key];
    }

    function renderCausasStacked(canvasOrId, key, causas, pareto) {
        destroy(key);
        colorMap = {};
        var canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas) return null;

        var norm = normalizeCausas(causas, pareto);
        if (!norm.causas.length) {
            charts[key] = new Chart(canvas.getContext('2d'), { type: 'bar', data: { labels: [], datasets: [] } });
            return charts[key];
        }

        var fechas = norm.fechas;
        var firstDate = fechas[0] || '';
        var dayNumsByIdx = [];
        for (var fi = 0; fi < fechas.length; fi++) {
            var d0 = new Date(firstDate + 'T00:00:00');
            var d = new Date(fechas[fi] + 'T00:00:00');
            dayNumsByIdx.push(Math.round((d - d0) / 86400000) + 1);
        }
        var dayToDate = {};
        for (var mfi = 0; mfi < fechas.length; mfi++) {
            var mdn = dayNumsByIdx[mfi];
            if (mdn > 0 && mdn <= DIA_MAX) dayToDate[mdn] = fechas[mfi];
        }

        var labels = [];
        for (var ld = 1; ld <= DIA_MAX; ld++) labels.push('D' + ld);

        var datasets = [];
        for (var ci = 0; ci < norm.causas.length; ci++) {
            var color = CAUSE_COLORS[ci % CAUSE_COLORS.length];
            colorMap[norm.causas[ci]] = color;
            var dataFull = new Array(DIA_MAX);
            for (var z = 0; z < DIA_MAX; z++) dataFull[z] = 0;
            for (var fi2 = 0; fi2 < fechas.length; fi2++) {
                var val = (norm.matriz[fi2] && norm.matriz[fi2][ci] != null) ? norm.matriz[fi2][ci] : 0;
                var dIdx = dayNumsByIdx[fi2] - 1;
                if (dIdx >= 0 && dIdx < DIA_MAX) dataFull[dIdx] = val;
            }
            if (dataFull.every(function (v) { return v === 0; })) continue;
            datasets.push({
                label: norm.causas[ci],
                data: dataFull,
                backgroundColor: color,
                borderWidth: 0,
                barPercentage: 0.85,
                categoryPercentage: 0.8
            });
        }

        var zoomOpts = typeof Chart !== 'undefined' && Chart.registry && Chart.registry.getPlugin('zoom')
            ? {
                zoom: {
                    pan: { enabled: true, mode: 'xy' },
                    zoom: { wheel: { enabled: true, speed: 0.05 }, pinch: { enabled: true } },
                    limits: { x: { min: 0, max: labels.length - 1, minRange: 1 }, y: { minRange: 1 } }
                }
            }
            : {};

        charts[key] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: applyAnim(Object.assign({
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: Object.assign({
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                        itemSort: function (a, b) { return b.datasetIndex - a.datasetIndex; },
                        callbacks: {
                            title: function (items) {
                                if (!items || !items.length) return '';
                                var lbl = items[0].label || '';
                                var m = lbl.match(/^D(\d+)$/);
                                var diaN = m ? parseInt(m[1], 10) : 0;
                                var fechaTxt = diaN > 0 && dayToDate[diaN] ? ' (' + fmtFecha(dayToDate[diaN]) + ')' : '';
                                return lbl + fechaTxt;
                            },
                            label: function (ti) {
                                if (ti.raw === 0) return null;
                                return ti.dataset.label + ': ' + ti.raw + ' aves';
                            }
                        }
                    }
                }, zoomOpts),
                scales: {
                    x: {
                        stacked: true,
                        title: { display: true, text: 'Día de campaña', font: { size: 11 } },
                        ticks: { font: { size: 9 }, maxRotation: 90, minRotation: 90, autoSkip: false }
                    },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Cantidad de aves', font: { size: 11 } },
                        beginAtZero: true,
                        ticks: { callback: function (v) { return Number.isInteger(v) ? v : null; } }
                    }
                }
            }), 'bar'),
            plugins: basePlugins()
        });
        return charts[key];
    }

    function wrapLabel(text, maxLen) {
        maxLen = maxLen || 14;
        if (text.length <= maxLen) return [text];
        var words = text.split(/\s+/);
        var lines = [];
        var cur = '';
        words.forEach(function (w) {
            if ((cur + ' ' + w).trim().length > maxLen && cur !== '') {
                lines.push(cur);
                cur = w;
            } else {
                cur = (cur + ' ' + w).trim();
            }
        });
        if (cur) lines.push(cur);
        return lines.length ? lines : [text];
    }

    function renderPareto(canvasOrId, key, pareto) {
        destroy(key);
        var canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas) return null;

        var items = [];
        if (pareto && Array.isArray(pareto.items)) {
            items = pareto.items.map(function (it) {
                return { causa: it.nombre || it.causa || '', total: it.total || 0 };
            });
        }
        if (!items.length) {
            charts[key] = new Chart(canvas.getContext('2d'), { type: 'bar', data: { labels: [], datasets: [] } });
            return charts[key];
        }

        var total = items.reduce(function (s, it) { return s + it.total; }, 0);
        var labels = items.map(function (it) { return wrapLabel(it.causa, 14); });
        var barData = items.map(function (it) { return it.total; });
        var cumData = [];
        var cumSum = 0;
        for (var j = 0; j < items.length; j++) {
            cumSum += items[j].total;
            cumData.push(Math.round((cumSum / total) * 1000) / 10);
        }

        charts[key] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Cantidad',
                        data: barData,
                        backgroundColor: barData.map(function (_, i) {
                            return colorMap[items[i].causa] || CAUSE_COLORS[i % CAUSE_COLORS.length];
                        }),
                        borderColor: barData.map(function (_, i) {
                            var bg = colorMap[items[i].causa] || CAUSE_COLORS[i % CAUSE_COLORS.length];
                            return bg.replace(/[\d.]+\)$/, '1)');
                        }),
                        borderWidth: 2,
                        borderRadius: 5,
                        borderSkipped: false,
                        order: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: '% Acumulado',
                        data: cumData,
                        type: 'line',
                        borderColor: '#e74c3c',
                        pointBackgroundColor: '#e74c3c',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false,
                        tension: 0.1,
                        order: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: applyAnim({
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                        callbacks: {
                            label: function (ti) {
                                if (ti.datasetIndex === 0) return 'Cantidad: ' + ti.raw + ' aves';
                                return '% Acumulado: ' + ti.raw + '%';
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 10 } }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Causa de mortalidad', font: { size: 11 } },
                        ticks: { font: { size: 9 }, maxRotation: 0, minRotation: 0 }
                    },
                    y: {
                        position: 'left',
                        title: { display: true, text: 'Cantidad de aves', font: { size: 11 } },
                        beginAtZero: true,
                        ticks: { callback: function (v) { return Number.isInteger(v) ? v : null; } }
                    },
                    y1: {
                        position: 'right',
                        title: { display: true, text: '% Acumulado', font: { size: 11 } },
                        min: 0,
                        max: 100,
                        grid: { drawOnChartArea: false },
                        ticks: { callback: function (v) { return Math.round(v) + '%'; } }
                    }
                }
            }, 'bar'),
            plugins: basePlugins([{
                id: 'pareto80line',
                afterDraw: function (chart) {
                    var yScale = chart.scales.y1;
                    if (!yScale) return;
                    var y80 = yScale.getPixelForValue(80);
                    var ctx = chart.ctx;
                    ctx.save();
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(chart.scales.x.left, y80);
                    ctx.lineTo(chart.scales.x.right, y80);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#dc2626';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'right';
                    ctx.fillText('80%', chart.scales.x.right - 2, y80 - 4);
                    ctx.restore();
                }
            }])
        });
        return charts[key];
    }

    window.SipGraficaMortRender = {
        renderLinea: renderLinea,
        renderCausasStacked: renderCausasStacked,
        renderPareto: renderPareto,
        destroy: destroy,
        normalizeCausas: normalizeCausas,
        DIA_MIN: DIA_MIN,
        DIA_MAX: DIA_MAX
    };
})();
