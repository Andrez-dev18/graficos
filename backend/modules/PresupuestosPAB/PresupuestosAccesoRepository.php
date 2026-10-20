<?php
date_default_timezone_set('America/Lima');

class PresupuestosAccesoRepository
{
    private $conn;

    public function __construct(PDO $db)
    {
        $this->conn = $db;
    }

    // 1. DataTables: Trae usuarios con sus presupuestos asignados
    public function getUsuariosPresupuestosDataTable($start, $length, $searchValue, $epre = 'RS')
    {
        $sqlBase = "FROM usuario u WHERE u.epre = :epre AND u.estado = 'A'";
        $params = [':epre' => $epre];

        if (!empty($searchValue)) {
            $sqlBase .= " AND (u.codigo LIKE :search1 OR u.nombre LIKE :search2)";
            $params[':search1'] = "%$searchValue%";
            $params[':search2'] = "%$searchValue%";
        }

        // Conteo filtrado
        $stmtFiltro = $this->conn->prepare("SELECT COUNT(u.codigo) " . $sqlBase);
        $stmtFiltro->execute($params);
        $recordsFiltered = $stmtFiltro->fetchColumn();

        // Conteo total
        $stmtTotal = $this->conn->prepare("SELECT COUNT(codigo) FROM usuario WHERE epre = :epre AND estado = 'A'");
        $stmtTotal->execute([':epre' => $epre]);
        $recordsTotal = $stmtTotal->fetchColumn();

        // Obtener datos con GROUP_CONCAT de los presupuestos asignados
        $sqlData = "SELECT u.codigo, u.nombre,
                        (SELECT GROUP_CONCAT(up.cod_presupuesto ORDER BY up.cod_presupuesto SEPARATOR '||') 
                         FROM adm_usuario_presupuesto up 
                         WHERE up.codigo_usuario = u.codigo AND up.epre = u.epre) as presupuestos_asignados
                    " . $sqlBase . " 
                    ORDER BY CASE WHEN presupuestos_asignados IS NOT NULL THEN 0 ELSE 1 END ASC, 
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
            'recordsTotal' => (int)$recordsTotal,
            'recordsFiltered' => (int)$recordsFiltered,
            'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)
        ];
    }

    // 2. Traer catálogo de presupuestos maestros disponibles
    public function obtenerPresupuestosDisponibles()
    {
        try {
            $sql = "SELECT LEFT(TRIM(presupuesto), 6) AS cod_presupuesto,
                           MIN(TRIM(presupuesto)) AS nombre,
                           MIN(TRIM(nomcencos)) AS descripcion
                    FROM presucencosdet
                    WHERE presupuesto IS NOT NULL
                      AND TRIM(presupuesto) <> ''
                      AND LEFT(TRIM(presupuesto), 6) REGEXP '^[0-9]{6}$'
                    GROUP BY LEFT(TRIM(presupuesto), 6)
                    ORDER BY cod_presupuesto";

            $stmt = $this->conn->query($sql);
            $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($filas)) {
                return array_map(function ($fila) {
                    return [
                        'cod_presupuesto' => $fila['cod_presupuesto'],
                        'nombre'          => !empty($fila['nombre']) ? $fila['nombre'] : $fila['cod_presupuesto'],
                        'descripcion'     => $fila['descripcion'] ?? ''
                    ];
                }, $filas);
            }
        } catch (\Exception $e) {
            error_log('Error al obtener catálogo de presupuestos: ' . $e->getMessage());
        }

        return [
            [
                'cod_presupuesto' => '202403',
                'nombre'          => 'Presupuesto 2024-03',
                'descripcion'     => 'Predio Gloria (Avícola Bellavista)'
            ],
            [
                'cod_presupuesto' => '202404',
                'nombre'          => 'Presupuesto 2024-04',
                'descripcion'     => 'Polleras'
            ],
            [
                'cod_presupuesto' => '202410',
                'nombre'          => 'Presupuesto 2024-10',
                'descripcion'     => 'Postura'
            ],
            [
                'cod_presupuesto' => '202503',
                'nombre'          => 'Presupuesto 2025-03',
                'descripcion'     => 'PAB 2025'
            ]
        ];
    }

    // 3. Traer códigos asignados a un usuario específico
    public function obtenerPresupuestosDeUsuario($codigoUsuario, $epre = 'RS')
    {
        $sql = "SELECT cod_presupuesto 
                FROM adm_usuario_presupuesto 
                WHERE codigo_usuario = :codigo AND epre = :epre
                ORDER BY cod_presupuesto ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':codigo' => $codigoUsuario, ':epre' => $epre]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    // 4. Transacción: Guardar presupuestos asignados al usuario
    public function guardarPresupuestos($codigoUsuario, $epre, array $presupuestos, $reduser = null)
    {
        try {
            $this->conn->beginTransaction();

            // 1. Eliminar asignaciones previas del usuario
            $sqlDel = "DELETE FROM adm_usuario_presupuesto 
                       WHERE codigo_usuario = :codigo AND epre = :epre";
            $stmtDel = $this->conn->prepare($sqlDel);
            $stmtDel->execute([':codigo' => $codigoUsuario, ':epre' => $epre]);

            // 2. Si envió presupuestos, insertarlos
            if (!empty($presupuestos)) {
                $placeholders = [];
                $valores = [];

                foreach ($presupuestos as $presupuesto) {
                    $placeholders[] = "(?, ?, ?, ?)";
                    $valores[] = $codigoUsuario;
                    $valores[] = $epre;
                    $valores[] = trim((string)$presupuesto);
                    $valores[] = $reduser;
                }

                $queryIns = "INSERT INTO adm_usuario_presupuesto (codigo_usuario, epre, cod_presupuesto, reduser) 
                             VALUES " . implode(', ', $placeholders);
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
