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
}
