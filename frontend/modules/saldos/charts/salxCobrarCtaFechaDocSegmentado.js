window.SaldosCtaFechaDocSegmentadoView = {
    ESCALONES: [
        { max: 0.2, color: '#9c0824' },
        { max: 0.4, color: '#d11719' },
        { max: 0.6, color: '#cacaca' },
        { max: 0.8, color: '#a2c18f' },
        { max: 1.01, color: '#09622a' }
    ],

    MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    DIAS: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    numero(valor, decimales = 0) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return Number(valor).toLocaleString('de-DE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    fechaLarga(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-');
        if (partes.length !== 3) return fecha;
        const [y, m, d] = partes.map(Number);
        const fechaObj = new Date(y, m - 1, d);
        return `${this.DIAS[fechaObj.getDay()]}, ${d} de ${this.MESES[m - 1] || ''} de ${y}`;
    },

    fechaLargaSimple(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-');
        if (partes.length !== 3) return fecha;
        const [y, m, d] = partes.map(Number);
        return `${d} de ${this.MESES[m - 1] || ''} de ${y}`;
    },

    colorParaRatio(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) return '#ffffff';

        const t = Math.max(0, Math.min(1, Number(valor)));

        if (t < 0.2) return '#9c0824';
        if (t < 0.4) return '#d11719';
        if (t < 0.6) return '#cacaca';
        if (t < 0.8) return '#a2c18f';
        return '#09622a';
    },

    construirGrupos(data) {
        const grupos = [];
        const mapaCuentas = new Map();

        data.forEach(row => {
            let grupo = mapaCuentas.get(row.cuentaventa);
            if (!grupo) {
                grupo = {
                    cuentaventa: row.cuentaventa,
                    nomcuentaventa: row.nomcuentaventa || '',
                    condiciones: [],
                    mapaCondiciones: new Map()
                };
                mapaCuentas.set(row.cuentaventa, grupo);
                grupos.push(grupo);
            }

            let condicion = grupo.mapaCondiciones.get(row.condicionpago);
            if (!condicion) {
                condicion = {
                    condicionpago: row.condicionpago,
                    zonas: [],
                    mapaZonas: new Map()
                };
                grupo.mapaCondiciones.set(row.condicionpago, condicion);
                grupo.condiciones.push(condicion);
            }

            let zona = condicion.mapaZonas.get(row.zonafiscal);
            if (!zona) {
                zona = {
                    zonafiscal: row.zonafiscal,
                    celdas: new Map()
                };
                condicion.mapaZonas.set(row.zonafiscal, zona);
                condicion.zonas.push(zona);
            }

            zona.celdas.set(row.fechacontable, row);
        });

        return grupos;
    },

    render(contenedor, payload, controller) {
        if (!contenedor) return;

        const tooltipAnterior = document.getElementById('fd-tooltip');
        if (tooltipAnterior) tooltipAnterior.remove();

        const data = payload && Array.isArray(payload.data) ? payload.data : [];
        let fechas = payload && Array.isArray(payload.fechas) ? payload.fechas.slice() : [];

        if (fechas.length === 0) {
            fechas = Array.from(new Set(data.map(row => row.fechacontable))).sort();
        }

        if (data.length === 0 || fechas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 font-medium">
                    No se encontraron registros para los filtros seleccionados.
                </div>
            `;
            return;
        }

        const grupos = this.construirGrupos(data);
        const totalCuentas = grupos.length;
        const totalCondiciones = grupos.reduce((total, grupo) => total + grupo.condiciones.length, 0);
        const totalZonas = grupos.reduce((total, grupo) => {
            return total + grupo.condiciones.reduce((acc, condicion) => acc + condicion.zonas.length, 0);
        }, 0);

        const fechacarga = payload.fechacarga || '';
        const periodo = controller && controller.currentPeriodo
            ? `${this.fechaLargaSimple(controller.currentPeriodo.inicio)} al ${this.fechaLargaSimple(controller.currentPeriodo.fin)}`
            : `${this.fechaLargaSimple(fechas[0])} al ${this.fechaLargaSimple(fechas[fechas.length - 1])}`;

        const gradiente = this.ESCALONES.map((paso, i) => {
            const inicio = i === 0 ? 0 : this.ESCALONES[i - 1].max * 100;
            const fin = paso.max * 100;
            return `${paso.color} ${inicio}%, ${paso.color} ${fin}%`;
        }).join(', ');

        const anchoCuenta = 76;
        const anchoNomCuenta = 112;
        const anchoCondicion = 108;
        const anchoZona = 90;
        const anchoFecha = 99;
        const leftNomCuenta = anchoCuenta;
        const leftCondicion = anchoCuenta + anchoNomCuenta;
        const leftZona = leftCondicion + anchoCondicion;

        const estilosColumnas = `
            .fd-cuenta { width:${anchoCuenta}px; min-width:${anchoCuenta}px; max-width:${anchoCuenta}px; left:0; }
            .fd-nomcuenta { width:${anchoNomCuenta}px; min-width:${anchoNomCuenta}px; max-width:${anchoNomCuenta}px; left:${leftNomCuenta}px; }
            .fd-condicion { width:${anchoCondicion}px; min-width:${anchoCondicion}px; max-width:${anchoCondicion}px; left:${leftCondicion}px; }
            .fd-zona { width:${anchoZona}px; min-width:${anchoZona}px; max-width:${anchoZona}px; left:${leftZona}px; }
            .fd-fecha { width:${anchoFecha}px; min-width:${anchoFecha}px; max-width:${anchoFecha}px; }
        `;

        let filasHtml = '';

        grupos.forEach((grupo, indiceGrupo) => {
            const totalZonasGrupo = grupo.condiciones.reduce((acc, condicion) => acc + condicion.zonas.length, 0);
            const bgFila = indiceGrupo % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
            let primeraFilaGrupo = true;

            grupo.condiciones.forEach(condicion => {
                condicion.zonas.forEach((zona, indiceZona) => {
                    filasHtml += `<tr class="${bgFila} hover:bg-blue-50/40 transition-colors">`;

                    if (primeraFilaGrupo) {
                        filasHtml += `
                            <td rowspan="${totalZonasGrupo}" class="fd-cuenta sticky z-20 bg-inherit border-b border-r border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-800 align-middle whitespace-nowrap">
                                ${this.esc(grupo.cuentaventa)}
                            </td>
                            <td rowspan="${totalZonasGrupo}" class="fd-nomcuenta sticky z-20 bg-inherit border-b border-r border-slate-200 px-2 py-1 text-[11px] text-slate-600 align-middle leading-[1.15]">
                                ${this.esc(grupo.nomcuentaventa)}
                            </td>
                        `;
                        primeraFilaGrupo = false;
                    }

                    if (indiceZona === 0) {
                        filasHtml += `
                            <td rowspan="${condicion.zonas.length}" class="fd-condicion sticky z-20 bg-inherit border-b border-r border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 align-middle whitespace-nowrap">
                                ${this.esc(condicion.condicionpago)}
                            </td>
                        `;
                    }

                    filasHtml += `
                        <td class="fd-zona sticky z-20 bg-inherit border-b border-r border-slate-200 px-2 py-1 text-[11px] text-slate-700 align-middle whitespace-nowrap">
                            ${this.esc(zona.zonafiscal)}
                        </td>
                    `;

                    fechas.forEach(fecha => {
                        const celda = zona.celdas.get(fecha);

                        if (!celda) {
                            filasHtml += `<td class="fd-fecha border-b border-r border-slate-200/70 bg-white"></td>`;
                            return;
                        }

                        const ratioValida = celda.ratio !== null && celda.ratio !== undefined && !isNaN(Number(celda.ratio));
                        const ratio = ratioValida ? Number(celda.ratio) : null;
                        const pct = ratioValida ? Math.max(0, Math.min(100, ratio * 100)) : 0;
                        const color = ratioValida ? this.colorParaRatio(ratio) : '#ffffff';
                        const label = ratioValida ? `${(ratio * 100).toFixed(2).replace('.', ',')}%` : '';
                        const labelStyle = pct > 55
                            ? `right:2px; left:auto; color:${pct > 75 ? '#ffffff' : '#1e293b'};`
                            : `left:calc(${pct}% + 2px); color:#334155;`;

                        filasHtml += `
                            <td class="fd-fecha border-b border-r border-slate-200/70 px-1 py-1 align-middle whitespace-nowrap cursor-pointer"
                                data-fd="1"
                                data-cuenta="${this.esc(celda.cuentaventa)}"
                                data-nomcuenta="${this.esc(celda.nomcuentaventa)}"
                                data-condicion="${this.esc(celda.condicionpago)}"
                                data-zona="${this.esc(celda.zonafiscal)}"
                                data-fecha="${this.esc(celda.fechacontable)}"
                                data-fechacarga="${this.esc(fechacarga)}"
                                data-ratio="${ratioValida ? this.esc(ratio) : ''}"
                                data-saldoini="${this.esc(celda.saldoinicial)}"
                                data-saldofin="${this.esc(celda.saldofinal)}">
                                <div class="relative w-full" style="height:14px;">
                                    ${ratioValida ? `<div class="absolute left-0 top-1/2 -translate-y-1/2" style="width:${pct}%; height:10px; background:${color};"></div>` : ''}
                                    ${ratioValida ? `<span class="absolute top-1/2 -translate-y-1/2 text-[9px] font-mono whitespace-nowrap" style="${labelStyle}">${label}</span>` : ''}
                                </div>
                            </td>
                        `;
                    });

                    filasHtml += '</tr>';
                });
            });
        });

        const encabezadosFechas = fechas.map(fecha => `
            <th class="fd-fecha sticky top-[30px] z-30 bg-blue-600 border-b border-r border-blue-500 px-1 py-1.5 text-center text-[10px] font-semibold text-white leading-[1.15] whitespace-normal break-words"
                title="${this.esc(this.fechaLarga(fecha))}">
                ${this.esc(this.fechaLarga(fecha))}
            </th>
        `).join('');

        contenedor.innerHTML = `
            <style>${estilosColumnas}</style>
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="text-base font-bold text-slate-800 tracking-tight">
                            Indicadores de Saldos por Cobrar por Cuenta por Día y por Cliente (NO CORPORATIVO)
                        </h3>
                        <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">
                            Segmentado Cuenta/Subzona/Condición &middot; No Acumulable
                        </p>
                        <p class="text-xs text-slate-500 font-medium mt-1">
                            Se ha cobrado el porcentaje de los pendientes del día.
                            <span class="mx-1 text-slate-300">|</span>
                            Fecha de corte: <span class="font-semibold text-slate-700">${this.esc(this.fechaLargaSimple(fechacarga))}</span>
                            <span class="mx-1 text-slate-300">|</span>
                            Días de fechacontable: <span class="font-semibold text-slate-700">${this.esc(periodo)}</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                            ${data.length.toLocaleString('de-DE')} registros
                        </span>
                        <span class="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg border border-blue-200">
                            10IndSalxCobrarxCtaxFechaDocSegmentado
                        </span>
                    </div>
                </div>

                <div class="flex items-stretch min-w-0">
                    <div id="fd-scroll" class="flex-1 min-w-0 overflow-auto custom-scrollbar" style="max-height:72vh;">
                        <table class="w-max min-w-full border-separate border-spacing-0 text-[11px]" style="table-layout:fixed; width:max-content; min-width:100%;">
                            <colgroup>
                                <col style="width:${anchoCuenta}px">
                                <col style="width:${anchoNomCuenta}px">
                                <col style="width:${anchoCondicion}px">
                                <col style="width:${anchoZona}px">
                                ${fechas.map(() => `<col style="width:${anchoFecha}px">`).join('')}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th colspan="4" class="sticky left-0 top-0 z-[60] h-[30px] bg-blue-600 border-b border-r border-blue-500 px-2 text-left text-[10px] font-bold text-white"></th>
                                    <th colspan="${fechas.length}" class="sticky top-0 z-30 h-[30px] bg-blue-600 border-b border-blue-500 px-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">
                                        Día de fechacontable
                                    </th>
                                </tr>
                                <tr>
                                    <th class="fd-cuenta sticky left-0 top-[30px] z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-1.5 text-left text-[10.5px] font-bold text-white whitespace-nowrap">cuentaventa</th>
                                    <th class="fd-nomcuenta sticky top-[30px] z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-1.5 text-left text-[10.5px] font-bold text-white whitespace-nowrap">nomcuentaventa</th>
                                    <th class="fd-condicion sticky top-[30px] z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-1.5 text-left text-[10.5px] font-bold text-white whitespace-nowrap">condicionpago</th>
                                    <th class="fd-zona sticky top-[30px] z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-1.5 text-left text-[10.5px] font-bold text-white whitespace-nowrap">zonafiscal</th>
                                    ${encabezadosFechas}
                                </tr>
                            </thead>
                            <tbody>
                                ${filasHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                    <div class="text-[11px] text-slate-500 font-medium">
                        ${totalCuentas} cuentas &middot; ${totalCondiciones} condiciones &middot; ${totalZonas} zonas
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold text-slate-600">Bien/Mal</span>
                            <div class="w-56 h-3 rounded-sm border border-slate-300" style="background: linear-gradient(to right, ${gradiente});"></div>
                        </div>
                        <div class="w-56 ml-auto flex justify-between text-[10px] font-mono text-slate-500">
                            <span>0,00%</span>
                            <span>100,00%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindTooltip(contenedor);
        this.bindClick(contenedor, controller);
    },

    bindClick(contenedor, controller) {
        const scroll = contenedor.querySelector('#fd-scroll');
        if (!scroll || !controller) return;

        scroll.addEventListener('click', event => {
            const td = event.target.closest('td[data-fd]');
            if (!td) return;

            event.stopPropagation();

            const tooltip = document.getElementById('fd-tooltip');
            if (tooltip) tooltip.classList.add('hidden');

            const ratioValida = td.dataset.ratio !== '' && td.dataset.ratio !== undefined && !isNaN(Number(td.dataset.ratio));

            controller.puntoSeleccionado = {
                tipoGrafico: '10IndSalxCobrarxCtaxFechaDocSegmentado',
                cuenta: td.dataset.cuenta,
                nomcuentaventa: td.dataset.nomcuenta,
                condicionpago: td.dataset.condicion,
                zona: td.dataset.zona,
                fecha: td.dataset.fecha,
                fechaFormateada: this.fechaLarga(td.dataset.fecha),
                fechacarga: td.dataset.fechacarga,
                saldofinal: Number(td.dataset.saldofin) || 0,
                saldoinicial: Number(td.dataset.saldoini) || 0,
                ratio: ratioValida ? Number(td.dataset.ratio) : 0
            };

            const popup = document.getElementById('popup-menu-barra');
            const btnDeudores = document.getElementById('btn-abrir-analisis-corporativos');
            if (btnDeudores) btnDeudores.classList.add('hidden');

            if (popup) {
                popup.style.left = `${event.clientX + 10}px`;
                popup.style.top = `${event.clientY + 10}px`;
                popup.classList.remove('hidden');
            }
        });
    },

    bindTooltip(contenedor) {
        const scroll = contenedor.querySelector('#fd-scroll');
        if (!scroll) return;

        const tooltip = document.createElement('div');
        tooltip.id = 'fd-tooltip';
        tooltip.className = 'fixed z-[9999] hidden w-[320px] rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] shadow-xl pointer-events-none';
        document.body.appendChild(tooltip);

        const ocultar = () => tooltip.classList.add('hidden');

        const posicionar = (event) => {
            const margen = 14;
            const rect = tooltip.getBoundingClientRect();
            let left = event.clientX + margen;
            let top = event.clientY + margen;

            if (left + rect.width > window.innerWidth - 8) {
                left = event.clientX - rect.width - margen;
            }
            if (top + rect.height > window.innerHeight - 8) {
                top = event.clientY - rect.height - margen;
            }

            tooltip.style.left = `${Math.max(8, left)}px`;
            tooltip.style.top = `${Math.max(8, top)}px`;
        };

        const mostrar = (td, event) => {
            const popup = document.getElementById('popup-menu-barra');
            if (popup && !popup.classList.contains('hidden')) {
                ocultar();
                return;
            }

            const ratioValida = td.dataset.ratio !== '' && td.dataset.ratio !== undefined && !isNaN(Number(td.dataset.ratio));
            const ratio = ratioValida ? Number(td.dataset.ratio) : null;
            const pct = ratio !== null ? `${(ratio * 100).toFixed(2).replace('.', ',')}%` : '-';

            const filas = [
                ['condicionpago', td.dataset.condicion],
                ['cuentaventa', td.dataset.cuenta],
                ['nomcuentaventa', td.dataset.nomcuenta],
                ['zonafiscal', td.dataset.zona],
                ['Día de fechacontable', this.fechaLarga(td.dataset.fecha)],
                ['Día de fechacarga', this.fechaLarga(td.dataset.fechacarga)],
                ['Indicador', pct],
                ['saldoinicial', this.numero(td.dataset.saldoini, 2)],
                ['saldofinal', this.numero(td.dataset.saldofin, 2)]
            ];

            tooltip.innerHTML = `
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    ${filas.map(([etiqueta, valor]) => `
                        <span class="text-slate-500 whitespace-nowrap">${this.esc(etiqueta)}:</span>
                        <span class="font-semibold text-slate-800 text-right break-words">${this.esc(valor)}</span>
                    `).join('')}
                </div>
            `;

            tooltip.classList.remove('hidden');
            posicionar(event);
        };

        scroll.addEventListener('mouseover', event => {
            const td = event.target.closest('td[data-fd]');
            if (!td) {
                ocultar();
                return;
            }
            mostrar(td, event);
        });

        scroll.addEventListener('mousemove', event => {
            if (tooltip.classList.contains('hidden')) return;
            const td = event.target.closest('td[data-fd]');
            if (!td) {
                ocultar();
                return;
            }
            posicionar(event);
        });

        scroll.addEventListener('mouseleave', ocultar);
        scroll.addEventListener('scroll', ocultar, { passive: true });
    }
};
