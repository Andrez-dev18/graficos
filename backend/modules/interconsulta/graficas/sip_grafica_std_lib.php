<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_eval_lib.php';

if (!function_exists('sip_grafica_table_exists')) {
    function sip_grafica_table_exists(mysqli $conn, string $table): bool
    {
        static $cache = [];
        $key = spl_object_hash($conn) . '|' . $table;
        if (array_key_exists($key, $cache)) {
            return $cache[$key];
        }
        $safe = $conn->real_escape_string($table);
        $rs = @$conn->query("SHOW TABLES LIKE '{$safe}'");
        $cache[$key] = (bool) ($rs && $rs->num_rows > 0);

        return $cache[$key];
    }
}

if (!function_exists('sip_grafica_galpon_key')) {
    function sip_grafica_galpon_key(string $galpon): string
    {
        $gp = trim($galpon);
        if ($gp === '') {
            return '';
        }
        if (preg_match('/^\d+$/', $gp)) {
            $n = ltrim($gp, '0');

            return $n === '' ? '0' : $n;
        }
        if (preg_match('/(\d+)$/', $gp, $m)) {
            $n = ltrim((string) ($m[1] ?? ''), '0');
            if ($n !== '') {
                return $n;
            }
        }

        return $gp;
    }
}

if (!function_exists('sip_grafica_std_granjas_json_tiene_alcance')) {
    /** Parámetro con granjasJson null/vacío o sin listas → no se usa en gráficas. */
    function sip_grafica_std_granjas_json_tiene_alcance(string $granjasJsonRaw): bool
    {
        $j = trim($granjasJsonRaw);
        if ($j === '') {
            return false;
        }
        $dec = json_decode($j, true);
        if (!is_array($dec)) {
            return false;
        }
        $complete = $dec['granjasCompletas'] ?? [];
        $pares = $dec['paresGg'] ?? [];
        if (!is_array($complete)) {
            $complete = [];
        }
        if (!is_array($pares)) {
            $pares = [];
        }
        if ($complete !== []) {
            return true;
        }
        foreach ($pares as $pair) {
            if (trim((string) $pair) !== '') {
                return true;
            }
        }

        return false;
    }
}

if (!function_exists('sip_grafica_std_granjas_json_aplica')) {
    function sip_grafica_std_granjas_json_aplica(string $granjasJsonRaw, string $granja3, string $galponRaw): bool
    {
        if (!sip_grafica_std_granjas_json_tiene_alcance($granjasJsonRaw)) {
            return false;
        }
        $granja3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        if ($granja3 === '' || $granja3 === '000') {
            return false;
        }
        $dec = json_decode(trim($granjasJsonRaw), true);
        if (!is_array($dec)) {
            return false;
        }
        $complete = $dec['granjasCompletas'] ?? [];
        $pares = $dec['paresGg'] ?? [];
        if (!is_array($complete)) {
            $complete = [];
        }
        if (!is_array($pares)) {
            $pares = [];
        }
        foreach ($complete as $gc) {
            $g = substr(str_pad(trim((string) $gc), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g === $granja3) {
                return true;
            }
        }
        $gpNorm = sip_grafica_galpon_key($galponRaw);
        foreach ($pares as $pair) {
            $pair = trim((string) $pair);
            if ($pair === '') {
                continue;
            }
            $parts = explode('|', $pair, 2);
            $gPair = substr(str_pad(trim((string) ($parts[0] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($gPair !== $granja3) {
                continue;
            }
            $galpPart = trim((string) ($parts[1] ?? ''));
            $galpNorm = sip_grafica_galpon_key($galpPart);
            if ($galpNorm !== '' && $gpNorm !== '' && $galpNorm === $gpNorm) {
                return true;
            }
        }

        return false;
    }
}

if (!function_exists('sip_grafica_std_expr_cubre_edad')) {
    function sip_grafica_std_expr_cubre_edad(string $expr, int $edadDia): bool
    {
        $ex = trim($expr);
        if ($ex === '') {
            return false;
        }
        if (is_numeric($ex)) {
            return (int) $ex === $edadDia;
        }
        if (preg_match('/^(\d+)\s*-\s*(\d+)$/', $ex, $m)) {
            return $edadDia >= (int) $m[1] && $edadDia <= (int) $m[2];
        }

        return false;
    }
}

if (!function_exists('sip_grafica_std_sexo_norm')) {
    /** Normaliza sexo a 'M', 'H', 'U' (unificado) o '' (sin dato). */
    function sip_grafica_std_sexo_norm(string $sexo): string
    {
        $s = strtoupper(trim($sexo));
        if ($s === '') {
            return '';
        }
        if ($s === 'M' || strpos($s, 'MACH') === 0) {
            return 'M';
        }
        if ($s === 'H' || strpos($s, 'HEMB') === 0) {
            return 'H';
        }
        if ($s === 'U' || strpos($s, 'UNIF') === 0) {
            return 'U';
        }

        return '';
    }
}

if (!function_exists('sip_grafica_std_pick_row_por_sexo')) {
    /**
     * Elige la fila del sexo pedido; fallback a `unificado`, a fila sin sexo y a la primera.
     *
     * @param list<array<string,mixed>> $pool
     * @return array<string,mixed>|null
     */
    function sip_grafica_std_pick_row_por_sexo(array $pool, string $sexo): ?array
    {
        if ($pool === []) {
            return null;
        }
        $want = sip_grafica_std_sexo_norm($sexo);
        if ($want === '') {
            return $pool[0];
        }
        foreach ($pool as $r) {
            if (sip_grafica_std_sexo_norm((string) ($r['sexo'] ?? '')) === $want) {
                return $r;
            }
        }
        foreach ($pool as $r) {
            if (sip_grafica_std_sexo_norm((string) ($r['sexo'] ?? '')) === 'U') {
                return $r;
            }
        }
        foreach ($pool as $r) {
            if (sip_grafica_std_sexo_norm((string) ($r['sexo'] ?? '')) === '') {
                return $r;
            }
        }

        return $pool[0];
    }
}

if (!function_exists('sip_grafica_std_pick_row_from_list')) {
    /**
     * @param list<array<string,mixed>> $rows
     * @return array<string,mixed>|null
     */
    function sip_grafica_std_pick_row_from_list(array $rows, int $edadDia, string $sexo = ''): ?array
    {
        if ($rows === []) {
            return null;
        }
        $wildcard = [];
        $specific = [];
        foreach ($rows as $r) {
            if (!is_array($r)) {
                continue;
            }
            $ex = trim((string) ($r['edadDiaExpr'] ?? ''));
            if ($ex === '') {
                $wildcard[] = $r;

                continue;
            }
            if (sip_grafica_std_expr_cubre_edad($ex, $edadDia)) {
                $specific[] = $r;
            }
        }

        return sip_grafica_std_pick_row_por_sexo($specific !== [] ? $specific : $wildcard, $sexo);
    }
}

if (!function_exists('sip_grafica_std_map_desde_san_estandares')) {
    /**
     * Catálogo de estándares con granjasJson definido. Si se pasa granja/galpón, precache solo filas aplicables.
     *
     * @return array<string, list<array{stdMin:string,stdMax:string,unidades:string,edadDiaExpr:string,granjasJson:string,sexo:string}>>
     */
    function sip_grafica_std_map_desde_san_estandares(mysqli $conn, string $granja3 = '', string $galpon = ''): array
    {
        static $cache = [];
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $gp = sip_grafica_galpon_key($galpon);
        $cacheKey = spl_object_hash($conn) . '|' . $g3 . '|' . $gp;
        if (isset($cache[$cacheKey])) {
            return $cache[$cacheKey];
        }

        $map = [];
        if (!sip_grafica_table_exists($conn, 'san_estandares_parametros')
            || !sip_grafica_table_exists($conn, 'san_estandares_nodos')) {
            $cache[$cacheKey] = $map;

            return $map;
        }
        $colSexo = $conn->query("SHOW COLUMNS FROM `san_estandares_parametros` LIKE 'sexo'");
        $tieneSexo = (bool) ($colSexo && $colSexo->num_rows > 0);
        $selSexo = $tieneSexo ? "TRIM(COALESCE(p.`sexo`,''))" : "''";
        $rs = $conn->query(
            "SELECT TRIM(n.`actividadKey`) AS tk, TRIM(p.`parametroKey`) AS pk,
                    TRIM(COALESCE(p.`stdMin`,'')) AS stdMin, TRIM(COALESCE(p.`stdMax`,'')) AS stdMax,
                    TRIM(COALESCE(p.`unidades`,'')) AS unidades,
                    TRIM(COALESCE(p.`edadDiaExpr`,'')) AS edadDiaExpr,
                    TRIM(COALESCE(p.`granjasJson`,'')) AS granjasJson,
                    {$selSexo} AS sexo
             FROM `san_estandares_parametros` p
             INNER JOIN `san_estandares_nodos` n ON n.`id` = p.`nodoId`
             WHERE n.`actividadKey` IS NOT NULL AND n.`actividadKey` <> ''
               AND p.`parametroKey` IS NOT NULL AND p.`parametroKey` <> ''
               AND NULLIF(TRIM(COALESCE(p.`granjasJson`,'')), '') IS NOT NULL
             ORDER BY n.`actividadKey` ASC, p.`parametroKey` ASC, p.`id` ASC"
        );
        if (!$rs) {
            return $map;
        }
        while ($row = $rs->fetch_assoc()) {
            $tk = strtoupper(trim((string) ($row['tk'] ?? '')));
            $pk = strtoupper(trim((string) ($row['pk'] ?? '')));
            $ex = trim((string) ($row['edadDiaExpr'] ?? ''));
            $gj = (string) ($row['granjasJson'] ?? '');
            if ($tk === '' || $pk === '' || !sip_grafica_std_granjas_json_tiene_alcance($gj)) {
                continue;
            }
            if ($g3 !== '' && $g3 !== '000' && !sip_grafica_std_granjas_json_aplica($gj, $g3, $galpon)) {
                continue;
            }
            $key = $tk . '|' . $pk;
            if (!isset($map[$key])) {
                $map[$key] = [];
            }
            $map[$key][] = [
                'stdMin' => (string) ($row['stdMin'] ?? ''),
                'stdMax' => (string) ($row['stdMax'] ?? ''),
                'unidades' => (string) ($row['unidades'] ?? ''),
                'edadDiaExpr' => $ex,
                'granjasJson' => $gj,
                'sexo' => (string) ($row['sexo'] ?? ''),
            ];
        }
        $rs->free();

        $cache[$cacheKey] = $map;

        return $map;
    }
}

if (!function_exists('sip_grafica_std_filas_por_tk_pk')) {
    /**
     * Filas de san_estandares para actividad+parametro, opcionalmente filtradas por granjasJson.
     *
     * @return list<array{stdMin:string,stdMax:string,unidades:string,edadDiaExpr:string,granjasJson:string}>
     */
    function sip_grafica_std_filas_por_tk_pk(
        array $stdMap,
        string $tareaKey,
        string $parametroKey,
        string $granja3 = '',
        string $galpon = ''
    ): array {
        static $cache = [];
        $tk = strtoupper(trim($tareaKey));
        $pk = strtoupper(trim($parametroKey));
        $mapId = md5(serialize($stdMap));
        $ck = $mapId . '|' . $tk . '|' . $pk . '|' . $granja3 . '|' . $galpon;
        if (isset($cache[$ck])) {
            return $cache[$ck];
        }
        $rows = $stdMap[$tk . '|' . $pk] ?? [];
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        if ($g3 === '' || $g3 === '000') {
            $cache[$ck] = [];

            return [];
        }
        $out = [];
        foreach ($rows as $r) {
            if (!is_array($r)) {
                continue;
            }
            $gj = trim((string) ($r['granjasJson'] ?? ''));
            if (sip_grafica_std_granjas_json_aplica($gj, $g3, $galpon)) {
                $out[] = $r;
            }
        }
        $cache[$ck] = $out;

        return $out;
    }
}

if (!function_exists('sip_grafica_std_rango_desde_map')) {
    /** @return array{0:?float,1:?float,2:string} */
    function sip_grafica_std_rango_desde_map(
        array $stdMap,
        string $tareaKey,
        string $parametroKey,
        int $edadDia,
        string $granja3 = '',
        string $galpon = '',
        string $sexo = ''
    ): array {
        $candidatos = sip_grafica_std_filas_por_tk_pk($stdMap, $tareaKey, $parametroKey, $granja3, $galpon);
        $row = sip_grafica_std_pick_row_from_list($candidatos, $edadDia, $sexo);
        if (!is_array($row)) {
            return [null, null, '—'];
        }
        $minS = trim((string) ($row['stdMin'] ?? ''));
        $maxS = trim((string) ($row['stdMax'] ?? ''));
        $min = ($minS !== '' && is_numeric($minS)) ? (float) $minS : null;
        $max = ($maxS !== '' && is_numeric($maxS)) ? (float) $maxS : null;
        $unidades = trim((string) ($row['unidades'] ?? ''));

        return [$min, $max, $unidades !== '' ? $unidades : '—'];
    }
}

if (!function_exists('sip_grafica_std_rango_mh_desde_map')) {
    /**
     * Estándar por sexo para el día: min/max/unidades de macho y hembra por separado.
     *
     * @return array{m:array{min:?float,max:?float,u:string},h:array{min:?float,max:?float,u:string}}
     */
    function sip_grafica_std_rango_mh_desde_map(
        array $stdMap,
        string $tareaKey,
        string $parametroKey,
        int $edadDia,
        string $granja3 = '',
        string $galpon = ''
    ): array {
        $out = ['m' => ['min' => null, 'max' => null, 'u' => '—'], 'h' => ['min' => null, 'max' => null, 'u' => '—']];
        foreach (['M' => 'm', 'H' => 'h'] as $sx => $k) {
            [$mn, $mx, $u] = sip_grafica_std_rango_desde_map($stdMap, $tareaKey, $parametroKey, $edadDia, $granja3, $galpon, $sx);
            $out[$k] = ['min' => $mn, 'max' => $mx, 'u' => $u];
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_fecha_inicio_cab')) {
    function sip_grafica_fecha_inicio_cab(
        mysqli $conn,
        string $granja3,
        string $campania,
        string $galBind,
        string $galBind2
    ): ?string {
        // Ancla de edad de etl_11: ingreso real (MIN E001) por galpón.
        $galNorm = ltrim($galBind, '0');
        if ($galNorm === '') {
            $galNorm = $galBind2;
        }
        $gPrefijo = $granja3 . '%';
        $sqlE001 = "SELECT MIN(DATE(tfectra)) AS fi
                    FROM movi_zonas
                    WHERE tcencos LIKE ?
                      AND RIGHT(tcencos, 3) = ?
                      AND tcodtra = 'E001' AND tline = '001'
                      AND tcodint = ?
                      AND tcodint <> ''
                    GROUP BY tcodint";
        foreach (array_unique(array_filter([$galBind, $galNorm])) as $gpTry) {
            $st = $conn->prepare($sqlE001);
            if (!$st) {
                continue;
            }
            $st->bind_param('sss', $gPrefijo, $campania, $gpTry);
            $st->execute();
            $rs = $st->get_result();
            $row = $rs ? $rs->fetch_assoc() : null;
            $st->close();
            if ($row && !empty($row['fi'])) {
                return (string) $row['fi'];
            }
        }

        // Fallback: fecha_inicio de la cabecera.
        $sql = "SELECT DATE(`fecha_inicio`) AS fecha_inicio
                FROM `san_fact_historia_clinica_cab`
                WHERE LPAD(LEFT(TRIM(`granja`),3),3,'0') = ?
                  AND TRIM(`campania`) = ?
                  AND (
                       TRIM(CAST(`galpon` AS CHAR)) = ?
                       OR CAST(TRIM(CAST(`galpon` AS CHAR)) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )
                ORDER BY `id` DESC LIMIT 1";
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $st->bind_param('ssss', $granja3, $campania, $galBind, $galBind2);
        $st->execute();
        $rs = $st->get_result();
        $cab = $rs ? $rs->fetch_assoc() : null;
        $st->close();
        if (!$cab || empty($cab['fecha_inicio'])) {
            return null;
        }

        return (string) $cab['fecha_inicio'];
    }
}

if (!function_exists('sip_grafica_normalize_granja_campania')) {
    /** @return array{0:string,1:string,2:string,3:string} [granja3, campania, galBind, galBind2] */
    function sip_grafica_normalize_granja_campania(string $granja, string $campania, string $galpon): array
    {
        $granjaDigits = preg_replace('/[^0-9]/', '', $granja);
        $granja3 = str_pad(substr((string) $granjaDigits, 0, 3), 3, '0', STR_PAD_LEFT);
        $campDigits = preg_replace('/\s+/', '', trim($campania));
        $campania3 = str_pad(substr((string) $campDigits, -3), 3, '0', STR_PAD_LEFT);
        $galpon = trim($galpon);
        $galponNorm = ltrim($galpon, '0');
        if ($galponNorm === '') {
            $galponNorm = $galpon !== '' ? $galpon : '';
        }
        $galBind = ($galpon !== '') ? $galpon : $galponNorm;
        $galBind2 = ($galponNorm !== '') ? $galponNorm : $galBind;

        return [$granja3, $campania3, $galBind, $galBind2];
    }
}

if (!function_exists('sip_grafica_stock_por_dia_fetch')) {
    /**
     * @return array{stockPorDia:array<int,array{m:?float,h:?float}>,stockDia1:?array{m:?float,h:?float}}
     */
    function sip_grafica_stock_por_dia_fetch(
        mysqli $conn,
        string $granja3,
        string $campania3,
        string $galBind,
        string $galBind2
    ): array {
        $stockPorDia = [];
        $stockDia1 = null;
        $sqlStk = "SELECT d.`edadDia`, d.`valor` AS stockVal
                   FROM `san_fact_historia_clinica_det` d
                   INNER JOIN `san_fact_historia_clinica_cab` c ON c.`id` = d.`cabId`
                   WHERE LPAD(LEFT(TRIM(c.`granja`),3),3,'0') = ?
                     AND TRIM(c.`campania`) = ?
                     AND (
                          TRIM(CAST(c.`galpon` AS CHAR)) = ?
                          OR CAST(TRIM(CAST(c.`galpon` AS CHAR)) AS UNSIGNED) = CAST(? AS UNSIGNED)
                     )
                     AND d.`tareaKey` = 'CANTIDAD_POLLOS'
                   ORDER BY d.`edadDia` ASC";
        $stStk = $conn->prepare($sqlStk);
        if ($stStk) {
            $stStk->bind_param('ssss', $granja3, $campania3, $galBind, $galBind2);
            $stStk->execute();
            $rsStk = $stStk->get_result();
            while ($sr = $rsStk->fetch_assoc()) {
                $edDia = (int) ($sr['edadDia'] ?? 0);
                $parsed = sip_grafica_parse_valor_mh($sr['stockVal'] ?? null, 0);
                if ($parsed['esMh']) {
                    $mVal = $parsed['m'];
                    $hVal = $parsed['h'];
                } elseif ($parsed['unified'] !== null) {
                    $mVal = $parsed['unified'];
                    $hVal = $parsed['unified'];
                } else {
                    $mVal = $parsed['m'];
                    $hVal = $parsed['h'];
                }
                $stockPorDia[$edDia] = ['m' => $mVal, 'h' => $hVal];
            }
            $stStk->close();
        }
        if ($stockPorDia !== []) {
            $stockDia1 = $stockPorDia[min(array_keys($stockPorDia))];
        }

        return ['stockPorDia' => $stockPorDia, 'stockDia1' => $stockDia1];
    }
}

if (!function_exists('sip_grafica_stock_resolver')) {
    /** @param array<int,array{m:?float,h:?float}> $stockPorDia */
    function sip_grafica_stock_resolver(int $edad, array $stockPorDia, ?array $stockDia1): ?array
    {
        if (isset($stockPorDia[$edad])) {
            return $stockPorDia[$edad];
        }
        if ($stockPorDia !== []) {
            $bestKey = null;
            $bestDiff = PHP_INT_MAX;
            foreach (array_keys($stockPorDia) as $k) {
                $diff = abs($k - $edad);
                if ($diff < $bestDiff) {
                    $bestDiff = $diff;
                    $bestKey = $k;
                }
            }
            if ($bestKey !== null) {
                return $stockPorDia[$bestKey];
            }
        }

        return $stockDia1;
    }
}

if (!function_exists('sip_grafica_fecha_por_dia')) {
    function sip_grafica_fecha_por_dia(?string $fechaInicio, int $dia): ?string
    {
        if ($fechaInicio === null || $fechaInicio === '' || $dia <= 0) {
            return null;
        }
        try {
            $dt = new DateTime($fechaInicio);
            if ($dia > 1) {
                $dt->modify('+' . ($dia - 1) . ' days');
            }

            return $dt->format('Y-m-d');
        } catch (Exception $e) {
            return null;
        }
    }
}

if (!function_exists('sip_grafica_data_estandar_tipo_cfg')) {
    /**
     * @return array{tk:string,pk:string,desde:int,hasta:int,normaliza_mortalidad_pct:bool}|null
     */
    function sip_grafica_data_estandar_tipo_cfg(string $tipo): ?array
    {
        static $map = [
            'mortalidad' => [
                'tk' => 'CRIANZA_MORTALIDAD_DIARIA',
                'pk' => 'MORTALIDAD_DIA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => true,
            ],
            'consumo_alimento' => [
                'tk' => 'CRIANZA_CONSUMO_DE_ALIMENTO',
                'pk' => 'CONSUMO_ALIMENTO_DIA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => false,
            ],
            'consumo_gas' => [
                'tk' => 'CRIANZA_CONSUMO_DE_GAS',
                'pk' => 'CONSUMO_GAS_DIA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => false,
            ],
            'consumo_agua' => [
                'tk' => 'CRIANZA_CONSUMO_DE_AGUA',
                'pk' => 'CONSUMO_AGUA_DIA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => false,
            ],
            'pesaje_pollo' => [
                'tk' => 'CRIANZA_PESAJE_DE_POLLO',
                'pk' => 'PESAJE_POLLO_SEMANA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => false,
            ],
            'ganancia_peso' => [
                'tk' => 'CRIANZA_GANANCIA_DE_PESO',
                'pk' => 'GANANCIA_PESO_SEMANA',
                'desde' => 1,
                'hasta' => 7,
                'normaliza_mortalidad_pct' => false,
            ],
            'nivel_cloro' => [
                'tk' => 'CRIANZA_NIVEL_DE_CLORO',
                'pk' => 'NIVEL_CLORO_DIA',
                'desde' => 1,
                'hasta' => 47,
                'normaliza_mortalidad_pct' => false,
            ],
        ];
        $tipoNorm = strtolower(trim($tipo));

        return $map[$tipoNorm] ?? null;
    }
}

if (!function_exists('sip_grafica_data_estandar_completo')) {
    /**
     * Catálogo san_estandares completo por día, aunque no haya registro real.
     *
     * @return array<int,array{dia:int,min:?float,max:?float,minM:?float,maxM:?float,minH:?float,maxH:?float}>|null
     */
    function sip_grafica_data_estandar_completo(
        mysqli $conn,
        string $tipo,
        string $granja3 = '',
        string $galpon = ''
    ): ?array {
        $cfg = sip_grafica_data_estandar_tipo_cfg($tipo);
        if ($cfg === null) {
            return null;
        }
        $stdMap = sip_grafica_std_map_desde_san_estandares($conn, $granja3, $galpon);
        if ($stdMap === []) {
            return null;
        }
        $out = [];
        for ($d = $cfg['desde']; $d <= $cfg['hasta']; $d++) {
            [$min, $max] = sip_grafica_std_rango_desde_map($stdMap, $cfg['tk'], $cfg['pk'], $d, $granja3, $galpon);
            if ($min === null && $max === null) {
                continue;
            }
            if ($min == 0.0 && $max == 0.0) {
                continue;
            }
            $mh = sip_grafica_std_rango_mh_desde_map($stdMap, $cfg['tk'], $cfg['pk'], $d, $granja3, $galpon);
            $minM = $mh['m']['min'] ?? null;
            $maxM = $mh['m']['max'] ?? null;
            $minH = $mh['h']['min'] ?? null;
            $maxH = $mh['h']['max'] ?? null;
            if ($cfg['normaliza_mortalidad_pct']) {
                if ($min !== null && $min > 1.0) {
                    $min /= 100.0;
                }
                if ($max !== null && $max > 1.0) {
                    $max /= 100.0;
                }
                if ($minM !== null && $minM > 1.0) {
                    $minM /= 100.0;
                }
                if ($maxM !== null && $maxM > 1.0) {
                    $maxM /= 100.0;
                }
                if ($minH !== null && $minH > 1.0) {
                    $minH /= 100.0;
                }
                if ($maxH !== null && $maxH > 1.0) {
                    $maxH /= 100.0;
                }
            }
            $out[] = [
                'dia' => $d,
                'min' => $min,
                'max' => $max,
                'minM' => $minM,
                'maxM' => $maxM,
                'minH' => $minH,
                'maxH' => $maxH,
            ];
        }

        return $out !== [] ? $out : null;
    }
}

if (!function_exists('sip_grafica_result_adjuntar_data_estandar')) {
    /** @param array<string,mixed> $result */
    function sip_grafica_result_adjuntar_data_estandar(
        array $result,
        mysqli $conn,
        string $tipo,
        string $granja = '',
        string $galpon = ''
    ): array {
        if (!($result['success'] ?? false)) {
            return $result;
        }
        $granja3 = '';
        $gal = $galpon;
        if ($granja !== '') {
            [$granja3, , $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, '001', $galpon);
            $gal = $galBind !== '' ? $galBind : $galBind2;
        }
        $dataEstandar = sip_grafica_data_estandar_completo($conn, $tipo, $granja3, $gal);
        if ($dataEstandar === null) {
            return $result;
        }
        if (isset($result['dataPorDia']) && is_array($result['dataPorDia'])) {
            $result['dataEstandar'] = $dataEstandar;

            return $result;
        }
        if (isset($result['linea']) && is_array($result['linea']) && ($result['linea']['success'] ?? false)) {
            $result['linea']['dataEstandar'] = $dataEstandar;
            $result['dataEstandar'] = $dataEstandar;
        }

        return $result;
    }
}

if (!function_exists('sip_grafica_result_completar_estandar_dias')) {
    /**
     * Fusiona el catálogo de estándar en `dataPorDia`: agrega el estándar de cada día
     * del rango aunque no exista medición (fila con macho/hembra en null).
     *
     * @param array<string,mixed> $result
     */
    function sip_grafica_result_completar_estandar_dias(
        array $result,
        mysqli $conn,
        string $tipo,
        string $granja = '',
        string $galpon = ''
    ): array {
        if (!($result['success'] ?? false)) {
            return $result;
        }

        $granja3 = '';
        $gal = $galpon;
        if ($granja !== '') {
            [$granja3, , $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, '001', $galpon);
            $gal = $galBind !== '' ? $galBind : $galBind2;
        }
        $catalogo = sip_grafica_data_estandar_completo($conn, $tipo, $granja3, $gal);
        if ($catalogo === null) {
            return $result;
        }

        if (isset($result['dataPorDia']) && is_array($result['dataPorDia'])) {
            $result['dataPorDia'] = sip_grafica_std_fusionar_dias($result['dataPorDia'], $catalogo);

            return $result;
        }
        if (isset($result['linea']['dataPorDia']) && is_array($result['linea']['dataPorDia'])) {
            $result['linea']['dataPorDia'] = sip_grafica_std_fusionar_dias($result['linea']['dataPorDia'], $catalogo);
        }

        return $result;
    }
}

if (!function_exists('sip_grafica_std_fusionar_dias')) {
    /**
     * @param list<array<string,mixed>> $dataPorDia
     * @param list<array<string,mixed>> $catalogo
     * @return list<array<string,mixed>>
     */
    function sip_grafica_std_fusionar_dias(array $dataPorDia, array $catalogo): array
    {
        $porDia = [];
        foreach ($dataPorDia as $row) {
            if (!is_array($row)) {
                continue;
            }
            $dia = (int) ($row['dia'] ?? 0);
            if ($dia > 0) {
                $porDia[$dia] = $row;
            }
        }

        $catPorDia = [];
        foreach ($catalogo as $c) {
            if (is_array($c) && (int) ($c['dia'] ?? 0) > 0) {
                $catPorDia[(int) $c['dia']] = $c;
            }
        }

        $dias = [];
        foreach ($porDia as $dia => $_) {
            $dias[$dia] = $dia;
        }
        foreach ($catPorDia as $dia => $_) {
            $dias[$dia] = $dia;
        }
        ksort($dias, SORT_NUMERIC);

        $out = [];
        foreach ($dias as $dia) {
            $row = $porDia[$dia] ?? ['dia' => $dia];
            $c = $catPorDia[$dia] ?? null;
            if ($c !== null) {
                $row = sip_grafica_std_fila_con_catalogo($row, $c);
            }
            if (!array_key_exists('macho', $row)) {
                $row['macho'] = null;
            }
            if (!array_key_exists('hembra', $row)) {
                $row['hembra'] = null;
            }
            $out[] = $row;
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_std_fila_con_catalogo')) {
    /**
     * @param array<string,mixed> $row
     * @param array<string,mixed> $c
     * @return array<string,mixed>
     */
    function sip_grafica_std_fila_con_catalogo(array $row, array $c): array
    {
        if (!isset($row['estandar']) || !is_array($row['estandar'])) {
            if ($c['min'] !== null || $c['max'] !== null) {
                $row['estandar'] = ['min' => $c['min'], 'max' => $c['max']];
            }
        }
        if (!isset($row['estandarM']) || !is_array($row['estandarM'])) {
            if ($c['minM'] !== null || $c['maxM'] !== null) {
                $row['estandarM'] = ['min' => $c['minM'], 'max' => $c['maxM']];
            }
        }
        if (!isset($row['estandarH']) || !is_array($row['estandarH'])) {
            if ($c['minH'] !== null || $c['maxH'] !== null) {
                $row['estandarH'] = ['min' => $c['minH'], 'max' => $c['maxH']];
            }
        }

        return $row;
    }
}

if (!function_exists('sip_grafica_std_franja_cuts_norm')) {
    /** @return list<float> */
    function sip_grafica_std_franja_cuts_norm($raw): array
    {
        if (!is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $v) {
            if (is_string($v)) {
                $v = str_replace(',', '.', trim($v));
            }
            if ($v === null || $v === '' || !is_numeric($v)) {
                continue;
            }
            $n = (float) $v;
            if (!is_finite($n)) {
                continue;
            }
            $out[] = $n;
        }
        sort($out, SORT_NUMERIC);

        return $out;
    }
}

if (!function_exists('sip_grafica_std_franja_meta_desde_row')) {
    /**
     * Metadatos de franjas (3 o 4 bandas) del estándar de un parámetro.
     *
     * @param array<string,mixed> $row
     * @return array{count:int,labels:list<string>,cuts:list<float>,modoEvaluacion:string}|null
     */
    function sip_grafica_std_franja_meta_desde_row(array $row): ?array
    {
        $modo = strtolower(trim((string) ($row['modoEvaluacion'] ?? '')));
        if ($modo !== 'franjas') {
            return null;
        }
        $info = [];
        $raw = trim((string) ($row['infoOrigen'] ?? ''));
        if ($raw !== '' && $raw[0] === '{') {
            $dec = json_decode($raw, true);
            if (is_array($dec)) {
                $info = $dec;
            }
        }
        $labels = [];
        foreach ((array) ($info['_franjaLabels'] ?? []) as $lbl) {
            $t = trim((string) $lbl);
            if ($t !== '') {
                $labels[] = $t;
            }
        }
        $cuts = sip_grafica_std_franja_cuts_norm($info['_franjaCuts'] ?? []);
        if ($cuts === [] && isset($info['franjaCut2'])) {
            $cuts = sip_grafica_std_franja_cuts_norm([$row['stdMin'] ?? null, $info['franjaCut2'], $row['stdMax'] ?? null]);
        }
        if ($cuts === []) {
            $cuts = sip_grafica_std_franja_cuts_norm([$row['stdMin'] ?? null, $row['stdMax'] ?? null]);
        }
        if (count($cuts) < 2) {
            return null;
        }
        $count = (int) ($info['_franjaCount'] ?? 0);
        if ($count !== 3 && $count !== 4) {
            $count = (count($labels) >= 4 || count($cuts) >= 3) ? 4 : 3;
        }
        if ($count === 4 && count($cuts) < 3) {
            $count = 3;
        }
        if (count($labels) < $count) {
            $defs = $count === 4
                ? ['Bueno', 'Leve', 'Moderado', 'Alto']
                : ['Bueno', 'Aceptable', 'Malo'];
            for ($i = count($labels); $i < $count; $i++) {
                $labels[] = $defs[$i];
            }
        }
        $labels = array_slice($labels, 0, $count);
        $cuts = array_slice($cuts, 0, $count === 4 ? 3 : 2);

        return [
            'count' => $count,
            'labels' => array_values($labels),
            'cuts' => array_values($cuts),
            'modoEvaluacion' => 'franjas',
        ];
    }
}

if (!function_exists('sip_grafica_std_franja_meta')) {
    /**
     * Franjas del estándar vigente para actividad+parámetro (null si el modo no es `franjas`).
     *
     * @return array{count:int,labels:list<string>,cuts:list<float>,modoEvaluacion:string}|null
     */
    function sip_grafica_std_franja_meta(
        mysqli $conn,
        string $tareaKey,
        string $parametroKey,
        string $granja3 = '',
        string $galpon = ''
    ): ?array {
        static $cache = [];
        $tk = strtoupper(trim($tareaKey));
        $pk = strtoupper(trim($parametroKey));
        if ($tk === '' || $pk === '') {
            return null;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $gp = sip_grafica_galpon_key($galpon);
        $ck = spl_object_hash($conn) . '|' . $tk . '|' . $pk . '|' . $g3 . '|' . $gp;
        if (array_key_exists($ck, $cache)) {
            return $cache[$ck];
        }
        $cache[$ck] = null;
        if (!sip_grafica_table_exists($conn, 'san_estandares_parametros')
            || !sip_grafica_table_exists($conn, 'san_estandares_nodos')) {
            return null;
        }
        $sql = "SELECT TRIM(COALESCE(p.`stdMin`,'')) AS stdMin,
                       TRIM(COALESCE(p.`stdMax`,'')) AS stdMax,
                       TRIM(COALESCE(p.`modoEvaluacion`,'')) AS modoEvaluacion,
                       COALESCE(p.`infoOrigen`,'') AS infoOrigen,
                       TRIM(COALESCE(p.`granjasJson`,'')) AS granjasJson
                FROM `san_estandares_parametros` p
                INNER JOIN `san_estandares_nodos` n ON n.`id` = p.`nodoId`
                WHERE UPPER(TRIM(n.`actividadKey`)) = ?
                  AND UPPER(TRIM(p.`parametroKey`)) = ?
                ORDER BY p.`id` ASC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $st->bind_param('ss', $tk, $pk);
        $st->execute();
        $rs = $st->get_result();
        $meta = null;
        while ($rs && ($row = $rs->fetch_assoc())) {
            $gj = trim((string) ($row['granjasJson'] ?? ''));
            if (sip_grafica_std_granjas_json_tiene_alcance($gj)
                && $g3 !== '' && $g3 !== '000'
                && !sip_grafica_std_granjas_json_aplica($gj, $g3, $galpon)) {
                continue;
            }
            $try = sip_grafica_std_franja_meta_desde_row($row);
            if ($try !== null) {
                $meta = $try;
                break;
            }
        }
        $st->close();
        $cache[$ck] = $meta;

        return $meta;
    }
}

if (!function_exists('sip_grafica_std_franja_meta_por_slots')) {
    /**
     * @param array<string,string> $slotsPk slot => parametroKey
     * @return array<string, array{count:int,labels:list<string>,cuts:list<float>,modoEvaluacion:string}>
     */
    function sip_grafica_std_franja_meta_por_slots(
        mysqli $conn,
        string $tareaKey,
        array $slotsPk,
        string $granja3 = '',
        string $galpon = ''
    ): array {
        $out = [];
        foreach ($slotsPk as $slot => $pk) {
            $meta = sip_grafica_std_franja_meta($conn, $tareaKey, $pk, $granja3, $galpon);
            if ($meta !== null) {
                $out[$slot] = $meta;
            }
        }

        return $out;
    }
}
