<?php

require_once __DIR__ . '/handlers/DashPTHandler.php';
require_once __DIR__ . '/handlers/DashPPHandler.php';
require_once __DIR__ . '/handlers/DashPPResuHandler.php';
require_once __DIR__ . '/handlers/DashPTResuHandler.php';

class PPPT2026Service
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? 'PT';

        switch ($tipoGrafico) {
            case 'PT':
            case 'DashPT':
                return DashPTHandler::handle($this->db, $filtros);

            case 'PP':
            case 'DashPP':
                return DashPPHandler::handle($this->db, $filtros);

            case 'PPResu':
            case 'DashPPResu':
                return DashPPResuHandler::handle($this->db, $filtros);

            case 'PTResu':
            case 'DashPTResu':
                return DashPTResuHandler::handle($this->db, $filtros);

            default:
                return DashPTHandler::handle($this->db, $filtros);
        }
    }
}
