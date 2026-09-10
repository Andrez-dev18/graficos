<?php

class CostosDiasRepo
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtiene la métrica consolidada mensual para la Gráfica de Costo
     */
    public function getGraficaCosto(string $periodoIni, string $periodoFin): array
    {
        $sql = "
            SELECT 
                tanio,
                tmes,
                tnomMes,
                SUM(timporte) as sum_importe,
                MAX(tpes_mes) as pes_mes,
                (SUM(timporte) / NULLIF(MAX(tpes_mes), 0)) as cu
            FROM dmcostofamilia
            WHERE CONCAT(tanio, LPAD(tmes, 2, '0')) BETWEEN :periodo_ini AND :periodo_fin
            GROUP BY tanio, tmes, tnomMes
            ORDER BY tanio ASC, CAST(tmes AS UNSIGNED) ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':periodo_ini' => $periodoIni,
            ':periodo_fin' => $periodoFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene la matriz detallada por Familia, SubFamilia y Mes
     */
    public function getMatrizCostos(string $periodoIni, string $periodoFin): array
    {
        $sql = "
            SELECT 
                tcodgrupo1,
                tdesgrupo1,
                CONCAT(tcodgrupo1, ' ', tdesgrupo1) as familia,
                tcodgrupo2,
                tdesgrupo2,
                CONCAT(tcodgrupo2, ' ', tdesgrupo2) as subfamilia,
                tanio,
                tmes,
                tnomMes,
                SUM(timporte) as sum_importe,
                MAX(tpes_mes) as pes_mes,
                (SUM(timporte) / NULLIF(MAX(tpes_mes), 0)) as cu
            FROM dmcostofamilia
            WHERE CONCAT(tanio, LPAD(tmes, 2, '0')) BETWEEN :periodo_ini AND :periodo_fin
            GROUP BY tcodgrupo1, tdesgrupo1, tcodgrupo2, tdesgrupo2, tanio, tmes, tnomMes
            ORDER BY CAST(tcodgrupo1 AS UNSIGNED) ASC, CAST(tcodgrupo2 AS DECIMAL(10,2)) ASC, tanio ASC, CAST(tmes AS UNSIGNED) ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':periodo_ini' => $periodoIni,
            ':periodo_fin' => $periodoFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
