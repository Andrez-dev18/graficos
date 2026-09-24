<?php

require_once __DIR__ . '/handlers/DashPresupuesto202403Handler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202404Handler.php';

class PresupuestosPABService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? 'DashPresupuesto202403';

        switch ($tipoGrafico) {
            case 'DashPresupuesto202404':
            case 'Presupuesto202404':
                return DashPresupuesto202404Handler::handle($this->db, $filtros);

            case 'DashPresupuesto202403':
            case 'Presupuesto202403':
            default:
                return DashPresupuesto202403Handler::handle($this->db, $filtros);
        }
    }
}
