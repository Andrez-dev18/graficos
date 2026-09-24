<?php

class DashPresupuesto202410Handler
{
    /**
     * Procesa la consulta para el Dashboard DashPresupuesto202410 (IMPLEMENTACIÓN EQUIPOS NIR)
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

        $presupuestoNombre = "202410 IMPLEMENTACIÓN EQUIPOS NIR";

        $items = array_map(function ($row) use (&$totales, &$presupuestoNombre) {
            if (!empty($row['presupuesto'])) {
                $presupuestoNombre = $row['presupuesto'];
            }

            $presupuestado      = (float) ($row['presupuestado'] ?? 0);
            $ejecutado          = (float) ($row['ejecutado'] ?? 0);
            $saldo              = (float) ($row['saldo'] ?? 0);
            $valordPresupuesto  = (float) ($row['valord_presupuesto'] ?? 0);
            $valordRegcompras   = (float) ($row['valord_regcompras'] ?? 0);
            $diferenciad        = (float) ($row['diferenciad'] ?? 0);

            $totales['presupuestado']      += $presupuestado;
            $totales['ejecutado']          += $ejecutado;
            $totales['saldo']              += $saldo;
            $totales['valord_presupuesto'] += $valordPresupuesto;
            $totales['valord_regcompras']  += $valordRegcompras;
            $totales['diferenciad']        += $diferenciad;

            return [
                'presupuesto'        => $row['presupuesto'],
                'n1'                 => $row['n1'],
                'n2'                 => $row['n2'],
                'nropartida'         => $row['nropartida'],
                'amarre'             => $row['amarre'],
                'nompartida'         => $row['nompartida'],
                'presupuestado'      => $presupuestado,
                'ejecutado'          => $ejecutado,
                'saldo'              => $saldo,
                'valord_presupuesto' => $valordPresupuesto,
                'valord_regcompras'  => $valordRegcompras,
                'diferenciad'        => $diferenciad
            ];
        }, $filas);

        return [
            'success'            => true,
            'titulo'             => 'Presupuestos Planta Incubacion',
            'presupuesto_nombre' => $presupuestoNombre,
            'totales'            => $totales,
            'items'              => $items
        ];
    }
}
