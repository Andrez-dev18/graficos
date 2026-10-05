<?php
/**
 * Motor canónico de parseo y reglas de cumplimiento
 * para HC, necropsia y resolución de parámetros.
 */

if (!function_exists('estcumpl_engine_parse_edad_dia_expr')) {
    /**
     * Expande expresiones tipo "1", "1,2,3", "1-4", mezclas "1,3-5,7".
     *
     * @return list<int>
     */
    function estcumpl_engine_parse_edad_dia_expr(string $expr): array {
        $expr = trim($expr);
        if ($expr === '') {
            return [];
        }
        $out = [];
        $parts = preg_split('/\s*,\s*/', $expr) ?: [];
        foreach ($parts as $p) {
            $p = trim((string) $p);
            if ($p === '') {
                continue;
            }
            if (preg_match('/^(\d+)\s*-\s*(\d+)$/', $p, $m)) {
                $a = (int) $m[1];
                $b = (int) $m[2];
                if ($a > $b) {
                    $t = $a;
                    $a = $b;
                    $b = $t;
                }
                for ($i = $a; $i <= $b; $i++) {
                    $out[$i] = true;
                }
            } elseif (ctype_digit($p)) {
                $out[(int) $p] = true;
            }
        }
        $keys = array_map('intval', array_keys($out));
        sort($keys, SORT_NUMERIC);

        return $keys;
    }
}

if (!function_exists('estcumpl_engine_temp_cono_infer_dia_desde_parametro')) {
    /**
     * Intenta extraer el día de medición (1–5, ~ttipo en regnocontable) del texto del parámetro del estándar.
     */
    function estcumpl_engine_temp_cono_infer_dia_desde_parametro(string $parametroRaw): ?int {
        $s = trim($parametroRaw);
        if ($s === '') {
            return null;
        }
        if (preg_match('/\bd[ií]a\s*(\d+)\b/iu', $s, $m)) {
            $n = (int) $m[1];

            return ($n >= 1 && $n <= 5) ? $n : null;
        }
        if (preg_match('/\b(\d+)\s*[º°]?\s*d[ií]a\b/iu', $s, $m)) {
            $n = (int) $m[1];

            return ($n >= 1 && $n <= 5) ? $n : null;
        }

        return null;
    }
}

if (!function_exists('estcumpl_engine_parse_cod_ref_lab')) {
    /**
     * Igual criterio que hc_lab_parse_cod_ref_parts + edad cuando hay 10+ dígitos (sin no-dígitos).
     *
     * @return array{g:string,c:string,gp:string,edad2:?int,digitLen:int}|null
     */
    function estcumpl_engine_parse_cod_ref_lab(string $codRef): ?array {
        $digits = preg_replace('/\D/', '', (string) $codRef);
        if ($digits === '') {
            return null;
        }
        $len = strlen($digits);
        if ($len >= 10) {
            $d = substr($digits, -10);
            $edad = (int) substr($d, 8, 2);

            return [
                'g' => substr($d, 0, 3),
                'c' => substr($d, 3, 3),
                'gp' => substr($d, 6, 2),
                'edad2' => $edad,
                'digitLen' => 10,
            ];
        }
        if ($len >= 8) {
            $d = substr($digits, -8);

            return [
                'g' => substr($d, 0, 3),
                'c' => substr($d, 3, 3),
                'gp' => substr($d, 6, 2),
                'edad2' => null,
                'digitLen' => 8,
            ];
        }

        return null;
    }
}

if (!function_exists('estcumpl_engine_muestra_codref_match_std_edad')) {
    /**
     * codRef 8 dígitos (sin edad en ref): no filtra por edadDiaExpr del estándar.
     * codRef 10+: la edad embebida debe pertenecer al conjunto de edadDiaExpr (vacío = sin filtro extra).
     */
    function estcumpl_engine_muestra_codref_match_std_edad(string $codRefMuestra, string $edadExprStd): bool {
        $p = estcumpl_engine_parse_cod_ref_lab($codRefMuestra);
        if ($p === null) {
            return true;
        }
        if ($p['edad2'] === null) {
            return true;
        }
        $e = trim($edadExprStd);
        if ($e === '') {
            return true;
        }
        $setVals = estcumpl_engine_parse_edad_dia_expr($e);
        if ($setVals === []) {
            return true;
        }

        return in_array((int) $p['edad2'], $setVals, true);
    }
}

if (!function_exists('estcumpl_engine_eval_std_range')) {
    /**
     * @return 'CUMPLE'|'INCUMPLE'|'SIN REGISTRO'
     */
    function estcumpl_engine_eval_std_range(?float $valor, $stdMin, $stdMax): string {
        if ($valor === null) {
            return 'SIN REGISTRO';
        }
        $okMin = ($stdMin === null) ? true : ($valor >= (float) $stdMin);
        $okMax = ($stdMax === null) ? true : ($valor <= (float) $stdMax);

        return ($okMin && $okMax) ? 'CUMPLE' : 'INCUMPLE';
    }
}

if (!function_exists('estcumpl_engine_temp_cono_dias_desde_std')) {
    /**
     * Días (ttipo) aplicables al estándar TEMP_CONO: edadDiaExpr del det, si no diaMedicion en infoOrigen, si no [] (todos en merge).
     *
     * @return list<int>
     */
    function estcumpl_engine_temp_cono_dias_desde_std(array $std): array {
        $rowExpr = trim((string) ($std['edadDiaExpr'] ?? ''));
        $dias = [];
        if ($rowExpr !== '') {
            $dias = estcumpl_engine_parse_edad_dia_expr($rowExpr);
        } else {
            $inf = [];
            if (function_exists('estcumpl_info_origen_array')) {
                $inf = estcumpl_info_origen_array($std['infoOrigen'] ?? []);
            } else {
                $raw = $std['infoOrigen'] ?? [];
                if (is_array($raw)) {
                    $inf = $raw;
                }
            }
            if (function_exists('estcumpl_temp_cono_dia_medicion_desde_inf')) {
                $d = estcumpl_temp_cono_dia_medicion_desde_inf($inf);
                if ($d !== null) {
                    $dias = [$d];
                }
            }
        }
        $nInfer = estcumpl_engine_temp_cono_infer_dia_desde_parametro((string) ($std['parametroRaw'] ?? ''));
        if ($nInfer !== null) {
            if ($dias !== []) {
                $dias = array_values(array_intersect($dias, [$nInfer]));
            } else {
                $dias = [$nInfer];
            }
        }
        $dias = array_values(array_unique(array_filter(array_map('intval', $dias), static function ($v): bool {
            return $v >= 1 && $v <= 5;
        })));
        sort($dias, SORT_NUMERIC);

        return $dias;
    }
}

if (!function_exists('estcumpl_engine_temp_cono_merge_conos_por_dias')) {
    /**
     * @param array<string,mixed> $nivelMap registros[level] incl. __tempCono
     * @param list<int> $dias si vacío, se usan todas las claves numéricas bajo __tempCono
     *
     * @return array<int,float|int>
     */
    function estcumpl_engine_temp_cono_merge_conos_por_dias(array $nivelMap, array $dias): array {
        $blob = $nivelMap['__tempCono'] ?? null;
        if (!is_array($blob)) {
            return [];
        }
        $diaKeys = $dias;
        if ($diaKeys === []) {
            foreach (array_keys($blob) as $k) {
                if (is_numeric($k)) {
                    $diaKeys[] = (int) $k;
                }
            }
            $diaKeys = array_values(array_unique($diaKeys));
            sort($diaKeys, SORT_NUMERIC);
        }
        $merged = [];
        foreach ($diaKeys as $dia) {
            $bloque = $blob[$dia] ?? $blob[(string) $dia] ?? null;
            if (!is_array($bloque)) {
                continue;
            }
            $conos = $bloque['conos'] ?? null;
            if (!is_array($conos)) {
                continue;
            }
            foreach ($conos as $ciRaw => $tv) {
                if (!is_numeric($tv)) {
                    continue;
                }
                $ci = (int) $ciRaw;
                $v = (float) $tv;
                if (!isset($merged[$ci])) {
                    $merged[$ci] = $v;
                } else {
                    $merged[$ci] = max((float) $merged[$ci], $v);
                }
            }
        }
        ksort($merged, SORT_NUMERIC);

        return $merged;
    }
}

if (!function_exists('estcumpl_engine_collect_cod_muestra_from_params_map')) {
    /**
     * Códigos de tipo de muestra (san_fact_solicitud_det.codMuestra) declarados en detalle estándar tipo muestras.
     *
     * @param array<string, list<array<string,mixed>>> $paramsMapByPathCodigo
     *
     * @return list<int>
     */
    function estcumpl_engine_collect_cod_muestra_from_params_map(array $paramsMapByPathCodigo): array {
        $s = [];
        foreach ($paramsMapByPathCodigo as $lines) {
            if (!is_array($lines)) {
                continue;
            }
            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }
                $tp = strtolower(trim((string) ($line['tipoParametro'] ?? '')));
                if ($tp !== 'muestras') {
                    continue;
                }
                $cm = (int) ($line['codTipoMuestra'] ?? 0);
                if ($cm > 0) {
                    $s[$cm] = true;
                    continue;
                }
                if (function_exists('estcumpl_info_origen_array')) {
                    $inf = estcumpl_info_origen_array($line['infoOrigen'] ?? []);
                    $cm2 = (int) ($inf['codTipoMuestra'] ?? 0);
                    if ($cm2 > 0) {
                        $s[$cm2] = true;
                    }
                }
            }
        }
        $out = array_map('intval', array_keys($s));
        sort($out, SORT_NUMERIC);

        return $out;
    }
}

if (!function_exists('estcumpl_engine_collect_cod_muestra_from_estandares_list')) {
    /**
     * Igual que collect_from_params_map pero sobre filas ya mapeadas de informe necropsia.
     *
     * @param list<array<string,mixed>> $estandares
     *
     * @return list<int>
     */
    function estcumpl_engine_collect_cod_muestra_from_estandares_list(array $estandares): array {
        $s = [];
        foreach ($estandares as $e) {
            if (!is_array($e)) {
                continue;
            }
            $tp = strtolower(trim((string) ($e['tipoParametro'] ?? '')));
            if ($tp !== 'muestras') {
                continue;
            }
            $cm = (int) ($e['codTipoMuestra'] ?? 0);
            if ($cm > 0) {
                $s[$cm] = true;
                continue;
            }
            $inf = [];
            if (function_exists('estcumpl_info_origen_array')) {
                $inf = estcumpl_info_origen_array($e['infoOrigen'] ?? []);
            }
            $cm2 = (int) ($inf['codTipoMuestra'] ?? 0);
            if ($cm2 > 0) {
                $s[$cm2] = true;
            }
        }
        $out = array_map('intval', array_keys($s));
        sort($out, SORT_NUMERIC);

        return $out;
    }
}
