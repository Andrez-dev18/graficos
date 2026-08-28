<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/AsignacionService.php';

class AsignacionController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();

        // Pasamos la conexión al Service
        $this->service = new AsignacionService($this->db);
    }

    public function datatable()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->obtenerDatatable($_GET);
            echo json_encode([
                "draw" => isset($_GET['draw']) ? intval($_GET['draw']) : 1,
                "recordsTotal" => $data['recordsTotal'],
                "recordsFiltered" => $data['recordsFiltered'],
                "data" => $data['data']
            ]);
        } catch (Exception $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // Esta ruta alimentará el Modal (trae las tarjetas de roles + los roles marcados del user)
    public function obtenerDatosParaRoles()
    {
        header('Content-Type: application/json');
        try {
            $codigo = $_GET['codigo'] ?? null;
            if (!$codigo) {
                throw new Exception("El Documento de Identidad (codigo) no fue proporcionado.");
            }

            $data = $this->service->obtenerDatosRoles($codigo);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function guardar()
    {
        header('Content-Type: application/json');
        try {
            $datos = $_POST;
            if (empty($datos)) {
                $datos = json_decode(file_get_contents("php://input"), true);
            }

            $this->service->guardarRolesUsuario($datos);
            echo json_encode(['success' => true, 'message' => "Roles asignados correctamente al usuario."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
