<?php
/**
 * ETL / generación snapshot HC: idempotencia INSERT … ON DUPLICATE KEY UPDATE en san_fact.
 *
 * La **resolución de valores** (infoOrigen / tipoParametro) usa **varias tablas origen** según cada
 * parámetro; eso está definido en las consultas de `sip_parametro_origen_repository.php` y en el JSON
 * de estándares, no en este archivo.
 *
 * Aquí solo se usa **regnocontable** (fecha vía `sip_param_repo_regnocontable_fecha_expr`) como
 * **heurística opcional** para listar granja/campaña/galpón con actividad en un rango cuando el cron
 * no pasa un par explícito. `movi_zonas` no se usa por el momento.
 */
declare(strict_types=1);

require_once __DIR__ . '/sip_estandares_tree_repository.php';
require_once __DIR__ . '/sip_parametro_origen_repository.php';

if (!function_exists('etl_hc_regnocontable_fecha_trabajo_expr')) {
    /**
     * Expresión SELECT/WHERE para fecha de trabajo en regnocontable (sin alias de tabla).
     */
    function etl_hc_regnocontable_fecha_trabajo_expr(mysqli $conn): ?string
    {
        $tabla = sip_param_repo_regnocontable_table($conn);

        return sip_param_repo_regnocontable_fecha_expr($conn, $tabla);
    }
}

if (!function_exists('etl_hc_seleccionar_pares_movimiento_por_fecha_trabajo')) {
    /**
     * Pares granja/campaña/galpón para **programar** generaciones en batch (cron sin filtro explícito).
     * Lee una sola tabla operativa (`sip_param_repo_regnocontable_table`) y su expresión de fecha.
     * No define el universo de “tablas origen” del negocio: eso va por parámetro en
     * `sip_parametro_origen_repository.php` al resolver la matriz.
     *
     * @return list<array{granja:string,campania:string,galpon:string}>
     */
    function etl_hc_seleccionar_pares_movimiento_por_fecha_trabajo(
        mysqli $conn,
        string $desde,
        string $hasta,
        ?string $granja3Filter = null,
        ?string $camp3Filter = null
    ): array {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
            return [];
        }
        $out = [];
        $keySeen = [];

        $tablaR = sip_param_repo_regnocontable_table($conn);
        $fe = etl_hc_regnocontable_fecha_trabajo_expr($conn);
        if ($fe !== null && sip_est2_repo_table_exists($conn, $tablaR)) {
            $sqlR = "SELECT DISTINCT
                        LEFT(TRIM(`tcencos`), 3) AS `granja`,
                        RIGHT(TRIM(`tcencos`), 3) AS `campania`,
                        TRIM(`tcodint`) AS `galpon`
                    FROM `{$tablaR}`
                    WHERE CAST(({$fe}) AS DATE) >= ?
                      AND CAST(({$fe}) AS DATE) <= ?
                      AND TRIM(`tcencos`) <> ''
                      AND TRIM(`tcodint`) <> ''";
            $typesR = 'ss';
            $bindR = [$desde, $hasta];
            if ($granja3Filter !== null && $granja3Filter !== '') {
                $sqlR .= ' AND LEFT(TRIM(`tcencos`), 3) = ?';
                $typesR .= 's';
                $bindR[] = substr(str_pad(trim($granja3Filter), 3, '0', STR_PAD_LEFT), 0, 3);
            }
            if ($camp3Filter !== null && $camp3Filter !== '') {
                $sqlR .= ' AND RIGHT(TRIM(`tcencos`), 3) = ?';
                $typesR .= 's';
                $bindR[] = substr(str_pad(trim($camp3Filter), 3, '0', STR_PAD_LEFT), -3);
            }
            $stR = $conn->prepare($sqlR);
            if ($stR) {
                $refsR = [];
                $refsR[] = &$typesR;
                foreach ($bindR as $k => $_) {
                    $refsR[] = &$bindR[$k];
                }
                call_user_func_array([$stR, 'bind_param'], $refsR);
                $stR->execute();
                $rsR = $stR->get_result();
                while ($rsR && ($row = $rsR->fetch_assoc())) {
                    $g = trim((string) ($row['granja'] ?? ''));
                    $c = trim((string) ($row['campania'] ?? ''));
                    $gp = trim((string) ($row['galpon'] ?? ''));
                    if ($g === '' || $c === '' || $gp === '') {
                        continue;
                    }
                    $k = $g . "\x1e" . $c . "\x1e" . $gp;
                    if (!isset($keySeen[$k])) {
                        $keySeen[$k] = true;
                        $out[] = ['granja' => $g, 'campania' => $c, 'galpon' => $gp];
                    }
                }
                $stR->close();
            }
        }

        return $out;
    }
}

if (!function_exists('etl_hc_seleccionar_granja_campania_unicos')) {
    /**
     * @param list<array{granja:string,campania:string,galpon:string}> $pares
     * @return list<array{granja:string,campania:string}>
     */
    function etl_hc_seleccionar_granja_campania_unicos(array $pares): array
    {
        $seen = [];
        $out = [];
        foreach ($pares as $p) {
            $g = trim((string) ($p['granja'] ?? ''));
            $c = trim((string) ($p['campania'] ?? ''));
            if ($g === '' || $c === '') {
                continue;
            }
            $k = $g . "\x1e" . $c;
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $out[] = ['granja' => $g, 'campania' => $c];
        }

        return $out;
    }
}

if (!function_exists('etl_hc_ejecutar_generacion_hc')) {
    /**
     * Por cada granja+campaña: resuelve la matriz HC como la vista viva (infoOrigen / tipoParametro /
     * `hc_build_matriz_programas_new`) y persiste cab+det en san_fact (`hc_fact_persist_from_built`).
     * Al filtrar en el dashboard solo se leen san_fact_historia_clinica_cab y det.
     *
     * @param array{granja?:string,campania?:string}|null $filtroOpcional limita la consulta heurística de pares
     *        (regnocontable) o, si vienen ambos, modo dashboard: solo ese par sin barrer tablas
     * @return array{ok:bool,message:string,stats:array<string,int|list<int>>,cabIds:list<int>}
     */
    function etl_hc_ejecutar_generacion_hc(
        mysqli $conn,
        string $fechaTrabajoDesde,
        string $fechaTrabajoHasta,
        string $userId,
        ?array $filtroOpcional = null
    ): array {
        @set_time_limit(0);
        $root = dirname(__DIR__);
        $hcFact = $root . DIRECTORY_SEPARATOR . 'modules' . DIRECTORY_SEPARATOR . 'sip' . DIRECTORY_SEPARATOR
            . 'historia-clinica' . DIRECTORY_SEPARATOR . 'hc_fact_snapshot_lib.php';
        $hcMatriz = $root . DIRECTORY_SEPARATOR . 'modules' . DIRECTORY_SEPARATOR . 'sip' . DIRECTORY_SEPARATOR
            . 'historia-clinica' . DIRECTORY_SEPARATOR . 'hc_matriz_builder.php';
        $hcLayout = $root . DIRECTORY_SEPARATOR . 'modules' . DIRECTORY_SEPARATOR . 'sip' . DIRECTORY_SEPARATOR
            . 'historia-clinica' . DIRECTORY_SEPARATOR . 'hc_matriz_layout_db_lib.php';
        if (!is_file($hcFact) || !is_file($hcMatriz) || !is_file($hcLayout)) {
            return ['ok' => false, 'message' => 'Módulos HC (snapshot/matriz/layout) no encontrados', 'stats' => [], 'cabIds' => []];
        }
        require_once $hcFact;
        require_once $hcMatriz;
        require_once $hcLayout;
        if (!function_exists('hc_fact_tables_ready') || !hc_fact_tables_ready($conn)) {
            return ['ok' => false, 'message' => 'Tablas san_fact_historia_clinica_* no disponibles', 'stats' => [], 'cabIds' => []];
        }
        if (!function_exists('hc_fact_persist_from_built') || !function_exists('hc_build_matriz_programas_new')) {
            return ['ok' => false, 'message' => 'hc_fact_persist_from_built / hc_build_matriz_programas_new no disponibles', 'stats' => [], 'cabIds' => []];
        }

        $gf = null;
        $cf = null;
        if (is_array($filtroOpcional)) {
            $g0 = trim((string) ($filtroOpcional['granja'] ?? ''));
            $c0 = trim((string) ($filtroOpcional['campania'] ?? ''));
            if ($g0 !== '') {
                $gf = substr(str_pad($g0, 3, '0', STR_PAD_LEFT), 0, 3);
            }
            if ($c0 !== '') {
                $cf = substr(str_pad(preg_replace('/\s+/', '', $c0), 3, '0', STR_PAD_LEFT), -3);
            }
        }

        /**
         * Dashboard (POST con granja+campaña): solo ese par — no se barre regnocontable para listar pares.
         * Cron sin filtro: pares vía heurística regnocontable en rango (ver doc de
         * `etl_hc_seleccionar_pares_movimiento_por_fecha_trabajo`; no sustituye tablas origen por parámetro).
         */
        $soloParDesdeDashboard = ($gf !== null && $cf !== null && $gf !== '' && $cf !== '');
        $forcedFromUi = false;
        if ($soloParDesdeDashboard) {
            $pares = [];
            $unicos = [['granja' => $gf, 'campania' => $cf]];
        } else {
            $pares = etl_hc_seleccionar_pares_movimiento_por_fecha_trabajo($conn, $fechaTrabajoDesde, $fechaTrabajoHasta, $gf, $cf);
            $unicos = etl_hc_seleccionar_granja_campania_unicos($pares);
            if ($gf !== null && $cf !== null && $gf !== '' && $cf !== '') {
                $pairKey = $gf . "\x1e" . $cf;
                $seenGc = [];
                foreach ($unicos as $u) {
                    $seenGc[$u['granja'] . "\x1e" . $u['campania']] = true;
                }
                if (!isset($seenGc[$pairKey])) {
                    $unicos[] = ['granja' => $gf, 'campania' => $cf];
                    $forcedFromUi = true;
                }
            }
        }

        if ($unicos === []) {
            return [
                'ok' => true,
                'message' => 'Sin pares granja/campaña con movimiento en el rango (fecha de trabajo).',
                'stats' => [
                    'paresMovimiento' => count($pares),
                    'cabecerasUpsert' => 0,
                    'matricesResueltasPersistidas' => 0,
                ],
                'cabIds' => [],
            ];
        }

        $cabIds = [];
        $matrizLayout = function_exists('hc_matriz_layout_global_leer') ? hc_matriz_layout_global_leer($conn) : null;
        $labDesde = $fechaTrabajoDesde;
        $labHasta = $fechaTrabajoHasta;
        $fechaCronoYmd = $labHasta;

        $conn->begin_transaction();
        try {
            foreach ($unicos as $gc) {
                $gRaw = trim((string) ($gc['granja'] ?? ''));
                $cRaw = trim((string) ($gc['campania'] ?? ''));
                if ($gRaw === '' || $cRaw === '') {
                    continue;
                }
                $g = substr(str_pad($gRaw, 3, '0', STR_PAD_LEFT), 0, 3);
                $c = substr(str_pad(preg_replace('/\s+/', '', $cRaw), 3, '0', STR_PAD_LEFT), -3);
                $built = hc_build_matriz_programas_new(
                    $conn,
                    $g,
                    $c,
                    $fechaCronoYmd,
                    $labDesde,
                    $labHasta,
                    $matrizLayout,
                    false,
                    [],
                    false,
                    true,
                    true
                );
                $cabId = hc_fact_persist_from_built($conn, $g, $c, $built, [
                    'labDesde' => $labDesde,
                    'labHasta' => $labHasta,
                    'fechaCrono' => $fechaCronoYmd,
                ], $userId);
                if ($cabId > 0) {
                    $cabIds[] = $cabId;
                }
            }
            $conn->commit();
        } catch (Throwable $e) {
            $conn->rollback();

            return [
                'ok' => false,
                'message' => $e->getMessage(),
                'stats' => [],
                'cabIds' => [],
            ];
        }

        return [
            'ok' => true,
            'message' => 'Generación HC completada.',
            'stats' => [
                'paresMovimiento' => count($pares),
                'granjaCampaniaUnicos' => count($unicos),
                'cabecerasUpsert' => count(array_unique($cabIds)),
                'matricesResueltasPersistidas' => count(array_unique($cabIds)),
                'forcedPairSinMovimiento' => $forcedFromUi,
                'soloParDashboard' => $soloParDesdeDashboard,
            ],
            'cabIds' => array_values(array_unique($cabIds)),
        ];
    }
}
