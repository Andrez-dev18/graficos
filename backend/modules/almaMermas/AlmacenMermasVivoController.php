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
