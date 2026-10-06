<?php
/**
 * Librería de funciones auxiliares para el módulo Temperatura / Datalogger en CoreBI.
 * Basado en crud_temperatura.php de Sanidad, adaptado a PDO / SmartPDO.
 */

require_once dirname(__DIR__, 2) . '/config/database.php';

function san_temp_conectar($db = null) {
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

function san_temp_metric_mode($cabTipo) {
    $t = strtolower(trim((string)$cabTipo));
    if ($t === 'humedad') return 'humedad';
    if ($t === 'ambos') return 'ambos';
    return 'temperatura';
}

function san_temp_metric_label($metricMode) {
    if ($metricMode === 'humedad') return 'Humedad';
    if ($metricMode === 'ambos') return 'Temperatura y humedad';
    return 'Temperatura';
}

function san_temp_tabla_existe($conn, $tabla) {
    static $cache = array();
    if (isset($cache[$tabla])) {
        return $cache[$tabla];
    }
    try {
        $stmt = $conn->prepare("SHOW TABLES LIKE ?");
        $stmt->execute([$tabla]);
        $cache[$tabla] = ($stmt->fetch() !== false);
    } catch (Exception $e) {
        $cache[$tabla] = false;
    }
    return $cache[$tabla];
}

function san_temp_cab_has_context_columns($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_cab')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'subzona'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_cab_has_nom_granja_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_cab')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'nom_granja'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_det_has_campania_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_det')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_det LIKE 'campania'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_cab_has_zona_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_cab')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'zona'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_det_has_sexo_corral_columns($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_det')) {
        $cached = false;
        return false;
    }
    try {
        $stmt1 = $conn->query("SHOW COLUMNS FROM san_temp_hum_det LIKE 'sexo'");
        $h1 = ($stmt1 && $stmt1->fetch() !== false);
        $stmt2 = $conn->query("SHOW COLUMNS FROM san_temp_hum_det LIKE 'corral'");
        $h2 = ($stmt2 && $stmt2->fetch() !== false);
        $cached = ($h1 && $h2);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_det_has_cod_galpon_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_det')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_det LIKE 'codGalpon'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_det_galpon_sql_value($raw) {
    $g = trim((string)$raw);
    return ($g === '') ? '0' : $g;
}

function san_temp_det_has_valor_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_det')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_det LIKE 'valor'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_cab_has_tipo_column($conn) {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_cab')) {
        $cached = false;
        return false;
    }
    try {
        $stmt = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'tipo'");
        $cached = ($stmt && $stmt->fetch() !== false);
    } catch (Exception $e) {
        $cached = false;
    }
    return $cached;
}

function san_temp_metric_db_value($conn, $rawTipo) {
    $t = strtolower(trim((string)$rawTipo));
    if ($t === 'humedad') return 'humedad';
    if ($t === 'ambos') return 'ambos';
    return 'temperatura';
}

function san_temp_metric_db_value_for($conn, $hasTemp, $hasHum) {
    if ($hasTemp && $hasHum) return 'ambos';
    if ($hasHum) return 'humedad';
    return 'temperatura';
}

function san_temp_normalize_metric_key($k) {
    $u = strtoupper(trim((string)$k));
    if ($u === 'H' || $u === 'HUM' || $u === 'HUMEDAD' || $u === 'HUMIDITY') return 'humedad';
    return 'temperatura';
}

function san_temp_import_metrics_requested($ctx) {
    if (!is_array($ctx)) {
        return array('temperatura' => true, 'humedad' => false);
    }
    $reqT = !empty($ctx['import_temperatura']);
    $reqH = !empty($ctx['import_humedad']);
    if (!$reqT && !$reqH) {
        $t = isset($ctx['tipo']) ? strtolower(trim((string)$ctx['tipo'])) : '';
        if ($t === 'humedad') return array('temperatura' => false, 'humedad' => true);
        if ($t === 'ambos') return array('temperatura' => true, 'humedad' => true);
        return array('temperatura' => true, 'humedad' => false);
    }
    return array('temperatura' => $reqT, 'humedad' => $reqH);
}

function san_temp_cab_fecha_cols($conn) {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = array('has_fecha_inicio' => false, 'has_fecha_fin' => false);
    if (!san_temp_tabla_existe($conn, 'san_temp_hum_cab')) {
        return $cache;
    }
    try {
        $stmt1 = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'fecha_inicio'");
        $cache['has_fecha_inicio'] = ($stmt1 && $stmt1->fetch() !== false);
        $stmt2 = $conn->query("SHOW COLUMNS FROM san_temp_hum_cab LIKE 'fecha_fin'");
        $cache['has_fecha_fin'] = ($stmt2 && $stmt2->fetch() !== false);
    } catch (Exception $e) {}
    return $cache;
}

function san_temp_cab_fecha_col_sql($conn, $alias = '') {
    $p = ($alias !== '') ? ($alias . '.') : '';
    $fc = san_temp_cab_fecha_cols($conn);
    if ($fc['has_fecha_inicio']) {
        return "COALESCE({$p}fecha_inicio, {$p}fecha_registro, {$p}fecha)";
    }
    return "COALESCE({$p}fecha_registro, {$p}fecha)";
}

function san_temp_campanias_proyeccion_por_dia($conn, $idGranja, $fMin, $fMax) {
    $out = array();
    $idGranja = trim((string)$idGranja);
    if ($idGranja === '' || !san_temp_tabla_existe($conn, 'cargapollo_proyeccion')) {
        return $out;
    }
    $dMin = substr($fMin, 0, 10);
    $dMax = substr($fMax, 0, 10);
    if ($dMin === '' || $dMax === '') {
        return $out;
    }
    $sql = "SELECT id_campania, codGalpon, DATE(fec_ingreso) AS f_ing, DATE(fec_saca) AS f_sac
            FROM cargapollo_proyeccion
            WHERE id_granja = ? AND fec_ingreso IS NOT NULL AND fec_saca IS NOT NULL
              AND DATE(fec_ingreso) <= ? AND DATE(fec_saca) >= ?
            ORDER BY id_campania ASC, codGalpon ASC";
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute([$idGranja, $dMax, $dMin]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $camp = trim((string)$row['id_campania']);
            $galp = trim((string)$row['codGalpon']);
            $fi = $row['f_ing'];
            $fs = $row['f_sac'];
            if ($camp === '' || $fi === '' || $fs === '') continue;
            $cur = $fi;
            while ($cur <= $fs) {
                if ($cur >= $dMin && $cur <= $dMax) {
                    if (!isset($out[$cur])) $out[$cur] = array();
                    if (!isset($out[$cur][$camp])) $out[$cur][$camp] = array();
                    if ($galp !== '' && !in_array($galp, $out[$cur][$camp], true)) {
                        $out[$cur][$camp][] = $galp;
                    }
                }
                $cur = date('Y-m-d', strtotime($cur . ' +1 day'));
            }
        }
    } catch (Exception $e) {}
    return $out;
}

function san_temp_resolve_campania_interna($mapDia, $fecHora, $fallbackCamp, $galponHint) {
    $fallbackCamp = trim((string)$fallbackCamp);
    $galponHint = trim((string)$galponHint);
    $dia = substr(trim((string)$fecHora), 0, 10);
    if (!isset($mapDia[$dia]) || empty($mapDia[$dia])) {
        return array('campania' => $fallbackCamp, 'metodo' => ($fallbackCamp !== '' ? 'fallback' : 'ninguno'));
    }
    $cands = $mapDia[$dia];
    if ($galponHint !== '') {
        foreach ($cands as $c => $galpones) {
            if (in_array($galponHint, $galpones, true)) {
                return array('campania' => (string)$c, 'metodo' => 'proyeccion_galpon');
            }
        }
    }
    if (count($cands) === 1) {
        $keys = array_keys($cands);
        return array('campania' => (string)$keys[0], 'metodo' => 'proyeccion_unica');
    }
    if ($fallbackCamp !== '' && isset($cands[$fallbackCamp])) {
        return array('campania' => $fallbackCamp, 'metodo' => 'proyeccion_contexto');
    }
    $keys = array_keys($cands);
    return array('campania' => (string)$keys[0], 'metodo' => 'proyeccion_primera');
}

function san_temp_norm_campania_key($c) {
    $c = trim((string)$c);
    return ($c === '') ? '_SC_' : $c;
}

function san_temp_pending_date_bounds($pendingRows) {
    $minD = null;
    $maxD = null;
    foreach ($pendingRows as $r) {
        $f = isset($r['fecha_hora']) ? trim((string)$r['fecha_hora']) : '';
        if ($f === '') continue;
        if ($minD === null || $f < $minD) $minD = $f;
        if ($maxD === null || $f > $maxD) $maxD = $f;
    }
    return array('min' => $minD, 'max' => $maxD);
}

function san_temp_ctx_usar_rango($ctx) {
    if (!is_array($ctx)) return false;
    return !empty($ctx['usar_rango_fechas']) && !empty($ctx['fecha_desde']) && !empty($ctx['fecha_hasta']);
}

function san_temp_empty_por_sexo_corral() {
    return array(
        'macho'   => array('c1' => array(), 'c2' => array(), 'otro' => array()),
        'hembra'  => array('c1' => array(), 'c2' => array(), 'otro' => array()),
        'externo' => array('c1' => array(), 'c2' => array(), 'otro' => array()),
        'otro'    => array('c1' => array(), 'c2' => array(), 'otro' => array()),
    );
}

function san_temp_ids_cab_grupo_consulta($conn, $idCabInicial) {
    $idCabInicial = (int)$idCabInicial;
    if ($idCabInicial <= 0) return array();

    $sqlMeta = "SELECT c.`codGranja`, c.`fechaDesde`, c.`fechaHasta`, c.`fechaHoraRegistro`, c.`usuarioRegistro`,
                       MAX(d.`campania`) AS campania,
                       MAX(d.`codGalpon`) AS galpon
                FROM `san_temp_hum_cab` c
                LEFT JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id`
                WHERE c.`id` = ?
                GROUP BY c.`id` LIMIT 1";
    try {
        $stmt = $conn->prepare($sqlMeta);
        $stmt->execute([$idCabInicial]);
        $meta = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$meta) return array($idCabInicial);

        $cg = trim((string)($meta['codGranja'] ?? ''));
        $fd = trim((string)($meta['fechaDesde'] ?? ''));
        $fh = trim((string)($meta['fechaHasta'] ?? ''));
        $camp = trim((string)($meta['campania'] ?? ''));
        $gp = trim((string)($meta['galpon'] ?? ''));
        $fhr = trim((string)($meta['fechaHoraRegistro'] ?? ''));

        if ($cg === '') {
            return array($idCabInicial);
        }

        $where = ["TRIM(IFNULL(c.`codGranja`,'')) = ?"];
        $bind = [$cg];

        if ($gp !== '') {
            $where[] = "TRIM(IFNULL(d.`codGalpon`,'')) = ?";
            $bind[] = $gp;
        }
        if ($camp !== '') {
            $where[] = "TRIM(IFNULL(d.`campania`,'')) = ?";
            $bind[] = $camp;
        }

        $orDates = [];
        if ($fd !== '' && $fh !== '') {
            $orDates[] = "(c.`fechaDesde` = ? AND c.`fechaHasta` = ?)";
            $bind[] = $fd;
            $bind[] = $fh;
        }
        if ($fhr !== '') {
            $orDates[] = "ABS(TIMESTAMPDIFF(SECOND, c.`fechaHoraRegistro`, ?)) <= 900";
            $bind[] = $fhr;
        }

        if (!empty($orDates)) {
            $where[] = "(" . implode(" OR ", $orDates) . ")";
        }

        $whereSql = implode(" AND ", $where);
        $sql = "SELECT DISTINCT c.`id`
                FROM `san_temp_hum_cab` c
                INNER JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id`
                WHERE {$whereSql}";

        $stmt2 = $conn->prepare($sql);
        $stmt2->execute($bind);
        $ids = $stmt2->fetchAll(PDO::FETCH_COLUMN);
        if (empty($ids)) return array($idCabInicial);
        return array_map('intval', $ids);
    } catch (Exception $e) {
        return array($idCabInicial);
    }
}

function san_temp_norm_header($h) {
    $h = trim((string)$h);
    $h = mb_strtolower($h, 'UTF-8');
    $h = str_replace(array('á','é','í','ó','ú','ñ','°'), array('a','e','i','o','u','n',''), $h);
    return preg_replace('/[^a-z0-9]/', '', $h);
}

function san_temp_parse_number($val) {
    if ($val === null || $val === '') return null;
    if (is_numeric($val)) return (float)$val;
    $v = trim((string)$val);
    $v = preg_replace('/[^\d.,\-+]/', '', $v);
    if ($v === '') return null;
    if (strpos($v, ',') !== false && strpos($v, '.') !== false) {
        $v = str_replace('.', '', $v);
        $v = str_replace(',', '.', $v);
    } elseif (strpos($v, ',') !== false) {
        $v = str_replace(',', '.', $v);
    }
    return is_numeric($v) ? (float)$v : null;
}

function san_temp_parse_datetime($val) {
    if ($val === null || $val === '') return null;
    $v = trim((string)$val);
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/', $v, $m)) {
        return "{$m[1]}-{$m[2]}-{$m[3]} {$m[4]}:{$m[5]}:{$m[6]}";
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/', $v, $m)) {
        return "{$m[1]}-{$m[2]}-{$m[3]} {$m[4]}:{$m[5]}:00";
    }
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})/', $v, $m)) {
        $d = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mo = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $h = str_pad($m[4], 2, '0', STR_PAD_LEFT);
        return "{$m[3]}-{$mo}-{$d} {$h}:{$m[5]}:{$m[6]}";
    }
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T](\d{1,2}):(\d{2})/', $v, $m)) {
        $d = str_pad($m[1], 2, '0', STR_PAD_LEFT);
        $mo = str_pad($m[2], 2, '0', STR_PAD_LEFT);
        $h = str_pad($m[4], 2, '0', STR_PAD_LEFT);
        return "{$m[3]}-{$mo}-{$d} {$h}:{$m[5]}:00";
    }
    $ts = strtotime($v);
    if ($ts && $ts > 0) {
        return date('Y-m-d H:i:s', $ts);
    }
    return null;
}

function san_temp_find_cab_duplicado_id($conn, $idGranja, $campania, $fecIni, $fecFin, $excludeId = 0) {
    $idGranja = trim((string)$idGranja);
    $campania = trim((string)$campania);
    if ($idGranja === '' || $fecIni === '' || $fecFin === '') return 0;
    $sql = "SELECT id FROM san_temp_hum_cab
            WHERE id_granja = ? AND campania = ?
              AND fecha_inicio = ? AND fecha_fin = ?
              AND id != ? LIMIT 1";
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute([$idGranja, $campania, $fecIni, $fecFin, (int)$excludeId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? (int)$row['id'] : 0;
    } catch (Exception $e) {
        return 0;
    }
}