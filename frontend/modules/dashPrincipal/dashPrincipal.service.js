class DashPrincipalService {
    constructor() {
        this.baseUrl = this.obtenerBaseUrl();
    }

    obtenerBaseUrl() {
        if (window.parent && window.parent !== window && window.parent.AppConfig && window.parent.AppConfig.API) {
            return window.parent.AppConfig.API.BASE_URL;
        }

        if (window.AppConfig && window.AppConfig.API) {
            return window.AppConfig.API.BASE_URL;
        }

        return 'http://localhost/corebi/backend';
    }

    async obtenerResumen() {
        const response = await fetch(`${this.baseUrl}/dashboardPrincipal/resumen`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'No se pudo obtener el resumen');
        }

        return data.data;
    }

    async obtenerAccesos() {
        const response = await fetch(`${this.baseUrl}/dashboardPrincipal/accesos`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'No se pudieron obtener los accesos directos');
        }

        return data.data.accesos;
    }

    async guardarAccesos(accesos) {
        const response = await fetch(`${this.baseUrl}/dashboardPrincipal/accesos/guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ accesos })
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'No se pudieron guardar los accesos directos');
        }

        return data.data.accesos;
    }
}

window.DashPrincipalService = DashPrincipalService;
