class EventosMermaService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '../../backend';

        this.ENDPOINTS = {
            FILTROS: '/eventosMerma/filtros',
            DASH_ANALISIS: '/eventosMerma/dash-analisis',
            LISTADO: '/eventosMerma/dash-analisis/listado',
            PORC: '/eventosMerma/porc',
            PORC_DIA: '/eventosMerma/porc-dia',
            CANT_DIA: '/eventosMerma/cant-dia',
            PARETO: '/eventosMerma/pareto'
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
        return this.postJson(this.ENDPOINTS.FILTROS, {}, 'No se pudieron obtener los filtros de Eventos Merma.');
    }

    async obtenerDashAnalisis(filtros) {
        return this.postJson(this.ENDPOINTS.DASH_ANALISIS, filtros, 'No se pudo consultar DashAnalisis.');
    }

    async obtenerListado(filtros) {
        return this.postJson(this.ENDPOINTS.LISTADO, filtros, 'No se pudo consultar el listado de Eventos Merma.');
    }

    async obtenerPorc(filtros) {
        return this.postJson(this.ENDPOINTS.PORC, filtros, 'No se pudo consultar Porc de Eventos Merma.');
    }

    async obtenerPorcDia(filtros) {
        return this.postJson(this.ENDPOINTS.PORC_DIA, filtros, 'No se pudo consultar PorcDia de Eventos Merma.');
    }

    async obtenerCantDia(filtros) {
        return this.postJson(this.ENDPOINTS.CANT_DIA, filtros, 'No se pudo consultar CantDia de Eventos Merma.');
    }

    async obtenerPareto(filtros) {
        return this.postJson(this.ENDPOINTS.PARETO, filtros, 'No se pudo consultar Pareto de Eventos Merma.');
    }
}

window.EventosMermaService = EventosMermaService;
