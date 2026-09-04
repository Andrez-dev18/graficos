/**
 * Servicio para gestión y consumo de endpoints del módulo Ventas Resumen
 */
class VentasResumenService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend/public';

        this.ENDPOINTS = {
            FILTROS: '/ventasResumen/filtros',
            OPCIONES_LINEA: '/ventasResumen/opciones-linea',
            VENTAS_SAC_COOR: '/ventasResumen/ventas-sac-coor',
            DETALLE: '/ventasResumen/detalle',
            EXPORTAR_EXCEL: '/ventasResumen/exportar-detalle-excel'
        };
    }

    /**
     * Obtiene las opciones iniciales de los filtros (lineas de proceso, zonas, items, motivos de devolucion)
     */
    async obtenerFiltros(lineaProceso = null) {
        try {
            const url = lineaProceso ? `${this.baseUrl}${this.ENDPOINTS.FILTROS}?lineaproceso=${encodeURIComponent(lineaProceso)}` : `${this.baseUrl}${this.ENDPOINTS.FILTROS}`;
            const response = await fetch(url, {
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

    /**
     * Obtiene las zonas e items asociados a una línea de proceso específica
     */
    async obtenerOpcionesPorLinea(lineaProceso) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.OPCIONES_LINEA}?lineaproceso=${encodeURIComponent(lineaProceso)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data.success ? { zonasFiscales: data.zonasFiscales, items: data.items } : { zonasFiscales: [], items: [] };
        } catch (error) {
            console.error('Error al obtener opciones por línea en VentasResumenService:', error);
            return { zonasFiscales: [], items: [] };
        }
    }
}

window.VentasResumenService = VentasResumenService;
