/**
 * Servicio del módulo InfoMercado2.
 * Reutiliza los endpoints de participación de InfoMercados.
 */
class InfoMercado2Service {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';
    }

    async obtenerFiltrosParticipacion(familia, fechaInicio, fechaFin, anio = '2026') {
        const endpoint = familia === 'PROV'
            ? 'ParticipacionMercadoPROV'
            : 'ParticipacionMercadoAQP';

        const params = new URLSearchParams({
            anio,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        });

        const response = await fetch(`${this.baseUrl}/InfoMercados/${endpoint}/filtros?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || `Error HTTP ${response.status}`);
        }

        return data.data || {};
    }

    async obtenerParticipacion(familia, filtros) {
        const endpoint = familia === 'PROV'
            ? 'ParticipacionMercadoPROV'
            : 'ParticipacionMercadoAQP';

        const response = await fetch(`${this.baseUrl}/InfoMercados/${endpoint}/dashboard`, {
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
