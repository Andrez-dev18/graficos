<?php

require_once __DIR__ . '/Dash_Ventas2025_SingleMetricHandler.php';

class Dash_Ventas2025_PesoHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        return Dash_Ventas2025_SingleMetricHandler::handle($db, $filtros, 'peso');
    }
}
