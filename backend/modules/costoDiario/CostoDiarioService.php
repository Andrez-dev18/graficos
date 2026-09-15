<?php

class CostoDiarioService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Despacho modular según el tipo de gráfico para Análisis Costos Diario
     */
    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = !empty($filtros['tipo_grafico']) ? trim($filtros['tipo_grafico']) : 'CP01 CostosGeneralesPorDia';

        // Despacho Modular para CP01 CostosGeneralesPorDia
        if ($tipoGrafico === 'CP01 CostosGeneralesPorDia' || $tipoGrafico === 'CP01CostosGeneralesPorDia' || $tipoGrafico === 'CP01') {
            require_once __DIR__ . '/handlers/CP01CostosGeneralesPorDiaHandler.php';
            return CP01CostosGeneralesPorDiaHandler::handle($this->db, $filtros);
        }

        // Fallback por defecto a CP01
        require_once __DIR__ . '/handlers/CP01CostosGeneralesPorDiaHandler.php';
        return CP01CostosGeneralesPorDiaHandler::handle($this->db, $filtros);
    }
}
