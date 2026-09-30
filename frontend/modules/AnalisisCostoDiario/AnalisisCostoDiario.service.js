/**
 * Servicio para el Módulo AnalisisCostoDiario
 * Conecta con el Backend (/AnalisisCostoDiario/filtros y /AnalisisCostoDiario/dashboard).
 */
class AnalisisCostoDiarioService {
    constructor() {
        this.baseUrl = (typeof AppConfig !== 'undefined' && AppConfig.API && AppConfig.API.BASE_URL) 
            ? AppConfig.API.BASE_URL 
            : '../../backend';
    }

    /**
     * Opciones para los selectores de filtros iniciales
     */
    async obtenerFiltrosIniciales() {
        try {
            const res = await fetch(`${this.baseUrl}/AnalisisCostoDiario/filtros`);
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
            tipos: [
                { id: '21 PRE INICIO',    label: '21 PRE INICIO' },
                { id: '22 INICIO',        label: '22 INICIO' },
                { id: '23 ACABADO 1',     label: '23 ACABADO 1' },
                { id: '24 ACABADO 2',     label: '24 ACABADO 2' },
                { id: '25 TERMINADOR',    label: '25 TERMINADOR' },
                { id: '26 FINALIZADOR',   label: '26 FINALIZADOR' },
                { id: '27 FINALIZADOR 2', label: '27 FINALIZADOR 2' }
            ],
            fecha_defecto: {
                inicio: '2026-02-19',
                fin: '2026-03-21',
                min: '2024-01-01',
                max: '2026-12-31'
            },
            dashboards: [
                { id: 'CostoFormulaPorTipoAABB', label: 'Costo Formula Por Tipo AABB' },
                { id: 'CostoFormula-Insumos',    label: 'Costo Formula - Insumos' },
                { id: 'RevisionInsumos',         label: 'Revisión Insumos' },
                { id: 'RevisionAlimento',        label: 'Revisión Alimento' }
            ]
        };
    }

    /**
     * Consulta los datos del Dashboard seleccionado con filtros
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/AnalisisCostoDiario/dashboard`;
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
            console.error('Error al consultar dashboard AnalisisCostoDiario:', error);
        }

        return {
            status: 'error',
            titulo: 'Costo Formula Por Tipo AABB',
            alimento_general: [],
            alimento_detalle: [],
            resumen_general: {}
        };
    }
}
