<?php

require_once __DIR__ . '/Dash_Ventas2024_SingleMetricHandler.php';

class Dash_Ventas2024_PesoHandler
{
    public static function handle(PDO $db, array $filtros): array
    {
        return Dash_Ventas2024_SingleMetricHandler::handle($db, $filtros, 'peso');
    }
}
