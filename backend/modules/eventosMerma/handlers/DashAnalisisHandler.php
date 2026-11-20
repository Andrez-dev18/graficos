<?php

class DashAnalisisHandler
{
    private const PAGE_SIZE_DEFAULT = 50;
    private const PAGE_SIZE_MAX = 200;

    public static function filtros(PDO $db): array
    {
        $procesos = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(proceso) AS valor
             FROM dmagentescausalesmermas
             WHERE TRIM(IFNULL(proceso, '')) <> ''
             ORDER BY valor ASC"
        );

        $areas = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(area) AS valor
             FROM dmagentescausalesmermas
             WHERE TRIM(IFNULL(area, '')) <> ''
             ORDER BY valor ASC"
        );

        $clientes = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(cliente) AS valor
             FROM dmagentescausalesmermas
             WHERE TRIM(IFNULL(cliente, '')) <> ''
             ORDER BY valor ASC"
        );

        $rango = self::consultaFila(
            $db,
            "SELECT
                DATE_FORMAT(MIN(fechaproceso), '%Y-%m-%d') AS fecha_min,
                DATE_FORMAT(MAX(fechaproceso), '%Y-%m-%d') AS fecha_max
             FROM dmagentescausalesmermas
             WHERE fechaproceso IS NOT NULL
               AND fechaproceso <> '0000-00-00'"
        );

        return [
            'procesos' => array_values($procesos),
            'areas' => array_values($areas),
            'clientes' => array_values($clientes),
            'fecha_min' => $rango['fecha_min'] ?? null,
            'fecha_max' => $rango['fecha_max'] ?? null
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereBase($filtros);
        $pareto = self::consultarPareto($db, $where, $params);
        $listado = self::consultarListado($db, $where, $params, $filtros);

        return [
            'status' => 'success',
            'tipo_grafico' => 'DashAnalisis',
            'filtros' => self::filtrosAplicados($filtros),
            'pareto' => $pareto,
            'listado' => $listado,
            'opciones' => self::filtros($db)
        ];
    }

    public static function listado(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereBase($filtros);

        return [
            'status' => 'success',
            'tipo_grafico' => 'DashAnalisis',
            'filtros' => self::filtrosAplicados($filtros),
            'listado' => self::consultarListado($db, $where, $params, $filtros)
        ];
    }

    public static function porc(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereBase($filtros);

        $sql = "SELECT
                    TRIM(cliente) AS cliente,
                    TRIM(area) AS area,
                    TRIM(codigoconta) AS codigoconta,
                    TRIM(causatipo) AS causatipo,
                    COUNT(*) AS registros
                FROM dmagentescausalesmermas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    TRIM(cliente),
                    TRIM(area),
                    TRIM(codigoconta),
                    TRIM(causatipo)
                ORDER BY
                    cliente ASC,
                    area ASC,
                    codigoconta ASC,
                    causatipo ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totales = [];
        foreach ($raw as $fila) {
            $cliente = (string)($fila['cliente'] ?? '');
            $totales[$cliente] = ($totales[$cliente] ?? 0) + (int)$fila['registros'];
        }

        $filas = [];
        $totalRegistros = 0;

        foreach ($raw as $indice => $fila) {
            $cliente = (string)($fila['cliente'] ?? '');
            $registros = (int)$fila['registros'];
            $totalCliente = $totales[$cliente] ?? 0;

            $totalRegistros += $registros;
            $filas[] = [
                'tipo' => 'detalle',
                'cliente' => $cliente,
                'area' => (string)($fila['area'] ?? ''),
                'codigoconta' => (string)($fila['codigoconta'] ?? ''),
                'causatipo' => (string)($fila['causatipo'] ?? ''),
                'registros' => $registros,
                'total_cliente' => $totalCliente,
                'porcentaje' => $totalCliente > 0 ? round($registros / $totalCliente, 6) : 0
            ];

            $siguiente = $raw[$indice + 1] ?? null;
            if (!$siguiente || (string)($siguiente['cliente'] ?? '') !== $cliente) {
                $filas[] = [
                    'tipo' => 'total',
                    'cliente' => $cliente,
                    'area' => '',
                    'codigoconta' => '',
                    'causatipo' => 'Total',
                    'registros' => $totalCliente,
                    'total_cliente' => $totalCliente,
                    'porcentaje' => 1
                ];
            }
        }

        return [
            'status' => 'success',
            'tipo_grafico' => 'Porc',
            'filtros' => self::filtrosAplicados($filtros),
            'filas' => $filas,
            'total_registros' => $totalRegistros,
            'total_clientes' => count($totales),
            'opciones' => self::filtros($db)
        ];
    }

    public static function porcDia(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereBase($filtros);

        $sql = "SELECT
                    TRIM(cliente) AS cliente,
                    TRIM(area) AS area,
                    TRIM(codigoconta) AS codigoconta,
                    TRIM(causatipo) AS causatipo,
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    COUNT(*) AS registros
                FROM dmagentescausalesmermas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    TRIM(cliente),
                    TRIM(area),
                    TRIM(codigoconta),
                    TRIM(causatipo),
                    fechaproceso
                ORDER BY
                    cliente ASC,
                    area ASC,
                    codigoconta ASC,
                    causatipo ASC,
                    fechaproceso ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $fechas = [];
        $totalesClienteDia = [];
        $maxRegistros = 0;
        $totalRegistros = 0;

        foreach ($raw as $fila) {
            $cliente = (string)($fila['cliente'] ?? '');
            $fecha = (string)($fila['fecha'] ?? '');
            $registros = (int)($fila['registros'] ?? 0);

            $fechas[$fecha] = true;
            $totalesClienteDia[$cliente][$fecha] = ($totalesClienteDia[$cliente][$fecha] ?? 0) + $registros;
            $maxRegistros = max($maxRegistros, $registros);
            $totalRegistros += $registros;
        }

        foreach ($totalesClienteDia as $cliente => $totales) {
            $maxRegistros = max($maxRegistros, ...array_values($totales));
        }

        $listaFechas = array_keys($fechas);
        sort($listaFechas);

        $filas = [];
        $detalleActual = null;
        $claveActual = '';

        foreach ($raw as $indice => $fila) {
            $cliente = (string)($fila['cliente'] ?? '');
            $fecha = (string)($fila['fecha'] ?? '');
            $registros = (int)($fila['registros'] ?? 0);
            $totalClienteDia = $totalesClienteDia[$cliente][$fecha] ?? 0;
            $clave = implode("\x1F", [
                $cliente,
                (string)($fila['area'] ?? ''),
                (string)($fila['codigoconta'] ?? ''),
                (string)($fila['causatipo'] ?? '')
            ]);

            if ($detalleActual === null || $clave !== $claveActual) {
                if ($detalleActual !== null) {
                    $filas[] = $detalleActual;
                }

                $detalleActual = [
                    'tipo' => 'detalle',
                    'cliente' => $cliente,
                    'area' => (string)($fila['area'] ?? ''),
                    'codigoconta' => (string)($fila['codigoconta'] ?? ''),
                    'causatipo' => (string)($fila['causatipo'] ?? ''),
                    'valores' => []
                ];
                $claveActual = $clave;
            }

            $detalleActual['valores'][$fecha] = [
                'registros' => $registros,
                'porcentaje' => $totalClienteDia > 0 ? round($registros / $totalClienteDia, 6) : 0
            ];

            $siguiente = $raw[$indice + 1] ?? null;
            if (!$siguiente || (string)($siguiente['cliente'] ?? '') !== $cliente) {
                $filas[] = $detalleActual;
                $detalleActual = null;
                $claveActual = '';

                $valoresTotal = [];

                foreach ($totalesClienteDia[$cliente] ?? [] as $fechaTotal => $registrosTotal) {
                    $valoresTotal[$fechaTotal] = [
                        'registros' => (int)$registrosTotal,
                        'porcentaje' => 1
                    ];
                }

                $filas[] = [
                    'tipo' => 'total',
                    'cliente' => $cliente,
                    'area' => '',
                    'codigoconta' => '',
                    'causatipo' => 'Total',
                    'valores' => $valoresTotal
                ];
            }
        }

        return [
            'status' => 'success',
            'tipo_grafico' => 'PorcDia',
            'filtros' => self::filtrosAplicados($filtros),
            'fechas' => $listaFechas,
            'filas' => $filas,
            'total_registros' => $totalRegistros,
            'total_clientes' => count($totalesClienteDia),
            'max_registros' => $maxRegistros,
            'opciones' => self::filtros($db)
        ];
    }

    public static function pareto(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereBase($filtros);
        $pareto = self::consultarPareto($db, $where, $params);
        $totalRegistros = 0;

        foreach ($pareto as $fila) {
            $totalRegistros += (int)($fila['registros'] ?? 0);
        }

        return [
            'status' => 'success',
            'tipo_grafico' => 'Pareto',
            'filtros' => self::filtrosAplicados($filtros),
            'pareto' => $pareto,
            'total_grupos' => count($pareto),
            'total_registros' => $totalRegistros,
            'opciones' => self::filtros($db)
        ];
    }

    public static function cantDia(PDO $db, array $filtros): array
    {
        $datos = self::porcDia($db, $filtros);
        $filas = [];

        foreach ($datos['filas'] as $fila) {
            $valores = [];

            foreach ($fila['valores'] as $fecha => $valor) {
                $valores[$fecha] = [
                    'registros' => (int)($valor['registros'] ?? 0)
                ];
            }

            $filas[] = [
                'tipo' => $fila['tipo'],
                'cliente' => $fila['cliente'],
                'area' => $fila['area'],
                'codigoconta' => $fila['codigoconta'],
                'causatipo' => $fila['causatipo'],
                'valores' => $valores
            ];
        }

        return [
            'status' => 'success',
            'tipo_grafico' => 'CantDia',
            'filtros' => $datos['filtros'],
            'fechas' => $datos['fechas'],
            'filas' => $filas,
            'total_registros' => $datos['total_registros'],
            'total_clientes' => $datos['total_clientes'],
            'max_registros' => $datos['max_registros'],
            'opciones' => $datos['opciones']
        ];
    }

    private static function consultarPareto(PDO $db, array $where, array $params): array
    {
        $sql = "SELECT
                    TRIM(cliente) AS cliente,
                    TRIM(causatipo) AS causatipo,
                    TRIM(codigoconta) AS codigoconta,
                    TRIM(area) AS area,
                    COUNT(*) AS registros
                FROM dmagentescausalesmermas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    TRIM(cliente),
                    TRIM(causatipo),
                    TRIM(codigoconta),
                    TRIM(area)
                ORDER BY
                    cliente ASC,
                    registros DESC,
                    causatipo ASC,
                    codigoconta ASC,
                    area ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function consultarListado(PDO $db, array $where, array $params, array $filtros): array
    {
        $page = max(1, (int)($filtros['page'] ?? 1));
        $pageSize = (int)($filtros['page_size'] ?? self::PAGE_SIZE_DEFAULT);
        $pageSize = max(1, min(self::PAGE_SIZE_MAX, $pageSize));
        $offset = ($page - 1) * $pageSize;

        $whereSql = implode(' AND ', $where);

        $stmtTotal = $db->prepare("SELECT COUNT(*) FROM dmagentescausalesmermas WHERE {$whereSql}");
        $stmtTotal->execute($params);
        $total = (int)$stmtTotal->fetchColumn();

        $sql = "SELECT
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fechaproceso,
                    TRIM(cliente) AS cliente,
                    TRIM(area) AS area,
                    TRIM(codigoconta) AS codigoconta,
                    TRIM(causatipo) AS causatipo,
                    TRIM(placa) AS placa,
                    DATE_FORMAT(fecharegistro, '%Y-%m-%d') AS fecharegistro,
                    TRIM(horaregistro) AS horaregistro,
                    TRIM(descripcion) AS descripcion,
                    TRIM(usuario) AS usuario
                FROM dmagentescausalesmermas
                WHERE {$whereSql}
                ORDER BY
                    fechaproceso ASC,
                    cliente ASC,
                    area ASC,
                    codigoconta ASC,
                    causatipo ASC,
                    placa ASC,
                    fecharegistro ASC,
                    horaregistro ASC
                LIMIT {$pageSize} OFFSET {$offset}";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return [
            'filas' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'total_paginas' => $total > 0 ? (int)ceil($total / $pageSize) : 0
        ];
    }

    private static function whereBase(array $filtros): array
    {
        $fechaInicio = self::fecha($filtros['fecha_inicio'] ?? null, self::fechaInicioDefecto());
        $fechaFin = self::fecha($filtros['fecha_fin'] ?? null, self::fechaFinDefecto());

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        $where = ['fechaproceso BETWEEN :fecha_inicio AND :fecha_fin'];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $proceso = self::valorFiltro($filtros['proceso'] ?? null);
        if ($proceso !== '') {
            $where[] = 'TRIM(proceso) = :proceso';
            $params[':proceso'] = $proceso;
        }

        $areas = self::normalizarLista($filtros['areas'] ?? $filtros['area'] ?? null);
        if ($areas) {
            $marcadores = [];
            foreach ($areas as $indice => $area) {
                $marcador = ':area_' . $indice;
                $marcadores[] = $marcador;
                $params[$marcador] = $area;
            }
            $where[] = 'TRIM(area) IN (' . implode(', ', $marcadores) . ')';
        }

        $clientes = self::normalizarLista($filtros['clientes'] ?? $filtros['cliente'] ?? null);
        if ($clientes) {
            $marcadores = [];
            foreach ($clientes as $indice => $cliente) {
                $marcador = ':cliente_' . $indice;
                $marcadores[] = $marcador;
                $params[$marcador] = $cliente;
            }
            $where[] = 'TRIM(cliente) IN (' . implode(', ', $marcadores) . ')';
        }

        $pareto = $filtros['pareto'] ?? null;
        if (is_array($pareto)) {
            $selecciones = $pareto;

            if ($pareto && array_keys($pareto) !== range(0, count($pareto) - 1)) {
                $selecciones = [$pareto];
            }

            $campos = [
                'cliente' => 'TRIM(cliente)',
                'causatipo' => 'TRIM(causatipo)',
                'codigoconta' => 'TRIM(codigoconta)',
                'area' => 'TRIM(area)'
            ];
            $condiciones = [];

            foreach ($selecciones as $indice => $seleccion) {
                if (!is_array($seleccion)) {
                    continue;
                }

                $partes = [];
                foreach ($campos as $campo => $expresion) {
                    if (!array_key_exists($campo, $seleccion)) {
                        continue;
                    }

                    $marcador = ':pareto_' . $indice . '_' . $campo;
                    $partes[] = $expresion . ' = ' . $marcador;
                    $params[$marcador] = trim((string)($seleccion[$campo] ?? ''));
                }

                if ($partes) {
                    $condiciones[] = '(' . implode(' AND ', $partes) . ')';
                }
            }

            if ($condiciones) {
                $where[] = '(' . implode(' OR ', $condiciones) . ')';
            }
        }

        return [$where, $params];
    }

    private static function filtrosAplicados(array $filtros): array
    {
        return [
            'fecha_inicio' => self::fecha($filtros['fecha_inicio'] ?? null, self::fechaInicioDefecto()),
            'fecha_fin' => self::fecha($filtros['fecha_fin'] ?? null, self::fechaFinDefecto()),
            'proceso' => self::valorFiltro($filtros['proceso'] ?? null),
            'areas' => self::normalizarLista($filtros['areas'] ?? $filtros['area'] ?? null) ?: [],
            'clientes' => self::normalizarLista($filtros['clientes'] ?? $filtros['cliente'] ?? null) ?: [],
            'pareto' => is_array($filtros['pareto'] ?? null) ? $filtros['pareto'] : null
        ];
    }

    private static function normalizarLista($valor): array
    {
        if ($valor === null) {
            return [];
        }

        $valores = is_array($valor) ? $valor : explode(',', (string)$valor);
        $limpios = [];

        foreach ($valores as $item) {
            $item = trim((string)$item);
            if ($item !== '' && strtoupper($item) !== 'TODO') {
                $limpios[] = $item;
            }
        }

        return array_values(array_unique($limpios));
    }

    private static function valorFiltro($valor): string
    {
        $valor = trim((string)($valor ?? ''));
        return strtoupper($valor) === 'TODO' ? '' : $valor;
    }

    private static function fechaInicioDefecto(): string
    {
        return date('Y-m-01', strtotime('first day of previous month'));
    }

    private static function fechaFinDefecto(): string
    {
        return date('Y-m-t');
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

    private static function consultaColumna(PDO $db, string $sql): array
    {
        $stmt = $db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    private static function consultaFila(PDO $db, string $sql): array
    {
        $stmt = $db->query($sql);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($fila) ? $fila : [];
    }
}
