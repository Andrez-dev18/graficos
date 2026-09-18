/**
 * Helper Genérico y Profesional para Exportación a Excel (.xlsx) con Estilos Visuales
 * Soporta xlsx-js-style (Cabeceras azules bg-blue-600 con texto blanco, bordes y formatos numéricos)
 */
window.ExcelExportHelper = {

    /**
     * Paleta de Estilos Oficiales
     */
    ESTILOS: {
        headerPrincipal: {
            fill: { fgColor: { rgb: "2563EB" } }, // Tailwind bg-blue-600
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "1D4ED8" } },
                bottom: { style: "medium", color: { rgb: "1D4ED8" } },
                left: { style: "thin", color: { rgb: "3B82F6" } },
                right: { style: "thin", color: { rgb: "3B82F6" } }
            }
        },
        headerSecundario: {
            fill: { fgColor: { rgb: "1D4ED8" } }, // Tailwind bg-blue-700
            font: { name: "Segoe UI", sz: 9.5, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "1E40AF" } },
                bottom: { style: "thin", color: { rgb: "1E40AF" } },
                left: { style: "thin", color: { rgb: "3B82F6" } },
                right: { style: "thin", color: { rgb: "3B82F6" } }
            }
        },
        headerTerciario: {
            fill: { fgColor: { rgb: "1E40AF" } }, // Tailwind bg-blue-800
            font: { name: "Segoe UI", sz: 9, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { vertical: "center", horizontal: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "172554" } },
                bottom: { style: "thin", color: { rgb: "172554" } },
                left: { style: "thin", color: { rgb: "2563EB" } },
                right: { style: "thin", color: { rgb: "2563EB" } }
            }
        },
        dataCellLeft: {
            font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: "left" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        },
        dataCellRight: {
            font: { name: "Segoe UI", sz: 9.5, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        },
        footerCell: {
            fill: { fgColor: { rgb: "F1F5F9" } }, // Tailwind bg-slate-100
            font: { name: "Segoe UI", sz: 10, bold: true, color: { rgb: "0F172A" } },
            alignment: { vertical: "center", horizontal: "right" },
            border: {
                top: { style: "medium", color: { rgb: "94A3B8" } },
                bottom: { style: "medium", color: { rgb: "94A3B8" } },
                left: { style: "thin", color: { rgb: "CBD5E1" } },
                right: { style: "thin", color: { rgb: "CBD5E1" } }
            }
        }
    },

    /**
     * Exporta una tabla HTML a un archivo Excel (.xlsx) con estilos completos
     * @param {string|HTMLTableElement} tableIdOrElement - ID o elemento <table> del DOM
     * @param {string} nombreArchivo - Nombre base del archivo
     * @param {Object} options - Opciones opcionales
     */
    exportarTabla(tableIdOrElement, nombreArchivo = 'Reporte', options = {}) {
        if (typeof XLSX === 'undefined') {
            console.error('Librería XLSX no disponible.');
            alert('Error: La librería de exportación a Excel no está disponible.');
            return;
        }

        const table = typeof tableIdOrElement === 'string' 
            ? document.getElementById(tableIdOrElement) 
            : tableIdOrElement;

        if (!table) {
            console.warn('Tabla no encontrada para exportar a Excel:', tableIdOrElement);
            return;
        }

        const nombreHoja = options.nombreHoja || 'Datos';
        const incluirFecha = options.incluirFecha !== false;

        // Determinar número de filas de cabecera y de pie
        const thead = table.querySelector('thead');
        const tfoot = table.querySelector('tfoot');
        const theadRowsCount = thead ? thead.querySelectorAll('tr').length : 0;
        const tfootRowsCount = tfoot ? tfoot.querySelectorAll('tr').length : 0;

        // Clonar la tabla para no modificar visualmente la interfaz del usuario
        const clone = table.cloneNode(true);

        // Limpiar elementos que no deben ir a Excel
        clone.querySelectorAll('.no-export, .hidden, svg, button').forEach(el => el.remove());

        // Sanitizar y parsear números en cada celda
        clone.querySelectorAll('td, th').forEach(cell => {
            let txt = cell.innerText.trim();

            if (txt === '-' || txt === '—' || txt === '') {
                cell.innerText = '';
                return;
            }

            const isPercent = txt.endsWith('%');
            let clean = txt.replace(/S\/\s?/g, '').replace(/%/g, '').replace(/\s+/g, '');

            // Formato estándar peruano: 1.234,56 o 0,270
            if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(clean)) {
                clean = clean.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) {
                    cell.innerText = isPercent ? (num / 100).toString() : num.toString();
                    cell.setAttribute('data-t', 'n');
                }
            } else if (/^-?\d+(,\d+)?$/.test(clean)) {
                clean = clean.replace(',', '.');
                const num = parseFloat(clean);
                if (!isNaN(num)) {
                    cell.innerText = isPercent ? (num / 100).toString() : num.toString();
                    cell.setAttribute('data-t', 'n');
                }
            }
        });

        // Convertir la tabla clonada a hoja de cálculo SheetJS
        const ws = XLSX.utils.table_to_sheet(clone, {
            raw: false,
            cellDates: true,
            display: true
        });

        if (!ws['!ref']) return;

        const range = XLSX.utils.decode_range(ws['!ref']);
        const totalRows = range.e.r - range.s.r + 1;
        const tfootStartRow = totalRows - tfootRowsCount;

        // Aplicar Estilos Celda por Celda
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const isTheadRow = (R < theadRowsCount);
            const isTfootRow = (tfootRowsCount > 0 && R >= tfootStartRow);

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                let cell = ws[cellAddr];

                // Si la celda no existe (por merge), crear objeto vacío para bordes/fondos continuos
                if (!cell) {
                    cell = { t: 's', v: '' };
                    ws[cellAddr] = cell;
                }

                if (isTheadRow) {
                    if (R === 0) {
                        cell.s = { ...this.ESTILOS.headerPrincipal };
                    } else if (R === 1) {
                        cell.s = { ...this.ESTILOS.headerSecundario };
                    } else {
                        cell.s = { ...this.ESTILOS.headerTerciario };
                    }
                } else if (isTfootRow) {
                    cell.s = { ...this.ESTILOS.footerCell };
                    if (C === 0) {
                        cell.s.alignment = { vertical: "center", horizontal: "left" };
                    }
                } else {
                    // Celdas de datos normales
                    const isNum = (cell.t === 'n');
                    cell.s = isNum ? { ...this.ESTILOS.dataCellRight } : { ...this.ESTILOS.dataCellLeft };
                }
            }
        }

        // Calcular anchos de columna automáticos (Auto-Fit Columns)
        const colWidths = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            let maxLen = 10;
            for (let R = range.s.r; R <= range.e.r; ++R) {
                const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = ws[cellAddr];
                if (cell && cell.v) {
                    const strLen = cell.v.toString().length;
                    if (strLen > maxLen) maxLen = strLen;
                }
            }
            colWidths.push({ wch: Math.min(maxLen + 4, 45) });
        }
        ws['!cols'] = colWidths;

        // Configurar alturas de fila de cabecera
        const rowHeights = [];
        for (let R = range.s.r; R <= range.e.r; ++R) {
            if (R < theadRowsCount) {
                rowHeights.push({ hpt: 26 });
            } else {
                rowHeights.push({ hpt: 20 });
            }
        }
        ws['!rows'] = rowHeights;

        // Crear libro y agregar la hoja
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, nombreHoja);

        // Nombre de archivo con timestamp
        const fechaSufijo = incluirFecha ? `_${new Date().toISOString().slice(0, 10)}` : '';
        const cleanName = nombreArchivo.replace(/[\\/*?:"<>|]/g, '_').trim();
        const fullFileName = `${cleanName}${fechaSufijo}.xlsx`;

        // Descargar archivo Excel con estilos nativos
        XLSX.writeFile(wb, fullFileName);
    },

    /**
     * Retorna el HTML de un botón verde estilizado de Excel
     * @param {string} btnId - ID del botón
     * @param {string} texto - Texto del botón (por defecto 'Excel')
     */
    getBotonHtml(btnId = 'btn-export-excel', texto = 'Excel') {
        return `
            <button id="${btnId}" type="button"
                class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer shadow-2xs">
                <svg class="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
                    <path d="M8.5 17.5l2.25-3.5L8.5 10.5h1.75l1.375 2.25 1.375-2.25h1.75l-2.25 3.5 2.25 3.5h-1.75L11.625 15.25 10.25 17.5z"/>
                </svg>
                <span>${texto}</span>
            </button>
        `;
    }
};
