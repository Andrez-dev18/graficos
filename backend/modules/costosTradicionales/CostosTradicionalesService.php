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
     * Procesa y estructura los datos para la gráfica de costo, CP02 y la tabla de métricas
     */
    public function obtenerDashboard(array $filtros): array
    {
        // 1. Normalizar fechas de filtro
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2024-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2025-10-31';
        $tipoGrafico = !empty($filtros['tipo_grafico']) ? trim($filtros['tipo_grafico']) : 'CPO1CostoProduccion';

        // 2. Obtener datos del repositorio
        $registros = $this->repo->getCostosPorPeriodo($fechaInicio, $fechaFin);

        // 3. Estructurar colecciones de salida
        $periodos     = [];
        $graficaCosto = []; // CP01
        $graficaCP02  = []; // CP02 (Doble eje: Producción vs Alimentación)

        // Inicializar mapas de valores por métrica
        $valoresSacaUnd   = [];
        $valoresSacaKg    = [];
        $valoresPesoProm  = [];
        $valoresIca       = [];
        $valoresEdadVenta = [];
        $valoresMort      = [];
        $valoresGanancia  = [];

        foreach ($registros as $row) {
            $key    = $row['mes_key']; // e.g. 2026-03
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

            // Agregar a lista cronológica de periodos
            $periodos[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes'       => $mesTitulo,
                'mes_num'   => $mesNum
            ];

            // Punto para CP01: Costo de Producción Pollo Vivo
            $graficaCosto[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes'       => $mesTitulo,
                'costo'     => $costoRedondeado,
                'estado'    => $estadoCosto
            ];

            // Punto para CP02: CPV vs CA (Doble serie)
            $graficaCP02[] = [
                'key'                => $key,
                'mes_corta'          => $mesCorta,
                'mes_larga'          => $mesLarga,
                'anio'               => $anio,
                'mes'                => $mesTitulo,
                'costo_produccion'   => $costoRedondeado,
                'costo_alimentacion' => $costoAlimRedondeado
            ];

            // Llenar mapas de métricas para la tabla
            $valoresSacaUnd[$key]   = (float)($row['saca_und'] ?? 0);
            $valoresSacaKg[$key]    = (float)($row['saca_kilos'] ?? 0);
            $valoresPesoProm[$key]  = round((float)($row['pesoprom'] ?? 0), 3);
            $valoresIca[$key]       = round((float)($row['ica'] ?? 0), 3);
            $valoresEdadVenta[$key] = round((float)($row['edadventa'] ?? 0), 1);
            $valoresMort[$key]      = round((float)($row['mortalidad_porc'] ?? 0), 3);
            $valoresGanancia[$key]  = round((float)($row['ganancia'] ?? 0), 3);
        }

        // 4. Construir las 7 filas de métricas con sus formatos
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
            'tipo_grafico'  => $tipoGrafico,
            'benchmark'     => self::BENCHMARK,
            'periodos'      => $periodos,
            'graficaCosto'  => $graficaCosto,
            'graficaCP02'   => $graficaCP02,
            'tablaMetricas' => $tablaMetricas
        ];
    }
}
