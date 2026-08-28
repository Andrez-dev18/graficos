class RolController {
    constructor() {
        this.RolService = new RolService();
        this.tableBody = document.getElementById('tableBodyRoles');
        this.modal = document.getElementById('modalRol');
        this.form = document.getElementById('formRol');
        this.arbolContainer = document.getElementById('arbolPermisosContainer');
        this.modulosRaw = [];
    }

    async init() {
        this.vincularEventos();
        await this.cargarModulosBase();
        this.cargarTabla();
    }

    vincularEventos() {
        document.getElementById('btnNuevoRol').addEventListener('click', () => this.abrirModal());
        document.getElementById('btnCerrarModalRol').addEventListener('click', () => this.cerrarModal());
        document.getElementById('btnCancelarRol').addEventListener('click', () => this.cerrarModal());
        this.form.addEventListener('submit', (e) => this.procesarGuardado(e));

        this.tableBody.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar-rol');
            const btnEliminar = e.target.closest('.btn-eliminar-rol');
            const btnToggle = e.target.closest('.btn-toggle-estado-rol');

            if (btnEditar) this.editarRol(btnEditar.dataset.id);
            if (btnEliminar) this.eliminarRol(btnEliminar.dataset.id);

            if (btnToggle) {
                this.toggleEstadoRol(btnToggle.dataset.id, btnToggle.dataset.estado, btnToggle.dataset.codigo);
            }
        });

        this.arbolContainer.addEventListener('change', (e) => {
            const checkbox = e.target;

            if (checkbox.classList.contains('check-permiso')) {

                if (checkbox.classList.contains('check-padre')) {
                    const grupo = checkbox.closest('.modulo-grupo');
                    const hijos = grupo.querySelector('.contenedor-hijos').querySelectorAll('.check-permiso');
                    hijos.forEach(hijo => hijo.checked = checkbox.checked);
                }


                if (checkbox.checked) {
                    let actual = checkbox.closest('.contenedor-hijos');
                    while (actual) {
                        const padreGrupo = actual.closest('.modulo-grupo');
                        if (padreGrupo) {
                            const checkDelPadre = padreGrupo.querySelector('.check-padre');
                            if (checkDelPadre) checkDelPadre.checked = true;
                        }
                        actual = padreGrupo ? padreGrupo.closest('.contenedor-hijos') : null;
                    }
                }

                this.actualizarContadorPermisos();
            }
        });

        // Evento para Plegar/Desplegar carpetas
        this.arbolContainer.addEventListener('click', (e) => {
            const trigger = e.target.closest('.trigger-collapse');
            if (trigger) {
                const grupoContainer = trigger.closest('.modulo-grupo');
                const contenedorHijos = grupoContainer.querySelector('.contenedor-hijos');
                const chevron = grupoContainer.querySelector('.chevron-icon');

                // Alternar visibilidad
                const isHidden = contenedorHijos.classList.toggle('hidden');

                // Rotar flecha
                if (isHidden) {
                    chevron.classList.remove('rotate-90');
                } else {
                    chevron.classList.add('rotate-90');
                }
            }
        });
    }

    async cargarModulosBase() {
        const response = await this.RolService.obtenerModulos();
        if (response.success) {
            this.modulosRaw = response.data;
            this.renderizarArbolVacio();
        }
    }

    renderizarArbolVacio() {
        const rootModulos = this.modulosRaw.filter(m => !m.parent_cod);
        let html = '';

        rootModulos.forEach(root => {
            html += this.construirNodoArbol(root);
        });

        this.arbolContainer.innerHTML = html;
    }

    async toggleEstadoRol(id, estadoActual, codRol) {
        // Protección del administrador principal
        if (codRol === 'ADMIN' && String(estadoActual) === '1') {
            Swal.fire('Protección del Sistema', 'No puedes desactivar el rol de Administrador principal.', 'warning');
            return;
        }

        const isActivo = String(estadoActual) === '1';
        const accionText = isActivo ? 'desactivar' : 'activar';
        const confirmColor = isActivo ? '#ef4444' : '#10b981';

        const result = await Swal.fire({
            title: `¿Deseas ${accionText} este rol?`,
            text: isActivo
                ? `Los usuarios con el rol ${codRol} perderán acceso a sus módulos temporalmente.`
                : `Los usuarios con el rol ${codRol} recuperarán sus accesos.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: confirmColor,
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Sí, ${accionText}`,
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            // Si está en 1 mandamos 0, si está en 0 mandamos 1
            const nuevoEstado = isActivo ? 0 : 1;
            const response = await this.RolService.cambiarEstado(id, nuevoEstado);

            if (response.success) {
                Swal.fire({ icon: 'success', title: `Rol ${isActivo ? 'desactivado' : 'activado'}`, timer: 1500, showConfirmButton: false });
                this.cargarTabla();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        }
    }

    construirNodoArbol(modulo) {
        const children = this.modulosRaw.filter(m => m.parent_cod === modulo.cod_mod);
        const isGroup = modulo.tipo === 'group';
        const isMain = modulo.tipo === 'main';
        let icono = modulo.icono ? modulo.icono : (isGroup ? 'fas fa-folder' : 'fas fa-link');
        if (isMain) icono = 'fas fa-house-chimney text-amber-500';

        if (isGroup) {
            return `
            <div class="modulo-grupo border border-gray-200 rounded p-1 bg-gray-50/40 mt-1 shadow-sm" data-grupo="${modulo.cod_mod}">
                <div class="flex justify-between items-center p-1 hover:bg-purple-50 transition-colors rounded cursor-pointer group-header">
                    <div class="flex items-center gap-2 flex-1">
                        <input type="checkbox" value="${modulo.cod_mod}" class="check-permiso check-padre rounded text-purple-600 w-3.5 h-3.5 focus:ring-purple-500">
                        <div class="flex items-center gap-2 trigger-collapse flex-1 py-1">
                            <i class="fas fa-chevron-right text-[10px] text-gray-400 transition-transform duration-200 chevron-icon"></i>
                            <i class="${icono} text-yellow-500 text-sm"></i>
                            <span class="font-bold text-purple-800 text-xs select-none">${modulo.nom_mod}</span>
                        </div>
                    </div>                 
                </div>
                
                <div class="pl-4 space-y-0.5 border-l-2 border-purple-200 ml-3.5 contenedor-hijos hidden">
                    ${children.map(child => this.construirNodoArbol(child)).join('')}
                </div>
            </div>`;
        } else if (isMain) {
            return `
            <label class="flex items-center justify-between gap-2 cursor-pointer text-xs text-amber-900 bg-amber-50/70 hover:bg-amber-100/70 p-1.5 rounded transition-colors border border-amber-200 my-1">
                <div class="flex items-center gap-2 truncate select-none">
                    <input type="checkbox" value="${modulo.cod_mod}" class="check-permiso check-hijo rounded text-amber-600 w-3.5 h-3.5 focus:ring-amber-500">
                    <i class="${icono} text-xs"></i>
                    <span class="font-bold">${modulo.nom_mod}</span>
                </div>
                <span class="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">Pantalla de Inicio</span>
            </label>`;
        } else {
            return `
            <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-700 hover:bg-white p-1 rounded transition-colors border border-transparent hover:border-purple-200">
                <input type="checkbox" value="${modulo.cod_mod}" class="check-permiso check-hijo rounded text-purple-600 w-3.5 h-3.5 focus:ring-purple-500">
                <i class="${icono} text-gray-400 text-[10px]"></i>
                <span class="select-none">${modulo.nom_mod}</span>
            </label>`;
        }
    }

    actualizarContadorPermisos() {
        const seleccionados = this.arbolContainer.querySelectorAll('.check-permiso:checked').length;
        document.getElementById('contadorPermisos').textContent = `${seleccionados} seleccionados`;
    }

    async cargarTabla() {
        const response = await this.RolService.listarRoles();
        if (response.success) {
            this.renderizarTabla(response.data);
        }
    }

    renderizarTabla(roles) {
        this.tableBody.innerHTML = roles.map((rol, index) => {
            // Evaluamos si está activo (1 o '1')
            const isActivo = String(rol.activo) === '1';

            return `
            <tr class="hover:bg-purple-50 transition-colors">
                <td class="px-4 py-3 text-center text-gray-500">${index + 1}</td>
                <td class="px-4 py-3"><span class="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold font-mono">${rol.cod_rol}</span></td>
                <td class="px-4 py-3 font-semibold">${rol.nom_rol}</td>
                <td class="px-4 py-3 text-gray-500">${rol.descripcion || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-bold border border-indigo-200">
                        ${rol.total_modulos}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="${isActivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-2 py-1 rounded text-xs font-bold">
                        ${isActivo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex gap-2 justify-center">
                        <button type="button" class="btn-editar-rol bg-blue-100 hover:bg-blue-200 text-blue-600 px-2 py-1.5 rounded transition-colors shadow-sm" title="Editar" data-id="${rol.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        
                        <button type="button" class="btn-toggle-estado-rol ${isActivo ? 'bg-red-100 hover:bg-red-200 text-red-600' : 'bg-green-100 hover:bg-green-200 text-green-600'} px-2 py-1.5 rounded transition-colors shadow-sm" title="${isActivo ? 'Desactivar' : 'Activar'} Rol" data-id="${rol.id}" data-estado="${rol.activo}" data-codigo="${rol.cod_rol}">
                            <i class="fas fa-power-off"></i>
                        </button>
                        
                        <button type="button" class="btn-eliminar-rol bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1.5 rounded transition-colors shadow-sm" title="Eliminar" data-id="${rol.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    abrirModal() {
        this.form.reset();
        document.getElementById('rol_id').value = '';
        document.getElementById('rol_is_edit').value = 'false';

        // 1. Desmarcar todos los checkboxes
        this.arbolContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

        // 2. REINICIO VISUAL: Colapsar todas las carpetas
        this.arbolContainer.querySelectorAll('.modulo-grupo').forEach(grupo => {
            const contenedorHijos = grupo.querySelector('.contenedor-hijos');
            const chevron = grupo.querySelector('.chevron-icon');
            if (contenedorHijos) contenedorHijos.classList.add('hidden');
            if (chevron) chevron.classList.remove('rotate-90');
        });

        this.actualizarContadorPermisos();
        this.modal.style.display = 'flex';
    }

    cerrarModal() { this.modal.style.display = 'none'; }

    async editarRol(id) {
        const response = await this.RolService.obtenerPorId(id);
        if (response.success) {
            const rol = response.data;
            document.getElementById('rol_id').value = rol.id;
            document.getElementById('rol_is_edit').value = 'true';
            document.getElementById('rol_codigo').value = rol.cod_rol;
            document.getElementById('rol_nombre').value = rol.nom_rol;
            document.getElementById('rol_descripcion').value = rol.descripcion || '';

            // Limpiamos el estado visual (colapsamos todo por defecto) antes de marcar
            this.arbolContainer.querySelectorAll('.modulo-grupo').forEach(grupo => {
                const contenedorHijos = grupo.querySelector('.contenedor-hijos');
                const chevron = grupo.querySelector('.chevron-icon');
                if (contenedorHijos) contenedorHijos.classList.add('hidden');
                if (chevron) chevron.classList.remove('rotate-90');
            });

            // Marcar checkboxes con los permisos guardados
            this.arbolContainer.querySelectorAll('.check-permiso').forEach(cb => {
                cb.checked = rol.permisos.includes(cb.value);
            });

            this.actualizarContadorPermisos();
            this.modal.style.display = 'flex';

            // Auto-desplegar SOLO las carpetas que tienen hijos seleccionados
            this.arbolContainer.querySelectorAll('.modulo-grupo').forEach(grupo => {
                const tieneHijosCheckeados = grupo.querySelector('.contenedor-hijos').querySelector('input:checked');
                if (tieneHijosCheckeados) {
                    grupo.querySelector('.contenedor-hijos').classList.remove('hidden');
                    grupo.querySelector('.chevron-icon').classList.add('rotate-90');
                }
            });
        }
    }

    async procesarGuardado(e) {
        e.preventDefault();
        const modulos = Array.from(this.arbolContainer.querySelectorAll('.check-permiso:checked')).map(cb => cb.value);

        const payload = {
            id: document.getElementById('rol_id').value,
            is_edit: document.getElementById('rol_is_edit').value,
            cod_rol: document.getElementById('rol_codigo').value,
            nom_rol: document.getElementById('rol_nombre').value,
            descripcion: document.getElementById('rol_descripcion').value,
            id_programa: document.getElementById('rol_programa').value,
            modulos_permitidos: modulos
        };

        const response = await this.RolService.guardar(payload);
        if (response.success) {
            Swal.fire('¡Éxito!', response.message, 'success');
            this.cerrarModal();
            this.cargarTabla();
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    }

    async eliminarRol(id) {
        const result = await Swal.fire({
            title: '¿Eliminar rol?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            const response = await this.RolService.eliminar(id);
            if (response.success) {
                Swal.fire('Eliminado', response.message, 'success');
                this.cargarTabla();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        }
    }
}

window.rolController = new RolController();

document.addEventListener('DOMContentLoaded', () => {
    window.rolController.init();
});