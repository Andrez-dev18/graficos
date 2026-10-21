/**
 * DashAnalisisPT0 / DetalleDia
 * Movimientos por cliente, transacción, ítem y descripción.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0DetalleDia = {
    render(controller, data, targetContainer = null) {
        const H = window.AnalisisPT0Helper;

        const dimensiones = [
            {
                key: 'anio_mes',
                label: 'Mes de efecto',
                className: 'min-w-[130px]',
                render: valor => H.escapeHtml(H.fmtMes(valor))
            },
            {
                key: 'fecha',
                label: 'Día de efecto',
                className: 'min-w-[100px]',
                render: valor => H.escapeHtml(H.fmtFecha(valor))
            },
            {
                key: 'cliente',
                label: 'Cliente',
                className: 'min-w-[90px]',
                render: valor => H.escapeHtml(valor)
            },
            {
                key: 'tran',
                label: 'tcod.',
                className: 'min-w-[80px]',
                render: valor => H.escapeHtml(valor)
            },
            {
                key: 'codigo_item',
                label: 'Código ítem',
                className: 'min-w-[110px]',
                render: valor => H.escapeHtml(valor)
            },
            {
                key: 'nom_item',
                label: 'Descripción',
                className: 'min-w-[230px]',
                render: valor => H.escapeHtml(valor)
            }
        ];

        const filas = H.agrupar((data && data.base) || [], dimensiones);

        H.renderTabla({
            container: targetContainer || 'contenedor-detalle-dia',
            title: 'DetalleDia',
            subtitle: 'Detalle por ítem y descripción',
            rows: filas,
            dimensiones,
            subtotalLevels: ['cliente', 'fecha', 'anio_mes'],
            sourceKey: null,
            controller,
            seleccion: data && data.seleccion,
            tableClass: 'min-w-[1250px]',
            emptyMessage: 'Sin movimientos para el rango seleccionado.'
        });
    }
};

window.ChartRegistry['AnalisisPT0DetalleDia'] = window.ChartAnalisisPT0DetalleDia;
