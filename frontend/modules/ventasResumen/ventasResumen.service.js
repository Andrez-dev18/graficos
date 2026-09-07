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
            CUMPLIMIENTO_PLAN_REAL: '/ventasResumen/cumplimiento-plan-real',
            ANALISIS_SECUNDARIO: '/ventasResumen/analisis-secundario',
            DETALLE: '/ventasResumen/detalle',
            EXPORTAR_EXCEL: '/ventasResumen/exportar-detalle-excel'
        };
    }

    /**
     * Consulta el desglose secundario (Clientes y Devoluciones) para el modal interactivo
     */
    async consultarAnalisisSecundario(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.ANALISIS_SECUNDARIO}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("Respuesta del servidor no es JSON:", text);
                throw new Error(`Respuesta inválida del servidor: ${text.substring(0, 100)}...`);
            }

            if (!response.ok) {
                throw new Error(data.message || `Error HTTP: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('Error al consultar analisis secundario en VentasResumenService:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
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
    /**
     * Consulta la data consolidada de Ventas y Devoluciones (07VentasSacCoor)
     */
    async consultarVentasSacCoor(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.VENTAS_SAC_COOR}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al consultar VentasSacCoor en VentasResumenService:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }
    
    /**
     * Consulta el comparativo de Plan vs Real (Zonas e Items) para el modal de 06VentasSaca
     */
    async consultarCumplimientoPlanReal(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.CUMPLIMIENTO_PLAN_REAL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al consultar CumplimientoPlanReal en VentasResumenService:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }
}

window.VentasResumenService = VentasResumenService;

