<?php

class DashGallinaHandler
{
    private static $mesesNombres = [
        1  => 'enero',
        2  => 'febrero',
        3  => 'marzo',
        4  => 'abril',
        5  => 'mayo',
        6  => 'junio',
        7  => 'julio',
        8  => 'agosto',
        9  => 'septiembre',
        10 => 'octubre',
        11 => 'noviembre',
        12 => 'diciembre'
    ];

    public static function obtenerFiltros(PDO $db): array
    {
        // 1. Rango global de fechas disponibles
        $sqlRango = "
            SELECT 
                MIN(a.fecha) AS fecha_min,
                MAX(a.fecha) AS fecha_max
            FROM com_db_gallina_cd a
            WHERE a.fecha IS NOT NULL
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;

        // 2. Listado de tipos de gallina
        $sqlTipos = "
            SELECT 
                t.codigo AS codigo,
                TRIM(t.nombre) AS nombre
            FROM com_tipo_gallina t
            WHERE t.nombre IS NOT NULL 
              AND TRIM(t.nombre) <> ''
            ORDER BY t.codigo ASC
        ";
        $stmtTipos = $db->query($sqlTipos);
        $tipos = [];

        foreach ($stmtTipos->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            $codigo = (string)($fila['codigo'] ?? '');
            if ($nombre !== '') {
                $tipos[] = [
                    'id'     => $nombre,
                    'codigo' => $codigo,
                    'label'  => $nombre
                ];
            }
        }

        // En Tableau por defecto se filtra por GALLINA REPRODUCTORA
        $tiposDefault = ['GALLINA REPRODUCTORA'];
        $encontrado = false;
        foreach ($tipos as $item) {
            if ($item['id'] === 'GALLINA REPRODUCTORA') {
                $encontrado = true;
                break;
            }
        }
        if (!$encontrado && count($tipos) > 0) {
            $tiposDefault = [$tipos[0]['id']];
        }

        // 3. Fechas por defecto: inicio del año actual hasta la fecha máxima (como en Tableau 2025-01-01 a fechaMax)
        $fechaInicioDefault = null;
        $fechaFinDefault = null;

        if ($fechaMax) {
            $fechaFinDefault = $fechaMax;
            $maxDt = new DateTimeImmutable($fechaMax);
            // Por defecto desde el primer día del mes anterior a la fecha máxima
            $inicioDt = $maxDt->modify('-1 month')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');
            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        return [
            'fecha_min'            => $fechaMin,
            'fecha_max'            => $fechaMax,
            'fecha_inicio_default' => $fechaInicioDefault,
            'fecha_fin_default'    => $fechaFinDefault,
            'tipos'                => $tipos,
            'tipos_default'        => $tiposDefault
        ];
    }

    public static function obtenerDatos(PDO $db, array $filtros): array
    {
        $fechaInicio = trim((string)($filtros['fecha_inicio'] ?? ''));
        $fechaFin    = trim((string)($filtros['fecha_fin'] ?? ''));

        if ($fechaInicio === '' || $fechaFin === '') {
            $filtrosDef = self::obtenerFiltros($db);
            $fechaInicio = $fechaInicio !== '' ? $fechaInicio : ($filtrosDef['fecha_inicio_default'] ?? date('Y-01-01'));
            $fechaFin    = $fechaFin !== ''    ? $fechaFin    : ($filtrosDef['fecha_fin_default'] ?? date('Y-m-d'));
        }

        // Tipos de gallina seleccionados
        $tiposRaw = $filtros['tipos'] ?? [];
        if (!is_array($tiposRaw)) {
            $tiposRaw = $tiposRaw !== '' ? [$tiposRaw] : [];
        }
        $tiposLimpios = array_values(array_filter(array_map('trim', $tiposRaw)));

        if (empty($tiposLimpios)) {
            $tiposLimpios = ['GALLINA REPRODUCTORA'];
        }

        $placeholders = [];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        foreach ($tiposLimpios as $idx => $tipoVal) {
            $phNombre = ":tipo_nom_{$idx}";
            $phCodigo = ":tipo_cod_{$idx}";
            $placeholders[] = "t.nombre = {$phNombre} OR a.tipo = {$phCodigo}";
            $params[$phNombre] = $tipoVal;
            $params[$phCodigo] = $tipoVal;
        }

        $whereTipos = '(' . implode(' OR ', $placeholders) . ')';

        $sql = "
            SELECT 
                a.fecha,
                DATE_FORMAT(a.fecha, '%Y-%m') AS anio_mes,
                DATE_FORMAT(a.fecha, '%d/%m/%Y') AS fecha_formato,
                DATE_FORMAT(a.fecha, '%Y/%m/%d') AS fecha_label,
                SUM(a.unidades) AS total_unidades,
                SUM(a.kilos) AS total_kilos,
                SUM(a.peso) AS total_peso,
                AVG(a.peso) AS peso_diario
            FROM com_db_gallina_cd a
            INNER JOIN com_tipo_gallina t ON a.tipo = t.codigo
            WHERE a.fecha BETWEEN :fecha_inicio AND :fecha_fin
              AND {$whereTipos}
            GROUP BY a.fecha
            ORDER BY a.fecha ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar filas por mes para calcular WINDOW_AVG mensual tal como Tableau
        $mesesData = [];
        foreach ($filas as $fila) {
            $mes = $fila['anio_mes'];
            if (!isset($mesesData[$mes])) {
                $mesesData[$mes] = [
                    'dias_count'     => 0,
                    'suma_unidades'  => 0.0,
                    'suma_kilos'     => 0.0,
                    'suma_peso'      => 0.0
                ];
            }
            $mesesData[$mes]['dias_count']++;
            $mesesData[$mes]['suma_unidades'] += (float)$fila['total_unidades'];
            $mesesData[$mes]['suma_kilos']    += (float)$fila['total_kilos'];
            $mesesData[$mes]['suma_peso']     += (float)$fila['total_peso'];
        }

        // Promedios mensuales calculados con nombres en español (ej. "junio de 2026")
        $promediosPorMes = [];
        foreach ($mesesData as $mes => $info) {
            $cnt = $info['dias_count'] > 0 ? $info['dias_count'] : 1;
            $partes = explode('-', $mes);
            $anio = $partes[0] ?? '';
            $numMes = isset($partes[1]) ? (int)$partes[1] : 1;
            $nombreMes = self::$mesesNombres[$numMes] ?? 'mes';
            $mesLabel = "{$nombreMes} de {$anio}";

            $promediosPorMes[$mes] = [
                'mes'          => $mes,
                'mes_label'    => $mesLabel,
                'dias'         => $info['dias_count'],
                'prom_unidades'=> (int)round($info['suma_unidades'] / $cnt, 0),
                'prom_kilos'   => round($info['suma_kilos'] / $cnt, 2),
                'prom_peso'    => round($info['suma_peso'] / $cnt, 6)
            ];
        }

        // Estructuras para Chart.js y bloques de mes
        $fechasLabels = [];
        $puntosMeses = [];
        $unidadesDiarias = [];
        $unidadesPromMensual = [];
        $pesoDiario = [];
        $pesoPromMensual = [];
        $kilosDiarios = [];
        $kilosPromMensual = [];

        $totalUnidadesAcum = 0;
        $totalKilosAcum = 0.0;
        $bloquesMes = [];

        foreach ($filas as $idx => $fila) {
            $mes = $fila['anio_mes'];
            $promMes = $promediosPorMes[$mes] ?? [
                'mes_label'     => $mes,
                'prom_unidades' => 0,
                'prom_kilos'    => 0,
                'prom_peso'     => 0
            ];

            if (!isset($bloquesMes[$mes])) {
                $bloquesMes[$mes] = [
                    'anio_mes'      => $mes,
                    'mes_label'     => $promMes['mes_label'],
                    'index_inicio'  => $idx,
                    'index_fin'     => $idx,
                    'prom_unidades' => $promMes['prom_unidades'],
                    'prom_kilos'    => $promMes['prom_kilos'],
                    'prom_peso'     => $promMes['prom_peso'],
                    'dias'          => $promMes['dias']
                ];
            } else {
                $bloquesMes[$mes]['index_fin'] = $idx;
            }

            $u = (int)$fila['total_unidades'];
            $k = round((float)$fila['total_kilos'], 2);
            $p = round((float)$fila['peso_diario'], 6);

            $fechasLabels[]        = $fila['fecha_label']; // '2026/06/26'
            $puntosMeses[]         = $promMes['mes_label']; // 'junio de 2026'

            $unidadesDiarias[]     = $u;
            $unidadesPromMensual[] = $promMes['prom_unidades'];

            $pesoDiario[]          = $p;
            $pesoPromMensual[]     = $promMes['prom_peso'];

            $kilosDiarios[]        = $k;
            $kilosPromMensual[]    = $promMes['prom_kilos'];

            $totalUnidadesAcum += $u;
            $totalKilosAcum    += $k;
        }

        $pesoPromedioGeneral = $totalUnidadesAcum > 0 
            ? round($totalKilosAcum / $totalUnidadesAcum, 2) 
            : 0.0;

        return [
            'filtros_aplicados' => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'tipos'        => $tiposLimpios
            ],
            'kpis' => [
                'total_unidades'        => $totalUnidadesAcum,
                'total_kilos'           => round($totalKilosAcum, 2),
                'peso_promedio_general' => $pesoPromedioGeneral,
                'total_dias'            => count($filas)
            ],
            'bloques_mes'   => array_values($bloquesMes),
            'promedios_mes' => $promediosPorMes,
            'labels'        => $fechasLabels,
            'puntos_meses'  => $puntosMeses,
            'series'        => [
                'unidades' => [
                    'diario'   => $unidadesDiarias,
                    'promedio' => $unidadesPromMensual
                ],
                'peso' => [
                    'diario'   => $pesoDiario,
                    'promedio' => $pesoPromMensual
                ],
                'kilos' => [
                    'diario'   => $kilosDiarios,
                    'promedio' => $kilosPromMensual
                ]
            ]
        ];
    }
}
