/**
 * Servicio para el Módulo LIMA 1 EE_GGyPP
 * Provee datos quemados (mock) idénticos a Tableau y estructura para consumo de API backend.
 */
class EEGGyPPService {
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
            const res = await fetch(`${this.baseUrl}/EEGGyPP/filtros`);
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
            procesos: [
                { id: 'BENEFICIADO', label: 'BENEFICIADO', selected: true },
                { id: 'TROZADO', label: 'TROZADO', selected: false }
            ],
            provincias: [
                { id: 'AREQUIPA', label: 'AREQUIPA', selected: false }
            ],
            zonas: [
                { id: 'PACHACUTEC-MERCADOS', label: 'PACHACUTEC-MERCADOS', selected: true },
                { id: 'PACHACUTEC-PATEROS', label: 'PACHACUTEC-PATEROS', selected: false },
                { id: 'PALOMAR-HORIZONTAL', label: 'PALOMAR-HORIZONTAL', selected: false },
                { id: 'PALOMAR-TIENDA', label: 'PALOMAR-TIENDA', selected: false }
            ]
        };
    }

    /**
     * Consulta los datos del Dashboard seleccionado con filtros
     */
    async obtenerDashboard(filtros = {}) {
        const tipoGrafico = filtros.tipo_grafico || 'Dash_EEGGyPP';

        try {
            const url = `${this.baseUrl}/EEGGyPP/dashboard`;
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
            console.warn(`Respuesta no exitosa del backend (${response.status}), usando datos locales.`);
        } catch (error) {
            console.warn('Backend no disponible o error en petición, usando mock data:', error);
        }

        if (tipoGrafico === 'Dash_EEGGyPP') {
            return this.getMockDashEEGGyPP(filtros);
        }

        return {
            status: 'success',
            titulo: `${tipoGrafico} - LIMA 1 EE_GGyPP`,
            grupos: [],
            total_general: {}
        };
    }

    /**
     * Datos quemados exactos de Tableau para Dash_EEGGyPP
     */
    getMockDashEEGGyPP(filtros) {
        return {
            status: 'success',
            titulo: 'COSTO DE VENTA DEL POLLO BENEFICIADO',
            proceso_label: filtros.proceso || 'BENEFICIADO',
            provincia_label: filtros.provincia || '(Todo)',
            zona_label: filtros.zona || 'PACHACUTEC-MERCADOS',
            grupos: [
                {
                    producto: 'Primera',
                    tipos: [
                        {
                            tipo: '1 Pollo',
                            items: [
                                {
                                    codigo: 'P113',
                                    descripcion: 'POLLO CARNE BENEFICIADO',
                                    peso_venta: 486.90,
                                    importe_venta: 3593.02,
                                    precio_venta: 7.379,
                                    costo_ventas_importe: 2829.07,
                                    costo_ventas_precio: 5.810,
                                    comercial: -54.05,
                                    administrativo: -55.99,
                                    utilidad_operativa: 653.90,
                                    pct_utilidad: -14.26,
                                    pct_peso: 21.72
                                },
                                {
                                    codigo: 'P114',
                                    descripcion: 'POLLADA BENEFICIADA',
                                    peso_venta: 18.10,
                                    importe_venta: 133.45,
                                    precio_venta: 7.373,
                                    costo_ventas_importe: 98.63,
                                    costo_ventas_precio: 5.449,
                                    comercial: -2.01,
                                    administrativo: -2.08,
                                    utilidad_operativa: 30.73,
                                    pct_utilidad: -0.67,
                                    pct_peso: 0.81
                                }
                            ],
                            subtotal: {
                                peso_venta: 505.00,
                                importe_venta: 3726.47,
                                precio_venta: 7.379,
                                costo_ventas_importe: 2927.70,
                                costo_ventas_precio: 5.797,
                                comercial: -56.06,
                                administrativo: -58.08,
                                utilidad_operativa: 684.63,
                                pct_utilidad: -14.93,
                                pct_peso: 22.53
                            }
                        },
                        {
                            tipo: '2 Menudencia',
                            items: [
                                {
                                    codigo: 'PM0113',
                                    descripcion: 'PATAS DE POLLO',
                                    peso_venta: 283.55,
                                    importe_venta: 1201.48,
                                    precio_venta: 4.237,
                                    costo_ventas_importe: 535.70,
                                    costo_ventas_precio: 1.889,
                                    comercial: -31.47,
                                    administrativo: -32.61,
                                    utilidad_operativa: 601.70,
                                    pct_utilidad: -13.12,
                                    pct_peso: 12.65
                                },
                                {
                                    codigo: 'P0068',
                                    descripcion: 'HIGADO DE POLLO',
                                    peso_venta: 145.75,
                                    importe_venta: 370.97,
                                    precio_venta: 2.545,
                                    costo_ventas_importe: 283.63,
                                    costo_ventas_precio: 1.946,
                                    comercial: -16.18,
                                    administrativo: -16.76,
                                    utilidad_operativa: 54.40,
                                    pct_utilidad: -1.19,
                                    pct_peso: 6.50
                                },
                                {
                                    codigo: 'P0017',
                                    descripcion: 'CUELLO DE POLLO',
                                    peso_venta: 63.85,
                                    importe_venta: 162.33,
                                    precio_venta: 2.542,
                                    costo_ventas_importe: 118.99,
                                    costo_ventas_precio: 1.864,
                                    comercial: -7.09,
                                    administrativo: -7.34,
                                    utilidad_operativa: 28.91,
                                    pct_utilidad: -0.63,
                                    pct_peso: 2.85
                                },
                                {
                                    codigo: 'P0017V',
                                    descripcion: 'CUELLOS DE POLLO BRASA',
                                    peso_venta: 7.30,
                                    importe_venta: 15.47,
                                    precio_venta: 2.119,
                                    costo_ventas_importe: 7.48,
                                    costo_ventas_precio: 1.024,
                                    comercial: -0.81,
                                    administrativo: -0.84,
                                    utilidad_operativa: 6.34,
                                    pct_utilidad: -0.14,
                                    pct_peso: 0.33
                                },
                                {
                                    codigo: 'P118M',
                                    descripcion: 'MENUDENCIA DE POLLO MEJORADO',
                                    peso_venta: 0.70,
                                    importe_venta: 4.21,
                                    precio_venta: 6.017,
                                    costo_ventas_importe: 1.55,
                                    costo_ventas_precio: 2.214,
                                    comercial: -0.08,
                                    administrativo: -0.08,
                                    utilidad_operativa: 2.50,
                                    pct_utilidad: -0.05,
                                    pct_peso: 0.03
                                },
                                {
                                    codigo: 'P00112',
                                    descripcion: 'PATA Y PESCUEZO DE POLLO',
                                    peso_venta: 5.00,
                                    importe_venta: 16.95,
                                    precio_venta: 3.390,
                                    costo_ventas_importe: 10.94,
                                    costo_ventas_precio: 2.188,
                                    comercial: -0.56,
                                    administrativo: -0.58,
                                    utilidad_operativa: 4.88,
                                    pct_utilidad: -0.11,
                                    pct_peso: 0.22
                                }
                            ],
                            subtotal: {
                                peso_venta: 506.15,
                                importe_venta: 1771.42,
                                precio_venta: 3.500,
                                costo_ventas_importe: 958.29,
                                costo_ventas_precio: 1.893,
                                comercial: -56.18,
                                administrativo: -58.21,
                                utilidad_operativa: 698.73,
                                pct_utilidad: -15.24,
                                pct_peso: 22.58
                            }
                        }
                    ]
                },
                {
                    producto: 'Segunda',
                    tipos: [
                        {
                            tipo: '1 Pollo',
                            items: [
                                {
                                    codigo: 'P112BB',
                                    descripcion: 'POLLO CARNE BENEF. CARCAZA - BB',
                                    peso_venta: 335.10,
                                    importe_venta: 851.95,
                                    precio_venta: 2.542,
                                    costo_ventas_importe: 2115.34,
                                    costo_ventas_precio: 6.313,
                                    comercial: -37.20,
                                    administrativo: -38.54,
                                    utilidad_operativa: -1339.12,
                                    pct_utilidad: 29.20,
                                    pct_peso: 14.95
                                },
                                {
                                    codigo: 'P120BB',
                                    descripcion: 'POLLO CARNE BENEF.MEJORADO-BB',
                                    peso_venta: 40.70,
                                    importe_venta: 103.47,
                                    precio_venta: 2.542,
                                    costo_ventas_importe: 242.97,
                                    costo_ventas_precio: 5.970,
                                    comercial: -4.52,
                                    administrativo: -4.68,
                                    utilidad_operativa: -148.69,
                                    pct_utilidad: 3.24,
                                    pct_peso: 1.82
                                },
                                {
                                    codigo: 'P113BB',
                                    descripcion: 'POLLO CARNE BENEFICIADO BB',
                                    peso_venta: 21.90,
                                    importe_venta: 46.40,
                                    precio_venta: 2.119,
                                    costo_ventas_importe: 120.19,
                                    costo_ventas_precio: 5.488,
                                    comercial: -2.43,
                                    administrativo: -2.52,
                                    utilidad_operativa: -78.74,
                                    pct_utilidad: 1.72,
                                    pct_peso: 0.98
                                },
                                {
                                    codigo: '123B',
                                    descripcion: 'POLLO CARCASA RED B',
                                    peso_venta: 831.20,
                                    importe_venta: 1761.02,
                                    precio_venta: 2.119,
                                    costo_ventas_importe: 5982.55,
                                    costo_ventas_precio: 7.197,
                                    comercial: -92.26,
                                    administrativo: -95.59,
                                    utilidad_operativa: -4409.39,
                                    pct_utilidad: 96.15,
                                    pct_peso: 37.08
                                },
                                {
                                    codigo: 'P115BB',
                                    descripcion: 'POLLO BRASA BENEFICIADO-BB',
                                    peso_venta: 1.60,
                                    importe_venta: 4.07,
                                    precio_venta: 2.542,
                                    costo_ventas_importe: -2.94,
                                    costo_ventas_precio: -1.834,
                                    comercial: -0.18,
                                    administrativo: -0.18,
                                    utilidad_operativa: 6.64,
                                    pct_utilidad: -0.14,
                                    pct_peso: 0.07
                                }
                            ],
                            subtotal: {
                                peso_venta: 1230.50,
                                importe_venta: 2766.91,
                                precio_venta: 2.249,
                                costo_ventas_importe: 8458.11,
                                costo_ventas_precio: 6.874,
                                comercial: -136.59,
                                administrativo: -141.51,
                                utilidad_operativa: -5969.30,
                                pct_utilidad: 130.17,
                                pct_peso: 54.89
                            }
                        }
                    ]
                }
            ],
            total_general: {
                peso_venta: 2241.65,
                importe_venta: 8264.79,
                precio_venta: 3.687,
                costo_ventas_importe: 12344.11,
                costo_ventas_precio: 5.507,
                comercial: -248.82,
                administrativo: -257.79,
                utilidad_operativa: -4585.93,
                pct_utilidad: 100.00,
                pct_peso: 100.00
            }
        };
    }
}
