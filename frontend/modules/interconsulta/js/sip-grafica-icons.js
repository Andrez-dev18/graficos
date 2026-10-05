/**
 * sip-grafica-icons.js — iconos FontAwesome alineados a gatilladores / HC
 */
(function (window) {
    'use strict';

    var MAP = {
        mortalidad: { fa: 'fa-heart', color: 'text-rose-600', prefix: 'far' },
        consumo_alimento: { fa: 'fa-seedling', color: 'text-amber-600' },
        consumo_agua: { fa: 'fa-tint', color: 'text-sky-600' },
        consumo_gas: { fa: 'fa-fire', color: 'text-violet-600' },
        ganancia_peso: { fa: 'fa-chart-line', color: 'text-emerald-600' },
        pesaje_pollo: { fa: 'fa-weight', color: 'text-teal-600' },
        cv_peso: { fa: 'fa-chart-bar', color: 'text-fuchsia-600' },
        cv_ganancia: { fa: 'fa-chart-bar', color: 'text-purple-600' },
        respiratorio: { fa: 'fa-lungs', color: 'text-blue-600' },
        digestivo: { fa: 'fa-notes-medical', color: 'text-amber-600' },
        medicacion: { fa: 'fa-pills', color: 'text-purple-600' },
        gorgojos: { fa: 'fa-bug', color: 'text-lime-600' },
        roedores: { fa: 'fa-paw', color: 'text-stone-600' },
        nivel_cloro: { fa: 'fa-flask', color: 'text-cyan-600' },
        combinado: { fa: 'fa-layer-group', color: 'text-indigo-600' }
    };

    function iconHtml(tipo, extraClass) {
        var cfg = MAP[tipo] || { fa: 'fa-chart-line', color: 'text-slate-600' };
        var prefix = cfg.prefix || 'fas';
        var cls = prefix + ' ' + cfg.fa + ' w-4 h-4 ' + cfg.color;
        if (extraClass) cls += ' ' + extraClass;
        return '<i class="' + cls + '" aria-hidden="true"></i>';
    }

    window.SipGraficaIcons = {
        MAP: MAP,
        iconHtml: iconHtml
    };
})(window);
