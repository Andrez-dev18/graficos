<?php

class CP08ComparativoGranjaGalponHandler
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

        // Obtener fechas disponibles de histodatosprodcompa
        $stmtFechas = $db->query("SELECT DISTINCT fechahisto FROM histodatosprodcompa ORDER BY fechahisto DESC LIMIT 180");
        $fechasDisponibles = $stmtFechas->fetchAll(PDO::FETCH_COLUMN);

        $fechaProd = self::resolveFechaTable($db, 'histodatosprodcompa', $fechaConsulta, $fechasDisponibles);
        $fechaLine = self::resolveFechaTable($db, 'histodatosalmalineacompa', $fechaConsulta, $fechasDisponibles);
        $fechaAlma = self::resolveFechaTable($db, 'histodatosalmacompa', $fechaConsulta, $fechasDisponibles);

        // 2. Procesar Filtros
        // Filtro Cencos / Granja
        $cencosFiltro = !empty($filtros['cencos']) ? $filtros['cencos'] : (!empty($filtros['nomcencos']) ? $filtros['nomcencos'] : null);
        if (is_string($cencosFiltro)) {
            $cencosFiltro = array_map('trim', explode(',', $cencosFiltro));
        }

        $whereCencosProd = "";
        $whereCencosAlma = "";
        $paramsProd = [':fec' => $fechaProd];
        $paramsAlma = [':fec' => $fechaAlma];
        $paramsLine = [':fec' => $fechaLine];

        if (!empty($cencosFiltro) && !in_array('TODOS', $cencosFiltro, true) && !in_array('(Todo)', $cencosFiltro, true)) {
            $cencosCondProd = [];
            $cencosCondAlma = [];
            foreach ($cencosFiltro as $idx => $cenVal) {
                $cenVal = trim($cenVal);
                if ($cenVal !== '' && $cenVal !== '(Todo)' && $cenVal !== 'TODOS') {
                    $pCen1 = ":cp1_{$idx}";
                    $pCen2 = ":cp2_{$idx}";
                    $cencosCondProd[] = "(cencos = {$pCen1} OR nomcencos = {$pCen2})";
                    $paramsProd[$pCen1] = $cenVal;
                    $paramsProd[$pCen2] = $cenVal;

                    $pCa1 = ":ca1_{$idx}";
                    $pCa2 = ":ca2_{$idx}";
                    $cencosCondAlma[] = "(cencos = {$pCa1} OR nomcencos = {$pCa2})";
                    $paramsAlma[$pCa1] = $cenVal;
                    $paramsAlma[$pCa2] = $cenVal;

                    $pCl1 = ":cl1_{$idx}";
                    $pCl2 = ":cl2_{$idx}";
                    $paramsLine[$pCl1] = $cenVal;
                    $paramsLine[$pCl2] = $cenVal;
                }
            }
            if (!empty($cencosCondProd)) {
                $whereCencosProd = " AND (" . implode(' OR ', $cencosCondProd) . ")";
                $whereCencosAlma = " AND (" . implode(' OR ', $cencosCondAlma) . ")";
            }
        }

        // Filtro Clasificación
        $whereClasifAlma = "";
        $whereClasifLine = "";
        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifCondAlma = [];
            $clasifCondLine = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifCondAlma[] = "(linea IS NULL OR TRIM(linea) = '')";
                    $clasifCondLine[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKeyA1 = ":cla1_{$idx}";
                    $pKeyA2 = ":cla2_{$idx}";
                    $clasifCondAlma[] = "(TRIM(linea) = {$pKeyA1} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKeyA2})";
                    $paramsAlma[$pKeyA1] = $cVal;
                    $paramsAlma[$pKeyA2] = $cVal;

                    $pKeyL1 = ":cll1_{$idx}";
                    $pKeyL2 = ":cll2_{$idx}";
                    $clasifCondLine[] = "(TRIM(linea) = {$pKeyL1} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKeyL2})";
                    $paramsLine[$pKeyL1] = $cVal;
                    $paramsLine[$pKeyL2] = $cVal;
                }
            }
            if (!empty($clasifCondAlma)) {
                $whereClasifAlma = " AND (" . implode(' OR ', $clasifCondAlma) . ")";
                $whereClasifLine = " AND (" . implode(' OR ', $clasifCondLine) . ")";
            }
        }

        // 3. TABLA 1: "Datos Productivos" (histodatosprodcompa)
        $sqlT1 = "SELECT 
                    cencos,
                    nomcencos,
                    galpon,
                    SUM(saca_und) AS saca_und,
                    SUM(saca_kilos) AS saca_kilos,
                    SUM(calimento) AS calimento,
                    SUM(cantidadedad) AS cantidadedad,
                    SUM(pollosmuertos) AS pollosmuertos,
                    SUM(cargapollo) AS cargapollo
                  FROM histodatosprodcompa
                  WHERE fechahisto = :fec
                    {$whereCencosProd}
                  GROUP BY cencos, nomcencos, galpon
                  ORDER BY cencos ASC, CAST(galpon AS UNSIGNED) ASC";

        $stmtT1 = $db->prepare($sqlT1);
        $stmtT1->execute($paramsProd);
        $rawT1 = $stmtT1->fetchAll(PDO::FETCH_ASSOC);

        $granjasT1 = [];
        $totalGenUnd = 0.0;
        $totalGenKilos = 0.0;
        $totalGenCalim = 0.0;
        $totalGenCantEdad = 0.0;
        $totalGenMuertos = 0.0;
        $totalGenCarga = 0.0;

        foreach ($rawT1 as $row) {
            $cen = trim($row['cencos'] ?? '');
            $nomCen = trim($row['nomcencos'] ?? '');
            $gal = trim($row['galpon'] ?? '');

            $und = (float)($row['saca_und'] ?? 0);
            $kilos = (float)($row['saca_kilos'] ?? 0);
            $calim = (float)($row['calimento'] ?? 0);
            $cantEdad = (float)($row['cantidadedad'] ?? 0);
            $muertos = (float)($row['pollosmuertos'] ?? 0);
            $carga = (float)($row['cargapollo'] ?? 0);

            $pesoProm = $und > 0 ? ($kilos / $und) : 0.0;
            $ica = $kilos > 0 ? ($calim / $kilos) : 0.0;
            $edadVen = $und > 0 ? ($cantEdad / $und) : 0.0;
            $porcMort = $carga > 0 ? (($muertos / $carga) * 100) : 0.0;
            $pgd = $edadVen > 0 ? ($pesoProm / $edadVen) : 0.0;

            if (!isset($granjasT1[$cen])) {
                $granjasT1[$cen] = [
                    'cencos'    => $cen,
                    'nomcencos' => $nomCen,
                    'galpones'  => [],
                    'subtotal_raw' => [
                        'saca_und'      => 0.0,
                        'saca_kilos'    => 0.0,
                        'calimento'     => 0.0,
                        'cantidadedad'  => 0.0,
                        'pollosmuertos' => 0.0,
                        'cargapollo'    => 0.0
                    ]
                ];
            }

            $granjasT1[$cen]['galpones'][] = [
                'cencos'        => $cen,
                'nomcencos'     => $nomCen,
                'galpon'        => $gal,
                'unidades_ven'  => round($und, 0),
                'kilos_vendidos'=> round($kilos, 2),
                'peso_promedio' => round($pesoProm, 3),
                'ica'           => round($ica, 3),
                'prom_edad_ven' => round($edadVen, 3),
                'porc_mort'     => round($porcMort, 3),
                'pgd'           => round($pgd, 3)
            ];

            $granjasT1[$cen]['subtotal_raw']['saca_und']      += $und;
            $granjasT1[$cen]['subtotal_raw']['saca_kilos']    += $kilos;
            $granjasT1[$cen]['subtotal_raw']['calimento']     += $calim;
            $granjasT1[$cen]['subtotal_raw']['cantidadedad']  += $cantEdad;
            $granjasT1[$cen]['subtotal_raw']['pollosmuertos'] += $muertos;
            $granjasT1[$cen]['subtotal_raw']['cargapollo']    += $carga;

            $totalGenUnd      += $und;
            $totalGenKilos    += $kilos;
            $totalGenCalim    += $calim;
            $totalGenCantEdad += $cantEdad;
            $totalGenMuertos  += $muertos;
            $totalGenCarga    += $carga;
        }

        // Formatear subtotales de cada granja
        $listaGranjasT1 = [];
        foreach ($granjasT1 as $cen => $gData) {
            $sRaw = $gData['subtotal_raw'];
            $sUnd = $sRaw['saca_und'];
            $sKilos = $sRaw['saca_kilos'];
            $sCalim = $sRaw['calimento'];
            $sCantEdad = $sRaw['cantidadedad'];
            $sMuertos = $sRaw['pollosmuertos'];
            $sCarga = $sRaw['cargapollo'];

            $sPesoProm = $sUnd > 0 ? ($sKilos / $sUnd) : 0.0;
            $sIca = $sKilos > 0 ? ($sCalim / $sKilos) : 0.0;
            $sEdadVen = $sUnd > 0 ? ($sCantEdad / $sUnd) : 0.0;
            $sPorcMort = $sCarga > 0 ? (($sMuertos / $sCarga) * 100) : 0.0;
            $sPgd = $sEdadVen > 0 ? ($sPesoProm / $sEdadVen) : 0.0;

            $gData['subtotal'] = [
                'unidades_ven'  => round($sUnd, 0),
                'kilos_vendidos'=> round($sKilos, 2),
                'peso_promedio' => round($sPesoProm, 3),
                'ica'           => round($sIca, 3),
                'prom_edad_ven' => round($sEdadVen, 3),
                'porc_mort'     => round($sPorcMort, 3),
                'pgd'           => round($sPgd, 3)
            ];
            unset($gData['subtotal_raw']);
            $listaGranjasT1[] = $gData;
        }

        $genPesoProm = $totalGenUnd > 0 ? ($totalGenKilos / $totalGenUnd) : 0.0;
        $genIca = $totalGenKilos > 0 ? ($totalGenCalim / $totalGenKilos) : 0.0;
        $genEdadVen = $totalGenUnd > 0 ? ($totalGenCantEdad / $totalGenUnd) : 0.0;
        $genPorcMort = $totalGenCarga > 0 ? (($totalGenMuertos / $totalGenCarga) * 100) : 0.0;
        $genPgd = $genEdadVen > 0 ? ($genPesoProm / $genEdadVen) : 0.0;

        $totalGeneralT1 = [
            'unidades_ven'  => round($totalGenUnd, 0),
            'kilos_vendidos'=> round($totalGenKilos, 2),
            'peso_promedio' => round($genPesoProm, 3),
            'ica'           => round($genIca, 3),
            'prom_edad_ven' => round($genEdadVen, 3),
            'porc_mort'     => round($genPorcMort, 3),
            'pgd'           => round($genPgd, 3)
        ];

        // 4. Determinar Cencos Activo para Tablas 2 y 3
        $cencosActivo = !empty($filtros['cencos_seleccionado']) ? trim($filtros['cencos_seleccionado']) : null;
        if (!$cencosActivo && !empty($listaGranjasT1)) {
            $cencosActivo = $listaGranjasT1[0]['cencos'];
        }

        $nomCencosActivo = '';
        foreach ($listaGranjasT1 as $g) {
            if ($g['cencos'] === $cencosActivo) {
                $nomCencosActivo = $g['nomcencos'];
                break;
            }
        }

        // 5. TABLA 2: "Comparacion Linea" (histodatosalmalineacompa)
        $paramsLineActivo = [
            ':fec' => $fechaLine,
            ':cen' => $cencosActivo
        ];
        $whereClasifLineActivo = "";
        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifCondLineActivo = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifCondLineActivo[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey = ":clla_{$idx}";
                    $clasifCondLineActivo[] = "(TRIM(linea) = {$pKey} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey})";
                    $paramsLineActivo[$pKey] = $cVal;
                }
            }
            if (!empty($clasifCondLineActivo)) {
                $whereClasifLineActivo = " AND (" . implode(' OR ', $clasifCondLineActivo) . ")";
            }
        }

        $sqlT2 = "SELECT 
                    linea,
                    nomlinea,
                    galpon,
                    SUM(valor) AS valor,
                    AVG(comodin) AS comodin
                  FROM histodatosalmalineacompa
                  WHERE fechahisto = :fec
                    AND cencos = :cen
                    {$whereClasifLineActivo}
                  GROUP BY linea, nomlinea, galpon
                  ORDER BY 
                    CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC, 
                    CAST(galpon AS UNSIGNED) ASC";

        $stmtT2 = $db->prepare($sqlT2);
        $stmtT2->execute($paramsLineActivo);
        $rawT2 = $stmtT2->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar filas por línea y galpón
        $lineasT2 = [];
        $galponesT2Set = [];
        $totalesGalponT2 = [];

        foreach ($rawT2 as $row) {
            $lin = trim($row['linea'] ?? '');
            $nomLin = trim($row['nomlinea'] ?? '');
            $gal = trim($row['galpon'] ?? '');
            $val = (float)($row['valor'] ?? 0);
            $com = (float)($row['comodin'] ?? 0);
            $cu = $com > 0 ? ($val / $com) : 0.0;

            if (!in_array($gal, $galponesT2Set, true)) {
                $galponesT2Set[] = $gal;
            }

            if (!isset($lineasT2[$lin])) {
                $lineasT2[$lin] = [
                    'linea'    => $lin,
                    'nomlinea' => $nomLin,
                    'galpones' => []
                ];
            }

            $lineasT2[$lin]['galpones'][$gal] = [
                'valor'    => round($val, 2),
                'kilos'    => round($com, 2),
                'cu'       => round($cu, 3),
                'dif_cu'   => 0.0
            ];

            if (!isset($totalesGalponT2[$gal])) {
                $totalesGalponT2[$gal] = [
                    'valor' => 0.0,
                    'kilos' => $com,
                    'cu'    => 0.0
                ];
            }
            $totalesGalponT2[$gal]['valor'] += $val;
        }

        // Ordenar galpones de tabla 2
        usort($galponesT2Set, function($a, $b) {
            return (int)$a - (int)$b;
        });

        // Calcular Dif en CU respecto al primer galpón si hay más de 1 galpón
        $primerGalpon = !empty($galponesT2Set) ? $galponesT2Set[0] : null;
        foreach ($lineasT2 as $lin => &$lData) {
            $cuBase = ($primerGalpon && isset($lData['galpones'][$primerGalpon])) ? $lData['galpones'][$primerGalpon]['cu'] : 0.0;
            foreach ($galponesT2Set as $g) {
                if (isset($lData['galpones'][$g])) {
                    $cuAct = $lData['galpones'][$g]['cu'];
                    $lData['galpones'][$g]['dif_cu'] = round($cuAct - $cuBase, 3);
                }
            }
        }
        unset($lData);

        // Calcular CU total por galpón
        foreach ($totalesGalponT2 as $g => &$tG) {
            $tG['cu'] = $tG['kilos'] > 0 ? round($tG['valor'] / $tG['kilos'], 3) : 0.0;
            $tG['valor'] = round($tG['valor'], 2);
            $tG['kilos'] = round($tG['kilos'], 2);
        }
        unset($tG);

        // 6. TABLA 3: "Comparativo Detalle Productos" (histodatosalmacompa)
        $paramsAlmaActivo = [
            ':fec' => $fechaAlma,
            ':cen' => $cencosActivo
        ];
        $whereClasifAlmaActivo = "";
        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $clasifCondAlmaActivo = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $clasifCondAlmaActivo[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pKey = ":claa_{$idx}";
                    $clasifCondAlmaActivo[] = "(TRIM(linea) = {$pKey} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pKey})";
                    $paramsAlmaActivo[$pKey] = $cVal;
                }
            }
            if (!empty($clasifCondAlmaActivo)) {
                $whereClasifAlmaActivo = " AND (" . implode(' OR ', $clasifCondAlmaActivo) . ")";
            }
        }

        $sqlT3 = "SELECT 
                    linea,
                    codigo,
                    nomcodigo,
                    transaccion,
                    galpon,
                    SUM(cantidad) AS cantidad,
                    SUM(peso) AS peso,
                    SUM(valor) AS valor
                  FROM histodatosalmacompa
                  WHERE fechahisto = :fec
                    AND cencos = :cen
                    {$whereClasifAlmaActivo}
                  GROUP BY linea, codigo, nomcodigo, transaccion, galpon
                  ORDER BY 
                    CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC, 
                    codigo ASC, 
                    transaccion ASC, 
                    CAST(galpon AS UNSIGNED) ASC";

        $stmtT3 = $db->prepare($sqlT3);
        $stmtT3->execute($paramsAlmaActivo);
        $rawT3 = $stmtT3->fetchAll(PDO::FETCH_ASSOC);

        $itemsT3 = [];
        $galponesT3Set = [];
        $subtotalesLineaT3 = [];
        $totalesGeneralesT3 = [];

        foreach ($rawT3 as $row) {
            $lin = trim($row['linea'] ?? '');
            $cod = trim($row['codigo'] ?? '');
            $nomCod = trim($row['nomcodigo'] ?? '');
            $trx = trim($row['transaccion'] ?? '');
            $gal = trim($row['galpon'] ?? '');

            $cant = (float)($row['cantidad'] ?? 0);
            $peso = (float)($row['peso'] ?? 0);
            $val = (float)($row['valor'] ?? 0);

            if (!in_array($gal, $galponesT3Set, true)) {
                $galponesT3Set[] = $gal;
            }

            $itemKey = "{$lin}___{$cod}___{$trx}";
            if (!isset($itemsT3[$itemKey])) {
                $itemsT3[$itemKey] = [
                    'linea'       => $lin,
                    'codigo'      => $cod,
                    'nomcodigo'   => $nomCod,
                    'transaccion' => $trx,
                    'galpones'    => []
                ];
            }

            $itemsT3[$itemKey]['galpones'][$gal] = [
                'cantidad' => round($cant, 2),
                'peso'     => round($peso, 2),
                'valor'    => round($val, 2)
            ];

            // Subtotales por Línea
            if (!isset($subtotalesLineaT3[$lin])) {
                $subtotalesLineaT3[$lin] = [];
            }
            if (!isset($subtotalesLineaT3[$lin][$gal])) {
                $subtotalesLineaT3[$lin][$gal] = [
                    'cantidad' => 0.0,
                    'peso'     => 0.0,
                    'valor'    => 0.0
                ];
            }
            $subtotalesLineaT3[$lin][$gal]['cantidad'] += $cant;
            $subtotalesLineaT3[$lin][$gal]['peso']     += $peso;
            $subtotalesLineaT3[$lin][$gal]['valor']    += $val;

            // Totales Generales
            if (!isset($totalesGeneralesT3[$gal])) {
                $totalesGeneralesT3[$gal] = [
                    'cantidad' => 0.0,
                    'peso'     => 0.0,
                    'valor'    => 0.0
                ];
            }
            $totalesGeneralesT3[$gal]['cantidad'] += $cant;
            $totalesGeneralesT3[$gal]['peso']     += $peso;
            $totalesGeneralesT3[$gal]['valor']    += $val;
        }

        // Ordenar galpones de tabla 3
        usort($galponesT3Set, function($a, $b) {
            return (int)$a - (int)$b;
        });

        // Formatear subtotales de tabla 3
        foreach ($subtotalesLineaT3 as $lin => &$galMap) {
            foreach ($galMap as $g => &$valG) {
                $valG['cantidad'] = round($valG['cantidad'], 2);
                $valG['peso']     = round($valG['peso'], 2);
                $valG['valor']    = round($valG['valor'], 2);
            }
        }
        unset($galMap);

        foreach ($totalesGeneralesT3 as $g => &$valG) {
            $valG['cantidad'] = round($valG['cantidad'], 2);
            $valG['peso']     = round($valG['peso'], 2);
            $valG['valor']    = round($valG['valor'], 2);
        }
        unset($valG);

        // 7. Filtros Disponibles
        $sqlCencosDisp = "SELECT DISTINCT cencos, nomcencos 
                          FROM histodatosprodcompa 
                          WHERE fechahisto = :fec 
                          ORDER BY cencos ASC";
        $stmtCen = $db->prepare($sqlCencosDisp);
        $stmtCen->execute([':fec' => $fechaProd]);
        $cencosDisponibles = $stmtCen->fetchAll(PDO::FETCH_ASSOC);

        $sqlClasifDisp = "SELECT 
                            TRIM(linea) AS linea, 
                            TRIM(COALESCE(nomlinea, '')) AS nomlinea, 
                            TRIM(CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, '')))) AS clasificacion
                          FROM histodatosalmalineacompa
                          WHERE fechahisto = :fec
                          GROUP BY linea, nomlinea
                          ORDER BY 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";
        $stmtC = $db->prepare($sqlClasifDisp);
        $stmtC->execute([':fec' => $fechaLine]);
        $clasifDisponibles = $stmtC->fetchAll(PDO::FETCH_ASSOC);

        $fParts = explode('-', $fechaProd);
        $fechaFormateada = (count($fParts) === 3) ? "{$fParts[2]}/{$fParts[1]}/{$fParts[0]}" : $fechaProd;

        return [
            'status'                   => 'success',
            'dashboard'                => 'CP08 ComparativoGranjaGalpon',
            'titulo'                   => 'Comparativo Granja Galpón',
            'fecha'                    => $fechaProd,
            'fecha_formateada'         => $fechaFormateada,
            'fechas_disponibles'       => $fechasDisponibles,
            'cencos_activo'            => $cencosActivo,
            'nomcencos_activo'         => $nomCencosActivo,
            'filtros_disponibles'      => [
                'cencos'          => $cencosDisponibles,
                'clasificaciones' => $clasifDisponibles
            ],
            'tabla1_datos_productivos' => [
                'granjas'       => $listaGranjasT1,
                'total_general' => $totalGeneralT1
            ],
            'tabla2_comparacion_linea' => [
                'galpones_headers' => $galponesT2Set,
                'filas'            => array_values($lineasT2),
                'totales_galpon'   => $totalesGalponT2
            ],
            'tabla3_comparativo_detalle' => [
                'galpones_headers'   => $galponesT3Set,
                'filas'              => array_values($itemsT3),
                'subtotales_linea'   => $subtotalesLineaT3,
                'totales_generales'  => $totalesGeneralesT3
            ]
        ];
    }

    private static function resolveFechaTable(PDO $db, string $tabla, ?string $fechaInput, array $fechasDisponibles): string
    {
        if (empty($fechaInput)) {
            return !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2025-10-31';
        }

        // 1. Coincidencia exacta
        $stmt = $db->prepare("SELECT fechahisto FROM {$tabla} WHERE fechahisto = ? LIMIT 1");
        $stmt->execute([$fechaInput]);
        $res = $stmt->fetchColumn();
        if ($res) return $res;

        // 2. Coincidencia por LAST_DAY o mismo Año/Mes
        $stmt = $db->prepare("SELECT fechahisto FROM {$tabla} 
                              WHERE fechahisto = LAST_DAY(?) 
                                 OR (YEAR(fechahisto) = YEAR(?) AND MONTH(fechahisto) = MONTH(?))
                              ORDER BY fechahisto DESC LIMIT 1");
        $stmt->execute([$fechaInput, $fechaInput, $fechaInput]);
        $res = $stmt->fetchColumn();
        if ($res) return $res;

        // 3. Fecha más cercana
        $stmt = $db->prepare("SELECT fechahisto FROM {$tabla} 
                              ORDER BY ABS(DATEDIFF(fechahisto, ?)) ASC LIMIT 1");
        $stmt->execute([$fechaInput]);
        $res = $stmt->fetchColumn();
        if ($res) return $res;

        return !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2025-10-31';
    }
}
