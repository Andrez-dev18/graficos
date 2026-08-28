class GestionUsuariosService {
    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        UPDATEPASS: '/usuario/updatepass',
        //rutas para gestion de usuarios
        OBTENERUSUARIOS: '/usuario/obtener-usuarios',
        OBTENERUSUARIO: '/usuario/unUsuario',
        GUARDARUSUARIO: '/usuario/guardarUsuario',
        CAMBIARESTADO: '/usuario/cambiarEstado',
        RESETPASSWORD: '/usuario/resetPassword',
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
            console.error('Error en UserService.cambiarPassword:', error);
            throw error;
        }
    }

    //
    //funciones para la gestion de usuarios
    //
    async getGestionUsuarios(dtParams) {
        try {
            // Convertimos el objeto complejo de parámetros de DataTables a Query String
            const queryParams = new URLSearchParams();

            // Pasamos los parámetros clave mapeados que espera el backend
            queryParams.append('start', dtParams.start || 0);
            queryParams.append('length', dtParams.length || 10);
            queryParams.append('draw', dtParams.draw || 1);
            queryParams.append('search[value]', dtParams.search?.value || '');
            queryParams.append('order[0][column]', dtParams.order?.[0]?.column || 0);
            queryParams.append('order[0][dir]', dtParams.order?.[0]?.dir || 'asc');

            const url = `${this.baseUrl}${this.ENDPOINTS.OBTENERUSUARIOS}?${queryParams.toString()}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en la paginación server-side de usuarios');
            return await response.json();
        } catch (error) {
            console.error('Error en getGestionUsuarios:', error);
            throw error;
        }
    }

    async obtenerUsuario(codigo) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.OBTENERUSUARIO}?codigo=${codigo}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error de red al obtener el usuario');
            return await response.json();
        } catch (error) {
            console.error('Error en obtenerUsuario:', error);
            return { success: false, message: 'Error al conectar con el servidor' };
        }
    }

    async guardarUsuario(data) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.GUARDARUSUARIO}`;
            const response = await fetch(url, {
                method: 'POST',
                body: data
            });
            if (!response.ok) throw new Error('Error de red al guardar el usuario');
            return await response.json();
        } catch (error) {
            console.error('Error en guardarUsuario:', error);
            return { success: false, message: 'Error al conectar con el servidor' };
        }
    }

    async cambiarEstado(codigo) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.CAMBIARESTADO}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: codigo })
            });
            if (!response.ok) throw new Error('Error de red al cambiar estado');
            return await response.json();
        } catch (error) {
            console.error('Error en cambiarEstado:', error);
            return { success: false, message: 'Error al conectar con el servidor' };
        }
    }

    async resetPassword(codigo, password) {
        try {
            const url = `${this.baseUrl}${this.ENDPOINTS.RESETPASSWORD}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: codigo, password: password })
            });
            if (!response.ok) throw new Error('Error de red al resetear contraseña');
            return await response.json();
        } catch (error) {
            console.error('Error en resetPassword:', error);
            return { success: false, message: 'Error al conectar con el servidor' };
        }
    }


}

window.GestionUsuariosService = GestionUsuariosService;