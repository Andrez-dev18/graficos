<?php

require_once __DIR__ . '/PPPTCommonHelper.php';

class DashPPResuHandler
{
    /**
     * Procesa la consulta para el Dashboard PPResu (Resumen Producto en Proceso por Centro de Costo)
     * 
     * @param PDO $db
     * @param array $filtros
     * @return array
     */
    public static function handle(PDO $db, array $filtros): array
    {
        // 1. Resolver año y periodo (formato YYYY/MM)
        $anio = PPPTCommonHelper::resolverAnio($filtros);
        $tfectra = PPPTCommonHelper::resolverTfectra($filtros, $anio);

        // 2. Obtener catálogo de opciones del año seleccionado
        $opciones = PPPTCommonHelper::obtenerOpciones($db, $anio);
        $opcionesActividad = $opciones['actividades'];
        $opcionesMeses = $opciones['meses'];

        // 3. Validar actividades contra las opciones reales del año
        $actividades = PPPTCommonHelper::resolverActividades($filtros['actividad'] ?? ['AV'], $opcionesActividad);

        // 4. Construcción de consulta agregada por Centro de Costos exacta según Tableau
        $inActividades = implode(',', array_fill(0, count($actividades), '?'));
        
        $sql = "
            SELECT 
                p.tcencos AS cencos,
                COALESCE(c.nombre, '') AS nombre,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 1 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 1 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g1,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 2 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 2 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g2,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 3 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 3 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g3,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 4 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 4 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g4,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 5 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 5 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g5,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 6 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 6 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g6,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 7 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 7 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g7,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 8 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 8 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g8,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 9 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 9 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g9,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 10 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 10 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g10,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 11 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 11 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g11,
                CASE WHEN COUNT(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 12 THEN 1 END) > 0 THEN SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 12 THEN p.timfipp ELSE 0 END) ELSE NULL END AS g12,
                SUM(p.timfipp) AS total
            FROM preal p
            LEFT JOIN ccos c ON p.tcencos = c.codigo
            WHERE p.tfectra = ?
              AND p.actividad IN ({$inActividades})
            GROUP BY p.tcencos, c.nombre
            ORDER BY p.tcencos ASC
        ";

        $params = array_merge([$tfectra], $actividades);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 5. Normalizar valores numéricos, calcular totales generales y máximos para barras
        $totales = [
            'g1' => 0.0, 'g2' => 0.0, 'g3' => 0.0, 'g4' => 0.0,
            'g5' => 0.0, 'g6' => 0.0, 'g7' => 0.0, 'g8' => 0.0,
            'g9' => 0.0, 'g10' => 0.0, 'g11' => 0.0, 'g12' => 0.0,
            'total' => 0.0
        ];

        $maxRowTotal = 0.0;
        $maxGalponVal = 0.0;

        foreach ($filas as &$f) {
            for ($i = 1; $i <= 12; $i++) {
                $k = "g{$i}";
                if ($f[$k] !== null) {
                    $f[$k] = (float)$f[$k];
                    $totales[$k] += $f[$k];
                    if ($f[$k] > $maxGalponVal) {
                        $maxGalponVal = $f[$k];
                    }
                } else {
                    $f[$k] = null;
                }
            }
            $f['total'] = (float)($f['total'] ?? 0);
            $totales['total'] += $f['total'];
            if ($f['total'] > $maxRowTotal) {
                $maxRowTotal = $f['total'];
            }
        }
        unset($f);

        return [
            'status' => 'success',
            'tipo_grafico' => 'PPResu',
            'anio' => $anio,
            'tfectra' => $tfectra,
            'actividades_seleccionadas' => $actividades,
            'opciones_filtros' => [
                'actividades' => $opcionesActividad,
                'meses' => $opcionesMeses
            ],
            'totales' => $totales,
            'max_total' => $maxRowTotal,
            'max_galpon' => $maxGalponVal,
            'total_registros' => count($filas),
            'filas' => $filas
        ];
    }
}
