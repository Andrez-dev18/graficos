<?php

class CP04CostosGeneralesDetalleAlDiaHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Determinar Fecha de Consulta
        // Puede venir por 'fecha_seleccionada', 'fecha_fin', 'fecha_inicio', 'fechahisto' o 'por_fecha'
        $fechaConsulta = !empty($filtros['fecha_seleccionada']) ? trim($filtros['fecha_seleccionada']) : null;
        if (!$fechaConsulta && !empty($filtros['fechahisto'])) {
            $fechaConsulta = trim($filtros['fechahisto']);
        }
        if (!$fechaConsulta && !empty($filtros['por_fecha'])) {
            $fechaConsulta = trim($filtros['por_fecha']);
        }
        if (!$fechaConsulta && !empty($filtros['fecha_fin'])) {
            $fechaConsulta = trim($filtros['fecha_fin']);
        }
        if (!$fechaConsulta && !empty($filtros['fecha_inicio'])) {
            $fechaConsulta = trim($filtros['fecha_inicio']);
        }

        // Obtener fechas disponibles recientes de histodatosalmaacucompa
        $stmtFechas = $db->query("SELECT DISTINCT fechahisto FROM histodatosalmaacucompa ORDER BY fechahisto DESC LIMIT 90");
        $fechasDisponibles = $stmtFechas->fetchAll(PDO::FETCH_COLUMN);

        // Si no hay fecha o la fecha no existe en BD, usar la última fecha disponible
        if (!$fechaConsulta || !in_array($fechaConsulta, $fechasDisponibles)) {
            $fechaConsulta = !empty($fechasDisponibles) ? $fechasDisponibles[0] : '2026-09-14';
        }

        // 2. Procesar Filtro de Clasificación
        $clasifFiltro = !empty($filtros['clasificacion']) ? $filtros['clasificacion'] : null;
        if (is_string($clasifFiltro)) {
            $clasifFiltro = array_map('trim', explode(',', $clasifFiltro));
        }

        $whereClasif = "";
        $params = [
            ':fec' => $fechaConsulta
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
                    $params[$pKey1] = $cVal;
                    $params[$pKey2] = $cVal;
                }
            }
            if (!empty($clasifConditions)) {
                $whereClasif = " AND (" . implode(' OR ', $clasifConditions) . ")";
            }
        }

        // 3. TABLA 1: "Costo Produccion por Kg de Pollo Vivo" (histodatosalmaacucompa)
        // Fórmulas:
        // valor: SUM(valor)
        // Kilos Prod: AVG(comodin)
        // CU: SUM(valor) / NULLIF(AVG(comodin), 0)
        $sqlTabla1 = "SELECT 
                        linea,
                        nomlinea,
                        CASE 
                            WHEN linea IS NULL OR TRIM(linea) = '' THEN 'NULL'
                            ELSE CONCAT(TRIM(linea), ' ', COALESCE(TRIM(nomlinea), ''))
                        END AS clasificacion,
                        SUM(valor) AS valor,
                        AVG(comodin) AS kilos_prod
                      FROM histodatosalmaacucompa
                      WHERE fechahisto = :fec
                        {$whereClasif}
                      GROUP BY linea, nomlinea
                      ORDER BY 
                        CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC,
                        nomlinea ASC";

        $stmt1 = $db->prepare($sqlTabla1);
        $stmt1->execute($params);
        $rawTabla1 = $stmt1->fetchAll(PDO::FETCH_ASSOC);

        $filasTabla1 = [];
        $totalValor1 = 0.0;
        $kilosProdDia = 0.0;

        foreach ($rawTabla1 as $r) {
            $val = (float)$r['valor'];
            $kg  = (float)$r['kilos_prod'];
            $cu  = ($kg > 0) ? round($val / $kg, 3) : 0.0;

            if ($kilosProdDia === 0.0 && $kg > 0) {
                $kilosProdDia = $kg;
            }

            $totalValor1 += $val;

            $filasTabla1[] = [
                'linea'         => $r['linea'] ?? '',
                'nomlinea'      => $r['nomlinea'] ?? '',
                'clasificacion' => $r['clasificacion'] ?? '',
                'valor'         => round($val, 2),
                'kilos_prod'    => round($kg, 2),
                'cu'            => $cu
            ];
        }

        $totalCU1 = ($kilosProdDia > 0) ? round($totalValor1 / $kilosProdDia, 3) : 0.0;

        $resumenCostoProduccion = [
            'filas' => $filasTabla1,
            'totales' => [
                'linea'      => '',
                'nomlinea'   => 'Total general',
                'valor'      => round($totalValor1, 2),
                'kilos_prod' => round($kilosProdDia, 2),
                'cu'         => $totalCU1
            ]
        ];

        // 4. TABLA 2: "Detalle del costo Unitario por Linea" (histodatosalma)
        // Fórmulas:
        // cantidad: SUM(cantidad)
        // peso: SUM(peso)
        // valor: SUM(valor)
        // kilosprodacu: MAX(kilosprodacu)
        // CU: SUM(valor) / NULLIF(MAX(kilosprodacu), 0)
        $sqlTabla2 = "SELECT 
                        cencos,
                        galpon,
                        linea,
                        nomlinea,
                        codigo,
                        nomcodigo,
                        unidad,
                        transaccion,
                        SUM(cantidad) AS cantidad,
                        SUM(peso) AS peso,
                        SUM(valor) AS valor,
                        MAX(kilosprodacu) AS kilosprodacu
                      FROM histodatosalma
                      WHERE fechahisto = :fec
                        {$whereClasif}
                      GROUP BY cencos, galpon, linea, nomlinea, codigo, nomcodigo, unidad, transaccion
                      ORDER BY 
                        cencos ASC, 
                        galpon ASC, 
                        linea ASC, 
                        codigo ASC";

        $stmt2 = $db->prepare($sqlTabla2);
        $stmt2->execute($params);
        $rawTabla2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);

        $filasTabla2 = [];
        $totalCantidad2 = 0.0;
        $totalPeso2 = 0.0;
        $totalValor2 = 0.0;

        foreach ($rawTabla2 as $r2) {
            $cant = (float)$r2['cantidad'];
            $peso = (float)$r2['peso'];
            $val  = (float)$r2['valor'];
            $kgAcu = (float)$r2['kilosprodacu'];
            $cu   = ($kgAcu > 0) ? round($val / $kgAcu, 3) : 0.0;

            $totalCantidad2 += $cant;
            $totalPeso2     += $peso;
            $totalValor2    += $val;

            $filasTabla2[] = [
                'cencos'       => $r2['cencos'] ?? '',
                'galpon'       => $r2['galpon'] ?? '',
                'linea'        => $r2['linea'] ?? '',
                'nomlinea'     => $r2['nomlinea'] ?? '',
                'clasificacion'=> trim(($r2['linea'] ?? '') . ' ' . ($r2['nomlinea'] ?? '')),
                'codigo'       => $r2['codigo'] ?? '',
                'nomcodigo'    => $r2['nomcodigo'] ?? '',
                'unidad'       => $r2['unidad'] ?? '',
                'transaccion'  => $r2['transaccion'] ?? '',
                'cantidad'     => round($cant, 2),
                'peso'         => round($peso, 2),
                'valor'        => round($val, 2),
                'kilosprodacu' => round($kgAcu, 2),
                'cu'           => $cu
            ];
        }

        $totalCU2 = ($kilosProdDia > 0) ? round($totalValor2 / $kilosProdDia, 3) : 0.0;

        $detalleCostoUnitario = [
            'filas' => $filasTabla2,
            'total_registros' => count($filasTabla2),
            'totales' => [
                'cantidad'     => round($totalCantidad2, 2),
                'peso'         => round($totalPeso2, 2),
                'valor'        => round($totalValor2, 2),
                'kilosprodacu' => round($kilosProdDia, 2),
                'cu'           => $totalCU2
            ]
        ];

        // 5. OBTENER FILTROS DISPONIBLES (Clasificaciones para la fecha)
        $sqlClasifDisp = "SELECT 
                            TRIM(linea) AS linea, 
                            TRIM(COALESCE(nomlinea, '')) AS nomlinea, 
                            TRIM(CONCAT(TRIM(COALESCE(linea, '')), ' ', TRIM(COALESCE(nomlinea, '')))) AS clasificacion
                          FROM histodatosalmaacucompa
                          WHERE fechahisto = :fec
                          GROUP BY linea, nomlinea
                          ORDER BY 
                            CASE WHEN linea IS NULL OR TRIM(linea) = '' THEN 'ZZZ' ELSE linea END ASC";
        $stmtC = $db->prepare($sqlClasifDisp);
        $stmtC->execute([':fec' => $fechaConsulta]);
        $clasifDisponibles = $stmtC->fetchAll(PDO::FETCH_ASSOC);

        // Formato de fecha para visualización
        $fParts = explode('-', $fechaConsulta);
        $fechaFormateada = (count($fParts) === 3) ? "{$fParts[2]}/{$fParts[1]}/{$fParts[0]}" : $fechaConsulta;

        return [
            'status'                   => 'success',
            'dashboard'                => 'CP04 CostosGeneralesDetalleAlDia',
            'fecha'                    => $fechaConsulta,
            'fecha_formateada'         => $fechaFormateada,
            'fechas_disponibles'       => $fechasDisponibles,
            'filtros_disponibles'      => [
                'clasificaciones' => $clasifDisponibles
            ],
            'resumen_costo_produccion' => $resumenCostoProduccion,
            'detalle_costo_unitario'   => $detalleCostoUnitario
        ];
    }
}
