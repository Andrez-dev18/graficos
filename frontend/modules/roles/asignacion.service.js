class AsignacionService {

    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        DATATABLE: '/roles/asignacionRoles/datatable',
        OBTENER_ROLES: '/roles/asignacionRoles/obtenerDatosParaRoles',
        GUARDAR: '/roles/asignacionRoles/guardar'
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
            console.error('Error en AsignacionService.obtenerDatatable:', error);
            throw error;
        }
    }

    async obtenerRolesParaUsuario(codigo) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.OBTENER_ROLES}?codigo=${codigo}`; 
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error en obtenerRolesParaUsuario:', error);
            return { success: false, message: 'Error de conexión' };
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
            console.error('Error en guardar roles:', error);
            return { success: false, message: 'Error de conexión' };
        }
    }
}