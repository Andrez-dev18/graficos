<?php

class AnalisisMermasEscalable2Handler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-01-02';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-04-24';

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
                CASE WHEN TRIM(tprocli) = 'AQP-BENE' THEN 2 ELSE 1 END,
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

        // 4. Procesar y Agrupar Datos
        $mesesMap = [];
        $columnasMap = []; // Mapa de [coditem][codtra] -> descri
        
        // Acumuladores para cálculo de % y Totales
        $entradasPorMesItem = []; // [mes_num][coditem] -> float
        $entradasPorMes = []; // [mes_num] -> float
        $entradasPorItemGen = []; // [coditem] -> float
        $totalEntradasAbsoluto = 0.0;

        // Primer pase: recopilar columnas y bases de entrada
        foreach ($rawRows as $r) {
            $mVal = $r['mes_num'];
            $item = $r['coditem'];
            $tra  = $r['codtra'];
            $entPeso = (float)$r['entrada_peso'];

            if (!isset($entradasPorMesItem[$mVal][$item])) $entradasPorMesItem[$mVal][$item] = 0.0;
            if (!isset($entradasPorMes[$mVal])) $entradasPorMes[$mVal] = 0.0;
            if (!isset($entradasPorItemGen[$item])) $entradasPorItemGen[$item] = 0.0;

            $entradasPorMesItem[$mVal][$item] += $entPeso;
            $entradasPorMes[$mVal] += $entPeso;
            $entradasPorItemGen[$item] += $entPeso;
            $totalEntradasAbsoluto += $entPeso;

            if (!isset($columnasMap[$item][$tra])) {
                $columnasMap[$item][$tra] = $r['transaccion_descri'];
            }
        }

        // Estructuras de Totales Generales (Footer)
        $totalGenData = []; // [coditem]['columnas'][codtra] -> { cant, peso, valor, s8xx_merma, porc_merma_peso }
        $totalGenItemSubtotales = []; // [coditem] -> { cant, peso, valor, s8xx_merma, porc_merma_peso }
        $totalGenAbsoluto = [
            'cant' => 0.0,
            'peso' => 0.0,
            'valor' => 0.0,
            's8xx_merma' => 0.0,
            'porc_merma_peso' => 0.0
        ];

        // Segundo pase: armar filas por mes con totales horizontales
        foreach ($rawRows as $r) {
            $mVal = $r['mes_num'];
            if (!$mVal || $mVal === '0000-00') continue;

            $item = $r['coditem'];
            $tra  = $r['codtra'];

            $parts = explode('-', $mVal);
            $year = $parts[0];
            $monthNum = $parts[1] ?? '01';
            $mesLabel = ($mesesNombres[$monthNum] ?? $monthNum) . " de " . $year;

            if (!isset($mesesMap[$mVal])) {
                $mesesMap[$mVal] = [
                    'mes' => $mesLabel,
                    'mes_num' => $mVal,
                    'items' => [],
                    'total_general' => [
                        'cant' => 0.0,
                        'peso' => 0.0,
                        'valor' => 0.0,
                        's8xx_merma' => 0.0,
                        'porc_merma_peso' => 0.0
                    ]
                ];
            }

            if (!isset($mesesMap[$mVal]['items'][$item])) {
                $mesesMap[$mVal]['items'][$item] = [
                    'coditem' => $item,
                    'columnas' => [],
                    'totales' => [
                        'cant' => 0.0,
                        'peso' => 0.0,
                        'valor' => 0.0,
                        's8xx_merma' => 0.0,
                        'porc_merma_peso' => 0.0
                    ]
                ];
            }

            $cant = (float)$r['cant'];
            $peso = (float)$r['peso'];
            $valor = (float)$r['valor'];
            $merma = (float)$r['s8xx_merma'];

            $baseEntradaItemMes = $entradasPorMesItem[$mVal][$item] ?? 0.0;
            $porcMermaTraMes = ($baseEntradaItemMes > 0 && $merma > 0) 
                ? round(($merma / $baseEntradaItemMes) * 100, 2) 
                : 0.0;

            $mesesMap[$mVal]['items'][$item]['columnas'][$tra] = [
                'codtra' => $tra,
                'descri' => $r['transaccion_descri'],
                'cant' => $cant,
                'peso' => $peso,
                'valor' => $valor,
                's8xx_merma' => $merma,
                'porc_merma_peso' => $porcMermaTraMes
            ];

            // Acumular subtotal del Item para este mes
            $mesesMap[$mVal]['items'][$item]['totales']['cant'] += $cant;
            $mesesMap[$mVal]['items'][$item]['totales']['peso'] += $peso;
            $mesesMap[$mVal]['items'][$item]['totales']['valor'] += $valor;
            $mesesMap[$mVal]['items'][$item]['totales']['s8xx_merma'] += $merma;

            // Acumular total general del Mes (horizontal)
            $mesesMap[$mVal]['total_general']['cant'] += $cant;
            $mesesMap[$mVal]['total_general']['peso'] += $peso;
            $mesesMap[$mVal]['total_general']['valor'] += $valor;
            $mesesMap[$mVal]['total_general']['s8xx_merma'] += $merma;

            // Acumular a Total General (Footer) por transacción
            if (!isset($totalGenData[$item]['columnas'][$tra])) {
                $totalGenData[$item]['columnas'][$tra] = [
                    'codtra' => $tra,
                    'descri' => $r['transaccion_descri'],
                    'cant' => 0.0,
                    'peso' => 0.0,
                    'valor' => 0.0,
                    's8xx_merma' => 0.0,
                    'porc_merma_peso' => 0.0
                ];
            }
            $totalGenData[$item]['columnas'][$tra]['cant'] += $cant;
            $totalGenData[$item]['columnas'][$tra]['peso'] += $peso;
            $totalGenData[$item]['columnas'][$tra]['valor'] += $valor;
            $totalGenData[$item]['columnas'][$tra]['s8xx_merma'] += $merma;

            // Acumular subtotal de Item en Footer
            if (!isset($totalGenItemSubtotales[$item])) {
                $totalGenItemSubtotales[$item] = [
                    'cant' => 0.0,
                    'peso' => 0.0,
                    'valor' => 0.0,
                    's8xx_merma' => 0.0,
                    'porc_merma_peso' => 0.0
                ];
            }
            $totalGenItemSubtotales[$item]['cant'] += $cant;
            $totalGenItemSubtotales[$item]['peso'] += $peso;
            $totalGenItemSubtotales[$item]['valor'] += $valor;
            $totalGenItemSubtotales[$item]['s8xx_merma'] += $merma;

            // Acumular Gran Total Absoluto (Footer derecha)
            $totalGenAbsoluto['cant'] += $cant;
            $totalGenAbsoluto['peso'] += $peso;
            $totalGenAbsoluto['valor'] += $valor;
            $totalGenAbsoluto['s8xx_merma'] += $merma;
        }

        // Calcular porcentajes de merma finales por mes
        foreach ($mesesMap as $mVal => &$mData) {
            $baseEntradaMesTotal = $entradasPorMes[$mVal] ?? 0.0;
            
            // Limpieza de pequeños errores de redondeo flotante en total_general del mes
            foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $field) {
                if (abs($mData['total_general'][$field]) < 0.0001) {
                    $mData['total_general'][$field] = 0.0;
                }
            }
            $mData['total_general']['porc_merma_peso'] = ($baseEntradaMesTotal > 0 && $mData['total_general']['s8xx_merma'] > 0)
                ? round(($mData['total_general']['s8xx_merma'] / $baseEntradaMesTotal) * 100, 2)
                : 0.0;

            // Porcentajes para subtotales de cada item en el mes
            foreach ($mData['items'] as $itKey => &$itData) {
                $baseEntradaItem = $entradasPorMesItem[$mVal][$itKey] ?? 0.0;
                foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $field) {
                    if (abs($itData['totales'][$field]) < 0.0001) {
                        $itData['totales'][$field] = 0.0;
                    }
                }
                $itData['totales']['porc_merma_peso'] = ($baseEntradaItem > 0 && $itData['totales']['s8xx_merma'] > 0)
                    ? round(($itData['totales']['s8xx_merma'] / $baseEntradaItem) * 100, 2)
                    : 0.0;
            }
        }
        unset($mData, $itData);

        // Calcular porcentajes en Footer
        foreach ($totalGenData as $itKey => &$itColData) {
            $baseTotItem = $entradasPorItemGen[$itKey] ?? 0.0;
            foreach ($itColData['columnas'] as $traKey => &$vals) {
                if (abs($vals['cant']) < 0.0001) $vals['cant'] = 0.0;
                if (abs($vals['peso']) < 0.0001) $vals['peso'] = 0.0;
                if (abs($vals['valor']) < 0.0001) $vals['valor'] = 0.0;
                if (abs($vals['s8xx_merma']) < 0.0001) $vals['s8xx_merma'] = 0.0;

                $vals['porc_merma_peso'] = ($baseTotItem > 0 && $vals['s8xx_merma'] > 0)
                    ? round(($vals['s8xx_merma'] / $baseTotItem) * 100, 2)
                    : 0.0;
            }

            // Subtotales del item en Footer
            $totIt = &$totalGenItemSubtotales[$itKey];
            foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $field) {
                if (abs($totIt[$field]) < 0.0001) {
                    $totIt[$field] = 0.0;
                }
            }
            $totIt['porc_merma_peso'] = ($baseTotItem > 0 && $totIt['s8xx_merma'] > 0)
                ? round(($totIt['s8xx_merma'] / $baseTotItem) * 100, 2)
                : 0.0;
            $itColData['totales'] = $totIt;
        }
        unset($itColData, $vals, $totIt);

        // Gran Total Absoluto (Footer derecha)
        foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $field) {
            if (abs($totalGenAbsoluto[$field]) < 0.0001) {
                $totalGenAbsoluto[$field] = 0.0;
            }
        }
        $totalGenAbsoluto['porc_merma_peso'] = ($totalEntradasAbsoluto > 0 && $totalGenAbsoluto['s8xx_merma'] > 0)
            ? round(($totalGenAbsoluto['s8xx_merma'] / $totalEntradasAbsoluto) * 100, 2)
            : 0.0;

        // Aplanar columnas ordenadas para el frontend
        $columnasFinales = [];
        foreach ($columnasMap as $item => $tras) {
            foreach ($tras as $tra => $desc) {
                $columnasFinales[] = [
                    'coditem' => (string)$item,
                    'codtra' => (string)$tra,
                    'descri' => (string)$desc
                ];
            }
        }

        return [
            'status' => 'success',
            'opciones_filtros' => [
                'placas' => $placasCatalogo,
                'clientes' => $clientesCatalogo,
                'items' => $itemsCatalogo,
                'transacciones' => $transaccionesCatalogo
            ],
            'columnas' => $columnasFinales,
            'meses' => array_values($mesesMap),
            'total_general_items' => $totalGenData,
            'total_general_absoluto' => $totalGenAbsoluto
        ];
    }
}
