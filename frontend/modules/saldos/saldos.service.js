class saldosService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '';
    }

    ENDPOINTS = {
        FILTROS: '/saldosxCobrar/filtros-barra',
        GRAFICODATA: '/saldosxCobrar/grafico-barra',
        DETALLE: '/saldosxCobrar/detalle',

        // Gráfico de Líneas por Zona
        FILTROS_LINEA: '/saldosxCobrar/filtros-linea',
        GRAFICO_LINEA: '/saldosxCobrar/grafico-linea',
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

    /**
     * Obtiene el desglose completo para la barra seleccionada (Modal Ver Datos)
     * @param {Object} params { cuentaventa, fechacarga, clientes }
     */
    async obtenerDetalle(params) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DETALLE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener detalle en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene los filtros específicos de la vista de líneas (vencimiento, decisión, observación)
     */
    async obtenerFiltrosLinea() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS_LINEA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener filtros línea en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene la data agrupada por cuenta y zona fiscal para los gráficos de líneas
     * @param {Object} filtros { fecha_inicio, fecha_fin, cuentas, vencimientos, decisiones, observaciones }
     */
    async obtenerGraficoLineaData(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICO_LINEA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener datos línea en saldosService:', error);
            throw error;
        }
    }
}

window.saldosService = saldosService;