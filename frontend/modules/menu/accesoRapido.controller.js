class AccesoRapidoController {
    constructor() {
        this.service = new AccesoRapidoService();
        this.container = document.getElementById('accesoDirectoContainer');
        this.eventosVinculados = false;
    }

    async init() {
        if (!this.container) return;

        this.vincularEventos();

        try {
            const accesos = await this.service.obtenerAccesosLateral();
            this.renderizar(accesos);
        } catch (error) {
            console.error('No se pudieron cargar los accesos rápidos:', error);
            this.container.innerHTML = '';
            this.container.classList.add('hidden');
        }
    }

    vincularEventos() {
        if (this.eventosVinculados) return;

        this.eventosVinculados = true;

        this.container.addEventListener('click', (event) => {
            const boton = event.target.closest('.btn-acceso-rapido');

            if (!boton) return;

            this.abrir(
                boton.dataset.url,
                boton.dataset.tipo || '',
                boton.dataset.titulo || '',
                boton.dataset.codmod || ''
            );
        });
    }

    renderizar(accesos) {
        if (!Array.isArray(accesos) || accesos.length === 0) {
            this.container.innerHTML = '';
            this.container.classList.add('hidden');
            return;
        }

        this.container.classList.remove('hidden');

        const botones = accesos.slice(0, 5).map(acceso => `
            <button type="button"
                class="btn-acceso-rapido flex h-6 w-6 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
                title="${this.escaparAtributo(acceso.titulo)}"
                aria-label="${this.escaparAtributo(acceso.titulo)}"
                data-url="${this.escaparAtributo(acceso.url)}"
                data-tipo="${this.escaparAtributo(acceso.tipo_param)}"
                data-titulo="${this.escaparAtributo(acceso.titulo)}"
                data-codmod="${this.escaparAtributo(acceso.cod_mod)}">
                <i class="${acceso.icon} text-sm"></i>
            </button>
        `).join('');

        this.container.innerHTML = `
            <p class="text-blue-300 text-xs uppercase font-semibold mb-3">Acceso rápido</p>
            <div class="flex justify-start gap-5">
                ${botones}
            </div>
        `;
    }

    abrir(url, tipoParam, titulo, codMod) {
        if (!url) return;

        if (typeof loadDashboardAndData === 'function') {
            loadDashboardAndData(url, tipoParam, titulo, codMod);
        }

        if (window.menuPrincipal) {
            window.menuPrincipal.seleccionarModuloPorUrl(url);
        }
    }

    escaparAtributo(valor) {
        return String(valor || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

window.accesoRapidoController = new AccesoRapidoController();

document.addEventListener('DOMContentLoaded', () => {
    window.accesoRapidoController.init();
});
