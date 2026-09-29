<?php

require_once __DIR__ . '/handlers/Dash_CostoFormulaPorTipoAABBHandler.php';
require_once __DIR__ . '/handlers/Dash_CostoFormulaInsumosHandler.php';

class AnalisisCostoDiarioService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltrosIniciales(): array
    {
        // 1. Tipos de Alimento disponibles
        $sqlTipos = "
            SELECT DISTINCT TRIM(tipo) AS id, TRIM(tipo) AS label
            FROM histcostdiaalim2
            WHERE tipo IS NOT NULL AND TRIM(tipo) != ''
            ORDER BY label ASC
        ";
        $stmtTipos = $this->db->query($sqlTipos);
        $tipos = $stmtTipos->fetchAll(PDO::FETCH_ASSOC);

        if (empty($tipos)) {
            $tipos = [
                ['id' => '21 PRE INICIO',    'label' => '21 PRE INICIO'],
                ['id' => '22 INICIO',        'label' => '22 INICIO'],
                ['id' => '23 ACABADO 1',     'label' => '23 ACABADO 1'],
                ['id' => '24 ACABADO 2',     'label' => '24 ACABADO 2'],
                ['id' => '25 TERMINADOR',    'label' => '25 TERMINADOR'],
                ['id' => '26 FINALIZADOR',   'label' => '26 FINALIZADOR'],
                ['id' => '27 FINALIZADOR 2', 'label' => '27 FINALIZADOR 2']
            ];
        }

        // 2. Límites de fechas disponibles
        $sqlFechas = "
            SELECT 
                MIN(fecha) AS min_fecha, 
                MAX(fecha) AS max_fecha 
            FROM histcostdiaalim2
            WHERE fecha != '0000-00-00'
        ";
        $stmtFechas = $this->db->query($sqlFechas);
        $fechasRango = $stmtFechas->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'tipos'         => $tipos,
            'fecha_defecto' => [
                'inicio' => '2026-02-19',
                'fin'    => '2026-03-21',
                'min'    => $fechasRango['min_fecha'] ?? '2024-01-01',
                'max'    => $fechasRango['max_fecha'] ?? '2026-12-31'
            ],
            'dashboards'    => [
                ['id' => 'CostoFormulaPorTipoAABB', 'label' => 'Costo Formula Por Tipo AABB'],
                ['id' => 'CostoFormula-Insumos',    'label' => 'Costo Formula - Insumos']
            ]
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? $filtros['dashboard'] ?? 'CostoFormulaPorTipoAABB';

        switch ($tipoGrafico) {
            case 'CostoFormula-Insumos':
            case 'Dash_CostoFormulaInsumos':
                return Dash_CostoFormulaInsumosHandler::handle($this->db, $filtros);

            case 'CostoFormulaPorTipoAABB':
            case 'Dash_CostoFormulaPorTipoAABB':
            default:
                return Dash_CostoFormulaPorTipoAABBHandler::handle($this->db, $filtros);
        }
    }
}
