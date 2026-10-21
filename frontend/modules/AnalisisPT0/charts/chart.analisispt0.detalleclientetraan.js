/**
 * DashAnalisisPT0 / DetalleClienteTraan
 * Movimientos por cliente, mes, día y código de transacción.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0DetalleClienteTraan = {
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
                label: 'Tran',
                className: 'min-w-[80px]',
                render: valor => H.escapeHtml(valor)
            }
        ];

        const filas = H.agrupar((data && data.base) || [], dimensiones);

        H.renderTabla({
            container: targetContainer || 'contenedor-detalle-cliente-traan',
            title: 'DetalleClienteTraan',
            subtitle: 'Entrada y salida por cliente y transacción',
            rows: filas,
            dimensiones,
            subtotalLevels: ['cliente', 'fecha', 'anio_mes'],
            sourceKey: 'detalle_cliente_traan',
            controller,
            seleccion: data && data.seleccion,
            tableClass: 'min-w-full',
            emptyMessage: 'Sin movimientos para el rango seleccionado.'
        });
    }
};

window.ChartRegistry['AnalisisPT0DetalleClienteTraan'] = window.ChartAnalisisPT0DetalleClienteTraan;
