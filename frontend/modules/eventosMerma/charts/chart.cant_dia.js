window.ChartRegistry = window.ChartRegistry || {};

window.ChartCantDia = {
    render(controller, data, container) {
        window.ChartPorcDia.renderVariante(controller, data, container, {
            conPorcentaje: false,
            fechaLarga: false,
            fechaTooltipDMY: false,
            titulo: 'CantDia',
            subtitulo: 'Cantidad diaria de eventos por cliente, área y causa',
            divisionesEje: 6
        });
    }
};

window.ChartRegistry['CantDia'] = window.ChartCantDia;
