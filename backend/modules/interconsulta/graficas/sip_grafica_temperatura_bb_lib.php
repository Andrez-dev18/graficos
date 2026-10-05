<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/includes/sip_ttpbb_serie_lib.php';

if (!function_exists('sip_grafica_temperatura_bb_tipos')) {
    /** @return list<string> */
    function sip_grafica_temperatura_bb_tipos(): array
    {
        return ['temperatura_pollo_bb'];
    }
}

if (!function_exists('sip_grafica_temperatura_bb_es')) {
    function sip_grafica_temperatura_bb_es(string $tipo): bool
    {
        return in_array(strtolower(trim($tipo)), sip_grafica_temperatura_bb_tipos(), true);
    }
}

if (!function_exists('sip_grafica_temperatura_bb_cumple')) {
    function sip_grafica_temperatura_bb_cumple(?float $valor, ?float $min, ?float $max): ?bool
    {
        if ($valor === null || ($min === null && $max === null)) {
            return null;
        }
        if ($min !== null && $valor < $min) {
            return false;
        }
        if ($max !== null && $valor > $max) {
            return false;
        }

        return true;
    }
}

if (!function_exists('sip_grafica_temperatura_bb_linea')) {
    /**
     * Serie horaria de temperatura/humedad de transporte de pollo BB.
     *
     * @param array<string,mixed> $opts granja, campania, galpon, placa, fechaInicio, fechaFin
     * @return array<string,mixed>
     */
    function sip_grafica_temperatura_bb_linea(mysqli $conn, array $opts): array
    {
        $tipo = 'temperatura_pollo_bb';
        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));

        $r = sip_ttpbb_build_serie_payload($conn, [
            'idCab' => (int) ($opts['idCab'] ?? 0),
            'granja' => $granja,
            'campania' => $campania,
            'galpon' => $galpon,
            'placa' => trim((string) ($opts['placa'] ?? '')),
            'fechaInicio' => trim((string) ($opts['fechaInicio'] ?? '')),
            'fechaFin' => trim((string) ($opts['fechaFin'] ?? '')),
            'debug' => '',
        ]);
        if (empty($r['success']) || !isset($r['payload']) || !is_array($r['payload'])) {
            return [
                'success' => false,
                'tipo' => $tipo,
                'granja' => $granja,
                'campania' => $campania,
                'galpon' => $galpon,
                'message' => (string) ($r['message'] ?? 'Sin datos de temperatura para esa combinacion'),
            ];
        }

        $p = $r['payload'];
        $stdMin = isset($p['stdMin']) ? (float) $p['stdMin'] : null;
        $stdMax = isset($p['stdMax']) ? (float) $p['stdMax'] : null;
        $stdHumMin = isset($p['stdHumMin']) ? (float) $p['stdHumMin'] : null;
        $stdHumMax = isset($p['stdHumMax']) ? (float) $p['stdHumMax'] : null;

        $puntos = [];
        foreach ((array) ($p['serie'] ?? []) as $pt) {
            if (!is_array($pt)) {
                continue;
            }
            $temp = isset($pt['temp']) && $pt['temp'] !== null ? (float) $pt['temp'] : null;
            $hum = isset($pt['hum']) && $pt['hum'] !== null ? (float) $pt['hum'] : null;
            $puntos[] = [
                't' => (string) ($pt['t'] ?? ''),
                'temp' => $temp,
                'hum' => $hum,
                'cumpleTemp' => sip_grafica_temperatura_bb_cumple($temp, $stdMin, $stdMax),
                'cumpleHum' => sip_grafica_temperatura_bb_cumple($hum, $stdHumMin, $stdHumMax),
            ];
        }

        $hitos = [];
        foreach ((array) ($p['hitos'] ?? []) as $h) {
            if (!is_array($h)) {
                continue;
            }
            $ts = isset($h['ts']) ? (int) $h['ts'] : 0;
            $hitos[] = [
                'ciudad' => (string) ($h['label'] ?? ''),
                'prefix' => (string) ($h['prefix'] ?? ''),
                'hora' => (string) ($h['hora_raw'] ?? ''),
                't' => $ts > 0 ? sip_ttpbb_ts_to_iso_lima($ts) : '',
                'tempRec' => isset($h['temp_rec']) ? (float) $h['temp_rec'] : null,
                'humRec' => isset($h['hr_rec']) ? (float) $h['hr_rec'] : null,
            ];
        }

        $fechaInicio = trim((string) ($opts['fechaInicio'] ?? ''));
        $fechaFin = trim((string) ($opts['fechaFin'] ?? ''));
        if ($puntos !== []) {
            if ($fechaInicio === '') {
                $fechaInicio = substr((string) $puntos[0]['t'], 0, 10);
            }
            if ($fechaFin === '') {
                $fechaFin = substr((string) $puntos[count($puntos) - 1]['t'], 0, 10);
            }
        }

        return [
            'success' => $puntos !== [],
            'tipo' => $tipo,
            'granja' => $granja,
            'campania' => $campania,
            'galpon' => $galpon,
            'placa' => (string) ($p['placa'] ?? ''),
            'empTransporte' => (string) ($p['empTransporte'] ?? ''),
            'intervalo' => (string) ($p['intervalo'] ?? 'raw'),
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            'noDet4' => (bool) ($p['noDet4'] ?? true),
            'rawCount' => (int) ($p['rawCount'] ?? count($puntos)),
            'series' => [
                [
                    'key' => 'temperatura',
                    'label' => 'Temperatura',
                    'unidad' => '°C',
                    'campo' => 'temp',
                    'estandar' => [
                        'min' => $stdMin,
                        'max' => $stdMax,
                        'parametro' => sip_camion_tipo_cab(),
                    ],
                ],
                [
                    'key' => 'humedad',
                    'label' => 'Humedad',
                    'unidad' => '%',
                    'campo' => 'hum',
                    'estandar' => [
                        'min' => $stdHumMin,
                        'max' => $stdHumMax,
                        'parametro' => sip_camion_parametro_key_humedad(),
                    ],
                ],
            ],
            'puntos' => $puntos,
            'hitos' => $hitos,
            'chartRegions' => (array) ($p['chartRegions'] ?? []),
            'chartXMarkers' => (array) ($p['chartXMarkers'] ?? []),
        ];
    }
}
