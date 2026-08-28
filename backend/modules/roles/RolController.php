<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/RolService.php';

class RolController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();

        // Pasamos la conexión al Service
        $this->service = new RolService($this->db);
    }

    public function listar()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->listarRoles();
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function obtenerModulos()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->obtenerModulosArbol();
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function obtener()
    {
        header('Content-Type: application/json');
        try {
            $id = $_GET['id'] ?? null;
            if (!$id) {
                throw new Exception("ID del rol no proporcionado.");
            }

            $data = $this->service->obtenerPorId($id);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function guardar()
    {
        header('Content-Type: application/json');
        try {
            // Soporta tanto FormData de JS como payloads JSON puros
            $datos = $_POST;
            if (empty($datos)) {
                $datos = json_decode(file_get_contents("php://input"), true);
            }

            $this->service->guardarRol($datos);

            $mensaje = (!empty($datos['is_edit']) && $datos['is_edit'] === 'true')
                ? "Rol actualizado correctamente." : "Rol creado correctamente.";

            echo json_encode(['success' => true, 'message' => $mensaje]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function eliminar()
    {
        header('Content-Type: application/json');
        try {
            $datos = json_decode(file_get_contents("php://input"), true);
            $id = $datos['id'] ?? $_POST['id'] ?? null;

            if (!$id) {
                throw new Exception("ID no proporcionado para la eliminación.");
            }

            $this->service->eliminarRol($id);
            echo json_encode(['success' => true, 'message' => "Rol eliminado correctamente."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function cambiarEstado()
    {
        header('Content-Type: application/json');
        try {
            $datos = json_decode(file_get_contents("php://input"), true);
            $id = $datos['id'] ?? $_POST['id'] ?? null;
            $estado = $datos['estado'] ?? $_POST['estado'] ?? null;

            if ($id === null || $estado === null) {
                throw new Exception("Datos incompletos para actualizar el estado.");
            }

            $this->service->cambiarEstado($id, $estado);
            echo json_encode(['success' => true, 'message' => "Estado actualizado correctamente."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
