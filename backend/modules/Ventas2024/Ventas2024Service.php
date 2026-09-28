<?php

require_once __DIR__ . '/handlers/Dash_Ventas2024_TodosHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2024_CantidadHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2024_PesoHandler.php';
require_once __DIR__ . '/handlers/Dash_Ventas2024_ValorHandler.php';

class Ventas2024Service
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltrosIniciales(): array
    {
        // 1. Provincias disponibles (activas en ventas 2024)
        $sqlProv = "
            SELECT DISTINCT TRIM(ccte.provincia) AS id, TRIM(ccte.provincia) AS label
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            WHERE sale.tline = '601' 
              AND sale.tfecfac BETWEEN '2024-01-01' AND '2024-12-31'
              AND ccte.provincia IS NOT NULL 
              AND TRIM(ccte.provincia) != ''
            ORDER BY label ASC
        ";
        $stmtProv = $this->db->query($sqlProv);
        $provincias = $stmtProv->fetchAll(PDO::FETCH_ASSOC);

        if (empty($provincias)) {
            // Provincias estándar si la BD de desarrollo aún no tiene data cargada de 2024
            $provincias = [
                ['id' => 'AREQUIPA', 'label' => 'AREQUIPA'],
                ['id' => 'CAMANA',   'label' => 'CAMANA'],
                ['id' => 'CUZCO',    'label' => 'CUZCO'],
                ['id' => 'ILO',      'label' => 'ILO'],
                ['id' => 'LA JOYA',  'label' => 'LA JOYA'],
                ['id' => 'MOLLENDO', 'label' => 'MOLLENDO'],
                ['id' => 'MOQUEGUA', 'label' => 'MOQUEGUA'],
                ['id' => 'PEDREGAL', 'label' => 'PEDREGAL'],
                ['id' => 'TACNA',    'label' => 'TACNA']
            ];
        }

        // 2. Corporativos disponibles (activos en ventas 2024)
        $sqlCoorp = "
            SELECT DISTINCT TRIM(ccte1.nombre) AS id, TRIM(ccte1.nombre) AS label
            FROM sale
            INNER JOIN ccte ON sale.tprocli = ccte.codigo
            INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
            WHERE sale.tline = '601' 
              AND sale.tfecfac BETWEEN '2024-01-01' AND '2024-12-31'
              AND ccte1.nombre IS NOT NULL 
              AND TRIM(ccte1.nombre) != ''
            ORDER BY label ASC
        ";
        $stmtCoorp = $this->db->query($sqlCoorp);
        $coorporativos = $stmtCoorp->fetchAll(PDO::FETCH_ASSOC);

        // Si está vacía en local (aún sin datos de 2024 en bd desarrollo), traer corporativos activos de pollo
        if (empty($coorporativos)) {
            $sqlCoorpAll = "
                SELECT DISTINCT TRIM(ccte1.nombre) AS id, TRIM(ccte1.nombre) AS label
                FROM sale
                INNER JOIN ccte ON sale.tprocli = ccte.codigo
                INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
                WHERE sale.tline = '601'
                  AND ccte1.nombre IS NOT NULL AND TRIM(ccte1.nombre) != ''
                ORDER BY label ASC
            ";
            $stmtCoorpAll = $this->db->query($sqlCoorpAll);
            $coorporativos = $stmtCoorpAll->fetchAll(PDO::FETCH_ASSOC);
        }

        // 3. Tipos de Documento estándar
        $tdocs = [
            ['id' => '01', 'label' => '01 - Factura'],
            ['id' => '03', 'label' => '03 - Boleta'],
            ['id' => '07', 'label' => '07 - Nota de Crédito'],
            ['id' => '08', 'label' => '08 - Nota de Débito']
        ];

        // 4. Fechas por defecto / límites para 2024
        $sqlFechas = "
            SELECT 
                MIN(tfecfac) AS min_fecha, 
                MAX(tfecfac) AS max_fecha 
            FROM sale 
            WHERE tline = '601' 
              AND tfecfac BETWEEN '2024-01-01' AND '2024-12-31'
        ";
        $stmtFechas = $this->db->query($sqlFechas);
        $fechasRango = $stmtFechas->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'provincias'    => $provincias,
            'coorporativos' => $coorporativos,
            'tdocs'         => $tdocs,
            'fecha_defecto' => [
                'inicio' => '2024-06-01',
                'fin'    => '2024-06-21',
                'min'    => $fechasRango['min_fecha'] ?? '2024-01-01',
                'max'    => $fechasRango['max_fecha'] ?? '2024-12-31'
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
                return Dash_Ventas2024_CantidadHandler::handle($this->db, $filtros);
            case 'Peso':
                return Dash_Ventas2024_PesoHandler::handle($this->db, $filtros);
            case 'Valor':
                return Dash_Ventas2024_ValorHandler::handle($this->db, $filtros);
            case 'Todos':
            default:
                return Dash_Ventas2024_TodosHandler::handle($this->db, $filtros);
        }
    }
}
