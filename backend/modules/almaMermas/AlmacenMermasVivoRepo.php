<?php

class AlmacenMermasVivoRepo
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    /**
     * Consulta Porcentaje de Merma Diaria por Fecha de Proceso / Cliente / Placa
     */
    public function getPorcMermaProcesoDiaClientePlaca(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'Valor');

        // Si viene 'TODO', usamos 'Valor' por defecto para no distorsionar el cálculo ponderado
        if (empty($dato) || strtoupper($dato) === 'TODO') {
            $dato = 'Valor';
        }

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin,
            ':dato'  => $dato
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "cliente IS NOT NULL AND cliente != ''",
            "placa IS NOT NULL AND TRIM(placa) != ''",
            "TRIM(dato) = :dato"
        ];

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    TRIM(dato) AS dato,
                    ROUND(COALESCE(SUM(entrada), 0), 2) AS total_entrada,
                    -- Las 8 métricas porcentuales de la matriz de Tableau
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatotal,
                    ROUND(COALESCE((SUM(mermaalmacenaje) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermaalmacenaje,
                    ROUND(COALESCE((SUM(mermamuertodistribucion) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertodistribucion,
                    ROUND(COALESCE((SUM(mermamuertotransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertotransporte,
                    ROUND(COALESCE((SUM(mermanoapto) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermanoapto,
                    ROUND(COALESCE((SUM(mermatransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransporte,
                    ROUND(COALESCE((SUM(mermatransbenemanual) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemanual,
                    ROUND(COALESCE((SUM(mermatransbenemecani) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemecani,
                    -- Valores absolutos
                    ROUND(COALESCE(SUM(mermatotal), 0), 2) AS sum_mermatotal,
                    ROUND(COALESCE(SUM(mermatransporte), 0), 2) AS sum_mermatransporte,
                    ROUND(COALESCE(SUM(mermamuertotransporte), 0), 2) AS sum_mermamuertotransporte,
                    ROUND(COALESCE(SUM(mermatransbenemecani), 0), 2) AS sum_mermatransbenemecani
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY fechaproceso, TRIM(cliente), TRIM(placa), TRIM(dato)
                ORDER BY fechaproceso ASC, cliente ASC, placa ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}