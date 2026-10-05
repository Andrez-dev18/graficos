<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_eval_lib.php';

/**
 * Variación porcentual vs estándar (`((valor - estandar) / estandar) * 100`).
 * Solo aplica a gráficas diarias con estándar puntual (no franjas).
 */

if (!function_exists('sip_grafica_pct_tipos')) {
    /** @return list<string> */
    function sip_grafica_pct_tipos(): array
    {
        return [
            'mortalidad',
            'consumo_alimento',
            'consumo_gas',
            'consumo_agua',
            'pesaje_pollo',
            'ganancia_peso',
        ];
    }
}

if (!function_exists('sip_grafica_pct_soporta')) {
    function sip_grafica_pct_soporta(string $tipo): bool
    {
        return in_array(strtolower(trim($tipo)), sip_grafica_pct_tipos(), true);
    }
}

if (!function_exists('sip_grafica_pct_span_gaps')) {
    /** Series con días de muestreo discontinuos (pesaje/ganancia). */
    function sip_grafica_pct_span_gaps(string $tipo): bool
    {
        return in_array(strtolower(trim($tipo)), ['pesaje_pollo', 'ganancia_peso'], true);
    }
}

if (!function_exists('sip_grafica_pct_ref_std')) {
    /** Valor de referencia del estándar [min,max] según el modo de evaluación. */
    function sip_grafica_pct_ref_std(?float $min, ?float $max, string $modo): ?float
    {
        $m = sip_grafica_norm_modo_evaluacion($modo);
        if ($m === 'solo_max') {
            return $max !== null ? $max : $min;
        }
        if ($m === 'solo_min') {
            return $min !== null ? $min : $max;
        }
        if ($min !== null && $max !== null) {
            return ($min + $max) / 2.0;
        }

        return $min !== null ? $min : $max;
    }
}

if (!function_exists('sip_grafica_pct_calc')) {
    function sip_grafica_pct_calc($actual, $std): ?float
    {
        $a = sip_grafica_to_num($actual);
        $s = sip_grafica_to_num($std);
        if ($a === null || $s === null || abs($s) < 1e-12) {
            return null;
        }

        return (($a - $s) / $s) * 100.0;
    }
}

if (!function_exists('sip_grafica_pct_modo_resultado')) {
    /** @param array<string,mixed> $result */
    function sip_grafica_pct_modo_resultado(array $result, string $tipo): string
    {
        $modo = trim((string) ($result['modoEvaluacion'] ?? ''));
        if ($modo !== '') {
            return sip_grafica_norm_modo_evaluacion($modo);
        }
        if (in_array(strtolower(trim($tipo)), ['pesaje_pollo', 'ganancia_peso', 'consumo_alimento'], true)) {
            return 'solo_min';
        }

        return 'solo_max';
    }
}

if (!function_exists('sip_grafica_pct_nodo_dia')) {
    /**
     * Nodo de variación % de un sexo en un día.
     *
     * @param array<string,mixed> $diaRow
     * @return array{pct:float,cumple:?bool,valor:?float,std:?float}|null
     */
    function sip_grafica_pct_nodo_dia(array $diaRow, string $key, string $stdKey, string $modo): ?array
    {
        $nodo = $diaRow[$key] ?? null;
        if (!is_array($nodo)) {
            return null;
        }
        $stdNodo = $diaRow[$stdKey] ?? ($diaRow['estandar'] ?? null);
        $sMin = null;
        $sMax = null;
        if (is_array($stdNodo)) {
            $sMin = sip_grafica_to_num($stdNodo['min'] ?? null);
            $sMax = sip_grafica_to_num($stdNodo['max'] ?? null);
        }
        $std = sip_grafica_pct_ref_std($sMin, $sMax, $modo);
        $valor = $nodo['valor'] ?? null;
        $pct = sip_grafica_pct_calc($valor, $std);
        if ($pct === null) {
            return null;
        }
        $cumple = array_key_exists('cumple', $nodo) ? $nodo['cumple'] : null;
        if ($cumple !== null) {
            $cumple = (bool) $cumple;
        }

        return [
            'pct' => round($pct, 4),
            'cumple' => $cumple,
            'valor' => sip_grafica_to_num($valor),
            'std' => $std,
        ];
    }
}

if (!function_exists('sip_grafica_pct_data_por_dia')) {
    /**
     * Variación % por día con la forma de get_sip_grafica_data.php
     * (`{dia, fecha, macho, hembra}`).
     *
     * @param list<array<string,mixed>> $dataPorDia
     * @param array<string,mixed> $opts sexo, modoEvaluacion
     * @return array{spanGaps:bool,modoEvaluacion:string,dataPorDia:list<array<string,mixed>>}
     */
    function sip_grafica_pct_data_por_dia(array $dataPorDia, string $tipo, array $opts = []): array
    {
        $modo = sip_grafica_pct_modo_resultado(
            ['modoEvaluacion' => (string) ($opts['modoEvaluacion'] ?? '')],
            $tipo
        );
        $sexoFiltro = strtolower(trim((string) ($opts['sexo'] ?? 'ambos')));
        $campos = [
            ['key' => 'macho', 'stdKey' => 'estandarM', 'incluir' => ($sexoFiltro !== 'hembra' && $sexoFiltro !== 'h')],
            ['key' => 'hembra', 'stdKey' => 'estandarH', 'incluir' => ($sexoFiltro !== 'macho' && $sexoFiltro !== 'm')],
        ];

        $out = [];
        foreach ($dataPorDia as $diaRow) {
            if (!is_array($diaRow)) {
                continue;
            }
            $dia = (int) ($diaRow['dia'] ?? 0);
            if ($dia <= 0) {
                continue;
            }
            $fila = ['dia' => $dia];
            $fecha = trim((string) ($diaRow['fecha'] ?? ''));
            if ($fecha !== '') {
                $fila['fecha'] = $fecha;
            }
            foreach ($campos as $campo) {
                if (!$campo['incluir']) {
                    continue;
                }
                $fila[$campo['key']] = sip_grafica_pct_nodo_dia($diaRow, $campo['key'], $campo['stdKey'], $modo);
            }
            $out[] = $fila;
        }

        return [
            'spanGaps' => sip_grafica_pct_span_gaps($tipo),
            'modoEvaluacion' => $modo,
            'dataPorDia' => $out,
        ];
    }
}
