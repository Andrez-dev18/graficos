class GestionUsuariosController {
    constructor() {
        this.config = AppConfig;
        this.service = new GestionUsuariosService();
        this.registroSeleccionado = null;
        this.dataTable = null;
    }

    async init() {
        this.setupEventListeners();
        this.renderizarTablaGestionUsuarios();
    }

    setupEventListeners() {
        // Botón "Nuevo Registro"
        document.getElementById('btnNuevo')?.addEventListener('click', () => this.abrirModalUsuario());

        // Modal Crear/Editar
        document.getElementById('btnCerrarModalUsuario')?.addEventListener('click', () => this.cerrarModalUsuario());
        document.getElementById('btnCancelarUsuario')?.addEventListener('click', () => this.cerrarModalUsuario());
        document.getElementById('formUsuario')?.addEventListener('submit', (e) => this.guardarFormUsuario(e));

        // Modal Reset Password
        document.getElementById('btnCerrarModalPass')?.addEventListener('click', () => this.cerrarModalResetPass());
        document.getElementById('btnCancelarPass')?.addEventListener('click', () => this.cerrarModalResetPass());
        document.getElementById('formResetPass')?.addEventListener('submit', (e) => this.procesarResetPass(e));

        document.getElementById('btnBuscarDni')?.addEventListener('click', () => this.ejecutarAutocompletadoDni());
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

    // Función auxiliar para no repetir código
    mostrarError(elementoMensaje, texto) {
        elementoMensaje.textContent = texto;
        elementoMensaje.classList.remove('hidden');
    }

    modificarSeleccionado() {
        if (!this.registroSeleccionado) return;

        document.getElementById('modalTitle').textContent = 'Modificar Registro';
        this.cargarDatosEnFormulario();
        const modal = document.getElementById('modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }

    cargarDatosEnFormulario() {
        document.getElementById('inputCodigo').value = this.registroSeleccionado.codigo || '';
        document.getElementById('inputNombre').value = this.registroSeleccionado.nombre || '';
        const selectRol = document.getElementById('selectRolFlujo');
        selectRol.value = this.registroSeleccionado.rol_flujo || '';
    }

    cerrarModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }

        this.registroSeleccionado = null;
        document.getElementById('modalForm').reset();
    }


    renderizarTablaGestionUsuarios() {
        if (!document.getElementById('dataTableUser')) return;
        const tableElement = $('#dataTableUser');
        if (!tableElement.length) return;

        if ($.fn.DataTable.isDataTable(tableElement)) {
            tableElement.DataTable().clear().destroy();
        }

        this.dataTableGestion = tableElement.DataTable({
            processing: true,
            serverSide: true,

            ajax: async (dataRequests, callback, settings) => {
                try {
                    const response = await this.service.getGestionUsuarios(dataRequests);
                    // Retornamos la respuesta estructurada al callback interno de DataTables
                    callback({
                        draw: response.draw || dataRequests.draw,
                        recordsTotal: response.recordsTotal,
                        recordsFiltered: response.recordsFiltered,
                        data: response.data
                    });
                } catch (error) {
                    console.error("Error al cargar la tabla de usuarios:", error);
                    callback({ draw: dataRequests.draw, recordsTotal: 0, recordsFiltered: 0, data: [] });
                }
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: (data, type, row, meta) => meta.row + meta.settings._iDisplayStart + 1
                },
                { data: 'codigo', className: 'text-center' },
                { data: 'nombre', className: 'text-left' },
                { data: 'ruc', className: 'text-left' },
                {
                    data: 'estado',
                    className: 'text-left',
                    render: (data) => data === 'A'
                        ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">ACTIVO</span>'
                        : '<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">INACTIVO</span>'
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: (data, type, row) => `
                        <div class="flex gap-2 justify-center">
                            <button type="button" class="btn-editar-user bg-blue-100 hover:bg-blue-200 text-blue-600 px-2 py-1.5 rounded transition-colors shadow-sm" title="Editar Nombre" data-codigo="${row.codigo}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn-reset-pass bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1.5 rounded transition-colors shadow-sm" title="Cambiar Contraseña" data-codigo="${row.codigo}" data-nombre="${row.nombre}">
                                <i class="fas fa-key"></i>
                            </button>
                            <button type="button" class="btn-toggle-estado ${row.estado === 'A' ? 'bg-red-100 hover:bg-red-200 text-red-600' : 'bg-green-100 hover:bg-green-200 text-green-600'} px-2 py-1.5 rounded transition-colors shadow-sm" title="${row.estado === 'A' ? 'Desactivar' : 'Activar'} Usuario" data-codigo="${row.codigo}" data-estado="${row.estado}">
                                <i class="fas fa-power-off"></i>
                            </button>
                        </div>
                    `
                }
            ],
            order: [[1, 'asc']],
            scrollX: true,
            responsive: false,
            pageLength: 10,
            language: { url: 'https://cdn.datatables.net/plug-ins/2.0.8/i18n/es-ES.json' }
        });

        // ==========================================
        // CORRECCIÓN DE EVENTOS PARA ABRIR MODALES
        // ==========================================
        const self = this;

        // 1. Limpiamos eventos previos para evitar ejecuciones dobles
        tableElement.off('click', '.btn-editar-user');
        tableElement.off('click', '.btn-reset-pass');
        tableElement.off('click', '.btn-toggle-estado');

        // 2. Asignamos usando delegación estricta de jQuery
        tableElement.on('click', '.btn-editar-user', function () {
            const codigo = $(this).attr('data-codigo');
            self.abrirModalUsuario(codigo);
        });

        tableElement.on('click', '.btn-reset-pass', function () {
            const codigo = $(this).attr('data-codigo');
            const nombre = $(this).attr('data-nombre');
            self.abrirModalResetPass(codigo, nombre);
        });

        tableElement.on('click', '.btn-toggle-estado', function () {
            const codigo = $(this).attr('data-codigo');
            const estado = $(this).attr('data-estado');
            self.toggleEstadoUsuario(codigo, estado);
        });
    }

    async abrirModalUsuario(codigo = null) {
        const modal = document.getElementById('modalUsuario');
        const form = document.getElementById('formUsuario');
        const title = document.getElementById('modalUsuarioTitle');
        const passContainer = document.getElementById('passwordContainer');
        const inputIsEdit = document.getElementById('user_is_edit');
        const inputCodigo = document.getElementById('user_codigo');
        const inputPassword = document.getElementById('user_password');

        form.reset();

        if (codigo) {
            // MODO EDICIÓN
            inputIsEdit.value = 'true';
            title.innerHTML = '<i class="fas fa-user-edit"></i> Editar Usuario';
            passContainer.style.display = 'none'; // Ocultamos contraseña
            inputCodigo.readOnly = true;
            inputCodigo.classList.add('bg-gray-100', 'cursor-not-allowed');
            inputPassword.removeAttribute('required'); // Quitamos required a la password

            // Cargar datos
            const response = await this.service.obtenerUsuario(codigo);
            if (response.success && response.data) {
                inputCodigo.value = response.data.codigo;
                document.getElementById('user_nombre').value = response.data.nombre;
                document.getElementById('user_ruc').value = response.data.ruc;
            } else {
                Swal.fire('Error', 'No se pudieron cargar los datos del usuario', 'error');
                return;
            }
        } else {
            // MODO CREACIÓN
            inputIsEdit.value = 'false';
            title.innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Usuario';
            passContainer.style.display = 'block'; // Mostramos contraseña
            inputCodigo.readOnly = false;
            inputCodigo.classList.remove('bg-gray-100', 'cursor-not-allowed');
            inputPassword.setAttribute('required', 'required'); // Password obligatoria
        }

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }

    cerrarModalUsuario() {
        const modal = document.getElementById('modalUsuario');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.getElementById('formUsuario').reset();
    }

    async guardarFormUsuario(e) {
        e.preventDefault();
        const form = document.getElementById('formUsuario');
        const formData = new FormData(form);

        const btnGuardar = document.getElementById('btnGuardarUsuario');
        const textoOriginal = btnGuardar.innerHTML;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;

        try {
            const response = await this.service.guardarUsuario(formData);
            if (response.success) {
                Swal.fire({ icon: 'success', title: '¡Éxito!', text: response.message, timer: 1500, showConfirmButton: false });
                this.cerrarModalUsuario();
                if (this.dataTableGestion) this.dataTableGestion.ajax.reload(null, false);
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Hubo un problema de conexión.', 'error');
        } finally {
            btnGuardar.innerHTML = textoOriginal;
            btnGuardar.disabled = false;
        }
    }

    // --- LÓGICA DE ACTIVAR / DESACTIVAR ---

    toggleEstadoUsuario(codigo, estadoActual) {
        const accionText = estadoActual === 'A' ? 'desactivar' : 'activar';
        const confirmColor = estadoActual === 'A' ? '#ef4444' : '#10b981'; // Rojo o Verde

        Swal.fire({
            title: `¿Deseas ${accionText} este usuario?`,
            text: `El usuario ${codigo} cambiará su estado de acceso.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: confirmColor,
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Sí, ${accionText}`,
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await this.service.cambiarEstado(codigo);
                if (response.success) {
                    Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1500, showConfirmButton: false });
                    if (this.dataTableGestion) this.dataTableGestion.ajax.reload(null, false);
                } else {
                    Swal.fire('Error', response.message, 'error');
                }
            }
        });
    }

    // --- LÓGICA DEL MODAL RESET PASSWORD ---

    abrirModalResetPass(codigo, nombre) {
        document.getElementById('formResetPass').reset();
        document.getElementById('reset_codigo').value = codigo;
        document.getElementById('reset_nombre_display').textContent = `${nombre} (${codigo})`;

        const modal = document.getElementById('modalResetPass');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }

    cerrarModalResetPass() {
        const modal = document.getElementById('modalResetPass');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }

    async procesarResetPass(e) {
        e.preventDefault();

        const codigo = document.getElementById('reset_codigo').value;
        const newPassword = document.getElementById('reset_password').value;

        const btnGuardar = document.getElementById('btnGuardarPass');
        const textoOriginal = btnGuardar.innerHTML;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;

        try {
            const response = await this.service.resetPassword(codigo, newPassword);
            if (response.success) {
                Swal.fire({ icon: 'success', title: 'Contraseña Actualizada', text: `Se cambió la contraseña de ${codigo}`, timer: 1500, showConfirmButton: false });
                this.cerrarModalResetPass();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Hubo un problema de conexión.', 'error');
        } finally {
            btnGuardar.innerHTML = textoOriginal;
            btnGuardar.disabled = false;
        }
    }


    mostrarNotificacion(mensaje, tipo = 'info') {
        let container = document.getElementById('notificaciones-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificaciones-container';
            container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
            document.body.appendChild(container);
        }

        const notif = document.createElement('div');
        const colores = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        const iconos = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notif.className = `${colores[tipo]} text-white px-6 py-4 rounded-lg shadow-lg mb-2 flex items-center gap-3`;
        notif.innerHTML = `
            <span style="font-size: 20px;">${iconos[tipo]}</span>
            <span>${mensaje}</span>
        `;
        container.appendChild(notif);

        setTimeout(() => notif.remove(), 4000);
    }

}

window.gestionUsuariosController = new GestionUsuariosController();

document.addEventListener('DOMContentLoaded', () => {
    window.gestionUsuariosController.init();
});