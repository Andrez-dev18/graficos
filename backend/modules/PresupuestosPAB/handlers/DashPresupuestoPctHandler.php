<?php

class DashPresupuestoPctHandler
{
    /**
     * Procesa el resumen por N1 con porcentaje de avance para cualquier presupuesto.
     *
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        $codigoPresupuesto = self::obtenerCodigo($filtros);

        $sql = "
            SELECT 
                presupuesto,
                CONCAT(nivel1, ' ', nnivel1) AS n1,
                SUM(CAST(valor_presupuesto AS DECIMAL(14,2))) AS presupuestado,
                SUM(CAST(valor_regcompras AS DECIMAL(14,2))) AS ejecutado,
                SUM(CAST(diferencia AS DECIMAL(14,2))) AS saldo,
                SUM(CAST(valord_presupuesto AS DECIMAL(14,2))) AS valord_presupuesto,
                SUM(CAST(valord_regcompras AS DECIMAL(14,2))) AS valord_regcompras,
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
            'valord_presupuesto' => 0.0,
            'valord_regcompras'  => 0.0,
            'porcentaje_avance'  => 0.0
        ];

        $presupuestoNombre = $codigoPresupuesto;

        $items = array_map(function ($row) use (&$totales, &$presupuestoNombre) {
            if (!empty($row['presupuesto'])) {
                $presupuestoNombre = $row['presupuesto'];
            }

            $presupuestado      = (float) ($row['presupuestado'] ?? 0);
            $ejecutado          = (float) ($row['ejecutado'] ?? 0);
            $saldo              = (float) ($row['saldo'] ?? 0);
            $valordPresupuesto  = (float) ($row['valord_presupuesto'] ?? 0);
            $valordRegcompras   = (float) ($row['valord_regcompras'] ?? 0);
            $porcentajeAvance   = (float) ($row['porcentaje_avance'] ?? 0);

            $totales['presupuestado']      += $presupuestado;
            $totales['ejecutado']          += $ejecutado;
            $totales['saldo']              += $saldo;
            $totales['valord_presupuesto'] += $valordPresupuesto;
            $totales['valord_regcompras']  += $valordRegcompras;

            return [
                'presupuesto'        => $row['presupuesto'],
                'n1'                 => $row['n1'],
                'presupuestado'      => $presupuestado,
                'ejecutado'          => $ejecutado,
                'saldo'              => $saldo,
                'valord_presupuesto' => $valordPresupuesto,
                'valord_regcompras'  => $valordRegcompras,
                'porcentaje_avance'  => $porcentajeAvance
            ];
        }, $filas);

        if ($totales['presupuestado'] > 0) {
            $totales['porcentaje_avance'] = ($totales['ejecutado'] / $totales['presupuestado']) * 100;
        }

        return [
            'success'            => true,
            'status'             => 'success',
            'tipo_grafico'       => 'DashPresupuestoPct',
            'tipo_reporte'       => 'DashPresupuesto' . $codigoPresupuesto . '%',
            'presupuesto_codigo' => $codigoPresupuesto,
            'titulo'             => $presupuestoNombre,
            'presupuesto_nombre' => $presupuestoNombre,
            'totales'            => $totales,
            'total_registros'    => count($items),
            'items'              => $items
        ];
    }

    private static function obtenerCodigo(array $filtros): string
    {
        $codigo = trim((string) ($filtros['presupuesto'] ?? $filtros['codigo_presupuesto'] ?? '202403'));

        if (preg_match('/^(\d{6})/', $codigo, $coincidencia)) {
            return $coincidencia[1];
        }

        return '202403';
    }
}
