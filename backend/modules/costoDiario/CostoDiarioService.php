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

        // Despacho Modular para CA01 CostoFormulaPorTipoAlimento
        if (
            $tipoGrafico === 'CA01 CostoFormulaPorTipoAlimento' || $tipoGrafico === 'CA01CostoFormulaPorTipoAlimento' ||
            $tipoGrafico === 'CA01 CostoFormulaPorTipoAA' || $tipoGrafico === 'CA01CostoFormulaPorTipoAA' ||
            $tipoGrafico === 'CA01' || $tipoGrafico === 'CP01 CostoFormulaPorTipoAlimento'
        ) {
            require_once __DIR__ . '/handlers/CA01CostoFormulaPorTipoHandler.php';
            return CA01CostoFormulaPorTipoHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA02 CostoFormula-Insumos
        if (
            $tipoGrafico === 'CA02 CostoFormula-Insumos' || $tipoGrafico === 'CA02CostoFormula-Insumos' ||
            $tipoGrafico === 'CA02 CostoFormulaInsumos' || $tipoGrafico === 'CA02CostoFormulaInsumos' ||
            $tipoGrafico === 'CA02' || $tipoGrafico === 'CP02 CostoFormula-Insumos'
        ) {
            require_once __DIR__ . '/handlers/CA02CostoFormulaInsumosHandler.php';
            return CA02CostoFormulaInsumosHandler::handle($this->db, $filtros);
        }

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

        // Despacho Modular para CP03 ComparativoDatosProductivos
        if (
            $tipoGrafico === 'CP03 ComparativoDatosProductivos' || $tipoGrafico === 'CP03ComparativoDatosProductivos' ||
            $tipoGrafico === 'CP03' || $tipoGrafico === 'Comparativo Datos Productivos' ||
            $tipoGrafico === 'CP03 Comparativo Datos Productivos'
        ) {
            require_once __DIR__ . '/handlers/CP03ComparativoDatosProductivosHandler.php';
            return CP03ComparativoDatosProductivosHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA03 RevisionInsumos
        if (
            $tipoGrafico === 'CA03 RevisionInsumos' || $tipoGrafico === 'CA03RevisionInsumos' || $tipoGrafico === 'CA03'
        ) {
            require_once __DIR__ . '/handlers/CA03RevisionInsumosHandler.php';
            return CA03RevisionInsumosHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP04 CostosGeneralesDetalleAlDia
        if (
            $tipoGrafico === 'CP04 CostosGeneralesDetalleAlDia' || $tipoGrafico === 'CP04CostosGeneralesDetalleAlDia' ||
            $tipoGrafico === 'CP04 CostosGeneralesDetalle' || $tipoGrafico === 'CP04CostosGeneralesDetalle' ||
            $tipoGrafico === 'CP04 Costos Generales Detalle Al Dia' || $tipoGrafico === 'CP04'
        ) {
            require_once __DIR__ . '/handlers/CP04CostosGeneralesDetalleAlDiaHandler.php';
            return CP04CostosGeneralesDetalleAlDiaHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA04 RevisionAlimento
        if (
            $tipoGrafico === 'CA04 RevisionAlimento' || $tipoGrafico === 'CA04RevisionAlimento' || $tipoGrafico === 'CA04' ||
            $tipoGrafico === 'CP04 RevisionAlimento' || $tipoGrafico === 'CP04RevisionAlimento'
        ) {
            require_once __DIR__ . '/handlers/CA04RevisionAlimentoHandler.php';
            return CA04RevisionAlimentoHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CA05 AnalisisFormulas
        if (
            $tipoGrafico === 'CA05 AnalisisFormulas' || $tipoGrafico === 'CA05AnalisisFormulas' || $tipoGrafico === 'CA05' ||
            $tipoGrafico === 'CP05 AnalisisFormulas' || $tipoGrafico === 'CP05AnalisisFormulas'
        ) {
            require_once __DIR__ . '/handlers/CA05AnalisisFormulasHandler.php';
            return CA05AnalisisFormulasHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP05 AnalisisContableCostosDiarios
        if (
            $tipoGrafico === 'CP05 AnalisisContableCostosDiarios' || $tipoGrafico === 'CP05AnalisisContableCostosDiarios' ||
            $tipoGrafico === 'CP05 Analisis Contable Costos Diarios' || $tipoGrafico === 'CP05 Analisis Contable' ||
            $tipoGrafico === 'CP05'
        ) {
            require_once __DIR__ . '/handlers/CP05AnalisisContableCostosDiariosHandler.php';
            return CP05AnalisisContableCostosDiariosHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP06 AnalisisContablePorGalpon
        if (
            $tipoGrafico === 'CP06 AnalisisContablePorGalpon' || $tipoGrafico === 'CP06AnalisisContablePorGalpon' ||
            $tipoGrafico === 'CP06 Analisis Contable Por Galpon' || $tipoGrafico === 'CP06 Analisis Contable Galpon'
        ) {
            require_once __DIR__ . '/handlers/CP06AnalisisContablePorGalponHandler.php';
            return CP06AnalisisContablePorGalponHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP07 AnalisisContableDataDetalle
        if (
            $tipoGrafico === 'CP07 AnalisisContableDataDetalle' || $tipoGrafico === 'CP07AnalisisContableDataDetalle' ||
            $tipoGrafico === 'CP07 Analisis Contable Data Detalle' || $tipoGrafico === 'CP07'
        ) {
            require_once __DIR__ . '/handlers/CP07AnalisisContableDataDetalleHandler.php';
            return CP07AnalisisContableDataDetalleHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP08 ComparativoGranjaGalpon
        if (
            $tipoGrafico === 'CP08 ComparativoGranjaGalpon' || $tipoGrafico === 'CP08ComparativoGranjaGalpon' ||
            $tipoGrafico === 'CP08 Comparativo Granja Galpon' || $tipoGrafico === 'CP08' ||
            $tipoGrafico === 'CP08 ComparativoGranjaGalpón' || $tipoGrafico === 'CP08 Comparativo Granja Galpón'
        ) {
            require_once __DIR__ . '/handlers/CP08ComparativoGranjaGalponHandler.php';
            return CP08ComparativoGranjaGalponHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP09 Sanidad
        if (
            $tipoGrafico === 'CP09 Sanidad' || $tipoGrafico === 'CP09Sanidad' ||
            $tipoGrafico === 'CP09' || $tipoGrafico === 'Sanidad'
        ) {
            require_once __DIR__ . '/handlers/CP09SanidadHandler.php';
            return CP09SanidadHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para CP10 CostoDiario
        if (
            $tipoGrafico === 'CP10 CostoDiario' || $tipoGrafico === 'CP10CostoDiario' ||
            $tipoGrafico === 'CP10' || $tipoGrafico === 'CostoDiario' ||
            $tipoGrafico === 'CP10 Costo Diario'
        ) {
            require_once __DIR__ . '/handlers/CP10CostoDiarioHandler.php';
            return CP10CostoDiarioHandler::handle($this->db, $filtros);
        }

        // Despacho Modular para GraficaASO (Tendencia Costo por Kg de Pollo Vivo Sin Factor/ Con Factor)
        if (
            $tipoGrafico === 'GraficaASO' || $tipoGrafico === 'Grafica ASO' ||
            $tipoGrafico === 'CP06 GraficaASO' || $tipoGrafico === 'CP06GraficaASO' ||
            $tipoGrafico === 'Tendencia Costo Pollo Vivo'
        ) {
            require_once __DIR__ . '/handlers/GraficaASOHandler.php';
            return GraficaASOHandler::handle($this->db, $filtros);
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
