/**
 * Módulo para CP10 CZonaPro (Costo por Zona Productiva y Granja)
 * Réplica 100% exacta de Tableau (tableu2.png y tableu3.png):
 * - 1 solo mes (tableu2.png): Lienzo amplio con escala detallada a paso 0.05.
 * - Múltiples meses (tableu3.png): Matriz Small Multiples por mes con marcas en 4, 4.5, 5,
 *   líneas por zona productiva, y códigos cencos en el eje inferior orientados estrictamente en vertical
 *   sin desbordes horizontales ni solapamientos.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartRegistry['CP10 CZonaPro'] = {
    COLORS: {
        'SIN_ZONA': '#59a14f',   // Verde Tableau (Sin zona)
        'ZONA_1': '#af7aa1',     // Morado Tableau (Zona 1)
        'ZONA_2': '#f28e2b',     // Naranja Tableau (Zona 2)
        'ZONA_3': '#e15759',     // Rojo Tableau (Zona 3)
        'ZONA_4': '#76b7b2',     // Teal / Cyan Tableau (Zona 4)
        'MOLLENDO_A': '#edc948', // Amarillo / Dorado Tableau (Mollendo A)
        'MOLLENDO_B': '#4e79a7', // Azul / Steel Blue Tableau (Mollendo B)
        GRID_LINE: '#f1f5f9',
        DIVIDER_GEO: '#94a3b8',
        DIVIDER_PRO: '#e2e8f0',
        TEXT_MAIN: '#334155',
        TEXT_MUTED: '#64748b'
    },

    render(controller, data) {
        // 1. Títulos y visibilidad de controles
        const tituloGrafica = document.getElementById('titulo-grafica-principal');
        if (tituloGrafica) tituloGrafica.textContent = 'Costo por Zona Productiva y Granja';

        const contFiltroZona = document.getElementById('contenedor-filtro-zona');
        if (contFiltroZona) contFiltroZona.classList.add('hidden');

        const contFiltroItem = document.getElementById('contenedor-filtro-item');
        if (contFiltroItem) contFiltroItem.classList.add('hidden');

        const contFiltroGranjaCP14 = document.getElementById('contenedor-filtro-granja-cp14');
        if (contFiltroGranjaCP14) contFiltroGranjaCP14.classList.add('hidden');

        const contFiltroGalponCP14 = document.getElementById('contenedor-filtro-galpon-cp14');
        if (contFiltroGalponCP14) contFiltroGalponCP14.classList.add('hidden');

        const contFiltroClasifCP14 = document.getElementById('contenedor-filtro-clasificacion-cp14');
        if (contFiltroClasifCP14) contFiltroClasifCP14.classList.add('hidden');

        const cardTabla = document.getElementById('card-tabla-metricas');
        if (cardTabla) cardTabla.classList.add('hidden');

        const contenedorBadges = document.getElementById('contenedor-badges-grafica');
        if (contenedorBadges) contenedorBadges.innerHTML = '';

        if (controller.chartInstance && typeof controller.chartInstance.destroy === 'function') {
            controller.chartInstance.destroy();
            controller.chartInstance = null;
        }

        const periodos = data.periodos || [];
        if (periodos.length <= 1) {
            this.renderUnSoloMes(controller, data);
        } else {
            this.renderMultiplesMesesTableau(controller, data);
        }
    },

    /**
     * VISTA 1: Un solo mes seleccionado (tableu2.png)
     */
    renderUnSoloMes(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const periodos = data.periodos || [];
        const cencosOrdenados = data.cencos_ordenados || [];
        const matrizPuntos = data.matriz_puntos || {};
        const totalCols = cencosOrdenados.length;

        if (totalCols === 0 || periodos.length === 0) {
            contenedorGrafica.className = "w-full p-8 text-center text-slate-400 font-semibold";
            contenedorGrafica.innerHTML = 'No se encontraron datos para el período seleccionado.';
            return;
        }

        const fMes = periodos[0].key;
        const puntosMesMap = matrizPuntos[fMes] || {};

        // Agrupar bloques jerárquicos
        const bloquesGeo = [];
        const bloquesPro = [];
        let currGeo = null;
        let currPro = null;

        cencosOrdenados.forEach((item, idx) => {
            if (!currGeo || currGeo.zonageo !== item.zonageo) {
                currGeo = { zonageo: item.zonageo, startIdx: idx, count: 1 };
                bloquesGeo.push(currGeo);
            } else {
                currGeo.count++;
            }

            const proKey = item.zonapro || 'SIN ZONA';
            if (!currPro || currPro.zonapro !== proKey || currPro.zonageo !== item.zonageo) {
                currPro = {
                    zonapro: proKey,
                    zonageo: item.zonageo,
                    label: item.zonapro_label,
                    rawZonapro: item.zonapro,
                    color: item.color,
                    startIdx: idx,
                    count: 1
                };
                bloquesPro.push(currPro);
            } else {
                currPro.count++;
            }
        });

        // Escala Y a paso 0.05
        let minCu = 9999;
        let maxCu = -9999;
        cencosOrdenados.forEach(c => {
            const punto = puntosMesMap[c.cencos];
            if (punto && punto.cu > 0) {
                if (punto.cu < minCu) minCu = punto.cu;
                if (punto.cu > maxCu) maxCu = punto.cu;
            }
        });

        if (minCu === 9999) minCu = 4.35;
        if (maxCu === -9999) maxCu = 4.95;

        const step = 0.05;
        const minY = Math.floor((minCu - 0.01) / step) * step;
        const maxY = Math.ceil((maxCu + 0.01) / step) * step;

        const ticks = [];
        for (let v = maxY; v >= minY - 0.0001; v -= step) {
            ticks.push(Number(v.toFixed(2)));
        }

        const rowHeight = 540;

        // Gridlines horizontales
        let gridLinesSvg = '';
        ticks.forEach((tickVal) => {
            const yPos = this.calcYPos(tickVal, minY, maxY, rowHeight, 30);
            gridLinesSvg += `<line x1="0" y1="${yPos}" x2="100%" y2="${yPos}" stroke="#e5e7eb" stroke-width="1" />`;
        });

        // Divisores verticales
        let dividersSvg = '';
        bloquesPro.forEach((bPro, bIdx) => {
            if (bIdx > 0) {
                const dividerPct = (bPro.startIdx / totalCols) * 100;
                const isGeoBoundary = (bPro.zonageo !== bloquesPro[bIdx - 1].zonageo);
                const strokeColor = isGeoBoundary ? '#94a3b8' : '#cbd5e1';
                const strokeWidth = isGeoBoundary ? 1.5 : 1;
                dividersSvg += `<line x1="${dividerPct}%" y1="0" x2="${dividerPct}%" y2="100%" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
            }
        });

        // Trazado de líneas y puntos por zona
        let linesSvg = '';
        let pointsSvg = '';

        bloquesPro.forEach((bPro) => {
            const zonePoints = [];
            for (let i = 0; i < bPro.count; i++) {
                const colIdx = bPro.startIdx + i;
                const cItem = cencosOrdenados[colIdx];
                const punto = puntosMesMap[cItem.cencos];

                if (punto && punto.cu > 0) {
                    const xPct = ((colIdx + 0.5) / totalCols) * 100;
                    const yPx = this.calcYPos(punto.cu, minY, maxY, rowHeight, 30);
                    zonePoints.push({ xPct, yPx, punto, colIdx });
                }
            }

            if (zonePoints.length >= 2) {
                for (let j = 0; j < zonePoints.length - 1; j++) {
                    const p1 = zonePoints[j];
                    const p2 = zonePoints[j + 1];
                    linesSvg += `<line x1="${p1.xPct}%" y1="${p1.yPx}" x2="${p2.xPct}%" y2="${p2.yPx}" stroke="${bPro.color}" stroke-width="2.5" stroke-linecap="round" />`;
                }
            }

            zonePoints.forEach((zp, idxInZone) => {
                const cuStr = Number(zp.punto.cu).toFixed(3).replace('.', ',');
                let labelOffsetY = -8;

                if (zp.punto.cencos === '637130' || zp.punto.cencos === '621193' || zp.punto.cencos === '663065' || zp.punto.cencos === '667065') {
                    labelOffsetY = 15;
                } else if (zonePoints.length >= 3) {
                    const prev = zonePoints[idxInZone - 1];
                    const next = zonePoints[idxInZone + 1];
                    if (prev && next && zp.yPx > prev.yPx && zp.yPx > next.yPx) {
                        labelOffsetY = 15;
                    }
                }

                pointsSvg += `
                    <g class="cursor-pointer group"
                       data-punto='${JSON.stringify(zp.punto)}'
                       onmouseenter="window.ChartRegistry['CP10 CZonaPro'].onPointHover(event)"
                       onmouseleave="window.ChartRegistry['CP10 CZonaPro'].onPointLeave(event)">
                        <circle cx="${zp.xPct}%" cy="${zp.yPx}" r="3.5" fill="${bPro.color}" />
                        <text x="${zp.xPct}%" y="${zp.yPx + labelOffsetY}" text-anchor="middle" font-size="10" font-family="system-ui, -apple-system, sans-serif" font-weight="500" fill="#1e293b">
                            ${cuStr}
                        </text>
                    </g>
                `;
            });
        });

        // Encabezados
        const headerGeoHtml = this.generarHeaderGeo(bloquesGeo, totalCols);
        const headerProHtml = this.generarHeaderPro(bloquesPro, totalCols);

        // Eje Inferior de Cencos (Horizontales si son <= 15, verticales si son más)
        const bottomCencosHtml = this.generarEjeCencos(cencosOrdenados, totalCols, totalCols <= 16);
        const bottomLegendHtml = this.generarLeyendaInferior();

        const minCanvasWidth = Math.max(1000, totalCols * 24);

        contenedorGrafica.className = "flex flex-col w-full p-4 bg-white overflow-x-auto custom-scrollbar";
        contenedorGrafica.innerHTML = `
            <div class="flex flex-col bg-white" style="min-width: ${minCanvasWidth}px;">
                <div class="flex flex-col items-center justify-center mb-4">
                    <h1 class="text-2xl font-normal text-slate-800 tracking-tight">Costo por Zona Productiva y Granja</h1>
                    <span class="text-xs text-slate-500 mt-1 font-normal">zonageo / zonapro / cencos</span>
                </div>

                <div class="flex flex-col border border-slate-300 bg-white shadow-2xs">
                    <div class="flex items-center border-b border-slate-300 bg-white">
                        <div class="w-[140px] flex-shrink-0 border-r border-slate-300"></div>
                        <div class="flex-1 flex items-center">${headerGeoHtml}</div>
                    </div>

                    <div class="flex items-center border-b border-slate-300 bg-white">
                        <div class="w-[140px] flex-shrink-0 px-3 py-1.5 border-r border-slate-300 text-left text-[11px] font-normal text-slate-700">
                            Mes de fecha
                        </div>
                        <div class="flex-1 flex items-center">${headerProHtml}</div>
                    </div>

                    <div class="flex items-stretch border-b border-slate-300 bg-white">
                        <div class="w-[140px] flex-shrink-0 flex items-stretch border-r border-slate-300">
                            <div class="w-[75px] flex items-center justify-center p-2 text-[11px] font-normal text-slate-700 leading-tight text-center border-r border-slate-200">
                                ${periodos[0].mes_larga || periodos[0].key}
                            </div>
                            <div class="w-[65px] flex items-stretch">
                                <div class="flex items-center justify-center text-[10px] font-medium text-slate-500 px-1 border-r border-slate-100">
                                    <span class="transform -rotate-90">CU</span>
                                </div>
                                <div class="flex-1 flex flex-col justify-between py-2 text-right">
                                    ${ticks.map(t => `<span class="text-[9.5px] text-slate-500 font-sans pr-1.5 leading-none">${Number(t).toFixed(2).replace('.', ',')}</span>`).join('')}
                                </div>
                            </div>
                        </div>

                        <div class="flex-1 relative" style="height: ${rowHeight}px;">
                            <svg class="w-full h-full" style="overflow: visible;">
                                ${gridLinesSvg}
                                ${dividersSvg}
                                ${linesSvg}
                                ${pointsSvg}
                            </svg>
                        </div>
                    </div>

                    <div class="flex items-stretch border-t border-slate-300 bg-white">
                        <div class="w-[140px] flex-shrink-0 border-r border-slate-300"></div>
                        <div class="flex-1 flex items-stretch">${bottomCencosHtml}</div>
                    </div>
                </div>

                ${bottomLegendHtml}
            </div>
        `;
    },

    /**
     * VISTA 2: Múltiples meses seleccionados (tableu3.png)
     * Con códigos cencos rotados estrictamente en vertical mediante writing-mode
     */
    renderMultiplesMesesTableau(controller, data) {
        const contenedorGrafica = document.getElementById('contenedor-grafica-costo');
        if (!contenedorGrafica) return;

        const periodos = data.periodos || [];
        const cencosOrdenados = data.cencos_ordenados || [];
        const matrizPuntos = data.matriz_puntos || {};
        const totalCols = cencosOrdenados.length;

        if (totalCols === 0 || periodos.length === 0) {
            contenedorGrafica.className = "w-full p-8 text-center text-slate-400 font-semibold";
            contenedorGrafica.innerHTML = 'No se encontraron datos para el período seleccionado.';
            return;
        }

        // Agrupar bloques jerárquicos
        const bloquesGeo = [];
        const bloquesPro = [];
        let currGeo = null;
        let currPro = null;

        cencosOrdenados.forEach((item, idx) => {
            if (!currGeo || currGeo.zonageo !== item.zonageo) {
                currGeo = { zonageo: item.zonageo, startIdx: idx, count: 1 };
                bloquesGeo.push(currGeo);
            } else {
                currGeo.count++;
            }

            const proKey = item.zonapro || 'SIN ZONA';
            if (!currPro || currPro.zonapro !== proKey || currPro.zonageo !== item.zonageo) {
                currPro = {
                    zonapro: proKey,
                    zonageo: item.zonageo,
                    label: item.zonapro_label,
                    rawZonapro: item.zonapro,
                    color: item.color,
                    startIdx: idx,
                    count: 1
                };
                bloquesPro.push(currPro);
            } else {
                currPro.count++;
            }
        });

        // Escala fija Y de Tableau (3.6 a 5.4) con marcas en 4, 4.5, 5
        const minY = 3.6;
        const maxY = 5.4;
        const rowHeight = 88; // Altura compacta por fila

        let filasHtml = '';

        periodos.forEach((p) => {
            const fMes = p.key;
            const puntosMesMap = matrizPuntos[fMes] || {};

            // Gridlines horizontales exclusivas en 4, 4.5, 5
            const y4   = this.calcYPos(4.0, minY, maxY, rowHeight, 14);
            const y4_5 = this.calcYPos(4.5, minY, maxY, rowHeight, 14);
            const y5   = this.calcYPos(5.0, minY, maxY, rowHeight, 14);

            const gridLinesSvg = `
                <line x1="0" y1="${y4}" x2="100%" y2="${y4}" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="${y4_5}" x2="100%" y2="${y4_5}" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="${y5}" x2="100%" y2="${y5}" stroke="#f1f5f9" stroke-width="1" />
            `;

            // Divisores verticales
            let dividersSvg = '';
            bloquesPro.forEach((bPro, bIdx) => {
                if (bIdx > 0) {
                    const dividerPct = (bPro.startIdx / totalCols) * 100;
                    const isGeoBoundary = (bPro.zonageo !== bloquesPro[bIdx - 1].zonageo);
                    const strokeColor = isGeoBoundary ? '#94a3b8' : '#e2e8f0';
                    const strokeWidth = isGeoBoundary ? 1.5 : 1;
                    dividersSvg += `<line x1="${dividerPct}%" y1="0" x2="${dividerPct}%" y2="100%" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
                }
            });

            // Trazado de líneas y puntos por zona
            let linesSvg = '';
            let pointsSvg = '';

            bloquesPro.forEach((bPro) => {
                const zonePoints = [];
                for (let i = 0; i < bPro.count; i++) {
                    const colIdx = bPro.startIdx + i;
                    const cItem = cencosOrdenados[colIdx];
                    const punto = puntosMesMap[cItem.cencos];

                    if (punto && punto.cu > 0) {
                        const xPct = ((colIdx + 0.5) / totalCols) * 100;
                        const yPx = this.calcYPos(punto.cu, minY, maxY, rowHeight, 14);
                        zonePoints.push({ xPct, yPx, punto, colIdx });
                    }
                }

                if (zonePoints.length >= 2) {
                    for (let j = 0; j < zonePoints.length - 1; j++) {
                        const p1 = zonePoints[j];
                        const p2 = zonePoints[j + 1];
                        linesSvg += `<line x1="${p1.xPct}%" y1="${p1.yPx}" x2="${p2.xPct}%" y2="${p2.yPx}" stroke="${bPro.color}" stroke-width="2" stroke-linecap="round" />`;
                    }
                }

                zonePoints.forEach((zp, idxInZone) => {
                    const cuStr = Number(zp.punto.cu).toFixed(3).replace('.', ',');
                    let labelOffsetY = -6;

                    if (zp.punto.cencos === '637130' || zp.punto.cencos === '621193' || zp.punto.cencos === '663065' || zp.punto.cencos === '667065' || zp.punto.cencos === '637129') {
                        labelOffsetY = 13;
                    } else if (zonePoints.length >= 2) {
                        const other = (idxInZone === 0) ? zonePoints[1] : zonePoints[0];
                        if (zp.yPx > other.yPx) {
                            labelOffsetY = 13;
                        }
                    }

                    pointsSvg += `
                        <g class="cursor-pointer group"
                           data-punto='${JSON.stringify(zp.punto)}'
                           onmouseenter="window.ChartRegistry['CP10 CZonaPro'].onPointHover(event)"
                           onmouseleave="window.ChartRegistry['CP10 CZonaPro'].onPointLeave(event)">
                            <circle cx="${zp.xPct}%" cy="${zp.yPx}" r="3" fill="${bPro.color}" />
                            <text x="${zp.xPct}%" y="${zp.yPx + labelOffsetY}" text-anchor="middle" font-size="8.5" font-family="system-ui, -apple-system, sans-serif" font-weight="500" fill="#334155">
                                ${cuStr}
                            </text>
                        </g>
                    `;
                });
            });

            filasHtml += `
                <div class="flex items-stretch border-b border-slate-200/90 hover:bg-slate-50/40 transition-colors">
                    <!-- Eje Y y Nombre del Mes -->
                    <div class="w-[130px] flex-shrink-0 flex items-stretch border-r border-slate-300 bg-white">
                        <div class="w-[75px] flex items-center justify-center p-1.5 text-[10.5px] font-normal text-slate-700 leading-tight text-center border-r border-slate-200">
                            ${p.mes_larga || p.key}
                        </div>
                        <div class="w-[55px] flex items-stretch">
                            <div class="flex items-center justify-center text-[9px] font-medium text-slate-400 px-0.5 border-r border-slate-100">
                                <span class="transform -rotate-90">CU</span>
                            </div>
                            <div class="flex-1 flex flex-col justify-between py-1.5 text-right font-sans text-[8.5px] text-slate-400 pr-1.5">
                                <span>5</span>
                                <span class="text-slate-500 font-semibold">4,5</span>
                                <span>4</span>
                            </div>
                        </div>
                    </div>

                    <!-- Área Gráfica SVG -->
                    <div class="flex-1 relative" style="height: ${rowHeight}px;">
                        <svg class="w-full h-full" style="overflow: visible;">
                            ${gridLinesSvg}
                            ${dividersSvg}
                            ${linesSvg}
                            ${pointsSvg}
                        </svg>
                    </div>
                </div>
            `;
        });

        // Encabezados
        const headerGeoHtml = this.generarHeaderGeo(bloquesGeo, totalCols);
        const headerProHtml = this.generarHeaderPro(bloquesPro, totalCols);

        // Eje Inferior de Cencos: ROTACIÓN VERTICAL 100% ROBUSTA
        const bottomCencosHtml = this.generarEjeCencos(cencosOrdenados, totalCols, false);
        const bottomLegendHtml = this.generarLeyendaInferior();

        // Ancho mínimo dinámico para que no se compriman las columnas si hay muchas
        const minCanvasWidth = Math.max(1050, totalCols * 18);

        contenedorGrafica.className = "flex flex-col w-full p-4 bg-white overflow-x-auto custom-scrollbar";
        contenedorGrafica.innerHTML = `
            <div class="flex flex-col bg-white" style="min-width: ${minCanvasWidth}px;">
                <div class="flex flex-col items-center justify-center mb-4">
                    <h1 class="text-2xl font-normal text-slate-800 tracking-tight">Costo por Zona Productiva y Granja</h1>
                    <span class="text-xs text-slate-500 mt-1 font-normal">zonageo / zonapro / cencos</span>
                </div>

                <div class="flex flex-col border border-slate-300 bg-white shadow-2xs">
                    <div class="flex items-center border-b border-slate-300 bg-white">
                        <div class="w-[130px] flex-shrink-0 border-r border-slate-300"></div>
                        <div class="flex-1 flex items-center">${headerGeoHtml}</div>
                    </div>

                    <div class="flex items-center border-b border-slate-300 bg-white">
                        <div class="w-[130px] flex-shrink-0 px-3 py-1.5 border-r border-slate-300 text-left text-[10.5px] font-normal text-slate-700">
                            Mes de fecha
                        </div>
                        <div class="flex-1 flex items-center">${headerProHtml}</div>
                    </div>

                    <div class="flex flex-col divide-y divide-slate-200">
                        ${filasHtml}
                    </div>

                    <div class="flex items-stretch border-t-2 border-slate-300 bg-white py-1">
                        <div class="w-[130px] flex-shrink-0 border-r border-slate-300"></div>
                        <div class="flex-1 flex items-stretch h-[60px]">${bottomCencosHtml}</div>
                    </div>
                </div>

                ${bottomLegendHtml}
            </div>
        `;
    },

    generarHeaderGeo(bloquesGeo, totalCols) {
        let html = '';
        bloquesGeo.forEach((bGeo, idx) => {
            const widthPct = (bGeo.count / totalCols) * 100;
            const borderClass = (idx < bloquesGeo.length - 1) ? 'border-r border-slate-300' : '';
            html += `
                <div class="text-center py-1.5 text-[11px] font-normal text-slate-600 ${borderClass}" style="width: ${widthPct}%;">
                    ${bGeo.zonageo}
                </div>
            `;
        });
        return html;
    },

    generarHeaderPro(bloquesPro, totalCols) {
        let html = '';
        bloquesPro.forEach((bPro, idx) => {
            const widthPct = (bPro.count / totalCols) * 100;
            const borderClass = (idx < bloquesPro.length - 1) ? 'border-r border-slate-300' : '';
            const displayLabel = (bPro.rawZonapro && bPro.rawZonapro.trim() !== '') ? bPro.label : '';
            html += `
                <div class="text-center py-1 text-[10.5px] font-normal text-slate-600 ${borderClass} truncate px-1" 
                     style="width: ${widthPct}%;">
                    ${displayLabel}
                </div>
            `;
        });
        return html;
    },

    /**
     * Generador del Eje Inferior de Cencos
     * Utiliza writing-mode vertical para que nunca se desborde horizontalmente ni se solape
     */
    generarEjeCencos(cencosOrdenados, totalCols, isHorizontal = false) {
        let html = '';
        cencosOrdenados.forEach((item) => {
            const widthPct = (1 / totalCols) * 100;
            if (isHorizontal) {
                html += `
                    <div class="flex items-center justify-center py-2 text-[10px] font-mono text-slate-700 truncate" 
                         style="width: ${widthPct}%;" title="${item.cencos} - ${item.nomcencos}">
                        ${item.cencos}
                    </div>
                `;
            } else {
                html += `
                    <div class="flex items-start justify-center overflow-hidden" 
                         style="width: ${widthPct}%;" title="${item.cencos} - ${item.nomcencos}">
                        <span style="writing-mode: vertical-rl; transform: rotate(180deg); display: block; font-family: monospace, sans-serif; font-size: 8.5px; color: #475569; letter-spacing: 0.5px; font-weight: 500; line-height: 1;">
                            ${item.cencos}
                        </span>
                    </div>
                `;
            }
        });
        return html;
    },

    generarLeyendaInferior() {
        const legendItems = [
            { label: '', color: this.COLORS.SIN_ZONA },
            { label: 'MOLLENDO A', color: this.COLORS.MOLLENDO_A },
            { label: 'MOLLENDO B', color: this.COLORS.MOLLENDO_B },
            { label: 'ZONA 1', color: this.COLORS.ZONA_1 },
            { label: 'ZONA 2', color: this.COLORS.ZONA_2 },
            { label: 'ZONA 3', color: this.COLORS.ZONA_3 },
            { label: 'ZONA 4', color: this.COLORS.ZONA_4 }
        ];

        let html = `
            <div class="flex items-center gap-5 pt-4 pb-2 text-[11px] font-sans text-slate-700 select-none">
                <span class="font-medium text-slate-800">zonapro</span>
        `;
        legendItems.forEach(item => {
            html += `
                <div class="flex items-center gap-1.5">
                    <span class="w-3 h-3 rounded-xs inline-block" style="background-color: ${item.color};"></span>
                    ${item.label ? `<span class="text-slate-700 text-[11px]">${item.label}</span>` : ''}
                </div>
            `;
        });
        html += `</div>`;
        return html;
    },

    calcYPos(val, minY, maxY, height, padding = 20) {
        const usableHeight = height - padding * 2;
        const clamped = Math.max(minY, Math.min(maxY, val));
        const pct = (clamped - minY) / (maxY - minY);
        return height - padding - (pct * usableHeight);
    },

    onPointHover(e) {
        const g = e.currentTarget;
        const puntoJson = g.getAttribute('data-punto');
        if (!puntoJson) return;
        const punto = JSON.parse(puntoJson);

        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (!tooltipEl) return;

        const colorPunto = punto.color || '#3b82f6';

        tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-sans">
                <span class="text-slate-500 font-normal">Zona Geográfica:</span>
                <span class="font-bold text-left text-slate-800">${punto.zonageo}</span>

                <span class="text-slate-500 font-normal">Zona Productiva:</span>
                <span class="font-bold text-left" style="color: ${colorPunto};">${punto.zonapro_label || punto.zonapro || 'SIN ZONA'}</span>
                
                <span class="text-slate-500 font-normal">Cencos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${punto.cencos}</span>

                <span class="text-slate-500 font-normal">Granja:</span>
                <span class="text-slate-900 font-semibold text-left">${punto.nomcencos}</span>

                <span class="text-slate-500 font-normal">Mes:</span>
                <span class="text-slate-900 font-semibold text-left">${punto.mes_larga}</span>

                <span class="text-slate-500 font-normal">Total Importe:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">S/ ${Number(punto.sum_timfipt).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                <span class="text-slate-500 font-normal">Kg Vendidos:</span>
                <span class="text-slate-900 font-semibold text-left font-mono">${Number(punto.avg_kgvendidos).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg</span>

                <span class="text-slate-500 font-normal">CU:</span>
                <span class="font-bold text-left font-mono text-sm" style="color: ${colorPunto};">${Number(punto.cu).toFixed(3).replace('.', ',')}</span>
            </div>
        `;

        tooltipEl.classList.remove('hidden');

        const rect = g.getBoundingClientRect();
        const tooltipWidth = tooltipEl.offsetWidth || 250;
        const tooltipHeight = tooltipEl.offsetHeight || 150;

        let left = rect.left + 15;
        let top = rect.top - 20;

        if (left + tooltipWidth > window.innerWidth - 12) {
            left = rect.left - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight - 12) {
            top = window.innerHeight - tooltipHeight - 12;
        }

        tooltipEl.style.left = `${Math.max(10, left)}px`;
        tooltipEl.style.top = `${Math.max(10, top)}px`;
    },

    onPointLeave(e) {
        const tooltipEl = document.getElementById('tooltip-tableau-costos');
        if (tooltipEl) {
            tooltipEl.classList.add('hidden');
        }
    }
};
