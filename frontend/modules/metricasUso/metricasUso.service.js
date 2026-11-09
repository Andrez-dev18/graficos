class MetricasUsoService {
    constructor() {
        this.baseUrl = this.obtenerBaseUrl();
    }

    obtenerBaseUrl() {
        if (window.parent && window.parent !== window && window.parent.AppConfig && window.parent.AppConfig.API) {
            return window.parent.AppConfig.API.BASE_URL;
        }

        if (window.AppConfig && window.AppConfig.API) {
            return window.AppConfig.API.BASE_URL;
        }

        return 'http://localhost/corebi/backend';
    }

    async obtenerDashboard(desde, hasta) {
        const parametros = new URLSearchParams({ desde, hasta });
        const response = await fetch(`${this.baseUrl}/metricasUso/dashboard?${parametros.toString()}`, {
            method: 'GET',
            credentials: 'include'
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            const error = new Error((data && data.message) || `Error HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        if (!data || !data.success) {
            throw new Error((data && data.message) || 'No se pudieron obtener las métricas de uso');
        }

        return data.data;
    }

    async obtenerDatatable(endpoint, dtParams, periodo) {
        const params = new URLSearchParams();

        params.append('desde', periodo && periodo.desde ? periodo.desde : '');
        params.append('hasta', periodo && periodo.hasta ? periodo.hasta : '');
        params.append('draw', dtParams.draw || 1);
        params.append('start', dtParams.start || 0);
        params.append('length', dtParams.length || 10);
        params.append('search[value]', dtParams.search?.value || '');
        params.append('order[0][column]', dtParams.order?.[0]?.column ?? 0);
        params.append('order[0][dir]', dtParams.order?.[0]?.dir || 'asc');

        const response = await fetch(`${this.baseUrl}${endpoint}?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            const error = new Error((data && (data.error || data.message)) || `Error HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    async obtenerModulosDatatable(dtParams, periodo) {
        return this.obtenerDatatable('/metricasUso/modulos/datatable', dtParams, periodo);
    }

    async obtenerUsuariosDatatable(dtParams, periodo) {
        return this.obtenerDatatable('/metricasUso/usuarios/datatable', dtParams, periodo);
    }

    async obtenerInactivosDatatable(dtParams, periodo) {
        return this.obtenerDatatable('/metricasUso/inactivos/datatable', dtParams, periodo);
    }
}

window.MetricasUsoService = MetricasUsoService;
