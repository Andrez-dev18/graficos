class AntenasService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';

        this.ENDPOINTS = {
            DASHBOARD: '/antenas/dashboard'
        };
    }

    async postJson(endpoint, payload, mensajeError) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
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
            console.error(mensajeError, error);
            return {
                success: false,
                message: mensajeError
            };
        }
    }

    async obtenerDashboard(filtros) {
        return this.postJson(this.ENDPOINTS.DASHBOARD, filtros, 'No se pudo consultar Conectividad de Antenas.');
    }
}

window.AntenasService = AntenasService;
