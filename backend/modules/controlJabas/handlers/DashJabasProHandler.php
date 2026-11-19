<?php

class DashJabasProHandler
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

        $where = [
            'fechaproceso BETWEEN :fecha_inicio AND :fecha_fin',
            "TRIM(IFNULL(coditem, '')) != ''"
        ];
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

        $sql = "SELECT
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    TRIM(codalmacen) AS codalmacen,
                    COALESCE(NULLIF(TRIM(nomcliente), ''), 'SIN CLIENTE') AS nomcliente,
                    TRIM(coditem) AS coditem,
                    COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') AS nomitem,
                    SUM(cantidad) AS cantidad
                FROM ft_stockalmacenp
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    fechaproceso,
                    codalmacen,
                    nomcliente,
                    coditem,
                    nomitem
                ORDER BY
                    codalmacen ASC,
                    nomcliente ASC,
                    coditem ASC,
                    fechaproceso ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $registros = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $fechas = [];
        $filasMap = [];
        $totalGeneral = 0.0;
        $clientesSet = [];
        $itemsSet = [];

        foreach ($registros as $registro) {
            $fecha = $registro['fecha'];
            $codalmacen = $registro['codalmacen'] ?: 'SIN ALMACEN';
            $nomcliente = $registro['nomcliente'] ?: 'SIN CLIENTE';
            $coditem = $registro['coditem'] ?: 'SIN ITEM';
            $nomitem = $registro['nomitem'] ?: 'SIN ITEM';
            $cantidad = (float)($registro['cantidad'] ?? 0);

            if (!isset($fechas[$fecha])) {
                $fechas[$fecha] = self::fechaInfo($fecha);
            }

            $clave = implode("\x1F", [$codalmacen, $nomcliente, $coditem, $nomitem]);

            if (!isset($filasMap[$clave])) {
                $filasMap[$clave] = [
                    'codalmacen' => $codalmacen,
                    'nomcliente' => $nomcliente,
                    'coditem' => $coditem,
                    'nomitem' => $nomitem,
                    'item' => trim($coditem . ' ' . $nomitem),
                    'valores' => [],
                    'total' => 0.0
                ];
            }

            $filasMap[$clave]['valores'][$fecha] = round($cantidad, 2);
            $filasMap[$clave]['total'] = round($filasMap[$clave]['total'] + $cantidad, 2);
            $totalGeneral += $cantidad;
            $clientesSet[$nomcliente] = true;
            $itemsSet[$coditem] = true;
        }

        ksort($fechas);

        usort($filasMap, function (array $a, array $b): int {
            foreach (['codalmacen', 'nomcliente', 'item'] as $campo) {
                $cmp = strcmp((string)$a[$campo], (string)$b[$campo]);
                if ($cmp !== 0) {
                    return $cmp;
                }
            }
            return 0;
        });

        return [
            'tipo_grafico' => 'DashJabasPro',
            'titulo' => 'Stock de Jabas Proceso',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'codalmacenes' => $todosLosAlmacenes ? array_values(self::ALMACENES) : $almacenes,
            'fechas' => array_values($fechas),
            'filas' => array_values($filasMap),
            'resumen' => [
                'total' => round($totalGeneral, 2),
                'clientes' => count($clientesSet),
                'items' => count($itemsSet),
                'dias' => count($fechas)
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

