<?php

class MermasMesHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-06-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-07-31';

        // 1. Obtener Catálogos de Filtros Relevantes para el Almacén A10 (Planta Lima 1)
        $stmtPlacas = $db->prepare("
            SELECT DISTINCT tplaca 
            FROM movi_produccion 
            WHERE talm = 'A10'
              AND tplaca IS NOT NULL AND TRIM(tplaca) != ''
            ORDER BY tplaca ASC
        ");
        $stmtPlacas->execute();
        $placasCatalogo = $stmtPlacas->fetchAll(PDO::FETCH_COLUMN);

        $stmtClientes = $db->prepare("
            SELECT DISTINCT tprocli 
            FROM movi_produccion 
            WHERE talm = 'A10'
              AND tprocli IS NOT NULL AND TRIM(tprocli) != ''
            ORDER BY tprocli ASC
        ");
        $stmtClientes->execute();
        $clientesCatalogo = $stmtClientes->fetchAll(PDO::FETCH_COLUMN);

        $stmtItems = $db->prepare("
            SELECT DISTINCT tcodigo 
            FROM movi_produccion 
            WHERE talm = 'A10'
              AND tcodigo IS NOT NULL AND TRIM(tcodigo) != ''
            ORDER BY CAST(tcodigo AS UNSIGNED) ASC, tcodigo ASC
        ");
        $stmtItems->execute();
        $itemsCatalogo = $stmtItems->fetchAll(PDO::FETCH_COLUMN);

        // 2. Construir cláusulas WHERE
        $where = [
            "m.talm = 'A10'",
            "m.tfecfac BETWEEN :fec_ini AND :fec_fin"
        ];
        $params = [
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ];

        // Filtro Placa
        if (!empty($filtros['placa'])) {
            $placasFiltro = is_array($filtros['placa']) ? $filtros['placa'] : [$filtros['placa']];
            $placasFiltro = array_filter($placasFiltro, function($p) { return $p !== '(Todo)' && $p !== 'TODOS' && trim($p) !== ''; });
            if (!empty($placasFiltro)) {
                $placeholders = [];
                foreach ($placasFiltro as $idx => $pVal) {
                    $ph = ":placa_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $pVal;
                }
                $where[] = "m.tplaca IN (" . implode(',', $placeholders) . ")";
            }
        }

        // Filtro Cliente (CDCliente)
        if (!empty($filtros['cdcliente']) || !empty($filtros['cliente'])) {
            $cliFiltro = !empty($filtros['cdcliente']) ? $filtros['cdcliente'] : $filtros['cliente'];
            $cliFiltro = is_array($cliFiltro) ? $cliFiltro : [$cliFiltro];
            $cliFiltro = array_filter($cliFiltro, function($c) { return $c !== '(Todo)' && $c !== 'TODOS' && trim($c) !== ''; });
            if (!empty($cliFiltro)) {
                $placeholders = [];
                foreach ($cliFiltro as $idx => $cVal) {
                    $ph = ":cli_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $cVal;
                }
                $where[] = "m.tprocli IN (" . implode(',', $placeholders) . ")";
            }
        }

        // Filtro CodItem
        if (!empty($filtros['coditem']) || !empty($filtros['items'])) {
            $itemFiltro = !empty($filtros['coditem']) ? $filtros['coditem'] : $filtros['items'];
            $itemFiltro = is_array($itemFiltro) ? $itemFiltro : [$itemFiltro];
            $itemFiltro = array_filter($itemFiltro, function($it) { return $it !== '(Todo)' && $it !== 'TODOS' && trim($it) !== ''; });
            if (!empty($itemFiltro)) {
                $placeholders = [];
                foreach ($itemFiltro as $idx => $iVal) {
                    $ph = ":item_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $iVal;
                }
                $where[] = "m.tcodigo IN (" . implode(',', $placeholders) . ")";
            }
        } else {
            // Por defecto en Tableau los items analizados son 100, 103, 107
            $where[] = "m.tcodigo IN ('100', '103', '107')";
        }

        $whereSql = implode(' AND ', $where);

        // 3. Consulta Agrupada por Mes y CodItem
        $sql = "
            SELECT 
                DATE_FORMAT(m.tfecfac, '%Y-%m') as mes_num,
                m.tcodigo as coditem,
                SUM(CASE WHEN m.tcodtra = 'E100' THEN m.tpeso ELSE 0 END) as e100_entrada,
                SUM(CASE WHEN m.tcodtra = 'E101' THEN m.tpeso ELSE 0 END) as e101_entrada,
                SUM(CASE WHEN m.tcodtra IN ('S800','S801','S803','S804','S809','S810','S823') THEN m.tpeso ELSE 0 END) as s8xx_merma,
                SUM(CASE WHEN m.tcodtra = 'S800' THEN m.tpeso ELSE 0 END) as s800_transporte,
                SUM(CASE WHEN m.tcodtra = 'S801' THEN m.tpeso ELSE 0 END) as s801_almacenaje,
                SUM(CASE WHEN m.tcodtra = 'S803' THEN m.tpeso ELSE 0 END) as s803_no_apto,
                SUM(CASE WHEN m.tcodtra = 'S804' THEN m.tpeso ELSE 0 END) as s804_muerto,
                SUM(CASE WHEN m.tcodtra = 'S809' THEN m.tpeso ELSE 0 END) as s809_beneficio_m,
                SUM(CASE WHEN m.tcodtra = 'S810' THEN m.tpeso ELSE 0 END) as s810_beneficio_m,
                SUM(CASE WHEN m.tcodtra = 'S823' THEN m.tpeso ELSE 0 END) as s823_distribucion,
                
                SUM(CASE WHEN m.tcodtra = 'E100' THEN m.tkardex ELSE 0 END) as e100_val_entrada,
                SUM(CASE WHEN m.tcodtra IN ('S800','S801','S803','S804','S809','S810','S823') THEN m.tkardex ELSE 0 END) as s8xx_val_merma,
                SUM(CASE WHEN m.tcodtra = 'S800' THEN m.tkardex ELSE 0 END) as s800_val_transpo,
                SUM(CASE WHEN m.tcodtra = 'S801' THEN m.tkardex ELSE 0 END) as s801_val_almacen,
                SUM(CASE WHEN m.tcodtra = 'S803' THEN m.tkardex ELSE 0 END) as s803_val_no_apto,
                SUM(CASE WHEN m.tcodtra = 'S804' THEN m.tkardex ELSE 0 END) as s804_val_muerto,
                SUM(CASE WHEN m.tcodtra = 'S809' THEN m.tkardex ELSE 0 END) as s809_val_benefici,
                SUM(CASE WHEN m.tcodtra = 'S810' THEN m.tkardex ELSE 0 END) as s810_val_benefici,
                SUM(CASE WHEN m.tcodtra = 'S823' THEN m.tkardex ELSE 0 END) as s823_val_distribu
            FROM movi_produccion m
            WHERE {$whereSql}
            GROUP BY DATE_FORMAT(m.tfecfac, '%Y-%m'), m.tcodigo
            ORDER BY mes_num ASC, CAST(m.tcodigo AS UNSIGNED) ASC, m.tcodigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesesNombres = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
            '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
            '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
        ];

        $mesesMap = [];
        $totalGen = [
            'e100_entrada' => 0.0,
            'e101_entrada' => 0.0,
            's8xx_merma' => 0.0,
            's800_transporte' => 0.0,
            's801_almacenaje' => 0.0,
            's803_no_apto' => 0.0,
            's804_muerto' => 0.0,
            's809_beneficio_m' => 0.0,
            's810_beneficio_m' => 0.0,
            's823_distribucion' => 0.0,
            'e100_val_entrada' => 0.0,
            's8xx_val_merma' => 0.0,
            's800_val_transpo' => 0.0,
            's801_val_almacen' => 0.0,
            's803_val_no_apto' => 0.0,
            's804_val_muerto' => 0.0,
            's809_val_benefici' => 0.0,
            's810_val_benefici' => 0.0,
            's823_val_distribu' => 0.0
        ];

        foreach ($rawRows as $r) {
            $mVal = $r['mes_num'];
            if (!$mVal || $mVal === '0000-00') continue;

            $parts = explode('-', $mVal);
            $year = $parts[0];
            $monthNum = $parts[1] ?? '01';
            $mesLabel = ($mesesNombres[$monthNum] ?? $monthNum) . " de " . $year;

            if (!isset($mesesMap[$mVal])) {
                $mesesMap[$mVal] = [
                    'mes' => $mesLabel,
                    'mes_val' => $mVal,
                    'filas' => []
                ];
            }

            $e100Ent = (float)$r['e100_entrada'];
            $e101Ent = (float)$r['e101_entrada'];
            $totalEntrada = $e100Ent + $e101Ent;
            $s8xxMer = (float)$r['s8xx_merma'];
            $porcMerma = ($totalEntrada > 0) ? round(($s8xxMer / $totalEntrada) * 100, 2) : 0.0;

            $fila = [
                'coditem' => (string)$r['coditem'],
                'porc_merma_peso' => $porcMerma,
                'e100_entrada' => $e100Ent,
                'e101_entrada' => $e101Ent,
                's8xx_merma' => $s8xxMer,
                's800_transporte' => (float)$r['s800_transporte'],
                's801_almacenaje' => (float)$r['s801_almacenaje'],
                's803_no_apto' => (float)$r['s803_no_apto'],
                's804_muerto' => (float)$r['s804_muerto'],
                's809_beneficio_m' => (float)$r['s809_beneficio_m'],
                's810_beneficio_m' => (float)$r['s810_beneficio_m'],
                's823_distribucion' => (float)$r['s823_distribucion'],
                'e100_val_entrada' => (float)$r['e100_val_entrada'],
                's8xx_val_merma' => (float)$r['s8xx_val_merma'],
                's800_val_transpo' => (float)$r['s800_val_transpo'],
                's801_val_almacen' => (float)$r['s801_val_almacen'],
                's803_val_no_apto' => (float)$r['s803_val_no_apto'],
                's804_val_muerto' => (float)$r['s804_val_muerto'],
                's809_val_benefici' => (float)$r['s809_val_benefici'],
                's810_val_benefici' => (float)$r['s810_val_benefici'],
                's823_val_distribu' => (float)$r['s823_val_distribu']
            ];

            $mesesMap[$mVal]['filas'][] = $fila;

            // Sumatoria al total general
            foreach ($totalGen as $k => $v) {
                $totalGen[$k] += (float)($r[$k] ?? 0);
            }
        }

        $totalEntradaGen = $totalGen['e100_entrada'] + $totalGen['e101_entrada'];
        $totalGen['porc_merma_peso'] = ($totalEntradaGen > 0) 
            ? round(($totalGen['s8xx_merma'] / $totalEntradaGen) * 100, 2) 
            : 0.0;

        return [
            'status' => 'success',
            'opciones_filtros' => [
                'placas' => $placasCatalogo,
                'clientes' => $clientesCatalogo,
                'items' => $itemsCatalogo
            ],
            'meses' => array_values($mesesMap),
            'total_general' => $totalGen
        ];
    }
}
