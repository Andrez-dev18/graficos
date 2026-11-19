/**
 * Servicio para el módulo Control de Jabas.
 * Consume los endpoints /controlJabas/filtros y /controlJabas/dashboard.
 */
class ControlJabasService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';

        this.ENDPOINTS = {
            FILTROS: '/controlJabas/filtros',
            CLIENTES: '/controlJabas/clientes',
            STOCK_PROVINCIAS: '/controlJabas/stock-provincias',
            STOCK_PROVINCIAS_DETALLE: '/controlJabas/stock-provincias/detalle',
            STOCK_PROVINCIAS_FILTROS: '/controlJabas/stock-provincias/filtros',
            DASHBOARD: '/controlJabas/dashboard'
        };
    }

    async obtenerFiltros() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
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
            console.error('Error al obtener filtros de Control de Jabas:', error);
            return {
                success: false,
                message: 'No se pudieron obtener los filtros de Control de Jabas.'
            };
        }
    }

    async obtenerClientes(filtros = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.CLIENTES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
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
            console.error('Error al obtener clientes de Control de Jabas:', error);
            return {
                success: false,
                message: 'No se pudieron obtener los clientes de Control de Jabas.'
            };
        }
    }

    async obtenerStockProvincias(filtros = {}) {
        return this.postJson(this.ENDPOINTS.STOCK_PROVINCIAS, filtros, 'No se pudo consultar Stock de Provincias.');
    }

    async obtenerStockProvinciasDetalle(filtros = {}) {
        return this.postJson(this.ENDPOINTS.STOCK_PROVINCIAS_DETALLE, filtros, 'No se pudo consultar el detalle de provincias.');
    }

    async obtenerStockProvinciasFiltros(filtros = {}) {
        return this.postJson(this.ENDPOINTS.STOCK_PROVINCIAS_FILTROS, filtros, 'No se pudieron obtener los filtros de provincias.');
    }

    async postJson(endpoint, filtros, mensajeError) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
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

    async obtenerDashboard(filtros = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DASHBOARD}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
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
            console.error('Error al consultar Control de Jabas:', error);
            return {
                success: false,
                message: 'No se pudo consultar la información de Control de Jabas.'
            };
        }
    }
}
