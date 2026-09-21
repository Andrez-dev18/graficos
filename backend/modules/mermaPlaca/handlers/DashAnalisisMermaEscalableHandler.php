<?php

class DashAnalisisMermaEscalableHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-02-23';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-03-31';

        // 1. Catálogos de Filtros Relevantes para Almacén A10
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
            ORDER BY 
                CASE 
                    WHEN tprocli = '20100154308' THEN 1
                    WHEN tprocli = 'AREQUIPA' THEN 2
                    WHEN tprocli = 'CAMANA' THEN 3
                    WHEN tprocli = 'CUZCO' THEN 4
                    WHEN tprocli = 'ILO' THEN 5
                    WHEN tprocli = 'LA JOYA' THEN 6
                    WHEN tprocli = 'MOLLENDO' THEN 7
                    WHEN tprocli = 'MOQUEGUA' THEN 8
                    WHEN tprocli = 'PEDREGAL' THEN 9
                    WHEN tprocli = 'TACNA' THEN 10
                    WHEN tprocli = 'AQP-BENE' THEN 11
                    ELSE 12
                END ASC,
                tprocli ASC
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

        $stmtTrans = $db->prepare("
            SELECT DISTINCT m.tcodtra as codtra, COALESCE(c.descri, m.tcodtra) as descri
            FROM movi_produccion m
            LEFT JOIN coal c ON m.tcodtra = c.codtra
            WHERE m.talm = 'A10'
              AND m.tcodtra IS NOT NULL AND TRIM(m.tcodtra) != ''
            ORDER BY m.tcodtra ASC
        ");
        $stmtTrans->execute();
        $transaccionesCatalogo = $stmtTrans->fetchAll(PDO::FETCH_ASSOC);

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
        }

        // Filtro CodTra
        if (!empty($filtros['codtra']) || !empty($filtros['transacciones'])) {
            $traFiltro = !empty($filtros['codtra']) ? $filtros['codtra'] : $filtros['transacciones'];
            $traFiltro = is_array($traFiltro) ? $traFiltro : [$traFiltro];
            $traFiltro = array_filter($traFiltro, function($t) { return $t !== '(Todo)' && $t !== 'TODOS' && trim($t) !== ''; });
            if (!empty($traFiltro)) {
                $placeholders = [];
                foreach ($traFiltro as $idx => $tVal) {
                    $ph = ":tra_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $tVal;
                }
                $where[] = "m.tcodtra IN (" . implode(',', $placeholders) . ")";
            }
        }

        $whereSql = implode(' AND ', $where);

        // 3. Consulta Agrupada por Mes, Item y Transacción
        $sql = "
            SELECT 
                DATE_FORMAT(m.tfecfac, '%Y-%m') as mes_num,
                m.tcodigo as coditem,
                m.tcodtra as codtra,
                COALESCE(c.descri, m.tcodtra) as transaccion_descri,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) as cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso ELSE -1 * m.tpeso END) as peso,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) as valor,
                SUM(CASE WHEN m.tcodtra IN ('S800','S801','S803','S804','S809','S810','S823') THEN m.tpeso ELSE 0 END) as s8xx_merma,
                SUM(CASE WHEN m.tcodtra IN ('E100', 'E101') THEN m.tpeso ELSE 0 END) as entrada_peso
            FROM movi_produccion m
            LEFT JOIN coal c ON m.tcodtra = c.codtra
            WHERE {$whereSql}
            GROUP BY DATE_FORMAT(m.tfecfac, '%Y-%m'), m.tcodigo, m.tcodtra, c.descri
            ORDER BY mes_num ASC, CAST(m.tcodigo AS UNSIGNED) ASC, m.tcodigo ASC, m.tcodtra ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesesNombres = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
            '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
            '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
        ];

        // 4. Identificar Meses presentes
        $mesesClaves = [];
        foreach ($rawRows as $r) {
            $mVal = $r['mes_num'];
            if (!isset($mesesClaves[$mVal])) {
                [$anio, $mesDig] = explode('-', $mVal);
                $nombreMes = $mesesNombres[$mesDig] ?? $mesDig;
                $mesesClaves[$mVal] = [
                    'key' => $mVal,
                    'label' => "{$nombreMes} de {$anio}"
                ];
            }
        }
        ksort($mesesClaves);
        $mesesLista = array_values($mesesClaves);

        // 5. Construcción de TABLA 1: General por Transacción (AnalisisMermasEscalableGral)
        // Agrupar filas por codtra sumando sobre todos los items
        $gralTraMap = [];
        $gralMesEntradas = []; // [mes_num] -> suma E100 + E101
        $gralTotalGeneral = []; // [mes_num] -> métricas totales

        foreach ($mesesLista as $mInfo) {
            $mKey = $mInfo['key'];
            $gralMesEntradas[$mKey] = 0.0;
            $gralTotalGeneral[$mKey] = [
                'cant' => 0.0,
                'peso' => 0.0,
                'valor' => 0.0,
                's8xx_merma' => 0.0,
                'porc_merma_peso' => 0.0
            ];
        }

        foreach ($rawRows as $r) {
            $mKey    = $r['mes_num'];
            $tra     = $r['codtra'];
            $c       = (float)$r['cant'];
            $p       = (float)$r['peso'];
            $v       = (float)$r['valor'];
            $m       = (float)$r['s8xx_merma'];
            $entPeso = (float)$r['entrada_peso'];

            $gralMesEntradas[$mKey] += $entPeso;

            if (!isset($gralTraMap[$tra])) {
                $gralTraMap[$tra] = [
                    'codtra' => $tra,
                    'descri' => $r['transaccion_descri'],
                    'meses' => []
                ];
                foreach ($mesesLista as $mInfo) {
                    $gralTraMap[$tra]['meses'][$mInfo['key']] = [
                        'cant' => 0.0,
                        'peso' => 0.0,
                        'valor' => 0.0,
                        's8xx_merma' => 0.0,
                        'porc_merma_peso' => ($tra === 'E100' ? 0.0 : null)
                    ];
                }
            }

            $gralTraMap[$tra]['meses'][$mKey]['cant'] += $c;
            $gralTraMap[$tra]['meses'][$mKey]['peso'] += $p;
            $gralTraMap[$tra]['meses'][$mKey]['valor'] += $v;
            $gralTraMap[$tra]['meses'][$mKey]['s8xx_merma'] += $m;

            $gralTotalGeneral[$mKey]['cant'] += $c;
            $gralTotalGeneral[$mKey]['peso'] += $p;
            $gralTotalGeneral[$mKey]['valor'] += $v;
            $gralTotalGeneral[$mKey]['s8xx_merma'] += $m;
        }

        // Calcular porcentaje en Total General de Tabla 1 y Total Horizontal General
        $totGCant = 0.0; $totGPeso = 0.0; $totGVal = 0.0; $totGMerma = 0.0;
        $totGEntradas = array_sum($gralMesEntradas);

        foreach ($mesesLista as $mInfo) {
            $mKey = $mInfo['key'];
            $entTot = $gralMesEntradas[$mKey] ?? 0.0;
            $merTot = $gralTotalGeneral[$mKey]['s8xx_merma'] ?? 0.0;
            $gralTotalGeneral[$mKey]['porc_merma_peso'] = $entTot > 0 ? (($merTot / $entTot) * 100) : 0.0;

            $totGCant += $gralTotalGeneral[$mKey]['cant'];
            $totGPeso += $gralTotalGeneral[$mKey]['peso'];
            $totGVal  += $gralTotalGeneral[$mKey]['valor'];
            $totGMerma += $merTot;
        }

        $gralTotalHorizontal = [
            'cant' => $totGCant,
            'peso' => $totGPeso,
            'valor' => $totGVal,
            's8xx_merma' => $totGMerma,
            'porc_merma_peso' => $totGEntradas > 0 ? (($totGMerma / $totGEntradas) * 100) : 0.0
        ];

        // Calcular total horizontal para cada transacción en Tabla 1
        foreach ($gralTraMap as $traKey => &$traRow) {
            $sumCant = 0.0; $sumPeso = 0.0; $sumVal = 0.0; $sumMerma = 0.0;
            foreach ($traRow['meses'] as $mKey => $mVals) {
                $sumCant += $mVals['cant'];
                $sumPeso += $mVals['peso'];
                $sumVal  += $mVals['valor'];
                $sumMerma += $mVals['s8xx_merma'];
            }
            $traRow['total_horizontal'] = [
                'cant' => $sumCant,
                'peso' => $sumPeso,
                'valor' => $sumVal,
                's8xx_merma' => $sumMerma,
                'porc_merma_peso' => ($traKey === 'E100' ? 0.0 : null)
            ];
        }
        unset($traRow);

        ksort($gralTraMap);
        $tablaGeneral = [
            'filas' => array_values($gralTraMap),
            'total_general' => $gralTotalGeneral,
            'total_horizontal' => $gralTotalHorizontal
        ];

        // 6. Construcción de TABLA 2: Desglosado por CodItem y Transacción (AnalisisMermasEscalable)
        $itemsTree = [];
        $itemEntradasPorMes = []; // [coditem][mes_num] -> float

        foreach ($rawRows as $r) {
            $item = $r['coditem'];
            $mKey = $r['mes_num'];
            $tra  = $r['codtra'];
            $c    = (float)$r['cant'];
            $p    = (float)$r['peso'];
            $v    = (float)$r['valor'];
            $m    = (float)$r['s8xx_merma'];
            $ent  = (float)$r['entrada_peso'];

            if (!isset($itemEntradasPorMes[$item][$mKey])) {
                $itemEntradasPorMes[$item][$mKey] = 0.0;
            }
            $itemEntradasPorMes[$item][$mKey] += $ent;

            if (!isset($itemsTree[$item])) {
                $itemsTree[$item] = [
                    'coditem' => $item,
                    'transacciones' => [],
                    'subtotales' => []
                ];
                foreach ($mesesLista as $mInfo) {
                    $itemsTree[$item]['subtotales'][$mInfo['key']] = [
                        'cant' => 0.0,
                        'peso' => 0.0,
                        'valor' => 0.0,
                        's8xx_merma' => 0.0,
                        'porc_merma_peso' => 0.0
                    ];
                }
            }

            if (!isset($itemsTree[$item]['transacciones'][$tra])) {
                $itemsTree[$item]['transacciones'][$tra] = [
                    'codtra' => $tra,
                    'descri' => $r['transaccion_descri'],
                    'meses' => []
                ];
                foreach ($mesesLista as $mInfo) {
                    $itemsTree[$item]['transacciones'][$tra]['meses'][$mInfo['key']] = [
                        'cant' => 0.0,
                        'peso' => 0.0,
                        'valor' => 0.0,
                        's8xx_merma' => 0.0,
                        'porc_merma_peso' => ($tra === 'E100' ? 0.0 : null)
                    ];
                }
            }

            $itemsTree[$item]['transacciones'][$tra]['meses'][$mKey]['cant'] += $c;
            $itemsTree[$item]['transacciones'][$tra]['meses'][$mKey]['peso'] += $p;
            $itemsTree[$item]['transacciones'][$tra]['meses'][$mKey]['valor'] += $v;
            $itemsTree[$item]['transacciones'][$tra]['meses'][$mKey]['s8xx_merma'] += $m;

            $itemsTree[$item]['subtotales'][$mKey]['cant'] += $c;
            $itemsTree[$item]['subtotales'][$mKey]['peso'] += $p;
            $itemsTree[$item]['subtotales'][$mKey]['valor'] += $v;
            $itemsTree[$item]['subtotales'][$mKey]['s8xx_merma'] += $m;
        }

        // Calcular porcentajes de subtotales por cada CodItem y totales horizontales
        foreach ($itemsTree as $itemKey => &$iData) {
            $subCant = 0.0; $subPeso = 0.0; $subVal = 0.0; $subMerma = 0.0;
            $itemTotEnt = !empty($itemEntradasPorMes[$itemKey]) ? array_sum($itemEntradasPorMes[$itemKey]) : 0.0;

            foreach ($mesesLista as $mInfo) {
                $mKey = $mInfo['key'];
                $itemEnt = $itemEntradasPorMes[$itemKey][$mKey] ?? 0.0;
                $itemMer = $iData['subtotales'][$mKey]['s8xx_merma'] ?? 0.0;
                $iData['subtotales'][$mKey]['porc_merma_peso'] = $itemEnt > 0 ? (($itemMer / $itemEnt) * 100) : 0.0;

                $subCant += $iData['subtotales'][$mKey]['cant'];
                $subPeso += $iData['subtotales'][$mKey]['peso'];
                $subVal  += $iData['subtotales'][$mKey]['valor'];
                $subMerma += $itemMer;
            }

            $iData['subtotal_horizontal'] = [
                'cant' => $subCant,
                'peso' => $subPeso,
                'valor' => $subVal,
                's8xx_merma' => $subMerma,
                'porc_merma_peso' => $itemTotEnt > 0 ? (($subMerma / $itemTotEnt) * 100) : 0.0
            ];

            // Horizontal por transacción dentro del ítem
            foreach ($iData['transacciones'] as $tKey => &$tRow) {
                $tCant = 0.0; $tPeso = 0.0; $tVal = 0.0; $tMerma = 0.0;
                foreach ($tRow['meses'] as $mKey => $mVals) {
                    $tCant += $mVals['cant'];
                    $tPeso += $mVals['peso'];
                    $tVal  += $mVals['valor'];
                    $tMerma += $mVals['s8xx_merma'];
                }
                $tRow['total_horizontal'] = [
                    'cant' => $tCant,
                    'peso' => $tPeso,
                    'valor' => $tVal,
                    's8xx_merma' => $tMerma,
                    'porc_merma_peso' => ($tRow['codtra'] === 'E100' ? 0.0 : null)
                ];
            }
            unset($tRow);

            ksort($iData['transacciones']);
            $iData['transacciones'] = array_values($iData['transacciones']);
        }
        unset($iData);

        // Ordenar items por código numérico
        uksort($itemsTree, function($a, $b) {
            $numA = (int)$a;
            $numB = (int)$b;
            if ($numA === $numB) return strcmp($a, $b);
            return $numA <=> $numB;
        });

        $tablaDesglosada = [
            'items' => array_values($itemsTree),
            'total_general' => $gralTotalGeneral,
            'total_horizontal' => $gralTotalHorizontal
        ];

        return [
            'status' => 'success',
            'opciones_filtros' => [
                'placas' => $placasCatalogo,
                'clientes' => $clientesCatalogo,
                'items' => $itemsCatalogo,
                'transacciones' => $transaccionesCatalogo
            ],
            'meses' => $mesesLista,
            'tabla_general' => $tablaGeneral,
            'tabla_desglosada' => $tablaDesglosada
        ];
    }
}
