/**
 * Motor de Renderizado e Instanciación Chart.js (Soporta Línea, Causas Stacked, Diagrama de Pareto y N Ejes Y)
 */

const PALETA_EJES = [
    { axisId: 'y', position: 'left', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
    { axisId: 'y1', position: 'right', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
    { axisId: 'y2', position: 'left', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)' },
    { axisId: 'y3', position: 'right', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)' },
    { axisId: 'y4', position: 'left', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
    { axisId: 'y5', position: 'right', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.08)' },
    { axisId: 'y6', position: 'left', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)' }
];

const PALETA_HORAS = [
    { hora: '06:00', color: '#4f86f7', bg: 'rgba(79, 134, 247, 0.85)' },
    { hora: '12:00', color: '#34d399', bg: 'rgba(52, 211, 153, 0.85)' },
    { hora: '16:00', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.85)' },
    { hora: 'default', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.85)' }
];

const focoPorSeccionGlobal = {};

const tableauFocusHighlightPlugin = {
    id: 'tableauFocusHighlight',
    beforeDraw: (chart) => {
        const focoIndex = chart.focoIndex;
        if (focoIndex == null || focoIndex < 0) return;

        const { ctx, chartArea, scales } = chart;
        if (!scales || !scales.x) return;

        let xPos = null;
        if (typeof scales.x.getPixelForValue === 'function') {
            xPos = scales.x.getPixelForValue(focoIndex);
        } else if (chart.getDatasetMeta && chart.getDatasetMeta(0) && chart.getDatasetMeta(0).data && chart.getDatasetMeta(0).data[focoIndex]) {
            xPos = chart.getDatasetMeta(0).data[focoIndex].x;
        }

        if (xPos == null || isNaN(xPos) || xPos < chartArea.left || xPos > chartArea.right) return;

        ctx.save();
        const totalLabels = chart.data.labels ? chart.data.labels.length : 1;
        const colWidth = (chartArea.right - chartArea.left) / Math.max(1, totalLabels);
        const w = Math.max(16, Math.min(48, colWidth * 0.75));

        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fillRect(xPos - w / 2, chartArea.top, w, chartArea.height);

        ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(xPos, chartArea.top);
        ctx.lineTo(xPos, chartArea.bottom);
        ctx.stroke();

        ctx.restore();
    }
};

function aplicarFocoSeccion(tipoKey) {
    const focoIndex = focoPorSeccionGlobal[tipoKey];

    if (typeof configGraficos !== 'undefined' && Array.isArray(configGraficos)) {
        configGraficos.forEach(cfg => {
            const cfgTipo = cfg.tipo || 'mortalidad';
            if (cfgTipo === tipoKey && chartInstances[cfg.canvasId]) {
                const chart = chartInstances[cfg.canvasId];
                chart.focoIndex = (focoIndex !== undefined && focoIndex !== null) ? focoIndex : null;
                chart.update('none');
            }
        });
    }
}

function getDynamicPointRadius(defaultRadius = 2) {
    return (ctx) => {
        const foco = ctx.chart ? ctx.chart.focoIndex : null;
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (foco == null || foco < 0 || (dataset && dataset._hcStdDs)) return defaultRadius;
        return ctx.dataIndex === foco ? defaultRadius + 3 : 1.2;
    };
}

function getDynamicPointHoverRadius(defaultHoverRadius = 4) {
    return (ctx) => {
        const foco = ctx.chart ? ctx.chart.focoIndex : null;
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (foco == null || foco < 0 || (dataset && dataset._hcStdDs)) return defaultHoverRadius;
        return ctx.dataIndex === foco ? defaultHoverRadius + 2 : 2.5;
    };
}

function getDynamicPointBgColor(item, baseColorDefault = '#2563eb') {
    return (ctx) => {
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (dataset && dataset._hcStdDs) return baseColorDefault;

        const val = (dataset && dataset.data) ? dataset.data[ctx.dataIndex] : null;
        const stdVal = (item && item.dataStd) ? item.dataStd[ctx.dataIndex] : null;
        const dsLabel = dataset ? (dataset.label || '') : '';
        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';

        const cumple = (typeof seCumpleEstandar === 'function') 
            ? seCumpleEstandar(item, ctx.dataIndex, val, stdVal, sexoNode) 
            : true;

        const pointColor = cumple ? '#2563eb' : '#dc2626';

        const foco = ctx.chart ? ctx.chart.focoIndex : null;
        if (foco != null && foco >= 0) {
            return ctx.dataIndex === foco ? '#ffffff' : 'rgba(203, 213, 225, 0.4)';
        }

        return pointColor;
    };
}

function getDynamicPointBorderColor(item, baseColorDefault = '#2563eb') {
    return (ctx) => {
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (dataset && dataset._hcStdDs) return baseColorDefault;

        const val = (dataset && dataset.data) ? dataset.data[ctx.dataIndex] : null;
        const stdVal = (item && item.dataStd) ? item.dataStd[ctx.dataIndex] : null;
        const dsLabel = dataset ? (dataset.label || '') : '';
        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';

        const cumple = (typeof seCumpleEstandar === 'function') 
            ? seCumpleEstandar(item, ctx.dataIndex, val, stdVal, sexoNode) 
            : true;

        const pointColor = cumple ? '#2563eb' : '#dc2626';

        const foco = ctx.chart ? ctx.chart.focoIndex : null;
        if (foco != null && foco >= 0) {
            return ctx.dataIndex === foco ? pointColor : 'rgba(203, 213, 225, 0.5)';
        }

        return pointColor;
    };
}

function getDynamicBarBgColor(baseColor) {
    return (ctx) => {
        const foco = ctx.chart ? ctx.chart.focoIndex : null;
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (foco == null || foco < 0 || (dataset && dataset._hcStdDs)) return baseColor;
        return ctx.dataIndex === foco ? baseColor : 'rgba(226, 232, 240, 0.45)';
    };
}

function getDynamicSegmentColor(baseColor) {
    return {
        borderColor: (ctx) => {
            const foco = ctx.chart ? ctx.chart.focoIndex : null;
            const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
            if (foco == null || foco < 0 || (dataset && dataset._hcStdDs)) return baseColor;
            if (ctx.p0DataIndex === foco || ctx.p1DataIndex === foco) {
                return baseColor;
            }
            return 'rgba(203, 213, 225, 0.35)';
        }
    };
}

function obtenerTensionLinea() {
    const chk = document.getElementById('check-lineas-suaves');
    return (chk && chk.checked) ? 0.4 : 0;
}

function actualizarTensionLineasGraficos() {
    const tension = obtenerTensionLinea();

    Object.values(chartInstances).forEach(chart => {
        if (!chart || !chart.data || !chart.data.datasets) return;
        chart.data.datasets.forEach(ds => {
            if (ds.type === 'line' || (!ds.type && chart.config.type === 'line')) {
                ds.tension = tension;
            }
        });
        chart.update();
    });
}

function seCumpleEstandar(item, idx, val, stdVal, sexoNode = 'macho') {
    if (val == null || isNaN(val)) return true;

    const arrCumple = (sexoNode === 'hembra') ? item?.dataCumpleHembra : item?.dataCumpleMacho;
    if (arrCumple && arrCumple[idx] !== undefined && arrCumple[idx] !== null) {
        return Boolean(arrCumple[idx]);
    }

    if (stdVal == null || isNaN(stdVal)) return true;

    const modoEval = item?.modoEvaluacion || (item?.tipo === 'consumo_alimento' || item?.tipo === 'ganancia_peso' || item?.tipo === 'pesaje_pollo' ? 'solo_min' : 'solo_max');

    if (modoEval === 'solo_max') {
        return val <= stdVal;
    } else if (modoEval === 'solo_min') {
        return val >= stdVal;
    }

    return val >= stdVal;
}

window.seCumpleEstandar = seCumpleEstandar;
window.obtenerTensionLinea = obtenerTensionLinea;
window.actualizarTensionLineasGraficos = actualizarTensionLineasGraficos;

const TIPO_GRAFICO_MAP = {
    mortalidad: {
        label: 'Mortalidad',
        unidad: '%',
        badgeBg: 'bg-rose-50',
        badgeText: 'text-rose-700',
        badgeBorder: 'border-rose-200',
        iconSvg: `<svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
    },
    consumo_alimento: {
        label: 'Consumo de Alimento',
        unidad: 'g/ave',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        iconSvg: `<svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"></path></svg>`
    },
    consumo_agua: {
        label: 'Consumo de Agua',
        unidad: 'ml/ave',
        badgeBg: 'bg-sky-50',
        badgeText: 'text-sky-700',
        badgeBorder: 'border-sky-200',
        iconSvg: `<svg class="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.12a2 2 0 00-1.022.547l-1.394 1.394A2 2 0 004.605 20.4l14.823-1.482a2 2 0 001.394-1.394l-1.394-2.096z"></path></svg>`
    },
    consumo_gas: {
        label: 'Consumo de Gas',
        unidad: 'kg',
        badgeBg: 'bg-violet-50',
        badgeText: 'text-violet-700',
        badgeBorder: 'border-violet-200',
        iconSvg: `<svg class="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path></svg>`
    },
    combinado: {
        label: 'Gráficos Combinados (Multi-Eje Y)',
        unidad: '',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        badgeBorder: 'border-indigo-200',
        iconSvg: `<svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`
    },
    ganancia_peso: {
        label: 'Ganancia de Peso',
        unidad: 'g/ave',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200',
        iconSvg: `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`
    },
    pesaje_pollo: {
        label: 'Pesaje de Pollo',
        unidad: 'g',
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-700',
        badgeBorder: 'border-teal-200',
        iconSvg: `<svg class="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>`
    },
    nivel_cloro: {
        label: 'Nivel de Cloro',
        unidad: 'ppm',
        chartType: 'bar',
        barMode: 'grouped',
        badgeBg: 'bg-cyan-50',
        badgeText: 'text-cyan-700',
        badgeBorder: 'border-cyan-200',
        iconSvg: `<svg class="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.12a2 2 0 00-1.022.547l-1.394 1.394A2 2 0 004.605 20.4l14.823-1.482a2 2 0 001.394-1.394l-1.394-2.096z"></path></svg>`
    },
    respiratorio: {
        label: 'Evaluación Respiratoria',
        unidad: 'Estornudo x min',
        chartType: 'bar',
        barMode: 'grouped',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        iconSvg: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`
    },
    digestivo: {
        label: 'Evaluación Digestiva (Heces)',
        unidad: '%',
        chartType: 'bar',
        barMode: 'stacked',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        iconSvg: `<svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    },
    medicacion: {
        label: 'Medicaciones',
        unidad: 'unidades',
        chartType: 'bar',
        barMode: 'stacked',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-700',
        badgeBorder: 'border-purple-200',
        iconSvg: `<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L5.605 15.12a2 2 0 00-1.022.547l-1.394 1.394A2 2 0 004.605 20.4l14.823-1.482a2 2 0 001.394-1.394l-1.394-2.096z"></path></svg>`
    }
};

const PALETA_MEDICACIONES = [
    { bg: '#f87171', border: '#ef4444' }, // Rojo suave
    { bg: '#60a5fa', border: '#3b82f6' }, // Azul suave
    { bg: '#4ade80', border: '#22c55e' }, // Verde suave
    { bg: '#c084fc', border: '#a855f7' }, // Púrpura suave
    { bg: '#fb923c', border: '#f97316' }, // Naranja suave
    { bg: '#2dd4bf', border: '#14b8a6' }, // Teal
    { bg: '#fbbf24', border: '#f59e0b' }, // Ámbar
    { bg: '#f472b6', border: '#ec4899' }, // Rosa
    { bg: '#818cf8', border: '#6366f1' }, // Indigo
    { bg: '#a3e635', border: '#84cc16' }  // Lima
];

const PALETA_CIRCULAR = [
    '#2563eb', // Azul
    '#0ea5e9', // Cyan
    '#10b981', // Verde Esmeralda
    '#f59e0b', // Ámbar
    '#f97316', // Naranja
    '#8b5cf6', // Violeta
    '#ec4899', // Rosa
    '#14b8a6', // Teal
    '#6366f1', // Indigo
    '#84cc16'  // Lima
];

function crearGraficoCircularChartJS(item, ctx, tipoVisual) {
    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const chartExistente = Chart.getChart(ctx) || Chart.getChart(item.canvasId);
        if (chartExistente) {
            chartExistente.destroy();
        }
    }
    if (chartInstances[item.canvasId]) {
        chartInstances[item.canvasId].destroy();
        delete chartInstances[item.canvasId];
    }

    let startIdx = 0;
    let endIdx = item.labels ? item.labels.length - 1 : 46;

    if (item.desdeVal !== 'inicio') {
        const idx = parseInt(item.desdeVal, 10);
        if (!isNaN(idx)) startIdx = idx;
    }
    if (item.hastaVal !== 'fin') {
        const idx = parseInt(item.hastaVal, 10);
        if (!isNaN(idx)) endIdx = idx;
    }
    if (startIdx > endIdx) {
        const temp = startIdx;
        startIdx = endIdx;
        endIdx = temp;
    }

    let labels = [];
    let dataValues = [];
    let bgColors = [];

    const sexo = item.sexoActiva || 'macho';

    // 1. MODO BENCHMARKING (GRANJAS / CAMPANIAS)
    if (item.esCombinado && item.modoCombinado === 'granja' && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const rawArr = (sexo === 'hembra' ? sObj.dataHembra : sObj.dataMacho) || sObj.dataMacho || [];
            const slicedArr = rawArr.slice(startIdx, endIdx + 1);
            const sumVal = slicedArr.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
            labels.push(sObj.infoBadge);
            dataValues.push(parseFloat(sumVal.toFixed(2)));
            bgColors.push(PALETA_EJES[idx % PALETA_EJES.length].color);
        });
    }
    // 2. MODO COMBINADO MULTI-MÉTRICA
    else if (item.esCombinado && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[sObj.tipo]) ? TIPO_GRAFICO_MAP[sObj.tipo] : { label: sObj.tipo };
            const rawArr = (sexo === 'hembra' ? sObj.dataHembra : sObj.dataMacho) || sObj.dataMacho || [];
            const slicedArr = rawArr.slice(startIdx, endIdx + 1);
            const sumVal = slicedArr.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
            labels.push(cfg.label);
            dataValues.push(parseFloat(sumVal.toFixed(2)));
            bgColors.push(PALETA_EJES[idx % PALETA_EJES.length].color);
        });
    }
    // 3. MODO INDIVIDUAL ESTÁNDAR (Semanas)
    else {
        const rawData = (sexo === 'hembra' ? item.dataHembra : item.dataMacho) || item.dataMacho || [];
        const slicedData = rawData.slice(startIdx, endIdx + 1);
        const numSemanas = Math.ceil(slicedData.length / 7);
        const weeklyValues = calcularSemanal(slicedData);

        for (let s = 0; s < numSemanas; s++) {
            const semNum = s + 1;
            const startDay = startIdx + s * 7 + 1;
            const endDay = Math.min(startIdx + (s + 1) * 7, startIdx + slicedData.length);
            labels.push(`Semana ${semNum} (D${startDay}-D${endDay})`);
            const val = weeklyValues[s] != null ? weeklyValues[s] : 0;
            dataValues.push(parseFloat(val.toFixed(2)));
            bgColors.push(PALETA_CIRCULAR[s % PALETA_CIRCULAR.length]);
        }
    }

    const totalGeneral = dataValues.reduce((acc, curr) => acc + curr, 0) || 1;
    const pluginsList = typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [];

    chartInstances[item.canvasId] = new Chart(ctx, {
        type: tipoVisual === 'doughnut' ? 'doughnut' : 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: bgColors,
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        plugins: pluginsList,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: tipoVisual === 'doughnut' ? '60%' : 0,
            animation: { duration: 400, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'Inter', size: 10, weight: '500' },
                        padding: 10
                    }
                },
                datalabels: {
                    display: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        const pct = (val / totalGeneral) * 100;
                        return pct >= 4;
                    },
                    color: '#ffffff',
                    font: { family: 'Inter', size: 10, weight: '700' },
                    formatter: (val) => {
                        const pct = ((val / totalGeneral) * 100).toFixed(1);
                        return `${pct}%`;
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Inter', size: 12, weight: '700' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            const pct = ((val / totalGeneral) * 100).toFixed(1);
                            const unidad = item.unidad ? ` ${item.unidad}` : '';
                            return `${ctx.label}: ${val}${unidad} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    inicializarFiltrosTarjeta(item);
}

function normalizeCausasData(causasObj, paretoObj) {
    if (!causasObj || !Array.isArray(causasObj.porFecha)) {
        return { fechas: [], causas: [], matriz: [] };
    }

    let orden = [];
    if (paretoObj && Array.isArray(paretoObj.items) && paretoObj.items.length) {
        orden = paretoObj.items.map(it => it.nombre || it.causa || '').filter(Boolean);
    }

    const totalesMap = {};
    causasObj.porFecha.forEach(dia => {
        (dia.causas || []).forEach(c => {
            const nom = c.nombre || c.causa || '';
            if (!nom) return;
            totalesMap[nom] = (totalesMap[nom] || 0) + (c.total || 0);
            if (!orden.includes(nom)) orden.push(nom);
        });
    });

    const causaIdx = {};
    orden.forEach((nom, i) => { causaIdx[nom] = i; });

    const fechas = [];
    const matriz = [];
    causasObj.porFecha.forEach(dia => {
        fechas.push(dia.fecha);
        const row = new Array(orden.length).fill(0);
        (dia.causas || []).forEach(c => {
            const nom = c.nombre || c.causa || '';
            if (nom && causaIdx[nom] != null) row[causaIdx[nom]] = c.total || 0;
        });
        matriz.push(row);
    });

    return { fechas, causas: orden, matriz };
}

function generarCausasMock(item) {
    const causasNames = ['Muerte súbita', 'Ascitis', 'Retrasados', 'Cojos'];
    const totalDays = item.labels ? item.labels.length : 47;
    const matriz = [];

    for (let i = 0; i < totalDays; i++) {
        const valM = item.dataMacho ? item.dataMacho[i] : null;
        const baseCount = (valM && valM > 0) ? Math.round(valM * 400) : (i < 35 ? Math.floor(Math.random() * 15 + 10) : Math.floor(Math.random() * 40 + 20));

        if (i < 15) {
            matriz.push([baseCount, 0, Math.floor(baseCount * 0.4), 0]);
        } else if (i < 35) {
            matriz.push([Math.floor(baseCount * 0.6), Math.floor(baseCount * 0.3), 0, Math.floor(baseCount * 0.1)]);
        } else {
            matriz.push([Math.floor(baseCount * 0.4), Math.floor(baseCount * 0.7), 0, Math.floor(baseCount * 0.2)]);
        }
    }

    return { causas: causasNames, matriz };
}

function crearGraficoCausasMortalidad(item, ctx) {
    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const chartExistente = Chart.getChart(ctx) || Chart.getChart(item.canvasId);
        if (chartExistente) {
            chartExistente.destroy();
        }
    }
    if (chartInstances[item.canvasId]) {
        chartInstances[item.canvasId].destroy();
        delete chartInstances[item.canvasId];
    }

    let startIdx = 0;
    let endIdx = item.labels ? item.labels.length - 1 : 46;

    if (item.desdeVal !== 'inicio') {
        const idx = parseInt(item.desdeVal, 10);
        if (!isNaN(idx)) startIdx = idx;
    }
    if (item.hastaVal !== 'fin') {
        const idx = parseInt(item.hastaVal, 10);
        if (!isNaN(idx)) endIdx = idx;
    }
    if (startIdx > endIdx) {
        const temp = startIdx;
        startIdx = endIdx;
        endIdx = temp;
    }

    const slicedLabels = item.labels ? item.labels.slice(startIdx, endIdx + 1) : [];

    const raw = item.rawCausas || {};
    const norm = (raw && Array.isArray(raw.porFecha) && raw.porFecha.length > 0)
        ? normalizeCausasData(raw, item.rawPareto)
        : generarCausasMock(item);

    const slicedMatriz = norm.matriz.slice(startIdx, endIdx + 1);

    const pluginsList = typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : [];

    const causeColors = [
        { bg: 'rgba(248, 113, 113, 0.85)', border: '#ef4444' }, // Muerte súbita / Red
        { bg: 'rgba(96, 165, 250, 0.85)', border: '#3b82f6' }, // Ascitis / Blue
        { bg: 'rgba(74, 222, 128, 0.85)', border: '#22c55e' }, // Retrasados / Green
        { bg: 'rgba(192, 132, 252, 0.85)', border: '#a855f7' }, // Cojos / Purple
        { bg: 'rgba(251, 146, 60, 0.85)', border: '#f97316' }, // Descarte / Orange
        { bg: 'rgba(45, 212, 191, 0.85)', border: '#14b8a6' }  // Otros / Teal
    ];

    const datasets = norm.causas.map((causaNombre, idx) => {
        const cColor = causeColors[idx % causeColors.length];
        const dataArr = slicedMatriz.map(row => row[idx] || 0);

        return {
            label: causaNombre,
            data: dataArr,
            backgroundColor: cColor.bg,
            borderColor: cColor.border,
            borderWidth: 1.5,
            borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: 'bottom',
            barPercentage: 0.85,
            categoryPercentage: 0.8,
            datalabels: {
                display: (ctx) => {
                    const val = ctx.dataset.data[ctx.dataIndex];
                    return val != null && val > 0;
                },
                anchor: 'center',
                align: 'center',
                rotation: 0,
                color: '#ffffff',
                font: { family: 'Inter', size: 10, weight: '700' },
                formatter: (val) => val
            }
        };
    });

    chartInstances[item.canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: slicedLabels,
            datasets: datasets
        },
        plugins: pluginsList,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original', minRange: 3 }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.05
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'Inter', size: 11, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Inter', size: 12, weight: '700' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 10,
                    callbacks: {
                        title: (items) => {
                            if (!items || !items.length) return '';
                            const idx = items[0].dataIndex;
                            const diaNum = slicedLabels[idx] ? slicedLabels[idx].replace('D', '') : (idx + 1);
                            const realIdx = startIdx + idx;
                            const fechaTxt = item.dataFechas && item.dataFechas[realIdx] ? ` (${item.dataFechas[realIdx]})` : '';
                            return `D${diaNum}${fechaTxt}`;
                        },
                        label: (ctx) => {
                            const val = ctx.raw;
                            if (!val || val === 0) return null;
                            return `${ctx.dataset.label}: ${val} aves`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: 'Día de campaña', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748b' },
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        autoSkip: false,
                        minRotation: 90,
                        maxRotation: 90,
                        font: { family: 'Inter', size: 9, weight: '600' },
                        color: '#64748b'
                    }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Cantidad de aves', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748b' },
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { family: 'Inter', size: 10 },
                        color: '#64748b',
                        callback: (v) => Number.isInteger(v) ? v : null
                    }
                }
            }
        }
    });

    const canvasEl = ctx.canvas || ctx;
    if (canvasEl && !canvasEl._hasZoomResetListener) {
        canvasEl._hasZoomResetListener = true;
        canvasEl.addEventListener('dblclick', () => {
            const inst = chartInstances[item.canvasId];
            if (inst && typeof inst.resetZoom === 'function') {
                inst.resetZoom();
            }
        });
    }
}

function crearGraficoParetoMortalidad(item, ctx) {
    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const chartExistente = Chart.getChart(ctx) || Chart.getChart(item.canvasId);
        if (chartExistente) {
            chartExistente.destroy();
        }
    }
    if (chartInstances[item.canvasId]) {
        chartInstances[item.canvasId].destroy();
        delete chartInstances[item.canvasId];
    }

    let startIdx = 0;
    let endIdx = item.labels ? item.labels.length - 1 : 46;

    if (item.desdeVal !== 'inicio') {
        const idx = parseInt(item.desdeVal, 10);
        if (!isNaN(idx)) startIdx = idx;
    }
    if (item.hastaVal !== 'fin') {
        const idx = parseInt(item.hastaVal, 10);
        if (!isNaN(idx)) endIdx = idx;
    }
    if (startIdx > endIdx) {
        const temp = startIdx;
        startIdx = endIdx;
        endIdx = temp;
    }

    const norm = (item.rawCausas && Array.isArray(item.rawCausas.porFecha) && item.rawCausas.porFecha.length > 0)
        ? normalizeCausasData(item.rawCausas, item.rawPareto)
        : generarCausasMock(item);

    const slicedMatriz = norm.matriz.slice(startIdx, endIdx + 1);

    const mapTotals = {};
    norm.causas.forEach((cNom, i) => {
        const sumC = slicedMatriz.reduce((acc, row) => acc + (row[i] || 0), 0);
        mapTotals[cNom] = sumC;
    });

    let paretoItems = Object.keys(mapTotals).map(cNom => ({
        causa: cNom,
        total: mapTotals[cNom]
    })).filter(it => it.total > 0).sort((a, b) => b.total - a.total);

    if (paretoItems.length === 0) {
        paretoItems = Object.keys(mapTotals).map(cNom => ({
            causa: cNom,
            total: mapTotals[cNom]
        })).sort((a, b) => b.total - a.total);
    }

    if (paretoItems.length === 0) {
        paretoItems = [
            { causa: 'Muerte súbita', total: 1089 },
            { causa: 'Ascitis', total: 474 },
            { causa: 'Retrasados', total: 20 },
            { causa: 'Cojos', total: 15 }
        ];
    }

    const totalGeneral = paretoItems.reduce((s, it) => s + it.total, 0) || 1;
    const labels = paretoItems.map(it => it.causa);
    const barData = paretoItems.map(it => it.total);

    const cumData = [];
    let cumSum = 0;
    paretoItems.forEach(it => {
        cumSum += it.total;
        cumData.push(parseFloat(((cumSum / totalGeneral) * 100).toFixed(1)));
    });

    const barColors = [
        { bg: 'rgba(248, 113, 113, 0.85)', border: '#ef4444' }, // Muerte súbita / Red
        { bg: 'rgba(96, 165, 250, 0.85)', border: '#3b82f6' }, // Ascitis / Blue
        { bg: 'rgba(74, 222, 128, 0.85)', border: '#22c55e' }, // Retrasados / Green
        { bg: 'rgba(192, 132, 252, 0.85)', border: '#a855f7' }, // Cojos / Purple
        { bg: 'rgba(251, 146, 60, 0.85)', border: '#f97316' }, // Descarte / Orange
        { bg: 'rgba(45, 212, 191, 0.85)', border: '#14b8a6' }  // Otros / Teal
    ];

    const datasets = [
        {
            label: 'Cantidad',
            type: 'bar',
            data: barData,
            backgroundColor: barData.map((_, i) => barColors[i % barColors.length].bg),
            borderColor: barData.map((_, i) => barColors[i % barColors.length].border),
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: 'bottom',
            order: 2,
            yAxisID: 'y',
            datalabels: {
                display: true,
                anchor: 'center',
                align: 'center',
                color: '#ffffff',
                font: { family: 'Inter', size: 11, weight: '700' },
                formatter: (val) => {
                    const itemTotal = val;
                    const pct = ((itemTotal / totalGeneral) * 100).toFixed(1);
                    return `${itemTotal}\n${pct}%`;
                }
            }
        },
        {
            label: '% Acumulado',
            type: 'line',
            data: cumData,
            borderColor: '#ef4444',
            backgroundColor: '#ef4444',
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#ef4444',
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            tension: obtenerTensionLinea(),
            order: 1,
            yAxisID: 'y1',
            datalabels: {
                display: false
            }
        }
    ];

    const pluginsList = [
        typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null,
        {
            id: 'pareto80line',
            afterDraw: (chart) => {
                const yScale = chart.scales.y1;
                if (!yScale) return;
                const y80 = yScale.getPixelForValue(80);
                const ctx = chart.ctx;
                ctx.save();
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(chart.chartArea.left, y80);
                ctx.lineTo(chart.chartArea.right, y80);
                ctx.stroke();

                ctx.font = '700 10px Inter, sans-serif';
                ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
                ctx.textAlign = 'right';
                ctx.fillText('80%', chart.chartArea.right - 5, y80 - 4);
                ctx.restore();
            }
        }
    ].filter(Boolean);

    chartInstances[item.canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        plugins: pluginsList,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 400, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original', minRange: 2 }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.05
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: { family: 'Inter', size: 11, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Inter', size: 12, weight: '700' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.datasetIndex === 0) {
                                const pct = ((ctx.raw / totalGeneral) * 100).toFixed(1);
                                return `Cantidad: ${ctx.raw} aves (${pct}%)`;
                            }
                            return `% Acumulado: ${ctx.raw}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Causa de mortalidad', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748b' },
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { family: 'Inter', size: 10, weight: '600' }, color: '#64748b' }
                },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Cantidad de aves', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748b' },
                    grid: { color: '#f1f5f9' },
                    beginAtZero: true,
                    ticks: {
                        font: { family: 'Inter', size: 10 },
                        color: '#64748b',
                        callback: (v) => Number.isInteger(v) ? v : null
                    }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: '% Acumulado', font: { family: 'Inter', size: 11, weight: '600' }, color: '#ef4444' },
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false },
                    border: { color: '#ef4444' },
                    ticks: {
                        font: { family: 'Inter', size: 10, weight: '600' },
                        color: '#ef4444',
                        callback: (v) => `${Math.round(v)}%`
                    }
                }
            }
        }
    });

    const canvasEl = ctx.canvas || ctx;
    if (canvasEl && !canvasEl._hasZoomResetListener) {
        canvasEl._hasZoomResetListener = true;
        canvasEl.addEventListener('dblclick', () => {
            const inst = chartInstances[item.canvasId];
            if (inst && typeof inst.resetZoom === 'function') {
                inst.resetZoom();
            }
        });
    }
}

function obtenerTipoVisualEfectivo(item) {
    if (item && item.tipoVisualizacion && item.tipoVisualizacion !== 'default') {
        return item.tipoVisualizacion;
    }
    const global = (typeof tipoVisualizacionGlobal !== 'undefined') ? tipoVisualizacionGlobal : 'default';
    if (global && global !== 'default') {
        return global;
    }
    return (item && (item.chartType || (item.tipo === 'respiratorio' || item.tipo === 'digestivo' ? 'bar' : 'line'))) || 'line';
}

function obtenerDatasetsSegunSexo(item, processedSeriesMap = null) {
    const sexo = item.sexoActiva || 'macho';
    const tipoVisual = obtenerTipoVisualEfectivo(item);
    const datasets = [];

    // MODO COMBINADO POR GRANJA / CAMPAÑA (BENCHMARKING)
    if (item.esCombinado && item.modoCombinado === 'granja' && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const paleta = PALETA_EJES[idx % PALETA_EJES.length];
            const rawM = (sObj.dataHoras && item.horaActiva && item.horaActiva !== 'todas' && sObj.dataHoras[item.horaActiva]) ? sObj.dataHoras[item.horaActiva] : sObj.dataMacho;
            const pMacho = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].macho : rawM;
            const pHembra = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].hembra : sObj.dataHembra;

            if (pMacho && (sexo === 'ambos' || sexo === 'macho')) {
                datasets.push({
                    type: tipoVisual === 'bar' ? 'bar' : 'line',
                    label: `${sObj.infoBadge} M`,
                    data: pMacho,
                    borderColor: paleta.color,
                    backgroundColor: tipoVisual === 'bar' ? paleta.color : paleta.bg,
                    borderWidth: tipoVisual === 'bar' ? 1 : 2,
                    borderRadius: tipoVisual === 'bar' ? 4 : 0,
                    borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                    pointBackgroundColor: paleta.color,
                    pointBorderColor: paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    tension: obtenerTensionLinea(),
                    yAxisID: 'y',
                    spanGaps: true,
                    order: 2
                });
            }
            if (pHembra && (sexo === 'ambos' || sexo === 'hembra')) {
                datasets.push({
                    type: tipoVisual === 'bar' ? 'bar' : 'line',
                    label: `${sObj.infoBadge} H`,
                    data: pHembra,
                    borderColor: paleta.color,
                    backgroundColor: tipoVisual === 'bar' ? paleta.color : paleta.bg,
                    borderWidth: tipoVisual === 'bar' ? 1 : 2,
                    borderRadius: tipoVisual === 'bar' ? 4 : 0,
                    borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                    pointBackgroundColor: paleta.color,
                    pointBorderColor: paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    tension: obtenerTensionLinea(),
                    yAxisID: 'y',
                    spanGaps: true,
                    order: 2
                });
            }
        });

        const firstStd = processedSeriesMap && processedSeriesMap[0] ? processedSeriesMap[0].std : item.dataStd;
        if (firstStd && firstStd.some(v => v != null)) {
            datasets.push({
                type: 'line',
                label: 'std',
                data: firstStd,
                borderColor: '#16a34a',
                backgroundColor: '#16a34a',
                borderWidth: 1.8,
                borderDash: [6, 3],
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a',
                pointRadius: 1.5,
                tension: obtenerTensionLinea(),
                yAxisID: 'y',
                spanGaps: true,
                order: 1,
                _hcStdDs: true
            });
        }

        return datasets;
    }

    // MODO COMBINADO MULTI-EJE Y
    if (item.esCombinado && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const paleta = PALETA_EJES[idx % PALETA_EJES.length];
            const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[sObj.tipo]) ? TIPO_GRAFICO_MAP[sObj.tipo] : { label: sObj.tipo };

            const rawM = (sObj.dataHoras && item.horaActiva && item.horaActiva !== 'todas' && sObj.dataHoras[item.horaActiva]) ? sObj.dataHoras[item.horaActiva] : sObj.dataMacho;
            const pMacho = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].macho : rawM;
            const pHembra = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].hembra : sObj.dataHembra;
            const pStd = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].std : sObj.dataStd;

            if (pMacho && (sexo === 'ambos' || sexo === 'macho')) {
                datasets.push({
                    type: tipoVisual === 'bar' ? 'bar' : 'line',
                    label: `${cfg.label} M`,
                    data: pMacho,
                    borderColor: paleta.color,
                    backgroundColor: tipoVisual === 'bar' ? paleta.color : paleta.bg,
                    borderWidth: tipoVisual === 'bar' ? 1 : 2,
                    borderRadius: tipoVisual === 'bar' ? 4 : 0,
                    borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                    pointBackgroundColor: paleta.color === '#2563eb' ? '#dc2626' : paleta.color,
                    pointBorderColor: paleta.color === '#2563eb' ? '#dc2626' : paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    yAxisID: paleta.axisId,
                    spanGaps: true,
                    order: 2
                });
            }
            if (pHembra && (sexo === 'ambos' || sexo === 'hembra')) {
                datasets.push({
                    type: tipoVisual === 'bar' ? 'bar' : 'line',
                    label: `${cfg.label} H`,
                    data: pHembra,
                    borderColor: paleta.color,
                    backgroundColor: tipoVisual === 'bar' ? paleta.color : paleta.bg,
                    borderWidth: tipoVisual === 'bar' ? 1 : 2,
                    borderRadius: tipoVisual === 'bar' ? 4 : 0,
                    borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                    pointBackgroundColor: paleta.color === '#2563eb' ? '#dc2626' : paleta.color,
                    pointBorderColor: paleta.color === '#2563eb' ? '#dc2626' : paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    yAxisID: paleta.axisId,
                    spanGaps: true,
                    order: 2
                });
            }
            if (pStd && pStd.some(v => v != null)) {
                datasets.push({
                    type: 'line',
                    label: `std ${cfg.label}`,
                    data: pStd,
                    borderColor: paleta.color,
                    borderWidth: 1.5,
                    borderDash: [5, 4],
                    pointBackgroundColor: paleta.color,
                    pointRadius: 1.5,
                    tension: obtenerTensionLinea(),
                    yAxisID: paleta.axisId,
                    spanGaps: true,
                    order: 1,
                    _hcStdDs: true
                });
            }
        });

        return datasets;
    }

    // MODO LECTURAS HORARIAS (NIVEL DE CLORO)
    if (item.tipo === 'nivel_cloro' || (Array.isArray(item.horasAplicacion) && item.horasAplicacion.length > 0 && item.dataHoras)) {
        const horasAMostrar = (item.horaActiva && item.horaActiva !== 'todas')
            ? [item.horaActiva]
            : (item.horasAplicacion && item.horasAplicacion.length > 0 ? item.horasAplicacion : ['06:00', '12:00', '16:00']);

        const isBar = (item.tipo === 'nivel_cloro' || tipoVisual === 'bar');

        horasAMostrar.forEach((h, hIdx) => {
            const paletaH = PALETA_HORAS.find(p => p.hora === h) || PALETA_HORAS[hIdx % PALETA_HORAS.length] || PALETA_HORAS[0];
            const rawDataH = (processedSeriesMap && processedSeriesMap[h]) ? processedSeriesMap[h] : ((item.dataHoras && item.dataHoras[h]) ? item.dataHoras[h] : []);

            datasets.push({
                type: isBar ? 'bar' : 'line',
                label: `galpón ${item.galpon} · ${h}`,
                data: rawDataH,
                borderColor: paletaH.color,
                backgroundColor: isBar ? paletaH.color : paletaH.bg,
                borderWidth: isBar ? 1.5 : 2,
                borderRadius: isBar ? 4 : 0,
                borderSkipped: isBar ? 'bottom' : false,
                barPercentage: 0.85,
                categoryPercentage: 0.8,
                pointBackgroundColor: paletaH.color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointRadius: 2,
                pointHoverRadius: 4,
                tension: obtenerTensionLinea(),
                spanGaps: true,
                order: 2
            });
        });

        const pS = (processedSeriesMap && processedSeriesMap.std) ? processedSeriesMap.std : item.dataStd;
        if (pS && pS.some(v => v != null)) {
            datasets.push({
                type: 'line',
                label: 'std',
                data: pS,
                borderColor: '#16a34a',
                backgroundColor: '#16a34a',
                borderWidth: 1.8,
                borderDash: [6, 3],
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a',
                pointRadius: 1.5,
                tension: obtenerTensionLinea(),
                spanGaps: true,
                order: 1,
                _hcStdDs: true
            });
        }

        return datasets;
    }

    if (item.tipo === 'respiratorio') {
        const signo = item.signoActivo || 'todos';
        const sexo = item.sexoActiva || 'macho';

        let pEstM = (processedSeriesMap && processedSeriesMap.estM) ? processedSeriesMap.estM : item.dataEstornudoM;
        let pEstH = (processedSeriesMap && processedSeriesMap.estH) ? processedSeriesMap.estH : item.dataEstornudoH;
        let pRonM = (processedSeriesMap && processedSeriesMap.ronM) ? processedSeriesMap.ronM : item.dataRonqueraM;
        let pRonH = (processedSeriesMap && processedSeriesMap.ronH) ? processedSeriesMap.ronH : item.dataRonqueraH;

        const ds = [];

        const colorEstM = '#2563eb';
        const colorEstH = '#0284c7';
        const colorRonM = '#f3c875';
        const colorRonH = '#eab308';
        const borderRonM = '#d97706';
        const borderRonH = '#ca8a04';

        if (signo === 'todos' || signo === 'estornudo') {
            if (sexo === 'ambos' || sexo === 'macho') {
                ds.push({
                    type: 'bar',
                    label: (sexo === 'ambos') ? `Estornudo M` : `Estornudo`,
                    data: pEstM || [],
                    borderColor: colorEstM,
                    backgroundColor: colorEstM,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                ds.push({
                    type: 'bar',
                    label: (sexo === 'ambos') ? `Estornudo H` : `Estornudo`,
                    data: pEstH || [],
                    borderColor: colorEstH,
                    backgroundColor: colorEstH,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
        }

        if (signo === 'todos' || signo === 'ronquera') {
            if (sexo === 'ambos' || sexo === 'macho') {
                ds.push({
                    type: 'bar',
                    label: (sexo === 'ambos') ? `Ronquera M` : `Ronquera`,
                    data: pRonM || [],
                    borderColor: borderRonM,
                    backgroundColor: colorRonM,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                ds.push({
                    type: 'bar',
                    label: (sexo === 'ambos') ? `Ronquera H` : `Ronquera`,
                    data: pRonH || [],
                    borderColor: borderRonH,
                    backgroundColor: colorRonH,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
        }

        return ds;
    }

    if (item.tipo === 'digestivo') {
        let pA = (processedSeriesMap && processedSeriesMap.A) ? processedSeriesMap.A : item.dataDigestivoA;
        let pP = (processedSeriesMap && processedSeriesMap.P) ? processedSeriesMap.P : item.dataDigestivoP;
        let pS = (processedSeriesMap && processedSeriesMap.S) ? processedSeriesMap.S : item.dataDigestivoS;
        let pR = (processedSeriesMap && processedSeriesMap.R) ? processedSeriesMap.R : item.dataDigestivoR;

        const ds = [];

        const labelsCount = (processedSeriesMap && processedSeriesMap.A) ? processedSeriesMap.A.length : (item.labels ? item.labels.length : 47);
        const std1 = Array(labelsCount).fill(1.0);
        const std4 = Array(labelsCount).fill(4.0);

        ds.push({
            type: 'line',
            label: 'Estándar',
            data: std1,
            borderColor: '#475569',
            backgroundColor: '#475569',
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            yAxisID: 'y',
            spanGaps: true,
            order: 1,
            _hcStdDs: true
        });

        if (item.vistaActiva === 'acumulado') {
            ds.push({
                type: 'line',
                label: 'Estándar Máximo',
                data: std4,
                borderColor: '#475569',
                backgroundColor: '#475569',
                borderWidth: 1.5,
                borderDash: [5, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0,
                yAxisID: 'y',
                spanGaps: true,
                order: 1,
                _hcStdDs: true
            });
        }

        ds.push(
            {
                type: 'bar',
                label: 'Pastosas',
                data: pP || [],
                borderColor: '#eab308',
                backgroundColor: '#eab308',
                borderWidth: 1.5,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
                stack: 'digestivoStack',
                order: 2
            },
            {
                type: 'bar',
                label: 'Sueltas',
                data: pS || [],
                borderColor: '#22c55e',
                backgroundColor: '#22c55e',
                borderWidth: 1.5,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
                stack: 'digestivoStack',
                order: 2
            },
            {
                type: 'bar',
                label: 'Anaranjadas',
                data: pA || [],
                borderColor: '#f97316',
                backgroundColor: '#f97316',
                borderWidth: 1.5,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
                stack: 'digestivoStack',
                order: 2
            },
            {
                type: 'bar',
                label: 'Rojas',
                data: pR || [],
                borderColor: '#ef4444',
                backgroundColor: '#ef4444',
                borderWidth: 1.5,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
                stack: 'digestivoStack',
                order: 2
            }
        );

        return ds;
    }

    if (item.tipo === 'medicacion') {
        const ds = [];
        const metricas = Array.isArray(item.metricasMedicacion) && item.metricasMedicacion.length > 0
            ? item.metricasMedicacion
            : Object.keys(item.dataMedicacion || {});

        metricas.forEach((mNombre, idx) => {
            const pal = PALETA_MEDICACIONES[idx % PALETA_MEDICACIONES.length];
            let rawArr = (processedSeriesMap && processedSeriesMap[mNombre])
                ? processedSeriesMap[mNombre]
                : ((item.dataMedicacion && item.dataMedicacion[mNombre]) ? item.dataMedicacion[mNombre] : []);

            if (!processedSeriesMap) {
                if (item.vistaActiva === 'acumulado') {
                    rawArr = calcularAcumulado(rawArr);
                } else if (item.vistaActiva === 'semanal') {
                    rawArr = (rawArr && rawArr.length > 7) ? calcularSemanal(rawArr) : [...rawArr];
                }
            }

            ds.push({
                type: 'bar',
                label: mNombre,
                data: rawArr || [],
                borderColor: pal.border,
                backgroundColor: pal.bg,
                borderWidth: 1.5,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.8,
                categoryPercentage: 0.8,
                stack: 'medicacionStack',
                order: 2
            });
        });

        return ds;
    }

    // MODO ESTÁNDAR 1 SOLO INDICADOR
    const pM = processedSeriesMap && processedSeriesMap[0] ? processedSeriesMap[0].macho : item.dataMacho;
    const pH = processedSeriesMap && processedSeriesMap[0] ? processedSeriesMap[0].hembra : item.dataHembra;
    const pS = processedSeriesMap && processedSeriesMap[0] ? processedSeriesMap[0].std : item.dataStd;

    if (sexo === 'combinado') {
        const arrM = pM || item.dataMacho || [];
        const arrH = pH || item.dataHembra || [];
        const maxLen = Math.max(arrM.length, arrH.length);
        const pComb = [];
        for (let i = 0; i < maxLen; i++) {
            const valM = (arrM[i] != null && !isNaN(arrM[i])) ? parseFloat(arrM[i]) : null;
            const valH = (arrH[i] != null && !isNaN(arrH[i])) ? parseFloat(arrH[i]) : null;

            let count = 0;
            let sum = 0;
            if (valM !== null) { sum += valM; count++; }
            if (valH !== null) { sum += valH; count++; }

            if (count === 0) {
                pComb.push(null);
            } else {
                pComb.push(parseFloat((sum / count).toFixed(4)));
            }
        }
        datasets.push({
            type: tipoVisual === 'bar' ? 'bar' : 'line',
            label: `Galpón ${item.galpon} Promedio (M+H)`,
            data: pComb,
            borderColor: '#4f46e5',
            backgroundColor: tipoVisual === 'bar' ? getDynamicBarBgColor('#4f46e5') : 'rgba(79, 70, 229, 0.1)',
            borderWidth: tipoVisual === 'bar' ? 1 : 2,
            borderRadius: tipoVisual === 'bar' ? 4 : 0,
            borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
            pointBackgroundColor: getDynamicPointBgColor(item, '#4f46e5'),
            pointBorderColor: getDynamicPointBorderColor(item, '#4f46e5'),
            pointBorderWidth: 1,
            pointRadius: getDynamicPointRadius(2),
            pointHoverRadius: getDynamicPointHoverRadius(4),
            segment: tipoVisual === 'line' ? getDynamicSegmentColor('#4f46e5') : undefined,
            tension: obtenerTensionLinea(),
            spanGaps: true,
            order: 2
        });
    } else {
        if (sexo === 'ambos' || sexo === 'macho') {
            datasets.push({
                type: tipoVisual === 'bar' ? 'bar' : 'line',
                label: `Galpón ${item.galpon} M`,
                data: pM || item.dataMacho,
                borderColor: '#2563eb',
                backgroundColor: tipoVisual === 'bar' ? getDynamicBarBgColor('#2563eb') : 'rgba(37, 99, 235, 0.08)',
                borderWidth: tipoVisual === 'bar' ? 1 : 2,
                borderRadius: tipoVisual === 'bar' ? 4 : 0,
                borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                pointBackgroundColor: getDynamicPointBgColor(item, '#2563eb'),
                pointBorderColor: getDynamicPointBorderColor(item, '#2563eb'),
                pointBorderWidth: 1,
                pointRadius: getDynamicPointRadius(2),
                pointHoverRadius: getDynamicPointHoverRadius(4),
                segment: tipoVisual === 'line' ? getDynamicSegmentColor('#2563eb') : undefined,
                tension: obtenerTensionLinea(),
                spanGaps: true,
                order: 2
            });
        }

        if (sexo === 'ambos' || sexo === 'hembra') {
            datasets.push({
                type: tipoVisual === 'bar' ? 'bar' : 'line',
                label: `Galpón ${item.galpon} H`,
                data: pH || item.dataHembra,
                borderColor: '#ec4899',
                backgroundColor: tipoVisual === 'bar' ? getDynamicBarBgColor('#ec4899') : 'rgba(236, 72, 153, 0.08)',
                borderWidth: tipoVisual === 'bar' ? 1 : 2,
                borderRadius: tipoVisual === 'bar' ? 4 : 0,
                borderSkipped: tipoVisual === 'bar' ? 'bottom' : false,
                pointBackgroundColor: getDynamicPointBgColor(item, '#ec4899'),
                pointBorderColor: getDynamicPointBorderColor(item, '#ec4899'),
                pointBorderWidth: 1,
                pointRadius: getDynamicPointRadius(2),
                pointHoverRadius: getDynamicPointHoverRadius(4),
                segment: tipoVisual === 'line' ? getDynamicSegmentColor('#ec4899') : undefined,
                tension: obtenerTensionLinea(),
                spanGaps: true,
                order: 2
            });
        }
    }

    datasets.push({
        type: 'line',
        label: 'std',
        data: pS || item.dataStd,
        borderColor: '#16a34a',
        backgroundColor: '#16a34a',
        borderWidth: 1.8,
        borderDash: [6, 3],
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#16a34a',
        pointRadius: 1.5,
        tension: obtenerTensionLinea(),
        spanGaps: true,
        order: 1,
        _hcStdDs: true
    });

    return datasets;
}

function actualizarGraficoEspecifico(item) {
    const ctx = document.getElementById(item.canvasId);
    const chartExistente = (ctx && typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx) : null;
    const tipoVisual = obtenerTipoVisualEfectivo(item);

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'causas') {
        if (chartExistente) chartExistente.destroy();
        if (chartInstances[item.canvasId]) {
            chartInstances[item.canvasId].destroy();
            delete chartInstances[item.canvasId];
        }
        if (ctx) crearGraficoCausasMortalidad(item, ctx);
        return;
    }

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'pareto') {
        if (chartExistente) chartExistente.destroy();
        if (chartInstances[item.canvasId]) {
            chartInstances[item.canvasId].destroy();
            delete chartInstances[item.canvasId];
        }
        if (ctx) crearGraficoParetoMortalidad(item, ctx);
        return;
    }

    if (tipoVisual === 'doughnut' || tipoVisual === 'pie') {
        if (chartExistente) chartExistente.destroy();
        if (chartInstances[item.canvasId]) {
            chartInstances[item.canvasId].destroy();
            delete chartInstances[item.canvasId];
        }
        if (ctx) crearGraficoCircularChartJS(item, ctx, tipoVisual);
        return;
    }

    const chart = chartInstances[item.canvasId] || chartExistente;
    const expectedType = (tipoVisual === 'bar') ? 'bar' : 'line';
    if (!chart || chart.config.type !== expectedType) {
        if (chartExistente) chartExistente.destroy();
        if (chartInstances[item.canvasId]) {
            chartInstances[item.canvasId].destroy();
            delete chartInstances[item.canvasId];
        }
        crearGraficoChartJS(item);
        return;
    }

    let processedLabels = [...item.labels];
    const processedSeriesMap = [];

    if (Array.isArray(item.horasAplicacion) && item.horasAplicacion.length > 0 && item.dataHoras) {
        const processedHorasMap = {};
        item.horasAplicacion.forEach(h => {
            let dataH = [...(item.dataHoras[h] || [])];
            if (item.vistaActiva === 'acumulado') {
                dataH = calcularAcumulado(dataH);
            } else if (item.vistaActiva === 'semanal') {
                dataH = calcularSemanal(dataH);
            }
            processedHorasMap[h] = dataH;
        });

        let pStd = [...item.dataStd];
        if (item.vistaActiva === 'acumulado') {
            pStd = calcularAcumulado(item.dataStd);
        } else if (item.vistaActiva === 'semanal') {
            pStd = calcularSemanal(item.dataStd);
        }
        processedHorasMap.std = pStd;

        if (item.vistaActiva === 'semanal') {
            processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
        }

        let startIdx = 0;
        let endIdx = processedLabels.length - 1;
        if (item.vistaActiva !== 'semanal') {
            if (item.desdeVal !== 'inicio') {
                const idx = parseInt(item.desdeVal, 10);
                if (!isNaN(idx)) startIdx = idx;
            }
            if (item.hastaVal !== 'fin') {
                const idx = parseInt(item.hastaVal, 10);
                if (!isNaN(idx)) endIdx = idx;
            }
        }
        if (startIdx > endIdx) {
            const temp = startIdx;
            startIdx = endIdx;
            endIdx = temp;
        }

        const slicedHorasMap = {};
        item.horasAplicacion.forEach(h => {
            slicedHorasMap[h] = processedHorasMap[h] ? processedHorasMap[h].slice(startIdx, endIdx + 1) : null;
        });
        slicedHorasMap.std = processedHorasMap.std ? processedHorasMap.std.slice(startIdx, endIdx + 1) : null;

        chart.data.labels = processedLabels.slice(startIdx, endIdx + 1);
        chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedHorasMap);
        chart.update();
        return;
    }

    if (item.tipo === 'respiratorio') {
        let pEstM = [...(item.dataEstornudoM || [])];
        let pEstH = [...(item.dataEstornudoH || [])];
        let pRonM = [...(item.dataRonqueraM || [])];
        let pRonH = [...(item.dataRonqueraH || [])];

        if (item.vistaActiva === 'acumulado') {
            pEstM = calcularAcumulado(pEstM);
            pEstH = calcularAcumulado(pEstH);
            pRonM = calcularAcumulado(pRonM);
            pRonH = calcularAcumulado(pRonH);
        } else if (item.vistaActiva === 'semanal') {
            pEstM = (pEstM && pEstM.length > 7) ? calcularSemanal(pEstM) : [...pEstM];
            pEstH = (pEstH && pEstH.length > 7) ? calcularSemanal(pEstH) : [...pEstH];
            pRonM = (pRonM && pRonM.length > 7) ? calcularSemanal(pRonM) : [...pRonM];
            pRonH = (pRonH && pRonH.length > 7) ? calcularSemanal(pRonH) : [...pRonH];
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
        }

        let startIdx = 0;
        let endIdx = processedLabels.length - 1;
        if (item.desdeVal !== 'inicio') {
            const idx = parseInt(item.desdeVal, 10);
            if (!isNaN(idx)) startIdx = idx;
        }
        if (item.hastaVal !== 'fin') {
            const idx = parseInt(item.hastaVal, 10);
            if (!isNaN(idx)) endIdx = idx;
        }
        if (startIdx > endIdx) {
            const temp = startIdx;
            startIdx = endIdx;
            endIdx = temp;
        }

        const slicedRespiratorio = {
            estM: pEstM.slice(startIdx, endIdx + 1),
            estH: pEstH.slice(startIdx, endIdx + 1),
            ronM: pRonM.slice(startIdx, endIdx + 1),
            ronH: pRonH.slice(startIdx, endIdx + 1)
        };

        chart.data.labels = processedLabels.slice(startIdx, endIdx + 1);
        chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedRespiratorio);
        chart.update();
        return;
    }

    if (item.tipo === 'digestivo') {
        let pA = [...(item.dataDigestivoA || [])];
        let pP = [...(item.dataDigestivoP || [])];
        let pS = [...(item.dataDigestivoS || [])];
        let pR = [...(item.dataDigestivoR || [])];

        if (item.vistaActiva === 'acumulado') {
            const acum = (typeof calcularAcumuladoDigestivo === 'function')
                ? calcularAcumuladoDigestivo(pA, pP, pS, pR)
                : { A: calcularAcumulado(pA), P: calcularAcumulado(pP), S: calcularAcumulado(pS), R: calcularAcumulado(pR) };
            pA = acum.A;
            pP = acum.P;
            pS = acum.S;
            pR = acum.R;
        } else if (item.vistaActiva === 'semanal') {
            pA = (pA && pA.length > 7) ? calcularSemanal(pA) : [...pA];
            pP = (pP && pP.length > 7) ? calcularSemanal(pP) : [...pP];
            pS = (pS && pS.length > 7) ? calcularSemanal(pS) : [...pS];
            pR = (pR && pR.length > 7) ? calcularSemanal(pR) : [...pR];
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
        }

        let startIdx = 0;
        let endIdx = processedLabels.length - 1;
        if (item.desdeVal !== 'inicio') {
            const idx = parseInt(item.desdeVal, 10);
            if (!isNaN(idx)) startIdx = idx;
        }
        if (item.hastaVal !== 'fin') {
            const idx = parseInt(item.hastaVal, 10);
            if (!isNaN(idx)) endIdx = idx;
        }
        if (startIdx > endIdx) {
            const temp = startIdx;
            startIdx = endIdx;
            endIdx = temp;
        }

        const slicedDigestivo = {
            A: pA.slice(startIdx, endIdx + 1),
            P: pP.slice(startIdx, endIdx + 1),
            S: pS.slice(startIdx, endIdx + 1),
            R: pR.slice(startIdx, endIdx + 1)
        };

        chart.data.labels = processedLabels.slice(startIdx, endIdx + 1);
        chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedDigestivo);
        chart.update();
        return;
    }

    if (item.tipo === 'medicacion') {
        const metricas = Array.isArray(item.metricasMedicacion) && item.metricasMedicacion.length > 0
            ? item.metricasMedicacion
            : Object.keys(item.dataMedicacion || {});

        const processedMedicacion = {};
        metricas.forEach(mNombre => {
            const baseArr = (item.dataMedicacion && item.dataMedicacion[mNombre]) ? [...item.dataMedicacion[mNombre]] : [];
            let pArr = baseArr;
            if (item.vistaActiva === 'acumulado') {
                pArr = calcularAcumulado(baseArr);
            } else if (item.vistaActiva === 'semanal') {
                pArr = (baseArr && baseArr.length > 7) ? calcularSemanal(baseArr) : [...baseArr];
            }
            processedMedicacion[mNombre] = pArr;
        });

        if (item.vistaActiva === 'semanal') {
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil((item.labels || []).length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
        }

        let startIdx = 0;
        let endIdx = processedLabels.length - 1;
        if (item.desdeVal !== 'inicio') {
            const idx = parseInt(item.desdeVal, 10);
            if (!isNaN(idx)) startIdx = idx;
        }
        if (item.hastaVal !== 'fin') {
            const idx = parseInt(item.hastaVal, 10);
            if (!isNaN(idx)) endIdx = idx;
        }
        if (startIdx > endIdx) {
            const temp = startIdx;
            startIdx = endIdx;
            endIdx = temp;
        }

        const slicedMedicacion = {};
        metricas.forEach(mNombre => {
            const pArr = processedMedicacion[mNombre] || [];
            slicedMedicacion[mNombre] = pArr.slice(startIdx, endIdx + 1);
        });

        chart.data.labels = processedLabels.slice(startIdx, endIdx + 1);
        chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedMedicacion);
        chart.update();
        return;
    }

    if (item.esCombinado && Array.isArray(item.seriesList)) {
        item.seriesList.forEach(sObj => {
            let baseDataMacho = sObj.dataMacho;
            if (item.horaActiva && item.horaActiva !== 'todas' && sObj.dataHoras && sObj.dataHoras[item.horaActiva]) {
                baseDataMacho = sObj.dataHoras[item.horaActiva];
            }

            let pMacho = [...baseDataMacho];
            let pHembra = [...sObj.dataHembra];
            let pStd = [...sObj.dataStd];

            if (item.vistaActiva === 'acumulado') {
                pMacho = calcularAcumulado(baseDataMacho);
                pHembra = calcularAcumulado(sObj.dataHembra);
                pStd = calcularAcumulado(sObj.dataStd);
            } else if (item.vistaActiva === 'semanal') {
                pMacho = (baseDataMacho && baseDataMacho.length > 7) ? calcularSemanal(baseDataMacho) : [...baseDataMacho];
                pHembra = (sObj.dataHembra && sObj.dataHembra.length > 7) ? calcularSemanal(sObj.dataHembra) : [...sObj.dataHembra];
                pStd = (sObj.dataStd && sObj.dataStd.length > 7) ? calcularSemanal(sObj.dataStd) : [...sObj.dataStd];
            }

            processedSeriesMap.push({ macho: pMacho, hembra: pHembra, std: pStd });
        });

        if (item.vistaActiva === 'semanal') {
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
        }
    } else {
        let pMacho = [...item.dataMacho];
        let pHembra = [...item.dataHembra];
        let pStd = [...item.dataStd];

        if (item.vistaActiva === 'acumulado') {
            pMacho = calcularAcumulado(item.dataMacho);
            pHembra = calcularAcumulado(item.dataHembra);
            pStd = calcularAcumulado(item.dataStd);
        } else if (item.vistaActiva === 'semanal') {
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
            pMacho = (item.dataMacho && item.dataMacho.length > 7) ? calcularSemanal(item.dataMacho) : [...item.dataMacho];
            pHembra = (item.dataHembra && item.dataHembra.length > 7) ? calcularSemanal(item.dataHembra) : [...item.dataHembra];
            pStd = (item.dataStd && item.dataStd.length > 7) ? calcularSemanal(item.dataStd) : [...item.dataStd];
        }

        processedSeriesMap.push({ macho: pMacho, hembra: pHembra, std: pStd });
    }

    let startIdx = 0;
    let endIdx = processedLabels.length - 1;

    if (item.desdeVal !== 'inicio') {
        const idx = parseInt(item.desdeVal, 10);
        if (!isNaN(idx)) startIdx = idx;
    }
    if (item.hastaVal !== 'fin') {
        const idx = parseInt(item.hastaVal, 10);
        if (!isNaN(idx)) endIdx = idx;
    }

    if (startIdx > endIdx) {
        const temp = startIdx;
        startIdx = endIdx;
        endIdx = temp;
    }

    chart.data.labels = processedLabels.slice(startIdx, endIdx + 1);

    const slicedSeriesMap = processedSeriesMap.map(s => ({
        macho: s.macho ? s.macho.slice(startIdx, endIdx + 1) : null,
        hembra: s.hembra ? s.hembra.slice(startIdx, endIdx + 1) : null,
        std: s.std ? s.std.slice(startIdx, endIdx + 1) : null
    }));

    chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedSeriesMap);
    chart.update();
}

function poblarOpcionesDesdeHasta(item) {
    const selectDesde = document.querySelector(`.select-desde[data-chart="${item.canvasId}"]`);
    const selectHasta = document.querySelector(`.select-hasta[data-chart="${item.canvasId}"]`);

    if (selectDesde && selectDesde.options.length <= 1) {
        selectDesde.innerHTML = '<option value="inicio">Inicio</option>';
        item.labels.forEach((lbl, idx) => {
            selectDesde.innerHTML += `<option value="${idx}">${lbl}</option>`;
        });
        selectDesde.value = item.desdeVal;
        if (!selectDesde._hasChangeListener) {
            selectDesde._hasChangeListener = true;
            selectDesde.addEventListener('change', (e) => {
                item.desdeVal = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }

    if (selectHasta && selectHasta.options.length <= 1) {
        selectHasta.innerHTML = '<option value="fin">Fin</option>';
        item.labels.forEach((lbl, idx) => {
            selectHasta.innerHTML += `<option value="${idx}">${lbl}</option>`;
        });
        selectHasta.value = item.hastaVal;
        if (!selectHasta._hasChangeListener) {
            selectHasta._hasChangeListener = true;
            selectHasta.addEventListener('change', (e) => {
                item.hastaVal = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }
}

function inicializarFiltrosTarjeta(item) {
    poblarOpcionesDesdeHasta(item);

    const selectSexo = document.querySelector(`.select-sexo[data-chart="${item.canvasId}"]`);
    if (selectSexo) {
        selectSexo.value = item.sexoActiva || 'macho';
        if (!selectSexo._hasChangeListener) {
            selectSexo._hasChangeListener = true;
            selectSexo.addEventListener('change', (e) => {
                item.sexoActiva = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }

    const selectSigno = document.querySelector(`.select-signo[data-chart="${item.canvasId}"]`);
    if (selectSigno) {
        selectSigno.value = item.signoActivo || 'todos';
        if (!selectSigno._hasChangeListener) {
            selectSigno._hasChangeListener = true;
            selectSigno.addEventListener('change', (e) => {
                item.signoActivo = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }

    const selectHora = document.querySelector(`.select-hora[data-chart="${item.canvasId}"]`);
    if (selectHora) {
        selectHora.value = item.horaActiva || 'todas';
        if (!selectHora._hasChangeListener) {
            selectHora._hasChangeListener = true;
            selectHora.addEventListener('change', (e) => {
                item.horaActiva = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }

    const selectGrafico = document.querySelector(`.select-grafico[data-chart="${item.canvasId}"]`);
    if (selectGrafico) {
        selectGrafico.value = item.graficoActivo || 'linea';
        if (!selectGrafico._hasChangeListener) {
            selectGrafico._hasChangeListener = true;
            selectGrafico.addEventListener('change', (e) => {
                item.graficoActivo = e.target.value;
                actualizarGraficoEspecifico(item);
            });
        }
    }

    const btnsVista = document.querySelectorAll(`.btn-vista[data-chart="${item.canvasId}"]`);
    btnsVista.forEach(btn => {
        if (!btn._hasClickListener) {
            btn._hasClickListener = true;
            btn.addEventListener('click', () => {
                const vista = btn.getAttribute('data-vista');
                item.vistaActiva = vista;

                btnsVista.forEach(b => {
                    if (b === btn) {
                        b.className = 'btn-vista px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white shadow-sm transition-all';
                    } else {
                        b.className = 'btn-vista px-2.5 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 transition-all';
                    }
                });

                actualizarGraficoEspecifico(item);
            });
        }
    });
}

function crearGraficoChartJS(item) {
    const ctx = document.getElementById(item.canvasId);
    if (!ctx) return;

    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const chartExistente = Chart.getChart(ctx) || Chart.getChart(item.canvasId);
        if (chartExistente) {
            chartExistente.destroy();
        }
    }
    if (chartInstances[item.canvasId]) {
        chartInstances[item.canvasId].destroy();
        delete chartInstances[item.canvasId];
    }

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'causas') {
        crearGraficoCausasMortalidad(item, ctx);
        inicializarFiltrosTarjeta(item);
        return;
    }

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'pareto') {
        crearGraficoParetoMortalidad(item, ctx);
        inicializarFiltrosTarjeta(item);
        return;
    }

    const tipoVisual = obtenerTipoVisualEfectivo(item);

    if (tipoVisual === 'doughnut' || tipoVisual === 'pie') {
        crearGraficoCircularChartJS(item, ctx, tipoVisual);
        return;
    }

    const datasets = obtenerDatasetsSegunSexo(item);
    const pluginsList = typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels, tableauFocusHighlightPlugin] : [tableauFocusHighlightPlugin];

    const scalesConfig = {
        x: {
            grid: { color: '#f1f5f9' },
            ticks: {
                autoSkip: false,
                minRotation: 90,
                maxRotation: 90,
                font: (context) => {
                    const foco = context.chart ? context.chart.focoIndex : null;
                    if (foco != null && context.index === foco) {
                        return { family: 'Inter', size: 10, weight: '800' };
                    }
                    return { family: 'Inter', size: 9, weight: '600' };
                },
                color: (context) => {
                    const idx = context.index;
                    const foco = context.chart ? context.chart.focoIndex : null;

                    if (foco != null && idx !== foco) {
                        return '#cbd5e1';
                    }

                    if (item.tipo === 'nivel_cloro' || item.tipo === 'medicacion') {
                        return '#64748b';
                    }

                    const sexo = item.sexoActiva || 'macho';
                    const datasetData = (sexo === 'hembra') ? item.dataHembra : item.dataMacho;
                    const val = datasetData ? datasetData[idx] : null;
                    const stdVal = item.dataStd ? item.dataStd[idx] : null;

                    if (val == null || isNaN(val)) return '#94a3b8';
                    if (stdVal == null || isNaN(stdVal)) return '#64748b';
                    const cumple = seCumpleEstandar(item, idx, val, stdVal, sexo);
                    return cumple ? '#2563eb' : '#dc2626';
                }
            }
        }
    };

    if (item.tipo === 'respiratorio' || item.tipo === 'nivel_cloro') {
        scalesConfig.x.stacked = false;
    } else if (item.tipo === 'digestivo' || item.tipo === 'medicacion') {
        scalesConfig.x.stacked = true;
    }

    if (item.esCombinado && item.modoCombinado === 'granja') {
        scalesConfig.y = {
            type: 'linear',
            position: 'left',
            grace: '15%',
            title: {
                display: true,
                text: item.unidad || '',
                font: { family: 'Inter', size: 10, weight: '600' },
                color: '#2563eb'
            },
            grid: { color: '#f1f5f9' },
            border: { color: '#2563eb' },
            ticks: {
                font: { family: 'Inter', size: 10, weight: '600' },
                color: '#2563eb'
            }
        };
    } else if (item.esCombinado && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const paleta = PALETA_EJES[idx % PALETA_EJES.length];
            scalesConfig[paleta.axisId] = {
                type: 'linear',
                position: paleta.position,
                grace: '15%',
                title: {
                    display: true,
                    text: sObj.unidad || '',
                    font: { family: 'Inter', size: 10, weight: '600' },
                    color: paleta.color
                },
                grid: { drawOnChartArea: idx === 0, color: '#f1f5f9' },
                border: { color: paleta.color },
                ticks: {
                    font: { family: 'Inter', size: 10, weight: '600' },
                    color: paleta.color
                }
            };
        });
    } else {
        const unidadSimple = item.unidad || (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[item.tipo]?.unidad) || '';
        scalesConfig.y = {
            type: 'linear',
            position: 'left',
            stacked: item.tipo === 'digestivo' || item.tipo === 'medicacion',
            grace: (item.tipo === 'respiratorio' || item.tipo === 'digestivo' || item.tipo === 'nivel_cloro' || item.tipo === 'medicacion' || tipoVisual === 'bar') ? '22%' : '12%',
            title: {
                display: !!unidadSimple || item.tipo === 'medicacion',
                text: item.tipo === 'medicacion' ? 'unidades' : unidadSimple,
                font: { family: 'Inter', size: 10, weight: '600' },
                color: '#2563eb'
            },
            grid: { color: '#f1f5f9' },
            border: { color: '#e2e8f0' },
            ticks: { font: { family: 'Inter', size: 10, weight: '600' }, color: '#64748b' }
        };
    }

    const activeFocus = focoPorSeccionGlobal[item.tipo || 'mortalidad'];

    chartInstances[item.canvasId] = new Chart(ctx, {
        type: (tipoVisual === 'bar') ? 'bar' : 'line',
        data: {
            labels: item.labels,
            datasets: datasets
        },
        plugins: pluginsList,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 10,
                    bottom: 0,
                    left: 0,
                    right: 4
                }
            },
            onClick: (event, activeElements, chart) => {
                let clickedIndex = null;
                if (activeElements && activeElements.length > 0) {
                    clickedIndex = activeElements[0].index;
                } else if (chart.scales && chart.scales.x) {
                    const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
                    const val = chart.scales.x.getValueForPixel(canvasPosition.x);
                    if (val != null && !isNaN(val) && val >= 0 && val < chart.data.labels.length) {
                        clickedIndex = Math.round(val);
                    }
                }

                if (clickedIndex === null) return;

                const tipoKey = item.tipo || 'mortalidad';
                if (focoPorSeccionGlobal[tipoKey] === clickedIndex) {
                    focoPorSeccionGlobal[tipoKey] = null;
                } else {
                    focoPorSeccionGlobal[tipoKey] = clickedIndex;
                }

                aplicarFocoSeccion(tipoKey);
            },
            plugins: {
                datalabels: {
                    display: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        if (val == null || isNaN(val) || val === 0 || ctx.dataset._hcStdDs) return false;

                        const foco = ctx.chart ? ctx.chart.focoIndex : null;
                        if (foco != null && foco >= 0) {
                            return ctx.dataIndex === foco;
                        }
                        return true;
                    },
                    anchor: (item.tipo === 'digestivo' || item.tipo === 'medicacion') ? 'center' : 'end',
                    align: (item.tipo === 'digestivo' || item.tipo === 'medicacion') ? 'center' : 'top',
                    rotation: -90,
                    offset: (item.tipo === 'digestivo' || item.tipo === 'medicacion') ? 0 : 4,
                    color: (ctx) => {
                        if (item.tipo === 'medicacion') {
                            return '#ffffff';
                        }
                        if (item.tipo === 'digestivo') {
                            return '#0f172a';
                        }
                        if (item.tipo === 'respiratorio' || item.tipo === 'nivel_cloro') {
                            const ds = ctx.dataset;
                            return ds.borderColor || ds.backgroundColor || '#1e293b';
                        }
                        const ds = ctx.dataset;
                        if (ds.yAxisID && ds.yAxisID !== 'y') {
                            const paleta = PALETA_EJES.find(p => p.axisId === ds.yAxisID);
                            if (paleta) return paleta.color;
                        }
                        const val = ctx.dataset.data[ctx.dataIndex];
                        const stdVal = item.dataStd ? item.dataStd[ctx.dataIndex] : null;
                        const dsLabel = ds ? (ds.label || '') : '';
                        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';
                        const cumple = seCumpleEstandar(item, ctx.dataIndex, val, stdVal, sexoNode);
                        return cumple ? '#2563eb' : '#dc2626';
                    },
                    font: (ctx) => {
                        if (item.tipo === 'medicacion') {
                            return { family: 'Inter', size: 10, weight: '800' };
                        }
                        if (item.tipo === 'digestivo') {
                            return { family: 'Inter', size: 10.5, weight: '700' };
                        }
                        if (item.tipo === 'nivel_cloro') {
                            return { family: 'Inter', size: 8.5, weight: '700' };
                        }
                        return { family: 'Inter', size: 9, weight: '600' };
                    },
                    formatter: (val) => {
                        if (val == null || isNaN(val)) return '';
                        const n = parseFloat(val);
                        if (n === 0) return '0';
                        if (item.tipo === 'medicacion') return n.toFixed(2);
                        if (item.vistaActiva === 'acumulado' && item.tipo !== 'consumo_alimento' && item.tipo !== 'pesaje_pollo' && item.tipo !== 'ganancia_peso') return n.toFixed(2);
                        if (item.tipo === 'consumo_alimento' || item.tipo === 'pesaje_pollo' || item.tipo === 'ganancia_peso' || item.tipo === 'nivel_cloro' || n < 1) return n.toFixed(3);
                        return n.toFixed(2);
                    }
                },
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original', minRange: 3 }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 10
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.05
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: { family: 'Inter', size: 11, weight: '500' },
                        boxWidth: 8,
                        padding: 16,
                        generateLabels: (chart) => {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            const seen = new Set();
                            const filtered = [];
                            original.forEach(labelItem => {
                                const ds = chart.data.datasets[labelItem.datasetIndex];
                                if (ds) {
                                    labelItem.pointStyle = 'circle';
                                    labelItem.fillStyle = ds.borderColor || ds.backgroundColor;
                                    labelItem.strokeStyle = ds.borderColor;
                                    if (ds._hcStdDs && item.tipo === 'digestivo') {
                                        labelItem.text = 'Estándar';
                                    }
                                }
                                if (!seen.has(labelItem.text)) {
                                    seen.add(labelItem.text);
                                    filtered.push(labelItem);
                                }
                            });

                            if (item.tipo === 'digestivo') {
                                const ordenDeseado = ['Estándar', 'Rojas', 'Anaranjadas', 'Sueltas', 'Pastosas'];
                                filtered.sort((a, b) => {
                                    const idxA = ordenDeseado.indexOf(a.text);
                                    const idxB = ordenDeseado.indexOf(b.text);
                                    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                                });
                            }

                            return filtered;
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { family: 'Inter', size: 12, weight: '700' },
                    bodyFont: { family: 'Inter', size: 11 },
                    padding: 10,
                    filter: (ti) => !ti.dataset._hcStdDs,
                    callbacks: {
                        title: (items) => {
                            if (!items || !items.length) return '';
                            const idx = items[0].dataIndex;
                            const rawLbl = item.labels[idx] || '';
                            const cleanNum = rawLbl.replace(/^[DS]/, '');
                            const fechaTxt = item.dataFechas && item.dataFechas[idx] ? ` (${item.dataFechas[idx]})` : '';
                            const prefijo = item.vistaActiva === 'acumulado' ? 'Acum. Día ' : (item.vistaActiva === 'semanal' ? 'Semana ' : 'Día ');
                            return `${prefijo}${cleanNum || (idx + 1)}${fechaTxt}`;
                        },
                        label: (ctx) => {
                            const val = ctx.parsed.y;
                            if (val === null || val === undefined || isNaN(val)) return null;
                            const idx = ctx.dataIndex;

                            if (item.tipo === 'respiratorio' || item.tipo === 'digestivo') {
                                const dsLabel = ctx.dataset ? (ctx.dataset.label || '') : '';
                                const u = item.unidad || '';
                                return `${dsLabel}: ${parseFloat(val).toFixed(2)}${u ? ' ' + u : ''}`;
                            }

                            if (item.esCombinado) {
                                const dsLabel = ctx.dataset.label || '';
                                return `${dsLabel}: ${parseFloat(val).toFixed(2)}`;
                            }

                            const stdVal = item.dataStd ? item.dataStd[idx] : null;
                            const u = item.unidad || '%';
                            const dec = (item.tipo === 'consumo_alimento' || item.tipo === 'pesaje_pollo' || item.tipo === 'ganancia_peso' || item.tipo === 'nivel_cloro' || val < 1) ? 3 : 2;
                            const fmt = (n) => (n == null || isNaN(n)) ? '-' : `${parseFloat(n).toFixed(dec)} ${u}`;

                            const lines = [];
                            lines.push(`valor: ${fmt(val)}`);

                            if (stdVal != null && !isNaN(stdVal)) {
                                lines.push(`std: ${fmt(stdVal)}`);
                                const dif = val - stdVal;
                                const sign = dif > 0 ? '+' : '';
                                lines.push(`dif: ${sign}${fmt(dif)}`);

                                const dsLabel = ctx.dataset ? (ctx.dataset.label || '') : '';
                                const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';
                                const cumple = seCumpleEstandar(item, idx, val, stdVal, sexoNode);

                                if (!cumple) {
                                    lines.push(`alerta: Fuera de estándar`);
                                } else {
                                    lines.push(`alerta: Cumple estándar`);
                                }
                            }

                            return lines;
                        }
                    }
                }
            },
            scales: scalesConfig
        }
    });

    chartInstances[item.canvasId].focoIndex = (activeFocus !== undefined && activeFocus !== null) ? activeFocus : null;

    if (ctx && !ctx._hasZoomResetListener) {
        ctx._hasZoomResetListener = true;
        ctx.addEventListener('dblclick', () => {
            const inst = chartInstances[item.canvasId];
            if (inst && typeof inst.resetZoom === 'function') {
                inst.resetZoom();
            }
        });
    }

    inicializarFiltrosTarjeta(item);
}
