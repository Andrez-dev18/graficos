window.DashGraficasProyectadosVSRealView = {
    charts: [],

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
            formatoEjeDiferencia: 'entero',
            altura: 360
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
            formatoEjeDiferencia: 'numero3',
            altura: 360
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
            formatoEjeDiferencia: 'numero3',
            altura: 760
        },
        {
            key: 'peso',
            titulo: 'COMPARATIVOS DE PESOS',
            etiquetas: ['Peso Proyectado', 'Peso Real'],
            difTitulo: 'DifPeso',
            colores: { proyectado: '#4e79a7', real: '#f28e2b', diferencia: '#59a14f' },
            formatoProyectado: 'numero2',
            formatoReal: 'numero2',
            formatoDiferencia: 'numero2',
            formatoEje: 'numero0',
            formatoEjeDiferencia: 'numero0',
            altura: 360
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
            formatoEjeDiferencia: 'numero0',
            altura: 360
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

        const grupoTexto = grupos
            .map(grupo => `${this.esc(grupo.proceso)} / Semana ${this.esc(grupo.semana)}`)
            .join(' · ');
        const anchoMinimo = grupos.length > 1 ? Math.max(560, grupos.length * 320) : 0;

        contenedor.innerHTML = `
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
                ${this.METRICAS.map(metrica => `
                    <section class="dash-card p-3 flex flex-col min-w-0 ${metrica.key === 'pesoProm' ? 'xl:row-span-2' : ''}">
                        <h3 class="text-center text-[15px] font-bold uppercase tracking-wide text-slate-900 underline underline-offset-4">
                            ${metrica.titulo}
                        </h3>
                        <div class="mt-1 text-center text-[11px] text-slate-500">proceso / semana</div>
                        <div class="text-center text-[11px] font-semibold text-slate-700">${grupoTexto}</div>
                        <div class="gp-chart-scroll custom-scrollbar relative mt-1 overflow-x-auto overflow-y-hidden">
                            <div class="relative" style="height:${metrica.altura}px;width:${anchoMinimo ? anchoMinimo + 'px' : '100%'};">
                                <canvas id="gp-chart-${metrica.key}"></canvas>
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
        this.METRICAS.forEach(metrica => {
            const canvas = contenedor.querySelector(`#gp-chart-${metrica.key}`);
            if (canvas) this.crearGrafico(canvas, grupos, metrica);
        });
    },

    crearGrafico(canvas, grupos, metrica) {
        const labels = [];
        const dataProyectado = [];
        const dataReal = [];
        const dataDiferencia = [];
        const esMultiple = grupos.length > 1;
        const etiquetaProyectado = esMultiple ? 'Proyectado' : metrica.etiquetas[0];
        const etiquetaReal = esMultiple ? 'Real' : metrica.etiquetas[1];

        grupos.forEach((grupo, indice) => {
            const base = indice * 3;
            const etiquetaDiferencia = `__dif_${indice}`;
            labels.push(etiquetaProyectado, etiquetaReal, etiquetaDiferencia);
            dataProyectado[base] = this.valor(grupo[metrica.key].proyectado);
            dataReal[base + 1] = this.valor(grupo[metrica.key].real);
            dataDiferencia.push({
                x: etiquetaDiferencia,
                y: this.valor(grupo[metrica.key].diferencia)
            });
        });

        for (let i = 0; i < grupos.length * 3; i++) {
            if (dataProyectado[i] === undefined) dataProyectado[i] = null;
            if (dataReal[i] === undefined) dataReal[i] = null;
        }

        const valores = [...dataProyectado, ...dataReal].filter(v => v !== null);
        let limites = this.limites(valores);

        if (esMultiple && ['cantidad', 'peso', 'importe'].includes(metrica.key)) {
            const maximo = Math.max(...valores);
            limites = { min: 0, max: maximo * 1.08 };
        }

        const diferencias = dataDiferencia.map(punto => punto.y).filter(v => v !== null);
        const limitesDiferencia = this.limitesDiferencia(diferencias);

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
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
                        maxBarThickness: 52,
                        datalabels: this.etiquetasDatos(
                            metrica.colores.proyectado,
                            metrica.formatoProyectado
                        )
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
                        maxBarThickness: 52,
                        datalabels: this.etiquetasDatos(
                            metrica.colores.real,
                            metrica.formatoReal
                        )
                    },
                    {
                        type: 'scatter',
                        label: metrica.difTitulo,
                        data: dataDiferencia,
                        yAxisID: 'y1',
                        backgroundColor: metrica.colores.diferencia,
                        borderColor: metrica.colores.diferencia,
                        pointStyle: 'rect',
                        pointRadius: 9,
                        pointHoverRadius: 11,
                        showLine: false,
                        datalabels: this.etiquetasDiferencia(
                            metrica.colores.diferencia,
                            metrica.formatoDiferencia
                        )
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
                    padding: { top: 30, right: 8, left: 0, bottom: 0 }
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
                            maxRotation: 0,
                            minRotation: 0,
                            padding: 6,
                            color: '#334155',
                            font: { size: 10 },
                            callback: (value, index) => {
                                const etiqueta = labels[index] || '';
                                return etiqueta.indexOf('__dif_') === 0 ? '' : etiqueta;
                            }
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
    },

    etiquetasDatos(color, formato) {
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

    etiquetasDiferencia(color, formato) {
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

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    leyendasHTML() {
        return this.METRICAS.map(metrica => `
            <div class="space-y-1">
                <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400">${metrica.titulo}</p>
                ${this.itemLeyenda(metrica.colores.proyectado, metrica.etiquetas[0])}
                ${this.itemLeyenda(metrica.colores.real, metrica.etiquetas[1])}
                ${this.itemLeyenda(metrica.colores.diferencia, metrica.difTitulo)}
            </div>
        `).join('');
    },

    itemLeyenda(color, texto) {
        return `
            <div class="flex items-center gap-2 text-[10px] text-slate-600">
                <span class="inline-block h-3 w-3 rounded-sm shrink-0" style="background:${color};"></span>
                <span class="truncate">${texto}</span>
            </div>
        `;
    },

    destroy() {
        this.charts.forEach(chart => {
            try { chart.destroy(); } catch (e) { }
        });
        this.charts = [];
    }
};
