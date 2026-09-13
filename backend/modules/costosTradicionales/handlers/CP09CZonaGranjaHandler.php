<?php

class CP09CZonaGranjaHandler
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
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-01-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $mesIni = date('Y/m', strtotime($fechaInicio));
        $mesFin = date('Y/m', strtotime($fechaFin));

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

        // 2. Obtener datos de CU agrupados por fechames, zonageo, cencos
        $sql = "SELECT 
                    fechames,
                    zonageo,
                    cencos,
                    COALESCE(nomcencos, '') AS nomcencos,
                    SUM(timfipt) AS sum_timfipt,
                    AVG(kgvendidosgranja) AS avg_kgvendidos,
                    (SUM(timfipt) / AVG(kgvendidosgranja)) AS cu
                FROM costomendet
                WHERE fechames BETWEEN :mes_ini AND :mes_fin
                  AND zonageo IN ('LA JOYA', 'MOLLENDO')
                GROUP BY fechames, zonageo, cencos, nomcencos
                HAVING AVG(kgvendidosgranja) > 0 AND cu IS NOT NULL AND cu > 0
                ORDER BY fechames ASC, zonageo ASC, cencos ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Estructurar datos para el frontend
        $cencosJoyaMap = [];
        $cencosMollendoMap = [];
        $matrizMap = [];
        $seriesPorMes = []; // [fechames => ['LA JOYA' => [...], 'MOLLENDO' => [...]]]
        $rawPuntos = [];

        foreach ($rows as $r) {
            $fMes    = $r['fechames'];
            $zona    = trim($r['zonageo']);
            $cencos  = trim($r['cencos']);
            $nom     = trim($r['nomcencos']);
            $cu      = (float)$r['cu'];
            $timfipt = (float)$r['sum_timfipt'];
            $kg      = (float)$r['avg_kgvendidos'];

            $parts = explode('/', $fMes);
            $y = $parts[0] ?? '';
            $m = $parts[1] ?? '01';
            $mesLarga = (self::$mesesLargo[$m] ?? $m) . ' de ' . $y;

            $punto = [
                'fechames'      => $fMes,
                'mes_larga'     => $mesLarga,
                'zonageo'       => $zona,
                'cencos'        => $cencos,
                'nomcencos'     => $nom,
                'cu'            => round($cu, 3),
                'sum_timfipt'   => round($timfipt, 2),
                'avg_kgvendidos'=> round($kg, 2)
            ];

            $rawPuntos[] = $punto;

            // Registrar cencos por zona
            if ($zona === 'LA JOYA') {
                $cencosJoyaMap[$cencos] = $nom;
            } else if ($zona === 'MOLLENDO') {
                $cencosMollendoMap[$cencos] = $nom;
            }

            // Agrupar por mes y zona
            if (!isset($seriesPorMes[$fMes])) {
                $seriesPorMes[$fMes] = [
                    'LA JOYA'  => [],
                    'MOLLENDO' => []
                ];
            }
            $seriesPorMes[$fMes][$zona][] = $punto;

            // Matriz para tabla detalle
            $matrizKey = $zona . '_' . $cencos;
            if (!isset($matrizMap[$matrizKey])) {
                $matrizMap[$matrizKey] = [
                    'zonageo'   => $zona,
                    'cencos'    => $cencos,
                    'nomcencos' => $nom,
                    'meses'     => []
                ];
            }
            $matrizMap[$matrizKey]['meses'][$fMes] = $punto;
        }

        // Ordenar listas de cencos
        ksort($cencosJoyaMap);
        ksort($cencosMollendoMap);

        $listaJoya = [];
        foreach ($cencosJoyaMap as $c => $n) {
            $listaJoya[] = ['cencos' => $c, 'nomcencos' => $n];
        }

        $listaMollendo = [];
        foreach ($cencosMollendoMap as $c => $n) {
            $listaMollendo[] = ['cencos' => $c, 'nomcencos' => $n];
        }

        return [
            'tipo_grafico'        => 'CP09 CZonaGranja',
            'titulo'              => 'Costo por Zona Geografica y Granja',
            'periodos'            => $periodos,
            'cencos_joya'         => $listaJoya,
            'cencos_mollendo'     => $listaMollendo,
            'series_por_mes'      => $seriesPorMes,
            'raw_puntos'          => $rawPuntos,
            'tabla_matriz'        => array_values($matrizMap)
        ];
    }
}
