<?php

require_once __DIR__ . '/CostosDias2Repo.php';

class CostosDias2Service
{
    private $repo;

    private static $mesesNombres = [
        '01' => 'Enero', '02' => 'Febrero', '03' => 'Marzo', '04' => 'Abril',
        '05' => 'Mayo', '06' => 'Junio', '07' => 'Julio', '08' => 'Agosto',
        '09' => 'Septiembre', '10' => 'Octubre', '11' => 'Noviembre', '12' => 'Diciembre'
    ];

    public function __construct(PDO $db)
    {
        $this->repo = new CostosDias2Repo($db);
    }

    /**
     * Procesa y estructura la matriz horizontal de galpones y subtotales por Granja
     */
    public function obtenerDashboard(array $filtros): array
    {
        // 1. Parsear filtros de fechas
        $parsedFiltros = [];

        // Rango de Período Normal (fecha_inicio, fecha_fin)
        if (!empty($filtros['fecha_inicio'])) {
            $parsedFiltros['periodo_ini'] = str_replace('-', '', substr($filtros['fecha_inicio'], 0, 7));
        }
        if (!empty($filtros['fecha_fin'])) {
            $parsedFiltros['periodo_fin'] = str_replace('-', '', substr($filtros['fecha_fin'], 0, 7));
        }

        // Si no se envían fechas de período, fijar por defecto
        if (empty($parsedFiltros['periodo_ini']) && empty($filtros['fecha_liq_inicio'])) {
            $parsedFiltros['periodo_ini'] = '202501';
            $parsedFiltros['periodo_fin'] = '202512';
        }

        // Rango de Fecha de Liquidación
        if (!empty($filtros['fecha_liq_inicio'])) {
            $parsedFiltros['fecha_liq_ini'] = $filtros['fecha_liq_inicio'];
        }
        if (!empty($filtros['fecha_liq_fin'])) {
            $parsedFiltros['fecha_liq_fin'] = $filtros['fecha_liq_fin'];
        }

        // Granjas seleccionadas
        if (!empty($filtros['granjas'])) {
            $parsedFiltros['granjas'] = is_array($filtros['granjas']) ? $filtros['granjas'] : [$filtros['granjas']];
        }

        // Campañas seleccionadas
        if (!empty($filtros['campanas'])) {
            $parsedFiltros['campanas'] = is_array($filtros['campanas']) ? $filtros['campanas'] : [$filtros['campanas']];
        }

        // Galpones seleccionados
        if (!empty($filtros['galpones'])) {
            $parsedFiltros['galpones'] = is_array($filtros['galpones']) ? $filtros['galpones'] : [$filtros['galpones']];
        }

        // tuser
        if (!empty($filtros['tuser'])) {
            $parsedFiltros['tuser'] = $filtros['tuser'];
        }

        // 2. Ejecutar consulta en repositorio
        $rawRows = $this->repo->getMatrizGalpones($parsedFiltros);

        // 3. Detectar todos los Galpones únicos presentes
        $galponesSet = [];
        foreach ($rawRows as $row) {
            $gp = trim((string)$row['galpon']);
            if ($gp !== '') {
                $galponesSet[$gp] = true;
            }
        }
        $galponesLista = array_keys($galponesSet);
        usort($galponesLista, function ($a, $b) {
            return (int)$a - (int)$b;
        });

        // 4. Agrupar filas por Centro de Costo (Granja) y Mes
        $granjasMap = [];
        $totalGlobalPorGalpon = [];
        $granTotalGlobal = ['valor' => 0.0, 'peso_glp' => 0.0, 'cu_glp' => 0.0];

        foreach ($rawRows as $row) {
            $cencos  = trim((string)$row['tcencos']);
            $nomcen  = trim((string)$row['tnomcen']);
            $anio    = trim((string)$row['tanio']);
            $tuser   = trim((string)$row['tuser']);
            $mesNum  = str_pad(trim((string)$row['tmes']), 2, '0', STR_PAD_LEFT);
            $mesNom  = self::$mesesNombres[$mesNum] ?? (!empty($row['tnomMes']) ? ucfirst(strtolower($row['tnomMes'])) : "Mes $mesNum");
            $galpon  = trim((string)$row['galpon']);
            $valor   = (float)$row['valor'];
            $pesoGlp = (float)$row['peso_glp'];
            $cuGlp   = ($pesoGlp > 0) ? ($valor / $pesoGlp) : 0.0;

            $granjaKey = "{$cencos}_{$anio}";

            if (!isset($granjasMap[$granjaKey])) {
                $granjasMap[$granjaKey] = [
                    'key'     => $granjaKey,
                    'tcencos' => $cencos,
                    'tnomcen' => $nomcen,
                    'tanio'   => $anio,
                    'tuser'   => !empty($tuser) ? $tuser : 'MES',
                    'meses'   => [],
                    'total'   => [
                        'galpones'      => [],
                        'total_granja'  => ['valor' => 0.0, 'peso_glp' => 0.0, 'cu_glp' => 0.0]
                    ]
                ];
            }

            // Agrupar por mes
            $mesKey = "{$anio}-{$mesNum}";
            if (!isset($granjasMap[$granjaKey]['meses'][$mesKey])) {
                $granjasMap[$granjaKey]['meses'][$mesKey] = [
                    'key'       => $mesKey,
                    'tanio'     => $anio,
                    'tmes'      => $mesNum,
                    'tnomMes'   => $mesNom,
                    'galpones'  => [],
                    'total_mes' => ['valor' => 0.0, 'peso_glp' => 0.0, 'cu_glp' => 0.0]
                ];
            }

            $granjasMap[$granjaKey]['meses'][$mesKey]['galpones'][$galpon] = [
                'valor'    => round($valor, 2),
                'peso_glp' => round($pesoGlp, 2),
                'cu_glp'   => round($cuGlp, 3)
            ];

            // Acumular total del mes
            $granjasMap[$granjaKey]['meses'][$mesKey]['total_mes']['valor'] += $valor;
            $granjasMap[$granjaKey]['meses'][$mesKey]['total_mes']['peso_glp'] += $pesoGlp;

            // Acumular total de la granja por galpón
            if (!isset($granjasMap[$granjaKey]['total']['galpones'][$galpon])) {
                $granjasMap[$granjaKey]['total']['galpones'][$galpon] = ['valor' => 0.0, 'peso_glp' => 0.0, 'cu_glp' => 0.0];
            }
            $granjasMap[$granjaKey]['total']['galpones'][$galpon]['valor'] += $valor;
            $granjasMap[$granjaKey]['total']['galpones'][$galpon]['peso_glp'] += $pesoGlp;

            // Acumular total horizontal de la granja
            $granjasMap[$granjaKey]['total']['total_granja']['valor'] += $valor;
            $granjasMap[$granjaKey]['total']['total_granja']['peso_glp'] += $pesoGlp;

            // Acumular total global general por galpón
            if (!isset($totalGlobalPorGalpon[$galpon])) {
                $totalGlobalPorGalpon[$galpon] = ['valor' => 0.0, 'peso_glp' => 0.0, 'cu_glp' => 0.0];
            }
            $totalGlobalPorGalpon[$galpon]['valor'] += $valor;
            $totalGlobalPorGalpon[$galpon]['peso_glp'] += $pesoGlp;

            $granTotalGlobal['valor'] += $valor;
            $granTotalGlobal['peso_glp'] += $pesoGlp;
        }

        // 5. Finalizar cálculos de CU (Costo Unitario) y redondear
        $granjasEstructuradas = [];
        foreach ($granjasMap as $gKey => $gData) {
            $mesesList = [];
            foreach ($gData['meses'] as $mKey => $mData) {
                // Completar galpones vacíos con ceros/nulos
                foreach ($galponesLista as $gp) {
                    if (!isset($mData['galpones'][$gp])) {
                        $mData['galpones'][$gp] = [
                            'valor'    => 0.0,
                            'peso_glp' => 0.0,
                            'cu_glp'   => null
                        ];
                    }
                }

                // Calcular CU del mes
                $mTotVal  = $mData['total_mes']['valor'];
                $mTotPeso = $mData['total_mes']['peso_glp'];
                $mData['total_mes']['valor']    = round($mTotVal, 2);
                $mData['total_mes']['peso_glp'] = round($mTotPeso, 2);
                $mData['total_mes']['cu_glp']   = ($mTotPeso > 0) ? round($mTotVal / $mTotPeso, 3) : null;

                $mesesList[] = $mData;
            }

            // Calcular CU para la fila Total de la granja por cada galpón
            foreach ($galponesLista as $gp) {
                if (isset($gData['total']['galpones'][$gp])) {
                    $gTotVal  = $gData['total']['galpones'][$gp]['valor'];
                    $gTotPeso = $gData['total']['galpones'][$gp]['peso_glp'];
                    $gData['total']['galpones'][$gp]['valor']    = round($gTotVal, 2);
                    $gData['total']['galpones'][$gp]['peso_glp'] = round($gTotPeso, 2);
                    $gData['total']['galpones'][$gp]['cu_glp']   = ($gTotPeso > 0) ? round($gTotVal / $gTotPeso, 3) : null;
                } else {
                    $gData['total']['galpones'][$gp] = [
                        'valor'    => 0.0,
                        'peso_glp' => 0.0,
                        'cu_glp'   => null
                    ];
                }
            }

            // CU Total horizontal de la granja
            $grjTotVal  = $gData['total']['total_granja']['valor'];
            $grjTotPeso = $gData['total']['total_granja']['peso_glp'];
            $gData['total']['total_granja']['valor']    = round($grjTotVal, 2);
            $gData['total']['total_granja']['peso_glp'] = round($grjTotPeso, 2);
            $gData['total']['total_granja']['cu_glp']   = ($grjTotPeso > 0) ? round($grjTotVal / $grjTotPeso, 3) : null;

            $gData['meses'] = $mesesList;
            $granjasEstructuradas[] = $gData;
        }

        // 6. Calcular Totales Generales Globales
        $totalGeneralFinalPorGalpon = [];
        foreach ($galponesLista as $gp) {
            if (isset($totalGlobalPorGalpon[$gp])) {
                $v = $totalGlobalPorGalpon[$gp]['valor'];
                $p = $totalGlobalPorGalpon[$gp]['peso_glp'];
                $totalGeneralFinalPorGalpon[$gp] = [
                    'valor'    => round($v, 2),
                    'peso_glp' => round($p, 2),
                    'cu_glp'   => ($p > 0) ? round($v / $p, 3) : null
                ];
            } else {
                $totalGeneralFinalPorGalpon[$gp] = [
                    'valor'    => 0.0,
                    'peso_glp' => 0.0,
                    'cu_glp'   => null
                ];
            }
        }

        $granTotalGlobal['valor']    = round($granTotalGlobal['valor'], 2);
        $granTotalGlobal['peso_glp'] = round($granTotalGlobal['peso_glp'], 2);
        $granTotalGlobal['cu_glp']   = ($granTotalGlobal['peso_glp'] > 0) ? round($granTotalGlobal['valor'] / $granTotalGlobal['peso_glp'], 3) : null;

        return [
            'status'            => 'success',
            'galpones'          => $galponesLista,
            'granjas'           => $granjasEstructuradas,
            'totalGeneral'      => $totalGeneralFinalPorGalpon,
            'granTotal'         => $granTotalGlobal,
            'filtrosAplicados'  => $parsedFiltros
        ];
    }

    /**
     * Retorna catálogos y rangos de filtros disponibles
     */
    public function obtenerFiltros(array $filtros = []): array
    {
        return $this->repo->getFiltrosDisponibles($filtros);
    }
}
