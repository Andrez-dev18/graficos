<?php

class Dash_EEGGyPP_Res_ASOHandler
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
     * Procesa la consulta para el Dashboard Dash_EEGGyPP_Res_ASO (Resumen por Provincia / Zona / Producto / Tipo)
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
            GROUP BY provincia, zona, producto, orden_producto, tipo
            ORDER BY provincia ASC, zona ASC, orden_producto ASC, tipo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Diccionario de ordenamiento manual de Zonas extraído de Tableau
        $zonaOrderDict = [
            'PACHACUTEC-MERCADOS' => 1,
            'PALOMAR-TIENDA'      => 2,
            'PALOMAR-HORIZONTAL'  => 3,
            'PACHACUTEC-PATEROS'  => 4,
            'NO TIENE ZONA'       => 5
        ];

        // 1. Agrupar datos en árbol: Provincia -> Zona -> Producto -> Tipo y calcular totales por Zona y Global
        $arbol = [];
        $totalesPorZona = [];

        $totalGenPeso = 0.0;
        $totalGenImp = 0.0;
        $totalGenPesoCosto = 0.0;
        $totalGenCosto = 0.0;
        $totalGenCom = 0.0;
        $totalGenAdm = 0.0;
        $totalGenUtil = 0.0;

        foreach ($rawRows as $row) {
            $prov = $row['provincia'] ?: 'SIN PROVINCIA';
            $zona = $row['zona'] ?: 'NO TIENE ZONA';
            $prod = $row['producto'];
            $tipo = $row['tipo'];

            $zonaKey = $prov . '___' . $zona;

            if (!isset($totalesPorZona[$zonaKey])) {
                $totalesPorZona[$zonaKey] = [
                    'peso_venta'           => 0.0,
                    'importe_venta'        => 0.0,
                    'peso_costo'           => 0.0,
                    'costo_ventas_importe' => 0.0,
                    'comercial'            => 0.0,
                    'administrativo'       => 0.0,
                    'utilidad_operativa'   => 0.0
                ];
            }

            $pesoVenta    = (float)$row['peso_venta'];
            $importeVenta = (float)$row['importe_venta'];
            $pesoCosto    = (float)$row['peso_costo'];
            $costoImp     = (float)$row['costo_ventas_importe'];
            $comercial    = (float)$row['comercial'];
            $admin        = (float)$row['administrativo'];
            $utilidad     = (float)$row['utilidad_operativa'];

            $totalGenPeso      += $pesoVenta;
            $totalGenImp       += $importeVenta;
            $totalGenPesoCosto += $pesoCosto;
            $totalGenCosto     += $costoImp;
            $totalGenCom       += $comercial;
            $totalGenAdm       += $admin;
            $totalGenUtil      += $utilidad;

            $totalesPorZona[$zonaKey]['peso_venta']           += $pesoVenta;
            $totalesPorZona[$zonaKey]['importe_venta']        += $importeVenta;
            $totalesPorZona[$zonaKey]['peso_costo']           += $pesoCosto;
            $totalesPorZona[$zonaKey]['costo_ventas_importe'] += $costoImp;
            $totalesPorZona[$zonaKey]['comercial']            += $comercial;
            $totalesPorZona[$zonaKey]['administrativo']       += $admin;
            $totalesPorZona[$zonaKey]['utilidad_operativa']   += $utilidad;

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
            $arbol[$prov][$zona][$prod]['tipos'][$tipo] = $row;
        }

        // 2. Construir estructura de respuesta con porcentajes relativos al Total de cada Zona
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
                $zonaKey = $provNombre . '___' . $zonaNombre;
                $zonaTot = $totalesPorZona[$zonaKey] ?? [
                    'peso_venta' => 0.0, 'importe_venta' => 0.0, 'peso_costo' => 0.0,
                    'costo_ventas_importe' => 0.0, 'comercial' => 0.0, 'administrativo' => 0.0, 'utilidad_operativa' => 0.0
                ];

                $zonaPesoTot = $zonaTot['peso_venta'];
                $zonaUtilTot = $zonaTot['utilidad_operativa'];

                // Ordenar productos por tesp15 asc
                uasort($productosObj, function($a, $b) {
                    return $a['orden'] - $b['orden'];
                });

                $gruposProductos = [];

                foreach ($productosObj as $prodNombre => $prodData) {
                    $tiposObj = $prodData['tipos'];
                    ksort($tiposObj);

                    $tiposFinal = [];

                    foreach ($tiposObj as $tipoNombre => $it) {
                        $pVen = (float)$it['peso_venta'];
                        $iVen = (float)$it['importe_venta'];
                        $pCos = (float)$it['peso_costo'];
                        $cImp = (float)$it['costo_ventas_importe'];
                        $com  = (float)$it['comercial'];
                        $adm  = (float)$it['administrativo'];
                        $util = (float)$it['utilidad_operativa'];

                        $prVen = ($pVen != 0.0) ? ($iVen / $pVen) : 0.0;
                        $prCos = ($pCos != 0.0) ? ($cImp / $pCos) : (($pVen != 0.0) ? ($cImp / $pVen) : 0.0);

                        $pctPeso = ($zonaPesoTot != 0.0) ? (($pVen / $zonaPesoTot) * 100.0) : 0.0;
                        $pctUtil = ($zonaUtilTot != 0.0) ? (($util / $zonaUtilTot) * 100.0) : 0.0;

                        $tiposFinal[] = [
                            'tipo'                 => $tipoNombre,
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

                    $gruposProductos[] = [
                        'producto' => $prodNombre,
                        'tipos'    => $tiposFinal
                    ];
                }

                $totalZonaPrVen = ($zonaTot['peso_venta'] != 0.0) ? ($zonaTot['importe_venta'] / $zonaTot['peso_venta']) : 0.0;
                $totalZonaPrCos = ($zonaTot['peso_costo'] != 0.0) ? ($zonaTot['costo_ventas_importe'] / $zonaTot['peso_costo']) : (($zonaTot['peso_venta'] != 0.0) ? ($zonaTot['costo_ventas_importe'] / $zonaTot['peso_venta']) : 0.0);

                $zonasList[] = [
                    'zona'       => $zonaNombre,
                    'total_zona' => [
                        'peso_venta'           => round($zonaTot['peso_venta'], 2),
                        'importe_venta'        => round($zonaTot['importe_venta'], 2),
                        'precio_venta'         => round($totalZonaPrVen, 3),
                        'costo_ventas_importe' => round($zonaTot['costo_ventas_importe'], 2),
                        'costo_ventas_precio'  => round($totalZonaPrCos, 3),
                        'comercial'            => round($zonaTot['comercial'], 2),
                        'administrativo'       => round($zonaTot['administrativo'], 2),
                        'utilidad_operativa'   => round($zonaTot['utilidad_operativa'], 2),
                        'pct_utilidad'         => 100.0,
                        'pct_peso'             => 100.0
                    ],
                    'grupos'     => $gruposProductos
                ];
            }

            $provinciasFinal[] = [
                'provincia' => $provNombre,
                'zonas'     => $zonasList
            ];
        }

        // Totales generales globales
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
            'pct_utilidad'         => 100.0,
            'pct_peso'             => 100.0
        ];

        $procLabel = !empty($procesos) ? implode(' y ', $procesos) : 'TODO';

        return [
            'success'         => true,
            'status'          => 'success',
            'tipo_grafico'    => 'Dash_EEGGyPP_Res_ASO',
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
