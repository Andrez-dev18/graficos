<?php

class DashPresupuesto202403Handler
{
    /**
     * Procesa la consulta para el Dashboard DashPresupuesto202403 (Presupuesto Planta de Alimento)
     * 
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        $codigoPresupuesto = '202403';
        
        $sql = "
            SELECT 
                presupuesto,
                CONCAT(nivel1, ' ', nnivel1) AS n1,
                CONCAT(nivel2, ' ', nnivel2) AS n2,
                nropartida,
                amarre,
                nompartida,
                CAST(valor_presupuesto AS DECIMAL(14,2)) AS presupuestado,
                CAST(valor_regcompras AS DECIMAL(14,2)) AS ejecutado,
                CAST(diferencia AS DECIMAL(14,2)) AS saldo,
                CAST(valord_presupuesto AS DECIMAL(14,2)) AS valord_presupuesto,
                CAST(valord_regcompras AS DECIMAL(14,2)) AS valord_regcompras,
                CAST(diferenciad AS DECIMAL(14,2)) AS diferenciad
            FROM tmppresucencos
            WHERE presupuesto LIKE ?
            ORDER BY onivel1, onivel2, nropartida
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([$codigoPresupuesto . '%']);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totales = [
            'presupuestado'      => 0.0,
            'ejecutado'          => 0.0,
            'saldo'              => 0.0,
            'valord_presupuesto' => 0.0,
            'valord_regcompras'  => 0.0,
            'diferenciad'        => 0.0
        ];

        $nombrePresupuesto = '202403 AMPLIACIÓN PLANTA DE ALIMENTO';

        foreach ($filas as &$f) {
            if (!empty($f['presupuesto'])) {
                $nombrePresupuesto = $f['presupuesto'];
            }
            $f['presupuestado']      = (float)$f['presupuestado'];
            $f['ejecutado']          = (float)$f['ejecutado'];
            $f['saldo']              = (float)$f['saldo'];
            $f['valord_presupuesto'] = (float)$f['valord_presupuesto'];
            $f['valord_regcompras']  = (float)$f['valord_regcompras'];
            $f['diferenciad']        = (float)$f['diferenciad'];

            $totales['presupuestado']      += $f['presupuestado'];
            $totales['ejecutado']          += $f['ejecutado'];
            $totales['saldo']              += $f['saldo'];
            $totales['valord_presupuesto'] += $f['valord_presupuesto'];
            $totales['valord_regcompras']  += $f['valord_regcompras'];
            $totales['diferenciad']        += $f['diferenciad'];
        }
        unset($f);

        return [
            'success'            => true,
            'status'             => 'success',
            'tipo_grafico'       => 'DashPresupuesto202403',
            'titulo'             => 'Presupuesto Planta de Alimento',
            'presupuesto_codigo' => $codigoPresupuesto,
            'presupuesto_nombre' => $nombrePresupuesto,
            'totales'            => $totales,
            'total_registros'    => count($filas),
            'items'              => $filas
        ];
    }
}
