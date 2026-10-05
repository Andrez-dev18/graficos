<?php
declare(strict_types=1);

/**
 * Fechas de campaña (HC cab + movi E001/S700) y edad de crianza (cargaproduccion00).
 */

require_once dirname(__DIR__) . '/sip_estandares_tree_repository.php';

if (!function_exists('hc_campania_fe_norm_granja')) {
    function hc_campania_fe_norm_granja(string $granja): string
    {
        if (function_exists('sip_hc_cab_normalizar_granja')) {
            return sip_hc_cab_normalizar_granja($granja);
        }

        return substr(str_pad(trim($granja), 3, '0', STR_PAD_LEFT), 0, 3);
    }
}

if (!function_exists('hc_campania_fe_norm_campania')) {
    function hc_campania_fe_norm_campania(string $campania): string
    {
        if (function_exists('sip_hc_cab_normalizar_campania')) {
            return sip_hc_cab_normalizar_campania($campania);
        }

        return substr(str_pad(trim($campania), 3, '0', STR_PAD_LEFT), -3);
    }
}

if (!function_exists('hc_campania_fe_norm_fecha')) {
    function hc_campania_fe_norm_fecha(?string $raw): ?string
    {
        if (function_exists('sip_hc_cab_normalizar_fecha_ymd')) {
            return sip_hc_cab_normalizar_fecha_ymd($raw);
        }
        $s = trim((string) $raw);
        if ($s === '' || $s === '0000-00-00') {
            return null;
        }

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $s) ? $s : null;
    }
}

if (!function_exists('hc_campania_fe_key_granja')) {
    function hc_campania_fe_key_granja(string $g3): string
    {
        if (function_exists('sip_hc_cab_key_granja')) {
            return sip_hc_cab_key_granja($g3);
        }

        return hc_campania_fe_norm_granja($g3);
    }
}

if (!function_exists('hc_campania_fe_camp_display')) {
    function hc_campania_fe_camp_display(string $camp): string
    {
        if (function_exists('hc_campania_norm_display')) {
            return hc_campania_norm_display($camp);
        }

        return hc_campania_fe_norm_campania($camp);
    }
}

if (!function_exists('hc_campania_fe_merge')) {
    /**
     * @param array<string, array<string, array{granja:string,campania:string,fecha_inicio:?string,fecha_fin:?string,galpones:list<string>}>> $out
     */
    function hc_campania_fe_merge(
        array &$out,
        string $g,
        string $c,
        ?string $fi,
        ?string $ff,
        string $galpon
    ): void {
        if ($g === '' || $c === '' || $c === '000') {
            return;
        }
        $gk = hc_campania_fe_key_granja($g);
        if (!isset($out[$gk])) {
            $out[$gk] = [];
        }
        if (!isset($out[$gk][$c])) {
            $out[$gk][$c] = [
                'granja' => $g,
                'campania' => $c,
                'fecha_inicio' => $fi,
                'fecha_fin' => $ff,
                'galpones' => [],
            ];
        } else {
            if ($fi !== null) {
                if ($out[$gk][$c]['fecha_inicio'] === null || $fi < $out[$gk][$c]['fecha_inicio']) {
                    $out[$gk][$c]['fecha_inicio'] = $fi;
                }
            }
            if ($ff !== null) {
                if ($out[$gk][$c]['fecha_fin'] === null || $ff > $out[$gk][$c]['fecha_fin']) {
                    $out[$gk][$c]['fecha_fin'] = $ff;
                }
            }
        }
        $gal = trim($galpon);
        if ($gal !== '' && $gal !== '0' && !in_array($gal, $out[$gk][$c]['galpones'], true)) {
            $out[$gk][$c]['galpones'][] = $gal;
        }
    }
}

if (!function_exists('hc_campania_fe_cargar_hc_cab')) {
    /**
     * @param list<string> $granjas3 vacío = granjas 6xx en cab
     * @param array<string, array<string, array<string, mixed>>> $out
     */
    function hc_campania_fe_cargar_hc_cab(mysqli $conn, array $granjas3, array &$out): void
    {
        if (!sip_est2_repo_table_exists($conn, 'san_fact_historia_clinica_cab')) {
            return;
        }
        $tieneFechas = function_exists('sip_hc_cab_tiene_columnas_fecha')
            ? sip_hc_cab_tiene_columnas_fecha($conn)
            : (sip_est2_repo_col_exists($conn, 'san_fact_historia_clinica_cab', 'fecha_inicio')
                && sip_est2_repo_col_exists($conn, 'san_fact_historia_clinica_cab', 'fecha_fin'));

        $cols = 'TRIM(`granja`) AS granja, TRIM(`campania`) AS campania, TRIM(CAST(`galpon` AS CHAR)) AS galpon';
        if ($tieneFechas) {
            $cols .= ', `fecha_inicio`, `fecha_fin`';
        }
        $sql = 'SELECT ' . $cols . ' FROM `san_fact_historia_clinica_cab`'
            . ' WHERE TRIM(`granja`) <> \'\' AND TRIM(`campania`) <> \'\''
            . ' AND TRIM(`campania`) <> \'000\''
            . ' AND LEFT(LPAD(TRIM(`granja`), 3, \'0\'), 3) NOT IN (\'619\',\'624\',\'650\')';
        $bind = [];
        $types = '';
        if ($granjas3 !== []) {
            $ph = implode(',', array_fill(0, count($granjas3), '?'));
            $sql .= ' AND LPAD(TRIM(`granja`), 3, \'0\') IN (' . $ph . ')';
            $types = str_repeat('s', count($granjas3));
            $bind = array_values($granjas3);
        } else {
            $sql .= ' AND LEFT(LPAD(TRIM(`granja`), 3, \'0\'), 1) = \'6\'';
        }
        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        if ($bind !== []) {
            $params = array_merge([$types], $bind);
            $refs = [];
            foreach ($params as $i => $_) {
                $refs[$i] = &$params[$i];
            }
            call_user_func_array([$st, 'bind_param'], $refs);
        }
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $g = hc_campania_fe_norm_granja((string) ($row['granja'] ?? ''));
            $c = hc_campania_fe_norm_campania((string) ($row['campania'] ?? ''));
            $fi = $tieneFechas ? hc_campania_fe_norm_fecha($row['fecha_inicio'] ?? null) : null;
            $ff = $tieneFechas ? hc_campania_fe_norm_fecha($row['fecha_fin'] ?? null) : null;
            hc_campania_fe_merge($out, $g, $c, $fi, $ff, (string) ($row['galpon'] ?? ''));
        }
        $st->close();
    }
}

if (!function_exists('hc_campania_fe_cargar_movi_fallback')) {
    /**
     * E001 entrada / S700 salida — solo campañas sin fecha_inicio en HC cab.
     *
     * @param list<string> $granjas3
     * @param array<string, array<string, array<string, mixed>>> $out
     */
    function hc_campania_fe_cargar_movi_fallback(mysqli $conn, array $granjas3, array &$out): void
    {
        if (!sip_est2_repo_table_exists($conn, 'movi_zonas')) {
            return;
        }
        $sql = 'SELECT LEFT(TRIM(`tcencos`), 3) AS granja, RIGHT(TRIM(`tcencos`), 3) AS campania,'
            . ' TRIM(`tcodint`) AS galpon,'
            . ' MAX(IF(`tcodtra`=\'E001\' AND `tline`=\'001\', DATE(`tfectra`), NULL)) AS fecha_inicio,'
            . ' MAX(IF(`tcodtra`=\'S700\' AND `tline`=\'001\' AND `tliquidar`=\'S\', DATE(`tfectra`), NULL)) AS fecha_fin'
            . ' FROM `movi_zonas`'
            . ' WHERE LENGTH(TRIM(`tcencos`)) = 6'
            . ' AND LEFT(TRIM(`tcencos`), 1) = \'6\''
            . ' AND RIGHT(TRIM(`tcencos`), 3) <> \'000\''
            . ' AND LEFT(TRIM(`tcencos`), 3) NOT IN (\'619\',\'624\',\'650\')'
            . ' AND `tcodtra` IN (\'E001\', \'S700\')'
            . ' AND YEAR(`tfectra`) >= YEAR(CURDATE()) - 1'
            . ' AND YEAR(`tfectra`) <= YEAR(CURDATE())';
        $bind = [];
        $types = '';
        if ($granjas3 !== []) {
            $ph = implode(',', array_fill(0, count($granjas3), '?'));
            $sql .= ' AND LEFT(TRIM(`tcencos`), 3) IN (' . $ph . ')';
            $types = str_repeat('s', count($granjas3));
            $bind = array_values($granjas3);
        }
        $sql .= ' GROUP BY LEFT(TRIM(`tcencos`), 3), RIGHT(TRIM(`tcencos`), 3), TRIM(`tcodint`)';
        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        if ($bind !== []) {
            $params = array_merge([$types], $bind);
            $refs = [];
            foreach ($params as $i => $_) {
                $refs[$i] = &$params[$i];
            }
            call_user_func_array([$st, 'bind_param'], $refs);
        }
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $g = hc_campania_fe_norm_granja((string) ($row['granja'] ?? ''));
            $c = hc_campania_fe_norm_campania((string) ($row['campania'] ?? ''));
            $gk = hc_campania_fe_key_granja($g);
            $fi = hc_campania_fe_norm_fecha($row['fecha_inicio'] ?? null);
            if ($fi === null) {
                continue;
            }
            if (isset($out[$gk][$c]['fecha_inicio'])
                && $out[$gk][$c]['fecha_inicio'] !== null
                && $out[$gk][$c]['fecha_inicio'] !== '') {
                continue;
            }
            $ff = hc_campania_fe_norm_fecha($row['fecha_fin'] ?? null);
            hc_campania_fe_merge($out, $g, $c, $fi, $ff, (string) ($row['galpon'] ?? ''));
        }
        $st->close();
    }
}

if (!function_exists('hc_campania_fetch_grupos')) {
    /**
     * @param list<string> $granjas3
     * @return array<string, array<string, array{granja:string,campania:string,fecha_inicio:?string,fecha_fin:?string,galpones:list<string>}>>
     */
    function hc_campania_fetch_grupos(mysqli $conn, array $granjas3 = []): array
    {
        $keys = [];
        foreach ($granjas3 as $g) {
            $g3 = hc_campania_fe_norm_granja((string) $g);
            if ($g3 !== '') {
                $keys[] = $g3;
            }
        }
        $keys = array_values(array_unique($keys));

        $out = [];
        hc_campania_fe_cargar_hc_cab($conn, $keys, $out);
        hc_campania_fe_cargar_movi_fallback($conn, $keys, $out);

        return $out;
    }
}

if (!function_exists('hc_campania_fechas_map')) {
    /**
     * @param list<string> $granjas3
     * @return array<string, array{fecha_inicio:string,fecha_fin:string}>
     */
    function hc_campania_fechas_map(mysqli $conn, array $granjas3): array
    {
        $fechasPorCamp = [];
        $grupos = hc_campania_fetch_grupos($conn, $granjas3);
        foreach ($grupos as $gk => $camps) {
            $g3 = function_exists('sip_hc_cab_key_granja_parse')
                ? sip_hc_cab_key_granja_parse((string) $gk)
                : hc_campania_fe_norm_granja((string) $gk);
            foreach ($camps as $item) {
                $camp3 = hc_campania_fe_camp_display((string) ($item['campania'] ?? ''));
                if ($camp3 === '' || $camp3 === '000') {
                    continue;
                }
                $fi = hc_campania_fe_norm_fecha($item['fecha_inicio'] ?? null);
                if ($fi === null) {
                    continue;
                }
                $ff = hc_campania_fe_norm_fecha($item['fecha_fin'] ?? null) ?? '';
                $k = $g3 . '|' . $camp3;
                if (!isset($fechasPorCamp[$k])) {
                    $fechasPorCamp[$k] = ['fecha_inicio' => $fi, 'fecha_fin' => $ff];
                } else {
                    if ($fi < $fechasPorCamp[$k]['fecha_inicio']) {
                        $fechasPorCamp[$k]['fecha_inicio'] = $fi;
                    }
                    $prevFf = $fechasPorCamp[$k]['fecha_fin'];
                    if ($ff !== '' && ($prevFf === '' || $ff > $prevFf)) {
                        $fechasPorCamp[$k]['fecha_fin'] = $ff;
                    }
                }
            }
        }

        return $fechasPorCamp;
    }
}

if (!function_exists('hc_campania_edad_desde_cargaproduccion')) {
    function hc_campania_edad_desde_cargaproduccion(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon,
        string $fechaYmd
    ): ?int {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaYmd)
            || !sip_est2_repo_table_exists($conn, 'cargaproduccion00')) {
            return null;
        }
        $g = hc_campania_fe_norm_granja($granja3);
        $c = hc_campania_fe_norm_campania($camp3);
        $gp = trim($galpon);
        if ($g === '' || $c === '' || $gp === '') {
            return null;
        }
        $cod6 = $g . $c;
        if (!sip_est2_repo_col_exists($conn, 'cargaproduccion00', 'edad')) {
            return null;
        }
        $sql = 'SELECT `edad` FROM `cargaproduccion00`'
            . ' WHERE TRIM(`tcencos`) = ? AND TRIM(`tcodint`) = ? AND DATE(`fecha`) = ?'
            . ' AND TRIM(`tcodigo`) = \'P0001001\''
            . ' LIMIT 1';
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $st->bind_param('sss', $cod6, $gp, $fechaYmd);
        $st->execute();
        $rs = $st->get_result();
        $row = $rs ? $rs->fetch_assoc() : null;
        $st->close();
        if (!is_array($row)) {
            return null;
        }
        $edad = (int) ($row['edad'] ?? 0);

        return $edad > 0 ? $edad : null;
    }
}

if (!function_exists('hc_campania_edad_por_fecha')) {
    /**
     * @param list<string> $galpones
     */
    function hc_campania_edad_por_fecha(
        mysqli $conn,
        string $granja3,
        string $camp3,
        array $galpones,
        string $fechaYmd
    ): ?int {
        $edades = [];
        foreach ($galpones as $gp) {
            $gp = trim((string) $gp);
            if ($gp === '') {
                continue;
            }
            $e = hc_campania_edad_desde_cargaproduccion($conn, $granja3, $camp3, $gp, $fechaYmd);
            if ($e !== null && $e > 0) {
                $edades[] = $e;
            }
        }
        if ($edades === []) {
            return null;
        }

        return (int) round(array_sum($edades) / count($edades));
    }
}
