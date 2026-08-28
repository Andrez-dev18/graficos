class CambiarContraController {
    constructor() {
        this.service = new ModulosControlService();
    }

    async init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('btnGuardarPassword')?.addEventListener('click', () => this.procesarCambioPassword());
    }

    async procesarCambioPassword() {
        const oldPassInput = document.getElementById('oldPassword');
        const newPassInput = document.getElementById('newPassword');
        const confirmPassInput = document.getElementById('confirmPassword');
        const errorMsg = document.getElementById('passwordErrorMsg');
        const btnGuardar = document.getElementById('btnGuardarPassword');

        const oldPassword = oldPassInput.value;
        const newPassword = newPassInput.value;
        const confirmPassword = confirmPassInput.value;

        // 1. Validaciones locales
        if (!oldPassword || !newPassword || !confirmPassword) {
            this.mostrarError(errorMsg, "Todos los campos son obligatorios.");
            return;
        }

        if (newPassword !== confirmPassword) {
            this.mostrarError(errorMsg, "Las contraseñas nuevas no coinciden.");
            return;
        }

        errorMsg.classList.add('hidden');

        // 2. Estado visual: Cargando
        const textoOriginal = btnGuardar.innerHTML;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        btnGuardar.disabled = true;
        btnGuardar.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            // 3. Llamada al Service
            const data = { oldPassword, newPassword, confirmPassword };
            const response = await this.service.cambiarPassword(data);

            // 4. Estado visual: Éxito
            btnGuardar.innerHTML = '<i class="fas fa-check"></i> ¡Actualizado!';
            btnGuardar.classList.replace('bg-blue-600', 'bg-green-600');

            // Esperamos un segundo para que el usuario vea el check verde y cerramos el modal
            setTimeout(() => {
                cerrarModalPassword(); // Función que ya tenías en tu script HTML

                // Opcional: Mostrar SweetAlert si lo tienes en tu proyecto
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Éxito!',
                        text: response.message,
                        confirmButtonColor: '#2563eb'
                    });
                }
            }, 1000);

        } catch (error) {
            // 5. Estado visual: Error
            this.mostrarError(errorMsg, error.message);

            btnGuardar.innerHTML = '<i class="fas fa-times"></i> Error';
            btnGuardar.classList.replace('bg-blue-600', 'bg-red-600');
        } finally {
            // 6. Restaurar el botón a su estado normal después de 2 segundos
            setTimeout(() => {
                btnGuardar.innerHTML = textoOriginal;
                btnGuardar.classList.remove('bg-green-600', 'bg-red-600', 'opacity-75', 'cursor-not-allowed');
                btnGuardar.classList.add('bg-blue-600');
                btnGuardar.disabled = false;
            }, 2000);
        }
    }

}

window.cambiarContraController = new CambiarContraController();

document.addEventListener('DOMContentLoaded', () => {
    window.cambiarContraController.init();
});