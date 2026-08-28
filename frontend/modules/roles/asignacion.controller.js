class AsignacionController {
    constructor() {
        this.AsignacionRolesService = new AsignacionService();
        this.tableElement = $('#dataTableAsignacion');
        this.modal = document.getElementById('modalAsignacion');
        this.form = document.getElementById('formAsignacion');
        this.contenedorRoles = document.getElementById('contenedorTarjetasRoles');
        this.dataTable = null;
    }

    init() {
        this.renderizarTabla();
        this.vincularEventos();
    }

    vincularEventos() {
        document.getElementById('btnCerrarModalAsignacion').addEventListener('click', () => this.cerrarModal());
        document.getElementById('btnCancelarAsignacion').addEventListener('click', () => this.cerrarModal());
        this.form.addEventListener('submit', (e) => this.procesarGuardado(e));

        // Evento para el botón de la tabla (Delegación)
        this.tableElement.on('click', '.btn-gestionar-roles', (e) => {
            const data = this.dataTable.row($(e.currentTarget).closest('tr')).data();
            this.abrirModal(data.codigo, data.nombre);
        });
    }

    renderizarTabla() {
        this.dataTable = this.tableElement.DataTable({
            processing: true,
            serverSide: true,
            searchDelay: 800,
            // 🚀 CONEXIÓN ENCAPSULADA: Invocamos al Service en vez de quemar variables de rutas
            ajax: async (dataRequests, callback, settings) => {
                try {
                    const response = await this.AsignacionRolesService.obtenerDatatable(dataRequests);
                    callback({
                        draw: response.draw || dataRequests.draw,
                        recordsTotal: response.recordsTotal,
                        recordsFiltered: response.recordsFiltered,
                        data: response.data
                    });
                } catch (error) {
                    console.error("Error al cargar la tabla de asignaciones:", error);
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
                { data: 'codigo', className: 'text-center uppercase' },
                { data: 'nombre', className: 'text-left uppercase' },
                {
                    data: 'roles_asignados',
                    className: 'text-left',
                    render: (data) => {
                        if (!data) return '<span class="text-gray-400 italic text-xs">-- Sin roles --</span>';

                        // Separamos los roles que vienen concatenados con '||' desde el SQL
                        const roles = data.split('||');
                        return `
                            <div class="flex flex-wrap gap-1">
                                ${roles.map(rol => `
                                    <span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-purple-200">
                                        ${rol}
                                    </span>
                                `).join('')}
                            </div>
                        `;
                    }
                },
                {
                    data: null,
                    orderable: false,
                    className: 'text-center',
                    render: () => `
                        <button type="button" class="btn-gestionar-roles bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                            <i class="fas fa-user-cog"></i>
                        </button>
                    `
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/2.0.8/i18n/es-ES.json' }
        });
    }

    async abrirModal(codigo, nombre) {
        // Actualizamos info del usuario en el modal
        document.getElementById('asig_nombre_usuario').textContent = nombre;
        document.getElementById('asig_codigo_usuario').textContent = `Código: ${codigo}`;
        document.getElementById('asig_codigo_oculto').value = codigo;

        this.contenedorRoles.innerHTML = '<div class="p-10 text-center"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>';

        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';

        // Consultamos roles disponibles y roles actuales del usuario
        const response = await this.AsignacionRolesService.obtenerRolesParaUsuario(codigo);

        if (response.success) {
            this.renderizarTarjetasRoles(response.data.roles_disponibles, response.data.roles_usuario);
        } else {
            Swal.fire('Error', 'No se pudieron cargar los roles', 'error');
            this.cerrarModal();
        }
    }

    renderizarTarjetasRoles(disponibles, usuarioRoles) {
        if (disponibles.length === 0) {
            this.contenedorRoles.innerHTML = '<p class="text-center text-gray-500 py-10">No hay roles creados en el sistema.</p>';
            return;
        }

        let html = '';
        disponibles.forEach(rol => {
            const estaMarcado = usuarioRoles.includes(rol.cod_rol) ? 'checked' : '';

            html += `
                <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer transition-all hover:border-indigo-300 has-[:checked]:bg-indigo-50/60 has-[:checked]:border-indigo-500 has-[:checked]:shadow-sm">
                    <div class="mt-0.5">
                        <input type="checkbox" name="roles[]" value="${rol.cod_rol}" ${estaMarcado} class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer">
                    </div>
                    <div class="flex-1">
                        <p class="font-bold text-gray-800 text-sm">${rol.nom_rol}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${rol.cod_rol} - ${rol.descripcion || 'Sin descripción'}</p>
                    </div>
                </label>
            `;
        });
        this.contenedorRoles.innerHTML = html;
    }

    cerrarModal() {
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
        this.form.reset();
    }

    async procesarGuardado(e) {
        e.preventDefault();

        const btn = document.getElementById('btnGuardarAsignacion');
        const originalText = btn.innerHTML;

        // Obtenemos los roles seleccionados
        const checkboxes = this.form.querySelectorAll('input[name="roles[]"]:checked');
        const rolesSeleccionados = Array.from(checkboxes).map(cb => cb.value);

        const payload = {
            codigo: document.getElementById('asig_codigo_oculto').value,
            roles: rolesSeleccionados
        };

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        const response = await this.AsignacionRolesService.guardar(payload);

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (response.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: response.message,
                timer: 1500,
                showConfirmButton: false
            });
            this.cerrarModal();
            this.dataTable.ajax.reload(null, false);
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    }
}

// Inicialización
window.asignacionController = new AsignacionController();

document.addEventListener('DOMContentLoaded', () => {
    window.asignacionController.init();
});