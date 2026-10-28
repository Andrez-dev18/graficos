class TomasDescisionesService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '';

        this.ENDPOINTS = {
            FILTROS_PROYECTADO_VENTAS: '/tomasDescisiones/filtros-proyectado-ventas',
            PROYECTADO_VENTAS_INDICADOR: '/tomasDescisiones/proyectado-ventas-indicador',
            TASAS_INTERES: '/tomasDescisiones/tasas-interes',
            GRAFICAS_PROYECTADOS_VS_REAL: '/tomasDescisiones/graficas-proyectados-vs-real',
            GRAFICAS_PROYECTADOS_DIAS: '/tomasDescisiones/graficas-proyectados-dias'
        };
    }

    async obtenerFiltrosProyectadoVentas(filtros = {}) {
        return this.post(this.ENDPOINTS.FILTROS_PROYECTADO_VENTAS, filtros);
    }

    async obtenerProyectadoVentasIndicador(filtros) {
        return this.post(this.ENDPOINTS.PROYECTADO_VENTAS_INDICADOR, filtros);
    }

    async obtenerTasasInteres(filtros = {}) {
        return this.post(this.ENDPOINTS.TASAS_INTERES, filtros);
    }

    async obtenerGraficasProyectadosVSReal(filtros = {}) {
        return this.post(this.ENDPOINTS.GRAFICAS_PROYECTADOS_VS_REAL, filtros);
    }

    async obtenerGraficasProyectadosDias(filtros = {}) {
        return this.post(this.ENDPOINTS.GRAFICAS_PROYECTADOS_DIAS, filtros);
    }

    async post(endpoint, payload) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload || {})
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error((data && data.message) || `Error HTTP: ${response.status}`);
        }

        if (!data || !data.success) {
            throw new Error((data && data.message) || 'No se pudo obtener la información.');
        }

        return data.payload;
    }
}

window.TomasDescisionesService = TomasDescisionesService;
