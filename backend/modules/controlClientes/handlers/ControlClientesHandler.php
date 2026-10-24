<?php

class ControlClientesHandler
{
    private const TIPO_DEFAULT = 'UndCorporativos';
    private const CORPORATIVO_DEFAULT = 'BOLIVAR PUMA JOSE ANTONIO';

    public static function obtenerFiltros(PDO $db): array
    {
        $rango = $db->query(
            "SELECT MIN(fecha) AS fecha_min, MAX(fecha) AS fecha_max
             FROM com_db_ctrl_cliente_pv
             WHERE fecha IS NOT NULL"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;
        $fechaInicioDefault = $fechaMin;

        if ($fechaMax) {
            $maxDt = new DateTimeImmutable($fechaMax);
            $inicioDt = $maxDt->modify('-1 month')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');

            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        $corporativos = [];
        $sqlCorporativos = "
            SELECT DISTINCT TRIM(coorporativo) AS nombre
            FROM com_db_ctrl_cliente_pv
            WHERE coorporativo IS NOT NULL AND TRIM(coorporativo) <> ''
            ORDER BY nombre ASC
        ";

        foreach ($db->query($sqlCorporativos)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $corporativos[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        $default = self::CORPORATIVO_DEFAULT;
        $encontrado = false;
        foreach ($corporativos as $item) {
            if ($item['id'] === $default) {
                $encontrado = true;
                break;
            }
        }
        if (!$encontrado && count($corporativos) > 0) {
            $default = $corporativos[0]['id'];
        }

        $zonas = [];
        $sqlZonas = "
            SELECT DISTINCT TRIM(zona) AS nombre
            FROM com_db_ctrl_cliente_pv
            WHERE zona IS NOT NULL AND TRIM(zona) <> ''
            ORDER BY nombre ASC
        ";

        foreach ($db->query($sqlZonas)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $zonas[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        $subzonas = [];
        $sqlSubzonas = "
            SELECT DISTINCT TRIM(subzona) AS nombre
            FROM com_db_ctrl_cliente_pv
            WHERE subzona IS NOT NULL AND TRIM(subzona) <> ''
            ORDER BY nombre ASC
        ";

        foreach ($db->query($sqlSubzonas)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $subzonas[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        return [
            'tipo_grafico'         => self::TIPO_DEFAULT,
            'titulo'               => 'Tendencia por Unidades',
            'fecha_min'            => $fechaMin,
            'fecha_max'            => $fechaMax,
            'fecha_inicio_default' => $fechaInicioDefault,
            'fecha_fin_default'    => $fechaMax,
            'corporativos'         => $corporativos,
            'coorporativo_default' => $default,
            'zonas'                => $zonas,
            'subzonas'             => $subzonas
        ];
    }

    public static function obtenerDatos(PDO $db, array $filtros): array
    {
        $tipoGrafico = trim((string)($filtros['tipo_grafico'] ?? 'UndCorporativos'));
        $fechaInicio = trim((string)($filtros['fecha_inicio'] ?? ''));
        $fechaFin = trim((string)($filtros['fecha_fin'] ?? ''));
        $coorporativo = trim((string)($filtros['coorporativo'] ?? ''));

        if ($fechaInicio === '' || $fechaFin === '') {
            $defecto = self::obtenerRangoDefault($db);
            $fechaInicio = $fechaInicio !== '' ? $fechaInicio : $defecto['inicio'];
            $fechaFin = $fechaFin !== '' ? $fechaFin : $defecto['fin'];
        }

        if ($coorporativo === '') {
            $coorporativo = self::CORPORATIVO_DEFAULT;
        }

        $fechaInicio = self::validarFecha($fechaInicio);
        $fechaFin = self::validarFecha($fechaFin);

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        if (in_array($tipoGrafico, [
            'ParetoCorporativos',
            'ParetoCorporativosZona',
            'ParetoCorporativosSubZona'
        ], true)) {
            return self::obtenerDatosPareto($db, $tipoGrafico, $fechaInicio, $fechaFin, $filtros);
        }

        if ($tipoGrafico === 'ParticipacionUnd' || $tipoGrafico === 'ParticipacionKilos') {
            return self::obtenerDatosParticipacionZona($db, $tipoGrafico, $fechaInicio, $fechaFin, $filtros);
        }

        if (in_array($tipoGrafico, ['AqpSubZonasCant', 'AqpSubZonasPeso', 'AqpSubClientes'], true)) {
            return self::obtenerDatosAqpParticipacion($db, $tipoGrafico, $fechaInicio, $fechaFin, $filtros);
        }

        if ($tipoGrafico === 'ConteoClientes') {
            return self::obtenerDatosConteoClientes($db, $fechaInicio, $fechaFin, $filtros);
        }

        if ($tipoGrafico === 'PesoCorporativos') {
            return self::obtenerDatosPesoCorporativos($db, $fechaInicio, $fechaFin, $coorporativo);
        }

        $sql = "
            SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                   SUM(total_unidad) AS total
            FROM com_db_ctrl_cliente_pv
            WHERE fecha >= :fecha_inicio
              AND fecha <= :fecha_fin
              AND TRIM(coorporativo) = :coorporativo
            GROUP BY fecha
            ORDER BY fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin,
            ':coorporativo' => $coorporativo
        ]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $labels = [];
        $valores = [];
        $total = 0.0;

        foreach ($filas as $fila) {
            $labels[] = $fila['fecha'];
            $valor = (float)($fila['total'] ?? 0);
            $valores[] = $valor;
            $total += $valor;
        }

        return [
            'tipo_grafico'  => self::TIPO_DEFAULT,
            'titulo'        => 'Tendencia por Unidades',
            'coorporativo'  => $coorporativo,
            'fecha_inicio'  => $fechaInicio,
            'fecha_fin'     => $fechaFin,
            'labels'        => $labels,
            'valores'       => $valores,
            'total'         => $total,
            'dias'          => count($labels)
        ];
    }

    private static function obtenerDatosParticipacionZona(PDO $db, string $tipoGrafico, string $fechaInicio, string $fechaFin, array $filtros): array
    {
        $zonas = self::normalizarLista($filtros['zonas'] ?? []);
        $subzonas = self::normalizarLista($filtros['subzonas'] ?? []);

        $where = [
            'fecha >= :fecha_inicio',
            'fecha <= :fecha_fin',
            "TRIM(zona) <> ''"
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        if (!empty($zonas)) {
            $ph = [];
            foreach ($zonas as $i => $zona) {
                $key = ":pz_zona_{$i}";
                $ph[] = $key;
                $params[$key] = $zona;
            }
            $where[] = 'TRIM(zona) IN (' . implode(',', $ph) . ')';
        }

        if (!empty($subzonas)) {
            $ph = [];
            foreach ($subzonas as $i => $subzona) {
                $key = ":pz_subzona_{$i}";
                $ph[] = $key;
                $params[$key] = $subzona;
            }
            $where[] = 'TRIM(subzona) IN (' . implode(',', $ph) . ')';
        }

        $sql = "
            SELECT TRIM(zona) AS zona,
                   SUM(total_unidad) AS total_unidad,
                   SUM(total_kilos) AS total_kilos
            FROM com_db_ctrl_cliente_pv
            WHERE " . implode(' AND ', $where) . "
            GROUP BY TRIM(zona)
            ORDER BY total_unidad DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filasRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $esKilos = $tipoGrafico === 'ParticipacionKilos';
        $medida = $esKilos ? 'total_kilos' : 'total_unidad';
        $total = 0.0;

        foreach ($filasRaw as $fila) {
            $total += (float)($fila[$medida] ?? 0);
        }

        $filas = [];
        foreach ($filasRaw as $fila) {
            $valor = (float)($fila[$medida] ?? 0);
            $filas[] = [
                'zona'          => trim((string)($fila['zona'] ?? '')),
                'total_unidad'  => (float)($fila['total_unidad'] ?? 0),
                'total_kilos'   => (float)($fila['total_kilos'] ?? 0),
                'valor'         => $valor,
                'porcentaje'    => $total > 0 ? round(($valor / $total) * 100, 2) : 0.0
            ];
        }

        return [
            'tipo_grafico'     => $tipoGrafico,
            'titulo'           => $esKilos ? 'Participación por Zona · Kilos' : 'Participación por Zona · Unidades',
            'subtitulo'        => 'Porcentaje de participación por zona',
            'medida'           => $medida,
            'etiqueta'         => $esKilos ? '% de total total_kilos' : '% de total total_unidad',
            'etiqueta_tooltip' => $esKilos ? '% de total total_kilos junto con zona' : '% de total total_unidad junto con zona',
            'color'            => $esKilos ? '#76B7B2' : '#4E79A7',
            'fecha_inicio'     => $fechaInicio,
            'fecha_fin'        => $fechaFin,
            'filas'            => $filas,
            'total'            => $total
        ];
    }

    private static function obtenerDatosAqpParticipacion(PDO $db, string $tipoGrafico, string $fechaInicio, string $fechaFin, array $filtros): array
    {
        $zonas = self::normalizarLista($filtros['zonas'] ?? []);
        $subzonas = self::normalizarLista($filtros['subzonas'] ?? []);
        $esSubzona = $tipoGrafico !== 'AqpSubClientes';
        $dimension = $esSubzona ? 'subzona' : 'coorporativo';

        $where = [
            'fecha >= :fecha_inicio',
            'fecha <= :fecha_fin',
            "TRIM(zona) <> ''"
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        if (!empty($zonas)) {
            $ph = [];
            foreach ($zonas as $i => $zona) {
                $key = ":aqp_zona_{$i}";
                $ph[] = $key;
                $params[$key] = $zona;
            }
            $where[] = 'TRIM(zona) IN (' . implode(',', $ph) . ')';
        }

        if ($esSubzona) {
            $where[] = "TRIM(subzona) <> ''";
            if (!empty($subzonas)) {
                $ph = [];
                foreach ($subzonas as $i => $subzona) {
                    $key = ":aqp_subzona_{$i}";
                    $ph[] = $key;
                    $params[$key] = $subzona;
                }
                $where[] = 'TRIM(subzona) IN (' . implode(',', $ph) . ')';
            }
        } else {
            $where[] = "TRIM(coorporativo) <> ''";
        }

        $selectDimension = $esSubzona ? 'TRIM(subzona)' : 'TRIM(coorporativo)';

        $sql = "
            SELECT {$selectDimension} AS etiqueta,
                   SUM(total_unidad) AS total_unidad,
                   SUM(total_kilos) AS total_kilos,
                   SUM(total_soles) AS total_soles
            FROM com_db_ctrl_cliente_pv
            WHERE " . implode(' AND ', $where) . "
            GROUP BY {$selectDimension}
            ORDER BY total_unidad DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filasRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totales = [
            'total_unidad' => 0.0,
            'total_kilos'  => 0.0,
            'total_soles'  => 0.0
        ];
        foreach ($filasRaw as $fila) {
            $totales['total_unidad'] += (float)($fila['total_unidad'] ?? 0);
            $totales['total_kilos'] += (float)($fila['total_kilos'] ?? 0);
            $totales['total_soles'] += (float)($fila['total_soles'] ?? 0);
        }

        $filas = [];
        foreach ($filasRaw as $fila) {
            $unidad = (float)($fila['total_unidad'] ?? 0);
            $kilos = (float)($fila['total_kilos'] ?? 0);
            $soles = (float)($fila['total_soles'] ?? 0);

            $filas[] = [
                'label'             => trim((string)($fila['etiqueta'] ?? '')),
                'total_unidad'      => $unidad,
                'total_kilos'       => $kilos,
                'total_soles'       => $soles,
                'porcentaje_unidad' => $totales['total_unidad'] > 0 ? round(($unidad / $totales['total_unidad']) * 100, 3) : 0.0,
                'porcentaje_kilos'  => $totales['total_kilos'] > 0 ? round(($kilos / $totales['total_kilos']) * 100, 3) : 0.0,
                'porcentaje_soles'  => $totales['total_soles'] > 0 ? round(($soles / $totales['total_soles']) * 100, 3) : 0.0
            ];
        }

        $meta = self::obtenerMetaAqpParticipacion($tipoGrafico, $esSubzona);

        return array_merge($meta, [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin,
            'dimension'    => $dimension,
            'filas'        => $filas,
            'total_registros' => count($filas)
        ]);
    }

    private static function obtenerMetaAqpParticipacion(string $tipoGrafico, bool $esSubzona): array
    {
        $etiquetaDimension = $esSubzona ? 'subzona' : 'coorporativo';
        $titulo = $esSubzona ? 'Participación por Subzona (AQP)' : 'Participación por Corporativo (AQP)';
        $subtitulo = $esSubzona ? 'Porcentaje de participación por subzona' : 'Porcentaje de participación por corporativo';

        if ($tipoGrafico === 'AqpSubZonasCant') {
            return [
                'tipo_grafico'      => $tipoGrafico,
                'titulo'            => $titulo . ' · Unidades',
                'subtitulo'         => $subtitulo,
                'dimension_label'   => $etiquetaDimension,
                'paneles'           => [[
                    'clave'      => 'porcentaje_unidad',
                    'etiqueta'   => '% de total total_unidad',
                    'tooltip'    => '% de total total_unidad junto con subzona',
                    'color'      => '#4E79A7',
                    'decimales'  => 2,
                    'tipo_label' => 'porcentaje',
                    'step_y'     => 5
                ]]
            ];
        }

        if ($tipoGrafico === 'AqpSubZonasPeso') {
            return [
                'tipo_grafico'      => $tipoGrafico,
                'titulo'            => $titulo . ' · Unidades, Kilos y Soles',
                'subtitulo'         => $subtitulo,
                'dimension_label'   => $etiquetaDimension,
                'paneles'           => [
                    [
                        'clave'      => 'porcentaje_unidad',
                        'etiqueta'   => '% de total total_unidad',
                        'tooltip'    => '% de total total_unidad junto con subzona',
                        'color'      => '#4E79A7',
                        'decimales'  => 2,
                        'tipo_label' => 'porcentaje',
                        'step_y'     => 20
                    ],
                    [
                        'clave'      => 'porcentaje_kilos',
                        'etiqueta'   => '% de total total_kilos',
                        'tooltip'    => '% de total total_kilos junto con subzona',
                        'color'      => '#4E79A7',
                        'decimales'  => 2,
                        'tipo_label' => 'fraccion_kg',
                        'step_y'     => 20
                    ],
                    [
                        'clave'      => 'porcentaje_soles',
                        'etiqueta'   => '% de total total_soles',
                        'tooltip'    => '% de total total_soles junto con subzona',
                        'color'      => '#4E79A7',
                        'decimales'  => 2,
                        'tipo_label' => 'fraccion_soles',
                        'step_y'     => 20
                    ]
                ]
            ];
        }

        return [
            'tipo_grafico'      => $tipoGrafico,
            'titulo'            => $titulo,
            'subtitulo'         => $subtitulo,
            'dimension_label'   => $etiquetaDimension,
            'paneles'           => [[
                'clave'      => 'porcentaje_unidad',
                'etiqueta'   => '% de total total_unidad',
                'tooltip'    => '% de total total_unidad junto con coorporativo',
                'color'      => '#4E79A7',
                'decimales'  => 2,
                'tipo_label' => 'porcentaje',
                'step_y'     => 1
            ]]
        ];
    }

    private static function obtenerDatosConteoClientes(PDO $db, string $fechaInicio, string $fechaFin, array $filtros): array
    {
        $zonas = self::normalizarLista($filtros['zonas'] ?? []);

        $where = [
            'fecha >= :fecha_inicio',
            'fecha <= :fecha_fin',
            "TRIM(zona) <> ''",
            "TRIM(cliente) <> ''"
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        if (!empty($zonas)) {
            $ph = [];
            foreach ($zonas as $i => $zona) {
                $key = ":conteo_zona_{$i}";
                $ph[] = $key;
                $params[$key] = $zona;
            }
            $where[] = 'TRIM(zona) IN (' . implode(',', $ph) . ')';
        }

        $sql = "
            SELECT TRIM(zona) AS zona,
                   YEAR(fecha) AS anio,
                   COUNT(DISTINCT TRIM(cliente)) AS clientes
            FROM com_db_ctrl_cliente_pv
            WHERE " . implode(' AND ', $where) . "
            GROUP BY TRIM(zona), YEAR(fecha)
            ORDER BY zona ASC, anio ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filasRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $anioInicio = (int)(new DateTimeImmutable($fechaInicio))->format('Y');
        $anioFin = (int)(new DateTimeImmutable($fechaFin))->format('Y');
        $anios = [];
        for ($anio = $anioInicio; $anio <= $anioFin; $anio++) {
            $anios[] = $anio;
        }

        $porZona = [];
        foreach ($filasRaw as $fila) {
            $zona = trim((string)($fila['zona'] ?? ''));
            $anio = (int)($fila['anio'] ?? 0);
            $clientes = (int)($fila['clientes'] ?? 0);
            if ($zona === '' || $anio <= 0) {
                continue;
            }
            if (!isset($porZona[$zona])) {
                $porZona[$zona] = [];
            }
            $porZona[$zona][$anio] = $clientes;
        }

        $zonasFilas = [];
        $maxConteo = 0;
        foreach ($porZona as $zona => $valoresPorAnio) {
            $valores = [];
            $total = 0;
            foreach ($anios as $anio) {
                $valor = (int)($valoresPorAnio[$anio] ?? 0);
                $valores[] = $valor;
                $total += $valor;
                if ($valor > $maxConteo) {
                    $maxConteo = $valor;
                }
            }
            $zonasFilas[] = [
                'zona'    => $zona,
                'valores' => $valores,
                'total'   => $total
            ];
        }

        $stepY = 50;
        $maxY = max(150, (int)(ceil($maxConteo / $stepY) * $stepY));

        return [
            'tipo_grafico'    => 'ConteoClientes',
            'titulo'          => 'Conteo de Clientes por Año',
            'subtitulo'       => 'Clientes únicos por zona y año',
            'etiqueta_zona'   => 'zona',
            'etiqueta_anio'   => 'Año de fecha',
            'etiqueta_y'      => 'Recuento de clientes',
            'anios'           => $anios,
            'zonas'           => $zonasFilas,
            'max_y'           => $maxY,
            'step_y'          => $stepY,
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'total_registros' => count($zonasFilas)
        ];
    }

    private static function obtenerDatosPareto(PDO $db, string $tipoGrafico, string $fechaInicio, string $fechaFin, array $filtros): array
    {
        $zonas = self::normalizarLista($filtros['zonas'] ?? []);
        $subzonas = self::normalizarLista($filtros['subzonas'] ?? []);

        $where = [
            'fecha >= :fecha_inicio',
            'fecha <= :fecha_fin',
            "TRIM(coorporativo) <> ''"
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        if (!empty($zonas)) {
            $ph = [];
            foreach ($zonas as $i => $zona) {
                $key = ":zona_{$i}";
                $ph[] = $key;
                $params[$key] = $zona;
            }
            $where[] = 'TRIM(zona) IN (' . implode(',', $ph) . ')';
        }

        if (!empty($subzonas)) {
            $ph = [];
            foreach ($subzonas as $i => $subzona) {
                $key = ":subzona_{$i}";
                $ph[] = $key;
                $params[$key] = $subzona;
            }
            $where[] = 'TRIM(subzona) IN (' . implode(',', $ph) . ')';
        }

        if ($tipoGrafico === 'ParetoCorporativosZona' || $tipoGrafico === 'ParetoCorporativosSubZona') {
            $where[] = "TRIM(zona) <> ''";
        }

        if ($tipoGrafico === 'ParetoCorporativosSubZona') {
            $where[] = "TRIM(subzona) <> ''";
        }

        if ($tipoGrafico === 'ParetoCorporativosZona') {
            $select = 'TRIM(zona) AS zona, NULL AS subzona, TRIM(coorporativo) AS coorporativo';
            $groupBy = 'TRIM(zona), TRIM(coorporativo)';
            $orderBy = 'zona ASC, total_kilos DESC';
        } elseif ($tipoGrafico === 'ParetoCorporativosSubZona') {
            $select = 'TRIM(zona) AS zona, TRIM(subzona) AS subzona, TRIM(coorporativo) AS coorporativo';
            $groupBy = 'TRIM(zona), TRIM(subzona), TRIM(coorporativo)';
            $orderBy = 'zona ASC, subzona ASC, total_kilos DESC';
        } else {
            $select = 'NULL AS zona, NULL AS subzona, TRIM(coorporativo) AS coorporativo';
            $groupBy = 'TRIM(coorporativo)';
            $orderBy = 'total_kilos DESC';
        }

        $sql = "
            SELECT {$select},
                   SUM(total_unidad) AS total_unidad,
                   SUM(total_kilos) AS total_kilos,
                   SUM(total_soles) AS total_soles
            FROM com_db_ctrl_cliente_pv
            WHERE " . implode(' AND ', $where) . "
            GROUP BY {$groupBy}
            ORDER BY {$orderBy}
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($filas as &$fila) {
            $fila['zona'] = $fila['zona'] !== null ? trim((string)$fila['zona']) : null;
            $fila['subzona'] = $fila['subzona'] !== null ? trim((string)$fila['subzona']) : null;
            $fila['coorporativo'] = trim((string)$fila['coorporativo']);
            $fila['total_unidad'] = (float)($fila['total_unidad'] ?? 0);
            $fila['total_kilos'] = (float)($fila['total_kilos'] ?? 0);
            $fila['total_soles'] = (float)($fila['total_soles'] ?? 0);
        }
        unset($fila);

        return [
            'tipo_grafico'    => $tipoGrafico,
            'titulo'          => 'Pareto de Ventas Corporativas',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'filas'           => $filas,
            'total_registros' => count($filas)
        ];
    }

    private static function normalizarLista($valor): array
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

        $resultado = [];
        foreach ($valor as $item) {
            $nombre = trim((string)$item);
            if ($nombre !== '' && $nombre !== '(Todo)' && strtoupper($nombre) !== 'ALL') {
                $resultado[$nombre] = true;
            }
        }

        return array_keys($resultado);
    }

    private static function obtenerDatosPesoCorporativos(PDO $db, string $fechaInicio, string $fechaFin, string $coorporativo): array
    {
        $sql = "
            SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                   SUM(COALESCE(brasa_kilos, 0)) AS brasa_kilos,
                   SUM(COALESCE(carne_kilos, 0)) AS carne_kilos,
                   SUM(COALESCE(total_kilos, 0)) AS total_kilos
            FROM com_db_ctrl_cliente_pv
            WHERE fecha >= :fecha_inicio
              AND fecha <= :fecha_fin
              AND TRIM(coorporativo) = :coorporativo
            GROUP BY fecha
            ORDER BY fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin,
            ':coorporativo' => $coorporativo
        ]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $labels = [];
        $brasa = [];
        $carne = [];
        $total = [];
        $totalBrasa = 0.0;
        $totalCarne = 0.0;
        $totalGeneral = 0.0;

        foreach ($filas as $fila) {
            $labels[] = $fila['fecha'];
            $valorBrasa = (float)($fila['brasa_kilos'] ?? 0);
            $valorCarne = (float)($fila['carne_kilos'] ?? 0);
            $valorTotal = (float)($fila['total_kilos'] ?? 0);

            $brasa[] = $valorBrasa;
            $carne[] = $valorCarne;
            $total[] = $valorTotal;

            $totalBrasa += $valorBrasa;
            $totalCarne += $valorCarne;
            $totalGeneral += $valorTotal;
        }

        return [
            'tipo_grafico' => 'PesoCorporativos',
            'titulo'       => 'Tendencia por Pesos y Tipos',
            'coorporativo' => $coorporativo,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin,
            'labels'       => $labels,
            'series'       => [
                [
                    'clave'   => 'brasa',
                    'label'   => 'brasa_kilos',
                    'color'   => '#59A14F',
                    'valores' => $brasa
                ],
                [
                    'clave'   => 'carne',
                    'label'   => 'carne_kilos',
                    'color'   => '#499894',
                    'valores' => $carne
                ],
                [
                    'clave'   => 'total',
                    'label'   => 'total_kilos',
                    'color'   => '#F28E2B',
                    'valores' => $total
                ]
            ],
            'totales'      => [
                'brasa_kilos' => $totalBrasa,
                'carne_kilos' => $totalCarne,
                'total_kilos' => $totalGeneral
            ],
            'dias'         => count($labels)
        ];
    }

    private static function obtenerRangoDefault(PDO $db): array
    {
        $rango = $db->query(
            "SELECT MIN(fecha) AS fecha_min, MAX(fecha) AS fecha_max
             FROM com_db_ctrl_cliente_pv
             WHERE fecha IS NOT NULL"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;

        if (!$fechaMax) {
            $hoy = new DateTimeImmutable('today');
            return [
                'inicio' => $hoy->modify('-1 month')->modify('first day of this month')->format('Y-m-d'),
                'fin'    => $hoy->format('Y-m-d')
            ];
        }

        $maxDt = new DateTimeImmutable($fechaMax);
        $inicioDt = $maxDt->modify('-1 month')->modify('first day of this month');
        $inicio = $inicioDt->format('Y-m-d');

        if ($fechaMin && $inicio < $fechaMin) {
            $inicio = $fechaMin;
        }

        return ['inicio' => $inicio, 'fin' => $fechaMax];
    }

    private static function validarFecha(string $fecha): string
    {
        $fecha = trim($fecha);
        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $fecha);

        if (!$dt || $dt->format('Y-m-d') !== $fecha) {
            throw new InvalidArgumentException('Fecha inválida: ' . $fecha);
        }

        return $fecha;
    }
}
