<?php

class DashAnalisisPlacasHandler
{
    /**
     * Orden estándar de transacciones según Tableau
     */
    private static $ordenTransacciones = [
        'E100', 'E101', 'E209', 'E409', 'E414', 'E423', 'E700', 'E801', 'E806',
        'S201', 'S209', 'S409', 'S414', 'S400', 'E400', 'S110', 'E110', 'S700',
        'S800', 'S801', 'S803', 'S804', 'S806', 'S810', 'S823'
    ];

    /**
     * Mapeo de descripciones oficiales según Tableau
     */
    private static $descripcionesOficiales = [
        'E100' => 'ENTRADA A CENTRO DE DISTRIBUCION',
        'E101' => 'ENTRADA DE POLLO VIVO',
        'E110' => 'ENTRADA DE GUIA ELECTRONICA A10',
        'E209' => 'ENTRADA A BENEFICIO',
        'E400' => 'ENTRADA POR TRANSFERENCIA ALM.',
        'E409' => 'RETORNO DE POLLO VIVO-PROVINCIA',
        'E414' => 'RETORNO DE POLLO BENEFICIADO',
        'E423' => 'RETORNO DE PROCESO PB-MECANIZADO',
        'E700' => 'ENTR.DEV.DE VENTA POLLO VIVO-V',
        'E801' => 'ENTRADA POR DIF. PESO (KG)',
        'E806' => 'ENTRADA POR SOBRANTE (UND)',
        'S201' => 'SALIDA PARA BENEF. MECANIZADO',
        'S209' => 'SALIDA A BENEFICIO',
        'S400' => 'SALIDA POR TRANSFERENCIA ALM',
        'S409' => 'SALIDA DE POLLO VIVO PROVINCIA',
        'S414' => 'SALIDA DE POLLO BENEFICIADO',
        'S110' => 'SALIDA DE GUIA ELECTRONICA A10',
        'S700' => 'SALIDA POR VENTA A CLIENTES',
        'S800' => 'SALIDA POR MERMA DE TRANSPORTE P. VIVO',
        'S801' => 'SALIDA POR MERMA ALMACENAJE',
        'S803' => 'SALIDA POR NO APTO',
        'S804' => 'SALIDA POR MUERTO',
        'S806' => 'SALIDA POR FALTANTE (UND)',
        'S810' => 'MERMA TRANSP.POLLO BENEF.MECAN',
        'S823' => 'SALIDA POR MUERTO EN DISTRIBUCION'
    ];

    public static function handle(PDO $db, array $filtros)
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-03-30';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-03-31';

        $placaSeleccionada = !empty($filtros['placa_seleccionada']) ? trim($filtros['placa_seleccionada']) : null;
        $fecProcesoSeleccionada = !empty($filtros['fecproceso_seleccionada']) ? trim($filtros['fecproceso_seleccionada']) : null;

        $incluirLiquidacion = true;
        if (array_key_exists('incluir_liquidacion', $filtros)) {
            $flag = $filtros['incluir_liquidacion'];
            $incluirLiquidacion = !($flag === false || $flag === 'false' || $flag === 0 || $flag === '0');
        }

        $soloVentas = !empty($filtros['solo_ventas']);
        if ($soloVentas) {
            $incluirLiquidacion = false;
        }

        $paginadoVentas = !empty($filtros['paginado_ventas']);
        $pageVentas = max(1, (int)($filtros['page_ventas'] ?? 1));
        $pageSizeVentas = (int)($filtros['page_size'] ?? 50);
        if ($pageSizeVentas < 1) $pageSizeVentas = 50;
        if ($pageSizeVentas > 200) $pageSizeVentas = 200;

        $maxFilasSeccion = 50000;

        $seccionLiquidacion = null;
        $placasEncontradas = [];

        if ($incluirLiquidacion) {
        // -------------------------------------------------------------
        // 1. SECCIÓN 1: LIQUIDACIÓN DE PLACAS (LiqPlacas)
        // -------------------------------------------------------------
        $whereLiq = [
            "m.talm = 'A10'",
            "m.tfecfac BETWEEN :fec_ini AND :fec_fin"
        ];
        $paramsLiq = [
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ];

        // Filtro opcional CDCliente
        if (!empty($filtros['cdcliente'])) {
            $cliFiltro = is_array($filtros['cdcliente']) ? $filtros['cdcliente'] : [$filtros['cdcliente']];
            $cliFiltro = array_filter($cliFiltro, function($c) { return $c !== '(Todo)' && $c !== 'TODOS' && trim($c) !== ''; });
            if (!empty($cliFiltro)) {
                $phList = [];
                foreach ($cliFiltro as $idx => $val) {
                    $ph = ":cli_{$idx}";
                    $phList[] = $ph;
                    $paramsLiq[$ph] = $val;
                }
                $whereLiq[] = "m.tprocli IN (" . implode(',', $phList) . ")";
            }
        }

        // Filtro opcional Placa
        if (!empty($filtros['placa'])) {
            $plcFilter = is_array($filtros['placa']) ? $filtros['placa'] : [$filtros['placa']];
            $plcFilter = array_filter($plcFilter, function($p) { return $p !== '(Todo)' && $p !== 'TODOS' && trim($p) !== ''; });
            if (!empty($plcFilter)) {
                $phList = [];
                foreach ($plcFilter as $idx => $val) {
                    $ph = ":plc_{$idx}";
                    $phList[] = $ph;
                    $paramsLiq[$ph] = $val;
                }
                $whereLiq[] = "COALESCE(NULLIF(TRIM(m.tplaca), ''), '0') IN (" . implode(',', $phList) . ")";
            }
        }

        $whereLiqSql = implode(' AND ', $whereLiq);
        $sqlLiq = "
            SELECT 
                m.tfecfac,
                DATE_FORMAT(m.tfecfac, '%e/%c/%Y') as fec_dmy,
                COALESCE(NULLIF(TRIM(m.tprocli), ''), 'SIN CLIENTE') as cdcliente,
                COALESCE(NULLIF(TRIM(m.tplaca), ''), '') as placa,
                m.tcodigo as coditem,
                m.tcodtra,
                COALESCE(c.descri, m.tcodtra) as descri_db,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) as cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso ELSE -1 * m.tpeso END) as peso
            FROM movi_produccion m
            LEFT JOIN coal c ON m.tcodtra = c.codtra
            WHERE {$whereLiqSql}
            GROUP BY m.tfecfac, m.tprocli, m.tplaca, m.tcodigo, m.tcodtra, c.descri
            ORDER BY 
                m.tfecfac ASC,
                m.tprocli ASC,
                CASE WHEN m.tplaca IS NULL OR TRIM(m.tplaca) = '' THEN 0 ELSE 1 END ASC,
                m.tplaca ASC,
                CAST(m.tcodigo AS UNSIGNED) ASC,
                m.tcodtra ASC
        ";

        $stmtLiq = $db->prepare($sqlLiq);
        $stmtLiq->execute($paramsLiq);
        $rawLiq = $stmtLiq->fetchAll(PDO::FETCH_ASSOC);

        // Detectar transacciones presentes en la data y ordenarlas según Tableau
        $transPresentes = [];
        $placasEncontradas = [];
        $primeraPlaca = null;
        $primeraFecProceso = null;

        foreach ($rawLiq as $r) {
            $tra = $r['tcodtra'];
            $transPresentes[$tra] = true;

            $plc = $r['placa'];
            $fec = $r['tfecfac'];
            if (!empty($plc) && $plc !== '0') {
                if (!isset($placasEncontradas[$plc])) {
                    $placasEncontradas[$plc] = $fec;
                }
                if ($primeraPlaca === null) {
                    $primeraPlaca = $plc;
                }
            }
        }

        // Validación defensiva de la placa y fecha seleccionada
        if ($placaSeleccionada !== null && $placaSeleccionada !== '' && $placaSeleccionada !== '(Todas)') {
            if (!isset($placasEncontradas[$placaSeleccionada])) {
                // La placa enviada no existe en este rango de fechas: descartar y mostrar modo general
                $placaSeleccionada = null;
                $fecProcesoSeleccionada = null;
            } elseif ($fecProcesoSeleccionada === null || $fecProcesoSeleccionada < $fechaInicio || $fecProcesoSeleccionada > $fechaFin) {
                // La fecha enviada no es válida para este rango, usar la fecha registrada de la placa
                $fecProcesoSeleccionada = $placasEncontradas[$placaSeleccionada] ?? $fechaInicio;
            }
        } else {
            $placaSeleccionada = null;
            $fecProcesoSeleccionada = null;
        }

        // Ordenar columnas de transacciones
        $columnasTransacciones = [];
        foreach (self::$ordenTransacciones as $codTra) {
            if (isset($transPresentes[$codTra])) {
                $columnasTransacciones[] = [
                    'codtra' => $codTra,
                    'descri' => self::$descripcionesOficiales[$codTra] ?? $codTra
                ];
                unset($transPresentes[$codTra]);
            }
        }
        // Añadir cualquier otra transacción no contemplada en el diccionario
        foreach (array_keys($transPresentes) as $codTra) {
            $columnasTransacciones[] = [
                'codtra' => $codTra,
                'descri' => self::$descripcionesOficiales[$codTra] ?? $codTra
            ];
        }

        // Estructurar árbol de Liquidación por (Fecha, CDCliente) -> Placas -> Items
        $gruposTree = [];
        $distinctFechas = [];
        $totalGeneralTransacciones = [];

        foreach ($rawLiq as $r) {
            $fec  = $r['tfecfac'];
            $cli  = $r['cdcliente'];
            $plc  = $r['placa'];
            $item = $r['coditem'];
            $tra  = $r['tcodtra'];
            $cant = (float)$r['cant'];
            $peso = (float)$r['peso'];

            $distinctFechas[$fec] = true;
            $groupKey = "{$fec}__{$cli}";

            if (!isset($gruposTree[$groupKey])) {
                $gruposTree[$groupKey] = [
                    'tfecfac' => $fec,
                    'fec_dmy' => $r['fec_dmy'],
                    'cdcliente' => $cli,
                    'subtotal_cliente' => [
                        'placa' => 'Total',
                        'transacciones' => []
                    ],
                    'placas' => []
                ];
            }

            // Acumular subtotal del cliente en esta fecha
            if (!isset($gruposTree[$groupKey]['subtotal_cliente']['transacciones'][$tra])) {
                $gruposTree[$groupKey]['subtotal_cliente']['transacciones'][$tra] = ['cant' => 0.0, 'peso' => 0.0, 'pp' => 0.0];
            }
            $gruposTree[$groupKey]['subtotal_cliente']['transacciones'][$tra]['cant'] += $cant;
            $gruposTree[$groupKey]['subtotal_cliente']['transacciones'][$tra]['peso'] += $peso;

            // Acumular Total General de toda la tabla
            if (!isset($totalGeneralTransacciones[$tra])) {
                $totalGeneralTransacciones[$tra] = ['cant' => 0.0, 'peso' => 0.0, 'pp' => 0.0];
            }
            $totalGeneralTransacciones[$tra]['cant'] += $cant;
            $totalGeneralTransacciones[$tra]['peso'] += $peso;

            // Nivel Placa dentro de la fecha y cliente
            if (!isset($gruposTree[$groupKey]['placas'][$plc])) {
                $gruposTree[$groupKey]['placas'][$plc] = [
                    'placa' => $plc,
                    'tfecfac' => $fec,
                    'fec_dmy' => $r['fec_dmy'],
                    'items' => []
                ];
            }

            // Nivel Item dentro de la placa
            if (!isset($gruposTree[$groupKey]['placas'][$plc]['items'][$item])) {
                $gruposTree[$groupKey]['placas'][$plc]['items'][$item] = [
                    'coditem' => $item,
                    'transacciones' => []
                ];
            }

            if (!isset($gruposTree[$groupKey]['placas'][$plc]['items'][$item]['transacciones'][$tra])) {
                $gruposTree[$groupKey]['placas'][$plc]['items'][$item]['transacciones'][$tra] = ['cant' => 0.0, 'peso' => 0.0, 'pp' => 0.0];
            }
            $gruposTree[$groupKey]['placas'][$plc]['items'][$item]['transacciones'][$tra]['cant'] += $cant;
            $gruposTree[$groupKey]['placas'][$plc]['items'][$item]['transacciones'][$tra]['peso'] += $peso;
        }

        // Calcular PP (Peso Promedio = Peso / Cant) para cada nodo
        foreach ($gruposTree as &$gData) {
            foreach ($gData['subtotal_cliente']['transacciones'] as &$tMetrics) {
                $tMetrics['pp'] = abs($tMetrics['cant']) > 0.0001 ? ($tMetrics['peso'] / $tMetrics['cant']) : 0.0;
            }
            unset($tMetrics);

            foreach ($gData['placas'] as &$pData) {
                foreach ($pData['items'] as &$iData) {
                    foreach ($iData['transacciones'] as &$tMetrics) {
                        $tMetrics['pp'] = abs($tMetrics['cant']) > 0.0001 ? ($tMetrics['peso'] / $tMetrics['cant']) : 0.0;
                    }
                    unset($tMetrics);
                }
                unset($iData);
                $pData['items'] = array_values($pData['items']);
            }
            unset($pData);
            $gData['placas'] = array_values($gData['placas']);
        }
        unset($gData);

        // Calcular PP para Total General
        foreach ($totalGeneralTransacciones as &$tMetrics) {
            $tMetrics['pp'] = abs($tMetrics['cant']) > 0.0001 ? ($tMetrics['peso'] / $tMetrics['cant']) : 0.0;
        }
        unset($tMetrics);

        $seccionLiquidacion = [
            'total_fechas' => count($distinctFechas),
            'columnas_transacciones' => $columnasTransacciones,
            'clientes' => array_values($gruposTree),
            'total_general' => [
                'placa' => 'Total general',
                'transacciones' => $totalGeneralTransacciones
            ],
            'completo' => true
        ];
        }

        // -------------------------------------------------------------
        // 2. SECCIÓN 2: ANÁLISIS DE VENTAS (Ventas)
        // -------------------------------------------------------------
        $whereVentas = ["s.tline = '601'"];
        $paramsVentas = [];

        if ($placaSeleccionada !== null && $placaSeleccionada !== '') {
            $cleanPlaca = str_replace('-', '', $placaSeleccionada);
            if ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '') {
                $whereVentas[] = "s.tfecfac = :fec_proceso";
                $paramsVentas[':fec_proceso'] = $fecProcesoSeleccionada;
            } else {
                $whereVentas[] = "s.tfecfac BETWEEN :fec_ini AND :fec_fin";
                $paramsVentas[':fec_ini'] = $fechaInicio;
                $paramsVentas[':fec_fin'] = $fechaFin;
            }
            $whereVentas[] = "(s.placa = :placa OR REPLACE(s.placa, '-', '') = :placa_clean)";
            $paramsVentas[':placa'] = $placaSeleccionada;
            $paramsVentas[':placa_clean'] = $cleanPlaca;
        } else {
            $whereVentas[] = "s.tfecfac BETWEEN :fec_ini AND :fec_fin";
            $paramsVentas[':fec_ini'] = $fechaInicio;
            $paramsVentas[':fec_fin'] = $fechaFin;
        }

        $whereVentasSql = implode(' AND ', $whereVentas);

        $ventasSelectPrefix = $paginadoVentas ? 'SQL_CALC_FOUND_ROWS ' : '';
        $ventasLimit = '';
        if ($paginadoVentas) {
            $offsetVentas = ($pageVentas - 1) * $pageSizeVentas;
            $ventasLimit = " LIMIT {$offsetVentas}, {$pageSizeVentas}";
        }

        $sqlVentas = "
            SELECT {$ventasSelectPrefix}
                DATE_FORMAT(s.tfecfac, '%Y/%m/%d') as fecproceso_fmt,
                s.tfecfac as fecproceso,
                s.placa,
                DATE_FORMAT(s.tdate, '%e/%c/%Y') as fecreg_dmy,
                s.tdate as fecreg,
                MIN(s.ttime) as min_time,
                MAX(s.ttime) as max_time,
                COALESCE(c1.nombre, 'SIN CORPORATIVO') as corporativo,
                c.codigo as codcliente,
                c.nombre as nomcliente,
                COALESCE(c1.rutacomer, '') as rutacomercial,
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
            GROUP BY s.tfecfac, s.placa, s.tdate, c1.nombre, c.codigo, c.nombre, c1.rutacomer, s.tdoc, s.tnumfac, s.tcodigo
            ORDER BY 
                s.tfecfac ASC,
                s.tdate ASC, 
                MIN(s.ttime) ASC, 
                c.codigo ASC, 
                s.tdoc ASC, 
                s.tnumfac ASC,
                CAST(s.tcodigo AS UNSIGNED) ASC{$ventasLimit}
        ";

        $stmtVentas = $db->prepare($sqlVentas);
        $stmtVentas->execute($paramsVentas);
        $ventasRows = $stmtVentas->fetchAll(PDO::FETCH_ASSOC);

        $totVentasCant = 0.0;
        $totVentasPeso = 0.0;
        $totVentasVal  = 0.0;
        $ventasTotalRegistros = 0;

        if ($paginadoVentas) {
            $stmtFound = $db->query("SELECT FOUND_ROWS() as total_registros");
            $ventasTotalRegistros = (int)($stmtFound->fetch(PDO::FETCH_ASSOC)['total_registros'] ?? 0);

            $sqlTotVentas = "
                SELECT
                    SUM(s.tcantid) as tc,
                    SUM(s.tespeci) as tp,
                    SUM(s.timport) as tv
                FROM sale s
                INNER JOIN ccte c ON s.tprocli = c.codigo
                LEFT JOIN ccte c1 ON c.ruc = c1.codigo
                WHERE {$whereVentasSql}
            ";
            $stmtTotVentas = $db->prepare($sqlTotVentas);
            $stmtTotVentas->execute($paramsVentas);
            $totRow = $stmtTotVentas->fetch(PDO::FETCH_ASSOC) ?: [];
            $totVentasCant = (float)($totRow['tc'] ?? 0);
            $totVentasPeso = (float)($totRow['tp'] ?? 0);
            $totVentasVal  = (float)($totRow['tv'] ?? 0);
        }

        foreach ($ventasRows as &$vr) {
            $cant = (float)$vr['cantidad'];
            $peso = (float)$vr['peso'];
            $val  = (float)$vr['valor'];

            $vr['cantidad'] = $cant;
            $vr['peso']     = $peso;
            $vr['valor']    = $val;
            $vr['peso_prom_venta']   = abs($cant) > 0.0001 ? ($peso / $cant) : 0.0;
            $vr['precio_prom_venta'] = abs($peso) > 0.0001 ? ($val / $peso) : 0.0;

            if (!$paginadoVentas) {
                $totVentasCant += $cant;
                $totVentasPeso += $peso;
                $totVentasVal  += $val;
            }
        }
        unset($vr);

        if (!$paginadoVentas) {
            $ventasTotalRegistros = count($ventasRows);
        }

        $fecprocesoFmt = ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '')
            ? date('Y/m/d', strtotime($fecProcesoSeleccionada))
            : (date('Y/m/d', strtotime($fechaInicio)) . ' al ' . date('Y/m/d', strtotime($fechaFin)));

        $ventasCompleto = !$paginadoVentas && count($ventasRows) <= $maxFilasSeccion;
        if (!$paginadoVentas && !$ventasCompleto) {
            $ventasRows = array_slice($ventasRows, 0, $maxFilasSeccion);
        }

        $seccionVentas = [
            'placa' => $placaSeleccionada ?? '(Todas)',
            'fecproceso' => $fecProcesoSeleccionada ?? "{$fechaInicio} al {$fechaFin}",
            'fecproceso_formateada' => $fecprocesoFmt,
            'filas' => $ventasRows,
            'completo' => $ventasCompleto,
            'paginado' => $paginadoVentas,
            'page' => $paginadoVentas ? $pageVentas : 1,
            'page_size' => $paginadoVentas ? $pageSizeVentas : count($ventasRows),
            'total_registros' => $ventasTotalRegistros,
            'total' => [
                'cantidad' => $totVentasCant,
                'peso' => $totVentasPeso,
                'valor' => $totVentasVal,
                'peso_prom_venta' => abs($totVentasCant) > 0.0001 ? ($totVentasPeso / $totVentasCant) : 0.0,
                'precio_prom_venta' => abs($totVentasPeso) > 0.0001 ? ($totVentasVal / $totVentasPeso) : 0.0
            ]
        ];

        if ($soloVentas) {
            $seccionTiemposRuta = null;
            $seccionAgcausal = null;
            $seccionCumplimiento = null;
        } else {

        // -------------------------------------------------------------
        // 3. SECCIÓN 3: TIEMPOS DE RUTA (TiemposRutas)
        // -------------------------------------------------------------
        $whereRutas = [
            "r.evento IN ('INGRESO A C.D.', 'INGRESO A GALPON', 'INGRESO A GARITA', 'SALIDA DE GALPON', 'SALIDA DE GARITA', 'SALIDA DE P.B.')"
        ];
        $paramsRutas = [];

        if ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '') {
            $whereRutas[] = "r.fechaproceso = :fec_proceso";
            $paramsRutas[':fec_proceso'] = $fecProcesoSeleccionada;
        } else {
            $whereRutas[] = "r.fechaproceso BETWEEN :fec_ini AND :fec_fin";
            $paramsRutas[':fec_ini'] = $fechaInicio;
            $paramsRutas[':fec_fin'] = $fechaFin;
        }

        if ($placaSeleccionada !== null && $placaSeleccionada !== '') {
            $cleanPlaca = str_replace('-', '', $placaSeleccionada);
            $whereRutas[] = "(r.placa = :placa OR REPLACE(r.placa, '-', '') = :placa_clean)";
            $paramsRutas[':placa'] = $placaSeleccionada;
            $paramsRutas[':placa_clean'] = $cleanPlaca;
        }

        $whereRutasSql = implode(' AND ', $whereRutas);
        $sqlRutas = "
            SELECT 
                r.placa,
                r.numeroruta,
                r.fechaproceso,
                DATE_FORMAT(r.fechaproceso, '%Y/%m/%d') as fechaproceso_formateada,
                r.fecha,
                DATE_FORMAT(r.fecha, '%Y/%m/%d') as fecha_formateada,
                r.hora,
                r.evento,
                r.localizacion,
                r.arearesponsable
            FROM dmruta r
            WHERE {$whereRutasSql}
            ORDER BY r.placa ASC, CAST(r.numeroruta AS UNSIGNED) ASC, r.fecha ASC, r.hora ASC
        ";

        $stmtRutas = $db->prepare($sqlRutas);
        $stmtRutas->execute($paramsRutas);
        $rutasRows = $stmtRutas->fetchAll(PDO::FETCH_ASSOC);

        $rutasCompleto = count($rutasRows) <= $maxFilasSeccion;
        if (!$rutasCompleto) {
            $rutasRows = array_slice($rutasRows, 0, $maxFilasSeccion);
        }

        $rutasFecFmt = ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '')
            ? date('Y/m/d', strtotime($fecProcesoSeleccionada))
            : (date('Y/m/d', strtotime($fechaInicio)) . ' al ' . date('Y/m/d', strtotime($fechaFin)));

        $seccionTiemposRuta = [
            'placa' => $placaSeleccionada ?? '(Todas)',
            'fecproceso' => $fecProcesoSeleccionada ?? "{$fechaInicio} al {$fechaFin}",
            'fecproceso_formateada' => $rutasFecFmt,
            'filas' => $rutasRows,
            'completo' => $rutasCompleto
        ];

        // -------------------------------------------------------------
        // 4. SECCIÓN 4: AGENTE CAUSAL (Agcausal)
        // -------------------------------------------------------------
        $whereAg = [];
        $paramsAg = [];

        if ($placaSeleccionada !== null && $placaSeleccionada !== '') {
            $cleanPlaca = str_replace('-', '', $placaSeleccionada);
            if ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '') {
                $whereAg[] = "a.fechaproceso = :fec_proceso";
                $paramsAg[':fec_proceso'] = $fecProcesoSeleccionada;
            } else {
                $whereAg[] = "a.fechaproceso BETWEEN :fec_ini AND :fec_fin";
                $paramsAg[':fec_ini'] = $fechaInicio;
                $paramsAg[':fec_fin'] = $fechaFin;
            }
            $whereAg[] = "(a.placa = :placa OR REPLACE(a.placa, '-', '') = :placa_clean)";
            $paramsAg[':placa'] = $placaSeleccionada;
            $paramsAg[':placa_clean'] = $cleanPlaca;
        } else {
            $whereAg[] = "a.fechaproceso BETWEEN :fec_ini AND :fec_fin";
            $paramsAg[':fec_ini'] = $fechaInicio;
            $paramsAg[':fec_fin'] = $fechaFin;
        }

        $whereAgSql = implode(' AND ', $whereAg);
        $sqlAgcausal = "
            SELECT 
                DATE_FORMAT(a.fechaproceso, '%Y/%m/%d') as fecproceso_fmt,
                a.fechaproceso,
                a.cliente,
                a.placa,
                a.area,
                a.codigoconta,
                a.causatipo,
                a.fecharegistro,
                DATE_FORMAT(a.fecharegistro, '%Y/%m/%d') as fecharegistro_fmt,
                a.horaregistro,
                a.descripcion
            FROM dmagentescausalesmermas a
            WHERE {$whereAgSql}
            ORDER BY a.fechaproceso ASC, a.placa ASC, a.area ASC, a.codigoconta ASC, a.fecharegistro ASC, a.horaregistro ASC
        ";

        $stmtAgcausal = $db->prepare($sqlAgcausal);
        $stmtAgcausal->execute($paramsAg);
        $agcausalRows = $stmtAgcausal->fetchAll(PDO::FETCH_ASSOC);

        $agcausalCompleto = count($agcausalRows) <= $maxFilasSeccion;
        if (!$agcausalCompleto) {
            $agcausalRows = array_slice($agcausalRows, 0, $maxFilasSeccion);
        }

        $seccionAgcausal = [
            'placa' => $placaSeleccionada ?? '(Todas)',
            'fecproceso' => $fecProcesoSeleccionada ?? "{$fechaInicio} al {$fechaFin}",
            'fecproceso_formateada' => $fecprocesoFmt,
            'filas' => $agcausalRows,
            'completo' => $agcausalCompleto
        ];

        // -------------------------------------------------------------
        // 5. SECCIÓN 5: CUMPLIMIENTO OBJETIVO (Mermas + MermasCodigo)
        // -------------------------------------------------------------
        // Tabla Placa General
        $whereMermas = [
            "m.dato = 'Peso'",
            "m.zonaorigen IN ('JOYA', 'MOLLENDO')"
        ];
        $paramsMermas = [];

        if ($placaSeleccionada !== null && $placaSeleccionada !== '') {
            $cleanPlaca = str_replace('-', '', $placaSeleccionada);
            if ($fecProcesoSeleccionada !== null && $fecProcesoSeleccionada !== '') {
                $whereMermas[] = "m.fechaproceso = :fec_proceso";
                $paramsMermas[':fec_proceso'] = $fecProcesoSeleccionada;
            } else {
                $whereMermas[] = "m.fechaproceso BETWEEN :fec_ini AND :fec_fin";
                $paramsMermas[':fec_ini'] = $fechaInicio;
                $paramsMermas[':fec_fin'] = $fechaFin;
            }
            $whereMermas[] = "(m.placa = :placa OR REPLACE(m.placa, '-', '') = :placa_clean)";
            $paramsMermas[':placa'] = $placaSeleccionada;
            $paramsMermas[':placa_clean'] = $cleanPlaca;
        } else {
            $whereMermas[] = "m.fechaproceso BETWEEN :fec_ini AND :fec_fin";
            $paramsMermas[':fec_ini'] = $fechaInicio;
            $paramsMermas[':fec_fin'] = $fechaFin;
        }

        $whereMermasSql = implode(' AND ', $whereMermas);
        $sqlMermasPlaca = "
            SELECT 
                DATE_FORMAT(m.fechaproceso, '%Y/%m/%d') as fecproceso_fmt,
                m.fechaproceso,
                m.zonaorigen,
                m.cliente,
                m.placa,
                AVG(m.objetivo) as objetivo,
                SUM(m.entrada) as entrada,
                SUM(m.mermatotal) as mermatotal
            FROM dmmermas m
            WHERE {$whereMermasSql}
            GROUP BY m.fechaproceso, m.zonaorigen, m.cliente, m.placa
            ORDER BY m.fechaproceso ASC, m.zonaorigen ASC, m.cliente ASC, m.placa ASC
        ";

        $stmtMPlaca = $db->prepare($sqlMermasPlaca);
        $stmtMPlaca->execute($paramsMermas);
        $mermasPlacaRows = $stmtMPlaca->fetchAll(PDO::FETCH_ASSOC);

        $tablaPlaca = [];
        foreach ($mermasPlacaRows as $mr) {
            $ent = (float)$mr['entrada'];
            $mer = (float)$mr['mermatotal'];
            $obj = (float)$mr['objetivo'];
            $real = $ent > 0 ? ($mer / $ent) : 0.0;
            $dif  = $real - $obj;

            $tablaPlaca[] = [
                'fecproceso' => $mr['fechaproceso'],
                'fecproceso_fmt' => $mr['fecproceso_fmt'],
                'zonaorigen' => $mr['zonaorigen'],
                'cliente' => $mr['cliente'],
                'placa' => $mr['placa'],
                'objetivo' => round($obj * 100, 2),
                'real' => round($real * 100, 2),
                'dif' => round($dif * 100, 2),
                'entrada' => $ent,
                'mermatotal' => $mer
            ];
        }

        // Tabla Desglosada por Código
        $sqlMermasCod = "
            SELECT 
                DATE_FORMAT(m.fechaproceso, '%Y/%m/%d') as fecproceso_fmt,
                m.fechaproceso,
                m.zonaorigen,
                m.cliente,
                m.placa,
                m.codigo,
                AVG(m.objetivo) as objetivo,
                SUM(m.entrada) as entrada,
                SUM(m.mermatotal) as mermatotal
            FROM dmmermas m
            WHERE {$whereMermasSql}
            GROUP BY m.fechaproceso, m.zonaorigen, m.cliente, m.placa, m.codigo
            ORDER BY m.fechaproceso ASC, m.zonaorigen ASC, m.cliente ASC, m.placa ASC, CAST(m.codigo AS UNSIGNED) ASC
        ";

        $stmtMCod = $db->prepare($sqlMermasCod);
        $stmtMCod->execute($paramsMermas);
        $mermasCodRows = $stmtMCod->fetchAll(PDO::FETCH_ASSOC);

        $tablaCodigoFilas = [];
        $totObjSum = 0.0;
        $totEntCod = 0.0;
        $totMerCod = 0.0;

        foreach ($mermasCodRows as $mr) {
            $ent = (float)$mr['entrada'];
            $mer = (float)$mr['mermatotal'];
            $obj = (float)$mr['objetivo'];
            $real = $ent > 0 ? ($mer / $ent) : 0.0;
            $dif  = $real - $obj;

            $tablaCodigoFilas[] = [
                'fecproceso' => $mr['fechaproceso'],
                'fecproceso_fmt' => $mr['fecproceso_fmt'],
                'zonaorigen' => $mr['zonaorigen'],
                'cliente' => $mr['cliente'],
                'placa' => $mr['placa'],
                'codigo' => $mr['codigo'],
                'objetivo' => round($obj * 100, 2),
                'real' => round($real * 100, 2),
                'dif' => round($dif * 100, 2),
                'entrada' => $ent,
                'mermatotal' => $mer
            ];

            $totObjSum += $obj;
            $totEntCod += $ent;
            $totMerCod += $mer;
        }

        $cntCod = count($mermasCodRows);
        $avgObjTotal = $cntCod > 0 ? ($totObjSum / $cntCod) : 0.0;
        $realTotal = $totEntCod > 0 ? ($totMerCod / $totEntCod) : 0.0;
        $difTotal = $realTotal - $avgObjTotal;

        $cumpCompleto = (count($tablaPlaca) <= $maxFilasSeccion) && (count($tablaCodigoFilas) <= $maxFilasSeccion);
        if (count($tablaPlaca) > $maxFilasSeccion) {
            $tablaPlaca = array_slice($tablaPlaca, 0, $maxFilasSeccion);
        }
        if (count($tablaCodigoFilas) > $maxFilasSeccion) {
            $tablaCodigoFilas = array_slice($tablaCodigoFilas, 0, $maxFilasSeccion);
        }

        $seccionCumplimiento = [
            'placa' => $placaSeleccionada ?? '(Todas)',
            'fecproceso' => $fecProcesoSeleccionada ?? "{$fechaInicio} al {$fechaFin}",
            'fecproceso_formateada' => $fecprocesoFmt,
            'completo' => $cumpCompleto,
            'tabla_placa' => $tablaPlaca,
            'tabla_codigo' => [
                'filas' => $tablaCodigoFilas,
                'completo' => $cumpCompleto,
                'total' => [
                    'objetivo' => round($avgObjTotal * 100, 2),
                    'real' => round($realTotal * 100, 2),
                    'dif' => round($difTotal * 100, 2),
                    'entrada' => $totEntCod,
                    'mermatotal' => $totMerCod
                ]
            ]
        ];

        }

        return [
            'status' => 'success',
            'filtros' => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin,
                'placa_seleccionada' => $placaSeleccionada,
                'fecproceso_seleccionada' => $fecProcesoSeleccionada
            ],
            'placas_disponibles' => array_keys($placasEncontradas),
            'seccion_liquidacion' => $seccionLiquidacion,
            'seccion_ventas' => $seccionVentas,
            'seccion_tiempos_ruta' => $seccionTiemposRuta,
            'seccion_agente_causal' => $seccionAgcausal,
            'seccion_cumplimiento' => $seccionCumplimiento
        ];
    }
}
