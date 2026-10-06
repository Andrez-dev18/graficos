/* 4.1 Trazabilidad de resultados (vistas fieles al módulo de Sanidad) */
(function () {
    var cache = {};
    var activa = 'periodo';

    function datosSerie(serie) {
        return Array.isArray(serie.data) ? serie.data : [];
    }

    function datasetSerie(serie, indice, chartType, stacked) {
        var c = PA.color(indice);
        if (chartType === 'line') {
            return {
                label: serie.label,
                data: datosSerie(serie),
                borderColor: c,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.25,
                pointRadius: 2,
                pointHoverRadius: 5,
                spanGaps: true
            };
        }
        return {
            label: serie.label,
            data: datosSerie(serie),
            backgroundColor: c,
            borderColor: c,
            borderWidth: 0,
            borderRadius: 3,
            stack: stacked ? 'base' : undefined
        };
    }

    function tarjeta(indice, titulo) {
        return '<div class="pa-tarjeta p-4">'
            + '<div class="pa-tarjeta-titulo">' + PA.escapeHtml(titulo) + '</div>'
            + '<div class="pa-lienzo pa-lienzo--card"><canvas id="pa-tz-' + indice + '"></canvas></div>'
            + '</div>';
    }

    /* "Por análisis": una gráfica por análisis. "Porcentaje": una sola gráfica */
    function grupos(payload, vista) {
        if (vista === 'porcentaje') {
            return [{ titulo: 'Casos positivos (%)', series: payload.series || [], unico: (payload.labels || []) }];
        }
        return (payload.series || []).map(function (s) {
            return { titulo: s.label, series: [s] };
        });
    }

    function pintar(payload) {
        var contenedor = PA.el('pa-graficas');
        PA_CHARTS.limpiarTodo();
        contenedor.innerHTML = '';

        var vista = payload.seccion || activa;
        var chartType = payload.chartType === 'line' ? 'line' : 'bar';
        var stacked = payload.barMode === 'stacked';
        var t = PA_CHARTS.tema();
        var esPct = vista === 'porcentaje';
        var lista = grupos(payload, vista).slice(0, 60);

        lista.forEach(function (grupo, indice) {
            contenedor.insertAdjacentHTML('beforeend', tarjeta(indice, grupo.titulo));
            var etiquetas = grupo.unico || payload.labels || [];
            var datasets = grupo.series.map(function (s, i) {
                return datasetSerie(s, indice * 3 + i, chartType, stacked);
            });
            var config = {
                type: chartType,
                data: { labels: etiquetas, datasets: datasets },
                options: PA_CHARTS.opcionesBase({
                    plugins: {
                        legend: {
                            display: datasets.length > 1,
                            labels: { color: t.texto, usePointStyle: true, boxWidth: 9, boxHeight: 9, padding: 10, font: { size: 10 } }
                        },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: {
                            stacked: stacked,
                            ticks: { color: t.texto, maxRotation: 45, autoSkip: true, font: { size: 10 } },
                            grid: { color: t.grid, drawBorder: false }
                        },
                        y: {
                            stacked: stacked,
                            beginAtZero: true,
                            ticks: { color: t.texto, font: { size: 10 } },
                            grid: { color: t.grid, drawBorder: false },
                            title: { display: true, text: esPct ? 'Porcentaje (%)' : 'Casos', color: t.texto, font: { size: 10 } }
                        }
                    }
                })
            };
            PA_CHARTS.crear(PA.el('pa-tz-' + indice), config);
        });
    }

    function resumen(payload) {
        var partes = [];
        if (PA.periodoTexto()) {
            partes.push('Periodo: <strong>' + PA.escapeHtml(PA.periodoTexto()) + '</strong>');
        }
        if (payload.rango && payload.rango.inicio) {
            partes.push('Datos: <strong>' + PA.escapeHtml(payload.rango.inicio + ' a ' + payload.rango.fin) + '</strong>');
        }
        partes.push('Vista: <strong>' + PA.escapeHtml(activa) + '</strong>');
        PA.el('pa-resumen').innerHTML = partes.join('  ·  ');
    }

    async function cargar(vista, forzar) {
        activa = vista || activa;
        if (!forzar && cache[activa]) {
            pintar(cache[activa]);
            resumen(cache[activa]);
            return;
        }
        PA.aviso('pa-aviso', 'Consultando trazabilidad...');
        try {
            var payload = await PA.api('trazabilidad', Object.assign({ vista: activa }, PA.periodoParams()));
            if (!payload || payload.success === false) {
                PA_CHARTS.limpiarTodo();
                PA.el('pa-graficas').innerHTML = '<div class="pa-tarjeta pa-vacio">' + PA.escapeHtml((payload && payload.message) || 'Sin datos de trazabilidad para el periodo indicado.') + '</div>';
                PA.aviso('pa-aviso', '');
                PA.el('pa-resumen').textContent = '';
                return;
            }
            if (!payload.labels || payload.labels.length === 0 || !payload.series || payload.series.length === 0) {
                PA_CHARTS.limpiarTodo();
                PA.el('pa-graficas').innerHTML = '<div class="pa-tarjeta pa-vacio">Sin datos para los filtros indicados.</div>';
                PA.aviso('pa-aviso', '');
                resumen(payload);
                return;
            }
            cache[activa] = payload;
            PA.aviso('pa-aviso', '');
            pintar(payload);
            resumen(payload);
        } catch (e) {
            PA_CHARTS.limpiarTodo();
            PA.el('pa-graficas').innerHTML = '';
            PA.aviso('pa-aviso', e.message || 'No se pudo cargar la trazabilidad.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        PA.periodoInit({
            onChange: function () {
                cache = {};
            }
        });

        PA.el('pa-tabs').addEventListener('click', function (ev) {
            var boton = ev.target.closest('.pa-tab');
            if (!boton) {
                return;
            }
            Array.prototype.forEach.call(PA.el('pa-tabs').querySelectorAll('.pa-tab'), function (b) {
                b.classList.toggle('pa-tab--activo', b === boton);
            });
            cargar(boton.getAttribute('data-vista'));
        });

        PA.el('pa-aplicar').addEventListener('click', function () {
            cache = {};
            cargar(activa, true);
        });
        PA.el('pa-refrescar').addEventListener('click', function () {
            cache = {};
            cargar(activa, true);
        });

        cargar('periodo');
    });
})();
