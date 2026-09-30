<?php

class Dash_RevisionAlimentoHandler
{
    private static function parseFilter($val): ?array
    {
        if ($val === null) return null;
        if (is_array($val)) {
            if (empty($val)) return [];
            $clean = [];
            $hasAll = false;
            foreach ($val as $v) {
                $v = trim((string)$v);
                if (strtoupper($v) === 'TODOS' || strtoupper($v) === 'ALL' || strtoupper($v) === '(TODO)' || strtoupper($v) === '(TODOS)') {
                    $hasAll = true;
                } elseif ($v !== '') {
                    $clean[] = $v;
                }
            }
            if ($hasAll && empty($clean)) return null;
            if (empty($clean)) return [];
            return array_values(array_unique($clean));
        }

        $val = trim((string)$val);
        if ($val === '' || strtoupper($val) === 'TODOS' || strtoupper($val) === 'ALL' || strtoupper($val) === '(TODO)' || strtoupper($val) === '(TODOS)') {
            return null;
        }
        if (strpos($val, ',') !== false) {
            $parts = explode(',', $val);
            $clean = [];
            foreach ($parts as $p) {
                $p = trim($p);
                if ($p !== '' && strtoupper($p) !== 'TODOS' && strtoupper($p) !== 'ALL' && strtoupper($p) !== '(TODO)' && strtoupper($p) !== '(TODOS)') {
                    $clean[] = $p;
                }
            }
            return !empty($clean) ? array_values(array_unique($clean)) : null;
        }
        return [$val];
    }

    private static function formatFechaLabel(string $dateStr): array
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $diasCortos = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        $mesesCortos = [
            1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr', 5 => 'may', 6 => 'jun',
            7 => 'jul', 8 => 'ago', 9 => 'set', 10 => 'oct', 11 => 'nov', 12 => 'dic'
        ];

        $ts = strtotime($dateStr);
        $w = (int)date('w', $ts);
        $diaSemana = $dias[$w] ?? '';
        $diaCorto = $diasCortos[$w] ?? '';
        $diaNum = (int)date('j', $ts);
        $mesNum = (int)date('n', $ts);
        $mesCorto = $mesesCortos[$mesNum] ?? '';
        $ymd = date('Y/m/d', $ts);

        return [
            'fecha'       => $dateStr,
            'dia_mes'     => "{$diaNum} {$mesCorto}",
            'dia_semana'  => $diaSemana,
            'dia_corto'   => $diaCorto,
            'ymd'         => $ymd,
            'label_largo' => "{$diaSemana}, {$ymd}"
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Determinar Fecha Histórica (fechahisto)
        $fechahisto = $filtros['fechahisto'] ?? null;
        if (empty($fechahisto)) {
            $stmtLastHisto = $db->query("SELECT MAX(fechahisto) AS last_histo FROM histcostdiaalim2 WHERE fechahisto != '0000-00-00'");
            $rowHisto = $stmtLastHisto->fetch(PDO::FETCH_ASSOC);
            $fechahisto = $rowHisto['last_histo'] ?? '2026-02-26';
        }

        // 2. Determinar Rango de Fechas de Consumo (fecha)
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? null;
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? null;

        if (empty($fechaInicio) && empty($fechaFin)) {
            // Por defecto: desde el día 1 del mes de fechahisto hasta fechahisto
            $fechaInicio = date('Y-m-01', strtotime($fechahisto));
            $fechaFin = $fechahisto;
        } elseif (empty($fechaInicio)) {
            $fechaInicio = date('Y-m-01', strtotime($fechaFin));
        } elseif (empty($fechaFin)) {
            $fechaFin = $fechahisto;
        }

        if ($fechaInicio === $fechaFin) {
            $fechaInicio = date('Y-m-01', strtotime($fechaFin));
        }

        // 3. Factores CF y CM para el período
        $periodo = substr($fechahisto, 0, 7); // ej: '2026-02'
        $factorCF = 0.114; // Default Tableau
        try {
            $stmtCF = $db->prepare("SELECT factor_cf FROM conf_factor_alimento WHERE periodo = ? LIMIT 1");
            $stmtCF->execute([$periodo]);
            $cfVal = $stmtCF->fetchColumn();
            if ($cfVal !== false && $cfVal !== null) {
                $factorCF = (float)$cfVal;
            }
        } catch (Exception $e) {
            $factorCF = 0.114;
        }

        $factorCM = 0.013; // Fijo constante Tableau
        $factorTotal = round($factorCF + $factorCM, 3);

        // 4. Construcción de Cláusula WHERE
        $where = [];
        $params = [];

        // Filtro fechahisto
        $where[] = "fechahisto = ?";
        $params[] = $fechahisto;

        // Filtro rango fecha
        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $where[] = "fecha BETWEEN ? AND ?";
            $params[] = $fechaInicio;
            $params[] = $fechaFin;
        }

        // Filtro Tipo (Tipo de AABB)
        $tipos = self::parseFilter($filtros['tipo'] ?? null);
        if ($tipos === []) {
            $where[] = "1 = 0";
        } elseif ($tipos !== null) {
            $placeholders = implode(',', array_fill(0, count($tipos), '?'));
            $where[] = "TRIM(tipo) IN ($placeholders)";
            foreach ($tipos as $t) {
                $params[] = $t;
            }
        }

        // Filtro Ítems / Alimentos
        $itemsFiltro = self::parseFilter($filtros['items'] ?? $filtros['item'] ?? $filtros['coditem'] ?? null);
        if ($itemsFiltro === []) {
            $where[] = "1 = 0";
        } elseif ($itemsFiltro !== null) {
            $itemConditions = [];
            foreach ($itemsFiltro as $it) {
                $itemConditions[] = "(TRIM(coditem) = ? OR CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) = ?)";
                $params[] = $it;
                $params[] = $it;
            }
            $where[] = '(' . implode(' OR ', $itemConditions) . ')';
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        // 5. Consulta 1: Gráfico General Diaria (Alimento 3: Costo Formula / Costo mas Factor)
        $sqlGeneral = "
            SELECT 
                fecha,
                SUM(peso) AS total_peso,
                SUM(valor) AS total_valor,
                CASE 
                    WHEN SUM(peso) > 0 THEN ROUND(SUM(valor) / SUM(peso), 3) 
                    ELSE 0.000 
                END AS pu
            FROM histcostdiaalim2
            {$whereSql}
            GROUP BY fecha
            ORDER BY fecha ASC
        ";
        $stmtGen = $db->prepare($sqlGeneral);
        $stmtGen->execute($params);
        $rawGeneral = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

        $graficoGeneralPuntos = [];
        foreach ($rawGeneral as $rg) {
            $f = $rg['fecha'];
            $pu = (float)$rg['pu'];
            $peso = (float)$rg['total_peso'];
            $valor = (float)$rg['total_valor'];
            $puConFactor = round($pu + $factorTotal, 3);
            $fLabel = self::formatFechaLabel($f);

            $graficoGeneralPuntos[] = [
                'fecha'         => $f,
                'dia_mes'       => $fLabel['dia_mes'],
                'dia_semana'    => $fLabel['dia_semana'],
                'dia_corto'     => $fLabel['dia_corto'],
                'ymd'           => $fLabel['ymd'],
                'pu'            => $pu,
                'pu_con_factor' => $puConFactor,
                'peso'          => round($peso, 2),
                'valor'         => round($valor, 2)
            ];
        }

        // 6. Consulta 2: Desglose por Alimento / Matriz (Alimento 2 & Alimento)
        $sqlDetalle = "
            SELECT 
                fechahisto,
                fecha,
                TRIM(tipo) AS tipo,
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS item,
                SUM(peso) AS total_peso,
                SUM(valor) AS total_valor,
                CASE 
                    WHEN SUM(peso) > 0 THEN ROUND(SUM(valor) / SUM(peso), 3)
                    ELSE 0.000 
                END AS pu
            FROM histcostdiaalim2
            {$whereSql}
            GROUP BY fechahisto, fecha, tipo, coditem, nomitem
            ORDER BY tipo ASC, coditem ASC, fecha ASC
        ";
        $stmtDet = $db->prepare($sqlDetalle);
        $stmtDet->execute($params);
        $rawDetalle = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

        // Agrupación de fechas, items y subtotales por tipo
        $fechasSet = [];
        $itemsMap = [];
        $subtotalesTipoMap = [];
        $granTotalPeso = 0.0;
        $granTotalValor = 0.0;

        foreach ($rawDetalle as $row) {
            $f = $row['fecha'];
            $tipo = $row['tipo'];
            $coditem = $row['coditem'];
            $nomitem = $row['nomitem'];
            $itemFullName = $row['item'];
            $itemKey = "{$tipo}|{$coditem}";
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            $granTotalPeso += $peso;
            $granTotalValor += $valor;

            if (!isset($fechasSet[$f])) {
                $fechasSet[$f] = self::formatFechaLabel($f);
            }

            // Agrupar por Ítem
            if (!isset($itemsMap[$itemKey])) {
                $itemsMap[$itemKey] = [
                    'key'              => $itemKey,
                    'tipo'             => $tipo,
                    'coditem'          => $coditem,
                    'nomitem'          => $nomitem,
                    'item'             => $itemFullName,
                    'total_peso'       => 0.0,
                    'total_valor'      => 0.0,
                    'dias_con_datos'   => 0,
                    'valores_por_dia'  => []
                ];
            }

            $itemsMap[$itemKey]['total_peso'] += $peso;
            $itemsMap[$itemKey]['total_valor'] += $valor;
            $itemsMap[$itemKey]['dias_con_datos']++;

            $itemsMap[$itemKey]['valores_por_dia'][$f] = [
                'peso'  => round($peso, 2),
                'valor' => round($valor, 2),
                'pu'    => $pu
            ];

            // Subtotal por Tipo de AABB
            if (!isset($subtotalesTipoMap[$tipo])) {
                $subtotalesTipoMap[$tipo] = [
                    'tipo'            => $tipo,
                    'total_peso'      => 0.0,
                    'total_valor'     => 0.0,
                    'valores_por_dia' => []
                ];
            }
            $subtotalesTipoMap[$tipo]['total_peso'] += $peso;
            $subtotalesTipoMap[$tipo]['total_valor'] += $valor;

            if (!isset($subtotalesTipoMap[$tipo]['valores_por_dia'][$f])) {
                $subtotalesTipoMap[$tipo]['valores_por_dia'][$f] = [
                    'peso'  => 0.0,
                    'valor' => 0.0,
                    'pu'    => 0.000
                ];
            }
            $subtotalesTipoMap[$tipo]['valores_por_dia'][$f]['peso'] += $peso;
            $subtotalesTipoMap[$tipo]['valores_por_dia'][$f]['valor'] += $valor;
        }

        // Calcular PU ponderado en subtotales por tipo
        foreach ($subtotalesTipoMap as $tKey => &$subT) {
            $totP = $subT['total_peso'];
            $totV = $subT['total_valor'];
            $subT['pu_promedio'] = ($totP > 0) ? round($totV / $totP, 3) : 0.000;
            $subT['total_peso'] = round($totP, 2);
            $subT['total_valor'] = round($totV, 2);

            foreach ($subT['valores_por_dia'] as $df => &$diaSub) {
                $dp = $diaSub['peso'];
                $dv = $diaSub['valor'];
                $diaSub['pu'] = ($dp > 0) ? round($dv / $dp, 3) : 0.000;
                $diaSub['peso'] = round($dp, 2);
                $diaSub['valor'] = round($dv, 2);
            }
        }
        unset($subT);

        // Ordenar fechas cronológicamente
        ksort($fechasSet);
        $columnasFechas = array_values($fechasSet);

        // Construir series de puntos individuales y matriz de items
        $seriesIndividuales = [];
        $matrizItems = [];

        // Paleta de colores por Tipo AABB según Tableau
        $tipoColors = [
            '21 PRE INICIO'    => '#2563eb', // Azul
            '22 INICIO'        => '#059669', // Verde
            '23 ACABADO 1'     => '#d97706', // Ámbar / Naranja
            '24 ACABADO 2'     => '#dc2626', // Rojo
            '25 TERMINADOR'    => '#7c3aed', // Púrpura
            '26 FINALIZADOR'   => '#0891b2', // Cian
            '27 FINALIZADOR 2' => '#db2777'  // Rosa
        ];
        $fallbackPalette = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563', '#ea580c', '#65a30d'];
        $tipoColorMap = [];
        $colorIdx = 0;

        foreach ($itemsMap as $itemKey => $itInfo) {
            $totP = $itInfo['total_peso'];
            $totV = $itInfo['total_valor'];
            $puProm = ($totP > 0) ? round($totV / $totP, 3) : 0.000;
            $itInfo['pu_promedio'] = $puProm;
            $itInfo['total_peso'] = round($totP, 2);
            $itInfo['total_valor'] = round($totV, 2);

            $puntos = [];
            foreach ($columnasFechas as $col) {
                $f = $col['fecha'];
                $val = $itInfo['valores_por_dia'][$f] ?? null;
                $puntos[] = [
                    'fecha'      => $f,
                    'ymd'        => $col['ymd'],
                    'dia_semana' => $col['dia_semana'],
                    'dia_corto'  => $col['dia_corto'],
                    'dia_mes'    => $col['dia_mes'],
                    'pu'         => $val ? $val['pu'] : null,
                    'peso'       => $val ? $val['peso'] : null,
                    'valor'      => $val ? $val['valor'] : null
                ];
            }
            $itInfo['puntos'] = $puntos;

            $tipoKey = $itInfo['tipo'];
            if (!isset($tipoColorMap[$tipoKey])) {
                $tipoColorMap[$tipoKey] = $tipoColors[$tipoKey] ?? $fallbackPalette[$colorIdx % count($fallbackPalette)];
                $colorIdx++;
            }
            $itInfo['color'] = $tipoColorMap[$tipoKey];

            $matrizItems[] = $itInfo;
        }

        // 1. Matriz de tabla: Ordenar según Tableau por tipo ASC y luego por PU promedio DESC
        usort($matrizItems, function ($a, $b) {
            $cmpTipo = strcmp($a['tipo'], $b['tipo']);
            if ($cmpTipo !== 0) return $cmpTipo;
            if ($b['pu_promedio'] == $a['pu_promedio']) return 0;
            return ($b['pu_promedio'] > $a['pu_promedio']) ? 1 : -1;
        });

        // 2. Gráfico Individual (Alimento 2): Ordenar alfabéticamente por código / ítem (PL403757 M=803 primero)
        $seriesIndividuales = array_map(function ($itInfo) {
            return [
                'key'         => $itInfo['key'],
                'tipo'        => $itInfo['tipo'],
                'coditem'     => $itInfo['coditem'],
                'nomitem'     => $itInfo['nomitem'],
                'item'        => $itInfo['item'],
                'color'       => $itInfo['color'],
                'pu_promedio' => $itInfo['pu_promedio'],
                'total_peso'  => $itInfo['total_peso'],
                'total_valor' => $itInfo['total_valor'],
                'puntos'      => $itInfo['puntos']
            ];
        }, $matrizItems);

        usort($seriesIndividuales, function ($a, $b) {
            return strcmp($a['coditem'], $b['coditem']);
        });

        $puGlobal = ($granTotalPeso > 0) ? round($granTotalValor / $granTotalPeso, 3) : 0.000;

        // Calcular totales diarios consolidados para el footer
        $totalesPorDia = [];
        foreach ($columnasFechas as $col) {
            $f = $col['fecha'];
            $pesoDia = 0.0;
            $valorDia = 0.0;
            foreach ($matrizItems as $it) {
                if (isset($it['valores_por_dia'][$f])) {
                    $pesoDia += (float)($it['valores_por_dia'][$f]['peso'] ?? 0);
                    $valorDia += (float)($it['valores_por_dia'][$f]['valor'] ?? 0);
                }
            }
            $puDia = ($pesoDia > 0) ? round($valorDia / $pesoDia, 3) : 0.000;
            $totalesPorDia[$f] = [
                'fecha' => $f,
                'peso'  => round($pesoDia, 2),
                'valor' => round($valorDia, 2),
                'pu'    => $puDia
            ];
        }

        // 7. Metadatos de Filtros disponibles
        $stmtTipos = $db->prepare("
            SELECT DISTINCT TRIM(tipo) AS tipo 
            FROM histcostdiaalim2 
            WHERE fechahisto = ? AND tipo IS NOT NULL AND TRIM(tipo) != '' 
            ORDER BY tipo ASC
        ");
        $stmtTipos->execute([$fechahisto]);
        $tiposDisponibles = $stmtTipos->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $stmtItemsMeta = $db->prepare("
            SELECT DISTINCT 
                TRIM(tipo) AS tipo,
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS label
            FROM histcostdiaalim2
            WHERE fechahisto = ? AND coditem IS NOT NULL AND TRIM(coditem) != ''
            ORDER BY tipo ASC, coditem ASC
        ");
        $stmtItemsMeta->execute([$fechahisto]);
        $itemsDisponibles = $stmtItemsMeta->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $stmtHistos = $db->query("
            SELECT DISTINCT fechahisto 
            FROM histcostdiaalim2 
            WHERE fechahisto != '0000-00-00' 
            ORDER BY fechahisto DESC 
            LIMIT 40
        ");
        $fechahistoDisponibles = $stmtHistos->fetchAll(PDO::FETCH_COLUMN) ?: [];

        return [
            'success'                => true,
            'status'                 => 'success',
            'tipo_grafico'           => 'RevisionAlimento',
            'titulo'                 => 'Revisión Alimento',
            'fechahisto'             => $fechahisto,
            'fecha_inicio'           => $fechaInicio,
            'fecha_fin'              => $fechaFin,
            'factor_cf'              => $factorCF,
            'factor_cm'              => $factorCM,
            'factor_total'           => $factorTotal,
            'filtros_aplicados'      => [
                'fechahisto'   => $fechahisto,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'tipo'         => $tipos,
                'items'        => $itemsFiltro
            ],
            'resumen'                => [
                'total_peso'      => round($granTotalPeso, 2),
                'total_valor'     => round($granTotalValor, 2),
                'pu_promedio'     => $puGlobal,
                'total_items'     => count($matrizItems),
                'total_dias'      => count($columnasFechas),
                'totales_por_dia' => $totalesPorDia
            ],
            'columnas_fechas'        => $columnasFechas,
            'grafico_general'        => [
                'puntos'       => $graficoGeneralPuntos,
                'factor_cf'    => $factorCF,
                'factor_cm'    => $factorCM,
                'factor_total' => $factorTotal
            ],
            'grafico_individual'     => [
                'series' => $seriesIndividuales
            ],
            'matriz_alimento'        => [
                'columnas_fechas'    => $columnasFechas,
                'items'              => $matrizItems,
                'subtotales_tipo'    => array_values($subtotalesTipoMap),
                'totales_por_dia'    => $totalesPorDia,
                'total_items'        => count($matrizItems)
            ],
            'metadatos_filtros'      => [
                'fechahisto_disponibles' => $fechahistoDisponibles,
                'tipos_disponibles'      => $tiposDisponibles,
                'items_disponibles'      => $itemsDisponibles
            ]
        ];
    }
}
