<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/UsuarioService.php';

class UsuarioController
{
    private $db;
    private $service;

    public function __construct()
    {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->service = new UsuarioService($this->db);
    }

    public function login()
    {
        $data = json_decode(file_get_contents("php://input"), true);
        $usuario   = $data['usuario'] ?? '';
        $password  = $data['password'] ?? '';
        $ubicacion = $data['ubicacion_gps'] ?? '';

        $resultado = $this->service->autenticar($usuario, $password, $ubicacion);

        if ($resultado['success']) {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }

            $codigoValidar = $resultado['data']['codigo'];
            $epreValidar   = $resultado['data']['epre'] ?? 'RS';

            $tieneRoles = $this->service->tieneRolesActivos($codigoValidar, $epreValidar, 5);

            if (!$tieneRoles) {
                http_response_code(403);
                echo json_encode([
                    "success" => false,
                    "message" => "Acceso denegado: Tu cuenta no tiene roles asignados para Planta Beneficio o han sido desactivados. Comunícate con el administrador."
                ]);
                return;
            }


            $_SESSION['usuario']       = $codigoValidar; // Código corporativo
            $_SESSION['nombre']        = $resultado['data']['nombre'];
            $_SESSION['epre']          = $epreValidar;
            $_SESSION['ruc']           = $resultado['data']['ruc'] ?? '';
            $_SESSION['id_programa']   = '5'; // Forzamos el ID de contexto del sistema actual

            echo json_encode([
                'success' => true,
                'data' => $resultado['data']
            ]);
        } else {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => $resultado['message']
            ]);
        }
    }

    public function validarSesion()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (isset($_SESSION['usuario'])) {
            echo json_encode([
                "success"     => true,
                "id_programa" => $_SESSION['id_programa'] ?? '5',
                "usuario"     => $_SESSION['usuario'], 
                "nombre"      => $_SESSION['nombre'],
                "epre"        => $_SESSION['epre'] ?? 'RS',
                "ruc"         => $_SESSION['ruc'] 
            ]);
        } else {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Sesión no iniciada"
            ]);
        }
    }

    public function logout()
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        session_unset();
        session_destroy();

        echo json_encode([
            "success" => true,
            "message" => "Sesión cerrada correctamente"
        ]);
    }

    public function actualizarPassword()
    {
        try {
            if (session_status() === PHP_SESSION_NONE) {
                session_start();
            }

            $usuarioCodigo = $_SESSION['usuario'] ?? null;
            $epre          = $_SESSION['epre'] ?? null;

            if (!$usuarioCodigo || !$epre) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Sesión expirada o no autenticada']);
                return;
            }

            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Datos inválidos']);
                return;
            }

            $oldPassword     = $data['oldPassword'] ?? '';
            $newPassword     = $data['newPassword'] ?? '';
            $confirmPassword = $data['confirmPassword'] ?? '';

            if (empty($oldPassword) || empty($newPassword) || empty($confirmPassword)) {
                echo json_encode(['success' => false, 'message' => 'Complete todos los campos']);
                return;
            }

            if ($newPassword !== $confirmPassword) {
                echo json_encode(['success' => false, 'message' => 'Las contraseñas nuevas no coinciden']);
                return;
            }

            $resultado = $this->service->cambiarPassword($usuarioCodigo, $epre, $oldPassword, $newPassword);

            echo json_encode([
                'success' => $resultado['success'],
                'message' => $resultado['message']
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }


    public function obtenerUsuarios()
    {
        header('Content-Type: application/json');
        try {
            $data = $this->service->obtenerUserDatatable($_GET);
            echo json_encode([
                "draw"            => isset($_GET['draw']) ? intval($_GET['draw']) : 1,
                "recordsTotal"    => $data['recordsTotal'],
                "recordsFiltered" => $data['recordsFiltered'],
                "data"            => $data['data']
            ]);
        } catch (Exception $e) {
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function obtenerUsuario()
    {
        header('Content-Type: application/json');
        try {
            $codigo = $_GET['codigo'] ?? null;
            $data = $this->service->obtenerPorCodigo($codigo);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function guardarUsuario()
    {
        header('Content-Type: application/json');
        try {
            $datos = $_POST;
            if (empty($datos)) {
                $datos = json_decode(file_get_contents("php://input"), true);
            }

            $this->service->guardarUsuario($datos);

            $mensaje = (!empty($datos['is_edit']) && $datos['is_edit'] === 'true')
                ? "Usuario actualizado correctamente."
                : "Usuario creado correctamente.";

            echo json_encode(['success' => true, 'message' => $mensaje]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function cambiarEstado()
    {
        header('Content-Type: application/json');
        try {
            $datos = json_decode(file_get_contents("php://input"), true);

            $codigo = $datos['codigo'] ?? $_POST['codigo'] ?? null;

            $this->service->cambiarEstado($codigo);
            echo json_encode(['success' => true, 'message' => "Estado actualizado."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function resetPassword()
    {
        header('Content-Type: application/json');
        try {
            $datos = json_decode(file_get_contents("php://input"), true);

            $codigo   = $datos['codigo'] ?? $_POST['codigo'] ?? null;
            $password = $datos['password'] ?? $_POST['password'] ?? null;

            $this->service->resetearPassword($codigo, $password);
            echo json_encode(['success' => true, 'message' => "Contraseña actualizada."]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
