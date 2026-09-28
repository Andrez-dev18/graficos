<?php

require_once __DIR__ . '/handlers/Dash_EEGGyPPHandler.php';
require_once __DIR__ . '/handlers/Dash_EEGGyPP_ASOHandler.php';

class EEGGyPPService
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltrosIniciales(): array
    {
        // 1. Procesos
        $sqlProc = "
            SELECT DISTINCT 
                CASE tctafun 
                    WHEN '7023102' THEN 'BENEFICIADO' 
                    WHEN '7023105' THEN 'TROZADO' 
                    WHEN '7023104' THEN 'MARINADO' 
                    ELSE COALESCE(desproc, 'OTROS') 
                END AS id,
                CASE tctafun 
                    WHEN '7023102' THEN 'BENEFICIADO' 
                    WHEN '7023105' THEN 'TROZADO' 
                    WHEN '7023104' THEN 'MARINADO' 
                    ELSE COALESCE(desproc, 'OTROS') 
                END AS label
            FROM tmppedido_tableau
            WHERE tctafun IS NOT NULL AND tctafun != ''
            ORDER BY label ASC
        ";
        $stmtProc = $this->db->query($sqlProc);
        $procesos = $stmtProc->fetchAll(PDO::FETCH_ASSOC);

        // 2. Provincias
        $sqlProv = "
            SELECT DISTINCT TRIM(provin) AS id, TRIM(provin) AS label
            FROM tmppedido_tableau
            WHERE provin IS NOT NULL AND TRIM(provin) != ''
            ORDER BY label ASC
        ";
        $stmtProv = $this->db->query($sqlProv);
        $provincias = $stmtProv->fetchAll(PDO::FETCH_ASSOC);

        // 3. Zonas (depart)
        $sqlZona = "
            SELECT DISTINCT TRIM(depart) AS id, TRIM(depart) AS label
            FROM tmppedido_tableau
            WHERE depart IS NOT NULL AND TRIM(depart) != ''
            ORDER BY label ASC
        ";
        $stmtZona = $this->db->query($sqlZona);
        $zonas = $stmtZona->fetchAll(PDO::FETCH_ASSOC);

        // 4. Mapeo de Zonas por Provincia para Filtros Cascada
        $sqlProvZona = "
            SELECT DISTINCT TRIM(provin) AS provincia, TRIM(depart) AS zona
            FROM tmppedido_tableau
            WHERE provin IS NOT NULL AND TRIM(provin) != '' AND depart IS NOT NULL AND TRIM(depart) != ''
            ORDER BY provincia ASC, zona ASC
        ";
        $stmtProvZona = $this->db->query($sqlProvZona);
        $provZonas = $stmtProvZona->fetchAll(PDO::FETCH_ASSOC);

        return [
            'procesos'   => $procesos,
            'provincias' => $provincias,
            'zonas'      => $zonas,
            'prov_zonas' => $provZonas
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = $filtros['tipo_grafico'] ?? 'Dash_EEGGyPP';

        switch ($tipoGrafico) {
            case 'Dash_EEGGyPP_ASO':
                return Dash_EEGGyPP_ASOHandler::handle($this->db, $filtros);
            case 'Dash_EEGGyPP':
            case 'Dash_EEGGyPP_Res_ASO':
            case 'Dash_EEGGyPP_Huertas':
            default:
                return Dash_EEGGyPPHandler::handle($this->db, $filtros);
        }
    }
}
