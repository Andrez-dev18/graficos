<?php

require_once __DIR__ . '/PPPTCommonHelper.php';

class DashPTHandler
{
    /**
     * Procesa la consulta para el Dashboard PT (Producto Terminado) de PPT 2026
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

        // 4. Construcción de consulta principal con ordenamiento idéntico a Tableau
        $inActividades = implode(',', array_fill(0, count($actividades), '?'));
        
        $sql = "
            SELECT 
                p.tcencos AS cencos,
                COALESCE(c.nombre, '') AS nombre,
                p.tcodigo AS codigo_costo,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 1 THEN p.timfipt ELSE 0 END) AS g1,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 2 THEN p.timfipt ELSE 0 END) AS g2,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 3 THEN p.timfipt ELSE 0 END) AS g3,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 4 THEN p.timfipt ELSE 0 END) AS g4,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 5 THEN p.timfipt ELSE 0 END) AS g5,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 6 THEN p.timfipt ELSE 0 END) AS g6,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 7 THEN p.timfipt ELSE 0 END) AS g7,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 8 THEN p.timfipt ELSE 0 END) AS g8,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 9 THEN p.timfipt ELSE 0 END) AS g9,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 10 THEN p.timfipt ELSE 0 END) AS g10,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 11 THEN p.timfipt ELSE 0 END) AS g11,
                SUM(CASE WHEN CAST(p.tcodint AS UNSIGNED) = 12 THEN p.timfipt ELSE 0 END) AS g12,
                SUM(p.timfipt) AS total
            FROM preal p
            LEFT JOIN ccos c ON p.tcencos = c.codigo
            WHERE p.tfectra = ?
              AND p.actividad IN ({$inActividades})
            GROUP BY p.tcencos, c.nombre, p.tcodigo
            HAVING total > 0.0001
            ORDER BY 
                p.tcencos,
                CASE WHEN p.tcodigo REGEXP '^[0-9]+$' THEN 0 ELSE 1 END ASC,
                LENGTH(p.tcodigo) ASC, 
                p.tcodigo ASC
        ";

        $params = array_merge([$tfectra], $actividades);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // 5. Normalizar valores numéricos y calcular totales generales
        $totales = [
            'g1' => 0.0, 'g2' => 0.0, 'g3' => 0.0, 'g4' => 0.0,
            'g5' => 0.0, 'g6' => 0.0, 'g7' => 0.0, 'g8' => 0.0,
            'g9' => 0.0, 'g10' => 0.0, 'g11' => 0.0, 'g12' => 0.0,
            'total' => 0.0
        ];

        foreach ($filas as &$f) {
            for ($i = 1; $i <= 12; $i++) {
                $k = "g{$i}";
                $f[$k] = (float)($f[$k] ?? 0);
                $totales[$k] += $f[$k];
            }
            $f['total'] = (float)($f['total'] ?? 0);
            $totales['total'] += $f['total'];
        }
        unset($f);

        return [
            'status' => 'success',
            'tipo_grafico' => 'PT',
            'anio' => $anio,
            'tfectra' => $tfectra,
            'actividades_seleccionadas' => $actividades,
            'opciones_filtros' => [
                'actividades' => $opcionesActividad,
                'meses' => $opcionesMeses
            ],
            'totales' => $totales,
            'total_registros' => count($filas),
            'filas' => $filas
        ];
    }
}
