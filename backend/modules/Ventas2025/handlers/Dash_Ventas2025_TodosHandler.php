<?php

class Dash_Ventas2025_TodosHandler
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

    public static function handle(PDO $db, array $filtros): array
    {
        $whereClauses = ["sale.tline = '601'"];
        $params = [];

        // 1. Fechas
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? $filtros['fec_proceso_inicio'] ?? '2025-06-01';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? $filtros['fec_proceso_fin'] ?? '2025-06-21';
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

        // 1. Identificar todas las fechas únicas del rango y construir columnas de cabecera
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

        // 2. Estructurar Árbol Jerárquico: Provincia -> Corporativo (RUC + Nombre) -> Clientes -> Fechas
        $arbol = [];
        $totalesPorFechaGlobal = [];
        foreach ($columnasFechas as $col) {
            $totalesPorFechaGlobal[$col['fecha']] = [
                'cantidad' => 0.0,
                'peso'     => 0.0,
                'importe'  => 0.0
            ];
        }
        $totalGeneralGlobal = [
            'cantidad' => 0.0,
            'peso'     => 0.0,
            'importe'  => 0.0
        ];

        foreach ($rawRows as $row) {
            $prov   = $row['provincia'] ?: 'SIN PROVINCIA';
            $ruc    = $row['ruc'] ?: 'SIN RUC';
            $coorp  = $row['coorporativo'] ?: 'SIN CORPORATIVO';
            $codCli = $row['codigo'] ?: '';
            $nomCli = $row['cliente'] ?: '';
            $fecha  = $row['fecha'];

            $cant = (float)$row['cantidad'];
            $peso = (float)$row['peso'];
            $imp  = (float)$row['importe'];

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
                    $arbol[$prov][$coorpKey]['totales_fecha'][$col['fecha']] = [
                        'cantidad' => 0.0,
                        'peso'     => 0.0,
                        'importe'  => 0.0
                    ];
                }
            }

            $cliKey = $codCli . '___' . $nomCli;
            if (!isset($arbol[$prov][$coorpKey]['clientes'][$cliKey])) {
                $arbol[$prov][$coorpKey]['clientes'][$cliKey] = [
                    'codigo'  => $codCli,
                    'cliente' => $nomCli,
                    'fechas'  => [],
                    'total'   => [
                        'cantidad' => 0.0,
                        'peso'     => 0.0,
                        'importe'  => 0.0
                    ]
                ];
            }

            // Datos por fecha para el cliente
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['fechas'][$fecha] = [
                'cantidad'  => round($cant, 0),
                'peso'      => round($peso, 2),
                'importe'   => round($imp, 2),
                'precio_u'  => ($peso != 0.0) ? round($imp / $peso, 3) : 0.0,
                'peso_prom' => ($cant != 0.0) ? round($peso / $cant, 3) : 0.0
            ];

            // Acumular total cliente
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['total']['cantidad'] += $cant;
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['total']['peso']     += $peso;
            $arbol[$prov][$coorpKey]['clientes'][$cliKey]['total']['importe']  += $imp;

            // Acumular subtotal Corporativo por fecha
            if (isset($arbol[$prov][$coorpKey]['totales_fecha'][$fecha])) {
                $arbol[$prov][$coorpKey]['totales_fecha'][$fecha]['cantidad'] += $cant;
                $arbol[$prov][$coorpKey]['totales_fecha'][$fecha]['peso']     += $peso;
                $arbol[$prov][$coorpKey]['totales_fecha'][$fecha]['importe']  += $imp;
            }

            // Acumular globales
            if (isset($totalesPorFechaGlobal[$fecha])) {
                $totalesPorFechaGlobal[$fecha]['cantidad'] += $cant;
                $totalesPorFechaGlobal[$fecha]['peso']     += $peso;
                $totalesPorFechaGlobal[$fecha]['importe']  += $imp;
            }
            $totalGeneralGlobal['cantidad'] += $cant;
            $totalGeneralGlobal['peso']     += $peso;
            $totalGeneralGlobal['importe']  += $imp;
        }

        // 3. Formatear estructura de respuesta final con filas de Total Corporativo
        $provinciasFinal = [];

        foreach ($arbol as $provNombre => $coorpsMap) {
            $coorpsList = [];

            foreach ($coorpsMap as $coorpKey => $coorpData) {
                $clientesList = [];
                $coorpTotGeneral = ['cantidad' => 0.0, 'peso' => 0.0, 'importe' => 0.0];

                foreach ($coorpData['clientes'] as $cliKey => $cliData) {
                    $cliFechas = [];
                    foreach ($columnasFechas as $col) {
                        $f = $col['fecha'];
                        if (isset($cliData['fechas'][$f])) {
                            $cliFechas[$f] = $cliData['fechas'][$f];
                        } else {
                            $cliFechas[$f] = [
                                'cantidad'  => null,
                                'peso'      => null,
                                'importe'   => null,
                                'precio_u'  => null,
                                'peso_prom' => null
                            ];
                        }
                    }

                    $tCant = $cliData['total']['cantidad'];
                    $tPeso = $cliData['total']['peso'];
                    $tImp  = $cliData['total']['importe'];

                    $clientesList[] = [
                        'codigo'  => $cliData['codigo'],
                        'cliente' => $cliData['cliente'],
                        'fechas'  => $cliFechas,
                        'total'   => [
                            'cantidad'  => round($tCant, 0),
                            'peso'      => round($tPeso, 2),
                            'importe'   => round($tImp, 2),
                            'precio_u'  => ($tPeso != 0.0) ? round($tImp / $tPeso, 3) : 0.0,
                            'peso_prom' => ($tCant != 0.0) ? round($tPeso / $tCant, 3) : 0.0
                        ]
                    ];

                    $coorpTotGeneral['cantidad'] += $tCant;
                    $coorpTotGeneral['peso']     += $tPeso;
                    $coorpTotGeneral['importe']  += $tImp;
                }

                // Subtotales por fecha para el Corporativo
                $subtotalesFechas = [];
                foreach ($columnasFechas as $col) {
                    $f = $col['fecha'];
                    $sCant = $coorpData['totales_fecha'][$f]['cantidad'] ?? 0.0;
                    $sPeso = $coorpData['totales_fecha'][$f]['peso'] ?? 0.0;
                    $sImp  = $coorpData['totales_fecha'][$f]['importe'] ?? 0.0;

                    if ($sCant > 0 || $sPeso > 0 || $sImp > 0) {
                        $subtotalesFechas[$f] = [
                            'cantidad'  => round($sCant, 0),
                            'peso'      => round($sPeso, 2),
                            'importe'   => round($sImp, 2),
                            'precio_u'  => ($sPeso != 0.0) ? round($sImp / $sPeso, 3) : 0.0,
                            'peso_prom' => ($sCant != 0.0) ? round($sPeso / $sCant, 3) : 0.0
                        ];
                    } else {
                        $subtotalesFechas[$f] = [
                            'cantidad'  => null,
                            'peso'      => null,
                            'importe'   => null,
                            'precio_u'  => null,
                            'peso_prom' => null
                        ];
                    }
                }

                $coorpTotCant = $coorpTotGeneral['cantidad'];
                $coorpTotPeso = $coorpTotGeneral['peso'];
                $coorpTotImp  = $coorpTotGeneral['importe'];

                $coorpsList[] = [
                    'ruc'          => $coorpData['ruc'],
                    'coorporativo' => $coorpData['coorporativo'],
                    'clientes'     => $clientesList,
                    'subtotal_fechas' => $subtotalesFechas,
                    'subtotal_general' => [
                        'cantidad'  => round($coorpTotCant, 0),
                        'peso'      => round($coorpTotPeso, 2),
                        'importe'   => round($coorpTotImp, 2),
                        'precio_u'  => ($coorpTotPeso != 0.0) ? round($coorpTotImp / $coorpTotPeso, 3) : 0.0,
                        'peso_prom' => ($coorpTotCant != 0.0) ? round($coorpTotPeso / $coorpTotCant, 3) : 0.0
                    ]
                ];
            }

            $provinciasFinal[] = [
                'provincia'     => $provNombre,
                'coorporativos' => $coorpsList
            ];
        }

        // Totales globales por fecha
        $totalesGlobalesFechas = [];
        foreach ($columnasFechas as $col) {
            $f = $col['fecha'];
            $gCant = $totalesPorFechaGlobal[$f]['cantidad'] ?? 0.0;
            $gPeso = $totalesPorFechaGlobal[$f]['peso'] ?? 0.0;
            $gImp  = $totalesPorFechaGlobal[$f]['importe'] ?? 0.0;

            $totalesGlobalesFechas[$f] = [
                'cantidad'  => round($gCant, 0),
                'peso'      => round($gPeso, 2),
                'importe'   => round($gImp, 2),
                'precio_u'  => ($gPeso != 0.0) ? round($gImp / $gPeso, 3) : 0.0,
                'peso_prom' => ($gCant != 0.0) ? round($gPeso / $gCant, 3) : 0.0
            ];
        }

        $totCantGlo = $totalGeneralGlobal['cantidad'];
        $totPesoGlo = $totalGeneralGlobal['peso'];
        $totImpGlo  = $totalGeneralGlobal['importe'];

        $totalGeneral = [
            'fechas'  => $totalesGlobalesFechas,
            'general' => [
                'cantidad'  => round($totCantGlo, 0),
                'peso'      => round($totPesoGlo, 2),
                'importe'   => round($totImpGlo, 2),
                'precio_u'  => ($totPesoGlo != 0.0) ? round($totImpGlo / $totPesoGlo, 3) : 0.0,
                'peso_prom' => ($totCantGlo != 0.0) ? round($totPesoGlo / $totCantGlo, 3) : 0.0
            ]
        ];

        return [
            'success'          => true,
            'status'           => 'success',
            'tipo_grafico'     => 'Todos',
            'titulo'           => 'Ventas por Coorporativo - Cliente',
            'fecha_inicio'     => $fechaInicio,
            'fecha_fin'        => $fechaFin,
            'columnas_fechas'  => $columnasFechas,
            'total_general'    => $totalGeneral,
            'provincias'       => $provinciasFinal,
            'total_registros'  => count($rawRows)
        ];
    }
}
