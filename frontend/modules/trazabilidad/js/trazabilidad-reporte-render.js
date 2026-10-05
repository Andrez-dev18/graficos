/**
 * Reporte tabular de resultados — pestañas 3 y 4 trazabilidad (CoreBI).
 */
(function (global) {
    'use strict';

    var VACIO = '-----';
    var COMPACT_AUTO_MIN = 5;

    var DOM_REPORTE = {
        wrapId: 'trz-reporte-table-wrap',
        tituloId: 'trz-reporte-titulo',
        toolbarId: 'trz-reporte-toolbar',
        metaId: 'trz-reporte-meta',
        compactChkId: 'trz-reporte-compact',
        spinnerId: 'trz-spinner-reporte',
        showCompactToggle: true
    };

    var DOM_ENFERMEDADES = {
        wrapId: 'trz-enfermedades-table-wrap',
        tituloId: 'trz-enfermedades-titulo',
        toolbarId: 'trz-enfermedades-toolbar',
        metaId: 'trz-enfermedades-meta',
        compactChkId: '',
        spinnerId: 'trz-spinner-enfermedades',
        showCompactToggle: false
    };

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function esPositivo(val) {
        return String(val || '').trim().toUpperCase() === 'POSITIVO';
    }

    function isCompacto(dom) {
        if (!dom.showCompactToggle || !dom.compactChkId) return false;
        var chk = document.getElementById(dom.compactChkId);
        return chk ? chk.checked : true;
    }

    var MAX_COL_FIJA = 4;

    function celdaFija(texto, col) {
        var sticky = col <= MAX_COL_FIJA ? ' trz-reporte-td-fijo trz-reporte-col-' + col : '';
        return '<td class="trz-reporte-td' + sticky + '">' + esc(texto) + '</td>';
    }

    function thFijo(label, col, title) {
        var tip = title ? ' title="' + esc(title) + '"' : '';
        if (col <= MAX_COL_FIJA) {
            return '<th class="trz-reporte-th-fijo trz-reporte-col-' + col + '"' + tip + '>' + label + '</th>';
        }
        return '<th' + tip + '>' + label + '</th>';
    }

    function celdaResultado(val) {
        if (!val || String(val).trim() === '') {
            return '<td class="trz-reporte-td trz-reporte-td-anal trz-reporte-vacio">' + VACIO + '</td>';
        }
        var cls = esPositivo(val) ? ' trz-reporte-positivo' : '';

        return '<td class="trz-reporte-td trz-reporte-td-anal' + cls + '">' + esc(val) + '</td>';
    }

    function updateToolbar(dom, columnas, filas, compactUserSet) {
        var toolbar = document.getElementById(dom.toolbarId);
        var meta = document.getElementById(dom.metaId);
        var chk = dom.compactChkId ? document.getElementById(dom.compactChkId) : null;

        if (!toolbar || !meta) return;

        if (!filas.length) {
            toolbar.classList.add('hc-hidden');
            return;
        }

        toolbar.classList.remove('hc-hidden');
        var nAnal = columnas.length;
        meta.textContent = filas.length + ' muestras · ' + nAnal + ' análisis';

        if (dom.showCompactToggle && chk && compactUserSet !== true) {
            chk.checked = nAnal >= COMPACT_AUTO_MIN;
        }
    }

    function trzClearReporteStickyBars() {
        document.querySelectorAll('.trz-reporte-viewport-sticky-bar').forEach(function (el) {
            try { el.remove(); } catch (e) {}
        });
        document.querySelectorAll('.trz-reporte-table thead.trz-reporte-thead-is-stuck').forEach(function (th) {
            th.classList.remove('trz-reporte-thead-is-stuck');
        });
        document.querySelectorAll('.trz-reporte-table-scroll').forEach(function (wrap) {
            wrap._trzStickyBound = false;
            wrap._trzStickyBar = null;
            wrap._trzStickyUpdate = null;
        });
    }

    function trzBindReporteStickyThead(wrap) {
        if (!wrap || wrap._trzStickyBound) return;
        var table = wrap.querySelector('table.trz-reporte-table');
        if (!table) return;
        var thead = table.querySelector('thead');
        if (!thead) return;
        wrap._trzStickyBound = true;

        var bar = document.createElement('div');
        bar.className = 'trz-reporte-viewport-sticky-bar';
        bar.setAttribute('aria-hidden', 'true');
        var barScroll = document.createElement('div');
        barScroll.className = 'trz-reporte-viewport-sticky-bar-scroll';
        var cloneTable = document.createElement('table');
        cloneTable.className = table.className + ' trz-reporte-viewport-sticky-clone';
        cloneTable.appendChild(thead.cloneNode(true));
        barScroll.appendChild(cloneTable);
        bar.appendChild(barScroll);
        document.body.appendChild(bar);
        wrap._trzStickyBar = bar;

        var stickTop = 0;
        var syncingScroll = false;

        function syncColWidths() {
            cloneTable.style.width = table.offsetWidth + 'px';
            var srcRows = thead.rows;
            var dstRows = cloneTable.tHead ? cloneTable.tHead.rows : cloneTable.querySelectorAll('tr');
            for (var r = 0; r < srcRows.length; r++) {
                var sCells = srcRows[r].cells;
                var dCells = dstRows[r] ? dstRows[r].cells : null;
                if (!dCells) continue;
                for (var c = 0; c < sCells.length && c < dCells.length; c++) {
                    var w = sCells[c].getBoundingClientRect().width;
                    if (w > 0) {
                        dCells[c].style.width = w + 'px';
                        dCells[c].style.minWidth = w + 'px';
                        dCells[c].style.maxWidth = w + 'px';
                    }
                }
            }
        }

        function syncBarScroll() {
            if (syncingScroll) return;
            syncingScroll = true;
            barScroll.scrollLeft = wrap.scrollLeft || 0;
            syncingScroll = false;
        }

        function update() {
            if (!document.body.contains(wrap) || !document.body.contains(table)) {
                try { bar.remove(); } catch (eB) {}
                return;
            }
            var wrapRect = wrap.getBoundingClientRect();
            var theadRect = thead.getBoundingClientRect();
            var tableRect = table.getBoundingClientRect();
            var headH = thead.offsetHeight || theadRect.height || 0;
            var should = theadRect.top <= stickTop
                && tableRect.bottom > (stickTop + headH + 4)
                && wrapRect.bottom > (stickTop + 24)
                && wrapRect.top < (window.innerHeight - 40);
            if (!should) {
                bar.classList.remove('is-active');
                thead.classList.remove('trz-reporte-thead-is-stuck');
                return;
            }
            syncColWidths();
            bar.style.top = stickTop + 'px';
            bar.style.left = Math.max(0, wrapRect.left) + 'px';
            bar.style.width = Math.max(0, wrapRect.width) + 'px';
            if (headH > 0) bar.style.height = headH + 'px';
            thead.classList.add('trz-reporte-thead-is-stuck');
            bar.classList.add('is-active');
            syncBarScroll();
        }

        wrap._trzStickyUpdate = update;
        wrap.addEventListener('scroll', syncBarScroll, { passive: true });
        barScroll.addEventListener('scroll', function () {
            if (syncingScroll) return;
            syncingScroll = true;
            wrap.scrollLeft = barScroll.scrollLeft || 0;
            syncingScroll = false;
        }, { passive: true });
        update();
    }

    if (!global._trzReporteStickyWinBound) {
        global._trzReporteStickyWinBound = true;
        window.addEventListener('scroll', function () {
            document.querySelectorAll('.trz-reporte-table-scroll').forEach(function (wrap) {
                if (wrap._trzStickyUpdate) wrap._trzStickyUpdate();
            });
        }, { passive: true });
        window.addEventListener('resize', function () {
            document.querySelectorAll('.trz-reporte-table-scroll').forEach(function (wrap) {
                if (wrap._trzStickyUpdate) wrap._trzStickyUpdate();
            });
        }, { passive: true });
    }

    function renderTabla(data, dom, compactUserSet) {
        var wrap = document.getElementById(dom.wrapId);
        var titulo = document.getElementById(dom.tituloId);
        if (!wrap) return;

        trzClearReporteStickyBars();
        wrap.classList.add('trz-reporte-table-scroll');

        if (titulo) {
            titulo.textContent = (data && data.titulo) ? data.titulo : '';
        }

        var columnas = (data && data.columnas) ? data.columnas : [];
        var filas = (data && data.filas) ? data.filas : [];

        updateToolbar(dom, columnas, filas, compactUserSet);

        if (!filas.length) {
            wrap.innerHTML = '<p class="trz-reporte-empty">No hay resultados para los filtros seleccionados.</p>';
            return;
        }

        var compacto = isCompacto(dom);
        var tableCls = 'trz-reporte-table' + (compacto ? ' trz-reporte-compact' : '');

        var headFijos = ''
            + thFijo('N°', 1)
            + thFijo('Fec sol muestra', 2, 'Fecha de solicitud de muestra')
            + thFijo('Fec reg. resultado', 3, 'Fecha de registro del resultado')
            + thFijo('Código', 4)
            + thFijo('Cód. envío', 5)
            + thFijo('Pos. solic.', 6)
            + thFijo('Muestra', 7)
            + thFijo('Granja', 8)
            + thFijo('Galpón', 9)
            + thFijo('Edad', 10);

        var headAnal = columnas.map(function (c) {
            var tip = esc(c.nom || c.abrev || '');
            var lbl = esc(c.abrev || c.nom || '');
            if (compacto) {
                return '<th class="trz-reporte-th-anal" title="' + tip + '"><span>' + lbl + '</span></th>';
            }
            return '<th class="trz-reporte-th-anal" title="' + tip + '">' + lbl + '</th>';
        }).join('');

        var body = filas.map(function (f, idx) {
            var zebra = idx % 2 === 1 ? ' trz-reporte-row-alt' : '';
            if (f.nota) {
                return '<tr class="trz-reporte-row' + zebra + '">'
                    + celdaFija(f.n, 1)
                    + celdaFija(f.fechaPedido, 2)
                    + celdaFija(f.fechaIngreso, 3)
                    + celdaFija(f.codigo, 4)
                    + celdaFija(f.codEnvio, 5)
                    + celdaFija(f.posSolicitud, 6)
                    + celdaFija(f.muestra, 7)
                    + celdaFija(f.granja, 8)
                    + celdaFija(f.galpon, 9)
                    + celdaFija(f.edad, 10)
                    + '<td class="trz-reporte-td trz-reporte-nota" colspan="' + columnas.length + '"><strong>' + esc(f.nota) + '</strong></td>'
                    + '</tr>';
            }

            var resCells = columnas.map(function (c) {
                var val = (f.resultados && f.resultados[c.cod] !== undefined) ? f.resultados[c.cod] : '';
                return celdaResultado(val);
            }).join('');

            return '<tr class="trz-reporte-row' + zebra + '">'
                + celdaFija(f.n, 1)
                + celdaFija(f.fechaPedido, 2)
                + celdaFija(f.fechaIngreso, 3)
                + celdaFija(f.codigo, 4)
                + celdaFija(f.codEnvio, 5)
                + celdaFija(f.posSolicitud, 6)
                + celdaFija(f.muestra, 7)
                + celdaFija(f.granja, 8)
                + celdaFija(f.galpon, 9)
                + celdaFija(f.edad, 10)
                + resCells
                + '</tr>';
        }).join('');

        wrap.innerHTML = '<table class="' + tableCls + '">'
            + '<thead><tr>' + headFijos + headAnal + '</tr></thead>'
            + '<tbody>' + body + '</tbody>'
            + '</table>';

        trzBindReporteStickyThead(wrap);
    }

    function toggleResumenVisible(show) {
        var card = document.getElementById('trz-resumen-card');
        if (card) card.style.display = show ? '' : 'none';
    }

    function setSpinner(dom, show) {
        var sp = document.getElementById(dom.spinnerId);
        if (sp) sp.classList.toggle('hc-hidden', !show);
    }

    function bindCompactToggle() {
        var chk = document.getElementById('trz-reporte-compact');
        if (!chk || chk._trzBound) return;
        chk._trzBound = true;
        chk.addEventListener('change', function () {
            global.trzReporteCompactoUserSet = true;
            if (global.trzDataReporte) renderTabla(global.trzDataReporte, DOM_REPORTE, global.trzReporteCompactoUserSet);
        });
    }

    function appendAnalisisParams(params) {
        var sel = global.trzSelectedReport;
        if (sel === null || sel === undefined) {
            return params;
        }
        if (sel.length === 0) {
            params.analisis = [];
        } else {
            params['analisis[]'] = sel.slice();
        }
        return params;
    }

    function buildParams() {
        if (typeof global.trzGetOrigenParams !== 'function') return null;
        var params = global.trzGetOrigenParams();
        var rango = global.trzGetRangoTab1 ? global.trzGetRangoTab1() : null;
        if (rango) {
            params.fechaInicio = rango.desde;
            params.fechaFin = rango.hasta;
        }
        if (global.trzTipoMuestraActual) {
            params.tipoMuestra = global.trzTipoMuestraActual;
        }
        return appendAnalisisParams(params);
    }

    global.trzReporteInit = function () {
        global.trzTab3Loaded = false;
        global.trzTab4Loaded = false;
        global.trzDataReporte = null;
        global.trzDataEnfermedades = null;
        global.trzReporteCompactoUserSet = false;
        bindCompactToggle();
    };

    global.trzCargarReporte = function () {
        var params = buildParams();
        if (!params) return;

        bindCompactToggle();
        setSpinner(DOM_REPORTE, true);
        $.post('../../backend/trazabilidad/reporte-resultados', params, function (resp) {
            global.trzDataReporte = resp;
            global.trzTab3Loaded = true;
            global.trzReporteCompactoUserSet = false;
            renderTabla(resp, DOM_REPORTE, false);
            setSpinner(DOM_REPORTE, false);
        }, 'json').fail(function () {
            setSpinner(DOM_REPORTE, false);
            renderTabla(null, DOM_REPORTE, false);
            var wrap = document.getElementById('trz-reporte-table-wrap');
            if (wrap) wrap.innerHTML = '<p class="trz-reporte-empty">Error al cargar el reporte.</p>';
        });
    };

    global.trzCargarReporteEnfermedades = function () {
        var params = buildParams();
        if (!params) return;

        setSpinner(DOM_ENFERMEDADES, true);
        $.post('../../backend/trazabilidad/reporte-enfermedades', params, function (resp) {
            global.trzDataEnfermedades = resp;
            global.trzTab4Loaded = true;
            renderTabla(resp, DOM_ENFERMEDADES, true);
            setSpinner(DOM_ENFERMEDADES, false);
        }, 'json').fail(function () {
            setSpinner(DOM_ENFERMEDADES, false);
            renderTabla(null, DOM_ENFERMEDADES, true);
            var wrap = document.getElementById('trz-enfermedades-table-wrap');
            if (wrap) wrap.innerHTML = '<p class="trz-reporte-empty">Error al cargar el reporte.</p>';
        });
    };

    global.trzOnTabReporte = function () {
        global.trzActiveTab = 3;
        if (typeof global.trzActualizarLabelAnalisisGlobal === 'function') {
            global.trzActualizarLabelAnalisisGlobal();
        }
        toggleResumenVisible(false);
        bindCompactToggle();
        if (!global.trzTab3Loaded) {
            global.trzCargarReporte();
        }
    };

    global.trzOnTabEnfermedades = function () {
        global.trzActiveTab = 4;
        if (typeof global.trzActualizarLabelAnalisisGlobal === 'function') {
            global.trzActualizarLabelAnalisisGlobal();
        }
        toggleResumenVisible(false);
        if (!global.trzTab4Loaded) {
            global.trzCargarReporteEnfermedades();
        }
    };

    global.trzOnTabGraficos = function () {
        toggleResumenVisible(true);
    };

    bindCompactToggle();

})(window);
