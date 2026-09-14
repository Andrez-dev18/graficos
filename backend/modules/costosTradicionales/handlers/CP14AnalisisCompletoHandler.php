<?php

class CP14AnalisisCompletoHandler
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
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-06-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $nomcencosFiltro = !empty($filtros['nomcencos']) ? $filtros['nomcencos'] : null;
        $galponFiltro    = !empty($filtros['galpon']) ? $filtros['galpon'] : null;
        $clasifFiltro    = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;

        $mesIni = date('Y/m', strtotime($fechaInicio));
        $mesFin = date('Y/m', strtotime($fechaFin));

        // 1. Obtener lista de filtros disponibles (para dropdowns)
        $granjasDisponibles = self::getGranjasDisponibles($db);
        $galponesDisponibles = self::getGalponesDisponibles($db);
        $clasificacionesDisponibles = self::getClasificacionesDisponibles($db);

        // 2. Obtener los periodos dentro del rango
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

        // Si todos los filtros vienen vacíos (ninguna selección inicial), retornar inmediatamente para carga instantánea
        $hasGranja = !empty($nomcencosFiltro) && $nomcencosFiltro !== '(Todo)' && $nomcencosFiltro !== 'TODOS' && (!is_array($nomcencosFiltro) || count($nomcencosFiltro) > 0);
        $hasGalpon = !empty($galponFiltro) && $galponFiltro !== '(Todo)' && $galponFiltro !== 'TODOS' && (!is_array($galponFiltro) || count($galponFiltro) > 0);
        $hasClasif = !empty($clasifFiltro) && $clasifFiltro !== '(Todo)' && $clasifFiltro !== 'TODOS' && (!is_array($clasifFiltro) || count($clasifFiltro) > 0);

        if (!$hasGranja && !$hasGalpon && !$hasClasif) {
            return [
                'tipo_grafico'        => 'CP14 AnalisisCompleto',
                'titulo'              => 'Costo Detallado por Granja Galpon Linea',
                'periodos'            => $periodos,
                'filtros_disponibles' => [
                    'granjas'          => $granjasDisponibles,
                    'galpones'         => $galponesDisponibles,
                    'clasificaciones'  => $clasificacionesDisponibles
                ],
                'jerarquia'           => [],
                'total_registros'     => 0,
                'requiere_seleccion'  => true
            ];
        }

        // 3. Configurar límite de memoria y tiempo para consultas masivas
        ini_set('memory_limit', '1536M');
        set_time_limit(180);

        // 4. Construir consulta con filtros dinámicos
        $where = ["fechames BETWEEN :mes_ini AND :mes_fin"];
        $params = [
            ':mes_ini' => $mesIni,
            ':mes_fin' => $mesFin
        ];

        if ($hasGranja) {
            if (is_array($nomcencosFiltro)) {
                $placeholders = [];
                foreach ($nomcencosFiltro as $idx => $nc) {
                    $ph = ":nc_" . $idx;
                    $placeholders[] = $ph;
                    $params[$ph] = $nc;
                }
                $where[] = "nomcencos IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "nomcencos = :nomcencos";
                $params[':nomcencos'] = $nomcencosFiltro;
            }
        }

        if ($hasGalpon) {
            if (is_array($galponFiltro)) {
                $placeholders = [];
                foreach ($galponFiltro as $idx => $g) {
                    $ph = ":g_" . $idx;
                    $placeholders[] = $ph;
                    $params[$ph] = $g;
                }
                $where[] = "galpon IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "galpon = :galpon";
                $params[':galpon'] = $galponFiltro;
            }
        }

        if ($hasClasif) {
            $totalClasifDisponibles = count($clasificacionesDisponibles);
            if (is_array($clasifFiltro)) {
                if (count($clasifFiltro) < $totalClasifDisponibles) {
                    $phLineas = [];
                    $phFulls  = [];
                    $includesNull = false;
                    foreach ($clasifFiltro as $idx => $cl) {
                        if ($cl === 'NULL' || $cl === 'SIN CLASIFICACION' || trim($cl) === '') {
                            $includesNull = true;
                            continue;
                        }
                        $phL = ":linea_" . $idx;
                        $phF = ":cl_full_" . $idx;
                        $phLineas[] = $phL;
                        $phFulls[]  = $phF;
                        $parts = explode(' ', $cl);
                        $params[$phL] = $parts[0];
                        $params[$phF] = $cl;
                    }
                    $condClasif = [];
                    if (!empty($phLineas)) {
                        $condClasif[] = "linea IN (" . implode(',', $phLineas) . ")";
                        $condClasif[] = "TRIM(CONCAT(COALESCE(linea,''), ' ', COALESCE(nomlinea,''))) IN (" . implode(',', $phFulls) . ")";
                    }
                    if ($includesNull) {
                        $condClasif[] = "(linea IS NULL OR linea = '' OR TRIM(linea) = 'NULL')";
                    }
                    if (!empty($condClasif)) {
                        $where[] = "(" . implode(' OR ', $condClasif) . ")";
                    }
                }
            } else {
                if ($clasifFiltro === 'NULL' || $clasifFiltro === 'SIN CLASIFICACION' || trim($clasifFiltro) === '') {
                    $where[] = "(linea IS NULL OR linea = '' OR TRIM(linea) = 'NULL')";
                } else {
                    $partsClasif = explode(' ', $clasifFiltro);
                    $lineaCode = $partsClasif[0];
                    $where[] = "(linea = :linea_code OR TRIM(CONCAT(COALESCE(linea,''), ' ', COALESCE(nomlinea,''))) = :clasif_full)";
                    $params[':linea_code'] = $lineaCode;
                    $params[':clasif_full'] = $clasifFiltro;
                }
            }
        }

        $whereClause = implode(' AND ', $where);

        $sql = "SELECT 
                    fechames,
                    COALESCE(linea, '') AS linea,
                    COALESCE(nomlinea, '') AS nomlinea,
                    cencos,
                    COALESCE(nomcencos, '') AS nomcencos,
                    galpon,
                    COALESCE(tcodigo, '') AS tcodigo,
                    COALESCE(nomcodigo, '') AS nomcodigo,
                    SUM(timfipt) AS sum_valor,
                    AVG(kgvendidos) AS avg_kg
                FROM costomendet
                WHERE $whereClause
                GROUP BY fechames, linea, nomlinea, cencos, nomcencos, galpon, tcodigo, nomcodigo
                ORDER BY linea ASC, cencos ASC, galpon ASC, tcodigo ASC, fechames ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // 5. Procesamiento eficiente por cursor de una sola pasada (evita agotar la RAM)
        $jerarquia = [];
        $totalesGeneralesMes = [];
        $totalRegistros = 0;

        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $totalRegistros++;
            $linea       = trim($r['linea']);
            $nomlinea    = trim($r['nomlinea']);
            $clasifKey   = $linea ? ($linea . ' ' . $nomlinea) : ($nomlinea ?: 'NULL');
            
            $cencos      = trim($r['cencos']);
            $nomcencos   = trim($r['nomcencos']);
            $galpon      = trim($r['galpon']);
            $tcodigo     = trim($r['tcodigo']);
            $nomcodigo   = trim($r['nomcodigo']);
            $fMes        = trim($r['fechames']);

            $valor = (float)$r['sum_valor'];
            $kg    = (float)$r['avg_kg'];
            $cu    = ($kg > 0) ? ($valor / $kg) : 0;

            // Claves de agrupación
            $kClasif = $clasifKey;
            $kCencos = $cencos . '_' . $nomcencos;
            $kGalpon = $galpon;
            $kItem   = $tcodigo;

            if (!isset($jerarquia[$kClasif])) {
                $jerarquia[$kClasif] = [
                    'clasificacion' => $clasifKey,
                    'linea'         => $linea,
                    'nomlinea'      => $nomlinea,
                    'cencos_list'   => [],
                    'totales_mes'   => []
                ];
            }

            if (!isset($jerarquia[$kClasif]['cencos_list'][$kCencos])) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos] = [
                    'cencos'       => $cencos,
                    'nomcencos'    => $nomcencos,
                    'galpon_list'  => [],
                    'totales_mes'  => []
                ];
            }

            if (!isset($jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon])) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon] = [
                    'galpon'       => $galpon,
                    'items_list'   => [],
                    'totales_mes'  => []
                ];
            }

            if (!isset($jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['items_list'][$kItem])) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['items_list'][$kItem] = [
                    'tcodigo'   => $tcodigo,
                    'nomcodigo' => $nomcodigo,
                    'meses'     => []
                ];
            }

            // Asignar valor del mes al item específico (solo si tiene movimiento para ahorrar RAM)
            if ($valor > 0 || $kg > 0) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['items_list'][$kItem]['meses'][$fMes] = [
                    'valor' => $valor,
                    'kg'    => $kg,
                    'cu'    => $cu
                ];
            }

            // Acumular totales en Galpón
            if (!isset($jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['totales_mes'][$fMes])) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['totales_mes'][$fMes] = [
                    'valor' => 0,
                    'kg'    => $kg,
                    'cu'    => 0
                ];
            }
            $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['totales_mes'][$fMes]['valor'] += $valor;
            if ($kg > 0) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['galpon_list'][$kGalpon]['totales_mes'][$fMes]['kg'] = $kg;
            }

            // Acumular totales en Cencos
            if (!isset($jerarquia[$kClasif]['cencos_list'][$kCencos]['totales_mes'][$fMes])) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['totales_mes'][$fMes] = [
                    'valor' => 0,
                    'kg'    => $kg,
                    'cu'    => 0
                ];
            }
            $jerarquia[$kClasif]['cencos_list'][$kCencos]['totales_mes'][$fMes]['valor'] += $valor;
            if ($kg > 0) {
                $jerarquia[$kClasif]['cencos_list'][$kCencos]['totales_mes'][$fMes]['kg'] = $kg;
            }

            // Acumular totales en Clasificación
            if (!isset($jerarquia[$kClasif]['totales_mes'][$fMes])) {
                $jerarquia[$kClasif]['totales_mes'][$fMes] = [
                    'valor' => 0,
                    'kg'    => 0,
                    'cu'    => 0
                ];
            }
            $jerarquia[$kClasif]['totales_mes'][$fMes]['valor'] += $valor;

            // Acumular totales Generales
            if (!isset($totalesGeneralesMes[$fMes])) {
                $totalesGeneralesMes[$fMes] = [
                    'valor' => 0,
                    'kg'    => $kg,
                    'cu'    => 0
                ];
            }
            $totalesGeneralesMes[$fMes]['valor'] += $valor;
            if ($kg > 0) {
                $totalesGeneralesMes[$fMes]['kg'] = $kg;
            }
        }

        // 6. Calcular CU para cada nivel de totalización y total general
        foreach ($totalesGeneralesMes as $fMes => &$totG) {
            $totG['cu'] = ($totG['kg'] > 0) ? ($totG['valor'] / $totG['kg']) : 0;
        }
        unset($totG);

        foreach ($jerarquia as &$clasif) {
            foreach ($clasif['totales_mes'] as $fMes => &$totClasif) {
                $totClasif['cu'] = ($totClasif['kg'] > 0) ? ($totClasif['valor'] / $totClasif['kg']) : 0;
            }

            foreach ($clasif['cencos_list'] as &$cencosItem) {
                foreach ($cencosItem['totales_mes'] as $fMes => &$totCencos) {
                    $totCencos['cu'] = ($totCencos['kg'] > 0) ? ($totCencos['valor'] / $totCencos['kg']) : 0;
                }

                foreach ($cencosItem['galpon_list'] as &$galponItem) {
                    foreach ($galponItem['totales_mes'] as $fMes => &$totGalpon) {
                        $totGalpon['cu'] = ($totGalpon['kg'] > 0) ? ($totGalpon['valor'] / $totGalpon['kg']) : 0;
                    }

                    // Convertir items a array indexado
                    $galponItem['items_list'] = array_values($galponItem['items_list']);
                }
                $cencosItem['galpon_list'] = array_values($cencosItem['galpon_list']);
            }
            $clasif['cencos_list'] = array_values($clasif['cencos_list']);
        }
        unset($clasif);

        return [
            'tipo_grafico'          => 'CP14 AnalisisCompleto',
            'titulo'                => 'Costo Detallado por Granja Galpon Linea',
            'periodos'              => $periodos,
            'filtros_disponibles'   => [
                'granjas'          => $granjasDisponibles,
                'galpones'         => $galponesDisponibles,
                'clasificaciones'  => $clasificacionesDisponibles
            ],
            'jerarquia'             => array_values($jerarquia),
            'totales_generales_mes' => $totalesGeneralesMes,
            'total_registros'       => $totalRegistros
        ];
    }

    private static function getGranjasDisponibles(PDO $db): array
    {
        $sql = "SELECT DISTINCT nomcencos FROM costomendet WHERE nomcencos IS NOT NULL AND nomcencos != '' ORDER BY nomcencos ASC";
        return $db->query($sql)->fetchAll(PDO::FETCH_COLUMN);
    }

    private static function getGalponesDisponibles(PDO $db): array
    {
        $sql = "SELECT DISTINCT galpon FROM costomendet WHERE galpon IS NOT NULL AND galpon != '' ORDER BY CAST(galpon AS UNSIGNED) ASC";
        return $db->query($sql)->fetchAll(PDO::FETCH_COLUMN);
    }

    private static function getClasificacionesDisponibles(PDO $db): array
    {
        $sql = "SELECT DISTINCT linea, nomlinea 
                FROM costomendet 
                ORDER BY linea ASC";
        $stmt = $db->query($sql);
        $res = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $linea = trim((string)$row['linea']);
            $nomlinea = trim((string)$row['nomlinea']);
            if ($linea === '' && $nomlinea === '') {
                $clasif = 'NULL';
            } else {
                $clasif = $linea ? ($linea . ' ' . $nomlinea) : $nomlinea;
            }
            if (!empty($clasif)) {
                $res[] = $clasif;
            }
        }
        return array_values(array_unique($res));
    }
}
