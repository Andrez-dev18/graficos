<?php

class saldosxCobrarRepo
{

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }


    //FUNCIONES PARA GRAFICO DE BARRAS SALDOS POR COBRAR
    public function getCuentasVenta()
    {
        $sql = "SELECT DISTINCT 
                    cuentaventa, 
                    COALESCE(nomcuentaventa, cuentaventa) AS nomcuentaventa
                FROM dmdocventas2
                WHERE cuentaventa IS NOT NULL AND cuentaventa != ''
                ORDER BY cuentaventa ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el listado único de clientes para poblar el filtro
     */
    public function getClientes()
    {
        $sql = "SELECT DISTINCT 
                    codcliente, 
                    nomcliente
                FROM dmdocventas2
                WHERE nomcliente IS NOT NULL AND nomcliente != ''
                ORDER BY nomcliente ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los saldos agrupados para grafico de barras cuentas por cobrar
     */
    public function getSaldosPorCuentaPorDia($fechaInicio, $fechaFin, array $cuentas, array $clientes = [])
    {
        $params = [];
        $where = ["fechacarga BETWEEN :fecha_inicio AND :fecha_fin"];
        $params[':fecha_inicio'] = $fechaInicio;
        $params[':fecha_fin'] = $fechaFin;

        // Cláusula IN dinámica para Cuentas de Venta
        if (!empty($cuentas)) {
            $cuentasPlaceholders = [];
            foreach ($cuentas as $i => $cta) {
                $placeholder = ":cta_" . $i;
                $cuentasPlaceholders[] = $placeholder;
                $params[$placeholder] = $cta;
            }
            $where[] = "cuentaventa IN (" . implode(', ', $cuentasPlaceholders) . ")";
        }

        // Cláusula IN dinámica para Clientes (si el usuario filtró clientes específicos)
        if (!empty($clientes)) {
            $clientesPlaceholders = [];
            foreach ($clientes as $i => $cli) {
                $placeholder = ":cli_" . $i;
                $clientesPlaceholders[] = $placeholder;
                $params[$placeholder] = $cli;
            }
            $where[] = "nomcliente IN (" . implode(', ', $clientesPlaceholders) . ")";
        }

        $sql = "SELECT 
                    fechacarga,
                    cuentaventa,
                    nomcuentaventa,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS total_saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY fechacarga, cuentaventa, nomcuentaventa
                ORDER BY fechacarga ASC, cuentaventa ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el DETALLE completo de registros para una cuenta y fecha específica
     */
    public function getDetallePorCuentaYFecha(array $filtros)
    {
        $params = [
            ':cuentaventa' => $filtros['cuentaventa'],
            ':fechacarga'  => $filtros['fechacarga']
        ];

        $where = [
            "cuentaventa = :cuentaventa",
            "fechacarga = :fechacarga",
            "COALESCE(saldofinal, 0) > 0"
        ];

        // Filtro opcional por Zona Fiscal (cuando el clic viene de líneas)
        if (!empty($filtros['zonafiscal'])) {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $filtros['zonafiscal'];
        }

        // Filtro Clientes (cuando viene de barras)
        if (!empty($filtros['clientes'])) {
            $clientesPlaceholders = [];
            foreach ($filtros['clientes'] as $i => $cli) {
                $ph = ":cli_" . $i;
                $clientesPlaceholders[] = $ph;
                $params[$ph] = $cli;
            }
            $where[] = "nomcliente IN (" . implode(', ', $clientesPlaceholders) . ")";
        }

        // Helper para procesar filtros nullable (vencimiento, decision, observacion)
        $procesarNullable = function ($campo, $valores, $prefijo) use (&$where, &$params) {
            if (empty($valores)) return;
            $tieneNull = in_array('NULL', $valores, true);
            $valoresLimpios = array_filter($valores, function ($v) {
                return $v !== 'NULL';
            });

            $condiciones = [];
            if (!empty($valoresLimpios)) {
                $inPh = [];
                foreach (array_values($valoresLimpios) as $i => $val) {
                    $ph = ":det_{$prefijo}_" . $i;
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
        };

        if (!empty($filtros['vencimientos'])) {
            $procesarNullable('vencimiento', $filtros['vencimientos'], 'venc');
        }
        if (!empty($filtros['decisiones'])) {
            $procesarNullable('decision', $filtros['decisiones'], 'dec');
        }
        if (!empty($filtros['observaciones'])) {
            $procesarNullable('observacion', $filtros['observaciones'], 'obs');
        }

        $sql = "SELECT 
                    cuentaventa,
                    COALESCE(nomcuentaventa, '') AS nomcuentaventa,
                    COALESCE(zonafiscal, 'SIN ZONA') AS zonafiscal,
                    fechacarga,
                    codcliente,
                    COALESCE(nomcliente, 'SIN NOMBRE') AS nomcliente,
                    COALESCE(condicionpago, '-') AS condicionpago,
                    COALESCE(numerodoc, '-') AS numerodoc,
                    COALESCE(decision, 'NINGUNA') AS decision,
                    COALESCE(observacion, 'NINGUNA') AS observacion,
                    COALESCE(vencimiento, '-') AS vencimiento,
                    ROUND(COALESCE(saldofinal, 0), 2) AS saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where);

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }


    /**
     * FUNCIONES PARA GRAFICO DE LINEAS ZONA
     */
    /**
     * Obtiene las opciones únicas para los filtros de la vista Zona
     */
    public function getFiltrosZona()
    {
        $vencimientos = $this->conn->query("
            SELECT DISTINCT vencimiento AS id, vencimiento AS label 
            FROM dmdocventas2 
            WHERE vencimiento IS NOT NULL AND vencimiento != ''
            ORDER BY vencimiento ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        $decisiones = $this->conn->query("
            SELECT DISTINCT COALESCE(decision, 'NULL') AS id, COALESCE(decision, 'NULL') AS label 
            FROM dmdocventas2
            ORDER BY label ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        $observaciones = $this->conn->query("
            SELECT DISTINCT COALESCE(observacion, 'NULL') AS id, COALESCE(observacion, 'NULL') AS label 
            FROM dmdocventas2
            ORDER BY label ASC
        ")->fetchAll(PDO::FETCH_ASSOC);

        return [
            'vencimientos'  => $vencimientos,
            'decisiones'    => $decisiones,
            'observaciones' => $observaciones
        ];
    }

    /**
     * Consulta agrupada por Cuenta, Zona Fiscal y Fecha de carga para gráficos de líneas
     */
    public function getSaldosPorZona(array $filtros)
    {
        $params = [
            ':fecha_inicio' => $filtros['fecha_inicio'],
            ':fecha_fin'    => $filtros['fecha_fin']
        ];

        $where = [
            "fechacarga BETWEEN :fecha_inicio AND :fecha_fin"
        ];

        // Filtro Cuentas
        if (!empty($filtros['cuentas'])) {
            $inCuentas = [];
            foreach ($filtros['cuentas'] as $i => $cta) {
                $ph = ":cta_" . $i;
                $inCuentas[] = $ph;
                $params[$ph] = $cta;
            }
            $where[] = "cuentaventa IN (" . implode(', ', $inCuentas) . ")";
        }

        // Helper para filtros con soporte a valores 'NULL'
        $procesarFiltroNullable = function ($campo, $valores, $prefijo) use (&$where, &$params) {
            if (empty($valores)) return;
            $tieneNull = in_array('NULL', $valores, true);
            $valoresLimpios = array_filter($valores, function ($v) {
                return $v !== 'NULL';
            });

            $condiciones = [];
            if (!empty($valoresLimpios)) {
                $inPlaceholders = [];
                foreach (array_values($valoresLimpios) as $i => $val) {
                    $ph = ":{$prefijo}_" . $i;
                    $inPlaceholders[] = $ph;
                    $params[$ph] = $val;
                }
                $condiciones[] = "{$campo} IN (" . implode(', ', $inPlaceholders) . ")";
            }

            if ($tieneNull) {
                $condiciones[] = "({$campo} IS NULL OR {$campo} = '')";
            }

            if (!empty($condiciones)) {
                $where[] = '(' . implode(' OR ', $condiciones) . ')';
            }
        };

        $procesarFiltroNullable('vencimiento', $filtros['vencimientos'] ?? [], 'venc');
        $procesarFiltroNullable('decision', $filtros['decisiones'] ?? [], 'dec');
        $procesarFiltroNullable('observacion', $filtros['observaciones'] ?? [], 'obs');

        $sql = "SELECT 
                    cuentaventa,
                    COALESCE(nomcuentaventa, '') AS nomcuentaventa,
                    COALESCE(zonafiscal, 'SIN ZONA') AS zonafiscal,
                    fechacarga,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY cuentaventa, nomcuentaventa, zonafiscal, fechacarga
                ORDER BY cuentaventa ASC, zonafiscal ASC, fechacarga ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    /**
     * FIN FUNCIONES GRAFICO LINEAS ZONA
     */


    /**
     * FUNCIONES PARA GRAFICO DE ANTICIPOS
     */

    public function getDatosIndicadorAnticipos(array $filtros)
    {
        $params = [
            ':fecha_inicio' => $filtros['fecha_inicio'],
            ':fecha_fin'    => $filtros['fecha_fin']
        ];

        $where = [
            "fechacarga BETWEEN :fecha_inicio AND :fecha_fin"
        ];

        if (!empty($filtros['cuentas'])) {
            $cuentasPlaceholders = [];
            foreach ($filtros['cuentas'] as $i => $cta) {
                $ph = ":cta_" . $i;
                $cuentasPlaceholders[] = $ph;
                $params[$ph] = $cta;
            }
            $where[] = "cuentaventa IN (" . implode(', ', $cuentasPlaceholders) . ")";
        }

        $sql = "SELECT 
                    fechacarga,
                    cuentaventa,
                    MAX(COALESCE(nomcuentaventa, 'SIN NOMBRE')) AS nomcuentaventa,
                    ROUND(SUM(COALESCE(saldoinicial, 0)), 2) AS saldoinicial,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal,
                    ROUND(SUM(COALESCE(saldoinicial, 0)) - SUM(COALESCE(saldofinal, 0)), 2) AS resta_saldo,
                    CASE 
                        WHEN SUM(COALESCE(saldoinicial, 0)) != 0 
                        THEN ROUND((1 - (SUM(COALESCE(saldofinal, 0)) / SUM(COALESCE(saldoinicial, 0)))) * 100, 2)
                        ELSE 0 
                    END AS porcentaje_cobranza
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY fechacarga, cuentaventa
                ORDER BY fechacarga ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    /**
     * FIN FUNCIONES PARA GRAFICO DE ANTICIPOS
     */

    /**
     * FUNCIONES PARA 20DashAnalisisCtasMaxDeudoresDocs (Saldos por Cuenta de Venta)
     */
    public function getSaldosPorCuentaAnalisis(array $filtros)
    {
        $params = [
            ':fecha_inicio' => $filtros['fecha_inicio'],
            ':fecha_fin'    => $filtros['fecha_fin']
        ];

        $where = [
            "fechacarga BETWEEN :fecha_inicio AND :fecha_fin"
        ];

        // Filtro Cuentas
        if (!empty($filtros['cuentas'])) {
            $inCuentas = [];
            foreach ($filtros['cuentas'] as $i => $cta) {
                $ph = ":cta_" . $i;
                $inCuentas[] = $ph;
                $params[$ph] = $cta;
            }
            $where[] = "cuentaventa IN (" . implode(', ', $inCuentas) . ")";
        }

        // Helper para filtros con soporte a valores 'NULL'
        $procesarFiltroNullable = function ($campo, $valores, $prefijo) use (&$where, &$params) {
            if (empty($valores)) return;
            $tieneNull = in_array('NULL', $valores, true);
            $valoresLimpios = array_filter($valores, function ($v) {
                return $v !== 'NULL';
            });

            $condiciones = [];
            if (!empty($valoresLimpios)) {
                $inPlaceholders = [];
                foreach (array_values($valoresLimpios) as $i => $val) {
                    $ph = ":{$prefijo}_" . $i;
                    $inPlaceholders[] = $ph;
                    $params[$ph] = $val;
                }
                $condiciones[] = "{$campo} IN (" . implode(', ', $inPlaceholders) . ")";
            }

            if ($tieneNull) {
                $condiciones[] = "({$campo} IS NULL OR {$campo} = '')";
            }

            if (!empty($condiciones)) {
                $where[] = '(' . implode(' OR ', $condiciones) . ')';
            }
        };

        $procesarFiltroNullable('vencimiento', $filtros['vencimientos'] ?? [], 'venc');
        $procesarFiltroNullable('decision', $filtros['decisiones'] ?? [], 'dec');
        $procesarFiltroNullable('observacion', $filtros['observaciones'] ?? [], 'obs');

        $sql = "SELECT 
                    cuentaventa,
                    COALESCE(nomcuentaventa, cuentaventa) AS nomcuentaventa,
                    fechacarga,
                    ROUND(SUM(COALESCE(saldofinal, 0)), 2) AS saldofinal
                FROM dmdocventas2
                WHERE " . implode(' AND ', $where) . "
                GROUP BY cuentaventa, nomcuentaventa, fechacarga
                ORDER BY cuentaventa ASC, fechacarga ASC";

        $stmt = $this->conn->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
