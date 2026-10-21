/**
 * DashAnalisisPT0 / FechaClienteTrans
 * Movimientos por fecha, cliente y transacción para uno o varios almacenes.
 * Renderiza los días por bloques para mantener ágil el DOM.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0FechaClienteTrans = {
    DIAS_POR_PAGINA: 5,
    _contexto: null,
    _diasVisibles: 0,
    _contenedorDestino: 'contenedor-fechaclientetrans',

    render(controller, data, targetContainer = null) {
        const H = window.AnalisisPT0Helper;
        const contenedor = document.getElementById(targetContainer || 'contenedor-fechaclientetrans');
        if (!contenedor) return;

        this._contenedorDestino = targetContainer || 'contenedor-fechaclientetrans';

        const base = (data && data.base) || [];
        const talmSeleccionados = (data && data.talm) || [];
        const talmLista = talmSeleccionados.length > 0
            ? talmSeleccionados.slice()
            : Array.from(new Set(base.map(fila => fila.talm))).sort();

        if (!base.length || !talmLista.length) {
            this._contexto = null;
            contenedor.innerHTML = this.renderVacio();
            return;
        }

        const porTalm = {};
        const clientesPorFecha = new Map();
        const transPorFechaCliente = new Map();
        const fechasSet = new Set();

        talmLista.forEach(talm => {
            porTalm[talm] = {
                fechas: new Map(),
                total: H.crearMedidas()
            };
        });

        base.forEach(fila => {
            const grupoTalm = porTalm[fila.talm];
            if (!grupoTalm) return;

            fechasSet.add(fila.fecha);

            if (!clientesPorFecha.has(fila.fecha)) {
                clientesPorFecha.set(fila.fecha, new Set());
            }
            clientesPorFecha.get(fila.fecha).add(fila.cliente);

            const claveCliente = `${fila.fecha}\u0001${fila.cliente}`;
            if (!transPorFechaCliente.has(claveCliente)) {
                transPorFechaCliente.set(claveCliente, new Set());
            }
            transPorFechaCliente.get(claveCliente).add(fila.tran);

            let grupoFecha = grupoTalm.fechas.get(fila.fecha);
            if (!grupoFecha) {
                grupoFecha = {
                    clientes: new Map(),
                    total: H.crearMedidas()
                };
                grupoTalm.fechas.set(fila.fecha, grupoFecha);
            }

            let grupoCliente = grupoFecha.clientes.get(fila.cliente);
            if (!grupoCliente) {
                grupoCliente = {
                    trans: new Map(),
                    total: H.crearMedidas()
                };
                grupoFecha.clientes.set(fila.cliente, grupoCliente);
            }

            let medidasTrans = grupoCliente.trans.get(fila.tran);
            if (!medidasTrans) {
                medidasTrans = H.crearMedidas();
                grupoCliente.trans.set(fila.tran, medidasTrans);
            }

            const destinos = [
                fila.tipo === 'Entrada' ? medidasTrans.entrada : medidasTrans.salida,
                fila.tipo === 'Entrada' ? grupoCliente.total.entrada : grupoCliente.total.salida,
                fila.tipo === 'Entrada' ? grupoFecha.total.entrada : grupoFecha.total.salida,
                fila.tipo === 'Entrada' ? grupoTalm.total.entrada : grupoTalm.total.salida
            ];

            destinos.forEach(destino => {
                destino.cant += H.numero(fila.cant);
                destino.pes += H.numero(fila.pes);
                destino.val += H.numero(fila.val);
                destino.n += 1;
            });
        });

        Object.values(porTalm).forEach(grupo => {
            grupo.fechas.forEach(grupoFecha => {
                grupoFecha.clientes.forEach(grupoCliente => {
                    grupoCliente.trans.forEach(medidas => H.recalcularTotal(medidas));
                    H.recalcularTotal(grupoCliente.total);
                });
                H.recalcularTotal(grupoFecha.total);
            });
            H.recalcularTotal(grupo.total);
        });

        this._contexto = {
            talmLista,
            porTalm,
            clientesPorFecha,
            transPorFechaCliente,
            fechas: Array.from(fechasSet).sort()
        };

        this._diasVisibles = Math.min(this.DIAS_POR_PAGINA, this._contexto.fechas.length);
        this.pintar();
    },

    pintar() {
        const H = window.AnalisisPT0Helper;
        const ctx = this._contexto;
        const contenedor = document.getElementById(this._contenedorDestino);
        if (!ctx || !contenedor) return;

        const scrollPrevio = contenedor.querySelector('#scroll-fechaclientetrans')?.scrollTop || 0;
        const fechas = ctx.fechas.slice(0, this._diasVisibles);
        const filasHtml = [];
        let mesAnterior = null;

        fechas.forEach(fecha => {
            const anioMes = fecha.slice(0, 7);
            const mostrarMes = anioMes !== mesAnterior;
            const clientes = Array.from(ctx.clientesPorFecha.get(fecha) || []).sort();

            clientes.forEach((cliente, indiceCliente) => {
                const claveCliente = `${fecha}\u0001${cliente}`;
                const transacciones = Array.from(ctx.transPorFechaCliente.get(claveCliente) || []).sort();

                transacciones.forEach((tran, indiceTran) => {
                    const celdas = ctx.talmLista.map(talm => {
                        const medidas = ctx.porTalm[talm].fechas.get(fecha)
                            ?.clientes.get(cliente)
                            ?.trans.get(tran);
                        return this.celdasMedidas(H, medidas, false, talm);
                    }).join('');

                    const attrs = H.filaTooltip({ mes: H.fmtMes(anioMes), dia: H.fmtFecha(fecha), cliente, tran });

                    filasHtml.push(`
                        <tr ${attrs} class="hover:bg-blue-50/40 border-b border-slate-200">
                            <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[130px]">${mostrarMes && indiceCliente === 0 && indiceTran === 0 ? H.escapeHtml(H.fmtMes(anioMes)) : ''}</td>
                            <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[100px]">${indiceCliente === 0 && indiceTran === 0 ? H.escapeHtml(H.fmtFecha(fecha)) : ''}</td>
                            <td class="px-3 py-1.5 text-[11px] font-medium text-slate-800 align-top border-r border-slate-200 min-w-[90px]">${indiceTran === 0 ? H.escapeHtml(cliente) : ''}</td>
                            <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[80px]">${H.escapeHtml(tran)}</td>
                            ${celdas}
                        </tr>
                    `);
                });

                const celdasCliente = ctx.talmLista.map(talm => {
                    const medidas = ctx.porTalm[talm].fechas.get(fecha)?.clientes.get(cliente)?.total;
                    return this.celdasMedidas(H, medidas, true, talm);
                }).join('');

                const attrsCliente = H.filaTooltip({ mes: H.fmtMes(anioMes), dia: H.fmtFecha(fecha), cliente });

                filasHtml.push(`
                    <tr ${attrsCliente} class="bg-slate-50/80 font-semibold text-slate-800 border-b border-slate-200">
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
                        <td class="px-3 py-1.5 text-[11px] font-bold text-slate-700 border-r border-slate-200">Total</td>
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
                        ${celdasCliente}
                    </tr>
                `);
            });

            const celdasDia = ctx.talmLista.map(talm => {
                const medidas = ctx.porTalm[talm].fechas.get(fecha)?.total;
                return this.celdasMedidas(H, medidas, true);
            }).join('');

            const attrsDia = H.filaTooltip({ mes: H.fmtMes(anioMes), dia: H.fmtFecha(fecha) });

            filasHtml.push(`
                <tr ${attrsDia} class="bg-slate-100/90 font-bold text-slate-900 border-b-2 border-slate-300">
                    <td class="px-3 py-1.5 border-r border-slate-200"></td>
                    <td class="px-3 py-1.5 text-[11px] font-bold text-slate-800 border-r border-slate-200">Total</td>
                    <td class="px-3 py-1.5 border-r border-slate-200"></td>
                    <td class="px-3 py-1.5 border-r border-slate-200"></td>
                    ${celdasDia}
                </tr>
            `);

            mesAnterior = anioMes;
        });

        const totalesTalm = ctx.talmLista.map(talm => this.celdasMedidas(H, ctx.porTalm[talm].total, true, talm)).join('');
        const headerTalm = ctx.talmLista.map(talm => `
            <th colspan="9" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700 whitespace-nowrap">
                ${H.escapeHtml(talm)}
            </th>
        `).join('');

        const headerTran = ctx.talmLista.map(() => `
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Entrada</th>
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Salida</th>
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Total</th>
        `).join('');

        const headerMedidas = ctx.talmLista.map(() => {
            return ['Cant', 'Pes', 'Val', 'Cant', 'Pes', 'Val', 'Cant', 'Pes', 'Val'].map((label, index) => {
                const borde = index === 0 || index === 3 || index === 6 ? ' border-l border-blue-500/60' : '';
                return `<th class="px-2 py-1.5 text-right font-bold text-[10px] text-white bg-blue-600 border-r border-blue-500/60 border-b border-blue-700 whitespace-nowrap min-w-[78px]${borde}">${label}</th>`;
            }).join('');
        }).join('');

        const anchoMinimo = 410 + (ctx.talmLista.length * 9 * 80);
        const totalDias = ctx.fechas.length;
        const diasMostrados = fechas.length;
        const hayMas = diasMostrados < totalDias;

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaClienteTrans</h2>
                        <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por fecha, cliente, transacción y almacén</p>
                    </div>
                    <span class="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                        ${totalDias} días
                    </span>
                </div>

                <div id="scroll-fechaclientetrans" class="overflow-auto max-h-[680px] custom-scrollbar">
                    <table class="tabla-analisispt0 w-full text-xs border-collapse" style="min-width: ${anchoMinimo}px;">
                        <thead class="sticky top-0 z-20">
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[130px]">Mes de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[100px]">Día de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[90px]">Cliente</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[80px]">tcodtra</th>
                                ${headerTalm}
                            </tr>
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                ${headerTran}
                            </tr>
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                ${headerMedidas}
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHtml.join('')}
                        </tbody>
                        <tfoot class="sticky bottom-0 z-20 bg-slate-200 border-t-2 border-slate-400 font-bold text-[11px] text-slate-900 shadow-md">
                            <tr>
                                <td colspan="4" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300">Total</td>
                                ${totalesTalm}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-[11px] text-slate-500">
                        Mostrando ${diasMostrados} de ${totalDias} días
                    </span>
                    ${hayMas
                        ? `<button id="btn-cargar-mas-fct" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer">
                                <i class="fas fa-plus text-[10px]"></i>
                                Cargar ${Math.min(this.DIAS_POR_PAGINA, totalDias - diasMostrados)} días más
                           </button>`
                        : '<span class="text-[11px] font-semibold text-emerald-700">Todos los días cargados</span>'}
                </div>
            </div>
        `;

        const scroll = contenedor.querySelector('#scroll-fechaclientetrans');
        if (scroll && scrollPrevio) {
            scroll.scrollTop = scrollPrevio;
        }

        const btnMas = contenedor.querySelector('#btn-cargar-mas-fct');
        if (btnMas) {
            btnMas.addEventListener('click', () => {
                this._diasVisibles = Math.min(this._diasVisibles + this.DIAS_POR_PAGINA, totalDias);
                this.pintar();
            });
        }
    },

    celdasMedidas(H, medidas, esTotal, talm = '') {
        const vacio = {
            cant: 0,
            pes: 0,
            val: 0,
            n: 0
        };

        const m = medidas || {
            entrada: vacio,
            salida: vacio,
            total: vacio
        };

        const tieneDatos = m.entrada.n > 0 || m.salida.n > 0;

        const renderGrupo = (grupo, tipo) => {
            const tieneData = esTotal ? tieneDatos : grupo.n > 0;

            return ['cant', 'pes', 'val'].map(medida => {
                const valor = tieneData
                    ? (medida === 'cant' ? H.fmtCant(grupo[medida]) : medida === 'pes' ? H.fmtPes(grupo[medida]) : H.fmtVal(grupo[medida]))
                    : '';
                const clase = valor ? ' celda-tooltip' : '';
                const meta = valor ? H.metaTooltip(talm, tipo, medida === 'cant' ? 'Cant' : medida === 'pes' ? 'Pes' : 'Val') : '';

                return `<td ${meta} class="px-2 py-1.5 text-right font-mono text-[11px] text-slate-700 border-r border-slate-200 whitespace-nowrap${clase}">${valor}</td>`;
            }).join('');
        };

        return [
            renderGrupo(m.entrada, 'Entrada'),
            renderGrupo(m.salida, 'Salida'),
            renderGrupo(m.total, 'Total')
        ].join('');
    },

    renderVacio() {
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[220px]">
                <div class="px-4 py-3 border-b border-slate-200 bg-white">
                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaClienteTrans</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por fecha, cliente, transacción y almacén</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i class="fas fa-inbox text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs font-medium">Sin movimientos para el rango y almacén seleccionados.</p>
                </div>
            </div>
        `;
    }
};

window.ChartRegistry['AnalisisPT0FechaClienteTrans'] = window.ChartAnalisisPT0FechaClienteTrans;
