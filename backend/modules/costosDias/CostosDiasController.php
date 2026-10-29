<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/CostosDiasService.php';
require_once __DIR__ . '/CostosDiasPdf.php';

class CostosDiasController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new CostosDiasService($this->db);
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDashboard($data);

            echo json_encode([
                'success' => true,
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al cargar Dashboard Costos Tradicional Día: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function exportarPdf()
    {
        try {
            $rawInput = file_get_contents('php://input');
            $payload = json_decode($rawInput, true) ?? $_POST;

            CostosDiasPdf::generar($payload);
        } catch (Throwable $e) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'message' => 'Error al generar PDF: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
