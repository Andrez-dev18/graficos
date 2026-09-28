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
                { id: 'TROZADO', label: 'TROZADO', selected: true }
            ],
            provincias: [
                { id: 'AREQUIPA', label: 'AREQUIPA', selected: true }
            ],
            zonas: [
                { id: 'PACHACUTEC-MERCADOS', label: 'PACHACUTEC-MERCADOS', selected: true },
                { id: 'PACHACUTEC-PATEROS', label: 'PACHACUTEC-PATEROS', selected: true },
                { id: 'PALOMAR-HORIZONTAL', label: 'PALOMAR-HORIZONTAL', selected: true },
                { id: 'PALOMAR-TIENDA', label: 'PALOMAR-TIENDA', selected: true }
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
        } else if (tipoGrafico === 'Dash_EEGGyPP_ASO') {
            return this.getMockDashEEGGyPP_ASO(filtros);
        } else if (tipoGrafico === 'Dash_EEGGyPP_Res_ASO') {
            return this.getMockDashEEGGyPP_Res_ASO(filtros);
        } else if (tipoGrafico === 'Dash_EEGGyPP_Huertas') {
            return this.getMockDashEEGGyPP_Huertas(filtros);
        }

        return {
            status: 'success',
            titulo: `${tipoGrafico} - LIMA 1 EE_GGyPP`,
            grupos: [],
            provincias: [],
            total_general: {}
        };
    }

    /**
     * Datos quemados exactos de Tableau para Dash_EEGGyPP_ASO
     */
    getMockDashEEGGyPP_ASO(filtros) {
        return {
            status: 'success',
            tipo_grafico: 'Dash_EEGGyPP_ASO',
            titulo: 'COSTO DE VENTA DEL POLLO BENEFICIADO',
            proceso_label: filtros.proceso || 'BENEFICIADO',
            provincia_label: filtros.provincia || 'AREQUIPA',
            zona_label: filtros.zona || '(Todo)',
            provincias: [
                {
                    provincia: 'AREQUIPA',
                    zonas: [
                        {
                            zona: 'PACHACUTEC-MERCADOS',
                            total_zona: {
                                peso_venta: 1855.45,
                                importe_venta: 9749.76,
                                precio_venta: 5.255,
                                costo_ventas_importe: 10880.41,
                                costo_ventas_precio: 5.864,
                                comercial: -205.95,
                                administrativo: -213.38,
                                utilidad_operativa: -1549.98,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        {
                                            tipo: '1 Pollo',
                                            items: [
                                                { codigo: 'P120', descripcion: 'POLLO CARNE BENEF.MEJORADO', peso_venta: 181.95, importe_venta: 1387.75, precio_venta: 7.627, costo_ventas_importe: 1090.03, costo_ventas_precio: 5.991, comercial: -20.20, administrativo: -20.92, utilidad_operativa: 256.61, pct_utilidad: -16.56, pct_peso: 9.81 },
                                                { codigo: 'P113', descripcion: 'POLLO CARNE BENEFICIADO', peso_venta: 631.05, importe_venta: 4654.60, precio_venta: 7.376, costo_ventas_importe: 4060.13, costo_ventas_precio: 6.434, comercial: -70.05, administrativo: -72.57, utilidad_operativa: 451.85, pct_utilidad: -29.15, pct_peso: 34.01 },
                                                { codigo: 'P114', descripcion: 'POLLADA BENEFICIADA', peso_venta: 61.70, importe_venta: 454.91, precio_venta: 7.373, costo_ventas_importe: 410.19, costo_ventas_precio: 6.648, comercial: -6.85, administrativo: -7.10, utilidad_operativa: 30.77, pct_utilidad: -1.99, pct_peso: 3.33 },
                                                { codigo: 'P115', descripcion: 'POLLO BRASA BENEFICIADO', peso_venta: 6.85, importe_venta: 62.69, precio_venta: 9.153, costo_ventas_importe: 49.12, costo_ventas_precio: 7.170, comercial: -0.76, administrativo: -0.79, utilidad_operativa: 12.03, pct_utilidad: -0.78, pct_peso: 0.37 }
                                            ],
                                            subtotal: { peso_venta: 881.55, importe_venta: 6559.95, precio_venta: 7.441, costo_ventas_importe: 5609.46, costo_ventas_precio: 6.363, comercial: -97.85, administrativo: -101.38, utilidad_operativa: 751.26, pct_utilidad: -48.47, pct_peso: 47.51 }
                                        },
                                        {
                                            tipo: '2 Menudencia',
                                            items: [
                                                { codigo: 'PM0113', descripcion: 'PATAS DE POLLO', peso_venta: 186.45, importe_venta: 1106.06, precio_venta: 5.932, costo_ventas_importe: 397.90, costo_ventas_precio: 2.134, comercial: -20.70, administrativo: -21.44, utilidad_operativa: 666.02, pct_utilidad: -42.97, pct_peso: 10.05 },
                                                { codigo: 'P0086', descripcion: 'MOLLEJA DE POLLO', peso_venta: 23.45, importe_venta: 218.60, precio_venta: 9.322, costo_ventas_importe: 50.17, costo_ventas_precio: 2.140, comercial: -2.60, administrativo: -2.70, utilidad_operativa: 163.13, pct_utilidad: -10.52, pct_peso: 1.26 },
                                                { codigo: 'P0068', descripcion: 'HIGADO DE POLLO', peso_venta: 63.25, importe_venta: 268.01, precio_venta: 4.237, costo_ventas_importe: 133.89, costo_ventas_precio: 2.117, comercial: -7.02, administrativo: -7.27, utilidad_operativa: 119.83, pct_utilidad: -7.73, pct_peso: 3.41 },
                                                { codigo: 'P0017', descripcion: 'CUELLO DE POLLO', peso_venta: 76.35, importe_venta: 226.46, precio_venta: 2.966, costo_ventas_importe: 180.02, costo_ventas_precio: 2.358, comercial: -8.47, administrativo: -8.78, utilidad_operativa: 29.19, pct_utilidad: -1.88, pct_peso: 4.11 },
                                                { codigo: 'P0017V', descripcion: 'CUELLOS DE POLLO BRASA', peso_venta: 34.60, importe_venta: 87.97, precio_venta: 2.542, costo_ventas_importe: 74.71, costo_ventas_precio: 2.159, comercial: -3.84, administrativo: -3.98, utilidad_operativa: 5.44, pct_utilidad: -0.35, pct_peso: 1.86 }
                                            ],
                                            subtotal: { peso_venta: 384.10, importe_venta: 1907.10, precio_venta: 4.965, costo_ventas_importe: 836.70, costo_ventas_precio: 2.178, comercial: -42.64, administrativo: -44.17, utilidad_operativa: 983.59, pct_utilidad: -63.46, pct_peso: 20.70 }
                                        }
                                    ]
                                },
                                {
                                    producto: 'Segunda',
                                    tipos: [
                                        {
                                            tipo: '1 Pollo',
                                            items: [
                                                { codigo: 'P120BB', descripcion: 'POLLO CARNE BENEF.MEJORADO-BB', peso_venta: 13.00, importe_venta: 33.05, precio_venta: 2.542, costo_ventas_importe: 712.99, costo_ventas_precio: 54.845, comercial: -1.44, administrativo: -1.50, utilidad_operativa: -682.88, pct_utilidad: 44.06, pct_peso: 0.70 },
                                                { codigo: 'P113B', descripcion: 'POLLO CARNE BENEFICIADO B', peso_venta: 0.00, importe_venta: 0.00, precio_venta: 0.000, costo_ventas_importe: 207.51, costo_ventas_precio: 0.000, comercial: 0.00, administrativo: 0.00, utilidad_operativa: -207.51, pct_utilidad: 13.39, pct_peso: 0.00 },
                                                { codigo: 'P113BB', descripcion: 'POLLO CARNE BENEFICIADO BB', peso_venta: 29.20, importe_venta: 61.86, precio_venta: 2.119, costo_ventas_importe: 186.03, costo_ventas_precio: 6.371, comercial: -3.24, administrativo: -3.36, utilidad_operativa: -130.76, pct_utilidad: 8.44, pct_peso: 1.57 },
                                                { codigo: '123B', descripcion: 'POLLO CARCASA RED B', peso_venta: 482.40, importe_venta: 1022.03, precio_venta: 2.119, costo_ventas_importe: 2885.14, costo_ventas_precio: 5.981, comercial: -53.55, administrativo: -55.48, utilidad_operativa: -1972.13, pct_utilidad: 127.24, pct_peso: 26.00 },
                                                { codigo: 'P116BB', descripcion: 'POLLO BRASA BENEF. MEJORADO BB', peso_venta: 65.20, importe_venta: 165.76, precio_venta: 2.542, costo_ventas_importe: 442.59, costo_ventas_precio: 6.788, comercial: -7.24, administrativo: -7.50, utilidad_operativa: -291.56, pct_utilidad: 18.81, pct_peso: 3.51 }
                                            ],
                                            subtotal: { peso_venta: 589.80, importe_venta: 1282.71, precio_venta: 2.175, costo_ventas_importe: 4434.26, costo_ventas_precio: 7.518, comercial: -65.47, administrativo: -67.83, utilidad_operativa: -3284.84, pct_utilidad: 211.93, pct_peso: 31.79 }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            zona: 'PALOMAR-TIENDA',
                            total_zona: {
                                peso_venta: 96.66,
                                importe_venta: 760.72,
                                precio_venta: 7.870,
                                costo_ventas_importe: 436.44,
                                costo_ventas_precio: 4.515,
                                comercial: -10.73,
                                administrativo: -11.12,
                                utilidad_operativa: 302.43,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        {
                                            tipo: '1 Pollo',
                                            items: [
                                                { codigo: 'P120', descripcion: 'POLLO CARNE BENEF.MEJORADO', peso_venta: 22.63, importe_venta: 184.11, precio_venta: 8.136, costo_ventas_importe: 135.57, costo_ventas_precio: 5.991, comercial: -2.51, administrativo: -2.60, utilidad_operativa: 43.42, pct_utilidad: 14.36, pct_peso: 23.41 },
                                                { codigo: 'P113', descripcion: 'POLLO CARNE BENEFICIADO', peso_venta: 33.04, importe_venta: 263.20, precio_venta: 7.966, costo_ventas_importe: 212.58, costo_ventas_precio: 6.434, comercial: -3.67, administrativo: -3.80, utilidad_operativa: 43.16, pct_utilidad: 14.27, pct_peso: 34.18 }
                                            ],
                                            subtotal: { peso_venta: 55.67, importe_venta: 447.31, precio_venta: 8.035, costo_ventas_importe: 348.15, costo_ventas_precio: 6.254, comercial: -6.18, administrativo: -6.40, utilidad_operativa: 86.58, pct_utilidad: 28.63, pct_peso: 57.59 }
                                        },
                                        {
                                            tipo: '2 Menudencia',
                                            items: [
                                                { codigo: 'PM0113', descripcion: 'PATAS DE POLLO', peso_venta: 17.07, importe_venta: 112.84, precio_venta: 6.610, costo_ventas_importe: 36.43, costo_ventas_precio: 2.134, comercial: -1.89, administrativo: -1.96, utilidad_operativa: 72.55, pct_utilidad: 23.99, pct_peso: 17.66 },
                                                { codigo: 'P0086', descripcion: 'MOLLEJA DE POLLO', peso_venta: 16.16, importe_venta: 162.31, precio_venta: 10.044, costo_ventas_importe: 34.58, costo_ventas_precio: 2.140, comercial: -1.79, administrativo: -1.86, utilidad_operativa: 124.08, pct_utilidad: 41.03, pct_peso: 16.72 },
                                                { codigo: 'P0068', descripcion: 'HIGADO DE POLLO', peso_venta: 4.06, importe_venta: 19.96, precio_venta: 4.915, costo_ventas_importe: 8.59, costo_ventas_precio: 2.117, comercial: -0.45, administrativo: -0.47, utilidad_operativa: 10.44, pct_utilidad: 3.45, pct_peso: 4.20 },
                                                { codigo: 'P0017', descripcion: 'CUELLO DE POLLO', peso_venta: 2.70, importe_venta: 9.84, precio_venta: 3.644, costo_ventas_importe: 6.37, costo_ventas_precio: 2.358, comercial: -0.30, administrativo: -0.31, utilidad_operativa: 2.86, pct_utilidad: 0.95, pct_peso: 2.79 },
                                                { codigo: 'P0035', descripcion: 'CORAZON DE POLLO', peso_venta: 1.00, importe_venta: 8.47, precio_venta: 8.475, costo_ventas_importe: 2.33, costo_ventas_precio: 2.327, comercial: -0.11, administrativo: -0.12, utilidad_operativa: 5.92, pct_utilidad: 1.96, pct_peso: 1.03 }
                                            ],
                                            subtotal: { peso_venta: 40.99, importe_venta: 313.41, precio_venta: 7.646, costo_ventas_importe: 88.29, costo_ventas_precio: 2.154, comercial: -4.55, administrativo: -4.71, utilidad_operativa: 215.85, pct_utilidad: 71.37, pct_peso: 42.41 }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            total_general: {
                peso_venta: 237054.00,
                importe_venta: 1629262.18,
                precio_venta: 6.873,
                costo_ventas_importe: 1501215.48,
                costo_ventas_precio: 6.333,
                comercial: -26312.99,
                administrativo: -27261.21,
                utilidad_operativa: 74472.50,
                pct_utilidad: null,
                pct_peso: 100.00
            }
        };
    }

    /**
     * Datos quemados exactos de Tableau para Dash_EEGGyPP
     */
    getMockDashEEGGyPP(filtros) {
        const grupos = [
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
            ];

        return {
            status: 'success',
            tipo_grafico: 'Dash_EEGGyPP',
            titulo: 'COSTO DE VENTA DEL POLLO BENEFICIADO',
            proceso_label: filtros.proceso || 'BENEFICIADO',
            provincia_label: filtros.provincia || 'AREQUIPA',
            zona_label: filtros.zona || 'PACHACUTEC-MERCADOS',
            grupos: grupos,
            provincias: [
                {
                    provincia: filtros.provincia || 'AREQUIPA',
                    zonas: [
                        {
                            zona: filtros.zona || 'PACHACUTEC-MERCADOS',
                            total_zona: {
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
                            },
                            grupos: grupos
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

    /**
     * Datos quemados exactos de Tableau para Dash_EEGGyPP_Res_ASO
     */
    getMockDashEEGGyPP_Res_ASO(filtros) {
        return {
            status: 'success',
            tipo_grafico: 'Dash_EEGGyPP_Res_ASO',
            titulo: 'COSTO DE VENTA DEL POLLO BENEFICIADO y TROZADO',
            proceso_label: filtros.proceso || '(Todo)',
            provincia_label: filtros.provincia || '(Todo)',
            zona_label: filtros.zona || '(Todo)',
            provincias: [
                {
                    provincia: 'AREQUIPA',
                    zonas: [
                        {
                            zona: 'PACHACUTEC-MERCADOS',
                            total_zona: {
                                peso_venta: 68524.25,
                                importe_venta: 362547.37,
                                precio_venta: 5.291,
                                costo_ventas_importe: 433675.83,
                                costo_ventas_precio: 6.329,
                                comercial: -7606.19,
                                administrativo: -7880.29,
                                utilidad_operativa: -86614.93,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 19802.10, importe_venta: 135174.12, precio_venta: 6.826, costo_ventas_importe: 134317.57, costo_ventas_precio: 6.783, comercial: -2198.03, administrativo: -2277.24, utilidad_operativa: -3618.72, pct_utilidad: 4.18, pct_peso: 28.90 },
                                        { tipo: '2 Menudencia', peso_venta: 24006.15, importe_venta: 156945.45, precio_venta: 6.538, costo_ventas_importe: 118410.66, costo_ventas_precio: 4.933, comercial: -2664.68, administrativo: -2760.71, utilidad_operativa: 33109.40, pct_utilidad: -38.23, pct_peso: 35.03 }
                                    ]
                                },
                                {
                                    producto: 'Segunda',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 21142.00, importe_venta: 44917.50, precio_venta: 2.125, costo_ventas_importe: 153845.28, costo_ventas_precio: 7.277, comercial: -2346.76, administrativo: -2431.33, utilidad_operativa: -113705.87, pct_utilidad: 131.28, pct_peso: 30.85 },
                                        { tipo: '2 Menudencia', peso_venta: 3574.00, importe_venta: 25510.30, precio_venta: 7.138, costo_ventas_importe: 27102.31, costo_ventas_precio: 7.583, comercial: -396.71, administrativo: -411.01, utilidad_operativa: -2399.74, pct_utilidad: 2.77, pct_peso: 5.22 }
                                    ]
                                }
                            ]
                        },
                        {
                            zona: 'PALOMAR-TIENDA',
                            total_zona: {
                                peso_venta: 13414.57,
                                importe_venta: 127193.56,
                                precio_venta: 9.482,
                                costo_ventas_importe: 102161.69,
                                costo_ventas_precio: 7.616,
                                comercial: -1489.02,
                                administrativo: -1542.68,
                                utilidad_operativa: 22000.17,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 1844.66, importe_venta: 14021.99, precio_venta: 7.601, costo_ventas_importe: 11707.01, costo_ventas_precio: 6.346, comercial: -204.76, administrativo: -212.14, utilidad_operativa: 1898.09, pct_utilidad: 8.63, pct_peso: 13.75 },
                                        { tipo: '2 Menudencia', peso_venta: 11569.91, importe_venta: 113171.57, precio_venta: 9.782, costo_ventas_importe: 90454.69, costo_ventas_precio: 7.818, comercial: -1284.26, administrativo: -1330.54, utilidad_operativa: 20102.08, pct_utilidad: 91.37, pct_peso: 86.25 }
                                    ]
                                }
                            ]
                        },
                        {
                            zona: 'PALOMAR-HORIZONTAL',
                            total_zona: {
                                peso_venta: 129203.08,
                                importe_venta: 935745.76,
                                precio_venta: 7.242,
                                costo_ventas_importe: 818030.73,
                                costo_ventas_precio: 6.331,
                                comercial: -14341.54,
                                administrativo: -14858.35,
                                utilidad_operativa: 88515.14,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 92320.43, importe_venta: 656696.92, precio_venta: 7.113, costo_ventas_importe: 599120.08, costo_ventas_precio: 6.490, comercial: -10247.57, administrativo: -10616.85, utilidad_operativa: 36712.43, pct_utilidad: 41.48, pct_peso: 71.45 },
                                        { tipo: '2 Menudencia', peso_venta: 36597.80, importe_venta: 277872.61, precio_venta: 7.593, costo_ventas_importe: 216962.76, costo_ventas_precio: 5.928, comercial: -4062.36, administrativo: -4208.75, utilidad_operativa: 52638.75, pct_utilidad: 59.47, pct_peso: 28.33 }
                                    ]
                                },
                                {
                                    producto: 'Segunda',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 264.50, importe_venta: 1003.77, precio_venta: 3.795, costo_ventas_importe: 1762.17, costo_ventas_precio: 6.662, comercial: -29.36, administrativo: -30.42, utilidad_operativa: -818.17, pct_utilidad: -0.92, pct_peso: 0.20 },
                                        { tipo: '2 Menudencia', peso_venta: 20.35, importe_venta: 172.46, precio_venta: 8.475, costo_ventas_importe: 185.73, costo_ventas_precio: 9.127, comercial: -2.26, administrativo: -2.34, utilidad_operativa: -17.87, pct_utilidad: -0.02, pct_peso: 0.02 }
                                    ]
                                }
                            ]
                        },
                        {
                            zona: 'PACHACUTEC-PATEROS',
                            total_zona: {
                                peso_venta: 25912.10,
                                importe_venta: 203775.49,
                                precio_venta: 7.864,
                                costo_ventas_importe: 147347.23,
                                costo_ventas_precio: 5.686,
                                comercial: -2876.24,
                                administrativo: -2979.89,
                                utilidad_operativa: 50572.12,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 25897.80, importe_venta: 203727.01, precio_venta: 7.867, costo_ventas_importe: 147252.01, costo_ventas_precio: 5.686, comercial: -2874.66, administrativo: -2978.25, utilidad_operativa: 50622.10, pct_utilidad: 100.10, pct_peso: 99.94 }
                                    ]
                                },
                                {
                                    producto: 'Segunda',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 14.30, importe_venta: 48.47, precio_venta: 3.390, costo_ventas_importe: 95.22, costo_ventas_precio: 6.659, comercial: -1.59, administrativo: -1.64, utilidad_operativa: -49.97, pct_utilidad: -0.10, pct_peso: 0.06 }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    provincia: 'JULIACA',
                    zonas: [
                        {
                            zona: 'NO TIENE ZONA',
                            total_zona: {
                                peso_venta: 410111.65,
                                importe_venta: 2869114.72,
                                precio_venta: 6.996,
                                costo_ventas_importe: 2547825.94,
                                costo_ventas_precio: 6.213,
                                comercial: -45522.39,
                                administrativo: -47162.84,
                                utilidad_operativa: 228603.54,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 283700.47, importe_venta: 2078365.11, precio_venta: 7.326, costo_ventas_importe: 1746015.09, costo_ventas_precio: 6.154, comercial: -31490.75, administrativo: -32625.55, utilidad_operativa: 268233.72, pct_utilidad: 117.34, pct_peso: 69.18 },
                                        { tipo: '2 Menudencia', peso_venta: 51973.30, importe_venta: 329875.89, precio_venta: 6.347, costo_ventas_importe: 285467.42, costo_ventas_precio: 5.493, comercial: -5769.04, administrativo: -5976.93, utilidad_operativa: 32662.50, pct_utilidad: 14.29, pct_peso: 12.67 }
                                    ]
                                },
                                {
                                    producto: 'Segunda',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 59747.08, importe_venta: 333003.93, precio_venta: 5.574, costo_ventas_importe: 400766.89, costo_ventas_precio: 6.708, comercial: -6631.93, administrativo: -6870.91, utilidad_operativa: -81265.79, pct_utilidad: -35.55, pct_peso: 14.57 },
                                        { tipo: '2 Menudencia', peso_venta: 14690.80, importe_venta: 127869.79, precio_venta: 8.704, costo_ventas_importe: 115576.55, costo_ventas_precio: 7.867, comercial: -1630.68, administrativo: -1689.44, utilidad_operativa: 8973.12, pct_utilidad: 3.93, pct_peso: 3.58 }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    provincia: 'PUNO',
                    zonas: [
                        {
                            zona: 'NO TIENE ZONA',
                            total_zona: {
                                peso_venta: 59178.27,
                                importe_venta: 465913.00,
                                precio_venta: 7.873,
                                costo_ventas_importe: 373348.93,
                                costo_ventas_precio: 6.309,
                                comercial: -6568.79,
                                administrativo: -6805.50,
                                utilidad_operativa: 79189.78,
                                pct_utilidad: 100.00,
                                pct_peso: 100.00
                            },
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        { tipo: '1 Pollo', peso_venta: 44800.47, importe_venta: 351400.60, precio_venta: 7.844, costo_ventas_importe: 262471.16, costo_ventas_precio: 5.859, comercial: -4972.85, administrativo: -5152.05, utilidad_operativa: 78804.53, pct_utilidad: 99.51, pct_peso: 75.70 },
                                        { tipo: '2 Menudencia', peso_venta: 14377.80, importe_venta: 114512.39, precio_venta: 7.965, costo_ventas_importe: 110877.76, costo_ventas_precio: 7.712, comercial: -1595.94, administrativo: -1653.45, utilidad_operativa: 385.25, pct_utilidad: 0.49, pct_peso: 24.30 }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            total_general: {
                peso_venta: 706343.92,
                importe_venta: 4964289.90,
                precio_venta: 7.028,
                costo_ventas_importe: 4422390.35,
                costo_ventas_precio: 6.261,
                comercial: -78404.18,
                administrativo: -81229.55,
                utilidad_operativa: 382265.82,
                pct_utilidad: 100.00,
                pct_peso: 100.00
            }
        };
    }

    /**
     * Datos quemados exactos de Tableau para Dash_EEGGyPP_Huertas
     */
    getMockDashEEGGyPP_Huertas(filtros) {
        return {
            status: 'success',
            tipo_grafico: 'Dash_EEGGyPP_Huertas',
            titulo: 'COSTO DE VENTA DEL POLLO BENEFICIADO y TROZADO',
            proceso_label: filtros.proceso || '(Todo)',
            provincia_label: filtros.provincia || 'AREQUIPA',
            zona_label: filtros.zona || 'PALOMAR-HORIZONTAL',
            provincias: [
                {
                    provincia: 'AREQUIPA',
                    zonas: [
                        {
                            zona: 'PALOMAR-HORIZONTAL',
                            grupos: [
                                {
                                    producto: 'Primera',
                                    tipos: [
                                        {
                                            tipo: '1 Pollo',
                                            items: [
                                                { codigo: 'P112', descripcion: 'POLLO CARNE BENEF. CARCAZA', peso_venta: 1778.40, costo_ventas_importe: 11762.50, costo_ventas_precio: 6.614 },
                                                { codigo: 'P112M', descripcion: 'POLLO CARNE BENEF. CARCAZA', peso_venta: 5400.70, costo_ventas_importe: 35064.90, costo_ventas_precio: 6.493 },
                                                { codigo: 'P113', descripcion: 'POLLO CARNE BENEFICIADO', peso_venta: 50698.83, costo_ventas_importe: 348183.30, costo_ventas_precio: 6.868 },
                                                { codigo: 'P114', descripcion: 'POLLADA BENEFICIADA', peso_venta: 207.50, costo_ventas_importe: 1349.97, costo_ventas_precio: 6.506 },
                                                { codigo: 'P115', descripcion: 'POLLO BRASA BENEFICIADO', peso_venta: 2475.25, costo_ventas_importe: 20125.23, costo_ventas_precio: 8.131 },
                                                { codigo: 'P116', descripcion: 'POLLO BRASA BENEF. MEJORADO', peso_venta: 12446.75, costo_ventas_importe: 70721.78, costo_ventas_precio: 5.682 },
                                                { codigo: 'P120', descripcion: 'POLLO CARNE BENEF.MEJORADO', peso_venta: 19313.00, costo_ventas_importe: 111912.39, costo_ventas_precio: 5.795 }
                                            ],
                                            subtotal: {
                                                peso_venta: 92320.43,
                                                costo_ventas_importe: 599120.08,
                                                costo_ventas_precio: 6.490
                                            }
                                        },
                                        {
                                            tipo: '2 Menudencia',
                                            items: [
                                                { codigo: 'P118M', descripcion: 'MENUDENCIA DE POLLO MEJORADO', peso_venta: 31.00, costo_ventas_importe: 429.32, costo_ventas_precio: 13.849 },
                                                { codigo: 'P0002', descripcion: 'ALITAS DE POLLO', peso_venta: 1452.10, costo_ventas_importe: 9248.90, costo_ventas_precio: 6.369 },
                                                { codigo: 'P0017', descripcion: 'CUELLO DE POLLO', peso_venta: 2544.55, costo_ventas_importe: 5796.88, costo_ventas_precio: 2.278 },
                                                { codigo: 'P0017V', descripcion: 'CUELLOS DE POLLO BRASA', peso_venta: 431.80, costo_ventas_importe: 946.12, costo_ventas_precio: 2.191 },
                                                { codigo: 'P0035', descripcion: 'CORAZON DE POLLO', peso_venta: 123.50, costo_ventas_importe: 284.37, costo_ventas_precio: 2.303 },
                                                { codigo: 'P0040', descripcion: 'ESPINAZO DE POLLO', peso_venta: 2466.75, costo_ventas_importe: 8801.63, costo_ventas_precio: 3.568 },
                                                { codigo: 'P0068', descripcion: 'HIGADO DE POLLO', peso_venta: 3912.05, costo_ventas_importe: 8726.81, costo_ventas_precio: 2.231 },
                                                { codigo: 'P0086', descripcion: 'MOLLEJA DE POLLO', peso_venta: 3342.50, costo_ventas_importe: 7495.29, costo_ventas_precio: 2.242 },
                                                { codigo: 'P0090', descripcion: 'MUSLITO DE POLLO', peso_venta: 2160.55, costo_ventas_importe: 19107.33, costo_ventas_precio: 8.844 },
                                                { codigo: 'P0105', descripcion: 'CANGURO', peso_venta: 919.90, costo_ventas_importe: 6642.09, costo_ventas_precio: 7.220 },
                                                { codigo: 'P0110', descripcion: 'PECHUGA ESPECIAL', peso_venta: 12796.60, costo_ventas_importe: 116980.13, costo_ventas_precio: 9.142 },
                                                { codigo: 'P0134', descripcion: 'PIERNA C/ENCUENTRO DE POLLO', peso_venta: 710.65, costo_ventas_importe: 4943.27, costo_ventas_precio: 6.956 },
                                                { codigo: 'P0136', descripcion: 'PIERNA ESPECIAL DE POLLO', peso_venta: 2004.65, costo_ventas_importe: 16876.22, costo_ventas_precio: 8.419 },
                                                { codigo: 'P0136L', descripcion: 'PIERNA ESPECIAL GRANDE', peso_venta: 0.00, costo_ventas_importe: 0.00, costo_ventas_precio: 0.000 },
                                                { codigo: 'P0141', descripcion: 'PIERNITA DE POLLO', peso_venta: 412.30, costo_ventas_importe: 3272.32, costo_ventas_precio: 7.937 },
                                                { codigo: 'P0297', descripcion: 'RABADILLA DE POLLO', peso_venta: 20.40, costo_ventas_importe: 93.56, costo_ventas_precio: 4.586 },
                                                { codigo: 'P00112', descripcion: 'PATA Y PESCUEZO DE POLLO', peso_venta: 26.90, costo_ventas_importe: 60.56, costo_ventas_precio: 2.251 },
                                                { codigo: 'PM0113', descripcion: 'PATAS DE POLLO', peso_venta: 3241.60, costo_ventas_importe: 7257.96, costo_ventas_precio: 2.239 }
                                            ],
                                            subtotal: {
                                                peso_venta: 36597.80,
                                                costo_ventas_importe: 216962.76,
                                                costo_ventas_precio: 5.928
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
                                                { codigo: '122', descripcion: 'POLLO CARNE CARCASA BOY', peso_venta: 222.30, costo_ventas_importe: 1480.20, costo_ventas_precio: 6.659 },
                                                { codigo: '122B', descripcion: 'POLLO CARNE CARCASA BOY B', peso_venta: 42.20, costo_ventas_importe: 281.96, costo_ventas_precio: 6.682 }
                                            ],
                                            subtotal: {
                                                peso_venta: 264.50,
                                                costo_ventas_importe: 1762.17,
                                                costo_ventas_precio: 6.662
                                            }
                                        },
                                        {
                                            tipo: '2 Menudencia',
                                            items: [
                                                { codigo: 'P0110B', descripcion: 'PECHUGA ESPECIAL - B', peso_venta: 20.35, costo_ventas_importe: 185.73, costo_ventas_precio: 9.127 }
                                            ],
                                            subtotal: {
                                                peso_venta: 20.35,
                                                costo_ventas_importe: 185.73,
                                                costo_ventas_precio: 9.127
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            total_general: {
                peso_venta: 129203.08,
                costo_ventas_importe: 818030.73,
                costo_ventas_precio: 6.331
            }
        };
    }
}
