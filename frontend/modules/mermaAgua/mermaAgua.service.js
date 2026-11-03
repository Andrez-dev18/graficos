class MermaAguaService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '';
        this.endpoints = {
            VISTA_PROCESO: '/mermaAgua/vista-proceso'
        };
    }

    async obtenerVistaProceso(filtros = {}) {
        const response = await fetch(`${this.baseUrl}${this.endpoints.VISTA_PROCESO}`, {
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
            throw new Error(data?.message || 'No se pudo cargar VistaProceso de Merma de Agua.');
        }

        return data.payload;
    }
}

window.MermaAguaService = MermaAguaService;
