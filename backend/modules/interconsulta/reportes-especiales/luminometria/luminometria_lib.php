<?php

declare(strict_types=1);

$incLocal = dirname(__DIR__, 2) . '/includes';
if (file_exists($incLocal . '/cencos/ccos_catalogo_lib.php')) {
    require_once $incLocal . '/cencos/ccos_catalogo_lib.php';
    require_once $incLocal . '/hc/hc_granjas_repository.php';
} else {
    require_once __DIR__ . '/../../../../includes/cencos/ccos_catalogo_lib.php';
    require_once __DIR__ . '/../../../../includes/hc/hc_granjas_repository.php';
}

function lum_str_contains(string $haystack, string $needle): bool
{
    if ($needle === '') {
        return true;
    }

    return strpos($haystack, $needle) !== false;
}

function lum_norm_header_key(string $h): string
{
    $h = trim($h);
    if (function_exists('mb_strtolower')) {
        $h = mb_strtolower($h, 'UTF-8');
    } else {
        $h = strtolower($h);
    }

    return trim(preg_replace('/\s+/', ' ', $h) ?? $h);
}

/** @param array<string, mixed> $raw */
function lum_row_get(array $raw, array $keys): string
{
    $norm = [];
    foreach ($raw as $k => $v) {
        $norm[lum_norm_header_key((string) $k)] = trim((string) $v);
    }
    foreach ($keys as $key) {
        $nk = lum_norm_header_key($key);
        if (array_key_exists($nk, $norm)) {
            return $norm[$nk];
        }
    }
    foreach ($keys as $key) {
        $nk = lum_norm_header_key($key);
        if ($nk === '') {
            continue;
        }
        foreach ($norm as $h => $v) {
            if ($h !== '' && lum_str_contains($h, $nk)) {
                return $v;
            }
        }
    }

    return '';
}

/** Coincidencia exacta de encabezado normalizado (sin fallback por subcadena). */
function lum_row_get_exact(array $raw, array $keys): string
{
    $norm = [];
    foreach ($raw as $k => $v) {
        $norm[lum_norm_header_key((string) $k)] = trim((string) $v);
    }
    foreach ($keys as $key) {
        $nk = lum_norm_header_key($key);
        if ($nk !== '' && array_key_exists($nk, $norm)) {
            return $norm[$nk];
        }
    }

    return '';
}

function lum_norm_match_key(string $s): string
{
    if (function_exists('mb_strtoupper')) {
        $s = mb_strtoupper(trim($s), 'UTF-8');
    } else {
        $s = strtoupper(trim($s));
    }

    return preg_replace('/[^A-Z0-9]/', '', $s) ?? '';
}

function lum_excel_serial_to_datetime(float $serial): string
{
    $ts = (int) round(($serial - 25569) * 86400);

    return date('Y-m-d H:i:s', $ts);
}

function lum_json_out(bool $ok, array $extra = [], int $code = 200): void
{
    if ($code !== 200) {
        http_response_code($code);
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['success' => $ok], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

function lum_h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function lum_tabla_ok(mysqli $conn): bool
{
    $q = @$conn->query("SHOW TABLES LIKE 'san_luminometria_reg'");

    return ($q && $q->num_rows > 0);
}

function lum_limites_tabla_ok(mysqli $conn): bool
{
    $q = @$conn->query("SHOW TABLES LIKE 'san_luminometria_limites'");

    return ($q && $q->num_rows > 0);
}

function lum_columna_existe(mysqli $conn, string $tabla, string $columna): bool
{
    $t = $conn->real_escape_string($tabla);
    $c = $conn->real_escape_string($columna);
    $q = @$conn->query("SHOW COLUMNS FROM `{$t}` LIKE '{$c}'");

    return ($q && $q->num_rows > 0);
}

function lum_indice_existe(mysqli $conn, string $tabla, string $indice): bool
{
    $t = $conn->real_escape_string($tabla);
    $i = $conn->real_escape_string($indice);
    $q = @$conn->query("SHOW INDEX FROM `{$t}` WHERE Key_name = '{$i}'");

    return ($q && $q->num_rows > 0);
}

/** Valor numérico sin ceros decimales sobrantes. */
function lum_fmt_num_limpio(?float $v): string
{
    if ($v === null) {
        return '';
    }
    if (!is_finite($v)) {
        return '';
    }
    $s = number_format($v, 4, '.', '');
    if (strpos($s, '.') !== false) {
        $s = rtrim(rtrim($s, '0'), '.');
    }

    return ($s === '' || $s === '-') ? '0' : $s;
}

/** @return list<string> Puntos de detección registrados. */
function lum_puntos_catalog(mysqli $conn): array
{
    if (!lum_tabla_ok($conn)) {
        return [];
    }
    $rs = @$conn->query(
        "SELECT DISTINCT TRIM(puntoDeteccion) AS punto
         FROM san_luminometria_reg
         WHERE TRIM(puntoDeteccion) <> ''
         ORDER BY TRIM(puntoDeteccion) ASC"
    );
    $data = [];
    if ($rs) {
        while ($r = $rs->fetch_assoc()) {
            $p = trim((string) ($r['punto'] ?? ''));
            if ($p !== '') {
                $data[] = $p;
            }
        }
    }

    return $data;
}

/** @param array<string, mixed> $row */
function lum_valor_display(array $row): string
{
    $raw = trim((string) ($row['valorRaw'] ?? $row['test_value_raw'] ?? ''));
    if ($raw !== '') {
        return $raw;
    }
    $val = $row['valor'] ?? $row['test_value'] ?? null;
    if ($val === null || $val === '') {
        return '';
    }

    return lum_fmt_num_limpio((float) $val);
}

function lum_reg_schema_nuevo(mysqli $conn): bool
{
    return lum_tabla_ok($conn) && lum_columna_existe($conn, 'san_luminometria_reg', 'granja');
}

function lum_abrev_por_granja_cod(string $granjaCod): string
{
    $cod = lum_norm_granja_cod($granjaCod);
    if ($cod === '') {
        return '';
    }
    $map = lum_granja_abrev_map();

    return isset($map[$cod]) ? (string) $map[$cod] : '';
}

function lum_derivar_id_campania(string $granjaCod, string $campania): string
{
    $abrev = lum_abrev_por_granja_cod($granjaCod);
    if ($abrev === '' || trim($campania) === '') {
        return '';
    }

    return $abrev . ' Camp ' . ltrim($campania, '0');
}

/** Nombre de granja con su código: "JOSE MARIA II [637]". */
function lum_granja_label(string $granjaCod, string $granjaNombre): string
{
    $cod = trim($granjaCod);
    $nom = trim($granjaNombre);
    if ($nom === '') {
        $nom = $cod;
    }
    if ($cod !== '' && $nom !== $cod && strpos($nom, $cod) === false) {
        return $nom . ' [' . $cod . ']';
    }

    return $nom;
}

/** @param array<string, mixed> $f */
function lum_fila_persist_normalize(array $f): array
{
    $map = [
        'unique_id_proveedor' => 'uniqueIdProveedor',
        'granja_cod' => 'granja',
        'granja_nombre' => 'granjaNombre',
        'test_results' => 'resultadoProveedor',
        'test_value' => 'valor',
        'test_value_raw' => 'valorRaw',
        'test_time' => 'fechaHoraTest',
        'location' => 'puntoDeteccion',
        'threshold_min' => 'stdMinProveedor',
        'threshold_max' => 'stdMaxProveedor',
        'device_model' => 'deviceModel',
        'device_id' => 'deviceId',
        'device_name' => 'deviceName',
    ];
    foreach ($map as $old => $new) {
        if (!array_key_exists($new, $f) && array_key_exists($old, $f)) {
            $f[$new] = $f[$old];
        }
    }

    return $f;
}

/** @param array<string, mixed> $row */
function lum_row_db_normalize_keys(array $row): array
{
    $map = [
        'unique_id_proveedor' => 'uniqueIdProveedor',
        'granja_cod' => 'granja',
        'granja_nombre' => 'granjaNombre',
        'test_results' => 'resultadoProveedor',
        'test_value' => 'valor',
        'test_value_raw' => 'valorRaw',
        'test_time' => 'fechaHoraTest',
        'location' => 'puntoDeteccion',
        'threshold_min' => 'stdMinProveedor',
        'threshold_max' => 'stdMaxProveedor',
        'device_model' => 'deviceModel',
        'device_id' => 'deviceId',
        'device_name' => 'deviceName',
        'fecha_hora_registro' => 'fechaHoraRegistro',
    ];
    foreach ($map as $old => $new) {
        if (!array_key_exists($new, $row) && array_key_exists($old, $row)) {
            $row[$new] = $row[$old];
        }
    }

    return $row;
}

/** @param array<string, mixed> $row */
function lum_row_db_to_display(mysqli $conn, array $row): array
{
    $row = lum_row_db_normalize_keys($row);
    $limites = lum_limites_metrica($conn);
    $row['lic'] = $limites['lic'];
    $row['lc'] = $limites['lc'];
    $row['lsc'] = $limites['lsc'];
    $fh = (string) ($row['fechaHoraTest'] ?? '');
    if ($fh !== '') {
        $ts = strtotime($fh);
        if ($ts !== false) {
            $mes = (int) date('n', $ts);
            $row['anio'] = (int) date('Y', $ts);
            $row['mesLabel'] = lum_mes_label_es($mes);
            $row['fechaInspeccionFmt'] = (int) date('j', $ts) . '-' . $row['mesLabel'];
            $row['fechaHoraTestFmt'] = date('d/m/Y H:i', $ts);
        }
    } else {
        $row['fechaHoraTestFmt'] = '';
        $row['fechaInspeccionFmt'] = '';
    }
    $row['granjaAbrev'] = lum_abrev_por_granja_cod((string) ($row['granja'] ?? ''));
    $row['idCampania'] = lum_derivar_id_campania((string) ($row['granja'] ?? ''), (string) ($row['campania'] ?? ''));
    $row['valorFmt'] = lum_valor_display($row);

    return $row;
}

function lum_migrate_reg_schema(mysqli $conn): void
{
    if (!lum_tabla_ok($conn)) {
        return;
    }
    $renames = [
        'unique_id_proveedor' => ['uniqueIdProveedor', "VARCHAR(64) NOT NULL DEFAULT ''"],
        'granja_cod' => ['granja', "VARCHAR(10) NOT NULL DEFAULT ''"],
        'granja_nombre' => ['granjaNombre', "VARCHAR(120) NOT NULL DEFAULT ''"],
        'test_results' => ['resultadoProveedor', "VARCHAR(40) NOT NULL DEFAULT ''"],
        'test_value' => ['valor', 'DECIMAL(14,4) DEFAULT NULL'],
        'test_value_raw' => ['valorRaw', "VARCHAR(40) NOT NULL DEFAULT ''"],
        'test_time' => ['fechaHoraTest', 'DATETIME DEFAULT NULL'],
        'location' => ['puntoDeteccion', "VARCHAR(255) NOT NULL DEFAULT ''"],
        'threshold_min' => ['stdMinProveedor', 'DECIMAL(14,4) DEFAULT NULL'],
        'threshold_max' => ['stdMaxProveedor', 'DECIMAL(14,4) DEFAULT NULL'],
        'device_model' => ['deviceModel', "VARCHAR(80) NOT NULL DEFAULT ''"],
        'device_id' => ['deviceId', "VARCHAR(80) NOT NULL DEFAULT ''"],
        'device_name' => ['deviceName', "VARCHAR(120) NOT NULL DEFAULT ''"],
        'fecha_hora_registro' => ['fechaHoraRegistro', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'],
    ];
    foreach ($renames as $old => $nuevo) {
        if (!lum_columna_existe($conn, 'san_luminometria_reg', $old)) {
            continue;
        }
        if (lum_columna_existe($conn, 'san_luminometria_reg', $nuevo[0])) {
            continue;
        }
        @$conn->query('ALTER TABLE san_luminometria_reg CHANGE `' . $old . '` `' . $nuevo[0] . '` ' . $nuevo[1]);
    }
    if (!lum_columna_existe($conn, 'san_luminometria_reg', 'valorRaw')
        && lum_columna_existe($conn, 'san_luminometria_reg', 'valor')) {
        @$conn->query("ALTER TABLE san_luminometria_reg ADD COLUMN valorRaw VARCHAR(40) NOT NULL DEFAULT '' AFTER valor");
    }
    foreach ([
        'granja_testing_plan', 'id_campania', 'retest', 'retest_id', 'lic', 'lc', 'lsc',
        'anio', 'mes_label', 'fecha_inspeccion_fmt', 'testing_plan_raw',
    ] as $drop) {
        if (lum_columna_existe($conn, 'san_luminometria_reg', $drop)) {
            @$conn->query("ALTER TABLE san_luminometria_reg DROP COLUMN `{$drop}`");
        }
    }
    if (lum_indice_existe($conn, 'san_luminometria_reg', 'idx_test_time')) {
        @$conn->query('ALTER TABLE san_luminometria_reg DROP INDEX idx_test_time');
    }
    if (!lum_indice_existe($conn, 'san_luminometria_reg', 'idx_granja_camp')) {
        @$conn->query('ALTER TABLE san_luminometria_reg ADD INDEX idx_granja_camp (`granja`, `campania`, `galpon`)');
    }
    if (!lum_indice_existe($conn, 'san_luminometria_reg', 'idx_fechaHoraTest')) {
        @$conn->query('ALTER TABLE san_luminometria_reg ADD INDEX idx_fechaHoraTest (`fechaHoraTest`)');
    }
}

function lum_ensure_tables(mysqli $conn): void
{
    @$conn->query("CREATE TABLE IF NOT EXISTS san_luminometria_limites (
        id INT NOT NULL AUTO_INCREMENT,
        metrica VARCHAR(50) NOT NULL,
        lic DECIMAL(12,4) DEFAULT NULL,
        lc DECIMAL(12,4) DEFAULT NULL,
        lsc DECIMAL(12,4) DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_metrica (metrica)
    ) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci");

    @$conn->query("CREATE TABLE IF NOT EXISTS san_luminometria_reg (
        id INT NOT NULL AUTO_INCREMENT,
        uniqueIdProveedor VARCHAR(64) NOT NULL DEFAULT '',
        granja VARCHAR(10) NOT NULL DEFAULT '',
        granjaNombre VARCHAR(120) NOT NULL DEFAULT '',
        campania VARCHAR(10) NOT NULL DEFAULT '',
        galpon VARCHAR(10) NOT NULL DEFAULT '',
        zona VARCHAR(80) NOT NULL DEFAULT '',
        sexo CHAR(1) NOT NULL DEFAULT '',
        resultadoProveedor VARCHAR(40) NOT NULL DEFAULT '',
        valor DECIMAL(14,4) DEFAULT NULL,
        valorRaw VARCHAR(40) NOT NULL DEFAULT '',
        fechaHoraTest DATETIME DEFAULT NULL,
        puntoDeteccion VARCHAR(255) NOT NULL DEFAULT '',
        stdMinProveedor DECIMAL(14,4) DEFAULT NULL,
        stdMaxProveedor DECIMAL(14,4) DEFAULT NULL,
        deviceModel VARCHAR(80) NOT NULL DEFAULT '',
        deviceId VARCHAR(80) NOT NULL DEFAULT '',
        deviceName VARCHAR(120) NOT NULL DEFAULT '',
        note TEXT,
        inspector VARCHAR(120) NOT NULL DEFAULT '',
        estado VARCHAR(40) NOT NULL DEFAULT '',
        estado2 VARCHAR(40) NOT NULL DEFAULT '',
        origen ENUM('scraping','upload','manual') NOT NULL DEFAULT 'upload',
        usuario VARCHAR(40) NOT NULL DEFAULT '',
        fechaHoraRegistro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_unique_proveedor (uniqueIdProveedor),
        KEY idx_granja_camp (granja, campania, galpon),
        KEY idx_fechaHoraTest (fechaHoraTest)
    ) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci");

    lum_migrate_reg_schema($conn);

    $chk = @$conn->query("SELECT id FROM san_luminometria_limites WHERE metrica = 'luminometria' LIMIT 1");
    if ($chk && $chk->num_rows === 0) {
        @$conn->query("INSERT INTO san_luminometria_limites (metrica, lic, lc, lsc) VALUES ('luminometria', NULL, NULL, NULL)");
    }
}

/** @return array<string, mixed> */
function lum_proveedor_config(): array
{
    $paths = [
        __DIR__ . '/../../../../includes/luminometria_proveedor_config.php',
        dirname(__DIR__, 4) . '/includes/luminometria_proveedor_config.php',
    ];
    foreach ($paths as $p) {
        if (is_file($p)) {
            $cfg = require $p;
            if (is_array($cfg)) {
                return $cfg;
            }
        }
    }

    return [
        'base_url' => 'https://47.253.170.149:3300',
        'api_prefix' => '/cloud-platform',
        'usuario' => '',
        'password' => '',
        'verify_ssl' => false,
    ];
}

function lum_norm_granja_cod(string $g): string
{
    return ccos_norm_granja($g);
}

/** Mapa código 3 dígitos → abreviatura (trazabilidad). */
function lum_granja_abrev_map(): array
{
    static $map = null;
    if (is_array($map)) {
        return $map;
    }
    $lib = __DIR__ . '/../../../laboratorio/trazabilidad/trazabilidad_lib.php';
    if (is_file($lib)) {
        require_once $lib;
        if (function_exists('trz_granja_abrev_map')) {
            $map = trz_granja_abrev_map();

            return $map;
        }
    }
    $map = [
        '627' => 'SG', '621' => 'ST', '644' => 'REN', '642' => 'SL', '667' => 'TUC', '664' => 'VENT',
        '663' => 'T ESP', '661' => 'PON I', '637' => 'JM II', '636' => 'JM I', '635' => 'GDA V',
        '634' => 'GDA IV', '666' => 'T NOS', '665' => 'TNUE', '662' => 'PON II', '628' => 'GL I',
        '623' => 'GL II', '625' => 'GL III', '643' => 'VCH', '632' => 'GDA III', '630' => 'GDA I',
        '631' => 'GDA II',
    ];

    return $map;
}

function lum_norm_abrev_granja(string $s): string
{
    $s = trim(preg_replace('/\s+/', ' ', $s) ?? $s);
    if (function_exists('mb_strtoupper')) {
        return mb_strtoupper($s, 'UTF-8');
    }

    return strtoupper($s);
}

/** Abreviaturas alternas del testing plan: alias => código granja. */
function lum_granja_abrev_alias_map(): array
{
    return [
        'RENS' => '644',
        'GL L' => '628',
        'GLL' => '628',
        'GL 1' => '628',
        'GL1' => '628',
    ];
}

/** Código granja (3 dígitos) desde abreviatura del testing plan (ej. JM I → 636). */
function lum_cod_granja_por_abrev(string $abrevGranja): string
{
    $abrev = trim($abrevGranja);
    if ($abrev === '') {
        return '';
    }
    $keyExact = lum_norm_abrev_granja($abrev);
    $keyMatch = lum_norm_match_key($abrev);
    foreach (lum_granja_abrev_alias_map() as $alias => $cod) {
        if ($keyExact === lum_norm_abrev_granja((string) $alias) || ($keyMatch !== '' && $keyMatch === lum_norm_match_key((string) $alias))) {
            return lum_norm_granja_cod((string) $cod);
        }
    }
    $bestCod = '';
    $bestLen = 0;
    foreach (lum_granja_abrev_map() as $cod => $label) {
        $labelNorm = lum_norm_abrev_granja((string) $label);
        $labelMatch = lum_norm_match_key((string) $label);
        if ($labelNorm === $keyExact) {
            return lum_norm_granja_cod((string) $cod);
        }
        if ($keyMatch !== '' && $labelMatch === $keyMatch) {
            $len = strlen($labelMatch);
            if ($len > $bestLen) {
                $bestLen = $len;
                $bestCod = lum_norm_granja_cod((string) $cod);
            }
        }
    }

    return $bestCod;
}

/** @return array{cod:string,nombre:string,zona:string} */
function lum_granja_info_por_cod(mysqli $conn, string $granjaCod, string $fallbackNombre = ''): array
{
    $cod = lum_norm_granja_cod($granjaCod);
    if ($cod === '') {
        return ['cod' => '', 'nombre' => $fallbackNombre, 'zona' => ''];
    }
    $idx = lum_granjas_index($conn);
    $nombre = $fallbackNombre;
    if (isset($idx[$cod]['nombre']) && trim((string) $idx[$cod]['nombre']) !== '') {
        $nombre = (string) $idx[$cod]['nombre'];
    } elseif ($fallbackNombre === '') {
        foreach (lum_granja_abrev_map() as $g3 => $abrev) {
            if (lum_norm_granja_cod((string) $g3) === $cod) {
                $nombre = (string) $abrev;
                break;
            }
        }
    }
    $zona = lum_zona_por_granja_cod($conn, $cod);

    return ['cod' => $cod, 'nombre' => $nombre !== '' ? $nombre : $cod, 'zona' => $zona];
}

/** Resuelve granja de una fila persistida: código vacío o abreviatura del testing plan. */
function lum_resolver_granja_fila(mysqli $conn, string $granjaCod, string $granjaNombre): array
{
    $cod = lum_norm_granja_cod($granjaCod);
    $nombre = trim($granjaNombre);
    $galpon = '';
    $sexo = '';
    if ($nombre !== '') {
        [$nombreTp, $galponTp, $sexoTp] = lum_parse_testing_plan($nombre);
        $galpon = $galponTp;
        $sexo = $sexoTp;
        if ($cod === '') {
            foreach ([$nombreTp, $nombre] as $cand) {
                if (trim($cand) === '') {
                    continue;
                }
                $cod = lum_cod_granja_por_abrev($cand);
                if ($cod !== '') {
                    break;
                }
            }
        }
    }
    if ($cod === '' && $nombre !== '') {
        $res = lum_resolver_granja($conn, $nombre);
        $cod = (string) ($res['cod'] ?? '');
    }
    if ($cod === '') {
        return ['cod' => '', 'nombre' => $nombre, 'zona' => '', 'galpon' => $galpon, 'sexo' => $sexo];
    }

    $info = lum_granja_info_por_cod($conn, $cod, $nombre);
    $info['galpon'] = $galpon;
    $info['sexo'] = $sexo;

    return $info;
}

/** Etiqueta del testing plan: granja, galpón y sexo. */
function lum_parse_testing_plan(string $raw): array
{
    $s = trim(preg_replace('/\s+/', ' ', $raw) ?? $raw);
    $s = preg_replace('/^testing\s*plan\s*:?\s*/iu', '', $s) ?? $s;
    $s = preg_replace('/\s*number\s*of\s*tests\b.*$/iu', '', $s) ?? $s;
    $s = trim($s, " \t\n\r\0\x0B,;");
    if ($s === '') {
        return ['', '', ''];
    }
    if (lum_cod_granja_por_abrev($s) !== '') {
        return [$s, '', ''];
    }
    $patrones = [
        '/^(.+?)\s+G\s*(\d+)\s*([MH])?$/iu',
        '/^(.+?[A-Za-z])G\s*(\d+)\s*([MH])?$/iu',
        '/^(.+?)\s+(\d+)\s*([MH])?$/iu',
    ];
    foreach ($patrones as $re) {
        if (preg_match($re, $s, $m)) {
            $granja = trim((string) $m[1]);
            if ($granja === '') {
                continue;
            }
            $sexo = isset($m[3]) ? strtoupper((string) $m[3]) : '';

            return [$granja, (string) (int) $m[2], $sexo];
        }
    }
    if (preg_match('/^(.+?)\s+([MH])\s*$/iu', $s, $m)) {
        return [trim($m[1]), '', strtoupper($m[2])];
    }

    return [$s, '', ''];
}

function lum_mes_label_es(int $month): string
{
    static $meses = [1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr', 5 => 'may', 6 => 'jun', 7 => 'jul', 8 => 'ago', 9 => 'sep', 10 => 'oct', 11 => 'nov', 12 => 'dic'];

    return $meses[$month] ?? '';
}

function lum_parse_threshold(?string $raw): array
{
    $s = trim((string) $raw);
    if ($s === '') {
        return [null, null];
    }
    if (preg_match('/([\d.,]+)\s*[-–—]\s*([\d.,]+)/u', $s, $m)) {
        $min = (float) str_replace(',', '.', $m[1]);
        $max = (float) str_replace(',', '.', $m[2]);

        return [$min, $max];
    }

    return [null, null];
}

/** @param mixed $raw */
function lum_parse_datetime($raw): ?string
{
    if ($raw === null || $raw === '') {
        return null;
    }
    if ($raw instanceof \DateTimeInterface) {
        return $raw->format('Y-m-d H:i:s');
    }
    if (is_float($raw) || is_int($raw)) {
        $n = (float) $raw;
        if ($n > 20000 && $n < 80000) {
            return lum_excel_serial_to_datetime($n);
        }
    }
    $s = trim((string) $raw);
    if ($s === '') {
        return null;
    }
    if (is_numeric($s)) {
        $n = (float) $s;
        if ($n > 20000 && $n < 80000) {
            return lum_excel_serial_to_datetime($n);
        }
    }
    if (preg_match('/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/', $s, $m)) {
        return str_replace('T', ' ', $m[1]);
    }
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/', $s, $m)) {
        $hh = isset($m[4]) && $m[4] !== '' ? $m[4] : '00:00:00';
        if (strlen($hh) === 5) {
            $hh .= ':00';
        }

        return sprintf('%04d-%02d-%02d %s', (int) $m[3], (int) $m[2], (int) $m[1], $hh);
    }
    $ts = strtotime($s);

    return ($ts !== false) ? date('Y-m-d H:i:s', $ts) : null;
}

/** @return array<string, string> granja_cod => zona o subzona */
function lum_zonas_dim_por_granja(mysqli $conn): array
{
    static $cache = null;
    if (is_array($cache)) {
        return $cache;
    }
    $cache = [];
    $excluidas = "('624','640','641')";
    $sql = "SELECT TRIM(det.id_granja) AS codigo,
            MAX(CASE WHEN UPPER(TRIM(car.nombre)) = 'ZONA' THEN TRIM(det.dato) END) AS zona,
            MAX(CASE WHEN UPPER(TRIM(car.nombre)) = 'SUBZONA' THEN TRIM(det.dato) END) AS subzona
        FROM pi_dim_detalles det
        INNER JOIN pi_dim_caracteristicas car ON car.id = det.id_caracteristica
        WHERE TRIM(det.id_granja) <> ''
          AND TRIM(det.id_granja) LIKE '6%'
          AND TRIM(det.id_granja) NOT IN {$excluidas}
          AND UPPER(TRIM(car.nombre)) IN ('ZONA', 'SUBZONA')
        GROUP BY TRIM(det.id_granja)";
    $rs = @$conn->query($sql);
    while ($rs && ($r = $rs->fetch_assoc())) {
        $cod = lum_norm_granja_cod((string) ($r['codigo'] ?? ''));
        if ($cod === '') {
            continue;
        }
        $zona = trim((string) ($r['subzona'] ?? ''));
        if ($zona === '') {
            $zona = trim((string) ($r['zona'] ?? ''));
        }
        if ($zona !== '') {
            $cache[$cod] = $zona;
        }
    }

    return $cache;
}

/** @return array<string, array{nombre:string,zona:string}> */
function lum_granjas_index(mysqli $conn): array
{
    static $cache = null;
    if (is_array($cache)) {
        return $cache;
    }
    $cache = [];
    if (!function_exists('hc_granjas_listar_para_selector')) {
        return $cache;
    }
    foreach (hc_granjas_listar_para_selector($conn) as $row) {
        $cod = lum_norm_granja_cod((string) ($row['granja'] ?? ''));
        $nombre = trim((string) ($row['nombre'] ?? ''));
        if ($cod === '') {
            continue;
        }
        $zona = trim((string) ($row['zona'] ?? ''));
        $subzona = trim((string) ($row['subzona'] ?? ''));
        $zonaVal = $subzona !== '' ? $subzona : $zona;
        $cache[$cod] = ['nombre' => $nombre !== '' ? $nombre : $cod, 'zona' => $zonaVal];
        if ($nombre !== '') {
            $key = function_exists('mb_strtolower') ? mb_strtolower(trim($nombre), 'UTF-8') : strtolower(trim($nombre));
            $cache['name:' . $key] = ['cod' => $cod, 'nombre' => $nombre, 'zona' => $zonaVal];
            $mk = lum_norm_match_key($nombre);
            if ($mk !== '') {
                $cache['match:' . $mk] = ['cod' => $cod, 'nombre' => $nombre, 'zona' => $zonaVal];
            }
        }
    }
    foreach (lum_zonas_dim_por_granja($conn) as $cod => $zona) {
        if (!isset($cache[$cod])) {
            $cache[$cod] = ['nombre' => $cod, 'zona' => $zona];
            continue;
        }
        if (trim((string) ($cache[$cod]['zona'] ?? '')) === '') {
            $cache[$cod]['zona'] = $zona;
        }
    }

    return $cache;
}

/** @return array{cod:string,nombre:string,zona:string} */
function lum_zona_por_granja_cod(mysqli $conn, string $granjaCod): string
{
    if ($granjaCod === '') {
        return '';
    }
    $idx = lum_granjas_index($conn);
    if (isset($idx[$granjaCod])) {
        return (string) ($idx[$granjaCod]['zona'] ?? '');
    }
    foreach ($idx as $k => $row) {
        if (!is_string($k)) {
            continue;
        }
        if (isset($row['cod']) && (string) $row['cod'] === $granjaCod) {
            return (string) ($row['zona'] ?? '');
        }
    }

    return '';
}

/** @return array{cod:string,nombre:string,zona:string} */
function lum_buscar_granja_regcencos(mysqli $conn, string $nombreBuscar): array
{
    static $cache = null;
    if (!is_array($cache)) {
        $cache = [];
        $rs = @$conn->query(
            "SELECT LEFT(TRIM(tcencos), 3) AS g3, MAX(TRIM(tnomcen)) AS nom
             FROM regcencosgalpones
             WHERE TRIM(tcencos) <> ''
             GROUP BY LEFT(TRIM(tcencos), 3)"
        );
        while ($rs && ($r = $rs->fetch_assoc())) {
            $g3 = lum_norm_granja_cod((string) ($r['g3'] ?? ''));
            $nom = trim((string) ($r['nom'] ?? ''));
            if ($g3 === '') {
                continue;
            }
            $mk = lum_norm_match_key($nom);
            if ($mk !== '') {
                $cache[$mk] = ['cod' => $g3, 'nombre' => $nom !== '' ? $nom : $g3];
            }
            $cache['g3:' . $g3] = ['cod' => $g3, 'nombre' => $nom !== '' ? $nom : $g3];
        }
    }
    $key = lum_norm_match_key($nombreBuscar);
    if ($key !== '' && isset($cache[$key])) {
        $hit = $cache[$key];

        return [
            'cod' => (string) $hit['cod'],
            'nombre' => (string) $hit['nombre'],
            'zona' => lum_zona_por_granja_cod($conn, (string) $hit['cod']),
        ];
    }
    foreach ($cache as $mk => $hit) {
        if (!is_string($mk) || strpos($mk, 'g3:') === 0) {
            continue;
        }
        if ($key !== '' && (lum_str_contains($mk, $key) || lum_str_contains($key, $mk))) {
            return [
                'cod' => (string) $hit['cod'],
                'nombre' => (string) $hit['nombre'],
                'zona' => lum_zona_por_granja_cod($conn, (string) $hit['cod']),
            ];
        }
    }

    return ['cod' => '', 'nombre' => trim($nombreBuscar), 'zona' => ''];
}

/** @return array{cod:string,nombre:string,zona:string} */
function lum_resolver_granja(mysqli $conn, string $testingPlanName): array
{
    $nombre = trim($testingPlanName);
    if ($nombre === '') {
        return ['cod' => '', 'nombre' => '', 'zona' => ''];
    }
    $codAbrev = lum_cod_granja_por_abrev($nombre);
    if ($codAbrev !== '') {
        return lum_granja_info_por_cod($conn, $codAbrev, $nombre);
    }
    $idx = lum_granjas_index($conn);
    $key = function_exists('mb_strtolower') ? mb_strtolower($nombre, 'UTF-8') : strtolower($nombre);
    if ($key !== '' && isset($idx['name:' . $key])) {
        $hit = $idx['name:' . $key];

        return ['cod' => (string) ($hit['cod'] ?? ''), 'nombre' => (string) ($hit['nombre'] ?? ''), 'zona' => (string) ($hit['zona'] ?? '')];
    }
    $mk = lum_norm_match_key($nombre);
    if ($mk !== '' && isset($idx['match:' . $mk])) {
        $hit = $idx['match:' . $mk];

        return ['cod' => (string) ($hit['cod'] ?? ''), 'nombre' => (string) ($hit['nombre'] ?? ''), 'zona' => (string) ($hit['zona'] ?? '')];
    }
    foreach ($idx as $k => $row) {
        if (!is_string($k) || (strpos($k, 'name:') !== 0 && strpos($k, 'match:') !== 0)) {
            continue;
        }
        $nomKey = strpos($k, 'name:') === 0 ? substr($k, 5) : substr($k, 6);
        if ($nomKey !== '' && ($nomKey === $key || lum_str_contains($nomKey, $key) || lum_str_contains($key, $nomKey))) {
            return ['cod' => (string) ($row['cod'] ?? ''), 'nombre' => (string) ($row['nombre'] ?? ''), 'zona' => (string) ($row['zona'] ?? '')];
        }
    }
    $reg = lum_buscar_granja_regcencos($conn, $nombre);
    if ($reg['cod'] !== '') {
        return $reg;
    }

    return ['cod' => '', 'nombre' => $nombre, 'zona' => ''];
}

/** @return array{cod:string,nombre:string,zona:string,campania:string,id_campania:string} */
function lum_completar_campania_zona_id(mysqli $conn, string $granjaTp, array $granjaInfo, string $fechaYmd): array
{
    $granjaCod = (string) ($granjaInfo['cod'] ?? '');
    $granjaNombre = (string) ($granjaInfo['nombre'] ?? '');
    $zona = (string) ($granjaInfo['zona'] ?? '');
    $campania = '';
    $idCamp = '';

    if ($granjaCod === '' && $granjaTp !== '') {
        $granjaInfo = lum_resolver_granja($conn, $granjaTp);
        $granjaCod = (string) ($granjaInfo['cod'] ?? '');
        $granjaNombre = (string) ($granjaInfo['nombre'] ?? $granjaTp);
        $zona = (string) ($granjaInfo['zona'] ?? '');
    }
    if ($zona === '' && $granjaCod !== '') {
        $zona = lum_zona_por_granja_cod($conn, $granjaCod);
    }
    if ($fechaYmd !== '' && $granjaCod !== '') {
        $campania = lum_campania_en_fecha($conn, $granjaCod, $fechaYmd);
    }
    if ($granjaTp !== '' && $campania !== '') {
        $idCamp = $granjaTp . ' Camp ' . ltrim($campania, '0');
    }

    return [
        'cod' => $granjaCod,
        'nombre' => $granjaNombre !== '' ? $granjaNombre : $granjaTp,
        'zona' => $zona,
        'campania' => $campania,
        'id_campania' => $idCamp,
    ];
}

function lum_campania_en_fecha(mysqli $conn, string $granjaCod, string $fechaYmd): string
{
    if ($granjaCod === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaYmd)) {
        return '';
    }
    $payload = ccos_fetch_campanias($conn, [$granjaCod], ['desde' => $fechaYmd, 'hasta' => $fechaYmd]);

    return ccos_sugerir_campania($payload['cencos'] ?? [], $fechaYmd);
}

/** @return array{lic:?float,lc:?float,lsc:?float} */
function lum_limites_metrica(mysqli $conn, string $metrica = 'luminometria'): array
{
    if (!lum_limites_tabla_ok($conn)) {
        return ['lic' => null, 'lc' => null, 'lsc' => null];
    }
    $st = $conn->prepare('SELECT lic, lc, lsc FROM san_luminometria_limites WHERE metrica = ? LIMIT 1');
    if (!$st) {
        return ['lic' => null, 'lc' => null, 'lsc' => null];
    }
    $st->bind_param('s', $metrica);
    $st->execute();
    $rs = $st->get_result();
    $row = ($rs && ($r = $rs->fetch_assoc())) ? $r : null;
    $st->close();
    if (!$row) {
        return ['lic' => null, 'lc' => null, 'lsc' => null];
    }

    return [
        'lic' => $row['lic'] !== null ? (float) $row['lic'] : null,
        'lc' => $row['lc'] !== null ? (float) $row['lc'] : null,
        'lsc' => $row['lsc'] !== null ? (float) $row['lsc'] : null,
    ];
}

function lum_calc_estado(?float $testValue, ?float $lc, ?float $lsc): string
{
    if ($testValue === null || $lc === null || $lsc === null) {
        return '';
    }
    if ($testValue < $lc) {
        return 'Aceptable';
    }
    if ($testValue > $lsc) {
        return 'Rechazado';
    }

    return 'Precaución';
}

function lum_calc_estado2(mysqli $conn, string $granjaCod, string $campania, string $fechaYmd): string
{
    if ($granjaCod === '' || $campania === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaYmd)) {
        return '';
    }
    $info = ccos_fetch_intervalo_campania($conn, $granjaCod, $campania, $fechaYmd);
    if ($info['fecha_inicio'] === null && $info['swac'] === '') {
        return '';
    }
    if ($info['swac'] === 'A' && !empty($info['activa'])) {
        return 'Activa';
    }

    return 'Liquidada';
}

/** @param array<string, mixed> $raw */
function lum_row_has_data(array $raw): bool
{
    if (lum_xlsx_row_is_metadata($raw)) {
        return false;
    }
    $testingPlan = lum_row_get($raw, ['Testing plan', 'checkPlan', 'testing_plan', 'Plan de prueba']);
    $testValue = lum_row_get($raw, ['Test value', 'checkValue', 'valor de detección']);
    $testTime = lum_row_get($raw, ['Test time', 'checkDatetime', 'test_time', 'Hora de prueba']);
    if ($testValue === '' && $testTime === '') {
        return false;
    }
    if (trim($testingPlan) !== '') {
        return true;
    }
    if (lum_row_get($raw, ['Unique ID', 'hrGuid', 'Identificador único']) !== '') {
        return true;
    }
    if ($testValue !== '') {
        return true;
    }
    if ($testTime !== '') {
        return true;
    }
    foreach ($raw as $v) {
        if ($v === null || $v === '') {
            continue;
        }
        if (is_string($v) && trim($v) === '') {
            continue;
        }
        if (is_numeric($v) && (float) $v === 0.0) {
            continue;
        }

        return true;
    }

    return false;
}

/** @param array<string, mixed> $raw */
function lum_xlsx_row_is_metadata(array $raw): bool
{
    $vals = [];
    foreach ($raw as $v) {
        $t = trim((string) $v);
        if ($t !== '') {
            $vals[] = $t;
        }
    }
    if ($vals === []) {
        return true;
    }
    if (count($vals) === 1 && preg_match('/^(testing\s*plan|test\s*time|date\s*range|inspector)\s*:?\s*$/iu', $vals[0])) {
        return true;
    }
    $joined = implode(' ', $vals);
    if (preg_match('/number\s*of\s*tests/iu', $joined)) {
        return true;
    }
    foreach ($vals as $t) {
        if (preg_match('/^testing\s*plan\b/iu', $t)) {
            return true;
        }
        if (preg_match('/\btesting\s*plan\s*:/iu', $t) && preg_match('/number\s*of\s*tests/iu', $t)) {
            return true;
        }
    }
    if (preg_match('/^(testing\s*plan|test\s*time|date\s*range)\s*:/iu', $joined) && lum_row_get($raw, ['Unique ID', 'hrGuid', 'Identificador único']) === '') {
        return true;
    }
    if (preg_match('/(testing\s*plan|date\s*range)\s*:/iu', $joined)
        && lum_row_get($raw, ['Test value', 'checkValue', 'valor de detección', 'Test time', 'checkDatetime']) === '') {
        return true;
    }

    return false;
}

function lum_map_proveedor_row(mysqli $conn, array $raw, string $inspector = '', string $origen = 'upload'): array
{
    $testingPlan = lum_row_get($raw, ['Testing plan', 'checkPlan', 'testing_plan', 'Plan de prueba']);
    [$granjaTp, $galpon, $sexo] = lum_parse_testing_plan($testingPlan);
    $testTimeRaw = lum_row_get($raw, ['Test time', 'checkDatetime', 'test_time', 'Hora de prueba']);
    if ($testTimeRaw === '') {
        foreach (['Test time', 'checkDatetime', 'test_time', 'Hora de prueba'] as $tk) {
            if (array_key_exists($tk, $raw) && $raw[$tk] !== null && $raw[$tk] !== '') {
                $testTimeRaw = $raw[$tk];
                break;
            }
        }
    }
    $testTime = lum_parse_datetime($testTimeRaw);
    $fechaYmd = $testTime ? substr($testTime, 0, 10) : '';
    $granjaInfo = lum_resolver_granja($conn, $granjaTp);
    $deriv = lum_completar_campania_zona_id($conn, $granjaTp, $granjaInfo, $fechaYmd);
    $granjaCod = $deriv['cod'];
    $campania = $deriv['campania'];
    [$tMin, $tMax] = lum_parse_threshold(lum_row_get($raw, ['Threshold', 'checkBasics', 'Umbral']));
    $limites = lum_limites_metrica($conn);
    $uniqueId = lum_row_get($raw, ['Unique ID', 'hrGuid', 'Identificador único']);
    $inspectorVal = trim($inspector);
    if ($inspectorVal === '') {
        $inspectorVal = lum_row_get($raw, ['Inspector', 'checkPeople']);
    }
    $testValueRaw = lum_row_get($raw, ['Test value', 'checkValue', 'valor de detección']);
    $testValue = ($testValueRaw !== '') ? (float) str_replace(',', '.', $testValueRaw) : null;
    $testResults = lum_row_get_exact($raw, ['Test results', 'checkResult', 'Resultados de detección']);
    if ($testResults === '') {
        $testResults = lum_row_get($raw, ['Test results', 'checkResult', 'Resultados de detección']);
    }
    $lic = $limites['lic'];
    $lc = $limites['lc'];
    $lsc = $limites['lsc'];
    $estado = lum_calc_estado($testValue, $lc, $lsc);
    $estado2 = lum_calc_estado2($conn, $granjaCod, $campania, $fechaYmd);

    return [
        'uniqueIdProveedor' => $uniqueId,
        'granja' => $granjaCod,
        'granjaNombre' => $deriv['nombre'] !== '' ? $deriv['nombre'] : $granjaTp,
        'campania' => $campania,
        'galpon' => $galpon,
        'zona' => $deriv['zona'],
        'sexo' => $sexo,
        'resultadoProveedor' => $testResults,
        'valor' => $testValue,
        'valorRaw' => trim($testValueRaw),
        'fechaHoraTest' => $testTime,
        'puntoDeteccion' => lum_row_get($raw, ['Location', 'checkLocation', 'Puntos de detección']),
        'stdMinProveedor' => $tMin,
        'stdMaxProveedor' => $tMax,
        'deviceModel' => lum_row_get($raw, ['Device model', 'deviceModel', 'Detección del dispositivo']),
        'deviceId' => lum_row_get($raw, ['Device ID', 'deviceSerial', 'Número de serie del dispositivo']),
        'deviceName' => lum_row_get($raw, ['Device name', 'deviceName', 'Nombre del dispositivo']),
        'note' => lum_row_get($raw, ['Note', 'checkRemarks']),
        'inspector' => $inspectorVal,
        'estado' => $estado,
        'estado2' => $estado2,
        'origen' => $origen,
    ];
}

/** @return list<array<string, mixed>> */
function lum_transform_rows(mysqli $conn, array $rawRows, string $inspector = '', string $origen = 'upload'): array
{
    $out = [];
    foreach ($rawRows as $raw) {
        if (!is_array($raw)) {
            continue;
        }
        if (!lum_row_has_data($raw)) {
            continue;
        }
        $mapped = lum_map_proveedor_row($conn, $raw, $inspector, $origen);
        if ($mapped['fechaHoraTest'] === null && $mapped['valor'] === null && trim($mapped['uniqueIdProveedor']) === '') {
            continue;
        }
        $out[] = lum_row_db_to_display($conn, $mapped);
    }

    return $out;
}

/** @return list<string> */
function lum_export_headers(): array
{
    return [
        'N°', 'Zona', 'Granja', 'Campaña', 'Galpon', 'ID', 'Sexo', 'Resultados de detección', 'valor de detección',
        'LIC', 'LC', 'LSC', 'AÑO', 'MES', 'Fecha de inspección', 'Inspector', 'Puntos de detección', 'Minimo', 'Maximo',
        'Reprueba', 'Detección del dispositivo', 'Número de serie del dispositivo', 'Nombre del dispositivo', 'Note',
        'Identificador único', 'Estado', 'Estado2',
    ];
}

/** @param array<string, mixed> $row */
function lum_row_to_export(array $row, int $num, bool $useAbrevGranja = false): array
{
    $row = lum_row_db_normalize_keys($row);
    $granjaExp = $useAbrevGranja
        ? (string) ($row['granjaAbrev'] ?? '')
        : (string) ($row['granjaNombre'] ?? '');

    return [
        (string) $num,
        (string) ($row['zona'] ?? ''),
        $granjaExp,
        (string) ($row['campania'] ?? ''),
        (string) ($row['galpon'] ?? ''),
        (string) ($row['idCampania'] ?? ''),
        (string) ($row['sexo'] ?? ''),
        (string) ($row['resultadoProveedor'] ?? ''),
        lum_valor_display($row),
        $row['lic'] !== null && $row['lic'] !== '' ? (string) $row['lic'] : '',
        $row['lc'] !== null && $row['lc'] !== '' ? (string) $row['lc'] : '',
        $row['lsc'] !== null && $row['lsc'] !== '' ? (string) $row['lsc'] : '',
        isset($row['anio']) && $row['anio'] !== null ? (string) $row['anio'] : '',
        (string) ($row['mesLabel'] ?? ''),
        (string) ($row['fechaInspeccionFmt'] ?? ''),
        (string) ($row['inspector'] ?? ''),
        (string) ($row['puntoDeteccion'] ?? ''),
        $row['stdMinProveedor'] !== null && $row['stdMinProveedor'] !== '' ? (string) $row['stdMinProveedor'] : '',
        $row['stdMaxProveedor'] !== null && $row['stdMaxProveedor'] !== '' ? (string) $row['stdMaxProveedor'] : '',
        '',
        (string) ($row['deviceModel'] ?? ''),
        (string) ($row['deviceId'] ?? ''),
        (string) ($row['deviceName'] ?? ''),
        (string) ($row['note'] ?? ''),
        (string) ($row['uniqueIdProveedor'] ?? ''),
        (string) ($row['estado'] ?? ''),
        (string) ($row['estado2'] ?? ''),
    ];
}

/** @return list<array<string, mixed>> */
function lum_fetch_limites_all(mysqli $conn): array
{
    if (!lum_limites_tabla_ok($conn)) {
        return [];
    }
    $rows = [];
    $rs = @$conn->query('SELECT id, metrica, lic, lc, lsc FROM san_luminometria_limites ORDER BY id ASC');
    while ($rs && ($r = $rs->fetch_assoc())) {
        $rows[] = $r;
    }

    return $rows;
}

/** @param array<string, mixed> $f */
function lum_guardar_fila(mysqli $conn, array $f, string $usuario): array
{
    $f = lum_fila_persist_normalize($f);
    $uid = trim((string) ($f['uniqueIdProveedor'] ?? ''));
    if ($uid === '') {
        $uid = md5(json_encode($f, JSON_UNESCAPED_UNICODE));
    }
    $sql = 'INSERT INTO san_luminometria_reg (
        uniqueIdProveedor, granja, granjaNombre, campania, galpon, zona, sexo,
        resultadoProveedor, valor, valorRaw, fechaHoraTest, puntoDeteccion, stdMinProveedor, stdMaxProveedor,
        deviceModel, deviceId, deviceName, note,
        inspector, estado, estado2, origen, usuario
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
        granja=VALUES(granja), granjaNombre=VALUES(granjaNombre),
        campania=VALUES(campania), galpon=VALUES(galpon), zona=VALUES(zona), sexo=VALUES(sexo),
        resultadoProveedor=VALUES(resultadoProveedor), valor=VALUES(valor), valorRaw=VALUES(valorRaw),
        fechaHoraTest=VALUES(fechaHoraTest), puntoDeteccion=VALUES(puntoDeteccion),
        stdMinProveedor=VALUES(stdMinProveedor), stdMaxProveedor=VALUES(stdMaxProveedor),
        deviceModel=VALUES(deviceModel), deviceId=VALUES(deviceId), deviceName=VALUES(deviceName), note=VALUES(note),
        inspector=VALUES(inspector), estado=VALUES(estado), estado2=VALUES(estado2),
        origen=VALUES(origen), usuario=VALUES(usuario)';
    $st = $conn->prepare($sql);
    if (!$st) {
        return ['ok' => false, 'msg' => $conn->error];
    }
    $origen = in_array((string) ($f['origen'] ?? 'upload'), ['scraping', 'upload', 'manual'], true)
        ? (string) $f['origen'] : 'upload';
    $fechaHoraTest = $f['fechaHoraTest'] ?? null;
    $valor = $f['valor'] ?? null;
    $valorRaw = (string) ($f['valorRaw'] ?? '');
    $stdMin = $f['stdMinProveedor'] ?? null;
    $stdMax = $f['stdMaxProveedor'] ?? null;
    $note = (string) ($f['note'] ?? '');
    $granja = (string) ($f['granja'] ?? '');
    $granjaNombre = (string) ($f['granjaNombre'] ?? '');
    $campania = (string) ($f['campania'] ?? '');
    $galpon = (string) ($f['galpon'] ?? '');
    $zona = (string) ($f['zona'] ?? '');
    $sexo = (string) ($f['sexo'] ?? '');
    $resultadoProveedor = (string) ($f['resultadoProveedor'] ?? '');
    $fechaHoraStr = $fechaHoraTest !== null ? (string) $fechaHoraTest : null;
    $puntoDeteccion = (string) ($f['puntoDeteccion'] ?? '');
    $devModel = (string) ($f['deviceModel'] ?? '');
    $devId = (string) ($f['deviceId'] ?? '');
    $devName = (string) ($f['deviceName'] ?? '');
    $inspectorVal = (string) ($f['inspector'] ?? '');
    $estado = (string) ($f['estado'] ?? '');
    $estado2 = (string) ($f['estado2'] ?? '');
    $st->bind_param(
        'ssssssssdsssddsssssssss',
        $uid,
        $granja,
        $granjaNombre,
        $campania,
        $galpon,
        $zona,
        $sexo,
        $resultadoProveedor,
        $valor,
        $valorRaw,
        $fechaHoraStr,
        $puntoDeteccion,
        $stdMin,
        $stdMax,
        $devModel,
        $devId,
        $devName,
        $note,
        $inspectorVal,
        $estado,
        $estado2,
        $origen,
        $usuario
    );
    $ok = $st->execute();
    $err = $st->error;
    $st->close();

    return ['ok' => $ok, 'msg' => $ok ? '' : $err, 'unique_id' => $uid];
}

/** Último error SQL registrado por las consultas de luminometría (vacío si no hubo). */
function lum_sql_error(?string $msg = null): string
{
    static $last = '';

    if ($msg !== null) {
        $last = $msg;
    }

    return $last;
}

/** Columna de fecha/hora en san_luminometria_reg (esquema actual o legacy). */
function lum_col_fecha_hora(mysqli $conn): string
{
    foreach (['fechaHoraTest', 'test_time'] as $col) {
        if (lum_columna_existe($conn, 'san_luminometria_reg', $col)) {
            return $col;
        }
    }

    return 'fechaHoraTest';
}

/** Columna del valor medido en san_luminometria_reg (esquema actual o legacy). */
function lum_col_valor(mysqli $conn): string
{
    foreach (['valor', 'test_value'] as $col) {
        if (lum_columna_existe($conn, 'san_luminometria_reg', $col)) {
            return $col;
        }
    }

    return 'valor';
}

/** Columna del punto de detección en san_luminometria_reg (esquema actual o legacy). */
function lum_col_punto(mysqli $conn): string
{
    foreach (['puntoDeteccion', 'location'] as $col) {
        if (lum_columna_existe($conn, 'san_luminometria_reg', $col)) {
            return $col;
        }
    }

    return 'puntoDeteccion';
}

/** @param mixed $v */
function lum_valor_numerico($v): bool
{
    if ($v === null || $v === '') {
        return false;
    }

    return is_numeric(str_replace(',', '.', trim((string) $v)));
}

/** Valor medido de la fila (valor o valorRaw), null si no es numérico. */
function lum_valor_num(array $row): ?float
{
    foreach (['valor', 'valorRaw'] as $k) {
        $v = $row[$k] ?? null;
        if (lum_valor_numerico($v)) {
            return (float) str_replace(',', '.', trim((string) $v));
        }
    }

    return null;
}

/**
 * Registros del periodo usando los mismos filtros del listado.
 *
 * @return list<array<string, mixed>> filas con claves del esquema actual
 */
function lum_registros_periodo(
    mysqli $conn,
    string $desde,
    string $hasta,
    string $location = '',
    bool $soloConValor = false
): array {
    [$where, $types, $bind] = lum_listar_filters($conn, [
        'fechaDesde' => $desde,
        'fechaHasta' => $hasta,
        'location' => $location,
    ]);

    $colFecha = lum_col_fecha_hora($conn);
    $sql = 'SELECT * FROM san_luminometria_reg WHERE ' . implode(' AND ', $where)
        . " ORDER BY {$colFecha} ASC, id ASC";
    $st = $conn->prepare($sql);
    if (!$st) {
        lum_sql_error('prepare: ' . $conn->error . ' | sql: ' . $sql);
        return [];
    }
    if ($types !== '') {
        $st->bind_param($types, ...$bind);
    }
    if (!$st->execute()) {
        lum_sql_error('execute: ' . $st->error . ' | sql: ' . $sql);
        $st->close();
        return [];
    }
    $rs = $st->get_result();
    $rows = [];
    while ($rs && ($r = $rs->fetch_assoc())) {
        $r = lum_row_db_normalize_keys($r);
        if ($soloConValor && lum_valor_num($r) === null) {
            continue;
        }
        $rows[] = $r;
    }
    $st->close();

    return $rows;
}

/** Rango de fechas y total de registros de la tabla (diagnóstico de periodos vacíos). */
function lum_reg_diagnostico(mysqli $conn, string $desde = '', string $hasta = '', string $location = ''): array
{
    if (!lum_tabla_ok($conn)) {
        return ['tabla' => false];
    }
    $colFecha = lum_col_fecha_hora($conn);
    $rs = @$conn->query('SELECT COUNT(*) c, MIN(' . $colFecha . ') mn, MAX(' . $colFecha . ') mx FROM san_luminometria_reg');
    $row = $rs ? $rs->fetch_assoc() : null;
    $diag = [
        'tabla' => true,
        'columnas' => [
            'fecha' => $colFecha,
            'valor' => lum_col_valor($conn),
            'granja' => lum_columna_existe($conn, 'san_luminometria_reg', 'granja') ? 'granja' : 'granja_cod',
        ],
        'total' => (int) ($row['c'] ?? 0),
        'fechaMin' => (string) ($row['mn'] ?? ''),
        'fechaMax' => (string) ($row['mx'] ?? ''),
    ];
    if ($desde !== '' && $hasta !== '') {
        $diag['periodo'] = ['desde' => $desde, 'hasta' => $hasta, 'location' => $location];
        $diag['filasPeriodo'] = count(lum_registros_periodo($conn, $desde, $hasta, $location, false));
        $diag['filasPeriodoConValor'] = count(lum_registros_periodo($conn, $desde, $hasta, $location, true));
    }

    return $diag;
}

/** @param array<string, mixed> $get */
function lum_listar_filters(mysqli $conn, array $get): array
{
    $where = ['1=1'];
    $types = '';
    $bind = [];
    $colFecha = lum_col_fecha_hora($conn);

    $granja = trim((string) ($get['granja'] ?? ''));
    if ($granja !== '') {
        $parts = array_filter(array_map('trim', explode(',', $granja)));
        if ($parts !== []) {
            $ph = implode(',', array_fill(0, count($parts), '?'));
            $where[] = "granja IN ($ph)";
            foreach ($parts as $p) {
                $types .= 's';
                $bind[] = lum_norm_granja_cod($p);
            }
        }
    }
    $sexo = strtoupper(trim((string) ($get['sexo'] ?? '')));
    if ($sexo === 'M' || $sexo === 'H') {
        $where[] = 'sexo = ?';
        $types .= 's';
        $bind[] = $sexo;
    }
    $desde = trim((string) ($get['fechaDesde'] ?? ''));
    $hasta = trim((string) ($get['fechaHasta'] ?? ''));
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) {
        $where[] = "DATE({$colFecha}) >= ?";
        $types .= 's';
        $bind[] = $desde;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
        $where[] = "DATE({$colFecha}) <= ?";
        $types .= 's';
        $bind[] = $hasta;
    }
    $location = trim((string) ($get['location'] ?? $get['punto'] ?? ''));
    if ($location !== '') {
        $where[] = lum_col_punto($conn) . ' LIKE ?';
        $types .= 's';
        $bind[] = '%' . $location . '%';
    }
    $buscar = trim((string) ($get['q'] ?? ''));
    if ($buscar !== '') {
        $where[] = '(granja LIKE ? OR granjaNombre LIKE ? OR campania LIKE ? OR galpon LIKE ? OR zona LIKE ?)';
        $types .= 'sssss';
        for ($i = 0; $i < 5; $i++) {
            $bind[] = '%' . $buscar . '%';
        }
    }

    return [$where, $types, $bind];
}

/** @param array<string, mixed> $row */
function lum_listar_enrich_row(mysqli $conn, array $row): array
{
    $row = lum_row_db_normalize_keys($row);
    $limites = lum_limites_metrica($conn);
    if (trim((string) ($row['estado'] ?? '')) === '' && $row['valor'] !== null && $row['valor'] !== '') {
        $row['estado'] = lum_calc_estado(
            (float) $row['valor'],
            $limites['lc'] !== null ? (float) $limites['lc'] : null,
            $limites['lsc'] !== null ? (float) $limites['lsc'] : null
        );
    }
    $granja = (string) ($row['granja'] ?? '');
    $fechaHora = (string) ($row['fechaHoraTest'] ?? '');
    if (trim((string) ($row['estado2'] ?? '')) === '' && $granja !== '' && !empty($row['campania']) && $fechaHora !== '') {
        $row['estado2'] = lum_calc_estado2(
            $conn,
            $granja,
            (string) $row['campania'],
            substr($fechaHora, 0, 10)
        );
    }
    $zonaIdx = lum_zona_por_granja_cod($conn, $granja);
    if ($zonaIdx !== '') {
        $row['zona'] = $zonaIdx;
    }

    return lum_row_db_to_display($conn, $row);
}

/** @param array<string, mixed> $get */
function lum_listar_query(mysqli $conn, array $get): array
{
    [$where, $types, $bind] = lum_listar_filters($conn, $get);

    $page = max(1, (int) ($get['page'] ?? 1));
    $limit = min(200, max(10, (int) ($get['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $sqlCount = 'SELECT COUNT(*) c FROM san_luminometria_reg WHERE ' . implode(' AND ', $where);
    $stC = $conn->prepare($sqlCount);
    if ($stC && $types !== '') {
        $stC->bind_param($types, ...$bind);
    }
    $total = 0;
    if ($stC) {
        $stC->execute();
        $rsC = $stC->get_result();
        if ($rsC && ($r = $rsC->fetch_assoc())) {
            $total = (int) $r['c'];
        }
        $stC->close();
    }
    $paginas = max(1, (int) ceil($total / $limit));
    if ($page > $paginas) {
        $page = $paginas;
        $offset = ($page - 1) * $limit;
    }

    $sql = 'SELECT * FROM san_luminometria_reg WHERE ' . implode(' AND ', $where)
        . ' ORDER BY fechaHoraTest DESC, granja ASC, campania ASC, galpon ASC, id DESC LIMIT ? OFFSET ?';
    $st = $conn->prepare($sql);
    if (!$st) {
        lum_sql_error('listar prepare: ' . $conn->error . ' | sql: ' . $sql);
        return ['rows' => [], 'total' => 0, 'page' => $page, 'limit' => $limit];
    }
    $typesList = $types . 'ii';
    $bindList = array_merge($bind, [$limit, $offset]);
    $st->bind_param($typesList, ...$bindList);
    $st->execute();
    $rs = $st->get_result();
    $rows = [];
    while ($rs && ($r = $rs->fetch_assoc())) {
        $rows[] = $r;
    }
    $st->close();

    return ['rows' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit];
}

/** @param array<string, mixed> $get */
function lum_listar_grupos_query(mysqli $conn, array $get): array
{
    [$where, $types, $bind] = lum_listar_filters($conn, $get);
    $whereSql = implode(' AND ', $where);

    $page = max(1, (int) ($get['page'] ?? 1));
    $limit = min(200, max(10, (int) ($get['limit'] ?? 50)));
    $offset = ($page - 1) * $limit;

    $sqlCount = 'SELECT COUNT(*) c FROM (
        SELECT 1 FROM san_luminometria_reg WHERE ' . $whereSql . '
        GROUP BY granja, campania, galpon
    ) g';
    $stC = $conn->prepare($sqlCount);
    if ($stC && $types !== '') {
        $stC->bind_param($types, ...$bind);
    }
    $total = 0;
    if ($stC) {
        $stC->execute();
        $rsC = $stC->get_result();
        if ($rsC && ($r = $rsC->fetch_assoc())) {
            $total = (int) $r['c'];
        }
        $stC->close();
    }
    $paginas = max(1, (int) ceil($total / $limit));
    if ($page > $paginas) {
        $page = $paginas;
        $offset = ($page - 1) * $limit;
    }

    $sqlGroups = 'SELECT granja, campania, galpon,
        MAX(granjaNombre) AS granjaNombre,
        MAX(zona) AS zona,
        MAX(sexo) AS sexo,
        COUNT(*) AS total_puntos,
        MAX(fechaHoraTest) AS ultimaMedicion
        FROM san_luminometria_reg WHERE ' . $whereSql . '
        GROUP BY granja, campania, galpon
        ORDER BY ultimaMedicion DESC, granja ASC, campania ASC, galpon ASC
        LIMIT ? OFFSET ?';
    $stG = $conn->prepare($sqlGroups);
    if (!$stG) {
        lum_sql_error('grupos prepare: ' . $conn->error . ' | sql: ' . $sqlGroups);
        return ['rows' => [], 'total' => $total, 'page' => $page, 'limit' => $limit];
    }
    $typesG = $types . 'ii';
    $bindG = array_merge($bind, [$limit, $offset]);
    $stG->bind_param($typesG, ...$bindG);
    $stG->execute();
    $rsG = $stG->get_result();
    $groups = [];
    while ($rsG && ($g = $rsG->fetch_assoc())) {
        $groups[] = $g;
    }
    $stG->close();

    if ($groups === []) {
        return ['rows' => [], 'total' => $total, 'page' => $page, 'limit' => $limit];
    }

    $sqlDet = 'SELECT * FROM san_luminometria_reg WHERE ' . $whereSql
        . ' AND granja = ? AND campania = ? AND galpon = ?
        ORDER BY puntoDeteccion ASC, fechaHoraTest DESC, id DESC';
    $stD = $conn->prepare($sqlDet);
    if (!$stD) {
        lum_sql_error('detalle prepare: ' . $conn->error . ' | sql: ' . $sqlDet);
        return ['rows' => [], 'total' => $total, 'page' => $page, 'limit' => $limit];
    }

    $rows = [];
    $n = $offset + 1;
    $granjasIdx = lum_granjas_index($conn);
    foreach ($groups as $g) {
        $gCod = (string) ($g['granja'] ?? '');
        $gCamp = (string) ($g['campania'] ?? '');
        $gGal = (string) ($g['galpon'] ?? '');
        $gNom = trim((string) ($g['granjaNombre'] ?? ''));
        if (($gNom === '' || $gNom === $gCod) && isset($granjasIdx[$gCod]['nombre'])) {
            $gNom = trim((string) $granjasIdx[$gCod]['nombre']);
        }
        $typesD = $types . 'sss';
        $bindD = array_merge($bind, [$gCod, $gCamp, $gGal]);
        $stD->bind_param($typesD, ...$bindD);
        $stD->execute();
        $rsD = $stD->get_result();
        $ubicaciones = [];
        while ($rsD && ($r = $rsD->fetch_assoc())) {
            $ubicaciones[] = lum_listar_enrich_row($conn, $r);
        }
        $zonaGrupo = lum_zona_por_granja_cod($conn, $gCod);
        if ($zonaGrupo === '') {
            $zonaGrupo = (string) ($g['zona'] ?? '');
        }
        $ultimaRaw = (string) ($g['ultimaMedicion'] ?? '');
        if ($gCamp === '' && $gCod !== '' && $ultimaRaw !== '') {
            $gCamp = lum_campania_en_fecha($conn, $gCod, substr($ultimaRaw, 0, 10));
        }
        $ultimaFmt = $ultimaRaw !== '' ? date('d/m/y', strtotime($ultimaRaw)) : '';
        $rows[] = [
            'num' => $n++,
            'granja' => $gCod,
            'granjaNombre' => $gNom,
            'granjaLabel' => lum_granja_label($gCod, $gNom),
            'granjaAbrev' => lum_abrev_por_granja_cod($gCod),
            'campania' => $gCamp,
            'galpon' => $gGal,
            'zona' => $zonaGrupo,
            'sexo' => (string) ($g['sexo'] ?? ''),
            'totalPuntos' => (int) ($g['total_puntos'] ?? count($ubicaciones)),
            'ultimaMedicion' => $ultimaRaw,
            'ultimaMedicionFmt' => $ultimaFmt,
            'inspector' => (string) ($ubicaciones[0]['inspector'] ?? ''),
            'lic' => $ubicaciones[0]['lic'] ?? null,
            'lc' => $ubicaciones[0]['lc'] ?? null,
            'lsc' => $ubicaciones[0]['lsc'] ?? null,
            'ubicaciones' => $ubicaciones,
        ];
    }
    $stD->close();

    return ['rows' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit];
}

/**
 * Repara filas con granja sin código, sin nombre oficial, sin zona o con el galpón dentro del nombre.
 *
 * @return array{revisadas:int,actualizadas:int,sinResolver:list<string>,cambios:list<array<string,mixed>>}
 */
function lum_reparar_granjas(mysqli $conn, bool $dryRun = true, int $limite = 0, int $offset = 0): array
{
    $sql = 'SELECT id, granja, granjaNombre, zona, campania, galpon, sexo, fechaHoraTest
            FROM san_luminometria_reg
            ORDER BY id ASC';
    if ($limite > 0) {
        $sql .= ' LIMIT ' . $limite . ' OFFSET ' . max(0, $offset);
    }
    $rs = @$conn->query($sql);
    $cambios = [];
    $sinResolver = [];
    $revisadas = 0;

    if (!$rs) {
        return ['revisadas' => 0, 'actualizadas' => 0, 'sinResolver' => [], 'cambios' => []];
    }

    $stUpd = $conn->prepare(
        'UPDATE san_luminometria_reg SET granja = ?, granjaNombre = ?, zona = ?, campania = ?, galpon = ? WHERE id = ?'
    );

    while ($row = $rs->fetch_assoc()) {
        $revisadas++;
        $id = (int) ($row['id'] ?? 0);
        $codActual = (string) ($row['granja'] ?? '');
        $nomActual = trim((string) ($row['granjaNombre'] ?? ''));
        $zonaActual = trim((string) ($row['zona'] ?? ''));
        $campActual = trim((string) ($row['campania'] ?? ''));
        $galponActual = trim((string) ($row['galpon'] ?? ''));

        $info = lum_resolver_granja_fila($conn, $codActual, $nomActual);
        $cod = (string) ($info['cod'] ?? '');
        if ($cod === '') {
            $etq = $nomActual !== '' ? $nomActual : $codActual;
            if ($etq !== '' && !in_array($etq, $sinResolver, true)) {
                $sinResolver[] = $etq;
            }
            continue;
        }

        $nombre = trim((string) ($info['nombre'] ?? ''));
        if ($nombre === '') {
            $nombre = $nomActual !== '' ? $nomActual : $cod;
        }
        $zona = trim((string) ($info['zona'] ?? ''));
        if ($zona === '') {
            $zona = $zonaActual;
        }
        $campania = $campActual;
        if ($campania === '') {
            $fecha = (string) ($row['fechaHoraTest'] ?? '');
            if ($fecha !== '') {
                $campania = lum_campania_en_fecha($conn, $cod, substr($fecha, 0, 10));
            }
        }

        $galpon = $galponActual;
        if ($galpon === '') {
            $galpon = trim((string) ($info['galpon'] ?? ''));
        }

        $sinCambio = ($codActual === $cod && $nomActual === $nombre && $zonaActual === $zona
            && $campActual === $campania && $galponActual === $galpon);
        if ($sinCambio) {
            continue;
        }

        $cambios[] = [
            'id' => $id,
            'granjaAntes' => $codActual,
            'granjaDespues' => $cod,
            'nombreAntes' => $nomActual,
            'nombreDespues' => $nombre,
            'zonaAntes' => $zonaActual,
            'zonaDespues' => $zona,
            'campaniaAntes' => $campActual,
            'campaniaDespues' => $campania,
            'galponAntes' => $galponActual,
            'galponDespues' => $galpon,
        ];

        if (!$dryRun && $stUpd) {
            $stUpd->bind_param('sssssi', $cod, $nombre, $zona, $campania, $galpon, $id);
            $stUpd->execute();
        }
    }

    $rs->free();
    if ($stUpd) {
        $stUpd->close();
    }

    return [
        'revisadas' => $revisadas,
        'actualizadas' => count($cambios),
        'sinResolver' => $sinResolver,
        'cambios' => $cambios,
    ];
}
