<?php

require_once __DIR__ . '/ParticipacionMercadoDiariaHandler.php';

class ParticipacionMercadoSemanalHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        $filtros = ParticipacionMercadoDiariaHandler::obtenerFiltros($db);
        $filtros['tipo_grafico'] = 'ParticipacionMercadoSemanal';
        $filtros['titulo'] = 'Participacion del Mercado Semanal';

        return $filtros;
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_inicio_default'] ?? $opciones['fecha_min'] ?? '')
        );
        $fechaFin = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_fin_default'] ?? $opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $empresasSeleccionadas = ParticipacionMercadoDiariaHandler::normalizarSeleccion(
            array_key_exists('empresas', $filtros) ? $filtros['empresas'] : $opciones['empresas_default'],
            $opciones['empresas']
        );

        $semanas = self::construirSemanas($fechaInicio, $fechaFin);

        $respuestaBase = [
            'tipo_grafico'    => 'ParticipacionMercadoSemanal',
            'titulo'          => 'Participacion del Mercado Semanal',
            'subtitulo'       => 'Semana de fecha',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'semanas'         => $semanas,
            'series'          => [],
            'total_registros' => 0
        ];

        if (empty($empresasSeleccionadas) || empty($semanas)) {
            return $respuestaBase;
        }

        $placeholders = implode(',', array_fill(0, count($empresasSeleccionadas), '?'));

        $sql = "
            SELECT
                YEAR(a.fecha) AS anio,
                WEEK(a.fecha, 1) AS semana,
                TRIM(e.nombre) AS empresa,
                SUM(a.unidad_fija) AS unidad_fija
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND TRIM(e.nombre) IN ($placeholders)
              AND a.unidad_fija > 0
            GROUP BY YEAR(a.fecha), WEEK(a.fecha, 1), TRIM(e.nombre)
            ORDER BY anio ASC, semana ASC, empresa ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $empresasSeleccionadas);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($filas)) {
            return $respuestaBase;
        }

        $porSemana = [];
        $empresasConDatos = [];

        foreach ($filas as $fila) {
            $anio = (int)($fila['anio'] ?? 0);
            $semana = (int)($fila['semana'] ?? 0);
            $empresa = trim((string)($fila['empresa'] ?? ''));
            $unidadFija = (float)($fila['unidad_fija'] ?? 0);

            if ($anio <= 0 || $semana <= 0 || $empresa === '') {
                continue;
            }

            $key = sprintf('%d-%02d', $anio, $semana);

            if (!isset($porSemana[$key])) {
                $porSemana[$key] = [];
            }

            $porSemana[$key][$empresa] = $unidadFija;
            $empresasConDatos[$empresa] = true;
        }

        $totalPorSemana = [];
        foreach ($porSemana as $key => $valoresEmpresa) {
            $totalPorSemana[$key] = array_sum($valoresEmpresa);
        }

        $ordenEmpresas = array_values(array_filter($empresasSeleccionadas, function ($item) use ($empresasConDatos) {
            return isset($empresasConDatos[$item]);
        }));

        $series = [];
        foreach ($ordenEmpresas as $empresa) {
            $valores = [];

            foreach ($semanas as $semObj) {
                $semKey = $semObj['key'];
                $totalSem = $totalPorSemana[$semKey] ?? 0.0;

                if ($totalSem <= 0) {
                    $valores[] = null;
                    continue;
                }

                $unidadFija = (float)($porSemana[$semKey][$empresa] ?? 0.0);
                $porcentaje = round(($unidadFija / $totalSem) * 100, 4);

                $valores[] = [
                    'porcentaje'  => $porcentaje,
                    'unidad_fija' => round($unidadFija, 2),
                    'total_sem'   => round($totalSem, 2)
                ];
            }

            $series[] = [
                'empresa' => $empresa,
                'label'   => $empresa,
                'valores' => $valores
            ];
        }

        $respuestaBase['series'] = $series;
        $respuestaBase['total_registros'] = count($filas);

        return $respuestaBase;
    }

    private static function construirSemanas(string $fechaInicio, string $fechaFin): array
    {
        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);
        $cursor = $inicio;
        $semanasMap = [];

        while ($cursor <= $fin) {
            $anio = (int)$cursor->format('Y');
            $semana = (int)$cursor->format('W'); // Semana ISO 1-53
            $key = sprintf('%d-%02d', $anio, $semana);

            if (!isset($semanasMap[$key])) {
                $semanasMap[$key] = [
                    'key'    => $key,
                    'anio'   => $anio,
                    'semana' => $semana,
                    'label'  => sprintf('%d S%02d', $anio, $semana)
                ];
            }

            $cursor = $cursor->modify('+1 day');
        }

        $semanas = array_values($semanasMap);
        usort($semanas, function ($a, $b) {
            if ($a['anio'] === $b['anio']) {
                return $a['semana'] <=> $b['semana'];
            }
            return $a['anio'] <=> $b['anio'];
        });

        return $semanas;
    }
}
