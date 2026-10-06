/* Gráficas de producción: catálogo dinámico sobre el recurso data */
(function () {
    var canvasId = 'pa-chart';
    var catalogo = [];
    var granjas = [];
    var ETIQUETAS = {
        macho: 'Macho',
        hembra: 'Hembra',
        valor: 'Valor',
        total: 'Total',
        peso: 'Peso',
        pct: '% Variación',
        ganancia: 'Ganancia',
        consumo: 'Consumo',
        nivel: 'Nivel',
        cloro: 'Cloro'
    };
    var CLAVES_BANDA = ['estandar', 'estandarM', 'estandarH', 'std', 'stdM', 'stdH'];

    function etiquetaSerie(clave) {
        if (ETIQUETAS[clave]) {
            return ETIQUETAS[clave];
        }

        return String(clave).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function tipoActual() {
        var id = PA.el('pa-tipo').value;
        var encontrado = null;
        catalogo.forEach(function (t) {
            if (String(t.id) === String(id)) {
                encontrado = t;
            }
        });

        return encontrado;
    }

    function granjaActual() {
        var codigo = PA.el('pa-granja').value;
        var encontrada = null;
        granjas.forEach(function (g) {
            if (String(g.granja) === String(codigo)) {
                encontrada = g;
            }
        });

        return encontrada;
    }

    /* data puede venir plano o anidado bajo 'linea' cuando la sección es 'all' */
    function desanidar(payload) {
        if (payload && payload.dataPorDia) {
            return payload;
        }
        if (payload && payload.linea && payload.linea.dataPorDia) {
            return payload.linea;
        }

        return payload;
    }

    /* Extrae las claves numéricas de una fila: números directos o {valor}/{pct} */
    function valoresFila(fila) {
        var out = {};
        Object.keys(fila || {}).forEach(function (clave) {
            if (clave === 'dia' || clave === 'fecha' || CLAVES_BANDA.indexOf(clave) !== -1) {
                return;
            }
            var valor = fila[clave];
            if (typeof valor === 'number') {
                out[clave] = valor;
                return;
            }
            if (valor && typeof valor === 'object') {
                if (typeof valor.valor === 'number') {
                    out[clave] = valor.valor;
                } else if (typeof valor.pct === 'number') {
                    out[clave] = valor.pct;
                }
            }
        });

        return out;
    }

    function seriesDe(dataPorDia, etiquetas) {
        var acumulado = {};
        var orden = [];

        dataPorDia.forEach(function (fila, indice) {
            var valores = valoresFila(fila);
            Object.keys(valores).forEach(function (clave) {
                if (!acumulado[clave]) {
                    acumulado[clave] = new Array(etiquetas.length).fill(null);
                    orden.push(clave);
                }
                acumulado[clave][indice] = valores[clave];
            });
        });

        return orden.map(function (clave, indice) {
            return {
                label: etiquetaSerie(clave),
                data: acumulado[clave],
                borderColor: PA.color(indice),
                backgroundColor: PA.color(indice),
                borderWidth: 2,
                borderRadius: 3,
                tension: 0.25,
                spanGaps: true,
                pointRadius: 0,
                pointHoverRadius: 5
            };
        });
    }

    function bandaDe(dataPorDia) {
        var banda = { min: null, max: null };
        dataPorDia.forEach(function (fila) {
            CLAVES_BANDA.forEach(function (clave) {
                var bloque = fila[clave];
                if (bloque && typeof bloque === 'object' && banda.min === null && banda.max === null) {
                    if (typeof bloque.min === 'number' || typeof bloque.max === 'number') {
                        banda.min = typeof bloque.min === 'number' ? bloque.min : null;
                        banda.max = typeof bloque.max === 'number' ? bloque.max : null;
                    }
                }
            });
        });

        return banda;
    }

    function pintar(payload, tipo, datasets, banda) {
        var esBarra = (tipo && tipo.chartType === 'bar');
        var modo = (tipo && tipo.barMode) || 'grouped';
        var apilado = esBarra && modo === 'stacked';
        var t = PA_CHARTS.tema();

        PA_CHARTS.crear(PA.el(canvasId), {
            type: esBarra ? 'bar' : 'line',
            plugins: [PA_CHARTS.bandaEstandar],
            data: { labels: payload.etiquetas, datasets: datasets },
            options: PA_CHARTS.opcionesBase({
                plugins: {
                    paBand: { min: banda.min, max: banda.max },
                    legend: {
                        labels: { color: t.texto, usePointStyle: true, boxWidth: 9, boxHeight: 9, padding: 12, font: { size: 10 } }
                    },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    x: {
                        stacked: apilado,
                        ticks: { color: t.texto, maxRotation: 45, autoSkip: true, maxTicksLimit: 20, font: { size: 10 } },
                        grid: { color: t.grid, drawBorder: false }
                    },
                    y: {
                        stacked: apilado,
                        beginAtZero: true,
                        ticks: { color: t.texto, font: { size: 10 } },
                        grid: { color: t.grid, drawBorder: false },
                        title: { display: true, text: (payload.unidad || ''), color: t.texto, font: { size: 11 } }
                    }
                }
            })
        });
    }

    function parametrosBase() {
        var p = {
            tipo: PA.el('pa-tipo').value,
            granja: PA.el('pa-granja').value,
            campania: PA.el('pa-campania').value,
            galpon: PA.el('pa-galpon').value,
            sexo: PA.el('pa-sexo').value
        };
        var seccionNodo = PA.el('pa-seccion');
        if (seccionNodo && !PA.el('pa-bloque-seccion').classList.contains('hidden')) {
            p.seccion = seccionNodo.value;
        }
        if (p.granja === '' || p.campania === '') {
            return null;
        }

        return p;
    }

    async function cargar() {
        var tipo = tipoActual();
        var params = parametrosBase();
        if (!tipo || !params) {
            PA_CHARTS.limpiar(PA.el(canvasId));
            PA.aviso('pa-aviso', 'Seleccione tipo, granja y campaña.');
            return;
        }

        PA.aviso('pa-aviso', 'Consultando...');
        try {
            var payload = desanidar(await PA.api('data', params));
            if (!payload || payload.success === false || !payload.dataPorDia || payload.dataPorDia.length === 0) {
                PA_CHARTS.limpiar(PA.el(canvasId));
                PA.aviso('pa-aviso', (payload && payload.message) || 'Sin datos para esa combinación.');
                return;
            }

            var etiquetas = payload.dataPorDia.map(function (fila) {
                return 'Día ' + fila.dia;
            });
            var datasets = seriesDe(payload.dataPorDia, etiquetas);

            if (datasets.length === 0) {
                PA_CHARTS.limpiar(PA.el(canvasId));
                PA.aviso('pa-aviso', 'La respuesta no tiene series numéricas para pintar.');
                return;
            }

            payload.etiquetas = etiquetas;
            payload.unidad = payload.unidad ? 'Unidad: ' + payload.unidad : '';
            PA.aviso('pa-aviso', '');
            pintar(payload, tipo, datasets, bandaDe(payload.dataPorDia));
        } catch (e) {
            PA_CHARTS.limpiar(PA.el(canvasId));
            PA.aviso('pa-aviso', e.message || 'No se pudo cargar la gráfica.', 'error');
        }
    }

    function refrescarSecciones() {
        var tipo = tipoActual();
        var bloque = PA.el('pa-bloque-seccion');
        var select = PA.el('pa-seccion');
        var secciones = (tipo && tipo.secciones) || [];
        if (secciones.length === 0) {
            bloque.classList.add('hidden');
            select.innerHTML = '';
            return;
        }
        select.innerHTML = secciones.map(function (s) {
            return '<option value="' + PA.escapeHtml(s.id) + '">' + PA.escapeHtml(s.label || s.id) + '</option>';
        }).join('');
        bloque.classList.remove('hidden');
    }

    function refrescarCampanias() {
        var granja = granjaActual();
        PA.setOpciones(PA.el('pa-campania'), granja ? granja.campanias : [], function (c) { return c; }, function (c) { return c; }, 'Todas');
        refrescarGalpones();
    }

    function refrescarGalpones() {
        var granja = granjaActual();
        PA.setOpciones(PA.el('pa-galpon'), granja ? granja.galpones : [], function (g) { return g; }, function (g) { return g; }, 'Todos');
    }

    async function cargarCatalogos() {
        var fallo = false;
        try {
            var tipos = await PA.tipos();
            catalogo = (tipos && tipos.data) || [];
            PA.setOpciones(PA.el('pa-tipo'), catalogo, function (t) { return t.id; }, function (t) { return t.label || t.id; }, 'Seleccione tipo');
        } catch (e) {
            fallo = true;
        }

        try {
            var catGranjas = await PA.granjas();
            granjas = (catGranjas && catGranjas.granjas) || [];
            PA.setOpciones(
                PA.el('pa-granja'),
                granjas,
                function (g) { return g.granja; },
                function (g) { return g.nombre && g.nombre !== g.granja ? g.nombre + ' (' + g.granja + ')' : g.granja; },
                'Seleccione granja'
            );
            if (granjas.length === 0) {
                fallo = true;
            }
        } catch (e) {
            fallo = true;
        }

        refrescarSecciones();
        if (fallo) {
            PA.aviso('pa-aviso', 'No se pudieron cargar los catálogos (tipos / granjas).', 'error');
            return;
        }
        PA.aviso('pa-aviso', 'Seleccione tipo, granja y campaña.');
    }

    document.addEventListener('DOMContentLoaded', function () {
        PA.el('pa-tipo').addEventListener('change', function () {
            refrescarSecciones();
            cargar();
        });
        PA.el('pa-granja').addEventListener('change', function () {
            refrescarCampanias();
            cargar();
        });
        ['pa-campania', 'pa-galpon', 'pa-sexo', 'pa-seccion'].forEach(function (id) {
            var nodo = PA.el(id);
            if (nodo) {
                nodo.addEventListener('change', cargar);
            }
        });
        PA.el('pa-refrescar').addEventListener('click', cargar);
        cargarCatalogos();
    });
})();
