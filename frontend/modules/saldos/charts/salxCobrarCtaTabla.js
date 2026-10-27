window.SaldosCtaTablaView = {
    PALETA: [
        { p: 0.00, c: [158, 212, 210] },
        { p: 0.10, c: [139, 201, 205] },
        { p: 0.20, c: [112, 186, 198] },
        { p: 0.30, c: [101, 179, 195] },
        { p: 0.40, c: [76, 166, 187] },
        { p: 0.50, c: [63, 155, 181] },
        { p: 0.60, c: [54, 141, 170] },
        { p: 0.70, c: [53, 130, 164] },
        { p: 0.80, c: [51, 119, 156] },
        { p: 0.90, c: [48, 104, 145] },
        { p: 1.00, c: [45, 93, 136] }
    ],

    MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    MESES_ABREV: ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'set.', 'oct.', 'nov.', 'dic.'],

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    numero(valor) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return Number(valor).toLocaleString('de-DE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    },

    fechaLarga(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-');
        if (partes.length !== 3) return fecha;
        const [y, m, d] = partes.map(Number);
        return `${d} de ${this.MESES[m - 1] || ''} de ${y}`;
    },

    fechaHeader(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-');
        if (partes.length !== 3) return fecha;
        const [y, m, d] = partes.map(Number);
        return `${d} de ${this.MESES_ABREV[m - 1] || ''} de ${y}`;
    },

    rgb(color) {
        return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    },

    colorParaValor(valor, min, max) {
        if (valor === null || valor === undefined || isNaN(valor)) return '#ffffff';
        const rango = max - min;
        let t = rango > 0 ? (Number(valor) - min) / rango : 0;
        t = Math.max(0, Math.min(1, t));

        const paleta = this.PALETA;
        let desde = paleta[0];
        let hasta = paleta[paleta.length - 1];

        for (let i = 0; i < paleta.length - 1; i++) {
            if (t >= paleta[i].p && t <= paleta[i + 1].p) {
                desde = paleta[i];
                hasta = paleta[i + 1];
                break;
            }
        }

        const rangoLocal = (hasta.p - desde.p) || 1;
        const local = (t - desde.p) / rangoLocal;
        const color = desde.c.map((canal, i) => Math.round(canal + (hasta.c[i] - canal) * local));
        return this.rgb(color);
    },

    construirGrupos(data) {
        const grupos = [];
        const mapaCuentas = new Map();

        data.forEach(row => {
            const claveCuenta = `${row.cuentaventa}|||${row.nomcuentaventa || ''}`;
            let grupo = mapaCuentas.get(claveCuenta);

            if (!grupo) {
                grupo = {
                    cuentaventa: row.cuentaventa,
                    nomcuentaventa: row.nomcuentaventa || '',
                    zonas: [],
                    mapaZonas: new Map()
                };
                mapaCuentas.set(claveCuenta, grupo);
                grupos.push(grupo);
            }

            let zona = grupo.mapaZonas.get(row.zonafiscal);
            if (!zona) {
                zona = {
                    zonafiscal: row.zonafiscal,
                    celdas: new Map()
                };
                grupo.mapaZonas.set(row.zonafiscal, zona);
                grupo.zonas.push(zona);
            }

            zona.celdas.set(row.fecha, {
                saldoinicial: row.saldoinicial,
                saldofinal: row.saldofinal
            });
        });

        return grupos;
    },

    render(contenedor, payload, controller) {
        if (!contenedor) return;

        const anterior = document.getElementById('cta-tabla-tooltip');
        if (anterior) anterior.remove();

        const data = payload && Array.isArray(payload.data) ? payload.data : [];
        const min = Number(payload && payload.min_saldofinal) || 0;
        const max = Number(payload && payload.max_saldofinal) || 0;
        const minColor = Math.min(0, min);
        const maxColor = max > minColor ? max : minColor + 1;

        let fechas = payload && Array.isArray(payload.fechas) ? payload.fechas.slice() : [];
        if (fechas.length === 0) {
            fechas = Array.from(new Set(data.map(row => row.fecha))).sort();
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
        const totalZonas = grupos.reduce((total, grupo) => total + grupo.zonas.length, 0);
        const periodo = controller && controller.currentPeriodo
            ? `${this.fechaLarga(controller.currentPeriodo.inicio)} al ${this.fechaLarga(controller.currentPeriodo.fin)}`
            : `${this.fechaLarga(fechas[0])} al ${this.fechaLarga(fechas[fechas.length - 1])}`;

        const gradiente = this.PALETA
            .map(stop => `${this.rgb(stop.c)} ${Math.round(stop.p * 100)}%`)
            .join(', ');

        const anchoCuenta = 76;
        const anchoNomCuenta = 132;
        const anchoZona = 90;
        const anchoFecha = 68;
        const leftNomCuenta = anchoCuenta;
        const leftZona = anchoCuenta + anchoNomCuenta;

        const estilosColumnas = `
            .cta-tabla-cuenta { width:${anchoCuenta}px; min-width:${anchoCuenta}px; max-width:${anchoCuenta}px; left:0; }
            .cta-tabla-nomcuenta { width:${anchoNomCuenta}px; min-width:${anchoNomCuenta}px; max-width:${anchoNomCuenta}px; left:${leftNomCuenta}px; }
            .cta-tabla-zona { width:${anchoZona}px; min-width:${anchoZona}px; max-width:${anchoZona}px; left:${leftZona}px; }
            .cta-tabla-fecha { width:${anchoFecha}px; min-width:${anchoFecha}px; max-width:${anchoFecha}px; }
        `;

        let filasHtml = '';

        grupos.forEach(grupo => {
            grupo.zonas.forEach((zona, indiceZona) => {
                filasHtml += '<tr>';

                if (indiceZona === 0) {
                    filasHtml += `
                        <td rowspan="${grupo.zonas.length}" class="cta-tabla-cuenta sticky z-20 bg-white border-b border-r border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-800 align-middle whitespace-nowrap">
                            ${this.esc(grupo.cuentaventa)}
                        </td>
                        <td rowspan="${grupo.zonas.length}" class="cta-tabla-nomcuenta sticky z-20 bg-white border-b border-r border-slate-200 px-2 py-1 text-[11px] text-slate-600 align-middle leading-[1.15]">
                            ${this.esc(grupo.nomcuentaventa)}
                        </td>
                    `;
                }

                filasHtml += `
                    <td class="cta-tabla-zona sticky z-20 bg-white border-b border-r border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 align-middle whitespace-nowrap">
                        ${this.esc(zona.zonafiscal)}
                    </td>
                `;

                fechas.forEach(fecha => {
                    const celda = zona.celdas.get(fecha);
                    if (!celda) {
                        filasHtml += `<td class="cta-tabla-fecha border-b border-r border-slate-200/70 bg-white"></td>`;
                        return;
                    }

                    const fondo = this.colorParaValor(celda.saldofinal, minColor, maxColor);
                    filasHtml += `
                        <td class="cta-tabla-fecha border-b border-r border-white/70 px-1.5 py-1 text-right align-middle whitespace-nowrap text-[11px] text-slate-800"
                            style="background:${fondo};"
                            data-cta="1"
                            data-cuenta="${this.esc(grupo.cuentaventa)}"
                            data-nomcuenta="${this.esc(grupo.nomcuentaventa)}"
                            data-zona="${this.esc(zona.zonafiscal)}"
                            data-fecha="${this.esc(fecha)}"
                            data-saldoini="${this.esc(celda.saldoinicial)}"
                            data-saldofin="${this.esc(celda.saldofinal)}">
                            <div class="leading-[1.15]">${this.numero(celda.saldoinicial)}</div>
                            <div class="leading-[1.15]">${this.numero(celda.saldofinal)}</div>
                        </td>
                    `;
                });

                filasHtml += '</tr>';
            });
        });

        const encabezadosFechas = fechas.map(fecha => `
            <th class="cta-tabla-fecha sticky top-0 z-30 bg-blue-600 border-b border-r border-blue-500 px-1 py-2 text-[10px] font-semibold text-white text-center align-bottom leading-[1.1] whitespace-normal break-words"
                title="${this.esc(this.fechaLarga(fecha))}">
                ${this.esc(this.fechaHeader(fecha))}
            </th>
        `).join('');

        contenedor.innerHTML = `
            <style>${estilosColumnas}</style>
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="text-base font-bold text-slate-800 tracking-tight">Indicadores de Saldos por Cobrar por Cuenta por Día</h3>
                        <p class="text-xs text-slate-500 font-medium mt-0.5">
                            Se cobró al: <span class="font-semibold text-slate-700">${this.esc(periodo)}</span>
                            &middot; ${grupos.length} cuentas &middot; ${totalZonas} zonas
                        </p>
                    </div>
                    <span class="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        ${data.length.toLocaleString('de-DE')} registros
                    </span>
                </div>

                <div class="flex items-stretch min-w-0">
                    <div id="cta-tabla-scroll" class="flex-1 min-w-0 overflow-auto custom-scrollbar" style="max-height:72vh;">
                        <table class="w-max min-w-full border-separate border-spacing-0 text-[11px]" style="table-layout:fixed; width:max-content; min-width:100%;">
                            <colgroup>
                                <col style="width:${anchoCuenta}px">
                                <col style="width:${anchoNomCuenta}px">
                                <col style="width:${anchoZona}px">
                                ${fechas.map(() => `<col style="width:${anchoFecha}px">`).join('')}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th class="cta-tabla-cuenta sticky top-0 z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-2 text-left text-[11px] font-bold text-white whitespace-nowrap">cuentaventa</th>
                                    <th class="cta-tabla-nomcuenta sticky top-0 z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-2 text-left text-[11px] font-bold text-white whitespace-nowrap">nomcuentaventa</th>
                                    <th class="cta-tabla-zona sticky top-0 z-50 bg-blue-600 border-b border-r border-blue-500 px-2 py-2 text-left text-[11px] font-bold text-white whitespace-nowrap">zonafiscal</th>
                                    ${encabezadosFechas}
                                </tr>
                            </thead>
                            <tbody>
                                ${filasHtml}
                            </tbody>
                        </table>
                    </div>

                    <div class="w-[84px] shrink-0 border-l border-slate-200 bg-slate-50/70 px-2 py-3 flex flex-col items-center">
                        <span class="text-[11px] font-bold text-slate-600 mb-1 text-center leading-tight">saldofinal</span>
                        <span class="text-[10px] font-mono text-slate-600 mb-1">${this.numero(maxColor)}</span>
                        <div class="w-4 flex-1 min-h-[140px] max-h-[220px] rounded-sm border border-slate-300"
                            style="background: linear-gradient(to top, ${gradiente});"></div>
                        <span class="text-[10px] font-mono text-slate-600 mt-1">${this.numero(minColor)}</span>
                    </div>
                </div>
            </div>
        `;

        this.bindTooltip(contenedor);
    },

    bindTooltip(contenedor) {
        const scroll = contenedor.querySelector('#cta-tabla-scroll');
        if (!scroll) return;

        const tooltip = document.createElement('div');
        tooltip.id = 'cta-tabla-tooltip';
        tooltip.className = 'fixed z-[9999] hidden w-[300px] rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] shadow-xl pointer-events-none';
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
            const filas = [
                ['cuentaventa', td.dataset.cuenta],
                ['nomcuentaventa', td.dataset.nomcuenta],
                ['zonafiscal', td.dataset.zona],
                ['Día de fechacarga', this.fechaLarga(td.dataset.fecha)],
                ['saldofinal', this.numero(td.dataset.saldofin)],
                ['saldoinicial', this.numero(td.dataset.saldoini)]
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
            const td = event.target.closest('td[data-cta]');
            if (!td) {
                ocultar();
                return;
            }
            mostrar(td, event);
        });

        scroll.addEventListener('mousemove', event => {
            if (tooltip.classList.contains('hidden')) return;
            const td = event.target.closest('td[data-cta]');
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
