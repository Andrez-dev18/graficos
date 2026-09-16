<?php

class CA01CostoFormulaPorTipoHandler
{
    /**
     * Procesa y retorna los datos para CA01 CostoFormulaPorTipoAlimento
     */
    public static function handle(PDO $db, array $filtros): array
    {
        try {
            $fechaInicio = !empty($filtros['fecha_inicio']) ? $filtros['fecha_inicio'] : '2026-03-01';
            $fechaFin    = !empty($filtros['fecha_fin']) ? $filtros['fecha_fin'] : '2026-09-30';

            // 1. Obtener puntos para la Gráfica Superior: "Costo Formula Alimento General"
            // Se filtra exactamente por el rango seleccionado de fechas
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
                // Umbral calibrado de Tableau: >= 1.6115 es rojo/coral, < 1.6115 es verde
                $puntosGeneral[] = [
                    'fecha'     => $f,
                    'label'     => self::formatearFechaCorta($f),
                    'tot_valor' => (float)$row['tot_valor'],
                    'tot_peso'  => (float)$row['tot_peso'],
                    'pu'        => round($pu, 4),
                    'color'     => $pu >= 1.6115 ? '#e15759' : '#59a14f'
                ];
            }

            // 2. Obtener TODOS los ítems para la Gráfica Inferior ("Detalle de Tipo de Alimento")
            // Filtrado exactamente por el rango seleccionado de fechas (fecha_inicio a fecha_fin)
            $sqlDetalle = "
                SELECT 
                    fecha,
                    COALESCE(NULLIF(tipo, ''), 'NULL') AS tipo,
                    coditem,
                    nomitem,
                    CONCAT(coditem, ' ', nomitem) AS item_label,
                    SUM(valor) AS tot_valor,
                    SUM(peso) AS tot_peso,
                    (SUM(valor) / NULLIF(SUM(peso), 0)) AS pu
                FROM histcostdiaalim2
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND fecha IS NOT NULL
                  AND coditem IS NOT NULL AND coditem != ''
                GROUP BY coditem, nomitem, tipo, fecha
                ORDER BY coditem ASC, fecha ASC
            ";
            $stmtDet = $db->prepare($sqlDetalle);
            $stmtDet->bindValue(':fecha_inicio', $fechaInicio);
            $stmtDet->bindValue(':fecha_fin', $fechaFin);
            $stmtDet->execute();
            $rowsDet = $stmtDet->fetchAll(PDO::FETCH_ASSOC);

            // Agrupar los registros por ítem
            $itemsAgrupados = [];
            foreach ($rowsDet as $row) {
                $cod = $row['coditem'];
                if (!isset($itemsAgrupados[$cod])) {
                    $itemsAgrupados[$cod] = [
                        'coditem'    => $cod,
                        'nomitem'    => $row['nomitem'],
                        'item_label' => $row['item_label'],
                        'puntos'     => []
                    ];
                }
                $f = $row['fecha'];
                $pu = $row['pu'] !== null ? (float)$row['pu'] : 0.0;
                $itemsAgrupados[$cod]['puntos'][] = [
                    'fecha'     => str_replace('-', '/', $f),
                    'diaSemana' => self::obtenerDiaSemana($f),
                    'tipo'      => $row['tipo'],
                    'tot_valor' => (float)$row['tot_valor'],
                    'tot_peso'  => (float)$row['tot_peso'],
                    'pu'        => round($pu, 4)
                ];
            }

            // Convertir a lista indexada
            $listaItems = array_values($itemsAgrupados);

            return [
                'success'        => true,
                'puntos_general' => $puntosGeneral,
                'items_detalle'  => $listaItems
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error'   => 'Error en CA01CostoFormulaPorTipoHandler: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Devuelve el formato corto de fecha (ej. "27 mar", "1 abr", "12 ago")
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
     * Devuelve el día de la semana en español
     */
    private static function obtenerDiaSemana(string $fecha): string
    {
        $dias = [
            0 => 'domingo',
            1 => 'lunes',
            2 => 'martes',
            3 => 'miércoles',
            4 => 'jueves',
            5 => 'viernes',
            6 => 'sábado'
        ];
        $ts = strtotime($fecha);
        if (!$ts) return '';

        $w = (int)date('w', $ts);
        return $dias[$w] ?? '';
    }
}
