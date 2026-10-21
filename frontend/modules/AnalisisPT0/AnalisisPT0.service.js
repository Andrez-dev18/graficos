/**
 * Servicio para el módulo AnalisisPT0.
 */
class AnalisisPT0Service {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    async obtenerFiltros(anio = '2026') {
        try {
            const response = await fetch(`${this.baseUrl}/AnalisisPT0/filtros?anio=${encodeURIComponent(anio)}`, {
                method: 'GET'
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                return {
                    success: false,
                    message: data.message || `Error HTTP ${response.status}`
                };
            }

            return data;
        } catch (error) {
            console.error('Error al obtener filtros de AnalisisPT0:', error);
            return {
                success: false,
                message: 'No se pudieron obtener las fechas disponibles.'
            };
        }
    }

    async obtenerDashboard(filtros = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/AnalisisPT0/dashboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                return {
                    success: false,
                    message: data.message || `Error HTTP ${response.status}`
                };
            }

            return data;
        } catch (error) {
            console.error('Error al consultar AnalisisPT0:', error);
            return {
                success: false,
                message: 'No se pudo consultar la información de AnalisisPT0.'
            };
        }
    }
}
