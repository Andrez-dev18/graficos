<?php

class Dash_CostoFormulaInsumosHandler
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
                if (strtoupper($v) === 'TODOS' || strtoupper($v) === 'ALL' || strtoupper($v) === '(TODO)') {
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
        if ($val === '' || strtoupper($val) === 'TODOS' || strtoupper($val) === 'ALL' || strtoupper($val) === '(TODO)') {
            return null;
        }
        if (strpos($val, ',') !== false) {
            $parts = explode(',', $val);
            $clean = [];
            foreach ($parts as $p) {
                $p = trim($p);
                if ($p !== '' && strtoupper($p) !== 'TODOS' && strtoupper($p) !== 'ALL' && strtoupper($p) !== '(TODO)') {
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
        // 1. Rango de Fechas
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? '2026-02-19';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? '2026-03-21';

        $whereGeneral = [];
        $paramsGeneral = [];

        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereGeneral[] = "fecha BETWEEN ? AND ?";
            $paramsGeneral[] = $fechaInicio;
            $paramsGeneral[] = $fechaFin;
        }

        $whereGenSql = !empty($whereGeneral) ? 'WHERE ' . implode(' AND ', $whereGeneral) : '';

        // -------------------------------------------------------------
        // CONSULTA 1: Costo Formula Alimento General (Gráfica Superior)
        // Tabla: histcostdiaalim2
        // -------------------------------------------------------------
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
            {$whereGenSql}
            GROUP BY fecha
            ORDER BY fecha ASC
        ";

        $stmtGen = $db->prepare($sqlGeneral);
        $stmtGen->execute($paramsGeneral);
        $rawGeneral = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

        $alimentoGeneral = [];
        $granTotalPeso = 0.0;
        $granTotalValor = 0.0;
        $minPu = null;
        $maxPu = null;

        foreach ($rawGeneral as $row) {
            $fInfo = self::formatFechaLabel($row['fecha']);
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            $granTotalPeso += $peso;
            $granTotalValor += $valor;

            if ($minPu === null || $pu < $minPu) $minPu = $pu;
            if ($maxPu === null || $pu > $maxPu) $maxPu = $pu;

            $alimentoGeneral[] = [
                'fecha'       => $row['fecha'],
                'dia_mes'     => $fInfo['dia_mes'],
                'dia_semana'  => $fInfo['dia_semana'],
                'dia_corto'   => $fInfo['dia_corto'],
                'ymd'         => $fInfo['ymd'],
                'fecha_label' => $fInfo['label_largo'],
                'peso'        => round($peso, 2),
                'valor'       => round($valor, 2),
                'pu'          => $pu
            ];
        }

        $puGeneralGlobal = ($granTotalPeso > 0) ? round($granTotalValor / $granTotalPeso, 3) : 0.000;

        // -------------------------------------------------------------
        // CONSULTA 2: Detalle de Insumos (Matriz Tabular Inferior Izquierda)
        // Tabla: histcostdiaalim
        // -------------------------------------------------------------
        $whereInsumos = [];
        $paramsInsumos = [];

        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereInsumos[] = "fechahisto BETWEEN ? AND ?";
            $paramsInsumos[] = $fechaInicio;
            $paramsInsumos[] = $fechaFin;
        }

        $whereInsumos[] = "TRIM(IFNULL(tipo, '')) != ''";

        // Filtro de tipo de insumo si aplica
        $tiposInsumo = self::parseFilter($filtros['tipo_insumo'] ?? $filtros['tipo'] ?? null);
        if ($tiposInsumo === []) {
            $whereInsumos[] = "1 = 0";
        } elseif ($tiposInsumo !== null) {
            $placeholders = implode(',', array_fill(0, count($tiposInsumo), '?'));
            $whereInsumos[] = "TRIM(tipo) IN ($placeholders)";
            foreach ($tiposInsumo as $ti) {
                $paramsInsumos[] = $ti;
            }
        }

        $whereInsSql = !empty($whereInsumos) ? 'WHERE ' . implode(' AND ', $whereInsumos) : '';

        $sqlInsumos = "
            SELECT 
                fechahisto AS fecha,
                TRIM(tipo) AS tipo,
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
            {$whereInsSql}
            GROUP BY fechahisto, tipo, coditem, nomitem
            ORDER BY tipo DESC, coditem ASC, fechahisto ASC
        ";

        $stmtIns = $db->prepare($sqlInsumos);
        $stmtIns->execute($paramsInsumos);
        $rawInsumos = $stmtIns->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar fechas únicas y matriz de items
        $fechasSet = [];
        $itemsMap = [];
        $tiposSet = [];

        foreach ($rawInsumos as $row) {
            $f = $row['fecha'];
            $tipo = $row['tipo'];
            $coditem = $row['coditem'];
            $nomitem = $row['nomitem'];
            $itemKey = $coditem;
            $peso = (float)$row['total_peso'];
            $valor = (float)$row['total_valor'];
            $pu = (float)$row['pu'];

            if (!isset($fechasSet[$f])) {
                $fechasSet[$f] = self::formatFechaLabel($f);
            }

            $tiposSet[$tipo] = true;

            if (!isset($itemsMap[$itemKey])) {
                $itemsMap[$itemKey] = [
                    'tipo'             => $tipo,
                    'coditem'          => $coditem,
                    'nomitem'          => $nomitem,
                    'item'             => $row['item'],
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
                'pu'    => $pu,
                'peso'  => round($peso, 2),
                'valor' => round($valor, 2)
            ];
        }

        // Ordenar columnas de fechas cronológicamente
        ksort($fechasSet);
        $columnasFechas = array_values($fechasSet);

        // Finalizar filas de items con PU promedio
        $itemsFilas = [];
        foreach ($itemsMap as $itemKey => $itemInfo) {
            $totP = $itemInfo['total_peso'];
            $totV = $itemInfo['total_valor'];
            $itemInfo['pu_promedio'] = ($totP > 0) ? round($totV / $totP, 3) : 0.000;
            $itemInfo['total_peso'] = round($totP, 2);
            $itemInfo['total_valor'] = round($totV, 2);
            $itemsFilas[] = $itemInfo;
        }

        // -------------------------------------------------------------
        // CONSULTA 3: Tendencia de Insumo Seleccionado (Gráfica Inferior Derecha)
        // -------------------------------------------------------------
        $insumoSeleccionado = $filtros['insumo_seleccionado'] ?? $filtros['coditem'] ?? null;
        
        // Si no se pasó un insumo específico, seleccionar por defecto el de mayor valor (ej: M0000001 MAIZ GRANO) o el primero
        if (empty($insumoSeleccionado) && !empty($itemsFilas)) {
            // Buscar el insumo con mayor valor total
            $topItem = $itemsFilas[0];
            foreach ($itemsFilas as $it) {
                if ($it['total_valor'] > $topItem['total_valor']) {
                    $topItem = $it;
                }
            }
            $insumoSeleccionado = $topItem['coditem'];
        }

        $insumoTendencia = [
            'coditem'        => $insumoSeleccionado,
            'item'           => '',
            'tipo'           => '',
            'puntos'         => [],
            'min_pu'         => 0.0,
            'max_pu'         => 0.0,
            'pu_promedio'    => 0.0,
            'total_peso'     => 0.0,
            'total_valor'    => 0.0
        ];

        if (!empty($insumoSeleccionado)) {
            $whereTendencia = [];
            $paramsTendencia = [];

            if (!empty($fechaInicio) && !empty($fechaFin)) {
                $whereTendencia[] = "fechahisto BETWEEN ? AND ?";
                $paramsTendencia[] = $fechaInicio;
                $paramsTendencia[] = $fechaFin;
            }

            $whereTendencia[] = "(coditem = ? OR CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) = ?)";
            $paramsTendencia[] = $insumoSeleccionado;
            $paramsTendencia[] = $insumoSeleccionado;

            $whereTendSql = 'WHERE ' . implode(' AND ', $whereTendencia);

            $sqlTend = "
                SELECT 
                    fechahisto AS fecha,
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
                FROM histcostdiaalim
                {$whereTendSql}
                GROUP BY fechahisto, tipo, coditem, nomitem
                ORDER BY fechahisto ASC
            ";

            $stmtTend = $db->prepare($sqlTend);
            $stmtTend->execute($paramsTendencia);
            $rawTend = $stmtTend->fetchAll(PDO::FETCH_ASSOC);

            $tendPuntos = [];
            $totPesoTend = 0.0;
            $totValTend = 0.0;
            $minPuTend = null;
            $maxPuTend = null;
            $nombreItemTend = '';
            $tipoItemTend = '';

            foreach ($rawTend as $row) {
                $fInfo = self::formatFechaLabel($row['fecha']);
                $peso = (float)$row['total_peso'];
                $valor = (float)$row['total_valor'];
                $pu = (float)$row['pu'];
                $nombreItemTend = $row['item'];
                $tipoItemTend = $row['tipo'];

                $totPesoTend += $peso;
                $totValTend += $valor;

                if ($minPuTend === null || $pu < $minPuTend) $minPuTend = $pu;
                if ($maxPuTend === null || $pu > $maxPuTend) $maxPuTend = $pu;

                $tendPuntos[] = [
                    'fecha'       => $row['fecha'],
                    'dia_mes'     => $fInfo['dia_mes'],
                    'dia_semana'  => $fInfo['dia_semana'],
                    'dia_corto'   => $fInfo['dia_corto'],
                    'ymd'         => $fInfo['ymd'],
                    'fecha_label' => $fInfo['label_largo'],
                    'peso'        => round($peso, 2),
                    'valor'       => round($valor, 2),
                    'pu'          => $pu
                ];
            }

            $insumoTendencia = [
                'coditem'        => $insumoSeleccionado,
                'item'           => $nombreItemTend ?: $insumoSeleccionado,
                'tipo'           => $tipoItemTend,
                'puntos'         => $tendPuntos,
                'min_pu'         => $minPuTend !== null ? round($minPuTend, 3) : 0.0,
                'max_pu'         => $maxPuTend !== null ? round($maxPuTend, 3) : 0.0,
                'pu_promedio'    => ($totPesoTend > 0) ? round($totValTend / $totPesoTend, 3) : 0.000,
                'total_peso'     => round($totPesoTend, 2),
                'total_valor'    => round($totValTend, 2)
            ];
        }

        return [
            'success'            => true,
            'status'             => 'success',
            'tipo_grafico'       => 'CostoFormula-Insumos',
            'titulo'             => 'Costo Formula - Insumos',
            'fecha_inicio'       => $fechaInicio,
            'fecha_fin'          => $fechaFin,
            'insumo_seleccionado'=> $insumoSeleccionado,
            'resumen_general'    => [
                'total_peso'     => round($granTotalPeso, 2),
                'total_valor'    => round($granTotalValor, 2),
                'pu_promedio'    => $puGeneralGlobal,
                'min_pu'         => $minPu !== null ? round($minPu, 3) : 0,
                'max_pu'         => $maxPu !== null ? round($maxPu, 3) : 0,
                'total_dias'     => count($alimentoGeneral)
            ],
            'alimento_general'   => $alimentoGeneral,
            'insumos_matriz'     => [
                'columnas_fechas'   => $columnasFechas,
                'items'             => $itemsFilas,
                'total_items'       => count($itemsFilas),
                'tipos_disponibles' => array_keys($tiposSet)
            ],
            'insumo_tendencia'   => $insumoTendencia
        ];
    }
}
