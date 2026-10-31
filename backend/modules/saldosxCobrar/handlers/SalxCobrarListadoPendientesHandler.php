<?php

class SalxCobrarListadoPendientesHandler
{
    private $db;

    private $cuentas = ['121201', '121202', '121204', '121205', '121207', '121210'];

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        $maxFechacarga = null;

        $stmtMax = $this->db->query("SELECT MAX(fechacarga) AS max_fechacarga FROM dmdocventas2");
        if ($stmtMax) {
            $rowMax = $stmtMax->fetch(PDO::FETCH_ASSOC);
            $maxFechacarga = $rowMax['max_fechacarga'] ?? null;
        }

        $vencimientos = [];
        $zonafiscal = [];
        $condicionpago = [];
        $nomdoc = [];

        if ($maxFechacarga !== null && $maxFechacarga !== '') {
            $vencimientos = $this->valoresDistintos('vencimiento', $maxFechacarga);
            $zonafiscal = $this->valoresDistintos('zonafiscal', $maxFechacarga);
            $condicionpago = $this->valoresDistintos('condicionpago', $maxFechacarga);
            $nomdoc = $this->valoresDistintos('nomdoc', $maxFechacarga);
        }

        return [
            'max_fechacarga' => $maxFechacarga,
            'vencimientos' => $vencimientos,
            'zonafiscal' => $zonafiscal,
            'condicionpago' => $condicionpago,
            'nomdoc' => $nomdoc
        ];
    }

    private function valoresDistintos(string $campo, string $fechacarga): array
    {
        $sql = "SELECT DISTINCT {$campo} AS valor
                FROM dmdocventas2
                WHERE fechacarga = :fechacarga
                  AND {$campo} IS NOT NULL
                  AND TRIM({$campo}) <> ''
                ORDER BY {$campo} ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':fechacarga' => $fechacarga]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_values(array_map(function ($row) {
            return $row['valor'];
        }, $rows));
    }

    public function obtenerDatos(array $filtros): array
    {
        $fechaInicio = trim((string)($filtros['fecha_inicio'] ?? ''));
        $fechaFin = trim((string)($filtros['fecha_fin'] ?? ''));
        $fechacarga = trim((string)($filtros['fechacarga'] ?? ''));

        $vencimientos = $this->lista($filtros['vencimientos'] ?? []);
        $condicionpago = $this->lista($filtros['condicionpago'] ?? ($filtros['condicionespago'] ?? []));
        $nomdoc = $this->lista($filtros['nomdoc'] ?? ($filtros['nomdocs'] ?? []));
        $zonafiscal = trim((string)($filtros['zonafiscal'] ?? ''));

        if ($zonafiscal === '(Todo)' || $zonafiscal === 'TODOS' || $zonafiscal === '(Todos)') {
            $zonafiscal = '';
        }

        if ($fechacarga === '') {
            $stmtMax = $this->db->query("SELECT MAX(fechacarga) AS max_fechacarga FROM dmdocventas2");
            if ($stmtMax) {
                $rowMax = $stmtMax->fetch(PDO::FETCH_ASSOC);
                $fechacarga = $rowMax['max_fechacarga'] ?? '';
            }
        }

        if ($fechaInicio === '') {
            $fechaInicio = $fechacarga;
        }
        if ($fechaFin === '') {
            $fechaFin = $fechacarga;
        }

        if ($fechacarga === '' || $fechaInicio === '' || $fechaFin === '') {
            return $this->respuestaVacia('Debe indicar la fecha de carga y el rango de fecha contable.');
        }

        $params = [
            ':fechacarga' => $fechacarga,
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $where = [
            'fechacarga = :fechacarga',
            'fechacontable BETWEEN :fecha_inicio AND :fecha_fin',
            'COALESCE(saldofinal, 0) >= 0.01'
        ];

        $cuentasPhs = [];
        foreach ($this->cuentas as $i => $cuenta) {
            $ph = ':cta_' . $i;
            $cuentasPhs[] = $ph;
            $params[$ph] = $cuenta;
        }
        $where[] = 'cuentaventa IN (' . implode(', ', $cuentasPhs) . ')';

        if (!empty($vencimientos)) {
            $phs = [];
            foreach (array_values($vencimientos) as $i => $valor) {
                $ph = ':venc_' . $i;
                $phs[] = $ph;
                $params[$ph] = $valor;
            }
            $where[] = 'vencimiento IN (' . implode(', ', $phs) . ')';
        }

        if ($zonafiscal !== '') {
            $where[] = 'zonafiscal = :zonafiscal';
            $params[':zonafiscal'] = $zonafiscal;
        }

        if (!empty($condicionpago)) {
            $phs = [];
            foreach (array_values($condicionpago) as $i => $valor) {
                $ph = ':cond_' . $i;
                $phs[] = $ph;
                $params[$ph] = $valor;
            }
            $where[] = 'condicionpago IN (' . implode(', ', $phs) . ')';
        }

        if (!empty($nomdoc)) {
            $phs = [];
            foreach (array_values($nomdoc) as $i => $valor) {
                $ph = ':nomdoc_' . $i;
                $phs[] = $ph;
                $params[$ph] = $valor;
            }
            $where[] = 'nomdoc IN (' . implode(', ', $phs) . ')';
        }

        $sql = "SELECT
                    vencimiento,
                    COALESCE(NULLIF(TRIM(zonafiscal), ''), 'SIN ZONA') AS zonafiscal,
                    cuentaventa,
                    numerodoc,
                    horacreacion,
                    COALESCE(NULLIF(TRIM(condicionpago), ''), '-') AS condicionpago,
                    COALESCE(nomcliente, '') AS nomcliente,
                    COALESCE(nomcorporativo, '') AS nomcorporativo,
                    YEAR(horacreacion) AS anio,
                    ROUND(SUM(COALESCE(diasporvencer, 0)), 2) AS diasporvencer,
                    ROUND(SUM(COALESCE(saldoinicial, 0)), 2) AS saldoinicial,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY
                    vencimiento,
                    zonafiscal,
                    cuentaventa,
                    numerodoc,
                    horacreacion,
                    condicionpago,
                    nomcliente,
                    nomcorporativo
                ORDER BY
                    vencimiento ASC,
                    zonafiscal ASC,
                    cuentaventa ASC,
                    numerodoc DESC,
                    horacreacion DESC,
                    condicionpago ASC,
                    nomcliente ASC,
                    nomcorporativo ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        $totales = [
            'diasporvencer' => 0.0,
            'saldoinicial' => 0.0,
            'saldofinal' => 0.0
        ];
        $anios = [];

        foreach ($rows as $row) {
            $dias = (float)$row['diasporvencer'];
            $saldoInicial = (float)$row['saldoinicial'];
            $saldoFinal = (float)$row['saldofinal'];
            $anio = $row['anio'] !== null ? (int)$row['anio'] : null;

            $data[] = [
                'vencimiento' => $row['vencimiento'],
                'zonafiscal' => $row['zonafiscal'],
                'cuentaventa' => $row['cuentaventa'],
                'numerodoc' => $row['numerodoc'],
                'horacreacion' => $row['horacreacion'],
                'condicionpago' => $row['condicionpago'],
                'nomcliente' => $row['nomcliente'],
                'nomcorporativo' => $row['nomcorporativo'],
                'anio' => $anio,
                'diasporvencer' => $dias,
                'saldoinicial' => $saldoInicial,
                'saldofinal' => $saldoFinal
            ];

            $totales['diasporvencer'] += $dias;
            $totales['saldoinicial'] += $saldoInicial;
            $totales['saldofinal'] += $saldoFinal;

            if ($anio !== null && !in_array($anio, $anios, true)) {
                $anios[] = $anio;
            }
        }

        sort($anios, SORT_NUMERIC);

        return [
            'status' => 'success',
            'fechacarga' => $fechacarga,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'filtros' => [
                'fechacarga' => $fechacarga,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin,
                'vencimientos' => $vencimientos,
                'zonafiscal' => $zonafiscal,
                'condicionpago' => $condicionpago,
                'nomdoc' => $nomdoc
            ],
            'data' => $data,
            'totales' => [
                'diasporvencer' => round($totales['diasporvencer'], 2),
                'saldoinicial' => round($totales['saldoinicial'], 2),
                'saldofinal' => round($totales['saldofinal'], 2)
            ],
            'anios' => $anios,
            'total_registros' => count($data)
        ];
    }

    private function respuestaVacia(string $mensaje): array
    {
        return [
            'status' => 'empty',
            'message' => $mensaje,
            'fechacarga' => '',
            'fecha_inicio' => '',
            'fecha_fin' => '',
            'data' => [],
            'totales' => [
                'diasporvencer' => 0,
                'saldoinicial' => 0,
                'saldofinal' => 0
            ],
            'anios' => [],
            'total_registros' => 0
        ];
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
