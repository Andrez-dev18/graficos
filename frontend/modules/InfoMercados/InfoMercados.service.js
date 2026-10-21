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

    async obtenerProvEmpresaFiltros(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/PROVEmpresa/filtros?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerProvEmpresa(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/InfoMercados/PROVEmpresa/dashboard`, {
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

    async obtenerParticipacionMercadoAqpFiltros(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/ParticipacionMercadoAQP/filtros?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerParticipacionMercadoAqp(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/InfoMercados/ParticipacionMercadoAQP/dashboard`, {
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

    async obtenerParticipacionMercadoProvFiltros(anio = '2026') {
        const response = await fetch(`${this.baseUrl}/InfoMercados/ParticipacionMercadoPROV/filtros?anio=${encodeURIComponent(anio)}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerParticipacionMercadoProv(filtros = {}) {
        const response = await fetch(`${this.baseUrl}/InfoMercados/ParticipacionMercadoPROV/dashboard`, {
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
