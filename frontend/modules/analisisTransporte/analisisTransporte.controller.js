class AnalisisTransporteController {
    constructor() {
        this.service = new AnalisisTransporteService();
        this.currentPeriodo = { inicio: '', fin: '' };
        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        await this.onCargar();
    }

    setupPeriodo() {
        const select = document.getElementById('select-tipo-periodo');
        if (select && !select.value) select.value = 'entre_fechas';
        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }
    }

    setupListeners() {
        const selectVista = document.getElementById('select-tipo-grafico');
        if (selectVista) {
            selectVista.value = 'LiquidacionPlacas';
            selectVista.addEventListener('change', () => {
                if (selectVista.value === 'CorrelacionGral') {
                    window.location.href = 'correlacionGral.html';
                }
            });
        }

        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') PeriodoHelper.renderizarInputs();
        });

        document.getElementById('btn-cargar')?.addEventListener('click', () => {
            this.onCargar();
        });

        document.getElementById('btn-limpiar')?.addEventListener('click', () => {
            this.limpiar();
        });

        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => {
            const panel = document.getElementById('contenedor-filtros-contenido');
            const label = document.getElementById('label-toggle-filtros');
            const icon = document.getElementById('icon-toggle-filtros');
            if (!panel) return;
            const oculto = panel.classList.toggle('hidden');
            if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
            if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }

    obtenerFiltros() {
        const rango = (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas)
            ? PeriodoHelper.obtenerRangoFechas()
            : {};
        const fechaInicio = rango.fechaInicio || rango.inicio || '';
        const fechaFin = rango.fechaFin || rango.fin || '';
        this.currentPeriodo = { inicio: fechaInicio, fin: fechaFin };
        return {
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        };
    }

    setBotonCargando(cargando) {
        const btn = document.getElementById('btn-cargar');
        if (!btn) return;
        if (cargando) {
            btn.dataset.html = btn.innerHTML;
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Cargando...</span>';
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
            if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
        }
    }

    async onCargar() {
        const contenedor = document.getElementById('contenedor-graficos-lista');
        if (!contenedor) return;

        const filtros = this.obtenerFiltros();
        if (!filtros.fecha_inicio || !filtros.fecha_fin) {
            contenedor.innerHTML = '<div class="p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500">Seleccione un rango de fechas válido.</div>';
            return;
        }

        this.setBotonCargando(true);
        contenedor.innerHTML = `
            <div class="p-10 bg-white border border-slate-200 rounded-2xl flex flex-col items-center gap-3 text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl"></i>
                <span class="text-sm font-semibold">Consultando Liquidación de Placas...</span>
            </div>
        `;

        try {
            const payload = await this.service.obtenerLiquidacionPlacas(filtros);
            window.ChartAnalisisTransporteLiquidacionPlacas.render(this, payload, 'contenedor-graficos-lista');
        } catch (error) {
            console.error('Error Liquidación de Placas:', error);
            contenedor.innerHTML = `
                <div class="p-8 bg-white border border-rose-200 rounded-xl text-center">
                    <p class="text-sm font-semibold text-rose-700">${error.message || 'No se pudo cargar la información.'}</p>
                </div>
            `;
        } finally {
            this.setBotonCargando(false);
        }
    }

    async limpiar() {
        const select = document.getElementById('select-tipo-periodo');
        if (select) select.value = 'entre_fechas';
        this.setupPeriodo();
        await this.onCargar();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.analisisTransporteController = new AnalisisTransporteController();
});
