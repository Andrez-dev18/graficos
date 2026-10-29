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
        },

        // 3.1 Gráfico 08IndAnticipos para pistas de montos (saldoinicial, resta, saldofinal)
        '08IndAnticipos_montos': {
            resumen: [
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left' },
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono font-semibold' },
                { key: 'resta_saldo', label: 'ROUND((sum([saldoinicial])-sum([saldofinal])),2)', align: 'right', format: 'currency', fontClass: 'font-mono font-semibold text-slate-900' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' },
                { key: 'saldoinicial', label: 'saldoinicial', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
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
        },

        // 4. Gráfico 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cobrar por Cuenta de Venta)
        '20DashAnalisisCtasMaxDeudoresDocs': {
            resumen: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono font-semibold text-slate-800' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ],
            detalle: [
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left', nowrap: true },
                { key: 'condicionpago', label: 'condicionpago', align: 'left', nowrap: true, fontClass: 'text-slate-700' },
                { key: 'fechacontable', label: 'fechacontable', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-600' },
                { key: 'horacreacion', label: 'horacreacion', align: 'left', nowrap: true, format: 'dateTime', fontClass: 'text-slate-600' },
                { key: 'numerodoc', label: 'numerodoc', align: 'left', nowrap: true, fontClass: 'font-mono text-slate-700' },
                { key: 'nomcliente', label: 'nomcliente', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'nomcorporativo', label: 'nomcorporativo', align: 'left', fontClass: 'text-slate-700' },
                { key: 'decision', label: 'decision', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'observacion', label: 'observacion', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'vencimiento', label: 'vencimiento', align: 'left', nowrap: true, fontClass: 'font-semibold text-slate-700' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        },

        // 5. Gráfico 18CorporativosZonaDeudores (Corporativos más deudores por zona fiscal)
        '18CorporativosZonaDeudores': {
            resumen: [
                { key: 'nomcorporativo', label: 'nomcorporativo', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left', fontClass: 'font-semibold text-slate-700' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ],
            detalle: [
                { key: 'nomcorporativo', label: 'nomcorporativo', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left', fontClass: 'font-semibold text-slate-700' },
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono' },
                { key: 'decision', label: 'decision', align: 'left', nowrap: true, fontClass: 'text-slate-600' },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'numerodoc', label: 'numerodoc', align: 'left', nowrap: true, fontClass: 'font-mono text-slate-700' },
                { key: 'vencimiento', label: 'vencimiento', align: 'left', nowrap: true, fontClass: 'font-semibold text-slate-700' },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        },

        // 5.1 Gráfico 10IndSalxCobrarxCtaxFechaDocSegmentado
        '10IndSalxCobrarxCtaxFechaDocSegmentado': {
            resumen: [
                { key: 'condicionpago', label: 'condicionpago', align: 'left', fontClass: 'font-semibold' },
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono' },
                { key: 'dia_fechacarga', label: 'Día de fechacarga', align: 'left', format: 'fullDate' },
                { key: 'dia_fechacontable', label: 'Día de fechacontable', align: 'left', format: 'fullDate' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left', fontClass: 'font-semibold text-slate-800' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left' },
                { key: 'ratio_cobranza', label: 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', align: 'right', format: 'ratio6', fontClass: 'font-mono', headerWrap: true },
                { key: 'ratio_cobranza_2', label: 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', align: 'right', format: 'ratio6', fontClass: 'font-mono', headerWrap: true }
            ],
            detalle: [
                { key: 'codcliente', label: 'codcliente', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'codcondpago', label: 'codcondpago', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'codcorporativo', label: 'codcorporativo', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'coddoc', label: 'coddoc', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'codzonaventa', label: 'codzonaventa', align: 'left', fontClass: 'font-mono text-slate-600' },
                { key: 'condicionpago', label: 'condicionpago', align: 'left' },
                { key: 'cuentaventa', label: 'cuentaventa', align: 'left', fontClass: 'font-mono' },
                { key: 'decision', label: 'decision', align: 'left' },
                { key: 'fechacarga', label: 'fechacarga', align: 'left', format: 'shortDatePadded', nowrap: true },
                { key: 'fechacontable', label: 'fechacontable', align: 'left', format: 'shortDatePadded', nowrap: true },
                { key: 'fechacreacion', label: 'fechacreacion', align: 'left', format: 'shortDatePadded', nowrap: true },
                { key: 'fechaproceso', label: 'fechaproceso', align: 'left', format: 'shortDatePadded', nowrap: true },
                { key: 'fechavencimiento', label: 'fechavencimiento', align: 'left', format: 'shortDatePadded', nowrap: true },
                { key: 'horacreacion', label: 'horacreacion', align: 'left', format: 'dateTimePadded', nowrap: true },
                { key: 'nomcliente', label: 'nomcliente', align: 'left' },
                { key: 'nomcorporativo', label: 'nomcorporativo', align: 'left' },
                { key: 'nomcuentaventa', label: 'nomcuentaventa', align: 'left' },
                { key: 'nomdoc', label: 'nomdoc', align: 'left' },
                { key: 'numdocref', label: 'numdocref', align: 'left', fontClass: 'font-mono' },
                { key: 'numeroalfdoc', label: 'numeroalfdoc', align: 'left', fontClass: 'font-mono' },
                { key: 'numerodoc', label: 'numerodoc', align: 'left', fontClass: 'font-mono' },
                { key: 'observacion', label: 'observacion', align: 'left' },
                { key: 'seriealfdoc', label: 'seriealfdoc', align: 'left', fontClass: 'font-mono' },
                { key: 'seriealfref', label: 'seriealfref', align: 'left', fontClass: 'font-mono' },
                { key: 'subzonaventa', label: 'subzonaventa', align: 'left' },
                { key: 'tipdocref', label: 'tipdocref', align: 'left', fontClass: 'font-mono' },
                { key: 'vencimiento', label: 'vencimiento', align: 'left' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left' },
                { key: 'zonaventa', label: 'zonaventa', align: 'left' },
                { key: 'diasporvencer', label: 'diasporvencer', align: 'right', format: 'currency' },
                { key: 'importe', label: 'importe', align: 'right', format: 'currency' },
                { key: 'numero_registros', label: 'Número de registros', align: 'right' },
                { key: 'ratio_cobranza', label: 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', align: 'right', format: 'ratio6', fontClass: 'font-mono', headerWrap: true },
                { key: 'ratio_cobranza', label: 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', align: 'right', format: 'ratio6', fontClass: 'font-mono', headerWrap: true },
                { key: 'saldofinal', label: 'saldofinal', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' },
                { key: 'saldoinicial', label: 'saldoinicial', align: 'right', format: 'currency', fontClass: 'font-bold text-slate-900' }
            ]
        },

        // 6. Gráfico 07VentasSacCoor (Ventas y Devoluciones Resumen / Completos)
        '07VentasSacCoor': {
            resumen: [
                { key: 'lineaproceso', label: 'lineaproceso', align: 'left', fontClass: 'font-medium' },
                { key: 'dia_fechaproceso', label: 'Día de fechaproceso', align: 'left', nowrap: true },
                { key: 'ratio_dev', label: 'SUM([cantidaddevolucion])/SUM([cantidadventa])', align: 'right', format: 'ratio8', fontClass: 'font-medium' },
                { key: 'cantidad', label: 'cantidad', align: 'right', format: 'currency', fontClass: 'font-medium' }
            ],
            detalle: [
                { key: 'lineaproceso', label: 'lineaproceso', align: 'left', fontClass: 'font-medium' },
                { key: 'dia_fechaproceso', label: 'Día de fechaproceso', align: 'left', nowrap: true },
                { key: 'tipo_doc', label: 'iF [coddoc]="01" OR [codc', align: 'left', nowrap: true },
                { key: 'coditem', label: 'coditem', align: 'left', fontClass: 'font-mono' },
                { key: 'nomcorporativo', label: 'nomcorporativo', align: 'left', fontClass: 'font-medium' },
                { key: 'nomdevolucion', label: 'nomdevolucion', align: 'left' },
                { key: 'nomdoc', label: 'nomdoc', align: 'left' },
                { key: 'nomitem', label: 'nomitem', align: 'left' },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left' },
                { key: 'fechaproceso', label: 'fechaproceso', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'item', label: 'Item', align: 'left' },
                { key: 'coddoc', label: 'coddoc', align: 'left', fontClass: 'font-mono' },
                { key: 'cantidad', label: 'cantidad', align: 'right', format: 'currency4' },
                { key: 'cantidaddevolucion', label: 'cantidaddevolucion', align: 'right', format: 'currency4' },
                { key: 'cantidadventa', label: 'cantidadventa', align: 'right', format: 'currency4' },
                { key: 'sum_ratio', label: 'SUM([cantidaddevolucion', align: 'right' }
            ]
        },

        // 7. Gráfico 06VentasSaca (Ventas SACA Resumen / Completos)
        '06VentasSaca': {
            resumen: [
                { key: 'lineaproceso', label: 'lineaproceso', align: 'left', fontClass: 'font-medium' },
                { key: 'dia_fechaproceso', label: 'Día de fechaproceso', align: 'left', nowrap: true },
                { key: 'ratio_dev', label: 'SUM([cantidaddevolucion])/SUM([cantidadventa])', align: 'right', format: 'ratio8', fontClass: 'font-medium' },
                { key: 'cantidad', label: 'cantidad', align: 'right', format: 'currency', fontClass: 'font-medium' }
            ],
            detalle: [
                { key: 'lineaproceso', label: 'lineaproceso', align: 'left', fontClass: 'font-medium' },
                { key: 'dia_fechaproceso', label: 'Día de fechaproceso', align: 'left', nowrap: true },
                { key: 'tipo_doc', label: 'iF [coddoc]="01" OR [codd', align: 'left', nowrap: true },
                { key: 'zonafiscal', label: 'zonafiscal', align: 'left' },
                { key: 'familia', label: 'familia', align: 'left' },
                { key: 'fechaproceso', label: 'fechaproceso', align: 'left', nowrap: true, format: 'shortDate', fontClass: 'text-slate-500' },
                { key: 'item', label: 'Item', align: 'left' },
                { key: 'coddoc', label: 'coddoc', align: 'left', fontClass: 'font-mono' },
                { key: 'coditem', label: 'coditem', align: 'left', fontClass: 'font-mono' },
                { key: 'nomitem', label: 'nomitem', align: 'left' },
                { key: 'cantidad', label: 'cantidad', align: 'right', format: 'currency4' },
                { key: 'cantidaddevolucion', label: 'cantidaddevolucion', align: 'right', format: 'currency4' },
                { key: 'cantidadventa', label: 'cantidadventa', align: 'right', format: 'currency4' },
                { key: 'sum_ratio', label: 'SUM([cantidaddevolucion', align: 'right' }
            ]
        }
    },

    /**
     * Obtiene el esquema correspondiente al tipo de gráfico y métrica.
     * Si no existe, retorna el de barras por defecto.
     */
    getSchema(tipoGrafico, metrica = '') {
        if (tipoGrafico === '08IndAnticipos') {
            if (metrica && metrica !== 'porcentaje_cobranza') {
                return this.schemas['08IndAnticipos_montos'];
            }
            return this.schemas['08IndAnticipos'];
        }
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
                    return `<th class="px-4 py-3 ${alignClass} ${borderClass} bg-blue-600 ${col.headerWrap ? '' : 'whitespace-nowrap'}">${col.label}</th>`;
                }).join('')}
            </tr>
        `;
    },

    /**
     * Formatea el valor de una celda según su configuración
     */
    formatearValor(val, col, row, helpers) {
        if (col.format === 'currency') {
            const num = (val !== null && val !== undefined && val !== '') ? val : 0;
            return helpers && helpers.formatearNumero ? helpers.formatearNumero(num, true) : num;
        }
        if (col.format === 'currency4') {
            const num = (val !== null && val !== undefined && val !== '') ? Number(val) : 0;
            const validNum = isNaN(num) ? 0 : num;
            return validNum.toLocaleString('es-PE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        }
        if (col.format === 'shortDate') {
            return helpers && helpers.formatearFechaCorta ? helpers.formatearFechaCorta(val) : (val || '');
        }
        if (col.format === 'shortDatePadded') {
            return helpers && helpers.formatearFechaCortaPadded ? helpers.formatearFechaCortaPadded(val) : (val || '');
        }
        if (col.format === 'dateTimePadded') {
            if (!val) return '';
            return helpers && helpers.formatearFechaHoraPadded ? helpers.formatearFechaHoraPadded(val) : val;
        }
        if (col.format === 'fullDate') {
            return helpers && helpers.formatearFecha ? helpers.formatearFecha(val) : (val || '');
        }
        if (col.format === 'dateTime') {
            if (!val) return '';
            // Formato Tableau: D/M/YYYY H:mm:ss
            const partes = String(val).trim().split(' ');
            if (partes.length === 2 && partes[0].includes('-')) {
                const [y, m, d] = partes[0].split('-').map(Number);
                return `${d}/${m}/${y} ${partes[1]}`;
            }
            return val;
        }
        if (col.format === 'ratio8') {
            const num = Number(val);
            if (isNaN(num)) return '0,00000000';
            return num.toFixed(8).replace('.', ',');
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
        return (val !== null && val !== undefined) ? String(val) : '';
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
    },

    renderTfootDoble(tfootEl, columnas, totales, helpers) {
        if (!tfootEl) return;

        const totalCols = columnas.length;
        const idxSaldoFinal = columnas.findIndex(col => col.key === 'saldofinal');
        const idxSaldoInicial = columnas.findIndex(col => col.key === 'saldoinicial');
        if (idxSaldoFinal < 0 || idxSaldoInicial < 0) return;

        const firstTotal = Math.min(idxSaldoFinal, idxSaldoInicial);
        const colspanLabel = Math.max(1, firstTotal);
        const fmt = (valor) => helpers && helpers.formatearNumero ? helpers.formatearNumero(valor, true) : valor;

        const celdas = [];
        celdas.push(`<td colspan="${colspanLabel}" class="px-4 py-2 text-right uppercase tracking-wider text-[10px] text-slate-600 border-r border-slate-200">Totales:</td>`);

        for (let i = firstTotal; i < totalCols; i++) {
            const col = columnas[i];
            if (col.key === 'saldofinal') {
                celdas.push(`
                    <td class="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">
                        <span class="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Total Saldo Final</span>
                        <span class="text-xs font-bold text-blue-700">${fmt(totales.saldofinal)}</span>
                    </td>
                `);
            } else if (col.key === 'saldoinicial') {
                celdas.push(`
                    <td class="px-3 py-2 text-right whitespace-nowrap">
                        <span class="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">Total Saldo Inicial</span>
                        <span class="text-xs font-bold text-blue-700">${fmt(totales.saldoinicial)}</span>
                    </td>
                `);
            } else {
                celdas.push(`<td class="px-3 py-2 border-r border-slate-200"></td>`);
            }
        }

        tfootEl.innerHTML = `
            <tr class="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 shadow-md font-bold text-slate-800">
                ${celdas.join('')}
            </tr>
        `;
    }
};
