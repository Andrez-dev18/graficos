<?php

class TransportesRepo
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    /**
     * Consulta las métricas de Totales Diarios y Tendencia Diaria (Nivel 1)
     */
    public function getMetricasDiarias(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d', strtotime('-7 days'));
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');

        $sql = "SELECT 
                    fechaproceso,
                    COUNT(*) AS total_despachos,
                    SUM(CASE WHEN LOWER(TRIM(validador)) = 'completo' THEN 1 ELSE 0 END) AS cant_completo,
                    SUM(CASE WHEN LOWER(TRIM(validador)) = 'incompleto' THEN 1 ELSE 0 END) AS cant_incompleto,
                    ROUND((SUM(CASE WHEN LOWER(TRIM(validador)) = 'completo' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS pct_completo,
                    ROUND((SUM(CASE WHEN LOWER(TRIM(validador)) = 'incompleto' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) AS pct_incompleto
                FROM dmtransporte
                WHERE fechaproceso BETWEEN :f_ini AND :f_fin
                  AND validador IS NOT NULL 
                  AND TRIM(validador) != ''
                GROUP BY fechaproceso
                ORDER BY fechaproceso ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta la tabla maestra Hojas de Ruta agrupando duplicados (Nivel 2)
     */
    public function getHojasRuta(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d', strtotime('-7 days'));
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $validador   = trim($filtros['validador'] ?? 'TODO');
        $fechaFiltro = trim($filtros['fecha_proceso'] ?? '');

        $params = [];
        $where = ["validador IS NOT NULL AND TRIM(validador) != ''"];

        if (!empty($fechaFiltro)) {
            $where[] = "fechaproceso = :f_proc";
            $params[':f_proc'] = $fechaFiltro;
        } else {
            $where[] = "fechaproceso BETWEEN :f_ini AND :f_fin";
            $params[':f_ini'] = $fechaInicio;
            $params[':f_fin'] = $fechaFin;
        }

        if (!empty($validador) && strtoupper($validador) !== 'TODO') {
            $where[] = "LOWER(TRIM(validador)) = :validador";
            $params[':validador'] = strtolower($validador);
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    COALESCE(NULLIF(TRIM(zona), ''), 'SIN ZONA') AS zona,
                    TRIM(transportista) AS transportista,
                    TRIM(chofer) AS chofer,
                    TRIM(placa) AS placa,
                    LOWER(TRIM(validador)) AS validador
                FROM dmtransporte
                WHERE {$whereStr}
                GROUP BY fechaproceso, zona, transportista, chofer, placa, LOWER(TRIM(validador))
                ORDER BY fechaproceso DESC, zona ASC, transportista ASC, chofer ASC, placa ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta los eventos cronológicos de Detalle de Ruta desde dmtransportes (Nivel 3)
     */
    public function getDetalleEventosRuta(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d', strtotime('-7 days'));
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $fechaFiltro = trim($filtros['fecha_proceso'] ?? '');
        $validador   = trim($filtros['validador'] ?? 'TODO');
        $placaFiltro = trim($filtros['placa'] ?? '');

        $params = [];
        $where = ["fechaproceso IS NOT NULL"];

        if (!empty($fechaFiltro)) {
            $where[] = "fechaproceso = :f_proc";
            $params[':f_proc'] = $fechaFiltro;
        } else {
            $where[] = "fechaproceso BETWEEN :f_ini AND :f_fin";
            $params[':f_ini'] = $fechaInicio;
            $params[':f_fin'] = $fechaFin;
        }

        if (!empty($validador) && strtoupper($validador) !== 'TODO') {
            $where[] = "LOWER(TRIM(validador)) = :validador";
            $params[':validador'] = strtolower($validador);
        }

        if (!empty($placaFiltro) && strtoupper($placaFiltro) !== 'TODO') {
            $where[] = "REPLACE(TRIM(placa), '-', '') = :placa_clean";
            $params[':placa_clean'] = str_replace('-', '', $placaFiltro);
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    COALESCE(NULLIF(TRIM(zona), ''), 'SIN ZONA') AS zona,
                    TRIM(placa) AS placa,
                    dia,
                    hora,
                    TRIM(tipo) AS tipo,
                    LOWER(TRIM(validador)) AS validador
                FROM dmtransportes
                WHERE {$whereStr}
                ORDER BY zona ASC, placa ASC, dia ASC, hora ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}