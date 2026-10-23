/**
 * Componente de pasteles - Tiendas y Mercados
 * DashPastel y hojas individuales de participación/distribución.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartTiendasMercadosPasteles = {
    charts: [],
    paletaProvincias: [
        '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#F1CE63',
        '#76B7B2', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ],
    coloresTamanioPie: {
        'Chico': '#4E79A7',
        'Grande': '#F28E2B',
        'Mediano': '#E15759'
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const helper = window.TiendasMercadosHelper;
        if (!helper) {
            contenedor.innerHTML = '<div class="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl">No se encontró el helper de Tiendas y Mercados.</div>';
            return;
        }

        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const tipoGrafico = (data && data.tipo_grafico) || '';
        const titulo = (data && data.titulo) || 'Tiendas y Mercados';
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';

        if (filas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800">${helper.escapeHtml(titulo)}</h2>
                        <p class="text-[11px] text-slate-400 mt-0.5">${helper.escapeHtml(helper.formatearPeriodo(fechaInicio, fechaFin))}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const resumen = helper.construirResumen(data);

        if (tipoGrafico === 'DashPastel') {
            this.renderDashPastel(contenedor, resumen, data, helper);
            return;
        }

        if (tipoGrafico === 'PastelPorcGeneraltam') {
            this.renderIndividualTamanio(contenedor, resumen, data, helper);
            return;
        }

        this.renderIndividualGeneral(contenedor, resumen, data, helper);
    },

    renderDashPastel(contenedor, resumen, data, helper) {
        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-5">
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
                    <div class="xl:col-span-5">
                        ${this.cardPieGeneralHtml('tiendas-canvas-pastel-general-dash', 'Participación general por provincia', 520)}
                    </div>
                    <div class="xl:col-span-7">
                        ${this.cardPiesTamanioHtml('tiendas-pasteles-tamanio-dash', resumen, true, helper)}
                    </div>
                </div>
                <div id="tiendas-dash-barra-generaltam"></div>
            </div>
        `;

        this.crearPieGeneral('tiendas-canvas-pastel-general-dash', resumen, helper);
        this.crearPiesTamanio('tiendas-pasteles-tamanio-dash', resumen, helper);
        const barras = helper.renderBarraGeneraltam(
            document.getElementById('tiendas-dash-barra-generaltam'),
            resumen,
            620
        );
        this.charts.push(...barras);
    },

    renderIndividualGeneral(contenedor, resumen, data, helper) {
        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-5">
                ${this.cardPieGeneralHtml('tiendas-canvas-pastel-general', 'Participación por provincia', 620)}
            </div>
        `;

        this.crearPieGeneral('tiendas-canvas-pastel-general', resumen, helper);
    },

    renderIndividualTamanio(contenedor, resumen, data, helper) {
        contenedor.innerHTML = `
            <div class="w-full flex flex-col gap-5">
                ${this.cardPiesTamanioHtml('tiendas-pasteles-tamanio', resumen, false, helper)}
            </div>
        `;

        this.crearPiesTamanio('tiendas-pasteles-tamanio', resumen, helper);
    },

    cardPieGeneralHtml(canvasId, titulo, height) {
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-200">
                    <h3 class="text-sm font-bold text-slate-800">${titulo}</h3>
                    <p class="text-[11px] text-slate-400 mt-0.5">Porcentaje sobre el total seleccionado</p>
                </div>
                <div class="p-3 sm:p-4">
                    <div class="relative" style="height:${height}px">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        `;
    },

    cardPiesTamanioHtml(containerId, resumen, scrollable, helper) {
        const ordenTamanios = ['Chico', 'Grande', 'Mediano'];
        const tamanios = ordenTamanios
            .filter(tamanio => resumen.tamanios.includes(tamanio))
            .concat(resumen.tamanios.filter(tamanio => !ordenTamanios.includes(tamanio)));

        const leyenda = tamanios.map(tamanio => `
            <span class="inline-flex items-center gap-1">
                <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:${this.coloresTamanioPie[tamanio] || '#94a3b8'}"></span>
                ${helper.escapeHtml(tamanio)}
            </span>
        `).join('');

        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden h-full">
                <div class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">Distribución por tamaño</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Un pastel por provincia y tipo de establecimiento · tamaño según cantidad</p>
                    </div>
                    <div class="flex items-center gap-3 text-[10px] font-semibold text-slate-500">${leyenda}</div>
                </div>
                <div class="p-3 sm:p-4">
                    <div id="${containerId}" class="${scrollable ? 'max-h-[520px]' : ''} overflow-auto custom-scrollbar pr-1"></div>
                </div>
            </div>
        `;
    },

    crearPieGeneral(canvasId, resumen, helper) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return;

        this.registrarDatalabels();

        const provincias = resumen.provincias.filter(provincia => Number(resumen.totalProvincia[provincia] || 0) > 0);
        const valores = provincias.map(provincia => Number(resumen.totalProvincia[provincia] || 0));
        const total = valores.reduce((a, b) => a + b, 0);
        const colores = provincias.map((_, index) => this.paletaProvincias[index % this.paletaProvincias.length]);
        const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
        const nfPct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: provincias,
                datasets: [{
                    data: valores,
                    backgroundColor: colores,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                animation: { duration: 250 },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 9,
                            font: { size: 10 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#334155',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: (context) => {
                                const valor = Number(context.parsed) || 0;
                                const pct = total > 0 ? (valor / total) * 100 : 0;
                                return `${context.label}: ${nf.format(valor)} (${nfPct.format(pct)}%)`;
                            }
                        }
                    },
                    datalabels: {
                        color: '#ffffff',
                        font: { size: 12, weight: '700' },
                        formatter: (value) => {
                            const numero = Number(value) || 0;
                            if (!numero || total <= 0) return '';
                            return `${nfPct.format((numero / total) * 100)}%`;
                        }
                    }
                }
            }
        });

        this.charts.push(chart);
    },

    crearPiesTamanio(containerId, resumen, helper) {
        const contenedor = document.getElementById(containerId);
        if (!contenedor || typeof Chart === 'undefined') return;

        this.registrarDatalabels();

        const ordenTamanios = ['Chico', 'Grande', 'Mediano'];
        const tamaniosPie = ordenTamanios
            .filter(tamanio => resumen.tamanios.includes(tamanio))
            .concat(resumen.tamanios.filter(tamanio => !ordenTamanios.includes(tamanio)));

        const ordenTipos = ['Puesto de mercado', 'Tienda y puesto aledaño'];
        const tipos = ordenTipos
            .filter(tipo => resumen.tipos.includes(tipo))
            .concat(resumen.tipos.filter(tipo => !ordenTipos.includes(tipo)));
        const provincias = resumen.provincias.filter(provincia => Number(resumen.totalProvincia[provincia] || 0) > 0);

        if (provincias.length === 0 || tipos.length === 0 || tamaniosPie.length === 0) {
            contenedor.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">No hay distribución por tamaño.</p>';
            return;
        }

        const filas = provincias.map(provincia => ({
            provincia,
            celdas: tipos.map(tipo => {
                const valores = tamaniosPie.map(tamanio => {
                    const dato = resumen.datos[provincia] && resumen.datos[provincia][tipo]
                        ? resumen.datos[provincia][tipo][tamanio]
                        : 0;
                    return Number(dato || 0);
                });

                return {
                    provincia,
                    tipo,
                    valores,
                    total: valores.reduce((a, b) => a + b, 0),
                    totalProvincia: Number(resumen.totalProvincia[provincia] || 0)
                };
            })
        }));

        const cabeceras = tipos.map(tipo => `
            <th class="sticky top-0 z-10 bg-slate-50/95 text-center text-[10.5px] font-bold text-slate-600 px-3 py-2 border-b border-slate-200 min-w-[170px]">
                ${helper.escapeHtml(tipo)}
            </th>
        `).join('');

        const cuerpo = filas.map((fila, filaIndex) => `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                <th class="sticky left-0 z-10 bg-white text-left text-[11px] font-bold text-slate-700 px-3 py-2 whitespace-nowrap">
                    ${helper.escapeHtml(fila.provincia)}
                </th>
                ${fila.celdas.map((celda, celdaIndex) => `
                    <td class="px-2 py-1.5 align-middle text-center">
                        ${celda.total > 0
                            ? `<div class="relative w-full" style="height:150px">
                                   <canvas id="tiendas-pastel-tamanio-canvas-${filaIndex}-${celdaIndex}"></canvas>
                               </div>`
                            : '<span class="text-[10px] font-medium text-slate-300">Sin datos</span>'}
                    </td>
                `).join('')}
            </tr>
        `).join('');

        contenedor.innerHTML = `
            <table class="w-full min-w-[520px] border-collapse text-xs">
                <thead>
                    <tr class="bg-slate-50/80">
                        <th class="sticky top-0 left-0 z-20 bg-slate-50/95 text-left text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 py-2 border-b border-slate-200 min-w-[130px]">
                            Provincia
                        </th>
                        ${cabeceras}
                    </tr>
                </thead>
                <tbody>${cuerpo}</tbody>
            </table>
        `;

        const nfPct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        filas.forEach((fila, filaIndex) => {
            fila.celdas.forEach((celda, celdaIndex) => {
                if (celda.total <= 0) return;

                const canvas = document.getElementById(`tiendas-pastel-tamanio-canvas-${filaIndex}-${celdaIndex}`);
                if (!canvas) return;

                const colores = tamaniosPie.map(tamanio => this.coloresTamanioPie[tamanio] || '#94a3b8');

                const chart = new Chart(canvas.getContext('2d'), {
                    type: 'pie',
                    data: {
                        labels: tamaniosPie,
                        datasets: [{
                            data: celda.valores,
                            backgroundColor: colores,
                            borderColor: '#ffffff',
                            borderWidth: 1.5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                        animation: { duration: 200 },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: false,
                                external: (context) => this.mostrarTooltipPastel(context, helper, {
                                    provincia: celda.provincia,
                                    tipo: celda.tipo,
                                    totalProvincia: celda.totalProvincia
                                })
                            },
                            datalabels: {
                                color: '#ffffff',
                                font: { size: 11, weight: '700' },
                                formatter: (value) => {
                                    const numero = Number(value) || 0;
                                    if (!numero || celda.totalProvincia <= 0) return '';
                                    return `${nfPct.format((numero / celda.totalProvincia) * 100)}%`;
                                }
                            }
                        }
                    }
                });

                this.charts.push(chart);
            });
        });
    },

    mostrarTooltipPastel(context, helper, opciones) {
        const tooltipEl = helper.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            helper.ocultarTooltip();
            return;
        }

        const numero = Number(punto.parsed) || 0;
        const total = Number(opciones.totalProvincia) || 0;
        const pct = total > 0 ? (numero / total) * 100 : 0;
        const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
        const nfPct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const filas = [
            ['nombre (com_provincia):', opciones.provincia],
            ['tamanio:', String(punto.label || '')],
            ['tipoEstablecimiento:', opciones.tipo],
            ['% de total cantidad junto con Tabla (a lo largo):', `${nfPct.format(pct)}%`],
            ['cantidad:', nf.format(numero)]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 20px; align-items:start;">
                ${filas.map(([etiqueta, valor]) => `
                    <span style="color:#64748b;">${helper.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${helper.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';
        helper.posicionarTooltipGrafico(context.chart, tooltip, tooltipEl);
    },

    registrarDatalabels() {
        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }
    },

    destroy() {
        if (window.TiendasMercadosHelper) {
            window.TiendasMercadosHelper.ocultarTooltip();
        }

        this.charts.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = [];
    }
};

window.ChartRegistry['TiendasMercadosPasteles'] = window.ChartTiendasMercadosPasteles;
window.ChartRegistry['TiendasMercadosDashPastel'] = window.ChartTiendasMercadosPasteles;
