/**
 * Helper común para las tablas de DashAnalisisPT0.
 * Agrupa la data base, calcula subtotales y renderiza el crosstab.
 */
window.AnalisisPT0Helper = {
    mesFormatter: new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }),

    escapeHtml(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    numero(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    },

    formatearNumero(valor, decimales = 0) {
        const n = this.numero(valor);
        const [entero, decimal] = Math.abs(n).toFixed(decimales).split('.');
        const enteroConMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        if (decimales > 0) {
            return `${enteroConMiles},${decimal}`;
        }

        return enteroConMiles;
    },

    fmtCant(valor) {
        const n = this.numero(valor);
        if (Math.abs(n) < 0.5) return '0';
        const texto = this.formatearNumero(Math.abs(n), 0);
        return n < 0 ? `-${texto}` : texto;
    },

    fmtPes(valor) {
        const n = this.numero(valor);
        if (Math.abs(n) < 0.005) return '0,00';
        const texto = this.formatearNumero(Math.abs(n), 2);
        return n < 0 ? `-${texto}` : texto;
    },

    fmtVal(valor) {
        const n = this.numero(valor);
        if (Math.abs(n) < 0.005) return 'S/0,00';
        const texto = this.formatearNumero(Math.abs(n), 2);
        return n < 0 ? `S/-${texto}` : `S/${texto}`;
    },

    fmtFecha(fecha) {
        if (!fecha) return '';
        return String(fecha).slice(0, 10).replace(/-/g, '/');
    },

    fmtMes(anioMes) {
        if (!anioMes || !/^\d{4}-\d{2}$/.test(String(anioMes))) return anioMes || '';
        const [anio, mes] = String(anioMes).split('-').map(Number);
        return this.mesFormatter.format(new Date(anio, mes - 1, 1));
    },

    crearMedidas() {
        return {
            entrada: { cant: 0, pes: 0, val: 0, n: 0 },
            salida: { cant: 0, pes: 0, val: 0, n: 0 },
            total: { cant: 0, pes: 0, val: 0, n: 0 }
        };
    },

    recalcularTotal(medidas) {
        medidas.total.cant = medidas.entrada.cant + medidas.salida.cant;
        medidas.total.pes = medidas.entrada.pes + medidas.salida.pes;
        medidas.total.val = medidas.entrada.val + medidas.salida.val;
        medidas.total.n = medidas.entrada.n + medidas.salida.n;
        return medidas;
    },

    agrupar(base, dimensiones) {
        const mapa = new Map();

        (base || []).forEach(fila => {
            const valores = {};
            dimensiones.forEach(dim => {
                valores[dim.key] = fila[dim.key] ?? '';
            });

            const clave = dimensiones.map(dim => String(valores[dim.key])).join('\u0001');
            let grupo = mapa.get(clave);

            if (!grupo) {
                grupo = {
                    values: valores,
                    medidas: this.crearMedidas()
                };
                mapa.set(clave, grupo);
            }

            const destino = fila.tipo === 'Entrada' ? grupo.medidas.entrada : grupo.medidas.salida;
            destino.cant += this.numero(fila.cant);
            destino.pes += this.numero(fila.pes);
            destino.val += this.numero(fila.val);
            destino.n += 1;
        });

        const filas = Array.from(mapa.values());
        filas.forEach(fila => this.recalcularTotal(fila.medidas));

        filas.sort((a, b) => {
            for (const dim of dimensiones) {
                const va = a.values[dim.key];
                const vb = b.values[dim.key];
                const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true });
                if (cmp !== 0) return cmp;
            }
            return 0;
        });

        return filas;
    },

    sumarMedidas(filas) {
        const total = this.crearMedidas();

        filas.forEach(fila => {
            total.entrada.cant += fila.medidas.entrada.cant;
            total.entrada.pes += fila.medidas.entrada.pes;
            total.entrada.val += fila.medidas.entrada.val;
            total.entrada.n += fila.medidas.entrada.n;

            total.salida.cant += fila.medidas.salida.cant;
            total.salida.pes += fila.medidas.salida.pes;
            total.salida.val += fila.medidas.salida.val;
            total.salida.n += fila.medidas.salida.n;
        });

        return this.recalcularTotal(total);
    },

    construirFilas(filas, dimensiones, nivelesSubtotal) {
        const salida = [];

        const recorrer = (lista, indice, ruta) => {
            if (indice >= dimensiones.length || !lista.length) return;

            const dim = dimensiones[indice];
            let pos = 0;

            while (pos < lista.length) {
                const valor = lista[pos].values[dim.key];
                const grupo = [];

                while (pos < lista.length && String(lista[pos].values[dim.key]) === String(valor)) {
                    grupo.push(lista[pos]);
                    pos += 1;
                }

                const nuevaRuta = { ...ruta, [dim.key]: valor };

                if (indice === dimensiones.length - 1) {
                    grupo.forEach(fila => {
                        salida.push({
                            type: 'data',
                            values: { ...fila.values },
                            medidas: fila.medidas
                        });
                    });
                } else {
                    recorrer(grupo, indice + 1, nuevaRuta);
                }

                if (nivelesSubtotal.includes(dim.key)) {
                    salida.push({
                        type: 'subtotal',
                        level: dim.key,
                        values: nuevaRuta,
                        medidas: this.sumarMedidas(grupo)
                    });
                }
            }
        };

        recorrer(filas, 0, {});
        return salida;
    },

    etiquetaSubtotal(dimensiones, level) {
        const dim = dimensiones.find(d => d.key === level);
        return dim ? `Total ${dim.label.toLowerCase()}` : 'Total';
    },

    celdaMedida(valor, tipo, conData, extraClass = '') {
        const texto = conData
            ? (tipo === 'cant' ? this.fmtCant(valor) : tipo === 'pes' ? this.fmtPes(valor) : this.fmtVal(valor))
            : '';

        return texto;
    },

    renderTabla(config) {
        const contenedor = typeof config.container === 'string'
            ? document.getElementById(config.container)
            : config.container;

        if (!contenedor) return;

        const dimensiones = config.dimensiones || [];
        const filasBase = config.rows || [];
        const filas = this.construirFilas(filasBase, dimensiones, config.subtotalLevels || []);
        const controller = config.controller;
        const seleccion = config.seleccion || null;
        const sourceKey = config.sourceKey || null;

        if (!filasBase.length) {
            contenedor.innerHTML = this.renderVacio(config);
            return;
        }

        const headersDimensiones = dimensiones.map(dim => `
            <th rowspan="2" class="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap ${dim.className || ''}">
                ${this.escapeHtml(dim.label)}
            </th>
        `).join('');

        const headerMedidas = ['Cant', 'Pes', 'Val'].map(label => `
            <th class="px-2 py-1.5 text-right font-bold text-[10px] text-white bg-blue-600 border-r border-blue-500/60 whitespace-nowrap min-w-[78px]">${label}</th>
        `).join('');

        const body = [];
        let previos = null;

        filas.forEach((fila, index) => {
            if (fila.type === 'subtotal') {
                const titulo = this.etiquetaSubtotal(dimensiones, fila.level);
                const m = fila.medidas;
                const attrsSubtotal = this.filaTooltip({
                    mes: fila.values.anio_mes ? this.fmtMes(fila.values.anio_mes) : '',
                    dia: fila.values.fecha ? this.fmtFecha(fila.values.fecha) : '',
                    cliente: fila.values.cliente || '',
                    tran: fila.values.tran || '',
                    codigo: fila.values.codigo_item || '',
                    descri: fila.values.nom_item || ''
                });
                body.push(`
                    <tr ${attrsSubtotal} class="bg-slate-100/80 font-semibold text-slate-800 subtotal-row">
                        <td colspan="${dimensiones.length}" class="px-3 py-1.5 text-left text-[11px] font-bold text-slate-700 border-r border-slate-200" title="${this.escapeHtml(titulo)}">
                            Total
                        </td>
                        ${this.celdasMedidas(m, true, true, '')}
                    </tr>
                `);
                return;
            }

            const values = fila.values;
            const celdasDimension = dimensiones.map((dim, dimIndex) => {
                let mostrar = true;

                if (previos) {
                    for (let i = 0; i <= dimIndex; i += 1) {
                        if (String(values[dimensiones[i].key]) !== String(previos[dimensiones[i].key])) {
                            mostrar = true;
                            break;
                        }
                        mostrar = false;
                    }
                }

                const valor = values[dim.key];
                const texto = mostrar ? this.valorDimension(dim, valor) : '';

                return `<td class="px-3 py-1.5 text-[11px] text-slate-700 align-top border-r border-slate-200 ${dim.cellClassName || ''}">${texto}</td>`;
            }).join('');

            const attrsFila = this.filaTooltip({
                mes: values.anio_mes ? this.fmtMes(values.anio_mes) : '',
                dia: values.fecha ? this.fmtFecha(values.fecha) : '',
                cliente: values.cliente || '',
                tran: values.tran || '',
                codigo: values.codigo_item || '',
                descri: values.nom_item || ''
            });

            body.push(`
                <tr data-fila="${index}" ${attrsFila} class="hover:bg-blue-50/40 transition-colors border-b border-slate-200">
                    ${celdasDimension}
                    ${this.celdasMedidas(fila.medidas, true, false, '')}
                </tr>
            `);

            previos = values;
        });

        const tablaHtml = `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">${this.escapeHtml(config.title)}</h2>
                        <p class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(config.subtitle || '')}</p>
                    </div>
                    <span class="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md whitespace-nowrap">
                        ${filasBase.length} filas
                    </span>
                </div>

                <div class="overflow-auto max-h-[560px] custom-scrollbar">
                    <table class="tabla-analisispt0 text-xs border-collapse ${config.tableClass || 'min-w-full'}">
                        <thead class="sticky top-0 z-20">
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                ${headersDimensiones}
                                <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60">Entrada</th>
                                <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60">Salida</th>
                                <th colspan="3" class="px-2 py-1.5 text-center font-bold text-[10px] uppercase tracking-wider text-white bg-blue-600 border-l border-blue-500/60">Total general</th>
                            </tr>
                            <tr class="bg-blue-600 border-b border-blue-700 text-white">
                                ${headerMedidas}
                                ${headerMedidas}
                                ${headerMedidas}
                            </tr>
                        </thead>
                        <tbody>
                            ${body.join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        contenedor.innerHTML = tablaHtml;

        if (!sourceKey || !controller) return;

        contenedor.querySelectorAll('tr[data-fila]').forEach(tr => {
            const index = Number(tr.getAttribute('data-fila'));
            const fila = filas[index];
            if (!fila || fila.type !== 'data') return;

            const coincide = this.coincideSeleccion(fila.values, seleccion, sourceKey);

            if (coincide && seleccion) {
                tr.classList.add('bg-blue-50', 'ring-1', 'ring-inset', 'ring-blue-200');
            }

            tr.style.cursor = 'pointer';
            tr.addEventListener('click', (event) => {
                if (event.target.closest('.celda-medida')) return;
                controller.seleccionar(sourceKey, fila.values, null);
            });

            tr.querySelectorAll('.celda-medida').forEach(celda => {
                const tipo = celda.getAttribute('data-tipo');
                if (coincide && seleccion && seleccion.tipo === tipo) {
                    celda.classList.add('bg-blue-100', 'text-blue-900');
                }

                celda.addEventListener('click', (event) => {
                    event.stopPropagation();
                    controller.seleccionar(sourceKey, fila.values, tipo);
                });
            });
        });
    },

    filaTooltip(datos) {
        const attrs = [];
        const mapa = {
            mes: 'tt-mes',
            dia: 'tt-dia',
            cliente: 'tt-cliente',
            tnumfac: 'tt-tnumfac',
            tran: 'tt-tran',
            codigo: 'tt-codigo',
            descri: 'tt-descri'
        };

        Object.entries(mapa).forEach(([clave, atributo]) => {
            if (datos[clave]) attrs.push(`data-${atributo}="${this.escapeHtml(datos[clave])}"`);
        });

        return attrs.join(' ');
    },

    metaTooltip(talm, tipo, medida) {
        return `data-tt="${this.escapeHtml([talm || '', tipo || '', medida || ''].join('|'))}"`;
    },

    celdasMedidas(medidas, conData, esSubtotal, talm = '') {
        const renderGrupo = (grupo, tipo) => {
            const dataKey = grupo === medidas.entrada ? 'entrada' : grupo === medidas.salida ? 'salida' : 'total';
            const tipoFiltro = dataKey === 'entrada' ? 'Entrada' : dataKey === 'salida' ? 'Salida' : null;
            const tipoTooltip = tipoFiltro || 'Total';
            const tieneData = conData && grupo.n > 0;
            const attrs = (!esSubtotal && tipoFiltro) ? `data-tipo="${tipoFiltro}"` : '';

            return ['cant', 'pes', 'val'].map(medida => {
                const texto = this.celdaMedida(grupo[medida], medida, tieneData);
                const claseTooltip = texto ? ' celda-tooltip' : '';
                const meta = texto ? this.metaTooltip(talm, tipoTooltip, medida === 'cant' ? 'Cant' : medida === 'pes' ? 'Pes' : 'Val') : '';
                return `<td ${attrs} ${meta} class="celda-medida${claseTooltip} px-2 py-1.5 text-right font-mono text-[11px] text-slate-700 border-r border-slate-200 whitespace-nowrap">${texto}</td>`;
            }).join('');
        };

        return [
            renderGrupo(medidas.entrada, 'entrada'),
            renderGrupo(medidas.salida, 'salida'),
            renderGrupo(medidas.total, 'total')
        ].join('');
    },

    valorDimension(dim, valor) {
        if (dim.render) return dim.render(valor);
        return this.escapeHtml(valor);
    },

    coincideSeleccion(values, seleccion, sourceKey) {
        if (!seleccion || seleccion.source !== sourceKey) return false;

        return Object.entries(seleccion.dims || {}).every(([key, value]) => {
            return String(values[key]) === String(value);
        });
    },

    renderVacio(config) {
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col min-h-[220px]">
                <div class="px-4 py-3 border-b border-slate-200 bg-white">
                    <h2 class="text-sm sm:text-base font-bold text-slate-800 tracking-tight">${this.escapeHtml(config.title)}</h2>
                    <p class="text-[11px] text-slate-500 mt-0.5">${this.escapeHtml(config.subtitle || '')}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <i class="fas fa-inbox text-2xl mb-2 text-slate-300"></i>
                    <p class="text-xs font-medium">${this.escapeHtml(config.emptyMessage || 'Sin movimientos para el rango seleccionado.')}</p>
                </div>
            </div>
        `;
    }
};
