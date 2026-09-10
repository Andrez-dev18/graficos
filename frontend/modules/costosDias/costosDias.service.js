/**
 * Servicio para consulta y datos del módulo Costos Tradicional Día
 */
class CostosDiasService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
        this.ENDPOINTS = {
            DASHBOARD: '/costosDias/dashboard'
        };
    }

    /**
     * Consulta el resumen y matriz de costos conectado al backend
     */
    async obtenerDashboard(filtros = {}) {
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

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en CostosDiasService.obtenerDashboard:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }
}
