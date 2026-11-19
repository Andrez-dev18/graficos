<?php

class GraficoIndicadoresHandler
{
    private const ALMACENES = ['JAB', 'JAG', 'TNB'];

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = self::fecha($filtros['fecha_inicio'] ?? null, date('Y-m-01'));
        $fechaFin = self::fecha($filtros['fecha_fin'] ?? null, date('Y-m-d'));

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        $almacenes = self::normalizarAlmacenes($filtros['codalmacenes'] ?? $filtros['codalmacen'] ?? null);
        $tipocliente = self::valorFiltro($filtros['tipocliente'] ?? null);
        $nomcliente = self::valorFiltro($filtros['nomcliente'] ?? null);

        [$where, $params] = self::whereBase($fechaInicio, $fechaFin, $almacenes, $tipocliente, $nomcliente);

        $items = self::consultar(
            $db,
            self::sqlResumen(),
            $where,
            $params
        );

        $provincias = self::consultar(
            $db,
            self::sqlProvincias(),
            $where,
            $params
        );

        $fechas = [];
        foreach ($items as $fila) {
            $fechas[$fila['fecha']] = true;
        }
        foreach ($provincias as $fila) {
            $fechas[$fila['fecha']] = true;
        }

        $fechas = array_keys($fechas);
        sort($fechas, SORT_STRING);

        [$whereOpciones, $paramsOpciones] = self::whereBase($fechaInicio, $fechaFin, $almacenes, '', '');

        $tipoclientes = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(tipocliente) AS valor
             FROM ft_stockjabas
             WHERE " . implode(' AND ', $whereOpciones) . "
               AND TRIM(IFNULL(tipocliente, '')) <> ''
             ORDER BY valor ASC",
            $paramsOpciones
        );

        $clientes = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(nomcliente) AS valor
             FROM ft_stockjabas
             WHERE " . implode(' AND ', $whereOpciones) . "
               AND TRIM(IFNULL(nomcliente, '')) <> ''
             ORDER BY valor ASC",
            $paramsOpciones
        );

        return [
            'tipo_grafico' => 'GraficoIndicadores',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'filtros' => [
                'tipocliente' => $tipocliente,
                'nomcliente' => $nomcliente,
                'codalmacenes' => $almacenes
            ],
            'fechas' => $fechas,
            'items' => self::agruparSeries($items, false),
            'provincias' => self::agruparSeries($provincias, true),
            'opciones' => [
                'tipoclientes' => array_values($tipoclientes),
                'clientes' => array_values($clientes)
            ],
            'objetivo' => 0.8
        ];
    }

    private static function sqlResumen(): string
    {
        return "SELECT
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    TRIM(codalmacen) AS codalmacen,
                    TRIM(coditem) AS coditem,
                    COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') AS nomitem,
                    CONCAT(TRIM(coditem), ' ', COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM')) AS item,
                    SUM(entradas) / NULLIF(ABS(SUM(saldoinicial)) + ABS(SUM(salidas)), 0) AS indicador
                FROM ft_stockjabas
                WHERE __WHERE__
                GROUP BY
                    fecha,
                    codalmacen,
                    coditem,
                    nomitem,
                    item
                ORDER BY
                    codalmacen ASC,
                    coditem ASC,
                    fecha ASC";
    }

    private static function sqlProvincias(): string
    {
        return "SELECT
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    TRIM(codalmacen) AS codalmacen,
                    TRIM(provincia) AS provincia,
                    TRIM(coditem) AS coditem,
                    COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') AS nomitem,
                    CONCAT(TRIM(coditem), ' ', COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM')) AS item,
                    SUM(entradas) / NULLIF(ABS(SUM(saldoinicial)) + ABS(SUM(salidas)), 0) AS indicador
                FROM ft_stockjabas
                WHERE __WHERE__
                GROUP BY
                    fecha,
                    codalmacen,
                    provincia,
                    coditem,
                    nomitem,
                    item
                ORDER BY
                    codalmacen ASC,
                    provincia ASC,
                    item ASC,
                    fecha ASC";
    }

    private static function consultar(PDO $db, string $sql, array $where, array $params): array
    {
        $sql = str_replace('__WHERE__', implode(' AND ', $where), $sql);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($filas as &$fila) {
            $fila['indicador'] = $fila['indicador'] === null ? null : round((float)$fila['indicador'], 4);
        }
        unset($fila);

        return $filas;
    }

    private static function agruparSeries(array $filas, bool $conProvincia): array
    {
        $series = [];

        foreach ($filas as $fila) {
            $clave = implode("\u{001F}", [
                $fila['codalmacen'] ?? '',
                $conProvincia ? ($fila['provincia'] ?? '') : '',
                $fila['coditem'] ?? '',
                $fila['nomitem'] ?? '',
                $fila['item'] ?? ''
            ]);

            if (!isset($series[$clave])) {
                $series[$clave] = [
                    'codalmacen' => $fila['codalmacen'] ?? '',
                    'provincia' => $conProvincia ? ($fila['provincia'] ?? '') : '',
                    'coditem' => $fila['coditem'] ?? '',
                    'nomitem' => $fila['nomitem'] ?? '',
                    'item' => $fila['item'] ?? '',
                    'puntos' => []
                ];
            }

            if ($fila['indicador'] !== null) {
                $series[$clave]['puntos'][] = [
                    'fecha' => $fila['fecha'],
                    'indicador' => $fila['indicador']
                ];
            }
        }

        return array_values($series);
    }

    private static function whereBase(
        string $fechaInicio,
        string $fechaFin,
        array $almacenes,
        string $tipocliente,
        string $nomcliente
    ): array {
        $where = ['fechaproceso BETWEEN :fecha_inicio AND :fecha_fin'];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $todosLosAlmacenes = empty($almacenes) || count($almacenes) === count(self::ALMACENES);
        if (!$todosLosAlmacenes) {
            $marcadores = [];
            foreach ($almacenes as $indice => $almacen) {
                $marcador = ':almacen_' . $indice;
                $marcadores[] = $marcador;
                $params[$marcador] = $almacen;
            }
            $where[] = 'TRIM(codalmacen) IN (' . implode(', ', $marcadores) . ')';
        }

        if ($tipocliente !== '') {
            $where[] = 'TRIM(tipocliente) = :tipocliente';
            $params[':tipocliente'] = $tipocliente;
        }

        if ($nomcliente !== '') {
            $where[] = 'TRIM(nomcliente) = :nomcliente';
            $params[':nomcliente'] = $nomcliente;
        }

        return [$where, $params];
    }

    private static function consultaColumna(PDO $db, string $sql, array $params): array
    {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    private static function normalizarAlmacenes($valor): array
    {
        if ($valor === null) {
            return ['JAB'];
        }

        $valores = is_array($valor) ? $valor : explode(',', (string)$valor);
        $limpios = [];

        foreach ($valores as $almacen) {
            $almacen = strtoupper(trim((string)$almacen));
            if (in_array($almacen, self::ALMACENES, true)) {
                $limpios[] = $almacen;
            }
        }

        return array_values(array_unique($limpios));
    }

    private static function valorFiltro($valor): string
    {
        $valor = trim((string)($valor ?? ''));
        return $valor === '(Todo)' ? '' : $valor;
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
