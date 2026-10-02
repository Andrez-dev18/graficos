<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_pesaje_lib.php';
require_once __DIR__ . '/sip_grafica_acum_lote_live_lib.php';
require_once __DIR__ . '/sip_grafica_acumulado_semanal_lib.php';
require_once __DIR__ . '/sip_grafica_peso_cloro.php';

if (!function_exists('sip_grafica_ganancia_sem_desde_tedad')) {
    /** Semana ETL: CEIL((tedad - 1) / 7). */
    function sip_grafica_ganancia_sem_desde_tedad(int $tedad): int
    {
        if ($tedad <= 0) {
            return 0;
        }

        return (int) ceil(($tedad - 1) / 7);
    }
}

if (!function_exists('sip_grafica_ganancia_calc_valor')) {
    function sip_grafica_ganancia_calc_valor(?float $cur, ?float $prev): ?float
    {
        if ($cur === null || $prev === null || !is_finite($cur) || !is_finite($prev)) {
            return null;
        }

        return round((($cur - $prev) / 7) * 1000, 2);
    }
}

if (!function_exists('sip_grafica_ganancia_peso_promedio_from_pairs')) {
    /** @param list<array{0:float,1:float}> $pairs */
    function sip_grafica_ganancia_peso_promedio_from_pairs(array $pairs): ?float
    {
        return sip_grafica_pesaje_promedio_from_pairs($pairs);
    }
}

if (!function_exists('sip_grafica_ganancia_peso_en_tedad_exacta')) {
    /**
     * Peso M/H en una tedad exacta de muestreoaves.
     *
     * @return array{m:?float,h:?float}
     */
    function sip_grafica_ganancia_peso_en_tedad_exacta(
        mysqli $conn,
        string $tcencos,
        string $galBind,
        string $galBind2,
        int $tedad
    ): array {
        if (!sip_grafica_table_exists($conn, 'muestreoaves')) {
            return ['m' => null, 'h' => null];
        }

        $sql = "SELECT TRIM(a.`tsexo`) AS tsexo, a.`tpeso`, a.`tcantid`
                FROM `muestreoaves` a
                WHERE TRIM(a.`tcencos`) = ?
                  AND (
                        TRIM(a.`tcodint`) = ?
                        OR CAST(TRIM(a.`tcodint`) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )
                  AND CAST(a.`tedad` AS SIGNED) = ?
                  AND a.`tpeso` IS NOT NULL
                  AND a.`tcantid` IS NOT NULL
                  AND a.`tcantid` > 0";

        $st = $conn->prepare($sql);
        if (!$st) {
            return ['m' => null, 'h' => null];
        }
        $st->bind_param('sssi', $tcencos, $galBind, $galBind2, $tedad);
        $st->execute();
        $rs = $st->get_result();

        $pairs = ['M' => [], 'H' => []];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $sexo = strtoupper(trim((string) ($r['tsexo'] ?? '')));
            if ($sexo !== 'M' && $sexo !== 'H') {
                continue;
            }
            $peso = (float) ($r['tpeso'] ?? 0);
            $cant = (float) ($r['tcantid'] ?? 0);
            if ($cant <= 0 || !is_finite($peso)) {
                continue;
            }
            $pairs[$sexo][] = [$peso, $cant];
        }
        $st->close();

        return [
            'm' => sip_grafica_ganancia_peso_promedio_from_pairs($pairs['M']),
            'h' => sip_grafica_ganancia_peso_promedio_from_pairs($pairs['H']),
        ];
    }
}

if (!function_exists('sip_grafica_ganancia_peso_en_sem')) {
    /**
     * Peso M/H agregado por semana ETL (todas las tedad de esa semana).
     *
     * @return array{m:?float,h:?float}
     */
    function sip_grafica_ganancia_peso_en_sem(
        mysqli $conn,
        string $tcencos,
        string $galBind,
        string $galBind2,
        int $sem
    ): array {
        if ($sem < 0 || !sip_grafica_table_exists($conn, 'muestreoaves')) {
            return ['m' => null, 'h' => null];
        }

        $sql = "SELECT TRIM(a.`tsexo`) AS tsexo, a.`tpeso`, a.`tcantid`
                FROM `muestreoaves` a
                WHERE TRIM(a.`tcencos`) = ?
                  AND (
                        TRIM(a.`tcodint`) = ?
                        OR CAST(TRIM(a.`tcodint`) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )
                  AND CEIL((CAST(a.`tedad` AS SIGNED) - 1) / 7) = ?
                  AND a.`tpeso` IS NOT NULL
                  AND a.`tcantid` IS NOT NULL
                  AND a.`tcantid` > 0";

        $st = $conn->prepare($sql);
        if (!$st) {
            return ['m' => null, 'h' => null];
        }
        $st->bind_param('sssi', $tcencos, $galBind, $galBind2, $sem);
        $st->execute();
        $rs = $st->get_result();

        $pairs = ['M' => [], 'H' => []];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $sexo = strtoupper(trim((string) ($r['tsexo'] ?? '')));
            if ($sexo !== 'M' && $sexo !== 'H') {
                continue;
            }
            $peso = (float) ($r['tpeso'] ?? 0);
            $cant = (float) ($r['tcantid'] ?? 0);
            if ($cant <= 0 || !is_finite($peso)) {
                continue;
            }
            $pairs[$sexo][] = [$peso, $cant];
        }
        $st->close();

        return [
            'm' => sip_grafica_ganancia_peso_promedio_from_pairs($pairs['M']),
            'h' => sip_grafica_ganancia_peso_promedio_from_pairs($pairs['H']),
        ];
    }
}

if (!function_exists('sip_grafica_ganancia_peso_inicial')) {
    /**
     * Peso inicial M/H desde movi_zonas (E001) o muestreo tedad 0.
     *
     * @return array{m:?float,h:?float}
     */
    function sip_grafica_ganancia_peso_inicial(
        mysqli $conn,
        string $tcencos,
        string $galBind,
        string $galBind2
    ): array {
        $out = ['m' => null, 'h' => null];

        if (sip_grafica_table_exists($conn, 'movi_zonas')) {
            $sql = "SELECT
                        ROUND(SUM(IF(a.`tcodigo` = 'P0001001', a.`tpeso`, 0)), 3) AS pes_macho,
                        ROUND(SUM(IF(a.`tcodigo` = 'P0001002', a.`tpeso`, 0)), 3) AS pes_hembra
                    FROM `movi_zonas` a
                    WHERE TRIM(a.`tcencos`) = ?
                      AND (
                            TRIM(a.`tcodint`) = ?
                            OR CAST(TRIM(a.`tcodint`) AS UNSIGNED) = CAST(? AS UNSIGNED)
                      )
                      AND a.`tcodtra` = 'E001'
                      AND a.`tline` = '001'";

            $st = $conn->prepare($sql);
            if ($st) {
                $st->bind_param('sss', $tcencos, $galBind, $galBind2);
                $st->execute();
                $rs = $st->get_result();
                if ($rs && ($r = $rs->fetch_assoc())) {
                    $pm = (float) ($r['pes_macho'] ?? 0);
                    $ph = (float) ($r['pes_hembra'] ?? 0);
                    if ($pm > 0) {
                        $out['m'] = $pm;
                    }
                    if ($ph > 0) {
                        $out['h'] = $ph;
                    }
                }
                $st->close();
            }
        }

        $muestreo0 = sip_grafica_ganancia_peso_en_tedad_exacta($conn, $tcencos, $galBind, $galBind2, 0);
        if ($out['m'] === null && $muestreo0['m'] !== null) {
            $out['m'] = $muestreo0['m'];
        }
        if ($out['h'] === null && $muestreo0['h'] !== null) {
            $out['h'] = $muestreo0['h'];
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_ganancia_peso_calc_tedad')) {
    /**
     * Ganancia M/H en g/día para una tedad canónica (misma fórmula que etl_11).
     *
     * @return array{m:?float,h:?float,semana:int}
     */
    function sip_grafica_ganancia_peso_calc_tedad(
        mysqli $conn,
        string $tcencos,
        string $galBind,
        string $galBind2,
        int $tedad
    ): array {
        if ($tedad <= 0) {
            return ['m' => null, 'h' => null, 'semana' => 0];
        }

        $sem = sip_grafica_ganancia_sem_desde_tedad($tedad);
        $cur = sip_grafica_ganancia_peso_en_tedad_exacta($conn, $tcencos, $galBind, $galBind2, $tedad);

        if ($sem <= 1) {
            $prev = sip_grafica_ganancia_peso_inicial($conn, $tcencos, $galBind, $galBind2);
        } else {
            $prev = sip_grafica_ganancia_peso_en_sem($conn, $tcencos, $galBind, $galBind2, $sem - 1);
        }

        return [
            'm' => sip_grafica_ganancia_calc_valor($cur['m'], $prev['m']),
            'h' => sip_grafica_ganancia_calc_valor($cur['h'], $prev['h']),
            'semana' => $sem,
        ];
    }
}

if (!function_exists('sip_grafica_ganancia_std_edad')) {
    function sip_grafica_ganancia_std_edad(int $diaApi, int $tedad): int
    {
        $semCat = sip_grafica_pesaje_dia_semana_catalogo($diaApi);
        if ($semCat !== null && $semCat > 0) {
            return ($semCat * 7) + 1;
        }

        return $tedad > 0 ? $tedad : 1;
    }
}

if (!function_exists('sip_grafica_ganancia_linea')) {
    /**
     * Línea de ganancia de peso desde muestreoaves (no san_fact).
     *
     * @param array{granja:string,campania:string,galpon:string} $opts
     * @return array<string,mixed>
     */
    function sip_grafica_ganancia_linea(mysqli $conn, array $opts): array
    {
        $cfg = sip_grafica_peso_cloro_cfg('ganancia_peso');
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado: ganancia_peso'];
        }

        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));
        if ($granja === '' || $campania === '' || $galpon === '') {
            return ['success' => false, 'message' => 'Faltan parametros: granja, campania, galpon'];
        }

        if (!sip_grafica_acum_muestreo_tablas_disponibles($conn)) {
            return ['success' => false, 'message' => 'Tabla muestreoaves no disponible'];
        }

        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);
        $tcencos = $granja3 . $campania3;
        $tk = (string) $cfg['tareaKey'];
        $pkDefault = (string) $cfg['parametroKey'];
        $modoEval = (string) $cfg['modoEvaluacion'];
        $unidad = (string) $cfg['unidadDefault'];
        $stdMap = sip_grafica_std_map_desde_san_estandares($conn);
        $fechaInicio = sip_grafica_fecha_inicio_cab($conn, $granja3, $campania3, $galBind, $galBind2);

        $dataPorDia = [];
        $tieneDatos = false;

        foreach (sip_grafica_pesaje_tedades_canonicas() as $tedad) {
            if ($tedad <= 0) {
                continue;
            }
            $diaApi = sip_grafica_pesaje_tedad_a_dia_api($tedad);
            $gan = sip_grafica_ganancia_peso_calc_tedad($conn, $tcencos, $galBind, $galBind2, $tedad);
            $semCat = sip_grafica_pesaje_dia_semana_catalogo($diaApi);
            $edadStd = sip_grafica_ganancia_std_edad($diaApi, $tedad);

            [$sMin, $sMax, $uMap] = sip_grafica_std_rango_desde_map($stdMap, $tk, $pkDefault, $edadStd);
            if ($uMap !== '—' && !preg_match('/^\d/', $uMap)) {
                $unidad = $uMap;
            }

            $vm = $gan['m'];
            $vh = $gan['h'];
            $vmOk = ($vm !== null && is_finite($vm));
            $vhOk = ($vh !== null && is_finite($vh));
            if ($vmOk || $vhOk) {
                $tieneDatos = true;
            }

            $refStd = $sMin ?? $sMax;
            $dataPorDia[] = [
                'dia' => $diaApi,
                'semana' => $semCat,
                'fecha' => sip_grafica_pesaje_fecha_por_tedad($fechaInicio, $tedad),
                'estandar' => [
                    'min' => $sMin ?? $sMax,
                    'max' => $sMax ?? $sMin,
                ],
                'macho' => [
                    'valor' => $vmOk ? $vm : null,
                    'cumple' => $vmOk ? sip_grafica_eval_range($vm, $refStd, null, 'solo_min') : null,
                ],
                'hembra' => [
                    'valor' => $vhOk ? $vh : null,
                    'cumple' => $vhOk ? sip_grafica_eval_range($vh, $refStd, null, 'solo_min') : null,
                ],
            ];
        }

        if (!$tieneDatos) {
            return ['success' => false, 'message' => 'Sin datos de ganancia para esa combinacion'];
        }

        return [
            'success' => true,
            'fechaCarga' => $fechaInicio,
            'dataPorDia' => $dataPorDia,
            'unidad' => $unidad,
            'esMh' => true,
            'modoEvaluacion' => $modoEval,
            'tareaKey' => $tk,
            'tipo' => 'ganancia_peso',
            'nombre' => (string) ($cfg['label'] ?? 'Ganancia de peso'),
        ];
    }
}

if (!function_exists('sip_grafica_acum_ganancia_build')) {
    /**
     * Ganancia de peso horizontal desde muestreoaves por día canónico.
     *
     * @param array<string,mixed> $opts
     * @return array<string,mixed>
     */
    function sip_grafica_acum_ganancia_build(mysqli $conn, array $opts): array
    {
        $fechaInicio = trim((string) ($opts['fechaInicio'] ?? ''));
        $fechaFin = trim((string) ($opts['fechaFin'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaInicio) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaFin)) {
            return ['success' => false, 'message' => 'Faltan o son invalidos fechaInicio/fechaFin (YYYY-MM-DD)'];
        }
        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        if (!sip_grafica_acum_muestreo_tablas_disponibles($conn)) {
            return ['success' => false, 'message' => 'Tabla muestreoaves no disponible'];
        }

        $cfg = sip_grafica_peso_cloro_cfg('ganancia_peso');
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado: ganancia_peso'];
        }

        $dia = (int) ($opts['dia'] ?? 1);
        $tedad = (int) ($opts['tedad'] ?? sip_grafica_pesaje_dia_api_a_tedad($dia));
        $diasPermitidos = sip_grafica_pesaje_dias_permitidos_tipo('ganancia_peso');
        if (!sip_grafica_pesaje_dia_valido_tipo('ganancia_peso', $dia)) {
            return [
                'success' => false,
                'message' => 'Parametro dia invalido para ganancia_peso. Valores permitidos: '
                    . implode(', ', $diasPermitidos),
            ];
        }

        $combos = sip_grafica_acum_pesaje_combos_periodo($conn, $fechaInicio, $fechaFin, $tedad);
        $stdMap = sip_grafica_std_map_desde_san_estandares($conn);
        $tk = (string) $cfg['tareaKey'];
        $pk = (string) $cfg['parametroKey'];
        $edadStd = sip_grafica_ganancia_std_edad($dia, $tedad);
        [$sMin, $sMax] = sip_grafica_std_rango_desde_map($stdMap, $tk, $pk, $edadStd);
        $std = ['m' => $sMin ?? $sMax, 'h' => $sMax ?? $sMin];
        $semCat = sip_grafica_pesaje_dia_semana_catalogo($dia);

        $registros = [];
        foreach ($combos as $combo) {
            $tcencos = $combo['granja'] . $combo['campania'];
            $gp = (string) $combo['galpon'];
            $gan = sip_grafica_ganancia_peso_calc_tedad($conn, $tcencos, $gp, $gp, $tedad);
            $fechaCarga = $combo['fechaCarga'] !== '' ? $combo['fechaCarga'] : null;
            $fechaPesaje = sip_grafica_acum_fecha_por_edad($combo['fechaInicio'], $tedad);
            $registros[] = [
                'granja' => $combo['granja'],
                'granjaNombre' => sip_grafica_acum_nombre_granja($combo['granja']),
                'campania' => $combo['campania'],
                'galpon' => $combo['galpon'],
                'fechaCarga' => $fechaCarga,
                'fechaSemana' => $fechaPesaje,
                'valorM' => $gan['m'],
                'valorH' => $gan['h'],
                'estandarM' => $std['m'],
                'estandarH' => $std['h'],
                'dia' => $dia,
                'semana' => $semCat,
            ];
        }

        return [
            'success' => true,
            'tipo' => 'ganancia_peso',
            'nombre' => (string) $cfg['label'],
            'dia' => $dia,
            'semana' => $semCat,
            'periodo' => ['desde' => $fechaInicio, 'hasta' => $fechaFin],
            'unidad' => (string) $cfg['unidad'],
            'totalRegistros' => count($registros),
            'registros' => $registros,
        ];
    }
}
