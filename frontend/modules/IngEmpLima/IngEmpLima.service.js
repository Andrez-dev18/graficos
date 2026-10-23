/**
 * Servicio del módulo IngEmpLima.
 */
class IngEmpLimaService {
    constructor() {
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.pathname.includes('/corebi/')) {
                this.baseUrl = '/corebi/backend';
            } else if (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL && window.location.origin === new URL(AppConfig.API.BASE_URL, window.location.href).origin) {
                this.baseUrl = AppConfig.API.BASE_URL;
            } else {
                this.baseUrl = '/backend';
            }
        } else {
            this.baseUrl = '../../backend';
        }
    }

    async obtenerFiltros(tipoGrafico = 'ParticipacionMercadoDiaria') {
        const params = new URLSearchParams({
            tipo_grafico: tipoGrafico
        });

        const url = `${this.baseUrl}/IngEmpLima/filtros?${params.toString()}`;
        const response = await fetch(url);
        const text = await response.text();

        let data = {};
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Error parseando JSON de filtros. Respuesta:', text);
            throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}): ${text.substring(0, 150)}`);
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error del servidor (HTTP ${response.status})`);
        }

        return data.data || {};
    }

    async obtenerDashboard(filtros = {}) {
        const url = `${this.baseUrl}/IngEmpLima/dashboard`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filtros)
        });
        const text = await response.text();

        let data = {};
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Error parseando JSON de dashboard. Respuesta:', text);
            throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}): ${text.substring(0, 150)}`);
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error del servidor (HTTP ${response.status})`);
        }

        return data.data || {};
    }
}

window.IngEmpLimaService = IngEmpLimaService;
