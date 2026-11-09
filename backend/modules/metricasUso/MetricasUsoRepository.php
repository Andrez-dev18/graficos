<?php
date_default_timezone_set('America/Lima');

class MetricasUsoRepository
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function tienePermisoModulo($codUsuario, $epre, $idPrograma, $url)
    {
        $query = "SELECT COUNT(*)
                  FROM usuario u
                  INNER JOIN adm_usuario_rol ur ON u.codigo = ur.codigo AND u.epre = ur.epre
                  INNER JOIN adm_rol r ON ur.cod_rol = r.cod_rol
                  INNER JOIN adm_rol_progr_modulo rpm ON r.id = rpm.id_rol
                  INNER JOIN amd_dashboard_modulos m ON rpm.cod_mod = m.cod_mod AND rpm.id_programa = m.id_programa
                  WHERE u.codigo = :codUsuario
                    AND u.epre = :epre
                    AND u.estado = 'A'
                    AND r.activo = 1
                    AND m.id_programa = :idPrograma
                    AND m.url = :url";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':codUsuario' => $codUsuario,
            ':epre' => $epre,
            ':idPrograma' => $idPrograma,
            ':url' => $url
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    public function obtenerAccesosPorDia($idPrograma, $desde, $hasta)
    {
        $query = "SELECT DATE(fechaHora) AS dia, COUNT(*) AS total
                  FROM com_db_dashboard_accesos
                  WHERE id_programa = :id_programa
                    AND fechaHora BETWEEN :desde AND :hasta
                  GROUP BY DATE(fechaHora)
                  ORDER BY dia";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':desde' => $desde,
            ':hasta' => $hasta
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerAccesosPorUsuario($idPrograma, $desde, $hasta)
    {
        $query = "SELECT a.cod_usuario, a.epre, u.nombre,
                         COUNT(*) AS consultas,
                         COUNT(DISTINCT a.cod_mod) AS modulos,
                         MAX(a.fechaHora) AS ultimo_acceso
                  FROM com_db_dashboard_accesos a
                  LEFT JOIN usuario u ON u.codigo = a.cod_usuario
                  WHERE a.id_programa = :id_programa
                    AND a.fechaHora BETWEEN :desde AND :hasta
                  GROUP BY a.cod_usuario, a.epre, u.nombre";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':desde' => $desde,
            ':hasta' => $hasta
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerAccesosPorModulo($idPrograma, $desde, $hasta)
    {
        $query = "SELECT a.cod_mod,
                         COALESCE(MAX(m.nom_mod), MAX(a.nom_mod)) AS nom_mod,
                         MAX(p.nom_mod) AS categoria,
                         COUNT(*) AS consultas,
                         COUNT(DISTINCT a.cod_usuario) AS usuarios,
                         MAX(a.fechaHora) AS ultimo_acceso
                  FROM com_db_dashboard_accesos a
                  LEFT JOIN amd_dashboard_modulos m ON m.cod_mod = a.cod_mod AND m.id_programa = a.id_programa
                  LEFT JOIN amd_dashboard_modulos p ON p.cod_mod = m.parent_cod AND p.id_programa = m.id_programa
                  WHERE a.id_programa = :id_programa
                    AND a.fechaHora BETWEEN :desde AND :hasta
                  GROUP BY a.cod_mod
                  ORDER BY consultas DESC, usuarios DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':desde' => $desde,
            ':hasta' => $hasta
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerIngresosPorDia($idPrograma, $desde, $hasta)
    {
        $query = "SELECT DATE(fechaHora) AS dia, COUNT(*) AS total
                  FROM com_historial_acciones
                  WHERE id_programa = :id_programa
                    AND accion = 'LOGIN'
                    AND fechaHora BETWEEN :desde AND :hasta
                  GROUP BY DATE(fechaHora)
                  ORDER BY dia";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':desde' => $desde,
            ':hasta' => $hasta
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerIngresosPorUsuario($idPrograma, $desde, $hasta)
    {
        $query = "SELECT h.cod_usuario, u.nombre,
                         COUNT(*) AS ingresos,
                         MAX(h.fechaHora) AS ultimo_ingreso
                  FROM com_historial_acciones h
                  LEFT JOIN usuario u ON u.codigo = h.cod_usuario
                  WHERE h.id_programa = :id_programa
                    AND h.accion = 'LOGIN'
                    AND h.fechaHora BETWEEN :desde AND :hasta
                    AND h.cod_usuario IS NOT NULL
                  GROUP BY h.cod_usuario, u.nombre";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':desde' => $desde,
            ':hasta' => $hasta
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerUsuariosConAcceso($idPrograma)
    {
        $query = "SELECT u.codigo, u.nombre, u.epre,
                         GROUP_CONCAT(DISTINCT r.nom_rol ORDER BY r.nom_rol SEPARATOR ', ') AS roles
                  FROM usuario u
                  INNER JOIN adm_usuario_rol ur ON ur.codigo = u.codigo AND ur.epre = u.epre
                  INNER JOIN adm_rol r ON r.cod_rol = ur.cod_rol
                  WHERE u.estado = 'A'
                    AND r.id_programa = :id_programa
                    AND r.activo = 1
                  GROUP BY u.codigo, u.nombre, u.epre
                  ORDER BY u.nombre";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
