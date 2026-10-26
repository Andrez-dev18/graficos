<?php
require_once __DIR__ . '/UsuarioRepository.php';
require_once __DIR__ . '/../historial/HistorialService.php';

class UsuarioService
{
    private $repo;
    private $historialService;

    public function __construct($db)
    {
        $this->repo = new UsuarioRepository($db);
        $this->historialService = new HistorialService($db);
    }

    public function autenticar($usuario, $password, $ubicacion)
    {
        $result = $this->repo->login($usuario, $password);

        if ($result) {
            // VALIDACIÓN DE ESTADO
            if ($result['estado'] === 'I') {
                return [
                    'success' => false,
                    'message' => 'Su cuenta se encuentra desactivada. Por favor, contacte con el administrador.'
                ];
            }

            $this->historialService->logActionLogin(
                $result['codigo'],
                $result['nombre'],
                "LOGIN",
                "USUARIO - CONEMPRE",
                null,
                null,
                $result,
                "INICIO DE SESION DE USUARIO",
                $ubicacion
            );

            return [
                'success' => true,
                'data' => $result
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Usuario o contraseña incorrectos'
            ];
        }
    }

    public function cambiarPassword($codigo, $epre, $oldPassword, $newPassword)
    {
        if (empty($oldPassword) || empty($newPassword)) {
            return [
                'success' => false,
                'message' => 'Las contraseñas no pueden estar vacías.'
            ];
        }

        $actualizado = $this->repo->cambiarPassword($codigo, $epre, $oldPassword, $newPassword);

        if ($actualizado) {
            $this->historialService->logActionLogin(
                $codigo,
                "", 
                "CONTRASEÑA ACTUALIZADA",
                "USUARIO",
                null,
                null, 
                null, 
                "CAMBIO DE CONTRASEÑA DE USUARIO",
                "" 
            );

            return [
                'success' => true,
                'message' => 'Contraseña actualizada correctamente.'
            ];
        } else {
            return [
                'success' => false,
                'message' => 'La contraseña actual es incorrecta.'
            ];
        }
    }


    public function obtenerUserDatatable($params)
    {
        $start = $params['start'] ?? 0;
        $length = $params['length'] ?? 10;
        $searchValue = $params['search']['value'] ?? '';
        $orderColumn = $params['order'][0]['column'] ?? 0;
        $orderDir = $params['order'][0]['dir'] ?? 'ASC';

        return $this->repo->getUsuariosServerSide($start, $length, $searchValue, $orderColumn, $orderDir);
    }

    public function obtenerPorCodigo($codigo)
    {
        return $this->repo->obtenerPorCodigo($codigo);
    }

    public function guardarUsuario($datos)
    {
        $isEdit = !empty($datos['is_edit']) && $datos['is_edit'] === 'true';

        if (empty($datos['codigo']) || empty($datos['nombre'])) {
            throw new Exception("Código y Nombre son obligatorios.");
        }

        if (!$isEdit) {
            if (empty($datos['password'])) {
                throw new Exception("La contraseña es obligatoria para usuarios nuevos.");
            }
            $existe = $this->repo->obtenerPorCodigo($datos['codigo']);
            if ($existe) {
                throw new Exception("Ya existe un usuario con el código: " . $datos['codigo']);
            }
        }

        return $this->repo->guardar($datos, $isEdit);
    }

    public function cambiarEstado($codigo)
    {
        if (empty($codigo)) throw new Exception("Código no proporcionado.");
        return $this->repo->toggleEstado($codigo);
    }

    public function resetearPassword($codigo, $newPassword)
    {
        if (empty($codigo) || empty($newPassword)) {
            throw new Exception("Código y nueva contraseña son obligatorios.");
        }
        return $this->repo->adminResetPassword($codigo, $newPassword);
    }


    public function tieneRolesActivos($codigoUsuario, $epre, $idPrograma = 5)
    {
        return $this->repo->tieneRolesActivos($codigoUsuario, $epre, $idPrograma);
    }
}