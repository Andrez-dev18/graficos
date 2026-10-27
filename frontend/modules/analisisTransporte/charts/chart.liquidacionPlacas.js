window.ChartAnalisisTransporteLiquidacionPlacas = {
    formatNumero(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    celdasValores(valores, codigos) {
        return codigos.map(codigo => {
            const valor = valores ? valores[codigo.codtra] : null;
            if (!valor) {
                return '<td class="px-2 py-1 text-right border-r border-b border-slate-100 bg-white"></td>'
                    + '<td class="px-2 py-1 text-right border-r border-b border-slate-100 bg-white"></td>'
                    + '<td class="px-2 py-1 text-right border-r border-b border-slate-100 bg-white"></td>';
            }

            const attrs = `data-tt-codtra="${this.escapeHtml(codigo.codtra)}" data-tt-descri="${this.escapeHtml(codigo.descri)}"`;
            const cant = this.formatNumero(valor.cant, 0);
            const peso = this.formatNumero(valor.peso, 2);
            const pp = this.formatNumero(valor.pp, 3);

            return `
                <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-700 border-r border-b border-slate-100 whitespace-nowrap bg-white" ${attrs} data-tt-metric="Cant" data-tt-value="${this.escapeHtml(cant)}">${cant}</td>
                <td class="px-2 py-1 text-right font-mono text-[10px] text-slate-700 border-r border-b border-slate-100 whitespace-nowrap bg-white" ${attrs} data-tt-metric="Peso" data-tt-value="${this.escapeHtml(peso)}">${peso}</td>
                <td class="px-2 py-1 text-right font-mono text-[10px] font-semibold text-blue-900 border-r border-b border-slate-300 whitespace-nowrap bg-slate-50/40" ${attrs} data-tt-metric="PP" data-tt-value="${this.escapeHtml(pp)}">${pp}</td>
            `;
        }).join('');
    },

    celdasTotalGeneral(valor) {
        return this.celdasValores({ 'Total general': valor }, [{ codtra: 'Total general', descri: 'TOTAL GENERAL' }]);
    },

    obtenerTooltipEl() {
        let el = document.getElementById('tooltip-liquidacion-placas');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tooltip-liquidacion-placas';
            el.style.position = 'fixed';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '9999';
            el.style.opacity = '0';
            el.style.background = '#ffffff';
            el.style.border = '1px solid #cbd5e1';
            el.style.borderRadius = '3px';
            el.style.boxShadow = '0 8px 22px rgba(15,23,42,0.16)';
            el.style.padding = '10px 14px';
            el.style.minWidth = '340px';
            el.style.maxWidth = '460px';
            el.style.fontFamily = '"Segoe UI", sans-serif';
            el.style.fontSize = '12px';
            el.style.lineHeight = '1.7';
            el.style.color = '#334155';
            document.body.appendChild(el);
            document.addEventListener('scroll', () => this.ocultarTooltip(), { capture: true, passive: true });
        }
        return el;
    },

    ocultarTooltip() {
        const el = document.getElementById('tooltip-liquidacion-placas');
        if (el) el.style.opacity = '0';
    },

    mostrarTooltip(event, celda) {
        const row = celda.closest('tbody tr');
        if (!row) return;

        const descri = celda.getAttribute('data-tt-descri') || '';
        const coditem = row.getAttribute('data-tt-coditem') || '';
        const codtra = celda.getAttribute('data-tt-codtra') || '';
        const fecha = row.getAttribute('data-tt-fecha') || '';
        const placa = row.getAttribute('data-tt-placa') || '';
        const cliente = row.getAttribute('data-tt-cliente') || '';
        const metric = celda.getAttribute('data-tt-metric') || '';
        const value = celda.getAttribute('data-tt-value') || '';

        const partes = fecha.split('-');
        const fechaTxt = partes.length === 3
            ? `${Number(partes[2])}/${Number(partes[1])}/${partes[0]}`
            : fecha;

        const filas = [
            ['descri:', descri],
            ['CodItem:', coditem],
            ['CodTra:', codtra],
            ['FecProceso:', fechaTxt],
            ['Placa:', placa],
            ['CDCliente:', cliente],
            [`${metric}:`, value]
        ];

        const el = this.obtenerTooltipEl();
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:auto minmax(140px,1fr);gap:1px 22px;">
                ${filas.map(([label, valor]) => `
                    <span style="color:#64748b;">${this.escapeHtml(label)}</span>
                    <span style="font-weight:700;color:#0f172a;text-align:right;">${this.escapeHtml(valor)}</span>
                `).join('')}
            </div>
        `;
        el.style.opacity = '1';
        this.posicionarTooltip(event, el);
    },

    posicionarTooltip(event, el) {
        const width = el.offsetWidth || 380;
        const height = el.offsetHeight || 160;
        let left = event.clientX + 14;
        let top = event.clientY + 14;
        if (left + width > window.innerWidth - 10) left = event.clientX - width - 14;
        if (top + height > window.innerHeight - 10) top = event.clientY - height - 14;
        el.style.left = `${Math.max(8, left)}px`;
        el.style.top = `${Math.max(8, top)}px`;
    },

    inicializarTooltip(tabla) {
        if (!tabla) return;
        tabla.addEventListener('mouseover', (event) => {
            const celda = event.target.closest('[data-tt-metric]');
            if (!celda) return;
            this.mostrarTooltip(event, celda);
        });
        tabla.addEventListener('mousemove', (event) => {
            const celda = event.target.closest('[data-tt-metric]');
            if (!celda) return;
            this.posicionarTooltip(event, this.obtenerTooltipEl());
        });
        tabla.addEventListener('mouseleave', () => this.ocultarTooltip());
    },

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;
        this.ocultarTooltip();

        const codigos = Array.isArray(data?.codigos) ? data.codigos : [];
        const fechas = Array.isArray(data?.fechas) ? data.fechas : [];

        if (codigos.length === 0 || fechas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Liquidación de Placas</h2>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const headerCodigos1 = codigos.map(codigo => `
            <th colspan="3" class="px-2 py-1.5 text-center text-[10px] font-bold text-white bg-blue-700 border-r-2 border-blue-900 border-b border-blue-800">${this.escapeHtml(codigo.codtra)}</th>
        `).join('') + '<th colspan="3" class="px-2 py-1.5 text-center text-[10px] font-bold text-white bg-blue-800 border-r-2 border-blue-950 border-b border-blue-900">Total general</th>';

        const headerCodigos2 = codigos.map(codigo => `
            <th colspan="3" class="px-2 py-1 text-center text-[9px] font-semibold text-slate-700 bg-slate-100 border-r-2 border-slate-300 border-b border-slate-200">${this.escapeHtml(codigo.descri)}</th>
        `).join('') + '<th colspan="3" class="px-2 py-1 text-center text-[9px] font-semibold text-blue-900 bg-blue-100 border-r-2 border-blue-300 border-b border-blue-200">Total general</th>';

        const headerCodigos3 = codigos.map(() => `
            <th class="px-2 py-1 text-center text-[9px] font-bold text-slate-600 bg-slate-100 border-r border-slate-200">Cant</th>
            <th class="px-2 py-1 text-center text-[9px] font-bold text-slate-600 bg-slate-100 border-r border-slate-200">Peso</th>
            <th class="px-2 py-1 text-center text-[9px] font-bold text-blue-900 bg-blue-100 border-r-2 border-slate-300">PP</th>
        `).join('') + `
            <th class="px-2 py-1 text-center text-[9px] font-bold text-blue-900 bg-blue-100 border-r border-blue-200">Cant</th>
            <th class="px-2 py-1 text-center text-[9px] font-bold text-blue-900 bg-blue-100 border-r border-blue-200">Peso</th>
            <th class="px-2 py-1 text-center text-[9px] font-bold text-blue-900 bg-blue-200 border-r-2 border-blue-300">PP</th>
        `;

        let body = '';

        fechas.forEach(fecha => {
            const clientes = Array.isArray(fecha.clientes) ? fecha.clientes : [];
            const totalFilas = clientes.reduce((acc, cliente) => acc + (cliente.filas?.length || 0) + 1, 0);
            let primeraFilaFecha = true;

            clientes.forEach(cliente => {
                const filas = Array.isArray(cliente.filas) ? cliente.filas : [];
                let primeraFilaCliente = true;

                filas.forEach(fila => {
                    body += `<tr class="hover:bg-blue-50/30" data-tt-fecha="${this.escapeHtml(fecha.fecha)}" data-tt-cliente="${this.escapeHtml(cliente.cliente)}" data-tt-placa="${this.escapeHtml(fila.placa)}" data-tt-coditem="${this.escapeHtml(fila.coditem)}">`;
                    if (primeraFilaFecha) {
                        body += `<td rowspan="${totalFilas}" class="px-1 py-2 text-center align-top bg-slate-50 border-r border-b border-slate-200 sticky left-0 z-20" style="min-width:64px;width:64px;">
                            <div style="writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; display: inline-block;" class="font-semibold text-[10px] text-slate-700">${this.escapeHtml(fecha.fecha_txt || fecha.fecha)}</div>
                        </td>`;
                        primeraFilaFecha = false;
                    }
                    if (primeraFilaCliente) {
                        body += `<td rowspan="${filas.length + 1}" class="px-2 py-2 font-bold text-slate-800 uppercase align-top bg-white border-r border-b border-slate-200 sticky z-20" style="left:64px;min-width:110px;max-width:110px;width:110px;">${this.escapeHtml(cliente.cliente)}</td>`;
                        primeraFilaCliente = false;
                    }

                    body += `<td class="px-2 py-1 font-mono text-center text-[10px] text-slate-600 border-r border-b border-slate-200 bg-white sticky z-20" style="left:174px;min-width:86px;width:86px;">${this.escapeHtml(fila.placa)}</td>`;
                    body += `<td class="px-2 py-1 font-mono text-center text-[10px] text-slate-700 border-r border-b border-slate-200 bg-white sticky z-20" style="left:260px;min-width:68px;width:68px;">${this.escapeHtml(fila.coditem)}</td>`;
                    body += this.celdasValores(fila.valores, codigos);
                    body += this.celdasTotalGeneral(fila.total_general);
                    body += '</tr>';
                });

                body += `<tr class="bg-slate-100/80 font-semibold" data-tt-fecha="${this.escapeHtml(fecha.fecha)}" data-tt-cliente="${this.escapeHtml(cliente.cliente)}" data-tt-placa="" data-tt-coditem="Total">`;
                body += `<td colspan="2" class="px-2 py-1 text-center text-[10px] font-bold text-slate-800 border-r border-b border-slate-300 sticky z-20" style="left:174px;background-color:#f1f5f9;">Total</td>`;
                body += this.celdasValores(cliente.total, codigos);
                body += this.celdasTotalGeneral(cliente.total_general);
                body += '</tr>';
            });
        });

        const footerCodigos = codigos.map(codigo => {
            const valor = data.totales_codigos ? data.totales_codigos[codigo.codtra] : null;
            return this.celdasValores({ [codigo.codtra]: valor }, [codigo]);
        }).join('');
        const footerTotalGeneral = this.celdasTotalGeneral(data.total_general);

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Liquidación de Placas</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Movimientos por fecha, cliente, placa y código</p>
                    </div>
                    <div class="text-[11px] text-slate-500 font-medium">
                        Período: <strong class="text-slate-800 font-semibold">${controller.currentPeriodo.inicio} al ${controller.currentPeriodo.fin}</strong>
                    </div>
                </div>
                <div class="w-full overflow-auto max-h-[76vh] custom-scrollbar">
                    <style>
                        .liquidacion-placas-table tfoot td { background-color: #dbeafe !important; border-color: #93c5fd !important; color: #1e3a8a; font-weight: 700; }
                    </style>
                    <table class="liquidacion-placas-table w-max min-w-full text-xs border-separate border-spacing-0">
                        <thead class="sticky top-0 z-40 shadow-xs">
                            <tr>
                                <th rowspan="3" class="px-2 py-2 text-center text-[9px] font-bold text-white bg-blue-800 border-r border-b border-blue-900 sticky left-0 z-50" style="min-width:64px;width:64px;">FecProceso</th>
                                <th rowspan="3" class="px-2 py-2 text-left text-[9px] font-bold text-white bg-blue-800 border-r border-b border-blue-900 sticky z-50" style="left:64px;min-width:110px;width:110px;">CDCliente</th>
                                <th rowspan="3" class="px-2 py-2 text-center text-[9px] font-bold text-white bg-blue-800 border-r border-b border-blue-900 sticky z-50" style="left:174px;min-width:86px;width:86px;">Placa</th>
                                <th rowspan="3" class="px-2 py-2 text-center text-[9px] font-bold text-white bg-blue-800 border-r-2 border-b border-blue-900 sticky z-50" style="left:260px;min-width:68px;width:68px;">CodItem</th>
                                ${headerCodigos1}
                            </tr>
                            <tr>${headerCodigos2}</tr>
                            <tr>${headerCodigos3}</tr>
                        </thead>
                        <tbody>${body}</tbody>
                        <tfoot class="sticky bottom-0 z-40">
                            <tr>
                                <td colspan="4" class="px-3 py-2 text-center text-[10px] font-bold text-blue-900 border-r border-t-2 border-blue-300 bg-blue-100 sticky left-0 z-50" style="width:328px;">Total general</td>
                                ${footerCodigos}
                                ${footerTotalGeneral}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        this.inicializarTooltip(contenedor.querySelector('.liquidacion-placas-table'));
    }
};
