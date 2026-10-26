<?php

class MermaDiariaClientePlacaHandler
{
    public static function formatear(array $filasRaw, array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');

        $fechas = self::generarFechas($fechaInicio, $fechaFin, true);
        $porClientePlaca = [];

        foreach ($filasRaw as $fila) {
            $cliente = trim((string)($fila['cliente'] ?? ''));
            $placa = trim((string)($fila['placa'] ?? ''));
            $periodo = (string)($fila['periodo'] ?? '');
            if ($cliente === '' || $placa === '' || $periodo === '') {
                continue;
            }
            if (!isset($porClientePlaca[$cliente])) {
                $porClientePlaca[$cliente] = [];
            }
            if (!isset($porClientePlaca[$cliente][$placa])) {
                $porClientePlaca[$cliente][$placa] = [];
            }
            $porClientePlaca[$cliente][$placa][$periodo] = (float)($fila['valor'] ?? 0);
        }

        ksort($porClientePlaca);
        $clientes = [];
        $maxValor = 0.0;
        $totalPlacas = 0;

        foreach ($porClientePlaca as $cliente => $placasPorCliente) {
            ksort($placasPorCliente);
            $placas = [];

            foreach ($placasPorCliente as $placa => $valoresPorFecha) {
                $valores = [];
                foreach ($fechas as $fecha) {
                    $valor = array_key_exists($fecha, $valoresPorFecha) ? (float)$valoresPorFecha[$fecha] : null;
                    $valores[] = $valor;
                    if ($valor !== null && $valor > $maxValor) {
                        $maxValor = $valor;
                    }
                }
                $placas[] = [
                    'placa'   => $placa,
                    'valores' => $valores
                ];
                $totalPlacas++;
            }

            $clientes[] = [
                'cliente' => $cliente,
                'placas'  => $placas
            ];
        }

        return [
            'status'         => 'success',
            'total'          => count($clientes),
            'data'           => $clientes,
            'fechas'         => $fechas,
            'max_valor'      => $maxValor,
            'total_placas'   => $totalPlacas,
            'titulo'         => 'Porcentaje de Merma Diaria por Fecha de Proceso con filtro de cliente y segmentado por placa',
            'subtitulo'      => 'Merma total sobre la entrada',
            'fecha_inicio'   => $fechaInicio,
            'fecha_fin'      => $fechaFin,
            'cliente_filtro' => trim((string)($filtros['cliente'] ?? 'TODO')),
            'placa_filtro'   => trim((string)($filtros['placa'] ?? 'TODO'))
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
