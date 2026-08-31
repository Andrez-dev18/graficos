<?php

class saldosxCobrarRepo
{

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

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
     * Obtiene los saldos agrupados por fecha y cuenta venta con filtros dinámicos
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
            "fechacarga = :fechacarga"
        ];

        if (!empty($clientes)) {
            $clientesPlaceholders = [];
            foreach ($clientes as $i => $cli) {
                $ph = ":cli_" . $i;
                $clientesPlaceholders[] = $ph;
                $params[$ph] = $cli;
            }
            $where[] = "nomcliente IN (" . implode(', ', $clientesPlaceholders) . ")";
        }

        // Sin ORDER BY para mantener el orden natural de extracción de MyISAM tal cual Tableau
        $sql = "SELECT 
                    cuentaventa,
                    fechacarga,
                    codcliente,
                    COALESCE(nomcliente, 'SIN NOMBRE') AS nomcliente,
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
}
