<?php

class VistaProcesoHandler
{
    private const DEFAULT_UBICACION = 'PLANTA AGUA';
    private const DEFAULT_DATO = 'Volumen';
    private const DEFAULT_CENCOS = 'PLANTA AGUA GLORIA';

    public static function handle(PDO $db, array $filtros = [], string $conexion = 'principal'): array
    {
        $opciones = self::obtenerOpciones($db);

        $fechaInicio = self::normalizarFecha($filtros['fecha_inicio'] ?? null) ?: self::fechaInicioDefecto();
        $fechaFin = self::normalizarFecha($filtros['fecha_fin'] ?? null) ?: self::fechaFinDefecto();

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        $ubicacion = self::valorSeleccionado($filtros['ubicacion'] ?? null, self::DEFAULT_UBICACION);
        $dato = self::valorSeleccionado($filtros['dato'] ?? null, self::DEFAULT_DATO);
        $nomcencos = self::valorSeleccionado($filtros['nomcencos'] ?? null, self::DEFAULT_CENCOS);
        $procesos = self::normalizarProcesos($filtros['procesos'] ?? null, $opciones['procesos']);

        $where = [
            'tfectra BETWEEN :fecha_inicio AND :fecha_fin',
            "tfectra > '0000-00-00'",
            'TRIM(dato) = :dato',
            'TRIM(ubicacion) = :ubicacion',
            'TRIM(nomcencos) = :nomcencos'
        ];

        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin,
            ':dato' => $dato,
            ':ubicacion' => $ubicacion,
            ':nomcencos' => $nomcencos
        ];

        if (count($procesos) === 0) {
            $where[] = '1 = 0';
        } else {
            $placeholders = [];
            foreach ($procesos as $indice => $proceso) {
                $placeholder = ':proceso_' . $indice;
                $placeholders[] = $placeholder;
                $params[$placeholder] = $proceso;
            }
            $where[] = 'TRIM(proceso) IN (' . implode(', ', $placeholders) . ')';
        }

        $filas = self::obtenerFilas($db, $where, $params);
        $datos = self::agruparDatos($filas, $opciones);

        $filtrosAplicados = [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'fecha_label' => self::formatearRango($fechaInicio, $fechaFin),
            'ubicacion' => $ubicacion,
            'dato' => $dato,
            'nomcencos' => $nomcencos,
            'procesos' => $procesos,
            'procesos_label' => count($procesos) === count($opciones['procesos'])
                ? 'Todos'
                : (count($procesos) > 0 ? implode(', ', $procesos) : 'Ninguno')
        ];

        $filtrosAplicados['resumen'] = implode(' · ', [
            $ubicacion,
            $dato,
            $nomcencos,
            'Procesos: ' . $filtrosAplicados['procesos_label'],
            $filtrosAplicados['fecha_label']
        ]);

        $codcencos = self::obtenerCodCencos($db, $nomcencos);

        return [
            'status' => 'success',
            'tipo_grafico' => 'VistaProceso',
            'fuente' => 'factmermaagua',
            'conexion' => $conexion,
            'codcencos' => $codcencos,
            'opciones_filtros' => $opciones,
            'filtros_aplicados' => $filtrosAplicados,
            'fecha_corte' => $datos['fecha_corte'],
            'fecha_corte_dmy' => self::formatearFechaDMY($datos['fecha_corte']),
            'total_registros' => count($filas),
            'total_fechas' => count($datos['fechas']),
            'fechas' => $datos['fechas'],
            'procesos' => $datos['procesos'],
            'subdatos' => $opciones['subdatos'],
            'unidad' => $dato
        ];
    }

    private static function obtenerCodCencos(PDO $db, string $nomcencos): ?string
    {
        $sql = "
            SELECT TRIM(codcencos) AS codcencos
            FROM factmermaagua
            WHERE tfectra > '0000-00-00'
              AND TRIM(nomcencos) = :nomcencos
              AND TRIM(codcencos) <> ''
            ORDER BY tfectra DESC
            LIMIT 1
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([':nomcencos' => $nomcencos]);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);

        return $fila && !empty($fila['codcencos']) ? (string)$fila['codcencos'] : null;
    }

    private static function obtenerOpciones(PDO $db): array
    {
        $ubicaciones = self::valoresDistintos($db, 'ubicacion');
        $datos = self::valoresDistintos($db, 'dato');
        $cencos = self::valoresDistintos($db, 'nomcencos');
        $procesos = self::valoresDistintos($db, 'proceso');
        $subdatos = self::valoresDistintos($db, 'subdato');

        usort($ubicaciones, function ($a, $b) {
            $orden = ['PLANTA AGUA' => 0, 'GRANJAS' => 1];
            return ($orden[$a] ?? 99) <=> ($orden[$b] ?? 99);
        });

        usort($datos, function ($a, $b) {
            $orden = ['Volumen' => 0, 'Porcentaje' => 1];
            return ($orden[$a] ?? 99) <=> ($orden[$b] ?? 99);
        });

        usort($subdatos, function ($a, $b) {
            $orden = ['m3' => 0, 'Limite C' => 1, 'Limite I' => 2, 'Limite S' => 3];
            return ($orden[$a] ?? 99) <=> ($orden[$b] ?? 99);
        });

        $stmtFechas = $db->query("
            SELECT MIN(tfectra) AS fecha_min, MAX(tfectra) AS fecha_max
            FROM factmermaagua
            WHERE tfectra > '0000-00-00'
        ");
        $fechas = $stmtFechas ? $stmtFechas->fetch(PDO::FETCH_ASSOC) : [];

        return [
            'ubicaciones' => self::comoOpciones($ubicaciones),
            'datos' => self::comoOpciones($datos),
            'cencos' => self::comoOpciones($cencos),
            'procesos' => self::comoOpciones($procesos),
            'subdatos' => self::comoOpciones($subdatos),
            'fecha_min' => $fechas['fecha_min'] ?? null,
            'fecha_max' => $fechas['fecha_max'] ?? null,
            'defaults' => [
                'ubicacion' => self::DEFAULT_UBICACION,
                'dato' => self::DEFAULT_DATO,
                'nomcencos' => self::DEFAULT_CENCOS,
                'procesos' => $procesos
            ]
        ];
    }

    private static function obtenerFilas(PDO $db, array $where, array $params): array
    {
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                tfectra AS fecha,
                TRIM(proceso) AS proceso,
                TRIM(subdato) AS subdato,
                ROUND(AVG(valor), 6) AS valor
            FROM factmermaagua
            WHERE {$whereSql}
            GROUP BY tfectra, TRIM(proceso), TRIM(subdato)
            ORDER BY tfectra ASC, TRIM(proceso) ASC, TRIM(subdato) ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function agruparDatos(array $filas, array $opciones): array
    {
        $mapaFechas = [];
        $mapaProcesos = [];

        foreach ($filas as $fila) {
            $fecha = (string)$fila['fecha'];
            $proceso = trim((string)$fila['proceso']);
            $subdato = trim((string)$fila['subdato']);
            $valor = (float)$fila['valor'];

            $mapaFechas[$fecha] = true;
            $mapaProcesos[$proceso][$subdato][$fecha] = $valor;
        }

        $fechas = array_keys($mapaFechas);
        sort($fechas);

        $ordenProcesos = array_column($opciones['procesos'], 'id');
        foreach (array_keys($mapaProcesos) as $proceso) {
            if (!in_array($proceso, $ordenProcesos, true)) {
                $ordenProcesos[] = $proceso;
            }
        }

        $ordenSubdatos = array_column($opciones['subdatos'], 'id');
        foreach ($mapaProcesos as $series) {
            foreach (array_keys($series) as $subdato) {
                if (!in_array($subdato, $ordenSubdatos, true)) {
                    $ordenSubdatos[] = $subdato;
                }
            }
        }

        $procesos = [];

        foreach ($ordenProcesos as $proceso) {
            if (!isset($mapaProcesos[$proceso])) {
                continue;
            }

            $series = [];
            foreach ($ordenSubdatos as $subdato) {
                if (!isset($mapaProcesos[$proceso][$subdato])) {
                    continue;
                }

                $valores = [];
                foreach ($fechas as $fecha) {
                    $valores[] = $mapaProcesos[$proceso][$subdato][$fecha] ?? null;
                }

                $series[] = [
                    'subdato' => $subdato,
                    'valores' => $valores
                ];
            }

            if (!empty($series)) {
                $procesos[] = [
                    'proceso' => $proceso,
                    'series' => $series
                ];
            }
        }

        return [
            'fechas' => $fechas,
            'procesos' => $procesos,
            'fecha_corte' => !empty($fechas) ? $fechas[count($fechas) - 1] : null
        ];
    }

    private static function valoresDistintos(PDO $db, string $columna): array
    {
        $sql = "
            SELECT DISTINCT TRIM(`{$columna}`) AS valor
            FROM factmermaagua
            WHERE tfectra > '0000-00-00'
              AND `{$columna}` IS NOT NULL
              AND TRIM(`{$columna}`) <> ''
            ORDER BY valor ASC
        ";

        $stmt = $db->query($sql);
        if (!$stmt) {
            return [];
        }

        return array_values(array_filter($stmt->fetchAll(PDO::FETCH_COLUMN), function ($valor) {
            return $valor !== null && $valor !== '';
        }));
    }

    private static function comoOpciones(array $valores): array
    {
        return array_map(function ($valor) {
            return ['id' => $valor, 'label' => $valor];
        }, $valores);
    }

    private static function valorSeleccionado($valor, string $default): string
    {
        if (is_array($valor)) {
            $valor = reset($valor);
        }

        $texto = trim((string)$valor);
        return $texto !== '' ? $texto : $default;
    }

    private static function normalizarProcesos($valor, array $opciones): array
    {
        if ($valor === null) {
            return array_column($opciones, 'id');
        }

        if (!is_array($valor)) {
            $valor = [$valor];
        }

        $resultado = [];
        foreach ($valor as $item) {
            $texto = trim((string)$item);
            if ($texto !== '') {
                $resultado[] = $texto;
            }
        }

        return array_values(array_unique($resultado));
    }

    private static function normalizarFecha($valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        $fecha = trim((string)$valor);
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $fecha, $partes)) {
            return null;
        }

        $anio = (int)$partes[1];
        $mes = (int)$partes[2];
        $dia = (int)$partes[3];

        if (!checkdate($mes, $dia, $anio)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', $anio, $mes, $dia);
    }

    private static function fechaInicioDefecto(): string
    {
        return (new DateTimeImmutable('now'))->modify('first day of last month')->format('Y-m-d');
    }

    private static function fechaFinDefecto(): string
    {
        return (new DateTimeImmutable('now'))->modify('last day of this month')->format('Y-m-d');
    }

    private static function formatearRango(string $inicio, string $fin): string
    {
        return self::formatearFechaDMY($inicio) . ' a ' . self::formatearFechaDMY($fin);
    }

    private static function formatearFechaDMY(?string $fecha): ?string
    {
        if (!$fecha) {
            return null;
        }

        try {
            return (new DateTimeImmutable($fecha))->format('d/m/Y');
        } catch (Throwable $e) {
            return $fecha;
        }
    }
}
