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

        // Despacho Modular para CP02 EvolucionDatosProductivos
        if ($tipoGrafico === 'CP02 EvolucionDatosProductivos' || $tipoGrafico === 'CP02EvolucionDatosProductivos' || $tipoGrafico === 'CP02') {
            require_once __DIR__ . '/handlers/CP02EvolucionDatosProductivosHandler.php';
            return CP02EvolucionDatosProductivosHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA03 RevisionInsumos
        if (
            $tipoGrafico === 'CA03 RevisionInsumos' || $tipoGrafico === 'CA03RevisionInsumos' || $tipoGrafico === 'CA03' ||
            $tipoGrafico === 'CP03 RevisionInsumos' || $tipoGrafico === 'CP03RevisionInsumos' || $tipoGrafico === 'CP03'
        ) {
            require_once __DIR__ . '/handlers/CA03RevisionInsumosHandler.php';
            return CA03RevisionInsumosHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA04 RevisionAlimento
        if (
            $tipoGrafico === 'CA04 RevisionAlimento' || $tipoGrafico === 'CA04RevisionAlimento' || $tipoGrafico === 'CA04' ||
            $tipoGrafico === 'CP04 RevisionAlimento' || $tipoGrafico === 'CP04RevisionAlimento' || $tipoGrafico === 'CP04'
        ) {
            require_once __DIR__ . '/handlers/CA04RevisionAlimentoHandler.php';
            return CA04RevisionAlimentoHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA05 AnalisisFormulas
        if (
            $tipoGrafico === 'CA05 AnalisisFormulas' || $tipoGrafico === 'CA05AnalisisFormulas' || $tipoGrafico === 'CA05' ||
            $tipoGrafico === 'CP05 AnalisisFormulas' || $tipoGrafico === 'CP05AnalisisFormulas' || $tipoGrafico === 'CP05'
        ) {
            require_once __DIR__ . '/handlers/CA05AnalisisFormulasHandler.php';
            return CA05AnalisisFormulasHandler::handle($this->db, $filtros);
        }

        // Fallback por defecto a CP01
        require_once __DIR__ . '/handlers/CP01CostosGeneralesPorDiaHandler.php';
        return CP01CostosGeneralesPorDiaHandler::handle($this->db, $filtros);
    }

    /**
     * Guarda o actualiza el factor CF para un periodo específico
     */
    public function guardarFactorAlimento(array $data): array
    {
        require_once __DIR__ . '/handlers/CA04RevisionAlimentoHandler.php';
        return CA04RevisionAlimentoHandler::guardarFactorCF($this->db, $data);
    }
}
