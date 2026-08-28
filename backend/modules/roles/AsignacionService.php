<?php

require_once __DIR__ . '/AsignacionRepository.php';

class AsignacionService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new AsignacionRepository($db);
    }

    public function obtenerDatatable($params)
    {
        $start       = $params['start'] ?? 0;
        $length      = $params['length'] ?? 10;
        $searchValue = $params['search']['value'] ?? '';

        $epre        = $params['epre'] ?? 'RS';

        return $this->repo->getUsuariosRolesDataTable($start, $length, $searchValue, $epre);
    }

    public function obtenerDatosRoles($codigoUsuario, $epre = 'RS')
    {
        if (empty($codigoUsuario)) {
            throw new Exception("El código de usuario es obligatorio.");
        }

        return [
            'roles_disponibles' => $this->repo->obtenerRolesDisponibles('5'),
            'roles_usuario'     => $this->repo->obtenerRolesDeUsuario($codigoUsuario, $epre)
        ];
    }

    public function guardarRolesUsuario($datos)
    {
        if (empty($datos['codigo'])) {
            throw new Exception("Código de usuario requerido.");
        }

        // array_unique para evitar que el front nos mande un rol duplicado por error de JS
        $roles   = isset($datos['roles']) ? array_unique($datos['roles']) : [];
        $epre    = $datos['epre'] ?? 'RS';
        $reduser = $_SESSION['usuario'] ?? 'SYSTEM'; // El administrador logueado que ejecuta la acción

        return $this->repo->guardarRoles($datos['codigo'], $epre, $roles, $reduser);
    }
}
