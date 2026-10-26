/**
 * Controlador para la vista Costos Tradicional Día 2 (Galpones Horizontal)
 * Administra filtros dinámicos (Período, Fecha Liquidación, Granjas, Campañas, Galpones),
 * estado de carga, cálculo y renderizado de la matriz de galpones estilo Tableau
 */
class CostosDias2Controller {
    constructor() {
        this.service = new CostosDias2Service();
        this.datosDashboard = null;
        this.catalogosFiltros = null;

        this.init();
    }

    async init() {
        this.setupPeriodo();
        this.setupListeners();
        this.setupTooltips();
        await this.cargarFiltros();
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

        document.getElementById('btn-export-excel-costos2')?.addEventListener('click', () => {
            this.exportarExcel();
        });

        document.getElementById('btn-export-pdf-costos2')?.addEventListener('click', () => {
            this.exportarPdf();
        });

        this.setExportButtonsEnabled(false);
    }

    setExportButtonsEnabled(enabled) {
        ['btn-export-excel-costos2', 'btn-export-pdf-costos2'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = !enabled;
            btn.classList.toggle('opacity-50', !enabled);
            btn.classList.toggle('cursor-not-allowed', !enabled);
        });
    }

    setupTooltips() {
        const tooltip = document.getElementById('tooltip-tableau-costos2');
        if (!tooltip) return;

        document.addEventListener('mousemove', (e) => {
            const target = e.target.closest('[data-tooltip-costos2]');
            if (target) {
                const granja = target.getAttribute('data-tt-granja') || '';
                const mes = target.getAttribute('data-tt-mes') || '';
                const galpon = target.getAttribute('data-tt-galpon') || '';
                const valor = target.getAttribute('data-tt-valor') || '';
                const peso = target.getAttribute('data-tt-peso') || '';
                const cu = target.getAttribute('data-tt-cu') || '';

                tooltip.innerHTML = `
                    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                        <span class="text-slate-500 font-normal">Granja:</span>
                        <span class="text-slate-900 font-semibold text-left uppercase">${granja}</span>
                        <span class="text-slate-500 font-normal">Mes / Año:</span>
                        <span class="text-slate-900 font-semibold text-left">${mes}</span>
                        <span class="text-slate-500 font-normal">Galpón:</span>
                        <span class="text-slate-900 font-semibold text-left">Galpón ${galpon}</span>
                        <span class="text-slate-500 font-normal">Valor:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${valor}</span>
                        <span class="text-slate-500 font-normal">Peso GLP:</span>
                        <span class="text-slate-900 font-semibold text-left font-mono">${peso}</span>
                        <span class="text-slate-500 font-normal">CU GLP:</span>
                        <span class="text-blue-700 font-bold text-left font-mono">${cu}</span>
                    </div>
                `;

                tooltip.classList.remove('hidden');
                const tooltipWidth = tooltip.offsetWidth || 260;
                const tooltipHeight = tooltip.offsetHeight || 130;
                let x = e.clientX + 14;
                let y = e.clientY + 14;

                if (x + tooltipWidth > window.innerWidth - 12) {
                    x = e.clientX - tooltipWidth - 14;
                }
                if (y + tooltipHeight > window.innerHeight - 12) {
                    y = e.clientY - tooltipHeight - 12;
                }

                tooltip.style.left = `${Math.max(10, x)}px`;
                tooltip.style.top = `${Math.max(10, y)}px`;
            } else {
                tooltip.classList.add('hidden');
            }
        });
    }

    /**
     * Carga los catálogos de filtros desde el Backend y puebla los selectores
     */
    async cargarFiltros() {
        try {
            const res = await this.service.obtenerFiltros();
            if (res && res.success && res.payload) {
                this.catalogosFiltros = res.payload;

                // 1. Poblar Granjas únicas
                const selGranja = document.getElementById('select-granja');
                if (selGranja && this.catalogosFiltros.granjas) {
                    const granjasUnicasMap = {};
                    this.catalogosFiltros.granjas.forEach(g => {
                        if (!granjasUnicasMap[g.tnomcen]) {
                            granjasUnicasMap[g.tnomcen] = g.tcencos;
                        }
                    });

                    let optionsHtml = '<option value="">(Todas las granjas)</option>';
                    Object.keys(granjasUnicasMap).sort().forEach(nomcen => {
                        optionsHtml += `<option value="${nomcen}">${nomcen}</option>`;
                    });
                    selGranja.innerHTML = optionsHtml;
                }

                // 2. Poblar Campañas
                const selCampana = document.getElementById('select-campana');
                if (selCampana && this.catalogosFiltros.campanas) {
                    let cmpHtml = '<option value="">(Todas las campañas)</option>';
                    this.catalogosFiltros.campanas.forEach(c => {
                        cmpHtml += `<option value="${c.tcampana}">${c.granja_campana || `Campaña ${c.tcampana}`}</option>`;
                    });
                    selCampana.innerHTML = cmpHtml;
                }

                // 3. Poblar Galpones
                const selGalpon = document.getElementById('select-galpon');
                if (selGalpon && this.catalogosFiltros.galpones) {
                    let glpHtml = '<option value="">(Todos los galpones)</option>';
                    this.catalogosFiltros.galpones.forEach(gp => {
                        glpHtml += `<option value="${gp}">Galpón ${gp}</option>`;
                    });
                    selGalpon.innerHTML = glpHtml;
                }
            }
        } catch (error) {
            console.error('Error al cargar catálogos de filtros:', error);
        }
    }

    /**
     * Construye el payload de filtros recopilando todos los controles
     */
    obtenerPayloadFiltros() {
        let rangoPeriodo = {};
        if (typeof PeriodoHelper !== 'undefined' && PeriodoHelper.obtenerRangoFechas) {
            rangoPeriodo = PeriodoHelper.obtenerRangoFechas();
        }

        const fechaLiqIni = document.getElementById('input-fecha-liq-ini')?.value || '';
        const fechaLiqFin = document.getElementById('input-fecha-liq-fin')?.value || '';
        const granja = document.getElementById('select-granja')?.value || '';
        const campana = document.getElementById('select-campana')?.value || '';
        const galpon = document.getElementById('select-galpon')?.value || '';

        return {
            fecha_inicio: rangoPeriodo.fechaInicio || rangoPeriodo.inicio || '2025-01-01',
            fecha_fin: rangoPeriodo.fechaFin || rangoPeriodo.fin || '2025-12-31',
            fecha_liq_inicio: fechaLiqIni,
            fecha_liq_fin: fechaLiqFin,
            granjas: granja ? [granja] : [],
            campanas: campana ? [campana] : [],
            galpones: galpon ? [galpon] : []
        };
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
            const payload = this.obtenerPayloadFiltros();
            const res = await this.service.obtenerDashboard(payload);

            if (res && (res.success || res.status === 'success')) {
                const data = res.payload || res.data || res;
                this.datosDashboard = data;
                this.renderizarMatrizHorizontal(data);
                this.setExportButtonsEnabled(Array.isArray(data.granjas) && data.granjas.length > 0);
            } else {
                console.error('Error en respuesta de dashboard:', res);
                this.datosDashboard = null;
                this.renderizarVacio('Ocurrió un problema al obtener los datos.');
                this.setExportButtonsEnabled(false);
            }
        } catch (err) {
            console.error('Excepción al cargar dashboard CostosTradicionalDia2:', err);
            this.datosDashboard = null;
            this.renderizarVacio('Error de comunicación con el servidor.');
            this.setExportButtonsEnabled(false);
        } finally {
            if (btnCargar) {
                btnCargar.disabled = false;
                btnCargar.classList.remove('opacity-75', 'cursor-not-allowed');
                btnCargar.innerHTML = originalBtnHtml;
            }
        }
    }

    formatMoneda(val) {
        if (val === null || val === undefined || isNaN(val) || Number(val) === 0) return '-';
        return 'S/ ' + Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatPeso(val) {
        if (val === null || val === undefined || isNaN(val) || Number(val) === 0) return '-';
        return Number(val).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'Kg';
    }

    formatCU(val) {
        if (val === null || val === undefined || isNaN(val) || Number(val) === 0) return '-';
        return Number(val).toFixed(3).replace('.', ',');
    }

    renderizarVacio(mensaje = 'No hay datos para los filtros seleccionados.') {
        const thead = document.getElementById('thead-detalle-costos2');
        const tbody = document.getElementById('tbody-detalle-costos2');
        const tfoot = document.getElementById('tfoot-detalle-costos2');

        if (thead) thead.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="20" class="text-center py-16 text-slate-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i class="fa-regular fa-folder-open text-3xl text-slate-300"></i>
                            <span class="text-sm font-medium">${mensaje}</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Renderiza la matriz horizontal cruzada por Galpones al estilo Tableau
     */
    renderizarMatrizHorizontal(data = {}) {
        const thead = document.getElementById('thead-detalle-costos2');
        const tbody = document.getElementById('tbody-detalle-costos2');
        const tfoot = document.getElementById('tfoot-detalle-costos2');

        if (!thead || !tbody) return;

        const galpones = data.galpones || [];
        const granjas = data.granjas || [];
        const totalGeneral = data.totalGeneral || {};
        const granTotal = data.granTotal || {};

        if (granjas.length === 0 || galpones.length === 0) {
            this.renderizarVacio();
            return;
        }

        // ==========================================
        // 1. CONSTRUIR ENCABEZADOS MULTINIVEL (THEAD)
        // ==========================================
        let theadFila1Galpones = '';
        let theadFila2Subcolumnas = '';

        galpones.forEach(gp => {
            theadFila1Galpones += `
                <th colspan="3" class="py-2 px-2 text-center font-bold text-white bg-blue-700 border-r border-blue-900 border-b border-blue-800 text-[11px] tracking-wide">
                    ${gp}
                </th>
            `;

            theadFila2Subcolumnas += `
                <th class="py-1.5 px-2 text-center text-slate-600 bg-slate-100 border-r border-slate-200 font-semibold text-[10px] min-w-[100px]">Valor</th>
                <th class="py-1.5 px-2 text-center text-slate-600 bg-slate-100 border-r border-slate-200 font-semibold text-[10px] min-w-[100px]">Peso Glp</th>
                <th class="py-1.5 px-2 text-center text-slate-700 bg-slate-100 border-r-2 border-slate-300 font-bold text-[10px] min-w-[70px]">CU GLP</th>
            `;
        });

        const theadHtml = `
            <!-- Fila 1: Dimensiones y Agrupadores de Galpones -->
            <tr class="text-[11px] border-b border-blue-800">
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-800 sticky left-0 z-30 border-r border-b border-blue-900 min-w-[160px]">
                    tnomcen
                </th>
                <th rowspan="2" class="px-2 py-2 text-center font-bold text-white bg-blue-800 sticky left-[160px] z-30 border-r border-b border-blue-900 min-w-[80px]">
                    tcencos
                </th>
                <th rowspan="2" class="px-2 py-2 text-center font-bold text-white bg-blue-800 border-r border-b border-blue-900 min-w-[60px]">
                    tanio
                </th>
                <th rowspan="2" class="px-2 py-2 text-center font-bold text-white bg-blue-800 border-r border-b border-blue-900 min-w-[50px]">
                    t.
                </th>
                <th rowspan="2" class="px-3 py-2 text-left font-bold text-white bg-blue-800 border-r-2 border-blue-950 border-b border-blue-900 min-w-[80px]">
                    tnomMes
                </th>
                ${theadFila1Galpones}
            </tr>

            <!-- Fila 2: Subcolumnas de Métricas (Valor, Peso Glp, CU GLP) -->
            <tr class="text-[10px] border-b border-slate-200 uppercase tracking-wider">
                ${theadFila2Subcolumnas}
            </tr>
        `;

        thead.innerHTML = theadHtml;

        // ==========================================
        // 2. CONSTRUIR FILAS DE DATOS (TBODY)
        // ==========================================
        let tbodyHtml = '';

        granjas.forEach(g => {
            const cantMeses = (g.meses || []).length;
            const totalFilasGranja = cantMeses + 1; // Meses + Fila Total

            // Filas de cada mes
            g.meses.forEach((m, mIdx) => {
                let celdaNombre = '';
                let celdaCencos = '';
                let celdaAnio = '';
                let celdaTipo = '';

                // Celdas agrupadoras con rowspan en la primera fila de la granja
                if (mIdx === 0) {
                    celdaNombre = `
                        <td rowspan="${totalFilasGranja}" class="px-3 py-2 font-bold text-slate-900 bg-white border-r border-b border-slate-200 align-top text-[11px] sticky left-0 z-20 uppercase shadow-xs">
                            ${g.tnomcen}
                        </td>
                    `;
                    celdaCencos = `
                        <td rowspan="${totalFilasGranja}" class="px-2 py-2 font-mono text-slate-600 bg-white border-r border-b border-slate-200 align-top text-center text-[10.5px] sticky left-[160px] z-20 shadow-xs">
                            ${g.tcencos}
                        </td>
                    `;
                    celdaAnio = `
                        <td rowspan="${cantMeses}" class="px-2 py-2 text-slate-600 bg-white border-r border-b border-slate-200 align-top text-center text-[10.5px]">
                            ${g.tanio}
                        </td>
                    `;
                    celdaTipo = `
                        <td rowspan="${cantMeses}" class="px-2 py-2 font-semibold text-slate-500 bg-white border-r border-b border-slate-200 align-top text-center text-[10px]">
                            ${g.tuser}
                        </td>
                    `;
                }

                // Generar celdas de galpones para este mes
                let celdasGalpones = '';
                galpones.forEach(gp => {
                    const dataGp = m.galpones[gp] || { valor: 0, peso_glp: 0, cu_glp: null };
                    const valFmt = this.formatMoneda(dataGp.valor);
                    const pesFmt = this.formatPeso(dataGp.peso_glp);
                    const cuFmt = this.formatCU(dataGp.cu_glp);

                    celdasGalpones += `
                        <td class="px-2 py-1.5 text-right font-mono text-[10.5px] text-slate-700 border-r border-slate-100 border-b whitespace-nowrap hover:bg-blue-50/40 transition-colors"
                            data-tooltip-costos2="true"
                            data-tt-granja="${g.tnomcen}"
                            data-tt-mes="${m.tnomMes} ${g.tanio}"
                            data-tt-galpon="${gp}"
                            data-tt-valor="${valFmt}"
                            data-tt-peso="${pesFmt}"
                            data-tt-cu="${cuFmt}">
                            ${valFmt}
                        </td>
                        <td class="px-2 py-1.5 text-right font-mono text-[10.5px] text-slate-700 border-r border-slate-100 border-b whitespace-nowrap hover:bg-blue-50/40 transition-colors"
                            data-tooltip-costos2="true"
                            data-tt-granja="${g.tnomcen}"
                            data-tt-mes="${m.tnomMes} ${g.tanio}"
                            data-tt-galpon="${gp}"
                            data-tt-valor="${valFmt}"
                            data-tt-peso="${pesFmt}"
                            data-tt-cu="${cuFmt}">
                            ${pesFmt}
                        </td>
                        <td class="px-2 py-1.5 text-right font-mono text-[10.5px] font-semibold text-blue-900 border-r-2 border-slate-300 border-b whitespace-nowrap bg-slate-50/30 hover:bg-blue-50/60 transition-colors"
                            data-tooltip-costos2="true"
                            data-tt-granja="${g.tnomcen}"
                            data-tt-mes="${m.tnomMes} ${g.tanio}"
                            data-tt-galpon="${gp}"
                            data-tt-valor="${valFmt}"
                            data-tt-peso="${pesFmt}"
                            data-tt-cu="${cuFmt}">
                            ${cuFmt}
                        </td>
                    `;
                });

                tbodyHtml += `
                    <tr class="hover:bg-slate-50/70 transition-colors border-b border-slate-100">
                        ${celdaNombre}
                        ${celdaCencos}
                        ${celdaAnio}
                        ${celdaTipo}
                        <td class="px-3 py-1.5 text-slate-700 bg-white border-r-2 border-blue-900/30 border-b align-middle text-[11px] font-medium">
                            ${m.tnomMes}
                        </td>
                        ${celdasGalpones}
                    </tr>
                `;
            });

            // ==========================================
            // Fila de TOTAL por Granja
            // ==========================================
            let celdasTotalGranja = '';
            galpones.forEach(gp => {
                const totalGp = g.total.galpones[gp] || { valor: 0, peso_glp: 0, cu_glp: null };
                const valFmt = this.formatMoneda(totalGp.valor);
                const pesFmt = this.formatPeso(totalGp.peso_glp);
                const cuFmt = this.formatCU(totalGp.cu_glp);

                celdasTotalGranja += `
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-[10.5px] text-slate-900 border-r border-slate-200 border-b whitespace-nowrap bg-slate-100/60"
                        data-tooltip-costos2="true"
                        data-tt-granja="${g.tnomcen}"
                        data-tt-mes="TOTAL ${g.tanio}"
                        data-tt-galpon="${gp}"
                        data-tt-valor="${valFmt}"
                        data-tt-peso="${pesFmt}"
                        data-tt-cu="${cuFmt}">
                        ${valFmt}
                    </td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-[10.5px] text-slate-900 border-r border-slate-200 border-b whitespace-nowrap bg-slate-100/60"
                        data-tooltip-costos2="true"
                        data-tt-granja="${g.tnomcen}"
                        data-tt-mes="TOTAL ${g.tanio}"
                        data-tt-galpon="${gp}"
                        data-tt-valor="${valFmt}"
                        data-tt-peso="${pesFmt}"
                        data-tt-cu="${cuFmt}">
                        ${pesFmt}
                    </td>
                    <td class="px-2 py-1.5 text-right font-mono font-bold text-[10.5px] text-blue-900 border-r-2 border-slate-300 border-b whitespace-nowrap bg-blue-100/40"
                        data-tooltip-costos2="true"
                        data-tt-granja="${g.tnomcen}"
                        data-tt-mes="TOTAL ${g.tanio}"
                        data-tt-galpon="${gp}"
                        data-tt-valor="${valFmt}"
                        data-tt-peso="${pesFmt}"
                        data-tt-cu="${cuFmt}">
                        ${cuFmt}
                    </td>
                `;
            });

            tbodyHtml += `
                <tr class="bg-slate-50/80 border-b-2 border-slate-300 font-semibold">
                    <td colspan="3" class="px-3 py-1.5 text-slate-800 bg-slate-100 border-r-2 border-blue-900/30 border-b align-middle text-[11px] font-bold text-center">
                        Total
                    </td>
                    ${celdasTotalGranja}
                </tr>
            `;
        });

        tbody.innerHTML = tbodyHtml;

        // ==========================================
        // 3. CONSTRUIR FILA TOTAL GENERAL (TFOOT)
        // ==========================================
        if (tfoot) {
            let celdasFootGalpones = '';
            galpones.forEach(gp => {
                const tgGp = totalGeneral[gp] || { valor: 0, peso_glp: 0, cu_glp: null };
                const valFmt = this.formatMoneda(tgGp.valor);
                const pesFmt = this.formatPeso(tgGp.peso_glp);
                const cuFmt = this.formatCU(tgGp.cu_glp);

                celdasFootGalpones += `
                    <td class="px-2 py-2 text-right font-mono font-bold text-[11px] text-slate-900 border-r border-blue-200 whitespace-nowrap bg-blue-50">
                        ${valFmt}
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-bold text-[11px] text-slate-900 border-r border-blue-200 whitespace-nowrap bg-blue-50">
                        ${pesFmt}
                    </td>
                    <td class="px-2 py-2 text-right font-mono font-bold text-[11px] text-blue-900 border-r-2 border-blue-300 whitespace-nowrap bg-blue-100/70">
                        ${cuFmt}
                    </td>
                `;
            });

            tfoot.innerHTML = `
                <tr class="bg-blue-100/90 border-t-2 border-blue-400 font-bold text-[11px]">
                    <td class="px-3 py-2 text-slate-900 bg-blue-100 sticky left-0 z-30 border-r border-blue-200" colspan="2">
                        TOTAL GENERAL
                    </td>
                    <td colspan="3" class="px-2 py-2 text-center text-slate-700 bg-blue-50 border-r-2 border-blue-900/40"></td>
                    ${celdasFootGalpones}
                </tr>
            `;
        }
    }

    exportarExcel() {
        if (!this.datosDashboard) {
            alert('Primero debe cargar los datos.');
            return;
        }

        const table = document.getElementById('tabla-detalle-costos2');
        if (!table || !table.querySelector('tbody tr')) {
            alert('No hay datos para exportar.');
            return;
        }

        if (typeof ExcelExportHelper === 'undefined') {
            alert('No se encontró el componente de exportación a Excel.');
            return;
        }

        const filtros = this.obtenerPayloadFiltros();
        const nombre = `Costos_Tradicional_Dia2_${filtros.fecha_inicio}_${filtros.fecha_fin}`;
        ExcelExportHelper.exportarTabla('tabla-detalle-costos2', nombre, {
            nombreHoja: 'Costos Dia 2',
            incluirFecha: false
        });
    }

    async exportarPdf() {
        if (!this.datosDashboard) {
            alert('Primero debe cargar los datos.');
            return;
        }

        const ventanaPdf = window.open('', '_blank');
        if (!ventanaPdf) {
            alert('El navegador bloqueó la nueva pestaña. Habilita las ventanas emergentes para este sitio.');
            return;
        }

        ventanaPdf.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head><meta charset="UTF-8"><title>Generando PDF...</title></head>
            <body style="font-family:Segoe UI,sans-serif;background:#f8fafc;color:#334155;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                <div style="text-align:center;">
                    <div style="width:34px;height:34px;border:4px solid #dbeafe;border-top-color:#2563eb;border-radius:50%;margin:0 auto 14px;animation:spin 0.8s linear infinite;"></div>
                    <p style="font-size:14px;font-weight:600;">Generando PDF...</p>
                </div>
                <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
            </body>
            </html>
        `);

        const btn = document.getElementById('btn-export-pdf-costos2');
        const htmlOriginal = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Generando...</span>';
        }

        try {
            const filtros = this.obtenerPayloadFiltros();
            const blob = await this.service.exportarPdf(filtros);
            const url = window.URL.createObjectURL(blob);
            ventanaPdf.location.href = url;
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (error) {
            try { ventanaPdf.close(); } catch (e) { /* Ignorar */ }
            console.error('Error al exportar PDF:', error);
            alert(error.message || 'No se pudo generar el PDF.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
                btn.innerHTML = htmlOriginal;
            }
        }
    }

    async limpiarFiltros() {
        const selPeriodo = document.getElementById('select-tipo-periodo');
        if (selPeriodo) selPeriodo.value = 'entre_meses';
        this.setupPeriodo();

        const inputLiqIni = document.getElementById('input-fecha-liq-ini');
        if (inputLiqIni) inputLiqIni.value = '';

        const inputLiqFin = document.getElementById('input-fecha-liq-fin');
        if (inputLiqFin) inputLiqFin.value = '';

        const selGranja = document.getElementById('select-granja');
        if (selGranja) selGranja.value = '';

        const selCampana = document.getElementById('select-campana');
        if (selCampana) selCampana.value = '';

        const selGalpon = document.getElementById('select-galpon');
        if (selGalpon) selGalpon.value = '';

        await this.onCargarClick();
    }
}

// Inicialización automática al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.costosDias2Controller = new CostosDias2Controller();
});
