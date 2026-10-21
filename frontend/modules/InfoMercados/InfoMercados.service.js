/**
 * Servicio para el módulo InfoMercados.
 */
class InfoMercadosService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';
    }

    async obtenerVolSemanal(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/volsemanal?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }
}
