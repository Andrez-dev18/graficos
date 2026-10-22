/**
 * Componente PreciosGrafico - CriadorEmpre
 * Precio promedio semanal por proveedor corregido.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartCriadorEmprePreciosGrafico = {
    chart: null,
    tooltipId: 'criadorempre-precios-grafico-tooltip',
    paleta: [
        '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#F1CE63', '#76B7B2',
        '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC', '#86BCB6', '#D37295',
        '#A0CBE8', '#FFBE7D', '#8CD17D', '#B6992D', '#499894', '#D4A6C8',
        '#FABFD2', '#79706E'
    ],
    coloresProveedor: {
        'AVICRUZ': '#4D4D4D',
        'CHACRA CERRO (AQP)': '#222222',
        'CHIKEN BABY (LIMA)': '#E1812C',
        'INTEGRACION LUZ (SANTA ANGELA)': '#59A14F',
        'LA GENETICA (LIMA)': '#8CD17D',
        'MELCHORITA': '#B6992D',
        'PRODUSS': '#F1CE63',
        'ROSARIO': '#499894',
        'San Fernando': '#4E79A7',
        'SRA. LUISA (LIMA)': '#E15759',
        'TOMASINO (LIMA)': '#FF9DA7',
        'TRUJILLANA TEKNO AGRO': '#79706E'
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        this.destroy();

        const columnas = Array.isArray(data && data.columnas) ? data.columnas : [];
        const seriesRaw = Array.isArray(data && data.series) ? data.series : [];
        const titulo = (data && data.titulo) || 'Precio de Proveedores de Pollo BB';
        const tipo = (data && data.tipo) || 'Pollo bebe';
        const fechaInicio = (data && data.fecha_inicio) || '';
        const fechaFin = (data && data.fecha_fin) || '';

        const series = seriesRaw
            .map((serie, indice) => {
                const proveedor = String(serie.proveedor || serie.label || '');
                return {
                    proveedor,
                    label: String(serie.label || proveedor),
                    valores: Array.isArray(serie.valores) ? serie.valores : [],
                    color: this.colorSerie(proveedor, indice)
                };
            })
            .filter(serie => serie.proveedor !== '' && serie.valores.some(valor => valor !== null && valor !== undefined));

        const header = `
            <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <span class="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            ${this.escapeHtml(this.formatearPeriodo(fechaInicio, fechaFin))}
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-400 font-medium mt-0.5">Precio promedio semanal por proveedor</p>
                </div>
            </div>
        `;

        if (columnas.length === 0 || series.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    ${header}
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (typeof Chart === 'undefined') {
            contenedor.innerHTML = `
                <div class="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
                    <i class="fas fa-exclamation-triangle text-amber-500 text-3xl mb-2"></i>
                    <h3 class="text-sm font-bold text-slate-700 uppercase">No se pudo cargar Chart.js</h3>
                    <p class="text-xs text-slate-400 mt-1">Verifica la conexión con la librería de gráficos.</p>
                </div>
            `;
            return;
        }

        const labels = columnas.map(columna => `Semana ${columna.semana}`);
        const valoresValidos = [];
        series.forEach(serie => {
            serie.valores.forEach(valor => {
                const numero = Number(valor);
                if (valor !== null && valor !== undefined && Number.isFinite(numero)) {
                    valoresValidos.push(numero);
                }
            });
        });

        if (valoresValidos.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    ${header}
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <p class="text-sm font-semibold text-slate-600">No hay precios para representar.</p>
                    </div>
                </div>
            `;
            return;
        }

        const escala = this.calcularEscala(valoresValidos);
        const minWidth = Math.max(1200, columnas.length * 28 + 180);
        const dpr = Math.min(
            Math.max(2, window.devicePixelRatio || 1),
            Math.max(1, Math.min(4, 16000 / minWidth))
        );

        const leyendaHtml = series.map((serie, indice) => `
            <button type="button" data-dataset-index="${indice}" aria-pressed="true"
                title="${this.escapeHtml(serie.proveedor)}"
                class="precio-legend-item flex items-start gap-2 text-left px-1.5 py-1 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
                <span class="w-3 h-3 rounded-[2px] shrink-0 mt-0.5" style="background:${serie.color}"></span>
                <span class="text-[12px] font-semibold text-slate-600 leading-snug">${this.escapeHtml(serie.label)}</span>
            </button>
        `).join('');

        contenedor.innerHTML = `
            <div class="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                ${header}
                <div class="p-3 sm:p-4 flex flex-col lg:flex-row gap-4">
                    <div class="flex-1 min-w-0 overflow-x-auto custom-scrollbar pb-1">
                        <div class="flex" style="min-width:${minWidth}px">
                            <div class="w-[78px] shrink-0 flex items-center justify-center border-r border-slate-200 bg-white px-2 text-center text-[12.5px] font-bold text-slate-600">
                                <span style="writing-mode:vertical-rl; transform:rotate(180deg);">${this.escapeHtml(tipo)}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="h-[520px]">
                                    <canvas id="criadorempre-precios-canvas"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="w-full lg:w-56 shrink-0">
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Proveedor</p>
                        <div id="criadorempre-precios-legend"
                            class="flex flex-wrap lg:flex-col gap-1.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                            ${leyendaHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.getElementById('criadorempre-precios-canvas');
        if (!canvas) return;

        const tooltipHandler = (context) => this.mostrarTooltipGrafico(context, columnas, tipo);

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: series.map(serie => ({
                    label: serie.proveedor,
                    data: serie.valores.map(valor => {
                        if (valor === null || valor === undefined) return null;
                        const numero = Number(valor);
                        return Number.isFinite(numero) ? numero : null;
                    }),
                    borderColor: serie.color,
                    backgroundColor: serie.color,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: serie.color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 1,
                    pointHitRadius: 10,
                    fill: false,
                    tension: 0,
                    spanGaps: true
                }))
            },
            plugins: [
                this.crearPluginEtiquetasVerticales(),
                this.crearPluginEncabezadoAnios(columnas)
            ],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: dpr,
                animation: { duration: 250 },
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                layout: {
                    padding: { top: 52, right: 12, bottom: 8, left: 6 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: tooltipHandler
                    },
                    datalabels: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            color: '#475569',
                            font: { size: 11.5 },
                            callback: (value, index) => labels[index]
                        }
                    },
                    y: {
                        min: escala.min,
                        max: escala.max,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.24)',
                            drawTicks: false
                        },
                        border: { display: false },
                        ticks: {
                            stepSize: 0.1,
                            color: '#475569',
                            font: { size: 11.5 },
                            callback: (value) => this.formatearEjePrecio(value)
                        },
                        title: {
                            display: true,
                            text: 'PrecioProm',
                            color: '#64748b',
                            font: { size: 13, weight: '600' }
                        }
                    }
                }
            }
        });

        this.chart = chart;

        const leyenda = document.getElementById('criadorempre-precios-legend');
        if (leyenda) {
            leyenda.querySelectorAll('[data-dataset-index]').forEach(boton => {
                boton.addEventListener('click', () => {
                    if (!this.chart) return;

                    const indice = Number(boton.dataset.datasetIndex);
                    const visible = this.chart.isDatasetVisible(indice);
                    this.chart.setDatasetVisibility(indice, !visible);
                    this.chart.update();

                    boton.classList.toggle('opacity-40', visible);
                    boton.setAttribute('aria-pressed', String(!visible));
                });
            });
        }

        const scroll = contenedor.querySelector('.custom-scrollbar');
        if (scroll) {
            scroll.addEventListener('scroll', () => this.ocultarTooltip(), { passive: true });
        }
    },

    crearPluginEtiquetasVerticales() {
        return {
            id: `criadoremprePreciosLabels_${Math.random().toString(36).slice(2)}`,
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                const area = chart.chartArea;
                if (!ctx || !area) return;

                ctx.save();
                ctx.font = '700 10.5px "Segoe UI", sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                const ocupados = [];
                const candidatos = [];

                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    if (!chart.isDatasetVisible(datasetIndex)) return;

                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta || !Array.isArray(meta.data)) return;

                    meta.data.forEach((element, index) => {
                        const valor = dataset.data[index];
                        if (valor === null || valor === undefined) return;

                        const texto = window.ChartCriadorEmprePreciosGrafico.formatearPrecio(valor);
                        if (!texto) return;

                        const alto = ctx.measureText(texto).width;
                        const x = element.x + 4;
                        let y = element.y - 4;

                        if (y - alto < area.top + 2) {
                            y = element.y + alto + 4;
                        }

                        candidatos.push({
                            x1: x,
                            y1: y - alto,
                            x2: x + 14,
                            y2: y,
                            x,
                            y,
                            texto,
                            color: dataset.borderColor,
                            valor
                        });
                    });
                });

                candidatos.sort((a, b) => b.valor - a.valor);

                candidatos.forEach(candidato => {
                    if (candidato.y1 < area.top || candidato.y2 > area.bottom) return;
                    if (candidato.x1 < area.left || candidato.x2 > area.right) return;

                    const colisiona = ocupados.some(ocupado =>
                        !(candidato.x2 < ocupado.x1 ||
                          candidato.x1 > ocupado.x2 ||
                          candidato.y2 < ocupado.y1 ||
                          candidato.y1 > ocupado.y2)
                    );

                    if (colisiona) return;
                    ocupados.push(candidato);

                    ctx.save();
                    ctx.translate(candidato.x, candidato.y);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillStyle = candidato.color;
                    ctx.fillText(candidato.texto, 0, 0);
                    ctx.restore();
                });

                ctx.restore();
            }
        };
    },

    crearPluginEncabezadoAnios(columnas) {
        return {
            id: 'criadoremprePreciosYearHeader',
            afterDraw: (chart) => {
                const scale = chart.scales.x;
                const area = chart.chartArea;
                const ctx = chart.ctx;
                if (!scale || !area || !ctx) return;

                const grupos = [];
                columnas.forEach((columna, index) => {
                    const anio = Number(columna.anio);
                    let grupo = grupos.find(item => item.anio === anio);
                    if (!grupo) {
                        grupo = { anio, inicio: index, fin: index };
                        grupos.push(grupo);
                    }
                    grupo.fin = index;
                });

                if (grupos.length === 0) return;

                const paso = scale.getPixelForValue(1) - scale.getPixelForValue(0);
                const primerGrupo = grupos[0];
                const primerIzquierda = scale.getPixelForValue(primerGrupo.inicio) - paso / 2;
                const primerDerecha = scale.getPixelForValue(primerGrupo.fin) + paso / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = '600 11px "Segoe UI", sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('fecha', (primerIzquierda + primerDerecha) / 2, area.top - 34);

                ctx.font = '700 12.5px "Segoe UI", sans-serif';
                ctx.fillStyle = '#475569';

                grupos.forEach((grupo, indice) => {
                    const izquierda = scale.getPixelForValue(grupo.inicio) - paso / 2;
                    const derecha = scale.getPixelForValue(grupo.fin) + paso / 2;

                    if (indice > 0) {
                        ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(izquierda, area.top);
                        ctx.lineTo(izquierda, area.bottom);
                        ctx.stroke();
                    }

                    ctx.fillText(String(grupo.anio), (izquierda + derecha) / 2, area.top - 14);
                });

                ctx.restore();
            }
        };
    },

    mostrarTooltipGrafico(context, columnas, tipo) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const valor = punto.parsed.y;
        if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) {
            this.ocultarTooltip();
            return;
        }

        const columna = columnas[punto.dataIndex] || {};
        const proveedor = punto.dataset && punto.dataset.label ? punto.dataset.label : '';

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(130px, 1fr); gap:7px 18px; align-items:start;">
                <span style="color:#64748b;">Tipo:</span>
                <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(tipo)}</span>
                <span style="color:#64748b;">NombreCorregido:</span>
                <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(proveedor)}</span>
                <span style="color:#64748b;">Semana de fecha:</span>
                <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">Semana ${this.escapeHtml(String(columna.semana || ''))}</span>
                <span style="color:#64748b;">Año de fecha:</span>
                <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(String(columna.anio || ''))}</span>
                <span style="color:#64748b;">PrecioProm:</span>
                <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.formatearPrecio(valor)}</span>
            </div>
        `;

        tooltipEl.style.opacity = '1';
        this.posicionarTooltipGrafico(context.chart, tooltip, tooltipEl);
    },

    posicionarTooltipGrafico(chart, tooltip, tooltipEl) {
        const rect = chart.canvas.getBoundingClientRect();
        const offset = 14;
        let left = rect.left + tooltip.caretX + offset;
        let top = rect.top + tooltip.caretY;

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;

        const tooltipRect = tooltipEl.getBoundingClientRect();

        if (tooltipRect.right > window.innerWidth - 12) {
            left = rect.left + tooltip.caretX - tooltipRect.width - offset;
        }

        if (tooltipRect.bottom > window.innerHeight - 12) {
            top = window.innerHeight - tooltipRect.height - 12;
        }

        tooltipEl.style.left = `${Math.max(8, left)}px`;
        tooltipEl.style.top = `${Math.max(8, top)}px`;
    },

    obtenerTooltipEl() {
        let tooltipEl = document.getElementById(this.tooltipId);

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = this.tooltipId;
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.zIndex = '9999';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.1s ease';
            tooltipEl.style.background = '#ffffff';
            tooltipEl.style.border = '1px solid #cbd5e1';
            tooltipEl.style.borderRadius = '6px';
            tooltipEl.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            tooltipEl.style.padding = '12px 14px';
            tooltipEl.style.color = '#334155';
            tooltipEl.style.fontFamily = '"Segoe UI", sans-serif';
            tooltipEl.style.fontSize = '13px';
            tooltipEl.style.lineHeight = '1.5';
            tooltipEl.style.transform = 'translateY(-50%)';
            document.body.appendChild(tooltipEl);
        }

        return tooltipEl;
    },

    ocultarTooltip() {
        const tooltipEl = document.getElementById(this.tooltipId);
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    },

    calcularEscala(valores) {
        const min = Math.min(...valores);
        const max = Math.max(...valores);

        let minimo = Math.max(0, Math.floor((min - 0.1) * 10) / 10);
        let maximo = Math.ceil((max + 0.1) * 10) / 10;

        if (minimo === maximo) {
            maximo = minimo + 0.5;
        }

        return { min: minimo, max: maximo };
    },

    colorSerie(proveedor, indice) {
        const nombre = String(proveedor || '').trim();
        if (this.coloresProveedor[nombre]) {
            return this.coloresProveedor[nombre];
        }

        let hash = 0;
        for (let i = 0; i < nombre.length; i++) {
            hash = ((hash * 31) + nombre.charCodeAt(i)) >>> 0;
        }

        return this.paleta[hash % this.paleta.length];
    },

    formatearPrecio(valor) {
        if (valor === null || valor === undefined || valor === '') return '';

        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';

        if (!this.formateadorPrecio) {
            this.formateadorPrecio = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            });
        }

        return this.formateadorPrecio.format(numero);
    },

    formatearEjePrecio(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '';

        if (!this.formateadorEje) {
            this.formateadorEje = new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            });
        }

        return this.formateadorEje.format(numero);
    },

    formatearPeriodo(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return 'Rango seleccionado';

        const inicio = String(fechaInicio).split('-');
        const fin = String(fechaFin).split('-');

        if (inicio.length !== 3 || fin.length !== 3) {
            return `${fechaInicio} al ${fechaFin}`;
        }

        return `${inicio[2]}/${inicio[1]}/${inicio[0]} - ${fin[2]}/${fin[1]}/${fin[0]}`;
    },

    escapeHtml(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[caracter]));
    },

    destroy() {
        this.ocultarTooltip();

        const tooltipEl = document.getElementById(this.tooltipId);
        if (tooltipEl) {
            tooltipEl.remove();
        }

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

window.ChartRegistry['CriadorEmprePreciosGrafico'] = window.ChartCriadorEmprePreciosGrafico;
