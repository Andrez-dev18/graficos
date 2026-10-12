var SANIDAD_BASE = (window.location && window.location.origin ? window.location.origin : '') + '/sanidad';
window.SANIDAD_BASE = SANIDAD_BASE;

var SANIDAD_TOKEN = 'Bearer d9f7a6b3-4c8e-11ee-be56-0242ac120002';
window.SANIDAD_TOKEN = SANIDAD_TOKEN;

if (typeof $ !== 'undefined' && $.ajaxSetup) {
    $.ajaxSetup({
        headers: {
            Authorization: SANIDAD_TOKEN
        }
    });
}

var HCLIQ_API = {
    chart: SANIDAD_BASE + '/modules/sip/historia-clinica-graficas/get_liquidaciones_ica_chart.php',
    lista: SANIDAD_BASE + '/modules/sip/historia-clinica-graficas/get_liquidaciones_lista.php',
    galpones: SANIDAD_BASE + '/modules/sip/historia-clinica-graficas/get_liquidaciones_galpones.php',
    granjasCrud: SANIDAD_BASE + '/modules/sip/estandares-granja/crud_estandares_granja.php',
    ubicacion: SANIDAD_BASE + '/modules/sip/graficas/get_sip_granjas_campanias_galpones.php'
};
window.HCLIQ_API = HCLIQ_API;

window.hcliqSanidadFetchJson = function (url) {
    return fetch(url, {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            Authorization: SANIDAD_TOKEN
        }
    }).then(function (r) {
        if (r.status === 401) {
            throw new Error('No autorizado (token Sanidad)');
        }
        return r.text().then(function (txt) {
            try {
                return JSON.parse(txt);
            } catch (e) {
                var plain = String(txt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                throw new Error(plain ? plain.slice(0, 400) : 'Respuesta no válida del servidor');
            }
        });
    });
};
