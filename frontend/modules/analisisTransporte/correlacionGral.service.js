class CorrelacionGralService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '';
        this.ENDPOINTS = {
            FILTROS: '/analisisTransporte/correlacion-filtros',
            DASHBOARD: '/analisisTransporte/correlacion-general',
            TABLA: '/analisisTransporte/correlacion-tabla',
            SELECCION: '/analisisTransporte/correlacion-seleccion'
        };
    }

    async obtenerFiltros() {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'No se pudieron cargar los filtros.');
        return data.payload.data;
    }

    async obtenerTabla(tabla, filtros) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.TABLA}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ ...filtros, tabla })
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'No se pudo cargar la tabla.');
        return data.payload;
    }

    async obtenerSeleccion(filtros) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.SELECCION}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(filtros)
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'No se pudo cargar la selección.');
        return data.payload;
    }

    async obtenerDashboard(filtros) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DASHBOARD}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(filtros)
        });
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'No se pudo cargar Correlación General.');
        return data.payload;
    }
}

window.CorrelacionGralService = CorrelacionGralService;
