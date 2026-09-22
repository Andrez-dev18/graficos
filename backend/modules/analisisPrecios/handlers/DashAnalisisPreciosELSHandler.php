<?php

class DashAnalisisPreciosELSHandler
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

        // 4. Opciones de Zona / Glosas (Valores Relevantes por provincia)
        $whereZonas = ["m.lin = '601'", "cx.descri IS NOT NULL", "cx.descri != ''"];
        $paramsZonas = [];
        if (!empty($provinciaActiva)) {
            $whereZonas[] = "c.provincia = :provincia";
            $paramsZonas[':provincia'] = $provinciaActiva;
        }
        $whereZonasSql = implode(' AND ', $whereZonas);
        $sqlZonas = "
            SELECT DISTINCT cx.descri AS zona
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            WHERE {$whereZonasSql}
            ORDER BY cx.descri
        ";
        $stmtZonas = $db->prepare($sqlZonas);
        $stmtZonas->execute($paramsZonas);
        $opcionesZonas = $stmtZonas->fetchAll(PDO::FETCH_COLUMN);

        $opcionesTdocs = ['01', '03', '07', '08'];
        $opcionesLineas = ['601 Pollo Vivo'];

        // 5. Construir cláusula WHERE
        // En AnalisisPreciosELS el filtro de fecha opera sobre tfecfac (Fecha de Proceso)
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

        // Filtro: Zona
        if (!empty($filtros['zona'])) {
            if (is_array($filtros['zona'])) {
                $placeholders = [];
                foreach ($filtros['zona'] as $idx => $val) {
                    $ph = ":zona_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "cx.descri IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "cx.descri = :zona";
                $params[':zona'] = $filtros['zona'];
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

        // Filtro: TDOC (opcional)
        if (!empty($filtros['tdoc'])) {
            if (is_array($filtros['tdoc'])) {
                $placeholders = [];
                foreach ($filtros['tdoc'] as $idx => $val) {
                    $ph = ":tdoc_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "s.tdoc IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "s.tdoc = :tdoc";
                $params[':tdoc'] = $filtros['tdoc'];
            }
        }

        $whereClause = implode(' AND ', $where);

        $sql = "
            SELECT 
                c.provincia AS provincia,
                c.ruc AS cod_corporativo,
                COALESCE(c1.nombre, c.nombre, '') AS nom_corporativo,
                s.tprocli AS cod_cliente,
                c.nombre AS nom_cliente,
                s.tfecfac AS raw_fech_proc,
                DATE_FORMAT(s.tfecfac, '%d/%m/%Y') AS fech_proc,
                DATE_FORMAT(s.tfectra, '%d/%m/%Y') AS fech_tra,
                s.tdoc AS td,
                cx.descri AS zona,
                s.tnumfac AS nro_doc,
                CONCAT(COALESCE(m.lin, ''), ' ', COALESCE(l.descri, '')) AS linea_venta,
                m.codigo AS cod_item,
                m.descri AS nom_item,
                COALESCE(m.unidad, 'KGS') AS unidad,
                ROUND(SUM(s.timport), 2) AS importe,
                ROUND(SUM(s.tespeci), 2) AS peso,
                ROUND(SUM(s.tcantid), 2) AS cantidad,
                SUM(COALESCE(s.tigvsol, 0)) AS igv_sol,
                ROUND(CASE 
                    WHEN SUM(s.tespeci) > 0 THEN SUM(s.timport) / SUM(s.tespeci)
                    ELSE 0 
                END, 2) AS pu_sin_igv_kgs,
                ROUND(CASE 
                    WHEN SUM(s.tespeci) > 0 THEN (SUM(s.timport) + SUM(COALESCE(s.tigvsol, 0))) / SUM(s.tespeci)
                    ELSE 0 
                END, 2) AS pu_con_igv_kgs
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN linea l ON m.lin = l.linea
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereClause}
            GROUP BY 
                c.provincia,
                c.ruc,
                c1.nombre,
                s.tprocli,
                c.nombre,
                s.tfecfac,
                s.tfectra,
                s.tdoc,
                cx.descri,
                s.tnumfac,
                m.lin,
                l.descri,
                m.codigo,
                m.descri,
                m.unidad
            ORDER BY s.tfecfac ASC, s.tfectra ASC, s.tnumfac ASC, m.codigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupación y cálculo de subtotales por FechProc
        $gruposFechProc = [];
        $filas = [];
        $totalGeneralImporte = 0.0;
        $totalGeneralPeso = 0.0;
        $totalGeneralCantidad = 0.0;
        $totalGeneralIgv = 0.0;

        foreach ($rawRows as $idx => $r) {
            $fechProc = $r['fech_proc'] ?? '';
            $importe = (float) $r['importe'];
            $peso = (float) $r['peso'];
            $cantidad = (float) $r['cantidad'];
            $igv = (float) $r['igv_sol'];
            $puSinIgvKgs = (float) $r['pu_sin_igv_kgs'];
            $puConIgvKgs = (float) $r['pu_con_igv_kgs'];

            $filaObj = [
                'indice'          => $idx + 1,
                'provincia'       => $r['provincia'] ?? '',
                'codCorporativo'  => $r['cod_corporativo'] ?? '',
                'nomCorporativo'  => $r['nom_corporativo'] ?? '',
                'codCliente'      => $r['cod_cliente'] ?? '',
                'nomCliente'      => $r['nom_cliente'] ?? '',
                'fechProc'        => $fechProc,
                'fechTra'         => $r['fech_tra'] ?? '',
                'td'              => $r['td'] ?? '',
                'zona'            => $r['zona'] ?? '',
                'nroDoc'          => $r['nro_doc'] ?? '',
                'lineaVenta'      => trim($r['linea_venta'] ?? ''),
                'codItem'         => $r['cod_item'] ?? '',
                'nomItem'         => $r['nom_item'] ?? '',
                'unidad'          => $r['unidad'] ?? 'KGS',
                'importe'         => $importe,
                'peso'            => $peso,
                'cantidad'        => $cantidad,
                'puSinIgvKgs'     => $puSinIgvKgs,
                'puConIgvKgs'     => $puConIgvKgs
            ];

            $filas[] = $filaObj;

            if (!isset($gruposFechProc[$fechProc])) {
                $gruposFechProc[$fechProc] = [
                    'fechProc' => $fechProc,
                    'filas'    => [],
                    'subtotal' => [
                        'importe'      => 0.0,
                        'peso'         => 0.0,
                        'cantidad'     => 0.0,
                        'igv'          => 0.0,
                        'puSinIgvKgs'  => 0.0,
                        'puConIgvKgs'  => 0.0
                    ]
                ];
            }

            $gruposFechProc[$fechProc]['filas'][] = $filaObj;
            $gruposFechProc[$fechProc]['subtotal']['importe'] += $importe;
            $gruposFechProc[$fechProc]['subtotal']['peso'] += $peso;
            $gruposFechProc[$fechProc]['subtotal']['cantidad'] += $cantidad;
            $gruposFechProc[$fechProc]['subtotal']['igv'] += $igv;

            $totalGeneralImporte += $importe;
            $totalGeneralPeso += $peso;
            $totalGeneralCantidad += $cantidad;
            $totalGeneralIgv += $igv;
        }

        // Calcular P.U. consolidados de subtotales
        foreach ($gruposFechProc as $k => &$g) {
            $subImp = $g['subtotal']['importe'];
            $subPeso = $g['subtotal']['peso'];
            $subIgv = $g['subtotal']['igv'];

            $g['subtotal']['puSinIgvKgs'] = ($subPeso > 0) ? round($subImp / $subPeso, 2) : 0.0;
            $g['subtotal']['puConIgvKgs'] = ($subPeso > 0) ? round(($subImp + $subIgv) / $subPeso, 2) : 0.0;
            $g['subtotal']['importe'] = round($subImp, 2);
            $g['subtotal']['peso'] = round($subPeso, 2);
            $g['subtotal']['cantidad'] = round($g['subtotal']['cantidad'], 2);
        }
        unset($g);

        $puSinIgvKgsGeneral = ($totalGeneralPeso > 0) ? round($totalGeneralImporte / $totalGeneralPeso, 2) : 0.0;
        $puConIgvKgsGeneral = ($totalGeneralPeso > 0) ? round(($totalGeneralImporte + $totalGeneralIgv) / $totalGeneralPeso, 2) : 0.0;

        return [
            'status'           => 'success',
            'tipo_grafico'     => $filtros['tipo_grafico'] ?? 'AnalisisPreciosELS',
            'filtros'          => $filtros,
            'opciones_filtros' => [
                'provincias'   => $opcionesProvincias,
                'corporativos' => $opcionesCorporativos,
                'clientes'     => $opcionesClientes,
                'zonas'        => $opcionesZonas,
                'lineas'       => $opcionesLineas,
                'tdocs'        => $opcionesTdocs
            ],
            'filas'            => $filas,
            'grupos_fech_proc' => array_values($gruposFechProc),
            'resumen'          => [
                'total_filas'     => count($filas),
                'total_importe'   => round($totalGeneralImporte, 2),
                'total_peso'      => round($totalGeneralPeso, 2),
                'total_cantidad'  => round($totalGeneralCantidad, 2),
                'pu_sin_igv_kgs'  => $puSinIgvKgsGeneral,
                'pu_con_igv_kgs'  => $puConIgvKgsGeneral
            ]
        ];
    }
}
