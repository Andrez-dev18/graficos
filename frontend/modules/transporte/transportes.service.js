/**
 * Servicio para conexión y consumo de endpoints del módulo Transportes
 */
class TransportesService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
        this.ENDPOINTS = {
            DASHBOARD: '/transporte/dashboard',
            DETALLE_EVENTOS: '/transporte/detalle-eventos'
        };
    }

    /**
     * Consulta el conjunto completo de métricas, hojas de ruta y detalle de eventos
     */
    async obtenerDashboard(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DASHBOARD}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en TransportesService.obtenerDashboard:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    /**
     * Consulta bajo demanda eventos específicos de ruta
     */
    async obtenerDetalleEventos(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DETALLE_EVENTOS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en TransportesService.obtenerDetalleEventos:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }
}
