<?php

declare(strict_types=1);

/**
 * Gráfica de medicación aplicada (bar stacked por día y medicina).
 * Fuente: movi_zonas JOIN mitm (líneas 006/008, tcodtra S003).
 */

require_once __DIR__ . '/sip_grafica_eval_lib.php';
require_once __DIR__ . '/sip_grafica_std_lib.php';
require_once __DIR__ . '/sip_grafica_plagas.php';

if (!function_exists('sip_grafica_medicacion_tipos')) {
    /** @return list<string> */
    function sip_grafica_medicacion_tipos(): array
    {
        return ['medicacion'];
    }
}

if (!function_exists('sip_grafica_medicacion_cfg')) {
    /**
     * @return array<string,mixed>|null
     */
    function sip_grafica_medicacion_cfg(string $tipo): ?array
    {
        static $map = [
            'medicacion' => [
                'tipo' => 'medicacion',
                'label' => 'Medicaciones',
                'unidadDefault' => 'unidades',
                'lineas' => ['006', '008'],
                'tcodtra' => 'S003',
            ],
        ];

        return $map[strtolower(trim($tipo))] ?? null;
    }
}

if (!function_exists('sip_grafica_es_medicacion')) {
    function sip_grafica_es_medicacion(string $tipo): bool
    {
        return sip_grafica_medicacion_cfg($tipo) !== null;
    }
}

if (!function_exists('sip_grafica_medicacion_rows')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_medicacion_rows(
        mysqli $conn,
        string $granja3,
        string $campania3,
        string $galBind,
        string $galBind2,
        array $lineas,
        string $tcodtra
    ): array {
        $phLin = implode(',', array_fill(0, count($lineas), '?'));
        $sql = "SELECT mz.`tfectra`, TRIM(m.`descri`) AS medicina, TRIM(m.`codigo`) AS codigo,
                       TRIM(m.`lin`) AS linea, TRIM(m.`alma`) AS almacen,
                       SUM(COALESCE(mz.`tcantid`,0)) AS cantidad
                FROM `movi_zonas` mz
                INNER JOIN `mitm` m ON mz.`tcodigo` = m.`codigo`
                WHERE m.`lin` IN ({$phLin})
                  AND TRIM(mz.`tcodtra`) = ?
                  AND LEFT(TRIM(mz.`tcencos`),3) = ?
                  AND RIGHT(TRIM(mz.`tcencos`),3) = ?
                  AND (
                       TRIM(mz.`tcodint`) = ?
                       OR CAST(TRIM(mz.`tcodint`) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )
                GROUP BY mz.`tfectra`, TRIM(m.`descri`), TRIM(m.`codigo`), TRIM(m.`lin`), TRIM(m.`alma`)
                ORDER BY mz.`tfectra` ASC, TRIM(m.`descri`) ASC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $types = str_repeat('s', count($lineas)) . 'sssss';
        $params = array_merge($lineas, [$tcodtra, $granja3, $campania3, $galBind, $galBind2]);
        $refs = [$types];
        foreach ($params as $k => $_) {
            $refs[] = &$params[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
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

if (!function_exists('sip_grafica_medicacion_rows_rango')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_medicacion_rows_rango(mysqli $conn, string $desde, string $hasta): array
    {
        $cfg = sip_grafica_medicacion_cfg('medicacion');
        if ($cfg === null) {
            return [];
        }
        $lineas = (array) ($cfg['lineas'] ?? ['006', '008']);
        $tcodtra = (string) ($cfg['tcodtra'] ?? 'S003');
        $phLin = implode(',', array_fill(0, count($lineas), '?'));
        $cencoExpr = cp_sql_cenco_canon();
        $sql = "SELECT {$cencoExpr} AS tcencos,
                       TRIM(mz.`tcodint`) AS galpon,
                       DATE(mz.`tfectra`) AS fecha_ref,
                       TRIM(m.`descri`) AS medicina,
                       SUM(COALESCE(mz.`tcantid`, 0)) AS cantidad
                FROM `movi_zonas` mz
                INNER JOIN `mitm` m ON mz.`tcodigo` = m.`codigo`
                WHERE m.`lin` IN ({$phLin})
                  AND TRIM(mz.`tcodtra`) = ?
                  AND DATE(mz.`tfectra`) BETWEEN ? AND ?
                  AND TRIM(mz.`tcodint`) <> ''
                GROUP BY {$cencoExpr}, galpon, fecha_ref, TRIM(m.`descri`)
                ORDER BY fecha_ref ASC, TRIM(m.`descri`) ASC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $types = str_repeat('s', count($lineas)) . 'sss';
        $params = array_merge($lineas, [$tcodtra, $desde, $hasta]);
        $refs = [$types];
        foreach ($params as $k => $_) {
            $refs[] = &$params[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
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

if (!function_exists('sip_grafica_medicacion_ingest_eval')) {
    /**
     * @param list<array<string,mixed>> $rows
     * @param array<string, array<string, string>> $fecIng
     * @return array<string, array<string, array<int, array<string, mixed>>>>
     */
    function sip_grafica_medicacion_ingest_eval(array $rows, array $fecIng): array
    {
        $out = [];
        foreach ($rows as $row) {
            $cenco = cp_cenco_canon((string) ($row['tcencos'] ?? ''));
            $gp = cp_norm_galpon((string) ($row['galpon'] ?? ''));
            $fecRef = cp_ymd($row['fecha_ref'] ?? '');
            $nombre = trim((string) ($row['medicina'] ?? ''));
            if ($cenco === '' || $gp === '' || $fecRef === '' || $nombre === '') {
                continue;
            }
            $fi = $fecIng[$cenco][$gp] ?? '';
            $edad = $fi !== '' ? cp_edad_dia($fecRef, $fi) : 0;
            if ($edad < 1 || $edad > 47) {
                continue;
            }
            $evalN = cp_eval_n($edad);
            if ($evalN <= 0) {
                continue;
            }
            if (!isset($out[$cenco][$gp][$evalN])) {
                $out[$cenco][$gp][$evalN] = [
                    'fecha' => $fecRef,
                    'fecIng' => $fi,
                    'medicinas' => [],
                ];
            }
            $slot = &$out[$cenco][$gp][$evalN];
            if ($fecRef > (string) ($slot['fecha'] ?? '')) {
                $slot['fecha'] = $fecRef;
            }
            if (!isset($slot['medicinas'][$nombre])) {
                $slot['medicinas'][$nombre] = 0.0;
            }
            $slot['medicinas'][$nombre] += (float) ($row['cantidad'] ?? 0);
            unset($slot);
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_medicacion_linea')) {
    /**
     * @param array{granja:string,campania:string,galpon:string} $opts
     * @return array<string,mixed>
     */
    function sip_grafica_medicacion_linea(mysqli $conn, array $opts): array
    {
        $cfg = sip_grafica_medicacion_cfg('medicacion');
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado'];
        }

        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));
        if ($granja === '' || $campania === '' || $galpon === '') {
            return ['success' => false, 'message' => 'Faltan parametros: granja, campania, galpon'];
        }

        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);

        $rows = sip_grafica_medicacion_rows(
            $conn,
            $granja3,
            $campania3,
            $galBind,
            $galBind2,
            (array) ($cfg['lineas'] ?? ['006', '008']),
            (string) ($cfg['tcodtra'] ?? 'S003')
        );
        if ($rows === []) {
            return ['success' => false, 'message' => 'Sin datos de medicación para esa combinación'];
        }

        $fechaInicio = sip_grafica_fecha_inicio_cab($conn, $granja3, $campania3, $galBind, $galBind2);

        $medicinas = [];
        $byDia = [];
        foreach ($rows as $r) {
            $nombre = (string) ($r['medicina'] ?? '');
            if ($nombre === '') {
                continue;
            }
            $fecha = cp_ymd($r['tfectra'] ?? '');
            if ($fecha === '') {
                continue;
            }
            $dia = ($fechaInicio !== null && $fechaInicio !== '')
                ? cp_edad_dia($fecha, $fechaInicio)
                : 0;
            if ($dia < 1 || $dia > 47) {
                continue;
            }
            if (!isset($medicinas[$nombre])) {
                $medicinas[$nombre] = [
                    'nombre' => $nombre,
                    'codigo' => (string) ($r['codigo'] ?? ''),
                    'linea' => (string) ($r['linea'] ?? ''),
                    'almacen' => (string) ($r['almacen'] ?? ''),
                ];
            }
            if (!isset($byDia[$dia][$nombre])) {
                $byDia[$dia][$nombre] = 0.0;
            }
            $byDia[$dia][$nombre] += sip_grafica_to_num($r['cantidad'] ?? null);
        }

        ksort($byDia, SORT_NUMERIC);

        $dataPorDia = [];
        foreach ($byDia as $dia => $cantidades) {
            $diaItem = [
                'dia' => $dia,
                'fecha' => sip_grafica_fecha_por_dia($fechaInicio, (int) $dia),
            ];
            foreach ($cantidades as $nombre => $cant) {
                $diaItem[$nombre] = ['valor' => $cant];
            }
            $dataPorDia[] = $diaItem;
        }

        return [
            'success' => true,
            'tipo' => 'medicacion',
            'nombre' => (string) $cfg['label'],
            'metricas' => array_values(array_map(static function (array $m): string {
                return (string) $m['nombre'];
            }, $medicinas)),
            'medicinas' => array_values($medicinas),
            'dataPorDia' => $dataPorDia,
            'unidad' => (string) $cfg['unidadDefault'],
            'esMh' => false,
            'fechaInicio' => $fechaInicio,
            'chartType' => 'bar',
            'barMode' => 'stacked',
        ];
    }
}

if (!function_exists('sip_grafica_medicacion_acum_semanal')) {
    /**
     * @param array<string,mixed> $opts
     * @return array<string,mixed>
     */
    function sip_grafica_medicacion_acum_semanal(mysqli $conn, array $opts): array
    {
        $cfg = sip_grafica_medicacion_cfg('medicacion');
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
        $rows = sip_grafica_medicacion_rows_rango($conn, $desdeExp, $hastaExp);
        if ($rows === []) {
            return [
                'success' => true,
                'tipo' => 'medicacion',
                'nombre' => (string) $cfg['label'],
                'semana' => $semana,
                'periodo' => ['desde' => $fechaInicio, 'hasta' => $fechaFin],
                'unidad' => (string) $cfg['unidadDefault'],
                'chartType' => 'bar',
                'barMode' => 'stacked',
                'esMh' => false,
                'metricas' => [],
                'totalRegistros' => 0,
                'registros' => [],
            ];
        }

        $cencosTmp = [];
        foreach ($rows as $r) {
            $c = cp_cenco_canon((string) ($r['tcencos'] ?? ''));
            if ($c !== '' && strlen($c) === 6) {
                $cencosTmp[$c] = true;
            }
        }
        $codigos = array_keys($cencosTmp);
        $fecIng = $codigos !== [] ? cp_fec_ing_por_galpon($conn, $codigos) : [];
        $ing = sip_grafica_medicacion_ingest_eval($rows, $fecIng);

        $medicinasSet = [];
        $registros = [];
        foreach ($ing as $cencoKey => $porGp) {
            $cenco = cp_cenco_canon((string) $cencoKey);
            $granja3 = substr($cenco, 0, 3);
            $campania = substr($cenco, -3);
            foreach ($porGp as $gpKey => $slots) {
                $gp = (string) $gpKey;
                $slot = $slots[$semana] ?? null;
                if (!is_array($slot) || ($slot['medicinas'] ?? []) === []) {
                    continue;
                }
                $fi = (string) ($slot['fecIng'] ?? ($fecIng[$cenco][$gp] ?? ''));
                $fechaSemana = function_exists('sip_grafica_acum_fecha_semana')
                    ? sip_grafica_acum_fecha_semana($fi, $semana)
                    : null;
                if ($fechaSemana === null || $fechaSemana < $fechaInicio || $fechaSemana > $fechaFin) {
                    continue;
                }
                $meds = [];
                foreach ($slot['medicinas'] as $nombre => $cant) {
                    $nombre = trim((string) $nombre);
                    if ($nombre === '') {
                        continue;
                    }
                    $meds[$nombre] = round((float) $cant, 2);
                    $medicinasSet[$nombre] = true;
                }
                if ($meds === []) {
                    continue;
                }
                $registros[] = [
                    'granja' => $granja3,
                    'granjaNombre' => function_exists('sip_grafica_acum_nombre_granja')
                        ? sip_grafica_acum_nombre_granja($granja3)
                        : $granja3,
                    'campania' => $campania,
                    'galpon' => $gp,
                    'fechaCarga' => $fi,
                    'fechaSemana' => $fechaSemana,
                    'medicinas' => $meds,
                ];
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

        $metricas = array_keys($medicinasSet);
        sort($metricas, SORT_STRING);

        return [
            'success' => true,
            'tipo' => 'medicacion',
            'nombre' => (string) $cfg['label'],
            'semana' => $semana,
            'periodo' => ['desde' => $fechaInicio, 'hasta' => $fechaFin],
            'unidad' => (string) $cfg['unidadDefault'],
            'chartType' => 'bar',
            'barMode' => 'stacked',
            'esMh' => false,
            'metricas' => $metricas,
            'totalRegistros' => count($registros),
            'registros' => $registros,
        ];
    }
}
