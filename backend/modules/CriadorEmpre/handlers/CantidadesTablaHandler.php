<?php

class CantidadesTablaHandler
{
    private static $tiposDefault = ['Formal', 'Informal'];

    public static function obtenerFiltros(PDO $db): array
    {
        $tipos = self::obtenerOpciones(
            $db,
            "SELECT DISTINCT TRIM(nombre) AS nombre
             FROM com_tipo_emprendedor
             WHERE nombre IS NOT NULL AND TRIM(nombre) <> ''
             ORDER BY nombre ASC"
        );

        $provincias = self::obtenerOpciones(
            $db,
            "SELECT DISTINCT TRIM(nombre) AS nombre
             FROM com_provincia
             WHERE nombre IS NOT NULL AND TRIM(nombre) <> ''
             ORDER BY nombre ASC"
        );

        $proveedores = self::obtenerOpciones(
            $db,
            "SELECT DISTINCT TRIM(p.nombre) AS nombre
             FROM com_db_criador_emprendedor a
             INNER JOIN com_proveedor p ON a.proveedor = p.codigo
             WHERE p.nombre IS NOT NULL AND TRIM(p.nombre) <> ''
             ORDER BY nombre ASC"
        );

        $tiposDisponibles = array_column($tipos, 'id');
        $tiposDefault = array_values(array_filter(self::$tiposDefault, function ($tipo) use ($tiposDisponibles) {
            return in_array($tipo, $tiposDisponibles, true);
        }));

        if (empty($tiposDefault) && !empty($tipos)) {
            $tiposDefault = array_slice($tiposDisponibles, 0, 2);
        }

        $sqlRango = "SELECT MIN(fecha) AS fecha_min, MAX(fecha) AS fecha_max
                     FROM com_db_criador_emprendedor";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $anios = [];
        $stmtAnios = $db->query(
            "SELECT DISTINCT YEAR(fecha) AS anio
             FROM com_db_criador_emprendedor
             WHERE fecha IS NOT NULL
             ORDER BY anio ASC"
        );

        foreach ($stmtAnios->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $anio = (int)($fila['anio'] ?? 0);
            if ($anio > 0) {
                $anios[] = $anio;
            }
        }

        $anioMin = !empty($anios) ? min($anios) : null;
        $anioMax = !empty($anios) ? max($anios) : null;
        $anioInicioDefault = ($anioMin !== null && $anioMax !== null)
            ? max($anioMin, $anioMax - 1)
            : null;

        return [
            'tipo_grafico'         => 'CantidadesTabla',
            'titulo'               => 'Volumen Semanal Total',
            'tipos'                => $tipos,
            'provincias'           => $provincias,
            'proveedores'          => $proveedores,
            'tipos_default'        => $tiposDefault,
            'provincias_default'   => self::obtenerProvinciasConDatos($db),
            'proveedores_default'  => array_column($proveedores, 'id'),
            'fecha_min'            => $rango['fecha_min'] ?? null,
            'fecha_max'            => $rango['fecha_max'] ?? null,
            'anios'                => $anios,
            'anio_min'             => $anioMin,
            'anio_max'             => $anioMax,
            'anio_inicio_default'  => $anioInicioDefault,
            'anio_fin_default'     => $anioMax
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = self::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_min'] ?? '')
        );
        $fechaFin = self::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $tiposSeleccionados = self::normalizarSeleccion(
            array_key_exists('tipos', $filtros) ? $filtros['tipos'] : $opciones['tipos_default'],
            $opciones['tipos']
        );
        $provinciasSeleccionadas = self::normalizarSeleccion(
            array_key_exists('provincias', $filtros) ? $filtros['provincias'] : $opciones['provincias_default'],
            $opciones['provincias']
        );
        $proveedoresSeleccionados = self::normalizarSeleccion(
            array_key_exists('proveedores', $filtros) ? $filtros['proveedores'] : $opciones['proveedores_default'],
            $opciones['proveedores']
        );

        $columnas = self::construirColumnas($fechaInicio, $fechaFin);

        $respuestaBase = [
            'tipo_grafico'   => 'CantidadesTabla',
            'titulo'         => 'Volumen Semanal Total',
            'fecha_inicio'   => $fechaInicio,
            'fecha_fin'      => $fechaFin,
            'columnas'       => $columnas,
            'filas'          => [],
            'subtotales'     => [],
            'total_general'  => [
                'valores' => array_fill(0, count($columnas), null)
            ],
            'total_registros' => 0
        ];

        if (empty($tiposSeleccionados) || empty($provinciasSeleccionadas) || empty($proveedoresSeleccionados) || empty($columnas)) {
            return $respuestaBase;
        }

        $placeholdersTipos = implode(',', array_fill(0, count($tiposSeleccionados), '?'));
        $placeholdersProvincias = implode(',', array_fill(0, count($provinciasSeleccionadas), '?'));
        $placeholdersProveedores = implode(',', array_fill(0, count($proveedoresSeleccionados), '?'));

        $sql = "
            SELECT
                YEAR(a.fecha) AS anio,
                WEEK(a.fecha, 1) AS semana,
                TRIM(t.nombre) AS tipo,
                TRIM(pr.nombre) AS provincia,
                SUM(a.cantidad) AS cantidad
            FROM com_db_criador_emprendedor a
            INNER JOIN com_tipo_emprendedor t ON a.tipo = t.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND TRIM(t.nombre) IN ($placeholdersTipos)
              AND TRIM(pr.nombre) IN ($placeholdersProvincias)
              AND TRIM(p.nombre) IN ($placeholdersProveedores)
            GROUP BY YEAR(a.fecha), WEEK(a.fecha, 1), TRIM(t.nombre), TRIM(pr.nombre)
            ORDER BY anio ASC, semana ASC, tipo ASC, provincia ASC
        ";

        $params = array_merge(
            [$fechaInicio, $fechaFin],
            $tiposSeleccionados,
            $provinciasSeleccionadas,
            $proveedoresSeleccionados
        );
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filasConsulta = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($filasConsulta)) {
            return $respuestaBase;
        }

        $mapa = [];
        foreach ($filasConsulta as $fila) {
            $anio = (int)($fila['anio'] ?? 0);
            $semana = (int)($fila['semana'] ?? 0);
            $tipo = trim((string)($fila['tipo'] ?? ''));
            $provincia = trim((string)($fila['provincia'] ?? ''));

            if ($tipo === '' || $provincia === '' || $anio <= 0 || $semana <= 0) {
                continue;
            }

            $key = $anio . '-' . $semana;
            $mapa[$tipo][$provincia][$key] = (float)($fila['cantidad'] ?? 0);
        }

        $filas = [];
        $subtotales = [];
        $valoresTotalGeneral = array_fill(0, count($columnas), null);

        foreach ($tiposSeleccionados as $tipo) {
            $filasTipo = [];
            $subtotalTipo = array_fill(0, count($columnas), null);

            foreach ($provinciasSeleccionadas as $provincia) {
                $valores = [];

                foreach ($columnas as $indice => $columna) {
                    $key = $columna['key'];
                    $valor = $mapa[$tipo][$provincia][$key] ?? null;
                    $valores[] = $valor === null ? null : round($valor, 6);

                    if ($valor !== null) {
                        $subtotalTipo[$indice] = ($subtotalTipo[$indice] ?? 0) + $valor;
                        $valoresTotalGeneral[$indice] = ($valoresTotalGeneral[$indice] ?? 0) + $valor;
                    }
                }

                $filasTipo[] = [
                    'tipo'       => $tipo,
                    'provincia'  => $provincia,
                    'valores'    => $valores
                ];
            }

            $filas = array_merge($filas, $filasTipo);
            $subtotales[] = [
                'tipo'    => $tipo,
                'valores' => array_map(function ($valor) {
                    return $valor === null ? null : round($valor, 6);
                }, $subtotalTipo)
            ];
        }

        $respuestaBase['filas'] = $filas;
        $respuestaBase['subtotales'] = $subtotales;
        $respuestaBase['total_general'] = [
            'valores' => array_map(function ($valor) {
                return $valor === null ? null : round($valor, 6);
            }, $valoresTotalGeneral)
        ];
        $respuestaBase['total_registros'] = count($filasConsulta);

        return $respuestaBase;
    }

    private static function obtenerOpciones(PDO $db, string $sql): array
    {
        $opciones = [];
        $stmt = $db->query($sql);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $opciones[] = [
                    'id'    => $nombre,
                    'label' => $nombre
                ];
            }
        }

        return $opciones;
    }

    private static function obtenerProvinciasConDatos(PDO $db): array
    {
        $sql = "
            SELECT DISTINCT TRIM(pr.nombre) AS nombre
            FROM com_db_criador_emprendedor a
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            INNER JOIN com_tipo_emprendedor t ON a.tipo = t.codigo
            WHERE t.nombre IN ('Formal', 'Informal')
              AND pr.nombre IS NOT NULL
              AND TRIM(pr.nombre) <> ''
            ORDER BY nombre ASC
        ";

        $provincias = [];
        foreach ($db->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $provincias[] = $nombre;
            }
        }

        return $provincias;
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

    public static function construirColumnas(string $fechaInicio, string $fechaFin): array
    {
        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);
        $cursor = $inicio;
        $columnas = [];

        while ($cursor <= $fin) {
            $anio = (int)$cursor->format('Y');
            $semana = self::calcularSemanaCalendario($cursor);
            $key = $anio . '-' . $semana;

            if (!isset($columnas[$key])) {
                $columnas[$key] = [
                    'key'    => $key,
                    'anio'   => $anio,
                    'semana' => $semana,
                    'label'  => 'Semana ' . $semana
                ];
            }

            $cursor = $cursor->modify('+1 day');
        }

        $columnas = array_values($columnas);
        usort($columnas, function ($a, $b) {
            if ($a['anio'] === $b['anio']) {
                return $a['semana'] <=> $b['semana'];
            }
            return $a['anio'] <=> $b['anio'];
        });

        return $columnas;
    }

    private static function calcularSemanaCalendario(DateTimeImmutable $fecha): int
    {
        $diaAnio = (int)$fecha->format('z') + 1;
        $diaSemana = (int)$fecha->format('N');

        return max(1, intdiv($diaAnio - $diaSemana + 10, 7));
    }
}
