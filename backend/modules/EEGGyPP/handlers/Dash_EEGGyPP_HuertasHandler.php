<?php

class Dash_EEGGyPP_HuertasHandler
{
    /**
     * Normaliza parámetros y retorna:
     * - array con valores limpios si hay filtros específicos
     * - null si no hay filtro (aplica a todos / TODOS / (Todo))
     * - [] (array vacío) si explícitamente se seleccionó nada o lista vacía (debe filtrar 1=0)
     */
    private static function parseFilter($val): ?array
    {
        if ($val === null) return null;
        if (is_array($val)) {
            if (empty($val)) {
                return []; // Explícitamente vacío -> 0 registros
            }
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
            if ($hasAll && empty($clean)) {
                return null; // Seleccionó '(Todo)' -> sin filtro
            }
            if (empty($clean)) {
                return []; // Seleccionó elementos vacíos -> 1=0
            }
            return array_values(array_unique($clean));
        }

        $val = trim((string)$val);
        if ($val === '' || strtoupper($val) === 'TODOS' || strtoupper($val) === 'ALL' || strtoupper($val) === '(TODO)') {
            return null; // Sin filtro
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

    /**
     * Procesa la consulta para el Dashboard Dash_EEGGyPP_Huertas (Provincia / Zona / Producto / Tipo / Código - Solo 3 Métricas de Costo)
     *
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        $whereClauses = [];
        $params = [];

        // 1. Filtro por Proceso (tctafun)
        $procesos = self::parseFilter($filtros['proceso'] ?? $filtros['select_proceso'] ?? null);
        if ($procesos === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($procesos !== null) {
            $procCodes = [];
            foreach ($procesos as $p) {
                if ($p === 'BENEFICIADO' || $p === '7023102') $procCodes[] = '7023102';
                elseif ($p === 'TROZADO' || $p === '7023105') $procCodes[] = '7023105';
                elseif ($p === 'MARINADO' || $p === '7023104') $procCodes[] = '7023104';
                else $procCodes[] = $p;
            }
            $placeholders = implode(',', array_fill(0, count($procCodes), '?'));
            $whereClauses[] = "(t.tctafun IN ($placeholders) OR t.desproc IN ($placeholders))";
            foreach ($procCodes as $c) $params[] = $c;
            foreach ($procCodes as $c) $params[] = $c;
        }

        // 2. Filtro por Provincia
        $provincias = self::parseFilter($filtros['provincia'] ?? $filtros['filtro_provincia'] ?? null);
        if ($provincias === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($provincias !== null) {
            $placeholders = implode(',', array_fill(0, count($provincias), '?'));
            $whereClauses[] = "TRIM(t.provin) IN ($placeholders)";
            foreach ($provincias as $pv) {
                $params[] = $pv;
            }
        }

        // 3. Filtro por Zona / Departamento
        $zonas = self::parseFilter($filtros['zona'] ?? $filtros['filtro_zona'] ?? null);
        if ($zonas === []) {
            $whereClauses[] = "1 = 0";
        } elseif ($zonas !== null) {
            $placeholders = implode(',', array_fill(0, count($zonas), '?'));
            $whereClauses[] = "(TRIM(t.depart) IN ($placeholders) OR TRIM(t.tzona) IN ($placeholders) OR TRIM(t.tnomzona) IN ($placeholders))";
            foreach ($zonas as $z) $params[] = $z;
            foreach ($zonas as $z) $params[] = $z;
            foreach ($zonas as $z) $params[] = $z;
        }

        // 4. Filtro por Fechas
        $fechaInicio = $filtros['fecha_inicio'] ?? $filtros['fecha1'] ?? '';
        $fechaFin    = $filtros['fecha_fin'] ?? $filtros['fecha2'] ?? '';
        if (!empty($fechaInicio) && !empty($fechaFin)) {
            $whereClauses[] = "t.tfectra2 BETWEEN ? AND ?";
            $params[] = $fechaInicio;
            $params[] = $fechaFin;
        }

        $whereSql = '';
        if (!empty($whereClauses)) {
            $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
        }

        $sql = "
            SELECT 
                TRIM(t.provin) AS provincia,
                TRIM(t.depart) AS zona,
                CASE t.tesp15 
                    WHEN 1 THEN 'Primera' 
                    WHEN 2 THEN 'Segunda' 
                    WHEN 3 THEN 'Tercera' 
                    ELSE 'Otros' 
                END AS producto,
                t.tesp15 AS orden_producto,
                CASE 
                    WHEN LEFT(m.descri, 4) = 'POLL' THEN '1 Pollo' 
                    ELSE '2 Menudencia' 
                END AS tipo,
                t.tcodigo AS codigo,
                m.descri AS descripcion,
                SUM(t.tcan01) AS peso_venta,
                SUM(t.tcan02) AS peso_costo,
                SUM(t.tesp02 + t.tesp03) AS costo_ventas_importe
            FROM tmppedido_tableau t
            INNER JOIN mitm m ON t.tcodigo = m.codigo
            {$whereSql}
            GROUP BY provincia, zona, producto, orden_producto, tipo, codigo, descripcion
            ORDER BY provincia ASC, zona ASC, orden_producto ASC, tipo ASC, codigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Diccionarios de ordenamiento manual de Tableau (EE_GGyPP (3))
        $zonaOrderDict = [
            'PALOMAR-HORIZONTAL'  => 1,
            'PALOMAR-TIENDA'      => 2,
            'PACHACUTEC-MERCADOS' => 3,
            'PACHACUTEC-PATEROS'  => 4,
            'NO TIENE ZONA'       => 5
        ];

        $codigoOrderDict = [
            // 1 Pollo
            'P112'    => 1,  'P112M'   => 2,  'P113'    => 3,  'P114'    => 4,
            'P115'    => 5,  'P116'    => 6,  'P120'    => 7,
            // 2 Menudencia
            'P118M'   => 8,  'P0002'   => 9,  'P0017'   => 10, 'P0017V'  => 11,
            'P0035'   => 12, 'P0040'   => 13, 'P0068'   => 14, 'P0086'   => 15,
            'P0090'   => 16, 'P0105'   => 17, 'P0110'   => 18, 'P0134'   => 19,
            'P0136'   => 20, 'P0136L'  => 21, 'P0141'   => 22, 'P0297'   => 23,
            'P00112'  => 24, 'PM0113'  => 25,
            // Segunda
            '122'     => 26, '122B'    => 27, 'P0110B'  => 28, 'P112BB'  => 29,
            'P120BB'  => 30, 'P113BB'  => 31, '123B'    => 32, 'P115BB'  => 33,
            'P116BB'  => 34, 'P113B'   => 35
        ];

        // 1. Agrupar datos en árbol: Provincia -> Zona -> Producto -> Tipo -> Items
        $arbol = [];
        $totalGenPeso = 0.0;
        $totalGenPesoCosto = 0.0;
        $totalGenCosto = 0.0;

        foreach ($rawRows as $row) {
            $prov = $row['provincia'] ?: 'SIN PROVINCIA';
            $zona = $row['zona'] ?: 'NO TIENE ZONA';
            $prod = $row['producto'];
            $tipo = $row['tipo'];

            $pesoVenta = (float)$row['peso_venta'];
            $pesoCosto = (float)$row['peso_costo'];
            $costoImp  = (float)$row['costo_ventas_importe'];

            $totalGenPeso      += $pesoVenta;
            $totalGenPesoCosto += $pesoCosto;
            $totalGenCosto     += $costoImp;

            if (!isset($arbol[$prov])) {
                $arbol[$prov] = [];
            }
            if (!isset($arbol[$prov][$zona])) {
                $arbol[$prov][$zona] = [];
            }
            if (!isset($arbol[$prov][$zona][$prod])) {
                $arbol[$prov][$zona][$prod] = [
                    'orden' => (int)$row['orden_producto'],
                    'tipos' => []
                ];
            }
            if (!isset($arbol[$prov][$zona][$prod]['tipos'][$tipo])) {
                $arbol[$prov][$zona][$prod]['tipos'][$tipo] = [];
            }

            $arbol[$prov][$zona][$prod]['tipos'][$tipo][] = $row;
        }

        // 2. Construir estructura de respuesta
        $provinciasFinal = [];

        foreach ($arbol as $provNombre => $zonasObj) {
            $zonasList = [];

            // Ordenar Zonas según orden manual de Tableau
            uksort($zonasObj, function($a, $b) use ($zonaOrderDict) {
                $orderA = $zonaOrderDict[$a] ?? 999;
                $orderB = $zonaOrderDict[$b] ?? 999;
                if ($orderA !== $orderB) return $orderA - $orderB;
                return strcmp($a, $b);
            });

            foreach ($zonasObj as $zonaNombre => $productosObj) {
                // Ordenar productos por tesp15 asc
                uasort($productosObj, function($a, $b) {
                    return $a['orden'] - $b['orden'];
                });

                $gruposProductos = [];

                foreach ($productosObj as $prodNombre => $prodData) {
                    $tiposObj = $prodData['tipos'];
                    ksort($tiposObj);

                    $tiposFinal = [];

                    foreach ($tiposObj as $tipoNombre => $itemsRows) {
                        // Ordenar ítems por código según el orden de Tableau
                        usort($itemsRows, function($a, $b) use ($codigoOrderDict) {
                            $cA = $a['codigo'] ?? '';
                            $cB = $b['codigo'] ?? '';
                            $orderA = $codigoOrderDict[$cA] ?? 999;
                            $orderB = $codigoOrderDict[$cB] ?? 999;
                            if ($orderA !== $orderB) return $orderA - $orderB;
                            return strcmp($cA, $cB);
                        });

                        $subPeso = 0.0;
                        $subPesoCosto = 0.0;
                        $subCosto = 0.0;

                        $itemsFormateados = [];

                        foreach ($itemsRows as $it) {
                            $pVen = (float)$it['peso_venta'];
                            $pCos = (float)$it['peso_costo'];
                            $cImp = (float)$it['costo_ventas_importe'];

                            $subPeso      += $pVen;
                            $subPesoCosto += $pCos;
                            $subCosto     += $cImp;

                            $prCos = ($pCos != 0.0) ? ($cImp / $pCos) : (($pVen != 0.0) ? ($cImp / $pVen) : 0.0);

                            $itemsFormateados[] = [
                                'codigo'               => $it['codigo'],
                                'descripcion'          => $it['descripcion'],
                                'peso_venta'           => round($pVen, 2),
                                'costo_ventas_importe' => round($cImp, 2),
                                'costo_ventas_precio'  => round($prCos, 3)
                            ];
                        }

                        $subPrCos = ($subPesoCosto != 0.0) ? ($subCosto / $subPesoCosto) : (($subPeso != 0.0) ? ($subCosto / $subPeso) : 0.0);

                        $tiposFinal[] = [
                            'tipo'     => $tipoNombre,
                            'items'    => $itemsFormateados,
                            'subtotal' => [
                                'peso_venta'           => round($subPeso, 2),
                                'costo_ventas_importe' => round($subCosto, 2),
                                'costo_ventas_precio'  => round($subPrCos, 3)
                            ]
                        ];
                    }

                    $gruposProductos[] = [
                        'producto' => $prodNombre,
                        'tipos'    => $tiposFinal
                    ];
                }

                $zonasList[] = [
                    'zona'   => $zonaNombre,
                    'grupos' => $gruposProductos
                ];
            }

            $provinciasFinal[] = [
                'provincia' => $provNombre,
                'zonas'     => $zonasList
            ];
        }

        // Totales generales globales
        $totalCostoPrecio = ($totalGenPesoCosto != 0.0) ? ($totalGenCosto / $totalGenPesoCosto) : (($totalGenPeso != 0.0) ? ($totalGenCosto / $totalGenPeso) : 0.0);

        $totalGeneral = [
            'peso_venta'           => round($totalGenPeso, 2),
            'costo_ventas_importe' => round($totalGenCosto, 2),
            'costo_ventas_precio'  => round($totalCostoPrecio, 3)
        ];

        $procLabel = !empty($procesos) ? implode(' y ', $procesos) : 'TODO';

        return [
            'success'         => true,
            'status'          => 'success',
            'tipo_grafico'    => 'Dash_EEGGyPP_Huertas',
            'titulo'          => 'COSTO DE VENTA DEL POLLO ' . $procLabel,
            'proceso_label'   => !empty($procesos) ? implode(', ', $procesos) : '(Todo)',
            'provincia_label' => !empty($provincias) ? implode(', ', $provincias) : '(Todo)',
            'zona_label'      => !empty($zonas) ? implode(', ', $zonas) : '(Todo)',
            'total_general'   => $totalGeneral,
            'provincias'      => $provinciasFinal,
            'total_registros' => count($rawRows)
        ];
    }
}
