<?php

require_once __DIR__ . '/PreciosBaseHandler.php';
require_once __DIR__ . '/CantidadesTablaHandler.php';

class PreciosTablaHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        return PreciosBaseHandler::obtenerFiltros($db);
    }

    public static function handle(PDO $db, array $filtros): array
    {
        return self::construirDesdeDatos(
            PreciosBaseHandler::obtenerDatos($db, $filtros, true)
        );
    }

    public static function construirDesdeDatos(array $datos): array
    {
        $columnas = CantidadesTablaHandler::construirColumnas(
            $datos['fecha_inicio'],
            $datos['fecha_fin']
        );

        $porProvincia = [];
        $sumasProvincia = [];
        $conteosProvincia = [];

        foreach ($datos['filas'] as $fila) {
            $provincia = trim((string)($fila['provincia'] ?? ''));
            $proveedor = trim((string)($fila['nombre_corregido'] ?? ''));
            $anio = (int)($fila['anio'] ?? 0);
            $semana = (int)($fila['semana'] ?? 0);

            if ($provincia === '' || $proveedor === '' || $anio <= 0 || $semana <= 0) {
                continue;
            }

            $key = $anio . '-' . $semana;

            if (!isset($porProvincia[$provincia])) {
                $porProvincia[$provincia] = [];
                $sumasProvincia[$provincia] = [];
                $conteosProvincia[$provincia] = [];
            }

            if (!isset($porProvincia[$provincia][$proveedor])) {
                $porProvincia[$provincia][$proveedor] = [];
            }

            $porProvincia[$provincia][$proveedor][$key] = (float)($fila['precio'] ?? 0);

            $sumasProvincia[$provincia][$key] =
                ($sumasProvincia[$provincia][$key] ?? 0) + (float)($fila['suma_precio'] ?? 0);
            $conteosProvincia[$provincia][$key] =
                ($conteosProvincia[$provincia][$key] ?? 0) + (int)($fila['conteo'] ?? 0);
        }

        $filas = [];
        $subtotales = [];

        foreach ($porProvincia as $provincia => $proveedores) {
            foreach ($proveedores as $proveedor => $valoresSemana) {
                $valores = [];
                foreach ($columnas as $columna) {
                    $valor = $valoresSemana[$columna['key']] ?? null;
                    $valores[] = $valor === null ? null : round($valor, 6);
                }

                $filas[] = [
                    'provincia' => $provincia,
                    'proveedor' => $proveedor,
                    'valores'   => $valores
                ];
            }

            $valoresSubtotal = [];
            foreach ($columnas as $columna) {
                $suma = $sumasProvincia[$provincia][$columna['key']] ?? null;
                $conteo = $conteosProvincia[$provincia][$columna['key']] ?? 0;
                $valoresSubtotal[] = ($suma === null || $conteo <= 0)
                    ? null
                    : round($suma / $conteo, 6);
            }

            $subtotales[] = [
                'provincia' => $provincia,
                'valores'   => $valoresSubtotal
            ];
        }

        return [
            'tipo_grafico'    => 'PreciosTabla',
            'titulo'          => $datos['opciones']['titulo'] ?? 'Precio de Proveedores de Pollo BB',
            'tipo'            => PreciosBaseHandler::TIPO,
            'fecha_inicio'    => $datos['fecha_inicio'],
            'fecha_fin'       => $datos['fecha_fin'],
            'columnas'        => $columnas,
            'filas'           => $filas,
            'subtotales'      => $subtotales,
            'total_registros' => count($datos['filas'])
        ];
    }
}
