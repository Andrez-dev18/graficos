<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/MenuService.php';

class MenuController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();

        $this->service = new MenuService($this->db);
    }

    public function obtener()
    {
        header('Content-Type: application/json');

        try {
            $usuarioActual = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';

            if (!$usuarioActual) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $menuArbol = $this->service->obtenerMenuJerarquico($usuarioActual, $epre);

            if (!empty($menuArbol)) {
                echo json_encode(['success' => true, 'data' => $menuArbol]);
            } else {
                echo json_encode(['success' => true, 'data' => [], 'message' => 'El usuario no tiene roles asignados']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    //funciones para configuracion de modulos
    public function listar()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->listarTodos();
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function listarGrupos()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->listarGrupos();
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function obtenerModulosId()
    {
        header('Content-Type: application/json');
        try {
            $id = $_GET['id'] ?? null;
            if (!$id) throw new Exception("ID no proporcionado.");

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
            // Recibimos los datos (Puede ser $_POST estándar o JSON payload)
            $datos = $_POST;
            if (empty($datos)) {
                $datos = json_decode(file_get_contents("php://input"), true);
            }

            $this->service->guardarModulo($datos);

            $mensaje = empty($datos['id']) ? "Módulo creado correctamente." : "Módulo actualizado correctamente.";
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

            if (!$id) throw new Exception("ID no proporcionado.");

            $this->service->eliminarModulo($id);
            echo json_encode(['success' => true, 'message' => "Módulo eliminado correctamente."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
