/**
 * ModalSchemas
 * Módulo desacoplado para gestionar las definiciones de columnas y el renderizado dinámico 
 * de las tablas de Resumen y Datos Completos en el modal "Ver datos" estilo Tableau.
 */
const ModalSchemas = {
    /**
     * Definiciones de esquemas por tipo de gráfico
     */
    schemas: {
        // 1. Gráfico de Barras por Cliente
        'saltosXcobrarXbarra': {
            resumen: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-semibold' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ],
            detalle: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-medium' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left', nowrap: true },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'codcliente', label: 'codcliente', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'nomcliente', label: 'nomcliente', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'condicionpago', label: 'condicionpago', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'numerodoc', label: 'numerodoc', align: 'left', nowrap: true, fontClass: 'font-mono text-slate-600' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        },

        // 2. Gráfico de Líneas por Zona Fiscal
        '02SalxCobrarxZona': {
            resumen: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-semibold' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left', fontClass: 'font-bold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ],
            detalle: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-medium' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left', fontClass: 'font-semibold text-slate-700' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left', nowrap: true },
                { key: 'decision', label: 'decision', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'observacion', label: 'observacion', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'vencimiento', label: 'vencimiento', align: 'left', nowrap: true, fontClass: 'font-semibold text-slate-700' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        },

        // 3. Gráfico 08IndAnticipos (Indicador Porcentaje)
        '08IndAnticipos': {
            resumen: [
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left' },
                { key: 'ratio_cobranza', label: 'ROUND((sum([saldoinicial])-sum([saldofinal]))/sum([saldoinici...', align: 'right', format: 'ratio6', fontClass: 'font-semibold text-slate-900' }
            ],
            detalle: [
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left', nowrap: true },
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono' },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'resta_saldo', label: 'ROUND((sum([saldoinicial])-sum([saldofinal])),2)', align: 'right', format: 'currency', fontClass: 'font-mono' },
                { key: 'ratio_cobranza', label: 'ROUND((sum([saldoinicial])-sum([saldofinal]))/sum([saldoinici...', align: 'right', format: 'ratio5', fontClass: 'font-mono' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' },
                { key: 'saldoinicial', label: 'saldoinicial', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        }
    },

    /**
     * Obtiene el esquema correspondiente al tipo de gráfico.
     * Si no existe, retorna el de barras por defecto.
     */
    getSchema(tipoGrafico) {
        return this.schemas[tipoGrafico] || this.schemas['saltosXcobrarXbarra'];
    },

    /**
     * Renderiza dinámicamente las cabeceras <thead> de la tabla
     */
    renderThead(theadEl, columnas, esSticky = false) {
        if (!theadEl) return;
        const stickyClasses = esSticky ? 'sticky top-0 z-10' : '';
        const bgClasses = 'bg-blue-600 text-white font-bold uppercase tracking-wider text-[10px]';

        theadEl.innerHTML = `
            <tr class="${stickyClasses} ${bgClasses}">
                ${columnas.map((col, idx) => {
                    const isLast = idx === columnas.length - 1;
                    const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
                    const borderClass = isLast ? '' : 'border-r border-blue-500';
                    return `<th class="px-4 py-3 ${alignClass} ${borderClass} bg-blue-600 whitespace-nowrap">${col.label}</th>`;
                }).join('')}
            </tr>
        `;
    },

    /**
     * Formatea el valor de una celda según su configuración
     */
    formatearValor(val, col, row, helpers) {
        if (col.format === 'currency') {
            return helpers && helpers.formatearNumero ? helpers.formatearNumero(val, true) : val;
        }
        if (col.format === 'shortDate') {
            return helpers && helpers.formatearFechaCorta ? helpers.formatearFechaCorta(val) : val;
        }
        if (col.format === 'fullDate') {
            return helpers && helpers.formatearFecha ? helpers.formatearFecha(val) : val;
        }
        if (col.format === 'ratio6') {
            const num = Number(val);
            if (isNaN(num)) return '0,000000';
            return num.toFixed(6).replace('.', ',');
        }
        if (col.format === 'ratio5') {
            const num = Number(val);
            if (isNaN(num)) return '0,00000';
            return num.toFixed(5).replace('.', ',');
        }
        return (val !== null && val !== undefined && val !== '') ? val : '-';
    },

    /**
     * Renderiza dinámicamente el cuerpo <tbody> para la pestaña Resumen (1 fila)
     */
    renderResumenTbody(tbodyEl, columnas, dataRow, helpers) {
        if (!tbodyEl) return;
        if (!dataRow) {
            tbodyEl.innerHTML = `<tr><td colspan="${columnas.length}" class="px-4 py-6 text-center text-slate-400">Sin datos de resumen.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = `
            <tr class="hover:bg-slate-50 transition-colors">
                ${columnas.map((col, idx) => {
                    const isLast = idx === columnas.length - 1;
                    const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
                    const borderClass = isLast ? '' : 'border-r border-slate-200';
                    const fontClass = col.fontClass || '';
                    const nowrapClass = col.nowrap ? 'whitespace-nowrap' : '';
                    const valor = this.formatearValor(dataRow[col.key], col, dataRow, helpers);

                    return `<td class="px-4 py-3 ${alignClass} ${borderClass} ${fontClass} ${nowrapClass}">${valor}</td>`;
                }).join('')}
            </tr>
        `;
    },

    /**
     * Renderiza dinámicamente el cuerpo <tbody> para Datos Completos
     */
    renderDetalleTbody(tbodyEl, columnas, filas, helpers) {
        if (!tbodyEl) return;
        if (!filas || filas.length === 0) {
            tbodyEl.innerHTML = `<tr><td colspan="${columnas.length}" class="px-4 py-6 text-center text-slate-400">No se encontraron datos para este registro.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = filas.map(item => `
            <tr class="hover:bg-slate-50 transition-colors">
                ${columnas.map((col, idx) => {
                    const isLast = idx === columnas.length - 1;
                    const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
                    const borderClass = isLast ? '' : 'border-r border-slate-200';
                    const fontClass = col.fontClass || '';
                    const nowrapClass = col.nowrap ? 'whitespace-nowrap' : '';
                    const valor = this.formatearValor(item[col.key], col, item, helpers);

                    return `<td class="px-4 py-2.5 ${alignClass} ${borderClass} ${fontClass} ${nowrapClass}">${valor}</td>`;
                }).join('')}
            </tr>
        `).join('');
    },

    /**
     * Renderiza dinámicamente el pie de tabla <tfoot> con el total y colspan automático
     */
    renderTfoot(tfootEl, columnas, totalSaldofinal, helpers) {
        if (!tfootEl) return;
        const totalCols = columnas.length;
        const colspanLabel = Math.max(1, totalCols - 1);
        const totalFormatted = helpers && helpers.formatearNumero ? helpers.formatearNumero(totalSaldofinal, true) : totalSaldofinal;

        tfootEl.innerHTML = `
            <tr class="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 shadow-md font-bold text-slate-800">
                <td colspan="${colspanLabel}" class="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-slate-600 border-r border-slate-200">
                    Total Saldo Final:
                </td>
                <td class="px-4 py-3 text-right text-xs font-bold text-blue-700 whitespace-nowrap">
                    ${totalFormatted}
                </td>
            </tr>
        `;
    }
};
