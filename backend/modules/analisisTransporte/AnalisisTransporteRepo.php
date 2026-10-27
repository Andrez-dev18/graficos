<?php

class AnalisisTransporteRepo
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function getLiquidacionPlacas(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d', strtotime('-7 days'));
        $fechaFin = $filtros['fecha_fin'] ?? date('Y-m-d');

        $sql = "SELECT
                    DATE_FORMAT(m.tfecfac, '%Y-%m-%d') AS fecha,
                    TRIM(m.tprocli) AS cliente,
                    TRIM(m.tplaca) AS placa,
                    TRIM(m.tcodigo) AS coditem,
                    TRIM(m.tcodtra) AS codtra,
                    TRIM(c.descri) AS descri,
                    SUM(IF(LEFT(m.tcodtra, 1) = 'E', m.tcantid, -m.tcantid)) AS cant,
                    SUM(IF(LEFT(m.tcodtra, 1) = 'E', m.tpeso, -m.tpeso)) AS peso
                FROM movi_produccion m
                LEFT JOIN coal c ON c.codtra = m.tcodtra
                WHERE m.tfecfac BETWEEN :f_ini AND :f_fin
                  AND m.talm = 'A10'
                GROUP BY DATE_FORMAT(m.tfecfac, '%Y-%m-%d'), TRIM(m.tprocli), TRIM(m.tplaca), TRIM(m.tcodigo), TRIM(m.tcodtra), TRIM(c.descri)
                ORDER BY fecha ASC, cliente ASC, placa ASC, coditem ASC, codtra ASC";

        $stmt = ($this->conn instanceof SmartPDO)
            ? $this->conn->prepareNative('principal', $sql)
            : $this->conn->prepare($sql);
        $stmt->execute([
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
