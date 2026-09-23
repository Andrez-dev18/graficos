/**
 * Servicio para PPT 2026
 * Consume la API del Backend (/PPT2026/dashboard)
 */
class PPPT2026Service {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos del dashboard de PPT 2026
     * @param {Object} filtros { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD' }
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/PPT2026/dashboard`;
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
            console.error('Error al consultar servicio PPPT2026:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}
