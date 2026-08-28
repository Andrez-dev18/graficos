<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/HistorialService.php';

class HistorialController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();    
        $this->service = new HistorialService($this->db);
    }

    // Ruta principal para el Datatable
    public function listar()
    {
        $request = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        try {
            $respuesta = $this->service->procesarDatatable($request);
            
            header('Content-Type: application/json');
            echo json_encode($respuesta);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "error" => "Error al procesar el historial: " . $e->getMessage()
            ]);
        }
    }

    // Ruta para poblar los <select> del frontend dinámicamente
    public function cargarFiltros()
    {
        try {
            $filtros = $this->service->obtenerFiltrosUnicos();
            header('Content-Type: application/json');
            echo json_encode([
                "success" => true,
                "data"    => $filtros
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => $e->getMessage()]);
        }
    }
}
?>