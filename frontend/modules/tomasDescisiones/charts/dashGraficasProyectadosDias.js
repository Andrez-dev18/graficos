window.DashGraficasProyectadosDiasView = {
    charts: [],
    observers: [],

    DIAS: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],

    METRICAS: [
        {
            key: 'cantidad',
            titulo: 'COMPARATIVOS DE CANTIDADES',
            etiquetas: ['Cantidad Proyectada', 'Cantidad Real'],
            difTitulo: 'DifCantidad',
            colores: { proyectado: '#e15759', real: '#76b7b2', diferencia: '#edc948' },
            formatoProyectado: 'entero',
            formatoReal: 'entero',
            formatoDiferencia: 'entero',
            formatoEje: 'entero',
            formatoEjeDiferencia: 'entero'
        },
        {
            key: 'precio',
            titulo: 'COMPARATIVOS DE PRECIOS',
            etiquetas: ['Precio Proyectado', 'Precio Real'],
            difTitulo: 'DifPrecio',
            colores: { proyectado: '#9c755f', real: '#bab0ac', diferencia: '#76b7b2' },
            formatoProyectado: 'moneda2',
            formatoReal: 'moneda2',
            formatoDiferencia: 'numero3',
            formatoEje: 'numero2',
            formatoEjeDiferencia: 'numero3'
        },
        {
            key: 'pesoProm',
            titulo: 'COMPARATIVOS DE PESOS PROMEDIOS',
            etiquetas: ['Peso Prom. Proyectado', 'Peso Prom. Real'],
            difTitulo: 'DifPesoProm',
            colores: { proyectado: '#b07aa1', real: '#ff9da7', diferencia: '#e15759' },
            formatoProyectado: 'numero3',
            formatoReal: 'numero3',
            formatoDiferencia: 'numero3',
            formatoEje: 'numero3',
            formatoEjeDiferencia: 'numero3'
        },
        {
            key: 'importe',
            titulo: 'COMPARATIVOS DE IMPORTE',
            etiquetas: ['Venta Proyectada', 'Venta Real'],
            difTitulo: 'Diferencia',
            colores: { proyectado: '#e15759', real: '#59a14f', diferencia: '#76b7b2' },
            formatoProyectado: 'numero0',
            formatoReal: 'numero0',
            formatoDiferencia: 'numero0',
            formatoEje: 'numero0',
            formatoEjeDiferencia: 'numero0'
        }
    ],

    render(contenedor, payload) {
        if (!contenedor) return;

        this.destroy();

        const grupos = payload && Array.isArray(payload.grupos) ? payload.grupos : [];

        if (!grupos.length) {
            contenedor.innerHTML = `
                <div class="dash-card p-10 text-center text-slate-400 font-medium">
                    No se encontraron datos para la selección realizada.
                </div>
            `;
            return;
        }

        const paneles = this.agruparPaneles(grupos);
        const procesos = Array.from(new Set(paneles.map(panel => panel.proceso)));
        const semanas = Array.from(new Set(paneles.map(panel => panel.semana)));
        const grupoTexto = `${procesos.join(' · ')} · ${semanas.length === 1 ? `Semana ${semanas[0]}` : `${semanas.length} semanas`}`;
        const mostrarTituloPanel = paneles.length > 1;

        contenedor.innerHTML = `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                ${this.METRICAS.map(metrica => `
                    <section class="dash-card p-3 flex flex-col min-w-0">
                        <h3 class="text-center text-[15px] font-bold uppercase tracking-wide text-slate-900 underline underline-offset-4">
                            ${metrica.titulo}
                        </h3>
                        <div class="mt-1 text-center text-[11px] text-slate-500">proceso / semana / Día de fecha</div>
                        <div class="text-center text-[11px] font-semibold text-slate-700">${grupoTexto}</div>
                        <div class="gp-dias-paneles custom-scrollbar relative mt-1 overflow-x-auto overflow-y-hidden" data-metrica="${metrica.key}">
                            <div class="flex gap-4 w-max items-start">
                                ${paneles.map((panel, indice) => `
                                    <div class="gp-dias-panel shrink-0" data-metrica="${metrica.key}" data-panel="${indice}" style="width:${this.anchoPanel(panel)}px;">
                                        ${mostrarTituloPanel ? `
                                            <div class="text-left text-[11px] font-semibold text-slate-700 mb-1 px-1">
                                                ${this.esc(panel.proceso)} / Semana ${this.esc(panel.semana)}
                                            </div>
                                        ` : ''}
                                        <div class="relative" style="height:430px;">
                                            <canvas id="gpd-${metrica.key}-${indice}"></canvas>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </section>
                `).join('')}
            </div>
        `;

        if (typeof Chart === 'undefined') {
            contenedor.innerHTML = `
                <div class="dash-card p-10 text-center text-rose-700 font-semibold">
                    No se pudo cargar Chart.js para dibujar las gráficas.
                </div>
            `;
            return;
        }

        if (typeof ChartDataLabels !== 'undefined' && !Chart.registry.plugins.get('datalabels')) {
            Chart.register(ChartDataLabels);
        }

        Chart.defaults.devicePixelRatio = Math.max(window.devicePixelRatio || 1, 3);

        this.charts = [];
        this.observers = [];
        this.prepararPaneles(contenedor, paneles);
    },

    agruparPaneles(grupos) {
        const mapa = new Map();

        grupos.forEach(grupo => {
            const clave = `${grupo.semana}|${grupo.proceso}`;
            if (!mapa.has(clave)) {
                mapa.set(clave, {
                    semana: String(grupo.semana),
                    proceso: String(grupo.proceso),
                    grupos: []
                });
            }
            mapa.get(clave).grupos.push(grupo);
        });

        return Array.from(mapa.values());
    },

    anchoPanel(panel) {
        return Math.max(600, panel.grupos.length * 230);
    },

    prepararPaneles(contenedor, paneles) {
        contenedor.querySelectorAll('.gp-dias-paneles').forEach(scroll => {
            const metrica = this.METRICAS.find(item => item.key === scroll.dataset.metrica);
            if (!metrica) return;

            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    const elemento = entry.target;
                    const indice = Number(elemento.dataset.panel);
                    const panel = paneles[indice];
                    if (!panel) return;

                    if (entry.isIntersecting) {
                        this.renderPanel(elemento, panel, metrica);
                    } else {
                        this.destruirPanel(elemento);
                    }
                });
            }, {
                root: scroll,
                rootMargin: '0px 700px 0px 700px',
                threshold: 0.01
            });

            scroll.querySelectorAll('.gp-dias-panel').forEach(elemento => observer.observe(elemento));
            this.observers.push(observer);
        });
    },

    renderPanel(elemento, panel, metrica) {
        if (elemento._chart) return;

        const canvas = elemento.querySelector('canvas');
        if (!canvas) return;

        try {
            elemento._chart = this.crearGrafico(canvas, panel.grupos, metrica);
        } catch (error) {
            console.error('Error al renderizar panel diario:', error);
        }
    },

    destruirPanel(elemento) {
        if (!elemento._chart) return;

        const indice = this.charts.indexOf(elemento._chart);
        if (indice >= 0) this.charts.splice(indice, 1);

        try { elemento._chart.destroy(); } catch (e) { }
        elemento._chart = null;
    },

    crearGrafico(canvas, grupos, metrica) {
        const labels = [];
        const dataProyectado = [];
        const dataReal = [];
        const dataDiferencia = [];
        const nombresEje = [metrica.etiquetas[0], metrica.etiquetas[1], metrica.difTitulo];

        grupos.forEach((grupo, indice) => {
            const base = indice * 3;
            labels.push(`__p_${indice}`, `__r_${indice}`, `__d_${indice}`);
            dataProyectado[base] = this.valor(grupo[metrica.key].proyectado);
            dataReal[base + 1] = this.valor(grupo[metrica.key].real);
            dataDiferencia.push({
                x: `__d_${indice}`,
                y: this.valor(grupo[metrica.key].diferencia)
            });
        });

        for (let i = 0; i < grupos.length * 3; i++) {
            if (dataProyectado[i] === undefined) dataProyectado[i] = null;
            if (dataReal[i] === undefined) dataReal[i] = null;
        }

        const valores = [...dataProyectado, ...dataReal].filter(v => v !== null);
        const limites = this.limites(valores);
        const diferencias = dataDiferencia.map(punto => punto.y).filter(v => v !== null);
        const limitesDiferencia = this.limitesDiferencia(diferencias);

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            plugins: [
                {
                    id: 'fechasDias',
                    afterDraw: (chart) => this.dibujarFechas(chart, grupos)
                }
            ],
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: metrica.etiquetas[0],
                        data: dataProyectado,
                        yAxisID: 'y',
                        backgroundColor: metrica.colores.proyectado,
                        borderColor: metrica.colores.proyectado,
                        borderWidth: 0,
                        barPercentage: 0.72,
                        categoryPercentage: 0.9,
                        maxBarThickness: 46,
                        datalabels: this.etiquetasDatos(metrica.formatoProyectado)
                    },
                    {
                        type: 'bar',
                        label: metrica.etiquetas[1],
                        data: dataReal,
                        yAxisID: 'y',
                        backgroundColor: metrica.colores.real,
                        borderColor: metrica.colores.real,
                        borderWidth: 0,
                        barPercentage: 0.72,
                        categoryPercentage: 0.9,
                        maxBarThickness: 46,
                        datalabels: this.etiquetasDatos(metrica.formatoReal)
                    },
                    {
                        type: 'scatter',
                        label: metrica.difTitulo,
                        data: dataDiferencia,
                        yAxisID: 'y1',
                        backgroundColor: metrica.colores.diferencia,
                        borderColor: metrica.colores.diferencia,
                        pointStyle: 'rect',
                        pointRadius: 8,
                        pointHoverRadius: 10,
                        showLine: false,
                        datalabels: this.etiquetasDiferencia(metrica.formatoDiferencia)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                layout: {
                    padding: { top: 60, right: 30, left: 0, bottom: 0 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#cbd5e1',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        boxWidth: 10,
                        boxHeight: 10,
                        usePointStyle: true,
                        titleFont: { size: 12, weight: '600' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                const indice = items[0].dataIndex;
                                const grupo = grupos[Math.floor(indice / 3)];
                                const medida = nombresEje[indice % 3];
                                return grupo ? `${this.fechaLarga(grupo.fecha)} · ${medida}` : medida;
                            },
                            label: (context) => {
                                const valor = context.parsed.y;
                                if (valor === null || valor === undefined) return null;
                                const formato = context.dataset.yAxisID === 'y1'
                                    ? metrica.formatoDiferencia
                                    : (context.datasetIndex === 0 ? metrica.formatoProyectado : metrica.formatoReal);
                                return ` ${context.dataset.label}: ${this.formatear(valor, formato)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 90,
                            minRotation: 90,
                            padding: 8,
                            color: '#334155',
                            font: { size: 10 },
                            callback: (value, index) => nombresEje[index % 3]
                        }
                    },
                    y: {
                        position: 'left',
                        beginAtZero: false,
                        min: limites.min,
                        max: limites.max,
                        grid: { color: '#e2e8f0' },
                        border: { display: false },
                        title: {
                            display: true,
                            text: 'Valor',
                            color: '#334155',
                            font: { size: 11, weight: '600' }
                        },
                        ticks: {
                            color: '#334155',
                            font: { size: 10 },
                            callback: (value) => this.formatear(value, metrica.formatoEje)
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: false,
                        min: limitesDiferencia.min,
                        max: limitesDiferencia.max,
                        grid: { display: false },
                        border: { display: false },
                        title: {
                            display: true,
                            text: metrica.difTitulo,
                            color: '#334155',
                            font: { size: 11, weight: '600' }
                        },
                        ticks: {
                            color: '#334155',
                            font: { size: 10 },
                            callback: (value) => this.formatear(value, metrica.formatoEjeDiferencia)
                        }
                    }
                }
            }
        });

        this.charts.push(chart);
        return chart;
    },

    dibujarFechas(chart, grupos) {
        const x = chart.scales.x;
        if (!x) return;

        const area = chart.chartArea;
        const ctx = chart.ctx;
        const alto = 34;
        const top = area.top - alto;
        const anchoCategoria = Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) || 1;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(area.left, top, area.width, alto);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(area.left, area.top);
        ctx.lineTo(area.right, area.top);
        ctx.stroke();

        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        grupos.forEach((grupo, indice) => {
            const centro = x.getPixelForValue(indice * 3 + 1);
            const texto = this.fechaLarga(grupo.fecha);
            ctx.fillText(texto, centro, top + alto / 2);

            const borde = x.getPixelForValue(indice * 3) - anchoCategoria / 2;
            ctx.beginPath();
            ctx.moveTo(borde, top);
            ctx.lineTo(borde, area.bottom);
            ctx.stroke();
        });

        const bordeFinal = x.getPixelForValue((grupos.length - 1) * 3) + anchoCategoria * 1.5;
        ctx.beginPath();
        ctx.moveTo(bordeFinal, top);
        ctx.lineTo(bordeFinal, area.bottom);
        ctx.stroke();

        ctx.restore();
    },

    etiquetasDiferencia(formato) {
        return {
            display: (context) => {
                const valor = context.dataset.data[context.dataIndex];
                return valor && valor.y !== null && valor.y !== undefined;
            },
            formatter: (value) => this.formatear(value.y, formato),
            color: '#111827',
            anchor: 'end',
            align: 'top',
            offset: 6,
            clip: false,
            font: { size: 10, weight: '600' }
        };
    },

    etiquetasDatos(formato) {
        return {
            display: (context) => {
                const valor = context.dataset.data[context.dataIndex];
                return valor !== null && valor !== undefined;
            },
            formatter: (value) => this.formatear(value, formato),
            color: '#111827',
            anchor: 'end',
            align: 'top',
            offset: 3,
            clip: false,
            font: { size: 10, weight: '600' }
        };
    },

    limites(valores) {
        const limpios = valores.filter(valor => valor !== null && valor !== undefined && isFinite(valor));
        if (!limpios.length) return { min: 0, max: 1 };

        let min = Math.min(...limpios);
        let max = Math.max(...limpios);
        let rango = max - min;

        if (rango === 0) rango = Math.abs(max) || 1;

        const margen = rango * 0.18;
        return { min: min - margen, max: max + margen };
    },

    limitesDiferencia(valores) {
        const limpios = valores.filter(valor => valor !== null && valor !== undefined && isFinite(valor));
        if (!limpios.length) return { min: -1, max: 1 };

        let min = Math.min(0, ...limpios);
        let max = Math.max(0, ...limpios);
        let rango = max - min;

        if (rango === 0) rango = 1;

        const margen = rango * 0.18;
        if (min < 0) min -= margen;
        if (max > 0) max += margen;

        return { min, max };
    },

    valor(valor) {
        if (valor === null || valor === undefined || valor === '') return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    },

    formatear(valor, formato) {
        if (valor === null || valor === undefined || valor === '') return '';

        switch (formato) {
            case 'entero':
            case 'numero0':
                return this.numero(valor, 0);
            case 'numero2':
                return this.numero(valor, 2);
            case 'numero3':
                return this.numero(valor, 3);
            case 'moneda2':
                return `S/ ${this.numero(valor, 2)}`;
            default:
                return this.numero(valor, 2);
        }
    },

    numero(valor, decimales) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return Number(valor).toLocaleString('de-DE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    fechaLarga(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-').map(Number);
        if (partes.length !== 3 || !partes[0]) return String(fecha);

        const [anio, mes, dia] = partes;
        const date = new Date(anio, mes - 1, dia);
        return `${this.DIAS[date.getDay()]}, ${dia} de ${this.MESES[mes - 1]} de ${anio}`;
    },

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    destroy() {
        this.observers.forEach(observer => {
            try { observer.disconnect(); } catch (e) { }
        });
        this.observers = [];

        this.charts.forEach(chart => {
            try { chart.destroy(); } catch (e) { }
        });
        this.charts = [];
    }
};
