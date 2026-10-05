/**
 * Utilidades de Fechas, Formatos, Calculadores y Adaptadores de Datos
 */
var configGraficos = [];
var chartInstances = {};
var cacheGranjasData = [];

function formatISOFecha(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatISOMes(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

function getISOWeekString(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getRangoUltimaSemana() {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 6);

    const d1 = String(hace7Dias.getDate()).padStart(2, '0');
    const m1 = String(hace7Dias.getMonth() + 1).padStart(2, '0');
    const d2 = String(hoy.getDate()).padStart(2, '0');
    const m2 = String(hoy.getMonth() + 1).padStart(2, '0');

    return `${d1}/${m1}/${hace7Dias.getFullYear()} - ${d2}/${m2}/${hoy.getFullYear()}`;
}

function calcularAcumulado(arr) {
    if (!Array.isArray(arr)) return [];
    let suma = 0;
    return arr.map(v => {
        if (v !== null && v !== undefined && !isNaN(v)) {
            suma += parseFloat(v);
            return parseFloat(suma.toFixed(3));
        }
        return null;
    });
}

function calcularAcumuladoDigestivo(pA, pP, pS, pR) {
    const arrA = pA || [];
    const arrP = pP || [];
    const arrS = pS || [];
    const arrR = pR || [];
    const len = Math.max(arrA.length, arrP.length, arrS.length, arrR.length);
    let sumA = 0, sumP = 0, sumS = 0, sumR = 0;
    let hasDataA = false, hasDataP = false, hasDataS = false, hasDataR = false;

    const resA = [];
    const resP = [];
    const resS = [];
    const resR = [];

    for (let i = 0; i < len; i++) {
        const vA = (arrA[i] != null && !isNaN(arrA[i])) ? parseFloat(arrA[i]) : null;
        const vP = (arrP[i] != null && !isNaN(arrP[i])) ? parseFloat(arrP[i]) : null;
        const vS = (arrS[i] != null && !isNaN(arrS[i])) ? parseFloat(arrS[i]) : null;
        const vR = (arrR[i] != null && !isNaN(arrR[i])) ? parseFloat(arrR[i]) : null;

        const anyHasDayData = (vA !== null || vP !== null || vS !== null || vR !== null);

        if (vA !== null) { sumA += vA; hasDataA = true; }
        if (vP !== null) { sumP += vP; hasDataP = true; }
        if (vS !== null) { sumS += vS; hasDataS = true; }
        if (vR !== null) { sumR += vR; hasDataR = true; }

        if (anyHasDayData) {
            resA.push(hasDataA ? parseFloat(sumA.toFixed(2)) : null);
            resP.push(hasDataP ? parseFloat(sumP.toFixed(2)) : null);
            resS.push(hasDataS ? parseFloat(sumS.toFixed(2)) : null);
            resR.push(hasDataR ? parseFloat(sumR.toFixed(2)) : null);
        } else {
            resA.push(null);
            resP.push(null);
            resS.push(null);
            resR.push(null);
        }
    }

    return { A: resA, P: resP, S: resS, R: resR };
}

function calcularSemanal(arr) {
    if (!Array.isArray(arr)) return [];
    let res = [];
    for (let i = 0; i < arr.length; i += 7) {
        const chunk = arr.slice(i, i + 7);
        const validValues = chunk.filter(v => v !== null && v !== undefined && !isNaN(v));
        if (validValues.length > 0) {
            const suma = validValues.reduce((a, b) => a + parseFloat(b), 0);
            res.push(parseFloat(suma.toFixed(3)));
        } else {
            res.push(null);
        }
    }
    return res;
}

function esTipoGraficoBarras(tipo) {
    return tipo === 'respiratorio' || tipo === 'digestivo' || tipo === 'nivel_cloro'
        || tipo === 'medicacion' || tipo === 'gorgojos' || tipo === 'roedores';
}

/** En combinado: convertir métricas barra → líneas (solo si el estilo no pide barras). */
function combinadoConvierteBarraALinea(tipoVisual, item) {
    if (!item || !item.esCombinado) return false;
    const tv = tipoVisual || 'default';
    if (tv === 'doughnut' || tv === 'pie') return false;
    if (tv === 'bar') return false;
    if (tv === 'line') return true;
    if (item.forzarLineasEnCombinado === true) return true;
    if (item.tipo === 'combinado' || item.modoCombinado === 'granja') return true;
    return false;
}

function combinadoDebeForzarLineas(item) {
    if (!item || !item.esCombinado) return false;
    const tv = (item.tipoVisualizacion && item.tipoVisualizacion !== 'default')
        ? item.tipoVisualizacion
        : ((typeof tipoVisualizacionGlobal !== 'undefined') ? tipoVisualizacionGlobal : 'default');
    return combinadoConvierteBarraALinea(tv, item);
}

/** Estándar siempre continúa; pesaje/ganancia (muestreo discontinuo) también; mediciones nativas en línea no.
 *  Líneas convertidas desde tipo barra sí conectan saltos. */
function spanGapsSerieMedicion(item, esEstandar, tipoVisual) {
    if (esEstandar) return true;
    var tipoItem = item && item.tipo ? String(item.tipo) : '';
    if (tipoItem === 'pesaje_pollo' || tipoItem === 'ganancia_peso') return true;
    if (item && typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(item.tipo)) {
        const tv = tipoVisual != null ? tipoVisual : (
            (item.tipoVisualizacion && item.tipoVisualizacion !== 'default')
                ? item.tipoVisualizacion
                : ((typeof tipoVisualizacionGlobal !== 'undefined') ? tipoVisualizacionGlobal : 'default')
        );
        if (typeof visualizacionPermiteBarras === 'function' && !visualizacionPermiteBarras(tv, item)) {
            return true;
        }
    }
    return false;
}

function barModeSerie(tipo, barModeExplicito) {
    if (barModeExplicito === 'stacked' || barModeExplicito === 'grouped') return barModeExplicito;
    if (esTipoBarraApilada(tipo)) return 'stacked';
    if (esTipoGraficoBarras(tipo)) return 'grouped';
    return null;
}

/**
 * ¿Dibujar barras? Respeta el selector global/tarjeta (line/bar) y el default por tipo (p. ej. respiratorio → barras).
 */
function visualizacionPermiteBarras(tipoVisual, item) {
    const tv = tipoVisual || 'default';
    if (tv === 'line' || tv === 'doughnut' || tv === 'pie') return false;
    if (tv === 'bar') return true;
    if (item && item.esCombinado && item.tipo === 'combinado') return false;
    if (item && String(item.chartType || '').toLowerCase() === 'bar') return true;
    if (item && typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(item.tipo)) return true;
    return false;
}

function esTipoBarraVisAyuda(tipo) {
    return tipo === 'respiratorio' || tipo === 'nivel_cloro' || tipo === 'gorgojos' || tipo === 'roedores';
}

function esTipoBarraApilada(tipo) {
    return tipo === 'medicacion' || tipo === 'digestivo';
}

/** Serie apilada dentro de un combinado (multi-eje): conserva barras apiladas sin importar el estilo elegido. */
function serieCombinadaApilada(item, sObj) {
    if (!item || !item.esCombinado || !sObj) return false;
    if (item.modoCombinado === 'granja') return false;
    return typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(sObj.tipo);
}

function calcSuggestedMaxBarras(datasets) {
    const totals = [];
    let maxLen = 0;
    (datasets || []).forEach(ds => {
        if (ds && ds._hcStdDs) return;
        const data = ds.data || [];
        if (data.length > maxLen) maxLen = data.length;
    });
    for (let i = 0; i < maxLen; i++) {
        let sum = 0;
        let any = false;
        (datasets || []).forEach(ds => {
            if (!ds || ds._hcStdDs || (ds.type && ds.type !== 'bar')) return;
            const v = ds.data ? ds.data[i] : null;
            if (v != null && !isNaN(v)) {
                sum += parseFloat(v);
                any = true;
            }
        });
        if (any && sum > 0) totals.push(sum);
    }
    if (!totals.length) return undefined;
    totals.sort((a, b) => a - b);
    const max = totals[totals.length - 1];
    const p90 = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.9))];
    if (max > 0 && p90 > 0 && max > p90 * 2.5) {
        return Math.ceil(p90 * 1.35 * 100) / 100;
    }
    const factor = max <= 1 ? 1.3 : (max <= 5 ? 1.22 : 1.15);
    return Math.ceil(max * factor * 100) / 100;
}

function rangoZoomBarrasConDatos(datasets, labelsLen, ventanaMin) {
    const n = labelsLen || 0;
    if (n <= ventanaMin) return null;
    let first = -1;
    let last = -1;
    (datasets || []).forEach(ds => {
        if (!ds || ds._hcStdDs) return;
        if (ds.type && ds.type !== 'bar') return;
        (ds.data || []).forEach((v, i) => {
            if (v != null && !isNaN(v) && parseFloat(v) !== 0) {
                if (first < 0 || i < first) first = i;
                if (i > last) last = i;
            }
        });
    });
    const pad = 2;
    if (first < 0) {
        return { min: Math.max(0, n - ventanaMin), max: n - 1 };
    }
    let min = Math.max(0, first - pad);
    let max = Math.min(n - 1, last + pad);
    if (max - min + 1 < ventanaMin) {
        max = Math.min(n - 1, min + ventanaMin - 1);
    }
    if (max - min + 1 > 28) {
        max = Math.min(n - 1, min + 27);
    }
    return { min, max };
}

function aplicarZoomInicialBarras(chart, item, ventanaMin) {
    if (!chart || !item || !item.labels) return;
    if (!chart.canvas || !chart.canvas.isConnected) return;
    if (item.tipo === 'medicacion') return;
    if (!esTipoBarraApilada(item.tipo)) return;
    if (typeof visualizacionPermiteBarras === 'function') {
        const tv = (item.tipoVisualizacion && item.tipoVisualizacion !== 'default')
            ? item.tipoVisualizacion
            : ((typeof tipoVisualizacionGlobal !== 'undefined') ? tipoVisualizacionGlobal : 'default');
        if (!visualizacionPermiteBarras(tv, item)) return;
    }
    const rango = rangoZoomBarrasConDatos(chart.data.datasets, item.labels.length, ventanaMin || 21);
    if (!rango) return;
    try {
        if (typeof chart.zoomScale === 'function') {
            chart.zoomScale('x', { min: rango.min, max: rango.max });
        }
    } catch (e) { /* ignore */ }
}

function respuestaGraficaTieneDatos(res) {
    if (!res || typeof res !== 'object') {
        return false;
    }
    if (res.success === true || res.success === 1 || res.success === '1' || res.success === 'true') {
        return true;
    }
    const linea = (res.linea && typeof res.linea === 'object') ? res.linea : null;
    if (linea && (linea.success === true || linea.success === 1 || linea.success === '1' || linea.success === 'true')) {
        return true;
    }
    const data = linea && Array.isArray(linea.dataPorDia) ? linea.dataPorDia : res.dataPorDia;
    return Array.isArray(data) && data.length > 0;
}

function unidadPlagasItem(tipo, ambito) {
    if (tipo === 'roedores' && String(ambito || 'avistamiento') === 'consumo') {
        return '%';
    }
    if (tipo === 'gorgojos' || tipo === 'roedores') {
        return 'n';
    }
    return '';
}

function promedioSeriesNumericas(a, b) {
    const lenA = Array.isArray(a) ? a.length : 0;
    const lenB = Array.isArray(b) ? b.length : 0;
    const n = Math.max(lenA, lenB);
    const out = [];
    let i;
    for (i = 0; i < n; i++) {
        const vals = [];
        if (Array.isArray(a) && i < lenA && a[i] !== null && a[i] !== undefined && a[i] !== '' && !isNaN(a[i])) {
            vals.push(Number(a[i]));
        }
        if (Array.isArray(b) && i < lenB && b[i] !== null && b[i] !== undefined && b[i] !== '' && !isNaN(b[i])) {
            vals.push(Number(b[i]));
        }
        out.push(vals.length ? Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)) : null);
    }
    return out;
}

function sumarSeriesNumericas(...series) {
    const arrs = series.filter((s) => Array.isArray(s));
    const n = arrs.length ? Math.max(...arrs.map((a) => a.length)) : 0;
    if (n === 0) {
        return [];
    }
    const out = [];
    let i;
    for (i = 0; i < n; i++) {
        let sum = 0;
        let has = false;
        arrs.forEach((arr) => {
            const v = arr[i];
            if (v !== null && v !== undefined && v !== '' && !isNaN(v)) {
                sum += Number(v);
                has = true;
            }
        });
        out.push(has ? Number(sum.toFixed(2)) : null);
    }
    return out;
}

function resolverSerieConsumoTodos(pTot, pPer, pTec) {
    const lenTot = Array.isArray(pTot) ? pTot.length : 0;
    const lenPer = Array.isArray(pPer) ? pPer.length : 0;
    const lenTec = Array.isArray(pTec) ? pTec.length : 0;
    const n = Math.max(lenTot, lenPer, lenTec);
    if (n === 0) {
        return pTot || [];
    }
    const out = [];
    let i;
    for (i = 0; i < n; i++) {
        let v = (Array.isArray(pTot) && i < lenTot) ? pTot[i] : null;
        if (v !== null && v !== undefined && v !== '' && !isNaN(v)) {
            out.push(Number(v));
            continue;
        }
        const p = (Array.isArray(pPer) && i < lenPer && pPer[i] !== null && pPer[i] !== undefined && pPer[i] !== '' && !isNaN(pPer[i])) ? Number(pPer[i]) : null;
        const t = (Array.isArray(pTec) && i < lenTec && pTec[i] !== null && pTec[i] !== undefined && pTec[i] !== '' && !isNaN(pTec[i])) ? Number(pTec[i]) : null;
        if (p !== null && t !== null) {
            out.push(Number((p + t).toFixed(1)));
        } else if (p !== null) {
            out.push(p);
        } else if (t !== null) {
            out.push(t);
        } else {
            out.push(null);
        }
    }
    return out;
}

function stdRefDesdeCatalogo(estEntry, tipoItem, modoEval) {
    if (!estEntry) return null;
    const min = estEntry.min != null && !isNaN(estEntry.min) ? Number(estEntry.min) : null;
    const max = estEntry.max != null && !isNaN(estEntry.max) ? Number(estEntry.max) : null;
    if (min == null && max == null) return null;
    const modo = modoEval || (tipoItem === 'consumo_alimento' || tipoItem === 'ganancia_peso' || tipoItem === 'pesaje_pollo' ? 'solo_min' : 'solo_max');
    if (modo === 'solo_min') return min != null ? min : max;
    if (modo === 'solo_max') return max != null ? max : min;
    if (min != null && max != null) return (min + max) / 2;
    return min != null ? min : max;
}

function stdRefDesdeCatalogoSexo(estEntry, tipoItem, modoEval, sexo) {
    if (!estEntry) return null;
    const esM = sexo !== 'hembra';
    const minSexo = esM ? estEntry.minM : estEntry.minH;
    const maxSexo = esM ? estEntry.maxM : estEntry.maxH;
    if (minSexo == null && maxSexo == null) {
        return stdRefDesdeCatalogo(estEntry, tipoItem, modoEval);
    }

    return stdRefDesdeCatalogo({ min: minSexo, max: maxSexo }, tipoItem, modoEval);
}

function pad47DiasLineData(apiItem) {
    const linea = apiItem.linea || apiItem;
    const src = (linea && Array.isArray(linea.dataPorDia)) ? linea.dataPorDia : [];
    const tipoItem = apiItem.tipo || (apiItem.metadata && apiItem.metadata.tipo) || '';
    const esSemanal = Boolean(tipoItem === 'ganancia_peso');

    const byDia = {};
    src.forEach(d => {
        if (!d) return;
        if (esSemanal) {
            const key = d.semana != null ? parseInt(d.semana, 10) : (d.dia != null ? parseInt(d.dia, 10) : null);
            if (key != null) byDia[key] = d;
        } else {
            if (d.edadStd != null && d.edadStd > 0) {
                byDia[parseInt(d.edadStd, 10)] = d;
            } else if (d.dia != null) {
                byDia[parseInt(d.dia, 10)] = d;
            } else if (d.semana != null) {
                byDia[parseInt(d.semana, 10)] = d;
            }
        }
    });

    // Detectar horas de aplicación si vienen en el JSON o en las lecturas
    let horasAplicacion = Array.isArray(apiItem.horasAplicacion) ? [...apiItem.horasAplicacion] : [];
    if (horasAplicacion.length === 0) {
        const horasSet = new Set();
        src.forEach(d => {
            if (Array.isArray(d.lecturas)) {
                d.lecturas.forEach(l => {
                    if (l.hora) horasSet.add(l.hora);
                });
            }
        });
        if (horasSet.size > 0) {
            horasAplicacion = Array.from(horasSet);
        }
    }

    // Fecha base de inicio
    let fechaInicioStr = (linea && linea.fechaInicio && /^\d{4}-\d{2}-\d{2}/.test(String(linea.fechaInicio)))
        ? String(linea.fechaInicio).slice(0, 10)
        : null;

    if (!fechaInicioStr && src.length > 0 && src[0].fecha && /^\d{4}-\d{2}-\d{2}/.test(String(src[0].fecha))) {
        const firstDate = new Date(String(src[0].fecha).slice(0, 10) + 'T12:00:00');
        const firstDia = src[0].dia != null ? parseInt(src[0].dia, 10) : (src[0].semana != null ? (parseInt(src[0].semana, 10) - 1) * 7 + 1 : 1);
        firstDate.setDate(firstDate.getDate() - (firstDia - 1));
        fechaInicioStr = formatISOFecha(firstDate);
    }

    if (!fechaInicioStr) {
        fechaInicioStr = formatISOFecha(new Date());
    }

    const baseDate = new Date(fechaInicioStr + 'T12:00:00');

    const labels = [];
    const dataMacho = [];
    const dataHembra = [];
    const dataCumpleMacho = [];
    const dataCumpleHembra = [];
    const dataStd = [];
    const dataStdM = [];
    const dataStdH = [];
    const dataFechas = [];
    const dataHoras = {};
    const dataEstornudoM = [];
    const dataEstornudoH = [];
    const dataRonqueraM = [];
    const dataRonqueraH = [];
    const dataDigestivoA = [];
    const dataDigestivoP = [];
    const dataDigestivoS = [];
    const dataDigestivoR = [];
    const dataLarvaM = [];
    const dataLarvaH = [];
    const dataAdultoM = [];
    const dataAdultoH = [];
    const dataVivos = [];
    const dataMuertos = [];
    const dataPerimetro = [];
    const dataTecho = [];
    const dataConsumoTodos = [];

    const metricasMedicacion = Array.isArray(linea.metricas) ? linea.metricas : (Array.isArray(linea.medicinas) ? linea.medicinas.map(m => (m.nombre || m)) : []);
    const dataMedicacion = {};
    metricasMedicacion.forEach(mName => {
        dataMedicacion[mName] = [];
    });

    horasAplicacion.forEach(h => {
        dataHoras[h] = [];
    });

    let lastKnownStd = (linea.stdMax !== undefined && linea.stdMax !== null) ? parseFloat(linea.stdMax) : null;

    const dataEstandarArr = (linea && Array.isArray(linea.dataEstandar)) ? linea.dataEstandar
        : (Array.isArray(apiItem.dataEstandar) ? apiItem.dataEstandar : []);
    const estByDia = {};
    dataEstandarArr.forEach((e) => {
        if (e && e.dia != null) estByDia[parseInt(e.dia, 10)] = e;
    });
    const modoEvalPad = (linea && linea.modoEvaluacion) || apiItem.modoEvaluacion
        || (tipoItem === 'consumo_alimento' || tipoItem === 'ganancia_peso' || tipoItem === 'pesaje_pollo' ? 'solo_min' : 'solo_max');
    const tieneCatalogoStd = dataEstandarArr.length > 0;

    function stdDesdeDayObj(dayObj) {
        if (!dayObj) return null;
        if (dayObj.stdMax !== undefined && dayObj.stdMax != null) {
            return parseFloat(dayObj.stdMax);
        }
        if (dayObj.stdMin !== undefined && dayObj.stdMin != null) {
            return parseFloat(dayObj.stdMin);
        }
        if (dayObj.estandar && (dayObj.estandar.max != null || dayObj.estandar.min != null)) {
            return parseFloat(dayObj.estandar.max ?? dayObj.estandar.min);
        }
        return null;
    }

    function stdDesdeDayObjSexo(dayObj, sexo) {
        if (!dayObj) return null;
        const par = (sexo === 'hembra') ? dayObj.estandarH : dayObj.estandarM;
        if (par && (par.max != null || par.min != null)) {
            return parseFloat(par.max ?? par.min);
        }
        return stdDesdeDayObj(dayObj);
    }

    const resolverStdPaso = (step, stdDesdeDia) => {
        const cat = stdRefDesdeCatalogo(estByDia[step], tipoItem, modoEvalPad);
        if (cat != null) return cat;
        if (stdDesdeDia != null && !isNaN(stdDesdeDia)) return stdDesdeDia;
        if (tieneCatalogoStd) return null;
        return lastKnownStd;
    };

    const resolverStdPasoSexo = (step, stdDesdeDia, sexo, stdFallback) => {
        const cat = stdRefDesdeCatalogoSexo(estByDia[step], tipoItem, modoEvalPad, sexo);
        if (cat != null) return cat;
        if (stdDesdeDia != null && !isNaN(stdDesdeDia)) return stdDesdeDia;
        if (tieneCatalogoStd) return null;
        if (stdFallback != null && !isNaN(stdFallback)) return stdFallback;
        return lastKnownStd;
    };

    const totalSteps = esSemanal ? 7 : 47;

    for (let step = 1; step <= totalSteps; step++) {
        const dt = new Date(baseDate.getTime());
        if (esSemanal) {
            dt.setDate(dt.getDate() + (step - 1) * 7);
        } else {
            dt.setDate(dt.getDate() + (step - 1));
        }

        const diaStr = String(dt.getDate()).padStart(2, '0');
        const mesStr = String(dt.getMonth() + 1).padStart(2, '0');
        const anioStr = dt.getFullYear();
        dataFechas.push(`${diaStr}/${mesStr}/${anioStr}`);

        const dayObj = byDia[step];
        labels.push(esSemanal ? `S${step}` : `D${step}`);

        if (dayObj) {
            let valM = null;
            if (dayObj.valoresM && dayObj.valoresM.length > 0 && dayObj.valoresM[0] != null) {
                valM = parseFloat(dayObj.valoresM[0]);
            } else if (dayObj.macho && dayObj.macho.valor != null) {
                valM = parseFloat(dayObj.macho.valor);
            } else if (dayObj.valores && dayObj.valores.length > 0 && dayObj.valores[0] != null) {
                valM = parseFloat(dayObj.valores[0]);
            } else if (dayObj.valor != null && !isNaN(dayObj.valor)) {
                valM = parseFloat(dayObj.valor);
            }

            let valH = null;
            if (dayObj.valoresH && dayObj.valoresH.length > 0 && dayObj.valoresH[0] != null) {
                valH = parseFloat(dayObj.valoresH[0]);
            } else if (dayObj.hembra && dayObj.hembra.valor != null) {
                valH = parseFloat(dayObj.hembra.valor);
            }

            let cumpleM = null;
            if (dayObj.macho && dayObj.macho.cumple !== undefined) {
                cumpleM = Boolean(dayObj.macho.cumple);
            } else if (dayObj.cumpleM !== undefined) {
                cumpleM = Boolean(dayObj.cumpleM);
            } else if (dayObj.cumple !== undefined) {
                cumpleM = Boolean(dayObj.cumple);
            }

            let cumpleH = null;
            if (dayObj.hembra && dayObj.hembra.cumple !== undefined) {
                cumpleH = Boolean(dayObj.hembra.cumple);
            } else if (dayObj.cumpleH !== undefined) {
                cumpleH = Boolean(dayObj.cumpleH);
            } else if (dayObj.cumple !== undefined) {
                cumpleH = Boolean(dayObj.cumple);
            }

            // Procesar métricas respiratorias (estornudo / ronquera)
            let estM = null, estH = null, ronM = null, ronH = null;
            if (dayObj.estornudo) {
                if (dayObj.estornudo.macho && dayObj.estornudo.macho.valor != null && !isNaN(dayObj.estornudo.macho.valor)) {
                    estM = parseFloat(dayObj.estornudo.macho.valor);
                }
                if (dayObj.estornudo.hembra && dayObj.estornudo.hembra.valor != null && !isNaN(dayObj.estornudo.hembra.valor)) {
                    estH = parseFloat(dayObj.estornudo.hembra.valor);
                }
            }
            if (dayObj.ronquera) {
                if (dayObj.ronquera.macho && dayObj.ronquera.macho.valor != null && !isNaN(dayObj.ronquera.macho.valor)) {
                    ronM = parseFloat(dayObj.ronquera.macho.valor);
                }
                if (dayObj.ronquera.hembra && dayObj.ronquera.hembra.valor != null && !isNaN(dayObj.ronquera.hembra.valor)) {
                    ronH = parseFloat(dayObj.ronquera.hembra.valor);
                }
            }
            dataEstornudoM.push(estM);
            dataEstornudoH.push(estH);
            dataRonqueraM.push(ronM);
            dataRonqueraH.push(ronH);

            // Procesar métricas digestivas (A, P, S, R)
            let valA = null, valP = null, valS = null, valR = null;
            if (dayObj.A && dayObj.A.valor != null && !isNaN(dayObj.A.valor)) valA = parseFloat(dayObj.A.valor);
            if (dayObj.P && dayObj.P.valor != null && !isNaN(dayObj.P.valor)) valP = parseFloat(dayObj.P.valor);
            if (dayObj.S && dayObj.S.valor != null && !isNaN(dayObj.S.valor)) valS = parseFloat(dayObj.S.valor);
            if (dayObj.R && dayObj.R.valor != null && !isNaN(dayObj.R.valor)) valR = parseFloat(dayObj.R.valor);

            dataDigestivoA.push(valA);
            dataDigestivoP.push(valP);
            dataDigestivoS.push(valS);
            dataDigestivoR.push(valR);

            metricasMedicacion.forEach(mName => {
                let v = null;
                if (dayObj[mName]) {
                    if (typeof dayObj[mName] === 'object' && dayObj[mName].valor !== undefined) {
                        v = (dayObj[mName].valor !== null && !isNaN(dayObj[mName].valor)) ? parseFloat(dayObj[mName].valor) : null;
                    } else if (!isNaN(dayObj[mName])) {
                        v = parseFloat(dayObj[mName]);
                    }
                }
                dataMedicacion[mName].push(v);
            });

            let larM = null, larH = null, aduM = null, aduH = null;
            if (dayObj.larva) {
                if (dayObj.larva.macho && dayObj.larva.macho.valor != null && !isNaN(dayObj.larva.macho.valor)) {
                    larM = parseFloat(dayObj.larva.macho.valor);
                }
                if (dayObj.larva.hembra && dayObj.larva.hembra.valor != null && !isNaN(dayObj.larva.hembra.valor)) {
                    larH = parseFloat(dayObj.larva.hembra.valor);
                }
            }
            if (dayObj.adulto) {
                if (dayObj.adulto.macho && dayObj.adulto.macho.valor != null && !isNaN(dayObj.adulto.macho.valor)) {
                    aduM = parseFloat(dayObj.adulto.macho.valor);
                }
                if (dayObj.adulto.hembra && dayObj.adulto.hembra.valor != null && !isNaN(dayObj.adulto.hembra.valor)) {
                    aduH = parseFloat(dayObj.adulto.hembra.valor);
                }
            }
            dataLarvaM.push(larM);
            dataLarvaH.push(larH);
            dataAdultoM.push(aduM);
            dataAdultoH.push(aduH);

            let vVivos = null, vMuertos = null, vPer = null, vTec = null, vConsTot = null;
            if (dayObj.vivos && dayObj.vivos.valor != null && !isNaN(dayObj.vivos.valor)) vVivos = parseFloat(dayObj.vivos.valor);
            if (dayObj.muertos && dayObj.muertos.valor != null && !isNaN(dayObj.muertos.valor)) vMuertos = parseFloat(dayObj.muertos.valor);
            if (dayObj.perimetro && dayObj.perimetro.valor != null && !isNaN(dayObj.perimetro.valor)) vPer = parseFloat(dayObj.perimetro.valor);
            if (dayObj.techo && dayObj.techo.valor != null && !isNaN(dayObj.techo.valor)) vTec = parseFloat(dayObj.techo.valor);
            if (dayObj.consumoTodos && dayObj.consumoTodos.valor != null && !isNaN(dayObj.consumoTodos.valor)) {
                vConsTot = parseFloat(dayObj.consumoTodos.valor);
            } else if (vPer !== null || vTec !== null) {
                if (vPer !== null && vTec !== null) {
                    vConsTot = parseFloat(((vPer + vTec) / 2).toFixed(1));
                } else {
                    vConsTot = vPer !== null ? vPer : vTec;
                }
            }
            dataVivos.push(vVivos);
            dataMuertos.push(vMuertos);
            dataPerimetro.push(vPer);
            dataTecho.push(vTec);
            dataConsumoTodos.push(vConsTot);

            // Procesar lecturas por horas si existen
            if (Array.isArray(dayObj.lecturas) && dayObj.lecturas.length > 0) {
                const lecturasValidas = [];
                horasAplicacion.forEach(h => {
                    const lObj = dayObj.lecturas.find(l => l.hora === h || l.label === h);
                    if (lObj && lObj.valor != null && !isNaN(lObj.valor)) {
                        const v = parseFloat(lObj.valor);
                        dataHoras[h].push(v);
                        lecturasValidas.push(v);
                    } else {
                        dataHoras[h].push(null);
                    }
                });

                if (valM === null && lecturasValidas.length > 0) {
                    const suma = lecturasValidas.reduce((a, b) => a + b, 0);
                    valM = parseFloat((suma / lecturasValidas.length).toFixed(3));
                }
            } else {
                horasAplicacion.forEach(h => {
                    dataHoras[h].push(null);
                });
            }

            let std = stdDesdeDayObj(dayObj);
            const stdM = stdDesdeDayObjSexo(dayObj, 'macho');
            const stdH = stdDesdeDayObjSexo(dayObj, 'hembra');

            if (!tieneCatalogoStd && std !== null && !isNaN(std)) {
                lastKnownStd = std;
            }

            dataMacho.push(valM !== null && !isNaN(valM) ? valM : (estM !== null ? estM : (larM !== null ? larM : vVivos)));
            dataHembra.push(valH !== null && !isNaN(valH) ? valH : (estH !== null ? estH : (larH !== null ? larH : vVivos)));
            dataCumpleMacho.push(cumpleM);
            dataCumpleHembra.push(cumpleH);
            dataStd.push(resolverStdPaso(step, std));
            dataStdM.push(resolverStdPasoSexo(step, stdM, 'macho', std));
            dataStdH.push(resolverStdPasoSexo(step, stdH, 'hembra', std));
        } else {
            dataMacho.push(null);
            dataHembra.push(null);
            dataEstornudoM.push(null);
            dataEstornudoH.push(null);
            dataRonqueraM.push(null);
            dataRonqueraH.push(null);
            dataDigestivoA.push(null);
            dataDigestivoP.push(null);
            dataDigestivoS.push(null);
            dataDigestivoR.push(null);
            dataLarvaM.push(null);
            dataLarvaH.push(null);
            dataAdultoM.push(null);
            dataAdultoH.push(null);
            dataVivos.push(null);
            dataMuertos.push(null);
            dataPerimetro.push(null);
            dataTecho.push(null);
            dataConsumoTodos.push(null);
            metricasMedicacion.forEach(mName => {
                dataMedicacion[mName].push(null);
            });
            dataCumpleMacho.push(null);
            dataCumpleHembra.push(null);
            const stdVacio = resolverStdPaso(step, null);
            dataStd.push(stdVacio);
            dataStdM.push(resolverStdPasoSexo(step, null, 'macho', stdVacio));
            dataStdH.push(resolverStdPasoSexo(step, null, 'hembra', stdVacio));
            horasAplicacion.forEach(h => {
                dataHoras[h].push(null);
            });
        }
    }

    return {
        dataEstandarCatalog: dataEstandarArr.length > 0 ? dataEstandarArr : null,
        labels,
        dataMacho,
        dataHembra,
        dataEstornudoM,
        dataEstornudoH,
        dataRonqueraM,
        dataRonqueraH,
        dataDigestivoA,
        dataDigestivoP,
        dataDigestivoS,
        dataDigestivoR,
        dataLarvaM,
        dataLarvaH,
        dataAdultoM,
        dataAdultoH,
        dataVivos,
        dataMuertos,
        dataPerimetro,
        dataTecho,
        dataConsumoTodos,
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
        dataStdM,
        dataStdH,
        dataFechas,
        fechaInicio: fechaInicioStr,
        horasAplicacion,
        dataHoras,
        metricasMedicacion,
        dataMedicacion,
        esSemanal
    };
}

function adaptarRespuestaApi(apiItem, index = 1, metadata = {}) {
    const {
        labels,
        dataMacho,
        dataHembra,
        dataEstornudoM,
        dataEstornudoH,
        dataRonqueraM,
        dataRonqueraH,
        dataDigestivoA,
        dataDigestivoP,
        dataDigestivoS,
        dataDigestivoR,
        dataLarvaM,
        dataLarvaH,
        dataAdultoM,
        dataAdultoH,
        dataVivos,
        dataMuertos,
        dataPerimetro,
        dataTecho,
        dataConsumoTodos,
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
        dataStdM,
        dataStdH,
        dataFechas,
        horasAplicacion,
        dataHoras,
        metricasMedicacion,
        dataMedicacion,
        esSemanal,
        dataEstandarCatalog
    } = pad47DiasLineData(apiItem);

    const rawGranja = metadata.granja || apiItem.granja || '';
    let granjaNombre = rawGranja;

    if (typeof cacheGranjasData !== 'undefined' && cacheGranjasData && cacheGranjasData.length > 0) {
        const foundG = cacheGranjasData.find(g => (g.granja || g.codigo || g.nombre) === rawGranja);
        if (foundG) {
            const cod = foundG.granja || foundG.codigo || '';
            const nom = foundG.nombre || '';
            if (cod && nom && !cod.includes(nom) && !nom.includes(cod)) {
                granjaNombre = `${cod} ${nom}`;
            } else if (nom) {
                granjaNombre = nom;
            } else {
                granjaNombre = cod;
            }
        }
    }

    const campania = metadata.campania || apiItem.campania || '';
    const galpon = metadata.galpon || apiItem.galpon || '';
    const tipo = metadata.tipo || apiItem.tipo || 'mortalidad';
    const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipo]) ? TIPO_GRAFICO_MAP[tipo] : { label: tipo, unidad: '%' };
    const titulo = apiItem.nombre ? `Gráfica: ${apiItem.nombre}` : `Gráfica: ${cfg.label}`;
    const infoBadge = `${granjaNombre} · Camp ${campania} · Galpón ${galpon}`;
    const soloSemanal = Boolean(tipo === 'ganancia_peso');
    const franjasApi = (apiItem.franjas && typeof apiItem.franjas === 'object' && Object.keys(apiItem.franjas).length > 0)
        ? apiItem.franjas
        : null;
    const modoEval = franjasApi
        ? 'franjas'
        : (apiItem.modoEvaluacion || (tipo === 'consumo_alimento' || tipo === 'ganancia_peso' || tipo === 'pesaje_pollo' ? 'solo_min' : 'solo_max'));

    return {
        idCard: `card-grafico-${index}`,
        canvasId: `chart-${index}`,
        orden: metadata.orden !== undefined ? metadata.orden : (index - 1),
        ordenTipo: metadata.ordenTipo !== undefined ? metadata.ordenTipo : 0,
        granja: rawGranja,
        campania,
        galpon,
        tipo,
        chartType: (typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(tipo) ? 'bar' : (apiItem.chartType || 'line')),
        barMode: (tipo === 'digestivo' || tipo === 'medicacion' ? 'stacked' : (typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(tipo) ? 'grouped' : (apiItem.barMode || undefined))),
        modoEvaluacion: modoEval,
        titulo,
        infoBadge,
        unidad: (tipo === 'gorgojos' || tipo === 'roedores')
            ? (typeof unidadPlagasItem === 'function' ? unidadPlagasItem(tipo, 'avistamiento') : (apiItem.unidad || cfg.unidad || 'n'))
            : (apiItem.unidad || cfg.unidad || (tipo === 'medicacion' ? 'unidades' : '')),
        vistaActiva: soloSemanal ? 'semanal' : 'diario',
        soloSemanal: soloSemanal,
        esSemanal: soloSemanal,
        desdeVal: 'inicio',
        hastaVal: 'fin',
        sexoActiva: (document.getElementById('select-sexo-global')?.value) || (typeof sexoGlobal !== 'undefined' ? sexoGlobal : 'ambos'),
        signoActivo: 'todos',
        ambitoActivo: 'avistamiento',
        plagaMedicion: 'todos',
        horaActiva: 'todas',
        horasAplicacion: horasAplicacion || [],
        dataHoras: dataHoras || {},
        metricasMedicacion: metricasMedicacion || [],
        dataMedicacion: dataMedicacion || {},
        graficoActivo: 'linea',
        labels,
        dataMacho,
        dataHembra,
        dataEstornudoM,
        dataEstornudoH,
        dataRonqueraM,
        dataRonqueraH,
        dataDigestivoA,
        dataDigestivoP,
        dataDigestivoS,
        dataDigestivoR,
        dataLarvaM,
        dataLarvaH,
        dataAdultoM,
        dataAdultoH,
        dataVivos,
        dataMuertos,
        dataPerimetro,
        dataTecho,
        dataConsumoTodos,
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
        dataStdM,
        dataStdH,
        dataFechas,
        franjas: franjasApi,
        hecesEstandares: (apiItem.heces_estandares && typeof apiItem.heces_estandares === 'object') ? apiItem.heces_estandares : null,
        rawCausas: apiItem.causas || null,
        rawPareto: apiItem.pareto || null,
        proyActiva: false,
        dataProyeccion: null,
        dataEstandarProy: null,
        dataEstandarCatalog: dataEstandarCatalog || null,
        campaniaAbierta: true,
        mostrarPctVar: undefined
    };
}

function crearItemSinDatos(metadata = {}) {
    const rawGranja = metadata.granja || '';
    let granjaNombre = rawGranja;

    if (typeof cacheGranjasData !== 'undefined' && cacheGranjasData && cacheGranjasData.length > 0) {
        const foundG = cacheGranjasData.find(g => (g.granja || g.codigo || g.nombre) === rawGranja);
        if (foundG) {
            const cod = foundG.granja || foundG.codigo || '';
            const nom = foundG.nombre || '';
            if (cod && nom && !cod.includes(nom) && !nom.includes(cod)) {
                granjaNombre = `${cod} ${nom}`;
            } else if (nom) {
                granjaNombre = nom;
            } else {
                granjaNombre = cod;
            }
        }
    }

    const campania = metadata.campania || '';
    const galpon = metadata.galpon || '';
    const tipo = metadata.tipo || 'mortalidad';
    const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipo]) ? TIPO_GRAFICO_MAP[tipo] : { label: tipo, unidad: '%' };
    const infoBadge = `${granjaNombre} · Camp ${campania} · Galpón ${galpon}`;
    const idx = metadata.orden !== undefined ? metadata.orden + 1 : Math.floor(Math.random() * 10000);

    return {
        idCard: `card-grafico-${idx}`,
        canvasId: `chart-${idx}`,
        orden: metadata.orden !== undefined ? metadata.orden : 9999,
        ordenTipo: metadata.ordenTipo !== undefined ? metadata.ordenTipo : 0,
        granja: rawGranja,
        campania,
        galpon,
        tipo,
        infoBadge,
        titulo: `Gráfica: ${cfg.label}`,
        sinDatos: true,
        mensajeSinDatos: `Sin evaluaciones registradas para esta campaña`
    };
}
