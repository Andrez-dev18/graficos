/* 4.2 Dataloggers - Temperatura y humedad de transporte de pollo BB */
(function () {
    var canvasId = 'pa-chart';
    var catalogo = [];
    var granjasPintadas = false;

    function etiquetaGranja(item) {
        return item.nombre && item.nombre !== item.granja ? item.nombre + ' (' + item.granja + ')' : item.granja;
    }

    function granjaActual() {
        var codigo = PA.el('pa-granja').value;
        var encontrada = null;
        catalogo.forEach(function (item) {
            if (String(item.granja) === String(codigo)) {
                encontrada = item;
            }
        });
        return encontrada;
    }

    function refrescarCampanias() {
        var item = granjaActual();
        PA.setOpciones(
            PA.el('pa-campania'),
            item ? item.campanias : [],
            function (c) { return c; },
            function (c) { return c; },
            item ? 'Seleccione campaña' : 'Seleccione granja'
        );
    }

    function refrescarGalpones() {
        var item = granjaActual();
        PA.setOpciones(
            PA.el('pa-galpon'),
            item ? item.galpones : [],
            function (g) { return g; },
            function (g) { return g; },
            'Todos'
        );
    }

    function etiquetaTiempo(iso) {
        var s = String(iso || '');
        return s.length >= 16 ? s.substring(11, 16) + ' ' + s.substring(8, 10) + '/' + s.substring(5, 7) : s;
    }

    function marcasHitos(payload, puntos) {
        var tiempos = puntos.map(function (p) { return Date.parse(p.t); });
        return (payload.hitos || []).map(function (h) {
            var objetivo = Date.parse(h.t);
            if (isNaN(objetivo)) {
                return null;
            }
            var indice = -1;
            var menor = Infinity;
            tiempos.forEach(function (t, i) {
                var dif = Math.abs(t - objetivo);
                if (dif < menor) {
                    menor = dif;
                    indice = i;
                }
            });
            return indice < 0 ? null : { indice: indice, label: String(h.ciudad || '') };
        }).filter(Boolean);
    }

    function bandas(payload, tieneHumedad) {
        var lista = [];
        var temp = payload.series && payload.series[0] ? payload.series[0].estandar : null;
        var hum = payload.series && payload.series[1] ? payload.series[1].estandar : null;
        if (temp && (temp.min !== null || temp.max !== null)) {
            lista.push({ axis: 'y', min: temp.min, max: temp.max, color: 'rgba(16,185,129,0.10)', borde: 'rgba(16,185,129,0.45)' });
        }
        if (tieneHumedad && hum && (hum.min !== null || hum.max !== null)) {
            lista.push({ axis: 'y1', min: hum.min, max: hum.max, color: 'rgba(249,115,22,0.10)', borde: 'rgba(249,115,22,0.45)' });
        }
        return lista;
    }

    function pintar(payload) {
        var puntos = payload.puntos || [];
        var etiquetas = puntos.map(function (p) { return etiquetaTiempo(p.t); });
        var temperatura = puntos.map(function (p) { return p.temp; });
        var humedad = puntos.map(function (p) { return p.hum; });
        var tieneHumedad = humedad.some(function (v) { return v !== null && v !== undefined; });
        var t = PA_CHARTS.tema();

        function radioAlerta(campo) {
            return function (contexto) {
                var punto = puntos[contexto.dataIndex];
                if (!punto) {
                    return 0;
                }
                var cumple = campo === 'hum' ? punto.cumpleHum : punto.cumpleTemp;
                return cumple === false ? 2.5 : 0;
            };
        }

        var datasets = [{
            label: 'Temperatura (°C)',
            data: temperatura,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.10)',
            borderWidth: 1.6,
            pointRadius: radioAlerta('temp'),
            pointBackgroundColor: '#dc2626',
            pointHoverRadius: 5,
            tension: 0.25,
            spanGaps: true,
            yAxisID: 'y'
        }];

        if (tieneHumedad) {
            datasets.push({
                label: 'Humedad (%)',
                data: humedad,
                borderColor: '#f97316',
                backgroundColor: 'rgba(249,115,22,0.10)',
                borderWidth: 1.4,
                pointRadius: radioAlerta('hum'),
                pointBackgroundColor: '#dc2626',
                pointHoverRadius: 5,
                tension: 0.25,
                spanGaps: true,
                yAxisID: 'y1'
            });
        }

        var escalas = {
            x: {
                ticks: { color: t.texto, maxRotation: 0, autoSkip: true, maxTicksLimit: 14, font: { size: 10 } },
                grid: { color: t.grid, drawBorder: false }
            },
            y: {
                position: 'left',
                ticks: { color: t.texto, font: { size: 10 } },
                grid: { color: t.grid, drawBorder: false },
                title: { display: true, text: 'Temperatura (°C)', color: t.texto, font: { size: 11 } }
            }
        };

        if (tieneHumedad) {
            escalas.y1 = {
                position: 'right',
                beginAtZero: true,
                ticks: { color: t.texto, font: { size: 10 } },
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Humedad (%)', color: t.texto, font: { size: 11 } }
            };
        }

        PA_CHARTS.crear(PA.el(canvasId), {
            type: 'line',
            plugins: [PA_CHARTS.bandaEstandar, PA_CHARTS.hitos],
            data: { labels: etiquetas, datasets: datasets },
            options: PA_CHARTS.opcionesBase({
                plugins: {
                    paBand: { bandas: bandas(payload, tieneHumedad) },
                    paHitos: { marcas: marcasHitos(payload, puntos) },
                    legend: {
                        labels: { color: t.texto, usePointStyle: true, boxWidth: 9, boxHeight: 9, padding: 12, font: { size: 11 } }
                    }
                },
                scales: escalas
            })
        });
    }

    function pintarMeta(payload) {
        var partes = [];
        if (payload.placa) partes.push('Placa: <strong>' + PA.escapeHtml(payload.placa) + '</strong>');
        if (payload.empTransporte) partes.push('Empresa: <strong>' + PA.escapeHtml(payload.empTransporte) + '</strong>');
        if (payload.fechaInicio) partes.push('Desde <strong>' + PA.escapeHtml(payload.fechaInicio) + '</strong>');
        if (payload.fechaFin) partes.push('hasta <strong>' + PA.escapeHtml(payload.fechaFin) + '</strong>');
        if (payload.rawCount) partes.push('<strong>' + PA.escapeHtml(payload.rawCount) + '</strong> lecturas');
        PA.el('pa-meta').innerHTML = partes.join('  ·  ');
    }

    function pintarHitos(payload) {
        var lista = payload.hitos || [];
        if (lista.length === 0) {
            PA.el('pa-hitos').innerHTML = '';
            return;
        }
        PA.el('pa-hitos').innerHTML = lista.map(function (h) {
            var detalle = [];
            if (h.tempRec !== null && h.tempRec !== undefined) detalle.push(h.tempRec + ' °C');
            if (h.humRec !== null && h.humRec !== undefined) detalle.push(h.humRec + ' %');
            return '<span class="pa-chip"><strong>' + PA.escapeHtml(h.ciudad || '') + '</strong> '
                + PA.escapeHtml(String(h.hora || '')) + (detalle.length ? ' · ' + PA.escapeHtml(detalle.join(' / ')) : '') + '</span>';
        }).join('');
    }

    async function cargar() {
        PA.aviso('pa-aviso', '');
        var granja = PA.el('pa-granja').value;
        var campania = PA.el('pa-campania').value;
        if (granja === '') {
            PA_CHARTS.limpiar(PA.el(canvasId));
            PA.el('pa-meta').innerHTML = '';
            PA.el('pa-hitos').innerHTML = '';
            PA.aviso('pa-aviso', 'Seleccione una granja.');
            return;
        }
        if (campania === '') {
            PA_CHARTS.limpiar(PA.el(canvasId));
            PA.el('pa-meta').innerHTML = '';
            PA.el('pa-hitos').innerHTML = '';
            PA.aviso('pa-aviso', 'Seleccione una campaña dentro del rango de fechas.');
            return;
        }

        try {
            var payload = await PA.api('temperatura-bb', {
                granja: granja,
                campania: campania,
                galpon: PA.el('pa-galpon').value,
                fechaInicio: PA.el('pa-desde').value,
                fechaFin: PA.el('pa-hasta').value
            });
            if (!payload || payload.success === false || !payload.puntos || payload.puntos.length === 0) {
                PA_CHARTS.limpiar(PA.el(canvasId));
                PA.el('pa-meta').innerHTML = '';
                PA.el('pa-hitos').innerHTML = '';
                PA.aviso('pa-aviso', (payload && payload.message) || 'Sin lecturas para esa granja y campaña.');
                return;
            }
            pintarMeta(payload);
            pintarHitos(payload);
            pintar(payload);
        } catch (e) {
            PA_CHARTS.limpiar(PA.el(canvasId));
            PA.aviso('pa-aviso', e.message || 'No se pudo cargar la temperatura.', 'error');
        }
    }

    async function cargarCatalogo() {
        try {
            var payload = await PA.granjas(PA.periodoParams());
            catalogo = (payload && payload.granjas) || [];
            if (!granjasPintadas) {
                PA.setOpciones(PA.el('pa-granja'), catalogo, function (g) { return g.granja; }, etiquetaGranja, 'Seleccione granja');
                granjasPintadas = true;
            }
            refrescarCampanias();
            refrescarGalpones();
        } catch (e) {
            PA.aviso('pa-aviso', 'No se pudo cargar el catálogo de granjas.', 'error');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        PA.periodoInit({
            onChange: function () {
                cargarCatalogo().then(cargar);
            }
        });

        PA.el('pa-granja').addEventListener('change', function () {
            refrescarCampanias();
            refrescarGalpones();
            cargar();
        });
        PA.el('pa-campania').addEventListener('change', cargar);
        PA.el('pa-galpon').addEventListener('change', cargar);
        PA.el('pa-aplicar').addEventListener('click', cargar);
        PA.el('pa-refrescar').addEventListener('click', function () {
            cargarCatalogo().then(cargar);
        });

        cargarCatalogo();
    });
})();
