<?php

class CP05AnalisisContableCostosDiariosHandler
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

        // Obtener fechas disponibles recientes de histodatosalmaacucompa
        $stmtFechas = $db->query("SELECT DISTINCT fechahisto FROM histodatosalmaacucompa ORDER BY fechahisto DESC LIMIT 180");
        $fechasDisponibles = $stmtFechas->fetchAll(PDO::FETCH_COLUMN);

        // Verificar si la fecha de consulta existe en histodatosalmaacucompa
        if ($fechaConsulta) {
            $stmtCheck = $db->prepare("SELECT 1 FROM histodatosalmaacucompa WHERE fechahisto = :fec LIMIT 1");
            $stmtCheck->execute([':fec' => $fechaConsulta]);
            if (!$stmtCheck->fetchColumn()) {
                $fechaConsulta = null;
            }
        }

        // Si no hay fecha válida, usar la primera fecha disponible en BD
        if (!$fechaConsulta) {
            $fechaConsulta = !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2026-06-12';
        }

        // 2. Procesar Filtro de Clasificación
        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        $whereClasif = "";
        $params = [
            ':fec' => $fechaConsulta
        ];

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

        // 3. Pre-cargar producción (saca_kilos) a nivel Cencos y Galpón desde histodatosprodcompa (coincidiendo con fecha o fin de mes)
        $stmtCencosProd = $db->prepare("SELECT cencos, SUM(saca_kilos) AS saca_kilos 
                                        FROM histodatosprodcompa 
                                        WHERE fechahisto = :fec1 OR fechahisto = LAST_DAY(:fec2) 
                                        GROUP BY cencos");
        $stmtCencosProd->execute([':fec1' => $fechaConsulta, ':fec2' => $fechaConsulta]);
        $cencosProdMap = $stmtCencosProd->fetchAll(PDO::FETCH_KEY_PAIR);

        $stmtGalponProd = $db->prepare("SELECT CONCAT(cencos, '_', galpon) AS k, SUM(saca_kilos) AS saca_kilos 
                                        FROM histodatosprodcompa 
                                        WHERE fechahisto = :fec1 OR fechahisto = LAST_DAY(:fec2) 
                                        GROUP BY cencos, galpon");
        $stmtGalponProd->execute([':fec1' => $fechaConsulta, ':fec2' => $fechaConsulta]);
        $galponProdMap = $stmtGalponProd->fetchAll(PDO::FETCH_KEY_PAIR);

        // 4. TABLA 1: "Costo Produccion por Kg de Pollo Vivo" (histodatosalmaacucompa)
        // Columnas: linea, nomlinea, clasificacion, valor, kilos_prod, cu
        $sqlTabla1 = "SELECT 
                        linea,
                        nomlinea,
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        SUM(valor) AS valor,
                        AVG(comodin) AS kilos_prod
                      FROM histodatosalmaacucompa
                      WHERE fechahisto = :fec
                        {$whereClasif}
                      GROUP BY linea, nomlinea
                      ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC,
                        nomlinea ASC";

        $stmt1 = $db->prepare($sqlTabla1);
        $stmt1->execute($params);
        $rawTabla1 = $stmt1->fetchAll(PDO::FETCH_ASSOC);

        $filasTabla1 = [];
        $totalValor1 = 0.0;
        $kilosProdDia = 0.0;

        foreach ($rawTabla1 as $r) {
            $val = (float)$r['valor'];
            $kg  = (float)$r['kilos_prod'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            if ($kilosProdDia === 0.0 && $kg > 0) {
                $kilosProdDia = $kg;
            }

            $totalValor1 += $val;

            $filasTabla1[] = [
                'linea'         => $r['linea'] ?? '',
                'nomlinea'      => $r['nomlinea'] ?? '',
                'clasificacion' => $r['clasificacion'] ?? '',
                'valor'         => round($val, 2),
                'kilos_prod'    => round($kg, 2),
                'cu'            => $cu
            ];
        }

        $totalCU1 = ($kilosProdDia > 0) ? round($totalValor1 / $kilosProdDia, 3) : 0.0;

        $tabla1Resumen = [
            'filas' => $filasTabla1,
            'totales' => [
                'linea'      => '',
                'nomlinea'   => 'Total general',
                'valor'      => round($totalValor1, 2),
                'kilos_prod' => round($kilosProdDia, 2),
                'cu'         => $totalCU1
            ]
        ];

        // 5. TABLA 4: "Costo Unitario por Linea/Cencos/Galpon" (cencos, galpon, linea)
        // Obtenemos los datos detallados a nivel de cencos, galpon, linea y codigo para calcular el CU exacto por galpón
        $sqlAlmaDetalle = "SELECT 
                            cencos,
                            nomcencos,
                            galpon,
                            linea,
                            nomlinea,
                            codigo,
                            nomcodigo,
                            SUM(cantidad) AS cantidad,
                            SUM(peso) AS peso,
                            SUM(valor) AS valor
                          FROM histodatosalma
                          WHERE fechahisto = :fec
                            {$whereClasif}
                          GROUP BY cencos, nomcencos, galpon, linea, nomlinea, codigo, nomcodigo
                          ORDER BY 
                            cencos ASC, 
                            CASE WHEN galpon = '0' OR galpon = '' THEN 999 ELSE CAST(galpon AS UNSIGNED) END ASC, 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC,
                            codigo ASC";

        $stmtAlma = $db->prepare($sqlAlmaDetalle);
        $stmtAlma->execute($params);
        $rawAlmaDetalle = $stmtAlma->fetchAll(PDO::FETCH_ASSOC);

        // Agregación de Tabla 4 (Por cencos, galpon, linea)
        $t4Map = [];
        $totalCant4 = 0.0;
        $totalPeso4 = 0.0;
        $totalVal4  = 0.0;
        $totalCU4   = 0.0;

        foreach ($rawAlmaDetalle as $r) {
            $cencos = $r['cencos'] ?? '';
            $galpon = $r['galpon'] ?? '';
            $linea  = $r['linea'] ?? '';
            $k4 = "{$cencos}_{$galpon}_{$linea}";

            if (!isset($t4Map[$k4])) {
                $keyGalpon = "{$cencos}_{$galpon}";
                $sacaKg = isset($galponProdMap[$keyGalpon]) ? (float)$galponProdMap[$keyGalpon] : 0.0;
                $t4Map[$k4] = [
                    'cencos'     => $cencos,
                    'nomcencos'  => $r['nomcencos'] ?? '',
                    'galpon'     => $galpon,
                    'linea'      => $linea,
                    'nomlinea'   => $r['nomlinea'] ?? '',
                    'cantidad'   => 0.0,
                    'peso'       => 0.0,
                    'valor'      => 0.0,
                    'saca_kilos' => $sacaKg,
                    'cu'         => 0.0
                ];
            }

            $cant = (float)$r['cantidad'];
            $peso = (float)$r['peso'];
            $val  = (float)$r['valor'];

            $t4Map[$k4]['cantidad'] += $cant;
            $t4Map[$k4]['peso']     += $peso;
            $t4Map[$k4]['valor']    += $val;

            $totalCant4 += $cant;
            $totalPeso4 += $peso;
            $totalVal4  += $val;
        }

        $filasTabla4 = [];
        foreach ($t4Map as $item4) {
            $sacaKg = (float)$item4['saca_kilos'];
            $val = (float)$item4['valor'];
            $cu = ($sacaKg > 0) ? round($val / $sacaKg, 3) : 0.0;
            $item4['cu'] = $cu;
            $item4['cantidad'] = round($item4['cantidad'], 2);
            $item4['peso'] = round($item4['peso'], 2);
            $item4['valor'] = round($item4['valor'], 2);
            $item4['saca_kilos'] = round($sacaKg, 2);

            $filasTabla4[] = $item4;
            $totalCU4 += $cu;
        }

        // Ordenar Tabla 4: galpones activos 1, 2, 3... primero, y galpón 0 al final
        usort($filasTabla4, function($a, $b) {
            if ($a['cencos'] !== $b['cencos']) {
                return strcmp($a['cencos'], $b['cencos']);
            }
            $gA = ($a['galpon'] === '0' || $a['galpon'] === '') ? 999 : (int)$a['galpon'];
            $gB = ($b['galpon'] === '0' || $b['galpon'] === '') ? 999 : (int)$b['galpon'];
            if ($gA !== $gB) {
                return $gA <=> $gB;
            }
            return strcmp($a['linea'], $b['linea']);
        });

        $tabla4PorGalponLinea = [
            'filas' => $filasTabla4,
            'total_registros' => count($filasTabla4),
            'totales' => [
                'cantidad'   => round($totalCant4, 2),
                'peso'       => round($totalPeso4, 2),
                'valor'      => round($totalVal4, 2),
                'saca_kilos' => round($kilosProdDia, 2),
                'cu'         => round($totalCU4, 3)
            ]
        ];

        // 6. TABLA 3: "Costo Produccion por Kg de Pollo Vivo/Linea" (cencos, linea)
        // En Tableau, el CU a nivel de cencos/línea es la suma de los CUs de sus galpones
        $t3Map = [];
        $totalCant3 = 0.0;
        $totalPeso3 = 0.0;
        $totalVal3  = 0.0;
        $totalCU3   = 0.0;

        foreach ($filasTabla4 as $item4) {
            $cencos = $item4['cencos'];
            $linea  = $item4['linea'];
            $k3 = "{$cencos}_{$linea}";

            if (!isset($t3Map[$k3])) {
                $sacaKgCencos = isset($cencosProdMap[$cencos]) ? (float)$cencosProdMap[$cencos] : 0.0;
                $t3Map[$k3] = [
                    'cencos'     => $cencos,
                    'nomcencos'  => $item4['nomcencos'],
                    'linea'      => $linea,
                    'nomlinea'   => $item4['nomlinea'],
                    'cantidad'   => 0.0,
                    'peso'       => 0.0,
                    'valor'      => 0.0,
                    'saca_kilos' => round($sacaKgCencos, 2),
                    'cu'         => 0.0
                ];
            }

            $t3Map[$k3]['cantidad'] += (float)$item4['cantidad'];
            $t3Map[$k3]['peso']     += (float)$item4['peso'];
            $t3Map[$k3]['valor']    += (float)$item4['valor'];
            $t3Map[$k3]['cu']       += (float)$item4['cu'];

            $totalCant3 += (float)$item4['cantidad'];
            $totalPeso3 += (float)$item4['peso'];
            $totalVal3  += (float)$item4['valor'];
            $totalCU3   += (float)$item4['cu'];
        }

        $filasTabla3 = [];
        foreach ($t3Map as $item3) {
            $item3['cantidad'] = round($item3['cantidad'], 2);
            $item3['peso'] = round($item3['peso'], 2);
            $item3['valor'] = round($item3['valor'], 2);
            $item3['cu'] = round($item3['cu'], 3);
            $filasTabla3[] = $item3;
        }

        usort($filasTabla3, function($a, $b) {
            if ($a['cencos'] !== $b['cencos']) {
                return strcmp($a['cencos'], $b['cencos']);
            }
            return strcmp($a['linea'], $b['linea']);
        });

        $tabla3PorCencosLinea = [
            'filas' => $filasTabla3,
            'total_registros' => count($filasTabla3),
            'totales' => [
                'cantidad'   => round($totalCant3, 2),
                'peso'       => round($totalPeso3, 2),
                'valor'      => round($totalVal3, 2),
                'saca_kilos' => round($kilosProdDia, 2),
                'cu'         => round($totalCU3, 3)
            ]
        ];

        // 7. TABLA 2: "Costo Produccion por Codigo" (histodatosalma)
        // Agrupación a nivel de línea / familia (idéntico a Tableau)
        $t2Map = [];
        $totalCant2 = 0.0;
        $totalPeso2 = 0.0;
        $totalVal2  = 0.0;
        $totalCU2   = 0.0;

        foreach ($rawAlmaDetalle as $r) {
            $cencos   = $r['cencos'] ?? '';
            $galpon   = $r['galpon'] ?? '';
            $linea    = $r['linea'] ?? '';
            $nomlinea = $r['nomlinea'] ?? '';

            $codigoTableau = 'P' . $linea;
            if ($linea === '001') {
                $codigoTableau = 'P0001000';
            } elseif ($linea === '002') {
                $codigoTableau = 'PL40';
            } elseif (substr($linea, 0, 1) === 'P') {
                $codigoTableau = $linea;
            }

            $nomcodigoTableau = $nomlinea;
            if ($linea === '001') {
                $nomcodigoTableau = 'Pollo BB';
            } elseif ($linea === '002') {
                $nomcodigoTableau = 'Alimento balanceado';
            }

            $k2 = $linea;

            $keyGalpon = "{$cencos}_{$galpon}";
            $sacaKg = isset($galponProdMap[$keyGalpon]) ? (float)$galponProdMap[$keyGalpon] : 0.0;
            $val = (float)$r['valor'];
            $cuRow = ($sacaKg > 0) ? ($val / $sacaKg) : 0.0;

            if (!isset($t2Map[$k2])) {
                $t2Map[$k2] = [
                    'linea'      => $linea,
                    'nomlinea'   => $nomlinea,
                    'codigo'     => $codigoTableau,
                    'nomcodigo'  => $nomcodigoTableau,
                    'cantidad'   => 0.0,
                    'peso'       => 0.0,
                    'valor'      => 0.0,
                    'saca_kilos' => round($kilosProdDia, 2),
                    'cu'         => 0.0
                ];
            }

            $cant = (float)$r['cantidad'];
            $peso = (float)$r['peso'];

            $t2Map[$k2]['cantidad'] += $cant;
            $t2Map[$k2]['peso']     += $peso;
            $t2Map[$k2]['valor']    += $val;
            $t2Map[$k2]['cu']       += $cuRow;

            $totalCant2 += $cant;
            $totalPeso2 += $peso;
            $totalVal2  += $val;
            $totalCU2   += $cuRow;
        }

        $filasTabla2 = [];
        foreach ($t2Map as $item2) {
            $item2['cantidad'] = round($item2['cantidad'], 2);
            $item2['peso'] = round($item2['peso'], 2);
            $item2['valor'] = round($item2['valor'], 2);
            $item2['cu'] = round($item2['cu'], 3);
            $filasTabla2[] = $item2;
        }

        usort($filasTabla2, function($a, $b) {
            if ($a['linea'] === '100S') return 1;
            if ($b['linea'] === '100S') return -1;
            return strcmp($a['linea'], $b['linea']);
        });

        $tabla2PorCodigo = [
            'filas' => $filasTabla2,
            'total_registros' => count($filasTabla2),
            'totales' => [
                'cantidad'   => round($totalCant2, 2),
                'peso'       => round($totalPeso2, 2),
                'valor'      => round($totalVal2, 2),
                'saca_kilos' => round($kilosProdDia, 2),
                'cu'         => round($totalCU2, 3)
            ]
        ];

        // 8. OBTENER FILTROS DISPONIBLES (Clasificaciones para la fecha)
        $sqlClasifDisp = "SELECT 
                            TRIM(linea) AS linea, 
                            TRIM(COALESCE(nomlinea, '')) AS nomlinea, 
                            TRIM(CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, '')))) AS clasificacion
                          FROM histodatosalmaacucompa
                          WHERE fechahisto = :fec
                          GROUP BY linea, nomlinea
                          ORDER BY 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";
        $stmtC = $db->prepare($sqlClasifDisp);
        $stmtC->execute([':fec' => $fechaConsulta]);
        $clasifDisponibles = $stmtC->fetchAll(PDO::FETCH_ASSOC);

        // Formato de fecha para visualización
        $fParts = explode('-', $fechaConsulta);
        $fechaFormateada = (count($fParts) === 3) ? "{$fParts[2]}/{$fParts[1]}/{$fParts[0]}" : $fechaConsulta;

        return [
            'status'                   => 'success',
            'dashboard'                => 'CP05 AnalisisContableCostosDiarios',
            'fecha'                    => $fechaConsulta,
            'fecha_formateada'         => $fechaFormateada,
            'fechas_disponibles'       => $fechasDisponibles,
            'filtros_disponibles'      => [
                'clasificaciones' => $clasifDisponibles
            ],
            'tabla1_resumen'           => $tabla1Resumen,
            'tabla2_por_codigo'        => $tabla2PorCodigo,
            'tabla3_por_cencos_linea'  => $tabla3PorCencosLinea,
            'tabla4_por_galpon_linea'  => $tabla4PorGalponLinea
        ];
    }
}
