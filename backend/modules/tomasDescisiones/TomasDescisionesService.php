<?php

require_once __DIR__ . '/handlers/DashProyectadoVentasIndicadorHandler.php';
require_once __DIR__ . '/handlers/DashTasasdeInteresHandler.php';
require_once __DIR__ . '/handlers/DashGraficasProyectadosVSRealHandler.php';
require_once __DIR__ . '/handlers/DashGraficasProyectadosDiasHandler.php';

class TomasDescisionesService
{
    private $proyectadoVentas;
    private $tasasInteres;
    private $graficasProyectados;
    private $graficasProyectadosDias;

    public function __construct($db)
    {
        $this->proyectadoVentas = new DashProyectadoVentasIndicadorHandler($db);
        $this->tasasInteres = new DashTasasdeInteresHandler($db);
        $this->graficasProyectados = new DashGraficasProyectadosVSRealHandler($db);
        $this->graficasProyectadosDias = new DashGraficasProyectadosDiasHandler($db);
    }

    public function obtenerFiltrosProyectadoVentas(array $filtros): array
    {
        return $this->proyectadoVentas->obtenerFiltros($filtros);
    }

    public function obtenerProyectadoVentasIndicador(array $filtros): array
    {
        return $this->proyectadoVentas->obtenerDashboard($filtros);
    }

    public function obtenerTasasInteres(array $filtros): array
    {
        return $this->tasasInteres->obtenerDashboard($filtros);
    }

    public function obtenerGraficasProyectadosVSReal(array $filtros): array
    {
        return $this->graficasProyectados->obtenerDashboard($filtros);
    }

    public function obtenerGraficasProyectadosDias(array $filtros): array
    {
        return $this->graficasProyectadosDias->obtenerDashboard($filtros);
    }
}
