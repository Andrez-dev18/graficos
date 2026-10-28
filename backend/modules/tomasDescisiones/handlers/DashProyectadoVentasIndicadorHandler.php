<?php

class DashProyectadoVentasIndicadorHandler
{
    private $db;
    private $procesosOrden = ['Pollo Vivo', 'Pollo Beneficiado', 'Menudencia', 'Pollo trozado Seco'];
    private $medidas = [
        'cantidadp', 'pesop', 'ppromp', 'preciop', 'ventap',
        'cantidadr', 'pesor', 'ppromr', 'precior', 'ventar',
        'varprecio', 'varpprom'
    ];

    public function __construct($db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(array $filtros): array
    {
        $anio = (int)date('Y');
        $rango = $this->resolverRango($filtros, $anio);
        $semanas = $this->semanasDisponibles($rango[0], $rango[1]);
        $procesos = $this->procesosDisponibles($rango[0], $rango[1]);
        if (empty($procesos)) {
            $procesos = $this->procesosOrden;
        }

        $semanaActual = (string)(int)date('W');
        $semanaMax = empty($semanas) ? '' : $semanas[count($semanas) - 1];

        return [
            'status' => 'success',
            'anio' => $anio,
            'fecha_inicio_default' => $anio . '-01-01',
            'fecha_fin_default' => $anio . '-12-31',
            'semana_actual' => $semanaActual,
            'semana_max' => $semanaMax,
            'semanas' => $semanas,
            'procesos' => $procesos
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $anio = (int)date('Y');
        $rango = $this->resolverRango($filtros, $anio);
        $fechaInicio = $rango[0];
        $fechaFin = $rango[1];

        $disponibles = $this->semanasDisponibles($fechaInicio, $fechaFin);
        $solicitadas = $this->lista($filtros['semanas'] ?? []);
        $semanas = array_values(array_intersect($disponibles, $solicitadas));

        if (empty($semanas)) {
            $semanaActual = (string)(int)date('W');
            if (in_array($semanaActual, $disponibles, true)) {
                $semanas = [$semanaActual];
            } elseif (!empty($disponibles)) {
                $semanas = [$disponibles[count($disponibles) - 1]];
            }
        }

        $procesos = $this->procesosDisponibles($fechaInicio, $fechaFin);
        if (empty($procesos)) {
            $procesos = $this->procesosOrden;
        }

        if (empty($semanas)) {
            return [
                'status' => 'success',
                'anio' => $anio,
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin,
                'semanas' => [],
                'procesos' => $procesos,
                'dias' => [],
                'indicadoresSemanales' => [],
                'totalesSemanales' => [],
                'totalGeneral' => null,
                'indicadoresTotales' => []
            ];
        }

        $rows = $this->getRows($fechaInicio, $fechaFin, $semanas);
        $dias = $this->construirDias($rows, $semanas, $procesos);
        $rawTotales = [];
        $rawTotalGeneral = $this->rawVacio();
        $rawPorProceso = [];

        foreach ($rows as $row) {
            $semana = trim((string)$row['semana']);
            $proceso = trim((string)$row['proceso']);
            $key = $semana . '|' . $proceso;

            if (!isset($rawTotales[$key])) {
                $rawTotales[$key] = $this->rawVacio();
            }
            $this->acumularRaw($rawTotales[$key], $row);
            $this->acumularRaw($rawTotalGeneral, $row);

            if (!isset($rawPorProceso[$proceso])) {
                $rawPorProceso[$proceso] = $this->rawVacio();
            }
            $this->acumularRaw($rawPorProceso[$proceso], $row);
        }

        $totalesSemanales = [];
        $indicadoresSemanales = [];

        foreach ($semanas as $semana) {
            foreach ($procesos as $proceso) {
                $raw = $rawTotales[$semana . '|' . $proceso] ?? $this->rawVacio();
                $medidas = $this->calcularTotales($raw);
                $totalesSemanales[] = [
                    'semana' => (string)$semana,
                    'proceso' => $proceso,
                    'medidas' => $medidas
                ];
                $indicadoresSemanales[] = [
                    'semana' => (string)$semana,
                    'proceso' => $proceso,
                    'varprecio' => $medidas['varprecio'],
                    'varpprom' => $medidas['varpprom']
                ];
            }
        }

        $totalGeneral = $this->calcularTotales($rawTotalGeneral);
        $indicadoresTotales = [];

        foreach ($procesos as $proceso) {
            $raw = $rawPorProceso[$proceso] ?? $this->rawVacio();
            $medidas = $this->calcularTotales($raw);
            $indicadoresTotales[] = [
                'proceso' => $proceso,
                'varprecio' => $medidas['varprecio'],
                'varpprom' => $medidas['varpprom']
            ];
        }

        return [
            'status' => 'success',
            'anio' => $anio,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'semanas' => array_values(array_map('strval', $semanas)),
            'procesos' => $procesos,
            'dias' => $dias,
            'indicadoresSemanales' => $indicadoresSemanales,
            'totalesSemanales' => $totalesSemanales,
            'totalGeneral' => ['medidas' => $totalGeneral],
            'indicadoresTotales' => $indicadoresTotales
        ];
    }

    private function getRows(string $fechaInicio, string $fechaFin, array $semanas): array
    {
        if (empty($semanas)) {
            return [];
        }

        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];
        $placeholders = [];

        foreach (array_values($semanas) as $i => $semana) {
            $ph = ':semana_' . $i;
            $placeholders[] = $ph;
            $params[$ph] = (string)$semana;
        }

        $sql = "SELECT
                    TRIM(semana) AS semana,
                    DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
                    TRIM(proceso) AS proceso,
                    COALESCE(cantidadp, 0) AS cantidadp,
                    COALESCE(pesop, 0) AS pesop,
                    COALESCE(ppromp, 0) AS ppromp,
                    COALESCE(preciop, 0) AS preciop,
                    COALESCE(ventap, 0) AS ventap,
                    COALESCE(cantidadr, 0) AS cantidadr,
                    COALESCE(pesor, 0) AS pesor,
                    COALESCE(ppromr, 0) AS ppromr,
                    COALESCE(precior, 0) AS precior,
                    COALESCE(ventar, 0) AS ventar,
                    COALESCE(`real`, '') AS `real`
                FROM presuventas
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND TRIM(semana) IN (" . implode(', ', $placeholders) . ")
                ORDER BY CAST(semana AS UNSIGNED) ASC, fecha ASC,
                         FIELD(proceso, 'Pollo Vivo', 'Pollo Beneficiado', 'Menudencia', 'Pollo trozado Seco') ASC";

        return $this->consultar($sql, $params);
    }

    private function construirDias(array $rows, array $semanas, array $procesos): array
    {
        $mapa = [];

        foreach ($rows as $row) {
            $semana = (string)$row['semana'];
            $fecha = (string)$row['fecha'];
            $clave = $semana . '|' . $fecha;

            if (!isset($mapa[$clave])) {
                $mapa[$clave] = [
                    'semana' => $semana,
                    'fecha' => $fecha,
                    'procesos' => []
                ];
            }

            $mapa[$clave]['procesos'][(string)$row['proceso']] = [
                'proceso' => (string)$row['proceso'],
                'real' => (string)$row['real'],
                'medidas' => $this->medidasDiarias($row)
            ];
        }

        $dias = [];

        foreach ($semanas as $semana) {
            $diasSemana = [];

            foreach ($mapa as $dia) {
                if ((string)$dia['semana'] === (string)$semana) {
                    $diasSemana[] = $dia;
                }
            }

            usort($diasSemana, function ($a, $b) {
                return strcmp($a['fecha'], $b['fecha']);
            });

            foreach ($diasSemana as $dia) {
                $procesosDia = [];

                foreach ($procesos as $proceso) {
                    $item = $dia['procesos'][$proceso] ?? null;
                    $procesosDia[] = $item ?: [
                        'proceso' => $proceso,
                        'real' => '',
                        'medidas' => $this->medidasVacias()
                    ];
                }

                $dias[] = [
                    'semana' => (string)$dia['semana'],
                    'fecha' => (string)$dia['fecha'],
                    'procesos' => $procesosDia
                ];
            }
        }

        return $dias;
    }

    private function semanasDisponibles(string $fechaInicio, string $fechaFin): array
    {
        $sql = "SELECT DISTINCT TRIM(semana) AS semana
                FROM presuventas
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND semana IS NOT NULL
                  AND TRIM(semana) <> ''";

        $filas = $this->consultar($sql, [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);
        $semanas = [];

        foreach ($filas as $fila) {
            $semana = trim((string)($fila['semana'] ?? ''));
            if ($semana !== '') {
                $semanas[] = $semana;
            }
        }

        $semanas = array_values(array_unique($semanas));
        usort($semanas, function ($a, $b) {
            return (int)$a <=> (int)$b;
        });

        return $semanas;
    }

    private function procesosDisponibles(string $fechaInicio, string $fechaFin): array
    {
        $sql = "SELECT DISTINCT TRIM(proceso) AS proceso
                FROM presuventas
                WHERE fecha BETWEEN :fecha_inicio AND :fecha_fin
                  AND proceso IS NOT NULL
                  AND TRIM(proceso) <> ''";

        $filas = $this->consultar($sql, [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);
        $procesos = [];

        foreach ($filas as $fila) {
            $proceso = trim((string)($fila['proceso'] ?? ''));
            if ($proceso !== '') {
                $procesos[] = $proceso;
            }
        }

        $procesos = array_values(array_unique($procesos));
        $orden = $this->procesosOrden;
        usort($procesos, function ($a, $b) use ($orden) {
            $posA = array_search($a, $orden, true);
            $posB = array_search($b, $orden, true);
            $posA = $posA === false ? PHP_INT_MAX : $posA;
            $posB = $posB === false ? PHP_INT_MAX : $posB;
            return $posA <=> $posB;
        });

        return $procesos;
    }

    private function consultar(string $sql, array $params): array
    {
        $stmt = $this->preparar($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function preparar(string $sql)
    {
        if ($this->db instanceof SmartPDO) {
            return $this->db->prepareNative('principal', $sql);
        }

        return $this->db->prepare($sql);
    }

    private function resolverRango(array $filtros, int $anio): array
    {
        $inicio = $this->fechaValida($filtros['fecha_inicio'] ?? '', $anio . '-01-01');
        $fin = $this->fechaValida($filtros['fecha_fin'] ?? '', $anio . '-12-31');

        if ($inicio > $fin) {
            $tmp = $inicio;
            $inicio = $fin;
            $fin = $tmp;
        }

        return [$inicio, $fin];
    }

    private function fechaValida($valor, string $default): string
    {
        $valor = trim((string)$valor);

        if ($valor === '') {
            return $default;
        }

        $fecha = DateTime::createFromFormat('Y-m-d', $valor);
        if ($fecha && $fecha->format('Y-m-d') === $valor) {
            return $valor;
        }

        return $default;
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

    private function medidasDiarias(array $row): array
    {
        $cantidadp = (float)$row['cantidadp'];
        $pesop = (float)$row['pesop'];
        $ppromp = (float)$row['ppromp'];
        $preciop = (float)$row['preciop'];
        $ventap = (float)$row['ventap'];
        $cantidadr = (float)$row['cantidadr'];
        $pesor = (float)$row['pesor'];
        $ppromr = (float)$row['ppromr'];
        $precior = (float)$row['precior'];
        $ventar = (float)$row['ventar'];

        return [
            'cantidadp' => $cantidadp,
            'pesop' => $pesop,
            'ppromp' => $ppromp,
            'preciop' => $preciop,
            'ventap' => $ventap,
            'cantidadr' => $cantidadr,
            'pesor' => $pesor,
            'ppromr' => $ppromr,
            'precior' => $precior,
            'ventar' => $ventar,
            'varprecio' => $precior - $preciop,
            'varpprom' => $ppromr - $ppromp
        ];
    }

    private function medidasVacias(): array
    {
        $vacias = [];
        foreach ($this->medidas as $medida) {
            $vacias[$medida] = 0.0;
        }
        return $vacias;
    }

    private function rawVacio(): array
    {
        return [
            'cantidadp' => 0.0,
            'pesop' => 0.0,
            'ventap' => 0.0,
            'cantidadr' => 0.0,
            'pesor' => 0.0,
            'ventar' => 0.0
        ];
    }

    private function acumularRaw(array &$raw, array $row): void
    {
        $raw['cantidadp'] += (float)$row['cantidadp'];
        $raw['pesop'] += (float)$row['pesop'];
        $raw['ventap'] += (float)$row['ventap'];
        $raw['cantidadr'] += (float)$row['cantidadr'];
        $raw['pesor'] += (float)$row['pesor'];
        $raw['ventar'] += (float)$row['ventar'];
    }

    private function calcularTotales(array $raw): array
    {
        $cantidadp = (float)$raw['cantidadp'];
        $pesop = (float)$raw['pesop'];
        $ventap = (float)$raw['ventap'];
        $cantidadr = (float)$raw['cantidadr'];
        $pesor = (float)$raw['pesor'];
        $ventar = (float)$raw['ventar'];

        $ppromp = $this->dividir($pesop, $cantidadp);
        $preciop = $this->dividir($ventap, $pesop);
        $ppromr = $this->dividir($pesor, $cantidadr);
        $precior = $this->dividir($ventar, $pesor);

        return [
            'cantidadp' => $cantidadp,
            'pesop' => $pesop,
            'ppromp' => $ppromp,
            'preciop' => $preciop,
            'ventap' => $ventap,
            'cantidadr' => $cantidadr,
            'pesor' => $pesor,
            'ppromr' => $ppromr,
            'precior' => $precior,
            'ventar' => $ventar,
            'varprecio' => $precior - $preciop,
            'varpprom' => $ppromr - $ppromp
        ];
    }

    private function dividir(float $numerador, float $denominador): float
    {
        if (abs($denominador) < 0.0000001) {
            return 0.0;
        }

        return $numerador / $denominador;
    }
}
