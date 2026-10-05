<?php
declare(strict_types=1);

/**
 * Catálogo granjas / campañas / CENCOS desde ccos (fecini/fecfin operativos).
 */

require_once dirname(__DIR__) . '/hc/hc_granjas_repository.php';

if (!function_exists('ccos_norm_fecha')) {
    function ccos_norm_fecha(?string $raw): ?string
    {
        $s = trim((string) $raw);
        if ($s === '' || $s === '0000-00-00' || strpos($s, '1000-01-01') === 0) {
            return null;
        }
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $s, $m)) {
            return $m[1];
        }

        return null;
    }
}

if (!function_exists('ccos_norm_granja')) {
    function ccos_norm_granja(string $granja): string
    {
        $g = trim($granja);
        if ($g === '') {
            return '';
        }
        if (strlen($g) >= 6) {
            return substr($g, 0, 3);
        }

        return substr(str_pad($g, 3, '0', STR_PAD_LEFT), 0, 3);
    }
}

if (!function_exists('ccos_norm_campania')) {
    function ccos_norm_campania(string $campania): string
    {
        $c = trim($campania);
        if ($c === '') {
            return '';
        }

        return substr(str_pad($c, 3, '0', STR_PAD_LEFT), -3);
    }
}

if (!function_exists('ccos_tabla_existe')) {
    function ccos_tabla_existe(mysqli $conn): bool
    {
        $q = @$conn->query("SHOW TABLES LIKE 'ccos'");

        return ($q && $q->num_rows > 0);
    }
}

if (!function_exists('ccos_campania_activa_en_fecha')) {
    function ccos_campania_activa_en_fecha(?string $fecini, ?string $fecfin, string $refYmd): bool
    {
        $fi = ccos_norm_fecha($fecini);
        if ($fi === null || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $refYmd)) {
            return false;
        }
        if ($fi > $refYmd) {
            return false;
        }
        $ff = ccos_norm_fecha($fecfin);
        if ($ff === null) {
            return true;
        }

        return $ff >= $refYmd;
    }
}

if (!function_exists('ccos_intervalo_solapa_rango')) {
    /** @param array{desde:string,hasta:string}|null $rango */
    function ccos_intervalo_solapa_rango(?string $fecini, ?string $fecfin, ?array $rango): bool
    {
        if ($rango === null) {
            return true;
        }
        $desde = trim((string) ($rango['desde'] ?? ''));
        $hasta = trim((string) ($rango['hasta'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
            return true;
        }
        $fi = ccos_norm_fecha($fecini);
        $ff = ccos_norm_fecha($fecfin);
        if ($fi === null) {
            return false;
        }
        if ($ff !== null && $ff < $desde) {
            return false;
        }

        return $fi <= $hasta;
    }
}

if (!function_exists('ccos_fetch_campanias')) {
    /**
     * Todas las campañas 6 dígitos en ccos (sin filtrar swac).
     *
     * @param list<string> $granjas3 vacío = todas las granjas 5/6
     * @return array{cencos:list<array<string,mixed>>,galpones_por_granja:array<string,list<string>>}
     */
    function ccos_fetch_campanias(mysqli $conn, array $granjas3 = [], ?array $rango = null): array
    {
        if (!ccos_tabla_existe($conn)) {
            return ['cencos' => [], 'galpones_por_granja' => []];
        }

        $filtroGranjasSql = '';
        $bind = [];
        $types = '';
        if ($granjas3 !== []) {
            $norm = [];
            foreach ($granjas3 as $g) {
                $g3 = ccos_norm_granja((string) $g);
                if ($g3 !== '') {
                    $norm[$g3] = true;
                }
            }
            $keys = array_keys($norm);
            if ($keys === []) {
                return ['cencos' => [], 'galpones_por_granja' => []];
            }
            sort($keys);
            $filtroGranjasSql = ' AND LEFT(TRIM(c.codigo), 3) IN (' . implode(',', array_fill(0, count($keys), '?')) . ')';
            $types = str_repeat('s', count($keys));
            $bind = $keys;
        }

        $sql = "
            SELECT
                TRIM(c.codigo) AS codigo,
                MAX(TRIM(c.nombre)) AS nombre,
                MAX(TRIM(c.swac)) AS swac,
                MAX(c.fecini) AS fecini,
                MAX(c.fecfin) AS fecfin,
                g.tcodint
            FROM ccos AS c
            INNER JOIN regcencosgalpones AS g ON LEFT(TRIM(c.codigo), 3) = g.tcencos
            WHERE LEFT(TRIM(c.codigo), 1) IN ('6', '5')
              AND RIGHT(TRIM(c.codigo), 3) <> '000'
              AND CHAR_LENGTH(TRIM(c.codigo)) = 6
              AND LEFT(TRIM(c.codigo), 3) NOT IN ('619', '624', '650', '668', '669', '680')
              {$filtroGranjasSql}
            GROUP BY TRIM(c.codigo), g.tcodint
            ORDER BY TRIM(c.codigo) ASC, g.tcodint ASC
        ";

        $st = $conn->prepare($sql);
        if (!$st) {
            return ['cencos' => [], 'galpones_por_granja' => []];
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

        $cencosMap = [];
        $galponesPorGranja = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $codigo = trim((string) ($row['codigo'] ?? ''));
            if (strlen($codigo) < 6) {
                continue;
            }
            $g3 = substr($codigo, 0, 3);
            $camp3 = ccos_norm_campania(substr($codigo, -3));
            $fi = ccos_norm_fecha($row['fecini'] ?? null);
            $ff = ccos_norm_fecha($row['fecfin'] ?? null);
            if (!ccos_intervalo_solapa_rango($fi, $ff, $rango)) {
                continue;
            }
            if (!isset($cencosMap[$codigo])) {
                $swac = strtoupper(trim((string) ($row['swac'] ?? '')));
                $cencosMap[$codigo] = [
                    'codigo' => $codigo,
                    'nombre' => trim((string) ($row['nombre'] ?? '')),
                    'swac' => $swac,
                    'fecini' => $fi,
                    'fecfin' => $ff,
                    'fecha_inicio' => $fi,
                    'fecha_fin' => $ff,
                    'campania' => $camp3,
                    'granja' => $g3,
                    'ccos_activo' => ($swac === 'A'),
                    'galpones' => [],
                ];
            }
            $gp = trim((string) ($row['tcodint'] ?? ''));
            if ($gp !== '') {
                $cencosMap[$codigo]['galpones'][] = ['tcodint' => $gp];
                if (!isset($galponesPorGranja[$g3])) {
                    $galponesPorGranja[$g3] = [];
                }
                if (!in_array($gp, $galponesPorGranja[$g3], true)) {
                    $galponesPorGranja[$g3][] = $gp;
                }
            }
        }
        $st->close();

        foreach ($galponesPorGranja as $g3 => $gps) {
            sort($galponesPorGranja[$g3], SORT_NATURAL);
        }

        $cencos = array_values($cencosMap);
        usort($cencos, static function (array $a, array $b): int {
            return strcmp((string) ($a['codigo'] ?? ''), (string) ($b['codigo'] ?? ''));
        });

        return [
            'cencos' => $cencos,
            'galpones_por_granja' => $galponesPorGranja,
        ];
    }
}

if (!function_exists('ccos_shape_proyeccion')) {
    /**
     * @param list<array<string,mixed>> $cencos
     * @param list<array<string,mixed>> $granjasMeta
     */
    function ccos_shape_proyeccion(array $cencos, array $granjasMeta = []): array
    {
        $campanias = [];
        $granjas = [];
        $granjasSeen = [];
        $metaByG = [];
        foreach ($granjasMeta as $g) {
            if (!is_array($g)) {
                continue;
            }
            $g3 = ccos_norm_granja((string) ($g['granja'] ?? ''));
            if ($g3 !== '') {
                $metaByG[$g3] = $g;
            }
        }

        foreach ($cencos as $c) {
            if (!is_array($c)) {
                continue;
            }
            $cod6 = trim((string) ($c['codigo'] ?? ''));
            if (strlen($cod6) < 6) {
                continue;
            }
            $g3 = substr($cod6, 0, 3);
            $camp = ccos_norm_campania(substr($cod6, -3));
            $nom = trim((string) ($c['nombre'] ?? ''));
            $fi = ccos_norm_fecha($c['fecini'] ?? $c['fecha_inicio'] ?? null);
            $ff = ccos_norm_fecha($c['fecfin'] ?? $c['fecha_fin'] ?? null);

            if (!isset($campanias[$g3])) {
                $campanias[$g3] = [];
            }
            $entry = [
                'campania' => $camp,
                'codigo' => $cod6,
                'granja' => $g3,
                'swac' => trim((string) ($c['swac'] ?? '')),
                'ccos_activo' => !empty($c['ccos_activo']),
            ];
            if ($fi !== null) {
                $entry['fecha_inicio'] = $fi;
            }
            if ($ff !== null) {
                $entry['fecha_fin'] = $ff;
            }
            $campanias[$g3][] = $entry;

            if (!isset($granjasSeen[$g3])) {
                $granjasSeen[$g3] = true;
                $meta = $metaByG[$g3] ?? [];
                $granjas[] = [
                    'granja' => $g3,
                    'nombre' => trim((string) ($meta['nombre'] ?? $meta['nombre_granja'] ?? $nom)),
                    'nombre_granja' => trim((string) ($meta['nombre_granja'] ?? $meta['nombre'] ?? $nom)),
                    'zona' => trim((string) ($meta['zona'] ?? '')),
                    'subzona' => trim((string) ($meta['subzona'] ?? '')),
                ];
            }
        }

        foreach ($campanias as $g3 => &$rows) {
            usort($rows, static function (array $a, array $b): int {
                return strcmp((string) ($a['campania'] ?? ''), (string) ($b['campania'] ?? ''));
            });
        }
        unset($rows);

        return [
            'cencos' => array_values($cencos),
            'granjas' => $granjas,
            'campanias_por_granja' => $campanias,
        ];
    }
}

if (!function_exists('ccos_campanias_activas_en_fecha')) {
    /**
     * @param array<string, list<array<string,mixed>>> $campaniasPorGranja
     * @return array<string, list<string>>
     */
    function ccos_campanias_activas_en_fecha(array $campaniasPorGranja, string $fechaYmd): array
    {
        $out = [];
        foreach ($campaniasPorGranja as $g3 => $rows) {
            if (!is_array($rows)) {
                continue;
            }
            $g = ccos_norm_granja((string) $g3);
            $list = [];
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $camp = ccos_norm_campania((string) ($row['campania'] ?? ''));
                if ($camp === '') {
                    continue;
                }
                $fi = ccos_norm_fecha($row['fecha_inicio'] ?? $row['fecini'] ?? null);
                $ff = ccos_norm_fecha($row['fecha_fin'] ?? $row['fecfin'] ?? null);
                if (ccos_campania_activa_en_fecha($fi, $ff, $fechaYmd)) {
                    $list[] = $camp;
                }
            }
            sort($list);
            $out[$g] = $list;
        }

        return $out;
    }
}

if (!function_exists('ccos_sugerir_campania')) {
    /**
     * Primera campaña activa en fecha (menor fecini; desempate menor número).
     *
     * @param list<array<string,mixed>> $rowsCamp
     */
    function ccos_sugerir_campania(array $rowsCamp, string $fechaYmd): string
    {
        $best = '';
        $bestFi = '';
        $bestN = PHP_INT_MAX;
        foreach ($rowsCamp as $row) {
            if (!is_array($row)) {
                continue;
            }
            $camp3 = ccos_norm_campania((string) ($row['campania'] ?? ''));
            if ($camp3 === '') {
                continue;
            }
            $fi = ccos_norm_fecha($row['fecha_inicio'] ?? $row['fecini'] ?? null);
            $ff = ccos_norm_fecha($row['fecha_fin'] ?? $row['fecfin'] ?? null);
            if (!ccos_campania_activa_en_fecha($fi, $ff, $fechaYmd) || $fi === null) {
                continue;
            }
            $n = (int) ltrim($camp3, '0');
            $elige = ($best === '' || $fi < $bestFi || ($fi === $bestFi && $n < $bestN));
            if ($elige) {
                $bestFi = $fi;
                $bestN = $n;
                $best = $camp3;
            }
        }

        return $best;
    }
}

if (!function_exists('ccos_filtrar_por_zona')) {
    function ccos_filtrar_por_zona(mysqli $conn, string $usuario, array $r): array
    {
        $usuario = trim($usuario);
        if ($usuario === '') {
            return $r;
        }
        require_once dirname(__DIR__, 2) . '/modules/configuracion/mis_zonas/acl_mis_zonas.php';
        $ctx = mz_obtener_contexto_usuario($conn, $usuario);
        if (!mz_aplicar_filtro_zonas($ctx)) {
            return $r;
        }

        $cencosOut = [];
        foreach ($r['cencos'] ?? [] as $c) {
            if (!is_array($c)) {
                continue;
            }
            $cod = trim((string) ($c['codigo'] ?? ''));
            $galpones = $c['galpones'] ?? [];
            $allowed = false;
            if (is_array($galpones) && $galpones !== []) {
                foreach ($galpones as $gp) {
                    $glp = '';
                    if (is_array($gp)) {
                        $glp = trim((string) ($gp['tcodint'] ?? $gp['galpon'] ?? ''));
                    } else {
                        $glp = trim((string) $gp);
                    }
                    if ($glp !== '' && mz_usuario_puede_granja_galpon($conn, $usuario, $cod, $glp, $ctx)) {
                        $allowed = true;
                        break;
                    }
                }
            } else {
                $allowed = mz_usuario_puede_granja_galpon($conn, $usuario, $cod, '1', $ctx)
                    || mz_usuario_puede_granja_galpon($conn, $usuario, $cod, '01', $ctx);
            }
            if ($allowed) {
                $cencosOut[] = $c;
            }
        }

        $granjasMeta = is_array($r['granjas'] ?? null) ? $r['granjas'] : [];
        $shaped = ccos_shape_proyeccion($cencosOut, $granjasMeta);
        $r['cencos'] = $shaped['cencos'];
        $r['granjas'] = $shaped['granjas'];
        $r['campanias_por_granja'] = $shaped['campanias_por_granja'];

        return $r;
    }
}

if (!function_exists('ccos_fetch_proyeccion')) {
    /**
     * @param array{
     *   usuario?:string,
     *   filtrar_zonas?:bool,
     *   granjas?:list<string>,
     *   rango?:array{desde:string,hasta:string}|null,
     *   historico_anual?:bool
     * } $opts
     */
    function ccos_fetch_proyeccion(mysqli $conn, string $fechaYmd, array $opts = []): array
    {
        $fechaYmd = trim($fechaYmd);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaYmd)) {
            return [
                'ok' => false,
                'cencos' => [],
                'granjas' => [],
                'campanias_por_granja' => [],
                'message' => 'Fecha de referencia inválida.',
            ];
        }

        $granjas3 = is_array($opts['granjas'] ?? null) ? $opts['granjas'] : [];
        $rango = $opts['rango'] ?? null;
        if (!empty($opts['historico_anual'])) {
            $ts = strtotime($fechaYmd . ' 12:00:00');
            $desde = $ts !== false ? date('Y-m-d', strtotime('-1 year', $ts)) : date('Y-m-d', strtotime('-1 year'));
            $rango = ['desde' => $desde, 'hasta' => $fechaYmd];
        }

        $fetch = ccos_fetch_campanias($conn, $granjas3, $rango);
        $granjasMeta = hc_granjas_listar_para_selector($conn, '');
        $shaped = ccos_shape_proyeccion($fetch['cencos'], $granjasMeta);

        $sugeridas = [];
        foreach ($shaped['campanias_por_granja'] as $g3 => $rows) {
            $sug = ccos_sugerir_campania(is_array($rows) ? $rows : [], $fechaYmd);
            if ($sug !== '') {
                $sugeridas[$g3] = $sug;
            }
        }

        $r = [
            'ok' => $fetch['cencos'] !== [] || $shaped['campanias_por_granja'] !== [],
            'cencos' => $shaped['cencos'],
            'granjas' => $shaped['granjas'],
            'campanias_por_granja' => $shaped['campanias_por_granja'],
            'galpones_por_granja' => $fetch['galpones_por_granja'],
            'campania_sugerida_por_granja' => $sugeridas,
            'activas_por_granja' => ccos_campanias_activas_en_fecha($shaped['campanias_por_granja'], $fechaYmd),
            'fuente_fechas' => 'ccos',
            'message' => '',
        ];
        if ($rango !== null) {
            $r['historico_desde'] = $rango['desde'] ?? null;
            $r['historico_hasta'] = $rango['hasta'] ?? $fechaYmd;
        }

        $usuario = trim((string) ($opts['usuario'] ?? ''));
        if (!empty($opts['filtrar_zonas']) && $usuario !== '') {
            $r = ccos_filtrar_por_zona($conn, $usuario, $r);
            $r['activas_por_granja'] = ccos_campanias_activas_en_fecha(
                is_array($r['campanias_por_granja'] ?? null) ? $r['campanias_por_granja'] : [],
                $fechaYmd
            );
            $sugeridas = [];
            foreach ($r['campanias_por_granja'] ?? [] as $g3 => $rows) {
                $sug = ccos_sugerir_campania(is_array($rows) ? $rows : [], $fechaYmd);
                if ($sug !== '') {
                    $sugeridas[$g3] = $sug;
                }
            }
            $r['campania_sugerida_por_granja'] = $sugeridas;
        }

        if (!$r['ok']) {
            $r['message'] = 'No hay campañas en ccos para la fecha indicada.';
        }

        return $r;
    }
}

if (!function_exists('ccos_bulk_by_granja')) {
    /**
     * Respuesta bulk para modal GMC multi.
     *
     * @param list<string> $granjas3
     * @param array{desde:string,hasta:string}|null $rango
     * @return array{by_granja:array<string,list<array<string,mixed>>>,galpones_por_granja:array<string,list<string>>,activas_por_granja:array<string,list<string>>}
     */
    function ccos_bulk_by_granja(mysqli $conn, array $granjas3, ?array $rango, string $fechaRef): array
    {
        $fetch = ccos_fetch_campanias($conn, $granjas3, $rango);
        $byGranja = [];
        foreach ($granjas3 as $g) {
            $g3 = ccos_norm_granja((string) $g);
            if ($g3 !== '') {
                $byGranja[$g3] = [];
            }
        }
        foreach ($fetch['cencos'] as $c) {
            if (!is_array($c)) {
                continue;
            }
            $g3 = ccos_norm_granja((string) ($c['granja'] ?? substr((string) ($c['codigo'] ?? ''), 0, 3)));
            if ($g3 === '' || !isset($byGranja[$g3])) {
                continue;
            }
            $camp = ccos_norm_campania((string) ($c['campania'] ?? ''));
            $fi = ccos_norm_fecha($c['fecini'] ?? null);
            $ff = ccos_norm_fecha($c['fecfin'] ?? null);
            $row = [
                'campania' => $camp,
                'codigo' => trim((string) ($c['codigo'] ?? '')),
                'swac' => trim((string) ($c['swac'] ?? '')),
                'ccos_activo' => !empty($c['ccos_activo']),
            ];
            if ($fi !== null) {
                $row['fecha_inicio'] = $fi;
            }
            if ($ff !== null) {
                $row['fecha_fin'] = $ff;
            }
            $byGranja[$g3][] = $row;
        }
        foreach ($byGranja as $g3 => &$rows) {
            usort($rows, static function (array $a, array $b): int {
                return strcmp((string) ($a['campania'] ?? ''), (string) ($b['campania'] ?? ''));
            });
        }
        unset($rows);

        return [
            'by_granja' => $byGranja,
            'galpones_por_granja' => $fetch['galpones_por_granja'],
            'activas_por_granja' => ccos_campanias_activas_en_fecha(
                array_map(static function (array $rows): array {
                    return $rows;
                }, $byGranja),
                $fechaRef
            ),
        ];
    }
}

if (!function_exists('ccos_fetch_intervalo_campania')) {
    /** @return array{fecha_inicio:?string,fecha_fin:?string,activa:bool,swac:string} */
    function ccos_fetch_intervalo_campania(mysqli $conn, string $granja3, string $campania3, string $fechaYmd): array
    {
        $g3 = ccos_norm_granja($granja3);
        $c3 = ccos_norm_campania($campania3);
        $cod = $g3 . $c3;
        $out = [
            'fecha_inicio' => null,
            'fecha_fin' => null,
            'activa' => false,
            'swac' => '',
        ];
        if ($g3 === '' || $c3 === '' || !ccos_tabla_existe($conn)) {
            return $out;
        }
        $st = $conn->prepare('SELECT TRIM(swac) AS swac, fecini, fecfin FROM ccos WHERE TRIM(codigo) = ? LIMIT 1');
        if (!$st) {
            return $out;
        }
        $st->bind_param('s', $cod);
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        if (!$row) {
            return $out;
        }
        $fi = ccos_norm_fecha($row['fecini'] ?? null);
        $ff = ccos_norm_fecha($row['fecfin'] ?? null);
        $out['fecha_inicio'] = $fi;
        $out['fecha_fin'] = $ff;
        $out['swac'] = strtoupper(trim((string) ($row['swac'] ?? '')));
        $out['activa'] = ccos_campania_activa_en_fecha($fi, $ff, $fechaYmd);

        return $out;
    }
}
