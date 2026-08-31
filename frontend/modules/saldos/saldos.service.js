class saldosService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL) 
            ? AppConfig.API.BASE_URL 
            : '';
    }

    ENDPOINTS = {
        FILTROS: '/saldosxCobrar/filtros',
        GRAFICODATA: '/saldosxCobrar/grafico',
    };

    /**
     * Obtiene las opciones de los filtros (cuentas y clientes)
     */
    async obtenerFiltros() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al obtener filtros en saldosService:', error);
            throw error;
        }
    }

    /**
     * Envía los filtros seleccionados y obtiene la data procesada para las gráficas
     * @param {Object} filtros { fecha_inicio, fecha_fin, cuentas, clientes }
     */
    async obtenerGraficoData(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICODATA}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al obtener datos del gráfico en saldosService:', error);
            throw error;
        }
    }
}

window.saldosService = saldosService;