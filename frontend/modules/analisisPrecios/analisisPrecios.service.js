/**
 * Servicio para Análisis de Precios (LIMA 1 AnalisisPrecios)
 * Consume la API del Backend (/analisisPrecios/dashboard)
 */
class AnalisisPreciosService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos del dashboard de Análisis de Precios
     * @param {Object} filtros { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD', tipo_grafico: 'DashAnalisiPrecios' }
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/analisisPrecios/dashboard`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                console.warn(`Respuesta del backend con error HTTP ${response.status}`);
                return {
                    status: 'error',
                    message: `Error de servidor HTTP ${response.status}`
                };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al consultar servicio AnalisisPrecios:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}
