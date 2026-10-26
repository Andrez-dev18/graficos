/**
 * Servicio para consulta y datos del módulo Costos Tradicional Día 2 (Galpones Horizontal)
 */
class CostosDias2Service {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
        this.ENDPOINTS = {
            DASHBOARD: '/costosDias2/dashboard',
            FILTROS: '/costosDias2/filtros',
            EXPORTAR_PDF: '/costosDias2/exportar-pdf'
        };
    }

    /**
     * Consulta el catálogo de filtros (granjas, campañas, galpones y rangos de fechas)
     */
    async obtenerFiltros(filtros = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en CostosDias2Service.obtenerFiltros:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    /**
     * Consulta la matriz horizontal de galpones y subtotales por Granja
     */
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

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en CostosDias2Service.obtenerDashboard:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    async exportarPdf(filtros = {}) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.EXPORTAR_PDF}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/pdf'
            },
            body: JSON.stringify(filtros)
        });

        if (!response.ok) {
            let mensaje = `Error HTTP: ${response.status}`;
            try {
                const data = await response.json();
                mensaje = data.message || mensaje;
            } catch (e) {
                // Respuesta no JSON
            }
            throw new Error(mensaje);
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.includes('application/pdf')) {
            throw new Error('El servidor no devolvió un archivo PDF válido.');
        }

        return await response.blob();
    }
}
