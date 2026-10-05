<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_eval_lib.php';

/**
 * Proyección de pesaje (kg/ave) para días posteriores al último dato real.
 * Fuente: produccionproyecciones (datofin por sexo y edad).
 */

if (!function_exists('sip_grafica_proyeccion_tipos')) {
    /** @return list<string> */
    function sip_grafica_proyeccion_tipos(): array
    {
        return ['pesaje_pollo'];
    }
}

if (!function_exists('sip_grafica_proyeccion_soporta')) {
    function sip_grafica_proyeccion_soporta(string $tipo): bool
    {
        return in_array(strtolower(trim($tipo)), sip_grafica_proyeccion_tipos(), true);
    }
}

if (!function_exists('sip_grafica_proyeccion_num')) {
    function sip_grafica_proyeccion_num($v): ?float
    {
        if ($v === null || $v === '' || $v === '—' || $v === '-') {
            return null;
        }
        if (is_string($v)) {
            $v = str_replace(',', '.', trim($v));
        }

        return (is_numeric($v) && is_finite((float) $v)) ? (float) $v : null;
    }
}

if (!function_exists('sip_grafica_proyeccion_pares')) {
    /**
     * Pares macho/hembra por día desde dataPorDia.
     *
     * @param list<array<string,mixed>> $dataPorDia
     * @return array<int,array{M:?float,H:?float}>
     */
    function sip_grafica_proyeccion_pares(array $dataPorDia): array
    {
        $out = [];
        foreach ($dataPorDia as $r) {
            if (!is_array($r)) {
                continue;
            }
            $dia = (int) ($r['dia'] ?? 0);
            if ($dia <= 0) {
                continue;
            }
            $m = null;
            $h = null;
            if (is_array($r['macho'] ?? null)) {
                $m = sip_grafica_proyeccion_num($r['macho']['valor'] ?? null);
            }
            if (is_array($r['hembra'] ?? null)) {
                $h = sip_grafica_proyeccion_num($r['hembra']['valor'] ?? null);
            }
            $out[$dia] = ['M' => $m, 'H' => $h];
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_campania_abierta')) {
    /** Campaña sin fecha_fin registrada (permite proyectar días restantes). */
    function sip_grafica_campania_abierta(
        mysqli $conn,
        string $granja3,
        string $campania,
        string $galBind,
        string $galBind2
    ): bool {
        $sql = "SELECT DATE(`fecha_fin`) AS fecha_fin
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
            return true;
        }
        $st->bind_param('ssss', $granja3, $campania, $galBind, $galBind2);
        $st->execute();
        $rs = $st->get_result();
        $cab = $rs ? $rs->fetch_assoc() : null;
        $st->close();
        if (!$cab) {
            return true;
        }
        $ff = trim((string) ($cab['fecha_fin'] ?? ''));

        return ($ff === '' || $ff === '0000-00-00');
    }
}

if (!function_exists('sip_grafica_proyeccion_pesaje_desde_tabla')) {
    /**
     * Días proyectados (datofin) posteriores al último día con dato real.
     *
     * @param list<array<string,mixed>> $dataPorDia
     * @return list<array<string,mixed>>
     */
    function sip_grafica_proyeccion_pesaje_desde_tabla(
        mysqli $conn,
        string $granja3,
        string $campania3,
        string $galponRaw,
        array $dataPorDia,
        ?string $fechaInicio,
        string $sexoFiltro = 'ambos',
        int $maxDia = 47
    ): array {
        $real = sip_grafica_proyeccion_pares($dataPorDia);
        $ultimoDia = 0;
        foreach ($real as $dia => $par) {
            if ($par['M'] !== null || $par['H'] !== null) {
                if ($dia > $ultimoDia) {
                    $ultimoDia = $dia;
                }
            }
        }
        if ($ultimoDia <= 0 || $ultimoDia >= $maxDia) {
            return [];
        }

        $galPuro = preg_replace('/\D+/', '', $galponRaw);
        if ($galPuro === '') {
            $galPuro = trim($galponRaw);
        }
        $galVariants = [];
        if ($galPuro !== '') {
            $galVariants[] = $galPuro;
            $galPad = str_pad($galPuro, 2, '0', STR_PAD_LEFT);
            if ($galPad !== $galPuro) {
                $galVariants[] = $galPad;
            }
        }
        if ($galVariants === []) {
            return [];
        }

        $filas = [];
        $ultimoTabla = $ultimoDia;
        foreach ($galVariants as $gv) {
            $sql = 'SELECT `edad`, `sexo`, `datofin`
                    FROM `produccionproyecciones`
                    WHERE `granja` = ? AND `campana` = ? AND `galpon` = ?
                      AND `sexo` IN (\'M\', \'H\') AND `edad` > ? AND `datofin` > 0
                    ORDER BY `edad` ASC';
            $st = $conn->prepare($sql);
            if (!$st) {
                continue;
            }
            $st->bind_param('sssi', $granja3, $campania3, $gv, $ultimoDia);
            $st->execute();
            $rs = $st->get_result();
            while ($rs && ($row = $rs->fetch_assoc())) {
                $sx = strtoupper(trim((string) ($row['sexo'] ?? 'M')));
                if ($sx !== 'M' && $sx !== 'H') {
                    $sx = 'M';
                }
                $dia = (int) ($row['edad'] ?? 0);
                $v = sip_grafica_proyeccion_num($row['datofin'] ?? null);
                if ($v === null || $dia <= $ultimoDia) {
                    continue;
                }
                if ($dia > $ultimoTabla) {
                    $ultimoTabla = $dia;
                }
                if (!isset($filas[$sx])) {
                    $filas[$sx] = [];
                }
                $filas[$sx][$dia] = $v;
            }
            $st->close();
            if ($filas !== []) {
                break;
            }
        }
        if ($filas === []) {
            return [];
        }

        $hasta = min($maxDia, $ultimoTabla);
        if ($hasta <= $ultimoDia) {
            return [];
        }

        $tsFi = null;
        if (is_string($fechaInicio) && preg_match('/^\d{4}-\d{2}-\d{2}/', $fechaInicio)) {
            $tsFi = strtotime($fechaInicio);
        }

        $sexoFiltro = strtolower(trim($sexoFiltro));
        $incluirM = ($sexoFiltro !== 'hembra' && $sexoFiltro !== 'h');
        $incluirH = ($sexoFiltro !== 'macho' && $sexoFiltro !== 'm');

        $out = [];
        for ($d = $ultimoDia + 1; $d <= $hasta; $d++) {
            $m = $incluirM ? ($filas['M'][$d] ?? null) : null;
            $h = $incluirH ? ($filas['H'][$d] ?? null) : null;
            if ($m === null && $h === null) {
                continue;
            }
            $fecha = null;
            if ($tsFi !== false && $tsFi !== null) {
                $fecha = date('Y-m-d', $tsFi + ($d - 1) * 86400);
            }
            $out[] = [
                'dia' => $d,
                'fecha' => $fecha,
                'macho' => ['valor' => $m, 'proyectado' => true],
                'hembra' => ['valor' => $h, 'proyectado' => true],
            ];
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_result_adjuntar_proyeccion')) {
    /**
     * Adjunta `dataProyeccion` (opt-in) para tipos proyectables.
     *
     * @param array<string,mixed> $result
     * @param array<string,mixed> $opts granja, campania, galpon, sexo
     * @return array<string,mixed>
     */
    function sip_grafica_result_adjuntar_proyeccion(array $result, mysqli $conn, string $tipo, array $opts = []): array
    {
        if (!sip_grafica_proyeccion_soporta($tipo)) {
            return $result;
        }
        if (!($result['success'] ?? false)) {
            return $result;
        }
        if (!isset($result['dataPorDia']) || !is_array($result['dataPorDia'])) {
            return $result;
        }

        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));
        if ($granja === '' || $campania === '' || $galpon === '') {
            return $result;
        }
        if (!function_exists('sip_grafica_normalize_granja_campania')) {
            require_once __DIR__ . '/sip_grafica_std_lib.php';
        }
        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);
        $galProy = $galpon;
        if ($galProy === '' && $galBind !== '') {
            $galProy = $galBind;
        }
        if ($galProy === '' && $galBind2 !== '') {
            $galProy = $galBind2;
        }

        $fechaInicio = (string) ($result['fechaCarga'] ?? '');
        $sexo = (string) ($opts['sexo'] ?? 'ambos');
        $proy = sip_grafica_proyeccion_pesaje_desde_tabla(
            $conn,
            $granja3,
            $campania3,
            $galProy,
            $result['dataPorDia'],
            $fechaInicio !== '' ? $fechaInicio : null,
            $sexo
        );
        $result['dataProyeccion'] = $proy !== [] ? $proy : null;

        return $result;
    }
}
