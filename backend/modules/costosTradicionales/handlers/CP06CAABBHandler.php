<?php

class CP06CAABBHandler
{
    private static $mesesLargo = [
        '01' => 'enero', '02' => 'febrero', '03' => 'marzo', '04' => 'abril',
        '05' => 'mayo', '06' => 'junio', '07' => 'julio', '08' => 'agosto',
        '09' => 'septiembre', '10' => 'octubre', '11' => 'noviembre', '12' => 'diciembre'
    ];

    private static $mesesCorto = [
        '01' => 'ene', '02' => 'feb', '03' => 'mar', '04' => 'abr',
        '05' => 'may', '06' => 'jun', '07' => 'jul', '08' => 'ago',
        '09' => 'sept', '10' => 'oct', '11' => 'nov', '12' => 'dic'
    ];

    public static function handle(PDO $db, array $filtros): array
    {
        $fechaInicio = !empty($filtros['fecha_inicio']) ? trim($filtros['fecha_inicio']) : '2026-02-01';
        $fechaFin    = !empty($filtros['fecha_fin']) ? trim($filtros['fecha_fin']) : '2026-08-31';

        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        // 1. Gráfica consolidada mensual y tabla resumen superior (costomenali)
        $sqlGrafica = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(valoalim) AS sum_valoalim,
                SUM(pesoalim) AS sum_pesoalim,
                (SUM(valoalim) / NULLIF(SUM(pesoalim), 0)) AS costo_x_kg
            FROM costomenali
            WHERE fecha >= :fecha_ini AND fecha <= LAST_DAY(:fecha_fin)
            GROUP BY mes_key, anio, mes_num
            ORDER BY mes_key ASC
        ";
        $stmtG = $db->prepare($sqlGrafica);
        $stmtG->execute($params);
        $rawGrafica = $stmtG->fetchAll(PDO::FETCH_ASSOC);

        $periodos = [];
        $grafica = [];
        $resumenSuperior = [];

        foreach ($rawGrafica as $rg) {
            $key = $rg['mes_key'];
            $anio = $rg['anio'];
            $mesNum = $rg['mes_num'];
            $mesNomLargo = self::$mesesLargo[$mesNum] ?? "mes $mesNum";
            $mesNomCorto = self::$mesesCorto[$mesNum] ?? "m$mesNum";
            $mesLarga = "$mesNomLargo de $anio";
            $mesCorta = "$mesNomCorto $anio";

            $valAlim = (float)($rg['sum_valoalim'] ?? 0);
            $pesoAlim = (float)($rg['sum_pesoalim'] ?? 0);
            $costoXKg = round((float)($rg['costo_x_kg'] ?? 0), 3);

            $periodos[] = [
                'key'       => $key,
                'mes_corta' => $mesCorta,
                'mes_larga' => $mesLarga,
                'anio'      => $anio,
                'mes_num'   => $mesNum
            ];

            $grafica[] = [
                'key'            => $key,
                'mes_corta'      => $mesCorta,
                'mes_larga'      => $mesLarga,
                'anio'           => $anio,
                'mes_num'        => $mesNum,
                'sum_valoalim'   => $valAlim,
                'sum_pesoalim'   => $pesoAlim,
                'costo_x_kg'     => $costoXKg
            ];

            $resumenSuperior[$key] = [
                'valor_alimento' => $valAlim,
                'peso_alimento'  => $pesoAlim,
                'costo_x_kg'     => $costoXKg
            ];
        }

        // 2. Detalle matricial por Alimento Balanceado (codigo, nomalim) cruzado por Mes
        $sqlDetalle = "
            SELECT 
                codigo,
                nomalim,
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(pesoalim) AS peso,
                SUM(valoalim) AS valor,
                (SUM(valoalim) / NULLIF(SUM(pesoalim), 0)) AS pu
            FROM costomenali
            WHERE fecha >= :fecha_ini AND fecha <= LAST_DAY(:fecha_fin)
            GROUP BY codigo, nomalim, mes_key, anio, mes_num
            ORDER BY codigo DESC, mes_key ASC
        ";
        $stmtD = $db->prepare($sqlDetalle);
        $stmtD->execute($params);
        $rawDetalle = $stmtD->fetchAll(PDO::FETCH_ASSOC);

        $alimentosMap = [];
        foreach ($rawDetalle as $rd) {
            $codigo = trim((string)$rd['codigo']);
            $nomalim = trim((string)$rd['nomalim']);
            $mKey = $rd['mes_key'];
            $peso = (float)($rd['peso'] ?? 0);
            $valor = (float)($rd['valor'] ?? 0);
            $pu = round((float)($rd['pu'] ?? 0), 3);

            if (!isset($alimentosMap[$codigo])) {
                $alimentosMap[$codigo] = [
                    'codigo'  => $codigo,
                    'nomalim' => $nomalim,
                    'meses'   => []
                ];
            }

            $alimentosMap[$codigo]['meses'][$mKey] = [
                'pesoalim' => round($peso, 2),
                'valoalim' => round($valor, 2),
                'pu'       => $pu
            ];
        }

        return [
            'tipo_grafico'    => 'CP06 CAABB',
            'periodos'        => $periodos,
            'grafica'         => $grafica,
            'resumenSuperior' => $resumenSuperior,
            'tablaDetalle'    => array_values($alimentosMap)
        ];
    }
}
