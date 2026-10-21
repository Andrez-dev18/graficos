/**
 * DashAnalisisPT0 / FechaClienteTransCod
 * Movimientos por fecha, cliente, documento, transacción e ítem.
 * Renderiza los días por bloques para mantener ágil el DOM.
 */
window.ChartRegistry = window.ChartRegistry || {};

window.ChartAnalisisPT0FechaClienteTransCod = {
    DIAS_POR_PAGINA: 5,
    _contexto: null,
    _diasVisibles: 0,
    _contenedorDestino: 'contenedor-fechaclientetranscod',

    render(controller, data, targetContainer = null) {
        const H = window.AnalisisPT0Helper;
        const contenedor = document.getElementById(targetContainer || 'contenedor-fechaclientetranscod');
        if (!contenedor) return;

        this._contenedorDestino = targetContainer || 'contenedor-fechaclientetranscod';

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
        const fechasSet = new Set();
        const clientesPorFecha = new Map();
        const docsPorFechaCliente = new Map();
        const transPorFechaClienteDoc = new Map();
        const itemsPorFechaClienteDocTran = new Map();

        const registrar = (mapa, clave, valor) => {
            if (!mapa.has(clave)) mapa.set(clave, new Set());
            mapa.get(clave).add(valor);
        };

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

            const claveCliente = `${fila.fecha}\u0001${fila.cliente}`;
            const claveDoc = `${claveCliente}\u0001${fila.tnumfac}`;
            const claveTran = `${claveDoc}\u0001${fila.tran}`;

            registrar(clientesPorFecha, fila.fecha, fila.cliente);
            registrar(docsPorFechaCliente, claveCliente, fila.tnumfac);
            registrar(transPorFechaClienteDoc, claveDoc, fila.tran);
            registrar(itemsPorFechaClienteDocTran, claveTran, fila.codigo_item);

            let grupoFecha = grupoTalm.fechas.get(fila.fecha);
            if (!grupoFecha) {
                grupoFecha = { clientes: new Map(), total: H.crearMedidas() };
                grupoTalm.fechas.set(fila.fecha, grupoFecha);
            }

            let grupoCliente = grupoFecha.clientes.get(fila.cliente);
            if (!grupoCliente) {
                grupoCliente = { docs: new Map(), total: H.crearMedidas() };
                grupoFecha.clientes.set(fila.cliente, grupoCliente);
            }

            let grupoDoc = grupoCliente.docs.get(fila.tnumfac);
            if (!grupoDoc) {
                grupoDoc = { trans: new Map(), total: H.crearMedidas() };
                grupoCliente.docs.set(fila.tnumfac, grupoDoc);
            }

            let grupoTran = grupoDoc.trans.get(fila.tran);
            if (!grupoTran) {
                grupoTran = { items: new Map(), total: H.crearMedidas() };
                grupoDoc.trans.set(fila.tran, grupoTran);
            }

            let medidasItem = grupoTran.items.get(fila.codigo_item);
            if (!medidasItem) {
                medidasItem = H.crearMedidas();
                grupoTran.items.set(fila.codigo_item, medidasItem);
            }

            const destinos = [
                fila.tipo === 'Entrada' ? medidasItem.entrada : medidasItem.salida,
                fila.tipo === 'Entrada' ? grupoTran.total.entrada : grupoTran.total.salida,
                fila.tipo === 'Entrada' ? grupoDoc.total.entrada : grupoDoc.total.salida,
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
                    grupoCliente.docs.forEach(grupoDoc => {
                        grupoDoc.trans.forEach(grupoTran => {
                            grupoTran.items.forEach(medidas => H.recalcularTotal(medidas));
                            H.recalcularTotal(grupoTran.total);
                        });
                        H.recalcularTotal(grupoDoc.total);
                    });
                    H.recalcularTotal(grupoCliente.total);
                });
                H.recalcularTotal(grupoFecha.total);
            });
            H.recalcularTotal(grupo.total);
        });

        this._contexto = {
            talmLista,
            porTalm,
            fechas: Array.from(fechasSet).sort(),
            clientesPorFecha,
            docsPorFechaCliente,
            transPorFechaClienteDoc,
            itemsPorFechaClienteDocTran
        };

        this._paginar = !(data && data.paginar === false);
        this._diasVisibles = this._paginar
            ? Math.min(this.DIAS_POR_PAGINA, this._contexto.fechas.length)
            : this._contexto.fechas.length;
        this.pintar();
    },

    pintar() {
        const H = window.AnalisisPT0Helper;
        const ctx = this._contexto;
        const contenedor = document.getElementById(this._contenedorDestino);
        if (!ctx || !contenedor) return;

        const scrollPrevio = contenedor.querySelector('#scroll-fechaclientetranscod')?.scrollTop || 0;
        const fechas = ctx.fechas.slice(0, this._diasVisibles);
        const filasHtml = [];
        const claves = ['anio_mes', 'fecha', 'cliente', 'tnumfac', 'tran', 'codigo_item'];
        let previos = null;

        const debeMostrar = (valores, indice) => {
            if (!previos) return true;

            for (let i = 0; i <= indice; i += 1) {
                if (String(valores[claves[i]]) !== String(previos[claves[i]])) {
                    return true;
                }
            }

            return false;
        };

        fechas.forEach(fecha => {
            const anioMes = fecha.slice(0, 7);
            const grupoFecha = this.obtenerGrupoFecha(ctx, fecha);

            const clientes = Array.from(grupoFecha.clientes.keys()).sort();

            clientes.forEach(cliente => {
                const grupoCliente = grupoFecha.clientes.get(cliente);
                const docs = Array.from(grupoCliente.docs.keys()).sort((a, b) => String(a).localeCompare(String(b), 'es', { numeric: true }));

                docs.forEach(tnumfac => {
                    const grupoDoc = grupoCliente.docs.get(tnumfac);
                    const transacciones = Array.from(grupoDoc.trans.keys()).sort();

                    transacciones.forEach(tran => {
                        const grupoTran = grupoDoc.trans.get(tran);
                        const items = Array.from(grupoTran.items.keys()).sort();

                        items.forEach(codigoItem => {
                            const valores = {
                                anio_mes: anioMes,
                                fecha,
                                cliente,
                                tnumfac,
                                tran,
                                codigo_item: codigoItem
                            };

                            const celdas = ctx.talmLista.map(talm => {
                                const medidas = ctx.porTalm[talm].fechas.get(fecha)
                                    ?.clientes.get(cliente)
                                    ?.docs.get(tnumfac)
                                    ?.trans.get(tran)
                                    ?.items.get(codigoItem);
                                return this.celdasMedidas(H, medidas, false, talm);
                            }).join('');

                            const mostrar = claves.map((clave, indice) => {
                                if (!debeMostrar(valores, indice)) return '';
                                let texto = valores[clave];
                                if (clave === 'anio_mes') texto = H.fmtMes(texto);
                                if (clave === 'fecha') texto = H.fmtFecha(texto);
                                return H.escapeHtml(texto);
                            });

                            const attrs = H.filaTooltip({
                                mes: H.fmtMes(anioMes),
                                dia: H.fmtFecha(fecha),
                                cliente,
                                tnumfac,
                                tran,
                                codigo: codigoItem
                            });

                            filasHtml.push(`
                                <tr ${attrs} class="hover:bg-blue-50/40 border-b border-slate-200">
                                    <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[130px]">${mostrar[0]}</td>
                                    <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[100px]">${mostrar[1]}</td>
                                    <td class="px-3 py-1.5 text-[11px] font-medium text-slate-800 align-top border-r border-slate-200 min-w-[90px]">${mostrar[2]}</td>
                                    <td class="px-3 py-1.5 text-[11px] font-mono text-slate-700 align-top border-r border-slate-200 min-w-[110px]">${mostrar[3]}</td>
                                    <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[80px]">${mostrar[4]}</td>
                                    <td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 min-w-[90px]">${mostrar[5]}</td>
                                    ${celdas}
                                </tr>
                            `);

                            previos = valores;
                        });
                    });
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
                        <td class="px-3 py-1.5 border-r border-slate-200"></td>
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
                    <td class="px-3 py-1.5 border-r border-slate-200"></td>
                    <td class="px-3 py-1.5 border-r border-slate-200"></td>
                    ${celdasDia}
                </tr>
            `);
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

        const anchoMinimo = 650 + (ctx.talmLista.length * 9 * 80);
        const totalDias = ctx.fechas.length;
        const diasMostrados = fechas.length;
        const hayMas = this._paginar && diasMostrados < totalDias;

        contenedor.innerHTML = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaClienteTransCod</h2>
                        <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por fecha, cliente, documento, transacción e ítem</p>
                    </div>
                    <span class="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                        ${totalDias} días
                    </span>
                </div>

                <div id="scroll-fechaclientetranscod" class="overflow-auto max-h-[680px] custom-scrollbar">
                    <table class="tabla-analisispt0 w-full text-xs border-collapse" style="min-width: ${anchoMinimo}px;">
                        <thead class="sticky top-0 z-20">
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[130px]">Mes de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[100px]">Día de efecto</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[90px]">Cliente</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[110px]">tnumfac</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[80px]">tcodtra</th>
                                <th rowspan="3" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[90px]">Código ítem</th>
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
                                <td colspan="6" class="px-3 py-2 text-left uppercase tracking-wider font-extrabold border-r border-slate-300">Total</td>
                                ${totalesTalm}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-[11px] text-slate-500">
                        ${this._paginar ? `Mostrando ${diasMostrados} de ${totalDias} días` : `${diasMostrados} días cargados`}
                    </span>
                    ${hayMas
                        ? `<button id="btn-cargar-mas-fctcod" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer">
                                <i class="fas fa-plus text-[10px]"></i>
                                Cargar ${Math.min(this.DIAS_POR_PAGINA, totalDias - diasMostrados)} días más
                           </button>`
                        : ''}
                </div>
            </div>
        `;

        const scroll = contenedor.querySelector('#scroll-fechaclientetranscod');
        if (scroll && scrollPrevio) {
            scroll.scrollTop = scrollPrevio;
        }

        const btnMas = contenedor.querySelector('#btn-cargar-mas-fctcod');
        if (btnMas) {
            btnMas.addEventListener('click', () => {
                this._diasVisibles = Math.min(this._diasVisibles + this.DIAS_POR_PAGINA, totalDias);
                this.pintar();
            });
        }
    },

    obtenerGrupoFecha(ctx, fecha) {
        const vacio = { clientes: new Map(), total: window.AnalisisPT0Helper.crearMedidas() };

        for (const talm of ctx.talmLista) {
            const grupo = ctx.porTalm[talm]?.fechas.get(fecha);
            if (grupo) return grupo;
        }

        return vacio;
    },

    celdasMedidas(H, medidas, esTotal, talm = '') {
        const vacio = { cant: 0, pes: 0, val: 0, n: 0 };
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
                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">FechaClienteTransCod</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">Entrada y salida por fecha, cliente, documento, transacción e ítem</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i class="fas fa-inbox text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs font-medium">Sin movimientos para el rango y almacén seleccionados.</p>
                </div>
            </div>
        `;
    }
};

window.ChartRegistry['AnalisisPT0FechaClienteTransCod'] = window.ChartAnalisisPT0FechaClienteTransCod;
