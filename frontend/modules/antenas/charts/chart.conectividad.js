window.ChartRegistry = window.ChartRegistry || {};

window.ChartConectividadAntenas = {
    controllerRef: null,
    containerRef: null,
    datos: null,
    _meses: [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ],
    _tooltipEl: null,
    _tooltipTimer: null,
    _tooltipTarget: null,
    _tooltipContainer: null,
    _mouseX: 0,
    _mouseY: 0,
    _tooltipGlobalBound: false,
    _tooltipAbort: null,
    _paginationBound: false,
    _contextoActivo: false,
    _foco: null,
    _focusKeyBound: false,

    render(controller, data, container) {
        this.controllerRef = controller;
        this.datos = data || {};
        this.containerRef = (typeof container === 'string' ? document.getElementById(container) : container)
            || document.getElementById('contenedor-antenas');
        this._inicializarTooltip();
        this._bindTooltipEvents();
        this._bindPaginationEvents();
        this.renderView();
    },

    escapeHtml(valor) {
        return String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatFechaLarga(valor) {
        const partes = String(valor || '').split('-');
        if (partes.length !== 3) return valor;
        return `${Number(partes[2])} de ${this._meses[Number(partes[1]) - 1] || ''} de ${partes[0]}`;
    },

    formatHora(valor) {
        return String(Number(valor));
    },

    _spans(filas, claveFn) {
        const spans = {};
        let indice = 0;

        while (indice < filas.length) {
            const clave = claveFn(filas[indice]);
            let fin = indice + 1;

            while (fin < filas.length && claveFn(filas[fin]) === clave) {
                fin++;
            }

            spans[indice] = fin - indice;
            indice = fin;
        }

        return spans;
    },

    _contextoPlaceholder() {
        return '<span class="text-slate-400">Pasa el cursor sobre una celda para ver el detalle. Haz clic para fijarlo.</span>';
    },

    _clasesHover() {
        return {
            fila: 'antena-fila-activa',
            grupo: 'antena-grupo-activo',
            col: 'antena-col-activa',
            fecha: 'antena-fecha-activa'
        };
    },

    _clasesFoco() {
        return {
            fila: 'antena-foco-fila',
            grupo: 'antena-foco-grupo',
            col: 'antena-foco-col',
            fecha: 'antena-foco-fecha',
            celda: 'antena-celda-foco'
        };
    },

    _limpiarClasesContexto() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        contenedor.querySelectorAll('.antena-fila-activa, .antena-grupo-activo, .antena-col-activa, .antena-fecha-activa')
            .forEach(elemento => {
                elemento.classList.remove(
                    'antena-fila-activa',
                    'antena-grupo-activo',
                    'antena-col-activa',
                    'antena-fecha-activa'
                );
            });
    },

    _limpiarClasesFoco() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        contenedor.querySelectorAll('.antena-foco-fila, .antena-foco-grupo, .antena-foco-col, .antena-foco-fecha, .antena-celda-foco')
            .forEach(elemento => {
                elemento.classList.remove(
                    'antena-foco-fila',
                    'antena-foco-grupo',
                    'antena-foco-col',
                    'antena-foco-fecha',
                    'antena-celda-foco'
                );
            });

        const barra = contenedor.querySelector('[data-antenas-contexto]');
        if (barra) barra.classList.remove('antena-contexto-fijo');
    },

    _limpiarContexto() {
        const contenedor = this.containerRef;
        if (!contenedor || !this._contextoActivo) return;

        this._contextoActivo = false;
        this._limpiarClasesContexto();
        const barra = contenedor.querySelector('[data-antenas-contexto]');
        if (barra) barra.innerHTML = this._contextoPlaceholder();
    },

    _limpiarFoco() {
        this._foco = null;
        this._ocultarTooltip();

        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._limpiarClasesFoco();
        const barra = contenedor.querySelector('[data-antenas-contexto]');
        if (barra) barra.innerHTML = this._contextoPlaceholder();
    },

    _aplicarMarcas(elemento, fila, fecha, clases) {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        const tr = elemento.closest('tr');
        if (tr && clases.fila) tr.classList.add(clases.fila);

        contenedor.querySelectorAll('[data-antenas-granja]').forEach(celda => {
            if (celda.dataset.antenasGranja === fila.granja) {
                celda.classList.add(clases.grupo);
            }
        });

        contenedor.querySelectorAll('[data-antenas-antena]').forEach(celda => {
            if (celda.dataset.antenasGranja === fila.granja && celda.dataset.antenasAntena === fila.antena) {
                celda.classList.add(clases.grupo);
            }
        });

        const celda = elemento.closest('td');
        const columna = celda?.dataset.antenasCol;
        if (columna !== undefined) {
            contenedor.querySelectorAll(`[data-antenas-col="${columna}"]`).forEach(celdaColumna => {
                celdaColumna.classList.add(clases.col);
            });
        }

        contenedor.querySelectorAll('[data-antenas-fecha-header]').forEach(header => {
            if (header.dataset.antenasFechaHeader === fecha) {
                header.classList.add(clases.fecha);
            }
        });

        if (clases.celda) elemento.classList.add(clases.celda);
    },

    _enfocarContexto(elemento) {
        if (this._foco) return;

        const contenedor = this.containerRef;
        const indice = Number(elemento.dataset.antenasIndex);
        const fecha = elemento.dataset.antenasFecha;
        const hora = Number(elemento.dataset.antenasHora);
        const fila = this.datos?.filas?.[indice];
        if (!contenedor || !fila || !fecha || Number.isNaN(hora)) return;

        this._contextoActivo = true;
        this._limpiarClasesContexto();
        this._aplicarMarcas(elemento, fila, fecha, this._clasesHover());
        this._actualizarBarraContexto(fila, fecha, hora, false);
    },

    _fijarFoco(elemento) {
        const contenedor = this.containerRef;
        const indice = Number(elemento.dataset.antenasIndex);
        const fecha = elemento.dataset.antenasFecha;
        const hora = Number(elemento.dataset.antenasHora);
        const fila = this.datos?.filas?.[indice];
        if (!contenedor || !fila || !fecha || Number.isNaN(hora)) return;

        const clave = `${indice}|${fecha}|${hora}`;
        if (this._foco === clave) {
            this._limpiarFoco();
            return;
        }

        this._limpiarContexto();
        this._limpiarClasesFoco();
        this._foco = clave;
        this._aplicarMarcas(elemento, fila, fecha, this._clasesFoco());
        this._actualizarBarraContexto(fila, fecha, hora, true);
    },

    _actualizarBarraContexto(fila, fecha, hora, fijado = false) {
        const barra = this.containerRef?.querySelector('[data-antenas-contexto]');
        if (!barra) return;

        const total = fila.valores?.[`${fecha}|${hora}`];
        if (total === undefined) {
            barra.innerHTML = this._contextoPlaceholder();
            barra.classList.remove('antena-contexto-fijo');
            return;
        }

        const color = fila.conexion === 'SI' ? '#59a14f' : '#e15759';
        const accion = fijado
            ? `
                <span class="ml-auto inline-flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    <i class="fa-solid fa-thumbtack"></i>
                    Fijado
                </span>
                <button type="button" data-antenas-quitar-foco
                    class="inline-flex items-center rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer">
                    Quitar foco
                </button>
            `
            : '<span class="ml-auto text-[9px] font-semibold text-slate-400">Clic para fijar</span>';

        barra.classList.toggle('antena-contexto-fijo', fijado);
        barra.innerHTML = `
            <span class="font-bold text-slate-700">${this.escapeHtml(fila.granja)}</span>
            <span class="text-slate-300">|</span>
            <span class="font-semibold text-slate-700">${this.escapeHtml(fila.antena)}</span>
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style="background:${color};">${this.escapeHtml(fila.conexion)}</span>
            <span class="text-slate-300">|</span>
            <span>${this.escapeHtml(this.formatFechaLarga(fecha))}</span>
            <span class="text-slate-300">|</span>
            <span>${String(hora).padStart(2, '0')}:00</span>
            <span class="text-slate-300">|</span>
            <span><span class="font-semibold text-slate-700">${Number(total).toLocaleString('es-PE')}</span> registros</span>
            ${accion}
        `;
    },

    _inicializarTooltip() {
        if (!this._tooltipEl) {
            this._tooltipEl = document.getElementById('antenas-tooltip');
            if (!this._tooltipEl) {
                this._tooltipEl = document.createElement('div');
                this._tooltipEl.id = 'antenas-tooltip';
                this._tooltipEl.className = 'hidden fixed z-[100] pointer-events-none bg-white text-slate-800 text-[11px] rounded-sm shadow-2xl border border-slate-300 p-3 min-w-[300px] max-w-[420px] font-sans';
                document.body.appendChild(this._tooltipEl);
            }
        }

        if (!this._tooltipGlobalBound) {
            window.addEventListener('scroll', () => {
                this._ocultarTooltip();
                this._limpiarContexto();
            }, true);
            this._tooltipGlobalBound = true;
        }
    },

    _bindTooltipEvents() {
        const contenedor = this.containerRef;
        if (!contenedor || this._tooltipContainer === contenedor) return;

        this._tooltipContainer = contenedor;

        if (this._tooltipAbort) {
            this._tooltipAbort.abort();
        }
        this._tooltipAbort = new AbortController();
        const signal = this._tooltipAbort.signal;

        contenedor.addEventListener('mouseover', event => {
            const objetivo = event.target.closest?.('[data-antenas-tt]');
            if (!objetivo || objetivo === this._tooltipTarget) return;

            this._ocultarTooltip();
            this._tooltipTarget = objetivo;
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;
            this._enfocarContexto(objetivo);

            clearTimeout(this._tooltipTimer);
            this._tooltipTimer = setTimeout(() => {
                if (this._tooltipTarget === objetivo) {
                    this._mostrarTooltip(objetivo);
                }
            }, 500);
        }, { signal });

        contenedor.addEventListener('mousemove', event => {
            this._mouseX = event.clientX;
            this._mouseY = event.clientY;

            if (this._tooltipEl && !this._tooltipEl.classList.contains('hidden')) {
                this._posicionarTooltip();
            }
        }, { signal });

        contenedor.addEventListener('mouseout', event => {
            const objetivo = event.target.closest?.('[data-antenas-tt]');
            if (!objetivo) return;
            if (event.relatedTarget && objetivo.contains(event.relatedTarget)) return;

            if (this._tooltipTarget === objetivo) {
                this._ocultarTooltip();
            }
            this._limpiarContexto();
        }, { signal });

        contenedor.addEventListener('mouseleave', () => {
            this._ocultarTooltip();
            this._limpiarContexto();
        }, { signal });

        contenedor.addEventListener('click', event => {
            const quitarFoco = event.target.closest?.('[data-antenas-quitar-foco]');
            if (quitarFoco) {
                event.preventDefault();
                this._limpiarFoco();
                return;
            }

            const objetivo = event.target.closest?.('[data-antenas-tt]');
            if (!objetivo) return;

            this._fijarFoco(objetivo);
        }, { signal });

        if (!this._focusKeyBound) {
            document.addEventListener('keydown', event => {
                if ((event.key === 'Escape' || event.key === 'Esc') && this._foco) {
                    this._limpiarFoco();
                }
            });
            this._focusKeyBound = true;
        }
    },

    _mostrarTooltip(elemento) {
        if (!this._tooltipEl) return;

        const indice = Number(elemento.dataset.antenasIndex);
        const fecha = elemento.dataset.antenasFecha;
        const hora = Number(elemento.dataset.antenasHora);
        const fila = this.datos?.filas?.[indice];
        const total = fila?.valores?.[`${fecha}|${hora}`];
        if (!fila || total === undefined) return;

        const campos = [
            ['Granja', fila.granja],
            ['Antena', fila.antena],
            ['Conexión', fila.conexion],
            ['Fecha', this.formatFechaLarga(fecha)],
            ['Hora', String(hora)],
            ['Número de registros', String(total)]
        ];

        this._tooltipEl.innerHTML = `
            <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-sans leading-snug">
                ${campos.map(([etiqueta, valor]) => `
                    <span class="text-slate-500 font-normal whitespace-nowrap">${this.escapeHtml(etiqueta)}:</span>
                    <span class="text-slate-900 font-semibold text-left break-words">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;

        this._tooltipEl.classList.remove('hidden');
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        if (!this._tooltipEl) return;

        const tooltipWidth = this._tooltipEl.offsetWidth || 320;
        const tooltipHeight = this._tooltipEl.offsetHeight || 160;
        let x = this._mouseX + 14;
        let y = this._mouseY + 14;

        if (x + tooltipWidth > window.innerWidth - 12) {
            x = this._mouseX - tooltipWidth - 14;
        }
        if (y + tooltipHeight > window.innerHeight - 12) {
            y = this._mouseY - tooltipHeight - 14;
        }

        this._tooltipEl.style.left = `${Math.max(10, x)}px`;
        this._tooltipEl.style.top = `${Math.max(10, y)}px`;
    },

    _ocultarTooltip() {
        clearTimeout(this._tooltipTimer);
        this._tooltipTimer = null;
        this._tooltipTarget = null;

        if (this._tooltipEl) {
            this._tooltipEl.classList.add('hidden');
        }
    },

    _bindPaginationEvents() {
        if (this._paginationBound || !this.containerRef) return;
        this._paginationBound = true;

        this.containerRef.addEventListener('click', event => {
            const boton = event.target.closest?.('[data-antenas-page]');
            if (!boton || boton.disabled) return;
            this.controllerRef?.cambiarPagina?.(Number(boton.dataset.antenasPage));
        });
    },

    _cumpleFiltros(fila, filtros, busqueda) {
        if (filtros.granja && fila.granja !== filtros.granja) return false;
        if (filtros.antena && fila.antena !== filtros.antena) return false;
        if (busqueda && !`${fila.granja} ${fila.antena}`.toLowerCase().includes(busqueda)) return false;
        return true;
    },

    _estadosVisibles(filtros) {
        if (filtros.estado === 'fallas') return ['NO'];
        if (filtros.estado === 'conectados') return ['SI'];
        return ['SI', 'NO'];
    },

    _agruparAntenas(filas) {
        const grupos = new Map();

        filas.forEach(fila => {
            const clave = `${fila.granja}\x1F${fila.antena}`;
            if (!grupos.has(clave)) {
                grupos.set(clave, {
                    granja: fila.granja,
                    antena: fila.antena,
                    porEstado: {}
                });
            }

            grupos.get(clave).porEstado[fila.conexion] = fila;
        });

        return Array.from(grupos.values());
    },

    _resumenFilas(filas) {
        const granjas = new Set();
        const antenas = new Set();
        const antenasConFalla = new Set();
        let celdasNo = 0;
        let celdasSi = 0;

        filas.forEach(fila => {
            if (fila.granja) granjas.add(fila.granja);

            const claveAntena = `${fila.granja}|${fila.antena}`;
            if (fila.antena) antenas.add(claveAntena);

            const claves = Object.keys(fila.valores || {});
            if (claves.length && fila.conexion !== 'SI') {
                antenasConFalla.add(claveAntena);
            }

            if (fila.conexion === 'SI') {
                celdasSi += claves.length;
            } else {
                celdasNo += claves.length;
            }
        });

        const totalCeldas = celdasSi + celdasNo;
        const disponibilidad = totalCeldas ? (celdasSi / totalCeldas) * 100 : 0;

        return {
            granjas: granjas.size,
            antenas: antenas.size,
            conFallas: antenasConFalla.size,
            celdasNo,
            celdasSi,
            disponibilidad
        };
    },

    _paginacion() {
        const page = Number(this.datos?.page || 1);
        const pageSize = Number(this.datos?.page_size_dias || 7);
        const totalDias = Number(this.datos?.total_dias || 0);
        const totalPaginas = Number(this.datos?.total_paginas || 0);
        const desde = totalDias > 0 ? ((page - 1) * pageSize) + 1 : 0;
        const hasta = totalDias > 0 ? Math.min((page - 1) * pageSize + (this.datos?.fechas?.length || 0), totalDias) : 0;
        const anterior = Math.max(1, page - 1);
        const siguiente = Math.min(totalPaginas || 1, page + 1);

        return `
            <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
                <span>Mostrando días ${desde}–${hasta} de ${totalDias}</span>
                <div class="flex items-center gap-1.5">
                    <button type="button" data-antenas-page="${anterior}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page <= 1 || totalPaginas === 0 ? 'disabled' : ''}>‹</button>
                    <span class="px-1 font-semibold text-slate-600">Página ${totalPaginas ? page : 0} de ${totalPaginas}</span>
                    <button type="button" data-antenas-page="${siguiente}"
                        class="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        ${page >= totalPaginas || totalPaginas === 0 ? 'disabled' : ''}>›</button>
                </div>
            </div>
        `;
    },

    renderView() {
        const contenedor = this.containerRef;
        if (!contenedor) return;

        this._ocultarTooltip();
        this._contextoActivo = false;
        this._foco = null;
        this._limpiarClasesContexto();
        this._limpiarClasesFoco();

        const fechas = Array.isArray(this.datos?.fechas) ? this.datos.fechas : [];
        const horas = Array.isArray(this.datos?.horas) ? this.datos.horas : Array.from({ length: 24 }, (_, i) => i);
        const filasBase = Array.isArray(this.datos?.filas) ? this.datos.filas : [];
        const filtros = this.controllerRef?.filtrosVista || {};
        const busqueda = String(filtros.busqueda || '').trim().toLowerCase();
        const filas = filasBase
            .map((fila, indiceOriginal) => ({ ...fila, _indiceOriginal: indiceOriginal }))
            .filter(fila => this._cumpleFiltros(fila, filtros, busqueda));
        const grupos = this._agruparAntenas(filas);
        const estados = this._estadosVisibles(filtros);
        const spansGranja = this._spans(grupos, grupo => grupo.granja);
        const resumen = this._resumenFilas(filas);
        const totalHoras = fechas.length * horas.length;
        const totalSubcolumnas = totalHoras * estados.length;
        const anchoTabla = 290 + (totalSubcolumnas * 16);
        const disponibilidad = resumen.disponibilidad.toLocaleString('es-PE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
        const filtrosActivos = Boolean(
            filtros.granja || filtros.antena || (filtros.estado && filtros.estado !== 'todos') || busqueda
        );
        const resumenBase = `${resumen.granjas} granjas · ${resumen.antenas} antenas · `;
        const resumenFallas = (filtros.estado !== 'fallas' && resumen.conFallas > 0)
            ? `<button type="button" data-antenas-solo-fallas title="Ver solo las columnas NO" class="font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer">${resumen.conFallas} con fallas</button>`
            : `${resumen.conFallas} con fallas`;
        const resumenResto = ` · ${disponibilidad}% horas conectadas${filtrosActivos ? ' · vista filtrada' : ''}`;
        const mensajeVacio = filasBase.length
            ? 'Sin datos con los filtros de vista seleccionados.'
            : 'Sin datos para el período seleccionado.';

        const fechaHeaders = fechas.map(fecha => `
            <th colspan="${horas.length * estados.length}" data-antenas-fecha-header="${this.escapeHtml(fecha)}" class="px-2 py-2 text-center font-bold text-[11px] text-white bg-blue-600 border-r border-blue-500 whitespace-nowrap">
                ${this.escapeHtml(this.formatFechaLarga(fecha))}
            </th>
        `).join('');

        const horaHeaders = fechas.map((_, indiceFecha) => horas.map((hora) => `
            <th colspan="${estados.length}" class="px-0 py-1.5 text-center font-mono text-[10px] font-semibold text-blue-100 border-r border-blue-500">${this.formatHora(hora)}</th>
        `).join('')).join('');

        const estadoHeaders = fechas.map((_, indiceFecha) => horas.map((__, indiceHora) => estados.map((estado, indiceEstado) => {
            const columna = ((indiceFecha * horas.length + indiceHora) * estados.length) + indiceEstado;
            const bordeHora = indiceEstado === estados.length - 1 ? 'border-r-2 border-blue-500' : 'border-r border-blue-500';
            return `<th data-antenas-col="${columna}" class="px-0 py-[2px] text-center font-mono text-[9px] font-bold leading-none text-blue-100 ${bordeHora}">${estado}</th>`;
        }).join('')).join('')).join('');

        const body = grupos.map((grupo, indice) => {
            const iniciaGranja = spansGranja[indice];

            const celdas = fechas.map((fecha, indiceFecha) => horas.map((hora, indiceHora) => estados.map((estado, indiceEstado) => {
                const columna = ((indiceFecha * horas.length + indiceHora) * estados.length) + indiceEstado;
                const finHora = indiceEstado === estados.length - 1;
                const claseBorde = finHora ? 'antena-fin-hora' : '';
                const filaEstado = grupo.porEstado[estado];
                const total = filaEstado?.valores?.[`${fecha}|${hora}`];
                if (total === undefined) {
                    return `<td data-antenas-col="${columna}" class="h-[28px] border-r border-b border-slate-100 p-0 ${claseBorde}"></td>`;
                }

                const color = estado === 'SI' ? '#59a14f' : '#e15759';
                return `
                    <td data-antenas-col="${columna}" class="h-[28px] border-r border-b border-slate-100 p-0 text-center ${claseBorde}">
                        <div class="mx-auto h-[18px] w-[14px] rounded-[2px] cursor-pointer"
                            style="background:${color};"
                            data-antenas-tt="1" data-antenas-index="${filaEstado._indiceOriginal}"
                            data-antenas-fecha="${this.escapeHtml(fecha)}" data-antenas-hora="${hora}"></div>
                    </td>
                `;
            }).join('')).join('')).join('');

            return `
                <tr class="hover:bg-blue-50/30${iniciaGranja ? ' border-t-2 border-t-slate-300' : ''}">
                    ${iniciaGranja
                        ? `<td rowspan="${iniciaGranja}" data-antenas-granja="${this.escapeHtml(grupo.granja)}" class="antena-sticky px-2 py-1 border-r border-b border-slate-200 text-[11px] font-semibold text-slate-700 align-middle" style="position:sticky;left:0;z-index:10;background:#fff;">${this.escapeHtml(grupo.granja)}</td>`
                        : ''}
                    <td data-antenas-granja="${this.escapeHtml(grupo.granja)}" data-antenas-antena="${this.escapeHtml(grupo.antena)}" class="antena-sticky antena-sticky-last px-2 py-1 border-r border-b border-slate-200 text-[11px] text-slate-600 align-middle" style="position:sticky;left:120px;z-index:10;background:#fff;">${this.escapeHtml(grupo.antena)}</td>
                    ${celdas}
                </tr>
            `;
        }).join('');

        contenedor.innerHTML = `
            <section class="bg-white rounded-xl shadow-sm border border-slate-200/80 flex flex-col h-full min-h-0 overflow-hidden">
                <div class="shrink-0 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div class="min-w-0">
                        <h2 class="text-[15px] font-bold text-slate-800">ConectividadAntenas</h2>
                        <p class="text-[10px] font-semibold text-slate-500 mt-0.5">${resumenBase}${resumenFallas}${resumenResto}</p>
                    </div>
                    <div class="flex items-center gap-4 text-[10px] font-semibold text-slate-600">
                        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-4 rounded-sm" style="background:#e15759;"></span>NO <span class="font-normal text-slate-500">(${resumen.celdasNo.toLocaleString('es-PE')})</span></span>
                        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-4 rounded-sm" style="background:#59a14f;"></span>SI <span class="font-normal text-slate-500">(${resumen.celdasSi.toLocaleString('es-PE')})</span></span>
                    </div>
                </div>
                <div data-antenas-contexto aria-live="polite"
                    class="shrink-0 min-h-[28px] flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 border-b border-slate-200 bg-slate-50/80 text-[10px] text-slate-500">
                    ${this._contextoPlaceholder()}
                </div>
                <div class="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table class="text-left border-collapse" style="table-layout:fixed;width:${anchoTabla}px;">
                        <colgroup>
                            <col style="width:120px;">
                            <col style="width:170px;">
                            ${fechas.map(() => horas.map(() => estados.map(() => '<col style="width:16px;">').join('')).join('')).join('')}
                        </colgroup>
                        <thead class="sticky top-0 z-30 bg-blue-600 text-white">
                            <tr>
                                <th rowspan="3" class="antena-sticky px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:0;z-index:40;background:#2563eb;">Granja</th>
                                <th rowspan="3" class="antena-sticky antena-sticky-last px-2 py-2 text-left text-[10px] font-bold border-r border-blue-500" style="position:sticky;left:120px;z-index:40;background:#2563eb;">Antena</th>
                                ${fechaHeaders}
                            </tr>
                            <tr>${horaHeaders}</tr>
                            <tr>${estadoHeaders}</tr>
                        </thead>
                        <tbody>${body || `<tr><td colspan="${2 + totalSubcolumnas}" class="p-8 text-center text-xs text-slate-400">${mensajeVacio}</td></tr>`}</tbody>
                    </table>
                </div>
                ${this._paginacion()}
            </section>
        `;
    }
};

window.ChartRegistry['ConectividadAntenas'] = window.ChartConectividadAntenas;
