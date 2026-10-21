<?php

date_default_timezone_set('America/Lima');

class AnalisisPT0Repository
{
    private $conn;

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    public function obtenerRangoDisponible(?string $anio = null): array
    {
        $filtroAnio = '';
        $params = [];

        if ($anio !== null && preg_match('/^\d{4}$/', $anio)) {
            $filtroAnio = " AND tfectra BETWEEN ? AND ?";
            $params[] = $anio . '-01-01';
            $params[] = $anio . '-12-31';
        }

        $sql = "
            SELECT
                DATE_FORMAT(MIN(tfectra), '%Y-%m-%d') AS fecha_min,
                DATE_FORMAT(MAX(tfectra), '%Y-%m-%d') AS fecha_max
            FROM movi_produccion
            WHERE talm = 'PT0'
              AND tfectra IS NOT NULL
              {$filtroAnio}
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$fila || empty($fila['fecha_max'])) {
            return [
                'fecha_min'          => null,
                'fecha_max'          => null,
                'ultimo_mes_inicio'  => null,
                'ultimo_mes_fin'     => null
            ];
        }

        $fechaMax = new DateTimeImmutable($fila['fecha_max']);

        return [
            'fecha_min'          => $fila['fecha_min'],
            'fecha_max'          => $fila['fecha_max'],
            'ultimo_mes_inicio'  => $fechaMax->format('Y-m-01'),
            'ultimo_mes_fin'     => $fechaMax->format('Y-m-d')
        ];
    }

    public function obtenerTalmDisponibles(?string $anio = null): array
    {
        $filtroAnio = '';
        $params = [];

        if ($anio !== null && preg_match('/^\d{4}$/', $anio)) {
            $filtroAnio = " AND m.tfectra BETWEEN ? AND ?";
            $params[] = $anio . '-01-01';
            $params[] = $anio . '-12-31';
        }

        $sql = "
            SELECT DISTINCT
                m.talm AS codigo,
                COALESCE(a.descri, '') AS nombre
            FROM movi_produccion m
            LEFT JOIN alma a ON a.codalm = m.talm
            WHERE m.talm IS NOT NULL
              AND TRIM(m.talm) <> ''
              {$filtroAnio}
            ORDER BY m.talm
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerBaseAlmaFecha(array $talm, string $fechaInicio, string $fechaFin): array
    {
        if (empty($talm)) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($talm), '?'));

        $sql = "
            SELECT
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m') AS anio_mes,
                DATE_FORMAT(m.tfectra, '%Y-%m-%d') AS fecha,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END AS tipo,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) AS cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso   ELSE -1 * m.tpeso   END) AS pes,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) AS val
            FROM movi_produccion m
            WHERE m.talm IN ($placeholders)
              AND m.tfectra BETWEEN ? AND ?
            GROUP BY
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m'),
                DATE_FORMAT(m.tfectra, '%Y-%m-%d'),
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END
            ORDER BY
                fecha,
                m.talm,
                tipo
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute(array_merge(array_values($talm), [$fechaInicio, $fechaFin]));

        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($fila) {
            $fila['cant'] = (float) ($fila['cant'] ?? 0);
            $fila['pes']  = (float) ($fila['pes'] ?? 0);
            $fila['val']  = (float) ($fila['val'] ?? 0);

            return $fila;
        }, $filas);
    }

    public function obtenerBaseFechaCliente(array $talm, string $fechaInicio, string $fechaFin): array
    {
        if (empty($talm)) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($talm), '?'));

        $sql = "
            SELECT
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m') AS anio_mes,
                DATE_FORMAT(m.tfectra, '%Y-%m-%d') AS fecha,
                m.tprocli AS cliente,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END AS tipo,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) AS cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso   ELSE -1 * m.tpeso   END) AS pes,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) AS val
            FROM movi_produccion m
            WHERE m.talm IN ($placeholders)
              AND m.tfectra BETWEEN ? AND ?
            GROUP BY
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m'),
                DATE_FORMAT(m.tfectra, '%Y-%m-%d'),
                m.tprocli,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END
            ORDER BY
                fecha,
                cliente,
                m.talm,
                tipo
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute(array_merge(array_values($talm), [$fechaInicio, $fechaFin]));

        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($fila) {
            $fila['cant'] = (float) ($fila['cant'] ?? 0);
            $fila['pes']  = (float) ($fila['pes'] ?? 0);
            $fila['val']  = (float) ($fila['val'] ?? 0);

            return $fila;
        }, $filas);
    }

    public function obtenerBaseFechaClienteTrans(array $talm, string $fechaInicio, string $fechaFin): array
    {
        if (empty($talm)) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($talm), '?'));

        $sql = "
            SELECT
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m') AS anio_mes,
                DATE_FORMAT(m.tfectra, '%Y-%m-%d') AS fecha,
                m.tprocli AS cliente,
                m.tcodtra AS tran,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END AS tipo,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) AS cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso   ELSE -1 * m.tpeso   END) AS pes,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) AS val
            FROM movi_produccion m
            WHERE m.talm IN ($placeholders)
              AND m.tfectra BETWEEN ? AND ?
            GROUP BY
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m'),
                DATE_FORMAT(m.tfectra, '%Y-%m-%d'),
                m.tprocli,
                m.tcodtra,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END
            ORDER BY
                fecha,
                cliente,
                m.tcodtra,
                m.talm,
                tipo
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute(array_merge(array_values($talm), [$fechaInicio, $fechaFin]));

        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($fila) {
            $fila['cant'] = (float) ($fila['cant'] ?? 0);
            $fila['pes']  = (float) ($fila['pes'] ?? 0);
            $fila['val']  = (float) ($fila['val'] ?? 0);

            return $fila;
        }, $filas);
    }

    public function obtenerBaseFechaClienteTransCod(array $talm, string $fechaInicio, string $fechaFin): array
    {
        if (empty($talm)) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($talm), '?'));

        $sql = "
            SELECT
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m') AS anio_mes,
                DATE_FORMAT(m.tfectra, '%Y-%m-%d') AS fecha,
                m.tprocli AS cliente,
                COALESCE(CAST(ROUND(m.tnumfac) AS CHAR), '') AS tnumfac,
                m.tcodtra AS tran,
                m.tcodigo AS codigo_item,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END AS tipo,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) AS cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso   ELSE -1 * m.tpeso   END) AS pes,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) AS val
            FROM movi_produccion m
            WHERE m.talm IN ($placeholders)
              AND m.tfectra BETWEEN ? AND ?
            GROUP BY
                m.talm,
                DATE_FORMAT(m.tfectra, '%Y-%m'),
                DATE_FORMAT(m.tfectra, '%Y-%m-%d'),
                m.tprocli,
                m.tnumfac,
                m.tcodtra,
                m.tcodigo,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END
            ORDER BY
                fecha,
                cliente,
                tnumfac,
                m.tcodtra,
                m.tcodigo,
                m.talm,
                tipo
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute(array_merge(array_values($talm), [$fechaInicio, $fechaFin]));

        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($fila) {
            $fila['cant'] = (float) ($fila['cant'] ?? 0);
            $fila['pes']  = (float) ($fila['pes'] ?? 0);
            $fila['val']  = (float) ($fila['val'] ?? 0);

            return $fila;
        }, $filas);
    }

    public function obtenerBase(string $fechaInicio, string $fechaFin): array
    {
        $sql = "
            SELECT
                DATE_FORMAT(m.tfectra, '%Y-%m') AS anio_mes,
                DATE_FORMAT(m.tfectra, '%Y-%m-%d') AS fecha,
                m.tprocli AS cliente,
                m.tcodtra AS tran,
                CASE
                    WHEN LEFT(m.tcodtra, 1) = 'E' THEN 'Entrada'
                    ELSE 'Salida'
                END AS tipo,
                m.tcodigo AS codigo_item,
                COALESCE(i.descri, '') AS nom_item,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tcantid ELSE -1 * m.tcantid END) AS cant,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tpeso   ELSE -1 * m.tpeso   END) AS pes,
                SUM(CASE WHEN LEFT(m.tcodtra, 1) = 'E' THEN m.tkardex ELSE -1 * m.tkardex END) AS val
            FROM movi_produccion m
            LEFT JOIN mitm i ON i.codigo = m.tcodigo
            WHERE m.talm = 'PT0'
              AND m.tfectra BETWEEN :fecha_inicio AND :fecha_fin
            GROUP BY
                DATE_FORMAT(m.tfectra, '%Y-%m'),
                DATE_FORMAT(m.tfectra, '%Y-%m-%d'),
                m.tprocli,
                m.tcodtra,
                m.tcodigo,
                i.descri
            ORDER BY
                fecha,
                cliente,
                tran,
                codigo_item
        ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin'    => $fechaFin
        ]);

        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($fila) {
            $fila['cant'] = (float) ($fila['cant'] ?? 0);
            $fila['pes']  = (float) ($fila['pes'] ?? 0);
            $fila['val']  = (float) ($fila['val'] ?? 0);

            return $fila;
        }, $filas);
    }
}
