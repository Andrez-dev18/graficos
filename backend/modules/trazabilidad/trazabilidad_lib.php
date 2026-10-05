<?php
/**
 * Helpers compartidos del módulo laboratorio/trazabilidad para CoreBI.
 *
 * Utiliza PDO (SmartPDO de CoreBI) para todas las consultas.
 */

require_once dirname(__DIR__, 2) . '/config/database.php';

/** Conexión reutilizable para CoreBI (usando Joya / Principal de Database con PDO). */
function trz_conectar($db = null)
{
    if ($db instanceof PDO) {
        if (method_exists($db, 'getConnection')) {
            $joya = $db->getConnection('joya');
            return $joya ?: $db;
        }
        return $db;
    }

    $database = new Database();
    $pdo = $database->getConnection();
    if (method_exists($pdo, 'getConnection')) {
        $joya = $pdo->getConnection('joya');
        if ($joya) {
            return $joya;
        }
    }
    return $pdo;
}

/** Acepta dd/mm/aaaa o YYYY-MM-DD y normaliza a YYYY-MM-DD. */
function trz_parse_fecha($val)
{
    if ($val === null) {
        return null;
    }
    $val = trim((string)$val);
    if (preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $val, $m)) {
        return "{$m[3]}-{$m[2]}-{$m[1]}";
    }
    if (preg_match('#^\d{4}-\d{2}-\d{2}$#', $val)) {
        return $val;
    }

    return null;
}

/**
 * Filtro de origen (TODOS / GRS / EXTERNO / TRASPATIO) + granjas/código.
 */
function trz_codref_es_externo_2026($codRef)
{
    $t = preg_replace('/\s+/', '', trim((string)$codRef)) ?? '';
    return strncmp($t, '2026', 4) === 0;
}

function trz_filtro_origen(array $params = [])
{
    $origen    = strtoupper(trim((string)($params['origen'] ?? $_POST['origen'] ?? $_GET['origen'] ?? 'GRS')));
    $codOrigen = trim((string)($params['codOrigen'] ?? $_POST['codOrigen'] ?? $_GET['codOrigen'] ?? ''));

    $sql    = '';
    $paramsSql = [];

    if ($origen === 'TODOS') {
        $sql = " AND (LEFT(TRIM(codRef), 1) = '6' OR LEFT(TRIM(codRef), 4) = '2026')";
    } elseif ($origen === 'GRS') {
        $sql = " AND LEFT(TRIM(codRef), 1) = '6'";
        $granjasRaw = $params['granja'] ?? $params['granja[]'] ?? $_POST['granja'] ?? $_POST['granja[]'] ?? $_GET['granja'] ?? [];
        if (!is_array($granjasRaw)) {
            $granjasRaw = [$granjasRaw];
        }
        $granjas = array_values(array_filter(array_map('trim', $granjasRaw), static function ($g) {
            return $g !== '' && preg_match('/^\d{3}$/', $g);
        }));
        if (!empty($granjas)) {
            $ph = implode(',', array_fill(0, count($granjas), '?'));
            $sql .= " AND LEFT(TRIM(codRef), 3) IN ($ph)";
            $paramsSql = $granjas;
        }
    } elseif ($origen === 'EXTERNO') {
        $sql = " AND LEFT(TRIM(codRef), 4) = '2026'";
        if ($codOrigen !== '') {
            $sql .= " AND TRIM(codRef) LIKE CONCAT(?, '%')";
            $paramsSql[] = $codOrigen;
        }
    } elseif ($origen === 'TRASPATIO') {
        $sql = " AND LEFT(TRIM(codRef), 1) = 'T'";
        if ($codOrigen !== '') {
            $sql .= " AND TRIM(codRef) LIKE CONCAT(?, '%')";
            $paramsSql[] = $codOrigen;
        }
    }

    return ['sql' => $sql, 'params' => $paramsSql];
}

/**
 * Filtro opcional por tipo de muestra.
 */
function trz_filtro_tipo_muestra(array $params = [])
{
    $tipoMuestra = trim((string)($params['tipoMuestra'] ?? $_POST['tipoMuestra'] ?? $_GET['tipoMuestra'] ?? ''));
    if ($tipoMuestra === '') {
        return ['sql' => '', 'params' => []];
    }

    return [
        'sql' => "
            AND analisis_codigo IN (
                SELECT ap2.analisis
                FROM san_dim_analisis_paquete ap2
                INNER JOIN san_dim_paquete p2 ON ap2.paquete = p2.codigo
                WHERE p2.tipoMuestra = ?
            )",
        'params' => [$tipoMuestra]
    ];
}

/** Filtro por codMuestra en solicitud_det (reportes tabulares). */
function trz_filtro_tipo_muestra_det(array $params = [])
{
    $tipoMuestra = trim((string)($params['tipoMuestra'] ?? $_POST['tipoMuestra'] ?? $_GET['tipoMuestra'] ?? ''));
    if ($tipoMuestra === '') {
        return ['sql' => '', 'params' => []];
    }

    return [
        'sql'    => ' AND d.codMuestra = ?',
        'params' => [$tipoMuestra]
    ];
}

/** Códigos de análisis seleccionados en el filtro (null = todos). */
function trz_analisis_seleccionados_request(array $params = [])
{
    $has = isset($params['analisis']) || isset($params['analisis[]'])
        || isset($_POST['analisis']) || isset($_POST['analisis[]'])
        || isset($_GET['analisis']) || isset($_GET['analisis[]']);
    if (!$has) {
        return null;
    }

    $raw = $params['analisis'] ?? $params['analisis[]'] ?? $_POST['analisis'] ?? $_POST['analisis[]'] ?? $_GET['analisis'] ?? $_GET['analisis[]'] ?? [];
    if (!is_array($raw)) {
        $raw = [$raw];
    }

    return array_values(array_filter(array_map(static function ($c) {
        return trim((string) $c);
    }, $raw), static function ($c) {
        return $c !== '';
    }));
}

/** Filtro SQL por códigos de análisis. */
function trz_filtro_analisis($alias = 'r', array $params = [])
{
    $codes = trz_analisis_seleccionados_request($params);
    if ($codes === null) {
        return ['sql' => '', 'params' => []];
    }
    if ($codes === []) {
        return ['sql' => ' AND 1=0', 'params' => []];
    }

    $ph = implode(',', array_fill(0, count($codes), '?'));

    return [
        'sql'    => " AND {$alias}.analisis_codigo IN ($ph)",
        'params' => $codes
    ];
}

/**
 * Conjuntos de exclusión de los paquetes de agua.
 */
function trz_exclusiones_agua(PDO $db)
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $sets = ['cod' => [], 'nom' => []];

    $sqlCod = "
        SELECT DISTINCT ap.analisis
        FROM san_dim_analisis_paquete ap
        INNER JOIN san_dim_paquete p       ON ap.paquete    = p.codigo
        INNER JOIN san_dim_tipo_muestra tm ON p.tipoMuestra = tm.codigo
        WHERE LOWER(TRIM(tm.nombre)) = 'agua'
          AND LOWER(TRIM(p.nombre))  IN ('paquete 01', 'paquete 02')
          AND ap.analisis NOT IN (
              SELECT DISTINCT ap2.analisis
              FROM san_dim_analisis_paquete ap2
              INNER JOIN san_dim_paquete p2 ON ap2.paquete = p2.codigo
              WHERE NOT (    LOWER(TRIM(p2.nombre)) IN ('paquete 01', 'paquete 02')
                         AND p2.tipoMuestra = 9 )
          )
    ";
    try {
        $stmt = $db->query($sqlCod);
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['analisis'])) {
                    $sets['cod'][] = (string)$row['analisis'];
                }
            }
        }
    } catch (Exception $e) {
        // Fallback silencioso si la tabla no existe en este contexto
    }

    $sqlNom = "
        SELECT DISTINCT a.nombre
        FROM san_dim_analisis a
        INNER JOIN san_dim_analisis_paquete ap ON a.codigo  = ap.analisis
        INNER JOIN san_dim_paquete p           ON ap.paquete = p.codigo
        INNER JOIN san_dim_tipo_muestra tm     ON p.tipoMuestra = tm.codigo
        WHERE LOWER(TRIM(tm.nombre)) = 'agua'
          AND LOWER(TRIM(p.nombre))  IN ('paquete 01', 'paquete 02')
          AND a.nombre IS NOT NULL
          AND a.nombre NOT IN (
              SELECT DISTINCT a2.nombre
              FROM san_dim_analisis a2
              INNER JOIN san_dim_analisis_paquete ap2 ON a2.codigo  = ap2.analisis
              INNER JOIN san_dim_paquete p2           ON ap2.paquete = p2.codigo
              WHERE NOT (    LOWER(TRIM(p2.nombre)) IN ('paquete 01', 'paquete 02')
                         AND p2.tipoMuestra = 9 )
          )
    ";
    try {
        $stmt = $db->query($sqlNom);
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['nombre'])) {
                    $sets['nom'][] = (string)$row['nombre'];
                }
            }
        }
    } catch (Exception $e) {
        // Fallback silencioso
    }

    $cache = $sets;
    return $cache;
}

/** Lista literal IN (...) con valores escapados para PDO. */
function trz_sql_in_list(PDO $db, array $values)
{
    $out = [];
    foreach ($values as $v) {
        $out[] = $db->quote((string)$v);
    }
    return '(' . implode(',', $out) . ')';
}

/**
 * Fragmentos WHERE de exclusión de agua.
 */
function trz_filtros_exclusion_agua(PDO $db)
{
    $excl = trz_exclusiones_agua($db);

    return [
        'cod' => !empty($excl['cod']) ? 'AND analisis_codigo NOT IN ' . trz_sql_in_list($db, $excl['cod']) : '',
        'nom' => !empty($excl['nom']) ? 'AND analisis_nombre NOT IN ' . trz_sql_in_list($db, $excl['nom']) : '',
    ];
}

/** Análisis únicos para el diálogo de filtros. */
function trz_lista_analisis_filtro(PDO $db, $fechaInicio, $fechaFin, array $params = [])
{
    $origenFiltro = trz_filtro_origen($params);
    $tipoFiltro   = trz_filtro_tipo_muestra($params);
    $exclAgua     = trz_filtros_exclusion_agua($db);

    $bindVals = array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']);

    $sql = "
        SELECT
            MIN(analisis_codigo) AS cod,
            analisis_nombre AS nom
        FROM san_fact_resultado_analisis
        WHERE fecToma BETWEEN ? AND ?
          AND fecToma IS NOT NULL
          AND analisis_nombre IS NOT NULL
          AND TRIM(analisis_nombre) != ''
          {$exclAgua['cod']}
          {$exclAgua['nom']}
          {$origenFiltro['sql']}
          {$tipoFiltro['sql']}
        GROUP BY analisis_nombre
        ORDER BY analisis_nombre ASC
    ";

    $stmt = $db->prepare($sql);
    if (!$stmt) {
        return [];
    }

    $stmt->execute($bindVals);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $items = [];
    foreach ($rows as $row) {
        $nom = trim((string)($row['nom'] ?? ''));
        if ($nom === '') {
            continue;
        }
        $items[] = [
            'cod' => (string)($row['cod'] ?? ''),
            'nom' => $nom,
        ];
    }

    $pkgMap = [];
    try {
        $stmtPkg = $db->query('
            SELECT ap.analisis,
                   MIN(p.codigo) AS paquete_codigo,
                   MIN(p.nombre) AS paquete_nombre
            FROM san_dim_analisis_paquete ap
            INNER JOIN san_dim_paquete p ON ap.paquete = p.codigo
            GROUP BY ap.analisis
        ');
        if ($stmtPkg) {
            while ($row = $stmtPkg->fetch(PDO::FETCH_ASSOC)) {
                $pkgMap[(string)$row['analisis']] = [
                    'paquete'    => (string)($row['paquete_codigo'] ?? ''),
                    'paqueteNom' => (string)($row['paquete_nombre'] ?? ''),
                ];
            }
        }
    } catch (Exception $e) {
        // Fallback
    }

    foreach ($items as &$it) {
        $pkg = $pkgMap[$it['cod']] ?? ['paquete' => '', 'paqueteNom' => ''];
        $it['paquete']    = $pkg['paquete'];
        $it['paqueteNom'] = $pkg['paqueteNom'];
    }
    unset($it);

    return $items;
}

/** Meses continuos entre el primer y último mes presente. */
function trz_meses(array $mesSet, $fechaInicio, $fechaFin)
{
    if ($mesSet) {
        ksort($mesSet);
        $keys = array_keys($mesSet);
        $cur  = new DateTime($keys[0] . '-01');
        $end  = new DateTime(end($keys) . '-01');
    } else {
        $cur = new DateTime(substr($fechaInicio, 0, 7) . '-01');
        $end = new DateTime(substr($fechaFin, 0, 7) . '-01');
    }

    $meses = [];
    while ($cur <= $end) {
        $meses[] = $cur->format('Y-m');
        $cur->modify('+1 month');
    }

    return $meses;
}

/** Etiquetas legibles de meses: ENE 2025, FEB 2025, … */
function trz_etiquetas(array $meses)
{
    $m = [
        '01' => 'ENE', '02' => 'FEB', '03' => 'MAR', '04' => 'ABR', '05' => 'MAY',
        '06' => 'JUN', '07' => 'JUL', '08' => 'AGO', '09' => 'SET', '10' => 'OCT',
        '11' => 'NOV', '12' => 'DIC'
    ];

    return array_map(static function ($mes) use ($m) {
        [$anio, $mesNum] = explode('-', $mes);
        return ($m[$mesNum] ?? $mesNum) . ' ' . $anio;
    }, $meses);
}

/** Abreviaturas de granja GRS por código de 3 dígitos. */
function trz_granja_abrev_map()
{
    return [
        '627' => 'SG',
        '621' => 'ST',
        '644' => 'REN',
        '642' => 'SL',
        '667' => 'TUC',
        '664' => 'VENT',
        '663' => 'T ESP',
        '661' => 'PON I',
        '637' => 'JM II',
        '636' => 'JM I',
        '635' => 'GDA V',
        '634' => 'GDA IV',
        '666' => 'T NOS',
        '665' => 'TNUE',
        '662' => 'PON II',
        '628' => 'GL I',
        '623' => 'GL II',
        '625' => 'GL III',
        '643' => 'VCH',
        '632' => 'GDA III',
        '630' => 'GDA I',
        '631' => 'GDA II',
    ];
}

/** Código visible en reporte tabular. */
function trz_format_codigo_display($codRef)
{
    $t = preg_replace('/\s+/', '', trim((string)$codRef)) ?? '';
    if ($t === '') {
        return '';
    }
    $first = strtoupper($t[0]);
    if ($first === '6') {
        return strlen($t) >= 6 ? substr($t, 0, 6) : $t;
    }
    if ($first === 'T' || $first === 'E') {
        return trim((string)$codRef);
    }
    if (strncmp($t, '2026', 4) === 0) {
        if (preg_match('/^(.+)-(\d{1,2})$/', $t, $m)) {
            return $m[1];
        }
        return trim((string)$codRef);
    }

    return trim((string)$codRef);
}

/** Ubicación a partir de codRef */
function trz_parse_codref_ubicacion($codRef, $codGranja = null, array $procMap = [], $obsDet = '')
{
    $t = preg_replace('/\s+/', '', trim((string)$codRef)) ?? '';
    $dash = '—';

    if ($t === '') {
        return ['granja' => $dash, 'galpon' => $dash, 'edad' => $dash];
    }

    if (strncmp($t, '2026', 4) === 0) {
        $granja = trim((string)$obsDet);
        if ($granja === '') {
            $granja = $dash;
        }
        $edad = $dash;
        if (preg_match('/-(\d{1,2})$/', $t, $m)) {
            $edadOut = ltrim($m[1], '0');
            $edad = $edadOut !== '' ? $edadOut : '0';
        }

        return ['granja' => $granja, 'galpon' => $dash, 'edad' => $edad];
    }

    $first = strtoupper($t[0]);

    if ($first === '6' && strlen($t) >= 10) {
        $map   = trz_granja_abrev_map();
        $g3    = substr($t, 0, 3);
        $gal   = substr($t, 6, 2);
        $edad  = substr($t, 8, 2);
        $galpon = ltrim($gal, '0');
        if ($galpon === '' || $gal === '00') {
            $galpon = 'Pool';
        }
        $edadOut = ltrim($edad, '0');
        if ($edadOut === '') {
            $edadOut = '0';
        }

        return [
            'granja' => $map[$g3] ?? $g3,
            'galpon' => $galpon,
            'edad'   => $edadOut,
        ];
    }

    if ($first === 'T' || $first === 'E') {
        $granja = $procMap[$t] ?? '';
        if ($granja === '' && $codGranja !== null && trim((string)$codGranja) !== '') {
            $cg = trim((string)$codGranja);
            $g3 = substr(preg_replace('/\s+/', '', $cg), 0, 3);
            $map = trz_granja_abrev_map();
            $granja = $map[$g3] ?? $cg;
        }
        if ($granja === '') {
            $granja = $dash;
        }

        return ['granja' => $granja, 'galpon' => $dash, 'edad' => $dash];
    }

    return ['granja' => $dash, 'galpon' => $dash, 'edad' => $dash];
}

/** Claves fijas del reporte de enfermedades. */
function trz_reporte_enfermedades_claves()
{
    return ['IBV', 'NDV', 'ILT', 'APV', 'REO', 'IBD'];
}

/** Columnas fijas del reporte de enfermedades. */
function trz_reporte_enfermedades_columnas()
{
    return [
        ['cod' => 'IBV', 'nom' => 'IBV', 'abrev' => 'IBV'],
        ['cod' => 'NDV', 'nom' => 'NDV', 'abrev' => 'NDV'],
        ['cod' => 'ILT', 'nom' => 'ILT', 'abrev' => 'ILT'],
        ['cod' => 'APV', 'nom' => 'APV (SCH)', 'abrev' => 'APV'],
        ['cod' => 'REO', 'nom' => 'REO', 'abrev' => 'REO'],
        ['cod' => 'IBD', 'nom' => 'IBD', 'abrev' => 'IBD'],
    ];
}

/** Mapeo de analisis_nombre a clave IBV/NDV/ILT/APV/REO/IBD. */
function trz_analisis_clave_enfermedad($nombre)
{
    $n     = strtoupper(trim((string)$nombre));
    $abrev = strtoupper(trz_abrev_analisis((string)$nombre));

    if ($n === '' && $abrev === '') {
        return null;
    }

    $reglas = [
        'IBV' => ['IBV', 'BRONQUITIS INFECCIOSA', 'INFLUENZA AV', 'INFLUENZA'],
        'NDV' => ['NDV', 'NEWCASTLE', 'ENC'],
        'ILT' => ['ILT', 'LARINGOTRAQUEITIS', 'LARYNGOTRACHEITIS'],
        'APV' => ['APV', 'SCH', 'APV (SCH)'],
        'REO' => ['REO', 'REOVIRUS'],
        'IBD' => ['IBD', 'GUMBORO'],
    ];

    foreach ($reglas as $clave => $tokens) {
        foreach ($tokens as $tok) {
            if ($abrev === $tok || strpos($abrev, $tok) !== false) {
                return $clave;
            }
        }
    }

    foreach ($reglas as $clave => $tokens) {
        foreach ($tokens as $tok) {
            if (strpos($n, $tok) !== false) {
                return $clave;
            }
        }
    }

    return null;
}

/** Abreviatura de columna de análisis. */
function trz_abrev_analisis($nombre)
{
    $n = trim((string)$nombre);
    if ($n === '') {
        return '';
    }
    if (preg_match('/\(([A-Z0-9\s\/]+)\)/', $n, $m)) {
        return trim($m[1]);
    }
    if (preg_match('/^([A-Z0-9]{2,6})\b/u', $n, $m)) {
        return $m[1];
    }
    $parts = preg_split('/\s+[-—]\s+/u', $n, 2);
    if ($parts && strlen(trim($parts[0])) <= 12) {
        return trim($parts[0]);
    }

    return mb_strlen($n) > 14 ? mb_substr($n, 0, 12) . '…' : $n;
}

/** Fecha dd/mm/yyyy → dd-mm-yy para título. */
function trz_fmt_titulo_fecha($ymd)
{
    $ts = strtotime((string)$ymd);
    if ($ts === false) {
        return (string)$ymd;
    }

    return date('d-m-y', $ts);
}

/** Título del reporte tabular según origen y rango. */
function trz_reporte_titulo($fechaInicio, $fechaFin, array $params = [])
{
    $origen = strtoupper(trim((string)($params['origen'] ?? $_POST['origen'] ?? $_GET['origen'] ?? 'GRS')));
    $desde  = trz_fmt_titulo_fecha($fechaInicio);
    $hasta  = trz_fmt_titulo_fecha($fechaFin);
    $rango  = "($desde al $hasta)";

    if ($origen === 'EXTERNO' || $origen === 'TRASPATIO') {
        return "Enfermedades del Entorno $rango";
    }
    if ($origen === 'TODOS') {
        return "Enfermedades de Granja Rinconada del Sur y el Entorno $rango";
    }

    return "Enfermedades de Granja Rinconada del Sur $rango";
}

/** Prefijo de alias en fragmentos SQL de filtros. */
function trz_sql_alias_filtros(array $filtro, $alias)
{
    if ($alias === '' || empty($filtro['sql'])) {
        return $filtro;
    }
    $replacements = [
        'codRef'          => $alias . '.codRef',
        'analisis_codigo' => $alias . '.analisis_codigo',
        'analisis_nombre' => $alias . '.analisis_nombre',
    ];
    $sql = $filtro['sql'];
    foreach ($replacements as $from => $to) {
        $sql = str_replace($from, $to, $sql);
    }

    return ['sql' => $sql, 'params' => $filtro['params']];
}

/** Mapa codRef → nombre procedencia (T/E). */
function trz_procedencia_map(PDO $db)
{
    $map = [];
    try {
        $stmt = $db->query('SELECT TRIM(codigo) AS codigo, nombre FROM san_dim_procedencia');
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $cod = preg_replace('/\s+/', '', (string)($row['codigo'] ?? ''));
                if ($cod !== '') {
                    $map[$cod] = trim((string)($row['nombre'] ?? ''));
                }
            }
        }
    } catch (Exception $e) {
        // Fallback
    }

    return $map;
}

/** Filtra columnas del reporte según análisis seleccionados. */
function trz_filtrar_columnas_reporte(array $columnas, $selected, $soloEnfermedades, array $analNomMap = [])
{
    if ($selected === null) {
        return $columnas;
    }
    if ($selected === []) {
        return [];
    }

    $selSet = array_flip($selected);

    if ($soloEnfermedades) {
        $clavesPerm = [];
        foreach ($selected as $cod) {
            $nom = $analNomMap[$cod] ?? $cod;
            $clave = trz_analisis_clave_enfermedad($nom);
            if ($clave !== null) {
                $clavesPerm[$clave] = true;
            }
        }

        return array_values(array_filter($columnas, static function ($col) use ($clavesPerm) {
            return isset($clavesPerm[(string) ($col['cod'] ?? '')]);
        }));
    }

    return array_values(array_filter($columnas, static function ($col) use ($selSet) {
        return isset($selSet[(string) ($col['cod'] ?? '')]);
    }));
}

/**
 * Datos pivote del reporte tabular de resultados.
 */
function trz_reporte_resultados_data(PDO $db, $fechaInicio, $fechaFin, $soloEnfermedades = false, array $params = [])
{
    $origenFiltro  = trz_sql_alias_filtros(trz_filtro_origen($params), 'r');
    $tipoDetFiltro = trz_filtro_tipo_muestra_det($params);
    $analisisFiltro = trz_filtro_analisis('r', $params);
    $exclAgua      = trz_filtros_exclusion_agua($db);
    $exclCod       = str_replace('analisis_codigo', 'r.analisis_codigo', $exclAgua['cod']);
    $exclNom       = str_replace('analisis_nombre', 'r.analisis_nombre', $exclAgua['nom']);

    $bindVals = array_merge(
        [$fechaInicio, $fechaFin],
        $origenFiltro['params'],
        $tipoDetFiltro['params'],
        $analisisFiltro['params']
    );

    $sql = "
        SELECT
            r.codEnvio,
            r.posSolicitud,
            TRIM(r.codRef) AS codRef,
            r.fecToma,
            d.nomMuestra,
            d.codGranja,
            (
                SELECT TRIM(d2.obs)
                FROM san_fact_solicitud_det d2
                WHERE d2.codEnvio = r.codEnvio
                  AND d2.posSolicitud = r.posSolicitud
                  AND TRIM(IFNULL(d2.obs, '')) <> ''
                ORDER BY d2.id ASC
                LIMIT 1
            ) AS obsDet,
            r.analisis_codigo,
            r.analisis_nombre,
            r.resultado,
            r.obs,
            r.fechaHoraRegistro AS fechaIngreso
        FROM san_fact_resultado_analisis r
        INNER JOIN san_fact_solicitud_det d
            ON d.codEnvio = r.codEnvio
           AND d.posSolicitud = r.posSolicitud
           AND d.codAnalisis = r.analisis_codigo
        WHERE r.fecToma BETWEEN ? AND ?
          AND r.fecToma IS NOT NULL
          AND r.analisis_nombre IS NOT NULL
          AND TRIM(r.analisis_nombre) != ''
          {$exclCod}
          {$exclNom}
          {$origenFiltro['sql']}
          {$tipoDetFiltro['sql']}
          {$analisisFiltro['sql']}
        ORDER BY r.fecToma ASC, r.codRef ASC, r.analisis_nombre ASC
    ";

    $stmt = $db->prepare($sql);
    if (!$stmt) {
        return [
            'titulo'   => trz_reporte_titulo($fechaInicio, $fechaFin, $params),
            'columnas' => [],
            'filas'    => [],
            'error'    => 'Error preparando consulta',
        ];
    }

    $stmt->execute($bindVals);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $procMap    = trz_procedencia_map($db);
    $analSet    = [];
    $analNomMap = [];
    $muestras   = [];
    $fechaIngRaw = [];

    foreach ($rows as $row) {
        $codAnal = (string) ($row['analisis_codigo'] ?? '');
        $nomAnal = trim((string) ($row['analisis_nombre'] ?? ''));
        if ($nomAnal === '') {
            continue;
        }

        $claveEnf = $soloEnfermedades ? trz_analisis_clave_enfermedad($nomAnal) : null;
        if ($soloEnfermedades && $claveEnf === null) {
            continue;
        }

        $resKey = $soloEnfermedades ? $claveEnf : $codAnal;
        if ($codAnal !== '' && !isset($analNomMap[$codAnal])) {
            $analNomMap[$codAnal] = $nomAnal;
        }
        if (!$soloEnfermedades && !isset($analSet[$codAnal])) {
            $analSet[$codAnal] = $nomAnal;
        }

        $key = ($row['codEnvio'] ?? '') . '|' . ($row['posSolicitud'] ?? '');
        $codRef = trim((string) ($row['codRef'] ?? ''));
        $obsDet = trim((string) ($row['obsDet'] ?? ''));
        if (!isset($muestras[$key])) {
            $ubic = trz_parse_codref_ubicacion($codRef, $row['codGranja'] ?? null, $procMap, $obsDet);
            $fec  = $row['fecToma'] ?? '';
            $muestras[$key] = [
                'fechaPedido'  => $fec !== '' ? date('d/m/Y', strtotime((string) $fec)) : '',
                'fechaIngreso' => '',
                'codigo'       => trz_format_codigo_display($codRef),
                'codEnvio'     => trim((string) ($row['codEnvio'] ?? '')),
                'posSolicitud' => trim((string) ($row['posSolicitud'] ?? '')),
                'muestra'      => trim((string) ($row['nomMuestra'] ?? '')),
                'granja'       => $ubic['granja'],
                'galpon'       => $ubic['galpon'],
                'edad'         => $ubic['edad'],
                'resultados'   => [],
                'nota'         => null,
            ];
        } elseif (trz_codref_es_externo_2026($codRef) && $obsDet !== '' && ($muestras[$key]['granja'] === '—' || $muestras[$key]['granja'] === '')) {
            $muestras[$key]['granja'] = $obsDet;
        }

        $fechaIng = trim((string) ($row['fechaIngreso'] ?? ''));
        if ($fechaIng !== '' && $fechaIng > ($fechaIngRaw[$key] ?? '')) {
            $fechaIngRaw[$key] = $fechaIng;
            $muestras[$key]['fechaIngreso'] = date('d/m/Y', strtotime($fechaIng));
        }

        $resTxt = trim((string) ($row['resultado'] ?? ''));
        if ($resTxt !== '') {
            $muestras[$key]['resultados'][$resKey] = $resTxt;
        }

        $obs = strtoupper(trim((string) ($row['obs'] ?? '')));
        $resUp = strtoupper($resTxt);
        if (
            strpos($resUp, 'SOSPECHA') !== false
            || strpos($obs, 'SOSPECHA') !== false
            || strpos($resUp, 'POR CONFIRMAR') !== false
        ) {
            $muestras[$key]['nota'] = 'Sospecha (por confirmar en laboratorio)';
        }
    }

    if ($soloEnfermedades) {
        $columnas = trz_reporte_enfermedades_columnas();
    } else {
        $columnas = [];
        foreach ($analSet as $cod => $nom) {
            $columnas[] = [
                'cod'   => (string) $cod,
                'nom'   => $nom,
                'abrev' => trz_abrev_analisis($nom),
            ];
        }
        usort($columnas, static function ($a, $b) {
            return strcasecmp($a['nom'], $b['nom']);
        });
    }

    $columnas = trz_filtrar_columnas_reporte(
        $columnas,
        trz_analisis_seleccionados_request($params),
        $soloEnfermedades,
        $analNomMap
    );

    $filas = [];
    $n = 1;
    foreach ($muestras as $m) {
        $filas[] = array_merge(['n' => $n], $m);
        $n++;
    }

    return [
        'titulo'   => trz_reporte_titulo($fechaInicio, $fechaFin, $params),
        'columnas' => $columnas,
        'filas'    => $filas,
    ];
}
