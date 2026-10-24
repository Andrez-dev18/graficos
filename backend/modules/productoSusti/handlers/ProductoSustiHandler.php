<?php

class ProductoSustiHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        // 1. Rango de fechas disponibles
        $sqlRango = "
            SELECT 
                MIN(s.fecha) AS fecha_min,
                MAX(s.fecha) AS fecha_max
            FROM com_db_prod_sustituto s
            WHERE s.fecha IS NOT NULL
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? '2021-10-11';
        $fechaMax = $rango['fecha_max'] ?? date('Y-m-d');

        // 2. Catálogo de productos sustitutos
        $sqlProd = "
            SELECT 
                t.codigo,
                TRIM(t.nombre) AS nombre
            FROM com_tip_prod_sut t
            WHERE t.nombre IS NOT NULL AND TRIM(t.nombre) <> ''
            ORDER BY t.nombre ASC
        ";
        $stmtProd = $db->query($sqlProd);
        $productos = [];
        $productosDefault = [];

        foreach ($stmtProd->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $cod = (string)$row['codigo'];
            $nom = trim((string)$row['nombre']);
            $productos[] = [
                'id'     => $nom,
                'codigo' => $cod,
                'label'  => $nom
            ];
            // Por defecto en Tableau estaban seleccionados los principales
            if (in_array($nom, ['BONITO', 'CABALLA', 'JUREL', 'OTROS', 'PEJERREY', 'PERICO'], true)) {
                $productosDefault[] = $nom;
            }
        }

        if (empty($productosDefault) && !empty($productos)) {
            $productosDefault = array_column($productos, 'id');
        }

        return [
            'fecha_min'            => $fechaMin,
            'fecha_max'            => $fechaMax,
            'fecha_inicio_default' => $fechaMin,
            'fecha_fin_default'    => $fechaMax,
            'productos'            => $productos,
            'productos_default'    => $productosDefault
        ];
    }

    public static function obtenerDatos(PDO $db, array $filtros): array
    {
        // 1. Fechas
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim((string)$filtros['fecha_inicio']) : null;
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim((string)$filtros['fecha_fin']) : null;

        if (!$fechaInicio || !$fechaFin) {
            $limites = self::obtenerFiltros($db);
            $fechaInicio = $fechaInicio ?: $limites['fecha_min'];
            $fechaFin    = $fechaFin ?: $limites['fecha_max'];
        }

        // 2. Filtro de Productos
        $productosSeleccionados = [];
        if (!empty($filtros['productos'])) {
            if (is_array($filtros['productos'])) {
                $productosSeleccionados = array_map('trim', $filtros['productos']);
            } else {
                $productosSeleccionados = [trim((string)$filtros['productos'])];
            }
        }

        // Condición WHERE
        $where = ["s.fecha BETWEEN :fecha_inicio AND :fecha_fin"];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        if (!empty($productosSeleccionados) && !in_array('(Todo)', $productosSeleccionados, true)) {
            $prodClauses = [];
            foreach ($productosSeleccionados as $i => $pVal) {
                $keyNom = ":p_nom_{$i}";
                $keyCod = ":p_cod_{$i}";
                $prodClauses[] = "(TRIM(t.nombre) = {$keyNom} OR t.codigo = {$keyCod})";
                $params[$keyNom] = $pVal;
                $params[$keyCod] = $pVal;
            }
            $where[] = '(' . implode(' OR ', $prodClauses) . ')';
        }

        $whereClause = implode(' AND ', $where);

        // 1. Consulta para ProdGeneral (Agrupación exacta por semana según Tableau AVG([precioPub]))
        $sqlGeneral = "
            SELECT 
                DATE_FORMAT(s.fecha, '%x') AS anio,
                CAST(DATE_FORMAT(s.fecha, '%v') AS UNSIGNED) AS semana,
                DATE_FORMAT(s.fecha, '%x%v') AS semana_orden,
                CONCAT(DATE_FORMAT(s.fecha, '%x'), ' S', CAST(DATE_FORMAT(s.fecha, '%v') AS UNSIGNED)) AS semana_label,
                SUM(s.peso) AS total_peso,
                AVG(s.precioPub) AS avg_precioPub
            FROM com_db_prod_sustituto s
            INNER JOIN com_tip_prod_sut t ON s.producto = t.codigo
            WHERE {$whereClause}
            GROUP BY anio, semana, semana_orden, semana_label
            ORDER BY semana_orden ASC
        ";

        $stmtGen = $db->prepare($sqlGeneral);
        $stmtGen->execute($params);
        $filasGen = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

        // Mapeo cronológico de semanas
        $semanasMap = [];
        $semanaIdxMap = [];
        $generalPesos = [];
        $generalPrecios = [];
        $totalPesoGlobal = 0;

        foreach ($filasGen as $idx => $f) {
            $sKey = $f['semana_orden'];
            $semanasMap[$sKey] = [
                'orden'  => $sKey,
                'label'  => $f['semana_label'],
                'anio'   => (int)$f['anio'],
                'semana' => (int)$f['semana']
            ];
            $semanaIdxMap[$sKey] = $idx;
            $peso = (float)$f['total_peso'];
            $precio = $f['avg_precioPub'] !== null ? round((float)$f['avg_precioPub'], 2) : null;

            $generalPesos[] = $peso;
            $generalPrecios[] = $precio;
            $totalPesoGlobal += $peso;
        }

        $labels = array_map(function ($s) {
            return $s['label'];
        }, array_values($semanasMap));

        $numSemanas = count($labels);

        // 2. Consulta para ProdIndividual (Agrupación por semana y producto)
        $sqlIndividual = "
            SELECT 
                DATE_FORMAT(s.fecha, '%x') AS anio,
                CAST(DATE_FORMAT(s.fecha, '%v') AS UNSIGNED) AS semana,
                DATE_FORMAT(s.fecha, '%x%v') AS semana_orden,
                CONCAT(DATE_FORMAT(s.fecha, '%x'), ' S', CAST(DATE_FORMAT(s.fecha, '%v') AS UNSIGNED)) AS semana_label,
                t.codigo AS producto_id,
                TRIM(t.nombre) AS producto_nombre,
                SUM(s.peso) AS total_peso,
                AVG(s.precioPub) AS avg_precioPub
            FROM com_db_prod_sustituto s
            INNER JOIN com_tip_prod_sut t ON s.producto = t.codigo
            WHERE {$whereClause}
            GROUP BY anio, semana, semana_orden, semana_label, t.codigo, TRIM(t.nombre)
            ORDER BY semana_orden ASC, TRIM(t.nombre) ASC
        ";

        $stmtInd = $db->prepare($sqlIndividual);
        $stmtInd->execute($params);
        $filasInd = $stmtInd->fetchAll(PDO::FETCH_ASSOC);

        // Organizar productos individuales
        $productosEncontrados = [];
        $individual = [];

        foreach ($filasInd as $f) {
            $prodNom = $f['producto_nombre'];
            if (!isset($individual[$prodNom])) {
                $individual[$prodNom] = [
                    'producto' => $prodNom,
                    'pesos'    => array_fill(0, $numSemanas, 0),
                    'precios'  => array_fill(0, $numSemanas, null)
                ];
                $productosEncontrados[] = $prodNom;
            }

            $sKey = $f['semana_orden'];
            if (isset($semanaIdxMap[$sKey])) {
                $idx = $semanaIdxMap[$sKey];
                $peso = (float)$f['total_peso'];
                $precio = $f['avg_precioPub'] !== null ? round((float)$f['avg_precioPub'], 2) : null;

                $individual[$prodNom]['pesos'][$idx] = $peso;
                $individual[$prodNom]['precios'][$idx] = $precio;
            }
        }

        $totalRegistros = count($filasInd);

        return [
            'labels'             => $labels,
            'semanas_meta'       => array_values($semanasMap),
            'productos_activos'  => $productosEncontrados,
            'general'            => [
                'pesos'   => $generalPesos,
                'precios' => $generalPrecios
            ],
            'individual'         => array_values($individual),
            'kpis'               => [
                'total_peso'       => $totalPesoGlobal,
                'total_semanas'    => $numSemanas,
                'total_productos'  => count($productosEncontrados),
                'total_registros'  => $totalRegistros
            ],
            'filtros_aplicados'  => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'productos'    => $productosSeleccionados
            ]
        ];
    }
}
