class MermaGeneralMensualService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '';
        this.endpoints = {
            DASHBOARD: '/mermaGeneralMensual/dashboard'
        };
    }

    async obtenerDashboard(filtros = {}) {
        const response = await fetch(`${this.baseUrl}${this.endpoints.DASHBOARD}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(filtros)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        if (!data || !data.success) {
            throw new Error(data?.message || 'No se pudo cargar Merma General Mensual.');
        }

        return data.payload;
    }
}

window.MermaGeneralMensualService = MermaGeneralMensualService;
