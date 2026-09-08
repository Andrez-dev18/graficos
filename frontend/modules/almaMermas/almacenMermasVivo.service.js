/**
 * Servicio para gestión y consumo de endpoints del módulo Almacén Mermas Vivo
 */
class AlmacenMermasVivoService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend/public';

        this.ENDPOINTS = {
            PORC_MERMA_PROCESO_DIA_CLIENTE_PLACA: '/almaMermas/porc-merma-proceso-dia-cliente-placa',
            PORC_MERMA_PROCESO_DIA_CLIENTE:       '/almaMermas/porc-merma-proceso-dia-cliente',
            PORC_MERMA_PROCESO_DIA_CLIENTE_ZONA:  '/almaMermas/porc-merma-proceso-dia-cliente-zona',
            PORC_MERMA_PROCESO_DIA_CLIENTE_ZONA_PLACA: '/almaMermas/porc-merma-proceso-dia-cliente-zona-placa'
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
            } else if (tipoGrafico === 'PorcMermaProcesoDiaClienteZonaPlaca') {
                endpoint = this.ENDPOINTS.PORC_MERMA_PROCESO_DIA_CLIENTE_ZONA_PLACA;
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
}

window.AlmacenMermasVivoService = AlmacenMermasVivoService;