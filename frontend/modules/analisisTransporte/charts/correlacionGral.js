window.CorrelacionGralView = {
    escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    fecha(fecha) {
        if (!fecha) return '';
        const p = String(fecha).slice(0, 10).split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fecha;
    },

    fechaHora(fecha) {
        if (!fecha) return '';
        const p = String(fecha).split(' ');
        return `${this.fecha(p[0])} ${p[1] || ''}`.trim();
    },

    numero(valor, decimales = 2) {
        if (valor === null || valor === undefined || isNaN(valor)) return '';
        return Number(valor).toLocaleString('de-DE', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    porcentaje(valor, decimales = 2) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return `${this.numero(valor, decimales)}%`;
    },

    duracion(segundos) {
        const s = Math.abs(Number(segundos) || 0);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = Math.floor(s % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    },

    tabla(titulo, columnas, filas, renderFila, extraHeader = '', fluid = false, paginationHtml = '') {
        return `
            <div class="${fluid ? 'h-full' : ''} w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <h3 class="text-sm font-bold text-slate-800">${this.escapeHtml(titulo)}</h3>
                    ${extraHeader}
                </div>
                <div class="${fluid ? 'flex-1 min-h-0 max-h-[240px] xl:max-h-none' : 'max-h-[240px]'} min-w-0 overflow-x-scroll overflow-y-auto correlacion-scroll-x custom-scrollbar">
                    <table class="w-max min-w-full text-[10px] border-separate border-spacing-0">
                        <thead class="sticky top-0 z-20 bg-blue-700 text-white">
                            <tr>${columnas.map(c => `<th class="px-2 py-2 text-left font-bold whitespace-nowrap border-r border-blue-500">${this.escapeHtml(c)}</th>`).join('')}</tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${filas.length ? filas.map(renderFila).join('') : `<tr><td colspan="${columnas.length}" class="px-4 py-10 text-center text-slate-400">Sin datos.</td></tr>`}
                        </tbody>
                    </table>
                </div>
                ${paginationHtml}
            </div>
        `;
    },

    paginacion(clave, seccion) {
        const total = Number(seccion?.total) || 0;
        const page = Number(seccion?.page) || 1;
        const size = Number(seccion?.page_size) || 100;
        const pages = Math.max(1, Math.ceil(total / size));
        return `<div class="relative z-10 w-full px-3 py-2 border-t-2 border-slate-300 flex items-center justify-between gap-2 text-[10px] text-slate-500 bg-slate-50 shrink-0 min-h-[38px] shadow-[0_-2px_4px_rgba(15,23,42,0.06)]">
            <span>${total.toLocaleString('de-DE')} registros</span>
            <div class="flex items-center gap-2">
                <button type="button" data-page-key="${clave}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">‹</button>
                <span>${page} / ${pages}</span>
                <button type="button" data-page-key="${clave}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">›</button>
            </div>
        </div>`;
    },

    chipSeleccion(sel) {
        const seleccion = sel || {};
        if (!seleccion.fecha) return '';
        return `<span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded font-semibold">${this.fecha(seleccion.fecha)} · ${this.escapeHtml(seleccion.placa)}</span>
                <button type="button" data-limpiar-seleccion class="text-[10px] text-rose-600 font-semibold hover:underline">Quitar</button>`;
    },

    actualizarSeleccionVentas(controller) {
        const card = document.getElementById('corr-card-ventas');
        if (!card) return;
        const sel = controller.seleccionVentas || {};

        card.querySelectorAll('[data-venta-fecha]').forEach(tr => {
            const activa = tr.getAttribute('data-venta-fecha') === sel.fecha
                && tr.getAttribute('data-venta-placa') === sel.placa;
            tr.classList.toggle('bg-blue-100', activa);
            tr.classList.toggle('ring-2', activa);
            tr.classList.toggle('ring-inset', activa);
            tr.classList.toggle('ring-blue-400', activa);
        });

        const chips = document.getElementById('corr-ventas-chips');
        if (!chips) return;
        chips.innerHTML = this.chipSeleccion(sel);
        const limpiar = chips.querySelector('[data-limpiar-seleccion]');
        if (limpiar) limpiar.addEventListener('click', () => controller.limpiarSeleccion());
    },

    buildVentas(controller, data) {
        const ventas = data?.ventas?.rows || [];
        const sel = controller.seleccionVentas || {};
        return this.tabla(
            'Ventas',
            ['Día FecProceso', 'Placa', 'Día FecRegistro', 'Min. Hora', 'Max. Hora', 'CodCorporativo', 'NomCorporativo', 'CodCliente', 'NomCliente', 'NroDoc', 'tdoc', 'Código', 'Cantidad', 'Peso'],
            ventas,
            (r) => {
                const activa = sel.fecha === r.fecha && sel.placa === r.placa;
                return `<tr class="hover:bg-blue-50/50 cursor-pointer ${activa ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''}"
                    data-venta-fecha="${this.escapeHtml(r.fecha)}" data-venta-placa="${this.escapeHtml(r.placa)}">
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha)}</td>
                    <td class="px-2 py-1 font-mono whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.placa)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha_registro)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.hora_min)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.hora_max)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cod_corporativo)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.nom_corporativo)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cod_cliente)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.nom_cliente)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.nro_doc)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.tdoc)}</td>
                    <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.codigo)}</td>
                    <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${this.numero(r.cantidad, 0)}</td>
                    <td class="px-2 py-1 text-right font-mono">${this.numero(r.peso, 2)}</td>
                </tr>`;
            },
            `<div id="corr-ventas-chips" class="flex items-center gap-2">${this.chipSeleccion(sel)}</div>`,
            true,
            this.paginacion('ventas', data?.ventas)
        );
    },

    buildTransportes(data) {
        const transportes = data?.transportes?.rows || [];
        return this.tabla(
            'Transportes',
            ['Día FecProceso', 'Placa', 'Entrada', 'Salida', 'Zona', 'Ruta', 'Secuencia', 'CodCorporativo', 'NomCorporativo', 'CodCliente', 'NomCliente', 'GeoCerca', 'Tiempo'],
            transportes,
            r => `<tr class="hover:bg-slate-50">
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha)}</td>
                <td class="px-2 py-1 font-mono whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.placa)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fechaHora(r.fecha_entrada)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fechaHora(r.fecha_salida)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.zona)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.ruta)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.secuencia)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cod_corporativo)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.nom_corporativo)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cod_cliente)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.nom_cliente)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.geocerca)}</td>
                <td class="px-2 py-1 font-mono whitespace-nowrap">${this.duracion(r.duracion_seg)}</td>
            </tr>`,
            '',
            false,
            this.paginacion('transportes', data?.transportes)
        );
    },

    buildAgcausal(data) {
        const agcausal = data?.agcausal?.rows || [];
        return this.tabla(
            'Eventos Proceso Mermas',
            ['Fecha', 'Cliente', 'Placa', 'Área', 'Código', 'Causa', 'Fecha Registro', 'Hora', 'Descripción'],
            agcausal,
            r => `<tr class="hover:bg-slate-50">
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cliente)}</td>
                <td class="px-2 py-1 font-mono whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.placa)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.area)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.codigoconta)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.causatipo)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha_registro)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.hora_registro)}</td>
                <td class="px-2 py-1 min-w-[320px]">${this.escapeHtml(r.descripcion)}</td>
            </tr>`,
            '',
            true,
            this.paginacion('agcausal', data?.agcausal)
        );
    },

    buildMermas(data) {
        const mermas = data?.mermas?.rows || [];
        return this.tabla(
            '% Mermas',
            ['Fecha', 'Zona', 'Cliente', 'Placa', 'Código', 'Objetivo', 'Real', 'Dif', 'Entrada', 'Mermatotal'],
            mermas,
            r => `<tr class="hover:bg-slate-50">
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.fecha(r.fecha)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.zonaorigen)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.cliente)}</td>
                <td class="px-2 py-1 font-mono whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.placa)}</td>
                <td class="px-2 py-1 whitespace-nowrap border-r border-slate-100">${this.escapeHtml(r.codigo)}</td>
                <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${this.porcentaje(r.objetivo)}</td>
                <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${this.porcentaje(r.real_pct)}</td>
                <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${this.porcentaje(r.dif)}</td>
                <td class="px-2 py-1 text-right font-mono border-r border-slate-100">${this.numero(r.entrada, 2)}</td>
                <td class="px-2 py-1 text-right font-mono">${this.numero(r.mermatotal, 2)}</td>
            </tr>`,
            '',
            true,
            this.paginacion('mermas', data?.mermas)
        );
    },

    bindCard(scope, controller) {
        if (!scope) return;
        scope.querySelectorAll('[data-venta-fecha]').forEach(tr => {
            tr.addEventListener('click', () => {
                controller.seleccionarVenta(
                    tr.getAttribute('data-venta-fecha'),
                    tr.getAttribute('data-venta-placa')
                );
            });
        });

        const limpiar = scope.querySelector('[data-limpiar-seleccion]');
        if (limpiar) {
            limpiar.addEventListener('click', () => controller.limpiarSeleccion());
        }

        scope.querySelectorAll('[data-page-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                controller.cambiarPagina(btn.getAttribute('data-page-key'), Number(btn.getAttribute('data-page')));
            });
        });
    },

    render(controller, data, target = 'contenedor-correlacion') {
        const contenedor = document.getElementById(target);
        if (!contenedor) return;

        contenedor.innerHTML = `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch xl:h-[660px] overflow-hidden">
                <div id="corr-card-ventas" class="h-full min-w-0 min-h-0 w-full">${this.buildVentas(controller, data)}</div>
                <div class="grid grid-cols-1 grid-rows-2 gap-4 min-h-0 h-full min-w-0 w-full">
                    <div id="corr-card-agcausal" class="h-full min-h-0 min-w-0 w-full">${this.buildAgcausal(data)}</div>
                    <div id="corr-card-mermas" class="h-full min-h-0 min-w-0 w-full">${this.buildMermas(data)}</div>
                </div>
            </div>
            <div id="corr-card-transportes" class="mt-8 min-w-0 w-full">${this.buildTransportes(data)}</div>
        `;

        ['ventas', 'agcausal', 'mermas', 'transportes'].forEach(clave => {
            this.bindCard(contenedor.querySelector('#corr-card-' + clave), controller);
        });
    },

    actualizarTabla(controller, clave, seccion, fullData) {
        const wrapper = document.getElementById('corr-card-' + clave);
        if (!wrapper) return;

        const oldScroll = wrapper.querySelector('.correlacion-scroll-x');
        const scrollLeft = oldScroll ? oldScroll.scrollLeft : 0;

        let html = '';
        if (clave === 'ventas') html = this.buildVentas(controller, fullData);
        else if (clave === 'transportes') html = this.buildTransportes(fullData);
        else if (clave === 'agcausal') html = this.buildAgcausal(fullData);
        else if (clave === 'mermas') html = this.buildMermas(fullData);
        else return;

        wrapper.innerHTML = html;

        const newScroll = wrapper.querySelector('.correlacion-scroll-x');
        if (newScroll) {
            newScroll.scrollLeft = scrollLeft;
            newScroll.scrollTop = 0;
        }

        this.bindCard(wrapper, controller);
    }
};
