<?php

class DashGraficasProyectadosVSRealHandler
{
    private $db;
    private $procesosOrden = ['Pollo Vivo', 'Pollo Beneficiado', 'Menudencia', 'Pollo trozado Seco'];

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros): array
    {
        $anio = (int)date('Y');
        $inicio = $this->fechaValida($filtros['fecha_inicio'] ?? '', $anio . '-01-01');
        $fin = $this->fechaValida($filtros['fecha_fin'] ?? '', $anio . '-12-31');

        if ($inicio > $fin) {
            $tmp = $inicio;
            $inicio = $fin;
            $fin = $tmp;
        }

        $semanas = $this->lista($filtros['semanas'] ?? []);
        $procesos = $this->lista($filtros['procesos'] ?? []);

        if (empty($semanas) || empty($procesos)) {
            return [
                'status' => 'success',
                'fecha_inicio' => $inicio,
                'fecha_fin' => $fin,
                'semanas' => $semanas,
                'procesos' => $procesos,
                'grupos' => []
            ];
        }

        $params = [
            ':fecha_inicio' => $inicio,
            ':fecha_fin' => $fin
        ];

        $phSemanas = [];
        foreach ($semanas as $i => $semana) {
            $ph = ':semana_' . $i;
            $phSemanas[] = $ph;
            $params[$ph] = (string)$semana;
        }

        $phProcesos = [];
        foreach ($procesos as $i => $proceso) {
            $ph = ':proceso_' . $i;
            $phProcesos[] = $ph;
            $params[$ph] = (string)$proceso;
        }

        $sql = "SELECT
                    TRIM(semana) AS semana,
                    TRIM(proceso) AS proceso,
                    SUM(COALESCE(cantidadp, 0)) AS cantidadp,
                    SUM(COALESCE(cantidadr, 0)) AS cantidadr,
                    AVG(preciop) AS preciop,
                    AVG(precior) AS precior,
                    SUM(COALESCE(pesop, 0)) AS pesop,
                    SUM(COALESCE(pesor, 0)) AS pesor,
                    SUM(COALESCE(ventap, 0)) AS ventap,
                    SUM(COALESCE(ventar, 0)) AS ventar,
                    AVG(ppromp) AS ppromp,
                    AVG(ppromr) AS ppromr
                FROM presuventas
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND TRIM(semana) IN (" . implode(', ', $phSemanas) . ")
                  AND TRIM(proceso) IN (" . implode(', ', $phProcesos) . ")
                GROUP BY semana, proceso
                ORDER BY CAST(semana AS UNSIGNED) ASC,
                         FIELD(proceso, 'Pollo Vivo', 'Pollo Beneficiado', 'Menudencia', 'Pollo trozado Seco') ASC";

        $rows = $this->consultar($sql, $params);
        $grupos = [];

        foreach ($rows as $row) {
            $cantidadp = (float)$row['cantidadp'];
            $cantidadr = (float)$row['cantidadr'];
            $pesop = (float)$row['pesop'];
            $pesor = (float)$row['pesor'];
            $ventap = (float)$row['ventap'];
            $ventar = (float)$row['ventar'];
            $preciop = $row['preciop'] === null ? null : (float)$row['preciop'];
            $precior = $row['precior'] === null ? null : (float)$row['precior'];
            $ppromp = $row['ppromp'] === null ? null : (float)$row['ppromp'];
            $ppromr = $row['ppromr'] === null ? null : (float)$row['ppromr'];

            $grupos[] = [
                'semana' => (string)$row['semana'],
                'proceso' => (string)$row['proceso'],
                'cantidad' => [
                    'proyectado' => $cantidadp,
                    'real' => $cantidadr,
                    'diferencia' => $cantidadr - $cantidadp
                ],
                'precio' => [
                    'proyectado' => $preciop,
                    'real' => $precior,
                    'diferencia' => ($preciop === null || $precior === null) ? null : $precior - $preciop
                ],
                'peso' => [
                    'proyectado' => $pesop,
                    'real' => $pesor,
                    'diferencia' => $pesor - $pesop
                ],
                'importe' => [
                    'proyectado' => $ventap,
                    'real' => $ventar,
                    'diferencia' => $ventar - $ventap
                ],
                'pesoProm' => [
                    'proyectado' => $ppromp,
                    'real' => $ppromr,
                    'diferencia' => ($ppromp === null || $ppromr === null) ? null : $ppromr - $ppromp
                ]
            ];
        }

        return [
            'status' => 'success',
            'fecha_inicio' => $inicio,
            'fecha_fin' => $fin,
            'semanas' => $semanas,
            'procesos' => $procesos,
            'grupos' => $grupos
        ];
    }

    private function consultar(string $sql, array $params): array
    {
        if ($this->db instanceof SmartPDO) {
            $stmt = $this->db->prepareNative('principal', $sql);
        } else {
            $stmt = $this->db->prepare($sql);
        }

        foreach ($params as $clave => $valor) {
            $stmt->bindValue($clave, $valor);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function lista($valor): array
    {
        if (!is_array($valor)) {
            $valor = [$valor];
        }

        $lista = [];
        foreach ($valor as $item) {
            $item = trim((string)$item);
            if ($item !== '') {
                $lista[] = $item;
            }
        }

        return array_values(array_unique($lista));
    }

    private function fechaValida($valor, string $default): string
    {
        $valor = trim((string)$valor);
        if ($valor === '') {
            return $default;
        }

        $fecha = DateTime::createFromFormat('Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            return $default;
        }

        return $valor;
    }
}
