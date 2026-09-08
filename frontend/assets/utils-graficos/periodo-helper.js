/**
 * Helper para renderizar y calcular dinámicamente inputs de período
 */
const PeriodoHelper = {
    // Helpers de formateo YYYY-MM-DD y YYYY-MM
    formatYMD(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    formatYM(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    },

    getLunesSemana(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
        return new Date(d.setDate(diff));
    },

    renderizarInputs() {
        const select = document.getElementById('select-tipo-periodo');
        const contenedor = document.getElementById('contenedor-inputs-periodo');
        if (!select || !contenedor) return;

        const tipo = select.value;
        const hoy = new Date();

        let html = '';

        switch (tipo) {
            case 'por_fecha': {
                // Fecha actual exacta
                const fechaHoy = this.formatYMD(hoy);
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">FECHA</label>
                        <input type="date" id="input-fecha-unica" value="${fechaHoy}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            }

            case 'entre_fechas': {
                // Hoy hacia atrás 7 días
                const fechaFin = this.formatYMD(hoy);
                const hace7 = new Date();
                hace7.setDate(hoy.getDate() - 7);
                const fechaIni = this.formatYMD(hace7);

                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE</label>
                        <input type="date" id="input-fecha-inicio" value="${fechaIni}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                    <span class="text-slate-400 pb-2.5 font-bold">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA</label>
                        <input type="date" id="input-fecha-fin" value="${fechaFin}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            }

            case 'por_mes': {
                // Mes actual
                const mesActual = this.formatYM(hoy);
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">MES</label>
                        <input type="month" id="input-mes-unico" value="${mesActual}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            }

            case 'entre_meses': {
                // Mes anterior y Mes actual
                const mesActual = this.formatYM(hoy);
                const mesPasadoDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                const mesPasado = this.formatYM(mesPasadoDate);

                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE MES</label>
                        <input type="month" id="input-mes-inicio" value="${mesPasado}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                    <span class="text-slate-400 pb-2.5 font-bold">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA MES</label>
                        <input type="month" id="input-mes-fin" value="${mesActual}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            }

            case 'ultima_semana': {
                // Lunes a Domingo de la semana anterior
                const lunesEstaSemana = this.getLunesSemana(hoy);
                const domingoPasado = new Date(lunesEstaSemana);
                domingoPasado.setDate(domingoPasado.getDate() - 1);
                const lunesPasado = new Date(domingoPasado);
                lunesPasado.setDate(lunesPasado.getDate() - 6);

                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">ÚLTIMA SEMANA</label>
                        <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 select-none">
                            <span>${this.formatYMD(lunesPasado)}</span>
                            <span class="text-slate-400">al</span>
                            <span>${this.formatYMD(domingoPasado)}</span>
                        </div>
                        <input type="hidden" id="input-semana-inicio" value="${this.formatYMD(lunesPasado)}">
                        <input type="hidden" id="input-semana-fin" value="${this.formatYMD(domingoPasado)}">
                    </div>
                `;
                break;
            }

            case 'entre_semanas': {
                // Semana anterior hasta la semana actual
                const lunesEstaSemana = this.getLunesSemana(hoy);
                const domingoEstaSemana = new Date(lunesEstaSemana);
                domingoEstaSemana.setDate(domingoEstaSemana.getDate() + 6);

                const lunesPasado = new Date(lunesEstaSemana);
                lunesPasado.setDate(lunesPasado.getDate() - 7);

                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE SEMANA</label>
                        <input type="date" id="input-semanas-inicio" value="${this.formatYMD(lunesPasado)}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                    <span class="text-slate-400 pb-2.5 font-bold">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA SEMANA</label>
                        <input type="date" id="input-semanas-fin" value="${this.formatYMD(domingoEstaSemana)}"
                            class="bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
                    </div>
                `;
                break;
            }

            default:
                html = '';
        }

        contenedor.innerHTML = html;
    },

    obtenerRangoFechas() {
        const select = document.getElementById('select-tipo-periodo');
        if (!select) return { fechaInicio: '', fechaFin: '' };

        const tipo = select.value;

        switch (tipo) {
            case 'por_fecha': {
                const f = document.getElementById('input-fecha-unica')?.value || '';
                return { fechaInicio: f, fechaFin: f };
            }
            case 'entre_fechas': {
                return {
                    fechaInicio: document.getElementById('input-fecha-inicio')?.value || '',
                    fechaFin: document.getElementById('input-fecha-fin')?.value || ''
                };
            }
            case 'por_mes': {
                const mes = document.getElementById('input-mes-unico')?.value || '';
                if (!mes) return { fechaInicio: '', fechaFin: '' };
                const [y, m] = mes.split('-').map(Number);
                const ultimoDia = new Date(y, m, 0).getDate();
                return {
                    fechaInicio: `${mes}-01`,
                    fechaFin: `${mes}-${String(ultimoDia).padStart(2, '0')}`
                };
            }
            case 'entre_meses': {
                const mIni = document.getElementById('input-mes-inicio')?.value || '';
                const mFin = document.getElementById('input-mes-fin')?.value || '';
                if (!mIni || !mFin) return { fechaInicio: '', fechaFin: '' };
                const [yF, mF] = mFin.split('-').map(Number);
                const ultimoDiaFin = new Date(yF, mF, 0).getDate();
                return {
                    fechaInicio: `${mIni}-01`,
                    fechaFin: `${mFin}-${String(ultimoDiaFin).padStart(2, '0')}`
                };
            }
            case 'ultima_semana': {
                return {
                    fechaInicio: document.getElementById('input-semana-inicio')?.value || '',
                    fechaFin: document.getElementById('input-semana-fin')?.value || ''
                };
            }
            case 'entre_semanas': {
                return {
                    fechaInicio: document.getElementById('input-semanas-inicio')?.value || '',
                    fechaFin: document.getElementById('input-semanas-fin')?.value || ''
                };
            }
            default:
                return { fechaInicio: '', fechaFin: '' };
        }
    }
};

window.PeriodoHelper = PeriodoHelper;