<?php

class CP11AnalisisCostoProdHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-08-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $mesIni = date('Y/m', strtotime($fechaInicio));
        $mesFin = date('Y/m', strtotime($fechaFin));

        $params = [
            ':mes_ini' => $mesIni,
            ':mes_fin' => $mesFin
        ];

        // 1. KPI SUPERIOR (Análisis Costo Mensual Pollo Vivo)
        $sqlKpi = "SELECT 
                    SUM(timfipt) AS total_valor,
                    AVG(kgvendidos) AS total_kg
                   FROM costomendet
                   WHERE fechames BETWEEN :mes_ini AND :mes_fin";
        $stmtKpi = $db->prepare($sqlKpi);
        $stmtKpi->execute($params);
        $kpiRes = $stmtKpi->fetch(PDO::FETCH_ASSOC);

        $totalValor = (float)($kpiRes['total_valor'] ?? 0);
        $totalKg    = (float)($kpiRes['total_kg'] ?? 0);
        $cuMes      = ($totalKg > 0) ? round($totalValor / $totalKg, 3) : 0.0;

        $kpis = [
            'total_valor' => round($totalValor, 2),
            'total_kg'    => round($totalKg, 3),
            'cu_mes'      => $cuMes,
            'fechames'    => ($mesIni === $mesFin) ? $mesIni : "$mesIni - $mesFin"
        ];

        // 2. TABLA 1: "Costo por Granja"
        $sqlGranja = "SELECT 
                        cencos,
                        nomcencos,
                        SUM(timfipt) AS valor,
                        AVG(kgvendidosgranja) AS kg_granja,
                        MAX(liquidado) AS liquidado
                      FROM costomendet
                      WHERE fechames BETWEEN :mes_ini AND :mes_fin
                      GROUP BY cencos, nomcencos
                      HAVING SUM(timfipt) > 0 OR AVG(kgvendidosgranja) > 0
                      ORDER BY (SUM(timfipt) / AVG(kgvendidosgranja)) ASC";
        $stmtG = $db->prepare($sqlGranja);
        $stmtG->execute($params);
        $rawGranjas = $stmtG->fetchAll(PDO::FETCH_ASSOC);

        $tablaGranjas = [];
        foreach ($rawGranjas as $g) {
            $val = (float)$g['valor'];
            $kg  = (float)$g['kg_granja'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            $tablaGranjas[] = [
                'cencos'               => $g['cencos'],
                'nomcencos'            => $g['nomcencos'],
                'valor'                => round($val, 2),
                'kg_vendidos_granja'   => round($kg, 2),
                'cu_granja'            => $cu,
                'liquidado'            => strtoupper(trim($g['liquidado'] ?? 'NO'))
            ];
        }

        // 3. TABLA 2: "Costo por Granja Galpon"
        $sqlGalpon = "SELECT 
                        cencos,
                        nomcencos,
                        galpon,
                        SUM(timfipt) AS valor,
                        AVG(kgvendidosgalpon) AS kg_galpon,
                        MAX(liquidado) AS liquidado
                      FROM costomendet
                      WHERE fechames BETWEEN :mes_ini AND :mes_fin
                      GROUP BY cencos, nomcencos, galpon
                      HAVING SUM(timfipt) > 0 OR AVG(kgvendidosgalpon) > 0
                      ORDER BY 
                        cencos ASC,
                        CAST(galpon AS UNSIGNED) ASC";
        $stmtGal = $db->prepare($sqlGalpon);
        $stmtGal->execute($params);
        $rawGalpones = $stmtGal->fetchAll(PDO::FETCH_ASSOC);

        // Recolectar lista global de galpones presentes en los datos
        $galponesSet = [];
        $galponesMap = [];

        foreach ($rawGalpones as $r) {
            $c = $r['cencos'];
            $g = $r['galpon'];
            $galponesSet[$g] = true;

            $val = (float)$r['valor'];
            $kg  = (float)$r['kg_galpon'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            if (!isset($galponesMap[$c])) {
                $galponesMap[$c] = [
                    'cencos'    => $c,
                    'nomcencos' => $r['nomcencos'],
                    'galpones'  => []
                ];
            }

            $galponesMap[$c]['galpones'][$g] = [
                'galpon'             => $g,
                'valor'              => round($val, 2),
                'kg_vendidos_galpon' => round($kg, 2),
                'cu_glpn'            => $cu,
                'liquidado'          => strtoupper(trim($r['liquidado'] ?? 'NO'))
            ];
        }

        // Ordenar lista de galpones numéricamente
        $galponesDisponibles = array_keys($galponesSet);
        usort($galponesDisponibles, function ($a, $b) {
            return (int)$a - (int)$b;
        });

        $tablaGranjaGalpon = array_values($galponesMap);

        // 4. TABLA 3: "Costo por Granja Galpon Linea"
        $sqlLinea = "SELECT 
                        cencos,
                        nomcencos,
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        COALESCE(TRIM(linea), '') AS linea,
                        COALESCE(TRIM(nomlinea), '') AS nomlinea,
                        galpon,
                        SUM(timfipt) AS valor,
                        AVG(kgvendidosgalpon) AS kg_galpon
                     FROM costomendet
                     WHERE fechames BETWEEN :mes_ini AND :mes_fin
                     GROUP BY cencos, nomcencos, linea, nomlinea, galpon
                     HAVING SUM(timfipt) > 0 OR AVG(kgvendidosgalpon) > 0
                     ORDER BY 
                        cencos ASC,
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                        nomlinea ASC,
                        CAST(galpon AS UNSIGNED) ASC";
        $stmtLin = $db->prepare($sqlLinea);
        $stmtLin->execute($params);
        $rawLineas = $stmtLin->fetchAll(PDO::FETCH_ASSOC);

        $lineasMap = [];
        foreach ($rawLineas as $r) {
            $c = $r['cencos'];
            $clasif = $r['clasificacion'];
            $g = $r['galpon'];
            $val = (float)$r['valor'];
            $kg  = (float)$r['kg_galpon'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            $groupKey = $c . '___' . $clasif;
            if (!isset($lineasMap[$groupKey])) {
                $lineasMap[$groupKey] = [
                    'cencos'        => $c,
                    'nomcencos'     => $r['nomcencos'],
                    'clasificacion' => $clasif,
                    'linea'         => $r['linea'],
                    'nomlinea'      => $r['nomlinea'],
                    'galpones'      => []
                ];
            }

            $lineasMap[$groupKey]['galpones'][$g] = [
                'galpon'             => $g,
                'valor'              => round($val, 2),
                'kg_vendidos_galpon' => round($kg, 3),
                'cu_linea'           => $cu
            ];
        }

        $tablaGranjaGalponLinea = array_values($lineasMap);

        return [
            'tipo_grafico'               => 'CP11 AnalisisCostoProd',
            'titulo'                     => 'Análisis Costo Mensual Pollo Vivo',
            'kpis'                       => $kpis,
            'galpones_disponibles'       => $galponesDisponibles,
            'tabla_granja'               => $tablaGranjas,
            'tabla_granja_galpon'        => $tablaGranjaGalpon,
            'tabla_granja_galpon_linea'  => $tablaGranjaGalponLinea,
            'total_granjas'              => count($tablaGranjas),
            'total_galpones_filas'       => count($tablaGranjaGalpon),
            'total_lineas_filas'         => count($tablaGranjaGalponLinea)
        ];
    }
}
