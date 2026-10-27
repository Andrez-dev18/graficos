<?php

class SalxCobrarCtaTablaHandler
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
        $cuentas = $this->lista($filtros['cuentas'] ?? []);
        $clientes = $this->lista($filtros['clientes'] ?? []);

        if ($fechaInicio === '' || $fechaFin === '' || empty($cuentas)) {
            return [
                'data' => [],
                'fechas' => [],
                'min_saldofinal' => 0,
                'max_saldofinal' => 0
            ];
        }

        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $where = ["fechacarga BETWEEN :fecha_inicio AND :fecha_fin"];

        $cuentasPhs = [];
        foreach ($cuentas as $i => $cuenta) {
            $ph = ':cta_' . $i;
            $cuentasPhs[] = $ph;
            $params[$ph] = $cuenta;
        }
        $where[] = 'cuentaventa IN (' . implode(', ', $cuentasPhs) . ')';

        if (!empty($clientes)) {
            $clientesPhs = [];
            foreach ($clientes as $i => $cliente) {
                $ph = ':cli_' . $i;
                $clientesPhs[] = $ph;
                $params[$ph] = $cliente;
            }
            $where[] = 'nomcliente IN (' . implode(', ', $clientesPhs) . ')';
        }

        $sql = "SELECT
                    cuentaventa,
                    COALESCE(nomcuentaventa, '') AS nomcuentaventa,
                    COALESCE(NULLIF(TRIM(zonafiscal), ''), 'SIN ZONA') AS zonafiscal,
                    DATE_FORMAT(fechacarga, '%Y-%m-%d') AS fecha,
                    ROUND(SUM(COALESCE(saldoinicial, 0)), 2) AS saldoinicial,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY cuentaventa, nomcuentaventa, zonafiscal, DATE_FORMAT(fechacarga, '%Y-%m-%d')
                ORDER BY cuentaventa ASC, nomcuentaventa ASC, zonafiscal ASC, fecha ASC";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        $min = null;
        $max = null;

        foreach ($rows as $row) {
            $saldoInicial = (float)$row['saldoinicial'];
            $saldoFinal = (float)$row['saldofinal'];

            $data[] = [
                'cuentaventa' => $row['cuentaventa'],
                'nomcuentaventa' => $row['nomcuentaventa'],
                'zonafiscal' => $row['zonafiscal'],
                'fecha' => $row['fecha'],
                'saldoinicial' => $saldoInicial,
                'saldofinal' => $saldoFinal
            ];

            if ($min === null || $saldoFinal < $min) {
                $min = $saldoFinal;
            }
            if ($max === null || $saldoFinal > $max) {
                $max = $saldoFinal;
            }
        }

        $min = $min === null ? 0 : min(0, $min);
        $max = $max === null ? 0 : max(0, $max);

        return [
            'data' => $data,
            'fechas' => $this->rangoFechas($fechaInicio, $fechaFin),
            'min_saldofinal' => round((float)$min, 2),
            'max_saldofinal' => round((float)$max, 2)
        ];
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
