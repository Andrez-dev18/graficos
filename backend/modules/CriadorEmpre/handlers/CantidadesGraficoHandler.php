<?php

require_once __DIR__ . '/CantidadesTablaHandler.php';

class CantidadesGraficoHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = CantidadesTablaHandler::obtenerFiltros($db);

        $anioInicio = self::resolverAnio(
            $filtros['anio_inicio'] ?? null,
            $opciones['anio_inicio_default'] ?? null
        );
        $anioFin = self::resolverAnio(
            $filtros['anio_fin'] ?? null,
            $opciones['anio_fin_default'] ?? null
        );

        if ($anioInicio > $anioFin) {
            throw new InvalidArgumentException('El año inicial no puede ser mayor que el año final.');
        }

        $tabla = CantidadesTablaHandler::handle($db, [
            'fecha_inicio' => $anioInicio . '-01-01',
            'fecha_fin'    => $anioFin . '-12-31',
            'tipos'        => array_key_exists('tipos', $filtros)
                ? $filtros['tipos']
                : $opciones['tipos_default'],
            'provincias'   => array_key_exists('provincias', $filtros)
                ? $filtros['provincias']
                : $opciones['provincias_default'],
            'proveedores'  => array_key_exists('proveedores', $filtros)
                ? $filtros['proveedores']
                : $opciones['proveedores_default']
        ]);

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
            'tipo_grafico'    => 'CantidadesGrafico',
            'titulo'          => $tabla['titulo'] ?? 'Volumen Semanal Total',
            'fecha_inicio'    => $tabla['fecha_inicio'] ?? ($anioInicio . '-01-01'),
            'fecha_fin'       => $tabla['fecha_fin'] ?? ($anioFin . '-12-31'),
            'anio_inicio'     => $anioInicio,
            'anio_fin'        => $anioFin,
            'columnas'        => $tabla['columnas'] ?? [],
            'series'          => $series,
            'total_registros' => $tabla['total_registros'] ?? 0
        ];
    }

    private static function resolverAnio($valor, $defecto): int
    {
        if ($valor === null || trim((string)$valor) === '') {
            if ($defecto === null) {
                throw new InvalidArgumentException('No hay años disponibles para el gráfico.');
            }
            return (int)$defecto;
        }

        if (!is_numeric($valor)) {
            throw new InvalidArgumentException('Año inválido: ' . $valor);
        }

        $anio = (int)$valor;
        if ($anio < 1900 || $anio > 2100) {
            throw new InvalidArgumentException('Año inválido: ' . $valor);
        }

        return $anio;
    }
}
