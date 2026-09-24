<?php

class DashPresupuesto202410PctHandler
{
    /**
     * Procesa la consulta para el Dashboard DashPresupuesto202410% (Resumen por N1 con % de avance)
     * 
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        $codigoPresupuesto = '202410';
        
        $sql = "
            SELECT 
                presupuesto,
                CONCAT(nivel1, ' ', nnivel1) AS n1,
                SUM(CAST(valor_presupuesto AS DECIMAL(14,2))) AS presupuestado,
                SUM(CAST(valor_regcompras AS DECIMAL(14,2))) AS ejecutado,
                SUM(CAST(diferencia AS DECIMAL(14,2))) AS saldo,
                CASE 
                    WHEN SUM(CAST(valor_presupuesto AS DECIMAL(14,2))) > 0 
                    THEN (SUM(CAST(valor_regcompras AS DECIMAL(14,2))) / SUM(CAST(valor_presupuesto AS DECIMAL(14,2)))) * 100 
                    ELSE 0 
                END AS porcentaje_avance
            FROM tmppresucencos
            WHERE presupuesto LIKE ?
            GROUP BY presupuesto, onivel1, nivel1, nnivel1
            ORDER BY onivel1
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([$codigoPresupuesto . '%']);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totales = [
            'presupuestado'      => 0.0,
            'ejecutado'          => 0.0,
            'saldo'              => 0.0,
            'porcentaje_avance'  => 0.0
        ];

        $presupuestoNombre = "202410 IMPLEMENTACIÓN EQUIPOS NIR";

        $items = array_map(function ($row) use (&$totales, &$presupuestoNombre) {
            if (!empty($row['presupuesto'])) {
                $presupuestoNombre = $row['presupuesto'];
            }

            $presupuestado      = (float) ($row['presupuestado'] ?? 0);
            $ejecutado          = (float) ($row['ejecutado'] ?? 0);
            $saldo              = (float) ($row['saldo'] ?? 0);
            $porcentajeAvance   = (float) ($row['porcentaje_avance'] ?? 0);

            $totales['presupuestado']      += $presupuestado;
            $totales['ejecutado']          += $ejecutado;
            $totales['saldo']              += $saldo;

            return [
                'presupuesto'        => $row['presupuesto'],
                'n1'                 => $row['n1'],
                'presupuestado'      => $presupuestado,
                'ejecutado'          => $ejecutado,
                'saldo'              => $saldo,
                'porcentaje_avance'  => $porcentajeAvance
            ];
        }, $filas);

        if ($totales['presupuestado'] > 0) {
            $totales['porcentaje_avance'] = ($totales['ejecutado'] / $totales['presupuestado']) * 100;
        }

        return [
            'success'            => true,
            'titulo'             => 'Presupuestos Planta Incubacion',
            'presupuesto_nombre' => $presupuestoNombre,
            'totales'            => $totales,
            'items'              => $items
        ];
    }
}
