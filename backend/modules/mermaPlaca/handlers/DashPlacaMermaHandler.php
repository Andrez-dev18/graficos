<?php

class DashPlacaMermaHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-02-28';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-02-28';

        // 1. Catálogos de Filtros
        $stmtCorp = $db->prepare("
            SELECT DISTINCT c1.nombre as corporativo
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE s.tline = '601' AND c1.nombre IS NOT NULL AND TRIM(c1.nombre) != ''
            ORDER BY c1.nombre ASC
        ");
        $stmtCorp->execute();
        $corporativosCatalogo = $stmtCorp->fetchAll(PDO::FETCH_COLUMN);

        $stmtPlacas = $db->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(s.placa), ''), '0') as placa
            FROM sale s
            WHERE s.tline = '601' AND s.placa IS NOT NULL AND TRIM(s.placa) != ''
            ORDER BY placa ASC
        ");
        $stmtPlacas->execute();
        $placasCatalogo = $stmtPlacas->fetchAll(PDO::FETCH_COLUMN);

        $stmtClientes = $db->prepare("
            SELECT DISTINCT tprocli 
            FROM movi_produccion 
            WHERE talm = 'A10' AND tprocli IS NOT NULL AND TRIM(tprocli) != ''
            ORDER BY tprocli ASC
        ");
        $stmtClientes->execute();
        $clientesCatalogo = $stmtClientes->fetchAll(PDO::FETCH_COLUMN);

        $stmtItems = $db->prepare("
            SELECT DISTINCT tcodigo 
            FROM movi_produccion 
            WHERE talm = 'A10' AND tcodigo IS NOT NULL AND TRIM(tcodigo) != ''
            ORDER BY CAST(tcodigo AS UNSIGNED) ASC, tcodigo ASC
        ");
        $stmtItems->execute();
        $itemsCatalogo = $stmtItems->fetchAll(PDO::FETCH_COLUMN);

        // -------------------------------------------------------------
        // 2. PARTE 1: VENTAS GENERALES (Top Left)
        // -------------------------------------------------------------
        $whereVentas = [
            "s.tfecfac BETWEEN :fec_ini AND :fec_fin",
            "s.tline = '601'"
        ];
        $paramsVentas = [
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ];

        // Filtro Corporativo
        if (!empty($filtros['corporativo'])) {
            $corpFiltro = is_array($filtros['corporativo']) ? $filtros['corporativo'] : [$filtros['corporativo']];
            $corpFiltro = array_filter($corpFiltro, function($c) { return $c !== '(Todo)' && $c !== 'TODOS' && trim($c) !== ''; });
            if (!empty($corpFiltro)) {
                $phList = [];
                foreach ($corpFiltro as $idx => $val) {
                    $ph = ":corp_{$idx}";
                    $phList[] = $ph;
                    $paramsVentas[$ph] = $val;
                }
                $whereVentas[] = "c1.nombre IN (" . implode(',', $phList) . ")";
            }
        }

        // Filtro Placa
        if (!empty($filtros['placa'])) {
            $placaFiltro = is_array($filtros['placa']) ? $filtros['placa'] : [$filtros['placa']];
            $placaFiltro = array_filter($placaFiltro, function($p) { return $p !== '(Todo)' && $p !== 'TODOS' && trim($p) !== ''; });
            if (!empty($placaFiltro)) {
                $phList = [];
                foreach ($placaFiltro as $idx => $val) {
                    $ph = ":v_placa_{$idx}";
                    $phList[] = $ph;
                    $paramsVentas[$ph] = $val;
                }
                $whereVentas[] = "COALESCE(NULLIF(TRIM(s.placa), ''), '0') IN (" . implode(',', $phList) . ")";
            }
        }

        $whereVentasSql = implode(' AND ', $whereVentas);
        $sqlVentas = "
            SELECT 
                COALESCE(c1.nombre, 'SIN CORPORATIVO') as corporativo,
                COALESCE(NULLIF(TRIM(s.placa), ''), '') as placa,
                DATE_FORMAT(s.tdate, '%e/%c/%Y') as fecreg_dmy,
                s.tdate as fecreg,
                MIN(s.ttime) as min_time,
                MAX(s.ttime) as max_time,
                c.codigo as codcliente,
                c.nombre as nomcliente,
                s.tdoc,
                s.tnumfac as nrodoc,
                s.tcodigo,
                SUM(s.tcantid) as cantidad,
                SUM(s.tespeci) as peso,
                SUM(s.timport) as valor
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereVentasSql}
            GROUP BY s.tfecfac, c1.nombre, s.placa, s.tdate, c.codigo, c.nombre, s.tdoc, s.tnumfac, s.tcodigo
            ORDER BY 
                s.tfecfac ASC,
                c1.nombre ASC, 
                CASE WHEN s.placa IS NULL OR TRIM(s.placa) = '' THEN 0 ELSE 1 END ASC, 
                s.placa ASC, 
                s.tdate ASC, 
                MIN(s.ttime) ASC, 
                MAX(s.ttime) ASC, 
                c.codigo ASC, 
                s.tdoc ASC, 
                s.tnumfac ASC, 
                CAST(s.tcodigo AS UNSIGNED) ASC
        ";
        $stmtV = $db->prepare($sqlVentas);
        $stmtV->execute($paramsVentas);
        $ventasRows = $stmtV->fetchAll(PDO::FETCH_ASSOC);

        // Estructurar VentasGenerales con Subtotales por Placa y Corporativo
        $ventasTree = [];
        foreach ($ventasRows as $vr) {
            $corp = $vr['corporativo'];
            $plc  = $vr['placa'];

            $cant = (float)$vr['cantidad'];
            $peso = (float)$vr['peso'];
            $val  = (float)$vr['valor'];

            $vr['peso_prom_venta'] = abs($cant) > 0.0001 ? ($peso / $cant) : 0.0;
            $vr['precio_prom_venta'] = abs($peso) > 0.0001 ? ($val / $peso) : 0.0;

            if (!isset($ventasTree[$corp])) {
                $ventasTree[$corp] = [
                    'corporativo' => $corp,
                    'placas' => [],
                    'total_corp' => ['cantidad' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 'peso_prom_venta' => 0.0, 'precio_prom_venta' => 0.0]
                ];
            }
            if (!isset($ventasTree[$corp]['placas'][$plc])) {
                $ventasTree[$corp]['placas'][$plc] = [
                    'placa' => $plc,
                    'items' => [],
                    'total_placa' => ['cantidad' => 0.0, 'peso' => 0.0, 'valor' => 0.0, 'peso_prom_venta' => 0.0, 'precio_prom_venta' => 0.0]
                ];
            }

            $ventasTree[$corp]['placas'][$plc]['items'][] = $vr;

            $ventasTree[$corp]['placas'][$plc]['total_placa']['cantidad'] += $cant;
            $ventasTree[$corp]['placas'][$plc]['total_placa']['peso'] += $peso;
            $ventasTree[$corp]['placas'][$plc]['total_placa']['valor'] += $val;

            $ventasTree[$corp]['total_corp']['cantidad'] += $cant;
            $ventasTree[$corp]['total_corp']['peso'] += $peso;
            $ventasTree[$corp]['total_corp']['valor'] += $val;
        }

        // Calcular promedios de subtotales
        foreach ($ventasTree as &$cData) {
            $tC = &$cData['total_corp'];
            $tC['peso_prom_venta'] = abs($tC['cantidad']) > 0.0001 ? ($tC['peso'] / $tC['cantidad']) : 0.0;
            $tC['precio_prom_venta'] = abs($tC['peso']) > 0.0001 ? ($tC['valor'] / $tC['peso']) : 0.0;

            foreach ($cData['placas'] as &$pData) {
                $tP = &$pData['total_placa'];
                $tP['peso_prom_venta'] = abs($tP['cantidad']) > 0.0001 ? ($tP['peso'] / $tP['cantidad']) : 0.0;
                $tP['precio_prom_venta'] = abs($tP['peso']) > 0.0001 ? ($tP['valor'] / $tP['peso']) : 0.0;
            }
            unset($pData);
        }
        unset($cData);

        // -------------------------------------------------------------
        // 3. PARTE 2: MERMAS GENERALES (Top Right)
        // -------------------------------------------------------------
        $whereMermas = [
            "m.fechaproceso BETWEEN :fec_ini AND :fec_fin",
            "m.dato = 'Peso'",
            "m.zonaorigen IN ('JOYA', 'MOLLENDO')"
        ];
        $paramsMermas = [
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ];

        // Filtro Placa
        if (!empty($filtros['placa'])) {
            $placaFiltro = is_array($filtros['placa']) ? $filtros['placa'] : [$filtros['placa']];
            $placaFiltro = array_filter($placaFiltro, function($p) { return $p !== '(Todo)' && $p !== 'TODOS' && trim($p) !== ''; });
            if (!empty($placaFiltro)) {
                $phList = [];
                foreach ($placaFiltro as $idx => $val) {
                    $ph = ":m_placa_{$idx}";
                    $phList[] = $ph;
                    $paramsMermas[$ph] = $val;
                }
                $whereMermas[] = "m.placa IN (" . implode(',', $phList) . ")";
            }
        }

        // Filtro Cliente
        if (!empty($filtros['cdcliente']) || !empty($filtros['cliente'])) {
            $cliFiltro = !empty($filtros['cdcliente']) ? $filtros['cdcliente'] : $filtros['cliente'];
            $cliFiltro = is_array($cliFiltro) ? $cliFiltro : [$cliFiltro];
            $cliFiltro = array_filter($cliFiltro, function($c) { return $c !== '(Todo)' && $c !== 'TODOS' && trim($c) !== ''; });
            if (!empty($cliFiltro)) {
                $phList = [];
                foreach ($cliFiltro as $idx => $val) {
                    $ph = ":m_cli_{$idx}";
                    $phList[] = $ph;
                    $paramsMermas[$ph] = $val;
                }
                $whereMermas[] = "m.cliente IN (" . implode(',', $phList) . ")";
            }
        }

        $whereMermasSql = implode(' AND ', $whereMermas);
        $sqlMermas = "
            SELECT 
                COALESCE(NULLIF(TRIM(m.zonaorigen), ''), '') as zonaorigen,
                COALESCE(NULLIF(TRIM(m.cliente), ''), '') as cliente,
                COALESCE(NULLIF(TRIM(m.placa), ''), '') as placa,
                AVG(m.objetivo) as objetivo,
                SUM(m.entrada) as entrada,
                SUM(m.mermatotal) as mermatotal
            FROM dmmermas m
            WHERE {$whereMermasSql}
            GROUP BY m.zonaorigen, m.cliente, m.placa
            ORDER BY m.zonaorigen ASC, m.cliente ASC, m.placa ASC
        ";
        $stmtM = $db->prepare($sqlMermas);
        $stmtM->execute($paramsMermas);
        $mermasRows = $stmtM->fetchAll(PDO::FETCH_ASSOC);

        $mermasList = [];
        foreach ($mermasRows as $mr) {
            $ent = (float)$mr['entrada'];
            $mer = (float)$mr['mermatotal'];
            $obj = (float)$mr['objetivo'];

            $real = $ent > 0 ? ($mer / $ent) : null;
            $dif  = $real !== null ? ($real - $obj) : null;

            $mermasList[] = [
                'zonaorigen' => $mr['zonaorigen'],
                'cliente' => $mr['cliente'],
                'placa' => $mr['placa'],
                'objetivo' => round($obj * 100, 2),
                'real' => $real !== null ? round($real * 100, 2) : null,
                'dif' => $dif !== null ? round($dif * 100, 2) : null,
                'entrada' => $ent,
                'mermatotal' => $mer
            ];
        }

        // -------------------------------------------------------------
        // 4. PARTE 3: PANORAMA ALMACEN GENERAL (Bottom Pivot Matrix)
        // -------------------------------------------------------------
        $whereAlmacen = [
            "m.talm = 'A10'",
            "m.tfecfac BETWEEN :fec_ini AND :fec_fin"
        ];
        $paramsAlmacen = [
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ];

        // Filtro Placa
        if (!empty($filtros['placa'])) {
            $placaFiltro = is_array($filtros['placa']) ? $filtros['placa'] : [$filtros['placa']];
            $placaFiltro = array_filter($placaFiltro, function($p) { return $p !== '(Todo)' && $p !== 'TODOS' && trim($p) !== ''; });
            if (!empty($placaFiltro)) {
                $phList = [];
                foreach ($placaFiltro as $idx => $val) {
                    $ph = ":a_placa_{$idx}";
                    $phList[] = $ph;
                    $paramsAlmacen[$ph] = $val;
                }
                $whereAlmacen[] = "COALESCE(NULLIF(TRIM(m.tplaca), ''), '0') IN (" . implode(',', $phList) . ")";
            }
        }

        // Filtro Cliente
        if (!empty($filtros['cdcliente']) || !empty($filtros['cliente'])) {
            $cliFiltro = !empty($filtros['cdcliente']) ? $filtros['cdcliente'] : $filtros['cliente'];
            $cliFiltro = is_array($cliFiltro) ? $cliFiltro : [$cliFiltro];
            $cliFiltro = array_filter($cliFiltro, function($c) { return $c !== '(Todo)' && $c !== 'TODOS' && trim($c) !== ''; });
            if (!empty($cliFiltro)) {
                $phList = [];
                foreach ($cliFiltro as $idx => $val) {
                    $ph = ":a_cli_{$idx}";
                    $phList[] = $ph;
                    $paramsAlmacen[$ph] = $val;
                }
                $whereAlmacen[] = "m.tprocli IN (" . implode(',', $phList) . ")";
            }
        }

        // Filtro CodItem
        if (!empty($filtros['coditem']) || !empty($filtros['items'])) {
            $itemFiltro = !empty($filtros['coditem']) ? $filtros['coditem'] : $filtros['items'];
            $itemFiltro = is_array($itemFiltro) ? $itemFiltro : [$itemFiltro];
            $itemFiltro = array_filter($itemFiltro, function($it) { return $it !== '(Todo)' && $it !== 'TODOS' && trim($it) !== ''; });
            if (!empty($itemFiltro)) {
                $phList = [];
                foreach ($itemFiltro as $idx => $val) {
                    $ph = ":a_item_{$idx}";
                    $phList[] = $ph;
                    $paramsAlmacen[$ph] = $val;
                }
                $whereAlmacen[] = "m.tcodigo IN (" . implode(',', $phList) . ")";
            }
        }

        $whereAlmacenSql = implode(' AND ', $whereAlmacen);
        $sqlAlmacen = "
            SELECT 
                DATE_FORMAT(m.tfecfac, '%e/%c/%Y') as fec_dmy,
                m.tfecfac,
                COALESCE(NULLIF(TRIM(m.tprocli), ''), 'SIN CLIENTE') as cdcliente,
                COALESCE(NULLIF(TRIM(m.tplaca), ''), '0') as placa,
                m.tcodigo as coditem,
                m.tcodtra,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) as cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso ELSE -1 * m.tpeso END) as peso,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) as valor
            FROM movi_produccion m
            WHERE {$whereAlmacenSql}
            GROUP BY m.tfecfac, m.tprocli, m.tplaca, m.tcodigo, m.tcodtra
            ORDER BY 
                m.tfecfac ASC, 
                CASE 
                    WHEN m.tprocli = '20100154308' THEN 1
                    WHEN m.tprocli = 'AREQUIPA' THEN 2
                    WHEN m.tprocli = 'CAMANA' THEN 3
                    WHEN m.tprocli = 'ILO' THEN 4
                    WHEN m.tprocli = 'LA JOYA' THEN 5
                    WHEN m.tprocli = 'MOLLENDO' THEN 6
                    WHEN m.tprocli = 'MOQUEGUA' THEN 7
                    WHEN m.tprocli = 'PEDREGAL' THEN 8
                    WHEN m.tprocli = 'TACNA' THEN 9
                    WHEN m.tprocli = 'AQP-BENE' THEN 10
                    ELSE 11
                END ASC,
                CASE WHEN m.tplaca IS NULL OR TRIM(m.tplaca) = '' OR TRIM(m.tplaca) = '0' THEN 1 ELSE 0 END ASC,
                m.tplaca ASC,
                CAST(m.tcodigo AS UNSIGNED) ASC
        ";
        $stmtA = $db->prepare($sqlAlmacen);
        $stmtA->execute($paramsAlmacen);
        $almacenRows = $stmtA->fetchAll(PDO::FETCH_ASSOC);

        // Columnas de transacción estándar según Tableau
        $transaccionesOrden = [
            'E100', 'S209', 'E209', 'S201', 'S409', 'E409', 'S400', 'E400',
            'S110', 'E110', 'S700', 'E700', 'S800', 'S801', 'S803', 'S804',
            'E806', 'S806', 'S810', 'S823'
        ];

        // Construir matriz dinámica
        $panoramaTree = [];
        foreach ($almacenRows as $ar) {
            $fec = $ar['fec_dmy'];
            $cli = $ar['cdcliente'];
            $plc = $ar['placa'];
            $it  = $ar['coditem'];
            $tra = $ar['tcodtra'];

            $c = (float)$ar['cant'];
            $p = (float)$ar['peso'];
            $v = (float)$ar['valor'];

            $key = "{$fec}|{$cli}|{$plc}|{$it}";
            if (!isset($panoramaTree[$key])) {
                $panoramaTree[$key] = [
                    'fecha' => $fec,
                    'cdcliente' => $cli,
                    'placa' => $plc,
                    'coditem' => $it,
                    'metricas' => [
                        'Cant' => ['valores' => [], 'total' => 0.0],
                        'Peso' => ['valores' => [], 'total' => 0.0],
                        'Valor' => ['valores' => [], 'total' => 0.0]
                    ]
                ];
            }

            $panoramaTree[$key]['metricas']['Cant']['valores'][$tra] = ($panoramaTree[$key]['metricas']['Cant']['valores'][$tra] ?? 0.0) + $c;
            $panoramaTree[$key]['metricas']['Cant']['total'] += $c;

            $panoramaTree[$key]['metricas']['Peso']['valores'][$tra] = ($panoramaTree[$key]['metricas']['Peso']['valores'][$tra] ?? 0.0) + $p;
            $panoramaTree[$key]['metricas']['Peso']['total'] += $p;

            $panoramaTree[$key]['metricas']['Valor']['valores'][$tra] = ($panoramaTree[$key]['metricas']['Valor']['valores'][$tra] ?? 0.0) + $v;
            $panoramaTree[$key]['metricas']['Valor']['total'] += $v;
        }

        return [
            'status' => 'success',
            'opciones_filtros' => [
                'corporativos' => $corporativosCatalogo,
                'placas' => $placasCatalogo,
                'clientes' => $clientesCatalogo,
                'items' => $itemsCatalogo
            ],
            'ventas_generales' => array_values($ventasTree),
            'mermas_generales' => $mermasList,
            'panorama_almacen' => array_values($panoramaTree),
            'transacciones_columnas' => $transaccionesOrden
        ];
    }
}
