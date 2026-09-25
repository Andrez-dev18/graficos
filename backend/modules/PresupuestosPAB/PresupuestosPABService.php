<?php

require_once __DIR__ . '/handlers/DashPresupuesto202403Handler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202403PctHandler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202404Handler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202404PctHandler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202410Handler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202410PctHandler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202503Handler.php';
require_once __DIR__ . '/handlers/DashPresupuesto202503PctHandler.php';
require_once __DIR__ . '/handlers/AnalisisPartidasHandler.php';
require_once __DIR__ . '/handlers/DashComparativoCronoRCHandler.php';

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
            case 'DashComparativoCronoRC':
            case 'ComparativoCronoRC':
            case 'CronoRC':
                return DashComparativoCronoRCHandler::handle($this->db, $filtros);

            case 'AnalisisPartidas':
            case 'ComprasPorPartida':
            case 'RC':
                return AnalisisPartidasHandler::handle($this->db, $filtros);

            case 'DashPresupuesto202503Pct':
            case 'DashPresupuesto202503%':
            case 'Presupuesto202503%':
                return DashPresupuesto202503PctHandler::handle($this->db, $filtros);

            case 'DashPresupuesto202410Pct':
            case 'DashPresupuesto202410%':
            case 'Presupuesto202410%':
                return DashPresupuesto202410PctHandler::handle($this->db, $filtros);

            case 'DashPresupuesto202404Pct':
            case 'DashPresupuesto202404%':
            case 'Presupuesto202404%':
                return DashPresupuesto202404PctHandler::handle($this->db, $filtros);

            case 'DashPresupuesto202403Pct':
            case 'DashPresupuesto202403%':
            case 'Presupuesto202403%':
                return DashPresupuesto202403PctHandler::handle($this->db, $filtros);

            case 'DashPresupuesto202503':
            case 'Presupuesto202503':
                return DashPresupuesto202503Handler::handle($this->db, $filtros);

            case 'DashPresupuesto202410':
            case 'Presupuesto202410':
                return DashPresupuesto202410Handler::handle($this->db, $filtros);

            case 'DashPresupuesto202404':
            case 'Presupuesto202404':
                return DashPresupuesto202404Handler::handle($this->db, $filtros);

            case 'DashPresupuesto':
            case 'Presupuesto':
                $codigo = trim($filtros['presupuesto'] ?? $filtros['codigo_presupuesto'] ?? '202403');
                switch ($codigo) {
                    case '202503%':
                    case '202503Pct':
                        return DashPresupuesto202503PctHandler::handle($this->db, $filtros);
                    case '202503':
                        return DashPresupuesto202503Handler::handle($this->db, $filtros);
                    case '202410%':
                    case '202410Pct':
                        return DashPresupuesto202410PctHandler::handle($this->db, $filtros);
                    case '202410':
                        return DashPresupuesto202410Handler::handle($this->db, $filtros);
                    case '202404%':
                    case '202404Pct':
                        return DashPresupuesto202404PctHandler::handle($this->db, $filtros);
                    case '202404':
                        return DashPresupuesto202404Handler::handle($this->db, $filtros);
                    case '202403%':
                    case '202403Pct':
                        return DashPresupuesto202403PctHandler::handle($this->db, $filtros);
                    case '202403':
                    default:
                        return DashPresupuesto202403Handler::handle($this->db, $filtros);
                }

            case 'DashPresupuesto202403':
            case 'Presupuesto202403':
            default:
                return DashPresupuesto202403Handler::handle($this->db, $filtros);
        }
    }
}
