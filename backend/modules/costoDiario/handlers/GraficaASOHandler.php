<?php

class GraficaASOHandler
{
    /**
     * Procesa y retorna los datos para GraficaASO
     * (Tendencia Costo por Kg de Pollo Vivo Sin Factor / Con Factor)
     */
    public static function handle(PDO $db, array $filtros): array
    {
        try {
            $fechaInicio = !empty($filtros['fecha_inicio']) ? $filtros['fecha_inicio'] : '2026-08-01';
            $fechaFin    = !empty($filtros['fecha_fin']) ? $filtros['fecha_fin'] : '2026-08-31';
            $factor      = isset($filtros['factor']) && is_numeric($filtros['factor']) ? (float)$filtros['factor'] : 0.366;

            $sql = "
                SELECT 
                    fechahisto,
                    SUM(valor) AS tot_valor,
                    AVG(comodin) AS avg_comodin,
                    (SUM(valor) / NULLIF(AVG(comodin), 0)) AS cu_diario,
                    ((SUM(valor) / NULLIF(AVG(comodin), 0)) + :factor) AS cu_factor
                FROM histodatosalmaacucompa
                WHERE fechahisto BETWEEN :fecha_inicio AND :fecha_fin
                  AND fechahisto IS NOT NULL
                GROUP BY fechahisto
                ORDER BY fechahisto ASC
            ";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':fecha_inicio', $fechaInicio);
            $stmt->bindValue(':fecha_fin', $fechaFin);
            $stmt->bindValue(':factor', $factor);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $puntos = [];
            $sumCU = 0;
            $sumCUFactor = 0;
            $count = count($rows);

            foreach ($rows as $row) {
                $fh = $row['fechahisto'];
                $cu = $row['cu_diario'] !== null ? (float)$row['cu_diario'] : 0.0;
                $cuFactor = $row['cu_factor'] !== null ? (float)$row['cu_factor'] : 0.0;

                $sumCU += $cu;
                $sumCUFactor += $cuFactor;

                // Color divergente semafórico de Tableau:
                // CU < 4.295 -> Verde (#59a14f)
                // 4.295 <= CU <= 4.315 -> Naranja (#f28e2b)
                // CU > 4.315 -> Rojo (#e15759)
                $colorCU = '#59a14f';
                if ($cu > 4.315) {
                    $colorCU = '#e15759';
                } elseif ($cu >= 4.295) {
                    $colorCU = '#f28e2b';
                }

                $colorFactor = '#59a14f';
                if ($cuFactor > 4.681) {
                    $colorFactor = '#e15759';
                } elseif ($cuFactor >= 4.661) {
                    $colorFactor = '#f28e2b';
                }

                $ts = strtotime($fh);
                $puntos[] = [
                    'fechahisto'   => $fh,
                    'fecha'        => $fh,
                    'label'        => self::formatearFechaCorta($fh),
                    'dia_semana'   => self::obtenerDiaSemanaCorto($fh),
                    'dia'          => $ts ? (int)date('j', $ts) : '',
                    'tot_valor'    => (float)$row['tot_valor'],
                    'avg_comodin'  => (float)$row['avg_comodin'],
                    'cu_diario'    => round($cu, 3),
                    'cu_factor'    => round($cuFactor, 3),
                    'color_cu'     => $colorCU,
                    'color_factor' => $colorFactor
                ];
            }

            return [
                'success'         => true,
                'factor_aplicado' => $factor,
                'puntos'          => $puntos,
                'resumen'         => [
                    'total_dias'          => $count,
                    'promedio_cu'         => $count > 0 ? round($sumCU / $count, 3) : 0,
                    'promedio_cu_factor'  => $count > 0 ? round($sumCUFactor / $count, 3) : 0
                ]
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error'   => 'Error en GraficaASOHandler: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Formato corto de fecha (ej. "1 ago", "15 ago")
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
