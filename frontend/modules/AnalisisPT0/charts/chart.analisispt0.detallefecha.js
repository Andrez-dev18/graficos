/**
 * DashAnalisisPT0 / DetalleFecha
 * Movimientos por mes y día de efecto.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0DetalleFecha = {
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
            }
        ];

        const filas = H.agrupar((data && data.base) || [], dimensiones);

        H.renderTabla({
            container: targetContainer || 'contenedor-detalle-fecha',
            title: 'DetalleFecha',
            subtitle: 'Entrada y salida por mes y día',
            rows: filas,
            dimensiones,
            subtotalLevels: ['anio_mes'],
            sourceKey: 'detalle_fecha',
            controller,
            seleccion: data && data.seleccion,
            tableClass: 'min-w-full',
            emptyMessage: 'Sin movimientos para el rango seleccionado.'
        });
    }
};

window.ChartRegistry['AnalisisPT0DetalleFecha'] = window.ChartAnalisisPT0DetalleFecha;
