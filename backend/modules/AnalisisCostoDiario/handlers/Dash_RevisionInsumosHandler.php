<?php

class Dash_RevisionInsumosHandler
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
            $stmtLastHisto = $db->query("SELECT MAX(fechahisto) AS last_histo FROM histcostdiaalim WHERE fechahisto != '0000-00-00'");
            $rowHisto = $stmtLastHisto->fetch(PDO::FETCH_ASSOC);
            $fechahisto = $rowHisto['last_histo'] ?? '2026-03-29';
        }

        // 2. Determinar Rango de Fechas de Consumo (fecha)
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? '2026-03-01';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? $fechahisto;

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

        // Filtro Tipo (INSUMO, FABRICACIO)
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

        // Filtro Transacción (S003, E003, S811)
        $transacciones = self::parseFilter($filtros['transaccion'] ?? null);
        if ($transacciones === []) {
            $where[] = "1 = 0";
        } elseif ($transacciones !== null) {
            $placeholders = implode(',', array_fill(0, count($transacciones), '?'));
            $where[] = "TRIM(transaccion) IN ($placeholders)";
            foreach ($transacciones as $tr) {
                $params[] = $tr;
            }
        }

        // Filtro Ítems (por código o descripción)
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

        // Consulta Principal: histcostdiaalim
        $sql = "
            SELECT 
                fechahisto,
                fecha,
                TRIM(tipo) AS tipo,
                TRIM(transaccion) AS transaccion,
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS item,
                SUM(peso) AS total_peso,
                SUM(valor) AS total_valor,
                SUM(cantidad) AS total_cantidad,
                CASE 
                    WHEN SUM(peso) > 0 THEN ROUND(SUM(valor) / SUM(peso), 3)
                    ELSE 0.000 
                END AS pu
            FROM histcostdiaalim
            {$whereSql}
            GROUP BY fechahisto, fecha, tipo, transaccion, coditem, nomitem
            ORDER BY tipo DESC, coditem ASC, transaccion ASC, fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar fechas únicas y matriz de items
        $fechasSet = [];
        $itemsMap = [];
        $granTotalPeso = 0.0;
        $granTotalValor = 0.0;

        foreach ($raw as $row) {
            $f = $row['fecha'];
            $tipo = $row['tipo'];
            $trans = $row['transaccion'];
            $coditem = $row['coditem'];
            $nomitem = $row['nomitem'];
            $itemFullName = $row['item'];
            $itemKey = "{$tipo}|{$coditem}|{$trans}";
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            $granTotalPeso += $peso;
            $granTotalValor += $valor;

            if (!isset($fechasSet[$f])) {
                $fechasSet[$f] = self::formatFechaLabel($f);
            }

            if (!isset($itemsMap[$itemKey])) {
                $itemsMap[$itemKey] = [
                    'key'              => $itemKey,
                    'tipo'             => $tipo,
                    'transaccion'      => $trans,
                    'coditem'          => $coditem,
                    'nomitem'          => $nomitem,
                    'item'             => $itemFullName,
                    'total_peso'       => 0.0,
                    'total_valor'      => 0.0,
                    'dias_con_datos'   => 0,
                    'puntos'           => [],
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
        }

        // Ordenar columnas de fechas cronológicamente
        ksort($fechasSet);
        $columnasFechas = array_values($fechasSet);

        // Construir series de puntos y PU promedio para cada ítem
        $tendenciaSeries = [];
        $matrizItems = [];

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

            $tendenciaSeries[] = [
                'key'         => $itemKey,
                'tipo'        => $itInfo['tipo'],
                'transaccion' => $itInfo['transaccion'],
                'coditem'     => $itInfo['coditem'],
                'nomitem'     => $itInfo['nomitem'],
                'item'        => $itInfo['item'],
                'pu_promedio' => $puProm,
                'total_peso'  => $itInfo['total_peso'],
                'total_valor' => $itInfo['total_valor'],
                'puntos'      => $puntos
            ];

            $matrizItems[] = $itInfo;
        }

        $puGlobal = ($granTotalPeso > 0) ? round($granTotalValor / $granTotalPeso, 3) : 0.000;

        // Calcular totales generales por día (para el footer de la matriz)
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

        // Metadatos de filtros disponibles para esta consulta / fechahisto
        $stmtFiltrosMeta = $db->prepare("
            SELECT DISTINCT 
                TRIM(tipo) AS tipo,
                TRIM(transaccion) AS transaccion,
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS item
            FROM histcostdiaalim
            WHERE fechahisto = ?
            ORDER BY tipo DESC, coditem ASC
        ");
        $stmtFiltrosMeta->execute([$fechahisto]);
        $rawMeta = $stmtFiltrosMeta->fetchAll(PDO::FETCH_ASSOC);

        $tiposDisponibles = [];
        $transDisponibles = [];
        $itemsDisponibles = [];

        foreach ($rawMeta as $m) {
            if ($m['tipo'] && !in_array($m['tipo'], $tiposDisponibles)) $tiposDisponibles[] = $m['tipo'];
            if ($m['transaccion'] && !in_array($m['transaccion'], $transDisponibles)) $transDisponibles[] = $m['transaccion'];
            $itemsDisponibles[] = [
                'coditem' => $m['coditem'],
                'nomitem' => $m['nomitem'],
                'item'    => $m['item'],
                'tipo'    => $m['tipo']
            ];
        }

        // Obtener lista de fechas históricas disponibles
        $stmtHistos = $db->query("
            SELECT DISTINCT fechahisto 
            FROM histcostdiaalim 
            WHERE fechahisto != '0000-00-00' 
            ORDER BY fechahisto DESC 
            LIMIT 60
        ");
        $fechahistoDisponibles = $stmtHistos->fetchAll(PDO::FETCH_COLUMN);

        // Ítems por defecto de Tableau
        $itemsDefectoTableau = [
            'M0000001 MAIZ GRANO',
            'M0000011 ACEITE  CRUDO DE SOYA',
            'M0000020 TORTA DE SOYA HYPRO',
            'M0020017 IVERDROG',
            'M0030004 NUCLEO 1 POLLO',
            'M0030005 NUCLEO 2 POLLO',
            'M0030006 NUCLEO 3 POLLO',
            'M0030007 NUCLEO 4 POLLO',
            'M0030010 NUCLEO 0 POLLO'
        ];

        return [
            'success'                => true,
            'status'                 => 'success',
            'tipo_grafico'           => 'RevisionInsumos',
            'titulo'                 => 'Revisión Insumos',
            'fechahisto'             => $fechahisto,
            'fecha_inicio'           => $fechaInicio,
            'fecha_fin'              => $fechaFin,
            'filtros_aplicados'      => [
                'fechahisto'   => $fechahisto,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'tipo'         => $tipos,
                'transaccion'  => $transacciones,
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
            'tendencia_insumos'      => $tendenciaSeries,
            'matriz_insumos'         => [
                'columnas_fechas' => $columnasFechas,
                'items'           => $matrizItems,
                'totales_por_dia' => $totalesPorDia,
                'total_items'     => count($matrizItems)
            ],
            'metadatos_filtros'      => [
                'fechahisto_disponibles'    => $fechahistoDisponibles,
                'tipos_disponibles'         => $tiposDisponibles,
                'transacciones_disponibles' => $transDisponibles,
                'items_disponibles'         => $itemsDisponibles,
                'items_defecto'             => $itemsDefectoTableau
            ]
        ];
    }
}
