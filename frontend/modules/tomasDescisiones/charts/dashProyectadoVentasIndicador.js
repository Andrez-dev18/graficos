window.DashProyectadoVentasIndicadorView = {
    MEDIDAS: [
        { key: 'cantidadp', label: 'Cantidad<br>Proyectada', tipo: 'int' },
        { key: 'pesop', label: 'Peso<br>Proyectado', tipo: 'peso' },
        { key: 'ppromp', label: 'Peso Prom<br>Proyectado', tipo: 'prom' },
        { key: 'preciop', label: 'Precio<br>Proyectado', tipo: 'moneda' },
        { key: 'ventap', label: 'Venta<br>Proyectada', tipo: 'moneda' },
        { key: 'cantidadr', label: 'Cantidad<br>Real', tipo: 'int' },
        { key: 'pesor', label: 'Peso<br>Real', tipo: 'peso' },
        { key: 'ppromr', label: 'Peso Prom<br>Real', tipo: 'prom' },
        { key: 'precior', label: 'Precio<br>Real', tipo: 'moneda' },
        { key: 'ventar', label: 'Venta<br>Real', tipo: 'moneda' },
        { key: 'varprecio', label: 'Variación<br>Precio', tipo: 'moneda3' },
        { key: 'varpprom', label: 'Variación<br>Peso Prom', tipo: 'prom' }
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

    moneda(valor, decimales = 2) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return `S/ ${this.numero(valor, decimales)}`;
    },

    fechaLarga(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-').map(Number);
        if (partes.length !== 3 || !partes[0]) return fecha;
        const [anio, mes, dia] = partes;
        const date = new Date(anio, mes - 1, dia);
        return `${this.DIAS[date.getDay()]}, ${dia} de ${this.MESES[mes - 1]} de ${anio}`;
    },

    fechaMedia(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-').map(Number);
        if (partes.length !== 3 || !partes[0]) return fecha;
        const [anio, mes, dia] = partes;
        return `${dia} de ${this.MESES[mes - 1]} de ${anio}`;
    },

    formatoMedida(medida, valor) {
        switch (medida.tipo) {
            case 'int': return this.numero(valor, 0);
            case 'peso': return this.numero(valor, 2);
            case 'prom': return this.numero(valor, 3);
            case 'moneda': return this.moneda(valor, 2);
            case 'moneda3': return this.moneda(valor, 3);
            default: return this.numero(valor, 2);
        }
    },

    claseVariacion(valor) {
        const n = Number(valor);
        if (!isFinite(n) || n === 0) return 'variacion-cero';
        return n > 0 ? 'variacion-pos' : 'variacion-neg';
    },

    claseIndicador(valor) {
        const n = Number(valor);
        if (!isFinite(n) || n === 0) return 'indicador-cero';
        return n > 0 ? 'indicador-pos' : 'indicador-neg';
    },

    colorReal(real) {
        if (real === 'SI') return '#4e79a7';
        if (real === 'NO') return '#499894';
        return '#cbd5e1';
    },

    bindTooltips(contenedor) {
        if (!contenedor) return;

        if (contenedor._tomasTooltip) {
            contenedor._tomasTooltip.remove();
            contenedor._tomasTooltip = null;
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'pointer-events-none fixed hidden w-max max-w-[360px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-700 shadow-2xl';
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.zIndex = '9999';
        tooltip.style.width = '260px';
        tooltip.style.maxWidth = '360px';
        tooltip.style.backgroundColor = '#ffffff';
        tooltip.style.border = '1px solid #e2e8f0';
        tooltip.style.boxShadow = '0 20px 25px -5px rgba(15,23,42,0.18), 0 8px 10px -6px rgba(15,23,42,0.12)';
        document.body.appendChild(tooltip);
        contenedor._tomasTooltip = tooltip;

        const posicionar = (event) => {
            const margen = 14;
            const ancho = tooltip.offsetWidth || 0;
            const alto = tooltip.offsetHeight || 0;
            let x = event.clientX + margen;
            let y = event.clientY + margen;
            if (x + ancho > window.innerWidth - 8) x = event.clientX - ancho - margen;
            if (y + alto > window.innerHeight - 8) y = event.clientY - alto - margen;
            tooltip.style.left = `${Math.max(8, x)}px`;
            tooltip.style.top = `${Math.max(8, y)}px`;
        };

        const obtenerTarget = (event) => {
            return event.target && event.target.closest ? event.target.closest('[data-tip]') : null;
        };

        contenedor.onmouseover = (event) => {
            const target = obtenerTarget(event);
            if (!target) {
                tooltip.classList.add('hidden');
                return;
            }
            tooltip.innerHTML = this.contenidoTooltip(target);
            tooltip.classList.remove('hidden');
            posicionar(event);
        };

        contenedor.onmousemove = (event) => {
            if (tooltip.classList.contains('hidden')) return;
            const target = obtenerTarget(event);
            if (!target) {
                tooltip.classList.add('hidden');
                return;
            }
            posicionar(event);
        };

        contenedor.onmouseleave = () => tooltip.classList.add('hidden');

        if (!this._tooltipScrollBound) {
            const ocultar = () => {
                if (contenedor._tomasTooltip) contenedor._tomasTooltip.classList.add('hidden');
            };
            document.addEventListener('scroll', ocultar, true);
            window.addEventListener('resize', ocultar);
            this._tooltipScrollBound = true;
        }
    },

    contenidoTooltip(target) {
        const datos = target.dataset || {};
        const fila = (etiqueta, valor) => `
            <span class="whitespace-nowrap text-slate-500">${this.esc(etiqueta)}:</span>
            <span class="font-semibold text-slate-800">${this.esc(valor)}</span>
        `;
        const titulo = `
            <div class="mb-1 border-b border-slate-100 pb-1 text-xs font-bold text-slate-900">
                ${this.esc(datos.proceso || '')}
            </div>
        `;

        if (datos.tip === 'diario') {
            return `
                ${titulo}
                <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                    ${fila('real', datos.real || '—')}
                    ${fila('semana', datos.semana || '')}
                    ${fila('Día de fecha', this.fechaLarga(datos.fecha))}
                    <div class="col-span-2 mt-0.5 border-t border-slate-100 pt-1"></div>
                    ${fila(datos.medidaLabel || '', datos.medidaValor || '')}
                </div>
            `;
        }

        const peso = datos.vppromValido === '1' ? this.numero(datos.varpprom, 3) : '';

        return `
            ${titulo}
            <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                ${fila('semana', datos.semana || '')}
                ${fila('Día de fecha', this.fechaMedia(datos.fecha))}
                <div class="col-span-2 mt-0.5 border-t border-slate-100 pt-1"></div>
                ${fila('Variación Precio', this.moneda(datos.varprecio, 3))}
                ${fila('Variación Peso Prom', peso)}
            </div>
        `;
    },

    buscarIndicador(payload, semana, proceso) {
        return (payload.indicadoresSemanales || []).find(item =>
            String(item.semana) === String(semana) && item.proceso === proceso
        ) || null;
    },

    buscarTotal(payload, semana, proceso) {
        return (payload.totalesSemanales || []).find(item =>
            String(item.semana) === String(semana) && item.proceso === proceso
        ) || null;
    },

    render(contenedor, payload, controller) {
        if (!contenedor) return;

        if (!payload || !Array.isArray(payload.semanas) || payload.semanas.length === 0) {
            if (contenedor._tomasTooltip) {
                contenedor._tomasTooltip.remove();
                contenedor._tomasTooltip = null;
            }
            contenedor.onmouseover = null;
            contenedor.onmousemove = null;
            contenedor.onmouseleave = null;
            contenedor.innerHTML = `
                <div class="dash-card p-10 text-center text-slate-400 font-medium">
                    No se encontraron semanas con información para el período seleccionado.
                </div>
            `;
            return;
        }

        const topCard = this.renderTop(payload);
        const indicadoresCard = this.renderIndicadoresSemanales(payload);
        const totalCard = this.renderTotales(payload);
        const indicadoresTotalesCard = this.renderIndicadoresTotales(payload);

        contenedor.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_370px] gap-4 items-stretch">
                    ${topCard}
                    ${indicadoresCard}
                </div>
                <div class="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_370px] gap-4 items-stretch">
                    ${totalCard}
                    ${indicadoresTotalesCard}
                </div>
            </div>
        `;

        this.bindTooltips(contenedor);
        this.bindResumenScroll();
    },

    bindResumenScroll() {
        const body = document.getElementById('resumen-semanal-scroll');
        const footerWrap = document.getElementById('resumen-semanal-footer-wrap');
        if (!body || !footerWrap) return;

        if (this._resumenScrollHandler) {
            body.removeEventListener('scroll', this._resumenScrollHandler);
        }

        const sincronizar = () => {
            footerWrap.scrollLeft = body.scrollLeft;
        };
        this._resumenScrollHandler = sincronizar;
        body.addEventListener('scroll', sincronizar);

        const scrollbarWidth = Math.max(0, body.offsetWidth - body.clientWidth);
        footerWrap.style.paddingRight = `${scrollbarWidth}px`;
        sincronizar();
    },

    renderTop(payload) {
        const bloques = payload.semanas.map(semana => this.renderBloqueSemana(payload, semana)).join('');

        return `
            <section class="dash-card flex flex-col">
                <header class="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div>
                        <h2 class="text-sm font-bold text-slate-900 underline underline-offset-4 uppercase tracking-wide">Proyección de Venta Diaria</h2>
                        <p class="text-[11px] text-slate-500 mt-0.5">Semana seleccionada · ${payload.semanas.length} bloque(s)</p>
                    </div>
                    <div class="flex items-center gap-3 text-[10px] text-slate-500">
                        <span class="font-bold uppercase tracking-wide">Datos Reales</span>
                        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-sm" style="background:#4e79a7"></span>SI</span>
                        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded-sm" style="background:#499894"></span>NO</span>
                    </div>
                </header>
                <div class="flex items-start gap-4 overflow-auto custom-scrollbar p-3">
                    ${bloques}
                </div>
            </section>
        `;
    },

    renderBloqueSemana(payload, semana) {
        const dias = (payload.dias || []).filter(dia => String(dia.semana) === String(semana));
        const procesos = payload.procesos || [];
        const encabezados = this.MEDIDAS.map(medida => `
            <th class="bg-blue-600 px-1.5 py-2 text-center align-bottom text-[10px] font-semibold leading-tight text-white"
                style="min-width:88px;max-width:88px;">${medida.label}</th>
        `).join('');

        if (!dias.length) {
            return `
                <div class="w-max shrink-0 dash-card overflow-hidden">
                    <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-800">Semana ${this.esc(semana)}</span>
                    </div>
                    <div class="px-10 py-8 text-xs text-slate-400 text-center">Sin datos para esta semana.</div>
                </div>
            `;
        }

        let filas = '';

        dias.forEach(dia => {
            const procesosDia = procesos.map(proceso => {
                return (dia.procesos || []).find(item => item.proceso === proceso) || {
                    proceso,
                    real: '',
                    medidas: {}
                };
            });

            procesosDia.forEach((item, indice) => {
                filas += `<tr class="${indice === 0 ? 'dash-dia-inicio' : ''}">`;

                if (indice === 0) {
                    filas += `
                        <td rowspan="${procesosDia.length}" class="align-middle px-2 py-1.5 text-[11px] font-semibold leading-tight text-slate-700"
                            style="min-width:150px;max-width:150px;background:#fff;">
                            ${this.esc(this.fechaLarga(dia.fecha))}
                        </td>
                    `;
                }

                filas += `
                    <td class="align-middle px-2 py-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap"
                        style="min-width:120px;max-width:120px;background:#fff;">
                        <span class="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                            style="background:${this.colorReal(item.real)};" title="Dato real: ${this.esc(item.real || '—')}"></span>
                        ${this.esc(item.proceso)}
                    </td>
                `;

                this.MEDIDAS.forEach(medida => {
                    const valor = item.medidas ? item.medidas[medida.key] : null;
                    const esVariacion = medida.key === 'varprecio' || medida.key === 'varpprom';
                    const clase = esVariacion ? this.claseVariacion(valor) : '';
                    const valorFormateado = this.formatoMedida(medida, valor);
                    const etiquetaMedida = medida.label.replace(/<br\s*\/?>/gi, ' ');
                    filas += `
                        <td class="px-1.5 py-1.5 text-right align-middle whitespace-nowrap text-[11px] ${clase}"
                            data-tip="diario"
                            data-proceso="${this.esc(item.proceso)}"
                            data-real="${this.esc(item.real || '')}"
                            data-semana="${this.esc(semana)}"
                            data-fecha="${this.esc(dia.fecha)}"
                            data-medida-label="${this.esc(etiquetaMedida)}"
                            data-medida-valor="${this.esc(valorFormateado)}">
                            ${valorFormateado}
                        </td>
                    `;
                });

                filas += '</tr>';
            });
        });

        return `
            <div class="w-max shrink-0 dash-card overflow-hidden">
                <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-800">Semana ${this.esc(semana)}</span>
                    <span class="text-[10px] text-slate-400">${dias.length} días</span>
                </div>
                <table class="dash-table text-[11px] dash-align">
                    <thead>
                        <tr>
                            <th class="px-2 py-2 text-left text-[10px] font-bold text-white"
                                style="min-width:150px;max-width:150px;background:#2563eb;">Día de FecProceso</th>
                            <th class="px-2 py-2 text-left text-[10px] font-bold text-white"
                                style="min-width:120px;max-width:120px;background:#2563eb;">proceso</th>
                            ${encabezados}
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        `;
    },

    renderIndicadoresSemanales(payload) {
        const semanas = payload.semanas || [];
        const procesos = payload.procesos || [];

        const bloques = semanas.map(semana => {
            const diasSemana = (payload.dias || []).filter(dia => String(dia.semana) === String(semana));

            if (!diasSemana.length) {
                return `
                    <div class="w-max shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-6">
                            <span class="text-xs font-bold text-slate-800">Semana ${this.esc(semana)}</span>
                        </div>
                        <div class="px-8 py-6 text-xs text-slate-400 text-center">Sin datos para esta semana.</div>
                    </div>
                `;
            }

            let filas = '';

            diasSemana.forEach(dia => {
                const procesosDia = procesos.map(proceso => {
                    return (dia.procesos || []).find(item => item.proceso === proceso) || {
                        proceso,
                        real: '',
                        medidas: {}
                    };
                });

                procesosDia.forEach((item, indice) => {
                    const medidas = item.medidas || {};
                    const precio = medidas.varprecio;
                    const tienePeso = Number(medidas.cantidadp) > 0
                        && Number(medidas.cantidadr) > 0
                        && medidas.varpprom !== null
                        && medidas.varpprom !== undefined
                        && medidas.varpprom !== '';
                    const peso = tienePeso ? medidas.varpprom : null;

                    filas += `
                        <tr class="${indice === 0 ? 'dash-dia-inicio' : ''}" data-tip="indicador"
                            data-proceso="${this.esc(item.proceso)}"
                            data-semana="${this.esc(semana)}"
                            data-fecha="${this.esc(dia.fecha)}"
                            data-varprecio="${this.esc(precio === null || precio === undefined ? '' : precio)}"
                            data-varpprom="${this.esc(tienePeso ? peso : '')}"
                            data-vpprom-valido="${tienePeso ? '1' : '0'}">
                            <td class="px-2 py-1.5 text-left text-[11px] font-medium text-slate-700 whitespace-nowrap"
                                style="min-width:110px;max-width:110px;">${this.esc(item.proceso)}</td>
                            <td class="px-1.5 py-1.5 text-center align-middle">
                                <span class="dash-indicador inline-flex items-center justify-center min-w-[68px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(precio)}">
                                    ${this.moneda(precio, 3)}
                                </span>
                            </td>
                            <td class="px-1.5 py-1.5 text-center align-middle">
                                ${tienePeso ? `
                                    <span class="dash-indicador inline-flex items-center justify-center min-w-[68px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(peso)}">
                                        ${this.numero(peso, 3)}
                                    </span>
                                ` : `
                                    <span class="dash-indicador inline-flex items-center justify-center min-w-[68px] px-2 py-0 rounded text-[10px] font-bold bg-slate-100 text-slate-400">&nbsp;</span>
                                `}
                            </td>
                        </tr>
                    `;
                });
            });

            return `
                <div class="w-max shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-6">
                        <span class="text-xs font-bold text-slate-800">Semana ${this.esc(semana)}</span>
                        <span class="text-[10px] text-slate-400">${diasSemana.length} días</span>
                    </div>
                    <table class="dash-table text-[11px] dash-align">
                        <thead>
                            <tr>
                                <th class="px-2 py-2 text-left text-[10px] font-bold text-white"
                                    style="background:#2563eb;min-width:110px;max-width:110px;">proceso</th>
                                <th class="px-2 py-2 text-center text-[10px] font-bold text-white"
                                    style="background:#2563eb;min-width:78px;">Var Precio</th>
                                <th class="px-2 py-2 text-center text-[10px] font-bold text-white"
                                    style="background:#2563eb;min-width:86px;">Var Peso Prom</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        return `
            <section class="dash-card flex flex-col">
                <header class="px-4 py-3 border-b border-slate-200 shrink-0">
                    <h2 class="text-sm font-bold text-slate-900 underline underline-offset-4 uppercase tracking-wide">Indicadores Semanales</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Detalle diario por proceso</p>
                </header>
                <div class="flex items-start gap-4 overflow-auto custom-scrollbar p-3">
                    ${bloques}
                </div>
            </section>
        `;
    },

    renderTotales(payload) {
        const semanas = payload.semanas || [];
        const procesos = payload.procesos || [];
        const totalGeneral = payload.totalGeneral && payload.totalGeneral.medidas ? payload.totalGeneral.medidas : {};

        const encabezados = this.MEDIDAS.map(medida => `
            <th class="sticky top-0 z-40 bg-blue-600 px-1.5 py-2 text-center align-bottom text-[10px] font-semibold leading-tight text-white"
                style="min-width:88px;max-width:88px;">${medida.label}</th>
        `).join('');

        let filas = '';

        semanas.forEach(semana => {
            procesos.forEach((proceso, indice) => {
                const total = this.buscarTotal(payload, semana, proceso);
                const medidas = total ? total.medidas : {};

                filas += '<tr>';
                if (indice === 0) {
                    filas += `
                        <td rowspan="${procesos.length}" class="col-fija sticky left-0 z-30 align-middle px-2 py-1.5 text-[11px] font-bold text-slate-700 whitespace-nowrap"
                            style="background:#fff;min-width:110px;">
                            Semana ${this.esc(semana)}
                        </td>
                    `;
                }

                filas += `
                    <td class="col-fija sticky z-30 px-2 py-1.5 text-[11px] font-medium text-slate-700 whitespace-nowrap"
                        style="left:110px;background:#fff;min-width:130px;">${this.esc(proceso)}</td>
                `;

                this.MEDIDAS.forEach(medida => {
                    const valor = medidas ? medidas[medida.key] : null;
                    const esVariacion = medida.key === 'varprecio' || medida.key === 'varpprom';
                    const clase = esVariacion ? this.claseVariacion(valor) : '';
                    filas += `
                        <td class="px-1.5 py-1.5 text-right align-middle whitespace-nowrap text-[11px] ${clase}">
                            ${this.formatoMedida(medida, valor)}
                        </td>
                    `;
                });

                filas += '</tr>';
            });
        });

        const totalGeneralRow = `
            <tr class="font-bold">
                <td colspan="2" class="col-fija sticky left-0 z-30 px-2 py-2 text-[11px] text-slate-900"
                    style="background:#f8fafc;min-width:240px;">Total general</td>
                ${this.MEDIDAS.map(medida => {
                    const valor = totalGeneral[medida.key];
                    const esVariacion = medida.key === 'varprecio' || medida.key === 'varpprom';
                    const clase = esVariacion ? this.claseVariacion(valor) : '';
                    return `<td class="px-1.5 py-2 text-right text-[11px] ${clase}">${this.formatoMedida(medida, valor)}</td>`;
                }).join('')}
            </tr>
        `;

        const colsResumen = `
            <colgroup>
                <col style="width:110px;">
                <col style="width:130px;">
                ${this.MEDIDAS.map(() => '<col style="width:88px;">').join('')}
            </colgroup>
        `;
        const alturaBody = 44 + procesos.length * 32;

        return `
            <section class="dash-card flex flex-col">
                <header class="px-4 py-3 border-b border-slate-200 shrink-0">
                    <h2 class="text-sm font-bold text-slate-900 underline underline-offset-4 uppercase tracking-wide">Resumen Semanal</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Totales por semana y total general</p>
                </header>
                <div id="resumen-semanal-scroll" class="overflow-auto custom-scrollbar" style="height:${alturaBody}px;">
                    <table class="dash-table text-[11px] dash-align dash-fixed">
                        ${colsResumen}
                        <thead>
                            <tr>
                                <th class="col-fija sticky top-0 left-0 z-50 px-2 py-2 text-left text-[10px] font-bold text-white"
                                    style="background:#2563eb;min-width:110px;">Semana</th>
                                <th class="col-fija sticky top-0 z-50 px-2 py-2 text-left text-[10px] font-bold text-white"
                                    style="left:110px;background:#2563eb;min-width:130px;">proceso</th>
                                ${encabezados}
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
                <div id="resumen-semanal-footer-wrap" class="custom-scrollbar" style="height:32px;overflow-x:hidden;overflow-y:hidden;">
                    <table class="dash-table text-[11px] dash-align dash-fixed">
                        ${colsResumen}
                        <tfoot>${totalGeneralRow}</tfoot>
                    </table>
                </div>
            </section>
        `;
    },

    renderIndicadoresTotales(payload) {
        const indicadores = payload.indicadoresTotales || [];
        const totalGeneral = payload.totalGeneral && payload.totalGeneral.medidas ? payload.totalGeneral.medidas : {};

        const filas = indicadores.map(item => `
            <tr>
                <td class="col-fija sticky left-0 z-20 px-2 py-2 text-[11px] font-semibold text-slate-700 whitespace-nowrap"
                    style="background:#fff;min-width:120px;">${this.esc(item.proceso)}</td>
                <td class="px-1.5 py-2 text-center">
                    <span class="dash-indicador inline-flex items-center justify-center min-w-[70px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(item.varprecio)}">
                        ${this.moneda(item.varprecio, 3)}
                    </span>
                </td>
                <td class="px-1.5 py-2 text-center">
                    <span class="dash-indicador inline-flex items-center justify-center min-w-[70px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(item.varpprom)}">
                        ${this.numero(item.varpprom, 3)}
                    </span>
                </td>
            </tr>
        `).join('');

        const totalRow = `
            <tr class="font-bold">
                <td class="col-fija sticky left-0 z-20 px-2 py-2 text-[11px] text-slate-900 whitespace-nowrap"
                    style="background:#f8fafc;min-width:120px;">Total general</td>
                <td class="px-1.5 py-2 text-center">
                    <span class="dash-indicador inline-flex items-center justify-center min-w-[70px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(totalGeneral.varprecio)}">
                        ${this.moneda(totalGeneral.varprecio, 3)}
                    </span>
                </td>
                <td class="px-1.5 py-2 text-center">
                    <span class="dash-indicador inline-flex items-center justify-center min-w-[70px] px-2 py-0 rounded text-[10px] font-bold ${this.claseIndicador(totalGeneral.varpprom)}">
                        ${this.numero(totalGeneral.varpprom, 3)}
                    </span>
                </td>
            </tr>
        `;

        return `
            <section class="dash-card flex flex-col">
                <header class="px-4 py-3 border-b border-slate-200 shrink-0">
                    <h2 class="text-sm font-bold text-slate-900 underline underline-offset-4 uppercase tracking-wide">Total</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Variación de todas las semanas seleccionadas</p>
                </header>
                <div class="overflow-auto custom-scrollbar">
                    <table class="dash-table text-[11px] dash-align">
                        <thead>
                            <tr>
                                <th class="col-fija sticky top-0 left-0 z-50 px-2 py-2 text-left text-[10px] font-bold text-white"
                                    style="background:#2563eb;min-width:120px;">proceso</th>
                                <th class="sticky top-0 z-40 bg-blue-600 px-2 py-2 text-center text-[10px] font-bold text-white">Var Precio</th>
                                <th class="sticky top-0 z-40 bg-blue-600 px-2 py-2 text-center text-[10px] font-bold text-white">Var Peso Prom</th>
                            </tr>
                        </thead>
                        <tbody>${filas}</tbody>
                        <tfoot>${totalRow}</tfoot>
                    </table>
                </div>
            </section>
        `;
    }
};
