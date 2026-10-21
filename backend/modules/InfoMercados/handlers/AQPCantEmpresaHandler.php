<?php

require_once __DIR__ . '/AQPEmpresaHandler.php';

class AQPCantEmpresaHandler
{
    public static function obtenerFiltros(PDO $db, string $anio = '2026'): array
    {
        $filtros = AQPEmpresaHandler::obtenerFiltros($db, $anio);
        $filtros['titulo'] = 'Comportamiento Cantidad de Aves AREQUIPA';
        return $filtros;
    }

    public static function handle(PDO $db, array $filtros, string $anio = '2026'): array
    {
        $filtros['tipo_grafico'] = 'AQPCantEmpresa';
        return AQPEmpresaHandler::handle($db, $filtros, $anio);
    }
}
