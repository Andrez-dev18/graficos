/**
 * Servicio para Costos Tradicionales - Costo de Producción Pollo Vivo (CP01)
 * Consume la API del Backend (/costosTradicionales/dashboard)
 */
class CostosTradicionalesService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos reales del dashboard de Costo de Producción Pollo Vivo
     * @param {Object} filtros { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD' }
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/costosTradicionales/dashboard`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en CostosTradicionalesService.obtenerDashboard:', error);
            return {
                success: false,
                status: 'error',
                message: error.message || 'Error de conexión con el servidor backend',
                payload: {
                    benchmark: 4.538,
                    periodos: [],
                    graficaCosto: [],
                    tablaMetricas: []
                }
            };
        }
    }
}
