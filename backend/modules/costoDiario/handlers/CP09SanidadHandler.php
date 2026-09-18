<?php

class CP09SanidadHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Procesar Filtros
        // Filtro Granjas / Cencos
        $cencosFiltro = !empty($filtros['cencos']) ? $filtros['cencos'] : (!empty($filtros['nomcencos']) ? $filtros['nomcencos'] : null);
        if (is_string($cencosFiltro)) {
            $cencosFiltro = array_map('trim', explode(',', $cencosFiltro));
        }

        // Filtro Galpones
        $galponFiltro = !empty($filtros['galpon']) ? $filtros['galpon'] : null;
        if (is_string($galponFiltro)) {
            $galponFiltro = array_map('trim', explode(',', $galponFiltro));
        }

        // Filtro Clasificación
        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        // Filtro Fechas (opcional, solo si el usuario no tiene (Todo) o busca un rango específico)
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : null;
        $fechaFin = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : null;
        $aplicarFiltroFechas = !empty($filtros['filtrar_por_fecha']) && $fechaInicio && $fechaFin;

        // Opciones de Filtros Disponibles
        $opcionesFiltros = self::obtenerOpcionesFiltros($db);

        // Cláusulas WHERE
        $whereProd = "WHERE 1=1";
        $whereLine = "WHERE 1=1";
        $whereDet = "WHERE 1=1";

        $paramsProd = [];
        $paramsLine = [];
        $paramsDet = [];

        if ($aplicarFiltroFechas) {
            $whereProd .= " AND (((fechamin <= :ffin_p AND fechamax >= :fini_p)) OR (fechahisto BETWEEN :fini_p2 AND :ffin_p2))";
            $paramsProd[':fini_p'] = $fechaInicio;
            $paramsProd[':ffin_p'] = $fechaFin;
            $paramsProd[':fini_p2'] = $fechaInicio;
            $paramsProd[':ffin_p2'] = $fechaFin;

            $whereLine .= " AND (((fechamin <= :ffin_l AND fechamax >= :fini_l)) OR (fechahisto BETWEEN :fini_l2 AND :ffin_l2))";
            $paramsLine[':fini_l'] = $fechaInicio;
            $paramsLine[':ffin_l'] = $fechaFin;
            $paramsLine[':fini_l2'] = $fechaInicio;
            $paramsLine[':ffin_l2'] = $fechaFin;
        }

        // Cláusula de Cencos
        if (!empty($cencosFiltro) && !in_array('TODOS', $cencosFiltro, true) && !in_array('(Todo)', $cencosFiltro, true)) {
            $condProd = [];
            $condLine = [];
            $condDet = [];
            foreach ($cencosFiltro as $idx => $cenVal) {
                $cenVal = trim($cenVal);
                if ($cenVal !== '' && $cenVal !== '(Todo)' && $cenVal !== 'TODOS') {
                    $pP1 = ":cp1_{$idx}";
                    $pP2 = ":cp2_{$idx}";
                    $condProd[] = "(cencos = {$pP1} OR nomcencos = {$pP2})";
                    $paramsProd[$pP1] = $cenVal;
                    $paramsProd[$pP2] = $cenVal;

                    $pL1 = ":cl1_{$idx}";
                    $pL2 = ":cl2_{$idx}";
                    $condLine[] = "(cencos = {$pL1} OR nomcencos = {$pL2})";
                    $paramsLine[$pL1] = $cenVal;
                    $paramsLine[$pL2] = $cenVal;

                    $pD1 = ":cd1_{$idx}";
                    $pD2 = ":cd2_{$idx}";
                    $condDet[] = "(cencos = {$pD1} OR nomcencos = {$pD2})";
                    $paramsDet[$pD1] = $cenVal;
                    $paramsDet[$pD2] = $cenVal;
                }
            }
            if (!empty($condProd)) {
                $whereProd .= " AND (" . implode(' OR ', $condProd) . ")";
                $whereLine .= " AND (" . implode(' OR ', $condLine) . ")";
                $whereDet .= " AND (" . implode(' OR ', $condDet) . ")";
            }
        }

        // Cláusula de Galpones
        if (!empty($galponFiltro) && !in_array('TODOS', $galponFiltro, true) && !in_array('(Todo)', $galponFiltro, true)) {
            $condGProd = [];
            $condGLine = [];
            $condGDet = [];
            foreach ($galponFiltro as $idx => $gVal) {
                $gVal = trim($gVal);
                if ($gVal !== '' && $gVal !== '(Todo)' && $gVal !== 'TODOS') {
                    $pG1 = ":gp1_{$idx}";
                    $condGProd[] = "galpon = {$pG1}";
                    $paramsProd[$pG1] = $gVal;

                    $pG2 = ":gl1_{$idx}";
                    $condGLine[] = "galpon = {$pG2}";
                    $paramsLine[$pG2] = $gVal;

                    $pG3 = ":gd1_{$idx}";
                    $condGDet[] = "galpon = {$pG3}";
                    $paramsDet[$pG3] = $gVal;
                }
            }
            if (!empty($condGProd)) {
                $whereProd .= " AND (" . implode(' OR ', $condGProd) . ")";
                $whereLine .= " AND (" . implode(' OR ', $condGLine) . ")";
                $whereDet .= " AND (" . implode(' OR ', $condGDet) . ")";
            }
        }

        // Cláusula de Clasificación (para tabla 3)
        if (!empty($clasifFiltro) && !in_array('TODOS', $clasifFiltro, true) && !in_array('(Todo)', $clasifFiltro, true)) {
            $condClas = [];
            foreach ($clasifFiltro as $idx => $cVal) {
                $cVal = trim($cVal);
                if ($cVal === 'NULL' || $cVal === '') {
                    $condClas[] = "(linea IS NULL OR TRIM(linea) = '')";
                } else {
                    $pClas1 = ":clp1_{$idx}";
                    $pClas2 = ":clp2_{$idx}";
                    $condClas[] = "(TRIM(linea) = {$pClas1} OR CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, ''))) = {$pClas2})";
                    $paramsLine[$pClas1] = $cVal;
                    $paramsLine[$pClas2] = $cVal;
                }
            }
            if (!empty($condClas)) {
                $whereLine .= " AND (" . implode(' OR ', $condClas) . ")";
            }
        }

        // =========================================================================
        // 2. TABLA 1: DATOS PRODUCTIVOS
        // =========================================================================
        $sqlT1 = "
            SELECT 
                cencos,
                nomcencos,
                galpon,
                SUM(saca_und) as unidades_ven,
                SUM(saca_kilos) as kilos_vendidos,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(saca_kilos) / SUM(saca_und) ELSE 0 END as peso_promedio,
                CASE WHEN SUM(saca_kilos) > 0 THEN SUM(calimento) / SUM(saca_kilos) ELSE 0 END as ica,
                CASE WHEN SUM(saca_und) > 0 THEN SUM(cantidadedad) / SUM(saca_und) ELSE 0 END as prom_edad_ven,
                CASE WHEN SUM(cargapollo) > 0 THEN (SUM(pollosmuertos) / SUM(cargapollo)) * 100 ELSE 0 END as porc_mort,
                CASE WHEN SUM(cantidadedad) > 0 THEN (SUM(saca_kilos) / SUM(saca_und)) / (SUM(cantidadedad) / SUM(saca_und)) ELSE 0 END as pgd
            FROM histodatosprodcompa
            {$whereProd}
            GROUP BY cencos, nomcencos, galpon
            ORDER BY cencos, CAST(galpon AS UNSIGNED)
        ";

        $stmtT1 = $db->prepare($sqlT1);
        $stmtT1->execute($paramsProd);
        $rawT1 = $stmtT1->fetchAll(PDO::FETCH_ASSOC);

        $granjasMapT1 = [];
        $galponesSet = [];
        $t1DataByGalpon = [];
        $unidadesVendidasMap = [];

        foreach ($rawT1 as $r) {
            $cen = (string)$r['cencos'];
            $nom = (string)$r['nomcencos'];
            $gal = (string)$r['galpon'];

            if (!isset($granjasMapT1[$cen])) {
                $granjasMapT1[$cen] = [
                    'cencos' => $cen,
                    'nomcencos' => $nom,
                    'label' => trim($cen . ' ' . $nom)
                ];
            }
            $galponesSet[$gal] = true;

            $und = (float)$r['unidades_ven'];
            $kg = (float)$r['kilos_vendidos'];
            $pesoProm = (float)$r['peso_promedio'];
            $ica = (float)$r['ica'];
            $edad = (float)$r['prom_edad_ven'];
            $mort = (float)$r['porc_mort'];
            $pgd = (float)$r['pgd'];

            $unidadesVendidasMap[$cen][$gal] = $und;

            if (!isset($t1DataByGalpon[$gal])) {
                $t1DataByGalpon[$gal] = [
                    'unidades_ven' => [],
                    'kilos_vendidos' => [],
                    'peso_promedio' => [],
                    'ica' => [],
                    'prom_edad_ven' => [],
                    'porc_mort' => [],
                    'pgd' => []
                ];
            }

            $t1DataByGalpon[$gal]['unidades_ven'][$cen] = $und;
            $t1DataByGalpon[$gal]['kilos_vendidos'][$cen] = $kg;
            $t1DataByGalpon[$gal]['peso_promedio'][$cen] = $pesoProm;
            $t1DataByGalpon[$gal]['ica'][$cen] = $ica;
            $t1DataByGalpon[$gal]['prom_edad_ven'][$cen] = $edad;
            $t1DataByGalpon[$gal]['porc_mort'][$cen] = $mort;
            $t1DataByGalpon[$gal]['pgd'][$cen] = $pgd;
        }

        uksort($galponesSet, function($a, $b) {
            return (int)$a <=> (int)$b;
        });
        $galponesList = array_keys($galponesSet);
        $granjasListT1 = array_values($granjasMapT1);

        $tabla1Filas = [];
        $metricasDef = [
            ['key' => 'unidades_ven', 'label' => 'UnidadesVendidas', 'decimals' => 0],
            ['key' => 'kilos_vendidos', 'label' => 'KilosVendidos', 'decimals' => 2],
            ['key' => 'peso_promedio', 'label' => 'PesoPromedio', 'decimals' => 3],
            ['key' => 'ica', 'label' => 'ICA', 'decimals' => 3],
            ['key' => 'prom_edad_ven', 'label' => 'PromEdadVenta', 'decimals' => 3],
            ['key' => 'porc_mort', 'label' => '%Mortalidad', 'decimals' => 3, 'is_percent' => true],
            ['key' => 'pgd', 'label' => 'PGD', 'decimals' => 3]
        ];

        foreach ($galponesList as $gal) {
            $galMetrics = [];
            foreach ($metricasDef as $m) {
                $valoresCencos = [];
                foreach ($granjasListT1 as $gInfo) {
                    $cen = $gInfo['cencos'];
                    $valoresCencos[$cen] = isset($t1DataByGalpon[$gal][$m['key']][$cen])
                        ? $t1DataByGalpon[$gal][$m['key']][$cen]
                        : null;
                }
                $galMetrics[] = [
                    'key' => $m['key'],
                    'label' => $m['label'],
                    'decimals' => $m['decimals'],
                    'is_percent' => $m['is_percent'] ?? false,
                    'valores' => $valoresCencos
                ];
            }
            $tabla1Filas[$gal] = [
                'galpon' => $gal,
                'metricas' => $galMetrics
            ];
        }

        // =========================================================================
        // 3. TABLA 2: DETALLE VENTA PRODUCTIVA
        // =========================================================================
        // Solo consultar las granjas que están en Tabla 1 (o seleccionadas) y tipos válidos (100, 103, 107)
        $cencosT1List = array_keys($granjasMapT1);
        if (!empty($cencosT1List)) {
            $cencosInT1 = "'" . implode("','", array_map('addslashes', $cencosT1List)) . "'";
            $whereDet .= " AND cencos IN ({$cencosInT1})";
        }
        $whereDet .= " AND tipo IN ('100', '103', '107') AND TRIM(descritipo) != ''";

        $sqlT2 = "
            SELECT 
                cencos,
                nomcencos,
                galpon,
                tipo,
                descritipo,
                CONCAT(tipo, ' ', descritipo) as descriventa,
                SUM(cantidad) as cantidad,
                SUM(peso) as peso
            FROM histodatosprodcompadet
            {$whereDet}
            GROUP BY cencos, nomcencos, galpon, tipo, descritipo
            ORDER BY CAST(galpon AS UNSIGNED), CAST(tipo AS UNSIGNED), cencos
        ";

        $stmtT2 = $db->prepare($sqlT2);
        $stmtT2->execute($paramsDet);
        $rawT2 = $stmtT2->fetchAll(PDO::FETCH_ASSOC);

        $t2ByGalponTipo = [];
        $t2TotalesGalpon = []; // Suma total de cantidad por cencos y galpon en T2

        foreach ($rawT2 as $r) {
            $cen = (string)$r['cencos'];
            $gal = (string)$r['galpon'];
            $cant = (float)$r['cantidad'];
            if (!isset($t2TotalesGalpon[$cen][$gal])) {
                $t2TotalesGalpon[$cen][$gal] = 0;
            }
            $t2TotalesGalpon[$cen][$gal] += $cant;
        }

        foreach ($rawT2 as $r) {
            $cen = (string)$r['cencos'];
            $gal = (string)$r['galpon'];
            $tipo = (string)$r['tipo'];
            $descritipo = (string)$r['descritipo'];
            $descriventa = trim($r['descriventa']);
            $cant = (float)$r['cantidad'];
            $peso = (float)$r['peso'];

            if (!isset($t2ByGalponTipo[$gal][$descriventa])) {
                $t2ByGalponTipo[$gal][$descriventa] = [
                    'tipo' => $tipo,
                    'descritipo' => $descritipo,
                    'descriventa' => $descriventa,
                    'granjas' => []
                ];
            }

            // Total de unidades para porcentaje: priorizar unidades de T1, fallback a suma de T2
            $totalUnd = $unidadesVendidasMap[$cen][$gal] ?? ($t2TotalesGalpon[$cen][$gal] ?? 0);
            $porc = ($totalUnd > 0) ? ($cant / $totalUnd) * 100 : 0;

            $t2ByGalponTipo[$gal][$descriventa]['granjas'][$cen] = [
                'cantidad' => $cant,
                'peso' => $peso,
                'porcentaje' => round($porc, 2)
            ];
        }

        $tabla2Filas = [];
        foreach ($galponesList as $gal) {
            $tiposForGal = $t2ByGalponTipo[$gal] ?? [];
            $filasTipos = [];
            foreach ($tiposForGal as $descriventa => $tInfo) {
                $valoresGranjas = [];
                foreach ($granjasListT1 as $gInfo) {
                    $cen = $gInfo['cencos'];
                    $gData = $tInfo['granjas'][$cen] ?? null;
                    $valoresGranjas[$cen] = $gData;
                }
                $filasTipos[] = [
                    'tipo' => $tInfo['tipo'],
                    'descritipo' => $tInfo['descritipo'],
                    'descriventa' => $descriventa,
                    'valores' => $valoresGranjas
                ];
            }
            $tabla2Filas[$gal] = [
                'galpon' => $gal,
                'tipos' => $filasTipos
            ];
        }

        // =========================================================================
        // 4. TABLA 3: DATOS DE COSTO (CU y Dif en CU con semaforización)
        // =========================================================================
        $sqlT3 = "
            SELECT 
                cencos,
                nomcencos,
                galpon,
                linea,
                nomlinea,
                SUM(valor) as valor,
                SUM(comodin) as comodin,
                CASE WHEN SUM(comodin) > 0 THEN SUM(valor) / SUM(comodin) ELSE 0 END as cu
            FROM histodatosalmalineacompa
            {$whereLine}
            GROUP BY cencos, nomcencos, galpon, linea, nomlinea
            ORDER BY CAST(galpon AS UNSIGNED), linea, cencos
        ";

        $stmtT3 = $db->prepare($sqlT3);
        $stmtT3->execute($paramsLine);
        $rawT3 = $stmtT3->fetchAll(PDO::FETCH_ASSOC);

        $granjasMapT3 = [];
        $t3ByGalponLinea = [];

        foreach ($rawT3 as $r) {
            $cen = (string)$r['cencos'];
            $nom = (string)$r['nomcencos'];
            $gal = (string)$r['galpon'];
            $lin = (string)$r['linea'];
            $nomlin = (string)$r['nomlinea'];
            $clasifStr = trim($lin . ' ' . $nomlin);
            $cu = (float)$r['cu'];
            $val = (float)$r['valor'];
            $com = (float)$r['comodin'];

            if (!isset($granjasMapT3[$cen])) {
                $granjasMapT3[$cen] = [
                    'cencos' => $cen,
                    'nomcencos' => $nom,
                    'label' => trim($cen . ' ' . $nom)
                ];
            }

            if (!isset($t3ByGalponLinea[$gal][$lin])) {
                $t3ByGalponLinea[$gal][$lin] = [
                    'linea' => $lin,
                    'nomlinea' => $nomlin,
                    'clasificacion' => $clasifStr,
                    'granjas' => []
                ];
            }

            $t3ByGalponLinea[$gal][$lin]['granjas'][$cen] = [
                'cu' => $cu,
                'valor' => $val,
                'comodin' => $com
            ];
        }

        // Si hay granjas de T1 y T3, consolidar la lista ordenada de granjas para T3
        $granjasListT3 = !empty($granjasMapT3) ? array_values($granjasMapT3) : $granjasListT1;

        $tabla3Filas = [];
        $galponesT3 = array_unique(array_merge($galponesList, array_keys($t3ByGalponLinea)));
        usort($galponesT3, function($a, $b) {
            return (int)$a <=> (int)$b;
        });

        foreach ($galponesT3 as $gal) {
            $lineasForGal = $t3ByGalponLinea[$gal] ?? [];
            $filasLineas = [];

            foreach ($lineasForGal as $lin => $lInfo) {
                $valoresGranjas = [];
                $prevValidCu = null;

                foreach ($granjasListT3 as $idx => $gInfo) {
                    $cen = $gInfo['cencos'];
                    $gData = $lInfo['granjas'][$cen] ?? null;

                    if ($gData !== null) {
                        $currentCu = (float)$gData['cu'];
                        $difCu = null;

                        if ($idx > 0 && $prevValidCu !== null) {
                            $difCu = round($currentCu - $prevValidCu, 3);
                        }

                        $valoresGranjas[$cen] = [
                            'cu' => $currentCu,
                            'dif_cu' => $difCu,
                            'valor' => (float)$gData['valor'],
                            'comodin' => (float)$gData['comodin']
                        ];

                        $prevValidCu = $currentCu;
                    } else {
                        $valoresGranjas[$cen] = [
                            'cu' => 0.0,
                            'dif_cu' => null,
                            'valor' => 0.0,
                            'comodin' => 0.0,
                            'sin_datos' => true
                        ];
                    }
                }

                $filasLineas[] = [
                    'linea' => $lInfo['linea'],
                    'nomlinea' => $lInfo['nomlinea'],
                    'clasificacion' => $lInfo['clasificacion'],
                    'valores' => $valoresGranjas
                ];
            }

            $tabla3Filas[$gal] = [
                'galpon' => $gal,
                'lineas' => $filasLineas
            ];
        }

        return [
            'status' => 'success',
            'granjas_headers' => $granjasListT1,
            'granjas_headers_t3' => $granjasListT3,
            'galpones_headers' => $galponesList,
            'tabla1_datos_productivos' => [
                'galpones' => $galponesList,
                'granjas' => $granjasListT1,
                'filas_por_galpon' => $tabla1Filas
            ],
            'tabla2_detalle_venta' => [
                'galpones' => $galponesList,
                'granjas' => $granjasListT1,
                'filas_por_galpon' => $tabla2Filas
            ],
            'tabla3_datos_costo' => [
                'galpones' => $galponesT3,
                'granjas' => $granjasListT3,
                'filas_por_galpon' => $tabla3Filas
            ],
            'opciones_filtros' => $opcionesFiltros
        ];
    }

    private static function obtenerOpcionesFiltros(PDO $db): array
    {
        // Granjas
        $stmtGranjas = $db->query("
            SELECT DISTINCT cencos, nomcencos 
            FROM histodatosprodcompa 
            WHERE cencos IS NOT NULL AND cencos != '' 
            ORDER BY cencos
        ");
        $granjas = [];
        while ($r = $stmtGranjas->fetch(PDO::FETCH_ASSOC)) {
            $granjas[] = [
                'cencos' => $r['cencos'],
                'nomcencos' => $r['nomcencos'],
                'label' => trim($r['cencos'] . ' ' . $r['nomcencos'])
            ];
        }

        // Galpones
        $stmtGalp = $db->query("
            SELECT DISTINCT galpon 
            FROM histodatosprodcompa 
            WHERE galpon IS NOT NULL AND galpon != '' 
            ORDER BY CAST(galpon AS UNSIGNED)
        ");
        $galpones = $stmtGalp->fetchAll(PDO::FETCH_COLUMN);

        // Clasificaciones
        $stmtClas = $db->query("
            SELECT DISTINCT linea, nomlinea 
            FROM histodatosalmalineacompa 
            WHERE linea IS NOT NULL AND linea != '' 
            ORDER BY linea
        ");
        $clasificaciones = [];
        while ($r = $stmtClas->fetch(PDO::FETCH_ASSOC)) {
            $clasificaciones[] = [
                'linea' => $r['linea'],
                'nomlinea' => $r['nomlinea'],
                'label' => trim($r['linea'] . ' ' . $r['nomlinea'])
            ];
        }

        return [
            'granjas' => $granjas,
            'galpones' => $galpones,
            'clasificaciones' => $clasificaciones
        ];
    }
}
