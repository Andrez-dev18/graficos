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

        // 6. Filas de métricas para CP01
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
            'zonasDisponibles' => $zonasDisponibles,
            'tablaMetricas'    => $tablaMetricas
        ];
    }
}
