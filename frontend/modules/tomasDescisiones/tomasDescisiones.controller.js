class TomasDescisionesController {
    constructor() {
        this.service = new TomasDescisionesService();
        this.msSemana = null;
        this.msProceso = null;
        this.filtrosData = null;
        this.anioSeleccionado = this.anioActual();
        this.semanaDefecto = '';
        this.procesoDefecto = '';
        this.datos = null;
        this.cargando = false;
        this._recargaPendiente = false;
    }

    async init() {
        this.inicializarAnioSelect();
        this.setPeriodoPorDefecto();
        this.setupListeners();
        this.aplicarVisibilidadFiltros();
        await this.cargarFiltrosIniciales();
        await this.cargarDashboard();
    }

    esTasasInteres() {
        return document.getElementById('select-tipo-grafico')?.value === 'DashTasasdeInteres';
    }

    esGraficasProyectados() {
        return document.getElementById('select-tipo-grafico')?.value === 'GraficasProyectadosVSReal';
    }

    esGraficasProyectadosDias() {
        return document.getElementById('select-tipo-grafico')?.value === 'GraficasProyectadosDias';
    }

    inicializarAnioSelect() {
        const select = document.getElementById('select-anio');
        if (!select) return;

        const anioActual = this.anioActual();
        const anios = [];
        for (let anio = anioActual; anio >= 2023; anio--) {
            anios.push(anio);
        }

        select.innerHTML = anios.map(anio => `
            <option value="${anio}" ${anio === anioActual ? 'selected' : ''}>
                ${anio === anioActual ? 'Este año' : anio}
            </option>
        `).join('');

        this.anioSeleccionado = anioActual;
        select.value = String(anioActual);

        if (!select._anioBound) {
            select._anioBound = true;
            select.addEventListener('change', () => this.cambiarAnio());
        }
    }

    aplicarVisibilidadFiltros() {
        const esTasas = this.esTasasInteres();
        const esGraficas = this.esGraficasProyectados() || this.esGraficasProyectadosDias();

        ['filtro-periodo', 'contenedor-inputs-periodo'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.classList.add('hidden');
        });

        const anio = document.getElementById('filtro-anio');
        if (anio) anio.classList.toggle('hidden', esTasas);

        const semana = document.getElementById('filtro-semana');
        if (semana) semana.classList.toggle('hidden', esTasas);

        const proceso = document.getElementById('filtro-proceso');
        if (proceso) proceso.classList.toggle('hidden', !esGraficas);
    }

    async alCambiarTipoGrafico() {
        this.aplicarVisibilidadFiltros();
        await this.cargarDashboard();
    }

    anioActual() {
        return new Date().getFullYear();
    }

    setPeriodoPorDefecto() {
        const select = document.getElementById('select-tipo-periodo');
        if (select) select.value = 'entre_fechas';

        if (typeof PeriodoHelper !== 'undefined') {
            PeriodoHelper.renderizarInputs();
        }

        this.aplicarFechasAnioActual();
    }

    aplicarFechasAnioActual() {
        const anio = this.anioSeleccionado || this.anioActual();
        const inicio = document.getElementById('input-fecha-inicio');
        const fin = document.getElementById('input-fecha-fin');

        if (inicio) inicio.value = `${anio}-01-01`;
        if (fin) fin.value = `${anio}-12-31`;
    }

    setupListeners() {
        document.getElementById('select-tipo-periodo')?.addEventListener('change', () => {
            if (typeof PeriodoHelper !== 'undefined') {
                PeriodoHelper.renderizarInputs();
            }
            const select = document.getElementById('select-tipo-periodo');
            if (select && select.value === 'entre_fechas') {
                this.aplicarFechasAnioActual();
            }
        });

        document.getElementById('select-tipo-grafico')?.addEventListener('change', () => this.alCambiarTipoGrafico());
        document.getElementById('btn-cargar')?.addEventListener('click', () => this.cargarDashboard());
        document.getElementById('btn-limpiar')?.addEventListener('click', () => this.limpiar());
        document.getElementById('btn-toggle-filtros')?.addEventListener('click', () => this.toggleFiltros());
    }

    toggleFiltros() {
        const panel = document.getElementById('contenedor-filtros');
        const label = document.getElementById('label-toggle-filtros');
        const icon = document.getElementById('icon-toggle-filtros');
        if (!panel) return;

        const oculto = panel.classList.toggle('hidden');
        if (label) label.textContent = oculto ? 'Mostrar filtros' : 'Ocultar filtros';
        if (icon) icon.style.transform = oculto ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    async cargarFiltrosIniciales() {
        try {
            await this.cargarOpcionesAnio(this.anioSeleccionado, true);
        } catch (error) {
            console.error('Error al cargar filtros:', error);
            const contenedor = document.getElementById('contenedor-dashboard');
            if (contenedor) {
                contenedor.innerHTML = `
                    <div class="dash-card p-8 text-center text-rose-700 font-semibold">
                        ${this.esc(error.message || 'No se pudieron cargar los filtros.')}
                    </div>
                `;
            }
        }
    }

    async cargarOpcionesAnio(anio, inicial = false) {
        const data = await this.service.obtenerFiltrosProyectadoVentas({
            fecha_inicio: `${anio}-01-01`,
            fecha_fin: `${anio}-12-31`
        });

        this.filtrosData = data;

        const semanas = Array.isArray(data.semanas) ? data.semanas.map(String) : [];
        const actual = String(data.semana_actual || '');
        const max = String(data.semana_max || '');
        this.semanaDefecto = semanas.includes(actual) ? actual : (max || semanas[semanas.length - 1] || '');

        const opcionesSemana = semanas.map(semana => ({
            id: semana,
            label: `Semana ${semana}`,
            selected: semana === this.semanaDefecto
        }));

        if (!this.msSemana) {
            this.msSemana = new CustomMultiSelect({
                btnId: 'ms-semana-btn',
                labelId: 'ms-semana-label',
                dropdownId: 'ms-semana-dropdown',
                searchId: 'ms-semana-search',
                optionsContainerId: 'ms-semana-options',
                title: 'Semana',
                options: opcionesSemana
            });
        } else {
            const seleccionadas = this.msSemana.getSelectedValues()
                .map(String)
                .filter(semana => semanas.includes(semana));
            this.msSemana.setOptions(opcionesSemana);
            this.msSemana.setSelectedValues(seleccionadas.length ? seleccionadas : [this.semanaDefecto]);
        }

        const procesos = Array.isArray(data.procesos) ? data.procesos.map(String) : [];
        this.procesoDefecto = procesos.includes('Pollo Vivo') ? 'Pollo Vivo' : (procesos[0] || '');

        const seleccionadasProceso = this.msProceso
            ? this.msProceso.getSelectedValues().map(String).filter(proceso => procesos.includes(proceso))
            : [];
        const procesosFinales = seleccionadasProceso.length
            ? seleccionadasProceso
            : (this.procesoDefecto ? [this.procesoDefecto] : []);

        const opcionesProceso = procesos.map(proceso => ({
            id: proceso,
            label: proceso,
            selected: procesosFinales.includes(proceso)
        }));

        if (!this.msProceso) {
            this.msProceso = new CustomMultiSelect({
                btnId: 'ms-proceso-btn',
                labelId: 'ms-proceso-label',
                dropdownId: 'ms-proceso-dropdown',
                searchId: 'ms-proceso-search',
                optionsContainerId: 'ms-proceso-options',
                title: 'Proceso',
                options: opcionesProceso
            });
        } else {
            this.msProceso.setOptions(opcionesProceso);
            this.msProceso.setSelectedValues(procesosFinales);
        }

        if (inicial) {
            this.aplicarFechasAnioActual();
        }
    }

    async cambiarAnio() {
        const select = document.getElementById('select-anio');
        if (!select) return;

        this.anioSeleccionado = Number(select.value) || this.anioActual();
        this.aplicarFechasAnioActual();

        try {
            await this.cargarOpcionesAnio(this.anioSeleccionado, false);
        } catch (error) {
            console.error('Error al cambiar año:', error);
        }
    }

    obtenerFiltros() {
        const anio = Number(this.anioSeleccionado) || this.anioActual();

        return {
            fecha_inicio: `${anio}-01-01`,
            fecha_fin: `${anio}-12-31`,
            semanas: this.msSemana ? this.msSemana.getSelectedValues().map(String) : [],
            procesos: this.msProceso ? this.msProceso.getSelectedValues().map(String) : [],
            tipo_grafico: document.getElementById('select-tipo-grafico')?.value || 'DashProyectadoVentasIndicador'
        };
    }

    async cargarDashboard() {
        if (this.cargando) {
            this._recargaPendiente = true;
            return;
        }

        const contenedor = document.getElementById('contenedor-dashboard');
        if (!contenedor) return;

        if (this.esTasasInteres()) {
            if (window.DashGraficasProyectadosVSRealView) window.DashGraficasProyectadosVSRealView.destroy();
            if (window.DashGraficasProyectadosDiasView) window.DashGraficasProyectadosDiasView.destroy();
            await this.cargarTasasInteres();
            return;
        }

        if (this.esGraficasProyectados()) {
            if (window.DashTasasdeInteresView) window.DashTasasdeInteresView.destroy();
            if (window.DashGraficasProyectadosDiasView) window.DashGraficasProyectadosDiasView.destroy();
            await this.cargarGraficasProyectadosVSReal();
            return;
        }

        if (this.esGraficasProyectadosDias()) {
            if (window.DashTasasdeInteresView) window.DashTasasdeInteresView.destroy();
            if (window.DashGraficasProyectadosVSRealView) window.DashGraficasProyectadosVSRealView.destroy();
            await this.cargarGraficasProyectadosDias();
            return;
        }

        if (window.DashTasasdeInteresView) window.DashTasasdeInteresView.destroy();
        if (window.DashGraficasProyectadosVSRealView) window.DashGraficasProyectadosVSRealView.destroy();
        if (window.DashGraficasProyectadosDiasView) window.DashGraficasProyectadosDiasView.destroy();

        const filtros = this.obtenerFiltros();

        if (!filtros.semanas.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-slate-500 font-medium">
                    Selecciona al menos una semana para consultar.
                </div>
            `;
            return;
        }

        this.cargando = true;
        this.setBotonCargando(true);
        contenedor.innerHTML = `
            <div class="dash-card p-10 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl mb-2"></i>
                <p class="text-sm font-semibold">Consultando proyección de ventas...</p>
            </div>
        `;

        try {
            const data = await this.service.obtenerProyectadoVentasIndicador(filtros);
            this.datos = data;
            window.DashProyectadoVentasIndicadorView.render(contenedor, data, this);
        } catch (error) {
            console.error('Error al cargar el dashboard:', error);
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-rose-700 font-semibold">
                    ${this.esc(error.message || 'No se pudo cargar la información.')}
                </div>
            `;
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
            this.procesarRecargaPendiente();
        }
    }

    async cargarTasasInteres() {
        if (this.cargando) return;

        const contenedor = document.getElementById('contenedor-dashboard');
        if (!contenedor) return;

        this.cargando = true;
        this.setBotonCargando(true);
        contenedor.innerHTML = `
            <div class="dash-card p-10 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl mb-2"></i>
                <p class="text-sm font-semibold">Consultando tasas de interés...</p>
            </div>
        `;

        try {
            const data = await this.service.obtenerTasasInteres();
            this.datos = data;
            window.DashTasasdeInteresView.render(contenedor, data, this);
        } catch (error) {
            console.error('Error al cargar tasas de interés:', error);
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-rose-700 font-semibold">
                    ${this.esc(error.message || 'No se pudo cargar la información.')}
                </div>
            `;
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
            this.procesarRecargaPendiente();
        }
    }

    async cargarGraficasProyectadosVSReal() {
        if (this.cargando) return;

        const contenedor = document.getElementById('contenedor-dashboard');
        if (!contenedor) return;

        const filtros = this.obtenerFiltros();

        if (!filtros.semanas.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-slate-500 font-medium">
                    Selecciona al menos una semana para consultar.
                </div>
            `;
            return;
        }

        if (!filtros.procesos.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-slate-500 font-medium">
                    Selecciona al menos un proceso para consultar.
                </div>
            `;
            return;
        }

        this.cargando = true;
        this.setBotonCargando(true);
        contenedor.innerHTML = `
            <div class="dash-card p-10 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl mb-2"></i>
                <p class="text-sm font-semibold">Consultando comparativos proyectados vs real...</p>
            </div>
        `;

        try {
            const data = await this.service.obtenerGraficasProyectadosVSReal(filtros);
            this.datos = data;
            window.DashGraficasProyectadosVSRealView.render(contenedor, data, this);
        } catch (error) {
            console.error('Error al cargar proyectados vs real:', error);
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-rose-700 font-semibold">
                    ${this.esc(error.message || 'No se pudo cargar la información.')}
                </div>
            `;
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
            this.procesarRecargaPendiente();
        }
    }

    async cargarGraficasProyectadosDias() {
        if (this.cargando) return;

        const contenedor = document.getElementById('contenedor-dashboard');
        if (!contenedor) return;

        const filtros = this.obtenerFiltros();

        if (!filtros.semanas.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-slate-500 font-medium">
                    Selecciona al menos una semana para consultar.
                </div>
            `;
            return;
        }

        if (!filtros.procesos.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-slate-500 font-medium">
                    Selecciona al menos un proceso para consultar.
                </div>
            `;
            return;
        }

        this.cargando = true;
        this.setBotonCargando(true);
        contenedor.innerHTML = `
            <div class="dash-card p-10 text-center text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-2xl mb-2"></i>
                <p class="text-sm font-semibold">Consultando comparativos diarios proyectados vs real...</p>
            </div>
        `;

        try {
            const data = await this.service.obtenerGraficasProyectadosDias(filtros);
            this.datos = data;
            window.DashGraficasProyectadosDiasView.render(contenedor, data, this);
        } catch (error) {
            console.error('Error al cargar proyectados diarios:', error);
            contenedor.innerHTML = `
                <div class="dash-card p-8 text-center text-rose-700 font-semibold">
                    ${this.esc(error.message || 'No se pudo cargar la información.')}
                </div>
            `;
        } finally {
            this.cargando = false;
            this.setBotonCargando(false);
            this.procesarRecargaPendiente();
        }
    }

    procesarRecargaPendiente() {
        if (!this._recargaPendiente) return;
        this._recargaPendiente = false;
        this.cargarDashboard();
    }

    async limpiar() {
        if (this.esTasasInteres()) {
            await this.cargarDashboard();
            return;
        }

        const anio = this.anioActual();
        this.anioSeleccionado = anio;

        const selectAnio = document.getElementById('select-anio');
        if (selectAnio) selectAnio.value = String(anio);

        try {
            await this.cargarOpcionesAnio(anio, false);
        } catch (error) {
            console.error('Error al restablecer filtros:', error);
        }

        if (this.msSemana && this.semanaDefecto !== '') {
            this.msSemana.setSelectedValues([this.semanaDefecto]);
        }

        if (this.msProceso && this.procesoDefecto !== '') {
            this.msProceso.setSelectedValues([this.procesoDefecto]);
        }

        const contenedor = document.getElementById('contenedor-dashboard');
        if (contenedor) contenedor.innerHTML = '';

        await this.cargarDashboard();
    }

    setBotonCargando(estado) {
        const boton = document.getElementById('btn-cargar');
        if (!boton) return;

        if (estado) {
            boton.dataset.html = boton.innerHTML;
            boton.disabled = true;
            boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Cargando...</span>';
        } else {
            boton.disabled = false;
            if (boton.dataset.html) boton.innerHTML = boton.dataset.html;
        }
    }

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const controller = new TomasDescisionesController();
    window.tomasDescisionesController = controller;
    controller.init();
});
