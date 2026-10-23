/**
 * Helper compartido para Tiendas y Mercados.
 * Agrega la data y crea gráficos de barras reutilizables.
 */
window.TiendasMercadosHelper = {
    coloresTipo: {
        'Puesto de mercado': '#4E79A7',
        'Tienda y puesto aledaño': '#F28E2B'
    },
    coloresTamanio: {
        'Puesto de mercado': {
            'Grande': '#2F4B7C',
            'Mediano': '#4E79A7',
            'Chico': '#A0CBE8'
        },
        'Tienda y puesto aledaño': {
            'Grande': '#B45F06',
            'Mediano': '#F28E2B',
            'Chico': '#FFBE7D'
        }
    },
    coloresTamanioSimple: {
        'Grande': '#F28E2B',
        'Mediano': '#E15759',
        'Chico': '#4E79A7'
    },
    paleta: ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2'],

    construirResumen(data) {
        const filas = Array.isArray(data && data.filas) ? data.filas : [];
        const provincias = [];
        const tipos = [];
        const tamanios = [];
        const datos = {};

        filas.forEach(fila => {
            const provincia = String(fila.provincia || '');
            const tipo = String(fila.tipo || '');
            const tamanio = String(fila.tamanio || '');
            const cantidad = Number(fila.cantidad) || 0;

            if (!provincia || !tipo || !tamanio) return;

            if (!provincias.includes(provincia)) provincias.push(provincia);
            if (!tipos.includes(tipo)) tipos.push(tipo);
            if (!tamanios.includes(tamanio)) tamanios.push(tamanio);

            if (!datos[provincia]) datos[provincia] = {};
            if (!datos[provincia][tipo]) datos[provincia][tipo] = {};
            datos[provincia][tipo][tamanio] = (datos[provincia][tipo][tamanio] || 0) + cantidad;
        });

        const ordenTamanios = ['Grande', 'Mediano', 'Chico'];
        tamanios.sort((a, b) => {
            const ia = ordenTamanios.indexOf(a);
            const ib = ordenTamanios.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        const totalProvincia = {};
        const totalProvinciaTipo = {};
        let totalGeneral = 0;

        provincias.forEach(provincia => {
            totalProvincia[provincia] = 0;
            const tiposProvincia = datos[provincia] || {};

            Object.keys(tiposProvincia).forEach(tipo => {
                const totalTipo = Object.values(tiposProvincia[tipo]).reduce((a, b) => a + Number(b || 0), 0);
                totalProvinciaTipo[`${provincia}||${tipo}`] = totalTipo;
                totalProvincia[provincia] += totalTipo;
            });

            totalGeneral += totalProvincia[provincia];
        });

        const generalCantidad = {};
        const generalPorcentaje = {};
        const totalTipo = {};

        tipos.forEach(tipo => {
            generalCantidad[tipo] = provincias.map(provincia => {
                const valores = datos[provincia] && datos[provincia][tipo] ? datos[provincia][tipo] : {};
                return Object.values(valores).reduce((a, b) => a + Number(b || 0), 0);
            });

            totalTipo[tipo] = generalCantidad[tipo].reduce((a, b) => a + Number(b || 0), 0);
        });

        tipos.forEach(tipo => {
            generalPorcentaje[tipo] = provincias.map((provincia, index) => {
                const total = totalTipo[tipo] || 0;
                return total > 0 ? (generalCantidad[tipo][index] / total) * 100 : 0;
            });
        });

        const combinacionesTamanio = [];
        tipos.forEach(tipo => {
            tamanios.forEach(tamanio => {
                const existe = provincias.some(provincia =>
                    datos[provincia] &&
                    datos[provincia][tipo] &&
                    Object.prototype.hasOwnProperty.call(datos[provincia][tipo], tamanio)
                );
                if (existe) {
                    combinacionesTamanio.push({ tipo, tamanio, label: `${tipo} · ${tamanio}` });
                }
            });
        });

        const tamanioCantidad = {};
        const tamanioPorcentaje = {};
        const totalTipoTamanio = {};

        combinacionesTamanio.forEach(({ tipo, tamanio, label }) => {
            tamanioCantidad[label] = provincias.map(provincia => {
                return Number(
                    datos[provincia] &&
                    datos[provincia][tipo] &&
                    datos[provincia][tipo][tamanio] !== undefined
                        ? datos[provincia][tipo][tamanio]
                        : 0
                );
            });

            totalTipoTamanio[label] = tamanioCantidad[label].reduce((a, b) => a + Number(b || 0), 0);
        });

        combinacionesTamanio.forEach(({ tipo, label }) => {
            tamanioPorcentaje[label] = provincias.map((provincia, index) => {
                const total = totalProvinciaTipo[`${provincia}||${tipo}`] || 0;
                return total > 0 ? (tamanioCantidad[label][index] / total) * 100 : 0;
            });
        });

        return {
            provincias,
            tipos,
            tamanios,
            datos,
            totalProvincia,
            totalProvinciaTipo,
            totalTipo,
            totalTipoTamanio,
            totalGeneral,
            generalCantidad,
            generalPorcentaje,
            combinacionesTamanio,
            tamanioCantidad,
            tamanioPorcentaje
        };
    },

    definicionHoja(tipoGrafico, resumen) {
        const facetasTamanio = (valores, colorPorTamanio = false) => {
            const facetas = [];

            resumen.tipos.forEach(tipo => {
                resumen.combinacionesTamanio
                    .filter(item => item.tipo === tipo)
                    .forEach(item => {
                        const color = colorPorTamanio
                            ? ((this.coloresTamanio[tipo] && this.coloresTamanio[tipo][item.tamanio]) || this.paleta[0])
                            : (this.coloresTipo[tipo] || this.paleta[0]);

                        facetas.push({
                            label: item.tamanio,
                            valores: valores[item.label] || [],
                            grupo: tipo,
                            tipo,
                            tamanio: item.tamanio,
                            color
                        });
                    });
            });

            return facetas;
        };

        const definiciones = {
            PorcGeneralcant: {
                titulo: 'Cantidades generales',
                subtitulo: 'Cantidad por provincia y tipo de establecimiento',
                tipoValor: 'cantidad',
                esTamanio: false,
                agrupar: false,
                facetas: resumen.tipos.map(tipo => ({
                    label: tipo,
                    valores: resumen.generalCantidad[tipo] || [],
                    tipo,
                    tamanio: '',
                    color: this.coloresTipo[tipo] || this.paleta[0]
                }))
            },
            PorcGeneral: {
                titulo: 'Porcentaje general',
                subtitulo: 'Participación de cada provincia dentro de su tipo de establecimiento',
                tipoValor: 'porcentaje',
                esTamanio: false,
                agrupar: false,
                facetas: resumen.tipos.map(tipo => ({
                    label: tipo,
                    valores: resumen.generalPorcentaje[tipo] || [],
                    tipo,
                    tamanio: '',
                    color: this.coloresTipo[tipo] || this.paleta[0]
                }))
            },
            PorTipoEstableCant: {
                titulo: 'Cantidades por tamaño',
                subtitulo: 'Cantidad por provincia, tipo de establecimiento y tamaño',
                tipoValor: 'cantidad',
                esTamanio: true,
                agrupar: true,
                facetas: facetasTamanio(resumen.tamanioCantidad, false)
            },
            PorTipoEstable: {
                titulo: 'Porcentaje por tamaño',
                subtitulo: 'Participación de cada tamaño dentro de la provincia y tipo de establecimiento',
                tipoValor: 'porcentaje',
                esTamanio: true,
                agrupar: true,
                facetas: facetasTamanio(resumen.tamanioPorcentaje, false)
            },
            BarraPorcGeneraltam: {
                titulo: 'Cantidades generales',
                subtitulo: 'Cantidad por provincia, tamaño y tipo de establecimiento',
                tipoValor: 'cantidad',
                esTamanio: true,
                agrupar: true,
                facetas: facetasTamanio(resumen.tamanioCantidad, true)
            }
        };

        return definiciones[tipoGrafico] || definiciones.PorcGeneralcant;
    },

    renderHojaBarras(contenedor, tipoGrafico, resumen, height = 360) {
        if (!contenedor) return [];

        const definicion = this.definicionHoja(tipoGrafico, resumen);
        const prefix = `tiendas-facet-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const facetas = definicion.facetas.map((faceta, index) => ({
            ...faceta,
            canvasId: `${prefix}-${index}`
        }));

        const facetHtml = (faceta, minWidth) => `
            <div class="min-w-[${minWidth}px] flex-1">
                <p class="text-[13px] font-bold text-slate-600 mb-1 truncate" title="${this.escapeHtml(faceta.label)}">
                    ${this.escapeHtml(faceta.label)}
                </p>
                <div class="relative" style="height:${height}px">
                    <canvas id="${faceta.canvasId}"></canvas>
                </div>
            </div>
        `;

        let facetasHtml = '';

        if (definicion.agrupar) {
            const grupos = [];
            facetas.forEach(faceta => {
                if (!grupos.includes(faceta.grupo)) grupos.push(faceta.grupo);
            });

            facetasHtml = `
                <div class="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                    ${grupos.map(grupo => `
                        <div class="min-w-[600px] flex-1">
                            <p class="text-[13px] font-bold text-slate-700 text-center mb-2">${this.escapeHtml(grupo)}</p>
                            <div class="flex gap-3">
                                ${facetas.filter(faceta => faceta.grupo === grupo).map(faceta => facetHtml(faceta, 190)).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            facetasHtml = `
                <div class="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                    ${facetas.map(faceta => facetHtml(faceta, 300)).join('')}
                </div>
            `;
        }

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden h-full">
                <div class="px-4 py-3 border-b border-slate-200">
                    <h3 class="text-sm font-bold text-slate-800">${this.escapeHtml(definicion.titulo)}</h3>
                    <p class="text-[11px] text-slate-400 mt-0.5">${this.escapeHtml(definicion.subtitulo)}</p>
                </div>
                <div class="p-3 sm:p-4">
                    ${facetasHtml}
                </div>
            </div>
        `;

        const charts = [];

        facetas.forEach(faceta => {
            const chart = this.crearGraficoBarras(
                faceta.canvasId,
                resumen.provincias,
                [faceta.label],
                { [faceta.label]: faceta.valores },
                definicion.tipoValor,
                definicion.esTamanio,
                {
                    showLegend: false,
                    color: faceta.color,
                    tooltip: {
                        tipoEstablecimiento: faceta.tipo || faceta.grupo || faceta.label,
                        tamanio: faceta.tamanio || ''
                    }
                }
            );
            if (chart) charts.push(chart);
        });

        return charts;
    },

    renderBarraGeneraltam(contenedor, resumen, height = 620) {
        if (!contenedor) return [];

        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }

        const provincias = resumen.provincias.filter(provincia => Number(resumen.totalProvincia[provincia] || 0) > 0);
        const ordenTamanios = ['Grande', 'Mediano', 'Chico'];
        const tamanios = ordenTamanios
            .filter(tamanio => resumen.tamanios.includes(tamanio))
            .concat(resumen.tamanios.filter(tamanio => !ordenTamanios.includes(tamanio)));
        const ordenTipos = ['Puesto de mercado', 'Tienda y puesto aledaño'];
        const tipos = ordenTipos
            .filter(tipo => resumen.tipos.includes(tipo))
            .concat(resumen.tipos.filter(tipo => !ordenTipos.includes(tipo)));

        if (provincias.length === 0 || tamanios.length === 0 || tipos.length === 0) {
            contenedor.innerHTML = '<div class="p-10 text-center text-slate-400 font-medium">No hay datos para los filtros seleccionados.</div>';
            return [];
        }

        const categorias = [];
        provincias.forEach(provincia => {
            tamanios.forEach(tamanio => {
                categorias.push({
                    provincia,
                    tamanio,
                    label: `${provincia} · ${tamanio}`
                });
            });
        });

        let maxValor = 0;
        tipos.forEach(tipo => {
            categorias.forEach(categoria => {
                const valor = this.valorCategoriaBarra(resumen, categoria, tipo);
                if (valor > maxValor) maxValor = valor;
            });
        });

        const paso = maxValor <= 20 ? 5 : maxValor <= 50 ? 10 : maxValor <= 100 ? 25 : 50;
        const maxEscala = Math.max(paso, Math.ceil(maxValor / paso) * paso);

        const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
        const altoGrafico = Math.max(height, categorias.length * 28 + 92);
        const prefijo = `tiendas-barra-generaltam-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const leyenda = tamanios.map(tamanio => `
            <span class="inline-flex items-center gap-1">
                <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background:${this.coloresTamanioSimple[tamanio] || '#94a3b8'}"></span>
                ${this.escapeHtml(tamanio)}
            </span>
        `).join('');

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden h-full">
                <div class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">Cantidades generales</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">Cantidad por provincia, tamaño y tipo de establecimiento</p>
                    </div>
                    <div class="flex items-center gap-3 text-[10px] font-semibold text-slate-500">${leyenda}</div>
                </div>
                <div class="p-3 sm:p-4">
                    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        ${tipos.map((tipo, index) => `
                            <div class="min-w-0">
                                <div class="relative" style="height:${altoGrafico}px">
                                    <canvas id="${prefijo}-${index}"></canvas>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        const charts = [];

        tipos.forEach((tipo, index) => {
            const canvas = document.getElementById(`${prefijo}-${index}`);
            if (!canvas) return;

            const valores = categorias.map(categoria => this.valorCategoriaBarra(resumen, categoria, tipo));
            const colores = categorias.map(categoria => this.coloresTamanioSimple[categoria.tamanio] || '#94a3b8');

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: categorias.map(categoria => categoria.label),
                    datasets: [{
                        label: tipo,
                        data: valores,
                        backgroundColor: colores,
                        borderColor: colores,
                        borderWidth: 1,
                        borderRadius: 3,
                        maxBarThickness: 16
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                    animation: { duration: 250 },
                    layout: { padding: { top: 4, right: 44, bottom: 2, left: 2 } },
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: tipo,
                            color: '#334155',
                            font: { size: 12, weight: '700' },
                            padding: { top: 2, bottom: 8 }
                        },
                        tooltip: {
                            enabled: false,
                            external: (context) => this.mostrarTooltipBarraGeneraltam(context, categorias, tipo, nf)
                        },
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'right',
                            offset: 2,
                            clamp: true,
                            color: '#475569',
                            font: { size: 10.5, weight: '600' },
                            formatter: (value) => {
                                const numero = Number(value) || 0;
                                return numero ? nf.format(numero) : '';
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: maxEscala,
                            grid: {
                                color: 'rgba(148, 163, 184, 0.24)',
                                drawTicks: false
                            },
                            border: { display: false },
                            ticks: {
                                color: '#64748b',
                                font: { size: 10.5 },
                                callback: (value) => nf.format(value)
                            }
                        },
                        y: {
                            display: true,
                            grid: { display: false },
                            border: { display: false },
                            afterFit: (scale) => { scale.width = 180; },
                            ticks: {
                                display: index === 0,
                                color: '#334155',
                                font: { size: 10.5, weight: '600' },
                                autoSkip: false
                            }
                        }
                    }
                }
            });

            charts.push(chart);
        });

        return charts;
    },

    valorCategoriaBarra(resumen, categoria, tipo) {
        const porTipo = resumen.datos && resumen.datos[categoria.provincia]
            ? resumen.datos[categoria.provincia][tipo]
            : null;
        const valor = porTipo ? porTipo[categoria.tamanio] : 0;
        return Number(valor || 0);
    },

    mostrarTooltipBarraGeneraltam(context, categorias, tipo, nf) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const categoria = categorias[punto.dataIndex] || {};
        const valor = Number(punto.parsed && punto.parsed.x) || 0;

        const filas = [
            ['nombre (com_provincia):', categoria.provincia || ''],
            ['tamanio:', categoria.tamanio || ''],
            ['tipoEstablecimiento:', tipo],
            ['cantidad:', nf.format(valor)]
        ];

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 20px; align-items:start;">
                ${filas.map(([etiqueta, valorCampo]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valorCampo)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';
        this.posicionarTooltipGrafico(context.chart, tooltip, tooltipEl);
    },

    crearCardHtml(canvasId, titulo, subtitulo, height = 430) {
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-200">
                    <h3 class="text-sm font-bold text-slate-800">${this.escapeHtml(titulo)}</h3>
                    <p class="text-[11px] text-slate-400 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                </div>
                <div class="p-3 sm:p-4 overflow-x-auto custom-scrollbar">
                    <div class="relative min-w-[520px]" style="height:${height}px">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        `;
    },

    obtenerTooltipEl() {
        let tooltipEl = document.getElementById('tiendas-mercados-tooltip');

        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'tiendas-mercados-tooltip';
            tooltipEl.style.position = 'fixed';
            tooltipEl.style.pointerEvents = 'none';
            tooltipEl.style.zIndex = '9999';
            tooltipEl.style.opacity = '0';
            tooltipEl.style.transition = 'opacity 0.1s ease';
            tooltipEl.style.background = '#ffffff';
            tooltipEl.style.border = '1px solid #cbd5e1';
            tooltipEl.style.borderRadius = '4px';
            tooltipEl.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.16)';
            tooltipEl.style.padding = '11px 14px';
            tooltipEl.style.color = '#334155';
            tooltipEl.style.fontFamily = '"Segoe UI", sans-serif';
            tooltipEl.style.fontSize = '13px';
            tooltipEl.style.lineHeight = '1.55';
            document.body.appendChild(tooltipEl);
        }

        if (!this._tooltipScrollBound) {
            this._tooltipScrollBound = true;
            document.addEventListener('scroll', () => this.ocultarTooltip(), { capture: true, passive: true });
        }

        return tooltipEl;
    },

    ocultarTooltip() {
        const tooltipEl = document.getElementById('tiendas-mercados-tooltip');
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    },

    mostrarTooltipGrafico(context, tipoValor, opciones, nfEntero, nfPorcentaje) {
        const tooltipEl = this.obtenerTooltipEl();
        const tooltip = context.tooltip;
        const punto = tooltip.dataPoints && tooltip.dataPoints[0];

        if (!punto || tooltip.opacity === 0) {
            this.ocultarTooltip();
            return;
        }

        const chart = context.chart;
        const provincia = String((chart.data.labels && chart.data.labels[punto.dataIndex]) || '');
        const datasetLabel = String(punto.dataset && punto.dataset.label ? punto.dataset.label : '');
        let tipo = opciones && opciones.tooltip ? String(opciones.tooltip.tipoEstablecimiento || '') : '';
        let tamanio = opciones && opciones.tooltip ? String(opciones.tooltip.tamanio || '') : '';

        if (!tipo) {
            const partes = datasetLabel.split(' · ');
            tipo = partes[0] || '';
            tamanio = partes.length > 1 ? partes[1] : '';
        }

        const valor = Number(punto.parsed && punto.parsed.x) || 0;
        const esPorcentaje = tipoValor === 'porcentaje';
        const etiquetaValor = esPorcentaje
            ? (tamanio ? '% de total cantidad junto con tamanio' : '% de total cantidad')
            : 'cantidad';
        const valorTexto = esPorcentaje
            ? `${nfPorcentaje.format(valor)}%`
            : nfEntero.format(valor);

        const filas = [
            ['nombre (com_provincia):', provincia]
        ];

        if (tamanio) {
            filas.push(['tamanio:', tamanio]);
        }

        filas.push(['tipoEstablecimiento:', tipo]);
        filas.push([`${etiquetaValor}:`, valorTexto]);

        tooltipEl.innerHTML = `
            <div style="display:grid; grid-template-columns:auto minmax(120px, 1fr); gap:6px 20px; align-items:start;">
                ${filas.map(([etiqueta, valorCampo]) => `
                    <span style="color:#64748b;">${this.escapeHtml(etiqueta)}</span>
                    <span style="font-weight:700; color:#0f172a; text-align:right; white-space:nowrap;">${this.escapeHtml(valorCampo)}</span>
                `).join('')}
            </div>
        `;

        tooltipEl.style.opacity = '1';
        this.posicionarTooltipGrafico(chart, tooltip, tooltipEl);
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

    crearGraficoBarras(canvasId, labels, seriesLabels, datasetValues, tipoValor, esTamanio, opciones = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === 'undefined') return null;

        if (typeof ChartDataLabels !== 'undefined' && (!Chart.registry || !Chart.registry.plugins || !Chart.registry.plugins.get('datalabels'))) {
            Chart.register(ChartDataLabels);
        }

        const esPorcentaje = tipoValor === 'porcentaje';

        const datasets = seriesLabels.map((label, index) => {
            let color = opciones.color || null;
            if (!color) {
                if (esTamanio) {
                    const partes = String(label).split(' · ');
                    const tipo = partes[0];
                    const tamanio = partes[1];
                    color = (this.coloresTamanio[tipo] && this.coloresTamanio[tipo][tamanio])
                        || this.paleta[index % this.paleta.length];
                } else {
                    color = this.coloresTipo[label] || this.paleta[index % this.paleta.length];
                }
            }

            return {
                label,
                data: datasetValues[label] || [],
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1,
                borderRadius: 3,
                maxBarThickness: esTamanio ? 12 : 22
            };
        });

        const nfEntero = new Intl.NumberFormat('de-DE', {
            maximumFractionDigits: 0
        });
        const nfPorcentaje = new Intl.NumberFormat('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        return new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
                animation: { duration: 250 },
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                layout: {
                    padding: { top: 8, right: 42, bottom: 4, left: 4 }
                },
                plugins: {
                    legend: {
                        display: opciones.showLegend !== false,
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            boxWidth: 9,
                            boxHeight: 9,
                            padding: 10,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        enabled: false,
                        external: (context) => this.mostrarTooltipGrafico(
                            context,
                            tipoValor,
                            opciones,
                            nfEntero,
                            nfPorcentaje
                        )
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'right',
                        offset: 2,
                        clamp: true,
                        color: '#475569',
                        font: { size: 12, weight: '600' },
                        formatter: (value) => {
                            const numero = Number(value) || 0;
                            if (!numero) return '';
                            return esPorcentaje ? `${nfPorcentaje.format(numero)}%` : nfEntero.format(numero);
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: esPorcentaje ? 100 : undefined,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.24)',
                            drawTicks: false
                        },
                        border: { display: false },
                        ticks: {
                            color: '#475569',
                            font: { size: 11.5 },
                            callback: (value) => esPorcentaje ? `${nfEntero.format(value)}%` : nfEntero.format(value)
                        }
                    },
                    y: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#334155',
                            font: { size: 12.5, weight: '600' },
                            autoSkip: false
                        }
                    }
                }
            }
        });
    },

    formatearPeriodo(fechaInicio, fechaFin) {
        if (!fechaInicio || !fechaFin) return 'Rango seleccionado';
        const inicio = String(fechaInicio).split('-');
        const fin = String(fechaFin).split('-');
        if (inicio.length !== 3 || fin.length !== 3) return `${fechaInicio} al ${fechaFin}`;
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
    }
};
