<?php

class CP13EvolucionCostoHandler
{
    private static $mesesNombres = [
        '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
        '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
        '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
    ];

    private static $mesesCortos = [
        '01' => 'ene', '02' => 'feb', '03' => 'mar', '04' => 'abr',
        '05' => 'may', '06' => 'jun', '07' => 'jul', '08' => 'ago',
        '09' => 'sept', '10' => 'oct', '11' => 'nov', '12' => 'dic'
    ];

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $mesIni = date('Y/m', strtotime($fechaInicio));
        $mesFin = date('Y/m', strtotime($fechaFin));

        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        // 1. Obtener los periodos dentro del rango y sus Kg Vendidos mensuales
        $sqlPeriodos = "SELECT fechames, AVG(kgvendidos) AS kg_mes 
                        FROM costomendet 
                        WHERE fechames BETWEEN :mes_ini AND :mes_fin 
                        GROUP BY fechames 
                        ORDER BY fechames ASC";
        $stmtP = $db->prepare($sqlPeriodos);
        $stmtP->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $rawPeriodos = $stmtP->fetchAll(PDO::FETCH_ASSOC);

        $periodos = [];
        $kgMesMap = [];

        foreach ($rawPeriodos as $p) {
            $fMes = $p['fechames'];
            $parts = explode('/', $fMes);
            $y = $parts[0] ?? '';
            $m = $parts[1] ?? '01';
            $nomMes = self::$mesesNombres[$m] ?? $m;
            $mesL = $nomMes . ' de ' . $y;
            $mesC = (self::$mesesCortos[$m] ?? $m) . ' ' . $y;
            $kg = (float)$p['kg_mes'];

            $periodos[] = [
                'key'        => $fMes,
                'nombre_mes' => $nomMes,
                'mes_larga'  => $mesL,
                'mes_corta'  => $mesC,
                'year'       => (int)$y,
                'month'      => (int)$m,
                'kg_vendidos'=> $kg
            ];
            $kgMesMap[$fMes] = $kg;
        }

        // 2. Obtener catálogo completo de clasificaciones para el filtro multiselect
        $sqlCatalogo = "SELECT DISTINCT 
                            CASE 
                                WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                                ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                            END AS clasificacion,
                            COALESCE(TRIM(linea), '') AS linea,
                            COALESCE(TRIM(nomlinea), '') AS nomlinea
                        FROM costomendet
                        WHERE fechames BETWEEN :mes_ini AND :mes_fin";
        $stmtCat = $db->prepare($sqlCatalogo);
        $stmtCat->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $catalogoClasificaciones = $stmtCat->fetchAll(PDO::FETCH_ASSOC);

        usort($catalogoClasificaciones, function ($a, $b) {
            if ($a['linea'] === '' && $b['linea'] !== '') return -1;
            if ($a['linea'] !== '' && $b['linea'] === '') return 1;
            $cmp = strcmp($a['linea'], $b['linea']);
            return ($cmp !== 0) ? $cmp : strcmp($a['nomlinea'], $b['nomlinea']);
        });

        // 3. TABLA 1: "Evolucion del Costo Mensual por Linea"
        $whereClasif = "";
        $paramsEvol = [':mes_ini' => $mesIni, ':mes_fin' => $mesFin];

        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifConditions = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifConditions[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey = ":cl_e_{$idx}";
                    $clasifConditions[] = "CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey}";
                    $paramsEvol[$pKey] = $cVal;
                }
            }
            if (!empty($clasifConditions)) {
                $whereClasif = " AND (" . implode(' OR ', $clasifConditions) . ")";
            }
        }

        $sqlEvolucion = "SELECT 
                            fechames,
                            CASE 
                                WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                                ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                            END AS clasificacion,
                            COALESCE(TRIM(linea), '') AS linea,
                            COALESCE(TRIM(nomlinea), '') AS nomlinea,
                            SUM(timfipt) AS valor
                         FROM costomendet
                         WHERE fechames BETWEEN :mes_ini AND :mes_fin
                           {$whereClasif}
                         GROUP BY fechames, linea, nomlinea
                         ORDER BY 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                            nomlinea ASC,
                            fechames ASC";

        $stmtEvol = $db->prepare($sqlEvolucion);
        $stmtEvol->execute($paramsEvol);
        $rawEvol = $stmtEvol->fetchAll(PDO::FETCH_ASSOC);

        // Estructurar matriz [clasificacion => [fechames => { valor, cu }]]
        $evolMap = [];
        foreach ($rawEvol as $r) {
            $c = $r['clasificacion'];
            $fm = $r['fechames'];
            $val = (float)$r['valor'];
            $kg = $kgMesMap[$fm] ?? 1.0;
            $cu = ($kg > 0) ? ($val / $kg) : 0.0;

            if (!isset($evolMap[$c])) {
                $evolMap[$c] = [
                    'clasificacion' => $c,
                    'linea'         => $r['linea'],
                    'nomlinea'      => $r['nomlinea'],
                    'valores_mes'   => []
                ];
            }
            $evolMap[$c]['valores_mes'][$fm] = [
                'valor' => $val,
                'cu'    => $cu
            ];
        }

        // Construir tabla final de evolución con CU Mensual y Diferencia Mes Anterior
        $tablaEvolucion = [];
        foreach ($evolMap as $cKey => $cData) {
            $mesesData = [];

            foreach ($periodos as $idx => $pObj) {
                $fMes = $pObj['key'];
                $valObj = $cData['valores_mes'][$fMes] ?? ['valor' => 0.0, 'cu' => 0.0];
                $cuActual = (float)$valObj['cu'];

                $difMesAnt = null;
                if ($idx > 0) {
                    $prevMesKey = $periodos[$idx - 1]['key'];
                    $prevValObj = $cData['valores_mes'][$prevMesKey] ?? ['valor' => 0.0, 'cu' => 0.0];
                    $difMesAnt = round($cuActual - (float)$prevValObj['cu'], 3);
                }

                $mesesData[$fMes] = [
                    'valor'            => round($valObj['valor'], 2),
                    'cu_mensual'       => round($cuActual, 3),
                    'dif_mes_anterior' => $difMesAnt
                ];
            }

            $tablaEvolucion[] = [
                'clasificacion' => $cData['clasificacion'],
                'linea'         => $cData['linea'],
                'nomlinea'      => $cData['nomlinea'],
                'meses'         => $mesesData
            ];
        }

        // 4. TABLA 2: "Costo por Granja Linea"
        $sqlDetalle = "SELECT 
                        fechames,
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        COALESCE(TRIM(linea), '') AS linea,
                        COALESCE(TRIM(nomlinea), '') AS nomlinea,
                        COALESCE(TRIM(cencos), '') AS cencos,
                        COALESCE(TRIM(nomcencos), '') AS nomcencos,
                        SUM(timfipt) AS valor
                       FROM costomendet
                       WHERE fechames BETWEEN :mes_ini AND :mes_fin
                         {$whereClasif}
                       GROUP BY fechames, linea, nomlinea, cencos, nomcencos
                       ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                        cencos ASC,
                        fechames ASC";

        $stmtDet = $db->prepare($sqlDetalle);
        $stmtDet->execute($paramsEvol);
        $rawDet = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

        $detMap = [];
        foreach ($rawDet as $r) {
            $c = $r['clasificacion'];
            $cencos = $r['cencos'];
            $nom = $r['nomcencos'];
            $fm = $r['fechames'];
            $val = (float)$r['valor'];
            $kg = $kgMesMap[$fm] ?? 1.0;
            $cu = ($kg > 0) ? ($val / $kg) : 0.0;

            $rowKey = $c . '___' . $cencos;
            if (!isset($detMap[$rowKey])) {
                $detMap[$rowKey] = [
                    'clasificacion' => $c,
                    'linea'         => $r['linea'],
                    'nomlinea'      => $r['nomlinea'],
                    'cencos'        => $cencos,
                    'nomcencos'     => $nom,
                    'meses'         => []
                ];
            }

            $detMap[$rowKey]['meses'][$fm] = [
                'valor'       => round($val, 2),
                'kg_vendidos' => round($kg, 2),
                'cu_mensual'  => round($cu, 3)
            ];
        }

        // Construir tabla final de detalle completando meses faltantes
        $tablaDetalle = [];
        foreach ($detMap as $rowKey => $rowObj) {
            $mesesFilled = [];
            foreach ($periodos as $pObj) {
                $fMes = $pObj['key'];
                $kg = $kgMesMap[$fMes] ?? 0.0;
                if (isset($rowObj['meses'][$fMes])) {
                    $mesesFilled[$fMes] = $rowObj['meses'][$fMes];
                } else {
                    $mesesFilled[$fMes] = [
                        'valor'       => 0.0,
                        'kg_vendidos' => round($kg, 2),
                        'cu_mensual'  => 0.0
                    ];
                }
            }

            $tablaDetalle[] = [
                'clasificacion' => $rowObj['clasificacion'],
                'linea'         => $rowObj['linea'],
                'nomlinea'      => $rowObj['nomlinea'],
                'cencos'        => $rowObj['cencos'],
                'nomcencos'     => $rowObj['nomcencos'],
                'meses'         => $mesesFilled
            ];
        }

        return [
            'tipo_grafico'             => 'CP13 EvolucionCosto',
            'titulo'                   => 'Evolución del Costo Mensual por Línea & Costo por Granja Línea',
            'periodos'                 => $periodos,
            'catalogo_clasificaciones' => $catalogoClasificaciones,
            'tabla_evolucion'          => $tablaEvolucion,
            'tabla_detalle'            => $tablaDetalle,
            'total_registros_evolucion'=> count($tablaEvolucion),
            'total_registros_detalle'  => count($tablaDetalle)
        ];
    }
}
