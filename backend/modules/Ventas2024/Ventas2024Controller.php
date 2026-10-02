<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/Ventas2024Service.php';

class Ventas2024Controller
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $db = $database->getConnection();
        // Conexión específica para Ventas 2024 con fallback a conexión base
        $this->db = ($db instanceof SmartPDO && $db->getConnection('2024')) 
            ? $db->getConnection('2024') 
            : $db;
        $this->service = new Ventas2024Service($this->db);
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $resultado = $this->service->obtenerFiltrosIniciales();
            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar filtros de Ventas2024: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    public function getDashboard()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $rawInput = file_get_contents('php://input');
            $data = json_decode($rawInput, true) ?? $_POST;

            $resultado = $this->service->obtenerDashboard($data ?? []);

            echo json_encode([
                'success' => true,
                'status'  => 'success',
                'payload' => $resultado,
                'data'    => $resultado
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'status'  => 'error',
                'message' => 'Error al cargar Ventas2024: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
