<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/PresupuestosAccesoService.php';

class PresupuestosAccesoController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new PresupuestosAccesoService($this->db);
    }

    public function datatable()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $data = $this->service->obtenerDatatable($_GET);
            echo json_encode([
                "draw"            => isset($_GET['draw']) ? intval($_GET['draw']) : 1,
                "recordsTotal"    => $data['recordsTotal'],
                "recordsFiltered" => $data['recordsFiltered'],
                "data"            => $data['data']
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }

    public function obtenerDatosParaUsuario()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $codigo = $_GET['codigo'] ?? null;
            $epre   = $_GET['epre'] ?? 'RS';

            if (!$codigo) {
                throw new Exception("El código de usuario no fue proporcionado.");
            }

            $data = $this->service->obtenerDatosParaUsuario($codigo, $epre);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    public function guardar()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $datos = $_POST;
            if (empty($datos)) {
                $datos = json_decode(file_get_contents("php://input"), true) ?? [];
            }

            $this->service->guardarPresupuestosUsuario($datos);
            echo json_encode([
                'success' => true,
                'message' => 'Presupuestos asignados correctamente al usuario.'
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }

    public function misPresupuestos()
    {
        header('Content-Type: application/json; charset=utf-8');
        try {
            $codigo = $_GET['codigo'] ?? $_SESSION['usuario'] ?? null;
            $epre   = $_GET['epre'] ?? $_SESSION['epre'] ?? 'RS';

            $data = $this->service->obtenerMisPresupuestosAutorizados($codigo, $epre);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        exit;
    }
}
