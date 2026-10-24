<?php

class TamanoMercadoHandler
{
    // Paleta de colores oficial asignada en Tableau para Tamaño de Mercado
    public static $coloresEmpresas = [
        'GRANJA RINCONADA DEL SUR' => '#00007F',
        'GRANJA RENZO'             => '#499894',
        'FAFIO'                    => '#4E79A7',
        'RENZO'                    => '#4E79A7',
        'GRANJAS INFORMALES'       => '#59A14F',
        'SANTA ELENA'              => '#59A14F',
        'GRANJAS DE LIMA'          => '#76B7B2',
        'GRANJAS PEDREGAL'         => '#79706E',
        'CARIOCA'                  => '#8CD17D',
        'SANTA SOFIA'              => '#8CD17D',
        'OTROS LIMA'               => '#9D7660',
        'AGROSUR'                  => '#A0CBE8',
        'MOLLENDINO'               => '#B07AA1',
        'ROSARIO DEL SUR'          => '#B07AA1',
        'CHRISTIAN LIMA'           => '#B6992D',
        'SUMAQ POLLO'              => '#B6992D',
        'SUMAG POLLO'              => '#B6992D',
        'HUMALA'                   => '#BAB0AC',
        'IMBA'                     => '#D37295',
        'OTROS AREQUIPA'           => '#D4A6C8',
        'POLLO DEL NORTE'          => '#D7B5A6',
        'GRANJAS CHICAS'           => '#E15759',
        'RICO POLLO'               => '#EDC948',
        'RICO POLLO S.A.C'         => '#EDC948',
        'EL ROSARIO'               => '#F1CE63',
        'TOP CHIKEN'               => '#F1CE63',
        'AVICOLA QUISPE'           => '#F28E2B',
        'SAN FERNANDO LIMA'        => '#F28E2B',
        'ITE'                      => '#FABFD2',
        'JUVENAL'                  => '#FABFD2',
        'GRANJAS LIMA'             => '#FF9D9A',
        'RP/GRS'                   => '#FF9DA7',
        'AVICOLA SUREÑA'           => '#FFBE7D',
        'SANTA ANGELA'             => '#FFBE7D'
    ];

    public static function obtenerFiltros(PDO $db): array
    {
        // 1. Rango de fechas disponibles
        $sqlRango = "
            SELECT 
                MIN(fecha) AS fecha_min,
                MAX(fecha) AS fecha_max
            FROM com_db_tama_mer_dia
            WHERE fecha IS NOT NULL
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? '2023-05-01';
        $fechaMax = $rango['fecha_max'] ?? date('Y-m-d');

        // Rango por defecto dinámico: último mes con data
        $fechaInicioDefault = null;
        $fechaFinDefault = null;

        if ($fechaMax) {
            $fechaFinDefault = $fechaMax;
            $maxDt = new DateTimeImmutable($fechaMax);
            $inicioDt = $maxDt->modify('-1 month')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');

            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        // 2. Provincias disponibles (solo las del tablero Tableau)
        $sqlProv = "
            SELECT 
                p.codigo,
                TRIM(p.nombre) AS nombre
            FROM com_db_tama_mer_dia s
            INNER JOIN com_provincia p ON s.provincia = p.codigo
            GROUP BY p.codigo, TRIM(p.nombre)
            ORDER BY nombre ASC
        ";
        $stmtProv = $db->query($sqlProv);

        $provinciasPermitidas = ['AREQUIPA', 'MOQUEGUA', 'PUNO', 'TACNA'];
        $provinciasDb = [];

        foreach ($stmtProv->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $nom = trim((string)$row['nombre']);
            if ($nom !== '') {
                $provinciasDb[$nom] = [
                    'id'     => $nom,
                    'codigo' => (int)$row['codigo'],
                    'label'  => $nom
                ];
            }
        }

        $provincias = [];
        foreach ($provinciasPermitidas as $nom) {
            $provincias[] = $provinciasDb[$nom] ?? [
                'id'     => $nom,
                'codigo' => null,
                'label'  => $nom
            ];
        }

        // 3. Empresas disponibles
        $sqlEmp = "
            SELECT 
                e.codigo,
                TRIM(e.nombre) AS nombre
            FROM com_db_tama_mer_dia s
            INNER JOIN com_empresa e ON s.empresa = e.codigo
            GROUP BY e.codigo, TRIM(e.nombre)
            ORDER BY nombre ASC
        ";
        $stmtEmp = $db->query($sqlEmp);
        $empresas = [];
        $empresasDefault = [];

        foreach ($stmtEmp->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $nom = trim((string)$row['nombre']);
            $empresas[] = [
                'id'     => $nom,
                'codigo' => (int)$row['codigo'],
                'label'  => $nom
            ];
            $empresasDefault[] = $nom;
        }

        return [
            'fecha_min'            => $fechaMin,
            'fecha_max'            => $fechaMax,
            'fecha_inicio_default' => $fechaInicioDefault,
            'fecha_fin_default'    => $fechaFinDefault,
            'provincia_default'    => '(Todo)',
            'provincias_default'   => array_column($provincias, 'id'),
            'provincias'           => $provincias,
            'empresas'             => $empresas,
            'empresas_default'     => $empresasDefault
        ];
    }

    public static function obtenerDatos(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim((string)$filtros['fecha_inicio']) : null;
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim((string)$filtros['fecha_fin']) : null;

        if (!$fechaInicio || !$fechaFin) {
            $limites = self::obtenerFiltros($db);
            $fechaInicio = $fechaInicio ?: $limites['fecha_inicio_default'];
            $fechaFin    = $fechaFin ?: $limites['fecha_fin_default'];
        }

        $where = ["s.fecha BETWEEN :fecha_inicio AND :fecha_fin"];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ];

        // Filtro Provincias (multi-select)
        $provinciasSeleccionadas = [];
        if (!empty($filtros['provincias'])) {
            $provinciasSeleccionadas = is_array($filtros['provincias'])
                ? array_map('trim', $filtros['provincias'])
                : [trim((string)$filtros['provincias'])];
        } elseif (!empty($filtros['provincia'])) {
            $provinciasSeleccionadas = [trim((string)$filtros['provincia'])];
        }

        $provinciasSeleccionadas = array_values(array_filter($provinciasSeleccionadas, function ($valor) {
            return $valor !== '' && $valor !== '(Todo)' && strtoupper($valor) !== 'ALL';
        }));

        if (!empty($provinciasSeleccionadas)) {
            $provClauses = [];
            foreach ($provinciasSeleccionadas as $i => $provNombre) {
                $key = ":p_nom_{$i}";
                $provClauses[] = "TRIM(p.nombre) = {$key}";
                $params[$key] = $provNombre;
            }
            $where[] = '(' . implode(' OR ', $provClauses) . ')';
        }

        // Filtro Empresas
        $empresasSeleccionadas = [];
        if (!empty($filtros['empresas'])) {
            if (is_array($filtros['empresas'])) {
                $empresasSeleccionadas = array_map('trim', $filtros['empresas']);
            } else {
                $empresasSeleccionadas = [trim((string)$filtros['empresas'])];
            }
        }

        if (!empty($empresasSeleccionadas) && !in_array('(Todo)', $empresasSeleccionadas, true)) {
            $empClauses = [];
            foreach ($empresasSeleccionadas as $i => $eVal) {
                $keyNom = ":e_nom_{$i}";
                $empClauses[] = "TRIM(e.nombre) = {$keyNom}";
                $params[$keyNom] = $eVal;
            }
            $where[] = '(' . implode(' OR ', $empClauses) . ')';
        }

        $whereClause = implode(' AND ', $where);

        // Consulta unificada optimizada
        $sql = "
            SELECT 
                DATE_FORMAT(s.fecha, '%Y-%m-%d') AS fecha,
                e.codigo AS empresa_id,
                TRIM(e.nombre) AS empresa_nombre,
                SUM(s.cantidad) AS total_unidades,
                SUM(s.peso) AS total_peso,
                SUM(s.precio * s.peso) AS total_importe,
                AVG(s.prom) AS avg_prom,
                COUNT(s.prom) AS filas_prom
            FROM com_db_tama_mer_dia s
            INNER JOIN com_empresa e ON s.empresa = e.codigo
            INNER JOIN com_provincia p ON s.provincia = p.codigo
            WHERE {$whereClause}
            GROUP BY s.fecha, e.codigo, TRIM(e.nombre)
            ORDER BY s.fecha ASC, total_unidades DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 1. Obtener lista cronológica de fechas únicas
        $fechasMap = [];
        $totalesPorFecha = []; // fecha => ['unidades' => X, 'peso' => Y, 'importe' => Z]
        $empresasAcumulado = []; // empresa => [totales generales...]

        foreach ($filas as $f) {
            $fec = $f['fecha'];
            $emp = $f['empresa_nombre'];
            $und = (float)$f['total_unidades'];
            $pes = (float)$f['total_peso'];
            $imp = (float)$f['total_importe'];
            $prom = (float)$f['avg_prom'];
            $filasProm = (int)$f['filas_prom'];

            if (!isset($fechasMap[$fec])) {
                $fechasMap[$fec] = true;
                $totalesPorFecha[$fec] = [
                    'unidades'   => 0.0,
                    'peso'       => 0.0,
                    'importe'    => 0.0,
                    'prom_suma'  => 0.0,
                    'prom_filas' => 0
                ];
            }

            $totalesPorFecha[$fec]['unidades'] += $und;
            $totalesPorFecha[$fec]['peso']     += $pes;
            $totalesPorFecha[$fec]['importe']  += $imp;
            $totalesPorFecha[$fec]['prom_suma']  += $prom * $filasProm;
            $totalesPorFecha[$fec]['prom_filas'] += $filasProm;

            if (!isset($empresasAcumulado[$emp])) {
                $empresasAcumulado[$emp] = [
                    'nombre'        => $emp,
                    'total_unidades'=> 0.0,
                    'total_peso'    => 0.0,
                    'total_importe' => 0.0,
                    'datos_fechas'  => [] // fecha => [und, pes, imp]
                ];
            }

            $empresasAcumulado[$emp]['total_unidades'] += $und;
            $empresasAcumulado[$emp]['total_peso']     += $pes;
            $empresasAcumulado[$emp]['total_importe']  += $imp;
            $empresasAcumulado[$emp]['datos_fechas'][$fec] = [
                'unidades' => $und,
                'peso'     => $pes,
                'importe'  => $imp
            ];
        }

        $labels = array_keys($fechasMap);
        sort($labels);
        $numFechas = count($labels);

        // Ordenar empresas por volumen de unidades descendente
        uasort($empresasAcumulado, function ($a, $b) {
            return $b['total_unidades'] <=> $a['total_unidades'];
        });

        // 2. Construir series para Participación (Stacked 100%) y demás gráficos
        $seriesParticipacion = [];
        $granTotalUnidades = 0.0;
        $granTotalPeso = 0.0;
        $granTotalImporte = 0.0;

        foreach ($totalesPorFecha as $fec => $tot) {
            $granTotalUnidades += $tot['unidades'];
            $granTotalPeso     += $tot['peso'];
            $granTotalImporte  += $tot['importe'];
        }

        $colorPaletteAux = [
            '#002B7F', '#EDC948', '#F28E2B', '#59A14F', '#76B7B2',
            '#E15759', '#499894', '#4E79A7', '#B6992D', '#B07AA1',
            '#F1CE63', '#D4A6C8', '#9D7660', '#FF9D9A', '#FFBE7D',
            '#8CD17D', '#BAB0AC', '#D37295', '#D7B5A6', '#FABFD2'
        ];
        $colorIdx = 0;

        foreach ($empresasAcumulado as $emp => $info) {
            $color = self::$coloresEmpresas[$emp] ?? null;
            if (!$color) {
                $color = $colorPaletteAux[$colorIdx % count($colorPaletteAux)];
                $colorIdx++;
            }

            $porcentajes = [];
            $unidadesArr = [];
            $pesosArr = [];

            foreach ($labels as $fec) {
                $totDia = $totalesPorFecha[$fec]['unidades'] ?? 0;
                $empData = $info['datos_fechas'][$fec] ?? null;

                if ($empData) {
                    $und = (float)$empData['unidades'];
                    $pes = (float)$empData['peso'];
                    $pct = $totDia > 0 ? round(($und / $totDia) * 100, 2) : 0.0;

                    $porcentajes[] = $pct;
                    $unidadesArr[] = $und;
                    $pesosArr[]    = $pes;
                } else {
                    $porcentajes[] = null;
                    $unidadesArr[] = null;
                    $pesosArr[]    = null;
                }
            }

            $shareTotal = $granTotalUnidades > 0 
                ? round(($info['total_unidades'] / $granTotalUnidades) * 100, 2) 
                : 0.0;

            $seriesParticipacion[] = [
                'nombre'                 => $emp,
                'color'                  => $color,
                'porcentajes'            => $porcentajes,
                'unidades'               => $unidadesArr,
                'pesos'                  => $pesosArr,
                'total_unidades'         => $info['total_unidades'],
                'total_peso'             => $info['total_peso'],
                'participacion_global'   => $shareTotal
            ];
        }

        // Totales por día ordenados según labels
        $totalesUnidadesDia = [];
        $totalesPesoDia = [];
        $totalesImporteDia = [];
        $promedioPesoDia = [];

        foreach ($labels as $fec) {
            $totalesUnidadesDia[] = $totalesPorFecha[$fec]['unidades'] ?? 0;
            $totalesPesoDia[]     = $totalesPorFecha[$fec]['peso'] ?? 0;
            $totalesImporteDia[]  = $totalesPorFecha[$fec]['importe'] ?? 0;

            $filasProm = (int)($totalesPorFecha[$fec]['prom_filas'] ?? 0);
            $promedioPesoDia[] = $filasProm > 0
                ? round(($totalesPorFecha[$fec]['prom_suma'] ?? 0) / $filasProm, 3)
                : 0.0;
        }

        // Empresa líder
        $empresaLider = !empty($seriesParticipacion) ? $seriesParticipacion[0] : null;

        return [
            'labels'             => $labels,
            'participacion'      => [
                'series'            => $seriesParticipacion,
                'totales_dia'       => $totalesUnidadesDia
            ],
            'resumen_diario'     => [
                'unidades'      => $totalesUnidadesDia,
                'pesos'         => $totalesPesoDia,
                'importes'      => $totalesImporteDia,
                'promedio_peso' => $promedioPesoDia
            ],
            'kpis'               => [
                'total_unidades'        => $granTotalUnidades,
                'total_peso'            => $granTotalPeso,
                'total_importe'         => $granTotalImporte,
                'promedio_peso_ave'     => $granTotalUnidades > 0 ? round($granTotalPeso / $granTotalUnidades, 3) : 0,
                'total_dias'            => $numFechas,
                'total_empresas'        => count($seriesParticipacion),
                'empresa_lider'         => $empresaLider ? [
                    'nombre'        => $empresaLider['nombre'],
                    'participacion' => $empresaLider['participacion_global'],
                    'unidades'      => $empresaLider['total_unidades'],
                    'color'         => $empresaLider['color']
                ] : null
            ],
            'filtros_aplicados'  => [
                'fecha_inicio' => $fechaInicio,
                'fecha_fin'    => $fechaFin,
                'provincia'    => count($provinciasSeleccionadas) === 1 ? $provinciasSeleccionadas[0] : '(Todo)',
                'provincias'   => $provinciasSeleccionadas,
                'empresas'     => $empresasSeleccionadas
            ]
        ];
    }
}
