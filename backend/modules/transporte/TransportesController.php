<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/TransportesService.php';

class TransportesController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new TransportesService($this->db);
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDashboardCompleto($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Dashboard Transportes: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getDetalleEventos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDetalleEventos($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al consultar DetalleEventos: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}