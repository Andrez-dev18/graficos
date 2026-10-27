<?php

class LiquidacionPlacasHandler
{
    private const ORDEN_CODIGOS = [
        'E100', 'E101', 'E209', 'E409', 'E414', 'E423', 'E700', 'E801', 'E806',
        'S201', 'S209', 'S409', 'S414', 'S400', 'E400', 'S110', 'E110', 'S700',
        'S800', 'S801', 'S803', 'S804', 'S806', 'S810', 'S823'
    ];

    public static function formatear(array $filasRaw): array
    {
        $codigos = [];
        $fechas = [];

        foreach ($filasRaw as $fila) {
            $fecha = (string)($fila['fecha'] ?? '');
            $cliente = trim((string)($fila['cliente'] ?? ''));
            $placa = trim((string)($fila['placa'] ?? ''));
            $coditem = trim((string)($fila['coditem'] ?? ''));
            $codtra = trim((string)($fila['codtra'] ?? ''));
            $descri = trim((string)($fila['descri'] ?? ''));

            if ($fecha === '' || $cliente === '' || $codtra === '') {
                continue;
            }

            $cant = (float)($fila['cant'] ?? 0);
            $peso = (float)($fila['peso'] ?? 0);
            $codigos[$codtra] = $descri !== '' ? $descri : $codtra;

            if (!isset($fechas[$fecha])) {
                $fechas[$fecha] = [
                    'fecha' => $fecha,
                    'fecha_txt' => self::fechaCorta($fecha),
                    'clientes' => []
                ];
            }

            if (!isset($fechas[$fecha]['clientes'][$cliente])) {
                $fechas[$fecha]['clientes'][$cliente] = [
                    'cliente' => $cliente,
                    'filas' => []
                ];
            }

            $rowKey = $placa . '|' . $coditem;
            if (!isset($fechas[$fecha]['clientes'][$cliente]['filas'][$rowKey])) {
                $fechas[$fecha]['clientes'][$cliente]['filas'][$rowKey] = [
                    'placa' => $placa,
                    'coditem' => $coditem,
                    'valores' => []
                ];
            }

            $fechas[$fecha]['clientes'][$cliente]['filas'][$rowKey]['valores'][$codtra] = [
                'cant' => round($cant, 2),
                'peso' => round($peso, 2),
                'pp' => self::calcularPP($cant, $peso)
            ];
        }

        $codigosOrdenados = self::ordenarCodigos($codigos);
        $fechasOrdenadas = [];
        $globalPorCodigo = [];
        $globalCant = 0.0;
        $globalPeso = 0.0;
        ksort($fechas);

        foreach ($fechas as $fechaData) {
            $clientesOut = [];
            ksort($fechaData['clientes']);

            foreach ($fechaData['clientes'] as $clienteData) {
                $filas = array_values($clienteData['filas']);
                $total = [];
                $clienteCant = 0.0;
                $clientePeso = 0.0;

                foreach ($filas as &$fila) {
                    $filaCant = 0.0;
                    $filaPeso = 0.0;
                    foreach ($fila['valores'] as $valor) {
                        $filaCant += (float)$valor['cant'];
                        $filaPeso += (float)$valor['peso'];
                    }
                    $fila['total_general'] = [
                        'cant' => round($filaCant, 2),
                        'peso' => round($filaPeso, 2),
                        'pp' => self::calcularPP($filaCant, $filaPeso)
                    ];
                }
                unset($fila);

                foreach ($codigosOrdenados as $codigo) {
                    $sumCant = 0.0;
                    $sumPeso = 0.0;
                    $tieneDatos = false;

                    foreach ($filas as $fila) {
                        if (!isset($fila['valores'][$codigo['codtra']])) {
                            continue;
                        }
                        $sumCant += (float)$fila['valores'][$codigo['codtra']]['cant'];
                        $sumPeso += (float)$fila['valores'][$codigo['codtra']]['peso'];
                        $tieneDatos = true;
                    }

                    if ($tieneDatos) {
                        $total[$codigo['codtra']] = [
                            'cant' => round($sumCant, 2),
                            'peso' => round($sumPeso, 2),
                            'pp' => self::calcularPP($sumCant, $sumPeso)
                        ];
                        $clienteCant += $sumCant;
                        $clientePeso += $sumPeso;
                        if (!isset($globalPorCodigo[$codigo['codtra']])) {
                            $globalPorCodigo[$codigo['codtra']] = ['cant' => 0.0, 'peso' => 0.0];
                        }
                        $globalPorCodigo[$codigo['codtra']]['cant'] += $sumCant;
                        $globalPorCodigo[$codigo['codtra']]['peso'] += $sumPeso;
                    }
                }

                $globalCant += $clienteCant;
                $globalPeso += $clientePeso;

                $clientesOut[] = [
                    'cliente' => $clienteData['cliente'],
                    'filas' => $filas,
                    'total' => $total,
                    'total_general' => [
                        'cant' => round($clienteCant, 2),
                        'peso' => round($clientePeso, 2),
                        'pp' => self::calcularPP($clienteCant, $clientePeso)
                    ]
                ];
            }

            $fechaData['clientes'] = $clientesOut;
            $fechasOrdenadas[] = $fechaData;
        }

        $totalesCodigos = [];
        foreach ($globalPorCodigo as $codtra => $valor) {
            $totalesCodigos[$codtra] = [
                'cant' => round($valor['cant'], 2),
                'peso' => round($valor['peso'], 2),
                'pp' => self::calcularPP($valor['cant'], $valor['peso'])
            ];
        }

        return [
            'status' => 'success',
            'codigos' => $codigosOrdenados,
            'fechas' => $fechasOrdenadas,
            'total_fechas' => count($fechasOrdenadas),
            'totales_codigos' => $totalesCodigos,
            'total_general' => [
                'cant' => round($globalCant, 2),
                'peso' => round($globalPeso, 2),
                'pp' => self::calcularPP($globalCant, $globalPeso)
            ]
        ];
    }

    private static function ordenarCodigos(array $codigos): array
    {
        $ordenados = [];
        foreach (self::ORDEN_CODIGOS as $codtra) {
            if (isset($codigos[$codtra])) {
                $ordenados[] = ['codtra' => $codtra, 'descri' => $codigos[$codtra]];
                unset($codigos[$codtra]);
            }
        }

        ksort($codigos);
        foreach ($codigos as $codtra => $descri) {
            $ordenados[] = ['codtra' => $codtra, 'descri' => $descri];
        }

        return $ordenados;
    }

    private static function calcularPP(float $cant, float $peso): ?float
    {
        if (abs($cant) < 0.0000001) return null;
        return round($peso / $cant, 3);
    }

    private static function fechaCorta(string $fecha): string
    {
        try {
            return (new DateTimeImmutable($fecha))->format('d/m/Y');
        } catch (Throwable $e) {
            return $fecha;
        }
    }
}
