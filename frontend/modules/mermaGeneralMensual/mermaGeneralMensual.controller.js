class MermaGeneralMensualController {
    constructor() {
        this.service = new MermaGeneralMensualService();
        this.cargando = false;
        this.filtrosInicializados = false;
        this.opcionesFiltros = null;
        this.multiZona = null;
        this.multiCliente = null;
        this.multiCodigo = null;
        this.init();
    }

    init() {
        document.getElementById('btn-aplicar')?.addEventListener('click', () => {
            this.aplicarFiltros();
        });

        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        document.getElementById('select-periodo')?.addEventListener('change', () => {
            this.actualizarEstadoFechas();
        });

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            this.toggleFiltros();
        });

        document.getElementById('toggle-hitos')?.addEventListener('change', (event) => {
            if (window.MermaGeneralMensualChart?.setHitosVisible) {
                window.MermaGeneralMensualChart.setHitosVisible(event.target.checked);
            }
        });

        this.toggleFiltros(false);
        this.cargar({});
    }

    toggleFiltros(alternar = true) {
        const contenedor = document.getElementById('contenedor-filtros-contenido');
        const label = document.getElementById('label-toggle-filtros');
        const icon = document.getElementById('icon-toggle-filtros');
        if (!contenedor) return;

        if (alternar) {
            contenedor.classList.toggle('hidden');
        }

        const oculto = contenedor.classList.contains('hidden');
        if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
        if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    setBotonCargando(cargando) {
        const btnAplicar = document.getElementById('btn-aplicar');
        if (btnAplicar) {
            btnAplicar.disabled = cargando;
            const icon = btnAplicar.querySelector('i');
            if (icon) {
                icon.className = cargando
                    ? 'fa-solid fa-spinner fa-spin'
                    : 'fa-solid fa-rotate';
            }
        }

        const btnLimpiar = document.getElementById('btn-limpiar');
        if (btnLimpiar) {
            btnLimpiar.disabled = cargando;
        }
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    actualizarEstadoFechas() {
        const select = document.getElementById('select-periodo');
        const inputInicio = document.getElementById('input-periodo-inicio');
        const inputFin = document.getElementById('input-periodo-fin');
        if (!select || !inputInicio || !inputFin) return;

        const esPersonalizado = select.value === 'personalizado';
        inputInicio.disabled = !esPersonalizado;
        inputFin.disabled = !esPersonalizado;

        if (!esPersonalizado) return;

        const fechaMin = this.opcionesFiltros?.fecha_min_dia || '';
        const fechaMax = this.opcionesFiltros?.fecha_max_dia || '';

        inputInicio.min = fechaMin;
        inputInicio.max = fechaMax;
        inputFin.min = fechaMin;
        inputFin.max = fechaMax;

        if (!inputInicio.value && fechaMin) inputInicio.value = fechaMin;
        if (!inputFin.value && fechaMax) inputFin.value = fechaMax;
    }

    setupFiltros(opciones) {
        this.opcionesFiltros = opciones || {};

        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('El componente de filtros múltiples no está disponible.');
        }

        const crearOpciones = (lista) => {
            return (Array.isArray(lista) ? lista : []).map((opcion) => ({
                id: String(opcion.id),
                label: String(opcion.label || opcion.id),
                selected: true
            }));
        };

        this.multiZona = new CustomMultiSelect({
            btnId: 'btn-dropdown-zona',
            labelId: 'label-zona',
            dropdownId: 'dropdown-zona',
            searchId: 'search-zona',
            optionsContainerId: 'container-options-zona',
            title: 'Zona',
            options: crearOpciones(this.opcionesFiltros.zonas)
        });

        this.multiCliente = new CustomMultiSelect({
            btnId: 'btn-dropdown-cliente',
            labelId: 'label-cliente',
            dropdownId: 'dropdown-cliente',
            searchId: 'search-cliente',
            optionsContainerId: 'container-options-cliente',
            title: 'Cliente',
            options: crearOpciones(this.opcionesFiltros.clientes)
        });

        this.multiCodigo = new CustomMultiSelect({
            btnId: 'btn-dropdown-codigo',
            labelId: 'label-codigo',
            dropdownId: 'dropdown-codigo',
            searchId: 'search-codigo',
            optionsContainerId: 'container-options-codigo',
            title: 'Código',
            options: crearOpciones(this.opcionesFiltros.codigos)
        });

        const inputInicio = document.getElementById('input-periodo-inicio');
        const inputFin = document.getElementById('input-periodo-fin');
        const fechaMin = this.opcionesFiltros.fecha_min_dia || this.opcionesFiltros.fecha_min || '';
        const fechaMax = this.opcionesFiltros.fecha_max_dia || this.opcionesFiltros.fecha_max || '';

        if (inputInicio) {
            inputInicio.min = fechaMin;
            inputInicio.max = fechaMax;
            if (!inputInicio.value && fechaMin) inputInicio.value = fechaMin;
        }

        if (inputFin) {
            inputFin.min = fechaMin;
            inputFin.max = fechaMax;
            if (!inputFin.value && fechaMax) inputFin.value = fechaMax;
        }

        this.actualizarEstadoFechas();
    }

    construirFiltros() {
        const periodo = document.getElementById('select-periodo')?.value || 'personalizado';
        const filtros = { periodo };

        if (periodo === 'personalizado') {
            const fechaInicio = document.getElementById('input-periodo-inicio')?.value;
            const fechaFin = document.getElementById('input-periodo-fin')?.value;
            if (fechaInicio) filtros.fecha_inicio = fechaInicio;
            if (fechaFin) filtros.fecha_fin = fechaFin;
        }

        if (this.multiZona) {
            filtros.zonas = this.multiZona.getSelectedValues();
        }

        if (this.multiCliente) {
            filtros.clientes = this.multiCliente.getSelectedValues();
        }

        if (this.multiCodigo) {
            filtros.codigos = this.multiCodigo.getSelectedValues();
        }

        return filtros;
    }

    async aplicarFiltros() {
        if (this.cargando) return;
        await this.cargar(this.construirFiltros());
    }

    async limpiarFiltros() {
        if (this.cargando) return;

        const select = document.getElementById('select-periodo');
        if (select) select.value = 'personalizado';

        const inputInicio = document.getElementById('input-periodo-inicio');
        const inputFin = document.getElementById('input-periodo-fin');
        const fechaMin = this.opcionesFiltros?.fecha_min_dia || '';
        const fechaMax = this.opcionesFiltros?.fecha_max_dia || '';

        if (inputInicio) inputInicio.value = fechaMin;
        if (inputFin) inputFin.value = fechaMax;

        this.actualizarEstadoFechas();
        this.multiZona?.selectAll(false);
        this.multiCliente?.selectAll(false);
        this.multiCodigo?.selectAll(false);

        await this.cargar(this.construirFiltros());
    }

    async cargar(filtros) {
        if (this.cargando) return;

        const contenedor = document.getElementById('contenedor-grafico');
        if (!contenedor) return;

        this.cargando = true;
        this.setBotonCargando(true);

        contenedor.innerHTML = `
            <div class="p-10 bg-white border border-slate-200 rounded-2xl flex flex-col items-center gap-3 text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl"></i>
                <span class="text-sm font-semibold">Consultando merma general mensual...</span>
            </div>
        `;

        try {
            const data = await this.service.obtenerDashboard(filtros || {});

            if (!this.filtrosInicializados && data.opciones_filtros) {
                this.setupFiltros(data.opciones_filtros);
                this.filtrosInicializados = true;
            }

            if (!window.MermaGeneralMensualChart || typeof window.MermaGeneralMensualChart.render !== 'function') {
                throw new Error('El componente del gráfico no está disponible.');
            }

            window.MermaGeneralMensualChart.render(contenedor, data);
        } catch (error) {
            console.error('Error al cargar Merma General Mensual:', error);

            contenedor.innerHTML = `
                <div class="p-8 bg-white border border-rose-200 rounded-2xl text-center">
                    <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 text-rose-600 mb-3">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <p class="text-sm font-semibold text-rose-700">No se pudo cargar la información.</p>
                    <p class="text-xs text-slate-500 mt-1">${this.escapeHtml(error?.message || 'Error inesperado.')}</p>
                    <button id="btn-reintentar" type="button"
                        class="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg border border-slate-200 transition-all cursor-pointer">
                        Reintentar
                    </button>
                </div>
            `;

            document.getElementById('btn-reintentar')?.addEventListener('click', () => {
                this.cargar(this.filtrosInicializados ? this.construirFiltros() : {});
            });
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mermaGeneralMensualController = new MermaGeneralMensualController();
});
