/**
 * Controlador para la vista Costos Tradicionales
 * Administra filtros de período, zonas y alternancia entre CP01, CP02 y CP03
 */
class CostosTradicionalesController {
    constructor() {
        this.service = new CostosTradicionalesService();
        this.chartInstance = null;
        this.chartTipoActual = null;
        this.datosDashboard = null;
        this.mesSeleccionadoCP04 = null;
        this.mesSeleccionadoCP05 = null;
        this.itemsSeleccionadosCP07 = [];
        this.catalogoInsumosCP07 = [];

        this.init();
    }

    destruirGraficaActual() {
        if (this.chartInstance) {
            try {
                this.chartInstance.destroy();
            } catch (e) {
                console.warn('Error al destruir gráfico:', e);
            }
            this.chartInstance = null;
        }
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        this.setupDropdownItems();
        this.setupTableTooltips();
        await this.onCargarClick();
    }

    setupPeriodo() {
        if (typeof PeriodoHelper !== 'undefined') {
            const selPeriodo = document.getElementById('select-tipo-periodo');
            if (selPeriodo) {
                selPeriodo.value = 'entre_meses';
            }
            PeriodoHelper.renderizarInputs();
        }
    }

    setupListeners() {
        // Selector de tipo de período dinámico
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) {
            selPeriodo.addEventListener('change', () => {
                if (typeof PeriodoHelper !== 'undefined') {
                    PeriodoHelper.renderizarInputs();
                }
            });
        }

        // Selector de tipo de gráfico (CP01 vs CP02 vs CP03 vs CP04 vs CP05 vs CP05 MortVsPeso vs CP07 InsumosAABB vs CP08 TendenciaInsumos)
        const selTipoGrafico = document.getElementById('select-tipo-grafico');
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (selTipoGrafico) {
            selTipoGrafico.addEventListener('change', async () => {
                const tipo = selTipoGrafico.value;
                if (contFiltroZona) {
                    if (tipo === 'CP03 CPPVxZona' || tipo === 'CP04 CPPVvsCAxZona' || tipo === 'CP05 CPPVvsCAZonaBarra' || tipo === 'CP05 MortVsPeso') {
                        contFiltroZona.classList.remove('hidden');
                    } else {
                        contFiltroZona.classList.add('hidden');
                    }
                }
                if (contFiltroItem) {
                    if (tipo === 'CP07 InsumosAABB' || tipo === 'CP07' || tipo === 'CP08 TendenciaInsumos' || tipo === 'CP08') {
                        contFiltroItem.classList.remove('hidden');
                    } else {
                        contFiltroItem.classList.add('hidden');
                    }
                }
                await this.onCargarClick();
            });
        }

        // Selector de zona (CP03, CP04, CP05)
        const selZona = document.getElementById('select-zona');
        if (selZona) {
            selZona.addEventListener('change', async () => {
                await this.onCargarClick();
            });
        }

        // Toggle plegar / desplegar barra de filtros
        const btnToggle = document.getElementById('btn-toggle-filtros');
        const contFiltros = document.getElementById('contenedor-filtros-contenido');
        const iconToggle = document.getElementById('icon-toggle-filtros');
        const labelToggle = document.getElementById('label-toggle-filtros');

        if (btnToggle && contFiltros) {
            btnToggle.addEventListener('click', () => {
                const estaOculto = contFiltros.classList.toggle('hidden');
                if (labelToggle) labelToggle.textContent = estaOculto ? 'Mostrar filtros' : 'Ocultar filtros';
                if (iconToggle) iconToggle.style.transform = estaOculto ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }

        // Botón Cargar
        document.getElementById('btn-cargar')?.addEventListener('click', async () => {
            await this.onCargarClick();
        });

        // Botón Limpiar
        document.getElementById('btn-limpiar')?.addEventListener('click', async () => {
            await this.limpiarFiltros();
        });
    }

    setupTableTooltips() {
        const tooltip = document.getElementById('tooltip-tableau-costos');
        if (!tooltip) return;

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip-metrica]');
            if (target) {
                const indicador = target.getAttribute('data-tt-indicador') || '';
                const mes = target.getAttribute('data-tt-mes') || '';
                const valor = target.getAttribute('data-tt-valor') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">Indicador:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${indicador}</span>
                        <span class="text-slate-500 font-normal">Mes:</span>
                        <span class="text-slate-900 font-semibold text-left capitalize">${mes}</span>
                        <span class="text-blue-600 font-normal">Valor:</span>
                        <span class="text-blue-700 font-bold text-left font-mono">${valor}</span>
                    </div>
                `;

                tooltip.classList.remove('hidden');

                let x = e.clientX + 14;
                let y = e.clientY - 20;

                const tooltipWidth = tooltip.offsetWidth || 220;
                const tooltipHeight = tooltip.offsetHeight || 80;

                if (x + tooltipWidth > window.innerWidth - 12) {
                    x = e.clientX - tooltipWidth - 14;
                }
                if (y + tooltipHeight > window.innerHeight - 12) {
                    y = window.innerHeight - tooltipHeight - 12;
                }

                tooltip.style.left = `${Math.max(10, x)}px`;
                tooltip.style.top = `${Math.max(10, y)}px`;
            } else {
                // Solo ocultar si NO estamos sobre el canvas o el contenedor del gráfico
                if (!e.target.closest('#chart-costo-produccion') && !e.target.closest('#contenedor-grafica-costo')) {
                    if (!tooltip.classList.contains('hidden')) {
                        tooltip.classList.add('hidden');
                    }
                }
            }
        });
    }

    async onCargarClick() {
        const btnCargar = document.getElementById('btn-cargar');
        const originalBtnHtml = btnCargar ? btnCargar.innerHTML : '';
        if (btnCargar) {
            btnCargar.disabled = true;
            btnCargar.classList.add('opacity-75', 'cursor-not-allowed');
            btnCargar.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando...</span>
            `;
        }

        try {
            let rango = {};
            if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
                rango = PeriodoHelper.obtenerRangoFechas();
            }

            const tipoGrafico = document.getElementById('select-tipo-grafico')?.value || 'CPO1CostoProduccion';
            const zonaSeleccionada = document.getElementById('select-zona')?.value || 'TODOS';

            const payloadFiltros = {
                fecha_inicio: rango.fechaInicio || rango.inicio || '2024-01-01',
                fecha_fin: rango.fechaFin || rango.fin || '2025-10-31',
                tipo_grafico: tipoGrafico,
                zona: zonaSeleccionada
            };

            if (tipoGrafico === 'CP07 InsumosAABB' || tipoGrafico === 'CP07' || tipoGrafico === 'CP08 TendenciaInsumos' || tipoGrafico === 'CP08') {
                payloadFiltros.items = this.itemsSeleccionadosCP07;
            }

            const res = await this.service.obtenerDashboard(payloadFiltros);

            if (res && (res.success || res.status === 'success')) {
                const data = res.payload || res.data || res;
                this.datosDashboard = data;

                if (tipoGrafico === 'CP08 TendenciaInsumos' || tipoGrafico === 'CP08') {
                    this.configurarVistaCP08(data);
                } else if (tipoGrafico === 'CP07 InsumosAABB' || tipoGrafico === 'CP07') {
                    this.configurarVistaCP07(data);
                } else if (tipoGrafico === 'CP05 MortVsPeso' || tipoGrafico === 'CP06 MortVsPeso') {
                    this.configurarVistaCP05MortVsPeso(data);
                } else if (tipoGrafico === 'CP05 CPPVvsCAZonaBarra' || tipoGrafico === 'CPPVvsCAZonaBarra') {
                    this.configurarVistaCP05(data);
                } else if (tipoGrafico === 'CP04 CPPVvsCAxZona') {
                    this.configurarVistaCP04(data);
                } else if (tipoGrafico === 'CP03 CPPVxZona') {
                    this.configurarVistaCP03(data);
                } else if (tipoGrafico === 'CP02 CPVvsCA') {
                    this.configurarVistaCP02(data);
                } else {
                    this.configurarVistaCP01(data);
                }
            } else {
                console.error('Error en respuesta del servicio:', res);
            }
        } catch (err) {
            console.error('Excepción al cargar dashboard de costos tradicionales:', err);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_meses';
        const selZona = document.getElementById('select-zona');
        if (selZona) selZona.value = 'TODOS';
        this.itemsSeleccionadosCP07 = [];
        this.setupPeriodo();
        await this.onCargarClick();
    }

    /**
     * Formateadores numéricos adaptados al formato Tableau
     */
    formatearNumero(valor, tipo) {
        if (valor === undefined || valor === null || isNaN(valor)) return '-';
        const num = Number(valor);

        switch (tipo) {
            case 'entero':
                return num.toLocaleString('es-ES', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).replace(/,/g, '.');
            case 'decimal1':
                return num.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('.', ',');
            case 'decimal2':
                return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
            case 'decimal3':
                return num.toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace('.', ',');
            default:
                return num.toString();
        }
    }

    /**
     * Configura y renderiza la vista para CP01 (Costo de Producción Pollo Vivo + Tabla)
     */
    configurarVistaCP01(data) {
        this.chartTipoActual = 'CP01';
        this.mesSeleccionadoCP04 = null;

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo de Producción Pollo Vivo - MES';

        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full h-[360px] sm:h-[380px] p-4";
        }

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        const benchmark = data.benchmark || 4.538;
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-md">
                    Promedio / Meta: ${this.formatearNumero(benchmark, 'decimal3')}
                </span>
                <span class="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium hidden sm:inline-flex">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Bajo Meta (Favorable)
                </span>
                <span class="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium hidden sm:inline-flex">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Sobre Meta (Alto)
                </span>
            `;
        }

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        const titTabla = document.getElementById('titulo-tabla-detalle');
        const subTabla = document.getElementById('subtitulo-tabla-detalle');
        if (titTabla) titTabla.textContent = 'Detalle Costo de Producción Pollo Vivo - MES';
        if (subTabla) subTabla.textContent = 'Histórico de indicadores productivos y de rendimiento por mes';

        this.renderizarGraficaCP01(data);
        this.renderizarTablaMetricas(data);
    }

    /**
     * Configura y renderiza la vista para CP02 (Costo Producción vs Costo Alimentación - Doble Eje)
     */
    configurarVistaCP02(data) {
        this.chartTipoActual = 'CP02';
        this.mesSeleccionadoCP04 = null;

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo de Producción Pollo vivo vs. Costo de Alimentación (S/ por Kg)';

        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[520px] h-[calc(100vh-250px)] max-h-[750px] p-4";
        }

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        this.renderizarGraficaCP02(data);
    }

    /**
     * Configura y renderiza la vista para CP03 (Costo Promedio de Producción Pollo Vivo por Zona)
     */
    configurarVistaCP03(data) {
        this.chartTipoActual = 'CP03';
        this.mesSeleccionadoCP04 = null;

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo Promedio de Producción Pollo Vivo por Zona';

        // Mostrar selector de ZONA para CP03
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.remove('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[520px] h-[calc(100vh-250px)] max-h-[750px] p-4";
        }

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        this.renderizarGraficaCP03(data);
    }

    /**
     * Configura y renderiza la vista para CP04 (Costo por Kg. Pollo Vivo vs Costo de Alimentación - Barras + Línea + Detalle Cencos)
     */
    configurarVistaCP04(data) {
        this.chartTipoActual = 'CP04';

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo por Kg. Pollo Vivo vs Costo de Alimentacion';

        // Mostrar selector de ZONA para CP04
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.remove('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[440px] h-[calc(100vh-340px)] max-h-[580px] p-4";
        }

        // Mostrar card de tabla de detalle
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        const titTabla = document.getElementById('titulo-tabla-detalle');
        if (titTabla) titTabla.textContent = 'Costo por Kg. Pollo Vivo vs Costo de Alimentacion Detalle';

        this.renderizarGraficaCP04(data);
        this.actualizarFiltroCruzadoCP04(this.mesSeleccionadoCP04, false);
    }

    /**
     * Configura y renderiza la vista para CP05 (CPPVvsCAZonaBarra - Gráfica amplia sin tabla)
     */
    configurarVistaCP05(data) {
        this.chartTipoActual = 'CP05';
        this.mesSeleccionadoCP04 = null;

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo por Kg. Pollo Vivo vs Costo de Alimentacion';

        // Mostrar selector de ZONA para CP05
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.remove('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[520px] h-[calc(100vh-250px)] max-h-[750px] p-4";
        }

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        this.renderizarGraficaCP05(data);
    }

    /**
     * Configura y renderiza la vista para CP05 MortVsPeso (Mortalidad Vs Peso Promedio - Gráfica 2 Líneas + Detalle Cencos)
     */
    configurarVistaCP05MortVsPeso(data) {
        this.chartTipoActual = 'CP05MortVsPeso';

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Mortalidad Vs Peso Promedio';

        // Mostrar selector de ZONA para CP05 MortVsPeso
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.remove('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[440px] h-[calc(100vh-340px)] max-h-[580px] p-4";
        }

        // Mostrar card de tabla de detalle
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        const titTabla = document.getElementById('titulo-tabla-detalle');
        if (titTabla) titTabla.textContent = 'Mortalidad Vs Peso Promedio Detalle';

        this.renderizarGraficaCP05MortVsPeso(data);
        this.actualizarFiltroCruzadoCP05(this.mesSeleccionadoCP05, false);
    }

    /**
     * Configura y renderiza la vista para CP07 (Costo de Producción de Alimento Balanceado vs Costo de Insumos)
     */
    configurarVistaCP07(data) {
        this.chartTipoActual = 'CP07';

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Costo de Produccion de Alimento Balanceado';

        // Ocultar selector de Zona y mostrar selector de Item
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.remove('hidden');

        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[440px] h-[calc(100vh-340px)] max-h-[580px] p-4";
        }

        // Mostrar card de tabla de detalle
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.remove('hidden');

        const titTabla = document.getElementById('titulo-tabla-detalle');
        if (titTabla) titTabla.textContent = 'Costo de Insumos';

        const subTabla = document.getElementById('subtitulo-tabla-detalle');
        if (subTabla) subTabla.textContent = 'Costo unitario por kilogramo de materias primas e insumos por mes de fecha';

        // Poblar catálogo de insumos en el dropdown
        this.poblarDropdownItems(data.catalogoInsumos || []);

        this.renderizarGraficaCP07(data);
        this.filtrarTablaCP07Localmente();
    }

    /**
     * Configura y renderiza la vista para CP08 (Tendencia de CU de Insumos por Código - Multilínea)
     */
    configurarVistaCP08(data) {
        this.chartTipoActual = 'CP08';

        const titulo = document.getElementById('titulo-grafica-principal');
        if (titulo) titulo.textContent = 'Tendencia de CU de Insumos por Codigo';

        // Ocultar selector de Zona y mostrar selector de Item
        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.remove('hidden');

        // Gráfica amplia completa
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (contenedorGrafica) {
            contenedorGrafica.className = "relative w-full min-h-[520px] h-[calc(100vh-250px)] max-h-[750px] p-4";
        }

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        // Ocultar card de tabla de detalle (en CP08 solo es gráfica de líneas)
        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        // Si el backend preseleccionó los 5 insumos principales por defecto inicial
        if (data.esSeleccionPorDefecto && data.itemsPreseleccionados && data.itemsPreseleccionados.length > 0) {
            this.itemsSeleccionadosCP07 = data.itemsPreseleccionados;
        }

        // Poblar catálogo de insumos en el dropdown
        this.poblarDropdownItems(data.catalogoInsumos || []);

        this.renderizarGraficaCP08(data);
    }

    /**
     * Configura el comportamiento interactivo del dropdown multi-select de insumos
     */
    setupDropdownItems() {
        const btnDropdown = document.getElementById('btn-dropdown-items');
        const panelDropdown = document.getElementById('panel-dropdown-items');
        const inputBuscar = document.getElementById('input-buscar-item');
        const chkTodo = document.getElementById('chk-item-todo');

        if (!btnDropdown || !panelDropdown) return;

        // Toggle panel al hacer click en el botón
        btnDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            panelDropdown.classList.toggle('hidden');
            if (!panelDropdown.classList.contains('hidden') && inputBuscar) {
                inputBuscar.focus();
            }
        });

        // Evitar que clicks dentro del panel cierren el dropdown
        panelDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Cerrar al hacer click fuera
        document.addEventListener('click', () => {
            if (!panelDropdown.classList.contains('hidden')) {
                panelDropdown.classList.add('hidden');
            }
        });

        // Búsqueda en tiempo real dentro del dropdown
        if (inputBuscar) {
            inputBuscar.addEventListener('input', () => {
                const term = inputBuscar.value.toLowerCase().trim();
                const itemsDom = document.querySelectorAll('.item-checkbox-row');
                itemsDom.forEach(row => {
                    const text = row.getAttribute('data-search-text') || '';
                    if (!term || text.includes(term)) {
                        row.classList.remove('hidden');
                    } else {
                        row.classList.add('hidden');
                    }
                });
            });
        }

        // Checkbox "(Todo)"
        if (chkTodo) {
            chkTodo.addEventListener('change', () => {
                const isChecked = chkTodo.checked;
                const checkboxes = document.querySelectorAll('.chk-item-individual');
                checkboxes.forEach(chk => {
                    chk.checked = isChecked;
                });
                if (isChecked) {
                    this.itemsSeleccionadosCP07 = this.catalogoInsumosCP07.map(c => c.codigo);
                } else {
                    this.itemsSeleccionadosCP07 = ['__NONE__'];
                }
                this.actualizarLabelItems();
            });
        }
    }

    /**
     * Llena la lista de checkboxes del dropdown de insumos
     */
    poblarDropdownItems(catalogo = []) {
        this.catalogoInsumosCP07 = catalogo;
        const listaContenedor = document.getElementById('lista-checkboxes-items');
        const chkTodo = document.getElementById('chk-item-todo');
        if (!listaContenedor) return;

        if (catalogo.length === 0) {
            listaContenedor.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-4">No hay insumos disponibles</div>';
            if (chkTodo) chkTodo.checked = false;
            return;
        }

        const totalItems = catalogo.length;

        // Si aún no hay selección establecida (carga inicial), por defecto seleccionar los 4 primeros
        if (!this.itemsSeleccionadosCP07 || this.itemsSeleccionadosCP07.length === 0) {
            this.itemsSeleccionadosCP07 = catalogo.slice(0, 4).map(c => c.codigo);
        }

        // El check "(Todo)" solo está activo si explícitamente se seleccionaron todos o '(TODO)'
        const isAllExplicitlySelected = this.itemsSeleccionadosCP07.includes('(TODO)') || 
            (this.itemsSeleccionadosCP07.length === totalItems && !this.itemsSeleccionadosCP07.includes('__NONE__'));

        if (chkTodo) {
            chkTodo.checked = isAllExplicitlySelected;
        }

        let html = '';
        catalogo.forEach(item => {
            const isChecked = isAllExplicitlySelected 
                ? true 
                : this.itemsSeleccionadosCP07.includes(item.codigo);
            const searchText = `${item.codigo} ${item.nomcodigo}`.toLowerCase();
            html += `
                <label class="item-checkbox-row flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer text-[11px] text-slate-700 select-none transition-colors"
                    data-search-text="${searchText}">
                    <input type="checkbox" value="${item.codigo}" class="chk-item-individual w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer" ${isChecked ? 'checked' : ''}>
                    <span class="truncate" title="${item.item_label}">${item.item_label}</span>
                </label>
            `;
        });

        listaContenedor.innerHTML = html;

        // Listeners para checkboxes individuales
        const checkboxes = listaContenedor.querySelectorAll('.chk-item-individual');
        checkboxes.forEach(chk => {
            chk.addEventListener('change', () => {
                const total = checkboxes.length;
                const marcados = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
                
                const chkTodoDom = document.getElementById('chk-item-todo');
                if (marcados.length === total) {
                    if (chkTodoDom) chkTodoDom.checked = true;
                    this.itemsSeleccionadosCP07 = this.catalogoInsumosCP07.map(c => c.codigo);
                } else if (marcados.length === 0) {
                    if (chkTodoDom) chkTodoDom.checked = false;
                    this.itemsSeleccionadosCP07 = ['__NONE__'];
                } else {
                    if (chkTodoDom) chkTodoDom.checked = false;
                    this.itemsSeleccionadosCP07 = marcados;
                }

                this.actualizarLabelItems();
            });
        });

        this.actualizarLabelItems();
    }

    /**
     * Actualiza la etiqueta del botón dropdown y el contador
     */
    actualizarLabelItems() {
        const label = document.getElementById('label-items-seleccionados');
        const badge = document.getElementById('badge-contador-items');
        if (!label) return;

        const totalCatalogo = (this.catalogoInsumosCP07 || []).length;
        const count = (this.itemsSeleccionadosCP07 || []).filter(c => c !== '__NONE__' && c !== '(TODO)').length;

        if (this.itemsSeleccionadosCP07.includes('(TODO)') || (totalCatalogo > 0 && count === totalCatalogo)) {
            label.textContent = '(Todo)';
            if (badge) badge.textContent = 'Todos';
        } else if (this.itemsSeleccionadosCP07.includes('__NONE__') || count === 0) {
            label.textContent = 'Ninguno';
            if (badge) badge.textContent = '0 selecc.';
        } else if (count === 1) {
            const codigo = this.itemsSeleccionadosCP07[0];
            const found = this.catalogoInsumosCP07.find(c => c.codigo === codigo);
            label.textContent = found ? found.item_label : codigo;
            if (badge) badge.textContent = '1 selecc.';
        } else {
            label.textContent = `${count} items seleccionados`;
            if (badge) badge.textContent = `${count} selecc.`;
        }
    }

    /**
     * Filtra la tabla matricial de insumos CP07 reactivamente sin reload
     */
    filtrarTablaCP07Localmente() {
        const data = this.datosDashboard || {};
        const todosInsumos = data.tablaInsumos || [];
        
        let filtrados = todosInsumos;
        if (this.itemsSeleccionadosCP07.includes('__NONE__')) {
            filtrados = [];
        } else if (this.itemsSeleccionadosCP07.includes('(TODO)')) {
            filtrados = todosInsumos;
        } else if (this.itemsSeleccionadosCP07.length > 0) {
            filtrados = todosInsumos.filter(item => this.itemsSeleccionadosCP07.includes(item.codigo));
        }

        this.renderizarTablaCP07({
            periodos: data.periodos,
            tablaInsumos: filtrados
        });
    }

    /**
     * Actualiza el estado reactivo del filtro cruzado en CP05 MortVsPeso sin destruir la gráfica
     */
    actualizarFiltroCruzadoCP05(mesKey, triggerChartUpdate = true) {
        this.mesSeleccionadoCP05 = mesKey;
        const data = this.datosDashboard || {};

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        const subTabla = document.getElementById('subtitulo-tabla-detalle');
        if (subTabla) {
            if (this.mesSeleccionadoCP05) {
                const mesObj = (data.graficaCP05MortVsPeso || []).find(m => m.key === this.mesSeleccionadoCP05);
                const nombreMes = mesObj ? mesObj.mes_larga : this.mesSeleccionadoCP05;
                subTabla.innerHTML = `<span class="text-amber-700 font-semibold">Detalle filtrado para el mes de <strong class="capitalize">${nombreMes}</strong></span>`;
            } else {
                subTabla.textContent = 'Histórico detallado por centro de costo (cencos) y mes de fecha';
            }
        }

        const detalleAMostrar = this.mesSeleccionadoCP05
            ? (data.detalleMesesCP05MortVsPeso || []).filter(m => m.key === this.mesSeleccionadoCP05)
            : (data.detalleMesesCP05MortVsPeso || []);

        this.renderizarTablaCP05MortVsPeso({ detalleMeses: detalleAMostrar });

        if (triggerChartUpdate && this.chartInstance && this.chartTipoActual === 'CP05MortVsPeso') {
            try {
                this.chartInstance.update('none');
            } catch (e) {
                console.warn('Error al actualizar gráfica CP05 MortVsPeso:', e);
            }
        }
    }

    /**
     * Actualiza el estado reactivo del filtro cruzado en CP04 sin destruir la gráfica
     */
    actualizarFiltroCruzadoCP04(mesKey, triggerChartUpdate = true) {
        this.mesSeleccionadoCP04 = mesKey;
        const data = this.datosDashboard || {};

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = '';
        }

        const subTabla = document.getElementById('subtitulo-tabla-detalle');
        if (subTabla) {
            if (this.mesSeleccionadoCP04) {
                const mesObj = (data.graficaCP04 || []).find(m => m.key === this.mesSeleccionadoCP04);
                const nombreMes = mesObj ? mesObj.mes_larga : this.mesSeleccionadoCP04;
                subTabla.innerHTML = `<span class="text-amber-700 font-semibold">Detalle filtrado para el mes de <strong class="capitalize">${nombreMes}</strong></span>`;
            } else {
                subTabla.textContent = 'Histórico detallado por centro de costo (cencos) y mes de fecha';
            }
        }

        const detalleAMostrar = this.mesSeleccionadoCP04
            ? (data.detalleMesesCP04 || []).filter(m => m.key === this.mesSeleccionadoCP04)
            : (data.detalleMesesCP04 || []);

        this.renderizarTablaCP04({ detalleMeses: detalleAMostrar });

        if (triggerChartUpdate && this.chartInstance && this.chartTipoActual === 'CP04') {
            try {
                this.chartInstance.update('none');
            } catch (e) {
                console.warn('Error al actualizar gráfica CP04:', e);
            }
        }
    }

    /**
     * 1. Renderizado de Gráfica CP01 (Línea con Referencia Benchmark)
     */
    renderizarGraficaCP01(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCosto = data.graficaCosto || [];
        const benchmark = data.benchmark || 4.538;

        if (graficaCosto.length === 0) return;

        const labels = graficaCosto.map(d => d.mes_larga || d.mes_corta || d.key);
        const valoresCosto = graficaCosto.map(d => Number(d.costo || 0));

        const coloresPuntos = graficaCosto.map(d => (d.estado === 'bajo' ? '#16a34a' : '#b91c1c'));
        const coloresHover = graficaCosto.map(d => (d.estado === 'bajo' ? '#15803d' : '#991b1b'));

        const datasetCosto = {
            label: 'Costo de Producción',
            data: valoresCosto,
            borderColor: '#475569',
            backgroundColor: '#475569',
            borderWidth: 2,
            tension: 0.05,
            pointRadius: 5,
            pointHoverRadius: 7.5,
            pointBackgroundColor: coloresPuntos,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointHoverBackgroundColor: coloresHover,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            datalabels: {
                align: 'top',
                offset: 6,
                color: (context) => coloresPuntos[context.dataIndex] || '#1e293b',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const datasetBenchmark = {
            label: `Promedio / Meta (${this.formatearNumero(benchmark, 'decimal3')})`,
            data: labels.map(() => benchmark),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            datalabels: {
                display: (context) => context.dataIndex === context.dataset.data.length - 1,
                align: 'right',
                offset: 8,
                color: '#2563eb',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    size: 11.5,
                    weight: 'bold'
                },
                formatter: () => this.formatearNumero(benchmark, 'decimal3')
            }
        };

        let minY = 3.8;
        let maxY = 4.8;
        if (valoresCosto.length > 0) {
            const minVal = Math.min(...valoresCosto, benchmark);
            const maxVal = Math.max(...valoresCosto, benchmark);
            minY = Math.min(3.8, Math.floor((minVal - 0.2) * 10) / 10);
            maxY = Math.max(4.8, Math.ceil((maxVal + 0.2) * 10) / 10);
        }

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetCosto, datasetBenchmark]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 24, bottom: 8, left: 10, right: 42 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'Costo',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.2,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !graficaCosto[dataIndex]) return;

                            const item = graficaCosto[dataIndex];
                            const estadoTexto = item.estado === 'bajo' 
                                ? '<span class="text-emerald-600 font-bold">Bajo Meta (Favorable)</span>' 
                                : '<span class="text-rose-600 font-bold">Sobre Meta (Alto)</span>';

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-slate-500 font-normal">Costo Producción:</span>
                                    <span class="text-slate-900 font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo, 'decimal3')}</span>
                                    <span class="text-slate-500 font-normal">Benchmark / Meta:</span>
                                    <span class="text-blue-600 font-semibold text-left font-mono">${this.formatearNumero(benchmark, 'decimal3')}</span>
                                    <span class="text-slate-500 font-normal">Estado:</span>
                                    <span class="text-left">${estadoTexto}</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 2. Renderizado de Gráfica CP02 (Doble Eje: PROD PV vs Cost Alim)
     */
    renderizarGraficaCP02(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCP02 = data.graficaCP02 || [];
        if (graficaCP02.length === 0) return;

        const labels = graficaCP02.map(d => d.mes_larga || d.mes_corta || d.key);
        const valoresProd = graficaCP02.map(d => Number(d.costo_produccion || 0));
        const valoresAlim = graficaCP02.map(d => Number(d.costo_alimentacion || 0));

        let minProd = 3.8, maxProd = 4.7;
        if (valoresProd.length > 0) {
            const minV = Math.min(...valoresProd);
            const maxV = Math.max(...valoresProd);
            minProd = Math.min(3.8, Math.floor((minV - 0.1) * 10) / 10);
            maxProd = Math.max(4.7, Math.ceil((maxV + 0.1) * 10) / 10);
        }

        let minAlim = 2.40, maxAlim = 2.74;
        if (valoresAlim.length > 0) {
            const minV = Math.min(...valoresAlim);
            const maxV = Math.max(...valoresAlim);
            minAlim = Math.min(2.40, Math.floor((minV - 0.04) * 100) / 100);
            maxAlim = Math.max(2.74, Math.ceil((maxV + 0.04) * 100) / 100);
        }

        const getSmartAlignment = (datasetIdx, dataIdx) => {
            const prodVal = valoresProd[dataIdx];
            const alimVal = valoresAlim[dataIdx];

            const normProd = (prodVal - minProd) / (maxProd - minProd || 1);
            const normAlim = (alimVal - minAlim) / (maxAlim - minAlim || 1);
            const diff = normProd - normAlim;

            if (datasetIdx === 0) {
                if (diff < 0.12 || (dataIdx > 0 && prodVal < valoresProd[dataIdx - 1] && dataIdx < valoresProd.length - 1 && prodVal < valoresProd[dataIdx + 1])) {
                    return 'bottom';
                }
                return 'top';
            } else {
                if (diff < 0.12) {
                    return 'top';
                }
                return 'bottom';
            }
        };

        const datasetProd = {
            label: 'PROD PV',
            data: valoresProd,
            yAxisID: 'y',
            borderColor: '#4f7cac',
            backgroundColor: '#4f7cac',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#4f7cac',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            datalabels: {
                align: (context) => getSmartAlignment(0, context.dataIndex),
                offset: 6,
                color: '#2b5c8f',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const datasetAlim = {
            label: 'Cost Alim',
            data: valoresAlim,
            yAxisID: 'y1',
            borderColor: '#c0392b',
            backgroundColor: '#c0392b',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#c0392b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            datalabels: {
                align: (context) => getSmartAlignment(1, context.dataIndex),
                offset: 6,
                color: '#c0392b',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetProd, datasetAlim]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 28, bottom: 12, left: 12, right: 12 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: minProd,
                        max: maxProd,
                        title: {
                            display: true,
                            text: 'PROD PV',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.1,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minAlim,
                        max: maxAlim,
                        title: {
                            display: true,
                            text: 'Cost Alim',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.02,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(2).replace('.', ',')
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 12,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !graficaCP02[dataIndex]) return;

                            const item = graficaCP02[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-[#2b5c8f] font-semibold">PROD PV:</span>
                                    <span class="text-[#2b5c8f] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_produccion, 'decimal3')} S//Kg</span>
                                    <span class="text-[#991b1b] font-semibold">Cost Alim:</span>
                                    <span class="text-[#991b1b] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_alimentacion, 'decimal3')} S//Kg</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 3. Renderizado de Gráfica CP03 (Costo Promedio de Producción Pollo Vivo por Zona)
     */
    renderizarGraficaCP03(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        if (this.chartInstance && typeof this.chartInstance.destroy === 'function') {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        const graficaCP03 = data.graficaCP03 || {};
        const periodos = graficaCP03.periodos || [];
        const zonas = graficaCP03.zonas || [];
        const seriesData = graficaCP03.series || {};

        if (periodos.length === 0 || zonas.length === 0) return;

        const labels = periodos.map(p => p.mes_larga || p.mes_corta || p.key);

        const coloresPorZona = {
            'JOYA': {
                linea: '#2b5c8f', // Azul Tableau
                fondo: '#2b5c8f',
                texto: '#2b5c8f'
            },
            'MOLLENDO': {
                linea: '#38a169', // Verde Tableau
                fondo: '#38a169',
                texto: '#2f855a'
            }
        };

        const defaultColores = [
            { linea: '#2b5c8f', fondo: '#2b5c8f', texto: '#2b5c8f' },
            { linea: '#38a169', fondo: '#38a169', texto: '#2f855a' },
            { linea: '#d97706', fondo: '#d97706', texto: '#b45309' },
            { linea: '#7c3aed', fondo: '#7c3aed', texto: '#6d28d9' }
        ];

        const todosValores = [];
        zonas.forEach(z => {
            const zMap = seriesData[z] || {};
            periodos.forEach(p => {
                const v = zMap[p.key] ? Number(zMap[p.key].costo || 0) : null;
                if (v !== null && v > 0) todosValores.push(v);
            });
        });

        let minY = 3.6, maxY = 5.4;
        if (todosValores.length > 0) {
            const minV = Math.min(...todosValores);
            const maxV = Math.max(...todosValores);
            minY = Math.min(3.6, Math.floor((minV - 0.2) * 10) / 10);
            maxY = Math.max(5.4, Math.ceil((maxV + 0.2) * 10) / 10);
        }

        const datasets = zonas.map((zona, zIdx) => {
            const paleta = coloresPorZona[zona] || defaultColores[zIdx % defaultColores.length];
            const zMap = seriesData[zona] || {};
            const dataPuntos = periodos.map(p => (zMap[p.key] ? Number(zMap[p.key].costo || 0) : null));

            return {
                label: zona,
                data: dataPuntos,
                borderColor: paleta.linea,
                backgroundColor: paleta.fondo,
                borderWidth: 2.2,
                tension: 0.05,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                pointBackgroundColor: paleta.fondo,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                datalabels: {
                    align: (context) => {
                        const dataIdx = context.dataIndex;
                        const pKey = periodos[dataIdx]?.key;
                        if (zonas.length >= 2) {
                            const valActual = dataPuntos[dataIdx];
                            const otraZona = zonas.find(z => z !== zona);
                            const valOtra = (seriesData[otraZona] && seriesData[otraZona][pKey]) ? Number(seriesData[otraZona][pKey].costo || 0) : null;
                            if (valOtra !== null && valActual !== null) {
                                if (valActual < valOtra) return 'bottom';
                                return 'top';
                            }
                        }
                        return 'top';
                    },
                    offset: 6,
                    color: paleta.texto,
                    font: {
                        family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                        size: 11,
                        weight: 'bold'
                    },
                    formatter: (value) => (value !== null && value !== undefined && value > 0 ? this.formatearNumero(value, 'decimal3') : '')
                }
            };
        });

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 28, bottom: 12, left: 12, right: 12 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'CPV',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.2,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    x: {
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 12,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !periodos[dataIndex]) return;

                            const p = periodos[dataIndex];

                            let seriesHtml = '';
                            zonas.forEach((zona, zIdx) => {
                                const paleta = coloresPorZona[zona] || defaultColores[zIdx % defaultColores.length];
                                const zMap = seriesData[zona] || {};
                                const item = zMap[p.key];
                                if (item && item.costo) {
                                    seriesHtml += `
                                        <span class="font-semibold" style="color: ${paleta.texto};">${zona}:</span>
                                        <span class="font-bold font-mono text-xs" style="color: ${paleta.texto};">${this.formatearNumero(item.costo, 'decimal3')} S//Kg</span>
                                    `;
                                }
                            });

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${p.mes_larga || p.mes_corta}</span>
                                    ${seriesHtml}
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 4. Renderizado de la Tabla de Indicadores (Detalle Costo de Producción Pollo Vivo - MES para CP01)
     */
    renderizarTablaMetricas(data = {}) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');

        if (!thead || !tbody) return;

        const periodos = data.periodos || [];
        const tablaMetricas = data.tablaMetricas || [];

        if (periodos.length === 0 || tablaMetricas.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="24" class="text-center py-10 text-slate-400">No hay métricas disponibles para el período seleccionado.</td></tr>`;
            return;
        }

        let theadHtml = `
            <tr class="bg-blue-600 text-white font-bold text-xs uppercase tracking-wider">
                <th class="py-2 px-3 text-center border-b border-r border-blue-500 sticky left-0 z-30 bg-blue-600">
                    Mes de fecha
                </th>
                <th colspan="${periodos.length}" class="py-2 px-3 text-center border-b border-blue-500">
                    Mes de fecha
                </th>
            </tr>
            <tr class="bg-blue-600 text-white font-bold text-xs">
                <th class="py-2.5 px-3 text-left border-r border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[220px] max-w-[260px] shadow-sm">
                    Indicador
                </th>
        `;

        periodos.forEach(p => {
            theadHtml += `
                <th class="py-2.5 px-3 text-center whitespace-nowrap border-r border-blue-500 min-w-[95px] font-semibold text-[11px]">
                    ${p.mes_corta}
                </th>
            `;
        });

        theadHtml += `</tr>`;
        thead.innerHTML = theadHtml;

        let tbodyHtml = '';

        tablaMetricas.forEach((metrica, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/70' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/50 transition-colors border-b border-slate-200/80">
                    <td class="py-2 px-3 font-bold text-slate-800 text-[11px] border-r border-slate-200 sticky left-0 z-20 ${stickyBg} shadow-xs truncate">
                        ${metrica.nombre}
                    </td>
            `;

            periodos.forEach(p => {
                const valorRaw = metrica.valores ? metrica.valores[p.key] : null;
                const valorFormateado = this.formatearNumero(valorRaw, metrica.formato);

                tbodyHtml += `
                    <td class="py-2 px-3 text-right font-mono text-slate-700 text-[11.5px] border-r border-slate-200/60 whitespace-nowrap cursor-pointer hover:bg-blue-100/60 hover:text-blue-900 transition-colors"
                        data-tooltip-metrica="true"
                        data-tt-indicador="${metrica.nombre}"
                        data-tt-mes="${p.mes_larga || p.mes_corta}"
                        data-tt-valor="${valorFormateado}">
                        ${valorFormateado}
                    </td>
                `;
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    }

    /**
     * 5. Renderizado de Gráfica CP04 (Costo por Kg. Pollo Vivo vs Costo de Alimentación - Barras + Línea Doble Eje)
     */
    renderizarGraficaCP04(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        this.destruirGraficaActual();

        const periodosGrafica = data.graficaCP04 || data.periodosGrafica || [];
        if (periodosGrafica.length === 0) return;

        const labels = periodosGrafica.map(d => d.mes_larga || d.key);
        const valoresCostoxKg = periodosGrafica.map(d => Number(d.costo_produccion || 0));
        const valoresCostoAlim = periodosGrafica.map(d => Number(d.costo_alimentacion || 0));

        let minProd = 2.5, maxProd = 4.8;
        if (valoresCostoxKg.length > 0) {
            const minV = Math.min(...valoresCostoxKg);
            const maxV = Math.max(...valoresCostoxKg);
            minProd = Math.min(2.5, Math.floor((minV - 0.2) * 10) / 10);
            maxProd = Math.max(4.8, Math.ceil((maxV + 0.1) * 10) / 10);
        }

        let minAlim = 2.38, maxAlim = 2.85;
        if (valoresCostoAlim.length > 0) {
            const minV = Math.min(...valoresCostoAlim);
            const maxV = Math.max(...valoresCostoAlim);
            minAlim = Math.min(2.38, Math.floor((minV - 0.05) * 100) / 100);
            maxAlim = Math.max(2.85, Math.ceil((maxV + 0.05) * 100) / 100);
        }

        const datasetAlimentacion = {
            type: 'bar',
            label: 'CostoAlimentacion',
            data: valoresCostoAlim,
            yAxisID: 'y1',
            backgroundColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04) return '#f28e2b';
                return (item && item.key === this.mesSeleccionadoCP04) ? '#ea580c' : 'rgba(242, 142, 43, 0.22)';
            },
            hoverBackgroundColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04) return '#e07d1b';
                return (item && item.key === this.mesSeleccionadoCP04) ? '#c2410c' : 'rgba(242, 142, 43, 0.35)';
            },
            borderColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (item && item.key === this.mesSeleccionadoCP04) return '#0f172a';
                return 'transparent';
            },
            borderWidth: (context) => {
                const item = periodosGrafica[context.dataIndex];
                return (item && item.key === this.mesSeleccionadoCP04) ? 2.5 : 0;
            },
            borderRadius: 1,
            barPercentage: 0.54,
            categoryPercentage: 0.82,
            order: 2,
            datalabels: {
                anchor: 'end',
                align: 'top',
                offset: 3,
                color: (context) => {
                    const item = periodosGrafica[context.dataIndex];
                    if (!this.mesSeleccionadoCP04 || (item && item.key === this.mesSeleccionadoCP04)) return '#c2410c';
                    return '#cbd5e1';
                },
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 10.5,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const datasetCostoxKg = {
            type: 'line',
            label: 'CostoxKg',
            data: valoresCostoxKg,
            yAxisID: 'y',
            borderColor: '#4e79a7',
            segment: {
                borderColor: () => this.mesSeleccionadoCP04 ? 'rgba(78, 121, 167, 0.35)' : '#4e79a7'
            },
            backgroundColor: '#4e79a7',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04) return 4;
                return (item && item.key === this.mesSeleccionadoCP04) ? 6 : 2;
            },
            pointHoverRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04) return 6.5;
                return (item && item.key === this.mesSeleccionadoCP04) ? 8 : 4;
            },
            pointBackgroundColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04) return '#4e79a7';
                return (item && item.key === this.mesSeleccionadoCP04) ? '#1e40af' : 'rgba(78, 121, 167, 0.25)';
            },
            pointBorderColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP04 || (item && item.key === this.mesSeleccionadoCP04)) return '#ffffff';
                return 'transparent';
            },
            pointBorderWidth: (context) => {
                const item = periodosGrafica[context.dataIndex];
                return (item && item.key === this.mesSeleccionadoCP04) ? 2.5 : 1;
            },
            order: 1,
            datalabels: {
                anchor: 'center',
                align: 'top',
                offset: 7,
                color: (context) => {
                    const item = periodosGrafica[context.dataIndex];
                    if (!this.mesSeleccionadoCP04 || (item && item.key === this.mesSeleccionadoCP04)) return '#1e40af';
                    return '#cbd5e1';
                },
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 10.5,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'bar',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetAlimentacion, datasetCostoxKg]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 32, bottom: 8, left: 10, right: 10 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onClick: (event, elements, chart) => {
                    const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
                    if (points && points.length > 0) {
                        const dataIndex = points[0].index;
                        const clickedItem = periodosGrafica[dataIndex];
                        if (clickedItem) {
                            const newKey = (this.mesSeleccionadoCP04 === clickedItem.key) ? null : clickedItem.key;
                            this.actualizarFiltroCruzadoCP04(newKey, true);
                        }
                    } else {
                        if (this.mesSeleccionadoCP04 !== null) {
                            this.actualizarFiltroCruzadoCP04(null, true);
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: minProd,
                        max: maxProd,
                        title: {
                            display: true,
                            text: 'CPV',
                            color: '#475569',
                            font: { size: 11.5, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#64748b',
                            font: { size: 10.5, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minAlim,
                        max: maxAlim,
                        title: {
                            display: true,
                            text: 'CA',
                            color: '#475569',
                            font: { size: 11.5, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.1,
                            color: '#64748b',
                            font: { size: 10.5, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes de fecha',
                            color: '#64748b',
                            font: { size: 11, weight: '600' },
                            padding: { top: 6 }
                        },
                        ticks: {
                            color: (ctx) => {
                                const item = periodosGrafica[ctx.index];
                                if (item && item.key === this.mesSeleccionadoCP04) return '#000000';
                                if (this.mesSeleccionadoCP04) return '#94a3b8';
                                return '#475569';
                            },
                            font: (ctx) => {
                                const item = periodosGrafica[ctx.index];
                                const isSel = (item && item.key === this.mesSeleccionadoCP04);
                                return {
                                    size: 10.5,
                                    weight: isSel ? 'bold' : '600'
                                };
                            },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 11.5,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !periodosGrafica[dataIndex]) return;

                            const item = periodosGrafica[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-[#c2410c] font-semibold">CostoAlimentacion:</span>
                                    <span class="text-[#c2410c] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_alimentacion, 'decimal3')} S//Kg</span>
                                    <span class="text-[#1e40af] font-semibold">CostoxKg:</span>
                                    <span class="text-[#1e40af] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_produccion, 'decimal3')} S//Kg</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 7. Renderizado de Gráfica CP05 (CPPVvsCAZonaBarra - Costo por Kg. Pollo Vivo vs Costo de Alimentación en modo completo)
     */
    renderizarGraficaCP05(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        this.destruirGraficaActual();

        const periodosGrafica = data.graficaCP04 || data.periodosGrafica || [];
        if (periodosGrafica.length === 0) return;

        const labels = periodosGrafica.map(d => d.mes_larga || d.key);
        const valoresCostoxKg = periodosGrafica.map(d => Number(d.costo_produccion || 0));
        const valoresCostoAlim = periodosGrafica.map(d => Number(d.costo_alimentacion || 0));

        let minProd = 2.2, maxProd = 5.0;
        if (valoresCostoxKg.length > 0) {
            const minV = Math.min(...valoresCostoxKg);
            const maxV = Math.max(...valoresCostoxKg);
            minProd = Math.min(2.2, Math.floor((minV - 0.2) * 10) / 10);
            maxProd = Math.max(5.0, Math.ceil((maxV + 0.2) * 10) / 10);
        }

        let minAlim = 2.30, maxAlim = 2.90;
        if (valoresCostoAlim.length > 0) {
            const minV = Math.min(...valoresCostoAlim);
            const maxV = Math.max(...valoresCostoAlim);
            minAlim = Math.min(2.30, Math.floor((minV - 0.05) * 100) / 100);
            maxAlim = Math.max(2.90, Math.ceil((maxV + 0.05) * 100) / 100);
        }

        const datasetAlimentacion = {
            type: 'bar',
            label: 'CostoAlimentacion',
            data: valoresCostoAlim,
            yAxisID: 'y1',
            backgroundColor: '#f28e2b',
            hoverBackgroundColor: '#e07d1b',
            borderRadius: 1,
            barPercentage: 0.52,
            categoryPercentage: 0.8,
            order: 2,
            datalabels: {
                anchor: 'end',
                align: 'top',
                offset: 4,
                color: '#d97706',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11.5,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const datasetCostoxKg = {
            type: 'line',
            label: 'CostoxKg',
            data: valoresCostoxKg,
            yAxisID: 'y',
            borderColor: '#4e79a7',
            backgroundColor: '#4e79a7',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: 4.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#4e79a7',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            order: 1,
            datalabels: {
                anchor: 'center',
                align: 'top',
                offset: 8,
                color: '#4e79a7',
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 12,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'bar',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetAlimentacion, datasetCostoxKg]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 32, bottom: 12, left: 12, right: 12 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: minProd,
                        max: maxProd,
                        title: {
                            display: true,
                            text: 'CPV',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.2,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minAlim,
                        max: maxAlim,
                        title: {
                            display: true,
                            text: 'CA',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.05,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(2).replace('.', ',')
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes de fecha',
                            color: '#64748b',
                            font: { size: 11.5, weight: '600' },
                            padding: { top: 8 }
                        },
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rect',
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 12,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !periodosGrafica[dataIndex]) return;

                            const item = periodosGrafica[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-[#f28e2b] font-semibold">CostoAlimentacion:</span>
                                    <span class="text-[#f28e2b] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_alimentacion, 'decimal3')} S//Kg</span>
                                    <span class="text-[#4e79a7] font-semibold">CostoxKg:</span>
                                    <span class="text-[#4e79a7] font-bold text-left font-mono text-xs">${this.formatearNumero(item.costo_produccion, 'decimal3')} S//Kg</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 6. Renderizado de la Tabla de Detalle CP04 (Costo por Kg. Pollo Vivo vs Costo de Alimentación Detalle)
     */
    renderizarTablaCP04(data = {}) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');

        if (!thead || !tbody) return;

        const detalleMeses = data.detalleMeses || [];
        if (detalleMeses.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="24" class="text-center py-10 text-slate-400">No hay detalle disponible.</td></tr>`;
            return;
        }

        // Fila 1 de encabezado: Mes de fecha / cencos + Nombres de meses agrupados
        let theadRow1 = `
            <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-500">
                <th rowspan="2" class="py-2.5 px-3 text-left border-r border-b border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[130px] max-w-[160px] text-white font-bold text-xs shadow-sm">
                    Mes de fecha / cencos
                </th>
        `;

        // Fila 2 de encabezado: Códigos de CENCOS + Total
        let theadRow2 = `
            <tr class="bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-500">
        `;

        detalleMeses.forEach(m => {
            theadRow1 += `
                <th colspan="${m.cencosList.length}" class="py-2 px-3 text-center border-b border-r border-blue-500 bg-blue-600 text-white font-bold text-xs">
                    ${m.mes}
                </th>
            `;

            m.cencosList.forEach(cencos => {
                const isTotal = (cencos === 'Total');
                const thClass = isTotal 
                    ? 'bg-blue-800/90 text-white font-bold border-r border-blue-500' 
                    : 'bg-blue-600 text-blue-50 font-semibold border-r border-blue-500';

                theadRow2 += `
                    <th class="py-1.5 px-2.5 text-center whitespace-nowrap border-b ${thClass} min-w-[74px]">
                        ${cencos}
                    </th>
                `;
            });
        });

        theadRow1 += `</tr>`;
        theadRow2 += `</tr>`;
        thead.innerHTML = theadRow1 + theadRow2;

        // Definición de las 6 filas métricas en el orden exacto de Tableau
        const metricasConfig = [
            { id: 'val_alim', nombre: 'Valor Alime..', formato: 'entero' },
            { id: 'saca_kg', nombre: 'SACA Kg', formato: 'entero' },
            { id: 'costo_alim', nombre: 'CostoAlime..', formato: 'decimal3' },
            { id: 'val_avi', nombre: 'Valor Avicul..', formato: 'entero' },
            { id: 'peso_avi', nombre: 'Peso Avicul..', formato: 'entero' },
            { id: 'costo_kg', nombre: 'CostoxKg', formato: 'decimal3' }
        ];

        let tbodyHtml = '';

        metricasConfig.forEach((metrica, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/60' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/40 transition-colors border-b border-slate-200">
                    <td class="py-2 px-3 font-semibold text-slate-800 text-[11px] border-r border-slate-200 sticky left-0 z-20 ${stickyBg} shadow-xs truncate">
                        ${metrica.nombre}
                    </td>
            `;

            detalleMeses.forEach(m => {
                m.cencosList.forEach(cencos => {
                    const celdaData = m.columnas && m.columnas[cencos] ? m.columnas[cencos] : null;
                    const rawVal = celdaData ? celdaData[metrica.id] : null;
                    const valFormateado = this.formatearNumero(rawVal, metrica.formato);

                    const isTotal = (cencos === 'Total');
                    const cellStyle = isTotal ? 'bg-slate-100/70 font-bold text-slate-900' : 'text-slate-700';

                    tbodyHtml += `
                        <td class="py-1.5 px-2.5 text-right font-mono text-[11px] border-r border-slate-200/70 whitespace-nowrap cursor-pointer hover:bg-blue-100/60 transition-colors ${cellStyle}"
                            data-tooltip-metrica="true"
                            data-tt-indicador="${metrica.nombre} (${cencos})"
                            data-tt-mes="${m.mes}"
                            data-tt-valor="${valFormateado}">
                            ${valFormateado}
                        </td>
                    `;
                });
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    }

    /**
     * 8. Renderizado de Gráfica CP05 MortVsPeso (Mortalidad vs Peso Promedio - 2 Líneas con Doble Eje Y)
     */
    renderizarGraficaCP05MortVsPeso(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        this.destruirGraficaActual();

        const periodosGrafica = data.graficaCP05MortVsPeso || [];
        if (periodosGrafica.length === 0) return;

        const labels = periodosGrafica.map(d => d.mes_larga || d.key);
        const valoresMortalidad = periodosGrafica.map(d => Number(d.mortalidad_porc || 0));
        const valoresPesoProm = periodosGrafica.map(d => Number(d.peso_promedio || 0));

        let minMort = 3.0, maxMort = 7.0;
        if (valoresMortalidad.length > 0) {
            const minV = Math.min(...valoresMortalidad);
            const maxV = Math.max(...valoresMortalidad);
            minMort = Math.min(3.0, Math.floor((minV - 0.5) * 2) / 2);
            maxMort = Math.max(7.0, Math.ceil((maxV + 0.5) * 2) / 2);
        }

        let minPeso = 2.50, maxPeso = 2.95;
        if (valoresPesoProm.length > 0) {
            const minV = Math.min(...valoresPesoProm);
            const maxV = Math.max(...valoresPesoProm);
            minPeso = Math.min(2.50, Math.floor((minV - 0.05) * 20) / 20);
            maxPeso = Math.max(2.95, Math.ceil((maxV + 0.05) * 20) / 20);
        }

        const datasetMortalidad = {
            type: 'line',
            label: '%Mortalidad',
            data: valoresMortalidad,
            yAxisID: 'y',
            borderColor: '#e15759', // Rojo Tableau
            backgroundColor: '#e15759',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return 4.5;
                return (item && item.key === this.mesSeleccionadoCP05) ? 7 : 2.5;
            },
            pointHoverRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return 7;
                return (item && item.key === this.mesSeleccionadoCP05) ? 9 : 4.5;
            },
            pointBackgroundColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return '#e15759';
                return (item && item.key === this.mesSeleccionadoCP05) ? '#b91c1c' : 'rgba(225, 87, 89, 0.25)';
            },
            pointBorderColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05 || (item && item.key === this.mesSeleccionadoCP05)) return '#ffffff';
                return 'transparent';
            },
            pointBorderWidth: (context) => {
                const item = periodosGrafica[context.dataIndex];
                return (item && item.key === this.mesSeleccionadoCP05) ? 2.5 : 1.5;
            },
            order: 1,
            datalabels: {
                anchor: 'center',
                align: 'top',
                offset: 7,
                color: (context) => {
                    const item = periodosGrafica[context.dataIndex];
                    if (!this.mesSeleccionadoCP05 || (item && item.key === this.mesSeleccionadoCP05)) return '#b91c1c';
                    return '#cbd5e1';
                },
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const datasetPesoProm = {
            type: 'line',
            label: 'PesoProm',
            data: valoresPesoProm,
            yAxisID: 'y1',
            borderColor: '#595959', // Gris oscuro / marrón Tableau
            backgroundColor: '#595959',
            borderWidth: 2.2,
            tension: 0.05,
            pointRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return 4.5;
                return (item && item.key === this.mesSeleccionadoCP05) ? 7 : 2.5;
            },
            pointHoverRadius: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return 7;
                return (item && item.key === this.mesSeleccionadoCP05) ? 9 : 4.5;
            },
            pointBackgroundColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05) return '#595959';
                return (item && item.key === this.mesSeleccionadoCP05) ? '#1e293b' : 'rgba(89, 89, 89, 0.25)';
            },
            pointBorderColor: (context) => {
                const item = periodosGrafica[context.dataIndex];
                if (!this.mesSeleccionadoCP05 || (item && item.key === this.mesSeleccionadoCP05)) return '#ffffff';
                return 'transparent';
            },
            pointBorderWidth: (context) => {
                const item = periodosGrafica[context.dataIndex];
                return (item && item.key === this.mesSeleccionadoCP05) ? 2.5 : 1.5;
            },
            order: 2,
            datalabels: {
                anchor: 'center',
                align: (context) => {
                    const val = valoresPesoProm[context.dataIndex];
                    const prev = valoresPesoProm[context.dataIndex - 1];
                    const next = valoresPesoProm[context.dataIndex + 1];
                    if (prev !== undefined && next !== undefined && val < prev && val < next) return 'bottom';
                    return 'top';
                },
                offset: 7,
                color: (context) => {
                    const item = periodosGrafica[context.dataIndex];
                    if (!this.mesSeleccionadoCP05 || (item && item.key === this.mesSeleccionadoCP05)) return '#334155';
                    return '#cbd5e1';
                },
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetMortalidad, datasetPesoProm]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 32, bottom: 8, left: 10, right: 10 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onClick: (event, elements, chart) => {
                    const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
                    if (points && points.length > 0) {
                        const dataIndex = points[0].index;
                        const clickedItem = periodosGrafica[dataIndex];
                        if (clickedItem) {
                            const newKey = (this.mesSeleccionadoCP05 === clickedItem.key) ? null : clickedItem.key;
                            this.actualizarFiltroCruzadoCP05(newKey, true);
                        }
                    } else {
                        if (this.mesSeleccionadoCP05 !== null) {
                            this.actualizarFiltroCruzadoCP05(null, true);
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: minMort,
                        max: maxMort,
                        title: {
                            display: true,
                            text: 'CA',
                            color: '#475569',
                            font: { size: 11.5, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#64748b',
                            font: { size: 10.5, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: minPeso,
                        max: maxPeso,
                        title: {
                            display: true,
                            text: 'CostoxKg',
                            color: '#475569',
                            font: { size: 11.5, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.05,
                            color: '#64748b',
                            font: { size: 10.5, weight: '500' },
                            formatter: (val) => Number(val).toFixed(2).replace('.', ',')
                        },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes de fecha',
                            color: '#64748b',
                            font: { size: 11, weight: '600' },
                            padding: { top: 6 }
                        },
                        ticks: {
                            color: (ctx) => {
                                const item = periodosGrafica[ctx.index];
                                if (item && item.key === this.mesSeleccionadoCP05) return '#000000';
                                if (this.mesSeleccionadoCP05) return '#94a3b8';
                                return '#475569';
                            },
                            font: (ctx) => {
                                const item = periodosGrafica[ctx.index];
                                const isSel = (item && item.key === this.mesSeleccionadoCP05);
                                return {
                                    size: 10.5,
                                    weight: isSel ? 'bold' : '600'
                                };
                            },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rect',
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 16,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 11.5,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !periodosGrafica[dataIndex]) return;

                            const item = periodosGrafica[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-[#b91c1c] font-semibold">%Mortalidad:</span>
                                    <span class="text-[#b91c1c] font-bold text-left font-mono text-xs">${this.formatearNumero(item.mortalidad_porc, 'decimal3')} %</span>
                                    <span class="text-[#334155] font-semibold">PesoProm:</span>
                                    <span class="text-[#334155] font-bold text-left font-mono text-xs">${this.formatearNumero(item.peso_promedio, 'decimal3')} kg</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 9. Renderizado de la Tabla de Detalle CP05 MortVsPeso (Mortalidad Vs Peso Promedio Detalle)
     */
    renderizarTablaCP05MortVsPeso(data = {}) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');

        if (!thead || !tbody) return;

        const detalleMeses = data.detalleMeses || [];
        if (detalleMeses.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="24" class="text-center py-10 text-slate-400">No hay detalle disponible.</td></tr>`;
            return;
        }

        // Fila 1 de encabezado: Mes de fecha / cencos + Nombres de meses agrupados
        let theadRow1 = `
            <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-500">
                <th rowspan="2" class="py-2.5 px-3 text-left border-r border-b border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[130px] max-w-[160px] text-white font-bold text-xs shadow-sm">
                    Mes de fecha / cencos
                </th>
        `;

        // Fila 2 de encabezado: Códigos de CENCOS + Total
        let theadRow2 = `
            <tr class="bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-500">
        `;

        detalleMeses.forEach(m => {
            theadRow1 += `
                <th colspan="${m.cencosList.length}" class="py-2 px-3 text-center border-b border-r border-blue-500 bg-blue-600 text-white font-bold text-xs">
                    ${m.mes}
                </th>
            `;

            m.cencosList.forEach(cencos => {
                const isTotal = (cencos === 'Total');
                const thClass = isTotal 
                    ? 'bg-blue-800/90 text-white font-bold border-r border-blue-500' 
                    : 'bg-blue-600 text-blue-50 font-semibold border-r border-blue-500';

                theadRow2 += `
                    <th class="py-1.5 px-2.5 text-center whitespace-nowrap border-b ${thClass} min-w-[74px]">
                        ${cencos}
                    </th>
                `;
            });
        });

        theadRow1 += `</tr>`;
        theadRow2 += `</tr>`;
        thead.innerHTML = theadRow1 + theadRow2;

        // Definición de las 6 filas métricas en el orden exacto de Tableau
        const metricasConfig = [
            { id: 'pollos_muertos', nombre: 'Pollos Muer..', formato: 'entero' },
            { id: 'pollos_inicial', nombre: 'Pollos Inicial', formato: 'entero' },
            { id: 'mortalidad_porc', nombre: '%Mortalidad', formato: 'decimal3' },
            { id: 'peso_avicola', nombre: 'Peso Avicul..', formato: 'entero' },
            { id: 'cantidad_avicola', nombre: 'Cantidad A..', formato: 'entero' },
            { id: 'peso_promedio', nombre: 'PesoProm', formato: 'decimal3' }
        ];

        let tbodyHtml = '';

        metricasConfig.forEach((metrica, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/60' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/40 transition-colors border-b border-slate-200">
                    <td class="py-2 px-3 font-semibold text-slate-800 text-[11px] border-r border-slate-200 sticky left-0 z-20 ${stickyBg} shadow-xs truncate">
                        ${metrica.nombre}
                    </td>
            `;

            detalleMeses.forEach(m => {
                m.cencosList.forEach(cencos => {
                    const celdaData = m.columnas && m.columnas[cencos] ? m.columnas[cencos] : null;
                    const rawVal = celdaData ? celdaData[metrica.id] : null;
                    const valFormateado = this.formatearNumero(rawVal, metrica.formato);

                    const isTotal = (cencos === 'Total');
                    const cellStyle = isTotal ? 'bg-slate-100/70 font-bold text-slate-900' : 'text-slate-700';

                    tbodyHtml += `
                        <td class="py-1.5 px-2.5 text-right font-mono text-[11px] border-r border-slate-200/70 whitespace-nowrap cursor-pointer hover:bg-blue-100/60 transition-colors ${cellStyle}"
                            data-tooltip-metrica="true"
                            data-tt-indicador="${metrica.nombre} (${cencos})"
                            data-tt-mes="${m.mes}"
                            data-tt-valor="${valFormateado}">
                            ${valFormateado}
                        </td>
                    `;
                });
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    }

    /**
     * 10. Renderizado de Gráfica CP07 (Costo de Producción de Alimento Balanceado - Línea con Semáforo/Gradiente Verde a Rojo)
     */
    renderizarGraficaCP07(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        this.destruirGraficaActual();

        const periodosGrafica = data.graficaCP07 || [];
        if (periodosGrafica.length === 0) return;

        const labels = periodosGrafica.map(d => d.mes_larga || d.key);
        const valoresPU = periodosGrafica.map(d => Number(d.pu || 0));

        const minPU = Math.min(...valoresPU);
        const maxPU = Math.max(...valoresPU);

        // Función interpoladora de color según Tableau (Verde para bajo ~1.63, Rojo para alto ~1.79)
        const getColorPorValor = (val) => {
            if (maxPU === minPU) return '#16a34a';
            const ratio = (val - minPU) / (maxPU - minPU);
            if (ratio < 0.4) {
                return '#2e7d32'; // Verde Tableau
            } else if (ratio < 0.7) {
                return '#ea580c'; // Ámbar/Naranja
            } else {
                return '#b91c1c'; // Rojo Tableau
            }
        };

        // Badge con escala de colores en la cabecera
        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) {
            contenedorBadges.innerHTML = `
                <div class="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-xs shadow-xs">
                    <span class="text-slate-500 font-semibold">Color:</span>
                    <span class="font-bold text-emerald-700 font-mono text-[11px]">${this.formatearNumero(minPU, 'decimal3')}</span>
                    <div class="w-20 h-2.5 rounded-full bg-gradient-to-r from-emerald-600 via-amber-400 to-rose-600 shadow-inner"></div>
                    <span class="font-bold text-rose-700 font-mono text-[11px]">${this.formatearNumero(maxPU, 'decimal3')}</span>
                </div>
            `;
        }

        let minY = 1.60, maxY = 1.85;
        if (valoresPU.length > 0) {
            minY = Math.floor((minPU - 0.03) * 20) / 20;
            maxY = Math.ceil((maxPU + 0.03) * 20) / 20;
        }

        const datasetAlimento = {
            type: 'line',
            label: 'PU',
            data: valoresPU,
            borderColor: '#b91c1c',
            segment: {
                borderColor: (ctx) => {
                    const val = ctx.p1.parsed.y;
                    return getColorPorValor(val);
                }
            },
            borderWidth: 2.6,
            tension: 0.1,
            pointRadius: 5.5,
            pointHoverRadius: 8,
            pointBackgroundColor: (ctx) => {
                const val = valoresPU[ctx.dataIndex];
                return getColorPorValor(val);
            },
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            datalabels: {
                anchor: 'center',
                align: 'top',
                offset: 8,
                color: (ctx) => {
                    const val = valoresPU[ctx.dataIndex];
                    return getColorPorValor(val);
                },
                font: {
                    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    size: 11.5,
                    weight: 'bold'
                },
                formatter: (value) => this.formatearNumero(value, 'decimal3')
            }
        };

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: [datasetAlimento]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 32, bottom: 8, left: 10, right: 10 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        min: minY,
                        max: maxY,
                        title: {
                            display: true,
                            text: 'PU',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.05,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(2).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes de fecha',
                            color: '#64748b',
                            font: { size: 11, weight: '600' },
                            padding: { top: 6 }
                        },
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] ? tooltip.dataPoints[0].dataIndex : null;
                            if (dataIndex === null || !periodosGrafica[dataIndex]) return;

                            const item = periodosGrafica[dataIndex];

                            tooltipEl.innerHTML = `
                                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                                    <span class="text-slate-500 font-normal">Mes de fecha:</span>
                                    <span class="text-slate-900 font-semibold text-left capitalize">${item.mes_larga}</span>
                                    <span class="text-emerald-700 font-semibold">PU (Alimento Balanceado):</span>
                                    <span class="text-slate-900 font-bold text-left font-mono text-xs">${this.formatearNumero(item.pu, 'decimal3')} S//Kg</span>
                                    <span class="text-slate-500 font-normal">Valor Alimento:</span>
                                    <span class="text-slate-800 font-semibold text-left font-mono text-[11px]">S/ ${this.formatearNumero(item.sum_valoalim, 'entero')}</span>
                                    <span class="text-slate-500 font-normal">Peso Alimento:</span>
                                    <span class="text-slate-800 font-semibold text-left font-mono text-[11px]">${this.formatearNumero(item.sum_pesoalim, 'entero')} Kg</span>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 250;
                            const tooltipHeight = tooltipEl.offsetHeight || 100;

                            let x = canvasRect.left + tooltip.caretX + 12;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 12;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }

    /**
     * 11. Renderizado de la Tabla de Insumos CP07 (Costo de Insumos Matricial por Mes)
     */
    renderizarTablaCP07(data = {}) {
        const thead = document.getElementById('thead-detalle-metricas');
        const tbody = document.getElementById('tbody-detalle-metricas');

        if (!thead || !tbody) return;

        const periodos = data.periodos || (this.datosDashboard && this.datosDashboard.periodos) || [];
        const tablaInsumos = data.tablaInsumos || (this.datosDashboard && this.datosDashboard.tablaInsumos) || [];

        if (periodos.length === 0 || tablaInsumos.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = `<tr><td colspan="24" class="text-center py-10 text-slate-400">No hay insumos para mostrar con los filtros seleccionados.</td></tr>`;
            return;
        }

        // Fila 1 de encabezado: Item (rowspan 2) + Mes de fecha (colspan)
        let theadRow1 = `
            <tr class="bg-blue-600 text-white font-bold text-xs border-b border-blue-500">
                <th rowspan="2" class="py-2.5 px-3 text-left border-r border-b border-blue-500 sticky left-0 z-30 bg-blue-600 min-w-[260px] max-w-[340px] text-white font-bold text-xs shadow-sm">
                    Item
                </th>
                <th colspan="${periodos.length}" class="py-2 px-3 text-center border-b border-blue-500 bg-blue-600 text-white font-bold text-xs">
                    Mes de fecha
                </th>
            </tr>
        `;

        // Fila 2 de encabezado: Nombres de meses completos
        let theadRow2 = `
            <tr class="bg-blue-600 text-white font-semibold text-[11px] border-b border-blue-500">
        `;

        periodos.forEach(p => {
            theadRow2 += `
                <th class="py-2 px-3 text-center whitespace-nowrap border-r border-blue-500 min-w-[110px]">
                    ${p.mes_larga || p.mes_corta || p.key}
                </th>
            `;
        });

        theadRow2 += `</tr>`;
        thead.innerHTML = theadRow1 + theadRow2;

        let tbodyHtml = '';

        tablaInsumos.forEach((item, idx) => {
            const isEven = (idx % 2 === 1);
            const rowBg = isEven ? 'bg-slate-50/60' : 'bg-white';
            const stickyBg = isEven ? 'bg-slate-50' : 'bg-white';

            tbodyHtml += `
                <tr class="${rowBg} hover:bg-blue-50/40 transition-colors border-b border-slate-200">
                    <td class="py-2 px-3 font-semibold text-slate-800 text-[11px] border-r border-slate-200 sticky left-0 z-20 ${stickyBg} shadow-xs truncate max-w-[340px]" title="${item.item_label}">
                        ${item.item_label}
                    </td>
            `;

            periodos.forEach(p => {
                const rawVal = item.valores && item.valores[p.key] !== undefined ? item.valores[p.key] : null;
                const valFormateado = rawVal !== null ? this.formatearNumero(rawVal, 'decimal3') : '';

                tbodyHtml += `
                    <td class="py-1.5 px-3 text-right font-mono text-[11px] border-r border-slate-200/70 whitespace-nowrap text-slate-700 hover:bg-blue-100/60 transition-colors"
                        data-tooltip-metrica="true"
                        data-tt-indicador="${item.item_label}"
                        data-tt-mes="${p.mes_larga || p.key}"
                        data-tt-valor="${valFormateado || 'Sin consumo'}">
                        ${valFormateado}
                    </td>
                `;
            });

            tbodyHtml += `</tr>`;
        });

        tbody.innerHTML = tbodyHtml;
    }

    /**
     * 12. Renderizado de Gráfica CP08 (Tendencia de CU de Insumos por Código - Multilínea Tableau)
     */
    renderizarGraficaCP08(data = {}) {
        const canvas = document.getElementById('chart-costo-produccion');
        if (!canvas) return;

        this.destruirGraficaActual();

        const series = data.seriesInsumos || [];
        const periodos = data.periodos || [];
        if (periodos.length === 0 || series.length === 0) return;

        // Si se seleccionan todos los items o la cantidad de items supera a los periodos/días, ocultar leyendas para optimizar espacio
        const mostrarLeyenda = series.length <= periodos.length && series.length <= 8;

        const labels = periodos.map(d => d.mes_larga || d.key);

        const paletaTableau = [
            '#4e79a7', // Azul Tableau
            '#e15759', // Rojo Tableau
            '#f28e2b', // Naranja / Ámbar
            '#76b7b2', // Verde azulado / Gris azulado
            '#59a14f', // Verde Tableau
            '#edc948', // Oro / Amarillo
            '#b07aa1', // Púrpura
            '#ff9da7', // Salmón / Rosa
            '#9c755f', // Marrón
            '#bab0ac'  // Gris
        ];

        const datasets = series.map((serie, idx) => {
            const color = paletaTableau[idx % paletaTableau.length];
            return {
                type: 'line',
                label: serie.item_label,
                data: serie.puntos,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2.2,
                tension: 0.08,
                spanGaps: false,
                pointRadius: 4.5,
                pointHoverRadius: 7,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                datalabels: {
                    display: (context) => {
                        const val = context.dataset.data[context.dataIndex];
                        return val !== null && val !== undefined;
                    },
                    anchor: 'center',
                    align: 'top',
                    offset: 6,
                    color: color,
                    font: {
                        family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                        size: 11,
                        weight: 'bold'
                    },
                    formatter: (value) => (value !== null && value !== undefined) ? this.formatearNumero(value, 'decimal3') : ''
                }
            };
        });

        const pluginsConfig = [];
        if (typeof ChartDataLabels !== 'undefined') {
            pluginsConfig.push(ChartDataLabels);
        }

        const tooltipEl = document.getElementById('tooltip-tableau-costos');

        this.chartInstance = new Chart(canvas, {
            type: 'line',
            plugins: pluginsConfig,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
                layout: {
                    padding: { top: 32, bottom: 8, left: 10, right: 10 }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onHover: (event, chartElement) => {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'PU',
                            color: '#475569',
                            font: { size: 12, weight: 'bold' },
                            padding: { bottom: 8 }
                        },
                        ticks: {
                            stepSize: 0.5,
                            color: '#64748b',
                            font: { size: 11, weight: '500' },
                            formatter: (val) => Number(val).toFixed(1).replace('.', ',')
                        },
                        grid: { color: '#f1f5f9', drawBorder: false }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes de fecha',
                            color: '#64748b',
                            font: { size: 11, weight: '600' },
                            padding: { top: 6 }
                        },
                        ticks: {
                            color: '#475569',
                            font: { size: 10.5, weight: '600' },
                            maxRotation: 45,
                            minRotation: 30,
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: mostrarLeyenda,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 14,
                            font: {
                                family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                                size: 11.5,
                                weight: 'bold'
                            },
                            color: '#475569',
                            cursor: 'pointer'
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => {
                            if (!tooltipEl) return;
                            const { chart, tooltip } = context;
                            if (!chart || !chart.canvas || !chart.canvas.isConnected) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            if (tooltip.opacity === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const dataPoints = tooltip.dataPoints || [];
                            if (dataPoints.length === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            const mesLabel = dataPoints[0].label || '';
                            const puntosValidos = dataPoints.filter(dp => dp.raw !== null && dp.raw !== undefined);
                            if (puntosValidos.length === 0) {
                                tooltipEl.classList.add('hidden');
                                return;
                            }

                            let itemsHtml = '';
                            puntosValidos.forEach(dp => {
                                const color = dp.dataset.borderColor || '#3b82f6';
                                const label = dp.dataset.label || '';
                                const val = dp.raw;
                                itemsHtml += `
                                    <div class="flex items-center justify-between gap-3 text-[11px] font-sans py-0.5 border-b border-slate-100 last:border-0">
                                        <div class="flex items-center gap-1.5 min-w-0 max-w-[220px]">
                                            <span class="inline-block w-2.5 h-2.5 rounded-xs flex-shrink-0" style="background-color: ${color};"></span>
                                            <span class="text-slate-700 font-medium truncate" title="${label}">${label}</span>
                                        </div>
                                        <span class="text-slate-900 font-bold font-mono text-[11px] whitespace-nowrap">${this.formatearNumero(val, 'decimal3')} S//Kg</span>
                                    </div>
                                `;
                            });

                            tooltipEl.innerHTML = `
                                <div class="space-y-1.5 font-sans">
                                    <div class="flex items-center justify-between gap-2 border-b border-slate-200 pb-1 text-[11px]">
                                        <span class="text-slate-500 font-medium">Mes de fecha:</span>
                                        <span class="text-slate-900 font-bold capitalize">${mesLabel}</span>
                                    </div>
                                    <div class="space-y-0.5 max-h-[260px] overflow-y-auto pr-1">
                                        ${itemsHtml}
                                    </div>
                                </div>
                            `;

                            tooltipEl.classList.remove('hidden');

                            const canvasRect = chart.canvas.getBoundingClientRect();
                            const tooltipWidth = tooltipEl.offsetWidth || 260;
                            const tooltipHeight = tooltipEl.offsetHeight || 120;

                            let x = canvasRect.left + tooltip.caretX + 14;
                            let y = canvasRect.top + tooltip.caretY - 20;

                            if (x + tooltipWidth > window.innerWidth - 12) {
                                x = canvasRect.left + tooltip.caretX - tooltipWidth - 14;
                            }
                            if (y + tooltipHeight > window.innerHeight - 12) {
                                y = window.innerHeight - tooltipHeight - 12;
                            }

                            tooltipEl.style.left = `${Math.max(10, x)}px`;
                            tooltipEl.style.top = `${Math.max(10, y)}px`;
                        }
                    }
                }
            }
        });
    }
}

// Inicialización global cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.costosTradicionalesController = new CostosTradicionalesController();
});


