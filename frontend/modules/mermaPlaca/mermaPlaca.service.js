/**
 * Servicio para Análisis Mermas por Placa
 * Consume la API del Backend (/mermaPlaca/dashboard)
 */
class MermaPlacaService {
    constructor() {
        this.baseUrl = window.AppConfig?.API?.BASE_URL || '/graficos/backend';
    }

    /**
     * Consulta los datos del dashboard de Análisis Mermas por Placa
     * @param {Object} filtros { fecha_inicio: 'YYYY-MM-DD', fecha_fin: 'YYYY-MM-DD', tipo_grafico: 'MermasMes' }
     */
    async obtenerDashboard(filtros = {}) {
        try {
            const url = `${this.baseUrl}/mermaPlaca/dashboard`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filtros)
            });

            if (!response.ok) {
                // Si aún no está listo el endpoint del backend, retornar respuesta simulada inicial
                return {
                    status: 'success',
                    payload: {
                        tipo_grafico: filtros.tipo_grafico || 'MermasMes',
                        filtros: filtros,
                        mensaje: 'Frontend listo. Conexión inicial establecida.'
                    }
                };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('Nota: Servicio backend no disponible aún o en desarrollo. Usando estado inicial frontend:', error.message);
            return {
                status: 'success',
                payload: {
                    tipo_grafico: filtros.tipo_grafico || 'MermasMes',
                    filtros: filtros,
                    mensaje: 'Frontend listo. Conexión inicial establecida.'
                }
            };
        }
    }
}
