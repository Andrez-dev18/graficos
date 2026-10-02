<?php

declare(strict_types=1);

/**
 * Gráfica de medicación aplicada (bar stacked por día y medicina).
 *
 * Fuente: `movi_zonas` JOIN `mitm` (líneas 006/008, tipo transacción S003).
 * Por cada día se suma `tcantid` agrupado por medicina (`m.descri`).
 */

require_once __DIR__ . '/sip_grafica_eval_lib.php';
require_once __DIR__ . '/sip_grafica_std_lib.php';

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

if (!function_exists('sip_grafica_medicacion_fecha_inicio')) {
    /**
     * Fecha de inicio de la campaña para la combinación granja/campaña/galpón,
     * tomada como el primer movimiento registrado en `movi_zonas`.
     */
    function sip_grafica_medicacion_fecha_inicio(
        mysqli $conn,
        string $granja3,
        string $campania3,
        string $galBind,
        string $galBind2
    ): ?string {
        $sql = "SELECT MIN(DATE(mz.`tfectra`)) AS fi
                FROM `movi_zonas` mz
                WHERE LEFT(TRIM(mz.`tcencos`),3) = ?
                  AND RIGHT(TRIM(mz.`tcencos`),3) = ?
                  AND (
                       TRIM(mz.`tcodint`) = ?
                       OR CAST(TRIM(mz.`tcodint`) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )";
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $st->bind_param('ssss', $granja3, $campania3, $galBind, $galBind2);
        $st->execute();
        $rs = $st->get_result();
        $row = $rs ? $rs->fetch_assoc() : null;
        $st->close();
        $fi = $row['fi'] ?? null;
        if ($fi === null || $fi === '' || $fi === '0000-00-00') {
            return null;
        }

        return (string) $fi;
    }
}

if (!function_exists('sip_grafica_medicacion_rows')) {
    /**
     * Filas agrupadas por fecha y medicina: total de `tcantid` por día y medicina.
     *
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
        $st->bind_param($types, ...$params);
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

        $fechaInicio = sip_grafica_medicacion_fecha_inicio($conn, $granja3, $campania3, $galBind, $galBind2);

        // Orden estable de medicinas: por aparición (fecha asc, nombre asc ya viene del ORDER BY).
        $medicinas = [];
        $byFecha = [];
        foreach ($rows as $r) {
            $nombre = (string) ($r['medicina'] ?? '');
            if ($nombre === '') {
                continue;
            }
            $fecha = (string) ($r['tfectra'] ?? '');
            if ($fecha === '' || $fecha === '0000-00-00') {
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
            $byFecha[$fecha][$nombre] = sip_grafica_to_num($r['cantidad'] ?? null);
        }

        ksort($byFecha, SORT_STRING);

        $dataPorDia = [];
        foreach ($byFecha as $fecha => $cantidades) {
            $dia = 1;
            if ($fechaInicio !== null) {
                $dias = (int) ((strtotime($fecha) - strtotime($fechaInicio)) / 86400);
                $dia = $dias + 1;
                if ($dia < 1) {
                    $dia = 1;
                }
            }
            $diaItem = [
                'dia' => $dia,
                'fecha' => $fecha,
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
        ];
    }
}
