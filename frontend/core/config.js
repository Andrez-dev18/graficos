
// === INTERCEPTOR GLOBAL DE FETCH (SOLUCIÓN MAESTRA) ===
// Inyecta credentials y atrapa errores 401 en TODAS las peticiones automáticamente
(function () {
    const originalFetch = window.fetch;

    window.fetch = async function (url, config = {}) {
        if (!config) config = {};
        if (!config.credentials) {
            config.credentials = 'include';
        }

        try {
            const response = await originalFetch(url, config);

            // Si el servidor dice "401 No Autorizado"
            if (response.status === 401) {

                // EXCEPCIÓN 1: Si el usuario se equivocó de clave al hacer login,
                // dejamos pasar la respuesta para que el controlador muestre el mensaje de error.
                if (url.includes('/usuario/login')) {
                    return response;
                }

                // EXCEPCIÓN 2: Si ya estamos físicamente en la página de login
                // (ej. validando la sesión al entrar), detenemos el error sin recargar la página.
                if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/frontend/')) {
                    return response;
                }

                // EXPULSIÓN: Si está en el dashboard u otra página, limpiamos y lo botamos.
                console.error("Sesión expirada. Expulsando...");
                sessionStorage.clear();

                // Ajusta esta ruta a la ubicación exacta de tu login
                window.top.location.href = '/corebi/frontend/login.html';

                return Promise.reject(new Error("Sesión expirada"));
            }

            return response;
        } catch (error) {
            throw error;
        }
    };
})();
// =======================================================

const AppConfig = {
    API: {
        BASE_URL: 'http://localhost/corebi/backend',
        ENDPOINTS: {
            AUTH: {
                LOGIN: '/usuario/login',
                VALIDAR: '/usuario/validarSesion',
                LOGOUT: '/usuario/logout',
                OBTENERMENU: '/menu/obtener'
            },
        }
    },

};

window.AppConfig = AppConfig;

// MÓDULO DE SEGURIDAD GLOBAL (RBAC)
const AppSecurity = {
    /**
     * Obtiene los datos del usuario logueado desde la sesión.
     * Ajusta la clave 'usuario' si en tu sessionStorage se llama diferente.
     */
    getUserData: function () {
        try {
            const userData = sessionStorage.getItem("usuario"); // Cambia esto si usas otra clave
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            console.error("Error leyendo datos de sesión", e);
            return null;
        }
    },

    /**
     * Lógica central de permisos:
     * - ADMIN: Permiso total.
     * - USER + RUC LIMA: Permiso total.
     * - Otros: Falso (solo lectura).
     */
    puedeEditar: function () {
        const user = this.getUserData();
        if (!user) return false;

        const rol = (user.rol_comercial || '').toUpperCase();
        const ruc = (user.ruc || '').toUpperCase();

        if (rol === 'ADMIN') {
            return true;
        }

        if (rol === 'USER' && ruc === 'LIMA') {
            return true;
        }

        return false; // Cualquier otro caso no tiene permisos
    },

    puedeEditarTemporal: function () {
        const user = this.getUserData();
        if (!user) return false;

        const usuario = (user.usuario || '').toUpperCase();
        const ruc = (user.ruc || '').toUpperCase();
        //console.log("Usuario para permisos temporales:", usuario);
        if (usuario === 'RODRI' || usuario === 'WAGNER' || ruc === 'LIMA') {
            return true;
        }


        return false; // Cualquier otro caso no tiene permisos
    }
};
window.AppSecurity = AppSecurity;

(function () {
    const STORAGE_KEY = '__corebiChartSelection';
    const MAX_AGE = 8000;

    function obtenerPendiente() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);

            if (!raw) return null;

            const pendiente = JSON.parse(raw);

            if (!pendiente || typeof pendiente !== 'object') {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }

            if (pendiente.ts && Date.now() - pendiente.ts > MAX_AGE) {
                sessionStorage.removeItem(STORAGE_KEY);
                return null;
            }

            return pendiente;
        } catch (error) {
            return null;
        }
    }

    function buscarSelect(pendiente) {
        if (pendiente.selectorId) {
            const porId = document.getElementById(pendiente.selectorId);

            if (porId) return porId;
        }

        if (pendiente.selectorName) {
            return Array.from(document.querySelectorAll('select'))
                .find(select => select.getAttribute('name') === pendiente.selectorName) || null;
        }

        return null;
    }

    function aplicarPendiente() {
        const pendiente = obtenerPendiente();

        if (!pendiente) return true;

        if (pendiente.url && pendiente.url !== window.location.pathname) {
            return true;
        }

        const select = buscarSelect(pendiente);

        if (!select) return false;

        const existe = Array.from(select.options).some(option => option.value === pendiente.value);

        if (!existe) return false;

        select.value = pendiente.value;
        sessionStorage.removeItem(STORAGE_KEY);

        return true;
    }

    if (!aplicarPendiente()) {
        document.addEventListener('DOMContentLoaded', () => {
            if (aplicarPendiente()) return;

            setTimeout(aplicarPendiente, 100);
        }, { once: true });
    }
})();
