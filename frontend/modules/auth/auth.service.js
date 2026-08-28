class AuthService {
    static async login(usuario, password) {
        const url = `${AppConfig.API.BASE_URL}${AppConfig.API.ENDPOINTS.AUTH.LOGIN}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', //  necesario para mantener sesión
            body: JSON.stringify({ usuario, password })
        });
        return await response.json();
    }

    static async validarSesion() {
        const url = `${AppConfig.API.BASE_URL}${AppConfig.API.ENDPOINTS.AUTH.VALIDAR}`;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        return await response.json();
    }

    static async logout() {
        const url = `${AppConfig.API.BASE_URL}${AppConfig.API.ENDPOINTS.AUTH.LOGOUT}`;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });
        return await response.json();
    }

    static async obtenerMenu() {
        try {
            const url = `${AppConfig.API.BASE_URL}${AppConfig.API.ENDPOINTS.AUTH.OBTENERMENU}`;

            // CORRECCIÓN: Agregar credentials include para que PHP reconozca tu sesión activa
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al obtener el menú dinámico:', error);
            return { success: false, data: [] };
        }
    }

}

window.AuthService = AuthService;
