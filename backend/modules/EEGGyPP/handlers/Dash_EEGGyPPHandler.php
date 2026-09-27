<?php

class Dash_EEGGyPPHandler
{
    /**
     * Procesa la consulta para el Dashboard Dash_EEGGyPP (LIMA 1 EE_GGyPP)
     *
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    private static function normalizeFilterArray($val): array
    {
        if (empty($val)) return [];
        if (is_array($val)) {
            $clean = [];
            foreach ($val as $v) {
                $v = trim((string)$v);
                if ($v !== '' && strtoupper($v) !== 'TODOS' && strtoupper($v) !== 'ALL' && strtoupper($v) !== '(TODO)') {
                    $clean[] = $v;
                }
            }
            return array_values(array_unique($clean));
        }
        $val = trim((string)$val);
        if ($val === '' || strtoupper($val) === 'TODOS' || strtoupper($val) === 'ALL' || strtoupper($val) === '(TODO)') {
            return [];
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
            return array_values(array_unique($clean));
        }
        return [$val];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $whereClauses = [];
        $params = [];

        // 1. Filtro por proceso (tctafun)
        $procesos = self::normalizeFilterArray($filtros['proceso'] ?? $filtros['select_proceso'] ?? null);
        if (!empty($procesos)) {
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
        $provincias = self::normalizeFilterArray($filtros['provincia'] ?? $filtros['filtro_provincia'] ?? null);
        if (!empty($provincias)) {
            $placeholders = implode(',', array_fill(0, count($provincias), '?'));
            $whereClauses[] = "TRIM(t.provin) IN ($placeholders)";
            foreach ($provincias as $pv) {
                $params[] = $pv;
            }
        }

        // 3. Filtro por Zona / Departamento
        $zonas = self::normalizeFilterArray($filtros['zona'] ?? $filtros['filtro_zona'] ?? null);
        if (!empty($zonas)) {
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
                CASE t.tctafun 
                    WHEN '7023102' THEN 'BENEFICIADO' 
                    WHEN '7023105' THEN 'TROZADO' 
                    WHEN '7023104' THEN 'MARINADO' 
                    ELSE COALESCE(t.desproc, 'OTROS') 
                END AS proceso,
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
            GROUP BY producto, orden_producto, tipo, codigo, descripcion, proceso
            ORDER BY orden_producto ASC, tipo ASC, codigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 1. Calcular totales globales para los cálculos porcentuales (% Peso y % Utilidad)
        $totalGeneralPeso = 0.0;
        $totalGeneralImporte = 0.0;
        $totalGeneralCosto = 0.0;
        $totalGeneralPesoCosto = 0.0;
        $totalGeneralComercial = 0.0;
        $totalGeneralAdmin = 0.0;
        $totalGeneralUtilidad = 0.0;

        foreach ($rawRows as $row) {
            $totalGeneralPeso      += (float)$row['peso_venta'];
            $totalGeneralImporte   += (float)$row['importe_venta'];
            $totalGeneralPesoCosto += (float)$row['peso_costo'];
            $totalGeneralCosto     += (float)$row['costo_ventas_importe'];
            $totalGeneralComercial += (float)$row['comercial'];
            $totalGeneralAdmin     += (float)$row['administrativo'];
            $totalGeneralUtilidad  += (float)$row['utilidad_operativa'];
        }

        // 2. Construir árbol jerárquico: Grupos (Producto) -> Tipos -> Items
        $gruposMap = [];

        foreach ($rawRows as $r) {
            $prod = $r['producto'];
            $tipo = $r['tipo'];

            $pesoVenta    = (float)$r['peso_venta'];
            $importeVenta = (float)$r['importe_venta'];
            $pesoCosto    = (float)$r['peso_costo'];
            $costoImporte = (float)$r['costo_ventas_importe'];
            $comercial    = (float)$r['comercial'];
            $admin        = (float)$r['administrativo'];
            $utilidad     = (float)$r['utilidad_operativa'];

            $precioVenta = ($pesoVenta != 0.0) ? ($importeVenta / $pesoVenta) : 0.0;
            $costoPrecio = ($pesoCosto != 0.0) ? ($costoImporte / $pesoCosto) : (($pesoVenta != 0.0) ? ($costoImporte / $pesoVenta) : 0.0);

            $pctUtilidad = ($totalGeneralUtilidad != 0.0) ? (($utilidad / $totalGeneralUtilidad) * 100.0) : 0.0;
            $pctPeso     = ($totalGeneralPeso != 0.0) ? (($pesoVenta / $totalGeneralPeso) * 100.0) : 0.0;

            $item = [
                'codigo'               => $r['codigo'],
                'descripcion'          => $r['descripcion'],
                'proceso'              => $r['proceso'],
                'peso_venta'           => round($pesoVenta, 2),
                'importe_venta'        => round($importeVenta, 2),
                'precio_venta'         => round($precioVenta, 3),
                'costo_ventas_importe' => round($costoImporte, 2),
                'costo_ventas_precio'  => round($costoPrecio, 3),
                'comercial'            => round($comercial, 2),
                'administrativo'       => round($admin, 2),
                'utilidad_operativa'   => round($utilidad, 2),
                'pct_utilidad'         => round($pctUtilidad, 2),
                'pct_peso'             => round($pctPeso, 2)
            ];

            if (!isset($gruposMap[$prod])) {
                $gruposMap[$prod] = [
                    'producto' => $prod,
                    'tipos'    => []
                ];
            }

            if (!isset($gruposMap[$prod]['tipos'][$tipo])) {
                $gruposMap[$prod]['tipos'][$tipo] = [
                    'tipo'     => $tipo,
                    'items'    => [],
                    '_totales' => [
                        'peso_venta'           => 0.0,
                        'importe_venta'        => 0.0,
                        'peso_costo'           => 0.0,
                        'costo_ventas_importe' => 0.0,
                        'comercial'            => 0.0,
                        'administrativo'       => 0.0,
                        'utilidad_operativa'   => 0.0
                    ]
                ];
            }

            $gruposMap[$prod]['tipos'][$tipo]['items'][] = $item;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['peso_venta']           += $pesoVenta;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['importe_venta']        += $importeVenta;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['peso_costo']           += $pesoCosto;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['costo_ventas_importe'] += $costoImporte;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['comercial']            += $comercial;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['administrativo']       += $admin;
            $gruposMap[$prod]['tipos'][$tipo]['_totales']['utilidad_operativa']   += $utilidad;
        }

        // Formatear array de grupos con subtotales por tipo
        $gruposFinal = [];
        foreach ($gruposMap as $prod => $gData) {
            $tiposFinal = [];
            foreach ($gData['tipos'] as $tipo => $tData) {
                $tot = $tData['_totales'];
                $sPrecioVenta = ($tot['peso_venta'] != 0.0) ? ($tot['importe_venta'] / $tot['peso_venta']) : 0.0;
                $sCostoPrecio = ($tot['peso_costo'] != 0.0) ? ($tot['costo_ventas_importe'] / $tot['peso_costo']) : (($tot['peso_venta'] != 0.0) ? ($tot['costo_ventas_importe'] / $tot['peso_venta']) : 0.0);
                $sPctUtilidad = ($totalGeneralUtilidad != 0.0) ? (($tot['utilidad_operativa'] / $totalGeneralUtilidad) * 100.0) : 0.0;
                $sPctPeso     = ($totalGeneralPeso != 0.0) ? (($tot['peso_venta'] / $totalGeneralPeso) * 100.0) : 0.0;

                $tiposFinal[] = [
                    'tipo'     => $tipo,
                    'items'    => $tData['items'],
                    'subtotal' => [
                        'peso_venta'           => round($tot['peso_venta'], 2),
                        'importe_venta'        => round($tot['importe_venta'], 2),
                        'precio_venta'         => round($sPrecioVenta, 3),
                        'costo_ventas_importe' => round($tot['costo_ventas_importe'], 2),
                        'costo_ventas_precio'  => round($sCostoPrecio, 3),
                        'comercial'            => round($tot['comercial'], 2),
                        'administrativo'       => round($tot['administrativo'], 2),
                        'utilidad_operativa'   => round($tot['utilidad_operativa'], 2),
                        'pct_utilidad'         => round($sPctUtilidad, 2),
                        'pct_peso'             => round($sPctPeso, 2)
                    ]
                ];
            }

            $gruposFinal[] = [
                'producto' => $prod,
                'tipos'    => $tiposFinal
            ];
        }

        // Totales generales calculados
        $totalPrecioVenta = ($totalGeneralPeso != 0.0) ? ($totalGeneralImporte / $totalGeneralPeso) : 0.0;
        $totalCostoPrecio = ($totalGeneralPesoCosto != 0.0) ? ($totalGeneralCosto / $totalGeneralPesoCosto) : (($totalGeneralPeso != 0.0) ? ($totalGeneralCosto / $totalGeneralPeso) : 0.0);

        $totalGeneral = [
            'peso_venta'           => round($totalGeneralPeso, 2),
            'importe_venta'        => round($totalGeneralImporte, 2),
            'precio_venta'         => round($totalPrecioVenta, 3),
            'costo_ventas_importe' => round($totalGeneralCosto, 2),
            'costo_ventas_precio'  => round($totalCostoPrecio, 3),
            'comercial'            => round($totalGeneralComercial, 2),
            'administrativo'       => round($totalGeneralAdmin, 2),
            'utilidad_operativa'   => round($totalGeneralUtilidad, 2),
            'pct_utilidad'         => ($totalGeneralUtilidad != 0.0) ? 100.0 : 0.0,
            'pct_peso'             => ($totalGeneralPeso != 0.0) ? 100.0 : 0.0
        ];

        return [
            'success'         => true,
            'status'          => 'success',
            'tipo_grafico'    => 'Dash_EEGGyPP',
            'titulo'          => 'LIMA 1 EE_GGyPP',
            'proceso_label'   => !empty($procesos) ? implode(', ', $procesos) : '(Todo)',
            'provincia_label' => !empty($provincias) ? implode(', ', $provincias) : '(Todo)',
            'zona_label'      => !empty($zonas) ? implode(', ', $zonas) : '(Todo)',
            'total_general'   => $totalGeneral,
            'grupos'          => $gruposFinal,
            'total_registros' => count($rawRows)
        ];
    }
}
