<?php

require_once __DIR__ . '/handlers/Dash_Ventas2025_TodosHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2025_CantidadHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2025_PesoHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2025_ValorHandler.php';

class Ventas2025Service
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltrosIniciales(): array
    {
        // 1. Provincias disponibles (activas en ventas 2025)
        $sqlProv = "
            SELECT DISTINCT TRIM(ccte.provincia) AS id, TRIM(ccte.provincia) AS label
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            WHERE sale.tline = '601' 
              AND sale.tfecfac >= '2025-01-01' 
              AND ccte.provincia IS NOT NULL 
              AND TRIM(ccte.provincia) != ''
            ORDER BY label ASC
        ";
        $stmtProv = $this->db->query($sqlProv);
        $provincias = $stmtProv->fetchAll(PDO::FETCH_ASSOC);

        // 2. Corporativos disponibles (activos en ventas 2025)
        $sqlCoorp = "
            SELECT DISTINCT TRIM(ccte1.nombre) AS id, TRIM(ccte1.nombre) AS label
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
            WHERE sale.tline = '601' 
              AND sale.tfecfac >= '2025-01-01' 
              AND ccte1.nombre IS NOT NULL 
              AND TRIM(ccte1.nombre) != ''
            ORDER BY label ASC
        ";
        $stmtCoorp = $this->db->query($sqlCoorp);
        $coorporativos = $stmtCoorp->fetchAll(PDO::FETCH_ASSOC);

        // 3. Tipos de Documento estándar
        $tdocs = [
            ['id' => '01', 'label' => '01 - Factura'],
            ['id' => '03', 'label' => '03 - Boleta'],
            ['id' => '07', 'label' => '07 - Nota de Crédito'],
            ['id' => '08', 'label' => '08 - Nota de Débito']
        ];

        // 4. Fechas por defecto / límites
        $sqlFechas = "
            SELECT 
                MIN(tfecfac) AS min_fecha, 
                MAX(tfecfac) AS max_fecha 
            FROM sale 
            WHERE tline = '601' AND tfecfac != '0000-00-00'
        ";
        $stmtFechas = $this->db->query($sqlFechas);
        $fechasRango = $stmtFechas->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'provincias'    => $provincias,
            'coorporativos' => $coorporativos,
            'tdocs'         => $tdocs,
            'fecha_defecto' => [
                'inicio' => '2025-06-01',
                'fin'    => '2025-06-21',
                'min'    => $fechasRango['min_fecha'] ?? '2025-01-01',
                'max'    => $fechasRango['max_fecha'] ?? '2025-12-31'
            ],
            'tipos_reporte' => [
                ['id' => 'Todos',    'label' => 'Ventas por Coorporativo - Cliente (Todos)'],
                ['id' => 'Cantidad', 'label' => 'Cantidad'],
                ['id' => 'Peso',     'label' => 'Peso'],
                ['id' => 'Valor',    'label' => 'Valor']
            ]
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? $filtros['reporte'] ?? 'Todos';

        switch ($tipoGrafico) {
            case 'Cantidad':
                return Dash_Ventas2025_CantidadHandler::handle($this->db, $filtros);
            case 'Peso':
                return Dash_Ventas2025_PesoHandler::handle($this->db, $filtros);
            case 'Valor':
                return Dash_Ventas2025_ValorHandler::handle($this->db, $filtros);
            case 'Todos':
            default:
                return Dash_Ventas2025_TodosHandler::handle($this->db, $filtros);
        }
    }
}
