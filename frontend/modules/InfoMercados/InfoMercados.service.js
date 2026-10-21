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

    async obtenerAqpEmpresaFiltros(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/AQPEmpresa/filtros?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerAqpEmpresa(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/InfoMercados/AQPEmpresa/dashboard`, {
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

    async obtenerAqpCantEmpresaFiltros(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/AQPCantEmpresa/filtros?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerAqpCantEmpresa(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/InfoMercados/AQPCantEmpresa/dashboard`, {
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
