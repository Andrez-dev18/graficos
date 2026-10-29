/**
 * Servicio para consulta y datos del módulo Costos Tradicional Día
 */
class CostosDiasService {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
        this.ENDPOINTS = {
            DASHBOARD: '/costosDias/dashboard',
            EXPORTAR_PDF: '/costosDias/exportar-pdf'
        };
    }

    /**
     * Consulta el resumen y matriz de costos conectado al backend
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
            console.error('Error en CostosDiasService.obtenerDashboard:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    async exportarPdf(payload) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.EXPORTAR_PDF}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/pdf'
            },
            body: JSON.stringify(payload)
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
