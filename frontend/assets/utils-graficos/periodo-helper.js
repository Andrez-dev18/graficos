/**
 * Helper reutilizable para el control dinámico de períodos y cálculo de rangos de fechas
 */
const PeriodoHelper = {
    renderizarInputs(selectId = 'select-tipo-periodo', contenedorId = 'contenedor-inputs-periodo') {
        const tipo = document.getElementById(selectId)?.value || 'entre_fechas';
        const contenedor = document.getElementById(contenedorId);
        if (!contenedor) return;

        const mesActual = '2026-08';
        const mesAnterior = '2026-07';
        const fechaHoy = '2026-08-30';
        const fechaInicioMes = '2026-08-01';
        const semanaActual = '2026-W35';
        const semanaAnterior = '2026-W31';

        let html = '';

        switch (tipo) {
            case 'por_mes':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">MES</label>
                        <input type="month" id="input-periodo-mes" value="${mesActual}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                `;
                break;

            case 'entre_meses':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE MES</label>
                        <input type="month" id="input-periodo-mes-desde" value="${mesAnterior}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                    <span class="text-slate-400 font-bold self-center mb-2">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA MES</label>
                        <input type="month" id="input-periodo-mes-hasta" value="${mesActual}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                `;
                break;

            case 'por_fecha':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">FECHA</label>
                        <input type="date" id="input-periodo-fecha-unica" value="${fechaHoy}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                `;
                break;

            case 'entre_fechas':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE</label>
                        <input type="date" id="input-periodo-fecha-desde" value="${fechaInicioMes}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                    <span class="text-slate-400 font-bold self-center mb-2">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA</label>
                        <input type="date" id="input-periodo-fecha-hasta" value="${fechaHoy}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                `;
                break;

            case 'ultima_semana':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">ÚLTIMA SEMANA</label>
                        <input type="text" value="Últimos 7 días" disabled
                            class="bg-slate-100 border border-slate-200 text-slate-600 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-xs cursor-not-allowed">
                    </div>
                `;
                break;

            case 'entre_semanas':
                html = `
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">DESDE SEMANA</label>
                        <input type="week" id="input-periodo-semana-desde" value="${semanaAnterior}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                    <span class="text-slate-400 font-bold self-center mb-2">-</span>
                    <div class="flex flex-col">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5">HASTA SEMANA</label>
                        <input type="week" id="input-periodo-semana-hasta" value="${semanaActual}"
                            class="bg-white border border-slate-300 text-slate-800 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer">
                    </div>
                `;
                break;
        }

        contenedor.innerHTML = html;
    },

    calcularRangoFechas(selectId = 'select-tipo-periodo') {
        const tipo = document.getElementById(selectId)?.value || 'entre_fechas';
        const formatear = (d) => d.toISOString().split('T')[0];
        let inicio = '';
        let fin = '';

        if (tipo === 'por_mes') {
            const val = document.getElementById('input-periodo-mes')?.value || '2026-08';
            const [y, m] = val.split('-').map(Number);
            inicio = `${val}-01`;
            fin = formatear(new Date(y, m, 0));
        } else if (tipo === 'entre_meses') {
            const valDesde = document.getElementById('input-periodo-mes-desde')?.value || '2026-07';
            const valHasta = document.getElementById('input-periodo-mes-hasta')?.value || '2026-08';
            const [yH, mH] = valHasta.split('-').map(Number);
            inicio = `${valDesde}-01`;
            fin = formatear(new Date(yH, mH, 0));
        } else if (tipo === 'por_fecha') {
            const val = document.getElementById('input-periodo-fecha-unica')?.value || '2026-08-30';
            inicio = val;
            fin = val;
        } else if (tipo === 'entre_fechas') {
            inicio = document.getElementById('input-periodo-fecha-desde')?.value || '2026-08-01';
            fin = document.getElementById('input-periodo-fecha-hasta')?.value || '2026-08-30';
        } else if (tipo === 'ultima_semana') {
            const dFin = new Date(2026, 7, 30);
            const dIni = new Date(dFin);
            dIni.setDate(dFin.getDate() - 7);
            inicio = formatear(dIni);
            fin = formatear(dFin);
        } else if (tipo === 'entre_semanas') {
            const valDesde = document.getElementById('input-periodo-semana-desde')?.value || '2026-W31';
            const valHasta = document.getElementById('input-periodo-semana-hasta')?.value || '2026-W35';

            const obtenerFechaSemana = (str, esFin = false) => {
                const [y, w] = str.split('-W').map(Number);
                const simple = new Date(y, 0, 1 + (w - 1) * 7);
                const dow = simple.getDay();
                const ISOweekStart = simple;
                if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
                else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
                if (esFin) ISOweekStart.setDate(ISOweekStart.getDate() + 6);
                return formatear(ISOweekStart);
            };
            inicio = obtenerFechaSemana(valDesde, false);
            fin = obtenerFechaSemana(valHasta, true);
        }

        return { fechaInicio: inicio, fechaFin: fin, inicio: inicio, fin: fin };
    },

    obtenerRangoFechas(selectId = 'select-tipo-periodo') {
        return this.calcularRangoFechas(selectId);
    }
};

window.PeriodoHelper = PeriodoHelper;