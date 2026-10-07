/* Utilidades compartidas del módulo Producción Aves */
window.PA = (function () {
    /* Base de Sanidad resuelta dinámicamente según el entorno actual (localhost o producción) */
    var SANIDAD_BASE = (window.location && window.location.origin ? window.location.origin : '') + '/sanidad';
    var SANIDAD_TOKEN = 'Bearer d9f7a6b3-4c8e-11ee-be56-0242ac120002';
    var URLS = {
        zonas: SANIDAD_BASE + '/modules/sip/estandares-granja/crud_estandares_granja.php?action=zonas',
        granjas: SANIDAD_BASE + '/modules/sip/estandares-granja/crud_estandares_granja.php?action=granjas',
        liquidaciones: SANIDAD_BASE + '/modules/sip/historia-clinica-graficas/get_liquidaciones_ica_chart.php',
        galpones: SANIDAD_BASE + '/modules/sip/historia-clinica-graficas/get_liquidaciones_lista.php'
    };

    var BASE = SANIDAD_BASE;

    var PALETA = [
        '#2563eb', '#f97316', '#10b981', '#a855f7', '#ef4444',
        '#0891b2', '#eab308', '#ec4899', '#14b8a6', '#6366f1',
        '#84cc16', '#f43f5e', '#0ea5e9', '#d946ef', '#22c55e',
        '#f59e0b', '#8b5cf6', '#06b6d4', '#fb7185', '#65a30d'
    ];

    function qs(params) {
        var partes = [];
        Object.keys(params || {}).forEach(function (clave) {
            var valor = params[clave];
            if (valor === null || valor === undefined || valor === '') {
                return;
            }
            if (Array.isArray(valor)) {
                valor.forEach(function (item) {
                    partes.push(encodeURIComponent(clave + '[]') + '=' + encodeURIComponent(item));
                });
                return;
            }
            partes.push(encodeURIComponent(clave) + '=' + encodeURIComponent(valor));
        });
        return partes.join('&');
    }

    function color(indice) {
        return PALETA[indice % PALETA.length];
    }

    function el(id) {
        return document.getElementById(id);
    }

    function escapeHtml(valor) {
        return String(valor === null || valor === undefined ? '' : valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function api(recurso, params) {
        params = params || {};
        var url = '';
        if (recurso === 'liquidaciones-zonas' || recurso === 'zonas') {
            url = URLS.zonas;
        } else if (recurso === 'liquidaciones-granjas' || recurso === 'granjas') {
            var z = params.zona != null ? encodeURIComponent(params.zona) : '';
            url = URLS.granjas + '&zona=' + z;
        } else if (recurso === 'liquidaciones' || recurso === 'data' || recurso === 'chart') {
            var query = qs(params);
            url = URLS.liquidaciones + (query ? '?' + query : '');
        } else if (recurso === 'liquidaciones-galpones' || recurso === 'galpones') {
            var query = qs(params);
            url = URLS.galpones + (query ? '?' + query : '');
        } else {
            var query = qs(Object.assign({ recurso: recurso }, params));
            url = URLS.liquidaciones + '?' + query;
        }

        var res = await fetch(url, {
            headers: {
                Accept: 'application/json',
                Authorization: SANIDAD_TOKEN
            },
            credentials: 'include'
        });
        var json;
        try {
            json = await res.json();
        } catch (e) {
            throw new Error('Respuesta no válida del servidor');
        }
        return json;
    }

    function tipos() {
        return api('tipos');
    }

    function granjas(params) {
        return api('granjas', params);
    }

    function setOpciones(select, items, valorFn, textoFn, placeholder, valorActual) {
        if (!select) {
            return;
        }
        var previo = valorActual === undefined ? select.value : valorActual;
        var html = placeholder ? '<option value="">' + escapeHtml(placeholder) + '</option>' : '';
        (items || []).forEach(function (item) {
            var valor = valorFn(item);
            html += '<option value="' + escapeHtml(valor) + '">' + escapeHtml(textoFn(item)) + '</option>';
        });
        select.innerHTML = html;
        if (previo !== undefined && previo !== null && previo !== '') {
            var existe = Array.prototype.some.call(select.options, function (o) {
                return o.value === String(previo);
            });
            if (existe) {
                select.value = String(previo);
            }
        }
    }

    function aviso(id, texto, tipo) {
        var nodo = el(id);
        if (!nodo) {
            return;
        }
        if (!texto) {
            nodo.classList.add('hidden');
            nodo.textContent = '';
            return;
        }
        nodo.textContent = texto;
        nodo.classList.remove('hidden');
        nodo.style.background = tipo === 'error' ? 'rgba(239,68,68,0.12)' : 'var(--pa-bg)';
        nodo.style.color = tipo === 'error' ? '#dc2626' : 'var(--pa-muted)';
        nodo.style.border = '1px solid var(--pa-border)';
    }

    function fechaISO(fecha) {
        var d = fecha instanceof Date ? fecha : new Date();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var dia = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + m + '-' + dia;
    }

    function rangoDefecto(meses) {
        var hasta = new Date();
        var desde = new Date();
        desde.setMonth(desde.getMonth() - (meses || 12));
        return { desde: fechaISO(desde), hasta: fechaISO(hasta) };
    }

    function fmtFechaEs(iso) {
        if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            return iso || '';
        }
        var p = iso.split('-');
        return parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + p[0];
    }

    /* Bloque de periodo colapsable: desde/hasta con resumen */
    function periodoInit(opts) {
        opts = opts || {};
        var toggle = el('pa-periodo-toggle');
        var body = el('pa-periodo-body');
        var desde = el('pa-desde');
        var hasta = el('pa-hasta');
        var resumen = el('pa-periodo-resumen');
        var rango = rangoDefecto(opts.meses);

        if (desde && desde.value === '') {
            desde.value = rango.desde;
        }
        if (hasta && hasta.value === '') {
            hasta.value = rango.hasta;
        }

        function pintarResumen() {
            if (!resumen) {
                return;
            }
            var d = desde ? desde.value : '';
            var h = hasta ? hasta.value : '';
            resumen.textContent = (d && h) ? (fmtFechaEs(d) + ' – ' + fmtFechaEs(h)) : 'Complete las fechas';
        }

        function expandir(abierto) {
            if (!toggle || !body) {
                return;
            }
            toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
            toggle.classList.toggle('pa-periodo-toggle--open', abierto);
            body.classList.toggle('hidden', !abierto);
        }

        expandir(false);
        pintarResumen();

        if (toggle) {
            toggle.addEventListener('click', function () {
                expandir(toggle.getAttribute('aria-expanded') !== 'true');
            });
        }
        [desde, hasta].forEach(function (nodo) {
            if (nodo) {
                nodo.addEventListener('change', function () {
                    pintarResumen();
                    if (typeof opts.onChange === 'function') {
                        opts.onChange();
                    }
                });
            }
        });
    }

    function periodoParams() {
        var desde = el('pa-desde');
        var hasta = el('pa-hasta');
        return {
            periodoTipo: 'ENTRE_FECHAS',
            fechaInicio: desde ? desde.value : '',
            fechaFin: hasta ? hasta.value : ''
        };
    }

    function periodoTexto() {
        var desde = el('pa-desde');
        var hasta = el('pa-hasta');
        return (desde && hasta && desde.value && hasta.value)
            ? (fmtFechaEs(desde.value) + ' – ' + fmtFechaEs(hasta.value))
            : '';
    }

    return {
        BASE: BASE,
        PALETA: PALETA,
        color: color,
        api: api,
        tipos: tipos,
        granjas: granjas,
        el: el,
        qs: qs,
        escapeHtml: escapeHtml,
        setOpciones: setOpciones,
        aviso: aviso,
        fechaISO: fechaISO,
        rangoDefecto: rangoDefecto,
        fmtFechaEs: fmtFechaEs,
        periodoInit: periodoInit,
        periodoParams: periodoParams,
        periodoTexto: periodoTexto
    };
})();
