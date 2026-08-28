<?php
date_default_timezone_set('America/Lima');

class RolRepository
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function listarRoles($idPrograma = 2)
    {
        $query = "SELECT r.id, r.cod_rol, r.nom_rol, r.descripcion, r.activo, r.id_programa,
                         (SELECT COUNT(*) FROM adm_rol_progr_modulo rpm WHERE rpm.id_rol = r.id) as total_modulos
                  FROM adm_rol r 
                  WHERE r.id_programa = :idPrograma 
                  ORDER BY r.id DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([':idPrograma' => $idPrograma]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerPorId($id, $idPrograma = 2)
    {
        $stmt = $this->conn->prepare("SELECT * FROM adm_rol WHERE id = :id AND id_programa = :idPrograma");
        $stmt->execute([':id' => $id, ':idPrograma' => $idPrograma]);
        $rol = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($rol) {
            $stmtPermisos = $this->conn->prepare("SELECT cod_mod FROM adm_rol_progr_modulo WHERE id_rol = :id");
            $stmtPermisos->execute([':id' => $id]);
            $rol['permisos'] = $stmtPermisos->fetchAll(PDO::FETCH_COLUMN);
        }

        return $rol;
    }

    public function obtenerModulosPrograma($idPrograma = 2)
    {
        $query = "SELECT cod_mod, nom_mod, tipo, parent_cod, orden 
                  FROM amd_dashboard_modulos 
                  WHERE id_programa = :idPrograma 
                  ORDER BY parent_cod, orden";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([':idPrograma' => $idPrograma]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function guardar($datos, $modulosPermitidos, $isEdit = false)
    {
        $idPrograma = 2;

        try {
            $this->conn->beginTransaction();
            $idRol = null;

            if ($isEdit) {
                $query = "UPDATE adm_rol SET cod_rol = :cod_rol, nom_rol = :nom_rol, descripcion = :descripcion 
                          WHERE id = :id AND id_programa = :id_programa";
                $stmt = $this->conn->prepare($query);
                $stmt->execute([
                    ':cod_rol' => $datos['cod_rol'],
                    ':nom_rol' => $datos['nom_rol'],
                    ':descripcion' => $datos['descripcion'] ?? null,
                    ':id' => $datos['id'],
                    ':id_programa' => $idPrograma
                ]);
                $idRol = $datos['id'];
            } else {
                $query = "INSERT INTO adm_rol (cod_rol, nom_rol, descripcion, id_programa) 
                          VALUES (:cod_rol, :nom_rol, :descripcion, :id_programa)";
                $stmt = $this->conn->prepare($query);
                $stmt->execute([
                    ':cod_rol' => $datos['cod_rol'],
                    ':nom_rol' => $datos['nom_rol'],
                    ':descripcion' => $datos['descripcion'] ?? null,
                    ':id_programa' => $idPrograma
                ]);
                $idRol = $this->conn->lastInsertId();
            }

            $stmtDel = $this->conn->prepare("DELETE FROM adm_rol_progr_modulo WHERE id_rol = :id_rol");
            $stmtDel->execute([':id_rol' => $idRol]);

            if (!empty($modulosPermitidos) && is_array($modulosPermitidos)) {
                $placeholders = [];
                $valores = [];

                foreach ($modulosPermitidos as $codMod) {
                    $placeholders[] = "(?, ?, ?)";
                    $valores[] = $idRol;
                    $valores[] = $idPrograma;
                    $valores[] = $codMod;
                }

                $queryIns = "INSERT INTO adm_rol_progr_modulo (id_rol, id_programa, cod_mod) VALUES " . implode(', ', $placeholders);
                $stmtIns = $this->conn->prepare($queryIns);
                $stmtIns->execute($valores);
            }

            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function eliminar($id)
    {
        $idPrograma = 2;

        $sqlCheck = "SELECT COUNT(*) 
                     FROM adm_usuario_rol 
                     WHERE cod_rol = (SELECT cod_rol FROM adm_rol WHERE id = :id AND id_programa = :id_programa)";

        $stmtCheck = $this->conn->prepare($sqlCheck);
        $stmtCheck->execute([
            ':id' => $id,
            ':id_programa' => $idPrograma
        ]);

        if ($stmtCheck->fetchColumn() > 0) {
            throw new Exception("No puedes eliminar este rol porque hay usuarios asignados a él en Planta Beneficio. Remueva los accesos primero.");
        }

        $this->conn->beginTransaction();
        try {
            $stmtDelPerm = $this->conn->prepare("DELETE FROM adm_rol_progr_modulo WHERE id_rol = :id");
            $stmtDelPerm->execute([':id' => $id]);

            $stmtDelRol = $this->conn->prepare("DELETE FROM adm_rol WHERE id = :id AND id_programa = :id_programa");
            $stmtDelRol->execute([
                ':id' => $id,
                ':id_programa' => $idPrograma
            ]);

            $this->conn->commit();
            return true;
        } catch (Exception $e) {
            $this->conn->rollBack();
            throw $e;
        }
    }

    public function cambiarEstado($id, $estado)
    {
        $stmt = $this->conn->prepare("UPDATE adm_rol SET activo = :estado WHERE id = :id AND id_programa = 2");
        return $stmt->execute([
            ':estado' => $estado,
            ':id' => $id
        ]);
    }

    public function existeCodRol($codRol, $idPrograma = 2)
    {
        $query = "SELECT id, cod_rol FROM adm_rol WHERE cod_rol = :cod_rol AND id_programa = :id_programa LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([':cod_rol' => $codRol, ':id_programa' => $idPrograma]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
