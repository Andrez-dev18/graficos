<?php

class DashAnalisiPreciosHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? '2026-06-01';
        $fechaFin = $filtros['fecha_fin'] ?? '2026-06-30';

        // Provincia activa (por defecto AREQUIPA como en Tableau)
        $provinciaFiltro = $filtros['provincia'] ?? ['AREQUIPA'];
        $provinciaActiva = is_array($provinciaFiltro) ? ($provinciaFiltro[0] ?? 'AREQUIPA') : $provinciaFiltro;

        // Zona activa (por defecto ZONA CONO NORTE como en Tableau)
        $zonaFiltro = $filtros['zona'] ?? ['ZONA CONO NORTE'];
        $zonaActiva = is_array($zonaFiltro) ? ($zonaFiltro[0] ?? 'ZONA CONO NORTE') : $zonaFiltro;

        // 1. Opciones de Provincia (Catálogo de provincias disponibles en Línea 601)
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

        // 2. Opciones de Zona (Valores Relevantes: las 16 zonas maestras de la provincia activa)
        $sqlZonas = "
            SELECT DISTINCT cx.descri AS zona
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            WHERE m.lin = '601'
              AND c.provincia = :provincia
            ORDER BY cx.descri
        ";
        $stmtZonas = $db->prepare($sqlZonas);
        $stmtZonas->execute([
            ':provincia' => $provinciaActiva
        ]);
        $opcionesZonas = $stmtZonas->fetchAll(PDO::FETCH_COLUMN);

        // 3. Opciones de Clientes (Valores Relevantes: los clientes completos de la zona y provincia en Tableau)
        $sqlCli = "
            SELECT DISTINCT c.nombre AS cliente
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            WHERE m.lin = '601'
              AND c.provincia = :provincia
              AND cx.descri = :zona
            ORDER BY c.nombre
        ";
        $stmtCli = $db->prepare($sqlCli);
        $stmtCli->execute([
            ':provincia' => $provinciaActiva,
            ':zona'      => $zonaActiva
        ]);
        $opcionesClientes = $stmtCli->fetchAll(PDO::FETCH_COLUMN);

        // 4. Opciones de Corporativos (Valores Relevantes para la provincia y zona activas)
        $sqlCorp = "
            SELECT DISTINCT COALESCE(c1.nombre, c.nombre) AS corporativo
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE m.lin = '601'
              AND c.provincia = :provincia
              AND cx.descri = :zona
            ORDER BY corporativo
        ";
        $stmtCorp = $db->prepare($sqlCorp);
        $stmtCorp->execute([
            ':provincia' => $provinciaActiva,
            ':zona'      => $zonaActiva
        ]);
        $opcionesCorporativos = $stmtCorp->fetchAll(PDO::FETCH_COLUMN);

        $opcionesTdocs = ['01', '03', '07', '08'];
        $opcionesLineas = ['601 Pollo Vivo'];

        // 5. Construir cláusula WHERE con los filtros seleccionados
        $where = ["m.lin = '601'", "s.tfectra BETWEEN :fecha_inicio AND :fecha_fin"];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        // Filtro 1: Tdoc
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

        // Filtro 2: LineaVenta
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

        // Filtro 3: Corporativo (nombre)
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

        // Filtro 4: NomCliente
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

        // Filtro 5: Provincia
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

        // Filtro 6: Zona
        if (!empty($zonaFiltro)) {
            if (is_array($zonaFiltro)) {
                $placeholders = [];
                foreach ($zonaFiltro as $idx => $val) {
                    $ph = ":zona_{$idx}";
                    $placeholders[] = $ph;
                    $params[$ph] = $val;
                }
                $where[] = "cx.descri IN (" . implode(',', $placeholders) . ")";
            } else {
                $where[] = "cx.descri = :zona";
                $params[':zona'] = $zonaFiltro;
            }
        }

        $whereClause = implode(' AND ', $where);

        $sql = "
            SELECT 
                c.provincia AS provincia,
                cx.descri AS zona,
                c.ruc AS cod_corporativo,
                COALESCE(c1.nombre, c.nombre, '') AS nom_corporativo,
                s.tprocli AS cod_cliente,
                c.nombre AS nom_cliente,
                DATE_FORMAT(s.tfectra, '%d/%m/%Y') AS fecha,
                s.tdoc AS td,
                s.tnumfac AS nro_doc,
                CONCAT(COALESCE(m.lin, ''), ' ', COALESCE(l.descri, '')) AS linea_venta,
                m.codigo AS cod_item,
                m.descri AS nom_item,
                COALESCE(m.unidad, 'KGS') AS unidad,
                ROUND(SUM(s.timport), 2) AS importe,
                ROUND(SUM(s.tespeci), 2) AS peso,
                ROUND(SUM(s.tcantid), 2) AS cantidad,
                ROUND(CASE 
                    WHEN SUM(s.tespeci) > 0 THEN (SUM(s.timport) + SUM(COALESCE(s.tigvsol, 0))) / SUM(s.tespeci)
                    ELSE 0 
                END, 2) AS pu_con_igv_kgs,
                ROUND(CASE 
                    WHEN SUM(s.tcantid) > 0 THEN SUM(s.timport) / SUM(s.tcantid)
                    ELSE 0 
                END, 2) AS pu_und
            FROM sale s
            INNER JOIN ccte c ON s.tprocli = c.codigo
            INNER JOIN mitm m ON s.tcodigo = m.codigo
            LEFT JOIN linea l ON m.lin = l.linea
            INNER JOIN cctex cx ON LEFT(s.tbatch, 2) = cx.cod2 AND RIGHT(s.tbatch, 4) = cx.cod1
            LEFT JOIN ccte c1 ON c.ruc = c1.codigo
            WHERE {$whereClause}
            GROUP BY 
                c.provincia,
                cx.descri,
                c.ruc,
                c1.nombre,
                s.tprocli,
                c.nombre,
                s.tfectra,
                s.tdoc,
                s.tnumfac,
                m.lin,
                l.descri,
                m.codigo,
                m.descri,
                m.unidad
            ORDER BY s.tfectra ASC, s.tnumfac ASC, m.codigo ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $filas = [];
        $totalImporte = 0.0;
        $totalPeso = 0.0;
        $totalCantidad = 0.0;

        foreach ($rawRows as $idx => $r) {
            $importe = (float) $r['importe'];
            $peso = (float) $r['peso'];
            $cantidad = (float) $r['cantidad'];
            $puConIgvKgs = (float) $r['pu_con_igv_kgs'];
            $puUnd = (float) $r['pu_und'];

            $totalImporte += $importe;
            $totalPeso += $peso;
            $totalCantidad += $cantidad;

            $filas[] = [
                'indice'          => $idx + 1,
                'provincia'       => $r['provincia'] ?? '',
                'zona'            => $r['zona'] ?? '',
                'codCorporativo'  => $r['cod_corporativo'] ?? '',
                'nomCorporativo'  => $r['nom_corporativo'] ?? '',
                'codCliente'      => $r['cod_cliente'] ?? '',
                'nomCliente'      => $r['nom_cliente'] ?? '',
                'fecha'           => $r['fecha'] ?? '',
                'td'              => $r['td'] ?? '',
                'nroDoc'          => $r['nro_doc'] ?? '',
                'lineaVenta'      => trim($r['linea_venta'] ?? ''),
                'codItem'         => $r['cod_item'] ?? '',
                'nomItem'         => $r['nom_item'] ?? '',
                'unidad'          => $r['unidad'] ?? 'KGS',
                'importe'         => $importe,
                'peso'            => $peso,
                'cantidad'        => $cantidad,
                'puConIgvKgs'     => $puConIgvKgs,
                'puUnd'           => $puUnd
            ];
        }

        return [
            'status'           => 'success',
            'tipo_grafico'     => $filtros['tipo_grafico'] ?? 'DashAnalisiPrecios',
            'filtros'          => $filtros,
            'opciones_filtros' => [
                'tdocs'        => $opcionesTdocs,
                'lineas'       => $opcionesLineas,
                'corporativos' => $opcionesCorporativos,
                'clientes'     => $opcionesClientes,
                'provincias'   => $opcionesProvincias,
                'zonas'        => $opcionesZonas
            ],
            'filas'            => $filas,
            'resumen'          => [
                'total_filas'    => count($filas),
                'total_importe'  => round($totalImporte, 2),
                'total_peso'     => round($totalPeso, 2),
                'total_cantidad' => round($totalCantidad, 2)
            ]
        ];
    }
}
