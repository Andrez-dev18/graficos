<?php
/**
 * Consultas canónicas de evaluación para estándares
 * (TEMP_CONO, ACTAENTREGA, muestras/lab).
 */

require_once __DIR__ . '/sip_estandares_eval_engine.php';

if (!function_exists('estcumpl_repo_resolve_temp_cono_tipos_in_for_merge')) {
    /**
     * Días (ttipo) para filtrar regnocontable TEMP_CONO cuando no hay diaMedicion en infoOrigen.
     * - edadDiaExpr del det (si viene vacío → 1–5).
     * - Intersección con día inferido del texto del parámetro (p. ej. «día 3»).
     *
     * @return list<int> enteros 1..5; vacío si edad/param son incompatibles
     */
    function estcumpl_repo_resolve_temp_cono_tipos_in_for_merge(array $std): array {
        $expr = trim((string) ($std['edadDiaExpr'] ?? ''));
        if ($expr !== '') {
            $dias = estcumpl_engine_parse_edad_dia_expr($expr);
        } else {
            $dias = [1, 2, 3, 4, 5];
        }
        $nInfer = estcumpl_engine_temp_cono_infer_dia_desde_parametro((string) ($std['parametroRaw'] ?? ''));
        if ($nInfer !== null) {
            $dias = array_values(array_intersect($dias, [$nInfer]));
        }
        $dias = array_values(array_unique(array_filter(array_map('intval', $dias), static function (int $v): bool {
            return $v >= 1 && $v <= 5;
        })));
        sort($dias, SORT_NUMERIC);

        return $dias;
    }
}

if (!function_exists('estcumpl_repo_muestras_lab_filas_para_solicitud')) {
    /**
     * Filas de laboratorio enlazadas a una solicitud, con registro en san_analisis_pollo_bb_adulto.
     * Orden: id_analisis si existe; si no, id. Filtra por edad en codRef (10 chars) vs edadDiaExpr del estándar.
     *
     * @return list<array<string,mixed>>
     */
    function estcumpl_repo_muestras_lab_filas_para_solicitud(
        mysqli $conn,
        string $codEnvio,
        int $posSolicitud,
        int $codAnalisis,
        string $edadDiaExpr
    ): array {
        $codEnvio = trim($codEnvio);
        if ($codEnvio === '' || $posSolicitud <= 0 || $codAnalisis <= 0) {
            return [];
        }
        $chkDet = @$conn->query("SHOW TABLES LIKE 'san_fact_solicitud_det'");
        if (!$chkDet || $chkDet->num_rows === 0) {
            return [];
        }
        $chkBb = @$conn->query("SHOW TABLES LIKE 'san_analisis_pollo_bb_adulto'");
        if (!$chkBb || $chkBb->num_rows === 0) {
            return [];
        }
        $chkIa = @$conn->query("SHOW COLUMNS FROM san_analisis_pollo_bb_adulto LIKE 'id_analisis'");
        $ordSql = ($chkIa && $chkIa->num_rows > 0) ? 'a.id_analisis ASC, a.id ASC' : 'a.id ASC';
        $sql = "SELECT a.*, d.codRef AS _sol_codRef, d.codMuestra AS _sol_codMuestra
                FROM san_analisis_pollo_bb_adulto a
                INNER JOIN san_fact_solicitud_det d
                  ON d.codEnvio = a.codigo_envio
                 AND d.posSolicitud = a.posSolicitud
                 AND d.codAnalisis = a.codigo_enfermedad
                WHERE d.codEnvio = ?
                  AND d.posSolicitud = ?
                  AND d.codAnalisis = ?
                ORDER BY {$ordSql}";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $st->bind_param('sii', $codEnvio, $posSolicitud, $codAnalisis);
        if (!$st->execute()) {
            $st->close();

            return [];
        }
        $rows = [];
        $rs = @$st->get_result();
        if ($rs instanceof mysqli_result) {
            while ($row = $rs->fetch_assoc()) {
                $rows[] = $row;
            }
            $rs->free();
        } else {
            if (function_exists('estcumpl_stmt_fetch_all_assoc')) {
                $rows = estcumpl_stmt_fetch_all_assoc($st);
            }
        }
        $st->close();

        $edadExpr = trim($edadDiaExpr);
        $out = [];
        foreach ($rows as $row) {
            $ref = trim((string) ($row['_sol_codRef'] ?? ''));
            if ($ref !== '' && $edadExpr !== ''
                && function_exists('estcumpl_engine_muestra_codref_match_std_edad')
                && !estcumpl_engine_muestra_codref_match_std_edad($ref, $edadExpr)) {
                continue;
            }
            $out[] = $row;
        }

        usort($out, static function (array $a, array $b): int {
            if (isset($a['id_analisis'], $b['id_analisis'])) {
                return ((int) $a['id_analisis']) <=> ((int) $b['id_analisis']);
            }

            return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
        });

        return $out;
    }
}

if (!function_exists('estcumpl_repo_regnocontable_actaentrega_query')) {
    /**
     * Construye el SELECT base de ACTAENTREGA para merge regnocontable.
     * La capa llamadora puede añadir filtros extra (campaña/granja) y GROUP BY final.
     *
     * @param array<string,mixed> $inf infoOrigen normalizado
     * @param array{desde:string,hasta:string} $rango
     * @return array{ok:bool,reason:string,sql:string,params:list<string>,types:string,fecExpr:string}
     */
    function estcumpl_repo_regnocontable_actaentrega_query(
        mysqli $conn,
        string $tablaRegno,
        array $inf,
        array $rango
    ): array {
        $out = ['ok' => false, 'reason' => '', 'sql' => '', 'params' => [], 'types' => '', 'fecExpr' => 'DATE(tfectra)'];
        $tbl = trim($tablaRegno);
        if ($tbl === '') {
            $out['reason'] = 'tabla regnocontable vacia';
            return $out;
        }
        foreach (['tsexo', 'ttipo'] as $colReq) {
            $qCol = @$conn->query("SHOW COLUMNS FROM `{$tbl}` LIKE '" . $conn->real_escape_string($colReq) . "'");
            if (!$qCol || $qCol->num_rows <= 0) {
                $out['reason'] = 'ACTAENTREGA columna ausente: ' . $colReq;
                return $out;
            }
        }
        $ttipo = trim((string)($inf['ttipo'] ?? ''));
        $valid = [];
        for ($i = 1; $i <= 16; $i++) {
            $valid[] = str_pad((string)$i, 2, '0', STR_PAD_LEFT);
        }
        if ($ttipo === '' || !in_array($ttipo, $valid, true)) {
            $out['reason'] = 'ACTAENTREGA sin ttipo valido (' . $ttipo . ')';
            return $out;
        }
        $fecExpr = 'DATE(tfectra)';
        if (function_exists('estcumpl_regnocontable_fecha_expr')) {
            $fecExpr = estcumpl_regnocontable_fecha_expr($conn, $tbl, 'ACTAENTREGA');
        }
        $out['ok'] = true;
        $out['fecExpr'] = $fecExpr;
        /* tsexo almacena SI/NO (texto). CAST(... AS DECIMAL) devuelve 0 para SI y NO en MySQL → mapeo explícito. */
        $exprAe = 'CASE '
            . 'WHEN UPPER(TRIM(COALESCE(tsexo,\'\'))) IN (\'SI\',\'SÍ\',\'S\',\'YES\',\'Y\',\'1\',\'OK\',\'TRUE\') THEN 1 '
            . 'WHEN UPPER(TRIM(COALESCE(tsexo,\'\'))) IN (\'NO\',\'N\',\'0\',\'FALSE\') THEN 0 '
            . 'ELSE NULL END';
        $out['sql'] = "SELECT {$fecExpr} AS fecha_ref,
                           LEFT(TRIM(tcencos), 3) AS granja,
                           RIGHT(TRIM(tcencos), 3) AS campania,
                           TRIM(tcodint) AS galpon,
                           MAX({$exprAe}) AS val_agg
                    FROM `{$tbl}`
                    WHERE UPPER(TRIM(tproceso)) = ?
                      AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                      AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                      AND TRIM(COALESCE(ttipo,'')) = ?";
        $out['params'] = ['ACTAENTREGA', (string)($rango['desde'] ?? ''), (string)($rango['hasta'] ?? ''), $ttipo];
        $out['types'] = 'ssss';

        return $out;
    }
}
