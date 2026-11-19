<?php

class KardexClienteProHandler
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
        $nomcliente = trim((string)($filtros['nomcliente'] ?? ''));

        if ($nomcliente === '') {
            throw new InvalidArgumentException('Seleccione un cliente para visualizar el Kardex.');
        }

        $where = [
            'fechaproceso BETWEEN :fecha_inicio AND :fecha_fin',
            "TRIM(IFNULL(nomcliente, '')) != ''",
            'TRIM(nomcliente) = :nomcliente'
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin,
            ':nomcliente' => $nomcliente
        ];

        $todosLosAlmacenes = empty($almacenes) || count($almacenes) === count(self::ALMACENES);
        if (!$todosLosAlmacenes) {
            $marcadores = [];
            foreach ($almacenes as $indice => $almacen) {
                $marcador = ':almacen_' . $indice;
                $marcadores[] = $marcador;
                $params[$marcador] = $almacen;
            }
            $where[] = 'codalmacen IN (' . implode(', ', $marcadores) . ')';
        }

        $sql = "SELECT
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    TRIM(codalmacen) AS codalmacen,
                    TRIM(nomcliente) AS nomcliente,
                    TRIM(codtransaccion) AS codtransaccion,
                    COALESCE(NULLIF(TRIM(nomtransaccion), ''), 'SIN TRANSACCION') AS nomtransaccion,
                    SUM(cantidad) AS cantidad
                FROM ft_almacen
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    fechaproceso,
                    codalmacen,
                    nomcliente,
                    codtransaccion,
                    nomtransaccion
                ORDER BY
                    codalmacen ASC,
                    fechaproceso ASC,
                    codtransaccion ASC,
                    nomtransaccion ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $registros = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $filas = [];
        $acumulados = [];
        $fechas = [];
        $totalGeneral = 0.0;

        foreach ($registros as $registro) {
            $fecha = $registro['fecha'];
            $codalmacen = $registro['codalmacen'] ?: 'SIN ALMACEN';
            $codtransaccion = $registro['codtransaccion'] ?: 'SIN TRANSACCION';
            $nomtransaccion = $registro['nomtransaccion'] ?: 'SIN TRANSACCION';
            $cantidad = (float)($registro['cantidad'] ?? 0);

            if (!isset($fechas[$fecha])) {
                $fechas[$fecha] = self::fechaInfo($fecha);
            }

            $llaveAcumulado = $codalmacen . "\x1F" . $nomcliente;
            $acumulados[$llaveAcumulado] = round(
                ($acumulados[$llaveAcumulado] ?? 0.0) + $cantidad,
                2
            );

            $filas[] = [
                'fecha' => $fecha,
                'ymd' => $fechas[$fecha]['ymd'],
                'label' => $fechas[$fecha]['label'],
                'codalmacen' => $codalmacen,
                'nomcliente' => $nomcliente,
                'codtransaccion' => $codtransaccion,
                'nomtransaccion' => $nomtransaccion,
                'cantidad' => round($cantidad, 2),
                'acumulado' => $acumulados[$llaveAcumulado]
            ];

            $totalGeneral += $cantidad;
        }

        $saldoPorAlmacen = [];
        foreach ($acumulados as $llave => $saldo) {
            [$almacen] = explode("\x1F", $llave, 2);
            $saldoPorAlmacen[$almacen] = $saldo;
        }

        return [
            'tipo_grafico' => 'KardexClientePro',
            'titulo' => 'Kardex Proceso de Jabas por Cliente',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'codalmacenes' => $todosLosAlmacenes ? array_values(self::ALMACENES) : $almacenes,
            'nomcliente' => $nomcliente,
            'filas' => $filas,
            'resumen' => [
                'total' => round($totalGeneral, 2),
                'movimientos' => count($filas),
                'saldo_por_almacen' => $saldoPorAlmacen
            ]
        ];
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

    private static function fecha($valor, string $defecto): string
    {
        $valor = trim((string)$valor);
        if ($valor === '') {
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('Y-m-d', $valor);
        return $fecha && $fecha->format('Y-m-d') === $valor ? $valor : $defecto;
    }

    private static function fechaInfo(string $fecha): array
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $dt = new DateTimeImmutable($fecha . ' 00:00:00');
        $ymd = $dt->format('Y/m/d');
        $diaSemana = $dias[(int)$dt->format('w')];

        return [
            'fecha' => $fecha,
            'ymd' => $ymd,
            'dia_semana' => $diaSemana,
            'label' => $diaSemana . ', ' . $ymd
        ];
    }
}

