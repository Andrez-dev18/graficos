<?php

class CP01CostosGeneralesPorDiaHandler
{
    const FACTOR_AJUSTE = 0.366;

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-09-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-09-14';

        // Si el usuario seleccionó una sola fecha (ej. por_fecha '2026-09-07'),
        // la gráfica toma todo el mes completo (del 1 al último día del mes, ej. 2026-09-01 al 2026-09-30)
        // para mostrar todos los registros disponibles de ese mes como en Tableau;
        // si seleccionó un rango explícito (ej. '2026-08-01' a '2026-08-15'), se respeta dicho rango.
        if ($fechaInicio === $fechaFin) {
            $fechaGraficaInicio = date('Y-m-01', strtotime($fechaFin));
            $fechaGraficaFin    = date('Y-m-t', strtotime($fechaFin));
        } else {
            $fechaGraficaInicio = $fechaInicio;
            $fechaGraficaFin    = $fechaFin;
        }

        // Fecha para la tabla de la derecha (por defecto la fecha final o la seleccionada)
        $fechaSeleccionada = !empty($filtros['fecha_seleccionada']) ? trim($filtros['fecha_seleccionada']) : $fechaFin;

        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        // Filtro condicional de Clasificación para la gráfica y la tabla
        $whereClasif = "";
        $paramsGrafica = [
            ':fec_ini' => $fechaGraficaInicio,
            ':fec_fin' => $fechaGraficaFin
        ];
        $paramsTabla = [
            ':fec_tabla' => $fechaSeleccionada
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
                    $paramsGrafica[$pKey1] = $cVal;
                    $paramsGrafica[$pKey2] = $cVal;
                    $paramsTabla[$pKey1] = $cVal;
                    $paramsTabla[$pKey2] = $cVal;
                }
            }
            if (!empty($clasifConditions)) {
                $whereClasif = " AND (" . implode(' OR ', $clasifConditions) . ")";
            }
        }

        // 1. PUNTOS DE LA GRÁFICA DE TENDENCIA (Línea Superior e Inferior)
        $sqlGrafica = "SELECT 
                        fechahisto,
                        SUM(valor) AS sum_valor,
                        AVG(comodin) AS avg_comodin,
                        (SUM(valor) / NULLIF(AVG(comodin), 0)) AS cu_sin_factor,
                        ((SUM(valor) / NULLIF(AVG(comodin), 0)) + " . self::FACTOR_AJUSTE . ") AS cu_con_factor
                       FROM histodatosalmaacucompa
                       WHERE fechahisto BETWEEN :fec_ini AND :fec_fin
                         {$whereClasif}
                       GROUP BY fechahisto
                       ORDER BY fechahisto ASC";

        $stmtG = $db->prepare($sqlGrafica);
        $stmtG->execute($paramsGrafica);
        $rawPuntos = $stmtG->fetchAll(PDO::FETCH_ASSOC);

        $puntosGrafica = [];
        $diasDisponibles = [];

        foreach ($rawPuntos as $p) {
            $fec = $p['fechahisto'];
            $fecCorta = str_replace('-', '/', $fec);
            $val = (float)$p['sum_valor'];
            $kg  = (float)$p['avg_comodin'];
            $cuSin = round((float)$p['cu_sin_factor'], 3);
            $cuCon = round((float)$p['cu_con_factor'], 3);

            $puntosGrafica[] = [
                'fechahisto'    => $fec,
                'fecha_corta'   => $fecCorta,
                'cu_sin_factor' => $cuSin,
                'cu_con_factor' => $cuCon,
                'valor'         => round($val, 2),
                'kilos_prod'    => round($kg, 2)
            ];

            $diasDisponibles[] = $fec;
        }

        // Si la fecha seleccionada no está dentro del rango retornado, usar la última disponible
        if (!in_array($fechaSeleccionada, $diasDisponibles) && !empty($diasDisponibles)) {
            $fechaSeleccionada = end($diasDisponibles);
            $paramsTabla[':fec_tabla'] = $fechaSeleccionada;
        }

        // 2. TABLA DETALLE: "Costo Produccion por Kg de Pollo Vivo sin Factor"
        $sqlTabla = "SELECT 
                        linea,
                        nomlinea,
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        SUM(valor) AS valor,
                        AVG(comodin) AS kilos_prod
                     FROM histodatosalmaacucompa
                     WHERE fechahisto = :fec_tabla
                       {$whereClasif}
                     GROUP BY linea, nomlinea
                     ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                        nomlinea ASC";

        $stmtT = $db->prepare($sqlTabla);
        $stmtT->execute($paramsTabla);
        $rawTabla = $stmtT->fetchAll(PDO::FETCH_ASSOC);

        $tablaLineas = [];
        $totalValor = 0.0;
        $kilosProdDia = 0.0;

        foreach ($rawTabla as $t) {
            $val = (float)$t['valor'];
            $kg  = (float)$t['kilos_prod'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            if ($kilosProdDia === 0.0 && $kg > 0) {
                $kilosProdDia = $kg;
            }

            $totalValor += $val;

            $tablaLineas[] = [
                'linea'         => trim($t['linea'] ?? ''),
                'nomlinea'      => trim($t['nomlinea'] ?? ''),
                'clasificacion' => trim($t['clasificacion']),
                'valor'         => round($val, 2),
                'kilos_prod'    => round($kg, 2),
                'cu'            => $cu
            ];
        }

        $cuTotalGeneral = ($kilosProdDia > 0) ? round($totalValor / $kilosProdDia, 3) : 0.0;

        $totalesTabla = [
            'linea'         => '',
            'nomlinea'      => 'Total general',
            'clasificacion' => 'Total general',
            'valor'         => round($totalValor, 2),
            'kilos_prod'    => round($kilosProdDia, 2),
            'cu'            => $cuTotalGeneral
        ];

        // 3. CATÁLOGO COMPLETO DE CLASIFICACIONES (para el filtro multiselect)
        $sqlCat = "SELECT DISTINCT 
                    linea,
                    nomlinea,
                    CASE 
                        WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                        ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                    END AS clasificacion
                   FROM histodatosalmaacucompa
                   ORDER BY 
                    CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN '' ELSE linea END ASC,
                    nomlinea ASC";
        $stmtCat = $db->query($sqlCat);
        $catalogoClasificaciones = $stmtCat->fetchAll(PDO::FETCH_ASSOC);

        return [
            'tipo_grafico'             => 'CP01 CostosGeneralesPorDia',
            'titulo'                   => 'Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor',
            'fecha_inicio'             => $fechaInicio,
            'fecha_fin'                => $fechaFin,
            'fecha_seleccionada'       => $fechaSeleccionada,
            'factor_ajuste'            => self::FACTOR_AJUSTE,
            'puntos_grafica'           => $puntosGrafica,
            'dias_disponibles'         => $diasDisponibles,
            'tabla_lineas'             => $tablaLineas,
            'totales_tabla'            => $totalesTabla,
            'catalogo_clasificaciones' => $catalogoClasificaciones,
            'total_dias'               => count($puntosGrafica),
            'total_lineas'             => count($tablaLineas)
        ];
    }
}
