<?php

class StockProvinciasHandler
{
    private const ALMACENES = ['JAB', 'JAG', 'TNB'];

    public static function resumen(PDO $db, array $filtros): array
    {
        $fecha = self::fecha($filtros['fecha'] ?? $filtros['fecha_inicio'] ?? null, date('Y-m-d'));
        $almacenes = self::normalizarAlmacenes($filtros['codalmacenes'] ?? $filtros['codalmacen'] ?? null);
        $tipocliente = self::valorFiltro($filtros['tipocliente'] ?? null);
        $nomcliente = self::valorFiltro($filtros['nomcliente'] ?? null);

        [$where, $params] = self::whereBase($fecha, $almacenes, $tipocliente, $nomcliente);

        $sql = "SELECT
                    TRIM(provincia) AS provincia,
                    TRIM(codalmacen) AS codalmacen,
                    TRIM(coditem) AS coditem,
                    COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') AS nomitem,
                    CONCAT(TRIM(coditem), ' ', COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM')) AS item,
                    SUM(saldoinicial) AS saldoinicial,
                    ABS(SUM(salidas)) AS jabas_distribuidas,
                    ABS(SUM(entradas)) AS jabas_recogidas,
                    SUM(saldofinal) AS saldofinal,
                    SUM(entradas) / NULLIF(ABS(SUM(saldoinicial)) + ABS(SUM(salidas)), 0) AS indicador
                FROM ft_stockjabas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    provincia,
                    codalmacen,
                    coditem,
                    nomitem
                ORDER BY
                    provincia ASC,
                    codalmacen ASC,
                    item ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalSaldo = 0.0;
        $totalDistribuidas = 0.0;
        $totalRecogidas = 0.0;
        $totalFinal = 0.0;

        foreach ($filas as &$fila) {
            $fila['saldoinicial'] = round((float)$fila['saldoinicial'], 2);
            $fila['jabas_distribuidas'] = round((float)$fila['jabas_distribuidas'], 2);
            $fila['jabas_recogidas'] = round((float)$fila['jabas_recogidas'], 2);
            $fila['saldofinal'] = round((float)$fila['saldofinal'], 2);
            $fila['indicador'] = $fila['indicador'] === null ? null : round((float)$fila['indicador'], 4);

            $totalSaldo += $fila['saldoinicial'];
            $totalDistribuidas += $fila['jabas_distribuidas'];
            $totalRecogidas += $fila['jabas_recogidas'];
            $totalFinal += $fila['saldofinal'];
        }
        unset($fila);

        $denominador = abs($totalSaldo) + abs($totalDistribuidas);

        return [
            'tipo_grafico' => 'StockProvincias',
            'fecha' => $fecha,
            'fecha_label' => self::fechaLarga($fecha),
            'filtros' => [
                'tipocliente' => $tipocliente,
                'nomcliente' => $nomcliente,
                'codalmacenes' => $almacenes
            ],
            'filas' => $filas,
            'total_general' => [
                'saldoinicial' => round($totalSaldo, 2),
                'jabas_distribuidas' => round($totalDistribuidas, 2),
                'jabas_recogidas' => round($totalRecogidas, 2),
                'saldofinal' => round($totalFinal, 2),
                'indicador' => $denominador > 0 ? round($totalRecogidas / $denominador, 4) : null
            ]
        ];
    }

    public static function detalle(PDO $db, array $filtros): array
    {
        $fecha = self::fecha($filtros['fecha'] ?? $filtros['fecha_inicio'] ?? null, date('Y-m-d'));
        $almacenes = self::normalizarAlmacenes($filtros['codalmacenes'] ?? $filtros['codalmacen'] ?? null);
        $tipocliente = self::valorFiltro($filtros['tipocliente'] ?? null);
        $nomcliente = self::valorFiltro($filtros['nomcliente'] ?? null);
        $seleccion = is_array($filtros['seleccion'] ?? null) ? $filtros['seleccion'] : [];

        if (!$seleccion) {
            return ['filas' => []];
        }

        [$where, $params] = self::whereBase($fecha, $almacenes, $tipocliente, $nomcliente);
        $seleccionWhere = [];
        $indice = 0;

        foreach ($seleccion as $fila) {
            if (!is_array($fila)) {
                continue;
            }

            $provincia = trim((string)($fila['provincia'] ?? ''));
            $codalmacen = strtoupper(trim((string)($fila['codalmacen'] ?? '')));
            $coditem = trim((string)($fila['coditem'] ?? ''));
            $nomitem = trim((string)($fila['nomitem'] ?? ''));

            if ($provincia === '' || $codalmacen === '' || $coditem === '') {
                continue;
            }

            $p = ':sel_provincia_' . $indice;
            $a = ':sel_almacen_' . $indice;
            $i = ':sel_item_' . $indice;
            $n = ':sel_nomitem_' . $indice;

            $seleccionWhere[] = "(TRIM(provincia) = {$p} AND TRIM(codalmacen) = {$a} AND TRIM(coditem) = {$i} AND COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') = {$n})";
            $params[$p] = $provincia;
            $params[$a] = $codalmacen;
            $params[$i] = $coditem;
            $params[$n] = $nomitem !== '' ? $nomitem : 'SIN ITEM';
            $indice++;
        }

        if (!$seleccionWhere) {
            return ['filas' => []];
        }

        $where[] = '(' . implode(' OR ', $seleccionWhere) . ')';

        $sql = "SELECT
                    TRIM(provincia) AS provincia,
                    TRIM(codalmacen) AS codalmacen,
                    TRIM(nomcliente) AS nomcliente,
                    TRIM(coditem) AS coditem,
                    COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM') AS nomitem,
                    CONCAT(TRIM(coditem), ' ', COALESCE(NULLIF(TRIM(nomitem), ''), 'SIN ITEM')) AS item,
                    SUM(saldoinicial) AS saldoinicial,
                    ABS(SUM(salidas)) AS jabas_distribuidas,
                    ABS(SUM(entradas)) AS jabas_recogidas,
                    SUM(saldofinal) AS saldofinal,
                    SUM(entradas) / NULLIF(ABS(SUM(saldoinicial)) + ABS(SUM(salidas)), 0) AS indicador
                FROM ft_stockjabas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    provincia,
                    codalmacen,
                    nomcliente,
                    coditem,
                    nomitem
                ORDER BY
                    provincia ASC,
                    codalmacen ASC,
                    indicador ASC,
                    nomcliente ASC,
                    item ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($filas as &$fila) {
            $fila['saldoinicial'] = round((float)$fila['saldoinicial'], 2);
            $fila['jabas_distribuidas'] = round((float)$fila['jabas_distribuidas'], 2);
            $fila['jabas_recogidas'] = round((float)$fila['jabas_recogidas'], 2);
            $fila['saldofinal'] = round((float)$fila['saldofinal'], 2);
            $fila['indicador'] = $fila['indicador'] === null ? null : round((float)$fila['indicador'], 4);
        }
        unset($fila);

        return ['filas' => $filas];
    }

    public static function filtros(PDO $db, array $filtros): array
    {
        $fecha = self::fecha($filtros['fecha'] ?? $filtros['fecha_inicio'] ?? null, date('Y-m-d'));
        $almacenes = self::normalizarAlmacenes($filtros['codalmacenes'] ?? $filtros['codalmacen'] ?? null);

        $where = ['fechaproceso = :fecha'];
        $params = [':fecha' => $fecha];

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

        $whereSql = implode(' AND ', $where);

        $stmt = $db->prepare("SELECT DISTINCT TRIM(tipocliente) AS valor
                              FROM ft_stockjabas
                              WHERE {$whereSql} AND TRIM(IFNULL(tipocliente, '')) <> ''
                              ORDER BY valor ASC");
        $stmt->execute($params);
        $tipoclientes = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $stmt = $db->prepare("SELECT DISTINCT TRIM(nomcliente) AS valor
                              FROM ft_stockjabas
                              WHERE {$whereSql} AND TRIM(IFNULL(nomcliente, '')) <> ''
                              ORDER BY valor ASC");
        $stmt->execute($params);
        $clientes = $stmt->fetchAll(PDO::FETCH_COLUMN);

        return [
            'tipoclientes' => array_values($tipoclientes),
            'clientes' => array_values($clientes),
            'fecha' => $fecha
        ];
    }

    private static function whereBase(string $fecha, array $almacenes, string $tipocliente, string $nomcliente): array
    {
        $where = [
            'fechaproceso = :fecha'
        ];
        $params = [':fecha' => $fecha];

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

        if ($tipocliente !== '') {
            $where[] = 'tipocliente = :tipocliente';
            $params[':tipocliente'] = $tipocliente;
        }

        if ($nomcliente !== '') {
            $where[] = 'nomcliente = :nomcliente';
            $params[':nomcliente'] = $nomcliente;
        }

        return [$where, $params];
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
        return in_array(strtoupper($valor), ['', 'TODO', '(TODO)', 'TODOS'], true) ? '' : $valor;
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

    private static function fechaLarga(string $fecha): string
    {
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $dt = new DateTimeImmutable($fecha . ' 00:00:00');

        return $dias[(int)$dt->format('w')] . ', ' . $dt->format('j') . ' de ' . $meses[(int)$dt->format('n') - 1] . ' de ' . $dt->format('Y');
    }
}
