<?php

require_once __DIR__ . '/EmpresaChartHelper.php';

class ParticipacionMercadoHandler
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

    private static function configuracion(string $familia): array
    {
        $configuraciones = [
            'AQP' => [
                'familia' => 'AQP',
                'tipo_grafico' => 'ParticipacionMercadoAQP',
                'titulo' => 'Participación de Mercado AQP',
                'etiqueta_serie' => 'NomEmpresa',
                'etiqueta_leyenda' => 'EMPRESAS',
                'from' => "com_db_vivo_aqp a
                    INNER JOIN com_mercado m   ON a.mercado   = m.codigo
                    INNER JOIN com_empresa e   ON a.empresa   = e.codigo
                    INNER JOIN com_condicion c ON a.condicion = c.codigo
                    INNER JOIN com_proveedor p ON a.proveedor = p.codigo",
                'where_extra' => '',
                'dimension' => 'TRIM(e.nombre)',
                'filtros' => [
                    'empresas' => [
                        'columna' => 'TRIM(e.nombre)'
                    ]
                ]
            ],
            'PROV' => [
                'familia' => 'PROV',
                'tipo_grafico' => 'ParticipacionMercadoPROV',
                'titulo' => 'Participación de Mercado PROV',
                'etiqueta_serie' => 'NomProveedor',
                'etiqueta_leyenda' => 'PROVEEDORES',
                'from' => "com_db_vivo_provincia a
                    INNER JOIN com_proveedor p ON a.proveedor = p.codigo
                    INNER JOIN com_provincia pr ON a.provincia = pr.codigo
                    INNER JOIN com_tipo t       ON a.tipo      = t.codigo",
                'where_extra' => '',
                'dimension' => 'TRIM(p.nombre)',
                'filtros' => [
                    'provincias' => [
                        'columna' => 'TRIM(pr.nombre)'
                    ],
                    'proveedores' => [
                        'columna' => 'TRIM(p.nombre)'
                    ]
                ]
            ]
        ];

        return $configuraciones[$familia];
    }

    private static function resolverFecha($valor, string $defecto): string
    {
        $valor = trim((string)$valor);

        if ($valor === '') {
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            throw new InvalidArgumentException('Fecha inválida: ' . $valor);
        }

        return $valor;
    }

    private static function rangoPorDefecto(): array
    {
        $hoy = new DateTimeImmutable('now');
        $inicio = $hoy->modify('first day of previous month');
        $fin = $hoy->modify('last day of this month');

        return [
            $inicio->format('Y-m-d'),
            $fin->format('Y-m-d')
        ];
    }

    private static function construirFechas(string $fechaInicio, string $fechaFin): array
    {
        $desde = new DateTimeImmutable($fechaInicio);
        $hasta = new DateTimeImmutable($fechaFin);
        $fechas = [];

        $cursor = $desde;
        while ($cursor <= $hasta) {
            $fechas[] = [
                'fecha' => $cursor->format('Y-m-d'),
                'label' => $cursor->format('Y/m/d') . ', ' . self::$diasSemana[(int)$cursor->format('w')]
            ];
            $cursor = $cursor->modify('+1 day');
        }

        return $fechas;
    }

    private static function obtenerOpcionesRango(
        PDO $db,
        array $config,
        string $fechaInicio,
        string $fechaFin
    ): array {
        $extra = $config['where_extra'] !== '' ? ' AND ' . $config['where_extra'] : '';
        $opciones = [];

        foreach ($config['filtros'] as $clave => $filtro) {
            $columna = $filtro['columna'];
            $sql = "
                SELECT DISTINCT {$columna} AS nombre
                FROM {$config['from']}
                WHERE a.fecha >= ?
                  AND a.fecha <= ?
                  {$extra}
                  AND {$columna} IS NOT NULL
                  AND {$columna} <> ''
                ORDER BY nombre ASC
            ";

            $stmt = $db->prepare($sql);
            $stmt->execute([$fechaInicio, $fechaFin]);

            $opciones[$clave] = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
                $nombre = trim((string)($fila['nombre'] ?? ''));
                if ($nombre !== '') {
                    $opciones[$clave][] = [
                        'id' => $nombre,
                        'label' => $nombre
                    ];
                }
            }
        }

        return $opciones;
    }

    private static function obtenerOpciones(PDO $db, array $config, string $anio): array
    {
        [$fechaInicio, $fechaFin] = EmpresaChartHelper::rangoAnio($anio);
        $fechaFin = (new DateTimeImmutable($fechaFin))->modify('-1 day')->format('Y-m-d');

        return self::obtenerOpcionesRango($db, $config, $fechaInicio, $fechaFin);
    }

    private static function construirFiltrosBase(
        PDO $db,
        array $config,
        string $anio,
        string $fechaInicio,
        string $fechaFin
    ): array {
        $opciones = self::obtenerOpcionesRango($db, $config, $fechaInicio, $fechaFin);

        $respuesta = [
            'anio' => $anio,
            'titulo' => $config['titulo'],
            'etiqueta_serie' => $config['etiqueta_serie'],
            'etiqueta_leyenda' => $config['etiqueta_leyenda'],
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin
        ];

        foreach ($opciones as $clave => $lista) {
            $respuesta[$clave] = $lista;
        }

        return $respuesta;
    }

    private static function construirFiltros(PDO $db, array $config, string $anio): array
    {
        [$fechaInicio, $fechaFin] = EmpresaChartHelper::rangoAnio($anio);
        $fechaFin = (new DateTimeImmutable($fechaFin))->modify('-1 day')->format('Y-m-d');

        return self::construirFiltrosBase($db, $config, $anio, $fechaInicio, $fechaFin);
    }

    private static function construirFiltrosRango(
        PDO $db,
        array $config,
        string $anio,
        string $fechaInicio,
        string $fechaFin
    ): array {
        $fechaInicio = self::resolverFecha($fechaInicio, '');
        $fechaFin = self::resolverFecha($fechaFin, '');

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        return self::construirFiltrosBase($db, $config, $anio, $fechaInicio, $fechaFin);
    }

    private static function periodoProv(PDO $db, string $anio): array
    {
        [$fechaInicioAnio, $fechaFinAnio] = EmpresaChartHelper::rangoAnio($anio);

        $sqlProvincia = "
            SELECT MAX(a.fecha) AS fecha_max
            FROM com_db_vivo_provincia a
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            INNER JOIN com_tipo t       ON a.tipo      = t.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
              AND TRIM(t.nombre) = 'Vivo'
              AND TRIM(pr.nombre) = 'ILO'
        ";

        $stmt = $db->prepare($sqlProvincia);
        $stmt->execute([$fechaInicioAnio, $fechaFinAnio]);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);
        $fechaMaxima = trim((string)($fila['fecha_max'] ?? ''));

        if ($fechaMaxima === '') {
            $sqlGeneral = "
                SELECT MAX(a.fecha) AS fecha_max
                FROM com_db_vivo_provincia a
                INNER JOIN com_tipo t ON a.tipo = t.codigo
                WHERE a.fecha >= ?
                  AND a.fecha < ?
                  AND TRIM(t.nombre) = 'Vivo'
            ";

            $stmt = $db->prepare($sqlGeneral);
            $stmt->execute([$fechaInicioAnio, $fechaFinAnio]);
            $fila = $stmt->fetch(PDO::FETCH_ASSOC);
            $fechaMaxima = trim((string)($fila['fecha_max'] ?? ''));
        }

        if ($fechaMaxima === '') {
            [$fechaInicioDefecto, $fechaFinDefecto] = self::rangoPorDefecto();
            $inicio = new DateTimeImmutable($fechaInicioDefecto);
            $fin = new DateTimeImmutable($fechaFinDefecto);

            return [
                'modo' => 'entre_meses',
                'mes_inicio' => $inicio->format('Y-m'),
                'mes_fin' => $fin->format('Y-m'),
                'fecha_inicio' => $inicio->format('Y-m-01'),
                'fecha_fin' => $fin->format('Y-m-t')
            ];
        }

        $fechaMaxima = substr($fechaMaxima, 0, 10);
        $fin = new DateTimeImmutable($fechaMaxima);
        $fin = $fin->modify('first day of this month');
        $inicio = $fin->modify('-1 month');
        $inicioAnio = new DateTimeImmutable($anio . '-01-01');

        if ($inicio < $inicioAnio) {
            $inicio = $inicioAnio;
        }

        return [
            'modo' => 'entre_meses',
            'mes_inicio' => $inicio->format('Y-m'),
            'mes_fin' => $fin->format('Y-m'),
            'fecha_inicio' => $inicio->format('Y-m-01'),
            'fecha_fin' => $fin->format('Y-m-t')
        ];
    }

    private static function construirParticipacion(PDO $db, array $config, array $filtros, string $anio): array
    {
        [$fechaInicioDefecto, $fechaFinDefecto] = self::rangoPorDefecto();
        $fechaInicio = self::resolverFecha($filtros['fecha_inicio'] ?? '', $fechaInicioDefecto);
        $fechaFin = self::resolverFecha($filtros['fecha_fin'] ?? '', $fechaFinDefecto);

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $opciones = self::obtenerOpcionesRango($db, $config, $fechaInicio, $fechaFin);
        $seleccionados = [];

        foreach ($config['filtros'] as $clave => $filtro) {
            $seleccionados[$clave] = EmpresaChartHelper::normalizarNombres(
                array_key_exists($clave, $filtros) ? $filtros[$clave] : null,
                $opciones[$clave] ?? []
            );
        }

        $fechas = self::construirFechas($fechaInicio, $fechaFin);

        $respuesta = [
            'tipo_grafico' => $config['tipo_grafico'],
            'titulo' => $config['titulo'],
            'familia' => $config['familia'],
            'etiqueta_serie' => $config['etiqueta_serie'],
            'etiqueta_leyenda' => $config['etiqueta_leyenda'],
            'anio' => $anio,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'fechas' => $fechas,
            'series' => [],
            'total_registros' => 0
        ];

        $where = [
            'a.fecha >= ?',
            'a.fecha <= ?'
        ];
        $params = [$fechaInicio, $fechaFin];

        if ($config['where_extra'] !== '') {
            $where[] = $config['where_extra'];
        }

        foreach ($config['filtros'] as $clave => $filtro) {
            $valores = $seleccionados[$clave] ?? [];

            if (empty($valores)) {
                return $respuesta;
            }

            $placeholders = implode(',', array_fill(0, count($valores), '?'));
            $where[] = "{$filtro['columna']} IN ($placeholders)";
            $params = array_merge($params, $valores);
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                DATE(a.fecha) AS fecha,
                {$config['dimension']} AS nombre,
                SUM(a.cantidad) AS cantidad
            FROM {$config['from']}
            WHERE {$whereSql}
            GROUP BY DATE(a.fecha), {$config['dimension']}
            ORDER BY fecha ASC, nombre ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $porFecha = [];
        $nombresConDatos = [];

        foreach ($filas as $fila) {
            $fecha = (string)($fila['fecha'] ?? '');
            $nombre = trim((string)($fila['nombre'] ?? ''));

            if ($fecha === '' || $nombre === '') {
                continue;
            }

            if (!isset($porFecha[$fecha])) {
                $porFecha[$fecha] = [];
            }

            $porFecha[$fecha][$nombre] = (float)($fila['cantidad'] ?? 0);
            $nombresConDatos[$nombre] = $nombre;
        }

        $totalPorFecha = [];
        foreach ($porFecha as $fecha => $valoresNombre) {
            $totalPorFecha[$fecha] = array_sum($valoresNombre);
        }

        $nombresOrdenados = array_values($nombresConDatos);
        sort($nombresOrdenados, SORT_NATURAL | SORT_FLAG_CASE);

        $series = [];
        foreach ($nombresOrdenados as $nombre) {
            $valores = [];

            foreach ($fechas as $fechaInfo) {
                $fecha = $fechaInfo['fecha'];
                $cantidad = $porFecha[$fecha][$nombre] ?? null;
                $total = $totalPorFecha[$fecha] ?? 0.0;

                if ($cantidad === null || $total <= 0) {
                    $valores[] = null;
                    continue;
                }

                $valores[] = [
                    'porcentaje' => round(($cantidad / $total) * 100, 6),
                    'cantidad' => round($cantidad, 2)
                ];
            }

            $serie = [
                'nombre' => $nombre,
                'label' => $nombre,
                'valores' => $valores
            ];

            if ($config['familia'] === 'AQP') {
                $serie['empresa'] = $nombre;
            } else {
                $serie['proveedor'] = $nombre;
            }

            $series[] = $serie;
        }

        $respuesta['series'] = $series;
        $respuesta['total_registros'] = count($filas);

        return $respuesta;
    }

    public static function obtenerFiltros(PDO $db, string $anio = '2026'): array
    {
        return self::construirFiltros($db, self::configuracion('AQP'), $anio);
    }

    public static function handle(PDO $db, array $filtros, string $anio = '2026'): array
    {
        return self::construirParticipacion($db, self::configuracion('AQP'), $filtros, $anio);
    }

    public static function obtenerFiltrosProv(PDO $db, string $anio = '2026'): array
    {
        $respuesta = self::construirFiltros($db, self::configuracion('PROV'), $anio);
        $respuesta['periodo_sugerido'] = self::periodoProv($db, $anio);

        return $respuesta;
    }

    public static function handleProv(PDO $db, array $filtros, string $anio = '2026'): array
    {
        return self::construirParticipacion($db, self::configuracion('PROV'), $filtros, $anio);
    }

    public static function obtenerFiltrosRango(
        PDO $db,
        string $fechaInicio,
        string $fechaFin,
        string $anio = '2026'
    ): array {
        return self::construirFiltrosRango(
            $db,
            self::configuracion('AQP'),
            $anio,
            $fechaInicio,
            $fechaFin
        );
    }

    public static function obtenerFiltrosProvRango(
        PDO $db,
        string $fechaInicio,
        string $fechaFin,
        string $anio = '2026'
    ): array {
        return self::construirFiltrosRango(
            $db,
            self::configuracion('PROV'),
            $anio,
            $fechaInicio,
            $fechaFin
        );
    }
}
