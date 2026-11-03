window.MermaGeneralMensualChart = {
    chart: null,
    datos: null,
    hitosEl: null,
    hitosVisibles: [],
    mostrarHitos: true,
    hitos: [
        {
            fecha: '2025-03',
            fechaLabel: 'Mar-25',
            titulo: 'Proyecto Almacén Comercial',
            icono: 'fa-warehouse',
            color: '#dc2626',
            fondo: '#fef2f2'
        },
        {
            fecha: '2025-06',
            fechaLabel: 'Jun-25',
            titulo: 'Planificador de U.T. Planificador de distribución por cliente',
            icono: 'fa-clipboard-list',
            color: '#d97706',
            fondo: '#fffbeb'
        },
        {
            fecha: '2025-10',
            fechaLabel: 'Oct-25',
            titulo: 'Codificación de Agentes Causales',
            icono: 'fa-magnifying-glass-chart',
            color: '#16a34a',
            fondo: '#f0fdf4'
        },
        {
            fecha: '2026-03',
            fechaLabel: 'Mar-26',
            titulo: 'Bloqueo de ruta Huega de Transportistas',
            icono: 'fa-route',
            color: '#2563eb',
            fondo: '#eff6ff'
        },
        {
            rango: ['2026-06', '2026-08'],
            fechaLabel: 'Jun a Ago-26',
            titulo: 'Evento sanitario',
            icono: 'fa-people-group',
            color: '#2563eb',
            fondo: '#eff6ff'
        }
    ],

    render(contenedor, data) {
        if (!contenedor) return;

        this.destroy();
        this.datos = data || {};
        this.mostrarHitos = document.getElementById('toggle-hitos')?.checked !== false;

        const meses = Array.isArray(this.datos.meses) ? this.datos.meses : [];
        if (!meses.length) {
            contenedor.innerHTML = this.buildEmptyState(this.datos);
            return;
        }

        contenedor.innerHTML = this.buildLayout(this.datos, meses);

        const canvas = document.getElementById('canvas-merma-general-mensual');
        if (!canvas || typeof Chart === 'undefined') return;

        const labels = meses.map((mes) => mes.label || mes.mes);
        const valores = meses.map((mes) => {
            if (mes.merma_pct === null || mes.merma_pct === undefined) return null;
            const valor = Number(mes.merma_pct);
            return Number.isFinite(valor) ? valor : null;
        });

        const promedioAntes = this.numeroValido(this.datos.promedio_antes);
        const promedioActual = this.numeroValido(this.datos.promedio_actual);
        const valoresValidos = valores.filter((valor) => valor !== null);

        if (!valoresValidos.length) {
            contenedor.innerHTML = this.buildEmptyState(this.datos);
            return;
        }

        const escalaY = this.calcularEscalaY(valoresValidos, [promedioAntes, promedioActual]);

        const datasets = [
            {
                label: '% Merma',
                data: valores,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.10)',
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointHitRadius: 10,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                fill: 'origin',
                tension: 0,
                spanGaps: false,
                order: 2
            }
        ];

        if (promedioAntes !== null) {
            datasets.push({
                label: 'Promedio antes',
                data: labels.map(() => promedioAntes),
                borderColor: '#dc2626',
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                order: 1
            });
        }

        if (promedioActual !== null) {
            datasets.push({
                label: 'Promedio actual',
                data: labels.map(() => promedioActual),
                borderColor: '#16a34a',
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0,
                order: 1
            });
        }

        const self = this;
        this.hitosVisibles = this.calcularHitosVisibles(meses);

        const fases = [
            {
                desde: '2025-01',
                hasta: '2025-05',
                titulo: '1. Mapeo del Proceso',
                fondo: 'rgba(254, 202, 202, 0.45)',
                texto: '#b91c1c'
            },
            {
                desde: '2025-06',
                hasta: '2025-09',
                titulo: '2. Trazabilidad',
                fondo: 'rgba(253, 230, 138, 0.45)',
                texto: '#b45309'
            },
            {
                desde: '2025-10',
                hasta: null,
                titulo: '3. Seguimiento, control y auditoría al proceso',
                fondo: 'rgba(187, 247, 208, 0.45)',
                texto: '#15803d'
            }
        ];

        const phaseBandsPlugin = {
            id: 'mermaGeneralMensualPhaseBands',
            beforeDraw: (chart) => {
                const chartArea = chart.chartArea;
                const xScale = chart.scales.x;
                const meses = self.datos.meses || [];
                if (!chartArea || !xScale || !meses.length) return;

                const ctx = chart.ctx;
                const centros = meses.map((_, index) => xScale.getPixelForValue(index));

                fases.forEach((fase) => {
                    const indices = [];
                    meses.forEach((mes, index) => {
                        if (mes.mes >= fase.desde && (!fase.hasta || mes.mes <= fase.hasta)) {
                            indices.push(index);
                        }
                    });

                    if (!indices.length) return;

                    const primerIndice = indices[0];
                    const ultimoIndice = indices[indices.length - 1];
                    const centroInicio = centros[primerIndice];
                    const centroFin = centros[ultimoIndice];
                    const centroAnterior = primerIndice > 0 ? centros[primerIndice - 1] : null;
                    const centroSiguiente = ultimoIndice < centros.length - 1 ? centros[ultimoIndice + 1] : null;

                    const inicioX = centroAnterior !== null
                        ? (centroAnterior + centroInicio) / 2
                        : chartArea.left;
                    const finX = centroSiguiente !== null
                        ? (centroFin + centroSiguiente) / 2
                        : chartArea.right;

                    const left = Math.max(chartArea.left, inicioX);
                    const right = Math.min(chartArea.right, finX);
                    if (right <= left) return;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
                    ctx.clip();
                    ctx.fillStyle = fase.fondo;
                    ctx.fillRect(left, chartArea.top, right - left, chartArea.height);
                    ctx.restore();

                    const anchoDisponible = right - left - 12;
                    if (anchoDisponible < 70) return;

                    let fontSize = 11;
                    let texto = fase.titulo;
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = fase.texto;
                    ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`;

                    while (fontSize > 8 && ctx.measureText(texto).width > anchoDisponible) {
                        fontSize--;
                        ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`;
                    }

                    if (ctx.measureText(texto).width > anchoDisponible) {
                        while (texto.length > 5 && ctx.measureText(`${texto}…`).width > anchoDisponible) {
                            texto = texto.slice(0, -1);
                        }
                        texto = `${texto}…`;
                    }

                    ctx.fillText(texto, (left + right) / 2, chartArea.top - 12);
                    ctx.restore();
                });
            }
        };

        const valueLabelsPlugin = {
            id: 'mermaGeneralMensualValueLabels',
            afterDatasetsDraw: (chart) => {
                const meta = chart.getDatasetMeta(0);
                const data = chart.data.datasets[0]?.data || [];
                if (!meta || !meta.data) return;

                const ctx = chart.ctx;
                ctx.save();
                ctx.font = '600 9px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
                ctx.fillStyle = '#334155';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                meta.data.forEach((point, index) => {
                    const value = data[index];
                    if (point.skip || value === null || value === undefined) return;
                    if (chart.width < 900 && index % 2 !== 0) return;
                    ctx.fillText(`${self.formatNum(value, 2)}%`, point.x, point.y - 7);
                });

                ctx.restore();
            }
        };

        const hitosPlugin = {
            id: 'mermaGeneralMensualHitos',
            afterDatasetsDraw: (chart) => {
                if (!self.mostrarHitos || !self.hitosVisibles.length) return;

                const chartArea = chart.chartArea;
                const xScale = chart.scales.x;
                if (!chartArea || !xScale) return;

                const ctx = chart.ctx;
                ctx.save();

                self.hitosVisibles.forEach((hito) => {
                    const inicioX = xScale.getPixelForValue(hito.startIndex);
                    const finX = xScale.getPixelForValue(hito.endIndex);
                    const posiciones = finX !== inicioX ? [inicioX, finX] : [inicioX];

                    ctx.strokeStyle = hito.color;
                    ctx.globalAlpha = 0.42;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 4]);

                    posiciones.forEach((x) => {
                        if (x < chartArea.left || x > chartArea.right) return;
                        ctx.beginPath();
                        ctx.moveTo(x, chartArea.top);
                        ctx.lineTo(x, chartArea.bottom);
                        ctx.stroke();
                    });

                    ctx.globalAlpha = 1;
                    ctx.setLineDash([]);
                    ctx.fillStyle = hito.color;

                    posiciones.forEach((x) => {
                        if (x < chartArea.left || x > chartArea.right) return;
                        ctx.beginPath();
                        ctx.arc(x, chartArea.bottom, 3, 0, Math.PI * 2);
                        ctx.fill();
                    });
                });

                ctx.restore();
            }
        };

        const breakpointPlugin = {
            id: 'mermaGeneralMensualBreakpoint',
            afterDatasetsDraw: (chart) => {
                const meses = self.datos.meses || [];
                const indice = meses.findIndex((mes) => mes.mes === '2025-10');
                if (indice < 0) return;

                const chartArea = chart.chartArea;
                const xScale = chart.scales.x;
                if (!chartArea || !xScale) return;

                const centros = meses.map((_, index) => xScale.getPixelForValue(index));
                const x = indice > 0
                    ? (centros[indice - 1] + centros[indice]) / 2
                    : centros[indice];
                const xLinea = Math.max(chartArea.left, Math.min(chartArea.right, x));

                const ctx = chart.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 4]);
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#334155';
                ctx.moveTo(xLinea, chartArea.top);
                ctx.lineTo(xLinea, chartArea.bottom);
                ctx.stroke();
                ctx.restore();

                const ancho = 160;
                const alto = 62;
                const boxLeft = Math.max(
                    chartArea.left + 4,
                    Math.min(xLinea - ancho / 2, chartArea.right - ancho - 4)
                );
                const boxTop = Math.min(
                    chartArea.top + 34,
                    chartArea.bottom - alto - 8
                );

                ctx.save();
                ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetY = 3;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(boxLeft, boxTop, ancho, alto, 10);
                } else {
                    const radio = 10;
                    ctx.moveTo(boxLeft + radio, boxTop);
                    ctx.lineTo(boxLeft + ancho - radio, boxTop);
                    ctx.quadraticCurveTo(boxLeft + ancho, boxTop, boxLeft + ancho, boxTop + radio);
                    ctx.lineTo(boxLeft + ancho, boxTop + alto - radio);
                    ctx.quadraticCurveTo(boxLeft + ancho, boxTop + alto, boxLeft + ancho - radio, boxTop + alto);
                    ctx.lineTo(boxLeft + radio, boxTop + alto);
                    ctx.quadraticCurveTo(boxLeft, boxTop + alto, boxLeft, boxTop + alto - radio);
                    ctx.lineTo(boxLeft, boxTop + radio);
                    ctx.quadraticCurveTo(boxLeft, boxTop, boxLeft + radio, boxTop);
                    ctx.closePath();
                }
                ctx.fillStyle = '#1e4e8c';
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = '#173b6b';
                ctx.lineWidth = 1;
                ctx.stroke();

                const centroX = boxLeft + ancho / 2;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';

                ctx.font = '700 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
                ctx.fillText('PUNTO DE QUIEBRE', centroX, boxTop + 16);

                ctx.font = '700 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
                ctx.fillText('Oct-25', centroX, boxTop + 32);

                ctx.font = '500 9px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif';
                ctx.fillText('Inicio de Control', centroX, boxTop + 48);

                ctx.restore();
            }
        };

        const ctx = canvas.getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                onResize: () => {
                    if (self.chart) self.posicionarHitos();
                },
                layout: {
                    padding: {
                        top: 46,
                        right: 12,
                        bottom: 4,
                        left: 4
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        filter: (item) => item.datasetIndex === 0,
                        backgroundColor: '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                const mes = this.datos.meses[items[0].dataIndex] || {};
                                return mes.label_largo || mes.label || '';
                            },
                            label: (item) => {
                                const mes = this.datos.meses[item.dataIndex] || {};

                                if (mes.merma_pct === null || mes.merma_pct === undefined) {
                                    return 'Sin dato para este mes';
                                }

                                const lineas = [
                                    `% Merma: ${this.formatNum(mes.merma_pct, 2)}%`,
                                    `Merma: ${this.formatNum(mes.merma, 2)} kg`,
                                    `Entrada: ${this.formatNum(mes.entrada, 2)} kg`
                                ];

                                if (mes.parcial) {
                                    const corte = this.datos.fecha_corte_dmy || this.datos.fecha_corte || '';
                                    lineas.push(`Mes en curso (corte ${corte})`);
                                }

                                return lineas;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#475569',
                            font: {
                                size: 9,
                                weight: '600'
                            },
                            maxRotation: 0,
                            autoSkip: true,
                            autoSkipPadding: 8
                        }
                    },
                    y: {
                        min: escalaY.min,
                        max: escalaY.max,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            stepSize: escalaY.step,
                            color: '#64748b',
                            font: {
                                size: 9
                            },
                            callback: (value) => `${this.formatNum(value, 2)}%`
                        }
                    }
                }
            },
            plugins: [phaseBandsPlugin, valueLabelsPlugin, breakpointPlugin, hitosPlugin]
        });

        this.renderHitos(meses);
    },

    calcularHitosVisibles(meses) {
        const visibles = [];

        (this.hitos || []).forEach((hito) => {
            const indices = [];

            meses.forEach((mes, index) => {
                const clave = mes.mes;
                if (hito.rango) {
                    if (clave >= hito.rango[0] && clave <= hito.rango[1]) {
                        indices.push(index);
                    }
                } else if (clave === hito.fecha) {
                    indices.push(index);
                }
            });

            if (!indices.length) return;

            visibles.push({
                ...hito,
                startIndex: indices[0],
                endIndex: indices[indices.length - 1]
            });
        });

        return visibles;
    },

    renderHitos(meses) {
        this.hitosEl = document.getElementById('hitos-merma-general');
        if (!this.hitosEl) return;

        if (!this.hitosVisibles.length) {
            this.hitosEl.innerHTML = '';
            this.hitosEl.classList.add('hidden');
            return;
        }

        this.hitosEl.innerHTML = this.hitosVisibles.map((hito, index) => {
            const esRango = hito.endIndex > hito.startIndex;
            return `
                <div class="hito-item absolute pointer-events-none" data-hito-index="${index}" style="left:0;top:0;">
                    ${esRango ? `<div class="hito-bracket absolute left-0 top-0 w-full border-t border-dashed" style="border-color:${hito.color};"></div>` : ''}
                    <div class="hito-card inline-flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm max-w-[190px] ${esRango ? 'mt-2' : ''}">
                        <span class="inline-flex items-center justify-center w-6 h-6 rounded shrink-0" style="color:${hito.color}; background:${hito.fondo};">
                            <i class="fa-solid ${hito.icono} text-[11px]"></i>
                        </span>
                        <div class="text-[10px] leading-tight text-slate-600">
                            <div class="font-bold" style="color:${hito.color};">${this.escapeHtml(hito.fechaLabel)}</div>
                            <div>${this.escapeHtml(hito.titulo)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.hitosEl.classList.toggle('hidden', !this.mostrarHitos);
        this.posicionarHitos();
    },

    posicionarHitos() {
        if (!this.hitosEl || !this.chart) return;

        const xScale = this.chart.scales.x;
        if (!xScale) return;

        const items = Array.from(this.hitosEl.querySelectorAll('.hito-item'));
        const ocupados = [];

        items.forEach((item, index) => {
            const hito = this.hitosVisibles[index];
            if (!hito) return;

            const inicioX = xScale.getPixelForValue(hito.startIndex);
            const finX = xScale.getPixelForValue(hito.endIndex);
            const esRango = hito.endIndex > hito.startIndex;
            const card = item.querySelector('.hito-card');

            if (esRango) {
                const left = Math.min(inicioX, finX);
                const right = Math.max(inicioX, finX);
                item.style.left = `${left}px`;
                item.style.width = `${Math.max(20, right - left)}px`;
                item.style.transform = 'none';
                if (card) {
                    card.style.position = 'relative';
                    card.style.left = '50%';
                    card.style.transform = 'translateX(-50%)';
                }
            } else {
                item.style.left = `${inicioX}px`;
                item.style.width = 'auto';
                item.style.transform = 'translateX(-50%)';
                if (card) {
                    card.style.position = '';
                    card.style.left = '';
                    card.style.transform = '';
                }
            }

            item.style.top = '0px';
            const rect = item.getBoundingClientRect();
            let lane = 0;

            while (lane < 3 && ocupados.some((box) => {
                return box.lane === lane && !(rect.right < box.left || rect.left > box.right);
            })) {
                lane++;
            }

            item.style.top = `${lane * 74}px`;
            ocupados.push({ lane, left: rect.left, right: rect.right });
        });

        const maxLane = ocupados.reduce((max, box) => Math.max(max, box.lane), 0);
        this.hitosEl.style.height = `${maxLane * 74 + 64}px`;
    },

    setHitosVisible(visible) {
        this.mostrarHitos = Boolean(visible);

        if (!this.hitosEl) return;

        if (this.mostrarHitos) {
            this.renderHitos(this.datos?.meses || []);
        } else {
            this.hitosEl.classList.add('hidden');
        }

        if (this.chart) {
            this.chart.update('none');
            if (this.mostrarHitos) {
                requestAnimationFrame(() => this.posicionarHitos());
            }
        }
    },

    buildLayout(data, meses) {
        const fechaCorte = data.fecha_corte_dmy || data.fecha_corte || '';
        const filtros = data.filtros_aplicados || {};
        const resumen = this.escapeHtml(filtros.resumen || 'Todas las zonas · Todos los clientes · Todos los códigos');
        const nota = this.escapeHtml(filtros.nota || '');
        const periodoAntes = data.promedio_antes_periodo?.label || 'ene-25 a sep-25';
        const periodoActual = data.promedio_actual_periodo?.label || 'ene-26 a ago-26';
        const promedioAntes = this.numeroValido(data.promedio_antes);
        const promedioActual = this.numeroValido(data.promedio_actual);

        const chipAntes = promedioAntes === null ? '' : `
            <div class="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-red-700">
                <span class="inline-block w-4 border-t-2 border-dashed border-red-500"></span>
                <span>Promedio antes</span>
                <span class="font-black">${this.formatNum(promedioAntes, 2)}%</span>
                <span class="font-medium text-red-500">(${periodoAntes})</span>
            </div>
        `;

        const chipActual = promedioActual === null ? '' : `
            <div class="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-green-700">
                <span class="inline-block w-4 border-t-2 border-dashed border-green-500"></span>
                <span>Promedio actual</span>
                <span class="font-black">${this.formatNum(promedioActual, 2)}%</span>
                <span class="font-medium text-green-600">(${periodoActual})</span>
            </div>
        `;

        return `
            <section class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-4 py-4 sm:px-6 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Merma (%) General</h2>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Evolución mensual del % de merma en peso · ${resumen}${fechaCorte ? ` · Datos al ${fechaCorte}` : ''}
                        </p>
                        <div class="mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-800">
                            <span class="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                            <span>Punto de quiebre: Oct-25 · Inicio de Control</span>
                        </div>
                        ${nota ? `
                            <p class="text-[10px] text-amber-600 mt-1">
                                <i class="fa-solid fa-circle-exclamation mr-1"></i>${nota}
                            </p>
                        ` : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        ${chipAntes}
                        ${chipActual}
                    </div>
                </div>

                <div class="p-3 sm:p-5">
                    <div class="relative w-full" style="height: 480px;">
                        <canvas id="canvas-merma-general-mensual" role="img" aria-label="Evolución mensual de merma general"></canvas>
                    </div>
                    <div id="hitos-merma-general" class="relative w-full mt-1 hidden" style="height: 120px;"></div>
                </div>

                <div class="px-4 sm:px-6 py-2.5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span>Fuente: dmmermas · Dato: Peso · ${meses.length} meses</span>
                    <span>${data.ultimo_mes_parcial ? 'El último mes está en curso.' : ''}</span>
                </div>
            </section>
        `;
    },

    buildEmptyState(data) {
        const resumen = this.escapeHtml(data?.filtros_aplicados?.resumen || '');
        return `
            <div class="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <div class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-100 text-slate-400 mb-3">
                    <i class="fa-solid fa-chart-line"></i>
                </div>
                <p class="text-sm font-semibold text-slate-700">Sin datos disponibles</p>
                <p class="text-xs text-slate-500 mt-1">No se encontraron registros de merma en peso para los filtros seleccionados.</p>
                ${resumen ? `<p class="text-[10px] text-slate-400 mt-2">${resumen}</p>` : ''}
            </div>
        `;
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    calcularEscalaY(valores, promedios) {
        const numeros = [];

        valores.forEach((valor) => {
            const numero = Number(valor);
            if (Number.isFinite(numero)) numeros.push(numero);
        });

        promedios.forEach((valor) => {
            if (valor === null || valor === undefined) return;
            const numero = Number(valor);
            if (Number.isFinite(numero)) numeros.push(numero);
        });

        if (!numeros.length) {
            return { min: 2, max: 5, step: 0.5 };
        }

        const minimo = Math.min(...numeros);
        const maximo = Math.max(...numeros);
        const minY = Math.max(0, Math.floor((minimo - 0.25) * 2) / 2);
        let maxY = Math.ceil((maximo + 0.25) * 2) / 2;

        if (maxY - minY < 1) maxY = minY + 1;
        if (maxY < 5) maxY = 5;

        const rango = maxY - minY;
        let step = 0.5;
        if (rango > 4) step = 1;
        if (rango > 10) step = 2;
        if (rango > 20) step = 5;

        return { min: minY, max: maxY, step };
    },

    numeroValido(valor) {
        if (valor === null || valor === undefined || valor === '') return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    },

    formatNum(valor, decimales = 2) {
        if (valor === null || valor === undefined || valor === '') return '—';
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return '—';

        return numero.toLocaleString('es-PE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        this.hitosEl = null;
        this.hitosVisibles = [];
    }
};
