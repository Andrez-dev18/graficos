<?php

class CP03ComparativoDatosProductivosHandler
{
    /**
     * Procesa y retorna los datos para CP03 ComparativoDatosProductivos
     */
    public static function handle(PDO $db, array $filtros): array
    {
        try {
            $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : null;
            $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : null;
            $nomcencos   = !empty($filtros['nomcencos']) ? $filtros['nomcencos'] : null;
            $cencos      = !empty($filtros['cencos']) ? $filtros['cencos'] : null;

            // Construir condiciones WHERE dinámicas
            $whereClauses = ["1=1"];
            $params = [];

            if ($fechaInicio && $fechaFin) {
                $whereClauses[] = "(fecha BETWEEN :fec_ini1 AND :fec_fin1 OR fechahisto BETWEEN :fec_ini2 AND :fec_fin2)";
                $params[':fec_ini1'] = $fechaInicio;
                $params[':fec_fin1'] = $fechaFin;
                $params[':fec_ini2'] = $fechaInicio;
                $params[':fec_fin2'] = $fechaFin;
            }

            if (!empty($nomcencos) && $nomcencos !== '(Todo)' && $nomcencos !== 'Todo') {
                if (is_array($nomcencos)) {
                    $inPlaceholders = [];
                    foreach ($nomcencos as $idx => $nc) {
                        $pName = ":nc_" . $idx;
                        $inPlaceholders[] = $pName;
                        $params[$pName] = trim($nc);
                    }
                    $whereClauses[] = "nomcencos IN (" . implode(',', $inPlaceholders) . ")";
                } else {
                    // Si viene como string, puede ser LIKE si es nombre base o exacto
                    $whereClauses[] = "(nomcencos = :nomcencos OR nomcencos LIKE :nomcencos_like)";
                    $params[':nomcencos'] = trim($nomcencos);
                    $params[':nomcencos_like'] = trim($nomcencos) . '%';
                }
            }

            if (!empty($cencos) && $cencos !== '(Todo)' && $cencos !== 'Todo') {
                if (is_array($cencos)) {
                    $inPlaceholders = [];
                    foreach ($cencos as $idx => $c) {
                        $pName = ":c_" . $idx;
                        $inPlaceholders[] = $pName;
                        $params[$pName] = trim($c);
                    }
                    $whereClauses[] = "cencos IN (" . implode(',', $inPlaceholders) . ")";
                } else {
                    $whereClauses[] = "cencos = :cencos";
                    $params[':cencos'] = trim($cencos);
                }
            }

            $whereSql = implode(' AND ', $whereClauses);

            // 1. Obtener datos por Cencos y Galpón
            $sqlGalpones = "
                SELECT 
                    cencos,
                    nomcencos,
                    zona,
                    galpon,
                    MAX(fecha) AS fecha,
                    MAX(fechahisto) AS fechahisto,
                    MIN(fechamin) AS fechamin,
                    MAX(fechamax) AS fechamax,
                    SUM(saca_und) AS unidades,
                    SUM(saca_kilos) AS kilos,
                    (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS peso_promedio,
                    (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS ica,
                    (SUM(cantidadedad) / NULLIF(SUM(saca_und), 0)) AS prom_edad_venta,
                    ((SUM(pollosmuertos) / NULLIF(SUM(cargapollo), 0)) * 100) AS porc_mortalidad,
                    ((SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) / NULLIF(SUM(cantidadedad) / NULLIF(SUM(saca_und), 0), 0)) AS pgd
                FROM histodatosprodcompa
                WHERE {$whereSql}
                GROUP BY cencos, nomcencos, zona, galpon
                ORDER BY cencos ASC, CAST(galpon AS UNSIGNED) ASC, galpon ASC
            ";
            $stmtG = $db->prepare($sqlGalpones);
            $stmtG->execute($params);
            $rowsGalpones = $stmtG->fetchAll(PDO::FETCH_ASSOC);

            // 2. Obtener Totales por Cencos
            $sqlTotales = "
                SELECT 
                    cencos,
                    nomcencos,
                    zona,
                    MAX(fecha) AS fecha,
                    MAX(fechahisto) AS fechahisto,
                    MIN(fechamin) AS fechamin,
                    MAX(fechamax) AS fechamax,
                    SUM(saca_und) AS unidades,
                    SUM(saca_kilos) AS kilos,
                    (SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) AS peso_promedio,
                    (SUM(calimento) / NULLIF(SUM(saca_kilos), 0)) AS ica,
                    (SUM(cantidadedad) / NULLIF(SUM(saca_und), 0)) AS prom_edad_venta,
                    ((SUM(pollosmuertos) / NULLIF(SUM(cargapollo), 0)) * 100) AS porc_mortalidad,
                    ((SUM(saca_kilos) / NULLIF(SUM(saca_und), 0)) / NULLIF(SUM(cantidadedad) / NULLIF(SUM(saca_und), 0), 0)) AS pgd
                FROM histodatosprodcompa
                WHERE {$whereSql}
                GROUP BY cencos, nomcencos, zona
                ORDER BY cencos ASC
            ";
            $stmtT = $db->prepare($sqlTotales);
            $stmtT->execute($params);
            $rowsTotales = $stmtT->fetchAll(PDO::FETCH_ASSOC);

            $totalesMap = [];
            foreach ($rowsTotales as $t) {
                $totalesMap[$t['cencos']] = $t;
            }

            // 3. Estructurar datos agrupados por Granja (Cencos)
            $granjasMap = [];
            foreach ($rowsGalpones as $r) {
                $c = $r['cencos'];
                if (!isset($granjasMap[$c])) {
                    $granjasMap[$c] = [
                        'cencos'    => $c,
                        'nomcencos' => $r['nomcencos'],
                        'zona'      => $r['zona'],
                        'fecha'     => $r['fecha'],
                        'galpones'  => []
                    ];
                }

                $granjasMap[$c]['galpones'][] = [
                    'galpon'          => (string)$r['galpon'],
                    'cencos'          => $c,
                    'nomcencos'       => $r['nomcencos'],
                    'fecha'           => $r['fecha'],
                    'fechahisto'      => $r['fechahisto'],
                    'fechamin'        => $r['fechamin'],
                    'fechamax'        => $r['fechamax'],
                    'unidades'        => (float)$r['unidades'],
                    'kilos'           => (float)$r['kilos'],
                    'peso_promedio'   => $r['peso_promedio'] !== null ? round((float)$r['peso_promedio'], 3) : null,
                    'ica'             => $r['ica'] !== null ? round((float)$r['ica'], 3) : null,
                    'prom_edad_venta' => $r['prom_edad_venta'] !== null ? round((float)$r['prom_edad_venta'], 3) : null,
                    'porc_mortalidad' => $r['porc_mortalidad'] !== null ? round((float)$r['porc_mortalidad'], 3) : null,
                    'pgd'             => $r['pgd'] !== null ? round((float)$r['pgd'], 3) : null,
                    'is_total'        => false
                ];
            }

            // Añadir fila de Total a cada granja
            foreach ($granjasMap as $c => &$gData) {
                if (isset($totalesMap[$c])) {
                    $tot = $totalesMap[$c];
                    $gData['galpones'][] = [
                        'galpon'          => 'Total',
                        'cencos'          => $c,
                        'nomcencos'       => $tot['nomcencos'],
                        'fecha'           => $tot['fecha'],
                        'fechahisto'      => $tot['fechahisto'],
                        'fechamin'        => $tot['fechamin'],
                        'fechamax'        => $tot['fechamax'],
                        'unidades'        => (float)$tot['unidades'],
                        'kilos'           => (float)$tot['kilos'],
                        'peso_promedio'   => $tot['peso_promedio'] !== null ? round((float)$tot['peso_promedio'], 3) : null,
                        'ica'             => $tot['ica'] !== null ? round((float)$tot['ica'], 3) : null,
                        'prom_edad_venta' => $tot['prom_edad_venta'] !== null ? round((float)$tot['prom_edad_venta'], 3) : null,
                        'porc_mortalidad' => $tot['porc_mortalidad'] !== null ? round((float)$tot['porc_mortalidad'], 3) : null,
                        'pgd'             => $tot['pgd'] !== null ? round((float)$tot['pgd'], 3) : null,
                        'is_total'        => true
                    ];
                }
            }
            unset($gData);

            $granjas = array_values($granjasMap);

            // 4. Calcular tabla de "Diferencias de Datos Productivos"
            // Agrupar por galpón y comparar campañas consecutivas para ese galpón
            $galponesAgrupados = [];
            foreach ($rowsGalpones as $r) {
                $g = (string)$r['galpon'];
                if (!isset($galponesAgrupados[$g])) {
                    $galponesAgrupados[$g] = [];
                }
                $galponesAgrupados[$g][] = $r;
            }

            // Ordenar claves de galpones numéricamente
            uksort($galponesAgrupados, function($a, $b) {
                return (int)$a <=> (int)$b;
            });

            $diferencias = [];
            foreach ($galponesAgrupados as $g => $campanias) {
                $prev = null;
                foreach ($campanias as $cRow) {
                    $cant = (float)$cRow['unidades'];
                    $kilos = (float)$cRow['kilos'];
                    $peso = $cRow['peso_promedio'] !== null ? round((float)$cRow['peso_promedio'], 3) : null;
                    $ica = $cRow['ica'] !== null ? round((float)$cRow['ica'], 3) : null;
                    $edad = $cRow['prom_edad_venta'] !== null ? round((float)$cRow['prom_edad_venta'], 3) : null;
                    $mort = $cRow['porc_mortalidad'] !== null ? round((float)$cRow['porc_mortalidad'], 3) : null;
                    $pgd = $cRow['pgd'] !== null ? round((float)$cRow['pgd'], 3) : null;

                    $dCant = null;
                    $dKilos = null;
                    $dPeso = null;
                    $dIca = null;
                    $dEdad = null;
                    $dMort = null;
                    $dPgd = null;

                    if ($prev !== null) {
                        $dCant  = round($cant - (float)$prev['unidades'], 0);
                        $dKilos = round($kilos - (float)$prev['kilos'], 2);
                        $dPeso  = ($peso !== null && $prev['peso_promedio'] !== null) ? round($peso - (float)$prev['peso_promedio'], 3) : null;
                        $dIca   = ($ica !== null && $prev['ica'] !== null) ? round($ica - (float)$prev['ica'], 3) : null;
                        $dEdad  = ($edad !== null && $prev['prom_edad_venta'] !== null) ? round($edad - (float)$prev['prom_edad_venta'], 3) : null;
                        $dMort  = ($mort !== null && $prev['porc_mortalidad'] !== null) ? round($mort - (float)$prev['porc_mortalidad'], 3) : null;
                        $dPgd   = ($pgd !== null && $prev['pgd'] !== null) ? round($pgd - (float)$prev['pgd'], 3) : null;
                    }

                    $diferencias[] = [
                        'galpon'    => $g,
                        'cencos'    => $cRow['cencos'],
                        'nomcencos' => $cRow['nomcencos'],
                        'fecha'     => $cRow['fecha'],
                        'cant'      => $cant,
                        'kilos'     => $kilos,
                        'peso'      => $peso,
                        'ica'       => $ica,
                        'edad'      => $edad,
                        'mort'      => $mort,
                        'pgd'       => $pgd,
                        'dCant'     => $dCant,
                        'dKilos'    => $dKilos,
                        'dPeso'     => $dPeso,
                        'dIca'      => $dIca,
                        'dEdad'     => $dEdad,
                        'dMort'     => $dMort,
                        'dPgd'      => $dPgd
                    ];

                    $prev = $cRow;
                }
            }

            // 5. Lista de Granjas para filtro
            $sqlFiltroGranjas = "SELECT DISTINCT nomcencos, cencos FROM histodatosprodcompa ORDER BY cencos ASC";
            $granjasFiltro = $db->query($sqlFiltroGranjas)->fetchAll(PDO::FETCH_ASSOC);

            return [
                'success'           => true,
                'granjas'           => $granjas,
                'diferencias'       => $diferencias,
                'filtros_disponibles' => [
                    'granjas' => $granjasFiltro
                ],
                'resumen'           => [
                    'total_granjas'   => count($granjas),
                    'total_galpones'  => count($rowsGalpones)
                ]
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error'   => 'Error en CP03ComparativoDatosProductivosHandler: ' . $e->getMessage()
            ];
        }
    }
}
