<?php

class ConsumoLimaDashAnalisisHandler
{
    private const PAGE_SIZE_DEFAULT = 50;
    private const PAGE_SIZE_MAX = 200;
    private const DALM_DOCUMENTOS = ['JO1', 'JO2', 'JO3', 'JO4', 'JO8', 'JO9', 'MA1', 'MA2', 'MA3', 'MA4'];

    public static function filtros(PDO $db): array
    {
        $almacenes = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(talm) AS valor
             FROM imov
             WHERE TRIM(IFNULL(talm, '')) <> ''
             ORDER BY valor ASC"
        );

        $articulos = self::consultaFilas(
            $db,
            "SELECT DISTINCT
                    TRIM(i.tcodigo) AS id,
                    TRIM(m.descri) AS descripcion
             FROM imov i
             INNER JOIN mitm m ON i.tcodigo = m.codigo
             WHERE TRIM(IFNULL(i.tcodigo, '')) <> ''
             ORDER BY id ASC"
        );

        $lotes = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(tlote) AS valor
             FROM imov
             WHERE TRIM(IFNULL(tlote, '')) <> ''
             ORDER BY valor ASC"
        );

        $transacciones = self::consultaColumna(
            $db,
            "SELECT DISTINCT TRIM(tcodtra) AS valor
             FROM imov
             WHERE TRIM(IFNULL(tcodtra, '')) <> ''
             ORDER BY valor ASC"
        );

        $rangoImov = self::consultaFila(
            $db,
            "SELECT
                DATE_FORMAT(MIN(tfectra), '%Y-%m-%d') AS fecha_min,
                DATE_FORMAT(MAX(tfectra), '%Y-%m-%d') AS fecha_max
             FROM imov
             WHERE tfectra IS NOT NULL
               AND tfectra > '1000-01-01'"
        );

        $rangoDmov = self::consultaFila(
            $db,
            "SELECT
                DATE_FORMAT(MIN(dfectra), '%Y-%m-%d') AS fecha_min,
                DATE_FORMAT(MAX(dfectra), '%Y-%m-%d') AS fecha_max
             FROM dmov
             WHERE dfectra IS NOT NULL
               AND dfectra > '1000-01-01'"
        );

        return [
            'almacenes' => array_values(array_filter($almacenes, function ($valor) {
                return trim((string)$valor) !== '';
            })),
            'articulos' => array_values(array_map(function ($fila) {
                $id = trim((string)($fila['id'] ?? ''));
                $descripcion = trim((string)($fila['descripcion'] ?? ''));
                return [
                    'id' => $id,
                    'label' => $id,
                    'descripcion' => $descripcion
                ];
            }, $articulos)),
            'lotes' => array_values(array_filter($lotes, function ($valor) {
                return trim((string)$valor) !== '';
            })),
            'transacciones' => array_values(array_filter($transacciones, function ($valor) {
                return trim((string)$valor) !== '';
            })),
            'fecha_min' => $rangoImov['fecha_min'] ?? null,
            'fecha_max' => $rangoImov['fecha_max'] ?? null,
            'documentos_fecha_min' => $rangoDmov['fecha_min'] ?? null,
            'documentos_fecha_max' => $rangoDmov['fecha_max'] ?? null
        ];
    }

    public static function consumos(PDO $db, array $filtros): array
    {
        return self::consultarMovimientos($db, $filtros, 'consumos');
    }

    public static function comprasAlmacen(PDO $db, array $filtros): array
    {
        return self::consultarMovimientos($db, $filtros, 'compras');
    }

    public static function comprasDocumentos(PDO $db, array $filtros): array
    {
        [$page, $pageSize, $offset] = self::paginacion($filtros);
        [$where, $params] = self::whereDocumentos($filtros);

        $whereSql = implode(' AND ', $where);
        $selectSql = "SELECT
                        CAST(d.dnumfac AS UNSIGNED) AS documento,
                        TRIM(d.dprocli) AS codproveedor,
                        TRIM(c.nombre) AS nomproveedor,
                        TRIM(d.damarre) AS amarre,
                        SUM(d.dimport) AS importe_soles,
                        SUM(d.dimpdol) AS importe_dolares,
                        SUM(d.tpeso) AS peso,
                        SUM(d.despeci) AS cantidad,
                        CASE WHEN SUM(d.tpeso) <> 0 THEN SUM(d.dimport) / SUM(d.tpeso) END AS pu_soles,
                        CASE WHEN SUM(d.tpeso) <> 0 THEN SUM(d.dimpdol) / SUM(d.tpeso) END AS pu_dolares,
                        CASE WHEN SUM(d.dimpdol) <> 0 THEN SUM(d.dimport) / SUM(d.dimpdol) END AS tc,
                        CASE WHEN COUNT(DISTINCT d.dglosa) = 1 THEN MAX(d.dglosa) ELSE '*' END AS dglosa
                    FROM dmov d
                    INNER JOIN ccte c ON d.dprocli = c.codigo
                    LEFT JOIN mitm m ON d.damarre = m.codigo
                    WHERE {$whereSql}
                    GROUP BY documento, codproveedor, nomproveedor, amarre";

        $stmtResumen = $db->prepare("SELECT
                                        COUNT(*) AS total,
                                        MAX(importe_soles) AS max_importe_soles,
                                        MAX(importe_dolares) AS max_importe_dolares,
                                        MAX(peso) AS max_peso,
                                        MAX(cantidad) AS max_cantidad,
                                        MAX(pu_soles) AS max_pu_soles,
                                        MAX(pu_dolares) AS max_pu_dolares,
                                        MAX(tc) AS max_tc
                                    FROM ({$selectSql}) t");
        $stmtResumen->execute($params);
        $resumen = $stmtResumen->fetch(PDO::FETCH_ASSOC) ?: [];
        $total = (int)($resumen['total'] ?? 0);

        $sql = "{$selectSql}
                ORDER BY documento ASC, codproveedor ASC, nomproveedor ASC, amarre ASC
                LIMIT {$pageSize} OFFSET {$offset}";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return [
            'status' => 'success',
            'tipo' => 'compras_documentos',
            'filas' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'total_paginas' => $total > 0 ? (int)ceil($total / $pageSize) : 0,
            'maximos' => [
                'importe_soles' => (float)($resumen['max_importe_soles'] ?? 0),
                'importe_dolares' => (float)($resumen['max_importe_dolares'] ?? 0),
                'peso' => (float)($resumen['max_peso'] ?? 0),
                'cantidad' => (float)($resumen['max_cantidad'] ?? 0),
                'pu_soles' => (float)($resumen['max_pu_soles'] ?? 0),
                'pu_dolares' => (float)($resumen['max_pu_dolares'] ?? 0),
                'tc' => (float)($resumen['max_tc'] ?? 0)
            ],
            'filtros' => self::filtrosAplicados($filtros)
        ];
    }

    public static function analisisMermas(PDO $db, array $filtros): array
    {
        [$where, $params] = self::whereMovimientos($filtros);
        $seleccionesMesGlo = self::normalizarSelecciones($filtros['selecciones_mes_glo'] ?? []);
        $seleccionesMesLote = self::normalizarSelecciones($filtros['selecciones_mes_lote'] ?? []);
        $transacciones = array_key_exists('transacciones', $filtros)
            ? self::normalizarLista($filtros['transacciones'])
            : ['S003', 'S811'];

        if ($transacciones) {
            $where[] = 'TRIM(i.tcodtra) IN (' . self::marcadores($transacciones, 'merma_tra', $params) . ')';
        }

        [$page, $pageSize, $offset] = self::paginacion($filtros);
        $whereSql = implode(' AND ', $where);
        $sql = "SELECT
                    TRIM(i.tcodigo) AS codigo,
                    TRIM(m.descri) AS descripcion,
                    TRIM(i.tlote) AS lote,
                    TRIM(i.tcodtra) AS transaccion,
                    DATE_FORMAT(i.tfectra, '%Y-%m') AS mes,
                    DATE_FORMAT(i.tfectra, '%Y-%m-%d') AS dia,
                    SUM(i.tpeso) AS peso
                FROM imov i
                INNER JOIN mitm m ON i.tcodigo = m.codigo
                WHERE {$whereSql}
                GROUP BY codigo, descripcion, lote, transaccion, mes, dia
                HAVING SUM(i.tpeso) <> 0
                ORDER BY codigo ASC, descripcion ASC, lote ASC, dia ASC, transaccion DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $meses = [];
        $dias = [];
        $topDetalle = [];
        $topTotalesMes = [];
        $loteDetalle = [];
        $loteTotalesMes = [];
        $loteTotalesDia = [];
        $totalGeneralMes = [];
        $totalGeneralDia = [];

        foreach ($raw as $fila) {
            $codigo = (string)($fila['codigo'] ?? '');
            $descripcion = (string)($fila['descripcion'] ?? '');
            $lote = (string)($fila['lote'] ?? '');
            $transaccion = (string)($fila['transaccion'] ?? '');
            $mes = (string)($fila['mes'] ?? '');
            $dia = (string)($fila['dia'] ?? '');
            $peso = (float)($fila['peso'] ?? 0);

            $meses[$mes] = true;
            $dias[$dia] = true;
            $claveArticulo = $codigo . "\x1F" . $descripcion;
            $claveTop = $claveArticulo . "\x1F" . $transaccion;
            $claveLote = $claveArticulo . "\x1F" . $lote;
            $claveLoteTra = $claveLote . "\x1F" . $transaccion;
            $claveLoteMes = $claveLote . "\x1F" . $mes;
            $claveLoteDia = $claveLote . "\x1F" . $dia;

            if (!isset($topDetalle[$claveTop])) {
                $topDetalle[$claveTop] = [
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'transaccion' => $transaccion,
                    'meses' => []
                ];
            }
            $topDetalle[$claveTop]['meses'][$mes] = ($topDetalle[$claveTop]['meses'][$mes] ?? 0) + $peso;

            if (!isset($loteDetalle[$claveLoteTra])) {
                $loteDetalle[$claveLoteTra] = [
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'lote' => $lote,
                    'transaccion' => $transaccion,
                    'meses' => [],
                    'dias' => []
                ];
            }
            $loteDetalle[$claveLoteTra]['meses'][$mes] = ($loteDetalle[$claveLoteTra]['meses'][$mes] ?? 0) + $peso;
            $loteDetalle[$claveLoteTra]['dias'][$dia] = ($loteDetalle[$claveLoteTra]['dias'][$dia] ?? 0) + $peso;

            $topTotalesMes[$claveArticulo . "\x1F" . $mes] = ($topTotalesMes[$claveArticulo . "\x1F" . $mes] ?? 0) + $peso;
            $loteTotalesMes[$claveLoteMes] = ($loteTotalesMes[$claveLoteMes] ?? 0) + $peso;
            $loteTotalesDia[$claveLoteDia] = ($loteTotalesDia[$claveLoteDia] ?? 0) + $peso;
            $totalGeneralMes[$mes] = ($totalGeneralMes[$mes] ?? 0) + $peso;
            $totalGeneralDia[$dia] = ($totalGeneralDia[$dia] ?? 0) + $peso;
        }

        $listaMeses = array_keys($meses);
        $listaDias = array_keys($dias);
        sort($listaMeses);
        sort($listaDias);

        $topRows = [];
        $gruposArticulo = [];

        foreach ($topDetalle as $fila) {
            $clave = $fila['codigo'] . "\x1F" . $fila['descripcion'];
            $gruposArticulo[$clave][] = $fila;
        }

        $clavesArticulo = array_keys($gruposArticulo);
        sort($clavesArticulo);

        foreach ($clavesArticulo as $claveArticulo) {
            $filas = $gruposArticulo[$claveArticulo];
            usort($filas, function ($a, $b) {
                return strcmp((string)$b['transaccion'], (string)$a['transaccion']);
            });

            foreach ($filas as $fila) {
                $valores = [];
                foreach ($fila['meses'] as $mes => $peso) {
                    $total = $topTotalesMes[$claveArticulo . "\x1F" . $mes] ?? 0;
                    $valores[$mes] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $topRows[] = [
                    'tipo' => 'detalle',
                    'codigo' => $fila['codigo'],
                    'descripcion' => $fila['descripcion'],
                    'transaccion' => $fila['transaccion'],
                    'valores' => $valores
                ];
            }

            $totalArticulo = [];
            $partes = explode("\x1F", $claveArticulo);
            $codigoArticulo = $partes[0] ?? '';

            foreach ($listaMeses as $mes) {
                $total = $topTotalesMes[$claveArticulo . "\x1F" . $mes] ?? 0;
                if ($total > 0) {
                    $totalArticulo[$mes] = ['peso' => $total, 'pct' => 1];
                }
            }

            $topRows[] = [
                'tipo' => 'total',
                'codigo' => $codigoArticulo,
                'descripcion' => $partes[1] ?? '',
                'transaccion' => 'Total',
                'valores' => $totalArticulo
            ];
        }

        $topGeneral = [];
        foreach ($totalGeneralMes as $mes => $peso) {
            if ($peso > 0) {
                $topGeneral[$mes] = ['peso' => $peso, 'pct' => 1];
            }
        }

        $gruposLote = [];
        foreach ($loteDetalle as $fila) {
            $clave = $fila['codigo'] . "\x1F" . $fila['descripcion'] . "\x1F" . $fila['lote'];
            $gruposLote[$clave][] = $fila;
        }

        $clavesLote = array_keys($gruposLote);
        usort($clavesLote, function ($a, $b) {
            return strcmp($a, $b);
        });

        $mesLoteRows = [];
        $diaLoteRows = [];
        $totalGrupos = count($clavesLote);
        $clavesPagina = array_slice($clavesLote, $offset, $pageSize);

        foreach ($clavesPagina as $claveLote) {
            $filas = $gruposLote[$claveLote];
            usort($filas, function ($a, $b) {
                return strcmp((string)$b['transaccion'], (string)$a['transaccion']);
            });

            $partes = explode("\x1F", $claveLote);
            $codigo = $partes[0] ?? '';
            $descripcion = $partes[1] ?? '';
            $lote = $partes[2] ?? '';

            foreach ($filas as $fila) {
                $valoresMes = [];
                foreach ($fila['meses'] as $mes => $peso) {
                    $total = $loteTotalesMes[$claveLote . "\x1F" . $mes] ?? 0;
                    $valoresMes[$mes] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $valoresDia = [];
                foreach ($fila['dias'] as $dia => $peso) {
                    $total = $loteTotalesDia[$claveLote . "\x1F" . $dia] ?? 0;
                    $valoresDia[$dia] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $base = [
                    'tipo' => 'detalle',
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'lote' => $lote,
                    'transaccion' => $fila['transaccion']
                ];

                $mesLoteRows[] = $base + ['valores' => $valoresMes];
                $diaLoteRows[] = $base + ['valores' => $valoresDia];
            }

            $totalMes = [];
            foreach ($listaMeses as $mes) {
                $peso = $loteTotalesMes[$claveLote . "\x1F" . $mes] ?? 0;
                if ($peso > 0) {
                    $totalMes[$mes] = ['peso' => $peso, 'pct' => 1];
                }
            }

            $totalDia = [];
            foreach ($listaDias as $dia) {
                $peso = $loteTotalesDia[$claveLote . "\x1F" . $dia] ?? 0;
                if ($peso > 0) {
                    $totalDia[$dia] = ['peso' => $peso, 'pct' => 1];
                }
            }

            $baseTotal = [
                'tipo' => 'total',
                'codigo' => $codigo,
                'descripcion' => $descripcion,
                'lote' => $lote,
                'transaccion' => 'Total'
            ];

            $mesLoteRows[] = $baseTotal + ['valores' => $totalMes];
            $diaLoteRows[] = $baseTotal + ['valores' => $totalDia];
        }

        $totalGeneralMesValores = [];
        foreach ($totalGeneralMes as $mes => $peso) {
            if ($peso > 0) {
                $totalGeneralMesValores[$mes] = ['peso' => $peso, 'pct' => 1];
            }
        }

        $totalGeneralDiaValores = [];
        foreach ($totalGeneralDia as $dia => $peso) {
            if ($peso > 0) {
                $totalGeneralDiaValores[$dia] = ['peso' => $peso, 'pct' => 1];
            }
        }

        $rawTop = self::filtrarMermasRaw($raw, $seleccionesMesLote, 'mes_lote');
        $datosTop = self::construirTablaMesGlo($rawTop, $listaMeses);
        $rawMesLote = self::filtrarMermasRaw($raw, $seleccionesMesGlo, 'mes_glo');
        $rawDiaLote = self::filtrarMermasRaw($rawMesLote, $seleccionesMesLote, 'mes_lote');
        $datosMesLote = self::construirTablaLotes($rawMesLote, $listaMeses, $listaDias, $page, $pageSize, $offset, 'mes');
        $datosDiaLote = self::construirTablaLotes($rawDiaLote, $listaMeses, $listaDias, $page, $pageSize, $offset, 'dia');

        return [
            'status' => 'success',
            'tipo_grafico' => 'AnalisisMermas',
            'filtros' => self::filtrosAplicados($filtros) + [
                'transacciones' => $transacciones,
                'selecciones_mes_glo' => $seleccionesMesGlo,
                'selecciones_mes_lote' => $seleccionesMesLote
            ],
            'meses' => $listaMeses,
            'dias' => $listaDias,
            'mes_glo' => [
                'filas' => $datosTop['filas'],
                'total_general' => $datosTop['total_general']
            ],
            'mes_lote' => [
                'filas' => $datosMesLote['filas'],
                'total_general' => $datosMesLote['total_general'],
                'page' => $page,
                'page_size' => $pageSize,
                'total_grupos' => $datosMesLote['total_grupos'],
                'total_paginas' => $datosMesLote['total_paginas']
            ],
            'dia_lote' => [
                'filas' => $datosDiaLote['filas'],
                'total_general' => $datosDiaLote['total_general'],
                'page' => $page,
                'page_size' => $pageSize,
                'total_grupos' => $datosDiaLote['total_grupos'],
                'total_paginas' => $datosDiaLote['total_paginas']
            ],
            'paginacion' => [
                'page' => $page,
                'page_size' => $pageSize,
                'total_grupos' => $datosMesLote['total_grupos'],
                'total_paginas' => $datosMesLote['total_paginas']
            ]
        ];
    }

    private static function construirTablaMesGlo(array $raw, array $listaMeses): array
    {
        $detalle = [];
        $totales = [];

        foreach ($raw as $fila) {
            $codigo = (string)($fila['codigo'] ?? '');
            $descripcion = (string)($fila['descripcion'] ?? '');
            $transaccion = (string)($fila['transaccion'] ?? '');
            $mes = (string)($fila['mes'] ?? '');
            $peso = (float)($fila['peso'] ?? 0);
            $claveArticulo = $codigo . "\x1F" . $descripcion;
            $claveDetalle = $claveArticulo . "\x1F" . $transaccion;

            if (!isset($detalle[$claveDetalle])) {
                $detalle[$claveDetalle] = [
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'transaccion' => $transaccion,
                    'meses' => []
                ];
            }

            $detalle[$claveDetalle]['meses'][$mes] = ($detalle[$claveDetalle]['meses'][$mes] ?? 0) + $peso;
            $totales[$claveArticulo . "\x1F" . $mes] = ($totales[$claveArticulo . "\x1F" . $mes] ?? 0) + $peso;
        }

        $grupos = [];
        foreach ($detalle as $fila) {
            $grupos[$fila['codigo'] . "\x1F" . $fila['descripcion']][] = $fila;
        }

        $claves = array_keys($grupos);
        sort($claves);
        $filas = [];

        foreach ($claves as $claveArticulo) {
            $partes = explode("\x1F", $claveArticulo);
            $codigo = $partes[0] ?? '';
            $descripcion = $partes[1] ?? '';
            $detalles = $grupos[$claveArticulo];
            usort($detalles, function ($a, $b) {
                return strcmp((string)$b['transaccion'], (string)$a['transaccion']);
            });

            foreach ($detalles as $fila) {
                $valores = [];
                foreach ($fila['meses'] as $mes => $peso) {
                    $total = $totales[$claveArticulo . "\x1F" . $mes] ?? 0;
                    $valores[$mes] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $filas[] = [
                    'tipo' => 'detalle',
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'transaccion' => $fila['transaccion'],
                    'valores' => $valores
                ];
            }

            $valoresTotal = [];
            foreach ($listaMeses as $mes) {
                $peso = $totales[$claveArticulo . "\x1F" . $mes] ?? 0;
                if ($peso > 0) {
                    $valoresTotal[$mes] = ['peso' => $peso, 'pct' => 1];
                }
            }

            $filas[] = [
                'tipo' => 'total',
                'codigo' => $codigo,
                'descripcion' => $descripcion,
                'transaccion' => 'Total',
                'valores' => $valoresTotal
            ];
        }

        $totalGeneral = [];
        foreach ($totales as $clave => $peso) {
            $partes = explode("\x1F", $clave);
            $mes = $partes[2] ?? '';
            if ($mes !== '') {
                $totalGeneral[$mes] = ($totalGeneral[$mes] ?? 0) + $peso;
            }
        }

        foreach ($totalGeneral as $mes => $peso) {
            $totalGeneral[$mes] = ['peso' => $peso, 'pct' => 1];
        }

        return [
            'filas' => $filas,
            'total_general' => $totalGeneral
        ];
    }

    private static function normalizarSelecciones($valor): array
    {
        if (!is_array($valor)) {
            return [];
        }

        $selecciones = [];

        foreach ($valor as $item) {
            if (!is_array($item)) {
                continue;
            }

            $seleccion = [
                'codigo' => trim((string)($item['codigo'] ?? '')),
                'descripcion' => trim((string)($item['descripcion'] ?? '')),
                'lote' => trim((string)($item['lote'] ?? '')),
                'transaccion' => trim((string)($item['transaccion'] ?? '')),
                'mes' => trim((string)($item['mes'] ?? ''))
            ];

            if (strtoupper($seleccion['transaccion']) === 'TODO' || strtoupper($seleccion['transaccion']) === 'TOTAL') {
                $seleccion['transaccion'] = '';
            }

            if ($seleccion['codigo'] !== '' || $seleccion['descripcion'] !== '' || $seleccion['lote'] !== '' || $seleccion['mes'] !== '') {
                $selecciones[] = $seleccion;
            }
        }

        return $selecciones;
    }

    private static function filtrarMermasRaw(array $raw, array $selecciones, string $tipo): array
    {
        if (!$selecciones) {
            return $raw;
        }

        $resultado = [];

        foreach ($raw as $fila) {
            foreach ($selecciones as $seleccion) {
                if ($seleccion['codigo'] !== '' && $seleccion['codigo'] !== (string)($fila['codigo'] ?? '')) {
                    continue;
                }
                if ($seleccion['descripcion'] !== '' && $seleccion['descripcion'] !== (string)($fila['descripcion'] ?? '')) {
                    continue;
                }
                if ($tipo === 'mes_lote' && $seleccion['lote'] !== '' && $seleccion['lote'] !== (string)($fila['lote'] ?? '')) {
                    continue;
                }
                if ($seleccion['transaccion'] !== '' && $seleccion['transaccion'] !== (string)($fila['transaccion'] ?? '')) {
                    continue;
                }
                if ($seleccion['mes'] !== '' && $seleccion['mes'] !== (string)($fila['mes'] ?? '')) {
                    continue;
                }

                $resultado[] = $fila;
                break;
            }
        }

        return $resultado;
    }

    private static function construirTablaLotes(array $raw, array $listaMeses, array $listaDias, int $page, int $pageSize, int $offset, string $tipoPeriodo): array
    {
        $detalle = [];
        $totalesMes = [];
        $totalesDia = [];

        foreach ($raw as $fila) {
            $codigo = (string)($fila['codigo'] ?? '');
            $descripcion = (string)($fila['descripcion'] ?? '');
            $lote = (string)($fila['lote'] ?? '');
            $transaccion = (string)($fila['transaccion'] ?? '');
            $mes = (string)($fila['mes'] ?? '');
            $dia = (string)($fila['dia'] ?? '');
            $peso = (float)($fila['peso'] ?? 0);

            $claveLote = $codigo . "\x1F" . $descripcion . "\x1F" . $lote;
            $claveDetalle = $claveLote . "\x1F" . $transaccion;
            $claveMes = $claveLote . "\x1F" . $mes;
            $claveDia = $claveLote . "\x1F" . $dia;

            if (!isset($detalle[$claveDetalle])) {
                $detalle[$claveDetalle] = [
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'lote' => $lote,
                    'transaccion' => $transaccion,
                    'meses' => [],
                    'dias' => []
                ];
            }

            $detalle[$claveDetalle]['meses'][$mes] = ($detalle[$claveDetalle]['meses'][$mes] ?? 0) + $peso;
            $detalle[$claveDetalle]['dias'][$dia] = ($detalle[$claveDetalle]['dias'][$dia] ?? 0) + $peso;
            $totalesMes[$claveMes] = ($totalesMes[$claveMes] ?? 0) + $peso;
            $totalesDia[$claveDia] = ($totalesDia[$claveDia] ?? 0) + $peso;
        }

        $grupos = [];

        foreach ($detalle as $fila) {
            $clave = $fila['codigo'] . "\x1F" . $fila['descripcion'] . "\x1F" . $fila['lote'];
            $grupos[$clave][] = $fila;
        }

        $claves = array_keys($grupos);
        usort($claves, function ($a, $b) {
            return strcmp($a, $b);
        });

        $filas = [];
        $clavesPagina = array_slice($claves, $offset, $pageSize);

        foreach ($clavesPagina as $claveLote) {
            $detalles = $grupos[$claveLote];
            usort($detalles, function ($a, $b) {
                return strcmp((string)$b['transaccion'], (string)$a['transaccion']);
            });

            $partes = explode("\x1F", $claveLote);
            $codigo = $partes[0] ?? '';
            $descripcion = $partes[1] ?? '';
            $lote = $partes[2] ?? '';

            foreach ($detalles as $fila) {
                $valoresMes = [];
                foreach ($fila['meses'] as $mes => $peso) {
                    $total = $totalesMes[$claveLote . "\x1F" . $mes] ?? 0;
                    $valoresMes[$mes] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $valoresDia = [];
                foreach ($fila['dias'] as $dia => $peso) {
                    $total = $totalesDia[$claveLote . "\x1F" . $dia] ?? 0;
                    $valoresDia[$dia] = [
                        'peso' => $peso,
                        'pct' => $total > 0 ? round($peso / $total, 6) : 0
                    ];
                }

                $base = [
                    'tipo' => 'detalle',
                    'codigo' => $codigo,
                    'descripcion' => $descripcion,
                    'lote' => $lote,
                    'transaccion' => $fila['transaccion']
                ];

                $filas[] = $base + ['valores' => $tipoPeriodo === 'dia' ? $valoresDia : $valoresMes];
            }

            $totalMes = [];
            foreach ($listaMeses as $mes) {
                $peso = $totalesMes[$claveLote . "\x1F" . $mes] ?? 0;
                if ($peso > 0) {
                    $totalMes[$mes] = ['peso' => $peso, 'pct' => 1];
                }
            }

            $totalDia = [];
            foreach ($listaDias as $dia) {
                $peso = $totalesDia[$claveLote . "\x1F" . $dia] ?? 0;
                if ($peso > 0) {
                    $totalDia[$dia] = ['peso' => $peso, 'pct' => 1];
                }
            }

            $filas[] = [
                'tipo' => 'total',
                'codigo' => $codigo,
                'descripcion' => $descripcion,
                'lote' => $lote,
                'transaccion' => 'Total',
                'valores' => $tipoPeriodo === 'dia' ? $totalDia : $totalMes
            ];
        }

        $totalGeneral = [];
        $totalesPeriodo = $tipoPeriodo === 'dia' ? $totalesDia : $totalesMes;

        foreach (array_keys($totalesPeriodo) as $clavePeriodo) {
            $partes = explode("\x1F", $clavePeriodo);
            $periodo = $partes[3] ?? '';
            if ($periodo !== '') {
                $totalGeneral[$periodo] = ($totalGeneral[$periodo] ?? 0) + $totalesPeriodo[$clavePeriodo];
            }
        }

        foreach ($totalGeneral as $periodo => $peso) {
            $totalGeneral[$periodo] = ['peso' => $peso, 'pct' => 1];
        }

        $totalGrupos = count($claves);

        return [
            'filas' => $filas,
            'total_general' => $totalGeneral,
            'total_grupos' => $totalGrupos,
            'total_paginas' => $totalGrupos > 0 ? (int)ceil($totalGrupos / $pageSize) : 0,
            'page' => $page
        ];
    }

    public static function tabulacionesPu(PDO $db, array $filtros): array
    {
        return [
            'status' => 'success',
            'tipo_grafico' => 'TabulacionesPU',
            'filtros' => self::filtrosAplicados($filtros),
            'consumos' => self::consultarTabulacionPu($db, $filtros, ['E003', 'S003']),
            'compras' => self::consultarTabulacionPu($db, $filtros, null)
        ];
    }

    private static function consultarTabulacionPu(PDO $db, array $filtros, $transacciones = null): array
    {
        [$where, $params] = self::whereMovimientos($filtros);

        if (is_array($transacciones) && $transacciones) {
            $where[] = 'TRIM(i.tcodtra) IN (' . self::marcadores($transacciones, 'tabulacion_tra', $params) . ')';
        }

        $whereSql = implode(' AND ', $where);
        $sql = "SELECT
                    TRIM(m.descri) AS descripcion,
                    TRIM(i.tcodtra) AS transaccion,
                    DATE_FORMAT(i.tfectra, '%Y-%m-%d') AS fecha,
                    TRIM(i.tlote) AS lote,
                    SUM(i.tkardex) AS valor,
                    SUM(i.tpeso) AS peso,
                    CASE WHEN SUM(i.tpeso) <> 0 THEN SUM(i.tkardex) / SUM(i.tpeso) END AS pu
                FROM imov i
                INNER JOIN mitm m ON i.tcodigo = m.codigo
                WHERE {$whereSql}
                GROUP BY descripcion, transaccion, fecha, lote
                HAVING SUM(i.tpeso) <> 0
                ORDER BY descripcion ASC, transaccion ASC, fecha ASC, lote ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $raw = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $series = [];
        $indices = [];

        foreach ($raw as $fila) {
            $descripcion = (string)($fila['descripcion'] ?? '');
            $transaccion = (string)($fila['transaccion'] ?? '');
            $clave = $descripcion . "\x1F" . $transaccion;

            if (!isset($indices[$clave])) {
                $indices[$clave] = count($series);
                $series[] = [
                    'descripcion' => $descripcion,
                    'transaccion' => $transaccion,
                    'barras' => []
                ];
            }

            $series[$indices[$clave]]['barras'][] = [
                'fecha' => (string)($fila['fecha'] ?? ''),
                'lote' => (string)($fila['lote'] ?? ''),
                'valor' => (float)($fila['valor'] ?? 0),
                'peso' => (float)($fila['peso'] ?? 0),
                'pu' => (float)($fila['pu'] ?? 0)
            ];
        }

        return $series;
    }

    private static function consultarMovimientos(PDO $db, array $filtros, string $tipo): array
    {
        [$page, $pageSize, $offset] = self::paginacion($filtros);
        [$where, $params] = self::whereMovimientos($filtros);

        $where[] = $tipo === 'compras'
            ? "i.tcodtra = 'E001'"
            : "i.tcodtra IN ('E003', 'S003')";
        $whereSql = implode(' AND ', $where);
        $cantidadSql = $tipo === 'compras' ? ', SUM(i.tcantid) AS cantidad' : '';

        $selectSql = "SELECT
                        DATE_FORMAT(i.tfectra, '%Y-%m-%d') AS fecha,
                        TRIM(i.tcodigo) AS codigo,
                        TRIM(m.descri) AS descripcion,
                        TRIM(i.tlote) AS lote,
                        TRIM(i.tcodtra) AS transaccion,
                        CAST(i.tnumfac AS UNSIGNED) AS documento,
                        SUM(i.tkardex) AS valor,
                        SUM(i.tpeso) AS peso,
                        CASE WHEN SUM(i.tpeso) <> 0 THEN SUM(i.tkardex) / SUM(i.tpeso) END AS pu
                        {$cantidadSql}
                    FROM imov i
                    INNER JOIN mitm m ON i.tcodigo = m.codigo
                    INNER JOIN ccte c ON i.tprocli = c.codigo
                    WHERE {$whereSql}
                    GROUP BY fecha, codigo, descripcion, lote, transaccion, documento";

        $stmtTotal = $db->prepare("SELECT COUNT(*) FROM ({$selectSql}) t");
        $stmtTotal->execute($params);
        $total = (int)$stmtTotal->fetchColumn();

        $sql = "{$selectSql}
                ORDER BY fecha ASC, codigo ASC, descripcion ASC, lote ASC, transaccion ASC, documento ASC
                LIMIT {$pageSize} OFFSET {$offset}";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return [
            'status' => 'success',
            'tipo' => $tipo,
            'filas' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'total_paginas' => $total > 0 ? (int)ceil($total / $pageSize) : 0,
            'filtros' => self::filtrosAplicados($filtros)
        ];
    }

    private static function whereMovimientos(array $filtros): array
    {
        [$fechaInicio, $fechaFin] = self::rangoFechas($filtros);
        $where = ['i.tfectra BETWEEN :fecha_inicio AND :fecha_fin'];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $almacenes = self::normalizarLista($filtros['almacenes'] ?? $filtros['almacen'] ?? null);
        if ($almacenes) {
            $where[] = 'TRIM(i.talm) IN (' . self::marcadores($almacenes, 'almacen', $params) . ')';
        }

        $articulos = self::normalizarLista($filtros['articulos'] ?? $filtros['articulo'] ?? null);
        if ($articulos) {
            $where[] = 'TRIM(i.tcodigo) IN (' . self::marcadores($articulos, 'articulo', $params) . ')';
        }

        $lotes = self::normalizarLista($filtros['lotes'] ?? $filtros['lote'] ?? null);
        if ($lotes) {
            $where[] = 'TRIM(i.tlote) IN (' . self::marcadores($lotes, 'lote', $params) . ')';
        }

        $documentos = self::normalizarDocumentos($filtros['documentos'] ?? null);
        if ($documentos) {
            $where[] = 'CAST(i.tnumfac AS UNSIGNED) IN (' . self::marcadores($documentos, 'documento_mov', $params) . ')';
        }

        return [$where, $params];
    }

    private static function whereDocumentos(array $filtros): array
    {
        [$fechaInicio, $fechaFin] = self::rangoFechas($filtros);
        $where = ['d.dfectra BETWEEN :fecha_inicio AND :fecha_fin'];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $dalm = self::DALM_DOCUMENTOS;
        $where[] = 'TRIM(d.dalm) IN (' . self::marcadores($dalm, 'dalm', $params) . ')';

        $documentos = self::normalizarDocumentos($filtros['documentos'] ?? null);
        if ($documentos) {
            $where[] = 'CAST(d.dnumfac AS UNSIGNED) IN (' . self::marcadores($documentos, 'documento_doc', $params) . ')';
        }

        return [$where, $params];
    }

    private static function marcadores(array $valores, string $prefijo, array &$params): string
    {
        $marcadores = [];

        foreach ($valores as $indice => $valor) {
            $marcador = ':' . $prefijo . '_' . $indice;
            $marcadores[] = $marcador;
            $params[$marcador] = $valor;
        }

        return implode(', ', $marcadores);
    }

    private static function paginacion(array $filtros): array
    {
        $page = max(1, (int)($filtros['page'] ?? 1));
        $pageSize = (int)($filtros['page_size'] ?? self::PAGE_SIZE_DEFAULT);
        $pageSize = max(1, min(self::PAGE_SIZE_MAX, $pageSize));

        return [$page, $pageSize, ($page - 1) * $pageSize];
    }

    private static function rangoFechas(array $filtros): array
    {
        $fechaInicio = self::fecha($filtros['fecha_inicio'] ?? null, date('Y-m-d', strtotime('-7 days')));
        $fechaFin = self::fecha($filtros['fecha_fin'] ?? null, date('Y-m-d'));

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        return [$fechaInicio, $fechaFin];
    }

    private static function filtrosAplicados(array $filtros): array
    {
        [$fechaInicio, $fechaFin] = self::rangoFechas($filtros);

        return [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'almacenes' => self::normalizarLista($filtros['almacenes'] ?? $filtros['almacen'] ?? null),
            'articulos' => self::normalizarLista($filtros['articulos'] ?? $filtros['articulo'] ?? null),
            'lotes' => self::normalizarLista($filtros['lotes'] ?? $filtros['lote'] ?? null),
            'documentos' => self::normalizarDocumentos($filtros['documentos'] ?? null)
        ];
    }

    private static function normalizarDocumentos($valor): array
    {
        $documentos = [];

        foreach (self::normalizarLista($valor) as $item) {
            if (!is_numeric($item)) {
                continue;
            }

            $numero = (int)$item;
            if ($numero > 0) {
                $documentos[] = (string)$numero;
            }
        }

        return array_values(array_unique($documentos));
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

    private static function consultaFilas(PDO $db, string $sql): array
    {
        $stmt = $db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function consultaFila(PDO $db, string $sql): array
    {
        $stmt = $db->query($sql);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($fila) ? $fila : [];
    }
}
