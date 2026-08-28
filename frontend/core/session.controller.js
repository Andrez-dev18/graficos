document.addEventListener("DOMContentLoaded", async () => {

    try {
        // 1. Preguntar al servidor si la sesión es válida
        const response = await AuthService.validarSesion();

        if (!response.success) {
            console.warn("Sesión inválida o expirada");
            sessionStorage.clear();
            window.location.href = "login.html";
            return;
        }

        //ESTRUCTURA Limpia y sincronizada con el backend de Satisfacción Cliente
        const usuarioData = {
            usuario: response.usuario, 
            nombre: response.nombre,
            rol_comercial: response.rol_comercial,
            rol_flujo: response.rol_flujo,
            ruc: response.ruc,
            epre: response.epre,
        };
        sessionStorage.setItem("usuario", JSON.stringify(usuarioData));

        // 2. Renderizar datos en el HTML
        renderizarInfoUsuario(usuarioData);

    } catch (error) {
        console.error("Error crítico de sesión:", error);
        window.location.href = "login.html";
    }
});

// Función auxiliar para pintar los datos en el header
function renderizarInfoUsuario(usuario) {

    const elRolUser = document.getElementById("username");
    if (elRolUser) {
        elRolUser.textContent = usuario.nombre || "Usuario";
    }

    const elUserName = document.getElementById("dni");
    if (elUserName) {
        elUserName.textContent = usuario.usuario || "dni"; 
    }
}

// Función cerrar sesión
async function cerrarSesion() {
    const result = await Swal.fire({
        title: '¿Estás seguro de que cerrarás sesión?',
        text: "Tu sesión actual se cerrará.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    });

    if (result.isConfirmed) {
        try {
            const response = await AuthService.logout();
            if (response.success) {
                sessionStorage.clear();
                sessionStorage.removeItem('last_dashboard_url');
                sessionStorage.removeItem('last_dashboard_tipo');
                sessionStorage.removeItem('last_dashboard_title');
                window.location.href = "login.html";
            }
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            // Forzar salida aunque falle la petición de red
            sessionStorage.clear();
            window.location.href = "login.html";
        }
    }
}

// =================================================================
// VIGILANTE DE SESIÓN SILENCIOSO (Heartbeat)
// =================================================================
function iniciarVigilanteSesion() {
    // Validamos cada 5 minutos
    const INTERVALO_VALIDACION = 1 * 60 * 1000;

    setInterval(async () => {
        try {
            const response = await AuthService.validarSesion();

            if (!response.success) {
                console.warn("Vigilante: La sesión expiró en el servidor. Expulsando...");
                sessionStorage.clear();
                window.location.href = "login.html";
            }
        } catch (error) {
            console.error("Vigilante: Error de conexión o sesión caída.");
            sessionStorage.clear();
            window.location.href = "login.html";
        }
    }, INTERVALO_VALIDACION);
}

// Inicialización del vigilante
document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        setTimeout(iniciarVigilanteSesion, 5000); // Arranca 5 segundos después de cargar
    }
});