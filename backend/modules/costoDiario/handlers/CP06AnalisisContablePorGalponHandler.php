<?php

class CP06AnalisisContablePorGalponHandler
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

        // Obtener fechas disponibles recientes de histodatosalma
        $stmtFechas = $db->query("SELECT DISTINCT fechahisto FROM histodatosalma ORDER BY fechahisto DESC LIMIT 180");
        $fechasDisponibles = $stmtFechas->fetchAll(PDO::FETCH_COLUMN);

        // Verificar si la fecha de consulta existe
        if ($fechaConsulta) {
            $stmtCheck = $db->prepare("SELECT 1 FROM histodatosalma WHERE fechahisto = :fec LIMIT 1");
            $stmtCheck->execute([':fec' => $fechaConsulta]);
            if (!$stmtCheck->fetchColumn()) {
                $fechaConsulta = null;
            }
        }

        if (!$fechaConsulta) {
            $fechaConsulta = !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2026-08-28';
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

        // Filtro opcional de Cencos / Granja
        $whereCencos = "";
        if (!empty($filtros['cencos'])) {
            $cencosFiltro = is_array($filtros['cencos']) ? $filtros['cencos'] : explode(',', $filtros['cencos']);
            $cencosConditions = [];
            foreach ($cencosFiltro as $idx => $cenVal) {
                $cenVal = trim($cenVal);
                if ($cenVal !== '' && $cenVal !== '(Todo)' && $cenVal !== 'TODOS') {
                    $pCen = ":cen_{$idx}";
                    $cencosConditions[] = "cencos = {$pCen}";
                    $params[$pCen] = $cenVal;
                }
            }
            if (!empty($cencosConditions)) {
                $whereCencos = " AND (" . implode(' OR ', $cencosConditions) . ")";
            }
        }

        // 3. Pre-cargar producción (saca_kilos) a nivel Cencos y Galpón desde histodatosprodcompa
        $stmtGalponProd = $db->prepare("SELECT CONCAT(cencos, '_', galpon) AS k, SUM(saca_kilos) AS saca_kilos 
                                        FROM histodatosprodcompa 
                                        WHERE fechahisto = :fec1 OR fechahisto = LAST_DAY(:fec2) 
                                        GROUP BY cencos, galpon");
        $stmtGalponProd->execute([':fec1' => $fechaConsulta, ':fec2' => $fechaConsulta]);
        $galponProdMap = $stmtGalponProd->fetchAll(PDO::FETCH_KEY_PAIR);

        // 4. Obtener datos detallados de histodatosalma
        $sqlAlma = "SELECT 
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
                      {$whereClasif}
                      {$whereCencos}
                    GROUP BY cencos, nomcencos, galpon, linea, nomlinea
                    ORDER BY 
                        cencos ASC, 
                        CASE WHEN galpon = '0' OR galpon = '' THEN 999 ELSE CAST(galpon AS UNSIGNED) END ASC, 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";

        $stmtAlma = $db->prepare($sqlAlma);
        $stmtAlma->execute($params);
        $rawAlma = $stmtAlma->fetchAll(PDO::FETCH_ASSOC);

        // 5. Construir estructura pivotada por Cencos y Galpón
        $cencosData = [];
        $todosGalponesGlobal = [];

        foreach ($rawAlma as $r) {
            $cencos   = trim($r['cencos'] ?? '');
            $nomcencos = trim($r['nomcencos'] ?? '');
            $galpon   = trim($r['galpon'] ?? '');
            $linea    = trim($r['linea'] ?? '');
            $nomlinea = trim($r['nomlinea'] ?? '');

            if ($galpon === '0' || $galpon === '') {
                // En Tableau CP06 se visualizan los galpones productivos 1, 2, 3...
                continue;
            }

            if (!isset($cencosData[$cencos])) {
                $cencosData[$cencos] = [
                    'cencos'       => $cencos,
                    'nomcencos'    => $nomcencos,
                    'galpones'     => [],
                    'lineas'       => [],
                    'totales'      => []
                ];
            }

            if (!in_array($galpon, $cencosData[$cencos]['galpones'], true)) {
                $cencosData[$cencos]['galpones'][] = $galpon;
            }
            if (!in_array($galpon, $todosGalponesGlobal, true)) {
                $todosGalponesGlobal[] = $galpon;
            }

            if (!isset($cencosData[$cencos]['lineas'][$linea])) {
                $cencosData[$cencos]['lineas'][$linea] = [
                    'linea'    => $linea,
                    'nomlinea' => $nomlinea,
                    'galpones' => []
                ];
            }

            $keyGalpon = "{$cencos}_{$galpon}";
            $sacaKg = isset($galponProdMap[$keyGalpon]) ? (float)$galponProdMap[$keyGalpon] : 0.0;
            $val = (float)$r['valor'];
            $cu  = ($sacaKg > 0) ? round($val / $sacaKg, 3) : 0.0;

            $cencosData[$cencos]['lineas'][$linea]['galpones'][$galpon] = [
                'cantidad'   => round((float)$r['cantidad'], 2),
                'peso'       => round((float)$r['peso'], 2),
                'valor'      => round($val, 2),
                'saca_kilos' => round($sacaKg, 2),
                'cu'         => $cu
            ];

            if (!isset($cencosData[$cencos]['totales'][$galpon])) {
                $cencosData[$cencos]['totales'][$galpon] = [
                    'cantidad'   => 0.0,
                    'peso'       => 0.0,
                    'valor'      => 0.0,
                    'saca_kilos' => round($sacaKg, 2),
                    'cu'         => 0.0
                ];
            }

            $cencosData[$cencos]['totales'][$galpon]['cantidad'] += (float)$r['cantidad'];
            $cencosData[$cencos]['totales'][$galpon]['peso']     += (float)$r['peso'];
            $cencosData[$cencos]['totales'][$galpon]['valor']    += $val;
            $cencosData[$cencos]['totales'][$galpon]['cu']       += $cu;
        }

        // Formatear array final de Cencos
        $bloquesCencos = [];
        foreach ($cencosData as $cencos => $cItem) {
            // Ordenar galpones numéricamente
            usort($cItem['galpones'], function($a, $b) {
                return (int)$a <=> (int)$b;
            });

            // Ordenar líneas
            $lineasArray = array_values($cItem['lineas']);
            usort($lineasArray, function($a, $b) {
                if ($a['linea'] === '100S') return 1;
                if ($b['linea'] === '100S') return -1;
                return strcmp($a['linea'], $b['linea']);
            });

            // Redondear totales por galpón
            $totalesRedondeados = [];
            foreach ($cItem['galpones'] as $g) {
                if (isset($cItem['totales'][$g])) {
                    $totalesRedondeados[$g] = [
                        'cantidad'   => round($cItem['totales'][$g]['cantidad'], 2),
                        'peso'       => round($cItem['totales'][$g]['peso'], 2),
                        'valor'      => round($cItem['totales'][$g]['valor'], 2),
                        'saca_kilos' => round($cItem['totales'][$g]['saca_kilos'], 2),
                        'cu'         => round($cItem['totales'][$g]['cu'], 3)
                    ];
                } else {
                    $totalesRedondeados[$g] = [
                        'cantidad'   => 0.0,
                        'peso'       => 0.0,
                        'valor'      => 0.0,
                        'saca_kilos' => 0.0,
                        'cu'         => 0.0
                    ];
                }
            }

            $bloquesCencos[] = [
                'cencos'    => $cItem['cencos'],
                'nomcencos' => $cItem['nomcencos'],
                'galpones'  => $cItem['galpones'],
                'filas'     => $lineasArray,
                'totales'   => $totalesRedondeados
            ];
        }

        // 6. Obtener Filtros Disponibles (Clasificaciones y Cencos para la fecha)
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

        $fParts = explode('-', $fechaConsulta);
        $fechaFormateada = (count($fParts) === 3) ? "{$fParts[2]}/{$fParts[1]}/{$fParts[0]}" : $fechaConsulta;

        return [
            'status'                   => 'success',
            'dashboard'                => 'CP06 AnalisisContablePorGalpon',
            'titulo'                   => 'Costo Unitario por Cencos/Linea/Galpon',
            'fecha'                    => $fechaConsulta,
            'fecha_formateada'         => $fechaFormateada,
            'fechas_disponibles'       => $fechasDisponibles,
            'filtros_disponibles'      => [
                'clasificaciones' => $clasifDisponibles,
                'cencos'          => $cencosDisponibles
            ],
            'cencos_bloques'           => $bloquesCencos,
            'total_cencos'             => count($bloquesCencos)
        ];
    }
}
