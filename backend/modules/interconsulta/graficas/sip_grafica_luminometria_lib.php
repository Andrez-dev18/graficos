<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_catalog_lib.php';
require_once __DIR__ . '/sip_grafica_acumulado_semanal_lib.php';

$lumLib = __DIR__ . '/../reportes-especiales/luminometria/luminometria_lib.php';
if (is_file($lumLib)) {
    require_once $lumLib;
}

if (!function_exists('sip_grafica_lum_disp')) {
    /** Dependencia reportes-especiales/luminometria disponible. */
    function sip_grafica_lum_disp(): bool
    {
        return function_exists('lum_registros_periodo');
    }
}

if (!function_exists('sip_grafica_lum_meses_cortos')) {
    /** @return list<string> */
    function sip_grafica_lum_meses_cortos(): array
    {
        return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    }
}

if (!function_exists('sip_grafica_lum_mes_label')) {
    function sip_grafica_lum_mes_label(int $mes): string
    {
        $meses = sip_grafica_lum_meses_cortos();
        if ($mes < 1 || $mes > 12) {
            return (string) $mes;
        }

        return $meses[$mes - 1];
    }
}

if (!function_exists('sip_grafica_lum_tabla_ok')) {
    function sip_grafica_lum_tabla_ok(mysqli $conn): bool
    {
        if (!sip_grafica_lum_disp()) {
            return false;
        }
        lum_ensure_tables($conn);

        return lum_tabla_ok($conn);
    }
}

if (!function_exists('sip_grafica_lum_etiqueta_fecha')) {
    /** Etiqueta de eje temporal: dd-Mmm (con año si el periodo cruza varios). */
    function sip_grafica_lum_etiqueta_fecha(string $fechaYmd, bool $conAnio = false): string
    {
        $ts = strtotime($fechaYmd);
        if ($ts === false) {
            return $fechaYmd;
        }
        $meses = sip_grafica_lum_meses_cortos();
        $lbl = date('d', $ts) . '-' . ucfirst($meses[(int) date('n', $ts) - 1]);
        if ($conAnio) {
            $lbl .= " '" . date('y', $ts);
        }

        return $lbl;
    }
}

if (!function_exists('sip_grafica_lum_etiqueta_combo')) {
    /** Nombre de serie en modo granja: ABREV-CAMPANIA-GALPON */
    function sip_grafica_lum_etiqueta_combo(
        string $granjaCod,
        string $granjaNombre,
        string $campania,
        string $galpon
    ): string {
        $abrev = lum_granja_abrev_map();
        $base = trim((string) ($abrev[$granjaCod] ?? ''));
        if ($base === '') {
            $base = $granjaNombre !== '' ? $granjaNombre : $granjaCod;
        }
        $partes = [$base];
        if ($campania !== '') {
            $partes[] = $campania;
        }
        if ($galpon !== '') {
            $partes[] = $galpon;
        }

        return implode('-', $partes);
    }
}

if (!function_exists('sip_grafica_lum_subzona_por_granja')) {
    /**
     * @return array<string, string> granja_cod => subzona
     */
    function sip_grafica_lum_subzona_por_granja(mysqli $conn): array
    {
        if (!sip_grafica_catalog_table_exists($conn, 'pi_dim_detalles')
            || !sip_grafica_catalog_table_exists($conn, 'pi_dim_caracteristicas')) {
            return [];
        }

        $excluidas = "('624','640','641')";
        $sql = "
            SELECT TRIM(det.id_granja) AS granja_cod, TRIM(det.dato) AS subzona
            FROM pi_dim_detalles det
            INNER JOIN pi_dim_caracteristicas car ON car.id = det.id_caracteristica
            WHERE UPPER(TRIM(car.nombre)) = 'SUBZONA'
              AND TRIM(det.id_granja) <> ''
              AND TRIM(det.id_granja) LIKE '6%'
              AND TRIM(det.id_granja) NOT IN {$excluidas}
              AND TRIM(det.dato) <> ''
        ";
        $rs = @$conn->query($sql);
        $out = [];
        if ($rs) {
            while ($r = $rs->fetch_assoc()) {
                $g = lum_norm_granja_cod((string) ($r['granja_cod'] ?? ''));
                $sz = trim((string) ($r['subzona'] ?? ''));
                if ($g !== '' && $sz !== '') {
                    $out[$g] = $sz;
                }
            }
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_lum_subzona_sort_key')) {
    function sip_grafica_lum_subzona_sort_key(string $subzona): string
    {
        $s = strtoupper(trim($subzona));
        if (preg_match('/\b(IV|III|II|I)\s*$/', $s, $m)) {
            $map = ['I' => '01', 'II' => '02', 'III' => '03', 'IV' => '04'];

            return 'R' . ($map[$m[1]] ?? '99') . '|' . $s;
        }
        if (preg_match('/(\d+)/', $s, $m)) {
            return 'N' . str_pad($m[1], 4, '0', STR_PAD_LEFT) . '|' . $s;
        }

        return 'Z|' . $s;
    }
}

if (!function_exists('sip_grafica_lum_puntos_catalog')) {
    /**
     * @return array{success:bool, data:list<string>}
     */
    function sip_grafica_lum_puntos_catalog(mysqli $conn): array
    {
        if (!sip_grafica_lum_disp()) {
            return ['success' => false, 'message' => 'Luminometría no disponible en esta instalación', 'data' => []];
        }
        if (!sip_grafica_lum_tabla_ok($conn)) {
            return ['success' => true, 'data' => []];
        }
        $colPunto = lum_col_punto($conn);
        $rs = @$conn->query(
            "SELECT DISTINCT TRIM({$colPunto}) AS punto
             FROM san_luminometria_reg
             WHERE TRIM({$colPunto}) <> ''
             ORDER BY TRIM({$colPunto}) ASC"
        );
        $data = [];
        if (!$rs) {
            lum_sql_error('puntos: ' . $conn->error);
        }
        if ($rs) {
            while ($r = $rs->fetch_assoc()) {
                $p = trim((string) ($r['punto'] ?? ''));
                if ($p !== '') {
                    $data[] = $p;
                }
            }
        }

        return ['success' => true, 'data' => $data];
    }
}

if (!function_exists('sip_grafica_lum_parse_periodo')) {
    /**
     * @return array{0:string,1:string}|array{success:false,message:string}
     */
    function sip_grafica_lum_parse_periodo(array $opts)
    {
        $desde = trim((string) ($opts['fechaInicio'] ?? $opts['fechaDesde'] ?? ''));
        $hasta = trim((string) ($opts['fechaFin'] ?? $opts['fechaHasta'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
            return ['success' => false, 'message' => 'Faltan o son invalidos fechaInicio/fechaFin (YYYY-MM-DD)'];
        }
        if ($desde > $hasta) {
            [$desde, $hasta] = [$hasta, $desde];
        }

        return [$desde, $hasta];
    }
}

if (!function_exists('sip_grafica_lum_fetch_rows')) {
    /**
     * Registros del periodo con los mismos filtros del listado.
     *
     * @return list<array<string,mixed>>
     */
    function sip_grafica_lum_fetch_rows(mysqli $conn, string $desde, string $hasta, string $location): array
    {
        return lum_registros_periodo($conn, $desde, $hasta, $location, true);
    }
}

if (!function_exists('sip_grafica_lum_resp_base')) {
    /**
     * @param array<string,mixed> $extra
     * @return array<string,mixed>
     */
    function sip_grafica_lum_resp_base(
        string $modo,
        string $desde,
        string $hasta,
        string $location,
        array $limites,
        array $extra = []
    ): array {
        $titulo = 'Luminometría';
        if ($location !== '') {
            $titulo .= ' · ' . $location;
        }
        $base = [
            'success' => true,
            'tipo' => 'luminometria',
            'modo' => $modo,
            'nombre' => $titulo,
            'chartType' => 'line',
            'unidad' => 'URL',
            'periodo' => ['desde' => $desde, 'hasta' => $hasta],
            'location' => $location,
            'limites' => $limites,
            'totalRegistros' => 0,
            'registros' => [],
            'grupos' => [],
            'labels' => [],
        ];

        return array_merge($base, $extra);
    }
}

if (!function_exists('sip_grafica_lum_build_subzona')) {
    /**
     * Promedio mensual por subzona (pi_dim SUBZONA). Eje X cronológico; una serie por subzona.
     *
     * @param array<string,mixed> $opts
     */
    function sip_grafica_lum_build_subzona(mysqli $conn, array $opts): array
    {
        $periodo = sip_grafica_lum_parse_periodo($opts);
        if (isset($periodo['success']) && $periodo['success'] === false) {
            return $periodo;
        }
        [$desde, $hasta] = $periodo;
        $location = trim((string) ($opts['location'] ?? $opts['punto'] ?? ''));

        if (!sip_grafica_lum_tabla_ok($conn)) {
            return ['success' => false, 'message' => 'Tabla san_luminometria_reg no disponible'];
        }

        $subzMap = sip_grafica_lum_subzona_por_granja($conn);
        $rows = sip_grafica_lum_fetch_rows($conn, $desde, $hasta, $location);
        $limites = lum_limites_metrica($conn);

        /** @var array<string, array{anio:int,mes:int}> $meses Eje X cronológico */
        $meses = [];
        /** @var array<string, array<string, array{sum:float,cnt:int}>> $porSubzona */
        $porSubzona = [];

        foreach ($rows as $r) {
            $g = lum_norm_granja_cod((string) ($r['granja'] ?? ''));
            if ($g === '') {
                $infoFila = lum_resolver_granja_fila($conn, (string) ($r['granja'] ?? ''), (string) ($r['granjaNombre'] ?? ''));
                $g = (string) ($infoFila['cod'] ?? '');
            }
            if ($g === '') {
                continue;
            }
            $sz = trim((string) ($subzMap[$g] ?? ''));
            if ($sz === '') {
                $sz = trim((string) ($r['zona'] ?? ''));
            }
            if ($sz === '') {
                $sz = 'Sin subzona';
            }
            $ts = strtotime((string) ($r['fechaHoraTest'] ?? ''));
            if ($ts === false) {
                continue;
            }
            $anio = (int) date('Y', $ts);
            $mes = (int) date('n', $ts);
            $key = sprintf('%04d-%02d', $anio, $mes);
            $meses[$key] = ['anio' => $anio, 'mes' => $mes];
            if (!isset($porSubzona[$sz][$key])) {
                $porSubzona[$sz][$key] = ['sum' => 0.0, 'cnt' => 0];
            }
            $porSubzona[$sz][$key]['sum'] += (float) lum_valor_num($r);
            $porSubzona[$sz][$key]['cnt']++;
        }

        if ($meses === []) {
            $extra = ['diagnostico' => lum_reg_diagnostico($conn, $desde, $hasta, $location)];
            if (lum_sql_error() !== '') {
                $extra['sqlError'] = lum_sql_error();
            }

            return sip_grafica_lum_resp_base('subzona', $desde, $hasta, $location, $limites, $extra);
        }

        ksort($meses);
        $periodoKeys = array_keys($meses);
        $multiAnio = count(array_unique(array_column($meses, 'anio'))) > 1;
        $labels = [];
        foreach ($periodoKeys as $key) {
            $lbl = sip_grafica_lum_mes_label((int) $meses[$key]['mes']);
            if ($multiAnio) {
                $lbl .= " '" . substr((string) $meses[$key]['anio'], 2);
            }
            $labels[] = $lbl;
        }

        uksort($porSubzona, static function ($a, $b): int {
            return strcmp(sip_grafica_lum_subzona_sort_key($a), sip_grafica_lum_subzona_sort_key($b));
        });

        $series = [];
        $registros = [];
        foreach (array_keys($porSubzona) as $sz) {
            $porMes = $porSubzona[$sz];
            $registrosSerie = [];
            $conDato = 0;
            foreach ($periodoKeys as $i => $key) {
                $item = $meses[$key];
                $slot = $porMes[$key] ?? null;
                $prom = ($slot !== null && $slot['cnt'] > 0) ? round($slot['sum'] / $slot['cnt'], 3) : null;
                if ($prom !== null) {
                    $conDato++;
                }
                $registrosSerie[] = [
                    'subzona' => $sz,
                    'anio' => (int) $item['anio'],
                    'mes' => (int) $item['mes'],
                    'mesLabel' => $labels[$i],
                    'label' => $labels[$i],
                    'valor' => $prom,
                    'n' => $slot !== null ? (int) $slot['cnt'] : 0,
                ];
            }
            $registros = array_merge($registros, $registrosSerie);
            $series[] = [
                'location' => $location,
                'nombre' => $sz,
                'registros' => $registrosSerie,
                'labels' => $labels,
                'totalRegistros' => $conDato,
            ];
        }

        return sip_grafica_lum_resp_base('subzona', $desde, $hasta, $location, $limites, [
            'totalRegistros' => count($registros),
            'registros' => $registros,
            'grupos' => [],
            'labels' => $labels,
            'series' => $series,
            'bloques' => [[
                'titulo' => '',
                'labels' => $labels,
                'series' => $series,
            ]],
        ]);
    }
}

if (!function_exists('sip_grafica_lum_build_granja')) {
    /**
     * Valores por granja/campaña/galpón en el periodo (promedio si hay varias mediciones).
     * Eje X cronológico por punto de detección; una serie por granja/campaña/galpón.
     *
     * @param array<string,mixed> $opts
     */
    function sip_grafica_lum_build_granja(mysqli $conn, array $opts): array
    {
        $periodo = sip_grafica_lum_parse_periodo($opts);
        if (isset($periodo['success']) && $periodo['success'] === false) {
            return $periodo;
        }
        [$desde, $hasta] = $periodo;
        $location = trim((string) ($opts['location'] ?? $opts['punto'] ?? ''));

        if (!sip_grafica_lum_tabla_ok($conn)) {
            return ['success' => false, 'message' => 'Tabla san_luminometria_reg no disponible'];
        }

        $rows = sip_grafica_lum_fetch_rows($conn, $desde, $hasta, $location);
        $limites = lum_limites_metrica($conn);

        /** @var array<string, array{fechas:array<string,bool>, series:array<string,array<string,mixed>>}> $porPunto */
        $porPunto = [];
        foreach ($rows as $r) {
            $g = lum_norm_granja_cod((string) ($r['granja'] ?? ''));
            $nom = trim((string) ($r['granjaNombre'] ?? ''));
            if ($g === '') {
                $infoFila = lum_resolver_granja_fila($conn, (string) ($r['granja'] ?? ''), $nom);
                $g = (string) ($infoFila['cod'] ?? '');
                if (trim((string) ($infoFila['nombre'] ?? '')) !== '') {
                    $nom = trim((string) $infoFila['nombre']);
                }
            }
            if ($g === '') {
                continue;
            }
            $c = trim((string) ($r['campania'] ?? ''));
            $gp = sip_grafica_acum_galpon_norm($r['galpon'] ?? '');
            $punto = trim((string) ($r['puntoDeteccion'] ?? ''));
            if ($punto === '') {
                $punto = 'Sin punto';
            }
            $ts = strtotime((string) ($r['fechaHoraTest'] ?? ''));
            if ($ts === false) {
                continue;
            }
            $fecha = date('Y-m-d', $ts);
            $combo = sip_grafica_acum_combo_key($g, $c, $gp);
            if ($nom === '') {
                $nom = sip_grafica_acum_nombre_granja($g);
            }
            if (!isset($porPunto[$punto])) {
                $porPunto[$punto] = ['fechas' => [], 'series' => []];
            }
            $porPunto[$punto]['fechas'][$fecha] = true;
            if (!isset($porPunto[$punto]['series'][$combo])) {
                $porPunto[$punto]['series'][$combo] = [
                    'nombre' => sip_grafica_lum_etiqueta_combo($g, $nom, $c, $gp),
                    'granja' => $g,
                    'granjaNombre' => $nom,
                    'campania' => $c,
                    'galpon' => $gp,
                    'data' => [],
                ];
            }
            if (!isset($porPunto[$punto]['series'][$combo]['data'][$fecha])) {
                $porPunto[$punto]['series'][$combo]['data'][$fecha] = ['sum' => 0.0, 'cnt' => 0];
            }
            $porPunto[$punto]['series'][$combo]['data'][$fecha]['sum'] += (float) lum_valor_num($r);
            $porPunto[$punto]['series'][$combo]['data'][$fecha]['cnt']++;
        }

        if ($porPunto === []) {
            $extra = [
                'series' => [],
                'bloques' => [],
                'diagnostico' => lum_reg_diagnostico($conn, $desde, $hasta, $location),
            ];
            if (lum_sql_error() !== '') {
                $extra['sqlError'] = lum_sql_error();
            }

            return sip_grafica_lum_resp_base('granja', $desde, $hasta, $location, $limites, $extra);
        }

        uksort($porPunto, static function ($a, $b): int {
            return strcasecmp($a, $b);
        });

        $series = [];
        $bloques = [];
        $totalRegistros = 0;
        foreach ($porPunto as $punto => $bucket) {
            $fechas = array_keys($bucket['fechas']);
            sort($fechas);
            $multiAnio = count(array_unique(array_map(static function (string $f): string {
                return substr($f, 0, 4);
            }, $fechas))) > 1;
            $labels = [];
            foreach ($fechas as $fecha) {
                $labels[] = sip_grafica_lum_etiqueta_fecha($fecha, $multiAnio);
            }

            $combos = array_keys($bucket['series']);
            sort($combos, SORT_NATURAL | SORT_FLAG_CASE);

            $seriesBloque = [];
            foreach ($combos as $combo) {
                $def = $bucket['series'][$combo];
                $registros = [];
                $conDato = 0;
                foreach ($fechas as $i => $fecha) {
                    $slot = $def['data'][$fecha] ?? null;
                    $prom = ($slot !== null && $slot['cnt'] > 0) ? round($slot['sum'] / $slot['cnt'], 3) : null;
                    if ($prom !== null) {
                        $conDato++;
                    }
                    $registros[] = [
                        'granja' => $def['granja'],
                        'granjaNombre' => $def['granjaNombre'],
                        'campania' => $def['campania'],
                        'galpon' => $def['galpon'],
                        'fecha' => $fecha,
                        'punto' => $punto,
                        'label' => $labels[$i],
                        'valor' => $prom,
                        'n' => $slot !== null ? (int) $slot['cnt'] : 0,
                    ];
                }
                $seriesBloque[] = [
                    'location' => $punto,
                    'nombre' => (string) $def['nombre'],
                    'registros' => $registros,
                    'labels' => $labels,
                    'totalRegistros' => $conDato,
                ];
                $totalRegistros += $conDato;
            }
            $series = array_merge($series, $seriesBloque);
            $bloques[] = [
                'titulo' => $punto,
                'labels' => $labels,
                'series' => $seriesBloque,
            ];
        }

        $primera = $series[0];

        return sip_grafica_lum_resp_base('granja', $desde, $hasta, $location, $limites, [
            'totalRegistros' => $totalRegistros,
            'registros' => $primera['registros'],
            'labels' => $primera['labels'],
            'grupos' => [],
            'series' => $series,
            'bloques' => $bloques,
        ]);
    }
}

if (!function_exists('sip_grafica_lum_build')) {
    /**
     * @param array<string,mixed> $opts modo=subzona|granja, fechaInicio, fechaFin, location
     */
    function sip_grafica_lum_build(mysqli $conn, array $opts): array
    {
        if (!sip_grafica_lum_disp()) {
            return ['success' => false, 'message' => 'Luminometría no disponible en esta instalación'];
        }
        $modo = strtolower(trim((string) ($opts['modo'] ?? $opts['agrupacion'] ?? 'subzona')));
        if ($modo === 'granja' || $modo === 'granjas') {
            return sip_grafica_lum_build_granja($conn, $opts);
        }

        return sip_grafica_lum_build_subzona($conn, $opts);
    }
}
