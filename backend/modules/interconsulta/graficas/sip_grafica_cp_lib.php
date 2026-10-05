<?php

declare(strict_types=1);

/**
 * Compatibilidad de helpers genéricos `cp_*` usados por las gráficas.
 * En sanidad se cargan desde reportes-especiales/control-plagas; esta capa
 * cubre el caso en que ese módulo no exista (build autocontenido).
 */

if (!function_exists('cp_pad3')) {
    function cp_pad3(string $v): string
    {
        return substr(str_pad(preg_replace('/\s+/', '', trim($v)) ?? '', 3, '0', STR_PAD_LEFT), -3);
    }
}

if (!function_exists('cp_cenco_canon')) {
    function cp_cenco_canon(string $raw): string
    {
        $t = preg_replace('/\s+/', '', trim($raw)) ?? '';
        if (strlen($t) >= 6) {
            return cp_pad3(substr($t, 0, 3)) . cp_pad3(substr($t, -3));
        }

        return str_pad($t, 6, '0', STR_PAD_LEFT);
    }
}

if (!function_exists('cp_ymd')) {
    function cp_ymd($v): string
    {
        $s = trim((string) $v);
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $s, $m)) {
            return $m[1];
        }

        return '';
    }
}

if (!function_exists('cp_sql_cenco_canon')) {
    function cp_sql_cenco_canon(): string
    {
        return "CONCAT(LPAD(LEFT(TRIM(tcencos), 3), 3, '0'), LPAD(RIGHT(TRIM(tcencos), 3), 3, '0'))";
    }
}

if (!function_exists('cp_norm_galpon')) {
    function cp_norm_galpon(string $gp): string
    {
        $gp = trim($gp);
        if ($gp === '' || !preg_match('/^\d+$/', $gp)) {
            return '';
        }
        $gp = ltrim($gp, '0');

        return $gp === '' ? '0' : $gp;
    }
}

if (!function_exists('cp_bind')) {
    function cp_bind(mysqli_stmt $st, string $types, array $params): bool
    {
        $refs = [$types];
        foreach ($params as $k => $_) {
            $refs[] = &$params[$k];
        }

        return (bool) call_user_func_array([$st, 'bind_param'], $refs);
    }
}

if (!function_exists('cp_promedio')) {
    /**
     * @param list<float|int|string|null> $nums
     */
    function cp_promedio(array $nums): ?float
    {
        $nums = array_values(array_filter($nums, static function ($v) {
            return is_finite((float) $v);
        }));
        if ($nums === []) {
            return null;
        }

        return array_sum($nums) / count($nums);
    }
}

if (!function_exists('cp_fmt_num')) {
    function cp_fmt_num(?float $v, int $dec = 1): ?float
    {
        if ($v === null || !is_finite($v)) {
            return null;
        }

        return round($v, $dec);
    }
}

if (!function_exists('cp_pct_cebo')) {
    function cp_pct_cebo(float $cant, float $base): ?float
    {
        if ($base <= 0) {
            return null;
        }
        $num = $cant / $base;
        if ($num >= 0 && $num <= 1) {
            $num *= 100;
        }

        return round($num, 1);
    }
}

if (!function_exists('cp_edad_dia')) {
    function cp_edad_dia(string $fecha, string $fecIng): int
    {
        if ($fecha === '' || $fecIng === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecIng)) {
            return 0;
        }
        $dt1 = new DateTime($fecha);
        $dt2 = new DateTime($fecIng);
        $edad = (int) $dt1->diff($dt2)->days + 1;
        if ($dt1 < $dt2 || $edad <= 0 || $edad > 200) {
            return 0;
        }

        return $edad;
    }
}

if (!function_exists('cp_eval_n')) {
    function cp_eval_n(int $edadDia): int
    {
        if ($edadDia <= 0) {
            return 0;
        }

        return max(1, (int) round($edadDia / 7));
    }
}

if (!function_exists('cp_fec_ing_por_galpon')) {
    /**
     * @param list<string> $codigos
     * @return array<string, array<string, string>>
     */
    function cp_fec_ing_por_galpon(mysqli $conn, array $codigos): array
    {
        $out = [];
        if ($codigos === []) {
            return $out;
        }
        $ph = implode(',', array_fill(0, count($codigos), '?'));
        $sql = "SELECT TRIM(tcencos) AS tcencos, TRIM(tcodint) AS galpon,
                       DATE_FORMAT(MIN(tfectra), '%Y-%m-%d') AS fec
                FROM movi_zonas
                WHERE tcodtra = 'E001'
                  AND tline = '001'
                  AND tcodigo IN ('P0001001', 'P0001002')
                  AND TRIM(tcencos) IN ($ph)
                  AND tfectra IS NOT NULL
                  AND tfectra > '1900-01-01'
                GROUP BY tcencos, tcodint";
        $st = $conn->prepare($sql);
        if (!$st) {
            return $out;
        }
        $types = str_repeat('s', count($codigos));
        cp_bind($st, $types, $codigos);
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $cenco = cp_cenco_canon((string) ($row['tcencos'] ?? ''));
            $gp = cp_norm_galpon((string) ($row['galpon'] ?? ''));
            $fec = cp_ymd($row['fec'] ?? '');
            if ($cenco === '' || strlen($cenco) !== 6 || $gp === '' || $fec === '') {
                continue;
            }
            $out[$cenco][$gp] = $fec;
        }
        $st->close();

        return $out;
    }
}

if (!function_exists('cp_gorgojo_metricas')) {
    /**
     * @param array<string, mixed> $slot
     * @return array{todos:?float,larvas:?float,adultos:?float}
     */
    function cp_gorgojo_metricas(array $slot): array
    {
        $larvas = [];
        $adultos = [];
        foreach (['M', 'H'] as $sx) {
            if (isset($slot['larva'][$sx]) && is_numeric($slot['larva'][$sx])) {
                $larvas[] = (float) $slot['larva'][$sx];
            }
            if (isset($slot['adulto'][$sx]) && is_numeric($slot['adulto'][$sx])) {
                $adultos[] = (float) $slot['adulto'][$sx];
            }
        }
        $pLar = cp_promedio($larvas);
        $pAdu = cp_promedio($adultos);
        $todosNums = [];
        if ($pLar !== null) {
            $todosNums[] = $pLar;
        }
        if ($pAdu !== null) {
            $todosNums[] = $pAdu;
        }

        return [
            'todos' => cp_fmt_num(cp_promedio($todosNums)),
            'larvas' => cp_fmt_num($pLar),
            'adultos' => cp_fmt_num($pAdu),
        ];
    }
}

if (!function_exists('cp_consumo_metricas_slot')) {
    /**
     * @param array<string, mixed> $slot
     * @return array{techo:?float,perimetro:?float,todos:?float}
     */
    function cp_consumo_metricas_slot(array $slot): array
    {
        $p = $slot['perimetro'] ?? null;
        $t = $slot['techo'] ?? null;
        $todos = null;
        $cant = (float) ($slot['cantP'] ?? 0) + (float) ($slot['cantT'] ?? 0);
        $base = (float) ($slot['baseP'] ?? 0) + (float) ($slot['baseT'] ?? 0);
        if ($base > 0) {
            $todos = cp_pct_cebo($cant, $base);
        } else {
            $mix = array_values(array_filter([$p, $t], static function ($v) {
                return $v !== null;
            }));
            $todos = cp_fmt_num(array_sum($mix), 1);
        }

        return [
            'techo' => $t,
            'perimetro' => $p,
            'todos' => $todos,
        ];
    }
}
