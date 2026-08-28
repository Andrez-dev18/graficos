<?php
require_once __DIR__ . '/MenuRepository.php';

class MenuService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new MenuRepository($db);
    }

    public function obtenerMenuJerarquico($usuarioCodigo, $epre)
    {
        if (empty($usuarioCodigo) || empty($epre)) {
            throw new Exception("Faltan datos de identificación del usuario.");
        }

        $modulosPlanos = $this->repo->getMenuPermitido($usuarioCodigo, $epre, '2');

        return $this->construirArbol($modulosPlanos);
    }

    // Función recursiva para armar el árbol de carpetas e items
    private function construirArbol(array $elementos, $parentId = null)
    {
        $branch = array();

        foreach ($elementos as $elemento) {
            if ($elemento['parent_cod'] == $parentId) {
                $children = $this->construirArbol($elementos, $elemento['cod_mod']);

                if ($children) {
                    $elemento['children'] = $children;
                } else {
                    $elemento['children'] = [];
                }

                $branch[] = $elemento;
            }
        }
        return $branch;
    }

    public function listarTodos()
    {
        return $this->repo->listarModulosMenu('2');
    }

    public function listarGrupos()
    {
        return $this->repo->listarModulosGrupos('2');
    }

    public function obtenerPorId($id)
    {
        return $this->repo->obtenerPorId($id);
    }

    public function guardarModulo($datos)
    {
        // Validaciones básicas
        if (empty($datos['cod_mod']) || empty($datos['nom_mod']) || empty($datos['tipo']) || empty($datos['orden'])) {
            throw new Exception("Los campos Código, Nombre, Tipo y Orden son obligatorios.");
        }

        if ($datos['tipo'] === 'group') {
            $datos['url'] = null;
            $datos['tipo_param'] = null;
        }

        $datos['id_programa'] = '2';

        return $this->repo->guardar($datos);
    }

    public function eliminarModulo($id)
    {
        $modulo = $this->repo->obtenerPorId($id);

        if (!$modulo) {
            throw new Exception("El módulo no existe.");
        }

        if ($modulo['tipo'] === 'group' && $this->repo->tieneHijos($modulo['cod_mod'], '2')) {
            throw new Exception("No puedes eliminar este grupo porque tiene sub-módulos dentro. Elimina o mueve los sub-módulos primero.");
        }

        return $this->repo->eliminar($id);
    }
}
