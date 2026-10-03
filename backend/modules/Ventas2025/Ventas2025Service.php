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

    public function obtenerFiltrosIniciales(string $anio = '2025'): array
    {
        $minAnioFec = "{$anio}-01-01";
        $maxAnioFec = "{$anio}-12-31";

        // 1. Provincias disponibles (activas en ventas)
        $provincias = [];
        try {
            $sqlProv = "
                SELECT DISTINCT TRIM(ccte.provincia) AS id, TRIM(ccte.provincia) AS label
                FROM sale
                INNER JOIN ccte ON sale.tprocli = ccte.codigo
                WHERE sale.tline = '601' 
                  AND sale.tfecfac >= :fecMin 
                  AND sale.tfecfac <= :fecMax
                  AND ccte.provincia IS NOT NULL 
                  AND TRIM(ccte.provincia) != ''
                ORDER BY label ASC
            ";
            $stmtProv = $this->db->prepare($sqlProv);
            $stmtProv->execute(['fecMin' => $minAnioFec, 'fecMax' => $maxAnioFec]);
            $provincias = $stmtProv->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            try {
                $sqlProvFallback = "
                    SELECT DISTINCT TRIM(ccte.provincia) AS id, TRIM(ccte.provincia) AS label
                    FROM sale
                    INNER JOIN ccte ON sale.tprocli = ccte.codigo
                    WHERE sale.tline = '601'
                      AND ccte.provincia IS NOT NULL 
                      AND TRIM(ccte.provincia) != ''
                    ORDER BY label ASC
                ";
                $stmtProv = $this->db->query($sqlProvFallback);
                $provincias = $stmtProv ? $stmtProv->fetchAll(PDO::FETCH_ASSOC) : [];
            } catch (Exception $ex) {
                $provincias = [];
            }
        }

        // 2. Corporativos disponibles (activos en ventas)
        $coorporativos = [];
        try {
            $sqlCoorp = "
                SELECT DISTINCT TRIM(ccte1.nombre) AS id, TRIM(ccte1.nombre) AS label
                FROM sale
                INNER JOIN ccte ON sale.tprocli = ccte.codigo
                INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
                WHERE sale.tline = '601' 
                  AND sale.tfecfac >= :fecMin 
                  AND sale.tfecfac <= :fecMax
                  AND ccte1.nombre IS NOT NULL 
                  AND TRIM(ccte1.nombre) != ''
                ORDER BY label ASC
            ";
            $stmtCoorp = $this->db->prepare($sqlCoorp);
            $stmtCoorp->execute(['fecMin' => $minAnioFec, 'fecMax' => $maxAnioFec]);
            $coorporativos = $stmtCoorp->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            try {
                $sqlCoorpFallback = "
                    SELECT DISTINCT TRIM(ccte1.nombre) AS id, TRIM(ccte1.nombre) AS label
                    FROM sale
                    INNER JOIN ccte ON sale.tprocli = ccte.codigo
                    INNER JOIN ccte AS ccte1 ON ccte.ruc = ccte1.codigo
                    WHERE sale.tline = '601' 
                      AND ccte1.nombre IS NOT NULL 
                      AND TRIM(ccte1.nombre) != ''
                    ORDER BY label ASC
                ";
                $stmtCoorp = $this->db->query($sqlCoorpFallback);
                $coorporativos = $stmtCoorp ? $stmtCoorp->fetchAll(PDO::FETCH_ASSOC) : [];
            } catch (Exception $ex) {
                $coorporativos = [];
            }
        }

        // 3. Tipos de Documento estándar
        $tdocs = [
            ['id' => '01', 'label' => '01 - Factura'],
            ['id' => '03', 'label' => '03 - Boleta'],
            ['id' => '07', 'label' => '07 - Nota de Crédito'],
            ['id' => '08', 'label' => '08 - Nota de Débito']
        ];

        // 4. Fechas por defecto / límites
        $minFecha = "{$anio}-01-01";
        $maxFecha = "{$anio}-12-31";
        try {
            $sqlFechas = "
                SELECT 
                    MIN(tfecfac) AS min_fecha, 
                    MAX(tfecfac) AS max_fecha 
                FROM sale 
                WHERE tline = '601' AND tfecfac != '0000-00-00'
                  AND tfecfac >= '{$anio}-01-01' AND tfecfac <= '{$anio}-12-31'
            ";
            $stmtFechas = $this->db->query($sqlFechas);
            $fechasRango = $stmtFechas ? $stmtFechas->fetch(PDO::FETCH_ASSOC) : [];
            if (!empty($fechasRango['min_fecha'])) $minFecha = $fechasRango['min_fecha'];
            if (!empty($fechasRango['max_fecha'])) $maxFecha = $fechasRango['max_fecha'];
        } catch (Exception $e) {
            // mantener valores por defecto
        }

        return [
            'provincias'    => $provincias,
            'coorporativos' => $coorporativos,
            'tdocs'         => $tdocs,
            'fecha_defecto' => [
                'inicio' => $minFecha,
                'fin'    => $maxFecha,
                'min'    => "{$anio}-01-01",
                'max'    => "{$anio}-12-31"
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
