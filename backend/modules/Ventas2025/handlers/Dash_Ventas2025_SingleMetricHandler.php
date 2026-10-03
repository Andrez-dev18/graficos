<?php

class Dash_Ventas2025_SingleMetricHandler
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

    public static function formatDateLabel(string $dateStr): array
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $ts = strtotime($dateStr);
        $diaSemana = $dias[(int)date('w', $ts)];
        $ymd = date('Y/m/d', $ts);
        $label = "{$diaSemana}, {$ymd}";
        return [
            'fecha'      => $dateStr,
            'dia_semana' => $diaSemana,
            'ymd'        => $ymd,
            'label'      => $label
        ];
    }

    /**
     * @param PDO $db
     * @param array $filtros
     * @param string $metrica 'cantidad' | 'peso' | 'importe'
     * @return array
     */
    public static function handle(PDO $db, array $filtros, string $metrica = 'cantidad'): array
    {
        $whereClauses = ["sale.tline = '601'"];
        $params = [];

        // 1. Fechas
        $anio        = $filtros['anio'] ?? '2025';
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? $filtros['fec_proceso_inicio'] ?? "{$anio}-01-01";
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? $filtros['fec_proceso_fin'] ?? "{$anio}-12-31";
        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereClauses[] = "sale.tfecfac BETWEEN ? AND ?";
            $params[] = $fechaInicio;
            $params[] = $fechaFin;
        }

        // 2. Filtro Tipo Documento (tdoc)
        $tdocs = self::parseFilter($filtros['tdoc'] ?? $filtros['tipo_documento'] ?? null);
        if ($tdocs === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($tdocs !== null) {
            $placeholders = implode(',', array_fill(0, count($tdocs), '?'));
            $whereClauses[] = "TRIM(sale.tdoc) IN ($placeholders)";
            foreach ($tdocs as $td) $params[] = $td;
        } else {
            $whereClauses[] = "sale.tdoc IN ('01', '03', '07', '08')";
        }

        // 3. Filtro Provincia
        $provincias = self::parseFilter($filtros['provincia'] ?? $filtros['filtro_provincia'] ?? null);
        if ($provincias === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($provincias !== null) {
            $placeholders = implode(',', array_fill(0, count($provincias), '?'));
            $whereClauses[] = "TRIM(ccte.provincia) IN ($placeholders)";
            foreach ($provincias as $pv) $params[] = $pv;
        }

        // 4. Filtro Corporativo
        $coorporativos = self::parseFilter($filtros['coorporativo'] ?? $filtros['coorporativos'] ?? $filtros['filtro_coorporativo'] ?? null);
        if ($coorporativos === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($coorporativos !== null) {
            $placeholders = implode(',', array_fill(0, count($coorporativos), '?'));
            $whereClauses[] = "(TRIM(ccte1.nombre) IN ($placeholders) OR TRIM(ccte1.codigo) IN ($placeholders) OR TRIM(ccte.ruc) IN ($placeholders))";
            foreach ($coorporativos as $c) $params[] = $c;
            foreach ($coorporativos as $c) $params[] = $c;
            foreach ($coorporativos as $c) $params[] = $c;
        }

        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);

        // 5. Parámetros de Paginación en Backend
        $pagina = isset($filtros['pagina']) ? max(1, (int)$filtros['pagina']) : (isset($filtros['page']) ? max(1, (int)$filtros['page']) : 1);
        $limite = isset($filtros['limite']) ? (int)$filtros['limite'] : (isset($filtros['limit']) ? (int)$filtros['limit'] : 25);
        $isExportAll = !empty($filtros['export_all']) || $limite <= 0 || $limite >= 999999;

        // 6. Fechas únicas del rango
        $fechasMap = [];
        $startDate = strtotime($fechaInicio);
        $endDate   = strtotime($fechaFin);
        if ($startDate && $endDate && $startDate <= $endDate) {
            $curr = $startDate;
            while ($curr <= $endDate) {
                $fStr = date('Y-m-d', $curr);
                $fechasMap[$fStr] = self::formatDateLabel($fStr);
                $curr = strtotime('+1 day', $curr);
            }
        }
        $columnasFechas = array_values($fechasMap);

        // 7. Determinar lista de corporativos (Paginación)
        $sqlCoorpList = "
            SELECT 
                TRIM(ccte.provincia) AS provincia,
                TRIM(ccte.ruc) AS ruc,
                TRIM(ccte1.nombre) AS coorporativo,
                LENGTH(TRIM(ccte.ruc)) AS ruc_len
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
            {$whereSql}
            GROUP BY provincia, ruc, coorporativo, ruc_len
            ORDER BY provincia ASC, ruc_len ASC, ruc ASC, coorporativo ASC
        ";
        $stmtCoorp = $db->prepare($sqlCoorpList);
        $stmtCoorp->execute($params);
        $allCorporativos = $stmtCoorp->fetchAll(PDO::FETCH_ASSOC);

        $totalCorporativos = count($allCorporativos);
        $totalPaginas = ($limite > 0 && !$isExportAll) ? max(1, (int)ceil($totalCorporativos / $limite)) : 1;
        if ($pagina > $totalPaginas) $pagina = $totalPaginas;

        $offset = ($pagina - 1) * $limite;
        $pagedCorporativos = $isExportAll ? $allCorporativos : array_slice($allCorporativos, $offset, $limite);

        if ($totalCorporativos === 0) {
            $tipoGraficoLabel = ($metrica === 'cantidad') ? 'Cantidad' : (($metrica === 'peso') ? 'Peso' : 'Valor');
            return [
                'success'         => true,
                'status'          => 'success',
                'tipo_grafico'    => $tipoGraficoLabel,
                'metrica'         => $metrica,
                'titulo'          => "Ventas por Coorporativo - Cliente ({$tipoGraficoLabel})",
                'fecha_inicio'    => $fechaInicio,
                'fecha_fin'       => $fechaFin,
                'columnas_fechas' => $columnasFechas,
                'total_general'   => ['fechas' => [], 'general' => 0],
                'provincias'      => [],
                'paginacion'      => [
                    'pagina_actual'      => 1,
                    'limite'             => $limite,
                    'total_corporativos' => 0,
                    'total_paginas'      => 1,
                    'start_item'         => 0,
                    'end_item'           => 0
                ],
                'total_registros' => 0
            ];
        }

        // 8. Consulta detallada para corporativos de la página
        $pagedRucs = array_values(array_unique(array_column($pagedCorporativos, 'ruc')));
        $whereClausesPaged = $whereClauses;
        $paramsPaged = $params;

        if (!$isExportAll && !empty($pagedRucs)) {
            $rucPlaceholders = implode(',', array_fill(0, count($pagedRucs), '?'));
            $whereClausesPaged[] = "TRIM(ccte.ruc) IN ($rucPlaceholders)";
            foreach ($pagedRucs as $r) $paramsPaged[] = $r;
        }

        $whereSqlPaged = 'WHERE ' . implode(' AND ', $whereClausesPaged);

        $sql = "
            SELECT 
                TRIM(ccte.provincia) AS provincia,
                TRIM(ccte.ruc) AS ruc,
                TRIM(ccte1.nombre) AS coorporativo,
                TRIM(ccte.codigo) AS codigo,
                TRIM(ccte.nombre) AS cliente,
                LENGTH(TRIM(ccte.ruc)) AS ruc_len,
                LENGTH(TRIM(ccte.codigo)) AS cod_len,
                sale.tfecfac AS fecha,
                SUM(sale.tcantid) AS cantidad,
                SUM(sale.tespeci) AS peso,
                SUM(sale.timport) AS importe
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
            {$whereSqlPaged}
            GROUP BY provincia, ruc, coorporativo, codigo, cliente, ruc_len, cod_len, fecha
            ORDER BY provincia ASC, ruc_len ASC, ruc ASC, coorporativo ASC, cod_len ASC, codigo ASC, cliente ASC, fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($paramsPaged);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 9. Totales globales
        $campoMetrica = ($metrica === 'cantidad') ? 'sale.tcantid' : (($metrica === 'peso') ? 'sale.tespeci' : 'sale.timport');
        $sqlTotGlobal = "
            SELECT 
                sale.tfecfac AS fecha,
                SUM({$campoMetrica}) AS total_metrica
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
            {$whereSql}
            GROUP BY fecha
            ORDER BY fecha ASC
        ";
        $stmtTot = $db->prepare($sqlTotGlobal);
        $stmtTot->execute($params);
        $rawTotales = $stmtTot->fetchAll(PDO::FETCH_ASSOC);

        $totalesPorFechaGlobal = [];
        foreach ($columnasFechas as $col) {
            $totalesPorFechaGlobal[$col['fecha']] = 0.0;
        }
        $totalGeneralGlobal = 0.0;
        $dec = ($metrica === 'cantidad') ? 0 : 2;

        foreach ($rawTotales as $rt) {
            $f = $rt['fecha'];
            $v = (float)$rt['total_metrica'];
            if (isset($totalesPorFechaGlobal[$f])) {
                $totalesPorFechaGlobal[$f] = round($v, $dec);
            }
            $totalGeneralGlobal += $v;
        }

        // 10. Agrupar datos por Provincia -> Corporativo -> Cliente
        $arbol = [];
        foreach ($rawRows as $row) {
            $prov   = $row['provincia'] ?: 'SIN PROVINCIA';
            $ruc    = $row['ruc'] ?: 'SIN RUC';
            $coorp  = $row['coorporativo'] ?: 'SIN CORPORATIVO';
            $codCli = $row['codigo'] ?: '';
            $nomCli = $row['cliente'] ?: '';
            $fecha  = $row['fecha'];

            $val = (float)($row[$metrica] ?? 0.0);

            if (!isset($arbol[$prov])) {
                $arbol[$prov] = [];
            }
            $coorpKey = $ruc . '___' . $coorp;
            if (!isset($arbol[$prov][$coorpKey])) {
                $arbol[$prov][$coorpKey] = [
                    'ruc'          => $ruc,
                    'coorporativo' => $coorp,
                    'clientes'     => [],
                    'totales_fecha' => []
                ];
                foreach ($columnasFechas as $col) {
                    $arbol[$prov][$coorpKey]['totales_fecha'][$col['fecha']] = 0.0;
                }
            }

            $cliKey = $codCli . '___' . $nomCli;
            if (!isset($arbol[$prov][$coorpKey]['clientes'][$cliKey])) {
                $arbol[$prov][$coorpKey]['clientes'][$cliKey] = [
                    'codigo'  => $codCli,
                    'cliente' => $nomCli,
                    'fechas'  => [],
                    'total'   => 0.0
                ];
            }

            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['fechas'][$fecha] = round($val, $dec);
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['total'] += $val;

            if (isset($arbol[$prov][$coorpKey]['totales_fecha'][$fecha])) {
                $arbol[$prov][$coorpKey]['totales_fecha'][$fecha] += $val;
            }
        }

        // 11. Formatear respuesta
        $provinciasFinal = [];
        foreach ($arbol as $provNombre => $coorpsMap) {
            $coorpsList = [];

            foreach ($coorpsMap as $coorpKey => $coorpData) {
                $clientesList = [];
                $coorpTotGeneral = 0.0;

                foreach ($coorpData['clientes'] as $cliKey => $cliData) {
                    $cliFechas = [];
                    foreach ($columnasFechas as $col) {
                        $f = $col['fecha'];
                        $cliFechas[$f] = isset($cliData['fechas'][$f]) ? $cliData['fechas'][$f] : null;
                    }

                    $clientesList[] = [
                        'codigo'  => $cliData['codigo'],
                        'cliente' => $cliData['cliente'],
                        'fechas'  => $cliFechas,
                        'total'   => round($cliData['total'], $dec)
                    ];

                    $coorpTotGeneral += $cliData['total'];
                }

                $subtotalesFechas = [];
                foreach ($columnasFechas as $col) {
                    $f = $col['fecha'];
                    $sVal = $coorpData['totales_fecha'][$f] ?? 0.0;
                    $subtotalesFechas[$f] = ($sVal > 0) ? round($sVal, $dec) : null;
                }

                $coorpsList[] = [
                    'ruc'              => $coorpData['ruc'],
                    'coorporativo'     => $coorpData['coorporativo'],
                    'clientes'         => $clientesList,
                    'subtotal_fechas'  => $subtotalesFechas,
                    'subtotal_general' => round($coorpTotGeneral, $dec)
                ];
            }

            $provinciasFinal[] = [
                'provincia'     => $provNombre,
                'coorporativos' => $coorpsList
            ];
        }

        $tipoGraficoLabel = ($metrica === 'cantidad') ? 'Cantidad' : (($metrica === 'peso') ? 'Peso' : 'Valor');

        return [
            'success'          => true,
            'status'           => 'success',
            'tipo_grafico'     => $tipoGraficoLabel,
            'metrica'          => $metrica,
            'titulo'           => "Ventas por Coorporativo - Cliente ({$tipoGraficoLabel})",
            'fecha_inicio'     => $fechaInicio,
            'fecha_fin'        => $fechaFin,
            'columnas_fechas'  => $columnasFechas,
            'total_general'    => [
                'fechas'  => $totalesPorFechaGlobal,
                'general' => round($totalGeneralGlobal, $dec)
            ],
            'provincias'       => $provinciasFinal,
            'paginacion'       => [
                'pagina_actual'      => $pagina,
                'limite'             => $limite,
                'total_corporativos' => $totalCorporativos,
                'total_paginas'      => $totalPaginas,
                'start_item'         => $totalCorporativos > 0 ? $offset + 1 : 0,
                'end_item'           => min($offset + $limite, $totalCorporativos)
            ],
            'total_registros'  => count($rawRows)
        ];
    }
}
