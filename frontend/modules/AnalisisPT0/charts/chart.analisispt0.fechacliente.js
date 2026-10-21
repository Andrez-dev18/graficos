/**
 * DashAnalisisPT0 / FechaCliente
 * Movimientos por fecha y cliente para uno o varios almacenes (talm).
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0FechaCliente = {
    render(controller, data, targetContainer = null) {
        const H = window.AnalisisPT0Helper;
        const contenedor = document.getElementById(targetContainer || 'contenedor-fechacliente');
        if (!contenedor) return;

        const base = (data && data.base) || [];
        const talmSeleccionados = (data && data.talm) || [];
        const talmLista = talmSeleccionados.length > 0
            ? talmSeleccionados.slice()
            : Array.from(new Set(base.map(fila => fila.talm))).sort();

        if (!base.length || !talmLista.length) {
            contenedor.innerHTML = this.renderVacio();
            return;
        }

        const porTalm = {};
        const clientesPorFecha = new Map();
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

            let clientesFecha = grupoTalm.fechas.get(fila.fecha);
            if (!clientesFecha) {
                clientesFecha = new Map();
                grupoTalm.fechas.set(fila.fecha, clientesFecha);
            }

            let medidas = clientesFecha.get(fila.cliente);
            if (!medidas) {
                medidas = H.crearMedidas();
                clientesFecha.set(fila.cliente, medidas);
            }

            const destino = fila.tipo === 'Entrada' ? medidas.entrada : medidas.salida;
            destino.cant += H.numero(fila.cant);
            destino.pes += H.numero(fila.pes);
            destino.val += H.numero(fila.val);
            destino.n += 1;

            const destinoTotal = fila.tipo === 'Entrada' ? grupoTalm.total.entrada : grupoTalm.total.salida;
            destinoTotal.cant += H.numero(fila.cant);
            destinoTotal.pes += H.numero(fila.pes);
            destinoTotal.val += H.numero(fila.val);
            destinoTotal.n += 1;
        });

        Object.values(porTalm).forEach(grupo => {
            grupo.fechas.forEach(clientes => {
                clientes.forEach(medidas => H.recalcularTotal(medidas));
            });
            H.recalcularTotal(grupo.total);
        });

        const fechas = Array.from(fechasSet).sort();
        const filasHtml = [];
        let mesAnterior = null;

        fechas.forEach(fecha => {
            const anioMes = fecha.slice(0, 7);
            const mostrarMes = anioMes !== mesAnterior;
            const clientes = Array.from(clientesPorFecha.get(fecha) || []).sort();

            clientes.forEach((cliente, indiceCliente) => {
                const celdas = talmLista.map(talm => {
                    const medidas = porTalm[talm].fechas.get(fecha)?.get(cliente);
                    return this.celdasMedidas(H, medidas, false, talm);
                }).join('');

                const attrs = H.filaTooltip({ mes: H.fmtMes(anioMes), dia: H.fmtFecha(fecha), cliente });

                filasHtml.push(`
                    <tr ${attrs} class="hover:bg-blue-50/40 transition-colors border-b border-slate-200">
                        <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[130px]">${mostrarMes && indiceCliente === 0 ? H.escapeHtml(H.fmtMes(anioMes)) : ''}</td>
                        <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[100px]">${indiceCliente === 0 ? H.escapeHtml(H.fmtFecha(fecha)) : ''}</td>
                        <td class="px-3 py-1.5 text-[11px] font-medium text-slate-800 align-top border-r border-slate-200 min-w-[90px]">${H.escapeHtml(cliente)}</td>
                        ${celdas}
                    </tr>
                `);

                const celdasTotalCliente = talmLista.map(talm => {
                    const medidas = porTalm[talm].fechas.get(fecha)?.get(cliente);
                    return this.celdasMedidas(H, medidas, true, talm);
                }).join('');

                const attrsTotal = H.filaTooltip({ mes: H.fmtMes(anioMes), dia: H.fmtFecha(fecha), cliente });

                filasHtml.push(`
                    <tr ${attrsTotal} class="bg-slate-50/80 font-semibold text-slate-800 border-b border-slate-200">
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
                        <td class="px-3 py-1.5 text-[11px] font-bold text-slate-700 border-r border-slate-200">Total</td>
                        ${celdasTotalCliente}
                    </tr>
                `);
            });

            mesAnterior = anioMes;
        });

        const totalesTalm = talmLista.map(talm => this.celdasMedidas(H, porTalm[talm].total, true, talm)).join('');

        const headerTalm = talmLista.map(talm => `
            <th colspan="9" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700 whitespace-nowrap">
                ${H.escapeHtml(talm)}
            </th>
        `).join('');

        const headerTran = talmLista.map(() => `
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Entrada</th>
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Salida</th>
            <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60 border-b border-blue-700">Total</th>
        `).join('');

        const headerMedidas = talmLista.map(() => {
            return ['Cant', 'Pes', 'Val', 'Cant', 'Pes', 'Val', 'Cant', 'Pes', 'Val'].map((label, index) => {
                const borde = index === 0 || index === 3 || index === 6 ? ' border-l border-blue-500/60' : '';
                return `<th class="px-2 py-1.5 text-right font-bold text-[10px] text-white bg-blue-600 border-r border-blue-500/60 border-b border-blue-700 whitespace-nowrap min-w-[78px]${borde}">${label}</th>`;
            }).join('');
        }).join('');

        const anchoMinimo = 330 + (talmLista.length * 9 * 80);

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaCliente</h2>
                        <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por mes, día, cliente y almacén</p>
                    </div>
                    <span class="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                        ${fechas.length} días
                    </span>
                </div>

                <div class="overflow-auto max-h-[680px] custom-scrollbar">
                    <table class="tabla-analisispt0 w-full text-xs border-collapse" style="min-width: ${anchoMinimo}px;">
                        <thead class="sticky top-0 z-20">
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[130px]">Mes de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[100px]">Día de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[90px]">Cliente</th>
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
                                <td colspan="3" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300">Total</td>
                                ${totalesTalm}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
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

        const renderGrupo = (grupo, tipo) => {
            const tieneData = esTotal || grupo.n > 0;

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
                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaCliente</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por mes, día, cliente y almacén</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i class="fas fa-inbox text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs font-medium">Sin movimientos para el rango y almacén seleccionados.</p>
                </div>
            </div>
        `;
    }
};

window.ChartRegistry['AnalisisPT0FechaCliente'] = window.ChartAnalisisPT0FechaCliente;
