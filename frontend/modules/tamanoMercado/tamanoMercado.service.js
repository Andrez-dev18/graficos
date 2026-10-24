/**
 * Servicio API para el módulo Tamaño de Mercado - CoreBI
 */
class TamanoMercadoService {
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

    async obtenerFiltros() {
        try {
            const res = await fetch(`${this.baseUrl}/tamanoMercado/filtros`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const text = await res.text();
            let json = {};
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.error('Error parseando JSON de filtros:', text);
                throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`);
            }

            if (!res.ok || !json.success) {
                throw new Error(json.message || `Error del servidor (HTTP ${res.status})`);
            }

            return json.data || {};
        } catch (error) {
            console.error('TamanoMercadoService.obtenerFiltros error:', error);
            throw error;
        }
    }

    async obtenerDashboard(filtros) {
        try {
            const res = await fetch(`${this.baseUrl}/tamanoMercado/dashboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            const text = await res.text();
            let json = {};
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.error('Error parseando JSON de dashboard:', text);
                throw new Error(`Respuesta inválida del servidor (HTTP ${res.status})`);
            }

            if (!res.ok || !json.success) {
                throw new Error(json.message || `Error del servidor (HTTP ${res.status})`);
            }

            return json.data || {};
        } catch (error) {
            console.error('TamanoMercadoService.obtenerDashboard error:', error);
            throw error;
        }
    }
}

window.TamanoMercadoService = TamanoMercadoService;
