<?php

class UsuarioRepository
{

    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function login($usuario, $password)
    {
        $sql = "SELECT u.codigo, u.nombre, u.rol_comercial, u.epre, u.ruc, u.rol_flujo, u.estado
            FROM usuario u
            JOIN conempre c ON c.epre = 'RS'
            WHERE u.codigo = ?
            AND u.password = LEFT(AES_ENCRYPT(?, c.enom), 8)";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(1, $usuario, PDO::PARAM_STR);
        $stmt->bindParam(2, $password, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function cambiarPassword($codigo, $epre, $oldPassword, $newPassword)
    {
        $sql = "UPDATE usuario u
                JOIN conempre c ON c.epre = 'RS'
                SET u.password = LEFT(AES_ENCRYPT(:newPassword, c.enom), 8)
                WHERE u.codigo = :codigo 
                  AND u.epre = :epre
                  AND u.password = LEFT(AES_ENCRYPT(:oldPassword, c.enom), 8)";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':newPassword', $newPassword, PDO::PARAM_STR);
        $stmt->bindParam(':codigo', $codigo, PDO::PARAM_STR);
        $stmt->bindParam(':epre', $epre, PDO::PARAM_STR);
        $stmt->bindParam(':oldPassword', $oldPassword, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    //
    //funciones para la gestion de usuarios
    //
    public function getUsuariosServerSide($start, $length, $searchValue, $orderColumn, $orderDir, $epre = 'RS')
    {
        $columnasBd = ['codigo', 'codigo', 'nombre', 'ruc', 'estado'];
        $campoOrden = $columnasBd[$orderColumn] ?? 'codigo';

        $sqlBase = "FROM usuario WHERE epre = :epre";
        $params = [':epre' => $epre];

        if (!empty($searchValue)) {
            $sqlBase .= " AND (codigo LIKE :search1 OR nombre LIKE :search2 OR ruc LIKE :search3)";
            $params[':search1'] = "%$searchValue%";
            $params[':search2'] = "%$searchValue%";
            $params[':search3'] = "%$searchValue%";
        }

        $stmtFiltro = $this->conn->prepare("SELECT COUNT(*) " . $sqlBase);
        $stmtFiltro->execute($params);
        $recordsFiltered = $stmtFiltro->fetchColumn();

        $stmtTotal = $this->conn->prepare("SELECT COUNT(*) FROM usuario WHERE epre = :epre");
        $stmtTotal->execute([':epre' => $epre]);
        $recordsTotal = $stmtTotal->fetchColumn();

        $sqlData = "SELECT codigo, nombre, ruc, estado " . $sqlBase . " ORDER BY $campoOrden $orderDir LIMIT :start, :length";
        $stmt = $this->conn->prepare($sqlData);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        }
        $stmt->bindValue(':start', (int)$start, PDO::PARAM_INT);
        $stmt->bindValue(':length', (int)$length, PDO::PARAM_INT);
        $stmt->execute();

        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'recordsTotal'    => $recordsTotal,
            'recordsFiltered' => $recordsFiltered,
            'data'            => $data
        ];
    }

    public function obtenerPorCodigo($codigo, $epre = 'RS')
    {
        $sql = "SELECT codigo, nombre, ruc, estado FROM usuario WHERE codigo = :codigo AND epre = :epre";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':codigo' => $codigo, ':epre' => $epre]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function guardar($datos, $isEdit = false)
    {
        $epre = 'RS';
        $reduser = $_SESSION['usuario'] ?? 'SYSTEM'; // Quien registra

        if ($isEdit) {
            // EDITAR (Solo actualiza nombre y ruc, no toca contraseña ni código)
            $sql = "UPDATE usuario SET nombre = :nombre, ruc = :ruc WHERE codigo = :codigo AND epre = :epre";
            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':nombre', $datos['nombre']);
            $stmt->bindParam(':codigo', $datos['codigo']);
            $stmt->bindParam(':ruc', $datos['ruc']);
            $stmt->bindParam(':epre', $epre);
            return $stmt->execute();
        } else {
            // CREAR (Inserta código, nombre, ruc, y encripta contraseña usando conempre)
            // CORRECCIÓN: Se usa :epre y :epre_where para evitar el error HY093 de PDO
            $sql = "INSERT INTO usuario (codigo, epre, nombre, ruc, password, estado, reduser, tdate) 
                    SELECT :codigo, :epre, :nombre, :ruc, LEFT(AES_ENCRYPT(:password, enom), 8), 'A', :reduser, NOW() 
                    FROM conempre WHERE epre = :epre_where";

            $stmt = $this->conn->prepare($sql);
            $stmt->bindParam(':codigo', $datos['codigo']);
            $stmt->bindParam(':epre', $epre);
            $stmt->bindParam(':epre_where', $epre); // <-- Binding independiente para el WHERE
            $stmt->bindParam(':nombre', $datos['nombre']);
            $stmt->bindParam(':ruc', $datos['ruc']);
            $stmt->bindParam(':password', $datos['password']);
            $stmt->bindParam(':reduser', $reduser);
            return $stmt->execute();
        }
    }

    public function toggleEstado($codigo, $epre = 'RS')
    {
        $sql = "UPDATE usuario SET estado = IF(estado = 'A', 'I', 'A') WHERE codigo = :codigo AND epre = :epre";
        $stmt = $this->conn->prepare($sql);
        return $stmt->execute([':codigo' => $codigo, ':epre' => $epre]);
    }

    public function adminResetPassword($codigo, $newPassword, $epre = 'RS')
    {
        $sql = "UPDATE usuario u
                JOIN conempre c ON c.epre = u.epre
                SET u.password = LEFT(AES_ENCRYPT(:newPassword, c.enom), 8)
                WHERE u.codigo = :codigo AND u.epre = :epre";

        $stmt = $this->conn->prepare($sql);
        $stmt->bindParam(':newPassword', $newPassword, PDO::PARAM_STR);
        $stmt->bindParam(':codigo', $codigo, PDO::PARAM_STR);
        $stmt->bindParam(':epre', $epre, PDO::PARAM_STR);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    public function tieneRolesActivos($codigoUsuario, $epre = 'RS', $idPrograma = 5)
    {
        $sql = "SELECT COUNT(*) 
                FROM adm_usuario_rol ur
                INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol
                WHERE ur.codigo = :codigo 
                  AND ur.epre = :epre 
                  AND r.id_programa = :id_programa
                  AND r.activo = 1";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':codigo' => $codigoUsuario,
            ':epre' => $epre,
            ':id_programa' => $idPrograma
        ]);

        return $stmt->fetchColumn() > 0;
    }
}
