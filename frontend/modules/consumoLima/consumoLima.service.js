class ConsumoLimaService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';

        this.ENDPOINTS = {
            FILTROS: '/consumoLima/filtros',
            CONSUMOS: '/consumoLima/consumos',
            COMPRAS_ALMACEN: '/consumoLima/compras-almacen',
            COMPRAS_DOCUMENTOS: '/consumoLima/compras-documentos',
            TABULACIONES_PU: '/consumoLima/tabulaciones-pu',
            ANALISIS_MERMAS: '/consumoLima/analisis-mermas'
        };
    }

    async postJson(endpoint, payload, mensajeError) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
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

    async obtenerFiltros() {
        return this.postJson(this.ENDPOINTS.FILTROS, {}, 'No se pudieron obtener los filtros de Consumos Lima.');
    }

    async obtenerConsumos(filtros) {
        return this.postJson(this.ENDPOINTS.CONSUMOS, filtros, 'No se pudo consultar Consumos.');
    }

    async obtenerComprasAlmacen(filtros) {
        return this.postJson(this.ENDPOINTS.COMPRAS_ALMACEN, filtros, 'No se pudo consultar ComprasAlmacén.');
    }

    async obtenerComprasDocumentos(filtros) {
        return this.postJson(this.ENDPOINTS.COMPRAS_DOCUMENTOS, filtros, 'No se pudo consultar ComprasDocumentos.');
    }

    async obtenerTabulacionesPu(filtros) {
        return this.postJson(this.ENDPOINTS.TABULACIONES_PU, filtros, 'No se pudo consultar Tabulaciones de PU.');
    }

    async obtenerAnalisisMermas(filtros) {
        return this.postJson(this.ENDPOINTS.ANALISIS_MERMAS, filtros, 'No se pudo consultar AnalisisMermas.');
    }
}

window.ConsumoLimaService = ConsumoLimaService;
