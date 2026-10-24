/**
 * Servicio del módulo Control de Clientes.
 */
class ControlClientesService {
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

    async obtenerFiltros(tipoGrafico = 'UndCorporativos') {
        const params = new URLSearchParams({ tipo_grafico: tipoGrafico });
        const response = await fetch(`${this.baseUrl}/controlClientes/filtros?${params.toString()}`);
        const texto = await response.text();
        let data = {};

        try {
            data = JSON.parse(texto);
        } catch (e) {
            console.error('Error parseando JSON de filtros:', texto);
            throw new Error(`Respuesta inválida del servidor (HTTP ${response.status})`);
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error del servidor (HTTP ${response.status})`);
        }

        return data.data || {};
    }

    async obtenerDashboard(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/controlClientes/dashboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filtros)
        });
        const texto = await response.text();
        let data = {};

        try {
            data = JSON.parse(texto);
        } catch (e) {
            console.error('Error parseando JSON de dashboard:', texto);
            throw new Error(`Respuesta inválida del servidor (HTTP ${response.status})`);
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error del servidor (HTTP ${response.status})`);
        }

        return data.data || {};
    }
}

window.ControlClientesService = ControlClientesService;
