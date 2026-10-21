<?php

class EmpresaChartHelper
{
    private static $meses = [
        1 => 'Enero',
        2 => 'Febrero',
        3 => 'Marzo',
        4 => 'Abril',
        5 => 'Mayo',
        6 => 'Junio',
        7 => 'Julio',
        8 => 'Agosto',
        9 => 'Septiembre',
        10 => 'Octubre',
        11 => 'Noviembre',
        12 => 'Diciembre'
    ];

    public static function rangoAnio(string $anio): array
    {
        return [
            $anio . '-01-01',
            ((int)$anio + 1) . '-01-01'
        ];
    }

    public static function nombreMes(int $mes): string
    {
        return self::$meses[$mes] ?? '';
    }

    public static function normalizarMeses($valor, array $disponibles): array
    {
        if ($valor === null) {
            return array_values(array_map(function ($item) {
                return (int)$item['mes'];
            }, $disponibles));
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $meses = [];
        foreach ($valor as $item) {
            $mes = (int)$item;
            if ($mes >= 1 && $mes <= 12) {
                $meses[$mes] = $mes;
            }
        }

        $meses = array_values($meses);
        sort($meses);

        return $meses;
    }

    public static function normalizarNombres($valor, array $disponibles): array
    {
        if ($valor === null) {
            return array_values(array_map(function ($item) {
                return (string)$item['id'];
            }, $disponibles));
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $nombres = [];
        foreach ($valor as $item) {
            $nombre = trim((string)$item);
            if ($nombre !== '') {
                $nombres[$nombre] = $nombre;
            }
        }

        return array_values($nombres);
    }

    public static function construirSeries(
        array $filas,
        array $meses,
        array $dias,
        int $decimales = 6
    ): array {
        $porMes = [];

        foreach ($filas as $fila) {
            $mes = (int)($fila['mes'] ?? 0);
            $dia = (int)($fila['dia'] ?? 0);

            if ($mes < 1 || $mes > 12 || $dia < 1 || $dia > 31) {
                continue;
            }

            if (!isset($porMes[$mes])) {
                $porMes[$mes] = array_fill(1, 31, null);
            }

            $valor = $fila['valor'];
            $porMes[$mes][$dia] = ($valor === null)
                ? null
                : round((float)$valor, $decimales);
        }

        $series = [];
        $sumaTotal = 0.0;
        $conteoTotal = 0;

        foreach ($meses as $mes) {
            $valores = isset($porMes[$mes])
                ? array_values($porMes[$mes])
                : array_fill(0, 31, null);

            foreach ($valores as $valor) {
                if ($valor !== null) {
                    $sumaTotal += $valor;
                    $conteoTotal++;
                }
            }

            $series[] = [
                'mes' => $mes,
                'label' => self::nombreMes($mes),
                'valores' => $valores
            ];
        }

        return [
            'series' => $series,
            'promedio' => $conteoTotal > 0 ? round($sumaTotal / $conteoTotal, 6) : null
        ];
    }
}
