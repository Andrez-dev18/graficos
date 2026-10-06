/**
 * CoreBI - Módulo Temperatura / Datalogger (Consulta)
 * Código 100% fiel a la lógica y renderizado de Sanidad original.
 */

(function () {
    'use strict';

    const API = '../../backend/temperatura/crud';
    const COLOR_TEMP = '#1e40af';
    const COLOR_HUM = '#047857';
    const FILL_TEMP = 'rgba(30, 64, 175, 0.12)';
    const FILL_HUM = 'rgba(4, 120, 87, 0.12)';

    let chartConsultaInst = null;
    let chartConsultaPorCorralTemp = [null, null, null, null, null, null];
    let chartConsultaPorCorralHum = [null, null, null, null, null, null];
    let chartModalZoomInst = null;
    let dtConsultaTemp = null;
    let dtConsultaPorSerie = [null, null, null, null, null, null];
    let consultaMetaRef = null;
    let consultaSeriesRowsRef = [[], [], [], [], [], []];
    let consultaSeriesRowsHumRef = [[], [], [], [], [], []];
    let lastChartPorSexoCorralTemp = null;
    let lastChartPorSexoCorralHum = null;
    let lastChartMeta = null;

    const CONSULTA_SLOTS_SEXO_CORRAL = [
        { sexo: 'MACHO', corral: 1, canvasIdx: 1, etiquetaCorta: 'MACHO · Corral 1', exportSlug: 'macho_corral_1' },
        { sexo: 'MACHO', corral: 2, canvasIdx: 2, etiquetaCorta: 'MACHO · Corral 2', exportSlug: 'macho_corral_2' },
        { sexo: 'HEMBRA', corral: 1, canvasIdx: 3, etiquetaCorta: 'HEMBRA · Corral 1', exportSlug: 'hembra_corral_1' },
        { sexo: 'HEMBRA', corral: 2, canvasIdx: 4, etiquetaCorta: 'HEMBRA · Corral 2', exportSlug: 'hembra_corral_2' },
        { sexo: 'EXTERNO', corral: 1, canvasIdx: 5, etiquetaCorta: 'EXTERNO', exportSlug: 'externo' },
        { sexo: 'OTROS', corral: 1, canvasIdx: 6, etiquetaCorta: 'OTRAS LECTURAS', exportSlug: 'otras_lecturas' }
    ];

    function el(id) {
        return document.getElementById(id);
    }

    function tempChartThemeColors() {
        if (window.TempTheme && typeof window.TempTheme.chartColors === 'function') {
            return window.TempTheme.chartColors();
        }
        return {
            tick: '#374151',
            grid: 'rgba(156, 163, 175, 0.45)',
            title: '#111827',
            tooltipBg: 'rgba(255, 255, 255, 0.96)',
            tooltipTitle: '#111827',
            tooltipBody: '#374151',
            tooltipBorder: '#e5e7eb'
        };
    }

    function parseMysqlDate(str) {
        if (!str) return null;
        const s = String(str).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
        if (m) {
            return new Date(
                parseInt(m[1], 10),
                parseInt(m[2], 10) - 1,
                parseInt(m[3], 10),
                parseInt(m[4] || '0', 10),
                parseInt(m[5] || '0', 10),
                parseInt(m[6] || '0', 10)
            );
        }
        const d = new Date(s.replace(' ', 'T'));
        return isNaN(d.getTime()) ? null : d;
    }

    function tempFmtTickDdMmHm(d) {
        if (!d || isNaN(d.getTime())) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return dd + '/' + mm + ' ' + hh + ':' + mi;
    }

    function formatDateDdMmYyyy(val) {
        if (val == null || val === '') return '—';
        const s = String(val).trim();
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[3] + '/' + m[2] + '/' + m[1];
        const d = parseMysqlDate(s);
        if (!d) return tempConEscHtml(s);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        return dd + '/' + mm + '/' + yy;
    }

    function formatTimeHmFromMysql(val) {
        if (val == null || val === '') return '—';
        const s = String(val).trim();
        const m = s.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            return m[3] != null && m[3] !== '00' ? (m[1] + ':' + m[2] + ':' + m[3]) : (m[1] + ':' + m[2]);
        }
        const d = parseMysqlDate(s);
        if (!d) return '—';
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return ss !== '00' ? (hh + ':' + mi + ':' + ss) : (hh + ':' + mi);
    }

    function tempConEscHtml(s) {
        if (s == null) return '';
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(String(s)));
        return d.innerHTML;
    }

    function tempConEscAttr(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function tempDlGalponUtil(raw) {
        const s = String(raw || '').trim();
        if (!s || s === '—' || s === '-' || /^n\/a$/i.test(s) || /^null$/i.test(s)) return '';
        return s;
    }

    function tempConSafeParseJson(t) {
        const s = String(t || '').trim();
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(s.slice(start, end + 1));
            } catch (_) {}
        }
        return { success: false, message: s.slice(0, 400) };
    }

    function tempGetConsultaMetrics() {
        const out = [];
        const ct = el('chkConsultaTemperatura');
        const ch = el('chkConsultaHumedad');
        if (ct && ct.checked) out.push('temperatura');
        if (ch && ch.checked) out.push('humedad');
        return out;
    }

    function tituloSerieConsulta(meta) {
        meta = meta || {};
        const g = String(meta.codGranja || '').trim();
        const nom = String(meta.nomGranja || '').trim();
        const camp = String(meta.campania || '').trim() || '—';
        let gal = String(meta.codGalpon || '').trim();
        if (!gal || gal === '-' || gal === '—' || /^(--|n\/a|na|s\/n|sn|null)$/i.test(gal)) {
            gal = '—';
        }
        const granjaTxt = 'Granja' + (g ? ' ' + g : '') + (nom ? ' ' + nom : '');
        return { leyenda: 'Temperatura y humedad ' + granjaTxt + ' · Camp ' + camp + ' · Galp. ' + gal };
    }

    function destruirGraficosCorral() {
        for (let i = 0; i < chartConsultaPorCorralTemp.length; i++) {
            if (chartConsultaPorCorralTemp[i]) {
                chartConsultaPorCorralTemp[i].destroy();
                chartConsultaPorCorralTemp[i] = null;
            }
            if (chartConsultaPorCorralHum[i]) {
                chartConsultaPorCorralHum[i].destroy();
                chartConsultaPorCorralHum[i] = null;
            }
        }
    }

    function destruirTablasConsultaSeries() {
        for (let i = 0; i < dtConsultaPorSerie.length; i++) {
            if (dtConsultaPorSerie[i]) {
                dtConsultaPorSerie[i].destroy();
                dtConsultaPorSerie[i] = null;
            }
        }
    }

    function puntosDesdeLecturas(rows) {
        if (!rows || !rows.length) return [];
        const sorted = rows.slice().sort(function (a, b) {
            return parseMysqlDate(a.fecha_hora) - parseMysqlDate(b.fecha_hora);
        });
        const pts = [];
        sorted.forEach(function (r) {
            const x = parseMysqlDate(r.fecha_hora);
            const y = parseFloat(String(r.valor));
            if (x && !isNaN(y)) {
                pts.push({ x: x.getTime(), y: y });
            }
        });
        return pts;
    }

    function downsamplePtsConsulta(pts, maxN) {
        if (!pts || pts.length <= maxN) return pts || [];
        const step = Math.ceil(pts.length / maxN);
        const out = [];
        for (let i = 0; i < pts.length; i += step) {
            out.push(pts[i]);
        }
        if (out.length && out[out.length - 1] !== pts[pts.length - 1]) {
            out.push(pts[pts.length - 1]);
        }
        return out;
    }

    function crearChartLineaConsulta(canvas, labelTexto, pts, colorLinea, rgbaFill, chartOpts, yLabel) {
        chartOpts = chartOpts || {};
        yLabel = yLabel || labelTexto || 'Valor';
        const th = tempChartThemeColors();
        const xTickSz = chartOpts.xTickSize != null ? chartOpts.xTickSize : 10;
        const yTickSz = chartOpts.yTickSize != null ? chartOpts.yTickSize : xTickSz;
        const yTitleSz = chartOpts.yTitleSize != null ? chartOpts.yTitleSize : 12;
        if (!canvas || !pts || !pts.length) {
            return null;
        }
        const ptsUse = downsamplePtsConsulta(pts, chartOpts.maxPoints || 1800);
        const labels = ptsUse.map(function (p) { return tempFmtTickDdMmHm(new Date(p.x)); });
        const values = ptsUse.map(function (p) { return p.y; });
        const ys = values;
        const yMin = Math.min.apply(null, ys);
        const yMax = Math.max.apply(null, ys);
        const span = yMax - yMin;
        const pad = span > 0 ? span * 0.18 : Math.max(Math.abs(yMin), Math.abs(yMax), 0.01) * 0.15;
        const nShow = values.length;
        const ptR = nShow <= 80 ? 3 : 0;
        const dpr = Math.max(window.devicePixelRatio || 1, 2);
        const fillColor = rgbaFill || 'rgba(37, 99, 235, 0.12)';

        return new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelTexto,
                    data: values,
                    borderColor: colorLinea,
                    backgroundColor: fillColor,
                    borderWidth: 2,
                    pointRadius: ptR,
                    pointHoverRadius: 4,
                    pointStyle: 'circle',
                    tension: 0.2,
                    spanGaps: true,
                    fill: false,
                    _tempPts: ptsUse
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: dpr,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 8, right: 8, bottom: 8, left: 4 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: th.tooltipBg,
                        titleColor: th.tooltipTitle,
                        bodyColor: th.tooltipBody,
                        borderColor: th.tooltipBorder,
                        borderWidth: 1,
                        callbacks: {
                            title: function (items) {
                                if (!items.length) return '';
                                const idx = items[0].dataIndex;
                                const p = ptsUse[idx];
                                if (p) {
                                    const d = new Date(p.x);
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const yy = d.getFullYear();
                                    const hh = String(d.getHours()).padStart(2, '0');
                                    const mi = String(d.getMinutes()).padStart(2, '0');
                                    return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + mi;
                                }
                                return labels[idx] || '';
                            },
                            label: function (ctx) {
                                if (ctx.parsed.y == null || isNaN(ctx.parsed.y)) return null;
                                return yLabel + ': ' + ctx.parsed.y.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: th.tick,
                            autoSkip: true,
                            maxTicksLimit: 14,
                            maxRotation: 90,
                            minRotation: 45,
                            font: { size: xTickSz }
                        },
                        grid: { color: th.grid, drawOnChartArea: true }
                    },
                    y: {
                        title: { display: true, text: yLabel, color: th.title, font: { size: yTitleSz, weight: '500' } },
                        min: yMin - pad,
                        max: yMax + pad,
                        grid: { color: th.grid },
                        ticks: { color: th.tick, font: { size: yTickSz } }
                    }
                }
            }
        });
    }

    function tempCerrarModalGraficoZoom() {
        const modal = el('modalGraficoTempZoom');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
        if (chartModalZoomInst) {
            chartModalZoomInst.destroy();
            chartModalZoomInst = null;
        }
    }

    function tempAbrirModalGraficoDesdeCanvas(canvas) {
        if (!canvas || typeof Chart === 'undefined') return;
        const ch = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
        if (!ch) return;
        const ds = ch.data && ch.data.datasets && ch.data.datasets[0];
        if (!ds || !ds.data || !ds.data.length) return;
        const modal = el('modalGraficoTempZoom');
        const tituloEl = el('graficoTempModalTitulo');
        const cv = el('graficoTempModalCanvas');
        if (!modal || !cv) return;
        if (tituloEl) tituloEl.textContent = ds.label || 'Gráfico';
        if (chartModalZoomInst) {
            chartModalZoomInst.destroy();
            chartModalZoomInst = null;
        }
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        const ptsCopy = (ds._tempPts && ds._tempPts.length)
            ? ds._tempPts.map(function (p) { return { x: p.x, y: p.y }; })
            : null;
        if (!ptsCopy) return;

        chartModalZoomInst = crearChartLineaConsulta(cv, ds.label || 'Serie', ptsCopy, ds.borderColor, ds.backgroundColor, {
            xTickSize: 11,
            yTickSize: 11,
            yTitleSize: 14,
            maxPoints: 4000
        });
    }

    function tempBindZoomGraficosConsulta() {
        document.querySelectorAll('.temp-chart-zoom-hit').forEach(function (wrap) {
            wrap.addEventListener('click', function (ev) {
                if (ev.target.closest('button')) return;
                const canvas = wrap.querySelector('canvas');
                if (!canvas) return;
                tempAbrirModalGraficoDesdeCanvas(canvas);
            });
        });
    }

    function tempFmtValorCell(d) {
        if (d == null || d === '' || d === '—') return '—';
        const n = parseFloat(String(d));
        return isNaN(n) ? tempConEscHtml(String(d)) : n.toFixed(2);
    }

    function tempMergeRowsByDt(rowsT, rowsH) {
        const map = {};
        (rowsT || []).forEach(function (r) {
            const dt = r.fecha_hora;
            if (!map[dt]) {
                map[dt] = { fecha_hora: dt, campania: r.campania, valorTemp: r.valor, valorHum: null };
            } else {
                map[dt].valorTemp = r.valor;
            }
        });
        (rowsH || []).forEach(function (r) {
            const dt = r.fecha_hora;
            if (!map[dt]) {
                map[dt] = { fecha_hora: dt, campania: r.campania, valorTemp: null, valorHum: r.valor };
            } else {
                map[dt].valorHum = r.valor;
            }
        });
        const out = Object.values(map);
        out.sort(function (a, b) {
            return parseMysqlDate(a.fecha_hora) - parseMysqlDate(b.fecha_hora);
        });
        return out;
    }

    function actualizarGraficosConsultaPorSexoCorral(porSexoCorralTemp, porSexoCorralHum, meta, forceBoth) {
        lastChartPorSexoCorralTemp = porSexoCorralTemp;
        lastChartPorSexoCorralHum = porSexoCorralHum;
        lastChartMeta = meta || {};
        const wrapGrid = el('graficosConsultaCorralesWrap');
        const metrics = forceBoth ? ['temperatura', 'humedad'] : tempGetConsultaMetrics();
        const showTemp = metrics.indexOf('temperatura') >= 0;
        const showHum = metrics.indexOf('humedad') >= 0;

        if (chartConsultaInst) {
            chartConsultaInst.destroy();
            chartConsultaInst = null;
        }
        destruirGraficosCorral();
        if (wrapGrid) wrapGrid.classList.remove('hidden');
        const baseTit = tituloSerieConsulta(meta || {});
        consultaMetaRef = meta || {};

        CONSULTA_SLOTS_SEXO_CORRAL.forEach(function (slot, s) {
            const i = slot.canvasIdx;
            const sx = slot.sexo;
            const cr = String(slot.corral);

            const rowsT = (porSexoCorralTemp && (
                (porSexoCorralTemp[sx] && porSexoCorralTemp[sx][cr]) ||
                (porSexoCorralTemp[sx.toLowerCase()] && (porSexoCorralTemp[sx.toLowerCase()][cr] || porSexoCorralTemp[sx.toLowerCase()]['c' + cr]))
            )) || [];

            const rowsH = (porSexoCorralHum && (
                (porSexoCorralHum[sx] && porSexoCorralHum[sx][cr]) ||
                (porSexoCorralHum[sx.toLowerCase()] && (porSexoCorralHum[sx.toLowerCase()][cr] || porSexoCorralHum[sx.toLowerCase()]['c' + cr]))
            )) || [];

            consultaSeriesRowsRef[s] = rowsT;
            consultaSeriesRowsHumRef[s] = rowsH;

            const ptsT = puntosDesdeLecturas(rowsT);
            const ptsH = puntosDesdeLecturas(rowsH);
            const wrapT = el('graficoConsultaWrapTemp' + i);
            const wrapH = el('graficoConsultaWrapHum' + i);
            const canvasT = el('graficoTempConsulta' + i);
            const canvasH = el('graficoHumConsulta' + i);
            const lbl = slot.etiquetaCorta;
            const slotEl = el('graficoConsultaSlot' + i);
            const hasAny = (showTemp && ptsT.length) || (showHum && ptsH.length);

            if (slotEl) {
                slotEl.classList.toggle('hidden', !hasAny);
            }
            if (wrapT) {
                wrapT.classList.toggle('hidden', !showTemp || !ptsT.length);
            }
            if (wrapH) {
                wrapH.classList.toggle('hidden', !showHum || !ptsH.length);
            }

            chartConsultaPorCorralTemp[i - 1] = (showTemp && ptsT.length && canvasT)
                ? crearChartLineaConsulta(canvasT, lbl + ' · Temp', ptsT, COLOR_TEMP, FILL_TEMP, {}, 'Temperatura') : null;
            chartConsultaPorCorralHum[i - 1] = (showHum && ptsH.length && canvasH)
                ? crearChartLineaConsulta(canvasH, lbl + ' · Hum', ptsH, COLOR_HUM, FILL_HUM, {}, 'Humedad') : null;
        });

        const emptyEl = el('temp-dl-charts-empty');
        let anyVisible = false;
        CONSULTA_SLOTS_SEXO_CORRAL.forEach(function (slot) {
            const elSlot = el('graficoConsultaSlot' + slot.canvasIdx);
            if (elSlot && !elSlot.classList.contains('hidden')) {
                anyVisible = true;
            }
        });

        if (emptyEl) {
            emptyEl.classList.toggle('hidden', anyVisible);
        }
        const modalTit = el('temp-dl-modal-charts-listado-title');
        if (modalTit && baseTit && baseTit.leyenda) {
            modalTit.textContent = baseTit.leyenda;
        }

        requestAnimationFrame(function () {
            for (let ri = 0; ri < chartConsultaPorCorralTemp.length; ri++) {
                if (chartConsultaPorCorralTemp[ri] && typeof chartConsultaPorCorralTemp[ri].resize === 'function') {
                    chartConsultaPorCorralTemp[ri].resize();
                }
                if (chartConsultaPorCorralHum[ri] && typeof chartConsultaPorCorralHum[ri].resize === 'function') {
                    chartConsultaPorCorralHum[ri].resize();
                }
            }
        });

        return anyVisible;
    }

    function actualizarTablasDetalleConsultaSeries(hasCampDet) {
        destruirTablasConsultaSeries();
        const cols = [
            { data: 'fecha_hora', defaultContent: '—', render: function (d) { return formatDateDdMmYyyy(d); } },
            { data: 'fecha_hora', defaultContent: '—', render: function (d) { return formatTimeHmFromMysql(d); } },
            {
                data: 'campania',
                defaultContent: '—',
                render: function (d) {
                    if (!hasCampDet) return '—';
                    if (d == null || String(d).trim() === '') return '—';
                    return tempConEscHtml(String(d));
                }
            },
            { data: 'valorTemp', defaultContent: '—', render: function (d) { return tempFmtValorCell(d); } },
            { data: 'valorHum', defaultContent: '—', render: function (d) { return tempFmtValorCell(d); } }
        ];

        for (let s = 0; s < CONSULTA_SLOTS_SEXO_CORRAL.length; s++) {
            const merged = tempMergeRowsByDt(consultaSeriesRowsRef[s] || [], consultaSeriesRowsHumRef[s] || []);
            const tid = '#tablaDetalleTemp' + (s + 1);
            if (!document.querySelector(tid)) {
                continue;
            }
            dtConsultaPorSerie[s] = $(tid).DataTable({
                data: merged,
                columns: cols,
                order: [[0, 'asc']],
                pageLength: 10,
                lengthMenu: [[10, 25, 50, -1], [10, 25, 50, 'Todos']],
                language: window.DATATABLES_LANG_ES || {}
            });
        }
    }

    function tempConMountChartsToListadoModal() {
        const host = el('temp-dl-listado-charts-host');
        const wrap = el('graficosConsultaCorralesWrap');
        if (host && wrap && wrap.parentNode !== host) {
            host.appendChild(wrap);
        }
        if (wrap) {
            wrap.classList.remove('hidden');
        }
    }

    function tempConOpenListadoChartsModal() {
        const modal = el('temp-dl-modal-charts-listado');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('temp-dl-modal-charts-open');
    }

    function tempConCloseListadoChartsModal() {
        const modal = el('temp-dl-modal-charts-listado');
        const parking = el('temp-dl-charts-parking');
        const wrap = el('graficosConsultaCorralesWrap');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('temp-dl-modal-charts-open');
        if (wrap) {
            wrap.classList.add('hidden');
        }
        if (parking && wrap && wrap.parentNode !== parking) {
            parking.appendChild(wrap);
        }
    }

    function tempDlPorSexoHasData(por) {
        if (!por || typeof por !== 'object') return false;
        const sexos = Object.keys(por);
        for (let i = 0; i < sexos.length; i++) {
            const corr = por[sexos[i]];
            if (!corr || typeof corr !== 'object') continue;
            const keys = Object.keys(corr);
            for (let j = 0; j < keys.length; j++) {
                if (corr[keys[j]] && corr[keys[j]].length) return true;
            }
        }
        return false;
    }

    function renderTempConTable(data) {
        const tbody = el('temp-con-tbody-lista');
        const countEl = el('temp-con-table-count');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!data || !data.length) {
            if (countEl) countEl.textContent = '0 registro(s)';
            return;
        }
        const frag = document.createDocumentFragment();
        for (let i = 0; i < data.length; i++) {
            const r = data[i];
            if (!r) continue;
            const tr = document.createElement('tr');
            tr.className = (i % 2 === 0) ? 'bg-white' : 'bg-gray-50';
            let periodo = '';
            if (r.fechaDesde && r.fechaHasta && r.primeraLectura && r.ultimaLectura) {
                periodo = r.primeraLectura.substring(0, 10) + ' ~ ' + r.ultimaLectura.substring(0, 10);
            } else if (r.fechaDesde) {
                periodo = r.fechaDesde.substring(0, 10);
            } else if (r.fecha_inicio && r.fecha_fin) {
                periodo = r.fecha_inicio.substring(0, 10) + ' ~ ' + r.fecha_fin.substring(0, 10);
            }
            const nomGr = r.nomGranja || r.nom_granja || r.codGranja || '—';
            const campRaw = String(r.campania || '').trim();
            const galpRaw = tempDlGalponUtil(r.galpones_lista || r.codGalpon || '');
            const camp = campRaw || '—';
            const galp = galpRaw || '—';
            const numLect = r.total_lecturas || r.totalLecturas || 0;
            periodo += ' (' + numLect + ' lecturas)';
            const idCabVal = String(r.idCab || r.id || '');

            tr.innerHTML = '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-500">' + (i + 1) + '</td>'
                + '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">' + tempConEscHtml(nomGr) + '</td>'
                + '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap font-mono">' + tempConEscHtml(camp) + '</td>'
                + '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">' + tempConEscHtml(galp) + '</td>'
                + '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-600">' + tempConEscHtml(periodo) + '</td>'
                + '<td class="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">'
                + '<button type="button" class="temp-btn-con-ver inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200" '
                + 'data-id-cab="' + tempConEscAttr(idCabVal) + '" '
                + 'data-galpon="' + tempConEscAttr(galpRaw) + '">'
                + '<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Ver'
                + '</button>'
                + '</td>';
            frag.appendChild(tr);
        }
        tbody.appendChild(frag);
        if (countEl) countEl.textContent = data.length + ' registro(s)';
        tempConBindAcciones();
    }

    function cargarListaTempCon() {
        const meta = el('temp-con-meta');
        const g = (el('temp-con-granja-select') && el('temp-con-granja-select').value || '').trim();
        if (meta) meta.textContent = 'Cargando...';
        let params = 'action=list_groups';
        const tipoPer = (el('temp-con-periodo-tipo') && el('temp-con-periodo-tipo').value || '').trim();

        if (tipoPer === 'TODOS' || !tipoPer) {
            // sin filtro de fechas
        } else if (tipoPer === 'POR_FECHA') {
            const fu = (el('temp-con-fecha-unica') && el('temp-con-fecha-unica').value || '').trim();
            if (fu) { params += '&fechaInicio=' + encodeURIComponent(fu) + '&fechaFin=' + encodeURIComponent(fu); }
        } else if (tipoPer === 'ENTRE_FECHAS') {
            const fi = (el('temp-con-fecha-inicio') && el('temp-con-fecha-inicio').value || '').trim();
            const ff = (el('temp-con-fecha-fin') && el('temp-con-fecha-fin').value || '').trim();
            if (fi && ff) { params += '&fechaInicio=' + encodeURIComponent(fi) + '&fechaFin=' + encodeURIComponent(ff); }
        } else if (tipoPer === 'POR_MES') {
            const mu = (el('temp-con-mes-unico') && el('temp-con-mes-unico').value || '').trim();
            if (mu && /^\d{4}-\d{2}$/.test(mu)) {
                params += '&fechaInicio=' + encodeURIComponent(mu + '-01');
                const ud = new Date(parseInt(mu.substring(0, 4), 10), parseInt(mu.substring(5, 7), 10), 0).getDate();
                params += '&fechaFin=' + encodeURIComponent(mu + '-' + String(ud).padStart(2, '0'));
            }
        } else {
            // ENTRE_MESES
            const mi = (el('temp-con-mes-inicio') && el('temp-con-mes-inicio').value || '').trim();
            const mf = (el('temp-con-mes-fin') && el('temp-con-mes-fin').value || '').trim();
            if (mi && /^\d{4}-\d{2}$/.test(mi)) { params += '&fechaInicio=' + encodeURIComponent(mi + '-01'); }
            if (mf && /^\d{4}-\d{2}$/.test(mf)) {
                const udf = new Date(parseInt(mf.substring(0, 4), 10), parseInt(mf.substring(5, 7), 10), 0).getDate();
                params += '&fechaFin=' + encodeURIComponent(mf + '-' + String(udf).padStart(2, '0'));
            }
        }
        if (g) params += '&granja=' + encodeURIComponent(g);

        fetch(API + '?' + params, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.success) {
                    if (meta) meta.textContent = d.message || 'Error al cargar';
                    renderTempConTable([]);
                    return;
                }
                if (meta) meta.textContent = '';
                renderTempConTable(d.data || []);
            })
            .catch(function () {
                if (meta) meta.textContent = 'Error de red.';
                renderTempConTable([]);
            });
    }

    function tempConBindAcciones() {
        const tbody = el('temp-con-tbody-lista');
        if (!tbody) return;
        const verBtns = tbody.querySelectorAll('.temp-btn-con-ver');
        verBtns.forEach(function (btn) {
            if (btn._bound) return;
            btn._bound = true;
            btn.addEventListener('click', function () {
                const idCab = btn.getAttribute('data-id-cab') || '';
                const galpon = tempDlGalponUtil(btn.getAttribute('data-galpon') || '');
                tempConVerGrafica(idCab, galpon);
            });
        });
    }

    function tempConVerGrafica(idCab, galponHint) {
        if (!idCab) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'warning', title: 'Consulta', text: 'Faltan datos para cargar la gráfica.' });
            }
            return Promise.reject(new Error('Faltan datos'));
        }
        galponHint = tempDlGalponUtil(galponHint);
        const statusEl = el('temp-con-meta');
        if (statusEl) statusEl.textContent = 'Cargando gráfica...';
        tempConMountChartsToListadoModal();
        tempConOpenListadoChartsModal();
        const fd = new FormData();
        fd.append('action', 'consulta_datos');
        fd.append('idCab', idCab);
        fd.append('tipo', 'AMBOS');
        fd.append('grupo', '1');
        return fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' })
            .then(function (r) {
                return r.text().then(function (t) {
                    return tempConSafeParseJson(t);
                });
            })
            .then(function (d) {
                if (!d.success) {
                    if (statusEl) statusEl.textContent = d.message || 'Error';
                    throw new Error(d.message || 'Error al cargar gráfica');
                }
                if (statusEl) statusEl.textContent = '';
                const porTemp = d.porSexoCorralTemp || d.porSexoCorral || null;
                const porHum = d.porSexoCorralHum || null;
                const chartMeta = d.meta || {};
                if (!tempDlGalponUtil(chartMeta.codGalpon) && galponHint) {
                    chartMeta.codGalpon = galponHint;
                }
                const hasSlots = tempDlPorSexoHasData(porTemp) || tempDlPorSexoHasData(porHum);
                if (hasSlots && window.TempDlCharts && typeof window.TempDlCharts.actualizarGraficosConsultaPorSexoCorral === 'function') {
                    window.TempDlCharts.actualizarGraficosConsultaPorSexoCorral(porTemp, porHum, chartMeta, true);
                    if (typeof window.TempDlCharts.actualizarTablasDetalleConsultaSeries === 'function') {
                        window.TempDlCharts.actualizarTablasDetalleConsultaSeries(!!d.hasCampaniaDet);
                    }
                } else if (window.TempDlCharts && typeof window.TempDlCharts.actualizarGraficosConsultaPorSexoCorral === 'function') {
                    window.TempDlCharts.actualizarGraficosConsultaPorSexoCorral(porTemp, porHum, chartMeta, true);
                }
                return d;
            })
            .catch(function (err) {
                if (statusEl) statusEl.textContent = (err && err.message) ? err.message : 'Error de red.';
                throw err;
            });
    }

    function tempConActualizarVisibilidadPeriodo() {
        const t = (el('temp-con-periodo-tipo') || {}).value || 'ENTRE_MESES';
        ['temp-con-field-fecha-unica', 'temp-con-field-entre-fechas', 'temp-con-field-mes-unico', 'temp-con-field-entre-meses'].forEach(function (id) {
            const e = el(id);
            if (e) e.classList.add('hc-hidden');
        });
        if (t === 'POR_FECHA') { const e = el('temp-con-field-fecha-unica'); if (e) e.classList.remove('hc-hidden'); }
        else if (t === 'ENTRE_FECHAS') { const e = el('temp-con-field-entre-fechas'); if (e) e.classList.remove('hc-hidden'); }
        else if (t === 'POR_MES') { const e = el('temp-con-field-mes-unico'); if (e) e.classList.remove('hc-hidden'); }
        else if (t === 'ENTRE_MESES') { const e = el('temp-con-field-entre-meses'); if (e) e.classList.remove('hc-hidden'); }
    }

    function tempConCargarGranjasSelect() {
        const sel = el('temp-con-granja-select');
        if (!sel) return;
        fetch(API + '?action=granjas', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d.success || !d.data) return;
                sel.innerHTML = '<option value="">Todas</option>';
                const porZona = {};
                d.data.forEach(function (g) {
                    const z = g.zona || 'Sin zona';
                    if (!porZona[z]) porZona[z] = [];
                    porZona[z].push(g);
                });
                const zonas = Object.keys(porZona).sort();
                zonas.forEach(function (zona) {
                    const grp = document.createElement('optgroup');
                    grp.label = zona;
                    porZona[zona].sort(function (a, b) {
                        return (a.nomGranja || a.codGranja || '').localeCompare(b.nomGranja || b.codGranja || '');
                    }).forEach(function (g) {
                        const opt = document.createElement('option');
                        opt.value = g.codGranja || g.codigo || '';
                        opt.textContent = (g.codGranja || g.codigo || '') + ' - ' + (g.nomGranja || g.nombre || g.codGranja || '');
                        grp.appendChild(opt);
                    });
                    sel.appendChild(grp);
                });
            })
            .catch(function () {});
    }

    function downloadChartExcel() {
        return new Promise(function (resolve, reject) {
            if (typeof XLSX === 'undefined') {
                reject(new Error('Librería XLSX no cargada.'));
                return;
            }
            if (!lastChartPorSexoCorralTemp && !lastChartPorSexoCorralHum) {
                reject(new Error('Abra primero la gráfica de un registro para exportar.'));
                return;
            }
            const wb = XLSX.utils.book_new();
            const meta = lastChartMeta || {};

            CONSULTA_SLOTS_SEXO_CORRAL.forEach(function (slot, s) {
                const merged = tempMergeRowsByDt(consultaSeriesRowsRef[s] || [], consultaSeriesRowsHumRef[s] || []);
                if (!merged.length) return;
                const aoa = [
                    ['Granja:', meta.nomGranja || meta.codGranja || '—'],
                    ['Campaña:', meta.campania || '—'],
                    ['Galpón:', meta.codGalpon || '—'],
                    ['Serie / Corral:', slot.etiquetaCorta],
                    [],
                    ['Fecha', 'Hora', 'Campaña', 'Temperatura (°C)', 'Humedad (%)']
                ];
                merged.forEach(function (r) {
                    aoa.push([
                        formatDateDdMmYyyy(r.fecha_hora),
                        formatTimeHmFromMysql(r.fecha_hora),
                        r.campania || '',
                        r.valorTemp != null ? Number(r.valorTemp) : '',
                        r.valorHum != null ? Number(r.valorHum) : ''
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(aoa);
                const sheetName = slot.etiquetaCorta.replace(/[:\\/?*\[\]]/g, '').slice(0, 31);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });

            const filename = 'Datalogger_' + (meta.codGranja || 'export') + '_C' + (meta.campania || '') + '.xlsx';
            XLSX.writeFile(wb, filename);
            resolve();
        });
    }

    // Exponer interfaces globales como en Sanidad
    window.TempDlCharts = {
        destruirGraficosCorral: destruirGraficosCorral,
        actualizarGraficosConsultaPorSexoCorral: actualizarGraficosConsultaPorSexoCorral,
        actualizarTablasDetalleConsultaSeries: actualizarTablasDetalleConsultaSeries
    };

    window.TempDlGmc = {
        cargarListaTempCon: cargarListaTempCon,
        tempConVerGrafica: tempConVerGrafica,
        actualizarVisibilidadPeriodo: tempConActualizarVisibilidadPeriodo,
        cargarGranjasSelect: tempConCargarGranjasSelect,
        downloadChartExcel: downloadChartExcel
    };

    // Inicialización del DOM
    $(document).ready(function () {
        tempBindZoomGraficosConsulta();

        // Modales en el body
        const elZoom = el('modalGraficoTempZoom');
        if (elZoom && elZoom.parentNode) document.body.appendChild(elZoom);
        const elList = el('temp-dl-modal-charts-listado');
        if (elList && elList.parentNode) document.body.appendChild(elList);

        // Periodo y granjas
        tempConActualizarVisibilidadPeriodo();
        tempConCargarGranjasSelect();

        const tempPeriodoTipo = el('temp-con-periodo-tipo');
        if (tempPeriodoTipo) {
            tempPeriodoTipo.addEventListener('change', tempConActualizarVisibilidadPeriodo);
        }

        // Botón Filtrar
        $('#btnConsultaFiltrarTemp').on('click', function () {
            cargarListaTempCon();
        });

        // Checkboxes métricas
        $('#chkConsultaTemperatura, #chkConsultaHumedad').on('change', function () {
            if (lastChartPorSexoCorralTemp || lastChartPorSexoCorralHum) {
                actualizarGraficosConsultaPorSexoCorral(lastChartPorSexoCorralTemp, lastChartPorSexoCorralHum, lastChartMeta);
            }
        });

        // Cerrar modal zoom
        const btnCerrGraf = el('btnCerrarModalGraficoTemp');
        if (btnCerrGraf) btnCerrGraf.addEventListener('click', tempCerrarModalGraficoZoom);
        const bdGraf = el('tempGrafModalBackdrop');
        if (bdGraf) bdGraf.addEventListener('click', tempCerrarModalGraficoZoom);

        // Cerrar modal listado
        const btnListadoChartsClose = el('temp-dl-modal-charts-listado-close');
        if (btnListadoChartsClose) {
            btnListadoChartsClose.addEventListener('click', tempConCloseListadoChartsModal);
        }
        const modalListadoCharts = el('temp-dl-modal-charts-listado');
        if (modalListadoCharts) {
            modalListadoCharts.addEventListener('click', function (ev) {
                if (ev.target === modalListadoCharts) tempConCloseListadoChartsModal();
            });
        }

        document.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            const mz = el('modalGraficoTempZoom');
            if (mz && !mz.classList.contains('hidden')) tempCerrarModalGraficoZoom();
            const ml = el('temp-dl-modal-charts-listado');
            if (ml && !ml.classList.contains('hidden')) tempConCloseListadoChartsModal();
        });

        // Carga inicial de la lista
        cargarListaTempCon();
    });

})();