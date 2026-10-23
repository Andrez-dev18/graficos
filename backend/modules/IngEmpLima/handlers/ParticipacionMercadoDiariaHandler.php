<?php

class ParticipacionMercadoDiariaHandler
{
    private static $diasSemana = [
        0 => 'domingo',
        1 => 'lunes',
        2 => 'martes',
        3 => 'miércoles',
        4 => 'jueves',
        5 => 'viernes',
        6 => 'sábado'
    ];

    public static function obtenerFiltros(PDO $db): array
    {
        $sqlRango = "
            SELECT 
                MIN(a.fecha) AS fecha_min,
                MAX(a.fecha) AS fecha_max
            FROM com_db_ingre_emp_lima a
            WHERE a.unidad_fija > 0
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;

        $sqlEmpresas = "
            SELECT DISTINCT 
                TRIM(e.nombre) AS nombre
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE e.nombre IS NOT NULL 
              AND TRIM(e.nombre) <> ''
              AND a.unidad_fija > 0
            ORDER BY nombre ASC
        ";
        $stmtEmpresas = $db->query($sqlEmpresas);
        $empresas = [];

        foreach ($stmtEmpresas->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $empresas[] = [
                    'id'    => $nombre,
                    'label' => $nombre
                ];
            }
        }

        $empresasDefault = array_column($empresas, 'id');

        $fechaInicioDefault = null;
        $fechaFinDefault = null;

        if ($fechaMax) {
            $fechaFinDefault = $fechaMax;
            $maxDt = new DateTimeImmutable($fechaMax);
            $inicioDt = $maxDt->modify('-2 months')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');
            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        return [
            'tipo_grafico'          => 'ParticipacionMercadoDiaria',
            'titulo'                => 'Participacion del Mercado Diaria',
            'fecha_min'             => $fechaMin,
            'fecha_max'             => $fechaMax,
            'fecha_inicio_default'  => $fechaInicioDefault,
            'fecha_fin_default'     => $fechaFinDefault,
            'empresas'              => $empresas,
            'empresas_default'      => $empresasDefault
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = self::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_inicio_default'] ?? $opciones['fecha_min'] ?? '')
        );
        $fechaFin = self::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_fin_default'] ?? $opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $empresasSeleccionadas = self::normalizarSeleccion(
            array_key_exists('empresas', $filtros) ? $filtros['empresas'] : $opciones['empresas_default'],
            $opciones['empresas']
        );

        $fechas = self::construirFechas($fechaInicio, $fechaFin);

        $respuestaBase = [
            'tipo_grafico'    => 'ParticipacionMercadoDiaria',
            'titulo'          => 'Participacion del Mercado Diaria',
            'subtitulo'       => 'Día de fecha',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'fechas'          => $fechas,
            'series'          => [],
            'total_registros' => 0
        ];

        if (empty($empresasSeleccionadas) || empty($fechas)) {
            return $respuestaBase;
        }

        $placeholders = implode(',', array_fill(0, count($empresasSeleccionadas), '?'));

        $sql = "
            SELECT
                DATE(a.fecha) AS fecha,
                TRIM(e.nombre) AS empresa,
                SUM(a.unidad_fija) AS unidad_fija
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND TRIM(e.nombre) IN ($placeholders)
              AND a.unidad_fija > 0
            GROUP BY DATE(a.fecha), TRIM(e.nombre)
            ORDER BY fecha ASC, empresa ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $empresasSeleccionadas);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($filas)) {
            return $respuestaBase;
        }

        $porFecha = [];
        $empresasConDatos = [];

        foreach ($filas as $fila) {
            $fecha = (string)($fila['fecha'] ?? '');
            $empresa = trim((string)($fila['empresa'] ?? ''));
            $unidadFija = (float)($fila['unidad_fija'] ?? 0);

            if ($fecha === '' || $empresa === '') {
                continue;
            }

            if (!isset($porFecha[$fecha])) {
                $porFecha[$fecha] = [];
            }

            $porFecha[$fecha][$empresa] = $unidadFija;
            $empresasConDatos[$empresa] = true;
        }

        $totalPorFecha = [];
        foreach ($porFecha as $fecha => $valoresEmpresa) {
            $totalPorFecha[$fecha] = array_sum($valoresEmpresa);
        }

        $ordenEmpresas = array_values(array_filter($empresasSeleccionadas, function ($item) use ($empresasConDatos) {
            return isset($empresasConDatos[$item]);
        }));

        $series = [];
        foreach ($ordenEmpresas as $empresa) {
            $valores = [];

            foreach ($fechas as $fechaObj) {
                $fechaKey = $fechaObj['fecha'];
                $totalDia = $totalPorFecha[$fechaKey] ?? 0.0;

                // Si en todo el mercado no hubo registros este día, no hay base para calcular
                if ($totalDia <= 0) {
                    $valores[] = null;
                    continue;
                }

                // Si hubo mercado este día, la empresa que no vendió cae al 0% (sin cortar la línea)
                $unidadFija = (float)($porFecha[$fechaKey][$empresa] ?? 0.0);
                $porcentaje = round(($unidadFija / $totalDia) * 100, 4);

                $valores[] = [
                    'porcentaje'  => $porcentaje,
                    'unidad_fija' => round($unidadFija, 2),
                    'total_dia'   => round($totalDia, 2)
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

    private static function construirFechas(string $fechaInicio, string $fechaFin): array
    {
        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);
        $cursor = $inicio;
        $fechas = [];

        while ($cursor <= $fin) {
            $diaSemana = (int)$cursor->format('w');
            $fechas[] = [
                'fecha'     => $cursor->format('Y-m-d'),
                'label'     => $cursor->format('Y/m/d'),
                'dia_texto' => self::$diasSemana[$diaSemana] ?? ''
            ];
            $cursor = $cursor->modify('+1 day');
        }

        return $fechas;
    }

    public static function normalizarSeleccion($valor, array $disponibles): array
    {
        if ($valor === null) {
            return [];
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $seleccionados = [];
        foreach ($valor as $item) {
            $nombre = trim((string)$item);
            if ($nombre !== '') {
                $seleccionados[$nombre] = true;
            }
        }

        $resultado = [];
        foreach ($disponibles as $opcion) {
            $id = (string)($opcion['id'] ?? '');
            if ($id !== '' && isset($seleccionados[$id])) {
                $resultado[] = $id;
            }
        }

        return $resultado;
    }

    public static function resolverFecha($valor, string $defecto): string
    {
        $valor = trim((string)$valor);

        if ($valor === '') {
            if ($defecto === '') {
                throw new InvalidArgumentException('Debes indicar un rango de fechas.');
            }
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            throw new InvalidArgumentException('Fecha inválida: ' . $valor);
        }

        return $valor;
    }
}
