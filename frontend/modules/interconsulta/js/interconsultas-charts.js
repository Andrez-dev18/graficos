/**
 * Motor de Renderizado e Instanciación Chart.js (Soporta Línea, Causas Stacked, Diagrama de Pareto y N Ejes Y)
 */

/** Colores bien separados en matiz (modo combinado / multi-eje). Evita varios azules/teals confusos. */
const PALETA_EJES = [
    { axisId: 'y', position: 'left', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)' },
    { axisId: 'y1', position: 'right', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)' },
    { axisId: 'y2', position: 'left', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' },
    { axisId: 'y3', position: 'right', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)' },
    { axisId: 'y4', position: 'left', color: '#db2777', bg: 'rgba(219, 39, 119, 0.12)' },
    { axisId: 'y5', position: 'right', color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.12)' },
    { axisId: 'y6', position: 'left', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
    { axisId: 'y7', position: 'right', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' }
];

window.PALETA_EJES = PALETA_EJES;

/** Paleta categórica de alto contraste para gráficos combinados. Sin azules, cianes ni índigos: el estándar es azul. */
const PALETA_COMBINADO = [
    '#e11d48',
    '#65a30d',
    '#d97706',
    '#c026d3',
    '#15803d',
    '#f97316',
    '#be185d',
    '#a21caf',
    '#dc2626',
    '#4d7c0f',
    '#db2777',
    '#a16207',
    '#b45309',
    '#facc15',
    '#92400e',
    '#57534e'
];

let _colorCombinadoSeq = 0;

function reiniciarPaletaCombinado() {
    _colorCombinadoSeq = 0;
}

function colorCombinadoSiguiente() {
    const color = PALETA_COMBINADO[_colorCombinadoSeq % PALETA_COMBINADO.length];
    _colorCombinadoSeq++;
    return color;
}

function colorCombinadoRgba(hex, alpha) {
    const limpio = String(hex || '').replace('#', '');
    const full = limpio.length === 3 ? limpio.split('').map(ch => ch + ch).join('') : limpio;
    const n = parseInt(full, 16);
    if (isNaN(n)) return `rgba(37, 99, 235, ${alpha})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Tonos de un color base (claro → base) para segmentos apilados de una misma serie. */
function tonosDesdeColor(hex, n) {
    const total = Math.max(1, n);
    const limpio = String(hex || '').replace('#', '');
    const full = limpio.length === 3 ? limpio.split('').map(ch => ch + ch).join('') : limpio;
    const num = parseInt(full, 16);
    if (isNaN(num)) return new Array(total).fill(hex || '#2563eb');
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const out = [];
    for (let i = 0; i < total; i++) {
        const t = total === 1 ? 1 : (i / (total - 1));
        const mix = 0.55 - t * 0.55;
        out.push(`rgb(${Math.round(r + (255 - r) * mix)}, ${Math.round(g + (255 - g) * mix)}, ${Math.round(b + (255 - b) * mix)})`);
    }
    return out;
}

/** Clave de contenedor de leyenda agrupada por canvas. */
function claveLeyendaAgrupada(canvas) {
    return (canvas && canvas.id) ? canvas.id : 'ic-canvas';
}

function tarjetaDeCanvas(canvas) {
    if (!canvas || !canvas.closest) return null;
    return canvas.closest('[id^="card-grafico-"]') || canvas.closest('.chart-canvas-wrapper') || canvas.parentElement;
}

/** Parte del dataset dentro de su serie: quita el prefijo «Serie · ». */
function etiquetaParteSerieCombinada(label, serieLabel) {
    const txt = String(label || '');
    const pref = String(serieLabel || '') + ' · ';
    if (txt.indexOf(pref) === 0) return txt.slice(pref.length);
    return txt;
}

/** Agrupa datasets combinados por serie de origen para la leyenda. */
function agruparDatasetsLeyenda(datasets) {
    const grupos = [];
    const porIndice = new Map();
    (datasets || []).forEach((ds, i) => {
        if (!ds || ds._icSerieIdx == null) return;
        if (!porIndice.has(ds._icSerieIdx)) {
            const grupo = {
                indice: ds._icSerieIdx,
                label: ds._icSerieLabel || 'Serie',
                unidad: ds._icSerieUnidad || '',
                partes: []
            };
            porIndice.set(ds._icSerieIdx, grupo);
            grupos.push(grupo);
        }
        porIndice.get(ds._icSerieIdx).partes.push({
            datasetIndex: i,
            label: ds._icParteLabel || ds.label || '',
            color: ds.borderColor || ds.backgroundColor || '#64748b',
            esEstandar: Boolean(ds._hcStdDs)
        });
    });
    return grupos;
}

function leyendaAgrupadaUtil(grupos) {
    if (!Array.isArray(grupos) || !grupos.length) return false;
    return grupos.some(g => g.partes.filter(p => !p.esEstandar).length >= 2);
}

function alternarDatasetLeyenda(chart, datasetIndex) {
    if (!chart || typeof chart.setDatasetVisibility !== 'function') return;
    chart.setDatasetVisibility(datasetIndex, !chart.isDatasetVisible(datasetIndex));
    chart.update();
}

function alternarGrupoLeyenda(chart, grupo) {
    if (!chart || !grupo) return;
    const visibles = grupo.partes.filter(p => chart.isDatasetVisible(p.datasetIndex)).length;
    const destino = visibles === 0;
    grupo.partes.forEach(p => chart.setDatasetVisibility(p.datasetIndex, destino));
    chart.update();
}

function eliminarLeyendaAgrupada(canvas) {
    if (!canvas) return;
    const tarjeta = tarjetaDeCanvas(canvas);
    if (!tarjeta) return;
    const el = tarjeta.querySelector(`.ic-leyenda-agrupada[data-legend-for="${claveLeyendaAgrupada(canvas)}"]`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

/** Chip conmutador de la leyenda agrupada. */
function crearChipLeyendaAgrupada(chart, parte, texto) {
    const visible = chart.isDatasetVisible(parte.datasetIndex);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'flex items-center gap-1.5 text-[10px] font-medium cursor-pointer whitespace-nowrap '
        + (visible ? 'text-slate-700 hover:text-slate-900' : 'text-slate-400 line-through');

    const swatch = document.createElement('span');
    swatch.className = 'inline-block w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10';
    swatch.style.background = parte.color;

    const label = document.createElement('span');
    label.textContent = texto;

    chip.appendChild(swatch);
    chip.appendChild(label);
    chip.addEventListener('click', () => alternarDatasetLeyenda(chart, parte.datasetIndex));
    return chip;
}

/** Leyenda HTML de dos niveles (serie → partes) para gráficos combinados. */
function renderizarLeyendaAgrupada(chart) {
    const canvas = chart ? chart.canvas : null;
    if (!canvas) return;

    const grupos = agruparDatasetsLeyenda(chart.data.datasets);
    if (!leyendaAgrupadaUtil(grupos)) {
        eliminarLeyendaAgrupada(canvas);
        return;
    }

    const tarjeta = tarjetaDeCanvas(canvas);
    if (!tarjeta) return;

    const clave = claveLeyendaAgrupada(canvas);
    let cont = tarjeta.querySelector(`.ic-leyenda-agrupada[data-legend-for="${clave}"]`);
    if (!cont) {
        cont = document.createElement('div');
        cont.className = 'ic-leyenda-agrupada w-full px-1 pt-1.5 pb-1';
        cont.setAttribute('data-legend-for', clave);
        tarjeta.appendChild(cont);
    }

    const firma = grupos.map(g =>
        `${g.label}|${g.partes.map(p => `${p.label}:${p.color}:${chart.isDatasetVisible(p.datasetIndex) ? 1 : 0}`).join(',')}`
    ).join(';');
    if (cont.dataset.firma === firma) return;
    cont.dataset.firma = firma;

    cont.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'w-full flex flex-wrap items-center justify-center gap-x-6 gap-y-2';

    grupos.forEach(grupo => {
        const textoGrupo = grupo.unidad ? `${grupo.label} (${grupo.unidad})` : grupo.label;

        if (grupo.partes.length === 1) {
            const chip = crearChipLeyendaAgrupada(chart, grupo.partes[0], textoGrupo);
            chip.className = chip.className.replace('text-[10px] font-medium', 'text-[11px] font-semibold');
            wrap.appendChild(chip);
            return;
        }

        const grupoEl = document.createElement('div');
        grupoEl.className = 'flex flex-col items-center gap-1 min-w-0';

        const titulo = document.createElement('button');
        titulo.type = 'button';
        titulo.className = 'text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 cursor-pointer';
        titulo.textContent = textoGrupo;
        titulo.addEventListener('click', () => alternarGrupoLeyenda(chart, grupo));
        grupoEl.appendChild(titulo);

        const partesEl = document.createElement('div');
        partesEl.className = 'flex flex-wrap items-center justify-center gap-x-3 gap-y-1';

        grupo.partes.forEach(parte => {
            partesEl.appendChild(crearChipLeyendaAgrupada(chart, parte, parte.label));
        });

        grupoEl.appendChild(partesEl);
        wrap.appendChild(grupoEl);
    });

    cont.appendChild(wrap);
}

const icLeyendaAgrupadaPlugin = {
    id: 'icLeyendaAgrupada',
    afterRender: (chart) => {
        const cfg = chart.options && chart.options.plugins ? chart.options.plugins.icLeyendaAgrupada : null;
        if (!cfg || !cfg.enabled) return;
        renderizarLeyendaAgrupada(chart);
    },
    beforeDestroy: (chart) => {
        eliminarLeyendaAgrupada(chart.canvas);
    }
};

function estiloLineaCombinadaSexo(esHembra) {
    if (esHembra) {
        return { borderDash: [6, 4], borderWidth: 2 };
    }
    return { borderDash: [], borderWidth: 2 };
}

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

/* Franjas de estándar por bandas (respiratorio / digestivo). */
const IC_FRANJA_PALETA = {
    swatch: {
        3: ['#22c55e', '#eab308', '#ef4444'],
        4: ['#22c55e', '#84cc16', '#eab308', '#ef4444']
    },
    banda: {
        3: ['rgba(34, 197, 94, 0.18)', 'rgba(234, 179, 8, 0.16)', 'rgba(239, 68, 68, 0.20)'],
        4: ['rgba(34, 197, 94, 0.18)', 'rgba(132, 204, 22, 0.15)', 'rgba(234, 179, 8, 0.16)', 'rgba(239, 68, 68, 0.20)']
    },
    linea: {
        3: ['rgba(34, 197, 94, 0.85)', 'rgba(234, 179, 8, 0.90)', 'rgba(239, 68, 68, 0.85)'],
        4: ['rgba(34, 197, 94, 0.85)', 'rgba(132, 204, 22, 0.90)', 'rgba(234, 179, 8, 0.90)', 'rgba(239, 68, 68, 0.85)']
    }
};

function icFranjaColor(kind, count, idx) {
    const clave = (count === 4) ? 4 : 3;
    const arr = IC_FRANJA_PALETA[kind] ? IC_FRANJA_PALETA[kind][clave] : null;
    if (!arr || !arr.length) return '#64748b';
    return arr[idx < arr.length ? idx : arr.length - 1];
}

/** Slot de franja vigente del item: respiratorio (estornudo/ronquera), digestivo (A/P/S/R). */
function icFranjaSlotActivo(item) {
    const franjas = item ? item.franjas : null;
    if (!franjas) return null;
    if (item.tipo === 'respiratorio') {
        const signo = item.signoActivo || 'todos';
        if (signo === 'ronquera') return franjas.ronquera ? 'ronquera' : null;
        if (signo === 'estornudo') return franjas.estornudo ? 'estornudo' : null;
        if (franjas.estornudo) return 'estornudo';
        if (franjas.ronquera) return 'ronquera';
        return null;
    }
    const orden = ['R', 'A', 'P', 'S'];
    for (let i = 0; i < orden.length; i++) {
        if (franjas[orden[i]]) return orden[i];
    }
    return null;
}

/** Franja vigente del gráfico (serie combinada o item individual). */
function icFranjaMetaDeItem(item) {
    if (!item) return null;
    if (item.esCombinado && Array.isArray(item.seriesList)) {
        for (let i = 0; i < item.seriesList.length; i++) {
            const s = item.seriesList[i];
            const slot = icFranjaSlotActivo({ tipo: s.tipo, franjas: s.franjas, signoActivo: s.signoActivo });
            if (slot && s.franjas && s.franjas[slot]) {
                return { meta: s.franjas[slot], slot: slot, axisId: s.axisId || 'y' };
            }
        }
        return null;
    }
    const slot = icFranjaSlotActivo(item);
    if (!slot || !item.franjas[slot]) return null;
    return { meta: item.franjas[slot], slot: slot, axisId: 'y' };
}

/** Slot de franja a partir de la etiqueta del dataset. */
function icFranjaSlotPorDataset(item, dsLabel) {
    const txt = String(dsLabel || '');
    if (/Ronquera/i.test(txt)) return 'ronquera';
    if (/Estornudo/i.test(txt)) return 'estornudo';
    if (/Rojas/i.test(txt)) return 'R';
    if (/Anaranjadas/i.test(txt)) return 'A';
    if (/Sueltas/i.test(txt)) return 'S';
    if (/Pastosas/i.test(txt)) return 'P';
    return '';
}

/** Nombre de la franja a la que pertenece un valor. */
function icFranjaNombreValor(franjas, slot, val) {
    if (!franjas || !slot || val == null || isNaN(val)) return '';
    const meta = franjas[slot];
    if (!meta) return '';
    const cuts = Array.isArray(meta.cuts) ? meta.cuts : [];
    const labels = Array.isArray(meta.labels) ? meta.labels : [];
    if (!cuts.length || !labels.length) return '';
    let idx = 0;
    while (idx < cuts.length && Number(val) >= Number(cuts[idx])) idx++;
    return labels[idx] || '';
}

/** Chips de leyenda: nombre de banda (bandas) o valor de límite (líneas). */
function icFranjaChips(meta, modo) {
    const count = (meta && meta.count === 4) ? 4 : 3;
    const labels = (meta && Array.isArray(meta.labels)) ? meta.labels : [];
    const cuts = (meta && Array.isArray(meta.cuts)) ? meta.cuts : [];
    const out = [];
    if (modo === 'lineas') {
        cuts.forEach((c, i) => {
            out.push({ texto: `Límite ${c}`, color: icFranjaColor('linea', count, i) });
        });
        return out;
    }
    for (let b = 0; b < count; b++) {
        out.push({ texto: labels[b] || `Franja ${b + 1}`, color: icFranjaColor('swatch', count, b) });
    }
    return out;
}

/** Estándar unificado de heces (A/P/S/R comparten min/max); null si el catálogo no define estándar. */
function icStdUnificadoHeces(hecesEstandares, modoEvaluacion) {
    if (!hecesEstandares || typeof hecesEstandares !== 'object') return null;
    let min = null;
    let max = null;
    let modo = '';
    ['A', 'P', 'S', 'R'].forEach((k) => {
        const s = hecesEstandares[k];
        if (!s || typeof s !== 'object') return;
        const vMin = (s.min != null && isFinite(Number(s.min))) ? Number(s.min) : null;
        const vMax = (s.max != null && isFinite(Number(s.max))) ? Number(s.max) : null;
        if (vMin != null && (min === null || vMin < min)) min = vMin;
        if (vMax != null && (max === null || vMax > max)) max = vMax;
        if (!modo && s.modoEvaluacion) modo = String(s.modoEvaluacion);
    });
    if (min === null && max === null) return null;
    const modoEval = modo || modoEvaluacion || '';
    if (modoEval === 'solo_min') return min != null ? min : max;
    if (modoEval === 'solo_max') return max != null ? max : min;
    if (min != null && max != null) return (min + max) / 2;
    return min != null ? min : max;
}

function icFranjasVisibles(chart, n) {
    let arr = Array.isArray(chart._icFranjasVisibles) ? chart._icFranjasVisibles.slice() : [];
    for (let i = 0; i < n; i++) {
        if (arr[i] === undefined) arr[i] = true;
    }
    if (arr.length !== n) arr = arr.slice(0, n);
    return arr;
}

/* Bandas de fondo (individual) o líneas de umbral (combinado). */
const icFranjasPlugin = {
    id: 'icFranjas',
    beforeDatasetsDraw: (chart) => {
        const cfg = chart.options && chart.options.plugins ? chart.options.plugins.icFranjas : null;
        if (!cfg || !cfg.enabled || !cfg.meta) return;
        const area = chart.chartArea;
        const ctx = chart.ctx;
        if (!area || !ctx) return;
        const scale = chart.scales && chart.scales[cfg.axisId || 'y'];
        if (!scale) return;
        const meta = cfg.meta;
        const cuts = Array.isArray(meta.cuts) ? meta.cuts : [];
        if (cuts.length < 2) return;
        const count = (meta.count === 4) ? 4 : 3;
        const visibles = icFranjasVisibles(chart, cfg.modo === 'lineas' ? cuts.length : count);
        const xL = area.left;
        const xW = area.right - area.left;

        if (cfg.modo !== 'lineas') {
            const bounds = [Math.min(scale.min, cuts[0])];
            for (let i = 0; i < count - 1; i++) {
                bounds.push(cuts[i]);
            }
            bounds.push(Math.max(scale.max, cuts[count - 2]));
            for (let b = 0; b < count; b++) {
                if (visibles[b] === false) continue;
                const lo = bounds[b];
                const hi = bounds[b + 1];
                if (lo == null || hi == null) continue;
                const y1 = scale.getPixelForValue(hi);
                const y2 = scale.getPixelForValue(lo);
                if (!isFinite(y1) || !isFinite(y2)) continue;
                const top = Math.max(area.top, Math.min(y1, y2));
                const bot = Math.min(area.bottom, Math.max(y1, y2));
                if (bot - top < 0.5) continue;
                ctx.save();
                ctx.fillStyle = icFranjaColor('banda', count, b);
                ctx.fillRect(xL, top, xW, bot - top);
                ctx.restore();
            }
            return;
        }

        cuts.forEach((cut, i) => {
            if (visibles[i] === false) return;
            const y = scale.getPixelForValue(cut);
            if (!isFinite(y) || y < area.top || y > area.bottom) return;
            const color = icFranjaColor('linea', count, i);
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.4;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(xL, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = color;
            ctx.fillText(String(cut), area.right - 4, y - 2);
            ctx.restore();
        });
    }
};

function claveLeyendaFranjas(canvas) {
    return (canvas && canvas.id) ? canvas.id : 'ic-canvas';
}

function eliminarLeyendaFranjas(canvas) {
    if (!canvas) return;
    const tarjeta = tarjetaDeCanvas(canvas);
    if (!tarjeta) return;
    const el = tarjeta.querySelector(`.ic-leyenda-franjas[data-legend-for="${claveLeyendaFranjas(canvas)}"]`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

/** Leyenda conmutable de franjas del estándar. */
function renderizarLeyendaFranjas(chart) {
    const canvas = chart ? chart.canvas : null;
    if (!canvas) return;
    const cfg = chart.options && chart.options.plugins ? chart.options.plugins.icFranjas : null;
    if (!cfg || !cfg.enabled || !cfg.meta) {
        eliminarLeyendaFranjas(canvas);
        return;
    }
    const chips = icFranjaChips(cfg.meta, cfg.modo);
    if (!chips.length) {
        eliminarLeyendaFranjas(canvas);
        return;
    }
    const tarjeta = tarjetaDeCanvas(canvas);
    if (!tarjeta) return;

    const clave = claveLeyendaFranjas(canvas);
    let cont = tarjeta.querySelector(`.ic-leyenda-franjas[data-legend-for="${clave}"]`);
    if (!cont) {
        cont = document.createElement('div');
        cont.className = 'ic-leyenda-franjas w-full px-1 pt-1.5 pb-1';
        cont.setAttribute('data-legend-for', clave);
        tarjeta.appendChild(cont);
    }

    const visibles = icFranjasVisibles(chart, chips.length);
    const firma = chips.map((c, i) => `${c.texto}:${c.color}:${visibles[i] === false ? 0 : 1}`).join(',');
    if (cont.dataset.firma === firma) return;
    cont.dataset.firma = firma;
    cont.textContent = '';

    const wrap = document.createElement('div');
    wrap.className = 'w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5';

    chips.forEach((c, i) => {
        const visible = visibles[i] !== false;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'flex items-center gap-1.5 text-[10px] font-medium cursor-pointer whitespace-nowrap '
            + (visible ? 'text-slate-700 hover:text-slate-900' : 'text-slate-400 line-through');

        const swatch = document.createElement('span');
        swatch.className = 'inline-block w-2.5 h-2.5 rounded-sm shrink-0 border border-black/10';
        swatch.style.background = c.color;

        const label = document.createElement('span');
        label.textContent = c.texto;

        chip.appendChild(swatch);
        chip.appendChild(label);
        chip.addEventListener('click', () => {
            const arr = icFranjasVisibles(chart, chips.length).slice();
            arr[i] = arr[i] === false;
            chart._icFranjasVisibles = arr;
            chart.update('none');
        });
        wrap.appendChild(chip);
    });

    cont.appendChild(wrap);
}

const icLeyendaFranjasPlugin = {
    id: 'icLeyendaFranjas',
    afterRender: (chart) => {
        const cfg = chart.options && chart.options.plugins ? chart.options.plugins.icFranjas : null;
        if (!cfg || !cfg.enabled) return;
        renderizarLeyendaFranjas(chart);
    },
    beforeDestroy: (chart) => {
        eliminarLeyendaFranjas(chart.canvas);
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

function icStdValorNodo(item, idx, sexoNode) {
    if (!item || idx == null) return null;
    const arr = (sexoNode === 'hembra') ? item.dataStdH : item.dataStdM;
    if (Array.isArray(arr) && arr[idx] != null && !isNaN(arr[idx])) {
        return arr[idx];
    }
    return (item.dataStd && item.dataStd[idx] != null) ? item.dataStd[idx] : null;
}

function getDynamicPointBgColor(item, baseColorDefault = '#2563eb') {
    return (ctx) => {
        const dataset = ctx.dataset || (ctx.chart && ctx.chart.data && ctx.chart.data.datasets[ctx.datasetIndex]);
        if (dataset && dataset._hcStdDs) return baseColorDefault;

        const val = (dataset && dataset.data) ? dataset.data[ctx.dataIndex] : null;
        const dsLabel = dataset ? (dataset.label || '') : '';
        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';
        const stdVal = icStdValorNodo(item, ctx.dataIndex, sexoNode);

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
        const dsLabel = dataset ? (dataset.label || '') : '';
        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';
        const stdVal = icStdValorNodo(item, ctx.dataIndex, sexoNode);

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

function getDynamicSegmentColorProy(item, baseColor, sexKey) {
    const base = getDynamicSegmentColor(baseColor);
    return {
        borderColor: base.borderColor,
        borderDash: icSegmentProyDash(item, sexKey)
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

    if (item?.sexoActiva !== 'combinado') {
        const arrCumple = (sexoNode === 'hembra') ? item?.dataCumpleHembra : item?.dataCumpleMacho;
        if (arrCumple && arrCumple[idx] !== undefined && arrCumple[idx] !== null) {
            return Boolean(arrCumple[idx]);
        }
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

function soportaGraficoVarPct(item) {
    const SGS = window.SipGraficaShared;
    if (!SGS || !item) return false;
    if (item.esCombinado && Array.isArray(item.seriesList) && item.seriesList.length > 0) {
        return item.seriesList.some(s => SGS.soportaVarPct(s.tipo, { graficoActivo: item.graficoActivo || 'linea' }));
    }
    return SGS.soportaVarPct(item.tipo, { graficoActivo: item.graficoActivo || 'linea' });
}

window.soportaGraficoVarPct = soportaGraficoVarPct;

function itemGraficoLineaSoportaPctUi(item) {
    if (!soportaGraficoVarPct(item)) {
        return false;
    }
    if (item.tipo === 'mortalidad' && item.graficoActivo && item.graficoActivo !== 'linea') {
        return false;
    }
    if (typeof resolverTipoVisualItem === 'function') {
        const tv = resolverTipoVisualItem(item);
        if (tv === 'pie' || tv === 'doughnut') {
            return false;
        }
    }
    return true;
}

/** Añade checkbox «Grafico %» y canvas superior en tarjetas creadas antes del feature o sin re-render completo. */
function asegurarUiPctTarjeta(item, cardEl) {
    if (!item || !cardEl || !itemGraficoLineaSoportaPctUi(item)) {
        return false;
    }
    let changed = false;
    const toolbar = cardEl.querySelector('.flex.flex-wrap.items-center.gap-2.text-xs');
    if (toolbar && !cardEl.querySelector(`.chk-mostrar-pct-card[data-chart="${item.canvasId}"]`)) {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-1 cursor-pointer select-none text-xs font-medium text-slate-600';
        const checked = typeof icItemMuestraPct === 'function' ? icItemMuestraPct(item) : true;
        label.innerHTML = `<input type="checkbox" data-chart="${item.canvasId}" class="chk-mostrar-pct-card w-3.5 h-3.5 rounded text-blue-600"${checked ? ' checked' : ''}><span>Grafico %</span>`;
        const anchorProy = toolbar.querySelector('.chk-proy-pesaje');
        if (anchorProy && anchorProy.closest('label')) {
            anchorProy.closest('label').insertAdjacentElement('afterend', label);
        } else {
            toolbar.appendChild(label);
        }
        changed = true;
    }

    const canvasWrap = cardEl.querySelector('.chart-canvas-wrapper');
    if (canvasWrap && !cardEl.querySelector('.chart-stack')) {
        const pctHidden = typeof icItemMuestraPct === 'function' ? !icItemMuestraPct(item) : false;
        const stackEl = document.createElement('div');
        stackEl.className = 'chart-stack flex flex-col gap-0';
        const pctWrap = document.createElement('div');
        pctWrap.className = 'chart-pct-wrapper relative w-full h-[220px] overflow-hidden min-h-0' + (pctHidden ? ' hidden' : '');
        const pctCanvas = document.createElement('canvas');
        pctCanvas.id = item.canvasId + '-pct';
        pctWrap.appendChild(pctCanvas);
        stackEl.appendChild(pctWrap);
        canvasWrap.parentNode.insertBefore(stackEl, canvasWrap);
        stackEl.appendChild(canvasWrap);
        changed = true;
    }
    return changed;
}

window.asegurarUiPctTarjeta = asegurarUiPctTarjeta;
window.itemGraficoLineaSoportaPctUi = itemGraficoLineaSoportaPctUi;

function destruirGraficoVarPct(item) {
    if (!item || !item.canvasId) return;
    const SGS = window.SipGraficaShared;
    if (SGS) SGS.destroyPctChart(item.canvasId + '-pct', chartInstances);
}

function tooltipTituloDesdeItem(item, chart, dataIndex) {
    if (!item || !chart) return '';
    const rawLbl = (chart.data.labels && chart.data.labels[dataIndex]) || '';
    const cleanNum = String(rawLbl).replace(/^[DS]/, '');
    const origIdx = (item._displayStartIdx || 0) + dataIndex;
    const fechaTxt = item.dataFechas && item.dataFechas[origIdx] ? ` (${item.dataFechas[origIdx]})` : '';
    const prefijo = item.vistaActiva === 'acumulado' ? 'Acum. Día ' : (item.vistaActiva === 'semanal' ? 'Semana ' : 'Día ');
    return `${prefijo}${cleanNum || (origIdx + 1)}${fechaTxt}`;
}

function etiquetaSerieVarPct(item, sIdx, sexoSufijo) {
    if (item.esCombinado && item.seriesList && item.seriesList[sIdx]) {
        const tipoSerie = item.seriesList[sIdx].tipo;
        const cfg = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[tipoSerie])
            ? TIPO_GRAFICO_MAP[tipoSerie]
            : { label: tipoSerie || 'Serie' };
        const base = cfg.label;
        if (sexoSufijo === 'M' || sexoSufijo === 'H') {
            return `${base} ${sexoSufijo}`;
        }
        if (sexoSufijo === 'Prom') {
            return `${base} Prom`;
        }
        return base;
    }
    if (sexoSufijo === 'Prom') return 'Combinado (Prom)';
    return sexoSufijo === 'M' ? 'M' : 'H';
}

function colorSerieVarPct(item, sIdx, sexoSufijo) {
    if (item.esCombinado && typeof PALETA_EJES !== 'undefined') {
        const paleta = PALETA_EJES[sIdx % PALETA_EJES.length];
        if (paleta && paleta.color) return paleta.color;
    }
    if (sexoSufijo === 'Prom') return '#4f46e5';
    return sexoSufijo === 'H' ? '#ec4899' : '#2563eb';
}

function promedioSerieMh(arrM, arrH) {
    const a = arrM || [];
    const b = arrH || [];
    const maxLen = Math.max(a.length, b.length);
    const out = [];
    for (let i = 0; i < maxLen; i++) {
        const valM = (a[i] != null && !isNaN(a[i])) ? parseFloat(a[i]) : null;
        const valH = (b[i] != null && !isNaN(b[i])) ? parseFloat(b[i]) : null;
        let count = 0;
        let sum = 0;
        if (valM !== null) { sum += valM; count++; }
        if (valH !== null) { sum += valH; count++; }
        out.push(count === 0 ? null : parseFloat((sum / count).toFixed(4)));
    }
    return out;
}

/** Series % (data/cumple) del endpoint dedicado, alineadas al día (D1..Dn). */
function pctSeriesDesdeEndpoint(item, sexoKey, len) {
    const lista = Array.isArray(item.dataPctEndpoint) ? item.dataPctEndpoint : null;
    if (!lista || !lista.length) return null;
    const porDia = {};
    lista.forEach((n) => {
        if (n && n.dia != null) porDia[parseInt(n.dia, 10)] = n;
    });
    const startIdx = item._displayStartIdx || 0;
    const data = [];
    const cumple = [];
    let hay = false;
    for (let i = 0; i < len; i++) {
        const nodoDia = porDia[startIdx + i + 1];
        const n = nodoDia ? nodoDia[sexoKey] : null;
        if (n && n.pct != null && isFinite(Number(n.pct))) {
            data.push(Number(n.pct));
            cumple.push(n.cumple == null ? null : !!n.cumple);
            hay = true;
        } else {
            data.push(null);
            cumple.push(null);
        }
    }
    return hay ? { data: data, cumple: cumple } : null;
}

function construirSeriesVarPct(item, seriesMap) {
    const SGS = window.SipGraficaShared;
    if (!SGS || !Array.isArray(seriesMap) || !seriesMap.length) return [];

    const sexo = item.sexoActiva || (typeof sexoGlobal !== 'undefined' ? sexoGlobal : 'ambos');
    const evalFn = (actual, std, idx, sexoNode) => {
        const origIdx = (item._displayStartIdx || 0) + idx;
        return seCumpleEstandar(item, origIdx, actual, std, sexoNode);
    };
    const usarEndpoint = !item.esCombinado && seriesMap.length === 1 && sexo !== 'combinado'
        && (!item.vistaActiva || item.vistaActiva === 'diario')
        && Array.isArray(item.dataPctEndpoint) && item.dataPctEndpoint.length > 0;
    const out = [];

    seriesMap.forEach((sObj, sIdx) => {
        const stdArr = sObj.std || item.dataStd || [];
        if (sexo === 'combinado') {
            const pComb = promedioSerieMh(sObj.macho, sObj.hembra);
            if (pComb.length > 0) {
                const built = SGS.buildVarPctData(pComb, stdArr, (a, st, i) => evalFn(a, st, i, 'macho'));
                out.push({
                    label: etiquetaSerieVarPct(item, sIdx, 'Prom'),
                    data: built.data,
                    cumple: built.cumple,
                    borderColor: colorSerieVarPct(item, sIdx, 'Prom')
                });
            }
            return;
        }
        if (sexo === 'ambos' || sexo === 'macho') {
            const actualM = sObj.macho;
            if (Array.isArray(actualM)) {
                const epM = usarEndpoint ? pctSeriesDesdeEndpoint(item, 'macho', actualM.length) : null;
                const built = epM || SGS.buildVarPctData(actualM, stdArr, (a, st, i) => evalFn(a, st, i, 'macho'));
                out.push({
                    label: etiquetaSerieVarPct(item, sIdx, 'M'),
                    data: built.data,
                    cumple: built.cumple,
                    borderColor: colorSerieVarPct(item, sIdx, 'M')
                });
            }
        }
        if (sexo === 'ambos' || sexo === 'hembra') {
            const actualH = sObj.hembra;
            if (Array.isArray(actualH)) {
                const epH = usarEndpoint ? pctSeriesDesdeEndpoint(item, 'hembra', actualH.length) : null;
                const built = epH || SGS.buildVarPctData(actualH, stdArr, (a, st, i) => evalFn(a, st, i, 'hembra'));
                out.push({
                    label: etiquetaSerieVarPct(item, sIdx, 'H'),
                    data: built.data,
                    cumple: built.cumple,
                    borderColor: colorSerieVarPct(item, sIdx, 'H')
                });
            }
        }
    });

    return out;
}

function crearOActualizarGraficoVarPct(item, labels, seriesMap) {
    const SGS = window.SipGraficaShared;
    const pctId = item.canvasId + '-pct';
    const canvas = document.getElementById(pctId);
    const mostrarPct = typeof icItemMuestraPct === 'function' ? icItemMuestraPct(item) : true;

    if (!mostrarPct || !soportaGraficoVarPct(item) || !SGS || !canvas) {
        destruirGraficoVarPct(item);
        return;
    }

    const clavePctEndpoint = [item.tipo, item.granja, item.campania, item.galpon, item.graficoActivo || 'linea'].join('|');
    if (typeof icPctVarElegible === 'function' && icPctVarElegible(item) && item._pctEndpointClave !== clavePctEndpoint) {
        item._pctEndpointClave = clavePctEndpoint;
        icFetchPctVar(item).then((data) => {
            if (data && typeof actualizarGraficoEspecifico === 'function') {
                actualizarGraficoEspecifico(item);
            }
        });
    }

    const seriesList = construirSeriesVarPct(item, seriesMap);
    if (!seriesList.length) {
        destruirGraficoVarPct(item);
        return;
    }

    const useBar = seriesList.length > 1;
    const pctTipo = item.esCombinado && item.seriesList && item.seriesList.length === 1
        ? item.seriesList[0].tipo
        : item.tipo;
    const datasets = SGS.buildVarPctDatasets(seriesList, {
        useBar: useBar,
        tipo: pctTipo,
        spanGaps: typeof SGS.pctSpanGapsTipo === 'function' ? SGS.pctSpanGapsTipo(pctTipo) : false
    });
    const mainChart = chartInstances[item.canvasId];

    const tooltipTitleFn = (items) => tooltipTituloDesdeItem(item, items[0] && items[0].chart, items[0] ? items[0].dataIndex : 0);

    if (chartInstances[pctId]) {
        const pctChart = chartInstances[pctId];
        const eraBar = pctChart.config.type === 'bar';
        if (eraBar !== useBar) {
            destruirGraficoVarPct(item);
        } else {
            pctChart.data.labels = labels;
            pctChart.data.datasets = datasets;
            if (pctChart.options.plugins && pctChart.options.plugins.tooltip) {
                pctChart.options.plugins.tooltip.callbacks.title = tooltipTitleFn;
                if (typeof SGS.formatPctTooltipLabel === 'function') {
                    pctChart.options.plugins.tooltip.callbacks.label = (ctx) => SGS.formatPctTooltipLabel(ctx);
                }
                if (typeof SGS.formatPctTooltipLabelColor === 'function') {
                    pctChart.options.plugins.tooltip.callbacks.labelColor = (ctx) => SGS.formatPctTooltipLabelColor(ctx);
                }
            }
            if (typeof SGS.applyPctAdaptiveLayout === 'function') {
                const cardEl = canvas.closest('[id^="card-grafico-"]');
                const w = cardEl ? cardEl.clientWidth : (canvas.parentElement ? canvas.parentElement.clientWidth : 600);
                SGS.applyPctAdaptiveLayout(pctChart, { width: w });
            }
            pctChart.update('none');
            if (mainChart) SGS.finalizePctChartPair(mainChart, pctChart);
            return;
        }
    }

    const pctChart = SGS.createPctChart(pctId, labels, datasets, { hideXTicks: true, tooltipTitleFn, useBar: useBar });
    if (!pctChart) return;
    chartInstances[pctId] = pctChart;
    if (mainChart) SGS.finalizePctChartPair(mainChart, pctChart);
}

window.crearOActualizarGraficoVarPct = crearOActualizarGraficoVarPct;

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
    cv_peso: {
        label: 'CV de Pesaje de Pollo',
        unidad: '%',
        badgeBg: 'bg-fuchsia-50',
        badgeText: 'text-fuchsia-700',
        badgeBorder: 'border-fuchsia-200',
        iconSvg: `<svg class="w-4 h-4 text-fuchsia-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`
    },
    cv_ganancia: {
        label: 'CV de Ganancia',
        unidad: '%',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-700',
        badgeBorder: 'border-purple-200',
        iconSvg: `<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`
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
    },
    gorgojos: {
        label: 'Evaluación Gorgojos',
        unidad: 'n',
        chartType: 'bar',
        barMode: 'grouped',
        badgeBg: 'bg-lime-50',
        badgeText: 'text-lime-700',
        badgeBorder: 'border-lime-200',
        iconSvg: `<svg class="w-4 h-4 text-lime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    },
    roedores: {
        label: 'Evaluación Roedores',
        unidad: 'n',
        chartType: 'bar',
        barMode: 'grouped',
        badgeBg: 'bg-stone-50',
        badgeText: 'text-stone-700',
        badgeBorder: 'border-stone-200',
        iconSvg: `<svg class="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>`
    }
};

const PALETA_MEDICACIONES = [
    { bg: '#f87171', border: '#ef4444' },
    { bg: '#60a5fa', border: '#3b82f6' },
    { bg: '#4ade80', border: '#22c55e' },
    { bg: '#c084fc', border: '#a855f7' },
    { bg: '#fb923c', border: '#f97316' },
    { bg: '#2dd4bf', border: '#14b8a6' },
    { bg: '#fbbf24', border: '#f59e0b' },
    { bg: '#f472b6', border: '#ec4899' },
    { bg: '#94a3b8', border: '#64748b' },
    { bg: '#a78bfa', border: '#8b5cf6' }
];

const PALETA_CIRCULAR = [
    '#2563eb',
    '#ea580c',
    '#16a34a',
    '#9333ea',
    '#db2777',
    '#ca8a04',
    '#dc2626',
    '#64748b',
    '#0891b2',
    '#84cc16'
];

function crearGraficoCircularChartJS(item, ctx, tipoVisual) {
    destruirGraficoVarPct(item);
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
    return (item && (item.chartType || ((typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(item.tipo)) || item.tipo === 'respiratorio' || item.tipo === 'digestivo' ? 'bar' : 'line'))) || 'line';
}

function resolverTipoVisualItem(item) {
    const effective = obtenerTipoVisualEfectivo(item);
    if (item && item.esCombinado && item.tipo === 'combinado') {
        if (effective === 'bar' || effective === 'line' || effective === 'doughnut' || effective === 'pie') {
            return effective;
        }
        return 'line';
    }
    if (typeof combinadoConvierteBarraALinea === 'function' && combinadoConvierteBarraALinea(effective, item)) {
        return 'line';
    }
    return effective;
}

function itemGraficoUsaBarras(tipoVisual, item) {
    if (typeof visualizacionPermiteBarras === 'function') {
        return visualizacionPermiteBarras(tipoVisual, item);
    }
    return tipoVisual === 'bar';
}

function pushLineaCombinada(datasets, cfg) {
    datasets.push(Object.assign({
        type: 'line',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: obtenerTensionLinea(),
        spanGaps: true,
        fill: false,
        order: 2
    }, cfg));
}

/** Línea combinada con color categórico asignado por secuencia. */
function pushLineaCombinadaColor(datasets, cfg) {
    const color = colorCombinadoSiguiente();
    pushLineaCombinada(datasets, Object.assign({}, cfg, {
        borderColor: color,
        backgroundColor: colorCombinadoRgba(color, 0.12),
        pointBackgroundColor: color
    }));
}

function datasetsLineasDesdeSerieBarra(sObj, item, paleta, sexo, sIdx, processedSeriesMap) {
    const out = [];
    const axisId = paleta.axisId;
    const cfgTipo = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[sObj.tipo]) ? TIPO_GRAFICO_MAP[sObj.tipo] : { label: sObj.tipo };
    const pref = cfgTipo.label;
    const proc = processedSeriesMap && processedSeriesMap[sIdx] ? processedSeriesMap[sIdx] : null;
    const tipo = sObj.tipo;
    const mode = typeof barModeSerie === 'function' ? barModeSerie(tipo, sObj.barMode) : null;

    if (tipo === 'respiratorio') {
        const signo = item.signoActivo || 'todos';
        const pEstM = proc?.estM || sObj.dataEstornudoM || sObj.dataMacho;
        const pEstH = proc?.estH || sObj.dataEstornudoH || sObj.dataHembra;
        const pRonM = proc?.ronM || sObj.dataRonqueraM;
        const pRonH = proc?.ronH || sObj.dataRonqueraH;
        if (signo === 'todos' || signo === 'estornudo') {
            if (sexo === 'ambos' || sexo === 'macho') {
                pushLineaCombinadaColor(out, { label: `${pref} · Estornudo M`, data: pEstM || [], yAxisID: axisId });
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                pushLineaCombinadaColor(out, { label: `${pref} · Estornudo H`, data: pEstH || [], yAxisID: axisId });
            }
        }
        if (signo === 'todos' || signo === 'ronquera') {
            if (sexo === 'ambos' || sexo === 'macho') {
                pushLineaCombinadaColor(out, { label: `${pref} · Ronquera M`, data: pRonM || [], yAxisID: axisId });
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                pushLineaCombinadaColor(out, { label: `${pref} · Ronquera H`, data: pRonH || [], yAxisID: axisId });
            }
        }
        return out;
    }

    if (tipo === 'digestivo') {
        const parts = [
            { key: 'P', label: 'Pastosas', data: proc?.P || sObj.dataDigestivoP },
            { key: 'S', label: 'Sueltas', data: proc?.S || sObj.dataDigestivoS },
            { key: 'A', label: 'Anaranjadas', data: proc?.A || sObj.dataDigestivoA },
            { key: 'R', label: 'Rojas', data: proc?.R || sObj.dataDigestivoR }
        ];
        parts.forEach(p => {
            pushLineaCombinadaColor(out, {
                label: `${pref} · ${p.label}`,
                data: p.data || [],
                yAxisID: axisId
            });
        });
        return out;
    }

    if (tipo === 'medicacion') {
        const metricas = Array.isArray(sObj.metricasMedicacion) && sObj.metricasMedicacion.length
            ? sObj.metricasMedicacion
            : Object.keys(sObj.dataMedicacion || {});
        metricas.forEach((mNombre) => {
            const rawArr = (proc && proc[mNombre]) ? proc[mNombre] : ((sObj.dataMedicacion && sObj.dataMedicacion[mNombre]) ? sObj.dataMedicacion[mNombre] : []);
            pushLineaCombinadaColor(out, {
                label: `${pref} · ${mNombre}`,
                data: rawArr || [],
                yAxisID: axisId
            });
        });
        return out;
    }

    if (tipo === 'nivel_cloro' && sObj.dataHoras && (sObj.horasAplicacion || []).length) {
        const horas = (item.horaActiva && item.horaActiva !== 'todas')
            ? [item.horaActiva]
            : (sObj.horasAplicacion || []);
        horas.forEach((h) => {
            const raw = (sObj.dataHoras && sObj.dataHoras[h]) ? sObj.dataHoras[h] : [];
            pushLineaCombinadaColor(out, {
                label: `${pref} · ${h}`,
                data: raw,
                yAxisID: axisId
            });
        });
        return out;
    }

    if (tipo === 'gorgojos') {
        const medicion = sObj.plagaMedicion || item.plagaMedicion || 'todos';
        const sumFn = typeof sumarSeriesNumericas === 'function' ? sumarSeriesNumericas : null;
        const pLarM = sObj.dataLarvaM;
        const pLarH = sObj.dataLarvaH;
        const pAduM = sObj.dataAdultoM;
        const pAduH = sObj.dataAdultoH;
        if (medicion === 'larvas' || medicion === 'larva') {
            if (sexo === 'ambos' || sexo === 'macho') pushLineaCombinadaColor(out, { label: `${pref} · Larvas M`, data: pLarM || [], yAxisID: axisId });
            if (sexo === 'ambos' || sexo === 'hembra') pushLineaCombinadaColor(out, { label: `${pref} · Larvas H`, data: pLarH || [], yAxisID: axisId });
        } else if (medicion === 'adultos' || medicion === 'adulto') {
            if (sexo === 'ambos' || sexo === 'macho') pushLineaCombinadaColor(out, { label: `${pref} · Adultos M`, data: pAduM || [], yAxisID: axisId });
            if (sexo === 'ambos' || sexo === 'hembra') pushLineaCombinadaColor(out, { label: `${pref} · Adultos H`, data: pAduH || [], yAxisID: axisId });
        } else if (sumFn) {
            let totalM = sumFn(pLarM || [], pAduM || []);
            let totalH = sumFn(pLarH || [], pAduH || []);
            if (sexo === 'ambos' || sexo === 'macho') pushLineaCombinadaColor(out, { label: `${pref} · Total M`, data: totalM, yAxisID: axisId });
            if (sexo === 'ambos' || sexo === 'hembra') pushLineaCombinadaColor(out, { label: `${pref} · Total H`, data: totalH, yAxisID: axisId });
        }
        return out;
    }

    if (tipo === 'roedores') {
        const ambito = sObj.ambitoActivo || item.ambitoActivo || 'avistamiento';
        const medicion = sObj.plagaMedicion || item.plagaMedicion || 'todos';
        const sumFn = typeof sumarSeriesNumericas === 'function' ? sumarSeriesNumericas : null;
        if (ambito === 'consumo') {
            const pPer = sObj.dataPerimetro;
            const pTec = sObj.dataTecho;
            let pTot = sObj.dataConsumoTodos;
            if (typeof resolverSerieConsumoTodos === 'function') pTot = resolverSerieConsumoTodos(pTot, pPer, pTec);
            if (medicion === 'perimetro') pushLineaCombinadaColor(out, { label: `${pref} · Perímetro`, data: pPer || [], yAxisID: axisId });
            else if (medicion === 'techo') pushLineaCombinadaColor(out, { label: `${pref} · Techo`, data: pTec || [], yAxisID: axisId });
            else pushLineaCombinadaColor(out, { label: `${pref} · Consumo total`, data: pTot || [], yAxisID: axisId });
        } else {
            const pViv = sObj.dataVivos;
            const pMue = sObj.dataMuertos;
            if (medicion === 'vivos') pushLineaCombinadaColor(out, { label: `${pref} · Vivos`, data: pViv || [], yAxisID: axisId });
            else if (medicion === 'muertos') pushLineaCombinadaColor(out, { label: `${pref} · Muertos`, data: pMue || [], yAxisID: axisId });
            else if (sumFn) pushLineaCombinadaColor(out, { label: `${pref} · Total`, data: sumFn(pViv || [], pMue || []), yAxisID: axisId });
        }
        return out;
    }

    return null;
}

function pushBarCombinada(datasets, cfg) {
    datasets.push(Object.assign({
        type: 'bar',
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: 'bottom',
        barPercentage: 0.85,
        categoryPercentage: 0.85,
        order: 2
    }, cfg));
}

/** Barra combinada con color categórico asignado por secuencia. */
function pushBarCombinadaColor(datasets, cfg) {
    const color = colorCombinadoSiguiente();
    pushBarCombinada(datasets, Object.assign({}, cfg, {
        borderColor: color,
        backgroundColor: color,
        borderRadius: cfg && cfg.stack ? 0 : 4
    }));
}

function datasetsBarrasDesdeSerieBarra(sObj, item, paleta, sexo, sIdx, processedSeriesMap) {
    const out = [];
    const axisId = paleta.axisId;
    const cfgTipo = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[sObj.tipo]) ? TIPO_GRAFICO_MAP[sObj.tipo] : { label: sObj.tipo };
    const pref = cfgTipo.label;
    const proc = processedSeriesMap && processedSeriesMap[sIdx] ? processedSeriesMap[sIdx] : null;
    const tipo = sObj.tipo;
    const mode = typeof barModeSerie === 'function' ? barModeSerie(tipo, sObj.barMode) : null;
    const stackId = mode === 'stacked' ? `stack_${sIdx}` : undefined;

    if (tipo === 'digestivo') {
        [
            { label: 'Pastosas', data: proc?.P || sObj.dataDigestivoP },
            { label: 'Sueltas', data: proc?.S || sObj.dataDigestivoS },
            { label: 'Anaranjadas', data: proc?.A || sObj.dataDigestivoA },
            { label: 'Rojas', data: proc?.R || sObj.dataDigestivoR }
        ].forEach(p => {
            pushBarCombinadaColor(out, {
                label: `${pref} · ${p.label}`,
                data: p.data || [],
                yAxisID: axisId,
                stack: stackId,
                _icDigestivoStack: true
            });
        });
        return out;
    }

    if (tipo === 'medicacion') {
        const metricas = Array.isArray(sObj.metricasMedicacion) && sObj.metricasMedicacion.length
            ? sObj.metricasMedicacion
            : Object.keys(sObj.dataMedicacion || {});
        metricas.forEach((mNombre) => {
            const rawArr = (proc && proc[mNombre]) ? proc[mNombre] : ((sObj.dataMedicacion && sObj.dataMedicacion[mNombre]) ? sObj.dataMedicacion[mNombre] : []);
            pushBarCombinadaColor(out, {
                label: `${pref} · ${mNombre}`,
                data: rawArr || [],
                yAxisID: axisId,
                stack: stackId
            });
        });
        return out;
    }

    if (tipo === 'respiratorio') {
        const signo = item.signoActivo || 'todos';
        const pEstM = proc?.estM || sObj.dataEstornudoM;
        const pEstH = proc?.estH || sObj.dataEstornudoH;
        const pRonM = proc?.ronM || sObj.dataRonqueraM;
        const pRonH = proc?.ronH || sObj.dataRonqueraH;
        const mk = (label, data) => pushBarCombinadaColor(out, {
            label: `${pref} · ${label}`,
            data: data || [],
            yAxisID: axisId
        });
        if (signo === 'todos' || signo === 'estornudo') {
            if (sexo === 'ambos' || sexo === 'macho') mk('Estornudo M', pEstM);
            if (sexo === 'ambos' || sexo === 'hembra') mk('Estornudo H', pEstH);
        }
        if (signo === 'todos' || signo === 'ronquera') {
            if (sexo === 'ambos' || sexo === 'macho') mk('Ronquera M', pRonM);
            if (sexo === 'ambos' || sexo === 'hembra') mk('Ronquera H', pRonH);
        }
        return out;
    }

    if (tipo === 'nivel_cloro' && sObj.dataHoras && (sObj.horasAplicacion || []).length) {
        const horas = (item.horaActiva && item.horaActiva !== 'todas')
            ? [item.horaActiva]
            : (sObj.horasAplicacion || []);
        horas.forEach((h) => {
            const raw = (proc && proc[h]) ? proc[h] : ((sObj.dataHoras && sObj.dataHoras[h]) ? sObj.dataHoras[h] : []);
            pushBarCombinadaColor(out, {
                label: `${pref} · ${h}`,
                data: raw,
                yAxisID: axisId
            });
        });
        return out;
    }

    if (tipo === 'gorgojos' || tipo === 'roedores') {
        const lineas = datasetsLineasDesdeSerieBarra(sObj, item, paleta, sexo, sIdx, processedSeriesMap);
        if (!lineas || !lineas.length) return out;
        lineas.forEach(ln => {
            pushBarCombinada(out, {
                label: ln.label,
                data: ln.data || [],
                borderColor: ln.borderColor,
                backgroundColor: ln.borderColor,
                yAxisID: axisId
            });
        });
        return out;
    }

    return out;
}

/** Barras apiladas de una serie apilable (digestivo/medicacion) en modo combinado por granja. */
function datasetsBarrasApiladasGranja(sObj, item, paleta, sexo, sIdx) {
    const out = [];
    const cfgTipo = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[sObj.tipo]) ? TIPO_GRAFICO_MAP[sObj.tipo] : { label: sObj.tipo };
    const pref = sObj.infoBadge || cfgTipo.label;
    const stackId = `stack_${sIdx}`;

    const partes = [];
    if (sObj.tipo === 'digestivo') {
        partes.push({ label: 'Pastosas', data: sObj.dataDigestivoP });
        partes.push({ label: 'Sueltas', data: sObj.dataDigestivoS });
        partes.push({ label: 'Anaranjadas', data: sObj.dataDigestivoA });
        partes.push({ label: 'Rojas', data: sObj.dataDigestivoR });
    } else if (sObj.tipo === 'medicacion') {
        const metricas = Array.isArray(sObj.metricasMedicacion) && sObj.metricasMedicacion.length
            ? sObj.metricasMedicacion
            : Object.keys(sObj.dataMedicacion || {});
        metricas.forEach(mNombre => {
            partes.push({ label: mNombre, data: (sObj.dataMedicacion || {})[mNombre] });
        });
    }

    if (!partes.length) return out;

    const tonos = typeof tonosDesdeColor === 'function' ? tonosDesdeColor(paleta.color, partes.length) : [paleta.color];
    partes.forEach((p, k) => {
        const color = tonos[k % tonos.length];
        pushBarCombinada(out, {
            label: `${pref} · ${p.label}`,
            data: p.data || [],
            borderColor: color,
            backgroundColor: color,
            borderRadius: 0,
            yAxisID: 'y',
            stack: stackId,
            _icSerieIdx: sIdx,
            _icDigestivoStack: sObj.tipo === 'digestivo'
        });
    });

    return out;
}

function obtenerDatasetsSegunSexo(item, processedSeriesMap = null) {
    if (item && item.esCombinado && typeof reiniciarPaletaCombinado === 'function') {
        reiniciarPaletaCombinado();
    }
    const sexo = item.sexoActiva || 'macho';
    const tipoVisual = resolverTipoVisualItem(item);
    const usaBarras = itemGraficoUsaBarras(tipoVisual, item);
    const datasets = [];

    // MODO COMBINADO POR GRANJA / CAMPAÑA (BENCHMARKING)
    if (item.esCombinado && item.modoCombinado === 'granja' && Array.isArray(item.seriesList)) {
        item.seriesList.forEach((sObj, idx) => {
            const paleta = PALETA_EJES[idx % PALETA_EJES.length];

            if (typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(sObj.tipo)) {
                const apiladas = typeof datasetsBarrasApiladasGranja === 'function'
                    ? datasetsBarrasApiladasGranja(sObj, item, paleta, sexo, idx)
                    : [];
                if (apiladas.length) {
                    apiladas.forEach(ds => datasets.push(ds));
                    return;
                }
            }

            const rawM = (sObj.dataHoras && item.horaActiva && item.horaActiva !== 'todas' && sObj.dataHoras[item.horaActiva]) ? sObj.dataHoras[item.horaActiva] : sObj.dataMacho;
            const pMacho = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].macho : rawM;
            const pHembra = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].hembra : sObj.dataHembra;

            if (sexo === 'combinado') {
                const pComb = typeof promedioSerieMh === 'function'
                    ? promedioSerieMh(pMacho, pHembra)
                    : (pMacho || pHembra || []);
                datasets.push({
                    type: usaBarras ? 'bar' : 'line',
                    label: `${sObj.infoBadge} Prom`,
                    data: pComb,
                    borderColor: paleta.color,
                    backgroundColor: usaBarras ? paleta.color : paleta.bg,
                    borderWidth: usaBarras ? 1 : 2,
                    borderRadius: usaBarras ? 4 : 0,
                    borderSkipped: usaBarras ? 'bottom' : false,
                    pointBackgroundColor: paleta.color,
                    pointBorderColor: paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    tension: obtenerTensionLinea(),
                    yAxisID: 'y',
                    spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                    order: 2
                });
            } else {
                if (pMacho && (sexo === 'ambos' || sexo === 'macho')) {
                    datasets.push({
                        type: usaBarras ? 'bar' : 'line',
                        label: `${sObj.infoBadge} M`,
                        data: pMacho,
                        borderColor: paleta.color,
                        backgroundColor: usaBarras ? paleta.color : paleta.bg,
                        borderWidth: usaBarras ? 1 : 2,
                        borderRadius: usaBarras ? 4 : 0,
                        borderSkipped: usaBarras ? 'bottom' : false,
                        pointBackgroundColor: paleta.color,
                        pointBorderColor: paleta.color,
                        pointBorderWidth: 1,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        tension: obtenerTensionLinea(),
                        yAxisID: 'y',
                        spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                        order: 2
                    });
                }
                if (pHembra && (sexo === 'ambos' || sexo === 'hembra')) {
                    datasets.push({
                        type: usaBarras ? 'bar' : 'line',
                        label: `${sObj.infoBadge} H`,
                        data: pHembra,
                        borderColor: paleta.color,
                        backgroundColor: usaBarras ? paleta.color : paleta.bg,
                        borderWidth: usaBarras ? 1 : 2,
                        borderRadius: usaBarras ? 4 : 0,
                        borderSkipped: usaBarras ? 'bottom' : false,
                        pointBackgroundColor: paleta.color,
                        pointBorderColor: paleta.color,
                        pointBorderWidth: 1,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        tension: obtenerTensionLinea(),
                        yAxisID: 'y',
                        spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                        order: 2
                    });
                }
            }
        });

        const firstStd = processedSeriesMap && processedSeriesMap[0] ? processedSeriesMap[0].std : item.dataStd;
        if (firstStd && firstStd.some(v => v != null)) {
            datasets.push({
                type: 'line',
                label: 'Estándar',
                data: firstStd,
                borderColor: '#16a34a',
                backgroundColor: 'transparent',
                borderWidth: 1.8,
                borderDash: [6, 3],
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a',
                pointRadius: 0,
                pointHoverRadius: 0,
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
            const dsInicio = datasets.length;

            const rawM = (sObj.dataHoras && item.horaActiva && item.horaActiva !== 'todas' && sObj.dataHoras[item.horaActiva]) ? sObj.dataHoras[item.horaActiva] : sObj.dataMacho;
            const pMacho = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].macho : rawM;
            const pHembra = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].hembra : sObj.dataHembra;
            const pStd = processedSeriesMap && processedSeriesMap[idx] ? processedSeriesMap[idx].std : sObj.dataStd;

            const convierteBarraALinea = typeof combinadoConvierteBarraALinea === 'function'
                ? combinadoConvierteBarraALinea(tipoVisual, item)
                : !usaBarras;
            const esApiladaCombinada = typeof serieCombinadaApilada === 'function' && serieCombinadaApilada(item, sObj);
            let dsDesdeBarra = null;
            if (typeof esTipoGraficoBarras === 'function' && esTipoGraficoBarras(sObj.tipo)) {
                if (esApiladaCombinada && typeof datasetsBarrasDesdeSerieBarra === 'function') {
                    dsDesdeBarra = datasetsBarrasDesdeSerieBarra(sObj, item, paleta, sexo, idx, processedSeriesMap);
                } else if (convierteBarraALinea && typeof datasetsLineasDesdeSerieBarra === 'function') {
                    dsDesdeBarra = datasetsLineasDesdeSerieBarra(sObj, item, paleta, sexo, idx, processedSeriesMap);
                } else if (!convierteBarraALinea && typeof datasetsBarrasDesdeSerieBarra === 'function') {
                    dsDesdeBarra = datasetsBarrasDesdeSerieBarra(sObj, item, paleta, sexo, idx, processedSeriesMap);
                }
            }
            if (dsDesdeBarra && dsDesdeBarra.length) {
                dsDesdeBarra.forEach(ds => datasets.push(ds));
            } else if (sexo === 'combinado') {
                const pComb = typeof promedioSerieMh === 'function'
                    ? promedioSerieMh(pMacho, pHembra)
                    : (pMacho || pHembra || []);
                datasets.push({
                    type: usaBarras ? 'bar' : 'line',
                    label: `${cfg.label} Prom`,
                    data: pComb,
                    borderColor: paleta.color,
                    backgroundColor: usaBarras ? paleta.color : paleta.bg,
                    borderWidth: usaBarras ? 1 : 2,
                    borderRadius: usaBarras ? 4 : 0,
                    borderSkipped: usaBarras ? 'bottom' : false,
                    pointBackgroundColor: paleta.color,
                    pointBorderColor: paleta.color,
                    pointBorderWidth: 1,
                    pointRadius: 2,
                    pointHoverRadius: 4,
                    tension: obtenerTensionLinea(),
                    yAxisID: paleta.axisId,
                    spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                    order: 2
                });
            } else if (!dsDesdeBarra || !dsDesdeBarra.length) {
                if (pMacho && (sexo === 'ambos' || sexo === 'macho')) {
                    const estiloM = !usaBarras ? estiloLineaCombinadaSexo(false) : { borderDash: [], borderWidth: usaBarras ? 1 : 2 };
                    datasets.push({
                        type: usaBarras ? 'bar' : 'line',
                        label: `${cfg.label} M`,
                        data: pMacho,
                        borderColor: paleta.color,
                        backgroundColor: usaBarras ? paleta.color : paleta.bg,
                        borderWidth: estiloM.borderWidth,
                        borderDash: estiloM.borderDash,
                        borderRadius: usaBarras ? 4 : 0,
                        borderSkipped: usaBarras ? 'bottom' : false,
                        pointBackgroundColor: paleta.color,
                        pointBorderColor: paleta.color,
                        pointBorderWidth: 1,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        tension: obtenerTensionLinea(),
                        yAxisID: paleta.axisId,
                        spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                        order: 2
                    });
                }
                if (pHembra && (sexo === 'ambos' || sexo === 'hembra')) {
                    const estiloH = !usaBarras ? estiloLineaCombinadaSexo(true) : { borderDash: [], borderWidth: usaBarras ? 1 : 2 };
                    datasets.push({
                        type: usaBarras ? 'bar' : 'line',
                        label: `${cfg.label} H`,
                        data: pHembra,
                        borderColor: paleta.color,
                        backgroundColor: usaBarras ? paleta.color : paleta.bg,
                        borderWidth: estiloH.borderWidth,
                        borderDash: estiloH.borderDash,
                        borderRadius: usaBarras ? 4 : 0,
                        borderSkipped: usaBarras ? 'bottom' : false,
                        pointBackgroundColor: paleta.color,
                        pointBorderColor: paleta.color,
                        pointBorderWidth: 1,
                        pointRadius: 2,
                        pointHoverRadius: 4,
                        tension: obtenerTensionLinea(),
                        yAxisID: paleta.axisId,
                        spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                        order: 2
                    });
                }
            }
            if (pStd && pStd.some(v => v != null)) {
                datasets.push({
                    type: 'line',
                    label: `Estándar ${cfg.label}`,
                    data: pStd,
                    borderColor: paleta.color,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderDash: [5, 4],
                    pointBackgroundColor: paleta.color,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: obtenerTensionLinea(),
                    yAxisID: paleta.axisId,
                    spanGaps: true,
                    order: 1,
                    _hcStdDs: true
                });
            }

            for (let k = dsInicio; k < datasets.length; k++) {
                const ds = datasets[k];
                if (ds._icSerieIdx != null) continue;
                ds._icSerieIdx = idx;
                ds._icSerieLabel = cfg.label;
                ds._icSerieUnidad = sObj.unidad || '';
                ds._icParteLabel = ds._hcStdDs ? 'Estándar' : etiquetaParteSerieCombinada(ds.label, cfg.label);
            }
        });

        return datasets;
    }

    // MODO LECTURAS HORARIAS (NIVEL DE CLORO)
    if (item.tipo === 'nivel_cloro' || (Array.isArray(item.horasAplicacion) && item.horasAplicacion.length > 0 && item.dataHoras)) {
        const horasAMostrar = (item.horaActiva && item.horaActiva !== 'todas')
            ? [item.horaActiva]
            : (item.horasAplicacion && item.horasAplicacion.length > 0 ? item.horasAplicacion : ['06:00', '12:00', '16:00']);

        const isBar = usaBarras;

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
                spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                order: 2
            });
        });

        const pS = (processedSeriesMap && processedSeriesMap.std) ? processedSeriesMap.std : item.dataStd;
        if (pS && pS.some(v => v != null)) {
            datasets.push({
                type: 'line',
                label: 'Estándar',
                data: pS,
                borderColor: '#16a34a',
                backgroundColor: 'transparent',
                borderWidth: 1.8,
                borderDash: [6, 3],
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a',
                pointRadius: 0,
                pointHoverRadius: 0,
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
        const asLine = !usaBarras;

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

        const mkResp = (label, data, border, bg) => {
            if (asLine) {
                ds.push({
                    type: 'line',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg,
                    borderWidth: 2,
                    pointBackgroundColor: border,
                    pointBorderColor: border,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    spanGaps: true,
                    order: 2
                });
            } else {
                ds.push({
                    type: 'bar',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
        };

        if (signo === 'todos' || signo === 'estornudo') {
            if (sexo === 'ambos' || sexo === 'macho') {
                mkResp((sexo === 'ambos') ? `Estornudo M` : `Estornudo`, pEstM, colorEstM, colorEstM);
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                mkResp((sexo === 'ambos') ? `Estornudo H` : `Estornudo`, pEstH, colorEstH, colorEstH);
            }
        }

        if (signo === 'todos' || signo === 'ronquera') {
            if (sexo === 'ambos' || sexo === 'macho') {
                mkResp((sexo === 'ambos') ? `Ronquera M` : `Ronquera`, pRonM, borderRonM, colorRonM);
            }
            if (sexo === 'ambos' || sexo === 'hembra') {
                mkResp((sexo === 'ambos') ? `Ronquera H` : `Ronquera`, pRonH, borderRonH, colorRonH);
            }
        }

        return ds;
    }

    if (item.tipo === 'gorgojos') {
        const medicion = item.plagaMedicion || item.signoActivo || 'todos';
        const sexo = item.sexoActiva || 'macho';
        let pLarM = (processedSeriesMap && processedSeriesMap.larM) ? processedSeriesMap.larM : item.dataLarvaM;
        let pLarH = (processedSeriesMap && processedSeriesMap.larH) ? processedSeriesMap.larH : item.dataLarvaH;
        let pAduM = (processedSeriesMap && processedSeriesMap.aduM) ? processedSeriesMap.aduM : item.dataAdultoM;
        let pAduH = (processedSeriesMap && processedSeriesMap.aduH) ? processedSeriesMap.aduH : item.dataAdultoH;
        const ds = [];
        const asLine = !usaBarras;
        const mkGorg = (label, data, border, bg) => {
            if (asLine) {
                ds.push({
                    type: 'line',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg + '22',
                    borderWidth: 2,
                    pointBackgroundColor: border,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    spanGaps: true,
                    order: 2
                });
            } else {
                ds.push({
                    type: 'bar',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    order: 2
                });
            }
        };
        const sumFn = (typeof sumarSeriesNumericas === 'function') ? sumarSeriesNumericas : null;
        if (medicion === 'todos') {
            let totalData = [];
            if (sumFn) {
                if (sexo === 'macho') {
                    totalData = sumFn(pLarM || [], pAduM || []);
                } else if (sexo === 'hembra') {
                    totalData = sumFn(pLarH || [], pAduH || []);
                } else if (sexo === 'combinado') {
                    const promFn = (typeof promedioSeriesNumericas === 'function') ? promedioSeriesNumericas : sumFn;
                    const larProm = promFn(pLarM || [], pLarH || []);
                    const aduProm = promFn(pAduM || [], pAduH || []);
                    totalData = sumFn(larProm, aduProm);
                } else {
                    totalData = sumFn(pLarM || [], pAduM || [], pLarH || [], pAduH || []);
                }
            }
            mkGorg('Total (larvas + adultos)', totalData, '#84cc16', '#84cc16');
        } else if (medicion === 'larvas' || medicion === 'larva') {
            let larData = [];
            if (sumFn) {
                if (sexo === 'macho') larData = pLarM || [];
                else if (sexo === 'hembra') larData = pLarH || [];
                else if (sexo === 'combinado') larData = sumFn(pLarM || [], pLarH || []);
                else larData = sumFn(pLarM || [], pLarH || []);
            }
            mkGorg('Larvas', larData, '#2563eb', '#2563eb');
        } else if (medicion === 'adultos' || medicion === 'adulto') {
            let aduData = [];
            if (sumFn) {
                if (sexo === 'macho') aduData = pAduM || [];
                else if (sexo === 'hembra') aduData = pAduH || [];
                else if (sexo === 'combinado') aduData = sumFn(pAduM || [], pAduH || []);
                else aduData = sumFn(pAduM || [], pAduH || []);
            }
            mkGorg('Adultos', aduData, '#d97706', '#f59e0b');
        }
        return ds;
    }

    if (item.tipo === 'roedores') {
        const ambito = item.ambitoActivo || 'avistamiento';
        const medicion = item.plagaMedicion || 'todos';
        const ds = [];
        const asLine = !usaBarras;
        const mkRod = (label, data, border, bg) => {
            if (asLine) {
                ds.push({
                    type: 'line',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg + '22',
                    borderWidth: 2,
                    pointBackgroundColor: border,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    spanGaps: true,
                    order: 2
                });
            } else {
                ds.push({
                    type: 'bar',
                    label,
                    data: data || [],
                    borderColor: border,
                    backgroundColor: bg,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: 'bottom',
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    skipNull: false,
                    order: 2
                });
            }
        };
        if (ambito === 'consumo') {
            let pPer = (processedSeriesMap && processedSeriesMap.perimetro) ? processedSeriesMap.perimetro : item.dataPerimetro;
            let pTec = (processedSeriesMap && processedSeriesMap.techo) ? processedSeriesMap.techo : item.dataTecho;
            let pTot = (processedSeriesMap && processedSeriesMap.consumoTodos) ? processedSeriesMap.consumoTodos : item.dataConsumoTodos;
            if (typeof resolverSerieConsumoTodos === 'function') {
                pTot = resolverSerieConsumoTodos(pTot, pPer, pTec);
            }
            if (medicion === 'todos') {
                mkRod('Total (perímetro + techo)', pTot, '#2563eb', '#2563eb');
            } else if (medicion === 'perimetro') {
                mkRod('Perímetro', pPer, '#16a34a', '#16a34a');
            } else if (medicion === 'techo') {
                mkRod('Techo', pTec, '#0ea5e9', '#0ea5e9');
            }
        } else {
            let pViv = (processedSeriesMap && processedSeriesMap.vivos) ? processedSeriesMap.vivos : item.dataVivos;
            let pMue = (processedSeriesMap && processedSeriesMap.muertos) ? processedSeriesMap.muertos : item.dataMuertos;
            const sumFnRod = (typeof sumarSeriesNumericas === 'function') ? sumarSeriesNumericas : null;
            if (medicion === 'todos') {
                const totalRod = sumFnRod ? sumFnRod(pViv || [], pMue || []) : (pViv || []);
                mkRod('Total (vivos + muertos)', totalRod, '#78716c', '#78716c');
            } else if (medicion === 'vivos') {
                mkRod('Vivos', pViv, '#2563eb', '#2563eb');
            } else if (medicion === 'muertos') {
                mkRod('Muertos', pMue, '#dc2626', '#dc2626');
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
        const stdVal = (typeof icStdUnificadoHeces === 'function')
            ? icStdUnificadoHeces(item.hecesEstandares, item.modoEvaluacion)
            : null;

        if (stdVal != null) {
            ds.push({
                type: 'line',
                label: 'Estándar',
                data: Array(labelsCount).fill(stdVal),
                borderColor: '#16a34a',
                backgroundColor: 'transparent',
                borderWidth: 1.8,
                borderDash: [6, 3],
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0,
                yAxisID: 'y',
                spanGaps: true,
                order: 1,
                _hcStdDs: true
            });
        }

        const digParts = [
            { label: 'Pastosas', data: pP, color: '#eab308' },
            { label: 'Sueltas', data: pS, color: '#22c55e' },
            { label: 'Anaranjadas', data: pA, color: '#f97316' },
            { label: 'Rojas', data: pR, color: '#ef4444' }
        ];
        digParts.forEach(part => {
            if (!usaBarras) {
                ds.push({
                    type: 'line',
                    label: part.label,
                    data: part.data || [],
                    borderColor: part.color,
                    backgroundColor: part.color + '22',
                    borderWidth: 2,
                    pointBackgroundColor: part.color,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    spanGaps: true,
                    order: 2
                });
            } else {
                ds.push({
                    type: 'bar',
                    label: part.label,
                    data: part.data || [],
                    borderColor: part.color,
                    backgroundColor: part.color,
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.9,
                    categoryPercentage: 0.85,
                    minBarLength: 10,
                    stack: 'digestivoStack',
                    _icDigestivoStack: true,
                    order: 2
                });
            }
        });

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

            if (!usaBarras) {
                ds.push({
                    type: 'line',
                    label: mNombre,
                    data: rawArr || [],
                    borderColor: pal.border,
                    backgroundColor: pal.bg,
                    borderWidth: 2,
                    pointBackgroundColor: pal.border,
                    pointRadius: 2,
                    tension: obtenerTensionLinea(),
                    spanGaps: true,
                    order: 2
                });
            } else {
                ds.push({
                    type: 'bar',
                    label: mNombre,
                    data: rawArr || [],
                    borderColor: pal.border,
                    backgroundColor: pal.bg,
                    borderWidth: 2,
                    borderRadius: 4,
                    borderSkipped: false,
                    barPercentage: 0.92,
                    categoryPercentage: 0.88,
                    minBarLength: 10,
                    stack: 'medicacionStack',
                    order: 2
                });
            }
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
            type: usaBarras ? 'bar' : 'line',
            label: `Galpón ${item.galpon} Promedio (M+H)`,
            data: pComb,
            borderColor: '#4f46e5',
            backgroundColor: usaBarras ? getDynamicBarBgColor('#4f46e5') : 'rgba(79, 70, 229, 0.1)',
            borderWidth: usaBarras ? 1 : 2,
            borderRadius: usaBarras ? 4 : 0,
            borderSkipped: usaBarras ? 'bottom' : false,
            pointBackgroundColor: getDynamicPointBgColor(item, '#4f46e5'),
            pointBorderColor: getDynamicPointBorderColor(item, '#4f46e5'),
            pointBorderWidth: 1,
            pointRadius: getDynamicPointRadius(2),
            pointHoverRadius: getDynamicPointHoverRadius(4),
            segment: !usaBarras ? getDynamicSegmentColor('#4f46e5') : undefined,
            tension: obtenerTensionLinea(),
            spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
            order: 2
        });
    } else {
        if (sexo === 'ambos' || sexo === 'macho') {
            datasets.push({
                type: usaBarras ? 'bar' : 'line',
                label: `Galpón ${item.galpon} M`,
                data: pM || item.dataMacho,
                borderColor: '#2563eb',
                backgroundColor: usaBarras ? getDynamicBarBgColor('#2563eb') : 'rgba(37, 99, 235, 0.08)',
                borderWidth: usaBarras ? 1 : 2,
                borderRadius: usaBarras ? 4 : 0,
                borderSkipped: usaBarras ? 'bottom' : false,
                pointBackgroundColor: getDynamicPointBgColor(item, '#2563eb'),
                pointBorderColor: getDynamicPointBorderColor(item, '#2563eb'),
                pointBorderWidth: 1,
                pointRadius: getDynamicPointRadius(2),
                pointHoverRadius: getDynamicPointHoverRadius(4),
                segment: !usaBarras
                    ? (item.tipo === 'pesaje_pollo' && item._proyMask
                        ? getDynamicSegmentColorProy(item, '#2563eb', 'm')
                        : getDynamicSegmentColor('#2563eb'))
                    : undefined,
                tension: obtenerTensionLinea(),
                spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                order: 2
            });
        }

        if (sexo === 'ambos' || sexo === 'hembra') {
            datasets.push({
                type: usaBarras ? 'bar' : 'line',
                label: `Galpón ${item.galpon} H`,
                data: pH || item.dataHembra,
                borderColor: '#ec4899',
                backgroundColor: usaBarras ? getDynamicBarBgColor('#ec4899') : 'rgba(236, 72, 153, 0.08)',
                borderWidth: usaBarras ? 1 : 2,
                borderRadius: usaBarras ? 4 : 0,
                borderSkipped: usaBarras ? 'bottom' : false,
                pointBackgroundColor: getDynamicPointBgColor(item, '#ec4899'),
                pointBorderColor: getDynamicPointBorderColor(item, '#ec4899'),
                pointBorderWidth: 1,
                pointRadius: getDynamicPointRadius(2),
                pointHoverRadius: getDynamicPointHoverRadius(4),
                segment: !usaBarras
                    ? (item.tipo === 'pesaje_pollo' && item._proyMask
                        ? getDynamicSegmentColorProy(item, '#ec4899', 'h')
                        : getDynamicSegmentColor('#ec4899'))
                    : undefined,
                tension: obtenerTensionLinea(),
                spanGaps: typeof spanGapsSerieMedicion === 'function' ? spanGapsSerieMedicion(item, false, tipoVisual) : false,
                order: 2
            });
        }
    }

    /** Series de estándar: una por sexo cuando el catálogo distingue M/H. Sin nodos (solo mediciones llevan nodo). */
    const stdDsOpts = {
        type: 'line',
        borderColor: '#16a34a',
        backgroundColor: 'transparent',
        borderWidth: 1.8,
        borderDash: [6, 3],
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#16a34a',
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: obtenerTensionLinea(),
        spanGaps: true,
        order: 1,
        _hcStdDs: true
    };
    const stdUnico = pS || item.dataStd;
    const stdM = (processedSeriesMap && processedSeriesMap[0] && processedSeriesMap[0].stdM)
        ? processedSeriesMap[0].stdM
        : item.dataStdM;
    const stdH = (processedSeriesMap && processedSeriesMap[0] && processedSeriesMap[0].stdH)
        ? processedSeriesMap[0].stdH
        : item.dataStdH;
    const normStd = (v) => (v == null || isNaN(v)) ? null : Number(v);
    const stdDifieren = Array.isArray(stdM) && Array.isArray(stdH) && stdM.length === stdH.length
        && stdM.some((v, i) => {
            const a = normStd(v);
            const b = normStd(stdH[i]);
            if (a == null && b == null) return false;
            if (a == null || b == null) return true;
            return Math.abs(a - b) > 1e-9;
        });

    if (stdDifieren) {
        const hayM = stdM.some(v => v != null);
        const hayH = stdH.some(v => v != null);
        const verM = sexo === 'ambos' || sexo === 'macho';
        const verH = sexo === 'ambos' || sexo === 'hembra';
        if (verM && hayM) {
            datasets.push(Object.assign({}, stdDsOpts, { label: 'Estándar M', data: stdM }));
        }
        if (verH && hayH) {
            datasets.push(Object.assign({}, stdDsOpts, { label: 'Estándar H', data: stdH }));
        }
        if ((verM && !hayM) || (verH && !hayH)) {
            const refOtro = verM ? stdH : stdM;
            if (refOtro.some(v => v != null)) {
                datasets.push(Object.assign({}, stdDsOpts, { label: 'Estándar', data: refOtro }));
            }
        }
    } else if (stdUnico && stdUnico.some(v => v != null)) {
        datasets.push(Object.assign({}, stdDsOpts, { label: 'Estándar', data: stdUnico }));
    }

    return datasets;
}

function actualizarGraficoEspecifico(item) {
    if (item.tipo === 'pesaje_pollo') {
        if (item.proyActiva && Array.isArray(item.dataProyeccion)) {
            icAplicarProyeccionEnItem(item);
        } else if (!item.proyActiva && item._seriesBase) {
            icRestaurarSeriesBasePesaje(item);
        }
    }

    const ctx = document.getElementById(item.canvasId);
    const chartExistente = (ctx && typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(ctx) : null;
    const tipoVisual = resolverTipoVisualItem(item);

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'causas') {
        destruirGraficoVarPct(item);
        if (chartExistente) chartExistente.destroy();
        if (chartInstances[item.canvasId]) {
            chartInstances[item.canvasId].destroy();
            delete chartInstances[item.canvasId];
        }
        if (ctx) crearGraficoCausasMortalidad(item, ctx);
        return;
    }

    if (item.tipo === 'mortalidad' && item.graficoActivo === 'pareto') {
        destruirGraficoVarPct(item);
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
    const expectedType = itemGraficoUsaBarras(tipoVisual, item) ? 'bar' : 'line';
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

    if (item.tipo === 'gorgojos' || item.tipo === 'roedores') {
        const procArr = function (arr) {
            let p = [...(arr || [])];
            if (item.vistaActiva === 'acumulado') {
                return calcularAcumulado(p);
            }
            if (item.vistaActiva === 'semanal') {
                return (p.length > 7) ? calcularSemanal(p) : p;
            }
            return p;
        };
        if (item.vistaActiva === 'semanal') {
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
        }
        let startIdxP = 0;
        let endIdxP = processedLabels.length - 1;
        if (item.desdeVal !== 'inicio') {
            const idxP = parseInt(item.desdeVal, 10);
            if (!isNaN(idxP)) startIdxP = idxP;
        }
        if (item.hastaVal !== 'fin') {
            const idxP2 = parseInt(item.hastaVal, 10);
            if (!isNaN(idxP2)) endIdxP = idxP2;
        }
        if (startIdxP > endIdxP) {
            const tmpP = startIdxP;
            startIdxP = endIdxP;
            endIdxP = tmpP;
        }
        const slicedPlagas = {};
        if (item.tipo === 'gorgojos') {
            slicedPlagas.larM = procArr(item.dataLarvaM).slice(startIdxP, endIdxP + 1);
            slicedPlagas.larH = procArr(item.dataLarvaH).slice(startIdxP, endIdxP + 1);
            slicedPlagas.aduM = procArr(item.dataAdultoM).slice(startIdxP, endIdxP + 1);
            slicedPlagas.aduH = procArr(item.dataAdultoH).slice(startIdxP, endIdxP + 1);
        } else {
            slicedPlagas.vivos = procArr(item.dataVivos).slice(startIdxP, endIdxP + 1);
            slicedPlagas.muertos = procArr(item.dataMuertos).slice(startIdxP, endIdxP + 1);
            slicedPlagas.perimetro = procArr(item.dataPerimetro).slice(startIdxP, endIdxP + 1);
            slicedPlagas.techo = procArr(item.dataTecho).slice(startIdxP, endIdxP + 1);
            slicedPlagas.consumoTodos = procArr(item.dataConsumoTodos).slice(startIdxP, endIdxP + 1);
        }
        chart.data.labels = processedLabels.slice(startIdxP, endIdxP + 1);
        chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedPlagas);
        if (chart.options && chart.options.scales && chart.options.scales.y && chart.options.scales.y.title) {
            chart.options.scales.y.title.text = item.unidad || '';
        }
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
            slicedMedicacion[mNombre] = (processedMedicacion[mNombre] || []).slice(startIdx, endIdx + 1);
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

            let pMacho = [...(baseDataMacho || [])];
            let pHembra = [...(sObj.dataHembra || [])];
            let pStd = [...(sObj.dataStd || [])];

            if (item.vistaActiva === 'acumulado') {
                pMacho = calcularAcumulado(baseDataMacho);
                pHembra = calcularAcumulado(sObj.dataHembra);
                pStd = calcularAcumulado(sObj.dataStd);
            } else if (item.vistaActiva === 'semanal') {
                pMacho = (baseDataMacho && baseDataMacho.length > 7) ? calcularSemanal(baseDataMacho) : [...(baseDataMacho || [])];
                pHembra = (sObj.dataHembra && sObj.dataHembra.length > 7) ? calcularSemanal(sObj.dataHembra) : [...(sObj.dataHembra || [])];
                pStd = (sObj.dataStd && sObj.dataStd.length > 7) ? calcularSemanal(sObj.dataStd) : [...(sObj.dataStd || [])];
            }

            const entry = { macho: pMacho, hembra: pHembra, std: pStd };

            if (sObj.tipo === 'digestivo') {
                let pA = [...(sObj.dataDigestivoA || [])];
                let pP = [...(sObj.dataDigestivoP || [])];
                let pS = [...(sObj.dataDigestivoS || [])];
                let pR = [...(sObj.dataDigestivoR || [])];
                if (item.vistaActiva === 'acumulado') {
                    const acum = (typeof calcularAcumuladoDigestivo === 'function')
                        ? calcularAcumuladoDigestivo(pA, pP, pS, pR)
                        : { A: calcularAcumulado(pA), P: calcularAcumulado(pP), S: calcularAcumulado(pS), R: calcularAcumulado(pR) };
                    pA = acum.A; pP = acum.P; pS = acum.S; pR = acum.R;
                } else if (item.vistaActiva === 'semanal') {
                    pA = (pA.length > 7) ? calcularSemanal(pA) : pA;
                    pP = (pP.length > 7) ? calcularSemanal(pP) : pP;
                    pS = (pS.length > 7) ? calcularSemanal(pS) : pS;
                    pR = (pR.length > 7) ? calcularSemanal(pR) : pR;
                }
                entry.A = pA;
                entry.P = pP;
                entry.S = pS;
                entry.R = pR;
            }

            if (sObj.tipo === 'medicacion' && sObj.dataMedicacion) {
                const metricas = Array.isArray(sObj.metricasMedicacion) && sObj.metricasMedicacion.length
                    ? sObj.metricasMedicacion
                    : Object.keys(sObj.dataMedicacion);
                metricas.forEach(mNombre => {
                    let arr = [...(sObj.dataMedicacion[mNombre] || [])];
                    if (item.vistaActiva === 'acumulado') arr = calcularAcumulado(arr);
                    else if (item.vistaActiva === 'semanal' && arr.length > 7) arr = calcularSemanal(arr);
                    entry[mNombre] = arr;
                });
            }

            if (sObj.tipo === 'respiratorio') {
                entry.estM = [...(sObj.dataEstornudoM || [])];
                entry.estH = [...(sObj.dataEstornudoH || [])];
                entry.ronM = [...(sObj.dataRonqueraM || [])];
                entry.ronH = [...(sObj.dataRonqueraH || [])];
            }

            processedSeriesMap.push(entry);
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
        let pStdM = Array.isArray(item.dataStdM) ? [...item.dataStdM] : null;
        let pStdH = Array.isArray(item.dataStdH) ? [...item.dataStdH] : null;

        if (item.vistaActiva === 'acumulado') {
            pMacho = calcularAcumulado(item.dataMacho);
            pHembra = calcularAcumulado(item.dataHembra);
            pStd = calcularAcumulado(item.dataStd);
            if (pStdM) pStdM = calcularAcumulado(item.dataStdM);
            if (pStdH) pStdH = calcularAcumulado(item.dataStdH);
        } else if (item.vistaActiva === 'semanal') {
            if (item.labels && item.labels.length === 7) {
                processedLabels = [...item.labels];
            } else {
                processedLabels = Array.from({ length: Math.ceil(item.labels.length / 7) }, (_, i) => `Semana ${i + 1}`);
            }
            pMacho = (item.dataMacho && item.dataMacho.length > 7) ? calcularSemanal(item.dataMacho) : [...item.dataMacho];
            pHembra = (item.dataHembra && item.dataHembra.length > 7) ? calcularSemanal(item.dataHembra) : [...item.dataHembra];
            pStd = (item.dataStd && item.dataStd.length > 7) ? calcularSemanal(item.dataStd) : [...item.dataStd];
            if (pStdM) pStdM = (item.dataStdM.length > 7) ? calcularSemanal(item.dataStdM) : [...item.dataStdM];
            if (pStdH) pStdH = (item.dataStdH.length > 7) ? calcularSemanal(item.dataStdH) : [...item.dataStdH];
        }

        const entryBase = { macho: pMacho, hembra: pHembra, std: pStd };
        if (pStdM) entryBase.stdM = pStdM;
        if (pStdH) entryBase.stdH = pStdH;
        processedSeriesMap.push(entryBase);
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
    item._displayStartIdx = startIdx;

    const slicedSeriesMap = processedSeriesMap.map(s => {
        const out = {};
        Object.keys(s || {}).forEach(k => {
            const v = s[k];
            out[k] = Array.isArray(v) ? v.slice(startIdx, endIdx + 1) : v;
        });
        return out;
    });

    chart.data.datasets = obtenerDatasetsSegunSexo(item, slicedSeriesMap);
    chart.update();
    crearOActualizarGraficoVarPct(item, chart.data.labels, slicedSeriesMap);
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

function icGuardarSeriesBasePesaje(item) {
    if (item.tipo !== 'pesaje_pollo' || item._seriesBase) return;
    item._seriesBase = {
        labels: (item.labels || []).slice(),
        macho: (item.dataMacho || []).slice(),
        hembra: (item.dataHembra || []).slice(),
        std: (item.dataStd || []).slice()
    };
}

function icRestaurarSeriesBasePesaje(item) {
    if (!item._seriesBase) return;
    item.labels = item._seriesBase.labels.slice();
    item.dataMacho = item._seriesBase.macho.slice();
    item.dataHembra = item._seriesBase.hembra.slice();
    item.dataStd = item._seriesBase.std.slice();
    item._proyMask = null;
}

function icStdRefProyeccion(est, item) {
    if (!est) return null;
    const min = est.min != null && isFinite(Number(est.min)) ? Number(est.min) : null;
    const max = est.max != null && isFinite(Number(est.max)) ? Number(est.max) : null;
    const modo = item.modoEvaluacion || (item.tipo === 'pesaje_pollo' || item.tipo === 'ganancia_peso' ? 'solo_min' : 'solo_max');
    if (modo === 'solo_min') return min != null ? min : max;
    if (modo === 'solo_max') return max != null ? max : min;
    if (min != null && max != null) return (min + max) / 2;
    return min != null ? min : max;
}

function icAplicarProyeccionEnItem(item) {
    if (item.tipo !== 'pesaje_pollo' || !item.proyActiva || !Array.isArray(item.dataProyeccion)) return;
    icGuardarSeriesBasePesaje(item);
    icRestaurarSeriesBasePesaje(item);
    const proyByDia = {};
    item.dataProyeccion.forEach((pr) => {
        const d = parseInt(pr && pr.dia, 10);
        if (d > 0) proyByDia[d] = pr;
    });
    const maxDia = Math.max(item.labels.length, ...Object.keys(proyByDia).map(Number));
    while (item.labels.length < maxDia) {
        const d = item.labels.length + 1;
        item.labels.push('D' + d);
        item.dataMacho.push(null);
        item.dataHembra.push(null);
        if (item.dataStd) item.dataStd.push(null);
    }
    item._proyMask = { m: [], h: [] };
    for (let idx = 0; idx < item.labels.length; idx++) {
        const d = idx + 1;
        const pr = proyByDia[d];
        const hasRealM = item.dataMacho[idx] != null && !isNaN(item.dataMacho[idx]);
        const hasRealH = item.dataHembra[idx] != null && !isNaN(item.dataHembra[idx]);
        item._proyMask.m[idx] = false;
        item._proyMask.h[idx] = false;
        if (!pr) continue;
        if (!hasRealM && pr.macho && pr.macho.valor != null && isFinite(Number(pr.macho.valor))) {
            item.dataMacho[idx] = Number(pr.macho.valor);
            item._proyMask.m[idx] = true;
        }
        if (!hasRealH && pr.hembra && pr.hembra.valor != null && isFinite(Number(pr.hembra.valor))) {
            item.dataHembra[idx] = Number(pr.hembra.valor);
            item._proyMask.h[idx] = true;
        }
        const tieneProy = item._proyMask.m[idx] || item._proyMask.h[idx];
        if (tieneProy) {
            const estArr = Array.isArray(item.dataEstandarProy) ? item.dataEstandarProy
                : (Array.isArray(item.dataEstandarCatalog) ? item.dataEstandarCatalog : []);
            if (estArr.length > 0) {
                if (!item.dataStd) item.dataStd = [];
                const est = estArr.find((e) => parseInt(e.dia, 10) === d);
                const refStd = icStdRefProyeccion(est, item);
                if (refStd != null) {
                    item.dataStd[idx] = refStd;
                }
            }
        }
    }
}

const IC_PCT_ENDPOINT_TIPOS = ['mortalidad', 'consumo_alimento', 'consumo_gas', 'consumo_agua', 'pesaje_pollo', 'ganancia_peso'];

function icPctVarElegible(item) {
    if (!item || item.esCombinado || !item.tipo || !item.granja || !item.campania || !item.galpon) return false;
    if (IC_PCT_ENDPOINT_TIPOS.indexOf(item.tipo) === -1) return false;
    if (item.tipo === 'mortalidad' && item.graficoActivo && item.graficoActivo !== 'linea') return false;
    if ((item.sexoActiva || 'ambos') === 'combinado') return false;
    if (item.vistaActiva && item.vistaActiva !== 'diario') return false;
    return true;
}

window.icPctVarElegible = icPctVarElegible;

/** Variación % desde get_sip_grafica_pct.php (series servidor: pct/cumple/valor/std). */
async function icFetchPctVar(item) {
    item.dataPctEndpoint = null;
    if (!icPctVarElegible(item)) return null;
    const params = new URLSearchParams({
        tipo: item.tipo,
        granja: item.granja,
        campania: item.campania,
        galpon: item.galpon,
        sexo: 'ambos'
    });
    try {
        const res = await fetch(`../../backend/interconsulta/pct?${params.toString()}`, { credentials: 'same-origin' });
        const json = await res.json();
        item.dataPctEndpoint = (json && json.success && Array.isArray(json.dataPorDia)) ? json.dataPorDia : null;
    } catch (e) {
        item.dataPctEndpoint = null;
    }
    return item.dataPctEndpoint;
}

window.icFetchPctVar = icFetchPctVar;

async function icFetchProyeccionPesaje(item) {
    if (item.tipo !== 'pesaje_pollo' || !item.granja || !item.campania || !item.galpon) {
        item.dataProyeccion = null;
        return;
    }
    const params = new URLSearchParams({
        tipo: 'pesaje_pollo',
        granja: item.granja,
        campania: item.campania,
        galpon: item.galpon,
        sexo: item.sexoActiva || 'ambos'
    });
    try {
        const res = await fetch(`../../backend/interconsulta/proyeccion?${params.toString()}`, { credentials: 'same-origin' });
        const json = await res.json();
        if (json && json.success) {
            item.dataProyeccion = Array.isArray(json.dataProyeccion) ? json.dataProyeccion : null;
            item.dataEstandarProy = Array.isArray(json.dataEstandar) ? json.dataEstandar : null;
            item.campaniaAbierta = json.campaniaAbierta !== false;
        } else {
            item.dataProyeccion = null;
        }
    } catch (e) {
        item.dataProyeccion = null;
    }
}

function icSegmentProyDash(item, sexKey) {
    return function (ctx) {
        if (!item._proyMask) return undefined;
        const mask = item._proyMask[sexKey];
        if (!mask) return undefined;
        const idx = (item._displayStartIdx || 0) + ctx.p1DataIndex;
        if (mask[idx]) return [6, 4];
        return undefined;
    };
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

    const selectAmbito = document.querySelector(`.select-ambito-plaga[data-chart="${item.canvasId}"]`);
    const selectPlagaMed = document.querySelector(`.select-plaga-medicion[data-chart="${item.canvasId}"]`);
    function syncOpcionesRoedores() {
        if (!selectPlagaMed || item.tipo !== 'roedores') return;
        const ambito = item.ambitoActivo || 'avistamiento';
        const optsAvi = [
            { v: 'todos', t: 'Todos' },
            { v: 'vivos', t: 'Vivos' },
            { v: 'muertos', t: 'Muertos' }
        ];
        const optsCons = [
            { v: 'todos', t: 'Todos' },
            { v: 'perimetro', t: 'Perímetro' },
            { v: 'techo', t: 'Techo' }
        ];
        const opts = ambito === 'consumo' ? optsCons : optsAvi;
        const cur = item.plagaMedicion || 'todos';
        const ok = opts.some(o => o.v === cur);
        item.plagaMedicion = ok ? cur : 'todos';
        selectPlagaMed.innerHTML = opts.map(o => `<option value="${o.v}" ${item.plagaMedicion === o.v ? 'selected' : ''}>${o.t}</option>`).join('');
        item.unidad = (typeof unidadPlagasItem === 'function') ? unidadPlagasItem('roedores', ambito) : (ambito === 'consumo' ? '%' : 'n');
    }
    if (selectAmbito) {
        selectAmbito.value = item.ambitoActivo || 'avistamiento';
        if (!selectAmbito._hasChangeListener) {
            selectAmbito._hasChangeListener = true;
            selectAmbito.addEventListener('change', (e) => {
                item.ambitoActivo = e.target.value;
                item.plagaMedicion = 'todos';
                syncOpcionesRoedores();
                actualizarGraficoEspecifico(item);
            });
        }
    }
    if (selectPlagaMed) {
        if (item.tipo === 'roedores') syncOpcionesRoedores();
        else selectPlagaMed.value = item.plagaMedicion || 'todos';
        if (!selectPlagaMed._hasChangeListener) {
            selectPlagaMed._hasChangeListener = true;
            selectPlagaMed.addEventListener('change', (e) => {
                item.plagaMedicion = e.target.value;
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

    const chkPct = document.querySelector(`.chk-mostrar-pct-card[data-chart="${item.canvasId}"]`);
    if (chkPct && typeof soportaGraficoVarPct === 'function' && soportaGraficoVarPct(item)) {
        chkPct.checked = typeof icItemMuestraPct === 'function' ? icItemMuestraPct(item) : true;
        if (!chkPct._hasChangeListener) {
            chkPct._hasChangeListener = true;
            chkPct.addEventListener('change', (e) => {
                item.mostrarPctVar = e.target.checked;
                const card = document.getElementById(item.idCard);
                const pctWrap = card ? card.querySelector('.chart-pct-wrapper') : null;
                if (pctWrap) {
                    pctWrap.classList.toggle('hidden', !e.target.checked);
                }
                const reRenderPct = () => {
                    if (typeof actualizarGraficoEspecifico === 'function') {
                        actualizarGraficoEspecifico(item);
                    } else if (typeof crearGraficoChartJS === 'function') {
                        crearGraficoChartJS(item);
                    }
                    if (card && typeof aplicarAlturasAdaptativasCard === 'function') {
                        aplicarAlturasAdaptativasCard(card, false);
                    }
                };
                if (e.target.checked && typeof icFetchPctVar === 'function' && !item.dataPctEndpoint) {
                    icFetchPctVar(item).then(reRenderPct);
                } else {
                    reRenderPct();
                }
            });
        }
    }

    const chkProy = document.querySelector(`.chk-proy-pesaje[data-chart="${item.canvasId}"]`);
    if (chkProy) {
        chkProy.checked = !!item.proyActiva;
        chkProy.disabled = item.campaniaAbierta === false;
        if (!chkProy._hasChangeListener) {
            chkProy._hasChangeListener = true;
            chkProy.addEventListener('change', async (e) => {
                item.proyActiva = e.target.checked;
                if (item.proyActiva) {
                    await icFetchProyeccionPesaje(item);
                } else {
                    item.dataProyeccion = null;
                    icRestaurarSeriesBasePesaje(item);
                }
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
    if (item.tipo === 'pesaje_pollo') {
        icAplicarProyeccionEnItem(item);
    }
    const ctx = document.getElementById(item.canvasId);
    if (!ctx) return;

    destruirGraficoVarPct(item);

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

    const tipoVisual = resolverTipoVisualItem(item);
    const usaBarrasChart = itemGraficoUsaBarras(tipoVisual, item);

    if (tipoVisual === 'doughnut' || tipoVisual === 'pie') {
        crearGraficoCircularChartJS(item, ctx, tipoVisual);
        return;
    }

    const datasets = obtenerDatasetsSegunSexo(item);
    const stackedRoed = false;
    const pluginsList = typeof ChartDataLabels !== 'undefined'
        ? [ChartDataLabels, tableauFocusHighlightPlugin, icLeyendaAgrupadaPlugin, icFranjasPlugin, icLeyendaFranjasPlugin]
        : [tableauFocusHighlightPlugin, icLeyendaAgrupadaPlugin, icFranjasPlugin, icLeyendaFranjasPlugin];

    /* Franjas: bandas de fondo en tarjeta individual, líneas de umbral en combinado. */
    const franjaInfo = icFranjaMetaDeItem(item);
    const franjasOpts = franjaInfo
        ? {
            enabled: true,
            meta: franjaInfo.meta,
            slot: franjaInfo.slot,
            axisId: franjaInfo.axisId,
            modo: item.esCombinado ? 'lineas' : 'bandas'
        }
        : { enabled: false };

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

                    if (item.tipo === 'nivel_cloro') {
                        return '#64748b';
                    }

                    const sexo = item.sexoActiva || 'macho';
                    let val = null;
                    if (sexo === 'combinado') {
                        val = promedioSerieMh(item.dataMacho, item.dataHembra)[idx];
                    } else {
                        const datasetData = (sexo === 'hembra') ? item.dataHembra : item.dataMacho;
                        val = datasetData ? datasetData[idx] : null;
                    }
                    const stdVal = icStdValorNodo(item, idx, sexo === 'hembra' ? 'hembra' : 'macho');

                    if (val == null || isNaN(val)) return '#94a3b8';
                    if (stdVal == null || isNaN(stdVal)) return '#64748b';
                    const cumple = seCumpleEstandar(item, idx, val, stdVal, sexo === 'hembra' ? 'hembra' : 'macho');
                    return cumple ? '#2563eb' : '#dc2626';
                }
            }
        }
    };

    /** Etiqueta numérica dentro del cuerpo de la barra apilada de digestivo. */
    const esEtiquetaDentroBarraDigestivo = (ctx) => Boolean(ctx.dataset && ctx.dataset._icDigestivoStack);

    const gruposLeyenda = item.esCombinado ? agruparDatasetsLeyenda(datasets) : [];
    const usaLeyendaAgrupada = item.modoCombinado !== 'granja' && leyendaAgrupadaUtil(gruposLeyenda);

    if (item.esCombinado && Array.isArray(item.seriesList)) {
        scalesConfig.x.stacked = item.seriesList.some(sObj =>
            typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(sObj.tipo)
        );
    } else if (item.tipo === 'respiratorio' || item.tipo === 'nivel_cloro' || item.tipo === 'gorgojos') {
        scalesConfig.x.stacked = false;
    } else if ((item.tipo === 'digestivo' || item.tipo === 'medicacion') && usaBarrasChart) {
        scalesConfig.x.stacked = true;
    } else if (item.tipo === 'roedores') {
        scalesConfig.x.stacked = false;
    }

    if (item.esCombinado && item.modoCombinado === 'granja') {
        scalesConfig.y = {
            type: 'linear',
            position: 'left',
            stacked: item.seriesList.some(sObj =>
                typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(sObj.tipo)
            ),
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
            const esApiladaSerie = typeof serieCombinadaApilada === 'function' && serieCombinadaApilada(item, sObj);
            const stackEnEje = esApiladaSerie || (usaBarrasChart && typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(sObj.tipo));
            scalesConfig[paleta.axisId] = {
                type: 'linear',
                position: paleta.position,
                beginAtZero: true,
                stacked: stackEnEje,
                grace: stackEnEje ? '22%' : '15%',
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
        const esBarApilada = usaBarrasChart && (typeof esTipoBarraApilada === 'function' && esTipoBarraApilada(item.tipo));
        const suggestedMaxY = esBarApilada && typeof calcSuggestedMaxBarras === 'function'
            ? calcSuggestedMaxBarras(datasets)
            : undefined;
        scalesConfig.y = {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            stacked: (item.tipo === 'digestivo' || item.tipo === 'medicacion') && usaBarrasChart,
            grace: usaBarrasChart ? '22%' : '12%',
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
        if (suggestedMaxY != null) {
            scalesConfig.y.suggestedMax = suggestedMaxY;
        }
        /* Modo bandas: el eje cubre el último corte para que todas las franjas sean visibles. */
        if (franjasOpts.enabled && franjasOpts.modo === 'bandas') {
            const franjaCuts = Array.isArray(franjasOpts.meta.cuts) ? franjasOpts.meta.cuts : [];
            const topCut = franjaCuts.length ? Number(franjaCuts[franjaCuts.length - 1]) : null;
            if (topCut != null && isFinite(topCut)) {
                const topeActual = (scalesConfig.y.suggestedMax != null) ? Number(scalesConfig.y.suggestedMax) : 0;
                scalesConfig.y.suggestedMax = Math.max(topeActual, topCut) * 1.12;
                scalesConfig.y.suggestedMin = 0;
                scalesConfig.y.grace = '0%';
            }
        }
    }

    const activeFocus = focoPorSeccionGlobal[item.tipo || 'mortalidad'];

    if (usaLeyendaAgrupada) {
        eliminarLeyendaAgrupada(ctx.canvas);
    }

    chartInstances[item.canvasId] = new Chart(ctx, {
        type: usaBarrasChart ? 'bar' : 'line',
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
                    left: 6,
                    right: 8
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
                icFranjas: franjasOpts,
                icLeyendaAgrupada: {
                    enabled: usaLeyendaAgrupada
                },
                sipPlagasBarVis: {
                    enabled: (() => {
                        if (item.esCombinado && Array.isArray(item.seriesList)) {
                            return usaBarrasChart && item.seriesList.some(sObj =>
                                typeof esTipoBarraVisAyuda === 'function' && esTipoBarraVisAyuda(sObj.tipo)
                            );
                        }
                        return typeof esTipoBarraVisAyuda === 'function'
                            ? esTipoBarraVisAyuda(item.tipo)
                            : (item.tipo === 'gorgojos' || item.tipo === 'roedores');
                    })(),
                    minBarPx: 10,
                    minBarPxUnderOne: 18,
                    zeroBarPx: 5
                },
                datalabels: {
                    display: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        if (val == null || isNaN(val) || ctx.dataset._hcStdDs) return false;
                        if (val === 0) return false;

                        const foco = ctx.chart ? ctx.chart.focoIndex : null;
                        if (foco != null && foco >= 0) {
                            return ctx.dataIndex === foco;
                        }
                        return true;
                    },
                    anchor: (ctx) => (esEtiquetaDentroBarraDigestivo(ctx) || item.tipo === 'medicacion') ? 'center' : 'end',
                    align: (ctx) => (esEtiquetaDentroBarraDigestivo(ctx) || item.tipo === 'medicacion') ? 'center' : ((item.tipo === 'gorgojos' || item.tipo === 'roedores') ? 'end' : 'top'),
                    rotation: -90,
                    clip: true,
                    offset: (ctx) => (esEtiquetaDentroBarraDigestivo(ctx) || item.tipo === 'medicacion') ? 0 : ((item.tipo === 'gorgojos' || item.tipo === 'roedores') ? 18 : 4),
                    color: (ctx) => {
                        if (esEtiquetaDentroBarraDigestivo(ctx)) {
                            return '#ffffff';
                        }
                        if (item.tipo === 'digestivo') {
                            return '#0f172a';
                        }
                        if (item.tipo === 'nivel_cloro' || item.tipo === 'medicacion') {
                            return '#64748b';
                        }
                        if (item.tipo === 'respiratorio' || item.tipo === 'gorgojos' || item.tipo === 'roedores') {
                            const ds = ctx.dataset;
                            return ds.borderColor || ds.backgroundColor || '#1e293b';
                        }
                        const ds = ctx.dataset;
                        if (ds.yAxisID && ds.yAxisID !== 'y') {
                            const paleta = PALETA_EJES.find(p => p.axisId === ds.yAxisID);
                            if (paleta) return paleta.color;
                        }
                        const val = ctx.dataset.data[ctx.dataIndex];
                        const dsLabel = ds ? (ds.label || '') : '';
                        const sexoNode = dsLabel.endsWith(' H') ? 'hembra' : 'macho';
                        const stdVal = icStdValorNodo(item, ctx.dataIndex, sexoNode);
                        const cumple = seCumpleEstandar(item, ctx.dataIndex, val, stdVal, sexoNode);
                        return cumple ? '#2563eb' : '#dc2626';
                    },
                    font: (ctx) => {
                        if (esEtiquetaDentroBarraDigestivo(ctx) || item.tipo === 'digestivo' || item.tipo === 'medicacion') {
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
                legend: (() => {
                    const opts = (typeof SipGraficaShared !== 'undefined' && SipGraficaShared.buildChartLegendOptions)
                        ? SipGraficaShared.buildChartLegendOptions({
                            sortOrder: item.tipo === 'digestivo'
                                ? ['Rojas', 'Anaranjadas', 'Sueltas', 'Pastosas']
                                : null,
                            useDatasetColors: Boolean(item.esCombinado || item.tipo === 'digestivo' || item.tipo === 'medicacion'),
                            includeEstandar: true
                        })
                        : { position: 'bottom', display: true };
                    if (usaLeyendaAgrupada) opts.display = false;
                    return opts;
                })(),
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
                            return tooltipTituloDesdeItem(item, items[0].chart, items[0].dataIndex);
                        },
                        label: (ctx) => {
                            const val = ctx.parsed.y;
                            if (val === null || val === undefined || isNaN(val)) return null;
                            const origIdx = (item._displayStartIdx || 0) + ctx.dataIndex;

                            if (item.tipo === 'respiratorio' || item.tipo === 'digestivo' || item.tipo === 'gorgojos' || item.tipo === 'roedores') {
                                const dsLabel = ctx.dataset ? (ctx.dataset.label || '') : '';
                                const u = item.unidad || '';
                                const slotFr = icFranjaSlotPorDataset(item, dsLabel);
                                const nomFr = icFranjaNombreValor(item.franjas, slotFr, val);
                                const sufijoFr = nomFr ? ` · ${nomFr}` : '';
                                return `${dsLabel}: ${parseFloat(val).toFixed(2)}${u ? ' ' + u : ''}${sufijoFr}`;
                            }

                            if (item.esCombinado) {
                                const dsLabel = ctx.dataset.label || '';
                                let u = '';
                                let franjasSerie = null;
                                if (Array.isArray(item.seriesList)) {
                                    const serie = item.seriesList.find((s) => {
                                        const cfgS = (typeof TIPO_GRAFICO_MAP !== 'undefined' && TIPO_GRAFICO_MAP[s.tipo])
                                            ? TIPO_GRAFICO_MAP[s.tipo]
                                            : { label: s.tipo || '' };
                                        return dsLabel.startsWith(cfgS.label) || dsLabel.startsWith(String(s.infoBadge || ''));
                                    });
                                    if (serie && serie.unidad) u = serie.unidad;
                                    if (serie) franjasSerie = serie.franjas || null;
                                }
                                const dec = val < 1 ? 3 : 2;
                                const slotFrComb = icFranjaSlotPorDataset(item, dsLabel);
                                const nomFrComb = icFranjaNombreValor(franjasSerie, slotFrComb, val);
                                const sufijoFrComb = nomFrComb ? ` · ${nomFrComb}` : '';
                                return `${dsLabel}: ${parseFloat(val).toFixed(dec)}${u ? ' ' + u : ''}${sufijoFrComb}`;
                            }

                            const dsLabelStd = ctx.dataset ? (ctx.dataset.label || '') : '';
                            const stdVal = icStdValorNodo(item, origIdx, dsLabelStd.endsWith(' H') ? 'hembra' : 'macho');
                            const SGA = window.SipGraficaAlertas;
                            if (SGA && typeof SGA.lineasAlertaValorStd === 'function') {
                                return SGA.lineasAlertaValorStd(item, ctx, origIdx, val, stdVal, {
                                    respMedicion: item.signoActivo || 'todos',
                                    hecesMedicion: 'todos'
                                });
                            }
                            return `valor: ${val}`;
                        },
                        afterBody: (items) => {
                            const SGA = window.SipGraficaAlertas;
                            if (!SGA || typeof SGA.afterBodyAlertasInterconsultas !== 'function') return [];
                            if (item.tipo !== 'respiratorio' && item.tipo !== 'digestivo') return [];
                            return SGA.afterBodyAlertasInterconsultas(item, items);
                        }
                    }
                }
            },
            scales: scalesConfig
        }
    });

    chartInstances[item.canvasId].focoIndex = (activeFocus !== undefined && activeFocus !== null) ? activeFocus : null;

    if (typeof aplicarZoomInicialBarras === 'function' && item.tipo !== 'medicacion') {
        aplicarZoomInicialBarras(chartInstances[item.canvasId], item, 21);
    }

    if (ctx && !ctx._hasZoomResetListener) {
        ctx._hasZoomResetListener = true;
        ctx.addEventListener('dblclick', () => {
            const inst = chartInstances[item.canvasId];
            const pctInst = chartInstances[item.canvasId + '-pct'];
            const SGS = window.SipGraficaShared;
            if (SGS && typeof SGS.resetChartsZoomX === 'function') {
                SGS.resetChartsZoomX(inst, pctInst);
            } else if (inst && typeof inst.resetZoom === 'function') {
                inst.resetZoom();
            }
        });
    }

    item._displayStartIdx = 0;
    const tieneFiltroRango = (item.desdeVal && item.desdeVal !== 'inicio') || (item.hastaVal && item.hastaVal !== 'fin');
    if (tieneFiltroRango) {
        inicializarFiltrosTarjeta(item);
        actualizarGraficoEspecifico(item);
        return;
    }

    if (item.esCombinado && Array.isArray(item.seriesList)) {
        const seriesMapCombo = item.seriesList.map((s) => ({
            macho: s.dataMacho,
            hembra: s.dataHembra,
            std: s.dataStd
        }));
        crearOActualizarGraficoVarPct(item, item.labels, seriesMapCombo);
    } else {
        crearOActualizarGraficoVarPct(item, item.labels, [{
            macho: item.dataMacho,
            hembra: item.dataHembra,
            std: item.dataStd
        }]);
    }

    inicializarFiltrosTarjeta(item);
}
