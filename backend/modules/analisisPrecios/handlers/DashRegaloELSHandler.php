<?php

class DashRegaloELSHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? '2026-06-01';
        $fechaFin    = $filtros['fecha_fin'] ?? '2026-06-30';

        // Provincia activa (por defecto AREQUIPA como en Tableau)
        $provinciaFiltro = $filtros['provincia'] ?? ['AREQUIPA'];
        $provinciaActiva = is_array($provinciaFiltro) ? ($provinciaFiltro[0] ?? 'AREQUIPA') : $provinciaFiltro;

        // Corporativo activo si viene especificado
        $corpFiltro = $filtros['corporativo'] ?? null;
        $corpActivo = is_array($corpFiltro) ? ($corpFiltro[0] ?? null) : $corpFiltro;

        // 1. Opciones de Provincia
        $sqlProv = "
            SELECT DISTINCT c.provincia
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            WHERE m.lin = '601'
              AND c.provincia IS NOT NULL AND c.provincia != ''
            ORDER BY c.provincia
        ";
        $stmtProv = $db->prepare($sqlProv);
        $stmtProv->execute();
        $opcionesProvincias = $stmtProv->fetchAll(PDO::FETCH_COLUMN);

        // 2. Opciones de Corporativo (Valores Relevantes por provincia)
        $whereCorp = ["m.lin = '601'", "COALESCE(c1.nombre, c.nombre) IS NOT NULL", "COALESCE(c1.nombre, c.nombre) != ''"];
        $paramsCorp = [];
        if (!empty($provinciaActiva)) {
            $whereCorp[] = "c.provincia = :provincia";
            $paramsCorp[':provincia'] = $provinciaActiva;
        }
        $whereCorpSql = implode(' AND ', $whereCorp);
        $sqlCorp = "
            SELECT DISTINCT COALESCE(c1.nombre, c.nombre) AS corporativo
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereCorpSql}
            ORDER BY corporativo
        ";
        $stmtCorp = $db->prepare($sqlCorp);
        $stmtCorp->execute($paramsCorp);
        $opcionesCorporativos = $stmtCorp->fetchAll(PDO::FETCH_COLUMN);

        // 3. Opciones de Clientes (Valores Relevantes por provincia y corporativo)
        $whereCli = ["m.lin = '601'", "c.nombre IS NOT NULL", "c.nombre != ''"];
        $paramsCli = [];
        if (!empty($provinciaActiva)) {
            $whereCli[] = "c.provincia = :provincia";
            $paramsCli[':provincia'] = $provinciaActiva;
        }
        if (!empty($corpActivo)) {
            $whereCli[] = "COALESCE(c1.nombre, c.nombre) = :corporativo";
            $paramsCli[':corporativo'] = $corpActivo;
        }
        $whereCliSql = implode(' AND ', $whereCli);
        $sqlCli = "
            SELECT DISTINCT c.nombre AS cliente
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereCliSql}
            ORDER BY c.nombre
        ";
        $stmtCli = $db->prepare($sqlCli);
        $stmtCli->execute($paramsCli);
        $opcionesClientes = $stmtCli->fetchAll(PDO::FETCH_COLUMN);

        $opcionesLineas = ['601 Pollo Vivo'];

        // 4. Cláusula WHERE común para las 3 consultas
        $where = ["m.lin = '601'", "s.tfecfac BETWEEN :fecha_inicio AND :fecha_fin"];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        // Filtro: Provincia
        if (!empty($provinciaFiltro)) {
            if (is_array($provinciaFiltro)) {
                $placeholders = [];
                foreach ($provinciaFiltro as $idx => $val) {
                    $ph = ":prov_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "c.provincia IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "c.provincia = :provincia";
                $params[':provincia'] = $provinciaFiltro;
            }
        }

        // Filtro: Corporativo
        if (!empty($filtros['corporativo'])) {
            if (is_array($filtros['corporativo'])) {
                $placeholders = [];
                foreach ($filtros['corporativo'] as $idx => $val) {
                    $ph = ":corp_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "COALESCE(c1.nombre, c.nombre, '') IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "COALESCE(c1.nombre, c.nombre, '') = :corporativo";
                $params[':corporativo'] = $filtros['corporativo'];
            }
        }

        // Filtro: NomCliente
        if (!empty($filtros['nomcliente'])) {
            if (is_array($filtros['nomcliente'])) {
                $placeholders = [];
                foreach ($filtros['nomcliente'] as $idx => $val) {
                    $ph = ":cli_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "c.nombre IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "c.nombre = :nomcliente";
                $params[':nomcliente'] = $filtros['nomcliente'];
            }
        }

        // Filtro: LineaVenta
        if (!empty($filtros['linea_venta'])) {
            if (is_array($filtros['linea_venta'])) {
                $placeholders = [];
                foreach ($filtros['linea_venta'] as $idx => $val) {
                    $ph = ":linea_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "CONCAT(COALESCE(m.lin, ''), ' ', COALESCE(l.descri, '')) IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "CONCAT(COALESCE(m.lin, ''), ' ', COALESCE(l.descri, '')) = :linea_venta";
                $params[':linea_venta'] = $filtros['linea_venta'];
            }
        }

        $whereClause = implode(' AND ', $where);

        // =========================================================================
        // 1. QUERY PARETO VENTAS (Panel Superior)
        // =========================================================================
        $sqlPareto = "
            SELECT 
                c.ruc AS cod_corporativo,
                COALESCE(c1.nombre, c.nombre, '') AS nom_corporativo,
                ROUND(SUM(s.tcantid), 2) AS cantidad,
                ROUND(SUM(s.tespeci), 2) AS peso,
                ROUND(SUM(s.timport), 2) AS importe
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN linea l ON m.lin = l.linea
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereClause}
            GROUP BY c.ruc, c1.nombre, c.nombre
            ORDER BY peso DESC
        ";
        $stmtPareto = $db->prepare($sqlPareto);
        $stmtPareto->execute($params);
        $rawPareto = $stmtPareto->fetchAll(PDO::FETCH_ASSOC);

        $totalPesoGeneral = 0.0;
        $totalCantidadGeneral = 0.0;
        $totalImporteGeneral = 0.0;

        foreach ($rawPareto as $p) {
            $totalPesoGeneral += (float) $p['peso'];
            $totalCantidadGeneral += (float) $p['cantidad'];
            $totalImporteGeneral += (float) $p['importe'];
        }

        $paretoFilas = [];
        $maxCantidad = 0.0;
        $maxPeso = 0.0;
        $maxImporte = 0.0;
        $maxPorcPeso = 0.0;

        foreach ($rawPareto as $idx => $r) {
            $cant = (float) $r['cantidad'];
            $peso = (float) $r['peso'];
            $imp  = (float) $r['importe'];
            $pct  = ($totalPesoGeneral > 0) ? round(($peso / $totalPesoGeneral) * 100, 2) : 0.0;

            if ($cant > $maxCantidad) $maxCantidad = $cant;
            if ($peso > $maxPeso) $maxPeso = $peso;
            if ($imp > $maxImporte) $maxImporte = $imp;
            if ($pct > $maxPorcPeso) $maxPorcPeso = $pct;

            $paretoFilas[] = [
                'indice'          => $idx + 1,
                'codCorporativo'  => $r['cod_corporativo'] ?? '',
                'nomCorporativo'  => $r['nom_corporativo'] ?? '',
                'cantidad'        => $cant,
                'peso'            => $peso,
                'importe'         => $imp,
                'porcPeso'        => $pct
            ];
        }

        // =========================================================================
        // 2. QUERY PRECIO VENTAS (Panel Inferior Izquierdo)
        // =========================================================================
        $sqlPrecios = "
            SELECT 
                COALESCE(c1.nombre, c.nombre, '') AS nom_corporativo,
                DATE_FORMAT(s.tfecfac, '%d/%m') AS dia_fecha,
                s.tfecfac AS raw_fecha,
                s.tdoc,
                ROUND(CASE 
                    WHEN SUM(s.tespeci) > 0 THEN (SUM(s.timport) + SUM(COALESCE(s.tigvsol, 0))) / SUM(s.tespeci)
                    ELSE 0 
                END, 2) AS pu_con_igv_kgs
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN linea l ON m.lin = l.linea
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereClause}
            GROUP BY c1.nombre, c.nombre, s.tfecfac, s.tdoc
            ORDER BY c1.nombre ASC, s.tfecfac ASC, s.tdoc ASC
        ";
        $stmtPrecios = $db->prepare($sqlPrecios);
        $stmtPrecios->execute($params);
        $rawPrecios = $stmtPrecios->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar matriz PrecioVentas por [nom_corporativo][dia_fecha] -> { tdoc_01, tdoc_03, tdoc_07 }
        $preciosMatriz = [];
        foreach ($rawPrecios as $pr) {
            $nomCorp = $pr['nom_corporativo'] ?? '';
            $diaFecha = $pr['dia_fecha'] ?? '';
            $tdoc = $pr['tdoc'] ?? '';
            $pu = (float) $pr['pu_con_igv_kgs'];

            $key = $nomCorp . '___' . $diaFecha;
            if (!isset($preciosMatriz[$key])) {
                $preciosMatriz[$key] = [
                    'nomCorporativo' => $nomCorp,
                    'diaFecha'       => $diaFecha,
                    'rawFecha'       => $pr['raw_fecha'] ?? '',
                    'tdoc_01'        => null,
                    'tdoc_03'        => null,
                    'tdoc_07'        => null
                ];
            }

            if ($tdoc === '01') $preciosMatriz[$key]['tdoc_01'] = $pu;
            if ($tdoc === '03') $preciosMatriz[$key]['tdoc_03'] = $pu;
            if ($tdoc === '07') $preciosMatriz[$key]['tdoc_07'] = $pu;
        }

        // =========================================================================
        // 3. QUERY MOTIVOS NC VENTAS (Panel Inferior Derecho)
        // =========================================================================
        $sqlMotivos = "
            SELECT 
                COALESCE(c1.nombre, c.nombre, '') AS nom_corporativo,
                s.tdoc,
                DATE_FORMAT(s.tfecfac, '%d/%m') AS dia_fecha,
                s.tfecfac AS raw_fecha,
                CASE 
                    WHEN s.tdoc IN ('01', '03') THEN ''
                    WHEN s.tdoc = '07' THEN cx.descri
                    ELSE ''
                END AS motivo,
                ROUND(SUM(s.timport + COALESCE(s.tigvsol, 0)), 2) AS importe_igv,
                ROUND(SUM(s.tespeci), 2) AS peso,
                ROUND(CASE 
                    WHEN SUM(s.tespeci) > 0 THEN (SUM(s.timport) + SUM(COALESCE(s.tigvsol, 0))) / SUM(s.tespeci)
                    ELSE 0 
                END, 2) AS pu_con_igv_kgs
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN linea l ON m.lin = l.linea
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            LEFT JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            WHERE {$whereClause}
            GROUP BY c1.nombre, c.nombre, s.tdoc, s.tfecfac, motivo
            ORDER BY c1.nombre ASC, s.tdoc ASC, s.tfecfac ASC
        ";
        $stmtMotivos = $db->prepare($sqlMotivos);
        $stmtMotivos->execute($params);
        $rawMotivos = $stmtMotivos->fetchAll(PDO::FETCH_ASSOC);

        $motivosFilas = [];
        foreach ($rawMotivos as $idx => $mRow) {
            $motivosFilas[] = [
                'indice'          => $idx + 1,
                'nomCorporativo'  => $mRow['nom_corporativo'] ?? '',
                'tdoc'            => $mRow['tdoc'] ?? '',
                'diaFecha'        => $mRow['dia_fecha'] ?? '',
                'rawFecha'        => $mRow['raw_fecha'] ?? '',
                'motivo'          => $mRow['motivo'] ?? '',
                'importeIgv'      => (float) $mRow['importe_igv'],
                'peso'            => (float) $mRow['peso'],
                'puConIgvKgs'     => (float) $mRow['pu_con_igv_kgs']
            ];
        }

        return [
            'status'           => 'success',
            'tipo_grafico'     => $filtros['tipo_grafico'] ?? 'DashRegaloELS',
            'filtros'          => $filtros,
            'opciones_filtros' => [
                'provincias'   => $opcionesProvincias,
                'corporativos' => $opcionesCorporativos,
                'clientes'     => $opcionesClientes,
                'lineas'       => $opcionesLineas
            ],
            'pareto_ventas'    => [
                'filas'         => $paretoFilas,
                'total_peso'    => round($totalPesoGeneral, 2),
                'total_cantidad'=> round($totalCantidadGeneral, 2),
                'total_importe' => round($totalImporteGeneral, 2),
                'max_cantidad'  => $maxCantidad,
                'max_peso'      => $maxPeso,
                'max_importe'   => $maxImporte,
                'max_porc_peso' => $maxPorcPeso
            ],
            'precio_ventas'    => array_values($preciosMatriz),
            'motivos_nc_ventas'=> $motivosFilas,
            'resumen'          => [
                'total_corporativos' => count($paretoFilas),
                'total_peso'         => round($totalPesoGeneral, 2),
                'total_cantidad'     => round($totalCantidadGeneral, 2),
                'total_importe'      => round($totalImporteGeneral, 2)
            ]
        ];
    }
}
