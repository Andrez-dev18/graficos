<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/laboratorio/trazabilidad/trazabilidad_lib.php';

if (!function_exists('sip_grafica_trazabilidad_tipos')) {
    /** @return list<string> */
    function sip_grafica_trazabilidad_tipos(): array
    {
        return [
            'trazabilidad_periodo',
            'trazabilidad_detalle',
            'trazabilidad_codref',
            'trazabilidad_porcentaje',
        ];
    }
}

if (!function_exists('sip_grafica_trazabilidad_es')) {
    function sip_grafica_trazabilidad_es(string $tipo): bool
    {
        return in_array(strtolower(trim($tipo)), sip_grafica_trazabilidad_tipos(), true);
    }
}

if (!function_exists('sip_grafica_trazabilidad_seccion_de_tipo')) {
    function sip_grafica_trazabilidad_seccion_de_tipo(string $tipo): string
    {
        $t = strtolower(trim($tipo));
        foreach (sip_grafica_trazabilidad_tipos() as $id) {
            if ($t === $id) {
                return substr($id, strlen('trazabilidad_'));
            }
        }

        return 'periodo';
    }
}

if (!function_exists('sip_grafica_trazabilidad_secciones')) {
    /** @return list<string> */
    function sip_grafica_trazabilidad_secciones(): array
    {
        return ['periodo', 'detalle', 'codref', 'porcentaje'];
    }
}

if (!function_exists('sip_grafica_trazabilidad_ctx')) {
    /**
     * Fechas y filtros comunes (origen, tipo de muestra, exclusión de agua).
     *
     * @param array<string,mixed> $opts
     * @return array{fechaInicio:string,fechaFin:string,origen:array,sql:string,types:string,params:array}
     */
    function sip_grafica_trazabilidad_ctx(mysqli $conn, array $opts, string $defecto): array
    {
        $rawInicio = trim((string) ($opts['fechaInicio'] ?? ''));
        $rawFin = trim((string) ($opts['fechaFin'] ?? ''));
        if ($defecto === 'mes_anterior') {
            $hoy = new DateTime();
            $defInicio = sprintf('%04d-%02d-01', (int) $hoy->format('Y') - 1, (int) $hoy->format('m'));
            $defFin = sprintf('%04d-%02d-%02d', (int) $hoy->format('Y'), (int) $hoy->format('m'), (int) $hoy->format('t'));
        } else {
            $defInicio = date('Y-01-01', strtotime('-1 year'));
            $defFin = date('Y-12-31');
        }
        $fechaInicio = trz_parse_fecha($rawInicio) ?? $defInicio;
        $fechaFin = trz_parse_fecha($rawFin) ?? $defFin;

        $origenFiltro = trz_filtro_origen();
        $tipoFiltro = trz_filtro_tipo_muestra();
        $exclAgua = trz_filtros_exclusion_agua($conn);

        return [
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            'origen' => $origenFiltro,
            'sql' => $exclAgua['cod'] . "\n" . $exclAgua['nom'] . "\n" . $origenFiltro['sql'] . "\n" . $tipoFiltro['sql'],
            'types' => 'ss' . $origenFiltro['types'] . $tipoFiltro['types'],
            'params' => array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']),
        ];
    }
}

if (!function_exists('sip_grafica_trazabilidad_base')) {
    /** @return array<string,mixed> */
    function sip_grafica_trazabilidad_base(string $seccion, string $chartType, string $barMode, array $ctx): array
    {
        return [
            'success' => true,
            'tipo' => 'trazabilidad',
            'seccion' => $seccion,
            'chartType' => $chartType,
            'barMode' => $barMode,
            'rango' => ['inicio' => $ctx['fechaInicio'], 'fin' => $ctx['fechaFin']],
        ];
    }
}

if (!function_exists('sip_grafica_trazabilidad_periodo')) {
    /** Casos positivos por mes, una serie por análisis. */
    function sip_grafica_trazabilidad_periodo(mysqli $conn, array $ctx): array
    {
        $sql = "SELECT
            MIN(analisis_codigo) AS analisis_codigo,
            analisis_nombre,
            DATE_FORMAT(fecToma, '%Y-%m') AS mes,
            COUNT(*) AS total_registrados,
            SUM(CASE
                WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                ELSE 1
            END) AS total,
            SUM(CASE
                WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                WHEN UPPER(TRIM(resultado)) = 'NEGATIVO' THEN 0
                ELSE 1
            END) AS positivos
        FROM san_fact_resultado_analisis
        WHERE fecToma BETWEEN ? AND ?
          AND fecToma IS NOT NULL
          AND analisis_nombre IS NOT NULL
          AND TRIM(analisis_nombre) != ''
          {$ctx['sql']}
        GROUP BY analisis_nombre, mes
        ORDER BY mes ASC, analisis_nombre ASC";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'tipo' => 'trazabilidad', 'seccion' => 'periodo', 'message' => 'Error SQL'];
        }
        $stmt->bind_param($ctx['types'], ...$ctx['params']);
        $stmt->execute();
        $rs = $stmt->get_result();

        $mesSet = [];
        $analSet = [];
        $idx = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $nom = (string) ($row['analisis_nombre'] ?? '');
            $mes = (string) ($row['mes'] ?? '');
            if ($nom === '' || $mes === '') {
                continue;
            }
            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = (string) ($row['analisis_codigo'] ?? '');
            }
            $idx[$nom][$mes] = [
                'total' => (int) ($row['total'] ?? 0),
                'positivos' => (int) ($row['positivos'] ?? 0),
                'registrados' => (int) ($row['total_registrados'] ?? 0),
            ];
        }
        $stmt->close();

        $meses = trz_meses($mesSet, $ctx['fechaInicio'], $ctx['fechaFin']);

        $series = [];
        foreach ($analSet as $nom => $cod) {
            $data = [];
            $totales = [];
            $pct = [];
            $registrados = [];
            foreach ($meses as $mes) {
                $cell = $idx[$nom][$mes] ?? ['total' => 0, 'positivos' => 0, 'registrados' => 0];
                $pos = (int) $cell['positivos'];
                $tot = (int) $cell['total'];
                $data[] = $pos;
                $totales[] = $tot;
                $registrados[] = (int) $cell['registrados'];
                $pct[] = $tot > 0 ? (int) round($pos / $tot * 100) : 0;
            }
            if (array_sum($data) <= 0) {
                continue;
            }
            $series[] = [
                'key' => (string) $cod,
                'label' => $nom,
                'estandar' => null,
                'data' => $data,
                'totales' => $totales,
                'pct' => $pct,
                'registrados' => $registrados,
            ];
        }
        usort($series, static function ($a, $b) {
            return strcasecmp((string) $a['label'], (string) $b['label']);
        });

        return array_merge(sip_grafica_trazabilidad_base('periodo', 'bar', 'grouped', $ctx), [
            'success' => $series !== [],
            'labels' => trz_etiquetas($meses),
            'claves' => $meses,
            'series' => $series,
        ]);
    }
}

if (!function_exists('sip_grafica_trazabilidad_detalle')) {
    /** Desglose por resultado: una serie por (análisis, resultado). */
    function sip_grafica_trazabilidad_detalle(mysqli $conn, array $ctx): array
    {
        $sql = "SELECT
            MIN(analisis_codigo) AS analisis_codigo,
            analisis_nombre,
            DATE_FORMAT(fecToma, '%Y-%m') AS mes,
            CASE
                WHEN resultado IS NULL OR TRIM(resultado) = '' THEN '(Sin resultado)'
                ELSE UPPER(TRIM(resultado))
            END AS resultado,
            COUNT(*) AS cantidad
        FROM san_fact_resultado_analisis
        WHERE fecToma BETWEEN ? AND ?
          AND fecToma IS NOT NULL
          AND analisis_nombre IS NOT NULL
          AND TRIM(analisis_nombre) != ''
          {$ctx['sql']}
        GROUP BY analisis_nombre, mes, resultado
        ORDER BY analisis_nombre ASC, mes ASC, resultado ASC";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'tipo' => 'trazabilidad', 'seccion' => 'detalle', 'message' => 'Error SQL'];
        }
        $stmt->bind_param($ctx['types'], ...$ctx['params']);
        $stmt->execute();
        $rs = $stmt->get_result();

        $mesSet = [];
        $analSet = [];
        $idx = [];
        $resPorNom = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $nom = (string) ($row['analisis_nombre'] ?? '');
            $mes = (string) ($row['mes'] ?? '');
            $res = (string) ($row['resultado'] ?? '(Sin resultado)');
            if ($nom === '' || $mes === '') {
                continue;
            }
            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = (string) ($row['analisis_codigo'] ?? '');
            }
            $resPorNom[$nom][$res] = true;
            $idx[$nom][$res][$mes] = (int) ($row['cantidad'] ?? 0);
        }
        $stmt->close();

        $meses = trz_meses($mesSet, $ctx['fechaInicio'], $ctx['fechaFin']);

        $series = [];
        foreach ($analSet as $nom => $cod) {
            $resKeys = array_keys($resPorNom[$nom] ?? []);
            sort($resKeys, SORT_STRING | SORT_FLAG_CASE);
            foreach ($resKeys as $resLabel) {
                $data = [];
                foreach ($meses as $mes) {
                    $data[] = (int) ($idx[$nom][$resLabel][$mes] ?? 0);
                }
                if (array_sum($data) <= 0) {
                    continue;
                }
                $series[] = [
                    'key' => (string) $cod . '|' . $resLabel,
                    'label' => $nom . ' · ' . $resLabel,
                    'analisis' => $nom,
                    'resultado' => $resLabel,
                    'estandar' => null,
                    'data' => $data,
                ];
            }
        }

        return array_merge(sip_grafica_trazabilidad_base('detalle', 'bar', 'stacked', $ctx), [
            'success' => $series !== [],
            'labels' => trz_etiquetas($meses),
            'claves' => $meses,
            'series' => $series,
        ]);
    }
}

if (!function_exists('sip_grafica_trazabilidad_codref')) {
    /** Desglose por origen: top codRef por resultado. */
    function sip_grafica_trazabilidad_codref(mysqli $conn, array $ctx): array
    {
        $sql = "SELECT
            MIN(analisis_codigo) AS analisis_codigo,
            analisis_nombre,
            DATE_FORMAT(fecToma, '%Y-%m') AS mes,
            UPPER(TRIM(resultado)) AS resultado,
            TRIM(codRef) AS cod_ref,
            COUNT(*) AS casos
        FROM san_fact_resultado_analisis
        WHERE fecToma BETWEEN ? AND ?
          AND fecToma IS NOT NULL
          AND analisis_nombre IS NOT NULL
          AND TRIM(analisis_nombre) != ''
          AND TRIM(codRef) != ''
          AND NOT (resultado IS NULL OR TRIM(resultado) = '')
          AND UPPER(TRIM(resultado)) NOT IN ('(SIN RESULTADO)', 'SIN RESULTADO', 'NEGATIVO')
          {$ctx['sql']}
        GROUP BY analisis_nombre, DATE_FORMAT(fecToma, '%Y-%m'), UPPER(TRIM(resultado)), TRIM(codRef)
        HAVING casos > 0";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'tipo' => 'trazabilidad', 'seccion' => 'codref', 'message' => 'Error SQL'];
        }
        $stmt->bind_param($ctx['types'], ...$ctx['params']);
        $stmt->execute();
        $rs = $stmt->get_result();

        $mesSet = [];
        $analSet = [];
        $idx = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $nom = (string) ($row['analisis_nombre'] ?? '');
            $mes = (string) ($row['mes'] ?? '');
            $res = strtoupper(trim((string) ($row['resultado'] ?? '')));
            if ($res === '') {
                $res = '(SIN RESULTADO)';
            }
            $ref = preg_replace('/\s+/', '', (string) ($row['cod_ref'] ?? '')) ?? '';
            $cnt = (int) ($row['casos'] ?? 0);
            if ($nom === '' || $mes === '' || $ref === '' || $cnt <= 0) {
                continue;
            }
            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = (string) ($row['analisis_codigo'] ?? '');
            }
            $idx[$nom][$res][$ref][$mes] = ($idx[$nom][$res][$ref][$mes] ?? 0) + $cnt;
        }
        $stmt->close();

        $meses = trz_meses($mesSet, $ctx['fechaInicio'], $ctx['fechaFin']);
        $abrev = trz_granja_abrev_map();
        $top = 5;
        $series = [];

        foreach ($analSet as $nom => $cod) {
            foreach (($idx[$nom] ?? []) as $resKey => $porRef) {
                $ranked = [];
                foreach ($porRef as $ref => $porMes) {
                    $total = array_sum($porMes);
                    if ($total > 0) {
                        $ranked[] = ['ref' => $ref, 'porMes' => $porMes, 'total' => $total];
                    }
                }
                usort($ranked, static function ($a, $b) {
                    return ($b['total'] <=> $a['total']) ?: strcmp((string) $a['ref'], (string) $b['ref']);
                });
                foreach (array_slice($ranked, 0, $top) as $r) {
                    $ref = (string) $r['ref'];
                    $g3 = strlen($ref) >= 3 ? substr($ref, 0, 3) : '';
                    $pref = $abrev[$g3] ?? '';
                    $data = [];
                    foreach ($meses as $mes) {
                        $data[] = (int) ($r['porMes'][$mes] ?? 0);
                    }
                    $series[] = [
                        'key' => (string) $cod . '|' . $resKey . '|' . $ref,
                        'label' => ($pref !== '' ? $pref . ' · ' : '') . $ref,
                        'analisis' => $nom,
                        'resultado' => $resKey,
                        'codRef' => $ref,
                        'granja' => $g3,
                        'estandar' => null,
                        'data' => $data,
                        'total' => (int) $r['total'],
                    ];
                }
            }
        }

        return array_merge(sip_grafica_trazabilidad_base('codref', 'bar', 'grouped', $ctx), [
            'success' => $series !== [],
            'labels' => trz_etiquetas($meses),
            'claves' => $meses,
            'series' => $series,
            'formato' => [
                'digitos8' => 'GGG·CCC·BB (granja·campaña·galpón)',
                'digitos10' => 'GGG·CCC·BB·EE (+ edad)',
            ],
        ]);
    }
}

if (!function_exists('sip_grafica_trazabilidad_porcentaje')) {
    /** % de casos positivos por análisis en el rango. */
    function sip_grafica_trazabilidad_porcentaje(mysqli $conn, array $ctx): array
    {
        $sql = "SELECT
            MIN(analisis_codigo) AS analisis_codigo,
            analisis_nombre,
            DATE_FORMAT(fecToma, '%Y-%m') AS mes,
            COUNT(*) AS total_registrados,
            SUM(CASE
                WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                ELSE 1
            END) AS total,
            SUM(CASE
                WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                WHEN UPPER(TRIM(resultado)) = 'NEGATIVO' THEN 0
                ELSE 1
            END) AS positivos
        FROM san_fact_resultado_analisis
        WHERE fecToma BETWEEN ? AND ?
          AND fecToma IS NOT NULL
          AND analisis_nombre IS NOT NULL
          AND TRIM(analisis_nombre) != ''
          {$ctx['sql']}
        GROUP BY analisis_nombre, DATE_FORMAT(fecToma, '%Y-%m')
        ORDER BY analisis_nombre ASC, mes ASC";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'tipo' => 'trazabilidad', 'seccion' => 'porcentaje', 'message' => 'Error SQL'];
        }
        $stmt->bind_param($ctx['types'], ...$ctx['params']);
        $stmt->execute();
        $rs = $stmt->get_result();

        $mesSet = [];
        $idxMes = [];
        $aggr = [];
        $totalResultados = 0;
        while ($rs && ($row = $rs->fetch_assoc())) {
            $nom = (string) ($row['analisis_nombre'] ?? '');
            $mes = (string) ($row['mes'] ?? '');
            if ($nom === '' || $mes === '') {
                continue;
            }
            $cod = (string) ($row['analisis_codigo'] ?? '');
            $total = (int) ($row['total'] ?? 0);
            $pos = (int) ($row['positivos'] ?? 0);
            $reg = (int) ($row['total_registrados'] ?? 0);
            $mesSet[$mes] = true;
            $totalResultados += $total;
            $idxMes[$nom][$mes] = ['total' => $total, 'positivos' => $pos, 'registrados' => $reg];
            if (!isset($aggr[$nom])) {
                $aggr[$nom] = ['cod' => '', 'total' => 0, 'positivos' => 0, 'registrados' => 0];
            }
            if ($cod !== '' && ($aggr[$nom]['cod'] === '' || strcmp($cod, $aggr[$nom]['cod']) < 0)) {
                $aggr[$nom]['cod'] = $cod;
            }
            $aggr[$nom]['total'] += $total;
            $aggr[$nom]['positivos'] += $pos;
            $aggr[$nom]['registrados'] += $reg;
        }
        $stmt->close();

        $meses = trz_meses($mesSet, $ctx['fechaInicio'], $ctx['fechaFin']);

        $items = [];
        foreach ($aggr as $nom => $a) {
            if ((int) $a['positivos'] <= 0) {
                continue;
            }
            $totales = [];
            $positivos = [];
            $registrados = [];
            foreach ($meses as $mes) {
                $cell = $idxMes[$nom][$mes] ?? ['total' => 0, 'positivos' => 0, 'registrados' => 0];
                $totales[] = (int) $cell['total'];
                $positivos[] = (int) $cell['positivos'];
                $registrados[] = (int) $cell['registrados'];
            }
            $items[] = [
                'key' => (string) $a['cod'],
                'label' => $nom,
                'estandar' => null,
                'total' => (int) $a['total'],
                'totalRegistrados' => (int) $a['registrados'],
                'positivos' => (int) $a['positivos'],
                'pct' => (int) $a['total'] > 0 ? (int) round((int) $a['positivos'] / (int) $a['total'] * 100) : 0,
                'totalesMes' => $totales,
                'positivosMes' => $positivos,
                'registradosMes' => $registrados,
            ];
        }
        usort($items, static function ($a, $b) {
            return strcasecmp((string) $a['label'], (string) $b['label']);
        });

        $series = [[
            'key' => 'porcentaje',
            'label' => '% Casos positivos',
            'unidad' => '%',
            'campo' => 'pct',
            'estandar' => null,
            'data' => array_map(static function ($it) {
                return (int) $it['pct'];
            }, $items),
        ]];

        return array_merge(sip_grafica_trazabilidad_base('porcentaje', 'bar', 'grouped', $ctx), [
            'success' => $items !== [],
            'labels' => array_map(static function ($it) {
                return (string) $it['label'];
            }, $items),
            'totalResultados' => $totalResultados,
            'series' => $series,
            'items' => $items,
        ]);
    }
}

if (!function_exists('sip_grafica_trazabilidad_linea')) {
    /**
     * Despacha la sección de trazabilidad correspondiente al tipo.
     *
     * @param array<string,mixed> $opts fechaInicio, fechaFin
     * @return array<string,mixed>
     */
    function sip_grafica_trazabilidad_linea(mysqli $conn, string $tipo, array $opts): array
    {
        $seccion = sip_grafica_trazabilidad_seccion_de_tipo($tipo);
        if (!in_array($seccion, sip_grafica_trazabilidad_secciones(), true)) {
            return [
                'success' => false,
                'tipo' => 'trazabilidad',
                'message' => 'Seccion no valida: ' . $seccion,
            ];
        }

        $ctx = sip_grafica_trazabilidad_ctx($conn, $opts, $seccion === 'porcentaje' ? 'mes_anterior' : 'anio');
        if ($seccion === 'detalle') {
            $out = sip_grafica_trazabilidad_detalle($conn, $ctx);
        } elseif ($seccion === 'codref') {
            $out = sip_grafica_trazabilidad_codref($conn, $ctx);
        } elseif ($seccion === 'porcentaje') {
            $out = sip_grafica_trazabilidad_porcentaje($conn, $ctx);
        } else {
            $out = sip_grafica_trazabilidad_periodo($conn, $ctx);
        }

        $out['tipo'] = strtolower(trim($tipo));
        $out['soporta'] = true;

        return $out;
    }
}
