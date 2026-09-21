<?php

class DashAnalisisPlacasGralHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-05-31';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-06-22';

        // 1. Catálogos de Filtros para Almacén A10
        $stmtPlacas = $db->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(tplaca), ''), '0') as placa 
            FROM movi_produccion 
            WHERE talm = 'A10'
            ORDER BY placa ASC
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
                $where[] = "COALESCE(NULLIF(TRIM(m.tplaca), ''), '0') IN (" . implode(',', $placeholders) . ")";
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

        $whereSql = implode(' AND ', $where);

        // 3. Consulta Base Agrupada por Placa, Cliente, CodItem y Fecha
        $sql = "
            SELECT 
                COALESCE(NULLIF(TRIM(m.tplaca), ''), '0') as tplaca,
                COALESCE(NULLIF(TRIM(m.tprocli), ''), 'SIN CLIENTE') as tprocli,
                m.tcodigo,
                m.tfecfac,
                DATE_FORMAT(m.tfecfac, '%Y/%m/%d') as fec_formateada,
                DATE_FORMAT(m.tfecfac, '%d/%m/%Y') as fec_dmy,
                
                SUM(CASE WHEN m.tcodtra = 'E100' THEN m.tpeso ELSE 0 END) as e100_entrada,
                SUM(CASE WHEN m.tcodtra = 'E101' THEN m.tpeso ELSE 0 END) as e101_entrada,
                SUM(CASE WHEN m.tcodtra IN ('S800','S801','S803','S804','S809','S810','S823') THEN m.tpeso ELSE 0 END) as s8xx_merma
            FROM movi_produccion m
            WHERE {$whereSql}
            GROUP BY COALESCE(NULLIF(TRIM(m.tplaca), ''), '0'), m.tprocli, m.tcodigo, m.tfecfac
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 4. Procesar las 6 vistas del Dashboard

        // A. Vista 1: Mermas Por Fecha (Agrupado por Placa)
        $placasTotales = [];
        // B. Vista 2: Mermas Individuales Generales (Agrupado por Cliente + Placa + Item + Fecha)
        $individualesList = [];
        // C. Vista 3: Mermas Generales por Código (Placa -> CodItem + Subtotal Placa)
        $placasCodigosMap = [];
        // D. Vista 4: Por Día (Placa -> Fecha -> Cliente -> Item)
        $porDiaMap = [];
        // E. Vista 5: Por Código (Placa -> Item -> Cliente -> Fecha)
        $porCodigoMap = [];
        // F. Vista 6: Por CD (Placa -> Cliente -> Fecha -> Item)
        $porCDMap = [];

        foreach ($rawRows as $r) {
            $placa = $r['tplaca'];
            $cli   = $r['tprocli'];
            $item  = $r['tcodigo'];
            $fecha = $r['tfecfac'];
            $fecYmd = $r['fec_formateada'];
            $fecDmy = $r['fec_dmy'];

            $e100 = (float)$r['e100_entrada'];
            $e101 = (float)$r['e101_entrada'];
            $totEnt = $e100 + $e101;
            $merma = (float)$r['s8xx_merma'];

            // A. Acumular Placas Totales
            if (!isset($placasTotales[$placa])) {
                $placasTotales[$placa] = [
                    'placa' => $placa,
                    'e100_entrada' => 0.0,
                    'e101_entrada' => 0.0,
                    'total_entrada' => 0.0,
                    's8xx_merma' => 0.0,
                    'porc_merma_peso' => 0.0
                ];
            }
            $placasTotales[$placa]['e100_entrada'] += $e100;
            $placasTotales[$placa]['e101_entrada'] += $e101;
            $placasTotales[$placa]['total_entrada'] += $totEnt;
            $placasTotales[$placa]['s8xx_merma'] += $merma;

            // B. Acumular Individuales Generales (solo registros con merma > 0 o entrada > 0)
            $porcInd = ($totEnt > 0 && $merma > 0) ? round(($merma / $totEnt) * 100, 2) : 0.0;
            $mesAbrev = date('M', strtotime($fecha));
            $diaFec = date('d', strtotime($fecha));
            $anioFec = date('Y', strtotime($fecha));
            $detalleStr = "{$cli} {$placa} {$item} {$mesAbrev} {$diaFec} {$anioFec}";

            if ($totEnt > 0 || $merma > 0) {
                $individualesList[] = [
                    'detalle' => $detalleStr,
                    'cliente' => $cli,
                    'placa' => $placa,
                    'coditem' => $item,
                    'fecha' => $fecha,
                    'fecha_formateada' => $fecYmd,
                    'fecha_dmy' => $fecDmy,
                    'e100_entrada' => $e100,
                    'e101_entrada' => $e101,
                    'total_entrada' => $totEnt,
                    's8xx_merma' => $merma,
                    'porc_merma_peso' => $porcInd
                ];
            }

            // C. Mermas Generales por Código
            if (!isset($placasCodigosMap[$placa])) {
                $placasCodigosMap[$placa] = [
                    'placa' => $placa,
                    'items' => [],
                    'total' => ['e100_entrada' => 0.0, 'e101_entrada' => 0.0, 'total_entrada' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0]
                ];
            }
            if (!isset($placasCodigosMap[$placa]['items'][$item])) {
                $placasCodigosMap[$placa]['items'][$item] = [
                    'coditem' => $item,
                    'e100_entrada' => 0.0,
                    'e101_entrada' => 0.0,
                    'total_entrada' => 0.0,
                    's8xx_merma' => 0.0,
                    'porc_merma_peso' => 0.0
                ];
            }
            $placasCodigosMap[$placa]['items'][$item]['e100_entrada'] += $e100;
            $placasCodigosMap[$placa]['items'][$item]['e101_entrada'] += $e101;
            $placasCodigosMap[$placa]['items'][$item]['total_entrada'] += $totEnt;
            $placasCodigosMap[$placa]['items'][$item]['s8xx_merma'] += $merma;

            $placasCodigosMap[$placa]['total']['e100_entrada'] += $e100;
            $placasCodigosMap[$placa]['total']['e101_entrada'] += $e101;
            $placasCodigosMap[$placa]['total']['total_entrada'] += $totEnt;
            $placasCodigosMap[$placa]['total']['s8xx_merma'] += $merma;

            // D. Por Día: Placa -> Fecha -> Cliente -> Item
            if (!isset($porDiaMap[$placa][$fecYmd][$cli][$item])) {
                $porDiaMap[$placa][$fecYmd][$cli][$item] = [
                    'e100_entrada' => 0.0, 'e101_entrada' => 0.0, 'total_entrada' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
                ];
            }
            $porDiaMap[$placa][$fecYmd][$cli][$item]['e100_entrada'] += $e100;
            $porDiaMap[$placa][$fecYmd][$cli][$item]['e101_entrada'] += $e101;
            $porDiaMap[$placa][$fecYmd][$cli][$item]['total_entrada'] += $totEnt;
            $porDiaMap[$placa][$fecYmd][$cli][$item]['s8xx_merma'] += $merma;

            // E. Por Código: Placa -> Item -> Cliente -> Fecha
            if (!isset($porCodigoMap[$placa][$item][$cli][$fecYmd])) {
                $porCodigoMap[$placa][$item][$cli][$fecYmd] = [
                    'e100_entrada' => 0.0, 'e101_entrada' => 0.0, 'total_entrada' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
                ];
            }
            $porCodigoMap[$placa][$item][$cli][$fecYmd]['e100_entrada'] += $e100;
            $porCodigoMap[$placa][$item][$cli][$fecYmd]['e101_entrada'] += $e101;
            $porCodigoMap[$placa][$item][$cli][$fecYmd]['total_entrada'] += $totEnt;
            $porCodigoMap[$placa][$item][$cli][$fecYmd]['s8xx_merma'] += $merma;

            // F. Por CD: Placa -> Cliente -> Fecha -> Item
            if (!isset($porCDMap[$placa][$cli][$fecYmd][$item])) {
                $porCDMap[$placa][$cli][$fecYmd][$item] = [
                    'e100_entrada' => 0.0, 'e101_entrada' => 0.0, 'total_entrada' => 0.0, 's8xx_merma' => 0.0, 'porc_merma_peso' => 0.0
                ];
            }
            $porCDMap[$placa][$cli][$fecYmd][$item]['e100_entrada'] += $e100;
            $porCDMap[$placa][$cli][$fecYmd][$item]['e101_entrada'] += $e101;
            $porCDMap[$placa][$cli][$fecYmd][$item]['total_entrada'] += $totEnt;
            $porCDMap[$placa][$cli][$fecYmd][$item]['s8xx_merma'] += $merma;
        }

        // 5. Calcular Porcentajes Finales y Ordenar

        // A. Mermas Por Fecha
        $mermasPorFecha = array_values($placasTotales);
        foreach ($mermasPorFecha as &$pf) {
            $pf['porc_merma_peso'] = ($pf['total_entrada'] > 0 && $pf['s8xx_merma'] > 0)
                ? round(($pf['s8xx_merma'] / $pf['total_entrada']) * 100, 2)
                : 0.0;
        }
        unset($pf);
        usort($mermasPorFecha, function($a, $b) {
            return $b['porc_merma_peso'] <=> $a['porc_merma_peso'];
        });

        // B. Mermas Individuales Generales
        usort($individualesList, function($a, $b) {
            return $b['porc_merma_peso'] <=> $a['porc_merma_peso'];
        });

        // C. Mermas Generales por Código
        $mermasCodigoList = [];
        foreach ($placasCodigosMap as $placaKey => $pData) {
            $itemsList = [];
            foreach ($pData['items'] as $itKey => $itData) {
                $itData['porc_merma_peso'] = ($itData['total_entrada'] > 0 && $itData['s8xx_merma'] > 0)
                    ? round(($itData['s8xx_merma'] / $itData['total_entrada']) * 100, 2)
                    : 0.0;
                $itemsList[] = $itData;
            }
            usort($itemsList, function($a, $b) {
                return (int)$a['coditem'] <=> (int)$b['coditem'];
            });

            $pData['total']['porc_merma_peso'] = ($pData['total']['total_entrada'] > 0 && $pData['total']['s8xx_merma'] > 0)
                ? round(($pData['total']['s8xx_merma'] / $pData['total']['total_entrada']) * 100, 2)
                : 0.0;

            $mermasCodigoList[] = [
                'placa' => $placaKey,
                'items' => $itemsList,
                'total' => $pData['total']
            ];
        }
        usort($mermasCodigoList, function($a, $b) {
            return $a['placa'] <=> $b['placa'];
        });

        // D. Aplanar Por Día (orden exacto: Placa ASC, Fecha ASC, Cliente ASC, CodItem ASC)
        $porDiaFlat = [];
        uksort($porDiaMap, 'strnatcasecmp');
        foreach ($porDiaMap as $pKey => &$fechas) {
            ksort($fechas);
            foreach ($fechas as $fKey => &$clis) {
                uksort($clis, 'strnatcasecmp');
                foreach ($clis as $cKey => &$its) {
                    uksort($its, function($a, $b) { return (int)$a <=> (int)$b; });
                    foreach ($its as $iKey => $vals) {
                        $porc = ($vals['total_entrada'] > 0 && $vals['s8xx_merma'] > 0)
                            ? round(($vals['s8xx_merma'] / $vals['total_entrada']) * 100, 2)
                            : 0.0;
                        $porDiaFlat[] = [
                            'placa' => $pKey,
                            'fecha' => $fKey,
                            'cliente' => $cKey,
                            'coditem' => $iKey,
                            'porc_merma_peso' => $porc,
                            's8xx_merma' => $vals['s8xx_merma'],
                            'total_entrada' => $vals['total_entrada']
                        ];
                    }
                }
            }
        }
        unset($fechas, $clis, $its);

        // E. Aplanar Por Código (orden exacto: Placa ASC, CodItem ASC, Cliente ASC, Fecha ASC)
        $porCodigoFlat = [];
        uksort($porCodigoMap, 'strnatcasecmp');
        foreach ($porCodigoMap as $pKey => &$its) {
            uksort($its, function($a, $b) { return (int)$a <=> (int)$b; });
            foreach ($its as $iKey => &$clis) {
                uksort($clis, 'strnatcasecmp');
                foreach ($clis as $cKey => &$fechas) {
                    ksort($fechas);
                    foreach ($fechas as $fKey => $vals) {
                        $porc = ($vals['total_entrada'] > 0 && $vals['s8xx_merma'] > 0)
                            ? round(($vals['s8xx_merma'] / $vals['total_entrada']) * 100, 2)
                            : 0.0;
                        $porCodigoFlat[] = [
                            'placa' => $pKey,
                            'coditem' => $iKey,
                            'cliente' => $cKey,
                            'fecha' => $fKey,
                            'porc_merma_peso' => $porc,
                            's8xx_merma' => $vals['s8xx_merma'],
                            'total_entrada' => $vals['total_entrada']
                        ];
                    }
                }
            }
        }
        unset($its, $clis, $fechas);

        // F. Aplanar Por CD (orden exacto: Placa ASC, Cliente ASC, Fecha ASC, CodItem ASC)
        $porCDFlat = [];
        uksort($porCDMap, 'strnatcasecmp');
        foreach ($porCDMap as $pKey => &$clis) {
            uksort($clis, 'strnatcasecmp');
            foreach ($clis as $cKey => &$fechas) {
                ksort($fechas);
                foreach ($fechas as $fKey => &$its) {
                    uksort($its, function($a, $b) { return (int)$a <=> (int)$b; });
                    foreach ($its as $iKey => $vals) {
                        $porc = ($vals['total_entrada'] > 0 && $vals['s8xx_merma'] > 0)
                            ? round(($vals['s8xx_merma'] / $vals['total_entrada']) * 100, 2)
                            : 0.0;
                        $porCDFlat[] = [
                            'placa' => $pKey,
                            'cliente' => $cKey,
                            'fecha' => $fKey,
                            'coditem' => $iKey,
                            'porc_merma_peso' => $porc,
                            's8xx_merma' => $vals['s8xx_merma'],
                            'total_entrada' => $vals['total_entrada']
                        ];
                    }
                }
            }
        }
        unset($clis, $fechas, $its);

        return [
            'status' => 'success',
            'opciones_filtros' => [
                'placas' => $placasCatalogo,
                'clientes' => $clientesCatalogo,
                'items' => $itemsCatalogo
            ],
            'mermas_por_fecha' => $mermasPorFecha,
            'mermas_individuales' => $individualesList,
            'mermas_por_codigo' => $mermasCodigoList,
            'por_dia' => $porDiaFlat,
            'por_codigo' => $porCodigoFlat,
            'por_cd' => $porCDFlat
        ];
    }
}
