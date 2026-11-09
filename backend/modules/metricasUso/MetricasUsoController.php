<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/MetricasUsoService.php';

class MetricasUsoController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new MetricasUsoService($this->db);
    }

    public function dashboard()
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

            if (!$this->service->tienePermiso($usuario, $epre, $idPrograma)) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'No tienes acceso a este módulo']);
                return;
            }

            $desde = $_GET['desde'] ?? '';
            $hasta = $_GET['hasta'] ?? '';

            $data = $this->service->obtenerDashboard($usuario, $epre, $idPrograma, $desde, $hasta);
            $data['usuario'] = [
                'codigo' => $usuario,
                'nombre' => $_SESSION['nombre'] ?? ''
            ];

            echo json_encode(['success' => true, 'data' => $data]);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function modulosDatatable()
    {
        $this->responderDatatable('obtenerModulosDatatable');
    }

    public function usuariosDatatable()
    {
        $this->responderDatatable('obtenerUsuariosDatatable');
    }

    public function inactivosDatatable()
    {
        $this->responderDatatable('obtenerInactivosDatatable');
    }

    private function responderDatatable($metodo)
    {
        header('Content-Type: application/json');

        $draw = (int) ($_GET['draw'] ?? 0);

        try {
            $usuario = $_SESSION['usuario'] ?? null;
            $epre = $_SESSION['epre'] ?? 'RS';
            $idPrograma = $_SESSION['id_programa'] ?? '5';

            if (!$usuario) {
                http_response_code(401);
                echo json_encode([
                    'draw' => $draw,
                    'recordsTotal' => 0,
                    'recordsFiltered' => 0,
                    'data' => [],
                    'error' => 'Usuario no autenticado'
                ]);
                return;
            }

            if (!$this->service->tienePermiso($usuario, $epre, $idPrograma)) {
                http_response_code(403);
                echo json_encode([
                    'draw' => $draw,
                    'recordsTotal' => 0,
                    'recordsFiltered' => 0,
                    'data' => [],
                    'error' => 'No tienes acceso a este módulo'
                ]);
                return;
            }

            $resultado = $this->service->$metodo($usuario, $epre, $idPrograma, $_GET);

            echo json_encode($resultado);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            echo json_encode([
                'draw' => $draw,
                'recordsTotal' => 0,
                'recordsFiltered' => 0,
                'data' => [],
                'error' => $e->getMessage()
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'draw' => $draw,
                'recordsTotal' => 0,
                'recordsFiltered' => 0,
                'data' => [],
                'error' => $e->getMessage()
            ]);
        }
    }
}
