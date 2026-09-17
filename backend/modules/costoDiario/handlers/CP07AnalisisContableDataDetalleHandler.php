<?php

class CP07AnalisisContableDataDetalleHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Determinar Fecha de Consulta
        $fechaConsulta = !empty($filtros['fecha_seleccionada']) ? trim($filtros['fecha_seleccionada']) : null;
        if (!$fechaConsulta && !empty($filtros['fechahisto'])) {
            $fechaConsulta = trim($filtros['fechahisto']);
        }
        if (!$fechaConsulta && !empty($filtros['por_fecha'])) {
            $fechaConsulta = trim($filtros['por_fecha']);
        }
        if (!$fechaConsulta && !empty($filtros['fecha_fin'])) {
            $fechaConsulta = trim($filtros['fecha_fin']);
        }
        if (!$fechaConsulta && !empty($filtros['fecha_inicio'])) {
            $fechaConsulta = trim($filtros['fecha_inicio']);
        }

        // Obtener fechas disponibles recientes
        $stmtFechas = $db->query("SELECT DISTINCT fechahisto FROM histodatosalma ORDER BY fechahisto DESC LIMIT 180");
        $fechasDisponibles = $stmtFechas->fetchAll(PDO::FETCH_COLUMN);

        if ($fechaConsulta) {
            $stmtCheck = $db->prepare("SELECT 1 FROM histodatosalma WHERE fechahisto = :fec LIMIT 1");
            $stmtCheck->execute([':fec' => $fechaConsulta]);
            if (!$stmtCheck->fetchColumn()) {
                $fechaConsulta = null;
            }
        }

        if (!$fechaConsulta) {
            $fechaConsulta = !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2026-08-09';
        }

        // 2. Procesar Filtros
        $params = [':fec' => $fechaConsulta];

        // Filtro Clasificación
        $whereClasif = "";
        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }
        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifConditions = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifConditions[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey1 = ":cl1_{$idx}";
                    $pKey2 = ":cl2_{$idx}";
                    $clasifConditions[] = "(TRIM(linea) = {$pKey1} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey2})";
                    $params[$pKey1] = $cVal;
                    $params[$pKey2] = $cVal;
                }
            }
            if (!empty($clasifConditions)) {
                $whereClasif = " AND (" . implode(' OR ', $clasifConditions) . ")";
            }
        }

        // Filtro Cencos / Granja
        $whereCencos = "";
        if (!empty($filtros['cencos']) || !empty($filtros['nomcencos'])) {
            $cencosRaw = !empty($filtros['cencos']) ? $filtros['cencos'] : $filtros['nomcencos'];
            $cencosFiltro = is_array($cencosRaw) ? $cencosRaw : explode(',', $cencosRaw);
            $cencosConditions = [];
            foreach ($cencosFiltro as $idx => $cenVal) {
                $cenVal = trim($cenVal);
                if ($cenVal !== '' && $cenVal !== '(Todo)' && $cenVal !== 'TODOS') {
                    $pCen1 = ":cen1_{$idx}";
                    $pCen2 = ":cen2_{$idx}";
                    $cencosConditions[] = "(cencos = {$pCen1} OR nomcencos = {$pCen2})";
                    $params[$pCen1] = $cenVal;
                    $params[$pCen2] = $cenVal;
                }
            }
            if (!empty($cencosConditions)) {
                $whereCencos = " AND (" . implode(' OR ', $cencosConditions) . ")";
            }
        }

        // Filtro Galpón
        $whereGalpon = "";
        if (!empty($filtros['galpon'])) {
            $galponFiltro = is_array($filtros['galpon']) ? $filtros['galpon'] : explode(',', $filtros['galpon']);
            $galponConditions = [];
            foreach ($galponFiltro as $idx => $gVal) {
                $gVal = trim($gVal);
                if ($gVal !== '' && $gVal !== '(Todo)' && $gVal !== 'TODOS') {
                    $pGal = ":gal_{$idx}";
                    $galponConditions[] = "galpon = {$pGal}";
                    $params[$pGal] = $gVal;
                }
            }
            if (!empty($galponConditions)) {
                $whereGalpon = " AND (" . implode(' OR ', $galponConditions) . ")";
            }
        }

        // 3. Pre-cargar producción (saca_kilos) a nivel Galpón y Cencos
        $stmtGalponProd = $db->prepare("SELECT CONCAT(cencos, '_', galpon) AS k, SUM(saca_kilos) AS saca_kilos 
                                        FROM histodatosprodcompa 
                                        WHERE fechahisto = :fec1 OR fechahisto = LAST_DAY(:fec2) 
                                        GROUP BY cencos, galpon");
        $stmtGalponProd->execute([':fec1' => $fechaConsulta, ':fec2' => $fechaConsulta]);
        $galponProdMap = $stmtGalponProd->fetchAll(PDO::FETCH_KEY_PAIR);

        $stmtCencosProd = $db->prepare("SELECT cencos, SUM(saca_kilos) AS saca_kilos 
                                        FROM histodatosprodcompa 
                                        WHERE fechahisto = :fec1 OR fechahisto = LAST_DAY(:fec2) 
                                        GROUP BY cencos");
        $stmtCencosProd->execute([':fec1' => $fechaConsulta, ':fec2' => $fechaConsulta]);
        $cencosProdMap = $stmtCencosProd->fetchAll(PDO::FETCH_KEY_PAIR);

        // 4. PANEL 1: "Costo Unitario por Cencos/Galpon/Linea"
        $sqlP1 = "SELECT 
                    cencos,
                    nomcencos,
                    galpon,
                    linea,
                    nomlinea,
                    SUM(cantidad) AS cantidad,
                    SUM(peso) AS peso,
                    SUM(valor) AS valor
                  FROM histodatosalma
                  WHERE fechahisto = :fec
                    AND galpon != '0' AND galpon != '' AND galpon IS NOT NULL
                    {$whereClasif}
                    {$whereCencos}
                    {$whereGalpon}
                  GROUP BY cencos, nomcencos, galpon, linea, nomlinea
                  ORDER BY 
                    cencos ASC, 
                    CAST(galpon AS UNSIGNED) ASC, 
                    CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";

        $stmtP1 = $db->prepare($sqlP1);
        $stmtP1->execute($params);
        $rawP1 = $stmtP1->fetchAll(PDO::FETCH_ASSOC);

        $filasPanel1 = [];
        $totalCant1 = 0.0;
        $totalPeso1 = 0.0;
        $totalVal1  = 0.0;
        $totalCU1   = 0.0;

        foreach ($rawP1 as $r) {
            $cencos = trim($r['cencos'] ?? '');
            $galpon = trim($r['galpon'] ?? '');
            $linea  = trim($r['linea'] ?? '');
            $val    = (float)$r['valor'];
            $cant   = (float)$r['cantidad'];
            $peso   = (float)$r['peso'];

            $keyGalpon = "{$cencos}_{$galpon}";
            $sacaKg = isset($galponProdMap[$keyGalpon]) ? (float)$galponProdMap[$keyGalpon] : 0.0;
            if ($sacaKg === 0.0 && ($galpon === '0' || $galpon === '')) {
                $sacaKg = isset($cencosProdMap[$cencos]) ? (float)$cencosProdMap[$cencos] : 0.0;
            }

            $cu = ($sacaKg > 0) ? round($val / $sacaKg, 3) : 0.0;

            $totalCant1 += $cant;
            $totalPeso1 += $peso;
            $totalVal1  += $val;
            $totalCU1   += $cu;

            $filasPanel1[] = [
                'cencos'     => $cencos,
                'nomcencos'  => trim($r['nomcencos'] ?? ''),
                'galpon'     => $galpon,
                'linea'      => $linea,
                'nomlinea'   => trim($r['nomlinea'] ?? ''),
                'cantidad'   => round($cant, 2),
                'peso'       => round($peso, 2),
                'valor'      => round($val, 2),
                'saca_kilos' => round($sacaKg, 2),
                'cu'         => $cu
            ];
        }

        $panel1CostoUnitario = [
            'filas' => $filasPanel1,
            'total_registros' => count($filasPanel1),
            'totales' => [
                'cantidad' => round($totalCant1, 2),
                'peso'     => round($totalPeso1, 2),
                'valor'    => round($totalVal1, 2),
                'cu'       => round($totalCU1, 3)
            ]
        ];

        // 5. PANEL 2: "Detalle del costo Unitario por Linea"
        $sqlP2 = "SELECT 
                    cencos,
                    nomcencos,
                    galpon,
                    linea,
                    nomlinea,
                    codigo,
                    nomcodigo,
                    transaccion,
                    SUM(cantidad) AS cantidad,
                    SUM(peso) AS peso,
                    SUM(valor) AS valor
                  FROM histodatosalma
                  WHERE fechahisto = :fec
                    {$whereClasif}
                    {$whereCencos}
                    {$whereGalpon}
                  GROUP BY cencos, nomcencos, galpon, linea, nomlinea, codigo, nomcodigo, transaccion
                  ORDER BY 
                    cencos ASC, 
                    CASE WHEN galpon = '0' OR galpon = '' THEN 0 ELSE CAST(galpon AS UNSIGNED) END ASC, 
                    CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC,
                    codigo ASC";

        $stmtP2 = $db->prepare($sqlP2);
        $stmtP2->execute($params);
        $rawP2 = $stmtP2->fetchAll(PDO::FETCH_ASSOC);

        $filasPanel2 = [];
        $totalCant2 = 0.0;
        $totalPeso2 = 0.0;
        $totalVal2  = 0.0;

        // Mapeo de valor acumulado por código de alimento (Línea 002) para el Panel 3
        $alimentosValorMap = [];

        foreach ($rawP2 as $r) {
            $val  = (float)$r['valor'];
            $cant = (float)$r['cantidad'];
            $peso = (float)$r['peso'];
            $cod  = trim($r['codigo'] ?? '');
            $lin  = trim($r['linea'] ?? '');

            $puKilo = ($peso > 0) ? round($val / $peso, 2) : 0.0;
            $puCant = ($cant > 0) ? round($val / $cant, 3) : 0.0;

            if ($lin === '002' || substr($cod, 0, 2) === 'PL') {
                if (!isset($alimentosValorMap[$cod])) {
                    $alimentosValorMap[$cod] = [
                        'nomalim'     => trim($r['nomcodigo'] ?? ''),
                        'transaccion' => trim($r['transaccion'] ?? 'S003'),
                        'valor'       => 0.0
                    ];
                }
                $alimentosValorMap[$cod]['valor'] += $val;
            }

            $totalCant2 += $cant;
            $totalPeso2 += $peso;
            $totalVal2  += $val;

            $filasPanel2[] = [
                'cencos'      => trim($r['cencos'] ?? ''),
                'nomcencos'   => trim($r['nomcencos'] ?? ''),
                'galpon'      => trim($r['galpon'] ?? ''),
                'linea'       => $lin,
                'nomlinea'    => trim($r['nomlinea'] ?? ''),
                'codigo'      => $cod,
                'nomcodigo'   => trim($r['nomcodigo'] ?? ''),
                'transaccion' => trim($r['transaccion'] ?? ''),
                'cantidad'    => round($cant, 2),
                'peso'        => round($peso, 2),
                'valor'       => round($val, 2),
                'pu_kilo'     => $puKilo,
                'pu_cant'     => $puCant
            ];
        }

        $panel2DetalleLinea = [
            'filas' => $filasPanel2,
            'total_registros' => count($filasPanel2),
            'totales' => [
                'cantidad' => round($totalCant2, 2),
                'peso'     => round($totalPeso2, 2),
                'valor'    => round($totalVal2, 2)
            ]
        ];

        // 6. PANEL 3: "Formula" (histoformulaalim)
        // Obtener fórmulas para la fecha
        $sqlFormulas = "SELECT 
                            codalim,
                            nomalim,
                            codinsu,
                            nominsu,
                            lininsu,
                            nliinsu,
                            porinsu,
                            valcons,
                            pescons
                        FROM histoformulaalim
                        WHERE fechahisto = :fec
                        ORDER BY codalim ASC, codinsu ASC";

        $stmtF = $db->prepare($sqlFormulas);
        $stmtF->execute([':fec' => $fechaConsulta]);
        $rawFormulas = $stmtF->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar fórmulas por alimento y calcular suma de valcons para pvacons
        $formulasPorAlimento = [];
        $totalValconsPorAlim = [];

        foreach ($rawFormulas as $f) {
            $codAlim = trim($f['codalim'] ?? '');
            if (!isset($formulasPorAlimento[$codAlim])) {
                $formulasPorAlimento[$codAlim] = [];
                $totalValconsPorAlim[$codAlim] = 0.0;
            }
            $formulasPorAlimento[$codAlim][] = $f;
            $totalValconsPorAlim[$codAlim] += (float)($f['valcons'] ?? 0);
        }

        // Construir filas del Panel 3
        $filasPanel3 = [];
        $lineainsuDisponibles = [];

        // Filtro de lineainsu si se proporciona
        $filtroLineainsu = !empty($filtros['lineainsu']) ? trim($filtros['lineainsu']) : null;

        foreach ($formulasPorAlimento as $codAlim => $insumos) {
            // Si el alimento está en los movimientos de almacén, usamos su valor de almacén; si no, usamos el del primer registro
            $alimInfo = $alimentosValorMap[$codAlim] ?? null;
            $valorAlimento = $alimInfo ? (float)$alimInfo['valor'] : 0.0;
            $transaccionAlim = $alimInfo ? $alimInfo['transaccion'] : 'S003';
            $nomAlim = $alimInfo ? $alimInfo['nomalim'] : trim($insumos[0]['nomalim'] ?? '');

            $totValconsAlim = $totalValconsPorAlim[$codAlim] ?? 0.0;

            foreach ($insumos as $ins) {
                $codInsu = trim($ins['codinsu'] ?? '');
                $nomInsu = trim($ins['nominsu'] ?? '');
                $linInsu = trim($ins['lininsu'] ?? '');
                $nliInsu = trim($ins['nliinsu'] ?? '');

                if ($linInsu === '') {
                    $prefix3 = substr($codInsu, 0, 4);
                    if ($prefix3 === 'M000') {
                        $linInsu = '100';
                        $nliInsu = 'Materia Prima';
                    } elseif ($prefix3 === 'M001') {
                        $linInsu = '101';
                        $nliInsu = 'Conservantes/Secuestrante/Fungicida';
                    } elseif ($prefix3 === 'M002') {
                        $linInsu = '102';
                        $nliInsu = 'Antibiótico';
                    } elseif ($prefix3 === 'M003') {
                        $linInsu = '103';
                        $nliInsu = 'Vitaminas / Minerales';
                    } else {
                        $linInsu = '100';
                        $nliInsu = 'Materia Prima';
                    }
                }

                $lineaInsuFull = trim("{$linInsu} {$nliInsu}");

                if (!in_array($lineaInsuFull, $lineainsuDisponibles, true)) {
                    $lineainsuDisponibles[] = $lineaInsuFull;
                }

                if ($filtroLineainsu && $filtroLineainsu !== '(Todo)' && $filtroLineainsu !== 'TODOS') {
                    if ($lineaInsuFull !== $filtroLineainsu && strpos($lineaInsuFull, $filtroLineainsu) !== 0) {
                        continue;
                    }
                }

                $porInsuRatio = (float)($ins['porinsu'] ?? 0);
                $valCons = (float)($ins['valcons'] ?? 0);

                // pvacons es el ratio respecto al total de valcons de este alimento
                $pvaconsRatio = ($totValconsAlim > 0) ? ($valCons / $totValconsAlim) : 0.0;

                // Valor Insu = AVG([valor]) * porinsu
                $valorInsu = $valorAlimento * $porInsuRatio;

                // Valor Dist = AVG([valor]) * pvacons
                $valorDist = $valorAlimento * $pvaconsRatio;

                $filasPanel3[] = [
                    'item'         => $codAlim,
                    'nomalim'      => $nomAlim,
                    'transaccion'  => $transaccionAlim,
                    'codinsu'      => $codInsu,
                    'nominsu'      => $nomInsu,
                    'insumo'       => "{$codInsu} {$nomInsu}",
                    'lininsu'      => $linInsu,
                    'nliinsu'      => $nliInsu,
                    'lineainsu'    => $lineaInsuFull,
                    'valor'        => round($valorAlimento, 2),
                    'porinsu'      => round($porInsuRatio * 100, 2),
                    'valor_insu'   => round($valorInsu, 2),
                    'pvacons'      => round($pvaconsRatio * 100, 2),
                    'valor_dist'   => round($valorDist, 2)
                ];
            }
        }

        $panel3Formula = [
            'filas' => $filasPanel3,
            'total_registros' => count($filasPanel3)
        ];

        // 7. Filtros Disponibles
        $sqlClasifDisp = "SELECT 
                            TRIM(linea) AS linea, 
                            TRIM(COALESCE(nomlinea, '')) AS nomlinea, 
                            TRIM(CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, '')))) AS clasificacion
                          FROM histodatosalma
                          WHERE fechahisto = :fec
                          GROUP BY linea, nomlinea
                          ORDER BY 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";
        $stmtC = $db->prepare($sqlClasifDisp);
        $stmtC->execute([':fec' => $fechaConsulta]);
        $clasifDisponibles = $stmtC->fetchAll(PDO::FETCH_ASSOC);

        $sqlCencosDisp = "SELECT DISTINCT cencos, nomcencos 
                          FROM histodatosalma 
                          WHERE fechahisto = :fec 
                          ORDER BY cencos ASC";
        $stmtCen = $db->prepare($sqlCencosDisp);
        $stmtCen->execute([':fec' => $fechaConsulta]);
        $cencosDisponibles = $stmtCen->fetchAll(PDO::FETCH_ASSOC);

        $sqlGalponDisp = "SELECT DISTINCT galpon 
                          FROM histodatosalma 
                          WHERE fechahisto = :fec 
                          ORDER BY CASE WHEN galpon = '0' OR galpon = '' THEN 0 ELSE CAST(galpon AS UNSIGNED) END ASC";
        $stmtGal = $db->prepare($sqlGalponDisp);
        $stmtGal->execute([':fec' => $fechaConsulta]);
        $galponesDisponibles = $stmtGal->fetchAll(PDO::FETCH_COLUMN);

        $fParts = explode('-', $fechaConsulta);
        $fechaFormateada = (count($fParts) === 3) ? "{$fParts[2]}/{$fParts[1]}/{$fParts[0]}" : $fechaConsulta;

        return [
            'status'                   => 'success',
            'dashboard'                => 'CP07 AnalisisContableDataDetalle',
            'titulo'                   => 'Análisis Contable Data Detalle',
            'fecha'                    => $fechaConsulta,
            'fecha_formateada'         => $fechaFormateada,
            'fechas_disponibles'       => $fechasDisponibles,
            'filtros_disponibles'      => [
                'clasificaciones' => $clasifDisponibles,
                'cencos'          => $cencosDisponibles,
                'galpones'        => $galponesDisponibles,
                'lineas_insumo'   => $lineainsuDisponibles
            ],
            'panel1_costo_unitario'    => $panel1CostoUnitario,
            'panel2_detalle_linea'     => $panel2DetalleLinea,
            'panel3_formula'           => $panel3Formula
        ];
    }
}
