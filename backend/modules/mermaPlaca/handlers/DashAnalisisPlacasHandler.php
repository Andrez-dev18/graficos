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

        // Si no se especificó placa para master-detail, usar C8B727 o la primera disponible
        if ($placaSeleccionada === null) {
            $placaSeleccionada = isset($placasEncontradas['C8B727']) ? 'C8B727' : ($primeraPlaca ?? 'C8B727');
            $fecProcesoSeleccionada = $placasEncontradas[$placaSeleccionada] ?? $fechaInicio;
        } elseif ($fecProcesoSeleccionada === null) {
            $fecProcesoSeleccionada = $placasEncontradas[$placaSeleccionada] ?? $fechaInicio;
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
            ]
        ];

        // -------------------------------------------------------------
        // 2. SECCIÓN 2: ANÁLISIS DE VENTAS (Ventas)
        // -------------------------------------------------------------
        $sqlVentas = "
            SELECT 
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
            WHERE s.tline = '601'
              AND s.tfecfac = :fec_proceso
              AND (s.placa = :placa OR REPLACE(s.placa, '-', '') = :placa_clean)
            GROUP BY s.tfecfac, s.placa, s.tdate, c1.nombre, c.codigo, c.nombre, c1.rutacomer, s.tdoc, s.tnumfac, s.tcodigo
            ORDER BY 
                s.tdate ASC, 
                MIN(s.ttime) ASC, 
                c.codigo ASC, 
                s.tdoc ASC, 
                s.tnumfac ASC,
                CAST(s.tcodigo AS UNSIGNED) ASC
        ";

        $cleanPlaca = str_replace('-', '', $placaSeleccionada);
        $stmtVentas = $db->prepare($sqlVentas);
        $stmtVentas->execute([
            ':fec_proceso' => $fecProcesoSeleccionada,
            ':placa' => $placaSeleccionada,
            ':placa_clean' => $cleanPlaca
        ]);
        $ventasRows = $stmtVentas->fetchAll(PDO::FETCH_ASSOC);

        $totVentasCant = 0.0;
        $totVentasPeso = 0.0;
        $totVentasVal  = 0.0;

        foreach ($ventasRows as &$vr) {
            $cant = (float)$vr['cantidad'];
            $peso = (float)$vr['peso'];
            $val  = (float)$vr['valor'];

            $vr['cantidad'] = $cant;
            $vr['peso']     = $peso;
            $vr['valor']    = $val;
            $vr['peso_prom_venta']   = abs($cant) > 0.0001 ? ($peso / $cant) : 0.0;
            $vr['precio_prom_venta'] = abs($peso) > 0.0001 ? ($val / $peso) : 0.0;

            $totVentasCant += $cant;
            $totVentasPeso += $peso;
            $totVentasVal  += $val;
        }
        unset($vr);

        $seccionVentas = [
            'placa' => $placaSeleccionada,
            'fecproceso' => $fecProcesoSeleccionada,
            'fecproceso_formateada' => date('Y/m/d', strtotime($fecProcesoSeleccionada)),
            'filas' => $ventasRows,
            'total' => [
                'cantidad' => $totVentasCant,
                'peso' => $totVentasPeso,
                'valor' => $totVentasVal,
                'peso_prom_venta' => abs($totVentasCant) > 0.0001 ? ($totVentasPeso / $totVentasCant) : 0.0,
                'precio_prom_venta' => abs($totVentasPeso) > 0.0001 ? ($totVentasVal / $totVentasPeso) : 0.0
            ]
        ];

        // -------------------------------------------------------------
        // 3. SECCIÓN 3: TIEMPOS DE RUTA (TiemposRutas)
        // -------------------------------------------------------------
        $sqlRutas = "
            SELECT 
                r.numeroruta,
                r.fecha,
                DATE_FORMAT(r.fecha, '%Y/%m/%d') as fecha_formateada,
                r.hora,
                r.evento,
                r.localizacion,
                r.arearesponsable
            FROM dmruta r
            WHERE (r.placa = :placa OR REPLACE(r.placa, '-', '') = :placa_clean)
              AND r.fechaproceso BETWEEN :fec_ini AND :fec_fin
              AND r.evento IN ('INGRESO A C.D.', 'INGRESO A GALPON', 'INGRESO A GARITA', 'SALIDA DE GALPON', 'SALIDA DE GARITA', 'SALIDA DE P.B.')
            ORDER BY CAST(r.numeroruta AS UNSIGNED) ASC, r.fecha ASC, r.hora ASC
        ";

        $stmtRutas = $db->prepare($sqlRutas);
        $stmtRutas->execute([
            ':placa' => $placaSeleccionada,
            ':placa_clean' => $cleanPlaca,
            ':fec_ini' => $fechaInicio,
            ':fec_fin' => $fechaFin
        ]);
        $rutasRows = $stmtRutas->fetchAll(PDO::FETCH_ASSOC);

        $seccionTiemposRuta = [
            'placa' => $placaSeleccionada,
            'filas' => $rutasRows
        ];

        // -------------------------------------------------------------
        // 4. SECCIÓN 4: AGENTE CAUSAL (Agcausal)
        // -------------------------------------------------------------
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
            WHERE a.fechaproceso = :fec_proceso
              AND (a.placa = :placa OR REPLACE(a.placa, '-', '') = :placa_clean)
            ORDER BY a.area ASC, a.codigoconta ASC, a.fecharegistro ASC, a.horaregistro ASC
        ";

        $stmtAgcausal = $db->prepare($sqlAgcausal);
        $stmtAgcausal->execute([
            ':fec_proceso' => $fecProcesoSeleccionada,
            ':placa' => $placaSeleccionada,
            ':placa_clean' => $cleanPlaca
        ]);
        $agcausalRows = $stmtAgcausal->fetchAll(PDO::FETCH_ASSOC);

        $seccionAgcausal = [
            'placa' => $placaSeleccionada,
            'fecproceso' => $fecProcesoSeleccionada,
            'fecproceso_formateada' => date('Y/m/d', strtotime($fecProcesoSeleccionada)),
            'filas' => $agcausalRows
        ];

        // -------------------------------------------------------------
        // 5. SECCIÓN 5: CUMPLIMIENTO OBJETIVO (Mermas + MermasCodigo)
        // -------------------------------------------------------------
        // Tabla Placa General
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
            WHERE m.fechaproceso = :fec_proceso
              AND (m.placa = :placa OR REPLACE(m.placa, '-', '') = :placa_clean)
              AND m.dato = 'Peso'
              AND m.zonaorigen IN ('JOYA', 'MOLLENDO')
            GROUP BY m.fechaproceso, m.zonaorigen, m.cliente, m.placa
            ORDER BY m.zonaorigen ASC, m.cliente ASC
        ";

        $stmtMPlaca = $db->prepare($sqlMermasPlaca);
        $stmtMPlaca->execute([
            ':fec_proceso' => $fecProcesoSeleccionada,
            ':placa' => $placaSeleccionada,
            ':placa_clean' => $cleanPlaca
        ]);
        $mermasPlacaRows = $stmtMPlaca->fetchAll(PDO::FETCH_ASSOC);

        $tablaPlaca = [];
        foreach ($mermasPlacaRows as $mr) {
            $ent = (float)$mr['entrada'];
            $mer = (float)$mr['mermatotal'];
            $obj = (float)$mr['objetivo'];
            $real = $ent > 0 ? ($mer / $ent) : 0.0;
            $dif  = $real - $obj;

            $tablaPlaca[] = [
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
            WHERE m.fechaproceso = :fec_proceso
              AND (m.placa = :placa OR REPLACE(m.placa, '-', '') = :placa_clean)
              AND m.dato = 'Peso'
              AND m.zonaorigen IN ('JOYA', 'MOLLENDO')
            GROUP BY m.fechaproceso, m.zonaorigen, m.cliente, m.placa, m.codigo
            ORDER BY m.zonaorigen ASC, m.cliente ASC, CAST(m.codigo AS UNSIGNED) ASC
        ";

        $stmtMCod = $db->prepare($sqlMermasCod);
        $stmtMCod->execute([
            ':fec_proceso' => $fecProcesoSeleccionada,
            ':placa' => $placaSeleccionada,
            ':placa_clean' => $cleanPlaca
        ]);
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

        $seccionCumplimiento = [
            'placa' => $placaSeleccionada,
            'fecproceso' => $fecProcesoSeleccionada,
            'fecproceso_formateada' => date('Y/m/d', strtotime($fecProcesoSeleccionada)),
            'tabla_placa' => $tablaPlaca,
            'tabla_codigo' => [
                'filas' => $tablaCodigoFilas,
                'total' => [
                    'objetivo' => round($avgObjTotal * 100, 2),
                    'real' => round($realTotal * 100, 2),
                    'dif' => round($difTotal * 100, 2),
                    'entrada' => $totEntCod,
                    'mermatotal' => $totMerCod
                ]
            ]
        ];

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
