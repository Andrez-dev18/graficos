<?php

class Dash_EEGGyPPHandler
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
     * Procesa la consulta para el Dashboard Dash_EEGGyPP (Producto / Tipo / Código)
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
                SUM(t.tesp01) AS importe_venta,
                SUM(t.tcan02) AS peso_costo,
                SUM(t.tesp02 + t.tesp03) AS costo_ventas_importe,
                SUM(t.tesp08 + t.tesp10) AS comercial,
                SUM(t.tesp09) AS administrativo,
                SUM(t.tesp01 - (t.tesp02 + t.tesp03) + t.tesp08 + t.tesp09 + t.tesp10 + t.tesp11) AS utilidad_operativa
            FROM tmppedido_tableau t
            INNER JOIN mitm m ON t.tcodigo = m.codigo
            {$whereSql}
            GROUP BY producto, orden_producto, tipo, codigo, descripcion
            ORDER BY orden_producto ASC, tipo ASC, codigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Diccionario de ordenamiento manual de códigos
        $codigoOrderDict = [
            'P120'    => 1,  'P116'    => 2,  'PM0113'  => 3,  'P0086'   => 4,  'P0068'   => 5,
            'P113'    => 6,  'P0017'   => 7,  'P0035'   => 8,  'P112'    => 9,  'P0017V'  => 10,
            'P112B'   => 11, 'P114'    => 12, 'P112M'   => 13, 'P115M'   => 14, 'P115B'   => 15,
            'P00112'  => 16, 'P112BB'  => 17, 'P115'    => 18, '011M'    => 19, 'P120BB'  => 20,
            'DM118'   => 21, 'P113B'   => 22, '122'     => 23, '122B'    => 24, '011'     => 25,
            'P113BB'  => 26, '123B'    => 27
        ];

        // Calcular total general de todas las filas devueltas
        $totalGenPeso = 0.0;
        $totalGenImp = 0.0;
        $totalGenCosto = 0.0;
        $totalGenPesoCosto = 0.0;
        $totalGenCom = 0.0;
        $totalGenAdm = 0.0;
        $totalGenUtil = 0.0;

        foreach ($rawRows as $row) {
            $totalGenPeso      += (float)$row['peso_venta'];
            $totalGenImp       += (float)$row['importe_venta'];
            $totalGenPesoCosto += (float)$row['peso_costo'];
            $totalGenCosto     += (float)$row['costo_ventas_importe'];
            $totalGenCom       += (float)$row['comercial'];
            $totalGenAdm       += (float)$row['administrativo'];
            $totalGenUtil      += (float)$row['utilidad_operativa'];
        }

        // Estructurar árbol: Producto -> Tipo -> Items
        $arbolProductos = [];

        foreach ($rawRows as $r) {
            $prod = $r['producto'];
            $tipo = $r['tipo'];

            if (!isset($arbolProductos[$prod])) {
                $arbolProductos[$prod] = [
                    'orden' => (int)$r['orden_producto'],
                    'tipos' => []
                ];
            }
            if (!isset($arbolProductos[$prod]['tipos'][$tipo])) {
                $arbolProductos[$prod]['tipos'][$tipo] = [
                    'items' => []
                ];
            }
            $arbolProductos[$prod]['tipos'][$tipo]['items'][] = $r;
        }

        // Ordenar productos por orden_producto asc
        uasort($arbolProductos, function($a, $b) {
            return $a['orden'] - $b['orden'];
        });

        $gruposProductos = [];

        foreach ($arbolProductos as $prodNombre => $prodData) {
            $tiposObj = $prodData['tipos'];
            ksort($tiposObj);

            $tiposFinal = [];

            foreach ($tiposObj as $tipoNombre => $tipoData) {
                $itemsRows = $tipoData['items'];

                // Ordenar ítems por código
                usort($itemsRows, function($a, $b) use ($codigoOrderDict) {
                    $cA = $a['codigo'] ?? '';
                    $cB = $b['codigo'] ?? '';
                    $orderA = $codigoOrderDict[$cA] ?? 999;
                    $orderB = $codigoOrderDict[$cB] ?? 999;
                    if ($orderA !== $orderB) return $orderA - $orderB;
                    return strcmp($cA, $cB);
                });

                $subPeso = 0.0;
                $subImp = 0.0;
                $subPesoCosto = 0.0;
                $subCosto = 0.0;
                $subCom = 0.0;
                $subAdm = 0.0;
                $subUtil = 0.0;

                $itemsFormateados = [];

                foreach ($itemsRows as $it) {
                    $pVen = (float)$it['peso_venta'];
                    $iVen = (float)$it['importe_venta'];
                    $pCos = (float)$it['peso_costo'];
                    $cImp = (float)$it['costo_ventas_importe'];
                    $com  = (float)$it['comercial'];
                    $adm  = (float)$it['administrativo'];
                    $util = (float)$it['utilidad_operativa'];

                    $subPeso      += $pVen;
                    $subImp       += $iVen;
                    $subPesoCosto += $pCos;
                    $subCosto     += $cImp;
                    $subCom       += $com;
                    $subAdm       += $adm;
                    $subUtil      += $util;

                    $prVen = ($pVen != 0.0) ? ($iVen / $pVen) : 0.0;
                    $prCos = ($pCos != 0.0) ? ($cImp / $pCos) : (($pVen != 0.0) ? ($cImp / $pVen) : 0.0);

                    $pctPeso = ($totalGenPeso != 0.0) ? (($pVen / $totalGenPeso) * 100.0) : 0.0;
                    $pctUtil = ($totalGenUtil != 0.0) ? (($util / $totalGenUtil) * 100.0) : 0.0;

                    $itemsFormateados[] = [
                        'codigo'               => $it['codigo'],
                        'descripcion'          => $it['descripcion'],
                        'peso_venta'           => round($pVen, 2),
                        'importe_venta'        => round($iVen, 2),
                        'precio_venta'         => round($prVen, 3),
                        'costo_ventas_importe' => round($cImp, 2),
                        'costo_ventas_precio'  => round($prCos, 3),
                        'comercial'            => round($com, 2),
                        'administrativo'       => round($adm, 2),
                        'utilidad_operativa'   => round($util, 2),
                        'pct_utilidad'         => round($pctUtil, 2),
                        'pct_peso'             => round($pctPeso, 2)
                    ];
                }

                $subPrVen = ($subPeso != 0.0) ? ($subImp / $subPeso) : 0.0;
                $subPrCos = ($subPesoCosto != 0.0) ? ($subCosto / $subPesoCosto) : 0.0;

                $subPctPeso = ($totalGenPeso != 0.0) ? (($subPeso / $totalGenPeso) * 100.0) : 0.0;
                $subPctUtil = ($totalGenUtil != 0.0) ? (($subUtil / $totalGenUtil) * 100.0) : 0.0;

                $tiposFinal[] = [
                    'tipo'     => $tipoNombre,
                    'items'    => $itemsFormateados,
                    'subtotal' => [
                        'peso_venta'           => round($subPeso, 2),
                        'importe_venta'        => round($subImp, 2),
                        'precio_venta'         => round($subPrVen, 3),
                        'costo_ventas_importe' => round($subCosto, 2),
                        'costo_ventas_precio'  => round($subPrCos, 3),
                        'comercial'            => round($subCom, 2),
                        'administrativo'       => round($subAdm, 2),
                        'utilidad_operativa'   => round($subUtil, 2),
                        'pct_utilidad'         => round($subPctUtil, 2),
                        'pct_peso'             => round($subPctPeso, 2)
                    ]
                ];
            }

            $gruposProductos[] = [
                'producto' => $prodNombre,
                'tipos'    => $tiposFinal
            ];
        }

        // Totales generales calculados
        $totalPrecioVenta = ($totalGenPeso != 0.0) ? ($totalGenImp / $totalGenPeso) : 0.0;
        $totalCostoPrecio = ($totalGenPesoCosto != 0.0) ? ($totalGenCosto / $totalGenPesoCosto) : (($totalGenPeso != 0.0) ? ($totalGenCosto / $totalGenPeso) : 0.0);

        $totalGeneral = [
            'peso_venta'           => round($totalGenPeso, 2),
            'importe_venta'        => round($totalGenImp, 2),
            'precio_venta'         => round($totalPrecioVenta, 3),
            'costo_ventas_importe' => round($totalGenCosto, 2),
            'costo_ventas_precio'  => round($totalCostoPrecio, 3),
            'comercial'            => round($totalGenCom, 2),
            'administrativo'       => round($totalGenAdm, 2),
            'utilidad_operativa'   => round($totalGenUtil, 2),
            'pct_utilidad'         => null,
            'pct_peso'             => ($totalGenPeso != 0.0) ? 100.0 : 0.0
        ];

        $procLabel = !empty($procesos) ? implode(', ', $procesos) : 'TODO';

        return [
            'success'         => true,
            'status'          => 'success',
            'tipo_grafico'    => 'Dash_EEGGyPP',
            'titulo'          => 'COSTO DE VENTA DEL POLLO ' . $procLabel,
            'proceso_label'   => !empty($procesos) ? implode(', ', $procesos) : '(Todo)',
            'provincia_label' => !empty($provincias) ? implode(', ', $provincias) : '(Todo)',
            'zona_label'      => !empty($zonas) ? implode(', ', $zonas) : '(Todo)',
            'total_general'   => $totalGeneral,
            'grupos'          => $gruposProductos,
            'total_registros' => count($rawRows)
        ];
    }
}
