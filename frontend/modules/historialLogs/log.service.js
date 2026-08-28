class LogService {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        LOGS: '/historial/logs',
        FILTROS: '/historial/filtros'
    };


    async getFiltros() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`);
            if (!response.ok) throw new Error('Error al obtener los filtros del historial');
            return await response.json();
        } catch (error) {
            console.error('Error en LogService.getFiltros:', error);
            throw error;
        }
    }


    async getFiltered(dtData) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.LOGS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dtData) 
            });

            if (!response.ok) throw new Error('Error en el filtrado de logs');
            return await response.json();
        } catch (error) {
            console.error('Error en LogService.getFiltered:', error);
            throw error;
        }
    }
}

window.LogService = new LogService();