<?php

require_once __DIR__ . '/handlers/DashAnalisiPreciosHandler.php';

class AnalisisPreciosService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? 'DashAnalisiPrecios';

        switch ($tipoGrafico) {
            case 'DashAnalisiPrecios':
            case 'AnalisisPrecios':
            case 'DashAnalisisPrecios':
                return DashAnalisiPreciosHandler::handle($this->db, $filtros);

            default:
                return [
                    'status' => 'success',
                    'tipo_grafico' => $tipoGrafico,
                    'filtros' => $filtros,
                    'filas' => [],
                    'message' => "Gráfico {$tipoGrafico} listo para vincular handler."
                ];
        }
    }
}
