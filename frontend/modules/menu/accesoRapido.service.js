class AccesoRapidoService {
    constructor() {
        this.baseUrl = this.obtenerBaseUrl();
    }

    obtenerBaseUrl() {
        if (window.AppConfig && window.AppConfig.API && window.AppConfig.API.BASE_URL) {
            return window.AppConfig.API.BASE_URL;
        }

        return 'http://localhost/corebi/backend';
    }

    async obtenerAccesosLateral() {
        const response = await fetch(`${this.baseUrl}/dashboardPrincipal/accesos-lateral`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'No se pudieron obtener los accesos rápidos');
        }

        return data.data.accesos;
    }
}

window.AccesoRapidoService = AccesoRapidoService;
