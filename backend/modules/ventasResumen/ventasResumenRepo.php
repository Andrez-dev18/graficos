<?php

class VentasResumenRepo
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    /**
     * Obtiene las líneas de proceso distintas disponibles en dmdocventasdet
     */
    public function getLineasProceso()
    {
        $sql = "SELECT DISTINCT 
                    lineaproceso 
                FROM dmdocventasdet 
                WHERE lineaproceso IS NOT NULL AND lineaproceso != ''
                ORDER BY lineaproceso ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene las zonas fiscales distintas disponibles en dmdocventasdet, opcionalmente filtradas por línea
     */
    public function getZonasFiscales($lineaProceso = null)
    {
        $params = [];
        $where = ["zonafiscal IS NOT NULL AND zonafiscal != ''"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        $sql = "SELECT DISTINCT 
                    zonafiscal 
                FROM dmdocventasdet 
                WHERE " . implode(' AND ', $where) . "
                ORDER BY zonafiscal ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los items distintos (código y nombre) disponibles en dmdocventasdet, opcionalmente filtrados por línea
     */
    public function getItems($lineaProceso = null)
    {
        $params = [];
        $where = ["coditem IS NOT NULL AND coditem != ''"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        $sql = "SELECT DISTINCT 
                    coditem, 
                    COALESCE(NULLIF(nomitem, ''), coditem) AS nomitem 
                FROM dmdocventasdet 
                WHERE " . implode(' AND ', $where) . "
                ORDER BY nomitem ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los motivos de devolución distintos disponibles en dmdocventasdet
     */
    public function getNomDevoluciones()
    {
        $sql = "SELECT DISTINCT 
                    coddevolucion, 
                    nomdevolucion 
                FROM dmdocventasdet 
                WHERE nomdevolucion IS NOT NULL AND nomdevolucion != ''
                ORDER BY nomdevolucion ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los datos consolidados y secuenciales de Ventas y Devoluciones (07VentasSacCoor)
     */
    public function getVentasSacCoor(array $filtros)
    {
        $fechaInicio  = $filtros['fecha_inicio'] ?? date('Y-01-01');
        $fechaFin     = $filtros['fecha_fin'] ?? date('Y-m-d');
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? 'TODO';
        $item         = $filtros['item'] ?? 'TODO';
        $nomDevs      = is_array($filtros['nomdevoluciones'] ?? null) ? $filtros['nomdevoluciones'] : [];

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = ["fechaproceso BETWEEN :f_ini AND :f_fin"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        if (!empty($zonaFiscal) && $zonaFiscal !== 'TODO') {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $zonaFiscal;
        }

        if (!empty($item) && $item !== 'TODO') {
            $where[] = "coditem = :item";
            $params[':item'] = $item;
        }

        // Filtro por devoluciones: si se especificó una lista parcial de motivos de devolución
        if (!empty($nomDevs)) {
            $devPhs = [];
            foreach (array_values($nomDevs) as $i => $dev) {
                $ph = ":dev_" . $i;
                $devPhs[] = $ph;
                $params[$ph] = $dev;
            }
            // Los documentos de venta (01 y 03) siempre pasan, y para devoluciones deben estar en la lista seleccionada
            $where[] = "(coddoc IN ('01', '03') OR nomdevolucion IN (" . implode(', ', $devPhs) . "))";
        }

        $sql = "SELECT 
                    fechaproceso,
                    -- Unidades
                    SUM(CASE WHEN coddoc IN ('01', '03') THEN cantidad ELSE 0 END) AS cant_ventas,
                    SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN cantidad ELSE 0 END) AS cant_devs,
                    SUM(cantidad) AS cant_total_gen,

                    -- Pesos (Kg)
                    SUM(CASE WHEN coddoc IN ('01', '03') THEN peso ELSE 0 END) AS peso_ventas,
                    SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN peso ELSE 0 END) AS peso_devs,
                    SUM(peso) AS peso_total_gen,

                    -- Montos Soles (Subtotal y Total)
                    SUM(CASE WHEN coddoc IN ('01', '03') THEN subtotal ELSE 0 END) AS subtotal_ventas,
                    SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN subtotal ELSE 0 END) AS subtotal_devs,
                    SUM(subtotal) AS subtotal_total_gen
                FROM dmdocventasdet
                WHERE " . implode(' AND ', $where) . "
                GROUP BY fechaproceso
                ORDER BY fechaproceso ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el desglose secundario para el modal: Clientes (Ventas y Devoluciones) y Detalle de Devoluciones
     */
    public function getAnalisisSecundario(array $filtros)
    {
        $fecha        = $filtros['fecha'] ?? null;
        $fechaInicio  = $filtros['fecha_inicio'] ?? ($fecha ?: date('Y-01-01'));
        $fechaFin     = $filtros['fecha_fin'] ?? ($fecha ?: date('Y-m-d'));
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? 'TODO';
        $item         = $filtros['item'] ?? 'TODO';
        $nomDevs      = is_array($filtros['nomdevoluciones'] ?? null) ? $filtros['nomdevoluciones'] : [];

        $params = [
            ':f_ini' => $fecha ?: $fechaInicio,
            ':f_fin' => $fecha ?: $fechaFin
        ];

        $where = ["fechaproceso BETWEEN :f_ini AND :f_fin"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        if (!empty($zonaFiscal) && $zonaFiscal !== 'TODO') {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $zonaFiscal;
        }

        if (!empty($item) && $item !== 'TODO') {
            $where[] = "coditem = :item";
            $params[':item'] = $item;
        }

        if (!empty($nomDevs)) {
            $devPhs = [];
            foreach (array_values($nomDevs) as $i => $dev) {
                $ph = ":dev_" . $i;
                $devPhs[] = $ph;
                $params[$ph] = $dev;
            }
            $where[] = "(coddoc IN ('01', '03') OR nomdevolucion IN (" . implode(', ', $devPhs) . "))";
        }

        $whereStr = implode(' AND ', $where);

        // 1. Clientes / Corporativos con desglose de ventas, devoluciones y totales
        $sqlClientes = "SELECT 
                            COALESCE(NULLIF(nomcorporativo, ''), nomcliente) AS corporativo,
                            SUM(CASE WHEN coddoc IN ('01', '03') THEN cantidad ELSE 0 END) AS cant_ventas,
                            SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN cantidad ELSE 0 END) AS cant_dev,
                            SUM(cantidad) AS cant_total,
                            SUM(CASE WHEN coddoc IN ('01', '03') THEN peso ELSE 0 END) AS peso_ventas,
                            SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN peso ELSE 0 END) AS peso_dev,
                            SUM(peso) AS peso_total,
                            SUM(CASE WHEN coddoc IN ('01', '03') THEN subtotal ELSE 0 END) AS subtotal_ventas,
                            SUM(CASE WHEN coddoc NOT IN ('01', '03') THEN subtotal ELSE 0 END) AS subtotal_dev,
                            SUM(subtotal) AS subtotal_total
                        FROM dmdocventasdet
                        WHERE {$whereStr}
                        GROUP BY corporativo
                        ORDER BY cant_ventas DESC";

        $stmtClientes = $this->conn->prepare($sqlClientes);
        $stmtClientes->execute($params);
        $clientes = $stmtClientes->fetchAll(PDO::FETCH_ASSOC);

        // 2. Desglose de Devoluciones por Motivo y Cliente
        $whereDevs = $where;
        $whereDevs[] = "coddoc NOT IN ('01', '03')";
        $whereDevs[] = "nomdevolucion IS NOT NULL AND nomdevolucion != ''";
        $whereDevsStr = implode(' AND ', $whereDevs);

        $sqlDevs = "SELECT 
                        nomdevolucion,
                        COALESCE(NULLIF(nomcorporativo, ''), nomcliente) AS corporativo,
                        SUM(cantidad) AS cantidad,
                        SUM(peso) AS peso,
                        SUM(subtotal) AS subtotal
                    FROM dmdocventasdet
                    WHERE {$whereDevsStr}
                    GROUP BY nomdevolucion, corporativo
                    ORDER BY subtotal ASC";

        $stmtDevs = $this->conn->prepare($sqlDevs);
        $stmtDevs->execute($params);
        $devoluciones = $stmtDevs->fetchAll(PDO::FETCH_ASSOC);

        return [
            'clientes'     => $clientes,
            'devoluciones' => $devoluciones
        ];
    }

    /**
     * Obtiene el comparativo Plan vs Real (Diario y Acumulado) agrupado por Zona y por Item
     * Para ser consumido en el Modal de Cumplimiento (06VentasSaca)
     */
    public function getCumplimientoPlanVsReal(array $filtros)
    {
        $fechaInicio  = $filtros['fecha_inicio'] ?? date('Y-01-01');
        $fechaFin     = $filtros['fecha_fin'] ?? date('Y-m-d');
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? 'TODO';
        $item         = $filtros['item'] ?? 'TODO';

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = ["fechaproceso BETWEEN :f_ini AND :f_fin"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        if (!empty($zonaFiscal) && $zonaFiscal !== 'TODO') {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $zonaFiscal;
        }

        if (!empty($item) && $item !== 'TODO') {
            $where[] = "coditem = :item";
            $params[':item'] = $item;
        }

        $sql = "SELECT 
                    fechaproceso,
                    TRIM(COALESCE(NULLIF(zonafiscal, ''), 'SIN ZONA')) AS zonafiscal,
                    coditem,
                    COALESCE(NULLIF(nomitem, ''), coditem) AS nomitem,
                    ROUND(SUM(COALESCE(cantidadplan, 0)), 2) AS cant_plan_diario,
                    ROUND(SUM(COALESCE(cantidadreal, 0)), 2) AS cant_real_diario
                FROM dmmetasventa
                WHERE " . implode(' AND ', $where) . "
                GROUP BY fechaproceso, TRIM(COALESCE(NULLIF(zonafiscal, ''), 'SIN ZONA')), coditem, nomitem
                ORDER BY zonafiscal ASC, fechaproceso ASC, coditem ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene la matriz principal de Devoluciones por Zona, Item y Motivo (08DevolucionesSaca)
     */
    public function getDevolucionesPorZonaMotivo(array $filtros)
    {
        $fechaInicio  = $filtros['fecha_inicio'] ?? date('Y-01-01');
        $fechaFin     = $filtros['fecha_fin'] ?? date('Y-m-d');
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? 'TODO';
        $item         = $filtros['item'] ?? 'TODO';

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "coddoc NOT IN ('01', '03')",
            "nomdevolucion IS NOT NULL AND nomdevolucion != ''"
        ];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        if (!empty($zonaFiscal) && $zonaFiscal !== 'TODO') {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $zonaFiscal;
        }

        if (!empty($item) && $item !== 'TODO') {
            $where[] = "coditem = :item";
            $params[':item'] = $item;
        }

        $sql = "SELECT 
                    TRIM(zonafiscal) AS zonafiscal,
                    coditem,
                    CONCAT(coditem, ' ', nomitem) AS item,
                    nomdevolucion,
                    ROUND(SUM(COALESCE(cantidad, 0)), 2) AS total_cant,
                    ROUND(SUM(COALESCE(peso, 0)), 2) AS total_peso,
                    ROUND(SUM(COALESCE(total, 0)), 2) AS total_valor
                FROM dmdocventasdet
                WHERE " . implode(' AND ', $where) . "
                GROUP BY TRIM(zonafiscal), coditem, nomitem, nomdevolucion
                ORDER BY total_valor ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el desglose para el modal al hacer clic en un motivo:
     * 1. Tendencia cronológica (Evolución diaria en Kg)
     * 2. Ranking de clientes/corporativos
     */
    public function getDetalleMotivoDevolucion(array $filtros)
    {
        $fechaInicio  = $filtros['fecha_inicio'] ?? date('Y-01-01');
        $fechaFin     = $filtros['fecha_fin'] ?? date('Y-m-d');
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? '';
        $codItem      = $filtros['coditem'] ?? '';
        $nomDev       = $filtros['nomdevolucion'] ?? '';

        $params = [
            ':f_ini'  => $fechaInicio,
            ':f_fin'  => $fechaFin,
            ':zona'   => $zonaFiscal,
            ':item'   => $codItem,
            ':nomdev' => $nomDev
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "coddoc NOT IN ('01', '03')",
            "TRIM(zonafiscal) = :zona",
            "coditem = :item",
            "nomdevolucion = :nomdev"
        ];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        $whereStr = implode(' AND ', $where);

        // 1. Tendencia diaria por fecha
        $sqlTendencia = "SELECT 
                            fechaproceso,
                            ROUND(SUM(COALESCE(peso, 0)), 2) AS peso_diario
                         FROM dmdocventasdet
                         WHERE {$whereStr}
                         GROUP BY fechaproceso
                         ORDER BY fechaproceso ASC";

        $stmtTendencia = $this->conn->prepare($sqlTendencia);
        $stmtTendencia->execute($params);
        $tendencia = $stmtTendencia->fetchAll(PDO::FETCH_ASSOC);

        // 2. Ranking de Clientes
        $sqlClientes = "SELECT 
                            TRIM(zonafiscal) AS zonafiscal,
                            COALESCE(NULLIF(nomcorporativo, ''), nomcliente) AS corporativo,
                            nomcliente,
                            ROUND(SUM(COALESCE(cantidad, 0)), 2) AS cant_dev,
                            ROUND(SUM(COALESCE(peso, 0)), 2) AS peso_dev,
                            ROUND(SUM(COALESCE(total, 0)), 2) AS valor_dev
                        FROM dmdocventasdet
                        WHERE {$whereStr}
                        GROUP BY TRIM(zonafiscal), corporativo, nomcliente
                        ORDER BY valor_dev DESC";

        $stmtClientes = $this->conn->prepare($sqlClientes);
        $stmtClientes->execute($params);
        $clientes = $stmtClientes->fetchAll(PDO::FETCH_ASSOC);

        return [
            'tendencia' => $tendencia,
            'clientes'  => $clientes
        ];
    }

    /**
     * Obtiene los registros detallados de ventas y devoluciones para el modal Ver Datos
     */
    public function getDetalle(array $filtros)
    {
        $fecha        = $filtros['fechaproceso'] ?? ($filtros['fecha'] ?? null);
        $fechaInicio  = $filtros['fecha_inicio'] ?? ($fecha ?: date('Y-01-01'));
        $fechaFin     = $filtros['fecha_fin'] ?? ($fecha ?: date('Y-m-d'));
        $lineaProceso = $filtros['lineaproceso'] ?? 'TODO';
        $zonaFiscal   = $filtros['zonafiscal'] ?? 'TODO';
        $item         = $filtros['item'] ?? 'TODO';
        $nomDevs      = is_array($filtros['nomdevoluciones'] ?? null) ? $filtros['nomdevoluciones'] : [];

        $params = [
            ':f_ini' => $fecha ?: $fechaInicio,
            ':f_fin' => $fecha ?: $fechaFin
        ];

        $where = ["fechaproceso BETWEEN :f_ini AND :f_fin"];

        if (!empty($lineaProceso) && $lineaProceso !== 'TODO') {
            $where[] = "lineaproceso = :lineaproceso";
            $params[':lineaproceso'] = $lineaProceso;
        }

        if (!empty($zonaFiscal) && $zonaFiscal !== 'TODO') {
            $where[] = "zonafiscal = :zonafiscal";
            $params[':zonafiscal'] = $zonaFiscal;
        }

        if (!empty($item) && $item !== 'TODO') {
            $where[] = "coditem = :item";
            $params[':item'] = $item;
        }

        if (!empty($nomDevs)) {
            $devPhs = [];
            foreach (array_values($nomDevs) as $i => $dev) {
                $ph = ":dev_" . $i;
                $devPhs[] = $ph;
                $params[$ph] = $dev;
            }
            $where[] = "(coddoc IN ('01', '03') OR nomdevolucion IN (" . implode(', ', $devPhs) . "))";
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    lineaproceso,
                    fechaproceso,
                    CASE WHEN coddoc IN ('01', '03') THEN 'VENTAS' ELSE 'DEVOLUCIONES' END AS tipo_doc,
                    coditem,
                    COALESCE(NULLIF(nomcorporativo, ''), nomcliente) AS nomcorporativo,
                    COALESCE(nomdevolucion, '') AS nomdevolucion,
                    COALESCE(nomdoc, '') AS nomdoc,
                    COALESCE(nomitem, '') AS nomitem,
                    COALESCE(zonafiscal, '') AS zonafiscal,
                    COALESCE(familia, '') AS familia,
                    CONCAT(coditem, ' ', COALESCE(nomitem, '')) AS item,
                    COALESCE(coddoc, '') AS coddoc,
                    ROUND(COALESCE(cantidad, 0), 4) AS cantidad,
                    CASE WHEN coddoc NOT IN ('01', '03') THEN ROUND(COALESCE(cantidad, 0), 4) ELSE NULL END AS cantidaddevolucion,
                    CASE WHEN coddoc IN ('01', '03') THEN ROUND(COALESCE(cantidad, 0), 4) ELSE NULL END AS cantidadventa,
                    NULL AS sum_ratio
                FROM dmdocventasdet
                WHERE {$whereStr}
                ORDER BY lineaproceso ASC, nomcorporativo ASC, coddoc ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}

