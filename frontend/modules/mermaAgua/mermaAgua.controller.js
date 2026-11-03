class MermaAguaController {
    constructor() {
        this.service = new MermaAguaService();
        this.cargando = false;
        this.filtrosInicializados = false;
        this.opcionesFiltros = null;
        this.multiProceso = null;
        this.init();
    }

    init() {
        this.setupPeriodo();

        document.getElementById('btn-aplicar')?.addEventListener('click', () => {
            this.aplicarFiltros();
        });

        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiarFiltros();
        });

        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
        });

        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => {
            if (this.filtrosInicializados && !this.cargando) {
                this.cargar(this.construirFiltros());
            }
        });

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            this.toggleFiltros();
        });

        this.toggleFiltros(false);
        this.cargar({});
    }

    setupPeriodo() {
        const select = document.getElementById('select-tipo-periodo');
        if (select) select.value = 'entre_meses';

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }
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

    setupFiltros(opciones) {
        this.opcionesFiltros = opciones || {};
        const defaults = this.opcionesFiltros.defaults || {};

        if (typeof CustomMultiSelect === 'undefined') {
            throw new Error('El componente de filtros múltiples no está disponible.');
        }

        this.poblarSelect('select-ubicacion', this.opcionesFiltros.ubicaciones, defaults.ubicacion);
        this.poblarSelect('select-dato', this.opcionesFiltros.datos, defaults.dato);
        this.poblarSelect('select-nomcencos', this.opcionesFiltros.cencos, defaults.nomcencos);

        const opcionesProceso = (Array.isArray(this.opcionesFiltros.procesos) ? this.opcionesFiltros.procesos : [])
            .map((opcion) => ({
                id: String(opcion.id),
                label: String(opcion.label || opcion.id),
                selected: true
            }));

        this.multiProceso = new CustomMultiSelect({
            btnId: 'btn-dropdown-proceso',
            labelId: 'label-proceso',
            dropdownId: 'dropdown-proceso',
            searchId: 'search-proceso',
            optionsContainerId: 'container-options-proceso',
            title: 'Proceso',
            options: opcionesProceso
        });
    }

    poblarSelect(id, opciones, valorDefecto) {
        const select = document.getElementById(id);
        if (!select) return;

        const lista = Array.isArray(opciones) ? opciones : [];
        select.innerHTML = lista.map((opcion) => {
            const valor = this.escapeHtml(opcion.id);
            const label = this.escapeHtml(opcion.label || opcion.id);
            return `<option value="${valor}">${label}</option>`;
        }).join('');

        if (valorDefecto && lista.some((opcion) => String(opcion.id) === String(valorDefecto))) {
            select.value = valorDefecto;
        }
    }

    construirFiltros() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : {};

        const filtros = {
            tipo_grafico: document.getElementById('select-tipo-grafico')?.value || 'VistaProceso',
            fecha_inicio: rango.fechaInicio || rango.inicio || '',
            fecha_fin: rango.fechaFin || rango.fin || '',
            ubicacion: document.getElementById('select-ubicacion')?.value || '',
            dato: document.getElementById('select-dato')?.value || '',
            nomcencos: document.getElementById('select-nomcencos')?.value || ''
        };

        if (this.multiProceso) {
            filtros.procesos = this.multiProceso.getSelectedValues();
        }

        return filtros;
    }

    async aplicarFiltros() {
        if (this.cargando) return;
        await this.cargar(this.construirFiltros());
    }

    async limpiarFiltros() {
        if (this.cargando) return;

        const selectPeriodo = document.getElementById('select-tipo-periodo');
        if (selectPeriodo) selectPeriodo.value = 'entre_meses';

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        const defaults = this.opcionesFiltros?.defaults || {};
        const ubicacion = document.getElementById('select-ubicacion');
        const dato = document.getElementById('select-dato');
        const cencos = document.getElementById('select-nomcencos');

        if (ubicacion && defaults.ubicacion) ubicacion.value = defaults.ubicacion;
        if (dato && defaults.dato) dato.value = defaults.dato;
        if (cencos && defaults.nomcencos) cencos.value = defaults.nomcencos;

        this.multiProceso?.selectAll(false);

        await this.cargar(this.construirFiltros());
    }

    destruirVistaActual() {
        if (window.MermaAguaVistaProceso?.destroy) {
            window.MermaAguaVistaProceso.destroy();
        }
        if (window.MermaAguaTablaDatos?.destroy) {
            window.MermaAguaTablaDatos.destroy();
        }
    }

    async cargar(filtros) {
        if (this.cargando) return;

        const contenedor = document.getElementById('contenedor-grafico');
        if (!contenedor) return;

        this.cargando = true;
        this.setBotonCargando(true);
        this.destruirVistaActual();

        contenedor.innerHTML = `
            <div class="p-10 bg-white border border-slate-200 rounded-2xl flex flex-col items-center gap-3 text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl"></i>
                <span class="text-sm font-semibold">Consultando merma de agua...</span>
            </div>
        `;

        try {
            const data = await this.service.obtenerVistaProceso(filtros || {});

            if (!this.filtrosInicializados && data.opciones_filtros) {
                this.setupFiltros(data.opciones_filtros);
                this.filtrosInicializados = true;
            }

            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'VistaProceso';
            const vista = tipoGrafico === 'TablaDatos'
                ? window.MermaAguaTablaDatos
                : window.MermaAguaVistaProceso;

            if (!vista || typeof vista.render !== 'function') {
                throw new Error('El componente de visualización no está disponible.');
            }

            vista.render(contenedor, data);
        } catch (error) {
            console.error('Error al cargar Merma de Agua:', error);

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
    window.mermaAguaController = new MermaAguaController();
});

