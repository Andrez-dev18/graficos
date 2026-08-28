class ModulosControlService {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        LISTARMODULOS: '/menu/listar',
        OBTENERMODULOID: '/menu/obtenerPorId',
        LISTARGRUPOS: '/menu/grupos',
        GUARDARMODULO: '/menu/guardar',
        ELIMINARMODULO: '/menu/eliminar',

        UPDATEPASS: '/usuario/updatepass'
    }

    async listarTodos() {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.LISTARMODULOS}`;
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error en listarTodos:', error);
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    }

    async listarGrupos() {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.LISTARGRUPOS}`;
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error en listarGrupos:', error);
            return { success: false, message: 'Error al cargar los grupos' };
        }
    }

    async obtenerPorId(id) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.OBTENERMODULOID}?id=${id}`;
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('Error en obtenerPorId:', error);
            return { success: false, message: 'Error al obtener los datos del módulo' };
        }
    }

    async guardar(data) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.GUARDARMODULO}`;
            const response = await fetch(url, {
                method: 'POST',
                body: data // Enviamos el FormData directamente
            });
            return await response.json();
        } catch (error) {
            console.error('Error en guardar:', error);
            return { success: false, message: 'Error al guardar el módulo' };
        }
    }

    async eliminar(id) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.ELIMINARMODULO}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id })
            });
            return await response.json();
        } catch (error) {
            console.error('Error en eliminar:', error);
            return { success: false, message: 'Error al eliminar el módulo' };
        }
    }

    async cambiarPassword(data) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.UPDATEPASS}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            // Si el backend nos devuelve un HTTP error o el success es false, lanzamos la excepción
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Error al actualizar la contraseña');
            }

            return result;
        } catch (error) {
            console.error('Error en ModulosControlService cambiarPassword:', error);
            throw error;
        }
    }

}

window.ModulosControlService = ModulosControlService;
