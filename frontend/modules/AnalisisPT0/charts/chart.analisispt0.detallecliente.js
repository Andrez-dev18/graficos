/**
 * DashAnalisisPT0 / DetalleCliente
 * Movimientos por cliente, mes y día de efecto.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0DetalleCliente = {
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
            }
        ];

        const filas = H.agrupar((data && data.base) || [], dimensiones);

        H.renderTabla({
            container: targetContainer || 'contenedor-detalle-cliente',
            title: 'DetalleCliente',
            subtitle: 'Entrada y salida por cliente',
            rows: filas,
            dimensiones,
            subtotalLevels: ['cliente', 'fecha', 'anio_mes'],
            sourceKey: 'detalle_cliente',
            controller,
            seleccion: data && data.seleccion,
            tableClass: 'min-w-full',
            emptyMessage: 'Sin movimientos para el rango seleccionado.'
        });
    }
};

window.ChartRegistry['AnalisisPT0DetalleCliente'] = window.ChartAnalisisPT0DetalleCliente;
