window.SaldosListadoPendientesView = {
    MESES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],

    esc(texto) {
        if (texto === null || texto === undefined) return '';
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    numero(valor, decimales = 2) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return Number(valor).toLocaleString('en-US', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        });
    },

    moneda(valor, decimales = 2) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        return `S/ ${this.numero(valor, decimales)}`;
    },

    dias(valor) {
        if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '';
        const numero = Math.round(Number(valor));
        return `${isNaN(numero) ? '' : numero} Días`;
    },

    fechaCorta(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-');
        if (partes.length !== 3) return fecha;
        const [y, m, d] = partes;
        return `${d}/${m}/${y}`;
    },

    fechaLargaSimple(fecha) {
        if (!fecha) return '';
        const partes = String(fecha).slice(0, 10).split('-').map(Number);
        if (partes.length !== 3 || !partes[0]) return fecha;
        const [y, m, d] = partes;
        return `${d} de ${this.MESES[m - 1] || ''} de ${y}`;
    },

    fechaHora(valor) {
        if (!valor) return '';
        const texto = String(valor).replace('T', ' ');
        const partes = texto.split(' ');
        const fecha = partes[0] || '';
        const hora = partes[1] || '00:00:00';
        const [y, m, d] = fecha.split('-');
        const [hh, mm, ss] = hora.split(':');

        if (!y || !m || !d) return valor;

        let h = parseInt(hh, 10);
        if (isNaN(h)) h = 0;
        const ampm = h >= 12 ? 'p.m.' : 'a.m.';
        h = h % 12 || 12;

        return `${y}/${m}/${d} ${h}:${(mm || '00')}:${(ss || '00')} ${ampm}`;
    },

    anioDe(row) {
        if (row.anio === null || row.anio === undefined || row.anio === '') return 'Sin año';
        return String(row.anio);
    },

    obtenerAnios(data) {
        const set = new Set(data.map(row => this.anioDe(row)));
        return Array.from(set).sort((a, b) => {
            if (a === 'Sin año') return 1;
            if (b === 'Sin año') return -1;
            return Number(a) - Number(b);
        });
    },

    agrupar(data) {
        const mapa = new Map();
        const grupos = [];

        data.forEach(row => {
            const key = `${row.vencimiento}|||${row.zonafiscal}|||${row.cuentaventa}`;
            let grupo = mapa.get(key);
            if (!grupo) {
                grupo = {
                    label: `${row.vencimiento}, ${row.zonafiscal}, ${row.cuentaventa}`,
                    rows: []
                };
                mapa.set(key, grupo);
                grupos.push(grupo);
            }
            grupo.rows.push(row);
        });

        return grupos;
    },

    totalesPorAnio(data) {
        const totales = {};
        data.forEach(row => {
            const anio = this.anioDe(row);
            if (!totales[anio]) {
                totales[anio] = { diasporvencer: 0, saldoinicial: 0, saldofinal: 0 };
            }
            totales[anio].diasporvencer += Number(row.diasporvencer) || 0;
            totales[anio].saldoinicial += Number(row.saldoinicial) || 0;
            totales[anio].saldofinal += Number(row.saldofinal) || 0;
        });
        return totales;
    },

    celdaMedida(valor, maximo, esDia) {
        const numero = Number(valor) || 0;
        const absoluto = Math.abs(numero);
        const pct = maximo > 0 ? Math.min(100, (absoluto / maximo) * 100) : 0;
        const negativo = numero < 0;
        const etiqueta = esDia ? this.dias(numero) : this.moneda(numero);
        const barraPos = negativo ? 'right:0;' : 'left:0;';
        const claseEje = negativo ? 'slp-zero-right' : 'slp-zero-left';

        let etiquetaPos = '';
        if (negativo) {
            etiquetaPos = pct > 65
                ? `left:calc(${100 - pct}% + 4px);`
                : `right:calc(${pct}% + 4px);`;
        } else {
            etiquetaPos = pct > 65
                ? 'right:4px;'
                : `left:calc(${pct}% + 4px);`;
        }

        return `
            <td class="slp-medida">
                <div class="slp-bar-cell ${claseEje}">
                    <div class="slp-bar-track"></div>
                    <div class="slp-bar${negativo ? ' slp-bar-neg' : ''}" style="${barraPos}width:${pct}%;"></div>
                    <span class="slp-bar-label${negativo ? ' slp-negativo' : ''}" style="${etiquetaPos}">${etiqueta}</span>
                </div>
            </td>
        `;
    },

    render(contenedor, payload, controller) {
        if (!contenedor) return;

        const tooltipAnterior = document.getElementById('slp-tooltip');
        if (tooltipAnterior) tooltipAnterior.remove();

        const data = payload && Array.isArray(payload.data) ? payload.data : [];
        this._contenedor = contenedor;
        this._payload = payload || {};
        this._controller = controller;
        this._dataOriginal = data;

        const saldoMax = data.length ? Math.max(...data.map(row => Number(row.saldofinal) || 0)) : 0;
        this._saldoMaxGlobal = saldoMax;
        this._saldoMin = 0;
        this._saldoMax = saldoMax;

        this._pintar(data);
        this._setupSaldoFilter();
    },

    _pintar(data) {
        const contenedor = this._contenedor;
        const payload = this._payload || {};
        const controller = this._controller;
        if (!contenedor) return;

        if (data.length === 0) {
            const mensaje = (this._dataOriginal && this._dataOriginal.length > 0)
                ? 'No hay pendientes en el rango de saldo seleccionado.'
                : ((payload && payload.message) || 'No se encontraron pendientes para los filtros seleccionados.');
            contenedor.innerHTML = `
                <div class="w-full bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 font-medium">
                    ${this.esc(mensaje)}
                </div>
            `;
            const tip = document.getElementById('slp-tooltip');
            if (tip) tip.remove();
            return;
        }

        const fechacarga = payload.fechacarga || '';
        const fechaInicio = payload.fecha_inicio || (controller && controller.currentPeriodo ? controller.currentPeriodo.inicio : '');
        const fechaFin = payload.fecha_fin || (controller && controller.currentPeriodo ? controller.currentPeriodo.fin : '');
        const anios = this.obtenerAnios(data);
        const grupos = this.agrupar(data);
        const totalesPorAnio = this.totalesPorAnio(data);

        const maxDias = Math.max(1, ...data.map(row => Math.abs(Number(row.diasporvencer) || 0)));
        const maxSaldoInicial = Math.max(1, ...data.map(row => Math.abs(Number(row.saldoinicial) || 0)));
        const maxSaldoFinal = Math.max(1, ...data.map(row => Math.abs(Number(row.saldofinal) || 0)));

        const headerRow1 = `
            <tr>
                <th rowspan="2" class="slp-sticky-left slp-combined-head">cuentaventa</th>
                <th rowspan="2">numerodoc</th>
                <th rowspan="2">horacreacion</th>
                <th rowspan="2">condicionpago</th>
                <th rowspan="2">nomcliente</th>
                <th rowspan="2">nomcorporativo</th>
                ${anios.map(anio => `<th colspan="3" class="slp-year">${this.esc(anio)}</th>`).join('')}
            </tr>
        `;

        const headerRow2 = `
            <tr>
                ${anios.map(() => `
                    <th>diasporvencer</th>
                    <th>saldoinicial</th>
                    <th>saldofinal</th>
                `).join('')}
            </tr>
        `;

        let body = '';
        let rowRenderIdx = 0;
        grupos.forEach(grupo => {
            grupo.rows.forEach((row, indice) => {
                const rowIdx = rowRenderIdx++;
                body += `<tr data-row-index="${rowIdx}">`;

                if (indice === 0) {
                    body += `<td rowspan="${grupo.rows.length}" class="slp-sticky-left slp-combined">${this.esc(grupo.label)}</td>`;
                }

                body += `
                    <td class="slp-nowrap">${this.esc(row.numerodoc)}</td>
                    <td class="slp-nowrap slp-hora">${this.esc(this.fechaHora(row.horacreacion))}</td>
                    <td class="slp-nowrap">${this.esc(row.condicionpago)}</td>
                    <td class="slp-truncate" title="${this.esc(row.nomcliente)}">${this.esc(row.nomcliente)}</td>
                    <td class="slp-truncate" title="${this.esc(row.nomcorporativo)}">${this.esc(row.nomcorporativo)}</td>
                `;

                const anioFila = this.anioDe(row);
                anios.forEach(anio => {
                    if (anio === anioFila) {
                        body += this.celdaMedida(row.diasporvencer, maxDias, true);
                        body += this.celdaMedida(row.saldoinicial, maxSaldoInicial, false);
                        body += this.celdaMedida(row.saldofinal, maxSaldoFinal, false);
                    } else {
                        body += '<td class="slp-vacia"></td><td class="slp-vacia"></td><td class="slp-vacia"></td>';
                    }
                });

                body += '</tr>';
            });
        });

        let footer = `<tr class="slp-total"><td colspan="6" class="slp-sticky-left">Total general</td>`;
        anios.forEach(anio => {
            const t = totalesPorAnio[anio] || { diasporvencer: 0, saldoinicial: 0, saldofinal: 0 };
            footer += `
                <td>${this.dias(t.diasporvencer)}</td>
                <td>${this.moneda(t.saldoinicial)}</td>
                <td>${this.moneda(t.saldofinal)}</td>
            `;
        });
        footer += '</tr>';

        const totalRegistros = data.length;
        const subtitulo = `
            Fecha carga: <span class="font-semibold text-slate-700">${this.esc(this.fechaCorta(fechacarga))}</span>
            <span class="mx-1 text-slate-300">|</span>
            Fecha contable: <span class="font-semibold text-slate-700">${this.esc(this.fechaCorta(fechaInicio))} al ${this.esc(this.fechaCorta(fechaFin))}</span>
        `;

        contenedor.innerHTML = `
            <style>
                .slp-table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; font-size: 11px; }
                .slp-table th, .slp-table td { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 5px 7px; white-space: nowrap; }
                .slp-table thead th { background: #2563eb; color: #fff; font-size: 10px; font-weight: 700; position: sticky; top: 0; z-index: 20; }
                .slp-table thead tr:first-child th { height: 30px; }
                .slp-table thead tr:nth-child(2) th { top: 30px; }
                .slp-table .slp-sticky-left { position: sticky; left: 0; z-index: 15; background: #fff; }
                .slp-table thead .slp-sticky-left { z-index: 40; background: #2563eb; }
                .slp-table tfoot .slp-sticky-left { z-index: 35; background: #f1f5f9; }
                .slp-table tbody tr:hover td { background-color: #f8fafc; }
                .slp-table tbody tr:hover td.slp-sticky-left { background-color: #f8fafc; }
                .slp-combined { min-width: 185px; max-width: 240px; font-weight: 700; color: #1e293b; line-height: 1.2; }
                .slp-combined-head { text-align: left; }
                .slp-truncate { max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
                .slp-hora { min-width: 145px; }
                .slp-medida { min-width: 170px; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
                .slp-bar-cell { position: relative; display: flex; align-items: center; height: 20px; width: 100%; }
                .slp-bar-track { position: absolute; left: 0; right: 0; top: 50%; height: 10px; transform: translateY(-50%); background: #f1f5f9; border-radius: 2px; }
                .slp-bar { position: absolute; top: 50%; height: 14px; transform: translateY(-50%); background: #4e79a7; border-radius: 2px; }
                .slp-bar-neg { background: #4e79a7; }
                .slp-zero-right::after, .slp-zero-left::after { content: ''; position: absolute; top: 0; bottom: 0; width: 1px; background: #cbd5e1; z-index: 1; }
                .slp-zero-right::after { right: 0; }
                .slp-zero-left::after { left: 0; }
                .slp-bar-label { position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; padding: 0 3px; background: rgba(255,255,255,.88); border-radius: 2px; font-size: 10px; color: #0f172a; white-space: nowrap; }
                .slp-bar-label.slp-negativo { color: #0f172a; }
                .slp-vacia { background: #fff; }
                .slp-year { text-align: center; }
                .slp-total td { background: #f8fafc; font-weight: 700; color: #0f172a; }

                .slp-tooltip {
                    position: fixed;
                    z-index: 9999;
                    pointer-events: none;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18), 0 4px 10px rgba(15, 23, 42, 0.08);
                    padding: 10px 12px;
                    font-size: 11px;
                    line-height: 1.55;
                    min-width: 220px;
                    max-width: 330px;
                }
                .slp-tooltip-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
                .slp-tooltip-label { color: #64748b; font-weight: 500; white-space: nowrap; }
                .slp-tooltip-value { color: #0f172a; font-weight: 700; text-align: right; word-break: break-word; }
            </style>

            <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div class="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h3 class="text-base font-bold text-slate-800 tracking-tight">Análisis de Pendientes por Día</h3>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">21 Dash Listado</span>
                        </div>
                        <p class="text-xs text-slate-500 font-medium mt-1">${subtitulo}</p>
                    </div>
                    <span class="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        ${totalRegistros.toLocaleString('en-US')} registros
                    </span>
                </div>

                <div class="overflow-auto custom-scrollbar" style="max-height:70vh;">
                    <table class="slp-table">
                        <thead>${headerRow1}${headerRow2}</thead>
                        <tbody>${body}</tbody>
                        <tfoot>${footer}</tfoot>
                    </table>
                </div>

                <div class="px-5 py-3 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500 font-medium">
                    Pendientes con saldo final mayor o igual a 0.01 · Cuentas 121201, 121202, 121204, 121205, 121207 y 121210
                </div>
            </div>
        `;

        const totales = data.reduce((acc, row) => {
            acc.diasporvencer += Number(row.diasporvencer) || 0;
            acc.saldoinicial += Number(row.saldoinicial) || 0;
            acc.saldofinal += Number(row.saldofinal) || 0;
            return acc;
        }, { diasporvencer: 0, saldoinicial: 0, saldofinal: 0 });

        this._tooltipData = data;
        this._tooltipTotal = {
            condicionpago: 'Todo',
            cuentaventa: 'Todo',
            horacreacion: 'Todo',
            nomcliente: 'Todo',
            nomcorporativo: 'Todo',
            numerodoc: 'Todo',
            vencimiento: 'Todo',
            zonafiscal: 'Todo',
            anio: anios.length === 1 ? anios[0] : 'Todo',
            diasporvencer: Number(totales.diasporvencer) || 0,
            saldofinal: Number(totales.saldofinal) || 0,
            saldoinicial: Number(totales.saldoinicial) || 0
        };
        this._bindTooltip(contenedor);
    },

    _bindTooltip(contenedor) {
        const anterior = document.getElementById('slp-tooltip');
        if (anterior) anterior.remove();

        const tooltip = document.createElement('div');
        tooltip.id = 'slp-tooltip';
        tooltip.className = 'slp-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        this._tooltipEl = tooltip;
        this._tooltipVisible = false;

        const tbody = contenedor.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr[data-row-index]').forEach(tr => this._bindTooltipRow(tr));
        }

        const tfoot = contenedor.querySelector('tfoot tr');
        if (tfoot) {
            tfoot.setAttribute('data-total-tooltip', '1');
            this._bindTooltipRow(tfoot);
        }

        const scroller = contenedor.querySelector('.overflow-auto');
        if (scroller) {
            scroller.addEventListener('scroll', () => this._ocultarTooltip(), { passive: true });
        }
    },

    _bindTooltipRow(tr) {
        tr.addEventListener('mouseenter', (e) => this._programarTooltip(tr, e));
        tr.addEventListener('mousemove', (e) => {
            this._tooltipPos = { x: e.clientX, y: e.clientY };
            if (this._tooltipVisible) this._posicionarTooltip();
        });
        tr.addEventListener('mouseleave', () => this._ocultarTooltip());
    },

    _programarTooltip(tr, e) {
        this._tooltipPos = { x: e.clientX, y: e.clientY };
        if (this._tooltipTimer) clearTimeout(this._tooltipTimer);

        const esTotal = tr.getAttribute('data-total-tooltip') === '1';

        this._tooltipTimer = setTimeout(() => {
            if (esTotal) {
                this._mostrarTooltip(this._tooltipTotal);
                return;
            }
            const idx = Number(tr.getAttribute('data-row-index'));
            const row = this._tooltipData && this._tooltipData[idx];
            if (row) this._mostrarTooltip(row);
        }, 500);
    },

    _mostrarTooltip(row) {
        const tooltip = this._tooltipEl;
        if (!tooltip) return;
        tooltip.innerHTML = this._contenidoTooltip(row);
        tooltip.style.display = 'block';
        this._tooltipVisible = true;
        this._posicionarTooltip();
    },

    _posicionarTooltip() {
        const tooltip = this._tooltipEl;
        const pos = this._tooltipPos;
        if (!tooltip || !pos) return;

        const margen = 14;
        const ancho = tooltip.offsetWidth || 240;
        const alto = tooltip.offsetHeight || 160;
        let x = pos.x + margen;
        let y = pos.y + margen;

        if (x + ancho > window.innerWidth - 8) x = pos.x - ancho - margen;
        if (y + alto > window.innerHeight - 8) y = pos.y - alto - margen;

        tooltip.style.left = `${Math.max(8, x)}px`;
        tooltip.style.top = `${Math.max(8, y)}px`;
    },

    _ocultarTooltip() {
        if (this._tooltipTimer) {
            clearTimeout(this._tooltipTimer);
            this._tooltipTimer = null;
        }
        this._tooltipVisible = false;
        if (this._tooltipEl) {
            this._tooltipEl.style.display = 'none';
            this._tooltipEl.innerHTML = '';
        }
    },

    _contenidoTooltip(row) {
        const filas = [
            ['condicionpago', row.condicionpago],
            ['cuentaventa', row.cuentaventa],
            ['horacreacion', this.fechaHora(row.horacreacion)],
            ['nomcliente', row.nomcliente],
            ['nomcorporativo', row.nomcorporativo],
            ['numerodoc', row.numerodoc],
            ['vencimiento', row.vencimiento],
            ['zonafiscal', row.zonafiscal],
            ['Año de horacreacion', this.anioDe(row)],
            ['diasporvencer', this.dias(row.diasporvencer)],
            ['saldofinal', this.moneda(row.saldofinal)],
            ['saldoinicial', this.moneda(row.saldoinicial)]
        ];

        return filas.map(([etiqueta, valor]) => `
            <div class="slp-tooltip-row">
                <span class="slp-tooltip-label">${this.esc(etiqueta)}:</span>
                <span class="slp-tooltip-value">${this.esc(valor)}</span>
            </div>
        `).join('');
    },

    _setupSaldoFilter() {
        const minRange = document.getElementById('input-saldo-range-min');
        const maxRange = document.getElementById('input-saldo-range-max');
        const minInput = document.getElementById('input-saldo-min');
        const maxInput = document.getElementById('input-saldo-max');
        if (!minRange || !maxRange) return;

        const max = Math.max(0, Number(this._saldoMaxGlobal) || 0);

        minRange.min = '0';
        minRange.max = String(max);
        minRange.step = '0.01';
        maxRange.min = '0';
        maxRange.max = String(max);
        maxRange.step = '0.01';

        if (this._saldoRangeHandler) {
            minRange.removeEventListener('input', this._saldoRangeHandler);
            maxRange.removeEventListener('input', this._saldoRangeHandler);
        }
        if (this._saldoInputHandler) {
            if (minInput) {
                minInput.removeEventListener('change', this._saldoInputHandler);
                minInput.removeEventListener('keydown', this._saldoKeyHandler);
            }
            if (maxInput) {
                maxInput.removeEventListener('change', this._saldoInputHandler);
                maxInput.removeEventListener('keydown', this._saldoKeyHandler);
            }
        }

        this._saldoRangeHandler = () => {
            let min = parseFloat(minRange.value) || 0;
            let maxVal = parseFloat(maxRange.value) || 0;
            if (min > maxVal) {
                const tmp = min;
                min = maxVal;
                maxVal = tmp;
            }
            this._saldoMin = Math.max(0, Math.min(min, max));
            this._saldoMax = Math.max(0, Math.min(maxVal, max));
            this._sincronizarControlesSaldo();
            this._programarFiltroSaldo();
        };

        this._saldoInputHandler = () => this._aplicarSaldoDesdeInputs();
        this._saldoKeyHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._aplicarSaldoDesdeInputs();
                if (e.target && typeof e.target.blur === 'function') e.target.blur();
            }
        };

        minRange.addEventListener('input', this._saldoRangeHandler);
        maxRange.addEventListener('input', this._saldoRangeHandler);
        if (minInput) {
            minInput.addEventListener('change', this._saldoInputHandler);
            minInput.addEventListener('keydown', this._saldoKeyHandler);
        }
        if (maxInput) {
            maxInput.addEventListener('change', this._saldoInputHandler);
            maxInput.addEventListener('keydown', this._saldoKeyHandler);
        }

        this._saldoMin = 0;
        this._saldoMax = max;
        this._sincronizarControlesSaldo();
    },

    _sincronizarControlesSaldo() {
        const minRange = document.getElementById('input-saldo-range-min');
        const maxRange = document.getElementById('input-saldo-range-max');
        const minInput = document.getElementById('input-saldo-min');
        const maxInput = document.getElementById('input-saldo-max');
        const highlight = document.getElementById('slider-track-highlight-saldo');

        const max = Math.max(0, Number(this._saldoMaxGlobal) || 0);
        const minVal = Math.max(0, Math.min(Number(this._saldoMin) || 0, max));
        const maxVal = Math.max(minVal, Math.min(Number(this._saldoMax) || 0, max));

        if (minRange) minRange.value = String(minVal);
        if (maxRange) maxRange.value = String(maxVal);
        if (minInput) minInput.value = this._formatoSaldoInput(minVal);
        if (maxInput) maxInput.value = this._formatoSaldoInput(maxVal);

        if (highlight) {
            const pctMin = max > 0 ? (minVal / max) * 100 : 0;
            const pctMax = max > 0 ? (maxVal / max) * 100 : 100;
            highlight.style.left = `${pctMin}%`;
            highlight.style.width = `${Math.max(0, pctMax - pctMin)}%`;
        }
    },

    _formatoSaldoInput(valor) {
        return this.numero(Number(valor) || 0, 2);
    },

    _parseSaldoInput(texto) {
        const limpio = String(texto === null || texto === undefined ? '' : texto).replace(/[^\d.-]/g, '');
        const numero = parseFloat(limpio);
        return isNaN(numero) ? 0 : numero;
    },

    _aplicarSaldoDesdeInputs() {
        const minInput = document.getElementById('input-saldo-min');
        const maxInput = document.getElementById('input-saldo-max');
        const max = Math.max(0, Number(this._saldoMaxGlobal) || 0);

        let min = this._parseSaldoInput(minInput ? minInput.value : 0);
        let maxVal = this._parseSaldoInput(maxInput ? maxInput.value : max);

        min = Math.max(0, Math.min(min, max));
        maxVal = Math.max(0, Math.min(maxVal, max));
        if (min > maxVal) {
            const tmp = min;
            min = maxVal;
            maxVal = tmp;
        }

        this._saldoMin = min;
        this._saldoMax = maxVal;
        this._sincronizarControlesSaldo();
        this._aplicarFiltroSaldo();
    },

    _programarFiltroSaldo() {
        if (this._saldoRaf) cancelAnimationFrame(this._saldoRaf);
        this._saldoRaf = requestAnimationFrame(() => {
            this._saldoRaf = null;
            this._aplicarFiltroSaldo();
        });
    },

    _aplicarFiltroSaldo() {
        if (!this._dataOriginal) return;
        const min = Number(this._saldoMin) || 0;
        const max = Number(this._saldoMax) || 0;

        const filtrada = this._dataOriginal.filter(row => {
            const valor = Number(row.saldofinal) || 0;
            return valor >= min - 1e-9 && valor <= max + 1e-9;
        });

        this._pintar(filtrada);
    },

    resetSaldoFilter() {
        this._saldoMin = 0;
        this._saldoMax = Number(this._saldoMaxGlobal) || 0;
        this._sincronizarControlesSaldo();
        if (this._dataOriginal) this._pintar(this._dataOriginal);
    },

    destroy() {
        this._ocultarTooltip();
        if (this._saldoRaf) {
            cancelAnimationFrame(this._saldoRaf);
            this._saldoRaf = null;
        }
        if (this._tooltipEl) {
            this._tooltipEl.remove();
            this._tooltipEl = null;
        }
        this._dataOriginal = null;
    }
};
