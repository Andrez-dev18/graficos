<?php

require_once __DIR__ . '/CostosTradicionalesRepo.php';

class CostosTradicionalesService
{
    private $db;
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
        $this->db = $db;
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

        // Despacho Modular para CP05 CAABBvsICA
        if ($tipoGrafico === 'CP05 CAABBvsICA' || $tipoGrafico === 'CP05CAABBvsICA' || $tipoGrafico === 'CAABBvsICA') {
            require_once __DIR__ . '/handlers/CP05CAABBvsICAHandler.php';
            return CP05CAABBvsICAHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP06 CAABB
        if ($tipoGrafico === 'CP06 CAABB' || $tipoGrafico === 'CP06CAABB' || $tipoGrafico === 'CP06') {
            require_once __DIR__ . '/handlers/CP06CAABBHandler.php';
            return CP06CAABBHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP09 CZonaGranja
        if ($tipoGrafico === 'CP09 CZonaGranja' || $tipoGrafico === 'CP09CZonaGranja' || $tipoGrafico === 'CP09' || $tipoGrafico === 'CZonaGranja') {
            require_once __DIR__ . '/handlers/CP09CZonaGranjaHandler.php';
            return CP09CZonaGranjaHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP10 CZonaPro
        if ($tipoGrafico === 'CP10 CZonaPro' || $tipoGrafico === 'CP10CZonaPro' || $tipoGrafico === 'CP10' || $tipoGrafico === 'CZonaPro') {
            require_once __DIR__ . '/handlers/CP10CZonaProHandler.php';
            return CP10CZonaProHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP12 ParetoCP
        if ($tipoGrafico === 'CP12 ParetoCP' || $tipoGrafico === 'CP12ParetoCP' || $tipoGrafico === 'CP12' || $tipoGrafico === 'ParetoCP') {
            require_once __DIR__ . '/handlers/CP12ParetoCPHandler.php';
            return CP12ParetoCPHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP13 EvolucionCosto
        if ($tipoGrafico === 'CP13 EvolucionCosto' || $tipoGrafico === 'CP13EvolucionCosto' || $tipoGrafico === 'CP13' || $tipoGrafico === 'EvolucionCosto') {
            require_once __DIR__ . '/handlers/CP13EvolucionCostoHandler.php';
            return CP13EvolucionCostoHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP14 AnalisisCompleto
        if ($tipoGrafico === 'CP14 AnalisisCompleto' || $tipoGrafico === 'CP14AnalisisCompleto' || $tipoGrafico === 'CP14' || $tipoGrafico === 'AnalisisCompleto') {
            require_once __DIR__ . '/handlers/CP14AnalisisCompletoHandler.php';
            return CP14AnalisisCompletoHandler::handle($this->db, $filtros);
        }

        // Despacho con Responsabilidad Única para CP07 InsumosAABB
        if ($tipoGrafico === 'CP07 InsumosAABB' || $tipoGrafico === 'CP07' || $tipoGrafico === 'CP07InsumosAABB') {
            return $this->obtenerDatosCP07InsumosAABB($filtros);
        }

        // Despacho con Responsabilidad Única para CP08 TendenciaInsumos
        if ($tipoGrafico === 'CP08 TendenciaInsumos' || $tipoGrafico === 'CP08' || $tipoGrafico === 'CP08TendenciaInsumos') {
            return $this->obtenerDatosCP08TendenciaInsumos($filtros);
        }

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

        // 7. Obtener datos para CP05 MortVsPeso (Mortalidad vs Peso Promedio + Detalle Cencos)
        $registrosCP05Grafica = $this->repo->getCostosCP05MortVsPesoGrafica($fechaInicio, $fechaFin, $zonaFiltro);
        $registrosCP05Detalle = $this->repo->getCostosCP05MortVsPesoDetalle($fechaInicio, $fechaFin, $zonaFiltro);

        $graficaCP05MortVsPeso = [];
        foreach ($registrosCP05Grafica as $rg) {
            $key = $rg['mes_key'];
            $anio = $rg['anio'];
            $mesNum = $rg['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesLarga = "$mesNomLargo de $anio";

            $graficaCP05MortVsPeso[] = [
                'key'             => $key,
                'mes_larga'       => $mesLarga,
                'mortalidad_porc' => round((float)($rg['mortalidad_porc'] ?? 0), 3),
                'peso_promedio'   => round((float)($rg['peso_promedio'] ?? 0), 3)
            ];
        }

        // Estructurar Detalle por Cencos y Mes para CP05 MortVsPeso
        $mesesDetalleMapCP05 = [];
        $mesesTotalesMapCP05 = [];

        foreach ($registrosCP05Detalle as $rd) {
            $key = $rd['mes_key'];
            $anio = $rd['anio'];
            $mesNum = $rd['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesLarga = "$mesNomLargo de $anio";

            if (!isset($mesesDetalleMapCP05[$key])) {
                $mesesDetalleMapCP05[$key] = [
                    'key'        => $key,
                    'mes'        => $mesLarga,
                    'cencosList' => [],
                    'columnas'   => []
                ];
                $mesesTotalesMapCP05[$key] = [
                    'pollos_muertos'   => 0.0,
                    'pollos_inicial'   => 0.0,
                    'peso_avicola'     => 0.0,
                    'cantidad_avicola' => 0.0
                ];
            }

            $cencos = trim($rd['cencos']);
            $pollosMuertos = (float)($rd['pollos_muertos'] ?? 0);
            $pollosInicial = (float)($rd['pollos_inicial'] ?? 0);
            $mortalidadPorc = round((float)($rd['mortalidad_porc'] ?? 0), 3);
            $pesoAvicola = (float)($rd['peso_avicola'] ?? 0);
            $cantidadAvicola = (float)($rd['cantidad_avicola'] ?? 0);
            $pesoPromedio = round((float)($rd['peso_promedio'] ?? 0), 3);

            $mesesDetalleMapCP05[$key]['cencosList'][] = $cencos;
            $mesesDetalleMapCP05[$key]['columnas'][$cencos] = [
                'pollos_muertos'   => $pollosMuertos,
                'pollos_inicial'   => $pollosInicial,
                'mortalidad_porc'  => $mortalidadPorc,
                'peso_avicola'     => $pesoAvicola,
                'cantidad_avicola' => $cantidadAvicola,
                'peso_promedio'    => $pesoPromedio
            ];

            $mesesTotalesMapCP05[$key]['pollos_muertos']   += $pollosMuertos;
            $mesesTotalesMapCP05[$key]['pollos_inicial']   += $pollosInicial;
            $mesesTotalesMapCP05[$key]['peso_avicola']     += $pesoAvicola;
            $mesesTotalesMapCP05[$key]['cantidad_avicola'] += $cantidadAvicola;
        }

        // Agregar la columna 'Total' a cada mes en CP05
        foreach ($mesesDetalleMapCP05 as $key => &$mObj) {
            $tot = $mesesTotalesMapCP05[$key];
            $mortTotalPorc = ($tot['pollos_inicial'] > 0) ? round(($tot['pollos_muertos'] / $tot['pollos_inicial']) * 100, 3) : 0;
            $pesoPromTotal = ($tot['cantidad_avicola'] > 0) ? round($tot['peso_avicola'] / $tot['cantidad_avicola'], 3) : 0;

            $mObj['cencosList'][] = 'Total';
            $mObj['columnas']['Total'] = [
                'pollos_muertos'   => $tot['pollos_muertos'],
                'pollos_inicial'   => $tot['pollos_inicial'],
                'mortalidad_porc'  => $mortTotalPorc,
                'peso_avicola'     => $tot['peso_avicola'],
                'cantidad_avicola' => $tot['cantidad_avicola'],
                'peso_promedio'    => $pesoPromTotal
            ];
        }
        unset($mObj);

        $detalleMesesCP05MortVsPeso = array_values($mesesDetalleMapCP05);

        // 8. Filas de métricas para CP01
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
            'tipo_grafico'               => $tipoGrafico,
            'zona'                       => $zonaFiltro,
            'benchmark'                  => self::BENCHMARK,
            'periodos'                   => $periodos,
            'graficaCosto'               => $graficaCosto,
            'graficaCP02'                => $graficaCP02,
            'graficaCP03'                => $graficaCP03,
            'graficaCP04'                => $graficaCP04,
            'detalleMesesCP04'           => $detalleMesesCP04,
            'graficaCP05MortVsPeso'      => $graficaCP05MortVsPeso,
            'detalleMesesCP05MortVsPeso' => $detalleMesesCP05MortVsPeso,
            'zonasDisponibles'           => $zonasDisponibles,
            'tablaMetricas'              => $tablaMetricas
        ];
    }

    /**
     * Procesa y estructura exclusivamente los datos para CP07 (Insumos y Alimento Balanceado)
     * Respetando el Principio de Responsabilidad Única (SRP)
     */
    public function obtenerDatosCP07InsumosAABB(array $filtros): array
    {
        // 1. Normalizar filtros de fechas
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        // 2. Normalizar filtro de items (si viene como array, string separado por comas o JSON)
        $itemsFiltro = [];
        if (!empty($filtros['items'])) {
            if (is_array($filtros['items'])) {
                $itemsFiltro = $filtros['items'];
            } elseif (is_string($filtros['items'])) {
                $decoded = json_decode($filtros['items'], true);
                if (is_array($decoded)) {
                    $itemsFiltro = $decoded;
                } else {
                    $itemsFiltro = array_map('trim', explode(',', $filtros['items']));
                }
            }
        }

        // 3. Obtener datos de la gráfica superior: PU Alimento Balanceado (costomenali)
        $registrosAlimento = $this->repo->getCostosProduccionAlimentoBalanceado($fechaInicio, $fechaFin);

        $periodos = [];
        $graficaCP07 = [];

        foreach ($registrosAlimento as $row) {
            $key = $row['mes_key'];
            $mesNum = $row['mes_num'];
            $anio = $row['anio'];
            $mesLarga = (self::$mesesLargo[$mesNum] ?? '') . ' de ' . $anio;
            $mesCorta = (self::$mesesCorto[$mesNum] ?? $mesNum) . ' ' . substr($anio, -2);
            $pu = round((float)($row['pu'] ?? 0), 4);

            $metaPeriodo = [
                'key'       => $key,
                'anio'      => $anio,
                'mes_num'   => $mesNum,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga
            ];

            $periodos[] = $metaPeriodo;

            $graficaCP07[] = array_merge($metaPeriodo, [
                'sum_valoalim' => (float)($row['sum_valoalim'] ?? 0),
                'sum_pesoalim' => (float)($row['sum_pesoalim'] ?? 0),
                'pu'           => $pu
            ]);
        }

        // 4. Obtener detalle matricial de insumos (costomenalidet)
        $registrosInsumos = $this->repo->getCostoInsumosDetalle($fechaInicio, $fechaFin, $itemsFiltro);

        $matrixInsumosMap = [];
        foreach ($registrosInsumos as $row) {
            $codigo = $row['codigo'];
            if (!isset($matrixInsumosMap[$codigo])) {
                $matrixInsumosMap[$codigo] = [
                    'codigo'     => $codigo,
                    'nomcodigo'  => $row['nomcodigo'],
                    'item_label' => $row['item_label'],
                    'valores'    => []
                ];
            }
            $matrixInsumosMap[$codigo]['valores'][$row['mes_key']] = round((float)($row['costo_unitario'] ?? 0), 3);
        }

        $tablaInsumos = array_values($matrixInsumosMap);

        // 5. Obtener catálogo completo de insumos en el rango para el filtro multi-select
        $catalogoInsumos = $this->repo->getInsumosDisponibles($fechaInicio, $fechaFin);

        return [
            'tipo_grafico'    => 'CP07 InsumosAABB',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'periodos'        => $periodos,
            'graficaCP07'     => $graficaCP07,
            'tablaInsumos'    => $tablaInsumos,
            'catalogoInsumos' => $catalogoInsumos,
            'total_items'     => count($tablaInsumos)
        ];
    }

    /**
     * Procesa y estructura exclusivamente los datos para CP08 (Tendencia de CU de Insumos por Código)
     * Respetando el Principio de Responsabilidad Única (SRP)
     */
    public function obtenerDatosCP08TendenciaInsumos(array $filtros): array
    {
        // 1. Normalizar filtros de fechas
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2024-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2025-10-31';

        // 2. Normalizar filtro de items
        $itemsFiltro = [];
        $esSeleccionPorDefecto = false;
        $itemsPreseleccionados = [];

        $rawItems = $filtros['items'] ?? null;

        if ($rawItems === null || $rawItems === '' || $rawItems === [] || (is_string($rawItems) && trim($rawItems) === '')) {
            // Carga inicial o sin filtro explícito: seleccionar los 4 principales por consumo
            $topInsumos = $this->repo->getTopInsumosPorConsumo($fechaInicio, $fechaFin, 4);
            $itemsFiltro = array_column($topInsumos, 'codigo');
            $itemsPreseleccionados = $itemsFiltro;
            $esSeleccionPorDefecto = true;
        } else {
            if (is_array($rawItems)) {
                $itemsFiltro = $rawItems;
            } elseif (is_string($rawItems)) {
                $decoded = json_decode($rawItems, true);
                if (is_array($decoded)) {
                    $itemsFiltro = $decoded;
                } else {
                    $itemsFiltro = array_map('trim', explode(',', $rawItems));
                }
            }

            // Verificar si contiene (TODO) o TODOS
            $hasTodo = false;
            foreach ($itemsFiltro as $it) {
                $u = strtoupper(trim((string)$it));
                if ($u === '(TODO)' || $u === 'TODOS' || $u === 'ALL') {
                    $hasTodo = true;
                    break;
                }
            }

            if ($hasTodo) {
                $itemsFiltro = []; // Trae todos los insumos
            } elseif (in_array('__NONE__', $itemsFiltro)) {
                $itemsFiltro = ['__NONE_MATCH__']; // No traer ningún insumo
            }
        }

        // 3. Obtener los datos agrupados por item y mes
        $registrosInsumos = $this->repo->getCostoInsumosDetalle($fechaInicio, $fechaFin, $itemsFiltro);

        // 4. Construir la lista ordenada de meses (períodos) continuos
        $periodosMap = [];
        $dtInicio = new DateTime($fechaInicio);
        $dtFin    = new DateTime($fechaFin);
        $dtFin->modify('first day of next month');

        $interval = new DateInterval('P1M');
        $periodRange = new DatePeriod($dtInicio, $interval, $dtFin);

        foreach ($periodRange as $dt) {
            $k = $dt->format('Y-m');
            $mNum = $dt->format('m');
            $anio = $dt->format('Y');
            $periodosMap[$k] = [
                'key'       => $k,
                'anio'      => $anio,
                'mes_num'   => $mNum,
                'mes_corta' => (self::$mesesCorto[$mNum] ?? $mNum) . ' ' . substr($anio, -2),
                'mes_larga' => (self::$mesesLargo[$mNum] ?? '') . ' de ' . $anio
            ];
        }

        $periodos = array_values($periodosMap);

        // 5. Estructurar las series multilínea para Chart.js
        $seriesMap = [];
        foreach ($registrosInsumos as $row) {
            $codigo = $row['codigo'];
            if (!isset($seriesMap[$codigo])) {
                $seriesMap[$codigo] = [
                    'codigo'        => $codigo,
                    'nomcodigo'     => $row['nomcodigo'],
                    'item_label'    => $row['item_label'],
                    'valoresPorMes' => []
                ];
            }
            $seriesMap[$codigo]['valoresPorMes'][$row['mes_key']] = round((float)($row['costo_unitario'] ?? 0), 3);
        }

        // Para cada serie, construir el array secuencial alineado a los periodos
        $seriesFinales = [];
        foreach ($seriesMap as $codigo => $serie) {
            $dataPuntos = [];
            foreach ($periodos as $p) {
                $k = $p['key'];
                $val = isset($serie['valoresPorMes'][$k]) ? $serie['valoresPorMes'][$k] : null;
                $dataPuntos[] = $val;
            }
            $seriesFinales[] = [
                'codigo'        => $codigo,
                'nomcodigo'     => $serie['nomcodigo'],
                'item_label'    => $serie['item_label'],
                'valoresPorMes' => $serie['valoresPorMes'],
                'puntos'        => $dataPuntos
            ];
        }

        // 6. Obtener catálogo completo de insumos disponibles en el rango para el dropdown
        $catalogoInsumos = $this->repo->getInsumosDisponibles($fechaInicio, $fechaFin);

        return [
            'tipo_grafico'          => 'CP08 TendenciaInsumos',
            'fecha_inicio'          => $fechaInicio,
            'fecha_fin'             => $fechaFin,
            'periodos'              => $periodos,
            'seriesInsumos'         => $seriesFinales,
            'catalogoInsumos'       => $catalogoInsumos,
            'itemsPreseleccionados' => $itemsPreseleccionados,
            'esSeleccionPorDefecto' => $esSeleccionPorDefecto,
            'total_series'          => count($seriesFinales)
        ];
    }
}
