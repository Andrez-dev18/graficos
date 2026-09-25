class ConfigPresupuestoController {
    constructor() {
        this.service = new ConfigPresupuestoService();
        this.tableElement = $('#dataTableConfigPresupuesto');
        this.modal = document.getElementById('modalConfigPresupuesto');
        this.form = document.getElementById('formConfigPresupuesto');
        this.contenedorPresupuestos = document.getElementById('contenedorTarjetasPresupuestos');
        this.dataTable = null;
    }

    init() {
        this.renderizarTabla();
        this.vincularEventos();
    }

    vincularEventos() {
        const btnCerrar = document.getElementById('btnCerrarModalConfig');
        const btnCancelar = document.getElementById('btnCancelarConfig');
        const btnMarcarTodos = document.getElementById('btnMarcarTodosPresupuestos');
        const btnDesmarcarTodos = document.getElementById('btnDesmarcarTodosPresupuestos');

        if (btnCerrar) btnCerrar.addEventListener('click', () => this.cerrarModal());
        if (btnCancelar) btnCancelar.addEventListener('click', () => this.cerrarModal());

        if (btnMarcarTodos) {
            btnMarcarTodos.addEventListener('click', () => {
                const checkboxes = this.form.querySelectorAll('input[name="presupuestos[]"]');
                checkboxes.forEach(cb => cb.checked = true);
            });
        }

        if (btnDesmarcarTodos) {
            btnDesmarcarTodos.addEventListener('click', () => {
                const checkboxes = this.form.querySelectorAll('input[name="presupuestos[]"]');
                checkboxes.forEach(cb => cb.checked = false);
            });
        }

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.procesarGuardado(e));
        }

        // Evento para el botón de la tabla (Delegación)
        this.tableElement.on('click', '.btn-gestionar-presupuestos', (e) => {
            const data = this.dataTable.row($(e.currentTarget).closest('tr')).data();
            this.abrirModal(data.codigo, data.nombre);
        });
    }

    renderizarTabla() {
        this.dataTable = this.tableElement.DataTable({
            processing: true,
            serverSide: true,
            searchDelay: 800,
            ajax: async (dataRequests, callback, settings) => {
                try {
                    const response = await this.service.obtenerDatatable(dataRequests);
                    callback({
                        draw: response.draw || dataRequests.draw,
                        recordsTotal: response.recordsTotal,
                        recordsFiltered: response.recordsFiltered,
                        data: response.data
                    });
                } catch (error) {
                    console.error("Error al cargar la tabla de presupuestos:", error);
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
                { data: 'codigo', },
                { data: 'nombre', },
                {
                    data: 'presupuestos_asignados',
                    className: 'text-left',
                    render: (data) => {
                        if (!data) return '<span class="text-gray-400 italic text-xs">-- Sin presupuestos asignados --</span>';

                        const presupuestos = data.split('||');
                        return `
                            <div class="flex flex-wrap gap-1.5">
                                ${presupuestos.map(cod => `
                                    <span class="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-md text-xs font-bold border border-indigo-200 shadow-sm">
                                        <i class="fas fa-file-invoice-dollar text-[10px] mr-1 text-indigo-500"></i>${cod}
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
                        <button type="button" class="btn-gestionar-presupuestos bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm title="Asignar presupuestos">
                            <i class="fas fa-sliders-h"></i>
                        </button>
                    `
                }
            ],
            language: { url: 'https://cdn.datatables.net/plug-ins/2.0.8/i18n/es-ES.json' }
        });
    }

    async abrirModal(codigo, nombre) {
        document.getElementById('config_nombre_usuario').textContent = nombre;
        document.getElementById('config_codigo_usuario').textContent = `Código: ${codigo}`;
        document.getElementById('config_codigo_oculto').value = codigo;

        this.contenedorPresupuestos.innerHTML = '<div class="p-10 text-center"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500"></i></div>';

        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';

        const response = await this.service.obtenerPresupuestosParaUsuario(codigo);

        if (response.success) {
            this.renderizarTarjetasPresupuestos(response.data.presupuestos_disponibles, response.data.presupuestos_usuario);
        } else {
            Swal.fire('Error', response.message || 'No se pudieron cargar los presupuestos', 'error');
            this.cerrarModal();
        }
    }

    renderizarTarjetasPresupuestos(disponibles, usuarioPresupuestos) {
        if (!disponibles || disponibles.length === 0) {
            this.contenedorPresupuestos.innerHTML = '<p class="text-center text-gray-500 py-10">No hay presupuestos configurados en el sistema.</p>';
            return;
        }

        let html = '';
        disponibles.forEach(item => {
            const estaMarcado = usuarioPresupuestos.includes(item.cod_presupuesto) ? 'checked' : '';

            html += `
                <label class="flex items-start gap-3 p-3.5 border border-gray-200 rounded-xl cursor-pointer transition-all hover:border-indigo-300 has-[:checked]:bg-indigo-50/70 has-[:checked]:border-indigo-500 has-[:checked]:shadow-sm">
                    <div class="mt-0.5">
                        <input type="checkbox" name="presupuestos[]" value="${item.cod_presupuesto}" ${estaMarcado} class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer">
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800 text-sm">${item.nombre}</span>
                            <span class="bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-200">${item.cod_presupuesto}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-0.5">${item.descripcion || 'Sin descripción adicional'}</p>
                    </div>
                </label>
            `;
        });
        this.contenedorPresupuestos.innerHTML = html;
    }

    cerrarModal() {
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
        this.form.reset();
    }

    async procesarGuardado(e) {
        e.preventDefault();

        const btn = document.getElementById('btnGuardarConfigPresupuesto');
        const originalText = btn.innerHTML;

        let reduser = 'SYSTEM';
        try {
            const sessionRaw = sessionStorage.getItem('usuario');
            if (sessionRaw) {
                const userObj = JSON.parse(sessionRaw);
                reduser = userObj?.codigo || userObj?.usuario || 'SYSTEM';
            }
        } catch (e) {}

        const checkboxes = this.form.querySelectorAll('input[name="presupuestos[]"]:checked');
        const presupuestosSeleccionados = Array.from(checkboxes).map(cb => cb.value);

        const payload = {
            codigo: document.getElementById('config_codigo_oculto').value,
            presupuestos: presupuestosSeleccionados,
            reduser: reduser
        };

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        const response = await this.service.guardar(payload);

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
window.configPresupuestoController = new ConfigPresupuestoController();

document.addEventListener('DOMContentLoaded', () => {
    window.configPresupuestoController.init();
});
