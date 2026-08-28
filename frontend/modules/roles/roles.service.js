class RolService {

    constructor() {
        this.baseUrl = AppConfig.API.BASE_URL;
    }

    ENDPOINTS = {
        LISTAR: '/roles/listar',
        MODULOS: '/roles/modulos',
        OBTENER: '/roles/obtener',
        GUARDAR: '/roles/guardar',
        ELIMINAR: '/roles/eliminar',
        CAMBIAR_ESTADO: '/roles/estado'
    }

    async listarRoles() {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.LISTAR}`);
        return await response.json();
    }

    async obtenerModulos() {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.MODULOS}`);
        return await response.json();
    }

    async obtenerPorId(id) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.OBTENER}?id=${id}`);
        return await response.json();
    }

    async guardar(data) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GUARDAR}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    async eliminar(id) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.ELIMINAR}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return await response.json();
    }

    async cambiarEstado(id, estado) {
        const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.CAMBIAR_ESTADO}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado })
        });
        return await response.json();
    }
}