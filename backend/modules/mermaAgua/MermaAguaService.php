<?php

require_once __DIR__ . '/handlers/VistaProcesoHandler.php';

class MermaAguaService
{
    private $db;
    private $conexion;

    public function __construct(PDO $principal)
    {
        [$this->db, $this->conexion] = $this->resolverConexion($principal);
    }

    public function obtenerVistaProceso(array $filtros = []): array
    {
        return VistaProcesoHandler::handle($this->db, $filtros, $this->conexion);
    }

    private function resolverConexion(PDO $principal): array
    {
        if ($principal instanceof SmartPDO) {
            $joya = $principal->getConnection('joya');
            if ($joya instanceof PDO && $this->tablaActualizada($joya)) {
                return [$joya, 'joya'];
            }
        }

        return [$principal, 'principal'];
    }

    private function tablaActualizada(PDO $conn): bool
    {
        try {
            $columnas = $conn->query("SHOW COLUMNS FROM factmermaagua")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('ubicacion', $columnas, true)) {
                return false;
            }

            $fila = $conn->query("
                SELECT MAX(tfectra) AS fecha_max
                FROM factmermaagua
                WHERE tfectra > '0000-00-00'
            ")->fetch(PDO::FETCH_ASSOC);

            if (!$fila || empty($fila['fecha_max'])) {
                return false;
            }

            $limite = date('Y-m-d', strtotime('-18 months'));
            return $fila['fecha_max'] >= $limite;
        } catch (Throwable $e) {
            return false;
        }
    }
}
