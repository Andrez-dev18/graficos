class ConfigPresupuestoService {

    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        DATATABLE: '/PresupuestosPAB/acceso/datatable',
        OBTENER_DATOS: '/PresupuestosPAB/acceso/obtenerDatos',
        GUARDAR: '/PresupuestosPAB/acceso/guardar'
    }

    async obtenerDatatable(dtParams) {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('start', dtParams.start || 0);
            queryParams.append('length', dtParams.length || 10);
            queryParams.append('draw', dtParams.draw || 1);
            queryParams.append('search[value]', dtParams.search?.value || '');

            const url = `${this.baseUrl}${this.ENDPOINTS.DATATABLE}?${queryParams.toString()}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en la paginación server-side de asignaciones');
            return await response.json();
        } catch (error) {
            console.error('Error en ConfigPresupuestoService.obtenerDatatable:', error);
            throw error;
        }
    }

    async obtenerPresupuestosParaUsuario(codigo) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.OBTENER_DATOS}?codigo=${encodeURIComponent(codigo)}`;
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error en obtenerPresupuestosParaUsuario:', error);
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    }

    async guardar(payload) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.GUARDAR}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('Error en guardar presupuestos:', error);
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    }
}
