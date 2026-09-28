<?php

class Dash_Ventas2024_SingleMetricHandler
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
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? $filtros['fec_proceso_inicio'] ?? '2024-06-01';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? $filtros['fec_proceso_fin'] ?? '2024-06-21';
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
            {$whereSql}
            GROUP BY provincia, ruc, coorporativo, codigo, cliente, ruc_len, cod_len, fecha
            ORDER BY provincia ASC, ruc_len ASC, ruc ASC, coorporativo ASC, cod_len ASC, codigo ASC, cliente ASC, fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 1. Identificar todas las fechas del rango
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
        } else {
            foreach ($rawRows as $r) {
                $f = $r['fecha'];
                if (!isset($fechasMap[$f])) {
                    $fechasMap[$f] = self::formatDateLabel($f);
                }
            }
            ksort($fechasMap);
        }

        $columnasFechas = array_values($fechasMap);

        // 2. Agrupar datos por Provincia -> Corporativo -> Cliente
        $arbol = [];
        $totalesPorFechaGlobal = [];
        foreach ($columnasFechas as $col) {
            $totalesPorFechaGlobal[$col['fecha']] = 0.0;
        }
        $totalGeneralGlobal = 0.0;

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

            $dec = ($metrica === 'cantidad') ? 0 : 2;
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['fechas'][$fecha] = round($val, $dec);
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['total'] += $val;

            if (isset($arbol[$prov][$coorpKey]['totales_fecha'][$fecha])) {
                $arbol[$prov][$coorpKey]['totales_fecha'][$fecha] += $val;
            }

            if (isset($totalesPorFechaGlobal[$fecha])) {
                $totalesPorFechaGlobal[$fecha] += $val;
            }
            $totalGeneralGlobal += $val;
        }

        // 3. Formatear respuesta
        $provinciasFinal = [];
        $dec = ($metrica === 'cantidad') ? 0 : 2;

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

        $totalesGlobalesFechas = [];
        foreach ($columnasFechas as $col) {
            $f = $col['fecha'];
            $gVal = $totalesPorFechaGlobal[$f] ?? 0.0;
            $totalesGlobalesFechas[$f] = round($gVal, $dec);
        }

        $tituloMap = [
            'cantidad' => 'Ventas por Coorporativo - Cliente (Cantidad)',
            'peso'     => 'Ventas por Coorporativo - Cliente (Peso)',
            'importe'  => 'Ventas por Coorporativo - Cliente (Valor)'
        ];

        return [
            'success'          => true,
            'status'           => 'success',
            'tipo_grafico'     => ucfirst($metrica === 'importe' ? 'Valor' : $metrica),
            'metrica'          => $metrica,
            'titulo'           => $tituloMap[$metrica] ?? 'Ventas por Coorporativo - Cliente',
            'fecha_inicio'     => $fechaInicio,
            'fecha_fin'        => $fechaFin,
            'columnas_fechas'  => $columnasFechas,
            'total_general'    => [
                'fechas'  => $totalesGlobalesFechas,
                'general' => round($totalGeneralGlobal, $dec)
            ],
            'provincias'       => $provinciasFinal,
            'total_registros'  => count($rawRows)
        ];
    }
}
