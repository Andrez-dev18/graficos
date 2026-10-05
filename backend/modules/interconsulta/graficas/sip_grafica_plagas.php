<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_eval_lib.php';
require_once __DIR__ . '/sip_grafica_std_lib.php';

$cpLib = dirname(__DIR__) . '/reportes-especiales/control-plagas/control_plagas_lib.php';
if (is_file($cpLib)) {
    require_once $cpLib;
}
require_once __DIR__ . '/sip_grafica_cp_lib.php';

if (!function_exists('sip_grafica_plagas_tipos')) {
    /** @return list<string> */
    function sip_grafica_plagas_tipos(): array
    {
        return ['gorgojos', 'roedores'];
    }
}

if (!function_exists('sip_grafica_plagas_cfg')) {
    /**
     * @return array<string,mixed>|null
     */
    function sip_grafica_plagas_cfg(string $tipo): ?array
    {
        static $map = [
            'gorgojos' => [
                'tipo' => 'gorgojos',
                'label' => 'Evaluación gorgojos',
                'unidadDefault' => '',
                'esMh' => true,
                'metricas' => ['larva', 'adulto'],
            ],
            'roedores' => [
                'tipo' => 'roedores',
                'label' => 'Evaluación roedores',
                'unidadDefault' => '',
                'esMh' => false,
                'metricas' => ['vivos', 'muertos', 'perimetro', 'techo'],
            ],
        ];

        return $map[strtolower(trim($tipo))] ?? null;
    }
}

if (!function_exists('sip_grafica_es_plagas')) {
    function sip_grafica_es_plagas(string $tipo): bool
    {
        return sip_grafica_plagas_cfg($tipo) !== null;
    }
}

if (!function_exists('sip_grafica_plagas_slot_val')) {
    /**
     * @return array{valor:?float}
     */
    function sip_grafica_plagas_slot_val(?float $v): array
    {
        return ['valor' => $v];
    }
}

if (!function_exists('sip_grafica_plagas_avg_list')) {
    /**
     * @param list<?float> $nums
     */
    function sip_grafica_plagas_avg_list(array $nums): ?float
    {
        $ok = [];
        foreach ($nums as $n) {
            if ($n === null || !is_numeric($n)) {
                continue;
            }
            $f = (float) $n;
            if (is_nan($f) || is_infinite($f)) {
                continue;
            }
            $ok[] = $f;
        }
        if ($ok === []) {
            return null;
        }

        return round(array_sum($ok) / count($ok), 2);
    }
}

if (!function_exists('sip_grafica_plagas_sum_list')) {
    /**
     * @param list<?float> $nums
     */
    function sip_grafica_plagas_sum_list(array $nums): ?float
    {
        $ok = [];
        foreach ($nums as $n) {
            if ($n === null || !is_numeric($n)) {
                continue;
            }
            $f = (float) $n;
            if (is_nan($f) || is_infinite($f)) {
                continue;
            }
            $ok[] = $f;
        }
        if ($ok === []) {
            return null;
        }

        return round(array_sum($ok), 2);
    }
}

if (!function_exists('sip_grafica_plagas_cenco')) {
    function sip_grafica_plagas_cenco(string $granja, string $campania): string
    {
        [$granja3, $campania3] = sip_grafica_normalize_granja_campania($granja, $campania, '1');

        return $granja3 . $campania3;
    }
}

if (!function_exists('sip_grafica_plagas_fec_ing')) {
    /**
     * @return array<string, string>
     */
    function sip_grafica_plagas_fec_ing(mysqli $conn, string $cenco): array
    {
        $map = cp_fec_ing_por_galpon($conn, [$cenco]);

        return isset($map[$cenco]) && is_array($map[$cenco]) ? $map[$cenco] : [];
    }
}

if (!function_exists('sip_grafica_plagas_galpon_ok')) {
    function sip_grafica_plagas_galpon_ok(string $gp, string $filtro): bool
    {
        if ($gp === '') {
            return false;
        }
        if ($filtro === '') {
            return true;
        }

        return $gp === $filtro;
    }
}

if (!function_exists('sip_grafica_plagas_gorgojos_rows')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_plagas_gorgojos_rows(mysqli $conn, string $cenco, string $fechaHasta): array
    {
        $cencoExpr = cp_sql_cenco_canon();
        $sql = "SELECT COALESCE(NULLIF(DATE(tfec_ini), '1000-01-01'), DATE(tfectra)) AS fecha_ref,
                       {$cencoExpr} AS tcencos, TRIM(tcodint) AS galpon,
                       UPPER(RIGHT(TRIM(tsexo), 1)) AS sexo_mh,
                       ROUND(AVG(IF(UPPER(TRIM(COALESCE(tnomtipo, ''))) = 'LARVA', CAST(tcantidad AS DECIMAL(18, 6)), NULL)), 2) AS prom_larva,
                       ROUND(AVG(IF(UPPER(TRIM(COALESCE(tnomtipo, ''))) = 'ADULTO', CAST(tcantidad AS DECIMAL(18, 6)), NULL)), 2) AS prom_adulto
                FROM regnocontable
                WHERE UPPER(tproceso) = 'EVA_GORGOJO'
                  AND COALESCE(NULLIF(DATE(tfec_ini), '1000-01-01'), DATE(tfectra)) <= ?
                  AND {$cencoExpr} = ?
                  AND tcodint <> '' AND tcodint REGEXP '^[0-9]+$'
                GROUP BY fecha_ref, {$cencoExpr}, galpon, sexo_mh
                HAVING sexo_mh IN ('M', 'H')
                ORDER BY fecha_ref";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        cp_bind($st, 'ss', [$fechaHasta, $cenco]);
        $st->execute();
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $rows[] = $r;
        }
        $st->close();

        return $rows;
    }
}

if (!function_exists('sip_grafica_plagas_gorgojos_rows_rango')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_plagas_gorgojos_rows_rango(mysqli $conn, string $desde, string $hasta): array
    {
        $cencoExpr = cp_sql_cenco_canon();
        $sql = "SELECT COALESCE(NULLIF(DATE(tfec_ini), '1000-01-01'), DATE(tfectra)) AS fecha_ref,
                       {$cencoExpr} AS tcencos, TRIM(tcodint) AS galpon,
                       UPPER(RIGHT(TRIM(tsexo), 1)) AS sexo_mh,
                       ROUND(AVG(IF(UPPER(TRIM(COALESCE(tnomtipo, ''))) = 'LARVA', CAST(tcantidad AS DECIMAL(18, 6)), NULL)), 2) AS prom_larva,
                       ROUND(AVG(IF(UPPER(TRIM(COALESCE(tnomtipo, ''))) = 'ADULTO', CAST(tcantidad AS DECIMAL(18, 6)), NULL)), 2) AS prom_adulto
                FROM regnocontable
                WHERE UPPER(tproceso) = 'EVA_GORGOJO'
                  AND COALESCE(NULLIF(DATE(tfec_ini), '1000-01-01'), DATE(tfectra)) BETWEEN ? AND ?
                  AND tcodint <> '' AND tcodint REGEXP '^[0-9]+$'
                  AND LEFT({$cencoExpr}, 3) NOT IN ('624','640','641')
                GROUP BY fecha_ref, {$cencoExpr}, galpon, sexo_mh
                HAVING sexo_mh IN ('M', 'H')
                ORDER BY fecha_ref";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        cp_bind($st, 'ss', [$desde, $hasta]);
        $st->execute();
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $rows[] = $r;
        }
        $st->close();

        return $rows;
    }
}

if (!function_exists('sip_grafica_plagas_plagas_rows')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_plagas_plagas_rows(mysqli $conn, string $cenco, string $fechaHasta): array
    {
        $cencoExpr = cp_sql_cenco_canon();
        $sql = "SELECT DATE(tfectra) AS fecha_ref,
                       {$cencoExpr} AS tcencos, TRIM(tcodint) AS galpon, tturno AS num_veri,
                       UPPER(TRIM(COALESCE(ttipo, ''))) AS ttipo,
                       SUM(COALESCE(tcan_rata_viva, 0) + COALESCE(tcan_raton_vivo, 0)) AS numRoedViv,
                       SUM(COALESCE(tcan_rata_muerta, 0) + COALESCE(tcan_raton_muerto, 0)) AS numRoedMue,
                       SUM(COALESCE(tcantidad, 0)) AS cantCebo,
                       MAX(ABS(COALESCE(tedad, 0))) AS baseCebo
                FROM regnocontable
                WHERE UPPER(tproceso) = 'PLAGAS'
                  AND DATE(tfectra) <= ?
                  AND {$cencoExpr} = ?
                  AND tcodint <> ''
                GROUP BY fecha_ref, {$cencoExpr}, galpon, tturno, ttipo
                ORDER BY fecha_ref";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        cp_bind($st, 'ss', [$fechaHasta, $cenco]);
        $st->execute();
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $rows[] = $r;
        }
        $st->close();

        return $rows;
    }
}

if (!function_exists('sip_grafica_plagas_plagas_rows_rango')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_plagas_plagas_rows_rango(mysqli $conn, string $desde, string $hasta): array
    {
        $cencoExpr = cp_sql_cenco_canon();
        $sql = "SELECT DATE(tfectra) AS fecha_ref,
                       {$cencoExpr} AS tcencos, TRIM(tcodint) AS galpon, tturno AS num_veri,
                       UPPER(TRIM(COALESCE(ttipo, ''))) AS ttipo,
                       SUM(COALESCE(tcan_rata_viva, 0) + COALESCE(tcan_raton_vivo, 0)) AS numRoedViv,
                       SUM(COALESCE(tcan_rata_muerta, 0) + COALESCE(tcan_raton_muerto, 0)) AS numRoedMue,
                       SUM(COALESCE(tcantidad, 0)) AS cantCebo,
                       MAX(ABS(COALESCE(tedad, 0))) AS baseCebo
                FROM regnocontable
                WHERE UPPER(tproceso) = 'PLAGAS'
                  AND DATE(tfectra) BETWEEN ? AND ?
                  AND tcodint <> ''
                  AND LEFT({$cencoExpr}, 3) NOT IN ('624','640','641')
                GROUP BY fecha_ref, {$cencoExpr}, galpon, tturno, ttipo
                ORDER BY fecha_ref";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        cp_bind($st, 'ss', [$desde, $hasta]);
        $st->execute();
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $rows[] = $r;
        }
        $st->close();

        return $rows;
    }
}

if (!function_exists('sip_grafica_plagas_ingest_gorgojos')) {
    /**
     * @param list<array<string,mixed>> $rows
     * @param array<string, array<string, string>> $fecIng
     * @return array<string, array<string, array<int, array<string, mixed>>>>
     */
    function sip_grafica_plagas_ingest_gorgojos(array $rows, array $fecIng, string $galFiltro, bool $porEval): array
    {
        $out = [];
        foreach ($rows as $row) {
            $cenco = cp_cenco_canon((string) ($row['tcencos'] ?? ''));
            $gp = cp_norm_galpon((string) ($row['galpon'] ?? ''));
            $fecRef = cp_ymd($row['fecha_ref'] ?? '');
            $sexo = strtoupper(trim((string) ($row['sexo_mh'] ?? '')));
            if ($cenco === '' || $gp === '' || $fecRef === '' || ($sexo !== 'M' && $sexo !== 'H')) {
                continue;
            }
            if (!sip_grafica_plagas_galpon_ok($gp, $galFiltro)) {
                continue;
            }
            $fi = $fecIng[$cenco][$gp] ?? '';
            $edad = $fi !== '' ? cp_edad_dia($fecRef, $fi) : 0;
            if ($edad < 1 || $edad > 47) {
                continue;
            }
            $keyN = $porEval ? cp_eval_n($edad) : $edad;
            if ($keyN <= 0) {
                continue;
            }
            if (!isset($out[$cenco][$gp][$keyN])) {
                $out[$cenco][$gp][$keyN] = [
                    'fecha' => $fecRef,
                    'larva' => [],
                    'adulto' => [],
                    'edad' => $edad,
                    'fecIng' => $fi,
                ];
            }
            $prev = (string) ($out[$cenco][$gp][$keyN]['fecha'] ?? '');
            if ($fecRef > $prev) {
                $out[$cenco][$gp][$keyN]['fecha'] = $fecRef;
                $out[$cenco][$gp][$keyN]['larva'] = [];
                $out[$cenco][$gp][$keyN]['adulto'] = [];
                $out[$cenco][$gp][$keyN]['edad'] = $edad;
            }
            if ($fecRef >= $prev) {
                $out[$cenco][$gp][$keyN]['fecha'] = $fecRef;
                $lar = $row['prom_larva'] ?? null;
                $adu = $row['prom_adulto'] ?? null;
                if ($lar !== null && $lar !== '' && is_numeric($lar)) {
                    $out[$cenco][$gp][$keyN]['larva'][$sexo] = (float) $lar;
                }
                if ($adu !== null && $adu !== '' && is_numeric($adu)) {
                    $out[$cenco][$gp][$keyN]['adulto'][$sexo] = (float) $adu;
                }
            }
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_plagas_ingest_roedores')) {
    /**
     * @param list<array<string,mixed>> $rows
     * @param array<string, array<string, string>> $fecIng
     * @return array<string, array<string, array<int, array<string, mixed>>>>
     */
    function sip_grafica_plagas_ingest_roedores(array $rows, array $fecIng, string $galFiltro, bool $porEval): array
    {
        $out = [];
        foreach ($rows as $row) {
            $cenco = cp_cenco_canon((string) ($row['tcencos'] ?? ''));
            $gp = cp_norm_galpon((string) ($row['galpon'] ?? ''));
            $fecRef = cp_ymd($row['fecha_ref'] ?? '');
            if ($cenco === '' || $gp === '' || $fecRef === '') {
                continue;
            }
            if (!sip_grafica_plagas_galpon_ok($gp, $galFiltro)) {
                continue;
            }
            $fi = $fecIng[$cenco][$gp] ?? '';
            $edad = $fi !== '' ? cp_edad_dia($fecRef, $fi) : 0;
            if ($edad < 1 || $edad > 47) {
                continue;
            }
            $keyN = $porEval ? cp_eval_n($edad) : $edad;
            if ($keyN <= 0) {
                continue;
            }
            if (!isset($out[$cenco][$gp][$keyN])) {
                $out[$cenco][$gp][$keyN] = [
                    'fecha' => $fecRef,
                    'vivos' => 0.0,
                    'muertos' => 0.0,
                    'cantP' => 0.0,
                    'baseP' => 0.0,
                    'cantT' => 0.0,
                    'baseT' => 0.0,
                    'edad' => $edad,
                    'fecIng' => $fi,
                    'has' => false,
                ];
            }
            $slot = &$out[$cenco][$gp][$keyN];
            $slot['has'] = true;
            if ($fecRef > (string) ($slot['fecha'] ?? '')) {
                $slot['fecha'] = $fecRef;
                $slot['edad'] = $edad;
            }
            $slot['vivos'] += (float) ($row['numRoedViv'] ?? 0);
            $slot['muertos'] += (float) ($row['numRoedMue'] ?? 0);
            $ttipo = strtoupper(trim((string) ($row['ttipo'] ?? '')));
            $cant = (float) ($row['cantCebo'] ?? 0);
            $base = (float) ($row['baseCebo'] ?? 0);
            if ($ttipo === 'P') {
                $slot['cantP'] += $cant;
                if ($base > $slot['baseP']) {
                    $slot['baseP'] = $base;
                }
            } elseif ($ttipo === 'T') {
                $slot['cantT'] += $cant;
                if ($base > $slot['baseT']) {
                    $slot['baseT'] = $base;
                }
            }
            unset($slot);
        }
        foreach ($out as $cencoK => $porGp) {
            foreach ($porGp as $gpK => $slots) {
                foreach ($slots as $kN => $slotFin) {
                    $p = cp_pct_cebo((float) ($slotFin['cantP'] ?? 0), (float) ($slotFin['baseP'] ?? 0));
                    $t = cp_pct_cebo((float) ($slotFin['cantT'] ?? 0), (float) ($slotFin['baseT'] ?? 0));
                    $out[$cencoK][$gpK][$kN]['perimetro'] = $p;
                    $out[$cencoK][$gpK][$kN]['techo'] = $t;
                }
            }
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_plagas_promedio_dias_gorgojos')) {
    /**
     * @param array<string, array<int, array<string, mixed>>> $porGp
     * @return array<int, array<string, mixed>>
     */
    function sip_grafica_plagas_promedio_dias_gorgojos(array $porGp): array
    {
        $byDia = [];
        foreach ($porGp as $slots) {
            foreach ($slots as $dia => $slot) {
                $d = (int) $dia;
                if (!isset($byDia[$d])) {
                    $byDia[$d] = [
                        'fecha' => (string) ($slot['fecha'] ?? ''),
                        'larvaM' => [],
                        'larvaH' => [],
                        'adultoM' => [],
                        'adultoH' => [],
                    ];
                }
                if ((string) ($slot['fecha'] ?? '') > $byDia[$d]['fecha']) {
                    $byDia[$d]['fecha'] = (string) $slot['fecha'];
                }
                if (isset($slot['larva']['M'])) {
                    $byDia[$d]['larvaM'][] = (float) $slot['larva']['M'];
                }
                if (isset($slot['larva']['H'])) {
                    $byDia[$d]['larvaH'][] = (float) $slot['larva']['H'];
                }
                if (isset($slot['adulto']['M'])) {
                    $byDia[$d]['adultoM'][] = (float) $slot['adulto']['M'];
                }
                if (isset($slot['adulto']['H'])) {
                    $byDia[$d]['adultoH'][] = (float) $slot['adulto']['H'];
                }
            }
        }
        $out = [];
        foreach ($byDia as $d => $acc) {
            $out[$d] = [
                'fecha' => $acc['fecha'],
                'larva' => [
                    'M' => sip_grafica_plagas_avg_list($acc['larvaM']),
                    'H' => sip_grafica_plagas_avg_list($acc['larvaH']),
                ],
                'adulto' => [
                    'M' => sip_grafica_plagas_avg_list($acc['adultoM']),
                    'H' => sip_grafica_plagas_avg_list($acc['adultoH']),
                ],
            ];
        }
        ksort($out, SORT_NUMERIC);

        return $out;
    }
}

if (!function_exists('sip_grafica_plagas_promedio_dias_roedores')) {
    /**
     * @param array<string, array<int, array<string, mixed>>> $porGp
     * @return array<int, array<string, mixed>>
     */
    function sip_grafica_plagas_promedio_dias_roedores(array $porGp): array
    {
        $byDia = [];
        foreach ($porGp as $slots) {
            foreach ($slots as $dia => $slot) {
                $d = (int) $dia;
                $met = cp_consumo_metricas_slot($slot);
                if (!isset($byDia[$d])) {
                    $byDia[$d] = [
                        'fecha' => (string) ($slot['fecha'] ?? ''),
                        'vivos' => [],
                        'muertos' => [],
                        'perimetro' => [],
                        'techo' => [],
                        'consumoTodos' => [],
                    ];
                }
                if ((string) ($slot['fecha'] ?? '') > $byDia[$d]['fecha']) {
                    $byDia[$d]['fecha'] = (string) $slot['fecha'];
                }
                $byDia[$d]['vivos'][] = (float) ($slot['vivos'] ?? 0);
                $byDia[$d]['muertos'][] = (float) ($slot['muertos'] ?? 0);
                if ($met['perimetro'] !== null) {
                    $byDia[$d]['perimetro'][] = (float) $met['perimetro'];
                }
                if ($met['techo'] !== null) {
                    $byDia[$d]['techo'][] = (float) $met['techo'];
                }
                if ($met['todos'] !== null) {
                    $byDia[$d]['consumoTodos'][] = (float) $met['todos'];
                }
            }
        }
        $out = [];
        foreach ($byDia as $d => $acc) {
            $out[$d] = [
                'fecha' => $acc['fecha'],
                'vivos' => sip_grafica_plagas_avg_list($acc['vivos']),
                'muertos' => sip_grafica_plagas_avg_list($acc['muertos']),
                'perimetro' => sip_grafica_plagas_avg_list($acc['perimetro']),
                'techo' => sip_grafica_plagas_avg_list($acc['techo']),
                'consumoTodos' => sip_grafica_plagas_avg_list($acc['consumoTodos']),
            ];
        }
        ksort($out, SORT_NUMERIC);

        return $out;
    }
}

if (!function_exists('sip_grafica_plagas_linea')) {
    /**
     * @param array{granja:string,campania:string,galpon?:string} $opts
     * @return array<string,mixed>
     */
    function sip_grafica_plagas_linea(mysqli $conn, string $tipo, array $opts): array
    {
        $cfg = sip_grafica_plagas_cfg($tipo);
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado'];
        }
        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = cp_norm_galpon(trim((string) ($opts['galpon'] ?? '')));
        if ($granja === '' || $campania === '') {
            return ['success' => false, 'message' => 'Faltan parametros: granja, campania'];
        }

        $cenco = sip_grafica_plagas_cenco($granja, $campania);
        $fecIngMap = cp_fec_ing_por_galpon($conn, [$cenco]);
        $fecIng = $fecIngMap;
        $fechaHasta = date('Y-m-d');
        $tipoNorm = (string) $cfg['tipo'];

        if ($tipoNorm === 'gorgojos') {
            $rows = sip_grafica_plagas_gorgojos_rows($conn, $cenco, $fechaHasta);
            $ing = sip_grafica_plagas_ingest_gorgojos($rows, $fecIng, $galpon, false);
            $porGp = $ing[$cenco] ?? [];
            if ($galpon !== '') {
                $porGp = isset($porGp[$galpon]) ? [$galpon => $porGp[$galpon]] : [];
            }
            $byDia = sip_grafica_plagas_promedio_dias_gorgojos($porGp);
            if ($byDia === []) {
                return ['success' => false, 'message' => 'Sin datos para esa combinacion'];
            }
            $fi = '';
            if ($galpon !== '' && isset($fecIng[$cenco][$galpon])) {
                $fi = (string) $fecIng[$cenco][$galpon];
            } elseif (isset($fecIng[$cenco]) && is_array($fecIng[$cenco])) {
                $vals = array_values($fecIng[$cenco]);
                sort($vals);
                $fi = (string) ($vals[0] ?? '');
            }
            $dataPorDia = [];
            foreach ($byDia as $dia => $slot) {
                $dataPorDia[] = [
                    'dia' => (int) $dia,
                    'fecha' => $slot['fecha'] !== '' ? $slot['fecha'] : sip_grafica_fecha_por_dia($fi, (int) $dia),
                    'larva' => [
                        'macho' => sip_grafica_plagas_slot_val($slot['larva']['M'] ?? null),
                        'hembra' => sip_grafica_plagas_slot_val($slot['larva']['H'] ?? null),
                    ],
                    'adulto' => [
                        'macho' => sip_grafica_plagas_slot_val($slot['adulto']['M'] ?? null),
                        'hembra' => sip_grafica_plagas_slot_val($slot['adulto']['H'] ?? null),
                    ],
                ];
            }

            return [
                'success' => true,
                'tipo' => 'gorgojos',
                'nombre' => (string) $cfg['label'],
                'metricas' => ['larva', 'adulto'],
                'dataPorDia' => $dataPorDia,
                'unidad' => '',
                'esMh' => true,
                'fechaInicio' => $fi,
                'chartType' => 'bar',
                'barMode' => 'grouped',
            ];
        }

        $rows = sip_grafica_plagas_plagas_rows($conn, $cenco, $fechaHasta);
        $ing = sip_grafica_plagas_ingest_roedores($rows, $fecIng, $galpon, false);
        $porGp = $ing[$cenco] ?? [];
        if ($galpon !== '') {
            $porGp = isset($porGp[$galpon]) ? [$galpon => $porGp[$galpon]] : [];
        }
        $byDia = sip_grafica_plagas_promedio_dias_roedores($porGp);
        if ($byDia === []) {
            return ['success' => false, 'message' => 'Sin datos para esa combinacion'];
        }
        $fi = '';
        if ($galpon !== '' && isset($fecIng[$cenco][$galpon])) {
            $fi = (string) $fecIng[$cenco][$galpon];
        } elseif (isset($fecIng[$cenco]) && is_array($fecIng[$cenco])) {
            $vals = array_values($fecIng[$cenco]);
            sort($vals);
            $fi = (string) ($vals[0] ?? '');
        }
        $dataPorDia = [];
        foreach ($byDia as $dia => $slot) {
            $dataPorDia[] = [
                'dia' => (int) $dia,
                'fecha' => $slot['fecha'] !== '' ? $slot['fecha'] : sip_grafica_fecha_por_dia($fi, (int) $dia),
                'vivos' => sip_grafica_plagas_slot_val($slot['vivos'] ?? null),
                'muertos' => sip_grafica_plagas_slot_val($slot['muertos'] ?? null),
                'perimetro' => sip_grafica_plagas_slot_val($slot['perimetro'] ?? null),
                'techo' => sip_grafica_plagas_slot_val($slot['techo'] ?? null),
                'consumoTodos' => sip_grafica_plagas_slot_val($slot['consumoTodos'] ?? null),
            ];
        }

        return [
            'success' => true,
            'tipo' => 'roedores',
            'nombre' => (string) $cfg['label'],
            'metricas' => ['vivos', 'muertos', 'perimetro', 'techo'],
            'dataPorDia' => $dataPorDia,
            'unidad' => '',
            'esMh' => false,
            'fechaInicio' => $fi,
            'chartType' => 'bar',
            'barMode' => 'grouped',
        ];
    }
}

if (!function_exists('sip_grafica_plagas_expand_rango')) {
    /**
     * @return array{0:string,1:string}
     */
    function sip_grafica_plagas_expand_rango(string $desde, string $hasta): array
    {
        $d1 = DateTime::createFromFormat('Y-m-d', $desde);
        $d2 = DateTime::createFromFormat('Y-m-d', $hasta);
        if (!$d1 || !$d2) {
            return [$desde, $hasta];
        }
        $d1->modify('-80 days');
        $d2->modify('+20 days');

        return [$d1->format('Y-m-d'), $d2->format('Y-m-d')];
    }
}

if (!function_exists('sip_grafica_plagas_acum_semanal')) {
    /**
     * @param array<string,mixed> $opts
     * @return array<string,mixed>
     */
    function sip_grafica_plagas_acum_semanal(mysqli $conn, string $tipo, array $opts): array
    {
        $cfg = sip_grafica_plagas_cfg($tipo);
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado'];
        }
        $semana = (int) ($opts['semana'] ?? 0);
        if ($semana < 1 || $semana > 10) {
            return ['success' => false, 'message' => 'Parametro semana invalido (1-10): ' . $semana];
        }
        $fechaInicio = trim((string) ($opts['fechaInicio'] ?? ''));
        $fechaFin = trim((string) ($opts['fechaFin'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaInicio) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaFin)) {
            return ['success' => false, 'message' => 'Faltan o son invalidos fechaInicio/fechaFin (YYYY-MM-DD)'];
        }
        if ($fechaInicio > $fechaFin) {
            $tmp = $fechaInicio;
            $fechaInicio = $fechaFin;
            $fechaFin = $tmp;
        }

        [$desdeExp, $hastaExp] = sip_grafica_plagas_expand_rango($fechaInicio, $fechaFin);
        $tipoNorm = (string) $cfg['tipo'];
        $base = [
            'success' => true,
            'tipo' => $tipoNorm,
            'nombre' => (string) $cfg['label'],
            'semana' => $semana,
            'periodo' => ['desde' => $fechaInicio, 'hasta' => $fechaFin],
            'unidad' => $tipoNorm === 'roedores' ? '' : '',
            'chartType' => 'bar',
            'barMode' => 'grouped',
            'esMh' => (bool) $cfg['esMh'],
            'totalRegistros' => 0,
            'registros' => [],
        ];

        $cencosTmp = [];
        $rows = $tipoNorm === 'gorgojos'
            ? sip_grafica_plagas_gorgojos_rows_rango($conn, $desdeExp, $hastaExp)
            : sip_grafica_plagas_plagas_rows_rango($conn, $desdeExp, $hastaExp);
        foreach ($rows as $r) {
            $c = cp_cenco_canon((string) ($r['tcencos'] ?? ''));
            if ($c !== '' && strlen($c) === 6) {
                $cencosTmp[$c] = true;
            }
        }
        $codigos = array_keys($cencosTmp);
        $fecIng = $codigos !== [] ? cp_fec_ing_por_galpon($conn, $codigos) : [];

        $ing = $tipoNorm === 'gorgojos'
            ? sip_grafica_plagas_ingest_gorgojos($rows, $fecIng, '', true)
            : sip_grafica_plagas_ingest_roedores($rows, $fecIng, '', true);

        $registros = [];
        foreach ($ing as $cencoKey => $porGp) {
            $cenco = cp_cenco_canon((string) $cencoKey);
            $granja3 = substr($cenco, 0, 3);
            $campania = substr($cenco, -3);
            foreach ($porGp as $gpKey => $slots) {
                $gp = (string) $gpKey;
                $slot = $slots[$semana] ?? null;
                if (!is_array($slot)) {
                    continue;
                }
                $fi = (string) ($slot['fecIng'] ?? ($fecIng[$cenco][$gp] ?? ''));
                $fechaSemana = function_exists('sip_grafica_acum_fecha_semana')
                    ? sip_grafica_acum_fecha_semana($fi, $semana)
                    : null;
                if ($fechaSemana === null || $fechaSemana < $fechaInicio || $fechaSemana > $fechaFin) {
                    continue;
                }
                $rec = [
                    'granja' => $granja3,
                    'granjaNombre' => function_exists('sip_grafica_acum_nombre_granja')
                        ? sip_grafica_acum_nombre_granja($granja3)
                        : $granja3,
                    'campania' => $campania,
                    'galpon' => (string) $gp,
                    'fechaCarga' => $fi,
                    'fechaSemana' => $fechaSemana,
                    'valorM' => null,
                    'valorH' => null,
                    'estandarM' => null,
                    'estandarH' => null,
                ];
                if ($tipoNorm === 'gorgojos') {
                    $met = cp_gorgojo_metricas($slot);
                    $lm = isset($slot['larva']['M']) ? (float) $slot['larva']['M'] : null;
                    $lh = isset($slot['larva']['H']) ? (float) $slot['larva']['H'] : null;
                    $am = isset($slot['adulto']['M']) ? (float) $slot['adulto']['M'] : null;
                    $ah = isset($slot['adulto']['H']) ? (float) $slot['adulto']['H'] : null;
                    $rec['valorM'] = sip_grafica_plagas_avg_list([$lm, $am]);
                    $rec['valorH'] = sip_grafica_plagas_avg_list([$lh, $ah]);
                    $rec['larvaM'] = $lm;
                    $rec['larvaH'] = $lh;
                    $rec['adultoM'] = $am;
                    $rec['adultoH'] = $ah;
                    $rec['todos'] = $met['todos'];
                } else {
                    $cons = cp_consumo_metricas_slot($slot);
                    $vivos = isset($slot['vivos']) ? round((float) $slot['vivos'], 2) : null;
                    $muertos = isset($slot['muertos']) ? round((float) $slot['muertos'], 2) : null;
                    $rec['vivos'] = $vivos;
                    $rec['muertos'] = $muertos;
                    $rec['perimetro'] = $cons['perimetro'];
                    $rec['techo'] = $cons['techo'];
                    $rec['consumoTodos'] = $cons['todos'];
                    $rec['valorM'] = sip_grafica_plagas_sum_list([$vivos, $muertos]);
                    $rec['valorH'] = $rec['valorM'];
                }
                $registros[] = $rec;
            }
        }

        usort($registros, static function (array $a, array $b): int {
            $cmp = strcmp((string) ($a['fechaCarga'] ?? ''), (string) ($b['fechaCarga'] ?? ''));
            if ($cmp !== 0) {
                return $cmp;
            }
            $cmp = strcmp((string) $a['granja'], (string) $b['granja']);
            if ($cmp !== 0) {
                return $cmp;
            }
            $cmp = strcmp((string) $a['campania'], (string) $b['campania']);
            if ($cmp !== 0) {
                return $cmp;
            }

            return strnatcasecmp((string) $a['galpon'], (string) $b['galpon']);
        });

        $base['totalRegistros'] = count($registros);
        $base['registros'] = $registros;

        return $base;
    }
}
