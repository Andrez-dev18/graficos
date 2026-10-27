<?php

require_once __DIR__ . '/AnalisisTransporteRepo.php';
require_once __DIR__ . '/handlers/LiquidacionPlacasHandler.php';

class AnalisisTransporteService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new AnalisisTransporteRepo($db);
    }

    public function obtenerLiquidacionPlacas(array $filtros): array
    {
        $filas = $this->repo->getLiquidacionPlacas($filtros);
        return LiquidacionPlacasHandler::formatear($filas);
    }
}
