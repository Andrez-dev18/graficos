<?php

class CA02CostoFormulaInsumosHandler
{
    /**
     * Procesa y retorna los datos para CA02 CostoFormula-Insumos
     */
    public static function handle(PDO $db, array $filtros): array
    {
        try {
            $fechaInicio = !empty($filtros['fecha_inicio']) ? $filtros['fecha_inicio'] : '2026-07-31';
            $fechaFin    = !empty($filtros['fecha_fin']) ? $filtros['fecha_fin'] : '2026-08-30';

            // Fechas independientes para el gráfico de tendencias (o las mismas por defecto)
            $fechaInicioTendencia = !empty($filtros['fecha_inicio_tendencia']) ? $filtros['fecha_inicio_tendencia'] : $fechaInicio;
            $fechaFinTendencia    = !empty($filtros['fecha_fin_tendencia']) ? $filtros['fecha_fin_tendencia'] : $fechaFin;

            // -------------------------------------------------------------
            // 1. Gráfico Superior: "Costo Formula Alimento General"
            // -------------------------------------------------------------
            $sqlGeneral = "
                SELECT 
                    fecha,
                    SUM(valor) AS tot_valor,
                    SUM(peso) AS tot_peso,
                    (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                FROM histcostdiaalim2
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND fecha IS NOT NULL
                GROUP BY fecha
                ORDER BY fecha ASC
            ";
            $stmtGen = $db->prepare($sqlGeneral);
            $stmtGen->bindValue(':fecha_inicio', $fechaInicio);
            $stmtGen->bindValue(':fecha_fin', $fechaFin);
            $stmtGen->execute();
            $rowsGen = $stmtGen->fetchAll(PDO::FETCH_ASSOC);

            $puntosGeneral = [];
            foreach ($rowsGen as $row) {
                $f = $row['fecha'];
                $pu = $row['pu'] !== null ? (float)$row['pu'] : 0.0;
                $puntosGeneral[] = [
                    'fecha'      => $f,
                    'label'      => self::formatearFechaCorta($f),
                    'dia_semana' => self::obtenerDiaSemanaCorto($f),
                    'tot_valor'  => (float)$row['tot_valor'],
                    'tot_peso'   => (float)$row['tot_peso'],
                    'pu'         => round($pu, 4),
                    'color'      => $pu >= 1.6115 ? '#e15759' : '#59a14f'
                ];
            }

            // -------------------------------------------------------------
            // 2. Tabla Inferior Izquierda: "Detalle de Insumos" (Matriz Insumos vs Fechas)
            // -------------------------------------------------------------
            $sqlDetalle = "
                SELECT 
                    coditem,
                    TRIM(nomitem) AS nomitem,
                    fechahisto AS fecha,
                    SUM(valor) AS tot_valor,
                    SUM(peso) AS tot_peso,
                    (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                FROM histcostdiaalim
                WHERE tipo = 'INSUMO'
                  AND fechahisto BETWEEN :fecha_inicio AND :fecha_fin
                  AND fechahisto IS NOT NULL
                  AND coditem IS NOT NULL AND coditem != ''
                GROUP BY coditem, nomitem, fechahisto
                ORDER BY coditem ASC, fechahisto ASC
            ";
            $stmtDet = $db->prepare($sqlDetalle);
            $stmtDet->bindValue(':fecha_inicio', $fechaInicio);
            $stmtDet->bindValue(':fecha_fin', $fechaFin);
            $stmtDet->execute();
            $rowsDet = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

            // Obtener lista única y ordenada de fechas presentes en el detalle
            $fechasDetalleSet = [];
            $itemsDetalleMap = [];

            foreach ($rowsDet as $row) {
                $f = $row['fecha'];
                $cod = $row['coditem'];
                $fechasDetalleSet[$f] = true;

                if (!isset($itemsDetalleMap[$cod])) {
                    $itemsDetalleMap[$cod] = [
                        'coditem'    => $cod,
                        'nomitem'    => $row['nomitem'],
                        'item_label' => $cod . ' ' . $row['nomitem'],
                        'tot_valor'  => 0.0,
                        'tot_peso'   => 0.0,
                        'valores'    => []
                    ];
                }

                $pu = $row['pu'] !== null ? (float)$row['pu'] : 0.0;
                $v = (float)$row['tot_valor'];
                $p = (float)$row['tot_peso'];

                $itemsDetalleMap[$cod]['tot_valor'] += $v;
                $itemsDetalleMap[$cod]['tot_peso']  += $p;
                $itemsDetalleMap[$cod]['valores'][$f] = [
                    'pu'        => round($pu, 4),
                    'tot_valor' => $v,
                    'tot_peso'  => $p
                ];
            }

            // Ordenar fechas cronológicamente
            $fechasDetalle = array_keys($fechasDetalleSet);
            sort($fechasDetalle);

            $fechasDetalleInfo = [];
            foreach ($fechasDetalle as $fd) {
                $fechasDetalleInfo[] = [
                    'fecha'      => $fd,
                    'label'      => self::formatearFechaCorta($fd),
                    'dia_semana' => self::obtenerDiaSemanaCorto($fd)
                ];
            }

            // Formatear items de la tabla
            $itemsDetalle = [];
            foreach ($itemsDetalleMap as $cod => $item) {
                $totP = $item['tot_peso'];
                $totV = $item['tot_valor'];
                $item['promedio_pu'] = $totP > 0 ? round($totV / $totP, 4) : 0.0;
                $itemsDetalle[] = $item;
            }

            // -------------------------------------------------------------
            // 3. Gráfico Inferior Derecho: "Tendencia de Insumos" (Multi-Líneas)
            // -------------------------------------------------------------
            $sqlTendencia = "
                SELECT 
                    coditem,
                    TRIM(nomitem) AS nomitem,
                    fechahisto,
                    SUM(valor) AS tot_valor,
                    SUM(peso) AS tot_peso,
                    (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                FROM histcostdiaalim
                WHERE tipo = 'INSUMO'
                  AND fecha = fechahisto
                  AND fechahisto BETWEEN :fecha_inicio_tendencia AND :fecha_fin_tendencia
                  AND fechahisto IS NOT NULL
                  AND coditem IS NOT NULL AND coditem != ''
                GROUP BY coditem, nomitem, fechahisto
                ORDER BY coditem ASC, fechahisto ASC
            ";
            $stmtTend = $db->prepare($sqlTendencia);
            $stmtTend->bindValue(':fecha_inicio_tendencia', $fechaInicioTendencia);
            $stmtTend->bindValue(':fecha_fin_tendencia', $fechaFinTendencia);
            $stmtTend->execute();
            $rowsTend = $stmtTend->fetchAll(PDO::FETCH_ASSOC);

            $itemsTendenciaMap = [];
            $fechasTendenciaSet = [];

            foreach ($rowsTend as $row) {
                $fh = $row['fechahisto'];
                $cod = $row['coditem'];
                $fechasTendenciaSet[$fh] = true;

                if (!isset($itemsTendenciaMap[$cod])) {
                    $itemsTendenciaMap[$cod] = [
                        'coditem'    => $cod,
                        'nomitem'    => $row['nomitem'],
                        'item_label' => $cod . ' ' . $row['nomitem'],
                        'puntos'     => []
                    ];
                }

                $pu = $row['pu'] !== null ? (float)$row['pu'] : 0.0;
                $ts = strtotime($fh);
                $itemsTendenciaMap[$cod]['puntos'][] = [
                    'fechahisto' => $fh,
                    'fecha'      => $fh,
                    'dia'        => $ts ? (int)date('j', $ts) : '',
                    'label'      => self::formatearFechaCorta($fh),
                    'dia_semana' => self::obtenerDiaSemanaCorto($fh),
                    'tot_valor'  => (float)$row['tot_valor'],
                    'tot_peso'   => (float)$row['tot_peso'],
                    'pu'         => round($pu, 4)
                ];
            }

            $fechasTendencia = array_keys($fechasTendenciaSet);
            sort($fechasTendencia);

            return [
                'success'           => true,
                'puntos_general'    => $puntosGeneral,
                'detalle_insumos'   => [
                    'fechas' => $fechasDetalleInfo,
                    'items'  => $itemsDetalle
                ],
                'tendencia_insumos' => [
                    'fechas' => $fechasTendencia,
                    'items'  => array_values($itemsTendenciaMap)
                ]
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error'   => 'Error en CA02CostoFormulaInsumosHandler: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Formato corto de fecha (ej. "31 jul", "1 ago", "12 set")
     */
    private static function formatearFechaCorta(string $fecha): string
    {
        $meses = [
            1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr',
            5 => 'may', 6 => 'jun', 7 => 'jul', 8 => 'ago',
            9 => 'set', 10 => 'oct', 11 => 'nov', 12 => 'dic'
        ];
        $ts = strtotime($fecha);
        if (!$ts) return $fecha;

        $dia = (int)date('j', $ts);
        $mes = (int)date('n', $ts);

        return $dia . ' ' . ($meses[$mes] ?? '');
    }

    /**
     * Día de la semana corto en minúsculas (ej. "vie", "sáb", "dom")
     */
    private static function obtenerDiaSemanaCorto(string $fecha): string
    {
        $dias = [
            0 => 'dom',
            1 => 'lun',
            2 => 'mar',
            3 => 'mié',
            4 => 'jue',
            5 => 'vie',
            6 => 'sáb'
        ];
        $ts = strtotime($fecha);
        if (!$ts) return '';

        $w = (int)date('w', $ts);
        return $dias[$w] ?? '';
    }
}
