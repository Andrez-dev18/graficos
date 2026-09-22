<?php

require_once __DIR__ . '/handlers/MermasMesHandler.php';
require_once __DIR__ . '/handlers/MermasCamionDiaPesoHandler.php';
require_once __DIR__ . '/handlers/AnalisisMermasEscalable2Handler.php';
require_once __DIR__ . '/handlers/AnalisisMermasEscalable3Handler.php';
require_once __DIR__ . '/handlers/DashAnalisisPlacasGralHandler.php';
require_once __DIR__ . '/handlers/DashPlacaMermaHandler.php';
require_once __DIR__ . '/handlers/DashAnalisisMermaEscalableHandler.php';
require_once __DIR__ . '/handlers/DashAnalisisPlacasHandler.php';

class MermaPlacaService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? 'MermasMes';

        switch ($tipoGrafico) {
            case 'MermasMes':
                return MermasMesHandler::handle($this->db, $filtros);

            case 'MermasCamionDiaPeso':
                return MermasCamionDiaPesoHandler::handle($this->db, $filtros);

            case 'DashAnalisisMermaEscalable':
                return DashAnalisisMermaEscalableHandler::handle($this->db, $filtros);

            case 'AnalisisMermasEscalable2':
                return AnalisisMermasEscalable2Handler::handle($this->db, $filtros);

            case 'AnalisisMermasEscalable3':
                return AnalisisMermasEscalable3Handler::handle($this->db, $filtros);

            case 'DashAnalisisPlacasGral':
                return DashAnalisisPlacasGralHandler::handle($this->db, $filtros);

            case 'DashPlacaMerma':
                return DashPlacaMermaHandler::handle($this->db, $filtros);

            case 'DashAnalisisPlacas':
                return DashAnalisisPlacasHandler::handle($this->db, $filtros);

            default:
                // Para otros gráficos del libro mientras se van implementando
                return [
                    'status' => 'success',
                    'tipo_grafico' => $tipoGrafico,
                    'filtros' => $filtros,
                    'message' => "Gráfico {$tipoGrafico} listo para vincular handler."
                ];
        }
    }
}
