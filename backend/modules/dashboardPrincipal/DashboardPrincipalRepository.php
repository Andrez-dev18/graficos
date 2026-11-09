<?php
date_default_timezone_set('America/Lima');

class DashboardPrincipalRepository
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function insertarAcceso($data)
    {
        $query = "INSERT INTO com_db_dashboard_accesos
                  (id_programa, cod_usuario, epre, cod_mod, nom_mod, url, fechaHora, ip, user_agent)
                  VALUES
                  (:id_programa, :cod_usuario, :epre, :cod_mod, :nom_mod, :url, :fechaHora, :ip, :user_agent)";

        $stmt = $this->conn->prepare($query);

        return $stmt->execute([
            ':id_programa' => $data['id_programa'],
            ':cod_usuario' => $data['cod_usuario'],
            ':epre' => $data['epre'],
            ':cod_mod' => $data['cod_mod'],
            ':nom_mod' => $data['nom_mod'],
            ':url' => $data['url'],
            ':fechaHora' => $data['fechaHora'],
            ':ip' => $data['ip'],
            ':user_agent' => $data['user_agent']
        ]);
    }

    public function contarAccesos($codUsuario, $epre, $idPrograma, $inicio, $fin)
    {
        $query = "SELECT COUNT(*)
                  FROM com_db_dashboard_accesos
                  WHERE id_programa = :id_programa
                    AND cod_usuario = :cod_usuario
                    AND epre = :epre
                    AND fechaHora >= :inicio
                    AND fechaHora < :fin";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':cod_usuario' => $codUsuario,
            ':epre' => $epre,
            ':inicio' => $inicio,
            ':fin' => $fin
        ]);

        return $stmt->fetchColumn();
    }

    public function obtenerUltimoAcceso($codUsuario, $epre, $idPrograma)
    {
        $query = "SELECT cod_mod, nom_mod, url, fechaHora
                  FROM com_db_dashboard_accesos
                  WHERE id_programa = :id_programa
                    AND cod_usuario = :cod_usuario
                    AND epre = :epre
                  ORDER BY fechaHora DESC, id DESC
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':cod_usuario' => $codUsuario,
            ':epre' => $epre
        ]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function obtenerMasFrecuenteMes($codUsuario, $epre, $idPrograma, $inicioMes, $finMes)
    {
        $query = "SELECT cod_mod, MAX(nom_mod) AS nom_mod, MAX(url) AS url, COUNT(*) AS total, MAX(fechaHora) AS ultima
                  FROM com_db_dashboard_accesos
                  WHERE id_programa = :id_programa
                    AND cod_usuario = :cod_usuario
                    AND epre = :epre
                    AND fechaHora >= :inicio
                    AND fechaHora < :fin
                  GROUP BY cod_mod
                  ORDER BY total DESC, ultima DESC
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':id_programa' => $idPrograma,
            ':cod_usuario' => $codUsuario,
            ':epre' => $epre,
            ':inicio' => $inicioMes,
            ':fin' => $finMes
        ]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function obtenerAccesos($codUsuario, $epre, $idPrograma = '5')
    {
        $query = "SELECT accesosJson
                  FROM com_db_acceso_directo
                  WHERE usuarioCodigo = :usuarioCodigo
                    AND epre = :epre
                    AND id_programa = :id_programa
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->execute([
            ':usuarioCodigo' => $codUsuario,
            ':epre' => $epre,
            ':id_programa' => $idPrograma
        ]);

        $resultado = $stmt->fetch(PDO::FETCH_ASSOC);

        return $resultado ? $resultado['accesosJson'] : null;
    }

    public function guardarAccesos($data)
    {
        $query = "INSERT INTO com_db_acceso_directo
                  (usuarioCodigo, epre, id_programa, accesosJson, usuarioRegistro, fechaHoraRegistro)
                  VALUES
                  (:usuarioCodigo, :epre, :id_programa, :accesosJson, :usuarioRegistro, :fechaHoraRegistro)
                  ON DUPLICATE KEY UPDATE
                    accesosJson = VALUES(accesosJson),
                    usuarioModificacion = VALUES(usuarioRegistro),
                    fechaHoraModificacion = NOW()";

        $stmt = $this->conn->prepare($query);

        return $stmt->execute([
            ':usuarioCodigo' => $data['usuarioCodigo'],
            ':epre' => $data['epre'],
            ':id_programa' => $data['id_programa'],
            ':accesosJson' => $data['accesosJson'],
            ':usuarioRegistro' => $data['usuarioRegistro'],
            ':fechaHoraRegistro' => $data['fechaHoraRegistro']
        ]);
    }

    public function obtenerTopModulos($codUsuario, $epre, $idPrograma, $inicio, $limite = 5)
    {
        $query = "SELECT cod_mod, COUNT(*) AS total, MAX(fechaHora) AS ultima
                  FROM com_db_dashboard_accesos
                  WHERE id_programa = :id_programa
                    AND cod_usuario = :cod_usuario
                    AND epre = :epre
                    AND fechaHora >= :inicio
                  GROUP BY cod_mod
                  ORDER BY total DESC, ultima DESC
                  LIMIT :limite";

        $stmt = $this->conn->prepare($query);
        $stmt->bindValue(':id_programa', $idPrograma);
        $stmt->bindValue(':cod_usuario', $codUsuario);
        $stmt->bindValue(':epre', $epre);
        $stmt->bindValue(':inicio', $inicio);
        $stmt->bindValue(':limite', (int) $limite, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
