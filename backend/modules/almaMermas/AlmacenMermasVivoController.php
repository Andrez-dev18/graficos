<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AlmacenMermasVivoService.php';

class AlmacenMermasVivoController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();

        if ($this->db instanceof SmartPDO) {
            $comercial = $this->db->getConnection('tc');
            if ($comercial) {
                $this->db = $comercial;
            }
        }

        $this->service = new AlmacenMermasVivoService($this->db);
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso / Cliente / Placa
     */
    public function getPorcMermaProcesoDiaClientePlaca()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaProcesoDiaClientePlaca($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaProcesoDiaClientePlaca: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso y Cliente
     */
    public function getPorcMermaProcesoDiaCliente()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaProcesoDiaCliente($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaProcesoDiaCliente: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso, Cliente y Zona (con Objetivo y Desvío)
     */
    public function getPorcMermaProcesoDiaClienteZona()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaProcesoDiaClienteZona($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaProcesoDiaClienteZona: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso
     */
    public function getPorcMermaDiariaProceso()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaDiariaProceso($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaDiariaProceso: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Mensualizada por Fecha de Proceso
     */
    public function getPorcMermaDiariaProcesoMesZona()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaDiariaProcesoMesZona($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaDiariaProcesoMesZona: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso segmentado por cliente
     */
    public function getPorcMermaDiariaProcesoCiente()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaDiariaProcesoCiente($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaDiariaProcesoCiente: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint POST: Porcentaje de Merma Diaria por Fecha de Proceso por cliente y placa
     */
    public function getPorcMermaDiariaProcesoCientePlaca()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerPorcMermaDiariaProcesoCientePlaca($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar PorcMermaDiariaProcesoCientePlaca: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint GET: opciones de filtros de cliente y placa
     */
    public function getFiltrosMerma()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $resultado = $this->service->obtenerFiltrosMerma();

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar filtros de mermas: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getMermaProcesoPlacaObjetivo()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerMermaProcesoPlacaObjetivo($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar MermaProcesoPlacaObjetivo: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getDetallePlacaRutaCausales()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDetallePlacaRutaCausales($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al procesar DetallePlacaRutaCausales: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
