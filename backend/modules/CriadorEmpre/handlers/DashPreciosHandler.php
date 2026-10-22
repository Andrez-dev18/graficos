<?php

require_once __DIR__ . '/PreciosBaseHandler.php';
require_once __DIR__ . '/PreciosTablaHandler.php';
require_once __DIR__ . '/PreciosGraficoHandler.php';

class DashPreciosHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        $datos = PreciosBaseHandler::obtenerDatos($db, $filtros, true);

        return [
            'tipo_grafico' => 'DashPrecios',
            'titulo'       => $datos['opciones']['titulo'] ?? 'Precio de Proveedores de Pollo BB',
            'tabla'        => PreciosTablaHandler::construirDesdeDatos($datos),
            'grafico'      => PreciosGraficoHandler::construirDesdeDatos($datos)
        ];
    }
}
