<?php

class AntenasDashboardHandler
{
    public static function dashboard(PDO $db, array $filtros): array
    {
        [$fechaInicio, $fechaFin] = self::rangoFechas($filtros);
        $pageSizeDias = max(1, min(31, (int)($filtros['page_size_dias'] ?? 7)));
        $page = max(1, (int)($filtros['page'] ?? 1));

        $fechasRango = [];
        $cursor = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);

        while ($cursor <= $fin) {
            $fechasRango[] = $cursor->format('Y-m-d');
            $cursor = $cursor->modify('+1 day');
        }

        $totalDias = count($fechasRango);
        $totalPaginas = $totalDias > 0 ? (int)ceil($totalDias / $pageSizeDias) : 0;
        $page = $totalPaginas > 0 ? min($page, $totalPaginas) : 1;
        $offsetDias = ($page - 1) * $pageSizeDias;
        $fechas = array_slice($fechasRango, $offsetDias, $pageSizeDias);
        $fechaInicioPagina = $fechas[0] ?? $fechaInicio;
        $fechaFinPagina = $fechas[count($fechas) - 1] ?? $fechaFin;

        $sql = "SELECT
                    DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                    HOUR(hora) AS hora,
                    TRIM(granja) AS granja,
                    TRIM(antena) AS antena,
                    TRIM(conexion) AS conexion,
                    COUNT(*) AS total
                FROM antenas
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                GROUP BY
                    DATE_FORMAT(fecha, '%Y-%m-%d'),
                    HOUR(hora),
                    TRIM(granja),
                    TRIM(antena),
                    TRIM(conexion)
                ORDER BY
                    granja ASC,
                    antena ASC,
                    conexion ASC,
                    fecha ASC,
                    hora ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':fecha_inicio' => $fechaInicioPagina,
            ':fecha_fin' => $fechaFinPagina
        ]);

        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $filas = [];
        $indices = [];
        $maxTotal = 0;

        foreach ($raw as $fila) {
            $clave = $fila['granja'] . "\x1F" . $fila['antena'] . "\x1F" . $fila['conexion'];

            if (!isset($indices[$clave])) {
                $indices[$clave] = count($filas);
                $filas[] = [
                    'granja' => (string)$fila['granja'],
                    'antena' => (string)$fila['antena'],
                    'conexion' => (string)$fila['conexion'],
                    'valores' => []
                ];
            }

            $total = (int)$fila['total'];
            $filas[$indices[$clave]]['valores'][$fila['fecha'] . '|' . $fila['hora']] = $total;
            $maxTotal = max($maxTotal, $total);
        }

        $ordenAntena = [
            'Antena Emisora PTP' => 0,
            'Antena Receptora PTP' => 1,
            'Antena Emisora Wifi' => 2
        ];
        $ordenConexion = ['NO' => 0, 'SI' => 1];

        usort($filas, function ($a, $b) use ($ordenAntena, $ordenConexion) {
            $granja = strcmp($a['granja'], $b['granja']);
            if ($granja !== 0) return $granja;

            $antenaA = $ordenAntena[$a['antena']] ?? 99;
            $antenaB = $ordenAntena[$b['antena']] ?? 99;
            if ($antenaA !== $antenaB) return $antenaA <=> $antenaB;

            $conexionA = $ordenConexion[$a['conexion']] ?? 99;
            $conexionB = $ordenConexion[$b['conexion']] ?? 99;
            return $conexionA <=> $conexionB;
        });

        return [
            'status' => 'success',
            'tipo_grafico' => 'ConectividadAntenas',
            'filtros' => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin
            ],
            'fechas' => $fechas,
            'horas' => range(0, 23),
            'filas' => $filas,
            'max_total' => $maxTotal,
            'total_registros' => array_sum(array_map(function ($fila) {
                return array_sum($fila['valores']);
            }, $filas)),
            'page' => $page,
            'page_size_dias' => $pageSizeDias,
            'total_dias' => $totalDias,
            'total_paginas' => $totalPaginas
        ];
    }

    private static function rangoFechas(array $filtros): array
    {
        $fechaInicio = self::fecha($filtros['fecha_inicio'] ?? null, date('Y-m-d', strtotime('-7 days')));
        $fechaFin = self::fecha($filtros['fecha_fin'] ?? null, date('Y-m-d'));

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        return [$fechaInicio, $fechaFin];
    }

    private static function fecha($valor, string $defecto): string
    {
        $valor = trim((string)($valor ?? ''));
        if ($valor === '') {
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('Y-m-d', $valor);
        return $fecha && $fecha->format('Y-m-d') === $valor ? $valor : $defecto;
    }
}
