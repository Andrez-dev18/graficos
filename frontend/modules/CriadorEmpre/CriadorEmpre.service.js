/**
 * Servicio del módulo CriadorEmpre.
 */
class CriadorEmpreService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';
    }

    async obtenerFiltros(tipoGrafico = 'CantidadesTabla') {
        const params = new URLSearchParams({
            tipo_grafico: tipoGrafico
        });

        const response = await fetch(`${this.baseUrl}/CriadorEmpre/filtros?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerDashboard(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/CriadorEmpre/dashboard`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filtros)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }
}

window.CriadorEmpreService = CriadorEmpreService;
