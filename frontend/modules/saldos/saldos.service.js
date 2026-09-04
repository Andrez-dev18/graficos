class saldosService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL)
            ? AppConfig.API.BASE_URL
            : '';
    }

    ENDPOINTS = {
        FILTROS: '/saldosxCobrar/filtros-barra',
        GRAFICODATA: '/saldosxCobrar/grafico-barra',
        DETALLE: '/saldosxCobrar/detalle',

        // Gráfico de Líneas por Zona
        FILTROS_LINEA: '/saldosxCobrar/filtros-linea',
        GRAFICO_LINEA: '/saldosxCobrar/grafico-linea',

        // Gráfico de Anticipos
        GRAFICO_ANTICIPOS: '/saldosxCobrar/grafico-anticipos',

        // Gráfico 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
        GRAFICO_ANALISIS_CUENTAS: '/saldosxCobrar/grafico-analisis-cuentas',
        ANALISIS_CORPORATIVOS: '/saldosxCobrar/analisis-corporativos',

        // Gráfico 18CorporativosZonaDeudores
        CORPORATIVOS_ZONA_DEUDORES: '/saldosxCobrar/corporativos-zona-deudores',

        EXPORTAR_EXCEL: '/saldosxCobrar/exportar-detalle-excel'
    };

    /**
     * Obtiene las opciones de los filtros (cuentas y clientes)
     */
    async obtenerFiltros() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al obtener filtros en saldosService:', error);
            throw error;
        }
    }

    /**
     * Envía los filtros seleccionados y obtiene la data procesada para las gráficas
     * @param {Object} filtros { fecha_inicio, fecha_fin, cuentas, clientes }
     */
    async obtenerGraficoData(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICODATA}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error al obtener datos del gráfico en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene el desglose completo para la barra seleccionada (Modal Ver Datos)
     * @param {Object} params { cuentaventa, fechacarga, clientes }
     */
    async obtenerDetalle(params) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.DETALLE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener detalle en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene los filtros específicos de la vista de líneas (vencimiento, decisión, observación)
     */
    async obtenerFiltrosLinea() {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.FILTROS_LINEA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener filtros línea en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene la data agrupada por cuenta y zona fiscal para los gráficos de líneas
     * @param {Object} filtros { fecha_inicio, fecha_fin, cuentas, vencimientos, decisiones, observaciones }
     */
    async obtenerGraficoLineaData(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICO_LINEA}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener datos línea en saldosService:', error);
            throw error;
        }
    }

    /**
     * Obtiene la data agrupada por cuenta de venta para 20DashAnalisisCtasMaxDeudoresDocs
     * @param {Object} filtros { fecha_inicio, fecha_fin, cuentas, vencimientos, decisiones, observaciones }
     */
    async obtenerGraficoAnalisisCuentas(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICO_ANALISIS_CUENTAS}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener datos análisis cuentas en saldosService:', error);
            throw error;
        }
    }

    /**
     * Envía los filtros aplicados y descarga directamente el archivo Excel generado
     * @param {Object} filtros Parámetros del modal (cuentaventa, fechacarga, zona, etc.)
     */
    async exportarExcel(filtros) {
        return this.exportarDetalleExcel(filtros);
    }

    async exportarDetalleExcel(filtros) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.EXPORTAR_EXCEL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP al exportar: ${response.status} - ${response.statusText}`);
            }

            // Procesar la respuesta binaria
            const blob = await response.blob();

            // Obtener el nombre del archivo del header o generar uno por defecto
            let filename = `Detalle_Saldos_${filtros.cuentaventa || 'cuenta'}_${filtros.fechacarga || 'fecha'}.xlsx`;
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.includes('filename=')) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            // Crear el enlace virtual y detonar la descarga
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Limpieza en memoria
            window.URL.revokeObjectURL(url);
            a.remove();

            return { success: true };
        } catch (error) {
            console.error('Error al exportar Excel en saldosService:', error);
            throw error;
        }
    }

    /**
     * Consulta las métricas agregadas para el gráfico 08IndAnticipos
     * @param {Object} payload { fecha_inicio, fecha_fin, cuentas: [] }
     */
    async obtenerGraficoAnticiposData(payload) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.GRAFICO_ANTICIPOS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP al consultar anticipos: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en saldosService.obtenerGraficoAnticiposData:', error);
            throw error;
        }
    }

    /**
     * Consulta corporativos deudores y listado de documentos para 20Dash
     * @param {Object} payload { cuentaventa, fechacarga, vencimientos: [], decisiones: [], observaciones: [] }
     */
    async obtenerAnalisisCorporativos(payload) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.ANALISIS_CORPORATIVOS}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP al consultar análisis corporativos: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en saldosService.obtenerAnalisisCorporativos:', error);
            throw error;
        }
    }

    /**
     * Consulta la matriz de corporativos más deudores por zona fiscal (18CorporativosZonaDeudores)
     * @param {Object} payload { fecha_inicio, fecha_fin, fechacarga, cuentas: [], vencimientos: [], decisiones: [], observaciones: [] }
     */
    async obtenerCorporativosZonaDeudores(payload) {
        try {
            const response = await fetch(`${this.baseUrl}${this.ENDPOINTS.CORPORATIVOS_ZONA_DEUDORES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP al consultar corporativos por zona: ${response.status} - ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en saldosService.obtenerCorporativosZonaDeudores:', error);
            throw error;
        }
    }
}

window.saldosService = saldosService;