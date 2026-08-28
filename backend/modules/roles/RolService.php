<?php

require_once __DIR__ . '/RolRepository.php';

class RolService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new RolRepository($db);
    }

    public function listarRoles()
    {
        // Forzamos consistentemente al Programa 2
        return $this->repo->listarRoles(2);
    }

    public function obtenerModulosArbol()
    {
        // Sincronizado exactamente con el método del Repositorio para el Programa 2
        return $this->repo->obtenerModulosPrograma(2);
    }

    public function obtenerPorId($id)
    {
        if (empty($id)) {
            throw new Exception("El identificador del rol no fue proporcionado.");
        }
        return $this->repo->obtenerPorId($id);
    }

    public function guardarRol($datos)
    {
        $idPrograma = 2;
        $isEdit = !empty($datos['is_edit']) && $datos['is_edit'] === 'true';

        if (empty($datos['cod_rol']) || empty($datos['nom_rol'])) {
            throw new Exception("El código y nombre del rol son obligatorios.");
        }

        // 1. Normalización estricta (Mayúsculas y sin espacios)
        $datos['cod_rol'] = strtoupper(trim(preg_replace('/\s+/', '_', $datos['cod_rol'])));
        $datos['id_programa'] = $idPrograma;

        // 2. VALIDACIÓN GLOBAL: Evaluamos si existe en el Programa 2
        $rolExistente = $this->repo->existeCodRol($datos['cod_rol'], $idPrograma);

        if ($rolExistente) {
            if (!$isEdit) {
                // Mensaje humano para el frontend
                throw new Exception("El código de rol '{$datos['cod_rol']}' ya se encuentra registrado en el sistema de Planta Beneficio.");
            } else {
                if ((int)$rolExistente['id'] !== (int)$datos['id']) {
                    throw new Exception("El código de rol '{$datos['cod_rol']}' ya está siendo usado por otro rol.");
                }
            }
        }

        // Limpieza perimetral de duplicados
        $modulosPermitidos = isset($datos['modulos_permitidos']) ? array_unique($datos['modulos_permitidos']) : [];

        return $this->repo->guardar($datos, $modulosPermitidos, $isEdit);
    }

    public function eliminarRol($id)
    {
        // Verificamos primero si intentan borrar el registro administrativo
        $rolActual = $this->repo->obtenerPorId($id);

        if ($rolActual) {
            $codRol = strtoupper($rolActual['cod_rol'] ?? '');
            if ($id == 1 || $codRol === 'ADMIN-PLANTA' || $codRol === 'ADMIN_PLANTA' || $codRol === 'ADMIN') {
                throw new Exception("El rol de Administrador de la Planta está blindado y no se puede eliminar por seguridad.");
            }
        }

        return $this->repo->eliminar($id);
    }

    public function cambiarEstado($id, $estado)
    {
        $rolActual = $this->repo->obtenerPorId($id);

        if ($rolActual) {
            $codRol = strtoupper($rolActual['cod_rol'] ?? '');
            if (($id == 1 || $codRol === 'ADMIN-PLANTA' || $codRol === 'ADMIN_PLANTA' || $codRol === 'ADMIN') && (int)$estado === 0) {
                throw new Exception("Protección del Sistema: No se puede desactivar el acceso del rol Administrador principal.");
            }
        }

        // Casteamos de forma binaria el estado (1 o 0) para enviarlo limpio a la base de datos
        $estadoBinario = (int)$estado === 1 ? 1 : 0;

        return $this->repo->cambiarEstado($id, $estadoBinario);
    }
}
