<?php
date_default_timezone_set('America/Lima');

class AsignacionRepository
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // 1. DataTables: Trae usuarios globales + los nombres de los roles que tienen en Planta Beneficio (Programa 2)
    public function getUsuariosRolesDataTable($start, $length, $searchValue, $epre = 'RS')
    {
        $sqlBase = "FROM usuario u WHERE u.epre = :epre AND u.estado = 'A'";
        $params = [':epre' => $epre];

        if (!empty($searchValue)) {
            $sqlBase .= " AND (u.codigo LIKE :search1 OR u.nombre LIKE :search2)";
            $params[':search1'] = "%$searchValue%";
            $params[':search2'] = "%$searchValue%";
        }

        // Conteo filtrado y total absoluto corporativo
        $stmtFiltro = $this->conn->prepare("SELECT COUNT(u.codigo) " . $sqlBase);
        $stmtFiltro->execute($params);
        $recordsFiltered = $stmtFiltro->fetchColumn();

        $stmtTotal = $this->conn->prepare("SELECT COUNT(codigo) FROM usuario WHERE epre = :epre AND estado = 'A'");
        $stmtTotal->execute([':epre' => $epre]);
        $recordsTotal = $stmtTotal->fetchColumn();

        $sqlData = "SELECT u.codigo, u.nombre,
                        (SELECT GROUP_CONCAT(r.nom_rol SEPARATOR '||') 
                         FROM adm_usuario_rol ur 
                         INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol 
                         WHERE ur.codigo = u.codigo AND ur.epre = u.epre AND r.id_programa = 2) as roles_asignados
                    " . $sqlBase . " 
                    ORDER BY CASE WHEN roles_asignados IS NOT NULL THEN 0 ELSE 1 END ASC, 
                             u.codigo ASC 
                    LIMIT :start, :length";

        $stmt = $this->conn->prepare($sqlData);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        }
        $stmt->bindValue(':start', (int)$start, PDO::PARAM_INT);
        $stmt->bindValue(':length', (int)$length, PDO::PARAM_INT);
        $stmt->execute();

        return [
            'recordsTotal' => $recordsTotal,
            'recordsFiltered' => $recordsFiltered,
            'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ];
    }

    // 2. Traer todos los roles activos del Programa 2 para pintar las "tarjetas" en el modal
    public function obtenerRolesDisponibles($idPrograma = '2')
    {
        $stmt = $this->conn->prepare("SELECT cod_rol, nom_rol, descripcion FROM adm_rol WHERE activo = 1 AND id_programa = :idProg ORDER BY nom_rol");
        $stmt->execute([':idProg' => $idPrograma]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // 3. Traer solo los CÓDIGOS de rol de un usuario específico para marcar los checkboxes en Planta (Programa 2)
    public function obtenerRolesDeUsuario($codigo, $epre = 'RS')
    {

        $sql = "SELECT ur.cod_rol 
                FROM adm_usuario_rol ur
                INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol
                WHERE ur.codigo = :codigo AND ur.epre = :epre AND r.id_programa = 2";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':codigo' => $codigo, ':epre' => $epre]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // 4. Transacción: Borrar roles viejos de Planta y guardar los nuevos para el usuario
    public function guardarRoles($codigo, $epre, $roles, $reduser)
    {
        try {
            $this->conn->beginTransaction();

            $sqlDel = "DELETE ur FROM adm_usuario_rol ur 
                       INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol 
                       WHERE ur.codigo = :codigo AND ur.epre = :epre AND r.id_programa = 2";
            $stmtDel = $this->conn->prepare($sqlDel);
            $stmtDel->execute([':codigo' => $codigo, ':epre' => $epre]);

            // Si envió roles, los insertamos en bloque
            if (!empty($roles) && is_array($roles)) {
                $placeholders = [];
                $valores = [];

                foreach ($roles as $rol) {
                    $placeholders[] = "(?, ?, ?, ?)";
                    $valores[] = $codigo;
                    $valores[] = $epre;
                    $valores[] = $rol;
                    $valores[] = $reduser;
                }

                $queryIns = "INSERT INTO adm_usuario_rol (codigo, epre, cod_rol, reduser) VALUES " . implode(', ', $placeholders);
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
}
