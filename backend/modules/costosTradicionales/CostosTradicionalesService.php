<?php

require_once __DIR__ . '/CostosTradicionalesRepo.php';

class CostosTradicionalesService
{
    private $repo;

    const BENCHMARK = 4.538;

    private static $mesesLargo = [
        '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
        '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
        '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
    ];

    private static $mesesCorto = [
        '01' => 'ene', '02' => 'feb', '03' => 'mar', '04' => 'abr',
        '05' => 'may', '06' => 'jun', '07' => 'jul', '08' => 'ago',
        '09' => 'sept', '10' => 'oct', '11' => 'nov', '12' => 'dic'
    ];

    public function __construct(PDO $db)
    {
        $this->repo = new CostosTradicionalesRepo($db);
    }

    /**
     * Procesa y estructura los datos para CP01, CP02 y CP03 con soporte de filtro de zona
     */
    public function obtenerDashboard(array $filtros): array
    {
        // 1. Normalizar fechas y filtros
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2024-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2025-10-31';
        $tipoGrafico = !empty($filtros['tipo_grafico']) ? trim($filtros['tipo_grafico']) : 'CPO1CostoProduccion';
        $zonaFiltro  = !empty($filtros['zona']) ? trim($filtros['zona']) : null;

        // 2. Obtener datos generales de costomen (para CP01 y CP02)
        $registros = $this->repo->getCostosPorPeriodo($fechaInicio, $fechaFin);

        // 3. Obtener datos por zona de costomenzona (para CP03)
        $registrosZona = $this->repo->getCostosPorZona($fechaInicio, $fechaFin, $zonaFiltro);
        $zonasDisponibles = $this->repo->getZonasDisponibles();

        // 4. Estructurar CP01 y CP02
        $periodos     = [];
        $graficaCosto = []; // CP01
        $graficaCP02  = []; // CP02

        $valoresSacaUnd   = [];
        $valoresSacaKg    = [];
        $valoresPesoProm  = [];
        $valoresIca       = [];
        $valoresEdadVenta = [];
        $valoresMort      = [];
        $valoresGanancia  = [];

        foreach ($registros as $row) {
            $key    = $row['mes_key'];
            $anio   = $row['anio'];
            $mesNum = $row['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesNomCorto = self::$mesesCorto[$mesNum] ?? "m$mesNum";

            $mesLarga = "$mesNomLargo de $anio";
            $mesCorta = "$mesNomCorto $anio";
            $mesTitulo = ucfirst($mesNomLargo);

            $costoUnitario = (float)($row['costo_unitario'] ?? 0);
            $costoRedondeado = round($costoUnitario, 3);
            $estadoCosto = ($costoRedondeado <= self::BENCHMARK) ? 'bajo' : 'alto';

            $costoAlim = (float)($row['costo_alimentacion_kg'] ?? 0);
            $costoAlimRedondeado = round($costoAlim, 3);

            $periodos[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes'       => $mesTitulo,
                'mes_num'   => $mesNum
            ];

            // CP01
            $graficaCosto[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes'       => $mesTitulo,
                'costo'     => $costoRedondeado,
                'estado'    => $estadoCosto
            ];

            // CP02
            $graficaCP02[] = [
                'key'                => $key,
                'mes_corta'          => $mesCorta,
                'mes_larga'          => $mesLarga,
                'anio'               => $anio,
                'mes'                => $mesTitulo,
                'costo_produccion'   => $costoRedondeado,
                'costo_alimentacion' => $costoAlimRedondeado
            ];

            // Métricas CP01
            $valoresSacaUnd[$key]   = (float)($row['saca_und'] ?? 0);
            $valoresSacaKg[$key]    = (float)($row['saca_kilos'] ?? 0);
            $valoresPesoProm[$key]  = round((float)($row['pesoprom'] ?? 0), 3);
            $valoresIca[$key]       = round((float)($row['ica'] ?? 0), 3);
            $valoresEdadVenta[$key] = round((float)($row['edadventa'] ?? 0), 1);
            $valoresMort[$key]      = round((float)($row['mortalidad_porc'] ?? 0), 3);
            $valoresGanancia[$key]  = round((float)($row['ganancia'] ?? 0), 3);
        }

        // 5. Estructurar CP03 (Costo Promedio de Producción Pollo Vivo por Zona)
        $periodosZonaMap = [];
        $seriesPorZona = [];

        foreach ($registrosZona as $rz) {
            $key    = $rz['mes_key'];
            $anio   = $rz['anio'];
            $mesNum = $rz['mes_num'];
            $zona   = trim($rz['zona']);
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesNomCorto = self::$mesesCorto[$mesNum] ?? "m$mesNum";

            $mesLarga = "$mesNomLargo de $anio";
            $mesCorta = "$mesNomCorto $anio";

            if (!isset($periodosZonaMap[$key])) {
                $periodosZonaMap[$key] = [
                    'key'       => $key,
                    'mes_corta' => $mesCorta,
                    'mes_larga' => $mesLarga,
                    'anio'      => $anio,
                    'mes'       => ucfirst($mesNomLargo),
                    'mes_num'   => $mesNum
                ];
            }

            $cpv = round((float)($rz['costo_promedio_zona'] ?? 0), 3);

            $seriesPorZona[$zona][$key] = [
                'costo'   => $cpv,
                'valoavi' => (float)($rz['sum_valoavi'] ?? 0),
                'pesoavi' => (float)($rz['sum_pesoavi'] ?? 0)
            ];
        }

        $periodosCP03 = array_values($periodosZonaMap);
        $zonasCP03 = array_keys($seriesPorZona);

        $graficaCP03 = [
            'periodos' => $periodosCP03,
            'zonas'    => $zonasCP03,
            'series'   => $seriesPorZona
        ];

        // 6. Obtener datos para CP04 (Costo por Kg Pollo Vivo vs Costo Alimentación + Detalle Cencos)
        $registrosCP04Grafica = $this->repo->getCostosCP04Grafica($fechaInicio, $fechaFin, $zonaFiltro);
        $registrosCP04Detalle = $this->repo->getCostosCP04Detalle($fechaInicio, $fechaFin, $zonaFiltro);

        $graficaCP04 = [];
        foreach ($registrosCP04Grafica as $rg) {
            $key = $rg['mes_key'];
            $anio = $rg['anio'];
            $mesNum = $rg['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesLarga = "$mesNomLargo de $anio";

            $graficaCP04[] = [
                'key'                => $key,
                'mes_larga'          => $mesLarga,
                'costo_produccion'   => round((float)($rg['costo_produccion'] ?? 0), 3),
                'costo_alimentacion' => round((float)($rg['costo_alimentacion'] ?? 0), 3)
            ];
        }

        // Estructurar Detalle por Cencos y Mes para CP04
        $mesesDetalleMap = [];
        $mesesTotalesMap = [];

        foreach ($registrosCP04Detalle as $rd) {
            $key = $rd['mes_key'];
            $anio = $rd['anio'];
            $mesNum = $rd['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesLarga = "$mesNomLargo de $anio";

            if (!isset($mesesDetalleMap[$key])) {
                $mesesDetalleMap[$key] = [
                    'key'        => $key,
                    'mes'        => $mesLarga,
                    'cencosList' => [],
                    'columnas'   => []
                ];
                $mesesTotalesMap[$key] = [
                    'val_alim' => 0.0,
                    'saca_kg'  => 0.0,
                    'val_avi'  => 0.0,
                    'peso_avi' => 0.0
                ];
            }

            $cencos = trim($rd['cencos']);
            $valAlim = (float)($rd['val_alim'] ?? 0);
            $sacaKg  = (float)($rd['saca_kg'] ?? 0);
            $costoAlim = round((float)($rd['costo_alim'] ?? 0), 3);
            $valAvi  = (float)($rd['val_avi'] ?? 0);
            $pesoAvi = (float)($rd['peso_avi'] ?? 0);
            $costoKg = round((float)($rd['costo_kg'] ?? 0), 3);

            $mesesDetalleMap[$key]['cencosList'][] = $cencos;
            $mesesDetalleMap[$key]['columnas'][$cencos] = [
                'val_alim'   => $valAlim,
                'saca_kg'    => $sacaKg,
                'costo_alim' => $costoAlim,
                'val_avi'    => $valAvi,
                'peso_avi'   => $pesoAvi,
                'costo_kg'   => $costoKg
            ];

            $mesesTotalesMap[$key]['val_alim'] += $valAlim;
            $mesesTotalesMap[$key]['saca_kg']  += $sacaKg;
            $mesesTotalesMap[$key]['val_avi']  += $valAvi;
            $mesesTotalesMap[$key]['peso_avi'] += $pesoAvi;
        }

        // Agregar la columna 'Total' a cada mes
        foreach ($mesesDetalleMap as $key => &$mObj) {
            $tot = $mesesTotalesMap[$key];
            $costoAlimTotal = ($tot['saca_kg'] > 0) ? round($tot['val_alim'] / $tot['saca_kg'], 3) : 0;
            $costoKgTotal   = ($tot['peso_avi'] > 0) ? round($tot['val_avi'] / $tot['peso_avi'], 3) : 0;

            $mObj['cencosList'][] = 'Total';
            $mObj['columnas']['Total'] = [
                'val_alim'   => $tot['val_alim'],
                'saca_kg'    => $tot['saca_kg'],
                'costo_alim' => $costoAlimTotal,
                'val_avi'    => $tot['val_avi'],
                'peso_avi'   => $tot['peso_avi'],
                'costo_kg'   => $costoKgTotal
            ];
        }
        unset($mObj);

        $detalleMesesCP04 = array_values($mesesDetalleMap);

        // 7. Filas de métricas para CP01
        $tablaMetricas = [
            [
                'id'      => 'saca_pollo_und',
                'nombre'  => 'SACA POLLO (UND)',
                'formato' => 'entero',
                'valores' => $valoresSacaUnd
            ],
            [
                'id'      => 'saca_pollo_kg',
                'nombre'  => 'SACA POLLO (KG)',
                'formato' => 'entero',
                'valores' => $valoresSacaKg
            ],
            [
                'id'      => 'peso_prom_saca',
                'nombre'  => 'PESO PROM SACA',
                'formato' => 'decimal3',
                'valores' => $valoresPesoProm
            ],
            [
                'id'      => 'ica',
                'nombre'  => 'ICA',
                'formato' => 'decimal3',
                'valores' => $valoresIca
            ],
            [
                'id'      => 'edad_de_venta',
                'nombre'  => 'EDAD DE VENTA',
                'formato' => 'decimal1',
                'valores' => $valoresEdadVenta
            ],
            [
                'id'      => 'mortalidad',
                'nombre'  => '%MORTALIDAD',
                'formato' => 'decimal3',
                'valores' => $valoresMort
            ],
            [
                'id'      => 'ganancia_peso_dia',
                'nombre'  => 'GANANCIA DE PESO POR DIA',
                'formato' => 'decimal3',
                'valores' => $valoresGanancia
            ]
        ];

        return [
            'tipo_grafico'     => $tipoGrafico,
            'zona'             => $zonaFiltro,
            'benchmark'        => self::BENCHMARK,
            'periodos'         => $periodos,
            'graficaCosto'     => $graficaCosto,
            'graficaCP02'      => $graficaCP02,
            'graficaCP03'      => $graficaCP03,
            'graficaCP04'      => $graficaCP04,
            'detalleMesesCP04' => $detalleMesesCP04,
            'zonasDisponibles' => $zonasDisponibles,
            'tablaMetricas'    => $tablaMetricas
        ];
    }
}
