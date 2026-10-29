/**
 * Servicio para gestión y consumo de endpoints del módulo Almacén Mermas Vivo
 */
class AlmacenMermasVivoService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL;

        this.ENDPOINTS = {
            PORC_MERMA_PROCESO_DIA_CLIENTE_PLACA: '/almaMermas/porc-merma-proceso-dia-cliente-placa',
            PORC_MERMA_PROCESO_DIA_CLIENTE: '/almaMermas/porc-merma-proceso-dia-cliente',
            PORC_MERMA_PROCESO_DIA_CLIENTE_ZONA: '/almaMermas/porc-merma-proceso-dia-cliente-zona',
            PORC_MERMA_DIARIA_PROCESO: '/almaMermas/porc-merma-diaria-proceso',
            PORC_MERMA_DIARIA_PROCESO_MES: '/almaMermas/porc-merma-diaria-proceso-mes',
            PORC_MERMA_DIARIA_PROCESO_MES_ZONA: '/almaMermas/porc-merma-diaria-proceso-mes-zona',
            PORC_MERMA_DIARIA_PROCESO_CLIENTE: '/almaMermas/porc-merma-diaria-proceso-cliente',
            PORC_MERMA_DIARIA_PROCESO_CLIENTE_PLACA: '/almaMermas/porc-merma-diaria-proceso-cliente-placa',
            FILTROS_MERMA: '/almaMermas/filtros-merma',
            DASH_PRUEBA_1: '/almaMermas/merma-proceso-placa-objetivo',
            DETALLE_PLACA_RUTA_CAUSALES: '/almaMermas/detalle-placa-ruta-causales',
            TENDENCIA_MERMAS: '/almaMermas/tendencia-mermas'
        };
    }

    /**
     * Consulta el gráfico seleccionado del módulo
     */
    async consultarGrafico(tipoGrafico, filtros) {
        try {
            let endpoint = this.ENDPOINTS.PORC_MERMA_PROCESO_DIA_CLIENTE_PLACA;

            if (tipoGrafico === 'PorcMermaProcesoDiaCliente') {
                endpoint = this.ENDPOINTS.PORC_MERMA_PROCESO_DIA_CLIENTE;
            } else if (tipoGrafico === 'PorcMermaProcesoDiaClienteZona') {
                endpoint = this.ENDPOINTS.PORC_MERMA_PROCESO_DIA_CLIENTE_ZONA;
            } else if (tipoGrafico === 'PorcMermaDiariaProceso') {
                endpoint = this.ENDPOINTS.PORC_MERMA_DIARIA_PROCESO;
            } else if (tipoGrafico === 'PorcMermaDiariaProcesoMes') {
                endpoint = this.ENDPOINTS.PORC_MERMA_DIARIA_PROCESO_MES;
            } else if (tipoGrafico === 'PorcMermaDiariaProcesoMesZona') {
                endpoint = this.ENDPOINTS.PORC_MERMA_DIARIA_PROCESO_MES_ZONA;
            } else if (tipoGrafico === 'PorcMermaDiariaProcesoCiente') {
                endpoint = this.ENDPOINTS.PORC_MERMA_DIARIA_PROCESO_CLIENTE;
            } else if (tipoGrafico === 'PorcMermaDiariaProcesoCientePlaca') {
                endpoint = this.ENDPOINTS.PORC_MERMA_DIARIA_PROCESO_CLIENTE_PLACA;
            } else if (tipoGrafico === 'DashPrueba1') {
                endpoint = this.ENDPOINTS.DASH_PRUEBA_1;
            } else if (tipoGrafico === 'TendenciaMermas') {
                endpoint = this.ENDPOINTS.TENDENCIA_MERMAS;
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
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

            return await response.json();
        } catch (error) {
            console.error(`Error al consultar ${tipoGrafico} en AlmacenMermasVivoService:`, error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    async obtenerFiltrosMerma() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS_MERMA}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al consultar filtros de mermas:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }

    async consultarDetallePlacaRutaCausales(payload) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DETALLE_PLACA_RUTA_CAUSALES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al consultar DetallePlacaRutaCausales en AlmacenMermasVivoService:', error);
            return {
                success: false,
                message: error.message,
                payload: null
            };
        }
    }
}

window.AlmacenMermasVivoService = AlmacenMermasVivoService;
