<?php

class AnalisisMermasEscalable3Handler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2025-05-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2025-05-31';

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

        // 3. Consulta Agrupada por Cliente, Item, Mes y Transacción
        $sql = "
            SELECT 
                COALESCE(NULLIF(TRIM(m.tprocli), ''), 'SIN CLIENTE') as cdcliente,
                m.tcodigo as coditem,
                DATE_FORMAT(m.tfecfac, '%Y-%m') as mes_num,
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
            GROUP BY m.tprocli, m.tcodigo, DATE_FORMAT(m.tfecfac, '%Y-%m'), m.tcodtra, c.descri
            ORDER BY 
                m.tprocli ASC,
                CAST(m.tcodigo AS UNSIGNED) ASC, m.tcodigo ASC,
                mes_num ASC,
                m.tcodtra ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesesNombres = [
            '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
            '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
            '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
        ];

        // 4. Procesar y Agrupar Datos en Jerarquía: Cliente -> Item -> Mes
        $columnasMap = []; // [codtra] -> descri
        $entradasBases = [
            'cli_item_mes' => [], // [cli][item][mes] -> float
            'cli_item'     => [], // [cli][item] -> float
            'cli'          => [], // [cli] -> float
            'total_gen'    => 0.0
        ];

        // Primer pase: registrar columnas únicas y bases de entradas
        foreach ($rawRows as $r) {
            $cli  = $r['cdcliente'];
            $item = $r['coditem'];
            $mes  = $r['mes_num'];
            $tra  = $r['codtra'];
            $entPeso = (float)$r['entrada_peso'];

            if (!isset($columnasMap[$tra])) {
                $columnasMap[$tra] = $r['transaccion_descri'];
            }

            if (!isset($entradasBases['cli_item_mes'][$cli][$item][$mes])) $entradasBases['cli_item_mes'][$cli][$item][$mes] = 0.0;
            if (!isset($entradasBases['cli_item'][$cli][$item])) $entradasBases['cli_item'][$cli][$item] = 0.0;
            if (!isset($entradasBases['cli'][$cli])) $entradasBases['cli'][$cli] = 0.0;

            $entradasBases['cli_item_mes'][$cli][$item][$mes] += $entPeso;
            $entradasBases['cli_item'][$cli][$item] += $entPeso;
            $entradasBases['cli'][$cli] += $entPeso;
            $entradasBases['total_gen'] += $entPeso;
        }

        // Estructuras de datos jerárquicos
        $clientesMap = [];
        $totalGeneralFooter = [
            'columnas' => [],
            'totales' => ['cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0]
        ];

        // Inicializar columnas en Footer
        foreach ($columnasMap as $tra => $desc) {
            $totalGeneralFooter['columnas'][$tra] = [
                'codtra' => $tra,
                'descri' => $desc,
                'cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
            ];
        }

        // Segundo pase: armar jerarquía y acumuladores
        foreach ($rawRows as $r) {
            $cli  = $r['cdcliente'];
            $item = $r['coditem'];
            $mes  = $r['mes_num'];
            $tra  = $r['codtra'];

            $cant  = (float)$r['cant'];
            $peso  = (float)$r['peso'];
            $valor = (float)$r['valor'];
            $merma = (float)$r['s8xx_merma'];

            $parts = explode('-', $mes);
            $year = $parts[0];
            $monthNum = $parts[1] ?? '01';
            $mesLabel = ($mesesNombres[$monthNum] ?? $monthNum) . " de " . $year;

            // Nivel 1: Cliente
            if (!isset($clientesMap[$cli])) {
                $clientesMap[$cli] = [
                    'cdcliente' => $cli,
                    'items' => [],
                    'totales' => ['cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0],
                    'columnas_totales' => []
                ];
            }

            // Nivel 2: Item
            if (!isset($clientesMap[$cli]['items'][$item])) {
                $clientesMap[$cli]['items'][$item] = [
                    'coditem' => $item,
                    'meses' => [],
                    'totales' => ['cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0],
                    'columnas_totales' => []
                ];
            }

            // Nivel 3: Mes
            if (!isset($clientesMap[$cli]['items'][$item]['meses'][$mes])) {
                $clientesMap[$cli]['items'][$item]['meses'][$mes] = [
                    'mes' => $mesLabel,
                    'mes_num' => $mes,
                    'columnas' => [],
                    'totales' => ['cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0]
                ];
            }

            // % Merma para esta transacción en este mes
            $baseMes = $entradasBases['cli_item_mes'][$cli][$item][$mes] ?? 0.0;
            $porcTra = ($baseMes > 0 && $merma > 0) ? round(($merma / $baseMes) * 100, 2) : 0.0;

            $clientesMap[$cli]['items'][$item]['meses'][$mes]['columnas'][$tra] = [
                'codtra' => $tra,
                'descri' => $r['transaccion_descri'],
                'cant' => $cant,
                'peso' => $peso,
                'valor' => $valor,
                's8xx_merma' => $merma,
                'porc_merma_peso' => $porcTra
            ];

            // Acumular total horizontal del Mes
            $clientesMap[$cli]['items'][$item]['meses'][$mes]['totales']['cant'] += $cant;
            $clientesMap[$cli]['items'][$item]['meses'][$mes]['totales']['peso'] += $peso;
            $clientesMap[$cli]['items'][$item]['meses'][$mes]['totales']['valor'] += $valor;
            $clientesMap[$cli]['items'][$item]['meses'][$mes]['totales']['s8xx_merma'] += $merma;

            // Acumular subtotales del Item
            if (!isset($clientesMap[$cli]['items'][$item]['columnas_totales'][$tra])) {
                $clientesMap[$cli]['items'][$item]['columnas_totales'][$tra] = [
                    'cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
                ];
            }
            $clientesMap[$cli]['items'][$item]['columnas_totales'][$tra]['cant'] += $cant;
            $clientesMap[$cli]['items'][$item]['columnas_totales'][$tra]['peso'] += $peso;
            $clientesMap[$cli]['items'][$item]['columnas_totales'][$tra]['valor'] += $valor;
            $clientesMap[$cli]['items'][$item]['columnas_totales'][$tra]['s8xx_merma'] += $merma;

            $clientesMap[$cli]['items'][$item]['totales']['cant'] += $cant;
            $clientesMap[$cli]['items'][$item]['totales']['peso'] += $peso;
            $clientesMap[$cli]['items'][$item]['totales']['valor'] += $valor;
            $clientesMap[$cli]['items'][$item]['totales']['s8xx_merma'] += $merma;

            // Acumular subtotales del Cliente
            if (!isset($clientesMap[$cli]['columnas_totales'][$tra])) {
                $clientesMap[$cli]['columnas_totales'][$tra] = [
                    'cant' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
                ];
            }
            $clientesMap[$cli]['columnas_totales'][$tra]['cant'] += $cant;
            $clientesMap[$cli]['columnas_totales'][$tra]['peso'] += $peso;
            $clientesMap[$cli]['columnas_totales'][$tra]['valor'] += $valor;
            $clientesMap[$cli]['columnas_totales'][$tra]['s8xx_merma'] += $merma;

            $clientesMap[$cli]['totales']['cant'] += $cant;
            $clientesMap[$cli]['totales']['peso'] += $peso;
            $clientesMap[$cli]['totales']['valor'] += $valor;
            $clientesMap[$cli]['totales']['s8xx_merma'] += $merma;

            // Acumular a Total General (Footer)
            $totalGeneralFooter['columnas'][$tra]['cant'] += $cant;
            $totalGeneralFooter['columnas'][$tra]['peso'] += $peso;
            $totalGeneralFooter['columnas'][$tra]['valor'] += $valor;
            $totalGeneralFooter['columnas'][$tra]['s8xx_merma'] += $merma;

            $totalGeneralFooter['totales']['cant'] += $cant;
            $totalGeneralFooter['totales']['peso'] += $peso;
            $totalGeneralFooter['totales']['valor'] += $valor;
            $totalGeneralFooter['totales']['s8xx_merma'] += $merma;
        }

        // Tercer pase: cálculo de % y limpieza de flotantes
        foreach ($clientesMap as $cliKey => &$cliData) {
            $baseCli = $entradasBases['cli'][$cliKey] ?? 0.0;

            // % en columnas totales del cliente
            foreach ($cliData['columnas_totales'] as $traKey => &$cTot) {
                if (abs($cTot['cant']) < 0.0001) $cTot['cant'] = 0.0;
                if (abs($cTot['peso']) < 0.0001) $cTot['peso'] = 0.0;
                if (abs($cTot['valor']) < 0.0001) $cTot['valor'] = 0.0;
                if (abs($cTot['s8xx_merma']) < 0.0001) $cTot['s8xx_merma'] = 0.0;

                $cTot['porc_merma_peso'] = ($baseCli > 0 && $cTot['s8xx_merma'] > 0)
                    ? round(($cTot['s8xx_merma'] / $baseCli) * 100, 2)
                    : 0.0;
            }

            // % en totales generales del cliente
            foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $f) {
                if (abs($cliData['totales'][$f]) < 0.0001) $cliData['totales'][$f] = 0.0;
            }
            $cliData['totales']['porc_merma_peso'] = ($baseCli > 0 && $cliData['totales']['s8xx_merma'] > 0)
                ? round(($cliData['totales']['s8xx_merma'] / $baseCli) * 100, 2)
                : 0.0;

            // Por cada Item
            foreach ($cliData['items'] as $itKey => &$itData) {
                $baseItem = $entradasBases['cli_item'][$cliKey][$itKey] ?? 0.0;

                // % en columnas totales del item
                foreach ($itData['columnas_totales'] as $traKey => &$itColTot) {
                    if (abs($itColTot['cant']) < 0.0001) $itColTot['cant'] = 0.0;
                    if (abs($itColTot['peso']) < 0.0001) $itColTot['peso'] = 0.0;
                    if (abs($itColTot['valor']) < 0.0001) $itColTot['valor'] = 0.0;
                    if (abs($itColTot['s8xx_merma']) < 0.0001) $itColTot['s8xx_merma'] = 0.0;

                    $itColTot['porc_merma_peso'] = ($baseItem > 0 && $itColTot['s8xx_merma'] > 0)
                        ? round(($itColTot['s8xx_merma'] / $baseItem) * 100, 2)
                        : 0.0;
                }

                // % en totales del item
                foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $f) {
                    if (abs($itData['totales'][$f]) < 0.0001) $itData['totales'][$f] = 0.0;
                }
                $itData['totales']['porc_merma_peso'] = ($baseItem > 0 && $itData['totales']['s8xx_merma'] > 0)
                    ? round(($itData['totales']['s8xx_merma'] / $baseItem) * 100, 2)
                    : 0.0;

                // Por cada Mes
                foreach ($itData['meses'] as $mKey => &$mData) {
                    $baseMes = $entradasBases['cli_item_mes'][$cliKey][$itKey][$mKey] ?? 0.0;
                    foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $f) {
                        if (abs($mData['totales'][$f]) < 0.0001) $mData['totales'][$f] = 0.0;
                    }
                    $mData['totales']['porc_merma_peso'] = ($baseMes > 0 && $mData['totales']['s8xx_merma'] > 0)
                        ? round(($mData['totales']['s8xx_merma'] / $baseMes) * 100, 2)
                        : 0.0;
                }
                $itData['meses'] = array_values($itData['meses']);
            }
            $cliData['items'] = array_values($cliData['items']);
        }
        unset($cliData, $cTot, $itData, $itColTot, $mData);

        // Footer Total General
        $baseTotGen = $entradasBases['total_gen'] ?? 0.0;
        foreach ($totalGeneralFooter['columnas'] as $traKey => &$fgCol) {
            if (abs($fgCol['cant']) < 0.0001) $fgCol['cant'] = 0.0;
            if (abs($fgCol['peso']) < 0.0001) $fgCol['peso'] = 0.0;
            if (abs($fgCol['valor']) < 0.0001) $fgCol['valor'] = 0.0;
            if (abs($fgCol['s8xx_merma']) < 0.0001) $fgCol['s8xx_merma'] = 0.0;

            $fgCol['porc_merma_peso'] = ($baseTotGen > 0 && $fgCol['s8xx_merma'] > 0)
                ? round(($fgCol['s8xx_merma'] / $baseTotGen) * 100, 2)
                : 0.0;
        }
        foreach (['cant', 'peso', 'valor', 's8xx_merma'] as $f) {
            if (abs($totalGeneralFooter['totales'][$f]) < 0.0001) $totalGeneralFooter['totales'][$f] = 0.0;
        }
        $totalGeneralFooter['totales']['porc_merma_peso'] = ($baseTotGen > 0 && $totalGeneralFooter['totales']['s8xx_merma'] > 0)
            ? round(($totalGeneralFooter['totales']['s8xx_merma'] / $baseTotGen) * 100, 2)
            : 0.0;

        // Lista de columnas ordenada alfabéticamente
        ksort($columnasMap);
        $columnasFinales = [];
        foreach ($columnasMap as $tra => $desc) {
            $columnasFinales[] = [
                'codtra' => (string)$tra,
                'descri' => (string)$desc
            ];
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
            'clientes' => array_values($clientesMap),
            'total_general' => $totalGeneralFooter
        ];
    }
}
