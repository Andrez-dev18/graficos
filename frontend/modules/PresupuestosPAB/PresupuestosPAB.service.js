/**
 * Servicio para Presupuestos PAB
 * Consume la API del Backend (/PresupuestosPAB/dashboard) con soporte de fallback
 */
class PresupuestosPABService {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
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

    /**
     * Consulta los presupuestos autorizados para el usuario logueado
     * @returns {Promise<Object>}
     */
    async obtenerMisPresupuestos() {
        try {
            let codigoUsuario = '';
            try {
                const sessionRaw = sessionStorage.getItem('usuario');
                if (sessionRaw) {
                    const userObj = JSON.parse(sessionRaw);
                    codigoUsuario = userObj?.codigo || userObj?.usuario || '';
                }
            } catch (e) {
                console.warn('Error leyendo sessionStorage usuario:', e);
            }

            const queryParam = codigoUsuario ? `?codigo=${encodeURIComponent(codigoUsuario)}` : '';
            const url = `${this.baseUrl}/PresupuestosPAB/acceso/misPresupuestos${queryParam}`;
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });
            if (!response.ok) {
                return { success: false, data: { presupuestos: [] } };
            }
            return await response.json();
        } catch (error) {
            console.error('Error al consultar mis presupuestos:', error);
            return { success: false, data: { presupuestos: [] } };
        }
    }
}
