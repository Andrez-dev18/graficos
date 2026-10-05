/**
 * Alertas graduadas LEVE/MODERADA/ALTA (semántica gatilladores/HC).
 */
(function () {
    'use strict';

    var SGA = {};

    SGA.TIPOS_ALERTA_GRADO = [
        'mortalidad',
        'consumo_alimento',
        'consumo_gas',
        'consumo_agua',
        'respiratorio',
        'digestivo'
    ];

    SGA.tipoDesdeInterconsultas = function (tipo) {
        var t = String(tipo || '').toLowerCase();
        if (t === 'mortalidad') return 'MORTALIDAD';
        if (t === 'consumo_alimento' || t === 'consumo_gas' || t === 'consumo_agua') return 'CONSUMO';
        if (t === 'respiratorio') return 'RESPIRATORIO';
        if (t === 'digestivo') return 'HECES';
        return null;
    };

    SGA.decimalesTooltip = function (item, val) {
        var tipo = item && item.tipo ? item.tipo : '';
        if (tipo === 'consumo_alimento' || tipo === 'pesaje_pollo' || tipo === 'ganancia_peso' || tipo === 'nivel_cloro') return 3;
        return (val != null && val < 1) ? 3 : 2;
    };

    SGA.tooltipAlertaDia = function (tipo, meta, umb, opts) {
        opts = opts || {};
        if (!meta || meta.val == null || isNaN(meta.val)) return [];
        var u = umb || window.gUmbrales || {};

        function gradoPorDif(absDif, pref) {
            if (absDif == null || isNaN(absDif)) return null;
            var leve = (u[pref + 'Leve'] != null && isFinite(u[pref + 'Leve'])) ? u[pref + 'Leve'] : (pref === 'hec' ? 5 : 0.1);
            var mod = (u[pref + 'Moderado'] != null && isFinite(u[pref + 'Moderado'])) ? u[pref + 'Moderado'] : (pref === 'hec' ? 10 : 0.2);
            if (absDif >= mod) return 'ALTA';
            if (absDif >= leve) return 'MODERADA';
            if (absDif > 0) return 'LEVE';
            return null;
        }

        function gradoPct(v, pref) {
            if (v == null || !isFinite(v)) return null;
            var leve = (u[pref + 'Leve'] != null && isFinite(u[pref + 'Leve'])) ? u[pref + 'Leve'] : 25;
            var mod = (u[pref + 'Moderado'] != null && isFinite(u[pref + 'Moderado'])) ? u[pref + 'Moderado'] : 50;
            var fue = (u[pref + 'Fuerte'] != null && isFinite(u[pref + 'Fuerte'])) ? u[pref + 'Fuerte'] : 75;
            if (v >= fue) return 'ALTA';
            if (v >= mod) return 'MODERADA';
            if (v >= leve) return 'LEVE';
            return null;
        }

        var val = meta.val;
        var stdVal = meta.stdVal;
        var diff = meta.diff;
        if (diff == null && stdVal != null && isFinite(stdVal) && isFinite(val)) {
            diff = val - stdVal;
        }
        var grado = null;
        var t = String(tipo || '').toUpperCase();

        if (t === 'MORTALIDAD') {
            if (diff != null && isFinite(diff) && diff > 0) {
                grado = gradoPorDif(Math.abs(diff), 'mort');
            }
        } else if (t === 'CONSUMO') {
            if (diff != null && isFinite(diff) && diff < 0) {
                grado = gradoPorDif(Math.abs(diff), 'cons');
            }
        } else if (t === 'RESPIRATORIO') {
            var mk = meta.metricKey || '';
            var lbl = String(meta.label || '');
            var esEst = /estornudo/i.test(lbl) || mk === 'estornudo';
            var med = opts.respMedicion || 'todos';
            if (med === 'estornudo') esEst = true;
            if (med === 'ronquera') esEst = false;
            grado = esEst ? gradoPct(val, 'est') : gradoPct(val, 'resp');
        } else if (t === 'HECES') {
            var medH = opts.hecesMedicion || 'todos';
            if (String(medH).toLowerCase() !== 'todos' && medH) {
                if (diff != null && isFinite(diff) && diff > 0) {
                    grado = gradoPorDif(Math.abs(diff), 'hec');
                }
            } else if (meta.hecesTotal != null && stdVal != null && isFinite(stdVal) && meta.hecesTotal > stdVal) {
                grado = gradoPorDif(Math.abs(meta.hecesTotal - stdVal), 'hec');
            }
        }

        if (!grado) return [];
        return ['alerta: ' + grado];
    };

    SGA.buildMetaFromInterconsultas = function (item, ctx, origIdx, val, stdVal) {
        var meta = {
            val: val,
            stdVal: stdVal,
            diff: (stdVal != null && isFinite(stdVal) && isFinite(val)) ? val - stdVal : null,
            label: ctx && ctx.dataset ? (ctx.dataset.label || '') : '',
            metricKey: ''
        };
        if (item.tipo === 'digestivo') {
            var idx = origIdx;
            var slots = ['A', 'P', 'S', 'R'];
            var sum = 0;
            var has = false;
            slots.forEach(function (s) {
                var arr = item['dataDigestivo' + s];
                if (Array.isArray(arr) && arr[idx] != null && !isNaN(arr[idx])) {
                    sum += Number(arr[idx]);
                    has = true;
                }
            });
            if (has) {
                meta.hecesTotal = sum;
                meta.val = sum;
                meta.diff = (stdVal != null && isFinite(stdVal)) ? sum - stdVal : null;
            }
        }
        if (item.tipo === 'respiratorio') {
            var lbl = meta.label.toLowerCase();
            if (lbl.indexOf('ronquera') >= 0) meta.metricKey = 'ronquera';
            else if (lbl.indexOf('estornudo') >= 0) meta.metricKey = 'estornudo';
        }
        return meta;
    };

    SGA.lineasAlertaValorStd = function (item, ctx, origIdx, val, stdVal, opts) {
        opts = opts || {};
        if (val == null || isNaN(val)) return null;
        var u = item.unidad || '%';
        var dec = SGA.decimalesTooltip(item, val);
        var fmt = function (n) {
            return (n == null || isNaN(n)) ? '-' : (parseFloat(n).toFixed(dec) + ' ' + u);
        };

        var lines = ['valor: ' + fmt(val)];
        if (stdVal == null || isNaN(stdVal)) return lines;

        lines.push('std: ' + fmt(stdVal));
        var dif = val - stdVal;
        lines.push('dif: ' + (dif > 0 ? '+' : '') + fmt(dif));

        if (SGA.TIPOS_ALERTA_GRADO.indexOf(item.tipo) >= 0) {
            var alertTipo = SGA.tipoDesdeInterconsultas(item.tipo);
            if (alertTipo) {
                var meta = SGA.buildMetaFromInterconsultas(item, ctx, origIdx, val, stdVal);
                SGA.tooltipAlertaDia(alertTipo, meta, window.gUmbrales, opts).forEach(function (ln) {
                    lines.push(ln);
                });
            }
        }
        return lines;
    };

    SGA.afterBodyAlertasInterconsultas = function (item, items) {
        if (!item || !items || !items.length) return [];
        var idx = items[0].dataIndex;
        var origIdx = (item._displayStartIdx || 0) + idx;
        var opts = {
            respMedicion: item.signoActivo || 'todos',
            hecesMedicion: 'todos'
        };
        var out = [];

        if (item.tipo === 'respiratorio') {
            items.forEach(function (ti) {
                if (!ti.dataset || ti.dataset._hcStdDs) return;
                var val = ti.parsed.y;
                if (val == null || isNaN(val)) return;
                var meta = SGA.buildMetaFromInterconsultas(item, ti, origIdx, val, null);
                var pref = (meta.metricKey === 'ronquera') ? 'Ronquera' : 'Estornudo';
                SGA.tooltipAlertaDia('RESPIRATORIO', meta, window.gUmbrales, opts).forEach(function (ln) {
                    out.push(pref + ' — ' + ln);
                });
            });
            return out;
        }

        if (item.tipo === 'digestivo') {
            var stdVal = item.dataStd ? item.dataStd[origIdx] : null;
            var sum = 0;
            var has = false;
            ['A', 'P', 'S', 'R'].forEach(function (s) {
                var arr = item['dataDigestivo' + s];
                if (Array.isArray(arr) && arr[origIdx] != null && !isNaN(arr[origIdx])) {
                    sum += Number(arr[origIdx]);
                    has = true;
                }
            });
            if (!has) return [];
            var metaD = SGA.buildMetaFromInterconsultas(item, items[0], origIdx, sum, stdVal);
            if (stdVal != null && !isNaN(stdVal)) {
                var u = item.unidad || '%';
                var dec = SGA.decimalesTooltip(item, sum);
                var fmt = function (n) { return parseFloat(n).toFixed(dec) + ' ' + u; };
                out.push('total: ' + fmt(sum));
                out.push('std: ' + fmt(stdVal));
                var dif = sum - stdVal;
                out.push('dif: ' + (dif > 0 ? '+' : '') + fmt(dif));
            }
            SGA.tooltipAlertaDia('HECES', metaD, window.gUmbrales, opts).forEach(function (ln) {
                out.push(ln);
            });
            return out;
        }

        return out;
    };

    window.SipGraficaAlertas = SGA;
})();
