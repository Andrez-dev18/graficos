class AnalisisTransporteService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '';
        this.ENDPOINTS = {
            LIQUIDACION_PLACAS: '/analisisTransporte/liquidacion-placas'
        };
    }

    async obtenerLiquidacionPlacas(filtros) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.LIQUIDACION_PLACAS}`, {
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
            throw new Error(data?.message || 'No se pudo cargar Liquidación de Placas.');
        }

        return data.payload;
    }
}

window.AnalisisTransporteService = AnalisisTransporteService;
