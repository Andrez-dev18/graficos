<?php

class CP10CZonaProHandler
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

    private static $zonasProConfig = [
        '' => [
            'key'         => 'SIN_ZONA',
            'label'       => 'SIN ZONA',
            'zonageo'     => 'LA JOYA',
            'color'       => '#59a14f', // Verde Tableau
            'colorBg'     => '#f0fdf4',
            'colorBorder' => '#bbf7d0',
            'order'       => 1
        ],
        'ZONA 1' => [
            'key'         => 'ZONA_1',
            'label'       => 'ZONA 1',
            'zonageo'     => 'LA JOYA',
            'color'       => '#af7aa1', // Morado Tableau
            'colorBg'     => '#fdf4ff',
            'colorBorder' => '#f5d0fe',
            'order'       => 2
        ],
        'ZONA 2' => [
            'key'         => 'ZONA_2',
            'label'       => 'ZONA 2',
            'zonageo'     => 'LA JOYA',
            'color'       => '#f28e2b', // Naranja Tableau
            'colorBg'     => '#fff7ed',
            'colorBorder' => '#fed7aa',
            'order'       => 3
        ],
        'ZONA 3' => [
            'key'         => 'ZONA_3',
            'label'       => 'ZONA 3',
            'zonageo'     => 'LA JOYA',
            'color'       => '#e15759', // Rojo Tableau
            'colorBg'     => '#fef2f2',
            'colorBorder' => '#fecaca',
            'order'       => 4
        ],
        'ZONA 4' => [
            'key'         => 'ZONA_4',
            'label'       => 'ZONA 4',
            'zonageo'     => 'LA JOYA',
            'color'       => '#76b7b2', // Teal / Cyan Tableau
            'colorBg'     => '#f0fdfa',
            'colorBorder' => '#99f6e4',
            'order'       => 5
        ],
        'MOLLENDO A' => [
            'key'         => 'MOLLENDO_A',
            'label'       => 'MOLLENDO A',
            'zonageo'     => 'MOLLENDO',
            'color'       => '#edc948', // Amarillo / Dorado Tableau
            'colorBg'     => '#fefce8',
            'colorBorder' => '#fef08a',
            'order'       => 6
        ],
        'MOLLENDO B' => [
            'key'         => 'MOLLENDO_B',
            'label'       => 'MOLLENDO B',
            'zonageo'     => 'MOLLENDO',
            'color'       => '#4e79a7', // Azul / Steel Blue Tableau
            'colorBg'     => '#eff6ff',
            'colorBorder' => '#bfdbfe',
            'order'       => 7
        ]
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

        // 2. Obtener datos de CU agrupados por fechames, zonageo, zonapro, cencos
        $sql = "SELECT 
                    fechames,
                    COALESCE(zonageo, '') AS zonageo,
                    COALESCE(zonapro, '') AS zonapro,
                    cencos,
                    COALESCE(nomcencos, '') AS nomcencos,
                    SUM(timfipt) AS sum_timfipt,
                    AVG(kgvendidosgranja) AS avg_kgvendidos,
                    (SUM(timfipt) / AVG(kgvendidosgranja)) AS cu
                FROM costomendet
                WHERE fechames BETWEEN :mes_ini AND :mes_fin
                  AND zonageo IN ('LA JOYA', 'MOLLENDO')
                GROUP BY fechames, zonageo, zonapro, cencos, nomcencos
                HAVING avg_kgvendidos > 0 AND cu IS NOT NULL AND cu > 0
                ORDER BY fechames ASC, zonageo ASC, zonapro ASC, cencos ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([':mes_ini' => $mesIni, ':mes_fin' => $mesFin]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Estructurar árbol de cencos ordenados a partir de los datos filtrados
        $cencosOrdenadosMap = [];
        $seriesPorMes = []; // [fechames => [zonapro => [puntos]]]
        $matrizPuntos = []; // [fechames => [cencos => punto]]
        $minCu = 9999.0;
        $maxCu = 0.0;

        foreach ($rows as $m) {
            $c = trim($m['cencos']);
            $zGeo = trim($m['zonageo']);
            $zPro = trim($m['zonapro']);
            $nom  = trim($m['nomcencos']);

            if (!isset($cencosOrdenadosMap[$c])) {
                $config = self::$zonasProConfig[$zPro] ?? [
                    'key'         => $zPro ?: 'SIN_ZONA',
                    'label'       => $zPro ?: 'SIN ZONA',
                    'zonageo'     => $zGeo,
                    'color'       => '#64748b',
                    'colorBg'     => '#f8fafc',
                    'colorBorder' => '#e2e8f0',
                    'order'       => 99
                ];

                $cencosOrdenadosMap[$c] = [
                    'cencos'       => $c,
                    'nomcencos'    => $nom,
                    'zonageo'      => $zGeo,
                    'zonapro'      => $zPro,
                    'zonapro_label'=> $config['label'],
                    'color'        => $config['color'],
                    'order'        => $config['order']
                ];
            }
        }

        // Ordenar lista por orden de zona geográfica, orden de zona productiva y luego cencos
        $cencosOrdenados = array_values($cencosOrdenadosMap);
        usort($cencosOrdenados, function ($a, $b) {
            if ($a['zonageo'] !== $b['zonageo']) {
                return ($a['zonageo'] === 'LA JOYA') ? -1 : 1;
            }
            if ($a['order'] !== $b['order']) {
                return $a['order'] <=> $b['order'];
            }
            return strcmp($a['cencos'], $b['cencos']);
        });

        // 4. Poblar datos por cada mes y cada zona
        foreach ($rows as $r) {
            $fMes    = $r['fechames'];
            $zGeo    = trim($r['zonageo']);
            $zPro    = trim($r['zonapro']);
            $cencos  = trim($r['cencos']);
            $nom     = trim($r['nomcencos']);
            $cu      = (float)$r['cu'];
            $timfipt = (float)$r['sum_timfipt'];
            $kg      = (float)$r['avg_kgvendidos'];

            $parts = explode('/', $fMes);
            $y = $parts[0] ?? '';
            $m = $parts[1] ?? '01';
            $mesLarga = (self::$mesesLargo[$m] ?? $m) . ' de ' . $y;

            $config = self::$zonasProConfig[$zPro] ?? [
                'key'         => $zPro ?: 'SIN_ZONA',
                'label'       => $zPro ?: 'SIN ZONA',
                'zonageo'     => $zGeo,
                'color'       => '#64748b',
                'colorBg'     => '#f8fafc',
                'colorBorder' => '#e2e8f0'
            ];

            $punto = [
                'fechames'       => $fMes,
                'mes_larga'      => $mesLarga,
                'zonageo'        => $zGeo,
                'zonapro'        => $zPro,
                'zonapro_label'  => $config['label'],
                'color'          => $config['color'],
                'cencos'         => $cencos,
                'nomcencos'      => $nom,
                'cu'             => round($cu, 3),
                'sum_timfipt'    => round($timfipt, 2),
                'avg_kgvendidos' => round($kg, 2)
            ];

            if ($cu < $minCu) $minCu = $cu;
            if ($cu > $maxCu) $maxCu = $cu;

            // Agrupar por mes y zona productiva para trazar líneas continuas por zona
            $zKey = $zPro ?: 'SIN_ZONA';
            if (!isset($seriesPorMes[$fMes])) {
                $seriesPorMes[$fMes] = [];
            }
            if (!isset($seriesPorMes[$fMes][$zKey])) {
                $seriesPorMes[$fMes][$zKey] = [
                    'zonapro'       => $zPro,
                    'zonapro_label' => $config['label'],
                    'zonageo'       => $zGeo,
                    'color'         => $config['color'],
                    'puntos'        => []
                ];
            }
            $seriesPorMes[$fMes][$zKey]['puntos'][] = $punto;

            // Matriz directa por mes y cencos
            if (!isset($matrizPuntos[$fMes])) {
                $matrizPuntos[$fMes] = [];
            }
            $matrizPuntos[$fMes][$cencos] = $punto;
        }

        return [
            'tipo_grafico'     => 'CP10 CZonaPro',
            'titulo'           => 'Costo por Zona Productiva y Granja',
            'periodos'         => $periodos,
            'zonas_pro_config' => array_values(self::$zonasProConfig),
            'cencos_ordenados' => $cencosOrdenados,
            'series_por_mes'   => $seriesPorMes,
            'matriz_puntos'    => $matrizPuntos,
            'rango_cu'         => [
                'min' => ($minCu < 9999.0) ? floor($minCu * 10) / 10 : 4.0,
                'max' => ($maxCu > 0.0) ? ceil($maxCu * 10) / 10 : 5.5
            ],
            'total_registros'  => count($rows)
        ];
    }
}
