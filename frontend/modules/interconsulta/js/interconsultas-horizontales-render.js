/**
 * Módulo de Renderizado para Gráficos Horizontales (Acumulado Semanal)
 * Dashboard de Interconsultas
 */

(function (window) {
    'use strict';

    const instanciasGraficosHz = {};
    const cacheGraficosHz = {};
    const cacheDataPorTipoHz = {};

    const NIVELES_ESCALA_TEXTO = [0.80, 0.90, 1.00, 1.15, 1.30, 1.45];
    let indiceEscalaTexto = 3;

    const PALETA_MEDICACIONES_HZ = [
        { bg: '#f87171', border: '#ef4444' },
        { bg: '#60a5fa', border: '#3b82f6' },
        { bg: '#4ade80', border: '#22c55e' },
        { bg: '#c084fc', border: '#a855f7' },
        { bg: '#fb923c', border: '#f97316' },
        { bg: '#2dd4bf', border: '#14b8a6' },
        { bg: '#fbbf24', border: '#f59e0b' },
        { bg: '#f472b6', border: '#ec4899' }
    ];

    function getEscalaTextoActual() {
        return NIVELES_ESCALA_TEXTO[indiceEscalaTexto] || 1.00;
    }

    function getTamanoFuente(base) {
        return Math.round(base * getEscalaTextoActual() * 10) / 10;
    }

    function getColWidthPorLote() {
        const escala = getEscalaTextoActual();
        return Math.round(26 * Math.max(1, escala * 1.05));
    }

    /**
     * Retorna la cantidad de decimales según el tipo de gráfico:
     * 3 decimales para consumo_alimento, pesaje_pollo y ganancia_peso; 2 decimales para el resto.
     */
    function normalizarGranjaCodigoHz(val) {
        const s = String(val || '').trim();
        if (!s) return '';
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 3) return digits.slice(-3);
        if (digits.length > 0) return digits.padStart(3, '0');
        return s;
    }

    function granjaCoincideFiltroHz(selGranja, registro) {
        const sel = String(selGranja || '').trim();
        if (!sel) return false;
        const rg = String(registro.granja || '').trim();
        const rn = String(registro.granjaNombre || '').trim();
        if (sel === rg || sel === rn) return true;
        const sn = normalizarGranjaCodigoHz(sel);
        return sn !== '' && (sn === normalizarGranjaCodigoHz(rg) || sn === normalizarGranjaCodigoHz(rn));
    }

    function campaniaCoincideFiltroHz(selCampania, registro) {
        const s = String(selCampania || '');
        const cStr = String(registro.campania || '');
        if (s.includes('__')) {
            const parts = s.split('__');
            const gMatch = granjaCoincideFiltroHz(parts[0], registro);
            return gMatch && parts[1] === cStr;
        }
        return s === cStr;
    }

    function galponCoincideFiltroHz(selGalpon, registro) {
        const s = String(selGalpon || '');
        const gpStr = String(registro.galpon || '');
        if (s.includes('__')) {
            const parts = s.split('__');
            const gMatch = granjaCoincideFiltroHz(parts[0], registro);
            return gMatch && parts[1] === gpStr;
        }
        return s === gpStr;
    }

    function getDecimalesPorTipo(tipo) {
        if (tipo === 'consumo_alimento' || tipo === 'pesaje_pollo' || tipo === 'ganancia_peso') {
            return 3;
        }
        if (tipo === 'gorgojos' || tipo === 'roedores' || tipo === 'medicacion') {
            return 1;
        }
        return 2;
    }

    function esTipoBarrasHz(tipo) {
        return tipo === 'gorgojos' || tipo === 'roedores' || tipo === 'medicacion';
    }

    function soportaVarPctHz(tipo) {
        var SGS = window.SipGraficaShared;
        return !!(SGS && SGS.soportaVarPct(tipo, { graficoActivo: 'linea' }) && !esTipoBarrasHz(tipo));
    }

    function hzMostrarPctParaTipo(tipo, opcionesFiltro) {
        if (!soportaVarPctHz(tipo)) {
            return false;
        }
        if (opcionesFiltro && opcionesFiltro.mostrarPctChart === false) {
            return false;
        }
        if (opcionesFiltro && opcionesFiltro.mostrarPctChart === true) {
            return true;
        }
        return true;
    }

    function htmlCheckboxPctHz(tipo, tipoKey, opcionesFiltro) {
        if (!soportaVarPctHz(tipo)) {
            return '';
        }
        var checked = hzMostrarPctParaTipo(tipo, opcionesFiltro);
        return '<label class="flex items-center gap-1.5 cursor-pointer select-none text-xs font-semibold text-slate-600 ml-1">'
            + '<input type="checkbox" class="chk-mostrar-pct-hz-card w-3.5 h-3.5 rounded text-blue-600" data-hz-tipo="'
            + tipoKey + '" ' + (checked ? 'checked' : '') + '>'
            + '<span>Grafico %</span></label>';
    }

    function bindPctCheckboxHz(card, tipoKey) {
        if (!card) {
            return;
        }
        var chk = card.querySelector('.chk-mostrar-pct-hz-card');
        if (!chk || chk._boundPctHz) {
            return;
        }
        chk._boundPctHz = true;
        chk.addEventListener('change', function () {
            var cached = cacheDataPorTipoHz[tipoKey];
            if (!cached || !cached.data) {
                return;
            }
            cached.opcionesFiltro = cached.opcionesFiltro || {};
            cached.opcionesFiltro.mostrarPctChart = chk.checked;
            renderizarGraficoHorizontal(cached.data, cached.opcionesFiltro);
        });
    }

    function htmlSlotPctHz(canvasId, tipo, opcionesFiltro) {
        var hidden = !hzMostrarPctParaTipo(tipo, opcionesFiltro);
        return `<div class="chart-pct-slot-hz${hidden ? ' hidden' : ''}" style="height:170px; position:relative; flex-shrink:0;"><canvas id="${canvasId}-pct" style="width:100%; height:100%; display:block;"></canvas></div><div style="flex:1; min-height:0; position:relative;">`;
    }

    function tipoIncluyeCvEnGrafico(tipo) {
        return tipo !== 'pesaje_pollo' && tipo !== 'ganancia_peso';
    }

    function evalCumpleHz(tipo, actual, std) {
        var SGS = window.SipGraficaShared;
        var modo = (tipo === 'consumo_alimento' || tipo === 'ganancia_peso' || tipo === 'pesaje_pollo') ? 'solo_min' : 'solo_max';
        return SGS ? SGS.evalCumpleModo(actual, std, modo) : null;
    }

    function destruirChartHzPct(canvasIdPct) {
        if (instanciasGraficosHz[canvasIdPct]) {
            try { instanciasGraficosHz[canvasIdPct].destroy(); } catch (e) { /* ignore */ }
            delete instanciasGraficosHz[canvasIdPct];
        }
        var SGS = window.SipGraficaShared;
        if (SGS) SGS.destroyPctChart(canvasIdPct);
    }

    function crearDatasetsVarPctHz(sexo, tipo, dataM, dataH, dataComb, dataStdM, dataStdH, dataStdComb, tieneStdM, tieneStdH) {
        var SGS = window.SipGraficaShared;
        if (!SGS || !soportaVarPctHz(tipo)) return [];
        var seriesList = [];

        if (sexo === 'macho' || sexo === 'ambos') {
            if (Array.isArray(dataM) && Array.isArray(dataStdM) && tieneStdM) {
                var builtM = SGS.buildVarPctData(dataM, dataStdM, function (a, s) { return evalCumpleHz(tipo, a, s); });
                seriesList.push({ label: 'M', data: builtM.data, cumple: builtM.cumple, borderColor: '#2563eb' });
            }
        }
        if (sexo === 'hembra' || sexo === 'ambos') {
            if (Array.isArray(dataH) && Array.isArray(dataStdH) && tieneStdH) {
                var builtH = SGS.buildVarPctData(dataH, dataStdH, function (a, s) { return evalCumpleHz(tipo, a, s); });
                seriesList.push({ label: 'H', data: builtH.data, cumple: builtH.cumple, borderColor: '#ec4899' });
            }
        }
        if (sexo === 'combinado') {
            if (Array.isArray(dataComb) && Array.isArray(dataStdComb)) {
                var builtC = SGS.buildVarPctData(dataComb, dataStdComb, function (a, s) { return evalCumpleHz(tipo, a, s); });
                seriesList.push({ label: 'Comb.', data: builtC.data, cumple: builtC.cumple, borderColor: '#2563eb' });
            }
        }

        return SGS.buildVarPctDatasets(seriesList, { tipo: tipo });
    }

    function crearInstanciaChartHzPct(canvasIdPct, labels, datasets, mainChart, btnResetZoomId, tipoHz, opcionesFiltro) {
        var SGS = window.SipGraficaShared;
        var mostrarPctCard = hzMostrarPctParaTipo(tipoHz, opcionesFiltro);
        if (!mostrarPctCard || !SGS || !datasets || !datasets.length) {
            destruirChartHzPct(canvasIdPct);
            return null;
        }
        destruirChartHzPct(canvasIdPct);
        var pctChart = SGS.createPctChart(canvasIdPct, labels, datasets, { hideXTicks: true });
        if (!pctChart) return null;
        instanciasGraficosHz[canvasIdPct] = pctChart;
        if (mainChart) SGS.finalizePctChartPair(mainChart, pctChart);
        var btnResetZoom = btnResetZoomId ? document.getElementById(btnResetZoomId) : null;
        if (btnResetZoom && !btnResetZoom._pctSyncBound) {
            btnResetZoom._pctSyncBound = true;
            btnResetZoom.addEventListener('click', function () {
                var pctId = canvasIdPct;
                var pctInst = instanciasGraficosHz[pctId];
                if (SGS && typeof SGS.resetChartsZoomX === 'function') {
                    SGS.resetChartsZoomX(mainChart, pctInst);
                }
            });
        }
        return pctChart;
    }

    function tipoIgnoraSexoEnHz(tipo) {
        return tipo === 'roedores' || tipo === 'medicacion';
    }

    function aplicarEstiloBarrasHz(datasets, tipo) {
        if (!esTipoBarrasHz(tipo) || !Array.isArray(datasets)) {
            return datasets;
        }
        const barras = datasets.filter(function (ds) {
            const lbl = String(ds.label || '');
            return ds.yAxisID !== 'yCv' && lbl.indexOf('Estándar') === -1 && lbl.indexOf('CV ') !== 0;
        });
        const stackedRoed = (tipo === 'medicacion' && barras.length > 1)
            || (tipo === 'roedores' && barras.filter(function (ds) { return ds.stack; }).length > 1);
        datasets.forEach(function (ds, idx) {
            const lbl = String(ds.label || '');
            if (ds.yAxisID === 'yCv' || lbl.indexOf('Estándar') !== -1 || lbl.indexOf('CV ') === 0) {
                ds.type = 'line';
                return;
            }
            ds.type = 'bar';
            ds.backgroundColor = ds.borderColor;
            ds.borderWidth = 1.5;
            ds.tension = 0;
            ds.fill = false;
            ds.barPercentage = stackedRoed ? 0.82 : 0.85;
            ds.categoryPercentage = stackedRoed ? 0.85 : 0.78;
            ds.minBarLength = 10;
            ds.borderRadius = stackedRoed
                ? (idx === datasets.length - 1 ? { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 } : 0)
                : 3;
            ds.skipNull = false;
            if (!ds.datalabels) ds.datalabels = {};
            ds.datalabels.anchor = 'end';
            ds.datalabels.align = 'end';
            ds.datalabels.offset = 22;
            ds.datalabels.rotation = -90;
            ds.datalabels.clip = false;
            ds.datalabels.display = function (ctx) {
                const v = ctx.dataset.data[ctx.dataIndex];
                return v !== null && v !== undefined && !isNaN(v) && Number(v) !== 0;
            };
        });
        return datasets;
    }

    function numHz(v) {
        return (v !== null && v !== undefined && v !== '' && !isNaN(v)) ? Number(v) : null;
    }

    function consumoTodosHz(raw, perimetro, techo) {
        var v = numHz(raw);
        if (v !== null) {
            return v;
        }
        var p = numHz(perimetro);
        var t = numHz(techo);
        if (p !== null && t !== null) {
            return Number((p + t).toFixed(1));
        }
        if (p !== null) {
            return p;
        }
        if (t !== null) {
            return t;
        }
        return null;
    }

    function syncDockLeyendaHz() {      
        var seen = {};
        var items = [];
        Object.keys(cacheGraficosHz).forEach(function (canvasId) {
            var entry = cacheGraficosHz[canvasId];
            if (!entry || !entry.chartInstance || !entry.chartInstance.data) {
                return;
            }
            (entry.chartInstance.data.datasets || []).forEach(function (ds) {
                var lbl = String(ds.label || '').trim();
                if (!lbl || lbl.indexOf('CV ') === 0 || ds.yAxisID === 'yCv') {
                    return;
                }
                var color = ds.borderColor || ds.backgroundColor || '#64748b';
                var key = lbl + '|' + color;
                if (seen[key]) {
                    return;
                }
                seen[key] = true;
                items.push({ label: lbl, color: color });
            });
        });
        /*if (!items.length) {
            dock.innerHTML = '';
            dock.classList.add('hidden');
            dock.setAttribute('aria-hidden', 'true');
            return;
        }*/
        /*dock.innerHTML = items.map(function (it) {
            return '<span class="hz-legend-dock-item"><span class="hz-legend-dock-swatch" style="background:' + it.color + '"></span>' + it.label + '</span>';
        }).join('');
        dock.classList.remove('hidden');
        dock.setAttribute('aria-hidden', 'false');*/
    }

    function promedioSeriesHz(a, b) {
        const n = Math.max(a.length, b.length);
        const out = [];
        let i;
        for (i = 0; i < n; i++) {
            const vM = i < a.length ? a[i] : null;
            const vH = i < b.length ? b[i] : null;
            if (vM !== null && vH !== null) out.push(Number(((vM + vH) / 2).toFixed(4)));
            else if (vM !== null) out.push(vM);
            else if (vH !== null) out.push(vH);
            else out.push(null);
        }
        return out;
    }

    function opcionesMedicionPlagasHz(tipo, ambito) {
        if (tipo === 'gorgojos') {
            return [
                { v: 'todos', t: 'Todos' },
                { v: 'larvas', t: 'Larvas' },
                { v: 'adultos', t: 'Adultos' }
            ];
        }
        if (tipo === 'roedores') {
            if (ambito === 'consumo') {
                return [
                    { v: 'todos', t: 'Todos' },
                    { v: 'perimetro', t: 'Perímetro' },
                    { v: 'techo', t: 'Techo' }
                ];
            }
            return [
                { v: 'todos', t: 'Todos' },
                { v: 'vivos', t: 'Vivos' },
                { v: 'muertos', t: 'Muertos' }
            ];
        }
        return null;
    }

    function htmlSelectAmbitoPlagasHz(tipo, ambito) {
        if (tipo !== 'roedores') return '';
        const amb = ambito || 'avistamiento';
        return `<div class="flex items-center gap-1.5">
            <span class="text-[11px] font-semibold text-slate-500">Ámbito:</span>
            <select class="select-plaga-ambito-hz bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                <option value="avistamiento"${amb === 'avistamiento' ? ' selected' : ''}>Avistamiento</option>
                <option value="consumo"${amb === 'consumo' ? ' selected' : ''}>Consumo</option>
            </select>
        </div>`;
    }

    function htmlSelectMedicionPlagasHz(tipo, medicion, ambito) {
        const opts = opcionesMedicionPlagasHz(tipo, ambito || 'avistamiento');
        if (!opts) return '';
        const med = medicion || 'todos';
        const optionsHtml = opts.map(function (o) {
            return `<option value="${o.v}"${med === o.v ? ' selected' : ''}>${o.t}</option>`;
        }).join('');
        return `<div class="flex items-center gap-1.5">
            <span class="text-[11px] font-semibold text-slate-500">Medición:</span>
            <select class="select-plaga-medicion-hz bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-medium rounded-md px-1.5 py-0.5 shadow-2xs focus:outline-none cursor-pointer">
                ${optionsHtml}
            </select>
        </div>`;
    }

    function htmlFiltrosPlagasHz(tipo, medicion, ambito) {
        if (tipo !== 'gorgojos' && tipo !== 'roedores') return '';
        return htmlSelectAmbitoPlagasHz(tipo, ambito) + htmlSelectMedicionPlagasHz(tipo, medicion, ambito);
    }

    function bindSelectMedicionHz(card, tipoKey) {
        if (!card) return;
        const sel = card.querySelector('.select-plaga-medicion-hz');
        if (!sel) return;
        sel.addEventListener('change', function () {
            const item = cacheDataPorTipoHz[tipoKey];
            if (!item || !item.data) return;
            item.opcionesFiltro.plagaMedicion = sel.value;
            renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
        });
    }

    function bindSelectAmbitoHz(card, tipoKey) {
        if (!card) return;
        const sel = card.querySelector('.select-plaga-ambito-hz');
        if (!sel) return;
        sel.addEventListener('change', function () {
            const item = cacheDataPorTipoHz[tipoKey];
            if (!item || !item.data) return;
            item.opcionesFiltro.plagaAmbito = sel.value;
            item.opcionesFiltro.plagaMedicion = 'todos';
            renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
        });
    }

    function datasetBarraPlagaHz(label, arr, color, dec, fontSize, yAxisID) {
        return {
            label: label,
            data: arr,
            yAxisID: yAxisID || 'y',
            borderColor: color,
            backgroundColor: color,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0,
            fill: false,
            datalabels: {
                display: true,
                color: color,
                font: {
                    size: fontSize,
                    weight: 'bold',
                    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                formatter: function (value) {
                    return (value !== null && value !== undefined && !isNaN(value)) ? Number(value).toFixed(dec) : '';
                }
            }
        };
    }

    function crearDatasetsPlagasHz(sexo, data, tipo) {
        const series = data._hzPlagaSeries || {};
        const medicion = (data._hzPlagaMedicion || 'todos');
        const fontDatalabelsSize = getTamanoFuente(11.5);
        const dec = getDecimalesPorTipo(tipo);
        const datasets = [];
        const ambos = sexo === 'ambos';

        if (tipo === 'gorgojos') {
            function sumSeriesHz() {
                var arrs = Array.prototype.slice.call(arguments);
                var n = 0;
                var ai;
                for (ai = 0; ai < arrs.length; ai++) {
                    if (arrs[ai] && arrs[ai].length > n) n = arrs[ai].length;
                }
                var out = [];
                var ci;
                for (ci = 0; ci < n; ci++) {
                    var sum = 0;
                    var has = false;
                    for (ai = 0; ai < arrs.length; ai++) {
                        var vv = arrs[ai] ? arrs[ai][ci] : null;
                        if (vv !== null && vv !== undefined && !isNaN(vv)) {
                            sum += Number(vv);
                            has = true;
                        }
                    }
                    out.push(has ? Number(sum.toFixed(2)) : null);
                }
                return out;
            }
            if (medicion === 'todos') {
                var gTot;
                if (sexo === 'macho') {
                    gTot = sumSeriesHz(series.larvaM || [], series.adultoM || []);
                } else if (sexo === 'hembra') {
                    gTot = sumSeriesHz(series.larvaH || [], series.adultoH || []);
                } else if (sexo === 'combinado') {
                    gTot = sumSeriesHz(
                        promedioSeriesHz(series.larvaM || [], series.larvaH || []),
                        promedioSeriesHz(series.adultoM || [], series.adultoH || [])
                    );
                } else {
                    gTot = sumSeriesHz(series.larvaM || [], series.adultoM || [], series.larvaH || [], series.adultoH || []);
                }
                datasets.push(datasetBarraPlagaHz('Total (larvas + adultos)', gTot, '#84cc16', dec, fontDatalabelsSize, 'y'));
            } else if (medicion === 'larvas' || medicion === 'larva') {
                var larArr;
                if (sexo === 'macho') larArr = series.larvaM || [];
                else if (sexo === 'hembra') larArr = series.larvaH || [];
                else if (sexo === 'combinado') larArr = promedioSeriesHz(series.larvaM || [], series.larvaH || []);
                else larArr = sumSeriesHz(series.larvaM || [], series.larvaH || []);
                datasets.push(datasetBarraPlagaHz('Larvas', larArr, '#2563eb', dec, fontDatalabelsSize, 'y'));
            } else if (medicion === 'adultos' || medicion === 'adulto') {
                var aduArr;
                if (sexo === 'macho') aduArr = series.adultoM || [];
                else if (sexo === 'hembra') aduArr = series.adultoH || [];
                else if (sexo === 'combinado') aduArr = promedioSeriesHz(series.adultoM || [], series.adultoH || []);
                else aduArr = sumSeriesHz(series.adultoM || [], series.adultoH || []);
                datasets.push(datasetBarraPlagaHz('Adultos', aduArr, '#d97706', dec, fontDatalabelsSize, 'y'));
            }
        } else {
            const ambito = data._hzPlagaAmbito || 'avistamiento';
            if (ambito === 'consumo') {
                if (medicion === 'todos') {
                    var nCons = Math.max(
                        (series.consumoTodos || []).length,
                        (series.perimetro || []).length,
                        (series.techo || []).length
                    );
                    var totArr = [];
                    var ci;
                    for (ci = 0; ci < nCons; ci++) {
                        totArr.push(consumoTodosHz(
                            (series.consumoTodos || [])[ci],
                            (series.perimetro || [])[ci],
                            (series.techo || [])[ci]
                        ));
                    }
                    datasets.push(datasetBarraPlagaHz('Total (perímetro + techo)', totArr, '#2563eb', dec, fontDatalabelsSize));
                } else if (medicion === 'perimetro') {
                    datasets.push(datasetBarraPlagaHz('Perímetro', series.perimetro || [], '#16a34a', dec, fontDatalabelsSize));
                } else if (medicion === 'techo') {
                    datasets.push(datasetBarraPlagaHz('Techo', series.techo || [], '#0ea5e9', dec, fontDatalabelsSize));
                }
            } else {
                if (medicion === 'todos') {
                    var nRod = Math.max((series.vivos || []).length, (series.muertos || []).length);
                    var totRod = [];
                    var ri;
                    for (ri = 0; ri < nRod; ri++) {
                        var sv = numHz((series.vivos || [])[ri]);
                        var sm = numHz((series.muertos || [])[ri]);
                        if (sv !== null && sm !== null) totRod.push(Number((sv + sm).toFixed(2)));
                        else if (sv !== null) totRod.push(sv);
                        else if (sm !== null) totRod.push(sm);
                        else totRod.push(null);
                    }
                    datasets.push(datasetBarraPlagaHz('Total (vivos + muertos)', totRod, '#78716c', dec, fontDatalabelsSize));
                } else if (medicion === 'vivos') {
                    datasets.push(datasetBarraPlagaHz('Vivos', series.vivos || [], '#2563eb', dec, fontDatalabelsSize));
                } else if (medicion === 'muertos') {
                    datasets.push(datasetBarraPlagaHz('Muertos', series.muertos || [], '#dc2626', dec, fontDatalabelsSize));
                }
            }
        }
        return aplicarEstiloBarrasHz(datasets, tipo);
    }

    function crearDatasetsMedicacionHz(data) {
        const series = data._hzMedSeries || {};
        const metricas = data._hzMetricas || [];
        const dec = getDecimalesPorTipo('medicacion');
        const fontDatalabelsSize = getTamanoFuente(11.5);
        const datasets = [];
        metricas.forEach(function (mNombre, idx) {
            const pal = PALETA_MEDICACIONES_HZ[idx % PALETA_MEDICACIONES_HZ.length];
            const ds = datasetBarraPlagaHz(mNombre, series[mNombre] || [], pal.border, dec, fontDatalabelsSize);
            ds.backgroundColor = pal.bg;
            ds.stack = 'medicacionStack';
            datasets.push(ds);
        });
        return aplicarEstiloBarrasHz(datasets, 'medicacion');
    }

    /**
     * Formatea fecha YYYY-MM-DD a formato corto '25-Jun'
     */
    function formatearFechaCorta(fechaStr) {
        if (!fechaStr) return '';
        const parts = String(fechaStr).split('-');
        if (parts.length !== 3) return fechaStr;
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dia = parseInt(parts[2], 10);
        const mesIdx = parseInt(parts[1], 10) - 1;
        const mesNom = meses[mesIdx] || parts[1];
        return `${dia < 10 ? '0' + dia : dia}-${mesNom}`;
    }

    /**
     * Muestra la pastilla flotante animada con el progreso de carga para gráficos horizontales
     */
    function actualizarIndicadorProgresoHz(completadas, total) {
        let barra = document.getElementById('ic-progreso-carga-graficos-hz');
        if (!barra) {
            barra = document.createElement('div');
            barra.id = 'ic-progreso-carga-graficos-hz';
            barra.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/80 backdrop-blur-xs transition-all duration-300 pointer-events-none opacity-0 translate-y-4';
            document.body.appendChild(barra);
        }

        const btnCargarHz = document.getElementById('btn-cargar-hz');

        if (completadas < total && total > 0) {
            const pct = Math.round((completadas / total) * 100);
            barra.innerHTML = `
                <svg class="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando gráficas horizontales (${completadas}/${total})</span>
                <div class="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden ml-0.5">
                    <div class="bg-blue-500 h-full transition-all duration-200" style="width: ${pct}%"></div>
                </div>
            `;
            barra.classList.remove('opacity-0', 'translate-y-4');
            if (btnCargarHz) {
                btnCargarHz.classList.add('opacity-80');
                const icon = btnCargarHz.querySelector('.icon-cargar');
                if (icon) icon.classList.add('animate-spin');
            }
        } else {
            barra.innerHTML = `
                <svg class="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-sky-300">Todas las gráficas horizontales cargadas</span>
            `;
            if (btnCargarHz) {
                btnCargarHz.classList.remove('opacity-80');
                const icon = btnCargarHz.querySelector('.icon-cargar');
                if (icon) icon.classList.remove('animate-spin');
            }
            setTimeout(() => {
                barra.classList.add('opacity-0', 'translate-y-4');
            }, 1200);
        }
    }

    /**
     * Limpia y destruye todas las instancias de gráficos horizontales
     */
    function limpiarGraficosHorizontales() {
        Object.keys(instanciasGraficosHz).forEach(key => {
            if (instanciasGraficosHz[key]) {
                try {
                    instanciasGraficosHz[key].destroy();
                } catch (e) {
                    console.warn('Error al destruir gráfico horizontal:', e);
                }
                delete instanciasGraficosHz[key];
            }
        });

        Object.keys(cacheGraficosHz).forEach(key => {
            delete cacheGraficosHz[key];
        });

        Object.keys(cacheDataPorTipoHz).forEach(key => {
            delete cacheDataPorTipoHz[key];
        });

        const contenedor = document.getElementById('contenedor-graficos-horizontales');
        if (contenedor) {
            contenedor.innerHTML = '';
        }
        syncDockLeyendaHz();
    }

    function numOrNullLumHz(v) {
        return (v !== null && v !== undefined && v !== '' && !isNaN(v)) ? Number(v) : null;
    }

    function lumLimitDsHz(label, val, color, dash) {
        return {
            label: label,
            data: [],
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: dash || [],
            pointRadius: 0,
            tension: 0,
            spanGaps: true,
            fill: false,
            type: 'line',
            yAxisID: 'y',
            _lumLimit: val
        };
    }

    function filtrarRegistrosLumHz(registros, opcionesFiltro, modo) {
        if (modo !== 'granja' || !Array.isArray(registros)) {
            return registros || [];
        }
        let filtrados = registros.slice();
        const {
            esUnificado = false,
            granjas = [],
            campanias = [],
            galpones = [],
            unificado = []
        } = opcionesFiltro || {};

        if (esUnificado && Array.isArray(unificado) && unificado.length > 0) {
            filtrados = filtrados.filter(r => unificado.some(u => {
                const matchGranja = u.granja && granjaCoincideFiltroHz(u.granja, r);
                const matchCampania = (!u.campania || String(u.campania) === String(r.campania));
                const matchGalpon = (!u.galpon || String(u.galpon) === String(r.galpon));
                return matchGranja && matchCampania && matchGalpon;
            }));
        } else {
            if (Array.isArray(granjas) && granjas.length > 0) {
                filtrados = filtrados.filter(r => granjas.some(g => granjaCoincideFiltroHz(g, r)));
            }
            if (Array.isArray(campanias) && campanias.length > 0) {
                filtrados = filtrados.filter(r => campanias.some(c => campaniaCoincideFiltroHz(c, r)));
            }
            if (Array.isArray(galpones) && galpones.length > 0) {
                filtrados = filtrados.filter(r => galpones.some(gp => galponCoincideFiltroHz(gp, r)));
            }
        }
        return filtrados;
    }

    function renderizarGraficoHorizontalLuminometria(data, opcionesFiltro) {
        const contenedor = document.getElementById('contenedor-graficos-horizontales');
        if (!contenedor || !data) return;

        const modo = data.modo || 'subzona';
        const tipoKey = `luminometria-${modo}`;
        const cardId = `card-grafico-hz-${tipoKey}`;
        const canvasId = `canvas-hz-${tipoKey}`;
        const canvasWrapperId = `wrapper-canvas-hz-${tipoKey}`;
        const btnResetZoomId = `btn-reset-zoom-hz-${tipoKey}`;

        cacheDataPorTipoHz[tipoKey] = {
            data,
            opcionesFiltro: { ...opcionesFiltro }
        };

        if (instanciasGraficosHz[canvasId]) {
            try { instanciasGraficosHz[canvasId].destroy(); } catch (e) { /* ignore */ }
            delete instanciasGraficosHz[canvasId];
        }
        if (cacheGraficosHz[canvasId]) {
            delete cacheGraficosHz[canvasId];
        }

        let existingCard = document.getElementById(cardId);
        if (existingCard) {
            existingCard.remove();
        }

        const registrosFiltrados = filtrarRegistrosLumHz(data.registros || [], opcionesFiltro, modo);
        const nombreGrafico = data.nombre || 'Luminometría';
        const subtituloHz = (modo === 'granja' ? 'Por granja / campaña / galpón' : 'Por subzona (promedio mensual)')
            + (data.location ? (' · ' + data.location) : ' · Todos los puntos');

        if (registrosFiltrados.length === 0) {
            const emptyCard = document.createElement('div');
            emptyCard.id = cardId;
            emptyCard.className = 'w-full bg-white rounded-2xl p-8 text-center text-slate-500 font-medium border border-slate-200/80 shadow-sm';
            emptyCard.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2">
                    <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-sm font-semibold text-slate-700">Sin datos para ${nombreGrafico}</p>
                    <p class="text-xs text-slate-400">No se encontraron registros con los filtros seleccionados.</p>
                </div>
            `;
            contenedor.appendChild(emptyCard);
            return;
        }

        const labels = registrosFiltrados.map(r => r.label || r.mesLabel || '');
        const valores = registrosFiltrados.map(r => numOrNullLumHz(r.valor));
        const lineasSuaves = Boolean(opcionesFiltro && opcionesFiltro.lineasSuaves);
        const tensionVal = lineasSuaves ? 0.35 : 0.1;
        const minCanvasWidth = Math.max(600, labels.length * (modo === 'granja' ? 72 : 48));
        const limites = data.limites || {};
        const datasets = [{
            label: 'URL (promedio)',
            data: valores,
            borderColor: '#7c3aed',
            backgroundColor: '#7c3aed',
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: tensionVal,
            spanGaps: true,
            fill: false,
            type: 'line',
            yAxisID: 'y',
            datalabels: {
                display: true,
                align: 'top',
                anchor: 'center',
                offset: 5,
                color: '#5b21b6',
                font: {
                    size: getTamanoFuente(11.5),
                    weight: 'bold',
                    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                },
                formatter: function (value) {
                    return (value !== null && value !== undefined && !isNaN(value)) ? Number(value).toFixed(2) : '';
                }
            }
        }];
        if (limites.lsc != null && isFinite(limites.lsc)) datasets.push(lumLimitDsHz('LSC', Number(limites.lsc), '#dc2626', []));
        if (limites.lc != null && isFinite(limites.lc)) datasets.push(lumLimitDsHz('LC', Number(limites.lc), '#ca8a04', []));
        if (limites.lic != null && isFinite(limites.lic)) datasets.push(lumLimitDsHz('LIC', Number(limites.lic), '#16a34a', []));
        datasets.forEach(function (ds) {
            if (ds._lumLimit != null) {
                ds.data = new Array(labels.length).fill(ds._lumLimit);
            }
        });

        const yVals = valores.filter(function (v) { return v != null; });
        [limites.lic, limites.lc, limites.lsc].forEach(function (lv) {
            if (lv != null && isFinite(lv)) yVals.push(Number(lv));
        });
        var SGS = window.SipGraficaShared;
        const yRange = (SGS && typeof SGS.yRangeFromValues === 'function')
            ? SGS.yRangeFromValues(yVals)
            : { min: -50, max: 500 };

        const card = document.createElement('div');
        card.id = cardId;
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';
        card.innerHTML = `
            <div class="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                    <span class="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200/60 flex items-center gap-1.5 shadow-2xs">
                        <svg class="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                        </svg>
                        ${nombreGrafico}
                    </span>
                    <span class="text-xs font-bold text-slate-700">${subtituloHz}</span>
                </div>
                <div class="flex items-center gap-3 text-xs text-slate-400">
                    <span>Período: <strong class="text-slate-600 font-semibold">${data.periodo?.desde || ''}</strong> al <strong class="text-slate-600 font-semibold">${data.periodo?.hasta || ''}</strong></span>
                    <span class="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">Unidad: URL</span>
                    <button id="${btnResetZoomId}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        <span>Reset Zoom</span>
                    </button>
                </div>
            </div>
            <div class="p-4 sm:p-6">
                <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                    <div id="${canvasWrapperId}" style="min-width: ${minCanvasWidth}px; height: 530px; position: relative;">
                        <canvas id="${canvasId}" style="width: 100%; height: 100%; display: block;"></canvas>
                    </div>
                </div>
            </div>
        `;
        contenedor.appendChild(card);

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const btnResetZoom = document.getElementById(btnResetZoomId);
        const plugins = [];
        if (window.ChartDataLabels) {
            plugins.push(window.ChartDataLabels);
        }

        const chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            plugins: plugins,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 25, right: 25, bottom: 15, left: 10 } },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                            onPanComplete: function () {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        },
                        zoom: {
                            wheel: { enabled: true, speed: 0.1 },
                            pinch: { enabled: true },
                            mode: 'x',
                            onZoomComplete: function () {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        }
                    },
                    legend: (typeof SipGraficaShared !== 'undefined' && SipGraficaShared.buildChartLegendOptions)
                        ? SipGraficaShared.buildChartLegendOptions({ includeEstandar: true })
                        : { position: 'bottom', display: true },
                    datalabels: {
                        clip: false,
                        display: function (ctx) {
                            return ctx.dataset._lumLimit == null && ctx.dataset.data[ctx.dataIndex] != null;
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed.y;
                                if (val === null || val === undefined) return `${context.dataset.label}: S/D`;
                                return `${context.dataset.label}: ${Number(val).toFixed(2)} URL`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(226, 232, 240, 0.7)', drawBorder: false },
                        ticks: {
                            autoSkip: false,
                            maxRotation: modo === 'granja' ? 90 : 0,
                            minRotation: modo === 'granja' ? 90 : 0,
                            font: {
                                size: getTamanoFuente(13),
                                weight: '600',
                                family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            },
                            color: '#334155'
                        }
                    },
                    y: {
                        min: yRange.min,
                        max: yRange.max,
                        grid: { color: 'rgba(226, 232, 240, 0.7)', drawBorder: false },
                        title: {
                            display: true,
                            text: 'URL (Unidades Relativas de Luz)',
                            font: {
                                size: getTamanoFuente(13),
                                weight: 'bold',
                                family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            },
                            color: '#475569'
                        },
                        ticks: {
                            font: {
                                size: getTamanoFuente(11),
                                weight: '600',
                                family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                            },
                            color: '#475569',
                            callback: function (v) { return Number(v).toFixed(0); }
                        }
                    }
                }
            }
        });

        if (btnResetZoom) {
            btnResetZoom.addEventListener('click', function () {
                if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                    chartInstance.resetZoom();
                    btnResetZoom.classList.add('hidden');
                }
            });
        }
        canvas.addEventListener('dblclick', function () {
            if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                chartInstance.resetZoom();
                if (btnResetZoom) btnResetZoom.classList.add('hidden');
            }
        });

        instanciasGraficosHz[canvasId] = chartInstance;
        cacheGraficosHz[canvasId] = {
            chartInstance,
            data,
            registrosFiltrados: [...registrosFiltrados],
            cardId,
            canvasWrapperId,
            tieneCv: false,
            tipo: tipoKey
        };
        syncDockLeyendaHz();
    }

    /**
     * Renderiza un gráfico horizontal de acumulado semanal
     * @param {Object} data - Respuesta del endpoint get_sip_grafica_acumulado_semanal.php
     * @param {Object} opcionesFiltro - { sexo, lineasSuaves, separarGraficos, granjas, campanias, galpones, unificado, esUnificado }
     */
    function renderizarGraficoHorizontal(data, opcionesFiltro) {
        const contenedor = document.getElementById('contenedor-graficos-horizontales');
        if (!contenedor || !data) return;

        const tipo = data.tipo || 'mortalidad';
        if (tipo === 'luminometria') {
            renderizarGraficoHorizontalLuminometria(data, opcionesFiltro);
            return;
        }
        if (!Array.isArray(data.registros)) return;
        const tipoKey = data.dia ? `${tipo}-dia-${data.dia}` : tipo;
        const cardId = `card-grafico-hz-${tipoKey}`;

        // Guardar en caché por tipo para manipulación reactiva
        cacheDataPorTipoHz[tipoKey] = {
            data,
            opcionesFiltro: { ...opcionesFiltro }
        };

        // Filtrar registros según selección de ubicación del usuario
        let registrosFiltrados = data.registros;

        let {
            sexo = 'macho',
            lineasSuaves = false,
            separarGraficos = false,
            esUnificado = false,
            granjas = [],
            campanias = [],
            galpones = [],
            unificado = []
        } = opcionesFiltro || {};
        if (tipo === 'roedores' || tipo === 'medicacion') {
            sexo = 'combinado';
        }

        if (esUnificado && Array.isArray(unificado) && unificado.length > 0) {
            registrosFiltrados = registrosFiltrados.filter(r => {
                return unificado.some(u => {
                    const matchGranja = u.granja && granjaCoincideFiltroHz(u.granja, r);
                    const matchCampania = (!u.campania || String(u.campania) === String(r.campania));
                    const matchGalpon = (!u.galpon || String(u.galpon) === String(r.galpon));
                    return matchGranja && matchCampania && matchGalpon;
                });
            });
        } else {
            if (Array.isArray(granjas) && granjas.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => granjas.some(g => granjaCoincideFiltroHz(g, r)));
            }
            if (Array.isArray(campanias) && campanias.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => campanias.some(c => campaniaCoincideFiltroHz(c, r)));
            }
            if (Array.isArray(galpones) && galpones.length > 0) {
                registrosFiltrados = registrosFiltrados.filter(r => galpones.some(gp => galponCoincideFiltroHz(gp, r)));
            }
        }

        // Destruir instancias previas de este tipo
        const posiblesCanvasIds = [
            `canvas-hz-${tipoKey}`,
            `canvas-hz-${tipoKey}-macho`,
            `canvas-hz-${tipoKey}-hembra`,
            `canvas-hz-${tipoKey}-pct`,
            `canvas-hz-${tipoKey}-macho-pct`,
            `canvas-hz-${tipoKey}-hembra-pct`
        ];
        posiblesCanvasIds.forEach(cId => {
            if (instanciasGraficosHz[cId]) {
                try {
                    instanciasGraficosHz[cId].destroy();
                } catch (e) {}
                delete instanciasGraficosHz[cId];
            }
            if (cId.indexOf('-pct') !== -1) {
                destruirChartHzPct(cId);
            }
            if (cacheGraficosHz[cId]) {
                delete cacheGraficosHz[cId];
            }
        });

        let existingCard = document.getElementById(cardId);
        if (existingCard) {
            existingCard.remove();
        }

        const textoPeriodoHz = data.dia ? `Día ${data.dia}${data.semana ? ' (Semana ' + data.semana + ')' : ''}` : `Semana ${data.semana || 1}`;

        if (registrosFiltrados.length === 0) {
            const emptyCard = document.createElement('div');
            emptyCard.id = cardId;
            emptyCard.className = 'w-full bg-white rounded-2xl p-8 text-center text-slate-500 font-medium border border-slate-200/80 shadow-sm';
            emptyCard.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2">
                    <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-sm font-semibold text-slate-700">Sin datos para ${data.nombre || tipo} - ${textoPeriodoHz}</p>
                    <p class="text-xs text-slate-400">No se encontraron lotes con los filtros seleccionados.</p>
                </div>
            `;
            contenedor.appendChild(emptyCard);
            return;
        }

        // Construir Eje X y Datasets
        const labels = [];
        const dataM = [];
        const dataH = [];
        const dataComb = [];
        const dataCvM = [];
        const dataCvH = [];
        const dataCvComb = [];
        const dataStdM = [];
        const dataStdH = [];
        const dataStdComb = [];

        let tieneCv = false;
        let tieneStdM = false;
        let tieneStdH = false;
        const plagaSeries = {
            larvaM: [],
            larvaH: [],
            adultoM: [],
            adultoH: [],
            vivos: [],
            muertos: [],
            perimetro: [],
            techo: [],
            consumoTodos: []
        };
        const plagaMedicion = opcionesFiltro.plagaMedicion || 'todos';
        const plagaAmbito = opcionesFiltro.plagaAmbito || 'avistamiento';
        const metricasMed = Array.isArray(data.metricas) ? data.metricas.slice() : [];
        const medSeries = {};
        metricasMed.forEach(function (m) { medSeries[m] = []; });
        data._hzPlagaSeries = plagaSeries;
        data._hzPlagaMedicion = plagaMedicion;
        data._hzPlagaAmbito = plagaAmbito;
        data._hzMetricas = metricasMed;
        data._hzMedSeries = medSeries;
        if (tipo === 'roedores' && plagaAmbito === 'consumo') {
            data.unidad = '%';
        }
        if (tipo === 'medicacion') {
            data.unidad = data.unidad || 'unidades';
        }

        registrosFiltrados.forEach(r => {
            const granjaStr = r.granjaNombre || r.granja;
            const fechaStr = formatearFechaCorta(r.fechaSemana || r.fechaCarga);
            const labelX = `${granjaStr}-${r.campania}-${r.galpon}: ${fechaStr}`;
            labels.push(labelX);

            plagaSeries.larvaM.push(numHz(r.larvaM));
            plagaSeries.larvaH.push(numHz(r.larvaH));
            plagaSeries.adultoM.push(numHz(r.adultoM));
            plagaSeries.adultoH.push(numHz(r.adultoH));
            plagaSeries.vivos.push(numHz(r.vivos));
            plagaSeries.muertos.push(numHz(r.muertos));
            plagaSeries.perimetro.push(numHz(r.perimetro));
            plagaSeries.techo.push(numHz(r.techo));
            plagaSeries.consumoTodos.push(consumoTodosHz(r.consumoTodos, r.perimetro, r.techo));
            if (tipo === 'medicacion' && r.medicinas && typeof r.medicinas === 'object') {
                metricasMed.forEach(function (m) {
                    medSeries[m].push(numHz(r.medicinas[m]));
                });
            }

            const vM = (r.valorM !== null && r.valorM !== undefined && !isNaN(r.valorM)) ? Number(r.valorM) : null;
            const vH = (r.valorH !== null && r.valorH !== undefined && !isNaN(r.valorH)) ? Number(r.valorH) : null;
            dataM.push(vM);
            dataH.push(vH);

            let vC = null;
            if (vM !== null && vH !== null) vC = Number(((vM + vH) / 2).toFixed(4));
            else if (vM !== null) vC = vM;
            else if (vH !== null) vC = vH;
            dataComb.push(vC);

            const sM = (r.estandarM !== null && r.estandarM !== undefined && !isNaN(r.estandarM)) ? Number(r.estandarM) : null;
            const sH = (r.estandarH !== null && r.estandarH !== undefined && !isNaN(r.estandarH)) ? Number(r.estandarH) : null;
            dataStdM.push(sM);
            dataStdH.push(sH);
            let sC = null;
            if (sM !== null && sH !== null) sC = Number(((sM + sH) / 2).toFixed(4));
            else if (sM !== null) sC = sM;
            else if (sH !== null) sC = sH;
            dataStdComb.push(sC);
            if (sM !== null) tieneStdM = true;
            if (sH !== null) tieneStdH = true;

            const cM = (r.cvM !== null && r.cvM !== undefined && !isNaN(r.cvM)) ? Number(r.cvM) : null;
            const cH = (r.cvH !== null && r.cvH !== undefined && !isNaN(r.cvH)) ? Number(r.cvH) : null;
            dataCvM.push(cM);
            dataCvH.push(cH);
            let cC = null;
            if (cM !== null && cH !== null) cC = Number(((cM + cH) / 2).toFixed(4));
            else if (cM !== null) cC = cM;
            else if (cH !== null) cC = cH;
            dataCvComb.push(cC);
            if (cM !== null || cH !== null) tieneCv = true;
        });

        if (!tipoIncluyeCvEnGrafico(tipo)) {
            tieneCv = false;
        }

        // Crear contenedor HTML de la tarjeta
        const card = document.createElement('div');
        card.id = cardId;
        card.className = 'w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden';

        const nombreGrafico = data.nombre || tipo.toUpperCase();
        const esSeparado = (sexo === 'ambos' && Boolean(separarGraficos));

        let subtituloHz = textoPeriodoHz;
        if (!tipoIgnoraSexoEnHz(tipo)) {
            let textoSexo = 'Macho';
            if (sexo === 'ambos') {
                textoSexo = esSeparado ? 'Macho y Hembra (Separados)' : 'Macho y Hembra';
            } else if (sexo === 'combinado') {
                textoSexo = 'Combinado (Promedio)';
            } else if (sexo === 'hembra') {
                textoSexo = 'Hembra';
            }
            subtituloHz = `${textoPeriodoHz} - ${textoSexo}`;
        }

        const minCanvasWidth = Math.max(600, registrosFiltrados.length * getColWidthPorLote());
        const tensionVal = lineasSuaves ? 0.35 : 0;
        const htmlMedicion = htmlFiltrosPlagasHz(tipo, plagaMedicion, plagaAmbito);

        if (esSeparado) {
            // MODO SEPARADO: 2 Gráficos Apilados dentro de la misma tarjeta
            const canvasWrapperIdM = `wrapper-canvas-hz-${tipoKey}-macho`;
            const canvasWrapperIdH = `wrapper-canvas-hz-${tipoKey}-hembra`;
            const canvasIdM = `canvas-hz-${tipoKey}-macho`;
            const canvasIdH = `canvas-hz-${tipoKey}-hembra`;
            const btnResetZoomIdM = `btn-reset-zoom-hz-${tipoKey}-macho`;
            const btnResetZoomIdH = `btn-reset-zoom-hz-${tipoKey}-hembra`;

            card.innerHTML = `
                <!-- HEADER DE LA TARJETA -->
                <div class="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                            ${nombreGrafico}
                        </span>
                        <span class="subtitulo-hz-sexo text-xs font-bold text-slate-700">${subtituloHz}</span>
                        ${htmlMedicion}
                        ${htmlCheckboxPctHz(tipo, tipoKey, opcionesFiltro)}
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-400">
                        <span>Período: <strong class="text-slate-600 font-semibold">${data.periodo?.desde || ''}</strong> al <strong class="text-slate-600 font-semibold">${data.periodo?.hasta || ''}</strong></span>
                        <span class="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                            Unidad: ${data.unidad || ''}${tieneCv ? ' / CV%' : ''}
                        </span>
                    </div>
                </div>

                <!-- CONTENEDOR 1: MACHO -->
                <div class="p-4 sm:p-5 pb-3">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md flex items-center gap-1.5 shadow-2xs">
                            <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                            Macho
                        </span>
                        <button id="${btnResetZoomIdM}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span>Reset Zoom Macho</span>
                        </button>
                    </div>
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperIdM}" style="min-width: ${minCanvasWidth}px; height: ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '510px' : '380px'}; position: relative;${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? ' display:flex; flex-direction:column;' : ''}">
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? htmlSlotPctHz(canvasIdM, tipo, opcionesFiltro) : ''}
                            <canvas id="${canvasIdM}" style="width: 100%; height: 100%; display: block;"></canvas>
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '</div>' : ''}
                        </div>
                    </div>
                </div>

                <!-- DIVISOR SUAVE -->
                <div class="border-t border-slate-100 mx-5 my-1"></div>

                <!-- CONTENEDOR 2: HEMBRA -->
                <div class="p-4 sm:p-5 pt-3">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 rounded-md flex items-center gap-1.5 shadow-2xs">
                            <span class="w-2 h-2 rounded-full bg-rose-600"></span>
                            Hembra
                        </span>
                        <button id="${btnResetZoomIdH}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            <span>Reset Zoom Hembra</span>
                        </button>
                    </div>
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperIdH}" style="min-width: ${minCanvasWidth}px; height: ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '510px' : '380px'}; position: relative;${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? ' display:flex; flex-direction:column;' : ''}">
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? htmlSlotPctHz(canvasIdH, tipo, opcionesFiltro) : ''}
                            <canvas id="${canvasIdH}" style="width: 100%; height: 100%; display: block;"></canvas>
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '</div>' : ''}
                        </div>
                    </div>
                </div>
            `;

            contenedor.appendChild(card);
            bindSelectMedicionHz(card, tipoKey);
            bindSelectAmbitoHz(card, tipoKey);
            bindPctCheckboxHz(card, tipoKey);

            // Instanciar Gráfico Macho
            const datasetsM = crearDatasetsHz('macho', data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartM = crearInstanciaChartHz(canvasIdM, labels, datasetsM, data, btnResetZoomIdM, tieneCv);
            if (hzMostrarPctParaTipo(tipo, opcionesFiltro)) {
                var pctDsM = crearDatasetsVarPctHz('macho', tipo, dataM, dataH, dataComb, dataStdM, dataStdH, dataStdComb, tieneStdM, tieneStdH);
                crearInstanciaChartHzPct(canvasIdM + '-pct', labels, pctDsM, chartM, btnResetZoomIdM, tipo, opcionesFiltro);
            }

            // Instanciar Gráfico Hembra
            const datasetsH = crearDatasetsHz('hembra', data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartH = crearInstanciaChartHz(canvasIdH, labels, datasetsH, data, btnResetZoomIdH, tieneCv);
            if (hzMostrarPctParaTipo(tipo, opcionesFiltro)) {
                var pctDsH = crearDatasetsVarPctHz('hembra', tipo, dataM, dataH, dataComb, dataStdM, dataStdH, dataStdComb, tieneStdM, tieneStdH);
                crearInstanciaChartHzPct(canvasIdH + '-pct', labels, pctDsH, chartH, btnResetZoomIdH, tipo, opcionesFiltro);
            }

            if (chartM) {
                cacheGraficosHz[canvasIdM] = {
                    chartInstance: chartM,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId: canvasWrapperIdM,
                    tieneCv,
                    tipo: tipoKey
                };
            }

            if (chartH) {
                cacheGraficosHz[canvasIdH] = {
                    chartInstance: chartH,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId: canvasWrapperIdH,
                    tieneCv,
                    tipo: tipoKey
                };
            }
            syncDockLeyendaHz();

        } else {
            // MODO UNIFICADO: 1 Solo Gráfico
            const canvasWrapperId = `wrapper-canvas-hz-${tipoKey}`;
            const canvasId = `canvas-hz-${tipoKey}`;
            const btnResetZoomId = `btn-reset-zoom-hz-${tipoKey}`;

            card.innerHTML = `
                <!-- HEADER DE LA TARJETA -->
                <div class="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                            </svg>
                            ${nombreGrafico}
                        </span>
                        <span class="subtitulo-hz-sexo text-xs font-bold text-slate-700">${subtituloHz}</span>
                        ${htmlMedicion}
                        ${htmlCheckboxPctHz(tipo, tipoKey, opcionesFiltro)}
                    </div>
                    <div class="flex items-center gap-3 text-xs text-slate-400">
                        <span>Período: <strong class="text-slate-600 font-semibold">${data.periodo?.desde || ''}</strong> al <strong class="text-slate-600 font-semibold">${data.periodo?.hasta || ''}</strong></span>
                        <span class="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-md">
                            Unidad: ${data.unidad || ''}${tieneCv ? ' / CV%' : ''}
                        </span>
                        <button id="${btnResetZoomId}" type="button" class="hidden px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs" title="Restablecer zoom del gráfico">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            <span>Reset Zoom</span>
                        </button>
                    </div>
                </div>

                <!-- ÁREA SCROLLABLE DEL GRÁFICO -->
                <div class="p-4 sm:p-6">
                    <div class="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                        <div id="${canvasWrapperId}" style="min-width: ${minCanvasWidth}px; height: ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '660px' : '530px'}; position: relative;${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? ' display:flex; flex-direction:column;' : ''}">
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? htmlSlotPctHz(canvasId, tipo, opcionesFiltro) : ''}
                            <canvas id="${canvasId}" style="width: 100%; height: 100%; display: block;"></canvas>
                            ${hzMostrarPctParaTipo(tipo, opcionesFiltro) ? '</div>' : ''}
                        </div>
                    </div>
                </div>
            `;

            contenedor.appendChild(card);
            bindSelectMedicionHz(card, tipoKey);
            bindSelectAmbitoHz(card, tipoKey);
            bindPctCheckboxHz(card, tipoKey);

            const datasets = crearDatasetsHz(sexo, data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH);
            const chartInstance = crearInstanciaChartHz(canvasId, labels, datasets, data, btnResetZoomId, tieneCv);
            if (hzMostrarPctParaTipo(tipo, opcionesFiltro)) {
                var pctDs = crearDatasetsVarPctHz(sexo, tipo, dataM, dataH, dataComb, dataStdM, dataStdH, dataStdComb, tieneStdM, tieneStdH);
                crearInstanciaChartHzPct(canvasId + '-pct', labels, pctDs, chartInstance, btnResetZoomId, tipo, opcionesFiltro);
            }

            if (chartInstance) {
                cacheGraficosHz[canvasId] = {
                    chartInstance,
                    data,
                    registrosFiltrados: [...registrosFiltrados],
                    cardId,
                    canvasWrapperId,
                    tieneCv,
                    tipo: tipoKey
                };
            }
            syncDockLeyendaHz();
        }
    }

    /**
     * Construye una instancia de Chart.js configurada para gráficos horizontales con soporte de doble eje
     */
    function crearInstanciaChartHz(canvasId, labels, datasets, data, btnResetZoomId, tieneCv) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const btnResetZoom = btnResetZoomId ? document.getElementById(btnResetZoomId) : null;

        const plugins = [];
        if (window.ChartDataLabels) {
            plugins.push(window.ChartDataLabels);
        }
        const stackedRoed = ((data.tipo === 'roedores')
            && (data._hzPlagaAmbito || 'avistamiento') === 'avistamiento'
            && (data._hzPlagaMedicion || 'todos') === 'todos'
            && Array.isArray(datasets)
            && datasets.filter(function (ds) { return ds.stack; }).length > 1)
            || (data.tipo === 'medicacion' && Array.isArray(datasets) && datasets.length > 1);

        const scalesConfig = {
            x: {
                stacked: stackedRoed,
                grid: {
                    color: 'rgba(226, 232, 240, 0.7)',
                    drawBorder: false
                },
                ticks: {
                    autoSkip: false,
                    maxRotation: 90,
                    minRotation: 90,
                    font: {
                        size: getTamanoFuente(13),
                        weight: '600',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#334155'
                }
            }
        };

        if (data.esCombinado && Array.isArray(data.seriesList)) {
            data.seriesList.forEach((s, idx) => {
                scalesConfig[s.axisId] = {
                    beginAtZero: true,
                    position: s.position,
                    grid: {
                        drawOnChartArea: idx === 0,
                        color: 'rgba(226, 232, 240, 0.7)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: `${s.nombre} (${s.unidad || ''})`,
                        font: {
                            size: getTamanoFuente(13),
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: s.color
                    },
                    ticks: {
                        font: {
                            size: getTamanoFuente(13),
                            weight: '600',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: s.color
                    }
                };
            });
        } else {
            const suggestedMaxY = (data.tipo === 'medicacion' && typeof calcSuggestedMaxBarras === 'function')
                ? calcSuggestedMaxBarras(datasets)
                : undefined;
            scalesConfig.y = {
                beginAtZero: true,
                stacked: stackedRoed,
                position: 'left',
                grace: data.tipo === 'medicacion' ? '18%' : undefined,
                grid: {
                    color: 'rgba(226, 232, 240, 0.7)',
                    drawBorder: false
                },
                title: {
                    display: true,
                    text: data.unidad || '',
                    font: {
                        size: getTamanoFuente(13),
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#475569'
                },
                ticks: {
                    font: {
                        size: getTamanoFuente(11),
                        weight: '600',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    color: '#475569'
                }
            };
            if (suggestedMaxY != null) {
                scalesConfig.y.suggestedMax = suggestedMaxY;
            }

            // Segundo Eje Y (Derecho) para Coeficiente de Variación (CV%)
            if (tieneCv) {
                scalesConfig.yCv = {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(226, 232, 240, 0.5)',
                        drawBorder: true
                    },
                    title: {
                        display: true,
                        text: 'CV %',
                        font: {
                            size: getTamanoFuente(13),
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: '#0284c7'
                    },
                    ticks: {
                        font: {
                            size: getTamanoFuente(13),
                            weight: '600',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        color: '#0284c7',
                        callback: function (val) {
                            return val + '%';
                        }
                    }
                };
            }
        }

        const chartEsCombinadoLineas = Boolean(data.esCombinado && (
            data.forzarLineasEnCombinado || data.tipo === 'combinado'
        ));
        const chartInstance = new Chart(ctx, {
            type: chartEsCombinadoLineas ? 'line' : (esTipoBarrasHz(data.tipo || '') ? 'bar' : 'line'),
            data: {
                labels: labels,
                datasets: datasets
            },
            plugins: plugins,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: {
                        top: esTipoBarrasHz(data.tipo || '') ? 56 : 25,
                        right: (tieneCv || (data.esCombinado && data.seriesList && data.seriesList.some(s => s.position === 'right'))) ? 35 : 25,
                        bottom: 15,
                        left: 10
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                            onPanComplete: () => {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                speed: 0.1
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x',
                            onZoomComplete: () => {
                                if (btnResetZoom) btnResetZoom.classList.remove('hidden');
                            }
                        }
                    },
                    legend: (typeof SipGraficaShared !== 'undefined' && SipGraficaShared.buildChartLegendOptions)
                        ? SipGraficaShared.buildChartLegendOptions({ includeEstandar: true })
                        : { position: 'bottom', display: true },
                    datalabels: {
                        clip: false
                    },
                    sipPlagasBarVis: {
                        enabled: esTipoBarrasHz(data.tipo || ''),
                        minBarPx: 10,
                        minBarPxUnderOne: 16,
                        zeroBarPx: 4
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            title: function (tooltipItems) {
                                if (tooltipItems.length > 0) {
                                    return tooltipItems[0].label;
                                }
                                return '';
                            },
                            label: function (context) {
                                const val = context.parsed.y;
                                if (val === null || val === undefined) return `${context.dataset.label}: S/D`;
                                if (context.dataset.yAxisID === 'yCv' || String(context.dataset.label).includes('CV')) {
                                    return `${context.dataset.label}: ${Number(val).toFixed(2)}%`;
                                }
                                const dec = getDecimalesPorTipo(data.tipo || '');
                                return `${context.dataset.label}: ${Number(val).toFixed(dec)} ${data.unidad || ''}`;
                            }
                        }
                    }
                },
                scales: scalesConfig
            }
        });

        // Eventos para restablecer zoom
        if (btnResetZoom) {
            btnResetZoom.addEventListener('click', () => {
                if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                    chartInstance.resetZoom();
                    btnResetZoom.classList.add('hidden');
                }
            });
        }

        canvas.addEventListener('dblclick', () => {
            var pctInst = instanciasGraficosHz[canvasId + '-pct'];
            var SGS = window.SipGraficaShared;
            if (SGS && typeof SGS.resetChartsZoomX === 'function') {
                SGS.resetChartsZoomX(chartInstance, pctInst);
            } else if (chartInstance && typeof chartInstance.resetZoom === 'function') {
                chartInstance.resetZoom();
            }
            if (btnResetZoom) btnResetZoom.classList.add('hidden');
        });

        instanciasGraficosHz[canvasId] = chartInstance;
        return chartInstance;
    }

    /**
     * Construye la lista de datasets de Chart.js según el sexo seleccionado con soporte de Estándares y Coeficiente de Variación (CV%)
     */
    function crearDatasetsHz(sexo, data, tipo, dataM, dataH, dataComb, dataCvM, dataCvH, dataCvComb, dataStdM, dataStdH, dataStdComb, tensionVal, tieneCv, tieneStdM, tieneStdH) {
        const datasets = [];
        const fontDatalabelsSize = getTamanoFuente(11.5);
        const dec = getDecimalesPorTipo(tipo);

        if (!data.esCombinado && tipo === 'medicacion') {
            return crearDatasetsMedicacionHz(data);
        }

        if (!data.esCombinado && esTipoBarrasHz(tipo)) {
            return crearDatasetsPlagasHz(sexo, data, tipo);
        }

        if (data.esCombinado && Array.isArray(data.seriesList)) {
            data.seriesList.forEach((s, idx) => {
                let arrData = s.dataM;
                if (sexo === 'hembra') arrData = s.dataH;
                else if (sexo === 'combinado') arrData = s.dataComb;

                const decS = getDecimalesPorTipo(s.tipo);

                datasets.push({
                    label: `${s.nombre} (${s.unidad || ''})`,
                    data: arrData,
                    yAxisID: s.axisId || 'y',
                    borderColor: s.color,
                    backgroundColor: s.bg || s.color,
                    borderWidth: 2.2,
                    pointBackgroundColor: s.color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: idx % 2 === 0 ? 'top' : 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: s.color,
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return (value !== null && value !== undefined && !isNaN(value)) ? Number(value).toFixed(decS) : '';
                        }
                    }
                });
            });
            return aplicarEstiloBarrasHz(datasets, tipo);
        }

        const labelPeriodo = data.dia ? `D${data.dia}` : `S${data.semana || 1}`;

        if (sexo === 'macho' || sexo === 'ambos') {
            // Valor Real Macho
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Macho`,
                data: dataM,
                yAxisID: 'y',
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#1d4ed8',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Macho (si existe en los datos - Verde Normal)
            if (tieneStdM && Array.isArray(dataStdM)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Macho`,
                    data: dataStdM,
                    yAxisID: 'y',
                    _hcStdDs: true,
                    borderColor: '#16a34a',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#16a34a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#15803d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Macho (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvM)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Macho (%)`,
                    data: dataCvM,
                    yAxisID: 'yCv',
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#0284c7',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#0369a1',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        if (sexo === 'hembra' || sexo === 'ambos') {
            // Valor Real Hembra
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Hembra`,
                data: dataH,
                yAxisID: 'y',
                borderColor: '#ea0c43',
                backgroundColor: 'rgba(234, 88, 12, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#ea0c43',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#be123c',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Hembra (si existe en los datos - Verde Oscuro)
            if (tieneStdH && Array.isArray(dataStdH)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Hembra`,
                    data: dataStdH,
                    yAxisID: 'y',
                    _hcStdDs: true,
                    borderColor: '#166534',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#166534',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#14532d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Hembra (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvH)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Hembra (%)`,
                    data: dataCvH,
                    yAxisID: 'yCv',
                    borderColor: '#ea580c',
                    backgroundColor: 'rgba(234, 88, 12, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#ea580c',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#c2410c',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        if (sexo === 'combinado') {
            // Valor Real Combinado
            datasets.push({
                label: `${data.nombre || tipo} ${labelPeriodo} Combinado`,
                data: dataComb,
                yAxisID: 'y',
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                borderWidth: 2.2,
                pointBackgroundColor: '#8b5cf6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.8,
                pointRadius: 4,
                pointHoverRadius: 6.5,
                tension: tensionVal,
                fill: false,
                datalabels: {
                    display: true,
                    align: 'top',
                    anchor: 'center',
                    offset: 5,
                    color: '#6d28d9',
                    font: {
                        size: fontDatalabelsSize,
                        weight: 'bold',
                        family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    },
                    formatter: function (value) {
                        return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                    }
                }
            });

            // Estándar Combinado (si existe en los datos - Verde Promedio #15803d)
            if ((tieneStdM || tieneStdH) && Array.isArray(dataStdComb)) {
                datasets.push({
                    label: `Estándar ${labelPeriodo} Combinado`,
                    data: dataStdComb,
                    yAxisID: 'y',
                    _hcStdDs: true,
                    borderColor: '#15803d',
                    backgroundColor: 'transparent',
                    borderWidth: 1.8,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#15803d',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 3.5,
                    pointHoverRadius: 5.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: false,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 4,
                        color: '#15803d',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(dec) : '';
                        }
                    }
                });
            }

            // CV Combinado (si existe en los datos)
            if (tieneCv && Array.isArray(dataCvComb)) {
                datasets.push({
                    label: `CV ${labelPeriodo} Combinado (%)`,
                    data: dataCvComb,
                    yAxisID: 'yCv',
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointBackgroundColor: '#7c3aed',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1.8,
                    pointRadius: 4,
                    pointHoverRadius: 6.5,
                    tension: tensionVal,
                    fill: false,
                    datalabels: {
                        display: true,
                        align: 'bottom',
                        anchor: 'center',
                        offset: 5,
                        color: '#5b21b6',
                        font: {
                            size: fontDatalabelsSize,
                            weight: 'bold',
                            family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                        },
                        formatter: function (value) {
                            return value !== null && value !== undefined && !isNaN(value) ? Number(value).toFixed(2) + '%' : '';
                        }
                    }
                });
            }
        }

        return aplicarEstiloBarrasHz(datasets, tipo);
    }

    /**
     * Actualiza en caliente el sexo visualizado en todas las gráficas horizontales activas sin recargar el endpoint
     */
    function actualizarSexoGraficosHorizontales(nuevoSexo) {
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            const item = cacheDataPorTipoHz[tipo];
            if (item && item.data) {
                item.opcionesFiltro.sexo = nuevoSexo;
                renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
            }
        });
    }

    /**
     * Actualiza en caliente la separación de gráficas (apiladas / unificadas) sin recargar el endpoint
     */
    function actualizarSeparacionGraficosHorizontales(separar) {
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            const item = cacheDataPorTipoHz[tipo];
            if (item && item.data) {
                item.opcionesFiltro.separarGraficos = Boolean(separar);
                renderizarGraficoHorizontal(item.data, item.opcionesFiltro);
            }
        });
    }

    /**
     * Actualiza dinámicamente la curvatura de las líneas en todos los gráficos horizontales activos
     */
    function actualizarTensionGraficosHorizontales(esSuave) {
        const tensionVal = esSuave ? 0.35 : 0;
        Object.keys(cacheDataPorTipoHz).forEach(tipo => {
            if (cacheDataPorTipoHz[tipo]) {
                cacheDataPorTipoHz[tipo].opcionesFiltro.lineasSuaves = esSuave;
            }
        });
        Object.keys(instanciasGraficosHz).forEach(key => {
            const chart = instanciasGraficosHz[key];
            if (chart && chart.data && Array.isArray(chart.data.datasets)) {
                chart.data.datasets.forEach(ds => {
                    ds.tension = tensionVal;
                });
                chart.update();
            }
        });
    }

    /**
     * Aumenta o disminuye en caliente el tamaño de letra y espaciado de todos los gráficos horizontales
     * @param {number} direccion - (+1 para agrandar, -1 para disminuir)
     */
    function cambiarTamanoTextoGraficosHorizontales(direccion) {
        const nuevoIndice = indiceEscalaTexto + (direccion > 0 ? 1 : -1);
        if (nuevoIndice < 0 || nuevoIndice >= NIVELES_ESCALA_TEXTO.length) {
            return;
        }
        indiceEscalaTexto = nuevoIndice;

        const escala = getEscalaTextoActual();
        const pctTexto = `${Math.round(escala * 100)}%`;

        const labelTamano = document.getElementById('label-tamano-texto-hz');
        if (labelTamano) {
            labelTamano.textContent = pctTexto;
        }

        const sizeX = getTamanoFuente(12);
        const sizeY = getTamanoFuente(12);
        const sizeYTitle = getTamanoFuente(13);
        const sizeLabels = getTamanoFuente(11.5);
        const colWidth = getColWidthPorLote();

        Object.keys(cacheGraficosHz).forEach(canvasId => {
            const item = cacheGraficosHz[canvasId];
            if (!item || !item.chartInstance) return;

            const chart = item.chartInstance;

            // Actualizar ancho del contenedor wrapper si es necesario
            const wrapper = document.getElementById(item.canvasWrapperId);
            if (wrapper && Array.isArray(item.registrosFiltrados)) {
                const nuevoAncho = Math.max(600, item.registrosFiltrados.length * colWidth);
                wrapper.style.minWidth = `${nuevoAncho}px`;
            }

            // Actualizar fuentes de escalas dinámicamente
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(scaleKey => {
                    if (scaleKey === 'x') {
                        if (chart.options.scales.x.ticks && chart.options.scales.x.ticks.font) {
                            chart.options.scales.x.ticks.font.size = sizeX;
                        }
                    } else {
                        const sc = chart.options.scales[scaleKey];
                        if (sc.ticks && sc.ticks.font) sc.ticks.font.size = sizeY;
                        if (sc.title && sc.title.font) sc.title.font.size = sizeYTitle;
                    }
                });
            }

            // Actualizar fuentes de datalabels en cada dataset
            if (Array.isArray(chart.data.datasets)) {
                chart.data.datasets.forEach(ds => {
                    if (ds.datalabels && ds.datalabels.font) {
                        ds.datalabels.font.size = sizeLabels;
                    }
                });
            }

            chart.resize();
            chart.update();
        });
    }

    function actualizarVisibilidadPctHorizontales() {
        /* Control por tarjeta (checkbox Grafico %); sin toggle global en filtros. */
    }

    // Exportar al objeto global
    window.renderizarGraficoHorizontal = renderizarGraficoHorizontal;
    window.actualizarVisibilidadPctHorizontales = actualizarVisibilidadPctHorizontales;
    window.limpiarGraficosHorizontales = limpiarGraficosHorizontales;
    window.actualizarTensionGraficosHorizontales = actualizarTensionGraficosHorizontales;
    window.actualizarSexoGraficosHorizontales = actualizarSexoGraficosHorizontales;
    window.actualizarSeparacionGraficosHorizontales = actualizarSeparacionGraficosHorizontales;
    window.cambiarTamanoTextoGraficosHorizontales = cambiarTamanoTextoGraficosHorizontales;
    window.actualizarIndicadorProgresoHz = actualizarIndicadorProgresoHz;
    window.syncDockLeyendaHz = syncDockLeyendaHz;

})(window);
