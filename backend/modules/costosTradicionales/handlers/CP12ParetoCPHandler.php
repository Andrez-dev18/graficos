<?php

class CP12ParetoCPHandler
{
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

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-08-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $mesIni = date('Y/m', strtotime($fechaInicio));
        $mesFin = date('Y/m', strtotime($fechaFin));

        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        // 1. Obtener los periodos dentro del rango
        $sqlPeriodos = "SELECT DISTINCT fechames 
                        FROM costomendet 
                        WHERE fechames BETWEEN :mes_ini AND :mes_fin 
                        ORDER BY fechames ASC";
        $stmtP = $db->prepare($sqlPeriodos);
        $stmtP->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $rawPeriodos = $stmtP->fetchAll(PDO::FETCH_COLUMN);

        $periodos = [];
        foreach ($rawPeriodos as $p) {
            $parts = explode('/', $p);
            $y = $parts[0] ?? '';
            $m = $parts[1] ?? '01';
            $mesL = (self::$mesesLargo[$m] ?? $m) . ' de ' . $y;
            $mesC = (self::$mesesCorto[$m] ?? $m) . ' ' . $y;

            $periodos[] = [
                'key'       => $p,
                'mes_larga' => $mesL,
                'mes_corta' => $mesC,
                'year'      => (int)$y,
                'month'     => (int)$m
            ];
        }

        // 2. Obtener catálogo completo de clasificaciones para el filtro
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

        // 3. Obtener el Total Global de Kg Vendidos en el período
        $sqlKg = "SELECT SUM(kg_mes) AS total_kg
                  FROM (
                      SELECT fechames, AVG(kgvendidos) AS kg_mes
                      FROM costomendet
                      WHERE fechames BETWEEN :mes_ini AND :mes_fin
                      GROUP BY fechames
                  ) AS sub";
        $stmtKg = $db->prepare($sqlKg);
        $stmtKg->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $totalKgVendidos = (float)$stmtKg->fetchColumn();
        if ($totalKgVendidos <= 0) {
            $totalKgVendidos = 1.0; // Evitar división por cero
        }

        // 4. TABLA 1: "Pareto del Costo"
        // Construcción de cláusula de filtro de clasificación
        $whereClasifPareto = "";
        $paramsPareto = [':mes_ini' => $mesIni, ':mes_fin' => $mesFin];

        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifConditions = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifConditions[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey = ":cl_p_{$idx}";
                    $clasifConditions[] = "CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey}";
                    $paramsPareto[$pKey] = $cVal;
                }
            }
            if (!empty($clasifConditions)) {
                $whereClasifPareto = " AND (" . implode(' OR ', $clasifConditions) . ")";
            }
        }

        $sqlPareto = "SELECT 
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        COALESCE(TRIM(linea), '') AS linea,
                        COALESCE(TRIM(nomlinea), '') AS nomlinea,
                        SUM(timfipt) AS valor
                      FROM costomendet
                      WHERE fechames BETWEEN :mes_ini AND :mes_fin
                        {$whereClasifPareto}
                      GROUP BY linea, nomlinea
                      ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                        nomlinea ASC";

        $stmtPareto = $db->prepare($sqlPareto);
        $stmtPareto->execute($paramsPareto);
        $rawPareto = $stmtPareto->fetchAll(PDO::FETCH_ASSOC);

        $tablaPareto = [];
        $totalValorPareto = 0.0;

        foreach ($rawPareto as $r) {
            $val = (float)$r['valor'];
            $totalValorPareto += $val;
            $cu = ($totalKgVendidos > 0) ? ($val / $totalKgVendidos) : 0.0;

            $tablaPareto[] = [
                'clasificacion' => $r['clasificacion'],
                'linea'         => $r['linea'],
                'nomlinea'      => $r['nomlinea'],
                'valor'         => round($val, 2),
                'kg_vendidos'   => round($totalKgVendidos, 2),
                'cu_mensual'    => round($cu, 3)
            ];
        }

        $totalesPareto = [
            'clasificacion' => 'Total general',
            'valor'         => round($totalValorPareto, 2),
            'kg_vendidos'   => round($totalKgVendidos, 2),
            'cu_mensual'    => round(($totalKgVendidos > 0 ? ($totalValorPareto / $totalKgVendidos) : 0), 3)
        ];

        // 5. TABLA 2: "Costo por Granja Galpon Linea"
        $whereClasifDetalle = "";
        $paramsDetalle = [':mes_ini' => $mesIni, ':mes_fin' => $mesFin];

        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifConditionsD = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifConditionsD[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey = ":cl_d_{$idx}";
                    $clasifConditionsD[] = "CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey}";
                    $paramsDetalle[$pKey] = $cVal;
                }
            }
            if (!empty($clasifConditionsD)) {
                $whereClasifDetalle = " AND (" . implode(' OR ', $clasifConditionsD) . ")";
            }
        }

        $sqlDetalle = "SELECT 
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        COALESCE(TRIM(linea), '') AS linea,
                        COALESCE(TRIM(nomlinea), '') AS nomlinea,
                        COALESCE(TRIM(cencos), '') AS cencos,
                        COALESCE(TRIM(nomcencos), '') AS nomcencos,
                        COALESCE(TRIM(galpon), '') AS galpon,
                        COALESCE(TRIM(tcodigo), '') AS tcodigo,
                        COALESCE(TRIM(nomcodigo), '') AS nomcodigo,
                        SUM(timfipt) AS valor
                       FROM costomendet
                       WHERE fechames BETWEEN :mes_ini AND :mes_fin
                         {$whereClasifDetalle}
                       GROUP BY linea, nomlinea, cencos, nomcencos, galpon, tcodigo, nomcodigo
                       ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                        cencos ASC,
                        CAST(galpon AS UNSIGNED) ASC,
                        tcodigo ASC";

        $stmtDetalle = $db->prepare($sqlDetalle);
        $stmtDetalle->execute($paramsDetalle);
        $rawDetalle = $stmtDetalle->fetchAll(PDO::FETCH_ASSOC);

        // Estructurar con subtotales automáticos por Galpón y Cencos
        $tablaDetalle = [];
        $totalValorDetalle = 0.0;

        $cencosGroups = [];
        foreach ($rawDetalle as $r) {
            $clasif  = $r['clasificacion'];
            $cencos  = $r['cencos'];
            $galpon  = $r['galpon'];
            $tcodigo = $r['tcodigo'] ?: 'NULL';
            $nomcod  = $r['nomcodigo'] ?: 'NULL';
            $val     = (float)$r['valor'];

            $groupKey = $clasif . '___' . $cencos;
            if (!isset($cencosGroups[$groupKey])) {
                $cencosGroups[$groupKey] = [
                    'clasificacion' => $clasif,
                    'cencos'        => $cencos,
                    'nomcencos'     => $r['nomcencos'],
                    'galpones'      => [],
                    'total_cencos'  => 0.0
                ];
            }

            if (!isset($cencosGroups[$groupKey]['galpones'][$galpon])) {
                $cencosGroups[$groupKey]['galpones'][$galpon] = [
                    'galpon'       => $galpon,
                    'items'        => [],
                    'total_galpon' => 0.0
                ];
            }

            $cu = ($totalKgVendidos > 0) ? ($val / $totalKgVendidos) : 0.0;

            $cencosGroups[$groupKey]['galpones'][$galpon]['items'][] = [
                'tcodigo'     => $tcodigo,
                'nomcodigo'   => $nomcod,
                'valor'       => round($val, 2),
                'kg_vendidos' => round($totalKgVendidos, 2),
                'cu_mensual'  => round($cu, 3)
            ];

            $cencosGroups[$groupKey]['galpones'][$galpon]['total_galpon'] += $val;
            $cencosGroups[$groupKey]['total_cencos'] += $val;
            $totalValorDetalle += $val;
        }

        // Aplanar con filas de datos y filas de subtotales
        foreach ($cencosGroups as $cg) {
            $isFirstCencosRow = true;

            foreach ($cg['galpones'] as $galKey => $gData) {
                $isFirstGalponRow = true;

                foreach ($gData['items'] as $item) {
                    $tablaDetalle[] = [
                        'tipo_fila'     => 'item',
                        'clasificacion' => $isFirstCencosRow ? $cg['clasificacion'] : '',
                        'cencos'        => $isFirstCencosRow ? $cg['cencos'] : '',
                        'nomcencos'     => $cg['nomcencos'],
                        'galpon'        => $isFirstGalponRow ? $galKey : '',
                        'tcodigo'       => $item['tcodigo'],
                        'nomcodigo'     => $item['nomcodigo'],
                        'valor'         => $item['valor'],
                        'kg_vendidos'   => $item['kg_vendidos'],
                        'cu_mensual'    => $item['cu_mensual']
                    ];
                    $isFirstCencosRow = false;
                    $isFirstGalponRow = false;
                }

                // Fila Subtotal por Galpón
                $subCuGalpon = ($totalKgVendidos > 0) ? ($gData['total_galpon'] / $totalKgVendidos) : 0.0;
                $tablaDetalle[] = [
                    'tipo_fila'     => 'subtotal_galpon',
                    'clasificacion' => '',
                    'cencos'        => '',
                    'nomcencos'     => $cg['nomcencos'],
                    'galpon'        => 'Total',
                    'tcodigo'       => '',
                    'nomcodigo'     => '',
                    'valor'         => round($gData['total_galpon'], 2),
                    'kg_vendidos'   => round($totalKgVendidos, 2),
                    'cu_mensual'    => round($subCuGalpon, 3)
                ];
            }

            // Fila Subtotal por Cencos
            $subCuCencos = ($totalKgVendidos > 0) ? ($cg['total_cencos'] / $totalKgVendidos) : 0.0;
            $tablaDetalle[] = [
                'tipo_fila'     => 'subtotal_cencos',
                'clasificacion' => '',
                'cencos'        => 'Total',
                'nomcencos'     => $cg['nomcencos'],
                'galpon'        => '',
                'tcodigo'       => '',
                'nomcodigo'     => '',
                'valor'         => round($cg['total_cencos'], 2),
                'kg_vendidos'   => round($totalKgVendidos, 2),
                'cu_mensual'    => round($subCuCencos, 3)
            ];
        }

        return [
            'tipo_grafico'             => 'CP12 ParetoCP',
            'titulo'                   => 'Pareto del Costo & Costo por Granja Galpón Línea',
            'periodos'                 => $periodos,
            'total_kg_vendidos'        => round($totalKgVendidos, 2),
            'catalogo_clasificaciones' => $catalogoClasificaciones,
            'tabla_pareto'             => $tablaPareto,
            'totales_pareto'           => $totalesPareto,
            'tabla_detalle'            => $tablaDetalle,
            'total_registros_pareto'   => count($tablaPareto),
            'total_registros_detalle'  => count($tablaDetalle)
        ];
    }
}
