<?php

class CostosTradicionalesRepo
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtiene los registros de la tabla costomen dentro del rango de fechas especificado
     */
    public function getCostosPorPeriodo(string $fechaInicio, string $fechaFin): array
    {
        $sql = "
            SELECT 
                fecha,
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                costoavi,
                pollo_ini,
                saca_und,
                saca_kilos,
                pesoprom,
                ica,
                edadventa,
                mortalidad,
                ganancia,
                calimento,
                costoalim,
                (costoavi / NULLIF(saca_kilos, 0)) AS costo_unitario,
                (costoavi / NULLIF(saca_kilos, 0)) AS costo_produccion_kg,
                (costoalim / NULLIF(saca_kilos, 0)) AS costo_alimentacion_kg,
                ((mortalidad / NULLIF(pollo_ini, 0)) * 100) AS mortalidad_porc
            FROM costomen
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
            ORDER BY fecha ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
