/**
 * Servicio para Presupuestos PAB
 * Consume la API del Backend (/PresupuestosPAB/dashboard) con soporte de fallback
 */
class PresupuestosPABService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos del presupuesto según filtros seleccionados
     * @param {Object} filtros { tipo_grafico, fecha_inicio, fecha_fin }
     * @returns {Promise<Object>}
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/PresupuestosPAB/dashboard`;
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
            console.error('Error al consultar servicio PresupuestosPAB:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}
