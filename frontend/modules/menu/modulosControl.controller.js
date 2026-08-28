class ModulosControlController {
    constructor() {
        this.service = new ModulosControlService();
        this.tableBody = document.getElementById('tableBody');
        this.modal = document.getElementById('modal');
        this.moduloForm = document.getElementById('moduloForm');
        this.modalTitle = document.getElementById('modalTitle');
        this.selectParent = document.getElementById('mod_parent_cod');
        this.searchInput = document.getElementById('searchInput');

        // Estado interno
        this.modulosData = [];

    }

    async init() {
        this.vincularEventos();
        this.cargarGrupos();
        this.cargarTabla();
    }


    vincularEventos() {
        // Botones principales
        document.getElementById('btnNuevo').addEventListener('click', () => this.abrirModal());
        document.getElementById('btnActualizar').addEventListener('click', () => this.cargarTabla());
        document.getElementById('btnCerrarModal').addEventListener('click', () => this.cerrarModal());
        document.getElementById('btnCancelar').addEventListener('click', () => this.cerrarModal());

        // Buscador
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.filtrarTabla(e.target.value));
        }

        // Formulario
        this.moduloForm.addEventListener('submit', (e) => this.guardarModulo(e));

        // Event Delegation para botones de Editar y Eliminar dentro de la tabla
        this.tableBody.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            const btnEliminar = e.target.closest('.btn-eliminar');

            if (btnEditar) this.editarModulo(btnEditar.dataset.id);
            if (btnEliminar) this.eliminarModulo(btnEliminar.dataset.id);
        });
    }

    async cargarGrupos() {
        const response = await this.service.listarGrupos();
        if (response.success) {
            let options = '<option value="">-- Ninguno (Es nivel principal) --</option>';
            response.data.forEach(grupo => {
                options += `<option value="${grupo.cod_mod}">${grupo.nom_mod} (${grupo.cod_mod})</option>`;
            });
            this.selectParent.innerHTML = options;
        }
    }

    async cargarTabla() {
        this.tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-purple-500 mb-2"></i><br>Cargando jerarquía...</td></tr>`;

        const response = await this.service.listarTodos();

        if (response.success) {
            this.modulosData = response.data; // Guardamos para el buscador
            this.renderizarTabla(this.modulosData);
        } else {
            this.tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-red-500">Error: ${response.message}</td></tr>`;
        }
    }

    renderizarTabla(data) {
        if (data.length === 0) {
            this.tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500">No hay módulos registrados.</td></tr>`;
            return;
        }

        // 1. Identificamos los módulos raíz (los que no tienen padre o su padre es '-')
        const roots = data.filter(item => !item.parent_cod || item.parent_cod === '-');
        let html = '';

        // 2. Función recursiva para dibujar cada fila
        const renderNodo = (modulo, nivel) => {
            const hijos = data.filter(m => m.parent_cod === modulo.cod_mod);
            const isGroup = modulo.tipo === 'group';
            const isMain = modulo.tipo === 'main';
            const tieneHijos = hijos.length > 0;

            let iconClass = 'fa-link text-blue-500';
            if (isGroup) iconClass = 'fa-folder text-yellow-500';
            if (isMain) iconClass = 'fa-house-chimney text-amber-500';

            const bgClass = isGroup ? (nivel === 0 ? 'bg-gray-100 font-bold' : 'bg-gray-50 font-semibold') : (isMain ? 'bg-amber-50/40 font-medium' : 'bg-white');
            const parentLabel = modulo.parent_cod && modulo.parent_cod !== '-' ? modulo.parent_cod : '<span class="text-gray-400">-</span>';

            // Configuración para el árbol (Visibilidad y Espaciado)
            const rowClass = nivel === 0 ? '' : 'hidden child-row'; // Ocultamos subniveles por defecto
            const paddingLeft = nivel * 1.5; // Rem para indentar según el nivel
            const dataAttrs = `data-node="${modulo.cod_mod}" data-parent="${modulo.parent_cod || '-'}"`;

            // Flechita para desplegar (solo si es grupo y tiene hijos)
            const chevron = (isGroup && tieneHijos)
                ? `<i class="fas fa-chevron-right text-gray-400 text-[10px] w-4 transition-transform duration-200 chevron-icon"></i>`
                : `<span class="inline-block w-4"></span>`; // Espaciador invisible para alinear

            let badgeTipo = `<span class="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">item</span>`;
            if (isGroup) {
                badgeTipo = `<span class="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">group</span>`;
            } else if (isMain) {
                badgeTipo = `<span class="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800 font-bold border border-amber-300 flex items-center gap-1 inline-flex"> main</span>`;
            }

            html += `
            <tr class="${bgClass} hover:bg-purple-50 transition-colors border-b ${rowClass}" ${dataAttrs}>
                <td class="px-4 py-3 text-center">${nivel + 1}</td>
                
                <td class="px-4 py-3 select-none ${isGroup && tieneHijos ? 'cursor-pointer toggle-children hover:text-purple-700' : ''}">
                    <div class="flex items-center" style="padding-left: ${paddingLeft}rem">
                        ${chevron}
                        <i class="fa-solid ${iconClass} mr-2"></i> 
                        ${modulo.nom_mod}
                    </div>
                </td>
                
                <td class="px-4 py-3 text-xs text-gray-500 font-mono">${modulo.cod_mod}</td>
                <td class="px-4 py-3 text-center">${badgeTipo}</td>
                <td class="px-4 py-3 text-xs">${parentLabel}</td>
                <td class="px-4 py-3">${modulo.label_short || '-'}</td>
                <td class="px-4 py-3 text-xs text-gray-500">${modulo.tipo_param || '-'}</td>
                <td class="px-4 py-3 text-xs">${modulo.titulo || '-'}</td>
                <td class="px-4 py-3 text-center font-bold">${modulo.orden}</td>
                <td class="px-4 py-3 text-center">
                    <button data-id="${modulo.id}" class="btn-editar text-blue-500 hover:text-blue-700 mx-1 transition-transform hover:scale-110" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button data-id="${modulo.id}" class="btn-eliminar text-red-500 hover:text-red-700 mx-1 transition-transform hover:scale-110" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;

            // Llamamos recursivamente a los hijos
            if (tieneHijos) {
                hijos.forEach(hijo => renderNodo(hijo, nivel + 1));
            }
        };

        // 3. Ejecutamos la función iniciando desde la raíz
        roots.forEach(root => renderNodo(root, 0));

        this.tableBody.innerHTML = html;

        // 4. Activamos los eventos para plegar/desplegar
        this.vincularEventosArbolTabla();
    }

    vincularEventosArbolTabla() {
        const toggleBtns = this.tableBody.querySelectorAll('.toggle-children');

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tr = e.currentTarget.closest('tr');
                const nodeId = tr.dataset.node;
                const chevron = tr.querySelector('.chevron-icon');
                const isExpanded = tr.classList.contains('expanded');

                if (isExpanded) {
                    // Contraer: Quitar clase, girar flecha y ocultar TODOS los descendientes
                    tr.classList.remove('expanded');
                    if (chevron) chevron.classList.remove('rotate-90');
                    this.ocultarDescendientes(nodeId);
                } else {
                    // Expandir: Poner clase, girar flecha y mostrar SOLO hijos directos
                    tr.classList.add('expanded');
                    if (chevron) chevron.classList.add('rotate-90');

                    this.tableBody.querySelectorAll(`tr[data-parent="${nodeId}"]`).forEach(child => {
                        child.classList.remove('hidden');
                    });
                }
            });
        });
    }

    ocultarDescendientes(parentId) {
        // Buscamos hijos directos de este padre
        const hijos = this.tableBody.querySelectorAll(`tr[data-parent="${parentId}"]`);

        hijos.forEach(hijo => {
            // Lo ocultamos
            hijo.classList.add('hidden');
            hijo.classList.remove('expanded');

            // Si es un grupo, regresamos su flecha a la normalidad
            const chevron = hijo.querySelector('.chevron-icon');
            if (chevron) chevron.classList.remove('rotate-90');

            // Recursividad: Ocultamos a los hijos de este hijo
            this.ocultarDescendientes(hijo.dataset.node);
        });
    }

    filtrarTabla(termino) {
        const term = termino.toLowerCase();
        const filtrados = this.modulosData.filter(mod =>
            mod.nom_mod.toLowerCase().includes(term) ||
            mod.cod_mod.toLowerCase().includes(term) ||
            (mod.parent_cod && mod.parent_cod.toLowerCase().includes(term))
        );
        this.renderizarTabla(filtrados);
    }

    abrirModal() {
        this.moduloForm.reset();
        document.getElementById('mod_id').value = ''; // Limpiamos ID oculto
        this.modalTitle.innerHTML = '<i class="fas fa-sitemap"></i> Nuevo Módulo';
        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
    }

    cerrarModal() {
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
    }

    async editarModulo(id) {
        const response = await this.service.obtenerPorId(id);

        if (response.success) {
            const data = response.data;

            // Llenar el formulario
            document.getElementById('mod_id').value = data.id;
            document.getElementById('mod_cod_mod').value = data.cod_mod;
            document.getElementById('mod_tipo').value = data.tipo;
            document.getElementById('mod_nom_mod').value = data.nom_mod;
            document.getElementById('mod_parent_cod').value = data.parent_cod || '';
            document.getElementById('mod_label_short').value = data.label_short || '';
            document.getElementById('mod_icono').value = data.icono || 'fas fa-circle';
            document.getElementById('mod_orden').value = data.orden;
            document.getElementById('mod_url').value = data.url || '';
            document.getElementById('mod_tipo_param').value = data.tipo_param || '';
            document.getElementById('mod_titulo').value = data.titulo || '';

            this.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Módulo';
            this.modal.classList.remove('hidden');
            this.modal.style.display = 'flex';
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    }

    async guardarModulo(e) {
        e.preventDefault(); // Evitamos recarga de página

        // Convertimos el formulario en un objeto FormData
        const formData = new FormData(this.moduloForm);

        // Bloqueamos botón para evitar dobles clicks
        const btnGuardar = document.getElementById('btnGuardar');
        const textOriginal = btnGuardar.innerHTML;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btnGuardar.disabled = true;

        const response = await this.service.guardar(formData);

        btnGuardar.innerHTML = textOriginal;
        btnGuardar.disabled = false;

        if (response.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: response.message,
                timer: 1500,
                showConfirmButton: false
            });
            this.cerrarModal();
            this.cargarTabla(); // Recargamos para ver los cambios
            this.cargarGrupos(); // Por si agregamos un nuevo 'group'
        } else {
            Swal.fire('Error', response.message, 'error');
        }
    }

    eliminarModulo(id) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await this.service.eliminar(id);

                if (response.success) {
                    Swal.fire('Eliminado!', response.message, 'success');
                    this.cargarTabla();
                    this.cargarGrupos();
                } else {
                    Swal.fire('Error', response.message, 'error');
                }
            }
        });
    }

    mostrarCargando(mostrar) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = mostrar ? 'flex' : 'none';
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

window.modulosControlController = new ModulosControlController();
