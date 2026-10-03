<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/Ventas2025Service.php';

class Ventas2025Controller
{
    private $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    /**
     * Obtiene la conexión adecuada según el año seleccionado
     * 2024 -> cia2024 (secundaria '2024')
     * 2025 -> cia2025 (secundaria '2025')
     * 2026 -> cia2026 (principal)
     */
    private function getDbForYear($anio)
    {
        $db = $this->database->getConnection();
        $anioStr = trim((string)$anio);

        if ($db instanceof SmartPDO) {
            if (($anioStr === '2024' || $anioStr === '2025') && $db->getConnection($anioStr)) {
                return $db->getConnection($anioStr);
            }
            return $db;
        }

        return $db;
    }

    public function getFiltros()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $anio = isset($_GET['anio']) ? trim($_GET['anio']) : (isset($_POST['anio']) ? trim($_POST['anio']) : '2025');
            $db = $this->getDbForYear($anio);
            $service = new Ventas2025Service($db);

            $resultado = $service->obtenerFiltrosIniciales($anio);
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
                'message' => 'Error al cargar filtros de Ventas: ' . $e->getMessage()
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

            $anio = $data['anio'] ?? $_GET['anio'] ?? '2025';
            $db = $this->getDbForYear($anio);
            $service = new Ventas2025Service($db);

            $resultado = $service->obtenerDashboard($data ?? []);

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
                'message' => 'Error al cargar Ventas: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}
