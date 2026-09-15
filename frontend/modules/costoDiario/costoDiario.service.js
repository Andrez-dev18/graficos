/**
 * Servicio para Análisis Costos Diario
 * Consume la API del Backend (/costoDiario/dashboard o /costosDias/dashboard)
 */
class CostoDiarioService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos del dashboard de Análisis Costos Diario
     * @param {Object} filtros { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD', tipo_grafico: 'CP01 CostosGeneralesPorDia' }
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/costoDiario/dashboard`;
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
            console.error('Error en CostoDiarioService.obtenerDashboard:', error);
            return {
                success: false,
                status: 'error',
                message: error.message || 'Error de conexión con el servidor backend',
                payload: {
                    periodos: [],
                    graficaCosto: [],
                    tablaMetricas: []
                }
            };
        }
    }
}
