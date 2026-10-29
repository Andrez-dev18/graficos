<?php

class SalxCobrarCtaFechaDocSegmentadoHandler
{
    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function obtenerDatos(array $filtros): array
    {
        $fechaInicio = trim((string)($filtros['fecha_inicio'] ?? ''));
        $fechaFin = trim((string)($filtros['fecha_fin'] ?? ''));
        $fechacarga = trim((string)($filtros['fechacarga'] ?? ''));

        if ($fechacarga === '') {
            $fechacarga = $fechaFin;
        }

        $cuentas = $this->lista($filtros['cuentas'] ?? []);

        if ($fechaInicio === '' || $fechaFin === '' || $fechacarga === '' || empty($cuentas)) {
            return [
                'data' => [],
                'fechas' => [],
                'fechacarga' => $fechacarga,
                'min_ratio' => 0,
                'max_ratio' => 1
            ];
        }

        $params = [
            ':fechacarga' => $fechacarga,
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $where = [
            'fechacarga = :fechacarga',
            'fechacontable BETWEEN :fecha_inicio AND :fecha_fin'
        ];

        $cuentasPhs = [];
        foreach ($cuentas as $i => $cuenta) {
            $ph = ':cta_' . $i;
            $cuentasPhs[] = $ph;
            $params[$ph] = $cuenta;
        }
        $where[] = 'cuentaventa IN (' . implode(', ', $cuentasPhs) . ')';

        $this->agregarFiltroNullable($where, $params, 'vencimiento', $filtros['vencimientos'] ?? [], 'venc');
        $this->agregarFiltroNullable($where, $params, 'decision', $filtros['decisiones'] ?? [], 'dec');

        $sql = "SELECT
                    cuentaventa,
                    COALESCE(nomcuentaventa, '') AS nomcuentaventa,
                    COALESCE(NULLIF(TRIM(condicionpago), ''), '-') AS condicionpago,
                    COALESCE(NULLIF(TRIM(zonafiscal), ''), 'SIN ZONA') AS zonafiscal,
                    DATE_FORMAT(fechacontable, '%Y-%m-%d') AS fechacontable,
                    ROUND(SUM(COALESCE(saldoinicial, 0)), 2) AS saldoinicial,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal,
                    ROUND(
                        1 - (SUM(COALESCE(saldofinal, 0)) / NULLIF(SUM(COALESCE(saldoinicial, 0)), 0)),
                        2
                    ) AS ratio
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    cuentaventa,
                    nomcuentaventa,
                    condicionpago,
                    zonafiscal,
                    DATE_FORMAT(fechacontable, '%Y-%m-%d')
                HAVING SUM(COALESCE(saldoinicial, 0)) <> 0
                ORDER BY
                    cuentaventa ASC,
                    nomcuentaventa ASC,
                    condicionpago ASC,
                    zonafiscal ASC,
                    fechacontable ASC";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];

        foreach ($rows as $row) {
            $data[] = [
                'cuentaventa' => $row['cuentaventa'],
                'nomcuentaventa' => $row['nomcuentaventa'],
                'condicionpago' => $row['condicionpago'],
                'zonafiscal' => $row['zonafiscal'],
                'fechacontable' => $row['fechacontable'],
                'saldoinicial' => (float)$row['saldoinicial'],
                'saldofinal' => (float)$row['saldofinal'],
                'ratio' => $row['ratio'] !== null ? (float)$row['ratio'] : null
            ];
        }

        return [
            'data' => $data,
            'fechas' => $this->rangoFechas($fechaInicio, $fechaFin),
            'fechacarga' => $fechacarga,
            'min_ratio' => 0,
            'max_ratio' => 1
        ];
    }

    private function agregarFiltroNullable(array &$where, array &$params, string $campo, $valores, string $prefijo): void
    {
        if (empty($valores) || !is_array($valores)) {
            return;
        }

        $tieneNull = in_array('NULL', $valores, true);
        $valoresLimpios = array_filter($valores, function ($v) {
            return $v !== 'NULL';
        });

        $condiciones = [];

        if (!empty($valoresLimpios)) {
            $inPh = [];
            foreach (array_values($valoresLimpios) as $i => $val) {
                $ph = ":fd_{$prefijo}_" . $i;
                $inPh[] = $ph;
                $params[$ph] = $val;
            }
            $condiciones[] = "{$campo} IN (" . implode(', ', $inPh) . ")";
        }

        if ($tieneNull) {
            $condiciones[] = "({$campo} IS NULL OR {$campo} = '')";
        }

        if (!empty($condiciones)) {
            $where[] = '(' . implode(' OR ', $condiciones) . ')';
        }
    }

    private function rangoFechas(string $inicio, string $fin): array
    {
        $fechas = [];

        try {
            $fechaInicio = new DateTime($inicio);
            $fechaFin = new DateTime($fin);
        } catch (Exception $e) {
            return [];
        }

        if ($fechaInicio > $fechaFin) {
            return [];
        }

        while ($fechaInicio <= $fechaFin) {
            $fechas[] = $fechaInicio->format('Y-m-d');
            $fechaInicio->modify('+1 day');
        }

        return $fechas;
    }

    private function lista($valor): array
    {
        if (!is_array($valor)) {
            $valor = [$valor];
        }

        $valores = array_map(function ($item) {
            return trim((string)$item);
        }, $valor);

        return array_values(array_filter($valores, function ($item) {
            return $item !== '';
        }));
    }
}
