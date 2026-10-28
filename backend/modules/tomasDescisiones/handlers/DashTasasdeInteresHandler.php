<?php

class DashTasasdeInteresHandler
{
    private $db;
    private $meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function obtenerDashboard(array $filtros = []): array
    {
        $sql = "SELECT
                    DATE_FORMAT(fecha, '%Y-%m') AS periodo,
                    SUM(bcr) AS bcr,
                    SUM(banbif) AS banbif,
                    SUM(bcp) AS bcp
                FROM tasasbancosdias
                WHERE fecha IS NOT NULL
                GROUP BY DATE_FORMAT(fecha, '%Y-%m')
                ORDER BY periodo ASC";

        $rows = $this->consultar($sql);

        if (empty($rows)) {
            return [
                'status' => 'success',
                'periodos' => [],
                'total' => 0
            ];
        }

        $porPeriodo = [];
        foreach ($rows as $row) {
            $periodo = (string)$row['periodo'];
            $porPeriodo[$periodo] = [
                'bcr' => $row['bcr'] === null ? null : (float)$row['bcr'],
                'banbif' => $row['banbif'] === null ? null : (float)$row['banbif'],
                'bcp' => $row['bcp'] === null ? null : (float)$row['bcp']
            ];
        }

        $claves = array_keys($porPeriodo);
        $primero = $claves[0];
        $ultimo = $claves[count($claves) - 1];

        $actual = DateTime::createFromFormat('Y-m-d', $primero . '-01');
        $fin = DateTime::createFromFormat('Y-m-d', $ultimo . '-01');
        $periodos = [];

        while ($actual <= $fin) {
            $periodo = $actual->format('Y-m');
            $mes = (int)$actual->format('n');
            $valores = $porPeriodo[$periodo] ?? [
                'bcr' => null,
                'banbif' => null,
                'bcp' => null
            ];

            $periodos[] = [
                'periodo' => $periodo,
                'label' => $this->meses[$mes - 1] . ' ' . $actual->format('Y'),
                'bcr' => $valores['bcr'],
                'banbif' => $valores['banbif'],
                'bcp' => $valores['bcp']
            ];

            $actual->modify('+1 month');
        }

        return [
            'status' => 'success',
            'periodos' => $periodos,
            'total' => count($periodos),
            'rango' => [
                'inicio' => $primero,
                'fin' => $ultimo
            ]
        ];
    }

    private function consultar(string $sql): array
    {
        if ($this->db instanceof SmartPDO) {
            $stmt = $this->db->prepareNative('principal', $sql);
        } else {
            $stmt = $this->db->prepare($sql);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
