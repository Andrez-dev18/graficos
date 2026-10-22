<?php

require_once __DIR__ . '/CantidadesTablaHandler.php';

class DashCantidadesHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $tabla = CantidadesTablaHandler::handle($db, $filtros);

        $series = [];
        foreach ($tabla['subtotales'] as $subtotal) {
            $tipo = (string)($subtotal['tipo'] ?? '');
            if ($tipo === '') {
                continue;
            }

            $series[] = [
                'tipo'    => $tipo,
                'label'   => $tipo,
                'valores' => $subtotal['valores'] ?? []
            ];
        }

        return [
            'tipo_grafico' => 'DashCantidades',
            'titulo'       => $tabla['titulo'] ?? 'Volumen Semanal Total',
            'tabla'        => $tabla,
            'grafico'      => [
                'tipo_grafico'    => 'CantidadesGrafico',
                'titulo'          => $tabla['titulo'] ?? 'Volumen Semanal Total',
                'fecha_inicio'    => $tabla['fecha_inicio'] ?? null,
                'fecha_fin'       => $tabla['fecha_fin'] ?? null,
                'columnas'        => $tabla['columnas'] ?? [],
                'series'          => $series,
                'total_registros' => $tabla['total_registros'] ?? 0
            ]
        ];
    }
}
