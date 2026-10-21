/**
 * Controlador de InfoMercados.
 * Carga el volumen semanal y delega el renderizado al componente registrado.
 */
class InfoMercadosController {
    constructor() {
        this.service = new InfoMercadosService();
        this.datosVolSemanal = null;
        this.init();
    }

    async init() {
        this.cachearElementos();
        this.setupListeners();
        this.limpiarError();
        this.mostrarLoader(true);

        try {
            const data = await this.service.obtenerVolSemanal('2026');

            if (!data || !Array.isArray(data.semanas) || data.semanas.length === 0) {
                throw new Error('No se recibieron datos para Volumen Semanal.');
            }

            this.datosVolSemanal = data;
            this.renderVolSemanal();
        } catch (error) {
            console.error('Error al cargar InfoMercados:', error);
            this.mostrarError(error.message || 'No se pudo cargar el volumen semanal.');
        } finally {
            this.mostrarLoader(false);
        }
    }

    cachearElementos() {
        this.selectTipoGrafico = document.getElementById('select-tipo-grafico');
        this.btnToggleFiltros = document.getElementById('btn-toggle-filtros');
        this.contenedorFiltros = document.getElementById('contenedor-filtros-contenido');
        this.labelToggleFiltros = document.getElementById('label-toggle-filtros');
        this.iconToggleFiltros = document.getElementById('icon-toggle-filtros');
    }

    setupListeners() {
        if (this.btnToggleFiltros && this.contenedorFiltros) {
            this.btnToggleFiltros.addEventListener('click', () => {
                const oculto = this.contenedorFiltros.classList.toggle('hidden');

                if (this.labelToggleFiltros) {
                    this.labelToggleFiltros.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
                }

                if (this.iconToggleFiltros) {
                    this.iconToggleFiltros.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        if (this.selectTipoGrafico) {
            this.selectTipoGrafico.addEventListener('change', () => {
                this.renderVolSemanal();
            });
        }
    }

    renderVolSemanal() {
        const componente = window.ChartRegistry && window.ChartRegistry['InfoMercadosVolSemanal'];

        if (!componente || typeof componente.render !== 'function') {
            this.mostrarError('No se encontró el componente de Volumen Semanal.');
            return;
        }

        componente.render(this, this.datosVolSemanal, 'contenedor-graficos-lista');
    }

    mostrarLoader(mostrar) {
        if (typeof LoadingHelper !== 'undefined') {
            if (mostrar) {
                LoadingHelper.mostrarInicial({
                    titulo: 'Cargando InfoMercados',
                    subtitulo: 'Obteniendo volumen semanal...'
                });
            } else {
                LoadingHelper.ocultarInicial();
            }
            return;
        }

        const loader = document.getElementById('loader-inicial-pagina');
        if (loader) {
            loader.classList.toggle('hidden', !mostrar);
        }
    }

    mostrarError(mensaje) {
        const contenedor = document.getElementById('mensaje-error');
        if (!contenedor) return;

        contenedor.textContent = mensaje;
        contenedor.classList.remove('hidden');
    }

    limpiarError() {
        const contenedor = document.getElementById('mensaje-error');
        if (!contenedor) return;

        contenedor.textContent = '';
        contenedor.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.infoMercadosController = new InfoMercadosController();
});
