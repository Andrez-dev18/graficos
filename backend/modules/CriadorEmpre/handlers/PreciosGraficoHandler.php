<?php

require_once __DIR__ . '/PreciosBaseHandler.php';
require_once __DIR__ . '/CantidadesTablaHandler.php';

class PreciosGraficoHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        return PreciosBaseHandler::obtenerFiltros($db);
    }

    public static function handle(PDO $db, array $filtros): array
    {
        return self::construirDesdeDatos(
            PreciosBaseHandler::obtenerDatos($db, $filtros)
        );
    }

    public static function construirDesdeDatos(array $datos): array
    {
        $columnas = CantidadesTablaHandler::construirColumnas(
            $datos['fecha_inicio'],
            $datos['fecha_fin']
        );

        $sumas = [];
        $conteos = [];

        foreach ($datos['filas'] as $fila) {
            $proveedor = trim((string)($fila['nombre_corregido'] ?? ''));
            $anio = (int)($fila['anio'] ?? 0);
            $semana = (int)($fila['semana'] ?? 0);

            if ($proveedor === '' || $anio <= 0 || $semana <= 0) {
                continue;
            }

            $key = $anio . '-' . $semana;
            $sumas[$proveedor][$key] = ($sumas[$proveedor][$key] ?? 0) + (float)($fila['suma_precio'] ?? 0);
            $conteos[$proveedor][$key] = ($conteos[$proveedor][$key] ?? 0) + (int)($fila['conteo'] ?? 0);
        }

        ksort($sumas, SORT_NATURAL | SORT_FLAG_CASE);

        $series = [];
        foreach ($sumas as $proveedor => $valoresSemana) {
            $valores = [];
            foreach ($columnas as $columna) {
                $suma = $valoresSemana[$columna['key']] ?? null;
                $conteo = $conteos[$proveedor][$columna['key']] ?? 0;
                $valores[] = ($suma === null || $conteo <= 0)
                    ? null
                    : round($suma / $conteo, 6);
            }

            $series[] = [
                'proveedor' => $proveedor,
                'label'     => $proveedor,
                'valores'   => $valores
            ];
        }

        return [
            'tipo_grafico'    => 'PreciosGrafico',
            'titulo'          => $datos['opciones']['titulo'] ?? 'Precio de Proveedores de Pollo BB',
            'tipo'            => PreciosBaseHandler::TIPO,
            'fecha_inicio'    => $datos['fecha_inicio'],
            'fecha_fin'       => $datos['fecha_fin'],
            'columnas'        => $columnas,
            'series'          => $series,
            'total_registros' => count($datos['filas'])
        ];
    }
}
