/**
 * Servicio para gestión y consumo de endpoints del módulo Ventas Resumen
 */
class VentasResumenService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend/public';

        this.ENDPOINTS = {
            FILTROS: '/ventasResumen/filtros',
            VENTAS_SAC_COOR: '/ventasResumen/ventas-sac-coor',
            DETALLE: '/ventasResumen/detalle',
            EXPORTAR_EXCEL: '/ventasResumen/exportar-detalle-excel'
        };
    }

    /**
     * Obtiene las opciones iniciales de los filtros (lineas de proceso, zonas, items, motivos de devolucion)
     */
    async obtenerFiltros() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener filtros en VentasResumenService:', error);
            return {
                success: false,
                lineasProceso: [],
                zonasFiscales: [],
                items: [],
                nomDevoluciones: []
            };
        }
    }
}

window.VentasResumenService = VentasResumenService;
