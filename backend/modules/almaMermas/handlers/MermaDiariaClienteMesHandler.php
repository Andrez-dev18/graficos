<?php

class MermaDiariaClienteMesHandler
{
    public static function formatear(array $filasRaw, array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');

        $meses = self::generarMeses($fechaInicio, $fechaFin);
        $porCliente = [];

        foreach ($filasRaw as $fila) {
            $cliente = trim((string)($fila['cliente'] ?? ''));
            $periodo = (string)($fila['periodo'] ?? '');
            if ($cliente === '' || $periodo === '') {
                continue;
            }
            if (!isset($porCliente[$cliente])) {
                $porCliente[$cliente] = [];
            }
            $porCliente[$cliente][$periodo] = (float)($fila['valor'] ?? 0);
        }

        ksort($porCliente);
        $clientes = [];
        $maxValor = 0.0;

        foreach ($porCliente as $cliente => $valoresPorMes) {
            $valores = [];
            foreach ($meses as $mes) {
                $valor = array_key_exists($mes, $valoresPorMes) ? (float)$valoresPorMes[$mes] : null;
                $valores[] = $valor;
                if ($valor !== null && $valor > $maxValor) {
                    $maxValor = $valor;
                }
            }
            $clientes[] = [
                'cliente' => $cliente,
                'valores' => $valores
            ];
        }

        $stepY = 2;
        $maxY = max(6, (int)ceil($maxValor));
        // Ajustar maxY para que sea múltiplo de stepY
        if ($maxY % $stepY !== 0) {
            $maxY += ($stepY - ($maxY % $stepY));
        }

        $dato = trim((string)($filtros['dato'] ?? ''));
        $subtituloDato = (!empty($dato) && strtoupper($dato) !== 'TODO') ? ' · Dato: ' . ucfirst(strtolower($dato)) : '';

        return [
            'status'       => 'success',
            'total'        => count($clientes),
            'data'         => $clientes,
            'fechas'       => $meses, // Lista de 'YYYY-MM'
            'max_y'        => $maxY,
            'step_y'       => $stepY,
            'titulo'       => 'Porcentaje de Merma Mensualizada por Fecha de Proceso y cliente',
            'subtitulo'    => 'Merma total sobre la entrada' . $subtituloDato,
            'etiqueta_y'   => 'Porcentaje de Merma',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin
        ];
    }

    private static function generarMeses(string $fechaInicio, string $fechaFin): array
    {
        $inicio = (new DateTimeImmutable($fechaInicio))->modify('first day of this month')->setTime(0, 0);
        $fin    = (new DateTimeImmutable($fechaFin))->modify('first day of this month')->setTime(0, 0);

        if ($inicio > $fin) {
            $temp = $inicio;
            $inicio = $fin;
            $fin = $temp;
        }

        $meses = [];
        $cursor = $inicio;
        while ($cursor <= $fin) {
            $meses[] = $cursor->format('Y-m');
            $cursor = $cursor->modify('+1 month');
        }

        return $meses;
    }
}
