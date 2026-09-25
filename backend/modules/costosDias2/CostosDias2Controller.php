<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/CostosDias2Service.php';

class CostosDias2Controller
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new CostosDias2Service($this->db);
    }

    /**
     * Endpoint para obtener la matriz y resumen de Costos Tradicional Día 2
     */
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
                'message' => 'Error al cargar Dashboard Costos Tradicional Día 2: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    /**
     * Endpoint para obtener los catálogos y rangos de filtros
     */
    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? array_merge($_GET, $_POST);

            $filtros = $this->service->obtenerFiltros($data);

            echo json_encode([
                'success' => true,
                'payload' => $filtros,
                'data'    => $filtros
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error al obtener filtros para Costos Tradicional Día 2: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
