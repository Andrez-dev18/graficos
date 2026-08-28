
/**
 * Función segura para obtener el usuario en cualquier parte.
 * NO tiene efectos secundarios (no redirige ni modifica el DOM).
 */
window.getUsuarioSesion = function() {
    const data = sessionStorage.getItem("usuario");
    if (!data) return null;
    
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("Error al leer datos del usuario", e);
        return null;
    }
};

