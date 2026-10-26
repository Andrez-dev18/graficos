<?php

class MermaDiariaClienteHandler
{
    public static function formatear(array $filasRaw, array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');

        $fechas = self::generarFechas($fechaInicio, $fechaFin, false);
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

        foreach ($porCliente as $cliente => $valoresPorFecha) {
            $valores = [];
            foreach ($fechas as $fecha) {
                $valor = array_key_exists($fecha, $valoresPorFecha) ? (float)$valoresPorFecha[$fecha] : null;
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

        $stepY = 5;
        $maxY = max(15, (int)ceil($maxValor));

        return [
            'status'       => 'success',
            'total'        => count($clientes),
            'data'         => $clientes,
            'fechas'       => $fechas,
            'max_y'        => $maxY,
            'step_y'       => $stepY,
            'titulo'       => 'Porcentaje de Merma Diaria por Fecha de Proceso segmentado por cliente',
            'subtitulo'    => 'Merma total sobre la entrada',
            'etiqueta_y'   => 'Porcentaje de Merma',
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin
        ];
    }

    private static function generarFechas(string $fechaInicio, string $fechaFin, bool $descendente): array
    {
        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);
        $cursor = $inicio->setTime(0, 0);
        $limite = $fin->setTime(0, 0);

        $fechas = [];
        while ($cursor <= $limite) {
            $fechas[] = $cursor->format('Y-m-d');
            $cursor = $cursor->modify('+1 day');
        }

        return $descendente ? array_reverse($fechas) : $fechas;
    }
}
