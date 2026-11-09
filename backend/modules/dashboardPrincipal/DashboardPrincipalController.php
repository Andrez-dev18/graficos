<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/DashboardPrincipalService.php';

class DashboardPrincipalController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new DashboardPrincipalService($this->db);
    }

    public function resumen()
    {
        header('Content-Type: application/json');

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $nombre = $_SESSION['nombre'] ?? '';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $resumen = $this->service->obtenerResumen($usuario, $epre, $idPrograma);

            $resumen['usuario'] = [
                'codigo' => $usuario,
                'nombre' => $nombre,
                'epre' => $epre
            ];

            echo json_encode(['success' => true, 'data' => $resumen]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function registrarAcceso()
    {
        header('Content-Type: application/json');

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $datos = json_decode(file_get_contents('php://input'), true);

            if (!is_array($datos)) {
                $datos = $_POST;
            }

            $resultado = $this->service->registrarAcceso($usuario, $epre, $idPrograma, $datos);

            echo json_encode($resultado);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function obtenerAccesos()
    {
        header('Content-Type: application/json');

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $accesos = $this->service->obtenerAccesos($usuario, $epre, $idPrograma);

            echo json_encode([
                'success' => true,
                'data' => [
                    'accesos' => $accesos
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function guardarAccesos()
    {
        header('Content-Type: application/json');

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $datos = json_decode(file_get_contents('php://input'), true);

            if (!is_array($datos)) {
                $datos = $_POST;
            }

            $accesos = isset($datos['accesos']) && is_array($datos['accesos']) ? $datos['accesos'] : [];
            $accesosGuardados = $this->service->guardarAccesos($usuario, $epre, $idPrograma, $accesos, $usuario);

            echo json_encode([
                'success' => true,
                'message' => 'Accesos guardados correctamente',
                'data' => [
                    'accesos' => $accesosGuardados
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function accesosLateral()
    {
        header('Content-Type: application/json');

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Usuario no autenticado']);
                return;
            }

            $accesos = $this->service->obtenerAccesosLateral($usuario, $epre, $idPrograma);

            echo json_encode([
                'success' => true,
                'data' => [
                    'accesos' => $accesos
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
