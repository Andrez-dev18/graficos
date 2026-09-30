<?php

require_once __DIR__ . '/handlers/Dash_CostoFormulaPorTipoAABBHandler.php';
require_once __DIR__ . '/handlers/Dash_CostoFormulaInsumosHandler.php';
require_once __DIR__ . '/handlers/Dash_RevisionInsumosHandler.php';
require_once __DIR__ . '/handlers/Dash_RevisionAlimentoHandler.php';

class AnalisisCostoDiarioService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltrosIniciales(): array
    {
        // 1. Tipos de Alimento disponibles para CostoFormulaPorTipoAABB
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

        // 3. Metadata específica para RevisionInsumos
        $stmtHistos = $this->db->query("
            SELECT DISTINCT fechahisto 
            FROM histcostdiaalim 
            WHERE fechahisto != '0000-00-00' 
            ORDER BY fechahisto DESC 
            LIMIT 40
        ");
        $fechahistoList = $stmtHistos->fetchAll(PDO::FETCH_COLUMN) ?: ['2026-03-29'];

        $stmtTrans = $this->db->query("
            SELECT DISTINCT TRIM(transaccion) AS transaccion 
            FROM histcostdiaalim 
            WHERE transaccion IS NOT NULL AND TRIM(transaccion) != ''
            ORDER BY transaccion ASC
        ");
        $transList = $stmtTrans->fetchAll(PDO::FETCH_COLUMN) ?: ['S003', 'E003', 'S811'];

        $stmtTiposIns = $this->db->query("
            SELECT DISTINCT TRIM(tipo) AS tipo 
            FROM histcostdiaalim 
            WHERE tipo IS NOT NULL AND TRIM(tipo) != ''
            ORDER BY tipo DESC
        ");
        $tiposInsList = $stmtTiposIns->fetchAll(PDO::FETCH_COLUMN) ?: ['INSUMO', 'FABRICACIO'];

        // Ítems destacados por defecto
        $itemsDefecto = [
            'M0000001 MAIZ GRANO',
            'M0000011 ACEITE  CRUDO DE SOYA',
            'M0000020 TORTA DE SOYA HYPRO',
            'M0020017 IVERDROG',
            'M0030004 NUCLEO 1 POLLO',
            'M0030005 NUCLEO 2 POLLO',
            'M0030006 NUCLEO 3 POLLO',
            'M0030007 NUCLEO 4 POLLO',
            'M0030010 NUCLEO 0 POLLO'
        ];

        // Obtener ítems disponibles para la fecha histórica por defecto (2026-02-26 o la última)
        $defaultHisto = in_array('2026-02-26', $fechahistoList) ? '2026-02-26' : ($fechahistoList[0] ?? '2026-02-26');
        $stmtItems = $this->db->prepare("
            SELECT DISTINCT 
                TRIM(coditem) AS coditem,
                TRIM(nomitem) AS nomitem,
                CONCAT(TRIM(coditem), ' ', TRIM(nomitem)) AS label
            FROM histcostdiaalim
            WHERE fechahisto = ? AND coditem IS NOT NULL AND TRIM(coditem) != ''
            ORDER BY coditem ASC
        ");
        $stmtItems->execute([$defaultHisto]);
        $itemsDisp = $stmtItems->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'tipos'                   => $tipos,
            'fecha_defecto'           => [
                'inicio' => '2026-02-19',
                'fin'    => '2026-03-21',
                'min'    => $fechasRango['min_fecha'] ?? '2024-01-01',
                'max'    => $fechasRango['max_fecha'] ?? '2026-12-31'
            ],
            'dashboards'              => [
                ['id' => 'CostoFormulaPorTipoAABB', 'label' => 'Costo Formula Por Tipo AABB'],
                ['id' => 'CostoFormula-Insumos',    'label' => 'Costo Formula - Insumos'],
                ['id' => 'RevisionInsumos',         'label' => 'Revisión Insumos'],
                ['id' => 'RevisionAlimento',        'label' => 'Revisión Alimento']
            ],
            'revision_insumos_meta'   => [
                'fechahisto_defecto'        => $defaultHisto,
                'fechahisto_disponibles'    => $fechahistoList,
                'tipos_disponibles'         => $tiposInsList,
                'transacciones_disponibles' => $transList,
                'items_disponibles'         => $itemsDisp,
                'items_defecto'             => $itemsDefecto
            ]
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? $filtros['dashboard'] ?? 'CostoFormulaPorTipoAABB';

        switch ($tipoGrafico) {
            case 'RevisionAlimento':
            case 'Dash_RevisionAlimento':
                return Dash_RevisionAlimentoHandler::handle($this->db, $filtros);

            case 'RevisionInsumos':
            case 'Dash_RevisionInsumos':
                return Dash_RevisionInsumosHandler::handle($this->db, $filtros);

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
