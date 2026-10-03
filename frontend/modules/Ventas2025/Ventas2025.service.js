/**
 * Servicio para el Módulo Ventas2025 (Multi-Año: 2024, 2025, 2026)
 * Conecta con el Backend (/Ventas2025/filtros y /Ventas2025/dashboard).
 */
class Ventas2025Service {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL) 
            ? AppConfig.API.BASE_URL 
            : '../../backend';
    }

    /**
     * Opciones para los selectores de filtros iniciales según el año
     */
    async obtenerFiltrosIniciales(anio = '2025') {
        try {
            const url = `${this.baseUrl}/Ventas2025/filtros?anio=${encodeURIComponent(anio)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.data) {
                    return data.data;
                }
            }
        } catch (e) {
            console.warn('No se pudieron cargar los filtros desde el backend, usando valores por defecto:', e);
        }

        return {
            provincias: [
                { id: 'AREQUIPA', label: 'AREQUIPA' },
                { id: 'CAMANA', label: 'CAMANA' },
                { id: 'CUZCO', label: 'CUZCO' },
                { id: 'ILO', label: 'ILO' },
                { id: 'LA JOYA', label: 'LA JOYA' },
                { id: 'MOLLENDO', label: 'MOLLENDO' },
                { id: 'MOQUEGUA', label: 'MOQUEGUA' },
                { id: 'PEDREGAL', label: 'PEDREGAL' },
                { id: 'TACNA', label: 'TACNA' }
            ],
            coorporativos: [],
            tdocs: [
                { id: '01', label: '01 - Factura' },
                { id: '03', label: '03 - Boleta' },
                { id: '07', label: '07 - Nota de Crédito' },
                { id: '08', label: '08 - Nota de Débito' }
            ],
            fecha_defecto: {
                inicio: `${anio}-01-01`,
                fin: `${anio}-12-31`,
                min: `${anio}-01-01`,
                max: `${anio}-12-31`
            }
        };
    }

    /**
     * Consulta los datos del Dashboard seleccionado con filtros
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/Ventas2025/dashboard`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (response.ok) {
                const resJson = await response.json();
                if (resJson && (resJson.success || resJson.status === 'success')) {
                    return resJson.payload || resJson.data || resJson;
                }
            }
            console.warn(`Respuesta no exitosa del backend (${response.status})`);
        } catch (error) {
            console.error('Error al consultar dashboard Ventas2025:', error);
        }

        return {
            status: 'error',
            titulo: 'Ventas por Coorporativo - Cliente',
            provincias: [],
            columnas_fechas: [],
            total_general: {}
        };
    }
}
