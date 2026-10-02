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

    const metricasMedicacion = Array.isArray(linea.metricas) ? linea.metricas : (Array.isArray(linea.medicinas) ? linea.medicinas.map(m => (m.nombre || m)) : []);
    const dataMedicacion = {};
    metricasMedicacion.forEach(mName => {
        dataMedicacion[mName] = [];
    });

    horasAplicacion.forEach(h => {
        dataHoras[h] = [];
    });

    let lastKnownStd = (linea.stdMax !== undefined && linea.stdMax !== null) ? parseFloat(linea.stdMax) : (tipoItem === 'digestivo' ? 1.0 : null);

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

            // Procesar medicaciones si existen
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

            let std = null;
            if (dayObj.stdMax !== undefined && dayObj.stdMax != null) {
                std = parseFloat(dayObj.stdMax);
            } else if (dayObj.stdMin !== undefined && dayObj.stdMin != null) {
                std = parseFloat(dayObj.stdMin);
            } else if (dayObj.estandar && (dayObj.estandar.max != null || dayObj.estandar.min != null)) {
                std = parseFloat(dayObj.estandar.max ?? dayObj.estandar.min);
            }

            if (std !== null && !isNaN(std)) {
                lastKnownStd = std;
            }

            dataMacho.push(valM !== null && !isNaN(valM) ? valM : (estM !== null ? estM : null));
            dataHembra.push(valH !== null && !isNaN(valH) ? valH : (estH !== null ? estH : null));
            dataCumpleMacho.push(cumpleM);
            dataCumpleHembra.push(cumpleH);
            dataStd.push(std !== null && !isNaN(std) ? std : lastKnownStd);
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
            metricasMedicacion.forEach(mName => {
                dataMedicacion[mName].push(null);
            });
            dataCumpleMacho.push(null);
            dataCumpleHembra.push(null);
            dataStd.push(lastKnownStd);
            horasAplicacion.forEach(h => {
                dataHoras[h].push(null);
            });
        }
    }

    return {
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
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
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
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
        dataFechas,
        horasAplicacion,
        dataHoras,
        metricasMedicacion,
        dataMedicacion,
        esSemanal
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
    const soloDiario = false;
    const modoEval = apiItem.modoEvaluacion || (tipo === 'consumo_alimento' || tipo === 'ganancia_peso' || tipo === 'pesaje_pollo' ? 'solo_min' : 'solo_max');

    return {
        idCard: `card-grafico-${index}`,
        canvasId: `chart-${index}`,
        orden: metadata.orden !== undefined ? metadata.orden : (index - 1),
        ordenTipo: metadata.ordenTipo !== undefined ? metadata.ordenTipo : 0,
        granja: rawGranja,
        campania,
        galpon,
        tipo,
        chartType: (tipo === 'respiratorio' || tipo === 'digestivo' || tipo === 'nivel_cloro' || tipo === 'medicacion' ? 'bar' : (apiItem.chartType || 'line')),
        barMode: (tipo === 'digestivo' || tipo === 'medicacion' ? 'stacked' : (tipo === 'respiratorio' || tipo === 'nivel_cloro' ? 'grouped' : (apiItem.barMode || undefined))),
        modoEvaluacion: modoEval,
        titulo,
        infoBadge,
        unidad: apiItem.unidad || cfg.unidad || (tipo === 'medicacion' ? 'unidades' : ''),
        vistaActiva: soloSemanal ? 'semanal' : 'diario',
        soloSemanal: soloSemanal,
        soloDiario: soloDiario,
        esSemanal: soloSemanal,
        desdeVal: 'inicio',
        hastaVal: 'fin',
        sexoActiva: (document.getElementById('select-sexo-global')?.value) || (typeof sexoGlobal !== 'undefined' ? sexoGlobal : 'ambos'),
        signoActivo: 'todos',
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
        dataCumpleMacho,
        dataCumpleHembra,
        dataStd,
        dataFechas,
        rawCausas: apiItem.causas || null,
        rawPareto: apiItem.pareto || null
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
