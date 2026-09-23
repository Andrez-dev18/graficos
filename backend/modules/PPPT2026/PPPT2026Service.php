<?php

require_once __DIR__ . '/handlers/DashPTHandler.php';

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

            default:
                // Si aún no está implementado otro gráfico, por defecto devolvemos PT
                return DashPTHandler::handle($this->db, $filtros);
        }
    }
}
