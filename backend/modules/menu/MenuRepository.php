<?php
date_default_timezone_set('America/Lima');

class MenuRepository
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function getMenuPermitido($usuarioCodigo, $epre, $idPrograma = '5')
    {
        $query = "SELECT DISTINCT 
                    m.cod_mod, 
                    m.nom_mod, 
                    m.url, 
                    m.icono, 
                    m.tipo, 
                    m.parent_cod,
                    m.tipo_param,
                    m.titulo,
                    m.orden
                  FROM usuario u 
                  INNER JOIN adm_usuario_rol ur ON u.codigo = ur.codigo AND u.epre = ur.epre
                  INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol
                  INNER JOIN adm_rol_progr_modulo rpm ON r.id = rpm.id_rol
                  -- Blindaje: Cruzamos también por ID de programa
                  INNER JOIN amd_dashboard_modulos m ON rpm.cod_mod = m.cod_mod AND rpm.id_programa = m.id_programa
                  WHERE u.codigo = :usuarioCodigo 
                    AND u.epre = :epre 
                    AND m.id_programa = :idPrograma 
                    AND u.estado = 'A'
                    AND r.activo = 1
                  ORDER BY m.parent_cod, m.orden"
                ;

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':usuarioCodigo', $usuarioCodigo);
        $stmt->bindParam(':epre', $epre);
        $stmt->bindParam(':idPrograma', $idPrograma);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listarModulosMenu($idPrograma = '5')
    {
        $query = "SELECT * FROM amd_dashboard_modulos WHERE id_programa = :idPrograma ORDER BY parent_cod, orden";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':idPrograma', $idPrograma);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function listarModulosGrupos($idPrograma = '5')
    {
        $query = "SELECT cod_mod, nom_mod FROM amd_dashboard_modulos WHERE id_programa = :idPrograma AND tipo = 'group' ORDER BY orden";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':idPrograma', $idPrograma);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerPorId($id)
    {
        $query = "SELECT * FROM amd_dashboard_modulos WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function tieneHijos($codMod, $idPrograma = '5')
    {
        $query = "SELECT COUNT(*) as total FROM amd_dashboard_modulos WHERE parent_cod = :codMod AND id_programa = :idPrograma";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':codMod', $codMod);
        $stmt->bindParam(':idPrograma', $idPrograma);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row['total'] > 0;
    }

    public function guardar($datos)
    {
        $parent_cod  = !empty($datos['parent_cod']) ? $datos['parent_cod'] : null;
        $url         = !empty($datos['url']) ? $datos['url'] : null;
        $tipo_param  = !empty($datos['tipo_param']) ? $datos['tipo_param'] : null;
        $titulo      = !empty($datos['titulo']) ? $datos['titulo'] : null;
        $label_short = !empty($datos['label_short']) ? $datos['label_short'] : null;
        $icono       = !empty($datos['icono']) ? $datos['icono'] : 'fas fa-circle';

        // Forzar id_programa a '5' si no se especifica
        $id_programa = !empty($datos['id_programa']) ? $datos['id_programa'] : '5';

        if (empty($datos['id'])) {
            $query = "INSERT INTO amd_dashboard_modulos 
                      (id_programa, cod_mod, tipo, parent_cod, nom_mod, label_short, icono, url, tipo_param, titulo, orden) 
                      VALUES (:id_programa, :cod_mod, :tipo, :parent_cod, :nom_mod, :label_short, :icono, :url, :tipo_param, :titulo, :orden)";
            $stmt = $this->conn->prepare($query);
        } else {
            $query = "UPDATE amd_dashboard_modulos 
                      SET cod_mod = :cod_mod, tipo = :tipo, parent_cod = :parent_cod, nom_mod = :nom_mod, 
                          label_short = :label_short, icono = :icono, url = :url, tipo_param = :tipo_param, 
                          titulo = :titulo, orden = :orden 
                      WHERE id = :id AND id_programa = :id_programa";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $datos['id']);
        }

        $stmt->bindParam(':id_programa', $id_programa);
        $stmt->bindParam(':cod_mod', $datos['cod_mod']);
        $stmt->bindParam(':tipo', $datos['tipo']);
        $stmt->bindParam(':parent_cod', $parent_cod);
        $stmt->bindParam(':nom_mod', $datos['nom_mod']);
        $stmt->bindParam(':label_short', $label_short);
        $stmt->bindParam(':icono', $icono);
        $stmt->bindParam(':url', $url);
        $stmt->bindParam(':tipo_param', $tipo_param);
        $stmt->bindParam(':titulo', $titulo);
        $stmt->bindParam(':orden', $datos['orden']);

        return $stmt->execute();
    }

    public function eliminar($id)
    {
        $query = "DELETE FROM amd_dashboard_modulos WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        return $stmt->execute();
    }
}
