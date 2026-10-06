/* Interconsultas: variación porcentual y proyección de pesaje (proxy Sanidad) */
window.IC_PCT = (function () {
    var TIPOS_PCT = ['mortalidad', 'consumo_alimento', 'consumo_gas', 'consumo_agua', 'pesaje_pollo', 'ganancia_peso'];
    var TIPO_PROY = 'pesaje_pollo';
    var chartsPct = {};
    var proyAplicada = {};

    function soportaPct(tipo) {
        return TIPOS_PCT.indexOf(String(tipo)) !== -1;
    }

    function soportaProy(tipo) {
        return String(tipo) === TIPO_PROY;
    }

    function sexoParam(valor) {
        if (valor === 'macho') {
            return 'm';
        }
        if (valor === 'hembra') {
            return 'h';
        }

        return 'ambos';
    }

    function paramsDe(item) {
        return new URLSearchParams({
            tipo: item.tipo,
            granja: item.granja,
            campania: item.campania,
            galpon: item.galpon,
            seccion: item.tipo === 'mortalidad' ? 'all' : 'linea',
            sexo: sexoParam(item.sexoActiva)
        });
    }

    function wrapperPct(item) {
        var card = document.getElementById(item.idCard);

        return card ? card.querySelector('.chart-pct-wrapper') : null;
    }

    function limpiarPct(item) {
        var id = item.canvasId + '-pct';
        if (chartsPct[id]) {
            chartsPct[id].destroy();
            delete chartsPct[id];
        }
    }

    function pctDeFila(fila, clave) {
        var nodo = fila ? fila[clave] : null;

        return nodo && typeof nodo.pct === 'number' ? nodo.pct : null;
    }

    function seriePct(filas, clave, color, spanGaps) {
        if (!filas.some(function (fila) { return pctDeFila(fila, clave) !== null; })) {
            return null;
        }

        return {
            label: clave === 'macho' ? 'Macho' : 'Hembra',
            data: filas.map(function (fila) { return pctDeFila(fila, clave); }),
            borderColor: color,
            backgroundColor: color,
            borderWidth: 1.8,
            pointRadius: 2.5,
            tension: 0.25,
            spanGaps: spanGaps
        };
    }

    async function pintarPct(item) {
        var wrapper = wrapperPct(item);
        var chk = document.querySelector('.chk-pct-interconsulta[data-chart="' + item.canvasId + '"]');
        if (!wrapper) {
            return;
        }
        if (!chk || !chk.checked) {
            wrapper.classList.add('hidden');
            limpiarPct(item);

            return;
        }

        try {
            var res = await fetch('../../backend/interconsulta/grafica-pct?' + paramsDe(item).toString());
            var datos = await res.json();
            var filas = datos && datos.dataPorDia;
            if (!datos || datos.soporta === false || !Array.isArray(filas) || filas.length === 0) {
                wrapper.classList.add('hidden');
                limpiarPct(item);

                return;
            }

            var spanGaps = Boolean(datos.spanGaps);
            var datasets = [
                seriePct(filas, 'macho', '#2563eb', spanGaps),
                seriePct(filas, 'hembra', '#db2777', spanGaps)
            ].filter(function (serie) { return serie !== null; });

            var canvas = document.getElementById(item.canvasId + '-pct');
            if (datasets.length === 0 || !canvas) {
                wrapper.classList.add('hidden');
                limpiarPct(item);

                return;
            }

            var labels = filas.map(function (fila) { return 'D' + fila.dia; });

            wrapper.classList.remove('hidden');
            limpiarPct(item);
            chartsPct[item.canvasId + '-pct'] = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 10 } } },
                        title: { display: true, text: 'Variación % vs estándar', font: { size: 11 } },
                        datalabels: { display: false }
                    },
                    scales: {
                        x: { ticks: { font: { size: 9 }, maxTicksLimit: 20, autoSkip: true } },
                        y: { beginAtZero: false, ticks: { font: { size: 9 } }, title: { display: true, text: '%', font: { size: 10 } } }
                    }
                }
            });
        } catch (e) {
            wrapper.classList.add('hidden');
            limpiarPct(item);
        }
    }

    function chartPrincipal(item) {
        if (typeof chartInstances === 'undefined') {
            return null;
        }

        return chartInstances[item.canvasId] || null;
    }

    function quitarProyeccion(item, chart) {
        if (!proyAplicada[item.canvasId]) {
            return;
        }

        chart.data.datasets = chart.data.datasets.filter(function (ds) { return !ds._proyeccion; });
        delete proyAplicada[item.canvasId];
        chart.update('none');
    }

    function posicionesPorDia(labels) {
        var pos = {};
        (labels || []).forEach(function (label, indice) {
            var numero = String(label).match(/(\d+)/);
            if (numero) {
                pos[String(parseInt(numero[1], 10))] = indice;
            }
        });

        return pos;
    }

    async function pintarProyeccion(item) {
        var chk = document.querySelector('.chk-proy-interconsulta[data-chart="' + item.canvasId + '"]');
        var chart = chartPrincipal(item);
        if (!chk || !chart) {
            return;
        }
        if (!chk.checked) {
            quitarProyeccion(item, chart);

            return;
        }

        try {
            var res = await fetch('../../backend/interconsulta/grafica-proyeccion?' + paramsDe(item).toString());
            var datos = await res.json();
            if (!datos || !datos.campaniaAbierta || !Array.isArray(datos.dataProyeccion)) {
                return;
            }

            var posiciones = posicionesPorDia(chart.data.labels);
            var total = (chart.data.labels || []).length;

            ['macho', 'hembra'].forEach(function (clave) {
                var datosSerie = new Array(total).fill(null);
                var hayDatos = false;
                datos.dataProyeccion.forEach(function (fila) {
                    var indice = posiciones[String(fila.dia)];
                    var nodo = fila[clave];
                    if (indice !== undefined && nodo && typeof nodo.valor === 'number') {
                        datosSerie[indice] = nodo.valor;
                        hayDatos = true;
                    }
                });

                if (!hayDatos) {
                    return;
                }

                chart.data.datasets.push({
                    label: 'Proyección ' + (clave === 'macho' ? 'Macho' : 'Hembra'),
                    data: datosSerie,
                    borderColor: clave === 'macho' ? '#2563eb' : '#db2777',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    spanGaps: true,
                    _proyeccion: true
                });
            });

            proyAplicada[item.canvasId] = true;
            chart.update('none');
        } catch (e) {
            return;
        }
    }

    function refrescar(item) {
        pintarPct(item);
        pintarProyeccion(item);
    }

    function aplicar(item) {
        if (!item || !item.canvasId) {
            return;
        }

        var chkPct = document.querySelector('.chk-pct-interconsulta[data-chart="' + item.canvasId + '"]');
        if (chkPct) {
            chkPct.addEventListener('change', function () { pintarPct(item); });
            pintarPct(item);
        }

        var chkProy = document.querySelector('.chk-proy-interconsulta[data-chart="' + item.canvasId + '"]');
        if (chkProy) {
            chkProy.addEventListener('change', function () { pintarProyeccion(item); });
        }

        var card = document.getElementById(item.idCard);
        if (card) {
            card.querySelectorAll('.select-sexo, .select-desde, .select-hasta, .select-grafico, .btn-vista').forEach(function (nodo) {
                nodo.addEventListener('click', function () {
                    setTimeout(function () { refrescar(item); }, 450);
                });
                nodo.addEventListener('change', function () {
                    setTimeout(function () { refrescar(item); }, 450);
                });
            });
        }
    }

    function limpiarTodo() {
        Object.keys(chartsPct).forEach(function (id) {
            chartsPct[id].destroy();
            delete chartsPct[id];
        });
        proyAplicada = {};
    }

    return {
        soportaPct: soportaPct,
        soportaProy: soportaProy,
        aplicar: aplicar,
        refrescar: refrescar,
        limpiarTodo: limpiarTodo
    };
})();
