<?php

require_once __DIR__ . '/PresupuestosAccesoRepository.php';

class PresupuestosAccesoService
{
    private $repo;

    public function __construct(PDO $db)
    {
        $this->repo = new PresupuestosAccesoRepository($db);
    }

    public function obtenerDatatable(array $params)
    {
        $start       = $params['start'] ?? 0;
        $length      = $params['length'] ?? 10;
        $searchValue = $params['search']['value'] ?? '';
        $epre        = $params['epre'] ?? 'RS';

        return $this->repo->getUsuariosPresupuestosDataTable($start, $length, $searchValue, $epre);
    }

    public function obtenerDatosParaUsuario($codigoUsuario, $epre = 'RS')
    {
        if (empty($codigoUsuario)) {
            throw new Exception("El código de usuario es obligatorio.");
        }

        return [
            'presupuestos_disponibles' => $this->repo->obtenerPresupuestosDisponibles(),
            'presupuestos_usuario'     => $this->repo->obtenerPresupuestosDeUsuario($codigoUsuario, $epre)
        ];
    }

    public function guardarPresupuestosUsuario(array $datos)
    {
        if (empty($datos['codigo'])) {
            throw new Exception("Código de usuario requerido.");
        }

        $presupuestos = isset($datos['presupuestos']) && is_array($datos['presupuestos'])
            ? array_unique(array_map('trim', $datos['presupuestos']))
            : [];

        $epre    = $datos['epre'] ?? $_SESSION['epre'] ?? 'RS';
        $reduser = $_SESSION['usuario'] ?? $datos['reduser'] ?? 'SYSTEM';

        return $this->repo->guardarPresupuestos($datos['codigo'], $epre, $presupuestos, $reduser);
    }

    public function obtenerMisPresupuestosAutorizados($codigoUsuario = null, $epre = 'RS')
    {
        $usuarioCodigo = !empty($codigoUsuario) ? $codigoUsuario : ($_SESSION['usuario'] ?? null);
        $epreEmpresa   = !empty($epre) ? $epre : ($_SESSION['epre'] ?? 'RS');

        $catalogo = $this->repo->obtenerPresupuestosDisponibles();

        if (empty($usuarioCodigo)) {
            return [
                'usuario'      => null,
                'presupuestos' => [],
                'catalogo'     => $catalogo
            ];
        }

        $presupuestosUsuario = $this->repo->obtenerPresupuestosDeUsuario($usuarioCodigo, $epreEmpresa);

        return [
            'usuario'      => $usuarioCodigo,
            'presupuestos' => $presupuestosUsuario,
            'catalogo'     => $catalogo
        ];
    }
}
