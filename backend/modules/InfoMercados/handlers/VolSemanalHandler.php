<?php

class VolSemanalHandler
{
    /**
     * Volumen semanal de Arequipa para el año solicitado.
     *
     * @param PDO $db
     * @param string $anio
     * @return array
     */
    public static function handle(PDO $db, string $anio = '2026'): array
    {
        $fechaInicio = $anio . '-01-01';
        $fechaFin = ((int)$anio + 1) . '-01-01';

        $sql = "
            SELECT
                WEEK(a.fecha, 3) AS semana,
                SUM(a.cantidad) AS cantidad
            FROM com_db_vivo_aqp a
            INNER JOIN com_mercado m   ON a.mercado   = m.codigo
            INNER JOIN com_empresa e   ON a.empresa   = e.codigo
            INNER JOIN com_condicion c ON a.condicion = c.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            WHERE a.fecha >= ?
              AND a.fecha < ?
            GROUP BY WEEK(a.fecha, 3)
            ORDER BY semana ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([$fechaInicio, $fechaFin]);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $porSemana = [];
        foreach ($filas as $fila) {
            $semana = (int)($fila['semana'] ?? 0);
            if ($semana >= 1 && $semana <= 53) {
                $porSemana[$semana] = (float)($fila['cantidad'] ?? 0);
            }
        }

        $semanas = [];
        $total = 0.0;

        for ($semana = 1; $semana <= 53; $semana++) {
            $cantidad = array_key_exists($semana, $porSemana)
                ? round($porSemana[$semana], 2)
                : null;

            if ($cantidad !== null) {
                $total += $cantidad;
            }

            $semanas[] = [
                'semana' => $semana,
                'label' => 'Semana ' . $semana,
                'cantidad' => $cantidad
            ];
        }

        return [
            'titulo' => 'Volumen Semanal Arequipa',
            'anio' => $anio,
            'semanas' => $semanas,
            'total' => round($total, 2)
        ];
    }
}
