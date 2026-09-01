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
     * Obtiene el desglose completo de registros para una cuenta y fecha específica
     */
    public function getDetallePorCuentaYFecha($cuentaventa, $fechacarga, array $clientes = [])
    {
        $params = [
            ':cuentaventa' => $cuentaventa,
            ':fechacarga'  => $fechacarga
        ];

        $where = [
            "cuentaventa = :cuentaventa",
            "fechacarga = :fechacarga",
            "COALESCE(saldofinal, 0) > 0" // Excluye registros en cero o negativos
        ];

        // Filtro opcional si el usuario restringió clientes
        if (!empty($clientes)) {
            $clientesPlaceholders = [];
            foreach ($clientes as $i => $cli) {
                $ph = ":cli_" . $i;
                $clientesPlaceholders[] = $ph;
                $params[$ph] = $cli;
            }
            $where[] = "nomcliente IN (" . implode(', ', $clientesPlaceholders) . ")";
        }

        $sql = "SELECT 
                    cuentaventa,
                    fechacarga,
                    codcliente,
                    COALESCE(nomcliente, 'SIN NOMBRE') AS nomcliente,
                    COALESCE(condicionpago, '-') AS condicionpago,
                    COALESCE(numerodoc, '-') AS numerodoc,
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
     * FUNCIONES PARA GRAFICO DE LINEAS SALDOS POR COBRAR
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
}
