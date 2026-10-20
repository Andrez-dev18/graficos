<?php

class DashPresupuestoDetalleHandler
{
    /**
     * Procesa el detalle de cualquier presupuesto según su código de 6 dígitos.
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
            'status'             => 'success',
            'tipo_grafico'       => 'DashPresupuestoDetalle',
            'tipo_reporte'       => 'DashPresupuesto' . $codigoPresupuesto,
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
