window.ChartAlmacenMermasMermaDiariaClientePlaca = {
    formatNumero(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Number(num).toLocaleString('de-DE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatearPorcentaje(valor) {
        return `${this.formatNumero(valor, 2)}%`;
    },

    formatearFecha(fecha) {
        return String(fecha || '').replace(/-/g, '/');
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

    render(controller, data, targetContainer = 'contenedor-graficos-lista') {
        const contenedor = document.getElementById(targetContainer);
        if (!contenedor) return;

        const payload = controller.cachePayload || {};
        const clientes = Array.isArray(data) ? data : [];
        const fechas = Array.isArray(payload.fechas) ? payload.fechas : [];
        const maxValor = Number(payload.max_valor) || 0;
        const titulo = payload.titulo || 'Porcentaje de Merma Diaria por Fecha de Proceso con filtro de cliente y segmentado por placa';
        const subtitulo = payload.subtitulo || 'Merma total sobre la entrada';

        if (clientes.length === 0 || fechas.length === 0) {
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200">
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="p-10 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-3xl text-slate-300 mb-2"></i>
                        <p class="text-sm font-semibold text-slate-600">No hay datos para los filtros seleccionados.</p>
                    </div>
                </div>
            `;
            return;
        }

        const headerFechas = fechas.map(fecha => `
            <th class="px-2 py-2 text-center font-mono text-[9px] font-semibold text-white border-r border-blue-500 bg-blue-600 whitespace-nowrap" style="min-width: 74px;">
                ${this.escapeHtml(this.formatearFecha(fecha))}
            </th>
        `).join('');

        let body = '';
        clientes.forEach(grupo => {
            const placas = Array.isArray(grupo.placas) ? grupo.placas : [];
            placas.forEach((fila, indicePlaca) => {
                const celdasFecha = fechas.map((_, indiceFecha) => {
                    const valor = fila.valores ? fila.valores[indiceFecha] : null;
                    if (valor === null || valor === undefined || isNaN(valor)) {
                        return '<td class="px-2 py-1.5 text-center border-r border-b border-slate-100 bg-white"></td>';
                    }
                    const numero = Number(valor);
                    const ratio = maxValor > 0 ? Math.min(Math.max(numero / maxValor, 0), 1) : 0;
                    const alpha = 0.05 + (ratio * 0.55);
                    return `
                        <td class="px-2 py-1.5 text-center font-mono text-[10px] font-semibold text-rose-900 border-r border-b border-slate-100 whitespace-nowrap"
                            style="background-color: rgba(225, 87, 89, ${alpha.toFixed(3)});">
                            ${this.formatearPorcentaje(numero)}
                        </td>
                    `;
                }).join('');

                body += `<tr class="hover:bg-slate-50/40">`;
                if (indicePlaca === 0) {
                    body += `<td rowspan="${placas.length}" class="px-3 py-2 font-bold text-slate-700 bg-slate-50 border-r border-b border-slate-200 align-top uppercase text-[10px] sticky left-0 z-20" style="min-width: 110px; max-width: 110px;">
                        ${this.escapeHtml(grupo.cliente)}
                    </td>`;
                }
                body += `
                    <td class="px-2 py-1.5 font-mono font-semibold text-slate-700 bg-white border-r border-b border-slate-100 whitespace-nowrap sticky z-20" style="left: 110px; min-width: 90px;">
                        ${this.escapeHtml(fila.placa)}
                    </td>
                    ${celdasFecha}
                </tr>`;
            });
        });

        contenedor.innerHTML = `
            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">${this.escapeHtml(titulo)}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">${this.escapeHtml(subtitulo)}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <span>0,00%</span>
                            <span class="inline-block w-28 h-2.5 rounded-sm" style="background: linear-gradient(90deg, rgba(225,87,89,0.05), rgba(225,87,89,0.60));"></span>
                            <span>${this.formatearPorcentaje(maxValor)}</span>
                        </div>
                        <div class="text-[11px] text-slate-500 font-medium">
                            Período: <strong class="text-slate-800 font-semibold">${controller.currentPeriodo.inicio} al ${controller.currentPeriodo.fin}</strong>
                        </div>
                    </div>
                </div>
                <div class="overflow-auto max-h-[76vh] custom-scrollbar">
                    <table class="w-max min-w-full border-separate border-spacing-0 text-xs">
                        <thead class="sticky top-0 z-30">
                            <tr>
                                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white border-r border-blue-500 bg-blue-600 sticky left-0 z-40" style="min-width: 110px;">cliente</th>
                                <th class="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white border-r border-blue-500 bg-blue-600 sticky z-40" style="left: 110px; min-width: 90px;">placa</th>
                                ${headerFechas}
                            </tr>
                        </thead>
                        <tbody class="text-slate-700">
                            ${body}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};
