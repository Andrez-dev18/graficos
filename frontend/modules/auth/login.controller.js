document.addEventListener('DOMContentLoaded', async function () {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const loading = document.getElementById('loading');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const submitBtn = loginForm?.querySelector('button[type="submit"]');

    // 1. VALIDACIÓN DE SESIÓN INICIAL
    const sesion = await AuthService.validarSesion();
    if (sesion.success) {
        console.log("Sesión activa, redirigiendo...");
        window.location.href = 'index.html';
        return; // Detenemos la ejecución aquí
    } else {
        sessionStorage.removeItem('usuario');
    }

    // 2. MOSTRAR / OCULTAR CONTRASEÑA
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            togglePassword.innerHTML = type === 'password'
                ? '<i class="fas fa-eye"></i>'
                : '<i class="fas fa-eye-slash"></i>';
        });
    }

    // 3. MANEJAR ENVÍO DEL FORMULARIO
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            errorMessage?.classList.add('hidden');
            submitBtn.disabled = true;

            // 1. APARECE EL LOADING
            loading.classList.remove('hidden');
            loading.classList.add('flex');

            try {
                const usuario = document.getElementById('usuario').value.trim();
                const password = document.getElementById('password').value.trim();

                const ubicacion = await obtenerUbicacion();

                // 2. HACEMOS LAS DOS COSAS AL MISMO TIEMPO: 
                // La petición real al servidor Y un temporizador falso de 1.2 segundos
                const [data] = await Promise.all([
                    AuthService.login(usuario, password, ubicacion),
                    new Promise(resolve => setTimeout(resolve, 1200)) // <--- AQUÍ ESTÁ EL TRUCO
                ]);

                if (data && data.success) {
                    sessionStorage.setItem('usuario', JSON.stringify(data.data));
                    window.location.href = 'index.html';
                } else {
                    if (errorMessage) {
                        const spanError = errorMessage.querySelector('span');
                        if (spanError) {
                            // Usamos el mensaje del backend, o un texto por defecto si viene vacío
                            spanError.textContent = data.message || 'Usuario o contraseña incorrectos.';
                        }
                        errorMessage.classList.remove('hidden');
                    }
                }
            } catch (error) {
                console.error('Error:', error);
                if (errorMessage) {
                    const spanError = errorMessage.querySelector('span');
                    if (spanError) {
                        spanError.textContent = 'Hubo un error de conexión con el servidor.';
                    }
                    errorMessage.classList.remove('hidden');
                }
            } finally {
                // 3. SE OCULTA EL LOADING (después de al menos 1.2 segundos)
                loading.classList.add('hidden');
                loading.classList.remove('flex');
                submitBtn.disabled = false;
            }
        });
    }
});

// Función de ubicación sin cambios
function obtenerUbicacion() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            err => resolve(null) // Usuario negó permiso o error
        );
    });
}